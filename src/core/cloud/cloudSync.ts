// Account sync ("Tài khoản Google", Supabase): one cycle that brings this browser's data and the learner's rows in the
// `nna_sync` table in step. Pure apart from the injected store and storage, so it runs in node tests
// (cloudSync.test.ts). Browser glue (session, timers, page lifecycle) is in cloudController.ts; the table and its
// compare-and-swap write function are in daily-english/supabase-migrations/18-create-nghe-noi-am-sync.sql.
//
// Model: one row per synced storage key (raw JSON text) with a revision number from a global sequence. This browser
// remembers, per key, the revision and a hash of the value it last synced (its "base"). Then, per key:
//   remote rev = base rev  → nobody else wrote it: this browser's value stands (a local delete deletes the row);
//   remote rev ≠ base rev  → someone wrote it: unchanged here → take theirs; changed here too → merge both;
//   row gone, base known   → deleted elsewhere: unchanged here → delete here; changed here → keep and write back.
// The two sides then go through `mergeData` (core/syncMerge.ts), the same mergers, reset markers and tombstones as
// folder sync, so "Xóa dữ liệu", restore and "Xóa lịch sử" elsewhere drop older data here instead of merging it back.
// The result is written back with compare-and-swap on the revisions read: if anyone wrote in between, nothing is
// written and the cycle starts over. Nothing is ever overwritten blindly.

import { exportBackup, sanitizeSettingsJSON, validateBackup, type StorageLike } from '../backup';
import { dataHash } from '../folderSync';
import { isDeviceLocalKey, KEYS, STORAGE_PREFIX } from '../storage';
import { mergeData, type DataMap } from '../syncMerge';
import { CloudError, ROW_KEY_PATTERN, type Change, type CloudStore, type Row, type RowHead } from './remote';

export interface BaseEntry {
  rev: number;
  hash: string;
}

/** This browser's bookkeeping for the account it is signed in with (device-local, never synced). */
export interface CloudMeta {
  /** The account the base belongs to; another account (or none) means a first connection. */
  userId: string | null;
  base: Record<string, BaseEntry>;
  lastSyncAt: number | null;
  /** Local clock time of the last local change (decides only keys without a merger). */
  localChangedAt: number;
  /** A local change not yet written (for the status line; the cycle itself compares hashes). */
  dirty: boolean;
}

export function emptyCloudMeta(): CloudMeta {
  return { userId: null, base: {}, lastSyncAt: null, localChangedAt: 0, dirty: false };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseCloudMeta(raw: string | null): CloudMeta {
  let v: unknown = null;
  try {
    v = raw == null ? null : JSON.parse(raw);
  } catch {
    v = null;
  }
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const base: Record<string, BaseEntry> = {};
  if (o.base && typeof o.base === 'object' && !Array.isArray(o.base)) {
    for (const [k, e] of Object.entries(o.base as Record<string, unknown>)) {
      if (!ROW_KEY_PATTERN.test(k) || !e || typeof e !== 'object') continue;
      const { rev, hash } = e as Record<string, unknown>;
      if (finite(rev) && typeof hash === 'string' && hash.length <= 64) base[k] = { rev, hash };
    }
  }
  return {
    userId: typeof o.userId === 'string' && o.userId.length <= 64 ? o.userId : null,
    base,
    lastSyncAt: finite(o.lastSyncAt) ? o.lastSyncAt : null,
    localChangedAt: finite(o.localChangedAt) ? o.localChangedAt : 0,
    dirty: o.dirty === true,
  };
}

export interface CloudMetaStore {
  load(): CloudMeta;
  save(meta: CloudMeta): void;
}

export interface CloudContext {
  storage: StorageLike;
  meta: CloudMetaStore;
  store: CloudStore;
  userId: string;
  /** "Edge · Windows" (written next to each row, for the learner's eyes only) */
  device: string;
  now(): number;
  /** Counter bumped on every local app write (a write during the cycle keeps `dirty`). */
  changeCount(): number;
}

export interface CloudCycleOptions {
  /** May this browser's data change right now? (before the first render, or after the learner asked) */
  canApply: () => boolean;
}

export type CloudErrorKind = CloudError['kind'] | 'quota' | 'busy' | 'apply';

export type CloudResult =
  | { kind: 'noop' }
  | { kind: 'pushed'; keys: number }
  | {
      kind: 'applied';
      /** this browser's synced data before the cycle changed it */
      previous: DataMap;
      pushedKeys: number;
      /** applied here, but writing to the account failed (the rest goes out next time) */
      writeError?: string;
    }
  | { kind: 'remote-newer' }
  | { kind: 'error'; error: CloudErrorKind; message: string };

/** Fingerprint of one stored value. */
export function valueHash(raw: string): string {
  return dataHash({ v: raw });
}

const RESET_SHORT = KEYS.reset;
const MAX_VALUE = 5_000_000;
const MAX_ATTEMPTS = 3;

/** A synced short key of this app (and a valid row key). */
export function isSyncedShortKey(k: string): boolean {
  return ROW_KEY_PATTERN.test(k) && !isDeviceLocalKey(k);
}

/** A remote value as this browser would accept it from a backup; null when it must be ignored. */
export function cleanRemoteValue(shortKey: string, value: string): string | null {
  if (!isSyncedShortKey(shortKey) || typeof value !== 'string' || value.length > MAX_VALUE) return null;
  try {
    JSON.parse(value);
  } catch {
    return null;
  }
  if (shortKey === KEYS.settings) return sanitizeSettingsJSON(value);
  return value;
}

function localShortMap(storage: StorageLike, now: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(exportBackup(storage, now).data)) {
    const short = k.slice(STORAGE_PREFIX.length);
    if (isSyncedShortKey(short)) out[short] = v;
  }
  return out;
}

