// Compare what the speech recognizer heard with the target sentence.

import { align, extraAnswerTokens } from '../../core/dictation/align';
import { classify, type ClassifyResult } from '../../core/dictation/classify';
import { splitWords } from '../../core/dictation/normalize';
import type { Annotation, DecodeResult, Phenomenon } from '../../core/types';

export type WordStatus = 'ok' | 'miss' | 'plain';

export interface WordMark {
  index: number; // token index in the decode result
  raw: string; // as written
  status: WordStatus; // plain = punctuation-only token, not scored
  heard?: string; // what the recognizer heard instead (substitution)
  phenomena: Phenomenon[]; // connected-speech spots covering this word (only for misses)
}

export interface ShadowFeedback {
  heard: string; // the transcript as recognised
  score: number; // 0..1
  percent: number;
  matched: number;
  total: number;
  words: WordMark[];
  extra: string[]; // words heard that are not in the sentence
  classified: ClassifyResult;
  missedAnnotations: Annotation[]; // connected-speech spots where words were missed, in sentence order
  otherMisses: string[]; // missed words that sit outside any connected-speech spot
}

const HAS_WORD = /[\p{L}\p{N}]/u;

/** Score a recognised transcript against the decoded target sentence. */
export function evaluateShadow(result: DecodeResult, transcript: string): ShadowFeedback {
  const targetRaw = result.tokens.map((t) => t.raw);
  const answerRaw = splitWords(transcript);
  const al = align(targetRaw, answerRaw);
  const classified = classify(result, al.ops, answerRaw, targetRaw);

  const errByIndex = new Map(classified.errors.map((e) => [e.targetIndex, e]));
  const words: WordMark[] = result.tokens.map((t) => {
    const e = errByIndex.get(t.index);
    if (e) {
      return {
        index: t.index,
        raw: t.raw,
        status: 'miss',
        ...(e.kind === 'sub' && e.answerWord ? { heard: e.answerWord } : {}),
        phenomena: e.phenomena,
      };
    }
    return { index: t.index, raw: t.raw, status: HAS_WORD.test(t.raw) ? 'ok' : 'plain', phenomena: [] };
  });

  const extraIdx = [...extraAnswerTokens(al.ops)].sort((a, b) => a - b);
  const extra = extraIdx.map((i) => answerRaw[i]).filter((w): w is string => !!w);

  const byId = new Map(result.annotations.map((a) => [a.id, a]));
  const missedAnnotations = classified.missedAnnotationIds
    .map((id) => byId.get(id))
    .filter((a): a is Annotation => !!a);
  const otherMisses = classified.errors.filter((e) => e.category === 'other').map((e) => e.targetWord);

  const score = transcript.trim() ? al.score : 0;
  return {
    heard: transcript.trim(),
    score,
    percent: Math.round(score * 100),
    matched: al.matched,
    total: al.total,
    words,
    extra,
    classified,
    missedAnnotations,
    otherMisses,
  };
}

export type Tone = 'ok' | 'warn' | 'bad';

/** Headline for a score. */
export function scoreVerdict(percent: number): { tone: Tone; title: string; detail: string } {
  if (percent >= 90)
    return { tone: 'ok', title: 'Rất tốt!', detail: 'Máy nhận ra gần như trọn câu. Thử nói ở tốc độ 1.0× và nối âm mượt hơn nữa.' };
  if (percent >= 70)
    return { tone: 'ok', title: 'Khá tốt', detail: 'Phần lớn câu đã rõ. Nghe lại những chỗ màu đỏ rồi nói lại một lần nữa.' };
  if (percent >= 40)
    return { tone: 'warn', title: 'Tạm được', detail: 'Một số cụm chưa rõ. Dùng chế độ “Từng cụm” để luyện từng đoạn ngắn trước.' };
  return {
    tone: 'bad',
    title: 'Chưa nghe rõ',
    detail: 'Máy chưa hiểu được nhiều. Nghe mẫu ở tốc độ chậm, nói chậm và rõ từng cụm, rồi tăng dần tốc độ.',
  };
}

/** Phenomena for stats: the ones present in the sentence, falling back to author-labelled focus. */
export function seenPhenomena(result: DecodeResult, focus: readonly Phenomenon[] = []): Phenomenon[] {
  const s = new Set<Phenomenon>(result.annotations.map((a) => a.type));
  if (s.size === 0) for (const p of focus) s.add(p);
  return [...s];
}
