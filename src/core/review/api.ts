// IO layer of the review system (docs/review-system.md §4.1): the module-facing API plus the one
// snapshot cache shared by every useReview() instance and getReviewSnapshot(). Not React.
//
// Write pattern (as stats.recordAttempt): base = stored (merged with sessionStore after a failed save) → apply →
// skip when nothing changed → save → keep the result in memory only when the save failed.

import { sanitizeProgress as sanitizeDictation } from '../dictation/progress';
import { loadLessonProgress } from '../lessons';
import { getSettings, sanitizeReviewMinutes } from '../settings';
import { grade as gradeManual, isDueToday, newCard, type Grade, type CardState } from '../srs';
import { noteReviewGrade } from '../history';
import { KEYS, loadJSON, onAppWrite, saveJSON } from '../storage';
import { mergeDrill, mergeReview } from '../syncMerge';
import { PAIR_SET_ITEMS } from '../../data/pairIndex';
import {
  applyGrade,
  loadDrillStore,
  parseDrillStore,
  rollDaily,
  saveDrillStore,
  type DrillStore,
} from '../../features/drill/drillStore';
import { sanitizeLibrary } from '../../features/media/library';
import { sanitizeProgress as sanitizePairs } from '../../features/pairs/game';
import { sanitizeState as sanitizeShadowing } from '../../features/shadowing/store';
import { invalidateCatalog, readCatalog, readCustomSentenceIds, staticContentIds } from './catalog';
import { NOTICE_MIN } from './constants';
import { makeCardId, parseCardId, STORED_KINDS } from './ids';
import { collectEntries, summarize } from './queue';
import { reconcileCards, reconcileWordCards, type ReconcileInput } from './reconcile';
import { applyReview, enrolSeenCard, resetCardState, seenToday, suspendCardState } from './schedule';
import {
  parseReviewStore,
  rollReviewDaily,
  storesEqual,
  withCard,
  withEnrolled,
  withExtra,
  withNewWord,
  withReviewed,
  withSince,
} from './store';
import type { ApplyResult, CardId, ReviewContext, ReviewSnapshot, ReviewStore } from './types';
import { lessonWordMap } from './words';

/** Set only while the last review save failed: this session's store lives here. */
let sessionStore: ReviewStore | null = null;
/** Same for the drill store written by recordChunkReview. */
let drillSession: DrillStore | null = null;
/** Time of the first api call in this page load (becomes `since` on the first real write). */
let moduleSince = 0;
let reconciled = false;

const listeners = new Set<() => void>();

function touchSince(now: number): void {
  if (!moduleSince) moduleSince = now;
}

/**
 * The stored review data. After a failed save, the memory copy is merged with what is stored (another tab may have
 * saved since) with the sync merge rules, so the next successful save never drops the other tab's cards.
 */
export function readReviewStore(now: number = Date.now()): ReviewStore {
  const raw = loadJSON<unknown>(KEYS.review, null);
  if (!sessionStore) return rollReviewDaily(parseReviewStore(raw, now), now);
  if (raw === null) return rollReviewDaily(sessionStore, now);
  try {
    return rollReviewDaily(parseReviewStore(mergeReview(sessionStore, raw), now), now);
  } catch {
    return rollReviewDaily(sessionStore, now);
  }
}

function readDrill(now: number): DrillStore {
  if (!drillSession) return rollDaily(loadDrillStore(now), now);
  const raw = loadJSON<unknown>(KEYS.drill, null);
  if (raw === null) return rollDaily(drillSession, now);
  try {
    return rollDaily(parseDrillStore(mergeDrill(drillSession, raw), now), now);
  } catch {
    return rollDaily(drillSession, now);
  }
}

const KNOWN_KINDS = new Set<string>([...STORED_KINDS, 'chunk']);

/**
 * Cards of kinds this build does not know (written by a newer build): parseReviewStore drops them, so they are
 * copied from the stored value into every save unchanged. Ignored everywhere else.
 */
function foreignCards(): Record<string, unknown> {
  const raw = loadJSON<unknown>(KEYS.review, null);
  const cards = raw && typeof raw === 'object' ? (raw as { cards?: unknown }).cards : undefined;
  const out: Record<string, unknown> = {};
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) return out;
  for (const [key, v] of Object.entries(cards)) {
    const m = /^([a-z][a-z0-9-]*):./.exec(key);
    if (!m || KNOWN_KINDS.has(m[1]) || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    out[key] = v;
  }
  return out;
}

