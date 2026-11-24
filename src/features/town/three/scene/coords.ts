// Pure coordinate helpers of the 3D town (three/contracts.ts): 1 unit = 1 tile edge, three X = tile x, three Z =
// tile y, Y up. A point of the sim's tile grid (x, y) stands at three (x, 0, y); the centre of tile (3, 4) is
// (3.5, 0, 4.5). Headings are radians on the ground measured from +X towards +Z (Math.atan2(dz, dx)).

import { hash2 } from '../../../../core/town/colliders';
import type { Ground, Tile, TownWorld } from '../../../../data/townWorld';

/** A stable pseudo-random number in [0, 1) for a pair of integers (and a seed): one source with core/town/colliders.ts. */
export { hash2 };

export interface P3 {
  x: number;
  y: number;
  z: number;
}

/** Where a point of the sim's grid stands in the scene (feet on the ground unless `up`). */
export function gridToScene(x: number, y: number, up = 0): P3 {
  return { x, y: up, z: y };
}

/** The point of the sim's grid under a scene point. */
export function sceneToGrid(p: { x: number; z: number }): Tile {
  return { x: p.x, y: p.z };
}

/** The tile (integers) under a scene point, or null outside a world of `size` tiles. */
export function tileAt(p: { x: number; z: number }, size: number): Tile | null {
  const x = Math.floor(p.x);
  const y = Math.floor(p.z);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
}

/** The heading of a step on the grid (contract: atan2(dz, dx)). */
export function headingOf(dx: number, dy: number): number {
  return Math.atan2(dy, dx);
}

/** The heading of a sim octant (sim.ts OCTANTS: 0 = +x, 1 = +x+y, 2 = +y …). */
export function octantHeading(oct: number): number {
  return (((oct % 8) + 8) % 8) * (Math.PI / 4);
}

/** The shortest signed turn from heading a to heading b, in (-π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Smooth value noise in [0, 1] on the plane (for gentle colour variation of the grass). */
export function valueNoise(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** The ground of a tile character ('T' / 't' trees and 'F' the fountain stand on grass / plaza); null outside. */
export function groundOf(world: TownWorld, x: number, y: number): Ground | null {
  if (x < 0 || y < 0 || x >= world.size || y >= world.size) return null;
  const ch = world.rows[y]?.[x];
  if (ch === undefined) return null;
  if (ch === '=') return 'path';
  if (ch === 'o' || ch === 'F') return 'plaza';
  if (ch === '~') return 'water';
  if (ch === ':' || ch === 'p') return 'sand';
  return 'grass';
}

/** The middle of a set of tiles (tile centres), or of a prop's `at`. */
export function middleOf(tiles: readonly Tile[]): { x: number; y: number } | null {
  if (tiles.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const t of tiles) {
    x += t.x + 0.5;
    y += t.y + 0.5;
  }
  return { x: x / tiles.length, y: y / tiles.length };
}

/** A heading turned towards the camera (which stands at heading `yaw` from what it looks at) by at most `most` (40°). */
export function towardViewer(h: number, yaw: number, most = 0.7): number {
  const d = angleDiff(h, yaw);
  return h + Math.max(-most, Math.min(most, d));
}
