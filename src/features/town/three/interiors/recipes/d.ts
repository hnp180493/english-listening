// Rooms: Lily's park pavilion (outdoors), Tom's community hall with the notice board, Leo's info room on the square,
// the boarding house's common room.

import type { ColorRepresentation } from 'three';
import type { RoomAnchor } from '../contracts';
import { shapes, type Merge } from '../../scene/merge';
import { C, FLOWERS } from '../../scene/palette3d';
import { frame, H_NX, H_PX, H_PZ, people, picture, ryFor, SEAT, shell, TABLE, wallClock, windowAt, type Cast, type Room } from '../build';
import { armchair, bench, books, chair, counter, cup, floorLamp, pendant, plant, potPlant, roundTable, rug, table, tableLamp } from '../furniture';

const CROWNS = [C.leaf, C.leafDeep, '#8fd06a', C.pine] as const;

/** A round tree: trunk and a cloud of crowns (the crowns sway a little). */
function tree(r: Room, x: number, z: number, size: number, seed: number, blossom = false): void {
  r.furn.add(shapes.cyl(0.06 * size, 0.09 * size, 0.7 * size, 8), C.trunk, { x, y: 0.35 * size, z });
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + seed;
    const c = blossom && i % 2 ? C.blossom : CROWNS[(i + seed) % CROWNS.length];
    r.sway.add(shapes.blob(0.32 * size * (i ? 0.8 : 1), 1), c, { x: x + Math.cos(a) * 0.22 * size * (i ? 1 : 0), y: (0.95 + (i % 3) * 0.14) * size, z: z + Math.sin(a) * 0.22 * size * (i ? 1 : 0) }, { ao: false });
  }
  r.block(x, z, 0.1 * size, 0.1 * size, 'tree');
}

function bush(m: Merge, x: number, z: number, s: number, flowers = 0, seed = 0): void {
  for (let i = 0; i < 3; i++) m.add(shapes.blob(0.16 * s, 1), CROWNS[(i + seed) % 3], { x: x + (i - 1) * 0.13 * s, y: 0.12 * s, z: z + ((i * 7) % 3 - 1) * 0.05 * s }, { ao: false });
  for (let i = 0; i < flowers; i++) m.add(shapes.sphere(0.035, 6, 4), FLOWERS[(i + seed) % FLOWERS.length], { x: x + Math.cos(i * 2.1 + seed) * 0.17 * s, y: 0.2 * s + (i % 2) * 0.04, z: z + Math.sin(i * 2.1 + seed) * 0.1 * s }, { ao: false });
}

// ───────────────────────── the park pavilion ─────────────────────────

