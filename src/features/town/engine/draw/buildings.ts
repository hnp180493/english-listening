// The 13 places of the town as little isometric houses, each with its own shape, colours and sign, and the empty
// lot a place is before it is built. World pixels; light from the top-left (the +y wall is the bright one).
// Colours are game art (palette.ts): authored for daylight, shown through `pal.ink`.

import type { PlaceId, WorldPlace } from '../../../../data/townWorld';
import { type Pt } from '../iso';
import { alpha, ART } from '../palette';
import { PLACE_LOOK, type PlaceLook } from '../places';
import { faceQuad, glow, hash, isoBox, line, onFace, oval, P, poly, roundRect, starPath, sway, type Box, type G } from './util';

type Face = 'x' | 'y';

/** The walls stand a little inside the footprint, so houses never touch each other or the street. */
function boxOf(p: WorldPlace): Box {
  const i = 0.2;
  return { x0: p.x + i, y0: p.y + i, x1: p.x + p.w - i, y1: p.y + p.d - i };
}

/** Where along the door's face the door tile is, 0..1 (left → right on the screen). */
function doorU(p: WorldPlace, b: Box): number {
  const u = p.face === 'y' ? (p.door.x + 0.5 - b.x0) / (b.x1 - b.x0) : (b.y1 - (p.door.y + 0.5)) / (b.y1 - b.y0);
  return Math.max(0.16, Math.min(0.84, u));
}

const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const midPt = (pts: readonly Pt[]): Pt => {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
};

// ───────────────────────── parts ─────────────────────────

function walls(g: G, b: Box, h: number, wall: string, base = true): void {
  const { ctx, pal } = g;
  poly(ctx, faceQuad(b, 'y', 0, 1, 0, h), pal.ink(wall));
  poly(ctx, faceQuad(b, 'x', 0, 1, 0, h), pal.ink(wall, -0.2));
  if (base) {
    // a stone foot
    poly(ctx, faceQuad(b, 'y', 0, 1, 0, 4), pal.ink(ART.stone, -0.05));
    poly(ctx, faceQuad(b, 'x', 0, 1, 0, 4), pal.ink(ART.stone, -0.25));
  }
}

interface Win {
  f: Face;
  u: number;
  z: number;
  /** Width as a share of the face, height in pixels. */
  w: number;
  h: number;
  round?: boolean;
  box?: string;
}

/** How bright window `i` of `n` is for a place lit to `lit` (0..1): they come on one after another. */
function windowAmount(lit: number, i: number, n: number): number {
  return Math.max(0, Math.min(1, lit * n - i));
}

function window_(g: G, b: Box, w: Win, amount: number, frame: string): void {
  const { ctx, pal } = g;
  const u0 = w.u - w.w / 2;
  const u1 = w.u + w.w / 2;
  const c = onFace(b, w.f, w.u, w.z + w.h / 2);
  if (w.round) {
    const r = w.h / 2;
    oval(ctx, c.x, c.y, r + 1.6, r + 1.6, pal.ink(frame));
    oval(ctx, c.x, c.y, r, r, pal.ink('#86a9cf', w.f === 'x' ? -0.15 : 0));
    if (amount > 0) {
      ctx.globalAlpha = amount;
      oval(ctx, c.x, c.y, r, r, pal.windowLit);
      ctx.globalAlpha = 1;
    }
    line(ctx, [{ x: c.x - r, y: c.y }, { x: c.x + r, y: c.y }], pal.ink(frame), 1);
    line(ctx, [{ x: c.x, y: c.y - r }, { x: c.x, y: c.y + r }], pal.ink(frame), 1);
  } else {
    const pad = 0.018;
    poly(ctx, faceQuad(b, w.f, u0 - pad, u1 + pad, w.z - 1.5, w.z + w.h + 1.5), pal.ink(frame));
    const glass = faceQuad(b, w.f, u0, u1, w.z, w.z + w.h);
    poly(ctx, glass, pal.ink('#86a9cf', w.f === 'x' ? -0.15 : 0));
    if (amount > 0) {
      ctx.globalAlpha = amount;
      poly(ctx, glass, pal.windowLit);
      // brighter towards the bottom, like a lamp on a table
      poly(ctx, faceQuad(b, w.f, u0, u1, w.z, w.z + w.h * 0.45), pal.windowCore);
      ctx.globalAlpha = 1;
    } else if (!pal.night) {
      // daylight on the glass
      ctx.globalAlpha = 0.45;
      poly(ctx, faceQuad(b, w.f, u0, u0 + w.w * 0.4, w.z + w.h * 0.45, w.z + w.h), pal.ink('#ffffff'));
      ctx.globalAlpha = 1;
    }
    line(ctx, [onFace(b, w.f, w.u, w.z), onFace(b, w.f, w.u, w.z + w.h)], pal.ink(frame), 1);
    line(ctx, [onFace(b, w.f, u0, w.z + w.h * 0.5), onFace(b, w.f, u1, w.z + w.h * 0.5)], pal.ink(frame), 1);
    // sill
    poly(ctx, faceQuad(b, w.f, u0 - 0.03, u1 + 0.03, w.z - 3, w.z - 1), pal.ink(frame, -0.12));
  }
  if (w.box) {
    // a flower box under the window
    poly(ctx, faceQuad(b, w.f, u0 - 0.02, u1 + 0.02, w.z - 6, w.z - 2), pal.ink(ART.wood));
    for (let i = 0; i < 4; i++) {
      const q = onFace(b, w.f, u0 + ((i + 0.5) / 4) * w.w, w.z - 1);
      oval(ctx, q.x, q.y - 1, 2.1, 2, pal.ink(i % 2 === 0 ? w.box : ART.leaf));
    }
  }
  if (pal.night && amount > 0) glow(g, c.x, c.y, 24, 22, 0.5 * amount);
}

/** `total`: how many lights the place has in all, when some are drawn apart (an attic window over the roof). */
function windows(g: G, b: Box, list: readonly Win[], lit: number, frame = '#ffffff', total = list.length): void {
  list.forEach((w, i) => window_(g, b, w, windowAmount(lit, i, total), frame));
}

function door(g: G, b: Box, f: Face, u: number, color: string, w = 0.2, h = 20): void {
  const { ctx, pal } = g;
  const u0 = u - w / 2;
  const u1 = u + w / 2;
  poly(ctx, faceQuad(b, f, u0 - 0.025, u1 + 0.025, 0, h + 2), pal.ink('#ffffff', -0.04));
  poly(ctx, faceQuad(b, f, u0, u1, 0, h), pal.ink(color, f === 'x' ? -0.15 : 0));
  // a small pane at the top and a knob
  poly(ctx, faceQuad(b, f, u0 + w * 0.2, u1 - w * 0.2, h - 8, h - 3), pal.night ? pal.windowLit : pal.ink('#cfe6f7'));
  const k = onFace(b, f, u1 - w * 0.22, h * 0.42);
  oval(ctx, k.x, k.y, 1.2, 1.2, pal.ink('#ffe08a'));
  // doorstep
  const s0 = onFace(b, f, u0 - 0.04, 0);
  const s1 = onFace(b, f, u1 + 0.04, 0);
  const out = f === 'y' ? { x: -5, y: 2.5 } : { x: 5, y: 2.5 };
  poly(ctx, [s0, s1, { x: s1.x + out.x, y: s1.y + out.y }, { x: s0.x + out.x, y: s0.y + out.y }], pal.ink(ART.stone));
}

