import { afterEach, describe, expect, it, vi } from 'vitest';

function stubStorage(values: Record<string, string>) {
  const map = new Map(Object.entries(values));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: () => {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('loadJSON', () => {
  it('returns the fallback when the stored shape does not match a non-null fallback', async () => {
    stubStorage({
      'nghe-noi-am:obj-null': 'null',
      'nghe-noi-am:obj-arr': '[1,2]',
      'nghe-noi-am:obj-str': '"x"',
      'nghe-noi-am:arr-obj': '{"a":1}',
      'nghe-noi-am:bad': '{bad json',
      'nghe-noi-am:ok-obj': '{"a":1}',
      'nghe-noi-am:ok-arr': '[1]',
    });
    const { loadJSON } = await import('./storage');
    expect(loadJSON('obj-null', { d: 1 })).toEqual({ d: 1 });
    expect(loadJSON('obj-arr', { d: 1 })).toEqual({ d: 1 });
    expect(loadJSON('obj-str', { d: 1 })).toEqual({ d: 1 });
    expect(loadJSON('arr-obj', [] as number[])).toEqual([]);
    expect(loadJSON('bad', { d: 1 })).toEqual({ d: 1 });
    expect(loadJSON('ok-obj', {})).toEqual({ a: 1 });
    expect(loadJSON('ok-arr', [] as number[])).toEqual([1]);
    expect(loadJSON('missing', 'dflt')).toBe('dflt');
  });

  it('passes anything through with a null fallback (callers sanitize unknown)', async () => {
    stubStorage({ 'nghe-noi-am:k': '"str"' });
    const { loadJSON } = await import('./storage');
    expect(loadJSON<unknown>('k', null)).toBe('str');
  });

  it('a stored "null" for stats or settings no longer throws on load', async () => {
    stubStorage({ 'nghe-noi-am:stats': 'null', 'nghe-noi-am:settings': 'null' });
    const stats = await import('./stats');
    const settings = await import('./settings');
    expect(() => stats.reloadStats()).not.toThrow();
    expect(stats.loadStats().attempts).toEqual([]);
    expect(() => settings.reloadSettings()).not.toThrow();
    expect(settings.getSettings().voiceEngine).toBe('clips');
  });
});
