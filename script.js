(function () {
  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.querySelector(".site-nav");
  var yearEl = document.getElementById("year");
  var siteHeader = document.querySelector(".site-header");
  var toTop = document.getElementById("to-top");
  var navSectionLinks = document.querySelectorAll("[data-nav-section]");
  var smoothScroll = null;

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function initLenis() {
    if (prefersReducedMotion() || typeof window.Lenis !== "function") {
      return null;
    }

    var lenis = new window.Lenis({
      duration: 1.12,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true,
      touchMultiplier: 1.05,
    });

    function raf(time) {
      lenis.raf(time);
      window.requestAnimationFrame(raf);
    }
    window.requestAnimationFrame(raf);

    var chatMessages = document.getElementById("chatbot-messages");
    if (chatMessages) {
      chatMessages.setAttribute("data-lenis-prevent", "");
    }

    return lenis;
  }

  function initScrollUi(lenis) {
    var navOrder = [];
    navSectionLinks.forEach(function (a) {
      var id = a.getAttribute("data-nav-section");
      if (id && navOrder.indexOf(id) === -1) {
        navOrder.push(id);
      }
    });

    var hero = document.querySelector(".hero");
    var ticking = false;
    var lastScrollY = lenis ? lenis.scroll : window.scrollY || document.documentElement.scrollTop || 0;

    function getScrollY() {
      return lenis ? lenis.scroll : window.scrollY || document.documentElement.scrollTop || 0;
    }

    function update() {
      var scrollY = getScrollY();

      if (siteHeader) {
        siteHeader.classList.toggle("is-scrolled", scrollY > 28);
        var scrollingDown = scrollY > lastScrollY;
        var shouldHideHeader = scrollingDown && scrollY > 140;
        siteHeader.classList.toggle("is-hidden", shouldHideHeader);
      }

      if (toTop) {
        toTop.classList.toggle("is-visible", scrollY > 400);
      }

      if (hero && lenis) {
        hero.style.setProperty("--scroll-y", scrollY.toFixed(2) + "px");
      }

      var activeId = "";
      var yLine = scrollY + Math.min(160, window.innerHeight * 0.22);

      for (var i = navOrder.length - 1; i >= 0; i--) {
        var el = document.getElementById(navOrder[i]);
        if (!el) {
          continue;
        }
        var top = el.getBoundingClientRect().top + scrollY;
        if (top <= yLine) {
          activeId = navOrder[i];
          break;
        }
      }

      navSectionLinks.forEach(function (a) {
        var sec = a.getAttribute("data-nav-section");
        if (sec && sec === activeId) {
          a.setAttribute("aria-current", "page");
        } else {
          a.removeAttribute("aria-current");
        }
      });

      lastScrollY = scrollY;
      ticking = false;
    }

    function requestTick() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    if (lenis) {
      lenis.on("scroll", requestTick);
    } else {
      window.addEventListener("scroll", requestTick, { passive: true });
    }
    window.addEventListener("resize", requestTick, { passive: true });
    update();
  }

  function initSmoothAnchors(lenis) {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (event) {
        var hash = link.getAttribute("href");
        if (!hash || hash === "#") {
          return;
        }

        var target = document.querySelector(hash);
        if (!target) {
          return;
        }

        event.preventDefault();
        var offset = siteHeader ? -(siteHeader.offsetHeight + 8) : -80;

        if (lenis) {
          lenis.scrollTo(target, { offset: offset });
          return;
        }

        var top = target.getBoundingClientRect().top + window.scrollY + offset;
        window.scrollTo({ top: top, behavior: "smooth" });
      });
    });
  }

  function initScrollExperience() {
    smoothScroll = initLenis();
    initScrollUi(smoothScroll);
    initSmoothAnchors(smoothScroll);

    if (toTop) {
      toTop.addEventListener("click", function (event) {
        event.preventDefault();
        if (smoothScroll) {
          smoothScroll.scrollTo(0);
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScrollExperience);
  } else {
    initScrollExperience();
  }

  function initScrollReveal() {
    var root = document.documentElement;
    if (!root.classList.contains("js-reveal")) {
      return;
    }

    document.querySelectorAll("[data-reveal-delay]").forEach(function (el) {
      var raw = el.getAttribute("data-reveal-delay") || "0";
      var v = String(raw).trim();
      el.style.setProperty("--reveal-delay", /[a-z%]/i.test(v) ? v : v + "s");
    });

    var targets = document.querySelectorAll("[data-reveal], [data-reveal-group]");
    if (!targets.length) {
      return;
    }

    var mqReduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)");

    function revealAll() {
      targets.forEach(function (el) {
        el.classList.add("is-revealed");
      });
    }

    if (mqReduce && mqReduce.matches) {
      revealAll();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.08,
      }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });

    if (mqReduce && typeof mqReduce.addEventListener === "function") {
      mqReduce.addEventListener("change", function (e) {
        if (e.matches) {
          revealAll();
          observer.disconnect();
        }
      });
    }
  }

  function initHeroInteractiveMotion() {
    var hero = document.querySelector(".hero");
    if (!hero) {
      return;
    }

    var reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      return;
    }

    var rafId = null;
    var targetX = 0;
    var targetY = 0;
    var currentX = 0;
    var currentY = 0;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function render() {
      currentX += (targetX - currentX) * 0.09;
      currentY += (targetY - currentY) * 0.09;

      hero.style.setProperty("--mx", currentX.toFixed(3));
      hero.style.setProperty("--my", currentY.toFixed(3));

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        rafId = window.requestAnimationFrame(render);
      } else {
        rafId = null;
      }
    }

    function queueRender() {
      if (!rafId) {
        rafId = window.requestAnimationFrame(render);
      }
    }

    hero.addEventListener("mousemove", function (event) {
      var rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      var relativeX = (event.clientX - rect.left) / rect.width;
      var relativeY = (event.clientY - rect.top) / rect.height;

      targetX = clamp(relativeX * 2 - 1, -1, 1);
      targetY = clamp(relativeY * 2 - 1, -1, 1);
      queueRender();
    });

    hero.addEventListener("mouseleave", function () {
      targetX = 0;
      targetY = 0;
      queueRender();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScrollReveal);
  } else {
    initScrollReveal();
  }

  function initChatbot() {
    var root = document.getElementById("faq-bot");
    if (!root) {
      return;
    }

    var lang = root.getAttribute("data-lang") === "en" ? "en" : "fi";
    var toggleBtn = document.getElementById("chatbot-toggle");
    var closeBtn = document.getElementById("chatbot-close");
    var panel = document.getElementById("chatbot-panel");
    var messages = document.getElementById("chatbot-messages");
    var form = document.getElementById("chatbot-form");
    var input = document.getElementById("chatbot-input");
    var quick = document.getElementById("chatbot-quick");
    var backdrop = document.createElement("div");
    backdrop.className = "chatbot-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);

    if (!toggleBtn || !panel || !messages || !form || !input) {
      return;
    }

    var content = {
      fi: {
        welcome:
          "Moikka! Voin auttaa yleisissä kysymyksissä (hinta, aikataulu, hakukoneoptimointi, ylläpito).",
        unknown:
          "En osannut vastata tähän varmasti.\nVoit kysyä meiltä suoraan:\n✉ info@sivux.fi\n☎ +358 41 4967337",
        rules: [
          {
            keys: ["hinta", "maks", "paljon", "euro", "paketti"],
            answer:
              "Meillä hinnat alkavat noin 449 EUR + alv. Lopullinen hinta riippuu sivujen määrästä, sisällöstä ja mahdollisista integraatioista.",
          },
          {
            keys: ["kesto", "kauan", "aikataulu", "viikko", "milloin"],
            answer:
              "Tyypillinen projekti kestää noin 1-3 viikkoa. Aikaan vaikuttavat laajuus sekä se, kuinka nopeasti tekstit ja kuvat saadaan käyttöön.",
          },
          {
            keys: ["paivitta", "sisalto", "itse", "cms", "muuttaa"],
            answer:
              "Kyllä, sivun sisältöä voidaan päivittää helposti myös ilman koodiosaamista. Tarvittaessa hoidamme päivitykset myös puolestasi.",
          },
          {
            keys: ["yllapito", "tuki", "bugi", "virhe", "turva"],
            answer:
              "Tarjoamme ylläpitoa, tietoturvapäivityksiä, varmuuskopioita ja teknistä tukea. Ylläpidon laajuus sovitaan tarpeesi mukaan.",
          },
          {
            keys: ["kieli", "english", "englanti", "fi", "en"],
            answer:
              "Sivusto voidaan toteuttaa usealla kielellä, kuten suomeksi ja englanniksi. Kieliversioiden määrä vaikuttaa laajuuteen ja hintaan.",
          },
          {
            keys: ["helsinki", "tampere", "turku", "oulu", "espoo", "vantaa", "jyvaskyla", "lahti", "kuopio", "kaupunki"],
            answer:
              "Kyllä, palvelemme yrityksiä koko Suomessa (mm. Helsinki, Tampere, Turku, Oulu). Toteutus hoituu etänä tai sovitulla tapaamisella.",
          },
          {
            keys: ["sisaltyy", "paketti", "analytics", "ga4", "search console", "seo", "lomake"],
            answer:
              "Paketeissa on nyt avattu konkreettinen sisältö (esim. yhteydenottolomake, GA4, SEO-perusasetukset, 2 kieltä Kasvu-paketissa). Katso hinnasto-osion listat.",
          },
          {
            keys: ["hakukone", "seo", "google", "optimointi", "hakutulos", "nakyvyys", "search console"],
            answer:
              "Kyllä, meiltä onnistuu hakukoneoptimointi. Jokaisessa projektissa teemme SEO-perustan (otsikot, meta, sitemap, nopeus, mobiili). Tarvittaessa teemme myös laajempaa SEO:ta, kuten teknistä optimointia ja paikallista näkyvyyttä.",
          },
          {
            keys: ["kickoff", "aloitus", "palaveri", "ensimma", "ensimmainen"],
            answer:
              "Kickoffissa sovitaan tavoite, kohderyhmä, rakenne, vastuut ja aikataulu. Sen jälkeen saat kirjallisen etenemissuunnitelman.",
          },
        ],
      },
      en: {
        welcome:
          "Hi! I can help with common questions (pricing, timeline, SEO, maintenance).",
        unknown:
          "I am not fully sure about this one.\nPlease contact us directly:\n✉ info@sivux.fi\n☎ +358 41 4967337",
        rules: [
          {
            keys: ["price", "pricing", "cost", "package", "euro"],
            answer:
              "Our projects typically start from around 449 EUR + VAT. Final pricing depends on page count, content scope, and integrations.",
          },
          {
            keys: ["timeline", "how long", "duration", "weeks", "time"],
            answer:
              "A typical project takes about 1-3 weeks. Timing depends on project scope and how quickly content is available.",
          },
          {
            keys: ["update", "content", "cms", "myself", "edit"],
            answer:
              "Yes, we can build the site so content is easy to update without coding. We can also handle updates for you if needed.",
          },
          {
            keys: ["maintenance", "support", "bug", "security", "backup"],
            answer:
              "We offer maintenance, security updates, backups, and technical support. The plan can be tailored to your needs.",
          },
          {
            keys: ["language", "finnish", "english", "fi", "en"],
            answer:
              "We can build multilingual websites, for example in Finnish and English. Scope and pricing depend on the number of language versions.",
          },
          {
            keys: ["helsinki", "tampere", "turku", "oulu", "espoo", "vantaa", "jyvaskyla", "lahti", "kuopio", "city", "cities"],
            answer:
              "Yes. We work with companies across Finland, including Helsinki, Tampere, Turku, and Oulu. Delivery can be fully remote.",
          },
          {
            keys: ["included", "package", "ga4", "analytics", "search console", "seo", "form"],
            answer:
              "Each package now lists concrete scope (for example contact form, GA4 setup, SEO baseline, and FI/EN in the Growth package). Check the pricing section for details.",
          },
          {
            keys: ["seo", "search engine", "google", "optimization", "visibility", "search console"],
            answer:
              "Yes, we also deliver search engine optimization. Every project includes an SEO baseline (titles, meta, sitemap, speed, mobile). We can also do broader SEO such as technical optimization and local visibility.",
          },
          {
            keys: ["kickoff", "first meeting", "onboarding", "start", "discovery call"],
            answer:
              "In kickoff we agree on goals, audience, structure, responsibilities, and timeline. You then receive a written delivery plan.",
          },
        ],
      },
    };

    var dict = content[lang];
    var isOpen = false;

    function normalize(text) {
      return String(text || "")
        .toLowerCase()
        .replace(/[äå]/g, "a")
        .replace(/ö/g, "o")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function addMessage(role, text) {
      var item = document.createElement("p");
      item.className = "chatbot-message " + role;
      item.textContent = text;
      messages.appendChild(item);
      messages.scrollTop = messages.scrollHeight;
    }

    function getAnswer(question) {
      var q = normalize(question);
      var bestScore = 0;
      var bestAnswer = "";
      for (var i = 0; i < dict.rules.length; i++) {
        var keys = dict.rules[i].keys;
        var score = 0;
        for (var j = 0; j < keys.length; j++) {
          if (q.indexOf(normalize(keys[j])) !== -1) {
            score++;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestAnswer = dict.rules[i].answer;
        }
      }
      if (bestScore > 0) {
        return bestAnswer;
      }
      return dict.unknown;
    }

    function openChat() {
      if (isOpen) {
        return;
      }
      isOpen = true;
      if (smoothScroll) {
        smoothScroll.stop();
      }
      root.classList.add("is-open");
      document.body.classList.add("chat-open");
      panel.hidden = false;
      backdrop.hidden = false;
      toggleBtn.setAttribute("aria-expanded", "true");
      input.focus();
    }

    function closeChat() {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      if (smoothScroll) {
        smoothScroll.start();
      }
      root.classList.remove("is-open");
      document.body.classList.remove("chat-open");
      panel.hidden = true;
      backdrop.hidden = true;
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.focus();
    }

    toggleBtn.addEventListener("click", function () {
      if (isOpen) {
        closeChat();
      } else {
        openChat();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", closeChat);
    }
    backdrop.addEventListener("click", closeChat);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim();
      if (!value) {
        return;
      }
      addMessage("user", value);
      input.value = "";
      window.setTimeout(function () {
        addMessage("bot", getAnswer(value));
      }, 180);
    });

    if (quick) {
      quick.querySelectorAll("button[data-question]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var q = btn.getAttribute("data-question");
          if (!q) {
            return;
          }
          openChat();
          addMessage("user", q);
          window.setTimeout(function () {
            addMessage("bot", getAnswer(q));
          }, 180);
        });
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen) {
        closeChat();
      }
    });

    document.addEventListener("click", function (event) {
      if (!isOpen) {
        return;
      }
      if (!root.contains(event.target)) {
        closeChat();
      }
    });

    addMessage("bot", dict.welcome);
  }

  function initFormValidation() {
    var forms = document.querySelectorAll(".contact-form");
    if (!forms.length) {
      return;
    }

    forms.forEach(function (form) {
      var fields = form.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], textarea");
      if (!fields.length) {
        return;
      }

      var status = document.createElement("p");
      status.className = "form-status";
      status.setAttribute("aria-live", "polite");
      status.hidden = true;
      form.appendChild(status);

      function markFieldState(field) {
        var value = String(field.value || "").trim();
        var required = field.hasAttribute("required");
        var isValid = field.checkValidity();

        field.classList.remove("is-valid", "is-invalid");

        if (!value && !required) {
          return;
        }

        if (isValid) {
          field.classList.add("is-valid");
        } else {
          field.classList.add("is-invalid");
        }
      }

      fields.forEach(function (field) {
        field.addEventListener("blur", function () {
          markFieldState(field);
        });
        field.addEventListener("input", function () {
          if (field.classList.contains("is-invalid")) {
            markFieldState(field);
          }
        });
      });

      form.addEventListener("submit", function (event) {
        fields.forEach(function (field) {
          markFieldState(field);
        });

        if (!form.checkValidity()) {
          event.preventDefault();
          if (typeof form.reportValidity === "function") {
            form.reportValidity();
          }
          status.hidden = false;
          status.className = "form-status is-error";
          status.textContent =
            document.documentElement.lang === "en"
              ? "Please check highlighted fields before sending."
              : "Tarkista korostetut kentät ennen lähettämistä.";
          return;
        }

        // Let native form submit proceed to FormSubmit (email delivery).
        status.hidden = false;
        status.className = "form-status is-success";
        status.textContent =
          document.documentElement.lang === "en"
            ? "Looks good. Sending your message..."
            : "Näyttää hyvältä. Lähetetään viestiä...";
      });
    });
  }

  function initTracking() {
    function emitEvent(name, params) {
      try {
        if (typeof window.gtag === "function") {
          window.gtag("event", name, params || {});
          return;
        }
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: name,
          params: params || {},
        });
      } catch (e) {
        // no-op: tracking should never break UI
      }
    }

    document.querySelectorAll("[data-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        var key = el.getAttribute("data-track");
        if (!key) {
          return;
        }
        emitEvent("cta_click", {
          cta_key: key,
          page_lang: document.documentElement.lang || "fi",
        });
      });
    });

    document.querySelectorAll(".contact-form").forEach(function (form) {
      form.addEventListener("submit", function () {
        emitEvent("lead_submit_attempt", {
          page_lang: document.documentElement.lang || "fi",
        });
      });
    });
  }

  function initCountUp() {
    var counters = document.querySelectorAll(".count-up[data-count-to]");
    if (!counters.length) {
      return;
    }

    if (prefersReducedMotion()) {
      return;
    }

    function animateCounter(el) {
      if (el.dataset.countDone === "1") {
        return;
      }
      el.dataset.countDone = "1";

      var target = Number(el.getAttribute("data-count-to") || "0");
      var suffix = el.getAttribute("data-suffix") || "";
      var duration = 1100;
      var start = null;

      el.classList.add("is-animating");

      function frame(timestamp) {
        if (!start) {
          start = timestamp;
        }
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var value = Math.round(target * eased);
        el.textContent = String(value) + suffix;
        if (progress < 1) {
          window.requestAnimationFrame(frame);
        }
      }

      window.requestAnimationFrame(frame);
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initPriceEstimator() {
    var root = document.querySelector(".estimator");
    if (!root) {
      return;
    }

    var lang = document.documentElement.lang === "en" ? "en" : "fi";
    var pagesInput = document.getElementById("est-pages");
    var pagesVal = document.getElementById("est-pages-val");
    var seoInput = document.getElementById("est-seo");
    var integrationsInput = document.getElementById("est-integrations");
    var packageEl = document.getElementById("est-package");
    var priceEl = document.getElementById("est-price");
    var noteEl = document.getElementById("est-note");

    if (!pagesInput || !packageEl || !priceEl || !noteEl) {
      return;
    }

    var copy = {
      fi: {
        pricePrefix: "alk. ",
        priceSuffix: " € + alv",
        notes: {
          Starter: "1–2 sivua, nopea julkaisu ja SEO-perusta.",
          Growth: "3–5 sivua, konversiorakenne ja SEO-perusta.",
          Pro: "Laajempi sivusto, integraatiot ja vahvempi SEO.",
          Custom: "Täysin räätälöity kokonaisuus ja laajat integraatiot.",
        },
      },
      en: {
        pricePrefix: "from ",
        priceSuffix: " € + VAT",
        notes: {
          Starter: "1–2 pages, quick launch and SEO baseline.",
          Growth: "3–5 pages with conversion structure and SEO baseline.",
          Pro: "Larger website, integrations, and stronger SEO.",
          Custom: "Fully tailored scope with advanced integrations.",
        },
      },
    };

    var strings = copy[lang];

    function getLangCount() {
      var selected = root.querySelector('input[name="est-langs"]:checked');
      return selected ? Number(selected.value) : 1;
    }

    function calculate() {
      var pages = Number(pagesInput.value);
      var langs = getLangCount();
      var extendedSeo = seoInput ? seoInput.checked : false;
      var integrations = integrationsInput ? integrationsInput.checked : false;
      var price = 449;
      var pkg = "Starter";

      if (pages <= 2) {
        price = 449;
        pkg = "Starter";
      } else if (pages <= 5) {
        price = 949;
        pkg = "Growth";
      } else if (pages <= 8) {
        price = 1449;
        pkg = "Pro";
      } else {
        price = 1899;
        pkg = "Custom";
      }

      if (langs > 1) {
        price += 200;
      }
      if (extendedSeo) {
        price += 250;
      }
      if (integrations) {
        price += 200;
      }

      return { pages: pages, pkg: pkg, price: price };
    }

    function formatPrice(value) {
      if (lang === "en") {
        return strings.pricePrefix + value.toLocaleString("en-US") + strings.priceSuffix;
      }
      return strings.pricePrefix + value.toLocaleString("fi-FI") + strings.priceSuffix;
    }

    function render() {
      var result = calculate();
      if (pagesVal) {
        pagesVal.textContent = String(result.pages);
      }
      packageEl.textContent = result.pkg;
      priceEl.textContent = formatPrice(result.price);
      noteEl.textContent = strings.notes[result.pkg] || "";

      document.querySelectorAll(".price-card").forEach(function (card) {
        var title = card.querySelector("h3");
        var isMatch = title && title.textContent.trim() === result.pkg;
        card.classList.toggle("price-card--match", isMatch);
      });
    }

    pagesInput.addEventListener("input", render);
    root.querySelectorAll('input[name="est-langs"]').forEach(function (input) {
      input.addEventListener("change", render);
    });
    if (seoInput) {
      seoInput.addEventListener("change", render);
    }
    if (integrationsInput) {
      integrationsInput.addEventListener("change", render);
    }

    render();
  }

  function initHeroTitleAnimation() {
    var headings = document.querySelectorAll(".hero-title");
    if (!headings.length) {
      return;
    }

    headings.forEach(function (h1) {
      var text = h1.textContent.trim();
      if (!text) {
        return;
      }

      var words = text.split(/\s+/);
      h1.textContent = "";
      h1.classList.add("is-split");

      words.forEach(function (word, index) {
        var span = document.createElement("span");
        span.className = "hero-word";
        span.textContent = word;
        span.style.setProperty("--word-index", String(index));
        if (index >= words.length - 2) {
          span.classList.add("hero-word--accent");
        }
        h1.appendChild(span);
        if (index < words.length - 1) {
          h1.appendChild(document.createTextNode(" "));
        }
      });

      if (prefersReducedMotion()) {
        h1.classList.add("is-animated");
        return;
      }

      window.requestAnimationFrame(function () {
        h1.classList.add("is-animated");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroTitleAnimation);
  } else {
    initHeroTitleAnimation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCountUp);
    document.addEventListener("DOMContentLoaded", initPriceEstimator);
  } else {
    initCountUp();
    initPriceEstimator();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
  } else {
    initChatbot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFormValidation);
  } else {
    initFormValidation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTracking);
  } else {
    initTracking();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroInteractiveMotion);
  } else {
    initHeroInteractiveMotion();
  }
})();
