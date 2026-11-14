// The economy of "Thị trấn": what understanding a line pays, what xu buy, and what the town shows for it. Pure.
//
// The one rule: every xu comes from understanding spoken English. Nothing here pays for time spent, for opening
// the page or for a wrong answer; nothing can be bought with anything but xu.
//
//   a line understood on the first listen (not yet at that level)   3 xu
//   a line understood with replays or a slower play (first time)    2 xu
//   a right answer that does not raise the line                     1 xu
//   a wrong answer                                                  0
//   a conversation of 5 lines with all 5 right                     +5 xu
//   the three daily tasks (./daily)                                 5 + 8 + 10 xu, once a day each
//
// Balance = xu earned (all browsers) − the cost of everything bought. Level, hearts and lit windows are derived
// from the lines understood, never stored.

import { placeLines, TOWN_DECORATIONS, TOWN_PLACES, townDecoration, townPlace } from '../../data/town';
import { noteConversation, noteLine, type TaskPayout } from './daily';
import { addBought, addEarned, earnedTotal, hasBought, isLineId, lineProgress, linesStats, recordLine, type LineBest, type TownProgress, type TownStats } from './progress';
import { VISIT_SIZE, type LineOutcome, type TownPlace } from './types';

// ───────────────────────── earning ─────────────────────────

export const LINE_REWARD = { first: 3, replayed: 2, again: 1 } as const;
export const CONVERSATION_BONUS = 5;

/**
 * Xu for one answered line whose best so far was `prevBest`. A right answer that raises the line pays for the level
 * it reaches (3 for the first listen, 2 for a replayed one); a right answer that leaves the line where it was pays 1
 * (so hearing a known line again is worth something, and replaying one line for xu is not worth much).
 */
export function lineReward(prevBest: LineBest, outcome: LineOutcome): number {
  if (outcome === 'first') return prevBest < 2 ? LINE_REWARD.first : LINE_REWARD.again;
  if (outcome === 'replayed') return prevBest < 1 ? LINE_REWARD.replayed : LINE_REWARD.again;
  return 0;
}

/** A conversation is perfect when it has all its lines (`size`) and none is wrong. */
export function isPerfect(outcomes: readonly LineOutcome[], size: number = VISIT_SIZE): boolean {
  return size > 0 && outcomes.length >= size && outcomes.every((o) => o === 'first' || o === 'replayed');
}

export function conversationBonus(outcomes: readonly LineOutcome[], size: number = VISIT_SIZE): number {
  return isPerfect(outcomes, size) ? CONVERSATION_BONUS : 0;
}

// ───────────────────────── buying ─────────────────────────

export type TownItemKind = 'place' | 'decoration';

export interface TownItem {
  id: string;
  kind: TownItemKind;
  name: string;
  cost: number;
}

/** A place or a decoration by id (ids never collide: data/town.test). */
export function townItem(id: string): TownItem | undefined {
  const p = townPlace(id);
  if (p) return { id: p.id, kind: 'place', name: p.name, cost: p.cost };
  const d = townDecoration(id);
  return d ? { id: d.id, kind: 'decoration', name: d.name, cost: d.cost } : undefined;
}

/** Xu spent: the cost of every bought id the town knows (an id of a later version costs nothing here). */
export function spentTotal(progress: TownProgress): number {
  let sum = 0;
  for (const id of progress.bought) sum += townItem(id)?.cost ?? 0;
  return sum;
}

/**
 * Earned − spent. It can be below 0 after two machines each spent the same xu before syncing: nothing is taken
 * back, the learner simply earns the difference before the next purchase.
 */
export function rawBalance(progress: TownProgress): number {
  return earnedTotal(progress) - spentTotal(progress);
}

/** The xu the learner can spend now: never shown below 0. */
export function balance(progress: TownProgress): number {
  return Math.max(0, rawBalance(progress));
}

/** A place stands when it is free or was bought. Unknown id: false. */
export function isBuilt(progress: TownProgress, placeId: string): boolean {
  const p = townPlace(placeId);
  return !!p && (p.cost <= 0 || hasBought(progress, p.id));
}

