/* =========================================================
   Camp de base. Onglet Podcast : idées, épisodes, invités, tournage,
   questions d'interview, préparation, montage et diffusion.
   Les épisodes vivent dans state.episodes (synchronisés comme le reste).
   ========================================================= */

export const EP_STATUSES = {
  idee: "Idée",
  prepa: "En préparation",
  contact: "Invité contacté",
  cale: "Tournage calé",
  enregistre: "Enregistré",
  montage: "En montage",
  publie: "Publié",
};
const EP_ORDER = Object.keys(EP_STATUSES);

const FORMATS = { interview: "Interview", solo: "Solo", table: "Table ronde", terrain: "Reportage terrain" };
const MODES = { studio: "En studio / salle", terrain: "Sur le terrain", distance: "À distance (visio)", chez: "Chez l'invité" };
export const GUEST_STATUSES = {
  afaire: "À contacter",
  contacte: "Contacté",
  relance: "Relancé",
  accepte: "A accepté",
  refuse: "A décliné",
};
const Q_SECTIONS = { ouverture: "Ouverture", coeur: "Cœur de l'échange", conclusion: "Pour conclure" };

const CHECK_BEFORE = [
  "Brief envoyé à l'invité (thème, durée, déroulé)",
  "Accord de diffusion / droit à l'image signé",
  "Lieu réservé et accès vérifié",
  "Micros, enregistreur et câbles testés",
  "Batteries chargées, cartes mémoire vides",
  "Questions relues et imprimées",
  "Rappel envoyé à l'invité la veille",
];
const CHECK_AFTER = [
  "Sauvegarde des rushs (2 copies)",
  "Dérushage et sélection",
  "Montage, intro et outro",
  "Chapitres et horodatages",
  "Notes d'épisode rédigées",
  "Visuel / miniature de l'épisode",
  "Mise en ligne sur Spotify",
  "Extrait vidéo pour les réseaux",
  "Post LinkedIn / Instagram programmé",
  "Remerciement envoyé à l'invité avec le lien",
];

export function newEpisode(uid, today, extra = {}) {
  return {
    id: uid("e"),
    createdAt: today(),
    number: "",
    title: "",
    format: "interview",
    status: "idee",
    pillar: "",
    pitch: "",
    why: "",
    keyPoints: "",
    promise: "",
    refs: "",
    guest: { name: "", role: "", email: "", phone: "", social: "", bio: "", status: "afaire", contactedAt: "", followUp: "", notes: "" },
    rec: { date: "", time: "", duration: "60", mode: "studio", place: "", address: "", access: "", logistics: "", contact: "" },
    questions: [],
    before: CHECK_BEFORE.map((t) => ({ t, done: false })),
    after: CHECK_AFTER.map((t) => ({ t, done: false })),
    pub: { date: "", time: "", url: "", duration: "" },
    showNotes: "",
    quotes: "",
    ...extra,
  };
}

/* Complète un épisode chargé (ancienne version, autre appareil) */
function fill(ep) {
  ep.guest = { status: "afaire", ...(ep.guest || {}) };
  ep.rec = { mode: "studio", duration: "60", ...(ep.rec || {}) };
  ep.pub = { ...(ep.pub || {}) };
  ep.questions ||= [];
  ep.before ||= CHECK_BEFORE.map((t) => ({ t, done: false }));
  ep.after ||= CHECK_AFTER.map((t) => ({ t, done: false }));
  return ep;
}

/* ---------- Mails à l'invité (ouverts dans la messagerie, modifiables avant envoi) ---------- */

