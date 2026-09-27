const { getEnv } = require("./portal-auth");

async function sendPreviewEmail(options) {
  var to = String((options && options.to) || "").trim().toLowerCase();
  var previewUrl = String((options && options.previewUrl) || "");
  var brand = String((options && options.brandName) || "yrityksenne");
  var sourceUrl = String((options && options.sourceUrl) || "");
  var score = options && options.score;
  var notifyTo = getEnv("AUDIT_LEAD_EMAIL", "info@sivux.fi");
  var resendKey = getEnv("RESEND_API_KEY", "");
  var from = getEnv("RESEND_FROM", "Sivux <info@sivux.fi>");

  if (!to || !previewUrl) {
    var missing = new Error("Sähköposti tai preview-URL puuttuu");
    missing.status = 400;
    throw missing;
  }

  if (!resendKey) {
    var cfg = new Error(
      "Sähköpostilähetys ei ole konfiguroitu. Aseta RESEND_API_KEY lähettääksesi demot info@sivux.fi-laatikosta."
    );
    cfg.status = 500;
    throw cfg;
  }

  var subject = "Parannettu demosivu valmis — " + brand;
  var text =
    "Hei!\n\n" +
    "Teimme teille Sivux-analyysin pohjalta parannetun demosivun.\n\n" +
    "Alkuperäinen sivu: " +
    sourceUrl +
    "\n" +
    (typeof score === "number" ? "Analyysin pisteet: " + score + "/100\n" : "") +
    "Demosivu (vain tässä viestissä): " +
    previewUrl +
    "\n\n" +
    "Tämä on ehdotus / preview — ei vielä tuotantosivu.\n" +
    "Jos demosivu tuntuu oikealta suunnalta, vastatkaa tähän viestiin tai varatkaa kickoff: https://sivux.fi/#yhteys\n\n" +
    "Ystävällisin terveisin,\nSivux\ninfo@sivux.fi\n+358 41 4967337\n";

  var html =
    "<p>Hei!</p>" +
    "<p>Teimme teille <strong>Sivux-analyysin</strong> pohjalta parannetun demosivun.</p>" +
    "<p><strong>Alkuperäinen sivu:</strong> " +
    sourceUrl +
    "<br/>" +
    (typeof score === "number" ? "<strong>Analyysin pisteet:</strong> " + score + "/100<br/>" : "") +
    '<strong>Demosivu:</strong> <a href="' +
    previewUrl +
    '">' +
    previewUrl +
    "</a></p>" +
    "<p>Tämä on ehdotus / preview — ei vielä tuotantosivu. Linkki lähetetään vain tähän sähköpostiin.</p>" +
    '<p>Jos demosivu tuntuu oikealta, vastatkaa tähän tai varatkaa kickoff: <a href="https://sivux.fi/#yhteys">sivux.fi</a></p>' +
    "<p>Ystävällisin terveisin,<br/>Sivux<br/>info@sivux.fi<br/>+358 41 4967337</p>";

  var res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resendKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from,
      to: [to],
      subject: subject,
      text: text,
      html: html,
      reply_to: notifyTo,
    }),
  });

  if (!res.ok) {
    var errText = await res.text().catch(function () {
      return "";
    });
    console.error("resend failed:", res.status, errText.slice(0, 300));
    var sendErr = new Error("Demosivun sähköpostilähetys epäonnistui. Kokeile myöhemmin tai ota yhteyttä.");
    sendErr.status = 502;
    throw sendErr;
  }

  // Notify Sivux inbox (does not expose link in public UI).
  var notifySent = false;
  try {
    var notifyRes = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(notifyTo), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: "Demosivu generoitu — " + brand,
        _template: "table",
        email: to,
        source_url: sourceUrl,
        preview_url: previewUrl,
        score: typeof score === "number" ? String(score) : "",
        message:
          "Asiakkaalle generoitiin demosivu ja linkki lähetettiin emailitse.\nAsiakas: " +
          to +
          "\nPreview: " +
          previewUrl +
          "\nLähde: " +
          sourceUrl,
      }),
    });
    notifySent = notifyRes.ok;
  } catch (e) {
    console.error("preview notify error:", e && e.message ? e.message : e);
  }

  return { customerSent: true, notifySent: notifySent, usedResend: true };
}

module.exports = {
  sendPreviewEmail,
};
