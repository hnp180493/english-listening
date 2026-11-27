import { describe, expect, it } from 'vitest';
import { walkable } from '../../../core/town/map';
import { TOWN_WORLD, WORLD_ACTIVITIES, WORLD_PLACES, type PlaceId } from '../../../data/townWorld';
import { ACTIVITIES, hasSpot, SPOT_ACTIVITIES } from '../activities/types';
import { setShiftForTests, sleepFor, sleepShift } from '../../../core/town/gameClock';
import { townDay } from '../../../core/town/progress';
import { gameMinutes } from '../../../core/town/sky';
import { weekdayOf } from '../../../core/town/world';
import { activitySeconds, dayPart, DAY_WEIGHTS, folkCount, kidsOut, lifeMinutes, pickActivity, type Activity } from './life';
import { TownSim, type Resident } from './sim';

/** A small seeded random (mulberry32): the same town every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FREE: PlaceId[] = ['square', 'cafe', 'friend'];

function lifeSim(minutes: number, seed = 5, built: PlaceId[] = FREE): TownSim {
  let clock = minutes;
  const sim = new TownSim(TOWN_WORLD, seeded(seed), undefined, { life: true, clock: () => clock });
  sim.setState({ built, decorations: [] });
  (sim as unknown as { setClock: (m: number) => void }).setClock = (m: number) => (clock = m);
  return sim;
}

function run(sim: TownSim, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 1 / 30) {
    sim.update(1 / 30);
    each?.();
  }
}

describe('the day', () => {
  it('parts of the day by the local clock', () => {
    expect(dayPart(0)).toBe('night');
    expect(dayPart(5 * 60 + 59)).toBe('night');
    expect(dayPart(6 * 60)).toBe('morning');
    expect(dayPart(10 * 60)).toBe('work');
    expect(dayPart(12 * 60 + 30)).toBe('noon');
    expect(dayPart(15 * 60)).toBe('afternoon');
    expect(dayPart(19 * 60)).toBe('evening');
    expect(dayPart(22 * 60)).toBe('late');
    expect(dayPart(24 * 60 + 30)).toBe('night');
    expect(dayPart(-30)).toBe('late');
  });

  it('most people are indoors at night; nobody jogs then; the passers-by go home', () => {
    expect(DAY_WEIGHTS.night.inside).toBeGreaterThan(5 * ((DAY_WEIGHTS.night.sit ?? 0) + (DAY_WEIGHTS.night.home ?? 0)));
    expect(DAY_WEIGHTS.night.jog).toBeUndefined();
    expect(folkCount('night')).toBe(0);
    expect(folkCount('noon')).toBeGreaterThan(folkCount('late'));
    expect(kidsOut('night') || kidsOut('late') || kidsOut('morning')).toBe(false);
    expect(kidsOut('afternoon')).toBe(true);
  });

  it('a pick is never something ruled out, and follows the weights', () => {
    const rng = seeded(1);
    const not = new Set<Activity>(['inside', 'sit']);
    const seen = new Map<Activity, number>();
    for (let i = 0; i < 4000; i++) {
      const a = pickActivity('night', rng, { index: i % 13, not });
      expect(not.has(a)).toBe(false);
      seen.set(a, (seen.get(a) ?? 0) + 1);
    }
    // at night with inside and sit ruled out, only standing about by the door is left
    expect([...seen.keys()]).toEqual(['home']);
    const day = new Map<Activity, number>();
    for (let i = 0; i < 4000; i++) {
      const a = pickActivity('evening', rng, { index: 0 });
      day.set(a, (day.get(a) ?? 0) + 1);
    }
    expect((day.get('chat') ?? 0) > (day.get('read') ?? 0)).toBe(true);
    for (const a of ['sit', 'chat', 'fish', 'stroll'] as const) expect(activitySeconds(a, () => 0.5)).toBeGreaterThan(2);
  });
});

describe('the world has room for life', () => {
  it('every activity of the game has its spot, walkable and reachable, at its own thing', () => {
    // the gift shop and the Sổ tay have no spot (activities/types SPOT_ACTIVITIES)
    // (the things to use, 'thing:…', are spots too, with a box of their own instead of a prop: core/town/world.test.ts)
    const own = Object.entries(WORLD_ACTIVITIES).filter(([id]) => !id.startsWith('thing:'));
    expect(own.map(([id]) => id).sort()).toEqual([...SPOT_ACTIVITIES].sort());
    expect(ACTIVITIES.filter((a) => hasSpot(a.id)).map((a) => a.id).sort()).toEqual([...SPOT_ACTIVITIES].sort());
    for (const [id, spot] of Object.entries(WORLD_ACTIVITIES)) {
      expect(walkable(spot.stand), id).toBe(true);
      if (id.startsWith('thing:')) expect(spot.box, id).toBeDefined();
      else expect(TOWN_WORLD.props.some((p) => p.kind === spot.prop), id).toBe(true);
      expect(Math.hypot(spot.look.x - spot.stand.x - 0.5, spot.look.y - spot.stand.y - 0.5), id).toBeLessThan(1.6);
    }
  });

  it('seats, chat spots and places to stand are walkable, and chats stand side by side on the screen', () => {
    const L = TOWN_WORLD.life!;
    for (const s of L.seats) {
      expect(walkable(s.from), JSON.stringify(s)).toBe(true);
      expect(Math.hypot(s.x - s.from.x - 0.5, s.y - s.from.y - 0.5)).toBeLessThan(1.6);
    }
    for (const [a, b] of L.chats) {
      expect(walkable(a) && walkable(b), JSON.stringify([a, b])).toBe(true);
      expect(Math.abs(a.x - b.x) === 1 && a.x - b.x === -(a.y - b.y)).toBe(true);
    }
    for (const t of [...L.tend, ...L.fish, ...L.read, ...L.shop].map((s) => s.at)) expect(walkable(t), JSON.stringify(t)).toBe(true);
    for (const t of [...L.jog, ...L.ends, ...L.via, ...L.inn.yard, L.inn.door]) expect(walkable(t), JSON.stringify(t)).toBe(true);
  });
});

describe('a living town', () => {
  it('everybody lives in town from the first day: lodgers at the boarding house until their place is built', () => {
    const sim = lifeSim(12 * 60);
    expect(sim.residents.size).toBe(WORLD_PLACES.length);
    const lodgers = [...sim.residents.values()].filter((r) => r.lodger);
    expect(lodgers.map((r) => r.place.id).sort()).toEqual(WORLD_PLACES.map((p) => p.id).filter((id) => !FREE.includes(id)).sort());
    // the town is busy at once: nobody planned nothing, passers-by about
    expect([...sim.residents.values()].every((r) => r.doing !== null)).toBe(true);
    expect(sim.folk.filter((f) => !f.hidden).length).toBeGreaterThan(2);
  });

  it('over a while: nobody on a blocked tile, nobody on top of anybody, one person per seat; chats talk', () => {
    const sim = lifeSim(13 * 60, 9);
    let says = 0;
    let seated = 0;
    run(sim, 90, () => {
      says += sim.events.filter((e) => e.kind === 'say').length;
      sim.events.length = 0;
      const people = [...sim.residents.values()].filter((r) => !r.hidden);
      const seats = new Set<string>();
      for (const r of people) {
        if (r.seat) {
          seated++;
          const k = `${r.seat.x},${r.seat.y}`;
          expect(seats.has(k), r.id).toBe(false);
          seats.add(k);
        } else if (!TOWN_WORLD.life!.seats.some((q) => Math.hypot(q.x - r.x, q.y - r.y) < 0.75)) {
          // (stepping onto or off a bench crosses its own tile)
          expect(walkable(r.tile), `${r.id} ${r.tile.x},${r.tile.y}`).toBe(true);
        }
      }
      const standing = [...people, ...sim.folk.filter((f) => !f.hidden), sim.player].filter((a) => !a.moving && !(a as Resident).seat);
      for (let i = 0; i < standing.length; i++) {
        for (let j = i + 1; j < standing.length; j++) {
          expect(Math.hypot(standing[i].x - standing[j].x, standing[i].y - standing[j].y), `${standing[i].id} ${standing[j].id}`).toBeGreaterThan(0.3);
        }
      }
    });
    expect(says).toBeGreaterThan(0);
    expect(seated).toBeGreaterThan(0);
  });

  it('late at night most are indoors, but never the one the main button sends the player to', () => {
    const sim = lifeSim(2 * 60, 3);
    sim.setHint('cafe');
    run(sim, 30);
    const rs = [...sim.residents.values()];
    expect(rs.filter((r) => r.hidden).length).toBeGreaterThanOrEqual(8);
    expect(sim.residents.get('cafe')!.hidden).toBe(false);
    expect(sim.folk.every((f) => f.hidden)).toBe(true);
    // somebody indoors comes out when walked up to
    const inside = rs.find((r) => r.hidden)!;
    expect(sim.walkToResident(inside.place.id)).toBe(true);
    expect(inside.hidden).toBe(false);
  });

  it('a house built: its lodger moves in and makes it their home', () => {
    const sim = lifeSim(10 * 60, 4);
    const grace = sim.residents.get('home')!;
    expect(grace.lodger).toBe(true);
    sim.setState({ built: [...FREE, 'home'], decorations: [] });
    sim.moveIn('home');
    expect(grace.lodger).toBe(false);
    expect(grace.home).toEqual(grace.place.spot);
    // (before her stand at home is over: she may go off to do something else after it)
    run(sim, 8);
    expect(Math.abs(grace.tile.x - grace.place.spot.x) + Math.abs(grace.tile.y - grace.place.spot.y)).toBeLessThanOrEqual(4);
  });

  it('the player walks to an activity spot and looks at it', () => {
    const sim = lifeSim(10 * 60, 6);
    let arrived = 0;
    expect(sim.walkToActivity('fish', () => arrived++)).toBe(true);
    run(sim, 20);
    expect(arrived).toBe(1);
    expect(sim.player.tile).toEqual(WORLD_ACTIVITIES.fish.stand);
  });

  it('without life the town is as before: only the built places have residents', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(2));
    sim.setState({ built: FREE, decorations: [] });
    expect(sim.residents.size).toBe(3);
    expect(sim.folk).toHaveLength(0);
  });
});

describe("life by the game's clock (a game day is 48 real minutes: 30 times the real pace)", () => {
  it("lifeMinutes is the hour the sky shows; a sleep moves it, never the learner's real day or weekday", () => {
    const t = Date.UTC(2026, 10, 27, 9, 13, 7);
    expect(lifeMinutes(t)).toBe(gameMinutes(t));
    const day = townDay(t);
    const weekday = weekdayOf(t);
    const before = lifeMinutes(t);
    try {
      setShiftForTests(sleepShift(t, sleepFor(before / 60), null));
      expect(lifeMinutes(t)).not.toBeCloseTo(before, 0);
      // the daily allowances, the weekly get-togethers and who comes up to Westbay read these: unchanged
      expect(townDay(t)).toBe(day);
      expect(weekdayOf(t)).toBe(weekday);
    } finally {
      setShiftForTests(null);
    }
  });

  it('from the evening through the night to the morning: in at night, out by day, nobody jumps, the suggested one stays out', () => {
    // the game's clock runs a game minute every 2 real seconds of the sim
    let clock = 19 * 60;
    const sim = new TownSim(TOWN_WORLD, seeded(11), undefined, { life: true, clock: () => clock });
    sim.setState({ built: FREE, decorations: [] });
    sim.setHint('cafe');
    const dt = 1 / 15;
    const last = new Map<string, { x: number; y: number; hidden: boolean; seat: boolean }>();
    let worst = 0;
    const inAt: Record<string, number> = {};
    for (let t = 0; t < 13 * 60 * 2; t += dt) {
      clock = 19 * 60 + t / 2;
      sim.update(dt);
      for (const r of sim.residents.values()) {
        const was = last.get(r.id);
        // a step a frame, never a leap (coming out of a door shows them AT the door, and sitting down or getting up
        // puts them on or off the seat as it always did, whatever the clock: those are not steps)
        if (was && !was.hidden && !r.hidden && was.seat === !!r.seat) worst = Math.max(worst, Math.hypot(r.x - was.x, r.y - was.y));
        last.set(r.id, { x: r.x, y: r.y, hidden: r.hidden, seat: !!r.seat });
        if (r.place.id === 'cafe') expect(r.hidden, `${Math.floor(clock / 60)}:00`).toBe(false);
      }
      const h = Math.round(clock);
      if (h === 26 * 60 || h === 31 * 60 + 30) inAt[String(h)] ??= [...sim.residents.values()].filter((r) => r.hidden).length;
    }
    expect(worst).toBeLessThan(0.5);
    // at two in the night most are in; at half past seven in the morning most are out again
    expect(inAt[String(26 * 60)]).toBeGreaterThanOrEqual(8);
    expect(inAt[String(31 * 60 + 30)]).toBeLessThanOrEqual(4);
  }, 120_000);
});

describe('the suggested resident when the town opens', () => {
  it('is found by their own door, not across the island; later suggestions do not move anybody', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sim = lifeSim(10 * 60 + 30, seed);
      sim.setHint('square');
      const leo = sim.residents.get('square')!;
      const p = sim.player;
      const near = Math.hypot(leo.x - p.x, leo.y - p.y) <= 7 || Math.hypot(leo.x - leo.home.x - 0.5, leo.y - leo.home.y - 0.5) < 1e-6;
      expect(near, `seed ${seed}`).toBe(true);
      run(sim, 2);
      const emma = sim.residents.get('cafe')!;
      const was = { x: emma.x, y: emma.y };
      sim.setHint('cafe');
      expect({ x: emma.x, y: emma.y }).toEqual(was);
    }
  });
});

describe('a conversation that begins from afar (a link straight to it)', () => {
  it('brings the resident beside the player', () => {
    for (const seed of [1, 2, 3]) {
      const sim = lifeSim(15 * 60, seed);
      run(sim, 3);
      const emma = sim.residents.get('cafe')!;
      sim.engage('cafe');
      sim.bringOver('cafe');
      const d = Math.hypot(emma.x - sim.player.x, emma.y - sim.player.y);
      expect(d, `seed ${seed}`).toBeLessThanOrEqual(2.9);
      expect(d).toBeGreaterThan(0.9);
      expect(emma.path).toEqual([]);
    }
  });
});
