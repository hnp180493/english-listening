// What lies round the island (docs/town.md §7 "The coast and the mountains"; owner, 2026-11-24: "có biển / núi non
// này nọ cũng được"): the sea all round it, out to the edge of the view, and a range of mountains rising behind its two
// far sides (x < 0 and y < 0 on the tile grid), with snow on the peaks, two passes where the farm lane and the shore
// walk leave the map, and the falls that feed the big lake's stream. Seen only: nobody walks there (the map is the
// island's tiles). Built once; the sea moves with the town's water material, the falls with their own.
//
// Cheap on purpose (a phone draws it too): the mountains are one height field of about 10,000 quads in the town's
// own material, the sea a coarse grid of two planes (its floor and its surface), the falls a few dozen triangles.

import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three';
import type { TownWorld } from '../../../../data/townWorld';
import { hash2, valueNoise } from './coords';
import { CUT_BANK, EDGE_LIFT, FALLS_OUT, FALLS_TOP, FALLS_Z, mountainHeight, RANGE_DEPTH, ROAD_CLIMB, smooth, TOWN_RANGE } from './range';
import { buildClouds, type Clouds } from './clouds';
import type { Materials } from './materials';
import { C } from './palette3d';
import { POND_BED, WATER_LEVEL } from './terrain';

/** How far the sea is drawn in fine cells round the island (tiles); beyond, four wide planes run on to SEA_FAR. */
const SEA_REACH = 96;
const SEA_FAR = 1400;

export interface Backdrop {
  group: Group;
  /** The mountains' height at a point (tile coordinates; below 0 in the sea, 0 on the island and the near sea). */
  heightAt: (x: number, z: number) => number;
  /** Low cloud on the range and banks over the far corners' sea (clouds.ts): what of the sky the camera ever sees. */
  clouds: Clouds;
  dispose: () => void;
}

function colourAt(h: number, slope: number, x: number, z: number, out: Color): Color {
  const n = valueNoise(x * 0.4, z * 0.4, 51);
  if (h < WATER_LEVEL + 0.25) return out.set(C.sand).lerp(new Color(C.sandDeep), n * 0.6);
  const grass = new Color(C.grassDeep).lerp(new Color(C.grass), n);
  const forest = new Color(C.pineDeep).lerp(new Color(C.pine), n * 0.7);
  const rock = new Color(C.rock).lerp(new Color(C.stoneDark), n * 0.6);
  const snow = new Color('#f4f7fb').lerp(new Color('#dfe8f4'), n);
  // low: grass into forest; higher: forest into rock; the top: snow (less on the steep faces)
  if (h < 3.5) out.copy(grass).lerp(forest, smooth(0.6, 3.2, h));
  else if (h < 7.5) out.copy(forest).lerp(rock, smooth(3.8, 7.2, h + slope * 1.5));
  else out.copy(rock);
  const snowLine = 10.2 + (n - 0.5) * 2.2;
  if (h > snowLine) out.lerp(snow, smooth(snowLine, snowLine + 1.1, h) * (1 - smooth(1.1, 2.2, slope)));
  // steep faces show their rock whatever the height
  if (h > 1.2) out.lerp(rock, smooth(1.3, 2.4, slope) * 0.7);
  return out;
}