const full = (short: string) => STORAGE_PREFIX + short;

/** Write `next` (full keys) over this browser's synced data; on a failed write the previous data is put back. */
function applyLocal(storage: StorageLike, before: DataMap, next: DataMap): void {
  const done: string[] = [];
  try {
    for (const k of Object.keys(before)) {
      if (!(k in next)) {
        storage.removeItem(k);
        done.push(k);
      }
    }
    for (const [k, v] of Object.entries(next)) {
      if (before[k] !== v) {
        storage.setItem(k, v);
        done.push(k);
      }
    }
  } catch (e) {
    for (const k of done) {
      try {
        if (k in before) storage.setItem(k, before[k]);
        else storage.removeItem(k);
      } catch {
        // best effort
      }
    }
    throw e;
  }
}

function sameMap(a: DataMap, b: DataMap): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k]);
}

interface Plan {
  /** merged data, full keys */
  merged: DataMap;
  changes: Change[];
  /** keys skipped this cycle (remote value unreadable): base kept as it was */
  skipped: Set<string>;
}

/**
 * The decision for one snapshot of both sides (pure). `rows`: every remote row's head; `values`: the fetched values of
 * the rows whose rev differs from the base.
 */
export function planCycle(
  local: Record<string, string>,
  rows: RowHead[],
  values: Map<string, Row>,
  meta: CloudMeta,
  userId: string,
): Plan {
  const first = meta.userId !== userId;
  const base = first ? {} : meta.base;
  const remote = new Map(rows.map((r) => [r.key, r]));
  const localMap: DataMap = {};
  const remoteMap: DataMap = {};
  const skipped = new Set<string>();
  let newestRemote = 0;

  const keys = new Set([...Object.keys(local), ...remote.keys(), ...Object.keys(base)]);
  for (const k of keys) {
    if (!isSyncedShortKey(k)) continue;
    const L = Object.prototype.hasOwnProperty.call(local, k) ? local[k] : undefined;
    const row = remote.get(k);
    const b = Object.prototype.hasOwnProperty.call(base, k) ? base[k] : undefined;
    const localUnchanged = b ? L !== undefined && valueHash(L) === b.hash : L === undefined;

    if (row && b && row.rev === b.rev) {
      // nobody else wrote it: this browser's value (or its delete) stands
      if (L !== undefined) localMap[full(k)] = L;
      continue;
    }
    if (row) {
      const fetched = values.get(k);
      const R = fetched ? cleanRemoteValue(k, fetched.value) : null;
      if (R === null) {
        // unreadable (or vanished between list and fetch): leave the key alone this cycle
        skipped.add(k);
        if (L !== undefined) localMap[full(k)] = L;
        continue;
      }
      newestRemote = Math.max(newestRemote, fetched?.updatedAt ?? 0);
      remoteMap[full(k)] = R;
      // Unchanged here: take theirs as is. The reset marker always keeps this browser's own value, so a reset made
      // elsewhere is seen as newer than this browser's data (mergeData then drops what it clears).
      if (localUnchanged && k !== RESET_SHORT) localMap[full(k)] = R;
      else if (L !== undefined) localMap[full(k)] = L;
      continue;
    }
    // no row: deleted elsewhere (if this browser had synced it) or never written
    if (b && localUnchanged) continue;
    if (L !== undefined) localMap[full(k)] = L;
  }

  const remoteNewer = newestRemote > meta.localChangedAt;
  let merged = mergeData(localMap, remoteMap, remoteNewer, { honorReset: !first });
  // Like an import: settings sanitised, broken values refused.
  const check = validateBackup({ app: 'nghe-noi-am', version: 1, exportedAt: '', data: merged }, { allowEmpty: true });
  if (check.ok) merged = check.backup.data;

  const changes: Change[] = [];
  const mergedShort = new Map<string, string>();
  for (const [k, v] of Object.entries(merged)) mergedShort.set(k.slice(STORAGE_PREFIX.length), v);
  const all = new Set([...mergedShort.keys(), ...remote.keys()]);
  for (const k of [...all].sort()) {
    if (!isSyncedShortKey(k) || skipped.has(k)) continue;
    const m = mergedShort.get(k);
    const row = remote.get(k);
    if (m !== undefined) {
      if (!row) {
        changes.push({ key: k, value: m, base: null });
        continue;
      }
      const fetched = values.get(k);
      const b = Object.prototype.hasOwnProperty.call(base, k) ? base[k] : undefined;
      const same = fetched ? fetched.value === m : !!b && b.rev === row.rev && b.hash === valueHash(m);
      if (!same) changes.push({ key: k, value: m, base: row.rev });
    } else if (row) {
      changes.push({ key: k, value: null, base: row.rev });
    }
  }
  return { merged, changes, skipped };
}

