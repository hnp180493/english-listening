import { afterEach, describe, expect, it, vi } from 'vitest';

// public/sw.js is a classic worker script, not a module: it is evaluated here in a sandbox with a stub `self`
// and `caches`, and its top-level functions are read from the sandbox.
/* eslint-disable @typescript-eslint/no-explicit-any */
const nodeModule = (name: string): Promise<any> => import(/* @vite-ignore */ name);
const { readFile } = await nodeModule('node:fs/promises');
const vm = await nodeModule('node:vm');

const SCOPE = 'https://app.example/';
const MANIFEST_URL = SCOPE + 'audio/manifest.json';
const META = 'nghe-noi-am-audio-meta';
const CLIPS_PREFIX = 'nghe-noi-am-audio-c-';

class MemCache {
  map = new Map<string, Response>();
  fetcher: (url: string) => Promise<Response>;
  constructor(fetcher: (url: string) => Promise<Response> = async () => new Response('')) {
    this.fetcher = fetcher;
  }
  /** Like the real Cache: a URL or a request (keyed by its URL). */
  async match(req: string | { url: string }): Promise<Response | undefined> {
    const r = this.map.get(typeof req === 'string' ? req : req.url);
    return r ? r.clone() : undefined;
  }
  /** Like Cache.put: an existing entry is replaced and moves to the end of keys(). */
  async put(req: string | { url: string }, res: Response): Promise<void> {
    const url = typeof req === 'string' ? req : req.url;
    this.map.delete(url);
    this.map.set(url, res);
  }
  async keys(): Promise<{ url: string }[]> {
    return [...this.map.keys()].map((url) => ({ url }));
  }
  async add(url: string): Promise<void> {
    const res = await this.fetcher(url);
    if (!res.ok) throw new Error('add failed');
    await this.put(url, res);
  }
  async delete(r: { url: string }): Promise<boolean> {
    return this.map.delete(r.url);
  }
}

