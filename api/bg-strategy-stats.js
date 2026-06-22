const { sendJson, rateLimit } = require("./_blizzard");

const FIRESTONE_URL = "https://api.hs-manacost.ru/datasets/firestone_battlegrounds_comps";
const HSREPLAY_URL = "https://api.hs-manacost.ru/datasets/hsreplay_battlegrounds_comps";
const DB_FRAMED_BASE = "https://db.kolodahs.ru/uploads/framed/";
const DB_CARD_BASE = "https://db.kolodahs.ru/uploads/cards/";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

const cached = new Map();
const inFlight = new Map();

const ARCHETYPES = [
  { key: "beast", ru: "Звери", en: "Beast", match: ["beast", "rylak", "tiger shark"] },
  { key: "demon", ru: "Демоны", en: "Demon", match: ["demon", "fodder", "shop buff"] },
  { key: "dragon", ru: "Драконы", en: "Dragon", match: ["dragon", "kalecgos"] },
  { key: "elemental", ru: "Элементали", en: "Elemental", match: ["elemental", "tavern spell"] },
  { key: "mech", ru: "Механизмы", en: "Mech", match: ["mech", "magnetic", "magnetics"] },
  { key: "murloc", ru: "Мурлоки", en: "Murloc", match: ["murloc", "venom"] },
  { key: "naga", ru: "Нага", en: "Naga", match: ["naga", "spellcraft"] },
  { key: "pirate", ru: "Пираты", en: "Pirate", match: ["pirate", "apm"] },
  { key: "quilboar", ru: "Свинобраз", en: "Quilboar", match: ["quilboar", "blood gem", "bloodgem"] },
  { key: "undead", ru: "Нежить", en: "Undead", match: ["undead", "kel'thuzad"] },
  { key: "neutral", ru: "Общие", en: "Neutral", match: ["menagerie", "scam", "neutral"] }
];

const TIER_ORDER = new Map([["S", 0], ["A", 1], ["B", 2], ["C", 3], ["D", 4]]);
const DIFFICULTY_RU = { Easy: "Лёгкая", Medium: "Средняя", Hard: "Сложная" };
const SOURCE_CONFIG = {
  firestone: {
    label: "Firestone",
    url: FIRESTONE_URL,
    sourceText: "Firestone через api.hs-manacost.ru + фреймы db.kolodahs.ru"
  },
  hsreplay: {
    label: "HSReplay",
    url: HSREPLAY_URL,
    sourceText: "HSReplay comps через api.hs-manacost.ru + фреймы db.kolodahs.ru"
  }
};

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Manacost Battleground Firestone Strategy Tiers"
      }
    });
    if (!response.ok) {
      throw new Error(`${url} HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOf(comp) {
  return [
    comp?.title,
    comp?.name,
    comp?.description,
    comp?.comp_id,
    comp?.source_id
  ].map((part) => String(part || "").toLowerCase()).join(" ");
}

function inferArchetype(comp) {
  const title = String(comp?.title || comp?.name || comp?.slug || "").toLowerCase();
  const exact = [
    ["beast", ["beast", "beasts"]],
    ["demon", ["demon", "demons"]],
    ["dragon", ["dragon", "dragons"]],
    ["elemental", ["elemental", "elementals"]],
    ["mech", ["mech", "mechs"]],
    ["murloc", ["murloc", "murlocs"]],
    ["naga", ["naga", "nagas"]],
    ["pirate", ["pirate", "pirates"]],
    ["quilboar", ["quilboar", "quilboars"]],
    ["undead", ["undead"]]
  ];
  const exactMatch = exact.find(([, names]) => names.some((name) => title.startsWith(name)));
  if (exactMatch) {
    return ARCHETYPES.find((item) => item.key === exactMatch[0]) || ARCHETYPES[ARCHETYPES.length - 1];
  }
  const text = textOf(comp);
  return ARCHETYPES.find((item) => item.match.some((word) => text.includes(word))) || ARCHETYPES[ARCHETYPES.length - 1];
}

function normalizeCards(comp) {
  const seen = new Set();
  const groups = [
    ["CORE", Array.isArray(comp?.main_cards) ? comp.main_cards : []],
    ["ADDON", Array.isArray(comp?.additional_cards) ? comp.additional_cards : []]
  ];
  const cards = [];

  groups.forEach(([role, list]) => {
    list.forEach((card) => {
      const id = String(card?.card_id || card?.id || "").trim();
      const type = String(card?.type || "").trim().toUpperCase();
      if (!id || id === "#N/A" || seen.has(id) || type !== "MINION") {
        return;
      }
      seen.add(id);
      cards.push({
        id,
        dbfId: asNumber(card?.dbfId),
        name: String(card?.name || "").trim(),
        role: String(card?.status || role),
        frame: `${DB_FRAMED_BASE}${encodeURIComponent(id)}.png`,
        card: `${DB_CARD_BASE}${encodeURIComponent(id)}.png`,
        fallback: String(card?.image_url || `https://art.hearthstonejson.com/v1/256x/${id}.png`).trim()
      });
    });
  });

  return cards.slice(0, 10);
}

