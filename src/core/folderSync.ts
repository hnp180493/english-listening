// Folder sync ("Đồng bộ thư mục"): keep the app's data in one JSON file inside a folder the learner
// chooses (typically in OneDrive), so every computer that opens the app reads and writes the same
// file. This module is the pure part: file format, the decision table and one sync cycle. The
// folder, the local storage and the sync bookkeeping are injected, so it runs in node tests.
// Browser glue (File System Access API, IndexedDB, timers, React hook) is in folderSyncController.ts.

import {
  BACKUP_APP,
  BACKUP_VERSION,
  exportBackup,
  importBackup,
  MAX_BACKUP_SIZE,
  serializeBackup,
  validateBackup,
  type Backup,
  type StorageLike,
} from './backup';
import { hasUserData, mergeData, type DataMap } from './syncMerge';

/** Name of the data file inside the chosen folder. */
export const SYNC_FILE_NAME = 'nghe-noi-am-data.json';
/**
 * localStorage key for this browser's sync bookkeeping. Deliberately outside STORAGE_PREFIX
 * ("nghe-noi-am:"), so it is never exported, imported, cleared with the app data or synced.
 */
export const SYNC_META_KEY = 'nghe-noi-am-sync';
/**
 * localStorage key (outside STORAGE_PREFIX) bumped whenever folder data replaced this browser's
 * data: other open tabs of the app reload instead of writing their stale copies back.
 */
export const SYNC_APPLIED_KEY = 'nghe-noi-am-sync-applied';

/** Extra top-level object in the folder file (manual backups do not have it). */
export interface SyncStamp {
  savedAt: number; // epoch ms, strictly increasing from one write of the file to the next
  device: string; // random id of the browser that wrote the file
  deviceLabel?: string; // "Edge · Windows"
  /**
   * `savedAt` of the files this one was built on (its ancestors, oldest first, capped), ending with
   * its own savedAt. A browser may replace its data with this file only when the file it last
   * synced with is an ancestor: then the file already contains everything that browser had.
   */
  lineage?: number[];
}

/** Ancestors kept in `sync.lineage` (a browser that missed more writes than this merges instead of replacing). */
export const LINEAGE_MAX = 300;

export interface SyncFile extends Backup {
  sync: SyncStamp;
}

