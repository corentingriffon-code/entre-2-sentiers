/* =========================================================
   Camp de base. Scène 3D : la montagne, le sentier, les balises
   Chaque contenu est une balise le long du sentier (ordre chronologique).
   Le coureur se tient sur la dernière balise publiée ; le sommet est l'objectif.
   ========================================================= */

import * as THREE from "../vendor/three.module.js";
import { addWind, waterMaterial, skyEnvironment, createPost, windTime } from "./look.js";

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
  trailDone: 0xa2b26b,
  trailDoneEdge: 0x6f8538,
  water: 0x7fa7a8,
};

const STATE_STYLE = {
  publie: { flag: 0x9faf6b, pole: 0x1d261e },
  programme: { flag: 0xfbf8f1, pole: 0x1d261e },
  pret: { cairn: 0xd7c9ac },
  redaction: { cairn: 0xb3ab98 },
  idee: { orb: 0xfdfbf5 },
};

const SUN_DIR = new THREE.Vector3(70, 62, 40).normalize();

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
  meadowLow: new THREE.Color(0xb3bd8c),
  meadow: new THREE.Color(0x8fa463),
  meadowDark: new THREE.Color(0x748c4f),
  rock: new THREE.Color(0xa29b8f),
  rockDark: new THREE.Color(0x7c776d),
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
    // Creux plus sombres, crêtes plus claires (relief lisible, comme une occlusion peinte)
    const around = (heightAt(x + 2.5, z) + heightAt(x - 2.5, z) + heightAt(x, z + 2.5) + heightAt(x, z - 2.5)) / 4;
    const cav = THREE.MathUtils.clamp((around - h) * 0.35, -0.12, 0.18);
    c.multiplyScalar(1 - cav);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.96 }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildLake() {
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * 1.6, 64), waterMaterial(COLORS.water));
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
      sunDir: { value: SUN_DIR },
    },
    vertexShader: "varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vPos;
      void main(){
        float t = smoothstep(-0.02, 0.55, vPos.y);
        vec3 col = mix(horizon, top, t);
        float s = max(dot(normalize(vPos), sunDir), 0.0);
        col += vec3(1.0, 0.86, 0.62) * (pow(s, 8.0) * 0.22 + pow(s, 64.0) * 0.35);
        col = mix(col, horizon * 1.03, smoothstep(0.12, -0.02, vPos.y) * 0.6);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
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

function buildForest(curve, avoid = []) {
  const group = new THREE.Group();
  const clear = (x, z) => avoid.every((a) => (a.x - x) ** 2 + (a.z - z) ** 2 > a.r * a.r);
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
    if (!farFromTrail(trailPts, x, z, 20) || !clear(x, z)) continue;
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
    const m = new THREE.InstancedMesh(g, addWind(mat(0xffffff, { roughness: 0.82 }), 0.035), spots.length);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const dark = new THREE.Color(0x34502f);
  const light = new THREE.Color(0x6a8547);
  spots.forEach((sp, i) => {
    s.set(sp.k, sp.k * (0.95 + sp.tint * 0.35), sp.k);
    m4.compose(new THREE.Vector3(sp.x, sp.h - 0.15, sp.z), q, s);
    trunk.setMatrixAt(i, m4);
    c.copy(dark).lerp(light, sp.tint);
    layers.forEach((l, j) => {
      l.setMatrixAt(i, m4);
      l.setColorAt(i, c.clone().offsetHSL(0, 0.02, j * 0.035));
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
    if (!farFromTrail(trailPts, x, z, 12) || !clear(x, z)) continue;
    bushSpots.push({ x, z, h, k: 0.5 + rnd() * 0.6 });
  }
  const bush = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), addWind(mat(0xffffff, { roughness: 0.85 }), 0.025), bushSpots.length);
  bushSpots.forEach((b, i) => {
    s.set(b.k * 1.3, b.k, b.k * 1.3);
    m4.compose(new THREE.Vector3(b.x, b.h + b.k * 0.4, b.z), q, s);
    bush.setMatrixAt(i, m4);
    bush.setColorAt(i, c.set(0x86a055).offsetHSL(0, 0, (i % 5) * 0.018 - 0.03));
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
    if (!farFromTrail(trailPts, x, z, 10) || !clear(x, z)) continue;
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
  const material = mat(0xffffff, { roughness: 1, emissive: 0xfff6ea, emissiveIntensity: 0.45, transparent: true, opacity: 0.94 });
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

/* ---------- Lieux du camp (ouvrent les autres vues) ---------- */

/* Le village du camp de base, au pied du sentier ; les trophées sont au sommet */
const CAMP_ANGLE = -Math.PI * 0.35;
const CAMP = { x: Math.cos(CAMP_ANGLE) * 90, z: Math.sin(CAMP_ANGLE) * 90 };
const STATIONS = [
  { id: "contenus", num: 1, small: "Atelier", title: "Contenus", side: -21 },
  { id: "planning", num: 2, small: "Refuge", title: "Planning", side: -7 },
  { id: "memo", num: 3, small: "Cabane", title: "Mémo", side: 7 },
  { id: "stats", num: 4, small: "Observatoire", title: "Stats", side: 21 },
  { id: "trophees", num: 5, small: "Sommet", title: "Trophées", summit: true },
];

function stationSpots(curve) {
  const ox = Math.cos(CAMP_ANGLE);
  const oz = Math.sin(CAMP_ANGLE);
  const tx = -oz;
  const tz = ox;
  return STATIONS.map((d) => {
    if (d.summit) {
      const p = curve.getPointAt(1);
      return { ...d, x: p.x, z: p.z, y: heightAt(p.x, p.z), ox, oz };
    }
    const bend = Math.abs(d.side) > 10 ? 3 : -2;
    const x = CAMP.x + tx * d.side + ox * bend;
    const z = CAMP.z + tz * d.side + oz * bend;
    return { ...d, x, z, y: heightAt(x, z), ox, oz };
  });
}

/* Anneau qui épouse le relief */
function groundRing(cx, cz, r0, r1, color, opacity) {
  const geo = new THREE.RingGeometry(r0, r1, 72, 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cy = heightAt(cx, cz);
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(cx + pos.getX(i), cz + pos.getZ(i)) - cy + 0.3);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(cx, cy, cz);
  return m;
}

function roofMesh(w, h, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}

function buildHouse(id) {
  const g = new THREE.Group();
  const wood = mat(0x9a7652);
  const roofM = mat(0x3f4c38);
  const white = mat(0xf4efe4);
  const glow = mat(0xf3d68a, { emissive: 0xffb84a, emissiveIntensity: 2.2 });
  const dark = mat(COLORS.dark);
  if (id === "planning") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 2.6), wood);
    body.position.y = 1.05;
    const roof = roofMesh(4, 1.7, 3.1, roofM);
    roof.position.y = 2.1;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.05), dark);
    door.position.set(0, 0.6, 1.31);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.05), glow);
    win.position.set(1, 1.3, 1.31);
    const win2 = win.clone();
    win2.position.x = -1;
    g.add(body, roof, door, win, win2);
  } else if (id === "memo") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2), wood);
    body.position.y = 0.8;
    const roof = roofMesh(2.7, 1.3, 2.4, roofM);
    roof.position.y = 1.6;
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), mat(0x8f8778));
    chim.position.set(0.6, 2.4, -0.3);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.05), glow);
    win.position.set(0, 0.95, 1.01);
    g.add(body, roof, chim, win);
  } else if (id === "stats") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 2.2, 32), white);
    body.position.y = 1.1;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc9ccc6, { roughness: 0.35, metalness: 0.5 }));
    dome.position.y = 2.2;
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 1.5), dark);
    slit.position.set(0, 2.7, 0.4);
    slit.rotation.x = -0.5;
    g.add(body, dome, slit);
  } else if (id === "contenus") {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2, 2.7, 32), mat(0xd9c49a));
    tent.position.y = 1.35;
    const door = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 3, 1, true, 0, Math.PI * 0.6), dark);
    door.position.set(0, 0.7, 1.05);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), dark);
    pole.position.y = 3.1;
    const pen = clothFlag(COLORS.lime, 0.9, 0.5);
    pen.position.set(0.04, 3.65, 0);
    g.add(tent, door, pole, pen);
    g.userData.flag = pen;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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