/** Save `next` unless it equals `base`. Returns true when something was written (or kept in memory). */
function write(base: ReviewStore, next: ReviewStore): { changed: boolean; saved: boolean } {
  if (storesEqual(base, next)) return { changed: false, saved: false };
  const foreign = foreignCards();
  const value = Object.keys(foreign).length ? { ...next, cards: { ...foreign, ...next.cards } } : next;
  const saved = saveJSON(KEYS.review, value); // notifies write listeners → snapshot invalidated
  sessionStore = saved ? null : next;
  if (!saved) invalidateReview(Date.now(), KEYS.review);
  return { changed: true, saved };
}

// ───────────────────────── snapshot cache ─────────────────────────

let cacheVersion = 0; // bumps on every invalidation
let cacheNow = Date.now(); // the clock reading stored by the last invalidation
let snapshotSeq = 0;
let cache: { version: number; now: number; snapshot: ReviewSnapshot } | null = null;
let writeHook: (() => void) | null = null;

const WATCHED = new Set<string>([KEYS.review, KEYS.drill, KEYS.customSentences, KEYS.media, KEYS.settings]);

/** True when a write to (or a storage event for) this short key changes the snapshot. */
export function isReviewInput(key: string): boolean {
  return WATCHED.has(key);
}

/** Inputs changed (or the clock moved): the next getReviewSnapshot() recomputes, subscribers are told. */
export function invalidateReview(now: number = Date.now(), key?: string): void {
  if (key === undefined || key === KEYS.customSentences || key === KEYS.media) invalidateCatalog();
  cacheVersion++;
  cacheNow = now;
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // a listener must never break a write
    }
  }
}

function ensureWriteHook(): void {
  writeHook ??= onAppWrite((key) => {
    if (isReviewInput(key)) invalidateReview(Date.now(), key);
  });
}

export function reviewBudgetSec(): number {
  return sanitizeReviewMinutes(getSettings().reviewMinutes) * 60;
}

/**
 * The shared snapshot. Without `now`: the cached one, recomputed only after an invalidation (never reads the
 * clock: safe as a useSyncExternalStore getSnapshot). With `now`: recomputed when `now` differs from the cache.
 */
export function getReviewSnapshot(now?: number): ReviewSnapshot {
  ensureWriteHook();
  if (cache && cache.version === cacheVersion && (now === undefined || cache.now === now)) return cache.snapshot;
  const t = now ?? cacheNow;
  const store = readReviewStore(t);
  const catalog = readCatalog();
  const entries = collectEntries(store, readDrill(t), catalog, t);
  const summary = summarize(entries, store, reviewBudgetSec(), t, catalog);
  const snapshot: ReviewSnapshot = {
    version: ++snapshotSeq,
    now: t,
    store,
    entries,
    summary,
  };
  cache = { version: cacheVersion, now: t, snapshot };
  return snapshot;
}

