// The fixed things of everyday life (WORLD_PROPS: the café's terrace, the bus, the pier, the farm field, the egg
// kiosk, the notice board, market stalls, benches, lanterns, a planter, a signpost), the decorations the learner
// buys (lamps, flowers, benches, blossom trees, string lights, lilies, a stall, the fountain, balloons, flags) and
// the town projects (engine/extraDecor.ts positions), all built in code in the town's one style.

import { ConeGeometry, Matrix4, type BufferGeometry, type ColorRepresentation } from 'three';
import type { CropStage } from '../../../../core/town/farm';
import type { DecorationId, DecorSpot, Tile, TownWorld, WorldProp } from '../../../../data/townWorld';
import { hash2, middleOf } from './coords';
import { LAMP_ARM, LAMP_HEIGHT, lampArm } from './layout';
import { Merge, shapes, type Place } from './merge';
import { C } from './palette3d';
import { flatRoof, gableRoof, onFace, pyramid, rel, walls, windowOn, type Kit } from './kit';
import { BLOCK_INSET, SCENERY_SIZE } from '../../../../core/town/colliders';
import { treeGeometry } from './nature';
import { WATER_LEVEL } from './terrain';

/** One thing to put in the town: merged geometries at a spot, and how it is shown. */
export interface Piece {
  /** What it belongs to, for the build animation: a decoration or project id (and its index), or '' for fixed things. */
  pop: string;
  index: number;
  x: number;
  z: number;
  ry: number;
  body: BufferGeometry | null;
  glass?: BufferGeometry | null;
  bulbs?: BufferGeometry | null;
  /** Water surfaces (the fountain's basin). */
  water?: BufferGeometry | null;
  /** Leaves and cloth that move in the wind (the sway material). */
  sway?: BufferGeometry | null;
  /** A little motion of its own: balloons bob. */
  bob?: boolean;
  /** The strings of lights over the plaza (they step back in a conversation). */
  strings?: boolean;
  height: number;
  /** Half size along x and z (picking, fading). */
  hx: number;
  hz: number;
}

interface Parts {
  body: Merge;
  bulbs: Merge;
  glass: Merge;
  water: Merge;
  sway: Merge;
}

const parts = (): Parts => ({ body: new Merge(), bulbs: new Merge(), glass: new Merge(), water: new Merge(), sway: new Merge() });

function piece(pop: string, index: number, at: { x: number; z: number }, p: Parts, height: number, half = 0.4, ry = 0): Piece {
  return { pop, index, x: at.x, z: at.z, ry, body: p.body.build(), bulbs: p.bulbs.build(), glass: p.glass.build(), water: p.water.build(), sway: p.sway.build(), height, hx: half, hz: half };
}

/**
 * The top of a bench's seat and of the café's stool (tiles): about the hips of a grown-up standing (chars/person.ts
 * SEAT_HEIGHT, the sit pose's seat), so seated people's feet hang a little over the ground. 0.295 until 2026-11-21.
 */
export const SEAT_TOP = 0.18;

/** A bench added with its own colours (Merge.add repaints, so the parts are added turned one by one). */
function benchParts(m: Merge, dir: 'e' | 's' | 'w' | undefined, at: Place = {}): void {
  const ry = (dir === 'e' ? Math.PI / 2 : dir === 'w' ? -Math.PI / 2 : 0) + (at.ry ?? 0);
  const ox = at.x ?? 0;
  const oz = at.z ?? 0;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const put = (x: number, y: number, z: number, extra: Place = {}): Place => ({ ...extra, x: ox + x * c + z * s, y, z: oz - x * s + z * c, ry });
  const seat = SEAT_TOP - 0.025;
  m.add(shapes.box(0.74, 0.05, 0.24, 0.02, 1), C.wood, put(0, seat, 0));
  m.add(shapes.box(0.74, 0.17, 0.04, 0.02, 1), C.wood, put(0, seat + 0.15, -0.11, { rx: -0.15 }));
  for (const k of [-1, 1]) {
    m.add(shapes.box(0.05, seat - 0.01, 0.2, 0.015, 1), C.metal, put(k * 0.3, (seat - 0.01) / 2, 0));
    m.add(shapes.box(0.05, 0.05, 0.22, 0.015, 1), C.metal, put(k * 0.33, seat + 0.1, 0.01), { ao: false });
  }
}

/** A street lamp at the origin, its head out over `arm` (grid direction). */
function streetLamp(p: Parts, arm: { x: number; y: number }): void {
  const m = p.body;
  m.add(shapes.cyl(0.09, 0.11, 0.12, 10), C.navy, { y: 0.06 });
  m.add(shapes.cyl(0.035, 0.045, LAMP_HEIGHT, 8), C.navy, { y: LAMP_HEIGHT / 2 + 0.05 });
  m.add(shapes.sphere(0.05, 8, 6), C.navy, { y: LAMP_HEIGHT + 0.08 }, { ao: false });
  const ax = arm.x * LAMP_ARM;
  const az = arm.y * LAMP_ARM;
  const ry = -Math.atan2(az, ax);
  m.add(shapes.box(LAMP_ARM + 0.04, 0.035, 0.035), C.navy, { x: ax / 2, y: LAMP_HEIGHT + 0.05, z: az / 2, ry }, { ao: false });
  // a little curl under the arm
  m.add(shapes.torus(0.08, 0.012, 10), C.navy, { x: ax * 0.3, y: LAMP_HEIGHT - 0.04, z: az * 0.3, ry: ry + Math.PI / 2 }, { ao: false });
  m.add(shapes.cone(0.13, 0.11, 12), C.navy, { x: ax, y: LAMP_HEIGHT - 0.01, z: az }, { ao: false });
  p.bulbs.add(shapes.sphere(0.075, 10, 8), C.glow, { x: ax, y: LAMP_HEIGHT - 0.1, z: az });
}

const FLOWER_COLS = ['#ff8fab', '#ffd166', '#ffffff', '#c3a6ff', '#ff9f68', '#f7a1c4'];

function flowerBed(m: Merge, seed: number): void {
  m.add(shapes.cyl(0.4, 0.42, 0.12, 18), C.stone, { y: 0.06 });
  m.add(shapes.cyl(0.35, 0.35, 0.04, 18), C.soil, { y: 0.12 }, { ao: false });
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996 + seed;
    const r = 0.06 + Math.sqrt(i / 16) * 0.27;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    m.add(shapes.sphere(0.06, 8, 6), i % 3 ? C.leaf : C.leafDeep, { x, y: 0.17, z }, { ao: false });
    m.add(shapes.sphere(0.045, 8, 6), FLOWER_COLS[(i + seed) % FLOWER_COLS.length], { x: x * 1.02, y: 0.23, z: z * 1.02 }, { ao: false });
  }
}

function marketStall(p: Parts, v: number): void {
  const m = p.body;
  const canopy: [ColorRepresentation, ColorRepresentation] = v % 2 ? [C.blue, C.white] : [C.coral, C.white];
  m.add(shapes.box(0.78, 0.42, 0.42, 0.03, 2), C.woodLight, { y: 0.21, z: 0.05 });
  m.add(shapes.box(0.84, 0.05, 0.48, 0.02, 1), C.wood, { y: 0.44, z: 0.05 }, { ao: false });
  for (const [x, z] of [
    [-0.38, -0.2],
    [0.38, -0.2],
    [-0.38, 0.28],
    [0.38, 0.28],
  ])
    m.add(shapes.cyl(0.022, 0.022, 1.05, 6), C.woodDark, { x, y: 0.52, z }, { ao: false });
  for (let i = 0; i < 7; i++) {
    m.add(shapes.box(0.125, 0.04, 0.62, 0.015, 1), canopy[i % 2], { x: -0.375 + i * 0.125, y: 1.06, z: 0.05, rx: 0.18 }, { ao: false });
    m.add(shapes.sphere(0.06, 8, 5), canopy[i % 2], { x: -0.375 + i * 0.125, y: 1.0, z: 0.36, s: [1, 0.55, 0.5] }, { ao: false });
  }
  const fruit = v % 2 ? [C.leaf, C.mustard, C.leafDeep] : [C.red, C.orange, C.rose];
  for (let i = 0; i < 3; i++) {
    m.add(shapes.box(0.22, 0.08, 0.2, 0.02, 1), C.woodLight, { x: -0.25 + i * 0.25, y: 0.5, z: 0.12 }, { ao: false });
    for (let j = 0; j < 4; j++) m.add(shapes.sphere(0.045, 8, 6), fruit[i], { x: -0.29 + i * 0.25 + (j % 2) * 0.08, y: 0.57, z: 0.08 + Math.floor(j / 2) * 0.08 }, { ao: false });
  }
  p.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, { y: 0.96, z: 0.05 });
}

/** One crop at (x, z) of a field (local units), as it stands now (core/town/farm.ts CropStage). */
function cropAt(m: Merge, stage: CropStage, x: number, z: number, seed: number): void {
  const h = (k: number) => hash2(seed, k, 57);
  switch (stage) {
    case 'seedling':
      // two small leaves just out of the soil
      for (const s of [-1, 1]) m.add(shapes.sphere(0.035, 6, 4), C.crop, { x: x + s * 0.03, y: 0.14, z, s: [1.3, 0.45, 0.8], rz: s * 0.5 }, { ao: false });
      m.add(shapes.cyl(0.008, 0.008, 0.05, 4), C.leaf, { x, y: 0.12, z }, { ao: false });
      return;
    case 'growing':
      // a leafy plant, no fruit yet
      m.add(shapes.sphere(0.075, 8, 6), C.leaf, { x, y: 0.17, z, s: [1, 0.85, 1] }, { ao: false });
      for (let j = 0; j < 3; j++) m.add(shapes.cone(0.022, 0.13, 5), C.leafDeep, { x: x + (j - 1) * 0.03, y: 0.22, z: z + (h(j) - 0.5) * 0.03, rz: (j - 1) * 0.35 }, { ao: false });
      return;
    case 'ripe': {
      // full and bright, with its fruit
      m.add(shapes.sphere(0.09, 8, 6), C.leafDeep, { x, y: 0.17, z, s: [1, 0.75, 1] }, { ao: false });
      const fruit = [C.red, C.orange, C.mustard][Math.floor(h(4) * 3)];
      m.add(shapes.sphere(0.045, 8, 6), fruit, { x: x + 0.04, y: 0.23, z: z + 0.03 }, { ao: false });
      m.add(shapes.sphere(0.04, 8, 6), fruit, { x: x - 0.04, y: 0.21, z: z - 0.02 }, { ao: false });
      return;
    }
    case 'wilting':
      // ripe too long: drooping, gone yellow-brown
      m.add(shapes.sphere(0.07, 8, 6), C.mustard, { x, y: 0.13, z, s: [1.25, 0.5, 1.1] }, { ao: false });
      for (const s of [-1, 1]) m.add(shapes.cone(0.02, 0.12, 5), C.trunk, { x: x + s * 0.05, y: 0.15, z, rz: s * 1.1 }, { ao: false });
      m.add(shapes.sphere(0.035, 6, 4), C.earth, { x: x + 0.03, y: 0.12, z: z + 0.05 }, { ao: false });
      return;
    default:
  }
}

