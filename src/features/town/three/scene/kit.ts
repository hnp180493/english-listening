// The building kit of the 3D town: walls, roofs, doors, windows, awnings, signs… as rounded pieces added to three
// merges (the body, the window glass that glows at night, the bulbs). Every house is built at its own origin with
// its door facing local +Z; places3d.ts turns it to its face and puts it on its lot.

import { ConeGeometry, ExtrudeGeometry, Shape, type ColorRepresentation } from 'three';
import { Merge, shapes, type Paint, type Place } from './merge';
import { C } from './palette3d';

export interface Kit {
  body: Merge;
  glass: Merge;
  bulbs: Merge;
  /** Width along local X (the door's face) and depth along local Z of the walls. */
  W: number;
  D: number;
}

export function newKit(W: number, D: number): Kit {
  return { body: new Merge(), glass: new Merge(), bulbs: new Merge(), W, D };
}

export type Face = 'front' | 'back' | 'left' | 'right';

/** A spot on one of the walls: `u` along the wall (from its middle, to the right seen from outside), `v` up, `out` off it. */
export function onFace(k: Pick<Kit, 'W' | 'D'>, face: Face, u: number, v: number, out = 0): Place {
  switch (face) {
    case 'front':
      return { x: u, y: v, z: k.D / 2 + out, ry: 0 };
    case 'back':
      return { x: -u, y: v, z: -k.D / 2 - out, ry: Math.PI };
    case 'right':
      return { x: k.W / 2 + out, y: v, z: -u, ry: Math.PI / 2 };
    case 'left':
      return { x: -k.W / 2 - out, y: v, z: u, ry: -Math.PI / 2 };
  }
}

/** A piece placed relative to a face spot: offsets (along, up, out) in the face's own frame. */
export function rel(p: Place, along: number, up: number, out: number, extra: Place = {}): Place {
  const ry = p.ry ?? 0;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  // the face's own frame: along = its local X, out = its local Z, turned by ry
  return {
    ...extra,
    x: (p.x ?? 0) + along * c + out * s,
    y: (p.y ?? 0) + up,
    z: (p.z ?? 0) - along * s + out * c,
    ry: ry + (extra.ry ?? 0),
  };
}

/** The walls: a rounded box from y0 up by h, with a stone plinth. */
export function walls(k: Kit, h: number, color: ColorRepresentation, o: { y0?: number; plinth?: ColorRepresentation; r?: number } = {}): void {
  const y0 = o.y0 ?? 0;
  k.body.add(shapes.box(k.W, h, k.D, o.r ?? 0.07, 2), color, { y: y0 + h / 2 });
  if (o.plinth !== undefined && y0 === 0) k.body.add(shapes.box(k.W + 0.08, 0.14, k.D + 0.08, 0.05, 2), o.plinth, { y: 0.07 });
}

/** A triangle (base `span`, height `h`) extruded `len` long along local X, base at y = 0, centred. */
function prism(span: number, h: number, len: number) {
  return shapes.custom(`prism${span.toFixed(3)},${h.toFixed(3)},${len.toFixed(3)}`, () => {
    const s = new Shape();
    s.moveTo(-span / 2, 0);
    s.lineTo(span / 2, 0);
    s.lineTo(0, h);
    s.lineTo(-span / 2, 0);
    const g = new ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    // extruded along +Z: turn so it runs along X, then centre it
    g.rotateY(Math.PI / 2);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-(b.min.x + b.max.x) / 2, 0, -(b.min.z + b.max.z) / 2);
    return g;
  });
}

/**
 * A gable roof on walls of height `y`: the ridge along local X ('x': slopes to the front and back) or along Z ('z':
 * the gable faces the front). Thick rounded slabs with eaves, the gable ends filled in the wall's colour, a ridge cap.
 */
