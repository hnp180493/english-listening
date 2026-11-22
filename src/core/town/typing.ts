// "Thị trấn": the typed check (docs/town.md §13). Now and then a line is not answered by picking a meaning: the
// learner TYPES the few words where the line's connected speech happens (1 to TYPING_MAX_WORDS words, the rest of the
// sentence shown around the gap, as Chép chính tả's "Điền từ"). Picking 1 of 3 can be guessed; typing what was heard
// cannot, so these checks are recorded on their own (./progress `typed`) as the town's one real measure.
//
// Judged with the dictation helpers (core/dictation: canonicalize, checkBlank, align): "want to" = "wanna", "I'd" =
// "I would", a one-letter slip in a long word is still right, a dropped -ed is not. A close miss gets one more try
// with a hint (the first letters, like "Gợi ý" in Chép chính tả). Pure.

import { decode } from '../decoder';
import { align } from '../dictation/align';
import { checkBlank, isBlankCorrect } from '../dictation/cloze';
import { makeHint } from '../dictation/hint';
import { heardOnce, totalListens, type ListenTally } from '../dictation/listens';
import { canonicalize, editDistance, splitWords } from '../dictation/normalize';
import type { Annotation, DecodeResult, Phenomenon } from '../types';
import type { LineOutcome, TownLine, TypedMark } from './types';

/** The most words a typed check asks for. */
export const TYPING_MAX_WORDS = 4;

export interface TypingTask {
  /** First and last decoder token of the gap (inclusive). */
  from: number;
  to: number;
  /** The words to type, as written, edge punctuation removed: "want to". */
  target: string;
  /** The sentence before the gap (as written) and punctuation stuck to the gap's front. */
  before: string;
  lead: string;
  /** Punctuation stuck to the gap's end, and the sentence after it. */
  trail: string;
  after: string;
  /** What happens to the sound in the gap (the decoder's annotations over it). */
  phenomena: Phenomenon[];
}

// The events that change a word's sound the most make the best gaps (as core/dictation/cloze).
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

const hasLetters = (raw: string): boolean => /[\p{L}\p{N}]/u.test(raw);

function edgePunct(raw: string): { lead: string; core: string; trail: string } {
  const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(raw);
  return m ? { lead: m[1], core: m[2], trail: m[3] } : { lead: '', core: raw, trail: '' };
}

function safeDecode(text: string): DecodeResult | null {
  try {
    const d = decode(text);
    return d && Array.isArray(d.tokens) && Array.isArray(d.annotations) ? d : null;
  } catch {
    return null;
  }
}

/**
 * The gap of a typed check for `text`: the words of ONE connected-speech event of the line (the decoder's
 * annotation), 1 to TYPING_MAX_WORDS words, chosen by how much it changes the sound (reduction first … linking last),
 * then the shorter, then the earlier. Never every word of the sentence (the rest stays as the context). null when the
 * decoder finds no such event: the line is answered by its meaning, as usual.
 */
