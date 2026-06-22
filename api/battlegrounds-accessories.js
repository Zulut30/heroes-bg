const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { fetchBlizzardJson, rateLimit } = require("./_blizzard");

// Audit summary of why we kept landing on 70 accessories:
//   1. Blizzard's developer /cards?gameMode=battlegrounds endpoint really
//      does cap at the current rotation's pool (~70 trinkets for the live
//      patch). Their developer API is meant for current playable cards.
//   2. HearthstoneJSON's "latest" snapshot lags multiple patches; their
//      cards.json is also 5MB+ and burns through the serverless function
//      budget on a cold start.
//   3. The hearthstone.blizzard.com /battlegrounds page does show ~220
//      trinkets but it's a Next.js SPA that hydrates from an internal JSON
//      endpoint that is gated by Cloudflare's bot challenge — direct
//      server-side fetch without a real browser session usually returns the
//      shell HTML with no card data inlined.
//
// Strategy:
//   * Probe several Blizzard internal endpoints (the ones the consumer page
//     uses for SSR and for client-side hydration) and merge what they
//     return. None of them require auth.
//   * Fall back to the official Blizzard developer API for the current
//     rotation pool.
//   * Always return a 200 with whatever we got, plus a detailed sources.*
//     report so the front-end / debug query shows exactly which source
//     contributed and which failed.

const FETCH_TIMEOUT_MS = 4000;
const SOURCE_TIMEOUT_MS = 7000;
const PAGE_LIMIT = 4;
const CACHE_TTL_MS = 60 * 60 * 1000;
const HSMANACOST_TRINKETS_URL = "https://api.hs-manacost.ru/api/bg/trinkets?active_only=true";
const MAX_PLAUSIBLE_ACCESSORY_COUNT = 260;
const cache = { payload: null, expiresAt: 0, locale: null };
let inFlight = null;

function toBcp47(locale) {
  // Accept "ruRU", "ru_RU", "ru-RU" and always return BCP 47 ("ru-RU").
  // Intl APIs (localeCompare, Intl.Collator) reject anything else with
  // "RangeError: Incorrect locale information provided".
  if (!locale) return "ru-RU";
  const compact = String(locale).trim();
  if (compact.includes("_")) return compact.replace("_", "-");
  if (compact.includes("-")) return compact;
  return compact.replace(/^([a-zA-Z]{2})([a-zA-Z]{2})$/, "$1-$2");
}

function safeLocaleCompare(a, b, locale) {
  try {
    return String(a).localeCompare(String(b), toBcp47(locale));
  } catch (error) {
    return String(a).localeCompare(String(b));
  }
}

function buildRemoteImageProxyUrl(imageUrl) {
  const normalized = String(imageUrl || "").trim();
  return normalized ? `/api/remote-image?src=${encodeURIComponent(normalized)}` : "";
}

function buildArtProxyUrl(id, locale) {
  if (!id) return "";
  return `/api/card-art?id=${encodeURIComponent(id)}&locale=${encodeURIComponent(locale)}&size=512x`;
}

function stripHtml(value) {
  return stringifyField(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\$\d+/g, "")
    .replace(/\[x]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringifyField(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringifyField).find(Boolean) || "";
  }
  if (typeof value === "object") {
    const preferred = value.ru_RU || value.ruRU || value.en_US || value.enUS || value.name || value.text || value.title;
    if (preferred) return stringifyField(preferred);
    return Object.values(value).map(stringifyField).find(Boolean) || "";
  }
  return "";
}

