const { rateLimit } = require("./_blizzard");

const FIRESTONE_PAGE = "https://www.firestoneapp.com/battlegrounds/comps?rank=25";
// Firestone's React app fetches comp data from S3-backed JSON files. Their
// production layout has shifted a few times; we try the most-recent shapes
// in order and use whichever one returns valid data first.
const FIRESTONE_DATA_CANDIDATES = [
  // Modern (per-rank, per-time-window): /api/bgs/meta-comps/{period}/{mmr}/...
  "https://static.zerotoheroes.com/api/bgs/meta-comps/past-3/25/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/past-3/all/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/past-7/25/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/past-7/all/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/last-patch/25/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/last-patch/all/comps.gz.json",
  // Older locations
  "https://static.zerotoheroes.com/api/bgs/meta-comps/25/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/all/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps/mmr-25/comps.gz.json",
  "https://static.zerotoheroes.com/api/bgs/meta-comps.json"
];
const HSREPLAY_PAGE = "https://hsreplay.net/battlegrounds/comps/";
// HSReplay also caches their BG comp data as a JSON snapshot.
const HSREPLAY_DATA_CANDIDATES = [
  "https://hsreplay.net/analytics/bgs_comps/",
  "https://hsreplay.net/analytics/query/list_battlegrounds_comps/"
];

const TIERS = ["S", "A", "B", "C", "D"];
const VALID_RACES = new Set([
  "BEAST","DEMON","DRAGON","ELEMENTAL","MECHANICAL","MURLOC","NAGA","PIRATE","QUILBOAR","UNDEAD","NONE","ALL"
]);

