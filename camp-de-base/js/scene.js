/* =========================================================
   Camp de base. Scène 3D : la montagne, le sentier, les balises
   Chaque contenu est une balise le long du sentier (ordre chronologique).
   Le coureur se tient sur la dernière balise publiée ; le sommet est l'objectif.
   ========================================================= */

import * as THREE from "../vendor/three.module.js";

const COLORS = {
  skyTop: 0xbfd0cf,
  horizon: 0xf1e9d8,
  dark: 0x1d261e,
  lime: 0x9faf6b,
  limeDeep: 0x6f8436,
  sand: 0xd7c9ac,
  snow: 0xf6f3ec,
  trail: 0xdccaa2,
  trailEdge: 0xb5a07a,
  trailDone: 0x8ea05a,
  trailDoneEdge: 0x5d7a1c,
  water: 0x9db8b6,
};

const STATE_STYLE = {
  publie: { flag: 0x9faf6b, pole: 0x1d261e },
  programme: { flag: 0xfbf8f1, pole: 0x1d261e },
  pret: { cairn: 0xd7c9ac },
  redaction: { cairn: 0xb3ab98 },
  idee: { orb: 0xfdfbf5 },
};

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });

/* ---------- Bruit doux (relief et couleurs) ---------- */

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    s += a * vnoise(x * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));

/* ---------- Relief ---------- */

const LAKE = { x: -80, z: -18, r: 10, level: 0.2 };

function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  // Sommet principal, légèrement nervuré
  let h = 42 * Math.exp(-((r / 31) ** 1.8)) * (1 + 0.07 * Math.sin(ang * 3 + r * 0.06) * smooth(4, 14, r));
  // Montagnes voisines
  h += 16 * gauss(x, z, 48, -34, 15);
  h += 12 * gauss(x, z, -54, 40, 13);
  h += 9 * gauss(x, z, -30, -62, 12);
  // Collines douces
  h += (fbm(x * 0.03 + 3.1, z * 0.03 - 1.7) - 0.45) * 7 * (1 - 0.8 * Math.exp(-((r / 22) ** 2)));
  // Lac
  h -= 5 * gauss(x, z, LAKE.x, LAKE.z, LAKE.r * 0.9);
  // Chaîne de montagnes à l'horizon
  const ring = smooth(115, 190, r);
  if (ring > 0) h += ring * (18 + 42 * fbm(Math.cos(ang) * 2.2 + 9, Math.sin(ang) * 2.2 + 4));
  return h;
}

const C = {
  meadowLow: new THREE.Color(0xb3b98f),
  meadow: new THREE.Color(0x97a571),
  meadowDark: new THREE.Color(0x7f8f5e),
  rock: new THREE.Color(0x9a958a),
  rockDark: new THREE.Color(0x7f7b71),
  snow: new THREE.Color(COLORS.snow),
  sand: new THREE.Color(0xd8cdb2),
};

function buildTerrain() {
  const size = 440;
  const seg = 260;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = pos.getY(i);
    const ny = nrm.getY(i);
    const n = fbm(x * 0.08, z * 0.08);
    c.copy(C.meadowLow).lerp(C.meadow, smooth(1, 10, h + (n - 0.5) * 6));
    c.lerp(C.meadowDark, smooth(0.45, 0.75, fbm(x * 0.04 + 7, z * 0.04)) * 0.5);
    const rockAmt = Math.max(smooth(13, 22, h + (n - 0.5) * 8), smooth(0.86, 0.7, ny));
    tmp.copy(C.rock).lerp(C.rockDark, n);
    c.lerp(tmp, rockAmt);
    const snowAmt = smooth(32, 37, h + (n - 0.5) * 8) * smooth(0.45, 0.65, ny);
    c.lerp(C.snow, snowAmt);
    // Berge du lac
    c.lerp(C.sand, smooth(0.2, -0.6, h - LAKE.level) * 0.7);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.96 }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildLake() {
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.r * 1.6, 48),
    mat(COLORS.water, { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 })
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(LAKE.x, LAKE.level, LAKE.z);
  lake.receiveShadow = true;
  return lake;
}

function buildSky() {
  const geo = new THREE.SphereGeometry(700, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(COLORS.skyTop) },
      horizon: { value: new THREE.Color(COLORS.horizon) },
    },
    vertexShader: "varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 horizon; varying vec3 vPos; void main(){ float t = smoothstep(-0.02, 0.55, vPos.y); gl_FragColor = vec4(mix(horizon, top, t), 1.0);\n#include <colorspace_fragment>\n}",
  });
  const sky = new THREE.Mesh(geo, material);
  sky.renderOrder = -1;
  return sky;
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