export function park(r: Room): Cast {
  r.backdrop = { day: '#d8eefa', night: '#1f2448', groundDay: '#a8d68a', groundNight: '#26314a' };
  shell(r, { wall: C.cream, floor: 'grass', floorA: C.grass, floorB: C.grassLight });
  const f = r.furn;
  const s = r.shell;
  // a stone path across the front, round stepping stones to the pavilion
  for (let i = 0; i < 14; i++) {
    const x = -2.9 + i * 0.44;
    s.add(shapes.cyl(0.2, 0.21, 0.03, 10), C.cobble[i % 4], { x, y: 0.012, z: 1.25 + Math.sin(i * 1.3) * 0.05, s: [1.1, 1, 0.8] }, { ao: false });
  }
  for (let i = 0; i < 2; i++) s.add(shapes.cyl(0.16, 0.17, 0.03, 10), C.cobble[(i + 1) % 4], { x: -0.55 + i * 0.1, y: 0.012, z: 0.92 - i * 0.34 }, { ao: false });
  // the pavilion: an eight-sided deck, white posts, a coral roof with a lantern
  const cx = -0.6;
  const cz = -1.05;
  const R = 1.25;
  s.add(shapes.cyl(R + 0.08, R + 0.12, 0.03, 8), C.woodDark, { x: cx, y: 0.012, z: cz, ry: Math.PI / 8 }, { ao: false });
  s.add(shapes.cyl(R, R, 0.034, 8), C.woodLight, { x: cx, y: 0.016, z: cz, ry: Math.PI / 8 }, { ao: false });
  for (let i = 0; i < 4; i++) s.add(shapes.box(R * 1.9, 0.002, 0.012, 0.001, 1), C.wood, { x: cx, y: 0.034, z: cz - 0.9 + i * 0.45 }, { ao: false });
  const postAt = (i: number) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return { x: cx + Math.cos(a) * (R - 0.08), z: cz + Math.sin(a) * (R - 0.08), a };
  };
  for (let i = 0; i < 8; i++) {
    const p = postAt(i);
    f.add(shapes.cyl(0.04, 0.05, 1.36, 8), C.trim, { x: p.x, y: 0.7, z: p.z });
    f.add(shapes.box(0.12, 0.05, 0.12, 0.015, 1), C.trim, { x: p.x, y: 0.05, z: p.z });
    r.block(p.x, p.z, 0.06, 0.06, 'post');
  }
  // a low rail round the back half, benches inside it facing the middle
  const seats: RoomAnchor[] = [];
  for (let i = 0; i < 8; i++) {
    const p0 = postAt(i);
    const p1 = postAt(i + 1);
    const mx = (p0.x + p1.x) / 2;
    const mz = (p0.z + p1.z) / 2;
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    const ry = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
    // the side towards the camera stays open (the rail would cut across the people)
    if (mz > cz + 0.2 && mx > cx - 1.0) continue;
    f.add(shapes.box(len, 0.04, 0.05, 0.015, 1), C.trim, { x: mx, y: 0.42, z: mz, ry }, { ao: false });
    for (let k = 1; k < 4; k++) f.add(shapes.box(0.025, 0.36, 0.025, 0.008, 1), C.trim, { x: p0.x + ((p1.x - p0.x) * k) / 4, y: 0.22, z: p0.z + ((p1.z - p0.z) * k) / 4 }, { ao: false });
    if (mz < cz - 0.3) {
      const toC = Math.atan2(cz - mz, cx - mx);
      const bx = mx + Math.cos(toC) * 0.2;
      const bz = mz + Math.sin(toC) * 0.2;
      seats.push(...bench(r, bx, bz, toC, 2, C.wood, { back: false, legs: C.woodDark }));
    }
  }
  f.add(shapes.cyl(R + 0.25, R + 0.25, 0.08, 8), C.coral, { x: cx, y: 1.4, z: cz, ry: Math.PI / 8 }, { ao: false, shade: -0.05 });
  f.add(shapes.cone(R + 0.22, 0.7, 8), C.coral, { x: cx, y: 1.79, z: cz, ry: Math.PI / 8 }, { ao: false });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    f.add(shapes.sphere(0.09, 8, 5), i % 2 ? C.coral : C.cream, { x: cx + Math.cos(a) * (R + 0.2), y: 1.34, z: cz + Math.sin(a) * (R + 0.2), s: [1, 0.55, 1] }, { ao: false });
  }
  f.add(shapes.sphere(0.08, 10, 8), C.mustard, { x: cx, y: 2.18, z: cz }, { ao: false });
  f.add(shapes.cyl(0.006, 0.006, 0.25, 4), C.metal, { x: cx, y: 1.25, z: cz }, { ao: false });
  f.add(shapes.cyl(0.05, 0.07, 0.1, 8), C.navy, { x: cx, y: 1.1, z: cz }, { ao: false });
  r.bulbs.add(shapes.sphere(0.06, 10, 8), C.glow, { x: cx, y: 1.02, z: cz });
  r.lamp(cx, 0.95, cz);
  r.halo(cx, 1.02, cz, 1.0);
  // trees all round, a blossom tree, bushes with flowers, flower beds
  for (const [x, z, sz, b] of [
    [-2.6, -2.1, 1.5, false],
    [-1.4, -2.35, 1.3, false],
    [1.05, -2.3, 1.6, true],
    [2.2, -2.0, 1.4, false],
    [2.75, -0.8, 1.2, false],
    [-2.85, -0.4, 1.3, true],
    [-2.7, 1.6, 1.1, false],
  ] as const)
    tree(r, x, z, sz, Math.round(x * 3 + z), b);
  bush(f, 1.2, -1.45, 1.2, 4, 1);
  bush(f, -2.2, -1.3, 1.1, 3, 2);
  bush(f, 2.6, 0.5, 1.0, 4, 3);
  bush(f, -2.4, 0.6, 1.0, 2, 0);
  for (const [x, z] of [
    [0.9, 0.55],
    [-1.9, 0.9],
  ]) {
    s.add(shapes.cyl(0.36, 0.38, 0.06, 16), C.soil, { x, y: 0.03, z }, { ao: false });
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const rr = Math.sqrt(i / 14) * 0.3;
      f.add(shapes.sphere(0.045, 6, 4), i % 3 ? C.leaf : C.leafDeep, { x: x + Math.cos(a) * rr, y: 0.1, z: z + Math.sin(a) * rr }, { ao: false });
      f.add(shapes.sphere(0.035, 6, 4), FLOWERS[i % FLOWERS.length], { x: x + Math.cos(a) * rr, y: 0.15, z: z + Math.sin(a) * rr }, { ao: false });
    }
    r.block(x, z, 0.38, 0.38, 'flower bed');
  }
  // the pond with lily pads and a duck
  const px = 1.95;
  const pz = -0.55;
  s.add(shapes.cyl(0.78, 0.82, 0.04, 20), C.stone, { x: px, y: 0.015, z: pz, s: [1, 1, 0.75] }, { ao: false });
  s.add(shapes.cyl(0.7, 0.7, 0.044, 20), C.waterDeep, { x: px, y: 0.02, z: pz, s: [1, 1, 0.75] }, { ao: false });
  s.add(shapes.cyl(0.55, 0.55, 0.046, 20), C.waterShallow, { x: px + 0.05, y: 0.022, z: pz - 0.03, s: [0.9, 1, 0.6] }, { ao: false, shade: -0.1 });
  for (const [dx, dz] of [
    [-0.35, 0.1],
    [0.3, 0.2],
    [0.1, -0.3],
  ])
    s.add(shapes.cyl(0.08, 0.08, 0.01, 10), C.leafDeep, { x: px + dx, y: 0.05, z: pz + dz }, { ao: false });
  r.block(px, pz, 0.8, 0.6, 'pond');
  const duck = r.moving((m) => {
    m.add(shapes.sphere(0.07, 10, 8), C.white, { s: [1.3, 0.8, 1] });
    m.add(shapes.sphere(0.045, 8, 6), C.white, { x: 0.07, y: 0.06 });
    m.add(shapes.cone(0.018, 0.04, 6), C.orange, { x: 0.115, y: 0.055, rz: -Math.PI / 2 }, { ao: false });
  }, r.root, true);
  r.life.push((t) => {
    const a = t * 0.25;
    duck.position.set(px + Math.cos(a) * 0.4, 0.06 + Math.sin(t * 2.2) * 0.005, pz + Math.sin(a) * 0.25);
    duck.rotation.y = -a - Math.PI / 2;
  });
  // a lamp post and a bench by the path
  const lp = { x: 2.5, z: 1.55 };
  f.add(shapes.cyl(0.025, 0.035, 1.35, 8), C.navy, { x: lp.x, y: 0.68, z: lp.z });
  f.add(shapes.cone(0.1, 0.1, 8), C.navy, { x: lp.x, y: 1.42, z: lp.z }, { ao: false });
  r.bulbs.add(shapes.sphere(0.06, 8, 6), C.glow, { x: lp.x, y: 1.33, z: lp.z });
  r.lamp(lp.x, 1.25, lp.z);
  r.halo(lp.x, 1.33, lp.z, 1.0);
  r.block(lp.x, lp.z, 0.05, 0.05, 'lamp post');
  const pb = bench(r, 2.3, 0.95, Math.PI + 0.4, 2, C.wood);
  // butterflies
  for (let i = 0; i < 2; i++) {
    const b = r.moving((m) => {
      for (const sx of [-1, 1]) m.add(shapes.sphere(0.03, 6, 4), i ? C.butter : C.pink, { x: sx * 0.025, s: [1, 0.2, 0.8] }, { ao: false });
    });
    r.life.push((t) => {
      const a = t * (0.5 + i * 0.2) + i * 3;
      b.position.set(0.9 + Math.cos(a) * 0.5 - i * 2.6, 0.45 + Math.sin(t * 1.7 + i) * 0.1, 0.4 + Math.sin(a * 1.3) * 0.3);
      b.rotation.z = Math.sin(t * 18 + i) * 0.6;
      b.rotation.y = -a;
    });
  }
  // grass tufts
  for (let i = 0; i < 40; i++) {
    const x = -3 + ((i * 37) % 60) / 10;
    const z = -2.4 + ((i * 53) % 48) / 10;
    if (Math.hypot(x - cx, z - cz) < R + 0.2 || Math.hypot(x - px, (z - pz) * 1.3) < 0.9) continue;
    s.add(shapes.cone(0.03, 0.08, 4), i % 2 ? C.grassDeep : C.leaf, { x, y: 0.04, z }, { ao: false });
  }
  return people({ x: -1.15, z: 0.8 }, { x: -0.15, z: 0.8 }, { x: 0.55, z: 0.0 }, [seats[0], seats[3], pb[1]], {
    key: [3.5, 5, 4],
    yaw: 1.28,
    pitch: 0.18,
    dist: 3.7,
  });
}

