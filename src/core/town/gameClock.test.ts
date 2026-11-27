import { afterEach, describe, expect, it } from 'vitest';
import { canSleep, gameNow, MIN_SHIFT_MS, offsetAt, rejoinAt, setShiftForTests, shownAt, sleepFor, sleepShift, sleepWait, SLEEP_EVERY_MS, type Shift } from './gameClock';
import { clockMinutes, GAME_DAY_MS, GAME_HOUR_MS, GAME_MINUTE_MS, glowOf, nightOf } from './clockMath';
import { gameHour, skyAt } from './sky';
import { forecastAt } from './radio';
import { townDay } from './progress';
import { gameDayOf as officeDay } from './office';
import { canRest, emptyTownHideout, markRested } from './hideout';
import { callbackDeadline, canCallBack, gameDayOf as phoneDay, goneUntil, type PhoneEntry } from './phone';
import type { Weather } from './sceneTypes';

/** A real time whose game clock reads `hour` (on the shared clock). */
const at = (hour: number, day = 9000): number => day * GAME_DAY_MS + hour * GAME_HOUR_MS;
const shownHour = (real: number, s: Shift | null) => clockMinutes(shownAt(real, s)) / 60;

afterEach(() => setShiftForTests(null));

describe('sleeping moves this machine\'s clock on, for a while', () => {
  it('to the evening by day, to the morning in the evening and at night', () => {
    expect(sleepFor(10)).toBe('evening');
    expect(sleepFor(6)).toBe('evening');
    expect(sleepFor(17.9)).toBe('evening');
    expect(sleepFor(18)).toBe('morning');
    expect(sleepFor(2)).toBe('morning');
  });

  it('wakes exactly at 18:00 or 06:00, the offset never negative and within a day', () => {
    for (const [h, to, wake] of [[10, 'evening', 18], [7.25, 'evening', 18], [22, 'morning', 6], [1.5, 'morning', 6], [19, 'morning', 6]] as const) {
      const real = at(h);
      const s = sleepShift(real, to, null);
      expect(s.offset).toBeGreaterThan(0);
      expect(s.offset).toBeLessThan(GAME_DAY_MS);
      expect(shownHour(real, s)).toBeCloseTo(wake, 5);
      expect(s.slept).toBe(real);
    }
  });

  it('comes back to the shared clock at a moment both show the same light, not before two game hours', () => {
    for (const [h, to] of [[10, 'evening'], [13, 'evening'], [22, 'morning'], [3, 'morning']] as const) {
      const real = at(h);
      const s = sleepShift(real, to, null);
      expect(s.until).toBeGreaterThanOrEqual(real + MIN_SHIFT_MS);
      const r = clockMinutes(s.until) / 60;
      const m = clockMinutes(s.until + s.offset) / 60;
      expect(Math.abs(nightOf(r) - nightOf(m))).toBeLessThan(0.02);
      expect(Math.abs(glowOf(r) - glowOf(m))).toBeLessThan(0.1);
      // just before: the moved clock; from then on: the shared one
      expect(offsetAt(s.until - 1, s)).toBe(s.offset);
      expect(offsetAt(s.until, s)).toBe(0);
      expect(shownAt(s.until + 5000, s)).toBe(s.until + 5000);
    }
    // sleeping by day to the evening gives the learner the evening and the night before it rejoins
    const s = sleepShift(at(10), 'evening', null);
    expect((s.until - at(10)) / GAME_HOUR_MS).toBeGreaterThan(6);
    expect(rejoinAt(at(10), 0)).toBe(at(10) + MIN_SHIFT_MS);
  });

  it('two sleeps in a row: the second goes on from the clock as it shows', () => {
    const first = sleepShift(at(10), 'evening', null);
    const later = at(10) + SLEEP_EVERY_MS;
    expect(canSleep(first, later - 1)).toBe(false);
    expect(sleepWait(first, later - 1000)).toBe(1000);
    expect(canSleep(first, later)).toBe(true);
    const second = sleepShift(later, 'morning', first);
    expect(shownHour(later, second)).toBeCloseTo(6, 5);
    expect(second.offset).toBeGreaterThanOrEqual(0);
    expect(second.offset).toBeLessThan(GAME_DAY_MS);
  });
});