/* Ruban posé sur le relief (plus net qu'un tube) */
function ribbon(curve, t0, t1, width, color, lift, order) {
  const n = Math.max(2, Math.round((t1 - t0) * 900));
  const verts = new Float32Array((n + 1) * 2 * 3);
  const idx = [];
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tan);
    const sx = -tan.z;
    const sz = tan.x;
    const len = Math.hypot(sx, sz) || 1;
    for (let k = 0; k < 2; k++) {
      const sgn = k ? 1 : -1;
      const x = p.x + (sx / len) * width * 0.5 * sgn;
      const z = p.z + (sz / len) * width * 0.5 * sgn;
      verts.set([x, heightAt(x, z) + lift, z], (i * 2 + k) * 3);
    }
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat(color, { roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 - order, polygonOffsetUnits: -2 - order }));
  mesh.receiveShadow = true;
  mesh.renderOrder = order;
  return mesh;
}

/* ---------- Décor ---------- */

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function farFromTrail(trailPts, x, z, d2) {
  for (let i = 0; i < trailPts.length; i += 2) {
    const tp = trailPts[i];
    if ((tp.x - x) ** 2 + (tp.z - z) ** 2 < d2) return false;
  }
  return true;
}

function buildForest(curve) {
  const group = new THREE.Group();
  const trailPts = curve.getSpacedPoints(300);
  const rnd = seeded(7);
  const spots = [];
  for (let tries = 0; tries < 9000 && spots.length < 520; tries++) {
    const x = (rnd() - 0.5) * 240;
    const z = (rnd() - 0.5) * 240;
    const h = heightAt(x, z);
    if (h > 18 || h < 1.2) continue;
    // Bosquets : plus dense là où le bruit est élevé
    if (fbm(x * 0.05 + 2, z * 0.05 + 5) < 0.42) continue;
    if (!farFromTrail(trailPts, x, z, 20)) continue;
    spots.push({ x, z, h, k: 0.75 + rnd() * 0.85, tint: rnd() });
  }

  // Sapin : tronc + trois étages de cônes lisses
  const tiers = [
    [1.15, 1.7, 1.2],
    [0.9, 1.5, 2.0],
    [0.62, 1.3, 2.75],
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.17, 1.2, 10);
  trunkGeo.translate(0, 0.6, 0);
  const trunk = new THREE.InstancedMesh(trunkGeo, mat(0x6b5440), spots.length);
  const layers = tiers.map(([r, h, y]) => {
    const g = new THREE.ConeGeometry(r, h, 18, 1);
    g.translate(0, y, 0);
    const m = new THREE.InstancedMesh(g, mat(0xffffff, { roughness: 0.85 }), spots.length);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const dark = new THREE.Color(0x3f5236);
  const light = new THREE.Color(0x667a49);
  spots.forEach((sp, i) => {
    s.set(sp.k, sp.k * (0.95 + sp.tint * 0.35), sp.k);
    m4.compose(new THREE.Vector3(sp.x, sp.h - 0.15, sp.z), q, s);
    trunk.setMatrixAt(i, m4);
    c.copy(dark).lerp(light, sp.tint);
    layers.forEach((l, j) => {
      l.setMatrixAt(i, m4);
      l.setColorAt(i, c.clone().offsetHSL(0, 0, j * 0.025));
    });
  });
  trunk.castShadow = true;
  group.add(trunk, ...layers);

  // Buissons ronds dans les prairies basses
  const bushSpots = [];
  for (let tries = 0; tries < 4000 && bushSpots.length < 140; tries++) {
    const x = (rnd() - 0.5) * 220;
    const z = (rnd() - 0.5) * 220;
    const h = heightAt(x, z);
    if (h > 8 || h < 0.8) continue;
    if (!farFromTrail(trailPts, x, z, 12)) continue;
    bushSpots.push({ x, z, h, k: 0.5 + rnd() * 0.6 });
  }
  const bush = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), mat(0xffffff), bushSpots.length);
  bushSpots.forEach((b, i) => {
    s.set(b.k * 1.3, b.k, b.k * 1.3);
    m4.compose(new THREE.Vector3(b.x, b.h + b.k * 0.4, b.z), q, s);
    bush.setMatrixAt(i, m4);
    bush.setColorAt(i, c.set(0x8c9d5c).offsetHSL(0, 0, (i % 5) * 0.015));
  });
  bush.castShadow = true;
  group.add(bush);

  // Rochers arrondis sur les pentes
  const rocks = [];
  for (let tries = 0; tries < 4000 && rocks.length < 70; tries++) {
    const x = (rnd() - 0.5) * 140;
    const z = (rnd() - 0.5) * 140;
    const h = heightAt(x, z);
    if (h < 12 || h > 30) continue;
    if (!farFromTrail(trailPts, x, z, 10)) continue;
    rocks.push({ x, z, h, k: 0.35 + rnd() * 0.6, ry: rnd() * 6 });
  }
  const rock = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), mat(0x9d9482), rocks.length);
  rocks.forEach((r, i) => {
    s.set(r.k * 1.4, r.k * 0.7, r.k);
    m4.compose(new THREE.Vector3(r.x, r.h, r.z), q.setFromEuler(new THREE.Euler(0, r.ry, 0)), s);
    rock.setMatrixAt(i, m4);
  });
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);
  return group;
}

