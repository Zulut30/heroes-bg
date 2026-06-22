const path = require("path");
const { sendJson, rateLimit } = require("./_blizzard");

const TIER_ORDER = ["S", "A", "B", "C", "D"];
const LISTS = {
  heroes: {
    label: "Тир-лист героев",
    route: "bg-hero-stats",
    field: "heroes",
    source: "hsreplay",
    tierMode: "item"
  },
  minions: {
    label: "Тир-лист существ",
    route: "bg-minion-stats",
    field: "minions",
    source: "hsreplay",
    tierMode: "metric",
    metricKey: "impact",
    metricBetter: "desc"
  },
  spells: {
    label: "Тир-лист заклинаний",
    route: "bg-spell-stats",
    field: "spells",
    source: "firestone",
    tierMode: "metric",
    metricKey: "avgPlacement",
    metricBetter: "asc"
  },
  trinkets: {
    label: "Тир-лист аксессуаров",
    route: "bg-trinket-stats",
    field: "trinkets",
    source: "hsreplay",
    tierMode: "item"
  },
  strategies: {
    label: "Тир-лист стратегий",
    route: "bg-strategy-stats",
    field: "strategies",
    source: "firestone",
    tierMode: "item"
  }
};

const LIST_ALIASES = {
  hero: "heroes",
  heroes: "heroes",
  minion: "minions",
  minions: "minions",
  spell: "spells",
  spells: "spells",
  trinket: "trinkets",
  trinkets: "trinkets",
  accessory: "trinkets",
  accessories: "trinkets",
  strategy: "strategies",
  strategies: "strategies",
  comp: "strategies",
  comps: "strategies"
};

const SOURCE_ALIASES = {
  firestone: "firestone",
  hsreplay: "hsreplay",
  hs: "hsreplay"
};

const QUANTILES = { S: 0.08, A: 0.25, B: 0.55, C: 0.85 };

function parseTier(value) {
  const tier = String(value || "").trim().toUpperCase();
  return TIER_ORDER.includes(tier) ? tier : "";
}

function parseList(value) {
  const list = String(value || "").trim().toLowerCase();
  if (!list || list === "all") {
    return list || "";
  }
  return LIST_ALIASES[list] || "";
}