function detectSize(card) {
  const school = String(card.spellSchool?.slug || card.spellSchool?.name || card.spellSchool || card.spellSchoolId || "").toUpperCase();
  if (school.includes("GREATER") || school === "12") return "LARGE";
  if (school.includes("LESSER") || school === "11") return "SMALL";

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

function isTrinketCard(card) {
  if (!card) return false;
  if (card.battlegrounds && card.battlegrounds.trinket) return true;
  const slug = String(card.cardType?.slug || card.type?.slug || card.typeSlug || card.type || "").toLowerCase();
  if (slug.includes("trinket")) return true;
  if (Number(card.cardTypeId) === 44) return true;
  const mechanics = (card.mechanics || []).map((m) => String(m && (m.slug || m.name || m)).toUpperCase());
  if (mechanics.some((m) => m.includes("TRINKET"))) return true;
  const setSlug = String(card.cardSet?.slug || card.set?.slug || card.set || "").toLowerCase();
  if (setSlug.includes("trinket")) return true;
  return false;
}

function pickImageUrl(card) {
  // Only accept full card-render fields. The cropImage / imageOriginal /
  // splash variants are wide landscape art and look broken in our portrait
  // accessory tiles, so we filter them out and let the placeholder kick in
  // instead of rendering chaos.
  const candidates = [
    card.image,
    card.imageUrl,
    card.image_url,
    card.imageRender,
    card.image_render,
    card.battlegrounds?.image,
    card.battlegrounds?.imageGold,
    card.imageGold,
    card.image_gold,
    card.assets?.image,
    card.assets?.png,
    card.images?.normal,
    card.images?.golden,
    card.media?.image,
    card.media?.png
  ];
  return candidates.find((u) => typeof u === "string" && u.trim()) || "";
}

function normalizeCard(card, locale, sourceTag) {
  const id = String(card.id ?? card.cardId ?? card.dbfId ?? card.slug ?? "");
  const name = stringifyField(card.name || card.title);
  const upstreamImage = pickImageUrl(card);
  const proxiedImage = upstreamImage ? buildRemoteImageProxyUrl(upstreamImage) : "";
  const fallbackImage = buildArtProxyUrl(id, locale);
  return {
    id: `${sourceTag.slice(0,2)}-${id}`,
    cardId: id,
    dedupeKey: `${id}|${name.toLowerCase()}`,
    source: sourceTag,
    name,
    text: stripHtml(card.text || card.flavorText || ""),
    size: detectSize(card),
    image: proxiedImage || fallbackImage,
    imageFallback: proxiedImage ? fallbackImage : "",
    upstreamImage,
    cost: card.manaCost ?? card.cost ?? null,
    rarity: card.rarity || null,
    set: card.cardSet?.slug || card.set?.slug || card.cardSetId || null
  };
}

function normalizeHsManacostTrinket(row, locale) {
  const cardId = String(row.trinket_id || row.id || "");
  const size = String(row.trinket_tier || row.type || "").toLowerCase() === "greater" ? "LARGE" : "SMALL";
  const baseName = String(row.localized_name || row.name || "").trim();
  const tribeLabel = String(row.tribe_ru || row.tribe || row.race || "").trim();
  const displayName = tribeLabel ? `${baseName} · ${tribeLabel}` : baseName;
  const variantKey = String(row.variant_key || `${size}|${cardId}|${row.tribe || ""}|${row.tier || ""}`);
  const image = buildArtProxyUrl(cardId, locale);
  return {
    id: `HSM-${variantKey}`,
    cardId,
    dedupeKey: `HSM|${variantKey}`,
    source: "HSManacost",
    name: displayName,
    baseName,
    englishName: row.name || "",
    text: stripHtml(row.description || ""),
    size,
    image,
    imageFallback: "",
    upstreamImage: "",
    cost: row.cost ?? null,
    rarity: null,
    set: "hsreplay-current-trinkets",
    tier: row.tier || "",
    race: row.tribe || row.race || "",
    raceRu: row.tribe_ru || "",
    pickRate: row.pick_rate || "",
    avgPlacement: row.avg_placement || "",
    firstPlace: Array.isArray(row.placement_distribution)
      ? (row.placement_distribution.find((p) => Number(p.place) === 1)?.rate || "")
      : "",
    variantKey
  };
}

async function loadFromHsManacost(locale) {
  const errors = [];
  try {
    const response = await fetchWithTimeout(HSMANACOST_TRINKETS_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ManacostBG/1.0 (+https://bg.kolodahearthstone.ru)"
      }
    }, SOURCE_TIMEOUT_MS);
    if (!response.ok) {
      errors.push(`HSManacost: HTTP ${response.status}`);
      return { trinkets: [], totalScanned: 0, errors, source: HSMANACOST_TRINKETS_URL };
    }
    const payload = await response.json();
    const rows = Array.isArray(payload.trinkets) ? payload.trinkets : [];
    return {
      trinkets: rows.map((row) => normalizeHsManacostTrinket(row, locale)),
      totalScanned: rows.length,
      errors,
      source: HSMANACOST_TRINKETS_URL,
      fetchedAt: payload.fetched_at || null
    };
  } catch (error) {
    errors.push(`HSManacost: ${error.message}`);
    return { trinkets: [], totalScanned: 0, errors, source: HSMANACOST_TRINKETS_URL };
  }
}

