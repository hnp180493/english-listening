// The 3D town's people and pets, all built in code (contract: ./contracts.ts). The work lives in ./chars/:
//   looks.ts     the cast and seeded passers-by        anim.ts      the animation brain (pure, tested)
//   body.ts      one skinned body per person          hair.ts      hair styles      hats.ts   loot hats
//   face.ts      the shared face atlas + patches      props.ts     cup, can, rod, book
//   pets.ts      pets and the town cat                portrait.ts  head-and-shoulders portraits
//   materials.ts shared soft toon materials
//
// Draw calls: a person is 2 (body + face), +1 with a hat, +1 while holding something; a pet is 1. Materials and the
// face atlas are shared by everybody.

import type { CharacterId, CharacterLook, Character3D, Pet3D } from './contracts';
import { castLook as castLookImpl, passerLook as passerLookImpl } from './chars/looks';
import { createPerson } from './chars/person';
import { createPet as createPetImpl } from './chars/pets';
import { renderPortrait as renderPortraitImpl } from './chars/portrait';
import { getTownUi } from '../townUi';

export { SEAT_HEIGHT, TILE_SCALE, type Character3DPlus } from './chars/person';
export { setNightTint, disposeSharedMaterials } from './chars/materials';
export { disposePortraits } from './chars/portrait';
export { HAT_IDS, PET_IDS, RESIDENT_IDS } from './chars/looks';

export function castLook(id: CharacterId): CharacterLook {
  return castLookImpl(id);
}

export function passerLook(seed: number, child = false): CharacterLook {
  return passerLookImpl(seed, child);
}

export function createCharacter(id: CharacterId, look: CharacterLook = castLook(id)): Character3D {
  return createPerson(id, look);
}

/**
 * How big a pet is drawn beside the VRoid avatars (`townUi.people` 'anime'), against the round code body it was built
 * for: every pet stands about 0.36 of a tile, 58 % of an avatar (0.62), a dog up to its chest and a head as big as
 * its upper body (owner, 2026-11-27: "con pet nó bự quá vậy"). A dog, a fox, a panda to just over the knee (about
 * 0.21), a cat and the small ones lower (about 0.18). The classic people keep them as built.
 */
export function petScale(petId: string): number {
  return SMALL_PETS.has(petId) ? 0.5 : 0.58;
}
const SMALL_PETS: ReadonlySet<string> = new Set(['cat', 'meo-muop', 'vit', 'ga-con', 'tho', 'rua']);

export function createPet(petId: string): Pet3D {
  const pet = createPetImpl(petId);
  if (getTownUi().people !== 'anime') return pet;
  const k = petScale(petId);
  pet.root.scale.setScalar(k);
  // (its legs keep their step on the ground: the gait goes by the distance in its own, unscaled units)
  const update = pet.update.bind(pet);
  pet.update = (dt: number, speed: number) => update(dt, speed / k);
  return pet;
}

export function renderPortrait(
  id: CharacterId,
  size: number,
  mood: 'neutral' | 'happy' = 'neutral',
  opts?: { hat?: string | null; outfit?: string | null },
): HTMLCanvasElement {
  return renderPortraitImpl(id, size, mood, opts);
}
