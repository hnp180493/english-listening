// What is under the pointer in the 3D town, as pure geometry: a ray (from the camera through the pixel) against
// people (upright cylinders), places and props (boxes) and the ground (the plane y = 0). No meshes are raycast: the
// shapes are simple and known, so picking is cheap and the same in tests as on the screen.

import type { ActivitySpotId, PlaceId, Tile } from '../../../../data/townWorld';
import type { P3 } from './coords';

export interface Ray {
  o: P3;
  /** Unit direction. */
  d: P3;
}

export interface Aabb {
  min: P3;
  max: P3;
}

/** Distance along the ray to the plane y = h, or null when it never gets there. */
export function rayPlaneY(r: Ray, h = 0): number | null {
  if (Math.abs(r.d.y) < 1e-9) return null;
  const t = (h - r.o.y) / r.d.y;
  return t >= 0 ? t : null;
}

/**
 * Distance along the ray to where it first meets the ground (the height field `lift`, 0 to `top` high; without it
 * the plane y = 0), or null when it never gets down there. Marched in steps of a tenth of a tile across the ground,
 * then halved down to a thousandth: a ray over the hill stops on its slope, not on the flat under it.
 */
export function rayGround(r: Ray, lift?: (x: number, z: number) => number, top = 2): number | null {
  const bottom = rayPlaneY(r, 0);
  if (!lift || bottom === null) return bottom;
  const from = r.o.y > top ? (rayPlaneY(r, top) ?? 0) : 0;
  const above = (t: number) => r.o.y + r.d.y * t - lift(r.o.x + r.d.x * t, r.o.z + r.d.z * t);
  const across = Math.hypot(r.d.x, r.d.z) * (bottom - from);
  const n = Math.max(1, Math.ceil(across / 0.1));
  let a = from;
  for (let i = 1; i <= n; i++) {
    const b = from + ((bottom - from) * i) / n;
    if (above(b) <= 0) {
      let lo = a;
      let hi = b;
      for (let k = 0; k < 12; k++) {
        const m = (lo + hi) / 2;
        if (above(m) > 0) lo = m;
        else hi = m;
      }
      return hi;
    }
    a = b;
  }
  return bottom;
}

/** Distance along the ray to where it enters a box (0 when it starts inside), or null. */
export function rayAabb(r: Ray, b: Aabb): number | null {
  let t0 = 0;
  let t1 = Infinity;
  for (const k of ['x', 'y', 'z'] as const) {
    const o = r.o[k];
    const d = r.d[k];
    const lo = b.min[k];
    const hi = b.max[k];
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let ta = (lo - o) / d;
    let tb = (hi - o) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

/** Distance along the ray to an upright cylinder (centre cx, cz; radius r; from y0 to y1), or null. */
export function rayCylinder(r: Ray, cx: number, cz: number, radius: number, y0: number, y1: number): number | null {
  const ox = r.o.x - cx;
  const oz = r.o.z - cz;
  const a = r.d.x * r.d.x + r.d.z * r.d.z;
  let best: number | null = null;
  if (a > 1e-12) {
    const b = 2 * (ox * r.d.x + oz * r.d.z);
    const c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
        if (t < 0) continue;
        const y = r.o.y + r.d.y * t;
        if (y >= y0 && y <= y1) {
          best = t;
          break;
        }
      }
    }
  }
  // the caps (seen from above: the top of a head)
  for (const h of [y1, y0]) {
    const t = rayPlaneY(r, h);
    if (t === null) continue;
    const x = r.o.x + r.d.x * t - cx;
    const z = r.o.z + r.d.z * t - cz;
    if (x * x + z * z <= radius * radius && (best === null || t < best)) best = t;
  }
  return best;
}

export type Hit3 =
  | { kind: 'resident'; placeId: PlaceId }
  | { kind: 'place'; placeId: PlaceId; built: boolean }
  | { kind: 'activity'; id: ActivitySpotId }
  | { kind: 'tile'; tile: Tile; walkable: boolean; at?: { x: number; z: number } };

export interface PickPerson {
  placeId: PlaceId;
  x: number;
  z: number;
  /** Head top above the feet. */
  height: number;
}

export interface PickBox {
  hit: Extract<Hit3, { kind: 'place' } | { kind: 'activity' }>;
  box: Aabb;
}

/** A person is this wide to the pointer (generous: a tap on a phone). */
export const PERSON_PICK_RADIUS = 0.32;

/**
 * The front-most thing on the ray: a resident first when the ray touches one (they stand in front of their place,
 * and small), then the nearest place or activity box, then the ground tile (walkable or not). Null off the map.
 */
export function pick3(r: Ray, people: readonly PickPerson[], boxes: readonly PickBox[], size: number, walkable: (t: Tile) => boolean, lift?: (x: number, z: number) => number): Hit3 | null {
  let person: { t: number; id: PlaceId } | null = null;
  for (const p of people) {
    const t = rayCylinder(r, p.x, p.z, PERSON_PICK_RADIUS, 0, p.height + 0.12);
    if (t !== null && (!person || t < person.t)) person = { t, id: p.placeId };
  }
  let thing: { t: number; hit: PickBox['hit'] } | null = null;
  for (const b of boxes) {
    const t = rayAabb(r, b.box);
    if (t !== null && (!thing || t < thing.t)) thing = { t, hit: b.hit };
  }
  // a resident wins unless a box stands clearly in front of them (a wall between the camera and a person behind it)
  if (person && (!thing || person.t <= thing.t + 0.6)) return { kind: 'resident', placeId: person.id };
  if (thing) return thing.hit;
  const t = rayGround(r, lift);
  if (t === null) return null;
  const gx = r.o.x + r.d.x * t;
  const gz = r.o.z + r.d.z * t;
  const x = Math.floor(gx);
  const y = Math.floor(gz);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  const tile = { x, y };
  return { kind: 'tile', tile, walkable: walkable(tile), at: { x: gx, z: gz } };
}

/** How far (tiles) past its edge the point under the pointer may go before the hovered square moves on. */
export const HOVER_STICK = 0.12;

/**
 * The tile the hovered square stands on (docs/town.md §7 "The hovered square"): the tile under the point, but the one
 * shown already while the point stays within HOVER_STICK past its edges, so a pointer resting on a line between two
 * tiles (or a camera settling a hair) never flips the square to and fro.
 */
export function stickyTile(prev: Tile | null, at: { x: number; z: number }, stick = HOVER_STICK): Tile {
  if (prev && at.x >= prev.x - stick && at.x < prev.x + 1 + stick && at.z >= prev.y - stick && at.z < prev.y + 1 + stick) return prev;
  return { x: Math.floor(at.x), y: Math.floor(at.z) };
}