export function typingTask(text: string, decoded?: DecodeResult | null): TypingTask | null {
  const d = decoded ?? safeDecode(text);
  const tokens = d?.tokens ?? [];
  if (tokens.length === 0) return null;
  const wordCount = tokens.filter((t) => hasLetters(t.raw)).length;
  const span = (a: Annotation): number => {
    let n = 0;
    for (let i = a.from; i <= a.to; i++) if (hasLetters(tokens[i]?.raw ?? '')) n += 1;
    return n;
  };
  const input = typeof d?.input === 'string' && d.input ? d.input : text;
  // the gap starts and ends at a written word's edge (a token inside "made-up" would cut the word in two)
  const wholeWords = (a: Annotation): boolean => {
    const s = tokens[a.from]?.start;
    const e = tokens[a.to]?.end;
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e > input.length) return true;
    return (s === 0 || /\s/.test(input[s - 1])) && (e >= input.length || /[\s.,!?;:…"'”’)\]]/.test(input[e]));
  };
  const usable = (d?.annotations ?? []).filter(
    (a) => Number.isInteger(a.from) && Number.isInteger(a.to) && a.from >= 0 && a.to >= a.from && a.to < tokens.length && span(a) >= 1 && span(a) <= TYPING_MAX_WORDS && span(a) < wordCount && wholeWords(a),
  );
  if (usable.length === 0) return null;
  const best = [...usable].sort((a, b) => (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9) || a.to - a.from - (b.to - b.from) || a.from - b.from)[0];
  // cut the written sentence at the tokens' own offsets ("made-up" is one word on screen, two tokens inside)
  const start = tokens[best.from].start;
  const end = tokens[best.to].end;
  const fromText = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= input.length;
  const raw = fromText
    ? input.slice(start, end)
    : tokens
        .slice(best.from, best.to + 1)
        .map((t) => t.raw)
        .join(' ');
  const { lead, core, trail } = edgePunct(raw);
  if (!core) return null;
  const covering = (d?.annotations ?? []).filter((a) => a.from <= best.to && a.to >= best.from);
  const join = (list: readonly { raw: string }[]): string => list.map((t) => t.raw).join(' ');
  return {
    from: best.from,
    to: best.to,
    target: core,
    before: fromText ? input.slice(0, start).trim() : join(tokens.slice(0, best.from)),
    lead,
    trail,
    after: fromText ? input.slice(end).trim() : join(tokens.slice(best.to + 1)),
    phenomena: [...new Set(covering.map((a) => a.type))],
  };
}

/** FNV-1a (32 bit). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Which one of `lines` is typed (its index), or -1 when none has a gap. A line never answered before comes first:
 * its words were never shown, so typing it is listening, not remembering (the measure stays honest). Among those the
 * seed picks (pass something that moves from one conversation to the next, e.g. the tries of its lines so far).
 * Deterministic for (key, lines, seed).
 */
export function typedIndex(key: string, lines: readonly { line: Pick<TownLine, 'text'>; met: boolean; eligible?: boolean }[], seed: number): number {
  const ok = lines.map((l, i) => ({ i, l })).filter(({ l }) => l.eligible !== false && typingTask(l.line.text) !== null);
  if (ok.length === 0) return -1;
  const fresh = ok.filter(({ l }) => !l.met);
  const from = fresh.length > 0 ? fresh : ok;
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 0;
  return from[(hash(key) + s) % from.length].i;
}

// ───────────────────────── judging ─────────────────────────

export type TypedVerdict = 'ok' | 'typo' | 'close' | 'wrong' | 'empty';

export interface TypedJudge {
  verdict: TypedVerdict;
  /** 'ok' or 'typo' (a one-letter slip in a long word). */
  correct: boolean;
  /** Words of the target typed right (canonical words: "wanna" counts as two). */
  matched: number;
  total: number;
  /** A word only missed its ending (-s, -d, -ed): what elision hides. */
  ending: boolean;
  /** The first letters of the target ("w___ t_"), for a close miss. */
  hint: string;
}

/** A dropped or added ending: "like" / "liked", "work" / "works". */
function endingPair(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!short || !long.startsWith(short)) return false;
  const tail = long.slice(short.length);
  return tail === 's' || tail === 'd' || tail === 'es' || tail === 'ed';
}

/**
 * The typed answer against the gap's words, as Chép chính tả judges a blank (checkBlank): 'ok', 'typo' (still right),
 * 'empty' (nothing typed), 'close' (not right, but half the words or more are, or the one word is off by a little:
 * worth one more try with a hint), 'wrong'.
 */
export function judgeTyped(target: string, answer: string): TypedJudge {
  const v = checkBlank(target, answer ?? '');
  const t = canonicalize(splitWords(target)).words;
  const total = t.length;
  const hint = makeHint(splitWords(target));
  if (v === 'empty') return { verdict: 'empty', correct: false, matched: 0, total, ending: false, hint };
  const al = align(target, answer ?? '');
  const matched = al.ops.filter((op) => op.kind === 'match').length;
  if (isBlankCorrect(v)) return { verdict: v === 'typo' ? 'typo' : 'ok', correct: true, matched: total, total, ending: false, hint };
  const subs = al.ops.filter((op) => op.kind === 'sub' && op.targetWord && op.answerWord);
  const ending = subs.some((op) => op.targetWord!.split('|').some((x) => op.answerWord!.split('|').some((y) => endingPair(x, y))));
  const nearWord = subs.some((op) => op.targetWord!.split('|').some((x) => x.length >= 3 && op.answerWord!.split('|').some((y) => editDistance(x, y) <= 2)));
  const close = ending || (total > 0 && matched / total >= 0.5 && al.extra <= 1) || (total <= 2 && nearWord);
  return { verdict: close ? 'close' : 'wrong', correct: false, matched, total, ending, hint };
}

/**
 * How a typed check counts as a line's answer (the line's record, xu, daily counters: ./economy applyAnswer).
 * Right at the first check: 'first' after exactly one play at the normal speed, else 'replayed'. Right after the
 * hint: 'replayed'. Not right: 'wrong'. null when nothing was played (nothing to type: recorded nowhere).
 */
export function typedOutcome(mark: TypedMark, listens: ListenTally | null | undefined): LineOutcome | null {
  if (totalListens(listens) <= 0) return null;
  if (mark === 'miss') return 'wrong';
  if (mark === 'helped') return 'replayed';
  return heardOnce(listens) ? 'first' : 'replayed';
}