/** The planting spots of the activity's field, local to its middle, in the order fieldLook's slots fill them. */
export function farmSpots(world: TownWorld): { x: number; z: number }[] {
  const prop = world.props.find((q) => q.kind === 'farm');
  if (!prop || prop.tiles.length === 0) return [];
  const b = boundsOf(prop.tiles);
  const rows = Math.max(2, Math.round(b.d * 2));
  const n = Math.round((b.w - 0.4) / 0.28);
  const out: { x: number; z: number }[] = [];
  // the row nearest the gate (the far side) first: what can be harvested is right in front of the player
  for (let r = 0; r < rows; r++) for (let k = 0; k < n; k++) out.push({ x: -b.w / 2 + 0.3 + k * 0.28, z: -b.d / 2 + (b.d / rows) * (r + 0.5) });
  return out;
}

/**
 * The crops of the activity's field: one per planting spot, as the learner's review cards stand (fieldLook's slots,
 * in farmSpots order). Without a look (nothing read yet) a calm field of young plants, never ripe ones.
 */
export function buildCrops(world: TownWorld, slots: readonly CropStage[] | undefined): Piece | null {
  const prop = world.props.find((q) => q.kind === 'farm');
  if (!prop || prop.tiles.length === 0) return null;
  const b = boundsOf(prop.tiles);
  const p = parts();
  const spots = farmSpots(world);
  spots.forEach((s, i) => {
    const stage: CropStage = slots ? (slots[i] ?? 'empty') : i % 3 === 0 ? 'growing' : 'seedling';
    cropAt(p.body, stage, s.x, s.z, i);
  });
  return { ...piece('', -1, { x: b.cx, z: b.cz }, p, 0.3), hx: b.w / 2, hz: b.d / 2 };
}

/** The fixed things of the world. */
export function buildProps(world: TownWorld, stationBuilt: boolean): Piece[] {
  const out: Piece[] = [];
  world.props.forEach((prop, i) => {
    const pc = propPiece(prop, i, world, stationBuilt);
    if (pc) out.push(pc);
  });
  return out;
}

function boundsOf(tiles: readonly Tile[]) {
  const x0 = Math.min(...tiles.map((t) => t.x));
  const y0 = Math.min(...tiles.map((t) => t.y));
  const x1 = Math.max(...tiles.map((t) => t.x)) + 1;
  const y1 = Math.max(...tiles.map((t) => t.y)) + 1;
  return { x0, y0, x1, y1, w: x1 - x0, d: y1 - y0, cx: (x0 + x1) / 2, cz: (y0 + y1) / 2 };
}

