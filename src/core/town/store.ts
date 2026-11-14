// IO of "Thị trấn": the stored progress (KEYS.town, synced), its React hooks, and the three calls the game makes:
//   recordTownAnswer(line, outcome)   one answered line, recorded and paid everywhere it counts
//   startTownConversation(placeId) / finishTownConversation()   a conversation of five lines and what it came to
//   buyTownItem(id)                   build an empty lot or buy a decoration with xu
//
// Like core/benchmark and core/listening, nothing is read at import time and every read compares the raw stored
// string, so data replaced by folder sync, a restore or another tab is picked up without a boot step in main.tsx.

import { useMemo, useSyncExternalStore } from 'react';
import { placeLines, placeOfLineId, townPlace } from '../../data/town';
import { deviceId } from '../history';
import { ensureReconciled, readReviewStore, recordReview, type RecordResult } from '../review/api';
import { makeCardId } from '../review/ids';
import { recordAttempt } from '../stats';
import { KEYS, loadJSON, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import type { TaskPayout } from './daily';
import { applyAnswer, applyConversation, balance, buy, isBuilt, placeHearts, townLevel, type BuyRefusal, type TownItem, type TownLevel } from './economy';
import { placeStats, townOverview, type TownOverview } from './overview';
import { applyEpisodeFinish, applyEpisodeGist, daysUntilRelisten, episodeDueDay, gistChoices, nextEpisode, speakerName, storyChoices, type EpisodeMode } from './episodes';
import { emptyTownProgress, episodeProgress, lineProgress, mergeTownProgress, parseTownProgress, townDay, type LineBest, type TownProgress } from './progress';
import type { StoryEpisode, StorySpeaker } from './story';
import { episodeTownLines, storyLineById } from './storyLines';
import { VISIT_SIZE, type LineOutcome, type TownLine, type TownPlace } from './types';
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

/**
 * Save `next` (built from what loadTownProgress returned just now, so another tab's changes are kept). false:
 * storage refused the write and the change counts for this session only.
 */
function write(next: TownProgress): boolean {
  const saved = saveJSON(KEYS.town, next);
  session = saved ? null : next;
  notify();
  return saved;
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
function knownDevice(): string {
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

/** Folder sync or a backup replaced the stored data: forget this session's copy and tell subscribers. */
export function reloadTown(): void {
  session = null;
  cacheRaw = undefined;
  notify();
}

/** Live town progress; re-renders on every change (this tab, another tab, folder sync). Stable while unchanged. */
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
    return townOverview(progress, new Date(y, m - 1, d, 12).getTime(), knownDevice());
  }, [progress, day]);
}

// ───────────────────────── a conversation ─────────────────────────

/** One line of a conversation with its three meanings, fixed when the conversation starts. */
export interface TownTurn {
  line: TownLine;
  choices: LineChoices;
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
  /** Friendship with the resident before the conversation and now (0..5). */
  heartsBefore: number;
  heartsAfter: number;
}

interface Conversation {
  placeId: string;
  /** The lines it was started with; null = begun by an answer without startTownConversation (any VISIT_SIZE lines). */
  lineIds: string[] | null;
  answers: Map<string, TownAnswerResult>;
  outcomes: LineOutcome[];
  earned: number;
  heartsBefore: number;
  result: TownConversationResult | null;
}

/** The conversation going on in this tab (page state: a reload simply starts a new one). */
let conversation: Conversation | null = null;

function newConversation(placeId: string, lineIds: string[] | null, progress: TownProgress): Conversation {
  return { placeId, lineIds, answers: new Map(), outcomes: [], earned: 0, heartsBefore: placeHearts(placeStats(progress, { id: placeId })), result: null };
}

export type TownConversationStart =
  | { ok: true; place: TownPlace; turns: TownTurn[] }
  /** 'empty-lot': the place is not built yet. */
  | { ok: false; reason: 'unknown' | 'empty-lot' };

/**
 * Begin a conversation with the resident of `placeId`: its five lines (core/town/visit pickVisitLines) with their
 * meanings already drawn, so they do not move while the learner answers. Refused for an empty lot. Starting again
 * drops a conversation left in the middle (its answered lines are already saved).
 */
