const {
  findClientByEmail,
  getAuthSecret,
  signSession,
  setCors,
  sendJson,
  parseBody,
} = require("../lib/portal-auth");

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
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
    body = await parseBody(req);
  } catch (e) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  var email = String(body.email || "").trim().toLowerCase();
  var password = String(body.password || "");
  var client = findClientByEmail(email);

  if (!client || !client.password || password !== client.password) {
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
