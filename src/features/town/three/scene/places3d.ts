// The thirteen places and the boarding house of the 3D town, each built in code with its own personality (the café's
// striped awning, the school's clock, the clinic's cross, the cinema's marquee…), plus the construction site of a
// lot on offer and the stone of a lot left to nature. Built at the lot's middle with the door towards its face.

import { TorusGeometry, type BufferGeometry, type ColorRepresentation } from 'three';
import type { PlaceId, WorldPlace } from '../../../../data/townWorld';
import { awning, chimney, crate, door, flatRoof, gableRoof, hipRoof, newKit, onFace, pot, pyramid, rel, signBoard, walls, windowOn, type Kit } from './kit';
import { hash2 } from './coords';
import { Merge, shapes } from './merge';
import { C } from './palette3d';

/** A built thing ready to become meshes: where it stands, its turn, its merged geometries and how tall it is. */
export interface Thing {
  x: number;
  z: number;
  ry: number;
  body: BufferGeometry | null;
  glass: BufferGeometry | null;
  bulbs: BufferGeometry | null;
  /** Top above the ground (name tags, picking). */
  height: number;
  /** Half its size along x and z in the town (picking box). */
  hx: number;
  hz: number;
}

/** Walls stand this far in from the edge of their lot. */
const INSET = 0.18;

interface Lot {
  x: number;
  y: number;
  w: number;
  d: number;
  face: 'x' | 'y';
  door: { x: number; y: number };
}

/** The kit for a lot: walls inset, the door's face turned to local +Z, and the door's offset along it. */
export function kitFor(p: Lot, inset = INSET): { k: Kit; u: number; ry: number; cx: number; cz: number } {
  const cx = p.x + p.w / 2;
  const cz = p.y + p.d / 2;
  if (p.face === 'y') {
    return { k: newKit(p.w - inset * 2, p.d - inset * 2), u: p.door.x + 0.5 - cx, ry: 0, cx, cz };
  }
  // the door on the +x face: local +Z turned to world +X, local +X to world −Z
  return { k: newKit(p.d - inset * 2, p.w - inset * 2), u: -(p.door.y + 0.5 - cz), ry: Math.PI / 2, cx, cz };
}

function finish(p: Lot, f: ReturnType<typeof kitFor>, height: number): Thing {
  return {
    x: f.cx,
    z: f.cz,
    ry: f.ry,
    body: f.k.body.build(),
    glass: f.k.glass.build(),
    bulbs: f.k.bulbs.build(),
    height,
    hx: p.w / 2 - 0.1,
    hz: p.d / 2 - 0.1,
  };
}

/** Windows along the front, on both sides of the door, and one on each other wall. */
function windowsAround(k: Kit, u: number, v: number, o: Parameters<typeof windowOn>[4] = {}, perSide = 1): void {
  const half = k.W / 2;
  for (const s of [-1, 1]) {
    const room = s < 0 ? u + half - 0.32 : half - u - 0.32;
    if (room < 0.36) continue;
    for (let i = 0; i < perSide; i++) {
      const at = u + s * (0.32 + (room / perSide) * (i + 0.5));
      windowOn(k, 'front', at, v, o);
    }
  }
  windowOn(k, 'left', 0, v, { ...o, flowers: false });
  windowOn(k, 'right', 0, v, { ...o, flowers: false });
  windowOn(k, 'back', 0, v, { ...o, flowers: false, shutters: undefined });
}

/** Builds a place on its kit (the door's face is local +Z, `u` the door's offset along it) and returns its height. */
export type Recipe = (k: Kit, u: number) => number;

/** Recipes of places that are not the town's own: the city's (city/cityPlaces3d.ts registers them when its page loads). */
const MORE_RECIPES: Record<string, Recipe> = {};

/** Add recipes by place id (the city's places). The town's own cannot be replaced. */
export function registerRecipes(more: Readonly<Record<string, Recipe>>): void {
  for (const [id, r] of Object.entries(more)) if (!Object.hasOwn(RECIPES, id)) MORE_RECIPES[id] = r;
}

