import { describe, expect, it } from 'vitest';
import { PAIR_ENROL_ANSWERS } from '../../core/review/constants';
import { applyReview } from '../../core/review/schedule';
import { nextLocalMidnight, startOfLocalDay } from '../../core/review/time';
import type { ReviewCard } from '../../core/review/types';
import { PAIR_SET_ITEMS } from '../../data/pairIndex';
import { applyAnswer, emptyProgress, startRound, submitAnswer, advance, summarizeRound, type PairsProgress } from './game';
import { isScheduled, pairSetReviewCalls, pairsReviewNote, setAnswerCount } from './reviewHook';

const NOW = new Date(2026, 10, 6, 10, 0).getTime();
const SETS: Record<string, readonly string[]> = { a: ['a1', 'a2', 'a3', 'a4'], b: ['b1', 'b2'] };

function progressWith(seen: Record<string, number>): PairsProgress {
  let p = emptyProgress();
  for (const [id, n] of Object.entries(seen)) for (let i = 0; i < n; i++) p = applyAnswer(p, id, true, NOW);
  return p;
}

describe('pairSetReviewCalls', () => {
  it('enrols a set with a miss and grades it from the first answers', () => {
    const calls = pairSetReviewCalls({ bySet: [{ setId: 'a', total: 4, correct: 3 }] }, progressWith({ a1: 1 }), SETS);
    expect(calls).toEqual([{ id: 'pair:a', setId: 'a', grade: 'hard', enrol: true, success: false }]);
  });

  it('does not enrol an all-correct set under PAIR_ENROL_ANSWERS answers', () => {
    const calls = pairSetReviewCalls({ bySet: [{ setId: 'a', total: 4, correct: 4 }] }, progressWith({ a1: 4, a2: 4 }), SETS);
    expect(calls).toEqual([{ id: 'pair:a', setId: 'a', grade: 'good', enrol: false, success: true }]);
  });

  it('enrols an all-correct set once its items have PAIR_ENROL_ANSWERS first answers (after this round)', () => {
    const per = PAIR_ENROL_ANSWERS / 4;
    const after = progressWith({ a1: per, a2: per, a3: per, a4: per });
    expect(setAnswerCount(after, SETS.a)).toBe(PAIR_ENROL_ANSWERS);
    const calls = pairSetReviewCalls({ bySet: [{ setId: 'a', total: 4, correct: 4 }] }, after, SETS);
    expect(calls[0]).toMatchObject({ grade: 'good', enrol: true });
    const below = progressWith({ a1: per, a2: per, a3: per, a4: per - 1 });
    expect(pairSetReviewCalls({ bySet: [{ setId: 'a', total: 4, correct: 4 }] }, below, SETS)[0].enrol).toBe(false);
  });

  it('gives one call per set with its own grade; unknown and empty sets are skipped', () => {
    const calls = pairSetReviewCalls(
      {
        bySet: [
          { setId: 'b', total: 2, correct: 2 },
          { setId: 'a', total: 4, correct: 1 },
          { setId: 'gone', total: 3, correct: 0 },
          { setId: '__proto__', total: 3, correct: 0 },
          { setId: 'a', total: 4, correct: 4 },
        ],
      },
      emptyProgress(),
      SETS,
    );
    expect(calls).toEqual([
      // 2/2 is graded 'hard' but has no miss: `success` makes its enrolment budgeted (review-system D9)
      { id: 'pair:b', setId: 'b', grade: 'hard', enrol: false, success: true },
      { id: 'pair:a', setId: 'a', grade: 'again', enrol: true, success: false },
    ]);
    expect(pairSetReviewCalls({ bySet: [{ setId: 'a', total: 0, correct: 0 }] }, emptyProgress(), SETS)).toEqual([]);
  });

  it('works on a real round summary: first answers only, requeues ignored', () => {
    const [setId, items] = Object.entries(PAIR_SET_ITEMS)[0];
    const qs = items.slice(0, 4).map((itemId) => ({ key: `${itemId}#0`, setId, itemId, answer: 0, requeue: false }));
    let round = startRound(qs);
    for (let i = 0; round.index < round.queue.length && i < 20; i++) {
      const q = round.queue[round.index];
      // miss the first question once; its requeued second chance is answered correctly
      round = submitAnswer(round, q.key === qs[0].key ? 1 : 0, 0);
      round = advance(round);
    }
    const sum = summarizeRound(round);
    expect(sum.requeued).toBe(1);
    const calls = pairSetReviewCalls(sum, emptyProgress(), PAIR_SET_ITEMS);
    expect(calls).toEqual([{ id: `pair:${setId}`, setId, grade: 'hard', enrol: true, success: false }]);
  });

  it('a practice replay of a set just enrolled with a learning step changes nothing (no double counting)', () => {
    const first = applyReview(undefined, 'pair:a', 'hard', { ctx: 'practice', enrol: true, enrolLeft: 10, now: NOW });
    expect(first.reason).toBe('enrolled');
    const card = first.card as ReviewCard;
    const again = applyReview(card, 'pair:a', 'good', { ctx: 'practice', enrol: true, enrolLeft: 10, now: NOW + 60_000 });
    expect(again).toMatchObject({ card: null, reason: 'skipped-not-due' });
  });
});

describe('pairsReviewNote', () => {
  const card = (over: Partial<ReviewCard> = {}): ReviewCard => ({
    id: 'pair:a',
    due: startOfLocalDay(NOW, 1),
    interval: 1,
    ease: 2.5,
    reps: 1,
    lapses: 0,
    last: NOW,
    lastGrade: 'good',
    ...over,
  });

  it('names the return day for a single-set round', () => {
    expect(pairsReviewNote([{ reason: 'enrolled', current: card() }], true, NOW)).toBe(
      'Bộ này sẽ quay lại trong Ôn tập ngày mai.',
    );
    expect(pairsReviewNote([{ reason: 'skipped-not-due', current: card({ due: startOfLocalDay(NOW, 5), interval: 5 }) }], true, NOW)).toBe(
      'Bộ này sẽ quay lại trong Ôn tập sau 5 ngày.',
    );
    expect(pairsReviewNote([{ reason: 'pulled-in', current: card({ due: nextLocalMidnight(NOW) }) }], true, NOW)).toBe(
      'Bộ này sẽ quay lại trong Ôn tập ngày mai.',
    );
  });

  it('counts scheduled sets in a mixed round', () => {
    const results = [
      { reason: 'graded' as const, current: card() },
      { reason: 'lapsed' as const, current: card() },
      { reason: 'not-enrolled' as const, current: null },
      { reason: 'over-budget' as const, current: null },
      { reason: 'suspended' as const, current: card({ suspended: true }) },
    ];
    expect(pairsReviewNote(results, false, NOW)).toBe('2 nhóm âm sẽ quay lại trong Ôn tập.');
    expect(pairsReviewNote([{ reason: 'enrolled', current: card() }], false, NOW)).toBe('1 nhóm âm sẽ quay lại trong Ôn tập.');
  });

  it('is hidden when nothing is scheduled', () => {
    expect(pairsReviewNote([], true, NOW)).toBeUndefined();
    expect(pairsReviewNote([{ reason: 'over-budget', current: null }], true, NOW)).toBeUndefined();
    expect(isScheduled({ reason: 'pulled-in', current: null })).toBe(false);
  });
});
