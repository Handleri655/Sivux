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
      for (var i = 0; i < dict.rules.length; i++) {
        var keys = dict.rules[i].keys;
        for (var j = 0; j < keys.length; j++) {
          if (q.indexOf(normalize(keys[j])) !== -1) {
            return dict.rules[i].answer;
          }
        }
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
  } else {
    initChatbot();
  }
})();
