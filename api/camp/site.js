/* Camp de base : fréquentation du site depuis Google Analytics 4 (API Data).
   Variables d'environnement Vercel :
   - GA_PROPERTY_ID   identifiant numérique de la propriété GA4 (ex. 412345678)
   - GA_CLIENT_EMAIL  e-mail du compte de service Google Cloud
   - GA_PRIVATE_KEY   clé privée du compte de service (les \n peuvent rester échappés)
   Le compte de service doit être ajouté en « Lecteur » sur la propriété GA4. */

const crypto = require("node:crypto");

async function googleToken(email, key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Connexion Google refusée : ${j.error_description || j.error || r.status}`);
  return j.access_token;
}

async function report(token, property, body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google Analytics : ${j.error?.message || r.status}`);
  return j.rows || [];
}

/* « 202641 » (année + semaine ISO) → date du lundi « 2026-10-05 » */
function isoWeekMonday(code) {
  const year = Number(code.slice(0, 4));
  const week = Number(code.slice(4));
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { GA_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY } = process.env;
  if (!GA_PROPERTY_ID || !GA_CLIENT_EMAIL || !GA_PRIVATE_KEY) return res.status(200).json({ configured: false });
  try {
    const token = await googleToken(GA_CLIENT_EMAIL, GA_PRIVATE_KEY.replace(/\\n/g, "\n"));
    const [weeks, pages] = await Promise.all([
      report(token, GA_PROPERTY_ID, {
        dateRanges: [{ startDate: "112daysAgo", endDate: "today" }],
        dimensions: [{ name: "isoYearIsoWeek" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      }),
      report(token, GA_PROPERTY_ID, {
        dateRanges: [{ startDate: "365daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "CONTAINS", value: "/articles/" } } },
        limit: 500,
      }),
    ]);
    res.status(200).json({
      configured: true,
      weeks: weeks.map((r) => ({
        week: isoWeekMonday(r.dimensionValues[0].value),
        visitors: Number(r.metricValues[0].value),
        pageviews: Number(r.metricValues[1].value),
      })),
      pages: pages.map((r) => ({ path: r.dimensionValues[0].value, views: Number(r.metricValues[0].value) })),
    });
  } catch (e) {
    res.status(200).json({ configured: true, error: e.message });
  }
};
