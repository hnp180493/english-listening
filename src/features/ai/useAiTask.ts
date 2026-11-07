// On-demand AI call with a per-input cache (src/core/aiTasks.ts): never runs by itself, a cached answer shows at
// once (re-opening does not re-bill), the request is aborted on unmount or cancel.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isAiError, type AiErrorCode } from '../../core/ai';
import { aiCacheGet, aiCacheSet } from '../../core/aiTasks';

export type AiTaskState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; value: T; cached: boolean }
  | { status: 'error'; message: string; code?: AiErrorCode };

/** Message when the model answered but nothing usable was left after validation. */
export const UNUSABLE_ANSWER = 'AI trả lời không dùng được. Hãy thử lại.';

export function errorOf(e: unknown): { message: string; code?: AiErrorCode } {
  if (isAiError(e)) return { message: e.message, code: e.code };
  return { message: UNUSABLE_ANSWER };
}

/**
 * `key` null = cannot run (no provider / no input). `run` gets an AbortSignal and returns the value to cache.
 * Returns the state for this key plus start / cancel.
 */
export function useAiTask<T>(key: string | null, run: (signal: AbortSignal) => Promise<T>) {
  const [entry, setEntry] = useState<{ key: string | null; state: AiTaskState<T> }>(() => ({ key, state: initial<T>(key) }));
  const ctrlRef = useRef<AbortController | null>(null);
  const runRef = useRef(run);
  useLayoutEffect(() => {
    runRef.current = run;
  });

  // a new input: show its cached answer (if any), never call by itself
  let state = entry.state;
  if (entry.key !== key) {
    state = initial<T>(key);
    setEntry({ key, state });
  }

  useEffect(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
  }, [key]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const start = useCallback(
    (opts: { force?: boolean } = {}) => {
      if (!key) return;
      if (!opts.force) {
        const hit = aiCacheGet<T>(key);
        if (hit !== undefined) {
          setEntry({ key, state: { status: 'done', value: hit, cached: true } });
          return;
        }
      }
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setEntry({ key, state: { status: 'loading' } });
      runRef.current(ctrl.signal).then(
        (value) => {
          if (ctrl.signal.aborted) return;
          aiCacheSet(key, value);
          ctrlRef.current = null;
          setEntry({ key, state: { status: 'done', value, cached: false } });
        },
        (e: unknown) => {
          if (ctrl.signal.aborted) return; // cancelled / unmounted / new input
          ctrlRef.current = null;
          setEntry({ key, state: { status: 'error', ...errorOf(e) } });
        },
      );
    },
    [key],
  );

  const cancel = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setEntry({ key, state: { status: 'idle' } });
  }, [key]);

  return { state, start, cancel };
}

function initial<T>(key: string | null): AiTaskState<T> {
  if (!key) return { status: 'idle' };
  const hit = aiCacheGet<T>(key);
  return hit === undefined ? { status: 'idle' } : { status: 'done', value: hit, cached: true };
}
