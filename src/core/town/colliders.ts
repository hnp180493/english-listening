// What a body bumps into in "Thị trấn" (docs/town.md §7 "Moving about"): ONLY WHAT YOU CAN SEE BLOCKS, AND ONLY AS
// MUCH AS IT IS BIG. Each thing the 3D town draws standing up gets a collider of its own size (a circle for a post, a
// trunk, the fountain; a box for a house, a bench, a stall, a fence run), and only while it is there: a decoration
// once bought, a house once built, a construction site while it is on offer, the trees and stone of a lot left to
// nature. Nothing else blocks (an empty decoration spot, the plaza's middle before the fountain is bought).
//
// The player's body (engine/sim.ts moveCircle) collides with these shapes; the tile grid the residents' path finder
// walks on (map.ts) is made from them: a tile is closed when a shape comes within GRID_CLEAR of its centre. Pure;
// three/scene/colliders.test.ts checks that every solid thing the scene builds has a collider as big as it is, and
// the other way round.

import type { Collider, Tile, TownWorld, WorldPlace, WorldProp } from '../../data/townWorld';

/** What decides what stands in town (the stage state's part that matters for walking). */
export interface WalkState {
  built: readonly string[];
  /** Lots on offer as construction sites; left out = every empty lot is a site. */
  sites?: readonly string[];
  decorations: readonly string[];
  /** Town projects built (engine/extraDecor.ts): their colliders come in `extra`. */
  extraDecor?: readonly string[];
}

/** Nothing built, every lot a site, nothing bought: a world without a state. */
export const NO_STATE: WalkState = { built: [], decorations: [] };

/**
 * A tile is closed to the path finder when a shape comes nearer its centre than this (a resident standing there
 * would touch it): a lamp post or a trunk on the tile closes it, a tree leaning in from the next tile does not.
 */
export const GRID_CLEAR = 0.2;

/** A body's radius (the player's, engine/sim.ts PLAYER_RADIUS; a resident is as wide): what must fit between things. */
export const BODY_RADIUS = 0.22;

// ───────────────────────── shared with the 3D scene (one source, so the two never disagree) ─────────────────────────

/** A stable pseudo-random number in [0, 1) for a pair of integers (and a seed): the same town every time. */
export function hash2(a: number, b: number, seed = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export type TreeKind3 = 'round' | 'pine' | 'blossom' | 'bush' | 'palm';

/** A tree where the scene draws it (x, y on the tile grid). */
export interface TreeAt {
  x: number;
  y: number;
  kind: TreeKind3;
  /** 0.7..1.3 */
  scale: number;
  /** 0..1, a stable random of its own (colour, turn). */
  seed: number;
}

/** The trees of the map ('T' round, 't' pine), a little off their tile centres so they do not stand in rows. */
export function treesOf(world: Pick<TownWorld, 'rows'>): TreeAt[] {
  const out: TreeAt[] = [];
  world.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== 'T' && ch !== 't' && ch !== 'p') continue;
      const h = hash2(x, y, 3);
      out.push({ x: x + 0.5 + (hash2(x, y, 4) - 0.5) * 0.24, y: y + 0.5 + (hash2(x, y, 5) - 0.5) * 0.24, kind: ch === 'T' ? 'round' : ch === 'p' ? 'palm' : 'pine', scale: 0.85 + h * 0.35, seed: h });
    }
  });
  return out;
}

