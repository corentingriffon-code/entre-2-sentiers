/* =========================================================
   Camp de base. Synchronisation automatique
   - Site : Google Analytics (via /api/camp/site)
   - Instagram : compte pro (via /api/camp/instagram)
   Les clés restent côté serveur (variables d'environnement Vercel).
   Les données importées ne rapportent pas de D+ : seules tes actions en rapportent.
   ========================================================= */

const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const day = (iso) => iso.slice(0, 10);
const daysBetween = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return { configured: false };
    return await r.json();
  } catch (e) {
    return { configured: false };
  }
}

/* Chemin d'article GA (« /articles/slug », « /articles/slug.html », « /en/articles/… ») → slug */
const slugOf = (path) => (path.match(/\/articles\/([^/?#.]+)/) || [])[1] || "";

function applySite(state, data, today) {
  let n = 0;
  data.weeks.forEach((w) => {
    const existing = state.siteStats.find((x) => x.week === w.week);
    if (existing) {
      // Un relevé saisi à la main reste prioritaire
      if (existing.source !== "auto") return;
      existing.visitors = w.visitors;
      existing.pageviews = w.pageviews;
    } else {
      state.siteStats.push({ id: uid("s"), week: w.week, visitors: w.visitors, pageviews: w.pageviews, source: "auto" });
    }
    n++;
  });
  const views = {};
  data.pages.forEach((p) => {
    if (p.path.startsWith("/en/")) return;
    const slug = slugOf(p.path);
    if (slug) views[slug] = (views[slug] || 0) + p.views;
  });
  state.contents.forEach((c) => {
    if (!c.slug || !views[c.slug]) return;
    const pub = state.pubs.find((p) => p.contentId === c.id && p.network === "site" && p.status === "publie");
    if (!pub) return;
    pub.stats = { ...pub.stats, impressions: views[c.slug] };
    if (!pub.statsAt || pub.statsSource === "auto") {
      pub.statsAt = today;
      pub.statsSource = "auto";
    }
  });
  return n;
}

function kindOf(type) {
  if (type === "REELS" || type === "VIDEO") return "video";
  if (type === "CAROUSEL_ALBUM") return "carrousel";
  return "post";
}

function applyInstagram(state, data, today) {
  const existing = state.audience.find((a) => a.network === "instagram" && a.date === today);
  if (existing) {
    if (existing.source === "auto") existing.followers = data.followers;
  } else if (Number.isFinite(data.followers)) {
    state.audience.push({ id: uid("a"), network: "instagram", date: today, followers: data.followers, source: "auto" });
  }

  let created = 0;
  data.media.forEach((m) => {
    const date = day(m.timestamp);
    const stats = {
      impressions: m.views || m.reach || 0,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      saves: m.saves,
    };
    // 1. Publication déjà reliée par son lien
    let pub = state.pubs.find((p) => p.network === "instagram" && p.url && p.url.split("?")[0] === m.permalink.split("?")[0]);
    // 2. Publication Instagram programmée à quelques jours près et pas encore reliée
    if (!pub) {
      pub = state.pubs
        .filter((p) => p.network === "instagram" && !p.url && p.date && daysBetween(p.date, date) <= 2)
        .sort((a, b) => daysBetween(a.date, date) - daysBetween(b.date, date))[0];
      if (pub) {
        pub.status = "publie";
        pub.date = date;
        pub.url = m.permalink;
        const c = state.contents.find((x) => x.id === pub.contentId);
        if (c) c.status = "publie";
      }
    }
    // 3. Publication faite en dehors du Camp de base : on l'ajoute (sans D+)
    if (!pub) {
      const firstLine = (m.caption.split("\n").find((l) => l.trim()) || "Publication Instagram").trim();
      const content = {
        id: uid("c"),
        title: firstLine.length > 90 ? firstLine.slice(0, 88) + "…" : firstLine,
        kind: kindOf(m.type),
        pillar: "",
        status: "publie",
        slug: "",
        notes: "Importé depuis Instagram.",
        text: m.caption,
        createdAt: date,
        imported: true,
      };
      state.contents.push(content);
      pub = { id: uid("p"), contentId: content.id, network: "instagram", date, time: "", status: "publie", url: m.permalink, stats: {}, statsAt: null, plannedAt: null, imported: true };
      state.pubs.push(pub);
      created++;
    }
    pub.stats = { ...pub.stats, ...stats };
    pub.statsAt = today;
    pub.statsSource = "auto";
  });
  return { media: data.media.length, created };
}

/* Lance la synchronisation ; renvoie un compte rendu par source */
export async function syncAll(state, today) {
  const [site, ig] = await Promise.all([fetchJSON("/api/camp/site"), fetchJSON("/api/camp/instagram")]);
  const report = { at: new Date().toISOString(), site: {}, instagram: {} };

  if (!site.configured) report.site = { status: "off", missing: site.missing || [] };
  else if (site.error) report.site = { status: "error", message: site.error };
  else report.site = { status: "ok", weeks: applySite(state, site, today) };

  if (!ig.configured) report.instagram = { status: "off", missing: ig.missing || [] };
  else if (ig.error) report.instagram = { status: "error", message: ig.error };
  else report.instagram = { status: "ok", username: ig.username, ...applyInstagram(state, ig, today) };

  state.settings.sync = report;
  return report;
}