function propPiece(prop: WorldProp, i: number, world: TownWorld, stationBuilt: boolean): Piece | null {
  const at0 = prop.at ?? middleOf(prop.tiles);
  if (!at0) return null;
  const at = { x: at0.x, z: at0.y };
  const p = parts();
  const m = p.body;
  switch (prop.kind) {
    case 'inn':
      return null; // places3d.ts buildInn
    case 'terrace': {
      // the table, a hand above the stool
      const table = SEAT_TOP + 0.13;
      m.add(shapes.cyl(0.2, 0.2, 0.04, 16), C.trim, { y: table - 0.02 });
      m.add(shapes.cyl(0.025, 0.04, table - 0.02, 8), C.metal, { y: (table - 0.02) / 2 });
      m.add(shapes.cyl(0.11, 0.13, 0.03, 12), C.metal, { y: 0.015 }, { ao: false });
      m.add(shapes.cyl(0.015, 0.015, 1.0, 6), C.trim, { y: 0.9 }, { ao: false });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        m.add(shapes.box(0.3, 0.025, 0.2, 0.01, 1), k % 2 ? C.red : C.white, { x: Math.cos(a) * 0.17, y: 1.31, z: Math.sin(a) * 0.17, ry: -a, rz: -0.38 }, { ao: false });
      }
      m.add(shapes.sphere(0.03, 6, 4), C.trim, { y: 1.42 }, { ao: false });
      m.add(shapes.cyl(0.1, 0.09, 0.03, 12), C.trim, { x: 0.12, y: table + 0.015 }, { ao: false });
      m.add(shapes.cyl(0.03, 0.025, 0.05, 8), C.white, { x: -0.06, y: table + 0.025, z: 0.05 }, { ao: false });
      // the radio (Bay FM: a thing to use, townWorld WORLD_THINGS 'thing:radio'): a little set with a round speaker,
      // a dial and its aerial up
      m.add(shapes.box(0.17, 0.11, 0.07, 0.02, 2), C.mustard, { x: -0.02, y: table + 0.055, z: -0.1 });
      m.add(shapes.cyl(0.034, 0.034, 0.012, 12), C.trim, { x: -0.055, y: table + 0.055, z: -0.063, rx: Math.PI / 2 }, { ao: false });
      m.add(shapes.cyl(0.014, 0.014, 0.012, 8), C.cream, { x: 0.03, y: table + 0.07, z: -0.063, rx: Math.PI / 2 }, { ao: false });
      m.add(shapes.cyl(0.004, 0.004, 0.2, 5), C.metal, { x: 0.05, y: table + 0.2, z: -0.1, rz: -0.3 }, { ao: false });
      for (const s of [-1, 1]) {
        m.add(shapes.cyl(0.11, 0.11, 0.04, 12), C.red, { x: s * 0.34, y: SEAT_TOP - 0.02, z: 0.05 });
        m.add(shapes.cyl(0.02, 0.03, SEAT_TOP - 0.04, 6), C.metal, { x: s * 0.34, y: (SEAT_TOP - 0.04) / 2, z: 0.05 });
      }
      return piece('', i, at, p, 1.4, 0.35);
    }
    case 'bus': {
      if (!stationBuilt || prop.tiles.length === 0) return null;
      const b = boundsOf(prop.tiles);
      const along = b.d >= b.w ? 'z' : 'x';
      const len = Math.max(b.w, b.d) * 0.95;
      const ry = along === 'z' ? 0 : Math.PI / 2;
      // built along local Z, its front at +Z, then turned with the tiles
      const rot = new Matrix4().makeRotationY(ry);
      p.body.base = rot;
      p.glass.base = rot;
      p.bulbs.base = rot;
      m.add(shapes.box(0.74, 0.62, len, 0.14, 3), C.mustard, { y: 0.47 });
      m.add(shapes.box(0.76, 0.1, len + 0.02, 0.05, 2), C.cream, { y: 0.24 }, { ao: false });
      m.add(shapes.box(0.66, 0.06, len - 0.1, 0.03, 1), C.trim, { y: 0.81 }, { ao: false });
      m.add(shapes.box(0.5, 0.1, 0.03, 0.02, 1), C.navy, { y: 0.84, z: len / 2 - 0.02 }, { ao: false });
      for (const s of [-1, 1]) {
        for (let k = 0; k < 4; k++) p.glass.add(shapes.box(0.02, 0.2, len / 5.2, 0.01, 1), C.glass, { x: s * 0.375, y: 0.6, z: -len / 2 + 0.25 + (k * (len - 0.5)) / 3.3 });
        for (const z of [-len / 2 + 0.32, len / 2 - 0.3]) m.add(shapes.cyl(0.13, 0.13, 0.1, 14), '#3d3f4f', { x: s * 0.33, y: 0.13, z, rz: Math.PI / 2 }, { ao: false });
      }
      p.glass.add(shapes.box(0.6, 0.26, 0.02, 0.02, 1), C.glass, { y: 0.6, z: len / 2 + 0.005 });
      p.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, { x: 0.26, y: 0.32, z: len / 2 });
      p.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, { x: -0.26, y: 0.32, z: len / 2 });
      return piece('', i, { x: b.cx, z: b.cz }, p, 0.9, 0.45, 0);
    }
    case 'pier': {
      // planks from the shore out over the water, along −x
      const len = 1.15;
      for (let k = 0; k < 6; k++) m.add(shapes.box(0.17, 0.05, 0.6, 0.015, 1), k % 2 ? C.wood : C.woodLight, { x: 0.05 - k * 0.19, y: 0.0, z: 0 });
      for (const s of [-1, 1]) {
        m.add(shapes.box(len, 0.04, 0.05), C.woodDark, { x: 0.05 - len / 2 + 0.1, y: -0.04, z: s * 0.26 }, { ao: false });
        for (const x of [0.02, -0.5, -1.0]) m.add(shapes.cyl(0.04, 0.04, 0.5, 8), C.woodDark, { x, y: -0.2, z: s * 0.3 }, { ao: false });
      }
      m.add(shapes.cyl(0.05, 0.05, 0.42, 8), C.woodDark, { x: -1.0, y: 0.18, z: 0.3 }, { ao: false });
      m.add(shapes.torus(0.07, 0.02, 10), C.trim, { x: -1.0, y: 0.32, z: 0.36, ry: Math.PI / 2 }, { ao: false });
      return piece('', i, at, p, 0.35, 0.6);
    }
    case 'farm': {
      if (prop.tiles.length === 0) return null;
      const b = boundsOf(prop.tiles);
      at.x = b.cx;
      at.z = b.cz;
      // the activity's field: its crops are the learner's review cards (buildCrops), and its fence has a gate where
      // the player stands (WORLD_ACTIVITIES.farm); the other field is the town's own, always in leaf
      const mine = world.props.findIndex((q) => q.kind === 'farm') === i && !!world.activities?.farm;
      m.add(shapes.box(b.w - 0.1, 0.08, b.d - 0.1, 0.04, 2), C.soilDark, { y: 0.02 });
      const rows = Math.max(2, Math.round(b.d * 2));
      for (let r = 0; r < rows; r++) {
        const z = -b.d / 2 + (b.d / rows) * (r + 0.5);
        m.add(shapes.box(b.w - 0.3, 0.08, 0.2, 0.06, 2), C.soil, { y: 0.08, z }, { ao: false });
        if (mine) continue;
        const n = Math.round((b.w - 0.4) / 0.28);
        for (let k = 0; k < n; k++) cropAt(m, (r + k) % 3 === 0 ? 'ripe' : 'growing', -b.w / 2 + 0.3 + k * 0.28, z, r * 31 + k);
      }
      // a low fence on the far side (a gate in it before the player's spot) and a scarecrow
      const fz = -b.d / 2 + 0.02;
      const gate = mine && world.activities?.farm ? world.activities.farm.stand.x + 0.5 - b.cx : null;
      const open = (x: number) => gate !== null && Math.abs(x - gate) < 0.42;
      for (let k = 0; k <= Math.round(b.w / 0.4); k++) {
        const x = -b.w / 2 + k * 0.4;
        if (!open(x)) m.add(shapes.box(0.05, 0.28, 0.05, 0.015, 1), C.woodLight, { x, y: 0.14, z: fz });
      }
      if (gate === null) m.add(shapes.box(b.w, 0.04, 0.03), C.woodLight, { y: 0.22, z: fz }, { ao: false });
      else {
        const l = gate - 0.42 + b.w / 2;
        const r = b.w / 2 - (gate + 0.42);
        if (l > 0.02) m.add(shapes.box(l, 0.04, 0.03), C.woodLight, { x: -b.w / 2 + l / 2, y: 0.22, z: fz }, { ao: false });
        if (r > 0.02) m.add(shapes.box(r, 0.04, 0.03), C.woodLight, { x: b.w / 2 - r / 2, y: 0.22, z: fz }, { ao: false });
        // two gate posts, the gate swung open towards the field's left
        for (const sx of [-1, 1]) m.add(shapes.box(0.07, 0.36, 0.07, 0.02, 1), C.wood, { x: gate + sx * 0.42, y: 0.18, z: fz });
        m.add(shapes.box(0.04, 0.22, 0.7, 0.015, 1), C.woodLight, { x: gate - 0.42, y: 0.2, z: fz + 0.35, ry: 0.35 }, { ao: false });
      }
      m.add(shapes.cyl(0.025, 0.025, 0.9, 6), C.woodDark, { x: b.w / 2 - 0.4, y: 0.45, z: -b.d / 4 }, { ao: false });
      m.add(shapes.box(0.5, 0.04, 0.04), C.woodDark, { x: b.w / 2 - 0.4, y: 0.7, z: -b.d / 4 }, { ao: false });
      m.add(shapes.box(0.26, 0.28, 0.12, 0.05, 2), C.blue, { x: b.w / 2 - 0.4, y: 0.62, z: -b.d / 4 }, { ao: false });
      m.add(shapes.sphere(0.1, 10, 8), C.butter, { x: b.w / 2 - 0.4, y: 0.88, z: -b.d / 4 }, { ao: false });
      m.add(shapes.cone(0.16, 0.12, 12), C.mustard, { x: b.w / 2 - 0.4, y: 0.98, z: -b.d / 4 }, { ao: false });
      return { ...piece('', i, at, p, 0.6), hx: b.w / 2, hz: b.d / 2 };
    }
    case 'kiosk': {
      m.add(shapes.box(0.66, 0.5, 0.56, 0.06, 2), C.cream, { y: 0.25 });
      m.add(shapes.box(0.74, 0.05, 0.64, 0.02, 1), C.woodLight, { y: 0.52 }, { ao: false });
      for (const [x, z] of [
        [-0.3, -0.25],
        [0.3, -0.25],
        [-0.3, 0.25],
        [0.3, 0.25],
      ])
        m.add(shapes.cyl(0.025, 0.025, 0.5, 6), C.woodDark, { x, y: 0.78, z }, { ao: false });
      m.add(shapes.dome(0.5, 16, 6), C.pink, { y: 1.02, s: [1, 0.5, 1] }, { ao: false });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        m.add(shapes.sphere(0.07, 8, 5), k % 2 ? C.pink : C.white, { x: Math.cos(a) * 0.47, y: 1.0, z: Math.sin(a) * 0.47, s: [1, 0.6, 1] }, { ao: false });
      }
      // the giant egg
      m.add(shapes.sphere(0.17, 14, 12), C.cream, { y: 1.42, s: [1, 1.3, 1] }, { ao: false });
      for (let k = 0; k < 5; k++) m.add(shapes.sphere(0.035, 6, 4), [C.mint, C.rose, C.sky][k % 3], { x: Math.cos(k * 1.3) * 0.15, y: 1.36 + (k % 2) * 0.12, z: Math.sin(k * 1.3) * 0.15 }, { ao: false });
      for (let k = 0; k < 3; k++) m.add(shapes.sphere(0.06, 10, 8), [C.butter, C.mint, C.lilac][k], { x: -0.18 + k * 0.18, y: 0.6, z: 0.18, s: [1, 1.3, 1] }, { ao: false });
      p.bulbs.add(shapes.sphere(0.04, 8, 6), C.glow, { y: 0.98, z: 0.3 });
      return piece('', i, at, p, 1.65, 0.38);
    }
    case 'board': {
      for (const s of [-1, 1]) m.add(shapes.box(0.06, 0.95, 0.06, 0.02, 1), C.woodDark, { x: s * 0.32, y: 0.47 });
      m.add(shapes.box(0.72, 0.5, 0.06, 0.03, 2), C.wood, { y: 0.66 });
      m.add(shapes.box(0.64, 0.42, 0.02, 0.01, 1), C.cream, { y: 0.66, z: 0.035 }, { ao: false });
      [C.white, C.pink, C.sky, C.butter].forEach((c, k) => m.add(shapes.box(0.14, 0.12, 0.01), c, { x: -0.2 + (k % 2) * 0.24 + (k > 1 ? 0.12 : 0), y: 0.74 - Math.floor(k / 2) * 0.17, z: 0.05, rz: (hash2(k, i, 3) - 0.5) * 0.25 }, { ao: false }));
      m.add(shapes.box(0.86, 0.05, 0.24, 0.02, 1), C.coral, { y: 0.97, z: 0.03, rx: 0.3 }, { ao: false });
      return piece('', i, at, p, 1.05, 0.38);
    }
    case 'market':
      marketStall(p, prop.v ?? 0);
      return piece('', i, at, p, 1.15, 0.42);
    case 'bench':
      benchParts(m, prop.dir);
      return piece('', i, at, p, 0.55, 0.38);
    case 'lantern': {
      m.add(shapes.box(0.18, 0.1, 0.18, 0.03, 1), C.stoneDark, { y: 0.05 });
      m.add(shapes.cyl(0.035, 0.04, 0.6, 8), C.woodDark, { y: 0.4 });
      m.add(shapes.box(0.2, 0.04, 0.2, 0.015, 1), C.woodDark, { y: 0.72 }, { ao: false });
      p.bulbs.add(shapes.box(0.15, 0.2, 0.15, 0.03, 1), C.glow, { y: 0.84 });
      m.add(pyramidGeo(), C.coral, { y: 1.0, s: [0.28, 0.14, 0.28] }, { ao: false });
      return piece('', i, at, p, 1.1, 0.2);
    }
    case 'planter': {
      m.add(shapes.box(0.62, 0.26, 0.42, 0.04, 2), C.wood, { y: 0.13 });
      m.add(shapes.box(0.56, 0.04, 0.36, 0.02, 1), C.soil, { y: 0.27 }, { ao: false });
      for (let k = 0; k < 8; k++) {
        const x = -0.22 + (k % 4) * 0.15;
        const z = k < 4 ? -0.08 : 0.08;
        m.add(shapes.sphere(0.07, 8, 6), C.leaf, { x, y: 0.33, z }, { ao: false });
        m.add(shapes.sphere(0.04, 6, 4), FLOWER_COLS[k % FLOWER_COLS.length], { x: x + 0.02, y: 0.4, z: z + 0.02 }, { ao: false });
      }
      return piece('', i, at, p, 0.5, 0.33);
    }
    case 'signpost': {
      m.add(shapes.cyl(0.035, 0.045, 1.2, 8), C.woodDark, { y: 0.6 });
      const boards: [number, number, ColorRepresentation][] = [
        [1.02, 0.6, C.cream],
        [0.84, -0.9, C.mint],
        [0.66, 2.2, C.pink],
      ];
      for (const [y, ry, c] of boards) {
        m.add(shapes.box(0.42, 0.11, 0.03, 0.02, 1), c, { x: Math.cos(ry) * 0.18, y, z: -Math.sin(ry) * 0.18, ry }, { ao: false });
        m.add(shapes.cone(0.07, 0.1, 3), c, { x: Math.cos(ry) * 0.42, y, z: -Math.sin(ry) * 0.42, ry, rz: -Math.PI / 2, s: [1, 1, 0.3] }, { ao: false });
      }
      m.add(shapes.sphere(0.05, 8, 6), C.mustard, { y: 1.22 }, { ao: false });
      return piece('', i, at, p, 1.3, 0.25);
    }
    default:
      // something new in the world: a small crate, so it is not invisible
      m.add(shapes.box(0.4, 0.4, 0.4, 0.05, 2), C.woodLight, { y: 0.2 });
      void world;
      return piece('', i, at, p, 0.45, 0.25);
  }
}

