/* =========================================================
   Camp de base. Rendu « jeu » : post-traitement, vent, eau, lumière du ciel
   - occlusion ambiante (GTAO) : les objets s'ancrent dans le décor
   - léger bloom (fenêtres éclairées), effet maquette (tilt-shift), vignette
   - qualité adaptée à la machine : si l'image devient lente, on allège
   ========================================================= */

import * as THREE from "../vendor/three.module.js";
import { EffectComposer } from "../vendor/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "../vendor/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "../vendor/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../vendor/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "../vendor/addons/postprocessing/OutputPass.js";

/* Horloge partagée par les matériaux animés (vent, eau) */
export const windTime = { value: 0 };

/* Les arbres se balancent doucement : plus on monte dans l'arbre, plus ça bouge */
export function addWind(material, strength = 0.05) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = "uniform float uWind;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 wp = vec2(0.0);
      #endif
      float sway = max(transformed.y, 0.0) * ${strength.toFixed(3)};
      transformed.x += sin(uWind * 1.3 + wp.x * 0.35 + wp.y * 0.21) * sway;
      transformed.z += cos(uWind * 1.05 + wp.y * 0.31 - wp.x * 0.12) * sway * 0.6;`
    );
  };
  material.customProgramCacheKey = () => "wind" + strength;
  return material;
}

/* Eau : reflets du ciel et petites rides animées */
export function waterMaterial(color) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.93 });
  m.defines = { USE_UV: "" };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.fragmentShader = "uniform float uWind;\n" + sh.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      vec2 q = vUv * 46.0;
      normal = normalize(normal + vec3(
        sin(q.x + uWind * 1.4) * 0.045 + sin(q.y * 1.7 - uWind * 0.9) * 0.03,
        cos(q.y + uWind * 1.1) * 0.045 + cos(q.x * 1.3 + uWind * 0.7) * 0.025,
        0.0));`
    );
  };
  m.customProgramCacheKey = () => "water";
  return m;
}

/* Éclairage d'ambiance tiré du ciel (reflets doux sur l'eau, le métal, les toits) */
export function skyEnvironment(renderer, sky) {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const copy = sky.clone();
  copy.scale.setScalar(0.1); // le générateur ne voit qu'à 100 unités
  s.add(copy);
  const rt = pm.fromScene(s, 0.04);
  pm.dispose();
  return rt.texture;
}

/* Effet maquette : flou progressif en haut et en bas de l'image */
const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    dir: { value: new THREE.Vector2(1, 0) },
    amount: { value: 2.2 },
    focus: { value: 0.45 },
    band: { value: 0.24 },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 dir; uniform float amount; uniform float focus; uniform float band;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - focus);
      float r = smoothstep(band, band + 0.32, d) * amount;
      if (r < 0.01) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 sum = vec4(0.0); float ws = 0.0;
      for (int i = -4; i <= 4; i++) {
        float w = exp(-float(i * i) / 8.0);
        sum += texture2D(tDiffuse, vUv + dir * float(i) * r) * w;
        ws += w;
      }
      gl_FragColor = sum / ws;
    }`,
};

/* Étalonnage : un peu plus de relief dans les couleurs, vignette douce */
const Grade = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.04 }, vignette: { value: 0.14 } },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation; uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = mix(vec3(l), c.rgb, saturation);
      vec2 p = (vUv - 0.5) * vec2(1.15, 1.0);
      col *= 1.0 - vignette * smoothstep(0.3, 0.85, length(p));
      gl_FragColor = vec4(col, c.a);
    }`,
};

/* quality : "high" (occlusion ambiante), "medium" (sans), "low" (rendu direct) */
export function createPost(renderer, scene, camera, quality) {
  if (quality === "low") return null;
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.addPass(new RenderPass(scene, camera));

  let ao = null;
  if (quality === "high") {
    ao = new GTAOPass(scene, camera, size.x, size.y, undefined,
      { radius: 2.2, distanceExponent: 1.4, thickness: 1.6, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false },
      { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    ao.blendIntensity = 0.9;
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.55, 1.0);
  composer.addPass(bloom);
  const tiltH = new ShaderPass(TiltShift);
  const tiltV = new ShaderPass(TiltShift);
  tiltV.uniforms.dir.value.set(0, 1);
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  composer.addPass(new ShaderPass(Grade));
  composer.addPass(new OutputPass());

  function setSize(w, h) {
    composer.setSize(w, h);
    tiltH.uniforms.dir.value.set(1 / w, 0);
    tiltV.uniforms.dir.value.set(0, 1 / h);
  }
  setSize(size.x, size.y);
  return {
    composer,
    setSize,
    render: () => composer.render(),
    dropAO() {
      if (!ao || !ao.enabled) return false;
      ao.enabled = false;
      return true;
    },
  };
}
