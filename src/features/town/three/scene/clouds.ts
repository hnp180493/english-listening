// Clouds the player can actually see (docs/town.md §24 "Clouds and the moon"). The camera looks down at 33° (26° in
// a conversation) with a narrow lens, so the sky itself is never in the picture: a cloud overhead would be drawn for
// nobody. What does show: low cloud lying on the mountains behind the far sides (from the edge of town and in the
// overview) and banks over the open sea at the two far corners (the overview, and the island's sides). Their shadows
// on the ground were already there (weather3d.ts). How many show, how big, how grey and how lit go with the sky:
// a few small white puffs on a clear day, most of them on a cloudy one, all of them low and dark in rain and storm,
// pink-gold at dawn and dusk, a dim blue-grey at night. The sea's banks drift with the wind; cloud on the mountains
// stays where it is, as it does.
//
// One mesh, one draw call, no shadow, no new pass: every puff is a few flattened balls merged together, and the
// vertex shader grows, hides and moves them from a handful of uniforms.

import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Mesh, ShaderMaterial, Sphere, Vector3 } from 'three';
import { hash2 } from './coords';

/** How many puffs over the range and over the sea's far corners. */
const RANGE_PUFFS = 30;
const SEA_PUFFS = 16;

const VERT = /* glsl */ `
uniform float uAmount;
uniform float uLow;
uniform float uDrift;
attribute vec4 aPuff;
attribute vec3 aLane;
varying float vUp;
varying float vFar;
void main() {
  // shown once the sky's cloud is past the puff's own threshold, growing in over a little more
  float seed = aPuff.w;
  float grow = smoothstep(seed * 0.85, seed * 0.85 + 0.15, uAmount);
  // rain brings them down and spreads them
  float s = grow * mix(1.0, 1.25, uLow);
  vec3 c = aPuff.xyz;
  c.y = mix(c.y, c.y * 0.72, uLow);
  // a bank at sea drifts along its lane with the wind and is wrapped round (shrinking out at either end)
  float along = 0.0;
  if (aLane.z > 0.0) {
    float u = fract(seed * 7.13 + uDrift / aLane.z);
    along = (u - 0.5) * aLane.z;
    s *= smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.88, 1.0, u));
  }
  c.x += aLane.x * along;
  c.z += aLane.y * along;
  vec3 p = c + position * s;
  vUp = normal.y * 0.5 + 0.5;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vFar = length(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
  if (s < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uMist;
uniform float uHaze;
varying float vUp;
varying float vFar;
void main() {
  vec3 col = mix(uBottom, uTop, smoothstep(0.15, 0.95, vUp));
  // far off they fade into the air, as everything else does
  col = mix(col, uMist, clamp(uHaze * 0.6 + smoothstep(60.0, 220.0, vFar) * 0.35, 0.0, 0.85));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface CloudLight {
  /** How cloudy (sky.ts mix.cloud), how much of it is rain and storm, 0 … 1 each. */
  cloud: number;
  rain: number;
  storm: number;
  /** 0 day … 1 night, and the gold of dawn and dusk. */
  night: number;
  glow: number;
  /** The mist's colour (the horizon's: skyLook.ts) and how misty. */
  mist: Color;
  haze: number;
}

export interface Clouds {
  mesh: Mesh;
  /** The sky now: what shows and its colours. */
  setSky(l: CloudLight): void;
  /** Each frame: the banks at sea drift with the wind (`still`: reduced motion, they stay). */
  tick(dt: number, wind: number, still: boolean): void;
  dispose(): void;
}

/** One puff: a few flattened balls round its middle (local to it, in tiles). */
function puffShape(i: number, size: number, ball: BufferGeometry, pos: number[], nor: number[]): number {
  const n = 3 + Math.floor(hash2(i, 1, 91) * 3);
  const bp = ball.getAttribute('position');
  const bn = ball.getAttribute('normal');
  let count = 0;
  for (let k = 0; k < n; k++) {
    const r = size * (0.55 + hash2(i, k + 10, 91) * 0.5) * (k === 0 ? 1.2 : 1);
    const ox = (k === 0 ? 0 : (hash2(i, k + 20, 91) - 0.5) * 2.2) * size;
    const oz = (k === 0 ? 0 : (hash2(i, k + 30, 91) - 0.5) * 1.4) * size;
    const oy = (k === 0 ? 0.1 : hash2(i, k + 40, 91) * 0.25) * size;
    for (let v = 0; v < bp.count; v++) {
      pos.push(ox + bp.getX(v) * r, oy + bp.getY(v) * r * 0.5, oz + bp.getZ(v) * r * 0.8);
      nor.push(bn.getX(v), bn.getY(v), bn.getZ(v));
      count++;
    }
  }
  return count;
}

/**
 * The puffs round an island of `size` tiles whose range of mountains lies behind its far sides (x < 0, z < 0), its
 * heights from `heightAt`.
 */
export function buildClouds(size: number, heightAt: (x: number, z: number) => number): Clouds {
  const S = size;
  const ball = new IcosahedronGeometry(1, 1).toNonIndexed();
  const pos: number[] = [];
  const nor: number[] = [];
  const puff: number[] = [];
  const lane: number[] = [];
  const put = (i: number, x: number, y: number, z: number, sz: number, lx: number, lz: number, span: number) => {
    const n = puffShape(i, sz, ball, pos, nor);
    // (a sorted spread of thresholds: the first few show on a clear day, all of them in rain)
    const seed = ((i * 0.618034) % 1) * 0.95;
    for (let v = 0; v < n; v++) {
      puff.push(x, y, z, seed);
      lane.push(lx, lz, span);
    }
  };
  // on the range: along its two arms, a little out from the island, lying a few tiles over the slopes
  for (let i = 0; i < RANGE_PUFFS; i++) {
    const west = i % 2 === 0;
    const along = -12 + hash2(i, 2, 93) * (S + 22);
    const out = 7 + hash2(i, 3, 93) * 18;
    const x = west ? -out : along;
    const z = west ? along : -out;
    const y = Math.max(6, heightAt(x, z) + 2.5 + hash2(i, 4, 93) * 3.5);
    put(i, x, y, z, 2.4 + hash2(i, 5, 93) * 2.2, 0, 0, 0);
  }
  // over the sea at the far corners (beyond the range's ends): banks in lanes along the wind
  for (let k = 0; k < SEA_PUFFS; k++) {
    const i = RANGE_PUFFS + k;
    const north = k % 2 === 0;
    const off = 10 + hash2(i, 2, 95) * 50;
    const side = 8 + hash2(i, 3, 95) * 40;
    // the corner past the north arm's end (x > S, z < 0) and past the west arm's (x < 0, z > S)
    const x = north ? S + side : -off;
    const z = north ? -off : S + side;
    const y = 3.5 + hash2(i, 4, 95) * 4;
    put(i, x, y, z, 3 + hash2(i, 5, 95) * 3, north ? 0 : 1, north ? 1 : 0, 70);
  }
  ball.dispose();
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('aPuff', new Float32BufferAttribute(puff, 4));
  geo.setAttribute('aLane', new Float32BufferAttribute(lane, 3));
  // (the shader moves them: a sphere round the whole ring, never culled away)
  geo.boundingSphere = new Sphere(new Vector3(S / 2, 8, S / 2), S * 1.6 + 120);
  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uAmount: { value: 0 },
      uLow: { value: 0 },
      uDrift: { value: 0 },
      uTop: { value: new Color('#ffffff') },
      uBottom: { value: new Color('#d0d6e0') },
      uMist: { value: new Color('#dfe8f0') },
      uHaze: { value: 0 },
    },
  });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'clouds';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // drawn after the mountains and the sea (opaque, so the order only saves work)
  mesh.renderOrder = 4;
  const u = mat.uniforms;
  const top = new Color();
  const bottom = new Color();
  const tint = { dayTop: new Color('#ffffff'), dayLow: new Color('#d3d9e3'), greyTop: new Color('#b4bcc7'), greyLow: new Color('#8a929e'), stormTop: new Color('#7d8591'), stormLow: new Color('#535a66'), gold: new Color('#ffc59a'), nightTop: new Color('#46506c'), nightLow: new Color('#262c40') };
  return {
    mesh,
    setSky(l) {
      // a clear day keeps a few small ones; the more cloud, the more show
      u.uAmount.value = Math.min(1, 0.18 + 0.82 * l.cloud + 0.2 * l.rain);
      u.uLow.value = Math.min(1, l.rain * 0.8 + l.storm * 0.4);
      const grey = Math.min(1, l.rain * 0.9 + l.cloud * 0.4);
      top.copy(tint.dayTop).lerp(tint.greyTop, grey).lerp(tint.stormTop, l.storm);
      bottom.copy(tint.dayLow).lerp(tint.greyLow, grey).lerp(tint.stormLow, l.storm);
      // dawn and dusk light them from below and on top
      top.lerp(tint.gold, Math.min(1, l.glow) * 0.55 * (1 - 0.6 * grey));
      bottom.lerp(tint.gold, Math.min(1, l.glow) * 0.3 * (1 - 0.6 * grey));
      top.lerp(tint.nightTop, l.night * 0.9);
      bottom.lerp(tint.nightLow, l.night * 0.9);
      (u.uTop.value as Color).copy(top);
      (u.uBottom.value as Color).copy(bottom);
      (u.uMist.value as Color).copy(l.mist);
      u.uHaze.value = l.haze;
    },
    tick(dt, wind, still) {
      if (still) return;
      u.uDrift.value += dt * (0.25 + 1.2 * wind);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
