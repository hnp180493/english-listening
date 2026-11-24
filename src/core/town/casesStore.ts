// IO of "Vụ án ở thị trấn" (docs/town.md §17): KEYS.townCases (synced, ./cases), its hook, and the call that closes a
// chapter. Xu and the friendship of a closed case go to town-progress (./store commitTown).

import { useSyncExternalStore } from 'react';
import { KEYS, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { CASE_BOND, emptyTownCases, mergeTownCases, parseTownCases, solveChapter, type Stars, type TownCases } from './cases';
import type { TownCase } from './caseTypes';
import { addFriendPoints } from './friendship';
import { addEarned } from './progress';
import { commitTown, loadTownProgress, townDevice } from './store';

let session: TownCases | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownCases | null = null;
let cacheValue: TownCases = emptyTownCases();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.townCases);
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

/** The stored cases (plus this session's unsaved change after a failed save). Stable while nothing changed. */
export function loadTownCases(): TownCases {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownCases(parsed);
    cacheValue = session ? mergeTownCases(session, stored) : stored;
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
      if (key !== KEYS.townCases && key !== '*') return;
      if (key === '*') {
        session = null;
        cacheRaw = undefined;
      }
      notify();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.townCases) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Live cases; re-renders on every change (this tab, another tab, account sync). */
export function useTownCases(): TownCases {
  return useSyncExternalStore(subscribe, loadTownCases, loadTownCases);
}

export interface ChapterResult {
  /** Xu paid (0 when the chapter had been solved before). */
  xu: number;
  /** The case closed: friendship points its `friend` gained. */
  bond: number;
  closed: boolean;
}

/** A chapter is solved: written down once, its xu paid, the case's friendship when it closes. */
export function finishChapter(c: TownCase, chapter: number, stars: Stars, now: number = Date.now()): ChapterResult {
  const solved = solveChapter(loadTownCases(), c, chapter, stars, now);
  if (!solved.first) return { xu: 0, bond: 0, closed: false };
  const saved = saveJSON(KEYS.townCases, solved.cases);
  session = saved ? null : solved.cases;
  notify();
  const device = townDevice();
  let progress = addEarned(loadTownProgress(), device, solved.xu);
  let bond = 0;
  if (solved.closed) {
    const w = addFriendPoints(progress, c.friend, CASE_BOND, device);
    progress = w.progress;
    bond = w.points;
  }
  commitTown(progress, now);
  return { xu: solved.xu, bond, closed: solved.closed };
}
