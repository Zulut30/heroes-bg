const { fetchBlizzardJson, rateLimit } = require("./_blizzard");

// Two upstream sources, both with hard per-call timeouts so this serverless
// handler always answers before Vercel's 10-second function budget kicks in.
//
// 1. Blizzard developer API — auth via the shared _blizzard helper. Single
//    narrow query for the battlegrounds pool, paged a few times. Returns
//    the canonical current-rotation trinkets.
// 2. hearthstone.blizzard.com (consumer site) — server-renders the same
//    trinket list inline; we scrape the embedded JSON.
//
// HearthstoneJSON's cards.json is ~5MB and reliably blew past the function
// budget when downloaded + parsed on a cold serverless instance — dropped.

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = { payload: null, expiresAt: 0, locale: null };
let inFlight = null;

const FETCH_TIMEOUT_MS = 4500;
const SOURCE_TIMEOUT_MS = 7000;
const PAGE_LIMIT = 4;

function buildRemoteImageProxyUrl(imageUrl) {
  const normalized = String(imageUrl || "").trim();
  return normalized ? `/api/remote-image?src=${encodeURIComponent(normalized)}` : "";
}

function buildArtProxyUrl(id, locale) {
  if (!id) return "";
  return `/api/card-art?id=${encodeURIComponent(id)}&locale=${encodeURIComponent(locale)}&size=512x`;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\$\d+/g, "")
    .replace(/\[x]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSize(card) {
  const mechanics = (card.mechanics || []).map((m) => String(m && (m.name || m.slug || m)).toUpperCase());
  if (mechanics.some((m) => m.includes("BATTLEGROUND_TRINKET_LARGE"))) return "LARGE";
  if (mechanics.some((m) => m.includes("BATTLEGROUND_TRINKET_SMALL"))) return "SMALL";
  if (mechanics.some((m) => m.includes("BG_TRINKET_LARGE"))) return "LARGE";
  if (mechanics.some((m) => m.includes("BG_TRINKET_SMALL"))) return "SMALL";

  const refs = (card.referencedTags || []).map((m) => String(m).toUpperCase());
  if (refs.some((m) => m.includes("LARGE"))) return "LARGE";
  if (refs.some((m) => m.includes("SMALL"))) return "SMALL";

  const cost = typeof card.cost === "number" ? card.cost : (typeof card.manaCost === "number" ? card.manaCost : null);
  if (cost === 1) return "SMALL";
  if (cost && cost >= 2) return "LARGE";

  const nameLower = String(card.name || "").toLowerCase();
  if (nameLower.includes("greater") || nameLower.includes("большой")) return "LARGE";
  if (nameLower.includes("lesser") || nameLower.includes("малый")) return "SMALL";
  return "SMALL";
}

function isTrinketBlizzard(card) {
  if (!card) return false;
  if (card.battlegrounds && card.battlegrounds.trinket) return true;
  const slug = String(card.cardType?.slug || card.type?.slug || card.typeSlug || "").toLowerCase();
  if (slug.includes("trinket")) return true;
  if ([43, 44, 45, 47].includes(Number(card.cardTypeId))) return true;
  const mechanics = (card.mechanics || []).map((m) => String(m && (m.slug || m.name || m)).toUpperCase());
  if (mechanics.some((m) => m.includes("TRINKET"))) return true;
  return false;
}

function normalizeBlizzardCard(card, locale) {
  const id = String(card.id ?? card.cardId ?? card.dbfId ?? "");
  const upstreamImage = card.image || card.battlegrounds?.image || card.cropImage || "";
  return {
    id: `bz-${id}`,
    cardId: id,
    dedupeKey: `${id}|${(card.name || "").toLowerCase()}`,
    source: "Blizzard",
    name: card.name || "",
    text: stripHtml(card.text || ""),
    size: detectSize(card),
    image: upstreamImage ? buildRemoteImageProxyUrl(upstreamImage) : buildArtProxyUrl(id, locale),
    cost: card.manaCost ?? card.cost ?? null,
    rarity: card.rarity || null,
    set: card.cardSet?.slug || card.set?.slug || card.cardSetId || null
  };
}

async function fetchWithTimeout(url, init, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ----- Blizzard -----

async function fetchBlizzardPaged(blizzardLocale, params, limit = PAGE_LIMIT) {
  const cards = [];
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount && page <= limit) {
    const response = await fetchBlizzardJson("/cards", {
      locale: blizzardLocale,
      pageSize: 500,
      page,
      ...params
    });
    cards.push(...(response.cards || []));
    pageCount = Number(response.pageCount) || 1;
    page += 1;
  }
  return cards;
}

async function loadFromBlizzard(locale) {
  const blizzardLocale = locale.includes("_") ? locale : (locale.match(/^([a-z]{2})([A-Z]{2})$/) ? `${locale.slice(0,2)}_${locale.slice(2)}` : locale);
  const errors = [];
  const collected = new Map();
  try {
    const pageCards = await fetchBlizzardPaged(blizzardLocale, { gameMode: "battlegrounds" });
    for (const card of pageCards) {
      const key = String(card.id ?? card.cardId ?? card.dbfId ?? card.slug ?? "");
      if (!key) continue;
      if (!collected.has(key)) collected.set(key, card);
    }
  } catch (error) {
    errors.push(`battlegrounds: ${error.message}`);
  }
  const all = [...collected.values()];
  const trinkets = all.filter(isTrinketBlizzard).map((c) => normalizeBlizzardCard(c, locale));
  return { trinkets, totalScanned: all.length, errors };
}

// ----- hearthstone.blizzard.com -----

const HS_DB_PAGE = (locale) => {
  const slug = locale.toLowerCase().replace(/(\w{2})(\w{2})/, "$1-$2");
  return `https://hearthstone.blizzard.com/${slug}/battlegrounds?bgCardType=trinket`;
};

function extractEmbeddedJson(html) {
  const blobs = [];
  const next = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (next) {
    try { blobs.push(JSON.parse(next[1])); } catch {}
  }
  const initial = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (initial) {
    try { blobs.push(JSON.parse(initial[1])); } catch {}
  }
  const re = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].length < 1000) continue;
    try { blobs.push(JSON.parse(m[1])); } catch {}
  }
  return blobs;
}