const pyramidGeo = (): BufferGeometry => pyramid();

// ───────────────────────── decorations ─────────────────────────

/** The bought decorations, one piece per spot (each pops up on its own when bought). */
export function buildDecorations(world: TownWorld, decorations: readonly string[], squareBuilt: boolean): Piece[] {
  const out: Piece[] = [];
  const has = (id: DecorationId) => decorations.includes(id);
  const spots = (id: DecorationId): readonly DecorSpot[] => world.decorations[id] ?? [];
  const centre = (s: DecorSpot) => ({ x: s.solid ? s.x + 0.5 : s.x, z: s.solid ? s.y + 0.5 : s.y });
  for (const id of ['lamps1', 'lamps2'] as const) {
    if (!has(id)) continue;
    spots(id).forEach((s, i) => {
      const p = parts();
      streetLamp(p, lampArm(s.flip));
      out.push(piece(id, i, centre(s), p, LAMP_HEIGHT + 0.15, 0.18));
    });
  }
  if (has('flowers'))
    spots('flowers').forEach((s, i) => {
      const p = parts();
      flowerBed(p.body, i);
      out.push(piece('flowers', i, centre(s), p, 0.3, 0.42));
    });
  if (has('benches'))
    spots('benches').forEach((s, i) => {
      const p = parts();
      benchParts(p.body, s.dir);
      out.push(piece('benches', i, centre(s), p, 0.55, 0.38));
    });
  if (has('blossom'))
    spots('blossom').forEach((s, i) => {
      const p = parts();
      const g = treeGeometry('blossom');
      p.sway.addColored(g, { s: 1.05 });
      g.dispose();
      out.push(piece('blossom', i, centre(s), p, 1.45, 0.45));
    });
  if (has('lights')) {
    const poles = spots('lights');
    const tops: { x: number; y: number; z: number }[] = poles.map((s) => ({ ...centre(s), y: 1.7 }));
    poles.forEach((s, i) => {
      const p = parts();
      p.body.add(shapes.cyl(0.03, 0.04, 1.75, 8), C.woodDark, { y: 0.87 });
      p.body.add(shapes.sphere(0.05, 8, 6), C.mustard, { y: 1.77 }, { ao: false });
      out.push(piece('lights', i, centre(s), p, 1.8, 0.15));
    });
    // the strings: from the pavilion's roof (when it stands) to each pole, and between the poles
    const sq = world.places.find((q) => q.id === 'square');
    const ends: [typeof tops[number], typeof tops[number]][] = [];
    if (squareBuilt && sq) for (const t of tops) ends.push([{ x: sq.x + sq.w / 2, y: 1.85, z: sq.y + sq.d / 2 }, t]);
    for (let k = 0; k + 1 < tops.length; k++) ends.push([tops[k], tops[k + 1]]);
    const p = parts();
    const ox = tops[0]?.x ?? 0;
    const oz = tops[0]?.z ?? 0;
    ends.forEach(([a, b], k) => stringLights(p, a, b, ox, oz, k));
    if (ends.length > 0) out.push({ ...piece('lights', 1, { x: ox, z: oz }, p, 1.8, 0.1), hx: 0, hz: 0, strings: true });
  }
  if (has('lilies'))
    spots('lilies').forEach((s, i) => {
      const p = parts();
      p.body.add(shapes.cyl(0.17, 0.17, 0.015, 14), C.leafDeep, { y: WATER_LEVEL + 0.012, s: [1, 1, 0.85], ry: i }, { ao: false, top: C.leaf });
      if (i % 2 === 0) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          p.body.add(shapes.sphere(0.035, 6, 4), C.pink, { x: 0.04 + Math.cos(a) * 0.035, y: WATER_LEVEL + 0.05, z: Math.sin(a) * 0.035, s: [1, 0.6, 1] }, { ao: false });
        }
        p.body.add(shapes.sphere(0.02, 6, 4), C.mustard, { x: 0.04, y: WATER_LEVEL + 0.07 }, { ao: false });
      }
      out.push(piece('lilies', i, centre(s), p, 0.1, 0.18));
    });
  if (has('stall'))
    spots('stall').forEach((s, i) => {
      const p = parts();
      const m = p.body;
      m.add(shapes.box(0.62, 0.42, 0.42, 0.05, 2), C.butter, { y: 0.36 });
      for (const sx of [-1, 1]) m.add(shapes.cyl(0.13, 0.13, 0.05, 14), C.woodDark, { x: sx * 0.24, y: 0.13, z: 0.22, rx: Math.PI / 2 }, { ao: false });
      m.add(shapes.box(0.7, 0.04, 0.5, 0.02, 1), C.woodLight, { y: 0.59 }, { ao: false });
      for (const [x, z] of [
        [-0.3, -0.2],
        [0.3, -0.2],
        [-0.3, 0.2],
        [0.3, 0.2],
      ])
        m.add(shapes.cyl(0.018, 0.018, 0.5, 6), C.trim, { x, y: 0.84, z }, { ao: false });
      for (let k = 0; k < 6; k++) m.add(shapes.box(0.13, 0.035, 0.58, 0.012, 1), k % 2 ? C.white : C.teal, { x: -0.325 + k * 0.13, y: 1.1, rx: 0.12 }, { ao: false });
      m.add(shapes.cone(0.07, 0.14, 10), C.mustard, { x: -0.12, y: 0.68 }, { ao: false });
      m.add(shapes.sphere(0.06, 10, 8), C.pink, { x: -0.12, y: 0.78 }, { ao: false });
      m.add(shapes.cone(0.07, 0.14, 10), C.mustard, { x: 0.1, y: 0.68, z: 0.05 }, { ao: false });
      m.add(shapes.sphere(0.06, 10, 8), C.mint, { x: 0.1, y: 0.78, z: 0.05 }, { ao: false });
      p.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, { y: 1.02 });
      out.push(piece('stall', i, centre(s), p, 1.2, 0.38));
    });
  if (has('fountain'))
    spots('fountain').forEach((s, i) => {
      const p = parts();
      const m = p.body;
      m.add(shapes.cyl(0.62, 0.66, 0.26, 28), C.stone, { y: 0.13 });
      m.add(shapes.torus(0.62, 0.05, 28), C.trim, { y: 0.27, rx: Math.PI / 2 }, { ao: false });
      p.water.add(shapes.cyl(0.57, 0.57, 0.02, 28), C.waterShallow, { y: 0.22 }, { ao: false });
      m.add(shapes.cyl(0.1, 0.14, 0.6, 12), C.stone, { y: 0.5 });
      m.add(shapes.cyl(0.32, 0.18, 0.1, 20), C.stone, { y: 0.82 });
      p.water.add(shapes.cyl(0.28, 0.28, 0.02, 20), C.waterShallow, { y: 0.86 }, { ao: false });
      m.add(shapes.cyl(0.05, 0.07, 0.3, 10), C.stone, { y: 1.0 });
      p.water.add(shapes.sphere(0.09, 12, 8), C.waterShallow, { y: 1.18, s: [1, 1.3, 1] }, { ao: false });
      // falling water round the upper bowl
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        p.water.add(shapes.cyl(0.02, 0.03, 0.55, 6), C.waterShallow, { x: Math.cos(a) * 0.3, y: 0.55, z: Math.sin(a) * 0.3 }, { ao: false });
      }
      out.push(piece('fountain', i, centre(s), p, 1.3, 0.62));
    });
  if (has('balloons'))
    spots('balloons').forEach((s, i) => {
      const p = parts();
      const cols = [C.rose, C.mustard, C.sky, C.mint, C.lilac];
      p.body.add(shapes.cyl(0.04, 0.05, 0.06, 8), C.stoneDark, { y: 0.03 });
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + i;
        const x = Math.cos(a) * 0.12;
        const z = Math.sin(a) * 0.12;
        const y = 1.15 + k * 0.12;
        p.body.add(shapes.cyl(0.004, 0.004, y - 0.06, 3), C.trim, { x: x / 2, y: y / 2, z: z / 2, rz: -x * 0.4, rx: z * 0.4 }, { ao: false });
        p.body.add(shapes.sphere(0.13, 14, 10), cols[(i + k) % cols.length], { x, y: y + 0.12, z, s: [1, 1.18, 1] }, { ao: false });
        p.body.add(shapes.cone(0.025, 0.04, 6), cols[(i + k) % cols.length], { x, y: y - 0.03, z, rx: Math.PI }, { ao: false });
      }
      out.push({ ...piece('balloons', i, centre(s), p, 1.6, 0.2), bob: true });
    });
  if (has('flags'))
    spots('flags').forEach((s, i) => {
      const p = parts();
      p.body.add(shapes.cyl(0.025, 0.03, 1.6, 8), C.trim, { y: 0.8 });
      p.body.add(shapes.sphere(0.045, 8, 6), C.mustard, { y: 1.62 }, { ao: false });
      const cols = [C.coral, C.teal, C.mustard];
      const c = cols[i % cols.length];
      p.sway.tris([0.02, 1.55, 0, 0.02, 1.25, 0, 0.5, 1.4, 0, 0.02, 1.55, 0, 0.5, 1.4, 0, 0.02, 1.25, 0], c);
      out.push(piece('flags', i, centre(s), p, 1.7, 0.15));
    });
  return out;
}

