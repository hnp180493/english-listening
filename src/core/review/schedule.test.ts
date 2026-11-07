import { describe, expect, it } from 'vitest';
import { HARD_LEARNING_MS, MIN_EASE, newCard, RELEARN_MS, START_EASE, type CardState, type Grade } from '../srs';
import { PRACTICE_STEP_MS } from './constants';
import {
  applyReview,
  enrolSeenCard,
  gradeAuto,
  isEffectivelyDue,
  nextLast,
  resetCardState,
  suspendCardState,
  type ApplyOptions,
} from './schedule';
import { nextLocalMidnight, startOfLocalDay } from './time';
import type { CardId, ReviewCard } from './types';

const NOW = new Date(2026, 4, 10, 12, 0).getTime(); // 10 May 2026, 12:00 local
const DAY_MS = 86_400_000;
const day = (n: number, from = NOW) => startOfLocalDay(from, n);

function card(over: Partial<ReviewCard> = {}, id: CardId = 'dict:s001'): ReviewCard {
  return {
    id,
    due: NOW,
    interval: 0,
    ease: START_EASE,
    reps: 0,
    lapses: 0,
    last: 0,
    ...over,
  };
}

/** A graduated card due today. */
function grad(over: Partial<ReviewCard> = {}, id: CardId = 'dict:s001'): ReviewCard {
  return card(
    {
      interval: 10,
      reps: 3,
      due: day(0),
      lastGrade: 'good',
      last: NOW - 10 * DAY_MS,
      ...over,
    },
    id,
  );
}

const opts = (over: Partial<ApplyOptions> = {}): ApplyOptions => ({
  ctx: 'practice',
  enrol: true,
  enrolLeft: 10,
  now: NOW,
  ...over,
});

describe('gradeAuto — new / learning cards', () => {
  it('again: relearn step, ease and lapses unchanged', () => {
    const c = gradeAuto(card({ ease: 2.3, lapses: 2 }), 'again', NOW);
    expect(c).toMatchObject({
      interval: 0,
      reps: 0,
      due: NOW + RELEARN_MS,
      ease: 2.3,
      lapses: 2,
      lastGrade: 'again',
    });
  });

  it('hard on a never-graded card: 10-minute learning step', () => {
    const c = gradeAuto(card(), 'hard', NOW);
    expect(c).toMatchObject({
      interval: 0,
      reps: 0,
      due: NOW + HARD_LEARNING_MS,
      ease: START_EASE,
      lastGrade: 'hard',
    });
  });

  it('hard on a card graded before: graduates to 1 day, ease unchanged', () => {
    const c = gradeAuto(card({ lastGrade: 'hard', ease: 2.2 }), 'hard', NOW);
    expect(c).toMatchObject({
      interval: 1,
      reps: 1,
      due: day(1),
      ease: 2.2,
      lastGrade: 'hard',
    });
  });

  it('good: 1 day; easy: 4 days and ease + 0.15', () => {
    expect(gradeAuto(card(), 'good', NOW)).toMatchObject({
      interval: 1,
      reps: 1,
      due: day(1),
      ease: START_EASE,
    });
    expect(gradeAuto(card(), 'easy', NOW)).toMatchObject({
      interval: 4,
      reps: 1,
      due: day(4),
      ease: 2.65,
    });
  });

  it('does not mutate the input', () => {
    const c = card();
    const copy = { ...c };
    gradeAuto(c, 'easy', NOW);
    expect(c).toEqual(copy);
  });
});

