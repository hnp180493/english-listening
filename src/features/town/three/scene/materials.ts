// The few materials of the 3D town, shared by everything: the vertex-coloured standard material of all merged
// geometry, the glass of windows and the bulbs of lamps (they glow at night), the swaying material of trees, tufts
// and flowers, and the animated water. Time and sway come in as shared uniforms set once a frame.

import { AdditiveBlending, Color, Vector4, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, type IUniform, type Material, type WebGLProgramParametersWithUniforms } from 'three';
import { C } from './palette3d';

export interface Shared {
  time: IUniform<number>;
  /** 1 = trees and grass sway, 0 = still (reduced motion). */
  sway: IUniform<number>;
  /** 0 day … 1 night. */
  night: IUniform<number>;
  /**
   * See-through holes round people (the player, the resident in a conversation): x, y in drawing-buffer pixels from
   * the bottom left, radius in pixels (0 = none), and the person's view-space depth. Whatever stands nearer the
   * camera there (a wall, a tree) is drawn dithered, so nobody disappears behind it.
   */
  holes: IUniform<Vector4[]>;
  /**
   * The ground each hole's person stands on (world y; the hill in the woods is 1.6 high). Only what rises above it
   * can hide them: the ground and the stones round their feet on a hill are never dithered (owner, 2026-11-25: "nó
   * đứng trên đồi mà?").
   */
  holeFloor: IUniform<number[]>;
}

export interface Materials {
  shared: Shared;
  /** Every merged thing: colours in the vertices. */
  std: MeshStandardMaterial;
  /** The same, a little brighter (under the pointer). */
  hot: MeshStandardMaterial;
  /** The same, see-through (a house in front of the player). */
  faded: MeshStandardMaterial;
  /** Window glass: blue by day, warm light at night (emissive set per place by its lit share). */
  glass: (glow: number) => MeshStandardMaterial;
  /** Lamp bulbs, the cinema's marquee, string lights: glow at night. */
  bulb: MeshStandardMaterial;
  /** Trees, bushes, tufts and flowers (instanced): sway with the wind. */
  sway: MeshStandardMaterial;
  water: MeshStandardMaterial;
  /** Soft additive halos round lamps at night and fireflies. */
  halo: MeshBasicMaterial;
  /** Set the night amount (0..1) everywhere it shows. */
  setNight: (k: number) => void;
  dispose: () => void;
}

const GLASS_DAY = new Color(C.glass);
const GLASS_NIGHT = new Color('#3b3f6b');
const GLOW = new Color(C.glow);

/** Cut dithered holes where something stands between the camera and a person (Shared.holes). */
function addHoles(shader: WebGLProgramParametersWithUniforms, shared: Shared): void {
  shader.uniforms.uHoles = shared.holes;
  shader.uniforms.uHoleFloor = shared.holeFloor;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vHoleZ;\nvarying float vHoleY;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vHoleZ = mvPosition.z;
      #ifdef USE_INSTANCING
        vHoleY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
      #else
        vHoleY = (modelMatrix * vec4(transformed, 1.0)).y;
      #endif`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec4 uHoles[2];\nuniform float uHoleFloor[2];\nvarying float vHoleZ;\nvarying float vHoleY;')
    .replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      if (vHoleY > 0.12) {
        for (int i = 0; i < 2; i++) {
          vec4 h = uHoles[i];
          if (h.z <= 0.0 || vHoleZ < h.w + 0.35 || vHoleY <= uHoleFloor[i] + 0.12) continue;
          float d = distance(gl_FragCoord.xy, h.xy) / h.z;
          if (d >= 1.0) continue;
          // a soft, noise-like dither (interleaved gradient noise: no regular checkerboard to catch the eye): about
          // two fifths of the pixels kept in the middle, all of them at the rim
          float keep = mix(0.4, 1.0, smoothstep(0.5, 1.0, d));
          float ign = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
          if (ign > keep) discard;
        }
      }`,
    );
}

/** Add the wind to a material's vertex shader: higher vertices move more, each instance at its own moment. */
function addSway(shader: WebGLProgramParametersWithUniforms, shared: Shared): void {
  shader.uniforms.uTime = shared.time;
  shader.uniforms.uSway = shared.sway;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 swayAt = instanceMatrix[3].xz;
      #else
        vec2 swayAt = vec2(0.0);
      #endif
      float swayH = max(0.0, position.y);
      float swayK = uSway * swayH * swayH * 0.035;
      float swayP = uTime * 1.3 + swayAt.x * 0.7 + swayAt.y * 0.45;
      transformed.x += sin(swayP) * swayK;
      transformed.z += cos(swayP * 0.8 + 1.3) * swayK * 0.6;`,
    );
}

