/* =========================================================
   Camp de base. Interface
   Vues : Sentier (3D) · Planning · Contenus · Stats · Trophées
   Données : localStorage (clé STORE_KEY), export / import JSON.
   ========================================================= */

import { NETWORKS, NETWORK_ORDER, SOCIALS, PILLARS, KINDS, STATUSES, STAT_FIELDS, CHAR_LIMITS, NOTE_COLORS, seedState, statFieldsFor, normalizeState } from "./data.js";
import {
  XP, LEVELS, levelFor, computeXP, questsForWeek, streak, badges, nextMission, hasStats,
  today, addDays, weekStart, parseDate, ymd,
} from "./game.js";
import { syncAll } from "./sync.js";
import { createCloud, ARRAYS } from "./cloud.js";
import { importAllArticles } from "./importer.js";
import { buildPrompt, parseArticle, cleanPost } from "./prompts.js";
import { buildArticleHTML, slugify, readMinutes, wordCount, resizePhoto, cropPhoto, parseSources, formatSources, PILLAR_STYLE } from "./article.js";

const STORE_KEY = "e2s-camp-de-base-v1";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const fmtDate = (s) => {
  if (!s) return "Sans date";
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}${MONTHS[d.getMonth()].length > 4 ? "." : ""}`;
};

/* ---------- État ---------- */

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.contents) && Array.isArray(s.pubs)) return normalizeState(s);
    }
  } catch (e) { /* stockage indisponible : on repart des données de départ */ }
  return seedState();
}
let state = load();
let storageOk = true;

/* Copie de sécurité dans ce navigateur : l'état de la veille, gardé une journée */
const BACKUP_KEY = STORE_KEY + ":backup";
try {
  const info = JSON.parse(localStorage.getItem(BACKUP_KEY + "-info") || "{}");
  const raw = localStorage.getItem(STORE_KEY);
  if (raw && info.day !== today()) {
    try {
      localStorage.setItem(BACKUP_KEY, raw);
      localStorage.setItem(BACKUP_KEY + "-info", JSON.stringify({ day: today(), at: new Date().toISOString() }));
    } catch (e) {
      localStorage.removeItem(BACKUP_KEY); // pas assez de place : la copie en ligne prend le relais
    }
  }
} catch (e) { /* stockage indisponible */ }

/* Suppressions mémorisées : ce qui disparaît ici ne doit pas revenir depuis un autre appareil */
const idSets = (s) => Object.fromEntries(ARRAYS.map((k) => [k, new Set((s[k] || []).map((x) => x.id))]));
let lastIds = idSets(state);
function trackDeletions() {
  const now = idSets(state);
  const del = (state.deleted ||= {});
  const t = today();
  ARRAYS.forEach((k) => {
    lastIds[k].forEach((id) => { if (!now[k].has(id)) del[id] = t; });
    now[k].forEach((id) => { if (!lastIds[k].has(id)) delete del[id]; }); // recréé ici : plus supprimé
  });
  // On oublie les suppressions de plus de 6 mois
  const limit = ymd(new Date(Date.now() - 183 * 864e5));
  Object.keys(del).forEach((id) => { if (del[id] < limit) delete del[id]; });
}

function save({ fromCloud = false } = {}) {
  try {
    if (!fromCloud) trackDeletions();
    lastIds = idSets(state);
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (!fromCloud) cloud?.touched();
  } catch (e) {
    if (storageOk) toast("Impossible d'enregistrer dans ce navigateur : pense à exporter tes données.", "warn");
    storageOk = false;
  }
}

const contentById = (id) => state.contents.find((c) => c.id === id);
const pubsOf = (id) => state.pubs.filter((p) => p.contentId === id);

/* Statut affiché d'un contenu (programmé = au moins une publication prévue) */
function displayState(c) {
  if (c.status === "publie") return "publie";
  if (pubsOf(c.id).some((p) => p.status === "prevu")) return "programme";
  return c.status;
}
function keyDate(c) {
  const ps = pubsOf(c.id).filter((p) => p.date);
  const pub = ps.filter((p) => p.status === "publie").map((p) => p.date).sort()[0];
  if (c.status === "publie") return pub || ps.map((p) => p.date).sort()[0] || c.createdAt || "";
  const planned = ps.filter((p) => p.status === "prevu").map((p) => p.date).sort()[0];
  return planned || pub || "";
}

/* ---------- Progression : récompenses visibles ---------- */

let lastXP = computeXP(state);
let lastLevel = levelFor(lastXP).index;
if (state.seenBadges == null) state.seenBadges = badges(state).filter((b) => b.unlocked).map((b) => b.id);

function afterChange({ celebrateId = null, keepPanel = false } = {}) {
  save();
  const xp = computeXP(state);
  const delta = xp - lastXP;
  if (delta > 0) toast(`+${fmt(delta)} m de D+`, "xp");
  else if (delta < 0) toast(`${fmt(delta)} m de D+`, "muted");
  const lvl = levelFor(xp);
  if (lvl.index > lastLevel) showLevelUp(lvl);
  lastXP = xp;
  lastLevel = lvl.index;

  const unlocked = badges(state).filter((b) => b.unlocked);
  unlocked.forEach((b) => {
    if (!state.seenBadges.includes(b.id)) {
      state.seenBadges.push(b.id);
      toast(`${b.icon} Trophée débloqué : ${b.name}`, "badge");
    }
  });
  save();
  if (keepPanel) {
    // Saisie en place (tableau de stats) : on ne redessine pas la page pour garder le curseur
    renderHud();
    renderSide();
    renderScene();
  } else renderAll();
  if (celebrateId && scene) {
    scene.celebrate(celebrateId);
  }
}

/* ---------- Scène 3D ---------- */

let scene = null;
const tooltip = $("#tooltip");

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
function loaderStep(pct, text) {
  const l = $("#loader");
  if (!l) return;
  l.querySelector(".loader-fill").style.width = pct + "%";
  l.querySelector(".loader-runner").style.left = pct + "%";
  l.querySelector(".loader-text").textContent = text;
}
function hideLoader() {
  const l = $("#loader");
  if (!l) return;
  l.classList.add("is-done");
  setTimeout(() => l.remove(), 700);
}

const nearPrompt = $("#near-prompt");
function showNear(n) {
  if (!n) { nearPrompt.hidden = true; return; }
  let label;
  if (n.type === "station") label = `${n.small} · ${n.title}`;
  else label = contentById(n.id)?.title || "Contenu";
  nearPrompt.querySelector(".near-label").textContent = label;
  nearPrompt.hidden = false;
}
nearPrompt.addEventListener("click", () => scene?.activateNear());

async function initScene() {
  try {
    loaderStep(25, "On lace les chaussures…");
    await nextFrame();
    const mod = await import("./scene.js");
    loaderStep(55, "On dessine la montagne…");
    await nextFrame();
    scene = mod.createScene($("#scene"), {
      onStation: (id) => setView(id),
      onProximity: showNear,
      onSelect: (id) => openEditor(id),
      onHover: (h) => {
        if (!h) { tooltip.hidden = true; return; }
        const c = contentById(h.id);
        if (!c) return;
        const st = displayState(c);
        const label = { publie: "Publié", programme: "Programmé", pret: "Prêt", redaction: "En rédaction", idee: "Idée" }[st];
        const d = keyDate(c);
        tooltip.innerHTML = `<strong>${esc(c.title)}</strong><span>${label}${d ? " · " + fmtDate(d) : ""}</span>`;
        tooltip.hidden = false;
        tooltip.style.left = `${h.x + 14}px`;
        tooltip.style.top = `${h.y + 14}px`;
      },
    });
  } catch (e) {
    scene = null;
  }
  if (!scene) {
    $("#scene-fallback").hidden = false;
    $("#scene-controls").hidden = true;
  }
  loaderStep(85, "On balise le sentier…");
  await nextFrame();
  renderScene();
  scene?.setActive(view === "sentier");
  loaderStep(100, "C'est parti !");
  await nextFrame();
  setTimeout(hideLoader, 350);
}

function renderScene() {
  if (!scene) return;
  const rank = { publie: 0, programme: 1, pret: 2, redaction: 3, idee: 4 };
  const items = state.contents
    .map((c) => ({ c, st: displayState(c), d: keyDate(c) }))
    .sort((a, b) => {
      const da = a.st === "publie" || a.st === "programme" ? a.d : "";
      const db = b.st === "publie" || b.st === "programme" ? b.d : "";
      if (da && db) return da.localeCompare(db) || rank[a.st] - rank[b.st];
      if (da) return -1;
      if (db) return 1;
      return rank[a.st] - rank[b.st] || (a.c.createdAt || "").localeCompare(b.c.createdAt || "");
    })
    .map(({ c, st }) => ({
      id: c.id,
      title: c.title,
      state: st,
      networks: [...new Set(pubsOf(c.id).map((p) => p.network))]
        .sort((a, b) => NETWORK_ORDER.indexOf(a) - NETWORK_ORDER.indexOf(b))
        .map((n) => parseInt(NETWORKS[n].color.slice(1), 16)),
    }));
  let avatar = -1;
  items.forEach((it, i) => { if (it.state === "publie") avatar = i; });
  // Quelques étiquettes flottantes pour les repères utiles
  if (avatar >= 0) items[avatar].pin = "Dernière publication";
  const nextPlanned = items.find((it) => it.state === "programme");
  if (nextPlanned) nextPlanned.pin = "Prochaine publication";
  const nextReady = items.find((it) => it.state === "pret");
  if (nextReady) nextReady.pin = "Prêt à programmer";
  scene.setItems(items, avatar);
}

/* ---------- HUD ---------- */

function renderHud() {
  const xp = computeXP(state);
  const lvl = levelFor(xp);
  $("#xp-value").textContent = fmt(xp);
  $("#level-name").textContent = lvl.name;
  const bar = $("#level-bar");
  bar.setAttribute("aria-valuenow", Math.round(lvl.progress * 100));
  bar.firstElementChild.style.width = `${Math.round(lvl.progress * 100)}%`;
  $("#level-next").textContent = lvl.next ? `${fmt(lvl.next - xp)} m avant « ${lvl.nextName} »` : "Tu es au-dessus des nuages.";
  const s = streak(state);
  $("#streak-value").textContent = s;
  $("#streak").classList.toggle("is-on", s > 0);
  $("#goal-input").value = state.settings.weeklyGoal || 2;
}

/* ---------- Colonne latérale : mission, défis, à venir ---------- */

function questHTML(q) {
  const pct = Math.min(100, Math.round((q.value / q.goal) * 100));
  const detail = q.detail
    ? `<span class="quest-nets">${q.detail.map((d) => `<span class="net-chip ${d.ok ? "" : "is-off"}" style="--net:${NETWORKS[d.n].color}">${NETWORKS[d.n].label}</span>`).join("")}</span>`
    : "";
  return `<li class="quest ${q.done ? "is-done" : ""}">
    <div class="quest-top"><span class="quest-check" aria-hidden="true">${q.done ? "✓" : ""}</span><span>${esc(q.label)}</span><span class="quest-count">${Math.min(q.value, q.goal)}/${q.goal}</span></div>
    <div class="bar bar-sm"><span style="width:${pct}%"></span></div>${detail}
  </li>`;
}

function renderSide() {
  const m = nextMission(state);
  const quests = questsForWeek(state, weekStart(today()));
  const done = quests.filter((q) => q.done).length;
  const t = today();
  const upcoming = state.pubs
    .filter((p) => p.status === "prevu" && (!p.date || p.date >= addDays(t, -30)))
    .sort((a, b) => ((a.date || "9") + (a.time || "")).localeCompare((b.date || "9") + (b.time || "")))
    .slice(0, 6);
  const tasksSoon = state.tasks.filter((k) => !k.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 4);
  const toWrite = state.contents.filter((c) => c.status === "idee" || c.status === "redaction").length;
  const ready = state.contents.filter((c) => c.status === "pret").length;

  $("#side").innerHTML = `
    <section class="card mission">
      <p class="eyebrow">Prochaine étape</p>
      <p class="mission-text">${esc(m.text)}</p>
      <div class="mission-foot">
        <span class="xp-pill">+${m.xp} m</span>
        ${m.goto ? `<button class="btn btn-primary btn-sm" type="button" data-goto="${m.goto}">J'y vais</button>` : `<button class="btn btn-primary btn-sm" type="button" data-mission="${m.contentId || ""}">${m.contentId ? "J'y vais" : "Nouvelle idée"}</button>`}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><p class="eyebrow">Défis de la semaine</p><span class="muted">${done}/4 · +${XP.quest} m chacun</span></div>
      <ul class="quests">${quests.map(questHTML).join("")}</ul>
    </section>
    <section class="card">
      <div class="card-head"><p class="eyebrow">À publier</p><button class="link" type="button" data-goto="planning">Planning →</button></div>
      ${upcoming.length ? `<ul class="upcoming">${upcoming.map((p) => {
        const c = contentById(p.contentId);
        const late = p.date && p.date < t;
        return `<li><button type="button" data-open="${p.contentId}">
          <span class="net-dot" style="--net:${NETWORKS[p.network].color}" aria-hidden="true"></span>
          <span class="up-title">${esc(c?.title || "Sans titre")}</span>
          <span class="up-meta ${late ? "is-late" : ""}">${NETWORKS[p.network].label} · ${!p.date ? "date à choisir" : late ? "en retard" : p.date === t ? "aujourd'hui" : fmtDate(p.date)}</span>
        </button></li>`;
      }).join("")}</ul>` : `<p class="empty">Rien de programmé. Glisse un contenu prêt dans le planning.</p>`}
      <p class="side-foot"><strong>${toWrite}</strong> à écrire · <strong>${ready}</strong> prêts</p>
    </section>
    <section class="card">
      <div class="card-head"><p class="eyebrow">Mémo</p><button class="link" type="button" data-goto="memo">Tâches et notes →</button></div>
      ${tasksSoon.length ? `<ul class="tasks tasks-side">${tasksSoon.map(taskItem).join("")}</ul>` : `<p class="empty">Aucune tâche en cours.</p>`}
      <form class="task-form task-form-side" data-form="task">
        <input class="input" name="text" placeholder="Tâche rapide…" aria-label="Nouvelle tâche" required>
        <button class="btn btn-primary btn-sm" type="submit">+</button>
      </form>
    </section>`;
}

/* ---------- Vue Planning (calendrier) ---------- */

let calMonth = today().slice(0, 7);

function renderPlanning() {
  const [y, m] = calMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const start = weekStart(ymd(first));
  const last = new Date(y, m, 0);
  const end = addDays(weekStart(ymd(last)), 6);
  const t = today();
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const toPlan = state.contents.filter((c) => (c.status === "pret" || c.status === "redaction") && !pubsOf(c.id).some((p) => p.status === "prevu" && p.date));

  $("#panel").innerHTML = `
    <div class="panel-head">
      <div>
        <p class="eyebrow">Planning</p>
        <h1>${MONTHS[m - 1]} ${y}</h1>
      </div>
      <div class="panel-tools">
        <button class="btn btn-ghost btn-sm" type="button" data-cal="-1" aria-label="Mois précédent">←</button>
        <button class="btn btn-ghost btn-sm" type="button" data-cal="0">Aujourd'hui</button>
        <button class="btn btn-ghost btn-sm" type="button" data-cal="1" aria-label="Mois suivant">→</button>
      </div>
    </div>
    <div class="planning">
      <div class="calendar" role="grid" aria-label="Calendrier de ${MONTHS[m - 1]} ${y}">
        ${DAYS.map((d) => `<div class="cal-dow" role="columnheader">${d}</div>`).join("")}
        ${days.map((d) => {
          const ps = state.pubs.filter((p) => p.date === d).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
          const out = d.slice(0, 7) !== calMonth;
          return `<div class="cal-day ${out ? "is-out" : ""} ${d === t ? "is-today" : ""}" data-day="${d}" role="gridcell">
            <button class="cal-num" type="button" data-addday="${d}" title="Programmer le ${fmtDate(d)}">${parseDate(d).getDate()}<span class="cal-plus" aria-hidden="true">+</span></button>
            ${ps.map((p) => {
              const c = contentById(p.contentId);
              const late = p.status === "prevu" && p.date < t;
              return `<button type="button" class="pub-chip ${p.status === "publie" ? "is-done" : ""} ${late ? "is-late" : ""}" draggable="true" data-pub="${p.id}" data-open="${p.contentId}" data-focuspub="${p.id}" style="--net:${NETWORKS[p.network].color}" title="${esc(c?.title)} · ${NETWORKS[p.network].label}${p.status === "publie" ? " · publié" : ""}">
                <span class="pub-net">${NETWORKS[p.network].short}</span><span class="pub-title">${esc(c?.title || "Sans titre")}</span>
              </button>`;
            }).join("")}
            ${state.tasks.filter((k) => k.due === d).map((k) => `<button type="button" class="task-chip ${k.done ? "is-done" : ""}" data-goto="memo" title="Tâche : ${esc(k.text)}"><span aria-hidden="true">${k.done ? "☑" : "☐"}</span><span class="pub-title">${esc(k.text)}</span></button>`).join("")}
          </div>`;
        }).join("")}
      </div>
      <aside class="toplan">
        <p class="eyebrow">À programmer</p>
        <p class="muted small">Glisse un contenu sur un jour du calendrier (+${XP.pubPlanned} m).</p>
        ${toPlan.length ? toPlan.map((c) => `<button type="button" class="plan-card" draggable="true" data-content="${c.id}" data-open="${c.id}">
          <span class="status-tag st-${c.status}">${STATUSES[c.status]}</span>
          <span>${esc(c.title)}</span>
        </button>`).join("") : `<p class="empty">Tout ce qui est prêt est déjà programmé.</p>`}
        <div class="cal-legend">
          ${NETWORK_ORDER.map((n) => `<span><i class="net-dot" style="--net:${NETWORKS[n].color}"></i>${NETWORKS[n].label}</span>`).join("")}
          <span><i class="chip-sample"></i>Prévu</span><span><i class="chip-sample is-done"></i>Publié</span>
        </div>
      </aside>
    </div>`;
}

/* ---------- Vue Contenus (tableau par étape) ---------- */

function contentCard(c) {
  const ps = pubsOf(c.id);
  const st = displayState(c);
  const nets = [...new Set(ps.map((p) => p.network))].sort((a, b) => NETWORK_ORDER.indexOf(a) - NETWORK_ORDER.indexOf(b));
  const next = { idee: "redaction", redaction: "pret", pret: "publie" }[c.status];
  const nextLabel = { redaction: "Commencer", pret: "C'est prêt", publie: "Publié !" }[next];
  const gain = next ? XP.content[next] - XP.content[c.status] : 0;
  const d = keyDate(c);
  return `<article class="k-card" draggable="true" data-content="${c.id}">
    <button type="button" class="k-open" data-open="${c.id}">
      <span class="k-meta"><span>${KINDS[c.kind] || "Contenu"}</span>${c.pillar ? `<span>· ${PILLARS[c.pillar]}</span>` : ""}</span>
      <span class="k-title">${esc(c.title)}</span>
    </button>
    <div class="k-foot">
      <span class="k-nets">${nets.map((n) => {
        const done = ps.some((p) => p.network === n && p.status === "publie");
        return `<span class="net-chip ${done ? "" : "is-off"}" style="--net:${NETWORKS[n].color}" title="${NETWORKS[n].label} · ${done ? "publié" : "prévu"}">${NETWORKS[n].short}</span>`;
      }).join("")}${st === "programme" ? `<span class="k-date">${fmtDate(d)}</span>` : ""}${c.status === "publie" && d ? `<span class="k-date">${fmtDate(d)}</span>` : ""}</span>
      ${next && next !== "publie" ? `<button type="button" class="btn btn-ghost btn-xs" data-advance="${c.id}">${nextLabel} <span class="xp-pill">+${gain}</span></button>` : ""}
    </div>
  </article>`;
}

let contentFilter = "";

function renderContenus() {
  const cols = ["idee", "redaction", "pret", "publie"];
  const hint = { idee: "Le sac à idées", redaction: "Sur le clavier", pret: "Au départ", publie: "Franchi la ligne" };
  const q = contentFilter.trim().toLowerCase();
  const list = state.contents.filter((c) => !q || c.title.toLowerCase().includes(q));
  $("#panel").innerHTML = `
    <div class="panel-head">
      <div><p class="eyebrow">Contenus</p><h1>Du sac à idées à la ligne d'arrivée</h1></div>
      <div class="panel-tools">
        <input type="search" class="input" id="content-search" placeholder="Rechercher…" value="${esc(contentFilter)}" aria-label="Rechercher un contenu">
      </div>
    </div>
    <div class="kanban">
      ${cols.map((s) => {
        const items = list.filter((c) => c.status === s).sort((a, b) => {
          if (s === "publie") return keyDate(b).localeCompare(keyDate(a));
          return (displayState(b) === "programme") - (displayState(a) === "programme") || (keyDate(a) || "9").localeCompare(keyDate(b) || "9");
        });
        return `<section class="k-col" data-col="${s}">
          <header class="k-head"><h2>${STATUSES[s]}</h2><span class="k-count">${items.length}</span><span class="k-hint">${hint[s]}</span></header>
          ${s === "idee" ? `<form class="quick-idea" data-quick><input class="input" name="title" placeholder="Nouvelle idée… (+${XP.content.idee} m)" aria-label="Nouvelle idée" required><button class="btn btn-primary btn-sm" type="submit">Ajouter</button></form>` : ""}
          <div class="k-list">${items.map(contentCard).join("") || `<p class="empty">Rien ici pour l'instant.</p>`}</div>
        </section>`;
      }).join("")}
    </div>`;
}

/* ---------- Vue Stats ---------- */

let statsNet = "all";
let statsPeriod = "90";

function statsHeader(title) {
  return `<div class="panel-head">
      <div><p class="eyebrow">Stats</p><h1>${title}</h1></div>
      <div class="panel-tools filters">
        <div class="seg" role="group" aria-label="Réseau">
          ${["all", ...NETWORK_ORDER].map((n) => `<button type="button" data-statnet="${n}" aria-pressed="${statsNet === n}">${n === "all" ? "Vue d'ensemble" : NETWORKS[n].label}</button>`).join("")}
        </div>
        <div class="seg" role="group" aria-label="Période">
          ${[["30", "30 j"], ["90", "90 j"], ["all", "Tout"]].map(([v, l]) => `<button type="button" data-statperiod="${v}" aria-pressed="${statsPeriod === v}">${l}</button>`).join("")}
        </div>
      </div>
    </div>
    ${syncBar()}`;
}

/* ---------- Connexions : Google Analytics et Instagram ---------- */

let syncing = false;
function ago(iso) {
  if (!iso) return "jamais";
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
function syncBar() {
  const r = state.settings.sync || {};
  const chip = (label, x, color) => {
    const st = x?.status;
    const text = st === "ok" ? "connecté" : st === "error" ? "erreur" : "non connecté";
    return `<span class="sync-chip sync-${st || "off"}" style="--net:${color}" title="${esc(x?.message || "")}"><i class="net-dot"></i>${label} · ${text}</span>`;
  };
  const errors = [r.site, r.instagram].filter((x) => x?.status === "error").map((x) => x.message);
  const missing = [
    ["Site", r.site],
    ["Instagram", r.instagram],
  ].filter(([, x]) => x?.status === "off" && x.missing?.length).map(([l, x]) => `${l} : variable${x.missing.length > 1 ? "s" : ""} ${x.missing.join(", ")} introuvable${x.missing.length > 1 ? "s" : ""} sur Vercel (vérifie le nom exact et la case Production, puis Redeploy).`);
  return `<div class="sync-bar">
    ${chip("Site (Google Analytics)", r.site, NETWORKS.site.color)}
    ${chip("Instagram", r.instagram, NETWORKS.instagram.color)}
    <span class="muted small">LinkedIn et Facebook : saisie à la main · dernière synchro ${ago(r.at)}</span>
    <button type="button" class="btn btn-ghost btn-sm" data-sync ${syncing ? "disabled" : ""}>${syncing ? "Synchro…" : "↻ Synchroniser"}</button>
    ${errors.map((m) => `<p class="sync-error">${esc(m)}</p>`).join("")}
    ${missing.map((m) => `<p class="sync-missing">${esc(m)}</p>`).join("")}
  </div>`;
}
async function runSync({ quiet = false } = {}) {
  if (syncing) return;
  syncing = true;
  if (view === "stats") renderStats();
  try {
    const r = await syncAll(state, today());
    const parts = [];
    if (r.site.status === "ok") parts.push("site à jour");
    if (r.instagram.status === "ok") parts.push(`Instagram à jour${r.instagram.created ? ` (${r.instagram.created} publication${r.instagram.created > 1 ? "s" : ""} ajoutée${r.instagram.created > 1 ? "s" : ""})` : ""}`);
    if (!quiet) toast(parts.length ? `Synchro : ${parts.join(", ")}` : "Aucune connexion configurée pour l'instant", parts.length ? "" : "muted");
    else if (r.instagram.created) toast(`${r.instagram.created} publication(s) Instagram ajoutée(s)`);
  } finally {
    syncing = false;
    afterChange();
  }
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-sync]")) runSync();
});

function renderStats() {
  if (statsNet === "site") return renderSiteStats();
  if (SOCIALS.includes(statsNet)) return renderNetworkStats(statsNet);
  const t = today();
  const from = statsPeriod === "all" ? "" : addDays(t, -Number(statsPeriod));
  const pubs = state.pubs.filter((p) => p.status === "publie" && (!from || (p.date && p.date >= from)) && (statsNet === "all" || p.network === statsNet));
  const sum = (arr, k) => arr.reduce((s, p) => s + (Number(p.stats?.[k]) || 0), 0);
  const eng = (p) => ["likes", "comments", "shares", "saves"].reduce((s, k) => s + (Number(p.stats?.[k]) || 0), 0);
  const withStats = pubs.filter(hasStats);
  const imp = sum(withStats, "impressions");
  const engTotal = withStats.reduce((s, p) => s + eng(p), 0);
  const rate = imp ? (engTotal / imp) * 100 : 0;
  const igAuto = state.settings.sync?.instagram?.status === "ok";
  const missing = state.pubs.filter((p) => p.status === "publie" && p.network !== "site" && !(igAuto && p.network === "instagram") && !hasStats(p)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const byNet = NETWORK_ORDER.map((n) => {
    const ps = withStats.filter((p) => p.network === n);
    return { n, count: pubs.filter((p) => p.network === n).length, imp: sum(ps, "impressions"), eng: ps.reduce((s, p) => s + eng(p), 0) };
  }).filter((r) => statsNet === "all" || r.n === statsNet);
  const maxImp = Math.max(1, ...byNet.map((r) => r.imp));

  const top = [...withStats].sort((a, b) => eng(b) - eng(a) || (Number(b.stats.impressions) || 0) - (Number(a.stats.impressions) || 0)).slice(0, 12);
  const maxEng = Math.max(1, ...top.map(eng));

  $("#panel").innerHTML = `
    ${statsHeader("Le chrono de tes publications")}

    <section class="audience-row">
      ${audienceCard("site")}${SOCIALS.map(audienceCard).join("")}
    </section>

    <div class="tiles">
      <div class="tile"><span class="tile-label">Publications</span><span class="tile-value">${fmt(pubs.length)}</span><span class="tile-sub">${withStats.length} avec stats</span></div>
      <div class="tile"><span class="tile-label">Impressions</span><span class="tile-value">${fmt(imp)}</span><span class="tile-sub">sur les publications relevées</span></div>
      <div class="tile"><span class="tile-label">Interactions</span><span class="tile-value">${fmt(engTotal)}</span><span class="tile-sub">réactions, commentaires, partages, enregistr.</span></div>
      <div class="tile"><span class="tile-label">Taux d'engagement</span><span class="tile-value">${imp ? rate.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %" : "–"}</span><span class="tile-sub">interactions / impressions</span></div>
    </div>

    <div class="stats-grid">
      <section class="card">
        <div class="card-head"><h2 class="h-card">Impressions par réseau</h2></div>
        ${imp ? `<ul class="hbars">${byNet.map((r) => `<li title="${NETWORKS[r.n].label} : ${fmt(r.imp)} impressions, ${fmt(r.eng)} interactions, ${r.count} publications">
          <span class="hb-label"><i class="net-dot" style="--net:${NETWORKS[r.n].color}"></i>${NETWORKS[r.n].label}</span>
          <span class="hb-track"><span class="hb-bar" style="width:${(r.imp / maxImp) * 100}%;--net:${NETWORKS[r.n].color}"></span></span>
          <span class="hb-value">${fmt(r.imp)}</span>
        </li>`).join("")}</ul>` : `<p class="empty">Aucune stat relevée sur cette période. Ouvre une publication et remplis ses compteurs (+${XP.stats} m chacune).</p>`}
      </section>

      <section class="card">
        <div class="card-head"><h2 class="h-card">Relevé des compteurs</h2><span class="muted">${missing.length} en attente</span></div>
        ${missing.length ? `<ul class="missing">${missing.slice(0, 8).map((p) => `<li><button type="button" data-open="${p.contentId}" data-focuspub="${p.id}">
          <i class="net-dot" style="--net:${NETWORKS[p.network].color}"></i>
          <span class="up-title">${esc(contentById(p.contentId)?.title || "Sans titre")}</span>
          <span class="up-meta">${NETWORKS[p.network].label} · ${fmtDate(p.date)}</span>
          <span class="xp-pill">+${XP.stats}</span>
        </button></li>`).join("")}</ul>` : `<p class="empty">Toutes les publications réseaux ont leurs stats. Bien joué.</p>`}
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2 class="h-card">Meilleures publications</h2><span class="muted">classées par interactions</span></div>
      ${top.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th scope="col">Publication</th><th scope="col">Réseau</th><th scope="col">Date</th>${STAT_FIELDS.map(([, l]) => `<th scope="col" class="num">${l}</th>`).join("")}<th scope="col">Interactions</th></tr></thead>
        <tbody>${top.map((p) => `<tr data-open="${p.contentId}" data-focuspub="${p.id}" tabindex="0">
          <td class="t-title">${esc(contentById(p.contentId)?.title || "Sans titre")}</td>
          <td><span class="net-chip" style="--net:${NETWORKS[p.network].color}">${NETWORKS[p.network].label}</span></td>
          <td>${fmtDate(p.date)}</td>
          ${STAT_FIELDS.map(([k]) => `<td class="num">${p.stats?.[k] ? fmt(p.stats[k]) : "–"}</td>`).join("")}
          <td><span class="mini-bar"><span style="width:${(eng(p) / maxEng) * 100}%"></span></span><span class="num">${fmt(eng(p))}</span></td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<p class="empty">Le classement apparaîtra dès que des stats seront relevées.</p>`}
      <p class="muted small">Les compteurs se saisissent à la main depuis chaque publication (Instagram, LinkedIn et Facebook ne permettent pas de les lire sans application connectée).</p>
    </section>`;
}

/* ---------- Stats : audience (site et réseaux) ---------- */

const sortedBy = (arr, k) => [...arr].sort((a, b) => a[k].localeCompare(b[k]));
const siteReports = () => sortedBy(state.siteStats, "week");
const audienceOf = (n) => sortedBy(state.audience.filter((a) => a.network === n), "date");
const engOf = (p) => ["likes", "comments", "shares", "saves"].reduce((s, k) => s + (Number(p.stats?.[k]) || 0), 0);
const sumOf = (arr, k) => arr.reduce((s, p) => s + (Number(p.stats?.[k]) || 0), 0);
const pct = (a, b) => (b ? ((a / b) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %" : "–");

function delta(cur, prev) {
  if (prev == null) return "";
  const d = cur - prev;
  if (!d) return `<span class="delta">=</span>`;
  return `<span class="delta ${d > 0 ? "is-up" : "is-down"}">${d > 0 ? "▲ +" : "▼ "}${fmt(d)}</span>`;
}

/* Carte récapitulative en tête de la vue d'ensemble */
function audienceCard(n) {
  const net = NETWORKS[n];
  if (n === "site") {
    const r = siteReports();
    const last = r[r.length - 1];
    const prev = r[r.length - 2];
    return `<button type="button" class="aud-card" data-statnet="site" style="--net:${net.color}">
      <span class="aud-name"><i class="net-dot"></i>Site · visiteurs</span>
      <span class="aud-value">${last ? fmt(last.visitors) : "–"}</span>
      <span class="aud-sub">${last ? `semaine du ${fmtDate(last.week)} ${delta(last.visitors, prev?.visitors)}` : "Aucun relevé : clique pour en ajouter"}</span>
    </button>`;
  }
  const a = audienceOf(n);
  const last = a[a.length - 1];
  const prev = a[a.length - 2];
  return `<button type="button" class="aud-card" data-statnet="${n}" style="--net:${net.color}">
    <span class="aud-name"><i class="net-dot"></i>${net.label} · abonnés</span>
    <span class="aud-value">${last ? fmt(last.followers) : "–"}</span>
    <span class="aud-sub">${last ? `au ${fmtDate(last.date)} ${delta(last.followers, prev?.followers)}` : "Aucun relevé : clique pour en ajouter"}</span>
  </button>`;
}

/* Histogramme vertical, une seule série (couleur = identité du réseau) */
function vbars(points, color, unit) {
  if (!points.length) return "";
  const max = Math.max(1, ...points.map((p) => p.value));
  const maxIdx = points.findIndex((p) => p.value === max);
  return `<div class="vbars" role="img" aria-label="${esc(unit)} : ${points.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}">
    ${[0.5, 1].map((g) => `<span class="vb-grid" style="bottom:calc(26px + ${g} * (100% - 60px))"><span>${fmt(max * g)}</span></span>`).join("")}
    ${points.map((p, i) => `<div class="vb-col" title="${esc(p.title || p.label)} : ${fmt(p.value)} ${esc(unit)}">
      <span class="vb-val">${i === points.length - 1 || i === maxIdx ? fmt(p.value) : ""}</span>
      <span class="vb-bar" style="height:${(p.value / max) * 100}%;--net:${color}"></span>
      <span class="vb-label">${esc(p.label)}</span>
    </div>`).join("")}
  </div>`;
}

function inPeriod(date) {
  if (statsPeriod === "all") return true;
  return !!date && date >= addDays(today(), -Number(statsPeriod));
}

/* Tableau à remplir directement (LinkedIn, Facebook) : une ligne par publication, des cases pour les chiffres */
function editablePubTable(pubs, fields) {
  if (!pubs.length) return `<p class="empty">Aucune publication pour l'instant.</p>`;
  return `<div class="table-wrap"><table class="table table-edit">
    <thead><tr><th scope="col">Publication</th><th scope="col">Date</th>${fields.map(([, l]) => `<th scope="col" class="num">${l}</th>`).join("")}<th scope="col"></th></tr></thead>
    <tbody>${pubs.map((p) => {
      const c = contentById(p.contentId);
      const isArticle = c?.kind === "article";
      return `<tr>
      <td class="t-title">${isArticle ? `<span class="kind-tag">Article</span> ` : ""}<button type="button" class="link t-link" data-open="${p.contentId}" data-focuspub="${p.id}">${esc(c?.title || "Sans titre")}</button>${p.status === "prevu" ? ` <span class="muted small">(prévu)</span>` : ""}</td>
      <td>${fmtDate(p.date)}</td>
      ${fields.map(([k, l]) => `<td class="num"><input class="input stat-cell" type="number" min="0" step="1" inputmode="numeric" data-statpub="${p.id}" data-k="${k}" value="${p.stats?.[k] ?? ""}" aria-label="${l} : ${esc(c?.title || "")}"></td>`).join("")}
      <td>${hasStats(p) ? `<span class="ok-tick" title="Stats relevées le ${fmtDate(p.statsAt)}">✓</span>` : `<span class="xp-pill">+${XP.stats}</span>`}</td>
    </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

/* Nombre d'abonnés tapé directement dans la tuile : relevé du jour */
document.addEventListener("change", (e) => {
  const input = e.target.closest("[data-followers]");
  if (!input || input.value.trim() === "") return;
  const network = input.dataset.followers;
  const followers = Math.max(0, Number(input.value) || 0);
  const date = today();
  const existing = state.audience.find((a) => a.network === network && a.date === date);
  if (existing) { existing.followers = followers; existing.source = existing.source === "auto" ? "manual" : existing.source; }
  else state.audience.push({ id: uid("a"), network, date, followers });
  afterChange();
});

/* Enregistre une case du tableau dès qu'on la quitte */
document.addEventListener("change", (e) => {
  const input = e.target.closest("[data-statpub]");
  if (!input) return;
  const p = state.pubs.find((x) => x.id === input.dataset.statpub);
  if (!p) return;
  const v = input.value.trim();
  p.stats = { ...(p.stats || {}) };
  if (v === "") delete p.stats[input.dataset.k];
  else p.stats[input.dataset.k] = Math.max(0, Number(v) || 0);
  if (Object.values(p.stats).some((x) => x > 0)) {
    p.statsAt = today();
    p.statsSource = "manual";
    if (p.status === "prevu") p.status = "publie";
  } else p.statsAt = null;
  const tick = input.closest("tr").lastElementChild;
  tick.innerHTML = hasStats(p) ? `<span class="ok-tick">✓</span>` : `<span class="xp-pill">+${XP.stats}</span>`;
  afterChange({ keepPanel: true });
});

/* Quand on quitte le tableau, on remet à jour les tuiles (impressions, engagement) */
document.addEventListener("focusout", (e) => {
  const table = e.target.closest?.(".table-edit");
  if (!table || (e.relatedTarget && table.contains(e.relatedTarget))) return;
  if (view === "stats") setTimeout(() => !document.activeElement?.closest?.(".table-edit") && renderStats(), 0);
});

function pubTable(pubs, fields) {
  if (!pubs.length) return `<p class="empty">Aucune publication sur cette période.</p>`;
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th scope="col">Publication</th><th scope="col">Date</th>${fields.map(([, l]) => `<th scope="col" class="num">${l}</th>`).join("")}<th scope="col"></th></tr></thead>
    <tbody>${pubs.map((p) => `<tr data-open="${p.contentId}" data-focuspub="${p.id}" tabindex="0">
      <td class="t-title">${esc(contentById(p.contentId)?.title || "Sans titre")}</td>
      <td>${fmtDate(p.date)}</td>
      ${fields.map(([k]) => `<td class="num">${p.stats?.[k] ? fmt(p.stats[k]) : "–"}</td>`).join("")}
      <td>${hasStats(p) ? "" : `<span class="xp-pill">+${XP.stats}</span>`}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderSiteStats() {
  const r = siteReports();
  // La semaine en cours n'est pas finie : les tuiles comparent les semaines complètes
  const thisWeek = weekStart(today());
  const done = r.filter((x) => x.week < thisWeek);
  const last = done[done.length - 1];
  const prev = done[done.length - 2];
  const recent = done.slice(-4);
  const gaOk = state.settings.sync?.site?.status === "ok";
  const avg = recent.length ? recent.reduce((s, x) => s + x.visitors, 0) / recent.length : 0;
  const articles = state.pubs
    .filter((p) => p.network === "site" && p.status === "publie" && inPeriod(p.date))
    .sort((a, b) => (Number(b.stats?.impressions) || 0) - (Number(a.stats?.impressions) || 0) || (b.date || "").localeCompare(a.date || ""));
  const views = sumOf(articles, "impressions");
  const lastWeek = addDays(weekStart(today()), -7);
  const color = NETWORKS.site.color;

  $("#panel").innerHTML = `
    ${statsHeader("Qui passe sur le site")}
    <div class="tiles">
      <div class="tile"><span class="tile-label">Visiteurs</span><span class="tile-value">${last ? fmt(last.visitors) : "–"}</span><span class="tile-sub">${last ? `semaine du ${fmtDate(last.week)} ${delta(last.visitors, prev?.visitors)}` : "pas encore de relevé"}</span></div>
      <div class="tile"><span class="tile-label">Pages vues</span><span class="tile-value">${last ? fmt(last.pageviews) : "–"}</span><span class="tile-sub">${last ? `${delta(last.pageviews, prev?.pageviews)} sur la même semaine` : "–"}</span></div>
      <div class="tile"><span class="tile-label">Moyenne 4 semaines</span><span class="tile-value">${recent.length ? fmt(avg) : "–"}</span><span class="tile-sub">visiteurs par semaine</span></div>
      <div class="tile"><span class="tile-label">Vues d'articles</span><span class="tile-value">${fmt(views)}</span><span class="tile-sub">${articles.filter(hasStats).length}/${articles.length} articles relevés</span></div>
    </div>

    <div class="stats-grid">
      <section class="card">
        <div class="card-head"><h2 class="h-card">Visiteurs par semaine</h2><span class="muted">${r.length} relevé${r.length > 1 ? "s" : ""}</span></div>
        ${r.length ? vbars(r.slice(-12).map((x) => ({ label: x.week === thisWeek ? "en cours" : fmtDate(x.week), value: x.visitors, title: `Semaine du ${fmtDate(x.week)}${x.week === thisWeek ? " (en cours)" : ""}` })), color, "visiteurs") : `<p class="empty">Ajoute ton premier relevé pour voir la courbe se dessiner.</p>`}
      </section>
      <section class="card">
        <div class="card-head"><h2 class="h-card">Relevé de fréquentation</h2><span class="xp-pill">+${XP.siteReport} m</span></div>
        <form class="report-form" data-form="site">
          <label>Semaine du<input class="input" type="date" name="week" value="${lastWeek}" required></label>
          <label>Visiteurs<input class="input" type="number" name="visitors" min="0" step="1" inputmode="numeric" required></label>
          <label>Pages vues<input class="input" type="number" name="pageviews" min="0" step="1" inputmode="numeric"></label>
          <button class="btn btn-primary btn-sm" type="submit">Enregistrer</button>
        </form>
        ${gaOk ? `<p class="small"><strong>Synchronisé avec Google Analytics</strong> : les semaines et les vues d'articles se mettent à jour toutes seules. Un relevé saisi à la main reste prioritaire.</p>` : ""}
        <p class="muted small" ${gaOk ? "hidden" : ""}>Les chiffres se lisent dans Google Analytics (le site y est relié via Google Tag Manager) : <em>Rapports → Engagement → Pages et écrans</em>, sur la semaine choisie. Les vues de chaque article se reportent dans sa fiche (ligne « Site »).</p>
        <p><a class="link" href="https://analytics.google.com/" target="_blank" rel="noopener">Ouvrir Google Analytics ↗</a></p>
        ${r.length ? `<details class="history"><summary>Historique des relevés</summary><ul>${[...r].reverse().map((x) => `<li><span>Semaine du ${fmtDate(x.week)}${x.source === "auto" ? ` <span class="auto-tag">auto</span>` : ""}</span><span>${fmt(x.visitors)} visiteurs · ${fmt(x.pageviews || 0)} pages vues</span><button type="button" class="link danger small" data-site-del="${x.id}">Supprimer</button></li>`).join("")}</ul></details>` : ""}
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2 class="h-card">Articles les plus lus</h2><span class="muted">remplis les cases directement · tous les articles</span></div>
      ${editablePubTable(state.pubs.filter((p) => p.network === "site" && p.status === "publie").sort((x, y) => (y.date || "").localeCompare(x.date || "")), statFieldsFor("site"))}
    </section>`;
}

function renderNetworkStats(n) {
  // Saisie à la main dans le tableau : LinkedIn, Facebook, et Instagram tant qu'il n'est pas connecté
  const manual = n === "linkedin" || n === "facebook" || state.settings.sync?.instagram?.status !== "ok";
  const allPubs = state.pubs
    .filter((p) => p.network === n && (p.status === "publie" || p.date))
    .sort((x, y) => (y.date || "9").localeCompare(x.date || "9"));
  const net = NETWORKS[n];
  const a = audienceOf(n);
  const last = a[a.length - 1];
  const prev = a[a.length - 2];
  const first = a.find((x) => inPeriod(x.date));
  const pubs = state.pubs.filter((p) => p.network === n && p.status === "publie" && inPeriod(p.date)).sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  const withStats = pubs.filter(hasStats);
  const imp = sumOf(withStats, "impressions");
  const eng = withStats.reduce((s, p) => s + engOf(p), 0);
  const best = [...withStats].sort((x, y) => engOf(y) - engOf(x))[0];
  const planned = state.pubs.filter((p) => p.network === n && p.status === "prevu").length;

  $("#panel").innerHTML = `
    ${statsHeader(`${net.label}`)}
    <div class="tiles">
      <div class="tile">
        <label class="tile-label" for="followers-now">Abonnés</label>
        <input class="tile-input" id="followers-now" type="number" min="0" step="1" inputmode="numeric" data-followers="${n}" value="${last ? last.followers : ""}" placeholder="–" title="Tape ton nombre d'abonnés actuel">
        <span class="tile-sub">${last ? `au ${fmtDate(last.date)} ${delta(last.followers, prev?.followers)}` : "tape ton nombre d'abonnés"}</span>
      </div>
      <div class="tile"><span class="tile-label">Publications</span><span class="tile-value">${fmt(pubs.length)}</span><span class="tile-sub">${planned} programmée${planned > 1 ? "s" : ""} à venir</span></div>
      <div class="tile"><span class="tile-label">Impressions</span><span class="tile-value">${fmt(imp)}</span><span class="tile-sub">${withStats.length}/${pubs.length} publications relevées</span></div>
      <div class="tile"><span class="tile-label">Taux d'engagement</span><span class="tile-value">${pct(eng, imp)}</span><span class="tile-sub">${fmt(eng)} interactions</span></div>
    </div>

    <div class="stats-grid">
      <section class="card">
        <div class="card-head"><h2 class="h-card">Évolution des abonnés</h2>${last && first && first !== last ? `<span class="muted">${delta(last.followers, first.followers)} sur la période</span>` : ""}</div>
        ${a.length ? vbars(a.slice(-12).map((x) => ({ label: fmtDate(x.date), value: x.followers })), net.color, "abonnés") : `<p class="empty">Note ton nombre d'abonnés de temps en temps (une fois par semaine suffit) pour suivre la progression.</p>`}
      </section>
      <section class="card">
        <div class="card-head"><h2 class="h-card">Relevé d'abonnés</h2><span class="xp-pill">+${XP.audienceReport} m</span></div>
        <form class="report-form" data-form="audience" data-network="${n}">
          <label>Date<input class="input" type="date" name="date" value="${today()}" required></label>
          <label>Abonnés<input class="input" type="number" name="followers" min="0" step="1" inputmode="numeric" value="${last ? last.followers : ""}" required></label>
          <button class="btn btn-primary btn-sm" type="submit">Enregistrer</button>
        </form>
        ${best ? `<div class="best"><p class="eyebrow">Meilleure publication</p><button type="button" class="link" data-open="${best.contentId}" data-focuspub="${best.id}">${esc(contentById(best.contentId)?.title || "Sans titre")}</button><p class="muted small">${fmt(engOf(best))} interactions · ${fmt(Number(best.stats.impressions) || 0)} impressions · ${fmtDate(best.date)}</p></div>` : ""}
        ${a.length ? `<details class="history"><summary>Historique des relevés</summary><ul>${[...a].reverse().map((x) => `<li><span>${fmtDate(x.date)}${x.source === "auto" ? ` <span class="auto-tag">auto</span>` : ""}</span><span>${fmt(x.followers)} abonnés</span><button type="button" class="link danger small" data-aud-del="${x.id}">Supprimer</button></li>`).join("")}</ul></details>` : ""}
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2 class="h-card">Publications ${net.label}</h2><span class="muted">${manual ? "remplis les cases directement · toutes les publications, sans filtre de période" : "clique pour saisir ou corriger les stats"}</span></div>
      ${manual ? editablePubTable(allPubs, statFieldsFor(n).filter(([k]) => n !== "linkedin" || k !== "saves")) : pubTable(pubs, statFieldsFor(n))}
    </section>`;
}

/* ---------- Vue Mémo : tâches et notes ---------- */

function taskItem(k) {
  const t = today();
  const late = !k.done && k.due && k.due < t;
  const c = k.contentId ? contentById(k.contentId) : null;
  return `<li class="task ${k.done ? "is-done" : ""}">
    <button type="button" class="task-check" data-task-toggle="${k.id}" aria-pressed="${!!k.done}" aria-label="${k.done ? "Rouvrir" : "Terminer"} : ${esc(k.text)}">${k.done ? "✓" : ""}</button>
    <span class="task-body">
      <span class="task-text">${esc(k.text)}</span>
      <span class="task-meta">
        ${k.due ? `<span class="${late ? "is-late" : ""}">${late ? "En retard · " : k.due === t ? "Aujourd'hui · " : ""}${fmtDate(k.due)}</span>` : ""}
        ${c ? `<button type="button" class="link small" data-open="${c.id}">${esc(c.title)}</button>` : ""}
      </span>
    </span>
    ${k.done ? "" : `<span class="xp-pill">+${XP.task}</span>`}
    <button type="button" class="btn btn-ghost btn-icon btn-mini" data-task-del="${k.id}" aria-label="Supprimer la tâche">×</button>
  </li>`;
}

function renderMemo() {
  const t = today();
  const open = state.tasks.filter((k) => !k.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.createdAt.localeCompare(b.createdAt));
  const done = state.tasks.filter((k) => k.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  const groups = [
    ["En retard", open.filter((k) => k.due && k.due < t)],
    ["Aujourd'hui", open.filter((k) => k.due === t)],
    ["À venir", open.filter((k) => k.due && k.due > t)],
    ["Sans date", open.filter((k) => !k.due)],
  ].filter(([, l]) => l.length);
  const notes = [...state.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt));
  const linkable = state.contents.filter((c) => c.status !== "publie");

  $("#panel").innerHTML = `
    <div class="panel-head">
      <div><p class="eyebrow">Mémo</p><h1>Le carnet du camp</h1></div>
      <div class="panel-tools"><span class="muted">${open.length} tâche${open.length > 1 ? "s" : ""} en cours · ${done.length} terminée${done.length > 1 ? "s" : ""}</span></div>
    </div>
    <div class="memo">
      <section class="card">
        <div class="card-head"><h2 class="h-card">Tâches</h2><span class="muted">+${XP.task} m par tâche terminée</span></div>
        <form class="task-form" data-form="task">
          <input class="input" name="text" placeholder="Ajouter une tâche… (ex. : demander les photos à l'orga)" aria-label="Nouvelle tâche" required>
          <input class="input" type="date" name="due" aria-label="Échéance">
          <select class="input" name="contentId" aria-label="Contenu lié">
            <option value="">Aucun contenu lié</option>
            ${linkable.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}
          </select>
          <button class="btn btn-primary btn-sm" type="submit">Ajouter</button>
        </form>
        ${groups.length ? groups.map(([label, list]) => `<div class="task-group"><p class="eyebrow">${label}</p><ul class="tasks">${list.map(taskItem).join("")}</ul></div>`).join("") : `<p class="empty">Aucune tâche en cours. Note ici tout ce qui te passe par la tête pour ne rien oublier.</p>`}
        ${done.length ? `<details class="history"><summary>Terminées (${done.length})</summary><ul class="tasks">${done.slice(0, 30).map(taskItem).join("")}</ul></details>` : ""}
      </section>

      <section class="card">
        <div class="card-head"><h2 class="h-card">Notes</h2><span class="muted">idées, liens, mémos</span></div>
        <form class="note-form" data-form="note">
          <textarea class="input" name="text" rows="3" placeholder="Une idée, un lien, un contact, un chiffre à vérifier…" aria-label="Nouvelle note" required></textarea>
          <div class="note-form-foot">
            <span class="note-colors" role="radiogroup" aria-label="Couleur">
              ${Object.entries(NOTE_COLORS).map(([k, v], i) => `<label class="swatch" style="--sw:${v}"><input type="radio" name="color" value="${k}" ${i === 0 ? "checked" : ""}><span class="sr">${k}</span></label>`).join("")}
            </span>
            <button class="btn btn-primary btn-sm" type="submit">Épingler la note</button>
          </div>
        </form>
        ${notes.length ? `<div class="notes">${notes.map((nt) => `<article class="note ${nt.pinned ? "is-pinned" : ""}" style="--note:${NOTE_COLORS[nt.color] || NOTE_COLORS.sable}">
          <textarea class="note-text" data-note-id="${nt.id}" aria-label="Note" rows="4">${esc(nt.text)}</textarea>
          <footer><span class="muted small">${fmtDate(nt.updatedAt.slice(0, 10))}</span>
            <span><button type="button" class="btn btn-ghost btn-icon btn-mini" data-note-pin="${nt.id}" aria-pressed="${!!nt.pinned}" title="${nt.pinned ? "Désépingler" : "Garder en haut"}">📌</button>
            <button type="button" class="btn btn-ghost btn-icon btn-mini" data-note-del="${nt.id}" aria-label="Supprimer la note">×</button></span>
          </footer>
        </article>`).join("")}</div>` : `<p class="empty">Pas encore de note.</p>`}
      </section>
    </div>`;
}

/* ---------- Vue Trophées ---------- */

function renderTrophees() {
  const xp = computeXP(state);
  const lvl = levelFor(xp);
  const bs = badges(state);
  const won = bs.filter((b) => b.unlocked).length;
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(weekStart(today()), -7 * i);
    weeks.push({ ws, quests: questsForWeek(state, ws) });
  }
  $("#panel").innerHTML = `
    <div class="panel-head">
      <div><p class="eyebrow">Trophées</p><h1>Ton ascension</h1></div>
      <div class="panel-tools"><span class="muted">${won}/${bs.length} trophées</span></div>
    </div>

    <section class="card">
      <h2 class="h-card">Les paliers</h2>
      <ol class="levels">
        ${LEVELS.map(([alt, name], i) => `<li class="${i < lvl.index ? "is-past" : i === lvl.index ? "is-current" : ""}">
          <span class="lv-alt">${fmt(alt)} m</span><span class="lv-name">${name}</span>${i === lvl.index ? `<span class="lv-you">Tu es ici</span>` : ""}
        </li>`).join("")}
      </ol>
      <p class="muted small">Barème : idée +${XP.content.idee} · en rédaction ${XP.content.redaction} · prêt ${XP.content.pret} · publication programmée +${XP.pubPlanned} · publiée +${XP.pubPublished} · stats relevées +${XP.stats} · défi hebdo réussi +${XP.quest} · relevé site ou abonnés +${XP.siteReport} · tâche terminée +${XP.task}.</p>
    </section>

    <section class="card">
      <h2 class="h-card">Trophées</h2>
      <ul class="badges">
        ${bs.map((b) => `<li class="badge ${b.unlocked ? "is-on" : ""}">
          <span class="badge-icon" aria-hidden="true">${b.icon}</span>
          <span class="badge-name">${b.name}${b.unlocked ? "" : ` <span class="sr">(verrouillé)</span>`}</span>
          <span class="badge-desc">${b.desc}</span>
          ${b.unlocked ? `<span class="badge-ok">Débloqué</span>` : `<span class="bar bar-sm"><span style="width:${Math.min(100, (b.value / b.goal) * 100)}%"></span></span><span class="badge-prog">${fmt(Math.min(b.value, b.goal))} / ${fmt(b.goal)}</span>`}
        </li>`).join("")}
      </ul>
    </section>

    <section class="card">
      <h2 class="h-card">Défis des 8 dernières semaines</h2>
      <div class="table-wrap"><table class="table weeks">
        <thead><tr><th scope="col">Semaine du</th>${weeks[0].quests.map((q) => `<th scope="col">${esc(q.label)}</th>`).join("")}</tr></thead>
        <tbody>${weeks.reverse().map((w) => `<tr><td>${fmtDate(w.ws)}</td>${w.quests.map((q) => `<td class="${q.done ? "w-ok" : ""}">${q.done ? "✓ " : ""}${Math.min(q.value, q.goal)}/${q.goal}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
    </section>`;
}

/* ---------- Routage des vues ---------- */

let view = "sentier";
const VIEWS = ["sentier", "planning", "contenus", "stats", "memo", "trophees"];
const viewFromHash = () => {
  const h = location.hash.slice(1);
  return VIEWS.includes(h) ? h : "sentier";
};

function setView(v, { push = true } = {}) {
  if (!VIEWS.includes(v)) v = "sentier";
  // Chaque page a sa propre adresse (#memo, #stats…) : le bouton « retour » du navigateur fonctionne
  if (push && v !== view) history.pushState({ view: v }, "", v === "sentier" ? location.pathname + location.search : "#" + v);
  view = v;
  document.body.dataset.screen = v;
  $$(".tabs button").forEach((b) => (b.getAttribute("data-view") === v ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  renderPanel();
  scene?.setActive(v === "sentier");
  if (v !== "sentier") { showNear(null); scene?.backToTrail(); }
  if (v !== "sentier") $("#panel").focus({ preventScroll: true });
  $("#panel-close").hidden = v === "sentier";
}

window.addEventListener("popstate", () => setView(viewFromHash(), { push: false }));
$("#panel-close").addEventListener("click", () => setView("sentier"));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || view === "sentier" || document.querySelector("dialog[open]")) return;
  if (e.target.closest && e.target.closest("input, textarea, select")) return;
  setView("sentier");
});
function renderPanel() {
  if (view === "planning") renderPlanning();
  else if (view === "contenus") renderContenus();
  else if (view === "stats") renderStats();
  else if (view === "trophees") renderTrophees();
  else if (view === "memo") renderMemo();
  else $("#panel").innerHTML = "";
}
function renderAll() {
  renderHud();
  renderSide();
  renderPanel();
  renderScene();
}

/* ---------- Éditeur de contenu ---------- */

const editor = $("#editor");
let draft = null;

function pubRowHTML(p, i) {
  const net = NETWORKS[p.network];
  const statsOpen = p.status === "publie";
  return `<fieldset class="pub-row ${p.status === "publie" ? "is-done" : ""} ${draft?.focusPub === p.id ? "is-focus" : ""}" data-i="${i}" id="pubrow-${p.id}" style="--net:${net.color}">
    <legend><span class="net-chip" style="--net:${net.color}">${net.label}</span></legend>
    <div class="pub-grid">
      <label>Date<input class="input" type="date" name="date" value="${esc(p.date)}"></label>
      <label>Heure<input class="input" type="time" name="time" value="${esc(p.time)}"></label>
      <label>Statut
        <select class="input" name="status">
          <option value="prevu" ${p.status === "prevu" ? "selected" : ""}>Prévu</option>
          <option value="publie" ${p.status === "publie" ? "selected" : ""}>Publié</option>
        </select>
      </label>
      ${p.network === "site"
        ? `<label class="span-2">Lien<input class="input" type="url" name="url" value="${esc(p.url)}" placeholder="Se remplit tout seul quand tu publies l'article sur le site" readonly></label>`
        : `<label class="span-2">Lien<input class="input" type="url" name="url" value="${esc(p.url)}" placeholder="https://… (le lien du post une fois publié)"></label>`}
    </div>
    ${SOCIALS.includes(p.network) ? postTextHTML(p, i) : ""}
    ${p.status === "prevu" ? `<div class="pub-actions">
      ${p.network === "site"
        ? `<button type="button" class="btn btn-primary btn-sm" data-gotoarticle>✍️ Écrire et publier l'article</button>`
        : `<button type="button" class="btn btn-primary btn-sm" data-publish="${i}">Marquer publié <span class="xp-pill">+${XP.pubPublished - XP.pubPlanned}</span></button>`}
      ${p.date ? `<button type="button" class="btn btn-ghost btn-sm" data-unplan="${i}" title="Retirer la date : la publication sort du planning, mais reste dans le contenu (avec son texte)">📅 Déprogrammer</button>` : ""}
    </div>` : ""}
    <details class="pub-stats" ${statsOpen ? "open" : ""}>
      <summary>Statistiques ${hasStats(p) ? `<span class="muted">relevées le ${fmtDate(p.statsAt)}</span>` : `<span class="xp-pill">+${XP.stats}</span>`}</summary>
      <div class="stats-inputs">
        ${statFieldsFor(p.network).map(([k, l]) => `<label>${l}<input class="input" type="number" min="0" step="1" inputmode="numeric" name="stat-${k}" value="${p.stats?.[k] ?? ""}"></label>`).join("")}
      </div>
    </details>
    <button type="button" class="link danger small" data-delpub="${i}">${p.network === "site" && p.status === "publie" && draft && onSite(draft.content) ? "Retirer l'article du site" : "Retirer cette publication"}</button>
  </fieldset>`;
}

function postTextHTML(p, i) {
  const n = (p.text || "").length;
  const max = CHAR_LIMITS[p.network];
  return `<label class="post-text">Texte du post ${NETWORKS[p.network].label}
      <textarea class="input" name="ptext" rows="${p.text ? 10 : 3}" placeholder="Le texte à publier sur ${NETWORKS[p.network].label} (ou génère-le à partir du brouillon).">${esc(p.text)}</textarea>
      <span class="post-text-foot"><span class="char-count"><span class="${n > max ? "is-over" : ""}">${fmt(n)}</span> / ${fmt(max)} caractères</span>${p.text ? `<button type="button" class="link small" data-copypost="${i}">Copier le texte</button>` : ""}</span>
    </label>`;
}

function renderEditor() {
  const c = draft.content;
  // Publier sur le site = un article : on ouvre toujours la rédaction de l'article
  if (draft.pubs.some((p) => p.network === "site") && c.kind !== "article") c.kind = "article";
  editor.innerHTML = `
    <form method="dialog" class="editor-form" id="editor-form">
      <header class="editor-head">
        <p class="eyebrow">${draft.isNew ? "Nouveau contenu" : "Contenu"}</p>
        <button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Fermer">×</button>
      </header>
      <label class="field-title"><span class="sr">Titre</span>
        <input class="input input-title" name="title" id="editor-title" value="${esc(c.title)}" placeholder="Titre ou accroche" required>
      </label>
      <div class="editor-meta">
        <label>Format<select class="input" name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${c.kind === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Pilier<select class="input" name="pillar"><option value="">—</option>${Object.entries(PILLARS).map(([k, l]) => `<option value="${k}" ${c.pillar === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Étape<select class="input" name="cstatus">${Object.entries(STATUSES).map(([k, l]) => `<option value="${k}" ${c.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <label>Brouillon
        <textarea class="input" name="text" rows="8" placeholder="Jette ici tes idées, ton angle, tes exemples, tes liens… aussi long que tu veux.">${esc(c.text)}</textarea>
        <span class="char-count" id="char-count"></span>
      </label>
      <div class="gen-actions">
        <button type="button" class="btn btn-gen" data-gen="article">✨ Générer un article</button>
        <button type="button" class="btn btn-gen" data-gen="linkedin">✨ Générer un post LinkedIn</button>
        <span id="gen-note">${genNoteHTML()}</span>
      </div>
      <label>Notes (sources, angle, visuels…)
        <textarea class="input" name="notes" rows="3">${esc(c.notes)}</textarea>
      </label>
${c.kind === "article" ? articlePanelHTML(c) : ""}

      <div class="editor-pubs">
        <div class="card-head"><p class="eyebrow">Où et quand publier</p></div>
        <div class="add-pubs" role="group" aria-label="Réseaux de publication">
          ${NETWORK_ORDER.map((n) => {
            const on = draft.pubs.some((p) => p.network === n);
            return `<button type="button" class="btn btn-sm net-toggle ${on ? "is-on" : ""}" data-togglenet="${n}" aria-pressed="${on}" style="--net:${NETWORKS[n].color}" title="${on ? "Retirer" : "Ajouter"} ${NETWORKS[n].label}">${on ? "✓" : "+"} ${NETWORKS[n].label}</button>`;
          }).join("")}
          ${SOCIALS.every((n) => draft.pubs.some((p) => p.network === n)) ? "" : `<button type="button" class="btn btn-ghost btn-sm" data-add3>+ Les 3 réseaux</button>`}
        </div>
        <div id="pub-rows">${draft.pubs.map(pubRowHTML).join("") || `<p class="empty">Pas encore de publication prévue. Ajoute un réseau (+${XP.pubPlanned} m chacune).</p>`}</div>
      </div>

      <footer class="editor-foot">
        ${draft.isNew ? "" : `<button type="button" class="link danger" data-delete>Supprimer</button>`}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Annuler</button>
        <button type="submit" class="btn btn-primary" value="save">Enregistrer</button>
      </footer>
    </form>`;
  updateCharCount();
}

/* ---------- Rédaction et publication d'un article sur le site ---------- */

let publishConfig = null;
async function loadPublishConfig() {
  if (publishConfig) return publishConfig;
  try {
    const r = await fetch("/api/camp/publish", { cache: "no-store" });
    publishConfig = r.ok ? await r.json() : { configured: false, missing: [] };
  } catch (e) {
    publishConfig = { configured: false, missing: [] };
  }
  return publishConfig;
}

/* ---------- Rédaction par Claude à partir du brouillon ----------
   Gratuit par défaut : la demande est copiée, claude.ai s'ouvre dans un onglet,
   et la réponse recollée dans la fiche remplit l'article ou le post.
   Si une clé ANTHROPIC_API_KEY est configurée sur Vercel, tout se fait directement. */

let genConfig = null;
async function loadGenConfig() {
  if (genConfig) return genConfig;
  try {
    const r = await fetch("/api/camp/generate", { cache: "no-store" });
    genConfig = r.ok ? await r.json() : { configured: false, missing: [] };
  } catch (e) {
    genConfig = { configured: false, missing: [] };
  }
  return genConfig;
}
const genNoteHTML = () => genConfig?.configured
  ? `<span class="muted small">Claude rédige à partir du brouillon et des notes ; tu relis et ajustes avant de publier.</span>`
  : `<span class="muted small">Gratuit : la demande est copiée et ta conversation Claude s'ouvre (Ctrl+V puis Entrée). Colle ensuite sa réponse dans le texte de l'article ou du post : tout se range tout seul.</span>`;

const ARTICLE_URL = "https://entre2sentiers.com/articles/";
let generating = null; // un seul texte à la fois

function genInput(c) {
  const a = c.article || {};
  const slug = a.slug || c.slug;
  return {
    title: c.title,
    pillar: PILLARS[c.pillar] || "",
    draft: c.text,
    notes: c.notes,
    article: c.kind === "article" ? { excerpt: a.excerpt || "", body: a.body || "", url: slug ? ARTICLE_URL + slug : "" } : {},
  };
}

/* La conversation Claude « Rédaction pour Entre 2 sentiers » : toutes les demandes y vont */
const REDAC_URL = "https://claude.ai/chat/5d9e3183-8013-4c37-86b2-ee7c811f78b2";
const REDAC_TARGET = "e2s-redaction";

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error("clipboard"));
}

async function generate(mode, btn) {
  if (generating) return toast("Une rédaction est déjà en cours, patiente quelques secondes.");
  readEditorForm();
  const d = draft;
  const c = d.content;
  const a = c.article || {};
  if (!c.text.trim() && !(mode === "linkedin" && a.body?.trim())) {
    editor.querySelector('textarea[name="text"]')?.focus();
    return toast("Écris d'abord ton brouillon : Claude part de là.", "warn");
  }
  if (mode === "article" && a.body?.trim() && !confirm("L'article a déjà un texte. Le remplacer par une nouvelle version rédigée à partir du brouillon ?")) return;
  const li = d.pubs.find((p) => p.network === "linkedin");
  if (mode === "linkedin" && li?.text?.trim() && !confirm("Le post LinkedIn a déjà un texte. Le remplacer par une nouvelle version ?")) return;

  // Mode gratuit : pas de clé sur Vercel → on passe par claude.ai
  if (!genConfig?.configured) {
    const prompt = buildPrompt(mode, genInput(c));
    const copied = copyText(prompt); // avant d'ouvrir l'onglet, tant que la page a le focus
    window.open(REDAC_URL, REDAC_TARGET);
    // Préparer l'endroit où coller la réponse : le texte de l'article ou le texte du post LinkedIn
    const date = d.pubs.find((p) => p.date)?.date || "";
    if (mode === "article") {
      c.kind = "article";
      if (!d.pubs.some((p) => p.network === "site")) d.pubs.unshift(newPub("site", date));
      loadPublishConfig().then(() => draft === d && (readEditorForm(), renderEditor()));
    } else if (!d.pubs.some((p) => p.network === "linkedin")) {
      d.pubs.push(newPub("linkedin", date));
    }
    renderEditor();
    const where = mode === "article" ? "« Texte de l'article »" : "« Texte du post LinkedIn »";
    copied.then(
      () => toast(`Demande copiée : dans Claude, fais Ctrl+V (⌘+V) puis Entrée. Colle ensuite sa réponse dans ${where}.`),
      () => toast("Copie automatique impossible : réessaie le bouton.", "warn"),
    );
    return;
  }

  const code = getPublishCode();
  if (!code) return;
  generating = mode;
  const label = btn.textContent;
  btn.disabled = true;
  btn.classList.add("is-loading");
  btn.textContent = mode === "article" ? "Rédaction de l'article… (1 à 2 min)" : "Rédaction du post… (environ 30 s)";
  try {
    const r = await fetch("/api/camp/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, mode, ...genInput(c) }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: r.status === 504 ? "La rédaction a pris trop de temps, réessaie." : `Erreur ${r.status}` }));
    if (j.badCode) { rememberPublishCode(code, false); throw new Error("Code de publication incorrect."); }
    if (j.configured === false) { genConfig = j; throw new Error(j.error); }
    if (!j.ok) throw new Error(j.error || "Rédaction impossible.");
    rememberPublishCode(code, true);
    if (draft !== d) return toast(mode === "article" ? "Article rédigé, mais la fiche a été fermée entre-temps." : "Post rédigé, mais la fiche a été fermée entre-temps.", "warn");
    applyGenerated(mode, mode === "article" ? j.article : j.post);
  } catch (err) {
    toast(err.message, "warn");
  } finally {
    generating = null;
    if (btn.isConnected) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.textContent = label;
    }
  }
}

/* Range le texte rédigé dans la fiche et ouvre la ligne Site ou LinkedIn */
function applyGenerated(mode, result) {
  readEditorForm(); // garder ce qui a été tapé entre-temps
  const d = draft;
  const c = d.content;
  if (c.status === "idee") c.status = "redaction";
  const date = d.pubs.find((p) => p.date)?.date || "";
  if (mode === "article") {
    const g = result;
    c.kind = "article";
    const aa = art(c);
    if (!c.title.trim() && g.title) c.title = g.title.trim();
    aa.body = (g.body || "").trim();
    if (g.excerpt?.trim()) aa.excerpt = g.excerpt.trim();
    if (g.question?.trim()) aa.question = g.question.trim();
    if (g.sources?.trim()) aa.sources = formatSources(g.sources);
    if (!aa.publishedAt && !legacyArticle(c) && !c.slug) aa.slug = slugify(g.slug || c.title);
    if (!d.pubs.some((p) => p.network === "site")) d.pubs.unshift(newPub("site", date));
    loadPublishConfig().then(() => draft === d && (readEditorForm(), renderEditor()));
  } else {
    let p = d.pubs.find((x) => x.network === "linkedin");
    if (!p) { p = newPub("linkedin", date); d.pubs.push(p); }
    p.text = result;
  }
  renderEditor();
  const target = mode === "article"
    ? editor.querySelector(".article-panel")
    : $$(".pub-row", editor).find((el) => d.pubs[Number(el.dataset.i)]?.network === "linkedin");
  target?.scrollIntoView({ block: "start", behavior: "smooth" });
  toast(mode === "article"
    ? "Article rédigé. Relis-le, ajoute une photo et choisis la date de publication."
    : "Post LinkedIn rédigé. Relis-le et choisis la date et l'heure de publication.");
}

const art = (c) => (c.article ||= { excerpt: "", body: "", question: "", sources: "", slug: "", photo: {} });
/* Un article déjà présent sur le site mais créé avant le Camp de base ne doit pas être écrasé */
const legacyArticle = (c) => !!c.slug && !c.article?.publishedAt && pubsOf(c.id).some((p) => p.network === "site" && p.status === "publie");

const onSite = (c) => !!(c.article?.slug || c.slug) && pubsOf(c.id).some((p) => p.network === "site" && p.status === "publie");

/* Code de publication : demandé une fois, puis gardé dans ce navigateur */
function getPublishCode() {
  let code = "";
  try { code = localStorage.getItem(STORE_KEY + ":publish") || ""; } catch (e) { /* rien */ }
  if (!code) code = (prompt("Code de publication (celui que tu as choisi sur Vercel) :") || "").trim();
  return code;
}
function rememberPublishCode(code, ok) {
  try {
    if (ok) localStorage.setItem(STORE_KEY + ":publish", code);
    else localStorage.removeItem(STORE_KEY + ":publish");
  } catch (e) { /* rien */ }
}

async function unpublishArticle(btn, { thenDelete = false } = {}) {
  readEditorForm();
  const c = draft.content;
  const a = art(c);
  const slug = a.slug || c.slug;
  const question = thenDelete
    ? `« ${c.title} » est en ligne sur le site.\n\nLe supprimer va aussi le retirer du site, de la page Actualités et du plan du site. Continuer ?`
    : `Retirer « ${c.title} » du site ?\n\nIl sera retiré du site, de la page Actualités et du plan du site. Tout son contenu reste dans le Camp de base : tu pourras le republier quand tu veux.`;
  if (!confirm(question)) return;
  const cfg = await loadPublishConfig();
  if (!cfg.configured) return toast("La publication n'est pas encore configurée sur Vercel.", "warn");
  const code = getPublishCode();
  if (!code) return;
  btn.disabled = true;
  if (btn.hasAttribute("data-siteunpublish")) btn.textContent = "Retrait…";
  try {
    const r = await fetch("/api/camp/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "unpublish", code, slug, title: c.title }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: `Erreur ${r.status}` }));
    if (j.badCode) { rememberPublishCode(code, false); throw new Error("Code de publication incorrect."); }
    if (!j.ok) throw new Error(j.error || "Retrait impossible.");
    rememberPublishCode(code, true);
    a.slug = slug;
    a.publishedAt = null;
    c.status = "pret";
    draft.pubs = draft.pubs.filter((p) => p.network !== "site");
    toast("Article retiré du site (effectif dans environ 1 minute).");
    if (thenDelete) {
      state.contents = state.contents.filter((x) => x.id !== c.id);
      state.pubs = state.pubs.filter((p) => p.contentId !== c.id);
      editor.close();
      draft = null;
      afterChange();
      return;
    }
    renderEditor(); // les lignes de publication affichées doivent correspondre à draft.pubs avant l'enregistrement
    commitEditor();
  } catch (err) {
    toast(err.message, "warn");
    if (btn.isConnected) {
      btn.disabled = false;
      if (btn.hasAttribute("data-siteunpublish")) btn.textContent = "Dépublier";
    }
  }
}

function articlePanelHTML(c) {
  const a = art(c);
  const ph = a.photo || {};
  const src = ph.data || (ph.file ? `/assets/${ph.file}` : "");
  const posY = Number.isFinite(ph.posY) ? ph.posY : 50;
  const slug = a.slug || c.slug || slugify(c.title);
  const excerptLen = (a.excerpt || "").length;
  const words = wordCount(a.body);
  const legacy = legacyArticle(c);
  const cfg = publishConfig;
  return `
      <details class="article-panel" open>
        <summary><span>Rédaction de l'article</span><span class="muted small">${words} mots · ${readMinutes(a.body)} min de lecture${a.publishedAt ? ` · en ligne depuis le ${fmtDate(a.publishedAt)}` : ""}</span></summary>

        <div class="photo-slot ${src ? "has-photo" : ""}">
          ${src
            ? `<div class="photo-frame" title="Glisse vers le haut ou le bas pour recadrer">
                 <img src="${src}" alt="" draggable="false" style="object-position: 50% ${posY}%">
                 <span class="photo-hint" aria-hidden="true">↕ Glisse pour recadrer</span>
               </div>
               <label class="photo-crop"><span>Cadrage</span><input type="range" name="a-posy" min="0" max="100" step="1" value="${posY}" aria-label="Cadrage vertical de la photo (0 = haut, 100 = bas)"></label>
               <div class="photo-actions">
                 <label class="btn btn-ghost btn-sm">Changer la photo<input type="file" accept="image/*" data-photo hidden></label>
                 <button type="button" class="btn btn-ghost btn-sm" data-photo-remove>Retirer</button>
               </div>`
            : `<label class="photo-empty">
                 <span class="photo-icon" aria-hidden="true">📷</span>
                 <strong>Ajouter la photo de une</strong>
                 <span class="muted small">Elle s'affiche en haut de l'article et sur la page Actualités. Format paysage conseillé.</span>
                 <input type="file" accept="image/*" data-photo hidden>
               </label>`}
        </div>
        <div class="article-grid-2">
          <label>Description de la photo (pour l'accessibilité)<input class="input" name="a-alt" value="${esc(ph.alt)}" placeholder="Ex. : coureurs sur la ligne de départ à Chamonix"></label>
          <label>Crédit photo<input class="input" name="a-credit" value="${esc(ph.credit)}" placeholder="Ex. : Corentin Griffon"></label>
        </div>

        <label>Chapô (résumé affiché sur la page Actualités et dans Google)
          <textarea class="input" name="a-excerpt" rows="2" maxlength="240" placeholder="Une ou deux phrases qui donnent envie de lire.">${esc(a.excerpt)}</textarea>
          <span class="char-count"><span class="${excerptLen > 160 ? "is-over" : ""}">${excerptLen}</span> / 160 caractères conseillés</span>
        </label>
        <label>Adresse de l'article
          <span class="slug-field"><span class="muted">entre2sentiers.com/articles/</span><input class="input" name="a-slug" value="${esc(slug)}" ${a.publishedAt || legacy ? "readonly" : ""}></span>
        </label>
        <label>Texte de l'article
          <textarea class="input article-body-input" name="a-body" rows="16" placeholder="Écris ton article ici.

## Un intertitre

Un paragraphe, avec du **gras**, de l'*italique* et un [lien](https://exemple.com).

> Une citation mise en avant.

- un point de liste">${esc(a.body)}</textarea>
          <span class="muted small">Mise en forme : <code>## Intertitre</code> · <code>**gras**</code> · <code>*italique*</code> · <code>&gt; citation</code> · <code>- liste</code> · <code>[texte](https://lien)</code>. Laisse une ligne vide entre deux paragraphes.</span>
        </label>
        <label>Question de fin (facultatif)
          <input class="input" name="a-question" value="${esc(a.question)}" placeholder="Et vous, … ?">
        </label>
        <label>Sources (colle-les telles quelles : elles se mettent en forme toutes seules)
          <textarea class="input" name="a-sources" rows="3" placeholder="Le Monde, article sur… | https://www.lemonde.fr/…">${esc(a.sources)}</textarea>
          <span class="muted small">Formats acceptés : « Nom | lien », « [Nom](lien) », « Nom : lien », titre puis lien à la ligne, ou lien seul.</span>
        </label>
        <div class="sources-preview" id="sources-preview">${sourcesPreviewHTML(a.sources)}</div>

        <div class="article-actions">
          <button type="button" class="btn btn-ghost" data-preview>👁 Aperçu</button>
          ${onSite(c) ? `<button type="button" class="btn btn-ghost danger" data-siteunpublish>Dépublier</button>` : ""}
          ${legacy
            ? `<p class="muted small">Publié avant le Camp de base : il n'est pas modifiable directement. Pour le corriger, dépublie-le puis republie-le (il redeviendra la « Dernière actualité »).</p>`
            : `<button type="button" class="btn btn-primary" data-sitepublish>${a.publishedAt ? "Mettre à jour sur le site" : "🚀 Publier sur le site"}</button>`}
          ${cfg && !cfg.configured ? `<p class="sync-missing">Publication pas encore configurée sur Vercel${cfg.missing?.length ? ` : ${cfg.missing.join(", ")}` : ""} (voir CONNEXIONS.md).</p>` : ""}
        </div>
      </details>`;
}

/* Aperçu des sources telles qu'elles apparaîtront sur le site (liens cliquables) */
function sourcesPreviewHTML(text) {
  const list = parseSources(text);
  if (!list.length) return "";
  return `<p class="eyebrow">Sur le site</p><ul>${list.map((x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>` : `${esc(x.title)} <span class="sync-missing">(pas de lien)</span>`}</li>`).join("")}</ul>`;
}

function readArticleForm(f) {
  const c = draft.content;
  if (c.kind !== "article" || !f.elements.namedItem("a-body")) return;
  const a = art(c);
  const v = (n) => f.elements.namedItem(n)?.value ?? "";
  a.excerpt = v("a-excerpt").trim();
  a.body = v("a-body");
  a.question = v("a-question").trim();
  a.sources = v("a-sources");
  const py = f.elements.namedItem("a-posy");
  if (py && a.photo) {
    const val = Number(py.value);
    if (val !== (Number.isFinite(a.photo.posY) ? a.photo.posY : 50)) {
      a.photo.posY = val;
      if (!a.photo.data) a.photo.reframed = true; // photo déjà sur le site : à renvoyer recadrée
    }
  }
  if (!a.publishedAt) a.slug = slugify(v("a-slug")) || slugify(c.title);
  a.photo = { ...(a.photo || {}), alt: v("a-alt").trim(), credit: v("a-credit").trim() };
}

function relatedFor(c) {
  const mine = art(c).slug;
  return state.contents
    .filter((x) => x.id !== c.id && x.status === "publie" && (x.article?.slug || x.slug) && (x.article?.slug || x.slug) !== mine)
    .map((x) => ({ x, d: keyDate(x) }))
    .sort((p, q) => (p.x.pillar === c.pillar ? 0 : 1) - (q.x.pillar === c.pillar ? 0 : 1) || q.d.localeCompare(p.d))
    .slice(0, 3)
    .map(({ x }) => ({ slug: x.article?.slug || x.slug, title: x.title, pillar: x.pillar, photo: x.article?.photo?.file || "" }));
}

function articleData(c, { preview }) {
  const a = art(c);
  const date = a.publishedAt || today();
  const ph = a.photo || {};
  const hasPhoto = !!(ph.data || ph.file);
  return {
    slug: a.slug,
    title: c.title,
    excerpt: a.excerpt,
    pillar: c.pillar || "marques",
    body: a.body,
    question: a.question,
    sources: a.sources,
    date,
    modified: today(),
    photo: hasPhoto
      ? (() => {
          // Nouvelle photo : enregistrée sous <adresse>-featured.jpg ; photo déjà sur le site : on garde son fichier
          const file = ph.data ? `${a.slug}-featured.jpg` : ph.file;
          return { src: preview && ph.data ? ph.data : `../assets/${file}`, file, alt: ph.alt, credit: ph.credit };
        })()
      : null,
    related: relatedFor(c),
  };
}

function articleProblems(c) {
  const a = art(c);
  const out = [];
  if (!c.title) out.push("le titre");
  if (!c.pillar) out.push("le pilier");
  if (!a.excerpt) out.push("le chapô");
  if (wordCount(a.body) < 80) out.push("le texte (au moins 80 mots)");
  if (!a.slug) out.push("l'adresse");
  return out;
}

/* Photo telle qu'elle partira sur le site : recadrée au format 16:9 */
async function framedPhoto(c) {
  const ph = art(c).photo || {};
  const src = ph.data || (ph.reframed && ph.file ? `/assets/${ph.file}` : "");
  if (!src) return "";
  return cropPhoto(src, Number.isFinite(ph.posY) ? ph.posY : 50);
}

async function openPreview() {
  readEditorForm();
  const c = draft.content;
  const d = $("#preview");
  d.innerHTML = `<div class="preview-bar"><span>Aperçu de l'article tel qu'il apparaîtra sur le site</span><button type="button" class="btn btn-ghost btn-sm" data-preview-close>Fermer</button></div><iframe class="preview-frame" title="Aperçu de l'article"></iframe>`;
  const data = articleData(c, { preview: true });
  const framed = await framedPhoto(c).catch(() => "");
  if (framed && data.photo) data.photo.src = framed;
  d.querySelector("iframe").srcdoc = buildArticleHTML(data, { preview: true });
  d.showModal();
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-preview-close]")) $("#preview").close();
});

async function publishArticle(btn) {
  readEditorForm();
  const c = draft.content;
  const problems = articleProblems(c);
  if (problems.length) return toast(`Il manque : ${problems.join(", ")}`, "warn");
  const cfg = await loadPublishConfig();
  if (!cfg.configured) return toast("La publication n'est pas encore configurée sur Vercel.", "warn");

  const code = getPublishCode();
  if (!code) return;

  const a = art(c);
  if (!a.publishedAt && !confirm(`Publier « ${c.title} » sur entre2sentiers.com ?\nIl deviendra la « Dernière actualité » du site.`)) return;

  const data = articleData(c, { preview: false });
  const st = PILLAR_STYLE[data.pillar];
  btn.disabled = true;
  btn.textContent = "Publication…";
  try {
    const image = await framedPhoto(c).catch(() => "");
    const r = await fetch("/api/camp/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        slug: a.slug,
        html: buildArticleHTML(data),
        title: c.title,
        excerpt: a.excerpt,
        minutes: readMinutes(a.body),
        tag: st.tag,
        label: st.label,
        date: data.date,
        image,
        imageFile: a.photo?.file || "",
      }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: `Erreur ${r.status}` }));
    if (j.badCode) { rememberPublishCode(code, false); throw new Error("Code de publication incorrect."); }
    if (!j.ok) throw new Error(j.error || "Publication impossible.");
    rememberPublishCode(code, true);

    // Le contenu passe en « Publié » avec sa publication Site
    if (!a.publishedAt) a.publishedAt = data.date;
    if (image && a.photo) {
      a.photo.file = j.imageFile;
      delete a.photo.data;
      delete a.photo.reframed;
      a.photo.posY = 50; // la photo publiée est déjà recadrée
    }
    c.slug = a.slug;
    let site = draft.pubs.find((p) => p.network === "site");
    if (!site) { site = newPub("site", data.date); draft.pubs.push(site); }
    site.status = "publie";
    site.date = site.date || data.date;
    site.url = j.url;
    // Le post LinkedIn qui accompagne l'article
    if (!draft.pubs.some((p) => p.network === "linkedin")) draft.pubs.push(newPub("linkedin", data.date));
    renderEditor();
    toast(j.isNew ? "Article publié ! Il sera en ligne dans environ 1 minute." : "Article mis à jour sur le site.", "xp");
    commitEditor({ fromPublish: true });
  } catch (err) {
    toast(err.message, "warn");
    btn.disabled = false;
    btn.textContent = a.publishedAt ? "Mettre à jour sur le site" : "🚀 Publier sur le site";
  }
}

function updateCharCount() {
  const ta = editor.querySelector('textarea[name="text"]');
  const out = $("#char-count");
  if (!ta || !out) return;
  const n = ta.value.length;
  out.textContent = `${fmt(n)} caractère${n > 1 ? "s" : ""} · ${fmt(wordCount(ta.value))} mots`;
}

function readEditorForm() {
  const f = $("#editor-form");
  if (!f) return;
  const c = draft.content;
  const val = (name) => f.elements.namedItem(name).value;
  c.title = val("title").trim();
  c.kind = val("kind");
  c.pillar = val("pillar");
  c.status = val("cstatus");
  c.text = val("text");
  c.notes = val("notes");
  readArticleForm(f);
  $$(".pub-row", f).forEach((row) => {
    const p = draft.pubs[Number(row.dataset.i)];
    p.date = row.querySelector('[name="date"]').value;
    p.time = row.querySelector('[name="time"]').value;
    p.status = row.querySelector('[name="status"]').value;
    p.url = row.querySelector('[name="url"]').value.trim();
    const pt = row.querySelector('[name="ptext"]');
    if (pt) p.text = pt.value;
    STAT_FIELDS.forEach(([k]) => {
      const input = row.querySelector(`[name="stat-${k}"]`);
      if (!input) return;
      const v = input.value;
      if (v === "") delete p.stats[k];
      else p.stats[k] = Math.max(0, Number(v) || 0);
    });
  });
}

function newPub(network, date = "") {
  return { id: uid("p"), contentId: draft.content.id, network, date, time: "", status: "prevu", url: "", stats: {}, statsAt: null, plannedAt: today() };
}

function openEditor(contentId, { date = "", focusPub = null } = {}) {
  const existing = contentId ? contentById(contentId) : null;
  if (contentId && !existing) return;
  const content = existing ? structuredClone(existing) : { id: uid("c"), title: "", kind: "post", pillar: "", status: "idee", slug: "", notes: "", text: "", createdAt: today() };
  draft = {
    isNew: !existing,
    content,
    pubs: existing ? structuredClone(pubsOf(existing.id)) : [],
    original: existing ? structuredClone(pubsOf(existing.id)) : [],
  };
  if (date) {
    const undated = draft.pubs.filter((p) => p.status === "prevu" && !p.date);
    if (undated.length) undated.forEach((p) => { p.date = date; p.plannedAt = today(); });
    else draft.pubs.push(newPub(content.kind === "article" ? "site" : "linkedin", date));
  }
  renderEditor();
  tooltip.hidden = true;
  editor.showModal();
  if (!genConfig) loadGenConfig().then(() => { const el = $("#gen-note"); if (el) el.innerHTML = genNoteHTML(); });
  if (content.kind === "article" && !publishConfig) loadPublishConfig().then(() => draft && draft.content.id === content.id && (readEditorForm(), renderEditor()));
  if (focusPub) {
    draft.focusPub = focusPub;
    $(`#pubrow-${focusPub}`)?.classList.add("is-focus");
    const row = $(`#pubrow-${focusPub}`);
    if (row) {
      const p = draft.pubs[Number(row.dataset.i)];
      if (p?.status === "publie") row.querySelector("details")?.setAttribute("open", "");
      row.scrollIntoView({ block: "center" });
      if (p?.status === "publie") row.querySelector('[name="stat-impressions"]')?.focus();
    }
  } else if (!existing) {
    $("#editor-title").focus();
  }
  if (scene && existing) scene.focus(existing.id);
}

function commitEditor() {
  readEditorForm();
  const c = draft.content;
  if (!c.title) {
    $("#editor-title").focus();
    return false;
  }
  const t = today();
  const before = new Map(draft.original.map((p) => [p.id, p]));
  let newlyPublished = false;
  draft.pubs.forEach((p) => {
    const old = before.get(p.id);
    const statsChanged = !old || JSON.stringify(old.stats || {}) !== JSON.stringify(p.stats || {});
    if (statsChanged && Object.values(p.stats).some((v) => v > 0)) p.statsAt = t;
    if (!Object.values(p.stats).some((v) => v > 0)) p.statsAt = null;
    if (p.status === "publie" && (!old || old.status !== "publie")) {
      newlyPublished = true;
      if (!p.date) p.date = t;
    }
  });
  // Un article est « Publié » quand il est en ligne sur le site ; les autres contenus dès qu'une publication est faite
  const live = c.kind === "article" ? draft.pubs.some((p) => p.network === "site" && p.status === "publie") : draft.pubs.some((p) => p.status === "publie");
  if (live) c.status = "publie";

  const idx = state.contents.findIndex((x) => x.id === c.id);
  if (idx >= 0) state.contents[idx] = c;
  else state.contents.push(c);
  state.pubs = state.pubs.filter((p) => p.contentId !== c.id).concat(draft.pubs);
  editor.close();
  draft = null;
  afterChange({ celebrateId: newlyPublished ? c.id : null });
  return true;
}

editor.addEventListener("click", (e) => {
  const tgt = e.target.closest("button, [data-close]");
  if (e.target === editor) { editor.close(); return; }
  if (!tgt || !draft) return;
  if (tgt.hasAttribute("data-close")) { editor.close(); return; }
  const add = (n) => {
    readEditorForm();
    const d = draft.pubs.find((p) => p.date)?.date || "";
    draft.pubs.push(newPub(n, d));
    renderEditor();
    if (n === "site") {
      const dd = draft;
      loadPublishConfig().then(() => draft === dd && (readEditorForm(), renderEditor()));
      editor.querySelector(".article-panel")?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };
  if (tgt.dataset.togglenet) {
    const n = tgt.dataset.togglenet;
    const i = draft.pubs.findIndex((p) => p.network === n);
    if (i < 0) return add(n);
    const p = draft.pubs[i];
    if (n === "site" && p.status === "publie" && onSite(draft.content)) return unpublishArticle(tgt);
    if ((p.status === "publie" || hasStats(p)) && !confirm(`Retirer la publication ${NETWORKS[n].label} ? Elle est déjà publiée ou a des stats.`)) return;
    readEditorForm();
    draft.pubs.splice(i, 1);
    renderEditor();
  }
  else if (tgt.hasAttribute("data-add3")) {
    readEditorForm();
    const d = draft.pubs.find((p) => p.date)?.date || "";
    SOCIALS.forEach((n) => { if (!draft.pubs.some((p) => p.network === n)) draft.pubs.push(newPub(n, d)); });
    renderEditor();
  } else if (tgt.dataset.delpub != null) {
    const p = draft.pubs[Number(tgt.dataset.delpub)];
    // Retirer la publication Site d'un article en ligne = le retirer vraiment du site
    if (p?.network === "site" && p.status === "publie" && onSite(draft.content)) return unpublishArticle(tgt);
    readEditorForm();
    draft.pubs.splice(Number(tgt.dataset.delpub), 1);
    renderEditor();
  } else if (tgt.dataset.unplan != null) {
    readEditorForm();
    const p = draft.pubs[Number(tgt.dataset.unplan)];
    if (!p) return;
    const label = NETWORKS[p.network].label;
    p.date = "";
    p.time = "";
    renderEditor(); // le formulaire doit refléter la date effacée avant l'enregistrement
    if (commitEditor()) toast(`Publication ${label} déprogrammée : elle n'apparaît plus dans le planning. Tu la retrouves dans « À programmer ».`);
  } else if (tgt.dataset.publish != null) {
    readEditorForm();
    const p = draft.pubs[Number(tgt.dataset.publish)];
    p.status = "publie";
    if (!p.date || p.date > today()) p.date = today();
    renderEditor();
  } else if (tgt.dataset.gen) {
    generate(tgt.dataset.gen, tgt);
  } else if (tgt.hasAttribute("data-gotoarticle")) {
    const panel = editor.querySelector(".article-panel");
    panel?.setAttribute("open", "");
    panel?.scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => editor.querySelector('[name="a-body"]')?.focus({ preventScroll: true }), 400);
  } else if (tgt.dataset.copypost != null) {
    readEditorForm();
    const text = draft.pubs[Number(tgt.dataset.copypost)]?.text || "";
    navigator.clipboard?.writeText(text).then(() => toast("Texte copié : il n'y a plus qu'à le coller sur le réseau."), () => toast("Copie impossible : sélectionne le texte à la main.", "warn"));
  } else if (tgt.hasAttribute("data-preview")) {
    openPreview();
  } else if (tgt.hasAttribute("data-sitepublish")) {
    publishArticle(tgt);
  } else if (tgt.hasAttribute("data-siteunpublish")) {
    unpublishArticle(tgt);
  } else if (tgt.hasAttribute("data-photo-remove")) {
    readEditorForm();
    const a = art(draft.content);
    a.photo = { alt: a.photo?.alt || "", credit: a.photo?.credit || "" };
    renderEditor();
  } else if (tgt.hasAttribute("data-delete") && onSite(draft.content)) {
    unpublishArticle(tgt, { thenDelete: true });
  } else if (tgt.hasAttribute("data-delete")) {
    if (confirm(`Supprimer « ${draft.content.title || "ce contenu"} » et ses publications ?`)) {
      state.contents = state.contents.filter((x) => x.id !== draft.content.id);
      state.pubs = state.pubs.filter((p) => p.contentId !== draft.content.id);
      editor.close();
      draft = null;
      afterChange();
    }
  }
});
editor.addEventListener("submit", (e) => {
  e.preventDefault();
  commitEditor();
});
/* Recadrage à la souris ou au doigt : la photo suit le glisser vertical */
editor.addEventListener("pointerdown", (e) => {
  const frame = e.target.closest(".photo-frame");
  if (!frame) return;
  const img = frame.querySelector("img");
  const range = editor.querySelector('[name="a-posy"]');
  if (!img || !range || !img.naturalWidth) return;
  e.preventDefault();
  frame.setPointerCapture(e.pointerId);
  frame.classList.add("is-dragging");
  const startY = e.clientY;
  const start = Number(range.value);
  // hauteur de photo qui dépasse du cadre (ce qu'on peut faire défiler)
  const shown = frame.clientWidth * (img.naturalHeight / img.naturalWidth);
  const spare = Math.max(1, shown - frame.clientHeight);
  const move = (ev) => {
    const v = Math.round(Math.min(100, Math.max(0, start - ((ev.clientY - startY) / spare) * 100)));
    range.value = v;
    img.style.objectPosition = `50% ${v}%`;
  };
  const up = () => {
    frame.classList.remove("is-dragging");
    frame.removeEventListener("pointermove", move);
    frame.removeEventListener("pointerup", up);
    frame.removeEventListener("pointercancel", up);
  };
  frame.addEventListener("pointermove", move);
  frame.addEventListener("pointerup", up);
  frame.addEventListener("pointercancel", up);
});

editor.addEventListener("input", (e) => {
  if (e.target.name === "a-sources") {
    const out = $("#sources-preview");
    if (out) out.innerHTML = sourcesPreviewHTML(e.target.value);
  }
  if (e.target.name === "a-posy") {
    const img = editor.querySelector(".photo-frame img");
    if (img) img.style.objectPosition = `50% ${e.target.value}%`;
  }
  if (e.target.name === "text") updateCharCount();
  // Réponse de Claude collée telle quelle dans le texte de l'article : on range chaque partie à sa place
  if (e.target.name === "a-body" && /^[#*\s]*={2,}\s*TEXTE\s*={2,}/im.test(e.target.value)) {
    const parsed = parseArticle(e.target.value);
    if (parsed.body) applyGenerated("article", parsed);
  }
  if (e.target.name === "ptext") {
    const row = e.target.closest(".pub-row");
    const p = draft?.pubs[Number(row?.dataset.i)];
    const out = e.target.parentElement.querySelector(".char-count span");
    if (p && out) { out.textContent = fmt(e.target.value.length); out.classList.toggle("is-over", e.target.value.length > CHAR_LIMITS[p.network]); }
  }
  if (e.target.name === "a-excerpt") {
    const n = e.target.value.length;
    const out = e.target.parentElement.querySelector(".char-count span");
    if (out) { out.textContent = n; out.classList.toggle("is-over", n > 160); }
  }
});
editor.addEventListener("change", async (e) => {
  // En quittant le champ : les sources collées sont remises au format « Nom | lien »
  if (e.target.name === "a-sources") {
    const clean = formatSources(e.target.value);
    if (clean !== e.target.value.trim()) e.target.value = clean;
    return;
  }
  if (!draft) return;
  if (e.target.name === "kind") {
    readEditorForm();
    renderEditor();
    if (draft.content.kind === "article") loadPublishConfig().then(() => draft && renderEditor());
  }
  if (e.target.matches("[data-photo]") && e.target.files[0]) {
    readEditorForm();
    const file = e.target.files[0];
    try {
      const data = await resizePhoto(file);
      if (draft) {
        const a = art(draft.content);
        a.photo = { ...(a.photo || {}), data, posY: 50 };
        delete a.photo.reframed;
      }
    } catch (err) {
      const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      toast(heic
        ? "Photo d'iPhone au format HEIC : ce navigateur ne sait pas la lire. Exporte-la en JPEG (ou ouvre le Camp de base dans Safari) puis réessaie."
        : "Cette image n'a pas pu être lue. Essaie une photo en JPEG ou PNG.", "warn");
    }
    e.target.value = ""; // pour pouvoir choisir à nouveau le même fichier
    if (draft) renderEditor();
  }
});
editor.addEventListener("close", () => {
  draft = null;
});

/* ---------- Niveau supérieur ---------- */

function showLevelUp(lvl) {
  const d = $("#levelup");
  d.innerHTML = `<div class="levelup-inner">
    <p class="eyebrow">Nouveau palier</p>
    <p class="levelup-alt">${fmt(lvl.from)} m</p>
    <h2>${lvl.name}</h2>
    <p>${lvl.next ? `Prochain palier : ${lvl.nextName}, à ${fmt(lvl.next)} m.` : "Plus haut, il n'y a que le ciel."}</p>
    <form method="dialog"><button class="btn btn-primary">On continue</button></form>
  </div>`;
  d.showModal();
}

/* ---------- Notifications ---------- */

function toast(text, kind = "") {
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = text;
  $("#toasts").appendChild(el);
  setTimeout(() => el.classList.add("is-out"), 2600);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- Événements globaux ---------- */

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view], [data-open], [data-goto], [data-mission], [data-cal], [data-addday], [data-advance], [data-statnet], [data-statperiod], [data-cam]");
  if (!b || editor.contains(b)) return;
  if (b.closest(".tabs") && b.dataset.view) return setView(b.dataset.view);
  if (b.dataset.goto) return setView(b.dataset.goto);
  if (b.dataset.mission !== undefined) return b.dataset.mission ? openEditor(b.dataset.mission) : openEditor(null);
  if (b.dataset.cal !== undefined) {
    const dir = Number(b.dataset.cal);
    if (!dir) calMonth = today().slice(0, 7);
    else {
      const [y, m] = calMonth.split("-").map(Number);
      calMonth = ymd(new Date(y, m - 1 + dir, 1)).slice(0, 7);
    }
    return renderPlanning();
  }
  if (b.dataset.addday) return openEditor(null, { date: b.dataset.addday });
  if (b.dataset.advance) {
    const c = contentById(b.dataset.advance);
    const next = { idee: "redaction", redaction: "pret" }[c?.status];
    if (next) { c.status = next; afterChange(); }
    return;
  }
  if (b.dataset.statnet) { statsNet = b.dataset.statnet; return renderStats(); }
  if (b.dataset.statperiod) { statsPeriod = b.dataset.statperiod; return renderStats(); }
  if (b.dataset.cam && scene) return b.dataset.cam === "runner" ? scene.focusRunner() : scene.overview();
  if (b.dataset.open) return openEditor(b.dataset.open, { focusPub: b.dataset.focuspub || null });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("tr[data-open]")) openEditor(e.target.dataset.open, { focusPub: e.target.dataset.focuspub });
});

document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-quick]");
  if (!f) return;
  e.preventDefault();
  const title = f.elements.namedItem("title").value.trim();
  if (!title) return;
  state.contents.push({ id: uid("c"), title, kind: "post", pillar: "", status: "idee", slug: "", notes: "", text: "", createdAt: today() });
  afterChange();
  $(".quick-idea input")?.focus();
});

document.addEventListener("input", (e) => {
  if (e.target.id === "content-search") {
    contentFilter = e.target.value;
    const pos = e.target.selectionStart;
    renderContenus();
    const inp = $("#content-search");
    inp.focus();
    inp.setSelectionRange(pos, pos);
  }
});

/* Glisser-déposer : planning (publications et contenus) et colonnes du tableau */
document.addEventListener("dragstart", (e) => {
  const pub = e.target.closest("[data-pub]");
  const content = e.target.closest("[data-content]");
  if (pub) e.dataTransfer.setData("text/x-pub", pub.dataset.pub);
  else if (content) e.dataTransfer.setData("text/x-content", content.dataset.content);
  else return;
  e.dataTransfer.effectAllowed = "move";
  e.target.classList.add("is-dragging");
});
document.addEventListener("dragend", (e) => e.target.classList?.remove("is-dragging"));
document.addEventListener("dragover", (e) => {
  const zone = e.target.closest("[data-day], [data-col]");
  if (!zone) return;
  e.preventDefault();
  $$(".is-drop").forEach((z) => z !== zone && z.classList.remove("is-drop"));
  zone.classList.add("is-drop");
});
document.addEventListener("dragleave", (e) => {
  const zone = e.target.closest("[data-day], [data-col]");
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("is-drop");
});
document.addEventListener("drop", (e) => {
  const zone = e.target.closest("[data-day], [data-col]");
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove("is-drop");
  const pubId = e.dataTransfer.getData("text/x-pub");
  const contentId = e.dataTransfer.getData("text/x-content");
  if (zone.dataset.day) {
    const day = zone.dataset.day;
    if (pubId) {
      const p = state.pubs.find((x) => x.id === pubId);
      if (p && p.date !== day) { p.date = day; if (p.status === "prevu") p.plannedAt = today(); afterChange(); }
    } else if (contentId) {
      const c = contentById(contentId);
      if (!c) return;
      openEditor(c.id, { date: day });
    }
  } else if (zone.dataset.col && contentId) {
    const c = contentById(contentId);
    if (c && c.status !== zone.dataset.col) { c.status = zone.dataset.col; afterChange(); }
  }
});


/* Mémo et relevés d'audience */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-task-toggle], [data-task-del], [data-note-pin], [data-note-del], [data-site-del], [data-aud-del]");
  if (!b) return;
  const d = b.dataset;
  if (d.taskToggle) {
    const k = state.tasks.find((x) => x.id === d.taskToggle);
    if (!k) return;
    k.done = !k.done;
    k.doneAt = k.done ? today() : null;
    afterChange();
  } else if (d.taskDel) {
    state.tasks = state.tasks.filter((x) => x.id !== d.taskDel);
    afterChange();
  } else if (d.notePin) {
    const n = state.notes.find((x) => x.id === d.notePin);
    if (n) { n.pinned = !n.pinned; save(); renderPanel(); }
  } else if (d.noteDel) {
    if (confirm("Supprimer cette note ?")) { state.notes = state.notes.filter((x) => x.id !== d.noteDel); save(); renderPanel(); }
  } else if (d.siteDel) {
    state.siteStats = state.siteStats.filter((x) => x.id !== d.siteDel);
    afterChange();
  } else if (d.audDel) {
    state.audience = state.audience.filter((x) => x.id !== d.audDel);
    afterChange();
  }
});

document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-form]");
  if (!f) return;
  e.preventDefault();
  const get = (n) => f.elements.namedItem(n)?.value?.trim() ?? "";
  const kind = f.dataset.form;
  if (kind === "task") {
    if (!get("text")) return;
    state.tasks.push({ id: uid("t"), text: get("text"), due: get("due"), contentId: get("contentId"), done: false, doneAt: null, createdAt: today() });
    toast("Tâche ajoutée");
  } else if (kind === "note") {
    if (!get("text")) return;
    const now = new Date().toISOString();
    state.notes.push({ id: uid("n"), text: f.elements.namedItem("text").value, color: f.querySelector("[name=color]:checked")?.value || "sable", pinned: false, createdAt: now, updatedAt: now });
  } else if (kind === "site") {
    const week = weekStart(get("week"));
    const entry = { visitors: Math.max(0, Number(get("visitors")) || 0), pageviews: Math.max(0, Number(get("pageviews")) || 0) };
    const existing = state.siteStats.find((x) => x.week === week);
    if (existing) { Object.assign(existing, entry); toast("Relevé de la semaine mis à jour"); }
    else state.siteStats.push({ id: uid("s"), week, ...entry });
  } else if (kind === "audience") {
    const network = f.dataset.network;
    const date = get("date");
    const followers = Math.max(0, Number(get("followers")) || 0);
    const existing = state.audience.find((x) => x.network === network && x.date === date);
    if (existing) { existing.followers = followers; toast("Relevé du jour mis à jour"); }
    else state.audience.push({ id: uid("a"), network, date, followers });
  } else return;
  afterChange();
  if (kind === "task") (f.closest("#panel") ? $(`#panel [data-form="task"] [name="text"]`) : $(`#side [data-form="task"] [name="text"]`))?.focus();
});