async function loadSw(fetchImpl: (url: string) => Promise<Response>, build?: { id: string; assets: string[]; art: string[] }) {
  let src: string = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
  // a stamped build (what vite.config.ts writes into the copy in dist/)
  if (build) src = src.replace("const BUILD = { id: '', assets: [], art: [] };", () => 'const BUILD = ' + JSON.stringify(build) + ';');
  const stores = new Map<string, MemCache>();
  const handlers: Record<string, (e: any) => void> = {};
  const ctx: any = {
    self: {
      registration: { scope: SCOPE },
      location: { origin: new URL(SCOPE).origin },
      clients: { claim: async () => undefined },
      skipWaiting: async () => undefined,
      addEventListener: (t: string, fn: any) => (handlers[t] = fn),
    },
    caches: {
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new MemCache(fetchImpl));
        return stores.get(name);
      },
      keys: async () => [...stores.keys()],
      match: async (url: string) => {
        for (const c of stores.values()) {
          const r = await c.match(url);
          if (r) return r;
        }
        return undefined;
      },
      delete: async (name: string) => stores.delete(name),
    },
    fetch: (input: any) => fetchImpl(typeof input === 'string' ? input : input.url),
    // through globalThis at call time, so vi.useFakeTimers() applies inside the sandbox too
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
    URL,
    Response,
    Headers,
    Blob,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  /** Runs the worker's fetch handler for a GET; resolves with what it answered (undefined = not handled). */
  const dispatch = async (url: string, headers: Record<string, string> = {}, { wait = true } = {}): Promise<Response | undefined> => {
    let answer: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    handlers.fetch({
      request: { url, method: 'GET', mode: 'no-cors', headers: new Headers(headers) },
      respondWith: (p: Promise<Response>) => (answer = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const res = answer ? await answer : undefined;
    if (wait) await Promise.all(waits);
    return res;
  };
  const install = async () => {
    const waits: Promise<unknown>[] = [];
    handlers.install({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  const activate = async () => {
    const waits: Promise<unknown>[] = [];
    handlers.activate({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  /** The clip caches (one per manifest generation). */
  const clipStores = () => [...stores.entries()].filter(([k]) => k.startsWith(CLIPS_PREFIX));
  return { ctx, stores, dispatch, install, activate, clipStores };
}

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i % 251);
const clipResponse = () => new Response(bytes(1000), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
// Node's fetch Response has type 'default'; the worker stores only same-origin ('basic') answers.
const basic = (r: Response) => Object.defineProperty(r, 'type', { value: 'basic' });
const manifestResponse = (body: unknown) => basic(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));

afterEach(() => {
  vi.useRealTimers();
});

describe('service worker: shipped clips', () => {
  it('parseRange reads one bytes range, clamps the end, and refuses what cannot be served', async () => {
    const { ctx } = await loadSw(async () => new Response(''));
    const p = ctx.parseRange;
    expect(p('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(p('bytes=0-1', 1000)).toEqual({ start: 0, end: 1 });
    expect(p('bytes=500-5000', 1000)).toEqual({ start: 500, end: 999 });
    expect(p('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(p('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(p('bytes=5-2', 1000)).toBe('unsatisfiable');
    expect(p('bytes=0-1,5-9', 1000)).toBeNull(); // multi-range: the whole file
    expect(p('items=0-1', 1000)).toBeNull();
  });

  it('answers a Range request with a 206 cut from the whole file, first fetched and then cached', async () => {
    let fetches = 0;
    const seen: string[] = [];
    const { dispatch, clipStores } = await loadSw(async (url) => {
      fetches++;
      seen.push(url);
      return basic(clipResponse());
    });
    const url = SCOPE + 'audio/abc123.mp3';
    // Safari's first probe
    let res = (await dispatch(url, { range: 'bytes=0-1' }))!;
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-1/1000');
    expect(res.headers.get('Content-Length')).toBe('2');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([0, 1]);
    // stored whole (200), so the next ranges come from the cache
    expect(clipStores()).toHaveLength(1);
    const stored = await clipStores()[0][1].match(url);
    expect(stored?.status).toBe(200);
    res = (await dispatch(url, { range: 'bytes=990-' }))!;
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 990-999/1000');
    expect(new Uint8Array(await res.arrayBuffer()).length).toBe(10);
    // no Range header: the whole stored 200
    res = (await dispatch(url))!;
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(1000);
    res = (await dispatch(url, { range: 'bytes=2000-' }))!;
    expect(res.status).toBe(416);
    expect(fetches).toBe(1);
    expect(seen).toEqual([url]);
  });

  it('keeps audio/manifest.json in its own cache (survives deploys) and serves it offline', async () => {
    let online = true;
    const { stores, dispatch } = await loadSw(async () => {
      if (!online) throw new TypeError('offline');
      return manifestResponse({ clips: {} });
    });
    expect((await dispatch(MANIFEST_URL))!.status).toBe(200);
    expect(await stores.get(META)!.match(MANIFEST_URL)).toBeDefined();
    online = false;
    const res = (await dispatch(MANIFEST_URL))!;
    expect(await res.text()).toBe('{"clips":{}}');
  });

  it('a stalled network: the cached manifest answers after AUDIO_MANIFEST_NETWORK_TIMEOUT_MS, and the late copy still lands in the cache', async () => {
    let stalled: ((r: Response) => void) | null = null;
    let first = true;
    const { stores, dispatch } = await loadSw(() => {
      if (first) {
        first = false;
        return Promise.resolve(manifestResponse({ generatedAt: 'old', clips: {} }));
      }
      return new Promise<Response>((r) => (stalled = r));
    });
    await dispatch(MANIFEST_URL);
    vi.useFakeTimers();
    const p = dispatch(MANIFEST_URL, {}, { wait: false });
    let answered: Response | undefined;
    void p.then((r) => (answered = r));
    await vi.advanceTimersByTimeAsync(3000 - 100);
    expect(answered).toBeUndefined(); // network first
    await vi.advanceTimersByTimeAsync(200);
    expect(answered).toBeDefined();
    expect(JSON.parse(await answered!.text()).generatedAt).toBe('old');
    stalled!(manifestResponse({ generatedAt: 'new', clips: {} }));
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(await (await stores.get(META)!.match(MANIFEST_URL))!.text()).generatedAt).toBe('new');
  });

  it('a server error on the manifest gets the cached copy; with no cached copy it waits for the network', async () => {
    let status = 200;
    const { dispatch } = await loadSw(async () => (status === 200 ? manifestResponse({ clips: { k: 'k.mp3' } }) : basic(new Response('', { status }))));
    status = 503;
    expect((await dispatch(MANIFEST_URL))!.status).toBe(503); // nothing cached yet: the network's answer
    status = 200;
    await dispatch(MANIFEST_URL);
    status = 503;
    const res = (await dispatch(MANIFEST_URL))!;
    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text()).clips.k).toBe('k.mp3');
  });

  it("the clip cache follows the manifest's generatedAt: regenerated clips under the same key are fetched again", async () => {
    let gen = 'gen1';
    let clipFetches = 0;
    const { dispatch, clipStores, stores } = await loadSw(async (url) => {
      if (url.endsWith('manifest.json')) return manifestResponse({ generatedAt: gen, styleVersion: 3, clips: {} });
      clipFetches++;
      return basic(clipResponse());
    });
    const clip = SCOPE + 'audio/same-key.mp3';
    await dispatch(MANIFEST_URL);
    await dispatch(clip);
    await dispatch(clip);
    expect(clipFetches).toBe(1);
    expect(clipStores().map(([k]) => k)).toEqual([CLIPS_PREFIX + 'gen1']);
    gen = '2026-11-08T10:00:00.000Z';
    await dispatch(MANIFEST_URL);
    expect(clipStores()).toEqual([]); // the older cache is dropped
    await dispatch(clip);
    expect(clipFetches).toBe(2);
    expect(clipStores().map(([k]) => k)).toEqual([CLIPS_PREFIX + '20261108T100000000Z']);
    // the worker restarts (memory lost): it still knows the current clip cache
    expect(await (await stores.get(META)!.match(SCOPE + 'audio/__clip-cache-name'))!.text()).toBe(CLIPS_PREFIX + '20261108T100000000Z');
  });

  it('audioCacheNameFor: generatedAt, else styleVersion / version, sanitized', async () => {
    const { ctx } = await loadSw(async () => new Response(''));
    expect(ctx.audioCacheNameFor({ generatedAt: '2026-11-07T01:02:03Z', styleVersion: 3 })).toBe(CLIPS_PREFIX + '20261107T010203Z');
    expect(ctx.audioCacheNameFor({ styleVersion: 3 })).toBe(CLIPS_PREFIX + '3');
    expect(ctx.audioCacheNameFor({ version: '../x' })).toBe(CLIPS_PREFIX + 'x');
    expect(ctx.audioCacheNameFor(null)).toBe(CLIPS_PREFIX + 'none');
  });

  it('the least recently played clip is dropped first; the manifest never counts', async () => {
    const { ctx, dispatch, clipStores } = await loadSw(async () => basic(clipResponse()));
    const cache = await ctx.currentAudioCache();
    await cache.put(MANIFEST_URL, new Response('{}'));
    for (let i = 0; i < 400; i++) await cache.put(`${SCOPE}audio/c${i}.mp3`, new Response('x'));
    // c0 is played again (from the cache): it becomes the most recent
    expect((await dispatch(`${SCOPE}audio/c0.mp3`))!.status).toBe(200);
    // a new clip is fetched: one has to go, and it is c1, not c0
    await dispatch(`${SCOPE}audio/new.mp3`);
    const keys = [...clipStores()[0][1].map.keys()];
    expect(keys.filter((k) => k.endsWith('.mp3')).length).toBe(400);
    expect(keys).toContain(`${SCOPE}audio/c0.mp3`);
    expect(keys).not.toContain(`${SCOPE}audio/c1.mp3`);
    expect(keys).toContain(`${SCOPE}audio/new.mp3`);
    expect(keys).toContain(MANIFEST_URL);
  });

  it('activate moves the clips and manifest of the old single audio cache into the new caches', async () => {
    const { ctx, stores, activate, clipStores } = await loadSw(async () => new Response(''));
    const legacy = await ctx.caches.open('nghe-noi-am-audio-v1');
    await legacy.put(MANIFEST_URL, new Response(JSON.stringify({ generatedAt: 'g7', clips: {} })));
    await legacy.put(`${SCOPE}audio/a.mp3`, new Response('a'));
    await legacy.put(`${SCOPE}audio/b.mp3`, new Response('b'));
    const old = await ctx.caches.open('nghe-noi-am-v1.3.0');
    await old.put(SCOPE, new Response('shell'));
    await activate();
    expect(stores.has('nghe-noi-am-audio-v1')).toBe(false);
    expect(stores.has('nghe-noi-am-v1.3.0')).toBe(false); // an old deploy's cache
    expect(await stores.get(META)!.match(MANIFEST_URL)).toBeDefined();
    expect(clipStores().map(([k]) => k)).toEqual([CLIPS_PREFIX + 'g7']);
    expect([...clipStores()[0][1].map.keys()]).toEqual([`${SCOPE}audio/a.mp3`, `${SCOPE}audio/b.mp3`]);
  });
});

describe('service worker: build assets and the town pictures', () => {
  const BUILD = { id: 'b2', assets: ['assets/index-N.js', 'assets/town-N.js'], art: ['assets/places-N.webp', 'assets/cafe-N.webp'] };
  const ok = (body: string) => basic(new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } }));
  const shell = () => basic(new Response('<script type="module" src="/assets/index-N.js"></script>', { status: 200, headers: { 'Content-Type': 'text/html' } }));

  it('install precaches the code, not the pictures; a file an older deploy stored is copied, not downloaded', async () => {
    const fetched: string[] = [];
    const { ctx, stores, install } = await loadSw(async (url) => {
      fetched.push(url);
      return url === SCOPE ? shell() : ok(url);
    }, BUILD);
    const older = await ctx.caches.open('nghe-noi-am-v1.4.0-b1');
    await older.put(`${SCOPE}assets/town-N.js`, ok('old copy'));
    await install();
    const cache = [...stores.entries()].find(([k]) => k.endsWith('-b2'))![1];
    const keys = [...cache.map.keys()];
    expect(keys).toContain(`${SCOPE}assets/index-N.js`);
    expect(keys).toContain(`${SCOPE}assets/town-N.js`);
    expect(keys.some((k) => k.endsWith('.webp'))).toBe(false);
    expect(fetched.some((u) => u.endsWith('.webp'))).toBe(false);
    expect(fetched).not.toContain(`${SCOPE}assets/town-N.js`);
    expect(fetched).toContain(`${SCOPE}assets/index-N.js`);
  });

  it('a picture is stored on first use in its own cache, which survives a deploy and keeps only this build’s pictures', async () => {
    let n = 0;
    const { stores, dispatch, activate } = await loadSw(async (url) => {
      n++;
      return ok(url);
    }, BUILD);
    await dispatch(`${SCOPE}assets/places-N.webp`);
    await new Promise((r) => setTimeout(r, 0)); // the copy is stored in the background
    await dispatch(`${SCOPE}assets/places-N.webp`);
    expect(n).toBe(1);
    const art = stores.get('nghe-noi-am-art')!;
    expect([...art.map.keys()]).toEqual([`${SCOPE}assets/places-N.webp`]);
    // a picture of an earlier build, and an older deploy's code cache
    await art.put(`${SCOPE}assets/places-OLD.webp`, ok('old'));
    stores.set('nghe-noi-am-v1.4.0-b1', new MemCache());
    await activate();
    expect(stores.has('nghe-noi-am-art')).toBe(true);
    expect(stores.has('nghe-noi-am-v1.4.0-b1')).toBe(false);
    expect([...art.map.keys()]).toEqual([`${SCOPE}assets/places-N.webp`]);
  });
});
