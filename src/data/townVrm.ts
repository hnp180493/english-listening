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

/**
 * How old a face is drawn (every VRoid sample has a young anime face: chars/vrmAge.ts draws age on a copy of its face
 * texture): 'older' = lines on the forehead and by the nose and mouth; 'old' = more of them, crow's feet, bags under
 * the eyes, hollow cheeks, pale brows, a little stoop and a shorter step.
 */
export type VrmAge = 'older' | 'old';

/**
 * Hair on the face: 'stubble' a dotted shadow on the texture; the rest a mesh grown from the face itself
 * (chars/vrmAge.ts): 'moustache' over the lip, 'goatee' round the mouth and down the chin, 'short' along the whole jaw
 * and the lip, 'full' the same, thick and hanging below the chin.
 */
export type VrmBeard = 'stubble' | 'moustache' | 'goatee' | 'short' | 'full';

/** An older face and the hair on it, as the person's drawn portrait has them (public/portraits). */
export interface VrmFace {
  age?: VrmAge;
  beard?: VrmBeard;
  /** The beard's colour (default: the hair's). */
  beardColor?: string;
  /** Stubble drawn on the skin as well (a moustache over a shadow of a beard: Gus). */
  stubble?: boolean;
}

export interface VrmPerson {
  /** Height against the usual avatar (1). */
  tall?: number;
  extras?: readonly VrmExtra[];
  face?: VrmFace;
}

/** Every resident with an avatar (the keys are place ids; each has a file). */
const PEOPLE: Readonly<Record<string, VrmPerson>> = {
  square: {},
  cafe: {},
  friend: { tall: 0.93 },
  // (Grace: an old lady in her portrait; Ben: a short dark beard)
  home: { tall: 0.94, extras: ['glasses', 'bun:#c9c9cf'], face: { age: 'old' } },
  shop: { tall: 1.03, face: { beard: 'short', beardColor: '#4a3426' } },
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

/**
 * The faces of Westbay's people, read off their drawn portraits one by one (2026-11-27; public/portraits, the first face
 * of each sheet). An id listed here is taken as it stands (an empty entry: a young face, whatever the hair: Iris and
 * Vivian are white-haired and young); anybody else gets what their look says (`faceOf`).
 */
export const FACES: Readonly<Record<string, VrmFace>> = {
  // old: white or grey hair and a lined face in the portrait
  osei: { age: 'old', beard: 'goatee', beardColor: '#dedcd6' },
  adeyemi: { age: 'old', beard: 'goatee', beardColor: '#ecebe6' },
  frank: { age: 'old', beard: 'short', beardColor: '#bdb6ae' },
  hal: { age: 'old', beard: 'full', beardColor: '#cfcac3' },
  mei: { age: 'old' },
  okafor: { age: 'old' },
  // older: grey hair, a few lines
  finch: { age: 'older' },
  whitlock: { age: 'older' },
  odile: { age: 'older' },
  // a beard on a young face
  gus: { beard: 'moustache', beardColor: '#4a3527', stubble: true },
  marcus: { beard: 'short', beardColor: '#231c1c' },
  // (his own portrait is not drawn yet: the file that carried his name was Marcus's; the beard is his look's hair)
  jonah: { beard: 'short', beardColor: '#7a5236' },
  theo: { beard: 'short', beardColor: '#6b4a33' },
  rico: { beard: 'short', beardColor: '#2a2222' },
  // white hair on a young face
  iris: {},
  vivian: {},
};

/** Grey or white hair (light, hardly any colour): read as an older face when nothing else says. */
function greyHair(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  return light > 0.6 && max - min < 0.1;
}

/**
 * Somebody's face: the table above, else their look: a beard of their look ('beard' extra) is a short one of the hair's
 * colour, grey hair an older face. A child is never aged. Null: a young face, nothing on it.
 */
export function faceOf(id: string, look: LookLike): VrmFace | null {
  if (Object.hasOwn(FACES, id)) {
    const f = FACES[id];
    return f.age || f.beard ? f : null;
  }
  if ((look.scale ?? 1) < 0.9) return null;
  const has = (x: string): boolean => (look.extras ?? []).some((e) => e === x || e.startsWith(x + ':'));
  const face: VrmFace = {};
  if (has('beard')) {
    face.beard = 'short';
    face.beardColor = look.hair.color;
  }
  if (greyHair(look.hair.color) && look.hair.style !== 'bald') face.age = 'older';
  return face.age || face.beard ? face : null;
}

/** A white coat (a doctor's, a pharmacist's: the look's 'coat') worn as the top of a tintable avatar. */
export const COAT_WHITE = '#f4f2ee';

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
  // A beard settles it (Jonah's long hair and Theo's dungarees once put the two of them, beards and all, in a girl's
  // body with a bow at the neck).
  const man = has('beard') || (Object.hasOwn(FACES, id) && !!FACES[id].beard);
  const woman = !man && (has('lashes') || has('skirt') || has('dungarees') || style === 'long' || style === 'bun' || style === 'ponytail' || style === 'pigtails' || style === 'bob');
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
  const face = faceOf(id, look);
  return {
    url: file(base, 'base-' + pick.base),
    // (a white coat over the top: the base has no coat, so its top turns white)
    tint: { skin: look.skin, hair: look.hair.color, top: own2.includes('coat') ? COAT_WHITE : look.top, bottom: look.bottom },
    ...(face ? { face } : {}),
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
