import { describe, expect, it } from 'vitest';
import { CITY_WORLD } from '../cityWorld';
import { alongRoute, boatRoute, JETTY_END, LAST_WAREHOUSE, QUAY_LANE_X, ROW_FAR_END, routeLength, W15, W15_DOORS, W15_MOORING, WAREHOUSES } from './warehouses';
import { findPath, shoreDistance, walkable } from '../../core/town/map';
import { walkWorld } from '../../core/town/colliders';

const W = CITY_WORLD;
const walk = walkWorld(W, { built: [...W.places.map((p) => p.id as string), 'station'], decorations: [] });

describe('the harbour\'s warehouses (docs/town.md §32)', () => {
  it('are numbered up to twenty-two, fifteen among them, and there is no fifty', () => {
    const ns = WAREHOUSES.map((w) => w.n).sort((a, b) => a - b);
    expect(ns).toContain(15);
    expect(Math.max(...ns)).toBe(LAST_WAREHOUSE);
    expect(LAST_WAREHOUSE).toBe(22);
    expect(ns).not.toContain(50);
    expect(new Set(ns).size).toBe(ns.length);
  });

  it('stand on the bay\'s shore on land, in the world\'s scenery, never on a street or on another thing', () => {
    const mine = (W.scenery ?? []).filter((s) => s.kind === 'warehouse');
    expect(mine.map((s) => s.v).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(WAREHOUSES.map((w) => w.n).sort((a, b) => a - b));
    const taken = new Map<string, string>();
    for (const s of W.scenery ?? []) for (const t of s.tiles) taken.set(`${t.x},${t.y}`, `${taken.get(`${t.x},${t.y}`) ?? ''}|${s.kind}`);
    for (const p of W.places) for (let y = p.y; y < p.y + Math.max(1, p.d); y++) for (let x = p.x; x < p.x + Math.max(1, p.w); x++) taken.set(`${x},${y}`, `${taken.get(`${x},${y}`) ?? ''}|place`);
    for (const p of W.props) for (const t of p.tiles) taken.set(`${t.x},${t.y}`, `${taken.get(`${t.x},${t.y}`) ?? ''}|prop`);
    for (const w of WAREHOUSES) {
      for (let y = w.y; y < w.y + w.d; y++)
        for (let x = w.x; x < w.x + w.w; x++) {
          expect('.:', `${w.n} at ${x},${y} on '${W.rows[y][x]}'`).toContain(W.rows[y][x]);
          expect(taken.get(`${x},${y}`), `${w.n} at ${x},${y}`).toBe('|warehouse');
        }
      // its back to the water: the column past its sand is the bay
      expect(W.rows[w.y][w.x - 2], `${w.n}: water behind`).toBe('~');
      // the quay lane in front is open
      for (let y = w.y; y < w.y + w.d; y++) expect(walkable({ x: QUAY_LANE_X, y }, walk), `lane at ${y}`).toBe(true);
    }
    for (const f of W.furniture ?? []) for (const w of WAREHOUSES) expect(f.x >= w.x && f.x < w.x + w.w && f.y >= w.y && f.y < w.y + w.d, `${f.kind} in ${w.n}`).toBe(false);
  });

  it('fifteen\'s three doors open onto ground a body reaches from the bus', () => {
    for (const [name, t] of Object.entries(W15_DOORS)) {
      expect(walkable(t, walk), name).toBe(true);
      expect(findPath(W.start, t, walk).length, name).toBeGreaterThan(0);
    }
    // the back door is on Quay Street, the front on the lane, the water gate on the sand by the bay
    expect(W.rows[W15_DOORS.back.y][W15_DOORS.back.x]).toBe('=');
    expect(W15_DOORS.front.x).toBe(QUAY_LANE_X);
    expect(W.rows[W15_DOORS.water.y][W15_DOORS.water.x]).toBe(':');
    expect(findPath(W.start, ROW_FAR_END, walk).length).toBeGreaterThan(0);
  });

  it('their walls block, the size of the drawn walls', () => {
    const cs = walk.walk!.colliders.filter((c) => c.what.includes(':warehouse'));
    expect(cs).toHaveLength(WAREHOUSES.length);
    const c = cs.find((q) => q.kind === 'box' && q.x0 > W15.x && q.x0 < W15.x + 0.5 && q.y0 > W15.y && q.y0 < W15.y + 0.5);
    expect(c).toBeDefined();
  });
});

describe('a boat on the bay: from the jetty to fifteen\'s water gate', () => {
  const route = boatRoute(W, JETTY_END, W15_MOORING)!;

  it('finds a way', () => {
    expect(route).not.toBeNull();
    expect(route[0]).toEqual(JETTY_END);
    expect(route[route.length - 1]).toEqual(W15_MOORING);
    expect(routeLength(route)).toBeGreaterThan(8);
  });

  it('never crosses land: every point of the way is on a water tile, inside the drawn waterline', () => {
    const L = routeLength(route);
    for (let d = 0; d <= L; d += 0.05) {
      const p = alongRoute(route, d);
      expect(W.rows[Math.floor(p.y)][Math.floor(p.x)], `${p.x.toFixed(2)},${p.y.toFixed(2)}`).toBe('~');
      expect(shoreDistance(W, p.x, p.y), `${p.x.toFixed(2)},${p.y.toFixed(2)} in the water`).toBeLessThan(0);
    }
  });

  it('keeps clear of the boats moored on the bay', () => {
    const moored = (W.scenery ?? []).filter((s) => s.kind === 'boat' && s.at).map((s) => s.at!);
    const L = routeLength(route);
    for (let d = 0; d <= L; d += 0.1) {
      const p = alongRoute(route, d);
      for (const b of moored) expect(Math.hypot(p.x - b.x, p.y - b.y), `near the boat at ${b.x},${b.y}`).toBeGreaterThan(0.9);
    }
  });

  it('a point along it: from the start to the end, done at the end, heading along each leg', () => {
    const L = routeLength(route);
    expect(alongRoute(route, 0)).toMatchObject({ x: JETTY_END.x, y: JETTY_END.y, done: false });
    const end = alongRoute(route, L + 1);
    expect(end.done).toBe(true);
    expect(end.x).toBeCloseTo(W15_MOORING.x);
    expect(end.y).toBeCloseTo(W15_MOORING.y);
  });

  it('is pure: the same way every time; and none over land from a land start', () => {
    expect(boatRoute(W, JETTY_END, W15_MOORING)).toEqual(route);
    expect(boatRoute({ size: 3, rows: ['...', '...', '...'] }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
});