/** A string of bulbs sagging from a to b (scene points), around (ox, oz). */
function stringLights(p: Parts, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, ox: number, oz: number, seed: number): void {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(6, Math.round(len / 0.22));
  const sag = Math.min(0.45, len * 0.12);
  const cols = ['#ffd27a', '#ff9fb2', '#a9e3ff', '#c8f59a'];
  let prev: { x: number; y: number; z: number } | null = null;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const pt = { x: a.x + (b.x - a.x) * t - ox, y: a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t), z: a.z + (b.z - a.z) * t - oz };
    if (prev) {
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      const dz = pt.z - prev.z;
      const l = Math.hypot(dx, dy, dz);
      p.body.add(shapes.cyl(0.008, 0.008, l, 3), C.metal, { x: (pt.x + prev.x) / 2, y: (pt.y + prev.y) / 2, z: (pt.z + prev.z) / 2, ry: -Math.atan2(dz, dx), rz: Math.PI / 2 - Math.atan2(dy, Math.hypot(dx, dz)) * -1 }, { ao: false });
    }
    if (k > 0 && k < n) p.bulbs.add(shapes.sphere(0.04, 8, 6), cols[(k + seed) % cols.length], { x: pt.x, y: pt.y - 0.05, z: pt.z });
    prev = pt;
  }
}

// ───────────────────────── town projects ─────────────────────────

/** A town project's pieces at the spots engine/extraDecor.ts gives (unknown ids: nothing). */
export function buildProject(id: string, spots: readonly Tile[]): Piece[] {
  return spots.map((s, i) => {
    const p = parts();
    const m = p.body;
    const at = { x: s.x, z: s.y };
    switch (id) {
      case 'proj-lake-lights':
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          m.add(shapes.cone(0.05, 0.12, 6), k % 2 ? C.pink : C.rose, { x: Math.cos(a) * 0.06, y: WATER_LEVEL + 0.05, z: Math.sin(a) * 0.06, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }, { ao: false });
        }
        m.add(shapes.cyl(0.11, 0.11, 0.02, 12), C.leafDeep, { y: WATER_LEVEL + 0.005 }, { ao: false });
        p.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, { y: WATER_LEVEL + 0.09 });
        return piece(id, i, at, p, 0.2, 0.12);
      case 'proj-festival': {
        m.add(shapes.box(1.6, 0.22, 1.0, 0.05, 2), C.woodLight, { y: 0.11 });
        m.add(shapes.box(1.6, 0.9, 0.08, 0.04, 2), C.plum, { y: 0.66, z: -0.46 });
        for (const sx of [-1, 1]) m.add(shapes.cyl(0.035, 0.035, 1.3, 8), C.woodDark, { x: sx * 0.78, y: 0.85, z: 0.45 });
        for (let k = 0; k < 9; k++) m.add(shapes.box(0.2, 0.04, 1.05, 0.015, 1), k % 2 ? C.mustard : C.coral, { x: -0.8 + k * 0.2, y: 1.48, rx: 0.08 }, { ao: false });
        for (let k = 0; k < 8; k++) m.add(shapes.cone(0.06, 0.12, 3), [C.coral, C.mustard, C.teal, C.pink][k % 4], { x: -0.7 + k * 0.2, y: 1.36, z: 0.5, rx: Math.PI }, { ao: false });
        for (let k = 0; k < 5; k++) p.bulbs.add(shapes.sphere(0.04, 8, 6), C.glow, { x: -0.6 + k * 0.3, y: 1.42, z: 0.45 });
        return piece(id, i, at, p, 1.6, 0.8);
      }
      case 'proj-pier':
        for (let k = 0; k < 6; k++) m.add(shapes.box(0.17, 0.05, 0.6, 0.015, 1), k % 2 ? C.wood : C.woodLight, { x: 0.45 - k * 0.19, y: 0.0 });
        for (const sz of [-1, 1]) for (const x of [0.4, -0.6]) m.add(shapes.cyl(0.04, 0.04, 0.5, 8), C.woodDark, { x, y: -0.2, z: sz * 0.3 }, { ao: false });
        p.bulbs.add(shapes.sphere(0.05, 8, 6), C.glow, { x: -0.6, y: 0.5, z: 0.3 });
        m.add(shapes.cyl(0.03, 0.03, 0.5, 6), C.woodDark, { x: -0.6, y: 0.25, z: 0.3 }, { ao: false });
        return piece(id, i, at, p, 0.5, 0.6);
      case 'proj-garden':
        for (const [x, z] of [
          [-0.5, -0.5],
          [0.5, -0.5],
          [-0.5, 0.5],
          [0.5, 0.5],
        ]) {
          m.add(shapes.box(0.8, 0.22, 0.8, 0.05, 2), C.wood, { x, y: 0.11, z });
          m.add(shapes.box(0.7, 0.04, 0.7, 0.02, 1), C.soil, { x, y: 0.22, z }, { ao: false });
          for (let k = 0; k < 4; k++) m.add(shapes.sphere(0.1, 8, 6), (k + x * 2) % 2 ? C.leaf : C.crop, { x: x - 0.18 + (k % 2) * 0.36, y: 0.3, z: z - 0.18 + Math.floor(k / 2) * 0.36 }, { ao: false });
        }
        return piece(id, i, at, p, 0.5, 1.0);
      case 'proj-clock-tower': {
        m.add(shapes.box(0.7, 0.2, 0.7, 0.05, 2), C.stoneDark, { y: 0.1 });
        m.add(shapes.box(0.56, 2.2, 0.56, 0.06, 2), C.cream, { y: 1.3 });
        m.add(shapes.box(0.66, 0.08, 0.66, 0.03, 1), C.trim, { y: 2.42 }, { ao: false });
        for (let k = 0; k < 4; k++) {
          const ry = (k * Math.PI) / 2;
          const ox = Math.sin(ry) * 0.29;
          const oz = Math.cos(ry) * 0.29;
          m.add(shapes.cyl(0.2, 0.2, 0.03, 20), C.white, { x: ox, y: 2.05, z: oz, ry, rx: Math.PI / 2 }, { ao: false });
          m.add(shapes.box(0.02, 0.13, 0.02), C.navy, { x: ox * 1.08, y: 2.1, z: oz * 1.08, ry }, { ao: false });
          m.add(shapes.box(0.1, 0.02, 0.02), C.navy, { x: ox * 1.08 + Math.cos(ry) * 0.04, y: 2.05, z: oz * 1.08 - Math.sin(ry) * 0.04, ry }, { ao: false });
          p.glass.add(shapes.box(0.16, 0.3, 0.02, 0.01, 1), C.glass, { x: ox * 1.0, y: 1.2, z: oz * 1.0, ry });
        }
        m.add(pyramidGeo(), C.teal, { y: 2.75, s: [0.8, 0.6, 0.8] }, { ao: false });
        m.add(shapes.sphere(0.06, 8, 6), C.mustard, { y: 3.1 }, { ao: false });
        return piece(id, i, at, p, 3.1, 0.36);
      }
      default:
        return piece(id, i, at, p, 0, 0);
    }
  });
}

// ───────────────────────── scenery ─────────────────────────

// ───────────────────────── the coast ─────────────────────────

const turnParts = (p: Parts, ry: number): void => {
  if (!ry) return;
  const b = new Matrix4().makeRotationY(ry);
  for (const m of [p.body, p.bulbs, p.glass, p.water, p.sway]) m.base = b;
};

/** A lighthouse on a stone plinth (radius ~0.85), about 4.4 tall; the lamp room glows at night. The door looks to +z (the +y side). */
function lighthouse(p: Parts): void {
  const m = p.body;
  const y0 = 0.25;
  const rBase = 0.62;
  const rTop = 0.45;
  const bandH = 0.62;
  const bands = 5;
  const rAt = (y: number) => rBase + ((rTop - rBase) * (y - y0)) / (bandH * bands);
  // the rock the tower stands on
  m.add(shapes.cyl(0.8, 0.85, y0, 14), C.stoneDark, { y: y0 / 2 });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.4;
    m.add(shapes.blob(0.17 + (k % 3) * 0.04, 1), k % 2 ? C.rock : C.stoneDark, { x: Math.cos(a) * 0.78, y: 0.1, z: Math.sin(a) * 0.78, s: [1.2, 0.7, 1] }, { ao: false });
  }
  m.add(shapes.cyl(0.7, 0.74, 0.04, 14), C.stone, { y: y0 + 0.01 }, { ao: false });
  // the tower: white and red bands
  for (let k = 0; k < bands; k++) {
    const ya = y0 + k * bandH;
    m.add(shapes.cyl(rAt(ya + bandH), rAt(ya), bandH, 14), k % 2 ? C.red : C.white, { y: ya + bandH / 2 }, { ao: k === 0 });
  }
  const yTop = y0 + bands * bandH;
  // door on the +z side, a step and two slit windows
  const z0 = rAt(y0 + 0.2) - 0.02;
  m.add(shapes.box(0.34, 0.5, 0.07, 0.03, 1), C.trim, { y: y0 + 0.25, z: z0 });
  m.add(shapes.box(0.26, 0.42, 0.06, 0.03, 1), C.door, { y: y0 + 0.23, z: z0 + 0.03 });
  m.add(shapes.sphere(0.022, 6, 4), C.mustard, { x: 0.07, y: y0 + 0.23, z: z0 + 0.065 }, { ao: false });
  m.add(shapes.box(0.5, 0.06, 0.2, 0.025, 1), C.stone, { y: y0 + 0.03, z: z0 + 0.14 });
  for (const y of [y0 + 1.2, y0 + 2.2]) {
    const z = rAt(y) - 0.005;
    m.add(shapes.box(0.12, 0.26, 0.05, 0.02, 1), C.trim, { y, z });
    p.glass.add(shapes.box(0.07, 0.2, 0.04, 0.01, 1), C.glass, { y, z: z + 0.01 });
  }
  // the gallery: a deck, rail posts and a rail
  m.add(shapes.cyl(0.6, 0.5, 0.07, 16), C.navy, { y: yTop + 0.035 });
  m.add(shapes.cyl(0.58, 0.58, 0.02, 16), C.metal, { y: yTop + 0.08 }, { ao: false });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    m.add(shapes.cyl(0.018, 0.018, 0.2, 5), C.navy, { x: Math.cos(a) * 0.55, y: yTop + 0.19, z: Math.sin(a) * 0.55 }, { ao: false });
  }
  m.add(shapes.torus(0.55, 0.018, 16), C.navy, { y: yTop + 0.29, rx: Math.PI / 2 }, { ao: false });
  // the lamp room: glass drum, four frame posts, the lamp inside (glows at night)
  const yl = yTop + 0.09;
  const lh = 0.4;
  p.glass.add(shapes.cyl(0.27, 0.29, lh, 12), C.glass, { y: yl + lh / 2 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    m.add(shapes.box(0.035, lh, 0.035, 0.01, 1), C.white, { x: Math.cos(a) * 0.285, y: yl + lh / 2, z: Math.sin(a) * 0.285 }, { ao: false });
  }
  p.bulbs.add(shapes.sphere(0.15, 10, 8), C.glow, { y: yl + lh / 2 });
  // the cap
  m.add(shapes.cyl(0.36, 0.34, 0.05, 14), C.red, { y: yl + lh + 0.025 }, { ao: false });
  m.add(shapes.dome(0.33, 14, 6), C.red, { y: yl + lh + 0.05, s: [1, 0.85, 1] }, { ao: false });
  m.add(shapes.sphere(0.04, 8, 6), C.mustard, { y: yl + lh + 0.05 + 0.33 * 0.85 + 0.03 }, { ao: false });
}

