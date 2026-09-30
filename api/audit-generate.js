const {
  setCors,
  sendJson,
  parseBody,
  getEnv,
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
} = require("../lib/portal-auth");
const { normalizeEmail, captureAuditLead } = require("../lib/audit-leads");
const { buildPreviewHtml, pickBrandName } = require("../lib/preview-generator");
const { deployPreviewSite } = require("../lib/vercel-deploy");
const { sendPreviewEmail } = require("../lib/preview-email");
const { claimPreviewEmail, isPreviewEmailUsed, updatePreviewClaim } = require("../lib/preview-quota");

function isPrivateHostname(hostname) {
  var host = String(hostname || "").toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    var parts = host.split(".").map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function normalizeUrl(raw) {
  var input = String(raw || "").trim();
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;
  var url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Virheellinen URL");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Tätä osoitetta ei voi käyttää");
  }
  url.hash = "";
  return url.toString();
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMeta(html, name) {
  var re = new RegExp(
    '<meta[^>]+(?:name|property)=["\']' + name + '["\'][^>]+content=["\']([^"\']*)["\']',
    "i"
  );
  var re2 = new RegExp(
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:name|property)=["\']' + name + '["\']',
    "i"
  );
  var m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : "";
}

function isAbortError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;
  return /aborted|abort/i.test(String(err.message || ""));
}

