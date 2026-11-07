import { describe, expect, it } from 'vitest';
import { availableAt, newCard, type CardState, type Grade } from '../srs';
import { emptyDrillStore, type DrillStore } from '../../features/drill/drillStore';
import { buildCatalog, type Catalog } from './catalog';
import { KIND_SECONDS, LESSON_PER_DAY, MAX_SESSION_ITEMS, NEW_ENROL_PER_DAY } from './constants';
import { makeCardId, parseCardId } from './ids';
import {
  admitToday,
  buildReviewQueue,
  collectEntries,
  estimateMinutes,
  forecast,
  interleaveByKind,
  kindCounts,
  nextAvailable,
  statesByRef,
  summarize,
} from './queue';
import { applyReview, suspendCardState } from './schedule';
import { emptyReviewStore, withCard, withEnrolled, withReviewed } from './store';
import { localDay, nextLocalMidnight, startOfLocalDay } from './time';
import type { CardId, ReviewCard, ReviewEntry, ReviewKind, ReviewStore } from './types';

const NOW = new Date(2026, 4, 10, 12, 0).getTime();
const HOUR = 3_600_000;
const DAY_MS = 24 * HOUR;
const ALL: Catalog = { has: () => true };

function entry(id: CardId, s: Partial<CardState> = {}, extra: Partial<ReviewEntry> = {}): ReviewEntry {
  const p = parseCardId(id)!;
  const state: CardState = {
    id,
    due: NOW - HOUR,
    interval: 3,
    ease: 2.5,
    reps: 1,
    lapses: 0,
    lastGrade: 'good',
    ...s,
  };
  return {
    id,
    kind: p.kind,
    ref: p.ref,
    state,
    last: NOW - 3 * DAY_MS,
    availableAt: availableAt(state),
    touchedToday: false,
    ...extra,
  };
}

const many = (kind: ReviewKind, n: number, s: Partial<CardState> = {}) =>
  Array.from({ length: n }, (_, i) =>
    entry(makeCardId(kind, `${kind}${String(i).padStart(2, '0')}`), {
      due: NOW - HOUR - i,
      ...s,
    }),
  );

const store = (fn: (s: ReviewStore) => ReviewStore = (s) => s) => fn(emptyReviewStore(NOW));

function rc(id: CardId, over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id,
    due: NOW - HOUR,
    interval: 3,
    ease: 2.5,
    reps: 1,
    lapses: 0,
    last: NOW - 3 * DAY_MS,
    lastGrade: 'good',
    ...over,
  };
}