export function gableRoof(k: Kit, y: number, rise: number, color: ColorRepresentation, o: { ridge?: 'x' | 'z'; wall?: ColorRepresentation; over?: number; t?: number; cap?: ColorRepresentation } = {}): number {
  const ridge = o.ridge ?? 'x';
  const over = o.over ?? 0.14;
  const t = o.t ?? 0.09;
  const len = (ridge === 'x' ? k.W : k.D) + over * 2;
  const half = (ridge === 'x' ? k.D : k.W) / 2;
  const a = Math.atan2(rise, half);
  // each slope runs from the ridge past the wall to the eave
  const run = half + over;
  const L = run / Math.cos(a) + t * Math.tan(a);
  const mid = run / 2;
  const midY = y + rise - mid * Math.tan(a);
  // the gable ends (in the walls' colour)
  if (o.wall !== undefined) k.body.add(prism(half * 2, rise, ridge === 'x' ? k.W - 0.02 : k.D - 0.02), o.wall, { y, ry: ridge === 'x' ? 0 : Math.PI / 2 }, { ao: false });
  for (const side of [1, -1]) {
    // the slab's middle on the slope's middle, lifted by half its thickness along its normal
    const out = side * (mid + Math.sin(a) * (t / 2));
    const up = midY + Math.cos(a) * (t / 2);
    const place: Place = ridge === 'x' ? { x: 0, y: up, z: out, rx: side * a } : { x: out, y: up, z: 0, rz: -side * a };
    k.body.add(shapes.box(ridge === 'x' ? len : L, t, ridge === 'x' ? L : len, 0.035, 2), color, place, { ao: false });
  }
  // the ridge cap
  k.body.add(shapes.cyl(t * 0.75, t * 0.75, len + 0.02, 10), o.cap ?? color, ridge === 'x' ? { y: y + rise + t * 0.55, rz: Math.PI / 2 } : { y: y + rise + t * 0.55, rx: Math.PI / 2 }, { ao: false, shade: -0.08 });
  return y + rise + t;
}

/** A square pyramid of side 1 and height 1, centred on the origin (scale it to any box). */
export function pyramid() {
  return shapes.custom('pyramid', () => new ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4), true);
}

/** A four-sided (hip) roof: a low pyramid with eaves. Returns its top. */
export function hipRoof(k: Kit, y: number, rise: number, color: ColorRepresentation, over = 0.14): number {
  k.body.add(pyramid(), color, { y: y + rise / 2, s: [k.W + over * 2, rise, k.D + over * 2] }, { ao: false });
  k.body.add(shapes.box(k.W + over * 2, 0.08, k.D + over * 2, 0.035, 2), color, { y: y + 0.02 }, { ao: false, shade: -0.06 });
  return y + rise;
}

/** A flat roof with a rounded parapet. Returns its top. */
export function flatRoof(k: Kit, y: number, color: ColorRepresentation, o: { ledge?: ColorRepresentation; h?: number } = {}): number {
  const h = o.h ?? 0.16;
  k.body.add(shapes.box(k.W + 0.12, 0.1, k.D + 0.12, 0.04, 2), o.ledge ?? C.trim, { y: y + 0.05 }, { ao: false });
  k.body.add(shapes.box(k.W - 0.12, 0.05, k.D - 0.12, 0.02, 1), color, { y: y + 0.11 }, { ao: false, shade: -0.05 });
  // the parapet: four low walls
  const t = 0.08;
  k.body.add(shapes.box(k.W + 0.12, h, t, 0.03, 1), o.ledge ?? C.trim, { y: y + 0.1 + h / 2, z: k.D / 2 + 0.02 }, { ao: false });
  k.body.add(shapes.box(k.W + 0.12, h, t, 0.03, 1), o.ledge ?? C.trim, { y: y + 0.1 + h / 2, z: -k.D / 2 - 0.02 }, { ao: false });
  k.body.add(shapes.box(t, h, k.D + 0.12, 0.03, 1), o.ledge ?? C.trim, { y: y + 0.1 + h / 2, x: k.W / 2 + 0.02 }, { ao: false });
  k.body.add(shapes.box(t, h, k.D + 0.12, 0.03, 1), o.ledge ?? C.trim, { y: y + 0.1 + h / 2, x: -k.W / 2 - 0.02 }, { ao: false });
  return y + 0.1 + h;
}

