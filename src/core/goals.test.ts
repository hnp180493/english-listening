import { describe, expect, it } from 'vitest';
import {
  checkupPlan,
  clampGoal,
  cleanAttempts,
  dailyPlan,
  DICTATION_TARGET,
  FOCUS_TARGET,
  listeningLine,
  planDoneCount,
  planTotal,
  todayProgress,
  weakestPhenomenon,
  type PlanInput,
} from './goals';
import type { Attempt, ModuleId } from './stats';
import type { LessonMeta } from './lessons';
import type { Phenomenon } from './types';

// Local-time timestamps so localDay() boundaries are exercised in the test machine's zone.
const NOW = new Date(2026, 10, 6, 15, 30).getTime();
const MIDNIGHT = new Date(2026, 10, 6, 0, 0, 0).getTime();
const YESTERDAY_LATE = new Date(2026, 10, 5, 23, 59, 59).getTime();

function att(module: ModuleId, at: number, extra: Partial<Attempt> = {}): Attempt {
  return { at, module, itemId: extra.itemId ?? `${module}-${at}`, correct: true, seen: [], missed: [], ...extra };
}

function by(entries: Partial<Record<Phenomenon, [number, number]>>) {
  const out: Record<string, { seen: number; missed: number }> = {};
  for (const [p, [seen, missed]] of Object.entries(entries)) out[p] = { seen, missed };
  return out;
}

const LESSONS: LessonMeta[] = [
  { id: 'intro', course: 'connected', order: 1, title: 'Giới thiệu', summary: '', phenomenon: null, minutes: 5 },
  { id: 'linking', course: 'connected', order: 2, title: 'Nối âm', summary: '', phenomenon: 'linking', minutes: 8 },
  { id: 'elision', course: 'connected', order: 3, title: 'Nuốt âm', summary: '', phenomenon: 'elision', minutes: 7 },
];

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    now: NOW,
    stats: { attempts: [], byPhenomenon: {} },
    drill: { due: 0, newAvailable: 0, learned: 0 },
    lessons: LESSONS,
    lessonProgress: {},
    ...over,
  };
}

describe('clampGoal', () => {
  it('clamps, snaps and defaults', () => {
    expect(clampGoal(30)).toBe(30);
    expect(clampGoal(3)).toBe(10);
    expect(clampGoal(500)).toBe(100);
    expect(clampGoal(32)).toBe(30);
    expect(clampGoal(33)).toBe(35);
    expect(clampGoal('x')).toBe(30);
    expect(clampGoal(Number.NaN)).toBe(30);
  });
});

