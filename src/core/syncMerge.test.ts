import { describe, expect, it } from 'vitest';
import { STORAGE_PREFIX } from './storage';
import {
  mergeCustomSentences,
  mergeData,
  mergeDictation,
  mergeDrill,
  mergeLessons,
  mergeListeningLog,
  mergeMedia,
  mergeOnboarding,
  mergePairs,
  mergeReview,
  mergeShadowing,
  mergeStats,
  mergeValue,
  STATS_MAX_ATTEMPTS,
} from './syncMerge';

const K = (k: string) => STORAGE_PREFIX + k;
const att = (at: number, itemId: string, seen: string[] = ['linking'], missed: string[] = []) => ({
  at,
  module: 'dictation',
  itemId,
  correct: missed.length === 0,
  seen,
  missed,
});

type StatsLike = {
  attempts: { at: number }[];
  byPhenomenon: Record<string, { seen: number; missed: number }>;
  activeDays: string[];
};

describe('mergeStats', () => {
  it('unions attempts, dedupes, sorts, and keeps counters exact after two machines diverged', () => {
    const shared = [att(1, 'a'), att(2, 'b', ['linking', 'flap'], ['flap'])];
    // Machine A (older file) did one more attempt, machine B (newer) did two more.
    const a = {
      attempts: [...shared, att(3, 'c')],
      byPhenomenon: { linking: { seen: 3, missed: 0 }, flap: { seen: 1, missed: 1 } },
      activeDays: ['2026-11-01'],
    };
    const b = {
      attempts: [...shared, att(4, 'd', ['flap'], ['flap']), att(5, 'e')],
      byPhenomenon: { linking: { seen: 3, missed: 0 }, flap: { seen: 2, missed: 2 } },
      activeDays: ['2026-11-01', '2026-11-02'],
    };
    const m = mergeStats(b, a) as StatsLike;
    expect(m.attempts.map((x) => x.at)).toEqual([1, 2, 3, 4, 5]);
    expect(m.byPhenomenon.linking).toEqual({ seen: 4, missed: 0 });
    expect(m.byPhenomenon.flap).toEqual({ seen: 2, missed: 2 });
    expect(m.activeDays).toEqual(['2026-11-01', '2026-11-02']);
    // symmetric
    expect(mergeStats(a, b)).toEqual(m);
  });

  it('is idempotent when one side already contains the other', () => {
    const a = { attempts: [att(1, 'a')], byPhenomenon: { linking: { seen: 1, missed: 0 } }, activeDays: ['2026-11-01'] };
    const b = { attempts: [att(1, 'a'), att(2, 'b')], byPhenomenon: { linking: { seen: 2, missed: 0 } }, activeDays: ['2026-11-01'] };
    const m = mergeStats(b, a) as StatsLike;
    expect(m.attempts).toHaveLength(2);
    expect(m.byPhenomenon.linking).toEqual({ seen: 2, missed: 0 });
  });

  it('caps attempts and does not double count attempts a full side already dropped', () => {
    // Older copy: attempts 0..9. The newer side went on to 1500 attempts and kept only the last 1000.
    const o = { attempts: Array.from({ length: 10 }, (_, i) => att(i, 'x' + i)), byPhenomenon: { linking: { seen: 10, missed: 0 } }, activeDays: [] };
    const full = Array.from({ length: STATS_MAX_ATTEMPTS }, (_, i) => att(500 + i, 'x' + (500 + i)));
    const n = { attempts: full, byPhenomenon: { linking: { seen: 1500, missed: 0 } }, activeDays: [] };
    const m = mergeStats(n, o) as StatsLike;
    expect(m.attempts).toHaveLength(STATS_MAX_ATTEMPTS);
    expect(m.attempts[0].at).toBe(500);
    expect(m.byPhenomenon.linking.seen).toBe(1500);
  });

  it('survives junk', () => {
    const m = mergeStats({ attempts: 'x', byPhenomenon: null }, { attempts: [null, { at: 'no' }, att(1, 'a')] }) as StatsLike;
    expect(m.attempts).toHaveLength(1);
    expect(m.byPhenomenon.linking.seen).toBe(1);
  });
});

