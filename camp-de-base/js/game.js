/* =========================================================
   Camp de base. Règles du jeu
   Tout est recalculé à partir des données (contenus + publications) :
   pas de compteur caché à désynchroniser, et rien à « farmer ».
   ========================================================= */

import { SOCIALS, NETWORKS } from "./data.js";

/* ---------- Dates ---------- */

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => ymd(new Date());
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function weekStart(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}
const inWeek = (date, ws) => !!date && date >= ws && date <= addDays(ws, 6);

/* ---------- Barème (en mètres de D+) ---------- */

export const XP = {
  content: { idee: 10, redaction: 50, pret: 120, publie: 120 },
  pubPlanned: 20,
  pubPublished: 100,
  stats: 25,
  quest: 150,
};

export const LEVELS = [
  [0, "Parking du départ"],
  [300, "Premiers lacets"],
  [800, "Lisière de la forêt"],
  [1500, "Premier ravito"],
  [2500, "Refuge"],
  [3500, "Lac d'altitude"],
  [5000, "Col"],
  [7000, "Arête"],
  [9500, "Antécime"],
  [12500, "Sommet"],
  [16000, "Au-dessus des nuages"],
];

export function levelFor(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const [from, name] = LEVELS[i];
  const next = LEVELS[i + 1];
  return {
    index: i,
    name,
    from,
    next: next ? next[0] : null,
    nextName: next ? next[1] : null,
    progress: next ? (xp - from) / (next[0] - from) : 1,
  };
}

export const hasStats = (p) => !!p.statsAt && Object.values(p.stats || {}).some((v) => Number(v) > 0);

/* ---------- Défis de la semaine ---------- */

export function questsForWeek(state, ws) {
  const goal = state.settings.weeklyGoal || 2;
  const pubs = state.pubs;
  const nextWs = addDays(ws, 7);
  const articles = pubs.filter((p) => p.network === "site" && p.status === "publie" && inWeek(p.date, ws)).length;
  const nets = new Set(pubs.filter((p) => SOCIALS.includes(p.network) && p.status === "publie" && inWeek(p.date, ws)).map((p) => p.network));
  const statsCount = pubs.filter((p) => hasStats(p) && inWeek(p.statsAt, ws)).length;
  const planned = pubs.filter((p) => inWeek(p.date, nextWs) && inWeek(p.plannedAt, ws)).length;
  return [
    { id: "articles", label: `Publier ${goal} articles sur le site`, value: articles, goal },
    { id: "reseaux", label: "Être présent sur LinkedIn, Instagram et Facebook", value: nets.size, goal: 3, detail: SOCIALS.map((n) => ({ n, ok: nets.has(n) })) },
    { id: "stats", label: "Relever les stats de 3 publications", value: statsCount, goal: 3 },
    { id: "planif", label: "Programmer 2 publications pour la semaine prochaine", value: planned, goal: 2 },
  ].map((q) => ({ ...q, done: q.value >= q.goal }));
}

function allWeeks(state) {
  const set = new Set();
  state.pubs.forEach((p) => {
    if (p.date) set.add(weekStart(p.date));
    if (p.statsAt) set.add(weekStart(p.statsAt));
    if (p.plannedAt) set.add(weekStart(p.plannedAt));
  });
  return [...set].sort();
}

export function streak(state) {
  const goal = state.settings.weeklyGoal || 2;
  const count = (ws) => state.pubs.filter((p) => p.network === "site" && p.status === "publie" && inWeek(p.date, ws)).length;
  let ws = weekStart(today());
  let n = 0;
  // La semaine en cours ne casse pas la série tant qu'elle n'est pas finie
  if (count(ws) >= goal) n++;
  ws = addDays(ws, -7);
  while (count(ws) >= goal) {
    n++;
    ws = addDays(ws, -7);
  }
  return n;
}

/* ---------- Altitude totale ---------- */

export function computeXP(state) {
  let xp = 0;
  state.contents.forEach((c) => (xp += XP.content[c.status] || 0));
  state.pubs.forEach((p) => {
    xp += p.status === "publie" ? XP.pubPublished : XP.pubPlanned;
    if (hasStats(p)) xp += XP.stats;
  });
  let quests = 0;
  allWeeks(state).forEach((ws) => questsForWeek(state, ws).forEach((q) => q.done && quests++));
  xp += quests * XP.quest;
  return xp;
}

/* ---------- Trophées ---------- */

