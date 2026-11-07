import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE, newCard, type CardState } from '../../core/srs';
import type { Chunk } from '../../core/types';
import { dueInfo, formatEase, parseSortMode, sortChunks } from './listStats';

const NOW = Date.UTC(2026, 10, 5, 3, 0, 0);

function chunk(id: string, rank: number): Chunk {
  return { id, written: id, spoken: id, ttsText: id, phenomena: [], meaning: '', example: '', exampleVi: '', rank };
}

function card(id: string, patch: Partial<CardState>): CardState {
  return { ...newCard(id, NOW), reps: 1, interval: 1, ...patch };
}

const chunks = [chunk('a', 1), chunk('b', 2), chunk('c', 3), chunk('d', 4), chunk('e', 5)];
const states: Record<string, CardState> = {
  b: card('b', { due: NOW + 3 * DAY, lapses: 0, ease: 2.5 }),
  c: card('c', { due: NOW - DAY, lapses: 2, ease: 2.1 }),
  d: card('d', { due: NOW + HOUR, lapses: 2, ease: 1.7 }),
};

describe('sortChunks', () => {
  it('rank keeps the data order and does not mutate the input', () => {
    const reversed = [...chunks].reverse();
    expect(sortChunks(reversed, states, 'rank').map((c) => c.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(reversed[0].id).toBe('e');
  });

  it('due puts overdue first and never-studied cards last', () => {
    expect(sortChunks(chunks, states, 'due').map((c) => c.id)).toEqual(['c', 'd', 'b', 'a', 'e']);
  });

  it('lapses puts the most forgotten (then lowest ease) first', () => {
    expect(sortChunks(chunks, states, 'lapses').map((c) => c.id)).toEqual(['d', 'c', 'b', 'a', 'e']);
  });

  it('parseSortMode falls back to rank', () => {
    expect(parseSortMode('due')).toBe('due');
    expect(parseSortMode('nope')).toBe('rank');
    expect(parseSortMode(undefined)).toBe('rank');
  });
});

describe('dueInfo', () => {
  it('describes due, overdue and upcoming cards', () => {
    expect(dueInfo(card('x', { due: NOW }), NOW)).toEqual({ label: 'Đến hạn', tone: 'due' });
    expect(dueInfo(card('x', { due: NOW - 2 * DAY - HOUR }), NOW)).toEqual({ label: 'Quá hạn 2 ngày', tone: 'overdue' });
    expect(dueInfo(card('x', { due: NOW + 3 * DAY }), NOW)).toEqual({ label: 'còn 3 ngày', tone: 'later' });
    expect(dueInfo(card('x', { due: NOW + 10 * MINUTE }), NOW)).toEqual({ label: 'còn 10 phút', tone: 'soon' });
  });
});

describe('formatEase', () => {
  it('uses a decimal comma', () => {
    expect(formatEase(2.5)).toBe('2,5');
    expect(formatEase(2.349)).toBe('2,35');
    expect(formatEase(3)).toBe('3');
  });
});
