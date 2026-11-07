// Pure game logic for "Phân biệt âm" (minimal pairs). No DOM, no storage access.
import type { LessonMeta } from '../../core/lessons';
import type { Phenomenon } from '../../core/types';
import type { PairItem, PairSet } from '../../data/pairs';

/* ------------------------------------------------------------------ */
/* Progress model                                                      */
/* ------------------------------------------------------------------ */

export interface ItemStat {
  seen: number; // first answers given (re-queues excluded)
  correct: number; // first answers that were correct
  streak: number; // consecutive correct first answers
  lastAt: number; // epoch ms of the last answer, 0 = never
}

export interface SetStat {
  best: number; // best single-set round score 0..1
  plays: number; // single-set rounds completed
  lastAt: number;
}

export interface PairsProgress {
  items: Record<string, ItemStat>;
  sets: Record<string, SetStat>;
}

export function emptyProgress(): PairsProgress {
  return { items: {}, sets: {} };
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function timestamp(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Ids are short slugs; anything else (incl. "__proto__") is dropped. */
function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) && id !== '__proto__' && id !== 'constructor' && id !== 'prototype';
}

/** Repair whatever came out of storage; never throws. */
export function sanitizeProgress(raw: unknown): PairsProgress {
  const out = emptyProgress();
  if (!isRecord(raw)) return out;
  if (isRecord(raw.items)) {
    for (const [id, v] of Object.entries(raw.items)) {
      if (!isSafeId(id) || !isRecord(v)) continue;
      const seen = count(v.seen);
      if (seen === 0) continue;
      const correct = Math.min(seen, count(v.correct));
      const streak = Math.min(correct, count(v.streak));
      out.items[id] = { seen, correct, streak, lastAt: timestamp(v.lastAt) };
    }
  }
  if (isRecord(raw.sets)) {
    for (const [id, v] of Object.entries(raw.sets)) {
      if (!isSafeId(id) || !isRecord(v)) continue;
      const best = typeof v.best === 'number' && Number.isFinite(v.best) ? Math.min(1, Math.max(0, v.best)) : 0;
      out.sets[id] = { best, plays: count(v.plays), lastAt: timestamp(v.lastAt) };
    }
  }
  return out;
}

/** Update an item's stats after its first answer in a round. */
export function applyAnswer(progress: PairsProgress, itemId: string, correct: boolean, now: number): PairsProgress {
  const prev = progress.items[itemId] ?? { seen: 0, correct: 0, streak: 0, lastAt: 0 };
  const next: ItemStat = {
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    streak: correct ? prev.streak + 1 : 0,
    lastAt: now,
  };
  return { ...progress, items: { ...progress.items, [itemId]: next } };
}

/** Record a completed single-set round. */
export function applySetResult(progress: PairsProgress, setId: string, score: number, now: number): PairsProgress {
  const prev = progress.sets[setId] ?? { best: 0, plays: 0, lastAt: 0 };
  const s = Math.min(1, Math.max(0, Number.isFinite(score) ? score : 0));
  return {
    ...progress,
    sets: { ...progress.sets, [setId]: { best: Math.max(prev.best, s), plays: prev.plays + 1, lastAt: now } },
  };
}

/** Two correct first answers in a row = mastered. */
export function isMastered(stat: ItemStat | undefined): boolean {
  return !!stat && stat.streak >= 2;
}

/** Seen and the last answer was wrong, or accuracy below 60%. */
export function isWeak(stat: ItemStat | undefined): boolean {
  if (!stat || stat.seen === 0) return false;
  return stat.streak === 0 || stat.correct / stat.seen < 0.6;
}

const DAY = 86_400_000;

/**
 * How urgently an item should be practised (higher = sooner).
 * Weak items > new items > shaky items > mastered items; long-unseen items drift up.
 */
export function itemPriority(stat: ItemStat | undefined, now: number): number {
  if (!stat || stat.seen === 0) return 1.5;
  const errorRate = 1 - stat.correct / stat.seen;
  const lastWrong = stat.streak === 0 ? 1 : 0;
  const staleDays = stat.lastAt > 0 ? Math.max(0, (now - stat.lastAt) / DAY) : 30;
  const staleness = Math.min(1, staleDays / 14) * 0.6;
  const confidence = Math.min(stat.streak, 4) * 0.25;
  return errorRate * 1.5 + lastWrong * 1.2 + staleness - confidence + 0.5;
}

