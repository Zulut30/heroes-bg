const { rateLimit } = require("./_blizzard");

const inFlight = new Map();

module.exports = async function handler(req, res) {
  const id = String(req.query.id || "").trim();
  const locale = String(req.query.locale || "ruRU").trim();
  const size = String(req.query.size || "256x").trim();

  if (!id) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Missing card id" }));
    return;
  }

  // Generous rate limit: card art is the most-hit endpoint (one per card on
  // any builder render). 600/min/IP is well above any honest user but blocks
  // a runaway scraper from exhausting upstream.
  const limit = rateLimit(req, "card-art", 600, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  const upstreamUrl = `https://art.hearthstonejson.com/v1/bgs/latest/${encodeURIComponent(locale)}/${encodeURIComponent(size)}/${encodeURIComponent(id)}.png`;
  const cacheKey = upstreamUrl;

  try {
    let upstreamPromise = inFlight.get(cacheKey);
    if (!upstreamPromise) {
      upstreamPromise = fetch(upstreamUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 Codex Battlegrounds Hub"
        }
      }).then(async (upstream) => {
        if (!upstream.ok) {
          return { ok: false, status: upstream.status };
        }
        const contentType = upstream.headers.get("content-type") || "image/png";
        const buffer = Buffer.from(await upstream.arrayBuffer());
        return { ok: true, contentType, buffer };
      }).finally(() => {
        // Hold in-flight only for the duration of the network call so memory
        // stays bounded; the CDN/browser cache handles the rest.
        inFlight.delete(cacheKey);
      });
      inFlight.set(cacheKey, upstreamPromise);
    }

    const result = await upstreamPromise;
    if (!result.ok) {
      res.statusCode = result.status;
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Upstream image fetch failed", status: result.status }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Vary", "Accept-Encoding");
    res.end(result.buffer);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Proxy request failed", details: error.message }));
  }
};
