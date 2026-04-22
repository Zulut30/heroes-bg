const { fetchBlizzardJson, normalizeLocale, rateLimit } = require("./_blizzard");

// Source 1 — Blizzard official Hearthstone API. Always reflects the latest
// patch but requires our OAuth credentials to be configured (handled by the
// shared _blizzard helper).
//
// Source 2 — HearthstoneJSON. No auth, ships ~weekly snapshots, used as a
// fallback when Blizzard credentials are missing or rate-limited.
//
// We try Blizzard first, then HearthstoneJSON, then merge by stable id so
// the page never undercounts when one source lags behind.

const HSJSON_ALL_URL = (locale) =>
  `https://api.hearthstonejson.com/v1/latest/${encodeURIComponent(locale)}/cards.json`;
const HSJSON_FALLBACK_URLS = (locale) => [
  `https://api.hearthstonejson.com/v1/latest/${encodeURIComponent(locale)}/cards.collectible.json`
];

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = { payload: null, expiresAt: 0, locale: null };
let inFlight = null;

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
  const mechanics = (card.mechanics || []).map((m) => String(m && (m.name || m)).toUpperCase());
  if (mechanics.some((m) => m.includes("BATTLEGROUND_TRINKET_LARGE"))) return "LARGE";
  if (mechanics.some((m) => m.includes("BATTLEGROUND_TRINKET_SMALL"))) return "SMALL";
  if (mechanics.some((m) => m.includes("BG_TRINKET_LARGE"))) return "LARGE";
  if (mechanics.some((m) => m.includes("BG_TRINKET_SMALL"))) return "SMALL";

  const refs = (card.referencedTags || []).map((m) => String(m).toUpperCase());
  if (refs.some((m) => m.includes("LARGE"))) return "LARGE";
  if (refs.some((m) => m.includes("SMALL"))) return "SMALL";

  // Hearthstone trinkets cost 1 anima for "lesser" and 2 for "greater".
  const cost = typeof card.cost === "number" ? card.cost : (typeof card.manaCost === "number" ? card.manaCost : null);
  if (cost === 1) return "SMALL";
  if (cost && cost >= 2) return "LARGE";

  // Last-ditch name heuristic
  const nameLower = String(card.name || "").toLowerCase();
  if (nameLower.includes("greater") || nameLower.includes("большой")) return "LARGE";
  if (nameLower.includes("lesser") || nameLower.includes("малый")) return "SMALL";
  return "SMALL";
}

// ---------- HearthstoneJSON parsing ----------

function isTrinketHsjson(card) {
  if (!card) return false;
  const type = String(card.type || "").toUpperCase();
  if (type === "BATTLEGROUND_TRINKET") return true;
  if (type === "BG_TRINKET") return true;
  if (type.endsWith("_TRINKET")) return true;
  const mechanics = (card.mechanics || []).map((m) => String(m).toUpperCase());
  if (mechanics.some((m) => m.includes("TRINKET"))) return true;
  const setStr = String(card.set || "").toUpperCase();
  if (setStr.includes("TRINKET")) return true;
  const refs = (card.referencedTags || []).map((m) => String(m).toUpperCase());
  if (refs.some((m) => m.includes("TRINKET"))) return true;
  return false;
}

function normalizeHsjsonCard(card, locale) {
  const id = String(card.id || card.dbfId || "");
  return {
    id: `hs-${id}`,
    cardId: id,
    dedupeKey: `${id}|${(card.name || "").toLowerCase()}`,
    source: "HearthstoneJSON",
    name: card.name || "",
    text: stripHtml(card.text || ""),
    size: detectSize(card),
    image: buildArtProxyUrl(id, locale),
    cost: card.cost ?? card.manaCost ?? null,
    rarity: card.rarity || null,
    set: card.set || null
  };
}

// ---------- Blizzard parsing ----------

function isTrinketBlizzard(card) {
  if (!card) return false;
  if (card.battlegrounds && card.battlegrounds.trinket) return true;
  const slug = String(card.cardType?.slug || card.type?.slug || card.typeSlug || "").toLowerCase();
  if (slug.includes("trinket")) return true;
  // cardTypeId observed for trinkets has been 43 / 44 / 47 depending on
  // schema revisions — accept anything tagged as such even if the upstream
  // changes the number.
  if ([43, 44, 45, 47].includes(Number(card.cardTypeId))) return true;
  // Mechanics tag — Blizzard sometimes also returns the same mechanic codes.
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
    size: detectSize({
      ...card,
      mechanics: (card.mechanics || []).map((m) => (m && (m.slug || m.name || m)) || m)
    }),
    image: upstreamImage ? buildRemoteImageProxyUrl(upstreamImage) : buildArtProxyUrl(id, locale),
    cost: card.manaCost ?? card.cost ?? null,
    rarity: card.rarity || null,
    set: card.cardSet?.slug || card.set?.slug || card.cardSetId || null
  };
}

// ---------- Loaders ----------

async function fetchHsjson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BattlegroundsHub/1.0; +https://github.com/Zulut30/heroes-bg)",
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

// Source 3 — Blizzard's consumer-facing Hearthstone DB page. The page
// at /<locale>/battlegrounds?bgCardType=trinket is server-rendered with
// the full card list inlined in the JSON state so we can scrape it
// without a browser. We never spoof an interactive client; the user-agent
// is honest about who we are.
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
  // Generic application/json scripts > 1KB
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
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BattlegroundsHub/1.0",
        Accept: "text/html,application/json;q=0.9",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"
      }
    });
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

