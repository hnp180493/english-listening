import { describe, expect, it } from 'vitest';
import { newestAttempt, shouldEnrolTake } from './reviewHook';
import { SELF_SCORE, withAttempt } from './store';

const sentence = { kind: 'sentence' as const, itemId: 's012' };

describe('shouldEnrolTake', () => {
  it('enrols a built-in sentence take scored below 0.7 only', () => {
    expect(shouldEnrolTake(sentence, { score: 0.5 })).toBe(true);
    expect(shouldEnrolTake(sentence, { score: 0.69 })).toBe(true);
    expect(shouldEnrolTake(sentence, { score: 0.7 })).toBe(false);
    expect(shouldEnrolTake(sentence, { score: 1 })).toBe(false);
  });

  it('self ratings: ok and bad enrol, good does not', () => {
    expect(shouldEnrolTake(sentence, { score: SELF_SCORE.ok })).toBe(true);
    expect(shouldEnrolTake(sentence, { score: SELF_SCORE.bad })).toBe(true);
    expect(shouldEnrolTake(sentence, { score: SELF_SCORE.good })).toBe(false);
  });

  it('never for chunk or typed-in sources, or without a take', () => {
    expect(shouldEnrolTake({ kind: 'chunk', itemId: 'gonna' }, { score: 0.1 })).toBe(false);
    expect(shouldEnrolTake({ kind: 'custom', itemId: 'custom:abc' }, { score: 0.1 })).toBe(false);
    expect(shouldEnrolTake(sentence, undefined)).toBe(false);
    expect(shouldEnrolTake(null, { score: 0.1 })).toBe(false);
    expect(shouldEnrolTake(sentence, { score: Number.NaN })).toBe(false);
  });
});

describe('newestAttempt', () => {
  it('reads the take just saved', () => {
    let s = withAttempt({}, 's012', { at: 1, score: 0.9 });
    s = withAttempt(s, 's012', { at: 2, score: 0.4 });
    expect(newestAttempt(s, 's012')).toEqual({ at: 2, score: 0.4 });
    expect(newestAttempt(s, 's999')).toBeUndefined();
    expect(newestAttempt(s, '__proto__')).toBeUndefined();
  });
});
