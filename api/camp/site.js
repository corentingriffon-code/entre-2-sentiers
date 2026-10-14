/* Camp de base : fréquentation du site depuis Google Analytics 4 (API Data).
   Variables d'environnement Vercel :
   - GA_PROPERTY_ID   identifiant numérique de la propriété GA4 (ex. 412345678)
   - GA_CLIENT_EMAIL  e-mail du compte de service Google Cloud
   - GA_PRIVATE_KEY   clé privée du compte de service (les \n peuvent rester échappés)
   Variante plus simple : GA_SERVICE_ACCOUNT = tout le contenu du fichier JSON téléchargé
   (remplace GA_CLIENT_EMAIL et GA_PRIVATE_KEY).
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
  if (!r.ok) {
    const why = j.error_description || j.error || r.status;
    const hint = /account not found/i.test(why)
      ? " → l'adresse du robot (GA_CLIENT_EMAIL) ne correspond à aucun compte de service : vérifie qu'elle finit par iam.gserviceaccount.com et qu'elle vient du même fichier JSON que la clé."
      : /invalid_grant|signature/i.test(why)
        ? " → la clé privée (GA_PRIVATE_KEY) ne correspond pas : recopie-la depuis le même fichier JSON."
        : "";
    throw new Error(`Connexion Google refusée : ${why}${hint}`);
  }
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

/* Valeurs collées à la main : on enlève espaces, guillemets et virgule finale */
const clean = (v) => (v || "").trim().replace(/,$/, "").replace(/^["']|["']$/g, "").trim();

const VERSION = "2026-10-14b";

function credentials() {
  const raw = (process.env.GA_SERVICE_ACCOUNT || "").trim();
  if (raw) {
    let sa;
    try {
      sa = JSON.parse(raw.startsWith("{") ? raw : `{${raw}}`);
    } catch (e) {
      return { invalid: "GA_SERVICE_ACCOUNT n'est pas un JSON valide : recolle tout le contenu du fichier, de la première { à la dernière }." };
    }
    if (sa.type && sa.type !== "service_account") {
      return { invalid: `Le fichier collé dans GA_SERVICE_ACCOUNT est de type « ${sa.type} » : il faut le fichier JSON d'un compte de service (clé créée dans Comptes de service → Clés).` };
    }
    return { email: (sa.client_email || "").trim(), key: sa.private_key, source: "GA_SERVICE_ACCOUNT" };
  }
  return {
    email: clean(process.env.GA_CLIENT_EMAIL),
    key: clean(process.env.GA_PRIVATE_KEY).replace(/\\n/g, "\n"),
    source: "GA_CLIENT_EMAIL + GA_PRIVATE_KEY",
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const property = clean(process.env.GA_PROPERTY_ID).replace(/^properties\//, "");
  const cred = credentials();
  if (cred.invalid) return res.status(200).json({ configured: true, version: VERSION, error: cred.invalid });
  const { email, key, source } = cred;
  if (!property || !email || !key) return res.status(200).json({ configured: false, version: VERSION });
  try {
    const token = await googleToken(email, key);
    const [weeks, pages] = await Promise.all([
      report(token, property, {
        dateRanges: [{ startDate: "112daysAgo", endDate: "today" }],
        dimensions: [{ name: "isoYearIsoWeek" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      }),
      report(token, property, {
        dateRanges: [{ startDate: "365daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "CONTAINS", value: "/articles/" } } },
        limit: 500,
      }),
    ]);
    res.status(200).json({
      configured: true,
      version: VERSION,
      weeks: weeks.map((r) => ({
        week: isoWeekMonday(r.dimensionValues[0].value),
        visitors: Number(r.metricValues[0].value),
        pageviews: Number(r.metricValues[1].value),
      })),
      pages: pages.map((r) => ({ path: r.dimensionValues[0].value, views: Number(r.metricValues[0].value) })),
    });
  } catch (e) {
    // Diagnostic : l'adresse du robot n'est pas un secret, l'afficher aide à repérer une erreur de copie
    res.status(200).json({ configured: true, version: VERSION, error: `${e.message} (robot utilisé : ${email}, lu dans ${source})` });
  }
};
