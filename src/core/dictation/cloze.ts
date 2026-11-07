// "Điền từ" (cloze) mode: the sentence is shown with only the words where a
// connected-speech event happens turned into blanks. Pure functions.

import type { Annotation, DecodeResult, Phenomenon } from '../types';
import { canonicalize, isTypo, splitWords, wordsEqual } from './normalize';

export type ClozeUnit =
  | { kind: 'text'; index: number; raw: string }
  | {
      kind: 'blank';
      id: number; // 0-based blank number
      from: number; // first token index (inclusive)
      to: number; // last token index (inclusive)
      target: string; // the hidden words, edge punctuation removed: "Turn it"
      lead: string; // punctuation shown before the input (opening quote …)
      trail: string; // punctuation shown after the input ("," "?" …)
      annotationIds: string[]; // annotations overlapping the blank
      phenomena: Phenomenon[]; // their types, deduped
      fallback: boolean; // true when the blank is a plain function word (sentence without annotations)
    };

export type ClozeBlank = Extract<ClozeUnit, { kind: 'blank' }>;

export interface ClozeOptions {
  focus?: Phenomenon | null; // annotations of this type are chosen first
  ratio?: number; // max share of words hidden (default 0.5)
  maxWords?: number; // absolute cap of hidden words (default 6)
}

// Events that change how a word sounds the most come first: they make the best blanks.
const PRIORITY: Record<Phenomenon, number> = {
  reduction: 0,
  contraction: 1,
  'flap-t': 2,
  assimilation: 3,
  'h-dropping': 4,
  elision: 5,
  'weak-form': 6,
  linking: 7,
};

const hasLetters = (raw: string) => /[\p{L}\p{N}]/u.test(raw);

/** Max number of words to hide in a sentence of `words` words. */
export function blankBudget(words: number, ratio = 0.5, maxWords = 6): number {
  if (!(words > 0)) return 0;
  return Math.max(1, Math.min(maxWords, Math.max(2, Math.round(words * ratio)), words));
}

/**
 * Token indices to hide: whole annotations, chosen by priority (focus first, then
 * reduction > contraction > flap T > … > linking, shorter spans first, earlier first)
 * while the budget allows. Only tokens covered by an annotation are ever hidden.
 */
export function selectClozeTokens(result: DecodeResult | null | undefined, opts: ClozeOptions = {}): number[] {
  const tokens = result?.tokens ?? [];
  const anns = (result?.annotations ?? []).filter(
    (a) => a && Number.isInteger(a.from) && Number.isInteger(a.to) && a.from >= 0 && a.to >= a.from && a.to < tokens.length,
  );
  const wordIdx = tokens.filter((t) => hasLetters(t.raw)).map((t) => t.index);
  if (!anns.length || !wordIdx.length) return [];
  const budget = blankBudget(wordIdx.length, opts.ratio ?? 0.5, opts.maxWords ?? 6);

  const wordsOf = (a: Annotation) => {
    const out: number[] = [];
    for (let i = a.from; i <= a.to; i++) if (hasLetters(tokens[i]?.raw ?? '')) out.push(i);
    return out;
  };
  const rank = (a: Annotation) => (opts.focus && a.type === opts.focus ? -1 : (PRIORITY[a.type] ?? 9));
  const order = [...anns].sort(
    (a, b) => rank(a) - rank(b) || a.to - a.from - (b.to - b.from) || a.from - b.from,
  );

  const chosen = new Set<number>();
  for (const a of order) {
    const add = wordsOf(a).filter((i) => !chosen.has(i));
    if (!add.length) continue;
    if (chosen.size + add.length > budget) continue;
    for (const i of add) chosen.add(i);
  }
  if (chosen.size === 0) {
    // every annotation is wider than the budget (very short sentence): hide the first-ranked one anyway
    for (const i of wordsOf(order[0])) chosen.add(i);
  }
  return [...chosen].sort((a, b) => a - b);
}

// Words that are usually reduced in fast speech (weak forms first): the fallback blanks
// for a sentence in which the decoder finds no connected-speech event.
const FUNCTION_WORDS: readonly string[] = [
  'to', 'of', 'and', 'for', 'can', 'have', 'has', 'had', 'him', 'her', 'them', 'at', 'from', 'you', 'your',
  'a', 'an', 'the', 'but', 'or', 'as', 'than', 'that', 'some', 'was', 'were', 'are', 'am', 'is', 'be', 'been',
  'do', 'does', 'did', 'could', 'would', 'should', 'will', 'just', 'there', 'us', 'our', 'his', 'we', 'he', 'she',
  'they', 'it', 'in', 'on', 'with', 'not',
];
const FUNCTION_RANK = new Map(FUNCTION_WORDS.map((w, i) => [w, i]));
const FALLBACK_MAX = 3;

const plainWord = (raw: string) =>
  raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, '')
    .replace(/^'+|'+$/g, '');

/**
 * Blanks for a sentence without annotations: up to 3 function words (weak forms first,
 * then sentence order); when there are none, the longest word. Never every word of a
 * sentence longer than one word.
 */
