// Bay FM's traffic is true of the streets it was read from (./radioTraffic.ts, docs/town.md §25): every line is checked
// against the cars and the patrol, on Westbay's real network, over many moments of traffic driven by the real rules.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../decoder/sapiMisread';
import { CITY_ROWS } from '../../data/cityWorld';
import { BUSY, CLEAR, PATROL, QUIET, TRAFFIC_LEADS, WET } from '../../data/scenes/radioTraffic';
import { bulletinAt } from './radio';
import { BUSY_FROM, STILL, trafficReport, type TrafficSnapshot } from './radioTraffic';
import { trafficPace } from './skyRules';
import { streetAt, westbayNet, type Compass } from './streets';
import { seedTraffic, stepTraffic, type TrafficCar } from './traffic';

const net = westbayNet();
const carStreets = net.streets.filter((s) => s.cars);
const roadTiles: { x: number; y: number }[] = [];
CITY_ROWS.forEach((row, y) => [...row].forEach((ch, x) => ch === '=' && roadTiles.push({ x: x + 0.5, y: y + 0.5 })));

function rnd(seed: number) {
  let r = seed % 2147483647 || 7;
  return () => (r = (r * 48271) % 2147483647) / 2147483647;
}

/** A moment of Westbay: traffic driven for a while by the real rules, a patrol somewhere or none, the roads wet or not. */
function moment(seed: number): { snap: TrafficSnapshot; cars: TrafficCar[]; patrol: { x: number; y: number } | null } {
  const r = rnd(seed * 7919 + 1);
  // (a few moments with three cars only: a quiet city)
  let cars = seedTraffic(net, seed % 7 === 0 ? 3 : 10, seed);
  const steps = Math.floor(r() * 120);
  for (let i = 0; i < steps; i++) cars = stepTraffic(cars, 0.25, { net, nowMs: seed * 1000 + i * 250, bodies: [], rnd: r });
  // some moments with a crowded street (cars moved onto one street)
  if (seed % 5 === 0) {
    const s = carStreets[seed % carStreets.length];
    cars = cars.map((c, i) => (i < 4 ? { ...c, street: s.id, dir: (i % 3 === 0 ? (s.axis === 'x' ? 'west' : 'north') : s.axis === 'x' ? 'east' : 'south') as Compass, speed: seed % 10 === 0 ? 0 : c.speed } : c));
  }
  const patrol = r() < 0.4 ? roadTiles[Math.floor(r() * roadTiles.length)] : null;
  const wet = r() < 0.5 ? 0 : r();
  const snap: TrafficSnapshot = {
    streets: carStreets.map((s) => ({ id: s.id, name: s.name })),
    cars: cars.map((c) => ({ street: c.street, dir: c.dir, speed: c.speed })),
    ...(patrol ? { patrol: streetAt(net, patrol.x, patrol.y)?.name ?? null } : {}),
    wet,
  };
  return { snap, cars, patrol };
}

const nameToId = new Map(carStreets.map((s) => [s.name, s.id]));
const onStreet = (snap: TrafficSnapshot, name: string) => snap.cars.filter((c) => c.street === nameToId.get(name));
const re = (en: string) => new RegExp('^' + en.replace(/[.?]/g, '\\$&').replace('{S}', '(.+?)').replace('{C}', '(\\w+)') + '$', 'i');

