// React bindings for the AI layer.

import { useMemo, useSyncExternalStore } from 'react';
import { aiStatus, aiVersion, subscribeAi, type AiStatus } from './client';
import { loadAiConfig } from './config';
import type { AiConfig } from './types';
import { getAiUsage } from './usage';

/** Re-renders on config changes (any tab) and usage changes. */
export function useAiVersion(): number {
  return useSyncExternalStore(subscribeAi, aiVersion, aiVersion);
}

export function useAiStatus(): AiStatus {
  const v = useAiVersion();
  return useMemo(() => {
    void v;
    return aiStatus();
  }, [v]);
}

/** Full config INCLUDING keys — only for the settings form. */
export function useAiConfig(): AiConfig {
  const v = useAiVersion();
  return useMemo(() => {
    void v;
    return loadAiConfig();
  }, [v]);
}

export function useAiUsageToday(): ReturnType<typeof getAiUsage> {
  const v = useAiVersion();
  return useMemo(() => {
    void v;
    return getAiUsage();
  }, [v]);
}
