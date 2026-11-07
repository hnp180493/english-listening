// End of a multi-question review item (pair set, lesson): "Đúng c/n câu" + "Tiếp".

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, CircleCheck, CircleX } from 'lucide-react';
import { Icon } from '../../../components/Icon';

export interface VerdictProps {
  correct: number;
  total: number;
  /** Remembered (grade other than 'again'). */
  ok: boolean;
  detail: ReactNode;
  onNext: () => void;
  extra?: ReactNode;
}

export default function Verdict({ correct, total, ok, detail, onNext, extra }: VerdictProps) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="card stack rev-verdict">
      <div className={'callout ' + (ok ? 'callout-ok' : 'callout-bad')} role="status">
        <Icon icon={ok ? CircleCheck : CircleX} size={20} />
        <div>
          <p className="rev-verdict-title">
            Đúng {correct}/{total} câu
          </p>
          <p className="rev-verdict-detail">{detail}</p>
        </div>
      </div>
      <div className="rev-verdict-actions">
        {extra}
        <button ref={nextRef} type="button" className="btn btn-primary btn-lg" onClick={onNext}>
          Tiếp
          <Icon icon={ArrowRight} size={17} />
        </button>
      </div>
    </section>
  );
}
