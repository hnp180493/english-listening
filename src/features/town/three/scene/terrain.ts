// The ground of the 3D town, built once from the map's rows: the island (a soft grass top over layered earth, a
// diorama floating in the sky), grass with gentle colour variation and a sandy shore, cobbled paths, the plaza's
// patterned paving with its curb, the pond (sandy bed, earthen banks, an animated surface). Chunked so the camera
// culls what it does not see.

import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, Object3D, type BufferGeometry } from 'three';
import { groundHeight, type TownWorld } from '../../../../data/townWorld';
import { groundOf, hash2, valueNoise } from './coords';
import type { Materials } from './materials';
import { Merge, shadeColor, shapes } from './merge';
import { C } from './palette3d';
import { ShoreField, smoothShore } from './shore';

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
  const shore = new ShoreField(smoothShore(isWater, S), S);
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
  for (const [x, z, w, d] of [
    [S / 2, RIM / 2 - 0.25, S + 0.5, RIM],
    [S / 2, S + 0.25 - RIM / 2, S + 0.5, RIM],
    [RIM / 2 - 0.25, S / 2, RIM, S + 0.5],
    [S + 0.25 - RIM / 2, S / 2, RIM, S + 0.5],
  ] as const)
    base.add(shapes.box(w, 0.9, d, 0.32, 3), C.earth, { x, y: -0.47, z }, { top: C.grassDeep, ao: false });
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
    base.add(shapes.blob(1, 0), hash2(i, 5, 91) < 0.5 ? C.rock : C.earthDeep, { x, y: -0.95 - hash2(i, 6, 91) * 0.6, z, s: [r * 1.3, r, r * 1.1], ry: hash2(i, 7, 91) * 6 }, { ao: false });
  }
  mesh(base.build(), { cast: false, receive: true });

  // ── grass, paths and plaza tops, per chunk ──
  const gDeep = col(C.grassDeep);
  const gLight = col(C.grassLight);
  const gMid = col(C.grass);
  const sand = col(C.sand);
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
    for (const [dx, dz] of [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ]) {
      const g = ground(tx + dx, tz + dz);
      if (g === 'water') water++;
      else if (g === 'path' || g === 'plaza') path++;
    }
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
          if (g === 'grass') {
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
  const deep = col(C.waterDeep);
  const shallow = col(C.waterShallow);
  const bedC = col(C.pondBed);
  const bank = col(C.sand);
  const bankDark = col(C.earth);
  /** The water's colour at a point: shallow at the shore, deep a tile or more out. */
  const waterAt = (px: number, pz: number) => shallow.clone().lerp(deep, Math.min(1, Math.max(0, -shore.signed(px, pz, 1)) * 1.4));
  // the open water: four by four cells a tile, coloured by the distance to the shore
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!isWater(x, y) || nearShore(x, y)) continue;
      // (in the same cells as along the shore: no hairline where the two meet, seen through the water)
      const n = 4;
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
