// The town map's knowledge of the world (features/town/map): which part of town a point is in, where "Đến ngay"
// puts the player, and how tall each place stands on the map. Pure (the world data and the walk grid).

import { NEIGHBOURS, nearestWalkable, walkable } from '../../../core/town/map';
import { TOWN_WORLD, type PlaceId, type Tile, type TownWorld, type WorldDistrict, type WorldPlace } from '../../../data/townWorld';
import type { TravelTarget } from '../engine/stage';
import type { Pt } from './mapView';

/** The part of town a point of the grid is in: the smallest district box round it (they overlap at their edges); null outside them all. */
export function districtAt(x: number, y: number, world: TownWorld = TOWN_WORLD): WorldDistrict | null {
  let best: WorldDistrict | null = null;
  for (const d of world.districts ?? []) {
    if (x < d.x || y < d.y || x >= d.x + d.w || y >= d.y + d.d) continue;
    if (!best || d.w * d.d < best.w * best.d) best = d;
  }
  return best;
}

/** Where a place's door leads out (radians on the grid): its +x face looks along +x, its +y face along +y. */
export function doorHeading(p: Pick<WorldPlace, 'face'>): number {
  return p.face === 'x' ? 0 : Math.PI / 2;
}

/** A point somebody stands at (a resident), as the warp keeps clear of. */
export interface Body {
  x: number;
  y: number;
}

/** Somebody stands on this tile (their middle within 0.75 of its centre). */
function taken(t: Tile, people: readonly Body[]): boolean {
  return people.some((b) => Math.hypot(b.x - t.x - 0.5, b.y - t.y - 0.5) < 0.75);
}

/** `t` if it is free to stand on, else the free walkable neighbour nearest to `near` (a point of the grid). */
function freeAt(t: Tile, people: readonly Body[], world: TownWorld, near: Pt = { x: t.x + 0.5, y: t.y + 0.5 }): Tile | null {
  if (walkable(t, world) && !taken(t, people)) return t;
  let best: Tile | null = null;
  let bestD = Infinity;
  for (let ring = 1; ring <= 2 && !best; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const c = { x: t.x + dx, y: t.y + dy };
        if (!walkable(c, world) || taken(c, people)) continue;
        const d = Math.hypot(c.x + 0.5 - near.x, c.y + 0.5 - near.y);
        if (d < bestD - 1e-9) {
          best = c;
          bestD = d;
        }
      }
    }
  }
  return best;
}

export interface WarpSpot {
  /** A point of the grid (a tile's centre). */
  x: number;
  y: number;
  /** The way the player faces there (radians on the grid). */
  heading: number;
}

/**
 * Where "Đến ngay" puts the player: at a place's door looking out to the street; beside a resident (in front of
 * them as the viewer sees it, on a free tile) looking at them; on an activity's spot looking at it; on a tile of the
 * ground (or the walkable tile nearest to it), the way they faced before. Never on somebody (`people`: the residents,
 * where they stand now). Null when there is nowhere to stand.
 */
export function warpSpot(target: TravelTarget, people: readonly (Body & { id?: string })[], heading: number, world: TownWorld = TOWN_WORLD): WarpSpot | null {
  const at = (t: Tile | null, h: number): WarpSpot | null => (t ? { x: t.x + 0.5, y: t.y + 0.5, heading: h } : null);
  if (target.kind === 'place') {
    const p = world.places.find((q) => q.id === target.id);
    if (!p) return null;
    return at(freeAt(p.door, people, world), doorHeading(p));
  }
  if (target.kind === 'resident') {
    const r = people.find((b) => b.id === target.id);
    if (!r) return warpSpot({ kind: 'place', id: target.id }, people, heading, world);
    const others = people.filter((b) => b !== r);
    const tile = { x: Math.floor(r.x), y: Math.floor(r.y) };
    // beside them across the screen first (the two read apart), then in front, then the rest
    for (const d of [...SIDE_FIRST, ...NEIGHBOURS]) {
      const c = { x: tile.x + d.x, y: tile.y + d.y };
      if (!walkable(c, world) || taken(c, others)) continue;
      if (Math.hypot(c.x + 0.5 - r.x, c.y + 0.5 - r.y) < 0.85) continue;
      return at(c, Math.atan2(r.y - c.y - 0.5, r.x - c.x - 0.5));
    }
    return at(freeAt(tile, people, world), heading);
  }
  if (target.kind === 'activity') {
    const s = world.activities?.[target.id];
    if (!s) return null;
    const t = freeAt(s.stand, people, world);
    if (!t) return null;
    return at(t, Math.atan2(s.look.y - t.y - 0.5, s.look.x - t.x - 0.5));
  }
  const wanted = { x: Math.floor(target.x), y: Math.floor(target.y) };
  const near = nearestWalkable(wanted, world);
  return near ? at(freeAt(near, people, world, { x: target.x, y: target.y }), heading) : null;
}

