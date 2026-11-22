// IO of "Thị trấn": the stored progress (KEYS.town, synced), its React hooks, and the three calls the game makes:
//   recordTownAnswer(line, outcome)   one answered line, recorded and paid everywhere it counts
//   startTownConversation(placeId) / finishTownConversation()   a conversation of five lines and what it came to
//   buyTownItem(id)                   build an empty lot or buy a decoration with xu
// The game loops (fishing, the farm, eggs, the wardrobe, the album) have their own calls in ./gameStore.
//
// Every write is settled first (./unlocks settleTown): the eggs the listening has earned are granted and the
// achievements / town projects reached are recorded. What a write newly unlocked is queued for the shell to
// celebrate (townCelebrations / useTownCelebrations / clearTownCelebrations), whichever call made it.
//
// Like core/benchmark and core/listening, nothing is read at import time and every read compares the raw stored
// string, so data replaced by account sync, a restore or another tab is picked up without a boot step in main.tsx.

import { useMemo, useSyncExternalStore } from 'react';
import { placeLines, placeOfLineId, townPlace } from '../../data/town';
import { achievement, townProject } from '../../data/townGame';
import { deviceId } from '../history';
import { ensureReconciled, readReviewStore, recordReview, type RecordResult } from '../review/api';
import { makeCardId } from '../review/ids';
import { recordAttempt } from '../stats';
import { KEYS, loadJSON, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { fixDayTasks, type TaskPayout } from './daily';
import { applyAnswer, applyConversation, balance, buy, townLevel, type BuyRefusal, type TownItem, type TownLevel } from './economy';
import { townOverview, type TownOverview } from './overview';
import { applyEpisodeFinish, applyEpisodeGist, daysUntilRelisten, episodeDueDay, gistChoices, nextEpisode, speakerName, storyChoices, type EpisodeMode } from './episodes';
import { choiceOf, emptyTownProgress, episodeProgress, knowsFact, lineProgress, mergeTownProgress, parseTownProgress, townDay, type LineBest, type TownProgress } from './progress';
import {
  allHearts,
  applyChatFriendship,
  applyHello,
  buyGift,
  friendHearts,
  friendPoints,
  giftInHand,
  giveGift,
  heartCheer,
  metToday,
  recordChoice,
  settleFacts,
  storyFact,
  type GiftRefusal,
  type GiftTaste,
} from './friendship';
import { EGG_GRANT_LABEL, grantKind } from './eggs';
import type { FactId, StoryEpisode, StoryLine, StorySpeaker } from './story';
import { resolveEpisode, storyLineById, storyTownLine } from './storyLines';
import { typedIndex, typingTask, type TypingTask } from './typing';
import { VISIT_SIZE, type LineOutcome, type TownLine, type TownPlace, type TypedMark } from './types';
import { settleTown, type TownReviewFacts } from './unlocks';
import { choiceSeed, choicesFor, conversationLines, visitSummary, type LineChoices, type VisitSummary } from './visit';

/** Set only while the last save failed (blocked or full storage): this session's progress lives here. */
let session: TownProgress | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownProgress | null = null;
let cacheValue: TownProgress = emptyTownProgress();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.town);
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

/**
 * The progress now in storage (plus this session's unsaved changes after a failed save). Stable identity while
 * nothing changed: safe as a useSyncExternalStore snapshot.
 */
export function loadTownProgress(): TownProgress {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownProgress(parsed);
    // another tab may have saved since the failed write: what it has is kept (same rule as the sync merge)
    cacheValue = session ? mergeTownProgress(session, stored) : stored;
    cacheRaw = raw;
    cacheSession = session;
  }
  return cacheValue;
}

// ───────────────────────── celebrations ─────────────────────────

/** Something a write newly unlocked, for the shell to celebrate once. */
export interface TownCelebration {
  /** Unique: 'achievement:<id>', 'project:<id>', 'egg:<grant id>', 'friend:<placeId>:<hearts>'. */
  key: string;
  kind: 'achievement' | 'project' | 'egg' | 'friend';
  /** The achievement / project / grant id; for 'friend' the resident's place id. */
  id: string;
  /** Vietnamese, shown as it is ("Thành tích mới: Tai thính"). */
  label: string;
  /** One more line: the title it unlocks, the decoration a project adds, why the egg came. */
  detail: string;
}

let celebrations: readonly TownCelebration[] = [];
const MAX_CELEBRATIONS = 40;

function celebrationOf(kind: TownCelebration['kind'], id: string): TownCelebration | null {
  if (kind === 'achievement') {
    const a = achievement(id);
    return a ? { key: `achievement:${id}`, kind, id, label: `Thành tích mới: ${a.name}`, detail: `Danh hiệu “${a.title}”` } : null;
  }
  if (kind === 'project') {
    const p = townProject(id);
    return p ? { key: `project:${id}`, kind, id, label: `Dự án xong: ${p.name}`, detail: `Danh hiệu “${p.title}”` } : null;
  }
  const g = grantKind(id);
  return g ? { key: `egg:${id}`, kind, id, label: 'Được tặng một quả trứng', detail: EGG_GRANT_LABEL[g] } : null;
}

