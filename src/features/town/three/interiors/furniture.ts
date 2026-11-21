// Furniture of the rooms, in the town's soft rounded style: chairs, stools, tables, counters, sofas, shelves, lamps,
// plants, rugs, cups… Each piece is merged into the room's furniture (casts shadows), marks its footprint and, for
// seats, gives the sit anchor. `heading` = where its front (or a sitter) faces, radians from +X towards +Z.

import type { ColorRepresentation } from 'three';
import type { RoomAnchor } from './contracts';
import { COUNTER, frame, ryFor, SEAT, TABLE, type Put, type Room } from './build';
import { shapes, type Merge } from '../scene/merge';
import { C } from '../scene/palette3d';

const LEAVES = [C.leaf, C.leafDeep, C.pine] as const;

/** A chair: seat, back, four legs. Returns its sit anchor. */
export function chair(r: Room, x: number, z: number, heading: number, color: ColorRepresentation, o: { legs?: ColorRepresentation; cushion?: ColorRepresentation; back?: boolean } = {}): RoomAnchor {
  const p = frame(x, z, ryFor(heading));
  const m = r.furn;
  const legs = o.legs ?? C.woodDark;
  m.add(shapes.box(0.26, 0.04, 0.24, 0.015, 1), color, p(0, SEAT - 0.02, 0));
  if (o.cushion !== undefined) m.add(shapes.box(0.22, 0.03, 0.2, 0.014, 1), o.cushion, p(0, SEAT + 0.005, 0.01), { ao: false });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.add(shapes.box(0.03, SEAT - 0.04, 0.03, 0.008, 1), legs, p(sx * 0.105, (SEAT - 0.04) / 2, sz * 0.095));
  if (o.back !== false) {
    m.add(shapes.box(0.26, 0.2, 0.035, 0.015, 1), color, p(0, SEAT + 0.15, -0.11, { rx: -0.08 }), { ao: false });
    for (const sx of [-1, 1]) m.add(shapes.box(0.03, 0.2, 0.03, 0.008, 1), legs, p(sx * 0.105, SEAT + 0.08, -0.105), { ao: false });
  }
  r.block(x, z, 0.14, 0.13, 'chair', ryFor(heading));
  return r.seat(x, z, heading);
}

/** A round stool (bar or café). Returns its sit anchor. */
export function stool(r: Room, x: number, z: number, heading: number, color: ColorRepresentation, seatY = SEAT): RoomAnchor {
  const m = r.furn;
  m.add(shapes.cyl(0.11, 0.1, 0.04, 14), color, { x, y: seatY - 0.02, z });
  m.add(shapes.cyl(0.02, 0.03, seatY - 0.04, 8), C.metal, { x, y: (seatY - 0.04) / 2, z });
  m.add(shapes.cyl(0.08, 0.09, 0.02, 12), C.metal, { x, y: 0.01, z }, { ao: false });
  r.block(x, z, 0.11, 0.11, 'stool');
  return r.seat(x, z, heading, seatY);
}

/** A round table on one foot. */
export function roundTable(r: Room, x: number, z: number, radius: number, top: ColorRepresentation, o: { foot?: ColorRepresentation; h?: number; cloth?: ColorRepresentation } = {}): void {
  const h = o.h ?? TABLE;
  const m = r.furn;
  m.add(shapes.cyl(radius, radius, 0.035, 20), top, { x, y: h - 0.018, z });
  if (o.cloth !== undefined) m.add(shapes.cyl(radius * 0.98, radius * 1.04, 0.12, 20), o.cloth, { x, y: h - 0.07, z }, { ao: false });
  m.add(shapes.cyl(0.025, 0.035, h - 0.03, 8), o.foot ?? C.metal, { x, y: (h - 0.03) / 2, z });
  m.add(shapes.cyl(0.1, 0.12, 0.025, 12), o.foot ?? C.metal, { x, y: 0.013, z }, { ao: false });
  r.block(x, z, radius, radius, 'table');
}