/** Whether the learner has it: a built place (the three free ones always) or a bought decoration. */
export function owns(progress: TownProgress, id: string): boolean {
  return townPlace(id) ? isBuilt(progress, id) : !!townDecoration(id) && hasBought(progress, id);
}

/** The places that stand, in their listed order. */
export function builtPlaces(progress: TownProgress): TownPlace[] {
  return TOWN_PLACES.filter((p) => isBuilt(progress, p.id));
}

export function boughtDecorationIds(progress: TownProgress): string[] {
  return TOWN_DECORATIONS.filter((d) => hasBought(progress, d.id)).map((d) => d.id);
}

export type BuyRefusal = 'unknown' | 'owned' | 'poor';

export type BuyCheck =
  | { ok: true; item: TownItem }
  /** `missing`: xu still to earn ('poor' only, otherwise 0). */
  | { ok: false; reason: BuyRefusal; item: TownItem | null; missing: number };

/** Whether `id` can be bought now: it exists, is not owned yet, and the balance covers its cost. */
export function canBuy(progress: TownProgress, id: string): BuyCheck {
  const item = typeof id === 'string' ? townItem(id) : undefined;
  if (!item) return { ok: false, reason: 'unknown', item: null, missing: 0 };
  if (owns(progress, id)) return { ok: false, reason: 'owned', item, missing: 0 };
  const missing = item.cost - rawBalance(progress);
  return missing > 0 ? { ok: false, reason: 'poor', item, missing } : { ok: true, item };
}

export type BuyResult = (BuyCheck & { progress: TownProgress }) & { balance: number };

/** The progress after buying `id` (the input is not changed). A refused purchase returns the same progress. */
export function buy(progress: TownProgress, id: string): BuyResult {
  const check = canBuy(progress, id);
  if (!check.ok) return { ...check, progress, balance: balance(progress) };
  const next = addBought(progress, id);
  return { ...check, progress: next, balance: balance(next) };
}

// ───────────────────────── level ─────────────────────────

export const XP_FIRST = 3;
export const XP_REPLAYED = 2;

export const TOWN_LEVELS: readonly { at: number; title: string }[] = [
  { at: 0, title: 'Khách lạ' },
  { at: 15, title: 'Người quen' },
  { at: 40, title: 'Hàng xóm' },
  { at: 80, title: 'Cư dân' },
  { at: 150, title: 'Người của thị trấn' },
  { at: 300, title: 'Thị trưởng' },
];

export interface TownLevel {
  /** 0-based index in TOWN_LEVELS. */
  index: number;
  title: string;
  xp: number;
  /** Xp at which the next title comes, null at the last one. */
  nextAt: number | null;
  /** The next title, null at the last one. */
  nextTitle: string | null;
  /** 0..1 of the way from this title to the next (1 at the last one). */
  progress: number;
}

/** 3 per line understood on the first listen + 2 per line understood only with replays. */
export function xpOf(stats: Pick<TownStats, 'understood' | 'first'>): number {
  const first = Math.max(0, stats.first);
  return XP_FIRST * first + XP_REPLAYED * Math.max(0, stats.understood - first);
}

export function levelFor(xp: number): TownLevel {
  const x = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let index = 0;
  for (let i = 0; i < TOWN_LEVELS.length; i++) if (x >= TOWN_LEVELS[i].at) index = i;
  const here = TOWN_LEVELS[index];
  const next = TOWN_LEVELS[index + 1] ?? null;
  return {
    index,
    title: here.title,
    xp: x,
    nextAt: next ? next.at : null,
    nextTitle: next ? next.title : null,
    progress: next ? (x - here.at) / (next.at - here.at) : 1,
  };
}

/** Counts over every line of the town (records of lines that no longer exist are not counted). */
export function townTotals(progress: TownProgress): TownStats {
  const out: TownStats = { total: 0, understood: 0, first: 0 };
  for (const p of TOWN_PLACES) {
    const s = linesStats(progress, placeLines(p.id));
    out.total += s.total;
    out.understood += s.understood;
    out.first += s.first;
  }
  return out;
}