const HUT_WALLS = [C.sky, C.mint, C.butter, C.pink] as const;
const HUT_ROOFS = [C.coral, C.teal, C.blue, C.plum] as const;

/** A beach hut on low stilts: pastel planks, a pitched roof, a door and a window on the +z face, a step. */
function hut(p: Parts, i: number): void {
  const v = Math.floor(hash2(i, 11, 5) * HUT_WALLS.length) % HUT_WALLS.length;
  const wall = HUT_WALLS[v];
  const roof = HUT_ROOFS[(v + 1 + Math.floor(hash2(i, 12, 5) * 3)) % HUT_ROOFS.length];
  const m = p.body;
  const k: Kit = { body: m, glass: p.glass, bulbs: p.bulbs, W: 1.44, D: 1.4 };
  const fl = 0.22;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.cyl(0.045, 0.05, fl, 6), C.woodDark, { x: sx * 0.6, y: fl / 2, z: sz * 0.57 }, { ao: false });
  m.add(shapes.box(1.58, 0.06, 1.5, 0.02, 1), C.woodLight, { y: fl });
  const y0 = fl + 0.03;
  const h = 0.8;
  walls(k, h, wall, { y0 });
  // plank lines and corner boards
  for (let r = 1; r < 5; r++) m.add(shapes.box(k.W + 0.01, 0.012, k.D + 0.01, 0.004, 1), C.trim, { y: y0 + (h * r) / 5 }, { ao: false, shade: -0.02 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.box(0.06, h, 0.06, 0.015, 1), C.trim, { x: (sx * k.W) / 2, y: y0 + h / 2, z: (sz * k.D) / 2 }, { ao: false });
  const f = onFace(k, 'front', 0, y0, 0.01);
  m.add(shapes.box(0.38, 0.62, 0.05, 0.02, 1), C.trim, rel(f, 0.32, 0.31, 0.01), { ao: false });
  m.add(shapes.box(0.32, 0.56, 0.05, 0.02, 1), roof, rel(f, 0.32, 0.29, 0.03), { ao: false, shade: -0.05 });
  m.add(shapes.sphere(0.022, 6, 4), C.mustard, rel(f, 0.2, 0.29, 0.065), { ao: false });
  windowOn(k, 'front', -0.38, y0 + 0.46, { w: 0.3, h: 0.3 });
  // a step down to the sand
  m.add(shapes.box(0.5, 0.1, 0.14, 0.02, 1), C.woodLight, { x: 0.32, y: 0.05, z: k.D / 2 + 0.07 });
  gableRoof(k, y0 + h, 0.42, roof, { ridge: 'z', wall, over: 0.09 });
  // a surfboard leaning on the side
  const sb = hash2(i, 13, 5) > 0.5 ? 1 : -1;
  m.add(shapes.sphere(0.09, 8, 6), C.white, { x: sb * (k.W / 2 + 0.05), y: y0 + 0.4, z: 0.1, rz: -sb * 0.12, s: [0.3, 4.2, 1] }, { ao: false });
  m.add(shapes.sphere(0.09, 8, 6), C.coral, { x: sb * (k.W / 2 + 0.065), y: y0 + 0.4, z: 0.1, rz: -sb * 0.12, s: [0.3, 1.2, 0.5] }, { ao: false });
}

const UMBRELLA_COLS = [C.coral, C.teal, C.mustard] as const;

/** A striped beach umbrella (8 wedges) with a deck chair beside it. */
function umbrella(p: Parts, i: number): void {
  const col = UMBRELLA_COLS[Math.floor(hash2(i, 21, 5) * 3) % 3];
  const m = p.body;
  // a little mound of sand round the pole
  m.add(shapes.cyl(0.2, 0.3, 0.12, 12), C.sand, { y: 0.06 }, { ao: false, shade: -0.03 });
  m.add(shapes.cyl(0.022, 0.026, 1.12, 6), C.woodLight, { y: 0.56 }, { ao: false });
  for (let k = 0; k < 8; k++) {
    const wedge = shapes.custom(`umbrellaWedge${k}`, () => new ConeGeometry(0.5, 0.2, 1, 1, false, (k * Math.PI) / 4, Math.PI / 4), true);
    m.add(wedge, k % 2 ? C.white : col, { y: 1.0 }, { ao: false });
  }
  m.add(shapes.sphere(0.03, 6, 4), C.woodDark, { y: 1.12 }, { ao: false });
  // the deck chair: low frame, striped seat, a tilted back
  const sd = hash2(i, 22, 5) > 0.5 ? 1 : -1;
  const x = sd * 0.27;
  for (const dx of [-1, 1]) {
    m.add(shapes.box(0.03, 0.03, 0.5, 0.01, 1), C.wood, { x: x + dx * 0.11, y: 0.12, z: 0.02 }, { ao: false });
    for (const dz of [-0.2, 0.22]) m.add(shapes.cyl(0.015, 0.015, 0.12, 5), C.woodDark, { x: x + dx * 0.11, y: 0.06, z: dz }, { ao: false });
  }
  m.add(shapes.box(0.22, 0.025, 0.3, 0.01, 1), C.white, { x, y: 0.14, z: 0.1 }, { ao: false });
  m.add(shapes.box(0.22, 0.026, 0.1, 0.01, 1), col, { x, y: 0.142, z: 0.1 }, { ao: false });
  m.add(shapes.box(0.22, 0.025, 0.28, 0.01, 1), C.white, { x, y: 0.26, z: -0.23, rx: 0.9 }, { ao: false });
  m.add(shapes.box(0.22, 0.027, 0.09, 0.01, 1), col, { x, y: 0.262, z: -0.23, rx: 0.9 }, { ao: false });
}

/** A rock outcrop: a few overlapping blobs, a little moss on top (the whole thing turned by hash). */
function boulder(p: Parts, i: number): void {
  const m = p.body;
  turnParts(p, hash2(i, 31, 5) * Math.PI * 2);
  m.add(shapes.blob(0.64, 1), C.rock, { y: 0.44, s: [1.1, 1.3, 1] }, { shade: 0.02 });
  m.add(shapes.blob(0.4, 1), C.stoneDark, { x: 0.42, y: 0.22, z: 0.14, s: [1.1, 0.85, 1], ry: 0.8 }, { top: C.rock });
  m.add(shapes.blob(0.36, 1), C.rock, { x: -0.42, y: 0.18, z: -0.25, s: [1.1, 0.75, 1], ry: 2 }, { shade: -0.05 });
  m.add(shapes.blob(0.3, 1), C.leafDeep, { x: -0.1, y: 1.08, z: 0.06, s: [1.25, 0.45, 1.1] }, { top: C.leaf, ao: false });
  m.add(shapes.blob(0.2, 1), C.leaf, { x: 0.46, y: 0.45, z: 0.14, s: [1.2, 0.45, 1] }, { ao: false });
}

/** A small rowing boat lying along local x (turned for 'y'), its rim just above the water; two oars and a stripe. */
function boat(p: Parts, dir: 'x' | 'y'): void {
  turnParts(p, dir === 'y' ? -Math.PI / 2 : 0);
  const m = p.body;
  const rim = WATER_LEVEL + 0.2;
  m.add(shapes.dome(0.5, 14, 6), C.woodLight, { y: rim, rx: Math.PI, s: [1.3, 0.6, 0.5] }, { ao: false });
  m.add(shapes.cyl(0.5, 0.5, 0.02, 14), C.wood, { y: rim - 0.03, s: [1.24, 1, 0.45] }, { ao: false });
  m.add(shapes.torus(0.5, 0.022, 18), C.woodDark, { y: rim, rx: Math.PI / 2, s: [1.3, 0.5, 1] }, { ao: false });
  m.add(shapes.torus(0.5, 0.026, 18), C.red, { y: rim - 0.07, rx: Math.PI / 2, s: [1.28, 0.49, 1] }, { ao: false });
  for (const x of [-0.2, 0.25]) m.add(shapes.box(0.1, 0.03, 0.46, 0.01, 1), C.wood, { x, y: rim - 0.04 }, { ao: false });
  // the bow and stern points
  for (const sx of [-1, 1]) m.add(shapes.cone(0.05, 0.12, 6), C.woodDark, { x: sx * 0.66, y: rim + 0.03, rz: (-sx * Math.PI) / 2 }, { ao: false });
  for (const sz of [-1, 1]) {
    m.add(shapes.cyl(0.011, 0.011, 0.5, 5), C.woodDark, { x: -0.02, y: rim, z: sz * 0.42, rx: sz * (Math.PI / 2 + 0.3) }, { ao: false });
    m.add(shapes.box(0.1, 0.012, 0.17, 0.005, 1), C.woodLight, { x: -0.02, y: rim - 0.085, z: sz * 0.66, rx: sz * 0.3 }, { ao: false });
  }
}

