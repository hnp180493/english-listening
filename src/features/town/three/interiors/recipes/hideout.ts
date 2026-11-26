// The learner's hideout in Westbay (data/city/hideout.ts; docs/town.md §29): one room of a brick lock-up behind Gus's
// hut. A bed under the little window, a desk with a tape deck (the tape of lines heard wrong: "Nghe lại băng") and a
// radio (Bay FM), a wardrobe ("Đổi đồ"), a map of Westbay pinned on the wall with the jobs' places, a mug, a rug. Nobody
// lives here but the learner (and their pet): the "host" anchor is the chair at the desk, only for the shot.

import { shapes } from '../../scene/merge';
import { C } from '../../scene/palette3d';
import { H_NZ, people, shell, wallClock, windowAt, type Cast, type Room } from '../build';
import { chair, cup, floorLamp, pendant, plant, rug, table, tableLamp } from '../furniture';

export function hideout(r: Room): Cast {
  shell(r, { wall: '#d8a48c', wallLeft: '#e2b6a0', stripes: '#cf9a82', floor: 'boards', floorA: '#8f6e54', floorB: '#7d5f48', skirting: C.woodDark });
  const f = r.furn;
  const back = -r.D / 2;
  const left = -r.W / 2;

  // the bed along the left wall, under the little window: a frame, the mattress, a blanket, a pillow
  const bx = left + 0.42;
  const bz = 0.1;
  f.add(shapes.box(0.74, 0.2, 1.5, 0.03, 2), C.woodDark, { x: bx, y: 0.1, z: bz });
  f.add(shapes.box(0.68, 0.1, 1.44, 0.04, 2), C.cream, { x: bx, y: 0.25, z: bz });
  f.add(shapes.box(0.7, 0.06, 0.92, 0.03, 2), C.navy, { x: bx, y: 0.32, z: bz + 0.25 }, { ao: false });
  f.add(shapes.box(0.5, 0.08, 0.24, 0.04, 2), C.white, { x: bx, y: 0.34, z: bz - 0.55 }, { ao: false });
  f.add(shapes.box(0.74, 0.42, 0.06, 0.02, 1), C.woodDark, { x: bx, y: 0.3, z: bz - 0.76 });
  r.block(bx, bz, 0.38, 0.76, 'bed');
  windowAt(r, r.left(bz, 0.95), 0.5, 0.36, { curtain: C.teal, panes: 2 });

  // the wardrobe on the back wall, left
  const wx = left + 1.25;
  f.add(shapes.box(0.72, 1.24, 0.42, 0.03, 2), C.wood, { x: wx, y: 0.62, z: back + 0.24 });
  f.add(shapes.box(0.015, 1.12, 0.02), C.woodDark, { x: wx, y: 0.64, z: back + 0.455 }, { ao: false });
  for (const s of [-1, 1]) f.add(shapes.sphere(0.022, 8, 6), C.mustard, { x: wx + s * 0.05, y: 0.66, z: back + 0.47 }, { ao: false });
  f.add(shapes.box(0.76, 0.05, 0.46, 0.02, 1), C.woodDark, { x: wx, y: 1.26, z: back + 0.24 }, { ao: false });
  // a suitcase on top, a jacket on a hook beside it
  f.add(shapes.box(0.44, 0.14, 0.3, 0.03, 2), C.coral, { x: wx, y: 1.36, z: back + 0.24 }, { ao: false });
  f.add(shapes.box(0.2, 0.42, 0.06, 0.03, 2), C.plum, { x: wx + 0.56, y: 0.92, z: back + 0.07 }, { ao: false });
  r.block(wx, back + 0.24, 0.38, 0.23, 'wardrobe');

  // the map of Westbay on the back wall: the bay in blue, the streets, red pins where the jobs were
  const mp = r.back(0.15, 0.98);
  r.shell.add(shapes.box(0.9, 0.62, 0.02, 0.006, 1), C.cream, mp(0, 0, 0.012), { ao: false });
  r.shell.add(shapes.box(0.36, 0.22, 0.01), C.sky, mp(-0.24, -0.17, 0.024), { ao: false });
  for (const y of [-0.12, 0.02, 0.17]) r.shell.add(shapes.box(0.82, 0.018, 0.01), C.stoneDark, mp(0, y, 0.026), { ao: false });
  for (const x of [-0.3, -0.02, 0.24]) r.shell.add(shapes.box(0.018, 0.54, 0.01), C.stoneDark, mp(x, 0, 0.026), { ao: false });
  for (const [x, y, c] of [[0.24, -0.12, C.red], [-0.02, 0.17, C.red], [0.33, -0.2, C.mustard], [-0.3, 0.02, C.red]] as const) {
    r.shell.add(shapes.sphere(0.022, 8, 6), c, mp(x, y, 0.04), { ao: false });
  }
  // a string from pin to pin
  r.shell.add(shapes.box(0.36, 0.006, 0.006), C.red, mp(0.11, 0.025, 0.042, { rz: -1.0 }), { ao: false });

  // the desk on the back wall, right: the tape deck, the radio, a lamp, a mug, a notebook
  const dx = 1.15;
  const desk = table(r, dx, back + 0.32, 1.1, 0.46, 0, C.woodLight, { h: 0.4 });
  // the tape deck: a black box, two reels behind a window, the keys along the front
  f.add(shapes.box(0.36, 0.1, 0.22, 0.02, 1), '#2c2f3a', desk(-0.26, 0.05, -0.02), { ao: false });
  for (const s of [-1, 1]) f.add(shapes.cyl(0.04, 0.04, 0.012, 14), C.cream, desk(-0.26 + s * 0.08, 0.106, -0.04), { ao: false });
  for (let i = 0; i < 5; i++) f.add(shapes.box(0.04, 0.02, 0.03, 0.006, 1), i === 1 ? C.red : C.stone, desk(-0.38 + i * 0.06, 0.08, 0.08), { ao: false });
  r.screens.add(shapes.box(0.08, 0.025, 0.01), '#8ff0b6', desk(-0.13, 0.07, 0.091));
  // the radio: a teal box, a dial, a speaker grille, an aerial
  f.add(shapes.box(0.26, 0.15, 0.13, 0.03, 2), C.teal, desk(0.12, 0.075, -0.04), { ao: false });
  f.add(shapes.cyl(0.035, 0.035, 0.012, 12), C.cream, desk(0.18, 0.08, 0.03, { rx: Math.PI / 2 }), { ao: false });
  f.add(shapes.box(0.1, 0.09, 0.01), C.stoneDark, desk(0.06, 0.075, 0.026), { ao: false });
  f.add(shapes.cyl(0.004, 0.004, 0.3, 4), C.metal, desk(0.22, 0.28, -0.07, { rz: -0.4 }), { ao: false });
  tableLamp(r, desk, 0.42, -0.08, C.mustard, true);
  cup(r, desk, 0.34, 0.12, C.coral, true, false);
  f.add(shapes.box(0.16, 0.015, 0.2, 0.005, 1), C.mustard, desk(-0.02, 0.008, 0.1, { ry: 0.3 }), { ao: false });
  const seat = chair(r, dx - 0.1, back + 0.86, H_NZ, C.woodDark, { cushion: C.teal });

  // the middle: a rug, a crate for a table, a plant, the lights
  rug(r, 0.2, 0.25, 1.8, 1.3, '#a8544c', C.mustard, { stripes: '#d99a5c' });
  f.add(shapes.box(0.36, 0.26, 0.36, 0.03, 2), C.woodLight, { x: -0.55, y: 0.13, z: 0.85 });
  cup(r, (lx, ly, lz, e = {}) => ({ ...e, x: -0.55 + lx, y: 0.26 + ly, z: 0.85 + lz }), 0.05, 0.02, C.white, false, false);
  r.block(-0.55, 0.85, 0.18, 0.18, 'crate');
  plant(r, r.W / 2 - 0.35, back + 0.35, 1.1, C.coral, 'tall');
  floorLamp(r, left + 0.35, back + 0.35, C.butter);
  pendant(r, 0.2, r.H - 0.25, 0.1, C.cream);
  wallClock(r, r.left(-1.05, 1.15), 0.12, C.woodDark, 1);
  r.lamp(0.2, r.H - 0.35, 0.1);

  // the shot: the learner in the middle of the room, the desk (the chair: "host") beside them, the bed behind
  return people({ x: seat.x, z: seat.z }, { x: 0.15, z: 0.55 }, { x: 1.4, z: 0.9 }, [], { y: 0.5 });
}