describe('cleanAttempts', () => {
  it('drops malformed entries', () => {
    const out = cleanAttempts([
      null,
      1,
      { at: 'x', module: 'drill' },
      { at: 1, module: 'unknown' },
      { at: 2, module: 'drill', itemId: 5, seen: ['linking', 'nope'], missed: 'x' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ at: 2, itemId: '5', seen: ['linking'], missed: [], correct: false });
  });
  it('accepts non-arrays', () => {
    expect(cleanAttempts(undefined)).toEqual([]);
    expect(cleanAttempts({})).toEqual([]);
  });
});

describe('todayProgress', () => {
  it('handles empty / missing stats', () => {
    const p = todayProgress(null, NOW, 30);
    expect(p).toMatchObject({ attempts: 0, goal: 30, pct: 0, done: false });
    expect(p.byModule.dictation).toBe(0);
    expect(Object.keys(p.byModule)).toHaveLength(7);
  });

  it('counts only today, split by module', () => {
    const attempts = [
      att('dictation', YESTERDAY_LATE),
      att('dictation', MIDNIGHT),
      att('drill', NOW - 1000),
      att('drill', NOW - 2000),
    ];
    const p = todayProgress({ attempts }, NOW, 10);
    expect(p.attempts).toBe(3);
    expect(p.byModule).toMatchObject({ dictation: 1, drill: 2, pairs: 0 });
    expect(p.pct).toBe(30);
  });

  it('marks the goal reached and caps pct at 100', () => {
    const attempts = Array.from({ length: 25 }, (_, i) => att('pairs', NOW - i * 1000));
    const p = todayProgress({ attempts }, NOW, 20);
    expect(p.done).toBe(true);
    expect(p.pct).toBe(100);
    expect(p.attempts).toBe(25);
  });

  it('sanitizes the goal', () => {
    expect(todayProgress({ attempts: [] }, NOW, 'abc').goal).toBe(30);
    expect(todayProgress({ attempts: [] }, NOW, 1).goal).toBe(10);
  });
});

describe('weakestPhenomenon', () => {
  it('returns null without data', () => {
    expect(weakestPhenomenon(null)).toBeNull();
    expect(weakestPhenomenon({ byPhenomenon: {} })).toBeNull();
    expect(weakestPhenomenon({ byPhenomenon: 'garbage' })).toBeNull();
  });

  it('ignores phenomena seen fewer than minSeen times', () => {
    expect(weakestPhenomenon({ byPhenomenon: by({ linking: [2, 2] }) })).toBeNull();
    expect(weakestPhenomenon({ byPhenomenon: by({ linking: [2, 2] }) }, 2)).toBe('linking');
  });

  it('picks the highest miss rate', () => {
    const s = { byPhenomenon: by({ linking: [10, 2], 'flap-t': [4, 3], elision: [20, 10] }) };
    expect(weakestPhenomenon(s)).toBe('flap-t');
  });

  it('breaks ties by number of misses', () => {
    const s = { byPhenomenon: by({ linking: [4, 2], elision: [10, 5] }) };
    expect(weakestPhenomenon(s)).toBe('elision');
  });

  it('returns null when nothing was missed', () => {
    expect(weakestPhenomenon({ byPhenomenon: by({ linking: [10, 0] }) })).toBeNull();
  });

  it('caps corrupt missed > seen', () => {
    const s = { byPhenomenon: by({ linking: [3, 99], elision: [5, 4] }) };
    expect(weakestPhenomenon(s)).toBe('linking'); // 3/3 = 100% beats 80%
  });
});

describe('dailyPlan', () => {
  it('builds a sensible plan for a brand-new learner', () => {
    const plan = dailyPlan(input());
    expect(plan.map((p) => p.id)).toEqual(['lesson', 'dictation', 'shadowing']);
    expect(plan[0]).toMatchObject({ route: 'lessons', params: { id: 'intro' }, done: false });
    expect(planDoneCount(plan)).toBe(0);
  });

  it('skips the lesson item when there are no lessons', () => {
    const plan = dailyPlan(input({ lessons: [] }));
    expect(plan.some((p) => p.id === 'lesson')).toBe(false);
  });

  it('suggests the next uncompleted lesson in order', () => {
    const plan = dailyPlan(
      input({
        lessons: [LESSONS[2], LESSONS[0], LESSONS[1]],
        lessonProgress: { intro: { completedAt: NOW - 3 * 86_400_000, bestScore: 1, attempts: 1 } },
      }),
    );
    expect(plan[0]).toMatchObject({ id: 'lesson', params: { id: 'linking' }, done: false });
  });

  it('treats a failed attempt (completedAt 0) as not completed', () => {
    const plan = dailyPlan(input({ lessonProgress: { intro: { completedAt: 0, bestScore: 0.2, attempts: 1 } } }));
    expect(plan[0].params).toEqual({ id: 'intro' });
  });

  it('marks the lesson item done when a lesson was completed today', () => {
    const plan = dailyPlan(input({ lessonProgress: { intro: { completedAt: MIDNIGHT + 1, bestScore: 1, attempts: 1 } } }));
    expect(plan[0]).toMatchObject({ id: 'lesson', done: true, params: { id: 'intro' } });
  });

  it('a lesson finished just before midnight counts for yesterday', () => {
    const plan = dailyPlan(input({ lessonProgress: { intro: { completedAt: YESTERDAY_LATE, bestScore: 1, attempts: 1 } } }));
    expect(plan[0]).toMatchObject({ done: false, params: { id: 'linking' } });
  });

  it('recommends the next lesson of the course the learner is in, naming that course', () => {
    const extra: LessonMeta[] = [
      ...LESSONS,
      { id: 'irr-1', course: 'irregular', order: 1, title: 'colonel', summary: '', phenomenon: null, minutes: 6 },
      { id: 'irr-2', course: 'irregular', order: 2, title: 'bought', summary: '', phenomenon: null, minutes: 6 },
    ];
    const courses = [
      { id: 'connected' as const, title: 'Nghe nối âm', order: 1 },
      { id: 'irregular' as const, title: 'Từ bất quy tắc', order: 3 },
    ];
    const old = { completedAt: NOW - 3 * 86_400_000, bestScore: 1, attempts: 1 };
    const plan = dailyPlan(
      input({
        lessons: extra,
        courses,
        lessonProgress: { 'irr-1': old },
        stats: { attempts: [att('lesson', NOW - 86_400_000, { itemId: 'irr-1:4' })], byPhenomenon: {} },
      }),
    );
    const item = plan.find((p) => p.id === 'lesson');
    expect(item).toMatchObject({ params: { id: 'irr-2' }, title: 'Học bài 2 (Từ bất quy tắc): bought' });
    expect(item?.detail).toContain('1/2 bài');
    // no lesson activity yet: the first course in order, without a course name
    const fresh = dailyPlan(input({ lessons: extra, courses }));
    expect(fresh.find((p) => p.id === 'lesson')).toMatchObject({ params: { id: 'intro' }, title: 'Học bài 1: Giới thiệu' });
  });

  it('drops the lesson item when every lesson is completed earlier', () => {
    const old = { completedAt: NOW - 5 * 86_400_000, bestScore: 1, attempts: 1 };
    const plan = dailyPlan(input({ lessonProgress: { intro: old, linking: old, elision: old } }));
    expect(plan.some((p) => p.id === 'lesson')).toBe(false);
  });

  it('includes due drill cards', () => {
    const plan = dailyPlan(input({ drill: { due: 12, newAvailable: 5, learned: 40 } }));
    const d = plan.find((p) => p.id === 'drill');
    expect(d).toMatchObject({ route: 'drill', done: false });
    expect(d?.title).toContain('12');
  });

  it('offers new drill cards when nothing is due', () => {
    const d = dailyPlan(input({ drill: { due: 0, newAvailable: 10, learned: 0 } })).find((p) => p.id === 'drill');
    expect(d?.title).toContain('10');
    expect(d?.done).toBe(false);
  });

  it('marks drill done after reviewing everything today', () => {
    const d = dailyPlan(
      input({ drill: { due: 0, newAvailable: 0, learned: 20 }, stats: { attempts: [att('drill', NOW - 10)] } }),
    ).find((p) => p.id === 'drill');
    expect(d?.done).toBe(true);
  });

  it('counts distinct dictation sentences of today only', () => {
    const attempts = [
      ...Array.from({ length: DICTATION_TARGET - 1 }, (_, i) => att('dictation', NOW - i, { itemId: `s${i}` })),
      att('dictation', NOW, { itemId: 's0' }), // repeat, not distinct
      att('dictation', YESTERDAY_LATE, { itemId: 'sX' }), // yesterday
    ];
    let d = dailyPlan(input({ stats: { attempts } })).find((p) => p.id === 'dictation');
    expect(d?.done).toBe(false);
    expect(d?.progress).toBeCloseTo((DICTATION_TARGET - 1) / DICTATION_TARGET);
    attempts.push(att('dictation', MIDNIGHT, { itemId: 'sY' }));
    d = dailyPlan(input({ stats: { attempts } })).find((p) => p.id === 'dictation');
    expect(d?.done).toBe(true);
  });

  it('adds a focus item for the weakest phenomenon with a focus param', () => {
    const plan = dailyPlan(input({ stats: { attempts: [], byPhenomenon: by({ 'flap-t': [6, 4] }) } }));
    const f = plan.find((p) => p.id === 'focus');
    expect(f).toBeDefined();
    expect(f?.params).toEqual({ focus: 'flap-t' });
    expect(['pairs', 'dictation']).toContain(f?.route);
    expect(f?.detail).toContain('67%');
  });

  it('alternates the focus route between days', () => {
    const stats = { attempts: [], byPhenomenon: by({ linking: [6, 4] }) };
    const a = dailyPlan(input({ stats })).find((p) => p.id === 'focus')?.route;
    const b = dailyPlan(input({ stats, now: NOW + 86_400_000 })).find((p) => p.id === 'focus')?.route;
    expect(a).not.toBe(b);
  });

  it('marks focus done after enough focused attempts', () => {
    const attempts = Array.from({ length: FOCUS_TARGET }, (_, i) =>
      att(i % 2 ? 'pairs' : 'dictation', NOW - i, { seen: ['linking'] }),
    );
    const f = dailyPlan(input({ stats: { attempts, byPhenomenon: by({ linking: [9, 6] }) } })).find((p) => p.id === 'focus');
    expect(f?.done).toBe(true);
  });

  it('passes the shadowing sentence id', () => {
    const s = dailyPlan(input({ shadowSentenceId: 's042' })).find((p) => p.id === 'shadowing');
    expect(s?.params).toEqual({ id: 's042' });
    const t = dailyPlan(input()).find((p) => p.id === 'shadowing');
    expect(t?.params).toBeUndefined();
  });

  it('marks everything done on a productive day', () => {
    const attempts: Attempt[] = [
      ...Array.from({ length: DICTATION_TARGET }, (_, i) => att('dictation', NOW - i, { itemId: `s${i}`, seen: ['elision'] })),
      ...Array.from({ length: 3 }, (_, i) => att('shadowing', NOW - i)),
    ];
    const plan = dailyPlan(
      input({
        stats: { attempts, byPhenomenon: by({ elision: [12, 6] }) },
        lessonProgress: { intro: { completedAt: NOW - 60_000, bestScore: 1, attempts: 1 } },
      }),
    );
    expect(planDoneCount(plan)).toBe(plan.length);
  });

  it('survives corrupt inputs', () => {
    const plan = dailyPlan({
      now: NOW,
      stats: { attempts: 'nope', byPhenomenon: null },
      drill: { due: Number.NaN, newAvailable: -3, learned: 0 },
      lessons: [],
      lessonProgress: {},
    });
    expect(plan.map((p) => p.id)).toEqual(['dictation', 'shadowing']);
  });
});

describe('dailyPlan with Ôn tập', () => {
  const review = (over: Partial<NonNullable<PlanInput['review']>> = {}) => ({
    dueToday: 0,
    reviewedToday: 0,
    minutesToday: 0,
    heldBack: 0,
    ...over,
  });

  it('puts the review item first while items are due', () => {
    const plan = dailyPlan(input({ review: review({ dueToday: 12, minutesToday: 8 }) }));
    expect(plan[0]).toMatchObject({
      id: 'review',
      title: 'Ôn tập · khoảng 8 phút',
      detail: '12 mục đến hạn',
      route: 'review',
      done: false,
      progress: 0,
    });
  });

  it('shows review progress once some items were reviewed today', () => {
    const r = dailyPlan(input({ review: review({ dueToday: 6, reviewedToday: 4, minutesToday: 3 }) }))[0];
    expect(r).toMatchObject({ id: 'review', detail: 'Đã ôn 4 mục, còn 6 mục', done: false });
    expect(r.progress).toBeCloseTo(0.4);
  });

  it('marks review done when everything due was reviewed', () => {
    const r = dailyPlan(input({ review: review({ reviewedToday: 9 }) }))[0];
    expect(r).toMatchObject({ id: 'review', title: 'Ôn tập', detail: 'Đã ôn 9 mục, hết mục đến hạn', done: true, progress: 1 });
  });

  it('says the rest was moved, not "hết", when the budget held due items back', () => {
    const held = dailyPlan(input({ review: review({ reviewedToday: 8, heldBack: 23 }) }))[0];
    expect(held).toMatchObject({ id: 'review', detail: 'Đã ôn 8 mục, phần còn lại dời sang ngày sau', done: true });
    const deferred = dailyPlan(input({ review: review({ reviewedToday: 4, deferred: 2 }) }))[0];
    expect(deferred.detail).toBe('Đã ôn 4 mục, phần còn lại dời sang ngày sau');
  });

  it('has no review item when nothing is due and nothing was reviewed', () => {
    const plan = dailyPlan(input({ review: review() }));
    expect(plan.some((p) => p.id === 'review')).toBe(false);
  });

  it('the drill item ignores due cards (Ôn tập serves them) and offers new chunks', () => {
    const d = dailyPlan(input({ review: review(), drill: { due: 12, newAvailable: 5, learned: 40 } })).find((p) => p.id === 'drill');
    expect(d).toMatchObject({ title: 'Học 5 cụm từ mới', done: false });
  });

  it('the drill item is done once new chunks were introduced today', () => {
    const d = dailyPlan(
      input({ review: review(), drill: { due: 3, newAvailable: 2, learned: 10, newIntroduced: 8 } }),
    ).find((p) => p.id === 'drill');
    expect(d).toMatchObject({ title: 'Học cụm từ mới', detail: 'Đã học 8 cụm mới hôm nay', done: true });
  });

  it('drops the drill item when there is nothing new and nothing introduced', () => {
    const plan = dailyPlan(input({ review: review(), drill: { due: 7, newAvailable: 0, learned: 10 } }));
    expect(plan.some((p) => p.id === 'drill')).toBe(false);
  });

  it('back-pressure: swaps new dictation and new chunks for one muted line', () => {
    const plan = dailyPlan(
      input({
        review: review({ dueToday: 20, minutesToday: 10, heldBack: 14 }),
        drill: { due: 0, newAvailable: 10, learned: 0 },
      }),
    );
    expect(plan.map((p) => p.id)).toEqual(['review', 'lesson', 'later', 'shadowing']);
    const later = plan.find((p) => p.id === 'later');
    expect(later).toMatchObject({
      title: 'Ôn trước, học mới sau',
      detail: 'Còn 14 mục tồn, học mới tạm nghỉ để ôn kịp',
      route: 'review',
      done: false,
      muted: true,
    });
    expect(planTotal(plan)).toBe(3);
  });

  it('back-pressure keeps finished items', () => {
    const attempts = Array.from({ length: DICTATION_TARGET }, (_, i) => att('dictation', NOW - i, { itemId: `s${i}` }));
    const plan = dailyPlan(
      input({
        stats: { attempts },
        review: review({ dueToday: 5, minutesToday: 4, heldBack: 3 }),
        drill: { due: 0, newAvailable: 4, learned: 6, newIntroduced: 2 },
      }),
    );
    expect(plan.some((p) => p.id === 'later')).toBe(false);
    expect(plan.find((p) => p.id === 'dictation')?.done).toBe(true);
    expect(plan.find((p) => p.id === 'drill')?.done).toBe(true);
  });

  it('back-pressure replaces only the unfinished one', () => {
    const plan = dailyPlan(
      input({
        review: review({ dueToday: 5, minutesToday: 4, heldBack: 3 }),
        drill: { due: 0, newAvailable: 4, learned: 6, newIntroduced: 2 },
      }),
    );
    expect(plan.map((p) => p.id)).toEqual(['review', 'lesson', 'drill', 'later', 'shadowing']);
  });

  it('no back-pressure without held-back items', () => {
    const plan = dailyPlan(input({ review: review({ dueToday: 5, minutesToday: 4 }), drill: { due: 0, newAvailable: 4, learned: 0 } }));
    expect(plan.map((p) => p.id)).toEqual(['review', 'lesson', 'drill', 'dictation', 'shadowing']);
  });

  it('planTotal and planDoneCount ignore muted items', () => {
    const items = [
      { id: 'review', title: '', detail: '', route: 'review', done: true },
      { id: 'later', title: '', detail: '', route: 'review', done: false, muted: true },
      { id: 'lesson', title: '', detail: '', route: 'lessons', done: false },
    ] as const;
    expect(planTotal([...items])).toBe(2);
    expect(planDoneCount([...items])).toBe(1);
    expect(planTotal([])).toBe(0);
  });

  it('survives corrupt review counters', () => {
    const plan = dailyPlan(
      input({ review: { dueToday: Number.NaN, reviewedToday: -2, minutesToday: Number.POSITIVE_INFINITY, heldBack: Number.NaN } }),
    );
    expect(plan.some((p) => p.id === 'review' || p.id === 'later')).toBe(false);
  });
});

describe('listening line (Hôm nay)', () => {
  it('shows minutes against the goal with a secondary action', () => {
    expect(listeningLine({ minutes: 20, goal: 30 })).toMatchObject({
      show: true,
      title: 'Nghe tiếng Anh: 20/30 phút',
      detail: 'Còn 10 phút',
      pct: 67,
      done: false,
      timerLabel: null,
      actionLabel: 'Ghi giờ nghe',
      route: 'listening',
    });
    expect(listeningLine({ minutes: 45, goal: 30 })).toMatchObject({ done: true, pct: 100, detail: 'Đã đạt mục tiêu hôm nay' });
    expect(listeningLine({ minutes: 0, goal: 30 })).toMatchObject({ show: true, detail: null });
  });

  it('hides when the goal is off and nothing happened today', () => {
    expect(listeningLine({ minutes: 0, goal: 0 }).show).toBe(false);
    expect(listeningLine({ minutes: 15, goal: 0 })).toMatchObject({ show: true, title: 'Nghe tiếng Anh: 15 phút hôm nay', detail: null, pct: 0 });
    expect(listeningLine({ minutes: NaN, goal: -5 }).show).toBe(false);
  });

  it('shows the running timer', () => {
    expect(listeningLine({ minutes: 0, goal: 0, timer: { status: 'running', elapsedMs: 754_000 } })).toMatchObject({ show: true, timerLabel: 'Đang nghe 12:34' });
    expect(listeningLine({ minutes: 0, goal: 30, timer: { status: 'paused', elapsedMs: 60_000 } }).timerLabel).toBe('Đang tạm dừng 1:00');
    expect(listeningLine({ minutes: 0, goal: 30, timer: { status: 'stopped', elapsedMs: 60_000 } }).timerLabel).toBe('Chưa lưu 1:00');
  });
});

describe('checkup plan item', () => {
  it('suggests a baseline, then a periodic check; never otherwise', () => {
    expect(checkupPlan({ kind: 'baseline', daysSince: null, lastAt: null, nextDueAt: null })).toMatchObject({
      id: 'checkup',
      optional: true,
      title: 'Làm bài kiểm tra đầu vào để có mốc so sánh',
      route: 'checkup',
      done: false,
    });
    expect(checkupPlan({ kind: 'due', daysSince: 15, lastAt: 1, nextDueAt: 2 })).toMatchObject({
      title: 'Đến lúc kiểm tra định kỳ',
      detail: '15 ngày từ lần trước · khoảng 10 phút',
    });
    expect(checkupPlan({ kind: null, daysSince: 3, lastAt: 1, nextDueAt: 2 })).toBeNull();
    expect(checkupPlan(null)).toBeNull();
  });

  it('stays out of the daily plan (review/lesson keep the primary action)', () => {
    const kinds = new Set<string>(['review', 'lesson', 'drill', 'dictation', 'focus', 'shadowing', 'later']);
    const item = checkupPlan({ kind: 'baseline', daysSince: null, lastAt: null, nextDueAt: null })!;
    expect(kinds.has(item.id)).toBe(false);
    expect(planTotal([])).toBe(0);
  });
});
