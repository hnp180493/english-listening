import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetAudioManifestForTests,
  clipFileFor,
  clipsDisabled,
  clipUrl,
  loadAudioManifest,
  CLIPS_RETRY_MS,
  hasShippedClip,
  MANIFEST_RETRY_MS,
  MANIFEST_TIMEOUT_MS,
  manifestUnavailable,
  parseAudioManifest,
  peekAudioManifest,
  preloadAudioManifest,
  reportClipFailure,
  reportClipSuccess,
  STATIC_DISABLE_AFTER,
} from './audioManifest';

afterEach(() => {
  _resetAudioManifestForTests();
  vi.unstubAllGlobals();
});

describe('parseAudioManifest', () => {
  it('reads the shapes the generator may write', () => {
    const want = new Map([
      ['k1', 'k1.mp3'],
      ['k2', 'k2.mp3'],
    ]);
    expect(parseAudioManifest({ clips: { k1: 'k1.mp3', k2: { f: 'k2.mp3', mode: 'careful', text: 'x' } } })).toEqual(want);
    expect(parseAudioManifest({ version: 1, clips: [{ key: 'k1', f: 'k1.mp3' }, { k: 'k2', file: 'audio/k2.mp3' }] })).toEqual(want);
    expect(parseAudioManifest({ k1: 'k1.mp3', k2: { path: 'k2.mp3' } })).toEqual(want);
  });

  it('skips unsafe or broken entries; non-manifests are empty', () => {
    const m = parseAudioManifest({ clips: { a: '../secret.mp3', b: 'https://x.test/b.mp3', c: 'c.exe', 'd/e': 'd.mp3', f: 42, ok: 'ok.mp3' } });
    expect([...m]).toEqual([['ok', 'ok.mp3']]);
    for (const bad of [null, undefined, 'x', 3, [], { clips: 'nope' }]) expect(parseAudioManifest(bad).size).toBe(0);
  });

  it('clip URL is relative to the page', () => {
    expect(clipUrl('k1.mp3')).toBe('audio/k1.mp3');
  });
});

