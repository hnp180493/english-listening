// The new people of the jobs on Westbay's stage (docs/gta-story.md §2): Duncan Kemp, the owner of Bayline. He is not
// one of the city's people with a place (core/town/cityPeople.ts), so he stands about as a guest (TownWorld.guests: no
// footprint, a spot and a door) by Station Avenue, where Bayline's cars wait in the evenings (docs/city.md §13). A job
// gathers him where it needs him (the kiosk, the dumpling stall) and drives him as a passenger.

import { registerLooks } from '../three/chars/looks';
import type { CharacterLook } from '../three/contracts';
import type { PlaceId, TownWorld, WorldPlace } from '../../../data/townWorld';

export const JOB_CAST_LOOKS: Readonly<Record<string, CharacterLook>> = {
  // Kemp: a navy coat (he says so on the phone), dark hair going grey, a shirt collar: polite, never in a hurry
  kemp: { skin: '#eac4a0', hair: { style: 'short', color: '#5a4a3e' }, top: '#26324f', bottom: '#2b2f3a', shoes: '#26232a', extras: ['collar'], scale: 1.02 },
};
registerLooks(JOB_CAST_LOOKS);

const KEMP: WorldPlace = { id: 'kemp' as PlaceId, name: 'Westbay', resident: 'Duncan Kemp', x: 44, y: 32, w: 0, d: 0, face: 'y', door: { x: 44, y: 32 }, spot: { x: 44, y: 32 } };

const WITH = new WeakMap<TownWorld, TownWorld>();

/** The city's world with the jobs' own people as guests (the same object for the same world: no stage made again). */
export function withJobCast(world: TownWorld): TownWorld {
  let w = WITH.get(world);
  if (!w) {
    w = { ...world, guests: [...(world.guests ?? []), KEMP] };
    WITH.set(world, w);
  }
  return w;
}
