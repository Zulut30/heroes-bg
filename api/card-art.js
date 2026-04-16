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

  const upstreamUrl = `https://art.hearthstonejson.com/v1/bgs/latest/${encodeURIComponent(locale)}/${encodeURIComponent(size)}/${encodeURIComponent(id)}.png`;

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
