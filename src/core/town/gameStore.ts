// IO of the game loops of "Thị trấn" (docs/town.md §10 "Vòng chơi"): the calls and hooks the activity panels use
// (features/town/activities). Rules are pure in ./fishing ./farm ./eggs ./wardrobe ./unlocks; storage is the town
// progress of ./store (one synced key, every write settled: eggs granted, achievements recorded, celebrations queued).
//
//   useTownGame()                 everything the panels show except the farm, live: balance, eggs, the fish album,
//                                 what is owned and worn, titles, achievements, town projects, project decorations
//   startCast() / finishCast(cast, answer)   one cast at the pond (the catch streak of this tab raises the odds)
//   useTownFarm() / claimHarvest()           the field from Ôn tập, and the pay for today's reviews
//   buyTownEgg() / hatchTownEgg()            the egg shop
//   equipTownItem(slot, id | null)           the wardrobe
//   checkTownUnlocks()            record achievements that need Ôn tập facts (the farm and the album call it)
//   townLookView()                what the player wears, for the engine (also in useTownGame().look)
//
// Every call returns `celebrations`: what its write newly unlocked (also queued in ./store useTownCelebrations, so
// the page can celebrate it whichever panel caused it). Never throws.

import { useMemo, useSyncExternalStore } from 'react';
import { EGG_COST, type LootItem } from '../../data/townGame';
import { getReviewSnapshot } from '../review/api';
import { useReview } from '../review/useReview';
import type { ReviewSnapshot } from '../review/types';
import type { TaskPayout } from './daily';
import { balance, rawBalance } from './economy';
import { applyHatch, buyEgg, EGG_GRANT_LABEL, eggOdds, eggsInHand, eggsToPity, grantKind, type EggGrantKind, type Hatch } from './eggs';
import { applyHarvest, farmHarvest, farmPlots, type FarmField, type FarmHarvest } from './farm';
import { applyCatch, catchOutcome, fishAlbum, fishXuLeft, rollCast, type CatchAnswer, type CatchOutcome, type FishAlbum, type FishCast } from './fishing';
import { townDay, type FishRecord, type LookSlot, type TownProgress } from './progress';
import { commitTown, knownTownDevice, loadTownProgress, townDevice, useTownProgress, type TownCelebration } from './store';
import { achievementsView, projectDecorations, projectsView, reviewFacts, settleTown, type AchievementView, type ProjectView } from './unlocks';
import { availableTitles, equip, lookView, ownedItems, type LookView, type TownTitle } from './wardrobe';

const today = (): string => townDay(Date.now());
function subscribeDay(fn: () => void): () => void {
  const id = setInterval(fn, 60_000);
  return () => clearInterval(id);
}
const noonOf = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

// ───────────────────────── the snapshot ─────────────────────────

export interface EggGrantView {
  id: string;
  kind: EggGrantKind;
  /** Why it came, in Vietnamese. */
  label: string;
}

export interface TownEggsView {
  /** Eggs not opened yet. */
  inHand: number;
  cost: number;
  /** The balance covers one more egg. */
  canBuy: boolean;
  /** Xu still to earn before an egg can be bought (0 when it can). */
  missing: number;
  /** Eggs of this browser until a quý-or-better is certain (1 = the next one). */
  toPity: number;
  /** 0..1 per tier, without the pity rule. */
  odds: ReturnType<typeof eggOdds>;
  /** Eggs earned by listening, newest id last. */
  grants: EggGrantView[];
}

export interface TownGameView {
  balance: number;
  eggs: TownEggsView;
  album: FishAlbum;
  /** Xu fishing can still pay today (all browsers). */
  fishXuLeft: number;
  owned: LootItem[];
  look: LookView;
  titles: TownTitle[];
  /** From the town progress only (goals that need Ôn tập facts show what is recorded: checkTownUnlocks). */
  achievements: AchievementView[];
  projects: ProjectView[];
  /** World decorations of the projects done (the engine draws them). */
  decorations: string[];
}

