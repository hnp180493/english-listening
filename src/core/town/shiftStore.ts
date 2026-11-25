// IO of "Ca làm việc" in Westbay (./shift): KEYS.townShifts (synced), its hook, and the one call that ends a run.
// Xu go to town-progress (./store commitTown), as the café's do (./cafeStore).

import { useSyncExternalStore } from 'react';
import { KEYS, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { emptyTownShifts, mergeTownShifts, parseTownShifts, recordRun, type ShiftRun, type TownShifts } from './shift';
import { addEarned, townDay } from './progress';
import { commitTown, loadTownProgress, townDevice } from './store';

let session: TownShifts | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownShifts | null = null;
let cacheValue: TownShifts = emptyTownShifts();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.townShifts);
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

/** The stored shifts record (plus this session's unsaved change after a failed save). Stable while nothing changed. */
export function loadTownShifts(): TownShifts {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownShifts(parsed);
    cacheValue = session ? mergeTownShifts(session, stored) : stored;
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
      if (key !== KEYS.townShifts && key !== '*') return;
      if (key === '*') {
        session = null;
        cacheRaw = undefined;
      }
      notify();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.townShifts) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Live shifts record; re-renders on every change (this tab, another tab, account sync). */
export function useTownShifts(): TownShifts {
  return useSyncExternalStore(subscribe, loadTownShifts, loadTownShifts);
}

export interface ShiftResult {
  /** Xu paid (after the day's cap) and whether the cap took some. */
  xu: number;
  capped: boolean;
  record: boolean;
  saved: boolean;
}

const done = new WeakMap<ShiftRun, ShiftResult>();

/** A run is over: written down once (a second call returns the first result), its xu paid into town-progress. */
export function finishShift(run: ShiftRun, now: number = Date.now()): ShiftResult {
  const again = done.get(run);
  if (again) return again;
  const device = townDevice();
  const pay = recordRun(loadTownShifts(), run, townDay(now), device, now);
  const saved = saveJSON(KEYS.townShifts, pay.state);
  session = saved ? null : pay.state;
  notify();
  const committed = pay.xu > 0 ? commitTown(addEarned(loadTownProgress(), device, pay.xu), now).saved : true;
  const result: ShiftResult = { xu: pay.xu, capped: pay.capped, record: pay.record, saved: saved && committed };
  done.set(run, result);
  return result;
}
