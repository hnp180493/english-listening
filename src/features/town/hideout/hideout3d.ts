// The learner's hideout on Westbay's map (data/city/hideout.ts; docs/town.md §29): a one-room brick lock-up behind
// Gus's hut on Pier Road, in two looks the stage draws as "projects" (engine/extraDecor.ts, three/scene/props3d.ts
// registerProjects): before it is bought, shut and to let (boarded windows, the shutter down, a TO LET board, no light
// in it); after, lived in (glass that glows at night like every lit window, curtains, a lamp over the door, a plant,
// a mat). Built with the places' kit, so it looks like the rest of the street. Imported (for its registration) by
// the city's page, so none of it is in the town's chunk.

import type { Tile } from '../../../data/townWorld';
import { HIDEOUT_HOME, HIDEOUT_LET, HIDEOUT_LOT, HIDEOUT_DOOR } from '../../../data/city/hideout';
import { door, flatRoof, onFace, pot, rel, walls, windowOn, type Kit } from '../three/scene/kit';
import { shapes } from '../three/scene/merge';
import { C } from '../three/scene/palette3d';
import { kitFor } from '../three/scene/places3d';
import { registerProjects, type Piece } from '../three/scene/props3d';

const BRICK = '#b8735c';
const BRICK_DARK = '#94584a';
const SHUTTER = '#8c95a3';
const WALL_H = 1.18;

/** The shell both looks share: brick walls, a stone plinth, a lintel course, a flat roof with a parapet. */
function shell(k: Kit): number {
  walls(k, WALL_H, BRICK, { plinth: C.stoneDark });
  // a darker course of brick under the roof and over the openings
  k.body.add(shapes.box(k.W + 0.03, 0.07, k.D + 0.03, 0.02, 1), BRICK_DARK, { y: WALL_H - 0.12 }, { ao: false });
  return flatRoof(k, WALL_H, C.stoneDark, { ledge: C.stone, h: 0.1 });
}

/** The lock-up's roller shutter on the right of the front (down and dull before it is bought, up a little after). */
function shutter(k: Kit, u: number, up: number): void {
  const at = Math.min(k.W / 2 - 0.42, u + 0.78);
  const f = onFace(k, 'front', at, 0, 0);
  const h = 0.78;
  k.body.add(shapes.box(0.74, h + 0.06, 0.05, 0.02, 1), C.stoneDark, rel(f, 0, h / 2, 0.02), { ao: false });
  const shown = h * (1 - up);
  for (let i = 0; i < 8; i++) {
    const y = h - (i + 0.5) * (h / 8);
    if (y < h - shown) continue;
    k.body.add(shapes.box(0.66, h / 8 - 0.01, 0.03, 0.01, 1), SHUTTER, rel(f, 0, y, 0.045), { ao: false });
  }
  if (up > 0) k.body.add(shapes.box(0.66, h - shown, 0.02), '#3a3f4c', rel(f, 0, (h - shown) / 2, 0.03), { ao: false });
  k.body.add(shapes.box(0.08, 0.03, 0.04), C.metal, rel(f, 0, h - shown + 0.03, 0.07), { ao: false });
}

/** A window boarded over: its frame and three planks, no glass (nothing glows). */
function boarded(k: Kit, u: number, v: number): void {
  const f = onFace(k, 'front', u, v, 0);
  k.body.add(shapes.box(0.4, 0.42, 0.05, 0.02, 1), C.trim, rel(f, 0, 0, 0.02), { ao: false });
  k.body.add(shapes.box(0.32, 0.34, 0.03), '#2f3340', rel(f, 0, 0, 0.035), { ao: false });
  for (const [dy, rz] of [[0.1, 0.12], [-0.02, -0.08], [-0.12, 0.05]] as const) k.body.add(shapes.box(0.44, 0.07, 0.025, 0.01, 1), C.woodLight, rel(f, 0, dy, 0.06, { rz }), { ao: false });
}