describe("Bay FM's traffic: every line true of the streets it was read from", () => {
  it('over 400 moments: busy, clear, quiet, wet and the patrol, each said only when so', () => {
    let saidBusy = 0;
    let saidPatrol = 0;
    let saidWet = 0;
    let saidQuiet = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const { snap, patrol } = moment(seed);
      const rep = trafficReport(snap, seed)!;
      expect(rep).not.toBeNull();
      const counts = carStreets.map((s) => snap.cars.filter((c) => c.street === s.id).length);
      const max = Math.max(...counts);
      for (const line of rep.lines) {
        const t = line.en;
        let m: RegExpMatchArray | null;
        if ((m = t.match(re(BUSY.heading.en)))) {
          const on = onStreet(snap, m[1]);
          expect(on.length, t).toBe(max);
          expect(on.length).toBeGreaterThanOrEqual(BUSY_FROM);
          const dir = m[2] as Compass;
          const n = on.filter((c) => c.dir === dir).length;
          for (const d of ['north', 'south', 'east', 'west'] as const) if (d !== dir) expect(on.filter((c) => c.dir === d).length, t).toBeLessThan(n);
          saidBusy++;
        } else if ((m = t.match(re(BUSY.bothWays.en)))) {
          const on = onStreet(snap, m[1]);
          expect(on.length, t).toBe(max);
          const dirs = [...new Set(on.map((c) => c.dir))];
          expect(dirs.length, t).toBe(2);
          expect(on.filter((c) => c.dir === dirs[0]).length).toBe(on.filter((c) => c.dir === dirs[1]).length);
          saidBusy++;
        } else if ((m = t.match(re(BUSY.standing.en)))) {
          const on = onStreet(snap, m[1]);
          expect(on.length, t).toBe(max);
          expect(on.filter((c) => c.speed < STILL).length, t).toBeGreaterThanOrEqual(2);
          saidBusy++;
        } else if (CLEAR.some((p) => re(p.en).test(t))) {
          const name = CLEAR.map((p) => t.match(re(p.en))).find(Boolean)![1];
          expect(nameToId.has(name), t).toBe(true);
          expect(onStreet(snap, name).length, t).toBe(0);
        } else if (QUIET.some((p) => p.en === t)) {
          expect(max, t).toBeLessThan(BUSY_FROM);
          saidQuiet++;
        } else if (t === WET.en) {
          expect(trafficPace(snap.wet)).toBeLessThan(1);
          saidWet++;
        } else if ((m = t.match(re(PATROL.on.en)))) {
          expect(patrol).not.toBeNull();
          expect(streetAt(net, patrol!.x, patrol!.y)?.name, t).toBe(m[1]);
          saidPatrol++;
        } else if (t === PATROL.out.en) {
          expect(patrol).not.toBeNull();
          expect(streetAt(net, patrol!.x, patrol!.y), t).toBeNull();
          saidPatrol++;
        } else throw new Error(`a line no rule checks: ${t}`);
      }
      // what is true is said: wet, the patrol, quiet or busy
      expect(rep.lines.some((l) => l.en === WET.en)).toBe(trafficPace(snap.wet) <= 0.95);
      expect(rep.lines.some((l) => l.en.includes('police car'))).toBe(!!patrol);
      expect(rep.lines.some((l) => QUIET.some((p) => p.en === l.en))).toBe(max < BUSY_FROM);
    }
    // the moments cover every kind of line
    expect(saidBusy).toBeGreaterThan(20);
    expect(saidQuiet).toBeGreaterThan(5);
    expect(saidWet).toBeGreaterThan(20);
    expect(saidPatrol).toBeGreaterThan(20);
  });

  it('the question asks what was said; its right answer is true and the wrong ones are not', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { snap, patrol } = moment(seed);
      const rep = trafficReport(snap, seed)!;
      const q = rep.question;
      const right = q.options[q.answer];
      const wrong = q.options.filter((_, i) => i !== q.answer);
      expect(new Set(q.options).size).toBe(3);
      if (q.q.includes('cảnh sát')) {
        expect(right).toBe(streetAt(net, patrol!.x, patrol!.y)?.name);
        for (const w of wrong) expect(w).not.toBe(right);
      } else if (q.q.includes('đông xe')) {
        const n = onStreet(snap, right).length;
        expect(n).toBeGreaterThanOrEqual(BUSY_FROM);
        for (const w of wrong) expect(onStreet(snap, w).length).toBeLessThan(n);
      } else if (q.q.includes('hướng')) {
        const name = rep.facts.busy!.name;
        expect(q.q).toContain(name);
        const on = onStreet(snap, name);
        const said = rep.facts.busy!.heading as Compass;
        for (const d of ['north', 'south', 'east', 'west'] as const) if (d !== said) expect(on.filter((c) => c.dir === d).length).toBeLessThan(on.filter((c) => c.dir === said).length);
        for (const w of wrong) expect(w).not.toBe(right);
      } else if (q.q.includes('chậm')) {
        expect(rep.lines.some((l) => l.en === WET.en)).toBe(true);
      } else {
        expect(rep.facts.quiet).toBe(true);
      }
    }
  });

  it('plain spoken English the browser voice says right, at every street name', () => {
    const pieces = [...TRAFFIC_LEADS, ...QUIET, WET, PATROL.out];
    for (const s of carStreets) for (const p of [BUSY.heading, BUSY.bothWays, BUSY.standing, PATROL.on, ...CLEAR]) pieces.push({ en: p.en.replace('{S}', s.name).replace('{C}', 'north'), vi: p.vi });
    for (const p of pieces) {
      const t = p.en.charAt(0).toUpperCase() + p.en.slice(1);
      const words = t.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
      expect(words, t).toBeGreaterThanOrEqual(3);
      expect(words, t).toBeLessThanOrEqual(16);
      expect(t).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
      expect(decode(t).tokens.length).toBeGreaterThan(0);
      expect(speakableFor(t)).not.toMatch(SAPI_MISREAD);
      expect(speakableFor(t)).not.toMatch(LONE_APOSTROPHE);
      expect(p.vi.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('the bulletin with and without the streets', () => {
  const base = { weatherAt: () => 'clear' as const, weekday: 3, month: 5, townEvents: [] };
  it('without a source (the town) nothing is said about traffic; with one, its lines are read and asked in a car', () => {
    const now = Date.UTC(2026, 10, 27, 9, 0, 0);
    const none = bulletinAt({ ...base, now });
    expect(none.traffic).toBeNull();
    expect(bulletinAt({ ...base, now, traffic: null }).scene.lines).toEqual(none.scene.lines);
    const { snap } = moment(10);
    const b = bulletinAt({ ...base, now, traffic: snap, place: 'car' });
    const rep = trafficReport(snap, Math.floor(now / (2000 * 60)))!;
    expect(b.traffic).toEqual(rep.facts);
    for (const l of rep.lines) expect(b.scene.lines.some((x) => x.text === l.en)).toBe(true);
    expect(b.scene.detail).toEqual(rep.question);
    expect(b.scene.lines.length).toBe(none.scene.lines.length + rep.lines.length + 1);
  });
});

describe("the bulletin's advert gives its clue", () => {
  it('a clue advert read in a bulletin is among the clues it gives once heard; no other advert is', async () => {
    const { RADIO_CLUE_ADS } = await import('../../data/scenes/radioCalls');
    const base = { weatherAt: () => 'clear' as const, weekday: 3, month: 5, townEvents: [] };
    const seen = new Set<string>();
    for (let h = 0; h < 200; h++) {
      const b = bulletinAt({ ...base, now: Date.UTC(2026, 10, 27) + h * 2000 * 60 });
      seen.add(b.adId);
      expect(b.clues.includes(b.adId)).toBe(RADIO_CLUE_ADS.includes(b.adId));
    }
    for (const id of RADIO_CLUE_ADS) expect(seen.has(id), id).toBe(true);
  });
});

describe("the learner's sponsorship on air", () => {
  it('once bought, its words are read after the advert lead, a line a sentence; before, never', async () => {
    const { SPONSOR_LINE } = await import('./assets');
    const base = { weatherAt: () => 'clear' as const, weekday: 3, month: 5, townEvents: [], now: Date.UTC(2026, 10, 27, 9) };
    const without = bulletinAt(base);
    const withIt = bulletinAt({ ...base, sponsor: SPONSOR_LINE });
    const added = withIt.scene.lines.filter((l) => !without.scene.lines.some((x) => x.text === l.text));
    expect(added.map((l) => l.text).join(' ')).toBe(SPONSOR_LINE.text);
    expect(added.map((l) => l.vi).join(' ')).toBe(SPONSOR_LINE.vi);
    expect(without.scene.lines.some((l) => l.text.includes("Rico's cars"))).toBe(false);
  });
});