/** A little lantern beside the door: on at night, whatever the place's progress. */
function porchLight(g: G, b: Box, f: Face, u: number, z = 24): void {
  const { ctx, pal } = g;
  const c = onFace(b, f, u, z);
  const out = f === 'y' ? -2.5 : 2.5;
  roundRect(ctx, c.x + out - 2, c.y - 3, 4, 6, 1.4);
  ctx.fillStyle = pal.night ? pal.lampOn : pal.ink(ART.cream);
  ctx.fill();
  line(ctx, [{ x: c.x + out - 2.6, y: c.y - 3.4 }, { x: c.x + out + 2.6, y: c.y - 3.4 }], pal.ink(ART.iron), 1.4);
  if (pal.night) glow(g, c.x + out, c.y, 20, 18, 0.5);
}

type RoofShape = 'gableX' | 'gableY' | 'hip';

/** A pitched roof over a box. Painted back to front, so any pitch looks right. Returns the highest point. */
function roof(g: G, b: Box, wallH: number, roofH: number, color: string, shape: RoofShape, wall: string, over = 0.13): Pt {
  const { ctx, pal } = g;
  const he = wallH - 3;
  const hr = wallH + roofH;
  const ex0 = b.x0 - over;
  const ex1 = b.x1 + over;
  const ey0 = b.y0 - over;
  const ey1 = b.y1 + over;
  const xm = (b.x0 + b.x1) / 2;
  const ym = (b.y0 + b.y1) / 2;
  const A = P(ex0, ey0, he);
  const B = P(ex1, ey0, he);
  const C = P(ex1, ey1, he);
  const D = P(ex0, ey1, he);
  const lenX = ex1 - ex0;
  const lenY = ey1 - ey0;
  let alongX = lenX >= lenY;
  let r1: Pt;
  let r2: Pt;
  if (shape === 'gableX') {
    alongX = true;
    r1 = P(ex0, ym, hr);
    r2 = P(ex1, ym, hr);
  } else if (shape === 'gableY') {
    alongX = false;
    r1 = P(xm, ey0, hr);
    r2 = P(xm, ey1, hr);
  } else if (alongX) {
    r1 = P(ex0 + lenY / 2, ym, hr);
    r2 = P(ex1 - lenY / 2, ym, hr);
  } else {
    r1 = P(xm, ey0 + lenX / 2, hr);
    r2 = P(xm, ey1 - lenX / 2, hr);
  }
  const cBack = pal.ink(color, -0.34);
  const cSide = pal.ink(color, -0.1);
  const cShade = pal.ink(color, -0.18);
  const cLit = pal.ink(color, 0.1);
  const edge = pal.ink(color, -0.36);
  if (alongX) {
    poly(ctx, [A, B, r2, r1], cBack);
    if (shape === 'hip') poly(ctx, [D, A, r1], cSide);
    if (shape === 'hip') poly(ctx, [B, C, r2], cShade);
    else {
      // the gable end: wall up to the ridge, with the roof's edge over it
      poly(ctx, [P(b.x1, b.y1, wallH), P(b.x1, b.y0, wallH), P(b.x1, ym, hr - 2)], pal.ink(wall, -0.2));
      line(ctx, [C, r2, B], edge, 3.2);
    }
    const front = [C, D, r1, r2];
    poly(ctx, front, cLit);
    shingles(g, D, C, r1, r2, color);
    line(ctx, [D, C], edge, 2.4);
    line(ctx, [r1, r2], pal.ink(color, 0.36), 2);
  } else {
    poly(ctx, [D, A, r1, r2], cSide);
    if (shape === 'hip') poly(ctx, [A, B, r1], cBack);
    const right = [B, C, r2, r1];
    poly(ctx, right, cShade);
    shingles(g, C, B, r2, r1, color, -0.3);
    line(ctx, [C, B], edge, 2.4);
    if (shape === 'hip') {
      poly(ctx, [C, D, r2], cLit);
      line(ctx, [D, C], edge, 2.4);
    } else {
      poly(ctx, [P(b.x0, b.y1, wallH), P(b.x1, b.y1, wallH), P(xm, b.y1, hr - 2)], pal.ink(wall));
      line(ctx, [D, r2, C], edge, 3.2);
    }
    line(ctx, [r1, r2], pal.ink(color, 0.36), 2);
  }
  return { x: (r1.x + r2.x) / 2, y: (r1.y + r2.y) / 2 };
}

/** Rows of shingles on a slope: eave from e1 to e2, ridge from r1 to r2. */
function shingles(g: G, e1: Pt, e2: Pt, r1: Pt, r2: Pt, color: string, k = -0.16): void {
  const { ctx, pal } = g;
  ctx.globalAlpha = 0.55;
  for (const t of [0.34, 0.67]) line(ctx, [lerpPt(e1, r1, t), lerpPt(e2, r2, t)], pal.ink(color, k), 1.2);
  ctx.globalAlpha = 1;
}

