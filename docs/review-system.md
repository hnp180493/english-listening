# Ôn tập: one spaced-repetition review system for the whole app

Status: implementation spec, revision 2 (architect). Audience: the CORE, UI, HOOKS-A, HOOKS-B and SURFACES agents.
The user's complaint: "đã apply space repetition chưa, học xong không ôn lại cũng như không". Only "Cụm từ" has SM-2
today. Everything else is learned once and never comes back. This spec adds one review layer: every module where it
makes sense enrols what the learner practised, schedules it with an SM-2 variant tuned for auto-grading, and serves due
items in one daily mixed session, **Ôn tập** (`#/review`), budgeted in minutes.

Read `docs/design-system.md` before any UI work. All copy is Vietnamese, short, casual-neutral ("bạn"). No emoji.

Revision 2 addresses the critic review: auto-grading that grows intervals (`gradeAuto`), a new-card budget and
back-pressure, time budgets instead of item caps, error-count dictation grading, softer lapses, one card per pair set,
embedded components, visible scheduling, idempotent reconcile instead of one-shot seeding, no-op writes skipped,
monotonic `last`, grading once per session position, import-cycle rules, and the full export list per group. Findings
that were rejected or only partly accepted are listed in §12.

---

## 0. Key decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Kinds: `dict`, `pair`, `lesson`, `media`, `chunk`. No separate `custom` kind: custom dictation sentences are `dict:<u-…id>`. | Dictation progress keeps built-in and custom ids in one map; same exercise, same grading. Deleted custom sentences become orphans (§3.8). |
| D2 | **No `shadow` kind.** Shadowing a built-in sentence badly (score < 0.7) only *enrols* `dict:<id>` and never grades it. | Shadowing needs a mic, a quiet room and speech recognition (missing on Firefox). What shadowing practises is reviewed by `dict` and `chunk`. |
| D3 | **`media` kind, served as TTS dictation of the transcript line**, enrolled **only for imperfect lines**. | The real audio is not usable offline. Perfect lines are not enrolled, so a whole video cannot flood the queue. |
| D4 | Chunks stay in the drill store (`KEYS.drill`, no data migration). Ôn tập reads them as virtual `chunk:<id>` entries and grades them with the unchanged manual `srs.grade` + `applyGrade`. | As required. The drill page keeps working unchanged. |
| D5 | **Calendar-day due for graduated cards.** For review-store cards, `gradeAuto` sets `due = startOfLocalDay(now, interval)` (DST-safe). `availableAt(card)` = local midnight of the due day for `interval >= 1`, the exact time for learning cards. The drill page keeps its exact-time `isDue`. | A 1-day card reviewed at 21:00 is doable the next morning; no DST skips. |
| D6 | **Auto-graded kinds use `gradeAuto`** (§3.4), not `srs.grade`. `hard` always grows the interval, a lapse keeps 25% of the interval and comes back tomorrow, overdue recall gets credit. Drill chunks keep the manual `srs.grade`. | Auto-grades are noisier than a learner's own button. With `srs.grade`, `hard` traps cards (interval 1 → 1, learning → +10 min forever). |
| D7 | Outside a due review, only a miss counts: a miss on a not-due card **pulls its due date in** to tomorrow at the latest (no lapse). The rule also applies to ctx `review` when the card is not due (another tab, a requeued item). Never-graded cards and retired lessons count as due. In practice context a learning step is never shorter than **1 hour**. | No cramming inflation, no double grading across surfaces, and one slip does not wipe a mature card. |
| D8 | **Time budget.** Ôn tập serves at most `reviewMinutes` (setting 5/10/15/20, default 10) of fresh due items per day, estimated with `KIND_SECONDS`. "Ôn thêm" adds 5 min. Items touched today are exempt. A session is about 5 min (at least 5 items). The budget is applied when the queue is built; stored due dates are never rewritten. | Items differ about 6× in cost; the learner should be able to predict the effort. Rewriting due dates would fight sync merges. |
| D9 | **New-card budget + back-pressure.** At most `NEW_ENROL_PER_DAY` = 10 (tuned from 15, §2) *successful* first answers enrol per day (failures always enrol; lessons are exempt). While anything is held back (`heldBack > 0`), no successful answer enrols, Home swaps new-learning lines for "Ôn trước, học mới sau" and the drill page's new-card quota drops to 0. | Without a budget about 30 new cards/day enter review and the backlog grows forever. |
| D10 | Session order: short same-kind blocks of 3, tap kinds (pair, chunk, lesson) first, typing kinds (dict, media) after, consecutive items differ in phenomenon when possible. At most 2 lessons per session, 4 per day. The session starts with "Bắt đầu ôn". | The keyboard stays up during a typing block; the start button gives the gesture TTS autoplay needs. |
| D11 | Review attempts are recorded in stats under the **original module** (`dictation`, `pairs`, `lesson`, `drill`, `media`). No new `ModuleId`. | `goals.cleanAttempts` drops unknown modules. Home reads today's review count from the review store. |
| D12 | Dictation "Ôn câu sai" becomes **"Ôn đến hạn"** (due `dict` cards, level/focus filtered, not capped by the daily budget, with a muted note). Pairs "Ôn câu hay sai" becomes **"Luyện câu hay sai"**. | One notion of "ôn" = spaced review. |
| D13 | **Pairs: one card per contrast set**, `pair:<setId>` (16 cards). A review is a 4-question mini round from that set, weighted to the learner's weak items. Enrol on a miss, or once the set has ≥ 20 first answers. | A single two-choice answer is a coin flip. Discrimination is a per-contrast skill. |
| D14 | Lessons: enrol on a pass (≥ 70%) with a first interval of 1 day. Review = 4 questions, listening types first. A lesson is never requeued in a session. Lesson cards **retire** at `interval >= MATURE_DAYS` (21 d): they stay stored but leave Ôn tập. | The quiz is memorised quickly; dict and pair cards carry the skill after that. |
| D15 | **Reconcile, not one-shot seeding.** On every page load (once) and inside the first write, every progress record that should have a card and does not gets one from a template, spread at most 12 per day. Non-weak records practised after `since` (the time the review layer first ran on any device) are skipped: those were handled by the hooks, possibly declined by the budget. | Per-device history, late folder sync and old-build devices otherwise leave practised items that never come back. |
| D16 | Orphans (content gone) are never deleted, only ignored. A learner can **suspend** an item ("Không ôn mục này nữa"). A custom sentence whose words changed is reset, only if it has a card. | Deleting would come back after a sync union (no tombstones). Suspension is a per-card field that follows the card's merge. |
| D17 | **No-op writes are skipped.** Any review write path saves only when something changed. `last` is monotonic per card (`max(now, prev.last + 1)`). | A brand-new browser must not look like it has data (folder-sync guard); a fast clock must not freeze a card. |
| D18 | **Word cards** (`word`, §13): one card per word + respelling of the `words` tables of passed lessons (irregular, loanwords; spelling rows with `review: true`). Seeded by reconcile, at most `WORD_NEW_PER_DAY` = 6 new words admitted a day, after everything else. Two modes: Nghe → nhận ra (auto-graded) and Đọc → nói (self-graded). | The lesson card re-asks 4 quiz items and retires at 21 days, so most words of a lesson never came back. The learner's weak skill is listening. |

---

## 1. Data model (`src/core/review/types.ts`)

```ts
import type { CardState, Grade } from '../srs';

export type ReviewKind = 'dict' | 'pair' | 'lesson' | 'media' | 'chunk' | 'word'; // 'word': §13
/** Kinds stored in KEYS.review. 'chunk' is virtual (state lives in the drill store). */
export type StoredKind = Exclude<ReviewKind, 'chunk'>;
/** '<kind>:<ref>' — dict:s012, dict:u-lx3k9, pair:can-cant, lesson:linking, media:m1abc2:14, chunk:gonna */
export type CardId = `${ReviewKind}:${string}`;

export type ReviewContext = 'practice' | 'review';

/** SM-2 state (CardState.id === the full CardId) + time of the last change. */
export interface ReviewCard extends CardState {
  last: number; // epoch ms of the last change, monotonic per card (§3.4 finish); 0 = reconciled, never graded
  suspended?: true; // learner chose "Không ôn mục này nữa"; never served, never graded
  born?: number; // epoch ms the card was created: its lineage for the sync merge (§9). Absent on older cards
  seenAt?: number; // device time the learner last met the item (grade, enrol). Suspend/reset keep it. Absent → `last`
}

export interface ReviewDaily {
  day: string; // local 'YYYY-MM-DD' (core/stats localDay)
  ids: CardId[]; // distinct items graded in context 'review' today (incl. chunk:…), in order
  exempt: CardId[]; // the ids above already touched today when graded: budget-exempt, they spend nothing
  extraSec: number; // extra budget unlocked today with "Ôn thêm" (multiple of EXTRA_STEP_SEC)
  enrolled: number; // budgeted new cards enrolled today (counts against NEW_ENROL_PER_DAY)
}

export interface SeedNotice {
  count: number; // cards created by reconcile that the learner has not been told about
  at: number; // epoch ms of the reconcile that last added to count
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
  seenAt?: number; // stored cards only (ReviewCard.seenAt)
  availableAt: number; // precomputed (§3.9 collectEntries)
  touchedToday: boolean; // changed today (budget-exempt)
}

export interface ReviewSummary {
  now: number;
  tracked: number; // entries (all kinds, suspended and retired excluded)
  due: number; // entries with availableAt <= now
  dueByKind: Record<ReviewKind, number>; // due now per kind (not budgeted)
  dueToday: number; // what today's sessions will serve: touched due + admitted fresh (§3.9 admitToday)
  dueTodaySec: number; // KIND_SECONDS sum of those
  minutesToday: number; // dueTodaySec > 0 ? max(1, ceil(dueTodaySec / 60)) : 0
  heldBack: number; // graded items held back by the budget: the backlog that turns back-pressure on (D9)
  heldBackSec: number;
  deferred: number; // due - dueToday - heldBack: lessons over LESSON_PER_DAY, never-graded catch-up over the budget
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
```

Storage key: `KEYS.review = 'review-cards'` (full key `nghe-noi-am:review-cards`). Backup export/import, clear-all and
folder sync enumerate keys by prefix, so they carry it automatically. Only `syncMerge.ts` needs a rule (§9).

`ReviewSnapshot` lives in `types.ts` so `api.ts` never imports the React module.

---

## 2. Constants (`src/core/review/constants.ts`; export them all)

| Name | Value | Meaning |
| --- | --- | --- |
| `REVIEW_MINUTES_OPTIONS` | `[5, 10, 15, 20]` | Setting choices ("Thời lượng ôn mỗi ngày"). |
| `DEFAULT_REVIEW_MINUTES` | 10 | Default daily budget. |
| `SESSION_SEC` | 300 | Target length of one session. |
| `MIN_SESSION_ITEMS` | 5 | A session takes at least this many items when available. |
| `MAX_SESSION_ITEMS` | 30 | Hard ceiling per session. |
| `EXTRA_STEP_SEC` | 300 | "Ôn thêm 5 phút" raises today's budget by this. |
| `NEW_ENROL_PER_DAY` | 10 | Budgeted (successful) new enrolments per local day. CORE tuned it from 15: the §10 simulation peaked at 55 held-back items with 15 (12: 35 and drifting up); 10 passes. |
| `PAIR_ENROL_ANSWERS` | 20 | A pair set with this many first answers enrols even without a miss (budgeted). |
| `LESSON_PER_SESSION` | 2 | Max lesson cards per session. |
| `LESSON_PER_DAY` | 4 | Max lesson cards admitted per day; the rest are held back. |
| `LESSON_REVIEW_SIZE` | 4 | Questions per lesson review. |
| `PAIR_REVIEW_SIZE` | 4 | Questions per pair-set review. |
| `INTERLEAVE_BLOCK` | 3 | Same-kind block length in a session. |
| `LEARN_AHEAD_MS` | 20 min | Learning cards due within this window fill a short session. |
| `PRACTICE_STEP_MS` | 1 h | Floor for a learning-step due date set in practice context. |
| `LAPSE_KEEP` | 0.25 | Fraction of the interval a lapse keeps. |
| `RECOVER_MULT` | 1.5 | Growth of a recovering card (last grade `again`) on `good`. |
| `AUTO_HARD_MIN_EASE` | 2.0 | An auto `hard` never pushes ease below this. |
| `SEED_PER_DAY` | 8 | Max reconciled (never graded) cards per day. Tuned from 12: with 12 a large migrated history kept back-pressure on for weeks (8 × 40 s ≈ half the default budget). |
| `NOTICE_MIN` | 5 | A reconcile run that creates at least this many cards raises the seed notice. |
| `KIND_ORDER` | `['dict','pair','chunk','lesson','media','word']` | Tie-break order. |
| `TAP_KINDS` / `TYPING_KINDS` | `['pair','chunk','word','lesson']` / `['dict','media']` | Session block order. |
| `KIND_LABEL` | dict 'Chép chính tả', pair 'Phân biệt âm', chunk 'Cụm từ', lesson 'Bài học', media 'Câu từ video', word 'Từ đã học' | UI labels. |
| `KIND_SHORT` | dict 'Câu', pair 'Nhóm âm', chunk 'Cụm từ', lesson 'Bài học', media 'Câu video', word 'Từ' ("12 từ") | Badge counts. |
| `KIND_ROUTE` | dict→'dictation', pair→'pairs', chunk→'drill', lesson→'lessons', media→'media', word→'lessons' | Icon/tint via `ROUTE_ICON`/`routeTint`. |
| `KIND_SECONDS` | dict 40, media 40, pair 45, chunk 12, lesson 75, word 15 | Time estimate per item. |
| `BUDGETED_KINDS` | `['dict','pair']` | Kinds whose successful enrolments count against `NEW_ENROL_PER_DAY` (media enrols only failures; lessons are exempt). |
| `WORD_NEW_PER_DAY` | 6 | New word cards (never answered) admitted per local day (§13.3). They also count against `NEW_ENROL_PER_DAY`. |

