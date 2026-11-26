// The ground of the 3D town, built once from the map's rows: the island (a soft grass top over layered earth, a
// diorama floating in the sky), grass with gentle colour variation and a sandy shore, cobbled paths, the plaza's
// patterned paving with its curb, the pond (sandy bed, earthen banks, an animated surface). Chunked so the camera
// culls what it does not see.

import { Color, CylinderGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, type BufferGeometry } from 'three';
import { groundHeight, type TownWorld } from '../../../../data/townWorld';
import { groundOf, hash2, valueNoise } from './coords';
import { WATER_DEEP, WATER_SHALLOW, type Materials } from './materials';
import { Merge, shadeColor, shapes } from './merge';
import { C } from './palette3d';
import { seaShore, ShoreField, smoothShore } from './shore';

/** Paving slabs per tile side on the plaza, pebbles per tile side on a path. */
const PLAZA_N = 2;
const COBBLE_N = 2;
/** Cells per tile side along the rounded shore. */
const SHORE_N = 4;
/** Tiles per side of a ground chunk (frustum culling works per chunk). */
const CHUNK = 11;
/** The pond: its bed this deep, its surface this low. */
export const POND_BED = -0.34;
export const WATER_LEVEL = -0.1;

const col = (hex: string) => new Color(hex);

/** A paving slab of side 1, height 1, with sloped edges (16 triangles), centred. */
const slab = () => shapes.custom('slab', () => new CylinderGeometry(0.62, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4), true);

export interface Terrain {
  group: Group;
  dispose: () => void;
}

