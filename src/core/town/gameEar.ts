// "Trong game: nghe 1 lần là đúng" (docs/progress-report.md §4 "In the game"; docs/gta-plan.md §8 M7): an honest
// number from Westbay's jobs and Rico's dispatch office, kept APART from the dictation's and the real videos'.
//
// A FACT is one thing the learner had to hear and then act on: a notebook entry of a job, a junction of a ride, a
// password, a dispatch call (its pickup and destination together). It is measured (`n`) when it was heard at least
// once in a job or call met for the FIRST time (a job played again, a call heard on another day: its lines were heard
// before, so it is memory, not the ear). It is `ok` when acted on rightly after exactly ONE hearing: no "Xin nhắc
// lại", no replay, no slower play, and the learner's speed at normal (the dictation's rule: NORMAL_RATE_MIN).
// Two rows by voice: the browser's voice (Westbay's people and the new ones) and a town resident's Gemini clip (their
// lines play the browser's voice until the owner has generated the clips: the row says so). These are lines written
// for the game, said by a machine: never real speech.
//
// Stored as the synced key `town-ear`: the ids met (the earlier time wins), and per browser and local day the counts,
// each browser adding only to its own bucket, so copies merge by max (like core/history.ts) and nothing is counted
// twice. A level (`lv`, the difficulty the game set) is kept when the game gives one. Pure; IO in ./gameEarStore.ts.

export const EAR_VERSION = 1;
/** Fewer facts than this: "còn ít, chưa nói được gì" (the dictation's MIN_FIRST_LISTEN_SAMPLE). */
export const MIN_EAR_SAMPLE = 20;

export type EarVoice = 'browser' | 'clip';
export const EAR_VOICES: readonly EarVoice[] = ['browser', 'clip'];

export interface EarCount {
  n: number;
  ok: number;
}

export interface EarDay {
  browser?: EarCount;
  clip?: EarCount;
  /** By the level the game set (when it gives one), both voices together. */
  lv?: Record<string, EarCount>;
}

export interface GameEar {
  version: number;
  /** A job (`job-…`) or a dispatch call (`dc-…`) met for the first time → when (ms). */
  met: Record<string, number>;
  /** browser id → local day (YYYY-MM-DD) → counts. */
  devices: Record<string, Record<string, EarDay>>;
}

/** One fact as the learner met it. */
export interface EarFact {
  voice: EarVoice;
  /** Acted on rightly (the note right, the turn taken, the password typed at once, both places of a call). */
  right: boolean;
  /** Times it was heard: 1 = once; a repeat, a replay or a slower play each add one. 0 = never heard (not measured). */
  plays: number;
}

export const emptyGameEar = (): GameEar => ({ version: EAR_VERSION, met: {}, devices: {} });

const MAX_MET = 2000;
const MAX_DEVICES = 20;
const MAX_DAYS = 3660;
const MAX_COUNT = 1_000_000;
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const own = <T,>(o: Record<string, T>, k: string): T | undefined => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const isMetId = (id: string): boolean => !UNSAFE.has(id) && (/^job-[a-z0-9-]{1,40}$/.test(id) || /^dc-[0-9]{1,4}$/.test(id));
const isDevice = (id: string): boolean => !UNSAFE.has(id) && /^[a-z0-9-]{4,40}$/.test(id);
const isDay = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d);
const isLevel = (k: string): boolean => /^[1-9]$/.test(k);
const time = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(MAX_COUNT, Math.floor(v)) : 0);

function parseCount(raw: unknown): EarCount | null {
  if (!isObj(raw)) return null;
  const n = count(raw.n);
  if (n === 0) return null;
  return { n, ok: Math.min(n, count(raw.ok)) };
}

function parseDay(raw: unknown): EarDay | null {
  if (!isObj(raw)) return null;
  const out: EarDay = {};
  for (const v of EAR_VOICES) {
    const c = parseCount(raw[v]);
    if (c) out[v] = c;
  }
  if (isObj(raw.lv)) {
    const lv: Record<string, EarCount> = {};
    for (const k of Object.keys(raw.lv).filter(isLevel).sort()) {
      const c = parseCount(raw.lv[k]);
      if (c) lv[k] = c;
    }
    if (Object.keys(lv).length > 0) out.lv = lv;
  }
  return out.browser || out.clip || out.lv ? out : null;
}

/** Any stored value read as a store: junk is dropped piece by piece, never a crash. Keys come out sorted. */
export function parseGameEar(raw: unknown): GameEar {
  const out = emptyGameEar();
  if (!isObj(raw)) return out;
  if (isObj(raw.met)) {
    for (const id of Object.keys(raw.met).filter(isMetId).sort().slice(0, MAX_MET)) {
      const t = time(raw.met[id]);
      if (t) out.met[id] = t;
    }
  }
  if (isObj(raw.devices)) {
    for (const dev of Object.keys(raw.devices).filter(isDevice).sort().slice(0, MAX_DEVICES)) {
      const days = raw.devices[dev];
      if (!isObj(days)) continue;
      const bucket: Record<string, EarDay> = {};
      for (const d of Object.keys(days).filter(isDay).sort().slice(-MAX_DAYS)) {
        const day = parseDay(days[d]);
        if (day) bucket[d] = day;
      }
      if (Object.keys(bucket).length > 0) out.devices[dev] = bucket;
    }
  }
  return out;
}

