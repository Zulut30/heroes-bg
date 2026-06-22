const { sendJson, rateLimit } = require("./_blizzard");

const SOURCES = [
  {
    url: "https://api.hs-manacost.ru/datasets/hsreplay_battlegrounds_trinkets_lesser",
    size: "SMALL",
    label: "малые"
  },
  {
    url: "https://api.hs-manacost.ru/datasets/hsreplay_battlegrounds_trinkets_greater",
    size: "LARGE",
    label: "большие"
  }
];

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const BLIZZARD_CARD_BATCH_SIZE = 80;

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
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function parsePlacement(value) {
  const numeric = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeTrinket(entry, size) {
  const id = String(entry?.id || entry?.trinket_id || "").trim();
  const dbfId = Number(entry?.dbfId) || null;
  const tier = String(entry?.tier || "").trim().toUpperCase();
  return {
    id,
    dbfId,
    name: String(entry?.name || "").trim(),
    localizedName: String(entry?.localized_name || entry?.name || "").trim(),
    text: String(entry?.description || "").trim(),
    size,
    typeLabel: size === "SMALL" ? "Малый аксессуар" : "Большой аксессуар",
    cost: Number.isFinite(Number(entry?.cost)) ? Number(entry.cost) : null,
    pickRate: String(entry?.pick_rate || "").trim(),
    avgPlacement: parsePlacement(entry?.avg_placement),
    avgPlacementLabel: String(entry?.avg_placement || "").trim(),
    placementDistribution: Array.isArray(entry?.placement_distribution) ? entry.placement_distribution : [],
    tier: ["S", "A", "B", "C", "D"].includes(tier) ? tier : "D"
  };
}

function remoteImageProxy(url) {
  const normalized = String(url || "").trim();
  return normalized ? `/api/remote-image?src=${encodeURIComponent(normalized)}` : "";
}

async function fetchBlizzardImagesByDbfId(dbfIds) {
  const imageByDbfId = new Map();
  const uniqueIds = [...new Set(dbfIds.filter(Boolean).map(String))];

  for (let index = 0; index < uniqueIds.length; index += BLIZZARD_CARD_BATCH_SIZE) {
    const chunk = uniqueIds.slice(index, index + BLIZZARD_CARD_BATCH_SIZE);
    const url = `https://hearthstone.blizzard.com/ru-ru/api/cards?ids=${encodeURIComponent(chunk.join(","))}&gameMode=battlegrounds&pageSize=${chunk.length}&locale=ru_RU`;
    try {
      const payload = await fetchJsonWithTimeout(url);
      (payload.cards || []).forEach((card) => {
        const dbfId = String(card?.id || "");
        const image = card?.battlegrounds?.image || card?.image || "";
        if (dbfId && image) {
          imageByDbfId.set(dbfId, image);
        }
      });
    } catch (error) {
      console.warn(`Blizzard card image batch failed (${chunk[0]}...):`, error.message);
    }
  }

  return imageByDbfId;
}

async function buildPayload() {
  const results = await Promise.allSettled(SOURCES.map(async (source) => {
    const raw = await fetchJsonWithTimeout(source.url);
    const trinkets = raw?.data?.structured?.trinkets;
    if (!Array.isArray(trinkets)) {
      throw new Error(`Неожиданный формат датасета ${source.label}.`);
    }
    return {
      label: source.label,
      fetchedAt: raw?.fetched_at || "",
      trinkets: trinkets.map((item) => normalizeTrinket(item, source.size))
        .filter((item) => item.id && item.dbfId && item.avgPlacement !== null)
    };
  }));

  const ok = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (!ok.length) {
    throw new Error("Не удалось получить статистику малых или больших аксессуаров.");
  }

  const trinkets = ok.flatMap((item) => item.trinkets);
  const imageByDbfId = await fetchBlizzardImagesByDbfId(trinkets.map((item) => item.dbfId));

  const enriched = trinkets.map((item) => {
    const upstreamImage = imageByDbfId.get(String(item.dbfId)) || "";
    return {
      ...item,
      image: remoteImageProxy(upstreamImage),
      imageFallback: `/api/card-art?id=${encodeURIComponent(item.id)}&locale=ruRU&size=512x`,
      upstreamImage
    };
  });

  return {
    source: "HSReplay trinkets + Blizzard card images",
    fetchedAt: ok.map((item) => item.fetchedAt).sort().pop() || new Date().toISOString(),
    count: enriched.length,
    trinkets: enriched,
    smallCount: enriched.filter((item) => item.size === "SMALL").length,
    largeCount: enriched.filter((item) => item.size === "LARGE").length
  };
}

async function getTrinketStats() {
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
  const limit = rateLimit(req, "bg-trinket-stats", 30, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  try {
    const payload = await getTrinketStats();
    sendJson(res, 200, payload, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось загрузить статистику аксессуаров Полей сражений.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
