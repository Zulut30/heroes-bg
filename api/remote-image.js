const { rateLimit } = require("./_blizzard");

const ALLOWED_HOST_PATTERNS = [
  /(?:^|\.)blizzard\.com$/i,
  /(?:^|\.)battle\.net$/i,
  /(?:^|\.)hearthstonejson\.com$/i,
  /(?:^|\.)akamaized\.net$/i,
  /(?:^|\.)cloudfront\.net$/i
];

function isAllowedHost(hostname = "") {
  return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(String(hostname).toLowerCase()));
}

const inFlight = new Map();

module.exports = async function handler(req, res) {
  const source = String(req.query.src || "").trim();

  if (!source) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Missing src parameter" }));
    return;
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(source);
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Invalid image URL" }));
    return;
  }

  if (upstreamUrl.protocol !== "https:" || !isAllowedHost(upstreamUrl.hostname)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Image host is not allowed" }));
    return;
  }

  const limit = rateLimit(req, "remote-image", 600, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  try {
    const cacheKey = upstreamUrl.toString();
    let upstreamPromise = inFlight.get(cacheKey);
    if (!upstreamPromise) {
      upstreamPromise = fetch(upstreamUrl, {
        headers: { "User-Agent": "Mozilla/5.0 Codex Battlegrounds Hub" }
      }).then(async (upstream) => {
        if (!upstream.ok) return { ok: false, status: upstream.status };
        const contentType = upstream.headers.get("content-type") || "image/png";
        const buffer = Buffer.from(await upstream.arrayBuffer());
        return { ok: true, contentType, buffer };
      }).finally(() => inFlight.delete(cacheKey));
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
