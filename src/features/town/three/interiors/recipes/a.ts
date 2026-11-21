// Rooms: the café (Emma), Grace's home, Mia's place, Ben's shop.

import { shapes } from '../../scene/merge';
import { C } from '../../scene/palette3d';
import { COUNTER, frame, H_NX, H_NZ, H_PX, H_PZ, people, picture, poster, shell, TABLE, wallClock, windowAt, type Cast, type Room } from '../build';
import { armchair, beanBag, books, chair, counter, cup, floorLamp, goods, pendant, plant, potPlant, roundTable, rug, shelfUnit, sofa, table, tableLamp } from '../furniture';

// ───────────────────────── the café ─────────────────────────

export function cafe(r: Room): Cast {
  shell(r, { wall: C.cream, stripes: '#fbe8cf', wainscot: '#8fcdbf', wainscotH: 0.52, rail: C.trim, floor: 'planks', floorA: '#d6a574', floorB: '#c48c5c' });
  const f = r.furn;
  // the counter along the left, its front to the room; Emma behind it
  const top = counter(r, -1.35, -0.7, 1.9, 0.36, H_PX, '#8d6245', '#f4efe6', { panels: '#a8735a' });
  // the coffee machine: red body, steel top, two group heads, a cup under one
  const mx = 0.55;
  f.add(shapes.box(0.22, 0.24, 0.3, 0.03, 2), C.red, top(mx, 0.12, -0.04));
  f.add(shapes.box(0.24, 0.03, 0.32, 0.01, 1), C.stone, top(mx, 0.255, -0.04), { ao: false });
  for (const s of [-1, 1]) {
    f.add(shapes.cyl(0.025, 0.02, 0.04, 8), C.metal, top(mx + s * 0.07, 0.1, 0.13), { ao: false });
    f.add(shapes.box(0.012, 0.012, 0.07, 0.008, 1), C.woodDark, top(mx + s * 0.07, 0.09, 0.18), { ao: false });
  }
  f.add(shapes.box(0.2, 0.015, 0.08, 0.008, 1), C.metal, top(mx, 0.01, 0.13), { ao: false });
  cup(r, top, mx + 0.07, 0.13, C.white, true, false);
  for (let i = 0; i < 3; i++) cup(r, top, mx - 0.06 + i * 0.05, -0.1, i === 1 ? C.mint : C.white, false, false);
  // a grinder and a jar of beans
  f.add(shapes.box(0.08, 0.12, 0.08, 0.02, 1), C.navy, top(mx - 0.25, 0.06, -0.05), { ao: false });
  f.add(shapes.cone(0.05, 0.08, 10), C.glass, top(mx - 0.25, 0.16, -0.05), { ao: false });
  // the till and a tip jar
  f.add(shapes.box(0.16, 0.08, 0.12, 0.02, 1), C.stoneDark, top(0.05, 0.04, -0.06), { ao: false });
  r.screens.add(shapes.box(0.12, 0.08, 0.01, 0.008, 1), '#6fb0d8', top(0.05, 0.13, -0.02, { rx: -0.4 }));
  f.add(shapes.cyl(0.03, 0.03, 0.07, 8), C.sky, top(-0.12, 0.035, 0.08), { ao: false });
  // the cake stand at the front end: two tiers of cakes and cupcakes
  const ck = -0.62;
  f.add(shapes.cyl(0.13, 0.13, 0.012, 16), C.white, top(ck, 0.04, 0), { ao: false });
  f.add(shapes.cyl(0.012, 0.012, 0.16, 6), C.metal, top(ck, 0.1, 0), { ao: false });
  f.add(shapes.cyl(0.09, 0.09, 0.012, 14), C.white, top(ck, 0.16, 0), { ao: false });
  const cakes = [C.pink, '#8a5a44', C.butter, C.mint];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    f.add(shapes.cyl(0.03, 0.025, 0.035, 10), cakes[i], top(ck + Math.cos(a) * 0.08, 0.065, Math.sin(a) * 0.08), { ao: false });
    f.add(shapes.sphere(0.028, 8, 6), C.cream, top(ck + Math.cos(a) * 0.08, 0.085, Math.sin(a) * 0.08, { s: [1, 0.6, 1] }), { ao: false });
  }
  f.add(shapes.cyl(0.06, 0.06, 0.06, 14), C.rose, top(ck, 0.2, 0), { ao: false });
  f.add(shapes.sphere(0.02, 6, 4), C.red, top(ck, 0.24, 0), { ao: false });
  // the back counter against the wall: a cabinet, shelves of jars and cups above
  const bk = r.left(-0.7, 0);
  f.add(shapes.box(1.7, 0.36, 0.26, 0.02, 1), C.cream, bk(0, 0.18, 0.13));
  f.add(shapes.box(1.74, 0.03, 0.3, 0.01, 1), C.wood, bk(0, 0.375, 0.15), { ao: false });
  for (let i = 0; i < 4; i++) f.add(shapes.box(0.38, 0.28, 0.012, 0.008, 1), '#8fcdbf', bk(-0.63 + i * 0.42, 0.18, 0.265), { ao: false });
  goods(f, frame(-2.7 + 0.14, -0.7, Math.PI / 2, 0.39), -0.8, 0.5, 0, 'jar', [C.woodDark, C.mustard, '#5b3b2a']);
  for (const [y, i] of [
    [0.74, 0],
    [0.98, 1],
    [1.22, 2],
  ] as const) {
    f.add(shapes.box(1.4, 0.03, 0.2, 0.01, 1), C.wood, bk(0.05, y, 0.1));
    const sp = frame(-2.7 + 0.1, -0.7, Math.PI / 2, y + 0.015);
    if (i === 0) for (let k = 0; k < 7; k++) cup(r, sp, -0.6 + k * 0.17, 0, k % 2 ? C.mint : C.white, false, false);
    else if (i === 1) goods(f, sp, -0.6, 1.3, 0, 'jar', ['#6b4430', C.mustard, C.coral, C.cream]);
    else goods(f, sp, -0.6, 1.3, 0, 'box', [C.coral, C.teal, C.butter, C.plum], 2);
  }
  // the menu chalkboard over the far end of the counter, a clock, a window, pictures
  const mb = r.back(-1.35, 1.12);
  f.add(shapes.box(1.12, 0.64, 0.04, 0.02, 1), C.woodDark, mb(0, 0, 0.02));
  r.shell.add(shapes.box(1.02, 0.54, 0.02, 0.008, 1), '#38473f', mb(0, 0, 0.045), { ao: false });
  r.shell.add(shapes.box(0.5, 0.05, 0.01, 0.008, 1), C.white, mb(-0.12, 0.19, 0.057), { ao: false });
  for (let i = 0; i < 5; i++) {
    r.shell.add(shapes.box(0.36, 0.02, 0.01, 0.008, 1), '#e8efe4', mb(-0.2, 0.08 - i * 0.075, 0.057), { ao: false });
    r.shell.add(shapes.box(0.08, 0.02, 0.01, 0.008, 1), C.butter, mb(0.33, 0.08 - i * 0.075, 0.057), { ao: false });
  }
  r.shell.add(shapes.cyl(0.05, 0.04, 0.01, 10), C.white, mb(0.3, 0.18, 0.057, { rx: Math.PI / 2 }), { ao: false });
  wallClock(r, r.back(0.05, 1.36), 0.15, C.woodDark);
  windowAt(r, r.back(0.95, 0.98), 0.8, 0.62, { curtain: C.red, frame: C.trim, panes: 3 });
  picture(r, r.back(2.05, 1.08), 0.4, 0.32, C.woodDark, 'landscape');
  picture(r, r.back(2.05, 0.66), 0.28, 0.22, C.woodDark, 'flower', C.butter);
  // pendant lamps over the counter on a rail
  r.shell.add(shapes.box(0.06, 0.05, 2.5, 0.015, 1), C.woodDark, { x: -1.35, y: r.H - 0.03, z: -0.85 }, { ao: false });
  for (const z of [-1.45, -0.7, 0.05]) pendant(r, -1.35, 1.18, z, C.teal, r.H - 0.05, { light: z !== -1.45 });
  // little tables with chairs
  roundTable(r, 0.4, -1.35, 0.2, C.trim);
  const e1 = chair(r, 0.05, -1.35, H_PX, C.coral, { cushion: C.cream });
  const e2 = chair(r, 0.75, -1.35, H_NX, C.coral, { cushion: C.cream });
  const t1 = frame(0.4, -1.35, 0, TABLE);
  cup(r, t1, -0.08, 0.02, C.white, true);
  cup(r, t1, 0.08, -0.03, C.mint, true);
  roundTable(r, 1.55, -0.55, 0.2, C.trim);
  const e3 = chair(r, 1.55, -0.9, H_PZ, C.teal, { cushion: C.cream });
  chair(r, 1.55, -0.2, H_NZ, C.teal, { cushion: C.cream });
  const t2 = frame(1.55, -0.55, 0, TABLE);
  cup(r, t2, 0, -0.08, C.white, true);
  f.add(shapes.cyl(0.05, 0.05, 0.01, 12), C.white, t2(0.07, 0.005, 0.06), { ao: false });
  f.add(shapes.sphere(0.035, 8, 6), C.butter, t2(0.07, 0.025, 0.06, { s: [1.3, 0.6, 1] }), { ao: false });
  potPlant(f, t2, -0.08, 0.06, 0.8, C.coral);
  // plants and a board outside the counter
  plant(r, 2.3, -1.75, 1.6, C.cream, 'palm');
  plant(r, -0.55, -1.8, 1.1, C.coral, 'leafy');
  plant(r, 2.35, 0.5, 1.3, C.teal, 'tall');
  rug(r, 0.95, -0.95, 2.2, 1.6, '#e7b38a', '#c97b5a', { stripes: C.cream });
  return people({ x: -1.85, z: -0.45 }, { x: -0.85, z: -0.45 }, { x: -0.62, z: -1.35 }, [e3, e1, e2], { hostPose: 'counter' });
}