function deepFindCardArray(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 8) return null;
  if (Array.isArray(obj)) {
    if (obj.length && typeof obj[0] === "object" && obj[0]
        && (obj[0].name || obj[0].title)
        && (obj[0].id !== undefined || obj[0].cardId !== undefined || obj[0].slug)) {
      return obj;
    }
    for (const item of obj) {
      const found = deepFindCardArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of Object.keys(obj)) {
    const found = deepFindCardArray(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

async function loadFromHearthstoneDB(locale) {
  const errors = [];
  const url = HS_DB_PAGE(locale);
  let html = "";
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BattlegroundsHub/1.0",
        Accept: "text/html,application/json;q=0.9",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"
      }
    }, FETCH_TIMEOUT_MS);
    if (!response.ok) {
      errors.push(`${url}: HTTP ${response.status}`);
      return { trinkets: [], totalScanned: 0, errors, source: url };
    }
    html = await response.text();
  } catch (error) {
    errors.push(`${url}: ${error.message}`);
    return { trinkets: [], totalScanned: 0, errors, source: url };
  }
  const blobs = extractEmbeddedJson(html);
  for (const blob of blobs) {
    const arr = deepFindCardArray(blob);
    if (arr && arr.length) {
      const trinkets = arr.map((card) => {
        const id = String(card.id ?? card.cardId ?? card.slug ?? "");
        const upstreamImage = card.image || card.imageUrl || card.crop_image || "";
        return {
          id: `db-${id}`,
          cardId: id,
          dedupeKey: `${id}|${(card.name || "").toLowerCase()}`,
          source: "HearthstoneDB",
          name: card.name || card.title || "",
          text: stripHtml(card.text || card.flavorText || ""),
          size: detectSize({
            ...card,
            mechanics: (card.mechanics || []).map((m) => (m && (m.slug || m.name || m)) || m)
          }),
          image: upstreamImage ? buildRemoteImageProxyUrl(upstreamImage) : buildArtProxyUrl(id, locale),
          cost: card.manaCost ?? card.cost ?? null,
          rarity: card.rarity || null,
          set: card.cardSet?.slug || card.set?.slug || null
        };
      }).filter((t) => t.name);
      return { trinkets, totalScanned: arr.length, errors, source: url };
    }
  }
  errors.push(`${url}: HTML received (${html.length} bytes) but no trinket array found`);
  return { trinkets: [], totalScanned: 0, errors, source: url };
}