/** Steps from somebody where the player stands beside them as the viewer sees it (the diagonals across the screen), first. */
const SIDE_FIRST: readonly Tile[] = [
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

/** Where a target is on the grid (the door, the resident, the spot, the tile), for the distance from the player. */
export function targetPoint(target: TravelTarget, people: readonly (Body & { id?: string })[], world: TownWorld = TOWN_WORLD): Pt | null {
  if (target.kind === 'tile') return { x: target.x, y: target.y };
  if (target.kind === 'activity') {
    const s = world.activities?.[target.id];
    return s ? { x: s.stand.x + 0.5, y: s.stand.y + 0.5 } : null;
  }
  if (target.kind === 'resident') {
    const r = people.find((b) => b.id === target.id);
    if (r) return { x: r.x, y: r.y };
  }
  const p = world.places.find((q) => q.id === target.id);
  return p ? { x: p.door.x + 0.5, y: p.door.y + 0.5 } : null;
}

/** A place's look on the map: walls, roof, how tall (tile edges) and the roof's shape. GAME ART (palette3d colours). */
export interface PlaceArt {
  wall: string;
  roof: string;
  /** Walls' height, tile edges. */
  h: number;
  roofKind: 'gable' | 'flat' | 'round' | 'open';
}

/** The colours of the 3D town's places (three/scene/places3d.ts), as the map draws them. */
export const PLACE_ART: Readonly<Record<PlaceId, PlaceArt>> = {
  square: { wall: '#d8d2cc', roof: '#ef6f6c', h: 0.55, roofKind: 'round' },
  cafe: { wall: '#fff2dc', roof: '#f2907f', h: 0.85, roofKind: 'gable' },
  friend: { wall: '#f6b7c6', roof: '#9b7cc6', h: 0.8, roofKind: 'gable' },
  home: { wall: '#b9dcf3', roof: '#6f9fd8', h: 0.8, roofKind: 'gable' },
  shop: { wall: '#9ad8b6', roof: '#5fb5b0', h: 0.85, roofKind: 'flat' },
  office: { wall: '#cdb9ef', roof: '#9b7cc6', h: 1.45, roofKind: 'flat' },
  school: { wall: '#f3b9a0', roof: '#f2907f', h: 0.9, roofKind: 'gable' },
  station: { wall: '#a9d3ee', roof: '#6f9fd8', h: 0.5, roofKind: 'open' },
  clinic: { wall: '#ffffff', roof: '#9ad8b6', h: 0.85, roofKind: 'gable' },
  cinema: { wall: '#9b7cc6', roof: '#4b5d8c', h: 1.1, roofKind: 'flat' },
  phone: { wall: '#d3efe9', roof: '#6f9fd8', h: 0.8, roofKind: 'flat' },
  park: { wall: '#7cc36b', roof: '#5aa65a', h: 0.35, roofKind: 'open' },
  board: { wall: '#c99163', roof: '#8d6245', h: 0.5, roofKind: 'open' },
};

/** The corners of a place's footprint on the grid (a little in from its tiles), clockwise from the far corner. */
export function footprint(p: Pick<WorldPlace, 'x' | 'y' | 'w' | 'd'>, inset = 0.12): Pt[] {
  return [
    { x: p.x + inset, y: p.y + inset },
    { x: p.x + p.w - inset, y: p.y + inset },
    { x: p.x + p.w - inset, y: p.y + p.d - inset },
    { x: p.x + inset, y: p.y + p.d - inset },
  ];
}
