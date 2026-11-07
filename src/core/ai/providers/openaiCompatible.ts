// OpenAI Chat Completions shape, shared by 'openai', 'openrouter' and 'openai-compatible'
// (LM Studio, Ollama, vLLM, … via a custom base URL).
// Docs (checked 2026-11-06): https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
// https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
// https://openrouter.ai/docs/api/reference/overview
//
// CORS: api.openai.com and openrouter.ai answer preflights for any origin (incl. "null").
// Local servers need CORS switched on (OLLAMA_ORIGINS, LM Studio "Enable CORS"), so a failed
// fetch there is reported as 'cors'.
// Neither API exposes Retry-After to browsers (Access-Control-Expose-Headers: CF-Ray only /
// a few x-openrouter-* headers), so the wait is also parsed from the error text
// ("Please try again in 20s"); without a hint the client falls back to its own backoff.
//
// OpenAI TTS: tts-1, tts-1-hd and gpt-4o-mini-tts (the only /v1/audio/speech models) shut down
// on 2027-01-06 (https://developers.openai.com/api/docs/deprecations). The named successor
// gpt-realtime-2.1-mini only works through the Realtime API (WebSocket/WebRTC), which this
// adapter does not speak; after that date OpenAI reports tts: false.

import { defaultsFor, effectiveBaseUrl, DEFAULT_TTS_STYLE } from '../defaults';
import { isAiError, makeError, TRUNCATED_DETAIL, type AiError, labelInSentence } from '../errors';
import { joinUrl, mapCommonStatus, parseRetryAfter, parseRetryHint, providerMessage, sendForBlob, sendJson, type CallContext } from '../http';
import { isStrictCompatible, jsonInstruction, parseJsonLoose, sanitizeSchemaName, toClosedSchema } from '../schema';
import type {
  AiAdapter,
  Capabilities,
  ModelInfo,
  ProviderConfig,
  ProviderKind,
  TestResult,
  TextRequest,
  TextResult,
  TtsRequest,
  TtsResult,
} from '../types';
import { asciiHeader, testFailure } from './common';

export type OpenAiLikeKind = Extract<ProviderKind, 'openai' | 'openrouter' | 'openai-compatible'>;

/** How JSON is requested: native json_schema → json_object → prompt instruction only. */
export type JsonMode = 'schema' | 'object' | 'prompt';

/** App name sent to OpenRouter for attribution (ASCII: header values must be Latin-1). */
export const OPENROUTER_APP_TITLE = 'Nghe Noi Am';
const OPENAI_TTS_MAX_CHARS = 4096;

/** Shutdown of every /v1/audio/speech model (OpenAI deprecations page, 2026-10-01 entry). */
export const OPENAI_SPEECH_SHUTDOWN = Date.UTC(2027, 0, 6);
const OPENAI_SPEECH_MODELS = /^(tts-1|tts-1-hd|gpt-4o-mini-tts)(-|$)/;

/** True when `model` is one of the retired /audio/speech models and the shutdown date has passed. */
export function openAiTtsRetired(model: string, now: number = Date.now()): boolean {
  return now >= OPENAI_SPEECH_SHUTDOWN && OPENAI_SPEECH_MODELS.test(model.trim());
}

const OPENAI_TTS_RETIRED_DETAIL =
  'OpenAI đã ngừng các model đọc /audio/speech (tts-1, tts-1-hd, gpt-4o-mini-tts) từ 2027-01-06 và không có model thay thế cho endpoint này. Dùng Gemini để đọc thành giọng nói.';

function ctxOf(kind: OpenAiLikeKind, config: ProviderConfig, model: string): CallContext {
  return { kind, label: config.label || defaultsFor(kind).label, model };
}