/** A flat roof with a low rim. Returns the middle of the top. */
function flatRoof(g: G, b: Box, wallH: number, rim: number, color: string): Pt {
  const o = 0.06;
  isoBox(g, b.x0 - o, b.y0 - o, b.x1 + o, b.y1 + o, wallH, wallH + rim, color, color);
  const i = 0.12;
  poly(g.ctx, [P(b.x0 + i, b.y0 + i, wallH + rim), P(b.x1 - i, b.y0 + i, wallH + rim), P(b.x1 - i, b.y1 - i, wallH + rim), P(b.x0 + i, b.y1 - i, wallH + rim)], g.pal.ink(color, -0.2));
  return P((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, wallH + rim);
}

function chimney(g: G, x: number, y: number, z0: number, z1: number, phase: number): void {
  isoBox(g, x - 0.1, y - 0.1, x + 0.1, y + 0.1, z0, z1, '#c98a6b');
  isoBox(g, x - 0.13, y - 0.13, x + 0.13, y + 0.13, z1, z1 + 3, '#a9684f');
  smoke(g, P(x, y, z1 + 4), phase);
}

/** Puffs drifting up from a chimney. A function of time: nothing to keep. */
function smoke(g: G, at: Pt, phase: number): void {
  const { ctx, pal } = g;
  if (g.still) {
    ctx.globalAlpha = 0.3;
    oval(ctx, at.x + 3, at.y - 8, 5, 4, pal.ink('#ffffff'));
    ctx.globalAlpha = 1;
    return;
  }
  for (let i = 0; i < 4; i++) {
    const k = (g.t * 0.2 + i / 4 + phase) % 1;
    const x = at.x + Math.sin(k * 5 + i * 2 + phase * 9) * 3 + k * 12;
    const y = at.y - k * 36;
    ctx.globalAlpha = Math.sin(k * Math.PI) * (pal.night ? 0.3 : 0.5);
    oval(ctx, x, y, 3 + k * 6, 2.6 + k * 4.5, pal.ink('#ffffff'));
  }
  ctx.globalAlpha = 1;
}

/** A striped awning sloping out from a wall. */
function awning(g: G, b: Box, f: Face, u0: number, u1: number, z: number, a: string, c: string, reach = 0.24, drop = 8): void {
  const { ctx, pal } = g;
  const n = Math.max(3, Math.round((u1 - u0) * 9));
  const outPt = (u: number): Pt => {
    const w = onFace(b, f, u, z - drop);
    return f === 'y' ? { x: w.x - reach * 32, y: w.y + reach * 16 } : { x: w.x + reach * 32, y: w.y + reach * 16 };
  };
  for (let i = 0; i < n; i++) {
    const a0 = u0 + ((u1 - u0) * i) / n;
    const a1 = u0 + ((u1 - u0) * (i + 1)) / n;
    const col = pal.ink(i % 2 === 0 ? a : c, f === 'x' ? -0.12 : 0);
    const o0 = outPt(a0);
    const o1 = outPt(a1);
    poly(ctx, [onFace(b, f, a0, z), onFace(b, f, a1, z), o1, o0], col);
    // the hanging edge, scalloped
    oval(ctx, (o0.x + o1.x) / 2, (o0.y + o1.y) / 2 + 1, Math.abs(o1.x - o0.x) / 2, 2.6, col);
  }
}

/** A round sign with a pictogram, flat on a wall. */
function plate(g: G, c: Pt, r: number, fill: string, ring: string): void {
  oval(g.ctx, c.x, c.y, r + 1.6, r + 1.6, g.pal.ink(ring));
  oval(g.ctx, c.x, c.y, r, r, g.pal.ink(fill));
}

/** The reward of a place whose lines are all understood: a little gold star on a pole. */
function star(g: G, top: Pt): void {
  const { ctx, pal } = g;
  const y = top.y - 15 + sway(g, 2, top.x, 1);
  line(ctx, [top, { x: top.x, y: top.y - 10 }], pal.ink(ART.iron), 1.4);
  if (pal.night) glow(g, top.x, y, 20, 20, 0.6);
  starPath(ctx, top.x, y, 6.5);
  ctx.fillStyle = pal.night ? pal.windowCore : pal.ink('#ffc93c');
  ctx.fill();
  ctx.strokeStyle = pal.ink('#e09a1a');
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ───────────────────────── the places ─────────────────────────

type Painter = (g: G, p: WorldPlace, b: Box, look: PlaceLook, lit: number) => Pt;

const cafe: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  windows(
    g,
    b,
    [
      { f: 'y', u: 0.2, z: 9, w: 0.2, h: 13 },
      { f: 'y', u: 0.8, z: 9, w: 0.2, h: 13 },
      { f: 'x', u: 0.3, z: 10, w: 0.26, h: 12, box: '#f58fb0' },
      { f: 'x', u: 0.72, z: 10, w: 0.26, h: 12, box: '#ffd76b' },
    ],
    lit,
  );
  door(g, b, 'y', du, k.door, 0.16, 20);
  porchLight(g, b, 'y', du + 0.14);
  awning(g, b, 'y', 0.06, 0.94, 31, k.accent, '#ffffff', 0.22, 6);
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'gableX', k.wall);
  chimney(g, b.x0 + 0.5, (b.y0 + b.y1) / 2 - 0.1, k.wallH + k.roofH - 8, k.wallH + k.roofH + 9, 0.1);
  // the sign on the gable: a cup
  const s = P(b.x1, (b.y0 + b.y1) / 2, k.wallH + 9);
  plate(g, s, 7, '#fffaf0', k.roof);
  roundRect(ctx, s.x - 3.6, s.y - 2.4, 6, 5.4, 1.6);
  ctx.fillStyle = pal.ink('#b0714a');
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s.x + 2.8, s.y + 0.2, 2, -Math.PI / 2, Math.PI / 2);
  ctx.strokeStyle = pal.ink('#b0714a');
  ctx.lineWidth = 1.2;
  ctx.stroke();
  return top;
};

const friend: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  windows(
    g,
    b,
    [
      { f: 'y', u: 0.66, z: 10, w: 0.26, h: 13, box: '#f58fb0' },
      { f: 'x', u: 0.3, z: 10, w: 0.24, h: 13, box: '#c9b1ff' },
      { f: 'x', u: 0.72, z: 10, w: 0.24, h: 13, box: '#f58fb0' },
    ],
    lit,
  );
  door(g, b, 'y', du, k.door, 0.2, 20);
  porchLight(g, b, 'y', du + 0.17);
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'gableY', k.wall);
  // a heart in the gable
  const c = P((b.x0 + b.x1) / 2, b.y1, k.wallH + 8);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + 4);
  ctx.bezierCurveTo(c.x - 7, c.y - 1, c.x - 3.5, c.y - 6, c.x, c.y - 2);
  ctx.bezierCurveTo(c.x + 3.5, c.y - 6, c.x + 7, c.y - 1, c.x, c.y + 4);
  ctx.fillStyle = pal.ink(k.accent);
  ctx.fill();
  chimney(g, (b.x0 + b.x1) / 2 + 0.3, b.y0 + 0.5, k.wallH + k.roofH - 16, k.wallH + k.roofH + 5, 0.55);
  // a mailbox by the door
  const m = onFace(b, 'y', Math.max(0.04, du - 0.2), 0);
  line(ctx, [{ x: m.x - 5, y: m.y + 3 }, { x: m.x - 5, y: m.y - 8 }], pal.ink(ART.woodDark), 1.6);
  roundRect(ctx, m.x - 9, m.y - 13, 8, 6, 2);
  ctx.fillStyle = pal.ink('#ef6b5b');
  ctx.fill();
  return top;
};

const home: Painter = (g, p, b, k, lit) => {
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  windows(
    g,
    b,
    [
      { f: 'y', u: 0.28, z: 10, w: 0.24, h: 13, box: '#ffd76b' },
      { f: 'y', u: 0.72, z: 10, w: 0.24, h: 13, box: '#c9b1ff' },
      { f: 'x', u: 0.68, z: 10, w: 0.26, h: 13 },
    ],
    lit,
    '#ffffff',
    4,
  );
  door(g, b, 'x', du, k.door, 0.2, 20);
  porchLight(g, b, 'x', du + 0.17);
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'gableX', k.wall);
  // the round attic window sits on the gable, over the roof's end wall
  window_(g, b, { f: 'x', u: 0.5, z: k.wallH + 2, w: 0, h: 8, round: true }, windowAmount(lit, 3, 4), '#ffffff');
  chimney(g, b.x0 + 0.45, (b.y0 + b.y1) / 2 + 0.25, k.wallH + k.roofH - 16, k.wallH + k.roofH + 6, 0.3);
  return top;
};

