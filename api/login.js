const {
  findClientByEmail,
  getAuthSecret,
  signSession,
  setCors,
  sendJson,
  parseBody,
  getClientIp,
  checkRateLimit,
  passwordsMatch,
  rateLimitResponse,
} = require("../lib/portal-auth");

module.exports = async function handler(req, res) {
  setCors(res, req);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  var ip = getClientIp(req);
  var limited = await checkRateLimit("login", ip, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    rateLimitResponse(res, limited);
    return;
  }

  if (!getAuthSecret()) {
    sendJson(res, 500, {
      error: "Portal not configured",
      hint: "Set AUTH_SECRET in Vercel environment variables.",
    });
    return;
  }

  var body;
  try {
    body = await parseBody(req, { maxBytes: 8 * 1024 });
  } catch (e) {
    sendJson(res, e.status || 400, {
      error: e.status === 413 ? "Pyyntö liian suuri" : "Invalid JSON body",
    });
    return;
  }

  var email = String(body.email || "").trim().toLowerCase();
  var password = String(body.password || "");
  var client = findClientByEmail(email);
  var passwordOk = client && passwordsMatch(password, client.password);

  if (!client || !client.password || !passwordOk) {
    sendJson(res, 401, { error: "Virheellinen sähköposti tai salasana" });
    return;
  }

  if (!client.projectId) {
    sendJson(res, 500, {
      error: "Client project not configured",
      hint: "Set CLIENT_*_PROJECT_ID in environment variables.",
    });
    return;
  }

  var token = signSession({
    sub: client.id,
    email: client.email,
    name: client.name,
    domain: client.domain,
    projectId: client.projectId,
    teamId: client.teamId || "",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });

  sendJson(res, 200, {
    token: token,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      domain: client.domain,
    },
  });
};
