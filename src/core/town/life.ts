// "Hẹn hò, cưới, con" and the learner's own character (docs/town.md §15): what is stored under KEYS.townLife (synced,
// merged by core/syncMerge mergeTownLife) and the pure rules on it. Friendship points stay in town-progress
// (./friendship): a date or a warm answer adds to them there; hearts open the steps here.
//
// Stored (version 1):
// - profile: the learner's character (gender, name, skin, hair style and colour), replaced as a whole with its own
//   change time `at` (the newer one wins, never "the machine that wrote last").
// - court: per resident, when each step happened: dating (the confession said yes), date1..3, engaged, married. Times
//   only appear and merge by min (the first time it happened anywhere). The partner is the one whose `dating` is the
//   earliest (two machines that each started courting someone before a sync: the first one stays).
// - kids: per child id (`kid-<born>`): name, boy / girl, born; edits carry their own `at` (the newer wins).
// - choices: per scene, the option first chosen and when (the earlier wins), so a choice pays its points once.
// - talked: day → scene ids talked through that day (a spouse's or a child's daily scene pays once a day); union,
//   only the last TALKED_DAYS days kept.

import type { PlayerGender } from './romanceTypes';

export const LIFE_VERSION = 1;

/** Hair styles the creator offers (three/chars HairSpec styles that suit the player). */
export const PLAYER_HAIR = ['short', 'spiky', 'curly', 'bob', 'ponytail', 'long', 'bun', 'pigtails', 'bald'] as const;
export type PlayerHair = (typeof PLAYER_HAIR)[number];

/** Skin tones and hair colours of the creator (the cast's own palette). */
export const PLAYER_SKINS = ['#f8dccb', '#f6d3b8', '#efc29c', '#dba67f', '#c98f66', '#a8714f', '#8e5c3e', '#70482f'] as const;
export const PLAYER_HAIR_COLORS = ['#e9c46e', '#c49a5c', '#8a4f2f', '#3b2a22', '#1c1818', '#c9583f', '#d9d4ce', '#e48fbf'] as const;

export interface PlayerProfile {
  gender: PlayerGender;
  /** 1–16 letters, shown over the head and said by residents in text scenes ({name}). */
  name: string;
  skin: string;
  hair: PlayerHair;
  hairColor: string;
  /** When it was last changed (ms). */
  at: number;
}

export type CourtStep = 'dating' | 'date1' | 'date2' | 'date3' | 'engaged' | 'married';
export const COURT_STEPS: readonly CourtStep[] = ['dating', 'date1', 'date2', 'date3', 'engaged', 'married'];
export type Courtship = Partial<Record<CourtStep, number>>;

export interface Kid {
  name: string;
  gender: 'boy' | 'girl';
  born: number;
  /** When the name or gender was last set (ms). */
  at: number;
}

export interface TownLife {
  version: number;
  profile: PlayerProfile | null;
  court: Record<string, Courtship>;
  kids: Record<string, Kid>;
  choices: Record<string, { o: string; at: number }>;
  talked: Record<string, string[]>;
}

export const TALKED_DAYS = 40;
const MAX_KIDS = 3;
const MAX_CHOICES = 2000;

export function emptyTownLife(): TownLife {
  return { version: LIFE_VERSION, profile: null, court: {}, kids: {}, choices: {}, talked: {} };
}

// ───────────────────────── parse ─────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const time = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const ID = /^[a-z0-9][a-z0-9:-]{0,63}$/;
const isId = (k: string) => ID.test(k) && k !== '__proto__';
const COLOR = /^#[0-9a-f]{6}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A name as the creator keeps it: trimmed, inner spaces single, at most 16 characters; '' when nothing is left. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // control characters, tags and the scenes' {placeholders} are dropped (no regex over control characters)
  const kept = [...raw].filter((ch) => ch.charCodeAt(0) >= 32 && !'<>{}'.includes(ch)).join('');
  return kept.replace(/\s+/g, ' ').trim().slice(0, 16).trim();
}

export function parseProfile(raw: unknown): PlayerProfile | null {
  if (!isObj(raw)) return null;
  const gender = raw.gender === 'male' || raw.gender === 'female' ? raw.gender : null;
  const name = cleanName(raw.name);
  const hair = (PLAYER_HAIR as readonly string[]).includes(raw.hair as string) ? (raw.hair as PlayerHair) : null;
  const skin = typeof raw.skin === 'string' && COLOR.test(raw.skin) ? raw.skin : null;
  const hairColor = typeof raw.hairColor === 'string' && COLOR.test(raw.hairColor) ? raw.hairColor : null;
  const at = time(raw.at);
  if (!gender || !name || !hair || !skin || !hairColor || !at) return null;
  return { gender, name, skin, hair, hairColor, at };
}

