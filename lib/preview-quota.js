const fs = require("fs");
const path = require("path");
const { getEnv } = require("./portal-auth");
const { normalizeEmail } = require("./audit-leads");

var memoryUsed = new Set();

/** Built-in allowlist — unlimited demos for local/ops testing */
var DEFAULT_TEST_EMAILS = ["juliushursti@gmail.com"];

function getTestEmails() {
  var fromEnv = String(getEnv("PREVIEW_TEST_EMAILS", "") || "")
    .split(/[,;\s]+/)
    .map(function (item) {
      return normalizeEmail(item);
    })
    .filter(Boolean);
  var set = {};
  DEFAULT_TEST_EMAILS.concat(fromEnv).forEach(function (email) {
    if (email) set[email] = true;
  });
  return set;
}

function isTestEmail(rawEmail) {
  var email = normalizeEmail(rawEmail);
  if (!email) return false;
  return Boolean(getTestEmails()[email]);
}

function storePath() {
  var localDir = path.join(__dirname, "..", "data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return path.join(localDir, "preview-used-emails.json");
  } catch (e) {
    return path.join("/tmp", "sivux-preview-used-emails.json");
  }
}

function readFileStore() {
  try {
    var raw = fs.readFileSync(storePath(), "utf8");
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // missing or invalid
  }
  return {};
}

function writeFileStore(map) {
  try {
    fs.writeFileSync(storePath(), JSON.stringify(map, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("preview quota file write failed:", e && e.message ? e.message : e);
    return false;
  }
}

async function redisGet(email) {
  var base = getEnv("UPSTASH_REDIS_REST_URL", "");
  var token = getEnv("UPSTASH_REDIS_REST_TOKEN", "");
  if (!base || !token) return null;
  var key = "sivux:preview:" + email;
  var response = await fetch(base + "/get/" + encodeURIComponent(key), {
    headers: { Authorization: "Bearer " + token },
  });
  if (!response.ok) return null;
  var data = await response.json().catch(function () {
    return {};
  });
  return data.result != null ? String(data.result) : null;
}

async function redisSetNx(email, value) {
  var base = getEnv("UPSTASH_REDIS_REST_URL", "");
  var token = getEnv("UPSTASH_REDIS_REST_TOKEN", "");
  if (!base || !token) return null;
  var key = "sivux:preview:" + email;
  var response = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", key, value, "NX"]),
  });
  if (!response.ok) return null;
  var data = await response.json().catch(function () {
    return {};
  });
  return data.result === "OK";
}

function hasUsedLocally(email) {
  if (memoryUsed.has(email)) return true;
  var map = readFileStore();
  return Boolean(map[email]);
}

function markUsedLocally(email, meta) {
  memoryUsed.add(email);
  var map = readFileStore();
  map[email] = {
    at: new Date().toISOString(),
    url: (meta && meta.url) || "",
    previewUrl: (meta && meta.previewUrl) || "",
  };
  writeFileStore(map);
}

/**
 * Check if email already used — does not reserve.
 * Test emails are never treated as used.
 */
async function isPreviewEmailUsed(rawEmail) {
  var email = normalizeEmail(rawEmail);
  if (!email) return { used: true, reason: "invalid_email", email: "" };
  if (isTestEmail(email)) {
    return { used: false, email: email, test: true };
  }
  if (memoryUsed.has(email) || hasUsedLocally(email)) {
    return { used: true, reason: "already_used", email: email };
  }
  var redisVal = await redisGet(email);
  if (redisVal) {
    memoryUsed.add(email);
    return { used: true, reason: "already_used", email: email };
  }
  return { used: false, email: email };
}

/**
 * Returns { allowed: boolean, reason?: string }
 * Reserves the email when allowed (call after successful send, or for lock).
 * Test emails always allowed and not persisted to quota.
 */
async function claimPreviewEmail(rawEmail, meta) {
  var email = normalizeEmail(rawEmail);
  if (!email) {
    return { allowed: false, reason: "invalid_email", email: "" };
  }

  if (isTestEmail(email)) {
    return { allowed: true, email: email, test: true };
  }

  var used = await isPreviewEmailUsed(email);
  if (used.used) {
    return {
      allowed: false,
      reason: used.reason || "already_used",
      email: email,
      message: "Tällä sähköpostilla on jo luotu demosivu. Yksi demo / sähköposti.",
    };
  }

  var redisClaimed = await redisSetNx(
    email,
    JSON.stringify({
      at: new Date().toISOString(),
      url: (meta && meta.url) || "",
    })
  );
  if (redisClaimed === false) {
    return {
      allowed: false,
      reason: "already_used",
      email: email,
      message: "Tällä sähköpostilla on jo luotu demosivu. Yksi demo / sähköposti.",
    };
  }

  markUsedLocally(email, meta || {});
  return { allowed: true, email: email };
}

async function updatePreviewClaim(email, meta) {
  var normalized = normalizeEmail(email);
  if (!normalized) return;
  if (isTestEmail(normalized)) return;
  markUsedLocally(normalized, meta || {});
  var base = getEnv("UPSTASH_REDIS_REST_URL", "");
  var token = getEnv("UPSTASH_REDIS_REST_TOKEN", "");
  if (!base || !token) return;
  var key = "sivux:preview:" + normalized;
  try {
    await fetch(base, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "SET",
        key,
        JSON.stringify({
          at: new Date().toISOString(),
          url: (meta && meta.url) || "",
          previewUrl: (meta && meta.previewUrl) || "",
        }),
      ]),
    });
  } catch (e) {
    // ignore
  }
}

module.exports = {
  claimPreviewEmail,
  isPreviewEmailUsed,
  isTestEmail,
  updatePreviewClaim,
  hasUsedLocally,
};
