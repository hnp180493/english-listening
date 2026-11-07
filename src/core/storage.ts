// localStorage wrapper. Every read/write is guarded: storage can be missing or throw
// (private mode, blocked site data). The app must keep working without it.

const PREFIX = 'nghe-noi-am:';
/** Every key this app writes starts with this prefix (used by backup export/import). */
export const STORAGE_PREFIX = PREFIX;

/** 'array' | 'object' | 'null' | typeof: the JSON shape of a value. */
function shapeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Parsed value of a key, or `fallback` when it is missing, unreadable, or not the same JSON shape as a non-null
 * fallback (an object fallback never gets null, an array or a string). A hand-edited, truncated or hostile value
 * (backup file, synced folder) then reads as "no data" instead of crashing every page on load. With a null
 * fallback anything parsed is returned: those callers sanitize an `unknown`.
 */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const v: unknown = JSON.parse(raw);
    if (fallback !== null && fallback !== undefined && shapeOf(v) !== shapeOf(fallback)) return fallback;
    return v as T;
  } catch {
    return fallback;
  }
}

/** Returns false when the write failed (storage unavailable or full); callers may ignore it. */
export function saveJSON<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    notifyWrite(key);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
    notifyWrite(key);
  } catch {
    // ignore
  }
}

/** Called with the short key after every successful app write (saveJSON / removeKey). */
export type WriteListener = (key: string) => void;
const writeListeners = new Set<WriteListener>();

/** Folder sync uses this to notice local changes. Returns an unsubscribe function. */
export function onAppWrite(fn: WriteListener): () => void {
  writeListeners.add(fn);
  return () => writeListeners.delete(fn);
}

/** Tell write listeners that app data changed outside saveJSON/removeKey (backup import, clear all). */
export function notifyWrite(key: string): void {
  for (const fn of writeListeners) {
    try {
      fn(key);
    } catch {
      // a listener must never break a save
    }
  }
}

/** Storage keys used across the app — keep them unique per module. */
export const KEYS = {
  settings: 'settings',
  stats: 'stats',
  drill: 'drill-cards',
  dictation: 'dictation-progress',
  customSentences: 'custom-sentences', // user-added dictation sentences
  lessons: 'lessons-progress',
  pairs: 'pairs-progress',
  shadowing: 'shadowing-progress',
  media: 'media-library', // saved transcripts (YouTube ids / file names + cues)
  onboarding: 'onboarding',
  review: 'review-cards', // spaced-repetition cards of Ôn tập, see docs/review-system.md
  listeningLog: 'listening-log', // "Nhật ký nghe" entries (synced; tombstones for deletes), see core/listening.ts
  checkups: 'checkup-results', // finished "Kiểm tra định kỳ" results (synced), see core/benchmark.ts
  history: 'progress-history', // daily-aggregate archive for the progress report (synced), see core/history.ts
  tombstones: 'tombstones', // deleted custom sentences / media items (synced, pruned after a while), see core/syncMarkers.ts
  reset: 'reset', // "Xóa dữ liệu" / restore / "Xóa lịch sử" marker (synced): older data elsewhere is dropped, see core/syncMarkers.ts
  // ── device-local (never synced, never in a backup; see DEVICE_LOCAL_KEYS) ──
  listeningTimer: 'listening-timer', // the running "Bắt đầu nghe" stopwatch of this browser
  listeningPending: 'listening-pending', // in-app video seconds not yet worth an entry (< 1 minute)
  checkupDraft: 'checkup-draft', // an unfinished checkup, so a reload can resume it
  checkupAbandoned: 'checkup-abandoned', // forms whose test was left after hearing something ("Bỏ bài")
  deviceId: 'device-id', // random id of this browser (its own bucket in KEYS.history)
  voiceAi: 'voice-ai', // true: this browser chose the paid AI voice (Settings.voiceEngine 'ai' never travels)
} as const;

/**
 * Short keys that belong to this browser only: they are left out of backup export, folder sync and backup
 * import (an import never writes nor clears them), and their writes do not mark folder sync dirty. "Xóa dữ
 * liệu" (clearAll) still removes them.
 */
export const DEVICE_LOCAL_KEYS: ReadonlySet<string> = new Set<string>([
  KEYS.listeningTimer,
  KEYS.listeningPending,
  KEYS.checkupDraft,
  KEYS.checkupAbandoned,
  KEYS.deviceId,
  KEYS.voiceAi,
]);

/** True for a device-local key, given as a short key ('listening-timer') or a full storage key (with prefix). */
export function isDeviceLocalKey(key: string): boolean {
  if (typeof key !== 'string') return false;
  const short = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
  return DEVICE_LOCAL_KEYS.has(short);
}
