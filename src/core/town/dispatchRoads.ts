// The streets of Westbay as the dispatch office's cars drive them (./dispatch.ts RouteFn): the painted street and square
// tiles of the map's rows ('=' a street, 'o' a paved square), a shortest way between two tiles found breadth first, and
// thinned to its corners so a car drives straight along a street. Pure; one distance field per target tile is kept.

import type { Pt, RouteFn } from './dispatch';

const ROAD = new Set(['=', 'o']);

export function makeRoutes(rows: readonly string[]): RouteFn {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const road = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && ROAD.has(rows[y][x]);
  const fields = new Map<number, Int32Array>();
  const key = (x: number, y: number) => y * w + x;

  /** The road tile nearest a point (a door is on one already). */
  const snap = (p: Pt): Pt | null => {
    const x0 = Math.floor(p.x);
    const y0 = Math.floor(p.y);
    if (road(x0, y0)) return { x: x0, y: y0 };
    for (let r = 1; r < 12; r++) {
      let best: Pt | null = null;
      let bd = Infinity;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !road(x0 + dx, y0 + dy)) continue;
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = { x: x0 + dx, y: y0 + dy };
          }
        }
      if (best) return best;
    }
    return null;
  };

  /** Steps from every road tile to `t` (−1: no way). */
  const field = (t: Pt): Int32Array => {
    const k = key(t.x, t.y);
    let f = fields.get(k);
    if (f) return f;
    f = new Int32Array(w * h).fill(-1);
    const q: number[] = [k];
    f[k] = 0;
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % w;
      const y = (q[i] - x) / w;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!road(nx, ny) || f[key(nx, ny)] >= 0) continue;
        f[key(nx, ny)] = f[q[i]] + 1;
        q.push(key(nx, ny));
      }
    }
    if (fields.size > 64) fields.delete(fields.keys().next().value!);
    fields.set(k, f);
    return f;
  };

  return (from: Pt, to: Pt): Pt[] => {
    const a = snap(from);
    const b = snap(to);
    if (!a || !b) return [to];
    const f = field(b);
    if (f[key(a.x, a.y)] < 0) return [to];
    const tiles: Pt[] = [a];
    let at = a;
    // walk down the field, keeping on the same heading while it still goes down (fewer corners)
    let dir: [number, number] = [0, 0];
    while (at.x !== b.x || at.y !== b.y) {
      const here = f[key(at.x, at.y)];
      const steps: [number, number][] = [dir, [1, 0], [-1, 0], [0, 1], [0, -1]];
      const next = steps.find(([dx, dy]) => (dx || dy) && road(at.x + dx, at.y + dy) && f[key(at.x + dx, at.y + dy)] === here - 1);
      if (!next) break;
      dir = next;
      at = { x: at.x + next[0], y: at.y + next[1] };
      tiles.push(at);
    }
    // only the corners, at tile centres, then the target itself
    const out: Pt[] = [];
    for (let i = 1; i < tiles.length; i++) {
      const p = tiles[i - 1];
      const q = tiles[i];
      const n = tiles[i + 1];
      if (!n || n.x - q.x !== q.x - p.x || n.y - q.y !== q.y - p.y) out.push({ x: q.x + 0.5, y: q.y + 0.5 });
    }
    out.push({ x: to.x, y: to.y });
    return out;
  };
}