/* Les notes s'enregistrent quand on quitte le champ, sans redessiner la page */
document.addEventListener("change", (e) => {
  const id = e.target.dataset?.noteId;
  if (!id) return;
  const n = state.notes.find((x) => x.id === id);
  if (!n) return;
  n.text = e.target.value;
  n.updatedAt = new Date().toISOString();
  save();
});

/* Menu : sauvegarde / réglages */
const menu = $("#menu");
$("#btn-menu").addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  $("#btn-menu").setAttribute("aria-expanded", String(!menu.hidden));
});
document.addEventListener("click", (e) => {
  if (!menu.hidden && !e.target.closest(".hud-actions")) {
    menu.hidden = true;
    $("#btn-menu").setAttribute("aria-expanded", "false");
  }
});
menu.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]")?.dataset.action;
  if (a === "export") {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `camp-de-base-${today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } else if (a === "import-articles") {
    runArticleImport({ manual: true });
  } else if (a === "restore") {
    restoreBackup();
  } else if (a === "reset") {
    if (confirm("Effacer toutes tes modifications et repartir des données de départ ? Exporte d'abord une sauvegarde si besoin.")) {
      state = seedState();
      state.seenBadges = badges(state).filter((b) => b.unlocked).map((b) => b.id);
      lastXP = computeXP(state);
      lastLevel = levelFor(lastXP).index;
      save();
      renderAll();
    }
  }
});
/* Remplace toutes les données par une sauvegarde (l'état actuel est gardé de côté pour annuler) */
function applyBackup(data) {
  try { localStorage.setItem(STORE_KEY + ":before-restore", JSON.stringify(state)); } catch (e) { /* pas de place */ }
  state = normalizeState(structuredClone(data));
  if (!Array.isArray(state.seenBadges)) state.seenBadges = badges(state).filter((b) => b.unlocked).map((b) => b.id);
  lastXP = computeXP(state);
  lastLevel = levelFor(lastXP).index;
  save();
  renderAll();
}

async function restoreBackup() {
  const options = [];
  try {
    const info = JSON.parse(localStorage.getItem(BACKUP_KEY + "-info") || "{}");
    if (localStorage.getItem(BACKUP_KEY)) options.push({ label: `Copie de cet appareil, faite le ${fmtDate(info.day)}`, load: async () => JSON.parse(localStorage.getItem(BACKUP_KEY)) });
    if (localStorage.getItem(STORE_KEY + ":before-restore")) options.push({ label: "Annuler la dernière restauration", load: async () => JSON.parse(localStorage.getItem(STORE_KEY + ":before-restore")) });
  } catch (e) { /* rien */ }
  const code = getPublishCode();
  const get = async (q) => {
    const r = await fetch(`/api/camp/data?${q}`, { headers: { "x-camp-code": code || "" }, cache: "no-store" });
    return r.json().catch(() => ({}));
  };
  if (code) {
    try {
      const list = await get("backups=1");
      (list.versions || []).slice(0, 8).forEach((v) => options.push({ label: `En ligne : version ${v.version}, ${new Date(v.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`, load: async () => (await get(`history=${v.version}`)).data }));
      (list.days || []).forEach((d) => options.push({ label: `En ligne : début de journée du ${fmtDate(d)}`, load: async () => (await get(`backup=${d}`)).data }));
      if (list.badCode) rememberPublishCode(code, false);
    } catch (e) { /* hors ligne : seulement les copies locales */ }
  }
  if (!options.length) return toast("Aucune sauvegarde disponible pour l'instant (elles se créent au fil des enregistrements).", "warn");
  const pick = prompt(`Quelle sauvegarde restaurer ? (tape le numéro)\n\n${options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`);
  const opt = options[Number(pick) - 1];
  if (!opt) return;
  const data = await opt.load().catch(() => null);
  if (!data || !Array.isArray(data.contents)) return toast("Cette sauvegarde est illisible.", "warn");
  if (!confirm(`Restaurer « ${opt.label} » ?\n\n${data.contents.length} contenus, ${(data.tasks || []).length} tâches, ${(data.notes || []).length} notes.\nTes données actuelles seront remplacées (tu pourras annuler avec « Annuler la dernière restauration »).`)) return;
  applyBackup(data);
  toast("Sauvegarde restaurée.");
}

$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.contents) || !Array.isArray(data.pubs)) throw new Error("format");
    state = normalizeState(data);
    if (!Array.isArray(state.seenBadges)) state.seenBadges = badges(state).filter((b) => b.unlocked).map((b) => b.id);
    lastXP = computeXP(state);
    lastLevel = levelFor(lastXP).index;
    save();
    renderAll();
    toast("Sauvegarde importée.");
  } catch (err) {
    toast("Ce fichier n'est pas une sauvegarde du camp de base.", "warn");
  }
  e.target.value = "";
});
$("#goal-input").addEventListener("change", (e) => {
  state.settings.weeklyGoal = Math.max(1, Math.min(14, Number(e.target.value) || 2));
  afterChange();
});
$("#btn-new").addEventListener("click", () => openEditor(null));

/* ---------- Démarrage ---------- */

// On arrive toujours sur le sentier, sauf si l'adresse demande une page (#memo, #stats…)
const startView = viewFromHash();
history.replaceState({ view: startView }, "", location.href);
save();
view = null;
setView(startView, { push: false });
renderHud();
renderSide();
initScene();

/* Récupère une fois le texte des articles déjà écrits sur le site */
async function runArticleImport({ manual = false } = {}) {
  const n = await importAllArticles(state);
  state.settings.articlesImported = true;
  if (n || manual) toast(n ? `${n} article${n > 1 ? "s" : ""} du site récupéré${n > 1 ? "s" : ""} dans le Camp de base` : "Tous les articles du site sont déjà dans le Camp de base");
  save();
  if (n) renderAll();
}
if (!state.settings.articlesImported) setTimeout(() => runArticleImport(), 2500);

/* Chaque article publié sur le site a son post LinkedIn associé (une fois pour les articles déjà en ligne) */
function linkArticlesToLinkedIn({ retro = false } = {}) {
  let n = 0;
  state.contents.forEach((c) => {
    if (c.kind !== "article") return;
    const ps = pubsOf(c.id);
    const site = ps.find((p) => p.network === "site" && p.status === "publie");
    if (!site || ps.some((p) => p.network === "linkedin")) return;
    state.pubs.push({
      id: uid("p"), contentId: c.id, network: "linkedin", date: site.date, time: "",
      status: retro ? "publie" : "prevu", url: "", stats: {}, statsAt: null, plannedAt: retro ? null : today(),
      // Les articles déjà en ligne : on suppose le post LinkedIn fait, sans gain de D+ rétroactif
      imported: retro || undefined,
    });
    n++;
  });
  return n;
}
if (!state.settings.linkedinLinked) {
  linkArticlesToLinkedIn({ retro: true });
  state.settings.linkedinLinked = true;
  save();
}

/* ---------- Synchronisation entre appareils ---------- */

const CLOUD_LABELS = {
  ok: ["☁", "Synchronisé"],
  saving: ["☁", "Enregistrement…"],
  offline: ["☁", "Hors ligne"],
  off: ["☁", "Synchro à configurer"],
  badcode: ["☁", "Code incorrect"],
  nocode: ["☁", "Code requis"],
  error: ["☁", "Erreur de synchro"],
  empty: ["☁", "Activer la synchro"],
};
function showCloudStatus(st, info) {
  const el = $("#cloud-status");
  if (!el) return;
  const [icon, label] = CLOUD_LABELS[st] || CLOUD_LABELS.off;
  el.dataset.state = st;
  el.innerHTML = `<span aria-hidden="true">${icon}</span><span class="cloud-label">${label}</span>`;
  el.title =
    st === "ok" ? `Tes données sont les mêmes sur tous tes appareils${info ? ` (dernier enregistrement ${ago(info)})` : ""}.` :
    st === "off" ? `Synchronisation pas encore activée${info ? ` : il manque ${info}` : ""}. Voir CONNEXIONS.md, partie 4.` :
    st === "empty" ? "Rien n'est encore en ligne : clique ici sur l'appareil qui a tes données les plus à jour." :
    st === "offline" ? "Pas de connexion : les modifications sont gardées sur cet appareil et partiront au retour du réseau." :
    st === "badcode" || st === "nocode" ? "Clique pour saisir ton code de publication." :
    info || "";
}
var cloud = createCloud({
  storeKey: STORE_KEY,
  getState: () => state,
  setState: (s) => {
    state = normalizeState(s);
    if (!Array.isArray(state.seenBadges)) state.seenBadges = badges(state).filter((b) => b.unlocked).map((b) => b.id);
    lastXP = computeXP(state);
    lastLevel = levelFor(lastXP).index;
    save({ fromCloud: true });
  },
  storedCode: () => { try { return localStorage.getItem(STORE_KEY + ":publish") || ""; } catch (e) { return ""; } },
  askCode: () => (prompt("Synchronisation entre tes appareils : entre ton code de publication (celui choisi sur Vercel).") || "").trim(),
  rememberCode: rememberPublishCode,
  onStatus: showCloudStatus,
  onPhotos: () => {
    save({ fromCloud: true });
    if (!draft) renderAll();
  },
});
$("#cloud-status").addEventListener("click", async () => {
  if (cloud.status === "empty") {
    if (confirm("Mettre en ligne les données de CET appareil ?\n\nFais-le sur l'ordinateur qui a tes données les plus à jour : elles deviendront la référence, et tes autres appareils les récupéreront automatiquement (leurs ajouts seront fusionnés).")) {
      await cloud.initialize();
      toast("Synchronisation activée : tes données sont en ligne.");
    }
    return;
  }
  if (await cloud.retry()) { renderAll(); toast("Données mises à jour depuis tes autres appareils"); }
});
async function cloudPull() {
  if (await cloud.pull()) {
    renderAll();
    toast("Données mises à jour depuis tes autres appareils");
  }
}
cloudPull();
// En quittant l'onglet : on envoie tout de suite ; en revenant : on récupère la dernière version
document.addEventListener("visibilitychange", () => { if (document.hidden) cloud.flush(); else cloudPull(); });
window.addEventListener("pagehide", () => cloud.flush());
window.addEventListener("beforeunload", (e) => {
  if (cloud.pending) { cloud.flush(); e.preventDefault(); e.returnValue = ""; }
});
// Onglet ouvert sur deux appareils : on vérifie la version en ligne chaque minute
setInterval(() => { if (!document.hidden && !draft) cloudPull(); }, 60000);
window.addEventListener("online", () => cloud.push());

// Synchro automatique au plus toutes les 6 heures
const lastSync = state.settings.sync?.at;
if (!lastSync || Date.now() - new Date(lastSync) > 6 * 3600 * 1000) setTimeout(() => runSync({ quiet: true }), 1500);