describe('per-item progress', () => {
  it('dictation keeps the best of both per sentence', () => {
    const n = { s1: { best: 0.5, attempts: 3, lastAt: 100 }, s2: { best: 1, attempts: 1, lastAt: 50, cleanAt: 50 } };
    const o = { s1: { best: 0.9, attempts: 2, lastAt: 200, hints: 1, hintAt: 150 }, s3: { best: 0.2, attempts: 1, lastAt: 10 } };
    expect(mergeDictation(n, o)).toEqual({
      s1: { best: 0.9, attempts: 3, lastAt: 200, hints: 1, hintAt: 150 },
      s2: { best: 1, attempts: 1, lastAt: 50, cleanAt: 50 },
      s3: { best: 0.2, attempts: 1, lastAt: 10 },
    });
  });

  it('lessons keep the first pass, best score and most attempts', () => {
    const n = { intro: { completedAt: 500, bestScore: 0.8, attempts: 2 }, l2: { completedAt: 0, bestScore: 0.4, attempts: 1 } };
    const o = { intro: { completedAt: 300, bestScore: 0.7, attempts: 1 }, l2: { completedAt: 900, bestScore: 0.9, attempts: 2 } };
    expect(mergeLessons(n, o)).toEqual({
      intro: { completedAt: 300, bestScore: 0.8, attempts: 2 },
      l2: { completedAt: 900, bestScore: 0.9, attempts: 2 },
    });
  });

  it('pairs merge items and sets', () => {
    const n = { items: { a: { seen: 5, correct: 4, streak: 2, lastAt: 10 } }, sets: { s: { best: 0.5, plays: 3, lastAt: 10 } } };
    const o = { items: { a: { seen: 3, correct: 3, streak: 3, lastAt: 20 }, b: { seen: 1, correct: 0, streak: 0, lastAt: 5 } }, sets: {} };
    expect(mergePairs(n, o)).toEqual({
      items: { a: { seen: 5, correct: 4, streak: 3, lastAt: 20 }, b: { seen: 1, correct: 0, streak: 0, lastAt: 5 } },
      sets: { s: { best: 0.5, plays: 3, lastAt: 10 } },
    });
  });

  it('shadowing unions the recent attempts', () => {
    const n = { x: { attempts: [{ at: 1, score: 0.5 }, { at: 3, score: 0.7 }], total: 2, best: 0.7 } };
    const o = { x: { attempts: [{ at: 1, score: 0.5 }, { at: 2, score: 0.9 }], total: 2, best: 0.9 } };
    expect(mergeShadowing(n, o)).toEqual({
      x: { attempts: [{ at: 1, score: 0.5 }, { at: 2, score: 0.9 }, { at: 3, score: 0.7 }], total: 3, best: 0.9 },
    });
  });

  it('drill keeps the card with more history and merges same-day counters', () => {
    const card = (lapses: number, reps: number, due: number) => ({ id: 'c', due, interval: 1, ease: 2.5, reps, lapses });
    const n = {
      version: 1,
      newPerDay: 20,
      cards: { c: card(0, 3, 500), d: card(0, 1, 100) },
      daily: { day: '2026-11-06', newIntroduced: 2, extraNew: 0, reviews: 5, studiedIds: ['c'] },
    };
    const o = {
      version: 1,
      newPerDay: 10,
      cards: { c: card(1, 0, 50), e: card(0, 0, 1) },
      daily: { day: '2026-11-06', newIntroduced: 3, extraNew: 5, reviews: 1, studiedIds: ['e'] },
    };
    const m = mergeDrill(n, o) as { newPerDay: number; cards: Record<string, { lapses: number }>; daily: Record<string, unknown> };
    expect(m.newPerDay).toBe(20);
    expect(m.cards.c.lapses).toBe(1);
    expect(Object.keys(m.cards).sort()).toEqual(['c', 'd', 'e']);
    expect(m.daily).toEqual({ day: '2026-11-06', newIntroduced: 3, extraNew: 5, reviews: 5, studiedIds: ['c', 'e'] });
    const m2 = mergeDrill(n, { ...o, daily: { ...o.daily, day: '2026-11-05' } }) as { daily: { day: string }; otherDaily: { day: string } };
    expect(m2.daily.day).toBe('2026-11-06');
    expect(m2.otherDaily.day).toBe('2026-11-05'); // the earlier day's counters stay for a machine still on it
  });
});