describe('gradeAuto — graduated cards', () => {
  it('lapse keeps 25% of the interval, comes back tomorrow, lowers ease', () => {
    const c = gradeAuto(grad({ interval: 60, reps: 5, lapses: 1 }), 'again', NOW);
    expect(c).toMatchObject({
      interval: 15,
      reps: 1,
      lapses: 2,
      ease: 2.35,
      due: day(1),
      lastGrade: 'again',
    });
    expect(gradeAuto(grad({ interval: 1 }), 'again', NOW).interval).toBe(1);
    expect(gradeAuto(grad({ ease: 1.35 }), 'again', NOW).ease).toBe(MIN_EASE);
  });

  it('hard always grows the interval; ease floors at 2.0 and is never raised', () => {
    expect(gradeAuto(grad({ interval: 10 }), 'hard', NOW)).toMatchObject({
      interval: 12,
      reps: 4,
      ease: 2.45,
      due: day(12),
    });
    expect(gradeAuto(grad({ interval: 1, reps: 1 }), 'hard', NOW).interval).toBe(2);
    expect(gradeAuto(grad({ interval: 3 }), 'hard', NOW).interval).toBe(4);
    expect(gradeAuto(grad({ ease: 2.02 }), 'hard', NOW).ease).toBe(2);
    expect(gradeAuto(grad({ ease: 1.8 }), 'hard', NOW).ease).toBe(1.8);
  });

  it('good: 1 → 3 days on the second step', () => {
    expect(gradeAuto(grad({ interval: 1, reps: 1 }), 'good', NOW)).toMatchObject({ interval: 3, reps: 2, due: day(3) });
  });

  it('good: a card that graduated with "easy" (4 days) does not shrink back to 3', () => {
    expect(gradeAuto(grad({ interval: 4, reps: 1, lastGrade: 'easy' }), 'good', NOW).interval).toBe(10);
  });

  it('good: interval × ease, at least + 1 day', () => {
    expect(gradeAuto(grad({ interval: 10, ease: 2.5 }), 'good', NOW).interval).toBe(25);
    expect(gradeAuto(grad({ interval: 5, ease: 1.3 }), 'good', NOW).interval).toBe(7); // 6.5 → 7
    expect(gradeAuto(grad({ interval: 2, ease: 1.3, reps: 2 }), 'good', NOW).interval).toBe(3);
  });

  it('good: a recovering card (last grade again) grows by RECOVER_MULT only', () => {
    expect(gradeAuto(grad({ interval: 10, reps: 1, lastGrade: 'again' }), 'good', NOW).interval).toBe(15);
    expect(gradeAuto(grad({ interval: 20, reps: 4, lastGrade: 'again' }), 'good', NOW).interval).toBe(30);
  });

  it('good: overdue recall gets credit', () => {
    const onTime = gradeAuto(grad({ interval: 10, due: day(0) }), 'good', NOW).interval;
    const overdue = gradeAuto(grad({ interval: 10, due: day(-4) }), 'good', NOW).interval;
    expect(onTime).toBe(25);
    expect(overdue).toBe(30); // (10 + 4/2) × 2.5
    expect(overdue).toBeGreaterThan(onTime);
  });

  it('easy: max(G + 1, G × 1.3) and ease + 0.15', () => {
    expect(gradeAuto(grad({ interval: 10 }), 'easy', NOW)).toMatchObject({
      interval: 33,
      ease: 2.65,
      due: day(33),
    });
    expect(gradeAuto(grad({ interval: 1, reps: 1 }), 'easy', NOW).interval).toBe(4);
  });

  it('clamps to MAX_INTERVAL_DAYS', () => {
    expect(gradeAuto(grad({ interval: 36000 }), 'good', NOW).interval).toBe(36500);
  });

  it('three consecutive hard from new give strictly increasing intervals (0, 1, 2)', () => {
    let c: CardState = card();
    const intervals: number[] = [];
    let t = NOW;
    for (let i = 0; i < 3; i++) {
      c = gradeAuto(c, 'hard', t);
      intervals.push(c.interval);
      t = Math.max(t, c.due) + 60_000;
    }
    expect(intervals).toEqual([0, 1, 2]);
  });

  it('a lesson enrolled with good then reviewed at 3/4 (hard) reaches >= 4 days within 4 reviews', () => {
    let c: CardState = gradeAuto(card({}, 'lesson:linking'), 'good', NOW);
    let t = NOW;
    const seen = [c.interval];
    for (let i = 0; i < 3; i++) {
      t = c.due + 9 * 3_600_000;
      c = gradeAuto(c, 'hard', t);
      seen.push(c.interval);
    }
    expect(seen).toEqual([1, 2, 3, 4]);
  });
});

