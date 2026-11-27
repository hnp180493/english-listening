// What can be ridden (owner, 2026-11-26: "có xe ngựa cho chạy nhanh hơn chẳng hạn", then "xe/ngựa hoặc nhiều thứ
// khác"): a bike, a scooter, a car, a horse, built in code like everything else (merge.ts shapes, vertex colours, the
// town's toon look), each facing +x with its origin on the ground under its middle. The engine (engine3d.ts) parks
// them where the world says (TownWorld.vehicles), puts the player on one (E, or the "Lên xe" button) and moves it with
// them at its own pace; the player sits (the seated pose) at its seat.

import type { BufferGeometry } from 'three';
import type { VehicleKind } from '../../../../data/townWorld';
import { Merge, shapes } from './merge';
import { C } from './palette3d';

export interface RideSpec {
  /** The player's pace riding it (tiles/s; on foot 1.6, running 2.8: sim.ts PLAYER_SPEED / PLAYER_RUN). */
  speed: number;
  /** The seat's height (tile edges): the seated pose's hips there. */
  seat: number;
  /** The seat's place along the vehicle (tiles from its middle, + forward): the vehicle is drawn so the seat is under the player. */
  seatAt: number;
  /**
   * For a figure of real proportions (the VRoid avatars: chars/vrmBody.ts), who does not fill a car from its middle as
   * the round code body does: the driver's seat sideways from the vehicle's middle (tiles, the model's own +z; the
   * steering wheel is in front of it), and the top of its cushion, where such a figure's hips sit (`seat` is how low
   * the round body sinks in). Owner, 2026-11-27, on a driver between the two seats and half sunk in them: "ngồi ô tô
   * gì mà bé tí tẹo vậy, lại còn không ngồi vào ghế".
   */
  side?: number;
  seatSlim?: number;
  /**
   * For such a figure, how much further back than `seatAt` its hips go (tiles, along the vehicle): its back against the
   * seat's back, not sitting forward of it (2026-11-27, the sweep: .assets-try/previews/car-seat-2.png). The hands
   * still reach the wheel (chars/vrmBody.ts reaches from where the hips are). Negative: further forward (a scooter's
   * and a motorbike's rider, whose hands fell short of the grips: admin sheet `?states`).
   */
  seatBack?: number;
  /**
   * Vietnamese, for "Mượn …": whose it is, so riding is borrowing (owner, 2026-11-26: "chạy xe ô tô của người khác có
   * phải là cướp như gta không?": no, a shared bike, a scooter for hire, a car of Rico's taxi firm, the farm's horse).
   */
  name: string;
}

export const RIDES: Readonly<Record<VehicleKind, RideSpec>> = {
  bike: { speed: 3.6, seat: 0.4, seatAt: -0.1, name: 'xe đạp công cộng' },
  // (an avatar a little forward on the seat: from where it sat, its straight arms stopped short of the grips)
  scooter: { speed: 4.6, seat: 0.36, seatAt: -0.12, seatBack: -0.06, name: 'xe máy cho thuê' },
  car: { speed: 5.6, seat: 0.22, seatAt: -0.12, side: -0.13, seatSlim: 0.35, seatBack: 0.04, name: 'xe của hãng taxi Rico' },
  horse: { speed: 4.4, seat: 0.62, seatAt: 0, name: 'ngựa của nông trại' },
  // only bought (data/townGarage.ts): never parked for borrowing
  motorbike: { speed: 6.6, seat: 0.42, seatAt: -0.1, seatBack: -0.05, name: 'mô tô' },
  sportscar: { speed: 8.2, seat: 0.18, seatAt: -0.12, side: -0.14, seatSlim: 0.285, seatBack: 0.04, name: 'siêu xe' },
};

/** Colours a vehicle may come in (by its index: two of a kind are told apart). */
const BODY: Readonly<Record<VehicleKind, readonly string[]>> = {
  // the fourth of each: the garage's own finish (data/townGarage.ts `v: 3`)
  bike: [C.red, C.teal, C.mustard, '#24262d'],
  scooter: [C.mint, C.coral, C.sky, '#efe2c4'],
  car: [C.coral, C.sky, C.mustard, '#d2302c'],
  horse: ['#8a5a3c', '#5b3a29', '#c8a070', '#efebe4'],
  motorbike: ['#c8302c'],
  sportscar: ['#f2b21e'],
};

const TYRE = '#2b2a30';
const CHROME = '#c8ccd6';

