const fs = require("fs");
const path = require("path");
const { getEnv } = require("./portal-auth");

function normalizeEmail(raw) {
  var email = String(raw || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "";
  }
  return email.slice(0, 180);
}

function leadsFilePath() {
  // Prefer durable local folder; on Vercel use /tmp.
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

async function notifyLeadEmail(lead) {
  var notifyTo = getEnv("AUDIT_LEAD_EMAIL", getEnv("LEAD_NOTIFY_EMAIL", "info@sivux.fi"));
  if (!notifyTo) {
    return false;
  }

  try {
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
        engine: lead.engine || "",
        analyzed_at: lead.analyzedAt || "",
        message:
          "Uusi ilmainen sivustoanalyysi.\nSähköposti: " +
          lead.email +
          "\nSivusto: " +
          lead.url +
          "\nPisteet: " +
          (lead.score != null ? lead.score + "/100" : "n/a"),
      }),
    });
    if (!response.ok) {
      var text = await response.text().catch(function () {
        return "";
      });
      console.error("audit lead notify failed:", response.status, text.slice(0, 200));
      return false;
    }
    return true;
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

  var lead = {
    type: (input && input.type) || "site_audit",
    email: email,
    url: String((input && input.url) || "").slice(0, 500),
    requestedUrl: String((input && input.requestedUrl) || "").slice(0, 500),
    score: typeof (input && input.score) === "number" ? input.score : null,
    scoreLabel: String((input && input.scoreLabel) || "").slice(0, 240),
    engine: String((input && input.engine) || "").slice(0, 40),
    ip: String((input && input.ip) || "").slice(0, 80),
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