let cachedLocalAccessories = null;
function loadLocalAccessories() {
  if (cachedLocalAccessories) {
    return cachedLocalAccessories;
  }

  const filePath = path.resolve(__dirname, "..", "accessories-data.js");
  const sandbox = { window: {} };
  const code = fs.readFileSync(filePath, "utf8");
  vm.runInNewContext(code, sandbox, { filename: filePath });
  const payload = sandbox.window.accessoriesData || {};
  const normalizeLocal = (card, size) => ({
    id: card.id,
    cardId: card.id,
    dedupeKey: `${card.id}|${String(card.name || "").toLowerCase()}`,
    source: "Local",
    name: card.name || "",
    text: "",
    size,
    image: card.image || "",
    imageFallback: "",
    upstreamImage: "",
    cost: null,
    rarity: null,
    set: "local-current-accessories"
  });

  cachedLocalAccessories = {
    small: (payload.small || []).map((card) => normalizeLocal(card, "SMALL")),
    large: (payload.large || []).map((card) => normalizeLocal(card, "LARGE"))
  };
  cachedLocalAccessories.accessories = [...cachedLocalAccessories.small, ...cachedLocalAccessories.large];
  return cachedLocalAccessories;
}

function buildLocalPayload(locale, sourceReason, sources = {}) {
  const local = loadLocalAccessories();
  return {
    source: sourceReason || "Local curated accessories",
    locale,
    total: local.accessories.length,
    small: local.small,
    large: local.large,
    accessories: local.accessories,
    fetchedAt: new Date().toISOString(),
    sources: {
      ...sources,
      local: {
        count: local.accessories.length,
        scanned: local.accessories.length,
        source: "accessories-data.js",
        errors: []
      }
    }
  };
}