function buildClouds() {
  const group = new THREE.Group();
  const material = mat(0xffffff, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35 });
  const geo = new THREE.SphereGeometry(1, 24, 16);
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + (i % 3);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(geo, material);
      const k = 2.4 + ((i * 7 + j * 3) % 5) * 0.55;
      const mid = 1 - Math.abs(j - (puffs - 1) / 2) / puffs;
      puff.scale.set(k * 1.25, k * (0.75 + mid * 0.35), k);
      puff.position.set(j * 2.7 - puffs * 1.35, mid * 1.2, ((j * 5) % 3) - 1);
      cloud.add(puff);
    }
    const a = (i / 8) * Math.PI * 2;
    const r = 105 + (i % 3) * 25;
    cloud.position.set(Math.cos(a) * r, 64 + (i % 4) * 7, Math.sin(a) * r);
    cloud.userData.speed = 0.01 + (i % 3) * 0.005;
    cloud.userData.angle = a;
    cloud.userData.radius = r;
    group.add(cloud);
  }
  return group;
}

function buildRunner() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 8, 20), mat(COLORS.lime, { roughness: 0.7 }));
  body.position.y = 1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), mat(0xe8c9a4, { roughness: 0.7 }));
  head.position.y = 1.95;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(COLORS.dark));
  cap.position.y = 2.02;
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20, 1, false, -Math.PI / 2, Math.PI), mat(COLORS.dark));
  visor.position.set(0, 2.04, 0.25);
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.35, 6, 14), mat(COLORS.dark));
  bag.position.set(0, 1.12, -0.42);
  const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  bib.position.set(0, 1.08, 0.43);
  g.add(body, head, cap, visor, bag, bib);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.2, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.lime, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.08;
  g.add(halo);
  g.userData.halo = halo;
  g.scale.setScalar(1.9);
  return g;
}

/* Drapeau en tissu : un plan subdivisé qu'on fait onduler à chaque image */
function clothFlag(color, w = 1.7, h = 1.05) {
  const geo = new THREE.PlaneGeometry(w, h, 14, 6);
  geo.translate(w / 2, -h / 2, 0);
  const mesh = new THREE.Mesh(geo, mat(color, { roughness: 0.8, side: THREE.DoubleSide }));
  mesh.userData.base = geo.attributes.position.array.slice();
  mesh.userData.w = w;
  mesh.castShadow = true;
  return mesh;
}
function waveFlag(flag, time, phase) {
  const pos = flag.geometry.attributes.position;
  const base = flag.userData.base;
  const w = flag.userData.w;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const k = x / w;
    pos.setZ(i, Math.sin(x * 3.2 - time * 4.2 + phase) * 0.16 * k + Math.sin(y * 2 + time * 2.6) * 0.04 * k);
  }
  pos.needsUpdate = true;
  flag.geometry.computeVertexNormals();
}