// ───────────────────────── the community hall (the notice board) ─────────────────────────

/** A folding chair (metal frame, wooden seat). Returns its sit anchor. */
function foldingChair(r: Room, x: number, z: number, heading: number, color: ColorRepresentation): RoomAnchor {
  const p = frame(x, z, ryFor(heading));
  const m = r.furn;
  m.add(shapes.box(0.24, 0.025, 0.22, 0.01, 1), color, p(0, SEAT - 0.012, 0));
  m.add(shapes.box(0.24, 0.1, 0.02, 0.008, 1), color, p(0, SEAT + 0.15, -0.11), { ao: false });
  for (const sx of [-1, 1]) {
    m.add(shapes.box(0.02, 0.4, 0.02, 0.006, 1), C.metal, p(sx * 0.11, 0.16, -0.02, { rx: 0.25 }));
    m.add(shapes.box(0.02, 0.24, 0.02, 0.006, 1), C.metal, p(sx * 0.11, 0.1, 0.02, { rx: -0.35 }));
  }
  r.block(x, z, 0.13, 0.13, 'folding chair');
  return r.seat(x, z, heading);
}

/** Flags on a string between two points (triangles in turn), swaying a little. */
function bunting(r: Room, a: [number, number, number], b: [number, number, number], n: number, sag = 0.12): void {
  const cols = [C.red, C.mustard, C.sky, C.leaf, C.pink, C.plum, C.orange];
  const ry = -Math.atan2(b[2] - a[2], b[0] - a[0]);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = a[0] + (b[0] - a[0]) * u;
    const z = a[2] + (b[2] - a[2]) * u;
    const y = a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag;
    if (i < n) {
      const u2 = (i + 0.5) / n;
      const y2 = a[1] + (b[1] - a[1]) * u2 - Math.sin(u2 * Math.PI) * sag;
      r.sway.add(shapes.cone(0.07, 0.15, 3), cols[i % cols.length], { x: a[0] + (b[0] - a[0]) * u2, y: y2 - 0.07, z: a[2] + (b[2] - a[2]) * u2, rx: Math.PI, ry: ry + Math.PI / 6, s: [1, 1, 0.15] }, { ao: false });
    }
    r.sway.add(shapes.sphere(0.008, 4, 3), C.trim, { x, y, z }, { ao: false });
  }
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  for (let i = 0; i < n * 2; i++) {
    const u = (i + 0.5) / (n * 2);
    r.sway.add(shapes.box(len / (n * 2) + 0.01, 0.006, 0.006, 0.002, 1), C.trim, { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag, z: a[2] + (b[2] - a[2]) * u, ry }, { ao: false });
  }
}