async function loadFromHsjson(locale) {
  const errors = [];
  const urls = [HSJSON_ALL_URL(locale), ...HSJSON_FALLBACK_URLS(locale)];
  for (const url of urls) {
    try {
      const data = await fetchHsjson(url);
      if (!Array.isArray(data) || !data.length) continue;
      const trinkets = data.filter(isTrinketHsjson).map((c) => normalizeHsjsonCard(c, locale));
      return { trinkets, source: url, totalScanned: data.length, errors };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  return { trinkets: [], source: null, totalScanned: 0, errors };
}

async function fetchBlizzardPaged(blizzardLocale, params, limit = 6) {
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
  // Two narrow queries — the previous fan-out across 14+ filters * many
  // pages was hammering Blizzard for >100 sequential HTTP calls and
  // exhausting Vercel's 10-second function budget (the result was a 502
  // and the page silently fell back to the local accessories file).
  // gameMode covers both BG and Duos pools; the trinket filter then runs
  // in our process.
  const collected = new Map();
  for (const gameMode of ["battlegrounds", "battlegrounds_duos"]) {
    try {
      const pageCards = await fetchBlizzardPaged(blizzardLocale, { gameMode });
      for (const card of pageCards) {
        const key = String(card.id ?? card.cardId ?? card.dbfId ?? card.slug ?? "");
        if (!key) continue;
        if (!collected.has(key)) collected.set(key, card);
      }
    } catch (error) {
      errors.push(`${gameMode}: ${error.message}`);
    }
  }
  if (!collected.size) {
    return { trinkets: [], totalScanned: 0, errors };
  }
  const all = [...collected.values()];
  const trinkets = all.filter(isTrinketBlizzard).map((c) => normalizeBlizzardCard(c, locale));
  return { trinkets, totalScanned: all.length, errors };
}

function mergeTrinkets(...lists) {
  const seen = new Map();
  const out = [];
  for (const list of lists) {
    for (const trinket of list) {
      const key = trinket.dedupeKey || `${trinket.cardId || trinket.id}|${trinket.name.toLowerCase()}`;
      if (seen.has(key)) {
        // Prefer the first source (Blizzard) but copy useful image fallbacks
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

async function loadAccessories(locale, force = false) {
  const now = Date.now();
  if (!force && cache.payload && cache.locale === locale && cache.expiresAt > now) {
    return cache.payload;
  }
  if (inFlight && inFlight.locale === locale) {
    return inFlight.promise;
  }
  const promise = (async () => {
    // Hard per-source timeout so one slow upstream can't drag the whole
    // serverless function over Vercel's request budget.
    const withTimeout = (label, work, ms) => Promise.race([
      work,
      new Promise((resolve) => setTimeout(() => resolve({
        trinkets: [],
        totalScanned: 0,
        errors: [`${label}: timeout after ${ms}ms`],
        source: null
      }), ms))
    ]);
    const [blizzard, hsjson, hsdb] = await Promise.all([
      withTimeout("Blizzard", loadFromBlizzard(locale).catch((error) => ({ trinkets: [], totalScanned: 0, errors: [`Blizzard: ${error.message}`] })), 7000),
      withTimeout("HSJSON", loadFromHsjson(locale).catch((error) => ({ trinkets: [], source: null, totalScanned: 0, errors: [`HSJSON: ${error.message}`] })), 6000),
      withTimeout("HSDB", loadFromHearthstoneDB(locale).catch((error) => ({ trinkets: [], source: null, totalScanned: 0, errors: [`HSDB: ${error.message}`] })), 5000)
    ]);
    // HSDB first because it's the canonical "what Blizzard's site shows"
    // — when it works it has the largest set. Blizzard API and HSJSON
    // backfill anything HSDB misses.
    const merged = mergeTrinkets(hsdb.trinkets, blizzard.trinkets, hsjson.trinkets);
    merged.sort((a, b) => {
      if (a.size !== b.size) return a.size === "SMALL" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), locale.replace("_", "-"));
    });
    const payload = {
      source: [
        hsdb.trinkets.length && "HearthstoneDB",
        blizzard.trinkets.length && "Blizzard",
        hsjson.trinkets.length && "HearthstoneJSON"
      ].filter(Boolean).join(" + ") || "none",
      locale,
      total: merged.length,
      small: merged.filter((t) => t.size === "SMALL"),
      large: merged.filter((t) => t.size === "LARGE"),
      accessories: merged,
      fetchedAt: new Date().toISOString(),
      sources: {
        hsdb: { count: hsdb.trinkets.length, scanned: hsdb.totalScanned, source: hsdb.source, errors: hsdb.errors || [] },
        blizzard: { count: blizzard.trinkets.length, scanned: blizzard.totalScanned, errors: blizzard.errors || [] },
        hsjson: { count: hsjson.trinkets.length, scanned: hsjson.totalScanned, source: hsjson.source, errors: hsjson.errors || [] }
      }
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
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("Vary", "Accept-Encoding");
    const body = JSON.stringify(payload);
    const etag = `W/"acc-${payload.total}-${locale}"`;
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
      error: "Не удалось загрузить аксессуары.",
      details: error.message
    }));
  }
};
