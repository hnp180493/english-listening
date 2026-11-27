// The learner's assets on Westbay's quest list (../quests.ts Quest): ONE card at most. A report waits → the card walks
// to that asset's manager ("Amira có báo cáo hôm nay"); nothing owned yet → it offers the three, at the cheapest one's
// manager; owned and nothing waits → no card.
import { ASSETS, asset } from '../../../core/town/assets';
import { assetsNow } from '../../../core/town/assetsStore';
import { cityPerson } from '../../../core/town/cityPeople';
import type { PlaceId } from '../../../data/townWorld';
import { tl, tr } from '../../../i18n';
import type { Quest } from '../quests';

export const ASSETS_QUEST_PREFIX = 'assets:';

/** The managers (their place ids), for the button beside them. */
export const ASSET_MANAGERS: readonly string[] = ASSETS.map((a) => a.manager);

export function assetsQuest(now: number = Date.now()): Quest | null {
  const state = assetsNow(now);
  const due = state.find((s) => s.report);
  if (due) {
    const a = asset(due.id)!;
    return { id: ASSETS_QUEST_PREFIX + a.id, tag: tr('Tài sản'), title: a.name, step: tl`${cityPerson(a.manager)?.name ?? a.manager} có báo cáo hôm nay`, target: { kind: 'resident', id: a.manager as PlaceId } };
  }
  if (state.some((s) => s.owned)) return null;
  const first = ASSETS[0];
  return { id: ASSETS_QUEST_PREFIX + first.id, tag: tr('Tài sản'), title: 'Mua tài sản ở Westbay', step: 'Sạp ở Market Street, xưởng xe, bảo trợ Bay FM', target: { kind: 'resident', id: first.manager as PlaceId } };
}
