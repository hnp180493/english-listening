// Who in the town has a VRoid avatar (a .vrm file) to be shown as, when the learner's "Nhân vật trong thị trấn" is
// "Anime 3D" (features/town/townUi.ts `people`; the body built in code otherwise, and for everybody not listed here).
// EVERYBODY has one (owner, 2026-11-26: "sửa hết toàn bộ nhân vật luôn đi chứ"): a resident of the town their own file,
// anybody else (the learner, passers-by, children, Westbay's people) one of seven TINTABLE bases in their own colours.
// The files are public/vrm/<placeId>.vrm and public/vrm/base-<name>.vrm, baked by scripts/vrm-bake.py from pixiv's free VRoid sample avatars after
// scripts/vrm-recipes.json (which sample, the resident's own hair, skin and clothes colours; docs/town.md §23). What
// a sample cannot give is added on the head in code (features/town/three/chars/vrmBody.ts `wear`).

/**
 * A thing built on an avatar's head, as the resident's drawn portrait has it: glasses, sunglasses (worn, or pushed up
 * into the hair), a crown of flowers, a cap or a uniform's peaked cap of a colour, a bun of the hair's colour.
 */
export type VrmExtra = 'glasses' | 'sunglasses' | 'shades-up' | 'flowers' | `cap:#${string}` | `peaked:#${string}` | `bun:#${string}`;

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
  home: { tall: 0.94, extras: ['glasses', 'bun:#c9c9cf'] },
  shop: { tall: 1.03 },
  office: {},
  school: { extras: ['glasses'] },
  station: { extras: ['peaked:#27365a'] },
  clinic: {},
  cinema: {},
  phone: {},
  park: { extras: ['flowers'] },
  board: { extras: ['shades-up'] },
};

/**
 * Goes up when the files are baked again: it is part of each file's address, so browsers and the service worker (its
 * cache of avatars is cache-first, public/sw.js) fetch the new ones.
 */
export const VRM_VERSION = 3;

/** Colours for a tintable base: its hair and clothes are baked white, its skin to BASE_SKIN. */
export interface VrmTint {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
}

/** The skin colour baked into the bases (the lightest: a look's skin is a multiply down from it). */
export const BASE_SKIN = '#f8dccb';

/** Everything `wearVrm` needs to show somebody. */
export interface VrmWear extends VrmPerson {
  url: string;
  tint?: VrmTint;
  /** The head's size against the body (a child: larger). */
  head?: number;
  /** The hair hidden. */
  bald?: boolean;
}

/** The tintable bases: three men (a jacket, a hoodie, a shirt and tie), four women (a bob, long hair, a ponytail, a bob with buns). */
const MEN = ['m-jacket', 'm-hoodie', 'm-shirt'] as const;
const WOMEN = ['f-bob', 'f-long', 'f-tail', 'f-buns'] as const;

/** What of a code-built look picks an avatar (three/contracts.ts CharacterLook, as much as is needed). */
export interface LookLike {
  skin: string;
  hair: { style: string; color: string };
  top: string;
  bottom: string;
  extras?: readonly string[];
  scale?: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The base that suits a look: by who it reads as, then by the hair and the clothes. */
function baseFor(id: string, look: LookLike): { base: string; bald: boolean } {
  const style = look.hair.style;
  const has = (x: string): boolean => (look.extras ?? []).some((e) => e === x || e.startsWith(x + ':'));
  const woman = has('lashes') || has('skirt') || has('dungarees') || style === 'long' || style === 'bun' || style === 'ponytail' || style === 'pigtails' || style === 'bob';
  if (woman) {
    const base = style === 'long' ? 'f-long' : style === 'ponytail' || style === 'pigtails' ? 'f-tail' : style === 'bob' ? 'f-bob' : style === 'bun' ? 'f-buns' : WOMEN[hash(id) % WOMEN.length];
    return { base, bald: false };
  }
  if (style === 'bald') return { base: 'm-jacket', bald: true };
  if (has('tie') || has('collar') || has('coat')) return { base: 'm-shirt', bald: false };
  if (style === 'curly' || style === 'spiky') return { base: 'm-hoodie', bald: false };
  return { base: MEN[hash(id) % MEN.length], bald: false };
}

const file = (base: string, name: string): string => `${base}vrm/${name}.vrm?v=${VRM_VERSION}`;

/** Somebody's avatar (its address and what goes with it), or null when they have none. `base` = the app's base path. */
export function vrmOf(id: string, base: string): VrmWear | null {
  return Object.hasOwn(PEOPLE, id) ? { ...PEOPLE[id], url: file(base, id) } : null;
}

/** The avatar of anybody: their own file (a resident of the town), else a tintable base in their look's colours. */
export function vrmFor(id: string, look: LookLike, base: string): VrmWear {
  const own = vrmOf(id, base);
  if (own) return own;
  const pick = baseFor(id, look);
  const kid = (look.scale ?? 1) < 0.9;
  const extras: VrmExtra[] = [];
  const own2 = look.extras ?? [];
  if (own2.includes('glasses')) extras.push('glasses');
  if (own2.includes('sunglasses')) extras.push('sunglasses');
  if (own2.includes('cap')) extras.push(`cap:#${look.top.replace('#', '')}`);
  return {
    url: file(base, 'base-' + pick.base),
    tint: { skin: look.skin, hair: look.hair.color, top: look.top, bottom: look.bottom },
    // (a child stands lower than its code-built size says: these legs are long. Its head keeps its size: a larger
    // head throws the hair's spring bones about)
    tall: kid ? (look.scale ?? 0.75) * 0.84 : (look.scale ?? 1),
    bald: pick.bald,
    extras,
  };
}

/** Whether anybody at all has an avatar (the setting is offered only then). */
export function anyVrm(): boolean {
  return true;
}

/** The residents with a file of their own, and every file there must be (tests). */
export const VRM_IDS: readonly string[] = Object.keys(PEOPLE);
export const VRM_FILES: readonly string[] = [...VRM_IDS, ...[...MEN, ...WOMEN].map((b) => 'base-' + b)];
