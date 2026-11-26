// What the streets of Westbay have going on, for the page (docs/town.md §28): the search (the patrol), the scanner's
// last bulletin, a stop by the police. In memory only, like the heat (../jobs/heatStore.ts): a reload forgets it.
// `coolDownAt(placeId)` is for a place where the learner lies low (the hideout of another session calls it).

import { useSyncExternalStore } from 'react';
import type { Offence, Search } from '../../../core/town/police';
import type { ScanFacts, ScanLine } from '../../../core/town/scanner';
import { getHeat } from '../jobs/heatStore';

export interface Bulletin {
  id: number;
  lines: readonly ScanLine[];
  /** When it came (ms). */
  at: number;
  /** A job's lines: said even while a panel is over the stage, and the pill opens for them. */
  force?: boolean;
  open?: boolean;
}

export interface Stop {
  id: number;
  facts: ScanFacts;
  /** The heat when stopped (the fine depends on it). */
  heat: number;
}

interface Controller {
  coolDown: () => void;
}

interface State {
  search: Search | null;
  bulletin: Bulletin | null;
  stop: Stop | null;
  /** The last offence (for the page's toast). */
  offence: { kind: Offence; at: number } | null;
  /** A job's patrol is driving (./jobPolice.ts). */
  jobPatrol: boolean;
}

let state: State = { search: null, bulletin: null, stop: null, offence: null, jobPatrol: false };
const waiting = new Map<number, () => void>();
let controller: Controller | null = null;
let ids = 0;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

export const streets = {
  attach(c: Controller): void {
    controller = c;
  },
  detach(c: Controller): void {
    if (controller === c) controller = null;
  },
  /** Westbay's streets layer is running (a job's patrol can drive). */
  hasWorld: (): boolean => controller !== null,
  setJobPatrol(on: boolean): void {
    if (state.jobPatrol !== on) set({ jobPatrol: on });
  },
  /** A bulletin of a job: resolves once the pill has said it, or after a while when it cannot (no sound, no pill). */
  say(lines: readonly ScanLine[], opts: { force?: boolean; open?: boolean } = {}): Promise<void> {
    const id = ++ids;
    set({ bulletin: { id, lines, at: Date.now(), ...opts } });
    return new Promise((resolve) => {
      const done = () => {
        window.clearTimeout(timer);
        waiting.delete(id);
        resolve();
      };
      const timer = window.setTimeout(done, 3000 + lines.length * 6000);
      waiting.set(id, done);
    });
  },
  /** The pill has said a bulletin. */
  spoken(id: number): void {
    waiting.get(id)?.();
  },
  search: (): Search | null => state.search,
  lastBulletin: (): Bulletin | null => state.bulletin,
  stopNow: (): Stop | null => state.stop,
  setSearch(s: Search | null): void {
    // (a step of the patrol every frame: listeners hear only when a search begins or ends)
    const was = !!state.search;
    state = { ...state, search: s };
    if (was !== !!s) listeners.forEach((fn) => fn());
  },
  bulletin(lines: readonly ScanLine[]): void {
    if (lines.length > 0) set({ bulletin: { id: ++ids, lines, at: Date.now() } });
  },
  noteOffence(kind: Offence): void {
    set({ offence: { kind, at: Date.now() } });
  },
  gotAway(): void {
    set({ search: null });
  },
  caught(s: Search, facts: ScanFacts): void {
    set({ search: null, stop: { id: ++ids, facts: { ...facts, offence: s.offence, thing: s.thing }, heat: getHeat() } });
  },
  endStop(): void {
    set({ stop: null });
  },
};

/** Lie low at a place (a hideout): the search is called off and the heat is gone. Nothing happens outside Westbay. */
export function coolDownAt(placeId: string): void {
  void placeId;
  controller?.coolDown();
}

export function useStreets(): State {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state,
  );
}

/** Tests and a page leaving: everything back to nothing. */
export function resetStreets(): void {
  state = { search: null, bulletin: null, stop: null, offence: null, jobPatrol: false };
  listeners.forEach((fn) => fn());
}
