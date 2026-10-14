/* =========================================================
   Camp de base. Scène 3D : la montagne, le sentier, les balises
   Chaque contenu est une balise le long du sentier (ordre chronologique).
   Le coureur se tient sur la dernière balise publiée ; le sommet est l'objectif.
   ========================================================= */

import * as THREE from "../vendor/three.module.js";

const COLORS = {
  sky: 0xeee6d4,
  ground: 0xb7bd9f,
  forest: 0x3d4d33,
  forestLight: 0x5b6b45,
  dark: 0x1d261e,
  lime: 0x9faf6b,
  limeDeep: 0x6f8436,
  sand: 0xd7c9ac,
  stone: 0x9a9384,
  snow: 0xf7f4ec,
  trail: 0x8a6f4a,
  trailDone: 0x6f8436,
};

const STATE_STYLE = {
  publie: { flag: 0x9faf6b, pole: 0x1d261e },
  programme: { flag: 0xf7f4ec, pole: 0x1d261e },
  pret: { cairn: 0xd7c9ac },
  redaction: { cairn: 0xa9a28f },
  idee: { orb: 0xf7f4ec },
};

/* ---------- Relief ---------- */

function heightAt(x, z) {
  const r2 = x * x + z * z;
  let h = 40 * Math.exp(-r2 / (2 * 28 * 28));
  h += 15 * Math.exp(-((x - 48) ** 2 + (z + 34) ** 2) / (2 * 15 * 15));
  h += 11 * Math.exp(-((x + 54) ** 2 + (z - 40) ** 2) / (2 * 13 * 13));
  h += 8 * Math.exp(-((x + 30) ** 2 + (z + 62) ** 2) / (2 * 12 * 12));
  h += 1.5 * Math.sin(x * 0.16) * Math.cos(z * 0.14);
  h += 0.8 * Math.sin(x * 0.33 + z * 0.29);
  return h;
}

function terrainColor(h, jitter) {
  const c = new THREE.Color();
  if (h < 6) c.setHex(0xaab38f);
  else if (h < 14) c.setHex(0x93a079);
  else if (h < 24) c.setHex(0xa59c86);
  else if (h < 32) c.setHex(0x8f897b);
  else c.setHex(COLORS.snow);
  c.offsetHSL(0, 0, jitter);
  return c;
}

function buildTerrain() {
  const size = 220;
  const seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  const flat = geo.toNonIndexed();
  const p = flat.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    const h = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const c = terrainColor(h, (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.035);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  flat.computeVertexNormals();
  const mesh = new THREE.Mesh(
    flat,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  );
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------- Sentier ---------- */

function buildTrailCurve() {
  const pts = [];
  const turns = 2.6;
  const steps = 260;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = -Math.PI * 0.35 + t * turns * Math.PI * 2;
    const r = 72 * (1 - t) ** 0.9 + 1.5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.35, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function tubeBetween(curve, t0, t1, radius, color) {
  const pts = [];
  const n = Math.max(2, Math.round((t1 - t0) * 500));
  for (let i = 0; i <= n; i++) pts.push(curve.getPointAt(t0 + ((t1 - t0) * i) / n));
  const sub = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(
    new THREE.TubeGeometry(sub, n * 2, radius, 6, false),
    new THREE.MeshLambertMaterial({ color })
  );
}

/* ---------- Décor ---------- */

function buildForest(curve) {
  const trailPts = curve.getSpacedPoints(300);
  const cone = new THREE.ConeGeometry(1, 2.6, 6);
  cone.translate(0, 1.3, 0);
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const count = 420;
  const mesh = new THREE.InstancedMesh(cone, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let placed = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let tries = 0; tries < 6000 && placed < count; tries++) {
    const x = (rnd() - 0.5) * 210;
    const z = (rnd() - 0.5) * 210;
    const h = heightAt(x, z);
    if (h > 17 || h < 1.2) continue;
    let near = false;
    for (let i = 0; i < trailPts.length; i += 2) {
      const tp = trailPts[i];
      if ((tp.x - x) ** 2 + (tp.z - z) ** 2 < 20) { near = true; break; }
    }
    if (near) continue;
    const k = 0.7 + rnd() * 0.9;
    s.set(k, k * (0.9 + rnd() * 0.5), k);
    m.compose(new THREE.Vector3(x, h - 0.2, z), q, s);
    mesh.setMatrixAt(placed, m);
    c.setHex(rnd() > 0.5 ? COLORS.forest : COLORS.forestLight);
    mesh.setColorAt(placed, c);
    placed++;
  }
  mesh.count = placed;
  mesh.castShadow = true;
  return mesh;
}

function buildClouds() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 });
  const geo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(geo, mat);
      const k = 2.2 + ((i * 7 + j * 3) % 5) * 0.6;
      puff.scale.set(k * 1.4, k * 0.8, k);
      puff.position.set(j * 2.6 - puffs, (j % 2) * 0.8, ((j * 5) % 3) - 1);
      cloud.add(puff);
    }
    const a = (i / 9) * Math.PI * 2;
    const r = 55 + (i % 3) * 18;
    cloud.position.set(Math.cos(a) * r, 46 + (i % 4) * 5, Math.sin(a) * r);
    cloud.userData.speed = 0.012 + (i % 3) * 0.006;
    cloud.userData.angle = a;
    cloud.userData.radius = r;
    group.add(cloud);
  }
  return group;
}

