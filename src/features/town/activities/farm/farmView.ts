// What the "Nông trại" panel says (docs/town.md §10): pure view helpers over useTownFarm() and the review summary.
//
// The crops ARE the review cards of Ôn tập, so every text here follows the review schedule: a crop is ripe when its
// card is due, it is harvested by reviewing it in Ôn tập, and the farm only pays a little xu for the reviews of
// today. Nothing here promises remembering: xu are a game score.

import type { ReviewKind } from '../../../../core/review/types';
import { FARM_GOLDEN_XU, FARM_XU_PER_CARD, WILT_DAYS, type FarmField, type FarmHarvest, type FarmPlot, type PlotState } from '../../../../core/town/farm';
import type { TaskPayout } from '../../../../core/town/daily';
import { getLang, tl, tr } from '../../../../i18n';

const MINUTE = 60_000;

/** A plot's sign: the practice its cards come from, in the learner's words. */
export const FARM_KIND_LABEL: Readonly<Record<ReviewKind, string>> = {
  dict: 'Chép chính tả',
  pair: 'Phân biệt âm',
  chunk: 'Cụm từ',
  lesson: 'Bài học',
  media: 'Video thật',
  word: 'Từ vựng',
  talk: 'Chuyện ở thị trấn',
};

/** What grows in a plot of that kind (the picture; the sign says the kind). */
export const FARM_CROP_NAME: Readonly<Record<ReviewKind, string>> = {
  dict: 'cà rốt',
  pair: 'ngô',
  chunk: 'cà chua',
  lesson: 'hướng dương',
  media: 'dâu tây',
  word: 'bắp cải',
  talk: 'bí ngô',
};

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** "15:30" (local time). */
export function clockText(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours()}:${pad2(d.getMinutes())}`;
}

/** Local midnight that starts the day `offset` days after the day of `ts`. */
function midnight(ts: number, offset: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset).getTime();
}

/**
 * When a crop ripens, as a lower-case phrase: "chín rồi", "chín sau 12 phút", "chín lúc 15:30", "chín ngày mai",
 * "chín ngày 24/11".
 */
export function readyText(readyAt: number | null, now: number): string {
  if (readyAt === null || !Number.isFinite(readyAt) || readyAt <= now) return 'chín rồi';
  const mins = Math.ceil((readyAt - now) / MINUTE);
  if (mins < 60) return tl`chín sau ${mins} phút`;
  if (readyAt < midnight(now, 1)) return tl`chín lúc ${clockText(readyAt)}`;
  if (readyAt < midnight(now, 2)) return 'chín ngày mai';
  const d = new Date(readyAt);
  if (getLang() === 'en') return tl`chín ngày ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return tl`chín ngày ${d.getDate()}/${d.getMonth() + 1}`;
}

/** The line under a plot's sign: how many crops, what state they are in and, while they grow, when they ripen. */
export function plotStatus(plot: Pick<FarmPlot, 'state' | 'readyAt' | 'count'>, now: number): string {
  const n = tl`${plot.count} cây`;
  switch (plot.state) {
    case 'ripe':
      return tl`${n} chín, ôn được rồi`;
    case 'wilting':
      return tl`${n} héo, ôn là tươi lại`;
    case 'seedling':
      return tl`${n} mới gieo, ${readyText(plot.readyAt, now)}`;
    default:
      return `${n}, ${readyText(plot.readyAt, now)}`;
  }
}

/** 0..99 for a plot still growing (a ripe one shows no ring); null for ripe and wilting plots. */
export function plotPercent(plot: Pick<FarmPlot, 'state' | 'growth'>): number | null {
  if (plot.state === 'ripe' || plot.state === 'wilting') return null;
  const g = Number.isFinite(plot.growth) ? plot.growth : 0;
  return Math.max(0, Math.min(99, Math.round(g * 100)));
}

/** Crops drawn in a plot's bed: one per card, at most `max` (the sign says the real count). */
export function cropsShown(count: number, max = 4): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), max);
}

export interface FieldSection {
  id: 'ripe' | 'growing';
  title: string;
  plots: FarmPlot[];
}

const SECTION_OF: Readonly<Record<PlotState, FieldSection['id']>> = { wilting: 'ripe', ripe: 'ripe', growing: 'growing', seedling: 'growing' };

/** The field in two rows of beds: what can be harvested now, then what is still growing (empty sections left out). */
export function fieldSections(field: Pick<FarmField, 'plots'>): FieldSection[] {
  const ripe: FarmPlot[] = [];
  const growing: FarmPlot[] = [];
  for (const p of field.plots) (SECTION_OF[p.state] === 'ripe' ? ripe : growing).push(p);
  const out: FieldSection[] = [];
  if (ripe.length) out.push({ id: 'ripe', title: 'Đã chín', plots: ripe });
  if (growing.length) out.push({ id: 'growing', title: 'Đang lớn', plots: growing });
  return out;
}