const shop: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  windows(
    g,
    b,
    [
      { f: 'x', u: 0.32, z: 8, w: 0.4, h: 14 },
      { f: 'y', u: 0.3, z: 10, w: 0.24, h: 12 },
      { f: 'y', u: 0.72, z: 10, w: 0.24, h: 12 },
    ],
    lit,
  );
  door(g, b, 'x', du, k.door, 0.18, 20);
  awning(g, b, 'x', 0.04, 0.96, 31, k.accent, '#ffffff', 0.24, 6);
  // crates of fruit by the shop window
  for (let i = 0; i < 2; i++) {
    const cy = b.y1 - 0.34 - i * 0.36;
    isoBox(g, b.x1 + 0.05, cy - 0.14, b.x1 + 0.3, cy + 0.14, 0, 6, ART.wood);
    for (let j = 0; j < 3; j++) {
      const q = P(b.x1 + 0.1 + j * 0.07, cy - 0.06 + (j % 2) * 0.1, 7);
      oval(ctx, q.x, q.y, 2.3, 2.1, pal.ink(i === 0 ? '#ff9f43' : '#8fd16a'));
    }
  }
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'hip', k.wall);
  // a sign standing on the roof: a shopping bag
  const s = { x: top.x, y: top.y - 9 };
  line(ctx, [{ x: s.x - 6, y: top.y }, { x: s.x - 6, y: s.y }], pal.ink(ART.woodDark), 1.6);
  line(ctx, [{ x: s.x + 6, y: top.y }, { x: s.x + 6, y: s.y }], pal.ink(ART.woodDark), 1.6);
  roundRect(ctx, s.x - 11, s.y - 12, 22, 14, 3);
  ctx.fillStyle = pal.ink('#fffaf0');
  ctx.fill();
  roundRect(ctx, s.x - 4, s.y - 8, 8, 7.5, 1.4);
  ctx.fillStyle = pal.ink(k.accent);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s.x, s.y - 8, 2.4, Math.PI, 0);
  ctx.strokeStyle = pal.ink(k.accent, -0.2);
  ctx.lineWidth = 1.1;
  ctx.stroke();
  return { x: top.x, y: s.y - 12 };
};

const office: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  // a band between the floors
  poly(ctx, faceQuad(b, 'y', 0, 1, 30, 33), pal.ink(k.roof, 0.35));
  poly(ctx, faceQuad(b, 'x', 0, 1, 30, 33), pal.ink(k.roof, 0.1));
  const list: Win[] = [];
  for (const z of [38, 9]) {
    for (const u of [0.17, 0.5, 0.83]) if (!(z === 9 && u === 0.5)) list.push({ f: 'y', u, z, w: 0.2, h: 15 });
    for (const u of [0.3, 0.72]) list.push({ f: 'x', u, z, w: 0.26, h: 15 });
  }
  windows(g, b, list, lit, '#dfe8f6');
  // glass double door under a small canopy
  door(g, b, 'y', du, '#9cc4ea', 0.22, 21);
  poly(ctx, [onFace(b, 'y', du - 0.16, 25), onFace(b, 'y', du + 0.16, 25), { x: onFace(b, 'y', du + 0.16, 23).x - 7, y: onFace(b, 'y', du + 0.16, 23).y + 3.5 }, { x: onFace(b, 'y', du - 0.16, 23).x - 7, y: onFace(b, 'y', du - 0.16, 23).y + 3.5 }], pal.ink(k.roof));
  const top = flatRoof(g, b, k.wallH, k.roofH, k.roof);
  // roof: an air unit and a mast with a small red light
  isoBox(g, b.x0 + 0.5, b.y0 + 0.45, b.x0 + 1.0, b.y0 + 0.85, k.wallH + k.roofH, k.wallH + k.roofH + 8, ART.stone);
  const m = P(b.x1 - 0.5, b.y0 + 0.5, k.wallH + k.roofH);
  line(ctx, [m, { x: m.x, y: m.y - 20 }], pal.ink(ART.iron), 1.5);
  const blink = g.still ? 1 : 0.5 + 0.5 * Math.sin(g.t * 2.4);
  oval(ctx, m.x, m.y - 21, 2, 2, pal.night ? alpha('#ff6b6b', 0.5 + 0.5 * blink) : pal.ink('#ef5d7a'));
  if (pal.night) glow(g, m.x, m.y - 21, 10, 10, 0.5 * blink, 'rgba(255,90,90,1)');
  return { x: top.x, y: top.y - 4 };
};

const school: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  windows(
    g,
    b,
    [
      { f: 'x', u: 0.16, z: 11, w: 0.16, h: 14 },
      { f: 'x', u: 0.84, z: 11, w: 0.16, h: 14 },
      { f: 'y', u: 0.5, z: 11, w: 0.34, h: 15 },
    ],
    lit,
    '#ffffff',
    4,
  );
  door(g, b, 'x', du, k.door, 0.18, 22);
  porchLight(g, b, 'x', du + 0.15, 26);
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'gableY', k.wall);
  // a round window in the front gable
  window_(g, b, { f: 'y', u: 0.5, z: k.wallH + 4, w: 0, h: 9, round: true }, windowAmount(lit, 3, 4), '#ffffff');
  // the bell turret on the ridge
  const tx = (b.x0 + b.x1) / 2;
  const ty = b.y1 - 0.55;
  const z = k.wallH + k.roofH - 4;
  isoBox(g, tx - 0.17, ty - 0.17, tx + 0.17, ty + 0.17, z, z + 12, '#fff6e6');
  const bell = P(tx + 0.17, ty, z + 6);
  oval(ctx, bell.x - 1, bell.y, 2.2, 2.6, pal.ink('#ffc93c'));
  const a = P(tx - 0.24, ty + 0.24, z + 12);
  const c = P(tx + 0.24, ty + 0.24, z + 12);
  const e = P(tx + 0.24, ty - 0.24, z + 12);
  const apex = P(tx, ty, z + 24);
  poly(ctx, [a, c, apex], pal.ink(k.roof, 0.1));
  poly(ctx, [c, e, apex], pal.ink(k.roof, -0.18));
  // a pennant
  line(ctx, [apex, { x: apex.x, y: apex.y - 12 }], pal.ink(ART.iron), 1.3);
  const w = sway(g, 3, 1, 1.5);
  poly(ctx, [{ x: apex.x, y: apex.y - 12 }, { x: apex.x + 9, y: apex.y - 9.5 + w }, { x: apex.x, y: apex.y - 7 }], pal.ink('#ffc93c'));
  return { x: top.x, y: top.y };
};

