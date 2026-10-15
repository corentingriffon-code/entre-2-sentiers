/* Camp de base : sauvegarde en ligne des données (contenus, tâches, notes, stats…)
   pour retrouver les mêmes données sur tous les appareils.
   Stockage : Upstash Redis (ajouté depuis Vercel → Storage), via son API REST.
   Variables d'environnement (créées automatiquement par Vercel) :
   - KV_REST_API_URL et KV_REST_API_TOKEN   (ou UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN)
   - PUBLISH_CODE : le même code que pour la publication, il protège l'accès aux données. */

const crypto = require("node:crypto");

const env = (name) => {
  const k = Object.keys(process.env).find((x) => x.toUpperCase() === name);
  return (k ? process.env[k] : "").trim().replace(/^["']|["']$/g, "");
};
const KEY = "camp-de-base:data";

function sameCode(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

async function redis(url, token, command) {
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Stockage en ligne : ${j.error || r.status}`);
  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const URL_ = env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
  const TOKEN = env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
  const CODE = env("PUBLISH_CODE");
  const missing = [];
  if (!URL_ || !TOKEN) missing.push("stockage Upstash (Vercel → Storage)");
  if (!CODE) missing.push("PUBLISH_CODE");
  if (missing.length) return res.status(200).json({ configured: false, missing });

  const code = req.headers["x-camp-code"] || "";
  if (!code || !sameCode(code, CODE)) return res.status(401).json({ configured: true, badCode: true, error: "Code incorrect." });

  // Photos d'articles pas encore publiés : une clé par contenu, pour garder le paquet principal léger
  const photo = String(req.query?.photo || "");
  if (photo) {
    if (!/^[\w-]{1,60}$/.test(photo)) return res.status(400).json({ error: "Identifiant invalide." });
    const pkey = `${KEY}:photo:${photo}`;
    try {
      if (req.method === "GET") return res.status(200).json({ configured: true, data: (await redis(URL_, TOKEN, ["GET", pkey])) || null });
      if (req.method === "PUT") {
        const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
        if (typeof b.data !== "string" || !b.data.startsWith("data:image/") || b.data.length > 3_500_000) return res.status(400).json({ error: "Photo invalide ou trop lourde." });
        await redis(URL_, TOKEN, ["SET", pkey, b.data]);
        return res.status(200).json({ configured: true, ok: true });
      }
      return res.status(405).json({ error: "Méthode non autorisée" });
    } catch (e) {
      return res.status(200).json({ configured: true, error: e.message });
    }
  }

  try {
    const raw = await redis(URL_, TOKEN, ["GET", KEY]);
    const current = raw ? JSON.parse(raw) : { version: 0, updatedAt: null, data: null };

    if (req.method === "GET") return res.status(200).json({ configured: true, ...current });

    if (req.method === "PUT" || req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (!b.data || !Array.isArray(b.data.contents)) return res.status(400).json({ error: "Données invalides." });
      // Quelqu'un (un autre appareil) a enregistré entre-temps : on renvoie la version en ligne pour fusion
      if (Number(b.baseVersion || 0) !== Number(current.version || 0)) return res.status(409).json({ configured: true, conflict: true, ...current });
      const next = { version: (current.version || 0) + 1, updatedAt: new Date().toISOString(), data: b.data };
      await redis(URL_, TOKEN, ["SET", KEY, JSON.stringify(next)]);
      return res.status(200).json({ configured: true, version: next.version, updatedAt: next.updatedAt });
    }
    res.status(405).json({ error: "Méthode non autorisée" });
  } catch (e) {
    res.status(200).json({ configured: true, error: e.message });
  }
};
