// The rules of Westbay (docs/town.md §20, docs/city.md), pure: which scene somebody has for the learner now, what a
// scene heard pays, who of the town is up in the city today, and what is stored (KEYS.townCity, synced, merged by
// core/syncMerge mergeCity).
//
// The city is met one person at a time (a scene's `needs`): off the bus only Rico has something to say; he sends the
// learner on to the florist's, she to her neighbours, and so on. A scene heard comes back for a re-listen after 2, 7
// and 21 days (owner: "học xong không ôn lại cũng như không"), as the town's episodes do.

import type { CityScene } from './cityTypes';

// ───────────────────────── stored (version 1) ─────────────────────────
//
// heard: per scene, when it was first heard to its end, the most questions answered right at a first try, how many
// times it was heard and when last. `first`: when the learner first got off the bus in Westbay (0 = never).
// Two browsers that each heard a scene before a sync: the earlier first time, the higher best, the higher count,
// the later last time. Xu and friendship are in town-progress, not here.

export const CITY_VERSION = 1;

export interface CityHeard {
  at: number;
  best: number;
  times: number;
  last: number;
}

export interface TownCity {
  version: number;
  first: number;
  heard: Record<string, CityHeard>;
}

export function emptyTownCity(): TownCity {
  return { version: CITY_VERSION, first: 0, heard: {} };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const SCENE_ID = /^c[tv]-[a-z]{2,12}-[1-9]$/;
const time = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const count = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

export function parseTownCity(raw: unknown): TownCity {
  const out = emptyTownCity();
  if (!isObj(raw)) return out;
  out.first = time(raw.first);
  if (!isObj(raw.heard)) return out;
  for (const [id, v] of Object.entries(raw.heard)) {
    if (!SCENE_ID.test(id) || !isObj(v)) continue;
    const at = time(v.at);
    if (!at) continue;
    out.heard[id] = { at, best: count(v.best, 9), times: Math.max(1, count(v.times, 9999)), last: Math.max(at, time(v.last)) };
  }
  return out;
}

/** Idempotent, commutative and associative (core/syncMerge.props.test). */
export function mergeTownCity(x: TownCity, y: TownCity): TownCity {
  const out = emptyTownCity();
  out.version = Math.max(x.version, y.version, CITY_VERSION);
  out.first = x.first && y.first ? Math.min(x.first, y.first) : x.first || y.first;
  for (const id of new Set([...Object.keys(x.heard), ...Object.keys(y.heard)])) {
    const a = Object.hasOwn(x.heard, id) ? x.heard[id] : undefined;
    const b = Object.hasOwn(y.heard, id) ? y.heard[id] : undefined;
    out.heard[id] = !a || !b ? { ...(a ?? b)! } : { at: Math.min(a.at, b.at), best: Math.max(a.best, b.best), times: Math.max(a.times, b.times), last: Math.max(a.last, b.last) };
  }
  return out;
}

// ───────────────────────── what somebody has to say ─────────────────────────

/** A scene heard comes back this many days after it was last heard: after the first time, the second, the third. */
export const CITY_RELISTEN_DAYS: readonly number[] = [2, 7, 21];
const DAY_MS = 86_400_000;

const heardOf = (city: TownCity, id: string): CityHeard | undefined => (Object.hasOwn(city.heard, id) ? city.heard[id] : undefined);

/** Everything it needs has been heard. */
export function sceneOpen(scene: Pick<CityScene, 'needs'>, city: TownCity): boolean {
  return (scene.needs ?? []).every((id) => !!heardOf(city, id));
}

/** When a scene heard is due to be heard again (ms), or null: never heard, or heard often enough. */
export function relistenAt(h: CityHeard): number | null {
  const gap = CITY_RELISTEN_DAYS[h.times - 1];
  return gap === undefined ? null : h.last + gap * DAY_MS;
}

export type SceneNow =
  /** A scene not heard yet, open. */
  | { kind: 'new'; scene: CityScene }
  /** A scene heard, due again. */
  | { kind: 'again'; scene: CityScene }
  /** Their next scene waits for another one to be heard first (`needs`: that scene's id). */
  | { kind: 'locked'; scene: CityScene; needs: string }
  /** Everything heard, nothing due: any of it may be heard again, for nothing (`scene`: the one heard longest ago). */
  | { kind: 'idle'; scene: CityScene };

/**
 * What the person (or the town resident up in the city) `at` has for the learner now: their first scene not heard
 * yet when it is open; else one that is due again (the one longest overdue); else the locked one; else nothing new.
 * Null: nobody of that id has scenes.
 */
export function sceneNow(scenes: readonly CityScene[], at: string, city: TownCity, now: number): SceneNow | null {
  const own = scenes.filter((s) => s.at === at).sort((a, b) => a.n - b.n);
  if (own.length === 0) return null;
  const next = own.find((s) => !heardOf(city, s.id));
  if (next && sceneOpen(next, city)) return { kind: 'new', scene: next };
  const heard = own.filter((s) => !!heardOf(city, s.id));
  let due: { scene: CityScene; at: number } | null = null;
  for (const s of heard) {
    const t = relistenAt(heardOf(city, s.id)!);
    if (t !== null && t <= now && (!due || t < due.at)) due = { scene: s, at: t };
  }
  if (due) return { kind: 'again', scene: due.scene };
  if (next) return { kind: 'locked', scene: next, needs: (next.needs ?? []).find((id) => !heardOf(city, id)) ?? '' };
  const oldest = [...heard].sort((a, b) => heardOf(city, a.id)!.last - heardOf(city, b.id)!.last)[0];
  return { kind: 'idle', scene: oldest };
}

/** Whose scene an id is (`ct-nora-2` → 'nora'), for "meet … first". */
export function sceneOwner(id: string): string {
  return /^c[tv]-([a-z]+)-\d$/.exec(id)?.[1] ?? '';
}

/**
 * The person to go and see next: the owner of the first open scene nobody has heard, episodes before talks and
 * visits, in the order the city is met. Null: nothing new is open.
 */
export function nextToMeet(scenes: readonly CityScene[], city: TownCity, here: (at: string) => boolean): CityScene | null {
  const rank = (s: CityScene): number => (s.kind === 'episode' ? 0 : s.kind === 'chat' ? 1 : 2);
  const open = scenes.filter((s) => !heardOf(city, s.id) && sceneOpen(s, city) && here(s.at) && !scenes.some((o) => o.at === s.at && o.kind === s.kind && o.n < s.n && !heardOf(city, o.id)));
  return [...open].sort((a, b) => rank(a) - rank(b) || a.n - b.n)[0] ?? null;
}

// ───────────────────────── what a scene pays ─────────────────────────

/** Xu for a question answered right at the first try, the first time a scene is heard; a re-listen that is due pays less. */
export const CITY_XU = 2;
export const CITY_AGAIN_XU = 1;
/** Friendship (town-progress, core/town/friendship) with each town resident who speaks in a scene heard for the first time. */
export const CITY_TIE_BOND = 10;

export interface CityResult {
  /** Questions answered right at the first try, of how many. */
  right: number;
  asked: number;
}

export interface CityPay {
  xu: number;
  /** Town residents (place ids) whose friendship grows by CITY_TIE_BOND. */
  bond: readonly string[];
  /** The first time this scene was heard. */
  first: boolean;
}

/** What hearing `scene` to its end pays now, and the stored state after it. */
export function hearScene(city: TownCity, scene: CityScene, result: CityResult, townIds: ReadonlySet<string>, now: number): { city: TownCity; pay: CityPay } {
  const right = Math.max(0, Math.min(result.asked, result.right));
  const was = heardOf(city, scene.id);
  const due = was ? relistenAt(was) : null;
  const first = !was;
  const paysAgain = !!was && due !== null && due <= now;
  const xu = first ? right * CITY_XU : paysAgain ? right * CITY_AGAIN_XU : 0;
  const bond = first ? [...new Set(scene.lines.map((l) => l.who).filter((w) => townIds.has(w)))] : [];
  // a listen before it is due is practice: it does not move the next re-listen further away
  const counts = first || paysAgain;
  const heard: CityHeard = was ? { at: was.at, best: Math.max(was.best, right), times: counts ? was.times + 1 : was.times, last: counts ? now : was.last } : { at: now, best: right, times: 1, last: now };
  return { city: { ...city, heard: { ...city.heard, [scene.id]: heard } }, pay: { xu, bond, first } };
}

// ───────────────────────── who of the town is in Westbay ─────────────────────────

/**
 * The town's residents come up on their own days (docs/city.md §4), by weekday (0 Sunday … 6 Saturday): Sarah's
 * Monday meeting, Ben at his dad's on Tuesday, Daniel at the bookshop and Grace at the hospital on Wednesday, Mia's
 * karaoke and Emma's market on Thursday, Zoe and Max at the Lumen on Friday, Leo at his sister's and Kim on a course
 * on Saturday, Tom at Marcus's show on Sunday; Lily works in the city on weekdays; the no. 9 is Sam's line.
 */
export const CITY_VISITS: Readonly<Record<number, readonly string[]>> = {
  0: ['board', 'station'],
  1: ['office', 'park', 'station'],
  2: ['shop', 'park', 'station'],
  3: ['school', 'home', 'park', 'station'],
  4: ['friend', 'cafe', 'park', 'station'],
  5: ['cinema', 'phone', 'park', 'station'],
  6: ['square', 'clinic', 'station'],
};

/**
 * Who of the town is in Westbay now: today's visitors, and whoever a story needs (a town resident who speaks in a
 * scene that is open and not heard yet: the story never waits for a weekday).
 */
export function visitorsNow(scenes: readonly CityScene[], city: TownCity, weekday: number, townIds: ReadonlySet<string>): string[] {
  const out = new Set<string>(CITY_VISITS[((weekday % 7) + 7) % 7] ?? []);
  for (const s of scenes) {
    // (a visit is the resident's own scene: it happens on the days they come, it does not bring them)
    if (s.kind === 'visit' || heardOf(city, s.id) || !sceneOpen(s, city)) continue;
    if (scenes.some((o) => o.at === s.at && o.kind === s.kind && o.n < s.n && !heardOf(city, o.id))) continue;
    for (const l of s.lines) if (townIds.has(l.who)) out.add(l.who);
  }
  return [...out].filter((id) => townIds.has(id)).sort();
}
