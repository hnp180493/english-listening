// Rico's dispatch office on Westbay's quest list (../quests.ts Quest): the old gatehouse is beside Gus's hut on Pier
// Road (there is no gatehouse of its own on the map: Gus's place stands for it), so the card walks the player to Gus,
// and the office opens there.
import type { PlaceId } from '../../../data/townWorld';
import { tl, tr } from '../../../i18n';
import type { Quest } from '../quests';
import { OFFICE_AT } from '../../../data/city/dispatch/places';

export const DISPATCH_QUEST_ID = 'dispatch:office';

export function dispatchQuest(paidLeft: number): Quest {
  return {
    id: DISPATCH_QUEST_ID,
    tag: tr('Việc làm'),
    title: 'Văn phòng điều xe',
    step: paidLeft > 0 ? tl`Trạm gác cũ cạnh chòi của Gus · còn ${paidLeft} ca có xu hôm nay` : 'Trạm gác cũ cạnh chòi của Gus',
    target: { kind: 'resident', id: OFFICE_AT as PlaceId },
  };
}
