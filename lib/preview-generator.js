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
        text: String(item.text || "").slice(0, 200),
      };
    });
  }
  return [
    {
      title: "Selkeä lupaus heti heroissa",
      text: "Kävijä ymmärtää sekunnissa mitä tarjoatte ja kenelle — ilman selaamista.",
    },
    {
      title: "Luottamus näkyviin",
      text: "Yhteystiedot, sosiaaliset todisteet ja seuraava askel ovat heti käsillä.",
    },
    {
      title: "Mobiili ensin",
      text: "Rakenne skaalaa puhelimelle ja ohjaa yhteydenottoon yhdellä napilla.",
    },
    {
      title: "Ilme joka erottuu",
      text: "Typografia, värit ja rytmi rakennettu brändillenne — ei valmisteeman näköinen.",
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
    copy.headline || brand + " — nettisivut, jotka näyttävät hyvältä ja ohjaavat yhteydenottoon.";
  var lead =
    copy.lead ||
    signals.description ||
    "Rakensimme teille demosivun Sivuxin analyysin pohjalta: vahvempi ensivaikutelma, selkeämpi viesti ja CTA joka tuntuu oikealta.";
  var about =
    copy.about ||
    "Tämä demo näyttää, miltä etusivu voisi tuntua kun rakenne, typografia ja konversio on mietitty yhteen. Sisältö on ehdotus — tuotannossa hiomme sen teidän äänellenne.";
  var cta = copy.cta || "Pyydä tarjous";
  var proof =
    Array.isArray(copy.proof) && copy.proof.length
      ? copy.proof.slice(0, 3).map(function (p) {
          return String(p).slice(0, 80);
        })
      : ["Selkeämpi hero", "Vahvempi CTA", "Moderni ilme"];
  var phone = copy.phone || guessPhone(signals.textSample || "");
  var email = copy.email || guessEmail(signals.textSample || "") || options.customerEmail || "";
  var services = buildServices(signals, copy.services);
  var fixes = Array.isArray(audit.topFixes) ? audit.topFixes.slice(0, 3) : [];
  var score = typeof audit.score === "number" ? audit.score : null;
  var visualScore =
    audit.categories && typeof audit.categories.visual === "number" ? audit.categories.visual : null;
  var accent = String(copy.accent || "#73ffca").slice(0, 20);
  var accent2 = String(copy.accent2 || "#8af3ff").slice(0, 20);
  var mood = String(copy.mood || "premium dark").slice(0, 40);

  var servicesHtml = services
    .map(function (s, i) {
      return (
        '<article class="service" style="--i:' +
        i +
        '">' +
        '<span class="service-num">0' +
        (i + 1) +
        "</span>" +
        "<div><h3>" +
        escapeHtml(s.title) +
        "</h3><p>" +
        escapeHtml(s.text) +
        "</p></div></article>"
      );
    })
    .join("\n");

  var proofHtml = proof
    .map(function (p) {
      return "<li>" + escapeHtml(p) + "</li>";
    })
    .join("");

  var fixesHtml = fixes.length
    ? fixes
        .map(function (f, i) {
          return (
            '<li style="--i:' +
            i +
            '"><span class="fix-num">' +
            (i + 1) +
            "</span><div><strong>" +
            escapeHtml(f.title || "Korjaus") +
            "</strong><p>" +
            escapeHtml(f.how || f.why || "") +
            "</p></div></li>"
          );
        })
        .join("")
    : '<li><span class="fix-num">1</span><div><strong>Selkeämpi hero ja CTA</strong><p>Viesti ja seuraava askel heti näkyviin.</p></div></li>';

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
      "?subject=" +
      encodeURIComponent("Yhteydenotto: " + brand) +
      '">' +
      escapeHtml(cta) +
      "</a>"
    : '<a class="btn btn-primary" href="#yhteys">' + escapeHtml(cta) + "</a>";

  var scoreChip =
    score != null
      ? '<p class="score-chip">Analyysi <strong>' +
        score +
        "/100</strong>" +
        (visualScore != null ? " · Ilme " + visualScore + "/100" : "") +
        " → demokorjaus</p>"
      : "";

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
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #06070b;
      --bg-elev: #0c0f16;
      --text: #f3f6fb;
      --muted: #9aa6b8;
      --line: rgba(255,255,255,0.1);
      --accent: ${accent};
      --accent2: ${accent2};
      --radius: 20px;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: "Instrument Sans", system-ui, sans-serif;
      color: var(--text);
      background: var(--bg);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    .wrap { width: min(1120px, calc(100% - 2rem)); margin: 0 auto; }

    .banner {
      position: relative; z-index: 5;
      border-bottom: 1px solid var(--line);
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(10px);
      padding: 0.65rem 0;
      font-size: 0.86rem;
      color: var(--muted);
    }
    .banner strong { color: var(--accent); }
    .banner a { color: var(--accent2); text-decoration: none; border-bottom: 1px solid rgba(138,243,255,0.35); }

    .site-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.15rem 0; gap: 1rem; position: relative; z-index: 2;
    }
    .logo {
      font-family: Outfit, sans-serif; font-weight: 700; font-size: 1.2rem;
      text-decoration: none; letter-spacing: -0.02em;
    }
    .nav { display: flex; gap: 1.15rem; }
    .nav a {
      color: var(--muted); text-decoration: none; font-size: 0.92rem; font-weight: 500;
      transition: color 0.25s var(--ease);
    }
    .nav a:hover { color: var(--text); }

    .hero {
      position: relative;
      min-height: min(88vh, 760px);
      display: grid;
      align-items: end;
      padding: 2rem 0 3.5rem;
      overflow: hidden;
    }
    .hero-bg {
      position: absolute; inset: -10% -5% auto -5%; height: 120%;
      background:
        radial-gradient(ellipse 70% 55% at 18% 20%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 60%),
        radial-gradient(ellipse 55% 45% at 88% 10%, color-mix(in srgb, var(--accent2) 22%, transparent), transparent 55%),
        radial-gradient(ellipse 40% 30% at 60% 70%, rgba(255,255,255,0.04), transparent 50%),
        linear-gradient(180deg, #0a0d14 0%, var(--bg) 72%);
      pointer-events: none;
    }
    .hero-bg::after {
      content: "";
      position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 64px 64px;
      mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, #000 20%, transparent 75%);
      opacity: 0.35;
    }
    .hero-inner { position: relative; z-index: 1; max-width: 720px; }
    .score-chip {
      display: inline-flex; align-items: center; gap: 0.35rem;
      margin: 0 0 1.1rem; padding: 0.4rem 0.85rem;
      border-radius: 999px; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
      background: rgba(0,0,0,0.35); color: var(--muted); font-size: 0.86rem;
      animation: rise 0.8s var(--ease) both;
    }
    .score-chip strong { color: var(--accent); }
    .brand-mark {
      margin: 0 0 0.85rem;
      font-family: Outfit, sans-serif;
      font-size: clamp(2.4rem, 7vw, 4.6rem);
      font-weight: 700; letter-spacing: -0.04em; line-height: 0.95;
      animation: rise 0.9s var(--ease) 0.05s both;
    }
    .hero h1 {
      font-family: Outfit, sans-serif;
      font-size: clamp(1.45rem, 3.2vw, 2.15rem);
      font-weight: 600; line-height: 1.2; letter-spacing: -0.02em;
      margin: 0 0 1rem; max-width: 22ch; color: #e8eef7;
      animation: rise 0.95s var(--ease) 0.12s both;
    }
    .lead {
      color: var(--muted); max-width: 38rem; margin: 0 0 1.6rem;
      font-size: clamp(1.02rem, 2vw, 1.15rem); line-height: 1.6;
      animation: rise 1s var(--ease) 0.18s both;
    }
    .actions {
      display: flex; flex-wrap: wrap; gap: 0.75rem;
      animation: rise 1.05s var(--ease) 0.24s both;
    }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 999px; padding: 0.95rem 1.35rem; text-decoration: none;
      font-weight: 700; border: 1px solid transparent; font-size: 0.98rem;
      transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), border-color 0.3s var(--ease);
    }
    .btn:hover { transform: translateY(-2px); }
    .btn-primary {
      background: linear-gradient(120deg, var(--accent), var(--accent2));
      color: #05070b;
      box-shadow: 0 10px 30px color-mix(in srgb, var(--accent) 25%, transparent);
    }
    .btn-ghost {
      border-color: var(--line); color: var(--text);
      background: rgba(255,255,255,0.03);
    }

    .proof {
      position: relative; z-index: 1;
      display: flex; flex-wrap: wrap; gap: 0.65rem 1.5rem;
      padding: 1.1rem 0 0.4rem; margin: 0; list-style: none;
      border-top: 1px solid var(--line);
      color: var(--muted); font-size: 0.92rem;
    }
    .proof li {
      display: flex; align-items: center; gap: 0.45rem;
    }
    .proof li::before {
      content: ""; width: 0.45rem; height: 0.45rem; border-radius: 50%;
      background: var(--accent); flex: 0 0 auto;
    }

    .section { padding: clamp(3rem, 7vw, 5rem) 0; }
    .section-kicker {
      margin: 0 0 0.55rem; text-transform: uppercase; letter-spacing: 0.12em;
      font-size: 0.75rem; font-weight: 700; color: var(--accent2);
    }
    .section h2 {
      font-family: Outfit, sans-serif; margin: 0 0 0.65rem;
      font-size: clamp(1.55rem, 3.4vw, 2.25rem); letter-spacing: -0.02em; line-height: 1.15;
    }
    .section-lead { margin: 0 0 2rem; color: var(--muted); max-width: 40rem; }

    .services { display: grid; gap: 0; border-top: 1px solid var(--line); }
    .service {
      display: grid; grid-template-columns: 4.5rem 1fr; gap: 1rem;
      padding: 1.35rem 0; border-bottom: 1px solid var(--line);
      animation: rise 0.8s var(--ease) calc(0.05s * var(--i)) both;
    }
    .service-num {
      font-family: Outfit, sans-serif; font-weight: 700; font-size: 1.1rem;
      color: color-mix(in srgb, var(--accent) 80%, white);
    }
    .service h3 { margin: 0 0 0.35rem; font-size: 1.12rem; letter-spacing: -0.01em; }
    .service p { margin: 0; color: var(--muted); max-width: 42rem; }

    .about-grid {
      display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2rem; align-items: start;
    }
    .about-panel {
      padding: 1.5rem; border-radius: var(--radius);
      background:
        linear-gradient(160deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 55%),
        var(--bg-elev);
      border: 1px solid var(--line);
      min-height: 220px;
      display: grid; align-content: end;
    }
    .about-panel p {
      margin: 0; font-family: Outfit, sans-serif; font-size: 1.25rem;
      line-height: 1.35; letter-spacing: -0.02em;
    }

    .fixes { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.85rem; }
    .fixes li {
      display: grid; grid-template-columns: 2.4rem 1fr; gap: 0.9rem; align-items: start;
      padding: 1.1rem 1.15rem; border-radius: var(--radius);
      border: 1px solid var(--line); background: rgba(255,255,255,0.025);
      animation: rise 0.75s var(--ease) calc(0.08s * var(--i)) both;
    }
    .fix-num {
      width: 2.2rem; height: 2.2rem; border-radius: 50%;
      display: grid; place-items: center;
      font-weight: 700; font-size: 0.9rem;
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    }
    .fixes strong { display: block; margin-bottom: 0.25rem; }
    .fixes p { margin: 0; color: var(--muted); font-size: 0.95rem; }

    .cta-band {
      padding: clamp(2.5rem, 6vw, 4rem) 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      background:
        radial-gradient(ellipse 60% 80% at 80% 50%, color-mix(in srgb, var(--accent2) 12%, transparent), transparent 60%),
        rgba(255,255,255,0.02);
    }
    .cta-band .wrap {
      display: flex; flex-wrap: wrap; justify-content: space-between;
      align-items: center; gap: 1.5rem;
    }
    .cta-band h2 { margin: 0 0 0.4rem; }
    .cta-band p { margin: 0; color: var(--muted); max-width: 34rem; }

    footer {
      padding: 1.75rem 0 2.25rem; color: var(--muted); font-size: 0.88rem;
    }
    footer a { color: var(--accent2); text-decoration: none; }

    @keyframes rise {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 800px) {
      .nav { display: none; }
      .about-grid { grid-template-columns: 1fr; }
      .service { grid-template-columns: 3rem 1fr; }
      .hero { min-height: auto; padding-top: 1.5rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important; transition: none !important;
      }
    }
  </style>
