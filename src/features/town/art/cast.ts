// Who plays whom in "Thị trấn": one Kenney Mini Characters model (CC0, art-src/kenney/mini-characters) per person,
// sometimes with glasses or a palette swap. scripts/town-art/render.mjs reads this table to render the sprites, and
// the game reads it to know who is who. Changing a row means re-running `npm run art:town`.

import type { PlaceId } from '../../../data/townWorld';

/** The player ("Bạn") and one resident per place. */
export type CharacterId = 'player' | PlaceId;

export type KenneyModel =
  | 'female-a'
  | 'female-b'
  | 'female-c'
  | 'female-d'
  | 'female-e'
  | 'female-f'
  | 'male-a'
  | 'male-b'
  | 'male-c'
  | 'male-d'
  | 'male-e'
  | 'male-f'
  | 'male-g'
  | 'worker';

export type KenneyProp = 'glasses' | 'sunglasses';

/**
 * Copy colour cell `to` of Kenney's 16 × 4 colormap over cell `from`, for one mesh of the model only (the body or
 * the head, hair included). Cells are [column, row], row 0 at the top of colormap.png.
 */
export interface PaletteSwap {
  mesh: 'body-mesh' | 'head-mesh';
  from: readonly [number, number];
  to: readonly [number, number];
}

export interface CastMember {
  /** Name shown in the game ("Bạn" for the player). */
  name: string;
  model: KenneyModel;
  props?: readonly KenneyProp[];
  swaps?: readonly PaletteSwap[];
}

export const CAST: Readonly<Record<CharacterId, CastMember>> = {
  // the learner: no hat (a face that reads at a glance), fair hair, glasses, blue dungarees and bare hands
  // (render.mjs MODEL_FIXES), unlike anybody else in town: Leo, next to him in the plaza, is brown-haired in a black suit
  player: {
    name: 'Bạn',
    model: 'male-e',
    swaps: [
      { mesh: 'head-mesh', from: [3, 2], to: [10, 2] },
      { mesh: 'body-mesh', from: [1, 3], to: [0, 1] },
    ],
  },
  // chestnut hair instead of Kenney's ginger: Sarah stays the one redhead
  square: { name: 'Leo', model: 'male-d', swaps: [{ mesh: 'head-mesh', from: [1, 2], to: [3, 2] }] },
  cafe: { name: 'Emma', model: 'female-f' },
  friend: { name: 'Mia', model: 'female-b', swaps: [{ mesh: 'head-mesh', from: [1, 2], to: [11, 2] }] },
  // the grandmother of the town: grey hair and glasses
  home: { name: 'Grace', model: 'female-a', props: ['glasses'], swaps: [{ mesh: 'head-mesh', from: [7, 3], to: [9, 3] }] },
  shop: { name: 'Ben', model: 'male-b' },
  office: { name: 'Sarah', model: 'female-d' },
  school: { name: 'Daniel', model: 'male-a' },
  // Kenney's officer, made a traveller: an orange cap without its badge, no badge on the shirt
  station: {
    name: 'Sam',
    model: 'male-c',
    swaps: [
      { mesh: 'head-mesh', from: [1, 1], to: [13, 2] },
      { mesh: 'head-mesh', from: [1, 3], to: [13, 2] },
      { mesh: 'body-mesh', from: [1, 3], to: [1, 1] },
    ],
  },
  clinic: { name: 'Kim', model: 'female-e' },
  cinema: { name: 'Zoe', model: 'female-c' },
  // a magenta tee: without it Max and Daniel (green tops, dark hair) look alike from afar
  phone: { name: 'Max', model: 'male-f', swaps: [{ mesh: 'body-mesh', from: [9, 2], to: [7, 1] }] },
  // Mia's model again: black hair, a green band and a green top, so the two never look alike
  park: {
    name: 'Lily',
    model: 'female-b',
    swaps: [
      { mesh: 'head-mesh', from: [1, 2], to: [7, 3] },
      { mesh: 'head-mesh', from: [1, 3], to: [9, 2] },
      { mesh: 'body-mesh', from: [1, 3], to: [9, 2] },
    ],
  },
  board: { name: 'Tom', model: 'male-g', props: ['sunglasses'] },
};

/** Every character, in a fixed order (the player first): the order of the portrait atlas. */
export const CHARACTER_IDS = Object.keys(CAST) as CharacterId[];
