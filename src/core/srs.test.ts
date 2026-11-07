import { describe, expect, it } from 'vitest';
import type { Chunk } from './types';
import { startOfLocalDay } from './review/time';
import {
  availableAt,
  DAY,
  HARD_LEARNING_MS,
  MIN_EASE,
  MINUTE,
  RELEARN_MS,
  START_EASE,
  buildQueue,
  cardStatus,
  countDue,
  formatInterval,
  grade,
  isDue,
  isDueToday,
  newCard,
  nextDue,
  previewIntervals,
  type CardState,
} from './srs';

const T0 = Date.UTC(2026, 0, 1, 8, 0, 0);

function chunk(id: string, rank: number): Chunk {
  return {
    id,
    written: `w ${id}`,
    spoken: `s-${id}`,
    ttsText: `s ${id}`,
    phenomena: ['linking'],
    meaning: 'nghĩa',
    example: `ex ${id}`,
    exampleVi: 'ví dụ',
    rank,
  };
}

function goodTimes(card: CardState, n: number, start = T0): CardState {
  let c = card;
  let t = start;
  for (let i = 0; i < n; i++) {
    c = grade(c, 'good', t);
    t = c.due;
  }
  return c;
}

describe('newCard', () => {
  it('starts with default ease, no reps, due now', () => {
    const c = newCard('c1', T0);
    expect(c).toEqual({ id: 'c1', due: T0, interval: 0, ease: START_EASE, reps: 0, lapses: 0 });
    expect(isDue(c, T0)).toBe(true);
  });
});

describe('grade: good', () => {
  it('first good → 1 day', () => {
    const c = grade(newCard('a', T0), 'good', T0);
    expect(c.interval).toBe(1);
    expect(c.reps).toBe(1);
    expect(c.due).toBe(T0 + DAY);
    expect(c.lastGrade).toBe('good');
  });

  it('second good → 3 days', () => {
    const c = goodTimes(newCard('a', T0), 2);
    expect(c.interval).toBe(3);
    expect(c.reps).toBe(2);
  });

  it('third good → interval * ease', () => {
    const c = goodTimes(newCard('a', T0), 3);
    expect(c.interval).toBe(Math.round(3 * START_EASE)); // 8
    expect(c.ease).toBe(START_EASE);
  });

  it('intervals keep growing', () => {
    const c4 = goodTimes(newCard('a', T0), 4);
    const c5 = goodTimes(newCard('a', T0), 5);
    expect(c5.interval).toBeGreaterThan(c4.interval);
  });

  it('does not mutate the input card', () => {
    const c = newCard('a', T0);
    const copy = { ...c };
    grade(c, 'good', T0);
    expect(c).toEqual(copy);
  });
});

describe('grade: again', () => {
  it('resets interval, increments lapses, relearns in about a minute', () => {
    const mature = goodTimes(newCard('a', T0), 4);
    const t = mature.due;
    const c = grade(mature, 'again', t);
    expect(c.interval).toBe(0);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.due).toBe(t + RELEARN_MS);
    expect(c.ease).toBeCloseTo(START_EASE - 0.2);
  });

  it('on a new card does not lower ease and is not a lapse (it was never learned)', () => {
    const c = grade(newCard('a', T0), 'again', T0);
    expect(c.ease).toBe(START_EASE);
    expect(c.lapses).toBe(0);
    expect(isDue(c, T0)).toBe(false);
    expect(isDue(c, T0 + MINUTE)).toBe(true);
  });

  it('after a lapse, good restarts at 1 day', () => {
    const lapsed = grade(goodTimes(newCard('a', T0), 3), 'again', T0);
    const c = grade(lapsed, 'good', T0);
    expect(c.interval).toBe(1);
  });
});

