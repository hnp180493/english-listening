// Stretch a map: put more land in between its blocks without moving anything apart that stands together. A cut
// `{ at, by }` on an axis inserts `by` copies of row / column `at` just before it (trees on the copies left out), and
// everything at or past `at` moves on by `by`. Houses keep their size, a street crossing the cut runs on through it,
// a square or the bay grows, a block of flats (scenery 'block') standing across a cut grows with it.
// Used for Westbay (data/cityWorld.ts; owner, 2026-11-26: "thành phố quái gì mà bé như lỗ mũi vậy? mật độ dân số
// quá đông không hợp lí"). A cut through a place, its door and spot, a prop of more than one tile or a chat's pair
// throws: they would come apart.

import type { ActivitySpot, DecorSpot, Seat, Tile, TownWorld, WorldDistrict, WorldLife, WorldPlace, WorldProp, WorldScenery } from './townWorld';

export interface Cut {
  /** The row (y) or column (x) the copies go in before. */
  at: number;
  /** How many copies. */
  by: number;
}

/** Where a coordinate lands: moved on by every cut at or before its tile (a point between tiles goes with its tile). */
export function axisMap(cuts: readonly Cut[]): (v: number) => number {
  const sorted = [...cuts].sort((a, b) => a.at - b.at);
  return (v: number) => {
    const t = Math.floor(v);
    let add = 0;
    for (const c of sorted) if (t >= c.at) add += c.by;
    return v + add;
  };
}

/** The extra size the cuts make. */
export const cutsSize = (cuts: readonly Cut[]): number => cuts.reduce((n, c) => n + c.by, 0);

/** The copies of a cut row or column: no trees, palms or fountain (only the ground they stand on). */
const bare = (ch: string): string => (ch === 'T' || ch === 't' ? '.' : ch === 'p' ? ':' : ch === 'F' ? 'o' : ch);

export function stretchRows(rows: readonly string[], cx: readonly Cut[], cy: readonly Cut[]): string[] {
  const byX = new Map(cx.map((c) => [c.at, c.by]));
  const byY = new Map(cy.map((c) => [c.at, c.by]));
  const widen = (row: string): string => {
    let out = '';
    for (let x = 0; x < row.length; x++) {
      const n = byX.get(x) ?? 0;
      if (n) out += bare(row[x]).repeat(n);
      out += row[x];
    }
    return out;
  };
  const out: string[] = [];
  rows.forEach((row, y) => {
    const n = byY.get(y) ?? 0;
    const w = widen(row);
    for (let i = 0; i < n; i++) out.push([...w].map(bare).join(''));
    out.push(w);
  });
  return out;
}

/** Throws when a cut falls inside [lo, hi] (both included): what spans it would come apart. */
function keepWhole(cuts: readonly Cut[], lo: number, hi: number, what: string): void {
  for (const c of cuts) if (c.at > lo && c.at <= hi) throw new Error(`stretchWorld: the cut at ${c.at} goes through ${what}`);
}

