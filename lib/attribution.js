function cleanToken(raw, maxLen) {
  return String(raw || "")
    .trim()
    .slice(0, maxLen || 64)
    .replace(/[^\w\-.:/%+@?=&#]/g, "");
}

function normalizePromoCode(raw) {
  var code = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
  return code;
}

function describePromo(code) {
  if (code === "MAX") {
    return "MAX (10 % alennus, TikTok-kumppani)";
  }
  return code || "";
}

function pickAttribution(input) {
  var src = input || {};
  var promoCode = normalizePromoCode(
    src.promoCode || src.kampanjakoodi || src.promo || src.code
  );
  return {
    promoCode: promoCode,
    promoLabel: describePromo(promoCode),
    ref: cleanToken(src.ref, 40).toLowerCase(),
    utmSource: cleanToken(src.utmSource || src.utm_source, 64).toLowerCase(),
    utmMedium: cleanToken(src.utmMedium || src.utm_medium, 64).toLowerCase(),
    utmCampaign: cleanToken(src.utmCampaign || src.utm_campaign, 80).toLowerCase(),
    utmContent: cleanToken(src.utmContent || src.utm_content, 80).toLowerCase(),
    landing: cleanToken(src.landing || src.attribution_landing || src.attributionLanding, 300),
  };
}

function attributionLines(attr) {
  if (!attr) return "";
  var lines = [];
  if (attr.promoCode) {
    lines.push("Kampanjakoodi: " + (attr.promoLabel || attr.promoCode));
  }
  if (attr.ref) lines.push("Ref: " + attr.ref);
  if (attr.utmSource) lines.push("utm_source: " + attr.utmSource);
  if (attr.utmMedium) lines.push("utm_medium: " + attr.utmMedium);
  if (attr.utmCampaign) lines.push("utm_campaign: " + attr.utmCampaign);
  if (attr.utmContent) lines.push("utm_content: " + attr.utmContent);
  if (attr.landing) lines.push("Landing: " + attr.landing);
  return lines.join("\n");
}

function hasAttribution(attr) {
  if (!attr) return false;
  return Boolean(
    attr.promoCode ||
      attr.ref ||
      attr.utmSource ||
      attr.utmMedium ||
      attr.utmCampaign ||
      attr.utmContent
  );
}

module.exports = {
  normalizePromoCode,
  describePromo,
  pickAttribution,
  attributionLines,
  hasAttribution,
};