describe('lists keyed by id', () => {
  it('custom sentences: union by id, newer version wins, ordered by createdAt', () => {
    const n = [
      { id: 'u-1', text: 'Hi there', vi: 'mới', level: 1, createdAt: 1 },
      { id: 'u-3', text: 'Three', vi: '', level: 1, createdAt: 3 },
    ];
    const o = [
      { id: 'u-1', text: 'Hi there', vi: 'cũ', level: 1, createdAt: 1 },
      { id: 'u-2', text: 'Two', vi: '', level: 1, createdAt: 2 },
    ];
    expect(mergeCustomSentences(n, o)).toEqual([n[0], o[1], n[1]]);
  });

  it('media library: union items, merge their progress', () => {
    const item = (id: string, openedAt: number, progress: unknown) => ({ id, kind: 'file', title: id, createdAt: 1, openedAt, units: [], progress });
    const n = { items: [item('a', 5, { unitIndex: 2, done: [0, 1], scores: { 0: 0.5 } })], prefs: { speed: 1 } };
    const o = { items: [item('a', 9, { unitIndex: 4, done: [3], scores: { 0: 0.9, 3: 1 } }), item('b', 1, { unitIndex: 0, done: [], scores: {} })], prefs: { speed: 0.5 } };
    const m = mergeMedia(n, o) as { items: { id: string; openedAt: number; progress: unknown }[]; prefs: unknown };
    expect(m.prefs).toEqual({ speed: 1 });
    expect(m.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(m.items[0].openedAt).toBe(9);
    expect(m.items[0].progress).toEqual({ unitIndex: 4, done: [0, 1, 3], scores: { 0: 0.9, 3: 1 } });
  });

  it('media library: lines heard on either machine stay heard (union), absent while none', () => {
    const item = (openedAt: number, heard?: number[]) => ({ id: 'a', kind: 'file', title: 'a', createdAt: 1, openedAt, units: [], progress: { unitIndex: 0, done: [], scores: {}, ...(heard ? { heard } : {}) } });
    const heardOf = (x: unknown, y: unknown) => (mergeMedia({ items: [x] }, { items: [y] }) as { items: { progress: { heard?: number[] } }[] }).items[0].progress.heard;
    expect(heardOf(item(5, [4, 1]), item(9, [2, 1]))).toEqual([1, 2, 4]);
    expect(heardOf(item(9, [2, 1]), item(5, [4, 1]))).toEqual([1, 2, 4]);
    expect(heardOf(item(5), item(9, [3]))).toEqual([3]);
    expect(heardOf(item(5), item(9))).toBeUndefined();
  });

  it('onboarding stays finished', () => {
    expect(mergeOnboarding({ done: false }, { done: true, at: 1 })).toEqual({ done: true, at: 1 });
    expect(mergeOnboarding({ done: true, at: 2 }, null)).toEqual({ done: true, at: 2 });
  });
});

describe('mergeData', () => {
  it('keeps keys from both sides, newer side wins plain settings, tolerates corrupt JSON', () => {
    const local = {
      [K('settings')]: JSON.stringify({ rate: 0.8 }),
      [K('only-local')]: '"L"',
      [K('stats')]: '{broken',
      [K('mystery')]: '"local"',
    };
    const remote = {
      [K('settings')]: JSON.stringify({ rate: 1.2 }),
      [K('only-remote')]: '"R"',
      [K('stats')]: JSON.stringify({ attempts: [att(1, 'a')], byPhenomenon: {}, activeDays: [] }),
      [K('mystery')]: '"remote"',
    };
    const m = mergeData(local, remote, true);
    expect(JSON.parse(m[K('settings')])).toEqual({ rate: 1.2 });
    expect(m[K('only-local')]).toBe('"L"');
    expect(m[K('only-remote')]).toBe('"R"');
    expect(JSON.parse(m[K('stats')]).attempts).toHaveLength(1);
    expect(m[K('mystery')]).toBe('"remote"');
    expect(JSON.parse(mergeData(local, remote, false)[K('settings')])).toEqual({ rate: 0.8 });
  });

  it('keeps the newer raw value when both sides are corrupt and ignores foreign keys', () => {
    expect(mergeValue('stats', '{a', '{b', false)).toBe('{a');
    expect(mergeData({ 'other:x': '1' }, {}, true)).toEqual({});
  });
});

describe('mergeReview (review-cards)', () => {
  const c = (over: Record<string, unknown> = {}) => ({
    id: 'dict:a',
    due: 1000,
    interval: 3,
    ease: 2.5,
    reps: 1,
    lapses: 0,
    last: 100,
    ...over,
  });
  const store = (cards: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
    version: 1,
    cards,
    daily: { day: '2026-11-06', ids: [], extraSec: 0, enrolled: 0 },
    since: 0,
    notice: null,
    noticeSeenAt: 0,
    ...over,
  });
  type Out = { cards: Record<string, Record<string, unknown>>; daily: Record<string, unknown>; [k: string]: unknown };
  const merge = (n: unknown, o: unknown) => mergeReview(n, o) as Out;
  const one = (n: Record<string, unknown>, o: Record<string, unknown>) =>
    merge(store({ 'dict:a': c(n) }), store({ 'dict:a': c(o) })).cards['dict:a'];

  it('the later `last` wins, whichever side is newer', () => {
    const early = c({ last: 100, interval: 30 });
    const late = c({ last: 200, interval: 1 });
    expect(merge(store({ 'dict:a': early }), store({ 'dict:a': late })).cards['dict:a']).toEqual(late);
    expect(merge(store({ 'dict:a': late }), store({ 'dict:a': early })).cards['dict:a']).toEqual(late);
  });

  it('ties: more reps, then longer interval, then more lapses, then later due; a full tie keeps the newer side', () => {
    expect(one({ reps: 1 }, { reps: 2 }).reps).toBe(2);
    expect(one({ interval: 3 }, { interval: 8 }).interval).toBe(8);
    expect(one({ lapses: 0 }, { lapses: 1 }).lapses).toBe(1);
    expect(one({ due: 5 }, { due: 9 }).due).toBe(9);
    expect(one({ ease: 2.1 }, { ease: 2.9 }).ease).toBe(2.1);
  });

  it('a seeded card (last 0) loses to a graded one', () => {
    const seeded = c({ last: 0, interval: 7, reps: 2 });
    const graded = c({ last: 50, interval: 1, reps: 1, lastGrade: 'good' });
    expect(merge(store({ 'dict:a': seeded }), store({ 'dict:a': graded })).cards['dict:a']).toEqual(graded);
  });

  it('a skewed future `last`, then a local regrade built on it, wins after merge', () => {
    const skewed = c({ last: 10_000_000, interval: 3 }); // written by a device with a fast clock
    // this device graded the merged copy at now = 5000: last = max(now, prev.last + 1)
    const regrade = c({ last: 10_000_001, interval: 8, reps: 2 });
    expect(merge(store({ 'dict:a': skewed }), store({ 'dict:a': regrade })).cards['dict:a']).toEqual(regrade);
  });

  it('suspension follows the later card', () => {
    expect(one({ last: 300, suspended: true }, { last: 400 }).suspended).toBeUndefined();
    expect(one({ last: 50 }, { last: 300, suspended: true }).suspended).toBe(true);
  });

  it('unions cards present on one side', () => {
    const m = merge(store({ 'dict:a': c() }), store({ 'pair:p': c({ id: 'pair:p' }) }));
    expect(Object.keys(m.cards).sort()).toEqual(['dict:a', 'pair:p']);
  });

  it('daily: same day → union ids (order kept), max extraSec / enrolled; different days → the later day', () => {
    const n = store({}, { daily: { day: '2026-11-06', ids: ['dict:b', 'dict:a', 7], extraSec: 0, enrolled: 2 } });
    const o = store({}, { daily: { day: '2026-11-06', ids: ['dict:a', 'chunk:c'], extraSec: 300, enrolled: 5 } });
    expect(merge(n, o).daily).toEqual({
      day: '2026-11-06',
      ids: ['dict:a', 'chunk:c', 'dict:b'],
      exempt: [],
      extraSec: 300,
      enrolled: 5,
    });
    const later = store({}, { daily: { day: '2026-11-07', ids: ['dict:z'], exempt: [], extraSec: 0, enrolled: 1 } });
    expect(merge(n, later).daily).toEqual(later.daily);
    expect(merge(later, n).daily).toEqual(later.daily);
    // the earlier day stays too, for a machine still on it (core/review/store picks the local day)
    expect(merge(later, n).otherDaily).toMatchObject({ day: '2026-11-06', ids: ['dict:b', 'dict:a'] });
    expect(merge({ cards: {} }, o).daily).toEqual({ ...o.daily, exempt: [] });
  });

  it('word cards merge like every kind (later `last` wins, junk never wins); newWords: max, absent stays absent', () => {
    const w = (over: Record<string, unknown>) => c({ id: 'word:read~red', ...over });
    const n = store({ 'word:read~red': w({ last: 100, interval: 0, reps: 0 }), 'word:colonel~KER-nəl': 'junk' }, {
      daily: { day: '2026-11-06', ids: ['word:read~red'], extraSec: 0, enrolled: 1, newWords: 1 },
    });
    const o = store({ 'word:read~red': w({ last: 200, interval: 1, reps: 1, lastGrade: 'good' }), 'word:colonel~KER-nəl': w({ id: 'word:colonel~KER-nəl', suspended: true }) }, {
      daily: { day: '2026-11-06', ids: ['word:colonel~KER-nəl'], extraSec: 0, enrolled: 3, newWords: 3 },
    });
    const m = merge(n, o);
    expect(m.cards['word:read~red']).toMatchObject({ last: 200, interval: 1, lastGrade: 'good' });
    expect(m.cards['word:colonel~KER-nəl']).toMatchObject({ suspended: true });
    expect(m.daily).toMatchObject({ ids: ['word:colonel~KER-nəl', 'word:read~red'], enrolled: 3, newWords: 3 });
    expect(merge(n, store({}, { daily: { day: '2026-11-06', ids: [], extraSec: 0, enrolled: 0 } })).daily.newWords).toBe(1);
    expect('newWords' in merge(store({}), store({})).daily).toBe(false);
  });

  it('since: min of the values > 0; noticeSeenAt: max; notice: the later one', () => {
    expect(merge(store({}, { since: 0 }), store({}, { since: 500 })).since).toBe(500);
    expect(merge(store({}, { since: 700 }), store({}, { since: 500 })).since).toBe(500);
    expect(merge(store({}, { since: 0 }), store({}, { since: 0 })).since).toBe(0);
    const m = merge(
      store({}, { notice: { count: 3, at: 10 }, noticeSeenAt: 4 }),
      store({}, { notice: { count: 9, at: 20 }, noticeSeenAt: 15 }),
    );
    expect(m.notice).toEqual({ count: 9, at: 20 });
    expect(m.noticeSeenAt).toBe(15);
    expect(merge(store({}, { notice: { count: 3, at: 10 } }), store({})).notice).toEqual({ count: 3, at: 10 });
  });

  it('a fresh card from a device that never got the mature one does not replace it (different lineage)', () => {
    const T0 = new Date(2026, 10, 6, 9, 0).getTime();
    const D = 86_400_000;
    const mature = c({ interval: 30, reps: 5, last: T0 - 10 * D, due: T0 + 20 * D, lastGrade: 'good', born: 1 });
    const freshMiss = c({ interval: 0, reps: 0, last: T0, due: T0 + 3_600_000, lastGrade: 'again', born: T0, seenAt: T0 });
    const freshGood = c({ interval: 1, reps: 1, last: T0, due: T0 + D, lastGrade: 'good', born: T0 });
    const seen = c({ interval: 0, reps: 0, last: T0, due: T0 + D, lastGrade: undefined, born: T0 });
    const both = (a: unknown, b: unknown, remoteNewer: boolean) =>
      remoteNewer ? merge(store({ 'dict:a': a }), store({ 'dict:a': b })) : merge(store({ 'dict:a': b }), store({ 'dict:a': a }));
    for (const remoteNewer of [true, false]) {
      for (const fresh of [freshGood, seen]) expect(both(mature, fresh, remoteNewer).cards['dict:a']).toEqual(mature);
      // a miss on the fresh copy keeps the mature interval but pulls the due date in to the next day at the latest
      const m = both(mature, freshMiss, remoteNewer);
      const next = new Date(2026, 10, 7).getTime();
      expect(m.cards['dict:a']).toMatchObject({ interval: 30, reps: 5, born: 1, due: next, lastGrade: 'again', last: T0 });
      // stable when merged again with either copy
      expect(merge(m, store({ 'dict:a': freshMiss })).cards['dict:a']).toEqual(m.cards['dict:a']);
      expect(merge(m, store({ 'dict:a': mature })).cards['dict:a']).toEqual(m.cards['dict:a']);
    }
    // same lineage: the later `last` still wins (a lapse is kept)
    const lapse = c({ interval: 8, reps: 1, lapses: 1, last: T0, lastGrade: 'again', born: 1 });
    expect(merge(store({ 'dict:a': lapse }), store({ 'dict:a': mature })).cards['dict:a']).toEqual(lapse);
    // a graded copy beats a never-graded (reconciled) one from another device whatever the intervals
    const seeded = c({ interval: 3, reps: 1, last: 0, lastGrade: undefined, born: 5 });
    const lapsed = c({ interval: 1, reps: 1, lapses: 1, last: T0, lastGrade: 'again', born: 9 });
    expect(merge(store({ 'dict:a': seeded }), store({ 'dict:a': lapsed })).cards['dict:a']).toEqual(lapsed);
  });

  it('daily.exempt: union, minus ids that spent budget on either side', () => {
    const day = '2026-11-06';
    const n = store({}, { daily: { day, ids: ['dict:a', 'dict:b'], exempt: ['dict:a', 'dict:b'], extraSec: 0, enrolled: 0 } });
    const o = store({}, { daily: { day, ids: ['dict:b', 'dict:c'], exempt: ['dict:c'], extraSec: 0, enrolled: 0 } });
    expect(merge(n, o).daily).toMatchObject({ ids: ['dict:b', 'dict:c', 'dict:a'], exempt: ['dict:c', 'dict:a'] });
  });

  it('tolerates junk', () => {
    expect(merge('x', [1, 2])).toMatchObject({ cards: {}, since: 0, notice: null, noticeSeenAt: 0 });
    // a corrupt card value never replaces a valid one (on either side); junk on both sides: the newer junk
    for (const junk of [null, 'nope', 7, []]) {
      expect(merge(store({ 'dict:a': junk }), store({ 'dict:a': c() })).cards['dict:a']).toEqual(c());
      expect(merge(store({ 'dict:a': c() }), store({ 'dict:a': junk })).cards['dict:a']).toEqual(c());
    }
    expect(merge(store({ 'dict:a': 'nope' }), store({ 'dict:a': 7 })).cards['dict:a']).toBe('nope');
    const unsafe = JSON.parse('{"cards":{"__proto__":{"last":5}}}');
    expect(Object.keys(merge(unsafe, store({})).cards)).toEqual([]);
  });

  it('mergeData routes the review key', () => {
    const local = { [K('review-cards')]: JSON.stringify(store({ 'dict:a': c({ last: 100 }) })) };
    const remote = {
      [K('review-cards')]: JSON.stringify(store({ 'dict:a': c({ last: 900, interval: 9 }), 'dict:b': c({ id: 'dict:b' }) })),
    };
    const merged = JSON.parse(mergeData(local, remote, false)[K('review-cards')]);
    expect(merged.cards['dict:a'].interval).toBe(9);
    expect(Object.keys(merged.cards).sort()).toEqual(['dict:a', 'dict:b']);
  });
});