export function openAiHeaders(kind: OpenAiLikeKind, config: ProviderConfig, withBody: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (withBody) h['content-type'] = 'application/json';
  if (config.apiKey) h.authorization = `Bearer ${config.apiKey}`;
  if (kind === 'openrouter') {
    h['X-OpenRouter-Title'] = asciiHeader(OPENROUTER_APP_TITLE);
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (origin && /^https?:\/\//.test(origin)) h['HTTP-Referer'] = origin;
  }
  return h;
}

function errorCode(body: unknown): string {
  const e = (body as { error?: { code?: unknown; type?: unknown } } | undefined)?.error;
  if (!e || typeof e !== 'object') return '';
  return String(e.code ?? e.type ?? '');
}

/** OpenRouter moderation errors carry error.metadata.reasons / flagged_input. */
function isModerationError(body: unknown): boolean {
  const meta = (body as { error?: { metadata?: unknown } } | undefined)?.error?.metadata;
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as { reasons?: unknown; flagged_input?: unknown };
  return (Array.isArray(m.reasons) && m.reasons.length > 0) || typeof m.flagged_input === 'string';
}

export function mapOpenAiError(status: number, body: unknown, hdrs: Headers, ctx: CallContext): AiError {
  const detail = providerMessage(body);
  const code = errorCode(body);
  const msg = (detail ?? '').toLowerCase();
  const c = { ...ctx, provider: ctx.kind, status, detail };
  // Header first (readable in tests / non-browser runtimes), else the hint in the message text.
  const retryAfterMs = parseRetryAfter(hdrs) ?? parseRetryHint(detail);
  if (status === 401 || code === 'invalid_api_key') return makeError('bad-key', { ...c, detail: undefined });
  if (status === 402 || code === 'insufficient_quota' || /insufficient (quota|credits)|billing/.test(msg)) {
    return makeError('quota', c, { retryable: false });
  }
  if (isModerationError(body) || (status === 403 && /moderation|flagged/.test(msg))) return makeError('safety', c);
  if (status === 403 && ctx.kind === 'openrouter') {
    // OpenRouter 403 = guardrail block / key lacks permission for this model or provider; a wrong key is 401.
    return makeError('bad-request', {
      ...c,
      detail: 'OpenRouter chặn yêu cầu (guardrail, hoặc key không có quyền dùng model/nhà cung cấp này): kiểm tra cài đặt key trên openrouter.ai.' + (detail ? ' ' + detail : ''),
    });
  }
  if (status === 404 || code === 'model_not_found' || /model .*(does not exist|not found)|no endpoints found|invalid model/.test(msg)) {
    return makeError('model', c);
  }
  if (status === 429) return makeError('rate-limit', { ...c, detail: undefined, retryAfterMs });
  return mapCommonStatus(status, ctx, detail, retryAfterMs);
}

/** True when a 400 says the server does not support the response_format we sent. */
function rejectsResponseFormat(e: AiError): boolean {
  return (e.code === 'bad-request' || e.code === 'model') && e.status === 400 && /response_format|json_schema|json_object|structured|schema/i.test(e.detail ?? '');
}

function rejectsTemperature(e: AiError): boolean {
  return e.status === 400 && /temperature/i.test(e.detail ?? '');
}

function rejectsReasoning(e: AiError): boolean {
  return e.status === 400 && /reasoning/i.test(e.detail ?? '');
}

/** True when this request carries a reasoning control for this kind (local servers get none). */
function sendsReasoning(kind: OpenAiLikeKind, req: TextRequest): boolean {
  return kind !== 'openai-compatible' && (req.reasoning === 'off' || req.reasoning === 'low');
}

export function buildChatBody(
  kind: OpenAiLikeKind,
  model: string,
  req: TextRequest,
  mode: JsonMode,
  withTemperature: boolean,
  withReasoning = true,
): Record<string, unknown> {
  let system = req.system ?? '';
  if (req.json && mode !== 'schema') system = (system ? system + '\n\n' : '') + jsonInstruction(req.json.schema);
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: 'system', content: system });
  for (const m of req.messages) messages.push({ role: m.role, content: m.content });
  const body: Record<string, unknown> = { model, messages };
  if (withTemperature && req.temperature != null) body.temperature = req.temperature;
  if (req.maxTokens != null) {
    // OpenAI deprecated max_tokens (rejected by reasoning models); OpenRouter/local servers use max_tokens.
    body[kind === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = req.maxTokens;
  }
  if (withReasoning && sendsReasoning(kind, req)) {
    // Reasoning tokens count against the token limit. OpenAI: reasoning_effort none|low|...;
    // OpenRouter: unified reasoning.effort ("none" disables reasoning).
    const effort = req.reasoning === 'off' ? 'none' : 'low';
    if (kind === 'openai') body.reasoning_effort = effort;
    else body.reasoning = { effort };
  }
  if (req.json && mode === 'schema') {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: sanitizeSchemaName(req.json.name), schema: toClosedSchema(req.json.schema), strict: isStrictCompatible(req.json.schema) },
    };
  } else if (req.json && mode === 'object') {
    body.response_format = { type: 'json_object' };
  }
  return body;
}