/** A plank walk on posts from local x = -len/2 (the shore end) to +len/2, seen only; mooring posts and a lamp at the far end. */
function jetty(p: Parts, len: number, dir: 'x' | 'y'): void {
  turnParts(p, dir === 'y' ? -Math.PI / 2 : 0);
  const m = p.body;
  const w = 0.9;
  const top = 0.03;
  const n = Math.max(2, Math.round(len / 0.36));
  const step = len / n;
  for (let k = 0; k < n; k++) m.add(shapes.box(step - 0.025, 0.05, w, 0.012, 1), k % 2 ? C.wood : C.woodLight, { x: -len / 2 + step * (k + 0.5), y: top - 0.025 }, { ao: false });
  for (const s of [-1, 1]) m.add(shapes.box(len, 0.05, 0.05, 0.015, 1), C.woodDark, { y: top - 0.075, z: s * 0.36 }, { ao: false });
  const posts = Math.max(2, Math.round(len / 1.1) + 1);
  for (let k = 0; k < posts; k++) {
    const x = -len / 2 + 0.1 + ((len - 0.2) * k) / (posts - 1);
    for (const s of [-1, 1]) {
      // a post from well under the water up to the deck
      m.add(shapes.cyl(0.045, 0.05, 0.58, 8), C.woodDark, { x, y: top - 0.29 - 0.01, z: s * 0.4 }, { ao: false });
      // a mooring post here and there, standing above the deck
      if ((k + (s > 0 ? 1 : 0)) % 3 === 1) {
        m.add(shapes.cyl(0.05, 0.055, 0.22, 8), C.woodDark, { x, y: top + 0.09, z: s * 0.4 }, { ao: false });
        m.add(shapes.sphere(0.058, 8, 6), C.woodDark, { x, y: top + 0.21, z: s * 0.4, s: [1, 0.7, 1] }, { ao: false });
        m.add(shapes.torus(0.05, 0.012, 10), C.trim, { x, y: top + 0.14, z: s * 0.4, rx: Math.PI / 2 }, { ao: false });
      }
    }
  }
  // a lamp at the far end
  const lx = len / 2 - 0.15;
  m.add(shapes.cyl(0.028, 0.036, 0.95, 8), C.navy, { x: lx, y: top + 0.475, z: 0.36 }, { ao: false });
  m.add(shapes.cone(0.1, 0.09, 10), C.navy, { x: lx, y: top + 1.0, z: 0.36 }, { ao: false });
  p.bulbs.add(shapes.sphere(0.06, 8, 6), C.glow, { x: lx, y: top + 0.92, z: 0.36 });
  // a coil of rope on the planks
  m.add(shapes.torus(0.07, 0.016, 10), C.stoneDark, { x: len / 2 - 0.55, y: top + 0.015, z: -0.2, rx: Math.PI / 2 }, { ao: false });
}

/** The city's blocks (data/cityWorld.ts): wall, trim and roof colours by look. */
const BLOCK_LOOKS: readonly { wall: ColorRepresentation; base: ColorRepresentation; roof: ColorRepresentation }[] = [
  { wall: C.cream, base: C.stoneDark, roof: C.coral },
  { wall: C.sky, base: C.navy, roof: C.stoneDark },
  { wall: C.peach, base: C.woodDark, roof: C.teal },
  { wall: C.lilac, base: C.plum, roof: C.stoneDark },
];
/** A storey of a block is this high; its ground floor a little higher. */
const STOREY = 0.78;

/**
 * A block of flats or offices of the city's skyline: `h` storeys on `w` × `d` tiles, rows of windows on the two
 * faces the viewer sees (the +y face is the kit's front, the +x face its right), a shop front at the foot, a flat
 * roof with a water tank or a roof hut. Returns its top.
 */
