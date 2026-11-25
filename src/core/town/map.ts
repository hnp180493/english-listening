// Walking in "Thị trấn": which tiles can be walked on, the shortest way between two of them, and where a place's
// door and resident are. Pure; the world is a parameter (default: the town of src/data/townWorld.ts).
//
// Only what you can see blocks, and only as much as it is big (colliders.ts): the colliders of the world's state
// (`world.walk`, made by colliders.ts walkWorld; a world without one: nothing built, every lot a site, nothing
// bought), the water, and outside the map. A tile is closed to the path finder when a collider comes within
// GRID_CLEAR of its centre; the player's body collides with the shapes themselves (`solidsNear`).
// Ground characters: '.' grass, '=' path, 'o' plaza, 'T' / 't' a tree on grass, 'F' the fountain's spot on the
// plaza (open until the fountain is bought), '~' water; '#' a wall (test worlds), anything else is closed.

import { groundAt, TOWN_WORLD, type Collider, type PlaceId, type Tile, type TownWorld, type WorldPlace } from '../../data/townWorld';
import { BODY_RADIUS, boundsOfCollider, collidersOf, distanceTo, GRID_CLEAR } from './colliders';
import { seaShore, ShoreField, smoothShore } from './shore';
import { tl } from '../../i18n';

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
  /** 1 = ground a body may stand on (not water, not a wall); what stands on it is in `near`. */
  ground: Uint8Array;
  /** Per tile: the colliders whose box reaches into it. */
  near: (Collider[] | undefined)[];
  colliders: readonly Collider[];
  /** A closed ground tile (water, a wall, outside the map) as a box, made when first asked for. */
  tileBoxes: Map<number, Collider>;
  /** Per tile: the diagonal steps a body fits along (bit k = NEIGHBOURS[k]), -1 until first asked. */
  diag: Int16Array;
}

const GRIDS = new WeakMap<TownWorld, Grid>();

/** Ground a body may stand on (whatever stands there): grass, path, plaza, a tree's or the fountain's ground. */
const GROUND = new Set(['.', '=', 'o', 'T', 't', 'F', ':', 'p']);

function gridOf(world: TownWorld): Grid {
  const cached = GRIDS.get(world);
  if (cached) return cached;
  const size = world.size;
  const open = new Uint8Array(size * size);
  const ground = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = world.rows[y]?.[x];
      ground[y * size + x] = ch !== undefined && GROUND.has(ch) ? 1 : 0;
    }
  }
  open.set(ground);
  const colliders = world.walk?.colliders ?? collidersOf(world);
  const near: (Collider[] | undefined)[] = new Array(size * size);
  for (const c of colliders) {
    const b = boundsOfCollider(c);
    for (let ty = Math.max(0, Math.floor(b.y0 - GRID_CLEAR)); ty <= Math.min(size - 1, Math.floor(b.y1 + GRID_CLEAR)); ty++) {
      for (let tx = Math.max(0, Math.floor(b.x0 - GRID_CLEAR)); tx <= Math.min(size - 1, Math.floor(b.x1 + GRID_CLEAR)); tx++) {
        const i = ty * size + tx;
        if (distanceTo(c, tx + 0.5, ty + 0.5) < GRID_CLEAR) open[i] = 0;
        if (tx + 1 > b.x0 && tx < b.x1 && ty + 1 > b.y0 && ty < b.y1) (near[i] ??= []).push(c);
      }
    }
  }
  const grid: Grid = { size, open, ground, near, colliders, tileBoxes: new Map(), diag: new Int16Array(size * size).fill(-1) };
  GRIDS.set(world, grid);
  return grid;
}

/** Every collider of the world's state (colliders.ts; the world's own `walk`, or nothing built and bought). */
export function collidersIn(world: TownWorld = TOWN_WORLD): readonly Collider[] {
  return gridOf(world).colliders;
}

/**
 * Everything solid within the box x0..x1, y0..y1 (a body's reach): the colliders there, and the closed ground
 * (water, walls, outside the map) as tile boxes. Calls `visit` once per thing (a collider over two tiles: once).
 */
export function solidsNear(world: TownWorld, x0: number, y0: number, x1: number, y1: number, visit: (c: Collider) => void): void {
  const g = gridOf(world);
  const size = g.size;
  const tx0 = Math.floor(x0);
  const ty0 = Math.floor(y0);
  const tx1 = Math.floor(x1);
  const ty1 = Math.floor(y1);
  const many = tx1 > tx0 || ty1 > ty0;
  const seen: Collider[] = SEEN;
  seen.length = 0;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const inMap = tx >= 0 && ty >= 0 && tx < size && ty < size;
      const i = ty * size + tx;
      if (!inMap || g.ground[i] === 0) {
        const k = inMap ? i : -1 - ((ty + 64) * 4096 + (tx + 64));
        let b = g.tileBoxes.get(k);
        if (!b) {
          b = { kind: 'box', x0: tx, y0: ty, x1: tx + 1, y1: ty + 1, what: !inMap ? 'edge' : world.rows[ty]?.[tx] === '~' ? WATER : 'ground' };
          g.tileBoxes.set(k, b);
        }
        visit(b);
        continue;
      }
      const list = g.near[i];
      if (!list) continue;
      for (const c of list) {
        if (many) {
          if (seen.includes(c)) continue;
          seen.push(c);
        }
        visit(c);
      }
    }
  }
  seen.length = 0;
}

