import { describe, expect, it } from 'vitest';
import { localDay, type Attempt } from '../../core/stats';
import type { LessonMeta } from '../../core/lessons';
import {
  activityHeatmap,
  attemptsTodayCount,
  heatCellText,
  heatLevel,
  historyInfo,
  lessonIdFor,
  lessonSummary,
  longestStreak,
  mergeActiveDays,
  moduleBreakdown,
  moveHeatFocus,
  sanitizeGoal,
  startOfLocalWeek,
  trendDelta,
  trendPoints,
  weakestPhenomenon,
  weekKey,
  weeklyAccuracy,
} from './progressModel';
import { weaknessReport } from './statsModel';

const NOW = new Date(2026, 10, 5, 15, 0, 0).getTime(); // Thu 05/11/2026 15:00 local
const DAY = 24 * 60 * 60 * 1000;
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

function att(over: Partial<Attempt>): Attempt {
  return { at: NOW, module: 'dictation', itemId: 's001', correct: true, seen: [], missed: [], ...over };
}

describe('week bucketing', () => {
  it('starts weeks on local Monday 00:00', () => {
    expect(startOfLocalWeek(NOW)).toBe(at(2026, 11, 2, 0));
    expect(startOfLocalWeek(at(2026, 11, 2, 0, 0))).toBe(at(2026, 11, 2, 0));
    expect(startOfLocalWeek(at(2026, 11, 8, 23, 59))).toBe(at(2026, 11, 2, 0)); // Sunday belongs to the week before
    expect(startOfLocalWeek(at(2026, 11, 9, 0, 0))).toBe(at(2026, 11, 9, 0));
  });

  it('keys weeks across the year boundary by their Monday', () => {
    expect(weekKey(at(2026, 1, 1))).toBe('2025-12-29'); // Thu 1 Jan 2026
    expect(weekKey(at(2026, 1, 4, 23, 59))).toBe('2025-12-29'); // Sun 4 Jan
    expect(weekKey(at(2025, 12, 29, 0, 0))).toBe('2025-12-29');
    expect(weekKey(at(2026, 1, 5, 0, 0))).toBe('2026-01-05');
  });

  it('builds 8 weekly buckets ending with the current week', () => {
    const weeks = weeklyAccuracy(
      [
        att({ correct: true }),
        att({ correct: false, at: at(2026, 11, 2, 0, 1) }),
        att({ correct: true, at: at(2026, 11, 1, 23, 59) }), // previous week (Sunday)
        att({ at: at(2026, 9, 1) }), // too old
        att({ at: NOW + 30 * DAY }), // future: ignored
      ],
      NOW,
    );
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toMatchObject({ key: '2026-11-02', label: '02/11', rangeLabel: '02/11 – 08/11', total: 2, correct: 1, pct: 50, isCurrent: true });
    expect(weeks[6]).toMatchObject({ key: '2026-10-26', total: 1, pct: 100, isCurrent: false });
    expect(weeks[0].key).toBe('2026-09-14');
    expect(weeks.slice(0, 6).every((w) => w.pct === null && w.total === 0)).toBe(true);
  });

  it('groups attempts on both sides of New Year into one week', () => {
    const now = at(2026, 1, 14, 9);
    const weeks = weeklyAccuracy(
      [att({ at: at(2025, 12, 31, 22), correct: false }), att({ at: at(2026, 1, 2, 8) }), att({ at: at(2026, 1, 3) })],
      now,
    );
    const ny = weeks.find((w) => w.key === '2025-12-29');
    expect(ny).toMatchObject({ total: 3, correct: 2, pct: 67, rangeLabel: '29/12 – 04/01' });
    expect(weeks[0].key).toBe('2025-11-24');
    expect(weeks[7].key).toBe('2026-01-12');
  });
});

describe('trend', () => {
  const box = { width: 300, height: 120, left: 30, right: 10, top: 10, bottom: 10 };
  it('plots only weeks with data', () => {
    const weeks = weeklyAccuracy([att({}), att({ at: NOW - 14 * DAY, correct: false })], NOW);
    const pts = trendPoints(weeks, box);
    expect(pts.map((p) => p.index)).toEqual([5, 7]);
    expect(pts[1]).toEqual({ index: 7, x: 290, y: 10, pct: 100 });
    expect(pts[0]).toMatchObject({ x: 215.7, y: 110, pct: 0 });
  });
  it('computes the change between the last two weeks with data', () => {
    const weeks = weeklyAccuracy(
      [att({ correct: false }), att({}), att({ at: NOW - 21 * DAY, correct: false })],
      NOW,
    );
    expect(trendDelta(weeks)).toBe(50);
    expect(trendDelta(weeklyAccuracy([att({})], NOW))).toBeNull();
  });
});

