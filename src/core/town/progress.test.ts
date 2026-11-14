import { describe, expect, it } from 'vitest';
import { placeLines } from '../../data/town';
import {
  addBought,
  addEarned,
  DAILY_KEEP_DAYS,
  DAILY_MAX_DAYS,
  dailyCount,
  DAYS_KEEP,
  daysBefore,
  earnedTotal,
  emptyDailyCount,
  emptyTownProgress,
  hasBought,
  isUnderstood,
  lineProgress,
  linesStats,
  mergeTownProgress,
  parseTownProgress,
  recordLine,
  townDay,
  updateDaily,
  type TownProgress,
} from './progress';
import type { LineOutcome } from './types';

const T = 1_800_000_000_000;
const EMPTY = { version: 2, lines: {}, earned: {}, bought: [], daily: {}, days: [] };
const make = (p: Partial<TownProgress>): TownProgress => ({ ...emptyTownProgress(), ...p });
/** 'YYYY-MM-DD' `n` days after 2026-11-01. */
const dayN = (n: number): string => daysBefore('2026-11-01', -n);

describe('parseTownProgress', () => {
  it('reads junk as empty', () => {
    for (const junk of [null, undefined, 3, 'x', [], { lines: [] }, { lines: 'x' }, { version: 9 }, { earned: 5, bought: 'cafe', daily: [], days: {} }]) {
      expect(parseTownProgress(junk)).toEqual(EMPTY);
    }
  });

  it('reads the lines of a stored value: clamped, floored, sorted, unknown fields dropped', () => {
    const p = parseTownProgress({
      version: 7,
      extra: true,
      lines: {
        s002: { best: 2, tries: 3, at: T, more: 1 },
        s001: { best: 1, tries: 1, at: T + 1 },
        s003: { best: 9, tries: 2.9, at: 'no' }, // clamped, floored, time unknown
        s004: { best: 1 }, // understood implies at least one try
        s005: { best: 0, tries: 2, at: T },
        s006: { best: -1, tries: 0 }, // never answered
        s007: null,
        s008: 'x',
        s009: [1, 2],
        s010: { best: Number.NaN, tries: Number.POSITIVE_INFINITY },
        '': { best: 1, tries: 1, at: T },
        ['x'.repeat(201)]: { best: 1, tries: 1, at: T },
      },
    });
    expect(p.lines).toEqual({
      s001: { best: 1, tries: 1, at: T + 1 },
      s002: { best: 2, tries: 3, at: T },
      s003: { best: 2, tries: 2, at: 0 },
      s004: { best: 1, tries: 1, at: 0 },
      s005: { best: 0, tries: 2, at: T },
    });
    expect(Object.keys(p.lines)).toEqual(['s001', 's002', 's003', 's004', 's005']); // sorted: stable JSON
    expect(parseTownProgress(p)).toEqual(p);
  });

  it('a version 1 value loads: the same lines, nothing earned or bought', () => {
    const v1 = { version: 1, lines: { s001: { best: 2, tries: 1, at: T }, s002: { best: 0, tries: 3, at: T + 5 } } };
    expect(parseTownProgress(v1)).toEqual({ ...EMPTY, lines: v1.lines });
  });

  it('reads xu, purchases, daily counters and days defensively', () => {
    const p = parseTownProgress({
      version: 2,
      lines: {},
      earned: { 'd-aaaa0001': 12.9, 'd-bbbb0002': -4, 'd-cccc0003': 'x', bad: 5, 'BAD-DEVICE': 5, 'd-dddd0004': 1e12, constructor: 9 },
      bought: ['shop', 'home', 'shop', 7, null, 'Not Ok', '', 'lamps1', 'constructor', 'x'.repeat(41)],
      daily: {
        '2026-11-13': {
          'd-aaaa0001': { talks: 2.7, lines: 9, first: 4, met: ['cafe', 'square', 'cafe', 5], paid: ['lines', 'first', 'lines'], junk: 1 },
          'd-bbbb0002': { talks: 0, lines: 0, first: 0, met: [], paid: [] }, // nothing: dropped
          'no good': { lines: 3 },
          'd-cccc0003': 'x',
        },
        '2026-11-12': { 'd-aaaa0001': { lines: -3, first: 'x' } }, // nothing left: the day is dropped
        'not-a-day': { 'd-aaaa0001': { lines: 3 } },
        '2026-11-10': [1, 2],
      },
      days: ['2026-11-13', '2026-11-10', '2026-11-13', 'tomorrow', 5, '2026-1-1'],
    });
    expect(p).toEqual({
      version: 2,
      lines: {},
      earned: { 'd-aaaa0001': 12, 'd-dddd0004': 10_000_000 },
      bought: ['home', 'lamps1', 'shop'],
      daily: { '2026-11-13': { 'd-aaaa0001': { talks: 2, lines: 9, first: 4, met: ['cafe', 'square'], paid: ['first', 'lines'] } } },
      days: ['2026-11-10', '2026-11-13'],
    });
    expect(parseTownProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('keeps only the newest days: DAILY_MAX_DAYS of counters, DAYS_KEEP active days', () => {
    const daily = Object.fromEntries(Array.from({ length: DAILY_MAX_DAYS + 5 }, (_, i) => [dayN(i), { 'd-aaaa0001': { lines: 1 } }]));
    const days = Array.from({ length: DAYS_KEEP + 7 }, (_, i) => dayN(i));
    const p = parseTownProgress({ daily, days });
    expect(Object.keys(p.daily)).toHaveLength(DAILY_MAX_DAYS);
    expect(Object.keys(p.daily)[0]).toBe(dayN(5));
    expect(p.days).toHaveLength(DAYS_KEEP);
    expect(p.days[0]).toBe(dayN(7));
    expect(p.days[DAYS_KEEP - 1]).toBe(dayN(DAYS_KEEP + 6));
  });

  it('never takes __proto__ / constructor / prototype as keys', () => {
    const raw = JSON.parse(
      '{"lines":{"__proto__":{"best":2,"tries":1,"at":5},"constructor":{"best":2,"tries":1,"at":5},"prototype":{"best":1,"tries":1,"at":5},"s001":{"best":1,"tries":1,"at":5}},' +
        '"earned":{"__proto__":5,"constructor":5,"prototype":5},"daily":{"2026-11-13":{"constructor":{"lines":3},"__proto__":{"lines":3}}}}',
    );
    const p = parseTownProgress(raw);
    expect(Object.keys(p.lines)).toEqual(['s001']);
    expect(p.earned).toEqual({});
    expect(p.daily).toEqual({});
    expect(({} as Record<string, unknown>).best).toBeUndefined();
    expect(lineProgress(p, 'constructor')).toBeUndefined();
    expect(isUnderstood(p, 'toString')).toBe(false);
    expect(earnedTotal(p)).toBe(0);
    expect(dailyCount(p, '2026-11-13', 'constructor')).toEqual(emptyDailyCount());
  });
});

describe('recordLine', () => {
  it('counts tries, keeps the best outcome and never changes its input', () => {
    const p0 = emptyTownProgress();
    const p1 = recordLine(p0, 's001', 'wrong', T);
    expect(p0).toEqual(EMPTY);
    expect(p1.lines.s001).toEqual({ best: 0, tries: 1, at: T });
    expect(isUnderstood(p1, 's001')).toBe(false);
    const p2 = recordLine(p1, 's001', 'replayed', T + 10);
    expect(p2.lines.s001).toEqual({ best: 1, tries: 2, at: T + 10 });
    expect(p1.lines.s001).toEqual({ best: 0, tries: 1, at: T });
    expect(isUnderstood(p2, 's001')).toBe(true);
    const p3 = recordLine(p2, 's001', 'first', T + 20);
    expect(p3.lines.s001).toEqual({ best: 2, tries: 3, at: T + 20 });
    // understood again with replays: still best 2, the time moves on
    expect(recordLine(p3, 's001', 'replayed', T + 30).lines.s001).toEqual({ best: 2, tries: 4, at: T + 30 });
  });

  it('touches the lines only: xu, purchases and days are carried over as they are', () => {
    const p = make({ earned: { 'd-aaaa0001': 9 }, bought: ['home'], days: ['2026-11-13'] });
    const q = recordLine(p, 's001', 'first', T);
    expect(q).toMatchObject({ version: 2, earned: p.earned, bought: p.bought, daily: {}, days: p.days });
    expect(q.earned).toBe(p.earned);
  });

  it('a wrong answer never lowers best, and leaves the time of a line already understood', () => {
    const p = recordLine(recordLine(emptyTownProgress(), 's001', 'first', T), 's001', 'wrong', T + 50);
    expect(p.lines.s001).toEqual({ best: 2, tries: 2, at: T });
    // not understood yet: the time is the last try
    const q = recordLine(recordLine(emptyTownProgress(), 's002', 'wrong', T), 's002', 'wrong', T + 50);
    expect(q.lines.s002).toEqual({ best: 0, tries: 2, at: T + 50 });
  });

  it('time never goes back (a machine with a slow clock) and bad input changes nothing', () => {
    const p = recordLine(emptyTownProgress(), 's001', 'first', T);
    expect(recordLine(p, 's001', 'first', T - 1000).lines.s001.at).toBe(T);
    expect(recordLine(p, 's001', 'first', Number.NaN).lines.s001).toEqual({ best: 2, tries: 2, at: T });
    for (const bad of ['', '__proto__', 'constructor', 'x'.repeat(201)]) expect(recordLine(p, bad, 'first', T)).toBe(p);
    expect(recordLine(p, 's002', 'bogus' as LineOutcome, T).lines.s002).toEqual({ best: 0, tries: 1, at: T });
  });
});

describe('xu and purchases', () => {
  it('addEarned grows one device bucket; the total is the sum of all buckets', () => {
    const p0 = emptyTownProgress();
    const p1 = addEarned(addEarned(p0, 'd-aaaa0001', 3), 'd-aaaa0001', 2);
    const p2 = addEarned(p1, 'd-bbbb0002', 10);
    expect(p0.earned).toEqual({});
    expect(p2.earned).toEqual({ 'd-aaaa0001': 5, 'd-bbbb0002': 10 });
    expect(earnedTotal(p2)).toBe(15);
    expect(earnedTotal(p0)).toBe(0);
  });

  it('addEarned ignores nothing-to-add, negative or junk amounts and bad devices', () => {
    const p = addEarned(emptyTownProgress(), 'd-aaaa0001', 4);
    for (const xu of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 0.4]) expect(addEarned(p, 'd-aaaa0001', xu)).toBe(p);
    for (const dev of ['', 'x', 'Has Space', '__proto__', 'constructor']) expect(addEarned(p, dev, 3)).toBe(p);
    expect(addEarned(p, 'd-aaaa0001', 2.9).earned['d-aaaa0001']).toBe(6);
  });

  it('addBought is a sorted set; a bad id or one already there changes nothing', () => {
    const p1 = addBought(addBought(emptyTownProgress(), 'shop'), 'home');
    expect(p1.bought).toEqual(['home', 'shop']);
    expect(hasBought(p1, 'home')).toBe(true);
    expect(hasBought(p1, 'park')).toBe(false);
    expect(addBought(p1, 'home')).toBe(p1);
    for (const bad of ['', 'Has Space', '9lives', '__proto__', 'constructor', 'x'.repeat(41)]) expect(addBought(p1, bad)).toBe(p1);
  });
});

describe('updateDaily', () => {
  const DEV = 'd-aaaa0001';

  it('changes the counters of one day and device and notes the day as active', () => {
    const p1 = updateDaily(emptyTownProgress(), '2026-11-13', DEV, (c) => ({ ...c, lines: c.lines + 1, met: [...c.met, 'cafe'] }));
    expect(p1.daily).toEqual({ '2026-11-13': { [DEV]: { talks: 0, lines: 1, first: 0, met: ['cafe'], paid: [] } } });
    expect(p1.days).toEqual(['2026-11-13']);
    const p2 = updateDaily(p1, '2026-11-13', 'd-bbbb0002', (c) => ({ ...c, first: 2 }));
    expect(dailyCount(p2, '2026-11-13', DEV)).toEqual({ talks: 0, lines: 1, first: 0, met: ['cafe'], paid: [] });
    expect(dailyCount(p2, '2026-11-13', 'd-bbbb0002')).toMatchObject({ first: 2 });
    expect(dailyCount(p2, '2026-11-14', DEV)).toEqual(emptyDailyCount());
    expect(p1.daily['2026-11-13']).not.toHaveProperty('d-bbbb0002'); // the input is not changed
  });

  it('counters never go down and sets never lose a member, whatever the change returns', () => {
    const p1 = updateDaily(emptyTownProgress(), '2026-11-13', DEV, () => ({ talks: 2, lines: 5, first: 3, met: ['cafe', 'square'], paid: ['lines'] }));
    const p2 = updateDaily(p1, '2026-11-13', DEV, () => ({ talks: 0, lines: 1, first: 9, met: ['friend'], paid: [] }));
    expect(dailyCount(p2, '2026-11-13', DEV)).toEqual({ talks: 2, lines: 5, first: 9, met: ['cafe', 'friend', 'square'], paid: ['lines'] });
  });

  it('a change that counts nothing still makes the day active, without a row of zeros', () => {
    const p = updateDaily(emptyTownProgress(), '2026-11-13', DEV, (c) => c);
    expect(p.daily).toEqual({});
    expect(p.days).toEqual(['2026-11-13']);
    expect(parseTownProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it(`keeps the ${DAILY_KEEP_DAYS} days up to the day written (and the day after), drops the rest`, () => {
    let p = emptyTownProgress();
    for (let i = 0; i < 20; i++) p = updateDaily(p, dayN(i), DEV, (c) => ({ ...c, lines: 1 }));
    expect(Object.keys(p.daily)).toEqual(Array.from({ length: DAILY_KEEP_DAYS }, (_, i) => dayN(6 + i)));
    expect(p.days).toHaveLength(20); // the streak keeps its days
    // days written by a machine with a wrong clock: tomorrow may be another time zone, later is dropped
    const odd = make({ daily: { [dayN(21)]: { [DEV]: { ...emptyDailyCount(), lines: 4 } }, [dayN(60)]: { [DEV]: { ...emptyDailyCount(), lines: 4 } } } });
    const q = updateDaily(odd, dayN(20), DEV, (c) => ({ ...c, lines: 1 }));
    expect(Object.keys(q.daily)).toEqual([dayN(20), dayN(21)]);
  });

  it('a bad day or device changes nothing', () => {
    const p = emptyTownProgress();
    expect(updateDaily(p, 'today', DEV, (c) => ({ ...c, lines: 1 }))).toBe(p);
    expect(updateDaily(p, '2026-11-13', 'constructor', (c) => ({ ...c, lines: 1 }))).toBe(p);
    expect(updateDaily(p, '2026-11-13', '', (c) => ({ ...c, lines: 1 }))).toBe(p);
  });

  it('townDay / daysBefore use local days, across a month and a daylight-saving change', () => {
    expect(townDay(new Date(2026, 10, 13, 23, 59).getTime())).toBe('2026-11-13');
    expect(townDay(new Date(2026, 10, 14, 0, 0).getTime())).toBe('2026-11-14');
    expect(daysBefore('2026-11-01', 1)).toBe('2026-10-31');
    expect(daysBefore('2026-03-09', 1)).toBe('2026-03-08');
    expect(daysBefore('2026-03-08', -1)).toBe('2026-03-09');
    expect(daysBefore('2027-01-01', 1)).toBe('2026-12-31');
    expect(daysBefore('2026-11-13', 0)).toBe('2026-11-13');
  });
});

describe('mergeTownProgress', () => {
  it('lines: union, the max of every field', () => {
    const a = make({ lines: { s001: { best: 1, tries: 5, at: 10 }, s002: { best: 2, tries: 1, at: 30 } } });
    const b = make({ lines: { s001: { best: 2, tries: 2, at: 20 }, s003: { best: 0, tries: 1, at: 5 } } });
    const m = mergeTownProgress(a, b);
    expect(m).toEqual({ ...EMPTY, lines: { s001: { best: 2, tries: 5, at: 20 }, s002: { best: 2, tries: 1, at: 30 }, s003: { best: 0, tries: 1, at: 5 } } });
    expect(mergeTownProgress(b, a)).toEqual(m);
    expect(mergeTownProgress(m, a)).toEqual(m);
    expect(m.lines.s002).not.toBe(a.lines.s002); // copies, not shared objects
  });

  it('xu: max per device, so xu earned on two machines add up and nothing is counted twice', () => {
    const laptop = make({ earned: { 'd-laptop01': 30, 'd-phone001': 8 } }); // has an older copy of the phone
    const phone = make({ earned: { 'd-laptop01': 12, 'd-phone001': 20 } });
    const m = mergeTownProgress(laptop, phone);
    expect(m.earned).toEqual({ 'd-laptop01': 30, 'd-phone001': 20 });
    expect(earnedTotal(m)).toBe(50);
    expect(mergeTownProgress(m, laptop)).toEqual(m);
    expect(mergeTownProgress(phone, laptop)).toEqual(m);
  });

  it('purchases: a union; daily: max of counters and union of sets per day and device; days: a union', () => {
    const a = make({
      bought: ['home', 'lamps1'],
      daily: {
        '2026-11-13': { 'd-aaaa0001': { talks: 1, lines: 6, first: 2, met: ['cafe'], paid: [] } },
        '2026-11-12': { 'd-aaaa0001': { talks: 2, lines: 8, first: 4, met: ['cafe', 'square'], paid: ['first', 'lines', 'talk'] } },
      },
      days: ['2026-11-12', '2026-11-13'],
    });
    const b = make({
      bought: ['shop', 'home'],
      daily: {
        '2026-11-13': {
          'd-aaaa0001': { talks: 2, lines: 4, first: 3, met: ['square'], paid: ['talk'] },
          'd-bbbb0002': { talks: 0, lines: 1, first: 0, met: [], paid: [] },
        },
      },
      days: ['2026-11-11', '2026-11-13'],
    });
    const m = mergeTownProgress(a, b);
    expect(m.bought).toEqual(['home', 'lamps1', 'shop']);
    expect(m.daily).toEqual({
      '2026-11-12': a.daily['2026-11-12'],
      '2026-11-13': {
        'd-aaaa0001': { talks: 2, lines: 6, first: 3, met: ['cafe', 'square'], paid: ['talk'] },
        'd-bbbb0002': { talks: 0, lines: 1, first: 0, met: [], paid: [] },
      },
    });
    expect(m.days).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
    expect(mergeTownProgress(b, a)).toEqual(m);
    expect(mergeTownProgress(m, m)).toEqual(m);
    expect(mergeTownProgress(mergeTownProgress(a, m), b)).toEqual(m);
  });

  it('a version 1 copy merges with a version 2 copy', () => {
    const v1 = parseTownProgress({ version: 1, lines: { s001: { best: 2, tries: 1, at: 100 } } });
    const v2 = make({ lines: { s001: { best: 1, tries: 3, at: 50 } }, earned: { 'd-aaaa0001': 7 }, bought: ['home'] });
    const m = mergeTownProgress(v1, v2);
    expect(m).toEqual({ ...EMPTY, lines: { s001: { best: 2, tries: 3, at: 100 } }, earned: { 'd-aaaa0001': 7 }, bought: ['home'] });
    expect(mergeTownProgress(v2, v1)).toEqual(m);
  });
});

describe('counts', () => {
  it('over a list of lines; records of lines that no longer exist do not count', () => {
    const [l1, l2, l3] = placeLines('cafe');
    const p = make({
      lines: {
        [l1.id]: { best: 2, tries: 1, at: T },
        [l2.id]: { best: 1, tries: 3, at: T },
        [l3.id]: { best: 0, tries: 2, at: T },
        gone: { best: 2, tries: 1, at: T },
      },
    });
    expect(linesStats(p, placeLines('cafe'))).toEqual({ total: placeLines('cafe').length, understood: 2, first: 1 });
    expect(linesStats(p, placeLines('square'))).toEqual({ total: placeLines('square').length, understood: 0, first: 0 });
    expect(linesStats(p, [])).toEqual({ total: 0, understood: 0, first: 0 });
  });
});