describe('collectEntries', () => {
  const catalog = buildCatalog({
    builtinSentenceIds: new Set(['s1', 's2', 's3', 's4']),
    customSentenceIds: new Set(['u-1']),
    lessonIds: new Set(['l1', 'l2']),
    chunkIds: new Set(['gonna', 'wanna', 'kinda']),
    pairSetIds: new Set(['can-cant']),
    media: new Map([['m1', 3]]),
  });

  it('skips orphans, suspended cards and retired lessons; adds drill chunks; sorts by kind then id', () => {
    let s = store();
    for (const c of [
      rc('dict:s2'),
      rc('dict:s1', { last: NOW + 2 * HOUR }), // slightly future last (clock skew) → touched today
      rc('dict:s4', { last: NOW + 5 * DAY_MS }), // far-future last (fast clock) → unknown, not touched
      rc('dict:u-1', { last: NOW - 1000 }), // touched today
      rc('dict:gone'),
      rc('dict:s3', { suspended: true }),
      rc('lesson:l1', { interval: 25 }),
      rc('lesson:l2', { interval: 3 }),
      rc('media:m1:2'),
      rc('media:m1:9'),
      rc('pair:can-cant', { last: 0, lastGrade: undefined }),
    ]) {
      s = withCard(s, c);
    }
    const drill: DrillStore = emptyDrillStore(NOW);
    drill.cards = {
      gonna: {
        ...newCard('gonna', NOW),
        interval: 0,
        due: NOW + 5 * 60_000,
        lastGrade: 'again',
      },
      wanna: {
        ...newCard('wanna', NOW),
        interval: 2,
        reps: 1,
        due: NOW - DAY_MS,
      },
      kinda: { ...newCard('kinda', NOW), interval: 0, due: NOW - 1000 },
      gone: {
        ...newCard('gone', NOW),
        interval: 2,
        reps: 1,
        due: NOW - DAY_MS,
      },
    };
    drill.daily.studiedIds = ['gonna'];
    const entries = collectEntries(s, drill, catalog, NOW);
    expect(entries.map((e) => e.id)).toEqual([
      'dict:s1',
      'dict:s2',
      'dict:s4',
      'dict:u-1',
      'pair:can-cant',
      'chunk:gonna',
      'chunk:kinda',
      'chunk:wanna',
      'lesson:l2',
      'media:m1:2',
    ]);
    const by = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(by['dict:s1'].touchedToday).toBe(true);
    expect(by['dict:u-1'].touchedToday).toBe(true);
    expect(by['dict:s2'].touchedToday).toBe(false);
    expect(by['dict:s4'].touchedToday).toBe(false);
    expect(by['pair:can-cant'].touchedToday).toBe(false);
    expect(by['pair:can-cant'].last).toBe(0);
    // studied today in the drill, learning step: hidden until tomorrow
    expect(by['chunk:gonna']).toMatchObject({
      touchedToday: true,
      availableAt: nextLocalMidnight(NOW),
      ref: 'gonna',
    });
    expect(by['chunk:gonna'].last).toBeUndefined();
    expect(by['chunk:kinda']).toMatchObject({
      touchedToday: false,
      availableAt: NOW - 1000,
    });
    expect(by['chunk:wanna'].availableAt).toBe(startOfLocalDay(NOW - DAY_MS));
    expect(by['media:m1:2']).toMatchObject({ kind: 'media', ref: 'm1:2' });
  });

  it('studied chunks from another day are not touched', () => {
    const drill = emptyDrillStore(NOW - 2 * DAY_MS);
    drill.cards = {
      gonna: { ...newCard('gonna', NOW), interval: 0, due: NOW - 1000 },
    };
    drill.daily.studiedIds = ['gonna'];
    const [e] = collectEntries(store(), drill, catalog, NOW);
    expect(e).toMatchObject({ touchedToday: false, availableAt: NOW - 1000 });
  });
});