export function buildTerrain(world: TownWorld, mats: Materials): Terrain {
  const group = new Group();
  group.name = 'terrain';
  const geos: BufferGeometry[] = [];
  const mesh = (g: BufferGeometry | null, shadow = { cast: false, receive: true }, mat = mats.std): Mesh | null => {
    if (!g) return null;
    geos.push(g);
    const m = new Mesh(g, mat);
    m.castShadow = shadow.cast;
    m.receiveShadow = shadow.receive;
    group.add(m);
    return m;
  };
  const S = world.size;
  const ground = (x: number, y: number) => groundOf(world, x, y);
  // the hill: its tiles lie on the height field (finer cells, smooth normals); the rest of the town is flat
  // (kept per point: a vertex of the hill's fine cells is asked for by every cell round it, and its normal by the
  // points beside it; four hills on the 72-tile island took 170 ms of the town's first long task without it)
  const heights = new Map<number, number>();
  const lift = (x: number, z: number) => {
    const k = Math.round(x * 1000) * 1e6 + Math.round(z * 1000);
    let h = heights.get(k);
    if (h === undefined) heights.set(k, (h = groundHeight(x, z, world)));
    return h;
  };
  const hilly = (x: number, y: number) => lift(x, y) > 0 || lift(x + 1, y) > 0 || lift(x, y + 1) > 0 || lift(x + 1, y + 1) > 0 || lift(x + 0.5, y + 0.5) > 0;
  const isWater = (x: number, y: number) => ground(x, y) === 'water';
  // the pond's shore, rounded (shore.ts): the tiles beside it are drawn along that curve, not along their edges
  const sea = seaShore(world);
  const shore = new ShoreField(smoothShore(sea.isWater, sea.size), sea.size);
  const zone = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (ground(x, y) === null) continue;
      const w = isWater(x, y);
      let mixed = false;
      for (let dy = -1; dy <= 1 && !mixed; dy++) for (let dx = -1; dx <= 1; dx++) if (isWater(x + dx, y + dy) !== w && ground(x + dx, y + dy) !== null) mixed = true;
      if (mixed) zone[y * S + x] = 1;
    }
  }
  const nearShore = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && zone[y * S + x] === 1;

  // ── the island: grass rolling over its rounded rim into layers of earth and rock ──
  const base = new Merge();
  // The rounded grassy rim is a frame round the edge, its top just under the grass; inside it the island's floor lies
  // below the pond's bed, so the pond is a real hollow (one whole slab here once covered the water with grass).
  const RIM = 2.25;
  const floorTop = POND_BED - 0.04;
  // (in runs: none along the sea of the coast, where the edge's tiles are water)
  const rimRuns = (edge: (i: number) => boolean): [number, number][] => {
    const runs: [number, number][] = [];
    for (let i = 0; i < S; i++) {
      if (!edge(i)) continue;
      const a = i;
      while (i + 1 < S && edge(i + 1)) i++;
      runs.push([a === 0 ? -0.25 : a, i === S - 1 ? S + 0.25 : i + 1]);
    }
    return runs;
  };
  const land = (x: number, y: number) => !isWater(x, y);
  for (const [a, b] of rimRuns((i) => land(i, 0))) base.add(shapes.box(b - a, 0.9, RIM, 0.32, 3), C.earth, { x: (a + b) / 2, y: -0.47, z: RIM / 2 - 0.25 }, { top: C.grassDeep, ao: false });
  for (const [a, b] of rimRuns((i) => land(i, S - 1))) base.add(shapes.box(b - a, 0.9, RIM, 0.32, 3), C.earth, { x: (a + b) / 2, y: -0.47, z: S + 0.25 - RIM / 2 }, { top: C.grassDeep, ao: false });
  for (const [a, b] of rimRuns((i) => land(0, i))) base.add(shapes.box(RIM, 0.9, b - a, 0.32, 3), C.earth, { x: RIM / 2 - 0.25, y: -0.47, z: (a + b) / 2 }, { top: C.grassDeep, ao: false });
  for (const [a, b] of rimRuns((i) => land(S - 1, i))) base.add(shapes.box(RIM, 0.9, b - a, 0.32, 3), C.earth, { x: S + 0.25 - RIM / 2, y: -0.47, z: (a + b) / 2 }, { top: C.grassDeep, ao: false });
  base.add(shapes.box(S - 1, 0.9 + floorTop + 0.02, S - 1, 0.05, 1), C.earth, { x: S / 2, y: (floorTop - 0.92) / 2, z: S / 2 }, { top: C.earthDeep, ao: false });
  base.add(shapes.box(S - 0.2, 0.8, S - 0.2, 0.3, 3), C.earthDeep, { x: S / 2, y: -1.15, z: S / 2 }, { ao: false });
  base.add(shapes.box(S - 1.6, 0.7, S - 1.6, 0.3, 2), C.rock, { x: S / 2, y: -1.7, z: S / 2 }, { ao: false, shade: -0.1 });
  // a few rocks poking out of the cliff
  for (let i = 0; i < Math.round(S * 0.9); i++) {
    const side = i % 4;
    const along = 0.6 + hash2(i, 3, 91) * (S - 1.2);
    const r = 0.25 + hash2(i, 4, 91) * 0.35;
    const out = S / 2 + 0.12;
    const x = side === 0 ? S / 2 + out : side === 1 ? S / 2 - out : along;
    const z = side === 2 ? S / 2 + out : side === 3 ? S / 2 - out : along;
    if (isWater(Math.min(S - 1, Math.max(0, Math.floor(x))), Math.min(S - 1, Math.max(0, Math.floor(z))))) continue;
    base.add(shapes.blob(1, 0), hash2(i, 5, 91) < 0.5 ? C.rock : C.earthDeep, { x, y: -0.95 - hash2(i, 6, 91) * 0.6, z, s: [r * 1.3, r, r * 1.1], ry: hash2(i, 7, 91) * 6 }, { ao: false });
  }
  mesh(base.build(), { cast: false, receive: true });

  // ── grass, paths and plaza tops, per chunk ──
  const gDeep = col(C.grassDeep);
  const gLight = col(C.grassLight);
  const gMid = col(C.grass);
  const sand = col(C.sand);
  const sandDeep = col(C.sandDeep);
  const pathC = col(C.path);
  const grassOf = (vx: number, vz: number): Color => {
    // gentle large patches + a little fine noise
    const n = valueNoise(vx * 0.33, vz * 0.33, 1) * 0.75 + valueNoise(vx * 1.7, vz * 1.7, 2) * 0.25;
    const c = n < 0.5 ? gDeep.clone().lerp(gMid, n * 2) : gMid.clone().lerp(gLight, (n - 0.5) * 2);
    // the hill: a little lighter up towards its sunny top (the slope reads at a glance from the camera's height)
    const up = lift(vx, vz);
    if (up > 0) c.lerp(gLight, Math.min(0.32, up * 0.2));
    // a sandy shore where the grass meets the pond, a worn edge along the paths
    const tx = Math.round(vx);
    const tz = Math.round(vz);
    let water = 0;
    let path = 0;
    let beach = 0;
    for (const [dx, dz] of [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ]) {
      const g = ground(tx + dx, tz + dz);
      if (g === 'water') water++;
      else if (g === 'path' || g === 'plaza') path++;
      else if (g === 'sand') beach++;
    }
    // the coast's sand: blended over the grass by how many of the vertex's tiles are sand, with soft patches of darker sand
    if (beach > 0) c.lerp(sand.clone().lerp(sandDeep, valueNoise(vx * 0.45, vz * 0.45, 7) * 0.7), beach === 4 ? 1 : beach * 0.24);
    const exact = Math.abs(vx - tx) < 1e-6 && Math.abs(vz - tz) < 1e-6;
    if (water > 0 && exact) c.lerp(sand, 0.9);
    else if (path > 0 && exact) c.lerp(pathC, 0.18);
    return c;
  };
  // (kept per vertex, shared: a vertex belongs to the four cells round it; never changed in place by the callers)
  const grassKept = new Map<number, Color>();
  const grassAt = (vx: number, vz: number): Color => {
    const k = Math.round(vx * 1000) * 1e6 + Math.round(vz * 1000);
    let c = grassKept.get(k);
    if (!c) grassKept.set(k, (c = grassOf(vx, vz)));
    return c;
  };
  const plazaA = col(C.plazaA);
  const plazaB = col(C.plazaB);
  const plazaC = col(C.plazaC);
  const pathBase = col('#cdb996');
  const P = world.plaza;
  for (let cz = 0; cz < S; cz += CHUNK) {
    for (let cx = 0; cx < S; cx += CHUNK) {
      const m = new Merge();
      for (let y = cz; y < Math.min(S, cz + CHUNK); y++) {
        for (let x = cx; x < Math.min(S, cx + CHUNK); x++) {
          const g = ground(x, y);
          if (g === 'water' || g === null) continue;
          // beside the pond: drawn with the shore below
          if (nearShore(x, y) && g !== 'plaza') continue;
          const onHill = hilly(x, y);
          if (g === 'grass' || g === 'sand') {
            // two by two cells a tile (four by four on the hill): the colour varies inside a tile too
            const n = onHill ? 4 : 2;
            for (let sy = 0; sy < n; sy++) {
              for (let sx = 0; sx < n; sx++) {
                const x0 = x + sx / n;
                const z0 = y + sy / n;
                const x1 = x0 + 1 / n;
                const z1 = z0 + 1 / n;
                if (onHill) m.quadField(x0, z0, x1, z1, 0, lift, grassAt(x0, z0), grassAt(x1, z0), grassAt(x1, z1), grassAt(x0, z1));
                else m.quadUp(x0, z0, x1, z1, 0, grassAt(x0, z0), grassAt(x1, z0), grassAt(x1, z1), grassAt(x0, z1));
              }
            }
          } else if (g === 'path') {
            if (onHill) {
              for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) m.quadField(x + sx / 4, y + sy / 4, x + (sx + 1) / 4, y + (sy + 1) / 4, 0.004, lift, pathBase);
            } else m.quadUp(x, y, x + 1, y + 1, 0.004, pathBase);
          } else {
            // the plaza: rings of paving round its middle, every other ring in sectors
            for (let sy = 0; sy < PLAZA_N; sy++) {
              for (let sx = 0; sx < PLAZA_N; sx++) {
                const mx = x + (sx + 0.5) / PLAZA_N;
                const mz = y + (sy + 0.5) / PLAZA_N;
                const d = Math.hypot(mx - P.x, mz - P.y);
                const ring = Math.floor(d / 0.75);
                const sector = Math.floor(((Math.atan2(mz - P.y, mx - P.x) + Math.PI) / (Math.PI * 2)) * (8 + ring * 4));
                const c = d < 0.9 ? plazaC : ring % 2 === 0 ? plazaA : sector % 2 === 0 ? plazaB : plazaA;
                // thin joints and low slabs: the plaza reads as one calm floor, not a grid of lines
                const k = 0.022;
                const tile = c.clone();
                shadeColor(tile, (hash2(x * PLAZA_N + sx, y * PLAZA_N + sy, 9) - 0.5) * 0.08);
                m.add(slab(), tile, { x: x + (sx + 0.5) / PLAZA_N, y: 0.012, z: y + (sy + 0.5) / PLAZA_N, s: [1 / PLAZA_N - k, 0.026, 1 / PLAZA_N - k] }, { ao: false });
              }
            }
            m.quadUp(x, y, x + 1, y + 1, 0.002, col(C.plazaRim));
          }
        }
      }
      mesh(m.build());
    }
  }

  // ── cobbles on the paths (one instanced mesh) ──
  const cobbleSpots: { x: number; z: number; s: number; r: number; c: number }[] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (ground(x, y) !== 'path') continue;
      for (let sy = 0; sy < COBBLE_N; sy++) {
        for (let sx = 0; sx < COBBLE_N; sx++) {
          const h = hash2(x * COBBLE_N + sx, y * COBBLE_N + sy, 33);
          // no pebble over the rounded water's edge
          if (nearShore(x, y) && shore.signed(x + (sx + 0.5) / COBBLE_N, y + (sy + 0.5) / COBBLE_N) < 0.2) continue;
          cobbleSpots.push({
            x: x + (sx + 0.5) / COBBLE_N + (h - 0.5) * 0.05,
            z: y + (sy + 0.5) / COBBLE_N + (hash2(x * COBBLE_N + sx, y * COBBLE_N + sy, 34) - 0.5) * 0.04,
            s: 0.9 + h * 0.18,
            r: h * Math.PI * 2,
            c: Math.floor(hash2(x * COBBLE_N + sx, y * COBBLE_N + sy, 35) * C.cobble.length),
          });
        }
      }
    }
  }
  if (cobbleSpots.length > 0) {
    // a low pebble of seven sides: cheap (28 triangles) and irregular enough
    const geo = new Merge().add(shapes.cyl(0.2, 0.225, 0.055, 8), '#ffffff', {}, { ao: false }).build()!;
    geos.push(geo);
    const inst = new InstancedMesh(geo, mats.std, cobbleSpots.length);
    const m4 = new Matrix4();
    const o = new Object3D();
    cobbleSpots.forEach((s, i) => {
      // on the hill a pebble lies along the slope
      const e = 0.05;
      const hx = (lift(s.x + e, s.z) - lift(s.x - e, s.z)) / (2 * e);
      const hz = (lift(s.x, s.z + e) - lift(s.x, s.z - e)) / (2 * e);
      o.position.set(s.x, 0.012 + lift(s.x, s.z), s.z);
      o.rotation.set(-Math.atan(hz), s.r, Math.atan(hx), 'ZXY');
      o.scale.set(s.s, 0.8 + (i % 3) * 0.15, s.s * (0.92 + (i % 4) * 0.04));
      o.updateMatrix();
      m4.copy(o.matrix);
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, col(C.cobble[s.c]));
    });
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  // ── the plaza's curb: low rounded stones round its circle where it meets grass ──
  const curb = new Merge();
  const steps = Math.round(P.r * 2 * Math.PI * 3);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = P.x + Math.cos(a) * (P.r + 0.18);
    const z = P.y + Math.sin(a) * (P.r + 0.18);
    const g = ground(Math.floor(x), Math.floor(z));
    if (g !== 'grass') continue;
    curb.add(shapes.box(0.32, 0.09, 0.16, 0.04, 1), C.stone, { x, y: 0.03, z, ry: -a + Math.PI / 2 }, { ao: false, shade: (hash2(i, 1, 44) - 0.5) * 0.12 });
  }
  mesh(curb.build(), { cast: false, receive: true });

  // ── the pond: a sandy bed, earthen banks, the water over them; along the rounded shore (shore.ts) ──
  const bed = new Merge();
  const water = new Merge();
  const beach = new Merge();
  const deep = WATER_DEEP;
  const shallow = WATER_SHALLOW;
  const bedC = col(C.pondBed);
  const bank = col(C.sand);
  // (sand under the water, not dark earth: the shallow water is clear now and showed a brown band all round)
  const bankDark = col(C.pondBed).lerp(col(C.sandDeep), 0.5);
  /** The water's colour at a point: shallow at the shore, deep two tiles or more out (the shader reads the depth back off it). */
  const waterAt = (px: number, pz: number) => shallow.clone().lerp(deep, Math.min(1, Math.max(0, -shore.signed(px, pz, 2.5)) * 0.55));
  // pebbles along the waterline where it meets grass (not on the beaches)
  const pebbles = new Merge();
  const pebbleCols = [col(C.stone), col('#f4efe6'), col(C.rock), col('#e6ddd0')];
  let pebbleN = 0;
  // the open water: four by four cells a tile, coloured by the distance to the shore
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!isWater(x, y) || nearShore(x, y)) continue;
      // (in the same cells as along the shore: no hairline where the two meet, seen through the water; open water with
      // no shore round it, the coast's sea, is one cell a tile: it is deep all over, and a thousand tiles of it cost)
      let inner = true;
      for (let dy = -1; dy <= 1 && inner; dy++) for (let dx = -1; dx <= 1; dx++) if (nearShore(x + dx, y + dy)) inner = false;
      const n = inner ? 1 : 4;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const x0 = x + sx / n;
          const z0 = y + sy / n;
          const x1 = x0 + 1 / n;
          const z1 = z0 + 1 / n;
          bed.quadUp(x0, z0, x1, z1, POND_BED, bedC);
          water.quadUp(x0, z0, x1, z1, WATER_LEVEL, waterAt(x0, z0), waterAt(x1, z0), waterAt(x1, z1), waterAt(x0, z1));
        }
      }
    }
  }
  // the shore: land and water on both sides of the curve, cut along it (marching squares on its signed distance,
  // SHORE_N cells a tile), a sandy beach on the land side, a bank from the grass down to the bed along it
  const N = SHORE_N;
  const sdf = new Map<number, number>();
  const sdAt = (ix: number, iz: number) => {
    const k = iz * (S * N + 1) + ix;
    let v = sdf.get(k);
    if (v === undefined) {
      v = shore.signed(ix / N, iz / N, 1);
      // never exactly on the curve (a corner of a cell would be both)
      if (v === 0) v = 1e-4;
      sdf.set(k, v);
    }
    return v;
  };
  const landAt = (px: number, pz: number, g: ReturnType<typeof ground>, d: number) => {
    const c = g === 'path' ? pathBase.clone() : grassAt(px, pz).clone();
    // the beach: sand at the water's edge, fading into the grass (a path keeps a little of its own colour)
    return c.lerp(sand, Math.max(0, Math.min(1, 1 - d / 0.32)) * (g === 'path' ? 0.55 : 0.9));
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!nearShore(x, y)) continue;
      const tileG = ground(x, y);
      // the land part of a water tile (a corner the curve rounded off) looks like the land beside it
      const g = tileG === 'water' ? 'grass' : tileG;
      for (let sz = 0; sz < N; sz++) {
        for (let sx = 0; sx < N; sx++) {
          const ix = x * N + sx;
          const iz = y * N + sz;
          const corners: [number, number, number][] = [
            [ix / N, iz / N, sdAt(ix, iz)],
            [(ix + 1) / N, iz / N, sdAt(ix + 1, iz)],
            [(ix + 1) / N, (iz + 1) / N, sdAt(ix + 1, iz + 1)],
            [ix / N, (iz + 1) / N, sdAt(ix, iz + 1)],
          ];
          const wet = corners.some((c) => c[2] < 0);
          const dry = corners.some((c) => c[2] > 0);
          if (wet) {
            const [a, b, c, d] = corners;
            bed.quadUp(a[0], a[1], c[0], c[1], POND_BED, bedC);
            water.quadUp(a[0], a[1], c[0], c[1], WATER_LEVEL, waterAt(a[0], a[1]), waterAt(b[0], b[1]), waterAt(c[0], c[1]), waterAt(d[0], d[1]));
          }
          if (!dry) continue;
          // the land part of the cell: its land corners and where the curve crosses its sides, in order round it
          const poly: [number, number, number][] = [];
          const cross: [number, number][] = [];
          for (let i = 0; i < 4; i++) {
            const p = corners[i];
            const q = corners[(i + 1) % 4];
            if (p[2] > 0) poly.push(p);
            if (p[2] > 0 !== q[2] > 0) {
              const t = p[2] / (p[2] - q[2]);
              const at: [number, number] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
              poly.push([at[0], at[1], 0]);
              cross.push(at);
            }
          }
          const v3 = (p: readonly [number, number, number]): [number, number, number] => [p[0], 0.001 + lift(p[0], p[1]), p[1]];
          const cols = poly.map((p) => landAt(p[0], p[1], g, Math.max(0, p[2])));
          for (let i = 1; i + 1 < poly.length; i++) beach.tri3(v3(poly[0]), v3(poly[i]), v3(poly[i + 1]), cols[0], cols[i], cols[i + 1]);
          // the bank along the curve: from the ground down to the bed, facing into the water
          const pairs: [number, number][] = cross.length === 2 ? [[0, 1]] : cross.length === 4 ? (corners[0][2] > 0 ? [[0, 1], [2, 3]] : [[1, 2], [3, 0]]) : [];
          for (const [i, j] of pairs) {
            const a = cross[i];
            const b = cross[j];
            let nx = -(b[1] - a[1]);
            let nz = b[0] - a[0];
            const l = Math.hypot(nx, nz) || 1;
            nx /= l;
            nz /= l;
            if (shore.signed((a[0] + b[0]) / 2 + nx * 0.05, (a[1] + b[1]) / 2 + nz * 0.05, 1) > 0) {
              nx = -nx;
              nz = -nz;
            }
            const nrm: [number, number, number] = [nx, 0, nz];
            const ta = lift(a[0], a[1]);
            const tb = lift(b[0], b[1]);
            const mid = WATER_LEVEL - 0.04;
            bed.tri3([a[0], ta, a[1]], [b[0], mid, b[1]], [b[0], tb, b[1]], bank, bank, bank, nrm);
            bed.tri3([a[0], ta, a[1]], [a[0], mid, a[1]], [b[0], mid, b[1]], bank, bank, bank, nrm);
            bed.tri3([a[0], mid, a[1]], [b[0], POND_BED, b[1]], [b[0], mid, b[1]], bankDark, bankDark, bankDark, nrm);
            bed.tri3([a[0], mid, a[1]], [a[0], POND_BED, a[1]], [b[0], POND_BED, b[1]], bankDark, bankDark, bankDark, nrm);
            // a pebble or two on the bank, half in the water (grass shores only; a beach has its sand)
            if (g === 'grass' && pebbleN < 2400) {
              for (let k = 0; k < 2; k++) {
                const hsh = hash2(Math.round(a[0] * 37 + k * 13), Math.round(a[1] * 41), 61);
                if (hsh > 0.62) continue;
                const u = 0.2 + hsh * 0.9;
                const px = a[0] + (b[0] - a[0]) * u - nx * (0.02 + hsh * 0.1);
                const pz = a[1] + (b[1] - a[1]) * u - nz * (0.02 + hsh * 0.1);
                const r = 0.045 + hsh * 0.06;
                pebbles.add(shapes.blob(0.06, 1), pebbleCols[Math.floor(hsh * 97) % pebbleCols.length], { x: px, y: lift(px, pz) - r * 0.25, z: pz, s: [r / 0.06 * 1.25, r / 0.06 * 0.6, r / 0.06], ry: hsh * 6 }, { ao: false });
                pebbleN++;
              }
            }
          }
        }
      }
    }
  }
  // where the finer shore cells meet a plain tile's two by two the corners do not line up: a thin strip of grass just
  // under the seam, so no hairline of the floor shows through it
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!nearShore(x, y) || isWater(x, y)) continue;
      const k = 0.06;
      const plain = (tx: number, ty: number) => !nearShore(tx, ty) && ground(tx, ty) !== null && !isWater(tx, ty);
      const strip = (x0: number, z0: number, x1: number, z1: number) => {
        const h = Math.min(lift(x0, z0), lift(x1, z1)) - 0.003;
        beach.quadUp(x0, z0, x1, z1, h, grassAt(x0, z0), grassAt(x1, z0), grassAt(x1, z1), grassAt(x0, z1));
      };
      if (plain(x, y - 1)) strip(x, y - k, x + 1, y + k);
      if (plain(x, y + 1)) strip(x, y + 1 - k, x + 1, y + 1 + k);
      if (plain(x - 1, y)) strip(x - k, y, x + k, y + 1);
      if (plain(x + 1, y)) strip(x + 1 - k, y, x + 1 + k, y + 1);
    }
  }
  mesh(beach.build());
  mesh(bed.build(), { cast: false, receive: true });
  mesh(pebbles.build(), { cast: false, receive: true });
  buildPondLife(S, isWater, (x, z) => shore.signed(x, z, 3), group, mats, geos);
  const wm = mesh(water.build(), { cast: false, receive: true }, mats.water);
  if (wm) wm.renderOrder = 2;

  return {
    group,
    dispose: () => {
      for (const g of geos) g.dispose();
      group.traverse((o) => {
        if (o instanceof InstancedMesh) o.dispose();
      });
    },
  };
}

