const { fetchBlizzardJson, normalizeLocale, sendJson, rateLimit } = require("./_blizzard");

function buildRemoteImageProxyUrl(imageUrl) {
  const normalized = String(imageUrl || "").trim();
  return normalized ? `/api/remote-image?src=${encodeURIComponent(normalized)}` : "";
}

async function fetchAllBattlegroundCards(locale) {
  const cards = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const response = await fetchBlizzardJson("/cards", {
      locale,
      gameMode: "battlegrounds",
      sort: "tier:asc,manaCost:asc",
      page,
      pageSize: 500
    });

    cards.push(...(response.cards || []));
    pageCount = Number(response.pageCount) || 1;
    page += 1;
  }

  return cards;
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "spells", 60, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  const locale = normalizeLocale(req.query.locale || "ru_RU");
  const sortLocale = String(locale).replace("_", "-");
  const pageSize = Math.min(Number(req.query.pageSize) || 200, 500);

  try {
    const battlegroundCards = await fetchAllBattlegroundCards(locale);

    const cards = battlegroundCards
      .filter((card) => card && card.battlegrounds && Number(card.cardTypeId) === 42)
      .sort((left, right) => {
        return (left.battlegrounds?.tier || 0) - (right.battlegrounds?.tier || 0)
          || (left.manaCost || 0) - (right.manaCost || 0)
          || String(left.name || "").localeCompare(String(right.name || ""), sortLocale);
      })
      .slice(0, pageSize)
      .map((card) => {
        const upstreamImage = card.battlegrounds.image || card.image || card.cropImage || "";
        const upstreamImageGold = card.battlegrounds.imageGold || card.imageGold || "";
        const upstreamCropImage = card.cropImage || upstreamImage;

        return {
          id: card.id,
          slug: card.slug,
          name: card.name,
          text: card.text || "",
          flavorText: card.flavorText || "",
          manaCost: card.manaCost ?? 0,
          image: buildRemoteImageProxyUrl(upstreamImage),
          imageGold: buildRemoteImageProxyUrl(upstreamImageGold),
          cropImage: buildRemoteImageProxyUrl(upstreamCropImage),
          imageOriginal: upstreamImage,
          setId: card.cardSetId || null,
          typeId: card.cardTypeId || null,
          spellSchoolId: card.spellSchoolId || null,
          classId: card.classId || null,
          tier: card.battlegrounds.tier ?? null,
          battlegrounds: {
            hero: Boolean(card.battlegrounds.hero),
            quest: Boolean(card.battlegrounds.quest),
            reward: Boolean(card.battlegrounds.reward),
            duosOnly: Boolean(card.battlegrounds.duosOnly),
            solosOnly: Boolean(card.battlegrounds.solosOnly)
          }
        };
      });

    sendJson(res, 200, {
      source: "Blizzard Hearthstone API",
      locale,
      total: battlegroundCards.filter((card) => card && card.battlegrounds && Number(card.cardTypeId) === 42).length,
      cards
    }, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить заклинания Полей сражений из Blizzard API.",
      details: error.message
    });
  }
};
