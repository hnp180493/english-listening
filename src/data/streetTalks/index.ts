// Every resident's street talks (docs/town.md §14 "Gặp trên đường"): four short, coherent exchanges each, two for
// anybody, one from 3 hearts, one once you know something about them. Contract: core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';
import { TALKS as board } from './board';
import { TALKS as cafe } from './cafe';
import { TALKS as cinema } from './cinema';
import { TALKS as clinic } from './clinic';
import { TALKS as friend } from './friend';
import { TALKS as home } from './home';
import { TALKS as office } from './office';
import { TALKS as park } from './park';
import { TALKS as phone } from './phone';
import { TALKS as school } from './school';
import { TALKS as shop } from './shop';
import { TALKS as square } from './square';
import { TALKS as station } from './station';

export const STREET_TALKS: readonly StreetTalk[] = [...square, ...cafe, ...friend, ...home, ...shop, ...office, ...school, ...station, ...clinic, ...cinema, ...phone, ...park, ...board];

export function streetTalksOf(placeId: string): readonly StreetTalk[] {
  return STREET_TALKS.filter((t) => t.placeId === placeId);
}