export function board(r: Room): Cast {
  shell(r, { wall: '#f7e5cc', wallLeft: '#f3dcc0', wainscot: '#c99163', wainscotH: 0.5, rail: C.woodDark, floor: 'planks', floorA: '#c99163', floorB: '#b47f53' });
  const f = r.furn;
  const s = r.shell;
  // the big notice board: cork in a wooden frame, a header, papers and pins, a calendar
  const bx = -0.75;
  const nb = r.back(bx, 1.0);
  s.add(shapes.box(2.2, 1.0, 0.05, 0.02, 1), C.woodDark, nb(0, 0, 0.025), { ao: false });
  s.add(shapes.box(2.08, 0.88, 0.02, 0.008, 1), '#d8a86f', nb(0, 0, 0.055), { ao: false });
  s.add(shapes.box(0.9, 0.16, 0.03, 0.02, 1), C.red, nb(0, 0.56, 0.05), { ao: false });
  for (let i = 0; i < 6; i++) s.add(shapes.box(0.08, 0.08, 0.01, 0.004, 1), C.cream, nb(-0.3 + i * 0.12, 0.56, 0.07), { ao: false });
  const papers: [number, number, number, number, string, number][] = [
    [-0.8, 0.22, 0.3, 0.36, C.white, -0.06],
    [-0.42, 0.25, 0.26, 0.2, C.butter, 0.08],
    [-0.45, -0.08, 0.3, 0.34, C.sky, -0.03],
    [-0.05, 0.18, 0.34, 0.42, C.white, 0.02],
    [0.38, 0.24, 0.24, 0.28, C.pink, -0.1],
    [0.78, 0.18, 0.3, 0.38, C.mint, 0.05],
    [-0.85, -0.25, 0.26, 0.24, C.mustard, 0.1],
    [0.05, -0.26, 0.3, 0.22, C.butter, -0.04],
    [0.5, -0.2, 0.36, 0.3, C.white, 0.03],
  ];
  papers.forEach(([x, y, w, h, c, rz], i) => {
    s.add(shapes.box(w, h, 0.006, 0.003, 1), c, nb(x, y, 0.07, { rz }), { ao: false });
    for (let k = 0; k < 3; k++) s.add(shapes.box(w * (0.7 - (k % 2) * 0.2), 0.014, 0.004, 0.002, 1), '#8a7f99', nb(x - w * 0.05, y + h * 0.25 - k * h * 0.2, 0.075, { rz }), { ao: false });
    s.add(shapes.sphere(0.018, 6, 4), [C.red, C.blue, C.leafDeep, C.mustard][i % 4], nb(x, y + h / 2 - 0.03, 0.08), { ao: false });
  });
  // the calendar: a grid of days
  const cal = nb(0.78, -0.25, 0.07);
  for (let k = 0; k < 12; k++) s.add(shapes.box(0.05, 0.04, 0.004, 0.002, 1), k === 5 ? C.red : C.stoneDark, { ...cal, x: cal.x! - 0.1 + (k % 4) * 0.065, y: cal.y! + 0.04 - Math.floor(k / 4) * 0.055 }, { ao: false });
  // Tom's box of papers and pins on a little table under the board
  const tb = table(r, bx + 1.25, -1.82, 0.5, 0.3, 0, C.wood, { h: 0.34 });
  f.add(shapes.box(0.18, 0.08, 0.14, 0.015, 1), C.navy, tb(-0.1, 0.04, 0), { ao: false });
  for (let i = 0; i < 3; i++) f.add(shapes.box(0.14, 0.006, 0.2, 0.003, 1), [C.white, C.butter, C.pink][i], tb(0.12, 0.004 + i * 0.006, 0, { ry: i * 0.2 }), { ao: false });
  // the refreshment table: a tea urn that steams, cups, a plate of biscuits
  const rt = table(r, -2.25, -1.25, 0.9, 0.42, Math.PI / 2, C.trim, { h: 0.34, legs: C.metal });
  f.add(shapes.box(0.92, 0.012, 0.44, 0.004, 1), C.red, rt(0, 0.004, 0), { ao: false });
  f.add(shapes.cyl(0.08, 0.08, 0.24, 14), C.metal, rt(-0.25, 0.12, 0), { ao: false, shade: 0.2 });
  f.add(shapes.cyl(0.06, 0.08, 0.04, 14), C.stoneDark, rt(-0.25, 0.26, 0), { ao: false });
  f.add(shapes.box(0.03, 0.03, 0.05, 0.008, 1), C.woodDark, rt(-0.25, 0.05, 0.09), { ao: false });
  r.steam.push([rt(-0.25, 0.3, 0).x!, 0.34 + 0.3, rt(-0.25, 0.3, 0).z!]);
  for (let i = 0; i < 4; i++) cup(r, rt, 0.05 + (i % 2) * 0.09, -0.08 + Math.floor(i / 2) * 0.14, i % 2 ? C.sky : C.white, i === 0);
  f.add(shapes.cyl(0.08, 0.07, 0.01, 12), C.white, rt(0.3, 0.005, 0), { ao: false });
  for (let i = 0; i < 5; i++) f.add(shapes.cyl(0.022, 0.022, 0.008, 8), C.woodLight, rt(0.3 + Math.cos(i * 1.3) * 0.04, 0.015, Math.sin(i * 1.3) * 0.04), { ao: false });
  // a round table with folding chairs, chairs stacked by the wall, a piano
  roundTable(r, 0.95, -0.7, 0.3, C.woodLight, { foot: C.woodDark });
  const e1 = foldingChair(r, 0.95, -1.15, H_PZ, C.wood);
  const e2 = foldingChair(r, 1.4, -0.7, H_NX, C.wood);
  foldingChair(r, 0.55, -0.42, -0.6, C.wood);
  const t2 = frame(0.95, -0.7, 0, TABLE);
  cup(r, t2, -0.08, 0.05, C.white, true);
  cup(r, t2, 0.1, -0.05, C.mustard);
  f.add(shapes.box(0.16, 0.006, 0.22, 0.003, 1), C.white, t2(0, 0.004, 0.0, { ry: 0.3 }), { ao: false });
  for (let i = 0; i < 4; i++) f.add(shapes.box(0.24, 0.025, 0.22, 0.01, 1), C.wood, { x: -2.52, y: 0.4, z: 0.15 + i * 0.05, rx: -0.15, rz: Math.PI / 2 - 0.1 });
  r.block(-2.5, 0.25, 0.14, 0.2, 'stacked chairs');
  const pp = r.back(1.9, 0);
  f.add(shapes.box(0.9, 0.62, 0.32, 0.02, 1), C.woodDark, pp(0, 0.31, 0.16));
  f.add(shapes.box(0.84, 0.03, 0.16, 0.008, 1), C.white, pp(0, 0.4, 0.38), { ao: false });
  for (let i = 0; i < 9; i++) f.add(shapes.box(0.03, 0.02, 0.1, 0.004, 1), '#2e3142', pp(-0.36 + i * 0.09 + 0.045, 0.425, 0.36), { ao: false });
  f.add(shapes.box(0.84, 0.04, 0.2, 0.01, 1), C.woodDark, pp(0, 0.38, 0.38), { ao: false });
  f.add(shapes.box(0.3, 0.16, 0.02, 0.006, 1), C.white, pp(0, 0.72, 0.08, { rx: -0.25 }), { ao: false });
  r.block(1.9, -r.D / 2 + 0.25, 0.46, 0.28, 'piano');
  chair(r, 1.9, -1.35, -Math.PI / 2, C.woodDark, { back: false });
  // bunting, windows, a clock, plants, the lamps
  bunting(r, [-2.65, 1.62, -r.D / 2 + 0.05], [2.6, 1.62, -r.D / 2 + 0.05], 18, 0.16);
  bunting(r, [-r.W / 2 + 0.05, 1.62, -2.0], [-r.W / 2 + 0.05, 1.62, 1.9], 14, 0.14);
  windowAt(r, r.left(-0.0, 1.05), 0.6, 0.6, { curtain: C.red, panes: 2 });
  windowAt(r, r.left(1.3, 1.05), 0.6, 0.6, { curtain: C.red, panes: 2 });
  wallClock(r, r.back(1.0, 1.25), 0.13, C.woodDark);
  windowAt(r, r.back(1.9, 1.15), 0.62, 0.48, { curtain: C.red, panes: 2 });
  plant(r, 2.35, 0.6, 1.4, C.coral, 'leafy');
  plant(r, 0.75, -1.85, 1.2, C.cream, 'palm');
  for (const [x, z] of [
    [-0.7, -0.9],
    [0.95, -0.7],
  ])
    pendant(r, x, 1.38, z + 0.45, C.mustard, r.H + 0.4, { wide: true });
  return people({ x: -1.35, z: -0.85 }, { x: -0.35, z: -1.0 }, { x: 0.25, z: -1.3 }, [e1, e2]);
}

