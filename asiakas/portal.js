(function () {
  var TOKEN_KEY = "sivux_portal_token";
  var CLIENT_KEY = "sivux_portal_client";

  function $(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getClient() {
    try {
      return JSON.parse(localStorage.getItem(CLIENT_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function setSession(token, client) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(CLIENT_KEY, JSON.stringify(client || {}));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLIENT_KEY);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("fi-FI");
  }

  function shortDay(value) {
    if (!value) {
      return "—";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value).slice(5, 10);
    }
    return date.toLocaleDateString("fi-FI", { day: "numeric", month: "numeric" });
  }

  async function postLogin(email, password) {
    var response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    });
    var data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      throw new Error(data.error || "Kirjautuminen epäonnistui");
    }
    return data;
  }

  async function fetchMetrics(range) {
    var response = await fetch("/api/metrics?range=" + encodeURIComponent(range), {
      headers: {
        Authorization: "Bearer " + getToken(),
      },
    });
    var data = await response.json().catch(function () {
      return {};
    });
    if (response.status === 401) {
      clearSession();
      window.location.href = "./index.html";
      return null;
    }
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Datan haku epäonnistui");
    }
    return data;
  }

  function renderBars(container, rows, labelKey, valueKey) {
    if (!container) {
      return;
    }
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="portal-empty">Ei dataa valitulta jaksolta.</p>';
      return;
    }
    var max = Math.max.apply(
      null,
      rows.map(function (row) {
        return Number(row[valueKey] || 0);
      }).concat([1])
    );
    container.innerHTML = rows
      .map(function (row) {
        var value = Number(row[valueKey] || 0);
        var width = Math.max(4, Math.round((value / max) * 100));
        return (
          '<div class="portal-bar-row">' +
          '<span class="portal-bar-label">' +
          String(row[labelKey] || "—") +
          "</span>" +
          '<div class="portal-bar-track"><span class="portal-bar-fill" style="width:' +
          width +
          '%"></span></div>' +
          '<span class="portal-bar-value">' +
          formatNumber(value) +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderList(container, rows, labelKey, valueKey) {
    if (!container) {
      return;
    }
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="portal-empty">Ei dataa valitulta jaksolta.</p>';
      return;
    }
    container.innerHTML = rows
      .map(function (row) {
        return (
          '<div class="portal-row">' +
          "<span>" +
          String(row[labelKey] || "—") +
          '</span><span class="portal-row-meta">' +
          formatNumber(row[valueKey] || 0) +
          "</span></div>"
        );
      })
      .join("");
  }

  function initLogin() {
    var form = $("login-form");
    if (!form) {
      return;
    }

    if (getToken()) {
      window.location.href = "./dashboard.html";
      return;
    }

    var status = $("login-status");
    var submit = $("login-submit");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      status.hidden = true;
      status.className = "portal-status";
      submit.disabled = true;
      submit.textContent = "Kirjaudutaan…";

      try {
        var data = await postLogin($("email").value, $("password").value);
        setSession(data.token, data.client);
        window.location.href = "./dashboard.html";
      } catch (e) {
        status.hidden = false;
        status.textContent = e.message || "Kirjautuminen epäonnistui";
      } finally {
        submit.disabled = false;
        submit.textContent = "Kirjaudu";
      }
    });
  }

  function initDashboard() {
    if (!$("stats-grid")) {
      return;
    }

    if (!getToken()) {
      window.location.href = "./index.html";
      return;
    }

    var client = getClient() || {};
    var range = 7;
    var status = $("dash-status");

    $("client-name").textContent = client.name || "Asiakas";
    $("stat-domain").textContent = (client.domain || "").replace(/^https?:\/\//, "") || "—";
    if (client.domain) {
      $("site-link").href = client.domain;
    }

    $("logout-btn").addEventListener("click", function () {
      clearSession();
      window.location.href = "./index.html";
    });

    document.querySelectorAll(".portal-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".portal-chip").forEach(function (el) {
          el.classList.remove("is-active");
        });
        btn.classList.add("is-active");
        range = Number(btn.getAttribute("data-range") || "7");
        load();
      });
    });

    async function load() {
      status.hidden = true;
      $("range-label").textContent = "Viimeiset " + range + " päivää";
      $("stat-visitors").textContent = "…";
      $("stat-pageviews").textContent = "…";

      try {
        var data = await fetchMetrics(range);
        if (!data) {
          return;
        }

        if (data.client) {
          setSession(getToken(), data.client);
          $("client-name").textContent = data.client.name || "Asiakas";
          $("stat-domain").textContent =
            (data.client.domain || "").replace(/^https?:\/\//, "") || "—";
          if (data.client.domain) {
            $("site-link").href = data.client.domain;
          }
        }

        $("stat-visitors").textContent = formatNumber(data.totals && data.totals.visitors);
        $("stat-pageviews").textContent = formatNumber(data.totals && data.totals.pageviews);

        var daily = (data.daily || []).map(function (row) {
          return {
            day: shortDay(row.day),
            visitors: row.visitors,
            pageviews: row.pageviews,
          };
        });
        renderBars($("daily-chart"), daily, "day", "pageviews");
        renderList($("top-routes"), data.topRoutes || [], "route", "pageviews");
        renderList($("referrers"), data.referrers || [], "referrer", "visitors");
        renderList($("devices"), data.devices || [], "device", "visitors");

        var partial = data.partialErrors || {};
        var warnings = Object.keys(partial)
          .filter(function (key) {
            return !!partial[key];
          })
          .map(function (key) {
            return key + ": " + partial[key];
          });
        if (warnings.length) {
          status.hidden = false;
          status.className = "portal-status";
          status.textContent =
            "Osa mittareista ei latautunut. Tarkista Vercel Analytics -asetukset. " +
            warnings[0];
        }
      } catch (e) {
        status.hidden = false;
        status.className = "portal-status";
        status.textContent = e.message || "Datan haku epäonnistui";
        $("stat-visitors").textContent = "—";
        $("stat-pageviews").textContent = "—";
        renderBars($("daily-chart"), [], "day", "pageviews");
        renderList($("top-routes"), [], "route", "pageviews");
        renderList($("referrers"), [], "referrer", "visitors");
        renderList($("devices"), [], "device", "visitors");
      }
    }

    load();
  }

  initLogin();
  initDashboard();
})();
