const {
  setCors,
  sendJson,
  parseBody,
  getEnv,
} = require("../lib/portal-auth");
const { normalizeEmail, captureAuditLead } = require("../lib/audit-leads");

var CUSTOMER_AUTOREPLY =
  "Kiitos yhteydenotostasi!\n\n" +
  "Olemme vastaanottaneet tarjouspyyntösi sivustoanalyysin perusteella ja olemme sinuun yhteydessä mahdollisimman nopeasti.\n\n" +
  "Ystävällisin terveisin,\nSivux\ninfo@sivux.fi\n+358 41 4967337";

async function notifyQuoteRequest(payload) {
  var notifyTo = getEnv("AUDIT_LEAD_EMAIL", getEnv("LEAD_NOTIFY_EMAIL", "info@sivux.fi"));
  var response = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(notifyTo), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: "Tarjouspyyntö sivustoanalyysista",
      _template: "table",
      _autoresponse: CUSTOMER_AUTOREPLY,
      email: payload.email,
      url: payload.url,
      score: payload.score != null ? String(payload.score) : "",
      score_label: payload.scoreLabel || "",
      top_fixes: payload.topFixesText || "",
      critical: payload.criticalText || "",
      message:
        "Asiakas pyysi tarjousta sivustoanalyysin jälkeen.\n\n" +
        "Sähköposti: " +
        payload.email +
        "\nSivusto: " +
        payload.url +
        "\nPisteet: " +
        (payload.score != null ? payload.score + "/100" : "n/a") +
        "\n\nTop-korjaukset:\n" +
        (payload.topFixesText || "-") +
        "\n\nKriittiset:\n" +
        (payload.criticalText || "-"),
    }),
  });

  if (!response.ok) {
    var text = await response.text().catch(function () {
      return "";
    });
    var err = new Error("Tarjouspyynnön lähetys epäonnistui");
    err.status = 502;
    err.detail = text.slice(0, 200);
    throw err;
  }
  return true;
}

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

  var body;
  try {
    body = await parseBody(req);
  } catch (e) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  if (body && body.website) {
    sendJson(res, 200, { ok: true });
    return;
  }

  var email = normalizeEmail(body && body.email);
  var url = String((body && body.url) || "").trim().slice(0, 500);
  if (!email) {
    sendJson(res, 400, { error: "Sähköposti puuttuu" });
    return;
  }
  if (!url) {
    sendJson(res, 400, { error: "Sivuston osoite puuttuu" });
    return;
  }

  var score = typeof body.score === "number" ? body.score : Number(body.score);
  if (!isFinite(score)) score = null;

  var topFixes = Array.isArray(body.topFixes) ? body.topFixes : [];
  var critical = Array.isArray(body.critical) ? body.critical : [];
  var topFixesText = topFixes
    .map(function (fix, i) {
      if (!fix) return "";
      if (typeof fix === "string") return i + 1 + ". " + fix;
      return i + 1 + ". " + (fix.title || "") + (fix.how ? " — " + fix.how : "");
    })
    .filter(Boolean)
    .join("\n");
  var criticalText = critical
    .map(function (item) {
      return "- " + String(item);
    })
    .join("\n");

  try {
    await notifyQuoteRequest({
      email: email,
      url: url,
      score: score,
      scoreLabel: String((body && body.scoreLabel) || ""),
      topFixesText: topFixesText,
      criticalText: criticalText,
    });

    await captureAuditLead({
      type: "quote_request",
      email: email,
      url: url,
      requestedUrl: url,
      score: score,
      scoreLabel: String((body && body.scoreLabel) || ""),
      engine: "quote-request",
      analyzedAt: new Date().toISOString(),
      skipNotify: true,
    });

    sendJson(res, 200, {
      ok: true,
      message:
        "Kiitos yhteydenotosta! Olemme teihin yhteydessä mahdollisimman nopeasti.",
    });
  } catch (e) {
    console.error("audit quote error:", e && e.message ? e.message : e, e && e.detail);
    sendJson(res, e.status || 502, {
      error: e.message || "Tarjouspyynnön lähetys epäonnistui",
    });
  }
};
