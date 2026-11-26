// The harbour's warehouses on Westbay's map (data/city/warehouses.ts; docs/town.md §32): brick sheds in a row on the
// bay's shore, their numbers painted large in white on the roof (turned to read from the usual camera) and over the
// doors on the quay lane, so fifteen is found by its number. Each has a big sliding door and a side door with a lamp
// over it (the "side door / slide door" of job 4a), high windows that glow at night. Fifteen has a black side door, a
// back door on Quay Street and a water gate on the bay with a slipway down to the water.
//
// One model per row (three/scene/props3d.ts registerScenery hands every warehouse at once): a few draw calls for all.
// Registered when the city's page loads (imported by cityPlaces3d.ts), so none of it is in the town's chunk.

import type { WorldScenery } from '../../../data/townWorld';
import { WAREHOUSE_INSET } from '../../../core/town/colliders';
import { Merge, shapes, type Place } from '../three/scene/merge';
import { C } from '../three/scene/palette3d';
import { registerScenery, type Piece } from '../three/scene/props3d';
import { WATER_LEVEL } from '../three/scene/terrain';

const H = 1.5;

/** A box whose rounded corners never exceed a third of its thinnest side (many parts here are thin paint and boards). */
const bx = (w: number, h: number, d: number) => shapes.box(w, h, d, Math.min(0.02, Math.min(w, h, d) / 3), 1);
const BRICKS = ['#b06a52', '#9c5d4a', '#b97e5e'] as const;
const ROOF = '#7d8592';
const PAINT = '#f4f1e8';
const SHUT = '#8d96a3';
const BLACK = '#23252c';

/**
 * Seven-segment glyphs: which of a b c d e f g are on (a top, b top right, c bottom right, d bottom, e bottom left,
 * f top left, g middle).
 */
const SEGS: Readonly<Record<string, string>> = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };

/** A number's strokes in a glyph box: rectangles (u, v = centre; w, h) with each digit `dw` wide and `dh` tall. */
function strokes(text: string, dw: number, dh: number, t: number): { u: number; v: number; w: number; h: number }[] {
  const gap = dw * 0.35;
  const total = text.length * dw + (text.length - 1) * gap;
  const out: { u: number; v: number; w: number; h: number }[] = [];
  [...text].forEach((ch, i) => {
    const u0 = -total / 2 + i * (dw + gap);
    const on = SEGS[ch] ?? '';
    const half = dh / 2;
    const seg = (s: string, u: number, v: number, w: number, h: number) => on.includes(s) && out.push({ u: u0 + u, v, w, h });
    seg('a', dw / 2, half - t / 2, dw, t);
    seg('g', dw / 2, 0, dw, t);
    seg('d', dw / 2, -half + t / 2, dw, t);
    seg('f', t / 2, half / 2, t, half);
    seg('b', dw - t / 2, half / 2, t, half);
    seg('e', t / 2, -half / 2, t, half);
    seg('c', dw - t / 2, -half / 2, t, half);
  });
  return out;
}

