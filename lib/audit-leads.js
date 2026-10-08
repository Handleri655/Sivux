const fs = require("fs");
const path = require("path");
const { getEnv } = require("./portal-auth");
const {
  pickAttribution,
  attributionLines,
  hasAttribution,
} = require("./attribution");

function normalizeEmail(raw) {
  var email = String(raw || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "";
  }
  return email.slice(0, 180);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leadsFilePath() {
  var localDir = path.join(__dirname, "..", "data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return path.join(localDir, "audit-leads.jsonl");
  } catch (e) {
    return path.join("/tmp", "sivux-audit-leads.jsonl");
  }
}

function appendLeadFile(lead) {
  try {
    var line = JSON.stringify(lead) + "\n";
    fs.appendFileSync(leadsFilePath(), line, "utf8");
    return true;
  } catch (e) {
    console.error("audit lead file write failed:", e && e.message ? e.message : e);
    return false;
  }
}

function listLines(items, prefix) {
  if (!Array.isArray(items) || !items.length) return "-";
  return items
    .map(function (item, i) {
      if (!item) return "";
      if (typeof item === "string") return (prefix || "- ") + item;
      var title = item.title || "";
      var how = item.how || item.why || "";
      return (prefix || i + 1 + ". ") + title + (how ? " — " + how : "");
    })
    .filter(Boolean)
    .join("\n");
}

function categoryLines(categories) {
  if (!categories || typeof categories !== "object") return "-";
  var labels = {
    clarity: "Selkeys",
    visual: "Ilme",
    mobile: "Mobiili",
    seo: "SEO",
    trust: "Luottamus",
    conversion: "Konversio",
  };
  return Object.keys(labels)
    .map(function (key) {
      if (typeof categories[key] !== "number") return "";
      return labels[key] + ": " + categories[key] + "/100";
    })
    .filter(Boolean)
    .join("\n");
}

function buildLeadText(lead) {
  return (
    "Uusi sivustoanalyysi-kokeilu\n\n" +
    "Sähköposti: " +
    lead.email +
    "\n" +
    "Testattu sivu: " +
    lead.url +
    "\n" +
    (lead.requestedUrl && lead.requestedUrl !== lead.url
      ? "Syötetty URL: " + lead.requestedUrl + "\n"
      : "") +
    "Pisteet: " +
    (lead.score != null ? lead.score + "/100" : "n/a") +
    "\n" +
    (lead.scoreLabel ? "Arvio: " + lead.scoreLabel + "\n" : "") +
    (lead.potentialGain ? "Mahdollinen nousu: +" + lead.potentialGain + "\n" : "") +
    "\nYhteenveto:\n" +
    (lead.summary || "-") +
    "\n\nKategoriat:\n" +
    categoryLines(lead.categories) +
    "\n\nTop-korjaukset:\n" +
    listLines(lead.topFixes, "") +
    "\n\nKriittiset huomiot:\n" +
    listLines(lead.critical, "- ") +
    "\n\nMikä toimii:\n" +
    listLines(lead.positives, "- ") +
    (lead.note ? "\n\nHuomio: " + lead.note : "") +
    (hasAttribution(lead.attribution)
      ? "\n\nAttribution:\n" + attributionLines(lead.attribution)
      : "") +
    "\n\nEngine: " +
    (lead.engine || "-") +
    "\nAika: " +
    (lead.analyzedAt || lead.savedAt || "")
  );
}

function buildLeadHtml(lead) {
  function bullets(items, numbered) {
    if (!Array.isArray(items) || !items.length) {
      return '<p style="margin:0;color:#7d8696;">—</p>';
    }
    var lis = items
      .map(function (item, i) {
        if (!item) return "";
        if (typeof item === "string") {
          return (
            "<li style=\"margin:0 0 6px;color:#c8cdd8;\">" +
            (numbered ? i + 1 + ". " : "") +
            escapeHtml(item) +
            "</li>"
          );
        }
        return (
          "<li style=\"margin:0 0 8px;color:#c8cdd8;\"><strong style=\"color:#f2f4f8;\">" +
          escapeHtml(item.title || "") +
          "</strong>" +
          (item.how || item.why
            ? "<br/><span style=\"color:#a7afbd;\">" +
              escapeHtml(item.how || item.why) +
              "</span>"
            : "") +
          "</li>"
        );
      })
      .filter(Boolean)
      .join("");
    return '<ul style="margin:0;padding-left:18px;">' + lis + "</ul>";
  }

  var cats = lead.categories || {};
  var catRows = [
    ["Selkeys", cats.clarity],
    ["Ilme", cats.visual],
    ["Mobiili", cats.mobile],
    ["SEO", cats.seo],
    ["Luottamus", cats.trust],
    ["Konversio", cats.conversion],
  ]
    .filter(function (row) {
      return typeof row[1] === "number";
    })
    .map(function (row) {
      return (
        '<tr><td style="padding:4px 12px 4px 0;color:#a7afbd;">' +
        escapeHtml(row[0]) +
        '</td><td style="padding:4px 0;color:#f2f4f8;font-weight:700;">' +
        row[1] +
        "/100</td></tr>"
      );
    })
    .join("");

  return (
    '<!DOCTYPE html><html lang="fi"><body style="margin:0;padding:0;background:#07080c;color:#f2f4f8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07080c;padding:24px 12px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" style="max-width:560px;background:#0e1118;border:1px solid rgba(138,243,255,0.18);border-radius:16px;overflow:hidden;">' +
    '<tr><td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:Arial,Helvetica,sans-serif;">' +
    '<p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8af3ff;font-weight:700;">Sivux lead</p>' +
    '<h1 style="margin:8px 0 0;font-size:22px;color:#f2f4f8;">Uusi sivustoanalyysi-kokeilu</h1>' +
    "</td></tr>" +
    '<tr><td style="padding:22px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;">' +
    '<p style="margin:0 0 14px;color:#c8cdd8;"><strong style="color:#8af3ff;">Sähköposti:</strong><br/>' +
    '<a href="mailto:' +
    escapeHtml(lead.email) +
    '" style="color:#f2f4f8;text-decoration:none;">' +
    escapeHtml(lead.email) +
    "</a></p>" +
    '<p style="margin:0 0 14px;color:#c8cdd8;"><strong style="color:#8af3ff;">Testattu sivu:</strong><br/>' +
    '<a href="' +
    escapeHtml(lead.url) +
    '" style="color:#73ffca;word-break:break-all;">' +
    escapeHtml(lead.url) +
    "</a></p>" +
    (hasAttribution(lead.attribution)
      ? '<p style="margin:0 0 14px;color:#c8cdd8;"><strong style="color:#8af3ff;">Attribution:</strong><br/>' +
        escapeHtml(attributionLines(lead.attribution)).replace(/\n/g, "<br/>") +
        "</p>"
      : "") +
    (lead.score != null
      ? '<p style="margin:0 0 14px;color:#c8cdd8;"><strong style="color:#8af3ff;">Pisteet:</strong> ' +
        '<span style="color:#f2f4f8;font-size:18px;font-weight:700;">' +
        lead.score +
        "/100</span>" +
        (lead.scoreLabel
          ? '<br/><span style="color:#a7afbd;">' + escapeHtml(lead.scoreLabel) + "</span>"
          : "") +
        "</p>"
      : "") +
    '<p style="margin:0 0 6px;color:#8af3ff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Yhteenveto</p>' +
    '<p style="margin:0 0 18px;color:#c8cdd8;">' +
    escapeHtml(lead.summary || "—") +
    "</p>" +
    (catRows
      ? '<p style="margin:0 0 6px;color:#8af3ff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Kategoriat</p>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">' +
        catRows +
        "</table>"
      : "") +
    '<p style="margin:0 0 6px;color:#8af3ff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Top-korjaukset</p>' +
    '<div style="margin:0 0 18px;">' +
    bullets(lead.topFixes, true) +
    "</div>" +
    '<p style="margin:0 0 6px;color:#8af3ff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Kriittiset</p>' +
    '<div style="margin:0 0 18px;">' +
    bullets(lead.critical, false) +
    "</div>" +
    '<p style="margin:0 0 6px;color:#8af3ff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Mikä toimii</p>' +
    '<div style="margin:0 0 8px;">' +
    bullets(lead.positives, false) +
    "</div>" +
    (lead.note
      ? '<p style="margin:14px 0 0;color:#a7afbd;font-size:13px;">Huomio: ' +
        escapeHtml(lead.note) +
        "</p>"
      : "") +
    "</td></tr>" +
    '<tr><td style="padding:14px 24px 20px;border-top:1px solid rgba(255,255,255,0.06);font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7d8696;">' +
    "Engine: " +
    escapeHtml(lead.engine || "-") +
    " · " +
    escapeHtml(lead.analyzedAt || lead.savedAt || "") +
    "</td></tr>" +
    "</table></td></tr></table></body></html>"
  );
}

async function notifyViaResend(lead, notifyTo) {
  var resendKey = getEnv("RESEND_API_KEY", "");
  if (!resendKey) return null;
  var from = getEnv("RESEND_FROM", "Sivux <info@sivux.fi>");
  var scorePart = lead.score != null ? lead.score + "/100 · " : "";
  var subject = "Sivustoanalyysi-lead: " + scorePart + (lead.url || lead.email);

  var response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resendKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from,
      to: [notifyTo],
      reply_to: lead.email,
      subject: subject.slice(0, 180),
      text: buildLeadText(lead),
      html: buildLeadHtml(lead),
    }),
  });

  if (!response.ok) {
    var errText = await response.text().catch(function () {
      return "";
    });
    console.error("audit lead resend failed:", response.status, errText.slice(0, 300));
    return false;
  }
  return true;
}

