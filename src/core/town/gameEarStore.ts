// IO of "Trong game: nghe 1 lần là đúng" (./gameEar.ts): the synced key `town-ear`, one write for a job's facts or a
// dispatch shift's calls. In the admin sandbox everything goes under its own prefix (core/storage.ts), never into the
// learner's real data. Never throws: a game must not fail because a count could not be written.

import { useSyncExternalStore } from 'react';
import { getSettings } from '../settings';
import { NORMAL_RATE_MIN } from '../dictation/listens';
import { dayOf, deviceId } from '../history';
import { KEYS, loadJSON, saveJSON } from '../storage';
import { emptyGameEar, mergeGameEar, noteEar, parseGameEar, type EarFact, type GameEar } from './gameEar';

let session: GameEar | null = null;
const listeners = new Set<() => void>();

export function loadGameEar(): GameEar {
  const stored = parseGameEar(loadJSON<unknown>(KEYS.townEar, null));
  return session ? mergeGameEar(session, stored) : stored;
}

/** The learner's speed now is the normal one (the dictation's rule): slower, a single hearing is measured but not right. */
export const normalSpeedNow = (): boolean => (getSettings().rate || 1) >= NORMAL_RATE_MIN;

export interface EarItem {
  /** `job-…` for a job, `dc-…` for a dispatch call. */
  id: string;
  facts: readonly EarFact[];
  /** Met before this store existed (a job already finished): not measured. */
  seenBefore?: boolean;
}

/**
 * Record what was heard in a job or a dispatch shift (each item its own first meeting). `level`: the difficulty the game
 * set, when it gives one. Returns how many items were counted.
 */
export function recordGameEar(items: readonly EarItem[], opts: { level?: number; now?: number } = {}): number {
  try {
    const now = opts.now ?? Date.now();
    const device = deviceId();
    const day = dayOf(now);
    const normalSpeed = normalSpeedNow();
    let store = loadGameEar();
    let n = 0;
    for (const it of items) {
      const r = noteEar(store, device, day, { id: it.id, at: now, facts: it.facts, ...(it.seenBefore ? { seenBefore: true } : {}) }, { normalSpeed, ...(opts.level !== undefined ? { level: opts.level } : {}) });
      store = r.store;
      if (r.counted) n++;
    }
    if (n > 0) {
      session = saveJSON(KEYS.townEar, store) ? null : store;
      listeners.forEach((fn) => fn());
    }
    return n;
  } catch {
    return 0;
  }
}

export function useGameEar(): GameEar {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot,
    getSnapshot,
  );
}

let snap: { raw: string | null; value: GameEar } = { raw: null, value: emptyGameEar() };
function getSnapshot(): GameEar {
  const value = loadGameEar();
  const raw = JSON.stringify(value);
  if (raw !== snap.raw) snap = { raw, value };
  return snap.value;
}
