// The next session of Ôn tập from a snapshot: its cards and how long it takes. ONE source for every place that
// names a session: the start card of Ôn tập (ReviewPage StartView) and the farm of "Thị trấn" (its "Thu hoạch"
// button opens exactly this session), so the two never say different numbers (docs/town.md §10 "Nông trại").
//
// The queue respects the review budget (Settings → Ôn tập, reviewBudgetSec): when today's cards (summary.dueToday)
// do not fit one session, the session is a part of them (`split`), and its minutes are the session's own.

import { sanitizeCustom } from '../../core/dictation/custom';
import { buildReviewQueue, estimateMinutes, reviewBudgetSec, type CardId, type ReviewSnapshot } from '../../core/review';
import { localDay } from '../../core/stats';
import { KEYS, loadJSON } from '../../core/storage';
import { annotationCount } from '../dictation/decodeCache';
import { sanitizeLibrary } from '../media/library';
import { createResolver, type Resolver } from './resolve';

/** Ids skipped today ("Bỏ qua"): served last. Cleared when the local day changes. */
const later = new Set<CardId>();
let laterDay = '';

export function laterSet(now: number): Set<CardId> {
  const d = localDay(now);
  if (d !== laterDay) {
    later.clear();
    laterDay = d;
  }
  return later;
}

export function readResolver(): Resolver {
  let customs: ReturnType<typeof sanitizeCustom> = [];
  let media: ReturnType<typeof sanitizeLibrary>['items'] = [];
  try {
    customs = sanitizeCustom(loadJSON<unknown>(KEYS.customSentences, []), annotationCount);
  } catch {
    // unreadable: custom sentences are skipped
  }
  try {
    media = sanitizeLibrary(loadJSON<unknown>(KEYS.media, null)).items;
  } catch {
    // unreadable: video lines are skipped
  }
  return createResolver({ customs, media });
}

let resolverCache: { version: number; resolver: Resolver } | null = null;

/** Resolver for a snapshot version (custom sentences and the media library are snapshot inputs). */
export function resolverFor(version: number): Resolver {
  if (!resolverCache || resolverCache.version !== version) resolverCache = { version, resolver: readResolver() };
  return resolverCache.resolver;
}

/** Today's next session from a snapshot, without items the page cannot render (they never count). */
export function queueFrom(snap: ReviewSnapshot, resolver: Pick<Resolver, 'resolve' | 'phenomenonOf'>): CardId[] {
  const usable = snap.entries.filter((e) => resolver.resolve(e.id) !== null);
  return buildReviewQueue(usable, snap.store, reviewBudgetSec(), snap.now, {
    later: laterSet(snap.now),
    phenomenonOf: resolver.phenomenonOf,
  });
}

export interface SessionSize {
  /** Cards of the session. */
  size: number;
  /** Today's cards (summary.dueToday: the nav badge's number). */
  dueToday: number;
  /** The session is only a part of today's cards (it is then named "Phiên này"). */
  split: boolean;
  /** The minutes shown for it: the session's own when split, else today's (summary.minutesToday). */
  minutes: number;
}

/** The size and minutes of a session `queue` of `snap` (the rule of Ôn tập's start card). */
export function sessionSize(snap: Pick<ReviewSnapshot, 'summary'>, queue: readonly CardId[]): SessionSize {
  const dueToday = snap.summary.dueToday;
  const today = dueToday > 0;
  const split = today && queue.length < dueToday;
  const minutes = split ? estimateMinutes(queue) : today ? snap.summary.minutesToday : estimateMinutes(queue);
  return { size: queue.length, dueToday, split, minutes };
}

/** The session Ôn tập would start now from `snap`, with its size and minutes. */
export function nextSessionPlan(snap: ReviewSnapshot): SessionSize & { queue: CardId[] } {
  const queue = queueFrom(snap, resolverFor(snap.version));
  return { queue, ...sessionSize(snap, queue) };
}