/** A lot not on offer: a corner of nature (a tree or two, a bush, a stone), the same every time for the same lot. */
export function lotNature(p: Pick<WorldPlace, 'id' | 'x' | 'y' | 'w' | 'd'>): { trees: TreeAt[]; stones: { x: number; y: number; s: number }[] } {
  const seed = [...p.id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) % 1000;
  const trees: TreeAt[] = [];
  const cells = p.w * p.d;
  const count = Math.max(1, Math.min(3, Math.round(cells / 2)));
  for (let i = 0; i < count; i++) {
    const h = hash2(seed, i, 11);
    const kind: TreeKind3 = i === count - 1 && cells > 2 ? 'bush' : h < 0.5 ? 'round' : 'pine';
    trees.push({
      x: p.x + 0.35 + hash2(seed, i, 12) * (p.w - 0.7),
      y: p.y + 0.35 + hash2(seed, i, 13) * (p.d - 0.7),
      kind,
      scale: kind === 'bush' ? 0.8 : 0.8 + hash2(seed, i, 14) * 0.3,
      seed: h,
    });
  }
  const stones = [{ x: p.x + 0.25 + hash2(seed, 9, 15) * (p.w - 0.5), y: p.y + 0.25 + hash2(seed, 9, 16) * (p.d - 0.5), s: 0.7 + hash2(seed, 9, 17) * 0.5 }];
  return { trees, stones };
}

/** A place's lot: built, a construction site on offer, or plain nature. */
export function lotOf(id: string, state: Pick<WalkState, 'built' | 'sites'>): 'built' | 'site' | 'nature' {
  if (state.built.includes(id)) return 'built';
  if (!state.sites || state.sites.includes(id)) return 'site';
  return 'nature';
}

// ───────────────────────── sizes (tiles), as the 3D models are built ─────────────────────────

/**
 * How far round a tree's foot a body is stopped (× its scale): past the trunk, under the lowest branches; a body may
 * pass under the edge of a crown, never through the trunk.
 */
export const TREE_R: Readonly<Record<TreeKind3, number>> = { round: 0.27, blossom: 0.27, pine: 0.33, bush: 0.36, palm: 0.16 };
/** A house's walls stand this far in from its lot's edges (places3d.ts INSET 0.18, less the plinth's 0.04). */
export const WALL_INSET = 0.14;
/** A construction site's fence stands this far in from the lot's edges (places3d.ts buildSite). */
export const SITE_INSET = 0.12;
/** A lot's stone (places3d / world3d: a blob of 0.16 stretched 1.3 times, × its size). */
const STONE_R = 0.16 * 1.3;

const circle = (x: number, y: number, r: number, what: string): Collider => ({ kind: 'circle', x, y, r, what });
const box = (x0: number, y0: number, x1: number, y1: number, what: string): Collider => ({ kind: 'box', x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), what });

/**
 * A box given in a lot's own frame (the kit of places3d.ts: x along the door's face, z out of it, both from the
 * lot's middle) turned onto the town.
 */
function lotBox(p: Pick<WorldPlace, 'x' | 'y' | 'w' | 'd' | 'face'>, lx0: number, lz0: number, lx1: number, lz1: number, what: string): Collider {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.d / 2;
  // face 'y': the kit as it is; face 'x': local +Z turned to world +X, local +X to world −Z
  if (p.face === 'y') return box(cx + lx0, cy + lz0, cx + lx1, cy + lz1, what);
  return box(cx + lz0, cy - lx1, cx + lz1, cy - lx0, what);
}

function lotCircle(p: Pick<WorldPlace, 'x' | 'y' | 'w' | 'd' | 'face'>, lx: number, lz: number, r: number, what: string): Collider {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.d / 2;
  return p.face === 'y' ? circle(cx + lx, cy + lz, r, what) : circle(cx + lz, cy - lx, r, what);
}

/** The kit's width (along the door's face), depth, and the door's offset along the face (places3d.ts kitFor). */
function kitOf(p: WorldPlace, inset: number): { W: number; D: number; u: number } {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.d / 2;
  if (p.face === 'y') return { W: p.w - inset * 2, D: p.d - inset * 2, u: p.door.x + 0.5 - cx };
  return { W: p.d - inset * 2, D: p.w - inset * 2, u: -(p.door.y + 0.5 - cy) };
}

