// The warehouses on Westbay's harbour (docs/gta-story-2.md §3, jobs 4a "Ca đêm", 4b "Cửa nước", 10 "Kho 15"; docs/town.md
// §32): a row of brick sheds along the east shore of the bay, their backs to the water, their fronts on a quay lane, each
// with its NUMBER painted large on its roof and over its door. The harbour's sheds go up to twenty-two (`cs-bigdeal-4`):
// the row runs 11–14 south of Quay Street, 15–22 north of it, so twenty-two is the far end of the quay and there is no
// fifty (the trap of Act II: "warehouse fifty" sends whoever believes it to the far north end, where the row stops at
// twenty-two and the beach begins). One to ten are older sheds further along, not drawn.
//
// Number fifteen is Bayline's (rented from the Harbour Board): a black front door on the quay lane, a back door on Quay
// Street, a water gate on the bay with a slipway to the water. Its room is three/interiors/recipes/warehouse.ts; a job
// goes in with features/town/city/warehouse.ts enterWarehouse, and a boat runs to the water gate with runBoat.
//
// Coordinates are Westbay's stretched map's (data/cityWorld.ts CITY_WORLD), as the sim and the stage use them.

import type { Tile, TownWorld, WorldScenery } from '../townWorld';

/** One warehouse: its tiles (four wide along x, two deep along y), its number, its doors. */
export interface Warehouse {
  n: number;
  x: number;
  y: number;
  w: number;
  d: number;
}

/** The west edge of the row (on the sand of the bay's shore) and its width; the quay lane is the column after it. */
const X0 = 47;
const W = 4;
/** The quay lane in front of the doors (open ground: data/cityWorld.ts keeps it clear of the filler blocks). */
export const QUAY_LANE_X = X0 + W;

function row(from: number, y0: number, count: number): Warehouse[] {
  // numbered from the south up: the lowest number by the street the row starts from
  return Array.from({ length: count }, (_, i) => ({ n: from + i, x: X0, y: y0 - i * 2, w: W, d: 2 }));
}

/** 11–14 south of Quay Street (from Pier Road up), 15–22 north of it (from Quay Street up to the far end). */
export const WAREHOUSES: readonly Warehouse[] = [...row(11, 88, 4), ...row(15, 76, 8)];

export const warehouse = (n: number): Warehouse | undefined => WAREHOUSES.find((w) => w.n === n);

/** The highest number on the harbour: past it is the beach (no fifty). */
export const LAST_WAREHOUSE = 22;

/** Number fifteen and its three ways in (each the open tile in front of it). */
export const W15 = warehouse(15)!;
export const W15_DOORS = {
  /** The black front door on the quay lane (the +x face). */
  front: { x: QUAY_LANE_X, y: W15.y + 1 } as Tile,
  /** The back door on Quay Street (the +y face). */
  back: { x: W15.x + 1, y: W15.y + W15.d } as Tile,
  /** The water gate on the bay (the −x face): the slipway's top, on the sand. */
  water: { x: W15.x - 1, y: W15.y + 1 } as Tile,
} as const;
/** Where a boat lies at the water gate (its middle, tiles): on the water beside the slipway. */
export const W15_MOORING = { x: W15.x - 1.55, y: W15.y + 1.5 };

/** Where the far end of the row is (the false "warehouse fifty" sends people here): in front of twenty-two. */
export const ROW_FAR_END: Tile = { x: QUAY_LANE_X, y: warehouse(LAST_WAREHOUSE)!.y };

/** The row as the world's scenery (`v` = the number: three/scene/props3d.ts buildScenery hands them to the model). */
export function warehouseScenery(): WorldScenery[] {
  return WAREHOUSES.map((w) => {
    const tiles: Tile[] = [];
    for (let j = 0; j < w.d; j++) for (let i = 0; i < w.w; i++) tiles.push({ x: w.x + i, y: w.y + j });
    return { kind: 'warehouse', tiles, v: w.n };
  });
}

/** Tiles the filler blocks must leave alone (the quay lane in front of the row and one more column). */
export function quayLane(): Tile[] {
  const out: Tile[] = [];
  for (const w of WAREHOUSES) for (let j = -1; j <= w.d; j++) for (const x of [QUAY_LANE_X, QUAY_LANE_X + 1]) out.push({ x, y: w.y + j });
  return out;
}

// ───────────────────────── a boat on the water ─────────────────────────

/** The end of the jetty on the bay (scenery jetty at the seafront): where a boat is boarded. */
export const JETTY_END = { x: 40.5, y: 63.9 };

export interface Pt {
  x: number;
  y: number;
}