/** A new friendship heart with a resident (one celebration for the highest heart a write reached). */
function friendCelebrations(before: Readonly<Record<string, number>>, after: Readonly<Record<string, number>>): TownCelebration[] {
  const out: TownCelebration[] = [];
  for (const id of Object.keys(after)) {
    const a = after[id] ?? 0;
    const b = before[id] ?? 0;
    if (a <= b) continue;
    const words = heartCheer(id, b, a);
    out.push({ key: `friend:${id}:${a}`, kind: 'friend', id, label: words.label, detail: words.detail });
  }
  return out;
}

function queueCelebrations(unlocked: readonly string[], granted: readonly string[], friends: readonly TownCelebration[] = []): TownCelebration[] {
  const fresh: TownCelebration[] = [...friends];
  for (const id of unlocked) {
    const c = celebrationOf(achievement(id) ? 'achievement' : 'project', id);
    if (c) fresh.push(c);
  }
  for (const id of granted) {
    const c = celebrationOf('egg', id);
    if (c) fresh.push(c);
  }
  if (fresh.length > 0) {
    const known = new Set(celebrations.map((c) => c.key));
    celebrations = [...celebrations, ...fresh.filter((c) => !known.has(c.key))].slice(-MAX_CELEBRATIONS);
  }
  return fresh;
}

/** What is waiting to be celebrated (oldest first). Stable while nothing changes: safe as a snapshot. */
export function townCelebrations(): readonly TownCelebration[] {
  return celebrations;
}

/** Celebrated: drop these keys (all of them without an argument). */
export function clearTownCelebrations(keys?: readonly string[]): void {
  const next = keys ? celebrations.filter((c) => !keys.includes(c.key)) : [];
  if (next.length === celebrations.length) return;
  celebrations = next;
  notify();
}

/** Live list of what waits to be celebrated (page state of this tab: a reload forgets it). */
export function useTownCelebrations(): readonly TownCelebration[] {
  return useSyncExternalStore(subscribeTown, townCelebrations, townCelebrations);
}

// ───────────────────────── writing ─────────────────────────

export interface TownWrite {
  /** false: storage refused the write and the change counts for this session only. */
  saved: boolean;
  /** What the settle of this write newly unlocked (also queued as celebrations). */
  celebrations: TownCelebration[];
}

/**
 * Save `next` (built from what loadTownProgress returned just now, so another tab's changes are kept), settled first
 * (./unlocks settleTown, with `review` facts when the caller has them). Never throws.
 */
export function commitTown(next: TownProgress, now: number = Date.now(), review?: TownReviewFacts | null): TownWrite {
  let settled = { progress: next, unlocked: [] as string[], granted: [] as string[] };
  let friends: TownCelebration[] = [];
  try {
    // the first write of the day on this browser fixes its three tasks (./daily fixDayTasks), drawn from what could be
    // done before this write: a place built by it does not redraw them
    const device = knownTownDevice();
    const stored = loadTownProgress();
    const fixed = device ? fixDayTasks(next, townDay(now), device, stored) : next;
    // the facts finished episodes teach (./friendship settleFacts), then eggs and achievements (./unlocks)
    settled = settleTown(settleFacts(fixed, now), now, review);
    friends = friendCelebrations(allHearts(stored), allHearts(settled.progress));
  } catch {
    // a settle that fails must never lose the write itself
  }
  const saved = saveJSON(KEYS.town, settled.progress);
  session = saved ? null : settled.progress;
  const fresh = queueCelebrations(settled.unlocked, settled.granted, friends);
  notify();
  return { saved, celebrations: fresh };
}

/** Save `next` (see commitTown). false: storage refused the write. */
function write(next: TownProgress, now?: number): boolean {
  return commitTown(next, now).saved;
}

let lastDevice = '';

/** This browser's id: the owner of its xu bucket and of its daily counters. Made (and stored) on first use. */
export function townDevice(): string {
  lastDevice = deviceId();
  return lastDevice;
}

/**
 * The id without making one: safe while rendering (townDevice may write storage). '' until this browser has an id,
 * and a browser without an id has earned nothing and has no daily counters yet.
 */
export function knownTownDevice(): string {
  const stored = loadJSON<unknown>(KEYS.deviceId, null);
  return typeof stored === 'string' && /^[a-z0-9-]{4,40}$/.test(stored) ? stored : lastDevice;
}

