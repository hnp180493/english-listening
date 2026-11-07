// Browser side of folder sync: File System Access API folder, IndexedDB (the folder handle cannot
// live in localStorage), timers and page lifecycle, and a small store the UI subscribes to.
// The decisions themselves are in folderSync.ts (pure, unit-tested).

import { useSyncExternalStore } from 'react';
import { exportBackup, importBackup, MAX_BACKUP_SIZE, summarizeBackup, type BackupSummary, type StorageLike } from './backup';
import {
  defaultMeta,
  deviceLabelFrom,
  isConflictCopyName,
  newDeviceId,
  parseMeta,
  runCycle,
  startupWindow,
  SYNC_APPLIED_KEY,
  SYNC_FILE_NAME,
  SYNC_META_KEY,
  type CycleOptions,
  type FolderEntry,
  type CycleResult,
  type MetaStore,
  type SyncContext,
  type SyncFile,
  type SyncFolder,
  type SyncMeta,
} from './folderSync';
import { isDeviceLocalKey, onAppWrite } from './storage';
import type { DataMap } from './syncMerge';

// ───────────────────────── File System Access API (typed locally: not all of it is in lib.dom) ─────────────────────────

type Perm = 'granted' | 'denied' | 'prompt';
interface FsWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}
interface FsFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
}
export interface FsDirHandle {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  entries?(): AsyncIterableIterator<[string, { readonly kind: 'file' | 'directory' }]>;
  removeEntry?(name: string): Promise<void>;
  queryPermission?(d: { mode: 'readwrite' }): Promise<Perm>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<Perm>;
}
type DirectoryPicker = (opts?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<FsDirHandle>;

function picker(): DirectoryPicker | null {
  try {
    const w = window as unknown as { showDirectoryPicker?: DirectoryPicker; isSecureContext?: boolean };
    return typeof w.showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined' ? w.showDirectoryPicker.bind(window) : null;
  } catch {
    return null;
  }
}

/** Folder sync needs the File System Access API (Edge / Chrome on a computer) and IndexedDB. */
export function folderSyncSupported(): boolean {
  return typeof window !== 'undefined' && picker() !== null;
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      const e = new Error('timeout');
      e.name = 'TimeoutError';
      reject(e);
    }, ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

const READ_TIMEOUT = 15_000;
const WRITE_TIMEOUT = 15_000;

function folderOf(handle: FsDirHandle): SyncFolder {
  return {
    name: handle.name,
    async read() {
      let fh: FsFileHandle;
      try {
        fh = await timeout(handle.getFileHandle(SYNC_FILE_NAME), READ_TIMEOUT);
      } catch (e) {
        if (e && typeof e === 'object' && (e as { name?: string }).name === 'NotFoundError') return null;
        throw e;
      }
      const f = await timeout(fh.getFile(), READ_TIMEOUT);
      return timeout(f.text(), READ_TIMEOUT);
    },
    async write(text: string) {
      const fh = await timeout(handle.getFileHandle(SYNC_FILE_NAME, { create: true }), WRITE_TIMEOUT);
      // createWritable writes a temporary file and swaps it in on close(): readers (OneDrive, the
      // other machine) never see a half-written file.
      const w = await timeout(fh.createWritable(), WRITE_TIMEOUT);
      try {
        await w.write(text);
        await timeout(w.close(), WRITE_TIMEOUT);
      } catch (e) {
        try {
          await w.abort?.();
        } catch {
          // ignore
        }
        throw e;
      }
    },
    async listConflicts() {
      if (typeof handle.entries !== 'function') return [];
      const list = async () => {
        const out: FolderEntry[] = [];
        for await (const [name, entry] of handle.entries!()) {
          if (entry.kind !== 'file' || !isConflictCopyName(name)) continue;
          const f = await (entry as unknown as FsFileHandle).getFile();
          if (f.size > MAX_BACKUP_SIZE) continue;
          out.push({ name, text: await f.text() });
          if (out.length >= 20) break;
        }
        return out;
      };
      return timeout(list(), READ_TIMEOUT);
    },
    async removeConflict(name: string) {
      if (!isConflictCopyName(name) || typeof handle.removeEntry !== 'function') return;
      await timeout(handle.removeEntry(name), WRITE_TIMEOUT);
    },
  };
}

async function queryPerm(h: FsDirHandle): Promise<Perm> {
  try {
    return h.queryPermission ? await h.queryPermission({ mode: 'readwrite' }) : 'granted';
  } catch {
    return 'prompt';
  }
}

async function requestPerm(h: FsDirHandle): Promise<Perm> {
  try {
    return h.requestPermission ? await h.requestPermission({ mode: 'readwrite' }) : 'granted';
  } catch {
    return 'denied';
  }
}

// ───────────────────────── IndexedDB key/value (folder handle + undo snapshot) ─────────────────────────

const DB_NAME = 'nghe-noi-am-sync';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB'));
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await timeout(openDb(), 3000);
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB'));
    });
  } finally {
    db.close();
  }
}

