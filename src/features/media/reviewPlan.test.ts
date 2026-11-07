import { describe, expect, it } from 'vitest';
import { mediaReviewPlan, parseUnitParam } from './reviewPlan';

const check = { retry: false, hinted: false, total: 8, matched: 8, extra: 0, revealed: false };

describe('mediaReviewPlan', () => {
  it('a perfect line grades an existing card but never enrols', () => {
    expect(mediaReviewPlan(check, false)).toEqual({ grade: 'good', enrol: false });
  });
  it('an imperfect line enrols', () => {
    expect(mediaReviewPlan({ ...check, matched: 7 }, false)).toEqual({ grade: 'hard', enrol: true });
    expect(mediaReviewPlan({ ...check, hinted: true }, false)).toEqual({ grade: 'hard', enrol: true });
    expect(mediaReviewPlan({ ...check, matched: 5 }, false)).toEqual({ grade: 'again', enrol: true });
    expect(mediaReviewPlan({ ...check, matched: 0, revealed: true }, false)).toEqual({ grade: 'again', enrol: true });
  });
  it('is never a first try (a perfect line is good, not easy)', () => {
    expect(mediaReviewPlan(check, false)?.grade).toBe('good');
  });
  it('long lines allow two errors as hard', () => {
    expect(mediaReviewPlan({ ...check, total: 13, matched: 11 }, false)?.grade).toBe('hard');
    expect(mediaReviewPlan({ ...check, total: 12, matched: 10 }, false)?.grade).toBe('again');
  });
  it('a retry, a session-only item or a check without counts is not graded', () => {
    expect(mediaReviewPlan({ ...check, retry: true }, false)).toBeNull();
    expect(mediaReviewPlan({ ...check, matched: 2 }, true)).toBeNull();
    expect(mediaReviewPlan({ retry: false, hinted: false }, false)).toBeNull();
  });
});

describe('parseUnitParam', () => {
  it('accepts a non-negative integer line index', () => {
    expect(parseUnitParam('0')).toBe(0);
    expect(parseUnitParam('14')).toBe(14);
  });
  it('rejects anything else', () => {
    for (const v of [undefined, '', '-1', '1.5', '1e3', ' 2', 'abc', '9999999', 3]) expect(parseUnitParam(v)).toBeUndefined();
  });
});