let hooked = false;
export function subscribeTown(fn: () => void): () => void {
  if (!hooked) {
    hooked = true;
    // '*' = a bulk change outside saveJSON (restore, "Xóa dữ liệu")
    onAppWrite((key) => {
      if (key === KEYS.town || key === '*') notify();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.town) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Account sync or a backup replaced the stored data: forget this session's copy and tell subscribers. */
export function reloadTown(): void {
  session = null;
  cacheRaw = undefined;
  notify();
}

/** Live town progress; re-renders on every change (this tab, another tab, account sync). Stable while unchanged. */
export function useTownProgress(): TownProgress {
  return useSyncExternalStore(subscribeTown, loadTownProgress, loadTownProgress);
}

const today = (): string => townDay(Date.now());

/** The local day can only change with time: look again once a minute (a render looks again by itself). */
function subscribeDay(fn: () => void): () => void {
  const id = setInterval(fn, 60_000);
  return () => clearInterval(id);
}

/**
 * Everything the game shell shows (core/town/overview), live. The object is the same one until the progress
 * changes or the local day does (the daily tasks and the streak start again at midnight).
 */
export function useTownOverview(): TownOverview {
  const progress = useTownProgress();
  const day = useSyncExternalStore(subscribeDay, today, today);
  return useMemo(() => {
    const [y, m, d] = day.split('-').map(Number);
    return townOverview(progress, new Date(y, m - 1, d, 12).getTime(), knownTownDevice());
  }, [progress, day]);
}

// ───────────────────────── a conversation ─────────────────────────

/** One line of a conversation with its three meanings, fixed when the conversation starts. */
export interface TownTurn {
  line: TownLine;
  choices: LineChoices;
  /**
   * Set on the one line of a conversation (or of an episode's step 2) that is TYPED instead of picked (./typing,
   * docs/town.md §13): the gap to type. Absent on every other line.
   */
  typing?: TypingTask;
}

export interface TownConversationResult {
  placeId: string;
  /** One per line, in the order they were answered. */
  outcomes: LineOutcome[];
  summary: VisitSummary;
  /** Xu for all lines right (0 otherwise). */
  bonus: number;
  /** Daily tasks the conversation itself reached ("talk to 2 residents"). */
  tasksPaid: TaskPayout[];
  /** Every xu the conversation added: its lines, the bonus and every daily task paid on the way. */
  earned: number;
  balance: number;
  /** Friendship hearts with the resident before the conversation and now (0..10, ./friendship). */
  heartsBefore: number;
  heartsAfter: number;
  /** Friendship points before the conversation and now (./friendship: +15 for 3 lines understood, +5 the first of the day). */
  friendBefore: number;
  friendAfter: number;
}

interface Conversation {
  placeId: string;
  /** The lines it was started with; null = begun by an answer without startTownConversation (any VISIT_SIZE lines). */
  lineIds: string[] | null;
  answers: Map<string, TownAnswerResult>;
  outcomes: LineOutcome[];
  earned: number;
  heartsBefore: number;
  friendBefore: number;
  result: TownConversationResult | null;
}

/** The conversation going on in this tab (page state: a reload simply starts a new one). */
let conversation: Conversation | null = null;

function newConversation(placeId: string, lineIds: string[] | null, progress: TownProgress): Conversation {
  return { placeId, lineIds, answers: new Map(), outcomes: [], earned: 0, heartsBefore: friendHearts(progress, placeId), friendBefore: friendPoints(progress, placeId), result: null };
}

export type TownConversationStart =
  | { ok: true; place: TownPlace; turns: TownTurn[] }
  /** 'silent': the place has no lines to say. */
  | { ok: false; reason: 'unknown' | 'silent' };

/**
 * Begin a conversation with the resident of `placeId`: its five lines (core/town/visit pickVisitLines) with their
 * meanings already drawn, so they do not move while the learner answers. A resident whose place is not built yet
 * (a lodger at the boarding house) talks like any other. Starting again drops a conversation left in the middle
 * (its answered lines are already saved).
 */
export function startTownConversation(placeId: string): TownConversationStart {
  const place = townPlace(placeId);
  if (!place) return { ok: false, reason: 'unknown' };
  const progress = loadTownProgress();
  const lines = conversationLines(progress, placeId);
  if (lines.length === 0) {
    conversation = null;
    return { ok: false, reason: 'silent' };
  }
  const pool = placeLines(placeId);
  conversation = newConversation(placeId, lines.map((l) => l.id), progress);
  // a look-alike pair is never made of another line of this conversation (its meaning would be easy to rule out)
  const said = new Set(lines.map((l) => l.id));
  const turns: TownTurn[] = lines.map((line) => ({ line, choices: choicesFor(line, pool, choiceSeed(progress, line.id), said) }));
  // one line of the five is typed: a line never answered before if there is one; the seed moves with every answer
  const seed = lines.reduce((sum, l) => sum + choiceSeed(progress, l.id), 0);
  const typed = typedIndex(placeId, lines.map((line) => ({ line, met: choiceSeed(progress, line.id) > 0 })), seed);
  if (typed >= 0) {
    const task = typingTask(turns[typed].line.text);
    if (task) turns[typed] = { ...turns[typed], typing: task };
  }
  return { ok: true, place, turns };
}

/**
 * The conversation an answer to `line` belongs to. A started one owns its five lines for good (a second answer to
 * one of them is a repeat of the first, see recordTownAnswer). An answer outside a started conversation begins a
 * loose one at the line's place: the next lines of that place join it until it has VISIT_SIZE different ones, so a
 * shell that never calls startTownConversation still gets conversations counted.
 */
function conversationOf(line: TownLine, progress: TownProgress): Conversation | null {
  const c = conversation;
  if (c?.lineIds?.includes(line.id)) return c;
  const placeId = placeOfLineId(line.id);
  if (c && !c.lineIds && !c.result && c.placeId === placeId && !c.answers.has(line.id)) return c;
  if (!placeId || !townPlace(placeId)) return null;
  conversation = newConversation(placeId, null, progress);
  return conversation;
}

/**
 * What the conversation going on came to: set once all its lines are answered (the last recordTownAnswer already
 * counted it and paid the bonus; this only reads, so calling it twice pays nothing twice). null while lines are
 * missing or when none was started.
 */
export function finishTownConversation(): TownConversationResult | null {
  return conversation?.result ?? null;
}

// ───────────────────────── recording an answer ─────────────────────────

/**
 * A missed line whose sentence has no card yet becomes its dictation card in Ôn tập (as a miss in Chép chính tả
 * would); a missed line of an episode, its own card `talk:<line id>`. A card that exists is never touched: a wrong
 * meaning here says less than a dictation, so it must not move a schedule the learner earned there. null = nothing
 * enrolled.
 */
function enrolMissed(kind: 'dict' | 'talk', ref: string, now: number): RecordResult | null {
  try {
    const id = makeCardId(kind, ref);
    // practice from before the review system gets its cards first, so "no card" really means never practised
    ensureReconciled(now);
    if (Object.prototype.hasOwnProperty.call(readReviewStore(now).cards, id)) return null;
    const r = recordReview(id, 'again', { ctx: 'practice', enrol: true, now });
    return r.reason === 'enrolled' ? r : null;
  } catch {
    return null;
  }
}

export interface TownAnswerResult {
  outcome: LineOutcome;
  /** The line's best before this answer (0 never understood, 1 with replays, 2 on the first listen). */
  prevBest: LineBest;
  /** Xu for the line itself: 3, 2, 1 or 0 (core/town/economy lineReward). */
  reward: number;
  /** Xu for a perfect conversation, on the answer that completed it (0 otherwise). */
  bonus: number;
  /** Daily tasks this answer reached and paid (the conversation's own task included on its last line). */
  tasksPaid: TaskPayout[];
  /** Every xu this answer added: reward + bonus + the tasks paid. */
  earned: number;
  /** Xu to spend after this answer. */
  balance: number;
  levelBefore: TownLevel;
  levelAfter: TownLevel;
  /** levelAfter is a new title. */
  leveledUp: boolean;
  /** The place the line is said at (undefined for a line outside the town's own). */
  placeId: string | undefined;
  /** Friendship hearts with its resident before and after this answer (0..10, ./friendship). */
  heartsBefore: number;
  heartsAfter: number;
  /**
   * Set when this miss put the sentence into Ôn tập: give it to reviewNoteVi (features/dictation/pageModel) for the
   * usual muted "Câu này sẽ quay lại trong Ôn tập …" line. null otherwise (right answer, or the card existed).
   */
  review: RecordResult | null;
  /** Set on the answer that completed the conversation (the same value finishTownConversation returns). */
  conversation: TownConversationResult | null;
  /** The line was a typed check (./typing) and how it went; null for a pick. */
  typed: TypedMark | null;
  /** Of `reward`, the extra for a line typed right (./economy TYPED_BONUS). */
  typedXu: number;
  progress: TownProgress;
  /** false: storage refused the town write (the answer counts for this session only). */
  saved: boolean;
}

/**
 * One answered line, recorded everywhere: the line's record, its xu, the day's counters and any daily task just
 * reached (core/town/economy applyAnswer); on the last line of a conversation also the conversation (bonus, "talk"
 * counter); one practice attempt (module 'town', no phenomenon counters: a wrong meaning does not say which sound
 * was missed); Ôn tập for a miss (enrolMissed). Never throws.
 *
 * A line answered twice within one conversation (a double click, a React effect run twice) is recorded once: the
 * second call returns the first result. `typed`: the line was a typed check (./typing), counted on its own and paid
 * a little more when typed right (./economy applyAnswer).
 */
export function recordTownAnswer(line: TownLine, outcome: LineOutcome, now: number = Date.now(), typed: TypedMark | null = null): TownAnswerResult {
  const before = loadTownProgress();
  const conv = conversationOf(line, before);
  const again = conv?.answers.get(line.id);
  if (again) return again;

  const device = townDevice();
  const placeId = placeOfLineId(line.id);
  const heartsBefore = placeId ? friendHearts(before, placeId) : 0;
  const answer = applyAnswer(before, line.id, outcome, now, device, typed);
  let next = answer.progress;
  let bonus = 0;
  const tasksPaid = [...answer.tasksPaid];
  let ended: { tasksPaid: TaskPayout[] } | null = null;
  if (conv) {
    conv.outcomes.push(outcome);
    const complete = conv.lineIds ? conv.lineIds.every((id) => id === line.id || conv.answers.has(id)) : conv.outcomes.length >= VISIT_SIZE;
    if (complete) {
      // the first conversation of the day with them: read before this one is noted
      const firstToday = !metToday(next, conv.placeId, now);
      const end = applyConversation(next, conv.placeId, conv.outcomes, now, device);
      if (end.finished) {
        const understood = conv.outcomes.filter((o) => o !== 'wrong').length;
        next = applyChatFriendship(end.progress, conv.placeId, understood, firstToday, now, device).progress;
        bonus = end.bonus;
        tasksPaid.push(...end.tasksPaid);
        ended = { tasksPaid: end.tasksPaid };
      }
    }
  }
  const saved = next === before ? true : write(next, now);
  const progress = loadTownProgress();

  try {
    recordAttempt({ at: now, module: 'town', itemId: line.sentenceId ?? line.id, correct: outcome !== 'wrong', seen: [], missed: [] });
  } catch {
    // stats are best effort: the town progress above is what the game needs
  }
  const review = outcome === 'wrong' && line.sentenceId ? enrolMissed('dict', line.sentenceId, now) : null;

  const earned = answer.reward + bonus + tasksPaid.reduce((sum, t) => sum + t.reward, 0);
  const heartsAfter = placeId ? friendHearts(progress, placeId) : 0;
  const levelBefore = townLevel(before);
  const levelAfter = townLevel(progress);
  const result: TownAnswerResult = {
    outcome,
    prevBest: answer.prevBest,
    reward: answer.reward,
    bonus,
    tasksPaid,
    earned,
    balance: balance(progress),
    levelBefore,
    levelAfter,
    leveledUp: levelAfter.index > levelBefore.index,
    placeId,
    heartsBefore,
    heartsAfter,
    review,
    conversation: null,
    typed,
    typedXu: answer.typedXu,
    progress,
    saved,
  };
  if (conv) {
    conv.earned += earned;
    if (ended) {
      conv.result = {
        placeId: conv.placeId,
        outcomes: [...conv.outcomes],
        summary: visitSummary(conv.outcomes),
        bonus,
        tasksPaid: ended.tasksPaid,
        earned: conv.earned,
        balance: result.balance,
        heartsBefore: conv.heartsBefore,
        heartsAfter: friendHearts(progress, conv.placeId),
        friendBefore: conv.friendBefore,
        friendAfter: friendPoints(progress, conv.placeId),
      };
      result.conversation = conv.result;
    }
    conv.answers.set(line.id, result);
  }
  return result;
}

// ───────────────────────── an episode ("Chuyện ở thị trấn", ./episodes) ─────────────────────────

/** A choice line of an episode as the panel offers it: its options (by intent), and the one chosen before, if any. */
export interface TownEpisodePick {
  options: { id: string; intent: string; text: string; vi: string; say?: string }[];
  /** The option chosen the first time (it stays chosen: replays play it); null = not chosen yet. */
  chosen: string | null;
}

/** One line of an episode as said now, with its three meanings and who says it. */
export interface TownEpisodeTurn extends TownTurn {
  who: StorySpeaker;
  /** 'Bạn' for the learner's character, else the resident's name. */
  speaker: string;
  /** The episode's own line this turn stands for (`line.id` is the option or variant said, ./storyLines). */
  base: string;
  /** A choice line: the learner picks what to say (no meaning to pick); null for every other line. */
  pick: TownEpisodePick | null;
}

/** A fact newly known, with its words for the Sổ tay. */
export interface TownFactNote {
  id: FactId;
  vi: string;
}

export type TownEpisodeStart =
  | {
      ok: true;
      place: TownPlace;
      episode: StoryEpisode;
      /** 'new': the three steps; 'relisten': the whole exchange and the gist only. */
      mode: EpisodeMode;
      turns: TownEpisodeTurn[];
      /** The gist question's options in their shown order (./episodes gistChoices). */
      gist: LineChoices;
      /** Per turn: the learner had answered that line before (its words were shown then). */
      met: boolean[];
      /** This is the episode's very first listen: a right gist after one whole listen is the honest win. */
      firstListen: boolean;
    }
  /** 'none': nothing waits there now (no episode open or due, or the next one waits for the house): the quick chat. */
  | { ok: false; reason: 'unknown' | 'none' };

export interface TownEpisodeResult {
  episodeId: string;
  placeId: string;
  mode: EpisodeMode;
  /** The gist was right (null: not answered). */
  gistRight: boolean | null;
  /** Right after exactly one whole listen, on the episode's very first listen. */
  gistFirstWin: boolean;
  /** Lines answered in this run / of them understood (any listen). 0 / 0 for a re-listen. Choice lines not counted. */
  lines: number;
  linesRight: number;
  /** Xu: the lines, the gist (first win or re-listen), the first finish, the daily tasks; `earned` = all of them. */
  lineXu: number;
  gistXu: number;
  finishXu: number;
  tasksPaid: TaskPayout[];
  earned: number;
  balance: number;
  /** This run finished the episode for the first time. */
  firstFinish: boolean;
  /** The episode's stage now and when it comes back for a re-listen (local day, null = never again). */
  stage: number;
  nextDue: string | null;
  /** Whole days until that re-listen, null when none is scheduled. */
  daysToNext: number | null;
  /** The new title when a level was reached during the run. */
  levelTitle: string | null;
  /** Friendship points with the resident before the run and now (./friendship). */
  friendBefore: number;
  friendAfter: number;
  /** Facts the run taught (choices, the finish), for "Ghi vào Sổ tay". */
  learned: TownFactNote[];
}

export interface TownEpisodeGistResult {
  right: boolean;
  firstWin: boolean;
  /** Xu for the gist itself. */
  reward: number;
  /** Re-listen: daily tasks reached (it counts as a conversation). */
  tasksPaid: TaskPayout[];
  earned: number;
  balance: number;
  /** A re-listen is over with its gist: its result (null for a new episode, which goes on line by line). */
  result: TownEpisodeResult | null;
  progress: TownProgress;
  saved: boolean;
}

export interface TownChoiceResult {
  /** This pick was the first on that line: it counted (points, facts). */
  first: boolean;
  /** The option that stays chosen (the first one ever). */
  chosen: string;
  /** Friendship points it brought (0 when not the first). */
  points: number;
  learned: TownFactNote[];
  /** Every line of the episode as said now (a later line may now say a variant the new fact calls for). */
  turns: TownEpisodeTurn[];
  saved: boolean;
}

interface EpisodeRun {
  episode: StoryEpisode;
  mode: EpisodeMode;
  /** Base ids of the lines to answer (every line but the choice lines). */
  need: Set<string>;
  /** Base ids of the choice lines, and what was picked on them in this run. */
  choiceLines: Set<string>;
  picks: Map<string, string>;
  gist: TownEpisodeGistResult | null;
  /** By base line id. */
  answers: Map<string, TownAnswerResult>;
  outcomes: LineOutcome[];
  lineXu: number;
  gistXu: number;
  tasks: TaskPayout[];
  earned: number;
  levelBefore: TownLevel;
  friendBefore: number;
  factsBefore: Set<string>;
  /** The base line of step 2 that is typed (./typing), null when none. */
  typedBase: string | null;
  result: TownEpisodeResult | null;
}

/** The episode going on in this tab (page state: a reload starts it again from its first listen). */
let episodeRun: EpisodeRun | null = null;

function factNotes(ids: readonly FactId[]): TownFactNote[] {
  return ids.map((id) => ({ id, vi: storyFact(id)?.fact.vi ?? '' })).filter((f) => f.vi);
}

/**
 * Every line of `episode` as said now in `progress` (facts known, choices made), with its meanings. The line whose
 * base is `typedBase` is typed (./typing) when what it says now has a gap.
 */
export function episodeTurns(episode: StoryEpisode, progress: TownProgress, typedBase: string | null = null): TownEpisodeTurn[] {
  const resolved = resolveEpisode(
    episode,
    (f) => knowsFact(progress, f),
    (id) => choiceOf(progress, id)?.o ?? null,
  );
  return resolved.map((r): TownEpisodeTurn => {
    const line = storyTownLine(r, episode);
    const pick: TownEpisodePick | null = r.choice
      ? { options: r.choice.options.map((c) => ({ id: c.id, intent: c.intent, text: c.text, vi: c.vi, ...(c.say ? { say: c.say } : {}) })), chosen: r.choice.chosen }
      : null;
    const typing = !pick && typedBase !== null && r.base === typedBase ? typingTask(line.text) : null;
    return {
      line,
      choices: pick ? { options: [], answer: 0 } : storyChoices(r.id, episode, choiceSeed(progress, r.id)),
      who: r.who,
      speaker: speakerName(r.who, episode.placeId),
      base: r.base,
      pick,
      ...(typing ? { typing } : {}),
    };
  });
}

/**
 * The base line of a new episode's step 2 that is typed (./typing typedIndex): one of its plain lines (never a choice),
 * a line never answered before first. null for a re-listen (it has no step 2) or when no line has a gap.
 */
function episodeTypedBase(episode: StoryEpisode, progress: TownProgress, mode: EpisodeMode): string | null {
  if (mode !== 'new') return null;
  const turns = episodeTurns(episode, progress);
  const seed = turns.reduce((sum, t) => sum + choiceSeed(progress, t.line.id), 0) + (episodeProgress(progress, episode.id)?.stage ?? 0);
  const i = typedIndex(
    episode.id,
    turns.map((t) => ({ line: t.line, met: choiceSeed(progress, t.line.id) > 0, eligible: !t.pick })),
    seed,
  );
  return i >= 0 ? turns[i].base : null;
}

/**
 * Begin what a conversation at `placeId` is now when an episode waits there (./episodes nextEpisode): a due
 * re-listen first, else the next episode to hear, with the meanings of every line and the order of the gist's
 * options already drawn. `{ ok: false, reason: 'none' }`: nothing waits, the shell runs the quick chat. Starting
 * again drops a run left in the middle (its answered lines are already saved).
 */
export function startTownEpisode(placeId: string, now: number = Date.now()): TownEpisodeStart {
  const place = townPlace(placeId);
  if (!place) return { ok: false, reason: 'unknown' };
  const progress = loadTownProgress();
  const next = nextEpisode(progress, placeId, now);
  if (!next) return { ok: false, reason: 'none' };
  const { episode, mode } = next;
  const e = episodeProgress(progress, episode.id);
  const typedBase = episodeTypedBase(episode, progress, mode);
  const turns = episodeTurns(episode, progress, typedBase);
  episodeRun = {
    episode,
    mode,
    need: new Set(episode.lines.filter((l) => !l.choices?.length).map((l) => l.id)),
    choiceLines: new Set(episode.lines.filter((l) => l.choices?.length).map((l) => l.id)),
    picks: new Map(),
    gist: null,
    answers: new Map(),
    outcomes: [],
    lineXu: 0,
    gistXu: 0,
    tasks: [],
    earned: 0,
    levelBefore: townLevel(progress),
    friendBefore: friendPoints(progress, placeId),
    factsBefore: new Set(Object.keys(progress.facts)),
    typedBase,
    result: null,
  };
  return {
    ok: true,
    place,
    episode,
    mode,
    turns,
    gist: gistChoices(episode, (e?.stage ?? 0) + (e?.firstGist ? 1 : 0)),
    met: turns.map((t) => (lineProgress(progress, t.line.id)?.tries ?? 0) > 0),
    firstListen: mode === 'new' && (e?.firstGist ?? 0) === 0,
  };
}

function episodeResult(run: EpisodeRun, progress: TownProgress, finish: { firstFinish: boolean; reward: number } | null, now: number): TownEpisodeResult {
  const e = episodeProgress(progress, run.episode.id);
  const level = townLevel(progress);
  return {
    episodeId: run.episode.id,
    placeId: run.episode.placeId,
    mode: run.mode,
    gistRight: run.gist ? run.gist.right : null,
    gistFirstWin: run.gist?.firstWin ?? false,
    lines: run.outcomes.length,
    linesRight: run.outcomes.filter((o) => o !== 'wrong').length,
    lineXu: run.lineXu,
    gistXu: run.gistXu,
    finishXu: finish?.reward ?? 0,
    tasksPaid: [...run.tasks],
    earned: run.earned,
    balance: balance(progress),
    firstFinish: finish?.firstFinish ?? false,
    stage: e?.stage ?? 0,
    nextDue: episodeDueDay(e),
    daysToNext: daysUntilRelisten(e, now),
    levelTitle: level.index > run.levelBefore.index ? level.title : null,
    friendBefore: run.friendBefore,
    friendAfter: friendPoints(progress, run.episode.placeId),
    learned: factNotes(Object.keys(progress.facts).filter((id) => !run.factsBefore.has(id))),
  };
}

/**
 * The gist of the episode going on, answered after `passes` whole listens (./episodes applyEpisodeGist): recorded
 * and paid. A re-listen ends with it (`result` is set; the first conversation of the day with the resident adds its
 * friendship points). Answered twice in one run: the first answer is returned. null when no episode was started.
 * Never throws.
 */
export function recordEpisodeGist(right: boolean, passes: number, now: number = Date.now()): TownEpisodeGistResult | null {
  const run = episodeRun;
  if (!run) return null;
  if (run.gist) return run.gist;
  const before = loadTownProgress();
  const device = townDevice();
  const firstToday = !metToday(before, run.episode.placeId, now);
  const eff = applyEpisodeGist(before, run.episode, run.mode, right, passes, now, device);
  const after = run.mode === 'relisten' && eff.progress !== before ? applyHello(eff.progress, run.episode.placeId, firstToday, device).progress : eff.progress;
  const saved = after === before ? true : write(after, now);
  const progress = loadTownProgress();
  try {
    recordAttempt({ at: now, module: 'town', itemId: `${run.episode.id}:gist`, correct: right, seen: [], missed: [] });
  } catch {
    // stats are best effort
  }
  const earned = eff.reward + eff.tasksPaid.reduce((sum, t) => sum + t.reward, 0);
  run.gistXu += eff.reward;
  run.tasks.push(...eff.tasksPaid);
  run.earned += earned;
  const gist: TownEpisodeGistResult = { right, firstWin: eff.firstWin, reward: eff.reward, tasksPaid: eff.tasksPaid, earned, balance: balance(progress), result: null, progress, saved };
  run.gist = gist;
  if (run.mode === 'relisten') {
    run.result = episodeResult(run, progress, null, now);
    gist.result = run.result;
  }
  return gist;
}

/**
 * The learner picked option `optionId` on choice line `lineId` (a base line id) of the episode going on
 * (./friendship recordChoice): the first pick on a line ever is kept, teaches its facts and counts its points; a
 * later one changes nothing (the first stays and is what plays). Returns the lines as said now. null when no episode
 * runs or the line is not one of its choice lines. Never throws.
 */
export function recordEpisodeChoice(lineId: string, optionId: string, now: number = Date.now()): TownChoiceResult | null {
  const run = episodeRun;
  if (!run || !run.choiceLines.has(lineId)) return null;
  const before = loadTownProgress();
  const w = recordChoice(before, run.episode, lineId, optionId, now);
  if (!w) return null;
  const saved = w.progress === before ? true : write(w.progress, now);
  const progress = loadTownProgress();
  run.picks.set(lineId, choiceOf(progress, lineId)?.o ?? w.chosen);
  return { first: w.first, chosen: run.picks.get(lineId) ?? w.chosen, points: w.points, learned: factNotes(w.learned), turns: episodeTurns(run.episode, progress, run.typedBase), saved };
}

/**
 * One line of the episode going on, answered: recorded and paid like any line of the town (./economy applyAnswer:
 * xu, the day's counters, the daily tasks), one practice attempt (module 'town'), and for a miss its own review card
 * (`talk:<line id>`: the option or variant said has its own) when it has none. A line answered twice in one run is
 * recorded once. Never throws.
 */
export function recordEpisodeLine(line: TownLine, outcome: LineOutcome, now: number = Date.now(), typed: TypedMark | null = null): TownAnswerResult {
  const found = storyLineById(line.id);
  const base = found?.line.base ?? line.id;
  const run = episodeRun && episodeRun.need.has(base) ? episodeRun : null;
  const again = run?.answers.get(base);
  if (again) return again;
  const before = loadTownProgress();
  const device = townDevice();
  const placeId = run?.episode.placeId ?? found?.episode.placeId;
  const hearts = placeId ? friendHearts(before, placeId) : 0;
  const answer = applyAnswer(before, line.id, outcome, now, device, typed);
  const saved = answer.progress === before ? true : write(answer.progress, now);
  const progress = loadTownProgress();
  try {
    recordAttempt({ at: now, module: 'town', itemId: line.id, correct: outcome !== 'wrong', seen: [], missed: [] });
  } catch {
    // stats are best effort
  }
  const review = outcome === 'wrong' && found ? enrolMissed('talk', line.id, now) : null;
  const earned = answer.reward + answer.tasksPaid.reduce((sum, t) => sum + t.reward, 0);
  const levelBefore = townLevel(before);
  const levelAfter = townLevel(progress);
  const result: TownAnswerResult = {
    outcome,
    prevBest: answer.prevBest,
    reward: answer.reward,
    bonus: 0,
    tasksPaid: answer.tasksPaid,
    earned,
    balance: balance(progress),
    levelBefore,
    levelAfter,
    leveledUp: levelAfter.index > levelBefore.index,
    placeId,
    // friendship comes with the finish, not with a single line
    heartsBefore: hearts,
    heartsAfter: placeId ? friendHearts(progress, placeId) : 0,
    review,
    conversation: null,
    typed,
    typedXu: answer.typedXu,
    progress,
    saved,
  };
  if (run) {
    run.answers.set(base, result);
    run.outcomes.push(outcome);
    run.lineXu += answer.reward;
    run.tasks.push(...answer.tasksPaid);
    run.earned += earned;
  }
  return result;
}

/**
 * The episode going on is heard through (its lines answered, its choices picked, the whole exchange heard again):
 * finished and paid (./episodes applyEpisodeFinish; the facts of its `learn` are learned with the write, ./friendship
 * settleFacts; the first conversation of the day with the resident adds its points), and what the run came to. The
 * second call returns the same result. null when no new episode is going on, or a line is still unanswered. A
 * re-listen's result comes with its gist (recordEpisodeGist). Never throws.
 */
export function finishTownEpisode(now: number = Date.now()): TownEpisodeResult | null {
  const run = episodeRun;
  if (!run) return null;
  if (run.result) return run.result;
  if (run.mode !== 'new' || run.answers.size < run.need.size) return null;
  const before = loadTownProgress();
  if ([...run.choiceLines].some((id) => !run.picks.has(id) && !choiceOf(before, id))) return null;
  const device = townDevice();
  const firstToday = !metToday(before, run.episode.placeId, now);
  const eff = applyEpisodeFinish(before, run.episode, run.outcomes.filter((o) => o !== 'wrong').length, now, device);
  const after = eff.progress !== before ? applyHello(eff.progress, run.episode.placeId, firstToday, device).progress : eff.progress;
  if (after !== before) write(after, now);
  const progress = loadTownProgress();
  const earned = eff.reward + eff.tasksPaid.reduce((sum, t) => sum + t.reward, 0);
  run.tasks.push(...eff.tasksPaid);
  run.earned += earned;
  run.result = episodeResult(run, progress, { firstFinish: eff.firstFinish, reward: eff.reward }, now);
  return run.result;
}

// ───────────────────────── gifts ("Thân thiết", ./friendship) ─────────────────────────

export type TownGiftBuy = { ok: true; balance: number; inHand: number; saved: boolean } | { ok: false; reason: 'unknown' | 'poor' | 'device'; missing: number; balance: number };

/** Buy one gift with xu (Tiệm quà). Refused when unknown or the balance is too low: nothing is written then. */
export function buyTownGift(giftId: string, now: number = Date.now()): TownGiftBuy {
  const before = loadTownProgress();
  const r = buyGift(before, giftId, townDevice());
  if (!r.ok) return { ok: false, reason: r.reason, missing: r.missing, balance: balance(before) };
  const saved = write(r.progress, now);
  const progress = loadTownProgress();
  return { ok: true, balance: balance(progress), inHand: giftInHand(progress, giftId), saved };
}

export type TownGiftGive =
  | {
      ok: true;
      taste: GiftTaste;
      /** Friendship points it really moved. */
      points: number;
      /** The resident's voiced reaction (null while the content has none). */
      reaction: StoryLine | null;
      friendBefore: number;
      friendAfter: number;
      celebrations: TownCelebration[];
      saved: boolean;
    }
  | { ok: false; reason: GiftRefusal };

/** Give a gift to the resident of `placeId` (one a day each): their reaction and the friendship points. */
export function giveTownGift(placeId: string, giftId: string, now: number = Date.now()): TownGiftGive {
  const before = loadTownProgress();
  const r = giveGift(before, placeId, giftId, now, townDevice());
  if (!r.ok) return r;
  const w = commitTown(r.progress, now);
  const progress = loadTownProgress();
  return { ok: true, taste: r.taste, points: r.points, reaction: r.reaction, friendBefore: friendPoints(before, placeId), friendAfter: friendPoints(progress, placeId), celebrations: w.celebrations, saved: w.saved };
}

// ───────────────────────── buying ─────────────────────────

export type TownBuyResult =
  | { ok: true; item: TownItem; balance: number; progress: TownProgress; saved: boolean }
  /** `missing`: xu still to earn when the reason is 'poor'. */
  | { ok: false; reason: BuyRefusal; item: TownItem | null; missing: number; balance: number };

/**
 * Build an empty lot or buy a decoration with xu (core/town/economy buy). Refused when the id is unknown, already
 * owned, or the balance is too low: nothing is written then. Bought things stay bought.
 */
export function buyTownItem(id: string): TownBuyResult {
  const r = buy(loadTownProgress(), id);
  if (!r.ok) return { ok: false, reason: r.reason, item: r.item, missing: r.missing, balance: r.balance };
  const saved = write(r.progress);
  const progress = loadTownProgress();
  return { ok: true, item: r.item, balance: balance(progress), progress, saved };
}