// ───────────────────────── Leo's room on the square ─────────────────────────

export function square(r: Room): Cast {
  shell(r, { wall: '#e2eff7', wallLeft: '#fff1dc', wainscot: '#7aa8dc', wainscotH: 0.45, rail: C.trim, floor: 'planks', floorA: '#e2b98a', floorB: '#d4a978' });
  const f = r.furn;
  const s = r.shell;
  // the info desk along the left: a computer, a bell, leaflets; a round "i" sign hanging over it
  const top = counter(r, -1.35, -0.65, 1.8, 0.4, H_PX, C.blue, C.cream, { panels: '#9cc0ea' });
  f.add(shapes.box(0.3, 0.2, 0.025, 0.012, 1), '#2e3142', top(0.5, 0.2, -0.05, { ry: Math.PI }));
  r.screens.add(shapes.box(0.26, 0.16, 0.01, 0.006, 1), '#bfe0ff', top(0.5, 0.2, -0.065, { ry: Math.PI }));
  f.add(shapes.box(0.03, 0.09, 0.03, 0.008, 1), '#2e3142', top(0.5, 0.05, -0.04), { ao: false });
  f.add(shapes.dome(0.03, 10, 4), C.mustard, top(0.05, 0, 0.12), { ao: false });
  for (let i = 0; i < 5; i++) f.add(shapes.box(0.1, 0.006, 0.14, 0.003, 1), [C.coral, C.sky, C.butter, C.mint, C.pink][i], top(-0.25 - i * 0.05, 0.004 + i * 0.004, 0.06, { ry: i * 0.35 - 0.5 }), { ao: false });
  const ix = -1.35;
  const iy = 1.27;
  const iz = -1.25;
  f.add(shapes.cyl(0.006, 0.006, 0.42, 4), C.metal, { x: ix, y: iy + 0.36, z: iz }, { ao: false });
  f.add(shapes.cyl(0.17, 0.17, 0.04, 20), C.blue, { x: ix, y: iy, z: iz, rx: Math.PI / 2 }, { ao: false });
  f.add(shapes.cyl(0.14, 0.14, 0.046, 20), C.white, { x: ix, y: iy, z: iz, rx: Math.PI / 2 }, { ao: false });
  for (const sz of [-1, 1]) {
    f.add(shapes.box(0.04, 0.12, 0.02, 0.008, 1), C.blue, { x: ix, y: iy - 0.03, z: iz + sz * 0.025 }, { ao: false });
    f.add(shapes.sphere(0.025, 8, 6), C.blue, { x: ix, y: iy + 0.07, z: iz + sz * 0.025, s: [1, 1, 0.5] }, { ao: false });
  }
  // behind Leo: a shelf of guide books, a flag
  const lw = r.left(-0.65, 0);
  f.add(shapes.box(1.4, 0.36, 0.24, 0.02, 1), C.trim, lw(0, 0.18, 0.12));
  r.block(-r.W / 2 + 0.12, -0.65, 0.12, 0.7, 'cabinet');
  books(f, frame(-r.W / 2 + 0.12, -0.65, Math.PI / 2, 0.37), -0.6, 1.0, 0, 11, 0.16);
  for (const [y, i] of [
    [0.8, 0],
    [1.08, 1],
  ] as const) {
    f.add(shapes.box(1.3, 0.03, 0.2, 0.01, 1), C.wood, lw(0, y, 0.1));
    books(f, frame(-r.W / 2 + 0.1, -0.65, Math.PI / 2, y + 0.015), -0.6, i ? 0.7 : 1.1, 0, i * 9 + 4, 0.15);
    if (i) potPlant(f, frame(-r.W / 2 + 0.1, -0.65, Math.PI / 2, y + 0.015), 0.4, 0, 1.2, C.coral);
  }
  // the big map of the town: land, the river, the plaza, houses, roads, trees, "you are here"
  const mp = r.back(-0.25, 1.0);
  s.add(shapes.box(2.0, 1.04, 0.04, 0.02, 1), C.woodDark, mp(0, 0, 0.02), { ao: false });
  s.add(shapes.box(1.9, 0.94, 0.02, 0.008, 1), '#cfe9b4', mp(0, 0, 0.045), { ao: false });
  for (let i = 0; i < 7; i++) s.add(shapes.box(0.32, 0.09, 0.01, 0.02, 1), C.sky, mp(-0.85 + i * 0.27, -0.3 + Math.sin(i * 0.9) * 0.08, 0.056, { rz: Math.cos(i * 0.9) * 0.3 }), { ao: false });
  s.add(shapes.box(1.8, 0.035, 0.01, 0.004, 1), C.cream, mp(0, 0.05, 0.057), { ao: false });
  s.add(shapes.box(0.035, 0.85, 0.01, 0.004, 1), C.cream, mp(-0.1, 0, 0.057), { ao: false });
  s.add(shapes.cyl(0.12, 0.12, 0.012, 16), C.plazaB, mp(-0.1, 0.05, 0.06, { rx: Math.PI / 2 }), { ao: false });
  const houses: [number, number, string][] = [
    [-0.6, 0.25, C.coral],
    [-0.4, 0.3, C.sky],
    [0.25, 0.28, C.pink],
    [0.5, 0.22, C.mint],
    [0.75, 0.3, C.lilac],
    [-0.65, -0.08, C.mustard],
    [0.3, -0.1, C.cream],
    [0.65, -0.12, C.teal],
    [-0.35, -0.12, C.red],
  ];
  for (const [x, y, c] of houses) {
    s.add(shapes.box(0.1, 0.08, 0.015, 0.006, 1), c, mp(x, y, 0.06), { ao: false });
    s.add(shapes.box(0.1, 0.03, 0.016, 0.006, 1), C.red, mp(x, y + 0.05, 0.061), { ao: false, shade: -0.2 });
  }
  for (let i = 0; i < 10; i++) s.add(shapes.sphere(0.03, 6, 4), C.leafDeep, mp(-0.85 + ((i * 37) % 17) / 10, 0.38 - ((i * 13) % 7) / 10, 0.06, { s: [1, 1, 0.3] }), { ao: false });
  s.add(shapes.cone(0.035, 0.08, 8), C.red, mp(-0.1, 0.12, 0.07, { rx: Math.PI }), { ao: false });
  s.add(shapes.sphere(0.035, 8, 6), C.red, mp(-0.1, 0.17, 0.07), { ao: false });
  // a model of the pavilion on a stand
  const md = { x: 1.15, z: -0.9 };
  f.add(shapes.cyl(0.16, 0.18, 0.4, 12), C.trim, { x: md.x, y: 0.2, z: md.z });
  f.add(shapes.cyl(0.13, 0.13, 0.02, 6), C.stone, { x: md.x, y: 0.41, z: md.z }, { ao: false });
  for (let i = 0; i < 6; i++) f.add(shapes.cyl(0.006, 0.006, 0.12, 4), C.trim, { x: md.x + Math.cos(i * 1.047) * 0.1, y: 0.48, z: md.z + Math.sin(i * 1.047) * 0.1 }, { ao: false });
  f.add(shapes.cone(0.15, 0.09, 6), C.coral, { x: md.x, y: 0.58, z: md.z }, { ao: false });
  r.block(md.x, md.z, 0.18, 0.18, 'model stand');
  // a bench for visitors with a suitcase, a brochure rack, windows, plants, the lamps
  const vb = bench(r, 2.05, -0.75, Math.PI, 2, C.wood);
  f.add(shapes.box(0.22, 0.3, 0.12, 0.03, 2), C.coral, { x: 2.05, y: 0.15, z: -0.1, ry: 0.2 });
  r.block(2.05, -0.1, 0.12, 0.08, 'suitcase');
  const br = frame(1.25, -1.88, 0, 0);
  f.add(shapes.box(0.5, 0.7, 0.1, 0.02, 1), C.woodLight, br(0, 0.35, -0.05));
  for (let i = 0; i < 3; i++)
    for (let k = 0; k < 3; k++) {
      f.add(shapes.box(0.13, 0.02, 0.06, 0.006, 1), C.woodDark, br(-0.16 + k * 0.16, 0.2 + i * 0.2, 0.03), { ao: false });
      f.add(shapes.box(0.11, 0.15, 0.012, 0.004, 1), [C.coral, C.sky, C.butter, C.mint, C.pink, C.lilac][(i * 3 + k) % 6], br(-0.16 + k * 0.16, 0.27 + i * 0.2, 0.05, { rx: -0.15 }), { ao: false });
    }
  r.block(1.25, -1.91, 0.26, 0.1, 'brochure rack');
  windowAt(r, r.back(2.05, 1.05), 0.55, 0.62, { panes: 2, curtain: C.sky });
  wallClock(r, r.back(1.25, 1.38), 0.13, C.blue);
  picture(r, r.back(1.25, 1.0), 0.4, 0.3, C.woodDark, 'landscape', C.sky);
  plant(r, 2.35, 0.7, 1.4, C.blue, 'tall');
  plant(r, 0.55, -1.85, 1.1, C.coral, 'leafy');
  rug(r, 0.3, -0.5, 2.0, 1.4, '#f3d7a7', C.blue, { stripes: C.sky });
  for (const [x, z] of [
    [-1.35, -0.95],
    [0.8, -0.6],
  ])
    pendant(r, x, 1.25, z, C.blue, r.H + 0.4, { wide: true });
  return people({ x: -1.85, z: -0.45 }, { x: -0.85, z: -0.6 }, { x: -0.5, z: -1.3 }, [vb[1], { x: 0.45, z: -1.2, heading: -2.0, pose: 'stand' }], { hostPose: 'counter' });
}

