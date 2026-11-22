// Who looks like what in the 3D town: the cast (the player and the 13 residents, by place id) and seeded looks for
// passers-by and children. Pure data: no three.js here, so it is tested in node.
//
// One cosy pastel palette for everybody. Extras are plain strings; a few take a colour after a colon
// ('apron:#7fb59c'), otherwise the builder picks a soft default.

import type { CharacterId, CharacterLook, HairSpec } from '../contracts';

/** The 13 residents' place ids (data/town.ts TOWN_PLACES), in the order of the town. */
export const RESIDENT_IDS = ['square', 'cafe', 'friend', 'home', 'shop', 'office', 'school', 'station', 'clinic', 'cinema', 'phone', 'park', 'board'] as const;

/** Extras the builder knows (anything else is ignored). */
export const KNOWN_EXTRAS = [
  'glasses',
  'sunglasses',
  'apron',
  'cap',
  'coat',
  'tie',
  'scarf',
  'beard',
  'collar',
  'skirt',
  'shorts',
  'dungarees',
  'stethoscope',
  'logo',
  'backpack',
  'headband',
  'stocky',
  'freckles',
  'lashes',
] as const;

export type ExtraName = (typeof KNOWN_EXTRAS)[number];

/** Loot hats (data/townGame.ts) the hat builder draws. */
export const HAT_IDS = ['mu-len', 'mu-rom', 'non-la', 'mu-luoi-trai', 'vong-hoa', 'mu-dau-bep', 'mu-cao-boi', 'mu-phu-thuy', 'vuong-mien'] as const;
/** Loot pets (data/townGame.ts) plus the town cat. */
export const PET_IDS = ['cho-con', 'vit', 'meo-muop', 'ga-con', 'tho', 'rua', 'cao', 'gau-truc', 'cat'] as const;

const hair = (style: HairSpec['style'], color: string): HairSpec => ({ style, color });

/** The cast. Each one is recognisable at a glance: hair style + colour, one or two signature extras. */
const CAST: Readonly<Record<string, CharacterLook>> = {
  // the learner: fair hair, blue dungarees
  player: { skin: '#f6d3b8', hair: hair('short', '#e9c46e'), top: '#f5efe2', bottom: '#5f8fd6', shoes: '#8a5a44', extras: ['dungarees'] },
  // Quảng trường: Leo, curly dark hair, coral hoodie
  square: { skin: '#c98f66', hair: hair('curly', '#3b2a22'), top: '#f19a74', bottom: '#56658a', shoes: '#f3efe6', extras: [] },
  // Quán cà phê: Emma, chestnut ponytail, mint café apron
  cafe: { skin: '#f4d2b8', hair: hair('ponytail', '#8a4f2f'), top: '#f3a9b8', bottom: '#6b5a52', shoes: '#7c5545', extras: ['apron:#86bda5', 'lashes'] },
  // Nhà bạn: Mia, black pigtails, lilac top and a pink skirt
  friend: { skin: '#f1cba9', hair: hair('pigtails', '#2c2430'), top: '#bba7e6', bottom: '#f2a7bf', shoes: '#f3efe6', extras: ['skirt', 'lashes', 'freckles'] },
  // Nhà: Grace, older, grey bun and glasses, rose cardigan
  home: { skin: '#f2d6c6', hair: hair('bun', '#d9d4ce'), top: '#e2a3ae', bottom: '#8f82a8', shoes: '#6f5a5a', extras: ['glasses', 'skirt', 'lashes'], scale: 0.95 },
  // Cửa hàng: Ben, bald with a beard, green shop apron, a bit stocky
  shop: { skin: '#e8b892', hair: hair('bald', '#6b4630'), top: '#efe6d2', bottom: '#5c6074', shoes: '#4f3d33', extras: ['beard', 'apron:#5f9472', 'stocky'] },
  // Văn phòng: Sarah, red bob, smart navy blazer with a white collar
  office: { skin: '#f8dccb', hair: hair('bob', '#c9583f'), top: '#4a5f8f', bottom: '#3b4258', shoes: '#2f2a33', extras: ['collar', 'lashes', 'freckles'] },
  // Trường học: Daniel, the teacher, glasses, mustard sweater, collar and tie
  school: { skin: '#8e5c3e', hair: hair('short', '#231c1c'), top: '#dcb45e', bottom: '#5e5148', shoes: '#3a2c26', extras: ['glasses', 'collar', 'tie:#7b3f4f'] },
  // Bến xe: Sam, transit cap and navy uniform
  station: { skin: '#dba67f', hair: hair('short', '#2a2222'), top: '#40639a', bottom: '#2f3a55', shoes: '#26232a', extras: ['cap', 'tie:#d6a740'] },
  // Phòng khám: Kim, black ponytail, white coat over blue scrubs, stethoscope
  clinic: { skin: '#f1d0ad', hair: hair('ponytail', '#1f1b22'), top: '#9fd0da', bottom: '#9fd0da', shoes: '#f3efe6', extras: ['coat', 'stethoscope', 'lashes'] },
  // Rạp phim: Zoe, pink space bun, yellow top, denim skirt
  cinema: { skin: '#a8714f', hair: hair('bun', '#e48fbf'), top: '#f4d36e', bottom: '#6f8fc0', shoes: '#f3efe6', extras: ['skirt', 'lashes'] },
  // Tiệm điện thoại: Max, the Australian tech guy, sandy spiky hair, charcoal tee with a logo, shorts
  phone: { skin: '#efc29c', hair: hair('spiky', '#c49a5c'), top: '#4f5b69', bottom: '#c8b48a', shoes: '#e9e4da', extras: ['logo', 'shorts', 'freckles'] },
  // Công viên: Lily, long strawberry-blonde hair, flower headband, green top
  park: { skin: '#f6d6bf', hair: hair('long', '#e3a472'), top: '#a6d394', bottom: '#f3e3b8', shoes: '#c97f6a', extras: ['headband:#f29bb0', 'skirt', 'lashes'] },
  // Bảng tin: Tom, cool: sunglasses, black spiky hair, red hoodie
  board: { skin: '#70482f', hair: hair('spiky', '#1c1818'), top: '#e0675c', bottom: '#3f475c', shoes: '#f3efe6', extras: ['sunglasses'] },
};

