import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEYS, STORAGE_PREFIX } from '../../core/storage';
import { applyAnswer, applySetResult, emptyProgress } from './game';
import { commitPairsProgress, isPairsStorageKey, loadPairsProgress } from './store';

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

const KEY = STORAGE_PREFIX + KEYS.pairs;
const NOW = 1_700_000_000_000;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('commitPairsProgress', () => {
  it('starts from storage, not a stale snapshot, so another tab’s writes are kept', () => {
    const map = stubStorage('ok');
    // This page mounted with empty progress; meanwhile another tab answered item "a".
    const staleSnapshot = emptyProgress();
    map.set(KEY, JSON.stringify(applyAnswer(emptyProgress(), 'a', true, NOW)));

    const saved = commitPairsProgress((p) => applyAnswer(p, 'b', false, NOW + 1));
    expect(saved).not.toBeNull();
    expect(Object.keys(saved!.items).sort()).toEqual(['a', 'b']);
    expect(loadPairsProgress()).toEqual(saved);
    expect(staleSnapshot.items).toEqual({});
  });

  it('keeps set results written elsewhere when recording a new one', () => {
    const map = stubStorage('ok');
    map.set(KEY, JSON.stringify(applySetResult(emptyProgress(), 'set-1', 0.9, NOW)));
    const saved = commitPairsProgress((p) => applySetResult(p, 'set-2', 0.5, NOW + 1));
    expect(saved?.sets['set-1']?.best).toBe(0.9);
    expect(saved?.sets['set-2']?.best).toBe(0.5);
  });

  it('returns null when storage is blocked or full, so the caller keeps counting in memory', () => {
    for (const mode of ['blocked', 'full'] as const) {
      stubStorage(mode);
      expect(commitPairsProgress((p) => applyAnswer(p, 'a', true, NOW))).toBeNull();
    }
  });
});

describe('isPairsStorageKey', () => {
  it('matches the pairs key and a full clear only', () => {
    expect(isPairsStorageKey(KEY)).toBe(true);
    expect(isPairsStorageKey(null)).toBe(true);
    expect(isPairsStorageKey(STORAGE_PREFIX + KEYS.stats)).toBe(false);
    expect(isPairsStorageKey(KEYS.pairs)).toBe(false);
  });
});
