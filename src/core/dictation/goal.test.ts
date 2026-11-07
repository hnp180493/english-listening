import { describe, expect, it } from 'vitest';
import { goalProgress, SESSION_GOAL, summarizeChecks, type SessionCheck } from './goal';

describe('goalProgress', () => {
  it('counts checks since the round start, capped at the goal', () => {
    expect(goalProgress(0, 0)).toEqual({ done: 0, goal: SESSION_GOAL, reached: false, pct: 0 });
    expect(goalProgress(4, 0).done).toBe(4);
    expect(goalProgress(13, 0)).toMatchObject({ done: 10, reached: true, pct: 100 });
    expect(goalProgress(13, 10)).toMatchObject({ done: 3, reached: false, pct: 30 });
  });
  it('handles odd input', () => {
    expect(goalProgress(2, 5).done).toBe(0);
    expect(goalProgress(5, 0, 0).goal).toBe(SESSION_GOAL);
  });
});

describe('summarizeChecks', () => {
  const c = (score: number, seen: SessionCheck['seen'], missed: SessionCheck['missed']): SessionCheck => ({ id: 'x', score, seen, missed });

  it('averages scores and counts perfect checks', () => {
    const s = summarizeChecks([c(1, [], []), c(0.5, [], []), c(0, [], [])]);
    expect(s.count).toBe(3);
    expect(s.avg).toBeCloseTo(0.5);
    expect(s.perfect).toBe(1);
  });
  it('ranks the most-missed phenomena', () => {
    const s = summarizeChecks([
      c(0.5, ['linking', 'flap-t'], ['flap-t']),
      c(0.6, ['flap-t', 'elision'], ['flap-t', 'elision']),
      c(0.8, ['linking', 'elision'], ['linking', 'linking']),
      c(1, ['weak-form'], []),
    ]);
    expect(s.topMissed.map((m) => m.phenomenon)).toEqual(['flap-t', 'linking', 'elision']);
    expect(s.topMissed[0]).toEqual({ phenomenon: 'flap-t', missed: 2, seen: 2 });
  });
  it('empty input gives an empty summary', () => {
    expect(summarizeChecks([])).toEqual({ count: 0, avg: 0, perfect: 0, topMissed: [] });
  });
});
