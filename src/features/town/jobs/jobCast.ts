// The new people of the jobs on Westbay's stage (docs/gta-story.md §2): Duncan Kemp, the owner of Bayline, Mrs Delaney
// of the Harbour Trust, Kemp's assistant Shona, a Bayline driver. They are not the city's people with a place
// (core/town/cityPeople.ts), so they stand about as guests (TownWorld.guests: no footprint, a spot and a door). A job
// gathers them where it needs them and drives one as a passenger.

import { registerLooks } from '../three/chars/looks';
import type { CharacterLook } from '../three/contracts';
import type { PlaceId, TownWorld, WorldPlace } from '../../../data/townWorld';

export const JOB_CAST_LOOKS: Readonly<Record<string, CharacterLook>> = {
  // Kemp: a navy coat (he says so on the phone), dark hair going grey, a shirt collar: polite, never in a hurry
  kemp: { skin: '#eac4a0', hair: { style: 'short', color: '#5a4a3e' }, top: '#26324f', bottom: '#2b2f3a', shoes: '#26232a', extras: ['collar'], scale: 1.02 },
  // Mrs Delaney (the Harbour Trust's letting officer): red glasses, a grey suit, never sits down
  delaney: { skin: '#f0cdb4', hair: { style: 'bob', color: '#8a7a6e' }, top: '#6c7280', bottom: '#565c68', shoes: '#26232a', extras: ['glasses', 'collar', 'skirt', 'lashes'] },
  // Shona (Kemp's assistant): a navy Bayline blazer like her boss, a neat ponytail
  shona: { skin: '#f4d2b8', hair: { style: 'ponytail', color: '#3b2a22' }, top: '#26324f', bottom: '#2b2f3a', shoes: '#26232a', extras: ['collar', 'lashes'] },
  // a Bayline driver: the firm's navy, a cap
  driver: { skin: '#c98f66', hair: { style: 'short', color: '#2a2222' }, top: '#26324f', bottom: '#3b4258', shoes: '#26232a', extras: ['cap'] },
};
registerLooks(JOB_CAST_LOOKS);

const guest = (id: string, resident: string, x: number, y: number): WorldPlace => ({ id: id as PlaceId, name: 'Westbay', resident, x, y, w: 0, d: 0, face: 'y', door: { x, y }, spot: { x, y } });

/** Where they stand about when no job needs them: Kemp by Station Avenue, Mrs Delaney on the harbour square below the
 * Trust's office (over the electronics market), Shona by the Bay FM studio, the driver by the harbour gate. */
const CAST: readonly WorldPlace[] = [
  guest('kemp', 'Duncan Kemp', 44, 32),
  guest('delaney', 'Mrs Delaney', 61, 81),
  guest('shona', 'Shona', 51, 52),
  guest('driver', 'Tài xế Bayline', 69, 88),
];

const WITH = new WeakMap<TownWorld, TownWorld>();

/** The city's world with the jobs' own people as guests (the same object for the same world: no stage made again). */
export function withJobCast(world: TownWorld): TownWorld {
  let w = WITH.get(world);
  if (!w) {
    w = { ...world, guests: [...(world.guests ?? []), ...CAST] };
    WITH.set(world, w);
  }
  return w;
}