function errorOf(e: unknown): Extract<CloudResult, { kind: 'error' }> {
  if (e instanceof CloudError) return { kind: 'error', error: e.kind, message: e.message };
  return { kind: 'error', error: 'server', message: 'Đồng bộ tài khoản gặp lỗi không mong muốn. Sẽ thử lại sau.' };
}

/**
 * One cycle: read the rows, decide, apply here (only if `canApply()`), write there with compare-and-swap. Retries
 * from the start when another device wrote in between. Never replaces local data it may not replace: then it writes
 * nothing either and returns 'remote-newer' (the page offers a reload).
 */
export async function runCloudCycle(ctx: CloudContext, opts: CloudCycleOptions): Promise<CloudResult> {
  let lastError: Extract<CloudResult, { kind: 'error' }> | null = null;
  let applied: DataMap | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const meta = ctx.meta.load();
    const gen = ctx.changeCount();
    let rows: RowHead[];
    let values: Map<string, Row>;
    try {
      rows = await ctx.store.list();
      const first = meta.userId !== ctx.userId;
      const need = rows.filter((r) => first || meta.base[r.key]?.rev !== r.rev).map((r) => r.key);
      values = new Map((need.length ? await ctx.store.fetch(need) : []).map((r) => [r.key, r]));
    } catch (e) {
      return errorOf(e);
    }

    const before = exportBackup(ctx.storage, ctx.now()).data;
    const local = localShortMap(ctx.storage, ctx.now());
    const plan = planCycle(local, rows, values, meta, ctx.userId);
    const localChanged = !sameMap(before, plan.merged);
    if (localChanged && !opts.canApply()) return { kind: 'remote-newer' };
    if (localChanged) {
      try {
        applyLocal(ctx.storage, before, plan.merged);
      } catch {
        return { kind: 'error', error: 'apply', message: 'Bộ nhớ trình duyệt đã đầy, không gộp được dữ liệu từ tài khoản.' };
      }
      if (!applied) applied = before;
    }

    let revs: Record<string, number> = {};
    if (plan.changes.length) {
      let res;
      try {
        res = await ctx.store.write(plan.changes, ctx.device);
      } catch (e) {
        const err = errorOf(e);
        // what was applied here stays; the unwritten keys differ from their base and go out next time
        saveBase(ctx, meta, rows, plan, {}, gen, false);
        return applied ? { kind: 'applied', previous: applied, pushedKeys: 0, writeError: err.message } : err;
      }
      if (!res.ok && res.error === 'quota') {
        saveBase(ctx, meta, rows, plan, {}, gen, false);
        const message = 'Dữ liệu trên tài khoản đã quá giới hạn cho phép (25 MB), chưa ghi được.';
        if (applied) return { kind: 'applied', previous: applied, pushedKeys: 0, writeError: message };
        return { kind: 'error', error: 'quota', message };
      }
      if (!res.ok) {
        // another device wrote in between: read again and merge again
        saveBase(ctx, meta, rows, plan, {}, gen, false);
        lastError = { kind: 'error', error: 'busy', message: 'Một máy khác đang ghi dữ liệu cùng lúc. Sẽ thử lại sau.' };
        continue;
      }
      revs = res.revs;
    }
    saveBase(ctx, meta, rows, plan, revs, gen, true);
    if (applied) return { kind: 'applied', previous: applied, pushedKeys: plan.changes.length };
    return plan.changes.length ? { kind: 'pushed', keys: plan.changes.length } : { kind: 'noop' };
  }
  const busy = lastError ?? { kind: 'error', error: 'busy', message: 'Một máy khác đang ghi dữ liệu cùng lúc. Sẽ thử lại sau.' };
  if (applied) return { kind: 'applied', previous: applied, pushedKeys: 0, writeError: busy.message };
  return busy;
}

