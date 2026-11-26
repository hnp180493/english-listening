// A Westbay place's name (data/cityWorld.ts), for "Chạy taxi cho Rico" (TaxiPanel, the city's quests).
import { CITY_PLACES } from '../../../data/cityWorld';

export const taxiPlaceName = (id: string): string => CITY_PLACES.find((p) => p.id === id)?.name ?? id;
