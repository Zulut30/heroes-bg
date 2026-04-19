#!/usr/bin/env node
/**
 * Best-effort scraper for Battlegrounds comp tier lists.
 *
 * Targets:
 *  - https://www.firestoneapp.com/battlegrounds/comps?rank=25
 *  - https://hsreplay.net/battlegrounds/comps/
 *
 * Both sites are SPAs whose actual data is fetched from JSON APIs the
 * page calls at runtime. The fastest reliable route is to ask those
 * APIs directly when we know them, otherwise fall back to parsing the
 * embedded `__NEXT_DATA__` / window state script tag in the HTML.
 *
 * Output: writes ./comps.json with the merged + normalized payload.
 * The frontend reads ./comps.json directly — no API server needed.
 *
 * Usage:
 *   node scripts/scrape-comps.js          # write comps.json from live sources
 *   node scripts/scrape-comps.js --dry    # print to stdout, don't overwrite
 */

const fs = require("fs");
const path = require("path");

const FIRESTONE_PAGE = "https://www.firestoneapp.com/battlegrounds/comps?rank=25";
const HSREPLAY_PAGE = "https://hsreplay.net/battlegrounds/comps/";
// Firestone publishes its precomputed comp data in S3 (URL observed via the
// page's network panel). If the static URL changes, fall back to scraping the
// HTML's __NEXT_DATA__.
const FIRESTONE_DATA_URL = "https://static.zerotoheroes.com/api/bgs/meta-comps.json";

const OUTPUT_PATH = path.resolve(__dirname, "..", "comps.json");
const dryRun = process.argv.includes("--dry");

const TIERS = ["S", "A", "B", "C", "D"];
const DIFFICULTY_NORMAL = (value) => {
  const lower = String(value || "").toLowerCase();
  if (lower.startsWith("e")) return "Easy";
  if (lower.startsWith("h")) return "Hard";
  return "Medium";
};

async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 BattlegroundsHub/1.0 (+https://github.com/Zulut30/heroes-bg)",
        Accept: "application/json,text/html;q=0.9",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      console.warn(`[${url}] HTTP ${response.status}`);
      return null;
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return { type: "json", payload: await response.json() };
    }
    return { type: "text", payload: await response.text() };
  } catch (error) {
    console.warn(`[${url}] fetch error: ${error.message}`);
    return null;
  }
}

function extractNextData(html) {
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.warn("Failed to parse __NEXT_DATA__:", error.message);
    return null;
  }
}

// Try a few common shapes; skip silently if nothing matches so we don't
// stomp on a working comps.json with garbage.
function normalizeFirestone(payload) {
  if (!payload) return [];
  // Newer Firestone snapshots ship as { lastUpdateDate, mmrPercentile, dataPoints, comps: [...] }
  const compsList = payload.comps || payload.data?.comps || [];
  if (!Array.isArray(compsList) || !compsList.length) return [];

  return compsList.map((comp) => {
    const tier = (comp.tier || comp.placement || "B").toUpperCase();
    const cards = (comp.coreCards || comp.cards || comp.coreMinions || []).slice(0, 6).map((card) => ({
      id: String(card.cardId || card.id || ""),
      name: card.name || ""
    })).filter((c) => c.id);
    const trendValue = comp.trend || comp.delta || 0;
    return {
      tier: TIERS.includes(tier) ? tier : "B",
      race: (comp.tribe || comp.minionTribe || comp.race || "NONE").toUpperCase(),
      name: comp.name || comp.title || "",
      subtitle: comp.englishName || comp.shortName || "",
      summary: comp.description || comp.flavor || "",
      difficulty: DIFFICULTY_NORMAL(comp.difficulty),
      trend: trendValue > 0 ? "up" : trendValue < 0 ? "down" : "stable",
      cards,
      source: "firestone"
    };
  }).filter((c) => c.name);
}

function normalizeHsreplay(html) {
  // HSReplay renders comps server-side into a script tag with id="comp_list"
  // (legacy) or as a Redux store dump. Try both.
  const reduxMatch = html && html.match(/window\.__INITIAL_DATA__\s*=\s*(\{[\s\S]*?\});/);
  if (!reduxMatch) return [];
  let data;
  try {
    data = JSON.parse(reduxMatch[1]);
  } catch (error) {
    console.warn("Failed to parse HSReplay state:", error.message);
    return [];
  }
  const compsList = data?.battlegrounds?.comps || data?.comps || [];
  if (!Array.isArray(compsList) || !compsList.length) return [];

  return compsList.map((comp) => {
    const tier = (comp.tier || "B").toUpperCase();
    const cards = (comp.coreCards || comp.cards || []).slice(0, 6).map((card) => ({
      id: String(card.dbfId || card.cardId || card.id || ""),
      name: card.name || ""
    })).filter((c) => c.id);
    return {
      tier: TIERS.includes(tier) ? tier : "B",
      race: (comp.race || "NONE").toUpperCase(),
      name: comp.title || comp.name || "",
      subtitle: comp.subtitle || "",
      summary: comp.description || "",
      difficulty: DIFFICULTY_NORMAL(comp.difficulty),
      trend: "stable",
      cards,
      source: "hsreplay"
    };
  }).filter((c) => c.name);
}

function mergeComps(...lists) {
  const seen = new Map();
  const out = [];
  for (const list of lists) {
    for (const comp of list) {
      const key = `${comp.race}:${comp.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.set(key, true);
      out.push(comp);
    }
  }
  return out;
}

function readExisting() {
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  } catch {
    return null;
  }
}

(async function main() {
  console.log("Fetching Firestone comp data...");
  const firestoneData = await safeFetch(FIRESTONE_DATA_URL);
  let firestoneComps = firestoneData && firestoneData.type === "json"
    ? normalizeFirestone(firestoneData.payload)
    : [];

  if (!firestoneComps.length) {
    console.log("Firestone JSON empty or unavailable, trying page HTML…");
    const firestonePage = await safeFetch(FIRESTONE_PAGE);
    if (firestonePage && firestonePage.type === "text") {
      const next = extractNextData(firestonePage.payload);
      firestoneComps = normalizeFirestone(next?.props?.pageProps || {});
    }
  }
  console.log(`Firestone comps: ${firestoneComps.length}`);

  console.log("Fetching HSReplay comp page...");
  const hsreplayPage = await safeFetch(HSREPLAY_PAGE);
  let hsreplayComps = [];
  if (hsreplayPage && hsreplayPage.type === "text") {
    hsreplayComps = normalizeHsreplay(hsreplayPage.payload);
  }
  console.log(`HSReplay comps: ${hsreplayComps.length}`);

  const merged = mergeComps(firestoneComps, hsreplayComps);

  if (!merged.length) {
    console.warn("No comps scraped. Existing comps.json left untouched.");
    process.exit(firestoneComps.length === 0 && hsreplayComps.length === 0 ? 1 : 0);
  }

  const existing = readExisting();
  const payload = {
    source: "live",
    updatedAt: new Date().toISOString().slice(0, 10),
    sources: [FIRESTONE_PAGE, HSREPLAY_PAGE],
    tiers: TIERS,
    comps: merged
  };

  if (dryRun) {
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    return;
  }

  if (existing && existing.source === "curated" && process.env.PRESERVE_CURATED === "1") {
    console.log("PRESERVE_CURATED=1 set, leaving curated comps.json in place.");
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${merged.length} comps to ${OUTPUT_PATH}`);
})();