</head>
<body data-mood="${escapeHtml(mood)}">
  <div class="banner">
    <div class="wrap">
      Tämä on <strong>Sivux-demo</strong> analyysin pohjalta — ei vielä virallinen tuotantosivu.
      ${sourceUrl ? ' Alkuperäinen: <a href="' + escapeHtml(sourceUrl) + '" rel="noopener noreferrer" target="_blank">' + escapeHtml(sourceUrl) + "</a>" : ""}
    </div>
  </div>

  <div class="wrap">
    <header class="site-header">
      <a class="logo" href="#top">${escapeHtml(brand)}</a>
      <nav class="nav" aria-label="Sivun osiot">
        <a href="#palvelut">Palvelut</a>
        <a href="#ilme">Ilme</a>
        <a href="#parannukset">Parannukset</a>
        <a href="#yhteys">Yhteys</a>
      </nav>
    </header>
  </div>

  <main id="top">
    <section class="hero">
      <div class="hero-bg" aria-hidden="true"></div>
      <div class="wrap hero-inner">
        ${scoreChip}
        <p class="brand-mark">${escapeHtml(brand)}</p>
        <h1>${escapeHtml(headline)}</h1>
        <p class="lead">${escapeHtml(lead)}</p>
        <div class="actions">
          ${mailLink}
          ${phoneLink}
        </div>
        <ul class="proof" aria-label="Demossa korostuvat hyödyt">${proofHtml}</ul>
      </div>
    </section>

    <section class="section" id="palvelut">
      <div class="wrap">
        <p class="section-kicker">Mitä demossa tapahtuu</p>
        <h2>Rakenne, joka ohjaa eteenpäin</h2>
        <p class="section-lead">Ei täytettä — vain ne kohdat, jotka tekevät etusivusta selkeän, luotettavan ja miellyttävän katsoa.</p>
        <div class="services">${servicesHtml}</div>
      </div>
    </section>

    <section class="section" id="ilme">
      <div class="wrap about-grid">
        <div>
          <p class="section-kicker">Silmälle miellyttävä</p>
          <h2>Ilme, joka tuntuu premiumilta</h2>
          <p class="section-lead">${escapeHtml(about)}</p>
        </div>
        <aside class="about-panel">
          <p>Vahvempi typografia, selkeä hierarkia ja CTA joka erottuu — ilman geneeristä teema-ilmettä.</p>
        </aside>
      </div>
    </section>

    <section class="section" id="parannukset">
      <div class="wrap">
        <p class="section-kicker">Analyysin pohjalta</p>
        <h2>Korjaukset, jotka demossa on huomioitu</h2>
        <p class="section-lead">Priorisoitu lista siitä, mitä tällä demolla parannetaan suhteessa nykyiseen sivuun.</p>
        <ul class="fixes">${fixesHtml}</ul>
      </div>
    </section>

    <section class="cta-band" id="yhteys">
      <div class="wrap">
        <div>
          <h2>Otetaan tämä tuotantoon?</h2>
          <p>Jos demosivu tuntuu oikealta suunnalta, Sivux toteuttaa valmiin sivuston — sisältö, julkaisu ja jatkuva tuki.</p>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="mailto:info@sivux.fi?subject=${encodeURIComponent("Haluan tämän demosivun tuotantoon: " + brand)}">Kyllä, haluan tämän liveen</a>
          <a class="btn btn-ghost" href="https://sivux.fi/sivustoanalyysi">Takaisin analyysiin</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="wrap">
      Demo by <a href="https://sivux.fi">Sivux</a> · Y-tunnus 3616701-3 · Preview only
    </div>
  </footer>
</body>
</html>`;
}

module.exports = {
  buildPreviewHtml,
  pickBrandName,
  escapeHtml,
};
