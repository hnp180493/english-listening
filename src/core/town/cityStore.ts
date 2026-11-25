// IO of Westbay (docs/town.md §20): KEYS.townCity (synced, ./city), its hook, and the calls that write it. Xu and the
// friendship a scene gives go to town-progress (./store commitTown).

import { useSyncExternalStore } from 'react';
import { KEYS, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { CITY_OUTING_BOND, CITY_TIE_BOND, emptyTownCity, hearScene, mergeTownCity, parseTownCity, type CityPay, type CityResult, type TownCity } from './city';
import type { CityScene } from './cityTypes';
import { addFriendPoints } from './friendship';
import { addEarned, townDay, updateDaily } from './progress';
import { commitTown, loadTownProgress, townDevice } from './store';
import { TOWN_PLACES } from '../../data/town';

let session: TownCity | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownCity | null = null;
let cacheValue: TownCity = emptyTownCity();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.townCity);
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

/** The stored city (plus this session's unsaved change after a failed save). Stable while nothing changed. */
export function loadTownCity(): TownCity {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownCity(parsed);
    cacheValue = session ? mergeTownCity(session, stored) : stored;
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
      if (key !== KEYS.townCity && key !== '*') return;
      if (key === '*') {
        session = null;
        cacheRaw = undefined;
      }
      notify();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.townCity) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Live; re-renders on every change (this tab, another tab, account sync). */
export function useTownCity(): TownCity {
  return useSyncExternalStore(subscribe, loadTownCity, loadTownCity);
}

function write(next: TownCity): void {
  const saved = saveJSON(KEYS.townCity, next);
  session = saved ? null : next;
  notify();
}

/** The learner got off bus no. 9 in Westbay: remembered the first time. */
export function arriveInCity(now: number = Date.now()): void {
  const city = loadTownCity();
  if (city.first) return;
  write({ ...city, first: now });
}

const TOWN_IDS: ReadonlySet<string> = new Set(TOWN_PLACES.map((p) => p.id));

export interface CityEnd extends CityPay {
  /** Friendship points the town residents of the scene gained, by place id. */
  gained: Readonly<Record<string, number>>;
}

const done = new WeakMap<CityResult, CityEnd>();

/** The outings gone on today (their ids), from the day's list of things heard (town-progress `heard`). */
export function outingsToday(now: number = Date.now()): string[] {
  const bucket = loadTownProgress().daily[townDay(now)] ?? {};
  const out = new Set<string>();
  for (const c of Object.values(bucket)) for (const id of c.heard ?? []) if (id.startsWith('cx-')) out.add(id);
  return [...out];
}

/**
 * An outing with `partner` (a town place id) was heard to its end: written down, xu for what was understood the
 * first time, and the partner's friendship once a day for this outing.
 */
export function finishOuting(scene: CityScene, result: CityResult, partner: string, now: number = Date.now()): CityEnd {
  const again = done.get(result);
  if (again) return again;
  const heard = hearScene(loadTownCity(), scene, result, new Set<string>(), now);
  write(heard.city);
  const device = townDevice();
  const day = townDay(now);
  let progress = loadTownProgress();
  const before = progress;
  const gained: Record<string, number> = {};
  if (heard.pay.xu > 0) progress = addEarned(progress, device, heard.pay.xu);
  if (!outingsToday(now).includes(scene.id)) {
    progress = updateDaily(progress, day, device, (d) => ({ ...d, heard: [...(d.heard ?? []), scene.id] }), true);
    const w = addFriendPoints(progress, partner, CITY_OUTING_BOND, device);
    progress = w.progress;
    if (w.points > 0) gained[partner] = w.points;
  }
  if (progress !== before) commitTown(progress, now);
  const end: CityEnd = { ...heard.pay, gained };
  done.set(result, end);
  return end;
}

/**
 * A scene was heard to its end and its questions answered: written down, its xu paid, the friendship of the town
 * residents who spoke in it (the first time only). Calling it again with the same result object changes nothing.
 */
export function finishCityScene(scene: CityScene, result: CityResult, now: number = Date.now()): CityEnd {
  const again = done.get(result);
  if (again) return again;
  const heard = hearScene(loadTownCity(), scene, result, TOWN_IDS, now);
  write(heard.city);
  const device = townDevice();
  let progress = loadTownProgress();
  const before = progress;
  if (heard.pay.xu > 0) progress = addEarned(progress, device, heard.pay.xu);
  const gained: Record<string, number> = {};
  for (const id of heard.pay.bond) {
    const w = addFriendPoints(progress, id, CITY_TIE_BOND, device);
    progress = w.progress;
    if (w.points > 0) gained[id] = w.points;
  }
  if (progress !== before) commitTown(progress, now);
  const end: CityEnd = { ...heard.pay, gained };
  done.set(result, end);
  return end;
}
