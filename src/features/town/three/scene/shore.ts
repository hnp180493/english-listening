// The pond's shoreline, smooth: the tile edges between water and land are one or more closed loops, relaxed into
// a smooth curve that stays close to the tiles (smoothShore). The terrain
// (terrain.ts) draws the grass, the sandy beach, the banks and the water along this curve instead of along the tiles'
// stair steps.
//
// Walking keeps the tiles (core/town/map.ts: a water tile is a closed box). The curve stays close to them: the drawn
// water reaches at most an eighth of a tile into a land tile
// (LAND_SLACK), so a body of BODY_RADIUS standing against the water's box still stands on the drawn land.

/** A point of the tile grid (x across, y down the rows: three's X and Z). */
export interface ShorePt {
  x: number;
  y: number;
}

/**
 * The closed loops of tile edges with water on one side and anything else on the other, water on the left of the
 * way round (in grid coordinates: x right, y down, so the loops run clockwise on the screen of a map). Every edge is
 * one tile long. At a corner where two water tiles only touch diagonally the loop turns into the water (the two are
 * drawn apart).
 */
export function shoreLoops(isWater: (x: number, y: number) => boolean, size: number): ShorePt[][] {
  // directed edges, keyed by their start
  const out = new Map<string, ShorePt[]>();
  let edges = 0;
  const key = (x: number, y: number) => `${x},${y}`;
  const add = (ax: number, ay: number, bx: number, by: number) => {
    edges++;
    const k = key(ax, ay);
    const list = out.get(k);
    if (list) list.push({ x: bx, y: by });
    else out.set(k, [{ x: bx, y: by }]);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isWater(x, y)) continue;
      if (!isWater(x, y - 1)) add(x + 1, y, x, y);
      if (!isWater(x - 1, y)) add(x, y, x, y + 1);
      if (!isWater(x, y + 1)) add(x, y + 1, x + 1, y + 1);
      if (!isWater(x + 1, y)) add(x + 1, y + 1, x + 1, y);
    }
  }
  const loops: ShorePt[][] = [];
  const used = new Set<string>();
  const edgeKey = (a: ShorePt, b: ShorePt) => `${a.x},${a.y}>${b.x},${b.y}`;
  for (const [k, ends] of out) {
    for (const first of ends) {
      const [sx, sy] = k.split(',').map(Number);
      const start = { x: sx, y: sy };
      if (used.has(edgeKey(start, first))) continue;
      const loop: ShorePt[] = [start];
      let a = start;
      let b = first;
      for (let guard = 0; guard <= edges; guard++) {
        used.add(edgeKey(a, b));
        if (b.x === start.x && b.y === start.y) break;
        loop.push(b);
        const next = (out.get(key(b.x, b.y)) ?? []).filter((n) => !used.has(edgeKey(b, n)));
        if (next.length === 0) break;
        // more than one way on (a diagonal touch): the sharpest turn towards the water (the left)
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let pick = next[0];
        let best = Infinity;
        for (const n of next) {
          const ex = n.x - b.x;
          const ey = n.y - b.y;
          // the turn's sign: left in these coordinates (y down) is a negative cross product
          const turn = dx * ey - dy * ex;
          if (turn < best) {
            best = turn;
            pick = n;
          }
        }
        a = b;
        b = pick;
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

/** One round of Chaikin's corner cutting on a closed loop. */
export function chaikin(loop: readonly ShorePt[]): ShorePt[] {
  const n = loop.length;
  const res: ShorePt[] = [];
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    res.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  return res;
}

/** How far the drawn water may reach into a land tile (tiles): less than a body's radius (see the top). */
export const LAND_SLACK = 0.12;
/** How far the drawn land may reach over a water tile (tiles: you cannot walk there, it only looks like a bank). */
export const WATER_SLACK = 0.6;

/** The nearest point of the tiles of one kind (water or not) to (px, py) within two tiles, or null. */
function nearestOf(isWater: (x: number, y: number) => boolean, water: boolean, px: number, py: number): ShorePt | null {
  let best: ShorePt | null = null;
  let bd = Infinity;
  const tx = Math.floor(px);
  const ty = Math.floor(py);
  for (let y = ty - 2; y <= ty + 2; y++) {
    for (let x = tx - 2; x <= tx + 2; x++) {
      if (isWater(x, y) !== water) continue;
      const cx = Math.max(x, Math.min(px, x + 1));
      const cy = Math.max(y, Math.min(py, y + 1));
      const d = Math.hypot(px - cx, py - cy);
      if (d < bd) {
        bd = d;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}

/** Keep a point of the curve within LAND_SLACK of the water tiles and within WATER_SLACK of the land tiles. */
function keepNear(isWater: (x: number, y: number) => boolean, p: ShorePt): ShorePt {
  for (const [water, slack] of [
    [true, LAND_SLACK],
    [false, WATER_SLACK],
  ] as const) {
    const q = nearestOf(isWater, water, p.x, p.y);
    if (!q) continue;
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d > slack) p = { x: q.x + ((p.x - q.x) * slack) / d, y: q.y + ((p.y - q.y) * slack) / d };
  }
  return p;
}

/**
 * The rounded shore: the tile-edge loops relaxed (each point drawn towards its neighbours' middle, many times) while
 * kept close to the tiles (keepNear: the water reaches LAND_SLACK into a land tile at most, the bank WATER_SLACK over a
 * water tile), then a round of corner cutting. A staircase of tiles becomes a straight bank along the land's corners.
 */
export function smoothShore(isWater: (x: number, y: number) => boolean, size: number, relax = 40): ShorePt[][] {
  return shoreLoops(isWater, size).map((l) => {
    let s = l;
    for (let k = 0; k < relax; k++) {
      const n = s.length;
      s = s.map((p, i) => {
        const a = s[(i + n - 1) % n];
        const b = s[(i + 1) % n];
        return keepNear(isWater, { x: p.x + ((a.x + b.x) / 2 - p.x) * 0.5, y: p.y + ((a.y + b.y) / 2 - p.y) * 0.5 });
      });
    }
    return chaikin(chaikin(s)).map((p) => keepNear(isWater, p));
  });
}

/**
 * Distance to the rounded shore and which side of it a point is on, fast enough for every vertex of the ground near
 * the water: the curve's segments are kept per tile.
 */
export class ShoreField {
  private readonly segs: number[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly rows = new Map<number, number[]>();
  private readonly size: number;

  constructor(loops: readonly (readonly ShorePt[])[], size: number) {
    this.size = size;
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        const s = this.segs.length / 4;
        this.segs.push(a.x, a.y, b.x, b.y);
        const x0 = Math.floor(Math.min(a.x, b.x));
        const x1 = Math.floor(Math.max(a.x, b.x));
        const y0 = Math.floor(Math.min(a.y, b.y));
        const y1 = Math.floor(Math.max(a.y, b.y));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const k = this.cellKey(x, y);
            const list = this.cells.get(k);
            if (list) list.push(s);
            else this.cells.set(k, [s]);
          }
          const row = this.rows.get(y);
          if (row) row.push(s);
          else this.rows.set(y, [s]);
        }
      }
    }
  }

  private cellKey(x: number, y: number): number {
    return (y + 4) * (this.size + 8) + (x + 4);
  }

  /** Distance to the curve, capped at `cap` (tiles; at most 2). */
  distance(px: number, py: number, cap = 1): number {
    let best = cap * cap;
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    const reach = Math.min(2, Math.ceil(cap));
    const s = this.segs;
    for (let y = ty - reach; y <= ty + reach; y++) {
      for (let x = tx - reach; x <= tx + reach; x++) {
        const list = this.cells.get(this.cellKey(x, y));
        if (!list) continue;
        for (const i of list) {
          const ax = s[i * 4];
          const ay = s[i * 4 + 1];
          const bx = s[i * 4 + 2];
          const by = s[i * 4 + 3];
          const ex = bx - ax;
          const ey = by - ay;
          const l2 = ex * ex + ey * ey || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / l2));
          const dx = ax + ex * t - px;
          const dy = ay + ey * t - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) best = d2;
        }
      }
    }
    return Math.sqrt(best);
  }

  /** Inside the water (the curve's even-odd inside: a ray to +x crosses it an odd number of times). */
  inWater(px: number, py: number): boolean {
    const list = this.rows.get(Math.floor(py));
    if (!list) return false;
    const s = this.segs;
    let inside = false;
    for (const i of list) {
      const ax = s[i * 4];
      const ay = s[i * 4 + 1];
      const bx = s[i * 4 + 2];
      const by = s[i * 4 + 3];
      if (ay > py !== by > py) {
        const x = ax + ((py - ay) / (by - ay)) * (bx - ax);
        if (x > px) inside = !inside;
      }
    }
    return inside;
  }

  /** Signed distance: positive on land, negative in the water (capped at ±`cap`). */
  signed(px: number, py: number, cap = 1): number {
    const d = this.distance(px, py, cap);
    return this.inWater(px, py) ? -d : d;
  }
}