export function isCastId(id: CharacterId): boolean {
  return Object.hasOwn(CAST, id);
}

/** The look of a cast member; anybody else gets a seeded passer-by look from their id. */
export function castLook(id: CharacterId): CharacterLook {
  if (id === 'player' && playerOverride) return playerOverride;
  return CAST[id] ?? passerLook(hashString(id));
}

/** The learner's own character (the creator, docs/town.md §15); null = the default player. */
let playerOverride: CharacterLook | null = null;
let playerKey = '';

/** Use this look for 'player' from now on (every new player model, room and portrait). True when it changed. */
export function setPlayerLook(look: CharacterLook | null): boolean {
  const key = look ? JSON.stringify(look) : '';
  if (key === playerKey) return false;
  playerOverride = look;
  playerKey = key;
  return true;
}

/** A short key of the player's look now ('' = the default): a cache or a model made with another one is stale. */
export function playerLookKey(): string {
  return playerKey;
}

/** The look of a created character: skin, hair, and for a woman lashes; the player's dungarees either way. */
export function profileLook(p: { gender: 'male' | 'female'; skin: string; hair: HairSpec['style']; hairColor: string }): CharacterLook {
  const base = CAST.player;
  return { ...base, skin: p.skin, hair: hair(p.hair, p.hairColor), extras: p.gender === 'female' ? ['dungarees', 'lashes'] : ['dungarees'] };
}

// ───────────────────────── passers-by ─────────────────────────

const SKINS = ['#f7d7bf', '#f1cba9', '#e6b38c', '#d39a6f', '#b47a52', '#8e5c3e', '#6f4630', '#f4d2c0'];
const HAIRS = ['#2a2224', '#3b2a22', '#5a3a28', '#8a5a36', '#c08a52', '#e6c272', '#d36f4c', '#9a9290', '#e7a0c3', '#7d8fd6'];
const TOPS = ['#f3a6a0', '#f6c48b', '#f2dd8a', '#a8d59a', '#8fcfc2', '#94b8e8', '#b9a5e3', '#f0b3cf', '#f4efe4', '#7f8fa6', '#e3876f', '#7cb6a3'];
const BOTTOMS = ['#4f5d82', '#5b6e9a', '#6b5a52', '#3f4558', '#8a7a6a', '#c9b38f', '#7a8aa8', '#a3708a'];
const SHOES = ['#f3efe6', '#3b302c', '#7c5545', '#5b6074', '#c86b5c', '#2f2a33'];
const ADULT_STYLES: readonly HairSpec['style'][] = ['short', 'bob', 'long', 'bun', 'ponytail', 'curly', 'bald', 'spiky'];
const CHILD_STYLES: readonly HairSpec['style'][] = ['short', 'pigtails', 'ponytail', 'curly', 'spiky', 'bob'];

/** Mulberry32: small, fast, good enough for looks and idle life. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

/** A random-but-seeded look: the same seed always gives the same person. Children are 0.75 the size. */
export function passerLook(seed: number, child = false): CharacterLook {
  const r = rng(hashString(`passer:${seed}:${child ? 'c' : 'a'}`));
  const style = pick(r, child ? CHILD_STYLES : ADULT_STYLES);
  const hairColor = child ? pick(r, HAIRS.slice(0, 7)) : pick(r, HAIRS);
  const top = pick(r, TOPS);
  let bottom = pick(r, BOTTOMS);
  if (bottom === top) bottom = BOTTOMS[0];
  const extras: string[] = [];
  const feminine = style === 'long' || style === 'bun' || style === 'ponytail' || style === 'pigtails' || style === 'bob';
  if (feminine && r() < 0.5) extras.push('lashes');
  if (feminine && r() < 0.35) extras.push('skirt');
  else if (r() < 0.2) extras.push('shorts');
  if (child) {
    if (r() < 0.5) extras.push('backpack');
    if (r() < 0.3) extras.push('freckles');
  } else {
    const roll = r();
    if (roll < 0.15) extras.push('glasses');
    else if (roll < 0.22) extras.push('sunglasses');
    if (r() < 0.15) extras.push('scarf');
    if (style === 'bald' || (style === 'short' && r() < 0.2)) extras.push('beard');
    if (r() < 0.12) extras.push('backpack');
  }
  return {
    skin: pick(r, SKINS),
    hair: { style, color: style === 'bald' && hairColor === '#e6c272' ? '#9a9290' : hairColor },
    top,
    bottom,
    shoes: pick(r, SHOES),
    extras,
    scale: child ? 0.75 : 0.96 + r() * 0.08,
  };
}

// ───────────────────────── extras helpers ─────────────────────────

/** Whether a look has this extra (with or without a colour). */
export function hasExtra(look: CharacterLook, name: ExtraName): boolean {
  return (look.extras ?? []).some((e) => e === name || e.startsWith(`${name}:`));
}

/** The colour given with an extra ('apron:#hex'), or the fallback. */
export function extraColor(look: CharacterLook, name: ExtraName, fallback: string): string {
  const e = (look.extras ?? []).find((x) => x.startsWith(`${name}:`));
  const c = e?.slice(name.length + 1);
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
}
