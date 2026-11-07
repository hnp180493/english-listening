// Map dictation errors onto the decoder's connected-speech annotations so the
// learner sees WHY they misheard (linking, elision, flap T …) rather than just "wrong".

import type { Annotation, DecodeResult, Phenomenon } from '../types';
import type { AlignOp } from './align';
import { displayCanon } from './normalize';

export interface DictationError {
  targetIndex: number; // original target token index
  targetWord: string; // the written target word
  answerWord?: string; // what the learner typed instead (sub only)
  kind: 'sub' | 'del';
  category: 'phenomenon' | 'other'; // 'other' = vocabulary / spelling
  phenomena: Phenomenon[]; // deduped, from covering annotations
  annotationIds: string[];
}

export interface ClassifyResult {
  errors: DictationError[];
  missedPhenomena: Phenomenon[]; // deduped, order of first appearance
  seenPhenomena: Phenomenon[]; // every annotation type in the sentence, deduped
  missedAnnotationIds: string[]; // deduped, in sentence order
}

function covering(annotations: readonly Annotation[], i: number): Annotation[] {
  return annotations.filter((a) => a.from <= i && i <= a.to);
}

/** "it," → "it", keeps inner apostrophes ("don't"). */
function stripEdgePunct(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function answerText(e: { subs: string[]; answerIdx: number[] }, answerRaw?: readonly string[]): string {
  if (answerRaw && e.answerIdx.length) {
    const raw = e.answerIdx.map((k) => stripEdgePunct(answerRaw[k] ?? '')).filter(Boolean);
    if (raw.length) return raw.join(' ');
  }
  return e.subs.filter(Boolean).join(' ');
}

function uniq<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)];
}

/**
 * Group sub/del ops by original target token (one error per written word) and
 * attach the annotations that cover that token.
 *
 * A token counts as 'sub' (typed something else) when the learner typed ANY part of it
 * ("I" for "I'd"), and as 'del' only when nothing of it was typed.
 */
export function classify(
  result: DecodeResult | null | undefined,
  ops: readonly AlignOp[],
  answerRaw?: readonly string[], // learner's tokens as typed; used to show answerWord as written
  targetRaw?: readonly string[], // target tokens as written; fallback when the decode result has no tokens
): ClassifyResult {
  const annotations = result?.annotations ?? [];
  const tokens = result?.tokens ?? [];

  type Entry = { subs: string[]; answerIdx: number[]; bad: boolean; canon: string[] };
  const byToken = new Map<number, Entry>();
  for (const op of ops) {
    if (op.targetIndex === undefined || op.kind === 'ins') continue;
    let e = byToken.get(op.targetIndex);
    if (!e) {
      e = { subs: [], answerIdx: [], bad: false, canon: [] };
      byToken.set(op.targetIndex, e);
    }
    if (op.targetWord) e.canon.push(displayCanon(op.targetWord));
    if (op.kind === 'sub' || op.kind === 'del') e.bad = true;
    if (op.kind === 'sub' || op.kind === 'match') {
      e.subs.push(op.answerWord ? displayCanon(op.answerWord) : '');
      if (op.answerIndex !== undefined && !e.answerIdx.includes(op.answerIndex)) e.answerIdx.push(op.answerIndex);
    }
  }

  const errors: DictationError[] = [];
  for (const [idx, e] of [...byToken.entries()].sort((a, b) => a[0] - b[0])) {
    if (!e.bad) continue;
    const anns = covering(annotations, idx);
    const tok = tokens[idx];
    const typed = e.subs.length > 0;
    errors.push({
      targetIndex: idx,
      targetWord: stripEdgePunct(tok?.raw ?? targetRaw?.[idx] ?? '') || tok?.word || e.canon.join(' '),
      ...(typed ? { answerWord: answerText(e, answerRaw) } : {}),
      kind: typed ? 'sub' : 'del',
      category: anns.length ? 'phenomenon' : 'other',
      phenomena: uniq(anns.map((a) => a.type)),
      annotationIds: anns.map((a) => a.id),
    });
  }

  const missedAnnotationIds: string[] = [];
  const order = [...annotations].sort((a, b) => a.from - b.from || a.to - b.to);
  const hit = new Set(errors.flatMap((e) => e.annotationIds));
  for (const a of order) if (hit.has(a.id)) missedAnnotationIds.push(a.id);

  return {
    errors,
    missedPhenomena: uniq(errors.flatMap((e) => e.phenomena)),
    seenPhenomena: uniq(annotations.map((a) => a.type)),
    missedAnnotationIds,
  };
}