describe('what the clock moves, and what it never does', () => {
  it('the hour moves; the weather keeps the real time', () => {
    const real = at(10);
    const s = sleepShift(real, 'evening', null);
    const before = skyAt(real, 'rain');
    setShiftForTests(s);
    expect(gameNow(real)).toBe(real + s.offset);
    expect(gameHour(real)).toBeCloseTo(18, 5);
    const after = skyAt(real, 'rain');
    expect(after.hour).toBeCloseTo(18, 5);
    expect(after.mix).toEqual(before.mix);
    expect(after.sky).toBe(before.sky);
  });

  it('nothing counted per real day, and nothing that pays, moves with it', () => {
    const real = at(22, 9123);
    const day = townDay(real);
    const office = officeDay(real);
    const rest = markRested(emptyTownHideout(), real);
    setShiftForTests(sleepShift(real, 'morning', null));
    // the learner's real day: the daily tasks, allowances, a chapter a day, a date a day, xu a day
    expect(townDay(real)).toBe(day);
    // the office's word of the game day (it pays) and the hideout's rest of the hour (an allowance)
    expect(officeDay(real)).toBe(office);
    expect(canRest(true, rest, real + 1000)).toBe(false);
  });

  it('the phone\'s game day follows the clock as shown', () => {
    const real = at(22);
    const day = phoneDay(real);
    setShiftForTests(sleepShift(real, 'morning', null));
    expect(phoneDay(real)).toBe(day + 1);
  });

  it('a missed call\'s deadline is the game\'s: a sleep past it makes the call late', () => {
    const real = at(22);
    const d = callbackDeadline(real);
    const missed: PhoneEntry = { id: 'm', kind: 'missed', from: 'rico', at: real, jobId: 'job-x', status: 'new', deadline: d };
    expect(canCallBack(missed, real)).toBe(true);
    setShiftForTests(sleepShift(real, 'morning', null));
    expect(canCallBack(missed, real)).toBe(false);
    // and its offer comes back on the game day after the deadline, by the clock as shown
    expect(goneUntil(d.at)).toBeGreaterThan(d.at);
    expect(goneUntil(d.at) % GAME_DAY_MS).toBe(0);
  });

  it('Bay FM\'s forecast names times true of the clock the learner sees, never across the jump back', () => {
    const weathers: Weather[] = ['rain', 'cloudy', 'clear'];
    for (let k = 0; k < 40; k++) {
      const real = at(6 + (k % 12) + k * 0.37, 9000 + k);
      const s = sleepShift(real, sleepFor(clockMinutes(real) / 60), null);
      setShiftForTests(s);
      const weatherAt = () => weathers[k % 3];
      const fc = forecastAt(real, weatherAt, s);
      const skyOf = (t: number) => skyAt(t, weatherAt()).sky;
      let from = real;
      for (const c of fc.changes) {
        expect(c.at).toBeLessThan(s.until);
        expect(skyOf(c.at)).toBe(c.sky);
        // so from when it was first seen to the time named, on every five minutes of the clock
        for (let t = c.seen; t <= c.at; t += 5 * GAME_MINUTE_MS) expect(skyOf(t)).toBe(c.sky);
        // and not before it was seen
        for (let t = from + 5 * GAME_MINUTE_MS; t < c.seen - 1; t += 5 * GAME_MINUTE_MS) expect(skyOf(t)).toBe(c.was);
        from = c.at;
        // a time named on the clock as shown is a whole hour or a five-minute mark of it
        expect(Math.round(clockMinutes(c.at + s.offset)) % 5).toBe(0);
      }
      if (fc.stays !== null) expect(fc.stays).toBeLessThan(s.until + GAME_HOUR_MS);
    }
  });
});