async function notifyViaFormSubmit(lead, notifyTo) {
  var response = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(notifyTo), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: "Uusi sivustoanalyysi-lead",
      _template: "table",
      email: lead.email,
      url: lead.url,
      score: lead.score != null ? String(lead.score) : "",
      score_label: lead.scoreLabel || "",
      summary: lead.summary || "",
      categories: categoryLines(lead.categories),
      top_fixes: listLines(lead.topFixes, ""),
      critical: listLines(lead.critical, "- "),
      positives: listLines(lead.positives, "- "),
      engine: lead.engine || "",
      analyzed_at: lead.analyzedAt || "",
      kampanjakoodi: (lead.attribution && lead.attribution.promoCode) || "",
      ref: (lead.attribution && lead.attribution.ref) || "",
      utm_source: (lead.attribution && lead.attribution.utmSource) || "",
      utm_campaign: (lead.attribution && lead.attribution.utmCampaign) || "",
      message: buildLeadText(lead),
    }),
  });
  if (!response.ok) {
    var text = await response.text().catch(function () {
      return "";
    });
    console.error("audit lead formsubmit failed:", response.status, text.slice(0, 200));
    return false;
  }
  return true;
}

async function notifyLeadEmail(lead) {
  var notifyTo = getEnv("AUDIT_LEAD_EMAIL", getEnv("LEAD_NOTIFY_EMAIL", "info@sivux.fi"));
  if (!notifyTo) return false;

  try {
    var resendResult = await notifyViaResend(lead, notifyTo);
    if (resendResult === true) return true;
    if (resendResult === false) {
      // Resend configured but failed — still try FormSubmit as backup
    }
    return await notifyViaFormSubmit(lead, notifyTo);
  } catch (e) {
    console.error("audit lead notify error:", e && e.message ? e.message : e);
    return false;
  }
}