/** The snapshot of the panels from one stored value (pure; `device` = this browser). */
export function townGameView(progress: TownProgress, now: number, device: string): TownGameView {
  const raw = rawBalance(progress);
  return {
    balance: Math.max(0, raw),
    eggs: {
      inHand: eggsInHand(progress),
      cost: EGG_COST,
      canBuy: raw >= EGG_COST,
      missing: Math.max(0, EGG_COST - raw),
      toPity: eggsToPity(progress, device),
      odds: eggOdds(),
      grants: progress.eggs.grants.flatMap((id) => {
        const kind = grantKind(id);
        return kind ? [{ id, kind, label: EGG_GRANT_LABEL[kind] }] : [];
      }),
    },
    album: fishAlbum(progress),
    fishXuLeft: fishXuLeft(progress, now),
    owned: ownedItems(progress),
    look: lookView(progress),
    titles: availableTitles(progress),
    achievements: achievementsView(progress),
    projects: projectsView(progress),
    decorations: projectDecorations(progress),
  };
}

/** Live snapshot of the panels: the same object until the progress or the local day changes. */
export function useTownGame(): TownGameView {
  const progress = useTownProgress();
  const day = useSyncExternalStore(subscribeDay, today, today);
  return useMemo(() => townGameView(progress, noonOf(day), knownTownDevice()), [progress, day]);
}

/** What the player wears now (for the engine, outside React). */
export function townLookView(): LookView {
  return lookView(loadTownProgress());
}

// ───────────────────────── fishing ─────────────────────────

/** Catches in a row in this tab (an escape resets it). Page state: a reload starts at 0. */
let streak = 0;
let castSeq = 0;

export function fishingStreak(): number {
  return streak;
}

/** The next cast at the pond (nothing is written: a cast left unanswered counts nowhere). */
export function startCast(now: number = Date.now()): FishCast {
  castSeq += 1;
  const seed = (Math.floor(now) ^ Math.imul(castSeq, 0x9e3779b1)) >>> 0;
  return rollCast(loadTownProgress(), seed, { streak });
}

export interface FishCastResult {
  outcome: CatchOutcome;
  /** Xu paid (after the daily cap). */
  xu: number;
  capped: boolean;
  newSpecies: boolean;
  record: FishRecord | undefined;
  tasksPaid: TaskPayout[];
  /** Xu of the cast and the tasks it reached. */
  earned: number;
  balance: number;
  /** The catch streak of this tab after the cast. */
  streak: number;
  celebrations: TownCelebration[];
  saved: boolean;
}

const finished = new WeakMap<FishCast, FishCastResult>();

/**
 * The cast answered: caught or escaped (./fishing catchOutcome), recorded and paid (applyCatch). The same cast
 * answered twice (a double click) is recorded once. A cast never played (`plays` 0) is recorded nowhere.
 */
export function finishCast(cast: FishCast, answer: CatchAnswer, now: number = Date.now()): FishCastResult {
  const again = finished.get(cast);
  if (again) return again;
  const before = loadTownProgress();
  const outcome = catchOutcome(cast, answer);
  const eff = applyCatch(before, cast, outcome, now, townDevice());
  const w = eff.progress === before ? { saved: true, celebrations: [] } : commitTown(eff.progress, now);
  if (outcome.reason !== 'unplayed') streak = outcome.caught ? streak + 1 : 0;
  const earned = eff.xu + eff.tasksPaid.reduce((s, t) => s + t.reward, 0);
  const result: FishCastResult = {
    outcome,
    xu: eff.xu,
    capped: eff.capped,
    newSpecies: eff.newSpecies,
    record: eff.record,
    tasksPaid: eff.tasksPaid,
    earned,
    balance: balance(loadTownProgress()),
    streak,
    celebrations: w.celebrations,
    saved: w.saved,
  };
  finished.set(cast, result);
  return result;
}

// ───────────────────────── the farm ─────────────────────────

export interface TownFarmView {
  field: FarmField;
  harvest: FarmHarvest;
}

/** The farm from a review snapshot and the town progress (pure). */
export function townFarmView(progress: TownProgress, snapshot: Pick<ReviewSnapshot, 'entries' | 'store' | 'summary'>, now: number): TownFarmView {
  return { field: farmPlots({ entries: snapshot.entries, store: snapshot.store }, now), harvest: farmHarvest(progress, snapshot.summary, now) };
}

/** Live farm: re-renders when Ôn tập or the town changes. */
export function useTownFarm(): TownFarmView {
  const snapshot = useReview();
  const progress = useTownProgress();
  return useMemo(() => townFarmView(progress, snapshot, snapshot.now), [progress, snapshot]);
}

