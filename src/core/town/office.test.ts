// The dispatch office's upgrades and the manager's word (./office.ts), and a shift set up by them (./dispatch.ts).
import { describe, expect, it } from 'vitest';
import { DISPATCH_CALLS } from '../../data/city/dispatch';
import { MANAGER_WORDS } from '../../data/city/dispatch/managerWords';
import { decode, speakableFor } from '../decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../decoder/sapiMisread';
import { CALL_TIMES, DRIVERS, pickShiftCalls, RING_LIMIT, SHIFT_CALLS, startShift, tick, answer, type DriverId, type Pt } from './dispatch';
import { owns, spentTotal, townItem } from './economy';
import { GAME_DAY_MS } from './sky';
import {
  FOURTH_DRIVER,
  gameDayOf,
  numberWords,
  OFFICE_TAKINGS_BASE,
  OFFICE_UPGRADES,
  officeTakings,
  ownedUpgrades,
  shiftSetup,
  TWO_LINE_TIMES,
  wordDue,
  wordId,
  wordNumbers,
  wordPay,
  WORDS_PAID_A_DAY,
} from './office';
import { emptyTownProgress } from './progress';

const pt = (x: number): Pt => ({ x, y: 0 });
const START: Record<DriverId, Pt> = { rico: pt(0), tess: pt(1), theo: pt(2), jas: pt(3) };
const MAP = { doors: Object.fromEntries(DISPATCH_CALLS.flatMap((c) => [[c.from, pt(5)], [c.to, pt(9)]])), start: START };

describe('the office’s upgrades', () => {
  it('without any, a shift is as it was: three cars, eight calls, one line', () => {
    const s = shiftSetup([]);
    expect(s.drivers).toEqual(DRIVERS);
    expect(s.calls).toBe(SHIFT_CALLS);
    expect(s.times).toBe(CALL_TIMES);
    expect(s.lines).toBe(1);
    expect(s.streetNames).toBe(false);
    expect(startShift(DISPATCH_CALLS.slice(0, 8), MAP).cars.map((c) => c.id)).toEqual(DRIVERS);
  });

  it('the fourth car, the second line, the better map', () => {
    const all = shiftSetup(OFFICE_UPGRADES.map((u) => u.id));
    expect(all.drivers).toContain(FOURTH_DRIVER);
    expect(all.calls).toBe(TWO_LINE_TIMES.length);
    expect(all.lines).toBe(2);
    expect(all.streetNames).toBe(true);
    const shift = startShift(pickShiftCalls(DISPATCH_CALLS, new Set(), 7, all.calls), MAP, { drivers: all.drivers, times: all.times, lines: all.lines });
    expect(shift.cars.map((c) => c.id)).toEqual([...DRIVERS, FOURTH_DRIVER]);
    expect(shift.calls).toHaveLength(10);
    expect(new Set(shift.calls.map((c) => c.call.id)).size).toBe(10);
    // closer together than one line's
    expect(TWO_LINE_TIMES[7]).toBeLessThan(CALL_TIMES[7]);
  });

  it('with two lines a call ringing while the other line is busy waits on hold; with one it goes to Bayline', () => {
    const calls = DISPATCH_CALLS.slice(0, 2);
    for (const lines of [1, 2] as const) {
      let s = startShift(calls, MAP, { times: [0, 0], lines });
      s = tick(s, 0.1, MAP.doors, (_a, b) => [b]).shift;
      s = answer(s, 0);
      for (let t = 0; t < RING_LIMIT + 10; t += 0.5) s = tick(s, 0.5, MAP.doors, (_a, b) => [b]).shift;
      expect(s.calls[1].state, `${lines} line(s)`).toBe(lines === 2 ? 'ringing' : 'stolen');
    }
  });

  it('bought as a store item of the town: its cost is spent, it is owned', () => {
    const p = { ...emptyTownProgress(), bought: ['office-map'] };
    expect(townItem('office-map')?.kind).toBe('office');
    expect(spentTotal(p)).toBe(OFFICE_UPGRADES[0].cost);
    expect(owns(p, 'office-map')).toBe(true);
    expect(owns(p, 'office-car4')).toBe(false);
    expect(ownedUpgrades(p.bought)).toEqual(['office-map']);
  });
});

describe('the manager’s word', () => {
  it('the takings grow with the upgrades; a misheard number loses part, never all', () => {
    expect(officeTakings([])).toBe(OFFICE_TAKINGS_BASE);
    expect(officeTakings(OFFICE_UPGRADES.map((u) => u.id))).toBe(OFFICE_TAKINGS_BASE + OFFICE_UPGRADES.reduce((n, u) => n + u.takings, 0));
    for (const t of [5, 9, 17]) {
      expect(wordPay(t, true)).toBe(t);
      expect(wordPay(t, false)).toBeLessThan(t);
      expect(wordPay(t, false)).toBeGreaterThan(0);
    }
  });

  it('once a game day, at most WORDS_PAID_A_DAY a real day', () => {
    const now = 1_800_000_000_000;
    const day = gameDayOf(now);
    expect(wordDue([], now)).toBe(true);
    expect(wordDue([wordId(day)], now)).toBe(false);
    const other = Array.from({ length: WORDS_PAID_A_DAY }, (_, i) => wordId(day - 1 - i));
    expect(wordDue(other, now)).toBe(false);
    expect(gameDayOf(now + GAME_DAY_MS)).toBe(day + 1);
  });

  it('the numbers: said in words, a "-teen" look-alike and a third, all different', () => {
    expect(numberWords(140)).toBe('a hundred and forty');
    expect(numberWords(114)).toBe('a hundred and fourteen');
    expect(numberWords(230)).toBe('two hundred and thirty');
    expect(numberWords(300)).toBe('three hundred');
    for (let d = 0; d < 400; d++) {
      const n = wordNumbers(d);
      expect(new Set([n.said, n.alike, n.other]).size).toBe(3);
      expect(n.said % 10).toBe(0);
      expect(Math.floor((n.said % 100) / 10)).toBeGreaterThanOrEqual(3);
      expect(n.alike).toBe(Math.floor(n.said / 100) * 100 + 10 + Math.floor((n.said % 100) / 10));
    }
  });

  it('every line, with every number, is plain English that decodes and is safe to speak', () => {
    for (const w of MANAGER_WORDS)
      for (let d = 0; d < 30; d++) {
        const text = w.text.replace('{n}', numberWords(wordNumbers(d).said));
        expect(text).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
        expect(decode(text).tokens.length).toBeGreaterThan(0);
        const said = speakableFor(text);
        expect(said, text).not.toMatch(SAPI_MISREAD);
        expect(said, text).not.toMatch(LONE_APOSTROPHE);
        expect(w.vi).toContain('{n}');
      }
  });
});
