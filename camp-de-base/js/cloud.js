/* =========================================================
   Camp de base. Synchronisation entre appareils
   Les données restent dans le navigateur (pour marcher hors ligne)
   et sont recopiées en ligne quelques secondes après chaque modification.
   À l'ouverture et au retour sur l'onglet, on récupère la version en ligne.
   En cas de modifications des deux côtés, on fusionne élément par élément
   (rien n'est perdu : ce qui existe d'un seul côté est gardé).
   ========================================================= */

const ARRAYS = ["contents", "pubs", "tasks", "notes", "siteStats", "audience"];

/* Les photos pas encore publiées (images intégrées) restent sur l'appareil : trop lourdes pour la synchro */
function slim(state) {
  const copy = JSON.parse(JSON.stringify(state));
  (copy.contents || []).forEach((c) => {
    if (c.article?.photo?.data) delete c.article.photo.data;
  });
  return copy;
}

/* Fusion : les éléments présents d'un seul côté sont gardés ; pour un même élément,
   la version locale l'emporte, sauf pour un appareil qui se synchronise pour la première fois
   (ses données sont peut-être anciennes : c'est alors la version en ligne qui l'emporte). */
export function mergeStates(local, remote, { preferRemote = false } = {}) {
  const out = preferRemote
    ? { ...local, ...remote, settings: { ...(local.settings || {}), ...(remote.settings || {}) } }
    : { ...remote, ...local, settings: { ...(remote.settings || {}), ...(local.settings || {}) } };
  ARRAYS.forEach((k) => {
    const byId = new Map();
    (remote[k] || []).forEach((x) => byId.set(x.id, x));
    (local[k] || []).forEach((x) => {
      const r = byId.get(x.id);
      if (r && preferRemote) return;
      // garder une photo locale pas encore synchronisée
      byId.set(x.id, r && k === "contents" && r.article && x.article && !x.article.photo?.data && r.article.photo?.data ? { ...x, article: { ...x.article, photo: r.article.photo } } : x);
    });
    out[k] = [...byId.values()];
  });
  out.seenBadges = [...new Set([...(remote.seenBadges || []), ...(local.seenBadges || [])])];
  return out;
}

export function createCloud({ storeKey, getState, setState, storedCode, askCode, rememberCode, onStatus }) {
  const metaKey = storeKey + ":cloud";
  let meta = { version: 0, dirty: true, known: false };
  try { meta = { ...meta, ...JSON.parse(localStorage.getItem(metaKey) || "{}") }; } catch (e) { /* rien */ }
  const saveMeta = () => { try { localStorage.setItem(metaKey, JSON.stringify(meta)); } catch (e) { /* rien */ } };

  let status = "off";
  let timer = null;
  let busy = false;
  let pendingPush = false;
  let enabled = true;
  let emptyOnline = false; // rien en ligne : on attend que l'utilisateur choisisse l'appareil de référence
  const setStatus = (s, info = "") => { status = s; onStatus?.(s, info); };

  /* Le code n'est demandé que si la synchro est configurée en ligne et qu'aucun code valide n'est connu */
  async function call(method, body, code = storedCode(), asked = false) {
    const r = await fetch("/api/camp/data", {
      method,
      headers: { "content-type": "application/json", "x-camp-code": code || "" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (r.status === 404) return { configured: false, missing: [] };
    const j = await r.json().catch(() => ({ error: `Erreur ${r.status}` }));
    if (j.badCode) {
      rememberCode(code, false);
      if (!asked) {
        const c = askCode();
        if (c) return call(method, body, c, true);
      }
      return { status: r.status, ...j };
    }
    if (code && j.configured) rememberCode(code, true);
    return { status: r.status, ...j };
  }

  async function push() {
    if (!enabled) return;
    if (busy) { pendingPush = true; return; }
    busy = true;
    setStatus("saving");
    try {
      let res = await call("PUT", { baseVersion: meta.version, data: slim(getState()) });
      if (res.conflict) {
        // Un autre appareil a enregistré : on fusionne puis on renvoie
        setState(mergeStates(getState(), res.data || {}, { preferRemote: !meta.version }));
        meta.version = res.version;
        res = await call("PUT", { baseVersion: meta.version, data: slim(getState()) });
      }
      handle(res, () => {
        meta.version = res.version;
        meta.dirty = false;
        meta.known = true;
        saveMeta();
        setStatus("ok", res.updatedAt);
      });
    } catch (e) {
      setStatus("offline");
    } finally {
      busy = false;
      if (pendingPush) { pendingPush = false; push(); }
    }
  }

  function handle(res, ok) {
    if (res.skipped) return setStatus("nocode");
    if (res.configured === false) { enabled = false; return setStatus("off", (res.missing || []).join(", ")); }
    if (res.badCode) return setStatus("badcode");
    if (res.error) return setStatus("error", res.error);
    ok();
  }

  /* Récupère la version en ligne ; renvoie true si les données locales ont changé */
  async function pull() {
    if (!enabled || busy) return false;
    busy = true;
    let changed = false;
    try {
      const res = await call("GET");
      handle(res, () => {
        meta.known = true;
        emptyOnline = false;
        if (!res.data) {
          // Rien en ligne : on ne choisit pas à la place de l'utilisateur quel appareil fait référence
          emptyOnline = true;
          setStatus("empty");
        } else if (res.version !== meta.version) {
          const firstTime = !meta.version;
          const merged = meta.dirty ? mergeStates(getState(), res.data, { preferRemote: firstTime }) : { ...res.data };
          // garder les photos locales non publiées
          if (!meta.dirty) {
            const localPhotos = new Map(getState().contents.filter((c) => c.article?.photo?.data).map((c) => [c.id, c.article.photo]));
            merged.contents.forEach((c) => { if (localPhotos.has(c.id) && c.article) c.article.photo = localPhotos.get(c.id); });
          }
          setState(merged);
          changed = true;
          meta.version = res.version;
          if (meta.dirty) setTimeout(push, 0);
          else setStatus("ok", res.updatedAt);
        } else {
          setStatus("ok", res.updatedAt);
          if (meta.dirty) setTimeout(push, 0);
        }
        saveMeta();
      });
    } catch (e) {
      setStatus("offline");
    } finally {
      busy = false;
    }
    return changed;
  }

  /* À appeler après chaque enregistrement local */
  function touched() {
    meta.dirty = true;
    saveMeta();
    if (!enabled || emptyOnline) return;
    clearTimeout(timer);
    timer = setTimeout(push, 2500);
  }

  function retry() {
    enabled = true;
    return pull();
  }

  /* Première mise en ligne : cet appareil devient la référence */
  async function initialize() {
    emptyOnline = false;
    meta.dirty = true;
    await push();
  }

  return { pull, push, touched, retry, initialize, get status() { return status; } };
}
