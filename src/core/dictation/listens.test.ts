import { describe, expect, it } from 'vitest';
import { firstListenOutcome, heardOnce, listensLabelVi, NO_LISTENS, rightOnFirstListen, totalListens, type ListenTally } from './listens';

const t = (normal = 0, slow = 0, chunks = 0): ListenTally => ({ normal, slow, chunks });

describe('listen tally', () => {
  it('counts every kind of play', () => {
    expect(totalListens(NO_LISTENS)).toBe(0);
    expect(totalListens(t(2, 1, 1))).toBe(4);
    expect(totalListens(undefined)).toBe(0);
    expect(totalListens({ normal: Number.NaN, slow: -2, chunks: 1.9 })).toBe(1);
  });

  it('heard once = exactly one normal-speed play', () => {
    expect(heardOnce(t(1))).toBe(true);
    expect(heardOnce(t(2))).toBe(false);
    expect(heardOnce(t(0))).toBe(false);
    expect(heardOnce(t(1, 1))).toBe(false);
    expect(heardOnce(t(1, 0, 1))).toBe(false);
    expect(heardOnce(t(0, 1))).toBe(false); // one play, but slowed down
    expect(heardOnce(null)).toBe(false);
  });
});

describe('rightOnFirstListen', () => {
  it('needs a perfect, unaided answer after one play', () => {
    expect(rightOnFirstListen({ score: 1, hinted: false, listens: t(1) })).toBe(true);
    expect(rightOnFirstListen({ score: 0.9, hinted: false, listens: t(1) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: true, listens: t(1) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: false, revealed: true, listens: t(1) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: false, listens: t(2) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: false })).toBe(false);
  });
});

describe('firstListenOutcome', () => {
  const fresh = { cloze: false, retry: false, prevAttempts: 0 };

  it('measures a new sentence that was played', () => {
    expect(firstListenOutcome({ listens: t(1) }, fresh)).toBe(true);
    expect(firstListenOutcome({ listens: t(3) }, fresh)).toBe(false);
    expect(firstListenOutcome({ listens: t(1, 1) }, fresh)).toBe(false);
  });

  it('does not measure memory, retries, cloze or an answer given without listening', () => {
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, prevAttempts: 2 })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, retry: true })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, cloze: true })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(0) }, fresh)).toBeUndefined();
    expect(firstListenOutcome({}, fresh)).toBeUndefined();
  });
});

describe('listensLabelVi', () => {
  it('describes the plays in Vietnamese', () => {
    expect(listensLabelVi(t(0))).toBe('');
    expect(listensLabelVi(null)).toBe('');
    expect(listensLabelVi(t(1))).toBe('nghe 1 lần');
    expect(listensLabelVi(t(0, 1))).toBe('nghe 1 lần (chậm)');
    expect(listensLabelVi(t(3))).toBe('nghe 3 lần');
    expect(listensLabelVi(t(1, 1, 1))).toBe('nghe 3 lần, có nghe chậm');
  });
});
