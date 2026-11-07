// Ôn tập item: one contrast set, reviewed as a 4-question mini round weighted to the learner's weak items.

import { useRef, useState } from 'react';
import { gradePairSet, recordReview } from '../../../core/review';
import { recordAttempt } from '../../../core/stats';
import { stopSpeaking } from '../../../core/tts';
import {
  advance,
  answerFor,
  applyAnswer,
  currentQuestion,
  isFinished,
  startRound,
  submitAnswer,
  type PairsProgress,
  type RoundState,
} from '../../pairs/game';
import RoundView from '../../pairs/RoundView';
import { commitPairsProgress, loadPairsProgress } from '../../pairs/store';
import { pairReviewQuestions, type Resolved } from '../resolve';
import type { ItemBaseProps } from './types';
import Verdict from './Verdict';

export interface PairItemProps extends ItemBaseProps {
  item: Extract<Resolved, { kind: 'pair' }>;
  seed: number;
}

const noop = () => {};

export default function PairItem({ item, seed, graded, onGraded, onNext }: PairItemProps) {
  const { set } = item;
  const [questions] = useState(() => pairReviewQuestions(set, loadPairsProgress(), Date.now(), seed));
  const [round, setRound] = useState<RoundState>(() => startRound(questions));
  // Guards against a fast double key press answering / advancing twice before React re-renders.
  const answeredRef = useRef('');
  const advancedRef = useRef(-1);
  const gradedRef = useRef(false);

  const choose = (choice: number) => {
    const q = currentQuestion(round);
    if (!q || answerFor(round, q.key) || answeredRef.current === q.key) return;
    answeredRef.current = q.key;
    // The mini round has no second chances: the review card itself comes back later.
    const next: RoundState = {
      ...submitAnswer(round, choice),
      queue: round.queue,
    };
    setRound(next);
    if (graded || gradedRef.current) return; // practice only
    const correct = choice === q.answer;
    const now = Date.now();
    const update = (p: PairsProgress) => applyAnswer(p, q.itemId, correct, now);
    try {
      commitPairsProgress(update);
      recordAttempt(
        {
          module: 'pairs',
          itemId: q.itemId,
          correct,
          seen: [set.phenomenon],
          missed: correct ? [] : [set.phenomenon],
        },
        { inReview: true },
      );
    } catch {
      // progress and stats are best effort
    }
    if (next.answers.length >= questions.length) {
      gradedRef.current = true;
      const right = next.answers.filter((a) => a.correct).length;
      const grade = gradePairSet(right, questions.length);
      if (!grade) return;
      const res = recordReview(item.id, grade, {
        ctx: 'review',
        enrol: true,
        success: right === questions.length,
      });
      onGraded({
        grade,
        correct: right === questions.length,
        current: res.current,
      });
    }
  };

  const next = () => {
    if (advancedRef.current === round.index) return;
    const r = advance(round);
    if (r === round) return;
    advancedRef.current = round.index;
    stopSpeaking();
    setRound(r);
  };

  if (questions.length === 0) return null;

  if (isFinished(round)) {
    const right = round.answers.filter((a) => a.correct).length;
    const grade = gradePairSet(right, questions.length);
    const ok = grade !== null && grade !== 'again';
    return (
      <Verdict
        correct={right}
        total={questions.length}
        ok={ok}
        detail={ok ? `Bạn vẫn phân biệt tốt nhóm “${set.title}”.` : `Nhóm “${set.title}” cần nghe thêm vài lần.`}
        onNext={onNext}
      />
    );
  }

  const q = currentQuestion(round);
  const pairItem = q ? set.items.find((i) => i.id === q.itemId) : undefined;
  if (!q || !pairItem) return null;
  return (
    <div className="stack-sm rev-pair">
      <p className="rev-step muted tabular">
        Câu {round.index + 1}/{questions.length}
      </p>
      <RoundView
        key={q.key}
        embedded
        title="Ôn tập"
        showSet
        round={round}
        question={q}
        set={set}
        item={pairItem}
        answer={answerFor(round, q.key)}
        onChoose={choose}
        onNext={next}
        onQuit={noop}
      />
    </div>
  );
}
