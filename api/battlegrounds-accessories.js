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

async function loadFromBlizzard(locale) {
  // _blizzard helper expects ru_RU style locale
  const blizzardLocale = locale.includes("_") ? locale : (locale.match(/^([a-z]{2})([A-Z]{2})$/) ? `${locale.slice(0,2)}_${locale.slice(2)}` : locale);
  const errors = [];
  const cards = [];
  try {
    let page = 1;
    let pageCount = 1;
    while (page <= pageCount && page <= 8) {
      const response = await fetchBlizzardJson("/cards", {
        locale: blizzardLocale,
        gameMode: "battlegrounds",
        pageSize: 500,
        page
      });
      const pageCards = response.cards || [];
      cards.push(...pageCards);
      pageCount = Number(response.pageCount) || 1;
      page += 1;
    }
  } catch (error) {
    errors.push(`Blizzard: ${error.message}`);
    return { trinkets: [], totalScanned: 0, errors };
  }
  const trinkets = cards.filter(isTrinketBlizzard).map((c) => normalizeBlizzardCard(c, locale));
  return { trinkets, totalScanned: cards.length, errors };
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
    const [blizzard, hsjson] = await Promise.all([
      loadFromBlizzard(locale).catch((error) => ({ trinkets: [], totalScanned: 0, errors: [`Blizzard: ${error.message}`] })),
      loadFromHsjson(locale).catch((error) => ({ trinkets: [], source: null, totalScanned: 0, errors: [`HSJSON: ${error.message}`] }))
    ]);
    const merged = mergeTrinkets(blizzard.trinkets, hsjson.trinkets);
    merged.sort((a, b) => {
      if (a.size !== b.size) return a.size === "SMALL" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), locale.replace("_", "-"));
    });
    const payload = {
      source: blizzard.trinkets.length ? "Blizzard + HearthstoneJSON" : "HearthstoneJSON",
      locale,
      total: merged.length,
      small: merged.filter((t) => t.size === "SMALL"),
      large: merged.filter((t) => t.size === "LARGE"),
      accessories: merged,
      fetchedAt: new Date().toISOString(),
      sources: {
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
