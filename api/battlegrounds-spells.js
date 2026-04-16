const { fetchBlizzardJson, normalizeLocale, sendJson } = require("./_blizzard");

module.exports = async function handler(req, res) {
  const locale = normalizeLocale(req.query.locale || "ru_RU");
  const pageSize = Math.min(Number(req.query.pageSize) || 100, 100);

  try {
    const response = await fetchBlizzardJson("/cards", {
      locale,
      gameMode: "battlegrounds",
      type: "spell",
      sort: "manaCost:asc",
      page: 1,
      pageSize
    });

    const cards = (response.cards || [])
      .filter((card) => card && card.battlegrounds)
      .map((card) => ({
        id: card.id,
        slug: card.slug,
        name: card.name,
        text: card.text || "",
        flavorText: card.flavorText || "",
        manaCost: card.manaCost ?? 0,
        image: card.battlegrounds.image || card.image || card.cropImage || "",
        imageGold: card.battlegrounds.imageGold || card.imageGold || "",
        cropImage: card.cropImage || "",
        setId: card.cardSetId || null,
        typeId: card.cardTypeId || null,
        spellSchoolId: card.spellSchoolId || null,
        classId: card.classId || null,
        battlegrounds: {
          hero: Boolean(card.battlegrounds.hero),
          quest: Boolean(card.battlegrounds.quest),
          reward: Boolean(card.battlegrounds.reward),
          duosOnly: Boolean(card.battlegrounds.duosOnly),
          solosOnly: Boolean(card.battlegrounds.solosOnly)
        }
      }));

    sendJson(res, 200, {
      source: "Blizzard Hearthstone API",
      locale,
      total: cards.length,
      cards
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить заклинания Полей сражений из Blizzard API.",
      details: error.message
    });
  }
};
