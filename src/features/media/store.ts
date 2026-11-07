// Reactive media library store backed by src/core/storage (KEYS.media).

import { useSyncExternalStore } from 'react';
import { KEYS, loadJSON, saveJSON } from '../../core/storage';
import {
  MAX_LIBRARY_CHARS,
  emptyLibrary,
  sanitizeLibrary,
  type MediaItem,
  type MediaLibrary,
  type MediaPrefs,
} from './library';

let current: MediaLibrary | null = null;
const listeners = new Set<() => void>();
/**
 * Items that could not be saved (storage full / private mode). They live in memory for
 * this session only and are never written, so one oversized item cannot stop every
 * later progress save of the other items from reaching storage.
 */
const sessionOnly = new Set<string>();

function read(): MediaLibrary {
  try {
    return sanitizeLibrary(loadJSON<unknown>(KEYS.media, null));
  } catch {
    return emptyLibrary();
  }
}

/** Storage contents plus this session's unsaved items. */
function readMerged(): MediaLibrary {
  const stored = read();
  if (sessionOnly.size === 0 || !current) return stored;
  const extra = current.items.filter((i) => sessionOnly.has(i.id) && !stored.items.some((s) => s.id === i.id));
  return { ...stored, items: [...extra, ...stored.items] };
}

/** Writes the library (minus session-only items); false when the browser refused the write. */
function persist(lib: MediaLibrary): boolean {
  return saveJSON(KEYS.media, sessionOnly.size ? { ...lib, items: lib.items.filter((i) => !sessionOnly.has(i.id)) } : lib);
}

// ------------------------------------------------------------------ save-failure warning

/**
 * True after a progress save for an existing item failed (storage full / blocked). Cleared by the
 * next successful write — that write stores the whole library, so nothing is lost any more.
 */
let saveFailed = false;
/**
 * The learner closed the warning. While storage stays full every check / sentence change fails
 * again, so the warning must not pop back after each one; it returns only after a successful
 * write followed by a new failure.
 */
let saveWarnDismissed = false;
const saveListeners = new Set<() => void>();

function emitSave(): void {
  saveListeners.forEach((fn) => fn());
}

function setSaveFailed(v: boolean): void {
  const wasVisible = getSaveFailed();
  saveFailed = v;
  if (!v) saveWarnDismissed = false;
  if (getSaveFailed() !== wasVisible) emitSave();
}

function subscribeSave(fn: () => void): () => void {
  saveListeners.add(fn);
  return () => {
    saveListeners.delete(fn);
  };
}

/** Whether the save warning should be shown (for non-React callers and tests). */
export function getSaveFailed(): boolean {
  return saveFailed && !saveWarnDismissed;
}

/** Whether the last progress save failed (the UI shows a small, non-blocking warning). */
export function useSaveFailed(): boolean {
  return useSyncExternalStore(subscribeSave, getSaveFailed, () => false);
}

/** Hide the save warning until a write succeeds again and a later one fails. */
export function dismissSaveWarning(): void {
  if (!getSaveFailed()) return;
  saveWarnDismissed = true;
  emitSave();
}

export function getLibrary(): MediaLibrary {
  if (!current) current = read();
  return current;
}

function commit(next: MediaLibrary): boolean {
  current = next;
  const ok = persist(next);
  if (ok) setSaveFailed(false);
  listeners.forEach((fn) => fn());
  return ok;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // pick up changes made in another tab
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.endsWith(KEYS.media)) {
      current = readMerged();
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

export function useMediaLibrary(): MediaLibrary {
  return useSyncExternalStore(subscribe, getLibrary, getLibrary);
}

export type AddResult = { ok: true } | { ok: false; error: string };

/** Add an item; verifies it actually reached storage (quota can be full). */
export function addItem(item: MediaItem): AddResult {
  const lib = getLibrary();
  const next: MediaLibrary = { ...lib, items: [item, ...lib.items.filter((i) => i.id !== item.id)] };
  let size = 0;
  try {
    size = JSON.stringify(next).length;
  } catch {
    return { ok: false, error: 'Không lưu được dữ liệu này.' };
  }
  if (size > MAX_LIBRARY_CHARS) {
    return {
      ok: false,
      error: 'Thư viện đã gần đầy bộ nhớ trình duyệt. Hãy xoá bớt video cũ rồi thử lại.',
    };
  }
  commit(next);
  const stored = read();
  if (!stored.items.some((i) => i.id === item.id)) {
    // storage unavailable (private mode) or full: keep it in memory for this session only,
    // and re-save the library without it so the other items keep being saved
    sessionOnly.add(item.id);
    // the rest of the library (including progress an earlier failed save kept in memory) is stored now
    if (persist(next)) setSaveFailed(false);
    return {
      ok: false,
      error:
        'Trình duyệt không cho lưu lâu dài (bộ nhớ đầy hoặc chế độ ẩn danh). Bạn vẫn luyện được trong phiên này, nhưng tải lại trang sẽ mất.',
    };
  }
  return { ok: true };
}

/** Update one item. Returns false when the change could not be written to the browser (it stays in memory). */
export function updateItem(id: string, fn: (item: MediaItem) => MediaItem): boolean {
  const lib = getLibrary();
  let changed = false;
  const items = lib.items.map((i) => {
    if (i.id !== id) return i;
    const n = fn(i);
    if (n !== i) changed = true;
    return n;
  });
  if (!changed) return true;
  const ok = commit({ ...lib, items });
  // a session-only item already has its own "not saved" notice
  if (!ok && !sessionOnly.has(id)) setSaveFailed(true);
  return ok;
}

export function deleteItem(id: string): void {
  const lib = getLibrary();
  files.delete(id);
  sessionOnly.delete(id);
  if (!lib.items.some((i) => i.id === id)) return;
  commit({ ...lib, items: lib.items.filter((i) => i.id !== id) });
}

/** True when this item exists only in memory (it could not be saved to the browser). */
export function isSessionOnly(id: string): boolean {
  return sessionOnly.has(id);
}

export function setPrefs(patch: Partial<MediaPrefs>): void {
  const lib = getLibrary();
  commit({ ...lib, prefs: { ...lib.prefs, ...patch } });
}

// ------------------------------------------------------------------ session-only file handles

// Browsers cannot persist a File; keep the ones chosen in this session so the
// learner does not have to re-pick after navigating away and back.
const files = new Map<string, File>();

export function rememberFile(itemId: string, file: File): void {
  files.set(itemId, file);
}

export function rememberedFile(itemId: string): File | undefined {
  return files.get(itemId);
}

export function forgetFile(itemId: string): void {
  files.delete(itemId);
}
