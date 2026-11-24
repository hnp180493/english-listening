// IO of "Phụ quầy cà phê" (docs/town.md §16): KEYS.townCafe (synced, ./cafe), its hook, and the one call that ends a
// shift. Xu and Emma's friendship go to town-progress (./store commitTown).

import { useSyncExternalStore } from 'react';
import { KEYS, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { CAFE_BOND, emptyTownCafe, mergeTownCafe, parseTownCafe, recordShift, type Shift, type TownCafe } from './cafe';
import { addFriendPoints } from './friendship';
import { addEarned, townDay } from './progress';
import { commitTown, loadTownProgress, townDevice } from './store';

let session: TownCafe | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownCafe | null = null;
let cacheValue: TownCafe = emptyTownCafe();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.townCafe);
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

/** The stored café record (plus this session's unsaved change after a failed save). Stable while nothing changed. */
export function loadTownCafe(): TownCafe {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownCafe(parsed);
    cacheValue = session ? mergeTownCafe(session, stored) : stored;
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
      if (key !== KEYS.townCafe && key !== '*') return;
      if (key === '*') {
        session = null;
        cacheRaw = undefined;
      }
      notify();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.townCafe) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Live café record; re-renders on every change (this tab, another tab, account sync). */
export function useTownCafe(): TownCafe {
  return useSyncExternalStore(subscribe, loadTownCafe, loadTownCafe);
}

export interface ShiftResult {
  /** Xu paid (after the day's cap) and whether the cap is now reached. */
  xu: number;
  capped: boolean;
  record: boolean;
  /** Friendship points with Emma this shift added (0 when already paid today or too few served). */
  bond: number;
  saved: boolean;
}

const done = new WeakMap<Shift, ShiftResult>();

/** A shift is over: written down once (a second call returns the first result), its xu and friendship paid. */
export function finishShift(shift: Shift, now: number = Date.now()): ShiftResult {
  const again = done.get(shift);
  if (again) return again;
  const device = townDevice();
  const day = townDay(now);
  const pay = recordShift(loadTownCafe(), shift, day, device, now);
  const saved = saveJSON(KEYS.townCafe, pay.cafe);
  session = saved ? null : pay.cafe;
  notify();
  let progress = loadTownProgress();
  let bond = 0;
  if (pay.xu > 0) progress = addEarned(progress, device, pay.xu);
  if (pay.bond) {
    const w = addFriendPoints(progress, 'cafe', CAFE_BOND, device);
    progress = w.progress;
    bond = w.points;
  }
  const committed = progress !== loadTownProgress() ? commitTown(progress, now).saved : true;
  const result: ShiftResult = { xu: pay.xu, capped: pay.xu < Math.floor(shift.score / 30), record: pay.record, bond, saved: saved && committed };
  done.set(shift, result);
  return result;
}
