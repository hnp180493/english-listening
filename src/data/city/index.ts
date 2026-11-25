// Westbay's scenes (docs/city.md, docs/town.md §20): the six main people's episodes, the short talks of the twelve
// people known, the town's residents met in the city, and what is overheard from a bench there.
import type { CityScene } from '../../core/town/cityTypes';
import { CITY_CHATS as CHATS_1 } from './chats';
import { CITY_CHATS_2 } from './chats2';
import { CITY_EPISODES_A } from './episodesA';
import { CITY_EPISODES_B } from './episodesB';
import { CITY_EPISODES_C } from './episodesC';
import { CITY_EPISODES_D } from './episodesD';
import { CITY_OUTINGS } from './outings';
import { CITY_OVERHEARD } from './overheard';
import { CITY_SEASONS } from './seasons';
import { CITY_VISITS_SCENES } from './visits';

export { CITY_EVENTS, CITY_EVENT_SCENES } from './events';
export { CITY_OUTINGS, CITY_OVERHEARD, CITY_SEASONS, CITY_VISITS_SCENES };

/** Every chapter of every season. */
export const CITY_CHAPTERS: readonly CityScene[] = CITY_SEASONS.flatMap((s) => s.chapters);

export const CITY_CHATS: readonly CityScene[] = [...CHATS_1, ...CITY_CHATS_2];

export const CITY_EPISODES: readonly CityScene[] = [...CITY_EPISODES_A, ...CITY_EPISODES_B, ...CITY_EPISODES_C, ...CITY_EPISODES_D];

/** Every scene somebody of the city (or a town resident up there) plays. */
export const CITY_SCENES: readonly CityScene[] = [...CITY_EPISODES, ...CITY_CHATS, ...CITY_VISITS_SCENES];

const BY_ID = new Map(CITY_SCENES.map((s) => [s.id, s]));

export function cityScene(id: string): CityScene | undefined {
  return BY_ID.get(id);
}
