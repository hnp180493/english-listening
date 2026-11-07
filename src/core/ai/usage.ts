// Per-day local usage counters per provider (device-local, key 'ai-usage'): a small usage line in
// settings and the optional daily soft cap. Counts are this device's view only — the provider's
// console is the source of truth for billing. Several open tabs share the counters through
// localStorage with a read-modify-write, so the soft cap is approximate across tabs.
//
// Maps are null-prototype objects: a provider id like "__proto__" can never reach Object.prototype.

import { AI_USAGE_KEY } from './config';
import { loadDevice, onDeviceStorageChange, saveDevice } from './deviceStorage';

export interface UsageCounters {
  requests: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  ttsChars: number;
  /** TTS served from the local cache (no request made). */
  cacheHits: number;
}

export interface AiUsageStore {
  v: 1;
  /** 'YYYY-MM-DD' (local date) → provider id → counters. */
  days: Record<string, Record<string, UsageCounters>>;
}

const KEEP_DAYS = 30;

export function zeroCounters(): UsageCounters {
  return { requests: 0, errors: 0, inputTokens: 0, outputTokens: 0, ttsChars: 0, cacheHits: 0 };
}

/** Local calendar day, e.g. "2026-11-06". */
export function dayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Object without a prototype (safe for arbitrary string keys). */
function dict<V>(): Record<string, V> {
  return Object.create(null) as Record<string, V>;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function sanitizeUsage(raw: unknown): AiUsageStore {
  const out: AiUsageStore = { v: 1, days: dict() };
  if (!raw || typeof raw !== 'object') return out;
  const days = (raw as { days?: unknown }).days;
  if (!days || typeof days !== 'object') return out;
  for (const [day, perProvider] of Object.entries(days as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !perProvider || typeof perProvider !== 'object') continue;
    const m = dict<UsageCounters>();
    for (const [pid, c] of Object.entries(perProvider as Record<string, unknown>)) {
      const r = (c ?? {}) as Record<string, unknown>;
      m[pid.slice(0, 64)] = {
        requests: num(r.requests),
        errors: num(r.errors),
        inputTokens: num(r.inputTokens),
        outputTokens: num(r.outputTokens),
        ttsChars: num(r.ttsChars),
        cacheHits: num(r.cacheHits),
      };
    }
    out.days[day] = m;
  }
  return out;
}

/** Drops days older than KEEP_DAYS (by sorted key). */
export function pruneUsage(store: AiUsageStore, keep = KEEP_DAYS): AiUsageStore {
  const days = Object.keys(store.days).sort();
  if (days.length <= keep) return store;
  const kept = days.slice(-keep);
  const days2 = dict<Record<string, UsageCounters>>();
  for (const d of kept) days2[d] = store.days[d];
  return { v: 1, days: days2 };
}

const listeners = new Set<() => void>();
let storageUnsub: (() => void) | null = null;

function notifyUsage(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}

export function loadAiUsage(): AiUsageStore {
  return sanitizeUsage(loadDevice<unknown>(AI_USAGE_KEY, null));
}

/** Adds `delta` to today's counters of `providerId`. */
export function recordAiUsage(providerId: string, delta: Partial<UsageCounters>, now: number = Date.now()): void {
  const store = loadAiUsage();
  const day = dayKey(now);
  const pid = providerId.slice(0, 64);
  const perProvider = (store.days[day] ??= dict<UsageCounters>());
  const c = (perProvider[pid] ??= zeroCounters());
  for (const k of Object.keys(zeroCounters()) as (keyof UsageCounters)[]) c[k] += num(delta[k]);
  saveDevice(AI_USAGE_KEY, pruneUsage(store));
  notifyUsage();
}

/** Counters for a day: per provider and summed. */
export function getAiUsage(now: number = Date.now()): { day: string; byProvider: Record<string, UsageCounters>; total: UsageCounters } {
  const day = dayKey(now);
  const byProvider = loadAiUsage().days[day] ?? dict<UsageCounters>();
  const total = zeroCounters();
  for (const c of Object.values(byProvider)) {
    for (const k of Object.keys(total) as (keyof UsageCounters)[]) total[k] += c[k];
  }
  return { day, byProvider, total };
}

/** True when a soft cap is set and today's successful requests reached it. */
export function isOverDailyCap(cap: number | undefined, now: number = Date.now()): boolean {
  if (!cap || cap < 1) return false;
  return getAiUsage(now).total.requests >= cap;
}

/** Same-tab writes and other tabs' writes (storage event) both notify. Returns unsubscribe. */
export function subscribeAiUsage(fn: () => void): () => void {
  storageUnsub ??= onDeviceStorageChange((key) => {
    if (key === AI_USAGE_KEY || key === '*') notifyUsage();
  });
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
