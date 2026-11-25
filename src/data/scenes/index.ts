// "Cảnh nghe" (core/town/sceneTypes.ts, docs/town.md §19): what is overheard from a bench, read on the radio, said at
// a get-together of the week.
import type { ListenScene } from '../../core/town/sceneTypes';
import { EVENT_SCENES } from './events';
import { OVERHEARD_SCENES } from './overheard';
import { RADIO_SCENES } from './radio';

export { EVENT_SCENES, OVERHEARD_SCENES, RADIO_SCENES };

export const LISTEN_SCENES: readonly ListenScene[] = [...OVERHEARD_SCENES, ...RADIO_SCENES, ...EVENT_SCENES];

const BY_ID = new Map(LISTEN_SCENES.map((s) => [s.id, s]));

export function listenScene(id: string): ListenScene | undefined {
  return BY_ID.get(id);
}
