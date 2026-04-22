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
      page,
      pageSize: 500
    });
    cards.push(...(response.cards || []));
    pageCount = Number(response.pageCount) || 1;
    page += 1;
  }
  return cards;
}

// Trinket detection across the few shapes Blizzard's BG payload has used.
function isTrinket(card) {
  if (!card || !card.battlegrounds) return false;
  if (card.battlegrounds.trinket) return true;
  // Observed cardTypeId values for BG trinkets — we keep this loose because
  // Blizzard has shipped a couple of variants. Anything that's clearly a BG
  // trinket via the tag heuristic also passes.
  if ([43, 44, 45].includes(Number(card.cardTypeId))) return true;
  if (Array.isArray(card.keywordIds) && card.keywordIds.includes(101)) return true; // tentative: trinket keyword id
  return false;
}

function detectSize(card) {
  const trinket = card.battlegrounds && card.battlegrounds.trinket;
  if (trinket && (trinket.tier === 1 || trinket.size === "SMALL" || trinket.size === "LESSER")) return "SMALL";
  if (trinket && (trinket.tier === 2 || trinket.size === "LARGE" || trinket.size === "GREATER")) return "LARGE";
  if (card.battlegrounds && card.battlegrounds.tier === 1) return "SMALL";
  if (card.battlegrounds && card.battlegrounds.tier === 2) return "LARGE";
  if (card.cardTypeId === 43) return "SMALL";
  if (card.cardTypeId === 44) return "LARGE";
  const text = `${card.name || ""} ${card.text || ""}`.toLowerCase();
  if (text.includes("малый") || text.includes("lesser")) return "SMALL";
  if (text.includes("большой") || text.includes("greater")) return "LARGE";
  return "SMALL";
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "accessories", 60, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  const locale = normalizeLocale(req.query.locale || "ru_RU");

  try {
    const battlegroundCards = await fetchAllBattlegroundCards(locale);
    const trinkets = battlegroundCards.filter(isTrinket);

    const accessories = trinkets.map((card) => {
      const size = detectSize(card);
      const upstreamImage = card.battlegrounds?.image
        || card.image
        || card.cropImage
        || card.battlegrounds?.imageGold
        || "";
      const upstreamCrop = card.cropImage || upstreamImage;
      return {
        id: `bg-${card.id || card.slug || card.dbfId}`,
        blizzardId: card.id ?? null,
        slug: card.slug || "",
        name: card.name || "",
        text: stripHtml(card.text || ""),
        size,
        image: buildRemoteImageProxyUrl(upstreamImage),
        cropImage: buildRemoteImageProxyUrl(upstreamCrop),
        imageOriginal: upstreamImage,
        rarityId: card.rarityId || null,
        cardTypeId: card.cardTypeId || null,
        battlegrounds: card.battlegrounds || null
      };
    }).sort((a, b) => {
      if (a.size !== b.size) return a.size === "SMALL" ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""), locale.replace("_", "-"));
    });

    const small = accessories.filter((a) => a.size === "SMALL");
    const large = accessories.filter((a) => a.size === "LARGE");

    sendJson(res, 200, {
      source: "Blizzard Hearthstone API",
      locale,
      total: accessories.length,
      small,
      large,
      accessories
    }, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить аксессуары Полей сражений из Blizzard API.",
      details: error.message
    });
  }
};
