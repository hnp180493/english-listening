import { describe, expect, it } from 'vitest';
import { LESSON_REVIEW_SIZE } from './constants';
import {
  dictationErrors,
  gradeDictation,
  gradeLessonScore,
  gradePairSet,
  lessonReviewItems,
  type DictationCheck,
} from './grading';

const check = (over: Partial<DictationCheck> = {}): DictationCheck => ({
  total: 6,
  matched: 6,
  extra: 0,
  hinted: false,
  revealed: false,
  firstTry: false,
  kind: 'dict',
  ...over,
});

describe('dictationErrors', () => {
  it('counts missed words plus extra words; junk counts as 0', () => {
    expect(dictationErrors({ total: 6, matched: 4, extra: 1 })).toBe(3);
    expect(dictationErrors({ total: 6, matched: 6, extra: 0 })).toBe(0);
    expect(dictationErrors({ total: NaN, matched: 2, extra: -3 })).toBe(0);
    expect(dictationErrors({ total: 3, matched: 9, extra: 0 })).toBe(0);
  });
});

describe('gradeDictation', () => {
  it('revealed or empty target → again', () => {
    expect(gradeDictation(check({ revealed: true }))).toBe('again');
    expect(gradeDictation(check({ total: 0, matched: 0 }))).toBe('again');
    expect(gradeDictation(check({ total: NaN, matched: NaN }))).toBe('again');
  });

  it('perfect: easy on the first-ever try, good otherwise, hard with the hint', () => {
    expect(gradeDictation(check({ firstTry: true }))).toBe('easy');
    expect(gradeDictation(check())).toBe('good');
    expect(gradeDictation(check({ hinted: true, firstTry: true }))).toBe('hard');
  });

  it('one error on 4+ words → hard; on 3 words → again (error count, not ratio)', () => {
    expect(gradeDictation(check({ total: 4, matched: 3 }))).toBe('hard');
    expect(gradeDictation(check({ total: 3, matched: 2 }))).toBe('again');
    expect(gradeDictation(check({ total: 6, matched: 5, firstTry: true }))).toBe('hard');
  });

  it('an extra word counts as an error', () => {
    expect(gradeDictation(check({ extra: 1 }))).toBe('hard');
    expect(gradeDictation(check({ matched: 5, extra: 1 }))).toBe('again');
  });

  it('media: long lines tolerate 2 errors', () => {
    expect(gradeDictation(check({ kind: 'media', total: 13, matched: 11 }))).toBe('hard');
    expect(gradeDictation(check({ kind: 'media', total: 12, matched: 10 }))).toBe('again');
    expect(gradeDictation(check({ kind: 'media', total: 13, matched: 10 }))).toBe('again');
    expect(gradeDictation(check({ kind: 'dict', total: 13, matched: 11 }))).toBe('again');
  });

  it('NaN counts → again (never throws)', () => {
    expect(gradeDictation(check({ total: 6, matched: NaN }))).toBe('again');
  });
});

describe('gradePairSet', () => {
  it('4/4 good, 3/4 hard, 2/4 again, 2/2 hard, 0/0 null', () => {
    expect(gradePairSet(4, 4)).toBe('good');
    expect(gradePairSet(3, 4)).toBe('hard');
    expect(gradePairSet(2, 4)).toBe('again');
    expect(gradePairSet(2, 2)).toBe('hard');
    expect(gradePairSet(1, 2)).toBe('again');
    expect(gradePairSet(0, 0)).toBeNull();
    expect(gradePairSet(9, 9)).toBe('good');
    expect(gradePairSet(8, 9)).toBe('hard');
    expect(gradePairSet(7, 9)).toBe('again');
  });
});

describe('gradeLessonScore', () => {
  it('>= 0.9 good, >= 0.7 hard, else again', () => {
    expect(gradeLessonScore(1)).toBe('good');
    expect(gradeLessonScore(0.9)).toBe('good');
    expect(gradeLessonScore(0.875)).toBe('hard'); // 7/8
    expect(gradeLessonScore(0.75)).toBe('hard'); // 3/4, 6/8
    expect(gradeLessonScore(0.7)).toBe('hard');
    expect(gradeLessonScore(0.625)).toBe('again'); // 5/8
    expect(gradeLessonScore(NaN)).toBe('again');
  });
});

describe('lessonReviewItems', () => {
  const MANY = [
    'listen-choose',
    'which-rule',
    'spot',
    'listen-type',
    'which-rule',
    'listen-choose',
    'spot',
    'which-rule',
  ];
  const listening = new Set([0, 2, 3, 5, 6]);

  it('only listening items when there are enough of them', () => {
    const idx = lessonReviewItems('linking', MANY, { reps: 1, lapses: 0 });
    expect(idx).toHaveLength(LESSON_REVIEW_SIZE);
    expect(new Set(idx).size).toBe(LESSON_REVIEW_SIZE);
    for (const i of idx) expect(listening.has(i)).toBe(true);
  });

  it("counts the generic 'listen' token (choose with play) as listening; choose / silent-letter only fill", () => {
    const MIXED = ['choose', 'listen', 'silent-letter', 'listen', 'choose', 'listen', 'silent-letter', 'listen'];
    const idx = lessonReviewItems('irr-1', MIXED, { reps: 0, lapses: 0 });
    expect([...idx].sort()).toEqual([1, 3, 5, 7]);
    const few = lessonReviewItems('irr-2', ['choose', 'silent-letter', 'listen', 'choose', 'silent-letter'], undefined);
    expect(few).toHaveLength(4);
    expect(few[0]).toBe(2);
  });

  it('which-rule only fills up after every listening item', () => {
    const FEW = ['which-rule', 'listen-choose', 'which-rule', 'spot', 'which-rule'];
    const idx = lessonReviewItems('intro', FEW, undefined);
    expect(idx).toHaveLength(4);
    expect(new Set(idx.slice(0, 2))).toEqual(new Set([1, 3]));
    for (const i of idx.slice(2)) expect(FEW[i]).toBe('which-rule');
  });

  it('returns fewer items for a short quiz', () => {
    expect(lessonReviewItems('x', ['which-rule', 'spot'], undefined).sort()).toEqual([0, 1]);
    expect(lessonReviewItems('x', [], undefined)).toEqual([]);
  });

  it('is deterministic and rotates with reps/lapses', () => {
    const a = lessonReviewItems('linking', MANY, { reps: 2, lapses: 1 });
    expect(lessonReviewItems('linking', MANY, { reps: 2, lapses: 1 })).toEqual(a);
    const variants = new Set<string>();
    for (let reps = 0; reps < 6; reps++)
      variants.add(lessonReviewItems('linking', MANY, { reps, lapses: 0 }).join(','));
    expect(variants.size).toBeGreaterThan(1);
  });
});