async function captureAuditLead(input) {
  var email = normalizeEmail(input && input.email);
  if (!email) {
    var err = new Error("Sähköposti vaaditaan ilmaiseen arvioon");
    err.status = 400;
    throw err;
  }

  var attribution = pickAttribution(input && (input.attribution || input));

  var lead = {
    type: (input && input.type) || "site_audit",
    email: email,
    url: String((input && input.url) || "").slice(0, 500),
    requestedUrl: String((input && input.requestedUrl) || "").slice(0, 500),
    score: typeof (input && input.score) === "number" ? input.score : null,
    scoreLabel: String((input && input.scoreLabel) || "").slice(0, 240),
    summary: String((input && input.summary) || "").slice(0, 800),
    categories: (input && input.categories) || {},
    topFixes: Array.isArray(input && input.topFixes) ? input.topFixes.slice(0, 5) : [],
    critical: Array.isArray(input && input.critical) ? input.critical.slice(0, 8) : [],
    positives: Array.isArray(input && input.positives) ? input.positives.slice(0, 8) : [],
    potentialGain:
      typeof (input && input.potentialGain) === "number" ? input.potentialGain : null,
    note: String((input && input.note) || "").slice(0, 400),
    engine: String((input && input.engine) || "").slice(0, 40),
    ip: String((input && input.ip) || "").slice(0, 80),
    attribution: attribution,
    analyzedAt: (input && input.analyzedAt) || new Date().toISOString(),
    savedAt: new Date().toISOString(),
  };

  var fileOk = appendLeadFile(lead);
  var mailOk = false;
  if (!(input && input.skipNotify)) {
    mailOk = await notifyLeadEmail(lead);
  }
  console.log(
    "audit lead captured:",
    lead.type,
    lead.email,
    lead.url,
    "score=" + lead.score,
    "file=" + fileOk,
    "mail=" + mailOk
  );
  return { lead: lead, fileOk: fileOk, mailOk: mailOk };
}

module.exports = {
  normalizeEmail,
  captureAuditLead,
};
