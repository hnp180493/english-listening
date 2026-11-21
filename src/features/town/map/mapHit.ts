// What is under a point of the town map (features/town/map): a place (its house as drawn, roof and walls), an
// activity's prop (the pier, the farm fields, the egg kiosk, the boarding house, the notice board), or a tile of the
// ground. The residents, the player and the activities' icons are buttons over the map and answer for themselves.

import { groundAt, TOWN_WORLD, type ActivitySpotId, type TownWorld } from '../../../data/townWorld';
import type { TravelTarget } from '../engine/stage';
import { footprint, PLACE_ART } from './mapGeo';
import { toBox, toGrid, type Box, type MapView, type Pt } from './mapView';

/** Something drawn standing on the map: its footprint on the grid and its height, and where a click on it goes. */
export interface HitShape {
  target: Extract<TravelTarget, { kind: 'place' } | { kind: 'activity' }>;
  corners: readonly Pt[];
  /** Tile edges. */
  h: number;
}

/** Inside a polygon (any winding; on the edge counts). */
export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y) {
      const x = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (p.x <= x) inside = !inside;
    }
  }
  if (inside) return true;
  // on an edge
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segmentDistance(p, poly[j], poly[i]) < 1e-9) return true;
  return false;
}

/** The distance from a point to a segment. */
export function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const k = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy));
}

/** The convex hull of points (counter-clockwise, no repeated points). */
export function convexHull(points: readonly Pt[]): Pt[] {
  const ps = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (ps.length < 3) return ps;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of ps) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The outline of a shape as drawn in the box: its footprint at the ground and at its top, wrapped. */
export function outlineInBox(v: MapView, box: Box, corners: readonly Pt[], h: number): Pt[] {
  const pts: Pt[] = [];
  for (const c of corners) {
    pts.push(toBox(v, box, c.x, c.y));
    if (h > 0) pts.push(toBox(v, box, c.x, c.y, h));
  }
  return convexHull(pts);
}

/** The prop kinds that are an activity's place, by activity. */
const ACTIVITY_PROPS: Readonly<Record<ActivitySpotId, string>> = { fish: 'pier', farm: 'farm', eggs: 'kiosk', wardrobe: 'inn', album: 'board' };

/** The pier's planks on the grid (it has no tiles: it stands over the water from its `at`). */
export function pierCorners(at: Pt): Pt[] {
  return [
    { x: at.x - 1.7, y: at.y - 0.32 },
    { x: at.x + 0.35, y: at.y - 0.32 },
    { x: at.x + 0.35, y: at.y + 0.32 },
    { x: at.x - 1.7, y: at.y + 0.32 },
  ];
}

/** Everything a click on the map can land on besides the ground: the places and the activities' props. */
export function hitShapes(world: TownWorld = TOWN_WORLD): HitShape[] {
  const out: HitShape[] = world.places.map((p) => ({ target: { kind: 'place', id: p.id }, corners: footprint(p), h: PLACE_ART[p.id]?.h ?? 0.8 }));
  for (const [id, kind] of Object.entries(ACTIVITY_PROPS) as [ActivitySpotId, string][]) {
    if (!world.activities?.[id]) continue;
    for (const prop of world.props) {
      if (prop.kind !== kind) continue;
      if (prop.kind === 'pier' && prop.at) {
        out.push({ target: { kind: 'activity', id }, corners: pierCorners(prop.at), h: 0.1 });
        continue;
      }
      if (prop.tiles.length === 0) continue;
      const xs = prop.tiles.map((t) => t.x);
      const ys = prop.tiles.map((t) => t.y);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, d: Math.max(...ys) - Math.min(...ys) + 1 };
      out.push({ target: { kind: 'activity', id }, corners: footprint(box, 0.1), h: kind === 'inn' ? 1.2 : kind === 'farm' ? 0.05 : 0.6 });
    }
  }
  return out;
}

/**
 * What a click at (px, py) in the box lands on: the front-most shape whose outline holds the point (within `slop`
 * px), else the tile of the ground under it (null on the water and off the island).
 */
export function hitMap(v: MapView, box: Box, px: number, py: number, shapes: readonly HitShape[], world: TownWorld = TOWN_WORLD, slop = 3): TravelTarget | null {
  const p = { x: px, y: py };
  let best: { s: HitShape; depth: number } | null = null;
  for (const s of shapes) {
    const outline = outlineInBox(v, box, s.corners, s.h);
    if (!pointInPolygon(p, outline) && !nearOutline(p, outline, slop)) continue;
    // the nearer one wins (lower on the map = nearer the viewer)
    const mid = s.corners.reduce((m, c) => ({ x: m.x + c.x / s.corners.length, y: m.y + c.y / s.corners.length }), { x: 0, y: 0 });
    const depth = toBox(v, box, mid.x, mid.y).y;
    if (!best || depth > best.depth) best = { s, depth };
  }
  if (best) return best.s.target;
  const g = toGrid(v, box, px, py);
  const tile = { x: Math.floor(g.x), y: Math.floor(g.y) };
  const ground = groundAt(tile, world);
  if (!ground || ground === 'water') return null;
  return { kind: 'tile', x: g.x, y: g.y };
}

function nearOutline(p: Pt, poly: readonly Pt[], slop: number): boolean {
  if (slop <= 0) return false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segmentDistance(p, poly[j], poly[i]) <= slop) return true;
  return false;
}