type ChatChoice = {
  message?: { content?: unknown; refusal?: unknown };
  finish_reason?: string | null;
  error?: { code?: unknown; message?: unknown };
};
type ChatResponse = {
  choices?: ChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  error?: { code?: unknown; message?: unknown };
};

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : '')).join('');
  }
  return '';
}

/** Parses a chat completion body (also OpenRouter errors delivered with HTTP 200). */
export function parseChatResponse(body: unknown, ctx: CallContext, model: string, wantJson: boolean): TextResult {
  const res = (body ?? {}) as ChatResponse;
  const inline = res.error ?? res.choices?.[0]?.error;
  if (inline) {
    const status = Number(inline.code);
    throw mapOpenAiError(Number.isInteger(status) && status >= 400 ? status : 502, { error: inline }, new Headers(), ctx);
  }
  const choice = res.choices?.[0];
  if (!choice) throw makeError('bad-response', { ...ctx, provider: ctx.kind, detail: 'không có choices' });
  const refusal = choice.message?.refusal;
  if (typeof refusal === 'string' && refusal.trim()) throw makeError('safety', { ...ctx, provider: ctx.kind, detail: refusal });
  if (choice.finish_reason === 'content_filter') throw makeError('safety', { ...ctx, provider: ctx.kind, detail: 'finish_reason=content_filter' });
  const text = contentText(choice.message?.content);
  const truncated = choice.finish_reason === 'length';
  if (!text || (truncated && wantJson)) {
    const detail = truncated ? TRUNCATED_DETAIL : `finish_reason=${choice.finish_reason ?? '?'}`;
    throw makeError('bad-response', { ...ctx, provider: ctx.kind, detail }, { retryable: false });
  }
  const result: TextResult = {
    text,
    model: res.model || model,
    usage: res.usage ? { inputTokens: res.usage.prompt_tokens ?? 0, outputTokens: res.usage.completion_tokens ?? 0 } : undefined,
  };
  if (truncated) result.truncated = true;
  if (wantJson) {
    const parsed = parseJsonLoose(text);
    if (parsed !== undefined) result.json = parsed;
  }
  return result;
}