/**
 * A water tile's box in solidsNear (its `what`). The path finder and anything that wants the tiles use it as it is; a
 * BODY is stopped by the drawn shore instead (shoreStop / onLand below), which runs up to 0.6 of a tile over these
 * boxes: engine/sim.ts leaves them out.
 */
export const WATER = 'water';

/** How near a body's middle comes to the drawn waterline (tiles): its feet at the water's edge. */
export const SHORE_STAND = 0.1;

const SHORES = new WeakMap<readonly string[], ShoreField | null>();

/** The world's drawn shoreline (the same curve terrain.ts draws along), or null for a world without water. */
export function shoreOf(world: TownWorld): ShoreField | null {
  const cached = SHORES.get(world.rows);
  if (cached !== undefined) return cached;
  let field: ShoreField | null = null;
  if (world.coast || world.rows.some((r) => r.includes('~'))) {
    const sea = seaShore(world);
    field = new ShoreField(smoothShore(sea.isWater, sea.size), sea.size);
  }
  SHORES.set(world.rows, field);
  return field;
}

/** Samples of the distance to the waterline along a tile's side (the lattice's step is 1 / SHORE_FINE). */
const SHORE_FINE = 10;

/**
 * How far it is to the drawn waterline, fast: a lattice of the curve's signed distance (+ on land, − in the water)
 * over the tiles the curve passes within a tile of, made tile by tile when first asked; anywhere else the tile says
 * which side it is (the curve keeps within 0.6 of the tiles' edges). A walk asks this thousands of times a frame.
 */
interface ShoreGrid {
  field: ShoreField;
  /** Per tile: 0 not asked yet, 1 far and land, 2 far and water, 3 near the curve (its samples are in `near`). */
  kind: Uint8Array;
  near: Map<number, Float32Array>;
}

const SHORE_GRIDS = new WeakMap<readonly string[], ShoreGrid | null>();

function shoreGrid(world: TownWorld): ShoreGrid | null {
  const cached = SHORE_GRIDS.get(world.rows);
  if (cached !== undefined) return cached;
  const field = shoreOf(world);
  const grid = field ? { field, kind: new Uint8Array(world.size * world.size), near: new Map<number, Float32Array>() } : null;
  SHORE_GRIDS.set(world.rows, grid);
  return grid;
}

/** The signed distance to the drawn waterline at (x, y), within ±1 (tiles): + on land, − in the water. */
export function shoreDistance(world: TownWorld, x: number, y: number): number {
  const g = shoreGrid(world);
  if (!g) return 1;
  const size = world.size;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  // outside the map the edge stops a body, not the water
  if (tx < 0 || ty < 0 || tx >= size || ty >= size) return 1;
  const i = ty * size + tx;
  let kind = g.kind[i];
  if (kind === 0) {
    if (g.field.near(tx, ty)) {
      const n = SHORE_FINE + 1;
      const s = new Float32Array(n * n);
      for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) s[b * n + a] = g.field.signed(tx + a / SHORE_FINE, ty + b / SHORE_FINE, 1);
      g.near.set(i, s);
      kind = 3;
    } else kind = world.rows[ty]?.[tx] === '~' ? 2 : 1;
    g.kind[i] = kind;
  }
  if (kind !== 3) return kind === 2 ? -1 : 1;
  // between the four samples round the point
  const s = g.near.get(i)!;
  const n = SHORE_FINE + 1;
  const fx = (x - tx) * SHORE_FINE;
  const fy = (y - ty) * SHORE_FINE;
  const a0 = Math.min(SHORE_FINE - 1, Math.floor(fx));
  const b0 = Math.min(SHORE_FINE - 1, Math.floor(fy));
  const u = fx - a0;
  const v = fy - b0;
  const k = b0 * n + a0;
  return (s[k] * (1 - u) + s[k + 1] * u) * (1 - v) + (s[k + n] * (1 - u) + s[k + n + 1] * u) * v;
}

/**
 * A body's middle may be at (x, y) as far as the water goes: on the drawn land, SHORE_STAND or more from the
 * waterline. True for a world without water.
 */
export function onLand(world: TownWorld, x: number, y: number): boolean {
  return shoreDistance(world, x, y) >= SHORE_STAND - 1e-4;
}

/**
 * Where a body's middle goes so that it stands on the drawn land (SHORE_STAND from the waterline): straight away
 * from the water. Null when it stands there already, or out in deep water (no edge near to be pushed to).
 */