function parseCourt(raw: unknown): Record<string, Courtship> {
  const out: Record<string, Courtship> = {};
  if (!isObj(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isId(id) || !isObj(v)) continue;
    const c: Courtship = {};
    for (const s of COURT_STEPS) {
      const t = time(v[s]);
      if (t) c[s] = t;
    }
    if (Object.keys(c).length > 0) out[id] = c;
  }
  return out;
}

function parseKid(raw: unknown): Kid | null {
  if (!isObj(raw)) return null;
  const name = cleanName(raw.name);
  const gender = raw.gender === 'boy' || raw.gender === 'girl' ? raw.gender : null;
  const born = time(raw.born);
  if (!name || !gender || !born) return null;
  return { name, gender, born, at: time(raw.at) || born };
}

export function parseTownLife(raw: unknown): TownLife {
  const life = emptyTownLife();
  if (!isObj(raw)) return life;
  life.profile = parseProfile(raw.profile);
  life.court = parseCourt(raw.court);
  if (isObj(raw.kids)) {
    for (const [id, v] of Object.entries(raw.kids)) {
      const k = isId(id) ? parseKid(v) : null;
      if (k) life.kids[id] = k;
    }
  }
  if (isObj(raw.choices)) {
    for (const [id, v] of Object.entries(raw.choices)) {
      if (!isId(id) || !isObj(v) || typeof v.o !== 'string' || !isId(v.o) || !time(v.at)) continue;
      life.choices[id] = { o: v.o, at: time(v.at) };
    }
  }
  if (isObj(raw.talked)) {
    for (const [day, v] of Object.entries(raw.talked)) {
      if (!DAY.test(day) || !Array.isArray(v)) continue;
      const ids = [...new Set(v.filter((x): x is string => typeof x === 'string' && isId(x)))].sort();
      if (ids.length > 0) life.talked[day] = ids;
    }
  }
  return trim(life);
}

/** The caps: the newest TALKED_DAYS days, MAX_CHOICES choices (by id), the MAX_KIDS first-born children. */
function trim(life: TownLife): TownLife {
  const days = Object.keys(life.talked).sort();
  for (const d of days.slice(0, Math.max(0, days.length - TALKED_DAYS))) delete life.talked[d];
  const choices = Object.keys(life.choices).sort();
  for (const c of choices.slice(MAX_CHOICES)) delete life.choices[c];
  const kids = Object.entries(life.kids).sort((a, b) => a[1].born - b[1].born || (a[0] < b[0] ? -1 : 1));
  for (const [id] of kids.slice(MAX_KIDS)) delete life.kids[id];
  return life;
}

// ───────────────────────── merge ─────────────────────────

const minTime = (a: number | undefined, b: number | undefined): number | undefined => (a && b ? Math.min(a, b) : a || b);

