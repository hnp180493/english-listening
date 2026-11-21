// Rooms: Sarah's office, Daniel's classroom, Kim's clinic, Max's phone shop.

import type { ColorRepresentation } from 'three';
import type { RoomAnchor } from '../contracts';
import { shapes } from '../../scene/merge';
import { C } from '../../scene/palette3d';
import { ceilingFan, COUNTER, frame, H_NX, H_NZ, H_PX, H_PZ, people, picture, poster, ryFor, SEAT, shell, wallClock, windowAt, type Cast, type Put, type Room } from '../build';
import { books, chair, counter, cup, goods, pendant, plant, potPlant, rug, shelfUnit, table, tableLamp } from '../furniture';

/** An office chair: a padded seat on a stem with a star of five feet, a rounded back. Returns its sit anchor. */
function officeChair(r: Room, x: number, z: number, heading: number, color: ColorRepresentation): RoomAnchor {
  const p = frame(x, z, ryFor(heading));
  const m = r.furn;
  m.add(shapes.box(0.26, 0.05, 0.24, 0.025, 2), color, p(0, SEAT - 0.025, 0));
  m.add(shapes.box(0.24, 0.24, 0.05, 0.025, 2), color, p(0, SEAT + 0.16, -0.12, { rx: -0.1 }), { ao: false });
  m.add(shapes.cyl(0.018, 0.018, SEAT - 0.06, 6), C.metal, p(0, (SEAT - 0.04) / 2, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    m.add(shapes.box(0.13, 0.02, 0.025, 0.008, 1), C.metal, p(Math.cos(a) * 0.065, 0.025, Math.sin(a) * 0.065, { ry: -a }));
  }
  r.block(x, z, 0.14, 0.14, 'office chair');
  return r.seat(x, z, heading);
}

/** A work desk in front of a sitter facing `heading`: top, legs, a monitor facing them, a keyboard, a mug. Returns its chair's anchor. */
function workDesk(r: Room, x: number, z: number, heading: number, chairColor: ColorRepresentation, o: { mug?: boolean; papers?: boolean; lamp?: boolean } = {}): RoomAnchor {
  const ry = ryFor(heading);
  const p = frame(x, z, ry);
  // the desk stands 0.32 in front of the chair
  const d = p(0, 0, 0.34);
  const top = table(r, d.x!, d.z!, 0.78, 0.4, ry, C.woodLight, { legs: C.trim });
  const m = r.furn;
  m.add(shapes.box(0.36, 0.22, 0.025, 0.012, 1), '#2e3142', top(0, 0.18, 0.1));
  r.screens.add(shapes.box(0.32, 0.18, 0.01, 0.008, 1), '#9fd3f5', top(0, 0.18, 0.085));
  r.screens.add(shapes.box(0.14, 0.03, 0.012, 0.008, 1), '#ffffff', top(-0.05, 0.22, 0.083));
  r.screens.add(shapes.box(0.2, 0.025, 0.012, 0.008, 1), C.mint, top(0.02, 0.15, 0.083));
  m.add(shapes.box(0.03, 0.08, 0.03, 0.008, 1), '#2e3142', top(0, 0.05, 0.11), { ao: false });
  m.add(shapes.box(0.12, 0.012, 0.08, 0.008, 1), '#2e3142', top(0, 0.006, 0.11), { ao: false });
  m.add(shapes.box(0.26, 0.012, 0.08, 0.006, 1), C.stone, top(0, 0.008, -0.07), { ao: false });
  m.add(shapes.sphere(0.02, 6, 4), C.white, top(0.2, 0.012, -0.07, { s: [1, 0.5, 1.3] }), { ao: false });
  if (o.mug !== false) cup(r, top, -0.28, -0.05, C.mustard, true, false);
  if (o.papers) for (let i = 0; i < 3; i++) m.add(shapes.box(0.14, 0.006, 0.19, 0.003, 1), C.white, top(0.27, 0.004 + i * 0.006, 0.02, { ry: i * 0.15 }), { ao: false });
  if (o.lamp) tableLamp(r, top, 0.3, 0.1, C.coral);
  return officeChair(r, x, z, heading, chairColor);
}

// ───────────────────────── the office ─────────────────────────

export function office(r: Room): Cast {
  shell(r, { wall: '#f4efe7', wallLeft: '#dfecee', wainscot: '#c9d7e6', wainscotH: 0.4, rail: C.trim, floor: 'planks', floorA: '#dcb88e', floorB: '#cfa87c', skirting: C.trim });
  const f = r.furn;
  rug(r, 0.95, -1.1, 2.2, 1.5, '#8fa3c6', '#c9d1e2', { stripes: '#b7c5df' });
  // Sarah's own desk behind her, two colleagues facing each other across a pair of desks
  workDesk(r, -1.4, -1.55, H_PZ, C.plum, { papers: true, lamp: true });
  const e1 = workDesk(r, 0.42, -1.15, H_PX, C.teal);
  const e2 = workDesk(r, 1.58, -1.15, H_NX, C.coral, { papers: true });
  // a screen between the colleagues
  f.add(shapes.box(0.03, 0.22, 0.72, 0.012, 1), C.lilac, { x: 1.0, y: 0.42, z: -1.15 }, { ao: false });
  // the printer on a low cabinet, paper in its tray
  const pc = r.back(-0.35, 0);
  f.add(shapes.box(0.62, 0.34, 0.34, 0.02, 1), C.stone, pc(0, 0.17, 0.17));
  for (const k of [-1, 1]) f.add(shapes.box(0.26, 0.26, 0.012, 0.006, 1), C.stoneDark, pc(k * 0.15, 0.17, 0.345), { ao: false });
  f.add(shapes.box(0.4, 0.18, 0.28, 0.03, 2), '#eef0f4', pc(0, 0.43, 0.17));
  f.add(shapes.box(0.36, 0.02, 0.2, 0.006, 1), '#2e3142', pc(0, 0.53, 0.16), { ao: false });
  f.add(shapes.box(0.24, 0.012, 0.16, 0.004, 1), C.white, pc(0, 0.36, 0.33, { rx: -0.2 }), { ao: false });
  r.bulbs.add(shapes.sphere(0.012, 6, 4), C.leaf, pc(0.14, 0.46, 0.315));
  goods(f, frame(-0.35, -r.D / 2 + 0.17, 0, 0.34), 0.22, 0.12, 0, 'box', [C.white]);
  r.block(-0.35, -r.D / 2 + 0.17, 0.33, 0.19, 'printer');
  // the whiteboard: a bar chart, lines of writing, magnets
  const wb = r.back(1.0, 1.02);
  r.shell.add(shapes.box(1.3, 0.66, 0.03, 0.01, 1), C.stoneDark, wb(0, 0, 0.015), { ao: false });
  r.shell.add(shapes.box(1.24, 0.6, 0.02, 0.008, 1), C.white, wb(0, 0, 0.03), { ao: false });
  for (let i = 0; i < 4; i++) r.shell.add(shapes.box(0.08, 0.1 + i * 0.07, 0.01, 0.004, 1), [C.blue, C.leaf, C.mustard, C.red][i], wb(-0.42 + i * 0.12, -0.2 + (0.1 + i * 0.07) / 2, 0.042), { ao: false });
  for (let i = 0; i < 4; i++) r.shell.add(shapes.box(0.36 - (i % 2) * 0.1, 0.018, 0.01, 0.004, 1), i ? C.navy : C.red, wb(0.25, 0.18 - i * 0.09, 0.042), { ao: false });
  for (const [x, y, c] of [
    [-0.5, 0.22, C.red],
    [0.5, 0.24, C.mustard],
  ] as const)
    r.shell.add(shapes.cyl(0.025, 0.025, 0.02, 8), c, wb(x, y, 0.045, { rx: Math.PI / 2 }), { ao: false });
  r.shell.add(shapes.box(0.9, 0.025, 0.05, 0.008, 1), C.stoneDark, wb(0, -0.33, 0.04), { ao: false });
  // the water cooler by the left wall
  const wc = r.left(0.6, 0, 0.2);
  f.add(shapes.box(0.26, 0.46, 0.26, 0.03, 2), C.white, wc(0, 0.23, 0));
  f.add(shapes.cyl(0.11, 0.11, 0.26, 14), C.sky, wc(0, 0.6, 0), { ao: false, shade: 0.1 });
  f.add(shapes.cyl(0.12, 0.12, 0.03, 14), C.blue, wc(0, 0.47, 0), { ao: false });
  for (const k of [-1, 1]) f.add(shapes.box(0.03, 0.03, 0.04, 0.008, 1), k < 0 ? C.blue : C.red, wc(k * 0.06, 0.38, 0.14), { ao: false });
  f.add(shapes.cyl(0.025, 0.02, 0.15, 8), C.white, wc(0.16, 0.3, 0.12), { ao: false });
  r.block(-r.W / 2 + 0.2, 0.6, 0.15, 0.15, 'cooler');
  // a filing cabinet, binders, a window with blinds, a clock, plants, ceiling panels
  const fc = r.back(-2.25, 0);
  f.add(shapes.box(0.42, 0.62, 0.36, 0.02, 1), C.stoneDark, fc(0, 0.31, 0.18));
  for (let i = 0; i < 3; i++) {
    f.add(shapes.box(0.36, 0.17, 0.012, 0.006, 1), C.stone, fc(0, 0.11 + i * 0.2, 0.365), { ao: false });
    f.add(shapes.box(0.08, 0.015, 0.02, 0.006, 1), C.metal, fc(0, 0.15 + i * 0.2, 0.375), { ao: false });
  }
  goods(f, frame(-2.25, -r.D / 2 + 0.18, 0, 0.62), -0.18, 0.4, 0, 'box', [C.blue, C.red, C.mustard, C.leaf]);
  potPlant(f, frame(-2.1, -r.D / 2 + 0.2, 0, 0.62), 0.05, 0, 1.4, C.white);
  r.block(-2.25, -r.D / 2 + 0.18, 0.22, 0.2, 'filing cabinet');
  const lw = r.left(-0.55, 1.0);
  windowAt(r, lw, 0.9, 0.6, { frame: C.trim, panes: 3 });
  for (let i = 0; i < 8; i++) r.shell.add(shapes.box(0.92, 0.02, 0.03, 0.006, 1), C.trim, lw(0, 0.26 - i * 0.055, 0.08, { rx: 0.5 }), { ao: false });
  const sh = r.left(-1.6, 0);
  const ys = shelfUnit(r, sh, 0.8, 0.9, 0.26, C.trim, 3);
  r.block(-r.W / 2 + 0.13, -1.6, 0.13, 0.4, 'shelf');
  ys.slice(0, 3).forEach((y, i) => books(f, frame(-r.W / 2 + 0.14, -1.6, Math.PI / 2, y), -0.36, 0.72, 0, i * 4 + 2, 0.2));
  wallClock(r, r.back(-1.4, 1.35), 0.13, C.navy);
  picture(r, r.back(2.2, 1.1), 0.36, 0.46, C.navy, 'landscape', C.sky);
  plant(r, 2.35, -1.75, 1.6, C.white, 'tall');
  plant(r, -2.35, 1.4, 1.3, C.coral, 'palm');
  for (const [x, z] of [
    [-1.4, -1.05],
    [1.0, -1.15],
  ]) {
    r.shell.add(shapes.box(0.8, 0.04, 0.3, 0.015, 1), C.trim, { x, y: 1.42, z }, { ao: false });
    r.bulbs.add(shapes.box(0.74, 0.012, 0.24, 0.006, 1), C.glow, { x, y: 1.398, z });
    for (const k of [-1, 1]) r.shell.add(shapes.cyl(0.004, 0.004, 0.5, 4), C.metal, { x: x + k * 0.35, y: 1.68, z }, { ao: false });
    r.lamp(x, 1.25, z);
    r.halo(x, 1.38, z, 0.9);
  }
  return people({ x: -1.05, z: 0.15 }, { x: -0.05, z: 0.15 }, { x: 0.6, z: -0.35 }, [e1, e2]);
}

// ───────────────────────── the classroom ─────────────────────────

/** A pupil's desk and chair (child size), the pupil facing `heading`. Returns the chair's anchor. */
function pupilDesk(r: Room, x: number, z: number, heading: number, color: ColorRepresentation, seed: number): RoomAnchor {
  const ry = ryFor(heading);
  const p = frame(x, z, ry);
  const d = p(0, 0, 0.27);
  const top = table(r, d.x!, d.z!, 0.44, 0.3, ry, C.woodLight, { h: 0.25, legs: C.metal, apron: false });
  const m = r.furn;
  m.add(shapes.box(0.14, 0.008, 0.2, 0.004, 1), C.white, top(-0.06, 0.005, 0, { ry: 0.2 }), { ao: false });
  m.add(shapes.box(0.012, 0.008, 0.12, 0.004, 1), [C.red, C.blue, C.mustard][seed % 3], top(0.1, 0.008, 0.02, { ry: -0.4 }), { ao: false });
  if (seed % 2) m.add(shapes.box(0.12, 0.03, 0.16, 0.008, 1), [C.coral, C.teal][seed % 2], top(0.12, 0.016, -0.02), { ao: false });
  // the chair
  const cs = 0.135;
  m.add(shapes.box(0.2, 0.03, 0.19, 0.012, 1), color, p(0, cs - 0.015, 0));
  m.add(shapes.box(0.2, 0.13, 0.025, 0.01, 1), color, p(0, cs + 0.1, -0.09), { ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(shapes.box(0.02, cs - 0.03, 0.02, 0.006, 1), C.metal, p(sx * 0.08, (cs - 0.03) / 2, sz * 0.08));
  for (const sx of [-1, 1]) m.add(shapes.box(0.02, 0.15, 0.02, 0.006, 1), C.metal, p(sx * 0.08, cs + 0.05, -0.085), { ao: false });
  r.block(x, z, 0.11, 0.11, 'pupil chair');
  return r.seat(x, z, heading, cs);
}

export function school(r: Room): Cast {
  shell(r, { wall: '#fbeed2', wainscot: '#f2b9a0', wainscotH: 0.48, rail: C.trim, floor: 'planks', floorA: '#d9b07c', floorB: '#c99d69' });
  const f = r.furn;
  const s = r.shell;
  // the blackboard on the left wall: chalk writing, a sun, sums; a chalk ledge
  const bb = r.left(-0.35, 0.98);
  s.add(shapes.box(2.0, 0.78, 0.05, 0.02, 1), C.woodDark, bb(0, 0, 0.025), { ao: false });
  s.add(shapes.box(1.9, 0.68, 0.02, 0.008, 1), '#355446', bb(0, 0, 0.055), { ao: false });
  const chalk = '#eef3e8';
  s.add(shapes.box(0.7, 0.04, 0.01, 0.004, 1), chalk, bb(-0.45, 0.22, 0.068), { ao: false });
  for (let i = 0; i < 4; i++) s.add(shapes.box(0.5 - (i % 2) * 0.12, 0.022, 0.01, 0.004, 1), chalk, bb(-0.5, 0.1 - i * 0.09, 0.068), { ao: false });
  s.add(shapes.torus(0.1, 0.012, 14), C.butter, bb(0.5, 0.12, 0.066), { ao: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s.add(shapes.box(0.05, 0.012, 0.01, 0.004, 1), C.butter, bb(0.5 + Math.cos(a) * 0.15, 0.12 + Math.sin(a) * 0.15, 0.066, { rz: a }), { ao: false });
  }
  s.add(shapes.box(0.3, 0.022, 0.01, 0.004, 1), C.pink, bb(0.45, -0.18, 0.068), { ao: false });
  s.add(shapes.box(1.7, 0.03, 0.08, 0.01, 1), C.woodDark, bb(0, -0.41, 0.07), { ao: false });
  for (let i = 0; i < 3; i++) s.add(shapes.box(0.05, 0.015, 0.015, 0.005, 1), [chalk, C.pink, C.butter][i], bb(-0.3 + i * 0.07, -0.39, 0.08), { ao: false });
  s.add(shapes.box(0.12, 0.03, 0.05, 0.01, 1), C.navy, bb(0.4, -0.38, 0.08), { ao: false });
  // the teacher's desk: a globe, books, an apple, a pot of pencils
  const td = table(r, -1.85, -1.45, 0.9, 0.44, Math.PI / 2, C.wood, { h: COUNTER - 0.04 });
  f.add(shapes.cyl(0.05, 0.06, 0.02, 10), C.woodDark, td(0.2, 0.01, 0), { ao: false });
  f.add(shapes.torus(0.105, 0.008, 16), C.mustard, td(0.2, 0.13, 0, { rz: 0.4, ry: Math.PI / 2 }), { ao: false });
  f.add(shapes.cyl(0.008, 0.008, 0.1, 4), C.mustard, td(0.2, 0.05, 0), { ao: false });
  f.add(shapes.sphere(0.095, 14, 10), C.sky, td(0.2, 0.13, 0));
  for (const [dx, dy] of [
    [0.03, 0.04],
    [-0.04, -0.02],
    [0.05, -0.05],
  ])
    f.add(shapes.sphere(0.04, 8, 6), C.leaf, td(0.2 + dx * 0.6, 0.13 + dy, 0.06, { s: [1, 1, 0.6] }), { ao: false });
  books(f, td, -0.38, 0.22, 0, 7, 0.14);
  f.add(shapes.sphere(0.04, 10, 8), C.red, td(-0.05, 0.04, 0.1), { ao: false });
  f.add(shapes.cyl(0.004, 0.004, 0.03, 4), C.woodDark, td(-0.05, 0.085, 0.1), { ao: false });
  f.add(shapes.cyl(0.03, 0.03, 0.07, 8), C.coral, td(0.0, 0.035, -0.12), { ao: false });
  for (let i = 0; i < 3; i++) f.add(shapes.cyl(0.005, 0.005, 0.1, 4), [C.mustard, C.blue, C.red][i], td(-0.01 + i * 0.01, 0.09, -0.12, { rz: (i - 1) * 0.15 }), { ao: false });
  chair(r, -2.3, -1.45, H_PX, C.wood);
  // pupils' desks in two rows, facing the board
  const a1 = pupilDesk(r, 0.3, -1.4, H_NX, C.mustard, 1);
  const a2 = pupilDesk(r, 1.2, -1.4, H_NX, C.teal, 2);
  const a3 = pupilDesk(r, 0.45, -0.45, H_NX, C.coral, 3);
  pupilDesk(r, 1.35, -0.45, H_NX, C.leaf, 4);
  pupilDesk(r, 2.1, -1.4, H_NX, C.sky, 5);
  // the clock, windows, an alphabet strip, drawings, a cubby shelf, a world map
  wallClock(r, r.back(-0.55, 1.38), 0.14, C.red);
  windowAt(r, r.back(0.85, 1.0), 0.66, 0.58, { curtain: C.mustard, panes: 2 });
  windowAt(r, r.back(1.95, 1.0), 0.66, 0.58, { curtain: C.mustard, panes: 2 });
  const cols = [C.red, C.mustard, C.leaf, C.sky, C.plum, C.orange, C.teal, C.pink];
  for (let i = 0; i < 16; i++) {
    const x = -2.45 + i * 0.32;
    s.add(shapes.box(0.22, 0.2, 0.012, 0.006, 1), C.white, { x, y: 1.52, z: -r.D / 2 + 0.01 }, { ao: false });
    s.add(shapes.box(0.08, 0.1, 0.01, 0.004, 1), cols[i % cols.length], { x, y: 1.52, z: -r.D / 2 + 0.02 }, { ao: false });
  }
  for (const [x, y, c] of [
    [-1.55, 0.98, C.sky],
    [-1.15, 0.86, C.pink],
    [-1.35, 0.66, C.butter],
  ] as const)
    picture(r, r.back(x, y), 0.26, 0.2, c, 'flower', C.white);
  const cb = r.back(-0.35, 0);
  const cy = shelfUnit(r, cb, 0.9, 0.56, 0.28, C.wood, 2, { back: C.woodLight });
  r.block(-0.35, -r.D / 2 + 0.14, 0.45, 0.15, 'cubbies');
  cy.slice(0, 2).forEach((y, i) => {
    for (let k = 0; k < 3; k++) f.add(shapes.box(0.24, 0.17, 0.24, 0.02, 1), cols[(i * 3 + k) % cols.length], frame(-0.35, -r.D / 2 + 0.14, 0, y)(-0.29 + k * 0.29, 0.085, 0), { ao: false });
  });
  const mp = r.left(1.25, 1.0);
  s.add(shapes.box(0.9, 0.56, 0.02, 0.008, 1), C.sky, mp(0, 0, 0.012), { ao: false });
  for (const [x, y, w, h] of [
    [-0.25, 0.08, 0.26, 0.2],
    [0.08, 0.1, 0.22, 0.26],
    [0.28, -0.12, 0.18, 0.16],
    [-0.18, -0.15, 0.14, 0.12],
  ])
    s.add(shapes.sphere(0.5, 10, 6), C.leaf, mp(x, y, 0.025, { s: [w, h, 0.02] }), { ao: false });
  plant(r, 2.35, 1.0, 1.3, C.coral, 'leafy');
  plant(r, -2.35, 1.5, 1.2, C.mustard, 'tall');
  for (const [x, z] of [
    [-1.0, -0.6],
    [1.25, -0.8],
  ])
    pendant(r, x, 1.3, z, C.cream, r.H + 0.4, { wide: true });
  return people({ x: -1.85, z: 0.15 }, { x: -0.85, z: 0.15 }, { x: -0.4, z: -1.05 }, [a3, a1, a2]);
}

// ───────────────────────── the clinic ─────────────────────────

export function clinic(r: Room): Cast {
  shell(r, { wall: '#eef8f3', wallLeft: '#f7fbf9', wainscot: '#a8dcc0', wainscotH: 0.42, rail: C.trim, floor: 'tiles', floorA: '#f3f6f4', floorB: '#d9ebe3', tile: 0.45, skirting: C.teal });
  const f = r.furn;
  const s = r.shell;
  // the reception desk: a counter with a raised front ledge, a computer, a vase, a bell, a clipboard
  const top = counter(r, -1.35, -0.6, 1.8, 0.4, H_PX, C.white, '#d9f0e4', { panels: C.mint, kick: C.teal });
  f.add(shapes.box(1.8, 0.1, 0.08, 0.02, 1), C.mint, frame(-1.35, -0.6, Math.PI / 2, COUNTER)(0, 0.05, 0.2), { ao: false });
  f.add(shapes.box(1.84, 0.02, 0.12, 0.008, 1), C.white, frame(-1.35, -0.6, Math.PI / 2, COUNTER)(0, 0.105, 0.2), { ao: false });
  f.add(shapes.box(0.32, 0.2, 0.025, 0.012, 1), '#2e3142', top(0.45, 0.2, -0.05, { ry: Math.PI }));
  r.screens.add(shapes.box(0.28, 0.16, 0.01, 0.006, 1), '#bfeadb', top(0.45, 0.2, -0.065, { ry: Math.PI }));
  f.add(shapes.box(0.03, 0.09, 0.03, 0.008, 1), '#2e3142', top(0.45, 0.05, -0.04), { ao: false });
  f.add(shapes.cyl(0.035, 0.03, 0.1, 10), C.sky, top(-0.35, 0.16, 0.18), { ao: false });
  for (let i = 0; i < 4; i++) f.add(shapes.sphere(0.03, 6, 4), [C.pink, C.butter, C.rose, C.white][i], top(-0.35 + Math.cos(i * 1.6) * 0.03, 0.24 + (i % 2) * 0.02, 0.18 + Math.sin(i * 1.6) * 0.03), { ao: false });
  f.add(shapes.dome(0.025, 10, 4), C.mustard, top(0.05, 0.11, 0.2), { ao: false });
  f.add(shapes.box(0.12, 0.008, 0.16, 0.004, 1), C.woodDark, top(-0.05, 0.004, 0.02, { ry: 0.3 }), { ao: false });
  f.add(shapes.box(0.1, 0.006, 0.13, 0.003, 1), C.white, top(-0.05, 0.01, 0.02, { ry: 0.3 }), { ao: false });
  // the medicine cabinet behind Kim: doors with a green cross, bottles on open shelves
  const mc = r.left(-0.6, 0);
  f.add(shapes.box(1.2, 0.36, 0.26, 0.02, 1), C.white, mc(0, 0.18, 0.13));
  for (let i = 0; i < 3; i++) f.add(shapes.box(0.36, 0.28, 0.012, 0.008, 1), '#e3f3eb', mc(-0.4 + i * 0.4, 0.18, 0.265), { ao: false });
  r.block(-r.W / 2 + 0.13, -0.6, 0.13, 0.6, 'cabinet');
  const up = r.left(-0.6, 0.72);
  // an open cabinet: back, top, bottom, sides (the bottles show)
  f.add(shapes.box(1.0, 0.62, 0.02, 0.008, 1), '#d6ece2', up(0, 0.31, 0.012));
  for (const y of [0.0, 0.62]) f.add(shapes.box(1.04, 0.035, 0.24, 0.01, 1), C.mint, up(0, y, 0.12), { ao: false });
  for (const sx of [-1, 1]) f.add(shapes.box(0.035, 0.62, 0.24, 0.01, 1), C.mint, up(sx * 0.5, 0.31, 0.12), { ao: false });
  for (const y of [0.18, 0.38]) {
    f.add(shapes.box(0.92, 0.02, 0.2, 0.006, 1), C.white, up(0, y, 0.11), { ao: false });
    goods(f, frame(-r.W / 2 + 0.1, -0.6, Math.PI / 2, 0.72 + y + 0.01), -0.42, 0.84, 0, y < 0.3 ? 'jar' : 'bottle', [C.white, C.sky, C.mustard, C.coral], y < 0.3 ? 1 : 4);
  }
  f.add(shapes.box(0.17, 0.05, 0.02, 0.006, 1), C.leafDeep, up(0, 0.66, 0.06), { ao: false });
  f.add(shapes.box(0.05, 0.17, 0.02, 0.006, 1), C.leafDeep, up(0, 0.66, 0.06), { ao: false });
  // the eye chart on the back wall
  const ec = r.back(-1.2, 1.05);
  s.add(shapes.box(0.42, 0.62, 0.02, 0.008, 1), C.white, ec(0, 0, 0.012), { ao: false });
  const rows = [0.12, 0.09, 0.07, 0.055, 0.042, 0.032, 0.025];
  let y = 0.22;
  rows.forEach((h, i) => {
    const n = i + 1;
    for (let k = 0; k < n; k++) s.add(shapes.box(h * 0.8, h, 0.01, 0.003, 1), '#2e3142', ec(-((n - 1) * h * 1.15) / 2 + k * h * 1.15, y, 0.025), { ao: false });
    y -= h + 0.03;
  });
  s.add(shapes.box(0.32, 0.008, 0.01, 0.003, 1), C.red, ec(0, -0.1, 0.026), { ao: false });
  // waiting chairs along the back wall, a low table with magazines, a plant
  const seats: RoomAnchor[] = [];
  for (let i = 0; i < 3; i++) seats.push(chair(r, -0.3 + i * 0.36, -1.75, H_PZ, C.teal, { legs: C.metal, cushion: C.mint }));
  const mt = table(r, 0.68, -1.72, 0.36, 0.3, 0, C.trim, { h: 0.2, legs: C.metal });
  for (let i = 0; i < 3; i++) f.add(shapes.box(0.12, 0.008, 0.16, 0.004, 1), [C.coral, C.sky, C.butter][i], mt(-0.06 + i * 0.05, 0.004 + i * 0.008, 0, { ry: i * 0.4 - 0.4 }), { ao: false });
  // the examination bed behind a half-drawn curtain
  const bed = frame(1.85, -1.72, 0, 0);
  f.add(shapes.box(1.0, 0.18, 0.42, 0.02, 1), C.white, bed(0, 0.13, 0));
  f.add(shapes.box(1.0, 0.07, 0.42, 0.03, 2), C.mint, bed(0, 0.255, 0), { ao: false });
  f.add(shapes.box(0.22, 0.06, 0.3, 0.03, 2), C.white, bed(0.36, 0.31, 0, { rz: 0.15 }), { ao: false });
  f.add(shapes.box(0.5, 0.01, 0.42, 0.004, 1), '#dff3ea', bed(-0.15, 0.292, 0), { ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.add(shapes.cyl(0.02, 0.02, 0.05, 6), C.metal, bed(sx * 0.45, 0.025, sz * 0.18));
  r.block(1.85, -1.72, 0.5, 0.22, 'exam bed');
  seats.push(r.seat(1.65, -1.62, Math.PI / 2, 0.29));
  f.add(shapes.cyl(0.012, 0.012, 1.0, 4), C.metal, { x: 1.18, y: 1.45, z: -1.6, rx: Math.PI / 2 }, { ao: false });
  for (let i = 0; i < 5; i++) f.add(shapes.box(0.05, 1.12, 0.11, 0.025, 1), i % 2 ? C.mint : '#bfe6d3', { x: 1.18 + (i % 2) * 0.03, y: 0.86, z: -2.02 + i * 0.09, ry: 0.2 }, { ao: false });
  r.block(1.2, -1.83, 0.08, 0.27, 'curtain');
  plant(r, 2.35, -0.95, 1.5, C.white, 'palm');
  plant(r, -0.7, -1.82, 1.2, C.mint, 'leafy');
  // a heart poster, a clock, a window, the fan
  poster(r, r.back(0.5, 1.12), 0.36, 0.46, C.white, C.red, 'circle');
  const hp = r.back(0.5, 1.1);
  s.add(shapes.box(0.08, 0.025, 0.01, 0.004, 1), C.white, hp(0, 0, 0.022), { ao: false });
  s.add(shapes.box(0.025, 0.08, 0.01, 0.004, 1), C.white, hp(0, 0, 0.022), { ao: false });
  wallClock(r, r.back(-0.2, 1.38), 0.13, C.teal);
  windowAt(r, r.back(1.55, 1.05), 0.8, 0.56, { panes: 3, curtain: '#cfeee0' });
  ceilingFan(r, 0.7, -0.6, 1.5);
  for (const z of [-0.2]) pendant(r, -1.35, 1.25, z, C.mint, r.H + 0.4, { wide: true });
  r.lamp(1.3, 1.3, -1.2);
  return people({ x: -1.85, z: -0.4 }, { x: -0.85, z: -0.4 }, { x: -0.3, z: -1.2 }, [seats[0], seats[2], seats[3]], { hostPose: 'counter' });
}

// ───────────────────────── the phone shop ─────────────────────────

/** A phone lying (or standing) on a surface: dark body, a lit screen. */
function phoneOn(r: Room, p: Put, lx: number, lz: number, color: ColorRepresentation, standing = false): void {
  if (standing) {
    r.furn.add(shapes.box(0.05, 0.04, 0.05, 0.01, 1), C.stone, p(lx, 0.02, lz), { ao: false });
    r.furn.add(shapes.box(0.07, 0.13, 0.012, 0.01, 1), '#2e3142', p(lx, 0.1, lz, { rx: -0.25 }), { ao: false });
    r.screens.add(shapes.box(0.06, 0.11, 0.004, 0.004, 1), color, p(lx, 0.1, lz + 0.008, { rx: -0.25 }));
  } else {
    r.furn.add(shapes.box(0.07, 0.01, 0.13, 0.01, 1), '#2e3142', p(lx, 0.005, lz), { ao: false });
    r.screens.add(shapes.box(0.06, 0.004, 0.11, 0.003, 1), color, p(lx, 0.012, lz));
  }
}

export function phone(r: Room): Cast {
  shell(r, { wall: '#f3f6fa', wallLeft: '#d3efe9', floor: 'tiles', floorA: '#eef1f6', floorB: '#e1e7ef', tile: 0.6, skirting: C.teal });
  const f = r.furn;
  const s = r.shell;
  // the repair desk along the left: a mat, an opened phone, tools, a magnifier lamp
  const top = counter(r, -1.35, -0.65, 1.8, 0.4, H_PX, C.white, C.trim, { panels: '#c5ebe4', kick: C.teal });
  f.add(shapes.box(0.36, 0.006, 0.26, 0.004, 1), C.leafDeep, top(0.35, 0.003, -0.02), { ao: false });
  f.add(shapes.box(0.07, 0.012, 0.13, 0.008, 1), '#2e3142', top(0.32, 0.01, -0.02), { ao: false });
  f.add(shapes.box(0.06, 0.008, 0.11, 0.006, 1), C.mustard, top(0.42, 0.01, 0.02, { ry: 0.3 }), { ao: false });
  for (let i = 0; i < 3; i++) f.add(shapes.cyl(0.006, 0.006, 0.12, 4), [C.red, C.blue, C.mustard][i], top(0.18 + i * 0.03, 0.008, 0.08, { rx: Math.PI / 2 }), { ao: false });
  f.add(shapes.cyl(0.05, 0.06, 0.02, 10), C.metal, top(0.62, 0.01, -0.08), { ao: false });
  f.add(shapes.cyl(0.008, 0.008, 0.26, 4), C.metal, top(0.62, 0.14, -0.08, { rz: 0.4 }), { ao: false });
  f.add(shapes.torus(0.06, 0.012, 14), C.white, top(0.58, 0.28, 0.0, { rx: 1.2 }), { ao: false });
  r.bulbs.add(shapes.cyl(0.05, 0.05, 0.006, 12), C.glow, top(0.58, 0.28, 0.0, { rx: 1.2 - Math.PI / 2 }));
  r.halo(-1.35 + 0, 0.68, -0.65 - 0.58, 0.5);
  for (let i = 0; i < 4; i++) f.add(shapes.box(0.06, 0.02, 0.05, 0.008, 1), [C.sky, C.pink, C.mint, C.butter][i], top(-0.1 + (i % 2) * 0.07, 0.01, -0.12 + Math.floor(i / 2) * 0.06), { ao: false });
  phoneOn(r, top, -0.55, 0.05, '#ffcf73', true);
  phoneOn(r, top, -0.7, -0.02, '#9fd3f5', true);
  // boxes of phones on the shelves behind Max, a big phone poster
  const lw = r.left(-0.65, 0);
  const ys = shelfUnit(r, lw, 1.6, 1.0, 0.24, C.white, 3, { back: '#e4f4f1' });
  r.block(-r.W / 2 + 0.12, -0.65, 0.12, 0.8, 'wall shelf');
  ys.slice(0, 3).forEach((y, i) => goods(f, frame(-r.W / 2 + 0.12, -0.65, Math.PI / 2, y), -0.72, 1.44, 0, 'box', i === 1 ? [C.white, '#2e3142'] : [C.white, C.sky, C.white], i));
  poster(r, r.left(-0.65, 1.38), 0.9, 0.3, C.teal, C.white, 'stripes');
  // the shop's sign over the accessories: a big phone with a lit screen and signal bars
  const sg = r.back(-0.05, 1.52);
  s.add(shapes.box(1.2, 0.26, 0.04, 0.03, 2), C.teal, sg(0, 0, 0.02), { ao: false });
  s.add(shapes.box(0.13, 0.22, 0.03, 0.03, 2), C.navy, sg(-0.42, 0, 0.05), { ao: false });
  r.screens.add(shapes.box(0.1, 0.16, 0.01, 0.01, 1), '#9fe3ff', sg(-0.42, 0.005, 0.07));
  for (let i = 0; i < 4; i++) s.add(shapes.box(0.05, 0.05 + i * 0.035, 0.02, 0.008, 1), C.white, sg(-0.22 + i * 0.075, -0.07 + (0.05 + i * 0.035) / 2, 0.05), { ao: false });
  for (let i = 0; i < 3; i++) s.add(shapes.box(0.12, 0.08, 0.02, 0.01, 1), C.white, sg(0.12 + i * 0.15, 0, 0.05), { ao: false });
  r.halo(-0.47, 1.52, -r.D / 2 + 0.1, 0.5);
  // the accessory wall: a pegboard of cases, earphones and cables
  const pb = r.back(-0.05, 0.95);
  s.add(shapes.box(1.9, 0.9, 0.02, 0.008, 1), '#f1dcc0', pb(0, 0, 0.012), { ao: false });
  const accs = [C.pink, C.sky, C.mint, C.mustard, C.coral, C.lilac, C.navy, C.red];
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 7; k++) {
      const x = -0.78 + k * 0.26;
      const yy = 0.28 - row * 0.28;
      s.add(shapes.box(0.012, 0.012, 0.06, 0.004, 1), C.metal, pb(x, yy + 0.08, 0.04), { ao: false });
      const c = accs[(row * 7 + k * 3) % accs.length];
      if (row === 1 && k % 2) {
        s.add(shapes.torus(0.045, 0.01, 10), c, pb(x, yy, 0.05), { ao: false });
        s.add(shapes.box(0.1, 0.14, 0.012, 0.006, 1), C.white, pb(x, yy - 0.02, 0.035), { ao: false });
      } else {
        s.add(shapes.box(0.12, 0.17, 0.02, 0.01, 1), C.white, pb(x, yy - 0.01, 0.045), { ao: false });
        s.add(shapes.box(0.06, 0.11, 0.012, 0.01, 1), c, pb(x, yy - 0.01, 0.058), { ao: false });
      }
    }
  // a screen with an advert, display tables of phones and tablets
  const tv = r.back(1.5, 1.05);
  f.add(shapes.box(0.66, 0.4, 0.04, 0.015, 1), '#2e3142', tv(0, 0, 0.03));
  r.screens.add(shapes.box(0.6, 0.34, 0.01, 0.006, 1), '#8fd6ff', tv(0, 0, 0.055));
  r.screens.add(shapes.box(0.12, 0.24, 0.012, 0.01, 1), C.white, tv(-0.12, 0, 0.06));
  r.screens.add(shapes.box(0.2, 0.04, 0.012, 0.006, 1), C.mustard, tv(0.14, 0.06, 0.06));
  const tables: [number, number][] = [
    [0.4, -1.1],
    [1.45, -0.45],
  ];
  tables.forEach(([x, z], i) => {
    const t = table(r, x, z, 0.82, 0.46, 0, C.white, { h: 0.34, legs: C.white });
    const cols = ['#9fd3f5', '#ffcf73', '#f6b7c6', '#9ad8b6', '#cdb9ef'];
    for (let k = 0; k < 4; k++) phoneOn(r, t, -0.3 + k * 0.2, 0.08, cols[(k + i) % cols.length], k % 2 === 0);
    r.furn.add(shapes.box(0.08, 0.02, 0.06, 0.01, 1), C.stone, t(0.1, 0.01, -0.1), { ao: false });
    r.furn.add(shapes.box(0.26, 0.18, 0.012, 0.012, 1), '#2e3142', t(0.0, 0.12, -0.12, { rx: -0.2 }), { ao: false });
    r.screens.add(shapes.box(0.23, 0.15, 0.004, 0.006, 1), cols[(i + 2) % cols.length], t(0.0, 0.12, -0.112, { rx: -0.2 }));
    r.furn.add(shapes.box(0.84, 0.02, 0.06, 0.008, 1), C.teal, t(0, -0.02, 0.22), { ao: false });
  });
  plant(r, 2.35, -1.75, 1.5, C.white, 'tall');
  plant(r, -0.35, -1.85, 1.0, C.teal, 'leafy');
  rug(r, 1.15, -0.65, 2.4, 1.6, '#e5eef7', '#c5ebe4');
  for (const [x, z] of [
    [0.4, -1.1],
    [1.45, -0.45],
  ])
    pendant(r, x, 1.2, z, C.white, r.H + 0.4, { wide: true });
  pendant(r, -1.35, 1.25, -0.5, C.teal, r.H + 0.4, { light: false });
  return people({ x: -1.85, z: -0.45 }, { x: -0.85, z: -0.45 }, { x: -0.5, z: -1.4 }, [
    { x: 0.4, z: -0.62, heading: H_NZ, pose: 'stand' },
    { x: 1.5, z: 0.02, heading: H_NZ + 0.3, pose: 'stand' },
  ], { hostPose: 'counter' });
}