const first = (name) => String(name || "").trim().split(/\s+/)[0] || "";
function longDateFr(d) {
  if (!d) return "";
  const [y, m, j] = d.split("-").map(Number);
  return new Date(y, m - 1, j).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function mailTemplates(ep) {
  const g = ep.guest || {};
  const r = ep.rec || {};
  const hello = `Bonjour${first(g.name) ? " " + first(g.name) : ""},`;
  const sign = `\n\nBelle journée,\nCorentin Griffon\nEntre 2 sentiers · entre2sentiers.com`;
  const where = [r.place, r.address].filter(Boolean).join(", ");
  const when = r.date ? `${longDateFr(r.date)}${r.time ? ` à ${r.time.replace(":", "h")}` : ""}` : "";
  return {
    demande: {
      label: "Demande de collaboration",
      subject: `Invitation dans le podcast Entre 2 sentiers${ep.title ? ` : ${ep.title}` : ""}`,
      body: `${hello}

Je m'appelle Corentin Griffon et j'anime Entre 2 sentiers, un blog et un podcast qui regardent le marketing, la communication et l'environnement à travers le sport outdoor.

Je prépare un épisode${ep.title ? ` sur « ${ep.title} »` : ""}${ep.pitch ? ` : ${ep.pitch}` : ""}. ${g.role ? `Ton regard de ${g.role} serait` : "Ton regard serait"} précieux, et j'aimerais beaucoup t'inviter à en parler.

Concrètement : un échange d'environ ${r.duration || "60"} minutes, ${r.mode === "distance" ? "en visio" : "enregistré en face à face"}, à la date qui t'arrange. Je t'envoie les grandes questions à l'avance, et tu valides l'épisode avant sa diffusion.

Est-ce que ça te tenterait ?${sign}`,
    },
    relance: {
      label: "Relance",
      subject: `Re : podcast Entre 2 sentiers${ep.title ? ` – ${ep.title}` : ""}`,
      body: `${hello}

Je me permets de revenir vers toi au sujet de mon invitation dans le podcast Entre 2 sentiers${ep.title ? ` (« ${ep.title} »)` : ""}.

Je comprends tout à fait que les agendas soient chargés : si le moment n'est pas idéal, on peut aussi caler ça plus tard, ou en visio pour que ce soit plus simple.

Dis-moi ce qui t'arrangerait !${sign}`,
    },
    confirmation: {
      label: "Confirmation (date et lieu)",
      subject: `Confirmation de l'enregistrement${when ? ` – ${when}` : ""}`,
      body: `${hello}

Merci encore d'avoir accepté ! Je te confirme les infos pour l'enregistrement :

- Quand : ${when || "(date à préciser)"}${r.duration ? ` (environ ${r.duration} min)` : ""}
- Où : ${r.mode === "distance" ? "en visio, je t'envoie le lien la veille" : where || "(lieu à préciser)"}${r.access ? `\n- Accès : ${r.access}` : ""}${r.logistics ? `\n- Organisation : ${r.logistics}` : ""}${r.contact ? `\n- Contact sur place : ${r.contact}` : ""}

Le thème : ${ep.pitch || ep.title || "(à préciser)"}.
Je t'envoie les grandes questions quelques jours avant. N'hésite pas si tu as la moindre question.${sign}`,
    },
    rappel: {
      label: "Rappel la veille",
      subject: `À demain pour le podcast${when ? ` – ${when}` : ""}`,
      body: `${hello}

Petit rappel pour demain${r.time ? `, ${r.time.replace(":", "h")}` : ""} : ${r.mode === "distance" ? "on se retrouve en visio (lien ci-dessous)" : `rendez-vous ${where || "au lieu convenu"}`}.${r.access ? `\nAccès : ${r.access}` : ""}

Hâte d'échanger avec toi !${sign}`,
    },
    merci: {
      label: "Merci + lien de l'épisode",
      subject: `Ton épisode est en ligne${ep.title ? ` : ${ep.title}` : ""}`,
      body: `${hello}

Merci encore pour ce super échange ! L'épisode est en ligne :
${ep.pub?.url || "(lien de l'épisode)"}

N'hésite pas à le partager à ta communauté, ça aide énormément un podcast indépendant comme le mien. Je te tague dans mes posts.${sign}`,
    },
  };
}

function mailtoHref(email, t) {
  return `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
}

/* ---------- Demande de questions à Claude ---------- */

export function questionsPrompt(ep) {
  const g = ep.guest || {};
  return `Tu aides Corentin Griffon à préparer un épisode du podcast « Entre 2 sentiers » (marketing, communication, environnement et sport outdoor). Ton : curieux, direct, bienveillant ; des questions ouvertes, concrètes, qui font raconter des histoires plutôt que réciter.

Prépare les questions d'interview de cet épisode :
- Titre : ${ep.title || "(à définir)"}
- Format : ${FORMATS[ep.format] || "Interview"}${ep.rec?.duration ? `, environ ${ep.rec.duration} minutes` : ""}
- Angle : ${ep.pitch || "(à définir)"}
${ep.why ? `- Pourquoi maintenant : ${ep.why}\n` : ""}${ep.keyPoints ? `- Points à couvrir : ${ep.keyPoints}\n` : ""}${ep.promise ? `- Ce que l'auditeur doit retenir : ${ep.promise}\n` : ""}${g.name ? `- Invité : ${g.name}${g.role ? `, ${g.role}` : ""}\n` : ""}${g.bio ? `- À propos de l'invité : ${g.bio}\n` : ""}
N'invente aucun fait sur l'invité : si une question suppose une information, formule-la comme une question.

Réponds UNIQUEMENT avec ce modèle (une question par ligne, commençant par "- ") :

=== OUVERTURE ===
- (3 questions pour présenter l'invité et lancer le sujet)
=== COEUR ===
- (8 à 10 questions de fond, de la plus large à la plus précise, avec 2 ou 3 relances possibles)
=== CONCLUSION ===
- (3 questions pour conclure : conseil, ressource, question de la fin)`;
}

export function parseQuestions(raw) {
  const out = [];
  let section = "coeur";
  String(raw || "").replace(/\r\n/g, "\n").split("\n").forEach((line) => {
    const l = line.trim();
    const h = l.replace(/[=#*]/g, "").trim().toUpperCase();
    if (/^={2,}|^#+/.test(l) || /^(OUVERTURE|COEUR|CŒUR|CONCLUSION)\b/.test(h)) {
      if (h.startsWith("OUV")) section = "ouverture";
      else if (h.startsWith("CON")) section = "conclusion";
      else if (h.startsWith("C")) section = "coeur";
      return;
    }
    const q = l.replace(/^(?:[-*•–]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim();
    if (q && q.length > 3 && l !== q) out.push({ section, t: q });
  });
  return out;
}

/* ---------- Le module ---------- */

export function createPodcast(ctx) {
  const { $, esc, uid, fmtDate, today, toast, getState, afterChange, copyText, redacUrl, redacTarget, pillars, createSocialPost } = ctx;
  const dlg = $("#episode");
  let ep = null; // copie de travail de l'épisode ouvert
  let isNew = false;
  const list = () => {
    const s = getState();
    if (!Array.isArray(s.episodes)) s.episodes = [];
    s.episodes.forEach(fill);
    return s.episodes;
  };

  const done = (arr) => arr.filter((x) => x.done).length;
  const nextDate = (e) => {
    const t = today();
    const d = [e.rec?.date, e.pub?.date, e.guest?.followUp].filter((x) => x && x >= t).sort()[0];
    return d || "";
  };

  /* --- Vue principale --- */
  function renderView(panel) {
    const eps = list();
    const t = today();
    const upcoming = [];
    eps.forEach((e) => {
      if (e.rec?.date && e.rec.date >= t && e.status !== "publie") upcoming.push({ d: e.rec.date, txt: `🎙 Tournage${e.rec.time ? ` ${e.rec.time.replace(":", "h")}` : ""} : ${e.title || "Sans titre"}`, id: e.id });
      if (e.pub?.date && e.pub.date >= t && e.status !== "publie") upcoming.push({ d: e.pub.date, txt: `🎧 Sortie : ${e.title || "Sans titre"}`, id: e.id });
      if (e.guest?.followUp && ["contacte", "relance"].includes(e.guest.status)) upcoming.push({ d: e.guest.followUp, txt: `✉️ Relancer ${e.guest.name || "l'invité"} (${e.title || "épisode"})`, id: e.id, late: e.guest.followUp < t });
    });
    upcoming.sort((a, b) => a.d.localeCompare(b.d));
    const guests = eps.filter((e) => e.guest?.name);
    const published = eps.filter((e) => e.status === "publie").length;

    panel.innerHTML = `
    <div class="panel-head">
      <div><p class="eyebrow">Podcast</p><h1>Le studio du sentier</h1></div>
      <div class="panel-tools">
        <span class="muted">${eps.length} épisode${eps.length > 1 ? "s" : ""} · ${published} publié${published > 1 ? "s" : ""}</span>
        <button class="btn btn-primary btn-sm" type="button" data-ep-new>+ Nouvel épisode</button>
      </div>
    </div>
    <form class="ep-quick" data-ep-quick>
      <input class="input" name="idea" placeholder="Une idée d'épisode en une phrase… (Entrée pour l'ajouter)" aria-label="Nouvelle idée d'épisode" autocomplete="off">
      <button class="btn btn-ghost btn-sm" type="submit">Ajouter l'idée</button>
    </form>
    <div class="ep-board">
      ${EP_ORDER.map((st) => {
        const col = eps.filter((e) => e.status === st).sort((a, b) => (nextDate(a) || "9999").localeCompare(nextDate(b) || "9999"));
        return `<section class="ep-col" data-ep-col="${st}">
          <header><span>${EP_STATUSES[st]}</span><span class="muted">${col.length}</span></header>
          ${col.map(cardHTML).join("") || `<p class="empty small">—</p>`}
        </section>`;
      }).join("")}
    </div>
    <div class="ep-side">
      <section class="card">
        <h2 class="h-card">Prochaines échéances</h2>
        ${upcoming.length ? `<ul class="ep-up">${upcoming.slice(0, 10).map((u) => `<li class="${u.late ? "is-late" : ""}"><button type="button" class="link" data-ep-open="${u.id}">${esc(u.txt)}</button><span class="muted small">${u.late ? "en retard · " : ""}${fmtDate(u.d)}</span></li>`).join("")}</ul>` : `<p class="empty">Rien de calé pour l'instant. Donne une date de tournage ou de sortie à un épisode.</p>`}
      </section>
      <section class="card">
        <h2 class="h-card">Carnet d'invités</h2>
        ${guests.length ? `<ul class="ep-guests">${guests.map((e) => `<li>
            <button type="button" class="link" data-ep-open="${e.id}">${esc(e.guest.name)}</button>
            <span class="g-chip g-${e.guest.status}">${GUEST_STATUSES[e.guest.status] || ""}</span>
            <span class="muted small">${esc(e.guest.role || "")}${e.guest.role ? " · " : ""}${esc(e.title || "")}</span>
          </li>`).join("")}</ul>` : `<p class="empty">Ajoute un invité dans la fiche d'un épisode.</p>`}
      </section>
    </div>`;
  }

  function cardHTML(e) {
    const qs = e.questions.length;
    const prep = `${done(e.before)}/${e.before.length}`;
    const post = `${done(e.after)}/${e.after.length}`;
    const nd = nextDate(e);
    return `<article class="ep-card" draggable="true" data-ep="${e.id}">
      <button type="button" class="ep-open" data-ep-open="${e.id}">
        <span class="k-meta">${e.number ? `Ép. ${esc(e.number)} · ` : ""}${FORMATS[e.format] || ""}${e.pillar && pillars[e.pillar] ? ` · ${pillars[e.pillar]}` : ""}</span>
        <span class="k-title">${esc(e.title || e.pitch || "Sans titre")}</span>
        ${e.guest?.name ? `<span class="ep-guest">🎤 ${esc(e.guest.name)} <span class="g-chip g-${e.guest.status}">${GUEST_STATUSES[e.guest.status] || ""}</span></span>` : ""}
      </button>
      <div class="ep-meta">
        ${qs ? `<span title="Questions préparées">❓ ${qs}</span>` : ""}
        ${["cale", "contact", "prepa"].includes(e.status) ? `<span title="Préparation">✅ ${prep}</span>` : ""}
        ${["enregistre", "montage"].includes(e.status) ? `<span title="Après tournage">🎬 ${post}</span>` : ""}
        ${nd ? `<span class="k-date">${fmtDate(nd)}</span>` : ""}
      </div>
    </article>`;
  }

  /* --- Fiche épisode --- */
  function open(id, preset = {}) {
    const existing = id ? list().find((e) => e.id === id) : null;
    isNew = !existing;
    ep = existing ? fill(structuredClone(existing)) : newEpisode(uid, today, preset);
    render();
    dlg.showModal();
    if (isNew) dlg.querySelector('[name="title"]')?.focus();
  }

  function sec(id, title, body, openIt = false, extra = "") {
    return `<details class="ep-sec" data-sec="${id}" ${openIt ? "open" : ""}><summary><span>${title}</span>${extra}</summary><div class="ep-sec-body">${body}</div></details>`;
  }
  const opt = (obj, val) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${val === k ? "selected" : ""}>${l}</option>`).join("");
  const inp = (name, val, attrs = "") => `<input class="input" name="${name}" value="${esc(val)}" ${attrs}>`;
  const area = (name, val, rows = 3, ph = "") => `<textarea class="input" name="${name}" rows="${rows}" placeholder="${esc(ph)}">${esc(val)}</textarea>`;

  function render() {
    const e = ep;
    const g = e.guest;
    const r = e.rec;
    const mails = mailTemplates(e);
    const openSec = dlg.querySelectorAll("details.ep-sec[open]");
    const wasOpen = new Set([...openSec].map((d) => d.dataset.sec));
    const isOpen = (id, def) => (wasOpen.size ? wasOpen.has(id) : def);
    const maps = r.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}` : "";

    dlg.innerHTML = `
    <form method="dialog" class="editor-form" id="ep-form">
      <header class="editor-head">
        <p class="eyebrow">${isNew ? "Nouvel épisode" : "Épisode"}</p>
        <button type="button" class="btn btn-ghost btn-icon" data-ep-close aria-label="Fermer">×</button>
      </header>
      <label class="field-title"><span class="sr">Titre</span>${inp("title", e.title, 'class="input input-title" placeholder="Titre de l\'épisode"')}</label>
      <div class="editor-meta ep-meta4">
        <label>N°${inp("number", e.number, 'placeholder="12"')}</label>
        <label>Format<select class="input" name="format">${opt(FORMATS, e.format)}</select></label>
        <label>Étape<select class="input" name="status">${opt(EP_STATUSES, e.status)}</select></label>
        <label>Pilier<select class="input" name="pillar"><option value="">—</option>${opt(pillars, e.pillar)}</select></label>
      </div>

      ${sec("theme", "🧭 Thème et angle", `
        <label>L'angle en une phrase${area("pitch", e.pitch, 2, "Ex. : pourquoi les petites courses font vivre les territoires mieux que les grandes")}</label>
        <label>Pourquoi maintenant ?${area("why", e.why, 2, "Actualité, saison, chiffre, débat du moment…")}</label>
        <label>Points à couvrir / messages clés${area("keyPoints", e.keyPoints, 4, "Une idée par ligne")}</label>
        <label>Ce que l'auditeur doit retenir${area("promise", e.promise, 2, "La promesse de l'épisode")}</label>
        <label>Références, sources, lectures${area("refs", e.refs, 3, "Articles, livres, épisodes liés…")}</label>`, isOpen("theme", true))}

      ${sec("guest", "🎤 Invité", `
        <div class="article-grid-2">
          <label>Nom${inp("g-name", g.name, 'placeholder="Prénom Nom"')}</label>
          <label>Fonction / structure${inp("g-role", g.role, 'placeholder="Directeur de course, athlète, marque…"')}</label>
          <label>E-mail${inp("g-email", g.email, 'type="email" placeholder="prenom@exemple.com"')}</label>
          <label>Téléphone${inp("g-phone", g.phone, 'type="tel"')}</label>
          <label>Réseau (LinkedIn, Instagram…)${inp("g-social", g.social, 'placeholder="https://"')}</label>
          <label>Statut de la demande<select class="input" name="g-status">${opt(GUEST_STATUSES, g.status)}</select></label>
          <label>Contacté le${inp("g-contactedAt", g.contactedAt, 'type="date"')}</label>
          <label>Relancer le${inp("g-followUp", g.followUp, 'type="date"')}</label>
        </div>
        <label>Bio / ce qu'il faut savoir${area("g-bio", g.bio, 3, "Parcours, actualité, sujets sensibles à éviter…")}</label>
        <label>Notes d'échange${area("g-notes", g.notes, 2, "Ce qui a été convenu, préférences…")}</label>
        <div class="ep-mails">
          <p class="eyebrow">Mails prêts à envoyer</p>
          ${Object.entries(mails).map(([k, m]) => `<span class="ep-mail">
            <a class="btn btn-ghost btn-sm" href="${mailtoHref(g.email, m)}" data-ep-mail="${k}">✉️ ${m.label}</a>
            <button type="button" class="link small" data-ep-copymail="${k}" title="Copier le texte (pour un message LinkedIn ou Instagram)">copier</button>
          </span>`).join("")}
          <p class="muted small">Le mail s'ouvre dans ta messagerie, déjà rempli : relis-le, ajuste, envoie. « Demande » et « Relance » mettent à jour le statut et la date de relance (+7 jours).</p>
        </div>`, isOpen("guest", false), g.name ? `<span class="g-chip g-${g.status}">${esc(g.name)} · ${GUEST_STATUSES[g.status]}</span>` : "")}

      ${sec("rec", "📍 Tournage", `
        <div class="pub-grid ep-rec-grid">
          <label>Date${inp("r-date", r.date, 'type="date"')}</label>
          <label>Heure${inp("r-time", r.time, 'type="time"')}</label>
          <label>Durée visée (min)${inp("r-duration", r.duration, 'type="number" min="5" step="5"')}</label>
        </div>
        <label>Mode<select class="input" name="r-mode">${opt(MODES, r.mode)}</select></label>
        <div class="article-grid-2">
          <label>Lieu${inp("r-place", r.place, 'placeholder="Studio, refuge, local du club…"')}</label>
          <label>Adresse${inp("r-address", r.address, 'placeholder="Adresse complète"')}</label>
        </div>
        ${maps ? `<a class="link small" href="${maps}" target="_blank" rel="noopener">📍 Ouvrir l'adresse dans Maps</a>` : ""}
        <label>Accès, parking, consignes${area("r-access", r.access, 2, "Code, étage, où se garer, tenue…")}</label>
        <label>Venue de l'invité (transport, horaires, repas, défraiement)${area("r-logistics", r.logistics, 2, "Train de 9h12, je le récupère à la gare ; déjeuner offert…")}</label>
        <label>Contact sur place${inp("r-contact", r.contact, 'placeholder="Nom et téléphone"')}</label>`, isOpen("rec", false), r.date ? `<span class="muted small">${fmtDate(r.date)}${r.time ? ` · ${r.time.replace(":", "h")}` : ""}</span>` : "")}

      ${sec("questions", "❓ Questions d'interview", questionsHTML(), isOpen("questions", false), e.questions.length ? `<span class="muted small">${e.questions.filter((q) => q.asked).length}/${e.questions.length} posées</span>` : "")}

      ${sec("before", "✅ Avant le tournage", checklistHTML("before"), isOpen("before", false), `<span class="muted small">${done(e.before)}/${e.before.length}</span>`)}
      ${sec("after", "🎬 Après le tournage", checklistHTML("after"), isOpen("after", false), `<span class="muted small">${done(e.after)}/${e.after.length}</span>`)}

      ${sec("pub", "🎧 Diffusion", `
        <div class="pub-grid ep-rec-grid">
          <label>Date de sortie${inp("p-date", e.pub.date, 'type="date"')}</label>
          <label>Heure${inp("p-time", e.pub.time, 'type="time"')}</label>
          <label>Durée finale${inp("p-duration", e.pub.duration, 'placeholder="48 min"')}</label>
        </div>
        <label>Lien de l'épisode (Spotify…)${inp("p-url", e.pub.url, 'type="url" placeholder="https://open.spotify.com/episode/…"')}</label>
        <label>Notes d'épisode (description, chapitres, liens)${area("showNotes", e.showNotes, 5, "00:00 Intro\n03:12 …")}</label>
        <label>Citations fortes (pour les extraits et les posts)${area("quotes", e.quotes, 3, "Une citation par ligne")}</label>
        <div class="article-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-ep-social>📣 Créer le post réseaux de l'épisode</button>
          <span class="muted small">Crée un contenu « Post » relié, programmé sur LinkedIn à la date de sortie.</span>
        </div>`, isOpen("pub", false))}

      <footer class="editor-foot">
        ${isNew ? "" : `<button type="button" class="link danger" data-ep-delete>Supprimer</button>`}
        <button type="button" class="btn btn-ghost btn-sm" data-ep-print>🖨 Fiche d'interview</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-ep-close>Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </footer>
    </form>`;
  }

  function questionsHTML() {
    const e = ep;
    return `${Object.entries(Q_SECTIONS).map(([k, label]) => {
      const qs = e.questions.map((q, i) => ({ q, i })).filter((x) => x.q.section === k);
      return `<div class="ep-qsec"><p class="eyebrow">${label}</p>
        <ol class="ep-qs">${qs.map(({ q, i }) => `<li class="${q.asked ? "is-asked" : ""}">
          <label class="ep-q"><input type="checkbox" data-ep-asked="${i}" ${q.asked ? "checked" : ""} title="Posée pendant l'interview"><span>${esc(q.t)}</span></label>
          <span class="ep-qtools"><button type="button" class="link small" data-ep-qup="${i}" title="Monter">↑</button><button type="button" class="link small" data-ep-qdown="${i}" title="Descendre">↓</button><button type="button" class="link small danger" data-ep-qdel="${i}" title="Retirer">×</button></span>
        </li>`).join("")}</ol>
        <div class="ep-qadd"><input class="input" data-ep-qnew="${k}" placeholder="Ajouter une question… (Entrée)"><button type="button" class="btn btn-ghost btn-sm" data-ep-qadd="${k}">+</button></div>
      </div>`;
    }).join("")}
    <div class="gen-actions">
      <button type="button" class="btn btn-gen" data-ep-genq>✨ Générer des questions avec Claude</button>
      <span class="muted small">La demande (thème, angle, invité) est copiée et ta conversation Claude s'ouvre : Ctrl+V puis Entrée, puis colle sa réponse ci-dessous.</span>
    </div>
    <label>Coller la réponse de Claude${area("q-paste", "", 3, "=== OUVERTURE ===\n- …")}</label>
    <button type="button" class="btn btn-ghost btn-sm" data-ep-qimport>Ajouter ces questions</button>`;
  }

  function checklistHTML(key) {
    return `<ul class="ep-check">${ep[key].map((c, i) => `<li><label><input type="checkbox" data-ep-check="${key}:${i}" ${c.done ? "checked" : ""}><span>${esc(c.t)}</span></label><button type="button" class="link small danger" data-ep-checkdel="${key}:${i}" title="Retirer">×</button></li>`).join("")}</ul>
      <div class="ep-qadd"><input class="input" data-ep-checknew="${key}" placeholder="Ajouter une étape… (Entrée)"><button type="button" class="btn btn-ghost btn-sm" data-ep-checkadd="${key}">+</button></div>`;
  }

  /* Lit le formulaire dans la copie de travail */
  function read() {
    const f = dlg.querySelector("#ep-form");
    if (!f || !ep) return;
    const v = (n) => f.elements.namedItem(n)?.value ?? "";
    ep.title = v("title").trim();
    ep.number = v("number").trim();
    ep.format = v("format");
    ep.status = v("status");
    ep.pillar = v("pillar");
    ["pitch", "why", "keyPoints", "promise", "refs", "showNotes", "quotes"].forEach((k) => (ep[k] = v(k)));
    ["name", "role", "email", "phone", "social", "status", "contactedAt", "followUp", "bio", "notes"].forEach((k) => (ep.guest[k] = v("g-" + k)));
    ["date", "time", "duration", "mode", "place", "address", "access", "logistics", "contact"].forEach((k) => (ep.rec[k] = v("r-" + k)));
    ["date", "time", "url", "duration"].forEach((k) => (ep.pub[k] = v("p-" + k)));
  }

  /* L'étape avance toute seule quand c'est évident */
  function autoStatus(e) {
    const rank = (s) => EP_ORDER.indexOf(s);
    const up = (s) => { if (rank(s) > rank(e.status)) e.status = s; };
    if (e.status === "idee" && (e.pitch || e.guest.name || e.questions.length)) up("prepa");
    if (["contacte", "relance"].includes(e.guest.status)) up("contact");
    if (e.guest.status === "accepte" && e.rec.date) up("cale");
    if (e.pub.url) up("publie");
  }

  function commit() {
    read();
    if (!ep.title && !ep.pitch) {
      dlg.querySelector('[name="title"]')?.focus();
      toast("Donne au moins un titre ou un angle à l'épisode.", "warn");
      return false;
    }
    autoStatus(ep);
    const eps = list();
    const i = eps.findIndex((x) => x.id === ep.id);
    if (i >= 0) eps[i] = ep;
    else eps.push(ep);
    dlg.close();
    ep = null;
    afterChange();
    return true;
  }

  /* Fiche à imprimer pour l'interview */
  function printSheet() {
    read();
    const e = ep;
    const w = window.open("", "_blank");
    if (!w) return toast("Autorise les fenêtres pour imprimer la fiche.", "warn");
    const qs = Object.entries(Q_SECTIONS).map(([k, l]) => {
      const items = e.questions.filter((q) => q.section === k);
      return items.length ? `<h3>${l}</h3><ol>${items.map((q) => `<li>${esc(q.t)}</li>`).join("")}</ol>` : "";
    }).join("");
    w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>${esc(e.title)} – fiche d'interview</title>
      <style>body{font:15px/1.5 system-ui,sans-serif;max-width:760px;margin:30px auto;padding:0 20px;color:#1d261e}h1{font-size:24px;margin:0 0 4px}h3{margin:22px 0 6px;font-size:15px;text-transform:uppercase;letter-spacing:.08em}li{margin:6px 0}.meta{color:#555}.box{border:1px solid #ccc;border-radius:8px;padding:10px 14px;margin:14px 0}@media print{button{display:none}}</style>
      <button onclick="print()">Imprimer</button>
      <h1>${e.number ? `Ép. ${esc(e.number)} – ` : ""}${esc(e.title)}</h1>
      <p class="meta">${e.guest.name ? `Avec ${esc(e.guest.name)}${e.guest.role ? `, ${esc(e.guest.role)}` : ""} · ` : ""}${e.rec.date ? fmtDate(e.rec.date) : ""}${e.rec.time ? ` ${e.rec.time.replace(":", "h")}` : ""}${e.rec.duration ? ` · ${esc(e.rec.duration)} min` : ""}${e.rec.place ? ` · ${esc(e.rec.place)}` : ""}</p>
      ${e.pitch ? `<div class="box"><strong>Angle :</strong> ${esc(e.pitch)}${e.promise ? `<br><strong>À retenir :</strong> ${esc(e.promise)}` : ""}</div>` : ""}
      ${e.guest.bio ? `<div class="box"><strong>L'invité :</strong> ${esc(e.guest.bio)}</div>` : ""}
      ${e.keyPoints ? `<div class="box"><strong>Points à couvrir :</strong><br>${esc(e.keyPoints).replace(/\n/g, "<br>")}</div>` : ""}
      ${qs || "<p>(Pas encore de questions.)</p>"}`);
    w.document.close();
  }

  /* --- Évènements --- */
  dlg.addEventListener("click", (evt) => {
    const b = evt.target.closest("button, a[data-ep-mail]");
    if (evt.target === dlg) { dlg.close(); return; }
    if (!b || !ep) return;
    const d = b.dataset;
    if ("epClose" in d) { dlg.close(); return; }
    if (d.epMail) {
      read();
      const g = ep.guest;
      if ((d.epMail === "demande" || d.epMail === "relance") && !["accepte", "refuse"].includes(g.status)) {
        g.status = d.epMail === "demande" ? "contacte" : "relance";
        g.contactedAt = g.contactedAt || today();
        const n = new Date(); n.setDate(n.getDate() + 7);
        g.followUp = n.toISOString().slice(0, 10);
        autoStatus(ep);
      }
      // le mail reprend ce qui vient d'être tapé (nom, e-mail, date…)
      b.href = mailtoHref(g.email, mailTemplates(ep)[d.epMail]);
      if (!g.email) toast("Pas d'e-mail pour l'invité : le mail s'ouvre sans destinataire.", "warn");
      setTimeout(render, 50); // le lien mailto: part d'abord
      return;
    }
    if (d.epCopymail) {
      read();
      const m = mailTemplates(ep)[d.epCopymail];
      copyText(`${m.subject}\n\n${m.body}`).then(() => toast("Texte copié : colle-le dans ton message."), () => toast("Copie impossible.", "warn"));
      return;
    }
    if (d.epQadd) return addQuestion(d.epQadd);
    if (d.epQdel != null) { read(); ep.questions.splice(+d.epQdel, 1); return render(); }
    if (d.epQup != null || d.epQdown != null) {
      read();
      const i = +(d.epQup ?? d.epQdown);
      const sec = ep.questions[i].section;
      const same = ep.questions.map((q, j) => ({ q, j })).filter((x) => x.q.section === sec).map((x) => x.j);
      const k = same.indexOf(i) + (d.epQup != null ? -1 : 1);
      if (k < 0 || k >= same.length) return;
      const j = same[k];
      [ep.questions[i], ep.questions[j]] = [ep.questions[j], ep.questions[i]];
      return render();
    }
    if ("epGenq" in d) {
      read();
      const prompt = questionsPrompt(ep);
      copyText(prompt).then(
        () => { window.open(redacUrl, redacTarget); toast("Demande copiée : dans Claude, Ctrl+V puis Entrée. Colle ensuite sa réponse dans le cadre sous le bouton."); },
        () => toast("Copie impossible.", "warn"),
      );
      return;
    }
    if ("epQimport" in d) {
      read();
      const raw = dlg.querySelector('[name="q-paste"]')?.value || "";
      const qs = parseQuestions(raw);
      if (!qs.length) return toast("Aucune question trouvée : colle la réponse de Claude (une question par ligne commençant par « - »).", "warn");
      ep.questions.push(...qs.map((q) => ({ ...q, asked: false })));
      autoStatus(ep);
      toast(`${qs.length} questions ajoutées.`);
      return render();
    }
    if (d.epCheckadd) return addCheck(d.epCheckadd);
    if (d.epCheckdel) { read(); const [k, i] = d.epCheckdel.split(":"); ep[k].splice(+i, 1); return render(); }
    if ("epSocial" in d) {
      read();
      createSocialPost(ep);
      return;
    }
    if ("epPrint" in d) return printSheet();
    if ("epDelete" in d) {
      if (!confirm(`Supprimer l'épisode « ${ep.title || "sans titre"} » ?`)) return;
      const s = getState();
      s.episodes = list().filter((x) => x.id !== ep.id);
      dlg.close();
      ep = null;
      afterChange();
    }
  });
  dlg.addEventListener("change", (evt) => {
    const d = evt.target.dataset;
    if (d.epAsked != null) { read(); ep.questions[+d.epAsked].asked = evt.target.checked; evt.target.closest("li")?.classList.toggle("is-asked", evt.target.checked); }
    if (d.epCheck) { read(); const [k, i] = d.epCheck.split(":"); ep[k][+i].done = evt.target.checked; }
  });
  dlg.addEventListener("keydown", (evt) => {
    if (evt.key !== "Enter") return;
    const d = evt.target.dataset || {};
    if (d.epQnew) { evt.preventDefault(); addQuestion(d.epQnew); }
    if (d.epChecknew) { evt.preventDefault(); addCheck(d.epChecknew); }
  });
  dlg.addEventListener("submit", (evt) => { evt.preventDefault(); commit(); });
  dlg.addEventListener("close", () => { ep = null; });

  function addQuestion(section) {
    read();
    const inpEl = dlg.querySelector(`[data-ep-qnew="${section}"]`);
    const t = inpEl?.value.trim();
    if (!t) return;
    ep.questions.push({ section, t, asked: false });
    render();
    dlg.querySelector(`[data-ep-qnew="${section}"]`)?.focus();
  }
  function addCheck(key) {
    read();
    const t = dlg.querySelector(`[data-ep-checknew="${key}"]`)?.value.trim();
    if (!t) return;
    ep[key].push({ t, done: false });
    render();
    dlg.querySelector(`[data-ep-checknew="${key}"]`)?.focus();
  }

  /* Vue : idée rapide, ouverture, glisser d'une colonne à l'autre */
  document.addEventListener("submit", (evt) => {
    const f = evt.target.closest("[data-ep-quick]");
    if (!f) return;
    evt.preventDefault();
    const t = f.elements.namedItem("idea").value.trim();
    if (!t) return;
    list().push(newEpisode(uid, today, { title: t }));
    afterChange();
    toast("Idée d'épisode ajoutée.");
    document.querySelector("[data-ep-quick] input")?.focus();
  });
  document.addEventListener("click", (evt) => {
    const b = evt.target.closest("[data-ep-open], [data-ep-new]");
    if (!b || dlg.contains(b)) return;
    if (b.dataset.epOpen) open(b.dataset.epOpen);
    else open(null);
  });
  document.addEventListener("dragstart", (evt) => {
    const c = evt.target.closest?.(".ep-card");
    if (c) evt.dataTransfer.setData("text/x-episode", c.dataset.ep);
  });
  document.addEventListener("dragover", (evt) => {
    const col = evt.target.closest?.("[data-ep-col]");
    if (col && [...evt.dataTransfer.types].includes("text/x-episode")) { evt.preventDefault(); col.classList.add("is-drop"); }
  });
  document.addEventListener("dragleave", (evt) => evt.target.closest?.("[data-ep-col]")?.classList.remove("is-drop"));
  document.addEventListener("drop", (evt) => {
    const col = evt.target.closest?.("[data-ep-col]");
    const id = evt.dataTransfer?.getData("text/x-episode");
    if (!col || !id) return;
    evt.preventDefault();
    col.classList.remove("is-drop");
    const e = list().find((x) => x.id === id);
    if (e && e.status !== col.dataset.epCol) { e.status = col.dataset.epCol; afterChange(); }
  });

  /* Pour le Planning : tournages, sorties et relances du jour */
  function planningChips(day) {
    const out = [];
    list().forEach((e) => {
      const t = esc(e.title || "Épisode");
      if (e.rec.date === day) out.push(`<button type="button" class="pod-chip" data-ep-open="${e.id}" title="Tournage podcast : ${t}"><span aria-hidden="true">🎙</span><span class="pub-title">${t}</span></button>`);
      if (e.pub.date === day) out.push(`<button type="button" class="pod-chip ${e.status === "publie" ? "is-done" : ""}" data-ep-open="${e.id}" title="Sortie de l'épisode : ${t}"><span aria-hidden="true">🎧</span><span class="pub-title">${t}</span></button>`);
      if (e.guest.followUp === day && ["contacte", "relance"].includes(e.guest.status)) out.push(`<button type="button" class="pod-chip" data-ep-open="${e.id}" title="Relancer ${esc(e.guest.name)}"><span aria-hidden="true">✉️</span><span class="pub-title">Relancer ${esc(e.guest.name || "l'invité")}</span></button>`);
    });
    return out.join("");
  }

  return { renderView, open, planningChips };
}
