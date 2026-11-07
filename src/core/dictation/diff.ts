// Turn alignment ops (over canonical tokens) into display units over the
// ORIGINAL written words, for the colour-coded diff shown after checking.

import { extraAnswerTokens, type AlignOp } from './align';
import { displayCanon } from './normalize';

export type DiffUnit =
  | { kind: 'ok'; targetIndex: number; target: string }
  | { kind: 'typo'; targetIndex: number; target: string; answer: string }
  | { kind: 'wrong'; targetIndex: number; target: string; answer: string }
  | { kind: 'missing'; targetIndex: number; target: string }
  | { kind: 'skip'; targetIndex: number; target: string } // punctuation-only token, never graded
  | { kind: 'extra'; answer: string };

export function buildDiff(targetRaw: readonly string[], answerRaw: readonly string[], ops: readonly AlignOp[]): DiffUnit[] {
  const perTarget = new Map<number, AlignOp[]>();
  const extrasAfter = new Map<number, string[]>(); // key: target index the extras follow (-1 = start)
  const usedAnswer = new Set<number>();
  for (const op of ops) if (op.kind !== 'ins' && op.answerIndex !== undefined) usedAnswer.add(op.answerIndex);
  const extraTokens = extraAnswerTokens(ops); // same rule as the score penalty

  let lastTarget = -1;
  const shownWhole = new Set<number>();
  for (const op of ops) {
    if (op.kind === 'ins') {
      const ai = op.answerIndex ?? -1;
      if (!extraTokens.has(ai)) continue; // already shown inside a wrong/typo unit
      const list = extrasAfter.get(lastTarget) ?? [];
      if (!usedAnswer.has(ai)) {
        // whole answer token is extra: show it once, as typed
        if (!shownWhole.has(ai)) list.push(answerRaw[ai] ?? displayCanon(op.answerWord ?? ''));
        shownWhole.add(ai);
      } else {
        list.push(displayCanon(op.answerWord ?? ''));
      }
      extrasAfter.set(lastTarget, list);
      continue;
    }
    const t = op.targetIndex ?? -1;
    if (t < 0) continue;
    const list = perTarget.get(t) ?? [];
    list.push(op);
    perTarget.set(t, list);
    lastTarget = t;
  }

  const units: DiffUnit[] = [];
  const pushExtras = (key: number) => {
    for (const a of extrasAfter.get(key) ?? []) if (a) units.push({ kind: 'extra', answer: a });
  };
  pushExtras(-1);
  targetRaw.forEach((raw, i) => {
    const tops = perTarget.get(i);
    if (!tops || tops.length === 0) {
      units.push({ kind: 'skip', targetIndex: i, target: raw });
    } else {
      const answerIdx: number[] = [];
      for (const o of tops) if (o.answerIndex !== undefined && !answerIdx.includes(o.answerIndex)) answerIdx.push(o.answerIndex);
      const answer = answerIdx.map((k) => answerRaw[k] ?? '').join(' ');
      if (tops.every((o) => o.kind === 'match')) {
        if (tops.some((o) => o.typo)) units.push({ kind: 'typo', targetIndex: i, target: raw, answer });
        else units.push({ kind: 'ok', targetIndex: i, target: raw });
      } else if (tops.every((o) => o.kind === 'del')) {
        units.push({ kind: 'missing', targetIndex: i, target: raw });
      } else {
        units.push({ kind: 'wrong', targetIndex: i, target: raw, answer });
      }
    }
    pushExtras(i);
  });
  return units;
}
