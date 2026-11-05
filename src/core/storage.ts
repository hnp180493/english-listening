// localStorage wrapper. Every read/write is guarded: storage can be missing or throw
// (private mode, blocked site data). The app must keep working without it.

const PREFIX = 'nghe-noi-am:';

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore: storage unavailable or full
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Storage keys used across the app — keep them unique per module. */
export const KEYS = {
  settings: 'settings',
  stats: 'stats',
  drill: 'drill-cards',
  dictation: 'dictation-progress',
} as const;