function buildRunner() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.8, 4, 8),
    new THREE.MeshLambertMaterial({ color: COLORS.lime })
  );
  body.position.y = 1;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8c9a4 })
  );
  head.position.y = 1.95;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.14, 12),
    new THREE.MeshLambertMaterial({ color: COLORS.dark })
  );
  cap.position.y = 2.18;
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.7, 0.32),
    new THREE.MeshLambertMaterial({ color: COLORS.dark })
  );
  bag.position.set(0, 1.1, -0.42);
  const bib = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  bib.position.set(0, 1.08, 0.43);
  g.add(body, head, cap, bag, bib);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.2, 32),
    new THREE.MeshBasicMaterial({ color: COLORS.lime, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.06;
  g.add(halo);
  g.userData.halo = halo;
  g.scale.setScalar(1.9);
  return g;
}

function flagMesh(color, w = 1.6, h = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, -h / 2);
  shape.lineTo(0, -h);
  shape.lineTo(0, 0);
  return new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  );
}

function buildMarker(item) {
  const g = new THREE.Group();
  const st = item.state;
  if (st === "publie" || st === "programme") {
    const style = STATE_STYLE[st];
    const poleH = st === "publie" ? 3.4 : 2.8;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, poleH, 6),
      new THREE.MeshLambertMaterial({ color: style.pole })
    );
    pole.position.y = poleH / 2;
    const flag = flagMesh(style.flag);
    flag.position.y = poleH;
    g.add(pole, flag);
    g.userData.flag = flag;
    if (st === "programme") {
      const stripe = flagMesh(COLORS.dark, 0.8, 0.5);
      stripe.position.set(0, poleH - 0.25, 0.01);
      g.add(stripe);
    }
    // Une petite pierre colorée par réseau sur lequel le contenu est publié / prévu
    (item.networks || []).forEach((col, i) => {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshLambertMaterial({ color: col, flatShading: true })
      );
      const a = (i / Math.max(1, item.networks.length)) * Math.PI * 2;
      gem.position.set(Math.cos(a) * 0.75, 0.3, Math.sin(a) * 0.75);
      g.add(gem);
    });
  } else if (st === "pret" || st === "redaction") {
    const color = STATE_STYLE[st].cairn;
    const n = st === "pret" ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.62 - i * 0.11, 0),
        new THREE.MeshLambertMaterial({ color, flatShading: true })
      );
      stone.position.y = 0.35 + i * 0.62;
      stone.rotation.y = i * 0.9;
      stone.scale.y = 0.7;
      g.add(stone);
    }
  } else {
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshLambertMaterial({ color: STATE_STYLE.idee.orb, transparent: true, opacity: 0.75, flatShading: true })
    );
    orb.position.y = 1.2;
    g.add(orb);
    g.userData.orb = orb;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // Zone cliquable plus large que la balise
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.4;
  hit.userData.itemId = item.id;
  g.add(hit);
  g.userData.hit = hit;
  return g;
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
}

/* ---------- Scène ---------- */

