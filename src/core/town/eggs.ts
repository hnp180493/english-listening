// "Tiệm trứng" of "Thị trấn" (docs/town.md §10): eggs earned by listening milestones or bought with xu, hatched into
// pets, hats, outfit colours and titles (data/townGame LOOT). Pure and deterministic. No real money anywhere: an
// egg costs xu, and xu only come from listening.
//
//   eggGrantsDue(progress)       eggs the stored listening has earned and that are not granted yet:
//                                  'gist:<episode>'   the gist of an episode right on its very first listen
//                                  'fish:<species>'   the first catch of a hiếm / quý / huyền thoại species
//                                  'farm:<day>'       the whole farm harvested that day (the golden crop)
//                                  'perfect:<day>'    a quick chat with all five lines right that day (one a day)
//                                  'streak:<day>'     a town streak reaching 7, 14, 21 … days on that day
//   eggsInHand(progress)         granted + bought − hatched
//   buyEgg(progress, device)     EGG_COST xu → one more egg
//   hatch(progress, device)      what the next egg of this browser gives (nothing written): a tier by RARITY
//                                eggWeight, an item of that tier (one not owned yet weighs three times more); at
//                                least one quý-or-better every EGG_PITY eggs of a browser (the pity rule); an item
//                                owned already turns into its tier's dupXu xu
//   applyHatch(progress, device, now)   open one egg: the item owned (or the xu), the counters
//
// The result of an egg is fixed by (browser, number of its egg): a reload or a second tab gives the same item, so
// nothing can be re-rolled. Two browsers opening eggs before a sync each count their own (per-device counters).

import { EGG_COST, EGG_PITY, fishSpecies, LOOT, RARITIES, RARITY, rarityRank, type LootItem, type Rarity } from '../../data/townGame';
import { streakMilestones } from './daily';
import { rawBalance } from './economy';
import {
  addEarned,
  addEggGrants,
  addOwned,
  dailySum,
  eggCount,
  eggCountTotal,
  isDeviceId,
  ownsItem,
  raiseEggCount,
  type TownProgress,
} from './progress';
import { seededRandom } from './visit';

export { EGG_COST, EGG_PITY };

export type EggGrantKind = 'gist' | 'fish' | 'farm' | 'perfect' | 'streak';

/** Why an egg was given, in Vietnamese (the shop lists the eggs earned). */
export const EGG_GRANT_LABEL: Readonly<Record<EggGrantKind, string>> = {
  gist: 'Nắm ý chính một tập ngay lần nghe đầu',
  fish: 'Lần đầu câu được một loài cá hiếm',
  farm: 'Thu hoạch sạch nông trại',
  perfect: 'Trò chuyện đúng cả 5 câu',
  streak: 'Nghe ở thị trấn 7 ngày liền',
};

/** Days of a town streak that give an egg (each multiple). */
export const STREAK_EGG_DAYS = 7;

/** Every grant the stored listening has earned (granted or not yet), sorted. */
export function eggGrantsEarned(progress: TownProgress): string[] {
  const out = new Set<string>(progress.eggs.grants);
  for (const [id, e] of Object.entries(progress.episodes)) if (e.firstGist === 2) out.add(`gist:${id}`);
  for (const [id, f] of Object.entries(progress.fish)) {
    const species = fishSpecies(id);
    if (species && f.caught > 0 && rarityRank(species.tier) >= rarityRank('hiem')) out.add(`fish:${id}`);
  }
  for (const day of progress.farmDays) out.add(`farm:${day}`);
  for (const day of Object.keys(progress.daily)) if (dailySum(progress, day, 'perfect') > 0) out.add(`perfect:${day}`);
  // the days of the streak eggs given already anchor a run whose first day was pruned (see streakMilestones)
  const anchors = progress.eggs.grants.filter((id) => id.startsWith('streak:')).map((id) => id.slice('streak:'.length));
  for (const day of streakMilestones(progress.days, STREAK_EGG_DAYS, anchors)) out.add(`streak:${day}`);
  return [...out].sort();
}

/** Grants earned and not granted yet. */
export function eggGrantsDue(progress: TownProgress): string[] {
  const have = new Set(progress.eggs.grants);
  return eggGrantsEarned(progress).filter((id) => !have.has(id));
}

/** The progress with every grant due granted (the same progress when none is due). */
export function grantEggs(progress: TownProgress): { progress: TownProgress; granted: string[] } {
  const due = eggGrantsDue(progress);
  const next = addEggGrants(progress, due);
  return { progress: next, granted: due.filter((id) => next.eggs.grants.includes(id)) };
}

