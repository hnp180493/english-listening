import { describe, expect, it } from 'vitest';
import type { CardState } from '../srs';
import type { Sentence } from '../types';
import {
  countDue,
  countReview,
  dueQueue,
  filterByFocus,
  isSentenceDue,
  matchesFocus,
  needsReview,
  parseFocus,
  parseLevel,
  parseMode,
  reviewQueue,
} from './modes';
import { removeProgress, sanitizeProgress, updateProgress, type ProgressMap } from './progress';

const S = (id: string, focus: Sentence['focus'] = []): Sentence => ({ id, text: id, vi: '', level: 1, topic: 'x', focus });

describe('route params', () => {
  it('parses mode with a safe fallback', () => {
    expect(parseMode('cloze')).toBe('cloze');
    expect(parseMode('review')).toBe('review');
    expect(parseMode('custom')).toBe('custom');
    expect(parseMode('nope')).toBe('normal');
    expect(parseMode(undefined)).toBe('normal');
  });
  it('parses level 1|2|3 else 0', () => {
    expect(parseLevel('1')).toBe(1);
    expect(parseLevel(' 3 ')).toBe(3);
    expect(parseLevel(2)).toBe(2);
    expect(parseLevel('4')).toBe(0);
    expect(parseLevel('')).toBe(0);
  });
  it('parses focus only for known phenomena', () => {
    expect(parseFocus('flap-t')).toBe('flap-t');
    expect(parseFocus('constructor')).toBeNull();
    expect(parseFocus(null)).toBeNull();
  });
});

describe('focus filtering', () => {
  const a = S('a', ['linking']);
  const b = S('b', ['elision']);
  const c = S('c');
  const detected: Record<string, Sentence['focus']> = { a: [], b: ['linking'], c: [] };

  it('matches author focus OR decoder annotations', () => {
    expect(matchesFocus(a, 'linking')).toBe(true);
    expect(matchesFocus(b, 'linking', ['linking'])).toBe(true);
    expect(matchesFocus(c, 'linking', [])).toBe(false);
    expect(matchesFocus(c, null)).toBe(true);
  });
  it('filters a list', () => {
    expect(filterByFocus([a, b, c], 'linking', (s) => detected[s.id]).map((s) => s.id)).toEqual(['a', 'b']);
    expect(filterByFocus([a, b, c], null, () => [])).toHaveLength(3);
  });
});

describe('review queue', () => {
  const now = 1_000_000;
  let p: ProgressMap = {};
  p = updateProgress(p, 'perfect', 1, now);
  p = updateProgress(p, 'half-old', 0.5, now - 500);
  p = updateProgress(p, 'half-new', 0.5, now);
  p = updateProgress(p, 'low', 0.2, now);
  p = updateProgress(p, 'hinted', 1, now - 900, true);

  it('selects sentences with best < 1 or a hinted success', () => {
    expect(needsReview(p.perfect)).toBe(false);
    expect(needsReview(p['half-old'])).toBe(true);
    expect(needsReview(p.hinted)).toBe(true);
    expect(needsReview(undefined)).toBe(false);
  });
  it('orders by lowest best, then oldest', () => {
    const list = ['perfect', 'half-new', 'hinted', 'low', 'half-old', 'unseen'].map((id) => S(id));
    expect(reviewQueue(list, p).map((s) => s.id)).toEqual(['low', 'half-old', 'half-new', 'hinted']);
    expect(countReview(list, p)).toBe(4);
  });
  it('a hinted sentence graduates after a clean perfect attempt', () => {
    const q = updateProgress(p, 'hinted', 1, now + 10, false);
    expect(needsReview(q.hinted)).toBe(false);
    const again = updateProgress(q, 'hinted', 1, now + 20, true);
    expect(needsReview(again.hinted)).toBe(true);
  });
  it('sanitize keeps a valid cleanAt and drops a bad one', () => {
    const s = sanitizeProgress({
      x: { best: 1, attempts: 2, lastAt: 5, hints: 1, cleanAt: 5 },
      y: { best: 1, attempts: 2, lastAt: 5, hints: 1, cleanAt: 'soon' },
    });
    expect(s.x.cleanAt).toBe(5);
    expect(needsReview(s.x)).toBe(false);
    expect(s.y.cleanAt).toBeUndefined();
    expect(needsReview(s.y)).toBe(true);
  });
  it('removeProgress drops one entry without mutating', () => {
    const next = removeProgress(p, 'low');
    expect(next.low).toBeUndefined();
    expect(p.low).toBeDefined();
    expect(removeProgress(p, 'missing')).toBe(p);
  });
});

describe('"Ôn đến hạn" (spaced review)', () => {
  const now = new Date(2026, 10, 6, 12, 0).getTime();
  const HOUR = 3_600_000;
  const card = (id: string, interval: number, due: number): CardState => ({
    id,
    due,
    interval,
    ease: 2.5,
    reps: interval > 0 ? 1 : 0,
    lapses: 0,
  });
  const states: Record<string, CardState> = {
    // graduated, due later today: calendar-day due, so it counts already
    today: card('today', 3, now + 6 * HOUR),
    // graduated, overdue by two days
    old: card('old', 1, now - 48 * HOUR),
    // learning step 30 min ahead: not yet
    soon: card('soon', 0, now + 30 * 60_000),
    // learning step that just passed
    step: card('step', 0, now - 60_000),
    // graduated, due tomorrow
    tomorrow: card('tomorrow', 1, new Date(2026, 10, 7, 9, 0).getTime()),
  };
  const list = ['today', 'tomorrow', 'step', 'unknown', 'soon', 'old'].map((id) => S(id));

  it('serves due cards only, most overdue first', () => {
    expect(dueQueue(list, states, now).map((s) => s.id)).toEqual(['old', 'step', 'today']);
    expect(countDue(list, states, now)).toBe(3);
  });
  it('breaks ties on the id and keeps the list order out of it', () => {
    const tie = { b: card('b', 1, now - HOUR), a: card('a', 1, now - HOUR) };
    expect(dueQueue([S('b'), S('a')], tie, now).map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('isSentenceDue matches the queue and ignores inherited keys', () => {
    expect(isSentenceDue(states, 'today', now)).toBe(true);
    expect(isSentenceDue(states, 'soon', now)).toBe(false);
    expect(isSentenceDue(states, 'unknown', now)).toBe(false);
    expect(isSentenceDue(states, 'constructor', now)).toBe(false);
    expect(countDue([S('constructor'), S('toString')], states, now)).toBe(0);
  });
  it('a learning card becomes due once its step has passed', () => {
    expect(isSentenceDue(states, 'soon', now + 31 * 60_000)).toBe(true);
  });
  it('is empty without states', () => {
    expect(dueQueue(list, {}, now)).toEqual([]);
    expect(countDue([], states, now)).toBe(0);
  });
});