/** A tile of the map is water. */
const water = (world: Pick<TownWorld, 'rows' | 'size'>, x: number, y: number): boolean => x >= 0 && y >= 0 && x < world.size && y < world.size && world.rows[y][x] === '~';

/** Open water: water with water all round it (a hull never grazes the drawn shore, which reaches into the water tiles). */
function open(world: Pick<TownWorld, 'rows' | 'size'>, x: number, y: number): boolean {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!water(world, x + i, y + j)) return false;
  return true;
}

/**
 * The way a boat goes from `from` to `to` over the water (points in tiles): the shortest way over open water tiles
 * (eight ways, never cutting a corner of land), from the open tile nearest each end, smoothed to as few straight legs as
 * stay over open water. Null when there is no way. Pure: the test checks it never crosses land.
 */
export function boatRoute(world: Pick<TownWorld, 'rows' | 'size'>, from: Pt, to: Pt): Pt[] | null {
  const S = world.size;
  const nearestOpen = (p: Pt): Pt | null => {
    let best: Pt | null = null;
    let bd = Infinity;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    for (let r = 0; r <= 4 && !best; r++)
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++) {
          const x = cx + i;
          const y = cy + j;
          if (!open(world, x, y)) continue;
          const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
          if (d < bd) {
            bd = d;
            best = { x, y };
          }
        }
    return best;
  };
  const a = nearestOpen(from);
  const b = nearestOpen(to);
  if (!a || !b) return null;
  // A* over open water tiles
  const key = (x: number, y: number) => y * S + x;
  const g = new Map<number, number>([[key(a.x, a.y), 0]]);
  const came = new Map<number, number>();
  const todo: { k: number; f: number }[] = [{ k: key(a.x, a.y), f: 0 }];
  const done = new Set<number>();
  const goal = key(b.x, b.y);
  while (todo.length > 0) {
    todo.sort((p, q) => p.f - q.f);
    const { k } = todo.shift()!;
    if (k === goal) break;
    if (done.has(k)) continue;
    done.add(k);
    const x = k % S;
    const y = Math.floor(k / S);
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        if (i === 0 && j === 0) continue;
        const nx = x + i;
        const ny = y + j;
        if (!open(world, nx, ny)) continue;
        if (i !== 0 && j !== 0 && (!open(world, x + i, y) || !open(world, x, y + j))) continue;
        const nk = key(nx, ny);
        const ng = (g.get(k) ?? 0) + (i !== 0 && j !== 0 ? Math.SQRT2 : 1);
        if (ng >= (g.get(nk) ?? Infinity)) continue;
        g.set(nk, ng);
        came.set(nk, k);
        todo.push({ k: nk, f: ng + Math.hypot(nx - b.x, ny - b.y) });
      }
  }
  if (!g.has(goal)) return null;
  const tiles: Pt[] = [];
  for (let k: number | undefined = goal; k !== undefined; k = came.get(k)) tiles.unshift({ x: (k % S) + 0.5, y: Math.floor(k / S) + 0.5 });
  // as few straight legs as stay over open water
  const clear = (p: Pt, q: Pt): boolean => {
    const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) * 4);
    for (let s = 0; s <= n; s++) {
      const t = s / Math.max(1, n);
      if (!open(world, Math.floor(p.x + (q.x - p.x) * t), Math.floor(p.y + (q.y - p.y) * t))) return false;
    }
    return true;
  };
  const legs: Pt[] = [tiles[0]];
  let i = 0;
  while (i < tiles.length - 1) {
    let j = tiles.length - 1;
    while (j > i + 1 && !clear(tiles[i], tiles[j])) j--;
    legs.push(tiles[j]);
    i = j;
  }
  // the two ends themselves (the jetty, the mooring): a short last leg off and onto open water
  return [{ ...from }, ...legs, { ...to }];
}

/** The total length of a route (tiles). */
export const routeLength = (route: readonly Pt[]): number => route.reduce((s, p, i) => (i === 0 ? 0 : s + Math.hypot(p.x - route[i - 1].x, p.y - route[i - 1].y)), 0);

/** Where along a route a boat is after `dist` tiles, and which way it heads (radians, atan2 on the grid). */
export function alongRoute(route: readonly Pt[], dist: number): { x: number; y: number; heading: number; done: boolean } {
  let left = Math.max(0, dist);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const heading = Math.atan2(b.y - a.y, b.x - a.x);
    if (left <= len || i === route.length - 1) {
      const t = len > 0 ? Math.min(1, left / len) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, heading, done: i === route.length - 1 && left >= len };
    }
    left -= len;
  }
  const last = route[route.length - 1];
  return { x: last.x, y: last.y, heading: 0, done: true };
}