describe('admitToday', () => {
  it('budget in seconds; the last admitted item may overshoot', () => {
    const a = admitToday(many('dict', 20), store(), 600, NOW);
    expect(a.admitted).toHaveLength(15); // 15 × 40 s = 600 s
    expect(a.held).toHaveLength(5);
    const b = admitToday(many('dict', 20), store(), 590, NOW);
    expect(b.admitted).toHaveLength(15); // 14 × 40 = 560 < 590 → 15th admitted
  });

  it('touched-today items are exempt', () => {
    const list = many('dict', 20).map((e, i) => (i < 3 ? { ...e, touchedToday: true } : e));
    const a = admitToday(list, store(), 600, NOW);
    expect(a.touched).toHaveLength(3);
    expect(a.admitted).toHaveLength(15);
    expect(a.held).toHaveLength(2);
  });

  it('what was reviewed today is spent; extraSec raises the budget', () => {
    const spent = store((s) =>
      ['a', 'b', 'c', 'd', 'e'].reduce((x, r) => withReviewed(x, `dict:${r}` as CardId, NOW), s),
    );
    expect(admitToday(many('dict', 20), spent, 600, NOW).admitted).toHaveLength(10);
    const extra = store((s) => ({
      ...s,
      daily: { ...s.daily, extraSec: 300 },
    }));
    expect(admitToday(many('dict', 30), extra, 600, NOW).admitted).toHaveLength(23);
    // yesterday's counters do not count
    const old = store((s) => ({
      ...s,
      daily: {
        day: '2001-01-01',
        ids: ['dict:a'],
        exempt: [],
        extraSec: 900,
        enrolled: 3,
      },
    }));
    expect(admitToday(many('dict', 30), old, 600, NOW).admitted).toHaveLength(15);
  });

  it('learning first, then most overdue; not-due entries are ignored', () => {
    const list = [
      entry('dict:old', { due: NOW - 5 * DAY_MS }),
      entry('dict:learn', {
        interval: 0,
        reps: 0,
        due: NOW - 60_000,
        lastGrade: 'again',
      }),
      entry('pair:p', { due: NOW - 2 * DAY_MS }),
      entry('dict:future', { due: NOW + 3 * DAY_MS }),
    ];
    const a = admitToday(list, store(), 600, NOW);
    expect(a.admitted.map((e) => e.id)).toEqual(['dict:learn', 'dict:old', 'pair:p']);
  });

  it('at most LESSON_PER_DAY lessons, counting the ones reviewed today', () => {
    const lessons = many('lesson', 6);
    const a = admitToday(lessons, store(), 6000, NOW);
    expect(a.admitted).toHaveLength(LESSON_PER_DAY);
    // over the lesson cap: deferred, not held (no back-pressure)
    expect(a.held).toHaveLength(0);
    expect(a.deferred).toHaveLength(2);
    const done = store((s) => withReviewed(withReviewed(s, 'lesson:x', NOW), 'lesson:y', NOW));
    expect(admitToday(lessons, done, 6000, NOW).admitted).toHaveLength(2);
  });

  it('reviews of items touched today (daily.exempt) spend no budget: fresh due items stay admitted', () => {
    const fresh = many('dict', 10);
    const touched = Array.from({ length: 15 }, (_, i) => makeCardId('dict', `t${String(i).padStart(2, '0')}`));
    const s = store((st) => touched.reduce((acc, id) => withReviewed(acc, id, NOW, true), st));
    const a = admitToday(fresh, s, 600, NOW);
    expect(a.admitted).toHaveLength(10);
    expect(a.held).toHaveLength(0);
    const sum = summarize(fresh, s, 600, NOW);
    expect(sum).toMatchObject({
      reviewedToday: 15,
      spentSec: 0,
      capLeftSec: 600,
      heldBack: 0,
      enrolLeft: NEW_ENROL_PER_DAY,
    });
    // the same reviews without the exemption spend the budget
    const spent = store((st) => touched.reduce((acc, id) => withReviewed(acc, id, NOW), st));
    expect(summarize(fresh, spent, 600, NOW)).toMatchObject({
      capLeftSec: 0,
      heldBack: 10,
      enrolLeft: 0,
    });
  });

  it('lessons over the daily cap are deferred: no back-pressure, enrolLeft unchanged', () => {
    const sum = summarize(many('lesson', 6), store(), 600, NOW);
    expect(sum).toMatchObject({
      dueToday: LESSON_PER_DAY,
      heldBack: 0,
      deferred: 2,
      enrolLeft: NEW_ENROL_PER_DAY,
    });
  });

  it('never-graded catch-up waits after graded items and never turns back-pressure on', () => {
    const graded = many('dict', 12, { due: NOW - HOUR });
    const seeded = Array.from({ length: 12 }, (_, i) =>
      entry(makeCardId('dict', `seed${String(i).padStart(2, '0')}`), {
        due: NOW - 5 * DAY_MS,
        lastGrade: undefined,
      }),
    );
    const a = admitToday([...seeded, ...graded], store(), 600, NOW);
    // graded first even though the catch-up is more overdue
    expect(a.admitted.slice(0, 12).every((e) => e.state.lastGrade === 'good')).toBe(true);
    expect(a.held).toHaveLength(0);
    expect(a.deferred.length).toBeGreaterThan(0);
    const sum = summarize([...seeded, ...graded], store(), 600, NOW);
    expect(sum.heldBack).toBe(0);
    expect(sum.enrolLeft).toBe(NEW_ENROL_PER_DAY);
    expect(sum.due).toBe(sum.dueToday + sum.heldBack + sum.deferred);
    // graded items over the budget still hold back
    expect(summarize(many('dict', 20), store(), 600, NOW)).toMatchObject({
      heldBack: 5,
      deferred: 0,
      enrolLeft: 0,
    });
  });

  it('a suspend toggle today does not make a card touched today', () => {
    const cat = buildCatalog({
      builtinSentenceIds: new Set(['s1']),
      customSentenceIds: new Set(),
      lessonIds: new Set(),
      chunkIds: new Set(),
      pairSetIds: new Set(),
      media: new Map(),
    });
    const old = rc('dict:s1', {
      last: NOW - 7 * DAY_MS,
      seenAt: NOW - 7 * DAY_MS,
    });
    const on = suspendCardState(old, true, NOW - 3 * DAY_MS)!;
    const off = suspendCardState(on, false, NOW)!;
    expect(off.last).toBe(NOW);
    const [e] = collectEntries(withCard(store(), off), emptyDrillStore(NOW), cat, NOW);
    expect(e.touchedToday).toBe(false);
    // a card from before seenAt existed: the suspend freezes its old `last`
    const legacy = suspendCardState(suspendCardState(rc('dict:s1'), true, NOW)!, false, NOW + 1)!;
    expect(legacy.seenAt).toBe(NOW - 3 * DAY_MS);
    expect(collectEntries(withCard(store(), legacy), emptyDrillStore(NOW), cat, NOW + 2)[0].touchedToday).toBe(false);
  });

  it('ids in `later` go last', () => {
    const list = many('dict', 4);
    const later = new Set<CardId>([list[3].id, list[0].id]);
    const a = admitToday(list, store(), 600, NOW, later);
    expect(a.admitted.map((e) => e.id)).toEqual([list[2].id, list[1].id, list[3].id, list[0].id]);
  });
});

