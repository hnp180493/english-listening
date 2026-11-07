// Merge caption fragments into sentence-level practice units.
// Captions are cut by screen width, not by meaning; a learner practises better with
// one whole sentence (or one breath group) at a time.

import type { Cue } from './transcript';

export interface PracticeUnit {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface SentenceOptions {
  maxGap?: number; // seconds of silence that force a break (default 1.5)
  maxWords?: number; // break before a unit grows longer than this (default 25)
}

export const DEFAULT_MAX_GAP = 1.5;
export const DEFAULT_MAX_WORDS = 25;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Words ending with "." that do not end a sentence.
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'u.s',
  'u.k',
  'a.m',
  'p.m',
  'approx',
  'dept',
  'mt',
  'ft',
]);

// Of those, the ones that often END a sentence too ("…in the U.S. Then we…"): they end one
// when the next word starts with a capital letter.
const CAN_END = new Set(['etc', 'u.s', 'u.k', 'a.m', 'p.m']);

interface Piece {
  text: string;
  start: number;
  end: number;
  terminal: boolean; // ends with sentence punctuation
}

const countWords = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Character offsets (exclusive end) where a sentence ends inside `text`. */
export function sentenceBreaks(text: string): number[] {
  const out: number[] = [];
  const re = /[.?!]+["'”’)\]]*(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const endIdx = m.index + m[0].length;
    const punct = m[0];
    if (punct.startsWith('.') && !/[?!]/.test(punct)) {
      if (/^\.{2,}/.test(punct)) continue; // ellipsis "so..." — the thought goes on
      const before = text.slice(0, m.index);
      const orig = (/(\S+)$/.exec(before)?.[1] ?? '').replace(/^["'“‘(]+/, '');
      const word = orig.toLowerCase();
      const initialism = /^(?:\p{L}\.)+\p{L}$/u.test(word); // "U.S" in "U.S."
      if (ABBREVIATIONS.has(word) || initialism) {
        const capitalNext = /^\s+["'“‘(]*\p{Lu}/u.test(text.slice(endIdx));
        if (!(capitalNext && (CAN_END.has(word) || (initialism && word.length > 3)))) continue;
      } else if (/^\p{Lu}$/u.test(orig) && orig !== 'I') continue; // initials: "J. K. Rowling"
    }
    out.push(endIdx);
  }
  return out;
}

/** Split one cue at sentence ends; times are interpolated by character position. */
function splitCue(cue: Cue): Piece[] {
  const text = cue.text;
  const breaks = sentenceBreaks(text);
  const pieces: Piece[] = [];
  const dur = Math.max(0, cue.end - cue.start);
  const len = Math.max(1, text.length);
  let from = 0;
  const push = (to: number, terminal: boolean) => {
    const raw = text.slice(from, to);
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t) {
      pieces.push({
        text: t,
        start: cue.start + (dur * (from + lead)) / len,
        end: cue.start + (dur * to) / len,
        terminal,
      });
    }
    from = to;
  };
  for (const b of breaks) push(b, true);
  if (from < text.length) push(text.length, false);
  return pieces;
}

/** Split an over-long piece into chunks of at most maxWords words. */
function splitLong(p: Piece, maxWords: number): Piece[] {
  const words = p.text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [p];
  const n = Math.ceil(words.length / maxWords);
  const per = Math.ceil(words.length / n);
  const out: Piece[] = [];
  const total = p.text.length || 1;
  let consumed = 0;
  for (let i = 0; i < words.length; i += per) {
    const chunk = words.slice(i, i + per).join(' ');
    const startFrac = consumed / total;
    consumed += chunk.length + 1;
    const endFrac = Math.min(1, (consumed - 1) / total);
    const last = i + per >= words.length;
    out.push({
      text: chunk,
      start: p.start + (p.end - p.start) * startFrac,
      end: last ? p.end : p.start + (p.end - p.start) * endFrac,
      terminal: last ? p.terminal : false,
    });
  }
  return out;
}

/**
 * Merge consecutive cues into practice units. A unit ends at . ? ! (abbreviations and
 * ellipses excepted), at a silence longer than maxGap, or before it would exceed maxWords.
 * Units without letters or digits (music-only) are dropped.
 */
export function toSentences(cues: readonly Cue[], opts: SentenceOptions = {}): PracticeUnit[] {
  const maxGap = opts.maxGap ?? DEFAULT_MAX_GAP;
  const maxWords = Math.max(1, opts.maxWords ?? DEFAULT_MAX_WORDS);
  const units: PracticeUnit[] = [];
  let buf: { start: number; end: number; parts: string[]; words: number } | null = null;

  const flush = () => {
    if (buf) {
      const text = buf.parts.join(' ').replace(/\s+/g, ' ').trim();
      if (/[\p{L}\p{N}]/u.test(text)) {
        units.push({ start: round3(buf.start), end: round3(Math.max(buf.end, buf.start + 0.1)), text });
      }
    }
    buf = null;
  };

  const sorted = [...(cues ?? [])]
    .filter((c) => c && typeof c.text === 'string' && c.text.trim() && Number.isFinite(c.start) && Number.isFinite(c.end))
    .sort((a, b) => a.start - b.start);

  for (const cue of sorted) {
    if (buf && cue.start - buf.end > maxGap) flush();
    for (const whole of splitCue(cue)) {
      for (const p of splitLong(whole, maxWords)) {
        const w = countWords(p.text);
        if (buf && buf.words > 0 && buf.words + w > maxWords) flush();
        if (!buf) buf = { start: p.start, end: p.end, parts: [], words: 0 };
        buf.parts.push(p.text);
        buf.words += w;
        buf.end = Math.max(buf.end, p.end);
        if (p.terminal) flush();
      }
    }
  }
  flush();
  return units;
}

/** Total speech span covered by the units, in seconds. */
export function unitsDuration(units: readonly PracticeUnit[]): number {
  if (units.length === 0) return 0;
  return Math.max(0, units[units.length - 1].end - units[0].start);
}