describe('grade: hard', () => {
  it('graduated card: interval * 1.2 and ease - 0.15', () => {
    const c3 = goodTimes(newCard('a', T0), 3); // interval 8
    const h = grade(c3, 'hard', T0);
    expect(h.interval).toBe(Math.round(8 * 1.2));
    expect(h.ease).toBeCloseTo(START_EASE - 0.15);
    expect(h.reps).toBe(c3.reps + 1);
  });

  it('graduated card never goes below 1 day', () => {
    const c1 = goodTimes(newCard('a', T0), 1);
    const h = grade(c1, 'hard', T0);
    expect(h.interval).toBeGreaterThanOrEqual(1);
    expect(h.due).toBe(T0 + h.interval * DAY);
  });

  it('learning card stays in a short learning step', () => {
    const h = grade(newCard('a', T0), 'hard', T0);
    expect(h.interval).toBe(0);
    expect(h.due).toBe(T0 + HARD_LEARNING_MS);
    expect(h.reps).toBe(0);
  });

  it('repeated hard while still learning does not erode ease', () => {
    let c = newCard('a', T0);
    for (let i = 0; i < 5; i++) c = grade(c, 'hard', T0);
    expect(c.ease).toBe(START_EASE);
    expect(c.lapses).toBe(0);
  });

  it('ease never drops below the minimum', () => {
    let c = goodTimes(newCard('a', T0), 2);
    for (let i = 0; i < 30; i++) c = grade(c, 'hard', T0);
    expect(c.ease).toBe(MIN_EASE);
    for (let i = 0; i < 10; i++) c = grade(grade(c, 'good', T0), 'again', T0);
    expect(c.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });
});

describe('grade: easy', () => {
  it('new card jumps to 4 days and ease + 0.15', () => {
    const c = grade(newCard('a', T0), 'easy', T0);
    expect(c.interval).toBe(4);
    expect(c.ease).toBeCloseTo(START_EASE + 0.15);
  });

  it('good after an easy first answer keeps growing (does not fall back to the 3-day step)', () => {
    const e = grade(newCard('a', T0), 'easy', T0); // 4 days, reps 1
    const g = grade(e, 'good', e.due);
    expect(g.interval).toBe(Math.round(4 * (START_EASE + 0.15))); // 11
    expect(g.interval).toBeGreaterThan(e.interval * 2);
  });

  it('is always longer than good', () => {
    const base = goodTimes(newCard('a', T0), 3);
    const g = grade(base, 'good', T0);
    const e = grade(base, 'easy', T0);
    const h = grade(base, 'hard', T0);
    expect(e.interval).toBeGreaterThan(g.interval);
    expect(g.interval).toBeGreaterThan(h.interval);
  });
});

describe('formatInterval / previewIntervals', () => {
  it('formats Vietnamese short labels', () => {
    expect(formatInterval(30_000)).toBe('<1 phút');
    expect(formatInterval(MINUTE)).toBe('<1 phút');
    expect(formatInterval(10 * MINUTE)).toBe('10 phút');
    expect(formatInterval(3 * 60 * MINUTE)).toBe('3 giờ');
    expect(formatInterval(DAY)).toBe('1 ngày');
    expect(formatInterval(4 * DAY)).toBe('4 ngày');
    expect(formatInterval(60 * DAY)).toBe('2 tháng');
    expect(formatInterval(548 * DAY)).toBe('1,5 năm');
  });

  it('never shows "24 giờ" or "60 phút" just below a boundary', () => {
    expect(formatInterval(DAY - 500)).toBe('1 ngày');
    expect(formatInterval(60 * MINUTE - 500)).toBe('1 giờ');
  });

  it('previews a new card', () => {
    const p = previewIntervals(newCard('a', T0), T0);
    expect(p).toEqual({ again: '<1 phút', hard: '10 phút', good: '1 ngày', easy: '4 ngày' });
  });

  it('previews a graduated card', () => {
    const c = goodTimes(newCard('a', T0), 2); // interval 3
    const p = previewIntervals(c, T0);
    expect(p.again).toBe('<1 phút');
    expect(p.hard).toBe('4 ngày');
    expect(p.good).toBe('8 ngày');
    expect(p.easy).toBe('10 ngày');
  });
});

describe('buildQueue', () => {
  const chunks = [chunk('c3', 3), chunk('c1', 1), chunk('c2', 2), chunk('c4', 4), chunk('c5', 5)];

  it('returns new cards by rank when nothing is started', () => {
    const q = buildQueue(chunks, {}, T0);
    expect(q.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('respects the daily new limit and what was introduced today', () => {
    expect(buildQueue(chunks, {}, T0, { newPerDay: 2 }).map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(buildQueue(chunks, {}, T0, { newPerDay: 3, newIntroducedToday: 2 }).map((c) => c.id)).toEqual(['c1']);
    expect(buildQueue(chunks, {}, T0, { newPerDay: 2, newIntroducedToday: 5 })).toEqual([]);
  });

  it('puts due reviews first, most overdue first, then new cards', () => {
    const states: Record<string, CardState> = {
      c4: { ...newCard('c4', T0), interval: 1, reps: 1, due: T0 - 1 * DAY },
      c5: { ...newCard('c5', T0), interval: 1, reps: 1, due: T0 - 3 * DAY },
      c2: { ...newCard('c2', T0), interval: 5, reps: 2, due: T0 + 2 * DAY }, // not due
    };
    const q = buildQueue(chunks, states, T0, { newPerDay: 10 });
    expect(q.map((c) => c.id)).toEqual(['c5', 'c4', 'c1', 'c3']);
  });

  it('learn-ahead includes cards due soon at the end', () => {
    const states: Record<string, CardState> = {
      c1: grade(newCard('c1', T0), 'again', T0),
    };
    expect(buildQueue(chunks, states, T0, { newPerDay: 1 }).map((c) => c.id)).toEqual(['c2']);
    const q = buildQueue(chunks, states, T0, { newPerDay: 1, learnAheadMs: 20 * MINUTE });
    expect(q.map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('an "again" card comes back in the same session, ahead of new cards once it is due', () => {
    const opts = { newPerDay: 10, newIntroducedToday: 1, learnAheadMs: 20 * MINUTE };
    const states: Record<string, CardState> = { c1: grade(newCard('c1', T0), 'again', T0) };
    // Right after the miss it waits behind the remaining new cards…
    expect(buildQueue(chunks, states, T0 + 1000, opts).map((c) => c.id)).toEqual(['c2', 'c3', 'c4', 'c5', 'c1']);
    // …and once its 1-minute step is over it is a due card and comes first.
    expect(buildQueue(chunks, states, T0 + RELEARN_MS, opts)[0].id).toBe('c1');
    // A graded "good" card leaves today's queue entirely.
    const done = { c1: grade(newCard('c1', T0), 'good', T0) };
    expect(buildQueue(chunks, done, T0 + RELEARN_MS, opts).map((c) => c.id)).not.toContain('c1');
  });

  it('handles empty chunks and ignores states of unknown chunks', () => {
    expect(buildQueue([], {}, T0)).toEqual([]);
    const states = { ghost: { ...newCard('ghost', T0), due: T0 - DAY } };
    expect(buildQueue([], states, T0)).toEqual([]);
    expect(countDue([], states, T0)).toBe(0);
  });

  it('ignores duplicate chunk ids', () => {
    const q = buildQueue([chunk('x', 1), chunk('x', 1)], {}, T0);
    expect(q).toHaveLength(1);
  });
});

describe('helpers', () => {
  it('cardStatus: new / learning / mature', () => {
    expect(cardStatus(undefined)).toBe('new');
    expect(cardStatus({ ...newCard('a', T0), interval: 3 })).toBe('learning');
    expect(cardStatus({ ...newCard('a', T0), interval: 21 })).toBe('mature');
  });

  it('countDue and nextDue', () => {
    const chunks = [chunk('a', 1), chunk('b', 2), chunk('c', 3)];
    const states: Record<string, CardState> = {
      a: { ...newCard('a', T0), due: T0 - 1 },
      b: { ...newCard('b', T0), due: T0 + 5 * DAY },
      c: { ...newCard('c', T0), due: T0 + 2 * DAY },
    };
    expect(countDue(chunks, states, T0)).toBe(1);
    expect(nextDue(chunks, states, T0)).toBe(T0 + 2 * DAY);
    expect(nextDue(chunks, {}, T0)).toBeNull();
  });
});

describe('generic queue helpers (any { id, rank? })', () => {
  it('buildQueue / countDue / nextDue work on plain items; a missing rank counts as 0', () => {
    const items = [{ id: 'b' }, { id: 'a' }, { id: 'c', rank: -1 }, { id: 'd' }];
    const states: Record<string, CardState> = {
      d: { ...newCard('d', T0), due: T0 - 1 },
      a: { ...newCard('a', T0), due: T0 + DAY },
    };
    const q = buildQueue(items, states, T0, { newPerDay: 2 });
    expect(q.map((x) => x.id)).toEqual(['d', 'c', 'b']);
    expect(q[0]).toBe(items[3]); // same objects, typed as the input type
    expect(countDue(items, states, T0)).toBe(1);
    expect(nextDue(items, states, T0)).toBe(T0 + DAY);
  });
});

describe('availableAt / isDueToday (calendar-day due for graduated cards)', () => {
  const noon = new Date(2026, 4, 10, 12, 0).getTime();

  it('learning cards: the exact due time', () => {
    const c: CardState = { ...newCard('a', noon), interval: 0, due: noon + 10 * MINUTE };
    expect(availableAt(c)).toBe(noon + 10 * MINUTE);
    expect(isDueToday(c, noon)).toBe(false);
    expect(isDueToday(c, noon + 10 * MINUTE)).toBe(true);
  });

  it('graduated cards: local midnight of the due day', () => {
    const c: CardState = { ...newCard('a', noon), interval: 1, reps: 1, due: noon + 9 * 3_600_000 }; // 21:00 today
    expect(availableAt(c)).toBe(startOfLocalDay(noon));
    expect(isDueToday(c, noon)).toBe(true);
    expect(isDue(c, noon)).toBe(false); // the drill keeps its exact-time rule
    const tomorrow: CardState = { ...c, due: startOfLocalDay(noon, 1) + 3_600_000 };
    expect(isDueToday(tomorrow, noon)).toBe(false);
    expect(isDueToday(tomorrow, startOfLocalDay(noon, 1))).toBe(true);
  });
});