/** A wheel standing on the ground at (x, z) along the vehicle, `r` its radius: a tyre ring and a hub. */
function wheel(m: Merge, x: number, z: number, r: number, tube: number): void {
  m.add(shapes.torus(r - tube, tube, 18), TYRE, { x, y: r, z });
  m.add(shapes.cyl(r * 0.28, r * 0.28, tube * 1.6, 10), CHROME, { x, y: r, z, rx: Math.PI / 2 }, { ao: false });
  for (let i = 0; i < 4; i++) m.add(shapes.box(0.012, (r - tube) * 1.9, 0.012, 0.004, 1), CHROME, { x, y: r, z, rz: (i * Math.PI) / 4 }, { ao: false });
}

/** A thin bar from (x0, y0) to (x1, y1) in the vehicle's side plane (z = 0). */
function bar(m: Merge, x0: number, y0: number, x1: number, y1: number, w: number, color: string, z = 0): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  m.add(shapes.box(len, w, w, w / 3, 1), color, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, rz: Math.atan2(y1 - y0, x1 - x0) });
}

function bike(m: Merge, c: string): void {
  wheel(m, -0.27, 0, 0.16, 0.022);
  wheel(m, 0.27, 0, 0.16, 0.022);
  // the frame: a diamond, the fork, the seat post and the bars
  bar(m, -0.27, 0.16, -0.06, 0.38, 0.03, c);
  bar(m, -0.27, 0.16, 0.03, 0.17, 0.03, c);
  bar(m, 0.03, 0.17, -0.06, 0.38, 0.03, c);
  bar(m, 0.03, 0.17, 0.2, 0.4, 0.03, c);
  bar(m, -0.06, 0.38, 0.2, 0.4, 0.03, c);
  bar(m, 0.27, 0.16, 0.21, 0.46, 0.026, CHROME);
  m.add(shapes.box(0.03, 0.03, 0.3, 0.012, 1), CHROME, { x: 0.21, y: 0.47, z: 0 });
  for (const s of [-1, 1]) m.add(shapes.cyl(0.018, 0.018, 0.06, 8), TYRE, { x: 0.21, y: 0.47, z: s * 0.16, rx: Math.PI / 2 }, { ao: false });
  bar(m, -0.08, 0.36, -0.1, 0.42, 0.024, CHROME);
  m.add(shapes.box(0.12, 0.03, 0.07, 0.015, 1), TYRE, { x: -0.1, y: 0.44, z: 0 });
  // a basket on the front
  m.add(shapes.box(0.12, 0.08, 0.14, 0.015, 1), C.wood, { x: 0.33, y: 0.44, z: 0 });
}

function scooter(m: Merge, c: string): void {
  wheel(m, -0.25, 0, 0.12, 0.04);
  wheel(m, 0.27, 0, 0.12, 0.04);
  // the body: a low deck, the rear over the engine, the front shield and the steering column
  m.add(shapes.box(0.36, 0.06, 0.2, 0.025, 2), c, { x: 0.02, y: 0.17, z: 0 });
  m.add(shapes.box(0.3, 0.16, 0.22, 0.06, 2), c, { x: -0.18, y: 0.26, z: 0 });
  m.add(shapes.box(0.08, 0.3, 0.22, 0.03, 2), c, { x: 0.22, y: 0.32, z: 0, rz: -0.25 });
  m.add(shapes.box(0.26, 0.05, 0.19, 0.025, 2), TYRE, { x: -0.14, y: 0.36, z: 0 });
  bar(m, 0.27, 0.12, 0.23, 0.48, 0.03, CHROME);
  m.add(shapes.box(0.04, 0.035, 0.3, 0.015, 1), CHROME, { x: 0.23, y: 0.49, z: 0 });
  m.add(shapes.sphere(0.035, 10, 8), C.cream, { x: 0.27, y: 0.46, z: 0, s: [0.7, 1, 1] }, { ao: false });
  m.add(shapes.box(0.06, 0.04, 0.12, 0.015, 1), C.red, { x: -0.34, y: 0.3, z: 0 }, { ao: false });
}