export interface SetMastery {
  total: number;
  seen: number;
  mastered: number;
  weak: number;
}

export function setMastery(set: PairSet, progress: PairsProgress): SetMastery {
  let seen = 0;
  let mastered = 0;
  let weak = 0;
  for (const it of set.items) {
    const st = progress.items[it.id];
    if (st && st.seen > 0) seen += 1;
    if (isMastered(st)) mastered += 1;
    if (isWeak(st)) weak += 1;
  }
  return { total: set.items.length, seen, mastered, weak };
}

/** Item ids the learner is currently weak on, weakest first. */
export function weakItemIds(sets: readonly PairSet[], progress: PairsProgress, now: number): string[] {
  const out: { id: string; p: number }[] = [];
  for (const s of sets) {
    for (const it of s.items) {
      const st = progress.items[it.id];
      if (isWeak(st)) out.push({ id: it.id, p: itemPriority(st, now) });
    }
  }
  return out.sort((a, b) => b.p - a.p || a.id.localeCompare(b.id)).map((x) => x.id);
}

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

/** mulberry32: small, fast, deterministic PRNG returning [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Round building                                                      */
/* ------------------------------------------------------------------ */

export const ROUND_SIZE = 10;
/** Random jitter added to priority so rounds vary between plays. */
const JITTER = 0.4;

export interface Question {
  key: string; // unique within a round
  setId: string;
  itemId: string;
  answer: number; // index into item.options that is played
  requeue: boolean; // true for the second chance after a wrong answer
}

export interface BuildOptions {
  seed: number;
  now: number;
  size?: number;
  /** Restrict to these item ids (e.g. "luyện câu hay sai"). */
  onlyItemIds?: readonly string[];
}

/** Max questions from one set in a mixed round, so the round stays varied. */
export function perSetCap(setCount: number, size: number): number {
  if (setCount <= 1) return size;
  return Math.max(2, Math.ceil(size / Math.min(setCount, size)) + 1);
}

