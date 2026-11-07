import { describe, expect, it } from 'vitest';

// public/sw.js is a classic worker script, not a module: it is evaluated here in a sandbox with a stub `self`
// and `caches`, and its top-level functions are read from the sandbox.
/* eslint-disable @typescript-eslint/no-explicit-any */
const nodeModule = (name: string): Promise<any> => import(/* @vite-ignore */ name);
const { readFile } = await nodeModule('node:fs/promises');
const vm = await nodeModule('node:vm');

const SCOPE = 'https://app.example/';

class MemCache {
  map = new Map<string, Response>();
  async match(url: string): Promise<Response | undefined> {
    const r = this.map.get(url);
    return r ? r.clone() : undefined;
  }
  async put(url: string, res: Response): Promise<void> {
    this.map.set(url, res);
  }
  async keys(): Promise<{ url: string }[]> {
    return [...this.map.keys()].map((url) => ({ url }));
  }
  async delete(r: { url: string }): Promise<boolean> {
    return this.map.delete(r.url);
  }
}

async function loadSw(fetchImpl: (url: string) => Promise<Response>) {
  const src: string = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
  const stores = new Map<string, MemCache>();
  const handlers: Record<string, (e: any) => void> = {};
  const ctx: any = {
    self: { registration: { scope: SCOPE }, location: { origin: new URL(SCOPE).origin }, addEventListener: (t: string, fn: any) => (handlers[t] = fn) },
    caches: {
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new MemCache());
        return stores.get(name);
      },
    },
    fetch: (input: any) => fetchImpl(typeof input === 'string' ? input : input.url),
    URL,
    Response,
    Headers,
    Blob,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  /** Runs the worker's fetch handler for a GET; resolves with what it answered (undefined = not handled). */
  const dispatch = async (url: string, headers: Record<string, string> = {}): Promise<Response | undefined> => {
    let answer: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    handlers.fetch({
      request: { url, method: 'GET', mode: 'no-cors', headers: new Headers(headers) },
      respondWith: (p: Promise<Response>) => (answer = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const res = answer ? await answer : undefined;
    await Promise.all(waits);
    return res;
  };
  return { ctx, stores, dispatch };
}

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i % 251);
const clipResponse = () => new Response(bytes(1000), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
// Node's fetch Response has type 'default'; the worker stores only same-origin ('basic') answers.
const basic = (r: Response) => Object.defineProperty(r, 'type', { value: 'basic' });

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
    const { stores, dispatch } = await loadSw(async (url) => {
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
    const stored = await stores.get('nghe-noi-am-audio-v1')!.match(url);
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

  it('keeps audio/manifest.json in the audio cache (survives deploys) and serves it offline', async () => {
    let online = true;
    const { stores, dispatch } = await loadSw(async () => {
      if (!online) throw new TypeError('offline');
      return basic(new Response('{"clips":{}}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    const url = SCOPE + 'audio/manifest.json';
    expect((await dispatch(url))!.status).toBe(200);
    expect(await stores.get('nghe-noi-am-audio-v1')!.match(url)).toBeDefined();
    online = false;
    const res = (await dispatch(url))!;
    expect(await res.text()).toBe('{"clips":{}}');
  });

  it('the manifest never counts toward the clip limit', async () => {
    const { ctx, stores } = await loadSw(async () => new Response(''));
    const cache = await ctx.caches.open('nghe-noi-am-audio-v1');
    await cache.put(SCOPE + 'audio/manifest.json', new Response('{}'));
    for (let i = 0; i < 402; i++) await cache.put(`${SCOPE}audio/c${i}.mp3`, new Response('x'));
    await ctx.trimAudio(cache);
    const keys = [...stores.get('nghe-noi-am-audio-v1')!.map.keys()];
    expect(keys).toContain(SCOPE + 'audio/manifest.json');
    expect(keys.filter((k) => k.endsWith('.mp3')).length).toBe(400);
    expect(keys).not.toContain(SCOPE + 'audio/c0.mp3');
  });
});