export function badges(state) {
  const pubs = state.pubs;
  const published = pubs.filter((p) => p.status === "publie");
  const articles = published.filter((p) => p.network === "site").length;
  const statsDone = pubs.filter(hasStats).length;
  const upcoming = pubs.filter((p) => p.status === "prevu" && p.date >= today()).length;
  const ideas = state.contents.filter((c) => c.status === "idee").length;
  const sum = (k) => published.reduce((s, p) => s + (Number(p.stats?.[k]) || 0), 0);
  const maxImp = Math.max(0, ...published.map((p) => Number(p.stats?.impressions) || 0));
  const triple = state.contents.some((c) => {
    const nets = new Set(published.filter((p) => p.contentId === c.id).map((p) => p.network));
    return SOCIALS.every((n) => nets.has(n));
  });
  const s = streak(state);
  const socialFirst = Object.fromEntries(SOCIALS.map((n) => [n, published.some((p) => p.network === n)]));

  const list = [
    { id: "dossard", icon: "🎽", name: "Premier dossard", desc: "Publier un premier contenu.", value: published.length, goal: 1 },
    { id: "plume10", icon: "✍️", name: "Plume de sentier", desc: "10 articles publiés sur le site.", value: articles, goal: 10 },
    { id: "plume25", icon: "📚", name: "Bibliothèque de refuge", desc: "25 articles publiés sur le site.", value: articles, goal: 25 },
    { id: "plume50", icon: "🏔️", name: "Ultra de l'écriture", desc: "50 articles publiés sur le site.", value: articles, goal: 50 },
    { id: "linkedin", icon: "💼", name: "Réseau pro", desc: "Premier post publié sur LinkedIn.", value: socialFirst.linkedin ? 1 : 0, goal: 1 },
    { id: "instagram", icon: "📸", name: "Objectif photo", desc: "Premier post publié sur Instagram.", value: socialFirst.instagram ? 1 : 0, goal: 1 },
    { id: "facebook", icon: "👥", name: "Club local", desc: "Premier post publié sur Facebook.", value: socialFirst.facebook ? 1 : 0, goal: 1 },
    { id: "triple", icon: "🔺", name: "Triplé", desc: "Un même contenu publié sur LinkedIn, Instagram et Facebook.", value: triple ? 1 : 0, goal: 1 },
    { id: "serie3", icon: "🔥", name: "Régulier", desc: "3 semaines d'affilée à l'objectif d'articles.", value: s, goal: 3 },
    { id: "serie8", icon: "⛰️", name: "Endurance", desc: "8 semaines d'affilée à l'objectif d'articles.", value: s, goal: 8 },
    { id: "analyste", icon: "📊", name: "Chrono en main", desc: "Stats relevées sur 10 publications.", value: statsDone, goal: 10 },
    { id: "planif", icon: "🗓️", name: "Roadbook", desc: "5 publications programmées à venir.", value: upcoming, goal: 5 },
    { id: "idees", icon: "💡", name: "Sac à idées", desc: "15 idées en réserve.", value: ideas, goal: 15 },
    { id: "audience", icon: "👀", name: "Ça grimpe", desc: "10 000 impressions cumulées.", value: sum("impressions"), goal: 10000 },
    { id: "viral", icon: "🚀", name: "Effet avalanche", desc: "Une publication à 5 000 impressions.", value: maxImp, goal: 5000 },
    { id: "communaute", icon: "💬", name: "Ravito convivial", desc: "100 commentaires cumulés.", value: sum("comments"), goal: 100 },
  ];
  return list.map((b) => ({ ...b, unlocked: b.value >= b.goal }));
}

/* ---------- Prochaine action conseillée ---------- */

export function nextMission(state) {
  const t = today();
  const byId = new Map(state.contents.map((c) => [c.id, c]));
  const title = (p) => byId.get(p.contentId)?.title || "Sans titre";

  const late = state.pubs.filter((p) => p.status === "prevu" && p.date && p.date < t).sort((a, b) => a.date.localeCompare(b.date));
  if (late.length) return { text: `Publication en retard : « ${title(late[0])} » sur ${NETWORKS[late[0].network].label}`, contentId: late[0].contentId, xp: XP.pubPublished - XP.pubPlanned };

  const now = state.pubs.filter((p) => p.status === "prevu" && p.date === t);
  if (now.length) return { text: `Aujourd'hui : publier « ${title(now[0])} » sur ${NETWORKS[now[0].network].label}`, contentId: now[0].contentId, xp: XP.pubPublished - XP.pubPlanned };

  const noStats = state.pubs
    .filter((p) => p.status === "publie" && p.network !== "site" && !hasStats(p) && p.date && p.date <= addDays(t, -2))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (noStats.length) return { text: `Relever les stats de « ${title(noStats[0])} » (${NETWORKS[noStats[0].network].label})`, contentId: noStats[0].contentId, xp: XP.stats };

  const soon = state.pubs.filter((p) => p.status === "prevu" && p.date >= t && p.date <= addDays(t, 7));
  const ready = state.contents.filter((c) => c.status === "pret" && !state.pubs.some((p) => p.contentId === c.id && p.status === "prevu"));
  if (soon.length < 2 && ready.length) return { text: `Programmer « ${ready[0].title} » dans le calendrier`, contentId: ready[0].id, xp: XP.pubPlanned };

  const drafting = state.contents.find((c) => c.status === "redaction");
  if (drafting) return { text: `Finir la rédaction de « ${drafting.title} »`, contentId: drafting.id, xp: XP.content.pret - XP.content.redaction };

  const idea = state.contents.find((c) => c.status === "idee");
  if (idea) return { text: `Commencer à écrire « ${idea.title} »`, contentId: idea.id, xp: XP.content.redaction - XP.content.idee };

  return { text: "Noter une nouvelle idée de contenu", contentId: null, xp: XP.content.idee };
}