/** This browser's bookkeeping (stored under SYNC_META_KEY). */
export interface SyncMeta {
  device: string;
  folderName: string | null;
  /** `sync.savedAt` of the folder file this browser last wrote or applied; null = never synced with this folder. */
  lastSyncedSavedAt: number | null;
  /** Local clock time of that sync (for display). */
  lastSyncAt: number | null;
  /** Local app data changed since lastSyncedSavedAt. */
  dirty: boolean;
  /**
   * Time of the last local app data change. Decides only keys without a merger when merging: settings, custom
   * sentences and media prefs carry their own change times.
   */
  localChangedAt: number;
  /**
   * Fingerprint of this browser's data right after the last sync. A mismatch means local data
   * changed even if `dirty` was lost (a write that did not notify, another tab, storage hiccup).
   */
  syncedHash: string | null;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function newDeviceId(rand: () => number = Math.random): string {
  let s = '';
  while (s.length < 12) s += Math.floor(rand() * 36).toString(36);
  return 'd-' + s.slice(0, 12);
}

export function defaultMeta(device: string): SyncMeta {
  return { device, folderName: null, lastSyncedSavedAt: null, lastSyncAt: null, dirty: false, localChangedAt: 0, syncedHash: null };
}

/** Defensive parse of the stored bookkeeping; a missing or broken value gives a fresh one. */
export function parseMeta(raw: string | null, makeId: () => string = newDeviceId): SyncMeta {
  let v: unknown = null;
  try {
    v = raw == null ? null : JSON.parse(raw);
  } catch {
    v = null;
  }
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const device = typeof o.device === 'string' && /^[\w-]{4,40}$/.test(o.device) ? o.device : makeId();
  return {
    device,
    folderName: typeof o.folderName === 'string' ? o.folderName.slice(0, 260) : null,
    lastSyncedSavedAt: finite(o.lastSyncedSavedAt) ? o.lastSyncedSavedAt : null,
    lastSyncAt: finite(o.lastSyncAt) ? o.lastSyncAt : null,
    dirty: o.dirty === true,
    localChangedAt: finite(o.localChangedAt) ? o.localChangedAt : 0,
    syncedHash: typeof o.syncedHash === 'string' && o.syncedHash.length <= 64 ? o.syncedHash : null,
  };
}

/** Order-independent fingerprint of app data (FNV-1a over the sorted entries). Not cryptographic. */
export function dataHash(data: DataMap): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15);
    }
  };
  const keys = Object.keys(data).sort();
  for (const k of keys) {
    // Length prefixes keep "ab"+"c" and "a"+"bc" apart.
    feed(`${k.length}:${k}${data[k].length}:`);
    feed(data[k]);
  }
  return `${keys.length}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}

/**
 * Sync services keep both versions when two computers changed the file before seeing each other's
 * change. Those copies hold progress that must be merged back:
 *   OneDrive      nghe-noi-am-data-TENMAY.json
 *   Google Drive  nghe-noi-am-data (1).json
 *   Dropbox       nghe-noi-am-data (Ten's conflicted copy 2026-11-06).json
 *   iCloud        nghe-noi-am-data 2.json
 *   Syncthing     nghe-noi-am-data.sync-conflict-20261106-101500-ABCDEFG.json
 * (The ".crswap" temp file of an unfinished write does not match.)
 */
export function isConflictCopyName(name: string): boolean {
  return (
    name.toLowerCase() !== SYNC_FILE_NAME && /^nghe-noi-am-data(?:[ \-_(]|\.sync-conflict-).*\.json$/i.test(name)
  );
}

/** "Edge · Windows" from a user agent string (shown in the file so the learner knows which machine wrote it). */
export function deviceLabelFrom(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Trình duyệt';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /CrOS/.test(ua)
        ? 'ChromeOS'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Mac OS X/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : '';
  return os ? `${browser} · ${os}` : browser;
}

// ───────────────────────── file format ─────────────────────────

export function buildSyncFile(storage: StorageLike, stamp: SyncStamp): SyncFile {
  return makeSyncFile(exportBackup(storage, stamp.savedAt).data, stamp);
}

function makeSyncFile(data: DataMap, stamp: SyncStamp): SyncFile {
  const sync: SyncStamp = { savedAt: stamp.savedAt, device: stamp.device };
  if (stamp.deviceLabel) sync.deviceLabel = stamp.deviceLabel.slice(0, 80);
  sync.lineage = joinLineage(stamp.lineage ?? [], [stamp.savedAt]);
  // Key order: header first, data last, so the file is easy to read.
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(stamp.savedAt).toISOString(), sync, data };
}

/** Union of savedAt lists: positive finite numbers, ascending, the newest LINEAGE_MAX kept. */
export function joinLineage(...lists: readonly unknown[][]): number[] {
  const set = new Set<number>();
  for (const l of lists) for (const x of l) if (finite(x) && x > 0) set.add(x);
  return [...set].sort((a, b) => a - b).slice(-LINEAGE_MAX);
}

/** The file's ancestors and itself. */
export function lineageOf(file: SyncFile): number[] {
  return joinLineage(file.sync.lineage ?? [], [file.sync.savedAt]);
}

export function serializeSyncFile(file: SyncFile): string {
  return serializeBackup(file);
}

export type ParseSyncResult = { ok: true; file: SyncFile } | { ok: false; error: string };

/**
 * Read the folder file. Accepts manual backups too (no `sync`: savedAt falls back to exportedAt)
 * and an empty data object (written after "Xóa dữ liệu"). Error messages are Vietnamese.
 */
export function parseSyncFile(text: string): ParseSyncResult {
  if (text.length > MAX_BACKUP_SIZE) return { ok: false, error: 'Tệp dữ liệu quá lớn, có thể không phải tệp của Nghe Nối Âm.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: 'Tệp dữ liệu không phải JSON hợp lệ (có thể dịch vụ đồng bộ chưa tải xong, hoặc tệp đã bị sửa tay).',
    };
  }
  const v = validateBackup(raw, { allowEmpty: true });
  if (!v.ok) return { ok: false, error: v.error };
  const s = (raw as Record<string, unknown>).sync;
  const so = s && typeof s === 'object' && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
  const fromExport = Date.parse(v.backup.exportedAt);
  const savedAt = finite(so.savedAt) && so.savedAt > 0 ? so.savedAt : Number.isNaN(fromExport) ? 0 : fromExport;
  const sync: SyncStamp = { savedAt, device: typeof so.device === 'string' ? so.device.slice(0, 40) : '' };
  if (typeof so.deviceLabel === 'string' && so.deviceLabel) sync.deviceLabel = so.deviceLabel.slice(0, 80);
  if (Array.isArray(so.lineage)) sync.lineage = joinLineage(so.lineage.slice(-LINEAGE_MAX * 2));
  return { ok: true, file: { ...v.backup, sync } };
}

function sameData(a: DataMap, b: DataMap): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k]);
}

// ───────────────────────── decision ─────────────────────────

/**
 * push  – write this browser's data to the folder file
 * pull  – replace this browser's data with the folder file
 * merge – combine both, write the result to both places
 * noop  – already in step
 * ask   – first connection and both sides hold data: the learner chooses
 */
export type SyncAction = 'push' | 'pull' | 'merge' | 'noop' | 'ask';

export interface DecideInput {
  /** `sync.savedAt` of the folder file; null when the folder has no data file. */
  fileSavedAt: number | null;
  /** The folder file holds at least one data entry. */
  fileHasData: boolean;
  /** null: this browser has never synced with this folder (first connection). */
  lastSyncedSavedAt: number | null;
  /**
   * The file was built on the file this browser last synced with (lastSyncedSavedAt is in its
   * lineage), so it already contains everything this browser had then.
   */
  fileDescends: boolean;
  /** Local changes not yet written to the folder. */
  dirty: boolean;
  /** This browser holds any app data. */
  localHasData: boolean;
}

export function decideSync(i: DecideInput): SyncAction {
  if (i.fileSavedAt == null) return 'push';
  if (i.lastSyncedSavedAt == null) {
    if (!i.fileHasData) return 'push';
    return i.localHasData ? 'ask' : 'pull';
  }
  if (i.fileSavedAt === i.lastSyncedSavedAt) return i.dirty ? 'push' : 'noop';
  // Someone else wrote the file. Take it as is only when nothing here can be lost: no local
  // changes, and the file descends from what this browser last synced (not a version written
  // without seeing ours, e.g. OneDrive kept the other computer's copy, or an old version was put
  // back from OneDrive history). Otherwise merge.
  if (i.fileSavedAt > i.lastSyncedSavedAt && !i.dirty && i.fileDescends) return 'pull';
  return 'merge';
}

// ───────────────────────── one sync cycle ─────────────────────────

/** A file next to the data file, as read from the folder. */
export interface FolderEntry {
  name: string;
  text: string;
}

/** The chosen folder (File System Access API in the browser, a fake in tests). */
export interface SyncFolder {
  readonly name: string;
  /** Contents of the data file, or null when the folder has none. Throws when the folder cannot be read. */
  read(): Promise<string | null>;
  /** Replace the data file (atomically where the platform allows). */
  write(text: string): Promise<void>;
  /** OneDrive conflict copies of the data file (names matching isConflictCopyName). Optional. */
  listConflicts?(): Promise<FolderEntry[]>;
  /** Delete one conflict copy after its data is safely in the data file. Optional. */
  removeConflict?(name: string): Promise<void>;
}

export interface MetaStore {
  load(): SyncMeta;
  save(meta: SyncMeta): void;
}

export interface SyncContext {
  storage: StorageLike;
  meta: MetaStore;
  now(): number;
  deviceLabel?: string;
  /** Counter bumped on every local app write: detects writes made while a file write was in flight. */
  changeCount(): number;
}

export interface CycleOptions {
  /** May this browser's data be replaced right now? Checked just before replacing. */
  canApply: () => boolean;
  /** First connection with data on both sides: return 'ask' to the UI, or merge without asking. */
  onFirstConnect: 'ask' | 'merge';
  /** Treat the folder as never synced (connecting or switching folders). */
  firstConnect?: boolean;
  /** The learner's answer to 'ask'. */
  force?: 'pull' | 'merge';
}

export type CycleResult =
  | { kind: 'noop' }
  | { kind: 'pushed'; savedAt: number }
  | {
      kind: 'applied';
      how: 'pull' | 'merge';
      savedAt: number;
      /** This browser's data before the change (for "Hoàn tác"). */
      previous: DataMap;
      /** Local data actually changed: the page must reload so every module re-reads it. */
      localChanged: boolean;
      writeError?: string;
    }
  | { kind: 'remote-newer' }
  | { kind: 'ask'; remote: SyncFile }
  | { kind: 'error'; stage: 'read' | 'parse' | 'write' | 'apply'; message: string; cause?: unknown };

function errorName(e: unknown): string {
  return e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '';
}

export function readErrorMessage(e: unknown): string {
  const n = errorName(e);
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Trình duyệt chưa cho phép đọc thư mục. Hãy bấm kết nối lại.';
  if (n === 'NotFoundError') return 'Không tìm thấy thư mục (có thể đã bị đổi tên, di chuyển hoặc xóa). Hãy chọn lại thư mục.';
  if (n === 'TimeoutError') return 'Đọc tệp quá lâu (dịch vụ đồng bộ có thể đang tải tệp về). Hãy thử lại sau ít phút.';
  return 'Không đọc được tệp dữ liệu trong thư mục.';
}

export function writeErrorMessage(e: unknown): string {
  const n = errorName(e);
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Trình duyệt chưa cho phép ghi vào thư mục. Hãy bấm kết nối lại.';
  if (n === 'NotFoundError') return 'Không tìm thấy thư mục (có thể đã bị đổi tên, di chuyển hoặc xóa). Hãy chọn lại thư mục.';
  if (n === 'QuotaExceededError') return 'Ổ đĩa đã đầy, không ghi được tệp dữ liệu.';
  if (n === 'NoModificationAllowedError' || n === 'InvalidStateError')
    return 'Tệp dữ liệu đang bị chương trình khác giữ (có thể dịch vụ đồng bộ đang ghi tệp). Sẽ thử lại sau.';
  return 'Không ghi được tệp dữ liệu vào thư mục.';
}

/**
 * Write this browser's data to the folder file and record it in the bookkeeping.
 * `base`: the folder file the data was built on (null: none); `lastSynced`: the file this browser
 * last synced with (null on a first connection). Both become ancestors of the new file.
 */
async function push(folder: SyncFolder, ctx: SyncContext, base: SyncFile | null, lastSynced: number | null): Promise<CycleResult> {
  const before = ctx.meta.load();
  const gen = ctx.changeCount();
  // Strictly after anything seen so far, so every other browser treats the new file as newer
  // even when the clocks of the machines disagree.
  const savedAt = Math.max(ctx.now(), (base?.sync.savedAt ?? 0) + 1, (before.lastSyncedSavedAt ?? 0) + 1);
  const lineage = joinLineage(base ? lineageOf(base) : [], lastSynced != null ? [lastSynced] : []);
  const out = buildSyncFile(ctx.storage, { savedAt, device: before.device, deviceLabel: ctx.deviceLabel, lineage });
  try {
    await folder.write(serializeSyncFile(out));
  } catch (e) {
    const m = ctx.meta.load();
    ctx.meta.save({ ...m, dirty: true });
    return { kind: 'error', stage: 'write', message: writeErrorMessage(e), cause: e };
  }
  const m = ctx.meta.load();
  ctx.meta.save({
    ...m,
    folderName: folder.name,
    lastSyncedSavedAt: savedAt,
    lastSyncAt: ctx.now(),
    dirty: m.dirty && ctx.changeCount() !== gen,
    syncedHash: dataHash(out.data),
  });
  return { kind: 'pushed', savedAt };
}

/** Mark local data as in step with `file` (local data equals file.data) without writing anything. */
function markInStep(folder: SyncFolder, ctx: SyncContext, file: SyncFile): void {
  const m = ctx.meta.load();
  ctx.meta.save({
    ...m,
    folderName: folder.name,
    lastSyncedSavedAt: file.sync.savedAt,
    lastSyncAt: ctx.now(),
    dirty: false,
    syncedHash: dataHash(file.data),
  });
}

/** At most this many conflict copies are merged per cycle (the rest on the next one). */
const MAX_CONFLICT_COPIES = 20;

async function readConflictCopies(folder: SyncFolder): Promise<{ name: string; file: SyncFile }[]> {
  if (!folder.listConflicts) return [];
  let entries: FolderEntry[];
  try {
    entries = await folder.listConflicts();
  } catch {
    return []; // listing is a bonus: the data file itself still syncs
  }
  const out: { name: string; file: SyncFile }[] = [];
  for (const e of entries) {
    if (out.length >= MAX_CONFLICT_COPIES) break;
    if (!isConflictCopyName(e.name) || e.text.trim() === '') continue;
    const p = parseSyncFile(e.text);
    if (p.ok) out.push({ name: e.name, file: p.file }); // a broken copy is left alone
  }
  return out;
}

/**
 * Merge OneDrive conflict copies into the data file, write it, then delete the copies. Touches
 * only the folder (never this browser's data). Returns the new data file.
 */
async function absorbConflictCopies(
  folder: SyncFolder,
  ctx: SyncContext,
  main: SyncFile | null,
  copies: { name: string; file: SyncFile }[],
): Promise<{ ok: true; file: SyncFile } | { ok: false; error: Extract<CycleResult, { kind: 'error' }> }> {
  const all = [...(main ? [main] : []), ...copies.map((c) => c.file)];
  // Newest first: for plain preferences the most recently saved copy wins.
  const byAge = [...all].sort((a, b) => b.sync.savedAt - a.sync.savedAt);
  let data = byAge[0].data;
  for (const f of byAge.slice(1)) data = mergeData(data, f.data, false);
  const check = validateBackup({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: '', data }, { allowEmpty: true });
  if (check.ok) data = check.backup.data;

  const lineage = joinLineage(...all.map(lineageOf));
  const alreadyIn = main !== null && sameData(data, main.data) && copies.every((c) => lineageOf(main).includes(c.file.sync.savedAt));
  let result: SyncFile;
  if (alreadyIn && main) {
    result = main; // absorbed earlier, only deleting the copy failed then
  } else {
    const meta = ctx.meta.load();
    const savedAt = Math.max(ctx.now(), ...all.map((f) => f.sync.savedAt + 1), (meta.lastSyncedSavedAt ?? 0) + 1);
    result = makeSyncFile(data, { savedAt, device: meta.device, deviceLabel: ctx.deviceLabel, lineage });
    try {
      await folder.write(serializeSyncFile(result));
    } catch (e) {
      return { ok: false, error: { kind: 'error', stage: 'write', message: writeErrorMessage(e), cause: e } };
    }
  }
  for (const c of copies) {
    try {
      await folder.removeConflict?.(c.name);
    } catch {
      // harmless: next time it is recognised as already merged
    }
  }
  return { ok: true, file: result };
}

/**
 * Read the folder file, decide, and act. Never overwrites a folder file it could not read or
 * parse; never replaces local data unless `canApply()` allows it (then returns 'remote-newer').
 */
export async function runCycle(folder: SyncFolder, ctx: SyncContext, opts: CycleOptions): Promise<CycleResult> {
  let text: string | null;
  try {
    text = await folder.read();
  } catch (e) {
    return { kind: 'error', stage: 'read', message: readErrorMessage(e), cause: e };
  }
  // An empty file holds no data (left behind when creating the file failed half way): same as none.
  if (text != null && text.trim() === '') text = null;
  let file: SyncFile | null = null;
  if (text != null) {
    const parsed = parseSyncFile(text);
    if (!parsed.ok) {
      return { kind: 'error', stage: 'parse', message: `Tệp ${SYNC_FILE_NAME} trong thư mục bị lỗi: ${parsed.error}` };
    }
    file = parsed.file;
  }

  // Two computers wrote before seeing each other's change: OneDrive kept both. Fold the copies in.
  const copies = await readConflictCopies(folder);
  if (copies.length) {
    const r = await absorbConflictCopies(folder, ctx, file, copies);
    if (!r.ok) return r.error;
    file = r.file;
  }

  const meta = ctx.meta.load();
  const local = exportBackup(ctx.storage, ctx.now()).data;
  const lastSynced = opts.firstConnect ? null : meta.lastSyncedSavedAt;
  // The dirty flag, or local data differing from what it was right after the last sync.
  const dirty = meta.dirty || (meta.syncedHash !== null && meta.syncedHash !== dataHash(local));
  let action: SyncAction =
    opts.force ??
    decideSync({
      fileSavedAt: file ? file.sync.savedAt : null,
      fileHasData: !!file && hasUserData(file.data),
      lastSyncedSavedAt: lastSynced,
      fileDescends: !!file && lastSynced !== null && lineageOf(file).includes(lastSynced),
      dirty,
      localHasData: hasUserData(local),
    });
  if (!file && action !== 'push') action = 'push';
  if (action === 'ask' && opts.onFirstConnect === 'merge') action = 'merge';
  // First connection to a folder whose file holds only bookkeeping (e.g. "Xóa dữ liệu" elsewhere left its reset
  // marker): combine instead of overwriting, so the marker and tombstones stay in the file for the other machines.
  if (action === 'push' && file && lastSynced === null && Object.keys(file.data).length > 0 && !hasUserData(file.data)) action = 'merge';

  if (action === 'noop') return { kind: 'noop' };
  if (action === 'ask' && file) return { kind: 'ask', remote: file };
  if (action === 'push') {
    // Nothing actually changed (a module re-saved the same values): do not touch the file.
    if (file && sameData(local, file.data)) {
      markInStep(folder, ctx, file);
      return { kind: 'noop' };
    }
    // Never create the folder file from a browser with no data: a new computer connecting before
    // OneDrive has downloaded the existing file would otherwise race it with an empty one.
    if (!file && !hasUserData(local)) {
      const m = ctx.meta.load();
      ctx.meta.save({ ...m, folderName: folder.name, dirty: false });
      return { kind: 'noop' };
    }
    return push(folder, ctx, file, lastSynced);
  }
  if (!file) return push(folder, ctx, null, lastSynced);

  // pull / merge: local data will change
  const sameAsLocal = sameData(local, file.data);
  if (action === 'pull' && sameAsLocal) {
    markInStep(folder, ctx, file);
    return { kind: 'noop' };
  }
  if (action === 'pull') {
    if (!opts.canApply()) return { kind: 'remote-newer' };
    try {
      importBackup(ctx.storage, file, { replace: true });
    } catch (e) {
      return { kind: 'error', stage: 'apply', message: 'Bộ nhớ trình duyệt đã đầy, không chép được dữ liệu từ thư mục về máy này.', cause: e };
    }
    const m = ctx.meta.load();
    ctx.meta.save({
      ...m,
      folderName: folder.name,
      lastSyncedSavedAt: file.sync.savedAt,
      lastSyncAt: ctx.now(),
      dirty: false,
      localChangedAt: Math.max(m.localChangedAt, file.sync.savedAt),
      syncedHash: dataHash(file.data),
    });
    return { kind: 'applied', how: 'pull', savedAt: file.sync.savedAt, previous: local, localChanged: true };
  }

  // merge
  const remoteNewer = file.sync.savedAt > meta.localChangedAt;
  const merged = mergeData(local, file.data, remoteNewer, { honorReset: lastSynced !== null });
  // Validate like an import (settings are sanitised) before it reaches storage.
  const check = validateBackup({ ...file, data: merged }, { allowEmpty: true });
  const data = check.ok ? check.backup.data : merged;
  const localChanged = !sameData(local, data);
  // The file brings nothing new (e.g. an older version put back): no need to wait for a reload,
  // this browser's data is simply written to the folder.
  if (localChanged && !opts.canApply()) return { kind: 'remote-newer' };
  if (localChanged) {
    try {
      importBackup(ctx.storage, { ...file, data }, { replace: true });
    } catch (e) {
      return { kind: 'error', stage: 'apply', message: 'Bộ nhớ trình duyệt đã đầy, không gộp được dữ liệu.', cause: e };
    }
  }
  {
    const m = ctx.meta.load();
    ctx.meta.save({ ...m, dirty: true, localChangedAt: Math.max(m.localChangedAt, file.sync.savedAt) });
  }
  if (sameData(data, file.data)) {
    markInStep(folder, ctx, file);
    return { kind: 'applied', how: 'merge', savedAt: file.sync.savedAt, previous: local, localChanged };
  }
  const res = await push(folder, ctx, file, lastSynced);
  if (res.kind === 'pushed') return { kind: 'applied', how: 'merge', savedAt: res.savedAt, previous: local, localChanged };
  return {
    kind: 'applied',
    how: 'merge',
    savedAt: file.sync.savedAt,
    previous: local,
    localChanged,
    writeError: res.kind === 'error' ? res.message : undefined,
  };
}

// ───────────────────────── startup ─────────────────────────

export interface StartupWindow {
  /** True until the budget has run out (or close() was called). */
  canApply(): boolean;
  /** Resolves when the budget has run out; the window is already closed by then. */
  expired: Promise<void>;
  close(): void;
}

/**
 * Before the first render, folder data may replace local data; after it, never (the page would
 * show and write back stale values). The window is closed by the timer itself, before anything
 * awaiting `expired` can render, so no clock comparison can let a late apply slip through.
 */
export function startupWindow(budgetMs: number, setTimer: (fn: () => void, ms: number) => unknown = setTimeout): StartupWindow {
  let open = true;
  let done: () => void = () => {};
  const expired = new Promise<void>((resolve) => {
    done = resolve;
  });
  setTimer(() => {
    open = false;
    done();
  }, budgetMs);
  return {
    canApply: () => open,
    expired,
    close: () => {
      open = false;
      done();
    },
  };
}