`core/settings.ts` (CORE) gains `reviewMinutes: number` (default `DEFAULT_REVIEW_MINUTES`; any value not in
`REVIEW_MINUTES_OPTIONS` reads as the default). `settings.ts` must import the constant from
`core/review/constants` (a leaf file with no imports), never the barrel.

---

## 3. Pure functions

All take `now` explicitly. Local days use `localDay` from `core/stats.ts`. Day arithmetic is DST-safe
(`new Date(y, m, d + k)`), never `+ k * DAY`. Pure modules must not touch `window` or storage.

### 3.1 `src/core/review/time.ts`

```ts
export function startOfLocalDay(ts: number, offsetDays = 0): number; // local midnight of ts's day, shifted
export function nextLocalMidnight(now: number): number; // = startOfLocalDay(now, 1)
export function localDayDiff(from: number, to: number): number; // calendar days between the two local days
export function formatDueVi(at: number, now: number): string;
export function formatDaysVi(days: number): string;
```

`formatDueVi` rules, in order:
1. `at <= now` → `'bây giờ'`
2. `at - now < 60 min` → `` `sau ${max(1, round(min))} phút` ``
3. same local day → `` `lúc ${HH}:${MM}` `` (24 h, zero-padded)
4. `d = localDayDiff(now, at)`: `d === 1` → `'ngày mai'`, else `` `sau ${formatDaysVi(d)}` ``.

`formatDaysVi(d)`: `d <= 6` → `` `${d} ngày` ``; `d <= 59` → `` `${round(d/7)} tuần` ``; else `` `${round(d/30)} tháng` ``
(minimum 1 in each unit).

### 3.2 `src/core/srs.ts` (generalised, source-compatible)

- `buildQueue<T extends QueueItem>(items: readonly T[], states, now, opts?): T[]` with
  `export interface QueueItem { id: string; rank?: number }`. A missing `rank` counts as 0. Behaviour unchanged for chunks.
- `countDue<T extends { id: string }>(…)`, `nextDue<T extends { id: string }>(…)`: same, generic.
- Add `availableAt(card: CardState): number`: `card.interval >= 1 ? startOfLocalDay(card.due) : card.due`. Import
  `startOfLocalDay` from `core/review/time` (no cycle: `time.ts` imports only `core/stats`).
- Add `isDueToday(card: CardState, now: number): boolean` = `availableAt(card) <= now`.
- `isDue`, `grade`, `previewIntervals`, `formatInterval`, `cardStatus` are unchanged. The drill page keeps using them.

### 3.3 `src/core/review/ids.ts`

```ts
export const REVIEW_KINDS: readonly ReviewKind[]; // KIND_ORDER
export const STORED_KINDS: readonly StoredKind[]; // dict, pair, lesson, media
export function makeCardId(kind: ReviewKind, ref: string): CardId;
/** null for unknown kinds, empty ref, ref > 200 chars, or '__proto__'/'constructor'/'prototype' as the whole key. */
export function parseCardId(id: string): { kind: ReviewKind; ref: string } | null; // splits on the FIRST ':'
export function mediaRef(itemId: string, unit: number): string; // `${itemId}:${unit}`
export function parseMediaRef(ref: string): { itemId: string; unit: number } | null; // LAST ':'; unit int >= 0
export function kindSeconds(id: CardId): number; // KIND_SECONDS of the parsed kind, 0 when unparsable
```

### 3.4 `src/core/review/schedule.ts` — the scheduling rules

```ts
/** SM-2 variant for auto-graded kinds. Pure; the input is not mutated. Never used for chunks. */
export function gradeAuto(card: CardState, g: Grade, now: number): CardState;

export interface ApplyOptions {
  ctx: ReviewContext;
  enrol: boolean; // create the card when absent
  firstGrade?: Grade; // grade used when the card is created (default: the given grade)
  enrolLeft: number; // remaining new-card budget (api passes summary.enrolLeft)
  now: number;
}
export function applyReview(prev: ReviewCard | undefined, id: CardId, g: Grade, o: ApplyOptions): ApplyResult;
export function isEffectivelyDue(prev: ReviewCard, kind: ReviewKind, now: number): boolean;
export function enrolSeenCard(prev: ReviewCard | undefined, id: CardId, now: number): ReviewCard | null;
export function resetCardState(prev: ReviewCard | undefined, id: CardId, now: number): ReviewCard | null;
export function suspendCardState(prev: ReviewCard | undefined, on: boolean, now: number): ReviewCard | null;
export function nextLast(prev: { last?: number } | undefined, now: number): number; // max(now, (prev?.last ?? 0) + 1)
```

**`gradeAuto`.** `graduated = card.reps > 0 && card.interval >= 1`. `day(n) = startOfLocalDay(now, n)`.
`clamp(d) = min(MAX_INTERVAL_DAYS, max(1, round(d)))`. Ease is rounded to 2 decimals. `lastGrade = g` always.

Not graduated (new or learning):

| grade | result |
| --- | --- |
| `again` | `interval 0, reps 0, due now + RELEARN_MS`; ease and lapses unchanged |
| `hard`, card never graded (`lastGrade === undefined`) | learning step: `interval 0, due now + HARD_LEARNING_MS` |
| `hard`, card graded before | **graduates**: `interval 1, reps 1, due day(1)`; ease unchanged |
| `good` | `interval 1, reps 1, due day(1)` |
| `easy` | `interval 4, reps 1, ease + 0.15, due day(4)` |

Graduated (`overdue = max(0, localDayDiff(card.due, now))`):

| grade | interval | other fields |
| --- | --- | --- |
| `again` (lapse) | `max(1, round(interval * LAPSE_KEEP))` | `reps 1, lapses + 1, ease max(MIN_EASE, ease − 0.15), due day(1)` |
| `hard` | `clamp(max(interval + 1, round(interval * 1.2)))` | `reps + 1`, ease: `ease > AUTO_HARD_MIN_EASE ? max(AUTO_HARD_MIN_EASE, ease − 0.05) : ease`, `due day(interval)` |
| `good` | `G` = `reps === 1 && interval < 3` → 3; else `lastGrade === 'again'` (recovering) → `clamp(max(interval + 1, interval * RECOVER_MULT))`; else `clamp(max(interval + 1, (interval + overdue / 2) * ease))` | `reps + 1, due day(G)` |
| `easy` | `clamp(max(G + 1, G * 1.3))` | `reps + 1, ease + 0.15, due day(interval)` |

**`isEffectivelyDue(prev, kind, now)`** = `isDueToday(prev, now) || prev.lastGrade === undefined ||
(kind === 'lesson' && prev.interval >= MATURE_DAYS)` (never-graded cards and retired lessons count as due).

**`applyReview` decision table.** `due` = `isEffectivelyDue(prev, kind, now)`. `learning` = `prev.interval === 0`.
`success` = grade (or `firstGrade` on enrol) is `good`/`easy`. `budgeted` = `success && BUDGETED_KINDS.includes(kind)`.

| prev | ctx | condition | grade | result | reason |
| --- | --- | --- | --- | --- | --- |
| absent | any | `enrol=false` | any | `null` | `not-enrolled` |
| absent | any | `enrol`, `budgeted`, `enrolLeft <= 0` | – | `null` | `over-budget` |
| absent | any | `enrol` otherwise | any | `finish(gradeAuto(newCard(id, now), firstGrade ?? g, now))`, `budgeted` reported | `enrolled` |
| suspended | any | – | any | `null` | `suspended` |
| present | `review` | `due \|\| learning` | `again` on a graduated card | `finish(gradeAuto(prev, g))` | `lapsed` |
| present | `review` | `due \|\| learning` | other | `finish(gradeAuto(prev, g))` | `graded` |
| present | `practice` | `due` | `again` on a graduated card | `finish(gradeAuto(prev, g))` | `lapsed` |
| present | `practice` | `due` | other | `finish(gradeAuto(prev, g))` | `graded` |
| present | any | otherwise (not due) | `again` | `due' = min(prev.due, nextLocalMidnight(now))`. If `due' < prev.due`: `finish({ ...prev, due: due', lastGrade: 'again' })`, else `null` | `pulled-in` |
| present | any | otherwise (not due) | `hard`/`good`/`easy` | `null` (nothing changes, not even `last`) | `skipped-not-due` |

`finish(c)` (applies to stored kinds only):
- `last = nextLast(prev, now)` (monotonic: a new write always beats the version it was built on).
- `ctx === 'practice' && c.interval === 0` → `due = max(c.due, now + PRACTICE_STEP_MS)`.
- `kind === 'lesson' && c.interval === 0` → `due = max(c.due, nextLocalMidnight(now))` (lessons never come back the
  same day; they are never requeued in a session).
- In review context the learning steps stay (again → 1 min, first hard → 10 min); the session requeues `again` items.

`current` is always `card ?? prev ?? null`.

`enrolSeenCard`: `null` when `prev` exists. Otherwise `{ ...newCard(id, now), due: nextLocalMidnight(now), last: now }`.
`resetCardState`: `null` when `prev` is absent. Otherwise `{ ...newCard(id, now), due: nextLocalMidnight(now),
last: nextLast(prev, now) }` (clears `suspended`). Used when a custom sentence's words change.
`suspendCardState`: `null` when `prev` is absent or already in the requested state; otherwise
`{ ...prev, suspended: true }` or the card without `suspended`, with `last = nextLast(prev, now)`.

### 3.5 `src/core/review/grading.ts` — auto-grading per kind

```ts
export interface DictationCheck {
  total: number; // AlignResult.total
  matched: number; // AlignResult.matched (typo matches count as matched)
  extra: number; // AlignResult.extra
  hinted: boolean;
  revealed: boolean; // "Chịu, xem đáp án"
  firstTry: boolean; // no dictation attempt for this id before this check
  kind: 'dict' | 'media';
}
export function dictationErrors(c: Pick<DictationCheck, 'total' | 'matched' | 'extra'>): number; // (total − matched) + extra
export function gradeDictation(c: DictationCheck): Grade;
export function gradePairSet(correct: number, total: number): Grade | null;
export function gradeLessonScore(score: number): Grade; // score 0..1
export type LessonItemType = 'listen-choose' | 'listen-type' | 'spot' | 'which-rule' | 'choose' | 'silent-letter';
export function lessonReviewItems(
  lessonId: string,
  types: readonly string[], // lesson.quiz.map(q => q.type)
  card: Pick<CardState, 'reps' | 'lapses'> | undefined,
): number[];
```

**Dictation** (`dict` and `media`). Non-finite or negative numbers count as 0. `errors = dictationErrors(c)`.

| Condition (first match wins) | Grade |
| --- | --- |
| `revealed` or `total <= 0` | `again` |
| `errors === 0 && !hinted && firstTry` | `easy` (first-ever attempt, perfect → 4 days) |
| `errors === 0 && !hinted` | `good` |
| `errors === 0 && hinted` | `hard` |
| `errors === 1 && total >= 4` | `hard` |
| `kind === 'media' && total > 12 && errors <= 2` | `hard` |
| otherwise | `again` |

In review context callers pass `firstTry: false`.

**Pair set** (`gradePairSet(correct, total)`, first answers only): `total <= 0` → `null`; `correct === total && total >= 4`
→ `good`; `correct === total` → `hard`; `total - correct === 1 && total >= 4` → `hard`; otherwise `again`.
A review round has 4 questions: 4/4 `good`, 3/4 `hard`, ≤ 2/4 `again` (guessing 4/4 ≈ 6%).

**Lesson** (the 8-question practice quiz and the 4-question review use the same function):

| score | Grade | 4-question review | 8-question quiz |
| --- | --- | --- | --- |
| `>= 0.9` | `good` | 4/4 | 8/8 |
| `>= 0.7` | `hard` | 3/4 | 6–7/8 |
| otherwise | `again` | ≤ 2/4 | ≤ 5/8 |

**Chunk**: manual. The learner presses one of DrillCard's 4 buttons (unchanged `srs.grade`).

