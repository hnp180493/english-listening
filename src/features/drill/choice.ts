// "Nghe trong câu → chọn" cards: play the example sentence, pick which chunk was in it.
// Pure module: deterministic (seeded) so a card looks the same on every render.

import type { CardState } from '../../core/srs';
import type { Chunk } from '../../core/types';
import { compact, normalize, splitHighlight, variants } from './match';

export type CardKind = 'type' | 'choose';

/** Number of options shown (the answer + distractors). */
export const CHOICE_COUNT = 4;
/** A review card switches between the two kinds from this many successful reviews on. */
export const CHOOSE_MIN_REPS = 2;

/** FNV-1a 32-bit hash: stable small integer for a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG → numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The chunk can be heard inside its example sentence (so "choose" makes sense). */
export function canChoose(chunk: Chunk): boolean {
  return !!chunk.example.trim() && splitHighlight(chunk.example, [chunk.written, chunk.spoken, chunk.ttsText]) !== null;
}

/**
 * Which kind of card to show. New and young cards are always "nghe → gõ"; from
 * CHOOSE_MIN_REPS successful reviews on, the kind alternates with every review
 * (offset per card so not all cards switch together).
 */
export function cardKind(chunk: Chunk, state: CardState | undefined): CardKind {
  if (!state || state.reps < CHOOSE_MIN_REPS) return 'type';
  if ((state.reps + hashString(chunk.id)) % 2 !== 0) return 'type';
  return canChoose(chunk) ? 'choose' : 'type';
}

const lettersOnly = (v: string) => v.replace(/[^a-z0-9]/g, '');

/** Every accepted spelling of a chunk, letters only ("wan-chu" → "wanchu", "gonna" → "goingto"). */
const formsCache = new WeakMap<Chunk, Set<string>>();
function forms(c: Chunk): Set<string> {
  const hit = formsCache.get(c);
  if (hit) return hit;
  const out = new Set<string>();
  for (const src of [c.written, c.spoken, c.ttsText]) for (const v of variants(src)) out.add(lettersOnly(v));
  out.delete('');
  formsCache.set(c, out);
  return out;
}

/**
 * Real-word spellings of a chunk (written form and TTS text, contractions and reductions
 * expanded), padded with spaces so `includes(' x y ')` is a whole-word sequence test.
 * The spoken respelling is left out on purpose: its hyphenated syllables are not words.
 */
const wordFormsCache = new WeakMap<Chunk, string[]>();
function wordForms(c: Chunk): string[] {
  const hit = wordFormsCache.get(c);
  if (hit) return hit;
  const out = new Set<string>();
  for (const src of [c.written, c.ttsText]) {
    for (const v of variants(src)) {
      const w = v.replace(/'/g, '').replace(/\s+/g, ' ').trim();
      if (w) out.add(` ${w} `);
    }
  }
  const list = [...out];
  wordFormsCache.set(c, list);
  return list;
}

/** Every spelling of the sentence (contractions and reductions expanded), padded with spaces. */
function sentenceForms(text: string): string[] {
  return [...variants(text)].map((v) => ` ${v.replace(/'/g, '').replace(/\s+/g, ' ').trim()} `);
}

function overlaps(a: readonly string[], b: readonly string[]): boolean {
  for (const x of a) for (const y of b) if (x.includes(y) || y.includes(x)) return true;
  return false;
}

interface TargetContext {
  target: Chunk;
  forms: Set<string>;
  words: string[];
  sentence: string[];
  exampleLetters: string;
}

/**
 * Would `d` be a bad distractor for `target`? True when it is the answer under another
 * spelling ("gonna" / "going to"), when one contains the other word for word ("have to" /
 * "don't have to"), or when it can also be heard in the target's example sentence
 * (also through a contraction: "I didn't" contains "I did").
 */
function isAmbiguous(d: Chunk, ctx: TargetContext): boolean {
  if (d.id === ctx.target.id) return true;
  const df = forms(d);
  for (const f of df) if (ctx.forms.has(f)) return true;
  const dw = wordForms(d);
  if (overlaps(dw, ctx.words)) return true;
  for (const w of dw) for (const s of ctx.sentence) if (s.includes(w)) return true;
  // The respelling written literally in the sentence (rare): exact search, cheap pre-check first.
  let maybeInside = false;
  for (const f of df) if (ctx.exampleLetters.includes(f)) maybeInside = true;
  return maybeInside && splitHighlight(ctx.target.example, [d.written, d.spoken, d.ttsText]) !== null;
}

/**
 * Four options (target included, order shuffled) for a "choose" card, or null when fewer
 * than three safe distractors exist. Distractors sharing more phenomena with the target are
 * preferred (unrelated chunks fill in when a phenomenon has few chunks); none of them may
 * also be audible in the target's example sentence, and no two options are the same phrase
 * under different spellings.
 */
export function buildChoices(target: Chunk, pool: readonly Chunk[], seed: number): Chunk[] | null {
  const rand = seededRandom(seed);
  const seenWritten = new Set<string>([normalize(target.written)]);
  const ctx: TargetContext = {
    target,
    forms: forms(target),
    words: wordForms(target),
    sentence: sentenceForms(target.example),
    exampleLetters: compact(target.example),
  };
  const candidates: { c: Chunk; shared: number; key: number }[] = [];
  for (const c of pool) {
    const w = normalize(c.written);
    if (!w || seenWritten.has(w) || isAmbiguous(c, ctx)) continue;
    seenWritten.add(w);
    const shared = c.phenomena.filter((p) => target.phenomena.includes(p)).length;
    candidates.push({ c, shared, key: rand() });
  }
  const need = CHOICE_COUNT - 1;
  if (candidates.length < need) return null;
  // Related first; among equally related ones, a seeded random pick from the closest ranks.
  candidates.sort(
    (a, b) =>
      Math.min(b.shared, 2) - Math.min(a.shared, 2) ||
      a.key * (1 + Math.abs(a.c.rank - target.rank) / 50) - b.key * (1 + Math.abs(b.c.rank - target.rank) / 50),
  );
  // Greedy pick: skip a candidate that is the same phrase as one already picked ("gonna" / "going to").
  const picked: Chunk[] = [];
  for (const { c } of candidates) {
    if (picked.length === need) break;
    const cf = forms(c);
    if (picked.some((p) => [...forms(p)].some((f) => cf.has(f)))) continue;
    picked.push(c);
  }
  if (picked.length < need) return null;
  const options = [target, ...picked];
  // Fisher–Yates with the same seeded generator.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/** Seed for a card's options: changes with every review so the options vary over time. */
export function choiceSeed(chunk: Chunk, state: CardState | undefined): number {
  return (hashString(chunk.id) ^ Math.imul((state?.reps ?? 0) + 1, 0x9e3779b1)) >>> 0;
}
