// Who wears a Quaternius body instead of a VRoid avatar (docs/town.md §35; features/town/three/chars/quatBody.ts). The
// VRoid samples are young bodies with young faces: an old person was "a young woman with grey hair", a child a grown-up
// made small. The owner pointed at his own game, Giang Hồ, whose people are Quaternius' CC0 base characters with an
// outfit and loose hair, tinted ("tham khảo model của game này xem, thấy vẽ ông già trẻ con này nọ khá tốt"). So:
//   - every OLD or OLDER person (their face in data/townVrm.ts: Grace's own entry, FACES, or grey hair in the look);
//   - every CHILD (a look under 0.9: the passers-by's children, the learner's own).
// Young grown-ups stay VRoid. The colours come from the person's look (the same the drawn portrait was matched to);
// the table below says what a look cannot: the hair piece, a bun or glasses built in code, a cap.
//
// One outfit only (Quaternius' "Peasant", tinted shirt / jumper and trousers: the "Ranger" is a hooded costume), so
// clothes read plainer than a portrait's; docs/town.md §35 says what a modern pack would add.

import { cityPerson } from '../core/town/cityPeople';
import type { LookLike, VrmFace } from './townVrm';

export type QuatHair = 'parted' | 'long' | 'buns' | 'none';
export type QuatKind = 'old' | 'older' | 'child' | 'toddler';

/** A Quaternius body, as worn by one person. */
export interface QuatRecipe {
  sex: 'm' | 'f';
  kind: QuatKind;
  skin: string;
  top: string;
  bottom: string;
  shoes: string;
  hair: QuatHair;
  hairColor: string;
  beard: string | null;
  /** A bun at the back of the head, built in code (the colour). */
  bun: string | null;
  glasses: boolean;
  /** A cap built in code (the colour). */
  cap: string | null;
  /** Against a grown-up avatar's height (data/townVrm.ts vrmFor `tall`). */
  tall: number;
  /** The head's size against the body (a child's is larger). */
  head: number;
}

/** What a look cannot say, by person (place ids for the town's residents, Westbay ids, the jobs' people). */
const PEOPLE: Readonly<Record<string, Partial<QuatRecipe>>> = {
  // Grace: grey hair up in a bun, round glasses, a pink top (her portrait)
  home: { sex: 'f', hair: 'parted', bun: '#d9d4ce', glasses: true },
  // grey hair up, as Grace's
  mei: { hair: 'parted', bun: '#cfc9c2' },
  okafor: { hair: 'parted', bun: '#cfc9c2' },
  // the captain: a grey ponytail under her cap
  odile: { hair: 'long' },
  // a greying bob
  delaney: { hair: 'parted' },
};

/** A child's head against its body (a child's build, not a grown-up made small). */
export const QUAT_KID_HEAD = 1.2;

const has = (look: LookLike, x: string): boolean => (look.extras ?? []).some((e) => e === x || e.startsWith(x + ':'));

/** Who somebody reads as: the canon, then the look. */
function sexOf(id: string, look: LookLike, face: VrmFace | null | undefined): 'm' | 'f' {
  const g = cityPerson(id)?.gender;
  if (g) return g === 'female' ? 'f' : 'm';
  if (id === 'home' || id === 'delaney' || id === 'shona') return 'f';
  if (face?.beard || has(look, 'beard')) return 'm';
  const s = look.hair.style;
  return has(look, 'lashes') || has(look, 'skirt') || has(look, 'dungarees') || s === 'long' || s === 'bun' || s === 'ponytail' || s === 'pigtails' || s === 'bob' ? 'f' : 'm';
}

/** The hair piece nearest a look's style. */
function hairOf(style: string, sex: 'm' | 'f'): QuatHair {
  if (style === 'bald') return 'none';
  if (sex === 'm') return 'parted';
  if (style === 'long' || style === 'ponytail' || style === 'pigtails') return 'long';
  if (style === 'curly' || style === 'buns') return 'buns';
  return 'parted';
}

/**
 * The Quaternius body somebody wears, or null (a young grown-up: their VRoid avatar). `face` and `tall` are what
 * data/townVrm.ts vrmFor gave them.
 */
export function quatFor(id: string, look: LookLike, face: VrmFace | null | undefined, tall: number | undefined): QuatRecipe | null {
  const scale = look.scale ?? 1;
  const child = scale < 0.9;
  const age = face?.age;
  if (!child && !age) return null;
  const sex = sexOf(id, look, face);
  const extra = Object.hasOwn(PEOPLE, id) ? PEOPLE[id] : {};
  const kind: QuatKind = child ? (scale < 0.68 ? 'toddler' : 'child') : (age ?? 'older');
  const beard = sex === 'm' && (face?.beard || has(look, 'beard')) ? (face?.beardColor ?? look.hair.color) : null;
  const capExtra = (look.extras ?? []).find((e) => e === 'cap' || e.startsWith('cap:'));
  const recipe: QuatRecipe = {
    sex,
    kind,
    skin: look.skin,
    // a white coat over the top (a doctor's): the top turns white, as on the avatars
    top: has(look, 'coat') ? '#f4f2ee' : look.top,
    bottom: look.bottom,
    shoes: (look as { shoes?: string }).shoes ?? '#3a2c26',
    hair: hairOf(look.hair.style, sex),
    hairColor: look.hair.color,
    beard,
    bun: sex === 'f' && look.hair.style === 'bun' ? look.hair.color : null,
    glasses: has(look, 'glasses'),
    cap: capExtra ? (capExtra.includes(':') ? capExtra.slice(4) : look.top) : null,
    tall: tall ?? (child ? scale * 0.84 : 1),
    head: child ? QUAT_KID_HEAD : 1,
  };
  return { ...recipe, ...extra };
}
