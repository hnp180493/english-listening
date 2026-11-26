// IO of Westbay's jobs' progress (./jobProgress.ts): KEYS.townJobs (synced), its hook, and the call that writes a run
// down. Xu are paid by ./jobStore.ts (town-progress), the heat lives in memory (features/town/jobs/heatStore.ts).

import { useSyncExternalStore } from 'react';
import { KEYS, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import type { JobGrade } from './job';
import { emptyTownJobs, grantClueTo, hasClue, mergeTownJobs, parseTownJobs, recordJob, type TownJobs } from './jobProgress';

let session: TownJobs | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownJobs | null = null;
let cacheValue: TownJobs = emptyTownJobs();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.townJobs);
  } catch {
    return null;
  }
}

function notify(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // a listener must never break a write
    }
  }
}

/** The stored progress (plus this session's unsaved run after a failed save). Stable while nothing changed. */
export function loadTownJobs(): TownJobs {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownJobs(parsed);
    cacheValue = session ? mergeTownJobs(session, stored) : stored;
    cacheRaw = raw;
    cacheSession = session;
  }
  return cacheValue;
}

let hooked = false;
function subscribe(fn: () => void): () => void {
  if (!hooked) {
    hooked = true;
    onAppWrite((key) => {
      if (key !== KEYS.townJobs && key !== '*') return;
      if (key === '*') {
        session = null;
        cacheRaw = undefined;
      }
      notify();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.townJobs) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Live progress; re-renders on every change (this tab, another tab, account sync). */
export function useTownJobs(): TownJobs {
  return useSyncExternalStore(subscribe, loadTownJobs, loadTownJobs);
}

/** A run is over: written down. Never throws. */
export function finishJobRun(jobId: string, grade: JobGrade, flags: readonly string[], now: number = Date.now()): void {
  try {
    const next = recordJob(loadTownJobs(), jobId, grade, flags, now);
    const saved = saveJSON(KEYS.townJobs, next);
    session = saved ? null : next;
    notify();
  } catch {
    // progress is best effort; the run's pay is already written
  }
}

/**
 * A clue earned by hearing it (gta-plan §17): the one call the bench scenes, Bay FM's bulletins and the jobs make.
 * Returns true when it is new. Never throws.
 */
export function grantClue(id: string, now: number = Date.now()): boolean {
  try {
    const state = loadTownJobs();
    if (hasClue(state, id)) return false;
    const next = grantClueTo(state, id, now);
    if (next === state) return false;
    const saved = saveJSON(KEYS.townJobs, next);
    session = saved ? null : next;
    notify();
    return true;
  } catch {
    return false;
  }
}
