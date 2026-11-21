// Rooms: Sam's bus station waiting room, Zoe's cinema lobby.

import { Mesh, MeshStandardMaterial, type ColorRepresentation } from 'three';
import type { RoomAnchor } from '../contracts';
import { Merge, shapes } from '../../scene/merge';
import { C } from '../../scene/palette3d';
import { COUNTER, frame, H_NZ, H_PX, H_PZ, people, poster, shell, wallClock, windowAt, type Cast, type Room } from '../build';
import { bench, counter, goods, pendant, plant, rug } from '../furniture';

/** A suitcase standing on its end (or lying), with a handle. */
function suitcase(r: Room, x: number, z: number, ry: number, color: ColorRepresentation, size = 1): void {
  const p = frame(x, z, ry);
  const m = r.furn;
  m.add(shapes.box(0.22 * size, 0.3 * size, 0.12 * size, 0.03, 2), color, p(0, 0.15 * size, 0));
  m.add(shapes.box(0.012, 0.3 * size, 0.125 * size, 0.004, 1), color, p(0, 0.15 * size, 0), { shade: -0.12, ao: false });
  m.add(shapes.box(0.08, 0.02, 0.02, 0.008, 1), C.metal, p(0, 0.31 * size, 0), { ao: false });
  for (const s of [-1, 1]) m.add(shapes.cyl(0.015, 0.015, 0.02, 6), '#2e3142', p(s * 0.08 * size, 0.012, 0.04, { rz: Math.PI / 2 }), { ao: false });
  r.block(x, z, 0.12 * size, 0.08 * size, 'suitcase', ry);
}

/** A mesh whose bulbs blink on their own (marquee chase lights): two sets that take turns. */
function chaseBulbs(r: Room, build: (a: Merge, b: Merge) => void): void {
  const a = new Merge();
  const b = new Merge();
  build(a, b);
  const mats: MeshStandardMaterial[] = [];
  for (const m of [a, b]) {
    const g = m.build();
    if (!g) continue;
    r.geo(g);
    const mat = r.mat(new MeshStandardMaterial({ color: '#fff4d6', emissive: C.glow, emissiveIntensity: 0.4, roughness: 0.4 }));
    mats.push(mat);
    r.root.add(new Mesh(g, mat));
  }
  let night = 0;
  r.nightHooks.push((k) => (night = k));
  r.life.push((t) => {
    const on = Math.floor(t * 2.5) % 2;
    mats.forEach((m, i) => (m.emissiveIntensity = (i === on ? 1.4 : 0.35) * (0.6 + 1.4 * night)));
  });
}

// ───────────────────────── the bus station ─────────────────────────