/** A grid of quads over [x0, x1] × [z0, z1] in steps of `step`, skipping cells `skip` says; heights and colours per vertex. */
function gridGeometry(x0: number, z0: number, x1: number, z1: number, step: number, height: (x: number, z: number) => number, colour: (x: number, z: number, h: number, out: Color) => Color, skip: (cx: number, cz: number) => boolean): BufferGeometry | null {
  const nx = Math.round((x1 - x0) / step);
  const nz = Math.round((z1 - z0) / step);
  const pos: number[] = [];
  const cols: number[] = [];
  const idx: number[] = [];
  const ids = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const c = new Color();
  const vertex = (i: number, j: number): number => {
    const k = j * (nx + 1) + i;
    if (ids[k] >= 0) return ids[k];
    const x = x0 + i * step;
    const z = z0 + j * step;
    const h = height(x, z);
    pos.push(x, h, z);
    colour(x, z, h, c);
    cols.push(c.r, c.g, c.b);
    ids[k] = pos.length / 3 - 1;
    return ids[k];
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (skip(x0 + (i + 0.5) * step, z0 + (j + 0.5) * step)) continue;
      const a = vertex(i, j);
      const b = vertex(i + 1, j);
      const d = vertex(i, j + 1);
      const e = vertex(i + 1, j + 1);
      // the diagonal along the hash: no visible grain of the grid
      if (hash2(i, j, 61) < 0.5) idx.push(a, d, b, b, d, e);
      else idx.push(a, d, e, a, e, b);
    }
  }
  if (idx.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The falls: a sheet of water coming over the cliff into the pool, its streaks running down (uTime). */
function fallsMaterial(mats: Materials): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = mats.shared.time;
    s.uniforms.uNight = mats.shared.night;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFlow;\nvarying vec2 vFlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = aFlow;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uNight;\nvarying vec2 vFlow;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float streak = sin(vFlow.x * 37.0 + sin(vFlow.x * 9.0) * 2.0) * 0.5 + 0.5;
        float run = fract(vFlow.y * 3.0 - uTime * 1.6 + streak * 0.35);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), smoothstep(0.55, 0.95, run) * 0.55 * streak);
        diffuseColor.rgb *= mix(1.0, 0.34, uNight);`,
      );
  };
  m.customProgramCacheKey = () => 'town-falls';
  return m;
}

export function buildBackdrop(world: TownWorld, mats: Materials): Backdrop {
  const group = new Group();
  group.name = 'backdrop';
  const S = world.size;
  const geos: BufferGeometry[] = [];
  const own: Material[] = [];
  const add = (g: BufferGeometry | null, mat: Material, order = 0): Mesh | null => {
    if (!g) return null;
    geos.push(g);
    const m = new Mesh(g, mat);
    m.renderOrder = order;
    group.add(m);
    return m;
  };
  const shape = world.range ?? TOWN_RANGE;
  const heightAt = (x: number, z: number) => mountainHeight(x, z, S, shape);
  /** On a road's cutting through the range (a world whose passes carry roads): no pines there. */
  const onCut = (x: number, z: number) => shape.roads && ((z < 0 && x >= 0 && shape.north.some((at) => Math.abs(x - at) < CUT_BANK - 1.5)) || (x < 0 && z >= 0 && shape.west.some((at) => Math.abs(z - at) < CUT_BANK - 1.5)));
  const R = RANGE_DEPTH;

  // ── the mountains: an L round the two far sides, finer near the island ──
  const slopeAt = (x: number, z: number) => {
    const e = 0.6;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  const paint = (x: number, z: number, h: number, out: Color) => colourAt(h, slopeAt(x, z), x, z, out);
  const inIsland = (cx: number, cz: number) => cx >= 0 && cz >= 0;
  add(gridGeometry(-R, -R, S + 8, S + 8, 0.75, heightAt, paint, (cx, cz) => inIsland(cx, cz) || (cx > 0 && cz > 0)), mats.std);

  // pines on the lower slopes (one merged mesh: a few hundred cones, never walked among)
  {
    const pos: number[] = [];
    const cols: number[] = [];
    const deep = new Color(C.pineDeep);
    const light = new Color(C.pine);
    let n = 0;
    for (let i = 0; i < 2600 && n < 420; i++) {
      const along = hash2(i, 1, 71) * (S + 12) - 4;
      const out = 0.8 + hash2(i, 2, 71) ** 1.4 * 13;
      const west = hash2(i, 3, 71) < 0.5;
      const x = west ? -out : along;
      const z = west ? along : -out;
      const h = heightAt(x, z);
      if (h < 0.3 || h > 6.2 || slopeAt(x, z) > 1.5) continue;
      // not in the falls' ravine, not on a road
      if (shape.falls && west && Math.abs(z - FALLS_Z) < 2.4) continue;
      if (onCut(x, z)) continue;
      n++;
      const s = 0.7 + hash2(i, 4, 71) * 0.6;
      const c = deep.clone().lerp(light, hash2(i, 5, 71) * 0.8);
      // two stacked cones of 6 sides
      for (const [r, y0, y1] of [
        [0.42, 0.25, 1.15],
        [0.3, 0.75, 1.55],
      ] as const) {
        for (let k = 0; k < 6; k++) {
          const a0 = (k / 6) * Math.PI * 2;
          const a1 = ((k + 1) / 6) * Math.PI * 2;
          pos.push(x + Math.cos(a0) * r * s, h + y0 * s, z + Math.sin(a0) * r * s, x, h + y1 * s, z, x + Math.cos(a1) * r * s, h + y0 * s, z + Math.sin(a1) * r * s);
          for (let v = 0; v < 3; v++) cols.push(c.r, c.g, c.b);
        }
      }
      // the trunk's foot as a dark disc is not worth its triangles from up here
    }
    if (pos.length) {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new Float32BufferAttribute(cols, 3));
      g.computeVertexNormals();
      add(g, mats.std);
    }
  }

  // ── the sea: a floor that gets deeper away from the island and the water over it, out to the edge of the view ──
  const F = SEA_REACH;
  const bed = new Color(C.sand).lerp(new Color(C.earth), 0.25);
  const deepBed = new Color('#3c7f9c');
  const farBed = new Color('#2f6e93');
  const outFrom = (x: number, z: number) => Math.max(0, -x, -z, x - S, z - S);
  const seaSkip = (cx: number, cz: number) => cx > 0 && cz > 0 && cx < S && cz < S;
  add(
    gridGeometry(-F, -F, S + F, S + F, 6, (x, z) => POND_BED - Math.min(1.6, outFrom(x, z) * 0.05), (x, z, _h, out) => out.copy(bed).lerp(deepBed, smooth(0, 10, outFrom(x, z))).lerp(farBed, smooth(20, 90, outFrom(x, z))), seaSkip),
    mats.std,
  );
  const waterDeep = new Color(C.waterDeep);
  const waterFar = new Color('#3d8fc0');
  const sea = add(gridGeometry(-F, -F, S + F, S + F, 6, () => WATER_LEVEL, (x, z, _h, out) => out.copy(waterDeep).lerp(waterFar, smooth(15, 80, outFrom(x, z))), seaSkip), mats.water, 2);
  if (sea) sea.receiveShadow = true;
  // on to the horizon: a ring of four wide quads in the far colours (a phone's tall view of the whole island reaches far)
  {
    const far = (y: number, c: Color, mat: Material, order: number) => {
      const a = -F;
      const b = S + F;
      const A = -SEA_FAR;
      const B = S + SEA_FAR;
      const quads: [number, number, number, number][] = [
        [A, A, B, a],
        [A, b, B, B],
        [A, a, a, b],
        [b, a, B, b],
      ];
      const pos: number[] = [];
      for (const [x0, z0, x1, z1] of quads) pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: pos.length / 3 }, () => [c.r, c.g, c.b]).flat(), 3));
      g.computeVertexNormals();
      const m = add(g, mat, order);
      if (m) m.frustumCulled = false;
    };
    far(POND_BED - 1.6, farBed, mats.std, 0);
    far(WATER_LEVEL, waterFar, mats.water, 2);
  }

  // ── the roads out: each street that reaches a far edge runs on through its cutting, over the range and away ──
  if (shape.roads) {
    const pos: number[] = [];
    const cols: number[] = [];
    const road = new Color('#cdb996');
    const edge = new Color('#b9a582');
    const HALF = 1;
    const STEP = 0.75;
    const strip = (at: number, west: boolean) => {
      for (let d = 0; d < R - 2; d += STEP) {
        const y0 = EDGE_LIFT + d * ROAD_CLIMB + 0.02;
        const y1 = EDGE_LIFT + (d + STEP) * ROAD_CLIMB + 0.02;
        // (x, z) of the four corners: out along −x (west) or −z (north)
        const q = west
          ? [
              [-d, y0, at - HALF],
              [-d, y0, at + HALF],
              [-d - STEP, y1, at + HALF],
              [-d - STEP, y1, at - HALF],
            ]
          : [
              [at + HALF, y0, -d],
              [at - HALF, y0, -d],
              [at - HALF, y1, -d - STEP],
              [at + HALF, y1, -d - STEP],
            ];
        for (const v of [q[0], q[2], q[1], q[0], q[3], q[2]]) pos.push(v[0], v[1], v[2]); // (wound to face up)
        // a darker band every few steps: the road reads as a road from far off
        const c = Math.floor(d / STEP) % 6 === 0 ? edge : road;
        for (let k = 0; k < 6; k++) cols.push(c.r, c.g, c.b);
      }
    };
    for (const at of shape.west) strip(at, true);
    for (const at of shape.north) strip(at, false);
    if (pos.length) {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new Float32BufferAttribute(cols, 3));
      g.computeVertexNormals();
      // drawn over the ground it lies on, never fighting it (a road a hair over a slope flickered from afar)
      const roadMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      own.push(roadMat);
      const m = add(g, roadMat, 1);
      if (m) m.receiveShadow = true;
    }
  }

  // ── the falls: over the cliff at row 41 into the pool, and the pool and the stream on to the island's edge ──
  if (shape.falls) {
    const pos: number[] = [];
    const cols: number[] = [];
    const flow: number[] = [];
    const top = new Color('#d6f1f7');
    const foot = new Color('#a7dde9');
    const W = 1.5;
    const N = 10;
    // down the face: out from the cliff's lip, curving to the pool
    const at = (t: number) => {
      const x = -FALLS_OUT + t * 1.1 + t * t * 0.6;
      const y = FALLS_TOP + 0.06 - (FALLS_TOP - WATER_LEVEL + 0.06) * t * t * (1.2 - 0.2 * t);
      return { x, y };
    };
    for (let i = 0; i < N; i++) {
      const a = at(i / N);
      const b = at((i + 1) / N);
      for (let k = 0; k < 3; k++) {
        const z0 = FALLS_Z - W / 2 + (W * k) / 3;
        const z1 = z0 + W / 3;
        const q = [
          [a.x, a.y, z0, k / 3, i / N],
          [a.x, a.y, z1, (k + 1) / 3, i / N],
          [b.x, b.y, z1, (k + 1) / 3, (i + 1) / N],
          [b.x, b.y, z0, k / 3, (i + 1) / N],
        ];
        for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) {
          pos.push(v[0], v[1], v[2]);
          const c = top.clone().lerp(foot, v[4]);
          cols.push(c.r, c.g, c.b);
          flow.push(v[3], v[4]);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(cols, 3));
    g.setAttribute('aFlow', new Float32BufferAttribute(flow, 2));
    const fm = fallsMaterial(mats);
    own.push(fm);
    const m = add(g, fm, 3);
    if (m) m.frustumCulled = false;
    // the creek above the falls (the pool below is the sea's surface: the ravine's floor there lies under it)
    const waters: BufferGeometry[] = [];
    const plane = (x0: number, z0: number, x1: number, z1: number, y: number, c: Color) => {
      const p = new BufferGeometry();
      p.setAttribute('position', new Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0], 3));
      p.setAttribute('color', new Float32BufferAttribute(Array.from({ length: 6 }, () => [c.r, c.g, c.b]).flat(), 3));
      p.computeVertexNormals();
      waters.push(p);
    };
    plane(-12, FALLS_Z - 0.75, -FALLS_OUT + 0.05, FALLS_Z + 0.75, FALLS_TOP + 0.06, new Color(C.waterShallow));
    for (const w of waters) add(w, mats.water, 2);
    // spray at the foot: a few soft white blobs
    const spray = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    own.push(spray);
    const sp: number[] = [];
    for (let i = 0; i < 7; i++) {
      const cx = -FALLS_OUT + 1.7 + (hash2(i, 1, 81) - 0.5) * 0.9;
      const cz = FALLS_Z + (hash2(i, 2, 81) - 0.5) * 1.4;
      const r = 0.25 + hash2(i, 3, 81) * 0.25;
      const cy = WATER_LEVEL + 0.15 + hash2(i, 4, 81) * 0.3;
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2;
        const a1 = ((k + 1) / 8) * Math.PI * 2;
        sp.push(cx, cy + r * 0.8, cz, cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r);
      }
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new Float32BufferAttribute(sp, 3));
    add(sg, spray, 3);
  }

  // ── the clouds the camera can see: on the range and over the sea at the far corners ──
  const clouds = buildClouds(S, heightAt);
  group.add(clouds.mesh);

  return {
    group,
    heightAt,
    clouds,
    dispose: () => {
      for (const g of geos) g.dispose();
      for (const m of own) m.dispose();
      clouds.dispose();
    },
  };
}