const idbGet = <T>(key: string) => idb<T | undefined>('readonly', (s) => s.get(key));
const idbSet = (key: string, value: unknown) => idb<unknown>('readwrite', (s) => s.put(value, key));
const idbDel = (key: string) => idb<unknown>('readwrite', (s) => s.delete(key));

const HANDLE_KEY = 'dir';
const UNDO_KEY = 'undo';
/** sessionStorage marker: the undo snapshot was made in this tab's session (only then is "Hoàn tác" offered). */
const UNDO_SESSION_KEY = 'nghe-noi-am-sync:undo';

interface UndoRecord {
  id: string;
  at: number;
  how: 'pull' | 'merge';
  data: DataMap;
}

// ───────────────────────── local bookkeeping ─────────────────────────

function appStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    void s.length;
    return s;
  } catch {
    return null;
  }
}

const metaStore: MetaStore = {
  load(): SyncMeta {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(SYNC_META_KEY);
    } catch {
      raw = null;
    }
    const m = parseMeta(raw, newDeviceId);
    if (raw == null || !raw.includes(m.device)) metaStore.save(m); // persist a new device id right away
    return m;
  },
  save(meta: SyncMeta) {
    try {
      window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
    } catch {
      // storage blocked: sync still works for this session, it just re-checks more often
    }
  },
};

let changeCounter = 0;

function context(storage: StorageLike): SyncContext {
  let label = '';
  try {
    label = deviceLabelFrom(navigator.userAgent);
  } catch {
    label = '';
  }
  return { storage, meta: metaStore, now: () => Date.now(), deviceLabel: label, changeCount: () => changeCounter };
}

// ───────────────────────── UI state ─────────────────────────

export type SyncStatus =
  | 'unsupported' // browser has no File System Access API
  | 'off' // no folder chosen
  | 'checking' // startup, reading the folder
  | 'needs-permission' // folder remembered, browser wants a click to allow access again
  | 'synced'
  | 'pending' // local changes waiting to be written
  | 'syncing'
  | 'remote-newer' // another machine wrote newer data while this page is open
  | 'error';

export interface FolderSyncState {
  status: SyncStatus;
  folderName: string | null;
  lastSyncAt: number | null;
  error: string | null;
  /** Time of the last time folder data replaced/merged into this browser's data, if undoable this session. */
  undoAt: number | null;
  bannerDismissed: boolean;
}

