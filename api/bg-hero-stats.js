const { sendJson, rateLimit } = require("./_blizzard");

const SOURCE_URL = "https://api.hs-manacost.ru/datasets/hsreplay_battlegrounds_heroes";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

let cached = null;
let inFlight = null;

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Codex Battlegrounds Hub"
      }
    });
    if (!response.ok) {
      throw new Error(`hs-manacost HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeHero(entry) {
  return {
    hero: String(entry?.hero || "").trim(),
    dbfId: Number(entry?.dbfId) || null,
    pickRate: String(entry?.pick_rate || "").trim(),
    bestComp: String(entry?.best_comp || "").trim(),
    avgPlacement: String(entry?.avg_placement || "").trim(),
    tier: String(entry?.tier || "").trim().toUpperCase()
  };
}

async function buildPayload() {
  const raw = await fetchJsonWithTimeout(SOURCE_URL);
  const structured = raw?.data?.structured;
  if (structured?.type !== "bg_heroes" || !Array.isArray(structured.heroes)) {
    throw new Error("Неожиданный формат данных hsreplay_battlegrounds_heroes.");
  }

  const heroes = structured.heroes
    .map(normalizeHero)
    .filter((hero) => hero.hero && hero.dbfId && hero.tier);

  return {
    source: "HSReplay через api.hs-manacost.ru",
    fetchedAt: raw?.fetched_at || new Date().toISOString(),
    count: heroes.length,
    heroes
  };
}

async function getHeroStats() {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = buildPayload()
    .then((payload) => {
      cached = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload
      };
      return payload;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "bg-hero-stats", 30, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  try {
    const payload = await getHeroStats();
    sendJson(res, 200, payload, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить статистику героев Полей сражений.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