export function fallbackClozeTokens(result: DecodeResult | null | undefined, opts: ClozeOptions = {}): number[] {
  const tokens = result?.tokens ?? [];
  const words = tokens.filter((t) => t && typeof t.raw === 'string' && hasLetters(t.raw));
  if (!words.length) return [];
  const budget = Math.min(FALLBACK_MAX, blankBudget(words.length, opts.ratio ?? 0.5, opts.maxWords ?? 6));
  const cap = words.length > 1 ? Math.min(budget, words.length - 1) : 1;
  const candidates = words
    .map((t) => ({ index: t.index, rank: FUNCTION_RANK.get(plainWord(t.raw)) }))
    .filter((c): c is { index: number; rank: number } => c.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, cap)
    .map((c) => c.index);
  if (candidates.length) return candidates.sort((a, b) => a - b);
  if (words.length === 1) return [words[0].index];
  let best = words[0];
  for (const t of words) if (plainWord(t.raw).length > plainWord(best.raw).length) best = t;
  return [best.index];
}

/** Tokens to hide: annotated words, or the function-word fallback when there are none. */
export function clozeTokens(result: DecodeResult | null | undefined, opts: ClozeOptions = {}): number[] {
  const sel = selectClozeTokens(result, opts);
  return sel.length ? sel : fallbackClozeTokens(result, opts);
}

function edgePunct(raw: string): { lead: string; core: string; trail: string } {
  const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(raw);
  return m ? { lead: m[1], core: m[2], trail: m[3] } : { lead: '', core: raw, trail: '' };
}

/**
 * Split the sentence into visible words and blanks (adjacent hidden words form one blank).
 * Sentences without annotations get function-word blanks (`fallback: true`).
 */
export function buildCloze(result: DecodeResult | null | undefined, opts: ClozeOptions = {}): ClozeUnit[] {
  const tokens = result?.tokens ?? [];
  const annotations = result?.annotations ?? [];
  const hidden = new Set(clozeTokens(result, opts));
  const units: ClozeUnit[] = [];
  let blankId = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (!hidden.has(i)) {
      units.push({ kind: 'text', index: i, raw: tokens[i].raw });
      continue;
    }
    let j = i;
    while (hidden.has(j + 1)) j++;
    const { lead, core, trail } = edgePunct(
      tokens
        .slice(i, j + 1)
        .map((t) => t.raw)
        .join(' '),
    );
    const overlapping = annotations.filter((a) => a.from <= j && a.to >= i);
    units.push({
      kind: 'blank',
      id: blankId++,
      from: i,
      to: j,
      target: core,
      lead,
      trail,
      annotationIds: overlapping.map((a) => a.id),
      phenomena: [...new Set(overlapping.map((a) => a.type))],
      fallback: overlapping.length === 0,
    });
    i = j;
  }
  return units;
}

export function clozeBlanks(units: readonly ClozeUnit[]): ClozeBlank[] {
  return units.filter((u): u is ClozeBlank => u.kind === 'blank');
}

export type BlankVerdict = 'ok' | 'typo' | 'wrong' | 'empty';

/**
 * Compare one blank. Equivalent spellings count ("I'm" = "I am", "gonna" = "going to",
 * "2" = "two"); a one-letter slip in a long word is a 'typo' (still correct).
 */
export function checkBlank(target: string, answer: string): BlankVerdict {
  const a = canonicalize(splitWords(answer ?? '')).words;
  if (a.length === 0) return 'empty';
  const t = canonicalize(splitWords(target ?? '')).words;
  if (t.length !== a.length) return 'wrong';
  let typo = false;
  for (let k = 0; k < t.length; k++) {
    if (wordsEqual(t[k], a[k])) continue;
    if (isTypo(t[k], a[k])) {
      typo = true;
      continue;
    }
    return 'wrong';
  }
  return typo ? 'typo' : 'ok';
}

export const isBlankCorrect = (v: BlankVerdict) => v === 'ok' || v === 'typo';

export interface ClozeOutcome {
  verdicts: BlankVerdict[]; // per blank, in order
  correct: number;
  total: number;
  score: number; // correct / total, 0..1
  seen: Phenomenon[]; // every phenomenon in the sentence
  missed: Phenomenon[]; // phenomena of the blanks answered wrong / left empty
  missedAnnotationIds: string[];
}

export function gradeCloze(
  units: readonly ClozeUnit[],
  answers: readonly string[],
  annotations: readonly Annotation[] = [],
): ClozeOutcome {
  const blanks = clozeBlanks(units);
  const verdicts = blanks.map((b, k) => checkBlank(b.target, answers[k] ?? ''));
  const correct = verdicts.filter(isBlankCorrect).length;
  const wrong = blanks.filter((_, k) => !isBlankCorrect(verdicts[k]));
  const missedIds = new Set(wrong.flatMap((b) => b.annotationIds));
  return {
    verdicts,
    correct,
    total: blanks.length,
    score: blanks.length ? correct / blanks.length : 1,
    seen: [...new Set(annotations.map((a) => a.type))],
    missed: [...new Set(wrong.flatMap((b) => b.phenomena))],
    missedAnnotationIds: [...annotations].sort((a, b) => a.from - b.from).filter((a) => missedIds.has(a.id)).map((a) => a.id),
  };
}
