// Public surface of the AI layer. Features import from 'src/core/ai' only.
// See docs/ai-providers.md.

export type {
  AiAdapter,
  AiConfig,
  AiErrorCode,
  Capabilities,
  ChatMessage,
  JsonObjectSchema,
  JsonSchema,
  ModelInfo,
  ProviderConfig,
  ProviderKind,
  ReasoningLevel,
  TestResult,
  TextRequest,
  TextResult,
  TokenUsage,
  TtsRequest,
  TtsResult,
} from './types';
export { AiError, isAiError, redactSecrets } from './errors';
export {
  DEFAULT_TTS_STYLE,
  GEMINI_VOICES,
  OPENAI_VOICES,
  PROVIDER_DEFAULTS,
  defaultsFor,
  effectiveBaseUrl,
  keyLooksWrong,
  type ProviderDefaults,
} from './defaults';
export {
  AI_CONFIG_KEY,
  AI_DEVICE_LOCAL_KEYS,
  AI_USAGE_KEY,
  PROVIDER_KINDS,
  clearAiDeviceData,
  createProviderConfig,
  emptyAiConfig,
  getProvider,
  loadAiConfig,
  maskKey,
  removeProvider,
  sanitizeAiConfig,
  saveAiConfig,
  setDefaultProvider,
  subscribeAiConfig,
  updateAiConfig,
  upsertProvider,
} from './config';
export { AI_STORAGE_PREFIX } from './deviceStorage';
export { ADAPTERS, capabilitiesOf, getAdapter } from './registry';
export {
  DEFAULT_TEXT_TIMEOUT_MS,
  DEFAULT_TTS_TIMEOUT_MS,
  aiJson,
  aiSpeak,
  aiStatus,
  aiText,
  aiVersion,
  clearTtsCache,
  getTtsCache,
  listProviderModels,
  subscribeAi,
  testProvider,
  type AiCallOptions,
  type AiJsonRequest,
  type AiJsonOptions,
  type AiSpeakOptions,
  type AiSpeakResult,
  type AiStatus,
  type ProviderSummary,
} from './client';
export { getAiUsage, isOverDailyCap, subscribeAiUsage, type UsageCounters } from './usage';
export { validateJson } from './schema';
export { useAiConfig, useAiStatus, useAiUsageToday, useAiVersion } from './hooks';
