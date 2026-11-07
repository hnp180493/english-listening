// Google Gemini (Generative Language API, v1beta, models.generateContent).
// Docs (checked 2026-11-06; ai.google.dev now 301-redirects to aistudio.google.com):
// https://aistudio.google.com/api-reference/generate-content ,
// https://aistudio.google.com/docs/speech-generation , structured output via
// generationConfig.responseMimeType + responseJsonSchema. generateContent is still fully
// supported; Google's newer Interactions API is the documented default for new projects, a
// later migration would only touch this file.
// Gemini 3.6 Flash and newer silently ignore temperature/topP/topK (we still forward temperature
// for older models).
//
// CORS: the API answers browser preflights for any origin (incl. "null" = file://) but only
// allows the request headers `content-type` and `x-goog-api-key` — send NOTHING else.
// The key travels in x-goog-api-key, never in the ?key= query (URLs end up in logs/history).

import { effectiveBaseUrl, defaultsFor, DEFAULT_TTS_STYLE } from '../defaults';
import { isAiError, makeError, TRUNCATED_DETAIL, type AiError, labelInSentence } from '../errors';
import { joinUrl, mapCommonStatus, parseRetryAfter, providerMessage, sendJson, type CallContext } from '../http';
import { parseJsonLoose } from '../schema';
import type { AiAdapter, Capabilities, ModelInfo, ProviderConfig, TestResult, TextRequest, TextResult, TtsRequest, TtsResult } from '../types';
import { audioBlobFromBase64 } from '../wav';
import { testFailure } from './common';

const SAFETY_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT']);

/** "models/gemini-x" → "gemini-x". */
export function geminiModelId(model: string): string {
  return model.trim().replace(/^models\//, '');
}

function headers(config: ProviderConfig): Record<string, string> {
  return { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey };
}

function ctxOf(config: ProviderConfig, model: string): CallContext {
  return { kind: 'gemini', label: config.label || defaultsFor('gemini').label, model };
}

function url(config: ProviderConfig, path: string): string {
  return joinUrl(effectiveBaseUrl('gemini', config.baseUrl), path);
}

/** RetryInfo.retryDelay ("37s", "1.5s") from a google.rpc error. */
function retryDelayMs(body: unknown): number | undefined {
  const details = (body as { error?: { details?: unknown } } | undefined)?.error?.details;
  if (!Array.isArray(details)) return undefined;
  for (const d of details) {
    const delay = (d as { retryDelay?: unknown })?.retryDelay;
    if (typeof delay === 'string') {
      const m = /^(\d+(?:\.\d+)?)s$/.exec(delay.trim());
      if (m) return Math.round(Number(m[1]) * 1000);
    }
  }
  return undefined;
}

/** ErrorInfo reasons and QuotaFailure quotaIds from a google.rpc error. */
function errorDetails(body: unknown): { reasons: string[]; quotaIds: string[] } {
  const details = (body as { error?: { details?: unknown } } | undefined)?.error?.details;
  const reasons: string[] = [];
  const quotaIds: string[] = [];
  if (!Array.isArray(details)) return { reasons, quotaIds };
  for (const d of details) {
    const r = (d as { reason?: unknown })?.reason;
    if (typeof r === 'string') reasons.push(r);
    const violations = (d as { violations?: unknown })?.violations;
    if (Array.isArray(violations)) {
      for (const v of violations) {
        const q = (v as { quotaId?: unknown })?.quotaId;
        if (typeof q === 'string') quotaIds.push(q);
      }
    }
  }
  return { reasons, quotaIds };
}

/**
 * Is a RESOURCE_EXHAUSTED a daily quota (wait until tomorrow / enable billing) rather than a
 * per-minute limit (wait seconds)? Google's message is the same for both ("You exceeded your
 * current quota, please check your plan and billing details"), so the structured quotaId decides;
 * the text is only consulted when no quotaId is present.
 */
export function geminiQuotaIsDaily(quotaIds: readonly string[], message: string): boolean {
  if (quotaIds.length) return quotaIds.some((q) => /PerDay/i.test(q));
  return /per[ -]day|daily|prepay|credits? (are |is )?(depleted|exhausted)/i.test(message);
}

/** google.rpc error → AiError. */
export function mapGeminiError(status: number, body: unknown, hdrs: Headers, ctx: CallContext): AiError {
  const detail = providerMessage(body);
  const rpcStatus = (body as { error?: { status?: unknown } } | undefined)?.error?.status;
  const { reasons, quotaIds } = errorDetails(body);
  const msg = (detail ?? '').toLowerCase();
  const c = { ...ctx, provider: ctx.kind, status, detail };
  if (reasons.includes('API_KEY_INVALID') || /api key (not valid|expired)/.test(msg)) return makeError('bad-key', { ...c, detail: undefined });
  if (status === 400 && (rpcStatus === 'FAILED_PRECONDITION' || /location is not supported/.test(msg))) {
    return makeError('bad-request', {
      ...c,
      detail: 'Gemini API chưa hỗ trợ khu vực của bạn hoặc dự án chưa bật thanh toán. ' + (detail ?? ''),
    });
  }
  if (status === 429 || rpcStatus === 'RESOURCE_EXHAUSTED') {
    const retryAfterMs = parseRetryAfter(hdrs) ?? retryDelayMs(body);
    const perDay = geminiQuotaIsDaily(quotaIds, msg);
    return perDay ? makeError('quota', c, { retryable: false }) : makeError('rate-limit', { ...c, retryAfterMs, detail: undefined });
  }
  if (status === 404 || (status === 400 && /model/.test(msg) && /not (found|supported)|unknown|invalid/.test(msg))) {
    return makeError('model', c);
  }
  if (status === 400 && /response_?modalities|audio/i.test(msg)) return makeError('model', c);
  return mapCommonStatus(status, ctx, detail, parseRetryAfter(hdrs));
}

type GeminiPart = { text?: string; thought?: boolean; inlineData?: { mimeType?: string; data?: string } };
type GeminiCandidate = { content?: { parts?: GeminiPart[] }; finishReason?: string; finishMessage?: string };
type GeminiResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
};

