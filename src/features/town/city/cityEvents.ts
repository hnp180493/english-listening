// Today's scene of a city event (docs/town.md §21): who speaks in it (the page gathers them at the host's place) and
// whether it was heard today.
import type { CityEvent } from '../../../core/town/cityTypes';
import { eventScene } from '../../../core/town/world';
import { CITY_EVENT_SCENES } from '../../../data/city';

export function eventToday(event: CityEvent, day: string, heardToday: readonly string[]): { who: string[]; done: boolean } {
  const scene = eventScene(CITY_EVENT_SCENES, event.id, day);
  return { who: scene ? [...new Set(scene.lines.map((l) => l.who))] : [], done: !!scene && heardToday.includes(scene.id) };
}