function mergeTrinkets(...lists) {
  const seen = new Map();
  const out = [];
  for (const list of lists) {
    for (const trinket of list) {
      const key = trinket.dedupeKey || `${trinket.cardId || trinket.id}|${trinket.name.toLowerCase()}`;
      if (seen.has(key)) {
        const existing = seen.get(key);
        if (!existing.image && trinket.image) existing.image = trinket.image;
        continue;
      }
      seen.set(key, trinket);
      out.push(trinket);
    }
  }
  return out;
}

function withTimeout(label, work, ms) {
  return Promise.race([
    work,
    new Promise((resolve) => setTimeout(() => resolve({
      trinkets: [],
      totalScanned: 0,
      errors: [`${label}: timeout after ${ms}ms`],
      source: null
    }), ms))
  ]);
}

async function loadAccessories(locale, force = false) {
  const now = Date.now();
  if (!force && cache.payload && cache.locale === locale && cache.expiresAt > now) {
    return cache.payload;
  }
  if (inFlight && inFlight.locale === locale) {
    return inFlight.promise;
  }
  const promise = (async () => {
    const [hsdb, blizzard] = await Promise.all([
      withTimeout("HSDB", loadFromHearthstoneDB(locale).catch((error) => ({ trinkets: [], source: null, totalScanned: 0, errors: [`HSDB: ${error.message}`] })), SOURCE_TIMEOUT_MS),
      withTimeout("Blizzard", loadFromBlizzard(locale).catch((error) => ({ trinkets: [], totalScanned: 0, errors: [`Blizzard: ${error.message}`] })), SOURCE_TIMEOUT_MS)
    ]);
    const merged = mergeTrinkets(hsdb.trinkets, blizzard.trinkets);
    merged.sort((a, b) => {
      if (a.size !== b.size) return a.size === "SMALL" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), locale.replace("_", "-"));
    });
    const sourceLabel = [
      hsdb.trinkets.length && "HearthstoneDB",
      blizzard.trinkets.length && "Blizzard"
    ].filter(Boolean).join(" + ") || "none";
    return {
      source: sourceLabel,
      locale,
      total: merged.length,
      small: merged.filter((t) => t.size === "SMALL"),
      large: merged.filter((t) => t.size === "LARGE"),
      accessories: merged,
      fetchedAt: new Date().toISOString(),
      sources: {
        hsdb: { count: hsdb.trinkets.length, scanned: hsdb.totalScanned, source: hsdb.source, errors: hsdb.errors || [] },
        blizzard: { count: blizzard.trinkets.length, scanned: blizzard.totalScanned, errors: blizzard.errors || [] }
      }
    };
  })()
  .then((payload) => {
    cache.payload = payload;
    cache.expiresAt = Date.now() + CACHE_TTL_MS;
    cache.locale = locale;
    return payload;
  })
  .catch((error) => {
    // Always resolve with an empty payload so the upstream handler never
    // returns 502; the frontend sees an empty list and falls back gracefully.
    return {
      source: "error",
      locale,
      total: 0,
      small: [],
      large: [],
      accessories: [],
      fetchedAt: new Date().toISOString(),
      sources: {
        hsdb: { count: 0, scanned: 0, source: null, errors: [error.message] },
        blizzard: { count: 0, scanned: 0, errors: [error.message] }
      }
    };
  });
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
    const force = req.query?.force === "1" || req.query?.debug === "1";
    const payload = await loadAccessories(locale, force);
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
        sources: payload.sources,
        sample: payload.accessories.slice(0, 3)
      }, null, 2));
      return;
    }
    const ifNoneMatch = req.headers["if-none-match"];
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", payload.total ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store");
    res.setHeader("Vary", "Accept-Encoding");
    const body = JSON.stringify(payload);
    const etag = `W/"acc-${payload.total}-${locale}"`;
    res.setHeader("ETag", etag);
    if (ifNoneMatch && ifNoneMatch === etag && payload.total) {
      res.statusCode = 304;
      res.end();
      return;
    }
    res.end(body);
  } catch (error) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
      source: "handler-error",
      locale,
      total: 0,
      small: [],
      large: [],
      accessories: [],
      sources: { handler: { errors: [error.message] } }
    }));
  }
};