/** Checks safety blocks / empty candidates and returns the first candidate. */
function firstCandidate(res: GeminiResponse, ctx: CallContext): GeminiCandidate {
  const block = res.promptFeedback?.blockReason;
  if (block) throw makeError('safety', { ...ctx, provider: 'gemini', detail: `blockReason=${block}` });
  const cand = res.candidates?.[0];
  if (!cand) throw makeError('bad-response', { ...ctx, provider: 'gemini', detail: 'không có candidates' });
  if (cand.finishReason && SAFETY_FINISH.has(cand.finishReason)) {
    throw makeError('safety', { ...ctx, provider: 'gemini', detail: `finishReason=${cand.finishReason}` });
  }
  return cand;
}

const THINKING_LEVEL = { off: 'MINIMAL', low: 'LOW' } as const;

export function buildGeminiTextBody(req: TextRequest, withThinking = true): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  const gen: Record<string, unknown> = {};
  if (req.temperature != null) gen.temperature = req.temperature;
  if (req.maxTokens != null) gen.maxOutputTokens = req.maxTokens;
  if (withThinking && (req.reasoning === 'off' || req.reasoning === 'low')) {
    // Gemini 3+: thinkingLevel. 'off' → MINIMAL (the lowest level; thinking cannot be fully off on every model).
    gen.thinkingConfig = { thinkingLevel: THINKING_LEVEL[req.reasoning] };
  }
  if (req.json) {
    gen.responseMimeType = 'application/json';
    gen.responseJsonSchema = req.json.schema;
  }
  if (Object.keys(gen).length) body.generationConfig = gen;
  return body;
}

async function generateText(config: ProviderConfig, req: TextRequest): Promise<TextResult> {
  const model = geminiModelId(config.model);
  const ctx = ctxOf(config, model);
  const send = (withThinking: boolean) =>
    sendJson({
      url: url(config, `models/${encodeURIComponent(model)}:generateContent`),
      headers: headers(config),
      body: buildGeminiTextBody(req, withThinking),
      signal: req.signal,
      ctx,
      mapError: mapGeminiError,
    });
  let body: unknown;
  try {
    ({ body } = await send(true));
  } catch (e) {
    // Models without thinking (or without thinkingLevel) reject thinkingConfig → resend without it.
    if (!req.reasoning || req.reasoning === 'default' || !isAiError(e) || e.status !== 400 || !/thinking/i.test(e.detail ?? '')) throw e;
    ({ body } = await send(false));
  }
  const res = (body ?? {}) as GeminiResponse;
  const cand = firstCandidate(res, ctx);
  const text = (cand.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  const truncated = cand.finishReason === 'MAX_TOKENS';
  if (!text || (truncated && req.json)) {
    const detail = truncated ? TRUNCATED_DETAIL : `finishReason=${cand.finishReason ?? '?'}`;
    throw makeError('bad-response', { ...ctx, provider: 'gemini', detail }, { retryable: false });
  }
  const u = res.usageMetadata;
  const result: TextResult = {
    text,
    model: res.modelVersion || model,
    usage: u ? { inputTokens: u.promptTokenCount ?? 0, outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) } : undefined,
  };
  if (truncated) result.truncated = true;
  if (req.json) {
    const parsed = parseJsonLoose(text);
    if (parsed !== undefined) result.json = parsed;
  }
  return result;
}