// ───────────────────────── Grace's home ─────────────────────────

export function home(r: Room): Cast {
  shell(r, { wall: '#f7e4d6', stripes: '#f2d4c6', wainscot: '#a9c2a2', wainscotH: 0.46, rail: C.trim, floor: 'planks', floorA: '#b9875e', floorB: '#a2724e' });
  const f = r.furn;
  // the fireplace on the back wall: stone surround, a dark opening, logs and a fire that flickers
  const fx = 0.3;
  const fp = r.back(fx, 0);
  f.add(shapes.box(1.0, 0.72, 0.22, 0.03, 2), C.stone, fp(0, 0.36, 0.11));
  f.add(shapes.box(0.56, 0.44, 0.04, 0.008, 1), '#3b2f33', fp(0, 0.24, 0.205));
  f.add(shapes.box(0.62, 0.05, 0.12, 0.015, 1), C.stoneDark, fp(0, 0.025, 0.28));
  f.add(shapes.box(1.18, 0.05, 0.28, 0.02, 1), C.woodDark, fp(0, 0.745, 0.13), { ao: false });
  for (const k of [-1, 1]) f.add(shapes.cyl(0.03, 0.03, 0.3, 8), C.woodDark, fp(k * 0.08, 0.08, 0.17, { rz: Math.PI / 2, ry: k * 0.4 }), { ao: false });
  for (let i = 0; i < 5; i++) {
    const c = i % 2 ? C.mustard : C.orange;
    r.screens.add(shapes.cone(0.05 - (i % 3) * 0.01, 0.14 + (i % 2) * 0.06, 6), c, fp(-0.12 + i * 0.06, 0.15 + (i % 2) * 0.03, 0.17));
  }
  r.lamp(fx, 0.3, -r.D / 2 + 0.4);
  r.flicker = { lamp: 0, day: 0.9 };
  r.halo(fx, 0.2, -r.D / 2 + 0.25, 1.1);
  // on the mantel: a clock, photos, candlesticks
  const mt = r.back(fx, 0.77, 0.13);
  f.add(shapes.box(0.16, 0.18, 0.08, 0.04, 2), C.woodDark, mt(0, 0.09, 0), { ao: false });
  f.add(shapes.cyl(0.055, 0.055, 0.01, 14), C.white, mt(0, 0.1, 0.045, { rx: Math.PI / 2 }), { ao: false });
  for (const [x, c] of [
    [-0.32, C.mustard],
    [-0.2, C.rose],
    [0.24, C.sky],
  ] as const) {
    f.add(shapes.box(0.09, 0.11, 0.015, 0.005, 1), C.mustard, mt(x, 0.06, -0.02, { rx: -0.15 }), { ao: false });
    f.add(shapes.box(0.07, 0.085, 0.01, 0.008, 1), c, mt(x, 0.06, -0.01, { rx: -0.15 }), { ao: false });
  }
  for (const x of [-0.46, 0.44]) {
    f.add(shapes.cyl(0.02, 0.03, 0.05, 8), C.mustard, mt(x, 0.025, 0), { ao: false });
    f.add(shapes.cyl(0.012, 0.012, 0.09, 6), C.cream, mt(x, 0.09, 0), { ao: false });
    r.bulbs.add(shapes.sphere(0.012, 6, 4), C.glow, mt(x, 0.145, 0));
  }
  picture(r, r.back(fx, 1.22), 0.68, 0.46, C.mustard, 'landscape', C.sky);
  // the tea table on a rug, two armchairs by the fire
  rug(r, 0.3, -0.95, 2.6, 1.5, '#c86b6b', '#e8c27a', { stripes: '#f3dcb0' });
  const tt = table(r, 0.3, -1.0, 0.62, 0.38, 0, C.woodDark, { h: 0.22 });
  f.add(shapes.sphere(0.06, 12, 10), C.white, tt(-0.1, 0.06, 0, { s: [1.15, 0.9, 1] }));
  f.add(shapes.cyl(0.02, 0.012, 0.07, 6), C.white, tt(-0.18, 0.08, 0, { rz: 0.9 }), { ao: false });
  f.add(shapes.torus(0.03, 0.009, 8), C.white, tt(-0.03, 0.065, 0, { rx: 0 }), { ao: false });
  f.add(shapes.sphere(0.015, 6, 4), C.sky, tt(-0.1, 0.125, 0), { ao: false });
  r.steam.push([0.2, 0.42, -1.0]);
  cup(r, tt, 0.1, 0.08, C.white, true);
  cup(r, tt, 0.18, -0.06, C.white, false);
  f.add(shapes.cyl(0.06, 0.05, 0.012, 12), C.white, tt(0.2, 0.006, 0.08), { ao: false });
  for (let i = 0; i < 3; i++) f.add(shapes.cyl(0.018, 0.018, 0.008, 8), C.woodLight, tt(0.18 + i * 0.02, 0.016 + i * 0.006, 0.08), { ao: false });
  const e1 = armchair(r, -0.85, -1.15, 0.45, '#d98b8b', { wing: true, cushion: '#f2c1b5' });
  const e2 = armchair(r, 1.5, -1.25, Math.PI - 0.5, '#8fb38c', { cushion: '#cfe2c5' });
  floorLamp(r, -1.35, -1.7, C.butter);
  // a knitting basket with balls of wool
  f.add(shapes.cyl(0.1, 0.08, 0.1, 12), C.woodLight, { x: -1.3, y: 0.05, z: -0.75 });
  for (const [dx, c] of [
    [-0.03, C.rose],
    [0.04, C.sky],
  ] as const)
    f.add(shapes.sphere(0.045, 8, 6), c, { x: -1.3 + dx, y: 0.12, z: -0.75 + dx }, { ao: false });
  r.block(-1.3, -0.75, 0.1, 0.1, 'basket');
  // the bookshelf on the left wall
  const bs = r.left(0.55, 0);
  const ys = shelfUnit(r, bs, 1.0, 1.15, 0.26, C.woodDark, 4, { back: '#8a6a52' });
  r.block(-r.W / 2 + 0.13, 0.55, 0.13, 0.5, 'bookshelf');
  ys.slice(0, 4).forEach((y, i) => {
    const p = frame(-r.W / 2 + 0.14, 0.55, Math.PI / 2, y);
    books(f, p, -0.46, i === 2 ? 0.5 : 0.9, 0, i * 5 + 1);
    if (i === 2) potPlant(f, p, 0.25, 0, 1, C.coral);
  });
  // the window with lace curtains, a side table with a lamp, photos on the wall
  windowAt(r, r.back(1.3, 0.98), 0.72, 0.62, { curtain: '#f6c9c9', panes: 2 });
  const sd = table(r, 1.3, -1.82, 0.7, 0.3, 0, C.woodDark, { h: 0.36 });
  tableLamp(r, sd, -0.2, 0, C.cream, true);
  potPlant(f, sd, 0.22, 0, 1.2, C.sky);
  for (const [x, y, w, h] of [
    [2.1, 1.12, 0.26, 0.32],
    [2.1, 0.72, 0.3, 0.24],
    [-1.95, 1.18, 0.22, 0.28],
  ] as const)
    picture(r, r.back(x, y), w, h, C.mustard, 'portrait', x > 0 ? C.sky : C.peach);
  wallClock(r, r.left(-1.35, 1.15), 0.14, C.woodDark, 1);
  plant(r, 2.3, -1.75, 1.3, C.coral, 'leafy');
  plant(r, -2.35, 1.4, 1.4, C.cream, 'tall');
  return people({ x: -1.45, z: 0.3 }, { x: -0.45, z: 0.3 }, { x: 1.05, z: -0.3 }, [e1, e2]);
}

