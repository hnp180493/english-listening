// What is under the pointer: a resident, a place (house or empty lot) or a tile. Pure: it works on world pixels
// (the camera has already been undone) and on the simulation's positions.

import { walkable } from '../../../core/town/map';
import type { PlaceId, Tile, WorldPlace } from '../../../data/townWorld';
import { depthOfFootprint, depthOfPoint, toTile, toWorld, type Pt } from './iso';
import { LOT_HEIGHT, placeHeight } from './places';
import type { TownSim } from './sim';

export type Hit =
  | { kind: 'resident'; placeId: PlaceId }
  | { kind: 'place'; placeId: PlaceId; built: boolean }
  | { kind: 'tile'; tile: Tile; walkable: boolean };

/** A character is about this big around its feet (world pixels); the name tag above it counts too. */
export const ACTOR_HALF_WIDTH = 16;
export const ACTOR_ABOVE = 62;
export const ACTOR_BELOW = 6;

/** The outline of a box standing on a footprint, as seen on the screen: six corners. */
export function silhouette(p: Pick<WorldPlace, 'x' | 'y' | 'w' | 'd'>, height: number): Pt[] {
  const x1 = p.x + p.w;
  const y1 = p.y + p.d;
  return [
    toWorld(p.x, y1, 0),
    toWorld(x1, y1, 0),
    toWorld(x1, p.y, 0),
    toWorld(x1, p.y, height),
    toWorld(p.x, p.y, height),
    toWorld(p.x, y1, height),
  ];
}

export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** True when a world point is on a character standing at (x, y) of the tile grid. */
export function onActor(w: Pt, x: number, y: number): boolean {
  const feet = toWorld(x, y);
  return Math.abs(w.x - feet.x) <= ACTOR_HALF_WIDTH && w.y <= feet.y + ACTOR_BELOW && w.y >= feet.y - ACTOR_ABOVE;
}

/**
 * The front-most thing at a world point: a resident first (they stand in front of their place), then a place, then
 * the ground tile. Null outside the map.
 */
export function pickAt(w: Pt, sim: TownSim): Hit | null {
  let best: { depth: number; id: PlaceId } | null = null;
  for (const r of sim.residents.values()) {
    if (!onActor(w, r.x, r.y)) continue;
    const depth = depthOfPoint(r.x, r.y);
    if (!best || depth > best.depth) best = { depth, id: r.place.id };
  }
  if (best) return { kind: 'resident', placeId: best.id };

  let place: { depth: number; p: WorldPlace } | null = null;
  for (const p of sim.world.places) {
    const built = sim.isBuilt(p.id);
    if (!pointInPolygon(w, silhouette(p, built ? placeHeight(p.id) : LOT_HEIGHT))) continue;
    const depth = depthOfFootprint(p.x, p.y, p.w, p.d);
    if (!place || depth > place.depth) place = { depth, p };
  }
  if (place) return { kind: 'place', placeId: place.p.id, built: sim.isBuilt(place.p.id) };

  const g = toTile(w.x, w.y);
  const tile = { x: Math.floor(g.x), y: Math.floor(g.y) };
  if (tile.x < 0 || tile.y < 0 || tile.x >= sim.world.size || tile.y >= sim.world.size) return null;
  return { kind: 'tile', tile, walkable: walkable(tile, sim.world) };
}
