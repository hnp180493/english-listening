import { describe, expect, it } from 'vitest';
import { EXTRA_DECOR } from '../features/town/engine/extraDecor';
import { CITY_WORLD } from './cityWorld';
import { benchLookAt, DISTRICT_LOOKS, districtAt, lampLookAt, type FurnitureKind } from './townFurniture';
import { TOWN_WORLD, type Tile, type TownWorld } from './townWorld';

// Street furniture where it makes sense (docs/town.md §26): never on a street or in the water, never on a tile something
// else stands on, never on a spot people use (a door, where a resident stands, a seat's approach, a chat, a walk's
// points), never in front of a door, a tile clear of every parked vehicle. The walking tests (colliders.test.ts,
// engine/noStuck.test.ts, noWedge.test.ts) prove nobody is shut in by it.

const key = (t: Tile) => `${Math.floor(t.x)},${Math.floor(t.y)}`;

function check(name: string, world: TownWorld, extra: readonly Tile[]) {
  describe(`${name}'s street furniture`, () => {
    const items = world.furniture ?? [];

    it('stands on grass, sand or a square, never on a street or in the water', () => {
      for (const f of items) {
        const ch = world.rows[Math.floor(f.y)]?.[Math.floor(f.x)];
        expect(['.', ':', 'o'], `${f.kind} at ${key(f)} on '${ch}'`).toContain(ch);
        // a thing on a square stands by a stall, at the square's edge: crates and bins only
        if (ch === 'o') expect(['crates', 'bins'], `${f.kind} at ${key(f)} on a square`).toContain(f.kind);
      }
    });

    it('stands on a tile of its own, clear of what stands there already', () => {
      const taken = new Map<string, string>();
      const take = (t: Tile, what: string) => taken.set(key(t), what);
      for (const p of world.places) for (let y = p.y; y < p.y + p.d; y++) for (let x = p.x; x < p.x + p.w; x++) take({ x, y }, `place ${p.id}`);
      world.props.forEach((p, i) => p.tiles.forEach((t) => take(t, `prop ${i} ${p.kind}`)));
      (world.scenery ?? []).forEach((s, i) => {
        s.tiles.forEach((t) => take(t, `scenery ${i} ${s.kind}`));
        if (s.at) take(s.at, `scenery ${i} ${s.kind}`);
      });
      for (const [id, spots] of Object.entries(world.decorations)) spots.forEach((s, i) => take(s, `decor ${id} ${i}`));
      for (const t of extra) take(t, 'a town project');
      world.rows.forEach((r, y) => [...r].forEach((ch, x) => /[TtpF]/.test(ch) && take({ x, y }, `a tree '${ch}'`)));
      const mine = new Set<string>();
      for (const f of items) {
        expect(taken.get(key(f)), `${f.kind} at ${key(f)}`).toBeUndefined();
        expect(mine.has(key(f)), `two things at ${key(f)}`).toBe(false);
        mine.add(key(f));
      }
    });

    it('keeps clear of doors, the spots people use and the vehicles', () => {
      const busy: { t: Tile; what: string }[] = [];
      for (const p of [...world.places, ...(world.guests ?? [])]) {
        busy.push({ t: p.door, what: `door ${p.id}` }, { t: p.spot, what: `spot ${p.id}` });
        // the tile in front of the door
        busy.push({ t: p.face === 'x' ? { x: p.door.x + 1, y: p.door.y } : { x: p.door.x, y: p.door.y + 1 }, what: `in front of ${p.id}` });
      }
      for (const [id, a] of Object.entries(world.activities ?? {})) busy.push({ t: a.stand, what: id });
      const L = world.life;
      if (L) {
        for (const s of L.seats) busy.push({ t: s.from, what: 'a seat' });
        for (const c of L.chats) for (const t of c) busy.push({ t, what: 'a chat' });
        for (const s of [...L.tend, ...L.fish, ...L.read, ...L.shop]) busy.push({ t: s.at, what: 'a life spot' });
        for (const t of [...L.jog, ...L.ends, ...L.via, ...L.inn.yard, L.inn.door]) busy.push({ t, what: 'a walk point' });
      }
      for (const d of world.districts ?? []) busy.push({ t: d.arrive, what: `arrive ${d.id}` });
      busy.push({ t: world.start, what: 'the start' });
      for (const f of items) {
        for (const b of busy) expect(key(b.t) === key(f), `${f.kind} at ${key(f)} on ${b.what}`).toBe(false);
        for (const v of world.vehicles ?? []) expect(Math.max(Math.abs(v.at.x - Math.floor(f.x)), Math.abs(v.at.y - Math.floor(f.y))), `${f.kind} at ${key(f)} by the ${v.kind}`).toBeGreaterThan(1);
      }
    });

    it('a few dozen, of every kind', () => {
      expect(items.length).toBeGreaterThanOrEqual(30);
      const kinds = new Set<FurnitureKind>(items.map((f) => f.kind));
      for (const k of ['bins', 'bike-rack', 'postbox', 'crates', 'hydrant', 'news-box', 'bench-picnic', 'pots'] as const) {
        if (k === 'hydrant' && name === 'the town') continue;
        expect(kinds.has(k), k).toBe(true);
      }
    });
  });
}

check('the town', TOWN_WORLD, Object.values(EXTRA_DECOR).flatMap((list) => list.map((s) => s.at)));
check('Westbay', CITY_WORLD, []);

describe('each district its own bench and lamp', () => {
  it('every district has a look, and the looks are not one copied everywhere', () => {
    for (const w of [TOWN_WORLD, CITY_WORLD]) {
      for (const d of w.districts ?? []) expect(DISTRICT_LOOKS[d.id], d.id).toBeDefined();
      const benches = new Set(w.props.filter((p) => p.kind === 'bench').map((p) => benchLookAt(w, p.tiles[0])));
      const lamps = new Set([...(w.decorations.lamps1 ?? []), ...(w.decorations.lamps2 ?? [])].map((s) => lampLookAt(w, s)));
      expect(benches.size).toBeGreaterThanOrEqual(3);
      expect(lamps.size).toBe(3);
    }
  });

  it('a place is told by its furniture: the old market under lanterns, the offices under two globes, stone on the plaza', () => {
    expect(districtAt(CITY_WORLD, 40, 20)?.id).toBe('w-market');
    expect(lampLookAt(CITY_WORLD, { x: 34, y: 14 })).toBe('lamp-lantern');
    expect(lampLookAt(CITY_WORLD, { x: 72, y: 14 })).toBe('lamp-globes');
    expect(benchLookAt(TOWN_WORLD, { x: 33, y: 34 })).toBe('bench-stone');
    // the orchard's bench, under the edge of the market's box, is the orchard's
    expect(districtAt(TOWN_WORLD, 52.5, 25.5)?.id).toBe('orchard');
    // the plaza's lamps round its rim are all the plaza's, one just outside its box too
    for (const s of TOWN_WORLD.decorations.lamps1) expect(lampLookAt(TOWN_WORLD, s), `${s.x},${s.y}`).toBe('lamp-globes');
  });
});
