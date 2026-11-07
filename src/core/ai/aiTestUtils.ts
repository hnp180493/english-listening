// Test helpers for the AI layer (imported only by *.test.ts; never by app code).

import { vi } from 'vitest';

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
  init: RequestInit;
}

export type Responder = (call: FetchCall, index: number) => Response | Error | Promise<Response | Error>;

/** Stubs global fetch; every call is recorded (headers lower-cased, JSON body parsed). */
export function mockFetch(responder: Responder): FetchCall[] {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    let body: unknown = init.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // keep string
      }
    }
    const call: FetchCall = { url: String(input), method: init.method ?? 'GET', headers, body, signal: init.signal ?? undefined, init };
    calls.push(call);
    const r = await responder(call, calls.length - 1);
    if (r instanceof Error) throw r;
    return r;
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

/** Responds with a sequence (last one repeats). */
export function sequence(...items: (Response | Error | (() => Response | Error))[]): Responder {
  return (_c, i) => {
    const it = items[Math.min(i, items.length - 1)];
    return typeof it === 'function' ? it() : it instanceof Response ? it.clone() : it;
  };
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** A fetch that never answers but rejects when its signal aborts (like a real fetch). */
export function hang(call: FetchCall): Promise<Response | Error> {
  return new Promise((_resolve, reject) => {
    const s = call.signal;
    if (!s) return;
    const fail = () => reject(s.reason instanceof Error ? s.reason : Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (s.aborted) fail();
    else s.addEventListener('abort', fail, { once: true });
  });
}

/** Stubs window.localStorage and window.sessionStorage (+ storage events). */
export function stubStorage(): { map: Map<string, string>; session: Map<string, string>; fire: (key: string | null) => void } {
  const map = new Map<string, string>();
  const session = new Map<string, string>();
  const handlers: ((e: { key: string | null }) => void)[] = [];
  const store = (m: Map<string, string>) => ({
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.stubGlobal('window', {
    localStorage: store(map),
    sessionStorage: store(session),
    addEventListener: (type: string, fn: (e: { key: string | null }) => void) => {
      if (type === 'storage') handlers.push(fn);
    },
    removeEventListener: () => {},
  });
  return { map, session, fire: (key) => handlers.forEach((fn) => fn({ key })) };
}

export const GEMINI_KEY = 'AIzaSyD-TESTKEY-0123456789abcdefghijk3Fq';
export const OPENAI_KEY = 'sk-proj-TESTKEY0123456789abcdefghijklmnop';
export const ANTHROPIC_KEY = 'sk-ant-api03-TESTKEY0123456789abcdefghijkl';
export const OPENROUTER_KEY = 'sk-or-v1-TESTKEY0123456789abcdefghijklmnop';