interface Box {
  n: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function bounds(s: WorldScenery): Box {
  const xs = s.tiles.map((t) => t.x);
  const ys = s.tiles.map((t) => t.y);
  return { n: s.v ?? 0, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 };
}

/** One warehouse into the row's merges, in coordinates relative to the row's middle (ox, oz). */
function shed(m: Merge, glass: Merge, bulbs: Merge, b: Box, ox: number, oz: number): void {
  const i = WAREHOUSE_INSET;
  const x0 = b.x0 + i - ox;
  const x1 = b.x1 - i - ox;
  const z0 = b.y0 + i - oz;
  const z1 = b.y1 - i - oz;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const brick = BRICKS[b.n % BRICKS.length];
  const fifteen = b.n === 15;
  // the shell, a plinth, a darker band under the roof, the roof with its parapet
  m.add(bx(w + 0.06, 0.12, d + 0.06), C.stoneDark, { x: cx, y: 0.06, z: cz });
  m.add(bx(w, H, d), brick, { x: cx, y: H / 2, z: cz });
  m.add(bx(w + 0.03, 0.08, d + 0.03), C.stoneDark, { x: cx, y: H - 0.1, z: cz }, { ao: false });
  m.add(bx(w + 0.1, 0.06, d + 0.1), ROOF, { x: cx, y: H + 0.03, z: cz }, { ao: false });
  for (const s of [-1, 1]) {
    m.add(bx(w + 0.1, 0.1, 0.06), C.stone, { x: cx, y: H + 0.1, z: cz + s * (d / 2 + 0.02) }, { ao: false });
    m.add(bx(0.06, 0.1, d + 0.1), C.stone, { x: cx + s * (w / 2 + 0.02), y: H + 0.1, z: cz }, { ao: false });
  }
  // the number on the roof, turned to read from the usual camera (it looks in from +x +y: the text's baseline runs along
  // +x −y on the ground, its top towards −x −y)
  const roof = strokes(String(b.n), 0.42, 0.78, 0.13);
  const c = Math.cos(Math.PI / 4);
  for (const r of roof) {
    // baseline direction (c, −c) on (x, z), up direction (−c, −c)
    const px = cx + r.u * c - r.v * c;
    const pz = cz - r.u * c - r.v * c;
    m.add(bx(r.w, 0.02, r.h), PAINT, { x: px, y: H + 0.07, z: pz, ry: Math.PI / 4 }, { ao: false });
  }
  // the front on the quay lane (+x face): the big sliding door, the side door with its lamp, the number over them
  const fx = x1;
  const face = (u: number, v: number, out = 0, extra: Place = {}): Place => ({ ...extra, x: fx + out, y: v, z: cz - u });
  // (u runs along the wall towards −z: left to right as the camera sees the face)
  const slide = { u: d * 0.16, w: d * 0.5 };
  m.add(bx(0.05, 0.98, slide.w + 0.08), C.stoneDark, face(slide.u, 0.5, 0.01), { ao: false });
  for (let k = 0; k < 6; k++) m.add(bx(0.03, 0.15, slide.w), SHUT, face(slide.u, 0.1 + k * 0.16, 0.035), { ao: false });
  m.add(bx(0.04, 0.04, slide.w + 0.2), C.metal, face(slide.u, 1.02, 0.04), { ao: false });
  const side = -d * 0.3;
  m.add(bx(0.05, 0.72, 0.36), C.trim, face(side, 0.36, 0.01), { ao: false });
  m.add(bx(0.04, 0.66, 0.3), fifteen ? BLACK : C.woodDark, face(side, 0.34, 0.03), { ao: false });
  m.add(shapes.sphere(0.02, 6, 4), C.mustard, face(side - 0.1, 0.34, 0.06), { ao: false });
  m.add(bx(0.12, 0.03, 0.03), C.metal, face(side, 0.84, 0.06), { ao: false });
  bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, face(side, 0.8, 0.12));
  // high windows (they glow at night like every lit window)
  for (const u of [d * 0.38, -d * 0.02]) {
    m.add(bx(0.04, 0.2, 0.36), C.trim, face(u, 1.18, 0.01), { ao: false });
    glass.add(bx(0.03, 0.15, 0.3), C.glass, face(u, 1.18, 0.025));
  }
  // the number over the doors, large, white on a dark board
  const wall = strokes(String(b.n), 0.2, 0.36, 0.06);
  m.add(bx(0.03, 0.44, 0.62), BLACK, face(-d * 0.3, 1.18, 0.015), { ao: false });
  for (const r of wall) m.add(bx(0.02, r.h, r.w), PAINT, face(-d * 0.3 + r.u, 1.18 + r.v, 0.035), { ao: false });
  if (!fifteen) return;
  // fifteen's back door on Quay Street (+z face) with its own lamp
  const bz = z1;
  m.add(bx(0.38, 0.74, 0.05), C.trim, { x: cx - w * 0.25, y: 0.37, z: bz + 0.01 }, { ao: false });
  m.add(bx(0.32, 0.68, 0.04), BLACK, { x: cx - w * 0.25, y: 0.35, z: bz + 0.03 }, { ao: false });
  bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, { x: cx - w * 0.25, y: 0.82, z: bz + 0.12 });
  // its water gate on the bay (−x face): a wide wooden gate, a beam over it, the slipway down over the sand to the water
  const gx = x0;
  m.add(bx(0.06, 0.92, d * 0.62), C.woodDark, { x: gx - 0.02, y: 0.48, z: cz });
  for (const s of [-1, 1]) m.add(bx(0.07, 1.0, 0.07), C.stoneDark, { x: gx - 0.04, y: 0.5, z: cz + s * d * 0.33 }, { ao: false });
  m.add(bx(0.12, 0.08, d * 0.75), C.metal, { x: gx - 0.05, y: 1.0, z: cz }, { ao: false });
  const slipTop = 0.03;
  const slipLen = 1.7;
  const drop = slipTop - WATER_LEVEL + 0.12;
  m.add(bx(slipLen, 0.06, d * 0.55), C.stone, { x: gx - slipLen / 2, y: (slipTop + (WATER_LEVEL - 0.12)) / 2, z: cz, rz: Math.atan2(drop, slipLen) });
  for (const s of [-1, 1]) m.add(shapes.cyl(0.04, 0.04, 0.5, 6), C.woodDark, { x: gx - slipLen + 0.1, y: WATER_LEVEL + 0.1, z: cz + s * d * 0.35 }, { ao: false });
}

/** Every warehouse at once: one piece (one body, one glass, one bulbs mesh) per run of the row. */
function warehouses(items: { s: WorldScenery; index: number }[]): Piece[] {
  // runs: warehouses that touch (the row is cut by Quay Street)
  const boxes = items.map((it) => ({ b: bounds(it.s), index: it.index })).sort((p, q) => p.b.y0 - q.b.y0);
  const runs: (typeof boxes)[] = [];
  for (const it of boxes) {
    const last = runs[runs.length - 1];
    if (last && it.b.y0 - last[last.length - 1].b.y1 < 0.5 && it.b.x0 === last[0].b.x0) last.push(it);
    else runs.push([it]);
  }
  return runs.map((run) => {
    const x0 = Math.min(...run.map((r) => r.b.x0));
    const x1 = Math.max(...run.map((r) => r.b.x1));
    const y0 = Math.min(...run.map((r) => r.b.y0));
    const y1 = Math.max(...run.map((r) => r.b.y1));
    const ox = (x0 + x1) / 2;
    const oz = (y0 + y1) / 2;
    const m = new Merge();
    const glass = new Merge();
    const bulbs = new Merge();
    for (const r of run) shed(m, glass, bulbs, r.b, ox, oz);
    return {
      pop: '',
      index: run[0].index,
      x: ox,
      z: oz,
      ry: 0,
      body: m.build(),
      glass: glass.build(),
      bulbs: bulbs.build(),
      water: null,
      sway: null,
      height: H + 0.15,
      hx: (x1 - x0) / 2 - WAREHOUSE_INSET,
      hz: (y1 - y0) / 2 - WAREHOUSE_INSET,
    };
  });
}

registerScenery('warehouse', warehouses);