export function townXp(progress: TownProgress): number {
  return xpOf(townTotals(progress));
}

export function townLevel(progress: TownProgress): TownLevel {
  return levelFor(townXp(progress));
}

// ───────────────────────── a place: lit windows, hearts, marker ─────────────────────────

/** 0..1: the share of a place's lines that are understood. Its windows light up with it. */
export function placeLit(stats: Pick<TownStats, 'total' | 'understood'>): number {
  return stats.total > 0 ? Math.min(1, Math.max(0, stats.understood / stats.total)) : 0;
}

/**
 * Friendship with the resident, 0..5 hearts, from the same share: hearts at 10 / 30 / 50 / 70 % of the lines
 * understood, the fifth only when every line is.
 */
export function placeHearts(stats: Pick<TownStats, 'total' | 'understood'>): number {
  const lit = placeLit(stats);
  if (stats.total > 0 && stats.understood >= stats.total) return 5;
  return Math.min(4, Math.round(lit * 5));
}

/**
 * What waits at a built place: 'new' = lines not understood yet, 'repeat' = every line understood, some only with
 * replays (worth hearing again for the first listen), 'heart' = every line understood on the first listen.
 */
export type PlaceMarker = 'new' | 'repeat' | 'heart';

export function placeMarker(stats: TownStats): PlaceMarker {
  if (stats.understood < stats.total || stats.total === 0) return 'new';
  return stats.first < stats.total ? 'repeat' : 'heart';
}

// ───────────────────────── one answered line, one finished conversation ─────────────────────────

export interface AnswerEffect {
  progress: TownProgress;
  /** Xu for the line itself. */
  reward: number;
  /** Daily tasks this line reached (already paid into `progress`). */
  tasksPaid: TaskPayout[];
  /** The line's best before this answer. */
  prevBest: LineBest;
}

/**
 * Everything one answered line changes, in one step: the line's record, its xu (into the bucket of `device`), the
 * day's counters and any daily task just reached. The input is not changed. An unusable line id changes nothing.
 */
export function applyAnswer(progress: TownProgress, lineId: string, outcome: LineOutcome, now: number, device: string): AnswerEffect {
  const prevBest = (isLineId(lineId) && lineProgress(progress, lineId)?.best) || 0;
  const recorded = recordLine(progress, lineId, outcome, now);
  if (recorded === progress) return { progress, reward: 0, tasksPaid: [], prevBest };
  const reward = lineReward(prevBest, outcome);
  const noted = noteLine(addEarned(recorded, device, reward), outcome, now, device);
  return { progress: noted.progress, reward, tasksPaid: noted.tasksPaid, prevBest };
}

export interface ConversationEffect {
  progress: TownProgress;
  /** false: not a whole conversation at a built place, so nothing was counted or paid. */
  finished: boolean;
  /** Every line right. */
  perfect: boolean;
  /** Xu for a perfect conversation (0 otherwise). */
  bonus: number;
  /** Daily tasks the conversation reached (already paid into `progress`). */
  tasksPaid: TaskPayout[];
}

/**
 * A conversation of `outcomes` (one per line, in order) that just ended at `placeId`: the bonus for a perfect one,
 * the day's conversation counter and any daily task just reached. Fewer than VISIT_SIZE outcomes (the learner left
 * early) or a place that is not built: nothing happens.
 */
export function applyConversation(progress: TownProgress, placeId: string, outcomes: readonly LineOutcome[], now: number, device: string): ConversationEffect {
  if (outcomes.length < VISIT_SIZE || !isBuilt(progress, placeId)) return { progress, finished: false, perfect: false, bonus: 0, tasksPaid: [] };
  const bonus = conversationBonus(outcomes);
  const noted = noteConversation(addEarned(progress, device, bonus), placeId, now, device);
  return { progress: noted.progress, finished: true, perfect: bonus > 0, bonus, tasksPaid: noted.tasksPaid };
}

/** Xu a perfect first conversation pays without the daily tasks: five first-listen lines and the bonus. */
export const PERFECT_CONVERSATION_XU = VISIT_SIZE * LINE_REWARD.first + CONVERSATION_BONUS;
