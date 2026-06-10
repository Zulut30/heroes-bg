const { sendJson, rateLimit } = require("./_blizzard");

const SOURCE_URL = "https://api.hs-manacost.ru/datasets/hsreplay_battlegrounds_minions";
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

function normalizeMinion(entry) {
  return {
    id: String(entry?.id || "").trim(),
    dbfId: Number(entry?.dbfId) || null,
    name: String(entry?.name || "").trim(),
    tavernTier: Number(entry?.tavern_tier ?? entry?.techLevel) || 0,
    impact: Number.isFinite(Number(entry?.impact)) && entry?.impact !== null ? Number(entry.impact) : null,
    combatWinrate: String(entry?.combat_winrate || "").trim(),
    popularity: String(entry?.popularity || "").trim(),
    games: Number(entry?.games_with_minion) || null
  };
}

async function buildPayload() {
  const raw = await fetchJsonWithTimeout(SOURCE_URL);
  const structured = raw?.data?.structured;
  if (structured?.type !== "bg_minions" || !Array.isArray(structured.minions)) {
    throw new Error("Неожиданный формат данных hsreplay_battlegrounds_minions.");
  }

  const minions = structured.minions
    .map(normalizeMinion)
    .filter((minion) => minion.id && minion.dbfId);

  return {
    source: "HSReplay через api.hs-manacost.ru",
    fetchedAt: raw?.fetched_at || new Date().toISOString(),
    count: minions.length,
    minions
  };
}

async function getStats() {
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
  const limit = rateLimit(req, "bg-minion-stats", 30, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  try {
    const payload = await getStats();
    sendJson(res, 200, payload, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить статистику существ Полей сражений.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
