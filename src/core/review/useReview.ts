// React binding of the review snapshot (docs/review-system.md §4.2). Every hook instance shares the one
// snapshot cache in api.ts; the external triggers (other tabs, the clock) run while anything subscribes.

import { useEffect, useSyncExternalStore } from 'react';
import type { CardState } from '../srs';
import { STORAGE_PREFIX } from '../storage';
import { ensureReconciled, getReviewSnapshot, invalidateReview, isReviewInput, subscribeReview } from './api';
import { statesByRef } from './queue';
import type { ReviewKind, ReviewSnapshot } from './types';

const CLOCK_MS = 60_000;
/** Pseudo key for clock ticks: invalidates the snapshot, not the catalog. */
const CLOCK_KEY = 'clock';

let subscribers = 0;
let stopExternal: (() => void) | null = null;

function startExternal(): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null) {
      invalidateReview(Date.now());
      return;
    }
    if (!e.key.startsWith(STORAGE_PREFIX)) return;
    const key = e.key.slice(STORAGE_PREFIX.length);
    if (isReviewInput(key)) invalidateReview(Date.now(), key);
  };
  // Same logic as features/home/hooks useNow (core must not import features/home).
  const tick = () => invalidateReview(Date.now(), CLOCK_KEY);
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };
  const id = window.setInterval(tick, CLOCK_MS);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', tick);
  return () => {
    window.clearInterval(id);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', tick);
  };
}

function subscribe(fn: () => void): () => void {
  const unsubscribe = subscribeReview(fn);
  subscribers += 1;
  if (subscribers === 1) {
    stopExternal = startExternal();
    // The clock may have moved while nobody listened.
    invalidateReview(Date.now(), CLOCK_KEY);
  }
  return () => {
    unsubscribe();
    subscribers -= 1;
    if (subscribers === 0 && stopExternal) {
      stopExternal();
      stopExternal = null;
    }
  };
}

const getSnapshot = () => getReviewSnapshot();

/** The live review snapshot (store, entries, summary). Runs the once-per-page-load reconcile on mount. */
export function useReview(): ReviewSnapshot {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    ensureReconciled();
  }, []);
  return snapshot;
}

const statesCache = new WeakMap<ReviewSnapshot, Map<ReviewKind, Record<string, CardState>>>();

/** { ref: state } of one kind, memoised per snapshot (stable identity until the snapshot changes). */
export function statesOfKind(snapshot: ReviewSnapshot, kind: ReviewKind): Record<string, CardState> {
  let byKind = statesCache.get(snapshot);
  if (!byKind) {
    byKind = new Map();
    statesCache.set(snapshot, byKind);
  }
  let states = byKind.get(kind);
  if (!states) {
    states = statesByRef(snapshot.entries, kind);
    byKind.set(kind, states);
  }
  return states;
}
