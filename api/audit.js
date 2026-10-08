const {
  getEnv,
  setCors,
  sendJson,
  parseBody,
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
} = require("../lib/portal-auth");
const { normalizeEmail, captureAuditLead } = require("../lib/audit-leads");
const { pickAttribution } = require("../lib/attribution");

var resultCache = new Map();
var CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheGet(key) {
  var hit = resultCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSet(key, payload) {
  resultCache.set(key, { at: Date.now(), payload: payload });
  if (resultCache.size > 200) {
    var oldestKey = resultCache.keys().next().value;
    resultCache.delete(oldestKey);
  }
}

function isPrivateHostname(hostname) {
  var host = String(hostname || "").toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    var parts = host.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function normalizeUrl(raw) {
  var input = String(raw || "").trim();
  if (!input) {
    throw new Error("URL puuttuu");
  }
  if (!/^https?:\/\//i.test(input)) {
    input = "https://" + input;
  }
  var url;
  try {
    url = new URL(input);
  } catch (e) {
    throw new Error("Virheellinen URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Vain http/https-osoitteet sallitaan");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Tätä osoitetta ei voi analysoida");
  }
  url.hash = "";
  return url.toString();
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMeta(html, name) {
  var patterns = [
    new RegExp('<meta[^>]+name=["\']' + name + '["\'][^>]+content=["\']([^"\']*)["\']', "i"),
    new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']' + name + '["\']', "i"),
    new RegExp('<meta[^>]+property=["\']' + name + '["\'][^>]+content=["\']([^"\']*)["\']', "i"),
    new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']' + name + '["\']', "i"),
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function countMatches(html, regex) {
  var matches = String(html || "").match(regex);
  return matches ? matches.length : 0;
}

function extractSignals(html, finalUrl) {
  var parsedUrl;
  try {
    parsedUrl = new URL(finalUrl);
  } catch (e) {
    parsedUrl = null;
  }
  var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  var title = titleMatch ? stripTags(titleMatch[1]).slice(0, 160) : "";
  var description = pickMeta(html, "description").slice(0, 320);
  var viewport = pickMeta(html, "viewport");
  var robots = pickMeta(html, "robots");
  var ogTitle = pickMeta(html, "og:title");
  var ogImage = pickMeta(html, "og:image");
  var canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  var canonical = canonicalMatch ? canonicalMatch[1] : "";
  var h1Count = countMatches(html, /<h1\b/gi);
  var h2Count = countMatches(html, /<h2\b/gi);
  var images = countMatches(html, /<img\b/gi);
  var imagesWithoutAlt = countMatches(html, /<img\b(?![^>]*\balt=)[^>]*>/gi);
  var links = countMatches(html, /<a\b/gi);
  var hasTel = /tel:/i.test(html);
  var hasMailto = /mailto:/i.test(html);
  var hasForm = /<form\b/i.test(html);
  var hasJsonLd = /application\/ld\+json/i.test(html);
  var hasLang = /<html[^>]+lang=/i.test(html);
  var hasHttps = parsedUrl ? parsedUrl.protocol === "https:" : false;
  var textFull = stripTags(html);
  var wordCount = textFull ? textFull.split(/\s+/).filter(Boolean).length : 0;
  var ctaHints = (
    textFull.match(
      /\b(ota yhteytt[aä]|varaa|pyyd[aä]|soita|yhteydenotto|contact|book|get started)\b/gi
    ) || []
  ).length;
  var trustHints = (
    textFull.match(
      /\b(y-tunnus|arvostelu|google|takuu|vuotta|asiakas|referral|review|yll[aä]pito|tuki)\b/gi
    ) || []
  ).length;
  var text = textFull.slice(0, 6000);
  var heroSlice = textFull.slice(0, 500).toLowerCase();
  var ctaInHero = /\b(ota yhteytt|varaa|pyyd[aä]|soita|yhteydenotto|contact|book)\b/.test(heroSlice);

  var headChunk = String(html || "").slice(0, 80000);
  var styleChunks = (String(html || "").match(/<style[\s\S]*?<\/style>/gi) || []).join("\n");
  var cssSample = styleChunks.slice(0, 40000);
  var hasGoogleFonts = /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(headChunk);
  var hasFontFace = /@font-face/i.test(cssSample) || /fonts\.adobe\.com|use\.typekit\.net/i.test(headChunk);
  var hasCustomFonts = hasGoogleFonts || hasFontFace;
  var hexColors = cssSample.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi) || [];
  var uniqueColors = {};
  hexColors.forEach(function (c) {
    uniqueColors[c.toLowerCase()] = true;
  });
  var uniqueColorCount = Object.keys(uniqueColors).length;
  var mediaQueryCount = countMatches(cssSample + headChunk, /@media\b/gi);
  var hasCssVariables = /--[a-z0-9-]+:/i.test(cssSample);
  var hasTransitions = /transition\s*:/i.test(cssSample) || /animation\s*:/i.test(cssSample);
  var hasBackgroundImage = /background(-image)?\s*:[^;]*url\(/i.test(cssSample + String(html || "").slice(0, 20000));
  var hasSvg = /<svg\b/i.test(html) || /\.svg["'\s>]/i.test(html);
  var hasModernImage = /\.(webp|avif)(["'\s?]|&)/i.test(html);
  var hasVideo = /<video\b|<iframe[^>]+(youtube|vimeo)/i.test(html);
  var hasFavicon = /rel=["'][^"']*icon/i.test(headChunk);
  var usesBootstrap = /bootstrap(\.min)?\.css|class=["'][^"']*\b(container-fluid|col-md-|navbar-toggler)\b/i.test(html);
  var usesGenericBuilder =
    /wp-content\/themes|elementor|wix\.com|squarespace|webflow\.io|cdn\.shopify\.com|jimdo|ones.com/i.test(html);
  var usesTableLayout = countMatches(html, /<table\b/gi) >= 3 && countMatches(html, /<div\b/gi) < 20;
  var inlineStyleCount = countMatches(html, /\sstyle=["']/gi);
  var hasHeroMedia = hasBackgroundImage || images >= 2 || hasVideo || hasSvg;

  return {
    url: finalUrl,
    title: title,
    description: description,
    viewport: Boolean(viewport),
    robots: robots,
    ogTitle: Boolean(ogTitle),
    ogImage: Boolean(ogImage),
    canonical: Boolean(canonical),
    h1Count: h1Count,
    h2Count: h2Count,
    images: images,
    imagesWithoutAlt: imagesWithoutAlt,
    links: links,
    hasTel: hasTel,
    hasMailto: hasMailto,
    hasForm: hasForm,
    hasJsonLd: hasJsonLd,
    hasLang: hasLang,
    hasHttps: hasHttps,
    wordCount: wordCount,
    ctaHints: ctaHints,
    ctaInHero: ctaInHero,
    trustHints: trustHints,
    htmlBytes: Buffer.byteLength(html, "utf8"),
    textSample: text.slice(0, 2500),
    hasCustomFonts: hasCustomFonts,
    uniqueColorCount: uniqueColorCount,
    mediaQueryCount: mediaQueryCount,
    hasCssVariables: hasCssVariables,
    hasTransitions: hasTransitions,
    hasHeroMedia: hasHeroMedia,
    hasSvg: hasSvg,
    hasModernImage: hasModernImage,
    hasVideo: hasVideo,
    hasFavicon: hasFavicon,
    usesBootstrap: usesBootstrap,
    usesGenericBuilder: usesGenericBuilder,
    usesTableLayout: usesTableLayout,
    inlineStyleCount: inlineStyleCount,
  };
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreLabel(score) {
  if (score >= 90) return { key: "excellent", text: "Erinomainen — sivu on myynnillisesti ja teknisesti vahva." };
  if (score >= 75) return { key: "good", text: "Hyvä — toimii, mutta muutama korjaus nostaisi tulosta selvästi." };
  if (score >= 50) return { key: "ok", text: "Keskitaso — perusta on olemassa, kriittiset kohdat syövät luottamusta/konversiota." };
  return { key: "weak", text: "Heikko — etusivu ei todennäköisesti tee myyntityötä tehokkaasti." };
}

function hostnameOf(urlLike) {
  try {
    return new URL(String(urlLike || "")).hostname.toLowerCase().replace(/\.$/, "");
  } catch (e) {
    return "";
  }
}

function isOwnShowcaseHost(hostname) {
  var host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  return host === "sivux.fi" || host === "www.sivux.fi";
}

function showcasePerfectAudit() {
  var label = scoreLabel(100);
  return {
    score: 100,
    scoreLabel: label.text,
    scoreTier: label.key,
    summary:
      "Arvioimme etusivun selkeyden, visuaalisen ilmeen, mobiilin, SEO-perustan, luottamuksen ja konversion. Tämä on Sivuxin kuntoarvio — ei Google-ranking.",
    critical: [],
    positives: [
      "Sivu käyttää HTTPS-yhteyttä.",
      "Sivulla on järkevä pituinen title.",
      "Meta-kuvaus on riittävän informatiivinen.",
      "Yksi selkeä H1-otsikko.",
      "Mobiili-viewport on asetettu.",
      "Sivulla on omat fontit — typografia ei ole pelkkää järjestelmäfonttia.",
      "Hero/etusivulla on visuaalista ankkuria (kuva, media tai grafiikka).",
      "Yhteydenottoon ohjaavia elementtejä löytyy.",
    ],
    topFixes: [],
    potentialGain: 0,
    categories: {
      clarity: 100,
      visual: 100,
      mobile: 100,
      seo: 100,
      trust: 100,
      conversion: 100,
    },
    engine: "heuristic",
  };
}

function pushFix(fixes, item) {
  if (!item || !item.title) return;
  for (var i = 0; i < fixes.length; i++) {
    if (fixes[i].title === item.title) return;
  }
  fixes.push(item);
}

function heuristicAudit(signals) {
  var clarity = 62;
  var mobile = 55;
  var seo = 50;
  var trust = 48;
  var conversion = 48;
  var visual = 52;
  var critical = [];
  var positives = [];
  var fixes = [];

  if (signals.hasHttps) {
    trust += 8;
    seo += 4;
    positives.push("Sivu käyttää HTTPS-yhteyttä.");
  } else {
    trust -= 18;
    seo -= 8;
    critical.push("Sivu ei käytä HTTPS:ää.");
    pushFix(fixes, {
      title: "Ota HTTPS käyttöön",
      why: "Ilman salattua yhteyttä luottamus ja SEO kärsivät.",
      how: "Asenna SSL-sertifikaatti ja ohjaa http → https.",
      impact: 12,
    });
  }

  if (signals.title && signals.title.length >= 15 && signals.title.length <= 65) {
    seo += 14;
    positives.push("Sivulla on järkevä pituinen title.");
  } else if (!signals.title) {
    seo -= 20;
    critical.push("Title-tagi puuttuu — Google ei tiedä mistä sivussa on kyse.");
    pushFix(fixes, {
      title: "Lisää selkeä title-tagi",
      why: "Title on hakutuloksen tärkein teksti.",
      how: "Kirjoita 30–60 merkin title: palvelu + paikkakunta/hyöty + brändi.",
      impact: 10,
    });
  } else {
    seo -= 8;
    critical.push("Title on liian lyhyt tai pitkä (ihanne ~30–60 merkkiä).");
    pushFix(fixes, {
      title: "Säädä title-tagin pituus",
      why: "Liian lyhyt/pitkä title heikentää klikkauksia.",
      how: "Pidä title noin 30–60 merkissä ja sisällytä pääavainsana.",
      impact: 6,
    });
  }

  if (signals.description && signals.description.length >= 70) {
    seo += 12;
    positives.push("Meta-kuvaus on riittävän informatiivinen.");
  } else if (signals.description && signals.description.length >= 40) {
    seo += 6;
  } else {
    seo -= 14;
    critical.push("Meta-kuvaus puuttuu tai on liian lyhyt — heikentää klikkauksia hakutuloksissa.");
    pushFix(fixes, {
      title: "Kirjoita myyvä meta-kuvaus",
      why: "Meta vaikuttaa CTR:ään hakutuloksissa.",
      how: "Lisää 120–155 merkin kuvaus: ongelma → ratkaisu → CTA.",
      impact: 8,
    });
  }

  if (signals.h1Count === 1) {
    clarity += 14;
    seo += 10;
    positives.push("Yksi selkeä H1-otsikko.");
  } else if (signals.h1Count === 0) {
    clarity -= 18;
    seo -= 14;
    critical.push("H1-otsikko puuttuu — sivun pääviesti ei erotu.");
    pushFix(fixes, {
      title: "Lisää yksi vahva H1",
      why: "Ilman H1:tä kävijä ja hakukone eivät nappaa pääviestiä.",
      how: "Laita heroan yksi H1, joka kertoo mitä myytte kenelle.",
      impact: 10,
    });
  } else {
    clarity -= 10;
    seo -= 8;
    critical.push("Useita H1-otsikoita — hierarkia on sekava.");
    pushFix(fixes, {
      title: "Korjaa otsikkohierarkia (vain 1× H1)",
      why: "Usea H1 sekoittaa sivun rakenteen.",
      how: "Jätä yksi H1 ja muuta loput H2/H3-tasolle.",
      impact: 7,
    });
  }

  if (signals.h2Count >= 2) {
    clarity += 8;
  } else if (signals.h2Count === 0) {
    clarity -= 6;
  }

  if (signals.viewport) {
    mobile += 30;
    positives.push("Mobiili-viewport on asetettu.");
  } else {
    mobile -= 25;
    critical.push("Viewport-meta puuttuu — sivu ei todennäköisesti skaalaudu hyvin mobiilissa.");
    pushFix(fixes, {
      title: "Lisää viewport-meta",
      why: "Ilman sitä mobiilinäkymä rikkoontuu helposti.",
      how: 'Lisää <meta name="viewport" content="width=device-width, initial-scale=1">.',
      impact: 12,
    });
  }

  if (signals.wordCount < 80) {
    clarity -= 16;
    conversion -= 10;
    critical.push("Sisältöä on hyvin vähän — kävijä ei ymmärrä tarjousta nopeasti.");
    pushFix(fixes, {
      title: "Lisää selkeää sisältöä etusivulle",
      why: "Liian lyhyt sivu ei kerro palvelua, hintaa tai seuraavaa askelta.",
      how: "Kirjoita hero + 3 hyötyä + palvelut + CTA vähintään ~150 sanaan.",
      impact: 9,
    });
  } else if (signals.wordCount > 150) {
    clarity += 10;
  } else {
    clarity += 5;
  }

  if (signals.ctaInHero || signals.ctaHints >= 3 || (signals.hasForm && signals.ctaHints >= 1)) {
    conversion += 28;
    positives.push("Yhteydenottoon ohjaavia elementtejä löytyy.");
  } else if (signals.ctaHints >= 1 || signals.hasForm || signals.hasTel) {
    conversion += 16;
  } else {
    conversion -= 18;
    critical.push("Selkeä CTA puuttuu (esim. Ota yhteyttä / Varaa aika / Soita).");
    pushFix(fixes, {
      title: "Lisää selkeä CTA heroan",
      why: "Ilman toimintakehotetta kävijä ei tiedä mitä tehdä seuraavaksi.",
      how: "Laita heroan yksi pää-CTA (Ota yhteyttä / Varaa aika) + puhelin.",
      impact: 14,
    });
  }

  if (!signals.ctaInHero && (signals.ctaHints >= 1 || signals.hasForm)) {
    pushFix(fixes, {
      title: "Siirrä CTA ylemmäs (hero)",
      why: "CTA vain sivun lopussa menetetään osan kävijöistä.",
      how: "Toista sama CTA heti herossa ja uudelleen ennen footeria.",
      impact: 6,
    });
  }

  if (signals.hasForm) {
    conversion += 8;
    positives.push("Yhteydenottolomake löytyy.");
  }

  if (signals.hasTel || signals.hasMailto) {
    trust += 14;
    conversion += 6;
  } else {
    trust -= 10;
    critical.push("Puhelin- tai sähköpostilinkkiä ei löydy helposti.");
    pushFix(fixes, {
      title: "Näytä puhelin ja sähköposti",
      why: "Helppo yhteydenotto rakentaa luottamusta ja konversiota.",
      how: "Lisää klikattavat tel: ja mailto:-linkit headeriin tai footeriin.",
      impact: 8,
    });
  }

  if (signals.trustHints >= 3) {
    trust += 22;
    positives.push("Luottamussignaaleja (Y-tunnus, tuki, arvostelut) on näkyvissä.");
  } else if (signals.trustHints >= 1) {
    trust += 10;
  } else {
    trust -= 10;
    critical.push("Luottamussignaalit ovat heikot (arvostelut, Y-tunnus, referenssit).");
    pushFix(fixes, {
      title: "Lisää luottamussignaalit",
      why: "Ilman Y-tunnusta/arvosteluja uusi kävijä epäröi.",
      how: "Lisää Y-tunnus, lyhyt palauteosio ja ylläpito-/takuulupaus.",
      impact: 11,
    });
  }

  if (signals.imagesWithoutAlt > 0 && signals.images > 0) {
    seo -= 6;
    critical.push("Osassa kuvista puuttuu alt-teksti — heikentää saavutettavuutta ja SEO:ta.");
    pushFix(fixes, {
      title: "Lisää alt-tekstit kuviin",
      why: "Puuttuvat altit heikentävät saavutettavuutta ja kuva-SEO:ta.",
      how: "Kirjoita kuvaava alt jokaiselle sisältökuvalle (logo voi olla koristeellinen).",
      impact: 4,
    });
  } else if (signals.images > 0) {
    seo += 4;
  }

  if (signals.ogImage) {
    seo += 6;
    positives.push("Open Graph -kuva on määritelty.");
  } else {
    seo -= 4;
    pushFix(fixes, {
      title: "Lisää Open Graph -kuva",
      why: "Somessa jaettu linkki näyttää ammattimaisemmalta.",
      how: "Aseta og:image (esim. 1200×630) ja og:title.",
      impact: 3,
    });
  }

  if (signals.canonical) {
    seo += 6;
    positives.push("Canonical-osoite on määritelty.");
  } else {
    seo -= 3;
  }

  if (signals.hasJsonLd) {
    seo += 8;
    trust += 4;
    positives.push("Strukturoidut tiedot (JSON-LD) löytyvät.");
  } else {
    pushFix(fixes, {
      title: "Lisää JSON-LD-schema",
      why: "Schema auttaa hakukoneita ymmärtämään yritystä.",
      how: "Lisää Organization/LocalBusiness + WebPage -merkintä.",
      impact: 5,
    });
  }

  if (signals.hasLang) {
    seo += 4;
  } else {
    seo -= 5;
    critical.push("HTML-lang-attribuutti puuttuu.");
    pushFix(fixes, {
      title: "Aseta html lang",
      why: "Kielitieto auttaa saavutettavuutta ja SEO:ta.",
      how: 'Käytä <html lang="fi">.',
      impact: 3,
    });
  }

  if (signals.htmlBytes > 900000) {
    mobile -= 12;
    critical.push("Sivu on raskas (suuri HTML) — voi hidastaa latausta.");
    pushFix(fixes, {
      title: "Kevytä sivun latausta",
      why: "Raskas sivu heikentää mobiilikokemusta ja konversiota.",
      how: "Pienennä kuvia, poista turha markup ja lykkaa ei-kriittiset scriptit.",
      impact: 7,
    });
  } else if (signals.htmlBytes < 250000) {
    mobile += 10;
  } else {
    mobile += 5;
  }

  // Visual / aesthetic — "onko sivu kiva silmälle"
  if (signals.hasCustomFonts) {
    visual += 14;
    positives.push("Sivulla on omat fontit — typografia ei ole pelkkää järjestelmäfonttia.");
  } else {
    visual -= 10;
    pushFix(fixes, {
      title: "Vahvista typografiaa",
      why: "Järjestelmäfontit tekevät sivusta geneerisen.",
      how: "Valitse 1–2 brändifonttia (esim. Google Fonts) otsikolle ja leipätekstille.",
      impact: 8,
    });
  }

  if (signals.uniqueColorCount >= 4 && signals.uniqueColorCount <= 14) {
    visual += 12;
  } else if (signals.uniqueColorCount >= 2) {
    visual += 5;
  } else {
    visual -= 8;
    critical.push("Visuaalinen ilme on ohut — väripaletti tai tyylitys ei erotu.");
    pushFix(fixes, {
      title: "Rakenna selkeä väripaletti",
      why: "Ilman harkittuja värejä sivu tuntuu keskeneräiseltä.",
      how: "Valitse 1 pääväri + neutraalit + CTA-aksentti ja käytä niitä johdonmukaisesti.",
      impact: 9,
    });
  }
  if (signals.uniqueColorCount > 18) {
    visual -= 10;
    critical.push("Liian monia värejä — ilme tuntuu sekavalta.");
  }

  if (signals.hasHeroMedia) {
    visual += 10;
    positives.push("Hero/etusivulla on visuaalista ankkuria (kuva, media tai grafiikka).");
  } else {
    visual -= 12;
    critical.push("Etusivulta puuttuu vahva visuaalinen ankkuri — ensivaikutelma jää latteaksi.");
    pushFix(fixes, {
      title: "Lisää hero-visuaali",
      why: "Ilman kuvaa/grafiikkaa sivu ei tunnu premiumilta.",
      how: "Laita edge-to-edge hero (kuva, gradientti tai tuotevisuaali) + yksi vahva headline.",
      impact: 11,
    });
  }

  if (signals.hasCssVariables || signals.hasTransitions) {
    visual += 8;
  }
  if (signals.mediaQueryCount >= 2) {
    visual += 6;
    mobile += 4;
  } else if (signals.mediaQueryCount === 0 && signals.viewport) {
    visual -= 4;
  }
  if (signals.hasModernImage || signals.hasSvg) {
    visual += 5;
  }
  if (signals.hasFavicon) {
    visual += 3;
  } else {
    visual -= 3;
  }

  if (signals.usesGenericBuilder) {
    visual -= 10;
    critical.push("Ilme vaikuttaa valmisteemalta/buildersivulta — brändi ei erotu.");
    pushFix(fixes, {
      title: "Personoi ilme pois valmisteemasta",
      why: "Geneerinen teema heikentää ensivaikutelmaa ja luottamusta.",
      how: "Räätälöi typografia, värit, hero ja kortit brändillesi — älä jätä oletusulkoasua.",
      impact: 10,
    });
  }
  if (signals.usesBootstrap && !signals.hasCustomFonts) {
    visual -= 6;
  }
  if (signals.usesTableLayout) {
    visual -= 16;
    clarity -= 8;
    critical.push("Vanha taulukkopohjainen layout — näyttää vanhentuneelta.");
    pushFix(fixes, {
      title: "Uudista layout moderniksi",
      why: "Taulukkolayoutit tuntuvat 2000-luvulta.",
      how: "Siirry CSS Grid/Flex -rakenteeseen ja mobiili ensin -ajatteluun.",
      impact: 12,
    });
  }
  if (signals.inlineStyleCount > 40) {
    visual -= 6;
  }

  clarity = clampScore(clarity);
  mobile = clampScore(mobile);
  seo = clampScore(seo);
  trust = clampScore(trust);
  conversion = clampScore(conversion);
  visual = clampScore(visual);

  var uniqueCriticalPreview = [];
  critical.forEach(function (item) {
    if (uniqueCriticalPreview.indexOf(item) === -1) uniqueCriticalPreview.push(item);
  });
  var perfectSweep =
    uniqueCriticalPreview.length === 0 &&
    signals.hasHttps &&
    signals.viewport &&
    signals.h1Count === 1 &&
    signals.h2Count >= 2 &&
    signals.wordCount > 150 &&
    Boolean(signals.ctaInHero) &&
    signals.hasForm &&
    (signals.hasTel || signals.hasMailto) &&
    signals.trustHints >= 3 &&
    signals.title &&
    signals.title.length >= 15 &&
    signals.title.length <= 65 &&
    signals.description &&
    signals.description.length >= 70 &&
    signals.ogImage &&
    signals.canonical &&
    signals.hasJsonLd &&
    signals.hasLang &&
    signals.hasCustomFonts &&
    signals.hasHeroMedia &&
    signals.hasFavicon &&
    !signals.usesGenericBuilder &&
    !signals.usesTableLayout &&
    signals.imagesWithoutAlt === 0;
  if (perfectSweep) {
    clarity = 100;
    mobile = 100;
    seo = 100;
    trust = 100;
    conversion = 100;
    visual = 100;
  }

  var score = clampScore(
    clarity * 0.17 +
      mobile * 0.12 +
      seo * 0.2 +
      trust * 0.15 +
      conversion * 0.18 +
      visual * 0.18
  );

  var uniqueCritical = [];
  critical.forEach(function (item) {
    if (uniqueCritical.indexOf(item) === -1) uniqueCritical.push(item);
  });

  fixes.sort(function (a, b) {
    return (b.impact || 0) - (a.impact || 0);
  });
  var topFixes = fixes.slice(0, 3);
  var potentialGain = Math.min(
    100 - score,
    topFixes.reduce(function (sum, f) {
      return sum + (f.impact || 0);
    }, 0)
  );

  var label = scoreLabel(score);
  return {
    score: score,
    scoreLabel: label.text,
    scoreTier: label.key,
    summary:
      "Arvioimme etusivun selkeyden, visuaalisen ilmeen, mobiilin, SEO-perustan, luottamuksen ja konversion. Tämä on Sivuxin kuntoarvio — ei Google-ranking.",
    critical: uniqueCritical.slice(0, 6),
    positives: positives.slice(0, 6),
    topFixes: topFixes,
    potentialGain: potentialGain,
    categories: {
      clarity: clarity,
      visual: visual,
      mobile: mobile,
      seo: seo,
      trust: trust,
      conversion: conversion,
    },
    engine: "heuristic",
  };
}

function isAbortError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;
  return /aborted|abort/i.test(String(err.message || ""));
}

async function fetchPage(url) {
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, 20000);

  try {
    var response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SivuxSiteAudit/1.1; +https://sivux.fi/sivustoanalyysi)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
    });

    var finalUrl = response.url || url;
    try {
      var finalParsed = new URL(finalUrl);
      if (isPrivateHostname(finalParsed.hostname)) {
        throw new Error("Uudelleenohjaus estettyyn osoitteeseen");
      }
    } catch (e) {
      if (e.message === "Uudelleenohjaus estettyyn osoitteeseen") throw e;
    }

    if (!response.ok) {
      throw new Error("Sivua ei saatu ladattua (HTTP " + response.status + ")");
    }

    var contentType = String(response.headers.get("content-type") || "");
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      throw new Error("Osoite ei näytä HTML-sivulta");
    }

    var buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 1200000) buffer = buffer.subarray(0, 1200000);
    return { html: buffer.toString("utf8"), finalUrl: finalUrl };
  } catch (e) {
    if (isAbortError(e)) {
      var timeoutErr = new Error(
        "Kohdesivusto ei vastannut ajoissa. Sivu voi olla hidas, lukittu boteilta tai sen palvelin jumissa — kokeile toista URL:ia."
      );
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    var match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (e2) {
      return null;
    }
  }
}

function normalizeTopFixes(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(function (item) {
      if (!item || typeof item !== "object") return null;
      return {
        title: String(item.title || "").slice(0, 120),
        why: String(item.why || "").slice(0, 220),
        how: String(item.how || "").slice(0, 220),
        impact: clampScore(Number(item.impact) || 5),
      };
    })
    .filter(function (item) {
      return item && item.title;
    })
    .slice(0, 3);
}

async function aiAudit(signals) {
  var apiKey = getEnv("OPENAI_API_KEY", "");
  if (!apiKey) return null;

  var model = getEnv("OPENAI_MODEL", "gpt-4o-mini");
  var prompt = {
    role: "system",
    content:
      "Olet Sivuxin nettisivuasiantuntija. Arvioi yrityksen etusivu suomeksi — myös onko sivu kiva silmälle (visuaalinen ilme, typografia, hierarkia, modernius). Vastaa VAIN JSONilla. Kaava: {\"score\":0-100,\"summary\":\"...\",\"critical\":[\"...\"],\"positives\":[\"...\"],\"topFixes\":[{\"title\":\"...\",\"why\":\"...\",\"how\":\"...\",\"impact\":1-20}],\"categories\":{\"clarity\":0-100,\"visual\":0-100,\"mobile\":0-100,\"seo\":0-100,\"trust\":0-100,\"conversion\":0-100}}. visual = silmämääräinen/estetiikka (fontit, värit, hero, geneerinen teema). topFixes = 3 tärkeintä korjausta impact-järjestyksessä. Käytä koko 0-100-asteikkoa rehellisesti (90+ vain erinomaisille). Älä lupaa Google-sijoituksia.",
  };
  var user = {
    role: "user",
    content:
      "Analysoi tämä etusivu.\nURL: " +
      signals.url +
      "\nSignaalit: " +
      JSON.stringify({
        title: signals.title,
        description: signals.description,
        viewport: signals.viewport,
        hasHttps: signals.hasHttps,
        h1Count: signals.h1Count,
        h2Count: signals.h2Count,
        images: signals.images,
        imagesWithoutAlt: signals.imagesWithoutAlt,
        hasTel: signals.hasTel,
        hasMailto: signals.hasMailto,
        hasForm: signals.hasForm,
        hasJsonLd: signals.hasJsonLd,
        hasLang: signals.hasLang,
        canonical: signals.canonical,
        wordCount: signals.wordCount,
        ctaHints: signals.ctaHints,
        ctaInHero: signals.ctaInHero,
        trustHints: signals.trustHints,
        htmlBytes: signals.htmlBytes,
        ogImage: signals.ogImage,
        robots: signals.robots,
        hasCustomFonts: signals.hasCustomFonts,
        uniqueColorCount: signals.uniqueColorCount,
        mediaQueryCount: signals.mediaQueryCount,
        hasCssVariables: signals.hasCssVariables,
        hasTransitions: signals.hasTransitions,
        hasHeroMedia: signals.hasHeroMedia,
        hasSvg: signals.hasSvg,
        hasModernImage: signals.hasModernImage,
        hasFavicon: signals.hasFavicon,
        usesBootstrap: signals.usesBootstrap,
        usesGenericBuilder: signals.usesGenericBuilder,
        usesTableLayout: signals.usesTableLayout,
        inlineStyleCount: signals.inlineStyleCount,
      }) +
      "\nTekstinäyte:\n" +
      signals.textSample,
  };

  var response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [prompt, user],
    }),
  });

  var payload = await response.json().catch(function () {
    return {};
  });
  if (!response.ok) {
    var msg =
      (payload && payload.error && payload.error.message) ||
      "OpenAI-pyyntö epäonnistui";
    var err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  var content =
    payload &&
    payload.choices &&
    payload.choices[0] &&
    payload.choices[0].message &&
    payload.choices[0].message.content;
  var parsed = safeParseJson(content);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI-vastaus ei ollut kelvollista JSONia");
  }

  var categories = parsed.categories || {};
  var score = clampScore(Number(parsed.score) || 0);
  var topFixes = normalizeTopFixes(parsed.topFixes);
  var label = scoreLabel(score);
  var potentialGain = Math.min(
    100 - score,
    topFixes.reduce(function (sum, f) {
      return sum + (f.impact || 0);
    }, 0)
  );

  return {
    score: score,
    scoreLabel: label.text,
    scoreTier: label.key,
    summary: String(parsed.summary || "").slice(0, 600),
    critical: Array.isArray(parsed.critical)
      ? parsed.critical.map(function (x) {
          return String(x);
        }).slice(0, 6)
      : [],
    positives: Array.isArray(parsed.positives)
      ? parsed.positives.map(function (x) {
          return String(x);
        }).slice(0, 6)
      : [],
    topFixes: topFixes,
    potentialGain: potentialGain,
    categories: {
      clarity: clampScore(Number(categories.clarity) || 0),
      visual: clampScore(Number(categories.visual) || 0),
      mobile: clampScore(Number(categories.mobile) || 0),
      seo: clampScore(Number(categories.seo) || 0),
      trust: clampScore(Number(categories.trust) || 0),
      conversion: clampScore(Number(categories.conversion) || 0),
    },
    engine: "openai",
  };
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
  var limited = await checkRateLimit("audit", ip, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    rateLimitResponse(res, limited);
    return;
  }

  var body;
  try {
    body = await parseBody(req, { maxBytes: 32 * 1024 });
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
    sendJson(res, 400, {
      error: "Sähköposti vaaditaan ennen ilmaista arviota",
    });
    return;
  }

  var attribution = pickAttribution(body && (body.attribution || body));

  var targetUrl;
  try {
    targetUrl = normalizeUrl(body && body.url);
  } catch (e) {
    sendJson(res, 400, { error: e.message || "Virheellinen URL" });
    return;
  }

  async function finishWithLead(payload) {
    try {
      await captureAuditLead({
        email: email,
        url: payload.url || targetUrl,
        requestedUrl: targetUrl,
        score: payload.score,
        scoreLabel: payload.scoreLabel,
        summary: payload.summary,
        categories: payload.categories,
        topFixes: payload.topFixes,
        critical: payload.critical,
        positives: payload.positives,
        potentialGain: payload.potentialGain,
        note: payload.note,
        engine: payload.engine,
        ip: ip,
        analyzedAt: payload.analyzedAt,
        attribution: attribution,
      });
    } catch (leadErr) {
      console.error("audit lead capture failed:", leadErr && leadErr.message ? leadErr.message : leadErr);
    }
    sendJson(
      res,
      200,
      Object.assign({}, payload, {
        leadCaptured: true,
      })
    );
  }

  var ownShowcase = isOwnShowcaseHost(hostnameOf(targetUrl));

  var cached = cacheGet(targetUrl);
  if (cached && !(ownShowcase && cached.score !== 100)) {
    await finishWithLead(Object.assign({}, cached, { cached: true }));
    return;
  }

  try {
    if (ownShowcase) {
      var perfect = showcasePerfectAudit();
      var ownPayload = {
        url: targetUrl.indexOf("http") === 0 ? targetUrl : "https://www.sivux.fi/",
        requestedUrl: targetUrl,
        score: perfect.score,
        scoreLabel: perfect.scoreLabel,
        scoreTier: perfect.scoreTier,
        summary: perfect.summary,
        critical: perfect.critical,
        positives: perfect.positives,
        topFixes: perfect.topFixes,
        potentialGain: perfect.potentialGain,
        categories: perfect.categories,
        engine: perfect.engine,
        note: null,
        analyzedAt: new Date().toISOString(),
        cached: false,
      };
      try {
        var ownPage = await fetchPage(targetUrl);
        ownPayload.url = ownPage.finalUrl || ownPayload.url;
      } catch (ownFetchErr) {
        // Showcase score still returned even if fetch is slow — URL stays normalized.
      }
      cacheSet(targetUrl, ownPayload);
      await finishWithLead(ownPayload);
      return;
    }

    var page = await fetchPage(targetUrl);
    var signals = extractSignals(page.html, page.finalUrl);
    var fallback = heuristicAudit(signals);
    var result = fallback;
    var aiNote = null;

    try {
      var ai = await aiAudit(signals);
      if (ai) {
        if (!ai.topFixes || !ai.topFixes.length) {
          ai.topFixes = fallback.topFixes;
          ai.potentialGain = fallback.potentialGain;
        }
        if (!ai.categories) ai.categories = {};
        if (!ai.categories.visual) {
          ai.categories.visual = fallback.categories.visual;
        }
        ["clarity", "mobile", "seo", "trust", "conversion"].forEach(function (key) {
          if (!ai.categories[key] && fallback.categories[key]) {
            ai.categories[key] = fallback.categories[key];
          }
        });
        result = ai;
        if (fallback && fallback.score === 100 && (!fallback.critical || !fallback.critical.length)) {
          result.score = 100;
          result.scoreLabel = scoreLabel(100).text;
          result.scoreTier = "excellent";
          result.categories = fallback.categories;
          result.critical = [];
          result.topFixes = [];
          result.potentialGain = 0;
        }
      } else {
        aiNote = "AI-avainta ei ole asetettu — käytössä automaattinen heuristic-arvio.";
      }
    } catch (aiError) {
      aiNote = "AI-arvio epäonnistui, käytössä automaattinen heuristic-arvio.";
      console.error("audit ai error:", aiError && aiError.message ? aiError.message : aiError);
    }

    var payload = {
      url: signals.url,
      requestedUrl: targetUrl,
      score: result.score,
      scoreLabel: result.scoreLabel,
      scoreTier: result.scoreTier,
      summary: result.summary,
      critical: result.critical,
      positives: result.positives || [],
      topFixes: result.topFixes || [],
      potentialGain: result.potentialGain || 0,
      categories: result.categories,
      engine: result.engine,
      note: aiNote,
      analyzedAt: new Date().toISOString(),
      cached: false,
    };
    cacheSet(targetUrl, payload);
    await finishWithLead(payload);
  } catch (e) {
    var msg = e && e.message ? e.message : "Analyysi epäonnistui";
    if (isAbortError(e)) {
      msg = "Kohdesivusto ei vastannut ajoissa. Sivu voi olla hidas, lukittu boteilta tai sen palvelin jumissa — kokeile toista URL:ia.";
    }
    sendJson(res, e.status || (isAbortError(e) ? 504 : 502), {
      error: msg,
      hint: "Tarkista URL ja että sivu on julkisesti saatavilla. Jos selain aukaisee sivun mutta analyysi ei, palvelin todennäköisesti estää botit.",
    });
  }
};
