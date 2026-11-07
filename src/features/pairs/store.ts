// Persistence for "Phân biệt âm" — all access goes through core/storage.
import { KEYS, STORAGE_PREFIX, loadJSON, saveJSON } from '../../core/storage';
import { emptyProgress, sanitizeProgress, type PairsProgress } from './game';

export function loadPairsProgress(): PairsProgress {
  return sanitizeProgress(loadJSON<unknown>(KEYS.pairs, emptyProgress()));
}

/** Returns false when the write failed (storage unavailable or full). */
export function savePairsProgress(p: PairsProgress): boolean {
  return saveJSON(KEYS.pairs, p);
}

/**
 * Read-modify-write: apply `update` to the progress currently in storage (not a snapshot
 * taken earlier), so writes from another tab or a backup import are kept, and save it.
 * Returns the saved progress, or null when it could not be saved: then the caller should
 * apply `update` to its in-memory progress instead, so the session still counts the answer
 * (with storage blocked every read is empty and would otherwise wipe it each time).
 */
export function commitPairsProgress(update: (p: PairsProgress) => PairsProgress): PairsProgress | null {
  const next = update(loadPairsProgress());
  return savePairsProgress(next) ? next : null;
}

/** True when a 'storage' event (another tab) may have changed pairs progress; null key = storage cleared. */
export function isPairsStorageKey(key: string | null): boolean {
  return key === null || key === STORAGE_PREFIX + KEYS.pairs;
}
