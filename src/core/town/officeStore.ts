// IO of the dispatch office's upgrades and the manager's word (./office.ts). Nothing new is stored or synced: an upgrade
// is a store item of the town (its id in town-progress `bought`, bought through ./store buyTownItem, its cost counted
// by ./economy spentTotal: the merge of town-progress keeps every id ever bought); a word heard is `dp-word-<game day>`
// in the day's set `heard`, its xu in `earned`, as a paid dispatch shift is.

import { gameDayOf, officeTakings, ownedUpgrades, type OfficeUpgradeId, wordDue, wordId, wordNumbers, wordPay } from './office';
import { addEarned, townDay, updateDaily } from './progress';
import { buyTownItem, commitTown, loadTownProgress, townDevice, type TownBuyResult } from './store';
import { scenesHeard } from './worldStore';

export interface OfficeNow {
  owned: OfficeUpgradeId[];
  /** The firm's takings for a game day (xu). */
  takings: number;
  /** Today's word waits: the game day it is for and its numbers; null = heard already, or the day's allowance used. */
  word: { gameDay: number; said: number; alike: number; other: number } | null;
}

export function officeNow(now: number = Date.now()): OfficeNow {
  const progress = loadTownProgress();
  const owned = ownedUpgrades(progress.bought);
  const heard = scenesHeard(progress, townDay(now));
  const gameDay = gameDayOf(now);
  return { owned, takings: officeTakings(owned), word: wordDue(heard, now) ? { gameDay, ...wordNumbers(gameDay) } : null };
}

/** Buy an upgrade with xu (refused when short, owned or unknown: nothing written). */
export function buyOfficeUpgrade(id: OfficeUpgradeId): TownBuyResult {
  return buyTownItem(id);
}

/** The word was heard and answered: the takings paid (all, or what is left after the loss). 0 when not due. Never throws. */
export function payWord(gameDay: number, right: boolean, now: number = Date.now()): number {
  try {
    const progress = loadTownProgress();
    const day = townDay(now);
    if (!wordDue(scenesHeard(progress, day), now) || gameDay !== gameDayOf(now)) return 0;
    const xu = wordPay(officeTakings(ownedUpgrades(progress.bought)), right);
    const device = townDevice();
    let next = updateDaily(progress, day, device, (d) => ({ ...d, heard: [...(d.heard ?? []), wordId(gameDay)] }), true);
    if (xu > 0) next = addEarned(next, device, xu);
    commitTown(next, now);
    return xu;
  } catch {
    return 0;
  }
}
