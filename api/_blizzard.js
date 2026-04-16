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

async function getAccessToken() {
  const clientId = getEnv("BLIZZARD_CLIENT_ID");
  const clientSecret = getEnv("BLIZZARD_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Blizzard credentials are missing. Check .env or platform environment variables.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
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
  return data.access_token;
}

async function fetchBlizzardJson(resource, params = {}) {
  const token = await getAccessToken();
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

  return response.json();
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
  res.end(JSON.stringify(payload));
}

module.exports = {
  fetchBlizzardJson,
  normalizeLocale,
  sendJson
};