/** A rectangular table on four legs (w along its local X, d along its front). */
export function table(r: Room, x: number, z: number, w: number, d: number, ry: number, top: ColorRepresentation, o: { legs?: ColorRepresentation; h?: number; apron?: boolean } = {}): Put {
  const h = o.h ?? TABLE;
  const p = frame(x, z, ry);
  const m = r.furn;
  m.add(shapes.box(w, 0.04, d, 0.015, 1), top, p(0, h - 0.02, 0));
  if (o.apron !== false) m.add(shapes.box(w - 0.06, 0.05, d - 0.06, 0.01, 1), o.legs ?? top, p(0, h - 0.06, 0), { shade: -0.08 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.box(0.035, h - 0.04, 0.035, 0.008, 1), o.legs ?? C.woodDark, p(sx * (w / 2 - 0.04), (h - 0.04) / 2, sz * (d / 2 - 0.04)));
  r.block(x, z, w / 2, d / 2, 'table', ry);
  return frame(x, z, ry, h);
}

/** A counter (w long along its local X; its front faces `heading`): body, a top with an overhang, panels. Returns a placer on its top. */
export function counter(r: Room, x: number, z: number, w: number, d: number, heading: number, body: ColorRepresentation, top: ColorRepresentation, o: { h?: number; panels?: ColorRepresentation; kick?: ColorRepresentation } = {}): Put {
  const h = o.h ?? COUNTER;
  const ry = ryFor(heading);
  const p = frame(x, z, ry);
  const m = r.furn;
  m.add(shapes.box(w, h - 0.03, d, 0.02, 1), body, p(0, (h - 0.03) / 2, 0));
  m.add(shapes.box(w + 0.06, 0.035, d + 0.08, 0.015, 1), top, p(0, h - 0.015, 0.02), { ao: false });
  m.add(shapes.box(w - 0.02, 0.04, 0.02, 0.008, 1), o.kick ?? C.woodDark, p(0, 0.02, d / 2 + 0.005));
  if (o.panels !== undefined) {
    const n = Math.max(2, Math.round(w / 0.4));
    for (let i = 0; i < n; i++) m.add(shapes.box(w / n - 0.07, h - 0.16, 0.012, 0.008, 1), o.panels, p(-w / 2 + (w / n) * (i + 0.5), (h - 0.03) / 2 + 0.01, d / 2 + 0.006), { ao: false });
  }
  r.block(x, z, w / 2 + 0.03, d / 2 + 0.04, 'counter', ry);
  return frame(x, z, ry, h);
}

/** A sofa for `seats` people, its front facing `heading`. Returns the sit anchors. */
export function sofa(r: Room, x: number, z: number, heading: number, seats: number, color: ColorRepresentation, o: { cushion?: ColorRepresentation; legs?: ColorRepresentation; pillows?: ColorRepresentation[] } = {}): RoomAnchor[] {
  const ry = ryFor(heading);
  const p = frame(x, z, ry);
  const m = r.furn;
  const w = seats * 0.3 + 0.16;
  const cushion = o.cushion ?? color;
  m.add(shapes.box(w, 0.1, 0.36, 0.04, 2), color, p(0, 0.08, 0));
  for (let i = 0; i < seats; i++) m.add(shapes.box(0.29, 0.06, 0.3, 0.03, 2), cushion, p(-((seats - 1) * 0.3) / 2 + i * 0.3, SEAT - 0.03, 0.02), { ao: false });
  m.add(shapes.box(w, 0.3, 0.1, 0.04, 2), color, p(0, 0.22, -0.15), { ao: false });
  for (const s of [-1, 1]) m.add(shapes.box(0.09, 0.2, 0.38, 0.04, 2), color, p(s * (w / 2 - 0.04), 0.16, 0), { ao: false, shade: -0.03 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.cyl(0.018, 0.014, 0.04, 6), o.legs ?? C.woodDark, p(sx * (w / 2 - 0.06), 0.02, sz * 0.13));
  (o.pillows ?? []).forEach((c, i) => {
    const s = i % 2 ? 1 : -1;
    m.add(shapes.box(0.14, 0.13, 0.05, 0.03, 2), c, p(s * (w / 2 - 0.17), SEAT + 0.08, -0.09, { rz: s * 0.2, rx: -0.2 }), { ao: false });
  });
  r.block(x, z, w / 2, 0.2, 'sofa', ry);
  const out: RoomAnchor[] = [];
  for (let i = 0; i < seats; i++) {
    const lx = -((seats - 1) * 0.3) / 2 + i * 0.3;
    const at = p(lx, 0, 0.02);
    out.push(r.seat(at.x!, at.z!, heading));
  }
  return out;
}

/** A deep armchair. Returns its sit anchor. */
export function armchair(r: Room, x: number, z: number, heading: number, color: ColorRepresentation, o: { cushion?: ColorRepresentation; wing?: boolean } = {}): RoomAnchor {
  const ry = ryFor(heading);
  const p = frame(x, z, ry);
  const m = r.furn;
  m.add(shapes.box(0.42, 0.1, 0.38, 0.04, 2), color, p(0, 0.08, 0));
  m.add(shapes.box(0.3, 0.06, 0.3, 0.03, 2), o.cushion ?? color, p(0, SEAT - 0.03, 0.02), { ao: false });
  m.add(shapes.box(0.42, o.wing ? 0.42 : 0.32, 0.1, 0.045, 2), color, p(0, o.wing ? 0.28 : 0.23, -0.16), { ao: false });
  for (const s of [-1, 1]) m.add(shapes.box(0.08, 0.2, 0.38, 0.035, 2), color, p(s * 0.18, 0.17, 0), { ao: false, shade: -0.03 });
  if (o.wing) for (const s of [-1, 1]) m.add(shapes.box(0.07, 0.16, 0.12, 0.03, 2), color, p(s * 0.18, 0.4, -0.12), { ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.cyl(0.018, 0.014, 0.04, 6), C.woodDark, p(sx * 0.16, 0.02, sz * 0.13));
  r.block(x, z, 0.22, 0.2, 'armchair', ry);
  const at = p(0, 0, 0.02);
  return r.seat(at.x!, at.z!, heading);
}

/** A bean bag (a squashed blob). Returns its sit anchor (low). */
export function beanBag(r: Room, x: number, z: number, heading: number, color: ColorRepresentation): RoomAnchor {
  const p = frame(x, z, ryFor(heading));
  r.furn.add(shapes.sphere(0.2, 14, 10), color, p(0, 0.09, 0, { s: [1.05, 0.5, 1] }));
  r.furn.add(shapes.sphere(0.15, 12, 8), color, p(0, 0.17, -0.12, { s: [1, 0.7, 0.6] }), { shade: -0.04 });
  r.block(x, z, 0.2, 0.2, 'beanbag');
  return r.seat(x, z, heading, 0.15);
}

/** A bench for `seats` people (wood slats on metal legs), front facing `heading`. Returns the sit anchors. */
export function bench(r: Room, x: number, z: number, heading: number, seats: number, color: ColorRepresentation, o: { back?: boolean; legs?: ColorRepresentation } = {}): RoomAnchor[] {
  const ry = ryFor(heading);
  const p = frame(x, z, ry);
  const m = r.furn;
  const w = seats * 0.3 + 0.08;
  for (let i = 0; i < 3; i++) m.add(shapes.box(w, 0.025, 0.07, 0.01, 1), color, p(0, SEAT - 0.013, -0.075 + i * 0.075));
  if (o.back !== false) for (let i = 0; i < 2; i++) m.add(shapes.box(w, 0.06, 0.025, 0.01, 1), color, p(0, SEAT + 0.1 + i * 0.09, -0.12, { rx: -0.12 }), { ao: false });
  const legs = o.legs ?? C.metal;
  for (const s of [-1, 1]) {
    m.add(shapes.box(0.03, SEAT - 0.02, 0.2, 0.008, 1), legs, p(s * (w / 2 - 0.07), (SEAT - 0.02) / 2, 0));
    if (o.back !== false) m.add(shapes.box(0.03, 0.22, 0.03, 0.008, 1), legs, p(s * (w / 2 - 0.07), SEAT + 0.1, -0.12), { ao: false });
  }
  r.block(x, z, w / 2, 0.14, 'bench', ry);
  const out: RoomAnchor[] = [];
  for (let i = 0; i < seats; i++) {
    const at = p(-((seats - 1) * 0.3) / 2 + i * 0.3, 0, 0);
    out.push(r.seat(at.x!, at.z!, heading));
  }
  return out;
}

/** A potted floor plant: `kind` leafy (round crowns), tall (a ficus) or palm (fronds). */
export function plant(r: Room, x: number, z: number, size = 1, potColor: ColorRepresentation = C.coral, kind: 'leafy' | 'tall' | 'palm' = 'leafy'): void {
  const m = r.furn;
  const s = size;
  m.add(shapes.cyl(0.1 * s, 0.075 * s, 0.16 * s, 12), potColor, { x, y: 0.08 * s, z });
  m.add(shapes.cyl(0.105 * s, 0.105 * s, 0.025 * s, 12), potColor, { x, y: 0.16 * s, z }, { shade: 0.08, ao: false });
  m.add(shapes.cyl(0.09 * s, 0.09 * s, 0.01, 12), C.soilDark, { x, y: 0.165 * s, z }, { ao: false });
  if (kind === 'leafy') {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      m.add(shapes.blob(0.09 * s, 1), LEAVES[i % 3], { x: x + Math.cos(a) * 0.06 * s, y: (0.24 + (i % 3) * 0.05) * s, z: z + Math.sin(a) * 0.06 * s }, { ao: false });
    }
  } else if (kind === 'tall') {
    m.add(shapes.cyl(0.012 * s, 0.018 * s, 0.5 * s, 6), C.trunk, { x, y: 0.4 * s, z }, { ao: false });
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const yy = (0.45 + (i % 4) * 0.09) * s;
      m.add(shapes.blob(0.1 * s, 1), LEAVES[i % 3], { x: x + Math.cos(a) * 0.07 * s, y: yy, z: z + Math.sin(a) * 0.07 * s }, { ao: false });
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      m.add(shapes.box(0.06 * s, 0.015, 0.3 * s, 0.006, 1), LEAVES[i % 2], { x: x + Math.cos(a) * 0.12 * s, y: 0.32 * s, z: z + Math.sin(a) * 0.12 * s, ry: -a + Math.PI / 2, rx: -0.6 }, { ao: false });
    }
    m.add(shapes.cone(0.03 * s, 0.25 * s, 6), C.leafDeep, { x, y: 0.3 * s, z }, { ao: false });
  }
  r.block(x, z, 0.11 * s, 0.11 * s, 'plant');
}

/** A little plant on a surface (placer at its foot). */
export function potPlant(m: Merge, p: Put, lx: number, lz: number, s = 1, potColor: ColorRepresentation = C.cream): void {
  m.add(shapes.cyl(0.04 * s, 0.032 * s, 0.06 * s, 10), potColor, p(lx, 0.03 * s, lz), { ao: false });
  for (let i = 0; i < 3; i++) m.add(shapes.blob(0.04 * s, 0), LEAVES[i % 3], p(lx + Math.cos(i * 2.1) * 0.02 * s, (0.08 + i * 0.015) * s, lz + Math.sin(i * 2.1) * 0.02 * s), { ao: false });
}

/** A rug on the floor (round or rectangular), with a border. */
export function rug(r: Room, x: number, z: number, w: number, d: number, color: ColorRepresentation, border: ColorRepresentation, o: { round?: boolean; ry?: number; stripes?: ColorRepresentation } = {}): void {
  const m = r.shell;
  if (o.round) {
    m.add(shapes.cyl(1, 1, 0.012, 28), border, { x, y: 0.006, z, s: [w / 2, 1, d / 2] }, { ao: false });
    m.add(shapes.cyl(1, 1, 0.014, 28), color, { x, y: 0.008, z, s: [w / 2 - 0.05, 1, d / 2 - 0.05] }, { ao: false });
    if (o.stripes !== undefined) m.add(shapes.cyl(1, 1, 0.016, 28), o.stripes, { x, y: 0.009, z, s: [w / 4, 1, d / 4] }, { ao: false });
    return;
  }
  const p = frame(x, z, o.ry ?? 0);
  m.add(shapes.box(w, 0.012, d, 0.004, 1), border, p(0, 0.006, 0), { ao: false });
  m.add(shapes.box(w - 0.1, 0.014, d - 0.1, 0.004, 1), color, p(0, 0.008, 0), { ao: false });
  if (o.stripes !== undefined) for (const s of [-1, 1]) m.add(shapes.box(w - 0.2, 0.016, 0.04, 0.008, 1), o.stripes, p(0, 0.009, s * (d / 2 - 0.14)), { ao: false });
}

/** A pendant lamp hanging from `top` down to y at (x, z): cord, shade, bulb (lit at night). */
export function pendant(r: Room, x: number, y: number, z: number, shade: ColorRepresentation, top = r.H + 0.4, o: { wide?: boolean; light?: boolean } = {}): void {
  // no shadow: a long cord would draw a line across the wall
  const m = r.shell;
  m.add(shapes.cyl(0.007, 0.007, top - y, 4), C.metal, { x, y: y + (top - y) / 2, z }, { ao: false });
  if (o.wide) {
    m.add(shapes.dome(0.13, 14, 6), shade, { x, y: y - 0.02, z }, { ao: false });
    r.bulbs.add(shapes.sphere(0.05, 8, 6), C.glow, { x, y: y - 0.03, z });
  } else {
    m.add(shapes.cone(0.09, 0.12, 12), shade, { x, y: y - 0.02, z }, { ao: false });
    r.bulbs.add(shapes.sphere(0.04, 8, 6), C.glow, { x, y: y - 0.08, z });
  }
  if (o.light !== false) r.lamp(x, y - 0.15, z);
  r.halo(x, y - 0.08, z, 0.8);
}

/** A floor lamp with a fabric shade. */
export function floorLamp(r: Room, x: number, z: number, shade: ColorRepresentation, light = true): void {
  const m = r.furn;
  m.add(shapes.cyl(0.07, 0.08, 0.025, 12), C.metal, { x, y: 0.012, z });
  m.add(shapes.cyl(0.01, 0.01, 0.78, 6), C.metal, { x, y: 0.4, z }, { ao: false });
  m.add(shapes.cyl(0.08, 0.12, 0.14, 14), shade, { x, y: 0.82, z }, { ao: false });
  r.bulbs.add(shapes.cyl(0.07, 0.1, 0.02, 12), C.glow, { x, y: 0.75, z });
  if (light) r.lamp(x, 0.8, z);
  r.halo(x, 0.8, z, 0.9);
  r.block(x, z, 0.08, 0.08, 'lamp');
}

/** A table lamp on a surface placer. */
export function tableLamp(r: Room, p: Put, lx: number, lz: number, shade: ColorRepresentation, light = false): void {
  const m = r.furn;
  m.add(shapes.sphere(0.045, 10, 8), C.cream, p(lx, 0.04, lz, { s: [1, 0.9, 1] }), { ao: false });
  m.add(shapes.cyl(0.006, 0.006, 0.08, 4), C.metal, p(lx, 0.12, lz), { ao: false });
  m.add(shapes.cyl(0.045, 0.07, 0.07, 12), shade, p(lx, 0.17, lz), { ao: false });
  const b = p(lx, 0.14, lz);
  r.bulbs.add(shapes.cyl(0.04, 0.06, 0.01, 10), C.glow, b);
  if (light) r.lamp(b.x!, b.y!, b.z!);
  r.halo(b.x!, b.y! + 0.02, b.z!, 0.6);
}

/** A cup on a surface (placer), maybe steaming. */
export function cup(r: Room, p: Put, lx: number, lz: number, color: ColorRepresentation = C.white, steam = false, saucer = true): void {
  const m = r.furn;
  if (saucer) m.add(shapes.cyl(0.045, 0.04, 0.008, 12), color, p(lx, 0.004, lz), { ao: false });
  m.add(shapes.cyl(0.026, 0.02, 0.045, 10), color, p(lx, 0.03, lz), { ao: false });
  m.add(shapes.cyl(0.021, 0.021, 0.004, 10), C.woodDark, p(lx, 0.05, lz), { ao: false });
  m.add(shapes.torus(0.012, 0.005, 8), color, p(lx + 0.03, 0.03, lz), { ao: false });
  if (steam) {
    const at = p(lx, 0.06, lz);
    r.steam.push([at.x!, at.y!, at.z!]);
  }
}

/** A row of books on a shelf (placer at the shelf's top, books along local X from `from` for `len`). */
export function books(m: Merge, p: Put, from: number, len: number, lz: number, seed: number, h = 0.13): void {
  const cols = [C.red, C.navy, C.mustard, C.teal, C.plum, C.coral, C.leafDeep, C.cream, C.blue, C.rose];
  let x = from;
  let i = seed;
  while (x < from + len - 0.03) {
    const bw = 0.025 + ((i * 7) % 4) * 0.008;
    const bh = h * (0.75 + ((i * 5) % 4) * 0.08);
    const lean = i % 9 === 4 ? 0.25 : 0;
    m.add(shapes.box(bw, bh, 0.09, 0.008, 1), cols[(i * 3) % cols.length], p(x + bw / 2, bh / 2, lz, { rz: lean }), { ao: false });
    x += bw + 0.004 + (lean ? 0.03 : 0);
    i++;
  }
}

/** A shelf unit against a wall (placer on the wall at the floor): sides, boards; returns the boards' heights. */
export function shelfUnit(r: Room, p: Put, w: number, h: number, d: number, color: ColorRepresentation, boards: number, o: { back?: ColorRepresentation; at?: [number, number] } = {}): number[] {
  const m = r.furn;
  if (o.back !== undefined) m.add(shapes.box(w, h, 0.02, 0.008, 1), o.back, p(0, h / 2, 0.012));
  for (const s of [-1, 1]) m.add(shapes.box(0.035, h, d, 0.01, 1), color, p(s * (w / 2 - 0.018), h / 2, d / 2));
  const ys: number[] = [];
  for (let i = 0; i <= boards; i++) {
    const y = 0.04 + (i * (h - 0.06)) / boards;
    m.add(shapes.box(w, 0.03, d, 0.008, 1), color, p(0, y, d / 2), { ao: i === 0 });
    ys.push(y + 0.015);
  }
  if (o.at) r.block(o.at[0], o.at[1], 0, 0, 'shelf');
  return ys;
}

/** A tall potted plant on a placer (a corner of a counter, a sill). */
export function sillPlant(r: Room, p: Put, lx: number, lz: number, color: ColorRepresentation = C.coral): void {
  potPlant(r.furn, p, lx, lz, 1.2, color);
}

/** Small fruit / goods in a row along a shelf: boxes, jars, cans, bottles. */
export function goods(m: Merge, p: Put, from: number, len: number, lz: number, kind: 'box' | 'jar' | 'can' | 'bottle' | 'fruit', colors: readonly ColorRepresentation[], seed = 0): void {
  let x = from;
  let i = seed;
  while (x < from + len - 0.05) {
    const c = colors[i % colors.length];
    if (kind === 'box') {
      m.add(shapes.box(0.07, 0.1, 0.06, 0.008, 1), c, p(x + 0.035, 0.05, lz), { ao: false });
      m.add(shapes.box(0.05, 0.025, 0.002, 0.008, 1), C.white, p(x + 0.035, 0.06, lz + 0.031), { ao: false });
      x += 0.08;
    } else if (kind === 'jar') {
      m.add(shapes.cyl(0.03, 0.03, 0.08, 8), c, p(x + 0.03, 0.04, lz), { ao: false });
      m.add(shapes.cyl(0.032, 0.032, 0.015, 8), C.trim, p(x + 0.03, 0.087, lz), { ao: false });
      x += 0.07;
    } else if (kind === 'can') {
      m.add(shapes.cyl(0.024, 0.024, 0.065, 8), c, p(x + 0.025, 0.033, lz), { ao: false });
      m.add(shapes.cyl(0.025, 0.025, 0.012, 8), C.white, p(x + 0.025, 0.033, lz), { ao: false });
      x += 0.055;
    } else if (kind === 'bottle') {
      m.add(shapes.cyl(0.022, 0.024, 0.09, 8), c, p(x + 0.025, 0.045, lz), { ao: false });
      m.add(shapes.cyl(0.009, 0.014, 0.04, 6), c, p(x + 0.025, 0.11, lz), { ao: false });
      x += 0.055;
    } else {
      for (let k = 0; k < 2; k++) m.add(shapes.sphere(0.03, 8, 6), c, p(x + 0.03 + k * 0.05, 0.03, lz + (k ? 0.02 : -0.02)), { ao: false });
      x += 0.11;
    }
    i++;
  }
}