function newerProfile(a: PlayerProfile | null, b: PlayerProfile | null): PlayerProfile | null {
  if (!a || !b) return a ?? b;
  if (a.at !== b.at) return a.at > b.at ? a : b;
  // the same time on two machines: a fixed order of their text, so both sides agree
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** Idempotent, commutative and associative (core/syncMerge.props.test). */
export function mergeTownLife(x: TownLife, y: TownLife): TownLife {
  const out = emptyTownLife();
  out.version = Math.max(x.version, y.version, LIFE_VERSION);
  out.profile = newerProfile(x.profile, y.profile);
  for (const id of new Set([...Object.keys(x.court), ...Object.keys(y.court)])) {
    const a = x.court[id] ?? {};
    const b = y.court[id] ?? {};
    const c: Courtship = {};
    for (const s of COURT_STEPS) {
      const t = minTime(a[s], b[s]);
      if (t) c[s] = t;
    }
    out.court[id] = c;
  }
  for (const id of new Set([...Object.keys(x.kids), ...Object.keys(y.kids)])) {
    const a = x.kids[id];
    const b = y.kids[id];
    if (!a || !b) {
      out.kids[id] = { ...(a ?? b)! };
      continue;
    }
    const pick = a.at !== b.at ? (a.at > b.at ? a : b) : JSON.stringify(a) >= JSON.stringify(b) ? a : b;
    out.kids[id] = { ...pick, born: Math.min(a.born, b.born) };
  }
  for (const id of new Set([...Object.keys(x.choices), ...Object.keys(y.choices)])) {
    const a = x.choices[id];
    const b = y.choices[id];
    out.choices[id] = !a || !b ? { ...(a ?? b)! } : a.at !== b.at ? { ...(a.at < b.at ? a : b) } : { ...(a.o <= b.o ? a : b) };
  }
  for (const day of new Set([...Object.keys(x.talked), ...Object.keys(y.talked)])) {
    out.talked[day] = [...new Set([...(x.talked[day] ?? []), ...(y.talked[day] ?? [])])].sort();
  }
  return trim(out);
}

// ───────────────────────── reading ─────────────────────────

/** The one being courted or married (the earliest `dating`), or null. */
export function partnerOf(life: TownLife): string | null {
  let best: string | null = null;
  let at = Infinity;
  for (const [id, c] of Object.entries(life.court)) {
    if (c.dating && (c.dating < at || (c.dating === at && best !== null && id < best))) {
      best = id;
      at = c.dating;
    }
  }
  return best;
}

/** Where the courtship with the partner stands. */
export type CourtStage = 'single' | 'dating' | 'engaged' | 'married';

export function courtStage(life: TownLife): CourtStage {
  const p = partnerOf(life);
  const c = p ? life.court[p] : undefined;
  if (!c?.dating) return 'single';
  if (c.married) return 'married';
  if (c.engaged) return 'engaged';
  return 'dating';
}

/** Dates done with the partner (0–3). */
export function datesDone(c: Courtship | undefined): number {
  return c ? (['date1', 'date2', 'date3'] as const).filter((d) => !!c[d]).length : 0;
}

/** The latest step with the partner (ms; 0 none): one step a day at most. */
export function lastStep(c: Courtship | undefined): number {
  return c ? Math.max(0, ...COURT_STEPS.map((s) => c[s] ?? 0)) : 0;
}

/** Children, oldest first. */
export function kidsOf(life: TownLife): { id: string; kid: Kid }[] {
  return Object.entries(life.kids)
    .sort((a, b) => a[1].born - b[1].born || (a[0] < b[0] ? -1 : 1))
    .map(([id, kid]) => ({ id, kid }));
}

export type KidAge = 'baby' | 'toddler' | 'child';
/** Days from which a child is a toddler / a schoolchild. */
export const TODDLER_DAYS = 7;
export const CHILD_DAYS = 21;

/** Whole days since `born` (by the clock, not the calendar). */
export function daysOld(born: number, now: number): number {
  return Math.max(0, Math.floor((now - born) / 86400000));
}

export function kidAge(born: number, now: number): KidAge {
  const d = daysOld(born, now);
  return d >= CHILD_DAYS ? 'child' : d >= TODDLER_DAYS ? 'toddler' : 'baby';
}

export { MAX_KIDS };

// ───────────────────────── writing (pure) ─────────────────────────

export function withProfile(life: TownLife, p: Omit<PlayerProfile, 'at'>, now: number): TownLife {
  const profile = parseProfile({ ...p, at: now });
  return profile ? { ...life, profile } : life;
}

/** `step` with `placeId` happened at `now` (kept if it had happened already). */
export function withStep(life: TownLife, placeId: string, step: CourtStep, now: number): TownLife {
  const c = life.court[placeId] ?? {};
  if (c[step]) return life;
  return { ...life, court: { ...life.court, [placeId]: { ...c, [step]: now } } };
}

export function withKid(life: TownLife, name: string, gender: Kid['gender'], now: number): { life: TownLife; id: string } | null {
  const n = cleanName(name);
  if (!n || Object.keys(life.kids).length >= MAX_KIDS) return null;
  let id = `kid-${now}`;
  while (life.kids[id]) id += '1';
  return { life: { ...life, kids: { ...life.kids, [id]: { name: n, gender, born: now, at: now } } }, id };
}

export function withChoice(life: TownLife, sceneId: string, optionId: string, now: number): { life: TownLife; first: boolean } {
  if (life.choices[sceneId] || !isId(sceneId) || !isId(optionId)) return { life, first: false };
  return { life: { ...life, choices: { ...life.choices, [sceneId]: { o: optionId, at: now } } }, first: true };
}

export function withTalked(life: TownLife, day: string, id: string): TownLife {
  const had = life.talked[day] ?? [];
  if (had.includes(id)) return life;
  return trim({ ...life, talked: { ...life.talked, [day]: [...had, id].sort() } });
}

export function talkedOn(life: TownLife, day: string, id: string): boolean {
  return (life.talked[day] ?? []).includes(id);
}
