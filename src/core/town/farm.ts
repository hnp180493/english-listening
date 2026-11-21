// "Nông trại" of "Thị trấn" (docs/town.md §10): the crops ARE the review cards of Ôn tập (core/review). Pure.
//
// Nothing grows here by itself and nothing is harvested by a click: a crop is ripe when its card is due, and it is
// harvested by reviewing it in Ôn tập. The farm only shows the review schedule as a field and pays a little for the
// reviews done today:
//
//   farmPlots(snapshot, now)          the field: one plot per (kind of card, state) — ripe (due now), wilting (due for
//                                     more than WILT_DAYS days), seedling (enrolled today, not due yet), growing (due
//                                     later today or tomorrow, with how far it has grown)
//   farmFieldLook(input, now, slots)  what the 3D field shows (one crop stage per planting spot), from the same
//                                     farmPlots, so the world never shows a ripe crop the panel does not
//   farmHarvest(progress, summary, now)   what the reviews of today are worth and what is already paid
//   applyHarvest(progress, summary, now, device)   pay it: FARM_XU_PER_CARD per card reviewed today, at most
//                                     FARM_DAILY_CARDS cards a day over every browser, and FARM_GOLDEN_XU once a day
//                                     for the "golden crop" when today's review is done (nothing left for today's
//                                     sessions, at least one card reviewed); the day goes into `farmDays`
//
// What is stored (./progress): `daily[day][device].harvest` (cards paid, the cap is over the sum of the browsers)
// and `farmDays`. Everything else is read from the review snapshot.

import { KIND_ORDER, KIND_SHORT } from '../review/constants';
import type { CardId, ReviewEntry, ReviewKind, ReviewStore, ReviewSummary } from '../review/types';
import { DAY } from '../srs';
import { noteGame, type TaskPayout } from './daily';
import { addEarned, addFarmDay, dailySum, townDay, type TownProgress } from './progress';

export const FARM_XU_PER_CARD = 1;
/** Cards a day that pay (over every browser). */
export const FARM_DAILY_CARDS = 20;
/** The golden crop: today's review done. Once a day. */
export const FARM_GOLDEN_XU = 10;
/** A crop due for longer than this wilts (an overdue card). */
export const WILT_DAYS = 3;

export type PlotState = 'ripe' | 'wilting' | 'growing' | 'seedling';
const STATE_ORDER: readonly PlotState[] = ['wilting', 'ripe', 'growing', 'seedling'];

export interface FarmPlot {
  /** `<kind>-<state>`: stable while the plot exists (a React key). */
  id: string;
  kind: ReviewKind;
  /** Vietnamese short name of the kind (core/review KIND_SHORT). */
  label: string;
  state: PlotState;
  /** Cards in the plot. */
  count: number;
  /** 0..1: how far the plot has grown towards its next due time (1 for ripe and wilting plots). */
  growth: number;
  /** Growing / seedling plots: when the first of its cards is due (epoch ms); null otherwise. */
  readyAt: number | null;
  /** Its cards, the earliest due first (at most PLOT_CARDS of them). */
  cards: CardId[];
}

const PLOT_CARDS = 12;

/** What farmPlots reads from the review snapshot (core/review getReviewSnapshot / useReview). */
export interface FarmInput {
  entries: readonly ReviewEntry[];
  /** For the time a card was created (seedlings). */
  store?: Pick<ReviewStore, 'cards'>;
}

/** Local midnight that starts the day `offset` days after the day of `ts`. */
function midnight(ts: number, offset: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset).getTime();
}

function stateOf(e: ReviewEntry, born: number, now: number): PlotState | null {
  if (e.availableAt <= now - WILT_DAYS * DAY) return 'wilting';
  if (e.availableAt <= now) return 'ripe';
  if (born >= midnight(now, 0)) return 'seedling';
  if (e.availableAt < midnight(now, 2)) return 'growing';
  return null; // due after tomorrow: resting, not on the field
}

/** 0..1 from the card's last change (or its interval before the due time) to its due time. */
function growthOf(e: ReviewEntry, now: number): number {
  const due = e.availableAt;
  const span = Math.max(1, e.state.interval) * DAY;
  const start = e.last && e.last > 0 && e.last < due ? e.last : due - span;
  if (due <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (due - start)));
}

export interface FarmField {
  plots: FarmPlot[];
  ripe: number;
  wilting: number;
  growing: number;
  seedlings: number;
  /** Cards due after tomorrow (not on the field). */
  resting: number;
}