function parseSource(value, fallback = "firestone") {
  const source = String(value || fallback).trim().toLowerCase();
  return SOURCE_ALIASES[source] || fallback;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function callLocalApi(route, query = {}) {
  const apiPath = path.join(__dirname, `${route}.js`);
  const handler = require(apiPath);
  const search = new URLSearchParams(query);
  const req = {
    url: `/api/${route}${search.toString() ? `?${search}` : ""}`,
    query,
    headers: {},
    socket: { remoteAddress: "tier-lists-internal" }
  };

  return new Promise((resolve, reject) => {
    const chunks = [];
    const headers = {};
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(name, value) {
        headers[String(name).toLowerCase()] = value;
      },
      getHeader(name) {
        return headers[String(name).toLowerCase()];
      },
      writeHead(statusCode, nextHeaders = {}) {
        this.statusCode = statusCode;
        this.headersSent = true;
        Object.entries(nextHeaders).forEach(([key, value]) => this.setHeader(key, value));
      },
      write(chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      },
      end(chunk) {
        if (chunk) {
          this.write(chunk);
        }
        const body = Buffer.concat(chunks).toString("utf8");
        if (this.statusCode >= 400) {
          reject(new Error(`${route} HTTP ${this.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(body ? JSON.parse(body) : null);
        } catch (error) {
          reject(error);
        }
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

function deriveMetricTiers(items, config) {
  const rated = items
    .map((item) => ({ ...item, metricValue: numberOrNull(item[config.metricKey]) }))
    .filter((item) => item.metricValue !== null);
  const direction = config.metricBetter === "asc" ? 1 : -1;
  rated.sort((left, right) => direction * (left.metricValue - right.metricValue));

  return rated.map((item, index) => {
    const fraction = (index + 1) / rated.length;
    let tier = "D";
    if (fraction <= QUANTILES.S || index === 0) tier = "S";
    else if (fraction <= QUANTILES.A) tier = "A";
    else if (fraction <= QUANTILES.B) tier = "B";
    else if (fraction <= QUANTILES.C) tier = "C";
    return { ...item, tier };
  });
}

function normalizeTieredItems(items, config) {
  if (config.tierMode === "metric") {
    return deriveMetricTiers(items, config);
  }
  return items
    .map((item) => ({ ...item, tier: parseTier(item.tier) || "D" }))
    .filter((item) => item.tier);
}

function groupByTier(items) {
  return Object.fromEntries(TIER_ORDER.map((tier) => [
    tier,
    items.filter((item) => item.tier === tier)
  ]));
}

function requestOrigin(req) {
  return `https://${req?.headers?.host || "bg.kolodahearthstone.ru"}`;
}

function absoluteUrl(req, value) {
  const url = String(value || "").trim();
  if (!url) {
    return "";
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${requestOrigin(req)}${url.startsWith("/") ? "" : "/"}${url}`;
}

function withImages(item, listKey, req) {
  if (listKey === "heroes") {
    return {
      ...item,
      image: absoluteUrl(req, `/heroes_bg/${encodeURIComponent(item.hero)}.png`)
    };
  }

  if (listKey === "minions" || listKey === "spells") {
    return {
      ...item,
      image: absoluteUrl(req, `/api/card-art?id=${encodeURIComponent(item.id)}&locale=ruRU&size=512x`),
      image256: absoluteUrl(req, `/api/card-art?id=${encodeURIComponent(item.id)}&locale=ruRU&size=256x`)
    };
  }

  if (listKey === "trinkets") {
    return {
      ...item,
      image: absoluteUrl(req, item.image || item.imageFallback),
      imageFallback: absoluteUrl(req, item.imageFallback)
    };
  }

  if (listKey === "strategies") {
    return {
      ...item,
      cards: (item.cards || []).map((card) => ({
        ...card,
        frame: absoluteUrl(req, card.frame),
        card: absoluteUrl(req, card.card),
        fallback: absoluteUrl(req, card.fallback)
      }))
    };
  }

  return item;
}

async function buildList(listKey, options = {}, req = null) {
  const config = LISTS[listKey];
  const query = {};
  let source = config.source;
  if (listKey === "strategies") {
    source = parseSource(options.source, config.source);
    query.source = source;
  }

  const payload = await callLocalApi(config.route, query);
  const rawItems = Array.isArray(payload?.[config.field]) ? payload[config.field] : [];
  const items = normalizeTieredItems(rawItems, config)
    .map((item) => withImages(item, listKey, req));
  const tiers = groupByTier(items);
  const tier = parseTier(options.tier);

  const result = {
    list: listKey,
    label: config.label,
    source,
    upstreamSource: payload?.source || "",
    fetchedAt: payload?.fetchedAt || "",
    generatedAt: new Date().toISOString(),
    tier: tier || null,
    availableTiers: TIER_ORDER,
    count: tier ? tiers[tier].length : items.length
  };

  if (tier) {
    result.items = tiers[tier];
  } else {
    result.tiers = tiers;
    result.tierCounts = Object.fromEntries(TIER_ORDER.map((entry) => [entry, tiers[entry].length]));
  }

  return result;
}

function catalog(req) {
  const origin = `https://${req.headers.host || "bg.kolodahearthstone.ru"}`;
  return {
    name: "Manacost Battleground public tier-list API",
    baseUrl: `${origin}/api/tier-lists`,
    lists: Object.entries(LISTS).map(([key, config]) => ({
      key,
      label: config.label,
      defaultSource: config.source,
      tierMode: config.tierMode,
      itemField: config.field
    })),
    tiers: TIER_ORDER,
    examples: {
      hsreplayStrategySTier: `${origin}/api/tier-lists?list=strategies&source=hsreplay&tier=S`,
      firestoneStrategyAllTiers: `${origin}/api/tier-lists?list=strategies&source=firestone`,
      trinketATier: `${origin}/api/tier-lists?list=trinkets&tier=A`,
      allDefaultTierLists: `${origin}/api/tier-lists?list=all`
    }
  };
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "tier-lists", 60, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || "/", "http://localhost");
    const list = parseList(url.searchParams.get("list"));
    const tier = parseTier(url.searchParams.get("tier"));
    const source = parseSource(url.searchParams.get("source"), "firestone");

    if (!list) {
      sendJson(res, 200, catalog(req), {
        ifNoneMatch: req.headers["if-none-match"],
        cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
      });
      return;
    }

    if (list === "all") {
      const entries = await Promise.all(Object.keys(LISTS).map(async (listKey) => {
        const payload = await buildList(listKey, {
          source: listKey === "strategies" ? source : undefined,
          tier
        }, req);
        return [listKey, payload];
      }));
      sendJson(res, 200, {
        generatedAt: new Date().toISOString(),
        tier: tier || null,
        strategySource: source,
        lists: Object.fromEntries(entries)
      }, {
        ifNoneMatch: req.headers["if-none-match"],
        cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
      });
      return;
    }

    const payload = await buildList(list, { source, tier }, req);
    sendJson(res, 200, payload, {
      ifNoneMatch: req.headers["if-none-match"],
      cacheControl: "public, s-maxage=10800, stale-while-revalidate=86400"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Не удалось собрать публичный tier-list API.",
      details: error.message
    }, {
      cacheControl: "no-store"
    });
  }
};