describe('moduleBreakdown', () => {
  it('splits attempts per module for the last 7 days and all time', () => {
    const rows = moduleBreakdown(
      [
        att({ module: 'pairs', correct: true }),
        att({ module: 'pairs', correct: false }),
        att({ module: 'pairs', correct: true, at: NOW - 10 * DAY }),
        att({ module: 'dictation', correct: false, at: NOW - 6 * DAY }),
        att({ module: 'bogus' as Attempt['module'] }),
      ],
      NOW,
    );
    expect(rows[0]).toMatchObject({ module: 'pairs', label: 'Phân biệt âm', route: 'pairs' });
    expect(rows[0].week).toEqual({ total: 2, correct: 1, pct: 50 });
    expect(rows[0].all).toEqual({ total: 3, correct: 2, pct: 67 });
    expect(rows[1]).toMatchObject({ module: 'dictation', week: { total: 1, correct: 0, pct: 0 } });
    expect(rows[0].lastAt).toBe(NOW);
  });
  it('lists untouched modules after practised ones, without the unscored decoder', () => {
    const rows = moduleBreakdown([att({ module: 'media' })], NOW);
    expect(rows.map((r) => r.module)).toEqual(['media', 'dictation', 'drill', 'lesson', 'pairs', 'shadowing', 'town']);
    expect(rows[1]).toMatchObject({ all: { total: 0, correct: 0, pct: null }, lastAt: null });
    expect(rows.find((r) => r.module === 'lesson')?.route).toBe('lessons');
  });
  it('shows the decoder once it has data', () => {
    const rows = moduleBreakdown([att({ module: 'decoder' })], NOW);
    expect(rows[0].module).toBe('decoder');
    expect(rows).toHaveLength(8);
  });
  it('Thị trấn is a module like the others: its own row, label and page', () => {
    const rows = moduleBreakdown([att({ module: 'town' }), att({ module: 'town', correct: false })], NOW);
    expect(rows[0]).toMatchObject({ module: 'town', label: 'Thị trấn', route: 'town', all: { total: 2, correct: 1, pct: 50 } });
  });
});

