const { sendJson, rateLimit } = require("./_blizzard");

const HSJSON_ROOT = "https://api.hearthstonejson.com/v1/latest";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

const cache = new Map();
const inFlight = new Map();

function normalizeHsJsonLocale(locale = "") {
  const raw = String(locale || "ruRU").trim();
  if (!raw) return "ruRU";
  if (/^[a-z]{2}_[A-Z]{2}$/.test(raw)) {
    return raw.replace("_", "");
  }
  if (/^[a-z]{2}-[A-Z]{2}$/.test(raw)) {
    return raw.replace("-", "");
  }
  if (/^[a-z]{2}[A-Z]{2}$/.test(raw)) {
    return raw;
  }
  return raw;
}

function toBcp47(locale) {
  const normalized = normalizeHsJsonLocale(locale);
  return normalized.replace(/^([a-z]{2})([A-Z]{2})$/, "$1-$2");
}

function decodeBasicEntities(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function stripCardText(value) {
  return decodeBasicEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[x]/gi, "")
    .replace(/\$\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRaces(card) {
  const rawRaces = Array.isArray(card.races) && card.races.length
    ? card.races
    : [card.race].filter(Boolean);
  const races = rawRaces.map((race) => String(race).trim()).filter(Boolean);
  return races.length ? races : ["NONE"];
}

function isCurrentBattlegroundsMinion(card) {
  return Boolean(
    card
    && card.isBattlegroundsPoolMinion === true
    && card.type === "MINION"
    && !card.battlegroundsNormalDbfId
    && Number(card.techLevel) >= 1
    && Number(card.techLevel) <= 7
    && card.id
  );
}

function normalizeCard(card, locale, englishCard) {
  const id = String(card.id);
  return {
    id,
    dbfId: Number(card.dbfId) || null,
    name: card.name || "",
    englishName: englishCard?.name || "",
    text: stripCardText(card.text || card.collectionText || ""),
    techLevel: Number(card.techLevel) || 0,
    attack: Number(card.attack) || 0,
    health: Number(card.health) || 0,
    races: normalizeRaces(card),
    artUrl: `https://art.hearthstonejson.com/v1/bgs/latest/${locale}/256x/${encodeURIComponent(id)}.png`
  };
}

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
      throw new Error(`HearthstoneJSON HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHsJsonCards(locale) {
  return fetchJsonWithTimeout(`${HSJSON_ROOT}/${encodeURIComponent(locale)}/cards.json`);
}

function buildEnglishMap(cards) {
  const map = new Map();
  if (!Array.isArray(cards)) {
    return map;
  }
  cards.forEach((card) => {
    if (card?.id) {
      map.set(String(card.id), card);
    }
  });
  return map;
}

async function buildLibrary(locale, includeEnglish) {
  const [localizedCards, englishCards] = await Promise.all([
    fetchHsJsonCards(locale),
    includeEnglish && locale !== "enUS" ? fetchHsJsonCards("enUS") : Promise.resolve([])
  ]);
  const englishById = buildEnglishMap(englishCards);
  const sortLocale = toBcp47(locale);
  const seen = new Set();

  const cards = (Array.isArray(localizedCards) ? localizedCards : [])
    .filter(isCurrentBattlegroundsMinion)
    .filter((card) => {
      const id = String(card.id);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    })
    .map((card) => normalizeCard(card, locale, englishById.get(String(card.id))))
    .sort((left, right) => {
      return (left.techLevel || 0) - (right.techLevel || 0)
        || String(left.name || "").localeCompare(String(right.name || ""), sortLocale);
    });

  return {
    source: "HearthstoneJSON",
    locale,
    artBase: `https://art.hearthstonejson.com/v1/bgs/latest/${locale}/256x/`,
    count: cards.length,
    updatedAt: new Date().toISOString(),
    cards
  };
}

async function getLibrary(locale, includeEnglish) {
  const cacheKey = `${locale}:${includeEnglish ? "en" : "local"}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const promise = buildLibrary(locale, includeEnglish)
    .then((payload) => {
      cache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload
      });
      return payload;
    })
    .finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, promise);
  return promise;
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "battlegrounds-library", 30, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  const locale = normalizeHsJsonLocale(req.query.locale || "ruRU");
  const includeEnglish = req.query.includeEnglish === "1" || req.query.includeEnglish === "true";

  try {
    const payload = await getLibrary(locale, includeEnglish);
    sendJson(res, 200, payload, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=21600, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить библиотеку существ Полей сражений из HearthstoneJSON.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