export function stretchWorld(w: TownWorld, cx: readonly Cut[], cy: readonly Cut[]): TownWorld {
  const mx = axisMap(cx);
  const my = axisMap(cy);
  const pt = <P extends { x: number; y: number }>(p: P): P => ({ ...p, x: mx(p.x), y: my(p.y) });
  const tiles = (ts: readonly Tile[]): Tile[] => ts.map(pt);
  const span = (ts: readonly Tile[], what: string): void => {
    if (ts.length < 2) return;
    keepWhole(cx, Math.min(...ts.map((t) => t.x)), Math.max(...ts.map((t) => t.x)), what);
    keepWhole(cy, Math.min(...ts.map((t) => t.y)), Math.max(...ts.map((t) => t.y)), what);
  };

  const place = (p: WorldPlace): WorldPlace => {
    // the house, its door and the spot by it stay together
    const xs = [p.x, p.x + Math.max(1, p.w) - 1, p.door.x, p.spot.x];
    const ys = [p.y, p.y + Math.max(1, p.d) - 1, p.door.y, p.spot.y];
    if (p.w > 0) {
      keepWhole(cx, Math.min(...xs), Math.max(...xs), `place ${p.id}`);
      keepWhole(cy, Math.min(...ys), Math.max(...ys), `place ${p.id}`);
    }
    return { ...p, x: mx(p.x), y: my(p.y), door: pt(p.door), spot: pt(p.spot) };
  };

  const prop = (p: WorldProp): WorldProp => {
    span(p.tiles, `prop ${p.kind}`);
    return { ...p, tiles: tiles(p.tiles), ...(p.at ? { at: pt(p.at) } : {}) };
  };

  const scenery = (s: WorldScenery): WorldScenery => {
    if (s.kind === 'block' && s.tiles.length > 0) {
      // a block of flats across a cut grows over it
      const x0 = mx(Math.min(...s.tiles.map((t) => t.x)));
      const x1 = mx(Math.max(...s.tiles.map((t) => t.x)));
      const y0 = my(Math.min(...s.tiles.map((t) => t.y)));
      const y1 = my(Math.max(...s.tiles.map((t) => t.y)));
      const out: Tile[] = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
      return { ...s, tiles: out };
    }
    span(s.tiles, `scenery ${s.kind}`);
    return { ...s, tiles: tiles(s.tiles), ...(s.at ? { at: pt(s.at) } : {}) };
  };

  const decorations = Object.fromEntries(Object.entries(w.decorations).map(([k, list]) => [k, list.map((d: DecorSpot) => pt(d))])) as unknown as TownWorld['decorations'];

  const activities = w.activities
    ? (Object.fromEntries(
        Object.entries(w.activities).map(([k, a]: [string, ActivitySpot]) => [k, { ...a, stand: pt(a.stand), look: pt(a.look), ...(a.box ? { box: pt(a.box) } : {}) }]),
      ) as TownWorld['activities'])
    : undefined;

  const life = (L: WorldLife): WorldLife => ({
    ...L,
    seats: L.seats.map((s: Seat) => ({ ...pt(s), from: pt(s.from) })),
    chats: L.chats.map((c) => {
      span([c[0], c[1]], 'a chat');
      return [pt(c[0]), pt(c[1])] as const;
    }),
    tend: L.tend.map((s) => ({ ...s, at: pt(s.at) })),
    fish: L.fish.map((s) => ({ ...s, at: pt(s.at) })),
    read: L.read.map((s) => ({ ...s, at: pt(s.at) })),
    shop: L.shop.map((s) => ({ ...s, at: pt(s.at) })),
    jog: tiles(L.jog),
    ends: tiles(L.ends),
    via: tiles(L.via),
    inn: { door: pt(L.inn.door), yard: tiles(L.inn.yard) },
  });

  const district = (d: WorldDistrict): WorldDistrict => {
    const x0 = mx(d.x);
    const y0 = my(d.y);
    return { ...d, x: x0, y: y0, w: mx(d.x + d.w - 1) + 1 - x0, d: my(d.y + d.d - 1) + 1 - y0, arrive: pt(d.arrive) };
  };

  const size = w.size + Math.max(cutsSize(cx), cutsSize(cy));
  const rows = stretchRows(w.rows, cx, cy);
  if (rows.length !== size || rows.some((r) => r.length !== size)) throw new Error(`stretchWorld: the cuts make ${rows[0]?.length} × ${rows.length}, not a square of ${size}`);

  return {
    ...w,
    size,
    rows,
    places: w.places.map(place),
    ...(w.guests ? { guests: w.guests.map(place) } : {}),
    props: w.props.map(prop),
    decorations,
    ...(activities ? { activities } : {}),
    ...(w.life ? { life: life(w.life) } : {}),
    ...(w.scenery ? { scenery: w.scenery.map(scenery) } : {}),
    ...(w.districts ? { districts: w.districts.map(district) } : {}),
    ...(w.range ? { range: { ...w.range, north: w.range.north.map(mx), west: w.range.west.map(my) } } : {}),
    ...(w.vehicles ? { vehicles: w.vehicles.map((v) => ({ ...v, at: pt(v.at) })) } : {}),
    plaza: { ...w.plaza, x: mx(w.plaza.x), y: my(w.plaza.y) },
    start: pt(w.start),
  };
}
