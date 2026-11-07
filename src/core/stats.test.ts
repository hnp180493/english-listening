import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Phenomenon } from './types';

type Mode = 'ok' | 'blocked' | 'full';

function stubStorage(mode: Mode) {
  const map = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => {
      if (mode === 'blocked') throw new Error('SecurityError');
      return map.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (mode !== 'ok') throw new Error(mode === 'full' ? 'QuotaExceededError' : 'SecurityError');
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
  vi.stubGlobal('window', { localStorage });
  return map;
}

/** Fresh module so the in-memory session copy does not leak between tests. */
async function freshStats() {
  vi.resetModules();
  return import('./stats');
}

const linking = 'linking' as Phenomenon;
const attempt = { module: 'dictation' as const, itemId: 's1', correct: true, seen: [linking], missed: [] };

describe('stats with degraded storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps counting in memory when storage is blocked', async () => {
    stubStorage('blocked');
    const { recordAttempt, loadStats, subscribeStats } = await freshStats();
    const lengths: number[] = [];
    subscribeStats((s) => lengths.push(s.attempts.length));
    recordAttempt(attempt);
    recordAttempt(attempt);
    recordAttempt(attempt);
    expect(loadStats().attempts.length).toBe(3);
    expect(loadStats().byPhenomenon[linking].seen).toBe(3);
    expect(lengths).toEqual([1, 2, 3]);
  });

  it('keeps counting in memory when writes fail (storage full)', async () => {
    stubStorage('full');
    const { recordAttempt, loadStats, resetStats } = await freshStats();
    recordAttempt(attempt);
    const first = loadStats();
    recordAttempt(attempt);
    expect(first.attempts.length).toBe(1); // earlier snapshot is not mutated in place
    expect(loadStats().attempts.length).toBe(2);
    resetStats();
    expect(loadStats().attempts.length).toBe(0);
  });

  it('re-reads storage on every record while storage works (cross-tab merge)', async () => {
    const map = stubStorage('ok');
    const { recordAttempt, loadStats } = await freshStats();
    recordAttempt(attempt);
    // Another tab appends an attempt.
    const key = [...map.keys()][0];
    const stored = JSON.parse(map.get(key)!);
    stored.attempts.push({ ...attempt, at: 1 });
    map.set(key, JSON.stringify(stored));
    recordAttempt(attempt);
    expect(loadStats().attempts.length).toBe(3);
  });
});

describe('review re-attempts and the progress archive', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts Ôn tập re-tests in stats but not in the archive the report trends on', async () => {
    const map = stubStorage('ok');
    const { recordAttempt, loadStats } = await freshStats();
    recordAttempt(attempt, { inReview: true });
    expect(loadStats().attempts).toHaveLength(1);
    const hist = JSON.parse(map.get('nghe-noi-am:progress-history') ?? '{"devices":{}}');
    const counted = Object.values(hist.devices as Record<string, Record<string, { mod?: Record<string, { n: number }> }>>)
      .flatMap((d) => Object.values(d))
      .reduce((n, a) => n + (a.mod?.dictation?.n ?? 0), 0);
    expect(counted).toBe(0);
    recordAttempt(attempt);
    const hist2 = JSON.parse(map.get('nghe-noi-am:progress-history')!);
    const counted2 = Object.values(hist2.devices as Record<string, Record<string, { mod?: Record<string, { n: number }> }>>)
      .flatMap((d) => Object.values(d))
      .reduce((n, a) => n + (a.mod?.dictation?.n ?? 0), 0);
    expect(counted2).toBe(1);
  });
});
