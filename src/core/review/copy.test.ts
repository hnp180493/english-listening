import { describe, expect, it } from 'vitest';
import { availableAt, type CardState } from '../srs';
import { contextLineVi, growthLineVi } from './copy';
import { startOfLocalDay } from './time';
import type { CardId, ReviewEntry } from './types';

const NOW = new Date(2026, 4, 10, 12, 0).getTime();
const DAY_MS = 86_400_000;

function entry(id: CardId, s: Partial<CardState>, last?: number): ReviewEntry {
  const state: CardState = {
    id,
    due: NOW,
    interval: 3,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    ...s,
  };
  const kind = id.split(':')[0] as ReviewEntry['kind'];
  return {
    id,
    kind,
    ref: id.slice(kind.length + 1),
    state,
    last,
    availableAt: availableAt(state),
    touchedToday: false,
  };
}

describe('contextLineVi', () => {
  it('last grade again wins', () => {
    expect(contextLineVi(entry('dict:a', { lastGrade: 'again', reps: 3 }, NOW - DAY_MS), NOW)).toBe(
      'Lần trước bạn chưa nhớ mục này',
    );
  });

  it('reconciled (never graded)', () => {
    expect(contextLineVi(entry('dict:a', {}, 0), NOW)).toBe('Mục bạn từng học trước đây');
  });

  it('a word never answered: new word of a lesson you passed; then like any card', () => {
    expect(contextLineVi(entry('word:read~red', { interval: 0 }, 0), NOW)).toBe('Từ mới trong bài bạn đã học');
    expect(contextLineVi(entry('word:read~red', { lastGrade: 'good', reps: 1 }, NOW - DAY_MS), NOW)).toBe(
      'Bạn gặp mục này hôm qua · ôn lần 2',
    );
  });

  it('today / yesterday / n days, with the review number', () => {
    expect(contextLineVi(entry('dict:a', {}, NOW - 1000), NOW)).toBe('Bạn vừa gặp mục này hôm nay');
    expect(contextLineVi(entry('dict:a', {}, NOW + 3_600_000), NOW)).toBe('Bạn vừa gặp mục này hôm nay'); // small skew
    // a time far in the future (fast-clock device) is unknown: never "today" on every later day
    expect(contextLineVi(entry('dict:a', { reps: 2 }, NOW + 5 * DAY_MS), NOW)).toBe('Ôn lần 3');
    expect(contextLineVi(entry('dict:a', {}, NOW + 5 * DAY_MS), NOW)).toBe('Mục bạn đang học');
    expect(contextLineVi(entry('dict:a', { reps: 1 }, startOfLocalDay(NOW, -1) + 1000), NOW)).toBe(
      'Bạn gặp mục này hôm qua · ôn lần 2',
    );
    expect(contextLineVi(entry('dict:a', { reps: 2, lastGrade: 'good' }, NOW - 4 * DAY_MS), NOW)).toBe(
      'Bạn học mục này 4 ngày trước · ôn lần 3',
    );
  });

  it('uses seenAt over last: a suspend toggle today is not a meeting', () => {
    const e = {
      ...entry('dict:a', { reps: 1 }, NOW - 1000),
      seenAt: NOW - 4 * DAY_MS,
    };
    expect(contextLineVi(e, NOW)).toBe('Bạn học mục này 4 ngày trước · ôn lần 2');
    expect(contextLineVi({ ...entry('dict:a', {}, NOW - 1000), seenAt: 0 }, NOW)).toBe('Mục bạn từng học trước đây');
  });

  it('chunks (no last)', () => {
    expect(contextLineVi(entry('chunk:gonna', { reps: 2 }), NOW)).toBe('Ôn lần 3');
    expect(contextLineVi(entry('chunk:gonna', { reps: 0 }), NOW)).toBe('Cụm từ bạn đang học');
  });
});

describe('growthLineVi', () => {
  const st = (s: Partial<CardState>): CardState => ({
    id: 'dict:a',
    due: NOW,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    ...s,
  });

  it('learning: when it comes back', () => {
    expect(growthLineVi(undefined, st({ due: NOW + 60_000 }), NOW)).toBe('Gặp lại sau 1 phút');
    expect(growthLineVi(undefined, st({ due: startOfLocalDay(NOW, 1) + 3_600_000 }), NOW)).toBe('Gặp lại ngày mai');
  });

  it('graduated: the new interval, with the previous one when it changed', () => {
    expect(growthLineVi(undefined, st({ interval: 1 }), NOW)).toBe('Gặp lại sau 1 ngày');
    expect(growthLineVi(st({ interval: 0 }), st({ interval: 4 }), NOW)).toBe('Gặp lại sau 4 ngày');
    expect(growthLineVi(st({ interval: 3 }), st({ interval: 8 }), NOW)).toBe('Gặp lại sau 1 tuần (lần trước: 3 ngày)');
    expect(growthLineVi(st({ interval: 3 }), st({ interval: 3 }), NOW)).toBe('Gặp lại sau 3 ngày');
    expect(growthLineVi(st({ interval: 60 }), st({ interval: 15 }), NOW)).toBe(
      'Gặp lại sau 2 tuần (lần trước: 2 tháng)',
    );
  });
});