export function createScene(container, { onSelect, onHover } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.sky, 170, 420);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 800);

  scene.add(new THREE.HemisphereLight(0xfff8ea, 0x6b7356, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 260 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const base = new THREE.Mesh(
    new THREE.CircleGeometry(400, 48),
    new THREE.MeshLambertMaterial({ color: 0xaab38f })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.4;
  scene.add(base);

  const terrain = buildTerrain();
  scene.add(terrain);
  const curve = buildTrailCurve();
  scene.add(buildForest(curve));
  const clouds = buildClouds();
  scene.add(clouds);

  // Drapeau du sommet : l'objectif
  const summit = new THREE.Group();
  const sp = curve.getPointAt(1);
  const sPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), new THREE.MeshLambertMaterial({ color: COLORS.dark }));
  sPole.position.y = 3;
  const sFlag = flagMesh(COLORS.dark, 3, 1.8);
  sFlag.position.y = 6;
  summit.add(sPole, sFlag);
  summit.position.copy(sp);
  scene.add(summit);

  const runner = buildRunner();
  scene.add(runner);

  let trailGroup = new THREE.Group();
  scene.add(trailGroup);
  let markers = new THREE.Group();
  scene.add(markers);
  const markerById = new Map();
  let itemT = [];

  let avatarT = 0.02;
  let avatarTarget = 0.02;

  /* --- Caméra orbitale maison --- */
  const target = new THREE.Vector3(0, 14, 0);
  const targetGoal = target.clone();
  const sph = { theta: 0.9, phi: 1.02, radius: 150 };
  const sphGoal = { ...sph };
  let lastInteraction = 0;

  function updateCamera() {
    camera.position.set(
      target.x + sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta),
      target.y + sph.radius * Math.cos(sph.phi),
      target.z + sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta)
    );
    camera.lookAt(target);
  }

  const pointers = new Map();
  let dragStart = null;
  let pinchDist = 0;
  const el = renderer.domElement;
  el.style.touchAction = "none";

  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragStart = { x: e.clientX, y: e.clientY, moved: 0 };
    lastInteraction = performance.now();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  el.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) {
      hoverAt(e.clientX, e.clientY);
      return;
    }
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInteraction = performance.now();
    if (dragStart) dragStart.moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) sphGoal.radius = THREE.MathUtils.clamp(sphGoal.radius * (pinchDist / d), 22, 260);
      pinchDist = d;
      return;
    }
    sphGoal.theta += dx * 0.006;
    sphGoal.phi = THREE.MathUtils.clamp(sphGoal.phi - dy * 0.005, 0.25, 1.45);
  });
  const endPointer = (e) => {
    const wasClick = dragStart && dragStart.moved < 6 && pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (wasClick && e.type === "pointerup") {
      const id = pick(e.clientX, e.clientY);
      if (id && onSelect) onSelect(id);
    }
    if (pointers.size === 0) dragStart = null;
  };
  el.addEventListener("pointerup", endPointer);
  el.addEventListener("pointercancel", endPointer);
  el.addEventListener("pointerleave", () => onHover && onHover(null));
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      lastInteraction = performance.now();
      sphGoal.radius = THREE.MathUtils.clamp(sphGoal.radius * (1 + Math.sign(e.deltaY) * 0.1), 22, 260);
    },
    { passive: false }
  );

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(cx, cy) {
    const r = el.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(markers.children.map((m) => m.userData.hit), false);
    return hits.length ? hits[0].object.userData.itemId : null;
  }
  let hovered = null;
  function hoverAt(cx, cy) {
    const id = pick(cx, cy);
    el.style.cursor = id ? "pointer" : "grab";
    if (id !== hovered) {
      hovered = id;
      if (onHover) onHover(id ? { id, x: cx, y: cy } : null);
    } else if (id && onHover) {
      onHover({ id, x: cx, y: cy });
    }
  }

  /* --- Particules de fête --- */
  const bursts = [];
  function celebrateAt(pos) {
    if (reducedMotion) return;
    const n = 160;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const palette = [0x9faf6b, 0xd7c9ac, 0x1f6fb2, 0xc23d6e, 0xb8761a, 0xffffff].map((h) => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      p.set([pos.x, pos.y + 2, pos.z], i * 3);
      const c = palette[i % palette.length];
      col.set([c.r, c.g, c.b], i * 3);
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 8;
      vel.push(new THREE.Vector3(Math.cos(a) * s * 0.5, 7 + Math.random() * 9, Math.sin(a) * s * 0.5));
    }
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true }));
    scene.add(pts);
    bursts.push({ pts, vel, life: 0 });
  }

  /* --- API --- */
  function setItems(items, avatarIndex) {
    scene.remove(markers);
    disposeTree(markers);
    markers = new THREE.Group();
    markerById.clear();
    scene.add(markers);
    const n = items.length;
    itemT = items.map((_, i) => 0.03 + (0.92 * (i + 0.5)) / Math.max(n, 1));
    items.forEach((item, i) => {
      const m = buildMarker(item);
      const t = itemT[i];
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(2.2);
      m.position.copy(p).add(side);
      m.position.y = heightAt(m.position.x, m.position.z);
      m.scale.setScalar(1.8);
      m.userData.t = t;
      m.userData.phase = i * 0.7;
      markers.add(m);
      markerById.set(item.id, m);
    });

    const tAv = avatarIndex >= 0 ? itemT[avatarIndex] : 0.015;
    avatarTarget = tAv;

    scene.remove(trailGroup);
    disposeTree(trailGroup);
    trailGroup = new THREE.Group();
    if (tAv > 0.02) trailGroup.add(tubeBetween(curve, 0, tAv, 0.42, COLORS.trailDone));
    trailGroup.add(tubeBetween(curve, Math.max(0, tAv - 0.002), 1, 0.3, COLORS.trail));
    trailGroup.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    scene.add(trailGroup);
  }

  function focus(id) {
    const m = markerById.get(id);
    if (!m) return;
    targetGoal.copy(m.position).add(new THREE.Vector3(0, 2, 0));
    sphGoal.radius = 42;
    sphGoal.phi = 0.95;
    lastInteraction = performance.now();
  }
  function focusRunner() {
    targetGoal.copy(runner.position).add(new THREE.Vector3(0, 2, 0));
    sphGoal.radius = 46;
    lastInteraction = performance.now();
  }
  const overviewRadius = () => (camera.aspect < 0.8 ? 205 : 128);
  function overview() {
    targetGoal.set(0, 14, 0);
    sphGoal.radius = overviewRadius();
    sphGoal.phi = 1.02;
  }
  function celebrate(id) {
    const m = markerById.get(id);
    celebrateAt(m ? m.position : runner.position);
  }

  /* --- Boucle --- */
  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();
  sph.radius = sphGoal.radius = overviewRadius();

  const timer = new THREE.Timer();
  let running = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const time = timer.getElapsed();

    const idle = performance.now() - lastInteraction > 6000;
    if (idle && !reducedMotion) sphGoal.theta += dt * 0.04;
    const k = 1 - Math.pow(0.002, dt);
    sph.theta += (sphGoal.theta - sph.theta) * k;
    sph.phi += (sphGoal.phi - sph.phi) * k;
    sph.radius += (sphGoal.radius - sph.radius) * k;
    target.lerp(targetGoal, k);
    updateCamera();

    // Le coureur avance doucement vers sa balise
    avatarT += (avatarTarget - avatarT) * (reducedMotion ? 1 : Math.min(1, dt * 1.4));
    const ap = curve.getPointAt(THREE.MathUtils.clamp(avatarT, 0, 1));
    const look = curve.getPointAt(THREE.MathUtils.clamp(avatarT + 0.01, 0, 1));
    runner.position.set(ap.x, ap.y - 0.3 + (reducedMotion ? 0 : Math.abs(Math.sin(time * 4)) * 0.18), ap.z);
    runner.lookAt(look.x, runner.position.y, look.z);
    runner.userData.halo.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(time * 2.5) * 0.12));

    if (!reducedMotion) {
      markers.children.forEach((m) => {
        if (m.userData.flag) m.userData.flag.rotation.y = Math.sin(time * 2 + m.userData.phase) * 0.35;
        if (m.userData.orb) m.userData.orb.position.y = 1.2 + Math.sin(time * 1.6 + m.userData.phase) * 0.22;
      });
      sFlag.rotation.y = Math.sin(time * 1.4) * 0.3;
      clouds.children.forEach((c) => {
        c.userData.angle += dt * c.userData.speed;
        c.position.x = Math.cos(c.userData.angle) * c.userData.radius;
        c.position.z = Math.sin(c.userData.angle) * c.userData.radius;
      });
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life += dt;
      const pos = b.pts.geometry.attributes.position;
      for (let j = 0; j < b.vel.length; j++) {
        b.vel[j].y -= 14 * dt;
        pos.setXYZ(j, pos.getX(j) + b.vel[j].x * dt, pos.getY(j) + b.vel[j].y * dt, pos.getZ(j) + b.vel[j].z * dt);
      }
      pos.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.life / 2.2);
      if (b.life > 2.2) {
        scene.remove(b.pts);
        disposeTree(b.pts);
        bursts.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }
  frame();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; timer.reset?.(); frame(); }
  });

  return { setItems, focus, focusRunner, overview, celebrate, resize };
}
