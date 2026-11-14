// What "Thị trấn" remembers about THIS browser only (KEYS.townUi, device-local: never synced, never in a backup):
// whether its sound effects are on (default on) and whether the welcome bubble was closed.

import { useSyncExternalStore } from 'react';
import { KEYS, loadJSON, onAppWrite, saveJSON } from '../../core/storage';

export interface TownUi {
  sound: boolean;
  welcomed: boolean;
}

export const DEFAULT_TOWN_UI: TownUi = { sound: true, welcomed: false };

/** Anything stored → a well-formed value (unknown fields dropped, wrong types back to the default). */
export function parseTownUi(raw: unknown): TownUi {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_TOWN_UI };
  const r = raw as Record<string, unknown>;
  return { sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_TOWN_UI.sound, welcomed: r.welcomed === true };
}

let cache: TownUi | null = null;
const listeners = new Set<() => void>();

function read(): TownUi {
  if (!cache) cache = parseTownUi(loadJSON<unknown>(KEYS.townUi, null));
  return cache;
}

export function getTownUi(): TownUi {
  return read();
}

export function setTownUi(patch: Partial<TownUi>): void {
  cache = { ...read(), ...patch };
  // a blocked storage keeps the choice for this session (the cache)
  saveJSON(KEYS.townUi, cache);
  for (const fn of [...listeners]) fn();
}

let hooked = false;
function subscribe(fn: () => void): () => void {
  if (!hooked) {
    hooked = true;
    // "Xóa dữ liệu" removes the key outside setTownUi
    onAppWrite((key) => {
      if (key !== '*') return;
      cache = null;
      for (const l of [...listeners]) l();
    });
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTownUi(): TownUi {
  return useSyncExternalStore(subscribe, read, read);
}

/** For tests. */
export function _resetTownUi(): void {
  cache = null;
}
