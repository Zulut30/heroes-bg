const { fetchBlizzardJson, normalizeLocale, sendJson } = require("./_blizzard");

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

module.exports = async function handler(req, res) {
  const locale = normalizeLocale(req.query.locale || "en_US");

  try {
    const battlegroundCards = await fetchAllBattlegroundCards(locale);
    const cards = battlegroundCards
      .filter((card) => card && card.id && card.battlegrounds)
      .map((card) => ({
        id: String(card.id),
        name: card.name || "",
        slug: card.slug || "",
        typeId: Number(card.cardTypeId) || null,
        hero: Boolean(card.battlegrounds?.hero)
      }));

    sendJson(res, 200, {
      source: "Blizzard Hearthstone API",
      locale,
      total: cards.length,
      cards
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить английские названия карт Полей сражений.",
      details: error.message
    });
  }
};
