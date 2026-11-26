import { describe, expect, it } from 'vitest';
import { CITY_WORLD, cityPlace } from '../cityWorld';
import { HIDEOUT_AT, HIDEOUT_DOOR, HIDEOUT_HALF, HIDEOUT_HOME, HIDEOUT_LET, HIDEOUT_LOT, HIDEOUT_THING } from './hideout';
import { findPath, walkable } from '../../core/town/map';
import { walkWorld } from '../../core/town/colliders';
import { projectColliders } from '../../features/town/engine/sim';
import { CITY_EXTRA_DECOR, EXTRA_DECOR, extraDecorSpots } from '../../features/town/engine/extraDecor';

const W = CITY_WORLD;
const lotTiles = () => {
  const out: { x: number; y: number }[] = [];
  for (let y = HIDEOUT_LOT.y; y < HIDEOUT_LOT.y + HIDEOUT_LOT.d; y++) for (let x = HIDEOUT_LOT.x; x < HIDEOUT_LOT.x + HIDEOUT_LOT.w; x++) out.push({ x, y });
  return out;
};

describe('the hideout on Westbay\'s map (behind Gus\'s hut on Pier Road)', () => {
  it('the thing to click is the building, its stand the tile in front of the door (stretched map = data)', () => {
    const spot = W.activities?.[HIDEOUT_THING];
    expect(spot).toBeDefined();
    expect(spot!.stand).toEqual(HIDEOUT_DOOR);
    expect(spot!.box!.x).toBeCloseTo(HIDEOUT_AT.x);
    expect(spot!.box!.y).toBeCloseTo(HIDEOUT_AT.y);
    expect(extraDecorSpots(HIDEOUT_LET)).toEqual([{ at: HIDEOUT_AT }]);
    expect(extraDecorSpots(HIDEOUT_HOME)).toEqual([{ at: HIDEOUT_AT }]);
    // Westbay's own pieces are not the town's projects
    expect(Object.keys(EXTRA_DECOR).some((k) => Object.hasOwn(CITY_EXTRA_DECOR, k))).toBe(false);
  });

  it('stands on bare ground nobody uses: no house, block, prop, seat, furniture or life spot on its lot', () => {
    const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;
    const lot = new Set(lotTiles().map(key));
    for (const t of lotTiles()) expect(W.rows[t.y][t.x], key(t)).toBe('.');
    for (const p of [...W.places]) {
      for (let y = p.y; y < p.y + Math.max(1, p.d); y++) for (let x = p.x; x < p.x + Math.max(1, p.w); x++) expect(lot.has(`${x},${y}`), `${p.id}`).toBe(false);
      expect(lot.has(key(p.door)) || lot.has(key(p.spot)), `${p.id} door/spot`).toBe(false);
    }
    for (const s of W.scenery ?? []) for (const t of s.tiles) expect(lot.has(key(t)), s.kind).toBe(false);
    for (const p of W.props) for (const t of p.tiles) expect(lot.has(key(t)), p.kind).toBe(false);
    for (const f of W.furniture ?? []) expect(lot.has(`${Math.floor(f.x)},${Math.floor(f.y)}`), f.kind).toBe(false);
    for (const list of Object.values(W.decorations)) for (const d of list) expect(lot.has(`${Math.floor(d.x)},${Math.floor(d.y)}`)).toBe(false);
    const L = W.life!;
    for (const s of L.seats) expect(lot.has(key(s.from))).toBe(false);
    for (const s of [...L.tend, ...L.fish, ...L.read, ...L.shop]) expect(lot.has(key(s.at))).toBe(false);
    for (const c of L.chats) for (const t of c) expect(lot.has(key(t))).toBe(false);
  });

  it('is beside Gus\'s hut, the old gatehouse where Rico\'s office is', () => {
    const gus = cityPlace('gus')!;
    expect(Math.hypot(gus.door.x - HIDEOUT_DOOR.x, gus.door.y - HIDEOUT_DOOR.y)).toBeLessThan(3);
  });

  for (const [name, decor] of [['to let', HIDEOUT_LET], ['lived in', HIDEOUT_HOME]] as const) {
    it(`${name}: its walls block, its door is reached from the bus and Gus's door is still reached`, () => {
      const world = walkWorld(W, { built: [...W.places.map((p) => p.id as string), 'station'], decorations: [], extraDecor: [decor] }, projectColliders([decor]));
      const cs = world.walk!.colliders.filter((c) => c.what.startsWith(`proj:${decor}`));
      expect(cs).toHaveLength(1);
      const c = cs[0];
      expect(c.kind).toBe('box');
      if (c.kind === 'box') {
        expect(c.x0).toBeCloseTo(HIDEOUT_AT.x - HIDEOUT_HALF.x);
        expect(c.y1).toBeCloseTo(HIDEOUT_AT.y + HIDEOUT_HALF.y1);
        // the door's tile stays open
        expect(c.y1).toBeLessThan(HIDEOUT_DOOR.y);
      }
      expect(walkable(HIDEOUT_DOOR, world)).toBe(true);
      expect(findPath(W.start, HIDEOUT_DOOR, world).length).toBeGreaterThan(0);
      const gus = cityPlace('gus')!;
      expect(findPath(HIDEOUT_DOOR, gus.spot, world).length).toBeGreaterThan(0);
    });
  }
});