export function shoreStop(world: TownWorld, x: number, y: number): { x: number; y: number } | null {
  const s = shoreDistance(world, x, y);
  if (s >= SHORE_STAND - 1e-4 || s <= -1) return null;
  const h = 0.04;
  const gx = shoreDistance(world, x + h, y) - shoreDistance(world, x - h, y);
  const gy = shoreDistance(world, x, y + h) - shoreDistance(world, x, y - h);
  const gl = Math.hypot(gx, gy);
  if (gl < 1e-6) return null;
  const step = SHORE_STAND - s + 1e-3;
  return { x: x + (gx / gl) * step, y: y + (gy / gl) * step };
}

/** Reused by solidsNear (no garbage per call). */
const SEEN: Collider[] = [];

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
 * step, both tiles it squeezes between are walkable too (no cutting the corner of a house or of the pond), or a body
 * (BODY_RADIUS) fits all the way along the straight line between the two tiles' middles: between two trees standing
 * corner to corner, where the keys can go, so can a click walk and a resident (docs/town.md §7 "Moving about").
 */
export function canStep(from: Tile, delta: Tile, world: TownWorld = TOWN_WORLD): boolean {
  if (delta.x === 0 && delta.y === 0) return false;
  if (!walkable({ x: from.x + delta.x, y: from.y + delta.y }, world)) return false;
  if (delta.x !== 0 && delta.y !== 0) {
    if (walkable({ x: from.x + delta.x, y: from.y }, world) && walkable({ x: from.x, y: from.y + delta.y }, world)) return true;
    return diagonalFits(from, delta, world);
  }
  return true;
}

/** Room to spare round a body squeezing along a diagonal (a walker steers, it does not run on rails). */
const DIAGONAL_SPARE = 0.04;

/** A body fits along the diagonal from `from` by `delta` (cached per tile in the grid). */
function diagonalFits(from: Tile, delta: Tile, world: TownWorld): boolean {
  const g = gridOf(world);
  const i = from.y * g.size + from.x;
  if (g.diag[i] < 0) {
    let mask = 0;
    NEIGHBOURS.forEach((d, k) => {
      if (d.x !== 0 && d.y !== 0 && lineFits(world, from.x + 0.5, from.y + 0.5, from.x + d.x + 0.5, from.y + d.y + 0.5, BODY_RADIUS + DIAGONAL_SPARE)) mask |= 1 << k;
    });
    g.diag[i] = mask;
  }
  const k = NEIGHBOURS.findIndex((d) => d.x === delta.x && d.y === delta.y);
  return (g.diag[i] & (1 << k)) !== 0;
}

/** A circle of radius `r` moved along the straight line (ax, ay) → (bx, by) overlaps nothing solid. */
export function lineFits(world: TownWorld, ax: number, ay: number, bx: number, by: number, r: number): boolean {
  const things: Collider[] = [];
  solidsNear(world, Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (c) => {
    things.push(c);
  });
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.04));
  for (let s = 0; s <= n; s++) {
    const x = ax + ((bx - ax) * s) / n;
    const y = ay + ((by - ay) * s) / n;
    for (const c of things) if (distanceTo(c, x, y) < r - 1e-6) return false;
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
 * `extra` adds a cost (screen px) for stepping onto a tile (e.g. where somebody stands: the walk goes round them).
 */
export function findPath(from: Tile, to: Tile, world: TownWorld = TOWN_WORLD, extra?: (t: Tile) => number): Tile[] {
  if (sameTile(from, to) || !walkable(from, world) || !walkable(to, world)) return [];
  const size = world.size;
  const key = (t: Tile) => t.y * size + t.x;
  const goal = key(to);
  const cost = new Map<number, number>([[key(from), 0]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  // A binary heap ordered by (f, tile index): the same entry comes out first as a scan for the best one would give,
  // so the path between two tiles is always the same one (the town is 1,936 tiles: a scan got slow).
  const open = new OpenHeap();
  open.push(key(from), screenDistance(from, to));
  while (open.size > 0) {
    const cur = open.pop();
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
      const ng = g + stepCost(d) + (extra ? extra(next) : 0);
      if (ng >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk, ng);
      cameFrom.set(nk, cur);
      open.push(nk, ng + screenDistance(next, to));
    }
  }
  return [];
}

/** A min-heap of (f, k) pairs, smallest f first, then smallest k. */
class OpenHeap {
  private readonly f: number[] = [];
  private readonly k: number[] = [];

  get size(): number {
    return this.k.length;
  }

  private less(i: number, j: number): boolean {
    return this.f[i] < this.f[j] || (this.f[i] === this.f[j] && this.k[i] < this.k[j]);
  }

  private swap(i: number, j: number): void {
    [this.f[i], this.f[j]] = [this.f[j], this.f[i]];
    [this.k[i], this.k[j]] = [this.k[j], this.k[i]];
  }

  push(k: number, f: number): void {
    this.f.push(f);
    this.k.push(k);
    for (let i = this.k.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.k[0];
    const last = this.k.length - 1;
    this.swap(0, last);
    this.f.pop();
    this.k.pop();
    for (let i = 0; ; ) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < last && this.less(l, m)) m = l;
      if (r < last && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
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
  if (!p) throw new Error(tl`Thị trấn: không có nơi "${id}"`);
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