describe('isEffectivelyDue / nextLast', () => {
  it('due today, never graded, or a retired lesson', () => {
    expect(isEffectivelyDue(grad({ due: day(0) }), 'dict', NOW)).toBe(true);
    expect(isEffectivelyDue(grad({ due: day(0) + 20 * 3_600_000 }), 'dict', NOW)).toBe(true); // later today: calendar day
    expect(isEffectivelyDue(grad({ due: day(2) }), 'dict', NOW)).toBe(false);
    expect(isEffectivelyDue(grad({ due: day(2), lastGrade: undefined }), 'dict', NOW)).toBe(true);
    expect(isEffectivelyDue(grad({ due: day(9), interval: 21 }, 'lesson:x'), 'lesson', NOW)).toBe(true);
    expect(isEffectivelyDue(grad({ due: day(9), interval: 21 }), 'dict', NOW)).toBe(false);
    expect(isEffectivelyDue(card({ due: NOW + 60_000, lastGrade: 'again' }), 'dict', NOW)).toBe(false);
  });

  it('nextLast is max(now, prev.last + 1)', () => {
    expect(nextLast(undefined, NOW)).toBe(NOW);
    expect(nextLast({ last: NOW - 5 }, NOW)).toBe(NOW);
    expect(nextLast({ last: NOW + 1000 }, NOW)).toBe(NOW + 1001);
  });
});

describe('applyReview — absent card', () => {
  it('enrol = false → not-enrolled, nothing to write', () => {
    expect(applyReview(undefined, 'dict:s001', 'good', opts({ enrol: false }))).toEqual({
      card: null,
      current: null,
      reason: 'not-enrolled',
      budgeted: false,
    });
  });

  it('successful budgeted kinds need new-card budget', () => {
    for (const id of ['dict:s001', 'pair:can-cant'] as CardId[]) {
      const r = applyReview(undefined, id, 'good', opts({ enrolLeft: 0 }));
      expect(r).toMatchObject({
        card: null,
        current: null,
        reason: 'over-budget',
        budgeted: false,
      });
      const ok = applyReview(undefined, id, 'easy', opts({ enrolLeft: 1 }));
      expect(ok).toMatchObject({ reason: 'enrolled', budgeted: true });
      expect(ok.card).toMatchObject({ id, last: NOW });
      expect(ok.current).toBe(ok.card);
    }
  });

  it('failures always enrol and are not budgeted', () => {
    for (const g of ['again', 'hard'] as Grade[]) {
      const r = applyReview(undefined, 'dict:s001', g, opts({ enrolLeft: 0 }));
      expect(r).toMatchObject({ reason: 'enrolled', budgeted: false });
      expect(r.card?.interval).toBe(0);
    }
  });

  it('media and lessons are never budgeted', () => {
    expect(applyReview(undefined, 'media:m1:3', 'good', opts({ enrolLeft: 0 }))).toMatchObject({
      reason: 'enrolled',
      budgeted: false,
    });
    const l = applyReview(undefined, 'lesson:linking', 'hard', opts({ enrolLeft: 0, firstGrade: 'good' }));
    expect(l).toMatchObject({ reason: 'enrolled', budgeted: false });
    expect(l.card).toMatchObject({
      interval: 1,
      reps: 1,
      due: day(1),
      lastGrade: 'good',
    }); // firstGrade used
  });

  it('first-ever perfect answer (easy) → 4 days', () => {
    expect(applyReview(undefined, 'dict:s001', 'easy', opts()).card).toMatchObject({ interval: 4, due: day(4) });
  });

  it('practice context: a learning step is never shorter than 1 hour', () => {
    expect(applyReview(undefined, 'dict:s001', 'again', opts()).card?.due).toBe(NOW + PRACTICE_STEP_MS);
    expect(applyReview(undefined, 'dict:s001', 'hard', opts()).card?.due).toBe(NOW + PRACTICE_STEP_MS);
    // review context keeps the short steps (the session requeues)
    expect(applyReview(undefined, 'dict:s001', 'again', opts({ ctx: 'review' })).card?.due).toBe(NOW + RELEARN_MS);
  });

  it('chunk ids are never stored', () => {
    expect(applyReview(undefined, 'chunk:gonna', 'good', opts()).reason).toBe('not-enrolled');
  });
});