export function createScene(container, { onSelect, onHover, onStation, onProximity } = {}) {
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
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.horizon);
  scene.fog = new THREE.Fog(COLORS.horizon, 150, 420);
  const sky = buildSky();
  scene.add(sky);
  scene.environment = skyEnvironment(renderer, sky);
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1600);

  scene.add(new THREE.HemisphereLight(0xf4f1e6, 0x6f7a55, 1.05));
  const sun = new THREE.DirectionalLight(0xffedd6, 2.8);
  sun.position.copy(SUN_DIR).multiplyScalar(130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 4096, small ? 1024 : 4096);
  Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 300 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const base = new THREE.Mesh(new THREE.CircleGeometry(900, 64), mat(0xb3bd8c));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.6;
  scene.add(base);

  const terrain = buildTerrain();
  scene.add(terrain);
  scene.add(buildLake());
  scene.add(groundRing(LAKE.x, LAKE.z, LAKE.r * 1.52, LAKE.r * 1.66, 0xffffff, 0.35));
  const curve = buildTrailCurve();
  const stations = stationSpots(curve);
  const avoid = [];
  stations.forEach((st) => {
    avoid.push({ x: st.x, z: st.z, r: 5.5 });
    if (st.id !== "trophees") avoid.push({ x: st.x - st.ox * 6, z: st.z - st.oz * 6, r: 4.5 });
  });
  avoid.push({ x: CAMP.x, z: CAMP.z, r: 14 });
  // Chemin qui relie le camp au départ du sentier
  const start = curve.getPointAt(0);
  const campPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(CAMP.x, 0, CAMP.z),
    new THREE.Vector3((CAMP.x * 2 + start.x) / 3 + 3, 0, (CAMP.z * 2 + start.z) / 3),
    new THREE.Vector3(start.x, 0, start.z),
  ]);
  for (let i = 0; i < 20; i++) {
    const q = campPath.getPointAt(i / 19);
    avoid.push({ x: q.x, z: q.z, r: 4 });
  }
  scene.add(ribbon(campPath, 0, 1, 2.1, COLORS.trailEdge, 0.12, 1), ribbon(campPath, 0, 1, 1.5, COLORS.trail, 0.16, 2));
  // Placette du village
  scene.add(groundRing(CAMP.x, CAMP.z, 0, 5, COLORS.trail, 1));
  scene.add(buildForest(curve, avoid));
  const stationRings = [];
  stations.forEach((st) => {
    const ring = groundRing(st.x, st.z, 3.15, 3.5, COLORS.lime, 0.95);
    const fill = groundRing(st.x, st.z, 0, 3.15, 0xe9dfc4, 0.7);
    scene.add(ring, fill);
    stationRings.push(ring);
    let top = st.y + 5;
    if (st.id !== "trophees") {
      const house = buildHouse(st.id);
      const hx = st.x - st.ox * 6.2;
      const hz = st.z - st.oz * 6.2;
      house.position.set(hx, heightAt(hx, hz) - 0.1, hz);
      house.rotation.y = Math.atan2(st.ox, st.oz);
      house.scale.setScalar(1.5);
      scene.add(house);
      st.house = house;
      top = house.position.y + 6.4;
    } else {
      top = st.y + 8.2;
    }
    st.anchor = new THREE.Vector3(st.x, top, st.z);
  });
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

  /* --- Étiquettes flottantes (HTML) --- */
  const layer = document.createElement("div");
  layer.className = "scene-labels";
  document.body.appendChild(layer);
  const pins = [];
  function makePin(anchor, html, data, cls = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pin " + cls;
    b.innerHTML = html;
    Object.entries(data).forEach(([k, v]) => (b.dataset[k] = v));
    layer.appendChild(b);
    const pin = { el: b, anchor };
    pins.push(pin);
    return pin;
  }
  stations.forEach((st) => {
    makePin(st.anchor, `<span class="pin-num">${st.num}</span><span class="pin-text"><small>${st.small}</small>${st.title}</span>`, { station: st.id }, "pin-station");
  });
  layer.addEventListener("click", (e) => {
    const b = e.target.closest(".pin");
    if (!b) return;
    if (b.dataset.station && onStation) onStation(b.dataset.station);
    if (b.dataset.item && onSelect) onSelect(b.dataset.item);
  });
  let itemPins = [];
  const pv = new THREE.Vector3();
  function updatePins() {
    if (!layer.offsetParent && getComputedStyle(layer).display === "none") return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    for (const pin of pins) {
      pv.copy(pin.anchor).project(camera);
      const vis = pv.z < 1 && Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05;
      pin.el.style.visibility = vis ? "visible" : "hidden";
      if (!vis) continue;
      const d = camera.position.distanceTo(pin.anchor);
      const k = THREE.MathUtils.clamp(110 / d, 0.72, 1.05);
      pin.el.style.transform = `translate(${((pv.x + 1) / 2) * w}px, ${((1 - pv.y) / 2) * h}px) translate(-50%, -100%) scale(${k.toFixed(3)})`;
      pin.el.style.zIndex = String(1000 - Math.round(d));
    }
  }

  /* --- Balade : clavier (ZQSD / WASD / flèches) ou clic au sol --- */
  let active = true;
  let roam = false;
  let walkTarget = null;
  let heading = 0;
  let near = null;
  const runnerPos = new THREE.Vector3();
  const keys = { f: 0, b: 0, l: 0, r: 0 };
  const KEYMAP = { KeyW: "f", ArrowUp: "f", KeyS: "b", ArrowDown: "b", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
  const typing = (e) => e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
  window.addEventListener("keydown", (e) => {
    if (!active || typing(e) || document.querySelector("dialog[open]")) return;
    const k = KEYMAP[e.code];
    if (k) {
      keys[k] = 1;
      e.preventDefault();
    } else if (e.key === "Enter" && near) {
      e.preventDefault();
      activate(near);
    } else if (e.key === "Escape" && roam) {
      backToTrail();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = 0;
  });
  window.addEventListener("blur", () => Object.keys(keys).forEach((k) => (keys[k] = 0)));

  function activate(n) {
    if (n.type === "station" && onStation) onStation(n.id);
    if (n.type === "item" && onSelect) onSelect(n.id);
  }
  function startRoam() {
    if (!roam) {
      roam = true;
      if (sphGoal.radius > 70) sphGoal.radius = 52;
      sphGoal.phi = Math.min(sphGoal.phi, 1.0);
    }
  }
  function backToTrail() {
    roam = false;
    walkTarget = null;
    setNear(null);
  }
  function setNear(n) {
    const key = n ? n.type + n.id : "";
    const prev = near ? near.type + near.id : "";
    if (key === prev) return;
    near = n;
    if (onProximity) onProximity(n);
  }

  const clickMark = groundRing(0, 0, 0.7, 1.0, COLORS.dark, 0.6);
  clickMark.visible = false;
  scene.add(clickMark);

  let trailGroup = new THREE.Group();
  scene.add(trailGroup);
  let markers = new THREE.Group();
  scene.add(markers);
  const markerById = new Map();
  let itemT = [];

  let avatarT = 0.02;
  let avatarTarget = 0.02;

  /* --- Caméra orbitale maison --- */
  const HOME = new THREE.Vector3(CAMP.x * 0.76, 8, CAMP.z * 0.76);
  const target = HOME.clone();
  const targetGoal = target.clone();
  const sph = { theta: CAMP_ANGLE + 0.12, phi: 0.98, radius: 150 };
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
      else if (!id) {
        const hit = raycaster.intersectObject(terrain, false)[0];
        if (hit) {
          walkTarget = hit.point.clone();
          startRoam();
          scene.remove(clickMark);
          disposeTree(clickMark);
          const m = groundRing(hit.point.x, hit.point.z, 0.7, 1.0, COLORS.dark, 0.6);
          m.userData.life = 0;
          clickMarks.push(m);
          scene.add(m);
        }
      }
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
  const clickMarks = [];
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
    if (Math.abs(tAv - avatarTarget) > 1e-6) backToTrail();
    avatarTarget = tAv;

    itemPins.forEach((p) => { p.el.remove(); pins.splice(pins.indexOf(p), 1); });
    itemPins = items.filter((it) => it.pin).map((it) => {
      const m = markerById.get(it.id);
      const anchor = m.position.clone().add(new THREE.Vector3(0, 6.6, 0));
      const lab = { publie: "Publié", programme: "Programmé", pret: "Prêt", redaction: "En rédaction", idee: "Idée" }[it.state];
      const short = it.title.length > 34 ? it.title.slice(0, 32) + "…" : it.title;
      const span = document.createElement("span");
      span.textContent = short;
      return makePin(anchor, `<span class="pin-dot pin-${it.state}"></span><span class="pin-text"><small>${it.pin === true ? lab : it.pin}</small>${span.innerHTML}</span>`, { item: it.id }, "pin-item");
    });

    scene.remove(trailGroup);
    disposeTree(trailGroup);
    trailGroup = new THREE.Group();
    trailGroup.add(ribbon(curve, 0, 1, 2.1, COLORS.trailEdge, 0.12, 1));
    trailGroup.add(ribbon(curve, 0, 1, 1.5, COLORS.trail, 0.16, 2));
    if (tAv > 0.02) {
      trailGroup.add(ribbon(curve, 0, tAv, 1.9, COLORS.trailDoneEdge, 0.2, 3));
      trailGroup.add(ribbon(curve, 0, tAv, 1.35, COLORS.trailDone, 0.24, 4));
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
    backToTrail();
    targetGoal.copy(curve.getPointAt(avatarTarget)).add(new THREE.Vector3(0, 2, 0));
    sphGoal.radius = 46;
    lastInteraction = performance.now();
  }
  const overviewRadius = () => (camera.aspect < 0.8 ? 205 : 128);
  function overview() {
    backToTrail();
    targetGoal.copy(HOME);
    sphGoal.radius = overviewRadius();
    sphGoal.phi = 0.98;
    sphGoal.theta = CAMP_ANGLE + 0.12 + Math.round((sphGoal.theta - CAMP_ANGLE) / (Math.PI * 2)) * Math.PI * 2;
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
    post?.setSize(w, h);
    camera.aspect = w / h;
    // Sur grand écran, la colonne de droite masque une partie de la vue : on recentre la scène à gauche
    if (w > 1080) camera.setViewOffset(w, h, 170, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  /* Qualité : occlusion ambiante sur ordinateur, allégée si l'image ralentit */
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  let quality = small || coarse ? "medium" : "high";
  let post = null;
  try { post = createPost(renderer, scene, camera, quality); } catch (e) { post = null; }
  resize();
  let perfFrames = 0;
  let perfTime = 0;
  sph.radius = sphGoal.radius = overviewRadius();

  const fw = new THREE.Vector3();
  const rt = new THREE.Vector3();
  const mv = new THREE.Vector3();
  const timer = new THREE.Timer();
  let running = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    timer.update();
    const rawDt = timer.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const time = timer.getElapsed();
    if (!reducedMotion) windTime.value = time;
    // Mesure sur quelques secondes : si l'image est lente, on retire l'occlusion, puis les effets
    if (post && time > 2 && perfFrames < 120) {
      perfFrames++;
      perfTime += rawDt;
      if (perfFrames === 120) {
        const avg = perfTime / 120;
        if (avg > 0.034 && !post.dropAO()) post = null;
        else if (avg > 0.034) { perfFrames = 0; perfTime = 0; }
      }
    }

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

    let moving = false;
    const mx = keys.r - keys.l;
    const mz = keys.f - keys.b;
    if (active && (mx || mz)) {
      startRoam();
      walkTarget = null;
      camera.getWorldDirection(fw);
      fw.y = 0;
      fw.normalize();
      rt.set(-fw.z, 0, fw.x);
      mv.copy(fw).multiplyScalar(mz).addScaledVector(rt, mx).normalize();
      moving = true;
    } else if (walkTarget) {
      mv.set(walkTarget.x - runnerPos.x, 0, walkTarget.z - runnerPos.z);
      const d = mv.length();
      if (d < 0.5) walkTarget = null;
      else {
        mv.divideScalar(d);
        moving = true;
      }
    }
    if (roam) {
      if (moving) {
        runnerPos.x += mv.x * 15 * dt;
        runnerPos.z += mv.z * 15 * dt;
        const r = Math.hypot(runnerPos.x, runnerPos.z);
        if (r > 112) runnerPos.multiplyScalar(112 / r);
        heading = Math.atan2(mv.x, mv.z);
        lastInteraction = performance.now();
      }
      runnerPos.y = Math.max(heightAt(runnerPos.x, runnerPos.z), LAKE.level);
      targetGoal.set(runnerPos.x, runnerPos.y + 2, runnerPos.z);
    } else {
      runnerPos.set(ap.x, ap.y - 0.35, ap.z);
      heading = Math.atan2(look.x - ap.x, look.z - ap.z);
    }
    const bob = reducedMotion ? 0 : Math.abs(Math.sin(time * (moving ? 11 : 4))) * (moving ? 0.35 : 0.18);
    runner.position.set(runnerPos.x, runnerPos.y - 0.05 + bob, runnerPos.z);
    let dh = heading - runner.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    runner.rotation.y += dh * Math.min(1, dt * 10);
    runner.rotation.x = THREE.MathUtils.lerp(runner.rotation.x, moving ? 0.18 : 0, Math.min(1, dt * 8));
    runner.userData.halo.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(time * 2.5) * 0.12));

    // Lieu ou balise à portée du coureur
    if (roam) {
      let best = null;
      let bestD = Infinity;
      for (const st of stations) {
        const d = Math.hypot(st.x - runnerPos.x, st.z - runnerPos.z);
        if (d < 3.8 && d < bestD) { best = { type: "station", id: st.id, title: st.title, small: st.small }; bestD = d; }
      }
      if (!best) {
        markers.children.forEach((m) => {
          const d = Math.hypot(m.position.x - runnerPos.x, m.position.z - runnerPos.z);
          if (d < 3.6 && d < bestD) { best = { type: "item", id: m.userData.hit.userData.itemId }; bestD = d; }
        });
      }
      setNear(best);
    }
    stationRings.forEach((r, i) => {
      const on = near && near.type === "station" && near.id === stations[i].id;
      r.material.color.setHex(on ? 0xffffff : COLORS.lime);
      r.scale.setScalar(on ? 1.06 : 1 + (reducedMotion ? 0 : Math.sin(time * 2 + i) * 0.025));
    });
    for (let i = clickMarks.length - 1; i >= 0; i--) {
      const m = clickMarks[i];
      m.userData.life += dt;
      m.scale.setScalar(1 + m.userData.life * 1.5);
      m.material.opacity = Math.max(0, 0.6 - m.userData.life * 0.8);
      if (m.userData.life > 0.8) { scene.remove(m); disposeTree(m); clickMarks.splice(i, 1); }
    }

    if (!reducedMotion) {
      markers.children.forEach((m) => {
        if (m.userData.flag) waveFlag(m.userData.flag, time, m.userData.phase);
        if (m.userData.orb) m.userData.orb.position.y = 1.2 + Math.sin(time * 1.6 + m.userData.phase) * 0.22;
      });
      waveFlag(sFlag, time * 0.8, 0);
      stations.forEach((st) => st.house?.userData.flag && waveFlag(st.house.userData.flag, time, st.num));
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

    if (post) post.render();
    else renderer.render(scene, camera);
    updatePins();
  }
  frame();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; timer.reset?.(); frame(); }
  });

  function setActive(on) {
    active = on;
    if (!on) Object.keys(keys).forEach((k) => (keys[k] = 0));
  }
  function activateNear() {
    if (near) activate(near);
  }

  return { setItems, focus, focusRunner, overview, celebrate, resize, setActive, activateNear, backToTrail };
}