const cache = { payload: null, expiresAt: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000;
let inFlight = null;

function normalizeTier(value) {
  const t = String(value || "").trim().toUpperCase();
  return TIERS.includes(t) ? t : "B";
}

function normalizeDifficulty(value) {
  const lower = String(value || "").toLowerCase();
  if (lower.startsWith("e")) return "Easy";
  if (lower.startsWith("h")) return "Hard";
  return "Medium";
}

function normalizeRace(value) {
  const upper = String(value || "").trim().toUpperCase().replace(/^MINION_/, "");
  if (VALID_RACES.has(upper)) return upper;
  if (upper === "NEUTRAL") return "NONE";
  return "NONE";
}

function normalizeTrend(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "stable";
  if (num > 0) return "up";
  if (num < 0) return "down";
  return "stable";
}

function pickCardName(card) {
  return card?.name || card?.title || card?.cardName || "";
}

function pickCardId(card) {
  if (!card) return "";
  return String(card.cardId || card.id || card.dbfId || card.code || "").trim();
}

function normalizeCards(rawCards = []) {
  if (!Array.isArray(rawCards)) return [];
  return rawCards
    .map((card) => ({ id: pickCardId(card), name: pickCardName(card) }))
    .filter((c) => c.id || c.name)
    .slice(0, 8);
}

function normalizeFirestoneComp(comp) {
  if (!comp) return null;
  const cards = normalizeCards(
    comp.coreCards || comp.coreMinions || comp.cards || comp.minions || []
  );
  const tier = normalizeTier(comp.tier || comp.placement);
  const name = comp.name || comp.title || comp.englishName;
  if (!name) return null;
  return {
    sourceId: `firestone:${name}`,
    source: "firestone",
    tier,
    race: normalizeRace(comp.tribe || comp.minionTribe || comp.race || comp.raceId),
    name,
    subtitle: comp.englishName || comp.shortName || "",
    summary: comp.description || comp.flavor || "",
    difficulty: normalizeDifficulty(comp.difficulty),
    trend: normalizeTrend(comp.trend ?? comp.delta ?? comp.weekDelta),
    cards
  };
}

function normalizeHsreplayComp(comp) {
  if (!comp) return null;
  const cards = normalizeCards(comp.coreCards || comp.cards || comp.minions || []);
  const name = comp.title || comp.name || comp.englishName;
  if (!name) return null;
  return {
    sourceId: `hsreplay:${name}`,
    source: "hsreplay",
    tier: normalizeTier(comp.tier),
    race: normalizeRace(comp.race || comp.tribe),
    name,
    subtitle: comp.subtitle || comp.englishName || "",
    summary: comp.description || comp.summary || "",
    difficulty: normalizeDifficulty(comp.difficulty),
    trend: normalizeTrend(comp.trend ?? comp.delta),
    cards
  };
}

function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function extractEmbeddedJson(html) {
  const out = [];
  const namedScript = (id) => {
    const re = new RegExp(`<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
    const match = html.match(re);
    if (!match) return;
    const parsed = tryParseJson(match[1]);
    if (parsed) out.push(parsed);
  };
  const windowAssign = (varName) => {
    const re = new RegExp(`window\\.${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`);
    const match = html.match(re);
    if (!match) return;
    const parsed = tryParseJson(match[1]);
    if (parsed) out.push(parsed);
  };

  namedScript("__NEXT_DATA__");
  namedScript("__NUXT_DATA__");
  windowAssign("__INITIAL_DATA__");
  windowAssign("__INITIAL_STATE__");
  windowAssign("__NUXT__");
  windowAssign("__APOLLO_STATE__");

  // Apollo: window.__APOLLO_STATE__ = {...} or const __APOLLO_STATE__ = ...
  const apolloAlt = html.match(/__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (apolloAlt) {
    const parsed = tryParseJson(apolloAlt[1]);
    if (parsed) out.push(parsed);
  }

  // Generic: any <script type="application/json"> blob big enough to host comps
  const jsonScriptRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = jsonScriptRe.exec(html))) {
    if (m[1].length < 200) continue; // skip tiny meta blobs
    const parsed = tryParseJson(m[1]);
    if (parsed) out.push(parsed);
  }

  return out;
}

function deepFindCompList(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 8) return [];
  if (Array.isArray(obj)) {
    if (obj.length && typeof obj[0] === "object" && obj[0] && (obj[0].coreCards || obj[0].coreMinions || obj[0].minions || obj[0].cards) && (obj[0].name || obj[0].title)) {
      return obj;
    }
    for (const item of obj) {
      const found = deepFindCompList(item, depth + 1);
      if (found.length) return found;
    }
    return [];
  }
  for (const key of Object.keys(obj)) {
    const found = deepFindCompList(obj[key], depth + 1);
    if (found.length) return found;
  }
  return [];
}

async function fetchText(url, accept = "text/html,application/json;q=0.9") {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36",
        Accept: accept,
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br"
      }
    });
    if (!response.ok) {
      return { ok: false, status: response.status, url };
    }
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    return { ok: true, contentType, body, url };
  } catch (error) {
    return { ok: false, error: error.message, url };
  }
}

async function loadFirestone() {
  const errors = [];
  let usedSource = null;
  for (const url of FIRESTONE_DATA_CANDIDATES) {
    const result = await fetchText(url, "application/json");
    if (!result.ok) {
      errors.push(`${url}: ${result.error || result.status}`);
      continue;
    }
    const parsed = tryParseJson(result.body);
    if (!parsed) {
      errors.push(`${url}: not JSON (${result.body.slice(0, 80)})`);
      continue;
    }
    const list = deepFindCompList(parsed);
    if (list.length) {
      usedSource = url;
      return { comps: list.map(normalizeFirestoneComp).filter(Boolean), errors, usedSource };
    }
    errors.push(`${url}: parsed JSON but no comps array found (top-level keys: ${Object.keys(parsed).slice(0, 6).join(",")})`);
  }
  const page = await fetchText(FIRESTONE_PAGE);
  if (page.ok) {
    for (const blob of extractEmbeddedJson(page.body)) {
      const list = deepFindCompList(blob);
      if (list.length) {
        usedSource = `${FIRESTONE_PAGE} (embedded)`;
        return { comps: list.map(normalizeFirestoneComp).filter(Boolean), errors, usedSource };
      }
    }
    errors.push(`${FIRESTONE_PAGE}: HTML received but no embedded comp list (${page.body.length} bytes)`);
  } else {
    errors.push(`${FIRESTONE_PAGE}: ${page.error || page.status}`);
  }
  return { comps: [], errors, usedSource };
}

async function loadHsreplay() {
  const errors = [];
  let usedSource = null;
  for (const url of HSREPLAY_DATA_CANDIDATES) {
    const result = await fetchText(url, "application/json");
    if (!result.ok) {
      errors.push(`${url}: ${result.error || result.status}`);
      continue;
    }
    const parsed = tryParseJson(result.body);
    if (!parsed) continue;
    const list = deepFindCompList(parsed);
    if (list.length) {
      usedSource = url;
      return { comps: list.map(normalizeHsreplayComp).filter(Boolean), errors, usedSource };
    }
  }
  const page = await fetchText(HSREPLAY_PAGE);
  if (!page.ok) {
    errors.push(`${HSREPLAY_PAGE}: ${page.error || page.status}`);
    return { comps: [], errors, usedSource };
  }
  for (const blob of extractEmbeddedJson(page.body)) {
    const list = deepFindCompList(blob);
    if (list.length) {
      usedSource = `${HSREPLAY_PAGE} (embedded)`;
      return { comps: list.map(normalizeHsreplayComp).filter(Boolean), errors, usedSource };
    }
  }
  errors.push(`${HSREPLAY_PAGE}: HTML received (${page.body.length} bytes) but no embedded comp list found`);
  return { comps: [], errors, usedSource };
}

async function loadAll(force = false) {
  const now = Date.now();
  if (!force && cache.payload && cache.expiresAt > now) return cache.payload;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [firestone, hsreplay] = await Promise.all([loadFirestone(), loadHsreplay()]);
    const payload = {
      fetchedAt: new Date().toISOString(),
      sources: {
        firestone: { count: firestone.comps.length, usedSource: firestone.usedSource, errors: firestone.errors.slice(0, 6) },
        hsreplay: { count: hsreplay.comps.length, usedSource: hsreplay.usedSource, errors: hsreplay.errors.slice(0, 6) }
      },
      comps: [...firestone.comps, ...hsreplay.comps]
    };
    cache.payload = payload;
    cache.expiresAt = now + CACHE_TTL_MS;
    return payload;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "comps-source", 20, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  const force = req.query?.force === "1";
  try {
    const payload = await loadAll(force);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Не удалось получить стратегии.", details: error.message }));
  }
};