/**
 * The field from the review entries: one plot per (kind, state), wilting first, then ripe, growing, seedlings; in
 * a state, kinds in Ôn tập's order. Suspended and retired cards are not entries, so they are not on the field.
 */
export function farmPlots(input: FarmInput, now: number): FarmField {
  const groups = new Map<string, { kind: ReviewKind; state: PlotState; items: { e: ReviewEntry; g: number }[] }>();
  let resting = 0;
  for (const e of input.entries) {
    const born = input.store?.cards[e.id]?.born ?? 0;
    const state = stateOf(e, born, now);
    if (!state) {
      resting += 1;
      continue;
    }
    const key = `${e.kind}-${state}`;
    const g = state === 'ripe' || state === 'wilting' ? 1 : growthOf(e, now);
    const group = groups.get(key);
    if (group) group.items.push({ e, g });
    else groups.set(key, { kind: e.kind, state, items: [{ e, g }] });
  }
  const plots: FarmPlot[] = [...groups.entries()].map(([id, { kind, state, items }]) => {
    items.sort((a, b) => a.e.availableAt - b.e.availableAt || (a.e.id < b.e.id ? -1 : 1));
    const growing = state === 'growing' || state === 'seedling';
    return {
      id,
      kind,
      label: KIND_SHORT[kind],
      state,
      count: items.length,
      growth: growing ? items.reduce((s, x) => s + x.g, 0) / items.length : 1,
      readyAt: growing ? items[0].e.availableAt : null,
      cards: items.slice(0, PLOT_CARDS).map((x) => x.e.id),
    };
  });
  plots.sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const sum = (s: PlotState) => plots.filter((p) => p.state === s).reduce((n, p) => n + p.count, 0);
  return { plots, ripe: sum('ripe'), wilting: sum('wilting'), growing: sum('growing'), seedlings: sum('seedling'), resting };
}

// ───────────────────────── the look of the field in the world ─────────────────────────

/** What one planting spot of the 3D field shows: bare soil, or a crop at the stage of its cards. */
export type CropStage = 'empty' | 'seedling' | 'growing' | 'ripe' | 'wilting';

/** Planting spots of the field in the world (about what three/scene/props3d draws on the farm's tiles). */
export const FARM_LOOK_SLOTS = 48;

export interface FarmFieldLook {
  /**
   * One stage per planting spot, `slots` long, in this order: wilting, ripe, growing, seedling, then empty soil. With
   * fewer cards than spots each card is one crop; with more, the spots are shared in proportion (largest remainder),
   * and every stage that has a card keeps at least one spot (one ripe card always shows as a ripe crop).
   */
  slots: CropStage[];
  /** Cards per stage, as the panel counts them (farmPlots); `empty` = spots left as bare soil. */
  counts: Record<CropStage, number>;
  /** Something can be harvested now (a ripe or wilting crop): the panel's "Đã chín" section is not empty. */
  ripe: boolean;
}

const LOOK_ORDER: readonly Exclude<CropStage, 'empty'>[] = ['wilting', 'ripe', 'growing', 'seedling'];

/** The look of a field already computed by farmPlots (see farmFieldLook). */
export function fieldLook(field: Pick<FarmField, 'ripe' | 'wilting' | 'growing' | 'seedlings'>, slots: number = FARM_LOOK_SLOTS): FarmFieldLook {
  const n = Number.isFinite(slots) ? Math.max(0, Math.floor(slots)) : 0;
  const cards: Record<Exclude<CropStage, 'empty'>, number> = {
    wilting: Math.max(0, Math.floor(field.wilting) || 0),
    ripe: Math.max(0, Math.floor(field.ripe) || 0),
    growing: Math.max(0, Math.floor(field.growing) || 0),
    seedling: Math.max(0, Math.floor(field.seedlings) || 0),
  };
  const total = LOOK_ORDER.reduce((sum, k) => sum + cards[k], 0);
  const spots: Record<Exclude<CropStage, 'empty'>, number> = { wilting: 0, ripe: 0, growing: 0, seedling: 0 };
  if (total <= n) {
    for (const k of LOOK_ORDER) spots[k] = cards[k];
  } else if (n > 0) {
    // one spot for every stage that has a card (as many as fit, the harvestable first), the rest in proportion to the
    // cards beyond that first one, by largest remainder (ties: the harvestable first). total > n, so no stage gets
    // more spots than it has cards.
    const present = LOOK_ORDER.filter((k) => cards[k] > 0);
    for (const k of present.slice(0, n)) spots[k] = 1;
    const left = n - Math.min(n, present.length);
    if (left > 0) {
      const pool = total - present.length;
      const share = present.map((k, i) => ({ k, i, want: ((cards[k] - 1) * left) / pool }));
      let given = 0;
      for (const x of share) {
        spots[x.k] += Math.floor(x.want);
        given += Math.floor(x.want);
      }
      share.sort((x, y) => y.want - Math.floor(y.want) - (x.want - Math.floor(x.want)) || x.i - y.i);
      for (let j = 0; given < left && j < share.length; j++, given++) spots[share[j].k] += 1;
    }
  }
  const out: CropStage[] = [];
  for (const k of LOOK_ORDER) for (let i = 0; i < spots[k]; i++) out.push(k);
  while (out.length < n) out.push('empty');
  return { slots: out, counts: { ...cards, empty: n - out.filter((x) => x !== 'empty').length }, ripe: cards.ripe + cards.wilting > 0 };
}