describe('listening-log (Nhật ký nghe)', () => {
  const e = (id: string, updatedAt: number, minutes = 30) => ({ id, startedAt: 1, day: '2026-11-06', minutes, source: 'phim', updatedAt });
  const tomb = (id: string, updatedAt: number) => ({ id, updatedAt, deleted: true });
  type Log = { version: number; entries: Record<string, unknown>[] };

  it('unions by id and keeps the newer edit', () => {
    const a = { version: 1, entries: [e('x', 10, 30), e('y', 5)] };
    const b = { version: 1, entries: [e('x', 20, 45), e('z', 7)] };
    const m = mergeListeningLog(a, b) as Log;
    expect(m.entries.map((x) => x.id)).toEqual(['x', 'y', 'z']);
    expect(m.entries[0].minutes).toBe(45);
  });

  it('propagates deletes: a newer tombstone wins, and wins a tie', () => {
    const live = { version: 1, entries: [e('x', 10)] };
    const gone = { version: 1, entries: [tomb('x', 11)] };
    expect((mergeListeningLog(live, gone) as Log).entries).toEqual([tomb('x', 11)]);
    expect((mergeListeningLog(gone, live) as Log).entries).toEqual([tomb('x', 11)]);
    expect((mergeListeningLog({ entries: [e('x', 11)] }, gone) as Log).entries).toEqual([tomb('x', 11)]);
    // an undo after the delete (newer updatedAt) brings it back everywhere
    expect((mergeListeningLog(gone, { entries: [e('x', 12)] }) as Log).entries).toEqual([e('x', 12)]);
  });

  it('is idempotent, commutative and associative', () => {
    const a = { version: 1, entries: [e('x', 10), tomb('w', 3), e('v', 4, 15)] };
    const b = { version: 1, entries: [e('x', 10, 50), e('y', 2)] }; // same updatedAt, different content: deterministic pick
    const c = { version: 1, entries: [tomb('y', 9), e('u', 1)] };
    const ab = mergeListeningLog(a, b);
    expect(mergeListeningLog(b, a)).toEqual(ab);
    expect(mergeListeningLog(ab, ab)).toEqual(ab);
    expect(mergeListeningLog(mergeListeningLog(a, b), c)).toEqual(mergeListeningLog(a, mergeListeningLog(b, c)));
    expect(mergeListeningLog(c, mergeListeningLog(b, a))).toEqual(mergeListeningLog(mergeListeningLog(a, c), b));
  });

  it('drops junk records and accepts a bare array', () => {
    const m = mergeListeningLog([null, 'x', { id: 7 }, { id: 'a' }, e('ok', 1)], { entries: 'nope' }) as Log;
    expect(m.entries).toEqual([e('ok', 1)]);
    expect(m.version).toBe(1);
  });

  it('is wired into mergeData for the new synced keys', () => {
    const local = { [K('listening-log')]: JSON.stringify({ version: 1, entries: [e('a', 1)] }) };
    const remote = { [K('listening-log')]: JSON.stringify({ version: 1, entries: [e('b', 2)] }) };
    const out = mergeData(local, remote, true);
    expect((JSON.parse(out[K('listening-log')]) as Log).entries.map((x) => x.id)).toEqual(['a', 'b']);
    const ck = mergeValue('checkup-results', '{"results":[{"id":"k1","at":1}]}', '{"results":[{"id":"k2","at":2}]}', true);
    expect(JSON.parse(ck).results).toHaveLength(2);
    const h = mergeValue('progress-history', '{"devices":{"a":{"2026-11-01":{"words":1}}}}', '{"devices":{"b":{"2026-11-01":{"words":2}}}}', true);
    expect(Object.keys(JSON.parse(h).devices)).toEqual(['a', 'b']);
  });
});