function letLook(k: Kit, u: number): number {
  const top = shell(k);
  boarded(k, u - 0.62, 0.62);
  door(k, u, { color: '#5b4a43' });
  shutter(k, u, 0);
  // the TO LET board on the wall over the shutter: red, white letters (bars), a phone number under them
  const at = Math.min(k.W / 2 - 0.42, u + 0.78);
  const f = onFace(k, 'front', at, 0.98, 0);
  k.body.add(shapes.box(0.56, 0.26, 0.035, 0.015, 1), C.red, rel(f, 0, 0, 0.03), { ao: false });
  for (let i = 0; i < 5; i++) k.body.add(shapes.box(0.06, 0.09, 0.01), C.white, rel(f, -0.18 + i * 0.09, 0.04, 0.05), { ao: false });
  k.body.add(shapes.box(0.4, 0.03, 0.01), C.white, rel(f, 0, -0.07, 0.05), { ao: false });
  // weeds at the foot of the wall, a padlock on the shutter
  for (const dx of [-0.9, 0.1, 0.95]) k.body.add(shapes.cone(0.05, 0.12, 5), C.leafDeep, rel(onFace(k, 'front', dx, 0, 0), 0, 0.06, 0.08), { ao: false });
  return top;
}

function homeLook(k: Kit, u: number): number {
  const top = shell(k);
  // the window: glass (it glows at night like every lit window of the street), curtains drawn to the sides, a sill
  windowOn(k, 'front', u - 0.62, 0.62, { w: 0.34, h: 0.36, frame: C.trim, flowers: true });
  const f = onFace(k, 'front', u - 0.62, 0.62, 0);
  for (const s of [-1, 1]) k.body.add(shapes.box(0.08, 0.34, 0.02, 0.01, 1), C.teal, rel(f, s * 0.13, 0, 0.032), { ao: false });
  windowOn(k, 'left', 0, 0.62, { w: 0.3, h: 0.32, frame: C.trim });
  door(k, u, { color: C.teal, lamp: true, glass: true });
  shutter(k, u, 0.55);
  // a brass number by the door, a mat, a plant, a bike against the wall
  const d = onFace(k, 'front', u + 0.3, 0.72, 0);
  k.body.add(shapes.box(0.1, 0.12, 0.015, 0.005, 1), C.mustard, rel(d, 0, 0, 0.03), { ao: false });
  k.body.add(shapes.box(0.36, 0.015, 0.2, 0.006, 1), C.plum, { x: u, y: 0.01, z: k.D / 2 + 0.14 }, { ao: false });
  pot(k.body, u - 0.36, k.D / 2 + 0.14, 0, C.coral);
  pot(k.body, u - 0.95, k.D / 2 + 0.12, 0, C.teal);
  return top;
}

const LOOKS: Readonly<Record<string, (k: Kit, u: number) => number>> = { [HIDEOUT_LET]: letLook, [HIDEOUT_HOME]: homeLook };

/** The model of one look at its ground point (the lot's middle), as a project's piece. */
export function hideoutPiece(id: string, at: Tile, index: number): Piece {
  const lot = { ...HIDEOUT_LOT, face: 'y' as const, door: HIDEOUT_DOOR };
  // (the door is on the lot's +y face, its tile the one in front of it: the kit wants the door's tile on the lot's edge)
  const f = kitFor({ ...lot, door: { x: HIDEOUT_DOOR.x, y: lot.y + lot.d - 1 } });
  const height = (LOOKS[id] ?? letLook)(f.k, f.u);
  return {
    pop: id,
    index,
    x: at.x,
    z: at.y,
    ry: f.ry,
    body: f.k.body.build(),
    glass: f.k.glass.build(),
    bulbs: f.k.bulbs.build(),
    water: null,
    sway: null,
    height,
    hx: lot.w / 2 - 0.1,
    hz: lot.d / 2 - 0.1,
  };
}

registerProjects({
  [HIDEOUT_LET]: (at, i) => hideoutPiece(HIDEOUT_LET, at, i),
  [HIDEOUT_HOME]: (at, i) => hideoutPiece(HIDEOUT_HOME, at, i),
});