`lessonReviewItems`: `listening` = indices whose type is `listen-choose`/`listen-type`/`spot`, or the generic token
`listen` (LessonItem passes it for every item `isListeningItem` accepts, which adds `choose` with `play`); `rule` = the
rest (`which-rule`, `choose` without `play`, `silent-letter`). Lessons of every course (docs/courses.md) enrol the same way.
`seed = (fnv1a(lessonId) ^ Math.imul((reps ?? 0) * 31 + (lapses ?? 0) * 7 + 1, 0x9e3779b1)) >>> 0`. Shuffle each pool
with mulberry32(seed) (Fisher–Yates, the same algorithm as `core/dictation/progress.shuffled`). If
`listening.length >= LESSON_REVIEW_SIZE`, return the first 4 of the shuffled listening pool. Otherwise return all
listening indices followed by shuffled `rule` indices up to 4 (fewer when the quiz is shorter). Deterministic; successive
reviews rotate. Keep a local `fnv1a`/mulberry32 copy so core does not import features.

### 3.6 `src/core/review/store.ts` — parse/sanitise + store transitions (pure)

```ts
export function emptyReviewStore(now: number): ReviewStore; // daily for today, since 0, notice null, noticeSeenAt 0
export function parseReviewStore(raw: unknown, now: number): ReviewStore; // never throws
export function rollReviewDaily(store: ReviewStore, now: number): ReviewStore; // new day → empty daily; same object if unchanged
export function withCard(store: ReviewStore, card: ReviewCard): ReviewStore;
export function withReviewed(store: ReviewStore, id: CardId, now: number): ReviewStore; // roll, append if absent
export function withEnrolled(store: ReviewStore, now: number): ReviewStore; // roll, enrolled + 1
export function withExtra(store: ReviewStore, now: number): ReviewStore; // roll, extraSec += EXTRA_STEP_SEC
export function withSince(store: ReviewStore, since: number): ReviewStore; // sets since when it is 0; same object otherwise
export function cardsOfKind(store: ReviewStore, kind: StoredKind): Record<string, ReviewCard>; // keyed by ref, orphans included
export function storesEqual(a: ReviewStore, b: ReviewStore): boolean; // cheap deep compare used to skip no-op saves
```

`parseReviewStore` sanitising:
- Cards: the key must pass `parseCardId` with a kind in `STORED_KINDS` (chunk keys are dropped). Numbers are clamped
  like `drillStore.sanitizeCard` (`due` defaults to now, `interval` 0..MAX_INTERVAL_DAYS, `ease` MIN_EASE..5,
  `reps`/`lapses` non-negative integers, `lastGrade` a valid Grade). `last`: finite ≥ 0, else 0 (raw value kept even
  when in the future: merge needs it). `suspended`: kept only when exactly `true`. `id` is overwritten with the key.
- `daily`: if `day !== localDay(now)` → empty for today. Otherwise `ids` are deduped strings passing `parseCardId`
  (any kind), `extraSec` and `enrolled` non-negative integers. A legacy `extra` field is ignored.
- `since`, `noticeSeenAt`: finite ≥ 0, else 0. `notice`: `{ count: int ≥ 0, at: finite ≥ 0 }` or null. `version` is 1.

### 3.7 `src/core/review/reconcile.ts` — idempotent enrolment of existing history

```ts
export interface ReconcileInput {
  dictation: ProgressMap; // core/dictation/progress.sanitizeProgress
  sentenceIds: ReadonlySet<string>; // built-in ids + custom ids that exist now
  pairs: PairsProgress; // features/pairs/game.sanitizeProgress
  pairSets: Readonly<Record<string, readonly string[]>>; // data/pairIndex PAIR_SET_ITEMS
  lessons: LessonProgress; // core/lessons.loadLessonProgress()
  lessonIds: ReadonlySet<string>; // LESSONS with quiz.length > 0
  media: { itemId: string; unitCount: number; scores: Record<number, number> }[]; // saved (not session-only) items
  shadowWeak: { id: string; best: number }[]; // shadowing history ids that are built-in sentence ids
}
export interface ReconcileOptions { since: number; now: number; exclude?: CardId }
export interface ReconcileResult {
  cards: Record<string, ReviewCard>; // only new or re-spread cards
  created: number;
  moved: number;
}
export function reconcileCards(input: ReconcileInput, existing: Readonly<Record<string, ReviewCard>>, o: ReconcileOptions): ReconcileResult;
```

Invariant the hooks maintain: every record that the rules below mark **always** has a card. Reconcile restores it for
history from before the review layer, from another device, or from an older build. Candidates (skip any id already in
`existing`, the `exclude` id, and ids whose content is gone):

| Source | Condition | Template | Watermark |
| --- | --- | --- | --- |
| dictation `p` (`attempts > 0`, id in `sentenceIds`) | `needsReview(p)` (core/dictation/modes) | WEAK | always |
| | `best === 1 && attempts === 1 && !(hints > 0)` | STRONG | `p.lastAt < since` |
| | otherwise | KNOWN | `p.lastAt < since` |
| pair set `S` (items of `pairSets[S]`) | some item `isWeak` | WEAK | always |
| | some item with `correct < seen` | KNOWN | always |
| | `sum(seen) >= PAIR_ENROL_ANSWERS`, every seen item `streak >= 3`, ≥ half the items seen | STRONG | max item `lastAt < since` |
| | `sum(seen) >= PAIR_ENROL_ANSWERS` | KNOWN | max item `lastAt < since` |
| lesson `r` (`completedAt > 0`, id in `lessonIds`) | `bestScore >= 0.9` | KNOWN | always |
| | `bestScore >= PASS_SCORE` | LEARNED1 | always |
| media unit `i < unitCount` | `scores[i] < 1` (finite) | WEAK | always |
| shadowing id `s` | `best < 0.7`, no dict card and no dictation progress for `s` | NEW | always |

"Always" rows are exactly what the hooks enrol unconditionally (failures, lessons). Watermarked rows are successes the
hooks may have declined (budget), so they are reconciled only for history older than `since`.

Templates (ease `START_EASE`, lapses 0, `last` 0, no `lastGrade`):

| Template | interval | reps | bucket | minDay |
| --- | --- | --- | --- | --- |
| WEAK | 0 | 0 | 0 | 0 |
| LEARNED1 | 1 | 1 | 1 | 0 |
| NEW | 0 | 0 | 2 | 1 |
| KNOWN | 3 | 1 | 3 | 1 |
| STRONG | 7 | 2 | 4 | 2 |

Spreading (deterministic):
1. `load[d]` starts with the existing **seeded** cards (`last === 0 && lastGrade === undefined && !suspended`) per day
   offset of `availableAt` (overdue → day 0). This includes cards merged in from other devices.
2. Re-spread: for each day with `load[d] > SEED_PER_DAY`, move the overflow seeded cards (sorted by interval desc, then
   id desc) to the smallest later day with room. Their `due` is rewritten; `last` stays 0, so any graded copy still wins
   a merge. Count them in `moved`.
3. Sort new candidates by `bucket` asc, then `lastAt` asc, then `cardId` asc (`lastAt` = dictation `lastAt`, max pair item
   `lastAt`, lesson `completedAt`, 0 for media and shadowing). For each, take the smallest `d >= minDay` with
   `load[d] < SEED_PER_DAY`, then `load[d]++`.
4. `due = d === 0 ? now : startOfLocalDay(now, d)`.

A second run over the same input returns `{ cards: {}, created: 0, moved: 0 }`.

### 3.8 `src/core/review/catalog.ts` — which ids still have content (light, main-bundle safe)

```ts
export interface Catalog { has(id: CardId): boolean }
export function buildCatalog(input: {
  builtinSentenceIds: ReadonlySet<string>;
  customSentenceIds: ReadonlySet<string>;
  lessonIds: ReadonlySet<string>;
  chunkIds: ReadonlySet<string>;
  pairSetIds: ReadonlySet<string>;
  media: ReadonlyMap<string, number>; // itemId → unitCount
}): Catalog;
export function readCatalog(): Catalog; // IO; cached
export function invalidateCatalog(): void;
```

`has` per kind: `dict` → ref in built-in or custom ids; `lesson` → in `lessonIds`; `chunk` → in `chunkIds`; `pair` →
in `pairSetIds`; `media` → `parseMediaRef` succeeds, the item exists and `unit < unitCount`.

`src/data/pairIndex.ts` (CORE, new): `export const PAIR_SET_ITEMS: Readonly<Record<string, readonly string[]>>` (set id →
item ids, about 2.5 kB), generated by hand or a script. A test asserts it equals `PAIR_SETS` exactly. It keeps the 34 kB
pairs data out of the main bundle.

`readCatalog` reads custom ids from `KEYS.customSentences` (any array element with a string `id`) and media from
`KEYS.media` through `sanitizeLibrary`, and keeps only ids and unit counts. The cache is invalidated by
`invalidateCatalog()`, which the snapshot layer calls on writes/storage events for `custom-sentences` and
`media-library` (no raw-string comparisons).

### 3.9 `src/core/review/queue.ts`

```ts
export function collectEntries(store: ReviewStore, drill: DrillStore, catalog: Catalog, now: number): ReviewEntry[];
export interface Admission { touched: ReviewEntry[]; admitted: ReviewEntry[]; held: ReviewEntry[]; deferred: ReviewEntry[] }
export function admitToday(entries: readonly ReviewEntry[], store: ReviewStore, budgetSec: number, now: number, later?: ReadonlySet<CardId>): Admission;
export function summarize(entries: readonly ReviewEntry[], store: ReviewStore, budgetSec: number, now: number, catalog?: Catalog): ReviewSummary;
export interface QueueOptions {
  sessionSec?: number; // default SESSION_SEC
  kinds?: readonly ReviewKind[];
  later?: ReadonlySet<CardId>; // skipped today: moved to the end of the order
  phenomenonOf?: (id: CardId) => string | undefined; // for the in-block phenomenon spread
}
export function buildReviewQueue(entries: readonly ReviewEntry[], store: ReviewStore, budgetSec: number, now: number, opts?: QueueOptions): CardId[];
export function interleaveByKind<T extends { id: CardId; kind: ReviewKind }>(list: readonly T[], phenomenonOf?: (id: CardId) => string | undefined): T[];
export function forecast(entries: readonly ReviewEntry[], now: number, days = 7): ForecastDay[];
export function kindCounts(entries: readonly ReviewEntry[], now: number): Record<ReviewKind, KindCount>;
export function estimateMinutes(ids: readonly CardId[]): number; // max(1, round(sum kindSeconds / 60))
export function nextAvailable(entries: readonly ReviewEntry[], now: number, kind?: ReviewKind): number | null;
export function statesByRef(entries: readonly ReviewEntry[], kind: ReviewKind): Record<string, CardState>;
```

`collectEntries`:
- Stored cards: skip `suspended`, skip `!catalog.has(id)`, skip retired lessons (`interval >= MATURE_DAYS`).
  `touchedToday = seenToday(card, now)` (schedule.ts): the learner met the item today, from `seenAt ?? last`. A time
  slightly ahead (clock skew) counts as today; more than a day ahead (fast-clock device) is unknown, never "today" on
  every later day. Suspend toggles keep `seenAt`, so resuming never makes a card touched. `availableAt = availableAt(card)`.
- Drill cards whose `chunk:<id>` passes `catalog.has`: `studied = drill.daily.day === localDay(now) &&
  drill.daily.studiedIds.includes(id)`. `touchedToday = studied`. `availableAt`: when `studied && interval === 0`
  (learning steps from the drill page today) → `nextLocalMidnight(now)`, else `availableAt(state)`. The drill page
  handles its own same-day steps; Ôn tập and the badges do not flicker while the learner is on it.
- Output order: `KIND_ORDER`, then id.

`admitToday` (shared by `summarize` and `buildReviewQueue`):
1. `due` = entries with `availableAt <= now`, sorted: learning (`interval === 0`) first, then graded before never-graded
   (catch-up: stored kinds with no `lastGrade`), then by `state.due` asc, then `KIND_ORDER`, then id. Ids in `later` go
   to the end (same relative order).
