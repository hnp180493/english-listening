// "Tủ đồ" of "Thị trấn" (docs/town.md §10): what the learner owns and wears. Pure.
//
//   ownedItems(progress)          the items hatched from eggs (data/townGame LOOT), by kind
//   availableTitles(progress)     the titles that can be worn: from eggs, from achievements and from town projects
//                                 recorded as reached (./unlocks), and the town level's own title
//   equip(progress, slot, id, now)   wear `id` in `slot` (null takes it off). The look is a value replaced as a
//                                 whole: it carries its own change time (./progress setLook / mergeLook, AGENTS.md §6)
//   lookView(progress)            what the engine draws: the hat, the outfit colour, the pet, the title over the head
//
// Only things owned can be worn; nothing can be bought here, nothing is lost.

import { ACHIEVEMENTS, LOOT, lootItem, TOWN_PROJECTS, type LootItem, type LootKind } from '../../data/townGame';
import { townLevel, TOWN_LEVELS } from './economy';
import { isUnlocked, LOOK_SLOTS, ownsItem, setLook, type LookSlot, type TownLook, type TownProgress } from './progress';

export type TitleSource = 'egg' | 'achievement' | 'project' | 'level';

export interface TownTitle {
  /** Stored in the look: a loot id ('t-…'), an achievement id, a project id, or 'level-<n>'. */
  id: string;
  /** The words over the player's head. */
  name: string;
  from: TitleSource;
}

/** Items owned, in catalog order. */
export function ownedItems(progress: TownProgress, kind?: LootKind): LootItem[] {
  return LOOT.filter((i) => ownsItem(progress, i.id) && (!kind || i.kind === kind));
}

const levelTitleId = (index: number): string => `level-${index}`;

/** Every title of the catalogs, by id (owned or not). */
export function titleById(id: string): TownTitle | undefined {
  const loot = lootItem(id);
  if (loot?.kind === 'title') return { id, name: loot.name, from: 'egg' };
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (a) return { id, name: a.title, from: 'achievement' };
  const p = TOWN_PROJECTS.find((x) => x.id === id);
  if (p) return { id, name: p.title, from: 'project' };
  const m = /^level-(\d)$/.exec(id);
  const level = m ? TOWN_LEVELS[Number(m[1])] : undefined;
  return level ? { id, name: level.title, from: 'level' } : undefined;
}

/** Titles the learner can wear now: the levels reached, the achievements and projects recorded, the egg titles owned. */
export function availableTitles(progress: TownProgress): TownTitle[] {
  const out: TownTitle[] = [];
  const level = townLevel(progress).index;
  for (let i = 0; i <= level; i++) out.push({ id: levelTitleId(i), name: TOWN_LEVELS[i].title, from: 'level' });
  for (const a of ACHIEVEMENTS) if (isUnlocked(progress, a.id)) out.push({ id: a.id, name: a.title, from: 'achievement' });
  for (const p of TOWN_PROJECTS) if (isUnlocked(progress, p.id)) out.push({ id: p.id, name: p.title, from: 'project' });
  for (const i of LOOT) if (i.kind === 'title' && ownsItem(progress, i.id)) out.push({ id: i.id, name: i.name, from: 'egg' });
  return out;
}

/** The loot kind a slot takes (the title slot also takes achievement / project / level titles). */
const SLOT_KIND: Readonly<Record<LookSlot, LootKind>> = { hat: 'hat', outfit: 'outfit', pet: 'pet', title: 'title' };

/** `id` can be worn in `slot` now (null = nothing in it: always allowed). */
export function canWear(progress: TownProgress, slot: LookSlot, id: string | null): boolean {
  if (id === null) return true;
  if (slot === 'title') return availableTitles(progress).some((t) => t.id === id);
  const item = lootItem(id);
  return !!item && item.kind === SLOT_KIND[slot] && ownsItem(progress, id);
}

export type EquipResult = { ok: true; progress: TownProgress } | { ok: false; reason: 'not-owned'; progress: TownProgress };

/**
 * Wear `id` in `slot` (null takes it off) at `now`: the whole look is replaced with a new change time. Refused for
 * something not owned. Wearing what is worn already changes nothing (the same progress).
 */
export function equip(progress: TownProgress, slot: LookSlot, id: string | null, now: number): EquipResult {
  if (!LOOK_SLOTS.includes(slot) || !canWear(progress, slot, id)) return { ok: false, reason: 'not-owned', progress };
  if (progress.look[slot] === id) return { ok: true, progress };
  const look: Omit<TownLook, 'at'> = { hat: progress.look.hat, outfit: progress.look.outfit, pet: progress.look.pet, title: progress.look.title };
  look[slot] = id;
  return { ok: true, progress: setLook(progress, look, now) };
}

export interface LookView {
  hat: LootItem | null;
  /** The outfit with its colour (`color`, a canvas colour). */
  outfit: LootItem | null;
  pet: LootItem | null;
  title: TownTitle | null;
}

/**
 * What the player wears, resolved for the engine and the HUD. Something worn that is not owned here (a look synced
 * before the item it names) is drawn as nothing until it arrives.
 */
export function lookView(progress: TownProgress): LookView {
  const item = (slot: Exclude<LookSlot, 'title'>): LootItem | null => {
    const id = progress.look[slot];
    return id && canWear(progress, slot, id) ? (lootItem(id) ?? null) : null;
  };
  const t = progress.look.title;
  return { hat: item('hat'), outfit: item('outfit'), pet: item('pet'), title: t && canWear(progress, 'title', t) ? (titleById(t) ?? null) : null };
}