/** A built place: its walls (most), or what its recipe really puts up (places3d.ts RECIPES). */
export function placeColliders(p: WorldPlace): Collider[] {
  const what = 'place:' + p.id;
  const k = kitOf(p, 0.18);
  switch (p.id) {
    case 'square': {
      // the pavilion: a round stone floor under six posts
      const r = Math.min(k.W, k.D) / 2 + 0.05;
      return [lotCircle(p, 0, 0, r + 0.1, what)];
    }
    case 'station': {
      // a glass shelter at the front of the lot (the back of it is grass) and the bus-stop sign on its pole
      const w = Math.min(1.3, k.W - 0.1);
      const d = 0.62;
      return [lotBox(p, k.u - w / 2 - 0.05, k.D / 2 - d - 0.05, k.u + w / 2 + 0.05, k.D / 2 + 0.05, what), lotCircle(p, k.u + w / 2 + 0.2, k.D / 2 + 0.1, 0.06, what)];
    }
    case 'park':
      // a garden behind hedges (0.24 thick on the walls' line)
      return [lotBox(p, -k.W / 2 - 0.12, -k.D / 2 - 0.12, k.W / 2 + 0.12, k.D / 2 + 0.12, what)];
    case 'board': {
      // the notice board between its two posts, a lamp beside it, a pot: the rest of the lot is grass
      const z = k.D / 2 - 0.2;
      return [lotBox(p, k.u - 0.6, z - 0.06, k.u + 0.6, z + 0.06, what), lotCircle(p, k.u + 0.75, k.D / 2 + 0.1, 0.05, what), lotCircle(p, k.u - 0.55, k.D / 2 - 0.1, 0.12, what)];
    }
    default: {
      // the walls, and in front of them the doorstep and what stands by the door (pots, a crate, a bench, the
      // mailbox) up to PORCH out
      const i = WALL_INSET;
      const out = [box(p.x + i, p.y + i, p.x + p.w - i, p.y + p.d - i, what)];
      if (p.face === 'y') out.push(box(p.x + i, p.y + p.d - i, p.x + p.w - i, p.y + p.d - i + PORCH, what));
      else out.push(box(p.x + p.w - i, p.y + i, p.x + p.w - i + PORCH, p.y + p.d - i, what));
      // the clinic's bench beside its door reaches past the corner
      if (p.id === 'clinic') out.push(lotBox(p, k.u - 0.8, k.D / 2 + 0.1, k.u - 0.4, k.D / 2 + 0.26, what));
      return out;
    }
  }
}

/** How far out from a house's front wall its doorstep and the things by the door reach (places3d.ts RECIPES). */
export const PORCH = 0.3;

/** A lot on offer: the fenced site (its gate is shut: places3d.ts buildSite draws a barrier across it), and the cones by its gate. */
export function siteColliders(p: WorldPlace): Collider[] {
  const what = 'site:' + p.id;
  const k = kitOf(p, SITE_INSET);
  const i = SITE_INSET;
  return [box(p.x + i - 0.03, p.y + i - 0.03, p.x + p.w - i + 0.03, p.y + p.d - i + 0.03, what), lotCircle(p, k.u - 0.49, k.D / 2 + 0.12, 0.09, what), lotCircle(p, k.u + 0.49, k.D / 2 + 0.12, 0.09, what)];
}

/** A lot left to nature: its trees, its bush and its stone. */
export function natureColliders(p: WorldPlace): Collider[] {
  const n = lotNature(p);
  const out = n.trees.map((t, i) => circle(t.x, t.y, TREE_R[t.kind] * t.scale, `lot:${p.id}:${i}`));
  n.stones.forEach((s, i) => out.push(circle(s.x, s.y, STONE_R * s.s, `stone:${p.id}:${i}`)));
  return out;
}

/** The middle of a group of tiles (as props3d.ts middleOf). */
function middle(tiles: readonly Tile[]): Tile | null {
  if (tiles.length === 0) return null;
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  return { x: (Math.min(...xs) + Math.max(...xs) + 1) / 2, y: (Math.min(...ys) + Math.max(...ys) + 1) / 2 };
}