function car(m: Merge, c: string): void {
  for (const x of [-0.4, 0.4]) for (const z of [-0.29, 0.29]) {
    m.add(shapes.cyl(0.12, 0.12, 0.08, 14), TYRE, { x, y: 0.12, z, rx: Math.PI / 2 });
    m.add(shapes.cyl(0.055, 0.055, 0.085, 10), CHROME, { x, y: 0.12, z, rx: Math.PI / 2 }, { ao: false });
  }
  // the body, a little rounded; open on top (a convertible: whoever drives is seen)
  m.add(shapes.box(1.18, 0.2, 0.62, 0.08, 3), c, { x: 0, y: 0.24, z: 0 });
  m.add(shapes.box(0.36, 0.1, 0.6, 0.06, 2), c, { x: 0.38, y: 0.37, z: 0 });
  m.add(shapes.box(0.3, 0.12, 0.6, 0.06, 2), c, { x: -0.4, y: 0.37, z: 0 });
  for (const z of [-0.29, 0.29]) m.add(shapes.box(0.46, 0.1, 0.05, 0.025, 1), c, { x: -0.02, y: 0.37, z });
  // the windscreen, the seats, the wheel
  m.add(shapes.box(0.03, 0.16, 0.54, 0.015, 1), C.glass, { x: 0.2, y: 0.49, z: 0, rz: 0.35 }, { ao: false });
  for (const z of [-0.13, 0.13]) {
    m.add(shapes.box(0.16, 0.06, 0.2, 0.025, 1), C.cream, { x: -0.14, y: 0.33, z });
    m.add(shapes.box(0.05, 0.16, 0.2, 0.025, 1), C.cream, { x: -0.23, y: 0.4, z, rz: 0.15 });
  }
  m.add(shapes.torus(0.06, 0.012, 14), TYRE, { x: 0.08, y: 0.45, z: -0.13, ry: Math.PI / 2, rz: 0.5 });
  // lights and bumpers
  for (const z of [-0.22, 0.22]) {
    m.add(shapes.sphere(0.045, 10, 8), C.cream, { x: 0.59, y: 0.27, z, s: [0.5, 1, 1] }, { ao: false });
    m.add(shapes.box(0.03, 0.05, 0.08, 0.012, 1), C.red, { x: -0.59, y: 0.28, z }, { ao: false });
  }
  for (const x of [-0.6, 0.6]) m.add(shapes.box(0.04, 0.05, 0.6, 0.02, 1), CHROME, { x, y: 0.16, z: 0 }, { ao: false });
}

function horse(m: Merge, c: string): void {
  const dark = '#3b2a22';
  // the body, the neck and head, the legs, the tail; a saddle with a blanket
  m.add(shapes.sphere(0.2, 16, 12), c, { x: 0, y: 0.52, z: 0, s: [1.55, 0.95, 0.85] });
  bar(m, 0.24, 0.58, 0.38, 0.84, 0.13, c);
  m.add(shapes.box(0.26, 0.11, 0.12, 0.05, 2), c, { x: 0.46, y: 0.86, z: 0, rz: -0.55 });
  m.add(shapes.box(0.06, 0.04, 0.1, 0.015, 1), dark, { x: 0.56, y: 0.79, z: 0, rz: -0.55 }, { ao: false });
  for (const z of [-0.035, 0.035]) m.add(shapes.cone(0.025, 0.07, 6), c, { x: 0.37, y: 0.97, z });
  for (const z of [-0.05, 0.05]) m.add(shapes.sphere(0.014, 6, 5), dark, { x: 0.46, y: 0.9, z: z * 1.3 }, { ao: false });
  bar(m, 0.17, 0.66, 0.36, 0.92, 0.05, dark, 0);
  for (const [x, z] of [
    [0.2, -0.08],
    [0.2, 0.08],
    [-0.2, -0.08],
    [-0.2, 0.08],
  ] as const) {
    m.add(shapes.cyl(0.035, 0.03, 0.4, 8), c, { x, y: 0.2, z });
    m.add(shapes.cyl(0.036, 0.036, 0.05, 8), dark, { x, y: 0.025, z }, { ao: false });
  }
  bar(m, -0.3, 0.56, -0.42, 0.3, 0.05, dark);
  m.add(shapes.box(0.26, 0.03, 0.3, 0.012, 1), C.red, { x: 0, y: 0.69, z: 0 });
  m.add(shapes.box(0.2, 0.06, 0.2, 0.03, 2), '#6b4430', { x: 0, y: 0.72, z: 0 });
}

function motorbike(m: Merge, c: string): void {
  wheel(m, -0.31, 0, 0.17, 0.05);
  wheel(m, 0.33, 0, 0.17, 0.05);
  const black = '#1c1d22';
  // the engine and frame low in the middle, the tank, the long seat, the tail
  m.add(shapes.box(0.26, 0.17, 0.16, 0.04, 2), '#3a3c44', { x: 0, y: 0.25, z: 0 });
  for (const z of [-0.09, 0.09]) m.add(shapes.cyl(0.035, 0.035, 0.12, 10), CHROME, { x: 0.02, y: 0.25, z, rx: Math.PI / 2 }, { ao: false });
  m.add(shapes.sphere(0.13, 14, 10), c, { x: 0.1, y: 0.42, z: 0, s: [1.35, 0.7, 0.85] });
  m.add(shapes.box(0.34, 0.06, 0.18, 0.03, 2), black, { x: -0.17, y: 0.43, z: 0 });
  m.add(shapes.box(0.2, 0.07, 0.15, 0.03, 2), c, { x: -0.36, y: 0.42, z: 0, rz: 0.2 });
  bar(m, -0.31, 0.17, -0.08, 0.34, 0.04, black);
  // the exhaust along the right side, up to the tail
  bar(m, 0.02, 0.18, -0.4, 0.26, 0.045, CHROME, 0.11);
  // the fork, the bars, the headlight
  for (const z of [-0.06, 0.06]) bar(m, 0.33, 0.17, 0.25, 0.53, 0.032, CHROME, z);
  m.add(shapes.box(0.04, 0.035, 0.36, 0.015, 1), CHROME, { x: 0.24, y: 0.56, z: 0 });
  for (const s of [-1, 1]) m.add(shapes.cyl(0.02, 0.02, 0.07, 8), black, { x: 0.24, y: 0.56, z: s * 0.19, rx: Math.PI / 2 }, { ao: false });
  m.add(shapes.sphere(0.05, 12, 8), C.cream, { x: 0.32, y: 0.48, z: 0, s: [0.7, 1, 1] }, { ao: false });
  m.add(shapes.box(0.04, 0.03, 0.1, 0.012, 1), C.red, { x: -0.46, y: 0.44, z: 0 }, { ao: false });
}

