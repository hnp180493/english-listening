import { describe, expect, it } from 'vitest';
import { estimateMinutes, type CardId } from '../../core/review';
import { sessionSize } from './sessionPlan';

const ids = (n: number): CardId[] => Array.from({ length: n }, (_, i) => `dict:s${String(i + 1).padStart(3, '0')}` as CardId);
const snap = (dueToday: number, minutesToday: number) => ({ summary: { dueToday, minutesToday } }) as Parameters<typeof sessionSize>[0];

describe('sessionSize: the numbers of the next session (Ôn tập start card and the town farm)', () => {
  it('a day that fits one session: today’s count and today’s minutes', () => {
    const q = ids(9);
    expect(sessionSize(snap(9, 6), q)).toEqual({ size: 9, dueToday: 9, split: false, minutes: 6 });
  });

  it('a day split by the review budget: this session’s own size and minutes', () => {
    const q = ids(8);
    const s = sessionSize(snap(9, 6), q);
    expect(s.split).toBe(true);
    expect(s.size).toBe(8);
    expect(s.minutes).toBe(estimateMinutes(q));
  });

  it('nothing due today (studying ahead): the queue’s own minutes, not split', () => {
    const q = ids(3);
    expect(sessionSize(snap(0, 0), q)).toEqual({ size: 3, dueToday: 0, split: false, minutes: estimateMinutes(q) });
  });
});
