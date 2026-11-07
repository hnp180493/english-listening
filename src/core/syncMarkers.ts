// Two small synced records that make deletes stick across machines (folder sync, core/syncMerge):
//
// - tombstones (KEYS.tombstones): { version: 1, custom: { id: deletedAt }, media: { id: deletedAt } }.
//   A deleted custom sentence ("Câu của tôi") or media item (Video thật) leaves its id here, so the union merge
//   does not bring it back from a machine that still has it. A record changed after the delete (its own
//   updatedAt / createdAt / openedAt is later) survives. Tombstones older than TOMBSTONE_TTL_DAYS are pruned:
//   a machine offline for longer could bring a deleted item back (same rule as the listening log).
//
// - reset marker (KEYS.reset): { version: 1, all: at, keys: { shortKey: at } }. "Xóa dữ liệu" and a restore
//   from a backup set `all`; "Xóa lịch sử luyện tập" sets keys.stats. When two copies are merged, a value whose
//   side has seen an older reset for that key is dropped instead of being united with the newer side.
//
// Pure helpers plus two tiny storage writers. Dates are epoch ms.

import { KEYS, loadJSON, saveJSON } from './storage';

export const TOMBSTONE_TTL_DAYS = 180;
const DAY_MS = 86_400_000;
export const TOMBSTONE_TTL_MS = TOMBSTONE_TTL_DAYS * DAY_MS;
/** Cap per kind (a genuine library never gets near it). */
const MAX_TOMBSTONES = 2000;
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

export type TombKind = 'custom' | 'media';
const KINDS: readonly TombKind[] = ['custom', 'media'];

export interface Tombstones {
  version: 1;
  custom: Record<string, number>;
  media: Record<string, number>;
}

export interface ResetMarker {
  version: 1;
  /** Last "Xóa dữ liệu" / restore; 0 = never. */
  all: number;
  /** Per short key (e.g. "stats" after "Xóa lịch sử luyện tập"). */
  keys: Record<string, number>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const stamp = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

function stampMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, at] of Object.entries(v)) {
    if (UNSAFE.has(k) || k === '' || k.length > 200) continue;
    const t = stamp(at);
    if (t > 0) out[k] = t;
  }
  return out;
}

/** Sorted copy (stable JSON, so equal content gives equal text). */
function sortedMap(m: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(m).sort()) out[k] = m[k];
  return out;
}

// ───────────────────────── tombstones ─────────────────────────

export function emptyTombstones(): Tombstones {
  return { version: 1, custom: {}, media: {} };
}

export function parseTombstones(v: unknown): Tombstones {
  const o = isObj(v) ? v : {};
  return { version: 1, custom: stampMap(o.custom), media: stampMap(o.media) };
}

/** Newest deletion time in the record (0 when empty). */
function newestTomb(t: Tombstones): number {
  let m = 0;
  for (const kind of KINDS) for (const at of Object.values(t[kind])) if (at > m) m = at;
  return m;
}

/** Drop tombstones older than `cutoff`, and the oldest beyond the cap. */
export function pruneTombstones(t: Tombstones, cutoff: number): Tombstones {
  const out = emptyTombstones();
  for (const kind of KINDS) {
    const kept = Object.entries(t[kind]).filter(([, at]) => at >= cutoff);
    kept.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    out[kind] = sortedMap(Object.fromEntries(kept.slice(0, MAX_TOMBSTONES)));
  }
  return out;
}

/**
 * Union per id, the later deletion time wins; then tombstones older than TTL before the newest one are pruned
 * (relative to the data, not the clock, so the merge stays commutative, idempotent and associative).
 */
export function mergeTombstones(a: unknown, b: unknown): Tombstones {
  const x = parseTombstones(a);
  const y = parseTombstones(b);
  const out = emptyTombstones();
  for (const kind of KINDS) {
    const m: Record<string, number> = { ...x[kind] };
    for (const [id, at] of Object.entries(y[kind])) m[id] = Math.max(m[id] ?? 0, at);
    out[kind] = m;
  }
  return pruneTombstones(out, newestTomb(out) - TOMBSTONE_TTL_MS);
}

/** Deletion time of `id`, 0 when it was never deleted. */
export function tombstoneAt(t: Tombstones, kind: TombKind, id: string): number {
  return Object.prototype.hasOwnProperty.call(t[kind], id) ? t[kind][id] : 0;
}

/**
 * Remember that this browser deleted `id` (call next to the delete itself). Old tombstones are pruned against the
 * clock here. Returns false when storage refused the write.
 */
export function recordTombstone(kind: TombKind, id: string, now: number = Date.now()): boolean {
  if (typeof id !== 'string' || id === '' || UNSAFE.has(id)) return false;
  const t = parseTombstones(loadJSON<unknown>(KEYS.tombstones, null));
  t[kind] = { ...t[kind], [id]: Math.max(now, tombstoneAt(t, kind, id)) };
  return saveJSON(KEYS.tombstones, pruneTombstones(t, now - TOMBSTONE_TTL_MS));
}

// ───────────────────────── reset marker ─────────────────────────

export function emptyReset(): ResetMarker {
  return { version: 1, all: 0, keys: {} };
}

export function parseReset(v: unknown): ResetMarker {
  const o = isObj(v) ? v : {};
  return { version: 1, all: stamp(o.all), keys: sortedMap(stampMap(o.keys)) };
}

/** Max per field: commutative, idempotent, associative. */
export function mergeReset(a: unknown, b: unknown): ResetMarker {
  const x = parseReset(a);
  const y = parseReset(b);
  const keys: Record<string, number> = { ...x.keys };
  for (const [k, at] of Object.entries(y.keys)) keys[k] = Math.max(keys[k] ?? 0, at);
  return { version: 1, all: Math.max(x.all, y.all), keys: sortedMap(keys) };
}

/** Time of the latest reset that covers `shortKey` (0 = never reset). */
export function resetTimeFor(m: ResetMarker, shortKey: string): number {
  const k = Object.prototype.hasOwnProperty.call(m.keys, shortKey) ? m.keys[shortKey] : 0;
  return Math.max(m.all, k);
}

/**
 * The marker after a reset at `now`: of everything (`keys` omitted) or of some short keys. The new time is strictly
 * after every reset already known, so it wins even when this machine's clock is behind.
 */
export function withReset(prev: ResetMarker, now: number, keys?: readonly string[]): ResetMarker {
  if (!keys) {
    const newest = Math.max(prev.all, ...Object.values(prev.keys));
    return { version: 1, all: Math.max(now, newest + 1), keys: {} };
  }
  const next: Record<string, number> = { ...prev.keys };
  for (const k of keys) next[k] = Math.max(now, resetTimeFor(prev, k) + 1);
  return { version: 1, all: prev.all, keys: sortedMap(next) };
}

/** Record a reset of some short keys in this browser's storage (e.g. "Xóa lịch sử luyện tập" → ['stats']). */
export function recordKeyReset(keys: readonly string[], now: number = Date.now()): boolean {
  const prev = parseReset(loadJSON<unknown>(KEYS.reset, null));
  return saveJSON(KEYS.reset, withReset(prev, now, keys));
}
