// "Hẹn hò, cưới, con" (docs/town.md §15): the courtable residents' text scenes and the children's. A male learner
// character courts Emma, Mia, Sarah, Kim or Lily; a female one Leo, Ben, Sam, Tom or Daniel (owner, 2026-11-22:
// "Theo nhân vật chọn"). Zoe and Max are together in their own story; Grace is the grandmother of the town.

import type { PlayerGender, Suitor } from '../../core/town/romanceTypes';
import { SUITOR as board } from './board';
import { SUITOR as cafe } from './cafe';
import { SUITOR as clinic } from './clinic';
import { SUITOR as friend } from './friend';
import { KID_LINES } from './kids';
import { SUITOR as office } from './office';
import { SUITOR as park } from './park';
import { SUITOR as school } from './school';
import { SUITOR as shop } from './shop';
import { SUITOR as square } from './square';
import { SUITOR as station } from './station';

export const SUITORS: readonly Suitor[] = [cafe, friend, office, clinic, park, square, shop, station, board, school];

export { KID_LINES };

export function suitorOf(placeId: string): Suitor | undefined {
  return SUITORS.find((s) => s.placeId === placeId);
}

/** Who a learner character of this gender can court. */
export function suitorsFor(gender: PlayerGender): readonly Suitor[] {
  return SUITORS.filter((s) => s.courtedBy === gender);
}