/** Ripples on the water: the surface moves a little and catches bright lines of light. */
function addWater(shader: WebGLProgramParametersWithUniforms, shared: Shared): void {
  shader.uniforms.uTime = shared.time;
  shader.uniforms.uSway = shared.sway;
  shader.uniforms.uNight = shared.night;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;\nvarying vec3 vWorld;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float wv = sin(position.x * 3.1 + uTime * 1.4) * 0.5 + sin(position.z * 2.7 - uTime * 1.1) * 0.5;
      transformed.y += wv * 0.012 * uSway;`,
    )
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;\nuniform float uNight;\nvarying vec3 vWorld;')
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float tt = uTime * uSway;
      float r1 = sin(vWorld.x * 5.0 + vWorld.z * 2.0 + tt * 1.6);
      float r2 = sin(vWorld.z * 6.0 - vWorld.x * 1.5 - tt * 1.2);
      float lines = smoothstep(0.86, 0.99, r1 * 0.5 + r2 * 0.5 + 0.12 * sin(tt * 0.7 + vWorld.x));
      diffuseColor.rgb += lines * mix(vec3(0.55, 0.62, 0.62), vec3(0.18, 0.2, 0.32), uNight);`,
    );
}

export function makeMaterials(): Materials {
  const shared: Shared = { time: { value: 0 }, sway: { value: 1 }, night: { value: 0 }, holes: { value: [new Vector4(), new Vector4()] }, holeFloor: { value: [0, 0] } };
  const std = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  std.onBeforeCompile = (s) => addHoles(s, shared);
  std.customProgramCacheKey = () => 'town-std';
  const hot = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, emissive: '#fff4dc', emissiveIntensity: 0.14 });
  hot.onBeforeCompile = (s) => addHoles(s, shared);
  hot.customProgramCacheKey = () => 'town-hot';
  const faded = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
  const glassList: { mat: MeshStandardMaterial; glow: number }[] = [];
  let night = 0;
  const paintGlass = (m: MeshStandardMaterial, glow: number) => {
    m.color.copy(GLASS_DAY).lerp(GLASS_NIGHT, night);
    m.emissive.copy(GLOW);
    m.emissiveIntensity = (0.08 + night * 1.6) * glow;
  };
  // one material per glow step (a twentieth): places with the same share of lines lit share their glass
  const glass = (glow: number) => {
    const g = Math.round(Math.max(0, Math.min(1, glow)) * 20) / 20;
    const hit = glassList.find((e) => e.glow === g);
    if (hit) return hit.mat;
    const mat = new MeshStandardMaterial({ color: C.glass, roughness: 0.25, metalness: 0.05 });
    glassList.push({ mat, glow: g });
    paintGlass(mat, g);
    return mat;
  };
  const bulb = new MeshStandardMaterial({ color: '#fff4d6', emissive: GLOW, emissiveIntensity: 0.2, roughness: 0.4 });
  const sway = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  sway.onBeforeCompile = (s) => {
    addSway(s, shared);
    addHoles(s, shared);
  };
  sway.customProgramCacheKey = () => 'town-sway';
  const water = new MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.0, transparent: true, opacity: 0.82, depthWrite: false });
  water.onBeforeCompile = (s) => addWater(s, shared);
  water.customProgramCacheKey = () => 'town-water';
  const halo = new MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const all: Material[] = [std, hot, faded, bulb, sway, water, halo];
  return {
    shared,
    std,
    hot,
    faded,
    glass,
    bulb,
    sway,
    water,
    halo,
    setNight: (k) => {
      night = k;
      shared.night.value = k;
      for (const g of glassList) paintGlass(g.mat, g.glow);
      bulb.emissiveIntensity = 0.15 + k * 2.4;
      halo.opacity = 0.55 * Math.max(0, (k - 0.3) / 0.7);
    },
    dispose: () => {
      for (const m of all) m.dispose();
      for (const g of glassList) g.mat.dispose();
      glassList.length = 0;
    },
  };
}
