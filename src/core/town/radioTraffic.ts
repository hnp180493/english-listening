// Bay FM's traffic (docs/town.md §25, docs/gta-plan.md §4.5): what Marcus says about Westbay's roads is read off the
// streets AS THEY ARE when the bulletin is made (features/town/streets/streetsWorld.ts keeps the cars and registers
// itself here as the source while Westbay's page is open): which street is busy and which way most of it is going,
// which street is clear, that the roads are wet so the traffic is slower (core/town/skyRules.ts trafficPace, the same
// value the cars drive by), and on which street a police car is out (a search's or a job's patrol). Every line is a
// claim that radioTraffic.test.ts checks against the cars it was made from, like the forecast against skyAt.
//
// Down in the town there are no streets with traffic: no source, no traffic segment (the bulletin is as before). The
// no. 9's road up to Westbay has no timetable or traffic of its own in the game, so nothing is said about it.
//
// Pure, but for the source (a function the open page sets). It never imports the map: the snapshot carries the
// streets' names and the patrol's street, so the town's chunk does not pull Westbay's map in.

import { BUSY, CLEAR, COMPASS_WORDS, PATROL, QUIET, TRAFFIC_A, TRAFFIC_LEADS, TRAFFIC_Q, WET } from '../../data/scenes/radioTraffic';
import type { Piece } from '../../data/scenes/radioLive';
import type { SceneQuestion } from './sceneTypes';
import { trafficPace } from './skyRules';
import { getLang, tr } from '../../i18n';

// The meanings are put together here, so each piece goes through the interface language BEFORE it is filled in
// (docs/i18n.md §4; in Vietnamese tr returns its text as is). What is said never changes.
const V = (vi: string): string => tr(vi);
const W = (p: Piece): string => (getLang() === 'en' ? p.en : p.vi);
import type { Compass } from './streets';

/** Westbay's streets at a moment, as the radio reads them. */
export interface TrafficSnapshot {
  /** The car streets (id and the name people say). */
  streets: readonly { id: string; name: string }[];
  /** The cars: the street each drives, its heading, its speed now (tiles/s). */
  cars: readonly { street: string; dir: Compass; speed: number }[];
  /** A police car out: the name of the street it is on (null: not on a named street); undefined: none out. */
  patrol?: string | null;
  /** How wet the roads are (0 … 1: core/town/skyNow.ts wetSoon, what the cars drive by). */
  wet: number;
}

let source: (() => TrafficSnapshot) | null = null;

/** The open page's streets (features/town/streets/streetsWorld.ts), or null when it closes. */
export function setTrafficSource(fn: (() => TrafficSnapshot) | null): void {
  source = fn;
}
/** The page closes: its source goes, unless another has taken its place already. */
export function releaseTrafficSource(fn: () => TrafficSnapshot): void {
  if (source === fn) source = null;
}
/** Westbay's streets now, or null (the town, or Westbay's page not open). */
export function trafficSnapshot(): TrafficSnapshot | null {
  try {
    return source ? source() : null;
  } catch {
    return null;
  }
}

/** Below this speed (tiles/s) a car is standing still. */
export const STILL = 0.4;
/** A street with this many cars or more is busy. */
export const BUSY_FROM = 2;
/** The traffic is said to be slower when the wet takes off at least this share of its pace. */
export const SLOW_SHARE = 0.05;

/** What the report says, as facts (for the questions and the tests). */
export interface TrafficFacts {
  /** The busiest street (the most cars, at least BUSY_FROM; the first in the list on a tie). */
  busy: { id: string; name: string; count: number; heading: Compass | 'both' | null; standing: boolean } | null;
  /** A car street with no car on it (said only with a busy one, or none). */
  clear: string | null;
  quiet: boolean;
  wet: boolean;
  /** The patrol's street (null: out, not on a named street; undefined: none). */
  patrol?: string | null;
}

export interface TrafficReport {
  lead: Piece;
  /** The lines that carry the facts (never broken up by a storm). */
  lines: Piece[];
  facts: TrafficFacts;
  question: SceneQuestion;
}

