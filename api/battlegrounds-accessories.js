const { rateLimit } = require("./_blizzard");

// HearthstoneJSON publishes the entire card pool as a static JSON file per
// locale. It's the friendliest source for Battlegrounds trinkets:
//   * No auth, no CORS, no rate-limit on their CDN.
//   * The shape is stable and well-known (HearthstoneJSON has been running
//     for years and is what Firestone / HSReplay use under the hood).
//   * Card IDs map 1:1 to the art served by /api/card-art (which is also a
//     HearthstoneJSON proxy), so images come from the same place we already
//     trust.

const HSJSON_URL = (locale) =>
  `https://api.hearthstonejson.com/v1/latest/${encodeURIComponent(locale)}/cards.collectible.json`;
// HearthstoneJSON ships separate "all cards" feeds when collectible doesn't
// include trinkets — fall back to those.
const HSJSON_FALLBACK_URLS = (locale) => [
  `https://api.hearthstonejson.com/v1/latest/${encodeURIComponent(locale)}/cards.json`
];

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = { payload: null, expiresAt: 0, locale: null };
let inFlight = null;

function isTrinket(card) {
  if (!card) return false;
  const type = String(card.type || "").toUpperCase();
  if (type === "BATTLEGROUND_TRINKET") return true;
  if (type === "BG_TRINKET") return true;
  const mechanics = card.mechanics || [];
  if (mechanics.some((m) => String(m).toUpperCase().includes("BATTLEGROUND_TRINKET"))) return true;
  const setStr = String(card.set || "").toUpperCase();
  if (setStr.includes("TRINKET")) return true;
  // Battlegrounds anomaly cards share some traits but aren't trinkets — guard
  // by requiring an explicit trinket signal from the type/mechanics above.
  return false;
}

function detectSize(card) {
  const mechanics = (card.mechanics || []).map((m) => String(m).toUpperCase());
  if (mechanics.includes("BATTLEGROUND_TRINKET_LARGE")) return "LARGE";
  if (mechanics.includes("BATTLEGROUND_TRINKET_SMALL")) return "SMALL";
  if (mechanics.includes("BG_TRINKET_LARGE")) return "LARGE";
  if (mechanics.includes("BG_TRINKET_SMALL")) return "SMALL";
  // Hearthstone trinkets cost 1 anima for "lesser" and 2 anima for "greater".
  // This is the most reliable structural signal in the JSON.
  if (typeof card.cost === "number") {
    if (card.cost === 1) return "SMALL";
    if (card.cost >= 2) return "LARGE";
  }
  if (typeof card.manaCost === "number") {
    if (card.manaCost === 1) return "SMALL";
    if (card.manaCost >= 2) return "LARGE";
  }
  // Names occasionally hint
  const nameLower = String(card.name || "").toLowerCase();
  if (nameLower.includes("lesser") || nameLower.includes("малый")) return "SMALL";
  if (nameLower.includes("greater") || nameLower.includes("большой")) return "LARGE";
  return "SMALL";
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\$\d+/g, "")
    .replace(/\[x]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTrinket(card, locale) {
  const id = card.id || card.dbfId;
  return {
    id: `bg-${id}`,
    cardId: id,
    name: card.name || "",
    text: stripHtml(card.text || ""),
    size: detectSize(card),
    image: `/api/card-art?id=${encodeURIComponent(id)}&locale=${encodeURIComponent(locale)}&size=512x`,
    cost: card.cost ?? card.manaCost ?? null,
    rarity: card.rarity || null,
    set: card.set || null,
    raw: undefined
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BattlegroundsHub/1.0; +https://github.com/Zulut30/heroes-bg)",
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function loadAccessories(locale) {
  const now = Date.now();
  if (cache.payload && cache.locale === locale && cache.expiresAt > now) {
    return cache.payload;
  }
  if (inFlight && inFlight.locale === locale) {
    return inFlight.promise;
  }
  const promise = (async () => {
    let cards = null;
    let lastError = null;
    const urls = [HSJSON_URL(locale), ...HSJSON_FALLBACK_URLS(locale)];
    for (const url of urls) {
      try {
        const data = await fetchJson(url);
        if (Array.isArray(data) && data.length) {
          cards = data;
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!cards) {
      throw lastError || new Error("HearthstoneJSON empty");
    }
    const trinkets = cards.filter(isTrinket).map((card) => normalizeTrinket(card, locale));
    trinkets.sort((a, b) => {
      if (a.size !== b.size) return a.size === "SMALL" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), locale.replace("_", "-"));
    });
    const payload = {
      source: "HearthstoneJSON",
      locale,
      total: trinkets.length,
      small: trinkets.filter((t) => t.size === "SMALL"),
      large: trinkets.filter((t) => t.size === "LARGE"),
      accessories: trinkets,
      fetchedAt: new Date().toISOString()
    };
    cache.payload = payload;
    cache.expiresAt = now + CACHE_TTL_MS;
    cache.locale = locale;
    return payload;
  })();
  inFlight = { locale, promise };
  promise.finally(() => { if (inFlight && inFlight.promise === promise) inFlight = null; });
  return promise;
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "accessories", 60, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  const localeParam = String(req.query.locale || "ruRU");
  const locale = localeParam.includes("_") ? localeParam.replace("_", "") : localeParam;

  try {
    const payload = await loadAccessories(locale);
    if (req.query?.debug === "1") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({
        debug: true,
        locale,
        total: payload.total,
        small: payload.small.length,
        large: payload.large.length,
        sample: payload.accessories.slice(0, 3)
      }, null, 2));
      return;
    }
    const ifNoneMatch = req.headers["if-none-match"];
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("Vary", "Accept-Encoding");
    const body = JSON.stringify(payload);
    const etag = `W/"hsjson-${payload.total}-${payload.locale}"`;
    res.setHeader("ETag", etag);
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }
    res.end(body);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      error: "Не удалось загрузить аксессуары из HearthstoneJSON.",
      details: error.message
    }));
  }
};