export function subscribeReview(fn: () => void): () => void {
  ensureWriteHook();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** After folder sync replaced the stored data: drop memory copies, reconcile again, recompute. */
export function reloadReview(): void {
  sessionStore = null;
  drillSession = null;
  reconciled = false;
  invalidateReview();
}

// ───────────────────────── reconcile ─────────────────────────

function readReconcileInput(): ReconcileInput {
  const s = staticContentIds();
  const custom = readCustomSentenceIds();
  const sentenceIds = new Set<string>([...s.builtinSentenceIds, ...custom]);
  const lib = sanitizeLibrary(loadJSON<unknown>(KEYS.media, null));
  const shadow = sanitizeShadowing(loadJSON<unknown>(KEYS.shadowing, {}));
  return {
    dictation: sanitizeDictation(loadJSON<unknown>(KEYS.dictation, {})),
    sentenceIds,
    pairs: sanitizePairs(loadJSON<unknown>(KEYS.pairs, null)),
    pairSets: PAIR_SET_ITEMS,
    lessons: loadLessonProgress(),
    lessonIds: s.lessonIds,
    media: lib.items.map((it) => ({
      itemId: it.id,
      unitCount: it.units.length,
      scores: it.progress.scores,
    })),
    shadowWeak: Object.entries(shadow)
      .filter(([id]) => s.builtinSentenceIds.has(id))
      .map(([id, item]) => ({ id, best: item.best })),
    lessonWords: lessonWordMap(),
  };
}

/** Once per page load: give every practised record that should have a card one (§3.7). */
export function ensureReconciled(now: number = Date.now(), exclude?: CardId): void {
  if (reconciled) return;
  reconciled = true;
  touchSince(now);
  try {
    const base = readReviewStore(now);
    const since = base.since || moduleSince;
    const r = reconcileCards(readReconcileInput(), base.cards, {
      since,
      now,
      exclude,
    });
    if (r.created + r.moved === 0) return;
    let next: ReviewStore = withSince({ ...base, cards: { ...base.cards, ...r.cards } }, moduleSince);
    if (r.created >= NOTICE_MIN) {
      const open = !!base.notice && base.notice.at > base.noticeSeenAt;
      const unseen = open ? (base.notice?.count ?? 0) : 0;
      const words = r.words + (open ? (base.notice?.words ?? 0) : 0);
      next = {
        ...next,
        notice: {
          count: r.created + unseen,
          at: now,
          ...(words > 0 ? { words } : {}),
        },
      };
    }
    write(base, next);
  } catch {
    // reconcile is best effort; the hooks keep enrolling new practice
  }
}

// ───────────────────────── writes ─────────────────────────

export interface RecordOptions {
  ctx: ReviewContext;
  enrol: boolean;
  firstGrade?: Grade;
  /** No miss although the grade is below 'good' (perfect small pair round): a budgeted enrolment. */
  success?: boolean;
  now?: number;
}

export interface RecordResult extends ApplyResult {
  saved: boolean;
}

const NOT_ENROLLED: RecordResult = {
  card: null,
  current: null,
  reason: 'not-enrolled',
  budgeted: false,
  saved: false,
};

/** Graduated: answered well at least once and scheduled a day or more ahead (srs isGraduated). */
function isGraduatedCard(c: CardState): boolean {
  return c.reps > 0 && c.interval >= 1;
}

/** Grade one answer of a stored kind (dict, pair, lesson, media). Never throws. */
export function recordReview(id: CardId, grade: Grade, opts: RecordOptions): RecordResult {
  try {
    const now = opts.now ?? Date.now();
    const p = parseCardId(id);
    if (!p || p.kind === 'chunk') return { ...NOT_ENROLLED };
    touchSince(now);
    ensureReconciled(now, id);
    const base = readReviewStore(now);
    const enrolLeft = getReviewSnapshot(now).summary.enrolLeft;
    const prev = base.cards[id];
    const r = applyReview(prev, id, grade, {
      ctx: opts.ctx,
      enrol: opts.enrol,
      firstGrade: opts.firstGrade,
      success: opts.success,
      enrolLeft,
      now,
    });
    let next = base;
    if (r.card) next = withCard(next, r.card);
    if (r.reason === 'enrolled' && r.budgeted) next = withEnrolled(next, now);
    // A word answered for the first time: a new item of today (shared new-item budget + new-word allowance).
    if (p.kind === 'word' && prev && prev.lastGrade === undefined && (r.reason === 'graded' || r.reason === 'lapsed')) {
      next = withNewWord(next, now);
    }
    // A lesson just passed: its words enter the schedule now (seeded like reconcile), not at the next page load.
    if (p.kind === 'lesson' && r.card) next = withLessonWords(next, p.ref, now);
    if (opts.ctx === 'review' && (r.reason === 'graded' || r.reason === 'lapsed')) {
      // Touched today before this grade (practice failure, learning step): served budget-exempt, spends nothing.
      next = withReviewed(next, id, now, !!prev && seenToday(prev, now));
    }
    next = withSince(next, moduleSince);
    const { saved } = write(base, next);
    if (r.reason === 'graded' || r.reason === 'lapsed') {
      // progress-report archive (core/history): retention on graduated cards, Ôn tập grades, words learned
      const wasGraduated = !!prev && isGraduatedCard(prev);
      noteReviewGrade(
        {
          grade,
          graduated: wasGraduated,
          inReview: opts.ctx === 'review',
          wordLearned: p.kind === 'word' && !wasGraduated && (prev?.lapses ?? 0) === 0 && !!r.card && isGraduatedCard(r.card),
        },
        now,
      );
    }
    return { ...r, saved };
  } catch {
    return { ...NOT_ENROLLED };
  }
}

/** Word cards of a passed lesson that have none yet (docs/review-system.md §13). Same store when nothing to add. */
function withLessonWords(store: ReviewStore, lessonId: string, now: number): ReviewStore {
  try {
    const r = reconcileWordCards({ lessons: loadLessonProgress(), lessonWords: lessonWordMap() }, store.cards, {
      now,
      lessonId,
    });
    return r.created > 0 ? { ...store, cards: { ...store.cards, ...r.cards } } : store;
  } catch {
    return store; // reconcile picks them up on the next page load
  }
}

/** An item practised badly outside grading (shadowing): enrol without a grade. True when a card was created. */
export function enrolSeen(id: CardId, now: number = Date.now()): boolean {
  try {
    const p = parseCardId(id);
    if (!p || p.kind === 'chunk') return false;
    touchSince(now);
    ensureReconciled(now, id);
    const base = readReviewStore(now);
    const card = enrolSeenCard(base.cards[id], id, now);
    let next = card ? withCard(base, card) : base;
    next = withSince(next, moduleSince);
    write(base, next);
    return !!card;
  } catch {
    return false;
  }
}

/** Reset a card to new (custom sentence words changed). Only writes when a card exists. */
export function resetCard(id: CardId, now: number = Date.now()): boolean {
  try {
    const base = readReviewStore(now);
    const card = resetCardState(base.cards[id], id, now);
    if (!card) return false;
    touchSince(now);
    write(base, withSince(withCard(base, card), moduleSince));
    return true;
  } catch {
    return false;
  }
}

export interface ChunkReviewResult {
  state: CardState | null;
  graded: boolean;
  saved: boolean;
}

/** Grade a chunk in Ôn tập with the drill's manual SM-2 (drill store), and count it as reviewed today. */
export function recordChunkReview(chunkId: string, g: Grade, now: number = Date.now()): ChunkReviewResult {
  try {
    touchSince(now);
    const base = readDrill(now);
    const prev = base.cards[chunkId];
    if (prev && !isDueToday(prev, now) && prev.interval >= 1 && g !== 'again') {
      return { state: prev, graded: false, saved: false };
    }
    const exempt = base.daily.studiedIds.includes(chunkId); // studied today before this grade: budget-exempt
    const updated = gradeManual(prev ?? newCard(chunkId, now), g, now);
    const next = applyGrade(base, chunkId, updated, !prev, now);
    const saved = saveDrillStore(next);
    drillSession = saved ? null : next;
    if (!saved) invalidateReview(now, KEYS.drill);
    const rb = readReviewStore(now);
    write(rb, withSince(withReviewed(rb, makeCardId('chunk', chunkId), now, exempt), moduleSince));
    noteReviewGrade({ grade: g, graduated: !!prev && isGraduatedCard(prev), inReview: true }, now);
    return { state: updated, graded: true, saved };
  } catch {
    return { state: null, graded: false, saved: false };
  }
}

/** "Ôn thêm 5 phút". True when the budget changed. */
export function unlockExtra(now: number = Date.now()): boolean {
  try {
    const base = readReviewStore(now);
    return write(base, withExtra(base, now)).changed;
  } catch {
    return false;
  }
}

/** "Không ôn mục này nữa" (on) / undo (off). False for chunk ids (not supported) and no-ops. */
export function suspendCard(id: CardId, on: boolean, now: number = Date.now()): boolean {
  try {
    const p = parseCardId(id);
    if (!p || p.kind === 'chunk') return false;
    const base = readReviewStore(now);
    const card = suspendCardState(base.cards[id], on, now);
    if (!card) return false;
    return write(base, withCard(base, card)).changed;
  } catch {
    return false;
  }
}

/** Resume every suspended card. Returns how many changed. */
export function unsuspendAll(now: number = Date.now()): number {
  try {
    const base = readReviewStore(now);
    let next = base;
    let n = 0;
    for (const c of Object.values(base.cards)) {
      const card = suspendCardState(c, false, now);
      if (!card) continue;
      next = withCard(next, card);
      n++;
    }
    if (n) write(base, next);
    return n;
  } catch {
    return 0;
  }
}

/** The learner closed the "Đã xếp lịch ôn…" callout. */
export function dismissSeedNotice(now: number = Date.now()): void {
  try {
    const base = readReviewStore(now);
    if (!base.notice || base.notice.at <= base.noticeSeenAt) return;
    write(base, { ...base, noticeSeenAt: Math.max(now, base.notice.at) });
  } catch {
    // ignore
  }
}
