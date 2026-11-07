// Backup / restore of everything the app keeps in localStorage. Pure: the storage is injected,
// so this runs in tests without a DOM.

import { REVIEW_MINUTES_OPTIONS } from './review/constants';
import { LISTEN_GOAL_OPTIONS } from './settings';
import { localDay } from './stats';
import { isDeviceLocalKey, KEYS, STORAGE_PREFIX } from './storage';
import { mergeReset, parseReset, withReset, type ResetMarker } from './syncMarkers';

export const BACKUP_APP = 'nghe-noi-am';
export const BACKUP_VERSION = 1;
/** Hard limits that a genuine backup never reaches; anything above is not our file. */
const MAX_KEYS = 500;
const MAX_VALUE_LENGTH = 5_000_000;
/** Largest backup file accepted (bytes / characters). localStorage itself holds ~5 MB. */
export const MAX_BACKUP_SIZE = 20 * 1024 * 1024;

const SETTINGS_KEY = STORAGE_PREFIX + 'settings';

/**
 * Keep only well-formed settings fields; unknown or invalid fields are dropped so the app's
 * defaults apply. Returns null when the value is not a settings object at all.
 */
export function sanitizeSettingsJSON(raw: string): string | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (s.voiceURI === null || (typeof s.voiceURI === 'string' && s.voiceURI.length <= 500)) out.voiceURI = s.voiceURI;
  if (typeof s.rate === 'number' && Number.isFinite(s.rate)) out.rate = Math.min(1.5, Math.max(0.5, s.rate));
  if (typeof s.showIpa === 'boolean') out.showIpa = s.showIpa;
  if (s.theme === 'system' || s.theme === 'light' || s.theme === 'dark') out.theme = s.theme;
  if (typeof s.dailyGoal === 'number' && Number.isFinite(s.dailyGoal)) {
    out.dailyGoal = Math.min(100, Math.max(10, Math.round(s.dailyGoal / 5) * 5));
  }
  if (typeof s.reviewMinutes === 'number' && REVIEW_MINUTES_OPTIONS.includes(s.reviewMinutes)) {
    out.reviewMinutes = s.reviewMinutes;
  }
  if (typeof s.listenGoal === 'number' && LISTEN_GOAL_OPTIONS.includes(s.listenGoal)) out.listenGoal = s.listenGoal;
  // The paid AI voice is a choice made on one browser (device-local KEYS.voiceAi): a backup or a synced folder never
  // switches it on. An 'ai' written by an older build arrives as 'clips' ("Giọng Gemini có sẵn", never paid).
  if (s.voiceEngine === 'browser' || s.voiceEngine === 'clips') out.voiceEngine = s.voiceEngine;
  else if (s.voiceEngine === 'ai') out.voiceEngine = 'clips';
  if (typeof s.voiceChosen === 'boolean') out.voiceChosen = s.voiceChosen;
  if (typeof s.changedAt === 'number' && Number.isFinite(s.changedAt) && s.changedAt > 0) out.changedAt = s.changedAt;
  return JSON.stringify(out);
}

/** The subset of the Web Storage API we need (window.localStorage satisfies it). */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Backup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string; // ISO timestamp
  data: Record<string, string>; // full storage key (with prefix) → raw stored string
}

export type ValidateResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Storage keys owned by this app, in a stable order. */
export function appKeys(storage: StorageLike, prefix = STORAGE_PREFIX): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k != null && k.startsWith(prefix)) keys.push(k);
  }
  return keys.sort();
}

/** App keys that travel between browsers (backup, folder sync): appKeys without the device-local ones. */
export function syncedKeys(storage: StorageLike, prefix = STORAGE_PREFIX): string[] {
  return appKeys(storage, prefix).filter((k) => !isDeviceLocalKey(k));
}

/** Device-local keys (storage.DEVICE_LOCAL_KEYS) are never exported. */
export function exportBackup(storage: StorageLike, now: number = Date.now()): Backup {
  const data: Record<string, string> = {};
  for (const k of syncedKeys(storage)) {
    const v = storage.getItem(k);
    if (v != null) data[k] = v;
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), data };
}

