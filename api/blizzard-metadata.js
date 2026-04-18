const { fetchBlizzardJson, normalizeLocale, sendJson, rateLimit } = require("./_blizzard");

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "metadata", 60, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

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
    }, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить метаданные Hearthstone из Blizzard API.",
      details: error.message
    });
  }
};