/**
 * Life on the lakes (owner, 2026-11-26, next to a cosier game's ponds: "sao biển/nước xấu vậy"): lily pads, a few in
 * flower, floating a tile or so out from the shore, and fish swimming slow circles under the surface (FISH_MAX at most;
 * the circling is the fish material's own, in its shader: nothing is updated a frame). Only on water that does not
 * reach the map's edge (a lake, not the sea or the city's bay). Seen only: nothing here blocks or is clicked.
 */
const FISH_MAX = 60;
function buildPondLife(S: number, isWater: (x: number, y: number) => boolean, signed: (x: number, z: number) => number, group: Group, mats: Materials, geos: BufferGeometry[]): void {
  // the lakes: water tiles in a body that never touches the map's edge
  const lake = new Uint8Array(S * S);
  const seen = new Uint8Array(S * S);
  for (let y0 = 0; y0 < S; y0++) {
    for (let x0 = 0; x0 < S; x0++) {
      if (seen[y0 * S + x0] || !isWater(x0, y0)) continue;
      const body: number[] = [];
      let edge = false;
      const stack = [y0 * S + x0];
      seen[y0 * S + x0] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        body.push(i);
        const x = i % S;
        const y = (i - x) / S;
        // (the sea lies past the near edges: a lake may touch a far edge, under the mountains)
        if (x === S - 1 || y === S - 1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= S || ny >= S || seen[ny * S + nx] || !isWater(nx, ny)) continue;
          seen[ny * S + nx] = 1;
          stack.push(ny * S + nx);
        }
      }
      if (!edge) for (const i of body) lake[i] = 1;
    }
  }
  const pads = new Merge();
  const padA = new Color(C.leaf);
  const padB = new Color(C.leafDeep);
  const fish: { x: number; z: number; r: number; w: number; ph: number; c: Color }[] = [];
  const fishCols = ['#f39a4a', '#f7f1e6', '#e0623f', '#9fb4c8', '#f2c45a'].map((h) => new Color(h));
  const y = WATER_LEVEL;
  for (let ty = 0; ty < S; ty++) {
    for (let tx = 0; tx < S; tx++) {
      if (!lake[ty * S + tx]) continue;
      // two candidate spots a tile
      for (let k = 0; k < 2; k++) {
        const h = hash2(tx * 3 + k, ty * 5 + k, 71);
        const px = tx + 0.2 + hash2(tx, ty + k, 72) * 0.6;
        const pz = ty + 0.2 + hash2(tx + k, ty, 73) * 0.6;
        const d = -signed(px, pz);
        if (h < 0.16 && d > 0.35 && d < 1.8) {
          // a pad: a flat disc with a notch, darker underneath; now and then a flower on it
          const r = 0.12 + hash2(tx, ty, 74 + k) * 0.1;
          const ry = hash2(tx, ty, 75 + k) * Math.PI * 2;
          pads.add(shapes.cyl(r, r, 0.012, 14), padA.clone().lerp(padB, hash2(tx, ty, 76 + k)), { x: px, y: y + 0.016, z: pz, ry }, { ao: false });
          pads.add(shapes.box(r * 0.95, 0.016, 0.04, 0.005, 1), C.waterShallow, { x: px + Math.cos(ry) * r * 0.48, y: y + 0.02, z: pz - Math.sin(ry) * r * 0.48, ry }, { ao: false });
          if (hash2(tx, ty, 77 + k) < 0.3) {
            pads.add(shapes.cone(0.05, 0.08, 6), '#f6a8c4', { x: px, y: y + 0.06, z: pz }, { ao: false });
            pads.add(shapes.sphere(0.022, 6, 4), '#fbe7a6', { x: px, y: y + 0.075, z: pz }, { ao: false });
          }
        } else if (h > 0.8 && fish.length < FISH_MAX) {
          const r = 0.35 + hash2(tx, ty, 78 + k) * 0.55;
          if (d < r + 0.45) continue;
          const dir = hash2(tx, ty, 79 + k) < 0.5 ? -1 : 1;
          fish.push({ x: px, z: pz, r, w: dir * (0.25 + hash2(tx, ty, 80 + k) * 0.3), ph: hash2(tx, ty, 81 + k) * Math.PI * 2, c: fishCols[Math.floor(hash2(tx, ty, 82 + k) * fishCols.length)] });
        }
      }
    }
  }
  const pg = pads.build();
  if (pg) {
    geos.push(pg);
    const m = new Mesh(pg, mats.std);
    m.receiveShadow = true;
    group.add(m);
  }
  if (fish.length === 0) return;
  // one small fish, nose along +x: a body, a tail fin
  const body = new Merge();
  body.add(shapes.sphere(0.065, 10, 8), '#ffffff', { s: [1.9, 0.7, 0.9] }, { ao: false });
  body.add(shapes.cone(0.06, 0.09, 4), '#ffffff', { x: -0.14, rz: Math.PI / 2, s: [1, 1, 0.35] }, { ao: false });
  const g = body.build();
  if (!g) return;
  g.setAttribute('aSwim', new InstancedBufferAttribute(new Float32Array(fish.flatMap((f) => [f.r, f.w, f.ph])), 3));
  geos.push(g);
  const inst = new InstancedMesh(g, mats.fish, fish.length);
  const m4 = new Matrix4();
  fish.forEach((f, i) => {
    inst.setMatrixAt(i, m4.makeTranslation(f.x, y - 0.06, f.z));
    inst.setColorAt(i, f.c);
  });
  // (the circling is in the shader: the instances' boxes do not know it)
  inst.frustumCulled = false;
  inst.renderOrder = 1;
  group.add(inst);
}
