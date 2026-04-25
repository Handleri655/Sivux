(function () {
  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.querySelector(".site-nav");
  var yearEl = document.getElementById("year");
  var siteHeader = document.querySelector(".site-header");
  var toTop = document.getElementById("to-top");
  var navSectionLinks = document.querySelectorAll("[data-nav-section]");

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

  function initScrollUi() {
    var navOrder = [];
    navSectionLinks.forEach(function (a) {
      var id = a.getAttribute("data-nav-section");
      if (id && navOrder.indexOf(id) === -1) {
        navOrder.push(id);
      }
    });

    var ticking = false;

    function update() {
      var scrollY = window.scrollY || document.documentElement.scrollTop;

      if (siteHeader) {
        siteHeader.classList.toggle("is-scrolled", scrollY > 28);
      }

      if (toTop) {
        toTop.classList.toggle("is-visible", scrollY > 400);
      }

      var activeId = "";
      var yLine = scrollY + Math.min(160, window.innerHeight * 0.22);

      for (var i = navOrder.length - 1; i >= 0; i--) {
        var el = document.getElementById(navOrder[i]);
        if (!el) {
          continue;
        }
        var top = el.getBoundingClientRect().top + window.scrollY;
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

      ticking = false;
    }

    function requestTick() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick, { passive: true });
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScrollUi);
  } else {
    initScrollUi();
  }

  if (toTop) {
    toTop.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
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
          "Moikka! Voin auttaa yleisissä kysymyksissä (hinta, aikataulu, ylläpito, päivitykset).",
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
            keys: ["kickoff", "aloitus", "palaveri", "ensimma", "ensimmainen"],
            answer:
              "Kickoffissa sovitaan tavoite, kohderyhmä, rakenne, vastuut ja aikataulu. Sen jälkeen saat kirjallisen etenemissuunnitelman.",
          },
        ],
      },
      en: {
        welcome:
          "Hi! I can help with common questions (pricing, timeline, maintenance, content updates).",
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
        var hasInvalid = false;

        fields.forEach(function (field) {
          markFieldState(field);
          if (!field.checkValidity()) {
            hasInvalid = true;
          }
        });

        if (hasInvalid) {
          event.preventDefault();
          status.hidden = false;
          status.className = "form-status is-error";
          status.textContent =
            form.closest("[data-lang='en']") || document.documentElement.lang === "en"
              ? "Please check highlighted fields before sending."
              : "Tarkista korostetut kentät ennen lähettämistä.";
          return;
        }

        status.hidden = false;
        status.className = "form-status is-success";
        status.textContent =
          form.closest("[data-lang='en']") || document.documentElement.lang === "en"
            ? "Looks good. Sending your message..."
            : "Näyttää hyvältä. Lähetetään viestiä...";
      });
    });
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
    document.addEventListener("DOMContentLoaded", initHeroInteractiveMotion);
  } else {
    initHeroInteractiveMotion();
  }
})();
