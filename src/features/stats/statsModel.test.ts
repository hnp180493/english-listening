import { describe, expect, it } from 'vitest';
import type { Attempt } from '../../core/stats';
import {
  accuracyLast7Days,
  forecastBars,
  withTodayCount,
  forecastLabel,
  moduleLabel,
  recentAttempts,
  relativeTimeVi,
  validAttempts,
  weaknessReport,
} from './statsModel';

const NOW = new Date(2026, 10, 5, 15, 0, 0).getTime(); // 05/11/2026 15:00 local
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function att(over: Partial<Attempt>): Attempt {
  return { at: NOW, module: 'dictation', itemId: 's001', correct: true, seen: [], missed: [], ...over };
}

describe('weaknessReport', () => {
  it('ranks phenomena with seen >= 3 by miss rate, worst first', () => {
    const r = weaknessReport({
      linking: { seen: 10, missed: 2 },
      elision: { seen: 4, missed: 3 },
      'flap-t': { seen: 2, missed: 2 },
    });
    expect(r.ranked.map((x) => x.phenomenon)).toEqual(['elision', 'linking']);
    expect(r.ranked[0].rate).toBeCloseTo(0.75);
    expect(r.insufficient[0].phenomenon).toBe('flap-t');
    expect(r.insufficient).toHaveLength(6);
  });
  it('handles empty input', () => {
    const r = weaknessReport({});
    expect(r.ranked).toEqual([]);
    expect(r.insufficient).toHaveLength(8);
  });
});

describe('accuracy and today counts', () => {
  it('computes 7-day accuracy, ignoring older attempts', () => {
    const a = [att({ correct: true }), att({ correct: false }), att({ correct: true, at: NOW - 8 * DAY })];
    expect(accuracyLast7Days(a, NOW)).toEqual({ pct: 50, total: 2 });
    expect(accuracyLast7Days([], NOW)).toEqual({ pct: null, total: 0 });
  });
});

describe('relativeTimeVi', () => {
  it('formats Vietnamese relative times', () => {
    expect(relativeTimeVi(NOW - 10_000, NOW)).toBe('vừa xong');
    expect(relativeTimeVi(NOW - 5 * MIN, NOW)).toBe('5 phút trước');
    expect(relativeTimeVi(NOW - 3 * 60 * MIN, NOW)).toBe('3 giờ trước');
    expect(relativeTimeVi(NOW - DAY, NOW)).toBe('hôm qua');
    expect(relativeTimeVi(NOW - 4 * DAY, NOW)).toBe('4 ngày trước');
    expect(relativeTimeVi(NOW - 14 * DAY, NOW)).toBe('2 tuần trước');
  });
});

describe('misc', () => {
  it('filters malformed attempts and sorts recent', () => {
    const a = validAttempts([att({ at: 1 }), null, { foo: 1 }, att({ at: 3 }), att({ at: 2 })]);
    expect(a).toHaveLength(3);
    expect(recentAttempts(a, 2).map((x) => x.at)).toEqual([3, 2]);
    expect(validAttempts(undefined)).toEqual([]);
  });
  it('drops attempts from unknown modules and labels known ones', () => {
    const a = validAttempts([att({ module: 'bogus' as Attempt['module'] }), att({ module: 'media' }), att({ module: 'constructor' as Attempt['module'] })]);
    expect(a.map((x) => x.module)).toEqual(['media']);
    expect(moduleLabel('shadowing')).toBe('Nói nhại');
    expect(moduleLabel('zzz')).toBe('zzz');
    expect(moduleLabel('constructor')).toBe('constructor');
  });
});