/**
 * Record what is now known to be in step. `written`: true when the plan's changes were all written (`revs` holds
 * their new revisions); false when nothing was written (only keys taken from the remote side are in step then).
 */
function saveBase(ctx: CloudContext, before: CloudMeta, rows: RowHead[], plan: Plan, revs: Record<string, number>, gen: number, written: boolean): void {
  const first = before.userId !== ctx.userId;
  const oldBase = first ? {} : before.base;
  const remote = new Map(rows.map((r) => [r.key, r]));
  const changed = new Set(plan.changes.map((c) => c.key));
  const base: Record<string, BaseEntry> = {};
  for (const [fk, v] of Object.entries(plan.merged)) {
    const k = fk.slice(STORAGE_PREFIX.length);
    if (!isSyncedShortKey(k)) continue;
    if (plan.skipped.has(k)) {
      if (oldBase[k]) base[k] = oldBase[k];
      continue;
    }
    if (changed.has(k)) {
      if (written && finite(revs[k])) base[k] = { rev: revs[k], hash: valueHash(v) };
      else if (oldBase[k]) base[k] = oldBase[k]; // still to be written: compared against the old base next time
      continue;
    }
    const row = remote.get(k);
    if (row) base[k] = { rev: row.rev, hash: valueHash(v) };
  }
  // keys skipped with no local value keep their base too
  for (const k of plan.skipped) if (!base[k] && oldBase[k]) base[k] = oldBase[k];
  // a delete not yet written: keep the old base, so the next cycle still sees "deleted here"
  if (!written) for (const c of plan.changes) if (c.value === null && oldBase[c.key]) base[c.key] = oldBase[c.key];
  const m = ctx.meta.load();
  ctx.meta.save({
    // a first connection that could not write stays a first connection (merged again, resets not honoured yet)
    userId: written || !first ? ctx.userId : before.userId,
    base,
    lastSyncAt: written ? ctx.now() : m.lastSyncAt,
    localChangedAt: m.localChangedAt,
    dirty: written ? m.dirty && ctx.changeCount() !== gen : true,
  });
}
