// The few materials every character shares (one program for all of them): soft toon shading with a lifted shadow
// side (no harsh terminator, no specular), vertex colours, a faint rim light so figures read against the ground.

import { Color, DataTexture, LinearFilter, MeshToonMaterial, RedFormat, type Material, type Texture } from 'three';
import { faceAtlas } from './face';

let ramp: DataTexture | null = null;

/** Soft 4-step ramp, filtered linearly: the shadow side stays light and warm-ish, the turn is gentle. */
export function toonRamp(): Texture {
  if (ramp) return ramp;
  const data = new Uint8Array([120, 168, 215, 245, 255]);
  ramp = new DataTexture(data, data.length, 1, RedFormat);
  ramp.minFilter = LinearFilter;
  ramp.magFilter = LinearFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

/** The rim's strength (shared uniform: night turns it down, it is not lit by anything). */
const RIM_DAY = 0.35;
const rimUniform = { value: RIM_DAY };

/** Adds a soft rim (fresnel) light on top of the toon shading. */
function withRim(m: MeshToonMaterial): MeshToonMaterial {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = rimUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float rimStrength;')
      .replace(
        '#include <opaque_fragment>',
        `{
  float rim = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  rim = smoothstep(0.55, 1.0, rim) * rimStrength;
  outgoingLight += diffuseColor.rgb * rim * 0.55;
}
#include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'chars-rim';
  return m;
}

export interface SharedMaterials {
  /** Bodies, hair, clothes, hats, props, pets (vertex colours). */
  body: MeshToonMaterial;
  /** Faces (the atlas, transparent, drawn over the head). */
  face: MeshToonMaterial;
  /** Every material, for night tint and dispose. */
  all: Material[];
}

let shared: SharedMaterials | null = null;

export function materials(): SharedMaterials {
  if (shared) return shared;
  const body = withRim(new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
  const face = new MeshToonMaterial({
    map: faceAtlas(),
    gradientMap: toonRamp(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  shared = { body, face, all: [body, face] };
  return shared;
}

const NIGHT = new Color('#3a3f5c');

/**
 * Night tint 0 … 1. The materials are shared, so this is town-wide (every person gets the same value from the
 * scene): a faint cool self-light keeps faces readable under night lights.
 */
let tintNow = 0;

/** The night tint the shared materials have now (pictures drawn off the stage set 0 for a moment, then put it back). */
export function nightTint(): number {
  return tintNow;
}

export function setNightTint(amount: number): void {
  const m = materials();
  const k = Math.max(0, Math.min(1, amount));
  tintNow = k;
  for (const mat of [m.body, m.face]) {
    mat.emissive.copy(NIGHT);
    mat.emissiveIntensity = 0.12 * k;
  }
  rimUniform.value = RIM_DAY * (1 - 0.8 * k);
}

/** Free the shared materials and textures (only when no character is left, e.g. leaving the town page). */
export function disposeSharedMaterials(): void {
  if (!shared) return;
  for (const m of shared.all) m.dispose();
  shared = null;
  ramp?.dispose();
  ramp = null;
}
