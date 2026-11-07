import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryTtsCache, createTtsCache, hashString, planEviction, ttsCacheKey } from './ttsCache';

const parts = { kind: 'gemini', model: 'gemini-3.8-flash-tts', voice: 'Kore', style: 'natural', text: 'Want to grab a coffee?' };

describe('ttsCacheKey', () => {
  it('is stable, whitespace-normalized and sensitive to every part', () => {
    const a = ttsCacheKey(parts);
    expect(a.key).toMatch(/^tts-[0-9a-f]{16}$/);
    expect(ttsCacheKey({ ...parts, text: '  Want to  grab a coffee? ' }).key).toBe(a.key);
    for (const k of ['kind', 'model', 'voice', 'style', 'text'] as const) {
      expect(ttsCacheKey({ ...parts, [k]: parts[k] + 'x' }).key).not.toBe(a.key);
    }
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

describe('planEviction', () => {
  const entries = [
    { key: 'a', size: 40, lastUsed: 3 },
    { key: 'b', size: 30, lastUsed: 1 },
    { key: 'c', size: 20, lastUsed: 2 },
  ];
  it('evicts least recently used until the new clip fits', () => {
    expect(planEviction(entries, 100, { key: 'n', size: 10 })).toEqual({ evict: [], store: true });
    expect(planEviction(entries, 100, { key: 'n', size: 25 })).toEqual({ evict: ['b'], store: true });
    expect(planEviction(entries, 100, { key: 'n', size: 70 })).toEqual({ evict: ['b', 'c', 'a'], store: true });
  });
  it('refuses clips larger than the cap and does not count a replaced key', () => {
    expect(planEviction(entries, 100, { key: 'n', size: 101 })).toEqual({ evict: [], store: false });
    expect(planEviction(entries, 100, { key: 'a', size: 50 })).toEqual({ evict: [], store: true });
  });
});

describe('memory cache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores, checks fullKey, and evicts LRU under the cap', async () => {
    let t = 0;
    const cache = createMemoryTtsCache(10, () => ++t);
    const blob = (n: number) => ({ audio: new Blob([new Uint8Array(n)]), mime: 'audio/wav' });
    await cache.put('k1', 'full1', blob(4));
    await cache.put('k2', 'full2', blob(4));
    expect(await cache.get('k1', 'full1')).toBeDefined(); // k1 now most recent
    expect(await cache.get('k1', 'other-full')).toBeUndefined(); // collision guard
    await cache.put('k3', 'full3', blob(4)); // evicts k2
    expect(await cache.get('k2', 'full2')).toBeUndefined();
    expect(await cache.get('k3', 'full3')).toBeDefined();
    expect(await cache.stats()).toEqual({ entries: 2, bytes: 8, backend: 'memory' });
    await cache.put('big', 'fullbig', blob(11));
    expect(await cache.get('big', 'fullbig')).toBeUndefined();
    await cache.clear();
    expect((await cache.stats()).entries).toBe(0);
  });

  it('falls back to memory when IndexedDB is missing or broken', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(createTtsCache().backend).toBe('memory');

    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('SecurityError: file://');
      },
    });
    const c = createTtsCache();
    expect(c.backend).toBe('indexeddb');
    await c.put('k', 'f', { audio: new Blob([new Uint8Array(3)]), mime: 'audio/wav' });
    expect(c.backend).toBe('memory');
    expect(await c.get('k', 'f')).toBeDefined();
  });
});
