const crypto = require("crypto");

var memoryBuckets = new Map();

function getEnv(name, fallback) {
  var value = process.env[name];
  if (value == null || value === "") return fallback;
  return String(value).trim();
}

function getClientIp(req) {
  var forwarded = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"] || "";
  if (forwarded) {
    return String(forwarded).split(",")[0].trim().slice(0, 80);
  }
  return String(
    req.headers["x-real-ip"] ||
      (req.socket && req.socket.remoteAddress) ||
      "unknown"
  ).slice(0, 80);
}

function memoryRateLimit(key, limit, windowMs) {
  var now = Date.now();
  var entry = memoryBuckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    memoryBuckets.set(key, { start: now, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.start + windowMs - now) / 1000),
    };
  }
  entry.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - entry.count) };
}

async function upstashRateLimit(key, limit, windowSec) {
  var base = getEnv("UPSTASH_REDIS_REST_URL", "");
  var token = getEnv("UPSTASH_REDIS_REST_TOKEN", "");
  if (!base || !token) return null;

  var redisKey = "sivux:rl:" + key;
  try {
    var incrRes = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["INCR", redisKey]),
    });
    if (!incrRes.ok) return null;
    var incrData = await incrRes.json().catch(function () {
      return {};
    });
    var count = Number(incrData.result) || 0;
    if (count === 1) {
      await fetch(base, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EXPIRE", redisKey, String(windowSec)]),
      }).catch(function () {});
    }
    if (count > limit) {
      return { allowed: false, remaining: 0, retryAfterSec: windowSec };
    }
    return { allowed: true, remaining: Math.max(0, limit - count) };
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} bucket e.g. "audit" | "login"
 * @param {string} id usually IP
 * @param {{ limit: number, windowMs?: number, windowSec?: number }} opts
 */
async function checkRateLimit(bucket, id, opts) {
  var limit = (opts && opts.limit) || 30;
  var windowMs = (opts && opts.windowMs) || 60 * 60 * 1000;
  var windowSec = (opts && opts.windowSec) || Math.ceil(windowMs / 1000);
  var key = String(bucket || "api") + ":" + String(id || "unknown");

  var remote = await upstashRateLimit(key, limit, windowSec);
  if (remote) return remote;
  return memoryRateLimit(key, limit, windowMs);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  var o = String(origin).toLowerCase();
  var allow = [
    "https://sivux.fi",
    "https://www.sivux.fi",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
  if (allow.indexOf(o) !== -1) return true;
  // Vercel preview deployments for this project
  if (/^https:\/\/sivux[a-z0-9-]*\.vercel\.app$/i.test(o)) return true;
  if (/^https:\/\/[a-z0-9-]+-handleri655[a-z0-9-]*\.vercel\.app$/i.test(o)) return true;
  return false;
}

function setCors(res, req) {
  var origin = (req && (req.headers.origin || req.headers.Origin)) || "";
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    // Non-browser / same-origin style clients
    res.setHeader("Access-Control-Allow-Origin", "https://sivux.fi");
  }
  // If disallowed origin: omit ACAO → browser blocks cross-site calls
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function setApiSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(res, status, data) {
  setApiSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function parseBody(req, options) {
  var maxBytes = (options && options.maxBytes) || 100 * 1024;
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    var chunks = [];
    var size = 0;
    var aborted = false;
    req.on("data", function (chunk) {
      if (aborted) return;
      size += chunk.length;
      if (size > maxBytes) {
        aborted = true;
        var err = new Error("Payload too large");
        err.status = 413;
        reject(err);
        try {
          req.destroy();
        } catch (e) {}
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (aborted) return;
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function passwordsMatch(provided, expected) {
  var a = Buffer.from(String(provided || ""), "utf8");
  var b = Buffer.from(String(expected || ""), "utf8");
  if (!expected) {
    // Dummy compare to keep timing flatter
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  if (a.length !== b.length) {
    var dummy = crypto.createHash("sha256").update(a).digest();
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function rateLimitResponse(res, result) {
  if (result && result.retryAfterSec) {
    res.setHeader("Retry-After", String(result.retryAfterSec));
  }
  sendJson(res, 429, {
    error: "Liian monta pyyntöä. Kokeile myöhemmin uudelleen.",
    retryAfterSec: (result && result.retryAfterSec) || 60,
  });
}

module.exports = {
  getEnv,
  getClientIp,
  checkRateLimit,
  isAllowedOrigin,
  setCors,
  setApiSecurityHeaders,
  sendJson,
  parseBody,
  passwordsMatch,
  rateLimitResponse,
};
