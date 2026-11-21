// "Câu cá" at the pond of "Thị trấn" (docs/town.md §10). Pure and deterministic (seeded, never Math.random).
//
// A cast hooks a fish; the fish SAYS something short (a built-in item with a shipped clip: a spoken chunk of Cụm từ,
// one sentence of a minimal pair of Phân biệt âm, or a short dictation sentence) and the learner picks what was said
// among 3–4 options (2–3 for a minimal pair) before the line snaps (`timeLimitMs`, counted by the panel from the end
// of the first play). Right in time = caught; wrong, too slow or too many plays = it got away.
//
//   rollCast(progress, seed, { streak })   the fish and its item: rarer tiers = harder items, less time, fewer
//                                          plays; a streak of catches in this session raises the odds of a rare one
//   catchOutcome(cast, { correct, plays, ms })   caught or escaped, and the xu a catch is worth
//   applyCatch(progress, cast, outcome, now, device)   the collection, the xu (FISH_DAILY_XU a day at most), the
//                                          day's counters and any daily task reached
//   fishAlbum(progress)                    the collection for the album
//
//   catch on the first listen   1 / 2 / 3 / 5 xu (thường / hiếm / quý / huyền thoại, data/townGame RARITY)
//   catch with replays          half of it, rounded up
//   a species caught first      +NEW_SPECIES_XU
//   all fishing of a day        at most FISH_DAILY_XU xu over every browser; casts stay unlimited (practice)
//
// Honest limits: the options are 4 written chunks, 2–3 near-identical sentences (a minimal pair: a 33–50% chance
// floor) or 3 meanings (33%). A catch is a game score, never a measurement (docs/town.md §8).

import { CHUNKS } from '../../data/chunks';
import { PAIR_SETS } from '../../data/pairs';
import { SENTENCES } from '../../data/sentences';
import { FISH_SPECIES, RARITIES, RARITY, rarityRank, type FishSpecies, type Rarity } from '../../data/townGame';
import { decode } from '../decoder';
import { PHENOMENON_INFO } from '../phenomena';
import type { Annotation, Chunk, Phenomenon, Sentence } from '../types';
import { noteGame, type TaskPayout } from './daily';
import { addEarned, dailySum, fishRecord, noteFish, townDay, type FishRecord, type TownProgress } from './progress';
import type { TownLine } from './types';
import { choicesFor, seededRandom } from './visit';

/** Xu fishing can pay in one local day, over every browser. */
export const FISH_DAILY_XU = 30;
/** Extra xu for the first catch of a species. */
export const NEW_SPECIES_XU = 2;
/** Catches in a row (this session) that still raise the odds of a rare fish. */
export const STREAK_MAX = 5;
/** Catches before a quý fish can bite, and before a huyền thoại one can. */
export const QUY_AFTER = 3;
export const HUYEN_THOAI_AFTER = 15;
/** Time to answer, ms, at tier thường (the tier's timeFactor scales it). */
export const BASE_TIME_MS: Readonly<Record<FishItemKind, number>> = { chunk: 7000, pair: 9000, sentence: 12000 };
/** Written chunks offered for a chunk item (the right one included). */
export const CHUNK_OPTIONS = 4;

export type FishItemKind = 'chunk' | 'pair' | 'sentence';

/** What the fish says and how to play it. */
export interface FishItem {
  kind: FishItemKind;
  /** Stable ref: the chunk id ('c001'), the pair item id and option ('can-1#0'), the sentence id ('s012'). */
  ref: string;
  /**
   * How to play it, always a shipped clip (core/audioInventory):
   * - 'clip': `speak(text, { mode })`; a chunk is `ttsText` with mode 'connected' (as Cụm từ), a minimal pair option
   *   is mode-less (`mode` undefined, as Phân biệt âm);
   * - 'line': a dictation sentence: play `dictationAudio(line).connected` with mode 'connected'
   *   (features/dictation/decodeCache), exactly as a town conversation plays a line.
   */
  play: { kind: 'clip'; text: string; mode: 'connected' | undefined } | { kind: 'line'; line: TownLine };
  /** 'said': the options are English (which words were said); 'meaning': the options are Vietnamese meanings. */
  ask: 'said' | 'meaning';
  /** Shown after the answer: the written words, how they sound (a chunk), the meaning (a sentence). */
  reveal: { text: string; spoken?: string; vi?: string };
  /** Shown after the answer: what THIS item does to the sound (fishTip), never only the species' card. */
  tip: FishTip;
}