async function fetchWithTimeout(url, init = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ------------------------- Blizzard developer API -------------------------

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

async function loadFromBlizzardDev(locale) {
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
  const trinkets = all.filter(isTrinketCard).map((c) => normalizeCard(c, locale, "Blizzard"));
  return { trinkets, totalScanned: all.length, errors };
}

// ------------------------- hearthstone.blizzard.com internal endpoints -----

const HSWEB_INTERNAL_ENDPOINTS = (locale) => {
  const slug = locale.toLowerCase().replace(/(\w{2})(\w{2})/, "$1-$2");
  return [
    `https://hearthstone.blizzard.com/${slug}/api/cards?bgCardType=trinket&pageSize=500&page=1`,
    `https://hearthstone.blizzard.com/${slug}/api/cards/battlegrounds?cardType=trinket&pageSize=500`,
    `https://hearthstone.blizzard.com/${slug}/api/v1/cards?bgCardType=trinket&pageSize=500`,
    `https://hearthstone.blizzard.com/${slug}/api/cards/v2/battlegrounds?bgCardType=trinket&pageSize=500`,
    `https://hearthstone.blizzard.com/api/cards?bgCardType=trinket&pageSize=500&locale=${slug.replace("-", "_")}`,
    `https://hearthstone.blizzard.com/api/cards/battlegrounds/trinkets?locale=${slug.replace("-", "_")}`
  ];
};

async function loadFromHsWebInternal(locale) {
  const errors = [];
  const collected = [];
  let usedSource = null;
  for (const url of HSWEB_INTERNAL_ENDPOINTS(locale)) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36",
          Accept: "application/json,text/javascript,*/*;q=0.9",
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
          Referer: `https://hearthstone.blizzard.com/${locale.toLowerCase().replace(/(\w{2})(\w{2})/, "$1-$2")}/battlegrounds?bgCardType=trinket`
        }
      }, FETCH_TIMEOUT_MS);
      if (!response.ok) {
        errors.push(`${url}: HTTP ${response.status}`);
        continue;
      }
      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch (parseError) {
        errors.push(`${url}: not JSON (${text.slice(0, 80)})`);
        continue;
      }
      const arr = Array.isArray(data) ? data : (data.cards || data.results || data.items || []);
      if (Array.isArray(arr) && arr.length) {
        usedSource = url;
        for (const card of arr) collected.push(card);
        break;
      } else {
        errors.push(`${url}: parsed JSON but no card array (keys: ${Object.keys(data || {}).slice(0, 4).join(",")})`);
      }
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  const trinkets = collected.map((c) => normalizeCard(c, locale, "HSWebInternal"));
  return { trinkets, totalScanned: collected.length, errors, source: usedSource };
}

// ------------------------- HTML scrape fallback ---------------------------

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

function isCardLike(item) {
  if (!item || typeof item !== "object") return false;
  if (!(item.name || item.title)) return false;
  if (item.id === undefined && item.cardId === undefined && item.slug === undefined) return false;
  return true;
}

function isTrinketLike(item) {
  if (!isCardLike(item)) return false;
  return isTrinketCard(item);
}

function findAllArraysOfTrinkets(obj, depth = 0, found = []) {
  if (!obj || typeof obj !== "object" || depth > 10) return found;
  if (Array.isArray(obj)) {
    if (obj.length >= 5 && obj.every(isCardLike)) {
      const trinketCount = obj.filter(isTrinketLike).length;
      if (trinketCount > obj.length / 2) {
        found.push({ array: obj, trinketCount, total: obj.length, depth });
      }
    }
    for (const item of obj) findAllArraysOfTrinkets(item, depth + 1, found);
    return found;
  }
  for (const key of Object.keys(obj)) findAllArraysOfTrinkets(obj[key], depth + 1, found);
  return found;
}

async function loadFromHsDbHtml(locale) {
  const errors = [];
  const url = HS_DB_PAGE(locale);
  let html = "";
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
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
  const candidateArrays = [];
  for (const blob of blobs) findAllArraysOfTrinkets(blob, 0, candidateArrays);
  candidateArrays.sort((a, b) => b.trinketCount - a.trinketCount);
  if (!candidateArrays.length) {
    errors.push(`${url}: HTML received (${html.length} bytes), ${blobs.length} embedded JSON blobs but none contained a trinket array`);
    return { trinkets: [], totalScanned: 0, errors, source: url };
  }
  const winning = candidateArrays[0];
  const trinkets = winning.array.filter(isTrinketLike).map((c) => normalizeCard(c, locale, "HearthstoneDB"));
  return { trinkets, totalScanned: winning.total, errors, source: url };
}

