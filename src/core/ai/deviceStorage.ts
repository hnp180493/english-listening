// localStorage for DEVICE-LOCAL AI data (API keys, usage counters).
//
// Deliberately NOT stored through ../storage.ts (prefix "nghe-noi-am:"): that prefix is what
// backup export and folder sync enumerate, so API keys would leak into backups / the shared
// folder if an exclusion were ever forgotten. A separate prefix keeps them out by construction.
// AI_DEVICE_LOCAL_KEYS (config.ts) is still exported so sync/backup can also exclude the short
// names explicitly, and clearAiDeviceData() lets "xóa dữ liệu" wipe them.

export const AI_STORAGE_PREFIX = 'nghe-noi-am-device:';

function ls(): Storage | undefined {
  try {
    return (globalThis as { window?: { localStorage?: Storage } }).window?.localStorage;
  } catch {
    return undefined;
  }
}

export function loadDevice<T>(key: string, fallback: T): T {
  try {
    const raw = ls()?.getItem(AI_STORAGE_PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Returns false when the write failed (storage blocked / full). */
export function saveDevice<T>(key: string, value: T): boolean {
  try {
    const s = ls();
    if (!s) return false;
    s.setItem(AI_STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeDevice(key: string): void {
  try {
    ls()?.removeItem(AI_STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

/** Calls fn(shortKey) when another tab changes one of our device keys. Returns unsubscribe. */
export function onDeviceStorageChange(fn: (key: string) => void): () => void {
  const w = (globalThis as { window?: Window }).window;
  if (!w || typeof w.addEventListener !== 'function') return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key == null) fn('*');
    else if (e.key.startsWith(AI_STORAGE_PREFIX)) fn(e.key.slice(AI_STORAGE_PREFIX.length));
  };
  w.addEventListener('storage', handler);
  return () => w.removeEventListener?.('storage', handler);
}
