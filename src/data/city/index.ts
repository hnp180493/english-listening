// Westbay's scenes (docs/city.md, docs/town.md §20): the six main people's episodes, the short talks of the twelve
// people known, the town's residents met in the city, and what is overheard from a bench there.
import type { CityScene } from '../../core/town/cityTypes';
import { CITY_CHATS } from './chats';
import { CITY_EPISODES_A } from './episodesA';
import { CITY_EPISODES_B } from './episodesB';
import { CITY_OVERHEARD } from './overheard';
import { CITY_VISITS_SCENES } from './visits';

export { CITY_CHATS, CITY_OVERHEARD, CITY_VISITS_SCENES };

export const CITY_EPISODES: readonly CityScene[] = [...CITY_EPISODES_A, ...CITY_EPISODES_B];

/** Every scene somebody of the city (or a town resident up there) plays. */
export const CITY_SCENES: readonly CityScene[] = [...CITY_EPISODES, ...CITY_CHATS, ...CITY_VISITS_SCENES];

const BY_ID = new Map(CITY_SCENES.map((s) => [s.id, s]));

export function cityScene(id: string): CityScene | undefined {
  return BY_ID.get(id);
}