/**
 * What the farm field in the world shows now, from Ôn tập's entries (the same farmPlots the panel reads, so a ripe
 * crop in the world is a card due in Ôn tập, and an empty "Đã chín" in the panel is no ripe crop in the world).
 * Pure; `slots` = the planting spots the scene draws.
 */
export function farmFieldLook(input: FarmInput, now: number, slots: number = FARM_LOOK_SLOTS): FarmFieldLook {
  return fieldLook(farmPlots(input, now), slots);
}

/** What the harvest reads from the review summary. */
export type FarmFacts = Pick<ReviewSummary, 'reviewedToday' | 'dueToday'>;

export interface FarmHarvest {
  /** Cards reviewed in Ôn tập today (every machine, as synced). */
  reviewed: number;
  /** Of those, already paid as a harvest today (every browser). */
  paid: number;
  /** Cards that would be paid now. */
  payable: number;
  /** Xu for them. */
  xu: number;
  /** Today's review is done: nothing left for today's sessions and at least one card reviewed. */
  cleared: boolean;
  /** The golden crop of today was paid already. */
  goldenPaid: boolean;
  /** Xu the golden crop would pay now (0 when not cleared or already paid). */
  goldenXu: number;
  /** FARM_DAILY_CARDS: the cards a day that pay. */
  cap: number;
}

export function farmHarvest(progress: TownProgress, facts: FarmFacts, now: number): FarmHarvest {
  const day = townDay(now);
  const reviewed = Math.max(0, Math.floor(facts.reviewedToday) || 0);
  const paid = dailySum(progress, day, 'harvest');
  const payable = Math.max(0, Math.min(reviewed, FARM_DAILY_CARDS) - paid);
  const cleared = reviewed > 0 && (Number(facts.dueToday) || 0) <= 0;
  const goldenPaid = progress.farmDays.includes(day);
  return { reviewed, paid, payable, xu: payable * FARM_XU_PER_CARD, cleared, goldenPaid, goldenXu: cleared && !goldenPaid ? FARM_GOLDEN_XU : 0, cap: FARM_DAILY_CARDS };
}

export interface HarvestEffect {
  progress: TownProgress;
  /** Cards paid now. */
  cards: number;
  /** Xu paid now (the cards and the golden crop). */
  xu: number;
  /** The golden crop was paid now. */
  golden: boolean;
  tasksPaid: TaskPayout[];
}

/** Pay what farmHarvest says is payable (the input is not changed). Nothing payable: the same progress. */
export function applyHarvest(progress: TownProgress, facts: FarmFacts, now: number, device: string): HarvestEffect {
  const h = farmHarvest(progress, facts, now);
  if (h.payable === 0 && h.goldenXu === 0) return { progress, cards: 0, xu: 0, golden: false, tasksPaid: [] };
  let next = progress;
  if (h.goldenXu > 0) next = addFarmDay(next, townDay(now));
  next = addEarned(next, device, h.xu + h.goldenXu);
  const noted = h.payable > 0 ? noteGame(next, { harvest: h.payable }, now, device) : { progress: next, tasksPaid: [] };
  // a bad device id: nothing could be counted, so nothing is paid (it could be paid twice otherwise)
  if (h.payable > 0 && dailySum(noted.progress, townDay(now), 'harvest') === h.paid) return { progress, cards: 0, xu: 0, golden: false, tasksPaid: [] };
  return { progress: noted.progress, cards: h.payable, xu: h.xu + h.goldenXu, golden: h.goldenXu > 0, tasksPaid: noted.tasksPaid };
}