/**
 * Gemini 3.8+ TTS models take the delivery style as parts[].speechMetadata.style and read `text`
 * verbatim; older ones (2.5 / 3.1 preview) reject that field, so the style goes into the prompt.
 */
export function geminiTtsUsesSpeechMetadata(model: string): boolean {
  const m = /gemini-(\d+)(?:\.(\d+))?/.exec(model);
  if (!m) return true; // unknown naming → assume a current model
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0);
  return major > 3 || (major === 3 && minor >= 8);
}

export function buildGeminiTtsBody(model: string, voice: string, req: TtsRequest, useSpeechMetadata = geminiTtsUsesSpeechMetadata(model)): Record<string, unknown> {
  const style = req.style?.trim() || DEFAULT_TTS_STYLE;
  const part: Record<string, unknown> = useSpeechMetadata
    ? { text: req.text, speechMetadata: { style } }
    : { text: `Say the following in ${style}: ${req.text}` };
  return {
    contents: [{ role: 'user', parts: [part] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
}

async function tts(config: ProviderConfig, req: TtsRequest): Promise<TtsResult> {
  const d = defaultsFor('gemini');
  const model = geminiModelId(config.ttsModel || d.ttsModel || '');
  const voice = req.voice || config.ttsVoice || d.ttsVoice || 'Kore';
  const ctx = ctxOf(config, model);
  const send = (useSpeechMetadata: boolean) =>
    sendJson({
      url: url(config, `models/${encodeURIComponent(model)}:generateContent`),
      headers: headers(config),
      body: buildGeminiTtsBody(model, voice, req, useSpeechMetadata),
      signal: req.signal,
      ctx,
      mapError: mapGeminiError,
    });
  let body: unknown;
  const modern = geminiTtsUsesSpeechMetadata(model);
  try {
    ({ body } = await send(modern));
  } catch (e) {
    // A model that does not know parts[].speechMetadata → put the style into the prompt instead.
    if (!modern || !isAiError(e) || e.status !== 400 || !/speech_?metadata|unknown name/i.test(e.detail ?? '')) throw e;
    ({ body } = await send(false));
  }
  const cand = firstCandidate((body ?? {}) as GeminiResponse, ctx);
  const part = cand.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    throw makeError('bad-response', { ...ctx, provider: 'gemini', detail: `không có dữ liệu âm thanh (finishReason=${cand.finishReason ?? '?'})` });
  }
  try {
    return audioBlobFromBase64(part.inlineData.data, part.inlineData.mimeType);
  } catch {
    throw makeError('bad-response', { ...ctx, provider: 'gemini', detail: 'âm thanh base64 hỏng' });
  }
}

async function listModels(config: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
  const ctx = ctxOf(config, config.model);
  const out: ModelInfo[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const q = `models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const { body } = await sendJson({ url: url(config, q), headers: headers(config), signal, ctx, mapError: mapGeminiError });
    const b = (body ?? {}) as { models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[]; nextPageToken?: string };
    for (const m of b.models ?? []) {
      if (!m.name || !m.supportedGenerationMethods?.includes('generateContent')) continue;
      const id = geminiModelId(m.name);
      out.push({ id, label: m.displayName || id, kind: /tts/i.test(id) ? 'tts' : 'text' });
    }
    if (!b.nextPageToken) break;
    pageToken = b.nextPageToken;
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** GET models/{model}: validates key and model without spending tokens. */
async function testConnection(config: ProviderConfig, signal?: AbortSignal): Promise<TestResult> {
  const model = geminiModelId(config.model);
  const ctx = ctxOf(config, model);
  if (!config.apiKey) return { ok: false, code: 'bad-key', message: 'Chưa nhập API key Gemini.' };
  try {
    await sendJson({ url: url(config, `models/${encodeURIComponent(model)}`), headers: headers(config), signal, ctx, mapError: mapGeminiError });
    return { ok: true, message: `Kết nối ${labelInSentence(ctx.label)} thành công (model ${model}).` };
  } catch (e) {
    return testFailure(e, ctx);
  }
}

export const geminiAdapter: AiAdapter = {
  kind: 'gemini',
  capabilities(config: ProviderConfig): Capabilities {
    return { text: true, json: true, tts: !!(config.ttsModel || defaultsFor('gemini').ttsModel), listModels: true };
  },
  generateText,
  tts,
  listModels,
  testConnection,
};
