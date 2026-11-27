// A "cảnh nghe" at a thing (docs/town.md §19): the seat the player sits on, and where the two overheard stand. Pure,
// tested over every bench of the town and Westbay (listenSpots.test.ts): the player sits on THE thing they used, never
// another one (owner, 2026-11-28: "ngồi ở ghế này bị teleport tới ghế khác?").

import { walkable } from '../../../core/town/map';
import type { ActivitySpotId, Seat, TownWorld } from '../../../data/townWorld';
import { bodyFits, OCTANTS, PLAYER_RADIUS } from './sim';

type Pt = { x: number; y: number };

/** The thing's own seats (on its tile, there from the first day), the first free one, or null (none, or all taken). */
export function thingSeat(world: TownWorld, spot: ActivitySpotId, taken: ReadonlySet<Seat | null> = new Set()): Seat | null {
  const a = world.activities?.[spot];
  if (!a?.box) return null;
  const own = (world.life?.seats ?? []).filter((s) => !s.needs && Math.floor(s.x) === Math.floor(a.box!.x) && Math.floor(s.y) === Math.floor(a.box!.y));
  return own.find((s) => !taken.has(s)) ?? null;
}

/**
 * Where `n` people overheard stand: a few steps in front of `at` (the seat, facing `oct`), side by side across the view;
 * nearer or further where that is shut. With `from`: where each walks in from (further off the same way), or null.
 */
export function asideSpots(world: TownWorld, at: Pt, oct: number, n: number): { spots: Pt[]; from: (Pt | null)[] } | null {
  const o = OCTANTS[oct] ?? OCTANTS[0];
  const l = Math.hypot(o.x, o.y) || 1;
  const fx = o.x / l;
  const fy = o.y / l;
  const fits = (c: Pt) => walkable({ x: Math.floor(c.x), y: Math.floor(c.y) }, world) && bodyFits(c.x, c.y, PLAYER_RADIUS, world);
  for (const d of [2.1, 2.7, 1.6, 3.3]) {
    const c = { x: at.x + fx * d, y: at.y + fy * d };
    const spots = Array.from({ length: n }, (_, i) => ({ x: c.x - fy * (i - (n - 1) / 2), y: c.y + fx * (i - (n - 1) / 2) }));
    if (!spots.every(fits)) continue;
    const from = spots.map((s) => {
      for (const k of [5, 3.5]) {
        const c2 = { x: s.x + fx * k, y: s.y + fy * k };
        if (fits(c2)) return c2;
      }
      return null;
    });
    return { spots, from };
  }
  // a bench facing the water (or a hedge) right in front: the two stand at its sides, a little forward, never behind
  if (n <= 2) {
    for (const side of [1.3, 1.8]) {
      for (const k of [0.9, 0.5, 0]) {
        const spots = (n === 1 ? [1] : [-1, 1]).map((sg) => ({ x: at.x + fx * k - fy * side * sg, y: at.y + fy * k + fx * side * sg }));
        if (!spots.every(fits)) continue;
        const from = spots.map((sp, i) => {
          const sg = n === 1 ? 1 : i === 0 ? -1 : 1;
          for (const m of [3.5, 2.5]) {
            const c2 = { x: sp.x - fy * m * sg, y: sp.y + fx * m * sg };
            if (fits(c2)) return c2;
          }
          return null;
        });
        return { spots, from };
      }
    }
  }
  return null;
}
