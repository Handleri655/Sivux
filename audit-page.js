(function () {
  var form = document.getElementById("audit-form");
  if (!form) {
    return;
  }

  var urlInput = document.getElementById("audit-url");
  var emailInput = document.getElementById("audit-email");
  var submitBtn = document.getElementById("audit-submit");
  var emailGate = document.getElementById("audit-email-gate");
  var urlStep = document.getElementById("audit-step-url");
  var pendingUrlEl = document.getElementById("audit-pending-url");
  var emailContinueBtn = document.getElementById("audit-email-continue");
  var emailBackBtn = document.getElementById("audit-email-back");
  var statusEl = document.getElementById("audit-status");
  var progressEl = document.getElementById("audit-progress");
  var resultEl = document.getElementById("audit-result");
  var scoreValue = document.getElementById("audit-score-value");
  var scoreRing = document.getElementById("audit-score-ring");
  var scoreProgress = document.getElementById("audit-score-progress");
  var scoreLabelEl = document.getElementById("audit-score-label");
  var scoreAnimControls = null;
  var scoreCountControls = null;
  var summaryEl = document.getElementById("audit-summary");
  var urlLabel = document.getElementById("audit-url-label");
  var noteEl = document.getElementById("audit-note");
  var gainEl = document.getElementById("audit-gain");
  var categoriesEl = document.getElementById("audit-categories");
  var criticalEl = document.getElementById("audit-critical");
  var positivesEl = document.getElementById("audit-positives");
  var topFixesWrap = document.getElementById("audit-topfixes-wrap");
  var topFixesEl = document.getElementById("audit-topfixes");
  var contactCta = document.getElementById("audit-contact-cta");
  var contactCta2 = document.getElementById("audit-contact-cta-2");
  var generateCta = document.getElementById("audit-generate-cta");
  var quoteStatusEl = document.getElementById("audit-quote-status");
  var thanksEl = document.getElementById("audit-thanks");
  var previewEl = document.getElementById("audit-preview");
  var previewCopy = document.getElementById("audit-preview-copy");
  var previewTitle = document.getElementById("audit-preview-title");
  var ctaWrap = document.getElementById("audit-cta");
  var progressTimer = null;
  var pendingUrl = "";
  var latestResult = null;
  var latestEmail = "";

  var categoryLabels = {
    clarity: "Selkeys",
    visual: "Ilme",
    mobile: "Mobiili",
    seo: "SEO",
    trust: "Luottamus",
    conversion: "Konversio",
  };

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function scoreTone(score) {
    if (score >= 75) return "good";
    if (score >= 50) return "mid";
    return "low";
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function getMotionAnimate() {
    if (prefersReducedMotion()) return null;
    if (!window.Motion || typeof window.Motion.animate !== "function") return null;
    return window.Motion.animate;
  }

  function stopScoreAnimations() {
    if (scoreAnimControls && typeof scoreAnimControls.stop === "function") {
      scoreAnimControls.stop();
    }
    if (scoreCountControls && typeof scoreCountControls.stop === "function") {
      scoreCountControls.stop();
    }
    if (scoreAnimControls && scoreAnimControls.raf) {
      cancelAnimationFrame(scoreAnimControls.raf);
    }
    if (scoreCountControls && scoreCountControls.raf) {
      cancelAnimationFrame(scoreCountControls.raf);
    }
    scoreAnimControls = null;
    scoreCountControls = null;
  }

  function tweenNumber(from, to, durationMs, onUpdate, onComplete) {
    var reduced = prefersReducedMotion();
    if (reduced || durationMs <= 0) {
      onUpdate(to);
      if (onComplete) onComplete();
      return { stop: function () {} };
    }

    var animate = getMotionAnimate();
    if (animate) {
      try {
        var controls = animate(from, to, {
          duration: durationMs / 1000,
          ease: [0.22, 1, 0.36, 1],
          onUpdate: onUpdate,
          onComplete: onComplete,
        });
        if (controls && typeof controls.stop === "function") {
          return controls;
        }
      } catch (e) {
        // fall through to rAF
      }
    }

    var start = performance.now();
    var frame = 0;
    var stopped = false;
    function tick(now) {
      if (stopped) return;
      var t = Math.min(1, (now - start) / durationMs);
      // easeOut cubic-ish
      var eased = 1 - Math.pow(1 - t, 3);
      onUpdate(from + (to - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (onComplete) {
        onComplete();
      }
    }
    frame = requestAnimationFrame(tick);
    return {
      raf: frame,
      stop: function () {
        stopped = true;
        cancelAnimationFrame(frame);
      },
    };
  }

  function animateScoreRing(score) {
    var clamped = Math.max(0, Math.min(100, Number(score) || 0));
    var progress = clamped / 100;
    scoreRing.setAttribute("data-tone", scoreTone(clamped));
    scoreRing.setAttribute("aria-label", "Sivuston arvosana " + clamped + " / 100");

    stopScoreAnimations();

    if (!scoreProgress) {
      scoreValue.textContent = String(clamped);
      return;
    }

    var radius = Number(scoreProgress.getAttribute("r")) || 52;
    var circumference = 2 * Math.PI * radius;
    var endOffset = circumference * (1 - progress);

    scoreProgress.style.strokeDasharray = String(circumference);
    scoreProgress.style.strokeDashoffset = String(circumference);

    scoreAnimControls = tweenNumber(circumference, endOffset, 1150, function (latest) {
      scoreProgress.style.strokeDashoffset = String(latest);
    });

    scoreValue.textContent = "0";
    scoreCountControls = tweenNumber(0, clamped, 1150, function (latest) {
      scoreValue.textContent = String(Math.round(latest));
    });
  }

  function animateCategoryBars() {
    if (!categoriesEl) return;
    var fills = categoriesEl.querySelectorAll(".audit-category-bar span");
    var animate = getMotionAnimate();
    Array.prototype.forEach.call(fills, function (fill, index) {
      var target = Number(fill.getAttribute("data-target") || 0);
      var ratio = Math.max(0, Math.min(1, target / 100));
      if (!animate) {
        fill.style.transform = "scaleX(" + ratio + ")";
        return;
      }
      fill.style.transform = "scaleX(0)";
      animate(
        fill,
        { scaleX: [0, ratio] },
        {
          duration: 0.85,
          delay: 0.12 + index * 0.06,
          ease: [0.22, 1, 0.36, 1],
        }
      );
    });
  }

  function showEmailGate(url) {
    pendingUrl = url;
    if (pendingUrlEl) pendingUrlEl.textContent = url;
    if (urlStep) urlStep.hidden = true;
    emailGate.hidden = false;
    emailGate.classList.remove("is-hidden");
    resultEl.hidden = true;
    resultEl.classList.add("is-hidden");
    setStatus("");
    emailInput.focus();
  }

  function hideEmailGate() {
    emailGate.hidden = true;
    emailGate.classList.add("is-hidden");
    if (urlStep) urlStep.hidden = false;
  }

  function showProgress(active) {
    if (!progressEl) return;
    if (!active) {
      progressEl.hidden = true;
      progressEl.classList.add("is-hidden");
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      Array.prototype.forEach.call(progressEl.querySelectorAll("li"), function (li) {
        li.classList.remove("is-active", "is-done");
      });
      return;
    }
    progressEl.hidden = false;
    progressEl.classList.remove("is-hidden");
    var step = 1;
    function paint() {
      Array.prototype.forEach.call(progressEl.querySelectorAll("li"), function (li) {
        var n = Number(li.getAttribute("data-step"));
        li.classList.toggle("is-done", n < step);
        li.classList.toggle("is-active", n === step);
      });
    }
    paint();
    progressTimer = setInterval(function () {
      if (step < 3) {
        step += 1;
        paint();
      }
    }, 900);
  }

  function renderList(el, items, emptyText) {
    el.innerHTML = "";
    if (!items || !items.length) {
      var li = document.createElement("li");
      li.textContent = emptyText;
      el.appendChild(li);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      el.appendChild(li);
    });
  }

  function renderCategories(categories) {
    categoriesEl.innerHTML = "";
    Object.keys(categoryLabels).forEach(function (key) {
      var value = categories && typeof categories[key] === "number" ? categories[key] : 0;
      var clamped = Math.max(0, Math.min(100, value));
      var card = document.createElement("div");
      card.className = "audit-category";
      card.innerHTML =
        '<p class="audit-category-label">' +
        categoryLabels[key] +
        '</p><p class="audit-category-value">' +
        clamped +
        '</p><div class="audit-category-bar" aria-hidden="true"><span data-target="' +
        clamped +
        '"></span></div>';
      categoriesEl.appendChild(card);
    });
    // Start bars empty; Motion fills them after paint.
    requestAnimationFrame(function () {
      animateCategoryBars();
    });
  }

  function renderTopFixes(fixes) {
    topFixesEl.innerHTML = "";
    if (!fixes || !fixes.length) {
      topFixesWrap.hidden = true;
      return;
    }
    topFixesWrap.hidden = false;
    fixes.forEach(function (fix, index) {
      var li = document.createElement("li");
      li.className = "audit-topfix";
      li.innerHTML =
        '<div class="audit-topfix-head"><span class="audit-topfix-num">' +
        (index + 1) +
        '</span><strong>' +
        escapeHtml(fix.title || "") +
        '</strong>' +
        (fix.impact
          ? '<span class="audit-topfix-impact">+' + fix.impact + " pistettä</span>"
          : "") +
        "</div>" +
        (fix.why ? '<p class="audit-topfix-why"><span>Miksi:</span> ' + escapeHtml(fix.why) + "</p>" : "") +
        (fix.how ? '<p class="audit-topfix-how"><span>Tee näin:</span> ' + escapeHtml(fix.how) + "</p>" : "");
      topFixesEl.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillContactCta(data, email) {
    latestResult = data || null;
    latestEmail = email || "";
    if (thanksEl) {
      thanksEl.hidden = true;
      thanksEl.classList.add("is-hidden");
    }
    if (previewEl) {
      previewEl.hidden = true;
      previewEl.classList.add("is-hidden");
    }
    if (ctaWrap) ctaWrap.hidden = false;
    if (quoteStatusEl) {
      quoteStatusEl.textContent = "";
      quoteStatusEl.classList.remove("is-error", "is-ok");
    }
    if (contactCta) {
      contactCta.disabled = false;
      contactCta.textContent = "Pyydä tarjous";
    }
    if (generateCta) {
      generateCta.disabled = false;
      generateCta.textContent = "Lähetä demosivu sähköpostiini";
    }
  }

  async function generatePreview() {
    if (!latestResult || !latestEmail) {
      if (quoteStatusEl) {
        quoteStatusEl.textContent = "Analyysin tiedot puuttuvat. Aja arvio uudelleen.";
        quoteStatusEl.classList.add("is-error");
      }
      return;
    }

    if (generateCta) {
      generateCta.disabled = true;
      generateCta.textContent = "Luodaan ja lähetetään…";
    }
    if (quoteStatusEl) {
      quoteStatusEl.textContent = "Generoidaan demosivu ja lähetetään sähköpostiisi…";
      quoteStatusEl.classList.remove("is-error", "is-ok");
    }

    try {
      var response = await fetch("/api/audit-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: latestEmail,
          url: latestResult.url,
          score: latestResult.score,
          scoreLabel: latestResult.scoreLabel,
          topFixes: latestResult.topFixes || [],
          critical: latestResult.critical || [],
          categories: latestResult.categories || {},
        }),
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(data.error || "Demosivun luonti epäonnistui");
      }

      if (previewTitle) {
        previewTitle.textContent = data.brandName
          ? "Demosivu lähetetty (" + data.brandName + ")"
          : "Demosivu on sähköpostissasi";
      }
      if (previewCopy) {
        previewCopy.textContent =
          data.message ||
          "Lähetimme preview-linkin osoitteeseen " + latestEmail + ". Tarkista myös roskaposti.";
      }
      if (previewEl) {
        previewEl.hidden = false;
        previewEl.classList.remove("is-hidden");
        previewEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (quoteStatusEl) {
        quoteStatusEl.textContent = "Valmis — tarkista sähköpostisi.";
        quoteStatusEl.classList.add("is-ok");
      }
      if (generateCta) {
        generateCta.textContent = "Demosivu lähetetty";
      }
    } catch (error) {
      if (quoteStatusEl) {
        var msg = error.message || "Demosivun luonti epäonnistui";
        if (/aborted|abort/i.test(msg)) {
          msg =
            "Operaatio keskeytyi aikakatkaisuun. Kokeile uudelleen — demosivun luonti voi kestää hetken.";
        }
        quoteStatusEl.textContent = msg;
        quoteStatusEl.classList.add("is-error");
      }
      if (generateCta) {
        generateCta.disabled = false;
        generateCta.textContent = "Lähetä demosivu sähköpostiini";
      }
    }
  }

  async function requestQuote() {
    if (!latestResult || !latestEmail) {
      if (quoteStatusEl) {
        quoteStatusEl.textContent = "Analyysin tiedot puuttuvat. Aja arvio uudelleen.";
        quoteStatusEl.classList.add("is-error");
      }
      return;
    }

    contactCta.disabled = true;
    contactCta.textContent = "Lähetetään…";
    if (quoteStatusEl) {
      quoteStatusEl.textContent = "";
      quoteStatusEl.classList.remove("is-error", "is-ok");
    }

    try {
      var response = await fetch("/api/audit-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: latestEmail,
          url: latestResult.url,
          score: latestResult.score,
          scoreLabel: latestResult.scoreLabel,
          topFixes: latestResult.topFixes || [],
          critical: latestResult.critical || [],
        }),
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(data.error || "Tarjouspyynnön lähetys epäonnistui");
      }

      if (ctaWrap) ctaWrap.hidden = true;
      if (thanksEl) {
        thanksEl.hidden = false;
        thanksEl.classList.remove("is-hidden");
        thanksEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (error) {
      if (quoteStatusEl) {
        quoteStatusEl.textContent = error.message || "Lähetys epäonnistui. Kokeile uudelleen.";
        quoteStatusEl.classList.add("is-error");
      }
      contactCta.disabled = false;
      contactCta.textContent = "Pyydä tarjous";
    }
  }

  function showResult(data, email) {
    hideEmailGate();
    if (urlStep) urlStep.hidden = false;
    resultEl.hidden = false;
    resultEl.classList.remove("is-hidden");
    var score = Number(data.score) || 0;
    animateScoreRing(score);
    urlLabel.textContent = data.url || "";
    scoreLabelEl.textContent = data.scoreLabel || "";
    summaryEl.textContent = data.summary || "";
    if (data.potentialGain > 0 && data.topFixes && data.topFixes.length) {
      gainEl.hidden = false;
      gainEl.textContent =
        "Top-korjauksilla arviolta jopa +" + data.potentialGain + " pistettä.";
    } else {
      gainEl.hidden = true;
      gainEl.textContent = "";
    }
    if (data.note) {
      noteEl.hidden = false;
      noteEl.textContent = data.note;
    } else {
      noteEl.hidden = true;
      noteEl.textContent = "";
    }
    renderCategories(data.categories || {});
    renderTopFixes(data.topFixes || []);
    renderList(criticalEl, data.critical, "Ei kriittisiä löydöksiä.");
    renderList(positivesEl, data.positives, "Ei erillisiä vahvuuksia listattuna.");
    fillContactCta(data, email);
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function runAudit(url, email) {
    if (emailContinueBtn) emailContinueBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (emailContinueBtn) emailContinueBtn.textContent = "Arvioidaan…";
    setStatus("");
    showProgress(true);
    resultEl.hidden = true;
    resultEl.classList.add("is-hidden");

    try {
      var response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          email: email,
          website: form.elements.website ? form.elements.website.value : "",
        }),
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(data.error || "Analyysi epäonnistui");
      }
      showProgress(false);
      setStatus("Ilmainen arvio valmis.");
      showResult(data, email);
    } catch (error) {
      showProgress(false);
      var msg = error.message || "Analyysi epäonnistui";
      if (/aborted|abort|aikakatkaisu|ei vastannut/i.test(msg)) {
        msg =
          "Kohdesivusto ei vastannut ajoissa. Sivu voi olla hidas, lukittu boteilta tai sen palvelin jumissa — kokeile toista URL:ia.";
      }
      setStatus(msg, true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (emailContinueBtn) {
        emailContinueBtn.disabled = false;
        emailContinueBtn.textContent = "Näytä ilmainen arvio";
      }
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var url = (urlInput.value || "").trim();
    if (!url) {
      setStatus("Syötä nettisivun osoite.", true);
      urlInput.focus();
      return;
    }
    showEmailGate(url);
  });

  if (emailBackBtn) {
    emailBackBtn.addEventListener("click", function () {
      hideEmailGate();
      setStatus("");
      urlInput.focus();
    });
  }

  if (emailContinueBtn) {
    emailContinueBtn.addEventListener("click", function () {
      var email = (emailInput.value || "").trim();
      if (!isValidEmail(email)) {
        setStatus("Syötä toimiva sähköposti, jotta saat ilmaisen arvion.", true);
        emailInput.focus();
        return;
      }
      runAudit(pendingUrl || (urlInput.value || "").trim(), email);
    });
  }

  if (emailInput) {
    emailInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (emailContinueBtn) emailContinueBtn.click();
      }
    });
  }

  if (contactCta) {
    contactCta.addEventListener("click", function () {
      requestQuote();
    });
  }
  if (contactCta2) {
    contactCta2.addEventListener("click", function () {
      requestQuote();
    });
  }
  if (generateCta) {
    generateCta.addEventListener("click", function () {
      generatePreview();
    });
  }
})();
