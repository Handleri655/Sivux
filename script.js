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
})();
