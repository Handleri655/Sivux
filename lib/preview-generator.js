function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pickBrandName(signals, sourceUrl) {
  var title = String((signals && signals.title) || "").trim();
  if (title) {
    var cleaned = title.split(/[|\-–—]/)[0].trim();
    if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
  }
  try {
    var host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/[-_]/g, " ");
  } catch (e) {
    return "Yrityksesi";
  }
}

function guessPhone(text) {
  var match = String(text || "").match(/(\+358[\s-]?\d{1,3}[\s-]?\d{4,10}|0\d{1,2}[\s-]?\d{5,10})/);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function guessEmail(text) {
  var match = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function buildServices(signals, aiServices) {
  if (Array.isArray(aiServices) && aiServices.length) {
    return aiServices.slice(0, 4).map(function (item) {
      return {
        title: String(item.title || "Palvelu").slice(0, 60),
        text: String(item.text || "").slice(0, 180),
      };
    });
  }
  return [
    {
      title: "Selkeä palveluesittely",
      text: "Kerromme heti mitä tarjoatte ja kenelle — ilman turhaa selaamista.",
    },
    {
      title: "Luottamusta herättävä rakenne",
      text: "Yhteystiedot, sosiaalinen todiste ja selkeä seuraava askel näkyvillä.",
    },
    {
      title: "Mobiili ensin",
      text: "Sivu skaalaa puhelimelle ja ohjaa yhteydenottoon yhdellä napilla.",
    },
    {
      title: "SEO-perusta kunnossa",
      text: "Title, meta, H1 ja rakenne tehty löydettävyyttä varten.",
    },
  ];
}

function buildPreviewHtml(options) {
  var signals = options.signals || {};
  var audit = options.audit || {};
  var copy = options.copy || {};
  var sourceUrl = options.sourceUrl || signals.url || "";
  var brand = copy.brandName || pickBrandName(signals, sourceUrl);
  var headline =
    copy.headline ||
    (brand + " — selkeät nettisivut, jotka ohjaavat yhteydenottoon.");
  var lead =
    copy.lead ||
    signals.description ||
    "Rakensimme teille demosivun Sivuxin analyysin pohjalta: vahvempi viesti, selkeämpi CTA ja parempi ensivaikutelma.";
  var cta = copy.cta || "Pyydä tarjous";
  var phone = copy.phone || guessPhone(signals.textSample || "");
  var email = copy.email || guessEmail(signals.textSample || "") || options.customerEmail || "";
  var services = buildServices(signals, copy.services);
  var fixes = Array.isArray(audit.topFixes) ? audit.topFixes.slice(0, 3) : [];
  var score = typeof audit.score === "number" ? audit.score : null;
  var accent = copy.accent || "#73ffca";
  var accent2 = copy.accent2 || "#8af3ff";

  var servicesHtml = services
    .map(function (s) {
      return (
        '<article class="card"><h3>' +
        escapeHtml(s.title) +
        "</h3><p>" +
        escapeHtml(s.text) +
        "</p></article>"
      );
    })
    .join("\n");

  var fixesHtml = fixes.length
    ? fixes
        .map(function (f, i) {
          return (
            "<li><strong>" +
            (i + 1) +
            ". " +
            escapeHtml(f.title || "Korjaus") +
            "</strong><span>" +
            escapeHtml(f.how || f.why || "") +
            "</span></li>"
          );
        })
        .join("")
    : "<li><strong>Selkeämpi hero ja CTA</strong><span>Viesti ja seuraava askel heti näkyviin.</span></li>";

  var phoneLink = phone
    ? '<a class="btn btn-ghost" href="tel:' +
      escapeHtml(phone.replace(/\s+/g, "")) +
      '">' +
      escapeHtml(phone) +
      "</a>"
    : "";
  var mailLink = email
    ? '<a class="btn btn-primary" href="mailto:' +
      escapeHtml(email) +
      '?subject=' +
      encodeURIComponent("Yhteydenotto: " + brand) +
      '">' +
      escapeHtml(cta) +
      "</a>"
    : '<a class="btn btn-primary" href="#yhteys">' + escapeHtml(cta) + "</a>";

  return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(brand)} | Parannettu demosivu — Sivux</title>
  <meta name="description" content="${escapeHtml(String(lead).slice(0, 155))}" />
  <meta name="robots" content="noindex,nofollow" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #07080c;
      --text: #f4f7fb;
      --muted: #a9b4c4;
      --line: rgba(255,255,255,0.12);
      --accent: ${accent};
      --accent2: ${accent2};
      --panel: rgba(255,255,255,0.04);
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Instrument Sans", system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(900px 500px at 10% -10%, rgba(115,255,202,0.16), transparent 55%),
        radial-gradient(800px 480px at 90% 0%, rgba(138,243,255,0.12), transparent 50%),
        var(--bg);
      line-height: 1.55;
    }
    a { color: inherit; }
    .wrap { width: min(1100px, 92vw); margin: 0 auto; }
    .banner {
      border-bottom: 1px solid var(--line);
      background: rgba(0,0,0,0.35);
      padding: 0.7rem 0;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .banner strong { color: var(--accent); }
    .banner a { color: var(--accent2); }
    header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.2rem 0; gap: 1rem;
    }
    .logo { font-family: Outfit, sans-serif; font-weight: 700; font-size: 1.15rem; text-decoration: none; }
    .nav a { color: var(--muted); text-decoration: none; margin-left: 1rem; font-size: 0.92rem; }
    .hero { padding: 2.5rem 0 3rem; }
    .hero h1 {
      font-family: Outfit, sans-serif;
      font-size: clamp(2rem, 5vw, 3.4rem);
      line-height: 1.08; margin: 0 0 1rem; max-width: 16ch;
    }
    .lead { color: var(--muted); max-width: 54ch; margin: 0 0 1.4rem; font-size: 1.05rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 999px; padding: 0.85rem 1.2rem; text-decoration: none;
      font-weight: 700; border: 1px solid transparent;
    }
    .btn-primary { background: linear-gradient(120deg, var(--accent), var(--accent2)); color: #05070b; }
    .btn-ghost { border-color: var(--line); color: var(--text); background: rgba(255,255,255,0.03); }
    .section { padding: 2.5rem 0; }
    .section h2 { font-family: Outfit, sans-serif; margin: 0 0 1rem; font-size: clamp(1.4rem, 3vw, 2rem); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0.85rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } .nav { display: none; } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
      padding: 1rem 1.05rem;
    }
    .card h3 { margin: 0 0 0.4rem; font-size: 1.02rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.94rem; }
    .fixes { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
    .fixes li {
      background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
      padding: 0.9rem 1rem; display: grid; gap: 0.25rem;
    }
    .fixes span { color: var(--muted); font-size: 0.92rem; }
    .score {
      display: inline-flex; align-items: baseline; gap: 0.35rem;
      padding: 0.35rem 0.7rem; border-radius: 999px; border: 1px solid rgba(115,255,202,0.35);
      color: var(--accent); font-weight: 700; margin-bottom: 1rem;
    }
    footer {
      border-top: 1px solid var(--line); padding: 1.5rem 0 2rem; color: var(--muted); font-size: 0.9rem;
    }
    #yhteys .card { max-width: 640px; }
  </style>
</head>
<body>
  <div class="banner">
    <div class="wrap">
      Tämä on <strong>Sivux-demo</strong> analyysin pohjalta — ei vielä virallinen tuotantosivu.
      ${sourceUrl ? ' Alkuperäinen: <a href="' + escapeHtml(sourceUrl) + '" rel="noopener noreferrer" target="_blank">' + escapeHtml(sourceUrl) + "</a>" : ""}
    </div>
  </div>
  <div class="wrap">
    <header>
      <a class="logo" href="#top">${escapeHtml(brand)}</a>
      <nav class="nav">
        <a href="#palvelut">Palvelut</a>
        <a href="#parannukset">Parannukset</a>
        <a href="#yhteys">Yhteys</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        ${score != null ? '<p class="score">Analyysi ' + score + "/100 → demokorjaus</p>" : ""}
        <h1>${escapeHtml(headline)}</h1>
        <p class="lead">${escapeHtml(lead)}</p>
        <div class="actions">
          ${mailLink}
          ${phoneLink}
        </div>
      </section>

      <section class="section" id="palvelut">
        <h2>Mitä saat tällä rakenteella</h2>
        <div class="grid">${servicesHtml}</div>
      </section>

      <section class="section" id="parannukset">
        <h2>Korjaukset, jotka demossa on huomioitu</h2>
        <ul class="fixes">${fixesHtml}</ul>
      </section>

      <section class="section" id="yhteys">
        <h2>Otetaan seuraava askel</h2>
        <div class="card">
          <p style="margin:0 0 0.85rem;color:var(--muted)">
            Jos demosivu tuntuu oikealta suunnalta, Sivux toteuttaa teille valmiin tuotantosivuston —
            sisältö, julkaisu ja jatkuva tuki.
          </p>
          <div class="actions">
            <a class="btn btn-primary" href="mailto:info@sivux.fi?subject=${encodeURIComponent("Haluan tämän demosivun tuotantoon: " + brand)}">Kyllä, haluan tämän liveen</a>
            <a class="btn btn-ghost" href="https://sivux.fi/sivustoanalyysi.html">Takaisin Sivuxiin</a>
          </div>
        </div>
      </section>
    </main>

    <footer>
      Demo by <a href="https://sivux.fi">Sivux</a> · Y-tunnus 3616701-3 · Preview only
    </footer>
  </div>
</body>
</html>`;
}

module.exports = {
  buildPreviewHtml,
  pickBrandName,
  escapeHtml,
};