describe('applyReview — present card', () => {
  it('suspended: nothing changes', () => {
    const prev = grad({ suspended: true });
    expect(applyReview(prev, 'dict:s001', 'again', opts({ ctx: 'review' }))).toEqual({
      card: null,
      current: prev,
      reason: 'suspended',
      budgeted: false,
    });
  });

  it('review context, due: graded / lapsed', () => {
    const g = applyReview(grad(), 'dict:s001', 'good', opts({ ctx: 'review' }));
    expect(g.reason).toBe('graded');
    expect(g.card).toMatchObject({ interval: 25, reps: 4 });
    const l = applyReview(grad(), 'dict:s001', 'again', opts({ ctx: 'review' }));
    expect(l.reason).toBe('lapsed');
    expect(l.card).toMatchObject({ interval: 3, lapses: 1, due: day(1) });
  });

  it('review context, learning card not yet due: graded (session requeue)', () => {
    const prev = card({
      due: NOW + 5 * 60_000,
      lastGrade: 'again',
      last: NOW - 60_000,
    });
    const r = applyReview(prev, 'dict:s001', 'good', opts({ ctx: 'review' }));
    expect(r.reason).toBe('graded');
    expect(r.card?.interval).toBe(1);
  });

  it('review context, graduated card not due: the practice rule applies', () => {
    const prev = grad({ due: day(5) });
    expect(applyReview(prev, 'dict:s001', 'good', opts({ ctx: 'review' }))).toMatchObject({
      card: null,
      current: prev,
      reason: 'skipped-not-due',
    });
    const r = applyReview(prev, 'dict:s001', 'again', opts({ ctx: 'review' }));
    expect(r.reason).toBe('pulled-in');
    expect(r.card).toMatchObject({
      due: nextLocalMidnight(NOW),
      interval: 10,
      reps: 3,
      lapses: 0,
      lastGrade: 'again',
    });
  });

  it('practice context, due: graded / lapsed', () => {
    expect(applyReview(grad(), 'dict:s001', 'hard', opts()).reason).toBe('graded');
    expect(applyReview(grad(), 'dict:s001', 'again', opts()).reason).toBe('lapsed');
    // again on a learning card is not a lapse
    const learning = card({
      due: NOW - 1000,
      lastGrade: 'again',
      last: NOW - 3_600_000,
    });
    const r = applyReview(learning, 'dict:s001', 'again', opts());
    expect(r.reason).toBe('graded');
    expect(r.card?.due).toBe(NOW + PRACTICE_STEP_MS);
  });

  it('practice context, not due: success changes nothing (not even last), miss pulls in', () => {
    const prev = grad({ due: day(7) });
    const s = applyReview(prev, 'dict:s001', 'easy', opts());
    expect(s).toMatchObject({
      card: null,
      current: prev,
      reason: 'skipped-not-due',
      budgeted: false,
    });
    const m = applyReview(prev, 'dict:s001', 'again', opts());
    expect(m.reason).toBe('pulled-in');
    expect(m.card?.due).toBe(day(1));
    expect(m.card?.last).toBe(NOW);
    expect(m.current).toBe(m.card);
  });

  it('practice context, learning card not due: a miss cannot pull it in further', () => {
    const prev = card({
      due: NOW + 30 * 60_000,
      lastGrade: 'again',
      last: NOW - 60_000,
    });
    expect(applyReview(prev, 'dict:s001', 'again', opts())).toMatchObject({
      card: null,
      current: prev,
      reason: 'pulled-in',
    });
    expect(applyReview(prev, 'dict:s001', 'good', opts()).reason).toBe('skipped-not-due');
  });

  it('never-graded (reconciled) cards count as due in any context', () => {
    const seeded = card({ interval: 3, reps: 1, due: day(3), last: 0 });
    const r = applyReview(seeded, 'dict:s001', 'good', opts());
    expect(r.reason).toBe('graded');
    expect(r.card).toMatchObject({ interval: 8, reps: 2, last: NOW });
  });

  it('retired lessons count as due', () => {
    const prev = grad({ interval: 25, due: day(20) }, 'lesson:linking');
    expect(applyReview(prev, 'lesson:linking', 'good', opts()).reason).toBe('graded');
  });

  it('a lesson in a learning step never comes back the same day', () => {
    const prev = card({ due: NOW - 1000, lastGrade: 'again', last: NOW - DAY_MS }, 'lesson:linking');
    const r = applyReview(prev, 'lesson:linking', 'again', opts({ ctx: 'review' }));
    expect(r.card?.due).toBe(nextLocalMidnight(NOW));
    const fresh = applyReview(undefined, 'lesson:intro', 'again', opts({ ctx: 'review' }));
    expect(fresh.card?.due).toBe(nextLocalMidnight(NOW));
  });

  it('last is monotonic, even after a fast clock wrote the previous version', () => {
    const future = grad({ last: NOW + 5 * DAY_MS });
    expect(applyReview(future, 'dict:s001', 'good', opts()).card?.last).toBe(NOW + 5 * DAY_MS + 1);
    expect(applyReview(grad({ last: NOW - 1 }), 'dict:s001', 'good', opts()).card?.last).toBe(NOW);
  });
});