// ───────────────────────── Mia's place ─────────────────────────

export function friend(r: Room): Cast {
  shell(r, { wall: '#ddd0f5', wallLeft: '#f8cfdb', floor: 'planks', floorA: '#e8c99f', floorB: '#d8b68a', skirting: C.trim });
  const f = r.furn;
  // the sofa against the back wall, a coffee table with snacks
  rug(r, 0.6, -1.0, 2.0, 2.0, '#f6b7c6', C.trim, { round: true, stripes: '#fbd9e2' });
  const sf = sofa(r, 0.75, -1.78, H_PZ, 3, C.teal, { cushion: '#7fcac4', pillows: [C.mustard, C.pink] });
  const ct = table(r, 0.75, -1.02, 0.72, 0.36, 0, C.trim, { h: 0.2, legs: C.woodLight });
  f.add(shapes.cyl(0.08, 0.05, 0.05, 12), C.red, ct(-0.18, 0.025, 0), { ao: false });
  for (let i = 0; i < 6; i++) f.add(shapes.box(0.04, 0.01, 0.03, 0.008, 1), C.mustard, ct(-0.2 + (i % 3) * 0.025, 0.055 + (i % 2) * 0.01, -0.02 + Math.floor(i / 3) * 0.03, { ry: i, rx: 0.3 }), { ao: false });
  for (const [x, c] of [
    [0.05, C.red],
    [0.12, C.leaf],
    [0.3, C.sky],
  ] as const) {
    f.add(shapes.cyl(0.022, 0.022, 0.07, 8), c, ct(x, 0.035, x > 0.2 ? 0.08 : -0.06), { ao: false });
    f.add(shapes.cyl(0.023, 0.023, 0.006, 8), C.stone, ct(x, 0.072, x > 0.2 ? 0.08 : -0.06), { ao: false });
  }
  f.add(shapes.box(0.22, 0.025, 0.22, 0.01, 1), C.butter, ct(0.22, 0.012, -0.04, { ry: 0.3 }), { ao: false });
  f.add(shapes.box(0.1, 0.025, 0.06, 0.012, 1), C.navy, ct(-0.02, 0.012, 0.1, { ry: -0.4 }), { ao: false });
  // the TV on a low unit against the left wall, a console, the game on the screen
  const tv = r.left(-0.95, 0);
  f.add(shapes.box(1.0, 0.24, 0.3, 0.02, 1), C.trim, tv(0, 0.12, 0.15));
  for (const k of [-1, 1]) f.add(shapes.box(0.44, 0.18, 0.01, 0.008, 1), C.lilac, tv(k * 0.24, 0.12, 0.305), { ao: false });
  r.block(-r.W / 2 + 0.15, -0.95, 0.16, 0.52, 'tv unit');
  f.add(shapes.box(0.84, 0.5, 0.04, 0.02, 1), '#2e3142', tv(0, 0.56, 0.1));
  f.add(shapes.box(0.06, 0.08, 0.05, 0.008, 1), '#2e3142', tv(0, 0.27, 0.1), { ao: false });
  r.screens.add(shapes.box(0.78, 0.44, 0.01, 0.008, 1), '#7fc4ff', tv(0, 0.56, 0.125));
  r.screens.add(shapes.box(0.78, 0.14, 0.012, 0.008, 1), C.leaf, tv(0, 0.41, 0.127));
  r.screens.add(shapes.sphere(0.05, 8, 6), C.mustard, tv(0.2, 0.68, 0.13, { s: [1, 1, 0.2] }));
  r.screens.add(shapes.box(0.06, 0.08, 0.012, 0.008, 1), C.red, tv(-0.15, 0.51, 0.13));
  f.add(shapes.box(0.22, 0.05, 0.14, 0.015, 1), C.white, tv(0.3, 0.265, 0.15), { ao: false });
  // bean bags in front of the TV
  const e3 = beanBag(r, -1.55, -1.15, Math.PI - 0.2, C.mustard);
  beanBag(r, 2.0, -0.55, Math.PI + 0.6, C.pink);
  // posters, fairy lights, a window, a guitar, a cube shelf
  poster(r, r.back(0.35, 1.12), 0.36, 0.5, C.navy, C.mustard, 'star');
  poster(r, r.back(1.05, 1.15), 0.42, 0.34, C.coral, C.cream, 'mountain');
  poster(r, r.left(0.3, 1.05), 0.34, 0.46, C.teal, C.pink, 'circle');
  poster(r, r.left(-1.55, 1.1), 0.3, 0.4, C.mustard, C.plum, 'stripes');
  windowAt(r, r.back(-1.45, 1.0), 0.66, 0.56, { curtain: C.pink, panes: 2 });
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = -2.6 + u * 4.9;
    const y = 1.5 - Math.sin(u * Math.PI * 3) ** 2 * 0.1;
    r.bulbs.add(shapes.sphere(0.022, 6, 4), C.glow, { x, y, z: -r.D / 2 + 0.05 });
    if (i % 3 === 0) r.halo(x, y, -r.D / 2 + 0.08, 0.35);
    if (i < n) f.add(shapes.box(4.9 / n, 0.006, 0.006, 0.008, 1), C.leafDeep, { x: x + 2.45 / n, y: y + 0.015, z: -r.D / 2 + 0.05 }, { ao: false });
  }
  // the guitar leaning on the wall
  const g = r.back(-0.5, 0, 0.12);
  f.add(shapes.sphere(0.13, 12, 8), C.orange, g(0, 0.14, 0, { s: [1, 1, 0.35], rx: -0.15 }));
  f.add(shapes.sphere(0.1, 12, 8), C.orange, g(0, 0.32, -0.025, { s: [1, 1, 0.35], rx: -0.15 }));
  f.add(shapes.cyl(0.03, 0.03, 0.012, 10), '#3b2f33', g(0, 0.2, 0.04, { rx: Math.PI / 2 - 0.15 }), { ao: false });
  f.add(shapes.box(0.04, 0.42, 0.025, 0.008, 1), C.woodDark, g(0, 0.62, -0.07, { rx: -0.15 }), { ao: false });
  r.block(-0.5, -r.D / 2 + 0.12, 0.14, 0.08, 'guitar');
  const cs = r.back(2.15, 0);
  shelfUnit(r, cs, 0.7, 0.72, 0.3, C.trim, 2);
  r.block(2.15, -r.D / 2 + 0.15, 0.36, 0.16, 'cube shelf');
  books(f, frame(2.15, -r.D / 2 + 0.14, 0, 0.055), -0.3, 0.32, 0, 3);
  potPlant(f, frame(2.15, -r.D / 2 + 0.14, 0, 0.055), 0.18, 0, 1.3, C.mustard);
  potPlant(f, frame(2.15, -r.D / 2 + 0.14, 0, 0.395), -0.15, 0, 1.2, C.pink);
  f.add(shapes.sphere(0.06, 10, 8), C.sky, frame(2.15, -r.D / 2 + 0.14, 0, 0.395)(0.15, 0.06, 0), { ao: false });
  floorLamp(r, 2.35, -1.2, C.mint);
  plant(r, -2.35, 0.9, 1.3, C.trim, 'palm');
  r.lamp(-0.5, 1.4, -1.6);
  return people({ x: -1.05, z: 0.3 }, { x: -0.05, z: 0.3 }, { x: 0.85, z: -0.35 }, [sf[0], sf[2], e3]);
}