2. `touched` = due entries with `touchedToday` (budget-exempt).
3. Walk the rest in order with `acc = 0`, lessons admitted so far `L` (count today's lesson ids in `daily.ids` too): a
   lesson with `L >= LESSON_PER_DAY` goes to `deferred`. Otherwise, while `acc < capLeftSec`, admit it and add its seconds
   (the last item may overshoot). After the budget is spent: never-graded catch-up goes to `deferred`, the rest to
   `held`. Only `held` turns back-pressure on: "Ôn thêm" cannot serve capped lessons, and migration catch-up must not
   block new learning.

`capLeftSec = budget − Σ KIND_SECONDS of daily.ids not in daily.exempt`: a review of an item already touched today
(recordReview/recordChunkReview check `seenToday`/`studiedIds` before the grade and pass `exempt` to `withReviewed`)
spends nothing, so fresh items counted in `dueToday` stay admitted.

`summarize`: `catalog` (optional, added by CORE) limits `suspended` to cards whose content exists (without it every
suspended stored card counts; `getReviewSnapshot` passes it). `due`/`dueByKind` over all entries with `availableAt <= now`; `dueToday = touched + admitted`;
`heldBack = held.length` and `heldBackSec`; `deferred = deferred.length`; `backlogClears` = `heldBackSec <= Σ_{k=1..7} max(0, budgetSec −
forecast[k].seconds)` (with `budgetSec` without `extraSec`); other fields per §1. `budgetSec` is passed in
(`reviewMinutes * 60`); `summary.budgetSec` adds `daily.extraSec`.

`buildReviewQueue` (deterministic; `kinds` restricts every step: entries of other kinds are dropped before admission, so
a kinds-filtered session can use the whole remaining budget):
1. `pool` = `touched` then `admitted` from `admitToday`, re-sorted with step 1's order.
2. Pick in order while `picked < MAX_SESSION_ITEMS && (picked < MIN_SESSION_ITEMS || sec < sessionSec)`. Skip a lesson
   once `LESSON_PER_SESSION` lessons are picked.
3. If `sec < sessionSec`, add not-yet-due learning entries (`interval === 0 && availableAt <= now + LEARN_AHEAD_MS`, by
   due), same limits.
4. Return `interleaveByKind(picked, opts.phenomenonOf).map(e => e.id)`.

`interleaveByKind`: split into tap kinds and typing kinds (`TAP_KINDS` first). In each group, keep each kind's items in
input order and emit blocks of up to `INTERLEAVE_BLOCK` items, rotating over kinds in the order of their first appearance.
Inside each block, when `phenomenonOf` is given, reorder greedily so consecutive items differ in phenomenon when possible
(stable otherwise). Example without `phenomenonOf`: `[d1,d2,d3,d4,p1,c1,p2]` → `[p1,p2,c1,d1,d2,d3,d4]`;
`[p1,p2,p3,p4,c1,c2]` → `[p1,p2,p3,c1,c2,p4]`.

`forecast`: day `k` counts entries whose `localDay(availableAt)` equals `localDay(startOfLocalDay(now, k))`; day 0 also
counts everything overdue. `seconds` sums `KIND_SECONDS`. Raw load, no budget.

`kindCounts`: per kind `tracked` / `due` / `learning` / `mature`. Every kind key is present.
`nextAvailable`: min `availableAt > now` (optionally of one kind), else null.
`statesByRef`: `{ [entry.ref]: entry.state }` for entries of that kind (catalog-filtered, so no orphans).

### 3.10 `src/core/review/copy.ts` — learner-facing scheduling lines (pure)

```ts
export function contextLineVi(entry: ReviewEntry, now: number): string;
export function growthLineVi(prev: CardState | undefined, next: CardState, now: number): string;
```

`contextLineVi`, first match:
1. `state.lastGrade === 'again'` → `'Lần trước bạn chưa nhớ mục này'`
2. `entry.last === 0` → `'Mục bạn từng học trước đây'`
3. `entry.last > 0`: `d = localDayDiff(min(last, now), now)`: `d === 0` → `'Bạn vừa gặp mục này hôm nay'`, `d === 1` →
   `'Bạn gặp mục này hôm qua'`, else `` `Bạn học mục này ${d} ngày trước` ``. Append `` ` · ôn lần ${reps + 1}` `` when
   `reps >= 1`.
4. chunk (no `last`): `reps >= 1` → `` `Ôn lần ${reps + 1}` ``, else `'Cụm từ bạn đang học'`.

`growthLineVi`: `next.interval === 0` → `` `Gặp lại ${formatDueVi(availableAt(next), now)}` ``. Otherwise
`` `Gặp lại sau ${formatDaysVi(next.interval)}` `` plus `` ` (lần trước: ${formatDaysVi(prev.interval)})` `` when
`prev.interval >= 1 && prev.interval !== next.interval`.

---

## 4. IO layer and hooks

### 4.1 `src/core/review/api.ts` (non-React, the module-facing API)

Write base: `readReviewStore(now)` = module-level `sessionStore ?? parseReviewStore(loadJSON(KEYS.review))`, exactly the
`stats.recordAttempt` / `loadStats()` pattern. Every write: base → apply → if `storesEqual(base, next)` return without
saving → `saved = saveJSON(KEYS.review, next)` → `sessionStore = saved ? null : next` → notify listeners (`saveJSON`
already calls `notifyWrite`; the session fallback must notify itself). Every write also applies
`withSince(next, moduleSince)` (`moduleSince` = time of the first api call in this page load); this is the only field
that may be written without another change, and only from `recordReview`/`enrolSeen` (the learner just practised, so the
browser already has data).

```ts
export function readReviewStore(now?: number): ReviewStore;
export function reloadReview(): void; // clears sessionStore + reconcile guard, invalidates catalog, bumps snapshot
export function ensureReconciled(now?: number, exclude?: CardId): void; // once per page load (module guard)
export interface RecordOptions { ctx: ReviewContext; enrol: boolean; firstGrade?: Grade; now?: number }
export interface RecordResult extends ApplyResult { saved: boolean }
export function recordReview(id: CardId, grade: Grade, opts: RecordOptions): RecordResult;
export function enrolSeen(id: CardId, now?: number): boolean; // true when a card was created
export function resetCard(id: CardId, now?: number): boolean; // only when a card exists
export interface ChunkReviewResult { state: CardState | null; graded: boolean; saved: boolean }
export function recordChunkReview(chunkId: string, grade: Grade, now?: number): ChunkReviewResult;
export function unlockExtra(now?: number): boolean;
export function suspendCard(id: CardId, on: boolean, now?: number): boolean; // false for chunk ids (not supported)
export function unsuspendAll(now?: number): number; // count of cards changed
export function dismissSeedNotice(now?: number): void; // noticeSeenAt = now
export function subscribeReview(fn: () => void): () => void;
export function getReviewSnapshot(now?: number): ReviewSnapshot; // see 4.2
export function reviewBudgetSec(): number; // getSettings().reviewMinutes (sanitised) * 60
```

- `recordReview`: `ensureReconciled(now, id)` first (the recorded id is excluded from reconcile, so the real grade
  enrols it). Then `prev = base.cards[id]`, `enrolLeft = getReviewSnapshot(now).summary.enrolLeft`, `applyReview`. If
  `card`: `withCard`; if `reason === 'enrolled' && budgeted`: `withEnrolled`; if `ctx === 'review'` and reason is
  `graded`/`lapsed`: `withReviewed`. Chunk ids are rejected (`not-enrolled`). Never throws: wrap and return
  `{ card: null, current: null, reason: 'not-enrolled', budgeted: false, saved: false }` on an unexpected error. Module
  callers still wrap the call in try/catch.
- `enrolSeen`: reconcile, then `enrolSeenCard`; never budgeted (a weak take is a failure).
- `recordChunkReview`: drill base = `rollDaily(drillSession ?? loadDrillStore(t), t)` (keep a drill `sessionStore`
  fallback too). `prev = base.cards[id]`. If `prev` exists, is not `isDueToday`, has `interval >= 1` and the grade is not
  `again` → no change (`graded: false`, `state: prev`). Otherwise `updated = grade(prev ?? newCard(id, t), g, t)`,
  `next = applyGrade(base, id, updated, !prev, t)`, `saved = saveDrillStore(next)`, fallback on failure. Then
  `withReviewed('chunk:' + id)` in the review store. Returns `{ state: updated, graded: true, saved }`.
- `ensureReconciled` reads `KEYS.dictation` (`sanitizeProgress`), `KEYS.customSentences` (ids), `KEYS.pairs`
  (`sanitizeProgress` from features/pairs/game), `loadLessonProgress()`, `KEYS.media` (`sanitizeLibrary`; unit count =
  `item.units.length`, scores = `item.progress.scores`, session-only items skipped) and `KEYS.shadowing` (`sanitizeState`
  from features/shadowing/store; built-in sentence ids only, `best = item.best`). `since = store.since || moduleSince`.
  It runs `reconcileCards`. When `created + moved === 0` it does **not** write (and keeps no flag in storage). Otherwise it
  merges the cards, applies `withSince`, and when `created >= NOTICE_MIN` sets `notice = { count: created + (unseen
  notice count), at: now }`, then saves.
- `reloadReview()` is called in `main.tsx` after `initFolderSync` (next to `reloadStats()`).

### 4.2 `src/core/review/useReview.ts` (React) and the snapshot cache

```ts
export function useReview(): ReviewSnapshot;
export function statesOfKind(snapshot: ReviewSnapshot, kind: ReviewKind): Record<string, CardState>; // memoised per snapshot (WeakMap)
```

- **One module-level snapshot cache** shared by every hook instance and by `getReviewSnapshot()`. It holds
  `{ version, now, snapshot }`. `getReviewSnapshot()` without `now` returns the cached snapshot, recomputing only when the
  version changed. `getReviewSnapshot(now)` recomputes with that `now` when it differs from the cached one (the session
  start uses `getReviewSnapshot(Date.now())`).
- Invalidation bumps the version and stores `now = Date.now()`:
  - `onAppWrite` for `review-cards`, `drill-cards`, `custom-sentences`, `media-library`, `settings` (the last two
    also call `invalidateCatalog()` for their keys).
  - `subscribeReview` (session fallback writes).
  - `window 'storage'` events for those keys, or a `null` key.
  - One shared clock: a 60 s interval plus `visibilitychange`/`focus`, started with the first subscriber and stopped
    with the last (copy the `useNow` logic from features/home/hooks; core must not import features/home).
- `useSyncExternalStore(subscribe, getSnapshot)`: `getSnapshot` never reads the clock and never writes.
- On mount, `useEffect(() => ensureReconciled(), [])`. AppNav mounts on every page, so reconcile runs once per page
  load, after the folder-sync boot.

### 4.3 `src/core/review/index.ts` (barrel) and what each group consumes

The barrel re-exports `types`, `constants`, `ids`, `time`, `grading`, `schedule`, `store`, `queue`, `copy`, `api` and
`useReview`, plus `availableAt`/`isDueToday` from `core/srs`. Page components import from `'../../core/review'`.

| Group | Exports it relies on (CORE's `index.test.ts` asserts each is exported) |
| --- | --- |
| HOOKS-A | `useReview`, `statesOfKind`, `nextAvailable`, `isDueToday`, `availableAt`, `formatDueVi`, `recordReview`, `resetCard`, `gradeDictation`, `makeCardId`, `mediaRef`, types `RecordResult`, `ReviewSnapshot`, `CardId`, `DictationCheck` |
| HOOKS-B | `recordReview`, `enrolSeen`, `gradePairSet`, `gradeLessonScore`, `availableAt`, `formatDueVi`, `makeCardId`, `PAIR_ENROL_ANSWERS`, types `RecordResult`, `CardId` |
| UI | `useReview`, `getReviewSnapshot`, `buildReviewQueue`, `reviewBudgetSec`, `recordReview`, `recordChunkReview`, `unlockExtra`, `suspendCard`, `dismissSeedNotice`, `lessonReviewItems`, `gradeDictation`, `gradePairSet`, `gradeLessonScore`, `summarize`, `forecast`, `estimateMinutes`, `contextLineVi`, `growthLineVi`, `formatDueVi`, `availableAt`, `isDueToday`, `parseCardId`, `parseMediaRef`, `kindSeconds`, `KIND_LABEL`, `KIND_SHORT`, `KIND_ROUTE`, `KIND_SECONDS`, `EXTRA_STEP_SEC`, `SEED_PER_DAY`, `PAIR_REVIEW_SIZE`, `LESSON_REVIEW_SIZE` |
| SURFACES | `useReview`, `forecast`, `kindCounts`, `estimateMinutes`, `formatDueVi`, `unsuspendAll`, `REVIEW_MINUTES_OPTIONS`, `DEFAULT_REVIEW_MINUTES`, `KIND_LABEL`, `KIND_ROUTE`, `REVIEW_KINDS` |

---

## 5. Enrolment and practice rules per module (HOOKS agents)

Every call is wrapped in `try { … } catch {}` and placed after the module's own progress save, **but values that
describe the state before this answer (`prevAttempts`) are captured before that save**. In a module page `ctx` is
`'practice'`, except in dictation `mode=review` (`'review'`; the api applies the not-due rule itself, so the page may pass
`'review'` for every item of that mode). Components the review page embeds (`Exercise`, `ClozeExercise`, `RoundView`,
`Quiz`, `DrillCard`) must **not** call the review API themselves. Only page handlers do.

| Module / event | Card id | Grade | enrol | firstGrade |
| --- | --- | --- | --- | --- |
| Dictation check, modes `normal`/`custom`, not a retry | `dict:<sentence id>` | `gradeDictation({ total, matched, extra, hinted, revealed, firstTry: prevAttempts === 0, kind: 'dict' })` | true | – |
| Dictation check, mode `review`, not a retry | same | same with `firstTry: false`, `ctx: 'review'` | true | – |
| Dictation `cloze` mode | – | no call | – | – |
| Custom sentence words edited (`dedupeKey` changed) | `dict:<id>` | `resetCard` (only writes when a card exists) | – | – |
| Custom sentence deleted | – | nothing (orphan) | – | – |
| Media DictationPanel check, `!o.retry`, item not session-only | `media:<itemId>:<unit>` | `gradeDictation({ …, firstTry: false, kind: 'media' })` | grade is not `good`/`easy` | – |
| Pairs round finished (any round kind), per set in `summarizeRound(state).sets` | `pair:<setId>` | `gradePairSet(correct, total)` (skip when null) | `correct < total` or the set's `sum(seen) >= PAIR_ENROL_ANSWERS` after this round | – |
| Lesson quiz finished (LessonView `finish`) | `lesson:<lessonId>` | `gradeLessonScore(score)` | `score >= PASS_SCORE` | `'good'` |
| Shadowing take saved for a `sentence` source with score < 0.7 (auto score, or self rating `ok`/`bad`) | `dict:<sentence id>` | `enrolSeen` (never grades) | – | – |
| Shadowing of `chunk`/`custom` sources | – | nothing | – | – |
| Drill page grading | – | unchanged (drill store) | – | – |

Dictation: `prevAttempts = loadProgressOr(progress)[id]?.attempts ?? 0`, read **before** `updateProgress`. The pure
helper `reviewGradeFor(info, { mode, retry, prevAttempts })` → `{ grade, ctx } | null` lives in `pageModel.ts` and is
tested there.

Outcome examples (practice context, budget available):
- A first-time perfect sentence: `easy` → 4 days, then about 10, 25 days.
- One missed word in a 6-word sentence on the first try: `hard` → learning step, back after ≥ 1 h. Missing one word again:
  `hard` → 1 day, then 2, 3, 4… days (`hard` always grows). A perfect answer then: 3 days, then × ease.
- A 4-word sentence with one miss: `hard` as well (error count, not ratio).
- Redoing a not-due sentence perfectly changes nothing. Missing it pulls it in to tomorrow (no lapse); missing it again
  in Ôn tập lapses it (keeps 25% of the interval, back tomorrow).
- A lesson passed at 6/8 enrols at 1 day; reviews at 3/4 give 2, 3, 4, 5… days.
- The 11th perfect new sentence of the day, or any perfect new sentence while items are held back: not enrolled
  (`over-budget`).

Visible feedback (each module renders it outside the reused component, muted, `role="status"`):
- Dictation (DictationPage, under `Exercise`): when `current` exists and the reason is `enrolled`/`graded`/`lapsed`/
  `pulled-in`/`skipped-not-due`: `` `Câu này sẽ quay lại trong Ôn tập ${formatDueVi(availableAt(current), now)}.` ``.
  `over-budget`: `'Bạn đã nhớ câu này. Hôm nay Ôn tập đã đủ mục mới.'`
- Media (PlayerView, under DictationPanel): the same line with "Câu này".
- Pairs RoundResults (new optional prop `reviewNote?: string`): `` `${k} nhóm âm sẽ quay lại trong Ôn tập.` `` where `k`
  = sets whose result has a `current` card scheduled (enrolled/graded/lapsed/pulled-in); hidden when `k === 0`.
- Lessons `QuizResult` (`reviewNote?: string`): for `enrolled`/`graded`/`lapsed`/`pulled-in`:
  `` `Bài này sẽ quay lại trong Ôn tập ${formatDueVi(availableAt(current), Date.now())}.` ``

---

## 6. Ôn tập page (`#/review`, UI agent)

Route: `review`, label **Ôn tập**, hint "Ôn lại đúng lúc những gì đã học", group `learn`, placed right after `home`. Icon:
lucide `History`. Tint: `--mod-review: light-dark(#4d7c0f, #a3e635)` (lime, hue ≈ 85°; stats emerald is ≈ 160°;
`#4d7c0f` on white 4.99:1, `#a3e635` on `#131626` ≥ 9:1), with a `.mod-review` class. One `h1` per view through
`PageHeader route="review"`.

### 6.1 Files (all under `src/features/review/`)

- `ReviewPage.tsx` (default export). State machine: `start` → `session` → `summary`.
- `sessionModel.ts` (pure) + `sessionModel.test.ts`.
- `resolve.ts` (pure) + `resolve.test.ts`: `CardId` → renderable content, or `null` (orphan). Imports `SENTENCES`, custom
  sentences (`toSentence` + `detectedPhenomena`), `PAIR_SETS`, `LESSONS`, `CHUNKS`, the media library. Also
  `pairReviewQuestions(set, progress, now, seed): Question[]` (`PAIR_REVIEW_SIZE` items sorted by `itemPriority` desc with
  a seeded jitter, a seeded random answer per item, keys `itemId + '#0'`) and `phenomenonOf(id)` for the queue.
- `items/DictItem.tsx`, `items/PairItem.tsx`, `items/LessonItem.tsx`, `items/ChunkItem.tsx` (media reuses `DictItem`).
- `review.css` (prefix `rev-`). Also import the feature CSS of every reused component.

### 6.2 sessionModel (pure)

```ts
export interface SessionResult { id: CardId; kind: ReviewKind; grade: Grade; correct: boolean }
export interface SessionState {
  queue: CardId[];
  original: number; // queue length at start
  pos: number;
  results: Record<number, SessionResult>; // keyed by position: one result per position
  requeued: CardId[];
  ended: boolean;
}
export function startSession(queue: readonly CardId[]): SessionState;
export function currentId(s: SessionState): CardId | null;
export function isGraded(s: SessionState, pos: number): boolean;
/** Ignored when `pos` already has a result. 'again' on a non-lesson id not yet requeued → append to queue + requeued. */
export function recordResult(s: SessionState, pos: number, r: SessionResult): SessionState;
export function nextItem(s: SessionState): SessionState; // pos+1; ended when pos >= queue.length
export function skipItem(s: SessionState): SessionState; // no result, pos+1
export function endSession(s: SessionState): SessionState;
export function remaining(s: SessionState): number; // queue.length - pos
export function originalDone(s: SessionState): number; // positions < original that are passed
export interface SessionSummary { total: number; remembered: number; notYet: number; byKind: Partial<Record<ReviewKind, { total: number; remembered: number }>> }
export function summarizeSession(s: SessionState): SessionSummary; // once per id; remembered = no 'again' result for the id
```

Every item handler (`onChecked`, `onChoose`, `onFinish`, `onGrade`) first checks `isGraded(state, pos)`; a retry or a
second fire is practice only (no `recordReview`, no progress update, no `recordAttempt`). The queue is built once at
session start from `getReviewSnapshot(Date.now())` with `buildReviewQueue(entries, store, reviewBudgetSec(), now,
{ later, phenomenonOf })`, after dropping ids that `resolve` cannot render (they never count in `n`). `later` is a
module-level `Set<CardId>` in ReviewPage holding ids skipped today (cleared when the local day changes).

### 6.3 Screens and copy

**Header** (every screen): `PageHeader route="review" title="Ôn tập" subtitle="Những gì bạn đã học quay lại đúng lúc để nhớ lâu."`.
Actions: `<span className="badge badge-accent">{dueToday} mục hôm nay</span>` when `dueToday > 0`.

**Seed notice** (any screen, top): when `store.notice && store.notice.at > store.noticeSeenAt`: `.callout` with Info icon:
"Đã xếp lịch ôn cho {notice.count} mục bạn từng học, mỗi ngày tối đa {SEED_PER_DAY}." + ghost "Đã hiểu" →
`dismissSeedNotice()`.

**Start** (when the first queue is non-empty). One `.card`:
- `h2` "Phiên này: {n} mục · khoảng {estimateMinutes(queue)} phút".
- Per-kind counts: a row of `IconTile size="sm" route={KIND_ROUTE[k]}` + `<span className="badge">{KIND_SHORT[k]} {count}</span>`.
- If `heldBack > 0`: `.callout` with Info. `backlogClears` → "Còn {heldBack} mục đến hạn sẽ được chia sang các ngày tới
  cho nhẹ." Otherwise "Bạn đang có nhiều mục tồn. Hôm nay ưu tiên ôn, tạm học ít bài mới."
- `.btn-primary btn-lg` "Bắt đầu ôn" (the gesture that enables TTS autoplay).
- `<details>` "Ôn tập hoạt động thế nào?": "Nhớ đúng thì mục quay lại thưa dần: 1 ngày, 3 ngày, 1 tuần…; quên thì quay
  lại sớm."

**Session.** The session never wraps an item in `.card`: the item's own card is the main work area. Above it, on the page
background:
- `.row-between`: "Còn {remaining} mục" (live region, `aria-live="polite"`) + kind badge (`KIND_LABEL`) + a
  `.badge badge-warn` "Ôn lại" for requeued positions (`pos >= original`) + an overflow menu (ghost icon button,
  `aria-label="Tùy chọn"`) with "Không ôn mục này nữa" (stored kinds only) + `btn-ghost btn-sm` "Kết thúc" (→ summary).
- `.progress` of `originalDone / original`, `aria-label="Tiến độ phiên ôn"`.
- A muted context line: `contextLineVi(entry, now)`.
- The item, keyed by `${id}:${pos}`, rendered with `embedded` where the component supports it.
- After grading: `.rev-next muted` (`role="status"`): `growthLineVi(entry.state, current, now)`; for a requeued `again`:
  "Gặp lại cuối phiên này".
- Suspend: `suspendCard(id, true)`, then show `role="status"` "Đã bỏ mục này khỏi Ôn tập." + ghost "Hoàn tác"
  (`suspendCard(id, false)`), then `nextItem`.

Items (all get `autoPlay` true, including the first: "Bắt đầu ôn" supplies the gesture):
- **dict / media** — `<Exercise sentence autoPlay focusOnMount onChecked onNext onRetry onSkip>`.
  - Media sentence: `{ id: cardId, text: unit.text, vi: '', level: estimateLevel(...), topic: item.title, focus: detectedPhenomena(text) }`.
    Above it a muted note "Câu từ video · giọng đọc máy" and a ghost link "Mở video" → `hrefFor('media', { id: itemId, unit })`.
  - `onChecked(info)` when not graded at `pos`:
    1. `res = recordReview(id, gradeDictation({ total, matched, extra, hinted, revealed, firstTry: false, kind }), { ctx: 'review', enrol: true })`.
    2. dict only: update dictation progress (`updateProgress` on `loadProgressOr`, then `saveJSON(KEYS.dictation)`).
    3. `recordAttempt({ module: kind === 'media' ? 'media' : 'dictation', itemId: kind === 'media' ? ref : sentenceId, correct: errors === 0 && !hinted, seen, missed })`.
  - `onSkip` → `skipItem` + add to `later`. `onRetry` → remount (practice only). `onNext` → `nextItem`.
- **pair** — `questions = pairReviewQuestions(set, pairsProgress, now, seed(id, pos))`. For each question, one
  `<RoundView embedded title="Ôn tập" showSet round={startRound([q])} question={q} set item answer onChoose onNext onQuit>`.
  - `onChoose` (guard double fire): `submitAnswer`, feedback, `commitPairsProgress(p => applyAnswer(p, itemId, correct, now))`,
    `recordAttempt({ module: 'pairs', … })` as PairsPage does. The round's own requeue is ignored.
  - After the 4th answer: `recordReview(id, gradePairSet(correct, questions.length), { ctx: 'review', enrol: true })`,
    then the result. `onQuit` is unused in embedded mode.
- **lesson** — `idx = lessonReviewItems(lessonId, lesson.quiz.map(q => q.type), card)`.
  `<Quiz embedded lesson={{ ...lesson, quiz: idx.map(i => lesson.quiz[i]) }} onFinish onExit>`.
  - Above it: `h2` "Ôn bài {order} · {title}" (titles often contain a colon).
  - `onFinish(outcomes)`: `score = correct / outcomes.length`; `recordReview(gradeLessonScore(score), ctx 'review')`;
    `recordAttempt` per question (`module 'lesson'`, `itemId: \`${lessonId}:${idx[k]}\``, seen/missed via
    `itemPhenomena`); then a verdict (`.callout-ok` "Đúng {c}/{n} câu" or `.callout-bad`) with primary "Tiếp" and, after
    grading, a ghost link "Xem lại bài" → `navigate('lessons', { id })`.
  - Never requeued. Do **not** call `recordLessonResult`.
- **chunk** — `<DrillCard chunk state kind options showIpa autoPlay onGrade>` (kind/options as in DrillPage).
  - `onGrade(g)` when not graded at `pos`: `res = recordChunkReview(ref, g)`; `recordAttempt({ module: 'drill', … })`;
    result; `nextItem`.

**Summary** (session ended, or "Kết thúc"):
- `h2` "Xong phiên ôn!", or "Đã dừng phiên ôn" when ended early.
- Three KPIs: "Đã ôn" {total} · "Nhớ được" {remembered} · "Chưa nhớ" {notYet}.
- Per-kind rows: `IconTile` + `KIND_LABEL` + "{remembered}/{total}".
- "Lần ôn tiếp theo: {formatDueVi(nextAt, now)}" (when set) · "Ngày mai: {forecast[1].count} mục · khoảng
  {ceil(seconds/60)} phút".
- Actions: more to serve (a fresh `buildReviewQueue` non-empty) → primary "Ôn tiếp ({k} mục)" + default "Về Hôm nay";
  otherwise primary "Về Hôm nay".

**Empty states** (`.card.empty-state`, `IconTile` route `review`, size lg):
1. Nothing tracked (`summary.tracked === 0`): `h2` "Chưa có gì để ôn"; p "Những gì bạn luyện (bài học, chép chính tả,
   phân biệt âm, cụm từ, video) sẽ quay lại đây đúng lúc."; primary "Học bài đầu tiên" (→ lessons), default "Chép chính
   tả" (→ dictation).
2. Nothing due, no learn-ahead, `reviewedToday > 0`: `h2` "Xong phần ôn hôm nay"; p "Bạn đã ôn {reviewedToday} mục. Mục
   tiếp theo đến hạn {formatDueVi(nextAt, now)}."; primary "Về Hôm nay".
3. Nothing due, no learn-ahead, `reviewedToday === 0`: `h2` "Không có gì cần ôn"; p "Mục tiếp theo đến hạn
   {formatDueVi(nextAt, now)}. Trong lúc chờ, học thêm điều mới nhé."; primary "Chép câu mới" (→ dictation), default
   "Học cụm từ mới" (→ drill).
4. Budget used (`capLeftSec === 0 && heldBack > 0`, no touched/learn-ahead items): `h2` "Hôm nay bạn ôn đủ rồi"; p
   `backlogClears` ? "Còn {heldBack} mục sẽ được chia sang các ngày tới, để mỗi ngày không quá nặng." : "Bạn đang có
   nhiều mục tồn. Ôn thêm một chút hôm nay sẽ đỡ hơn cho các ngày tới."; primary "Về Hôm nay", soft "Ôn thêm 5 phút"
   (→ `unlockExtra()`, then rebuild).

Accessibility: focus moves to the item's first control on change (`focusOnMount`); check at 375 px in both themes.

---

## 7. Dictation "Ôn đến hạn" (HOOKS-A) and pairs rename (HOOKS-B)

`core/dictation/modes.ts` keeps `needsReview`/`reviewQueue`/`countReview` with their tests, and adds:

```ts
/** Sentences of `list` whose dict state is due (isDueToday), most overdue first (due asc, then id). */
export function dueQueue(list: readonly Sentence[], states: Readonly<Record<string, CardState | undefined>>, now: number): Sentence[];
export function countDue(list: readonly Sentence[], states: Readonly<Record<string, CardState | undefined>>, now: number): number;
```

`modes.ts` imports `isDueToday` and `CardState` from `core/srs` only (never `core/review`). `states` =
`statesOfKind(snapshot, 'dict')` (catalog-filtered, stable identity per snapshot).

`DictationPage`:
- `MODE_INFO.review` = `{ label: 'Ôn đến hạn', hint: 'Câu đã học tới lúc cần nghe lại, câu quên lâu nhất lên trước.', icon: RotateCcw }`.
- The review-mode queue uses `dueQueue` (all sentences, level/focus filtered). `advance` skips ids no longer due.
- The segment count is `countDue(all, states, now)`. Under the mode, a muted note: "Không tính giới hạn ôn mỗi ngày."
- `linkFacts.review` = the dict state is due. `SessionSummary` `reviewCount` = the due count; button "Ôn {n} câu đến hạn".
- Review-mode empty states:
  - No dict states at all: "Chưa có câu nào để ôn" / "Làm vài câu ở chế độ “Chép cả câu” trước. Câu bạn đã làm sẽ quay lại đây đúng lúc để ôn." / primary "Bắt đầu chép chính tả".
  - Filtered with due elsewhere: "Không có câu đến hạn nào khớp bộ lọc" / "Bạn còn {n} câu đến hạn ở các mức độ / hiện tượng khác." / primary "Bỏ lọc".
  - None due: "Chưa đến lúc ôn câu nào" / "Câu tiếp theo đến hạn {formatDueVi(nextAvailable(entries, now, 'dict'), now)}." / primary "Chép câu mới", default "Mở Ôn tập" (→ review).
- Round message for review mode: "Hết các câu đến hạn. Câu nào vừa sai sẽ quay lại sau ít nhất 1 giờ." Keep `newRound`.

Media (HOOKS-A): `MediaPage` reads an optional `unit` param: it selects that unit (`setUnitIndex`) and seeks the player to
its `playWindow` start once the player is ready.

Pairs (HOOKS-B): user-visible "Ôn câu hay sai" → "Luyện câu hay sai", RoundResults "Ôn lại …" → "Luyện lại …". The
internal `kind: 'review'` stays.

---

## 8. Integration points per file

| File | Owner | Change |
| --- | --- | --- |
| `src/core/storage.ts` | CORE | `KEYS.review = 'review-cards'` (comment: spaced-repetition cards, see docs/review-system.md). |
| `src/core/settings.ts` (+test) | CORE | `reviewMinutes` (§2). |
| `src/core/srs.ts` (+test) | CORE | §3.2. |
| `src/core/review/**` | CORE | §1–§4 + tests. |
| `src/data/pairIndex.ts` (+test) | CORE | §3.8. |
| `src/core/syncMerge.ts` (+test) | CORE | §9. |
| `src/core/backup.ts` | CORE | `sanitizeSettingsJSON` keeps a valid `reviewMinutes` (it whitelists settings fields; without this a restored backup lost the setting). Backup test: the review key round-trips. |
| `src/core/nav.ts` (+test) | CORE | `RouteId` + ROUTES `{ id: 'review', label: 'Ôn tập', hint: 'Ôn lại đúng lúc những gì đã học', icon: '↻', group: 'learn' }` after home. Doc comment: "review: none", "media: id=<itemId> \| unit=<n>". |
| `src/main.tsx` | CORE | `reloadReview()` after `initFolderSync`, next to `reloadStats()`. |
| `src/App.tsx` | CORE | `review: lazyPage(() => import('./features/review/ReviewPage'))` + `case 'review'`. |
| `src/components/routeIcons.ts` | CORE | `review: History`. |
| `src/index.css` | CORE | `--mod-review` + `.mod-review { --tile: var(--mod-review); }`. |
| `docs/design-system.md` | CORE | review (History) in the route icon list, `--mod-review` in module tints. |
| `src/features/dictation/Exercise.tsx` | CORE (contract prep), then HOOKS-A | `CheckedInfo` gains optional `total?`, `matched?`, `extra?`, `revealed?`; `check()` passes `al.total`, `al.matched`, `al.extra`, `reveal`. Nothing else. |
| `src/features/pairs/RoundView.tsx` | CORE (contract prep), then HOOKS-B | Optional `embedded?: boolean`: hides the round title, counter, score badge, progress bar and "Thoát", and renders the question heading ("Bạn nghe thấy câu nào?") as an `h2` (the host page owns the only `h1`). |
| `src/features/lessons/Quiz.tsx` | CORE (contract prep), then HOOKS-B | Optional `embedded?: boolean`: hides "Câu x/y", the progress bar and "Xem lại bài học". |
| `src/features/review/ReviewPage.tsx` | CORE placeholder → UI | Placeholder renders header + empty state 1/3 from `useReview()`. |
| `src/features/review/**` | UI | §6. |
| `features/dictation/**`, `core/dictation/**` | HOOKS-A | §5 dictation rows, §7. `reviewGradeFor` in `pageModel.ts` + test. |
| `features/media/**` | HOOKS-A | §5 media row in `PlayerView.onChecked` via `features/media/reviewPlan.ts` (`mediaReviewPlan(o, sessionOnly)` → `{ grade } \| null`, test). `CheckOutcome` gains `total`/`matched`/`extra`/`revealed`. `unit` param (§7). |
| `features/pairs/**` | HOOKS-B | §5 pairs row at round end via `features/pairs/reviewHook.ts` (`pairSetReviewCalls(summary, progressAfter, setItems)` → `{ id, grade, enrol }[]`, test). RoundResults `reviewNote`. §7 rename. |
| `features/lessons/**` | HOOKS-B | §5 lesson row in `LessonView.finish`. `QuizResult` `reviewNote?: string` (§5). |
| `features/shadowing/**` | HOOKS-B | §5 shadowing row via `features/shadowing/reviewHook.ts` (`shouldEnrolTake(source, attempt)`, test). `ShadowingPage.onSaved` reads the newest attempt of `source.itemId`; PracticePanel props unchanged. |
| `src/core/goals.ts` (+test) | SURFACES | See below. |
| `src/features/home/**` | SURFACES | `useReview()`. Pass `review` to `dailyPlan`. `PLAN_ICON.review = History`; muted items render without a ring and do not count in "x/y". `'review'` first in `TILE_ROUTES`, badge "khoảng {minutesToday} phút". With review present, the drill tile badge shows `{newAvailable} cụm mới` (not due). |
| `src/components/AppNav.*` | SURFACES | Review nav item count pill (`.nav-count`, `aria-label="{n} mục đến hạn"`, `dueToday`, "99+"). Mobile `TABS`: home, review, lessons, dictation, stats; a count dot on the tab. |
| `src/features/stats/**` | SURFACES | "Ôn tập" card (`CardHead` route `review`): KPIs "Hôm nay" `minutesToday` phút / "Đã ôn hôm nay" / "Đang theo dõi"; 7-day forecast bars (labels "Hôm nay", "Mai", "T2…CN"; helper in statsModel + test); per-kind table from `kindCounts`; when `summary.suspended > 0`: "Đã tắt ôn {n} mục" + ghost "Bật lại" (`unsuspendAll()`); `btn-soft btn-sm` "Ôn ngay". After the KPI row. |
| `src/features/drill/**` | SURFACES | `computeDrillSummary` adds `newIntroduced`. DrillPage: `useReview()`; while `heldBack > 0` the new-card quota passed to `buildQueue` is `store.daily.extraNew` only (the explicit "thêm thẻ mới" still works) and a `.callout` says "Bạn đang có {heldBack} mục tồn trong Ôn tập. Ôn xong rồi học cụm mới nhé." with a link "Mở Ôn tập". A soft line "Thẻ đến hạn cũng nằm trong Ôn tập." |
| `src/features/settings/**` | SURFACES | "Thời lượng ôn mỗi ngày": `Segmented` 5/10/15/20 phút → `updateSettings({ reviewMinutes })`. |
| `README.md` | SURFACES | Section "Ôn tập (lặp lại ngắt quãng)": what enrols, grading, budgets, reconcile, sync, old-build limitation. |

`core/goals.ts`:
- `PlanKind` adds `'review' | 'later'`. `PlanItem.muted?: boolean`. `DrillSummaryLike.newIntroduced?: number`.
  `PlanInput.review?: { dueToday: number; reviewedToday: number; minutesToday: number; heldBack: number }`.
  `export function planTotal(items): number` = non-muted count.
- `reviewPlan` goes **first**: `dueToday > 0` → `{ id: 'review', title: \`Ôn tập · khoảng ${minutesToday} phút\`,
  detail: reviewedToday > 0 ? \`Đã ôn ${reviewedToday} mục, còn ${dueToday} mục\` : \`${dueToday} mục đến hạn\`,
  route: 'review', done: false, progress: reviewedToday / (reviewedToday + dueToday) }`; else `reviewedToday > 0` →
  `{ title: 'Ôn tập', detail: \`Đã ôn ${reviewedToday} mục, hết mục đến hạn\`, done: true, progress: 1 }` (when
  `heldBack + deferred > 0`: \`Đã ôn ${reviewedToday} mục, phần còn lại dời sang ngày sau\`); else null.
  `review.deferred?` is optional (Home passes `summary.deferred`).
- With `review`: `drillPlan` ignores `due`; done when `newIntroduced > 0`; else "Học N cụm từ mới" when fresh > 0.
- Back-pressure, with `review.heldBack > 0`: the not-done dictation item and the not-done "Học N cụm từ mới" item are
  replaced by one `{ id: 'later', title: 'Ôn trước, học mới sau', detail: \`Còn ${heldBack} mục tồn, học mới tạm nghỉ để ôn kịp\`,
  route: 'review', done: false, progress: 0, muted: true }`.
- Without `review`, the old behaviour stays (existing tests pass).

Stats attempts: review items call `recordAttempt` with the original module (D11).

---

## 9. Sync merge (`src/core/syncMerge.ts`, CORE)

```ts
/** review-cards: { version, cards, daily, since, notice, noticeSeenAt }. Per card the later `last` wins. */
export const mergeReview: Merger = (newer, older) => { … };
```

- **cards**: `mergeMap(n.cards, o.cards, mergeReviewCard)`; when only one side's value is an object it wins over junk
  (null, string, number, array), so a corrupt copy never deletes a card.
  - Same `born` (or both without it): one copy descends from the other, the later `last` wins as a whole, with
    `d = num(a.last) - num(b.last) || num(a.reps) - num(b.reps) || num(a.interval) - num(b.interval) || num(a.lapses) - num(b.lapses) || num(a.due) - num(b.due)`
    (`a` = newer side; ties keep it), `suspended` included. `last` is monotonic per card, so a regrade built on a skewed
    future copy still wins.
  - Different `born`: two devices created the card independently (one practised before its folder copy arrived), so
    `last` says nothing. Keep the most advanced copy: graded beats never graded, then longer interval, more reps, later
    `last`. When the other copy's last grade is a miss made after the winner's `last`, the winner's due date is pulled in
    to the next local midnight after that miss at the latest (`lastGrade: 'again'`, `last` = the miss), as a miss on a
    not-due card does locally (D7). Stable when merged again with either copy.
  - `born` is set when a card is created (`applyReview` enrol, `enrolSeenCard`, reconcile) and kept by every later
    write, `resetCardState` included (a reset is a later version of the same card, so it wins by `last`).
  - Cards of kinds this build does not know (a newer build's kind) are kept by the merge; `api.write` copies them from
    the stored value into every save, so a "push" cycle never deletes them from the folder file.
- **daily**: same day → `{ ...od, ...nd, ids: union (strings only, order kept), exempt: ids exempt on every side that
  has them (a budgeted review on either device spent budget), extraSec: maxOf, enrolled: maxOf }`.
  Different days → the later `day` wins. One side missing → the other. (`extraSec` merges with max: two devices that
  each unlock 5 min end with 5 min; accepted.)
- **since**: min of the values > 0, else 0. **noticeSeenAt**: max. **notice**: the one with the later `at`.
- Return `{ ...o, ...n, cards, daily, since, notice, noticeSeenAt }`. Register `'review-cards': mergeReview`.

Known limitations (README): a device on an older build treats the key as "newer side wins", and its successful
practice after `since` is not reconciled. All devices should update; the PWA updates on the next open.

---

## 10. Tests (vitest, node env, no jsdom; logic in pure `.ts`)

**CORE**
- `time.test.ts`: `startOfLocalDay`/`localDayDiff` across a DST change (`process.env.TZ` as `progressModel.dst.test.ts`);
  every `formatDueVi`/`formatDaysVi` branch.
- `schedule.test.ts`:
  - `gradeAuto`: every row of both tables. Three consecutive `hard` from new give strictly increasing intervals (0, 1, 2).
    A lesson enrolled with `good` then graded `hard` (3/4) reaches ≥ 4 days within 4 reviews. Overdue `good` gives a
    longer interval than on-time. A lapse on a 60-day card keeps 15 days, due tomorrow. Ease floors (2.0 on hard).
    Graduated due is calendar-based across a DST change.
  - `applyReview`: every table row, including review ctx on a not-due card (practice rule), never-graded as due, retired
    lesson as due, suspended, over-budget, budgeted flag, practice floor 1 h, lesson `again` → tomorrow, `last` monotonic
    (`prev.last` in the future → `prev.last + 1`).
  - `enrolSeenCard`, `resetCardState` (absent → null), `suspendCardState`.
- `grading.test.ts`: dictation table (4 words / 1 miss → hard; 3 words / 1 miss → again; extra word counts; revealed →
  again; media 13 words / 2 errors → hard; NaN → again); `gradePairSet` (4/4, 3/4, 2/4, 2/2, 0/0); lesson table (0.9 /
  0.875 / 0.7 / 0.625); `lessonReviewItems` (listening first, `which-rule` only to fill, deterministic, rotates with reps).
- `store.test.ts`: corrupt input, `__proto__` keys, chunk keys dropped, clamping, future `last` kept raw, `suspended`
  only `true`, daily reset, `withReviewed` dedupe, `withEnrolled`, `withExtra`, `withSince`, `storesEqual`.
- `reconcile.test.ts`: each source → template; watermark (non-weak after `since` skipped, weak always); never more than
  `SEED_PER_DAY` per day including existing seeded cards; re-spread of a merged pile (24 on one day → 12 + 12); `minDay`;
  WEAK before KNOWN; `exclude`; a second run is a no-op; a foreign progress map merged in enrols the new ids.
- `queue.test.ts`: `collectEntries` (orphans, suspended, retired lessons, drill chunks, studied-today learning chunk →
  tomorrow, future `last`); learning before graduated; budget in seconds with touched exempt; `extraSec`; lesson per
  day/session; `later` ids last; min 5 items / session seconds / max 30; learn-ahead; `kinds`; interleave examples (blocks,
  tap first, phenomenon spread); `summarize` (incl. `backlogClears`, `enrolLeft` 0 when held back); `forecast` seconds;
  `kindCounts`; `estimateMinutes`; `nextAvailable`; `statesByRef`.
  **Simulation**: 60 days, budget 600 s, dict items; each day the learner reviews everything served (grades by a fixed
  hash: 85% good, 10% hard, 5% again), then, only when the start-of-day `heldBack === 0`, attempts 30 new items (20%
  failures, enrolled; successes through `enrolLeft`). Assert `heldBack <= 45` every day and mean `heldBack` of days 31–60
  ≤ mean of days 1–30 + 5.
- `copy.test.ts`: every `contextLineVi`/`growthLineVi` branch.
- `catalog.test.ts`: `has` per kind, media unit bounds, unknown pair set id rejected. `pairIndex.test.ts`: equals PAIR_SETS.
- `api.test.ts` (fake `localStorage` stub): empty history → reconcile makes no `setItem` call; a successful-but-over-budget
  answer on a store with `since 0` writes only `since`; `setItem` throwing once keeps the change in `sessionStore` and the
  next save includes both changes; `reloadReview` clears it; `recordChunkReview` on a not-due chunk with `good` → no write.
- `index.test.ts`: every export listed in §4.3 exists.
- `srs.test.ts`: existing tests unchanged + generic `buildQueue`/`countDue`/`nextDue` + `availableAt`/`isDueToday`.
- `syncMerge.test.ts`: later `last` wins either way; tie → reps → interval; seeded loses to graded; skewed future `last`
  then a local regrade wins after merge; suspension follows the later card; daily union/extraSec/enrolled; since min>0;
  notice/noticeSeenAt; junk tolerated; `mergeData` routes the key.
- `settings.test.ts`: `reviewMinutes` sanitising. `backup.test.ts`: review key round-trips. `nav.test.ts`: `#/review`.

**UI**: `sessionModel.test.ts` (`recordResult` twice at the same pos keeps one result and requeues once; lessons never
requeued; skip has no result; `remaining`/`originalDone`; summary uses the last result per id; end early).
`resolve.test.ts` (each kind resolves; orphans → null; media sentence shape; `pairReviewQuestions` deterministic, 4
distinct items, weak items first).

**HOOKS-A**: `modes.test.ts` (`dueQueue`/`countDue`); `pageModel.test.ts` (`reviewGradeFor`: cloze → null, retry → null,
`prevAttempts 0` + perfect → easy, `prevAttempts 1` + perfect → good, review mode ctx, revealed → again);
`reviewPlan.test.ts` (media: perfect → null enrol-wise, one error → hard, retry → null, session-only → null).

**HOOKS-B**: `reviewHook.test.ts` for pairs (miss → enrol, all correct under 20 answers → no enrol, ≥ 20 → enrol, grade
per set), lessons helper (0.7 enrol + good; 0.6 no enrol; existing card → `gradeLessonScore`), shadowing
(`sentence` & < 0.7 only; self `ok`/`bad` yes, `good` no).

**SURFACES**: `goals.test.ts` (`reviewPlan` three states; drill done from `newIntroduced`; back-pressure swap; `planTotal`;
old behaviour without `review`); `statsModel.test.ts` (forecast labels); `homeModel.test.ts` (new helpers);
drill `summary.test.ts` (`newIntroduced`).

Every agent, before returning: `npx tsc -b`, `npx oxlint`, `npx vitest run`, `npm run build` (the >500 kB chunk warning
is pre-existing), `npm run portable`. Formatting: single quotes, ~120 columns, match the surrounding code. Never run
prettier with defaults.

---

## 11. FILE OWNERSHIP (disjoint) and import rules

**CORE — runs first, alone.** Everything the others build on. It leaves the app compiling, with every check passing.
- New: `src/core/review/**` (`types.ts`, `constants.ts`, `ids.ts`, `time.ts`, `schedule.ts`, `grading.ts`, `store.ts`,
  `reconcile.ts`, `catalog.ts`, `queue.ts`, `copy.ts`, `api.ts`, `useReview.ts`, `index.ts` + tests), `src/data/pairIndex.ts`
  + test.
- Edit: `src/core/srs.ts` (+test), `src/core/settings.ts` (+test), `src/core/storage.ts`, `src/core/syncMerge.ts` (+test),
  `src/core/backup.test.ts`, `src/core/nav.ts` (+test), `src/main.tsx`, `src/App.tsx`, `src/components/routeIcons.ts`,
  `src/index.css`, `docs/design-system.md` (route icon + tint lines only).
- Contract prep (minimal, source-compatible, listed in §8): `features/dictation/Exercise.tsx` (`CheckedInfo` fields),
  `features/pairs/RoundView.tsx` and `features/lessons/Quiz.tsx` (`embedded` prop). After CORE these files belong to
  HOOKS-A / HOOKS-B.
- Placeholder: `src/features/review/ReviewPage.tsx`.
- Contract freeze. After CORE, the exported names and signatures in §1–§4 and the contract-prep props do not change. A
  later agent that needs a change reports it in issues instead of editing those files.

**UI — after CORE.** `src/features/review/**` only. Replaces the placeholder. May import (not edit) dictation
`Exercise`/`pageModel`/`decodeCache`, pairs `RoundView`/`game`/`store`, lessons `Quiz`/`logic`, drill
`DrillCard`/`choice`/`focus`/`chunkData`, media `library`/`store`, and `core/**`.

**HOOKS-A — after CORE.** `src/features/dictation/**`, `src/core/dictation/**`, `src/features/media/**`. Keep `Exercise`/
`ClozeExercise`/`DictationPanel` props source-compatible.

**HOOKS-B — after CORE.** `src/features/pairs/**`, `src/features/lessons/**`, `src/features/shadowing/**`. Keep `RoundView`/
`Quiz` props source-compatible. New props: `QuizResult.reviewNote?`, `RoundResults.reviewNote?`.

**SURFACES — after CORE.** `src/features/home/**`, `src/core/goals.ts` (+test), `src/components/AppNav.tsx` + `.css`,
`src/features/stats/**`, `src/features/drill/**`, `src/features/settings/**`, the `README.md` section.

UI, HOOKS-A, HOOKS-B and SURFACES run in parallel: their file sets are disjoint and they share only the frozen core API.

**Import rules (no cycles through the barrel).** `core/review/api.ts` and `reconcile.ts`/`catalog.ts` import these
modules at runtime, so they must never import `core/review` (barrel or any file, except `import type`):
`core/dictation/modes.ts`, `core/dictation/progress.ts`, `core/lessons.ts`, `core/settings.ts` (only
`core/review/constants`, a leaf), `features/pairs/game.ts`, `features/shadowing/store.ts`, `features/media/library.ts`,
`features/drill/chunkData.ts`, `features/drill/drillStore.ts`, `data/pairIndex.ts`. Hook helpers go in new files
(`features/pairs/reviewHook.ts`, `features/shadowing/reviewHook.ts`, `features/media/reviewPlan.ts`) or in
`pageModel.ts`; pure helpers import specific files (`core/review/grading`, `core/review/ids`) rather than the barrel.
Top-level constants in `core/review` must not be read during another module's initialisation.

---

## 11b. CORE implementation notes (deviations and additions, all source-compatible)

- `NEW_ENROL_PER_DAY` is 10 (see §2).
- `summarize` takes an optional 5th argument `catalog` (§3.9).
- Extra exports (not part of the frozen list, safe to use): `api.invalidateReview(now?, key?)` and
  `api.isReviewInput(shortKey)` (the snapshot cache's invalidation, used by `useReview`), `ids.isStoredKind`,
  `store.emptyDaily`, `reconcile.TEMPLATES` / `reconcile.isSeeded`, `catalog.staticContentIds` /
  `readCustomSentenceIds` / `readMediaUnits` / `CatalogInput`, `settings.sanitizeReviewMinutes`.
- The snapshot cache lives in `api.ts` (so `getReviewSnapshot` needs no React); `useReview.ts` adds the storage-event
  and clock triggers while it has subscribers. `api.ts` registers its `onAppWrite` listener lazily on first use.
- `dismissSeedNotice` writes only while the notice is unseen and sets `noticeSeenAt = max(now, notice.at)`.
- `RecordResult.saved` is true only when storage accepted the write (false for a no-op or an in-memory fallback).

### Review fixes (after the adversarial review)

- In-memory copies after a failed save (`sessionStore`, `drillSession`) are merged with the stored value
  (`mergeReview` / `mergeDrill`) on every read, so the next successful save keeps what another tab saved meanwhile.
- `catalog.readCustomSentenceIds` uses `sanitizeCustom` (the list DictationPage and the Ôn tập resolver use), so a
  duplicate custom sentence dropped there is never counted as due.
- Pair enrolments: `RecordOptions.success` / `ApplyOptions.success` (no miss although the grade is 'hard', e.g. 2/2 in
  a mixed round) make the enrolment budgeted, so it respects `enrolLeft` and D9.
- Session: "Hoàn tác" after "Không ôn mục này nữa" puts the item back right after the one on screen
  (`sessionModel.restoreItem`). The header badge "N mục hôm nay" is hidden while a session runs (its bar says
  "Còn N mục"). A chunk item stays on screen after the grade with the learner's grade and "Tiếp", so the
  "Gặp lại …" line can be read, like the other kinds.

## 12. Open decisions (findings rejected or partly accepted)

| Finding | Decision | Reason |
| --- | --- | --- |
| Embedded `RoundView`/`Quiz` edits given to HOOKS-B | Partly: the `embedded` props are added by CORE as contract prep, then HOOKS-B owns the files. | UI runs in parallel with HOOKS-B and must type-check against the prop. |
| Lesson review swaps one quiz item for a dict card with the lesson's phenomenon | Rejected for now. | Couples two kinds in one item; dict cards with that phenomenon already come back on their own. |
| Change the `--mod-review` hue | Rejected after measuring. | Lime hue ≈ 85° vs stats emerald ≈ 160°; `#4d7c0f` 4.99:1 on white, `#a3e635` ≥ 9:1 on dark surfaces. |
| Pair set enrols "on its third completed round" | Changed to `sum(seen) >= 20` first answers. | `SetStat.plays` counts only single-set rounds; mixed rounds would never count. |
| Drill new-card quota 0 while held back | Accepted with the explicit "thêm thẻ mới" override kept. | The learner can still choose to learn more. |
| Relearning cards cap-exempt | Rejected; learning cards sort first instead. | Exempting all learning cards (failures always enrol) would make the budget unbounded. |
| Studied-today chunk learning steps | The simpler option: hidden from Ôn tập until tomorrow. | The drill page already handles same-day steps. |
| Dictation "Ôn đến hạn" capped like Ôn tập | Rejected; uncapped with a muted note. | It is an explicit choice to do more; the count must match what the mode serves. |
| `extra` merged as a sum of per-device values | Rejected; max, documented. | Per-device values are not stored; rare and harmless. |
| Suspending chunks | Not supported (menu hidden for chunk items). | Chunk state lives in the unchanged drill store. |
| Reconcile catches old-build practice | Partly: weak records, lessons and media always reconcile; successful records after `since` do not. | They may have been declined by the budget; no per-id tombstones. Documented limitation. |
| Lapse ease floor | Lapses floor at `MIN_EASE` (1.3); auto `hard` floors at 2.0, as proposed. | A real repeated miss should still lower ease. |
| Pulled-in / lapsed card recalled next day | Added `RECOVER_MULT` 1.5 instead of full ease growth. | Otherwise a card missed yesterday would jump from 20 to 50 days. |
| Time budget session size | Added `MAX_SESSION_ITEMS` 30. | A session of only chunks would otherwise be 25+ items. |

---

## 13. Word cards (`word`)

The user asked for spaced repetition **per word** ("nhớ có space repetition"). A lesson card re-asks 4 quiz items and
retires at 21 days, so most words of a 15–40 word lesson never came back. Word cards fix that. The learner's weak skill
is listening, so about half of a word's reviews are listening.

### 13.1 Cards and ids

- Source: rows of `words` blocks (`WordItem`, `src/data/lessonTypes.ts`). A row makes a card when `WordItem.review` is
  true or, when absent, by course default (`WORD_REVIEW_DEFAULT` in `core/review/words.ts`): **on** for `irregular`
  and `loanwords`, **off** for `spelling` and `connected` (docs/courses.md, "words" section).
- Id: `word:<normWord(word)>~<soundKey(sound)>`, e.g. `word:read~red`, `word:read~reed`, `word:colonel~KER-nəl`,
  `word:increase~IN-krees` / `word:increase~in-KREES`. `normWord`: NFC, trimmed, single spaces, straight apostrophes,
  lower case. `soundKey`: NFC, no slashes or brackets, spaces → `-`, **case kept** (stress capitals tell stress-only
  heteronyms apart). The same word + respelling taught in two lessons is one card; a heteronym is two cards.
- `wordIndex()` (cached over `LESSONS`): `byId` (card → `WordSource`: the first row in course order, missing
  `ipa`/`note`/`why`/`mark`/`say` filled from later rows, and every lesson that teaches it), `byLesson`, `all`
  (teaching order) and `rows` (every row of every words table, review on or off: the pool for homophone checks).
- Catalog: `catalog.has('word:…')` = the ref is in the index. A word removed from the content (or whose `sound` or
  `review` changed) is an orphan: skipped by `collectEntries` and the resolver, kept in the store like any orphan.
- `StoredKind` includes `word`; `parseReviewStore`, `foreignCards`, suspend ("Không ôn mục này nữa"), reset, backup
  and `mergeReview` treat it like the other stored kinds. Older builds keep word cards as cards of an unknown kind.

### 13.2 Admission (when a word gets a card)

- A word becomes eligible when **any** lesson that teaches it is passed (`LessonRecord.completedAt > 0`, i.e. a quiz
  at or above `PASS_SCORE`).
- Cards are created **seeded** (template `WORD`: interval 0, reps 0, never graded, `last` 0, bucket 2) through the
  reconcile placement, but **outside the seeding load**: every word starts on its first day (`minDay` 1 for a lesson
  passed today, the quiz just practised them, else today), never counts against `SEED_PER_DAY` and is never re-spread.
  The queue paces them (`WORD_NEW_PER_DAY` new words a day, §13.3). Before this, waiting words filled the 8 seed slots
  a day: with 200 waiting words a weak dictation card or the words of a lesson passed today were placed weeks ahead.
  - On every page load `ensureReconciled` passes `lessonWords` (`lessonWordMap()`), so lessons passed before this
    feature (or on another device) are admitted at the existing seeding pace. Words are "always" rows (no watermark).
  - Right after a pass, `recordReview('lesson:<id>', …)` (LessonView, unchanged) also runs `reconcileWordCards` for
    that lesson in the same write, so the words are scheduled before the next page load.
- QuizResult adds one sentence to its review line (History icon) after a pass: "Bài này sẽ quay lại trong Ôn tập
  ngày mai. N từ trong bài được ôn riêng, vài từ mỗi ngày." (N = `lessonWordIds(lesson).length`; without a lesson note:
  "N từ trong bài sẽ vào lịch Ôn tập, vài từ mỗi ngày.").
- The seed notice counts word cards apart (`SeedNotice.words?`): "Đã xếp lịch ôn cho N mục bạn từng học (mỗi ngày tối
  đa 8) và M từ trong các bài bạn đã học, mỗi ngày tối đa 6 từ mới."

### 13.3 Daily admission and budget

- A **new word** = a word card never answered (`isNewWord`: kind `word`, no `lastGrade`).
- `sortDue` puts new words **after everything else**, skipped-today (`later`) items included, so `admitToday` meets
  every graded item (and knows whether one is held) before it admits a new word. Among new words: the newest first day
  first (the words of the lesson passed last before words that have waited longer: their first spaced review matters
  most), then teaching order (`ReviewEntry.rank` = `WordSource.rank`), then id. `admitToday` admits a new word only
  while `newWordsLeft > 0`, nothing is held back and budget is left; otherwise it is `deferred`, never `held` (waiting
  new words never turn back-pressure on, and back-pressure stops them).
- `summary.deferred` leaves waiting new words out; they are `summary.wordsWaiting` (with `summary.newWordsLeft`, 0
  while anything is held). Ôn tập's "Còn N mục đến hạn sẽ được chia…" callouts count `heldBack + deferred` only;
  when the budget is spent and only new words wait, the empty state offers "Ôn thêm 5 phút" only while
  `min(wordsWaiting, newWordsLeft) > 0` ("Còn N từ mới có thể bắt đầu hôm nay nếu bạn ôn thêm…").
- Learn-ahead (a short session filled with learning steps due within 20 minutes) never takes a never-graded card: a
  new word seeded for tomorrow 00:00 is not served at 23:50.
- `newWordsLeft(store, now) = max(0, min(WORD_NEW_PER_DAY − daily.newWords, NEW_ENROL_PER_DAY − daily.enrolled))`.
  The first answer of a new word in Ôn tập calls `withNewWord` (`daily.enrolled + 1`, `daily.newWords + 1`), so new
  words share the new-item budget with dictation and pairs.
- `KIND_SECONDS.word` = 15. The summary (nav badge, Home, Stats) counts words like any kind ("12 từ" in kind lines).
- `forecast(entries, now, days, store?)` moves new words beyond `WORD_NEW_PER_DAY` a day (today: `newWordsLeft`) to the
  following days, as the queue will.
- `ReviewDaily.newWords?` is optional (absent = 0). `parseReviewStore` keeps it when > 0, `storesEqual` compares it,
  `mergeReview` takes the max (written only when a side has it).
- Why 6: `words.test.ts` simulates a 15-word lesson every 2 days for 60 days at 600 s. With 6 a day, words alone settle
  at about 35 reviews a day (≈ 9 min) with no backlog; with 8 they fill the whole budget by day 50. Next to 8 new
  sentences a day the backlog stays bounded and words keep flowing in (started words first, new ones on lighter days).

### 13.4 Two modes (`features/review/wordModel.ts`, `items/WordItem.tsx`)

1. **Nghe → nhận ra** (`listen`, auto-graded). The audio plays, the spelling is not shown ("Nghe và chọn từ bạn nghe
   được", the lesson quiz's wording, or "Nghe câu. Từ nào dưới đây có trong câu?" for a sentence); the learner picks
   the written word among 3–4 options; "Không biết, xem đáp án" counts as wrong.
   - **Heteronyms** (`WordPlan.task` `'reading'`): the context sentence plays and the prompt is "Từ **read** trong câu
     bạn nghe đọc thế nào?"; the options are the readings of that spelling (`wordReadings`: every respelling of the
     word in the content, fast schwa-dropped variants left out, e.g. red / reed, IN-krees / in-KREES), shown as
     respellings; the card's own is the answer. So read~red and read~reed test the difference by ear. `gradeWordChoice`: right → `good`, wrong → `again` (requeued once
   in the session, like other kinds). After the answer: the word with its marks, respelling, IPA (setting), audio, the
   context sentence, the note and "Vì sao?" (closed), then "Tiếp". A wrong pick says how the picked word is read.
   - Audio (`wordAudio`): a `say` with more than one word (a context sentence) → that sentence; a one-word `say` → it;
     else the word.
   - Distractors (`listenDistractors`): other card words, same lesson first, then the same course, then any. Never the
     same spelling, never the same **sound** as the answer or as another option (`looseSound`: letters only, lower
     case, so homophones, the heteronym spelling of that sound and stress-only variants are all excluded), never a word
     said in the context sentence. Fewer than 2 safe distractors → the review reads instead.
2. **Đọc → nói** (`read`, self-graded). The word, plain (no marks) and big: "Đọc thử thành tiếng rồi lật thẻ", primary
   "Lật thẻ". A heteronym with a context sentence shows it under the word, text only with the word in bold ("Đọc thử từ
   này như trong câu, rồi lật thẻ"), so the learner knows which reading is asked. The back plays the audio and shows the marked word (silent letters struck), respelling, IPA when the
   setting is on, play + slow, the context sentence, the note and the `why` story **expanded**; then the four grade
   buttons (Lại · Khó · Được · Dễ with when-it-comes-back previews from `gradeAuto`), as Cụm từ. After the grade:
   "Bạn tự chấm: …" + "Tiếp". Scheduling is `gradeAuto` like every stored kind.

**Mode rule** (`chooseWordMode`, picked once per item mount, so grading never flips the view):
- new cards (never answered), cards whose last grade was `again`, and cards in a learning step (`interval 0`) → `read`
  (learn the sound before testing the ear);
- graduated cards alternate on `reps + lapses`: odd → `listen`, even → `read` (first good read → next time listen →
  read → …). A lapse resets `reps` to 1 and adds a lapse, so a word missed by ear is read once (the recovery) and then
  listened to again (alternating on `reps` alone read it twice and next listened weeks later);
- a heteronym (same spelling, another respelling: read/read, IN-krees/in-KREES; a schwa-dropped variant such as
  FA-mə-li / FAM-li is not one) listens **only in its context sentence**, else it always reads: TTS of the bare
  spelling says one reading whatever the card. A homophone (another spelling, same sound: knight/night) listens to the
  bare word: no option ever has the answer's sound (`wordAmbiguity` over `wordIndex().rows`, `listenSafe`). Every card
  of the current content can be reviewed by ear (`wordModel.test.ts`);
- no TTS in the browser → `read`.

Stats: a word review records an attempt with module `lesson` and `itemId` = the card id (`word:…`, no phenomena), so a
day of word reviews keeps the streak. `lastLessonAttemptId` skips these ids, so Home and the course list keep the
lesson the learner was last in. "Lượt luyện gần đây" shows the word and its respelling, from "Từ đã học"
(`attemptText`, `attemptSource`).

During a session the bar counts the first pass and the items coming back apart ("Còn 8 mục · 2 gặp lại"), so its
number follows today's count (the nav badge) instead of growing with each 'Lại'. The context line of a new word is "Từ mới trong bài bạn đã học".
Stats → Ôn tập adds one muted line: "Từ đã học: N từ đang ôn · M từ mới chờ vào lịch, tối đa 6 từ mỗi ngày.".

### 13.5 Files

`core/review/words.ts` (+ `words.test.ts`: ids, eligibility, index, reconcile admission, queue admission, budget,
forecast, 60-day simulations), `reconcile.ts` (`WORD` template, `lessonWords`, `reconcileWordCards`), `queue.ts`
(`isNewWord`, `newWordsLeft`, admission, forecast), `store.ts` (`withNewWord`), `grading.ts` (`gradeWordChoice`),
`api.ts` (lesson pass hook, first-answer counter), `copy.ts`; `features/review/wordModel.ts` (+ test: modes, audio,
distractor safety over the whole content), `items/WordItem.tsx`, `resolve.ts`, `ReviewPage.tsx`;
`data/lessonTypes.ts` (`review?`); `features/lessons/QuizResult.tsx` (one line); `features/stats/StatsPage.tsx`
(forecast with words, one line); `core/syncMerge.ts` (`newWords`).
