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

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 Codex Battlegrounds Hub"
      }
    });

    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Upstream image fetch failed", status: upstream.status }));
      return;
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    const arrayBuffer = await upstream.arrayBuffer();

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Proxy request failed", details: error.message }));
  }
};
