const { rateLimit } = require("./_blizzard");

// Strict allow-list so this endpoint can't be turned into an open proxy.
const ALLOWED_HOST_PATTERNS = [
  /(?:^|\.)firestoneapp\.com$/i,
  /(?:^|\.)zerotoheroes\.com$/i,
  /(?:^|\.)hsreplay\.net$/i,
  /(?:^|\.)hearthsim\.net$/i,
  /(?:^|\.)hearthstone-decks\.net$/i,
  /(?:^|\.)bobsbuddy\.net$/i
];

function isAllowed(hostname) {
  return ALLOWED_HOST_PATTERNS.some((re) => re.test(String(hostname || "").toLowerCase()));
}

module.exports = async function handler(req, res) {
  const limit = rateLimit(req, "comps-fetch", 30, 60_000);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
    res.end();
    return;
  }

  const raw = String(req.query?.url || "").trim();
  if (!raw) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Missing ?url=" }));
    return;
  }

  let target;
  try {
    target = new URL(raw);
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Invalid URL" }));
    return;
  }

  if (target.protocol !== "https:" || !isAllowed(target.hostname)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      error: "Этот хост не разрешён для прокси.",
      allowed: ALLOWED_HOST_PATTERNS.map((re) => String(re).slice(1, -2))
    }));
    return;
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36",
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br"
      }
    });

    const contentType = upstream.headers.get("content-type") || "";
    const body = await upstream.text();
    res.statusCode = upstream.ok ? 200 : 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
      ok: upstream.ok,
      status: upstream.status,
      url: target.toString(),
      contentType,
      length: body.length,
      body
    }));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Upstream fetch failed", details: error.message }));
  }
};
