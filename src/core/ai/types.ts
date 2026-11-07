// Provider-agnostic types of the AI layer. Features import from ./index (client API) and never
// talk to a provider directly. Adding a provider = one adapter file + one line in registry.ts
// (+ its defaults in defaults.ts). See docs/ai-providers.md.

/** Every provider kind the layer knows. 'openai-compatible' = any server speaking OpenAI chat completions (LM Studio, Ollama, vLLM, …). */
export type ProviderKind = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'openai-compatible';

/** One configured provider (the user may have several, e.g. Gemini + a local Ollama). Stored device-locally. */
export interface ProviderConfig {
  /** Stable id (random), referenced by AiConfig.defaultTextProvider / defaultTtsProvider. */
  id: string;
  kind: ProviderKind;
  /** User-visible name, e.g. "Gemini cá nhân". */
  label: string;
  /** Secret. Never logged, never put in a URL, never in an error message. May be '' for keyless local servers. */
  apiKey: string;
  /** Override of the kind's default base URL (required for 'openai-compatible'). No trailing slash. */
  baseUrl?: string;
  /** Text model id, e.g. "gemini-3.6-flash". */
  model: string;
  /** Speech model id (only kinds whose adapter has tts). */
  ttsModel?: string;
  /** Voice name for TTS (provider specific, e.g. "Kore" for Gemini, "marin" for OpenAI). */
  ttsVoice?: string;
  enabled: boolean;
}

export interface AiConfig {
  /** Schema version of the stored object. */
  v: 1;
  providers: ProviderConfig[];
  /** Provider id used by aiText/aiJson when the caller does not name one. */
  defaultTextProvider?: string;
  /** Provider id used by aiSpeak when the caller does not name one. */
  defaultTtsProvider?: string;
  /** Optional soft cap: max successful requests per local day across all providers (undefined/0 = no cap). */
  dailyRequestCap?: number;
}

/**
 * The JSON Schema subset every provider accepts (Gemini responseJsonSchema, OpenAI json_schema,
 * Anthropic output_config.format / tool input_schema). Keep schemas inside this subset:
 * no $ref, anyOf, nullable, pattern, numeric bounds. minItems/maxItems are enforced locally by
 * validateJson (and only forwarded to Gemini).
 */
export type JsonSchema =
  | { type: 'object'; properties: Record<string, JsonSchema>; required?: string[]; description?: string }
  | { type: 'array'; items: JsonSchema; minItems?: number; maxItems?: number; description?: string }
  | { type: 'string'; enum?: string[]; description?: string }
  | { type: 'number' | 'integer'; description?: string }
  | { type: 'boolean'; description?: string };

/**
 * Root schema of a provider JSON request. OpenAI json_schema and Anthropic structured outputs /
 * tool input_schema only accept an OBJECT at the root, so adapters only ever see one. aiJson()
 * accepts any JsonSchema and wraps a non-object root as {value: …} itself (see schema.ts).
 */
export type JsonObjectSchema = Extract<JsonSchema, { type: 'object' }>;

/**
 * How much the model may "think" before answering. Reasoning tokens count against maxTokens on
 * every provider, so short/JSON answers with a small maxTokens should use 'off' or 'low'.
 * undefined = provider default. Mapped per provider (Gemini thinkingConfig.thinkingLevel,
 * OpenAI reasoning_effort, OpenRouter reasoning.effort, Anthropic thinking/output_config.effort);
 * dropped automatically when a model rejects it.
 */
export type ReasoningLevel = 'off' | 'low' | 'default';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TextRequest {
  system?: string;
  messages: ChatMessage[];
  /** 0..2. Ignored where the provider/API version no longer accepts it (Anthropic 2026-10-21; Gemini 3.6 Flash and newer silently ignore it). */
  temperature?: number;
  /** Hard cap on output tokens INCLUDING reasoning tokens (see `reasoning`). */
  maxTokens?: number;
  /** See ReasoningLevel. */
  reasoning?: ReasoningLevel;
  /** Ask for JSON matching `schema` (object root). `name`: [A-Za-z0-9_-]{1,64} (sanitized if not). Prefer aiJson(). */
  json?: { schema: JsonObjectSchema; name: string };
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface TextResult {
  text: string;
  /** Parsed JSON when the request had `json` and the text parsed (not yet validated against the schema). */
  json?: unknown;
  model: string;
  usage?: TokenUsage;
  /**
   * True when the provider stopped because the output-token limit was reached (Gemini MAX_TOKENS,
   * OpenAI finish_reason 'length', Anthropic stop_reason 'max_tokens'): `text` is cut off.
   * In JSON mode adapters throw 'bad-response' instead of returning a truncated result.
   */
  truncated?: boolean;
}

export interface TtsRequest {
  text: string;
  voice?: string;
  /** Delivery style, e.g. "natural conversational American English, normal speed". */
  style?: string;
  signal?: AbortSignal;
}

export interface TtsResult {
  audio: Blob;
  mime: string;
}

export interface Capabilities {
  text: boolean;
  json: boolean;
  tts: boolean;
  listModels: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
  /** 'tts' for speech models (Gemini *-tts, OpenAI *tts*), otherwise 'text'. */
  kind: 'text' | 'tts';
}

export interface TestResult {
  ok: boolean;
  /** Vietnamese, user-facing, never contains the key. */
  message: string;
  code?: AiErrorCode;
}

/** What one provider kind can do. Implementations live in ./providers/*. */
export interface AiAdapter {
  kind: ProviderKind;
  capabilities(config: ProviderConfig): Capabilities;
  generateText(config: ProviderConfig, req: TextRequest): Promise<TextResult>;
  tts?(config: ProviderConfig, req: TtsRequest): Promise<TtsResult>;
  listModels?(config: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]>;
  /** Cheap check that key (+ model) work. Must not throw: failures come back as { ok: false }. */
  testConnection(config: ProviderConfig, signal?: AbortSignal): Promise<TestResult>;
}

export type AiErrorCode =
  | 'no-provider'
  | 'bad-key'
  | 'quota'
  | 'rate-limit'
  | 'network'
  | 'cors'
  | 'model'
  | 'safety'
  | 'bad-response'
  | 'bad-request'
  | 'server'
  | 'timeout'
  | 'aborted';
