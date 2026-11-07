// IO layer, against a fake localStorage. Each test imports fresh modules (module-level session state).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX } from '../storage';
import { SENTENCES } from '../../data/sentences';
import { NEW_ENROL_PER_DAY, SEED_PER_DAY, WORD_NEW_PER_DAY } from './constants';
import { localDay, startOfLocalDay } from './time';

const NOW = new Date(2026, 4, 10, 12, 0).getTime();
const DAY_MS = 86_400_000;
const P = STORAGE_PREFIX;
const REVIEW = P + 'review-cards';
const DRILL = P + 'drill-cards';
const S = SENTENCES.slice(0, 8).map((s) => s.id);

let map: Map<string, string>;
let sets: string[];
let failNext: Set<string>;

beforeEach(() => {
  map = new Map();
  sets = [];
  failNext = new Set();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failNext.delete(k)) throw new Error('QuotaExceededError');
        sets.push(k);
        map.set(k, v);
      },
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: () => {},
  });
});

afterEach(() => vi.unstubAllGlobals());

async function fresh() {
  vi.resetModules();
  return import('./api');
}

const stored = () => JSON.parse(map.get(REVIEW) ?? 'null');

describe('review api', () => {
  it('empty history: reconcile writes nothing; the snapshot is empty', async () => {
    const api = await fresh();
    api.ensureReconciled(NOW);
    expect(sets).toEqual([]);
    const snap = api.getReviewSnapshot(NOW);
    expect(snap.summary).toMatchObject({
      tracked: 0,
      dueToday: 0,
      enrolLeft: NEW_ENROL_PER_DAY,
      budgetSec: 600,
    });
    expect(sets).toEqual([]);
  });

  it('an over-budget success on a store with since 0 writes only since', async () => {
    map.set(
      REVIEW,
      JSON.stringify({
        version: 1,
        cards: {},
        daily: {
          day: localDay(NOW),
          ids: [],
          extraSec: 0,
          enrolled: NEW_ENROL_PER_DAY,
        },
      }),
    );
    const api = await fresh();
    const r = api.recordReview(`dict:${S[0]}`, 'good', {
      ctx: 'practice',
      enrol: true,
      now: NOW,
    });
    expect(r).toMatchObject({ card: null, reason: 'over-budget', saved: true });
    expect(sets).toEqual([REVIEW]);
    expect(stored()).toMatchObject({
      cards: {},
      since: NOW,
      daily: { enrolled: NEW_ENROL_PER_DAY },
    });
    // a second no-op answer writes nothing at all
    api.recordReview(`dict:${S[1]}`, 'good', {
      ctx: 'practice',
      enrol: true,
      now: NOW + 1,
    });
    expect(sets).toEqual([REVIEW]);
  });

  it('enrols, counts budgeted enrolments and reviewed ids', async () => {
    const api = await fresh();
    const a = api.recordReview(`dict:${S[0]}`, 'easy', {
      ctx: 'practice',
      enrol: true,
      now: NOW,
    });
    expect(a).toMatchObject({
      reason: 'enrolled',
      budgeted: true,
      saved: true,
    });
    expect(stored().daily.enrolled).toBe(1);
    const later = startOfLocalDay(NOW, 4) + 9 * 3_600_000;
    const b = api.recordReview(`dict:${S[0]}`, 'good', {
      ctx: 'review',
      enrol: true,
      now: later,
    });
    expect(b.reason).toBe('graded');
    expect(stored().daily).toMatchObject({
      day: localDay(later),
      ids: [`dict:${S[0]}`],
      enrolled: 0,
    });
    expect(
      api.recordReview('chunk:gonna', 'good', {
        ctx: 'review',
        enrol: true,
        now: later,
      }).reason,
    ).toBe('not-enrolled');
  });

  it('grades that change a schedule feed the progress archive (core/history)', async () => {
    const api = await fresh();
    api.recordReview(`dict:${S[0]}`, 'easy', { ctx: 'practice', enrol: true, now: NOW });
    expect(map.has(P + 'progress-history')).toBe(false); // an enrolment is not a grade
    const prev = stored().cards[`dict:${S[0]}`];
    const graduated = prev.reps > 0 && prev.interval >= 1;
    const later = startOfLocalDay(NOW, 6) + 9 * 3_600_000;
    expect(api.recordReview(`dict:${S[0]}`, 'good', { ctx: 'review', enrol: true, now: later }).reason).toBe('graded');
    const hist = JSON.parse(map.get(P + 'progress-history')!);
    const bucket = Object.values(hist.devices)[0] as Record<string, { grades?: Record<string, number>; ret?: { n: number } }>;
    expect(bucket[localDay(later)].grades).toEqual({ again: 0, hard: 0, good: 1, easy: 0 });
    expect(bucket[localDay(later)].ret?.n ?? 0).toBe(graduated ? 1 : 0);
  });

  it('a failed save keeps the change in memory; the next save includes both', async () => {
    const api = await fresh();
    failNext.add(REVIEW);
    const a = api.recordReview(`dict:${S[0]}`, 'again', {
      ctx: 'practice',
      enrol: true,
      now: NOW,
    });
    expect(a).toMatchObject({ reason: 'enrolled', saved: false });
    expect(map.has(REVIEW)).toBe(false);
    expect(api.readReviewStore(NOW).cards[`dict:${S[0]}`]).toBeDefined();
    expect(api.getReviewSnapshot(NOW + 1).summary.tracked).toBe(1);
    const b = api.recordReview(`dict:${S[1]}`, 'again', {
      ctx: 'practice',
      enrol: true,
      now: NOW + 10,
    });
    expect(b.saved).toBe(true);
    expect(Object.keys(stored().cards).sort()).toEqual([`dict:${S[0]}`, `dict:${S[1]}`].sort());
  });

  it("after a failed save, another tab's save is merged in, never overwritten", async () => {
    const tab1 = await fresh();
    failNext.add(REVIEW);
    expect(
      tab1.recordReview(`dict:${S[0]}`, 'again', {
        ctx: 'practice',
        enrol: true,
        now: NOW,
      }).saved,
    ).toBe(false);
    // another tab (its own modules) saves a card meanwhile
    const tab2 = await fresh();
    expect(
      tab2.recordReview(`dict:${S[1]}`, 'again', {
        ctx: 'practice',
        enrol: true,
        now: NOW + 5,
      }).saved,
    ).toBe(true);
    // tab 1 hears the storage event and grades a third item
    tab1.invalidateReview(NOW + 6, 'review-cards');
    expect(
      tab1.recordReview(`dict:${S[2]}`, 'again', {
        ctx: 'practice',
        enrol: true,
        now: NOW + 10,
      }).saved,
    ).toBe(true);
    expect(Object.keys(stored().cards).sort()).toEqual([`dict:${S[0]}`, `dict:${S[1]}`, `dict:${S[2]}`].sort());
  });

  it('cards of kinds this build does not know survive its saves', async () => {
    const shadow = {
      id: 'shadow:s1',
      due: NOW,
      interval: 4,
      ease: 2.5,
      reps: 2,
      lapses: 0,
      last: NOW - 1,
      x: 1,
    };
    map.set(
      REVIEW,
      JSON.stringify({
        version: 1,
        cards: { 'shadow:s1': shadow },
        daily: { day: localDay(NOW), ids: [] },
      }),
    );
    const api = await fresh();
    expect(api.getReviewSnapshot(NOW).summary.tracked).toBe(0); // ignored everywhere else
    expect(
      api.recordReview(`dict:${S[0]}`, 'again', {
        ctx: 'practice',
        enrol: true,
        now: NOW,
      }).saved,
    ).toBe(true);
    expect(stored().cards['shadow:s1']).toEqual(shadow);
    expect(stored().cards[`dict:${S[0]}`]).toBeDefined();
  });

  it('a review of an item touched today (practice failure) does not spend the daily budget', async () => {
    const api = await fresh();
    for (let i = 0; i < 6; i++)
      api.recordReview(`dict:${S[i]}`, 'again', {
        ctx: 'practice',
        enrol: true,
        now: NOW,
      });
    const t = NOW + 2 * 3_600_000; // learning steps due
    const before = api.getReviewSnapshot(t).summary;
    expect(before).toMatchObject({ dueToday: 6, spentSec: 0, heldBack: 0 });
    for (let i = 0; i < 6; i++)
      api.recordReview(`dict:${S[i]}`, 'good', {
        ctx: 'review',
        enrol: true,
        now: t + i,
      });
    expect(stored().daily.exempt).toHaveLength(6);
    expect(api.getReviewSnapshot(t + 10).summary).toMatchObject({
      reviewedToday: 6,
      spentSec: 0,
      capLeftSec: 600,
    });
  });

  it('reloadReview drops the in-memory copy', async () => {
    const api = await fresh();
    failNext.add(REVIEW);
    api.recordReview(`dict:${S[0]}`, 'again', {
      ctx: 'practice',
      enrol: true,
      now: NOW,
    });
    expect(api.readReviewStore(NOW).cards[`dict:${S[0]}`]).toBeDefined();
    api.reloadReview();
    expect(api.readReviewStore(NOW).cards[`dict:${S[0]}`]).toBeUndefined();
  });

  it('recordChunkReview: a not-due chunk with good writes nothing; a due one updates drill + review', async () => {
    map.set(
      DRILL,
      JSON.stringify({
        version: 1,
        newPerDay: 10,
        cards: {
          later: {
            due: NOW + 5 * DAY_MS,
            interval: 5,
            ease: 2.5,
            reps: 2,
            lapses: 0,
            lastGrade: 'good',
          },
          now: {
            due: NOW - DAY_MS,
            interval: 2,
            ease: 2.5,
            reps: 1,
            lapses: 0,
            lastGrade: 'good',
          },
        },
        daily: {
          day: localDay(NOW),
          newIntroduced: 0,
          extraNew: 0,
          reviews: 0,
          studiedIds: [],
        },
      }),
    );
    const api = await fresh();
    const r = api.recordChunkReview('later', 'good', NOW);
    expect(r).toMatchObject({ graded: false, saved: false });
    expect(r.state?.interval).toBe(5);
    expect(sets).toEqual([]);
    const d = api.recordChunkReview('now', 'good', NOW);
    expect(d).toMatchObject({ graded: true, saved: true });
    expect(d.state?.interval).toBeGreaterThan(2);
    // (plus the progress archive, core/history: a chunk graded in Ôn tập counts there)
    expect(sets.filter((k) => k !== P + 'progress-history' && k !== P + 'device-id')).toEqual([DRILL, REVIEW]);
    expect(map.has(P + 'progress-history')).toBe(true);
    const drill = JSON.parse(map.get(DRILL)!);
    expect(drill.daily).toMatchObject({ reviews: 1, studiedIds: ['now'] });
    expect(stored().daily.ids).toEqual(['chunk:now']);
    expect(stored().cards).toEqual({});
    // a miss on a not-due chunk is graded (relearn)
    expect(api.recordChunkReview('later', 'again', NOW).graded).toBe(true);
  });

  it('reconcile runs once per page load, raises the notice, and is idempotent', async () => {
    const weak = Object.fromEntries(
      S.slice(0, 6).map((id, i) => [id, { best: 0.4, attempts: 2, lastAt: NOW - DAY_MS + i }]),
    );
    map.set(P + 'dictation-progress', JSON.stringify(weak));
    map.set(
      P + 'lessons-progress',
      JSON.stringify({
        linking: { completedAt: NOW - 9 * DAY_MS, bestScore: 1, attempts: 1 },
      }),
    );
    let api = await fresh();
    api.ensureReconciled(NOW);
    expect(sets).toEqual([REVIEW]);
    const s = stored();
    expect(Object.keys(s.cards)).toHaveLength(7);
    expect(s.notice).toEqual({ count: 7, at: NOW });
    expect(s.since).toBe(NOW);
    api.ensureReconciled(NOW + 1);
    expect(sets).toHaveLength(1);
    api.reloadReview();
    api.ensureReconciled(NOW + 2);
    expect(sets).toHaveLength(1);
    // a new page load: still nothing to do
    api = await fresh();
    api.ensureReconciled(NOW + 3);
    expect(sets).toHaveLength(1);
    // the snapshot sees them; the callout can be dismissed
    expect(api.getReviewSnapshot(NOW + 4).summary.tracked).toBe(7);
    api.dismissSeedNotice(NOW + 5);
    expect(stored().noticeSeenAt).toBe(NOW + 5);
    api.dismissSeedNotice(NOW + 6);
    expect(sets).toHaveLength(2);
  });

  it('recordReview excludes its own id from the first reconcile', async () => {
    map.set(P + 'dictation-progress', JSON.stringify({ [S[0]]: { best: 0.4, attempts: 1, lastAt: NOW } }));
    const api = await fresh();
    const r = api.recordReview(`dict:${S[0]}`, 'again', {
      ctx: 'practice',
      enrol: true,
      now: NOW,
    });
    expect(r.reason).toBe('enrolled');
    expect(stored().cards[`dict:${S[0]}`]).toMatchObject({
      lastGrade: 'again',
      last: NOW,
    });
  });

  it('snapshot cache: same object until something changes', async () => {
    const api = await fresh();
    const a = api.getReviewSnapshot();
    expect(api.getReviewSnapshot()).toBe(a);
    let calls = 0;
    const off = api.subscribeReview(() => calls++);
    api.recordReview(`dict:${S[0]}`, 'again', {
      ctx: 'practice',
      enrol: true,
      now: NOW,
    });
    expect(calls).toBeGreaterThan(0);
    const b = api.getReviewSnapshot();
    expect(b).not.toBe(a);
    expect(b.version).toBeGreaterThan(a.version);
    expect(b.summary.tracked).toBe(1);
    off();
    // a write to an unrelated key does not invalidate
    const before = calls;
    const storage = await import('../storage');
    storage.saveJSON('stats', {});
    expect(calls).toBe(before);
    expect(api.getReviewSnapshot()).toBe(b);
    // getReviewSnapshot(now) recomputes for a different now
    expect(api.getReviewSnapshot(NOW + 99).now).toBe(NOW + 99);
  });

  it('enrolSeen, resetCard, suspendCard, unsuspendAll, unlockExtra', async () => {
    const api = await fresh();
    const id = `dict:${S[2]}` as const;
    expect(api.resetCard(id, NOW)).toBe(false);
    expect(sets).toEqual([]);
    expect(api.enrolSeen(id, NOW)).toBe(true);
    expect(api.enrolSeen(id, NOW + 1)).toBe(false);
    expect(stored().cards[id]).toMatchObject({ interval: 0, last: NOW });
    expect(api.suspendCard(id, true, NOW + 2)).toBe(true);
    expect(api.suspendCard(id, true, NOW + 3)).toBe(false);
    expect(api.suspendCard('chunk:gonna', true, NOW)).toBe(false);
    expect(api.getReviewSnapshot(NOW + 4).summary).toMatchObject({
      tracked: 0,
      suspended: 1,
    });
    expect(api.unsuspendAll(NOW + 5)).toBe(1);
    expect(api.unsuspendAll(NOW + 6)).toBe(0);
    expect(stored().cards[id].suspended).toBeUndefined();
    expect(api.resetCard(id, NOW + 7)).toBe(true);
    expect(stored().cards[id]).toMatchObject({
      last: NOW + 7,
      due: startOfLocalDay(NOW, 1),
    });
    expect(api.unlockExtra(NOW + 8)).toBe(true);
    expect(stored().daily.extraSec).toBe(300);
    expect(api.getReviewSnapshot(NOW + 9).summary.budgetSec).toBe(900);
  });

  it('reviewBudgetSec follows the setting (invalid values → default)', async () => {
    map.set(P + 'settings', JSON.stringify({ reviewMinutes: 15 }));
    let api = await fresh();
    expect(api.reviewBudgetSec()).toBe(900);
    map.set(P + 'settings', JSON.stringify({ reviewMinutes: 7 }));
    api = await fresh();
    expect(api.reviewBudgetSec()).toBe(600);
  });

  it('words: passing a lesson schedules its words at once; a first answer counts as a new word; suspend works', async () => {
    const { wordIndex } = await import('./words');
    const [lessonId, wordIds] = [...wordIndex().byLesson.entries()].find(([, ids]) => ids.length >= 3)!;
    // LessonView saves the pass, then records the lesson card
    map.set(
      P + 'lessons-progress',
      JSON.stringify({
        [lessonId]: { completedAt: NOW, bestScore: 1, attempts: 1 },
      }),
    );
    const api = await fresh();
    const r = api.recordReview(`lesson:${lessonId}`, 'good', {
      ctx: 'practice',
      enrol: true,
      firstGrade: 'good',
      now: NOW,
    });
    expect(r.reason).toBe('enrolled');
    const cards = stored().cards;
    for (const id of wordIds) expect(cards[id]).toMatchObject({ interval: 0, reps: 0, last: 0 });
    expect(cards[wordIds[0]].due).toBe(startOfLocalDay(NOW, 1)); // passed today → from tomorrow
    // not due today: nothing to serve yet, and a second pass adds nothing
    expect(api.getReviewSnapshot(NOW + 1).summary.dueToday).toBe(0);
    const before = JSON.stringify(cards);
    api.recordReview(`lesson:${lessonId}`, 'good', {
      ctx: 'practice',
      enrol: true,
      now: NOW + 2,
    });
    for (const id of wordIds) expect(JSON.stringify(stored().cards[id])).toBe(JSON.stringify(JSON.parse(before)[id]));

    // tomorrow: the words are served (budget 15 s each) and the first answer is a new word of the day
    const t = startOfLocalDay(NOW, 1) + 9 * 3_600_000;
    const snap = api.getReviewSnapshot(t);
    expect(snap.summary.dueByKind.word).toBeGreaterThanOrEqual(3);
    const a = api.recordReview(wordIds[0], 'good', {
      ctx: 'review',
      enrol: true,
      now: t,
    });
    expect(a).toMatchObject({ reason: 'graded', saved: true });
    expect(stored().daily).toMatchObject({
      newWords: 1,
      enrolled: 1,
      ids: [wordIds[0]],
    });
    // a second answer of the same (now graded) word is not new
    api.recordReview(wordIds[0], 'again', {
      ctx: 'review',
      enrol: true,
      now: t + 1000,
    });
    expect(stored().daily).toMatchObject({ newWords: 1, enrolled: 1 });
    // "Không ôn mục này nữa"
    expect(api.suspendCard(wordIds[1], true, t + 2000)).toBe(true);
    expect(api.getReviewSnapshot(t + 3000).entries.some((e) => e.id === wordIds[1])).toBe(false);
    expect(api.getReviewSnapshot(t + 3000).summary.suspended).toBe(1);
  });

  it('reconcile on page load admits words of lessons passed before the feature, a few a day', async () => {
    const { wordIndex } = await import('./words');
    const big = [...wordIndex().byLesson.entries()].filter(([, ids]) => ids.length > 0);
    const progress = Object.fromEntries(
      big.map(([id]) => [id, { completedAt: NOW - 30 * DAY_MS, bestScore: 0.8, attempts: 1 }]),
    );
    map.set(P + 'lessons-progress', JSON.stringify(progress));
    const api = await fresh();
    api.ensureReconciled(NOW);
    const cards = stored().cards as Record<string, { due: number }>;
    const words = Object.entries(cards).filter(([id]) => id.startsWith('word:'));
    expect(words.length).toBe(new Set(big.flatMap(([, ids]) => ids)).size);
    // words start today and are paced by the queue (WORD_NEW_PER_DAY), not by the seeding load
    expect(words.every(([, c]) => c.due <= NOW)).toBe(true);
    const lessonsToday = Object.entries(cards).filter(([id, c]) => !id.startsWith('word:') && c.due <= NOW).length;
    expect(lessonsToday).toBeLessThanOrEqual(SEED_PER_DAY);
    expect(stored().notice).toMatchObject({ count: Object.keys(cards).length, words: words.length });
    const sum = api.getReviewSnapshot(NOW).summary;
    expect(sum.dueByKind.word).toBe(words.length);
    expect(sum.wordsWaiting).toBeGreaterThanOrEqual(words.length - WORD_NEW_PER_DAY);
    // waiting words are no postponed due items
    expect(sum.deferred).toBeLessThanOrEqual(lessonsToday);
  });
});