export function createOpenAiCompatibleAdapter(kind: OpenAiLikeKind): AiAdapter {
  const fetchFailCode = kind === 'openai-compatible' ? 'cors' : 'network';
  const base = (config: ProviderConfig) => effectiveBaseUrl(kind, config.baseUrl);

  async function generateText(config: ProviderConfig, req: TextRequest): Promise<TextResult> {
    const model = config.model.trim();
    const ctx = ctxOf(kind, config, model);
    if (!model) throw makeError('model', { ...ctx, provider: kind, detail: 'chưa chọn model' });
    let mode: JsonMode = 'schema';
    let withTemperature = true;
    let withReasoning = true;
    for (let attempt = 0; ; attempt++) {
      try {
        const { body } = await sendJson({
          url: joinUrl(base(config), 'chat/completions'),
          headers: openAiHeaders(kind, config, true),
          body: buildChatBody(kind, model, req, mode, withTemperature, withReasoning),
          signal: req.signal,
          ctx,
          mapError: mapOpenAiError,
          fetchFailCode,
        });
        return parseChatResponse(body, ctx, model, !!req.json);
      } catch (e) {
        if (attempt >= 4 || !isAiError(e)) throw e;
        const err = e;
        if (withTemperature && req.temperature != null && rejectsTemperature(err)) {
          withTemperature = false;
        } else if (withReasoning && sendsReasoning(kind, req) && rejectsReasoning(err)) {
          withReasoning = false;
        } else if (req.json && mode !== 'prompt' && rejectsResponseFormat(err)) {
          mode = mode === 'schema' ? 'object' : 'prompt';
        } else {
          throw e;
        }
      }
    }
  }

  async function tts(config: ProviderConfig, req: TtsRequest): Promise<TtsResult> {
    const d = defaultsFor(kind);
    const model = (config.ttsModel || d.ttsModel || '').trim();
    const ctx = ctxOf(kind, config, model);
    if (kind === 'openai' && openAiTtsRetired(model)) {
      throw makeError('model', { ...ctx, provider: kind, detail: OPENAI_TTS_RETIRED_DETAIL }, { retryable: false });
    }
    if (req.text.length > OPENAI_TTS_MAX_CHARS) {
      throw makeError('bad-request', { ...ctx, provider: kind, detail: `văn bản dài quá ${OPENAI_TTS_MAX_CHARS} ký tự` });
    }
    const body: Record<string, unknown> = {
      model,
      input: req.text,
      voice: req.voice || config.ttsVoice || d.ttsVoice || 'marin',
      response_format: 'mp3',
    };
    if (!/^tts-1/.test(model)) body.instructions = req.style?.trim() || DEFAULT_TTS_STYLE;
    const { blob, mime } = await sendForBlob({
      url: joinUrl(base(config), 'audio/speech'),
      headers: openAiHeaders(kind, config, true),
      body,
      signal: req.signal,
      ctx,
      mapError: (status, b, h, c) => {
        const err = mapOpenAiError(status, b, h, c);
        // A retired speech model answers 404/model_not_found: say why instead of "chọn model khác".
        return err.code === 'model' && OPENAI_SPEECH_MODELS.test(model)
          ? makeError('model', { ...c, provider: kind, status, detail: OPENAI_TTS_RETIRED_DETAIL }, { retryable: false })
          : err;
      },
      fetchFailCode,
    });
    if (!blob.size) throw makeError('bad-response', { ...ctx, provider: kind, detail: 'âm thanh rỗng' });
    const type = mime === 'application/octet-stream' || !mime.startsWith('audio/') ? 'audio/mpeg' : mime;
    return { audio: blob.type === type ? blob : new Blob([blob], { type }), mime: type };
  }

  async function listModels(config: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    const ctx = ctxOf(kind, config, config.model);
    const { body } = await sendJson({
      url: joinUrl(base(config), 'models'),
      headers: openAiHeaders(kind, config, false),
      signal,
      ctx,
      mapError: mapOpenAiError,
      fetchFailCode,
    });
    const data = (body as { data?: { id?: unknown; name?: unknown }[] } | undefined)?.data ?? [];
    const out: ModelInfo[] = [];
    for (const m of data) {
      if (typeof m?.id !== 'string') continue;
      if (kind === 'openai' && /embedding|whisper|dall-e|moderation|transcribe|image|realtime|search|davinci|babbage/.test(m.id)) continue;
      const isTts = /tts/i.test(m.id);
      out.push({ id: m.id, label: typeof m.name === 'string' && m.name ? m.name : m.id, kind: isTts ? 'tts' : 'text' });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  async function testConnection(config: ProviderConfig, signal?: AbortSignal): Promise<TestResult> {
    const model = config.model.trim();
    const ctx = ctxOf(kind, config, model);
    if (!config.apiKey && defaultsFor(kind).requiresKey) return { ok: false, code: 'bad-key', message: `Chưa nhập API key ${ctx.label}.` };
    try {
      if (kind === 'openai') {
        await sendJson({ url: joinUrl(base(config), `models/${encodeURIComponent(model)}`), headers: openAiHeaders(kind, config, false), signal, ctx, mapError: mapOpenAiError });
        return { ok: true, message: `Kết nối ${labelInSentence(ctx.label)} thành công (model ${model}).` };
      }
      if (kind === 'openrouter') {
        // GET /models is public on OpenRouter; /key actually checks the key.
        await sendJson({ url: joinUrl(base(config), 'key'), headers: openAiHeaders(kind, config, false), signal, ctx, mapError: mapOpenAiError });
        return { ok: true, message: `Kết nối ${labelInSentence(ctx.label)} thành công.` };
      }
      const models = await listModels(config, signal);
      if (model && models.length && !models.some((m) => m.id === model)) {
        return { ok: false, code: 'model', message: `Máy chủ ${ctx.label} đang chạy nhưng không có model "${model}". Có: ${models.slice(0, 8).map((m) => m.id).join(', ')}.` };
      }
      return { ok: true, message: `Kết nối ${labelInSentence(ctx.label)} thành công${model ? ` (model ${model})` : ''}.` };
    } catch (e) {
      return testFailure(e, ctx);
    }
  }

  const adapter: AiAdapter = {
    kind,
    capabilities(config: ProviderConfig): Capabilities {
      const ttsModel = config.ttsModel || defaultsFor(kind).ttsModel || '';
      return { text: true, json: true, tts: kind === 'openai' && !!ttsModel && !openAiTtsRetired(ttsModel), listModels: true };
    },
    generateText,
    listModels,
    testConnection,
  };
  if (kind === 'openai') adapter.tts = tts;
  return adapter;
}

export const openaiAdapter = createOpenAiCompatibleAdapter('openai');
export const openrouterAdapter = createOpenAiCompatibleAdapter('openrouter');
export const openaiCompatibleAdapter = createOpenAiCompatibleAdapter('openai-compatible');