const RECIPES: Readonly<Record<PlaceId, Recipe>> = {
  // the pavilion on the plaza: a round stone floor, six posts, a scalloped roof with a lantern under it
  square: (k) => {
    const r = Math.min(k.W, k.D) / 2 + 0.05;
    k.body.add(shapes.cyl(r + 0.06, r + 0.1, 0.16, 24), C.stone, { y: 0.08 });
    k.body.add(shapes.cyl(r - 0.05, r - 0.05, 0.04, 24), C.plazaB, { y: 0.17 }, { ao: false });
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 6;
      k.body.add(shapes.cyl(0.05, 0.06, 1.05, 10), C.trim, { x: Math.cos(a) * (r - 0.15), y: 0.7, z: Math.sin(a) * (r - 0.15) });
      k.body.add(shapes.box(0.14, 0.06, 0.14, 0.02, 1), C.stone, { x: Math.cos(a) * (r - 0.15), y: 0.21, z: Math.sin(a) * (r - 0.15) });
    }
    // a low rail between the posts (but the front)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 6 + Math.PI / n;
      if (Math.abs(Math.sin(a) - 1) < 0.2) continue;
      k.body.add(shapes.box(0.7 * r, 0.05, 0.05, 0.02, 1), C.woodLight, { x: Math.cos(a) * (r - 0.18), y: 0.5, z: Math.sin(a) * (r - 0.18), ry: -a + Math.PI / 2 });
    }
    k.body.add(shapes.cyl(r + 0.22, r + 0.22, 0.08, 24), C.coral, { y: 1.26 }, { ao: false, shade: -0.06 });
    k.body.add(shapes.cone(r + 0.2, 0.62, 12), C.coral, { y: 1.6 }, { ao: false });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.body.add(shapes.sphere(0.08, 8, 5), i % 2 ? C.coral : C.cream, { x: Math.cos(a) * (r + 0.2), y: 1.2, z: Math.sin(a) * (r + 0.2), s: [1, 0.6, 1] }, { ao: false });
    }
    k.body.add(shapes.sphere(0.08, 10, 8), C.mustard, { y: 1.96 }, { ao: false });
    k.body.add(shapes.cyl(0.012, 0.012, 0.3, 4), C.metal, { y: 1.08 }, { ao: false });
    k.bulbs.add(shapes.sphere(0.08, 10, 8), C.glow, { y: 0.9 });
    return 2.0;
  },

  // the café: cream walls, a terracotta roof, a red-and-white awning, a cup on the sign, pots by the door
  cafe: (k, u) => {
    walls(k, 1.08, C.cream, { plinth: C.stoneDark });
    windowsAround(k, u, 0.55, { w: 0.42, h: 0.38, flowers: false, frame: C.woodDark }, 1);
    door(k, u, { color: C.woodDark, glass: true, lamp: true });
    awning(k, 0, 0.98, k.W - 0.1, C.red, C.white, 0.38);
    const top = gableRoof(k, 1.08, 0.55, C.coral, { wall: C.cream });
    chimney(k, k.W * 0.3, -k.D * 0.15, 1.2, 0.55, C.stoneDark);
    const s = signBoard(k, u, 1.34, 0.62, 0.22, C.woodDark, C.cream);
    // the cup on the sign
    k.body.add(shapes.cyl(0.07, 0.055, 0.12, 12), C.white, rel(s, -0.1, 0, 0.03), { ao: false });
    k.body.add(shapes.torus(0.035, 0.012, 10), C.white, rel(s, -0.02, 0.005, 0.03), { ao: false });
    k.body.add(shapes.box(0.26, 0.05, 0.02), C.mustard, rel(s, 0.13, 0, 0.02), { ao: false });
    pot(k.body, u - 0.38, k.D / 2 + 0.16);
    pot(k.body, u + 0.38, k.D / 2 + 0.16, 0, C.teal);
    return top;
  },

  // a friend's house: pink, a plum roof facing front with a round window in its gable, flower boxes
  friend: (k, u) => {
    walls(k, 0.98, C.pink, { plinth: C.stone });
    windowsAround(k, u, 0.55, { shutters: C.plum, flowers: true });
    door(k, u, { color: C.plum, lamp: true });
    const top = gableRoof(k, 0.98, 0.62, C.plum, { ridge: 'z', wall: C.pink });
    windowOn(k, 'front', 0, 1.25, { w: 0.24, round: true });
    chimney(k, -k.W * 0.22, -k.D * 0.2, 1.2, 0.5, C.coral);
    pot(k.body, u + 0.36, k.D / 2 + 0.14, 0, C.mustard);
    return top;
  },

  // home: sky blue, a navy roof, a chimney, a mailbox by the path
  home: (k, u) => {
    walls(k, 1.0, C.sky, { plinth: C.stone });
    windowsAround(k, u, 0.55, { shutters: C.navy, flowers: true });
    door(k, u, { color: C.mustard, lamp: true });
    const top = gableRoof(k, 1.0, 0.6, C.blue, { wall: C.sky, cap: C.navy });
    chimney(k, k.W * 0.25, -k.D * 0.18, 1.2, 0.6, C.coral);
    const f = onFace(k, 'front', u + 0.55, 0, 0.32);
    k.body.add(shapes.cyl(0.025, 0.025, 0.42, 6), C.woodDark, rel(f, 0, 0.21, 0));
    k.body.add(shapes.box(0.12, 0.1, 0.18, 0.04, 2), C.red, rel(f, 0, 0.46, 0));
    return top;
  },

  // the shop: mint walls, a wide shop window, a green awning, crates of fruit outside, a flat roof with a sign
  shop: (k, u) => {
    walls(k, 1.12, C.mint, { plinth: C.stoneDark });
    const f = onFace(k, 'front', 0, 0, 0);
    const side = u > 0 ? -1 : 1;
    const ww = Math.max(0.4, k.W / 2 - 0.25);
    k.body.add(shapes.box(ww + 0.08, 0.5, 0.05, 0.02, 1), C.trim, rel(f, side * (k.W / 4), 0.55, 0.02), { ao: false });
    k.glass.add(shapes.box(ww, 0.42, 0.03), C.glass, rel(f, side * (k.W / 4), 0.55, 0.04));
    windowOn(k, 'left', 0, 0.6, {});
    windowOn(k, 'right', 0, 0.6, {});
    door(k, u, { color: C.teal, glass: true });
    awning(k, 0, 0.98, k.W - 0.08, C.leafDeep, C.white, 0.36);
    const top = flatRoof(k, 1.12, C.stoneDark, { ledge: C.cream });
    const s = signBoard(k, 0, 1.38, Math.min(0.9, k.W - 0.3), 0.24, C.leafDeep, C.cream);
    for (let i = 0; i < 3; i++) k.body.add(shapes.sphere(0.05, 8, 6), [C.red, C.mustard, C.orange][i], rel(s, -0.12 + i * 0.12, 0, 0.03), { ao: false });
    crate(k.body, rel(f, side * (k.W / 4) - 0.12, 0, 0.24), C.red);
    crate(k.body, rel(f, side * (k.W / 4) + 0.18, 0, 0.26), C.orange);
    return top + 0.1;
  },

  // the office: two storeys of windows, a flat roof with a ledge, an air unit, an entrance canopy
  office: (k, u) => {
    walls(k, 1.9, C.lilac, { plinth: C.stoneDark });
    // a band between the floors
    k.body.add(shapes.box(k.W + 0.06, 0.06, k.D + 0.06, 0.02, 1), C.trim, { y: 0.98 }, { ao: false });
    for (const v of [0.55, 1.42]) {
      const n = Math.max(2, Math.floor(k.W / 0.5));
      for (let i = 0; i < n; i++) {
        const at = -k.W / 2 + (k.W / n) * (i + 0.5);
        if (v < 1 && Math.abs(at - u) < 0.36) continue;
        windowOn(k, 'front', at, v, { w: 0.3, h: 0.36, bars: false });
      }
      windowOn(k, 'left', 0, v, { w: 0.3, h: 0.36, bars: false });
      windowOn(k, 'right', 0, v, { w: 0.3, h: 0.36, bars: false });
      windowOn(k, 'back', 0, v, { w: 0.3, h: 0.36, bars: false });
    }
    door(k, u, { color: C.navy, glass: true, w: 0.42 });
    const f = onFace(k, 'front', u, 0.74, 0);
    k.body.add(shapes.box(0.66, 0.05, 0.36, 0.02, 1), C.navy, rel(f, 0, 0, 0.18), { ao: false });
    const top = flatRoof(k, 1.9, C.stoneDark, { ledge: C.trim });
    k.body.add(shapes.box(0.36, 0.22, 0.3, 0.03, 2), C.stone, { x: -k.W * 0.2, y: top + 0.08, z: -0.05 });
    k.body.add(shapes.cyl(0.08, 0.08, 0.02, 12), C.metal, { x: -k.W * 0.2, y: top + 0.2, z: -0.05 }, { ao: false });
    k.body.add(shapes.cyl(0.012, 0.012, 0.5, 4), C.metal, { x: k.W * 0.3, y: top + 0.2, z: -k.D * 0.2 }, { ao: false });
    k.bulbs.add(shapes.sphere(0.03, 6, 4), C.red, { x: k.W * 0.3, y: top + 0.46, z: -k.D * 0.2 });
    return top + 0.3;
  },

  // the school: warm brick walls, a coral roof, a clock tower over the door with a bell, a flag
  school: (k, u) => {
    walls(k, 1.15, '#f3b9a0', { plinth: C.stoneDark });
    windowsAround(k, u, 0.6, { w: 0.34, h: 0.42, frame: C.trim }, 2);
    door(k, u, { color: C.navy, w: 0.42, lamp: true });
    const top = gableRoof(k, 1.15, 0.55, C.coral, { wall: '#f3b9a0' });
    // the tower over the door
    const f = onFace(k, 'front', u, 0, -0.25);
    k.body.add(shapes.box(0.5, 0.7, 0.5, 0.05, 2), C.cream, rel(f, 0, 1.45, 0));
    k.body.add(shapes.box(0.58, 0.06, 0.58, 0.02, 1), C.trim, rel(f, 0, 1.82, 0), { ao: false });
    // the clock
    k.body.add(shapes.cyl(0.17, 0.17, 0.04, 20), C.trim, rel(f, 0, 1.5, 0.26, { rx: Math.PI / 2 }), { ao: false });
    k.body.add(shapes.cyl(0.14, 0.14, 0.045, 20), C.white, rel(f, 0, 1.5, 0.27, { rx: Math.PI / 2 }), { ao: false });
    k.body.add(shapes.box(0.018, 0.11, 0.02), C.navy, rel(f, 0, 1.54, 0.3), { ao: false });
    k.body.add(shapes.box(0.08, 0.018, 0.02), C.navy, rel(f, 0.035, 1.5, 0.3), { ao: false });
    // the belfry and its pointed roof
    for (const [dx, dz] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ])
      k.body.add(shapes.box(0.06, 0.3, 0.06, 0.02, 1), C.trim, rel(f, dx, 2.0, dz), { ao: false });
    k.body.add(shapes.sphere(0.09, 10, 8), C.mustard, rel(f, 0, 1.98, 0), { ao: false });
    k.body.add(pyramid(), C.red, rel(f, 0, 2.35, 0, { s: [0.62, 0.42, 0.62] }), { ao: false });
    // a flagpole by the corner
    const g = onFace(k, 'front', k.W / 2 - 0.05, 0, 0.3);
    k.body.add(shapes.cyl(0.02, 0.025, 1.7, 6), C.trim, rel(g, 0, 0.85, 0), { ao: false });
    k.body.add(shapes.box(0.36, 0.22, 0.015), C.red, rel(g, -0.19, 1.55, 0), { ao: false });
    k.body.add(shapes.sphere(0.04, 6, 4), C.mustard, rel(g, 0, 1.72, 0), { ao: false });
    return Math.max(top, 2.6);
  },

  // the bus stop: a glass shelter with a curved roof, a bench inside, the round sign on its pole
  station: (k, u) => {
    const f = onFace(k, 'front', u, 0, 0);
    const w = Math.min(1.3, k.W - 0.1);
    const d = 0.62;
    // floor
    k.body.add(shapes.box(w + 0.2, 0.08, d + 0.3, 0.03, 1), C.stone, rel(f, 0, 0.04, -d / 2));
    // back wall glass with a frame, two glass sides
    k.body.add(shapes.box(w, 0.06, 0.06, 0.02, 1), C.teal, rel(f, 0, 0.12, -d), { ao: false });
    k.glass.add(shapes.box(w - 0.06, 0.8, 0.03), C.glass, rel(f, 0, 0.55, -d));
    for (const s of [-1, 1]) {
      k.body.add(shapes.box(0.06, 1.05, 0.06, 0.02, 1), C.teal, rel(f, s * (w / 2), 0.55, -d));
      k.body.add(shapes.box(0.06, 1.05, 0.06, 0.02, 1), C.teal, rel(f, s * (w / 2), 0.55, 0));
      k.glass.add(shapes.box(0.03, 0.7, d - 0.06), C.glass, rel(f, s * (w / 2), 0.55, -d / 2));
    }
    // the curved roof
    k.body.add(shapes.cyl(1, 1, 1, 18), C.teal, rel(f, 0, 1.08, -d / 2, { rz: Math.PI / 2, s: [0.12, w + 0.24, 0.52] }), { ao: false });
    // the bench
    k.body.add(shapes.box(w - 0.3, 0.05, 0.2, 0.02, 1), C.woodLight, rel(f, 0, 0.3, -d + 0.16));
    for (const s of [-1, 1]) k.body.add(shapes.box(0.04, 0.26, 0.16), C.metal, rel(f, s * (w / 2 - 0.25), 0.15, -d + 0.16));
    // timetable
    k.body.add(shapes.box(0.26, 0.34, 0.02, 0.01, 1), C.white, rel(f, -w / 4, 0.7, -d + 0.04), { ao: false });
    // the sign on its pole
    const g = onFace(k, 'front', u + w / 2 + 0.2, 0, 0.1);
    k.body.add(shapes.cyl(0.025, 0.03, 1.4, 6), C.metal, rel(g, 0, 0.7, 0));
    k.body.add(shapes.cyl(0.17, 0.17, 0.04, 20), C.white, rel(g, 0, 1.38, 0, { rx: Math.PI / 2 }), { ao: false });
    k.body.add(shapes.cyl(0.14, 0.14, 0.05, 20), C.blue, rel(g, 0, 1.38, 0, { rx: Math.PI / 2 }), { ao: false });
    k.body.add(shapes.box(0.14, 0.05, 0.06), C.white, rel(g, 0, 1.38, 0), { ao: false });
    k.bulbs.add(shapes.box(w - 0.2, 0.03, 0.06), C.glow, rel(f, 0, 1.04, -d / 2));
    return 1.6;
  },

  // the clinic: white walls, a mint hip roof, a green cross on a round sign over the door
  clinic: (k, u) => {
    walls(k, 1.08, C.white, { plinth: C.mint });
    windowsAround(k, u, 0.58, { w: 0.34, frame: C.mint });
    door(k, u, { color: C.mint, glass: true, w: 0.42, lamp: true });
    const top = hipRoof(k, 1.08, 0.55, C.teal);
    const f = onFace(k, 'front', u, 1.32, 0.08);
    k.body.add(shapes.cyl(0.2, 0.2, 0.05, 24), C.white, rel(f, 0, -0.12, 0.05, { rx: Math.PI / 2 }), { ao: false });
    k.body.add(shapes.box(0.22, 0.07, 0.04, 0.015, 1), C.leafDeep, rel(f, 0, -0.12, 0.09), { ao: false });
    k.body.add(shapes.box(0.07, 0.22, 0.04, 0.015, 1), C.leafDeep, rel(f, 0, -0.12, 0.09), { ao: false });
    // a bench by the door
    const g = onFace(k, 'front', u - 0.6, 0, 0.18);
    k.body.add(shapes.box(0.4, 0.04, 0.14, 0.015, 1), C.woodLight, rel(g, 0, 0.24, 0));
    for (const s of [-1, 1]) k.body.add(shapes.box(0.04, 0.22, 0.12), C.metal, rel(g, s * 0.15, 0.11, 0));
    return top;
  },

  // the cinema: plum walls, a stepped front, a marquee with bulbs, posters, a star on top
  cinema: (k, u) => {
    walls(k, 1.45, C.plum, { plinth: C.navy });
    const f = onFace(k, 'front', 0, 0, 0);
    // the stepped front
    k.body.add(shapes.box(k.W * 0.6, 0.4, 0.14, 0.04, 2), C.lilac, rel(f, u, 1.62, -0.02), { ao: false });
    k.body.add(shapes.box(k.W * 0.34, 0.3, 0.14, 0.04, 2), C.lilac, rel(f, u, 1.95, -0.02), { ao: false });
    k.body.add(shapes.custom('star', () => starGeometry()), C.mustard, rel(f, u, 2.25, 0, { s: 0.22 }), { ao: false });
    // the marquee: a box over the door, its rim set with bulbs
    const mw = 0.9;
    k.body.add(shapes.box(mw, 0.22, 0.36, 0.04, 2), C.navy, rel(f, u, 0.98, 0.18), { ao: false });
    k.body.add(shapes.box(mw - 0.1, 0.14, 0.02, 0.02, 1), C.cream, rel(f, u, 0.98, 0.37), { ao: false });
    for (let i = 0; i < 7; i++) k.body.add(shapes.box(0.07, 0.07, 0.02), i % 2 ? C.navy : C.plum, rel(f, u - 0.27 + i * 0.09, 0.98, 0.385), { ao: false });
    for (let i = 0; i <= 9; i++) {
      const a = -mw / 2 + (i * mw) / 9;
      k.bulbs.add(shapes.sphere(0.024, 6, 4), C.glow, rel(f, u + a, 1.1, 0.37));
      k.bulbs.add(shapes.sphere(0.024, 6, 4), C.glow, rel(f, u + a, 0.86, 0.37));
    }
    door(k, u, { color: C.red, w: 0.46, glass: true });
    // posters either side
    for (const s of [-1, 1]) {
      const at = u + s * 0.62;
      if (Math.abs(at) > k.W / 2 - 0.2) continue;
      k.body.add(shapes.box(0.3, 0.42, 0.03, 0.01, 1), C.mustard, rel(f, at, 0.55, 0.03), { ao: false });
      k.body.add(shapes.box(0.24, 0.34, 0.03, 0.01, 1), s < 0 ? C.sky : C.rose, rel(f, at, 0.55, 0.045), { ao: false });
      k.bulbs.add(shapes.box(0.32, 0.025, 0.02), C.glow, rel(f, at, 0.8, 0.05));
    }
    windowOn(k, 'left', 0, 0.9, { w: 0.26 });
    windowOn(k, 'right', 0, 0.9, { w: 0.26 });
    const top = flatRoof(k, 1.45, C.navy, { ledge: C.lilac });
    return Math.max(top, 2.4);
  },

  // the phone shop: modern, pale teal with a wide window, a blue awning and a big phone on the roof
  phone: (k, u) => {
    walls(k, 1.05, '#d3efe9', { plinth: C.stoneDark });
    const f = onFace(k, 'front', 0, 0, 0);
    const side = u > 0 ? -1 : 1;
    const ww = Math.max(0.4, k.W / 2 - 0.2);
    k.body.add(shapes.box(ww + 0.08, 0.5, 0.05, 0.02, 1), C.navy, rel(f, side * (k.W / 4), 0.55, 0.02), { ao: false });
    k.glass.add(shapes.box(ww, 0.42, 0.03), C.glass, rel(f, side * (k.W / 4), 0.55, 0.04));
    windowOn(k, 'left', 0, 0.6, { frame: C.navy, bars: false });
    windowOn(k, 'right', 0, 0.6, { frame: C.navy, bars: false });
    door(k, u, { color: C.navy, glass: true });
    awning(k, 0, 0.95, k.W - 0.1, C.blue, C.white, 0.32);
    const top = flatRoof(k, 1.05, C.stoneDark, { ledge: C.navy });
    // the phone sign
    k.body.add(shapes.box(0.06, 0.2, 0.06), C.metal, { y: top + 0.1, z: 0 }, { ao: false });
    const p = { x: 0, y: top + 0.55, z: 0.05, rx: -0.12 };
    k.body.add(shapes.box(0.44, 0.74, 0.1, 0.09, 3), C.navy, p, { ao: false });
    k.bulbs.add(shapes.box(0.36, 0.56, 0.02, 0.03, 2), '#bdf2ff', rel(p, 0, 0.03, 0.055, { rx: -0.12 }));
    k.body.add(shapes.sphere(0.025, 6, 4), C.trim, rel(p, 0, -0.3, 0.06), { ao: false });
    return top + 0.95;
  },

  // the park: a gate of two stone posts under an arch with a green sign, hedges round it, a tree inside
  park: (k, u) => {
    const f = onFace(k, 'front', u, 0, 0.05);
    for (const s of [-1, 1]) {
      k.body.add(shapes.box(0.2, 0.9, 0.2, 0.04, 2), C.stone, rel(f, s * 0.42, 0.45, 0));
      k.body.add(shapes.box(0.26, 0.07, 0.26, 0.03, 1), C.stoneDark, rel(f, s * 0.42, 0.93, 0), { ao: false });
      k.body.add(shapes.sphere(0.08, 10, 8), C.stoneDark, rel(f, s * 0.42, 1.0, 0), { ao: false });
    }
    k.body.add(shapes.custom('arch', () => new TorusGeometry(0.42, 0.045, 8, 20, Math.PI)), C.woodDark, rel(f, 0, 0.92, 0), { ao: false });
    const s = rel(f, 0, 1.2, 0.04);
    k.body.add(shapes.box(0.56, 0.17, 0.04, 0.03, 2), C.leafDeep, s, { ao: false });
    k.body.add(shapes.sphere(0.035, 6, 4), C.white, rel(s, -0.18, 0, 0.03), { ao: false });
    k.body.add(shapes.sphere(0.035, 6, 4), C.rose, rel(s, 0.18, 0, 0.03), { ao: false });
    // hedges round the edge, the front left open for the gate
    const hedge = (x: number, z: number, w: number, d: number) => k.body.add(shapes.box(w, 0.34, d, 0.12, 3), C.leafDeep, { x, y: 0.17, z }, { top: C.leaf });
    hedge(0, -k.D / 2, k.W, 0.24);
    hedge(-k.W / 2, 0, 0.24, k.D);
    hedge(k.W / 2, 0, 0.24, k.D);
    const gap = 0.62;
    const leftW = u + k.W / 2 - gap;
    const rightW = k.W / 2 - u - gap;
    if (leftW > 0.1) hedge(-k.W / 2 + leftW / 2, k.D / 2, leftW, 0.24);
    if (rightW > 0.1) hedge(k.W / 2 - rightW / 2, k.D / 2, rightW, 0.24);
    // a tree, a pond-blue birdbath and flowers inside
    k.body.add(shapes.cyl(0.06, 0.08, 0.6, 8), C.trunk, { x: -k.W * 0.18, y: 0.3, z: -k.D * 0.12 });
    k.body.add(shapes.sphere(0.4, 14, 10), C.leafDeep, { x: -k.W * 0.18, y: 0.92, z: -k.D * 0.12 }, { top: C.leaf });
    k.body.add(shapes.sphere(0.26, 12, 9), C.leafDeep, { x: -k.W * 0.02, y: 0.78, z: -k.D * 0.2 }, { top: C.leaf });
    k.body.add(shapes.cyl(0.05, 0.07, 0.3, 8), C.stone, { x: k.W * 0.2, y: 0.15, z: -k.D * 0.05 });
    k.body.add(shapes.cyl(0.16, 0.1, 0.07, 14), C.stone, { x: k.W * 0.2, y: 0.32, z: -k.D * 0.05 });
    k.body.add(shapes.cyl(0.13, 0.13, 0.02, 14), C.waterShallow, { x: k.W * 0.2, y: 0.355, z: -k.D * 0.05 }, { ao: false });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39;
      k.body.add(shapes.sphere(0.05, 6, 5), ['#ff8fab', '#ffd166', '#ffffff', '#c3a6ff'][i % 4], { x: k.W * 0.12 + Math.cos(a) * 0.3, y: 0.06, z: k.D * 0.18 + Math.sin(a) * 0.18 }, { ao: false });
    }
    return 1.4;
  },

  // the notice board: a wide wooden board under a little roof, papers pinned on it, a lamp
  board: (k, u) => {
    const f = onFace(k, 'front', u, 0, -0.2);
    const w = 1.1;
    for (const s of [-1, 1]) k.body.add(shapes.box(0.08, 1.25, 0.08, 0.02, 1), C.woodDark, rel(f, s * (w / 2), 0.62, 0));
    k.body.add(shapes.box(w + 0.06, 0.7, 0.07, 0.03, 2), C.wood, rel(f, 0, 0.78, 0));
    k.body.add(shapes.box(w - 0.06, 0.6, 0.02, 0.02, 1), C.cream, rel(f, 0, 0.78, 0.04), { ao: false });
    const papers = [C.white, C.butter, C.sky, C.pink, C.mint, C.white];
    papers.forEach((c, i) => {
      const px = -0.38 + (i % 3) * 0.38 + (hash2(i, 1, 5) - 0.5) * 0.06;
      const py = 0.92 - Math.floor(i / 3) * 0.28;
      k.body.add(shapes.box(0.22, 0.18, 0.01), c, rel(f, px, py, 0.055, { rz: (hash2(i, 2, 5) - 0.5) * 0.2 }), { ao: false });
      k.body.add(shapes.sphere(0.015, 6, 4), C.red, rel(f, px, py + 0.07, 0.065), { ao: false });
    });
    // the little roof
    k.body.add(shapes.box(w + 0.3, 0.06, 0.3, 0.025, 1), C.coral, rel(f, 0, 1.3, 0.06, { rx: 0.35 }), { ao: false });
    k.body.add(shapes.box(w + 0.3, 0.06, 0.24, 0.025, 1), C.coral, rel(f, 0, 1.33, -0.12, { rx: -0.5 }), { ao: false });
    // a bench and a lamp beside it
    const g = onFace(k, 'front', u + 0.75, 0, 0.1);
    k.body.add(shapes.cyl(0.025, 0.03, 1.0, 6), C.metal, rel(g, 0, 0.5, 0));
    k.bulbs.add(shapes.sphere(0.07, 10, 8), C.glow, rel(g, 0, 1.05, 0));
    k.body.add(shapes.cone(0.09, 0.08, 10), C.metal, rel(g, 0, 1.13, 0), { ao: false });
    pot(k.body, -0.55 + u, k.D / 2 - 0.1, 0, C.mustard);
    return 1.45;
  },
};

