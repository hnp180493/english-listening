// The street furniture in the world (docs/town.md §26): the bench and the street lamp each district draws at the
// spots the town already had (data/townFurniture.ts DISTRICT_LOOKS; the classic ones stay props3d.ts benchParts /
// streetLamp), and the small things (bins, bike racks, post boxes, crates, pots, hydrants, newspaper boxes, picnic
// tables) of TownWorld.furniture, merged by chunks of 12 × 12 tiles like the city's blocks: a few draw calls for a
// whole map, and the camera culls the far chunks. The models are furniture.ts.

import type { BufferGeometry } from 'three';
import { groundHeight, type TownWorld } from '../../../../data/townWorld';
import type { BenchLook, LampLook, WorldFurniture } from '../../../../data/townFurniture';
import { buildFurniture, type FurnitureId, type FurnitureModel } from './furniture';
import { lampArm } from './layout';
import { Merge } from './merge';
import type { Piece } from './props3d';

const models = new Map<FurnitureId, FurnitureModel>();

/** A piece's model, made once and kept for the session (pieces take copies: a layout's pruning disposes its own). */
function model(id: FurnitureId): FurnitureModel {
  let m = models.get(id);
  if (!m) {
    m = buildFurniture(id);
    models.set(id, m);
  }
  return m;
}

const copy = (g: BufferGeometry | null): BufferGeometry | null => (g ? g.clone() : null);

/** How high a model reaches (tiles). */
const topOf = (m: FurnitureModel): number => Math.max(...[m.body, m.bulbs, m.sway].map((g) => g?.boundingBox?.max.y ?? 0));

/** The turn of a thing whose front looks to +y (0) or to +x (a quarter turn): local +z is its front. */
export const faceTurn = (face: WorldFurniture['face']): number => (face === 'x' ? Math.PI / 2 : 0);

/** A bench's turn by the way it looks (as props3d.ts benchParts). */
const benchTurn = (dir: 'e' | 's' | 'w' | undefined): number => (dir === 'e' ? Math.PI / 2 : dir === 'w' ? -Math.PI / 2 : 0);

/** A bench of a district's own look at (x, z), looking `dir`: the seat at SEAT_TOP like the classic one's. */
export function benchPiece(look: Exclude<BenchLook, 'classic'>, at: { x: number; z: number }, dir: 'e' | 's' | 'w' | undefined, pop: string, index: number): Piece {
  const m = model(look);
  return { pop, index, x: at.x, z: at.z, ry: benchTurn(dir), body: copy(m.body), bulbs: copy(m.bulbs), sway: copy(m.sway), height: 0.55, hx: 0.4, hz: 0.4 };
}

/**
 * A street lamp of a district's own look standing at (x, z): the lantern, or the two globes with their bar along the
 * way the classic lamp's arm would reach (one globe over the path). Its bulbs glow at night (the bulb material);
 * layout.ts lampLight puts its light where they are.
 */
export function lampPiece(look: Exclude<LampLook, 'classic'>, at: { x: number; z: number }, flip: boolean | undefined, pop: string, index: number): Piece {
  const m = model(look);
  const a = lampArm(flip);
  const ry = look === 'lamp-globes' ? -Math.atan2(a.y, a.x) : 0;
  return { pop, index, x: at.x, z: at.z, ry, body: copy(m.body), bulbs: copy(m.bulbs), sway: copy(m.sway), height: topOf(m), hx: 0.18, hz: 0.18 };
}

/** One small thing on its own, where it stands (the colliders' test measures these). */
export function furniturePiece(f: WorldFurniture, index: number): Piece {
  const m = model(f.kind);
  return { pop: '', index, x: f.x, z: f.y, ry: faceTurn(f.face), body: copy(m.body), bulbs: copy(m.bulbs), sway: copy(m.sway), height: topOf(m), hx: 0.4, hz: 0.4 };
}

/** The small things are merged by chunks of this many tiles a side. */
export const FURNITURE_CHUNK = 12;

/**
 * All the small things of a world, one piece per chunk of FURNITURE_CHUNK tiles (body, glowing bulbs, the pots'
 * leaves that sway). On a hill each thing stands on the ground under it, not under the chunk's middle.
 */
export function buildStreetFurniture(world: TownWorld): Piece[] {
  const chunks = new Map<string, { f: WorldFurniture; i: number }[]>();
  (world.furniture ?? []).forEach((f, i) => {
    const key = `${Math.floor(f.x / FURNITURE_CHUNK)},${Math.floor(f.y / FURNITURE_CHUNK)}`;
    const list = chunks.get(key) ?? [];
    list.push({ f, i });
    chunks.set(key, list);
  });
  const out: Piece[] = [];
  for (const list of chunks.values()) {
    const x0 = Math.min(...list.map((e) => e.f.x));
    const x1 = Math.max(...list.map((e) => e.f.x));
    const z0 = Math.min(...list.map((e) => e.f.y));
    const z1 = Math.max(...list.map((e) => e.f.y));
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const g0 = groundHeight(cx, cz, world);
    const body = new Merge();
    const bulbs = new Merge();
    const sway = new Merge();
    let top = 0;
    for (const { f } of list) {
      const m = model(f.kind);
      const place = { x: f.x - cx, y: groundHeight(f.x, f.y, world) - g0, z: f.y - cz, ry: faceTurn(f.face) };
      if (m.body) body.addColored(m.body, place);
      if (m.bulbs) bulbs.addColored(m.bulbs, place);
      if (m.sway) sway.addColored(m.sway, place);
      top = Math.max(top, topOf(m) + place.y);
    }
    const pc: Piece = { pop: '', index: list[0].i, x: cx, z: cz, ry: 0, body: body.build(), bulbs: bulbs.build(), sway: sway.build(), height: top, hx: (x1 - x0) / 2 + 0.45, hz: (z1 - z0) / 2 + 0.45 };
    // named, so a look at the scene (dev tools, the draw-call count in docs/town.md §26) can find them
    for (const g of [pc.body, pc.bulbs, pc.sway]) if (g) g.userData.furniture = true;
    out.push(pc);
  }
  return out;
}
