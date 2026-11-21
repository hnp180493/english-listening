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

export function createPet(petId: string): Pet3D {
  return createPetImpl(petId);
}

export function renderPortrait(
  id: CharacterId,
  size: number,
  mood: 'neutral' | 'happy' = 'neutral',
  opts?: { hat?: string | null; outfit?: string | null },
): HTMLCanvasElement {
  return renderPortraitImpl(id, size, mood, opts);
}
