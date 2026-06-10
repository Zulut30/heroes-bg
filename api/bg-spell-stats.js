const { sendJson, rateLimit } = require("./_blizzard");

const SOURCE_URL = "https://api.hs-manacost.ru/datasets/firestone_battlegrounds_spells";
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

function normalizeSpell(entry, tier) {
  return {
    id: String(entry?.card_id || entry?.id || "").trim(),
    dbfId: Number(entry?.dbfId) || null,
    name: String(entry?.name || "").trim(),
    tavernTier: Number(entry?.tavern_tier) || Number(tier) || 0,
    avgPlacement: Number.isFinite(Number(entry?.average_placement)) ? Number(entry.average_placement) : null,
    avgPlacementOther: Number.isFinite(Number(entry?.average_placement_other)) ? Number(entry.average_placement_other) : null,
    impact: Number.isFinite(Number(entry?.impact)) ? Number(entry.impact) : null,
    totalPlayed: Number(entry?.total_played) || null
  };
}

async function buildPayload() {
  const raw = await fetchJsonWithTimeout(SOURCE_URL);
  const structured = raw?.data?.structured;
  const tiers = structured?.tiers;
  if (structured?.type !== "bg_card_stats" || !tiers || typeof tiers !== "object") {
    throw new Error("Неожиданный формат данных firestone_battlegrounds_spells.");
  }

  const spells = Object.entries(tiers)
    .flatMap(([tier, rows]) => (Array.isArray(rows) ? rows.map((row) => normalizeSpell(row, tier)) : []))
    .filter((spell) => spell.id && spell.dbfId);

  return {
    source: "Firestone через api.hs-manacost.ru",
    fetchedAt: raw?.fetched_at || new Date().toISOString(),
    count: spells.length,
    spells
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
  const limit = rateLimit(req, "bg-spell-stats", 30, 60_000);
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
      error: "Не удалось загрузить статистику заклинаний таверны.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