function hash(n: number): number {
  let x = (n ^ 0x51ed27f3) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const pickOf = <T,>(list: readonly T[], seed: number, salt: number): T => list[Math.floor(hash(seed * 37 + salt) * list.length) % list.length];
const put = (s: string, v: Record<string, string>): string => s.replace(/\{([A-Z])\}/g, (m, k: string) => v[k] ?? m);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Three answers, the right one at a place of the seed's. */
function ask(q: string, right: string, wrong: readonly [string, string], seed: number): SceneQuestion {
  const at = Math.floor(hash(seed) * 3) % 3;
  const others = [...wrong];
  const options = [0, 1, 2].map((i) => (i === at ? right : others.shift()!)) as unknown as readonly [string, string, string];
  return { q, options, answer: at };
}

/** The facts of a snapshot. */
export function trafficFacts(snap: TrafficSnapshot, seed: number): TrafficFacts {
  const count = new Map<string, number>();
  for (const c of snap.cars) count.set(c.street, (count.get(c.street) ?? 0) + 1);
  let busy: TrafficFacts['busy'] = null;
  for (const s of snap.streets) {
    const n = count.get(s.id) ?? 0;
    if (n >= BUSY_FROM && (!busy || n > busy.count)) busy = { id: s.id, name: s.name, count: n, heading: null, standing: false };
  }
  if (busy) {
    const on = snap.cars.filter((c) => c.street === busy!.id);
    const by = new Map<Compass, number>();
    for (const c of on) by.set(c.dir, (by.get(c.dir) ?? 0) + 1);
    const ways = [...by.entries()].sort((a, b) => b[1] - a[1]);
    busy.heading = ways.length === 1 || ways[0][1] > ways[1][1] ? ways[0][0] : ways.length === 2 ? 'both' : null;
    busy.standing = on.filter((c) => c.speed < STILL).length >= 2;
  }
  const empty = snap.streets.filter((s) => (count.get(s.id) ?? 0) === 0);
  const clear = empty.length > 0 ? pickOf(empty, seed, 3).name : null;
  return { busy, clear, quiet: !busy, wet: trafficPace(snap.wet) <= 1 - SLOW_SHARE, ...(snap.patrol !== undefined ? { patrol: snap.patrol } : {}) };
}

/** Other street names than `not`, two of them by the seed (from the car streets). */
function twoOther(snap: TrafficSnapshot, not: (name: string) => boolean, seed: number): [string, string] | null {
  const pool = snap.streets.map((s) => s.name).filter((n) => !not(n));
  if (pool.length < 2) return null;
  const a = pickOf(pool, seed, 11);
  const b = pickOf(
    pool.filter((n) => n !== a),
    seed,
    12,
  );
  return [a, b];
}

/** The traffic segment of a bulletin (null: nothing to read). `seed` is the bulletin's edition. */
export function trafficReport(snap: TrafficSnapshot | null, seed: number): TrafficReport | null {
  if (!snap || snap.streets.length === 0) return null;
  const f = trafficFacts(snap, seed);
  const lines: Piece[] = [];
  const S = (p: Piece, v: Record<string, string>): Piece => ({ en: cap(put(p.en, v)), vi: cap(put(V(p.vi), v)) });
  const M = (p: Piece): Piece => ({ en: p.en, vi: V(p.vi) });

  if (f.busy) {
    const b = f.busy;
    if (b.standing) lines.push(S(BUSY.standing, { S: b.name }));
    else if (b.heading === 'both') lines.push(S(BUSY.bothWays, { S: b.name }));
    else if (b.heading) lines.push({ en: cap(put(BUSY.heading.en, { S: b.name, C: COMPASS_WORDS[b.heading].en })), vi: cap(put(V(BUSY.heading.vi), { S: b.name, C: W(COMPASS_WORDS[b.heading]) })) });
    if (f.clear) lines.push(S(pickOf(CLEAR, seed, 4), { S: f.clear }));
  } else lines.push(M(pickOf(QUIET, seed, 5)));
  if (f.wet) lines.push(M(WET));
  if (f.patrol !== undefined) lines.push(f.patrol ? S(PATROL.on, { S: f.patrol }) : M(PATROL.out));

  // one question, of what was said: the patrol's street, why it is slow, the busy street or its heading, or that it
  // is quiet (by the edition, among those that were said)
  const qs: SceneQuestion[] = [];
  if (f.patrol) {
    const o = twoOther(snap, (n) => n === f.patrol, seed);
    if (o) qs.push(ask(V(TRAFFIC_Q.patrol.q), f.patrol, o, seed * 5 + 1));
  }
  if (f.wet) qs.push(ask(V(TRAFFIC_Q.slow.q), V(TRAFFIC_A.slow.options[0]), [V(TRAFFIC_A.slow.options[1]), V(TRAFFIC_A.slow.options[2])], seed * 5 + 2));
  if (f.busy) {
    const b = f.busy;
    // the wrong streets are less busy than the one said
    const count = (name: string) => snap.cars.filter((c) => snap.streets.find((s) => s.name === name)?.id === c.street).length;
    const o = twoOther(snap, (n) => n === b.name || count(n) >= b.count, seed);
    if (o) qs.push(ask(V(TRAFFIC_Q.busy.q), b.name, o, seed * 5 + 3));
    if (b.heading && b.heading !== 'both' && !b.standing) {
      const word = (c: Compass) => put(V(TRAFFIC_A.heading.vi), { C: W(COMPASS_WORDS[c]) });
      const others = (['north', 'south', 'east', 'west'] as const).filter((c) => c !== b.heading);
      const w1 = pickOf(others, seed, 13);
      const w2 = pickOf(
        others.filter((c) => c !== w1),
        seed,
        14,
      );
      qs.push(ask(put(V(TRAFFIC_Q.heading.q), { S: b.name }), word(b.heading), [word(w1), word(w2)], seed * 5 + 4));
    }
  } else qs.push(ask(V(TRAFFIC_Q.quiet.q), V(TRAFFIC_A.quiet.options[0]), [V(TRAFFIC_A.quiet.options[1]), V(TRAFFIC_A.quiet.options[2])], seed * 5 + 5));
  const question = pickOf(qs, seed, 6);
  return { lead: M(pickOf(TRAFFIC_LEADS, seed, 7)), lines, facts: f, question };
}