/** The next time a crop ripens: the earliest growing plot, else Ôn tập's next due time (a resting card). */
export function nextRipeAt(field: Pick<FarmField, 'plots'>, nextAt: number | null, now: number): number | null {
  let best: number | null = null;
  for (const p of field.plots) {
    if ((p.state === 'growing' || p.state === 'seedling') && p.readyAt !== null && p.readyAt > now) {
      if (best === null || p.readyAt < best) best = p.readyAt;
    }
  }
  if (best !== null) return best;
  return nextAt !== null && Number.isFinite(nextAt) && nextAt > now ? nextAt : null;
}

/** What the panel reads from Ôn tập besides the farm (core/review ReviewSummary, features/review/sessionPlan). */
export interface FarmToday {
  /** What today's sessions of Ôn tập will serve (the nav badge's number). */
  dueToday: number;
  /**
   * The session "Thu hoạch" opens: features/review/sessionPlan nextSessionPlan, the very numbers Ôn tập's start card
   * shows (its size within the review budget, its minutes; `split` = only a part of today's cards: "Phiên này").
   */
  session: { size: number; minutes: number; split: boolean };
  /** Earliest due time after now; null when nothing is pending. */
  nextAt: number | null;
  /** Cards in Ôn tập (suspended excluded). */
  tracked: number;
}

export type FarmScreenKind = 'claim' | 'harvest' | 'done' | 'wait' | 'empty';

export interface FarmButton {
  label: string;
  /** claim = claimHarvest(); review = go to Ôn tập; close = back to the town. */
  to: 'claim' | 'review' | 'close';
}

export interface FarmScreen {
  kind: FarmScreenKind;
  /** Which picture the top of the panel shows. */
  art: 'basket' | 'golden' | 'sprout' | 'soil';
  headline: string;
  detail: string | null;
  /** THE one primary action of the panel. */
  primary: FarmButton;
  /** A quieter second way (never a primary). */
  secondary: FarmButton | null;
}

function nextLine(field: Pick<FarmField, 'plots'>, today: FarmToday, now: number): string | null {
  const at = nextRipeAt(field, today.nextAt, now);
  return at === null ? null : tl`Cây tiếp theo ${readyText(at, now)}.`;
}

/**
 * The top of the panel: one primary action, chosen in this order: claim what today's reviews are worth; go harvest
 * (review) what Ôn tập serves today; nothing to do now (done for today / waiting / an empty field).
 */
export function farmScreen(field: FarmField, harvest: FarmHarvest, today: FarmToday, now: number): FarmScreen {
  const due = Math.max(0, Math.floor(today.dueToday) || 0);
  const ripe = field.ripe + field.wilting;
  const reviewMore: FarmButton | null = due > 0 ? { label: tl`Ôn tiếp (${due} cây)`, to: 'review' } : null;

  if (harvest.payable > 0 || harvest.goldenXu > 0) {
    const xu = harvest.xu + harvest.goldenXu;
    const golden = harvest.goldenXu > 0;
    let headline: string;
    if (harvest.payable > 0) headline = golden ? tl`Ôn xong phần hôm nay: ${harvest.payable} cây và cây vàng chờ bạn nhận.` : tl`${harvest.payable} cây vừa ôn đang chờ bạn nhận.`;
    else headline = 'Ôn xong phần hôm nay: cây vàng chờ bạn nhận.';
    return {
      kind: 'claim',
      art: golden ? 'golden' : 'basket',
      headline,
      detail: null,
      primary: { label: tl`Nhận thu hoạch (+${xu} xu)`, to: 'claim' },
      secondary: reviewMore,
    };
  }

  if (due > 0) {
    // the session Ôn tập starts, as its start card names it (today's count in the headline, as in its title)
    const size = Math.max(0, Math.floor(today.session.size) || 0);
    const mins = Math.max(1, Math.floor(today.session.minutes) || 0);
    const split = today.session.split && size > 0 && size < due;
    return {
      kind: 'harvest',
      art: 'basket',
      headline: due === 1 ? 'Có 1 cây chín chờ thu hoạch.' : tl`Có ${due} cây chín chờ thu hoạch.`,
      detail: split ? tl`Thu hoạch là ôn ở Ôn tập. Phiên này: ${size} cây, khoảng ${mins} phút.` : tl`Thu hoạch là ôn ở Ôn tập, khoảng ${mins} phút.`,
      primary: { label: tl`Thu hoạch (${split ? size : due} cây)`, to: 'review' },
      secondary: null,
    };
  }

  const back: FarmButton = { label: 'Về thị trấn', to: 'close' };
  const later = ripe > 0 ? tl`${ripe} cây chín nữa sẽ vào phiên ôn những ngày tới, để mỗi ngày không quá dài.` : null;

  if (harvest.reviewed > 0) {
    return {
      kind: 'done',
      art: harvest.cleared && harvest.goldenPaid ? 'golden' : 'sprout',
      headline: 'Hôm nay đã thu hoạch xong.',
      detail: later ?? nextLine(field, today, now),
      primary: back,
      secondary: null,
    };
  }

  if (field.plots.length === 0 && field.resting === 0 && today.tracked <= 0) {
    return {
      kind: 'empty',
      art: 'soil',
      headline: 'Ruộng còn trống.',
      detail: 'Câu bạn nghe sai khi trò chuyện, chép chính tả hay luyện cụm từ sẽ được gieo ở đây, rồi chín đúng lúc cần ôn.',
      primary: back,
      secondary: null,
    };
  }

  return {
    kind: 'wait',
    art: 'sprout',
    headline: 'Chưa có cây nào cần thu hoạch hôm nay.',
    detail: later ?? nextLine(field, today, now),
    primary: back,
    secondary: null,
  };
}

