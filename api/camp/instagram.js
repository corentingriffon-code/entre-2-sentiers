/* Camp de base : abonnés et statistiques des publications Instagram
   (« API Instagram avec connexion Instagram », compte professionnel, sans page Facebook).
   Variable d'environnement Vercel :
   - IG_ACCESS_TOKEN  jeton longue durée (60 jours) généré dans l'app Meta for Developers
     avec les autorisations instagram_business_basic et instagram_business_manage_insights. */

const BASE = "https://graph.instagram.com";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = Object.keys(process.env).find((x) => x.toUpperCase() === "IG_ACCESS_TOKEN");
  const token = (key ? process.env[key] : "").trim().replace(/^["']|["']$/g, "");
  if (!token) return res.status(200).json({ configured: false, missing: ["IG_ACCESS_TOKEN"] });

  const get = async (path, params = {}) => {
    const url = new URL(BASE + path);
    Object.entries({ ...params, access_token: token }).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok || j.error) {
      const err = new Error(j.error?.message || `Erreur Instagram ${r.status}`);
      err.code = j.error?.code;
      throw err;
    }
    return j;
  };

  try {
    const me = await get("/me", { fields: "user_id,username,followers_count,media_count" });
    const list = await get("/me/media", {
      fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
      limit: "40",
    });
    const media = await Promise.all(
      (list.data || []).map(async (m) => {
        const ins = {};
        // Les métriques disponibles varient selon le type de publication : on essaie la liste complète, puis une liste réduite
        for (const metric of ["views,reach,saved,shares", "reach,saved,shares", "reach"]) {
          try {
            const r = await get(`/${m.id}/insights`, { metric });
            (r.data || []).forEach((d) => (ins[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? 0));
            break;
          } catch (e) { /* on tente la liste suivante */ }
        }
        return {
          id: m.id,
          caption: m.caption || "",
          type: m.media_product_type === "REELS" ? "REELS" : m.media_type,
          permalink: m.permalink,
          timestamp: m.timestamp,
          likes: m.like_count || 0,
          comments: m.comments_count || 0,
          views: ins.views || 0,
          reach: ins.reach || 0,
          saves: ins.saved || 0,
          shares: ins.shares || 0,
        };
      })
    );
    res.status(200).json({ configured: true, username: me.username, followers: me.followers_count, media });
  } catch (e) {
    const expired = e.code === 190;
    res.status(200).json({ configured: true, error: expired ? "Le jeton Instagram a expiré : il faut en générer un nouveau (tous les 60 jours)." : e.message });
  }
};
