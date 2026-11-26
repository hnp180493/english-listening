import { describe, expect, it } from 'vitest';
import { GAME_DAY_MS, skyAt, skyOfSlot, SLOT_HOURS } from './sky';
import { angleDeg, DRY_HOURS, hazeOf, MIN_ELEVATION, NOON_SUN, stepSun, sunAt, SUNRISE, SUNSET, wetAt } from './sunPath';

const HOUR = GAME_DAY_MS / 24;
const len = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

describe('sunAt: the sun and the moon cross the sky', () => {
  it('is a unit vector, never lower than the minimum height, at every moment of the day', () => {
    for (let h = 0; h <= 24; h += 0.01) {
      const s = sunAt(h);
      expect(len(s.dir)).toBeCloseTo(1, 9);
      expect(s.dir.y).toBeGreaterThanOrEqual(Math.sin(MIN_ELEVATION) - 1e-9);
      expect(s.strength).toBeGreaterThanOrEqual(0);
      expect(s.strength).toBeLessThanOrEqual(1);
    }
  });

  it('at noon it is the scene default (SUN_DIR), at full strength', () => {
    const noon = sunAt((SUNRISE + SUNSET) / 2);
    expect(angleDeg(noon.dir, NOON_SUN)).toBeLessThan(1e-6);
    expect(noon.strength).toBe(1);
    expect(noon.moon).toBe(false);
  });

  it('is continuous over the whole day, the hand-overs and midnight included', () => {
    let worst = 0;
    let worstLit = 0;
    const step = 0.002;
    for (let h = -1; h <= 25; h += step) {
      const a = sunAt(h);
      const b = sunAt(h + step);
      worst = Math.max(worst, angleDeg(a.dir, b.dir));
      // what the light does to the picture (direction times strength) never jumps
      const d = Math.hypot(a.dir.x * a.strength - b.dir.x * b.strength, a.dir.y * a.strength - b.dir.y * b.strength, a.dir.z * a.strength - b.dir.z * b.strength);
      worstLit = Math.max(worstLit, d);
      expect(Math.abs(a.strength - b.strength)).toBeLessThan(0.01);
    }
    // the swing at a hand-over is the quickest turn (while almost dark): under a degree per 7 game seconds
    expect(worst).toBeLessThan(1);
    expect(worstLit).toBeLessThan(0.01);
  });

  it('is almost dark while the direction swings from the sun to the moon, and dark at the swap itself', () => {
    for (const swap of [SUNRISE, SUNSET]) {
      expect(sunAt(swap).strength).toBe(0);
      for (let d = -0.25; d <= 0.25; d += 0.01) expect(sunAt(swap + d).strength).toBeLessThan(0.16);
    }
  });

  it('rises low in the east, stands high at noon and sets low in the west: shadows turn and lengthen', () => {
    const at7 = sunAt(7).dir;
    const at12 = sunAt(12.5).dir;
    const at18 = sunAt(18).dir;
    // the east is +x (the noon sun leans to -x): the morning light comes from +x, the evening's from -x
    expect(at7.x).toBeGreaterThan(0.3);
    expect(at18.x).toBeLessThan(-0.3);
    expect(at12.y).toBeGreaterThan(at7.y + 0.25);
    expect(at12.y).toBeGreaterThan(at18.y + 0.25);
    // a shadow's length is cot(height): far longer in the morning
    const shadow = (v: { y: number }) => Math.sqrt(1 - v.y * v.y) / v.y;
    expect(shadow(at7)).toBeGreaterThan(shadow(at12) * 2);
    // and points a different way (more than 90 degrees between morning and evening on the ground)
    const ground = (v: { x: number; z: number }) => Math.atan2(v.z, v.x);
    const turn = Math.abs(((ground(at18) - ground(at7) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    expect(turn * (180 / Math.PI)).toBeGreaterThan(90);
  });

  it('is the moon at night, highest about half past midnight', () => {
    expect(sunAt(23).moon).toBe(true);
    expect(sunAt(2).moon).toBe(true);
    expect(sunAt(9).moon).toBe(false);
    expect(sunAt(0.5).strength).toBe(1);
    expect(sunAt(0.5).dir.y).toBeGreaterThan(sunAt(22).dir.y);
  });
});

describe('stepSun: the shadows are re-aimed in small steps', () => {
  it('holds the direction until it has turned enough, so it changes a few hundred times a game day, not every frame', () => {
    let held = sunAt(0).dir;
    let moves = 0;
    let frames = 0;
    let worst = 0;
    // a game day at 60 frames a second (48 real minutes)
    const frameHours = 24 / (48 * 60 * 60);
    for (let h = 0; h < 24; h += frameHours) {
      frames++;
      const next = stepSun(held, sunAt(h).dir);
      if (next !== held) {
        moves++;
        held = next;
      }
      // never further than a step from where the light really is
      worst = Math.max(worst, angleDeg(held, sunAt(h).dir));
    }
    expect(worst).toBeLessThan(0.3);
    expect(moves).toBeLessThan(frames / 50);
    expect(moves).toBeGreaterThan(300);
  });
});

describe('wetAt: the ground gets wet in the rain and dries slowly after', () => {
  // a lone stretch of rain between dry ones (on a cloudy day: rain one stretch in five)
  const dry = (s: number) => ['clear', 'cloudy'].includes(skyOfSlot(s, 'cloudy'));
  const findRain = (): number => {
    for (let s = 3_000_000; s < 3_001_000; s++) {
      if (dry(s - 1) && dry(s) && skyOfSlot(s + 1, 'cloudy') === 'rain' && dry(s + 2) && dry(s + 3)) return (s + 1) * SLOT_HOURS * HOUR;
    }
    throw new Error('no dry → rain → dry run found');
  };

  it('is dry with no rain in the hours before', () => {
    const start = findRain();
    expect(wetAt(start - 2 * HOUR, 'cloudy')).toBe(0);
  });

  it('rises with the rain, is soaked in a steady rain, then dries over a few game hours', () => {
    const start = findRain();
    const slot = SLOT_HOURS * HOUR;
    // in the middle of the rain the ground is soaked
    expect(wetAt(start + slot / 2, 'cloudy')).toBe(1);
    // an hour after the rain has gone it is still wet, and less so later
    const end = start + slot;
    const a = wetAt(end + 1 * HOUR, 'cloudy');
    const b = wetAt(end + 2 * HOUR, 'cloudy');
    expect(skyAt(end + 1 * HOUR, 'cloudy').mix.rain).toBe(0);
    expect(a).toBeGreaterThan(0.4);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(0);
    expect(wetAt(end + (DRY_HOURS + 0.1) * HOUR, 'cloudy')).toBe(0);
  });

  it('never jumps: over a long run it changes little from one real second to the next', () => {
    const start = findRain() - 4 * HOUR;
    let prev = wetAt(start, 'cloudy');
    for (let t = start; t < start + 18 * HOUR; t += 1000) {
      const w = wetAt(t, 'cloudy');
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      expect(Math.abs(w - prev)).toBeLessThan(0.02);
      prev = w;
    }
  });

  it('takes the weather of each moment when given a function', () => {
    const start = findRain();
    expect(wetAt(start + HOUR * 3, () => 'cloudy')).toBe(wetAt(start + HOUR * 3, 'cloudy'));
  });
});

describe('hazeOf: mist at dawn and in the rain, none at a clear noon', () => {
  const clear = { cloud: 0, rain: 0, storm: 0, wind: 0 };
  const rain = { cloud: 0.9, rain: 0.75, storm: 0, wind: 0.5 };
  const storm = { cloud: 1, rain: 1, storm: 1, wind: 1 };
  it('orders the cases the way they look', () => {
    expect(hazeOf(12.5, clear, 0)).toBe(0);
    expect(hazeOf(6.2, clear, 0)).toBeGreaterThan(0.3);
    expect(hazeOf(6.2, clear, 1)).toBeGreaterThan(hazeOf(6.2, clear, 0));
    expect(hazeOf(14, rain, 1)).toBeGreaterThan(0.3);
    expect(hazeOf(21, storm, 1)).toBeGreaterThan(hazeOf(14, rain, 1));
    for (let h = 0; h < 24; h += 0.25) {
      expect(hazeOf(h, storm, 1)).toBeLessThanOrEqual(1);
      expect(hazeOf(h, clear, 0)).toBeGreaterThanOrEqual(0);
    }
  });
});