// ───────────────────────── Ben's shop ─────────────────────────

export function shop(r: Room): Cast {
  shell(r, { wall: '#dff2e6', wainscot: '#9ad8b6', wainscotH: 0.34, rail: C.trim, floor: 'tiles', floorA: '#f4efe4', floorB: '#d5e9dd', tile: 0.42 });
  const f = r.furn;
  // the checkout counter along the left, Ben behind it; the till, a card reader, a rack of sweets
  const top = counter(r, -1.35, -0.6, 1.7, 0.38, H_PX, C.leafDeep, C.cream, { panels: '#79bf8c' });
  f.add(shapes.box(0.2, 0.06, 0.18, 0.02, 1), C.stoneDark, top(0.25, 0.03, -0.04), { ao: false });
  f.add(shapes.box(0.18, 0.05, 0.16, 0.015, 1), C.stone, top(0.25, 0.085, -0.04), { ao: false });
  f.add(shapes.box(0.03, 0.12, 0.03, 0.008, 1), C.metal, top(0.25, 0.15, -0.1), { ao: false });
  f.add(shapes.box(0.18, 0.12, 0.02, 0.01, 1), '#2e3142', top(0.25, 0.22, -0.1, { rx: -0.25 }), { ao: false });
  r.screens.add(shapes.box(0.15, 0.09, 0.01, 0.008, 1), '#9fe3c2', top(0.25, 0.22, -0.085, { rx: -0.25 }));
  f.add(shapes.box(0.06, 0.02, 0.1, 0.01, 1), C.navy, top(0.0, 0.01, 0.05, { ry: 0.3 }), { ao: false });
  const rk = frame(-1.35, -1.2, Math.PI / 2, COUNTER);
  f.add(shapes.box(0.36, 0.2, 0.06, 0.01, 1), C.woodLight, rk(0, 0.1, 0.12), { ao: false });
  for (let i = 0; i < 2; i++) goods(f, rk, -0.16, 0.34, 0.16, 'box', [C.pink, C.mustard, C.sky, C.orange], i * 2);
  // a paper bag and a basket of apples on the counter
  f.add(shapes.box(0.1, 0.14, 0.07, 0.01, 1), C.woodLight, top(-0.35, 0.07, 0.02), { ao: false });
  goods(f, top, -0.65, 0.2, -0.02, 'fruit', [C.red]);
  // shelves of goods behind Ben (left wall) and along the back
  const lw = r.left(-0.6, 0);
  const ly = shelfUnit(r, lw, 1.6, 1.2, 0.26, C.trim, 4, { back: '#cfe9dc' });
  r.block(-r.W / 2 + 0.13, -0.6, 0.13, 0.8, 'wall shelf');
  ly.slice(0, 4).forEach((y, i) => {
    const p = frame(-r.W / 2 + 0.14, -0.6, Math.PI / 2, y);
    goods(f, p, -0.75, 1.5, 0, (['bottle', 'box', 'jar', 'can'] as const)[i], [[C.leafDeep, C.red, C.sky], [C.coral, C.mustard, C.teal], [C.orange, C.cream, C.rose], [C.red, C.blue, C.leaf]][i], i);
  });
  for (const [x, kinds] of [
    [-0.35, ['can', 'box', 'jar', 'box'] as const],
    [0.75, ['bottle', 'jar', 'box', 'can'] as const],
  ] as const) {
    const ys = shelfUnit(r, r.back(x, 0), 1.05, 1.25, 0.3, C.trim, 4, { back: '#cfe9dc' });
    r.block(x, -r.D / 2 + 0.15, 0.53, 0.16, 'back shelf');
    ys.slice(0, 4).forEach((y, i) => goods(f, frame(x, -r.D / 2 + 0.16, 0, y), -0.48, 0.98, 0, kinds[i], [[C.red, C.mustard, C.leaf], [C.sky, C.pink, C.orange], [C.plum, C.butter, C.teal], [C.coral, C.navy, C.mint]][i], i + 3));
    // a price strip on each board
    ys.slice(0, 4).forEach((y) => r.shell.add(shapes.box(1.0, 0.02, 0.01, 0.008, 1), C.butter, frame(x, -r.D / 2 + 0.31, 0, y - 0.03)(0, 0, 0), { ao: false }));
  }
  // the drinks fridge: lit inside, bottles in rows, a handle
  const fz = r.back(1.95, 0);
  f.add(shapes.box(0.66, 1.3, 0.42, 0.04, 2), C.white, fz(0, 0.65, 0.21));
  r.screens.add(shapes.box(0.54, 1.02, 0.01, 0.008, 1), '#d9f4ff', fz(0, 0.7, 0.425));
  for (let k = 0; k < 4; k++) {
    f.add(shapes.box(0.54, 0.012, 0.05, 0.008, 1), C.stone, fz(0, 0.26 + k * 0.25, 0.42), { ao: false });
    goods(f, frame(1.95, -r.D / 2 + 0.42, 0, 0.27 + k * 0.25), -0.25, 0.52, 0, 'bottle', [[C.red, C.orange], [C.leaf, C.mint], [C.sky, C.blue], [C.mustard, C.coral]][k], k);
  }
  f.add(shapes.box(0.66, 0.12, 0.44, 0.03, 1), C.teal, fz(0, 1.24, 0.22), { ao: false });
  f.add(shapes.box(0.03, 0.4, 0.03, 0.008, 1), C.stoneDark, fz(0.24, 0.75, 0.46), { ao: false });
  r.block(1.95, -r.D / 2 + 0.22, 0.34, 0.24, 'fridge');
  // a low stand of goods in the middle, crates of fruit, stacked baskets
  const gp = counter(r, 0.75, -0.75, 1.2, 0.36, H_PZ, C.trim, C.woodLight, { h: 0.34 });
  goods(f, gp, -0.55, 0.5, -0.06, 'fruit', [C.red, C.mustard]);
  goods(f, gp, 0.05, 0.52, -0.06, 'fruit', [C.leaf, C.orange]);
  goods(f, gp, -0.55, 1.1, 0.1, 'box', [C.pink, C.sky, C.butter]);
  for (let i = 0; i < 4; i++) {
    const p = frame(2.3, -0.95, 0.2, i * 0.06);
    f.add(shapes.box(0.3, 0.07, 0.22, 0.02, 1), C.red, p(0, 0.035, 0), { ao: false });
    f.add(shapes.box(0.26, 0.012, 0.18, 0.008, 1), C.coral, p(0, 0.072, 0), { ao: false });
  }
  f.add(shapes.torus(0.09, 0.008, 10), C.stoneDark, frame(2.3, -0.95, 0.2, 0.25)(0, 0.06, 0, { rx: Math.PI / 2 }), { ao: false });
  r.block(2.3, -0.95, 0.17, 0.14, 'baskets');
  for (const [x, z, c] of [
    [1.85, -0.1, C.red],
    [2.15, 0.25, C.mustard],
  ] as const) {
    f.add(shapes.box(0.34, 0.16, 0.26, 0.02, 1), C.woodLight, { x, y: 0.08, z, ry: 0.2 });
    goods(f, frame(x, z, 0.2, 0.15), -0.14, 0.3, 0, 'fruit', [c]);
    r.block(x, z, 0.19, 0.16, 'crate');
  }
  // lights, a sign, plants
  for (const [x, z] of [
    [-1.35, -0.3],
    [0.75, -0.75],
  ])
    pendant(r, x, 1.25, z, C.leafDeep, r.H + 0.4, { wide: true });
  const sg = r.back(-1.6, 1.42);
  r.shell.add(shapes.box(0.8, 0.22, 0.03, 0.02, 1), C.leafDeep, sg(0, 0, 0.02), { ao: false });
  for (let i = 0; i < 3; i++) r.shell.add(shapes.sphere(0.045, 8, 6), [C.red, C.mustard, C.orange][i], sg(-0.2 + i * 0.2, 0, 0.04, { s: [1, 1, 0.4] }), { ao: false });
  wallClock(r, r.back(1.25, 1.45), 0.11, C.leafDeep);
  plant(r, 2.35, 1.0, 1.3, C.cream, 'tall');
  return people({ x: -1.85, z: -0.35 }, { x: -0.85, z: -0.35 }, { x: -0.5, z: -1.35 }, [
    { x: 0.55, z: -1.35, heading: H_NZ + 0.4, pose: 'stand' },
    { x: 1.45, z: -0.15, heading: Math.PI - 0.5, pose: 'stand' },
  ], { hostPose: 'counter' });
}