describe('summarize', () => {
  it('counts due, today, held back and budget', () => {
    const list = [...many('dict', 20), ...many('pair', 2, { due: NOW + 2 * DAY_MS })];
    const s = store((x) => withEnrolled(withReviewed(x, 'chunk:a', NOW), NOW));
    const sum = summarize(list, s, 600, NOW);
    expect(sum).toMatchObject({
      now: NOW,
      tracked: 22,
      due: 20,
      dueToday: 15, // 600 − 12 s spent → 588 s → 15 × 40
      dueTodaySec: 600,
      minutesToday: 10,
      heldBack: 5,
      heldBackSec: 200,
      reviewedToday: 1,
      budgetSec: 600,
      spentSec: KIND_SECONDS.chunk,
      capLeftSec: 588,
      enrolLeft: 0, // held back
      suspended: 0,
      nextAt: startOfLocalDay(NOW, 2),
    });
    expect(sum.dueByKind).toEqual({
      dict: 20,
      pair: 0,
      chunk: 0,
      lesson: 0,
      media: 0,
      word: 0,
    });
    expect(sum.backlogClears).toBe(true);
  });

  it('enrolLeft when nothing is held back; extraSec in budgetSec; nothing due', () => {
    const two = store((x) => withEnrolled(withEnrolled(x, NOW), NOW));
    const s: ReviewStore = { ...two, daily: { ...two.daily, extraSec: 300 } };
    const sum = summarize(many('dict', 2), s, 600, NOW);
    expect(sum).toMatchObject({
      heldBack: 0,
      enrolLeft: NEW_ENROL_PER_DAY - 2,
      budgetSec: 900,
      dueToday: 2,
      minutesToday: 2,
    });
    const empty = summarize([], store(), 600, NOW);
    expect(empty).toMatchObject({
      tracked: 0,
      due: 0,
      dueToday: 0,
      minutesToday: 0,
      nextAt: null,
      enrolLeft: NEW_ENROL_PER_DAY,
    });
  });

  it('backlogClears is false when the next week is already full', () => {
    const tomorrowOn = Array.from({ length: 7 }, (_, k) => many('dict', 15, { due: startOfLocalDay(NOW, k + 1) + k }));
    const list = [...many('dict', 40), ...tomorrowOn.flat().map((e, i) => ({ ...e, id: `dict:f${i}` as CardId }))];
    const sum = summarize(list, store(), 600, NOW);
    expect(sum.heldBack).toBe(25);
    expect(sum.backlogClears).toBe(false);
  });

  it('suspended: only cards whose content exists when a catalog is given', () => {
    const s = store((x) =>
      withCard(withCard(x, rc('dict:a', { suspended: true })), rc('dict:gone', { suspended: true })),
    );
    expect(summarize([], s, 600, NOW).suspended).toBe(2);
    expect(summarize([], s, 600, NOW, { has: (id) => id === 'dict:a' }).suspended).toBe(1);
  });
});