export function station(r: Room): Cast {
  shell(r, { wall: '#f6ead6', wainscot: '#ffffff', wainscotH: 0.62, rail: C.blue, floor: 'stone', floorA: '#ddd6cf', floorB: '#cbc3bb', tile: 0.5, skirting: C.blue });
  const f = r.furn;
  const s = r.shell;
  // tile lines on the white lower wall
  for (let y = 0.12; y < 0.6; y += 0.12) {
    s.add(shapes.box(r.W, 0.006, 0.006, 0.002, 1), '#d5dfe9', { y, z: -r.D / 2 + 0.024 }, { ao: false });
    s.add(shapes.box(0.006, 0.006, r.D, 0.002, 1), '#d5dfe9', { x: -r.W / 2 + 0.024, y }, { ao: false });
  }
  // the ticket window: a counter, posts and a header with the red sign, a printer, a bell, a slot
  const top = counter(r, -1.4, -0.65, 1.7, 0.38, H_PX, C.blue, C.cream, { panels: '#8db4e2' });
  const hp = frame(-1.4, -0.65, Math.PI / 2, 0);
  // one post at the far end; the sign hangs from the ceiling at the near end (no post between the camera and Sam)
  f.add(shapes.box(0.08, 1.4, 0.08, 0.02, 1), C.navy, hp(0.82, 0.7, 0.12));
  for (const sx of [-0.7, 0.2]) f.add(shapes.cyl(0.006, 0.006, 0.4, 4), C.metal, hp(sx, 1.65, 0.12), { ao: false });
  f.add(shapes.box(1.74, 0.26, 0.12, 0.03, 1), C.navy, hp(0, 1.32, 0.12), { ao: false });
  f.add(shapes.box(1.1, 0.16, 0.02, 0.02, 1), C.red, hp(0, 1.32, 0.19), { ao: false });
  for (let i = 0; i < 7; i++) f.add(shapes.box(0.09, 0.08, 0.01, 0.004, 1), C.white, hp(-0.39 + i * 0.13, 1.32, 0.205), { ao: false });
  f.add(shapes.box(0.18, 0.1, 0.16, 0.02, 1), C.stone, top(0.3, 0.05, -0.04), { ao: false });
  f.add(shapes.box(0.12, 0.004, 0.06, 0.002, 1), C.butter, top(0.3, 0.1, 0.06, { rx: 0.3 }), { ao: false });
  f.add(shapes.dome(0.03, 10, 4), C.mustard, top(-0.1, 0, 0.12), { ao: false });
  f.add(shapes.box(0.3, 0.012, 0.16, 0.006, 1), C.metal, top(-0.4, 0.006, 0.08), { ao: false });
  // behind Sam: a rack of leaflets and a route map
  const lw = r.left(-0.65, 0);
  f.add(shapes.box(1.4, 0.36, 0.24, 0.02, 1), C.stone, lw(0, 0.18, 0.12));
  r.block(-r.W / 2 + 0.12, -0.65, 0.12, 0.7, 'cabinet');
  const rm = r.left(-0.65, 1.0);
  s.add(shapes.box(1.26, 0.6, 0.02, 0.008, 1), C.navy, rm(0, 0, 0.008), { ao: false });
  s.add(shapes.box(1.2, 0.54, 0.02, 0.008, 1), '#e9f3e1', rm(0, 0, 0.012), { ao: false });
  s.add(shapes.box(1.2, 0.08, 0.01, 0.004, 1), C.sky, rm(0, -0.2, 0.022, { rz: 0.06 }), { ao: false });
  for (const [x, y] of [[-0.42, 0.18], [0.36, -0.08], [0.1, 0.2]]) s.add(shapes.sphere(0.06, 8, 6), C.leaf, rm(x, y, 0.02, { s: [1.4, 1, 0.2] }), { ao: false });
  s.add(shapes.box(0.2, 0.08, 0.012, 0.02, 1), C.mustard, rm(-0.4, -0.18, 0.035), { ao: false });
  const stops: [number, number, string][] = [
    [-0.5, -0.1, C.red],
    [-0.25, 0.08, C.red],
    [0.0, -0.02, C.blue],
    [0.25, 0.12, C.blue],
    [0.48, -0.08, C.leafDeep],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    s.add(shapes.box(Math.hypot(x1 - x0, y1 - y0), 0.025, 0.01, 0.004, 1), C.navy, rm((x0 + x1) / 2, (y0 + y1) / 2, 0.025, { rz: Math.atan2(y1 - y0, x1 - x0) }), { ao: false });
  }
  for (const [x, y, c] of stops) s.add(shapes.cyl(0.03, 0.03, 0.012, 10), c, rm(x, y, 0.03, { rx: Math.PI / 2 }), { ao: false });
  // the departures board: rows of times that glow
  const db = r.back(0.15, 1.2);
  f.add(shapes.box(1.5, 0.56, 0.06, 0.02, 1), '#2e3142', db(0, 0, 0.03));
  r.screens.add(shapes.box(1.4, 0.07, 0.01, 0.004, 1), C.mustard, db(0, 0.19, 0.065));
  for (let i = 0; i < 4; i++) {
    r.screens.add(shapes.box(0.16, 0.05, 0.01, 0.004, 1), C.butter, db(-0.56, 0.08 - i * 0.085, 0.065));
    r.screens.add(shapes.box(0.62 - (i % 2) * 0.16, 0.05, 0.01, 0.004, 1), '#e8f1ff', db(-0.04 - (i % 2) * 0.08, 0.08 - i * 0.085, 0.065));
    r.screens.add(shapes.box(0.14, 0.05, 0.01, 0.004, 1), i === 1 ? C.red : C.leaf, db(0.56, 0.08 - i * 0.085, 0.065));
  }
  for (const sx of [-1, 1]) f.add(shapes.cyl(0.01, 0.01, 0.3, 4), C.metal, db(sx * 0.6, 0.42, 0.03), { ao: false });
  wallClock(r, r.back(1.2, 1.3), 0.2, C.navy);
  windowAt(r, r.back(1.95, 0.95), 0.62, 0.66, { panes: 2, arch: true, frame: C.trim });
  poster(r, r.back(-1.35, 1.05), 0.38, 0.52, C.sky, C.leafDeep, 'mountain');
  // benches facing the room, travellers' luggage
  const b1 = bench(r, 0.45, -1.72, H_PZ, 3, C.wood);
  const b2 = bench(r, 1.95, -0.6, Math.PI, 2, C.wood);
  suitcase(r, 1.08, -1.72, 0.1, C.coral);
  suitcase(r, -0.2, -1.66, -0.2, C.teal, 0.8);
  suitcase(r, 1.9, 0.05, 0.6, C.mustard, 0.9);
  f.add(shapes.sphere(0.09, 10, 8), C.plum, { x: 2.05, y: 0.09, z: -1.1, s: [1, 1.1, 0.7] });
  // a bin, a plant, a yellow line on the floor, the lamps
  f.add(shapes.cyl(0.08, 0.07, 0.24, 12), C.leafDeep, { x: 2.35, y: 0.12, z: -1.85 });
  r.block(2.35, -1.85, 0.08, 0.08, 'bin');
  plant(r, -0.6, -1.85, 1.3, C.blue, 'palm');
  s.add(shapes.box(r.W - 0.4, 0.004, 0.05, 0.002, 1), C.mustard, { x: 0.2, y: 0.004, z: 1.75 }, { ao: false });
  for (const [x, z] of [
    [-0.9, -0.8],
    [1.2, -1.0],
  ])
    pendant(r, x, 1.3, z, C.navy, r.H + 0.4, { wide: true });
  return people({ x: -1.85, z: -0.45 }, { x: -0.85, z: -0.6 }, { x: -0.55, z: -1.45 }, [b1[0], b1[2], b2[1]], { hostPose: 'counter' });
}

