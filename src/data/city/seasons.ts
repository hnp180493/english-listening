// Westbay's "mùa truyện" (core/town/cityTypes.ts CitySeason): six long stories that run through the town and the
// city, a chapter a real day. Canon: docs/city.md §8. Checked by ./city.test.ts.
import type { CitySeason } from '../../core/town/cityTypes';
import { CITY_SEASONS_A } from './seasonsA';
import { CITY_SEASONS_B } from './seasonsB';
import { CITY_SEASON_MAIN } from './seasonsMain';
import { CITY_SEASON_MAIN_2 } from './seasonsMain2';

// the main story first (part 1, then part 2 once part 1 is heard): its chapter is the quest card's first, the story
// to play through
export const CITY_SEASONS: readonly CitySeason[] = [CITY_SEASON_MAIN, CITY_SEASON_MAIN_2, ...CITY_SEASONS_A, ...CITY_SEASONS_B];