/** A five-pointed star, 1 across, its flat side facing +Z. */
function starGeometry(): BufferGeometry {
  const m = new Merge();
  const pts: number[] = [];
  const tip = (i: number) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 0.5 : 0.22;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  for (let i = 0; i < 10; i++) {
    const [ax, ay] = tip(i);
    const [bx, by] = tip(i + 1);
    pts.push(0, 0, 0.06, ax, ay, 0.06, bx, by, 0.06);
    pts.push(0, 0, -0.06, bx, by, -0.06, ax, ay, -0.06);
    pts.push(ax, ay, 0.06, ax, ay, -0.06, bx, by, -0.06, ax, ay, 0.06, bx, by, -0.06, bx, by, 0.06);
  }
  m.tris(pts, '#ffffff');
  return m.build()!;
}

/** A built place. */
export function buildPlace(p: WorldPlace): Thing {
  const f = kitFor(p);
  const recipe = RECIPES[p.id] ?? (Object.hasOwn(MORE_RECIPES, p.id) ? MORE_RECIPES[p.id] : undefined) ?? RECIPES.home;
  const height = recipe(f.k, f.u);
  return finish(p, f, height);
}

/** The boarding house (a prop of the world, 3 by 2 tiles south of the pond): two storeys, a balcony, a hanging sign. */
export function buildInn(tiles: readonly { x: number; y: number }[], doorAt?: { x: number; y: number }): Thing | null {
  if (tiles.length === 0) return null;
  const x0 = Math.min(...tiles.map((t) => t.x));
  const y0 = Math.min(...tiles.map((t) => t.y));
  const w = Math.max(...tiles.map((t) => t.x)) - x0 + 1;
  const d = Math.max(...tiles.map((t) => t.y)) - y0 + 1;
  // the door faces the yard (life.inn.door): below the footprint = +y, else +x
  const face: 'x' | 'y' = !doorAt || doorAt.y >= y0 + d ? 'y' : 'x';
  const lot: Lot = { x: x0, y: y0, w, d, face, door: doorAt ?? { x: x0 + Math.floor(w / 2), y: y0 + d } };
  const f = kitFor(lot);
  const k = f.k;
  const u = f.u;
  walls(k, 1.75, C.peach, { plinth: C.stoneDark });
  k.body.add(shapes.box(k.W + 0.05, 0.06, k.D + 0.05, 0.02, 1), C.trim, { y: 0.92 }, { ao: false });
  windowsAround(k, u, 0.52, { shutters: C.teal, flowers: true }, 1);
  for (let i = 0; i < 3; i++) windowOn(k, 'front', -k.W / 2 + (k.W / 3) * (i + 0.5), 1.35, { shutters: C.teal });
  windowOn(k, 'left', 0, 1.35, {});
  windowOn(k, 'right', 0, 1.35, {});
  door(k, u, { color: C.teal, lamp: true, glass: true });
  // the balcony along the upper floor
  const front = onFace(k, 'front', 0, 0, 0);
  k.body.add(shapes.box(k.W * 0.8, 0.05, 0.3, 0.02, 1), C.woodDark, rel(front, 0, 1.0, 0.15), { ao: false });
  k.body.add(shapes.box(k.W * 0.8, 0.04, 0.04), C.trim, rel(front, 0, 1.22, 0.29), { ao: false });
  for (let i = 0; i <= 10; i++) k.body.add(shapes.box(0.025, 0.2, 0.025), C.trim, rel(front, -k.W * 0.4 + (i * k.W * 0.8) / 10, 1.12, 0.29), { ao: false });
  const top = gableRoof(k, 1.75, 0.62, C.teal, { wall: C.peach });
  chimney(k, -k.W * 0.3, -k.D * 0.15, 1.95, 0.5, C.coral);
  chimney(k, k.W * 0.28, -k.D * 0.15, 1.95, 0.45, C.coral);
  // a sign hanging from a bracket by the door
  const g = onFace(k, 'front', u + 0.42, 0.82, 0);
  k.body.add(shapes.box(0.04, 0.04, 0.3), C.metal, rel(g, 0, 0, 0.15), { ao: false });
  k.body.add(shapes.box(0.04, 0.22, 0.26, 0.02, 1), C.woodDark, rel(g, 0, -0.14, 0.2, { ry: Math.PI / 2 }), { ao: false });
  k.body.add(shapes.box(0.02, 0.16, 0.2, 0.01, 1), C.cream, rel(g, 0, -0.14, 0.2, { ry: Math.PI / 2 }), { ao: false });
  pot(k.body, u - 0.4, k.D / 2 + 0.14, 0, C.mustard);
  return finish(lot, f, top);
}