/** A door on the front at `u`: frame, panel, knob, a step, an optional little lamp over it. */
export function door(k: Kit, u: number, o: { color?: ColorRepresentation; w?: number; h?: number; lamp?: boolean; glass?: boolean; face?: Face } = {}): void {
  const w = o.w ?? 0.36;
  const h = o.h ?? 0.64;
  const f = onFace(k, o.face ?? 'front', u, 0, 0);
  k.body.add(shapes.box(w + 0.1, h + 0.06, 0.06, 0.025, 1), C.trim, rel(f, 0, (h + 0.06) / 2 + 0.02, 0.02), { ao: false });
  k.body.add(shapes.box(w, h, 0.06, 0.03, 2), o.color ?? C.door, rel(f, 0, h / 2 + 0.02, 0.045));
  if (o.glass) k.glass.add(shapes.box(w * 0.55, h * 0.35, 0.02), C.glass, rel(f, 0, h * 0.72, 0.08));
  k.body.add(shapes.sphere(0.025, 6, 4), C.mustard, rel(f, w * 0.32, h * 0.48, 0.09), { ao: false });
  k.body.add(shapes.box(w + 0.22, 0.06, 0.24, 0.025, 1), C.stone, rel(f, 0, 0.03, 0.12));
  if (o.lamp) {
    k.body.add(shapes.box(0.05, 0.05, 0.08), C.metal, rel(f, w / 2 + 0.12, h + 0.06, 0.05), { ao: false });
    k.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, rel(f, w / 2 + 0.12, h + 0.02, 0.1));
  }
}

/** A window on a face: frame, glass (glows at night), a cross of glazing bars, maybe shutters and a flower box. */
export function windowOn(k: Kit, face: Face, u: number, v: number, o: { w?: number; h?: number; shutters?: ColorRepresentation; flowers?: boolean; round?: boolean; frame?: ColorRepresentation; bars?: boolean } = {}): void {
  const w = o.w ?? 0.3;
  const h = o.h ?? 0.34;
  const f = onFace(k, face, u, v, 0);
  const frame = o.frame ?? C.trim;
  if (o.round) {
    k.body.add(shapes.torus(w / 2, 0.035, 18), frame, rel(f, 0, 0, 0.03), { ao: false });
    k.glass.add(shapes.cyl(w / 2, w / 2, 0.03, 18), C.glass, rel(f, 0, 0, 0.02, { rx: Math.PI / 2 }));
    k.body.add(shapes.box(0.025, w, 0.03), frame, rel(f, 0, 0, 0.045), { ao: false });
    return;
  }
  k.body.add(shapes.box(w + 0.08, h + 0.08, 0.05, 0.02, 1), frame, rel(f, 0, 0, 0.02), { ao: false });
  k.glass.add(shapes.box(w, h, 0.03, 0.01, 1), C.glass, rel(f, 0, 0, 0.04));
  if (o.bars !== false) {
    k.body.add(shapes.box(0.022, h, 0.025), frame, rel(f, 0, 0, 0.06), { ao: false });
    k.body.add(shapes.box(w, 0.022, 0.025), frame, rel(f, 0, 0, 0.06), { ao: false });
  }
  k.body.add(shapes.box(w + 0.14, 0.035, 0.08, 0.015, 1), frame, rel(f, 0, -h / 2 - 0.05, 0.05), { ao: false });
  if (o.shutters !== undefined) {
    for (const s of [-1, 1]) k.body.add(shapes.box(w * 0.42, h + 0.04, 0.03, 0.012, 1), o.shutters, rel(f, s * (w / 2 + w * 0.25 + 0.05), 0, 0.03), { ao: false });
  }
  if (o.flowers) flowerBox(k, f, w + 0.06, -h / 2 - 0.1);
}

const FLOWER_DOTS = ['#ff8fab', '#ffd166', '#ffffff', '#c3a6ff', '#ff9f68'];

