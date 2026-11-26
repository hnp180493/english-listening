// Westbay's streets (./streets.ts) and traffic (./traffic.ts): the names on the map's own paving, the junctions and
// their lights, a red light run, cars keeping their lane and their distance, stopping on red, and never driving into a
// body (so a moving car cannot trap the player).
import { describe, expect, it } from 'vitest';
import { CITY_ROWS } from '../../data/cityWorld';
import { compassOf, exitsOf, junctionAt, laneOf, LIGHT_CYCLE, lightAt, lightFor, ranRed, streetAt, westbayNet, type Junction } from './streets';
import { BODY_GAP, blockersFor, carCircles, CAR_LEN, clearAhead, seedTraffic, stepTraffic, TRAFFIC_SPEED, type TrafficCar } from './traffic';

const net = westbayNet();
const paved = (x: number, y: number) => ['=', 'o'].includes(CITY_ROWS[y]?.[x] ?? '');

describe('streets: the network', () => {
  it('every street is a two-tile band of paving on the map (a lane for people may cross the fountain), named, its id once', () => {
    expect(new Set(net.streets.map((s) => s.id)).size).toBe(net.streets.length);
    for (const s of net.streets) {
      expect(s.name.length, s.id).toBeGreaterThan(2);
      for (let t = s.from; t <= s.to; t++)
        for (const k of [0, 1]) {
          const [x, y] = s.axis === 'x' ? [t, s.at + k] : [s.at + k, t];
          expect(paved(x, y) || (!s.cars && CITY_ROWS[y][x] === 'F'), `${s.id} at ${x},${y}: ${CITY_ROWS[y]?.[x]}`).toBe(true);
        }
    }
  });

  it('the main crossings have lights; a T or a corner does not', () => {
    const lit = net.junctions.filter((j) => j.lights).map((j) => j.id);
    expect(lit).toContain('market-street*bay-road');
    expect(lit).toContain('station-avenue*station-road');
    expect(lit).toContain('arts-street*college-road');
    expect(lit).not.toContain('market-street*station-road');
    expect(lit).not.toContain('pier-road*bay-road');
    expect(lit.length).toBeGreaterThanOrEqual(8);
    expect(lit.length).toBeLessThanOrEqual(12);
  });

  it('a point says its street by the heading, and the compass reads the map north up', () => {
    const j = net.junctions.find((x) => x.id === 'market-street*bay-road')!;
    expect(streetAt(net, j.x + 1, j.y + 1, 'north')?.name).toBe('Bay Road');
    expect(streetAt(net, j.x + 1, j.y + 1, 'east')?.name).toBe('Market Street');
    expect(streetAt(net, j.x - 4, j.y + 1)?.name).toBe('Market Street');
    expect(compassOf(1, 0)).toBe('east');
    expect(compassOf(0, -2)).toBe('north');
    expect(compassOf(0, 0)).toBeNull();
  });

  it('cars drive on the left: eastbound on the north lane, northbound on the west lane', () => {
    const m = net.streets.find((s) => s.id === 'market-street')!;
    expect(laneOf(m, 'east')).toBe(m.at + 0.5);
    expect(laneOf(m, 'west')).toBe(m.at + 1.5);
    const b = net.streets.find((s) => s.id === 'bay-road')!;
    expect(laneOf(b, 'north')).toBe(b.at + 0.5);
  });

  it('out of a junction: along car streets only, never back unless there is nothing else', () => {
    const j = net.junctions.find((x) => x.id === 'market-street*bay-road')!;
    expect(exitsOf(net, j, 'east').sort()).toEqual(['east', 'north', 'south']);
    const fountain = net.junctions.find((x) => x.ns === 'fountain-lane' && x.ew === 'market-street');
    if (fountain) expect(exitsOf(net, fountain, 'east')).not.toContain('north');
  });
});

describe('streets: the lights', () => {
  const j = net.junctions.find((x) => x.lights)!;
  it('one way green means the other red; every phase comes round in a cycle; the clock decides, nothing else', () => {
    const seen = new Set<string>();
    for (let s = 0; s < LIGHT_CYCLE; s += 0.5) {
      const l = lightAt(net, j, s * 1000);
      expect(l.ew === 'green' && l.ns === 'green').toBe(false);
      if (l.ew !== 'red') expect(l.ns, `${s}`).toBe('red');
      seen.add(`${l.ew}/${l.ns}`);
      expect(lightAt(net, j, s * 1000 + LIGHT_CYCLE * 1000)).toEqual(l);
    }
    expect([...seen].sort()).toEqual(['amber/red', 'green/red', 'red/amber', 'red/green', 'red/red']);
  });

  it('running a red: into a lit box against red; an amber, a green or a move inside the box is not', () => {
    const when = (want: 'red' | 'green' | 'amber') => {
      for (let s = 0; s < LIGHT_CYCLE * 1000; s += 100) if (lightFor(net, j, 'east', s) === want) return s;
      throw new Error(want);
    };
    const a = { x: j.x - 0.3, y: j.y + 0.5 };
    const b = { x: j.x + 0.2, y: j.y + 0.5 };
    expect(ranRed(net, a, b, when('red'))).toBe(j);
    expect(ranRed(net, a, b, when('green'))).toBeNull();
    expect(ranRed(net, a, b, when('amber'))).toBeNull();
    expect(ranRed(net, b, { x: j.x + 1.2, y: j.y + 0.5 }, when('red'))).toBeNull();
  });
});