/** A lot on offer: bare earth behind a low fence (open at the gate), cones, a wooden frame going up, planks. */
export function buildSite(p: WorldPlace): Thing {
  const f = kitFor(p, 0.12);
  const k = f.k;
  const u = f.u;
  const m = k.body;
  m.add(shapes.box(k.W, 0.05, k.D, 0.04, 2), C.soil, { y: 0.0 }, { ao: false });
  // the fence: posts and rails, red and white; the gate is shut (a barrier across it, a sign on it): nobody walks
  // in, as the colliders say (core/town/colliders.ts siteColliders: the whole site is solid)
  const post = (x: number, z: number) => m.add(shapes.box(0.06, 0.36, 0.06, 0.02, 1), C.woodLight, { x, y: 0.18, z });
  const rail = (x0: number, z0: number, x1: number, z1: number, y = 0.26) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) return;
    const ry = -Math.atan2(z1 - z0, x1 - x0);
    const n = Math.max(1, Math.round(len / 0.22));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      m.add(shapes.box(len / n, 0.06, 0.03), i % 2 ? C.white : C.red, { x: x0 + (x1 - x0) * t, y, z: z0 + (z1 - z0) * t, ry }, { ao: false });
    }
  };
  const hw = k.W / 2;
  const hd = k.D / 2;
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  corners.forEach(([x, z]) => post(x, z));
  rail(-hw, -hd, hw, -hd);
  rail(-hw, -hd, -hw, hd);
  rail(hw, -hd, hw, hd);
  const gap = 0.34;
  rail(-hw, hd, u - gap, hd);
  rail(u + gap, hd, hw, hd);
  post(u - gap, hd);
  post(u + gap, hd);
  // the shut gate: two striped bars across it and a small white sign hung on them
  rail(u - gap, hd, u + gap, hd, 0.29);
  rail(u - gap, hd, u + gap, hd, 0.13);
  m.add(shapes.box(0.26, 0.16, 0.02, 0.01, 1), C.white, { x: u, y: 0.21, z: hd + 0.025 }, { ao: false });
  m.add(shapes.box(0.18, 0.03, 0.022, 0.005, 1), C.orange, { x: u, y: 0.24, z: hd + 0.027 }, { ao: false });
  m.add(shapes.box(0.18, 0.03, 0.022, 0.005, 1), C.orange, { x: u, y: 0.18, z: hd + 0.027 }, { ao: false });
  // the frame going up: four posts, beams on two sides
  const fx = hw * 0.55;
  const fz = hd * 0.5;
  for (const [x, z] of [
    [-fx, -fz],
    [fx, -fz],
    [-fx, fz],
    [fx, fz],
  ])
    m.add(shapes.box(0.08, 1.0, 0.08, 0.02, 1), C.woodLight, { x, y: 0.52, z });
  m.add(shapes.box(fx * 2 + 0.1, 0.07, 0.08, 0.02, 1), C.wood, { y: 1.02, z: -fz });
  m.add(shapes.box(fx * 2 + 0.1, 0.07, 0.08, 0.02, 1), C.wood, { y: 1.02, z: fz });
  m.add(shapes.box(0.08, 0.07, fz * 2 + 0.1, 0.02, 1), C.wood, { x: -fx, y: 1.02 });
  m.add(shapes.box(0.06, 0.05, Math.hypot(fx * 2, 0.9), 0.02, 1), C.wood, { x: 0, y: 0.55, z: -fz, ry: Math.PI / 2, rx: Math.atan2(0.9, fx * 2) });
  // a pile of planks and a few cones
  for (let i = 0; i < 4; i++) m.add(shapes.box(0.62, 0.04, 0.12, 0.015, 1), i % 2 ? C.woodLight : C.wood, { x: -hw * 0.45, y: 0.05 + i * 0.045, z: hd * 0.6 - 0.05, ry: 0.1 * (i - 1.5) });
  const cone = (x: number, z: number) => {
    m.add(shapes.cone(0.08, 0.22, 10), C.orange, { x, y: 0.14, z }, { ao: false });
    m.add(shapes.box(0.17, 0.03, 0.17, 0.01, 1), C.orange, { x, y: 0.035, z }, { ao: false });
    m.add(shapes.cyl(0.052, 0.062, 0.035, 10), C.white, { x, y: 0.15, z }, { ao: false });
  };
  cone(u - gap - 0.15, hd + 0.12);
  cone(u + gap + 0.15, hd + 0.12);
  cone(hw * 0.5, -hd * 0.4);
  // a work lamp on the frame (glows at night)
  k.bulbs.add(shapes.sphere(0.05, 8, 6), C.glow, { x: fx, y: 1.1, z: fz });
  return finish(p, f, 1.2);
}

/** A colour for a lot's stone. */
export const NATURE_STONE: ColorRepresentation = C.rock;
