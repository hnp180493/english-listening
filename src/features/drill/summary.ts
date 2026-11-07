// Read-only drill summary for other pages (Home). Implemented by the drill module.

import { countDue } from '../../core/srs';
import type { Chunk } from '../../core/types';
import { CHUNKS } from '../../data/chunks';
import { sanitizeChunks } from './chunkData';
import { loadDrillStore, type DrillStore } from './drillStore';

export interface DrillSummary {
  due: number; // review cards due now
  newAvailable: number; // new cards still allowed today
  learned: number; // cards ever studied
  newIntroduced: number; // new cards introduced today
}

/** Extra new cards one "Học thêm" press unlocks. */
export const EXTRA_NEW = 5;

/**
 * New cards allowed today. While Ôn tập holds items back (`heldBack`), the daily quota drops to 0 and only
 * the explicit "Học thêm … thẻ mới" (`daily.extraNew`) counts (docs/review-system.md D9).
 */
export function newCardQuota(store: DrillStore, heldBack = false): number {
  return (heldBack ? 0 : store.newPerDay) + store.daily.extraNew;
}

/** `daily.extraNew` after one "Học thêm" press: EXTRA_NEW more cards always fit, whatever was studied already. */
export function extraAfterLearnMore(store: DrillStore, heldBack = false): number {
  const base = heldBack ? 0 : store.newPerDay;
  return Math.max(store.daily.extraNew, store.daily.newIntroduced - base) + EXTRA_NEW;
}

/** Pure part of {@link drillSummary}: counts only cards that still exist in `chunks`. */
export function computeDrillSummary(
  chunks: readonly Chunk[],
  store: DrillStore,
  now: number,
  heldBack = false,
): DrillSummary {
  const due = countDue(chunks, store.cards, now);
  let unseen = 0;
  let learned = 0;
  for (const c of chunks) {
    const s = store.cards[c.id];
    if (!s) unseen += 1;
    else if (s.reps > 0) learned += 1;
  }
  const room = Math.max(0, newCardQuota(store, heldBack) - store.daily.newIntroduced);
  return { due, newAvailable: Math.min(unseen, room), learned, newIntroduced: store.daily.newIntroduced };
}

let cachedChunks: Chunk[] | null = null;

export function drillSummary(now: number = Date.now(), heldBack = false): DrillSummary {
  try {
    cachedChunks ??= sanitizeChunks(CHUNKS);
    return computeDrillSummary(cachedChunks, loadDrillStore(now), now, heldBack);
  } catch {
    return { due: 0, newAvailable: 0, learned: 0, newIntroduced: 0 };
  }
}
