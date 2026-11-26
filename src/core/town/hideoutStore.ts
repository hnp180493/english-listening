// IO of the learner's hideout in Westbay (./hideout.ts; docs/town.md §29): KEYS.townHideout (synced), its hook,
// buying it through the town's xu store (./store buyTownItem: its cost goes into what was spent, like a garage
// vehicle), "Nằm nghỉ" (the heat of the visit to zero) and the tape of lines missed in jobs and at the dispatch office.

import { useSyncExternalStore } from 'react';
import { KEYS, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { readReviewStore } from '../review/api';
import { parseCardId } from '../review/ids';
import { HIDEOUT_ID } from '../../data/city/hideout';
import { canRest, emptyTownHideout, markBought, markRested, mergeTownHideout, ownsHideout, parseTownHideout, tapeOf, type TapeCard, type TownHideout } from './hideout';
import { buyTownItem, loadTownProgress, type TownBuyResult } from './store';

let session: TownHideout | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownHideout | null = null;
let cacheValue: TownHideout = emptyTownHideout();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.townHideout);
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

/** The stored record (plus this session's unsaved change after a failed save). Stable while nothing changed. */
export function loadTownHideout(): TownHideout {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownHideout(parsed);
    cacheValue = session ? mergeTownHideout(session, stored) : stored;
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
      if (key !== KEYS.townHideout && key !== KEYS.town && key !== '*') return;
      if (key === '*') {
        session = null;
        cacheRaw = undefined;
      }
      notify();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.townHideout || e.key === STORAGE_PREFIX + KEYS.town) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function save(next: TownHideout): boolean {
  const saved = saveJSON(KEYS.townHideout, next);
  session = saved ? null : next;
  notify();
  return saved;
}

/** Live hideout record; re-renders on every change (this tab, another tab, account sync). */
export function useTownHideout(): TownHideout {
  return useSyncExternalStore(subscribe, loadTownHideout, loadTownHideout);
}

/** Whether the learner owns it now (the town's `bought` list or this record). */
export function hideoutOwned(): boolean {
  return ownsHideout(loadTownProgress().bought, loadTownHideout());
}

/**
 * Buy it with xu: through the town's store (refused when short of xu: nothing written), then the time written here.
 * Bought on another machine already (the record says so): written here only, nothing spent again.
 */
export function buyHideout(now: number = Date.now()): TownBuyResult | { ok: true; already: true } {
  if (hideoutOwned()) {
    const s = loadTownHideout();
    if (s.bought === null) save(markBought(s, now));
    return { ok: true, already: true };
  }
  const r = buyTownItem(HIDEOUT_ID);
  if (r.ok) save(markBought(loadTownHideout(), now));
  return r;
}

/**
 * "Nằm nghỉ": once an hour of the game. True when taken (the page then calls the police's
 * features/town/streets/streetsStore coolDownAt and sets the heat of the visit to zero).
 */
export function restInHideout(now: number = Date.now()): boolean {
  const s = loadTownHideout();
  if (!canRest(hideoutOwned(), s, now)) return false;
  save(markRested(s, now));
  return true;
}

/** The review cards of the lines missed in jobs and at the dispatch office, the newest first (not suspended). */
export function hideoutTape(now: number = Date.now()): TapeCard[] {
  try {
    const cards = readReviewStore(now).cards;
    const out: TapeCard[] = [];
    for (const [id, c] of Object.entries(cards)) {
      if (c.suspended) continue;
      const p = parseCardId(id);
      if (!p || p.kind !== 'talk') continue;
      out.push({ ref: p.ref, added: c.born ?? c.seenAt ?? c.last, due: c.due });
    }
    return tapeOf(out);
  } catch {
    return [];
  }
}
