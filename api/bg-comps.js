const { sendJson, rateLimit } = require("./_blizzard");

const SOURCES = [
  { url: "https://api.hs-manacost.ru/datasets/hsreplay_battlegrounds_comps", label: "HSReplay" },
  { url: "https://api.hs-manacost.ru/datasets/firestone_battlegrounds_comps", label: "Firestone" }
];
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

function normalizeCard(card, role) {
  const id = String(card?.card_id || card?.id || "").trim();
  if (!id) {
    return null;
  }
  return {
    id,
    dbfId: Number(card?.dbfId) || null,
    name: String(card?.name || "").trim(),
    count: Number(card?.count) || 1,
    role
  };
}

function normalizeCardGroup(list, role) {
  const cards = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((card) => {
    const normalized = normalizeCard(card, role);
    if (!normalized || seen.has(normalized.id)) {
      return;
    }
    seen.add(normalized.id);
    cards.push(normalized);
  });
  return cards;
}

function normalizeCards(comp) {
  const cards = [];
  const seen = new Set();
  const groups = [
    ["CORE", comp?.main_cards || comp?.core_cards],
    ["ADDON", comp?.additional_cards || comp?.addon_cards],
    ["COMMIT", comp?.when_to_commit_cards],
    ["ENABLER", comp?.enabler_cards]
  ];
  groups.forEach(([role, list]) => {
    normalizeCardGroup(list, role).forEach((card) => {
      if (seen.has(card.id)) {
        return;
      }
      seen.add(card.id);
      cards.push(card);
    });
  });
  return cards;
}

const DIFFICULTY_RU = { Easy: "Лёгкая", Medium: "Средняя", Hard: "Сложная" };

function localizeDifficulty(value) {
  const difficulty = String(value || "").trim();
  return DIFFICULTY_RU[difficulty] || difficulty;
}

function normalizeComp(comp, label) {
  const cards = normalizeCards(comp);
  if (!cards.length) {
    return null;
  }
  const coreCards = normalizeCardGroup(comp?.main_cards || comp?.core_cards, "CORE");
  const additionalCards = normalizeCardGroup(comp?.additional_cards || comp?.addon_cards, "ADDON");
  const whenToCommitCards = normalizeCardGroup(comp?.when_to_commit_cards, "COMMIT");
  const enablerCards = normalizeCardGroup(comp?.enabler_cards, "ENABLER");
  const title = String(comp?.strategy_title || comp?.title || comp?.slug || comp?.name || "").trim();
  const description = String(comp?.how_to_play || comp?.description || "").trim();
  return {
    key: String(comp?.id || `${label}-${comp?.comp_id}`),
    source: label,
    title,
    description: description.slice(0, 500),
    tier: String(comp?.tier || "").trim(),
    difficulty: String(comp?.difficulty_ru || localizeDifficulty(comp?.difficulty)).trim(),
    avgPlacement: comp?.avg_placement != null ? String(comp.avg_placement) : "",
    whenToCommit: String(comp?.when_to_commit || "").trim(),
    sourceUrl: String(comp?.url || "").trim(),
    coreCards,
    additionalCards,
    whenToCommitCards,
    enablerCards,
    cards
  };
}

async function buildPayload() {
  const results = await Promise.allSettled(SOURCES.map(async ({ url, label }) => {
    const raw = await fetchJsonWithTimeout(url);
    const comps = raw?.data?.structured?.comps;
    if (!Array.isArray(comps)) {
      throw new Error(`Неожиданный формат данных сборок (${label}).`);
    }
    return {
      label,
      fetchedAt: raw?.fetched_at || "",
      comps: comps.map((comp) => normalizeComp(comp, label)).filter(Boolean)
    };
  }));

  const ok = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  if (!ok.length) {
    throw new Error("Ни один источник сборок не ответил.");
  }

  return {
    source: "HSReplay + Firestone через api.hs-manacost.ru",
    fetchedAt: ok.map((item) => item.fetchedAt).sort().pop() || new Date().toISOString(),
    count: ok.reduce((sum, item) => sum + item.comps.length, 0),
    comps: ok.flatMap((item) => item.comps)
  };
}

async function getComps() {
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
  const limit = rateLimit(req, "bg-comps", 30, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  try {
    const payload = await getComps();
    sendJson(res, 200, payload, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить готовые сборки Полей сражений.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