describe('activityHeatmap', () => {
  it('aligns 12 columns to weekdays with Monday first, ending this week', () => {
    const h = activityHeatmap([], NOW);
    expect(h.columns).toHaveLength(12);
    for (const col of h.columns) {
      expect(col.cells).toHaveLength(7);
      const [y, m, d] = col.cells[0].day.split('-').map(Number);
      expect(new Date(y, m - 1, d).getDay()).toBe(1); // Monday
      expect(col.cells.map((c) => c.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
    const last = h.columns[11];
    expect(last.key).toBe('2026-11-02');
    expect(last.cells[3]).toMatchObject({ day: '2026-11-05', isToday: true, future: false });
    expect(last.cells.slice(4).every((c) => c.future)).toBe(true);
    expect(h.columns[0].key).toBe('2026-08-17');
    expect(h.firstDay).toBe('2026-08-17');
    expect(h.lastDay).toBe('2026-11-05');
  });
  it('has 84 distinct consecutive days', () => {
    const days = activityHeatmap([], NOW).columns.flatMap((c) => c.cells.map((x) => x.day));
    expect(new Set(days).size).toBe(84);
    for (let i = 1; i < days.length; i++) {
      const [y, m, d] = days[i - 1].split('-').map(Number);
      expect(localDay(new Date(y, m - 1, d + 1, 12).getTime())).toBe(days[i]);
    }
  });
  it('counts attempts per local day and scales levels to the busiest day', () => {
    const list = [
      ...Array.from({ length: 8 }, () => att({ at: at(2026, 11, 4, 9) })),
      att({ at: at(2026, 11, 3, 23, 59), correct: false }),
      att({ at: at(2026, 11, 5, 0, 0) }),
      att({ at: at(2026, 1, 1) }), // outside the window
    ];
    const h = activityHeatmap(list, NOW);
    const last = h.columns[11].cells;
    expect(last[2]).toMatchObject({ day: '2026-11-04', count: 8, correct: 8, level: 4 });
    expect(last[1]).toMatchObject({ day: '2026-11-03', count: 1, correct: 0, level: 1 });
    expect(last[0]).toMatchObject({ count: 0, level: 0 });
    expect(h).toMatchObject({ total: 10, activeDays: 3, max: 8 });
  });
  it('labels month starts and handles a year boundary', () => {
    const h = activityHeatmap([], at(2027, 1, 6)); // Wed 6 Jan 2027
    expect(h.columns[11].key).toBe('2027-01-04');
    const jan = h.columns.find((c) => c.cells.some((x) => x.day === '2027-01-01'));
    expect(jan?.monthLabel).toBe('Th1');
    const dec = h.columns.find((c) => c.cells.some((x) => x.day === '2026-12-01'));
    expect(dec?.monthLabel).toBe('Th12');
    expect(h.columns.filter((c) => c.monthLabel).length).toBeLessThanOrEqual(4);
  });
  it('quantises levels and describes cells in Vietnamese', () => {
    expect([0, 1, 2, 5, 10].map((n) => heatLevel(n, 10))).toEqual([0, 1, 1, 2, 4]);
    expect(heatLevel(3, 0)).toBe(0);
    const base = { day: '2026-11-04', label: '04/11/2026', weekday: 2, level: 1 as const, future: false, isToday: false, archived: false };
    expect(heatCellText({ ...base, count: 4, correct: 3 })).toBe('Thứ Tư, 04/11/2026: 4 lượt, 75% đúng');
    expect(heatCellText({ ...base, count: 0, correct: 0 })).toBe('Thứ Tư, 04/11/2026: không luyện');
    expect(heatCellText({ ...base, count: 0, correct: 0, future: true })).toBe('Thứ Tư, 04/11/2026: chưa tới');
  });
  it('moves keyboard focus by day and week without entering the future', () => {
    expect(moveHeatFocus(10, 'ArrowDown', 84, 80)).toBe(11);
    expect(moveHeatFocus(10, 'ArrowUp', 84, 80)).toBe(9);
    expect(moveHeatFocus(10, 'ArrowLeft', 84, 80)).toBe(3);
    expect(moveHeatFocus(3, 'ArrowLeft', 84, 80)).toBe(3);
    expect(moveHeatFocus(76, 'ArrowRight', 84, 80)).toBe(80);
    expect(moveHeatFocus(80, 'ArrowDown', 84, 80)).toBe(80);
    expect(moveHeatFocus(40, 'Home', 84, 80)).toBe(0);
    expect(moveHeatFocus(0, 'End', 84, 80)).toBe(80);
    expect(moveHeatFocus(5, 'x', 84, 80)).toBe(5);
  });
});

describe('streaks, goal, today', () => {
  it('finds the longest run of days across month and year ends', () => {
    expect(longestStreak(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-03'])).toBe(3);
    expect(longestStreak(['2026-02-28', '2026-03-01', '2026-03-01', 'junk', 5, null])).toBe(2);
    expect(longestStreak(['2026-03-05', '2026-03-01'])).toBe(1);
    expect(longestStreak(undefined)).toBe(0);
  });
  it('counts today attempts and sanitises the goal', () => {
    expect(attemptsTodayCount([att({}), att({ at: at(2026, 11, 5, 0, 0) }), att({ at: at(2026, 11, 4, 23, 59) })], NOW)).toBe(2);
    expect(sanitizeGoal(undefined)).toBe(30);
    expect(sanitizeGoal(500)).toBe(100);
    expect(sanitizeGoal(3)).toBe(10);
    expect(sanitizeGoal(25)).toBe(25);
  });
});

describe('lessons and weakness', () => {
  const L = (id: string, order: number, phenomenon: LessonMeta['phenomenon']): LessonMeta => ({
    id,
    course: 'connected',
    order,
    title: id,
    summary: '',
    phenomenon,
    minutes: 5,
  });
  const lessons = [L('linking', 3, 'linking'), L('intro', 1, null), L('weak-form', 2, 'weak-form')];
  it('summarises lesson progress and picks the next lesson by order', () => {
    const s = lessonSummary(lessons, {
      intro: { completedAt: 1, bestScore: 0.9, attempts: 1 },
      'weak-form': { completedAt: 0, bestScore: 0.5, attempts: 2 },
    });
    expect(s).toMatchObject({ total: 3, completed: 1, pct: 33, avgBest: 70 });
    expect(s.next?.id).toBe('weak-form');
    expect(lessonSummary([], {})).toMatchObject({ total: 0, completed: 0, pct: 0, next: null, avgBest: null });
  });
  it('maps a phenomenon to its lesson and finds the weakest phenomenon', () => {
    expect(lessonIdFor('linking', lessons)).toBe('linking');
    expect(lessonIdFor('elision', lessons)).toBe('elision');
    const rep = weaknessReport({ linking: { seen: 5, missed: 0 }, elision: { seen: 4, missed: 1 } });
    expect(weakestPhenomenon(rep)?.phenomenon).toBe('elision');
    expect(weakestPhenomenon(weaknessReport({ linking: { seen: 5, missed: 0 } }))).toBeNull();
  });
});

describe('trimmed history (storage keeps only recent attempts)', () => {
  it('merges stored active days with attempt days, dropping junk', () => {
    const days = mergeActiveDays(['2026-11-01', 'junk', 42, '2026-13-01', '2026-11-01', null], [att({}), att({ at: at(2026, 11, 3, 23, 59) })]);
    expect(days).toEqual(['2026-11-01', '2026-11-03', '2026-11-05']);
    expect(mergeActiveDays(undefined, [])).toEqual([]);
  });
  it('detects trimmed history from active days older than the oldest kept attempt', () => {
    const list = [att({ at: at(2026, 10, 20, 8) }), att({})];
    expect(historyInfo(list, ['2026-10-20', '2026-11-05'])).toEqual({ trimmed: false, oldestAt: at(2026, 10, 20, 8) });
    expect(historyInfo(list, ['2026-10-01', '2026-10-20'])).toMatchObject({ trimmed: true });
    expect(historyInfo([], ['2026-10-01'])).toEqual({ trimmed: false, oldestAt: null });
  });
  it('marks weeks before the trim point as without data and the trim week as partial', () => {
    const keptFrom = at(2026, 10, 21, 9); // Wed 21/10
    const weeks = weeklyAccuracy([att({ at: keptFrom }), att({})], NOW, 8, keptFrom);
    expect(weeks.find((w) => w.key === '2026-10-19')?.coverage).toBe('partial');
    expect(weeks.find((w) => w.key === '2026-10-12')?.coverage).toBe('none');
    expect(weeks[7].coverage).toBe('full');
    expect(weeklyAccuracy([att({})], NOW).every((w) => w.coverage === 'full')).toBe(true);
  });
  it('shows trimmed active days on the heatmap as archived, not as empty', () => {
    const h = activityHeatmap([att({ at: at(2026, 11, 3, 9) }), att({})], NOW, 12, ['2026-10-28', '2026-11-03', '2026-11-05']);
    const cells = h.columns.flatMap((c) => c.cells);
    const archived = cells.find((c) => c.day === '2026-10-28');
    expect(archived).toMatchObject({ count: 0, archived: true, level: 1 });
    expect(heatCellText(archived!)).toBe('Thứ Tư, 28/10/2026: có luyện (không còn số liệu chi tiết)');
    expect(cells.find((c) => c.day === '2026-11-04')).toMatchObject({ archived: false, level: 0 });
    expect(h.activeDays).toBe(3);
    expect(h.total).toBe(2);
  });
  it('never marks future days as archived', () => {
    const h = activityHeatmap([], NOW, 12, ['2026-11-07']);
    expect(h.columns[11].cells[5]).toMatchObject({ day: '2026-11-07', future: true, archived: false });
  });
});

describe('goal snapping', () => {
  it('snaps the goal to steps of 5 like the nav badge', () => {
    expect(sanitizeGoal(33)).toBe(35);
    expect(sanitizeGoal(32)).toBe(30);
    expect(sanitizeGoal(Number.NaN)).toBe(30);
    expect(sanitizeGoal(-5)).toBe(10);
  });
});