const station: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  poly(ctx, faceQuad(b, 'y', 0, 1, 4, 9), pal.ink(k.roof, 0.2));
  poly(ctx, faceQuad(b, 'x', 0, 1, 4, 9), pal.ink(k.roof, -0.05));
  windows(
    g,
    b,
    [
      { f: 'x', u: 0.3, z: 12, w: 0.34, h: 12 },
      { f: 'y', u: 0.24, z: 12, w: 0.2, h: 12 },
      { f: 'y', u: 0.76, z: 12, w: 0.2, h: 12 },
    ],
    lit,
  );
  door(g, b, 'x', du, k.door, 0.18, 20);
  // the waiting shelter: a flat canopy on two posts over the door side
  const z = 29;
  const o = 0.42;
  const c0 = P(b.x1, b.y1 + 0.05, z);
  const c1 = P(b.x1, b.y0 - 0.05, z);
  const c2 = P(b.x1 + o, b.y0 - 0.05, z - 3);
  const c3 = P(b.x1 + o, b.y1 + 0.05, z - 3);
  for (const y of [b.y1 - 0.08, b.y0 + 0.08]) line(ctx, [P(b.x1 + o - 0.06, y, 0), P(b.x1 + o - 0.06, y, z - 3)], pal.ink(ART.iron), 1.8);
  poly(ctx, [c0, c1, c2, c3], pal.ink(k.roof, -0.1));
  line(ctx, [c3, c2], pal.ink(k.roof, -0.4), 2.2);
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'hip', k.wall);
  // the clock, on the bright wall
  const c = onFace(b, 'y', 0.5, 23);
  plate(g, c, 6.5, '#ffffff', k.accent);
  line(ctx, [c, { x: c.x, y: c.y - 4.2 }], pal.ink(ART.iron), 1.3);
  line(ctx, [c, { x: c.x + 3, y: c.y + 1.2 }], pal.ink(ART.iron), 1.3);
  if (pal.night && lit > 0) glow(g, c.x, c.y, 16, 16, 0.3);
  // the stop sign at the corner
  const s = P(b.x1 + 0.34, b.y1 + 0.12, 0);
  line(ctx, [s, { x: s.x, y: s.y - 30 }], pal.ink(ART.iron), 1.8);
  roundRect(ctx, s.x - 6, s.y - 41, 12, 12, 3);
  ctx.fillStyle = pal.ink(k.roof);
  ctx.fill();
  roundRect(ctx, s.x - 3.6, s.y - 38.4, 7.2, 5.4, 1.4);
  ctx.fillStyle = pal.ink('#ffffff');
  ctx.fill();
  oval(ctx, s.x - 2, s.y - 31.6, 1.1, 1.1, pal.ink('#ffffff'));
  oval(ctx, s.x + 2, s.y - 31.6, 1.1, 1.1, pal.ink('#ffffff'));
  return top;
};

const clinic: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  poly(ctx, faceQuad(b, 'y', 0, 1, 4, 8), pal.ink(k.roof, 0.3));
  poly(ctx, faceQuad(b, 'x', 0, 1, 4, 8), pal.ink(k.roof, 0.05));
  windows(
    g,
    b,
    [
      { f: 'y', u: 0.28, z: 11, w: 0.24, h: 13 },
      { f: 'y', u: 0.72, z: 11, w: 0.24, h: 13 },
      { f: 'x', u: 0.72, z: 11, w: 0.2, h: 13 },
    ],
    lit,
  );
  door(g, b, 'x', du, k.door, 0.2, 20);
  porchLight(g, b, 'x', du + 0.17);
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'hip', k.wall);
  // the cross: a white board on the roof
  const s = { x: top.x, y: top.y - 4 };
  roundRect(ctx, s.x - 9, s.y - 17, 18, 18, 4);
  ctx.fillStyle = pal.ink('#ffffff');
  ctx.fill();
  ctx.fillStyle = pal.ink(k.accent);
  ctx.fillRect(s.x - 2.2, s.y - 14, 4.4, 12);
  ctx.fillRect(s.x - 6, s.y - 10.2, 12, 4.4);
  if (pal.night && lit > 0) glow(g, s.x, s.y - 8, 20, 20, 0.3 * lit, 'rgba(255,120,150,1)');
  return { x: s.x, y: s.y - 17 };
};

const cinema: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  // two poster boxes (they light up), and the doors
  const posters: Win[] = [
    { f: 'y', u: 0.16, z: 8, w: 0.16, h: 16 },
    { f: 'y', u: 0.84, z: 8, w: 0.16, h: 16 },
    { f: 'x', u: 0.3, z: 8, w: 0.22, h: 16 },
    { f: 'x', u: 0.72, z: 8, w: 0.22, h: 16 },
  ];
  const inks = ['#ff8fab', '#7ad1c2', '#ffd76b', '#8fb8ff'];
  posters.forEach((w, i) => {
    const amount = windowAmount(lit, i, posters.length);
    poly(ctx, faceQuad(b, w.f, w.u - w.w / 2 - 0.02, w.u + w.w / 2 + 0.02, w.z - 1.5, w.z + w.h + 1.5), pal.ink('#fff3d6'));
    const q = faceQuad(b, w.f, w.u - w.w / 2, w.u + w.w / 2, w.z, w.z + w.h);
    poly(ctx, q, amount > 0.5 ? inks[i] : pal.ink(inks[i], -0.25));
    const c = midPt(q);
    oval(ctx, c.x, c.y - 1, 2.6, 2.6, amount > 0.5 ? '#ffffff' : pal.ink('#ffffff', -0.2));
    if (pal.night && amount > 0) glow(g, c.x, c.y, 20, 20, 0.4 * amount);
  });
  door(g, b, 'y', du, k.door, 0.24, 20);
  // the marquee: a cream board ringed with bulbs
  const m = faceQuad(b, 'y', 0.14, 0.86, 28, 41);
  const lift = (q: Pt): Pt => ({ x: q.x - 4, y: q.y + 2 });
  poly(ctx, m.map(lift), pal.ink('#fff3d6'), pal.ink(k.accent, -0.1), 1.5);
  for (let i = 0; i < 3; i++) {
    const a = lift(onFace(b, 'y', 0.26 + i * 0.2, 34.5));
    roundRect(ctx, a.x - 6, a.y - 1.4 + i * 0.1, 12, 2.6, 1.3);
    ctx.fillStyle = pal.ink(k.wall, -0.1);
    ctx.fill();
  }
  const n = 9;
  for (let i = 0; i <= n; i++) {
    for (const z of [28, 41]) {
      const q = lift(onFace(b, 'y', 0.14 + (0.72 * i) / n, z));
      const on = g.still ? true : (i + (z === 28 ? 0 : 1) + Math.floor(g.t * 2.5)) % 2 === 0;
      const bright = pal.night || lit > 0;
      oval(ctx, q.x, q.y, 1.6, 1.6, bright && on ? pal.windowCore : pal.ink(k.accent, -0.1));
      if (pal.night && on) glow(g, q.x, q.y, 7, 7, 0.45);
    }
  }
  // a film strip along the top of the walls
  for (const f of ['y', 'x'] as const) {
    poly(ctx, faceQuad(b, f, 0, 1, k.wallH - 7, k.wallH), pal.ink('#2b2350', f === 'x' ? -0.1 : 0));
    const holes = f === 'y' ? 12 : 8;
    for (let i = 0; i < holes; i++) {
      const u = (i + 0.5) / holes;
      poly(ctx, faceQuad(b, f, u - 0.018, u + 0.018, k.wallH - 5, k.wallH - 2), pal.ink('#fff3d6'));
    }
  }
  const top = flatRoof(g, b, k.wallH, k.roofH, k.roof);
  // a film reel on the roof
  const r = { x: top.x + 14, y: top.y - 12 };
  oval(ctx, r.x, r.y, 10, 10, pal.ink('#2b2350'));
  oval(ctx, r.x, r.y, 8, 8, pal.ink('#fff3d6'));
  const spin = g.still ? 0 : g.t * 0.6;
  for (let i = 0; i < 5; i++) {
    const a = spin + (i * Math.PI * 2) / 5;
    oval(ctx, r.x + Math.cos(a) * 4.6, r.y + Math.sin(a) * 4.6, 1.9, 1.9, pal.ink('#2b2350'));
  }
  oval(ctx, r.x, r.y, 1.4, 1.4, pal.ink('#2b2350'));
  return { x: top.x, y: top.y - 6 };
};

