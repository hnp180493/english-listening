// kind → adapter. Adding a provider: write providers/<name>.ts implementing AiAdapter, add its kind to
// ProviderKind (types.ts), its defaults (defaults.ts), PROVIDER_KINDS (config.ts) and one line here.

import { anthropicAdapter } from './providers/anthropic';
import { geminiAdapter } from './providers/gemini';
import { openaiAdapter, openaiCompatibleAdapter, openrouterAdapter } from './providers/openaiCompatible';
import type { AiAdapter, Capabilities, ProviderConfig, ProviderKind } from './types';

export const ADAPTERS: Readonly<Record<ProviderKind, AiAdapter>> = {
  gemini: geminiAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  openrouter: openrouterAdapter,
  'openai-compatible': openaiCompatibleAdapter,
};

export function getAdapter(kind: ProviderKind): AiAdapter {
  return ADAPTERS[kind];
}

/** What a configured provider can do (tts also requires the adapter to implement it). */
export function capabilitiesOf(config: ProviderConfig): Capabilities {
  const a = ADAPTERS[config.kind];
  const caps = a.capabilities(config);
  return { ...caps, tts: caps.tts && typeof a.tts === 'function', listModels: caps.listModels && typeof a.listModels === 'function' };
}
