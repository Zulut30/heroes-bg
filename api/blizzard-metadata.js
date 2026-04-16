const { fetchBlizzardJson, normalizeLocale, sendJson } = require("./_blizzard");

module.exports = async function handler(req, res) {
  const locale = normalizeLocale(req.query.locale || "ru_RU");

  try {
    const metadata = await fetchBlizzardJson("/metadata", { locale });
    sendJson(res, 200, {
      source: "Blizzard Hearthstone API",
      locale,
      sets: metadata.sets || [],
      types: metadata.types || [],
      rarities: metadata.rarities || [],
      classes: metadata.classes || [],
      minionTypes: metadata.minionTypes || [],
      spellSchools: metadata.spellSchools || [],
      keywords: metadata.keywords || []
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить метаданные Hearthstone из Blizzard API.",
      details: error.message
    });
  }
};
