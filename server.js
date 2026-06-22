const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const rootDir = __dirname;
const apiDir = path.join(rootDir, "api");
const port = Number(process.env.PORT || 3107);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function serveFile(req, res, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  let filePath = path.join(rootDir, decodedPath === "/" ? "index.html" : decodedPath);

  if (!isPathInside(filePath, rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    };

    if (/^\/(?:heroes_bg|assset|%D0%90%D0%BA%D1%81%D0%B5%D1%81%D1%81%D1%83%D0%B0%D1%80%D1%8B)\//.test(req.url)
      || /^\/(?:wallpaper.*\.(?:jpg|webp)|font\.otf|favicon\.svg)(?:\?|$)/.test(req.url)) {
      headers["Cache-Control"] = "public, max-age=604800, stale-while-revalidate=86400";
    }

    res.writeHead(200, headers);
    res.end(data);
  });
}

async function serveApi(req, res, url) {
  const match = url.pathname.match(/^\/api\/([^/]+)\/?$/);
  if (!match) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "API route not found" }));
    return;
  }

  const apiPath = path.join(apiDir, `${match[1]}.js`);
  if (!isPathInside(apiPath, apiDir) || !fs.existsSync(apiPath)) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "API route not found" }));
    return;
  }

  req.query = Object.fromEntries(url.searchParams.entries());

  try {
    const handler = require(apiPath);
    await handler(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ error: "Internal server error", details: error.message }));
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    serveApi(req, res, url);
    return;
  }

  serveFile(req, res, url.pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`heroes-bg listening on http://127.0.0.1:${port}`);
});
