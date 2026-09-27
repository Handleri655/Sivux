const crypto = require("crypto");
const { getEnv } = require("./portal-auth");

function slugify(input) {
  return (
    String(input || "preview")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "preview"
  );
}

function withTeam(url, teamId) {
  if (!teamId) return url;
  return url + (url.indexOf("?") === -1 ? "?" : "&") + "teamId=" + encodeURIComponent(teamId);
}

async function disableProjectProtection(projectIdOrName, teamId, token) {
  if (!projectIdOrName) return false;
  var url = withTeam(
    "https://api.vercel.com/v9/projects/" + encodeURIComponent(projectIdOrName),
    teamId
  );
  var response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ssoProtection: null,
      passwordProtection: null,
    }),
  });
  if (!response.ok) {
    var text = await response.text().catch(function () {
      return "";
    });
    console.error("disable protection failed:", response.status, text.slice(0, 300));
    return false;
  }
  return true;
}

async function uploadFile(buffer, token, teamId) {
  var digest = crypto.createHash("sha1").update(buffer).digest("hex");
  var url = withTeam("https://api.vercel.com/v2/files", teamId);
  var response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(buffer.length),
      "x-vercel-digest": digest,
    },
    body: buffer,
  });

  // 200 = uploaded, 409 = already exists with same digest (ok)
  if (!response.ok && response.status !== 409) {
    var text = await response.text().catch(function () {
      return "";
    });
    var err = new Error("Tiedoston upload Verceliin epäonnistui");
    err.status = response.status;
    err.detail = text.slice(0, 300);
    throw err;
  }

  return { digest: digest, size: buffer.length };
}

async function deployPreviewSite(options) {
  var token = getEnv("VERCEL_TOKEN", "");
  if (!token) {
    var err = new Error("VERCEL_TOKEN puuttuu — demosivua ei voi julkaista");
    err.status = 500;
    throw err;
  }

  var teamId = getEnv("VERCEL_TEAM_ID", "");
  var brandSlug = slugify(options && options.name);
  var stamp = Date.now().toString(36).slice(-5);
  var projectName = ("sivux-demo-" + brandSlug + "-" + stamp).slice(0, 52);
  var html = String((options && options.html) || "");
  if (!html) {
    throw new Error("Puuttuva HTML");
  }

  var htmlBuffer = Buffer.from(html, "utf8");
  var uploaded = await uploadFile(htmlBuffer, token, teamId);

  var body = {
    name: projectName,
    target: "production",
    files: [
      {
        file: "index.html",
        sha: uploaded.digest,
        size: uploaded.size,
      },
    ],
    projectSettings: {
      framework: null,
    },
  };

  var url = withTeam(
    "https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1",
    teamId
  );

  var response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  var payload = await response.json().catch(function () {
    return {};
  });
  if (!response.ok) {
    var message =
      (payload && ((payload.error && payload.error.message) || payload.message)) ||
      "Vercel-julkaisu epäonnistui";
    var err2 = new Error(typeof message === "string" ? message : JSON.stringify(message));
    err2.status = response.status;
    err2.payload = payload;
    throw err2;
  }

  var deploymentId = payload.id || payload.deploymentId || "";
  var projectId = payload.projectId || payload.project || projectName;
  var readyUrl =
    (payload.url && "https://" + String(payload.url).replace(/^https?:\/\//, "")) ||
    (payload.alias && payload.alias[0] && "https://" + payload.alias[0]) ||
    "";

  await disableProjectProtection(projectId, teamId, token);
  await disableProjectProtection(projectName, teamId, token);

  // Prefer a usable URL quickly; only poll briefly if deploy is still building.
  if (deploymentId && (!payload.readyState || payload.readyState !== "READY" || !readyUrl)) {
    readyUrl = (await waitForDeployment(deploymentId, teamId, token)) || readyUrl;
  }

  var aliases = await fetchAliases(deploymentId, teamId, token);
  if (aliases && aliases.length) {
    var prodAlias =
      aliases.find(function (a) {
        return a && !String(a).includes("-git-") && String(a).endsWith(".vercel.app");
      }) || aliases[0];
    if (prodAlias) {
      readyUrl = "https://" + String(prodAlias).replace(/^https?:\/\//, "");
    }
  }

  return {
    projectName: projectName,
    projectId: projectId,
    deploymentId: deploymentId,
    url: readyUrl,
    protectionDisabled: true,
    raw: payload,
  };
}

async function fetchAliases(deploymentId, teamId, token) {
  if (!deploymentId) return [];
  try {
    var url = withTeam(
      "https://api.vercel.com/v13/deployments/" + encodeURIComponent(deploymentId),
      teamId
    );
    var response = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    var data = await response.json().catch(function () {
      return {};
    });
    var list = [];
    if (Array.isArray(data.alias)) list = data.alias;
    else if (Array.isArray(data.aliases)) list = data.aliases;
    return list
      .map(function (item) {
        if (typeof item === "string") return item;
        return item && (item.alias || item.url || "");
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function waitForDeployment(deploymentId, teamId, token) {
  var attempts = 8;
  for (var i = 0; i < attempts; i++) {
    var url = withTeam(
      "https://api.vercel.com/v13/deployments/" + encodeURIComponent(deploymentId),
      teamId
    );
    var response = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    var data = await response.json().catch(function () {
      return {};
    });
    var state = data.readyState || data.status;
    if (state === "READY" && data.url) {
      return "https://" + String(data.url).replace(/^https?:\/\//, "");
    }
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error("Vercel-deploy epäonnistui (" + state + ")");
    }
    await new Promise(function (resolve) {
      setTimeout(resolve, 1500);
    });
  }
  return "";
}

module.exports = {
  deployPreviewSite,
  slugify,
  disableProjectProtection,
};
