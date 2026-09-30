const crypto = require("crypto");
const security = require("./security");

function getEnv(name, fallback) {
  return security.getEnv(name, fallback);
}

function getJkClient() {
  return {
    id: "jk-bestcarwash",
    email: getEnv("CLIENT_JK_EMAIL", "jk@bestcarwash.fi").toLowerCase(),
    password: getEnv("CLIENT_JK_PASSWORD", ""),
    name: getEnv("CLIENT_JK_NAME", "JK Best Carwash"),
    domain: getEnv("CLIENT_JK_DOMAIN", "https://www.jk-bestcarwash.com"),
    projectId: getEnv("CLIENT_JK_PROJECT_ID", ""),
    teamId: getEnv("CLIENT_JK_TEAM_ID", getEnv("VERCEL_TEAM_ID", "")),
  };
}

function getLumiaClient() {
  return {
    id: "lumia-autofix",
    email: getEnv("CLIENT_LUMIA_EMAIL", "lumia@fixbest.fi").toLowerCase(),
    password: getEnv("CLIENT_LUMIA_PASSWORD", ""),
    name: getEnv("CLIENT_LUMIA_NAME", "Lumia Autofix"),
    domain: getEnv("CLIENT_LUMIA_DOMAIN", "https://www.fixbest.fi"),
    projectId: getEnv("CLIENT_LUMIA_PROJECT_ID", ""),
    teamId: getEnv("CLIENT_LUMIA_TEAM_ID", getEnv("VERCEL_TEAM_ID", "")),
  };
}

function listClients() {
  return [getJkClient(), getLumiaClient()];
}

function findClientByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  var clients = listClients();
  for (var i = 0; i < clients.length; i++) {
    if (normalized === clients[i].email) {
      return clients[i];
    }
  }
  return null;
}

function getAuthSecret() {
  return getEnv("AUTH_SECRET", "");
}

function signSession(payload) {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET missing");
  }
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}

function verifySession(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) {
    return null;
  }
  const secret = getAuthSecret();
  if (!secret) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const body = parts[0];
  const sig = parts[1];
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  if (match) {
    return match[1].trim();
  }
  return "";
}

module.exports = {
  getEnv,
  getJkClient,
  getLumiaClient,
  listClients,
  findClientByEmail,
  getAuthSecret,
  signSession,
  verifySession,
  readBearerToken,
  setCors: security.setCors,
  sendJson: security.sendJson,
  parseBody: security.parseBody,
  getClientIp: security.getClientIp,
  checkRateLimit: security.checkRateLimit,
  passwordsMatch: security.passwordsMatch,
  rateLimitResponse: security.rateLimitResponse,
  setApiSecurityHeaders: security.setApiSecurityHeaders,
};
