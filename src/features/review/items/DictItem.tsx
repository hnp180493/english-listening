// Ôn tập item: a dictation sentence (dict) or a video transcript line read by TTS (media).

import { useRef, useState } from 'react';
import { Clapperboard, ExternalLink } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { updateProgress } from '../../../core/dictation/progress';
import { hrefFor } from '../../../core/nav';
import { dictationErrors, gradeDictation, recordReview } from '../../../core/review';
import { recordAttempt } from '../../../core/stats';
import { KEYS, saveJSON } from '../../../core/storage';
import Exercise, { type CheckedInfo } from '../../dictation/Exercise';
import { loadProgressOr } from '../../dictation/pageModel';
import type { Resolved } from '../resolve';
import type { ItemBaseProps } from './types';

type DictLike = Extract<Resolved, { kind: 'dict' | 'media' }>;

export interface DictItemProps extends ItemBaseProps {
  item: DictLike;
  onRetry: () => void;
  onSkip: () => void;
}

export default function DictItem({ item, graded, onGraded, onNext, onRetry, onSkip }: DictItemProps) {
  // A second check in the same tick (or after a retry remount) must not grade twice.
  const doneRef = useRef(false);
  // "Làm lại câu này" remounts with graded = true: the answer was just shown, so no "Nghe 1 lần là đúng" praise.
  // Read once at mount: `graded` flips in the same batch as the first check and must not change that verdict.
  const [retried] = useState(graded);

  const onChecked = (info: CheckedInfo) => {
    if (graded || doneRef.current) return; // a retry is practice only
    doneRef.current = true;
    const counts = {
      total: info.total ?? 0,
      matched: info.matched ?? 0,
      extra: info.extra ?? 0,
    };
    const grade = gradeDictation({
      ...counts,
      hinted: info.hinted,
      revealed: !!info.revealed,
      firstTry: false,
      kind: item.kind,
    });
    const res = recordReview(item.id, grade, { ctx: 'review', enrol: true });
    if (item.kind === 'dict') {
      try {
        const next = updateProgress(loadProgressOr({}), item.ref, info.score, Date.now(), info.hinted);
        saveJSON(KEYS.dictation, next);
      } catch {
        // progress is best effort; the review grade is already saved
      }
    }
    const correct = dictationErrors(counts) === 0 && !info.hinted && !info.revealed;
    try {
      recordAttempt(
        {
          module: item.kind === 'media' ? 'media' : 'dictation',
          itemId: item.ref,
          correct,
          seen: info.seen,
          missed: info.missed,
        },
        { inReview: true },
      );
    } catch {
      // stats are best effort
    }
    onGraded({ grade, correct, current: res.current });
  };

  return (
    <div className="stack-sm rev-item">
      {item.kind === 'media' && (
        <div className="row-between rev-media-note">
          <span className="muted rev-media-label">
            <Icon icon={Clapperboard} size={15} />
            Câu từ video · giọng đọc máy
          </span>
          <a className="btn btn-ghost btn-sm" href={hrefFor('media', { id: item.itemId, unit: item.unit })}>
            <Icon icon={ExternalLink} size={14} />
            Mở video
          </a>
        </div>
      )}
      <Exercise sentence={item.sentence} known={retried} autoPlay focusOnMount onChecked={onChecked} onNext={onNext} onRetry={onRetry} onSkip={onSkip} />
    </div>
  );
}