function parseHsReplayDescription(comp) {
  let description = String(comp?.description || "").trim();
  const match = description.match(/(Easy|Medium|Hard)\d*$/);
  if (!match) {
    return {
      description,
      difficulty: ""
    };
  }
  return {
    description: description.slice(0, match.index).trim(),
    difficulty: DIFFICULTY_RU[match[1]] || match[1]
  };
}

function normalizeTitle(comp, sourceKey) {
  const raw = String(comp?.title || comp?.name || comp?.slug || comp?.comp_id || "").trim();
  if (sourceKey !== "hsreplay") {
    return raw;
  }
  return raw.replace(/\s+-\s+/g, ": ");
}

function normalizeStrategy(comp, sourceKey, sourceLabel) {
  const cards = normalizeCards(comp);
  if (!cards.length) {
    return null;
  }

  const archetype = inferArchetype(comp);
  const hsreplayMeta = sourceKey === "hsreplay" ? parseHsReplayDescription(comp) : null;
  const title = normalizeTitle(comp, sourceKey);
  const tier = String(comp?.tier || "").trim().toUpperCase() || "D";
  const avgPlacement = asNumber(comp?.avg_placement);
  const games = asNumber(comp?.games);
  const difficulty = String(hsreplayMeta?.difficulty || comp?.difficulty_ru || DIFFICULTY_RU[comp?.difficulty] || comp?.difficulty || "").trim();

  return {
    key: String(comp?.id || `${sourceKey}-${comp?.comp_id || title}`),
    source: sourceLabel,
    sourceKey,
    tier: TIER_ORDER.has(tier) ? tier : "D",
    title,
    description: String(hsreplayMeta?.description || comp?.description || "").trim(),
    difficulty,
    archetype: archetype.ru,
    archetypeKey: archetype.key,
    avgPlacement,
    games,
    firstPlace: "",
    popularity: "",
    url: String(comp?.url || (sourceKey === "hsreplay" ? "https://hsreplay.net/battlegrounds/comps/" : "https://www.firestoneapp.com/battlegrounds/comps")),
    cards
  };
}

async function buildPayload(sourceKey) {
  const config = SOURCE_CONFIG[sourceKey] || SOURCE_CONFIG.firestone;
  const raw = await fetchJsonWithTimeout(config.url);
  const comps = raw?.data?.structured?.comps;
  if (!Array.isArray(comps)) {
    throw new Error(`Неожиданный формат данных ${config.label}.`);
  }

  const strategies = comps
    .map((comp) => normalizeStrategy(comp, sourceKey, config.label))
    .filter(Boolean)
    .sort((a, b) => {
      const tierDiff = (TIER_ORDER.get(a.tier) ?? 99) - (TIER_ORDER.get(b.tier) ?? 99);
      if (tierDiff !== 0) {
        return tierDiff;
      }
      const avgA = a.avgPlacement ?? 99;
      const avgB = b.avgPlacement ?? 99;
      if (avgA !== avgB) {
        return avgA - avgB;
      }
      return (b.games ?? 0) - (a.games ?? 0);
    });

  return {
    source: config.sourceText,
    sourceKey,
    sourceLabel: config.label,
    fetchedAt: raw?.fetched_at || new Date().toISOString(),
    count: strategies.length,
    strategies
  };
}

async function getStrategies(sourceKey) {
  const cachedEntry = cached.get(sourceKey);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.payload;
  }
  if (inFlight.has(sourceKey)) {
    return inFlight.get(sourceKey);
  }

  const promise = buildPayload(sourceKey)
    .then((payload) => {
      cached.set(sourceKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
      return payload;
    })
    .finally(() => {
      inFlight.delete(sourceKey);
    });

  inFlight.set(sourceKey, promise);
  return promise;
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "bg-strategy-stats", 30, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || "/", "http://localhost");
    const requestedSource = String(url.searchParams.get("source") || "firestone").toLowerCase();
    const sourceKey = SOURCE_CONFIG[requestedSource] ? requestedSource : "firestone";
    const payload = await getStrategies(sourceKey);
    sendJson(res, 200, payload, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить тир-лист стратегий.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