describe('local-date edge cases', () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
  it('7-day accuracy uses local calendar days (today + 6 before)', () => {
    const now = at(5, 0, 5); // 00:05 local
    const a = [
      att({ at: new Date(2026, 9, 30, 0, 30).getTime(), correct: false }), // 30/10 00:30, 6 days before 05/11: included
      att({ at: new Date(2026, 9, 29, 23, 59).getTime(), correct: true }), // 29/10 23:59: excluded
      att({ at: at(5, 0, 1), correct: true }),
    ];
    expect(accuracyLast7Days(a, now)).toEqual({ pct: 50, total: 2 });
  });
  it('relative time across midnight', () => {
    expect(relativeTimeVi(at(4, 23, 50), at(5, 0, 10))).toBe('20 phút trước');
    expect(relativeTimeVi(at(4, 22, 0), at(5, 0, 30))).toBe('hôm qua');
    expect(relativeTimeVi(at(5, 9, 0), at(5, 9, 0) - 5000)).toBe('vừa xong'); // future clock skew
    expect(relativeTimeVi(new Date(2026, 8, 1, 10).getTime(), at(5, 10))).toBe('01/09/2026');
  });
});

describe('robustness', () => {
  it('repairs or drops malformed attempt fields', () => {
    const a = validAttempts([
      { at: 1, module: { x: 1 }, itemId: 's1', correct: true, seen: [], missed: [] },
      { at: 2, module: 'drill', itemId: { y: 1 }, correct: 'yes', seen: ['linking', 'bogus'], missed: null },
    ]);
    expect(a).toEqual([{ at: 2, module: 'drill', itemId: '', correct: false, seen: ['linking'], missed: [] }]);
  });
  it('never divides by zero in weakness report', () => {
    const r = weaknessReport({ linking: { seen: 0, missed: 5 }, elision: { seen: 3, missed: 9 } });
    expect(r.ranked[0]).toMatchObject({ phenomenon: 'elision', rate: 1, missed: 3 });
    expect(r.insufficient.find((x) => x.phenomenon === 'linking')?.rate).toBe(0);
  });
});

describe('forecastLabel / forecastBars', () => {
  // 05/11/2026 is a Thursday.
  it('labels today, tomorrow, then weekdays', () => {
    expect(forecastLabel('2026-11-05', 0)).toEqual({ short: 'Hôm nay', long: 'Hôm nay' });
    expect(forecastLabel('2026-11-06', 1)).toEqual({ short: 'Mai', long: 'Ngày mai' });
    expect(forecastLabel('2026-11-07', 2)).toEqual({ short: 'T7', long: 'Thứ Bảy' });
    expect(forecastLabel('2026-11-08', 3)).toEqual({ short: 'CN', long: 'Chủ Nhật' });
    expect(forecastLabel('2026-11-09', 4)).toEqual({ short: 'T2', long: 'Thứ Hai' });
    expect(forecastLabel('junk', 5)).toEqual({ short: 'junk', long: 'junk' });
  });

  it('scales bars to the busiest day and rounds minutes up', () => {
    const days = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'].map(
      (day, offset) => ({ day, offset, count: [20, 5, 0, 1, 10, 0, 2][offset], seconds: [800, 61, 0, 12, 400, 0, 90][offset] }),
    );
    const bars = forecastBars(days);
    expect(bars.map((b) => b.label)).toEqual(['Hôm nay', 'Mai', 'T7', 'CN', 'T2', 'T3', 'T4']);
    expect(bars.map((b) => b.pct)).toEqual([100, 25, 0, 6, 50, 0, 10]);
    expect(bars.map((b) => b.minutes)).toEqual([14, 2, 0, 1, 7, 0, 2]);
    expect(bars[0].isToday).toBe(true);
    expect(bars[1].isToday).toBe(false);
  });

  it("sets today's bar to the badge's number and leaves the other days alone", () => {
    const days = [
      { day: '2026-11-05', offset: 0, count: 6, seconds: 300 }, // includes a card due later today
      { day: '2026-11-06', offset: 1, count: 4, seconds: 120 },
    ];
    const out = withTodayCount(days, { count: 5, seconds: 260 });
    expect(out[0]).toEqual({ day: '2026-11-05', offset: 0, count: 5, seconds: 260 });
    expect(out[1]).toBe(days[1]);
    expect(days[0].count).toBe(6); // input untouched
  });

  it('is empty-safe', () => {
    expect(forecastBars([])).toEqual([]);
    const bars = forecastBars([{ day: '2026-11-05', offset: 0, count: Number.NaN, seconds: -5 }]);
    expect(bars[0]).toMatchObject({ count: 0, minutes: 0, pct: 0 });
  });
});
