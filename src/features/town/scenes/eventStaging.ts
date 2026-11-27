// The town's weekly get-togethers staged in the world (docs/town.md §19 "Get-togethers staged"): while the learner
// listens to one, the residents who speak in it are there. At Grace's Sunday lunch, Daniel's Thursday club and Emma's
// Friday dinner the learner goes into the host's room through the dark, the host at their place, the others at the
// room's extras (RoomStage `more`, the bubble over whoever speaks); Leo's board games and Tom's Saturday market are on
// the plaza, the host beside the learner and the others coming to stand round (talkAt outside + joinTalk). A
// get-together at a place not built yet is held on the plaza too. Whoever is not in town is left out by the stage.
// Westbay's are staged by CityPage (an outside talk at the host's, joinTalk).

import { TOWN_EVENTS } from '../../../core/town/world';
import { TOWN_WORLD, type PlaceId } from '../../../data/townWorld';
import type { TownStageHandle } from '../engine/stage';
import { doorwayOf } from '../engine/staging';

/** The get-togethers held indoors, in the host's own room. */
const INDOORS: ReadonlySet<string> = new Set(['roast', 'club', 'dinner']);

/**
 * Stage a town get-together for its speakers (place ids); `built`: the places built now. True when it was staged (end
 * it with endListen and endTalk), false when there is nothing to stage (an unknown event, no world, busy).
 */
export function stageTownEvent(stage: TownStageHandle, eventId: string, who: readonly PlaceId[], built: readonly string[]): boolean {
  const ev = TOWN_EVENTS.find((e) => e.id === eventId);
  if (!ev) return false;
  const host = ev.host as PlaceId;
  const others = who.filter((id) => id !== host);
  if (INDOORS.has(ev.id) && built.includes(host)) {
    // through the dark from wherever the learner is: the room's own dip puts them in at its door
    const door = doorwayOf(TOWN_WORLD, host);
    if (door && stage.enterOwnRoom(host, door.door, door.out, () => {}, { host, more: others })) return true;
  }
  // on the plaza (in front of Leo's pavilion): the host beside the learner, the others round them. A far learner is
  // taken there through the dark first; the talk starts once that dip is over (a dip asked for at the dark of
  // another is lost).
  const talk = () => stage.talkAt(host, { kind: 'outside', at: 'square' }, {}, () => stage.joinTalk(host, others));
  if (stage.travelTo({ kind: 'place', id: 'square' }, 'warp', () => window.setTimeout(talk, 0))) return true;
  return talk();
}
