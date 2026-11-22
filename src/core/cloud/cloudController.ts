// Browser side of account sync (Google sign-in, Supabase): the session in device-local storage, token refresh, the
// sign-in redirect and the portable file's code hand-over, timers and page lifecycle, and a small store the UI
// subscribes to. Decisions are in cloudSync.ts (pure, unit-tested); requests in auth.ts and remote.ts.
// Without a configured project (config.ts) every export is a no-op and the status stays 'off'.

import { useSyncExternalStore } from 'react';
import type { StorageLike } from '../backup';
import { deviceLabelFrom, startupWindow, SYNC_APPLIED_KEY } from '../folderSync';
import { isDeviceLocalKey, onAppWrite } from '../storage';
import { withSyncLock } from '../syncLock';
import {
  authorizeUrl,
  challengeFor,
  cleanCallbackUrl,
  exchangeCode,
  needsRefresh,
  newVerifier,
  parseSession,
  readCallback,
  redirectTarget,
  refreshSession,
  signOutRemote,
  type CloudSession,
  type CloudUser,
} from './auth';
import { emptyCloudMeta, parseCloudMeta, runCloudCycle, type CloudMeta, type CloudMetaStore, type CloudResult } from './cloudSync';
import { cloudConfig, type CloudConfig } from './config';
import { CloudError, restStore } from './remote';

// Device-local (the AI layer's prefix): never exported, imported, synced, or removed by "Xóa dữ liệu".
const SESSION_KEY = 'nghe-noi-am-device:cloud-session';
const META_KEY = 'nghe-noi-am-device:cloud-sync';
const PKCE_KEY = 'nghe-noi-am-device:cloud-pkce';
/** A sign-in started more than this long ago is forgotten (Supabase keeps the code for a few minutes only). */
const PKCE_MAX_AGE_MS = 30 * 60_000;

const DEBOUNCE_MS = 4000;
const CHECK_INTERVAL_MS = 30_000;
const TICK_MS = 5 * 60_000;

// ───────────────────────── state ─────────────────────────

export type CloudStatus =
  | 'off' // no project configured in this build: the feature is hidden
  | 'signed-out'
  | 'signing-in'
  | 'checking'
  | 'synced'
  | 'pending'
  | 'syncing'
  | 'remote-newer' // the account holds newer data; applying it needs a reload
  | 'offline' // network unreachable: retried quietly
  | 'expired' // the session ended: sign in again
  | 'error';

export interface CloudState {
  status: CloudStatus;
  user: CloudUser | null;
  lastSyncAt: number | null;
  error: string | null;
  /** Web page opened by the portable file's sign-in: the code to paste into the file. */
  portableCode: string | null;
  /** Portable file: sign-in started in the web app, waiting for the pasted code. */
  awaitingCode: boolean;
  /** One-off message for Cài đặt after the redirect ("Đã đăng nhập…", "Đã hủy…"). */
  notice: { kind: 'ok' | 'error'; text: string } | null;
  bannerDismissed: boolean;
}

let state: CloudState = {
  status: 'off',
  user: null,
  lastSyncAt: null,
  error: null,
  portableCode: null,
  awaitingCode: false,
  notice: null,
  bannerDismissed: false,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<CloudState>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function getCloudState(): CloudState {
  return state;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useCloudSync(): CloudState {
  return useSyncExternalStore(subscribe, getCloudState, getCloudState);
}

/** True when this build has a project to sign in to. */
export function cloudAvailable(): boolean {
  return cloudConfig() !== null;
}

/** The portable file opened from disk: the sign-in has to go through the web app. */
export function isPortableFile(): boolean {
  try {
    return window.location.protocol === 'file:';
  } catch {
    return false;
  }
}

// ───────────────────────── device-local storage ─────────────────────────

function ls(): Storage | null {
  try {
    const s = window.localStorage;
    void s.length;
    return s;
  } catch {
    return null;
  }
}

function readJSON(key: string): unknown {
  try {
    const raw = ls()?.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJSON(key: string, v: unknown): void {
  try {
    ls()?.setItem(key, JSON.stringify(v));
  } catch {
    // storage blocked: works for this page only
  }
}

function remove(key: string): void {
  try {
    ls()?.removeItem(key);
  } catch {
    // ignore
  }
}

const metaStore: CloudMetaStore = {
  load(): CloudMeta {
    let raw: string | null = null;
    try {
      raw = ls()?.getItem(META_KEY) ?? null;
    } catch {
      raw = null;
    }
    return parseCloudMeta(raw);
  },
  save(m: CloudMeta) {
    writeJSON(META_KEY, m);
  },
};

let session: CloudSession | null = null;

function loadSession(): CloudSession | null {
  return parseSession(readJSON(SESSION_KEY));
}

function saveSession(s: CloudSession): void {
  session = s;
  writeJSON(SESSION_KEY, s);
}

function dropSession(): void {
  session = null;
  remove(SESSION_KEY);
}

interface PendingSignIn {
  verifier: string;
  at: number;
}

function readPkce(): PendingSignIn | null {
  const v = readJSON(PKCE_KEY);
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.verifier !== 'string' || typeof o.at !== 'number' || Date.now() - o.at > PKCE_MAX_AGE_MS) return null;
  return { verifier: o.verifier, at: o.at };
}

// ───────────────────────── token ─────────────────────────

const doFetch = (input: string, init?: RequestInit) => fetch(input, init);

/** Runs `fn` while holding a cross-tab lock where the browser has one (two tabs must not spend one refresh token). */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: { request: (n: string, f: () => Promise<T>) => Promise<T> } }).locks;
  if (locks && typeof locks.request === 'function') return locks.request('nghe-noi-am-cloud-refresh', fn);
  return fn();
}