export function startTownConversation(placeId: string): TownConversationStart {
  const place = townPlace(placeId);
  if (!place) return { ok: false, reason: 'unknown' };
  const progress = loadTownProgress();
  const lines = conversationLines(progress, placeId);
  if (lines.length === 0) {
    conversation = null;
    return { ok: false, reason: 'empty-lot' };
  }
  const pool = placeLines(placeId);
  conversation = newConversation(placeId, lines.map((l) => l.id), progress);
  return { ok: true, place, turns: lines.map((line) => ({ line, choices: choicesFor(line, pool, choiceSeed(progress, line.id)) })) };
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
  if (!placeId || !isBuilt(progress, placeId)) return null;
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
  /** Friendship with its resident before and after this answer (0..5). */
  heartsBefore: number;
  heartsAfter: number;
  /**
   * Set when this miss put the sentence into Ôn tập: give it to reviewNoteVi (features/dictation/pageModel) for the
   * usual muted "Câu này sẽ quay lại trong Ôn tập …" line. null otherwise (right answer, or the card existed).
   */
  review: RecordResult | null;
  /** Set on the answer that completed the conversation (the same value finishTownConversation returns). */
  conversation: TownConversationResult | null;
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
 * second call returns the first result.
 */
export function recordTownAnswer(line: TownLine, outcome: LineOutcome, now: number = Date.now()): TownAnswerResult {
  const before = loadTownProgress();
  const conv = conversationOf(line, before);
  const again = conv?.answers.get(line.id);
  if (again) return again;

  const device = townDevice();
  const placeId = placeOfLineId(line.id);
  const heartsBefore = placeId ? placeHearts(placeStats(before, { id: placeId })) : 0;
  const answer = applyAnswer(before, line.id, outcome, now, device);
  let next = answer.progress;
  let bonus = 0;
  const tasksPaid = [...answer.tasksPaid];
  let ended: { tasksPaid: TaskPayout[] } | null = null;
  if (conv) {
    conv.outcomes.push(outcome);
    const complete = conv.lineIds ? conv.lineIds.every((id) => id === line.id || conv.answers.has(id)) : conv.outcomes.length >= VISIT_SIZE;
    if (complete) {
      const end = applyConversation(next, conv.placeId, conv.outcomes, now, device);
      if (end.finished) {
        next = end.progress;
        bonus = end.bonus;
        tasksPaid.push(...end.tasksPaid);
        ended = { tasksPaid: end.tasksPaid };
      }
    }
  }
  const saved = next === before ? true : write(next);
  const progress = loadTownProgress();

  try {
    recordAttempt({ at: now, module: 'town', itemId: line.sentenceId ?? line.id, correct: outcome !== 'wrong', seen: [], missed: [] });
  } catch {
    // stats are best effort: the town progress above is what the game needs
  }
  const review = outcome === 'wrong' && line.sentenceId ? enrolMissed('dict', line.sentenceId, now) : null;

  const earned = answer.reward + bonus + tasksPaid.reduce((sum, t) => sum + t.reward, 0);
  const heartsAfter = placeId ? placeHearts(placeStats(progress, { id: placeId })) : 0;
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
        heartsAfter,
      };
      result.conversation = conv.result;
    }
    conv.answers.set(line.id, result);
  }
  return result;
}

// ───────────────────────── an episode ("Chuyện ở thị trấn", ./episodes) ─────────────────────────

