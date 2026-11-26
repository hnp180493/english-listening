import { describe, expect, it } from 'vitest';
import { clockLabel, GAME_DAY_MS, gameHour, glowOf, lightningAt, nightOf, SKIES, skyAt, skyOfSlot, SLOT_HOURS, strikeIn } from './sky';

const HOUR_MS = GAME_DAY_MS / 24;

describe('the town’s clock', () => {
  it('a day of the game is 48 real minutes; an hour is two', () => {
    expect(GAME_DAY_MS).toBe(48 * 60 * 1000);
    expect(gameHour(0)).toBe(0);
    expect(gameHour(2 * 60 * 1000)).toBeCloseTo(1, 6);
    expect(gameHour(GAME_DAY_MS + 13.5 * HOUR_MS)).toBeCloseTo(13.5, 6);
    // (a time before 1970 still gives an hour of the day)
    expect(gameHour(-HOUR_MS)).toBeCloseTo(23, 6);
  });

  it('the clock reads in fives', () => {
    expect(clockLabel(0)).toBe('00:00');
    expect(clockLabel(13.5 * HOUR_MS)).toBe('13:30');
    expect(clockLabel(13.5 * HOUR_MS + 3 * (HOUR_MS / 60))).toBe('13:30');
    expect(clockLabel(23.99 * HOUR_MS)).toBe('23:55');
  });

  it('night by the hour: dark at night, light by day, easing through dawn and dusk without a jump', () => {
    expect(nightOf(0)).toBe(1);
    expect(nightOf(3)).toBe(1);
    expect(nightOf(12)).toBe(0);
    expect(nightOf(16)).toBe(0);
    expect(nightOf(22)).toBe(1);
    expect(nightOf(6)).toBeGreaterThan(0.2);
    expect(nightOf(6)).toBeLessThan(0.8);
    expect(nightOf(18.75)).toBeGreaterThan(0.2);
    expect(nightOf(18.75)).toBeLessThan(0.8);
    let last = nightOf(0);
    for (let h = 0; h <= 24; h += 0.05) {
      const n = nightOf(h);
      expect(Math.abs(n - last)).toBeLessThan(0.08);
      last = n;
    }
    expect(nightOf(24)).toBe(nightOf(0));
  });

  it('the gold of dawn and dusk: none at noon or at night', () => {
    expect(glowOf(12)).toBe(0);
    expect(glowOf(1)).toBe(0);
    expect(glowOf(6.2)).toBeGreaterThan(0.6);
    expect(glowOf(18)).toBeGreaterThan(0.6);
  });
});

describe('the town’s weather', () => {
  it('a stretch has one sky, the same whenever it is asked', () => {
    for (let s = 0; s < 50; s++) {
      expect(SKIES).toContain(skyOfSlot(s, 'cloudy'));
      expect(skyOfSlot(s, 'cloudy')).toBe(skyOfSlot(s, 'cloudy'));
    }
  });

  it('the day’s own weather leans the odds: a rain day is mostly wet, a clear one mostly dry', () => {
    const wet = (day: 'clear' | 'cloudy' | 'rain'): number => {
      let n = 0;
      for (let s = 1000; s < 3000; s++) {
        const k = skyOfSlot(s, day);
        if (k === 'rain' || k === 'storm') n++;
      }
      return n / 2000;
    };
    expect(wet('clear')).toBeLessThan(0.2);
    expect(wet('rain')).toBeGreaterThan(0.55);
    expect(wet('cloudy')).toBeGreaterThan(wet('clear'));
    expect(wet('rain')).toBeGreaterThan(wet('cloudy'));
  });

  it('one sky eases into the next: no jump in the mix from second to second', () => {
    const slotMs = SLOT_HOURS * HOUR_MS;
    let last = skyAt(0, 'rain').mix;
    for (let t = 0; t < slotMs * 12; t += 1000) {
      const m = skyAt(t, 'rain').mix;
      expect(Math.abs(m.rain - last.rain)).toBeLessThan(0.03);
      expect(Math.abs(m.cloud - last.cloud)).toBeLessThan(0.03);
      for (const v of [m.cloud, m.rain, m.storm, m.wind]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      last = m;
    }
  });

  it('the sky at a time is the same on every call; cloud takes the gold out of dusk', () => {
    const t = 1_795_000_000_000;
    expect(skyAt(t, 'cloudy')).toEqual(skyAt(t, 'cloudy'));
    const dusk = 18 * HOUR_MS;
    let clear = 0;
    let stormy = 0;
    for (let d = 0; d < 400; d++) {
      const s = skyAt(d * GAME_DAY_MS + dusk, 'rain');
      if (s.mix.cloud === 0) clear = Math.max(clear, s.glow);
      if (s.mix.cloud === 1) stormy = Math.max(stormy, s.glow);
    }
    expect(clear).toBeGreaterThan(stormy);
  });
});

describe('lightning', () => {
  it('none without a storm', () => {
    for (let t = 0; t < 120_000; t += 37) expect(lightningAt(t, 0.2)).toBe(0);
    expect(strikeIn(5000, 0)).toBeNull();
  });

  it('in a full storm a flash comes now and then, lasts a moment, and its time is the one the thunder is told', () => {
    let lit = 0;
    let strikes = 0;
    for (let t = 0; t < 600_000; t += 10) if (lightningAt(t, 1) > 0) lit++;
    for (let s = 0; s < 600; s++) {
      const at = strikeIn(s * 1000, 1);
      if (at === null) continue;
      strikes++;
      expect(at).toBeGreaterThanOrEqual(s * 1000);
      expect(at).toBeLessThan(s * 1000 + 600);
      expect(lightningAt(at + 20, 1)).toBe(1);
    }
    // about one every nine seconds, each lit for well under a second
    expect(strikes).toBeGreaterThan(30);
    expect(strikes).toBeLessThan(110);
    expect(lit * 10).toBeLessThan(strikes * 400);
  });
});