// ───────────────────────── the cinema lobby ─────────────────────────

export function cinema(r: Room): Cast {
  r.backdrop = { day: '#efe6f2', night: '#1f1a35', groundDay: '#ddd0e2', groundNight: '#2a2140' };
  shell(r, { wall: '#8a67ad', wallLeft: '#7b5a9e', wainscot: '#4f3b72', wainscotH: 0.55, rail: C.mustard, floor: 'carpet', floorA: '#c5525d', floorB: '#b8474f', skirting: C.mustard, cut: '#f3d9a4' });
  const f = r.furn;
  const s = r.shell;
  // a pattern on the carpet: rows of gold dots
  for (let x = -2.4; x < 2.6; x += 0.6) for (let z = -1.8; z < 2.0; z += 0.6) s.add(shapes.cyl(0.05, 0.05, 0.004, 8), '#e0a95e', { x: x + ((Math.round(z / 0.6) % 2) * 0.3), y: 0.003, z }, { ao: false });
  // the concession counter: red with gold trim; popcorn machine, soda taps, cups, candy jars
  const top = counter(r, -1.35, -0.65, 1.8, 0.4, H_PX, C.red, C.cream, { panels: '#d9645d', kick: C.mustard });
  f.add(shapes.box(1.8, 0.03, 0.02, 0.01, 1), C.mustard, frame(-1.35, -0.65, Math.PI / 2, 0)(0, COUNTER - 0.06, 0.205), { ao: false });
  const pm = 0.5;
  f.add(shapes.box(0.32, 0.06, 0.26, 0.02, 1), C.red, top(pm, 0.03, -0.02), { ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.add(shapes.box(0.025, 0.34, 0.025, 0.008, 1), C.mustard, top(pm + sx * 0.15, 0.23, -0.02 + sz * 0.12), { ao: false });
  r.screens.add(shapes.box(0.28, 0.3, 0.22, 0.01, 1), '#fff4c2', top(pm, 0.22, -0.02));
  f.add(shapes.box(0.36, 0.1, 0.3, 0.03, 2), C.red, top(pm, 0.44, -0.02), { ao: false });
  f.add(shapes.box(0.22, 0.05, 0.02, 0.01, 1), C.mustard, top(pm, 0.44, 0.135), { ao: false });
  for (let i = 0; i < 18; i++) f.add(shapes.sphere(0.022, 6, 4), C.cream, top(pm - 0.1 + (i % 6) * 0.04, 0.09 + Math.floor(i / 6) * 0.03, -0.1 + ((i * 7) % 5) * 0.04), { ao: false });
  // kernels that pop inside the machine
  const pops = r.moving((m) => {
    for (let i = 0; i < 5; i++) m.add(shapes.sphere(0.02, 6, 4), C.cream, { x: (i - 2) * 0.04, y: 0, z: ((i * 3) % 5) * 0.03 - 0.06 }, { ao: false });
  });
  const pa = top(pm, 0.18, -0.02);
  pops.position.set(pa.x!, pa.y!, pa.z!);
  r.life.push((t) => {
    pops.position.y = pa.y! + Math.abs(Math.sin(t * 6)) * 0.08;
    pops.rotation.y = t * 0.7;
  });
  for (let i = 0; i < 3; i++) {
    const at = top(0.05 + i * 0.1, 0, 0.12);
    f.add(shapes.cyl(0.04, 0.03, 0.1, 10), i % 2 ? C.white : C.red, { ...at, y: at.y! + 0.05 }, { ao: false });
    f.add(shapes.sphere(0.042, 8, 6), C.cream, { ...at, y: at.y! + 0.11, s: [1, 0.6, 1] }, { ao: false });
  }
  f.add(shapes.box(0.24, 0.26, 0.16, 0.02, 1), C.stoneDark, top(-0.3, 0.13, -0.06), { ao: false });
  for (let i = 0; i < 3; i++) {
    f.add(shapes.box(0.06, 0.1, 0.01, 0.004, 1), [C.red, C.mustard, C.teal][i], top(-0.38 + i * 0.08, 0.18, 0.025), { ao: false });
    f.add(shapes.box(0.015, 0.04, 0.02, 0.004, 1), C.metal, top(-0.38 + i * 0.08, 0.08, 0.04), { ao: false });
  }
  for (let i = 0; i < 3; i++) {
    const at = top(-0.65 + i * 0.09, 0, 0.05);
    f.add(shapes.cyl(0.035, 0.035, 0.1, 10), C.glass, { ...at, y: at.y! + 0.05 }, { ao: false, shade: 0.3 });
    goods(f, frame(at.x!, at.z!, 0, at.y! + 0.02), -0.02, 0.06, 0, 'fruit', [[C.pink, C.leaf, C.mustard][i]]);
  }
  // lit menu boards behind Zoe
  for (const [z, c] of [
    [-1.1, C.mustard],
    [-0.25, C.coral],
  ] as const) {
    const mb = r.left(z, 1.08);
    f.add(shapes.box(0.68, 0.42, 0.04, 0.02, 1), '#2e3142', mb(0, 0, 0.02));
    r.screens.add(shapes.box(0.62, 0.36, 0.01, 0.006, 1), '#3a2d55', mb(0, 0, 0.045));
    r.screens.add(shapes.cyl(0.08, 0.08, 0.01, 12), c, mb(-0.16, 0.02, 0.05, { rx: Math.PI / 2 }));
    for (let i = 0; i < 3; i++) r.screens.add(shapes.box(0.22, 0.025, 0.01, 0.004, 1), C.cream, mb(0.12, 0.08 - i * 0.07, 0.052));
  }
  const bc = r.left(-0.65, 0);
  f.add(shapes.box(1.6, 0.4, 0.24, 0.02, 1), '#4f3b72', bc(0, 0.2, 0.12));
  r.block(-r.W / 2 + 0.12, -0.65, 0.12, 0.8, 'back counter');
  for (let i = 0; i < 6; i++) {
    const at = bc(-0.6 + i * 0.24, 0.4, 0.12);
    f.add(shapes.cyl(0.05, 0.04, 0.12, 10), i % 2 ? C.white : C.red, { ...at, y: 0.46 }, { ao: false });
  }
  // movie posters in lit frames, the doors to the screens with a marquee over them
  const frames: [number, string, string, 'star' | 'mountain' | 'circle'][] = [
    [-0.35, C.navy, C.mustard, 'star'],
    [0.55, C.teal, C.pink, 'mountain'],
  ];
  for (const [x, bg, fg, sh] of frames) {
    const pp = r.back(x, 0.98);
    s.add(shapes.box(0.62, 0.86, 0.04, 0.02, 1), C.mustard, pp(0, 0, 0.02), { ao: false });
    poster(r, r.back(x, 0.98, 0.045), 0.5, 0.74, bg, fg, sh);
  }
  const dx = 1.75;
  const dp = r.back(dx, 0);
  for (const sx of [-1, 1]) {
    s.add(shapes.box(0.4, 0.92, 0.05, 0.02, 1), C.red, dp(sx * 0.21, 0.46, 0.03));
    s.add(shapes.torus(0.07, 0.015, 12), C.mustard, dp(sx * 0.21, 0.66, 0.06), { ao: false });
    s.add(shapes.cyl(0.065, 0.065, 0.01, 12), '#3a2d55', dp(sx * 0.21, 0.66, 0.06, { rx: Math.PI / 2 }), { ao: false });
    s.add(shapes.box(0.03, 0.18, 0.03, 0.01, 1), C.mustard, dp(sx * 0.05, 0.45, 0.07), { ao: false });
  }
  s.add(shapes.box(0.96, 0.06, 0.06, 0.02, 1), C.mustard, dp(0, 0.95, 0.04), { ao: false });
  const mq = r.back(dx, 1.3);
  s.add(shapes.box(1.1, 0.4, 0.08, 0.03, 2), C.navy, mq(0, 0, 0.04), { ao: false });
  s.add(shapes.box(0.9, 0.12, 0.02, 0.01, 1), C.cream, mq(0, 0.02, 0.085), { ao: false });
  for (let i = 0; i < 6; i++) s.add(shapes.box(0.09, 0.07, 0.01, 0.004, 1), i % 2 ? C.plum : C.red, mq(-0.3 + i * 0.12, 0.02, 0.098), { ao: false });
  chaseBulbs(r, (a, b) => {
    for (let i = 0; i < 12; i++) {
      const u = -0.5 + i * (1.0 / 11);
      (i % 2 ? a : b).add(shapes.sphere(0.022, 6, 4), C.glow, mq(u, 0.16, 0.09));
      (i % 2 ? b : a).add(shapes.sphere(0.022, 6, 4), C.glow, mq(u, -0.16, 0.09));
    }
    for (const [x] of frames) {
      const pp = r.back(x, 0.98);
      for (let i = 0; i < 8; i++) {
        (i % 2 ? a : b).add(shapes.sphere(0.018, 6, 4), C.glow, pp(-0.31 + 0.62 * (i / 7), 0.45, 0.04));
        (i % 2 ? b : a).add(shapes.sphere(0.018, 6, 4), C.glow, pp(-0.31 + 0.62 * (i / 7), -0.45, 0.04));
      }
    }
  });
  r.halo(dx, 1.3, -r.D / 2 + 0.25, 1.4);
  // the rope barriers: brass posts, red velvet ropes
  const posts: [number, number][] = [
    [0.05, -0.35],
    [0.85, -0.35],
    [1.65, -0.35],
    [1.65, -1.05],
  ];
  for (const [x, z] of posts) {
    f.add(shapes.cyl(0.07, 0.08, 0.025, 12), C.mustard, { x, y: 0.012, z });
    f.add(shapes.cyl(0.015, 0.015, 0.36, 6), C.mustard, { x, y: 0.2, z }, { ao: false });
    f.add(shapes.sphere(0.03, 8, 6), C.mustard, { x, y: 0.39, z }, { ao: false });
    r.block(x, z, 0.08, 0.08, 'post');
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const [x0, z0] = posts[i];
    const [x1, z1] = posts[i + 1];
    const n = 8;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      const x = x0 + (x1 - x0) * u;
      const z = z0 + (z1 - z0) * u;
      const y = 0.34 - Math.sin(u * Math.PI) * 0.09;
      f.add(shapes.sphere(0.022, 6, 4), C.red, { x, y, z, s: [Math.abs(x1 - x0) > 0.01 ? 2.2 : 1, 1, Math.abs(z1 - z0) > 0.01 ? 2.2 : 1] }, { ao: false });
    }
    r.block((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2 + 0.03, Math.abs(z1 - z0) / 2 + 0.03, 'rope');
  }
  // a velvet bench, plants, wall lamps
  const vb = bench(r, 0.15, -1.75, H_PZ, 2, C.plum, { legs: C.mustard });
  plant(r, 2.35, -0.4, 1.5, C.mustard, 'palm');
  plant(r, 2.35, 0.9, 1.2, C.mustard, 'leafy');
  for (const x of [-1.0, 1.1]) {
    const wl = r.back(x, 1.25);
    s.add(shapes.cyl(0.05, 0.07, 0.12, 10), C.mustard, wl(0, 0, 0.07, { rx: Math.PI }), { ao: false });
    r.bulbs.add(shapes.sphere(0.035, 8, 6), C.glow, wl(0, 0.05, 0.07));
    r.halo(x, 1.32, -r.D / 2 + 0.1, 0.8);
  }
  r.lamp(-1.0, 1.25, -1.6);
  pendant(r, -1.35, 1.3, -0.4, C.mustard, r.H + 0.4, { wide: true });
  rug(r, 0.9, -0.95, 2.0, 0.6, C.red, C.mustard, { ry: 0 });
  const extras: RoomAnchor[] = [
    { x: 0.45, z: -0.12, heading: H_NZ - 0.6, pose: 'stand' },
    { x: 1.25, z: -0.1, heading: Math.PI + 0.3, pose: 'stand' },
    vb[0],
  ];
  return people({ x: -1.85, z: -0.45 }, { x: -0.85, z: -0.6 }, { x: -0.5, z: -1.45 }, extras, { hostPose: 'counter', fill: 0.95 });
}

