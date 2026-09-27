const { getEnv } = require("./portal-auth");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreTone(score) {
  if (typeof score !== "number") return { label: "", color: "#8af3ff" };
  if (score >= 75) return { label: "Hyvä lähtö", color: "#73ffca" };
  if (score >= 50) return { label: "Kehitettävää", color: "#ffd666" };
  return { label: "Kriittisiä korjauksia", color: "#ff7878" };
}

function buildPreviewEmailHtml(options) {
  var brand = escapeHtml(options.brand);
  var sourceUrl = escapeHtml(options.sourceUrl);
  var previewUrl = escapeHtml(options.previewUrl);
  var score = options.score;
  var tone = scoreTone(typeof score === "number" ? score : null);
  var scoreBlock =
    typeof score === "number"
      ? '<tr><td style="padding:0 0 22px;">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td style="width:64px;height:64px;border-radius:999px;border:2px solid ' +
        tone.color +
        ";background:#0b0d15;color:" +
        tone.color +
        ';font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;text-align:center;vertical-align:middle;">' +
        score +
        "</td>" +
        '<td style="padding-left:14px;font-family:Arial,Helvetica,sans-serif;color:#c8cdd8;font-size:14px;line-height:1.45;">' +
        '<span style="display:block;color:#f2f4f8;font-size:15px;font-weight:700;">Analyysin pisteet ' +
        score +
        "/100</span>" +
        (tone.label ? escapeHtml(tone.label) : "Sivux-sivustoanalyysi") +
        "</td></tr></table></td></tr>"
      : "";

  return (
    '<!DOCTYPE html><html lang="fi"><head><meta charset="UTF-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
    "<title>Demosivu valmis — " +
    brand +
    "</title></head>" +
    '<body style="margin:0;padding:0;background:#07080c;color:#f2f4f8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07080c;padding:28px 12px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0e1118;border:1px solid rgba(138,243,255,0.18);border-radius:18px;overflow:hidden;">' +
    '<tr><td style="padding:22px 28px 18px;background:linear-gradient(135deg,#121826 0%,#0b0d15 100%);border-bottom:1px solid rgba(138,243,255,0.12);">' +
    '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8af3ff;font-weight:700;">Sivux</p>' +
    '<h1 style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;color:#f2f4f8;font-weight:700;">Parannettu demosivu on valmis</h1>' +
    '<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#a7afbd;">' +
    brand +
    "</p></td></tr>" +
    '<tr><td style="padding:26px 28px 8px;font-family:Arial,Helvetica,sans-serif;">' +
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#c8cdd8;">Hei!</p>' +
    '<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#c8cdd8;">' +
    "Teimme teille Sivux-analyysin pohjalta <strong style=\"color:#f2f4f8;\">parannetun demosivun</strong>. " +
    "Alla on henkilökohtainen preview-linkki — se lähetetään vain tähän osoitteeseen." +
    "</p>" +
    scoreBlock +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;background:#07080c;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">' +
    '<tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#a7afbd;">' +
    '<span style="display:block;color:#8af3ff;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Alkuperäinen sivu</span>' +
    '<a href="' +
    sourceUrl +
    '" style="color:#f2f4f8;text-decoration:none;word-break:break-all;">' +
    sourceUrl +
    "</a></td></tr></table>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>' +
    '<td style="border-radius:999px;background:#73ffca;">' +
    '<a href="' +
    previewUrl +
    '" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#07080c;text-decoration:none;">Avaa demosivu</a>' +
    "</td></tr></table>" +
    '<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#7d8696;word-break:break-all;">' +
    '<a href="' +
    previewUrl +
    '" style="color:#8af3ff;text-decoration:underline;">' +
    previewUrl +
    "</a></p>" +
    '<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#a7afbd;">' +
    "Tämä on ehdotus / preview — ei vielä tuotantosivu. Jos suunta tuntuu oikealta, vastaa tähän viestiin tai varaa kickoff." +
    "</p>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 8px;"><tr>' +
    '<td style="border-radius:999px;border:1px solid rgba(138,243,255,0.35);">' +
    '<a href="https://sivux.fi/#yhteys" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#8af3ff;text-decoration:none;">Varaa kickoff</a>' +
    "</td></tr></table>" +
    "</td></tr>" +
    '<tr><td style="padding:18px 28px 26px;border-top:1px solid rgba(255,255,255,0.06);font-family:Arial,Helvetica,sans-serif;">' +
    '<p style="margin:0;font-size:14px;line-height:1.55;color:#c8cdd8;">Ystävällisin terveisin,<br /><strong style="color:#f2f4f8;">Sivux</strong></p>' +
    '<p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:#7d8696;">' +
    '<a href="mailto:info@sivux.fi" style="color:#8af3ff;text-decoration:none;">info@sivux.fi</a> · ' +
    '<a href="tel:+358414967337" style="color:#8af3ff;text-decoration:none;">+358 41 4967337</a><br />' +
    '<a href="https://sivux.fi" style="color:#7d8696;text-decoration:none;">sivux.fi</a>' +
    "</p></td></tr>" +
    "</table>" +
    '<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#5c6472;max-width:560px;">' +
    "Sait tämän viestin, koska pyysit demosivua Sivux-sivustoanalyysistä. Linkki on henkilökohtainen." +
    "</p>" +
    "</td></tr></table></body></html>"
  );
}

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
    "Demosivu (vain tässä viestissä):\n" +
    previewUrl +
    "\n\n" +
    "Tämä on ehdotus / preview — ei vielä tuotantosivu.\n" +
    "Jos demosivu tuntuu oikealta suunnalta, vastaa tähän viestiin tai varaa kickoff: https://sivux.fi/#yhteys\n\n" +
    "Ystävällisin terveisin,\nSivux\ninfo@sivux.fi\n+358 41 4967337\nhttps://sivux.fi\n";

  var html = buildPreviewEmailHtml({
    brand: brand,
    sourceUrl: sourceUrl,
    previewUrl: previewUrl,
    score: score,
  });

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
  buildPreviewEmailHtml,
};
