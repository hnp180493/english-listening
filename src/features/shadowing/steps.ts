// "Từng cụm" step mode: split a sentence into short phrases built from whole spoken
// segments, so a linked group ("turn it off") is never cut in half.

import type { DecodeResult, SpokenSegment } from '../../core/types';

export interface Step {
  from: number; // first token index
  to: number; // last token index
  text: string; // written words, fed to TTS
  spoken: string; // respelling, shown to the learner
  words: number;
}

const BREAK_AFTER = /[,.;:!?…—–]["'”’)]*$/;

function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function segmentsOf(result: DecodeResult): SpokenSegment[] {
  if (result.segments.length > 0) return result.segments;
  return result.tokens.map((t) => ({ from: t.index, to: t.index, written: t.raw, spoken: t.raw, annotationIds: [] }));
}

/**
 * Group segments into phrases of at most `maxWords` words (a single longer segment stays whole),
 * breaking after punctuation. Returns [] for an empty sentence.
 */
export function buildSteps(result: DecodeResult, maxWords = 4): Step[] {
  const steps: Step[] = [];
  let cur: SpokenSegment[] = [];
  let curWords = 0;
  const flush = () => {
    if (cur.length === 0) return;
    const text = cur.map((s) => s.written).join(' ').trim();
    const words = wordCount(text);
    if (words > 0) {
      steps.push({
        from: cur[0].from,
        to: cur[cur.length - 1].to,
        text,
        spoken: cur.map((s) => s.spoken).join(' ').trim(),
        words,
      });
    } else if (steps.length > 0) {
      // punctuation-only leftovers: attach to the previous step
      const prev = steps[steps.length - 1];
      prev.to = cur[cur.length - 1].to;
      prev.text = `${prev.text} ${text}`.trim();
    }
    cur = [];
    curWords = 0;
  };
  for (const seg of segmentsOf(result)) {
    const w = wordCount(seg.written);
    if (cur.length > 0 && w > 0 && curWords + w > maxWords) flush();
    cur.push(seg);
    curWords += w;
    const lastTok = result.tokens[seg.to];
    const tail = lastTok ? lastTok.raw : seg.written;
    if (BREAK_AFTER.test(tail)) flush();
  }
  flush();
  return steps;
}

/** How long to wait for the learner to repeat a phrase: about twice the model's speaking time. */
export function repeatPauseMs(words: number, rate = 1): number {
  const r = rate > 0 ? rate : 1;
  const ms = 1300 + (Math.max(1, words) * 520) / r;
  return Math.round(Math.max(1800, Math.min(8000, ms)));
}