/** "nghe-noi-am-backup-2026-11-06.json" (local date). */
export function backupFileName(now: number = Date.now()): string {
  return `${BACKUP_APP}-backup-${localDay(now)}.json`;
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export interface ValidateOptions {
  /** Accept a file with no data entries (the folder-sync file after "Xóa dữ liệu"). Default false. */
  allowEmpty?: boolean;
}

/**
 * Accepts the parsed JSON object or the raw file text. Error messages are Vietnamese.
 * Extra top-level fields (e.g. the folder-sync `sync` object) are ignored.
 */
export function validateBackup(json: unknown, opts: ValidateOptions = {}): ValidateResult {
  let value = json;
  if (typeof value === 'string') {
    if (value.length > MAX_BACKUP_SIZE) {
      return { ok: false, error: 'Tệp quá lớn, đây không phải bản sao lưu của Nghe Nối Âm.' };
    }
    try {
      value = JSON.parse(value);
    } catch {
      return { ok: false, error: 'Tệp không phải JSON hợp lệ.' };
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Tệp không đúng định dạng bản sao lưu.' };
  }
  const v = value as Record<string, unknown>;
  if (v.app !== BACKUP_APP) {
    return { ok: false, error: 'Đây không phải bản sao lưu của Nghe Nối Âm.' };
  }
  if (typeof v.version !== 'number' || !Number.isInteger(v.version) || v.version < 1) {
    return { ok: false, error: 'Bản sao lưu thiếu số phiên bản.' };
  }
  if (v.version > BACKUP_VERSION) {
    return { ok: false, error: 'Bản sao lưu được tạo bởi phiên bản mới hơn của ứng dụng. Hãy cập nhật ứng dụng rồi thử lại.' };
  }
  if (!v.data || typeof v.data !== 'object' || Array.isArray(v.data)) {
    return { ok: false, error: 'Bản sao lưu không có dữ liệu.' };
  }
  const entries = Object.entries(v.data as Record<string, unknown>);
  if (entries.length > MAX_KEYS) {
    return { ok: false, error: 'Bản sao lưu có quá nhiều mục, có thể tệp đã bị hỏng.' };
  }
  const data: Record<string, string> = {};
  for (const [k, val] of entries) {
    if (!k.startsWith(STORAGE_PREFIX) || k.length === STORAGE_PREFIX.length) {
      return { ok: false, error: `Bản sao lưu chứa mục lạ: “${k.slice(0, 40)}”.` };
    }
    if (typeof val !== 'string' || val.length > MAX_VALUE_LENGTH) {
      return { ok: false, error: `Mục “${k.slice(STORAGE_PREFIX.length, STORAGE_PREFIX.length + 40)}” bị hỏng.` };
    }
    try {
      JSON.parse(val);
    } catch {
      return { ok: false, error: `Mục “${k.slice(STORAGE_PREFIX.length, STORAGE_PREFIX.length + 40)}” không phải JSON hợp lệ.` };
    }
    if (isDeviceLocalKey(k)) continue; // another browser's timer / draft / id: never imported
    if (k === SETTINGS_KEY) {
      const clean = sanitizeSettingsJSON(val);
      if (clean === null) return { ok: false, error: 'Mục “settings” trong bản sao lưu bị hỏng.' };
      data[k] = clean;
      continue;
    }
    data[k] = val;
  }
  // only sync bookkeeping (the reset marker / tombstones left by "Xóa dữ liệu"): nothing to restore either
  const bookkeeping = new Set([STORAGE_PREFIX + KEYS.reset, STORAGE_PREFIX + KEYS.tombstones]);
  if (!Object.keys(data).some((k) => !bookkeeping.has(k)) && !opts.allowEmpty) {
    return { ok: false, error: 'Bản sao lưu trống, không có gì để khôi phục.' };
  }
  const exportedAt = typeof v.exportedAt === 'string' && !Number.isNaN(Date.parse(v.exportedAt)) ? v.exportedAt : '';
  return { ok: true, backup: { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, data } };
}

export interface BackupSummary {
  keys: number;
  exportedAt: number | null; // epoch ms
  attempts: number; // practice attempts in the stats key
  activeDays: number;
}

/** A short, human-friendly description of what a backup contains. */
export function summarizeBackup(backup: Backup): BackupSummary {
  let attempts = 0;
  let activeDays = 0;
  const raw = backup.data[STORAGE_PREFIX + 'stats'];
  if (raw) {
    try {
      const s = JSON.parse(raw) as { attempts?: unknown; activeDays?: unknown };
      if (Array.isArray(s.attempts)) attempts = s.attempts.length;
      if (Array.isArray(s.activeDays)) activeDays = s.activeDays.length;
    } catch {
      // ignore: summary only
    }
  }
  const t = Date.parse(backup.exportedAt);
  return { keys: Object.keys(backup.data).length, exportedAt: Number.isNaN(t) ? null : t, attempts, activeDays };
}

export interface ClearOptions {
  /** Keep this browser's device-local keys (used by import / folder sync, which replace synced data only). */
  keepDeviceLocal?: boolean;
}

/** Remove every key of this app ("Xóa dữ liệu": device-local ones too, unless kept). Returns how many were removed. */
export function clearAll(storage: StorageLike, opts: ClearOptions = {}): number {
  const keys = opts.keepDeviceLocal ? syncedKeys(storage) : appKeys(storage);
  for (const k of keys) storage.removeItem(k);
  return keys.length;
}

const RESET_KEY = STORAGE_PREFIX + KEYS.reset;

function storedReset(storage: StorageLike): ResetMarker {
  let v: unknown = null;
  try {
    const raw = storage.getItem(RESET_KEY);
    v = raw == null ? null : JSON.parse(raw);
  } catch {
    v = null;
  }
  return parseReset(v);
}

/**
 * "Xóa dữ liệu": remove every key of this app, then leave only a reset marker, so folder sync clears the other
 * machines too (their older data is dropped, not merged back; core/syncMarkers). Returns how many keys were removed.
 */
export function clearAllData(storage: StorageLike, now: number = Date.now()): number {
  const prev = storedReset(storage);
  const n = clearAll(storage);
  storage.setItem(RESET_KEY, JSON.stringify(withReset(prev, now)));
  return n;
}

/**
 * "Nhập bản sao lưu" (replace): write the backup, then mark it as a reset so the other machines take the restored
 * data instead of merging their own back into it. Same errors as importBackup (nothing changes on a failed write).
 */
export function restoreBackup(storage: StorageLike, backup: Backup, now: number = Date.now()): number {
  let fromFile: unknown = null;
  try {
    fromFile = JSON.parse(backup.data[RESET_KEY] ?? 'null');
  } catch {
    fromFile = null;
  }
  const prev = mergeReset(storedReset(storage), fromFile);
  const n = importBackup(storage, backup, { replace: true });
  try {
    storage.setItem(RESET_KEY, JSON.stringify(withReset(prev, now)));
  } catch {
    // the restore itself is in place; only its spread to other machines by folder sync is lost
  }
  return n;
}

export interface ImportOptions {
  /** true: wipe current app data first (default). false: merge, backup wins on conflicts. */
  replace?: boolean;
}

/**
 * Write a validated backup into storage. Returns the number of keys written. Device-local keys are neither
 * written nor cleared (this browser's running timer survives a restore or a folder-sync pull).
 * If writing fails midway (quota), the previous data is restored and the error is rethrown.
 */
export function importBackup(storage: StorageLike, backup: Backup, opts: ImportOptions = { replace: true }): number {
  const replace = opts.replace !== false;
  const snapshot = exportBackup(storage).data;
  try {
    if (replace) clearAll(storage, { keepDeviceLocal: true });
    let n = 0;
    for (const [k, v] of Object.entries(backup.data)) {
      if (!k.startsWith(STORAGE_PREFIX) || typeof v !== 'string' || isDeviceLocalKey(k)) continue;
      storage.setItem(k, v);
      n++;
    }
    return n;
  } catch (err) {
    try {
      clearAll(storage, { keepDeviceLocal: true });
      for (const [k, v] of Object.entries(snapshot)) storage.setItem(k, v);
    } catch {
      // best effort
    }
    throw err;
  }
}
