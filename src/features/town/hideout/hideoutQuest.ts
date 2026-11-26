// The hideout on Westbay's quest list (../quests.ts Quest; docs/town.md §29): offered once Rico's story has opened his
// office in the old gatehouse (the same gate: core/town/dispatchStore dispatchOpen; at once in the admin sandbox). Not
// bought: a card that it is to let and what it costs. Bought: a card only while there is heat to cool off.

import { HIDEOUT_COST, HIDEOUT_THING } from '../../../data/city/hideout';
import { tl } from '../../../i18n';
import type { Quest } from '../quests';

export const HIDEOUT_QUEST_ID = 'hideout:room';

export function hideoutQuest(owned: boolean, heat: number): Quest | null {
  if (!owned)
    return { id: HIDEOUT_QUEST_ID, tag: 'Chỗ ẩn', title: 'Căn phòng sau chòi gác cho thuê', step: tl`Sau chòi của Gus trên Pier Road · ${HIDEOUT_COST} xu`, target: { kind: 'activity', id: HIDEOUT_THING } };
  if (heat <= 0) return null;
  return { id: HIDEOUT_QUEST_ID, tag: 'Chỗ ẩn', title: 'Về chỗ ẩn nằm nghỉ', step: 'Độ nóng về 0 sau một giấc', target: { kind: 'activity', id: HIDEOUT_THING } };
}
