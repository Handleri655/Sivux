/**
 * Local static + portal API server for Sivux (port 8080).
 * Usage: node server.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      return;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const loginHandler = require("./api/login");
const metricsHandler = require("./api/metrics");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function send(res, status, body, headers) {
  res.writeHead(status, headers || {});
  res.end(body);
}

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(ROOT, cleaned);
  if (!full.startsWith(ROOT)) {
    return null;
  }
  return full;
}

function serveStatic(req, res, urlPath) {
  let filePath = safeJoin(urlPath);
  if (!filePath) {
    send(res, 400, "Bad request");
    return;
  }

  if (urlPath === "/asiakas" || urlPath === "/asiakas/") {
    filePath = path.join(ROOT, "asiakas", "index.html");
  } else if (urlPath === "/asiakas/dashboard" || urlPath === "/asiakas/dashboard/") {
    filePath = path.join(ROOT, "asiakas", "dashboard.html");
  } else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  send(res, 200, fs.readFileSync(filePath), {
    "Content-Type": type,
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=60",
  });
}

function attachQuery(req, requestUrl) {
  const query = {};
  requestUrl.searchParams.forEach(function (value, key) {
    query[key] = value;
  });
  req.query = query;
}

const server = http.createServer(async function (req, res) {
  try {
    const requestUrl = new URL(req.url || "/", "http://localhost:" + PORT);
    const pathname = requestUrl.pathname;
    attachQuery(req, requestUrl);

    if (pathname === "/api/login") {
      await loginHandler(req, res);
      return;
    }
    if (pathname === "/api/metrics") {
      await metricsHandler(req, res);
      return;
    }

    serveStatic(req, res, pathname === "/" ? "/index.html" : pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      send(res, 500, "Server error");
    }
  }
});

server.listen(PORT, function () {
  console.log("Sivux local server: http://localhost:" + PORT);
  console.log("Asiakasportaali:    http://localhost:" + PORT + "/asiakas");
  if (!process.env.AUTH_SECRET) {
    console.log("Note: AUTH_SECRET not set — create .env from .env.example for login/API.");
  }
});
