import { describe, expect, it } from 'vitest';
import { muffle, overheardVolume, rideGrip, rulesNow, scannerStatic, SLIPPERY_FROM, staticCut, staticPieces, stormStatic, trafficPace, type Clarity } from './skyRules';
import { overhearClarity } from './job';
import { bulletinAt, isRadioFiller, type BulletinInput } from './radio';
import { TOWN_EVENTS } from './world';
import { scanLines, type ScanFacts, type ScanKind } from './scanner';
import type { Weather } from './sceneTypes';
import { TOWN_EVENT_LINES, CITY_EVENT_LINES } from '../../data/scenes/radioLive';

describe('wet roads are slippery (rides only)', () => {
  it('grips fully when dry, less the wetter it is: wider turns, longer stops', () => {
    expect(rideGrip(0)).toEqual({ turn: 1, stop: 0 });
    let last = rideGrip(0);
    for (let w = 0.05; w <= 1.0001; w += 0.05) {
      const g = rideGrip(w);
      expect(g.turn).toBeLessThanOrEqual(last.turn);
      expect(g.stop).toBeGreaterThanOrEqual(last.stop);
      last = g;
    }
    expect(rideGrip(1).turn).toBeCloseTo(0.45);
    expect(rideGrip(1).stop).toBeCloseTo(0.6);
    // already felt by the time the HUD says "Đường trơn"
    expect(rideGrip(SLIPPERY_FROM).turn).toBeLessThan(1);
  });

  it('Westbay\'s traffic drives slower when wet, never stops for it', () => {
    expect(trafficPace(0)).toBe(1);
    expect(trafficPace(1)).toBeCloseTo(0.75);
    expect(trafficPace(0.5)).toBeGreaterThan(trafficPace(1));
  });
});

describe('rain drowns voices: one rule for everything overheard', () => {
  it('is the jobs\' rule: a step worse above half rain, nothing else', () => {
    for (const c of ['clear', 'faint', 'none'] as Clarity[]) {
      expect(muffle(c, 0)).toBe(c);
      expect(muffle(c, 0.49)).toBe(c);
    }
    expect(muffle('clear', 0.5)).toBe('faint');
    expect(muffle('faint', 0.8)).toBe('none');
    expect(muffle('none', 1)).toBe('none');
    // the jobs' overhearing reads it
    for (const d of [0, 2, 3.5, 4, 7, 9]) for (const r of [0, 0.4, 0.5, 1]) expect(overhearClarity(d, r)).toBe(muffle(overhearClarity(d, 0), r));
  });

  it('a bench\'s overheard talk is quieter in hard rain, never silent', () => {
    expect(overheardVolume(0)).toBe(1);
    expect(overheardVolume(0.8)).toBeLessThan(1);
    expect(overheardVolume(0.8)).toBeGreaterThan(0.3);
  });
});

describe('a storm breaks the radio up', () => {
  it('cuts one or two words in the middle, never the first or last, never a kept word, the same way for the same seed', () => {
    const text = 'Good evening, you are listening to Bay FM on a wet night.';
    for (let seed = 0; seed < 200; seed++) {
      const cut = staticCut(text, (w) => w === 'listening', seed);
      expect(cut).toContain('...');
      expect(cut.startsWith('Good')).toBe(true);
      expect(cut.endsWith('night.')).toBe(true);
      expect(cut).toContain('listening');
      const lost = text.split(' ').length - cut.split(' ').filter((t) => t !== '...').length;
      expect(lost === 1 || lost === 2).toBe(true);
      expect(staticCut(text, (w) => w === 'listening', seed)).toBe(cut);
      expect(staticPieces(cut).length).toBe(2);
    }
    // too short, or nothing that may go: unchanged
    expect(staticCut('Thanks for listening.', () => false, 3)).toBe('Thanks for listening.');
    expect(staticCut('One two three four five six', () => true, 3)).toBe('One two three four five six');
  });

  it('only the filler of a bulletin may break: never the time, the sky, the forecast, the events', () => {
    const weathers: Weather[] = ['clear', 'cloudy', 'rain'];
    const t0 = Date.UTC(2026, 10, 27, 6, 0, 0);
    for (let k = 0; k < 120; k++) {
      const now = t0 + k * 7 * 60_000 + k * 13_000;
      const input: BulletinInput = { now, weatherAt: () => weathers[k % 3], weekday: new Date(now).getDay(), month: new Date(now).getMonth() + 1, townEvents: TOWN_EVENTS };
      const b = bulletinAt(input);
      const lines = b.scene.lines;
      // the greeting first, the sign-off last; the time check right after the greeting is kept whole
      expect(isRadioFiller(lines[0])).toBe(true);
      expect(isRadioFiller(lines[lines.length - 1])).toBe(true);
      expect(isRadioFiller(lines[1])).toBe(false);
      const events = new Set([...Object.values(TOWN_EVENT_LINES).map((e) => e.en), ...CITY_EVENT_LINES.map((e) => e.en)]);
      for (const l of lines) {
        if (events.has(l.text)) expect(isRadioFiller(l), l.text).toBe(false);
      }
      // at most a handful of lines may break; the questions are about lines that never do
      expect(lines.filter(isRadioFiller).length).toBeLessThanOrEqual(5);
    }
  });

  it('the scanner loses only the call sign: the street, the heading, the vehicle, the top and the place stay', () => {
    const facts: ScanFacts[] = [
      { unit: 12, look: { on: 'scooter', colour: 'red', outfit: 'blue' } as ScanFacts['look'], road: 'Harbour Road', heading: 'east', near: 'the ferry', nearVi: 'bến phà', offence: 'red', thing: null },
      { unit: 7, look: { on: 'foot', colour: null, outfit: 'green' } as ScanFacts['look'], road: null, heading: null, near: 'the Lumen', nearVi: 'rạp Lumen', offence: 'thing', thing: 'bins' },
    ];
    const kinds: ScanKind[] = ['start', 'update', 'spotted', 'lost', 'lostLook'];
    for (const f of facts)
      for (const kind of kinds)
        for (let pick = 0; pick < 3; pick++)
          for (const l of scanLines(kind, f, pick)) {
            const cut = scannerStatic(l.text);
            for (const keep of [f.road, f.heading, f.near, f.look.colour, f.look.outfit].filter((x): x is string => !!x)) if (l.text.includes(keep)) expect(cut, `${l.text}`).toContain(keep);
            expect(cut.replace(/^\.\.\. /, '')).not.toMatch(/^(All units|Unit [a-z-]+)[,.]/i);
          }
  });

  it('breaks up only in a storm', () => {
    expect(stormStatic(0)).toBe(false);
    expect(stormStatic(0.34)).toBe(false);
    expect(stormStatic(1)).toBe(true);
  });
});

describe('what the HUD names', () => {
  it('names a rule only while it is in force', () => {
    expect(rulesNow({ rain: 0, storm: 0 }, 0)).toEqual([]);
    expect(rulesNow({ rain: 0, storm: 0 }, 0.6)).toEqual(['slippery']);
    expect(rulesNow({ rain: 0.75, storm: 0 }, 1)).toEqual(['slippery', 'muffled']);
    expect(rulesNow({ rain: 1, storm: 1 }, 1)).toEqual(['slippery', 'static']);
  });
});