function cityBlock(p: Parts, w: number, d: number, h: number, v: number, seed: number): number {
  const look = BLOCK_LOOKS[((v % BLOCK_LOOKS.length) + BLOCK_LOOKS.length) % BLOCK_LOOKS.length];
  const k: Kit = { body: p.body, glass: p.glass, bulbs: p.bulbs, W: w - BLOCK_INSET * 2, D: d - BLOCK_INSET * 2 };
  const ground = 0.95;
  const H = ground + (h - 1) * STOREY;
  walls(k, H, look.wall, { plinth: look.base });
  for (const face of ['front', 'right'] as const) {
    const span = face === 'front' ? k.W : k.D;
    // the ground floor: a band over wide shop windows
    const f = onFace(k, face, 0, 0, 0.012);
    p.body.add(shapes.box(span - 0.04, 0.1, 0.03, 0.02, 1), look.base, rel(f, 0, ground - 0.02, 0.01), { ao: false });
    const n = Math.max(1, Math.round(span / 1.3));
    for (let c = 0; c < n; c++) {
      const u = -span / 2 + (span * (c + 0.5)) / n;
      windowOn(k, face, u, 0.5, { w: Math.min(0.8, span / n - 0.3), h: 0.5, frame: look.base });
    }
    // the floors above: a window every 0.85 or so
    const m = Math.max(1, Math.round(span / 0.85));
    for (let s = 1; s < h; s++) {
      for (let c = 0; c < m; c++) {
        const u = -span / 2 + (span * (c + 0.5)) / m;
        windowOn(k, face, u, ground + (s - 1) * STOREY + 0.42, { w: 0.3, h: 0.36 });
      }
    }
  }
  const top = flatRoof(k, H, look.roof, { ledge: C.trim });
  // something on the roof: a water tank, or a little roof hut
  const rx = (hash2(seed, 7, 5) - 0.5) * (k.W - 1);
  const rz = (hash2(seed, 9, 5) - 0.5) * (k.D - 1);
  if (hash2(seed, 3, 5) > 0.5) {
    p.body.add(shapes.cyl(0.22, 0.22, 0.34, 12), C.woodLight, { x: rx, y: top + 0.3, z: rz }, { ao: false });
    p.body.add(shapes.cone(0.26, 0.16, 12), look.roof, { x: rx, y: top + 0.55, z: rz }, { ao: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.body.add(shapes.box(0.03, 0.16, 0.03), C.metal, { x: rx + sx * 0.14, y: top + 0.08, z: rz + sz * 0.14 }, { ao: false });
    return top + 0.65;
  }
  p.body.add(shapes.box(0.6, 0.4, 0.5, 0.03, 1), look.wall, { x: rx, y: top + 0.2, z: rz });
  p.body.add(shapes.box(0.68, 0.06, 0.58, 0.02, 1), look.roof, { x: rx, y: top + 0.42, z: rz }, { ao: false });
  return top + 0.45;
}

/** A parked taxi, `len` long along x or y: yellow, a dark band, the sign on its roof (lit). */
function taxi(p: Parts, len: number, along: 'x' | 'y'): void {
  // built along local X, turned for a run along y
  const rot = new Matrix4().makeRotationY(along === 'x' ? 0 : -Math.PI / 2);
  p.body.base = rot;
  p.glass.base = rot;
  p.bulbs.base = rot;
  const m = p.body;
  m.add(shapes.box(len, 0.26, 0.66, 0.09, 3), C.mustard, { y: 0.27 });
  m.add(shapes.box(len * 0.52, 0.22, 0.6, 0.09, 3), C.mustard, { x: -len * 0.04, y: 0.5 });
  m.add(shapes.box(len * 0.9, 0.05, 0.67, 0.02, 1), '#3d3f4f', { y: 0.3 }, { ao: false });
  p.glass.add(shapes.box(len * 0.46, 0.15, 0.62, 0.03, 1), C.glass, { x: -len * 0.04, y: 0.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.cyl(0.12, 0.12, 0.1, 14), '#3d3f4f', { x: sx * len * 0.3, y: 0.12, z: sz * 0.3, rx: Math.PI / 2 }, { ao: false });
  p.bulbs.add(shapes.box(0.22, 0.08, 0.1, 0.02, 1), C.glow, { x: -len * 0.04, y: 0.66 });
  for (const sz of [-1, 1]) p.bulbs.add(shapes.sphere(0.04, 8, 6), C.glow, { x: len / 2, y: 0.3, z: sz * 0.22 });
}

/**
 * The world's scenery (WORLD_SCENERY): the farm's barn, its well and hay bales, the front gardens' fences and hedges,
 * stones and bushes, the ducks on the lake. The hill is the ground's (terrain). What stands up is as big as its
 * collider (core/town/colliders.ts SCENERY_SIZE, sceneryColliders).
 */
export function buildScenery(world: TownWorld): Piece[] {
  const out: Piece[] = [];
  const blocks = new Map<string, { i: number; x0: number; y0: number; w: number; d: number; h: number; v: number }[]>();
  (world.scenery ?? []).forEach((s, i) => {
    const p = parts();
    const m = p.body;
    const mid = s.at ?? middleOf(s.tiles);
    if (!mid) return;
    const at = { x: mid.x, z: mid.y };
    switch (s.kind) {
      case 'barn': {
        if (s.tiles.length === 0) return;
        const x0 = Math.min(...s.tiles.map((t) => t.x));
        const y0 = Math.min(...s.tiles.map((t) => t.y));
        const w = Math.max(...s.tiles.map((t) => t.x)) - x0 + 1;
        const d = Math.max(...s.tiles.map((t) => t.y)) - y0 + 1;
        const k: Kit = { body: m, glass: p.glass, bulbs: p.bulbs, W: w - 0.24, D: d - 0.24 };
        walls(k, 1.15, C.red, { plinth: C.stoneDark });
        // white corner boards and the big door with its cross braces
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.box(0.08, 1.15, 0.08, 0.02, 1), C.trim, { x: (sx * k.W) / 2, y: 0.575, z: (sz * k.D) / 2 }, { ao: false });
        const f = onFace(k, 'front', 0, 0, 0.01);
        m.add(shapes.box(0.9, 0.95, 0.04, 0.02, 1), C.woodDark, rel(f, 0, 0.475, 0));
        m.add(shapes.box(0.98, 0.06, 0.03), C.trim, rel(f, 0, 0.97, 0.02), { ao: false });
        for (const r of [0.8, -0.8]) m.add(shapes.box(1.2, 0.05, 0.02), C.trim, rel(f, 0, 0.48, 0.03, { rz: r }), { ao: false });
        windowOn(k, 'left', 0, 0.75, {});
        windowOn(k, 'right', 0, 0.75, {});
        gableRoof(k, 1.15, 0.75, C.woodDark, { wall: C.red });
        out.push({ ...piece('', i, { x: x0 + w / 2, z: y0 + d / 2 }, p, 2.0), hx: w / 2 - 0.12, hz: d / 2 - 0.12 });
        return;
      }
      case 'well': {
        const r = SCENERY_SIZE.well;
        m.add(shapes.cyl(r, r + 0.02, 0.42, 16), C.stone, { y: 0.21 });
        m.add(shapes.torus(r - 0.02, 0.04, 16), C.stoneDark, { y: 0.43, rx: Math.PI / 2 }, { ao: false });
        p.water.add(shapes.cyl(r - 0.07, r - 0.07, 0.02, 16), C.waterDeep, { y: 0.34 }, { ao: false });
        for (const sx of [-1, 1]) m.add(shapes.box(0.06, 0.95, 0.06, 0.02, 1), C.woodDark, { x: sx * (r - 0.06), y: 0.62 });
        m.add(shapes.cyl(0.03, 0.03, r * 2, 6), C.wood, { y: 0.88, rz: Math.PI / 2 }, { ao: false });
        m.add(pyramidGeo(), C.coral, { y: 1.12, s: [r * 2.4, 0.3, r * 1.8] }, { ao: false });
        m.add(shapes.cyl(0.06, 0.05, 0.1, 8), C.wood, { y: 0.66 }, { ao: false });
        out.push(piece('', i, at, p, 1.3, r));
        return;
      }
      case 'haybale': {
        const r = SCENERY_SIZE.haybale;
        m.add(shapes.cyl(r - 0.04, r - 0.04, r * 1.7, 16), C.mustard, { y: r - 0.04, rz: Math.PI / 2, ry: hash2(i, 1, 5) * Math.PI }, { top: C.butter });
        out.push(piece('', i, at, p, r * 2, r));
        return;
      }
      case 'rock': {
        const r = SCENERY_SIZE.rock;
        m.add(shapes.blob(r / 1.15, 1), C.rock, { y: 0.1, s: [1.15, 0.75, 1], ry: hash2(i, 2, 5) * 6 });
        m.add(shapes.blob(r * 0.45, 1), C.stoneDark, { x: r * 0.55, y: 0.05, z: r * 0.3, ry: 1 }, { ao: false });
        out.push(piece('', i, at, p, 0.35, r));
        return;
      }
      case 'bush': {
        const g = treeGeometry('bush');
        // the bush's leaves reach 0.4 to one side of its foot: centred, it is SCENERY_SIZE.bush round
        p.sway.addColored(g, { x: -0.05, z: -0.045, s: SCENERY_SIZE.bush / 0.38 });
        g.dispose();
        out.push(piece('', i, at, p, 0.45, SCENERY_SIZE.bush));
        return;
      }
      case 'fence':
      case 'hedge': {
        if (s.tiles.length === 0) return;
        const along = s.dir === 'y' ? 'y' : 'x';
        const xs = s.tiles.map((t) => t.x);
        const ys = s.tiles.map((t) => t.y);
        const len = along === 'x' ? Math.max(...xs) - Math.min(...xs) + 1 : Math.max(...ys) - Math.min(...ys) + 1;
        // built along local X, turned for a run along y
        const ry = along === 'x' ? 0 : Math.PI / 2;
        if (s.kind === 'hedge') {
          const t = SCENERY_SIZE.hedge * 2;
          m.add(shapes.box(len - 0.02, 0.5, t, 0.14, 3), C.leafDeep, { y: 0.25, ry }, { top: C.leaf });
        } else {
          const n = Math.max(2, Math.round(len / 0.5) + 1);
          const c = Math.cos(ry);
          const sn = Math.sin(ry);
          for (let k = 0; k < n; k++) {
            const u = -len / 2 + 0.04 + ((len - 0.08) * k) / (n - 1);
            m.add(shapes.box(0.08, 0.5, 0.08, 0.02, 1), C.trim, { x: u * c, y: 0.25, z: -u * sn, ry });
            m.add(shapes.cone(0.06, 0.08, 4), C.trim, { x: u * c, y: 0.54, z: -u * sn, ry: ry + Math.PI / 4 }, { ao: false });
          }
          for (const y of [0.18, 0.38]) m.add(shapes.box(len - 0.04, 0.05, SCENERY_SIZE.fence, 0.015, 1), C.trim, { y, ry }, { ao: false });
        }
        out.push({ ...piece('', i, at, p, 0.55, 0.1), hx: along === 'x' ? len / 2 : 0.2, hz: along === 'x' ? 0.2 : len / 2 });
        return;
      }
      case 'duck': {
        const y = WATER_LEVEL;
        const ry = hash2(i, 3, 5) * Math.PI * 2;
        m.add(shapes.sphere(0.09, 10, 8), C.white, { y: y + 0.04, s: [1.45, 0.75, 1], ry });
        m.add(shapes.sphere(0.055, 10, 8), C.white, { x: Math.cos(ry) * 0.1, y: y + 0.13, z: -Math.sin(ry) * 0.1 }, { ao: false });
        m.add(shapes.cone(0.025, 0.07, 6), C.orange, { x: Math.cos(ry) * 0.17, y: y + 0.12, z: -Math.sin(ry) * 0.17, ry, rz: -Math.PI / 2 }, { ao: false });
        out.push({ ...piece('', i, at, p, 0.2, 0.12), bob: true });
        return;
      }
      case 'lighthouse':
        lighthouse(p);
        out.push({ ...piece('', i, at, p, 4.45, 0.85), hx: 0.85, hz: 0.85 });
        return;
      case 'hut':
        hut(p, i);
        out.push({ ...piece('', i, at, p, 1.6), hx: 0.86, hz: 0.86 });
        return;
      case 'umbrella':
        umbrella(p, i);
        out.push(piece('', i, at, p, 1.15, SCENERY_SIZE.umbrella));
        return;
      case 'boulder':
        boulder(p, i);
        out.push({ ...piece('', i, at, p, 1.3, SCENERY_SIZE.boulder), hx: 0.85, hz: 0.85 });
        return;
      case 'boat': {
        const along = s.dir === 'y' ? 'y' : 'x';
        boat(p, along);
        out.push({ ...piece('', i, at, p, 0.35), bob: true, hx: along === 'x' ? 0.68 : 0.3, hz: along === 'x' ? 0.3 : 0.68 });
        return;
      }
      case 'block': {
        // gathered by chunk below: one model for all the blocks of 12 × 12 tiles
        if (s.tiles.length === 0) return;
        const x0 = Math.min(...s.tiles.map((t) => t.x));
        const y0 = Math.min(...s.tiles.map((t) => t.y));
        const w = Math.max(...s.tiles.map((t) => t.x)) - x0 + 1;
        const d = Math.max(...s.tiles.map((t) => t.y)) - y0 + 1;
        const key = `${Math.floor((x0 + w / 2) / BLOCK_CHUNK)},${Math.floor((y0 + d / 2) / BLOCK_CHUNK)}`;
        const list = blocks.get(key) ?? [];
        list.push({ i, x0, y0, w, d, h: Math.max(1, s.h ?? 3), v: s.v ?? 0 });
        blocks.set(key, list);
        return;
      }
      case 'taxi': {
        const along = s.dir === 'y' ? 'y' : 'x';
        const len = Math.max(1, s.tiles.length) - 0.24;
        taxi(p, len, along);
        out.push({ ...piece('', i, at, p, 0.7), hx: along === 'x' ? len / 2 : 0.4, hz: along === 'x' ? 0.4 : len / 2 });
        return;
      }
      case 'jetty': {
        const along = s.dir === 'y' ? 'y' : 'x';
        const len = Math.max(1, s.len ?? 6);
        jetty(p, len, along);
        // `at` is the shore end: the piece stands in the middle
        const mid2 = { x: at.x + (along === 'x' ? len / 2 : 0), z: at.z + (along === 'y' ? len / 2 : 0) };
        out.push({ ...piece('', i, mid2, p, 1.1), hx: along === 'x' ? len / 2 : 0.5, hz: along === 'y' ? len / 2 : 0.5 });
        return;
      }
      default:
        return;
    }
  });
  // the blocks of flats, one model per chunk (Westbay has over a hundred: one each was hundreds of meshes for three.js
  // to walk through every frame)
  for (const list of blocks.values()) {
    const p = parts();
    const bx0 = Math.min(...list.map((b) => b.x0));
    const by0 = Math.min(...list.map((b) => b.y0));
    const bx1 = Math.max(...list.map((b) => b.x0 + b.w));
    const by1 = Math.max(...list.map((b) => b.y0 + b.d));
    const cx = (bx0 + bx1) / 2;
    const cz = (by0 + by1) / 2;
    let top = 0;
    for (const b of list) {
      const m = new Matrix4().makeTranslation(b.x0 + b.w / 2 - cx, 0, b.y0 + b.d / 2 - cz);
      p.body.base = p.glass.base = p.bulbs.base = m;
      top = Math.max(top, cityBlock(p, b.w, b.d, b.h, b.v, b.i));
    }
    p.body.base = p.glass.base = p.bulbs.base = null;
    out.push({ ...piece('', list[0].i, { x: cx, z: cz }, p, top), hx: (bx1 - bx0) / 2 - BLOCK_INSET, hz: (by1 - by0) / 2 - BLOCK_INSET });
  }
  return out;
}

/** Blocks of flats are merged by chunks of this many tiles a side (buildScenery). */
const BLOCK_CHUNK = 12;
