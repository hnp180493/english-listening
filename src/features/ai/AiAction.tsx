// Shared "ask AI" control: a secondary button (never the primary), then loading (with Hủy), the result, or an
// error with "Thử lại". Without a configured text provider it renders nothing: the page looks exactly as before
// AI existed, and the learner discovers AI in Cài đặt → Trợ lý AI.
// It never calls the AI by itself; a cached answer for the same input shows at once.

import type { ReactNode } from 'react';
import { LoaderCircle, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { useAiStatus } from '../../core/ai';
import { hrefFor } from '../../core/nav';
import { useAiTask } from './useAiTask';
import './ai.css';

/** Where the learner adds a key (Cài đặt → AI). */
const AI_SETTINGS_HREF = hrefFor('settings', { section: 'ai' });

/** Error codes the learner fixes in Cài đặt (the error line then links there). */
const SETTINGS_CODES = new Set(['bad-key', 'no-provider', 'quota', 'model']);

/** "Hỏi AI …: Thêm API key trong Cài đặt" as one muted line. */
export function AiSetupLink({ what, className }: { what?: string; className?: string }) {
  return (
    <p className={'ai-setup' + (className ? ' ' + className : '')}>
      <Icon icon={Sparkles} size={15} />
      <span>
        {what ? `${what}: ` : ''}
        <a href={AI_SETTINGS_HREF}>Thêm API key trong Cài đặt</a>
      </span>
    </p>
  );
}

/** Spinner + text + Hủy, shown while a request runs. */
export function AiBusy({ text, onCancel }: { text: string; onCancel: () => void }) {
  return (
    <div className="ai-busy" role="status">
      <Icon icon={LoaderCircle} size={16} className="icon-spin" />
      <span>{text}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Hủy
      </button>
    </div>
  );
}

export function AiErrorLine({ message, code, onRetry }: { message: string; code?: string; onRetry: () => void }) {
  return (
    <div className="callout callout-warn ai-error" role="alert">
      <Icon icon={TriangleAlert} size={16} />
      <div>
        <p>{message}</p>
        <div className="ai-error-btns">
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            <Icon icon={RotateCcw} size={15} />
            Thử lại
          </button>
          {code && SETTINGS_CODES.has(code) && (
            <a className="btn btn-ghost btn-sm" href={AI_SETTINGS_HREF}>
              Mở Cài đặt AI
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export interface AiActionProps<T> {
  /** Button text, e.g. "Hỏi AI vì sao nghe sai". */
  label: string;
  /** Shown while waiting, e.g. "AI đang giải thích…". */
  busyLabel?: string;
  /** Cache key of this input (aiCacheKey); null = nothing to ask. Include the provider/model in it. */
  cacheKey: string | null;
  run: (signal: AbortSignal) => Promise<T>;
  render: (value: T) => ReactNode;
  className?: string;
}

export default function AiAction<T>({ label, busyLabel = 'AI đang trả lời…', cacheKey, run, render, className }: AiActionProps<T>) {
  const status = useAiStatus();
  const { state, start, cancel } = useAiTask<T>(status.configured ? cacheKey : null, run);
  if (!status.configured) return null;
  if (!cacheKey) return null;
  return (
    <div className={'ai-action' + (className ? ' ' + className : '')} aria-live="polite">
      {state.status === 'idle' && (
        <button type="button" className="btn btn-sm ai-btn" onClick={() => start()}>
          <Icon icon={Sparkles} size={15} />
          {label}
        </button>
      )}
      {state.status === 'loading' && <AiBusy text={busyLabel} onCancel={cancel} />}
      {state.status === 'error' && <AiErrorLine message={state.message} code={state.code} onRetry={() => start({ force: true })} />}
      {state.status === 'done' && (
        <div className="ai-result">
          {render(state.value)}
          <p className="ai-note">
            <Icon icon={Sparkles} size={14} />
            Do AI viết, có thể chưa chính xác.
          </p>
        </div>
      )}
    </div>
  );
}