/** One line of an episode with its three meanings and who says it. */
export interface TownEpisodeTurn extends TownTurn {
  who: StorySpeaker;
  /** 'Bạn' for the learner's character, else the resident's name. */
  speaker: string;
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
  /** 'none': nothing waits there now (no episode open or due): the quick chat. */
  | { ok: false; reason: 'unknown' | 'empty-lot' | 'none' };

export interface TownEpisodeResult {
  episodeId: string;
  placeId: string;
  mode: EpisodeMode;
  /** The gist was right (null: not answered). */
  gistRight: boolean | null;
  /** Right after exactly one whole listen, on the episode's very first listen. */
  gistFirstWin: boolean;
  /** Lines answered in this run / of them understood (any listen). 0 / 0 for a re-listen. */
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

interface EpisodeRun {
  episode: StoryEpisode;
  mode: EpisodeMode;
  lineIds: Set<string>;
  gist: TownEpisodeGistResult | null;
  answers: Map<string, TownAnswerResult>;
  outcomes: LineOutcome[];
  lineXu: number;
  gistXu: number;
  tasks: TaskPayout[];
  earned: number;
  levelBefore: TownLevel;
  result: TownEpisodeResult | null;
}

/** The episode going on in this tab (page state: a reload starts it again from its first listen). */
let episodeRun: EpisodeRun | null = null;

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
  if (!isBuilt(progress, placeId)) return { ok: false, reason: 'empty-lot' };
  const next = nextEpisode(progress, placeId, now);
  if (!next) return { ok: false, reason: 'none' };
  const { episode, mode } = next;
  const e = episodeProgress(progress, episode.id);
  const lines = episodeTownLines(episode);
  const turns = lines.map((line, i): TownEpisodeTurn => {
    const who = episode.lines[i].who;
    return { line, choices: storyChoices(line.id, episode, choiceSeed(progress, line.id)), who, speaker: speakerName(who, placeId) };
  });
  episodeRun = {
    episode,
    mode,
    lineIds: new Set(lines.map((l) => l.id)),
    gist: null,
    answers: new Map(),
    outcomes: [],
    lineXu: 0,
    gistXu: 0,
    tasks: [],
    earned: 0,
    levelBefore: townLevel(progress),
    result: null,
  };
  return {
    ok: true,
    place,
    episode,
    mode,
    turns,
    gist: gistChoices(episode, (e?.stage ?? 0) + (e?.firstGist ? 1 : 0)),
    met: lines.map((l) => (lineProgress(progress, l.id)?.tries ?? 0) > 0),
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
  };
}

/**
 * The gist of the episode going on, answered after `passes` whole listens (./episodes applyEpisodeGist): recorded
 * and paid. A re-listen ends with it (`result` is set). Answered twice in one run: the first answer is returned.
 * null when no episode was started. Never throws.
 */
export function recordEpisodeGist(right: boolean, passes: number, now: number = Date.now()): TownEpisodeGistResult | null {
  const run = episodeRun;
  if (!run) return null;
  if (run.gist) return run.gist;
  const before = loadTownProgress();
  const device = townDevice();
  const eff = applyEpisodeGist(before, run.episode, run.mode, right, passes, now, device);
  const saved = eff.progress === before ? true : write(eff.progress);
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
 * One line of the episode going on, answered: recorded and paid like any line of the town (./economy applyAnswer:
 * xu, the day's counters, the daily tasks), one practice attempt (module 'town'), and for a miss its own review card
 * (`talk:<line id>`) when it has none. A line answered twice in one run is recorded once. Never throws.
 */
export function recordEpisodeLine(line: TownLine, outcome: LineOutcome, now: number = Date.now()): TownAnswerResult {
  const run = episodeRun && episodeRun.lineIds.has(line.id) ? episodeRun : null;
  const again = run?.answers.get(line.id);
  if (again) return again;
  const before = loadTownProgress();
  const device = townDevice();
  const placeId = run?.episode.placeId ?? storyLineById(line.id)?.episode.placeId;
  const hearts = placeId ? placeHearts(placeStats(before, { id: placeId })) : 0;
  const answer = applyAnswer(before, line.id, outcome, now, device);
  const saved = answer.progress === before ? true : write(answer.progress);
  const progress = loadTownProgress();
  try {
    recordAttempt({ at: now, module: 'town', itemId: line.id, correct: outcome !== 'wrong', seen: [], missed: [] });
  } catch {
    // stats are best effort
  }
  const review = outcome === 'wrong' && storyLineById(line.id) ? enrolMissed('talk', line.id, now) : null;
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
    // hearts come from the place's own sentences: a line of an episode never moves them
    heartsBefore: hearts,
    heartsAfter: placeId ? placeHearts(placeStats(progress, { id: placeId })) : 0,
    review,
    conversation: null,
    progress,
    saved,
  };
  if (run) {
    run.answers.set(line.id, result);
    run.outcomes.push(outcome);
    run.lineXu += answer.reward;
    run.tasks.push(...answer.tasksPaid);
    run.earned += earned;
  }
  return result;
}

/**
 * The episode going on is heard through (its lines answered, the whole exchange heard again): finished and paid
 * (./episodes applyEpisodeFinish), and what the run came to. The second call returns the same result. null when no
 * new episode is going on, or a line is still unanswered. A re-listen's result comes with its gist
 * (recordEpisodeGist). Never throws.
 */
export function finishTownEpisode(now: number = Date.now()): TownEpisodeResult | null {
  const run = episodeRun;
  if (!run) return null;
  if (run.result) return run.result;
  if (run.mode !== 'new' || run.answers.size < run.lineIds.size) return null;
  const before = loadTownProgress();
  const device = townDevice();
  const eff = applyEpisodeFinish(before, run.episode, run.outcomes.filter((o) => o !== 'wrong').length, now, device);
  if (eff.progress !== before) write(eff.progress);
  const progress = loadTownProgress();
  const earned = eff.reward + eff.tasksPaid.reduce((sum, t) => sum + t.reward, 0);
  run.tasks.push(...eff.tasksPaid);
  run.earned += earned;
  run.result = episodeResult(run, progress, { firstFinish: eff.firstFinish, reward: eff.reward }, now);
  return run.result;
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