describe('buildReviewQueue', () => {
  it('about one session: dict items until 300 s', () => {
    const q = buildReviewQueue(many('dict', 20), store(), 6000, NOW);
    expect(q).toHaveLength(8); // 7 × 40 = 280 < 300 → 8th
  });

  it('at least MIN_SESSION_ITEMS, at most MAX_SESSION_ITEMS', () => {
    expect(
      buildReviewQueue(many('dict', 20), store(), 6000, NOW, {
        sessionSec: 30,
      }),
    ).toHaveLength(5);
    expect(buildReviewQueue(many('dict', 3), store(), 6000, NOW, { sessionSec: 30 })).toHaveLength(3);
    expect(buildReviewQueue(many('chunk', 40), store(), 6000, NOW)).toHaveLength(25);
    expect(
      buildReviewQueue(many('chunk', 40), store(), 60000, NOW, {
        sessionSec: 100000,
      }),
    ).toHaveLength(MAX_SESSION_ITEMS);
  });

  it('serves only what today admits (budget)', () => {
    expect(
      buildReviewQueue(many('dict', 20), store(), 120, NOW, {
        sessionSec: 1000,
      }),
    ).toHaveLength(3);
  });

  it('at most LESSON_PER_SESSION lessons', () => {
    const q = buildReviewQueue([...many('lesson', 4), ...many('dict', 3)], store(), 6000, NOW);
    expect(q.filter((id) => id.startsWith('lesson:'))).toHaveLength(2);
  });

  it('fills a short session with learning cards due within LEARN_AHEAD_MS', () => {
    const list = [
      entry('dict:a'),
      entry('dict:soon', {
        interval: 0,
        reps: 0,
        due: NOW + 10 * 60_000,
        lastGrade: 'again',
      }),
      entry('dict:late', {
        interval: 0,
        reps: 0,
        due: NOW + 30 * 60_000,
        lastGrade: 'again',
      }),
      entry('dict:grad', { due: startOfLocalDay(NOW, 1) }),
    ];
    expect(buildReviewQueue(list, store(), 6000, NOW)).toEqual(['dict:a', 'dict:soon']);
  });

  it('kinds restricts every step', () => {
    const list = [...many('dict', 5), ...many('pair', 2), entry('pair:soon', { interval: 0, due: NOW + 60_000 })];
    expect(buildReviewQueue(list, store(), 6000, NOW, { kinds: ['pair'] })).toEqual([
      'pair:pair01',
      'pair:pair00',
      'pair:soon',
    ]);
  });

  it('later ids go last (and drop out of a full session)', () => {
    const list = many('dict', 10);
    const later = new Set<CardId>([list[9].id]);
    const q = buildReviewQueue(list, store(), 6000, NOW, { later });
    expect(q).not.toContain(list[9].id);
    expect(q[0]).toBe(list[8].id);
  });

  it('tap kinds first, typing kinds after, in short blocks', () => {
    const list = [...many('dict', 4), ...many('pair', 4), ...many('chunk', 2)];
    const q = buildReviewQueue(list, store(), 6000, NOW, { sessionSec: 10000 });
    expect(q.map((id) => id.split(':')[0])).toEqual([
      'pair',
      'pair',
      'pair',
      'chunk',
      'chunk',
      'pair',
      'dict',
      'dict',
      'dict',
      'dict',
    ]);
  });

  it('is deterministic', () => {
    const list = [...many('dict', 6), ...many('pair', 3), ...many('lesson', 1)];
    expect(buildReviewQueue(list, store(), 6000, NOW)).toEqual(buildReviewQueue(list, store(), 6000, NOW));
  });
});