const phone: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  poly(ctx, faceQuad(b, 'y', 0, 1, k.wallH - 9, k.wallH), pal.ink(k.roof, 0.1));
  poly(ctx, faceQuad(b, 'x', 0, 1, k.wallH - 9, k.wallH), pal.ink(k.roof, -0.12));
  windows(
    g,
    b,
    [
      { f: 'x', u: 0.32, z: 7, w: 0.46, h: 17 },
      { f: 'y', u: 0.74, z: 9, w: 0.26, h: 14 },
    ],
    lit,
    '#dfe8f6',
  );
  door(g, b, 'x', du, '#9cc4ea', 0.18, 21);
  // the sign: a phone on the bright wall
  const s = onFace(b, 'y', 0.28, 18);
  roundRect(ctx, s.x - 5, s.y - 9, 10, 17, 2.6);
  ctx.fillStyle = pal.ink('#2b2f45');
  ctx.fill();
  roundRect(ctx, s.x - 3.6, s.y - 7.2, 7.2, 11.4, 1.2);
  ctx.fillStyle = lit > 0 ? pal.windowCore : pal.ink('#9cc4ea');
  ctx.fill();
  oval(ctx, s.x, s.y + 6, 0.9, 0.9, pal.ink('#ffffff'));
  if (pal.night && lit > 0) glow(g, s.x, s.y, 16, 18, 0.35);
  const top = flatRoof(g, b, k.wallH, k.roofH, k.roof);
  // the mast: a signal that pulses
  const m = { x: top.x - 6, y: top.y + 2 };
  line(ctx, [m, { x: m.x, y: m.y - 22 }], pal.ink(ART.iron), 1.6);
  oval(ctx, m.x, m.y - 23, 2.2, 2.2, pal.ink(k.accent, 0.2));
  for (let i = 0; i < 3; i++) {
    const k2 = g.still ? 1 : 0.35 + 0.65 * Math.max(0, Math.sin(g.t * 2.2 - i * 0.9));
    ctx.globalAlpha = k2;
    ctx.beginPath();
    ctx.arc(m.x, m.y - 23, 5 + i * 4, -Math.PI * 0.42, Math.PI * 0.08);
    ctx.strokeStyle = pal.night ? pal.windowCore : pal.ink(k.accent);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return { x: top.x + 6, y: top.y - 4 };
};

const park: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  const hr = k.wallH + k.roofH;
  const ym = (b.y0 + b.y1) / 2;
  const frame = pal.ink('#ffffff');
  // the plants inside, seen through the glass
  for (let i = 0; i < 7; i++) {
    const x = b.x0 + 0.25 + hash(i, 2) * (b.x1 - b.x0 - 0.5);
    const y = b.y0 + 0.25 + hash(i, 5) * (b.y1 - b.y0 - 0.5);
    const c = P(x, y, 8 + hash(i, 8) * 10);
    oval(ctx, c.x, c.y, 7, 7, pal.ink(i % 2 === 0 ? ART.leaf : ART.leafDark));
    oval(ctx, c.x + 2, c.y - 3, 2, 2, pal.ink(i % 3 === 0 ? '#f7a8c6' : '#ffd76b'));
  }
  const glassFill = (pts: Pt[], shade: number) => {
    ctx.globalAlpha = 0.62;
    poly(ctx, pts, pal.ink(k.wall, shade));
    ctx.globalAlpha = 1;
    if (lit > 0) {
      ctx.globalAlpha = 0.38 * lit;
      poly(ctx, pts, pal.windowLit);
      ctx.globalAlpha = 1;
    }
  };
  // low white wall, then glass
  isoBox(g, b.x0, b.y0, b.x1, b.y1, 0, 7, '#f4f1ea');
  glassFill(faceQuad(b, 'y', 0, 1, 7, k.wallH), 0);
  glassFill(faceQuad(b, 'x', 0, 1, 7, k.wallH), -0.14);
  glassFill([P(b.x1, b.y1, k.wallH), P(b.x1, b.y0, k.wallH), P(b.x1, ym, hr)], -0.14);
  for (const f of ['y', 'x'] as const) {
    for (let i = 0; i <= 4; i++) line(ctx, [onFace(b, f, i / 4, 7), onFace(b, f, i / 4, k.wallH)], frame, 1.3);
    line(ctx, [onFace(b, f, 0, k.wallH), onFace(b, f, 1, k.wallH)], frame, 1.6);
  }
  // door
  poly(ctx, faceQuad(b, 'y', du - 0.1, du + 0.1, 0, 19), frame);
  poly(ctx, faceQuad(b, 'y', du - 0.07, du + 0.07, 2, 17), pal.ink(k.wall, -0.1));
  // glass roof
  const r1 = P(b.x0, ym, hr);
  const r2 = P(b.x1, ym, hr);
  const D = P(b.x0, b.y1, k.wallH);
  const C = P(b.x1, b.y1, k.wallH);
  const B = P(b.x1, b.y0, k.wallH);
  glassFill([D, C, r2, r1], 0.2);
  for (let i = 0; i <= 4; i++) line(ctx, [lerpPt(D, C, i / 4), lerpPt(r1, r2, i / 4)], frame, 1.3);
  line(ctx, [r1, r2], frame, 2);
  line(ctx, [C, r2, B], frame, 1.6);
  if (pal.night && lit > 0) glow(g, (D.x + B.x) / 2, (D.y + B.y) / 2 - 10, 60, 40, 0.4 * lit);
  // climbing roses over the door
  for (let i = 0; i < 5; i++) {
    const q = onFace(b, 'y', du - 0.14 + i * 0.07, 20 + Math.sin(i * 1.3) * 2);
    oval(ctx, q.x, q.y, 2.6, 2.4, pal.ink(i % 2 === 0 ? '#f7a8c6' : ART.leaf));
  }
  return { x: (r1.x + r2.x) / 2, y: r1.y };
};

const board: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  walls(g, b, k.wallH, k.wall);
  windows(
    g,
    b,
    [
      { f: 'x', u: 0.32, z: 10, w: 0.24, h: 12 },
      { f: 'x', u: 0.72, z: 10, w: 0.24, h: 12 },
    ],
    lit,
  );
  door(g, b, 'y', du, k.door, 0.18, 19);
  // the notice board: cork in a wooden frame, coloured notes pinned on it
  const u0 = 0.4;
  const u1 = 0.95;
  poly(ctx, faceQuad(b, 'y', u0 - 0.03, u1 + 0.03, 6.5, 27.5), pal.ink(ART.woodDark));
  poly(ctx, faceQuad(b, 'y', u0, u1, 8, 26), pal.ink(k.accent, 0.1));
  const notes: [number, number, string][] = [
    [0.47, 18, '#ffffff'],
    [0.6, 19.5, '#ffd76b'],
    [0.74, 17.5, '#f7a8c6'],
    [0.87, 19, '#a9dcff'],
    [0.52, 10, '#c9f0b4'],
    [0.67, 10.5, '#ffffff'],
    [0.82, 9.5, '#ffd76b'],
  ];
  for (const [u, z, c] of notes) {
    poly(ctx, faceQuad(b, 'y', u - 0.045, u + 0.045, z, z + 6), pal.ink(c));
    const pin = onFace(b, 'y', u, z + 5.4);
    oval(ctx, pin.x, pin.y, 0.9, 0.9, pal.ink('#ef5d7a'));
  }
  // a lamp over the board
  const l = onFace(b, 'y', (u0 + u1) / 2, 30);
  line(ctx, [l, { x: l.x - 4, y: l.y + 1 }], pal.ink(ART.iron), 1.4);
  oval(ctx, l.x - 5, l.y + 2, 2.4, 1.8, pal.night ? pal.lampOn : pal.ink(ART.cream));
  if (pal.night) glow(g, l.x - 6, l.y + 8, 26, 22, 0.42);
  return roof(g, b, k.wallH, k.roofH, k.roof, 'gableX', k.wall);
};

