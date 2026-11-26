// The clock and the weather as RULES of the game (docs/gta-plan.md §4.7; docs/town.md §33): until now the hour and the
// sky (./sky.ts, ./sunPath.ts wetAt) were only seen and heard. Each rule here is small, pure, and says itself in one
// sentence; every number is a guess until somebody plays it.
//
//   1. Wet roads are slippery: a vehicle the learner rides stops later and turns wider when the ground is wet
//      (rideGrip), and Westbay's traffic drives a little slower (trafficPace).
//   2. Rain drowns voices: a talk overheard is heard a step worse when it rains hard (rainMuffles / muffle, the jobs'
//      rule since M0, now shared), and a bench's overheard talk is said a little quieter (overheardVolume). No noise is
//      ever mixed over a voice: only the distance step or the volume of each line changes.
//   3. A storm breaks the radio up: Bay FM and the police scanner lose words in a storm, said in pieces with a silence
//      where the signal dropped (the jobs' `broken` lines: core/town/jobDoc.ts §2). Never a word a question asks about,
//      never a fact of the scanner (staticCut, scannerStatic).
//   4. Opening hours: data/city/hours.ts and openAt / opensAt below.
//
// What the HUD says of them is `rulesNow`.

import type { SkyMix } from './sky';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

// ───────────────────────── 1. wet roads ─────────────────────────

/** The ground counts as wet for driving from here (./sunPath.ts wetAt 0 … 1). */
export const SLIPPERY_FROM = 0.35;

export interface RideGrip {
  /** The turn rate of a vehicle ridden, times this (1 dry … 0.45 soaked): wider turns. */
  turn: number;
  /** Seconds added to the time a vehicle ridden takes to stop when let go (0 dry … 0.6 soaked): longer stops. */
  stop: number;
}

/** How a vehicle ridden holds the road at a wetness (walking is never affected). */
export function rideGrip(wet: number): RideGrip {
  const k = clamp01((wet - SLIPPERY_FROM * 0.5) / (1 - SLIPPERY_FROM * 0.5));
  return { turn: 1 - 0.55 * k, stop: 0.6 * k };
}

/** Westbay's traffic's cruising pace at a wetness, times its dry pace (1 … 0.75). */
export const trafficPace = (wet: number): number => 1 - 0.25 * clamp01(wet);

// ───────────────────────── 2. rain drowns voices ─────────────────────────

/** Rain above this (SkyMix.rain) takes what is overheard down a step (the jobs' rule since M0). */
export const MUFFLE_FROM = 0.5;

export const rainMuffles = (rain: number): boolean => rain >= MUFFLE_FROM;

export type Clarity = 'clear' | 'faint' | 'none';

/** A clarity one step worse in hard rain (clear → faint → none), as it was. */
export function muffle(c: Clarity, rain: number): Clarity {
  if (!rainMuffles(rain)) return c;
  return c === 'clear' ? 'faint' : 'none';
}

/** The volume (browser voice) of an overheard talk on a bench: quieter in hard rain, never silent. */
export const overheardVolume = (rain: number): number => (rainMuffles(rain) ? 0.6 : 1);

// ───────────────────────── 3. a storm breaks the radio up ─────────────────────────

/** A storm above this (SkyMix.storm) breaks the radio and the scanner up (the threshold of the lightning). */
export const STATIC_FROM = 0.35;

export const stormStatic = (storm: number): boolean => storm >= STATIC_FROM;

function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const wordOf = (token: string): string => token.toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * A line with one or two words lost to static: those words replaced by "..." (where a silence is heard). Never the
 * first or the last word, never a word `keep` holds, never across a sentence's end. `seed` chooses where (the same line
 * breaks the same way for the same seed). Unchanged when the line is too short or nothing may be cut.
 */
export function staticCut(text: string, keep: (word: string) => boolean, seed: number): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return text;
  const spans: [number, number][] = [];
  for (let i = 1; i < tokens.length - 1; i++)
    for (const n of [1, 2]) {
      const j = i + n - 1;
      if (j >= tokens.length - 1) continue;
      let ok = true;
      for (let k = i; k <= j; k++) {
        const w = wordOf(tokens[k]);
        // (a word that ends a sentence or a clause carries the punctuation the line needs)
        if (!w || keep(w) || (k < j && /[.,!?;:]$/.test(tokens[k]))) ok = false;
      }
      if (ok) spans.push([i, j]);
    }
  if (spans.length === 0) return text;
  const [i, j] = spans[Math.floor(hash(seed) * spans.length) % spans.length];
  return [...tokens.slice(0, i), '...', ...tokens.slice(j + 1)].join(' ').replace(/\s+\.\.\.\s+/g, ' ... ');
}

/** The pieces a broken line is said in (a silence between each), as the jobs' `broken` lines are. */
export const staticPieces = (text: string): string[] => text.split(/\s*\.\.\.\s*/).filter((x) => /[a-z0-9]/i.test(x));

/**
 * The police scanner in a storm: the call sign at the start of a call ("All units,", "Unit twelve,") is lost to
 * static; what follows (the street, the heading, the vehicle, the top, the place) never is.
 */
export function scannerStatic(text: string): string {
  const m = /^(All units|Unit [a-z-]+)[,.]\s+/i.exec(text);
  return m ? `... ${text.slice(m[0].length)}` : text;
}

// ───────────────────────── what the HUD says ─────────────────────────

export type SkyRule = 'slippery' | 'muffled' | 'static';

/** The rules in force now, in the order the HUD names them. */
export function rulesNow(mix: Pick<SkyMix, 'rain' | 'storm'>, wet: number): SkyRule[] {
  const out: SkyRule[] = [];
  if (wet >= SLIPPERY_FROM) out.push('slippery');
  if (stormStatic(mix.storm)) out.push('static');
  else if (rainMuffles(mix.rain)) out.push('muffled');
  return out;
}
