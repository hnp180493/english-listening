import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX } from './storage';
import {
  mergeReset,
  parseReset,
  parseTombstones,
  recordKeyReset,
  recordTombstone,
  resetTimeFor,
  TOMBSTONE_TTL_MS,
  withReset,
} from './syncMarkers';

function stubStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  });
  return map;
}

afterEach(() => vi.unstubAllGlobals());

describe('tombstones', () => {
  it('records a delete, keeps the later time, prunes old ones against the clock', () => {
    const map = stubStorage();
    const T = 1_800_000_000_000;
    expect(recordTombstone('custom', 'u-1', T)).toBe(true);
    recordTombstone('media', 'm1', T + 5);
    recordTombstone('custom', 'u-1', T - 100); // a clock behind never moves it back
    let t = parseTombstones(JSON.parse(map.get(STORAGE_PREFIX + 'tombstones')!));
    expect(t).toEqual({ version: 1, custom: { 'u-1': T }, media: { m1: T + 5 } });
    recordTombstone('custom', 'u-2', T + TOMBSTONE_TTL_MS + 1);
    t = parseTombstones(JSON.parse(map.get(STORAGE_PREFIX + 'tombstones')!));
    expect(t.custom).toEqual({ 'u-2': T + TOMBSTONE_TTL_MS + 1 });
    expect(t.media).toEqual({ m1: T + 5 });
  });

  it('ignores junk', () => {
    expect(parseTombstones({ custom: { a: 'x', __proto__: 5, b: -1, c: 3 }, media: [1] })).toEqual({ version: 1, custom: { c: 3 }, media: {} });
    stubStorage();
    expect(recordTombstone('custom', '')).toBe(false);
  });
});

describe('reset marker', () => {
  it('a full reset covers every key; a key reset only its key; each new reset is after every known one', () => {
    const m = withReset(parseReset(null), 100, ['stats']);
    expect(resetTimeFor(m, 'stats')).toBe(100);
    expect(resetTimeFor(m, 'settings')).toBe(0);
    const all = withReset(m, 50); // clock behind
    expect(all).toEqual({ version: 1, all: 101, keys: {} });
    expect(resetTimeFor(all, 'stats')).toBe(101);
    expect(withReset(all, 10, ['stats']).keys.stats).toBe(102);
    expect(mergeReset(m, all)).toEqual({ version: 1, all: 101, keys: { stats: 100 } });
  });

  it('recordKeyReset writes through the app storage', () => {
    const map = stubStorage();
    recordKeyReset(['stats'], 42);
    expect(JSON.parse(map.get(STORAGE_PREFIX + 'reset')!)).toEqual({ version: 1, all: 0, keys: { stats: 42 } });
  });
});