function boundsOf(tiles: readonly Tile[]) {
  const x0 = Math.min(...tiles.map((t) => t.x));
  const y0 = Math.min(...tiles.map((t) => t.y));
  const x1 = Math.max(...tiles.map((t) => t.x)) + 1;
  const y1 = Math.max(...tiles.map((t) => t.y)) + 1;
  return { x0, y0, x1, y1 };
}

/** A bench (0.74 long, seat and back 0.26 deep) at (x, y), looking `dir` (props3d.ts benchParts). */
function bench(x: number, y: number, dir: 'e' | 's' | 'w' | undefined, what: string): Collider {
  // local: x ±0.37, z −0.13 (the back) .. +0.12 (the seat's front); 'e' turns local +Z to world +x, 'w' to −x
  if (dir === 'e') return box(x - 0.13, y - 0.37, x + 0.12, y + 0.37, what);
  if (dir === 'w') return box(x - 0.12, y - 0.37, x + 0.13, y + 0.37, what);
  return box(x - 0.37, y - 0.13, x + 0.37, y + 0.12, what);
}

/** A fixed thing of the world (props3d.ts propPiece); none for the pier (over the water) or the bus without its stop. */
export function propColliders(prop: WorldProp, i: number, stationBuilt: boolean): Collider[] {
  const what = `prop:${i}:${prop.kind}`;
  const at = prop.at ?? middle(prop.tiles);
  if (!at) return [];
  const { x, y } = at;
  switch (prop.kind) {
    case 'inn': {
      const b = boundsOf(prop.tiles);
      const k = WALL_INSET;
      return [box(b.x0 + k, b.y0 + k, b.x1 - k, b.y1 - k, what)];
    }
    case 'terrace':
      // the table and its two stools
      return [box(x - 0.45, y - 0.2, x + 0.45, y + 0.2, what)];
    case 'bus': {
      if (!stationBuilt || prop.tiles.length === 0) return [];
      const b = boundsOf(prop.tiles);
      const along = b.y1 - b.y0 >= b.x1 - b.x0 ? 'y' : 'x';
      const half = (Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.95) / 2;
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      return along === 'y' ? [box(cx - 0.4, cy - half, cx + 0.4, cy + half, what)] : [box(cx - half, cy - 0.4, cx + half, cy + 0.4, what)];
    }
    case 'pier':
      return [];
    case 'farm': {
      const b = boundsOf(prop.tiles);
      return [box(b.x0 + 0.05, b.y0, b.x1 - 0.05, b.y1 - 0.05, what)];
    }
    case 'kiosk':
      return [box(x - 0.37, y - 0.32, x + 0.37, y + 0.32, what)];
    case 'board':
      return [box(x - 0.36, y - 0.06, x + 0.36, y + 0.06, what)];
    case 'market':
      return [box(x - 0.42, y - 0.2, x + 0.42, y + 0.3, what)];
    case 'bench':
      return [bench(x, y, prop.dir, what)];
    case 'lantern':
      return [circle(x, y, 0.12, what)];
    case 'planter':
      return [box(x - 0.31, y - 0.21, x + 0.31, y + 0.21, what)];
    case 'signpost':
      return [circle(x, y, 0.12, what)];
    default:
      return [box(x - 0.2, y - 0.2, x + 0.2, y + 0.2, what)];
  }
}

