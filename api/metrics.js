const {
  getEnv,
  verifySession,
  readBearerToken,
  setCors,
  sendJson,
} = require("../lib/portal-auth");

function daysAgoIso(days) {
  var d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function vercelQuery(pathname, params) {
  var token = getEnv("VERCEL_TOKEN", "");
  if (!token) {
    throw new Error("VERCEL_TOKEN missing");
  }

  var url = new URL("https://api.vercel.com" + pathname);
  Object.keys(params).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      url.searchParams.set(key, String(params[key]));
    }
  });

  var response = await fetch(url.toString(), {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
  });

  var text = await response.text();
  var data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { raw: text };
  }

  if (!response.ok) {
    var message =
      (data && (data.error || data.message)) ||
      "Vercel Analytics request failed (" + response.status + ")";
    var err = new Error(typeof message === "string" ? message : JSON.stringify(message));
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}

function pickMetric(row, key) {
  if (!row) {
    return 0;
  }
  if (typeof row[key] === "number") {
    return row[key];
  }
  if (row.metrics && typeof row.metrics[key] === "number") {
    return row.metrics[key];
  }
  if (row.data && typeof row.data[key] === "number") {
    return row.data[key];
  }
  return 0;
}

function normalizeCount(payload) {
  if (typeof payload === "number") {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  if (typeof payload.total === "number") {
    return payload.total;
  }
  if (typeof payload.count === "number") {
    return payload.count;
  }
  if (typeof payload.visitors === "number") {
    return payload.visitors;
  }
  if (typeof payload.pageviews === "number") {
    return payload.pageviews;
  }
  if (payload.data && typeof payload.data === "object") {
    return normalizeCount(payload.data);
  }
  if (Array.isArray(payload.data) && payload.data[0]) {
    return Math.max(pickMetric(payload.data[0], "visitors"), pickMetric(payload.data[0], "pageviews"));
  }
  return Math.max(pickMetric(payload, "visitors"), pickMetric(payload, "pageviews"));
}

function normalizeRows(payload) {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }
  if (Array.isArray(payload.result)) {
    return payload.result;
  }
  return [];
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  var session = verifySession(readBearerToken(req));
  if (!session || !session.projectId) {
    sendJson(res, 401, { error: "Kirjaudu sisään uudelleen" });
    return;
  }

  var rangeDays = Number(req.query && req.query.range ? req.query.range : 7);
  if (![7, 30, 90].includes(rangeDays)) {
    rangeDays = 7;
  }

  var since = daysAgoIso(rangeDays);
  var until = new Date().toISOString();
  var baseParams = {
    projectId: session.projectId,
    teamId: session.teamId || getEnv("VERCEL_TEAM_ID", ""),
    since: since,
    until: until,
  };
  // Vercel day-granularity allows at most ~62 days.
  var dailyParams = Object.assign({}, baseParams, {
    since: daysAgoIso(Math.min(rangeDays, 60)),
  });

  try {
    var settled = await Promise.allSettled([
      vercelQuery("/v1/query/web-analytics/visits/count", baseParams),
      vercelQuery("/v1/query/web-analytics/visits/aggregate", Object.assign({}, dailyParams, { by: "day" })),
      vercelQuery("/v1/query/web-analytics/visits/aggregate", Object.assign({}, baseParams, { by: "route", limit: "8" })),
      vercelQuery("/v1/query/web-analytics/visits/aggregate", Object.assign({}, baseParams, { by: "referrerHostname", limit: "5" })),
      vercelQuery("/v1/query/web-analytics/visits/aggregate", Object.assign({}, baseParams, { by: "deviceType", limit: "5" })),
    ]);

    function valueOf(index) {
      return settled[index].status === "fulfilled" ? settled[index].value : null;
    }

    function errorOf(index) {
      if (settled[index].status === "rejected") {
        return settled[index].reason && settled[index].reason.message
          ? settled[index].reason.message
          : "Request failed";
      }
      return null;
    }

    var countPayload = valueOf(0);
    var dailyRows = normalizeRows(valueOf(1)).map(function (row) {
      return {
        day: row.day || row.date || row.timestamp || row.by || "",
        visitors: pickMetric(row, "visitors"),
        pageviews: pickMetric(row, "pageviews"),
      };
    });
    var routeRows = normalizeRows(valueOf(2)).map(function (row) {
      return {
        route: row.route || row.requestPath || row.path || row.by || "/",
        visitors: pickMetric(row, "visitors"),
        pageviews: pickMetric(row, "pageviews"),
      };
    });
    var referrerRows = normalizeRows(valueOf(3)).map(function (row) {
      return {
        referrer: row.referrerHostname || row.referrer || row.by || "(direct)",
        visitors: pickMetric(row, "visitors"),
        pageviews: pickMetric(row, "pageviews"),
      };
    });
    var deviceRows = normalizeRows(valueOf(4)).map(function (row) {
      return {
        device: row.deviceType || row.device || row.by || "unknown",
        visitors: pickMetric(row, "visitors"),
        pageviews: pickMetric(row, "pageviews"),
      };
    });

    var visitors = 0;
    var pageviews = 0;
    if (countPayload && typeof countPayload === "object") {
      visitors = pickMetric(countPayload, "visitors") || normalizeCount(countPayload);
      pageviews = pickMetric(countPayload, "pageviews") || visitors;
    }
    if (!visitors && dailyRows.length) {
      visitors = dailyRows.reduce(function (sum, row) {
        return sum + (row.visitors || 0);
      }, 0);
    }
    if (!pageviews && dailyRows.length) {
      pageviews = dailyRows.reduce(function (sum, row) {
        return sum + (row.pageviews || 0);
      }, 0);
    }

    sendJson(res, 200, {
      client: {
        id: session.sub,
        name: session.name,
        email: session.email,
        domain: session.domain,
      },
      rangeDays: rangeDays,
      since: since,
      until: until,
      totals: {
        visitors: visitors,
        pageviews: pageviews,
      },
      daily: dailyRows,
      topRoutes: routeRows,
      referrers: referrerRows,
      devices: deviceRows,
      partialErrors: {
        count: errorOf(0),
        daily: errorOf(1),
        routes: errorOf(2),
        referrers: errorOf(3),
        devices: errorOf(4),
      },
    });
  } catch (e) {
    sendJson(res, e.status || 502, {
      error: "Analytics fetch failed",
      detail: e.message || String(e),
      hint: "Check VERCEL_TOKEN, CLIENT_*_PROJECT_ID and that Web Analytics is enabled for the project.",
    });
  }
};
