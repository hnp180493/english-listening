// Who in the town has a VRoid avatar (a .vrm file) to be shown as, when the learner's "Nhân vật trong thị trấn" is
// "Anime 3D" (features/town/townUi.ts `people`; the body built in code otherwise, and for everybody not listed here).
// The files are public/vrm/<placeId>.vrm, baked by scripts/vrm-bake.py from pixiv's free VRoid sample avatars after
// scripts/vrm-recipes.json (which sample, the resident's own hair, skin and clothes colours; docs/town.md §23). What
// a sample cannot give is added on the head in code (features/town/three/chars/vrmBody.ts `wear`).

/** A thing built on an avatar's head: glasses, sunglasses, a cap of a colour. */
export type VrmExtra = 'glasses' | 'sunglasses' | `cap:#${string}`;

export interface VrmPerson {
  /** Height against the usual avatar (1). */
  tall?: number;
  extras?: readonly VrmExtra[];
}

/** Every resident with an avatar (the keys are place ids; each has a file). */
const PEOPLE: Readonly<Record<string, VrmPerson>> = {
  square: {},
  cafe: {},
  friend: { tall: 0.93 },
  home: { tall: 0.94, extras: ['glasses'] },
  shop: { tall: 1.02 },
  office: {},
  school: { extras: ['glasses'] },
  station: { extras: ['cap:#40639a'] },
  clinic: {},
  cinema: {},
  phone: {},
  park: {},
  board: { extras: ['sunglasses'] },
};

/**
 * Goes up when the files are baked again: it is part of each file's address, so browsers and the service worker (its
 * cache of avatars is cache-first, public/sw.js) fetch the new ones.
 */
export const VRM_VERSION = 1;

/** Somebody's avatar (its address and what goes with it), or null when they have none. `base` = the app's base path. */
export function vrmOf(id: string, base: string): (VrmPerson & { url: string }) | null {
  return Object.hasOwn(PEOPLE, id) ? { ...PEOPLE[id], url: `${base}vrm/${id}.vrm?v=${VRM_VERSION}` } : null;
}

/** Whether anybody at all has an avatar (the setting is offered only then). */
export function anyVrm(): boolean {
  return Object.keys(PEOPLE).length > 0;
}

/** The ids with an avatar (tests: each must have its file). */
export const VRM_IDS: readonly string[] = Object.keys(PEOPLE);