let state: FolderSyncState = {
  status: 'off',
  folderName: null,
  lastSyncAt: null,
  error: null,
  undoAt: null,
  bannerDismissed: false,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<FolderSyncState>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function getFolderSyncState(): FolderSyncState {
  return state;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useFolderSync(): FolderSyncState {
  return useSyncExternalStore(subscribe, getFolderSyncState, getFolderSyncState);
}

// ───────────────────────── engine ─────────────────────────

let handle: FsDirHandle | null = null;
let permitted = false;
let queue: Promise<unknown> = Promise.resolve();
let debounceId: ReturnType<typeof setTimeout> | null = null;
let lastCheck = 0;
/**
 * Bumped whenever the connected folder changes (connect, switch, disconnect, undo). A cycle that
 * started under an older epoch must not touch the UI state (it belongs to a folder that is gone).
 */
let epoch = 0;
const DEBOUNCE_MS = 2000;
const CHECK_INTERVAL_MS = 5000;

function connected(): boolean {
  return handle !== null && permitted;
}

/** Run cycles one at a time (two cycles must never interleave their read and write). */
function enqueue(opts: CycleOptions, explicit?: FsDirHandle): Promise<CycleResult> {
  const startedIn = epoch;
  const h = explicit ?? handle;
  const storage = appStorage();
  const run = async (): Promise<CycleResult> => {
    // Disconnected or switched while waiting in the queue: leave the old folder alone.
    if (!explicit && startedIn !== epoch) return { kind: 'noop' };
    if (!h || !storage) return { kind: 'error', stage: 'read', message: 'Trình duyệt đang chặn bộ nhớ của trang.' };
    return runCycle(folderOf(h), context(storage), opts);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

function errorStatus(res: Extract<CycleResult, { kind: 'error' }>): void {
  const name = res.cause && typeof res.cause === 'object' ? (res.cause as { name?: string }).name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    permitted = false;
    setState({ status: 'needs-permission', error: null, bannerDismissed: false });
    return;
  }
  // Keep a dismissed banner dismissed while the same error repeats on every retry.
  const same = state.status === 'error' && state.error === res.message;
  setState({ status: 'error', error: res.message, bannerDismissed: same ? state.bannerDismissed : false });
}

async function rememberUndo(res: Extract<CycleResult, { kind: 'applied' }>): Promise<void> {
  if (!res.localChanged || Object.keys(res.previous).length === 0) return;
  const rec: UndoRecord = { id: newDeviceId(), at: Date.now(), how: res.how, data: res.previous };
  try {
    await idbSet(UNDO_KEY, rec);
    sessionStorage.setItem(UNDO_SESSION_KEY, rec.id);
    setState({ undoAt: rec.at });
  } catch {
    // undo is a convenience
  }
}

/** Tell other open tabs of the app that this browser's data was replaced (they reload). */
function announceApplied(): void {
  try {
    window.localStorage.setItem(SYNC_APPLIED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Apply a cycle result to the UI state. Returns true when local data changed (caller reloads).
 * `startedIn`: the epoch the cycle was started in; a result from an older epoch only reports
 * whether data changed and leaves the UI state alone.
 */
async function settle(res: CycleResult, startedIn: number): Promise<boolean> {
  if (res.kind === 'applied' && res.localChanged) announceApplied();
  if (startedIn !== epoch) return res.kind === 'applied' && res.localChanged;
  const meta = metaStore.load();
  switch (res.kind) {
    case 'noop':
    case 'pushed':
      setState({ status: meta.dirty ? 'pending' : 'synced', error: null, lastSyncAt: meta.lastSyncAt, folderName: handle?.name ?? null });
      return false;
    case 'applied':
      await rememberUndo(res);
      setState({
        status: res.writeError ? 'error' : 'synced',
        error: res.writeError ?? null,
        lastSyncAt: meta.lastSyncAt,
        folderName: handle?.name ?? null,
      });
      return res.localChanged;
    case 'remote-newer':
      setState({ status: 'remote-newer', bannerDismissed: false });
      return false;
    case 'ask':
      return false;
    case 'error':
      errorStatus(res);
      return false;
  }
}

/** Write local changes now (debounce elapsed, page hidden, or the learner asked). In-session: never replaces local data. */
function flush(): Promise<CycleResult> | null {
  if (debounceId !== null) {
    clearTimeout(debounceId);
    debounceId = null;
  }
  if (!connected() || state.status === 'remote-newer') return null;
  setState({ status: 'syncing' });
  const e = epoch;
  const p = enqueue({ canApply: () => false, onFirstConnect: 'merge' });
  void p.then((r) => settle(r, e));
  return p;
}

function onLocalWrite(key?: string): void {
  // this browser's timer / draft / id never travel: their writes do not make the folder file stale
  if (typeof key === 'string' && isDeviceLocalKey(key)) return;
  changeCounter++;
  const m = metaStore.load();
  metaStore.save({ ...m, dirty: true, localChangedAt: Date.now() });
  if (!connected() || state.status === 'remote-newer') return;
  if (state.status !== 'syncing') setState({ status: 'pending' });
  if (debounceId !== null) clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    debounceId = null;
    flush();
  }, DEBOUNCE_MS);
}

/** Another machine may have written the file (OneDrive): look again when the page comes back. */
function checkRemote(): void {
  if (!connected() || state.status === 'syncing' || state.status === 'remote-newer') return;
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = now;
  if (debounceId !== null) {
    flush();
    return;
  }
  const e = epoch;
  void enqueue({ canApply: () => false, onFirstConnect: 'merge' }).then((r) => settle(r, e));
}

let initialized = false;

function attachListeners(): void {
  onAppWrite(onLocalWrite);
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (metaStore.load().dirty) flush();
      } else {
        checkRemote();
      }
    });
    window.addEventListener('focus', checkRemote);
    window.addEventListener('pagehide', () => {
      if (metaStore.load().dirty) flush(); // best effort: the write may not finish
    });
    // Another tab of the app replaced the stored data with folder data (or undid it). This tab's
    // pages still hold the old values in memory and would write them back over it: reload.
    window.addEventListener('storage', (e) => {
      if (e.key === SYNC_APPLIED_KEY && e.newValue !== null) reload();
    });
  } catch {
    // no DOM
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadUndo(): Promise<void> {
  try {
    const marker = sessionStorage.getItem(UNDO_SESSION_KEY);
    if (!marker) return;
    const rec = await idbGet<UndoRecord>(UNDO_KEY);
    if (rec && rec.id === marker) setState({ undoAt: rec.at });
  } catch {
    // ignore
  }
}

/**
 * Called once from main.tsx before the first render. If a folder is connected and the browser
 * still allows access, bring this browser's data in step with the folder file, spending at most
 * `budgetMs`; anything slower finishes in the background and never replaces data under a page
 * that is already showing (the banner offers a reload instead).
 */
export async function initFolderSync(budgetMs = 1500): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (typeof window === 'undefined') return;
  attachListeners();
  if (!folderSyncSupported()) {
    setState({ status: 'unsupported' });
    return;
  }
  // Folder data may replace local data only until the first render (see startupWindow).
  const gate = startupWindow(budgetMs);
  const work = (async () => {
    const h = await idbGet<FsDirHandle>(HANDLE_KEY);
    if (!h || typeof h.getFileHandle !== 'function') return;
    handle = h;
    const meta = metaStore.load();
    setState({ status: 'checking', folderName: h.name, lastSyncAt: meta.lastSyncAt });
    void loadUndo();
    const perm = await queryPerm(h);
    if (perm !== 'granted') {
      setState({ status: 'needs-permission' });
      return;
    }
    permitted = true;
    const e = epoch;
    const res = await enqueue({ canApply: gate.canApply, onFirstConnect: 'merge' });
    await settle(res, e);
  })().catch(() => {
    if (state.status === 'checking') setState({ status: 'needs-permission' });
  });
  await Promise.race([work, gate.expired]);
  gate.close(); // the page renders next: from now on, newer folder data only shows the banner
}

function reload(): void {
  try {
    window.location.reload();
  } catch {
    // ignore
  }
}

// ───────────────────────── actions for the UI ─────────────────────────

/** Banner / settings: the browser asks again for access (needs a click), then sync and reload if data changed. */
export async function grantAndSync(): Promise<void> {
  if (!handle) return;
  const perm = await requestPerm(handle);
  if (perm !== 'granted') {
    setState({ status: 'needs-permission', error: 'Chưa được cấp quyền truy cập thư mục.' });
    return;
  }
  permitted = true;
  await syncNow();
}

/** "Đồng bộ ngay": the learner asked, so newer folder data may replace local data (then the page reloads). */
export async function syncNow(): Promise<void> {
  if (!handle) return;
  if (!permitted) {
    const perm = await requestPerm(handle);
    if (perm !== 'granted') {
      setState({ status: 'needs-permission' });
      return;
    }
    permitted = true;
  }
  if (debounceId !== null) {
    clearTimeout(debounceId);
    debounceId = null;
  }
  setState({ status: 'syncing', error: null });
  const e = epoch;
  const res = await enqueue({ canApply: () => true, onFirstConnect: 'merge' });
  if (await settle(res, e)) reload();
}

/** Write pending changes now, waiting at most `ms` (used before a reload after import / clear). */
export async function flushFolderSync(ms = 2000): Promise<void> {
  const p = flush();
  if (p) await Promise.race([p, sleep(ms)]);
}

export type ConnectOutcome =
  | { kind: 'cancelled' }
  | { kind: 'connected'; reload: boolean }
  | { kind: 'ask'; folderName: string; local: BackupSummary; localChangedAt: number | null; remote: BackupSummary; remoteDevice: string }
  | { kind: 'error'; message: string };

let pending: { handle: FsDirHandle; remote: SyncFile } | null = null;

async function finishConnect(h: FsDirHandle, res: CycleResult): Promise<ConnectOutcome> {
  if (res.kind === 'error') return { kind: 'error', message: res.message };
  if (res.kind === 'ask' || res.kind === 'remote-newer') return { kind: 'error', message: 'Không kết nối được thư mục. Hãy thử lại.' };
  try {
    await idbSet(HANDLE_KEY, h);
  } catch {
    return { kind: 'error', message: 'Trình duyệt không cho lưu thư mục đã chọn (bộ nhớ trang bị chặn).' };
  }
  if (debounceId !== null) {
    clearTimeout(debounceId);
    debounceId = null;
  }
  handle = h;
  permitted = true;
  epoch++;
  const changed = await settle(res, epoch);
  return { kind: 'connected', reload: changed };
}

/** "Chọn thư mục…" / "Đổi thư mục": pick a folder and connect to it. */
export async function connectFolder(): Promise<ConnectOutcome> {
  const pick = picker();
  if (!pick) return { kind: 'error', message: 'Trình duyệt này không hỗ trợ chọn thư mục.' };
  let h: FsDirHandle;
  try {
    h = await pick({ id: 'nghe-noi-am-sync', mode: 'readwrite', startIn: 'documents' });
  } catch (e) {
    if (e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError') return { kind: 'cancelled' };
    return { kind: 'error', message: 'Không mở được thư mục này (thư mục hệ thống hoặc bị chặn). Hãy chọn thư mục khác.' };
  }
  if ((await queryPerm(h)) !== 'granted' && (await requestPerm(h)) !== 'granted') {
    return { kind: 'error', message: 'Chưa được cấp quyền ghi vào thư mục, chưa kết nối.' };
  }
  const res = await enqueue({ canApply: () => true, onFirstConnect: 'ask', firstConnect: true }, h);
  if (res.kind === 'ask') {
    pending = { handle: h, remote: res.remote };
    const storage = appStorage();
    const meta = metaStore.load();
    return {
      kind: 'ask',
      folderName: h.name,
      local: summarizeBackup(storage ? exportBackup(storage) : { app: 'nghe-noi-am', version: 1, exportedAt: '', data: {} }),
      localChangedAt: meta.localChangedAt > 0 ? meta.localChangedAt : null,
      remote: { ...summarizeBackup(res.remote), exportedAt: res.remote.sync.savedAt || null },
      remoteDevice: res.remote.sync.deviceLabel ?? '',
    };
  }
  return finishConnect(h, res);
}

/** The learner's answer when both this browser and the folder already hold data. */
export async function resolveConnect(choice: 'pull' | 'merge' | 'cancel'): Promise<ConnectOutcome> {
  const p = pending;
  pending = null;
  if (!p || choice === 'cancel') return { kind: 'cancelled' };
  const res = await enqueue({ canApply: () => true, onFirstConnect: 'merge', firstConnect: true, force: choice }, p.handle);
  return finishConnect(p.handle, res);
}

/** "Ngắt kết nối": forget the folder on this browser. The file in the folder is left untouched. */
export async function disconnectFolder(): Promise<void> {
  if (debounceId !== null) {
    clearTimeout(debounceId);
    debounceId = null;
  }
  handle = null;
  permitted = false;
  pending = null;
  epoch++; // queued background cycles are skipped, a running one no longer updates the UI
  // Let a write that is already running finish first, so its bookkeeping does not land after the reset.
  await Promise.race([queue, sleep(3000)]);
  try {
    await idbDel(HANDLE_KEY);
  } catch {
    // ignore
  }
  const m = metaStore.load();
  metaStore.save({ ...defaultMeta(m.device), localChangedAt: m.localChangedAt });
  setState({ status: 'off', folderName: null, lastSyncAt: null, error: null, bannerDismissed: false });
}

/**
 * "Hoàn tác": put back this browser's data as it was before folder data was last applied, and
 * disconnect this browser from the folder, then reload. The folder file is left as it is: writing
 * the old data over it would make the other computers replace their progress with it on their next
 * sync. To sync again the learner reconnects and chooses "Gộp" (nothing is lost either way).
 */
export async function undoLastApply(): Promise<boolean> {
  const storage = appStorage();
  if (!storage) return false;
  let rec: UndoRecord | undefined;
  try {
    const marker = sessionStorage.getItem(UNDO_SESSION_KEY);
    rec = await idbGet<UndoRecord>(UNDO_KEY);
    if (!rec || rec.id !== marker) return false;
  } catch {
    return false;
  }
  // Whatever was practised since is written to the folder first, so the folder keeps it.
  if (metaStore.load().dirty) await flushFolderSync(3000);
  // Then stop syncing, so no write of the restored data can reach the folder.
  await disconnectFolder();
  try {
    importBackup(storage, { app: 'nghe-noi-am', version: 1, exportedAt: '', data: rec.data }, { replace: true });
  } catch {
    return false;
  }
  const m = metaStore.load();
  metaStore.save({ ...m, dirty: false, localChangedAt: Date.now() });
  try {
    await idbDel(UNDO_KEY);
    sessionStorage.removeItem(UNDO_SESSION_KEY);
  } catch {
    // ignore
  }
  announceApplied();
  setState({ undoAt: null });
  reload();
  return true;
}

export function dismissSyncBanner(): void {
  setState({ bannerDismissed: true });
}
