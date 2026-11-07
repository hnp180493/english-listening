import { describe, expect, it } from 'vitest';
import { DAY, newCard, type CardState } from '../../core/srs';
import type { Chunk, Phenomenon } from '../../core/types';
import {
  FOCUS_MAX_NEW,
  FOCUS_REQUEUE_GAP,
  advanceFocus,
  gradeOutcome,
  isExtraPractice,
  parseFocus,
  phenomenonCounts,
  startFocusSession,
} from './focus';

const NOW = Date.UTC(2026, 10, 5, 3, 0, 0);

function chunk(id: string, rank: number, phenomena: Phenomenon[]): Chunk {
  return { id, written: `w ${id}`, spoken: id, ttsText: id, phenomena, meaning: '', example: '', exampleVi: '', rank };
}

function card(id: string, patch: Partial<CardState>): CardState {
  return { ...newCard(id, NOW), reps: 1, interval: 1, ...patch };
}

describe('parseFocus', () => {
  it('accepts only known phenomena', () => {
    expect(parseFocus('linking')).toBe('linking');
    expect(parseFocus('flap-t')).toBe('flap-t');
    for (const bad of [undefined, null, '', 'Linking', 'foo', 3]) expect(parseFocus(bad)).toBeNull();
  });
});

describe('isExtraPractice', () => {
  it('is true only for started cards that are not due', () => {
    expect(isExtraPractice(undefined, NOW)).toBe(false);
    expect(isExtraPractice(card('a', { due: NOW - 1 }), NOW)).toBe(false);
    expect(isExtraPractice(card('a', { due: NOW + DAY }), NOW)).toBe(true);
  });
});

describe('phenomenonCounts', () => {
  it('counts totals, due and new cards per phenomenon and skips empty ones', () => {
    const chunks = [
      chunk('a', 1, ['linking', 'weak-form']),
      chunk('b', 2, ['linking']),
      chunk('c', 3, ['reduction', 'reduction']),
    ];
    const states = { a: card('a', { due: NOW - DAY }), c: card('c', { due: NOW + DAY }) };
    const rows = phenomenonCounts(chunks, states, NOW);
    expect(rows.map((r) => r.phenomenon)).toEqual(['linking', 'weak-form', 'reduction']);
    expect(rows[0]).toEqual({ phenomenon: 'linking', total: 2, due: 1, fresh: 1 });
    expect(rows[2]).toEqual({ phenomenon: 'reduction', total: 1, due: 0, fresh: 0 });
  });
});

describe('startFocusSession', () => {
  const chunks = [
    ...Array.from({ length: 8 }, (_, i) => chunk(`n${i}`, 10 + i, ['flap-t'])),
    chunk('d1', 50, ['flap-t']),
    chunk('d2', 51, ['flap-t', 'linking']),
    chunk('x1', 60, ['flap-t']),
    chunk('x2', 61, ['flap-t']),
    chunk('other', 1, ['linking']),
  ];
  const states: Record<string, CardState> = {
    d1: card('d1', { due: NOW - 1000 }),
    d2: card('d2', { due: NOW - DAY }),
    x1: card('x1', { due: NOW + 5 * DAY, interval: 10, lapses: 0 }),
    x2: card('x2', { due: NOW + 9 * DAY, interval: 10, lapses: 3, ease: 1.6 }),
  };

  it('orders due (most overdue first), then capped new cards, then weakest extra cards', () => {
    const s = startFocusSession(chunks, states, 'flap-t', NOW);
    expect(s.queue.slice(0, 2)).toEqual(['d2', 'd1']);
    expect(s.queue.slice(2, 2 + FOCUS_MAX_NEW)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
    expect(s.queue.slice(2 + FOCUS_MAX_NEW)).toEqual(['x2', 'x1']);
    expect(s.queue).not.toContain('other');
    expect(s.total).toBe(s.queue.length);
    expect(s.done).toBe(0);
  });

  it('respects the session size and handles a phenomenon with no chunk', () => {
    expect(startFocusSession(chunks, states, 'flap-t', NOW, 3).queue).toEqual(['d2', 'd1', 'n0']);
    const empty = startFocusSession(chunks, states, 'h-dropping', NOW);
    expect(empty.queue).toEqual([]);
    expect(empty.total).toBe(0);
  });
});

describe('advanceFocus', () => {
  const base = startFocusSession(
    ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => chunk(id, i, ['linking'])),
    {},
    'linking',
    NOW,
    10,
  );

  it('starts with at most FOCUS_MAX_NEW new cards', () => {
    expect(base.queue).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('moves to the next card and counts correct answers', () => {
    const s = advanceFocus(advanceFocus(base, 'a', 'good'), 'b', 'hard');
    expect(s.queue[0]).toBe('c');
    expect(s.done).toBe(2);
    expect(s.correct).toBe(1);
    expect(s.missed).toEqual([]);
  });

  it('re-queues an "again" card a few cards later, only once', () => {
    let s = advanceFocus(base, 'a', 'again');
    expect(s.queue.indexOf('a')).toBe(FOCUS_REQUEUE_GAP);
    expect(s.missed).toEqual(['a']);
    while (s.queue[0] !== 'a') s = advanceFocus(s, s.queue[0], 'good');
    s = advanceFocus(s, 'a', 'again');
    expect(s.queue).not.toContain('a');
    expect(s.missed).toEqual(['a']);
  });

  it('re-queues at the end when few cards remain, and ignores a stale id', () => {
    let s = advanceFocus(advanceFocus(advanceFocus(base, 'a', 'good'), 'b', 'good'), 'c', 'good');
    s = advanceFocus(s, 'd', 'again');
    expect(s.queue).toEqual(['e', 'd']);
    expect(advanceFocus(s, 'zzz', 'good')).toBe(s);
  });
});

describe('gradeOutcome', () => {
  const ph: Phenomenon[] = ['linking', 'elision'];
  it("counts only 'again' as missing the chunk's phenomena", () => {
    expect(gradeOutcome('again', ph)).toEqual({ correct: false, missed: ph });
    expect(gradeOutcome('hard', ph)).toEqual({ correct: false, missed: [] });
    expect(gradeOutcome('good', ph)).toEqual({ correct: true, missed: [] });
    expect(gradeOutcome('easy', ph)).toEqual({ correct: true, missed: [] });
  });
  it('returns a copy, not the input array', () => {
    expect(gradeOutcome('again', ph).missed).not.toBe(ph);
  });
});
