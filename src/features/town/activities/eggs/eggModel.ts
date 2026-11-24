// Pure words and decisions of "Tiệm trứng" (EggPanel): what the one main button does, the honest odds, the pity
// line, why eggs came, what a hatch says. Tested in eggModel.test.ts.

import { RARITIES, RARITY, rarityRank, type LootItem, type LootKind, type Rarity } from '../../../../data/townGame';
import { EGG_GRANT_LABEL, type EggGrantKind, type Hatch } from '../../../../core/town/eggs';
import type { TownEggsView } from '../../../../core/town/gameStore';
import { getLang, tl, tr } from '../../../../i18n';

/** What the panel's one primary button does now: open an egg, buy one, or nothing (short of xu, no egg). */
export type EggAction = 'hatch' | 'buy' | 'none';

export function eggAction(eggs: Pick<TownEggsView, 'inHand' | 'canBuy'>): EggAction {
  if (eggs.inHand > 0) return 'hatch';
  if (eggs.canBuy) return 'buy';
  return 'none';
}

/** "Còn 4 quả nữa…": eggs of this browser until a quý-or-better is certain (the pity rule, EGG_PITY). */
export function pityText(toPity: number): string {
  if (toPity <= 1) return 'Quả tiếp theo chắc chắn ra món Quý hoặc Huyền thoại.';
  return tl`Còn ${toPity} quả nữa là chắc chắn có một món Quý trở lên.`;
}

/** A share as the shop writes it: "60%", "2,5%" (Vietnamese decimal comma), never "0%" for a real chance. */
export function percent(share: number): string {
  const r = Math.round(share * 1000) / 10;
  const en = getLang() === 'en';
  if (r === 0) return share > 0 ? (en ? '< 0.1%' : '< 0,1%') : '0%';
  return en ? `${r}%` : `${String(r).replace('.', ',')}%`;
}

export interface OddsRow {
  tier: Rarity;
  name: string;
  share: string;
  /** Xu an item of this tier gives when it is owned already. */
  dupXu: number;
}

/** The odds of one egg, rarest last (what eggOdds says, without the pity rule). */
export function oddsRows(odds: Readonly<Record<Rarity, number>>): OddsRow[] {
  return RARITIES.map((tier) => ({ tier, name: RARITY[tier].name, share: percent(odds[tier]), dupXu: RARITY[tier].dupXu }));
}

/** Eggs earned by listening, counted by why (most first), for "Trứng bạn đã được tặng". */
export function grantCounts(grants: readonly { kind: EggGrantKind }[]): { kind: EggGrantKind; label: string; count: number }[] {
  const n = new Map<EggGrantKind, number>();
  for (const g of grants) n.set(g.kind, (n.get(g.kind) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({ kind, label: EGG_GRANT_LABEL[kind], count }));
}

/** Every way an egg is earned by listening (the shop lists them). */
export const GRANT_WAYS: readonly { kind: EggGrantKind; label: string }[] = (Object.keys(EGG_GRANT_LABEL) as EggGrantKind[]).map((kind) => ({
  kind,
  label: EGG_GRANT_LABEL[kind],
}));

export const KIND_NAME: Readonly<Record<LootKind, string>> = { pet: 'Thú cưng', hat: 'Mũ', outfit: 'Áo', title: 'Danh hiệu' };

/** The wardrobe's verb for wearing an item of each kind. */
export const WEAR_VERB: Readonly<Record<LootKind, string>> = { pet: 'Dắt theo', hat: 'Đội ngay', outfit: 'Mặc ngay', title: 'Đeo danh hiệu' };

export interface RevealText {
  /** "Mới!" or "Đã có". */
  badge: string;
  /** What it is, e.g. "Thú cưng · Hiếm". */
  kindLine: string;
  name: string;
  /** One more line: a duplicate's xu, or where to wear it. */
  note: string;
  /** A rare-or-better item gets the bigger show (sound, light). */
  big: boolean;
}

export function revealText(h: Pick<Hatch, 'item' | 'tier' | 'duplicate' | 'xu' | 'pity'>): RevealText {
  const kindLine = `${tr(KIND_NAME[h.item.kind])} · ${tr(RARITY[h.tier].name)}`;
  const note = h.duplicate
    ? tl`Bạn có món này rồi, nên nó đổi thành ${h.xu} xu.`
    : h.pity
      ? 'Đủ 10 quả nên chắc chắn ra món quý. Mặc thử trong Tủ đồ.'
      : 'Đã cất vào Tủ đồ.';
  return { badge: h.duplicate ? 'Đã có' : 'Mới!', kindLine, name: h.item.name, note, big: rarityRank(h.tier) >= rarityRank('quy') };
}

/** How the label of a "Ấp trứng" / "Mua trứng" button reads. */
export function hatchLabel(inHand: number): string {
  return inHand > 1 ? tl`Ấp trứng (còn ${inHand} quả)` : 'Ấp trứng';
}

/** The show of a hatching, ms from the click: the egg wobbles, cracks, bursts into light, the item appears. */
export const HATCH_SHOW = { crack: 1100, burst: 1750, reveal: 2150 } as const;
/** Under reduced motion: straight to the item, after a short pause so the change is seen. */
export const HATCH_SHOW_STILL = 350;

export type HatchPhase = 'rest' | 'wobble' | 'crack' | 'burst' | 'reveal';

/** The phase of the show `ms` after the click. */
export function hatchPhase(ms: number, still = false): HatchPhase {
  if (still) return ms >= HATCH_SHOW_STILL ? 'reveal' : 'wobble';
  if (ms >= HATCH_SHOW.reveal) return 'reveal';
  if (ms >= HATCH_SHOW.burst) return 'burst';
  if (ms >= HATCH_SHOW.crack) return 'crack';
  return 'wobble';
}

/** Items of a kind owned / there are. */
export function ownedOfKind(owned: readonly LootItem[], all: readonly LootItem[], kind: LootKind): { owned: number; total: number } {
  return { owned: owned.filter((i) => i.kind === kind).length, total: all.filter((i) => i.kind === kind).length };
}
