// The heat of this visit (core/town/heat.ts): in memory only, shared by the jobs and the pill that shows it.
import { useSyncExternalStore } from 'react';

let heat = 0;
const listeners = new Set<() => void>();

export function getHeat(): number {
  return heat;
}

export function setHeat(next: number): void {
  if (next === heat) return;
  heat = next;
  listeners.forEach((fn) => fn());
}

export function useHeat(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getHeat,
    getHeat,
  );
}
