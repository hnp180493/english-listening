// Word-level alignment between the target sentence and the learner's answer.
// Both sides are canonicalised first (see normalize.ts) so contractions,
// reductions and number forms compare equal.

import { canonicalize, isTypo, splitWords, wordsEqual, type Canon } from './normalize';

export type AlignKind = 'match' | 'sub' | 'del' | 'ins';

export interface AlignOp {
  kind: AlignKind; // 'del' = missing in answer, 'ins' = extra in answer
  targetIndex?: number; // ORIGINAL target token index (match/sub/del)
  canonIndex?: number; // index into target canonical tokens (match/sub/del)
  answerIndex?: number; // ORIGINAL answer token index (match/sub/ins)
  targetWord?: string; // canonical target token
  answerWord?: string; // canonical answer token
  typo?: boolean; // match only: near-miss spelling accepted as correct
}

export interface AlignResult {
  ops: AlignOp[];
  score: number; // matched / (total + extra), 0..1 — extra words typed lower the score
  matched: number; // original target tokens fully matched
  total: number; // original target tokens that contain at least one word
  extra: number; // answer tokens that are (partly) extra and not already shown as a wrong word
  typos: number; // number of typo-matches
  target: Canon;
  answer: Canon;
}

// Integer costs (x2) so a typo match (1) is preferred over a substitution (2)
// but an exact match (0) is preferred over a typo.
const COST_TYPO = 1;
const COST_SUB = 2;
const COST_GAP = 2;

function toTokens(x: string | readonly string[]): readonly string[] {
  return typeof x === 'string' ? splitWords(x) : x;
}

/**
 * Align target vs answer. Accepts whole strings or arrays of raw tokens
 * (use the decoder's token raws for the target so indices line up with annotations).
 */
export function align(target: string | readonly string[], answer: string | readonly string[]): AlignResult {
  const tc = canonicalize(toTokens(target));
  const ac = canonicalize(toTokens(answer));
  const T = tc.words;
  const A = ac.words;
  const m = T.length;
  const n = A.length;

  const pairCost = (i: number, j: number): number => {
    if (wordsEqual(T[i], A[j])) return 0;
    if (isTypo(T[i], A[j])) return COST_TYPO;
    return COST_SUB;
  };
  const cost: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(-1));
  const getCost = (i: number, j: number): number => {
    let c = cost[i][j];
    if (c < 0) {
      c = pairCost(i, j);
      cost[i][j] = c;
    }
    return c;
  };

  const D: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) D[i][0] = i * COST_GAP;
  for (let j = 1; j <= n; j++) D[0][j] = j * COST_GAP;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      D[i][j] = Math.min(D[i - 1][j - 1] + getCost(i - 1, j - 1), D[i - 1][j] + COST_GAP, D[i][j - 1] + COST_GAP);
    }
  }

  // Backtrace: prefer diagonal, then deletion, then insertion.
  const ops: AlignOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + getCost(i - 1, j - 1)) {
      const c = getCost(i - 1, j - 1);
      ops.push({
        kind: c === COST_SUB ? 'sub' : 'match',
        targetIndex: tc.origin[i - 1],
        canonIndex: i - 1,
        answerIndex: ac.origin[j - 1],
        targetWord: T[i - 1],
        answerWord: A[j - 1],
        ...(c === COST_TYPO ? { typo: true } : {}),
      });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || D[i][j] === D[i - 1][j] + COST_GAP)) {
      ops.push({ kind: 'del', targetIndex: tc.origin[i - 1], canonIndex: i - 1, targetWord: T[i - 1] });
      i--;
    } else {
      ops.push({ kind: 'ins', answerIndex: ac.origin[j - 1], answerWord: A[j - 1] });
      j--;
    }
  }
  ops.reverse();

  // Score per ORIGINAL target token: matched only if every canonical piece matched.
  const ok = new Map<number, boolean>();
  for (const op of ops) {
    if (op.targetIndex === undefined) continue;
    const prev = ok.get(op.targetIndex) ?? true;
    ok.set(op.targetIndex, prev && op.kind === 'match');
  }
  const total = ok.size;
  let matched = 0;
  ok.forEach((v) => {
    if (v) matched++;
  });
  const typos = ops.filter((o) => o.typo).length;
  const extra = extraAnswerTokens(ops).size;
  const score = total === 0 ? (n === 0 ? 1 : 0) : matched / (total + extra);

  return { ops, score, matched, total, extra, typos, target: tc, answer: ac };
}

/**
 * Original answer-token indices that carry an inserted (extra) canonical word.
 * A token whose other pieces were already shown as a wrong/typo word for some
 * target token is not counted again ("go" vs "gonna" is ONE error, not two).
 */
export function extraAnswerTokens(ops: readonly AlignOp[]): Set<number> {
  const shown = new Set<number>();
  for (const op of ops) {
    if (op.answerIndex !== undefined && (op.kind === 'sub' || op.typo)) shown.add(op.answerIndex);
  }
  const out = new Set<number>();
  for (const op of ops) {
    if (op.kind === 'ins' && op.answerIndex !== undefined && !shown.has(op.answerIndex)) out.add(op.answerIndex);
  }
  return out;
}