/** Today's cap, plainly (no zeros before the first review of the day). */
export function capText(harvest: Pick<FarmHarvest, 'reviewed' | 'paid' | 'cap'>): string {
  if (harvest.reviewed <= 0) return tl`${FARM_XU_PER_CARD} xu mỗi cây ôn, tối đa ${harvest.cap} cây một ngày.`;
  if (harvest.paid <= 0) return tl`Hôm nay bạn đã ôn ${harvest.reviewed} cây. Xu trả cho tối đa ${harvest.cap} cây một ngày.`;
  const paid = Math.min(harvest.paid, harvest.cap);
  if (paid >= harvest.cap) return tl`Đã nhận xu cho đủ ${harvest.cap} cây hôm nay. Ôn thêm vẫn giúp nhớ, chỉ không thêm xu.`;
  return tl`Đã nhận xu cho ${paid}/${harvest.cap} cây hôm nay.`;
}

/** The golden crop's line: what earns it, or that today's was taken. Null when there is nothing to say. */
export function goldenText(harvest: Pick<FarmHarvest, 'reviewed' | 'cleared' | 'goldenPaid'>, today: Pick<FarmToday, 'dueToday'>): string | null {
  if (harvest.goldenPaid) return 'Cây vàng hôm nay: đã nhận.';
  if (harvest.cleared) return null; // the claim button says it
  if (today.dueToday > 0) return tl`Ôn hết phần hôm nay: thêm cây vàng (+${FARM_GOLDEN_XU} xu).`;
  return null;
}

/** The gentle line under the field when crops wilt (overdue for more than 3 days). Null when none wilts. */
export function wiltText(wilting: number): string | null {
  if (wilting <= 0) return null;
  const n = wilting === 1 ? '1 cây' : tl`${wilting} cây`;
  return tl`${n} héo vì quá hạn hơn ${WILT_DAYS} ngày. Không sao: ôn xong là tươi lại, lịch ôn tự điều chỉnh theo bạn.`;
}

/** Cards due after tomorrow: not on the field. */
export function restingText(resting: number): string | null {
  if (resting <= 0) return null;
  return tl`${resting} cây khác đang nghỉ, chưa cần ôn tới sau ngày mai.`;
}

export interface HarvestShown {
  cards: number;
  golden: boolean;
  earned: number;
  tasksPaid: readonly TaskPayout[];
}

/** The toast after a claim (onReward label). */
export function rewardLabel(r: HarvestShown): string {
  if (r.golden && r.cards > 0) return tl`Thu hoạch ${r.cards} cây và cây vàng`;
  if (r.golden) return 'Cây vàng: ôn xong phần hôm nay';
  if (r.cards > 0) return tl`Thu hoạch ${r.cards} cây`;
  return 'Đã nhận rồi';
}

/** Lines of the result card under "+n xu". */
export function resultLines(r: HarvestShown): string[] {
  const out: string[] = [];
  if (r.cards > 0) out.push(tl`${r.cards} cây đã ôn hôm nay: +${r.cards * FARM_XU_PER_CARD} xu`);
  if (r.golden) out.push(tl`Cây vàng vì ôn hết phần hôm nay: +${FARM_GOLDEN_XU} xu`);
  for (const t of r.tasksPaid) out.push(tl`Nhiệm vụ xong: ${t.label} (+${t.reward} xu)`);
  return out;
}

/** The accessible name of a plot (the picture is decorative). */
export function plotLabel(plot: Pick<FarmPlot, 'kind' | 'state' | 'count' | 'readyAt' | 'growth'>, now: number): string {
  const pct = plotPercent(plot);
  return `${tr(FARM_KIND_LABEL[plot.kind])} (${tr(FARM_CROP_NAME[plot.kind])}): ${plotStatus(plot, now)}${pct !== null ? tl`, đã lớn ${pct}%` : ''}`;
}