export interface HarvestResult {
  /** Cards paid now. */
  cards: number;
  xu: number;
  golden: boolean;
  tasksPaid: TaskPayout[];
  earned: number;
  balance: number;
  celebrations: TownCelebration[];
  saved: boolean;
}

/** Pay the reviews of today not paid yet (and the golden crop when today's review is done). Nothing to pay: zeros. */
export function claimHarvest(now: number = Date.now()): HarvestResult {
  const before = loadTownProgress();
  let snapshot: ReviewSnapshot | null = null;
  try {
    snapshot = getReviewSnapshot(now);
  } catch {
    snapshot = null;
  }
  if (!snapshot) return { cards: 0, xu: 0, golden: false, tasksPaid: [], earned: 0, balance: balance(before), celebrations: [], saved: true };
  const eff = applyHarvest(before, snapshot.summary, now, townDevice());
  const w = eff.progress === before ? { saved: true, celebrations: [] } : commitTown(eff.progress, now, reviewFacts(snapshot.entries));
  const earned = eff.xu + eff.tasksPaid.reduce((s, t) => s + t.reward, 0);
  return { cards: eff.cards, xu: eff.xu, golden: eff.golden, tasksPaid: eff.tasksPaid, earned, balance: balance(loadTownProgress()), celebrations: w.celebrations, saved: w.saved };
}

// ───────────────────────── eggs ─────────────────────────

export type EggBuyCall = { ok: true; balance: number; inHand: number; celebrations: TownCelebration[]; saved: boolean } | { ok: false; reason: 'poor' | 'device'; missing: number; balance: number };

/** One egg for EGG_COST xu. Refused (nothing written) when the balance is short. */
export function buyTownEgg(now: number = Date.now()): EggBuyCall {
  const before = loadTownProgress();
  const r = buyEgg(before, townDevice());
  if (!r.ok) return { ok: false, reason: r.reason, missing: r.missing, balance: balance(before) };
  const w = commitTown(r.progress, now);
  const progress = loadTownProgress();
  return { ok: true, balance: balance(progress), inHand: eggsInHand(progress), celebrations: w.celebrations, saved: w.saved };
}

export type EggHatchCall =
  | { ok: true; hatch: Hatch; balance: number; inHand: number; celebrations: TownCelebration[]; saved: boolean }
  | { ok: false; reason: 'no-egg' | 'device'; inHand: number };

/** Open one egg: the item (or its xu when owned already). Refused without an egg. */
export function hatchTownEgg(now: number = Date.now()): EggHatchCall {
  const before = loadTownProgress();
  const r = applyHatch(before, townDevice(), now);
  if (!r.ok) return { ok: false, reason: r.reason, inHand: eggsInHand(before) };
  const w = commitTown(r.progress, now);
  const progress = loadTownProgress();
  return { ok: true, hatch: r.hatch, balance: balance(progress), inHand: eggsInHand(progress), celebrations: w.celebrations, saved: w.saved };
}

// ───────────────────────── the wardrobe ─────────────────────────

export type EquipCall = { ok: true; look: LookView; saved: boolean } | { ok: false; reason: 'not-owned' };

/** Wear `id` in `slot` (null takes it off). Refused for something not owned. */
export function equipTownItem(slot: LookSlot, id: string | null, now: number = Date.now()): EquipCall {
  const before = loadTownProgress();
  const r = equip(before, slot, id, now);
  if (!r.ok) return { ok: false, reason: r.reason };
  const w = r.progress === before ? { saved: true } : commitTown(r.progress, now);
  return { ok: true, look: lookView(loadTownProgress()), saved: w.saved };
}

// ───────────────────────── achievements ─────────────────────────

/**
 * Settle with the facts of Ôn tập (goals like "Vườn lâu năm" need them): records what is reached and returns what is
 * new (also queued as celebrations). Nothing new: nothing is written.
 */
export function checkTownUnlocks(now: number = Date.now()): TownCelebration[] {
  let facts = null;
  try {
    facts = reviewFacts(getReviewSnapshot(now).entries);
  } catch {
    facts = null;
  }
  const before = loadTownProgress();
  try {
    // settleTown gives the same object back when nothing is new: then nothing is written
    if (settleTown(before, now, facts).progress === before) return [];
  } catch {
    return [];
  }
  return commitTown(before, now, facts).celebrations;
}