describe('traffic', () => {
  const cars = seedTraffic(net, 10, 42);
  const ctx = (nowMs: number, bodies: { x: number; y: number }[] = []) => ({ net, nowMs, bodies, rnd: (() => {
    let r = 9;
    return () => (r = (r * 48271) % 2147483647) / 2147483647;
  })() });

  it('ten cars at the start, on car streets, in their lanes, apart', () => {
    expect(cars.length).toBe(10);
    for (const c of cars) {
      const s = net.streets.find((x) => x.id === c.street)!;
      expect(s.cars).toBe(true);
      expect(s.axis === 'x' ? c.y : c.x).toBe(laneOf(s, c.dir));
      expect(junctionAt(net, c.x, c.y)).toBeNull();
    }
  });

  it('driving ten minutes: always on paving, always in a lane of the street it says, never one inside another', () => {
    let cs = cars;
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      cs = stepTraffic(cs, 0.1, ctx(t));
      t += 100;
      for (const c of cs) {
        expect(paved(Math.floor(c.x), Math.floor(c.y)), `car ${c.id} at ${c.x.toFixed(2)},${c.y.toFixed(2)} step ${i}`).toBe(true);
        const s = net.streets.find((x) => x.id === c.street)!;
        if (!junctionAt(net, c.x, c.y)) expect(Math.abs((s.axis === 'x' ? c.y : c.x) - laneOf(s, c.dir)), `car ${c.id} lane`).toBeLessThan(0.01);
      }
      for (let a = 0; a < cs.length; a++)
        for (let b = a + 1; b < cs.length; b++) {
          const same = cs[a].dir === cs[b].dir && !junctionAt(net, cs[a].x, cs[a].y);
          if (same) expect(Math.hypot(cs[a].x - cs[b].x, cs[a].y - cs[b].y), `cars ${a} ${b} step ${i}`).toBeGreaterThan(CAR_LEN * 0.9);
        }
    }
    // they went somewhere: not all standing still
    const moved = cs.filter((c, i) => Math.hypot(c.x - cars[i].x, c.y - cars[i].y) > 5).length;
    expect(moved).toBeGreaterThanOrEqual(7);
  }, 60_000);

  it('a car stops at a red light before the box, and goes on green', () => {
    const j: Junction = net.junctions.find((x) => x.id === 'market-street*bay-road')!;
    let red = 0;
    while (lightFor(net, j, 'east', red) !== 'red') red += 100;
    const m = net.streets.find((s) => s.id === 'market-street')!;
    let c: TrafficCar[] = [{ id: 0, x: j.x - 4, y: laneOf(m, 'east'), dir: 'east', street: m.id, speed: TRAFFIC_SPEED, v: 0, next: null, turning: null }];
    for (let i = 0; i < 20; i++) c = stepTraffic(c, 0.1, ctx(red));
    expect(c[0].x + CAR_LEN / 2).toBeLessThanOrEqual(j.x);
    expect(c[0].speed).toBe(0);
    let green = red;
    while (lightFor(net, j, 'east', green) !== 'green') green += 100;
    for (let i = 0; i < 40; i++) c = stepTraffic(c, 0.1, ctx(green + i * 100));
    expect(c[0].x).toBeGreaterThan(j.x);
  });

  it('a car never drives its front into a body standing in its lane, however long it waits', () => {
    const m = net.streets.find((s) => s.id === 'arts-street')!;
    const body = { x: m.from + 20, y: laneOf(m, 'east') + 0.3 };
    let c: TrafficCar[] = [{ id: 0, x: m.from + 12, y: laneOf(m, 'east'), dir: 'east', street: m.id, speed: TRAFFIC_SPEED, v: 0, next: null, turning: null }];
    for (let i = 0; i < 600; i++) {
      c = stepTraffic(c, 0.1, ctx(0, [body]));
      expect(body.x - c[0].x, `step ${i}`).toBeGreaterThanOrEqual(BODY_GAP - 1e-6);
    }
    expect(c[0].speed).toBe(0);
    // the body steps off the lane: the car goes on
    for (let i = 0; i < 30; i++) c = stepTraffic(c, 0.1, ctx(0, [{ x: body.x, y: body.y - 1.6 }]));
    expect(c[0].x).toBeGreaterThan(body.x);
    expect(clearAhead(c[0], c, [])).toBe(Infinity);
  });

  it('moving things never shut a walker in: never a body they stand inside, and always a way out, ten minutes of traffic round a walker in the road', () => {
    const m = net.streets.find((x) => x.id === 'station-avenue')!;
    let cs = seedTraffic(net, 10, 5);
    const spots = [
      { x: m.from + 30, y: m.at + 0.5 },
      { x: m.from + 50, y: m.at + 1.5 },
      ...net.junctions.filter((j) => j.lights).slice(0, 3).map((j) => ({ x: j.x + 1, y: j.y + 1 })),
    ];
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      const me = spots[Math.floor(i / 1200)];
      cs = stepTraffic(cs, 0.1, ctx(t, [me]));
      t += 100;
      const bs = blockersFor(me, cs, null, []);
      for (const b of bs) expect(Math.hypot(b.x - me.x, b.y - me.y), `step ${i}`).toBeGreaterThanOrEqual(b.gap - 0.05);
      const free = Array.from({ length: 16 }, (_, k) => (k / 16) * 2 * Math.PI).some((a) => {
        const q = { x: me.x + Math.cos(a) * 0.3, y: me.y + Math.sin(a) * 0.3 };
        return bs.every((b) => Math.hypot(b.x - q.x, b.y - q.y) >= b.gap);
      });
      expect(free, `step ${i}: a way out`).toBe(true);
    }
  }, 60_000);

  it("a car's circles cover its length", () => {
    const cs = carCircles({ x: 10, y: 10, dir: 'east' });
    expect(cs.length).toBe(3);
    expect(cs[0].x).toBeLessThan(10);
    expect(cs[2].x).toBeGreaterThan(10);
  });
});