/** A box of flowers under a window (or anywhere on a face). */
export function flowerBox(k: Kit, f: Place, w: number, v: number): void {
  k.body.add(shapes.box(w, 0.09, 0.12, 0.025, 1), C.woodDark, rel(f, 0, v, 0.08));
  const n = Math.max(3, Math.round(w / 0.08));
  for (let i = 0; i < n; i++) {
    const a = -w / 2 + 0.05 + (i * (w - 0.1)) / Math.max(1, n - 1);
    k.body.add(shapes.sphere(0.04, 6, 5), i % 2 ? C.leaf : C.leafDeep, rel(f, a, v + 0.06, 0.08), { ao: false });
    if (i % 2 === 0) k.body.add(shapes.sphere(0.028, 6, 4), FLOWER_DOTS[(i / 2) % FLOWER_DOTS.length], rel(f, a + 0.01, v + 0.1, 0.11), { ao: false });
  }
}

/** A striped awning over the front at height `v` (stripes across its width). */
export function awning(k: Kit, u: number, v: number, w: number, a: ColorRepresentation, b: ColorRepresentation, depth = 0.34, face: Face = 'front'): void {
  const f = onFace(k, face, u, v, 0);
  const n = Math.max(3, Math.round(w / 0.12)) | 1;
  const sw = w / n;
  const tilt = 0.42;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + sw * (i + 0.5);
    k.body.add(shapes.box(sw + 0.002, 0.04, depth, 0.015, 1), i % 2 ? b : a, rel(f, x, -Math.sin(tilt) * depth * 0.5, Math.cos(tilt) * depth * 0.5, { rx: tilt }), { ao: false });
    // the scalloped edge
    k.body.add(shapes.sphere(sw * 0.5, 8, 5), i % 2 ? b : a, rel(f, x, -Math.sin(tilt) * depth - 0.01, Math.cos(tilt) * depth, { s: [1, 0.55, 0.4] }), { ao: false });
  }
}

/** A sign board on the front at height v: a rounded plate with a border; returns its placement. */
export function signBoard(k: Kit, u: number, v: number, w: number, h: number, color: ColorRepresentation, border: ColorRepresentation = C.trim, face: Face = 'front'): Place {
  const f = onFace(k, face, u, v, 0);
  k.body.add(shapes.box(w + 0.06, h + 0.06, 0.05, 0.03, 2), border, rel(f, 0, 0, 0.03), { ao: false });
  k.body.add(shapes.box(w, h, 0.05, 0.025, 2), color, rel(f, 0, 0, 0.05), { ao: false });
  return rel(f, 0, 0, 0.08);
}

/** A chimney standing on the roof. */
export function chimney(k: Kit, x: number, z: number, y: number, h = 0.5, color: ColorRepresentation = C.coral): void {
  k.body.add(shapes.box(0.2, h, 0.2, 0.03, 1), color, { x, y: y + h / 2, z }, { ao: false });
  k.body.add(shapes.box(0.26, 0.07, 0.26, 0.03, 1), C.stoneDark, { x, y: y + h, z }, { ao: false });
}

/** A potted plant at a spot (on the ground beside a door). */
export function pot(m: Merge, x: number, z: number, y = 0, color: ColorRepresentation = C.coral, paint: Paint = {}): void {
  m.add(shapes.cyl(0.09, 0.07, 0.14, 10), color, { x, y: y + 0.07, z }, paint);
  m.add(shapes.sphere(0.12, 10, 8), C.leaf, { x, y: y + 0.2, z }, { ao: false });
  m.add(shapes.sphere(0.035, 6, 4), '#ff8fab', { x: x + 0.05, y: y + 0.28, z: z + 0.04 }, { ao: false });
}

/** A small wooden crate of fruit. */
export function crate(m: Merge, p: Place, fruit: ColorRepresentation): void {
  m.add(shapes.box(0.26, 0.15, 0.2, 0.02, 1), C.woodLight, { ...p, y: (p.y ?? 0) + 0.075 });
  for (let i = 0; i < 4; i++) {
    const dx = (i % 2 ? 0.055 : -0.055) * Math.cos(p.ry ?? 0);
    const dz = (i < 2 ? 0.045 : -0.045) * 1;
    m.add(shapes.sphere(0.055, 8, 6), fruit, { x: (p.x ?? 0) + dx, y: (p.y ?? 0) + 0.17, z: (p.z ?? 0) + dz }, { ao: false });
  }
}