function sportscar(m: Merge, c: string): void {
  const black = '#1c1d22';
  for (const x of [-0.44, 0.44]) for (const z of [-0.33, 0.33]) {
    m.add(shapes.cyl(0.13, 0.13, 0.1, 16), TYRE, { x, y: 0.13, z, rx: Math.PI / 2 });
    m.add(shapes.cyl(0.08, 0.08, 0.105, 12), '#9aa0ab', { x, y: 0.13, z, rx: Math.PI / 2 }, { ao: false });
  }
  // a low, wide body: the long nose sloping down, the open cockpit, the rear over the engine, the wing
  m.add(shapes.box(1.34, 0.15, 0.72, 0.07, 3), c, { x: 0, y: 0.2, z: 0 });
  m.add(shapes.box(0.46, 0.08, 0.68, 0.05, 2), c, { x: 0.4, y: 0.29, z: 0, rz: -0.12 });
  m.add(shapes.box(0.4, 0.13, 0.7, 0.06, 2), c, { x: -0.42, y: 0.32, z: 0 });
  for (const z of [-0.33, 0.33]) m.add(shapes.box(0.5, 0.08, 0.06, 0.03, 1), c, { x: -0.02, y: 0.3, z });
  for (const z of [-0.36, 0.36]) m.add(shapes.box(0.22, 0.07, 0.02, 0.01, 1), black, { x: -0.26, y: 0.22, z }, { ao: false });
  m.add(shapes.box(0.03, 0.12, 0.62, 0.015, 1), C.glass, { x: 0.12, y: 0.38, z: 0, rz: 0.55 }, { ao: false });
  for (const z of [-0.14, 0.14]) {
    m.add(shapes.box(0.17, 0.05, 0.21, 0.025, 1), black, { x: -0.12, y: 0.27, z });
    m.add(shapes.box(0.05, 0.17, 0.21, 0.025, 1), black, { x: -0.22, y: 0.35, z, rz: 0.3 });
  }
  m.add(shapes.torus(0.055, 0.012, 14), black, { x: 0.02, y: 0.36, z: -0.14, ry: Math.PI / 2, rz: 0.6 });
  for (const z of [-0.24, 0.24]) m.add(shapes.box(0.04, 0.12, 0.04, 0.015, 1), black, { x: -0.6, y: 0.44, z });
  m.add(shapes.box(0.16, 0.025, 0.72, 0.012, 1), black, { x: -0.62, y: 0.51, z: 0 });
  for (const z of [-0.25, 0.25]) {
    m.add(shapes.box(0.03, 0.035, 0.14, 0.012, 1), C.cream, { x: 0.66, y: 0.23, z }, { ao: false });
    m.add(shapes.box(0.03, 0.035, 0.16, 0.012, 1), C.red, { x: -0.66, y: 0.28, z }, { ao: false });
  }
  for (const z of [-0.08, 0.08]) m.add(shapes.cyl(0.03, 0.03, 0.06, 10), CHROME, { x: -0.68, y: 0.16, z, rz: Math.PI / 2 }, { ao: false });
}

/** The model of a vehicle (`v`: which of its colours), facing +x, origin on the ground under its middle. */
export function vehicleGeometry(kind: VehicleKind, v: number): BufferGeometry | null {
  const m = new Merge();
  const colours = BODY[kind];
  const c = colours[((v % colours.length) + colours.length) % colours.length];
  if (kind === 'bike') bike(m, c);
  else if (kind === 'scooter') scooter(m, c);
  else if (kind === 'car') car(m, c);
  else if (kind === 'motorbike') motorbike(m, c);
  else if (kind === 'sportscar') sportscar(m, c);
  else horse(m, c);
  return m.build();
}