const square: Painter = (g, p, b, k, lit) => {
  const { ctx, pal } = g;
  const du = doorU(p, b);
  const deck = 6;
  // the raised wooden floor, with two steps towards the plaza
  isoBox(g, b.x0, b.y0, b.x1, b.y1, 0, deck, '#d8b48a', '#ecd2ac');
  const sx0 = b.x0 + (du - 0.16) * (b.x1 - b.x0);
  const sx1 = b.x0 + (du + 0.16) * (b.x1 - b.x0);
  isoBox(g, sx0, b.y1, sx1, b.y1 + 0.14, 0, 3, '#d8b48a', '#ecd2ac');
  const post = (x: number, y: number) => isoBox(g, x - 0.05, y - 0.05, x + 0.05, y + 0.05, deck, k.wallH, '#fffaf0');
  const rail = (a: Pt, c: Pt) => {
    line(ctx, [a, c], pal.ink('#fffaf0', -0.1), 1.8);
    for (let i = 1; i < 6; i++) {
      const q = lerpPt(a, c, i / 6);
      line(ctx, [q, { x: q.x, y: q.y + 7 }], pal.ink('#fffaf0', -0.1), 1.1);
    }
  };
  const i = 0.07;
  // back rails and posts first
  rail(P(b.x0 + i, b.y0 + i, deck + 8), P(b.x1 - i, b.y0 + i, deck + 8));
  rail(P(b.x0 + i, b.y0 + i, deck + 8), P(b.x0 + i, b.y1 - i, deck + 8));
  post(b.x0 + i, b.y0 + i);
  post(b.x1 - i, b.y0 + i);
  post(b.x0 + i, b.y1 - i);
  // the side rail (the front stays open for the steps)
  rail(P(b.x1 - i, b.y1 - i, deck + 8), P(b.x1 - i, b.y0 + i, deck + 8));
  post(b.x1 - i, b.y1 - i);
  // lanterns hanging under the eaves: these are the pavilion's "windows"
  const spots: Pt[] = [onFace(b, 'y', 0.25, k.wallH - 8), onFace(b, 'y', 0.75, k.wallH - 8), onFace(b, 'x', 0.25, k.wallH - 8), onFace(b, 'x', 0.75, k.wallH - 8)];
  const lantern = (q: Pt, amount: number) => {
    line(ctx, [{ x: q.x, y: q.y - 6 }, q], pal.ink(ART.iron), 1);
    roundRect(ctx, q.x - 3, q.y, 6, 7.5, 2.4);
    ctx.fillStyle = pal.ink('#ef6b5b', -0.1);
    ctx.fill();
    if (amount > 0) {
      ctx.globalAlpha = amount;
      roundRect(ctx, q.x - 3, q.y, 6, 7.5, 2.4);
      ctx.fillStyle = pal.windowLit;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (pal.night) glow(g, q.x, q.y + 4, 20, 20, 0.55 * amount);
    }
  };
  const top = roof(g, b, k.wallH, k.roofH, k.roof, 'hip', k.wall, 0.2);
  spots.forEach((q, n) => lantern(q, windowAmount(lit, n, spots.length)));
  // a cream scalloped trim along the two front eaves
  const he = k.wallH - 3;
  const o = 0.2;
  const C = P(b.x1 + o, b.y1 + o, he);
  const D = P(b.x0 - o, b.y1 + o, he);
  const B = P(b.x1 + o, b.y0 - o, he);
  for (let n = 0; n < 9; n++) {
    const q = lerpPt(D, C, (n + 0.5) / 9);
    oval(ctx, q.x, q.y + 1.5, 3.4, 2.6, pal.ink('#fffaf0'));
    const q2 = lerpPt(C, B, (n + 0.5) / 9);
    oval(ctx, q2.x, q2.y + 1.5, 3.4, 2.6, pal.ink('#fffaf0', -0.14));
  }
  // the finial
  line(ctx, [top, { x: top.x, y: top.y - 7 }], pal.ink(ART.iron), 1.6);
  oval(ctx, top.x, top.y - 9, 3, 3, pal.ink('#ffc93c'));
  return { x: top.x, y: top.y - 11 };
};

const PAINTERS: Readonly<Record<PlaceId, Painter>> = { square, cafe, friend, home, shop, office, school, station, clinic, cinema, phone, park, board };

/** Where string lights can be tied on the pavilion: the top of its roof, in world pixels. */
export function pavilionTop(p: WorldPlace): Pt {
  const k = PLACE_LOOK[p.id];
  return P(p.x + p.w / 2, p.y + p.d / 2, k.wallH + k.roofH + 6);
}

/** The shadow a house (or a lot's fence) throws on the ground, to the right: light comes from the top-left. */
export function drawPlaceShadow(g: G, p: WorldPlace, built: boolean): void {
  const b = boxOf(p);
  const k = PLACE_LOOK[p.id];
  const reach = built ? Math.min(1, (k.wallH + k.roofH * 0.5) / 62) : 0.12;
  poly(g.ctx, [P(b.x0 + reach * 0.4, b.y0), P(b.x1 + reach, b.y0 + 0.08), P(b.x1 + reach, b.y1 + 0.06), P(b.x0, b.y1 + 0.06)], g.pal.shadow);
}

/** A built place. `hover`: the pointer is on it. */
export function drawPlace(g: G, p: WorldPlace, lit: number, hover: boolean): void {
  const b = boxOf(p);
  const k = PLACE_LOOK[p.id];
  const amount = Math.max(0, Math.min(1, lit));
  const top = PAINTERS[p.id](g, p, b, k, amount);
  if (amount >= 1) star(g, top);
  if (hover) {
    // a soft light on the doorstep
    const d = P(p.door.x + 0.5, p.door.y + 0.5);
    oval(g.ctx, d.x, d.y, 26, 13, g.pal.hover);
  }
}