/** The decorations bought (props3d.ts buildDecorations): each spot as big as its model. */
export function decorationColliders(world: Pick<TownWorld, 'decorations'>, decorations: readonly string[]): Collider[] {
  const out: Collider[] = [];
  const has = (id: string) => decorations.includes(id);
  const each = (id: keyof TownWorld['decorations'], make: (x: number, y: number, i: number, what: string) => Collider | null) => {
    if (!has(id)) return;
    (world.decorations[id] ?? []).forEach((s, i) => {
      const c = make(s.solid ? s.x + 0.5 : s.x, s.solid ? s.y + 0.5 : s.y, i, `decor:${id}:${i}`);
      if (c) out.push(c);
    });
  };
  each('lamps1', (x, y, _i, w) => circle(x, y, 0.11, w));
  each('lamps2', (x, y, _i, w) => circle(x, y, 0.11, w));
  each('flowers', (x, y, _i, w) => circle(x, y, 0.42, w));
  each('benches', (x, y, i, w) => bench(x, y, world.decorations.benches[i]?.dir, w));
  each('blossom', (x, y, _i, w) => circle(x, y, TREE_R.blossom * 1.05, w));
  each('lights', (x, y, _i, w) => circle(x, y, 0.05, w));
  each('stall', (x, y, _i, w) => box(x - 0.35, y - 0.25, x + 0.35, y + 0.27, w));
  each('fountain', (x, y, _i, w) => circle(x, y, 0.66, w));
  each('flags', (x, y, _i, w) => circle(x, y, 0.05, w));
  return out;
}

/** The scenery that stands up (three/scene/props3d.ts buildScenery): the barn, the well, hay bales, fence and hedge runs, rocks, bushes. */
export function sceneryColliders(world: Pick<TownWorld, 'scenery'>): Collider[] {
  const out: Collider[] = [];
  (world.scenery ?? []).forEach((s, i) => {
    const what = `scenery:${i}:${s.kind}`;
    if (s.tiles.length === 0) return;
    const b = boundsOf(s.tiles);
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    switch (s.kind) {
      case 'barn':
        out.push(box(b.x0 + 0.12, b.y0 + 0.12, b.x1 - 0.12, b.y1 - 0.12, what));
        break;
      case 'well':
        out.push(circle(cx, cy, SCENERY_SIZE.well, what));
        break;
      case 'haybale':
        out.push(circle(cx, cy, SCENERY_SIZE.haybale, what));
        break;
      case 'rock':
        out.push(circle(cx, cy, SCENERY_SIZE.rock, what));
        break;
      case 'bush':
        out.push(circle(cx, cy, SCENERY_SIZE.bush, what));
        break;
      case 'hut':
        out.push(box(b.x0 + 0.14, b.y0 + 0.14, b.x1 - 0.14, b.y1 - 0.14, what));
        break;
      case 'lighthouse':
      case 'umbrella':
      case 'boulder':
        out.push(circle(cx, cy, SCENERY_SIZE[s.kind], what));
        break;
      case 'fence':
      case 'hedge': {
        const t = s.kind === 'fence' ? SCENERY_SIZE.fence : SCENERY_SIZE.hedge;
        // along the middle of its tiles, end to end
        if (s.dir === 'y') out.push(box(cx - t, b.y0, cx + t, b.y1, what));
        else out.push(box(b.x0, cy - t, b.x1, cy + t, what));
        break;
      }
      default:
        break;
    }
  });
  return out;
}

/** Sizes of the scenery's models (radius, or half the thickness of a run), shared with three/scene/props3d.ts buildScenery. */
export const SCENERY_SIZE = { well: 0.36, haybale: 0.34, rock: 0.3, bush: 0.34, fence: 0.06, hedge: 0.22, lighthouse: 0.85, umbrella: 0.3, boulder: 0.78 } as const;

/** Every collider in town for a state; `extra` adds what the caller knows of (the town projects). */
export function collidersOf(world: TownWorld, state: WalkState = NO_STATE, extra: readonly Collider[] = []): Collider[] {
  const out: Collider[] = [];
  for (const t of treesOf(world)) out.push(circle(t.x, t.y, TREE_R[t.kind] * t.scale, `tree:${Math.floor(t.x)},${Math.floor(t.y)}`));
  for (const p of world.places) {
    const s = lotOf(p.id, state);
    out.push(...(s === 'built' ? placeColliders(p) : s === 'site' ? siteColliders(p) : natureColliders(p)));
  }
  const station = state.built.includes('station');
  world.props.forEach((prop, i) => out.push(...propColliders(prop, i, station)));
  out.push(...decorationColliders(world, state.decorations));
  out.push(...sceneryColliders(world));
  out.push(...extra);
  return out;
}