describe('budgeted success flag (perfect small pair round)', () => {
  it('a perfect 2-question set graded hard is budgeted, and declined while no new-card budget is left', () => {
    const base = { ctx: 'practice' as const, enrol: true, now: NOW };
    const ok = applyReview(undefined, 'pair:a', 'hard', {
      ...base,
      enrolLeft: 3,
      success: true,
    });
    expect(ok).toMatchObject({ reason: 'enrolled', budgeted: true });
    expect(
      applyReview(undefined, 'pair:a', 'hard', {
        ...base,
        enrolLeft: 0,
        success: true,
      }).reason,
    ).toBe('over-budget');
    // a miss always enrols, unbudgeted
    expect(applyReview(undefined, 'pair:a', 'hard', { ...base, enrolLeft: 0 })).toMatchObject({
      reason: 'enrolled',
      budgeted: false,
    });
  });

  it('a grade stamps seenAt and a fresh card gets its lineage (born)', () => {
    const r = applyReview(undefined, 'dict:s001', 'again', {
      ctx: 'practice',
      enrol: true,
      enrolLeft: 5,
      now: NOW,
    });
    expect(r.card).toMatchObject({ born: NOW, seenAt: NOW, last: NOW });
    const g = applyReview(r.card!, 'dict:s001', 'good', {
      ctx: 'review',
      enrol: true,
      enrolLeft: 5,
      now: NOW + 7,
    });
    expect(g.card).toMatchObject({ born: NOW, seenAt: NOW + 7 });
  });
});

describe('enrolSeenCard / resetCardState / suspendCardState', () => {
  it('enrolSeenCard: only when absent; new, never graded, available tomorrow', () => {
    expect(enrolSeenCard(grad(), 'dict:s001', NOW)).toBeNull();
    const c = enrolSeenCard(undefined, 'dict:s001', NOW);
    expect(c).toEqual({
      ...newCard('dict:s001', NOW),
      due: nextLocalMidnight(NOW),
      last: NOW,
      born: NOW,
      seenAt: NOW,
    });
    expect(c?.lastGrade).toBeUndefined();
  });

  it('resetCardState: absent → null; otherwise a fresh card (suspension cleared)', () => {
    expect(resetCardState(undefined, 'dict:u-1', NOW)).toBeNull();
    const c = resetCardState(grad({ suspended: true, last: NOW + 50 }, 'dict:u-1'), 'dict:u-1', NOW);
    // same lineage (born kept when present), seenAt frozen from the old `last`: a reset is not a meeting
    expect(c).toEqual({
      ...newCard('dict:u-1', NOW),
      due: nextLocalMidnight(NOW),
      last: NOW + 51,
      seenAt: NOW + 50,
    });
    const b = resetCardState(grad({ born: 7, seenAt: NOW - DAY_MS }, 'dict:u-1'), 'dict:u-1', NOW);
    expect(b).toMatchObject({ born: 7, seenAt: NOW - DAY_MS, reps: 0 });
    expect(c && 'suspended' in c).toBe(false);
  });

  it('suspendCardState: toggles, null when absent or unchanged', () => {
    expect(suspendCardState(undefined, true, NOW)).toBeNull();
    const on = suspendCardState(grad(), true, NOW);
    expect(on).toMatchObject({ suspended: true, last: NOW, interval: 10 });
    expect(suspendCardState(on!, true, NOW)).toBeNull();
    const off = suspendCardState(on!, false, NOW);
    expect(off && 'suspended' in off).toBe(false);
    expect(off?.last).toBe(NOW + 1);
    expect(suspendCardState(grad(), false, NOW)).toBeNull();
  });
});