let refreshing: Promise<string> | null = null;

/** A valid access token, refreshed when it is about to run out. Throws CloudError('auth' | 'network'). */
async function accessToken(cfg: CloudConfig): Promise<string> {
  // another tab may have refreshed (or signed out) meanwhile
  const stored = loadSession();
  if (!stored) {
    session = null;
    throw new CloudError('auth', 'Bạn đã đăng xuất.');
  }
  if (!session || stored.expiresAt > session.expiresAt || stored.user.id !== session.user.id) session = stored;
  if (!needsRefresh(session, Date.now())) return session.accessToken;
  if (!refreshing) {
    refreshing = withRefreshLock(async () => {
      const again = loadSession();
      if (again && !needsRefresh(again, Date.now())) {
        session = again;
        return again.accessToken;
      }
      const r = await refreshSession(cfg, (again ?? session!).refreshToken, doFetch);
      if (r.ok) {
        saveSession(r.session);
        return r.session.accessToken;
      }
      if (r.kind === 'invalid') {
        dropSession();
        throw new CloudError('auth', r.message);
      }
      throw new CloudError(r.kind === 'network' ? 'network' : 'server', r.message);
    }).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// ───────────────────────── cycles ─────────────────────────

let changeCounter = 0;
let debounceId: ReturnType<typeof setTimeout> | null = null;
let lastCheck = 0;
/** Bumped on sign-in / sign-out: a cycle started for another session leaves the state alone. */
let epoch = 0;

function appStorage(): StorageLike | null {
  return ls();
}

function deviceLabel(): string {
  try {
    return deviceLabelFrom(navigator.userAgent);
  } catch {
    return '';
  }
}

function signedIn(): boolean {
  return session !== null && state.status !== 'expired';
}

function run(canApply: () => boolean): Promise<CloudResult> {
  const cfg = cloudConfig();
  return withSyncLock(async (): Promise<CloudResult> => {
    const storage = appStorage();
    const s = session;
    if (!cfg || !s) return { kind: 'noop' };
    if (!storage) return { kind: 'error', error: 'apply', message: 'Trình duyệt đang chặn bộ nhớ của trang.' };
    return runCloudCycle(
      {
        storage,
        meta: metaStore,
        store: restStore(cfg, () => accessToken(cfg), doFetch),
        userId: s.user.id,
        device: deviceLabel(),
        now: () => Date.now(),
        changeCount: () => changeCounter,
      },
      { canApply },
    );
  });
}

function announceApplied(): void {
  try {
    window.localStorage.setItem(SYNC_APPLIED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Apply a result to the UI state. Returns true when this browser's data changed (the caller reloads). */
function settle(res: CloudResult, startedIn: number): boolean {
  const changed = res.kind === 'applied';
  if (changed) announceApplied();
  if (startedIn !== epoch) return changed;
  const meta = metaStore.load();
  switch (res.kind) {
    case 'noop':
    case 'pushed':
    case 'applied':
      setState({
        status: res.kind === 'applied' && res.writeError ? 'error' : meta.dirty ? 'pending' : 'synced',
        error: res.kind === 'applied' && res.writeError ? res.writeError : null,
        lastSyncAt: meta.lastSyncAt,
      });
      return changed;
    case 'remote-newer':
      setState({ status: 'remote-newer', bannerDismissed: false });
      return false;
    case 'error':
      if (res.error === 'auth') {
        dropSession();
        setState({ status: 'expired', error: res.message, bannerDismissed: false });
      } else if (res.error === 'network') {
        setState({ status: 'offline', error: null });
      } else {
        const same = state.status === 'error' && state.error === res.message;
        setState({ status: 'error', error: res.message, bannerDismissed: same ? state.bannerDismissed : false });
      }
      return false;
  }
}

/** Write local changes now (in-session: never replaces this page's data). */
function flush(): Promise<CloudResult> | null {
  if (debounceId !== null) {
    clearTimeout(debounceId);
    debounceId = null;
  }
  if (!signedIn() || state.status === 'remote-newer') return null;
  setState({ status: 'syncing' });
  const e = epoch;
  const p = run(() => false);
  void p.then((r) => settle(r, e));
  return p;
}

function onLocalWrite(key?: string): void {
  if (typeof key === 'string' && isDeviceLocalKey(key)) return;
  changeCounter++;
  const m = metaStore.load();
  metaStore.save({ ...m, dirty: true, localChangedAt: Date.now() });
  if (!signedIn() || state.status === 'remote-newer') return;
  if (state.status !== 'syncing') setState({ status: 'pending' });
  if (debounceId !== null) clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    debounceId = null;
    flush();
  }, DEBOUNCE_MS);
}

/** Another device may have written: look again (throttled). */
function checkRemote(force = false): void {
  if (!signedIn() || state.status === 'syncing' || state.status === 'remote-newer') return;
  const now = Date.now();
  if (!force && now - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = now;
  flush();
}

function visible(): boolean {
  try {
    return document.visibilityState !== 'hidden';
  } catch {
    return true;
  }
}

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
    window.addEventListener('focus', () => checkRemote());
    window.addEventListener('online', () => checkRemote(true));
    window.addEventListener('pagehide', () => {
      if (metaStore.load().dirty) flush(); // best effort
    });
    window.setInterval(() => {
      if (visible()) checkRemote(true);
    }, TICK_MS);
    // signed in or out in another tab of the app
    window.addEventListener('storage', (e) => {
      if (e.key !== SESSION_KEY) return;
      const s = loadSession();
      if (!s && session) {
        epoch++;
        session = null;
        setState({ status: 'signed-out', user: null, error: null });
      } else if (s && (!session || s.user.id !== session.user.id)) {
        epoch++;
        session = s;
        setState({ status: 'checking', user: s.user, error: null });
        checkRemote(true);
      } else if (s) {
        session = s;
      }
    });
  } catch {
    // no DOM
  }
}

function reload(): void {
  try {
    window.location.reload();
  } catch {
    // ignore
  }
}

function replaceUrl(url: string): void {
  try {
    window.history.replaceState(null, '', url);
  } catch {
    // ignore
  }
}

// ───────────────────────── boot ─────────────────────────

let initialized = false;

/**
 * Called once from main.tsx before the first render. Handles the return from Google, then, when signed in, brings
 * this browser's data in step with the account within `budgetMs` (later results only show the banner).
 */
export async function initCloudSync(budgetMs = 1500): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (typeof window === 'undefined') return;
  const cfg = cloudConfig();
  if (!cfg) return; // feature off: status stays 'off'
  attachListeners();
  session = loadSession();
  setState({ status: session ? 'checking' : 'signed-out', user: session?.user ?? null, lastSyncAt: metaStore.load().lastSyncAt });

  const cb = readCallback(window.location.href);
  if (cb.kind === 'error') {
    replaceUrl(cleanCallbackUrl(window.location.href));
    remove(PKCE_KEY);
    setState({ notice: { kind: 'error', text: cb.message } });
  } else if (cb.kind === 'code' && cb.portable && !isPortableFile()) {
    // started by the portable file: show the code to paste there, never use it here
    replaceUrl(cleanCallbackUrl(window.location.href));
    setState({ portableCode: cb.code });
  } else if (cb.kind === 'code') {
    replaceUrl(cleanCallbackUrl(window.location.href));
    const pending = readPkce();
    remove(PKCE_KEY);
    if (!pending) {
      setState({ notice: { kind: 'error', text: 'Không tìm thấy lượt đăng nhập đang chờ trên trình duyệt này. Hãy bấm đăng nhập lại.' } });
    } else {
      // after the first render: a first sync may merge the account's data in, then the page reloads
      void finishSignIn(cfg, cb.code, pending.verifier);
      return;
    }
  }

  if (!session) return;
  const gate = startupWindow(budgetMs);
  const e = epoch;
  const work = run(gate.canApply).then((r) => settle(r, e));
  await Promise.race([work.catch(() => undefined), gate.expired]);
  gate.close();
}

async function finishSignIn(cfg: CloudConfig, code: string, verifier: string): Promise<{ ok: boolean; message?: string }> {
  setState({ status: 'signing-in', error: null, notice: null });
  const r = await exchangeCode(cfg, code, verifier, doFetch);
  if (!r.ok) {
    setState({ status: session ? state.status : 'signed-out', notice: { kind: 'error', text: r.message } });
    return { ok: false, message: r.message };
  }
  epoch++;
  saveSession(r.session);
  remove(PKCE_KEY);
  setState({ status: 'syncing', user: r.session.user, awaitingCode: false, bannerDismissed: false });
  const e = epoch;
  const res = await run(() => true);
  const changed = settle(res, e);
  const who = r.session.user.email ?? r.session.user.name ?? 'tài khoản Google';
  if (changed) {
    setState({ notice: { kind: 'ok', text: `Đã đăng nhập ${who} và gộp dữ liệu từ tài khoản. Đang tải lại…` } });
    window.setTimeout(reload, 700);
  } else {
    setState({ notice: { kind: 'ok', text: `Đã đăng nhập ${who}.` } });
  }
  return { ok: true };
}

// ───────────────────────── actions for the UI ─────────────────────────

/**
 * "Đăng nhập bằng Google". Web: the page goes to Google and comes back. Portable file: the web app opens in a new tab
 * (Google cannot send the learner back to a file), and the learner pastes the code it shows.
 */
export async function signInWithGoogle(): Promise<{ ok: boolean; message?: string }> {
  const cfg = cloudConfig();
  if (!cfg) return { ok: false, message: 'Bản này chưa được cấu hình đăng nhập.' };
  let verifier: string;
  let challenge: string;
  try {
    verifier = newVerifier();
    challenge = await challengeFor(verifier);
  } catch {
    return { ok: false, message: 'Trình duyệt này không hỗ trợ đăng nhập an toàn (thiếu Web Crypto).' };
  }
  writeJSON(PKCE_KEY, { verifier, at: Date.now() });
  const url = authorizeUrl(cfg, redirectTarget(cfg, window.location), challenge);
  if (isPortableFile()) {
    // (no 'noopener': with it window.open always returns null and a blocked pop-up could not be told apart)
    const w = window.open(url, '_blank');
    setState({ awaitingCode: true, notice: null });
    return w === null ? { ok: true, message: 'Trình duyệt chặn cửa sổ mới. Hãy cho phép cửa sổ bật lên rồi bấm lại.' } : { ok: true };
  }
  window.location.assign(url);
  return { ok: true };
}

/** Portable file: the code the web app showed. */
export async function submitPortableCode(raw: string): Promise<{ ok: boolean; message?: string }> {
  const cfg = cloudConfig();
  if (!cfg) return { ok: false, message: 'Bản này chưa được cấu hình đăng nhập.' };
  const code = raw.trim();
  if (!/^[A-Za-z0-9._~-]{8,512}$/.test(code)) return { ok: false, message: 'Mã không đúng. Hãy chép lại nguyên mã.' };
  const pending = readPkce();
  if (!pending) return { ok: false, message: 'Lượt đăng nhập này đã quá hạn. Hãy bấm “Đăng nhập bằng Google” lại.' };
  return finishSignIn(cfg, code, pending.verifier);
}

export function cancelPortableSignIn(): void {
  remove(PKCE_KEY);
  setState({ awaitingCode: false });
}

export function clearPortableCode(): void {
  setState({ portableCode: null });
}

export function clearCloudNotice(): void {
  setState({ notice: null });
}

/** "Đồng bộ ngay" / banner "Tải lại": newer account data may replace local data, then the page reloads. */
export async function cloudSyncNow(): Promise<void> {
  if (!session) return;
  if (debounceId !== null) {
    clearTimeout(debounceId);
    debounceId = null;
  }
  setState({ status: 'syncing', error: null });
  const e = epoch;
  const res = await run(() => true);
  if (settle(res, e)) reload();
}

/** Write pending changes now, waiting at most `ms` (before a reload after import / clear). */
export async function flushCloudSync(ms = 2000): Promise<void> {
  const p = flush();
  if (p) await Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
}

/** "Đăng xuất": write what is pending, end the session here. Data on this browser and in the account stay. */
export async function signOutCloud(): Promise<void> {
  const cfg = cloudConfig();
  await flushCloudSync(3000);
  const s = session;
  epoch++;
  if (debounceId !== null) {
    clearTimeout(debounceId);
    debounceId = null;
  }
  dropSession();
  // the next sign-in (maybe another account) starts as a first connection: merge, never replace
  const m = metaStore.load();
  metaStore.save({ ...emptyCloudMeta(), localChangedAt: m.localChangedAt });
  setState({ status: 'signed-out', user: null, error: null, lastSyncAt: null, bannerDismissed: false, notice: null });
  if (cfg && s) await signOutRemote(cfg, s.accessToken, doFetch);
}

export function dismissCloudBanner(): void {
  setState({ bannerDismissed: true });
}