describe('interleaveByKind', () => {
  const e = (id: string) => ({ id: id as CardId, kind: parseCardId(id)!.kind });
  const ids = (xs: { id: CardId }[]) => xs.map((x) => x.id.split(':')[1]);

  it('matches the spec examples', () => {
    const a = ['dict:d1', 'dict:d2', 'dict:d3', 'dict:d4', 'pair:p1', 'chunk:c1', 'pair:p2'].map(e);
    expect(ids(interleaveByKind(a))).toEqual(['p1', 'p2', 'c1', 'd1', 'd2', 'd3', 'd4']);
    const b = ['pair:p1', 'pair:p2', 'pair:p3', 'pair:p4', 'chunk:c1', 'chunk:c2'].map(e);
    expect(ids(interleaveByKind(b))).toEqual(['p1', 'p2', 'p3', 'c1', 'c2', 'p4']);
    const c = ['media:m1', 'dict:d1', 'lesson:l1', 'media:m2'].map(e);
    expect(ids(interleaveByKind(c))).toEqual(['l1', 'm1', 'm2', 'd1']);
  });

  it('spreads phenomena inside a block when possible, stable otherwise', () => {
    const ph: Record<string, string> = {
      'dict:d1': 'linking',
      'dict:d2': 'linking',
      'dict:d3': 'flap',
      'dict:d4': 'flap',
    };
    const of = (id: CardId) => ph[id];
    const list = ['dict:d1', 'dict:d2', 'dict:d3'].map(e);
    expect(ids(interleaveByKind(list, of))).toEqual(['d1', 'd3', 'd2']);
    const same = ['dict:d1', 'dict:d2'].map(e);
    expect(ids(interleaveByKind(same, of))).toEqual(['d1', 'd2']);
    // carried across blocks: d4 (flap) follows d3 (flap) only if nothing else is left
    const four = ['dict:d1', 'dict:d3', 'dict:d2', 'dict:d4'].map(e);
    expect(ids(interleaveByKind(four, of))).toEqual(['d1', 'd3', 'd2', 'd4']);
  });
});

describe('forecast / kindCounts / estimateMinutes / nextAvailable / statesByRef', () => {
  const list = [
    entry('dict:over', { due: NOW - 5 * DAY_MS }),
    entry('dict:today', { interval: 0, due: NOW + 2 * HOUR }),
    entry('pair:tomorrow', { due: startOfLocalDay(NOW, 1) + 3 * HOUR }),
    entry('lesson:d6', { due: startOfLocalDay(NOW, 6) }),
    entry('chunk:d7', { due: startOfLocalDay(NOW, 7) }),
    entry('media:m:1', { interval: 30, due: startOfLocalDay(NOW, 40) }),
  ];

  it('forecast: day 0 includes overdue; 7 days by default; seconds summed', () => {
    const f = forecast(list, NOW);
    expect(f).toHaveLength(7);
    expect(f[0]).toEqual({
      day: localDay(NOW),
      offset: 0,
      count: 2,
      seconds: 80,
    });
    expect(f[1]).toMatchObject({
      offset: 1,
      count: 1,
      seconds: KIND_SECONDS.pair,
      day: localDay(startOfLocalDay(NOW, 1)),
    });
    expect(f[6]).toMatchObject({ count: 1, seconds: KIND_SECONDS.lesson });
    expect(f.reduce((n, d) => n + d.count, 0)).toBe(4);
    expect(forecast(list, NOW, 8)[7].count).toBe(1);
  });

  it('kindCounts has every kind', () => {
    const k = kindCounts(list, NOW);
    expect(Object.keys(k).sort()).toEqual(['chunk', 'dict', 'lesson', 'media', 'pair', 'word']);
    expect(k.dict).toEqual({ tracked: 2, due: 1, learning: 2, mature: 0 });
    expect(k.media).toEqual({ tracked: 1, due: 0, learning: 0, mature: 1 });
  });

  it('estimateMinutes', () => {
    expect(estimateMinutes([])).toBe(1);
    expect(estimateMinutes(['dict:a', 'dict:b', 'dict:c'])).toBe(2);
    expect(estimateMinutes(['lesson:a', 'lesson:b'])).toBe(3);
    expect(estimateMinutes(['bogus' as CardId])).toBe(1);
  });

  it('nextAvailable (optionally per kind)', () => {
    expect(nextAvailable(list, NOW)).toBe(NOW + 2 * HOUR);
    expect(nextAvailable(list, NOW, 'pair')).toBe(startOfLocalDay(NOW, 1));
    expect(nextAvailable(list, NOW + 100 * DAY_MS)).toBeNull();
  });

  it('statesByRef', () => {
    expect(Object.keys(statesByRef(list, 'dict')).sort()).toEqual(['over', 'today']);
    expect(statesByRef(list, 'media')['m:1'].interval).toBe(30);
  });
});