/**
 * The tip after a cast, taken from the item itself: `phenomenon` is always one the item has (a chunk's own labels or
 * the decoder's annotation of its words; a minimal pair's set; an annotation the decoder finds in the sentence),
 * `text` is about these words (the decoder's rule for that annotation, the pair item's own cue), or, when the decoder
 * has nothing on a chunk, the plain summary of the chunk's first label (no example from other words).
 */
export interface FishTip {
  phenomenon: Phenomenon;
  /** Vietnamese short label of the phenomenon (core/phenomena). */
  label: string;
  text: string;
}

export interface FishCast {
  species: FishSpecies;
  item: FishItem;
  /** In the order shown. */
  options: string[];
  /** Index of the right one in `options`. */
  answer: number;
  /** From the end of the first play to the answer. */
  timeLimitMs: number;
  /** Plays allowed, the first included. */
  maxPlays: number;
  /** Xu a catch on the first listen is worth (before the daily cap and the new-species bonus). */
  xu: number;
  seed: number;
}

// ───────────────────────── the items of a species ─────────────────────────

const lower = (s: string): string => s.toLowerCase().replace(/[’']/g, "'").trim();

function sentenceLine(s: Sentence): TownLine {
  const line: TownLine = { id: s.id, text: s.text, vi: s.vi, level: s.level, sentenceId: s.id };
  if (s.say) line.say = s.say;
  return line;
}

let topicLines: Map<string, TownLine[]> | null = null;
/** Every dictation sentence of a topic as a line (the pool of wrong meanings, as at a place of the town). */
function linesOfTopic(topic: string): TownLine[] {
  if (!topicLines) {
    topicLines = new Map();
    for (const s of SENTENCES) {
      const list = topicLines.get(s.topic);
      if (list) list.push(sentenceLine(s));
      else topicLines.set(s.topic, [sentenceLine(s)]);
    }
  }
  return topicLines.get(topic) ?? [];
}

/** One playable thing of a species' pool. */
export type PoolEntry =
  | { kind: 'chunk'; chunk: Chunk }
  | { kind: 'pair'; options: readonly string[]; itemId: string; said: number; phenomenon: Phenomenon; cue: string }
  | { kind: 'sentence'; sentence: Sentence };

const poolCache = new Map<string, PoolEntry[]>();

/** Every item a species can say (data/townGame FishPool), in content order. */
export function speciesPool(species: FishSpecies): PoolEntry[] {
  const hit = poolCache.get(species.id);
  if (hit) return hit;
  const p = species.pool;
  let out: PoolEntry[] = [];
  if (p.from === 'chunks') {
    out = CHUNKS.filter((c) => c.phenomena[0] === p.phenomenon && c.rank <= p.maxRank && c.ttsText.trim()).map((chunk) => ({ kind: 'chunk', chunk }));
  } else if (p.from === 'pairs') {
    for (const set of PAIR_SETS) {
      if (set.phenomenon !== p.phenomenon) continue;
      for (const item of set.items) {
        if (item.options.length < 2) continue;
        item.options.forEach((_, said) => out.push({ kind: 'pair', options: item.options, itemId: item.id, said, phenomenon: set.phenomenon, cue: item.cue }));
      }
    }
  } else {
    out = SENTENCES.filter((s) => p.levels.includes(s.level) && s.focus.includes(p.phenomenon) && s.focus.length >= (p.minFocus ?? 1)).map((sentence) => ({ kind: 'sentence', sentence }));
  }
  poolCache.set(species.id, out);
  return out;
}

// ───────────────────────── the tip of an item ─────────────────────────

function annotationsOf(text: string): Annotation[] {
  try {
    return decode(text).annotations;
  } catch {
    return [];
  }
}

const tipOf = (phenomenon: Phenomenon, text: string): FishTip => ({ phenomenon, label: PHENOMENON_INFO[phenomenon].label, text });

/**
 * The tip of one pool entry of `species` (see FishTip). The decoder's annotation of the species' phenomenon comes
 * first, then one of the item's own labels (a chunk's `phenomena`, a sentence's `focus`, in their order), then (a
 * sentence) the first annotation the decoder finds. A minimal pair always gives its item's cue.
 */
export function fishTip(species: Pick<FishSpecies, 'phenomenon'>, entry: PoolEntry): FishTip {
  if (entry.kind === 'pair') return tipOf(entry.phenomenon, entry.cue);
  const text = entry.kind === 'chunk' ? entry.chunk.written : entry.sentence.text;
  const labels: readonly Phenomenon[] = entry.kind === 'chunk' ? entry.chunk.phenomena : entry.sentence.focus;
  const found = annotationsOf(text);
  const pick =
    found.find((a) => a.type === species.phenomenon) ??
    labels.map((p) => found.find((a) => a.type === p)).find((a) => a !== undefined) ??
    (entry.kind === 'sentence' ? found[0] : undefined);
  if (pick && pick.rule.trim()) return tipOf(pick.type, pick.rule.trim());
  const p = labels[0] ?? species.phenomenon;
  return tipOf(p, PHENOMENON_INFO[p].summary);
}

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Three other chunks for a chunk item: different written words and a different sound, the most confusable first
 * (the same first phenomenon, a shared one, a similar length), three drawn from the best eight.
 */
function chunkDistractors(right: Chunk, rand: () => number): string[] {
  const taken = new Set([lower(right.written)]);
  const sounds = new Set([lower(right.spoken), lower(right.ttsText)]);
  const words = right.written.split(/\s+/).length;
  const ranked = CHUNKS.filter((c) => c.id !== right.id && !taken.has(lower(c.written)) && !sounds.has(lower(c.spoken)) && !sounds.has(lower(c.ttsText)))
    .map((c) => {
      let score = 0;
      if (c.phenomena[0] === right.phenomena[0]) score += 2;
      if (c.phenomena.some((x) => right.phenomena.includes(x))) score += 1;
      if (c.written.split(/\s+/).length === words) score += 1;
      score -= Math.abs(c.written.length - right.written.length) / 20;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score || a.c.rank - b.c.rank);
  const out: string[] = [];
  for (const { c } of shuffled(ranked.slice(0, 8), rand)) {
    if (out.length >= CHUNK_OPTIONS - 1) break;
    const key = lower(c.written);
    if (taken.has(key)) continue;
    taken.add(key);
    out.push(c.written);
  }
  return out;
}

function roundTo(ms: number, step: number): number {
  return Math.max(step, Math.round(ms / step) * step);
}

/** The cast for one pool entry of `species`, its options drawn with `rand`. */
function castOf(species: FishSpecies, entry: PoolEntry, rand: () => number, seed: number): FishCast {
  const tier = RARITY[species.tier];
  let item: FishItem;
  let options: string[];
  let answer: number;
  if (entry.kind === 'chunk') {
    const c = entry.chunk;
    item = { kind: 'chunk', ref: c.id, play: { kind: 'clip', text: c.ttsText, mode: 'connected' }, ask: 'said', reveal: { text: c.written, spoken: c.spoken }, tip: fishTip(species, entry) };
    const wrong = chunkDistractors(c, rand);
    answer = Math.floor(rand() * (wrong.length + 1));
    options = [...wrong];
    options.splice(answer, 0, c.written);
  } else if (entry.kind === 'pair') {
    const said = entry.options[entry.said];
    item = { kind: 'pair', ref: `${entry.itemId}#${entry.said}`, play: { kind: 'clip', text: said, mode: undefined }, ask: 'said', reveal: { text: said }, tip: fishTip(species, entry) };
    options = shuffled(entry.options, rand);
    answer = options.indexOf(said);
  } else {
    const s = entry.sentence;
    const line = sentenceLine(s);
    item = { kind: 'sentence', ref: s.id, play: { kind: 'line', line }, ask: 'meaning', reveal: { text: s.text, vi: s.vi }, tip: fishTip(species, entry) };
    const choices = choicesFor(line, linesOfTopic(s.topic), Math.floor(rand() * 1_000_000));
    options = choices.options;
    answer = choices.answer;
  }
  return {
    species,
    item,
    options,
    answer,
    timeLimitMs: roundTo(BASE_TIME_MS[item.kind] * tier.timeFactor, 500),
    maxPlays: tier.maxPlays,
    xu: tier.catchXu,
    seed,
  };
}

// ───────────────────────── a cast ─────────────────────────

/** Fish caught so far (every species, every machine as merged). */
export function fishCaughtTotal(progress: TownProgress): number {
  let n = 0;
  for (const id of Object.keys(progress.fish)) n += fishRecord(progress, id)?.caught ?? 0;
  return n;
}

/**
 * The weight of each tier for the next cast. A streak of catches in this session (at most STREAK_MAX counted) moves
 * weight from thường to the rarer tiers; quý bites only after QUY_AFTER catches, huyền thoại after HUYEN_THOAI_AFTER.
 */
export function tierWeights(progress: TownProgress, streak = 0): Record<Rarity, number> {
  const s = Number.isFinite(streak) ? Math.max(0, Math.min(STREAK_MAX, Math.floor(streak))) : 0;
  const caught = fishCaughtTotal(progress);
  const w: Record<Rarity, number> = {
    thuong: RARITY.thuong.fishWeight,
    hiem: RARITY.hiem.fishWeight + 2 * s,
    quy: caught >= QUY_AFTER ? RARITY.quy.fishWeight + 1.5 * s : 0,
    'huyen-thoai': caught >= HUYEN_THOAI_AFTER ? RARITY['huyen-thoai'].fishWeight + 0.5 * s : 0,
  };
  w.thuong = Math.max(10, RARITY.thuong.fishWeight - (w.hiem - RARITY.hiem.fishWeight) - Math.max(0, w.quy - RARITY.quy.fishWeight) - Math.max(0, w['huyen-thoai'] - RARITY['huyen-thoai'].fishWeight));
  return w;
}

function pickWeighted<T>(list: readonly { value: T; weight: number }[], rand: () => number): T {
  const total = list.reduce((sum, x) => sum + Math.max(0, x.weight), 0);
  let r = rand() * total;
  for (const x of list) {
    r -= Math.max(0, x.weight);
    if (r < 0) return x.value;
  }
  return list[list.length - 1].value;
}

export interface CastOptions {
  /** Catches in a row in this session (resets on an escape). */
  streak?: number;
}

/**
 * The next cast: a tier by tierWeights, a species of that tier (one not caught yet weighs twice), one of its items,
 * and that item's options. Deterministic for (progress's catches, seed, streak).
 */
export function rollCast(progress: TownProgress, seed: number, opts: CastOptions = {}): FishCast {
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) >>> 0 : 0;
  const rand = seededRandom(s ^ 0x5f3759df);
  const weights = tierWeights(progress, opts.streak ?? 0);
  const tier = pickWeighted(
    RARITIES.map((r) => ({ value: r, weight: weights[r] })),
    rand,
  );
  const species = pickWeighted(
    FISH_SPECIES.filter((f) => f.tier === tier && speciesPool(f).length > 0).map((f) => ({ value: f, weight: (fishRecord(progress, f.id)?.caught ?? 0) > 0 ? 1 : 2 })),
    rand,
  );
  const pool = speciesPool(species);
  return castOf(species, pool[Math.floor(rand() * pool.length)], rand, s);
}

/** A cast of one given species (the album's "câu thử", tests). null for an unknown species or an empty pool. */
export function castOfSpecies(speciesId: string, seed: number): FishCast | null {
  const species = FISH_SPECIES.find((f) => f.id === speciesId);
  if (!species) return null;
  const pool = speciesPool(species);
  if (pool.length === 0) return null;
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) >>> 0 : 0;
  const rand = seededRandom(s ^ 0x2545f491);
  return castOf(species, pool[Math.floor(rand() * pool.length)], rand, s);
}

// ───────────────────────── the answer ─────────────────────────

export interface CatchAnswer {
  correct: boolean;
  /** Plays of the item before the answer (the first included). 0 = never played: a guess, recorded nowhere. */
  plays: number;
  /** From the end of the first play to the answer. */
  ms: number;
}

export type CatchReason = 'caught' | 'wrong' | 'slow' | 'replays' | 'unplayed';

export interface CatchOutcome {
  caught: boolean;
  reason: CatchReason;
  /** Caught after exactly one play. */
  firstListen: boolean;
  /** Xu the catch is worth before the daily cap and the new-species bonus (0 when it got away). */
  xu: number;
  /** The answer time of a catch, ms (0 when it got away): the species' best time. */
  ms: number;
}

/**
 * How a cast ended: caught when the answer is right, within `timeLimitMs` and `maxPlays`. A catch on the first listen
 * is worth the tier's xu, with replays half of it (rounded up).
 */
export function catchOutcome(cast: Pick<FishCast, 'timeLimitMs' | 'maxPlays' | 'xu'>, answer: CatchAnswer): CatchOutcome {
  const plays = Number.isFinite(answer.plays) ? Math.floor(answer.plays) : 0;
  const away = (reason: CatchReason): CatchOutcome => ({ caught: false, reason, firstListen: false, xu: 0, ms: 0 });
  if (plays < 1) return away('unplayed');
  if (!answer.correct) return away('wrong');
  if (!(Number.isFinite(answer.ms) && answer.ms <= cast.timeLimitMs)) return away('slow');
  if (plays > cast.maxPlays) return away('replays');
  const firstListen = plays === 1;
  return { caught: true, reason: 'caught', firstListen, xu: firstListen ? cast.xu : Math.ceil(cast.xu / 2), ms: Math.max(1, Math.round(answer.ms)) };
}

export interface CatchEffect {
  progress: TownProgress;
  outcome: CatchOutcome;
  /** Xu paid (the catch, the new-species bonus), after the daily cap. */
  xu: number;
  /** The daily cap took some or all of what the catch was worth. */
  capped: boolean;
  /** This catch is the species' first. */
  newSpecies: boolean;
  /** The species' record now (undefined only for an unplayed cast). */
  record: FishRecord | undefined;
  tasksPaid: TaskPayout[];
}

/** Xu fishing may still pay today (over every browser). */
export function fishXuLeft(progress: TownProgress, now: number): number {
  return Math.max(0, FISH_DAILY_XU - dailySum(progress, townDay(now), 'fishXu'));
}

/**
 * Everything one finished cast changes: the species hooked (seen; caught with its time), the xu of a catch (and the
 * new-species bonus) up to what is left of FISH_DAILY_XU today, the day's fishing counters and any daily task
 * reached. An unplayed cast changes nothing. The input is not changed.
 */
export function applyCatch(progress: TownProgress, cast: Pick<FishCast, 'species'>, outcome: CatchOutcome, now: number, device: string): CatchEffect {
  if (outcome.reason === 'unplayed') return { progress, outcome, xu: 0, capped: false, newSpecies: false, record: fishRecord(progress, cast.species.id), tasksPaid: [] };
  const newSpecies = outcome.caught && (fishRecord(progress, cast.species.id)?.caught ?? 0) === 0;
  let next = noteFish(progress, cast.species.id, outcome.caught, outcome.ms, now);
  const worth = outcome.caught ? outcome.xu + (newSpecies ? NEW_SPECIES_XU : 0) : 0;
  const xu = Math.min(worth, fishXuLeft(progress, now));
  next = addEarned(next, device, xu);
  const noted = outcome.caught ? noteGame(next, { fish: 1, fishFirst: outcome.firstListen ? 1 : 0, fishXu: xu }, now, device) : { progress: next, tasksPaid: [] };
  return { progress: noted.progress, outcome, xu, capped: xu < worth, newSpecies, record: fishRecord(noted.progress, cast.species.id), tasksPaid: noted.tasksPaid };
}

// ───────────────────────── the album ─────────────────────────

export interface AlbumFish {
  species: FishSpecies;
  /** Caught at least once. */
  caught: boolean;
  /** Hooked at least once (caught or not): its name can be shown, an unseen one is a silhouette. */
  seen: boolean;
  record: FishRecord | null;
}

export interface FishAlbum {
  fish: AlbumFish[];
  /** Species caught / there are, and per tier. */
  caught: number;
  total: number;
  byTier: Record<Rarity, { caught: number; total: number }>;
  /** Fish caught in all. */
  catches: number;
}

/** The collection, in catalog order (thường first). */
export function fishAlbum(progress: TownProgress): FishAlbum {
  const byTier = Object.fromEntries(RARITIES.map((r) => [r, { caught: 0, total: 0 }])) as Record<Rarity, { caught: number; total: number }>;
  const fish = [...FISH_SPECIES]
    .sort((a, b) => rarityRank(a.tier) - rarityRank(b.tier))
    .map((species): AlbumFish => {
      const record = fishRecord(progress, species.id) ?? null;
      const caught = (record?.caught ?? 0) > 0;
      byTier[species.tier].total += 1;
      if (caught) byTier[species.tier].caught += 1;
      return { species, caught, seen: (record?.seen ?? 0) > 0, record };
    });
  return { fish, caught: fish.filter((f) => f.caught).length, total: fish.length, byTier, catches: fishCaughtTotal(progress) };
}
