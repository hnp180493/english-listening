// Every resident's relationship arc (episodes 3+, facts, gift taste, gift reactions, greetings): core/town/story.ts.
import type { ResidentArc } from '../../core/town/story';
import { ARC as board } from './board';
import { ARC as cafe } from './cafe';
import { ARC as cinema } from './cinema';
import { ARC as clinic } from './clinic';
import { ARC as friend } from './friend';
import { ARC as home } from './home';
import { ARC as office } from './office';
import { ARC as park } from './park';
import { ARC as phone } from './phone';
import { ARC as school } from './school';
import { ARC as shop } from './shop';
import { ARC as square } from './square';
import { ARC as station } from './station';

export const RESIDENT_ARCS: readonly ResidentArc[] = [square, cafe, friend, home, shop, office, school, station, clinic, cinema, phone, park, board];

export function residentArc(placeId: string): ResidentArc | undefined {
  return RESIDENT_ARCS.find((a) => a.placeId === placeId);
}