/** An empty lot: a fenced plot of bare earth with a signpost in the place's colour. */
export function drawLot(g: G, p: WorldPlace, hover: boolean): void {
  const { ctx, pal } = g;
  const k = PLACE_LOOK[p.id];
  const i = 0.14;
  const b: Box = { x0: p.x + i, y0: p.y + i, x1: p.x + p.w - i, y1: p.y + p.d - i };
  // bare earth with a few furrows
  poly(ctx, [P(b.x0, b.y0), P(b.x1, b.y0), P(b.x1, b.y1), P(b.x0, b.y1)], pal.ink('#dcc197'));
  poly(ctx, [P(b.x0 + 0.12, b.y0 + 0.12), P(b.x1 - 0.12, b.y0 + 0.12), P(b.x1 - 0.12, b.y1 - 0.12), P(b.x0 + 0.12, b.y1 - 0.12)], pal.ink('#e8d2ac'));
  for (let n = 1; n < p.w * 2; n++) {
    const x = b.x0 + (n / (p.w * 2)) * (b.x1 - b.x0);
    ctx.globalAlpha = 0.5;
    line(ctx, [P(x, b.y0 + 0.3), P(x, b.y1 - 0.3)], pal.ink('#cdb082'), 1.4);
    ctx.globalAlpha = 1;
  }
  const wood = pal.ink('#f6ead2');
  const woodShade = pal.ink('#f6ead2', -0.18);
  const du = doorU(p, b);
  const fence = (f: 'back-y' | 'back-x' | Face) => {
    const steps = Math.round((f === 'y' || f === 'back-y' ? p.w : p.d) * 3);
    const at = (u: number, z: number): Pt => {
      if (f === 'y') return onFace(b, 'y', u, z);
      if (f === 'x') return onFace(b, 'x', u, z);
      if (f === 'back-y') return P(b.x0 + u * (b.x1 - b.x0), b.y0, z);
      return P(b.x0, b.y1 - u * (b.y1 - b.y0), z);
    };
    const gate = f === p.face ? du : -1;
    for (let n = 0; n < steps; n++) {
      const u0 = n / steps;
      const u1 = (n + 1) / steps;
      // leave the gate open
      if (gate >= u0 && gate <= u1) continue;
      for (const z of [5, 10]) line(ctx, [at(u0, z), at(u1, z)], f === 'x' || f === 'back-x' ? woodShade : wood, 1.8);
    }
    for (let n = 0; n <= steps; n++) {
      const u = n / steps;
      const a = at(u, 0);
      const c = at(u, 13);
      line(ctx, [a, c], f === 'x' || f === 'back-x' ? woodShade : wood, 2.4);
    }
  };
  fence('back-y');
  fence('back-x');
  // things waiting to be built with; every lot has its own little heap
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const kind = (p.x * 3 + p.y * 5) % 3;
  if (kind === 0) {
    // bricks and planks
    isoBox(g, cx - 0.42, cy - 0.3, cx - 0.06, cy - 0.06, 0, 5, '#d98c6a');
    isoBox(g, cx - 0.36, cy - 0.26, cx - 0.12, cy - 0.1, 5, 9, '#e39b78');
    isoBox(g, cx + 0.1, cy + 0.05, cx + 0.62, cy + 0.17, 0, 3, ART.wood);
    isoBox(g, cx + 0.16, cy + 0.2, cx + 0.68, cy + 0.32, 0, 3, '#c79463');
  } else if (kind === 1) {
    // a heap of sand with a spade in it, and a bucket
    const s0 = P(cx - 0.2, cy - 0.1);
    oval(ctx, s0.x, s0.y, 19, 9, pal.ink('#e6cf9a'));
    ctx.beginPath();
    ctx.moveTo(s0.x - 17, s0.y);
    ctx.quadraticCurveTo(s0.x - 2, s0.y - 24, s0.x + 17, s0.y);
    ctx.closePath();
    ctx.fillStyle = pal.ink('#f0dcaa');
    ctx.fill();
    line(ctx, [{ x: s0.x + 5, y: s0.y - 8 }, { x: s0.x + 13, y: s0.y - 27 }], pal.ink(ART.woodDark), 2);
    line(ctx, [{ x: s0.x + 10.5, y: s0.y - 27.5 }, { x: s0.x + 15.5, y: s0.y - 26 }], pal.ink(ART.woodDark), 2.2);
    const bk = P(cx + 0.42, cy + 0.22);
    roundRect(ctx, bk.x - 5, bk.y - 9, 10, 10, 2.4);
    ctx.fillStyle = pal.ink('#7fb6e6');
    ctx.fill();
    oval(ctx, bk.x, bk.y - 9, 5, 2.2, pal.ink('#a9d2f5'));
  } else {
    // a barrel, a crate and a young tree somebody already planted
    const br = P(cx - 0.34, cy - 0.16);
    roundRect(ctx, br.x - 6.5, br.y - 14, 13, 15, 3.4);
    ctx.fillStyle = pal.ink(ART.wood);
    ctx.fill();
    line(ctx, [{ x: br.x - 6.5, y: br.y - 9.5 }, { x: br.x + 6.5, y: br.y - 9.5 }], pal.ink(ART.woodDark), 1.4);
    line(ctx, [{ x: br.x - 6.5, y: br.y - 3.5 }, { x: br.x + 6.5, y: br.y - 3.5 }], pal.ink(ART.woodDark), 1.4);
    oval(ctx, br.x, br.y - 14, 6.5, 2.8, pal.ink(ART.wood, 0.3));
    isoBox(g, cx + 0.14, cy - 0.3, cx + 0.44, cy, 0, 8, '#d9a877');
    const sp = P(cx + 0.36, cy + 0.34);
    line(ctx, [sp, { x: sp.x, y: sp.y - 14 }], pal.ink(ART.trunk), 1.8);
    oval(ctx, sp.x, sp.y - 17, 6, 6, pal.ink(ART.leafDark));
    oval(ctx, sp.x - 1, sp.y - 18, 5, 5, pal.ink(ART.leaf));
  }
  // weeds have moved in
  for (let n = 0; n < 4; n++) {
    const w = P(b.x0 + 0.2 + hash(p.x, p.y, n) * (b.x1 - b.x0 - 0.4), b.y0 + 0.2 + hash(p.y, p.x, n + 9) * (b.y1 - b.y0 - 0.4));
    line(ctx, [{ x: w.x - 2.2, y: w.y - 3.2 }, { x: w.x - 0.4, y: w.y }, { x: w.x, y: w.y - 4.4 }, { x: w.x + 0.4, y: w.y }, { x: w.x + 2.2, y: w.y - 3.2 }], pal.ink(ART.tuft), 1.1);
  }
  fence('y');
  fence('x');
  // the signpost by the gate, in the colour the place will have
  const s = onFace(b, p.face, Math.min(0.92, du + (p.face === 'y' ? 0.24 : -0.24)), 0);
  const out = p.face === 'y' ? { x: -6, y: 3 } : { x: 6, y: 3 };
  const base = { x: s.x + out.x, y: s.y + out.y };
  const bob = hover && !g.still ? Math.sin(g.t * 5) * 1.2 : 0;
  line(ctx, [base, { x: base.x, y: base.y - 22 }], pal.ink(ART.woodDark), 2.2);
  if (pal.night) glow(g, base.x, base.y - 27, 20, 18, hover ? 0.5 : 0.22);
  roundRect(ctx, base.x - 11, base.y - 36 + bob, 22, 16, 4);
  ctx.fillStyle = pal.ink(hover ? '#ffffff' : '#fffaf0');
  ctx.fill();
  ctx.strokeStyle = pal.ink(k.roof);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // a plus: something can be built here
  ctx.fillStyle = pal.ink(k.roof, -0.05);
  ctx.fillRect(base.x - 1.3, base.y - 33 + bob, 2.6, 10);
  ctx.fillRect(base.x - 5, base.y - 29.3 + bob, 10, 2.6);
}