/** The key of a state (what is built, on offer, bought, and the projects). */
export function walkKey(state: WalkState): string {
  const sorted = (a: readonly string[] | undefined) => (a ? [...a].sort().join(',') : '*');
  return [sorted(state.built), sorted(state.sites), sorted(state.decorations), sorted(state.extraDecor ?? [])].join('|');
}

const WORLDS = new WeakMap<TownWorld, Map<string, TownWorld>>();
/** A world made by walkWorld → the world it was made from. */
const ROOTS = new WeakMap<TownWorld, TownWorld>();

/**
 * The world as it stands in a state: the same world with its colliders (`walk`). Cached per base world and state, so
 * the same state gives the same object (map.ts caches its grid per object); the last few states are kept.
 */
export function walkWorld(base: TownWorld, state: WalkState, extra: readonly Collider[] = []): TownWorld {
  const root = ROOTS.get(base) ?? base;
  const key = walkKey(state) + (extra.length ? '|' + extra.map((c) => c.what).join(',') : '');
  let byKey = WORLDS.get(root);
  if (!byKey) {
    byKey = new Map();
    WORLDS.set(root, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const world: TownWorld = { ...root, walk: { key, colliders: collidersOf(root, state, extra) } };
  ROOTS.set(world, root);
  byKey.set(key, world);
  if (byKey.size > 8) byKey.delete(byKey.keys().next().value as string);
  return world;
}

// ───────────────────────── shapes ─────────────────────────

/** Distance from a point to a shape (0 inside it). */
export function distanceTo(c: Collider, x: number, y: number): number {
  if (c.kind === 'circle') return Math.max(0, Math.hypot(x - c.x, y - c.y) - c.r);
  const dx = Math.max(c.x0 - x, 0, x - c.x1);
  const dy = Math.max(c.y0 - y, 0, y - c.y1);
  return Math.hypot(dx, dy);
}

/** The point is inside the shape. */
export function inside(c: Collider, x: number, y: number): boolean {
  if (c.kind === 'circle') return Math.hypot(x - c.x, y - c.y) < c.r;
  return x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1;
}

/** The shape's bounding box. */
export function boundsOfCollider(c: Collider): { x0: number; y0: number; x1: number; y1: number } {
  return c.kind === 'circle' ? { x0: c.x - c.r, y0: c.y - c.r, x1: c.x + c.r, y1: c.y + c.r } : { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 };
}

/**
 * Push a circle (x, y, r) out of a shape: where its centre goes so that it only touches it, or null when it does not
 * overlap. A centre inside a box leaves by the nearest side; a centre on a circle's own centre leaves along +x.
 */
export function pushOut(c: Collider, x: number, y: number, r: number): { x: number; y: number } | null {
  if (c.kind === 'circle') {
    const dx = x - c.x;
    const dy = y - c.y;
    const d = Math.hypot(dx, dy);
    const need = c.r + r;
    if (d >= need - 1e-9) return null;
    if (d < 1e-9) return { x: c.x + need, y };
    return { x: c.x + (dx / d) * need, y: c.y + (dy / d) * need };
  }
  const cx = Math.max(c.x0, Math.min(c.x1, x));
  const cy = Math.max(c.y0, Math.min(c.y1, y));
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r - 1e-9) return null;
  if (d < 1e-9) {
    // the centre inside: out by the nearest side
    const l = x - c.x0;
    const rr = c.x1 - x;
    const t = y - c.y0;
    const b = c.y1 - y;
    const m = Math.min(l, rr, t, b);
    if (m === l) return { x: c.x0 - r, y };
    if (m === rr) return { x: c.x1 + r, y };
    if (m === t) return { x, y: c.y0 - r };
    return { x, y: c.y1 + r };
  }
  return { x: x + (dx / d) * (r - d), y: y + (dy / d) * (r - d) };
}
