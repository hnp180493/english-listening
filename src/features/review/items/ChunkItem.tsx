// Ôn tập item: a "Cụm từ" card, graded by the learner with the drill's own buttons (drill store, manual SM-2).
// After the grade the card gives way to a short result with "Tiếp", so the "Gặp lại …" line above can be read.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CircleCheck, CircleX } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { recordChunkReview } from '../../../core/review';
import { useSettings } from '../../../core/settings';
import type { Grade } from '../../../core/srs';
import { recordAttempt } from '../../../core/stats';
import { buildChoices, cardKind, choiceSeed } from '../../drill/choice';
import DrillCard from '../../drill/DrillCard';
import { gradeOutcome } from '../../drill/focus';
import { GRADE_LABEL } from '../../drill/labels';
import { ALL_CHUNKS, type Resolved } from '../resolve';
import type { ItemBaseProps } from './types';

export interface ChunkItemProps extends ItemBaseProps {
  item: Extract<Resolved, { kind: 'chunk' }>;
}

export default function ChunkItem({ item, state, graded, onGraded, onNext }: ChunkItemProps) {
  const { chunk } = item;
  const settings = useSettings();
  const doneRef = useRef(false);
  const [picked, setPicked] = useState<Grade | null>(null);
  const kind = cardKind(chunk, state);
  const options = useMemo(() => (kind === 'choose' ? buildChoices(chunk, ALL_CHUNKS, choiceSeed(chunk, state)) : null), [chunk, kind, state]);

  const onGrade = (g: Grade) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (!graded) {
      const res = recordChunkReview(chunk.id, g);
      const { correct, missed } = gradeOutcome(g, chunk.phenomena);
      try {
        recordAttempt(
          {
            module: 'drill',
            itemId: chunk.id,
            correct,
            seen: chunk.phenomena,
            missed,
          },
          { inReview: true },
        );
      } catch {
        // stats are best effort
      }
      onGraded({ grade: g, correct, current: res.state });
    }
    setPicked(g);
  };

  if (picked) return <ChunkResult written={chunk.written} spoken={chunk.spoken} grade={picked} onNext={onNext} />;

  return (
    <DrillCard
      chunk={chunk}
      state={state}
      kind={kind === 'choose' && options ? 'choose' : 'type'}
      options={options}
      showIpa={settings.showIpa}
      autoPlay
      onGrade={onGrade}
    />
  );
}

interface ChunkResultProps {
  written: string;
  spoken: string;
  grade: Grade;
  onNext: () => void;
}

/** The learner's own grade and "Tiếp"; the page shows when the chunk comes back. */
function ChunkResult({ written, spoken, grade, onNext }: ChunkResultProps) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);
  const ok = grade !== 'again';
  return (
    <section className="card stack rev-verdict">
      <div className={'callout ' + (ok ? 'callout-ok' : 'callout-bad')} role="status">
        <Icon icon={ok ? CircleCheck : CircleX} size={20} />
        <div>
          <p className="rev-verdict-title" lang="en">
            {written === spoken ? written : `${written} → ${spoken}`}
          </p>
          <p className="rev-verdict-detail">Bạn tự chấm: {GRADE_LABEL[grade]}</p>
        </div>
      </div>
      <div className="rev-verdict-actions">
        <button ref={nextRef} type="button" className="btn btn-primary btn-lg" onClick={onNext}>
          Tiếp
          <Icon icon={ArrowRight} size={17} />
        </button>
      </div>
    </section>
  );
}