async function fetchSignals(targetUrl) {
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, 18000);
  try {
    var response = await fetch(targetUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SivuxPreviewBot/1.0 (+https://sivux.fi)",
        Accept: "text/html",
      },
    });
    if (!response.ok) throw new Error("Sivua ei saatu ladattua (" + response.status + ")");
    var finalUrl = response.url || targetUrl;
    if (isPrivateHostname(new URL(finalUrl).hostname)) {
      throw new Error("Uudelleenohjaus estetty");
    }
    var html = Buffer.from(await response.arrayBuffer()).toString("utf8").slice(0, 900000);
    var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return {
      url: finalUrl,
      title: titleMatch ? stripTags(titleMatch[1]).slice(0, 160) : "",
      description: pickMeta(html, "description").slice(0, 320),
      textSample: stripTags(html).slice(0, 2500),
      hasTel: /tel:/i.test(html),
      hasMailto: /mailto:/i.test(html),
    };
  } catch (e) {
    if (isAbortError(e)) {
      var timeoutErr = new Error(
        "Sivun lataus kesti liian kauan demoa varten. Kokeile uudelleen."
      );
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function aiCopy(signals, audit) {
  var apiKey = getEnv("OPENAI_API_KEY", "");
  if (!apiKey) return null;
  var model = getEnv("OPENAI_MODEL", "gpt-4o-mini");
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, 12000);
  try {
    var response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Kirjoita suomeksi konvertoiva, premium-tuntuinen demosivun copy JSON-muodossa: {"brandName":"","headline":"","lead":"","about":"","cta":"","proof":["","",""],"services":[{"title":"","text":""}],"accent":"#73ffca","accent2":"#8af3ff","mood":""}. 3-4 palvelua. proof = 3 lyhyttä hyötyä. accent/accent2 hex-väreinä brändiin sopien (ei lila/violetti klisee). Älä keksi valheellisia referenssejä. Sävy ammattimainen ja moderni.',
          },
          {
            role: "user",
            content:
              "Lähdesivu: " +
              signals.url +
              "\nTitle: " +
              signals.title +
              "\nDescription: " +
              signals.description +
              "\nTeksti: " +
              signals.textSample +
              "\nAnalyysipisteet: " +
              (audit && audit.score) +
              "\nIlme/visual: " +
              (audit && audit.categories && audit.categories.visual) +
              "\nTop-korjaukset: " +
              JSON.stringify((audit && audit.topFixes) || []),
          },
        ],
      }),
    });
    var payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) return null;
    var content =
      payload.choices &&
      payload.choices[0] &&
      payload.choices[0].message &&
      payload.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  } catch (e) {
    if (isAbortError(e)) return null;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

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
  var limited = await checkRateLimit("audit-generate", ip, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    rateLimitResponse(res, limited);
    return;
  }

  var body;
  try {
    body = await parseBody(req, { maxBytes: 64 * 1024 });
  } catch (e) {
    sendJson(res, e.status || 400, {
      error: e.status === 413 ? "Pyyntö liian suuri" : "Invalid JSON body",
    });
    return;
  }
  if (body && body.website) {
    sendJson(res, 200, { ok: true });
    return;
  }

  var email = normalizeEmail(body && body.email);
  if (!email) {
    sendJson(res, 400, { error: "Sähköposti vaaditaan demosivun lähetykseen" });
    return;
  }

  var targetUrl;
  try {
    targetUrl = normalizeUrl(body && body.url);
  } catch (e) {
    sendJson(res, 400, { error: e.message || "Virheellinen URL" });
    return;
  }

  if (!getEnv("VERCEL_TOKEN", "")) {
    sendJson(res, 500, {
      error: "Demosivun julkaisu ei ole vielä konfiguroitu",
      hint: "Aseta VERCEL_TOKEN (ja VERCEL_TEAM_ID) ympäristömuuttujiin.",
    });
    return;
  }

  if (!getEnv("RESEND_API_KEY", "")) {
    sendJson(res, 500, {
      error: "Sähköpostilähetys ei ole konfiguroitu",
      hint: "Aseta RESEND_API_KEY ja RESEND_FROM (esim. Sivux <info@sivux.fi>).",
    });
    return;
  }

  var used = await isPreviewEmailUsed(email);
  if (used.used) {
    sendJson(res, 429, {
      error: "Tällä sähköpostilla on jo luotu demosivu. Yksi demo / sähköposti.",
      code: used.reason || "already_used",
    });
    return;
  }

  try {
    var signals = await fetchSignals(targetUrl);
    var audit = {
      score: typeof body.score === "number" ? body.score : Number(body.score) || null,
      scoreLabel: String((body && body.scoreLabel) || ""),
      topFixes: Array.isArray(body.topFixes) ? body.topFixes : [],
      critical: Array.isArray(body.critical) ? body.critical : [],
      categories: body.categories && typeof body.categories === "object" ? body.categories : {},
    };

    var copy = null;
    try {
      copy = await aiCopy(signals, audit);
    } catch (e) {
      console.error("preview ai copy failed:", e && e.message ? e.message : e);
    }

    var brandName = (copy && copy.brandName) || pickBrandName(signals, signals.url);
    var html = buildPreviewHtml({
      signals: signals,
      audit: audit,
      copy: copy || {},
      sourceUrl: signals.url,
      customerEmail: email,
    });

    var deployed = await deployPreviewSite({
      name: brandName,
      html: html,
    });

    if (!deployed.url) {
      throw new Error("Julkaisu onnistui, mutta preview-URL puuttuu vielä. Kokeile hetken päästä.");
    }

    var mail = await sendPreviewEmail({
      to: email,
      previewUrl: deployed.url,
      brandName: brandName,
      sourceUrl: signals.url,
      score: audit.score,
    });

    var claim = await claimPreviewEmail(email, {
      url: signals.url,
      previewUrl: deployed.url,
    });
    if (!claim.allowed && claim.reason === "already_used") {
      // Race: another request finished first — email still sent once here; treat as ok.
    }
    await updatePreviewClaim(email, {
      url: signals.url,
      previewUrl: deployed.url,
    });

    await captureAuditLead({
      type: "preview_generated",
      email: email,
      url: signals.url,
      requestedUrl: targetUrl,
      score: audit.score,
      scoreLabel: "PREVIEW_SENT",
      engine: "preview-bot",
      analyzedAt: new Date().toISOString(),
      skipNotify: true,
    });

    sendJson(res, 200, {
      ok: true,
      brandName: brandName,
      emailSent: true,
      notifySent: Boolean(mail.notifySent),
      message:
        "Demosivu on valmis ja lähetetty osoitteeseen " +
        email +
        ". Tarkista sähköpostisi (ja roskaposti).",
    });
  } catch (e) {
    console.error("audit-generate error:", e && e.message ? e.message : e, e && e.payload);
    var msg = e && e.message ? e.message : "Demosivun generointi epäonnistui";
    if (isAbortError(e)) {
      msg = "Operaatio keskeytyi aikakatkaisuun. Kokeile uudelleen — demosivun luonti voi kestää hetken.";
    }
    sendJson(res, e.status || (isAbortError(e) ? 504 : 502), {
      error: msg,
      hint: "Tarkista VERCEL_TOKEN, RESEND_API_KEY ja että lähdesivu on julkinen.",
    });
  }
};