describe('loading', () => {
  it('outside a page (no document) and with no loader: empty at once, no fetch', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(peekAudioManifest()?.size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it('loads once, lazily', async () => {
    const loader = vi.fn(async () => ({ clips: { k: 'k.mp3' } }));
    _resetAudioManifestForTests(loader);
    expect(peekAudioManifest()).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    const [a, b] = await Promise.all([loadAudioManifest(), loadAudioManifest()]);
    expect(a).toBe(b);
    expect(a?.get('k')).toBe('k.mp3');
    await loadAudioManifest();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(peekAudioManifest()).toBe(a);
  });

  it('an absent manifest (loader gives null) is remembered as empty, not asked for again', async () => {
    const loader = vi.fn(async () => null);
    _resetAudioManifestForTests(loader);
    expect((await loadAudioManifest())?.size).toBe(0);
    expect((await loadAudioManifest())?.size).toBe(0);
    expect(peekAudioManifest()?.size).toBe(0);
    expect(manifestUnavailable()).toBe(false); // absent is known (no clip anywhere), not unknown
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('a passing failure (loader throws) is UNKNOWN (null, not empty), and is asked for again after MANIFEST_RETRY_MS', async () => {
    let t = 1_000_000;
    const now = vi.spyOn(Date, 'now').mockImplementation(() => t);
    try {
      let fail = true;
      const loader = vi.fn(async () => {
        if (fail) throw new TypeError('Failed to fetch');
        return { clips: { k: 'k.mp3' } };
      });
      _resetAudioManifestForTests(loader);
      expect(await loadAudioManifest()).toBeNull();
      // within the back-off: unknown at once (not empty: any text may have a clip), no new request
      expect(peekAudioManifest()).toBeNull();
      expect(manifestUnavailable()).toBe(true);
      expect(await loadAudioManifest()).toBeNull();
      expect(loader).toHaveBeenCalledTimes(1);
      fail = false;
      t += MANIFEST_RETRY_MS + 1;
      expect(peekAudioManifest()).toBeNull(); // still unknown, but the next playback waits for the retry
      expect(manifestUnavailable()).toBe(false);
      expect((await loadAudioManifest())?.get('k')).toBe('k.mp3');
      expect(loader).toHaveBeenCalledTimes(2);
      expect(peekAudioManifest()?.get('k')).toBe('k.mp3');
    } finally {
      now.mockRestore();
    }
  });

  it('a loader that throws synchronously is retried too', async () => {
    let t = 5_000_000;
    const now = vi.spyOn(Date, 'now').mockImplementation(() => t);
    try {
      let calls = 0;
      _resetAudioManifestForTests(() => {
        calls++;
        if (calls === 1) throw new Error('boom');
        return Promise.resolve({ clips: { k: 'k.mp3' } });
      });
      expect(await loadAudioManifest()).toBeNull();
      t += MANIFEST_RETRY_MS + 1;
      expect((await loadAudioManifest())?.get('k')).toBe('k.mp3');
    } finally {
      now.mockRestore();
    }
  });

  it('default loader: the inline element of the portable build wins over fetch', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.stubGlobal('document', {
      getElementById: (id: string) => (id === 'nna-audio-manifest' ? { textContent: '{"clips":{"k":"k.mp3"}}' } : null),
    });
    _resetAudioManifestForTests();
    expect((await loadAudioManifest())?.get('k')).toBe('k.mp3');
    expect(f).not.toHaveBeenCalled();
  });

  it('default loader: fetches audio/manifest.json; a 404 gives an empty one, a 5xx or network error an unknown one', async () => {
    vi.stubGlobal('document', { getElementById: () => null });
    const f = vi.fn(async (url: string) => {
      void url;
      return { ok: true, json: async () => ({ clips: { k: 'k.mp3' } }) };
    });
    vi.stubGlobal('fetch', f);
    _resetAudioManifestForTests();
    expect((await loadAudioManifest())?.get('k')).toBe('k.mp3');
    expect(f.mock.calls[0][0]).toBe('audio/manifest.json');

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    _resetAudioManifestForTests();
    expect((await loadAudioManifest())?.size).toBe(0);
    expect(peekAudioManifest()?.size).toBe(0); // absent: remembered

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    _resetAudioManifestForTests();
    expect(await loadAudioManifest()).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    _resetAudioManifestForTests();
    expect(await loadAudioManifest()).toBeNull();

    // the body cut off by the timeout or the network: unknown (retried), not "broken for good"
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => Promise.reject(new TypeError('network error')) })));
    _resetAudioManifestForTests();
    expect(await loadAudioManifest()).toBeNull();
    expect(manifestUnavailable()).toBe(true);
    // a body that is not JSON: absent for good
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('bad json')) })));
    _resetAudioManifestForTests();
    expect((await loadAudioManifest())?.size).toBe(0);
  });

  it('default loader: the fetch gives up after MANIFEST_TIMEOUT_MS (a slow network is a passing failure)', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('document', { getElementById: () => null });
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init: { signal: AbortSignal }) =>
            new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
        ),
      );
      _resetAudioManifestForTests();
      const p = loadAudioManifest();
      await vi.advanceTimersByTimeAsync(MANIFEST_TIMEOUT_MS - 100);
      let settled = false;
      void p.then(() => (settled = true));
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false); // still loading at 4 s and well beyond: the playback does not wait for it
      await vi.advanceTimersByTimeAsync(200);
      expect(await p).toBeNull();
      expect(manifestUnavailable()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('preloadAudioManifest starts the load once (app start), so the first playback finds it known', async () => {
    const loader = vi.fn(async () => ({ clips: { k: 'k.mp3' } }));
    _resetAudioManifestForTests(loader);
    preloadAudioManifest();
    preloadAudioManifest();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(peekAudioManifest()?.get('k')).toBe('k.mp3');
  });

  it('default loader on file:// without an inline manifest does not fetch', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.stubGlobal('document', { getElementById: () => null });
    vi.stubGlobal('location', { protocol: 'file:' });
    _resetAudioManifestForTests();
    expect((await loadAudioManifest())?.size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('failure memory', () => {
  const m = new Map([
    ['a', 'a.mp3'],
    ['b', 'b.mp3'],
    ['c', 'c.mp3'],
  ]);

  it('a failed file is skipped for a while; a success resets the run', () => {
    expect(clipFileFor(m, 'a')).toBe('a.mp3');
    reportClipFailure('a.mp3');
    expect(clipFileFor(m, 'a')).toBeNull();
    reportClipSuccess();
    reportClipFailure('b.mp3');
    expect(clipsDisabled()).toBe(STATIC_DISABLE_AFTER <= 1);
    expect(clipFileFor(m, 'c')).toBe('c.mp3');
    expect(clipFileFor(m, 'zzz')).toBeNull();
  });

  it('failures in a row (missing folder) turn clips off for CLIPS_RETRY_MS, then they are tried again', () => {
    let t = 9_000_000;
    const now = vi.spyOn(Date, 'now').mockImplementation(() => t);
    try {
      const turnedOff: boolean[] = [];
      for (let i = 0; i < STATIC_DISABLE_AFTER; i++) turnedOff.push(reportClipFailure(`f${i}.mp3`));
      expect(turnedOff.at(-1)).toBe(true); // reported once, for the notice
      expect(clipsDisabled()).toBe(true);
      expect(clipFileFor(m, 'c')).toBeNull();
      expect(hasShippedClip(m, 'c')).toBe(true); // still a shipped text: never worth a paid request
      t += CLIPS_RETRY_MS + 1;
      expect(clipsDisabled()).toBe(false);
      expect(clipFileFor(m, 'c')).toBe('c.mp3');
      // still failing: one more failure turns them off again at once
      expect(reportClipFailure('c.mp3')).toBe(true);
      expect(clipsDisabled()).toBe(true);
      // a file that failed alone is tried again after CLIPS_RETRY_MS too
      t += CLIPS_RETRY_MS + 1;
      reportClipSuccess();
      expect(clipFileFor(m, 'c')).toBe('c.mp3');
    } finally {
      now.mockRestore();
    }
  });
});