/** Pick up to `size` distinct items, weakest first (with jitter), then shuffle. */
export function buildRound(sets: readonly PairSet[], progress: PairsProgress, opts: BuildOptions): Question[] {
  const size = Math.max(1, opts.size ?? ROUND_SIZE);
  const rng = createRng(opts.seed);
  const only = opts.onlyItemIds ? new Set(opts.onlyItemIds) : null;
  const seenIds = new Set<string>();
  const candidates: { set: PairSet; item: PairItem; score: number }[] = [];
  for (const set of sets) {
    for (const item of set.items) {
      if (item.options.length < 2 || seenIds.has(item.id)) continue;
      if (only && !only.has(item.id)) continue;
      seenIds.add(item.id);
      candidates.push({ set, item, score: itemPriority(progress.items[item.id], opts.now) + rng() * JITTER });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const setCount = new Set(candidates.map((c) => c.set.id)).size;
  const cap = perSetCap(setCount, size);
  const picked: typeof candidates = [];
  const perSet = new Map<string, number>();
  for (const c of candidates) {
    if (picked.length >= size) break;
    const n = perSet.get(c.set.id) ?? 0;
    if (n >= cap) continue;
    perSet.set(c.set.id, n + 1);
    picked.push(c);
  }
  if (picked.length < size) {
    for (const c of candidates) {
      if (picked.length >= size) break;
      if (!picked.includes(c)) picked.push(c);
    }
  }
  return shuffle(picked, rng).map((c) => ({
    key: `${c.item.id}#0`,
    setId: c.set.id,
    itemId: c.item.id,
    answer: Math.floor(rng() * c.item.options.length),
    requeue: false,
  }));
}

/* ------------------------------------------------------------------ */
/* Round state                                                         */
/* ------------------------------------------------------------------ */

/** A wrong item comes back after this many other questions (or at the end). */
export const REQUEUE_GAP = 3;

export interface AnswerRecord {
  key: string;
  setId: string;
  itemId: string;
  answer: number;
  choice: number;
  correct: boolean;
  requeue: boolean;
}

export interface RoundState {
  queue: Question[];
  index: number;
  answers: AnswerRecord[];
}

export function startRound(queue: readonly Question[]): RoundState {
  return { queue: queue.slice(), index: 0, answers: [] };
}

export function currentQuestion(state: RoundState): Question | null {
  return state.queue[state.index] ?? null;
}

export function answerFor(state: RoundState, key: string): AnswerRecord | null {
  return state.answers.find((a) => a.key === key) ?? null;
}

export function isFinished(state: RoundState): boolean {
  return state.index >= state.queue.length;
}

/** Index at which a re-queued question is inserted. */
export function requeuePosition(index: number, queueLength: number, gap: number = REQUEUE_GAP): number {
  return Math.min(queueLength, index + 1 + Math.max(0, gap));
}

/**
 * Answer the current question. A wrong first answer re-queues the item once,
 * later in the round; `replayAnswer` chooses which option the second chance plays.
 */
export function submitAnswer(state: RoundState, choice: number, replayAnswer?: number): RoundState {
  const q = currentQuestion(state);
  if (!q || answerFor(state, q.key) || !Number.isInteger(choice) || choice < 0) return state;
  const correct = choice === q.answer;
  const record: AnswerRecord = {
    key: q.key,
    setId: q.setId,
    itemId: q.itemId,
    answer: q.answer,
    choice,
    correct,
    requeue: q.requeue,
  };
  let queue = state.queue;
  const alreadyRequeued = queue.some((x) => x.itemId === q.itemId && x.requeue);
  if (!correct && !q.requeue && !alreadyRequeued) {
    const pos = requeuePosition(state.index, queue.length);
    const again: Question = {
      key: `${q.itemId}#1`,
      setId: q.setId,
      itemId: q.itemId,
      answer: replayAnswer ?? q.answer,
      requeue: true,
    };
    queue = [...queue.slice(0, pos), again, ...queue.slice(pos)];
  }
  return { queue, index: state.index, answers: [...state.answers, record] };
}

/** Move to the next question (only once the current one is answered). */
export function advance(state: RoundState): RoundState {
  const q = currentQuestion(state);
  if (!q || !answerFor(state, q.key)) return state;
  return { ...state, index: state.index + 1 };
}

/** Number of questions answered for the first time / planned first questions. */
export function firstQuestionCount(state: RoundState): number {
  return state.queue.filter((q) => !q.requeue).length;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export interface SetBreakdown {
  setId: string;
  total: number;
  correct: number;
}

export interface MissedItem {
  setId: string;
  itemId: string;
  answer: number; // option that was played
  choice: number; // option the learner picked
  recovered: boolean | null; // second chance result; null if not reached
}

export interface RoundSummary {
  total: number; // first answers given
  correct: number;
  score: number; // 0..1, first answers only
  requeued: number; // second chances answered
  recovered: number; // second chances answered correctly
  bySet: SetBreakdown[];
  missed: MissedItem[];
}

export function summarizeRound(state: RoundState): RoundSummary {
  const firsts = state.answers.filter((a) => !a.requeue);
  const seconds = state.answers.filter((a) => a.requeue);
  const bySetMap = new Map<string, SetBreakdown>();
  for (const a of firsts) {
    const b = bySetMap.get(a.setId) ?? { setId: a.setId, total: 0, correct: 0 };
    b.total += 1;
    if (a.correct) b.correct += 1;
    bySetMap.set(a.setId, b);
  }
  const correct = firsts.filter((a) => a.correct).length;
  const missed: MissedItem[] = firsts
    .filter((a) => !a.correct)
    .map((a) => {
      const second = seconds.find((s) => s.itemId === a.itemId);
      return {
        setId: a.setId,
        itemId: a.itemId,
        answer: a.answer,
        choice: a.choice,
        recovered: second ? second.correct : null,
      };
    });
  return {
    total: firsts.length,
    correct,
    score: firsts.length ? correct / firsts.length : 0,
    requeued: seconds.length,
    recovered: seconds.filter((s) => s.correct).length,
    bySet: [...bySetMap.values()].sort((a, b) => a.correct / a.total - b.correct / b.total || a.setId.localeCompare(b.setId)),
    missed,
  };
}

export interface ScoreTier {
  tone: 'great' | 'good' | 'practice';
  title: string;
  detail: string;
}

export function scoreTier(score: number, total: number): ScoreTier {
  if (total === 0) return { tone: 'practice', title: 'Chưa có câu nào', detail: 'Hãy trả lời ít nhất một câu để xem kết quả.' };
  if (score >= 0.9) return { tone: 'great', title: 'Tai rất thính!', detail: 'Bạn phân biệt gần như hoàn hảo. Thử bộ khó hơn hoặc trộn tất cả.' };
  if (score >= 0.7) return { tone: 'good', title: 'Khá tốt!', detail: 'Bạn đã nắm được phần lớn. Nghe so sánh lại các câu sai bên dưới.' };
  return {
    tone: 'practice',
    title: 'Cần luyện thêm',
    detail: 'Đừng lo — đây chính là những chỗ người học hay nhầm. Xem lại bài học rồi chơi lại nhé.',
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function setsForFocus(sets: readonly PairSet[], focus: Phenomenon | null): PairSet[] {
  return focus ? sets.filter((s) => s.phenomenon === focus) : sets.slice();
}

/** Lesson of course "connected" that teaches a phenomenon; falls back to the phenomenon id itself. */
export function lessonIdFor(phenomenon: Phenomenon, lessons: readonly LessonMeta[]): string {
  return lessons.find((l) => l.course === 'connected' && l.phenomenon === phenomenon)?.id ?? phenomenon;
}

/** Keyboard digit (1-based) → option index, or -1. */
export function optionIndexForKey(key: string, optionCount: number): number {
  if (!/^[1-9]$/.test(key)) return -1;
  const i = Number(key) - 1;
  return i < optionCount ? i : -1;
}

export type RoundKeyAction =
  | { type: 'choose'; index: number } // answer with option `index`
  | { type: 'compare'; index: number } // after answering: play option `index`
  | { type: 'replay' }
  | { type: 'slow' }
  | { type: 'next' }
  | { type: 'block' }; // swallow the key (prevent page scroll / auto-repeat)

export interface RoundKeyContext {
  answered: boolean;
  optionCount: number;
  /** Focus is on a button/link: let Enter/Space activate it natively. */
  onControl: boolean;
  /** Focus is in a text field, or a modifier (Ctrl/Alt/Meta) is held. */
  ignore: boolean;
  /** KeyboardEvent.repeat (key held down). */
  repeat: boolean;
}

/** Map a keydown during a round to an action; null = leave the event alone. */
export function roundKeyAction(key: string, ctx: RoundKeyContext): RoundKeyAction | null {
  if (ctx.ignore) return null;
  const idx = optionIndexForKey(key, ctx.optionCount);
  if (idx >= 0) {
    if (ctx.repeat) return { type: 'block' };
    return ctx.answered ? { type: 'compare', index: idx } : { type: 'choose', index: idx };
  }
  const k = key.toLowerCase();
  if (k === 'r' || k === 's') {
    if (ctx.repeat) return { type: 'block' };
    return k === 'r' ? { type: 'replay' } : { type: 'slow' };
  }
  if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
    // Holding Enter must not skip several questions, even on a focused button.
    if (ctx.repeat) return { type: 'block' };
    if (ctx.onControl) return null;
    return ctx.answered ? { type: 'next' } : { type: 'replay' };
  }
  return null;
}

export function percent(x: number): number {
  return Math.round(Math.min(1, Math.max(0, x)) * 100);
}

/* ------------------------------------------------------------------ */
/* Route <-> round sync                                                */
/* ------------------------------------------------------------------ */

/** The round a pairs URL asks for: `?set=<id>` or `?mode=mix[&focus=]`; null = the picker. */
export type RouteRound = { kind: 'set'; setId: string } | { kind: 'mix'; focus: Phenomenon | null } | null;

/** Read the round a pairs URL names. A `set` that does not exist names no round. */
export function roundForRoute(
  params: { set?: string; mode?: string },
  focus: Phenomenon | null,
  hasSet: (id: string) => boolean,
): RouteRound {
  const set = params.set ?? '';
  if (set) return hasSet(set) ? { kind: 'set', setId: set } : null;
  if (params.mode === 'mix') return { kind: 'mix', focus };
  return null;
}

/**
 * What to do with the running round when the URL changes:
 * - 'start': begin the round the URL names,
 * - 'clear': the URL names no round (AppNav, a filter chip, Back) → show the picker,
 * - 'keep':  the running round already matches the URL.
 */
export function routeSyncAction(
  current: { kind: string; setId?: string; focus?: Phenomenon | null } | null,
  want: RouteRound,
): 'start' | 'clear' | 'keep' {
  if (!want) return current ? 'clear' : 'keep';
  if (current?.kind === want.kind) {
    if (want.kind === 'set' && current.setId === want.setId) return 'keep';
    if (want.kind === 'mix' && (current.focus ?? null) === want.focus) return 'keep';
  }
  return 'start';
}
