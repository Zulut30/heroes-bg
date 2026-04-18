const fs = require("fs");
const path = require("path");

const TOKEN_URL = "https://oauth.battle.net/token";
const API_ROOT = "https://us.api.blizzard.com/hearthstone";

let cachedEnv = null;

function loadDotEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const parsed = {};
    const raw = fs.readFileSync(candidate, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      parsed[key] = value.replace(/^['"]|['"]$/g, "");
    }

    cachedEnv = parsed;
    return cachedEnv;
  }

  cachedEnv = {};
  return cachedEnv;
}

function getEnv(name, fallback = "") {
  return process.env[name] || loadDotEnv()[name] || fallback;
}

function normalizeLocale(locale = "") {
  if (!locale) {
    return getEnv("BLIZZARD_LOCALE", "ru_RU");
  }

  const compact = String(locale).trim();
  if (/^[a-z]{2}[A-Z]{2}$/.test(compact)) {
    return `${compact.slice(0, 2)}_${compact.slice(2)}`;
  }

  return compact.replace("-", "_");
}

function getRegion() {
  return String(getEnv("BLIZZARD_REGION", "us")).trim().toLowerCase() || "us";
}

// In-memory cache shared between requests on the same warm instance.
// Tokens last ~24h from Blizzard; we refresh slightly earlier to be safe.
const TOKEN_SAFETY_MS = 60_000; // refresh 1 min before real expiry
let cachedToken = null; // { token, expiresAt }
let inFlightToken = null;

// Generic JSON response cache. Map<url, { expiresAt, payload }>
const RESPONSE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const responseCache = new Map();
const inFlightRequests = new Map();

function cacheGet(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    map.delete(key);
    return null;
  }
  return entry;
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - TOKEN_SAFETY_MS > now) {
    return cachedToken.token;
  }
  if (inFlightToken) {
    return inFlightToken;
  }

  const clientId = getEnv("BLIZZARD_CLIENT_ID");
  const clientSecret = getEnv("BLIZZARD_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Blizzard credentials are missing. Check .env or platform environment variables.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  inFlightToken = (async () => {
    try {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const ttlMs = (Number(data.expires_in) || 86400) * 1000;
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + ttlMs
      };
      return data.access_token;
    } finally {
      inFlightToken = null;
    }
  })();

  return inFlightToken;
}

async function fetchBlizzardJson(resource, params = {}) {
  const locale = normalizeLocale(params.locale);
  const region = getRegion();
  const url = new URL(`${API_ROOT}${resource}`);

  url.searchParams.set("locale", locale);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (key === "locale") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  const cacheKey = `${region}:${url.toString()}`;
  const cached = cacheGet(responseCache, cacheKey);
  if (cached) {
    return cached.payload;
  }

  // Coalesce concurrent identical requests: only one upstream call in flight
  // per cacheKey, every other caller awaits the same Promise.
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Battlenet-Namespace": `static-${region}`,
          "User-Agent": "Codex Battlegrounds Hub"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Blizzard API request failed: ${response.status} ${errorText}`);
      }

      const payload = await response.json();
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + RESPONSE_TTL_MS,
        payload
      });
      return payload;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

function buildEtag(payload) {
  // Lightweight ETag: hash via stable JSON length + first 64 chars; sufficient
  // to let the browser short-circuit identical responses with 304.
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  let hash = 5381;
  for (let i = 0; i < serialized.length; i += 1) {
    hash = ((hash << 5) + hash) ^ serialized.charCodeAt(i);
  }
  return `W/"${(hash >>> 0).toString(16)}-${serialized.length}"`;
}

function sendJson(res, statusCode, payload, options = {}) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", options.cacheControl || "public, s-maxage=1800, stale-while-revalidate=86400");
  res.setHeader("Vary", "Accept-Encoding");
  if (statusCode === 200) {
    const etag = buildEtag(payload);
    res.setHeader("ETag", etag);
    const ifNoneMatch = options.ifNoneMatch;
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }
  }
  res.end(JSON.stringify(payload));
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    return String(fwd).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

const rateLimitBuckets = new Map();
function rateLimit(req, key, limit = 60, windowMs = 60_000) {
  const ip = clientIp(req);
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

module.exports = {
  fetchBlizzardJson,
  normalizeLocale,
  sendJson,
  rateLimit,
  buildEtag
};