// ───────────── 60-day simulation (budget 600 s, dict items) ─────────────

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function simGrade(id: string, day: number, step: number): Grade {
  const r = hash(`${id}|${day}|${step}`) % 100;
  return r < 85 ? 'good' : r < 95 ? 'hard' : 'again';
}

describe('simulation', () => {
  it('back-pressure keeps the backlog bounded over 60 days', () => {
    const drill = emptyDrillStore(NOW);
    const start = new Date(2026, 0, 5, 0, 0).getTime();
    let s = emptyReviewStore(start);
    let next = 0;
    const held: number[] = [];

    for (let d = 0; d < 60; d++) {
      const morning = startOfLocalDay(start, d) + 8 * HOUR;
      const entries0 = collectEntries(s, drill, ALL, morning);
      const startHeld = summarize(entries0, s, 600, morning).heldBack;
      held.push(startHeld);

      // Review everything served today (sessions until the queue is empty; `again` comes back in-session).
      let t = morning;
      for (let pass = 0; pass < 40; pass++) {
        const entries = collectEntries(s, drill, ALL, t);
        const q = buildReviewQueue(entries, s, 600, t);
        if (!q.length) break;
        for (const id of q) {
          const r = applyReview(s.cards[id], id, simGrade(id, d, pass), {
            ctx: 'review',
            enrol: true,
            enrolLeft: 0,
            now: t,
          });
          if (r.card) s = withCard(s, r.card);
          if (r.reason === 'graded' || r.reason === 'lapsed') s = withReviewed(s, id, t);
          t += 40_000;
        }
        t += 2 * 60_000;
      }

      // New material only when nothing was held back this morning.
      if (startHeld === 0) {
        let tt = startOfLocalDay(start, d) + 18 * HOUR;
        for (let i = 0; i < 30; i++) {
          const id = makeCardId('dict', `n${next++}`);
          const fail = hash(id) % 100 < 20;
          const enrolLeft = summarize(collectEntries(s, drill, ALL, tt), s, 600, tt).enrolLeft;
          const r = applyReview(undefined, id, fail ? 'again' : 'good', {
            ctx: 'practice',
            enrol: true,
            enrolLeft,
            now: tt,
          });
          if (r.card) s = withCard(s, r.card);
          if (r.reason === 'enrolled' && r.budgeted) s = withEnrolled(s, tt);
          tt += 60_000;
        }
      }
    }

    expect(Math.max(...held)).toBeLessThanOrEqual(45);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(held.slice(30))).toBeLessThanOrEqual(mean(held.slice(0, 30)) + 5);
    // the learner did get new material in
    expect(Object.keys(s.cards).length).toBeGreaterThan(100);
  });
});