// ───────────────────────── the boarding house's common room ─────────────────────────

export function inn(r: Room): Cast {
  shell(r, { wall: '#f4dcc0', stripes: '#efd2b2', wainscot: '#9a6c4a', wainscotH: 0.52, rail: C.woodDark, floor: 'boards', floorA: '#b98656', floorB: '#a57046' });
  const f = r.furn;
  const s = r.shell;
  // the stairs up along the back wall, with a banister
  const steps = 10;
  const sx0 = 0.45;
  const sw = 0.2;
  const sh = 0.13;
  for (let i = 0; i < steps; i++) {
    const h = (i + 1) * sh;
    f.add(shapes.box(sw, h, 0.62, 0.01, 1), C.woodDark, { x: sx0 + i * sw + sw / 2, y: h / 2, z: -r.D / 2 + 0.31 });
    f.add(shapes.box(sw + 0.02, 0.025, 0.64, 0.008, 1), C.wood, { x: sx0 + i * sw + sw / 2, y: h, z: -r.D / 2 + 0.32 }, { ao: false });
    f.add(shapes.box(0.012, 0.26, 0.012, 0.004, 1), C.trim, { x: sx0 + i * sw + sw / 2, y: h + 0.13, z: -r.D / 2 + 0.6 }, { ao: false });
  }
  const run = steps * sw;
  const rise = steps * sh;
  f.add(shapes.box(Math.hypot(run, rise) + 0.1, 0.03, 0.04, 0.012, 1), C.woodDark, { x: sx0 + run / 2, y: rise / 2 + 0.3, z: -r.D / 2 + 0.6, rz: Math.atan2(rise, run) }, { ao: false });
  f.add(shapes.cyl(0.035, 0.035, 0.5, 8), C.woodDark, { x: sx0 + 0.05, y: 0.25, z: -r.D / 2 + 0.6 }, { ao: false });
  f.add(shapes.sphere(0.045, 8, 6), C.woodDark, { x: sx0 + 0.05, y: 0.52, z: -r.D / 2 + 0.6 }, { ao: false });
  r.block(sx0 + run / 2, -r.D / 2 + 0.32, run / 2 + 0.05, 0.34, 'stairs');
  // a runner on the stairs
  for (let i = 0; i < steps; i++) f.add(shapes.box(sw + 0.02, 0.008, 0.3, 0.003, 1), C.red, { x: sx0 + i * sw + sw / 2, y: (i + 1) * sh + 0.016, z: -r.D / 2 + 0.32 }, { ao: false });
  // the long shared table: a runner, a teapot, bread, cups; chairs on both sides
  const lt = table(r, 0.85, -0.75, 1.6, 0.5, 0, C.wood, { legs: C.woodDark });
  f.add(shapes.box(1.4, 0.006, 0.2, 0.003, 1), C.cream, lt(0, 0.004, 0), { ao: false });
  f.add(shapes.sphere(0.055, 10, 8), C.teal, lt(-0.2, 0.05, 0, { s: [1.15, 0.9, 1] }), { ao: false });
  f.add(shapes.cyl(0.015, 0.01, 0.06, 6), C.teal, lt(-0.27, 0.07, 0, { rz: 0.9 }), { ao: false });
  r.steam.push([lt(-0.2, 0.1, 0).x!, TABLE + 0.11, lt(-0.2, 0.1, 0).z!]);
  f.add(shapes.cyl(0.09, 0.08, 0.012, 12), C.woodLight, lt(0.25, 0.006, 0), { ao: false });
  f.add(shapes.sphere(0.07, 10, 8), '#d9a35f', lt(0.25, 0.04, 0, { s: [1.4, 0.6, 1] }), { ao: false });
  for (const [x, z] of [
    [-0.55, 0.12],
    [-0.05, -0.14],
    [0.5, 0.14],
    [0.6, -0.12],
  ])
    cup(r, lt, x, z, (x * 10) % 2 ? C.cream : C.white, x === -0.55);
  f.add(shapes.cyl(0.02, 0.025, 0.04, 8), C.mustard, lt(0.0, 0.02, 0.05), { ao: false });
  f.add(shapes.cyl(0.012, 0.012, 0.08, 6), C.cream, lt(0.0, 0.08, 0.05), { ao: false });
  r.bulbs.add(shapes.sphere(0.012, 6, 4), C.glow, lt(0.0, 0.125, 0.05));
  const ch: RoomAnchor[] = [];
  for (const x of [0.3, 0.85, 1.4]) ch.push(chair(r, x, -1.2, H_PZ, C.woodDark, { cushion: C.red }));
  for (const x of [0.3, 1.4]) chair(r, x, -0.3, -Math.PI / 2, C.woodDark, { cushion: C.red });
  // the sideboard with the kettle that steams, a biscuit tin, mugs on hooks
  const sb = r.left(-1.35, 0);
  f.add(shapes.box(1.0, 0.4, 0.3, 0.02, 1), C.woodDark, sb(0, 0.2, 0.15));
  f.add(shapes.box(1.04, 0.03, 0.32, 0.01, 1), C.wood, sb(0, 0.415, 0.16), { ao: false });
  for (let i = 0; i < 2; i++) f.add(shapes.box(0.44, 0.3, 0.012, 0.008, 1), C.wood, sb(-0.24 + i * 0.48, 0.2, 0.305), { ao: false });
  r.block(-r.W / 2 + 0.15, -1.35, 0.16, 0.52, 'sideboard');
  const st = frame(-r.W / 2 + 0.16, -1.35, Math.PI / 2, 0.43);
  f.add(shapes.cyl(0.06, 0.075, 0.12, 12), C.red, st(-0.25, 0.06, 0), { ao: false });
  f.add(shapes.cyl(0.03, 0.04, 0.03, 10), C.red, st(-0.25, 0.135, 0), { ao: false });
  f.add(shapes.torus(0.05, 0.01, 10), C.stoneDark, st(-0.25, 0.15, 0, { rx: 0 }), { ao: false });
  f.add(shapes.cone(0.02, 0.08, 6), C.red, st(-0.18, 0.07, 0.02, { rz: -1.0 }), { ao: false });
  const kt = st(-0.25, 0.18, 0);
  r.steam.push([kt.x! + 0.05, kt.y!, kt.z! - 0.07]);
  f.add(shapes.cyl(0.06, 0.06, 0.08, 12), C.navy, st(0.05, 0.04, 0), { ao: false });
  f.add(shapes.cyl(0.062, 0.062, 0.02, 12), C.mustard, st(0.05, 0.09, 0), { ao: false });
  for (let i = 0; i < 3; i++) cup(r, st, 0.25 + i * 0.08, 0.02, [C.white, C.sky, C.mustard][i], false, false);
  const mh = r.left(-1.35, 0.85);
  f.add(shapes.box(0.8, 0.04, 0.04, 0.01, 1), C.woodDark, mh(0, 0, 0.02));
  for (let i = 0; i < 5; i++) {
    f.add(shapes.cyl(0.026, 0.022, 0.05, 8), [C.white, C.coral, C.sky, C.mint, C.mustard][i], mh(-0.32 + i * 0.16, -0.06, 0.06), { ao: false });
    f.add(shapes.cyl(0.004, 0.004, 0.04, 4), C.metal, mh(-0.32 + i * 0.16, -0.02, 0.04), { ao: false });
  }
  // the key rack and the guest book by the door
  const kr = r.left(0.55, 1.02);
  s.add(shapes.box(0.6, 0.36, 0.04, 0.02, 1), C.woodDark, kr(0, 0, 0.02), { ao: false });
  s.add(shapes.box(0.3, 0.06, 0.012, 0.006, 1), C.cream, kr(0, 0.13, 0.045), { ao: false });
  for (let i = 0; i < 8; i++) {
    const x = -0.22 + (i % 4) * 0.15;
    const y = 0.02 - Math.floor(i / 4) * 0.13;
    s.add(shapes.cyl(0.006, 0.006, 0.04, 4), C.mustard, kr(x, y, 0.06, { rx: Math.PI / 2 }), { ao: false });
    if (i !== 2 && i !== 5) {
      s.add(shapes.box(0.012, 0.06, 0.006, 0.003, 1), C.mustard, kr(x, y - 0.04, 0.07), { ao: false });
      s.add(shapes.box(0.035, 0.045, 0.006, 0.003, 1), [C.red, C.blue, C.leaf, C.plum][i % 4], kr(x, y - 0.09, 0.07), { ao: false });
    }
  }
  const gb = table(r, -r.W / 2 + 0.25, 0.55, 0.5, 0.3, Math.PI / 2, C.woodDark, { h: 0.4 });
  f.add(shapes.box(0.2, 0.02, 0.14, 0.006, 1), C.red, gb(0.05, 0.01, 0), { ao: false });
  f.add(shapes.box(0.18, 0.006, 0.12, 0.003, 1), C.cream, gb(0.05, 0.024, 0), { ao: false });
  f.add(shapes.dome(0.03, 10, 4), C.mustard, gb(-0.15, 0, 0.05), { ao: false });
  tableLamp(r, gb, -0.12, -0.07, C.butter, true);
  // the wood stove in the corner with an armchair, a rug, pictures, a window, plants
  const sv = { x: -2.25, z: -1.75 };
  f.add(shapes.cyl(0.2, 0.22, 0.42, 14), '#3b3640', { x: sv.x, y: 0.25, z: sv.z });
  f.add(shapes.box(0.36, 0.05, 0.36, 0.015, 1), '#3b3640', { x: sv.x, y: 0.025, z: sv.z });
  f.add(shapes.cyl(0.05, 0.05, 1.3, 8), '#3b3640', { x: sv.x, y: 1.1, z: sv.z }, { ao: false });
  r.screens.add(shapes.box(0.14, 0.1, 0.04, 0.02, 1), C.orange, { x: sv.x + 0.1, y: 0.25, z: sv.z + 0.13, ry: Math.PI / 4 });
  r.lamp(sv.x + 0.25, 0.3, sv.z + 0.25);
  r.flicker = { lamp: 0, day: 0.7 };
  r.halo(sv.x + 0.15, 0.25, sv.z + 0.17, 0.8);
  r.block(sv.x, sv.z, 0.24, 0.24, 'stove');
  const ac = armchair(r, -1.55, -1.55, 0.75, C.teal, { wing: true, cushion: C.mint });
  rug(r, -0.6, -0.6, 1.8, 1.3, C.red, C.mustard, { stripes: C.cream });
  windowAt(r, r.back(-0.75, 1.0), 0.6, 0.56, { curtain: C.mustard, panes: 2 });
  picture(r, r.back(-1.55, 1.15), 0.3, 0.38, C.mustard, 'landscape', C.sky);
  picture(r, r.back(0.1, 1.18), 0.28, 0.22, C.mustard, 'flower', C.butter);
  wallClock(r, r.left(-0.4, 1.25), 0.12, C.woodDark);
  plant(r, 2.35, 0.4, 1.4, C.coral, 'leafy');
  plant(r, -2.4, 1.55, 1.2, C.cream, 'tall');
  floorLamp(r, 2.35, -1.0, C.butter, false);
  pendant(r, 0.85, 1.25, -0.75, C.mustard, r.H + 0.4, { wide: true });
  return people({ x: -1.15, z: 0.2 }, { x: -0.15, z: 0.05 }, { x: -0.6, z: -1.05 }, [ch[0], ch[2], ac]);
}

