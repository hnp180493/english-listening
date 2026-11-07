import type { ReactNode } from 'react';
import { ArrowRight, Check, Languages, RotateCcw, Sparkles, Volume2, X, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components/Icon';

export type Tone = 'ok' | 'warn' | 'bad';

const TONE_ICON: Record<Tone, LucideIcon> = { ok: Check, warn: Sparkles, bad: X };

/** Result banner: tinted strip with an icon, the verdict, a detail line and the score. */
export function Verdict({ tone, pct, title, sub }: { tone: Tone; pct: number; title: ReactNode; sub: ReactNode }) {
  return (
    <div className={`dict-verdict dict-verdict-${tone}`}>
      <span className="dict-verdict-icon" aria-hidden="true">
        <Icon icon={TONE_ICON[tone]} size={20} strokeWidth={2.5} />
      </span>
      <div className="dict-verdict-text">
        <div className="dict-verdict-title">{title}</div>
        <div className="dict-verdict-sub">{sub}</div>
      </div>
      <div className="dict-verdict-pct tabular">{pct}%</div>
    </div>
  );
}

/** Vietnamese meaning of the sentence. */
export function Meaning({ vi }: { vi: string }) {
  return (
    <p className="dict-vi">
      <Icon icon={Languages} size={16} className="dict-vi-icon" />
      <span>
        <span className="sr-only">Nghĩa: </span>
        {vi}
      </span>
    </p>
  );
}

/** Bottom bar of a checked exercise: replay, retry, next. */
export function ResultActions({
  canSpeak,
  onReplay,
  onRetry,
  onNext,
}: {
  canSpeak: boolean;
  onReplay: () => void;
  onRetry: () => void;
  onNext: () => void;
}) {
  return (
    <div className="dict-actions">
      <button type="button" className="btn btn-ghost" onClick={onReplay} disabled={!canSpeak}>
        <Icon icon={Volume2} size={16} />
        Nghe lại
      </button>
      <button type="button" className="btn btn-ghost" onClick={onRetry} title="Làm lại câu này">
        <Icon icon={RotateCcw} size={16} />
        Làm lại
      </button>
      <button type="button" className="btn btn-primary btn-lg dict-next" onClick={onNext}>
        Câu tiếp
        <Icon icon={ArrowRight} size={17} />
      </button>
    </div>
  );
}
