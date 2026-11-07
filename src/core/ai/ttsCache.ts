// Cache of generated speech so the same sentence is never paid for twice.
// IndexedDB (LRU, size-capped) with a graceful in-memory fallback when IndexedDB is missing or
// fails (some file:// setups, private mode). Pure helpers (key hashing, eviction plan) are
// exported for node tests; the IndexedDB wrapper is kept thin.

export interface TtsCacheKeyParts {
  kind: string;
  model: string;
  voice: string;
  style: string;
  text: string;
}

export interface TtsCacheEntryMeta {
  key: string;
  size: number;
  lastUsed: number;
}

export interface CachedAudio {
  audio: Blob;
  mime: string;
}

export interface TtsCache {
  readonly backend: 'indexeddb' | 'memory';
  get(key: string, fullKey: string): Promise<CachedAudio | undefined>;
  put(key: string, fullKey: string, value: CachedAudio): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<{ entries: number; bytes: number; backend: 'indexeddb' | 'memory' }>;
}

export const TTS_CACHE_MAX_BYTES = 50 * 1024 * 1024;
export const TTS_MEMORY_CACHE_MAX_BYTES = 8 * 1024 * 1024;

/** The exact identity of a clip (stored next to the audio to rule out hash collisions). */
export function ttsFullKey(p: TtsCacheKeyParts): string {
  return JSON.stringify([p.kind, p.model.trim(), p.voice.trim(), p.style.trim(), p.text.trim().replace(/\s+/g, ' ')]);
}

/** 64-bit hash (cyrb53-style, two 32-bit lanes) as 16 hex chars. Not cryptographic; collisions are checked via fullKey. */
export function hashString(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function ttsCacheKey(p: TtsCacheKeyParts): { key: string; fullKey: string } {
  const fullKey = ttsFullKey(p);
  return { key: 'tts-' + hashString(fullKey), fullKey };
}

/**
 * Which entries to evict (least recently used first) so `incoming` bytes fit under `capBytes`.
 * `store: false` when the clip alone is larger than the cap (then nothing is evicted).
 * An entry with the same key as the incoming one is replaced, so it does not count.
 */
export function planEviction(entries: TtsCacheEntryMeta[], capBytes: number, incoming: { key: string; size: number }): { evict: string[]; store: boolean } {
  if (incoming.size > capBytes) return { evict: [], store: false };
  const others = entries.filter((e) => e.key !== incoming.key);
  let total = others.reduce((n, e) => n + e.size, 0) + incoming.size;
  const evict: string[] = [];
  for (const e of [...others].sort((a, b) => a.lastUsed - b.lastUsed || a.key.localeCompare(b.key))) {
    if (total <= capBytes) break;
    evict.push(e.key);
    total -= e.size;
  }
  return { evict, store: true };
}

interface MemEntry extends TtsCacheEntryMeta {
  fullKey: string;
  value: CachedAudio;
}

export function createMemoryTtsCache(capBytes = TTS_MEMORY_CACHE_MAX_BYTES, now: () => number = Date.now): TtsCache {
  const map = new Map<string, MemEntry>();
  return {
    backend: 'memory',
    async get(key, fullKey) {
      const e = map.get(key);
      if (!e || e.fullKey !== fullKey) return undefined;
      e.lastUsed = now();
      return e.value;
    },
    async put(key, fullKey, value) {
      const size = value.audio.size;
      const plan = planEviction([...map.values()], capBytes, { key, size });
      if (!plan.store) return;
      for (const k of plan.evict) map.delete(k);
      map.set(key, { key, fullKey, size, lastUsed: now(), value });
    },
    async clear() {
      map.clear();
    },
    async stats() {
      let bytes = 0;
      for (const e of map.values()) bytes += e.size;
      return { entries: map.size, bytes, backend: 'memory' as const };
    },
  };
}

// ---- IndexedDB (thin) ----

const DB_NAME = 'nghe-noi-am-ai';
const STORE = 'tts';

interface IdbRecord extends TtsCacheEntryMeta {
  fullKey: string;
  mime: string;
  audio: Blob;
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = idb.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

/**
 * IndexedDB-backed cache; any IndexedDB failure (unavailable, SecurityError on file://, quota)
 * switches this instance to the in-memory cache for the rest of the session.
 */
export function createTtsCache(capBytes = TTS_CACHE_MAX_BYTES, now: () => number = Date.now): TtsCache {
  const memory = createMemoryTtsCache(Math.min(capBytes, TTS_MEMORY_CACHE_MAX_BYTES), now);
  let idb: IDBFactory | undefined;
  try {
    // The getter itself throws SecurityError in sandboxed / opaque-origin documents.
    idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  } catch {
    idb = undefined;
  }
  if (!idb) return memory;
  const factory = idb;
  let dbP: Promise<IDBDatabase> | null = null;
  let failed = false;
  const db = () => (dbP ??= openDb(factory));

  async function guard<T>(fn: (d: IDBDatabase) => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (failed) return fallback();
    try {
      return await fn(await db());
    } catch {
      failed = true;
      return fallback();
    }
  }

  const cache: TtsCache = {
    get backend() {
      return failed ? ('memory' as const) : ('indexeddb' as const);
    },
    get: (key, fullKey) =>
      guard(
        async (d) => {
          const rec = (await reqP(d.transaction(STORE, 'readonly').objectStore(STORE).get(key))) as IdbRecord | undefined;
          if (!rec || rec.fullKey !== fullKey || !(rec.audio instanceof Blob)) return undefined;
          // Touch for LRU; best effort.
          try {
            const tx = d.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ ...rec, lastUsed: now() });
            await txDone(tx);
          } catch {
            // ignore
          }
          return { audio: rec.audio, mime: rec.mime };
        },
        () => memory.get(key, fullKey),
      ),
    put: (key, fullKey, value) =>
      guard(
        async (d) => {
          const metas: TtsCacheEntryMeta[] = [];
          const read = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
          await new Promise<void>((resolve, reject) => {
            read.onsuccess = () => {
              const c = read.result;
              if (!c) return resolve();
              const r = c.value as IdbRecord;
              metas.push({ key: r.key, size: r.size, lastUsed: r.lastUsed });
              c.continue();
            };
            read.onerror = () => reject(read.error);
          });
          const size = value.audio.size;
          const plan = planEviction(metas, capBytes, { key, size });
          if (!plan.store) return;
          const tx = d.transaction(STORE, 'readwrite');
          const st = tx.objectStore(STORE);
          for (const k of plan.evict) st.delete(k);
          const rec: IdbRecord = { key, fullKey, size, lastUsed: now(), mime: value.mime, audio: value.audio };
          st.put(rec);
          await txDone(tx);
        },
        () => memory.put(key, fullKey, value),
      ),
    clear: async () => {
      await memory.clear();
      await guard(
        async (d) => {
          const tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).clear();
          await txDone(tx);
        },
        async () => undefined,
      );
    },
    stats: () =>
      guard(
        async (d) => {
          const all = (await reqP(d.transaction(STORE, 'readonly').objectStore(STORE).getAll())) as IdbRecord[];
          return { entries: all.length, bytes: all.reduce((n, r) => n + (r.size || 0), 0), backend: 'indexeddb' as const };
        },
        () => memory.stats(),
      ),
  };
  return cache;
}