export function grantKind(id: string): EggGrantKind | null {
  const kind = id.split(':')[0];
  return kind in EGG_GRANT_LABEL ? (kind as EggGrantKind) : null;
}

/** Eggs not opened yet (never below 0: two browsers opening the same eggs before a sync). */
export function eggsInHand(progress: TownProgress): number {
  return Math.max(0, progress.eggs.grants.length + eggCountTotal(progress, 'bought') - eggCountTotal(progress, 'hatched'));
}

// ───────────────────────── buying ─────────────────────────

export type EggBuyResult = { ok: true; progress: TownProgress } | { ok: false; reason: 'poor' | 'device'; missing: number; progress: TownProgress };

/** One egg bought with EGG_COST xu by `device` (the input is not changed). Refused when the balance is short. */
export function buyEgg(progress: TownProgress, device: string): EggBuyResult {
  if (!isDeviceId(device)) return { ok: false, reason: 'device', missing: 0, progress };
  const missing = EGG_COST - rawBalance(progress);
  if (missing > 0) return { ok: false, reason: 'poor', missing, progress };
  return { ok: true, progress: raiseEggCount(progress, 'bought', device, eggCount(progress, 'bought', device) + 1) };
}

// ───────────────────────── hatching ─────────────────────────

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The seed of egg number `n` (1-based) of `device`. */
export function eggSeed(device: string, n: number): number {
  return hash(`egg:${device}:${n}`);
}

export interface Hatch {
  item: LootItem;
  tier: Rarity;
  /** The item was owned already: it gives `xu` instead. */
  duplicate: boolean;
  xu: number;
  /** The pity rule chose a quý-or-better tier. */
  pity: boolean;
  /** The number of this egg on its browser (1-based). */
  n: number;
}

/** Tiers an egg of the pity rule can give. */
const PITY_TIERS: readonly Rarity[] = ['quy', 'huyen-thoai'];

function pick<T>(list: readonly { value: T; weight: number }[], rand: () => number): T {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const x of list) {
    r -= x.weight;
    if (r < 0) return x.value;
  }
  return list[list.length - 1].value;
}

/** What the next egg of `device` gives (nothing is written). `seed` overrides the egg's own seed (tests). */
export function hatch(progress: TownProgress, device: string, seed?: number): Hatch {
  const n = eggCount(progress, 'hatched', device) + 1;
  const rand = seededRandom(seed ?? eggSeed(device, n));
  const pity = n - eggCount(progress, 'rare', device) >= EGG_PITY;
  const tiers = pity ? PITY_TIERS : RARITIES;
  const tier = pick(
    tiers.map((t) => ({ value: t, weight: RARITY[t].eggWeight })),
    rand,
  );
  const item = pick(
    LOOT.filter((i) => i.tier === tier).map((i) => ({ value: i, weight: ownsItem(progress, i.id) ? 1 : 3 })),
    rand,
  );
  const duplicate = ownsItem(progress, item.id);
  return { item, tier, duplicate, xu: duplicate ? RARITY[tier].dupXu : 0, pity, n };
}

export type HatchResult = { ok: true; hatch: Hatch; progress: TownProgress } | { ok: false; reason: 'no-egg' | 'device'; progress: TownProgress };

/** Open one egg on `device` at `now`: refused without an egg in hand. The input is not changed. */
export function applyHatch(progress: TownProgress, device: string, now: number): HatchResult {
  if (!isDeviceId(device)) return { ok: false, reason: 'device', progress };
  if (eggsInHand(progress) < 1) return { ok: false, reason: 'no-egg', progress };
  const h = hatch(progress, device);
  let next = raiseEggCount(progress, 'hatched', device, h.n);
  if (rarityRank(h.tier) >= rarityRank('quy')) next = raiseEggCount(next, 'rare', device, h.n);
  next = h.duplicate ? addEarned(next, device, h.xu) : addOwned(next, h.item.id, now);
  return { ok: true, hatch: h, progress: next };
}

/** The odds of one egg (no pity), 0..1 per tier: what the shop shows. */
export function eggOdds(): Record<Rarity, number> {
  const total = RARITIES.reduce((s, t) => s + RARITY[t].eggWeight, 0);
  return Object.fromEntries(RARITIES.map((t) => [t, RARITY[t].eggWeight / total])) as Record<Rarity, number>;
}

/** Eggs of `device` until the pity rule guarantees a quý-or-better (1 = the next one). */
export function eggsToPity(progress: TownProgress, device: string): number {
  const n = eggCount(progress, 'hatched', device) + 1;
  return Math.max(1, EGG_PITY - (n - eggCount(progress, 'rare', device)) + 1);
}