function buildMarker(item) {
  const g = new THREE.Group();
  const st = item.state;
  if (st === "publie" || st === "programme") {
    const style = STATE_STYLE[st];
    const poleH = st === "publie" ? 3.4 : 2.9;
    const socle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.28, 28), mat(0xcfc6b2));
    socle.position.y = 0.1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, poleH, 14), mat(style.pole, { roughness: 0.5 }));
    pole.position.y = poleH / 2;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat(0xd9b45a, { roughness: 0.35, metalness: 0.4 }));
    knob.position.y = poleH + 0.05;
    const flag = clothFlag(style.flag);
    flag.position.set(0.05, poleH - 0.05, 0);
    g.add(socle, pole, knob, flag);
    g.userData.flag = flag;
    // Une perle colorée par réseau sur lequel le contenu est publié / prévu
    (item.networks || []).forEach((col, i) => {
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), mat(col, { roughness: 0.4 }));
      const a = (i / Math.max(1, item.networks.length)) * Math.PI * 2 + 0.6;
      gem.position.set(Math.cos(a) * 0.62, 0.36, Math.sin(a) * 0.62);
      g.add(gem);
    });
  } else if (st === "pret" || st === "redaction") {
    const color = STATE_STYLE[st].cairn;
    const n = st === "pret" ? 4 : 2;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const r = 0.62 - i * 0.12;
      const stone = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color, { roughness: 0.95 }));
      stone.scale.set(1.1, 0.55, 0.95);
      y += r * 0.55;
      stone.position.set(Math.sin(i * 2.1) * 0.05, y, 0);
      y += r * 0.5;
      stone.rotation.y = i * 0.9;
      g.add(stone);
    }
  } else {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 32, 20),
      mat(STATE_STYLE.idee.orb, { roughness: 0.3, emissive: COLORS.lime, emissiveIntensity: 0.25, transparent: true, opacity: 0.9 })
    );
    orb.position.y = 1.2;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 32),
      new THREE.MeshBasicMaterial({ color: COLORS.dark, transparent: true, opacity: 0.15, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05;
    g.add(orb, shadow);
    g.userData.orb = orb;
  }
  g.traverse((o) => { if (o.isMesh && o.material.opacity === 1) o.castShadow = true; });

  // Zone cliquable plus large que la balise
  const hit = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.4;
  hit.userData.itemId = item.id;
  g.add(hit);
  g.userData.hit = hit;
  return g;
}

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.6, "rgba(255,255,255,1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
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
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.horizon);
  scene.fog = new THREE.Fog(COLORS.horizon, 150, 420);
  scene.add(buildSky());

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1600);

  scene.add(new THREE.HemisphereLight(0xfff7e6, 0x7c8466, 1.5));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.4);
  sun.position.set(70, 95, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 300 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.radius = 6;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const base = new THREE.Mesh(new THREE.CircleGeometry(900, 64), mat(0xb3b98f));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.6;
  scene.add(base);

  const terrain = buildTerrain();
  scene.add(terrain);
  scene.add(buildLake());
  const curve = buildTrailCurve();
  scene.add(buildForest(curve));
  const clouds = buildClouds();
  scene.add(clouds);
  const dotMap = dotTexture();

  // Drapeau du sommet : l'objectif
  const summit = new THREE.Group();
  const sp = curve.getPointAt(1);
  const sPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 6, 16), mat(COLORS.dark, { roughness: 0.5 }));
  sPole.position.y = 3;
  const sKnob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(0xd9b45a, { roughness: 0.35, metalness: 0.4 }));
  sKnob.position.y = 6.1;
  const sFlag = clothFlag(COLORS.dark, 3.2, 1.9);
  sFlag.position.set(0.1, 5.95, 0);
  summit.add(sPole, sKnob, sFlag);
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
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, map: dotMap, alphaTest: 0.05, depthWrite: false }));
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
    trailGroup.add(ribbon(curve, 0, 1, 2.1, COLORS.trailEdge, 0.12, 1));
    trailGroup.add(ribbon(curve, 0, 1, 1.5, COLORS.trail, 0.16, 2));
    if (tAv > 0.02) {
      trailGroup.add(ribbon(curve, 0, tAv, 2.3, COLORS.trailDoneEdge, 0.2, 3));
      trailGroup.add(ribbon(curve, 0, tAv, 1.6, COLORS.trailDone, 0.24, 4));
    }
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
        if (m.userData.flag) waveFlag(m.userData.flag, time, m.userData.phase);
        if (m.userData.orb) m.userData.orb.position.y = 1.2 + Math.sin(time * 1.6 + m.userData.phase) * 0.22;
      });
      waveFlag(sFlag, time * 0.8, 0);
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