// ------------------------- Aggregation -----------------------------------

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
  if (inFlight && inFlight.locale === locale) return inFlight.promise;

  const promise = (async () => {
    const [hsManacost, hswebInternal, hsdbHtml, blizzardDev] = await Promise.all([
      withTimeout("HSManacost", loadFromHsManacost(locale).catch((error) => ({ trinkets: [], source: HSMANACOST_TRINKETS_URL, totalScanned: 0, errors: [`HSManacost: ${error.message}`] })), SOURCE_TIMEOUT_MS),
      withTimeout("HSWebInternal", loadFromHsWebInternal(locale).catch((error) => ({ trinkets: [], source: null, totalScanned: 0, errors: [`HSWebInternal: ${error.message}`] })), SOURCE_TIMEOUT_MS),
      withTimeout("HSDB", loadFromHsDbHtml(locale).catch((error) => ({ trinkets: [], source: null, totalScanned: 0, errors: [`HSDB: ${error.message}`] })), SOURCE_TIMEOUT_MS),
      withTimeout("Blizzard", loadFromBlizzardDev(locale).catch((error) => ({ trinkets: [], totalScanned: 0, errors: [`Blizzard: ${error.message}`] })), SOURCE_TIMEOUT_MS)
    ]);
    const merged = hsManacost.trinkets.length
      ? hsManacost.trinkets
      : mergeTrinkets(hswebInternal.trinkets, hsdbHtml.trinkets, blizzardDev.trinkets);
    const dynamicSources = {
      hsManacost: { count: hsManacost.trinkets.length, scanned: hsManacost.totalScanned, source: hsManacost.source, fetchedAt: hsManacost.fetchedAt, errors: hsManacost.errors || [] },
      hswebInternal: { count: hswebInternal.trinkets.length, scanned: hswebInternal.totalScanned, source: hswebInternal.source, errors: hswebInternal.errors || [] },
      hsdbHtml: { count: hsdbHtml.trinkets.length, scanned: hsdbHtml.totalScanned, source: hsdbHtml.source, errors: hsdbHtml.errors || [] },
      blizzard: { count: blizzardDev.trinkets.length, scanned: blizzardDev.totalScanned, errors: blizzardDev.errors || [] }
    };

    if (!merged.length) {
      return buildLocalPayload(locale, "Local curated accessories (upstream unavailable)", dynamicSources);
    }

    // Blizzard and the public web endpoints can return the full historical
    // trinket archive. That makes the page look mixed with unrelated / removed
    // cards, so keep the curated current rotation unless upstream is plausible.
    if (!hsManacost.trinkets.length && merged.length > MAX_PLAUSIBLE_ACCESSORY_COUNT) {
      return buildLocalPayload(locale, "Local curated accessories (upstream returned legacy archive)", {
        ...dynamicSources,
        rejectedUpstream: {
          count: merged.length,
          scanned: merged.length,
          source: "dynamic accessories sources",
          errors: [`Rejected ${merged.length} cards; expected current accessory pool, not historical archive.`]
        }
      });
    }

    merged.sort((a, b) => {
      if (a.size !== b.size) return a.size === "SMALL" ? -1 : 1;
      return safeLocaleCompare(a.name, b.name, locale);
    });
    const sourceLabel = [
      hsManacost.trinkets.length && "HSManacost",
      hswebInternal.trinkets.length && "HSWebInternal",
      hsdbHtml.trinkets.length && "HearthstoneDB",
      blizzardDev.trinkets.length && "Blizzard"
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
        ...dynamicSources
      }
    };
  })()
  .then((payload) => {
    cache.payload = payload;
    cache.expiresAt = Date.now() + CACHE_TTL_MS;
    cache.locale = locale;
    return payload;
  })
  .catch((error) => ({
    source: "error",
    locale,
    total: 0,
    small: [],
    large: [],
    accessories: [],
    fetchedAt: new Date().toISOString(),
    sources: { handler: { errors: [error.message] } }
  }));
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
      const sample = payload.accessories.slice(0, 5);
      const withImage = payload.accessories.filter((c) => c.upstreamImage).length;
      const withoutImage = payload.total - withImage;
      res.end(JSON.stringify({
        debug: true,
        locale,
        total: payload.total,
        small: payload.small.length,
        large: payload.large.length,
        imageStats: { withUpstream: withImage, fallbackOnly: withoutImage },
        sources: payload.sources,
        sample
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