const maxCount = (a?: EarCount, b?: EarCount): EarCount | undefined => {
  if (!a) return b && { ...b };
  if (!b) return { ...a };
  const n = Math.max(a.n, b.n);
  return { n, ok: Math.min(n, Math.max(a.ok, b.ok)) };
};

function maxDay(a: EarDay | undefined, b: EarDay | undefined): EarDay {
  const out: EarDay = {};
  for (const v of EAR_VOICES) {
    const c = maxCount(a?.[v], b?.[v]);
    if (c) out[v] = c;
  }
  const keys = [...new Set([...Object.keys(a?.lv ?? {}), ...Object.keys(b?.lv ?? {})])].sort();
  if (keys.length > 0) out.lv = Object.fromEntries(keys.map((k) => [k, maxCount(a?.lv?.[k], b?.lv?.[k])!]));
  return out;
}

/** Idempotent, commutative and associative: ids by the earlier time, counts by the max per browser, day and field. */
export function mergeGameEar(x: GameEar, y: GameEar): GameEar {
  const out = emptyGameEar();
  out.version = Math.max(EAR_VERSION, x.version, y.version);
  for (const id of [...new Set([...Object.keys(x.met), ...Object.keys(y.met)])].sort().slice(0, MAX_MET)) {
    const a = own(x.met, id) ?? 0;
    const b = own(y.met, id) ?? 0;
    out.met[id] = a && b ? Math.min(a, b) : a || b;
  }
  for (const dev of [...new Set([...Object.keys(x.devices), ...Object.keys(y.devices)])].sort().slice(0, MAX_DEVICES)) {
    const xa = own(x.devices, dev) ?? {};
    const ya = own(y.devices, dev) ?? {};
    const bucket: Record<string, EarDay> = {};
    for (const d of [...new Set([...Object.keys(xa), ...Object.keys(ya)])].sort().slice(-MAX_DAYS)) bucket[d] = maxDay(own(xa, d), own(ya, d));
    out.devices[dev] = bucket;
  }
  return out;
}

/** Heard once and acted on rightly, at the normal speed. */
export const earOk = (f: EarFact, normalSpeed: boolean): boolean => f.right && f.plays === 1 && normalSpeed;

const add = (c: EarCount | undefined, n: number, ok: number): EarCount => ({ n: Math.min(MAX_COUNT, (c?.n ?? 0) + n), ok: Math.min(MAX_COUNT, (c?.ok ?? 0) + ok) });

/**
 * A job or a call is over: its facts go into this browser's bucket for `day`, only when `id` was never met before (on
 * any browser) and `seenBefore` (a job finished before this store existed) is false. Returns the store unchanged and
 * `counted: false` otherwise. A fact never heard (plays 0) is not measured.
 */
export function noteEar(store: GameEar, device: string, day: string, item: { id: string; at: number; facts: readonly EarFact[]; seenBefore?: boolean }, opts: { normalSpeed: boolean; level?: number }): { store: GameEar; counted: boolean } {
  if (!isMetId(item.id) || !isDevice(device) || !isDay(day) || own(store.met, item.id) || item.seenBefore) return { store, counted: false };
  const met = { ...store.met, [item.id]: time(item.at) || 1 };
  const heard = item.facts.filter((f) => f.plays >= 1);
  if (heard.length === 0) return { store: { ...store, met }, counted: true };
  const bucket = { ...(own(store.devices, device) ?? {}) };
  const today: EarDay = { ...(own(bucket, day) ?? {}) };
  for (const v of EAR_VOICES) {
    const mine = heard.filter((f) => f.voice === v);
    if (mine.length > 0) today[v] = add(today[v], mine.length, mine.filter((f) => earOk(f, opts.normalSpeed)).length);
  }
  if (opts.level !== undefined && Number.isInteger(opts.level) && opts.level >= 1 && opts.level <= 9) {
    const k = String(opts.level);
    today.lv = { ...(today.lv ?? {}), [k]: add(today.lv?.[k], heard.length, heard.filter((f) => earOk(f, opts.normalSpeed)).length) };
  }
  bucket[day] = today;
  return { store: { ...store, met, devices: { ...store.devices, [device]: bucket } }, counted: true };
}

export interface EarTotals {
  browser: EarCount;
  clip: EarCount;
}

/** Facts and first-listen rights between two days (inclusive; left out: no bound), summed over the browsers. */
export function earTotals(store: GameEar, fromDay?: string, toDay?: string): EarTotals {
  const out: EarTotals = { browser: { n: 0, ok: 0 }, clip: { n: 0, ok: 0 } };
  for (const days of Object.values(store.devices))
    for (const [d, day] of Object.entries(days)) {
      if ((fromDay && d < fromDay) || (toDay && d > toDay)) continue;
      for (const v of EAR_VOICES) {
        out[v].n += day[v]?.n ?? 0;
        out[v].ok += day[v]?.ok ?? 0;
      }
    }
  return out;
}

/** The share right, in whole percent (null: nothing measured). */
export const earPct = (c: EarCount): number | null => (c.n > 0 ? Math.round((100 * c.ok) / c.n) : null);
