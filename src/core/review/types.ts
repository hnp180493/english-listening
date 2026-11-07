// Data model of the review layer ("Ôn tập"), docs/review-system.md §1.

import type { CardState, Grade } from '../srs';

export type { CardState, Grade };

export type ReviewKind = 'dict' | 'pair' | 'lesson' | 'media' | 'chunk' | 'word';
/** Kinds stored in KEYS.review. 'chunk' is virtual (state lives in the drill store). */
export type StoredKind = Exclude<ReviewKind, 'chunk'>;
/**
 * '<kind>:<ref>' — dict:s012, dict:u-lx3k9, pair:can-cant, lesson:linking, media:m1abc2:14, chunk:gonna,
 * word:colonel~KER-nəl (core/review/words wordRef: normalised word + '~' + respelling key).
 */
export type CardId = `${ReviewKind}:${string}`;

export type ReviewContext = 'practice' | 'review';

/** SM-2 state (CardState.id === the full CardId) + time of the last change. */
export interface ReviewCard extends CardState {
  last: number; // epoch ms of the last change, monotonic per card; 0 = reconciled, never graded
  suspended?: true; // learner chose "Không ôn mục này nữa"; never served, never graded
  born?: number; // epoch ms the card was created (lineage for the sync merge); absent on cards from before it existed
  seenAt?: number; // device time the learner last met the item (grade, enrol); suspend toggles keep it. Absent → `last`
}

export interface ReviewDaily {
  day: string; // local 'YYYY-MM-DD' (core/stats localDay)
  ids: CardId[]; // distinct items graded in context 'review' today (incl. chunk:…), in order
  exempt: CardId[]; // the ids above that were already touched today when graded: they do not spend the budget
  extraSec: number; // extra budget unlocked today with "Ôn thêm" (multiple of EXTRA_STEP_SEC)
  enrolled: number; // budgeted new cards enrolled today (counts against NEW_ENROL_PER_DAY)
  newWords?: number; // word cards answered for the first time today (WORD_NEW_PER_DAY); absent = 0
}

export interface SeedNotice {
  count: number; // cards created by reconcile that the learner has not been told about
  at: number; // epoch ms of the reconcile that last added to count
  words?: number; // of `count`, word cards (paced by WORD_NEW_PER_DAY, not SEED_PER_DAY); absent = 0
}

export interface ReviewStore {
  version: 1;
  cards: Record<string, ReviewCard>; // key = CardId of a StoredKind; never 'chunk:'
  daily: ReviewDaily;
  since: number; // epoch ms the review layer first wrote on any device (merge: min of values > 0); 0 = never
  notice: SeedNotice | null; // one-time "Đã xếp lịch ôn…" callout
  noticeSeenAt: number; // the callout is shown while notice.at > noticeSeenAt
}

/** One schedulable item, whatever its source (review store or drill store). */
export interface ReviewEntry {
  id: CardId; // the ONLY CardId of the entry. Never use state.id (for chunks it is the bare chunk id).
  kind: ReviewKind;
  ref: string; // id inside its module (sentence id, pair set id, lesson id, '<mediaItemId>:<unit>', chunk id)
  state: CardState;
  last?: number; // stored cards only
  seenAt?: number; // stored cards only: ReviewCard.seenAt
  availableAt: number; // precomputed (collectEntries)
  touchedToday: boolean; // changed today (budget-exempt)
  rank?: number; // word cards: teaching order (core/review/words WordSource.rank), orders new words of one day
}

export interface ReviewSummary {
  now: number;
  tracked: number; // entries (all kinds, suspended and retired excluded)
  due: number; // entries with availableAt <= now
  dueByKind: Record<ReviewKind, number>; // due now per kind (not budgeted)
  dueToday: number; // what today's sessions will serve: touched due + admitted fresh
  dueTodaySec: number; // KIND_SECONDS sum of those
  minutesToday: number; // dueTodaySec > 0 ? max(1, ceil(dueTodaySec / 60)) : 0
  heldBack: number; // graded items held back by the budget: the backlog that turns back-pressure on
  heldBackSec: number;
  deferred: number; // lessons over LESSON_PER_DAY and never-graded catch-up held by the budget (new words: wordsWaiting)
  wordsWaiting: number; // new words (never answered) waiting for a later day: not due items, never back-pressure
  newWordsLeft: number; // new words that may still start today (0 while anything is held back)
  backlogClears: boolean; // heldBackSec fits in the free budget of the next 7 days (forecast)
  reviewedToday: number; // daily.ids.length when daily.day is today, else 0
  budgetSec: number; // reviewMinutes * 60 + daily.extraSec
  spentSec: number; // KIND_SECONDS sum of daily.ids not in daily.exempt
  capLeftSec: number; // max(0, budgetSec - spentSec)
  enrolLeft: number; // heldBack > 0 ? 0 : max(0, NEW_ENROL_PER_DAY - daily.enrolled)
  suspended: number; // suspended stored cards whose content exists
  nextAt: number | null; // earliest availableAt strictly after now, null when nothing pending
}

export interface ReviewSnapshot {
  version: number; // bumps on every recompute
  now: number;
  store: ReviewStore;
  entries: ReviewEntry[]; // collectEntries(store, drill, catalog, now)
  summary: ReviewSummary;
}

export interface KindCount {
  tracked: number;
  due: number;
  learning: number; // interval < MATURE_DAYS
  mature: number; // interval >= MATURE_DAYS
}

export interface ForecastDay {
  day: string; // local 'YYYY-MM-DD'
  offset: number; // 0 = today (includes everything overdue), 1 = tomorrow, …
  count: number;
  seconds: number; // KIND_SECONDS sum
}

export type ApplyReason =
  | 'enrolled' // card created
  | 'graded' // scheduled by gradeAuto (success or learning step)
  | 'lapsed' // gradeAuto 'again' on a due card
  | 'pulled-in' // miss on a not-due card: due moved to tomorrow at the latest
  | 'skipped-not-due' // success on a not-due card: nothing changes
  | 'not-enrolled' // absent and enrol = false
  | 'over-budget' // absent, success, and no new-card budget left
  | 'suspended'; // card suspended: nothing changes

export interface ApplyResult {
  card: ReviewCard | null; // the card to store; null = nothing to write
  current: ReviewCard | null; // the card as it stands after the call (= card ?? prev ?? null)
  reason: ApplyReason;
  budgeted: boolean; // true when this enrolment counts against NEW_ENROL_PER_DAY
}
