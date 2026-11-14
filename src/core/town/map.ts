// Walking in "Thị trấn": which tiles can be walked on, the shortest way between two of them, and where a place's
// door and resident are. Pure; the world is a parameter (default: the town of src/data/townWorld.ts).
//
// Blocked: outside the map, water, trees, the fountain, a place's footprint (built or still an empty lot), the
// fixed props, and the solid decoration spots (kept free from the start, so buying a lamp never traps anybody).
// Everything else (grass, path, plaza) is walkable.

import { footprintTiles, groundAt, TOWN_WORLD, type PlaceId, type Tile, type TownWorld, type WorldPlace } from '../../data/townWorld';

export type { Tile } from '../../data/townWorld';

/**
 * What a step costs = how far it looks on the isometric screen (a tile is 64 × 32): along a row or a column, straight
 * up or down the screen (x and y change together), or straight across it (x and y change against each other).
 */
export const STEP_STRAIGHT = Math.hypot(32, 16);
export const STEP_VERTICAL = 32;
export const STEP_HORIZONTAL = 64;

/** The eight neighbours, in a fixed order, so the path between two tiles is always the same one. */
export const NEIGHBOURS: readonly Tile[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
];

export const sameTile = (a: Tile, b: Tile): boolean => a.x === b.x && a.y === b.y;

interface Grid {
  size: number;
  /** 1 = walkable. */
  open: Uint8Array;
}

const GRIDS = new WeakMap<TownWorld, Grid>();

function gridOf(world: TownWorld): Grid {
  const cached = GRIDS.get(world);
  if (cached) return cached;
  const size = world.size;
  const open = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = world.rows[y]?.[x];
      open[y * size + x] = ch === '.' || ch === '=' || ch === 'o' ? 1 : 0;
    }
  }
  const block = (t: Tile) => {
    if (Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 0 && t.y >= 0 && t.x < size && t.y < size) open[t.y * size + t.x] = 0;
  };
  for (const p of world.places) footprintTiles(p).forEach(block);
  for (const prop of world.props) prop.tiles.forEach(block);
  for (const spots of Object.values(world.decorations)) for (const s of spots) if (s.solid) block(s);
  const grid = { size, open };
  GRIDS.set(world, grid);
  return grid;
}

export function inBounds(t: Tile, world: TownWorld = TOWN_WORLD): boolean {
  return Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 0 && t.y >= 0 && t.x < world.size && t.y < world.size;
}

/** True when a character can stand on this tile. False outside the map and for a non-integer position. */
export function walkable(t: Tile, world: TownWorld = TOWN_WORLD): boolean {
  if (!inBounds(t, world)) return false;
  const g = gridOf(world);
  return g.open[t.y * g.size + t.x] === 1;
}

/**
 * One step from `from` by `delta` (each of x, y in -1..1) is allowed when the target is walkable and, for a diagonal
 * step, both tiles it squeezes between are walkable too: no cutting the corner of a house or of the pond.
 */
export function canStep(from: Tile, delta: Tile, world: TownWorld = TOWN_WORLD): boolean {
  if (delta.x === 0 && delta.y === 0) return false;
  if (!walkable({ x: from.x + delta.x, y: from.y + delta.y }, world)) return false;
  if (delta.x !== 0 && delta.y !== 0) {
    return walkable({ x: from.x + delta.x, y: from.y }, world) && walkable({ x: from.x, y: from.y + delta.y }, world);
  }
  return true;
}

export function stepCost(delta: Tile): number {
  if (delta.x === 0 || delta.y === 0) return STEP_STRAIGHT;
  return delta.x === delta.y ? STEP_VERTICAL : STEP_HORIZONTAL;
}

/** Straight-line distance on the screen between two tiles: never more than any walk between them. */
export function screenDistance(a: Tile, b: Tile): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot((dx - dy) * 32, (dx + dy) * 16);
}

/**
 * Shortest walk from `from` to `to` (A*, eight directions, no corner cutting): the tiles to step through, `to`
 * included, `from` not. [] when it is the same tile, when either end is not walkable, or when there is no way.
 */
export function findPath(from: Tile, to: Tile, world: TownWorld = TOWN_WORLD): Tile[] {
  if (sameTile(from, to) || !walkable(from, world) || !walkable(to, world)) return [];
  const size = world.size;
  const key = (t: Tile) => t.y * size + t.x;
  const goal = key(to);
  const cost = new Map<number, number>([[key(from), 0]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  // The town is 441 tiles: a plain array scanned for its best entry is plenty.
  const openList: { k: number; f: number }[] = [{ k: key(from), f: screenDistance(from, to) }];
  while (openList.length > 0) {
    let best = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[best].f || (openList[i].f === openList[best].f && openList[i].k < openList[best].k)) best = i;
    }
    const cur = openList.splice(best, 1)[0].k;
    if (cur === goal) {
      const path: Tile[] = [];
      for (let k: number | undefined = cur; k !== undefined && k !== key(from); k = cameFrom.get(k)) {
        path.push({ x: k % size, y: Math.floor(k / size) });
      }
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    const at = { x: cur % size, y: Math.floor(cur / size) };
    const g = cost.get(cur) ?? 0;
    for (const d of NEIGHBOURS) {
      if (!canStep(at, d, world)) continue;
      const next = { x: at.x + d.x, y: at.y + d.y };
      const nk = key(next);
      if (closed.has(nk)) continue;
      const ng = g + stepCost(d);
      if (ng >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk, ng);
      cameFrom.set(nk, cur);
      openList.push({ k: nk, f: ng + screenDistance(next, to) });
    }
  }
  return [];
}

/**
 * The walkable tile closest to `t` (`t` itself when it is walkable; `t` is rounded down to its tile and may lie
 * outside the map). Among equally close tiles the one closest to `prefer` wins (the walker: it stops on the near
 * side of a house), then the first in reading order. Null only for a world with no walkable tile.
 */
export function nearestWalkable(t: Tile, world: TownWorld = TOWN_WORLD, prefer?: Tile): Tile | null {
  const origin = { x: Math.floor(t.x), y: Math.floor(t.y) };
  if (walkable(origin, world)) return origin;
  let best: Tile | null = null;
  let bestD = Infinity;
  let bestP = Infinity;
  for (let y = 0; y < world.size; y++) {
    for (let x = 0; x < world.size; x++) {
      const c = { x, y };
      if (!walkable(c, world)) continue;
      const d = screenDistance(c, origin);
      const p = prefer ? screenDistance(c, prefer) : 0;
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && p < bestP)) {
        best = c;
        bestD = d;
        bestP = p;
      }
    }
  }
  return best;
}

function placeOf(id: PlaceId | string, world: TownWorld): WorldPlace {
  const p = world.places.find((q) => q.id === id);
  if (!p) throw new Error(`Thị trấn: không có nơi "${id}"`);
  return p;
}

/** The walkable tile in front of a place's door. */
export function tileOfPlaceDoor(id: PlaceId, world: TownWorld = TOWN_WORLD): Tile {
  return placeOf(id, world).door;
}

/** The tile where a place's resident stands. */
export function residentTile(id: PlaceId, world: TownWorld = TOWN_WORLD): Tile {
  return placeOf(id, world).spot;
}

/** The place whose footprint (house or empty lot) covers this tile, if any. */
export function placeAtTile(t: Tile, world: TownWorld = TOWN_WORLD): WorldPlace | undefined {
  const x = Math.floor(t.x);
  const y = Math.floor(t.y);
  return world.places.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.d);
}

/** Ground kind under a tile, for the caller that only has this module. */
export { groundAt };
