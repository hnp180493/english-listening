// Anthropic Claude (Messages API). Docs (checked 2026-11-06):
// https://platform.claude.com/docs/en/api/messages , .../api/errors , .../api/versioning ,
// .../build-with-claude/structured-outputs , .../manage-claude/authentication#browser-based-applications
//
// - anthropic-version 2026-10-21: temperature/top_p/top_k were REMOVED (400 if sent) → never sent.
// - Browser calls need `anthropic-dangerous-direct-browser-access: true` (CORS). Organizations with
//   ZDR / Compliance API get 401 "CORS requests are not allowed for this Organization" → code 'cors'.
// - JSON: output_config.format json_schema (GA, primary). Only if a model rejects output_config:
//   one forced tool whose input_schema is the schema (older models; Opus/Sonnet 5.5 reject
//   forced tool_choice), and if that is rejected too, a prompt instruction + local validation.
// - Reasoning: thinking is on by default (Haiku 5.5: adaptive) and thinking tokens count toward
//   max_tokens. req.reasoning 'low' → output_config.effort 'low'; 'off' → also
//   thinking {type:'disabled'} (Haiku 5.5 accepts it; Sonnet/Opus 5.5 answer 400 → resent without).
// - Auth: the key goes in `x-api-key` (still supported; the docs now lead with
//   `Authorization: Bearer`, both pass CORS). Keys not scoped to a workspace need an
//   anthropic-workspace-id header; we map that 400 to a Vietnamese hint to create a
//   workspace-scoped key instead.
// - No TTS.

import { defaultsFor, effectiveBaseUrl } from '../defaults';
import { isAiError, makeError, TRUNCATED_DETAIL, type AiError, labelInSentence } from '../errors';
import { joinUrl, mapCommonStatus, parseRetryAfter, providerMessage, sendJson, type CallContext } from '../http';
import { jsonInstruction, parseJsonLoose, sanitizeSchemaName, toClosedSchema } from '../schema';
import type { AiAdapter, ModelInfo, ProviderConfig, TestResult, TextRequest, TextResult } from '../types';
import { testFailure } from './common';

export const ANTHROPIC_VERSION = '2026-10-21';
const DEFAULT_MAX_TOKENS = 4096;

export type AnthropicJsonMode = 'format' | 'tool' | 'prompt';

/** Which reasoning controls a request may carry (dropped one by one when a model rejects them). */
export interface AnthropicReasoningOpts {
  thinking: boolean;
  effort: boolean;
}

function ctxOf(config: ProviderConfig, model: string): CallContext {
  return { kind: 'anthropic', label: config.label || defaultsFor('anthropic').label, model };
}

export function anthropicHeaders(config: ProviderConfig, withBody: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'x-api-key': config.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (withBody) h['content-type'] = 'application/json';
  return h;
}

export function mapAnthropicError(status: number, body: unknown, hdrs: Headers, ctx: CallContext): AiError {
  const detail = providerMessage(body);
  const type = String((body as { error?: { type?: unknown } } | undefined)?.error?.type ?? '');
  const msg = (detail ?? '').toLowerCase();
  const c = { ...ctx, provider: ctx.kind, status, detail };
  if (/cors requests are not allowed/.test(msg)) {
    return makeError('cors', { ...c, detail: 'Tổ chức Anthropic của bạn không cho phép gọi API trực tiếp từ trình duyệt (ZDR/Compliance API).' }, { retryable: false });
  }
  if (/not scoped to a workspace|anthropic-workspace-id/.test(msg)) {
    return makeError(
      'bad-request',
      { ...c, detail: 'Key Claude này không gắn với workspace nào. Vào Claude Console → API keys, tạo key mới và chọn một workspace cụ thể, rồi nhập lại key.' },
      { retryable: false },
    );
  }
  if (status === 401 || type === 'authentication_error') return makeError('bad-key', { ...c, detail: undefined });
  if (status === 402 || type === 'billing_error' || /spend limit|credit balance/.test(msg)) return makeError('quota', c, { retryable: false });
  if (status === 403 || type === 'permission_error') return makeError('bad-key', c);
  if (status === 404 || type === 'not_found_error' || (status === 400 && /model/.test(msg) && /not (found|supported)|invalid/.test(msg))) {
    return makeError('model', c);
  }
  if (status === 429 || type === 'rate_limit_error') return makeError('rate-limit', { ...c, detail: undefined, retryAfterMs: parseRetryAfter(hdrs) });
  if (status === 529 || type === 'overloaded_error') return makeError('server', c, { retryAfterMs: parseRetryAfter(hdrs) });
  return mapCommonStatus(status, ctx, detail, parseRetryAfter(hdrs));
}

function rejectsOutputFormat(e: AiError): boolean {
  return e.status === 400 && /output_config|output_format|json_schema|structured output/i.test(e.detail ?? '');
}

function rejectsForcedTool(e: AiError): boolean {
  return e.status === 400 && /tool_choice|tool use|forced/i.test(e.detail ?? '');
}

const ALL_REASONING: AnthropicReasoningOpts = { thinking: true, effort: true };

export function buildAnthropicBody(model: string, req: TextRequest, mode: AnthropicJsonMode, reasoning: AnthropicReasoningOpts = ALL_REASONING): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  let system = req.system ?? '';
  const outputConfig: Record<string, unknown> = {};
  if (req.reasoning === 'off' || req.reasoning === 'low') {
    if (reasoning.effort) outputConfig.effort = 'low';
    if (req.reasoning === 'off' && reasoning.thinking) body.thinking = { type: 'disabled' };
  }
  if (req.json) {
    const schema = toClosedSchema(req.json.schema);
    if (mode === 'format') {
      outputConfig.format = { type: 'json_schema', schema };
    } else if (mode === 'tool') {
      const name = sanitizeSchemaName(req.json.name);
      body.tools = [{ name, description: 'Return the final answer through this tool.', input_schema: schema }];
      body.tool_choice = { type: 'tool', name };
    } else {
      system = (system ? system + '\n\n' : '') + jsonInstruction(req.json.schema);
    }
  }
  if (system) body.system = system;
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;
  return body;
}

type Block = { type?: string; text?: string; input?: unknown };
type MessagesResponse = { content?: Block[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number }; model?: string };

export function parseAnthropicResponse(body: unknown, ctx: CallContext, model: string, req: TextRequest, mode: AnthropicJsonMode): TextResult {
  const res = (body ?? {}) as MessagesResponse;
  const blocks = res.content ?? [];
  if (res.stop_reason === 'refusal') throw makeError('safety', { ...ctx, provider: 'anthropic', detail: 'stop_reason=refusal' });
  const usage = res.usage ? { inputTokens: res.usage.input_tokens ?? 0, outputTokens: res.usage.output_tokens ?? 0 } : undefined;
  const truncated = res.stop_reason === 'max_tokens';
  if (truncated && req.json) throw makeError('bad-response', { ...ctx, provider: 'anthropic', detail: TRUNCATED_DETAIL }, { retryable: false });
  if (req.json && mode === 'tool') {
    const tool = blocks.find((b) => b.type === 'tool_use');
    if (tool && tool.input !== undefined) return { text: JSON.stringify(tool.input), json: tool.input, model: res.model || model, usage };
  }
  const text = blocks.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
  if (!text) {
    const detail = truncated ? TRUNCATED_DETAIL : `stop_reason=${res.stop_reason ?? '?'}`;
    throw makeError('bad-response', { ...ctx, provider: 'anthropic', detail }, { retryable: false });
  }
  const result: TextResult = { text, model: res.model || model, usage };
  if (truncated) result.truncated = true;
  if (req.json) {
    const parsed = parseJsonLoose(text);
    if (parsed !== undefined) result.json = parsed;
  }
  return result;
}

const base = (config: ProviderConfig) => effectiveBaseUrl('anthropic', config.baseUrl);

async function generateText(config: ProviderConfig, req: TextRequest): Promise<TextResult> {
  const model = config.model.trim();
  const ctx = ctxOf(config, model);
  let mode: AnthropicJsonMode = 'format';
  const reasoning: AnthropicReasoningOpts = { ...ALL_REASONING };
  const wantsReasoning = req.reasoning === 'off' || req.reasoning === 'low';
  for (let attempt = 0; ; attempt++) {
    try {
      const { body } = await sendJson({
        url: joinUrl(base(config), 'messages'),
        headers: anthropicHeaders(config, true),
        body: buildAnthropicBody(model, req, mode, reasoning),
        signal: req.signal,
        ctx,
        mapError: mapAnthropicError,
      });
      return parseAnthropicResponse(body, ctx, model, req, mode);
    } catch (e) {
      if (attempt >= 4 || !isAiError(e) || e.status !== 400) throw e;
      const d = e.detail ?? '';
      if (wantsReasoning && reasoning.thinking && req.reasoning === 'off' && /thinking/i.test(d)) reasoning.thinking = false;
      else if (wantsReasoning && reasoning.effort && /effort/i.test(d)) reasoning.effort = false;
      else if (req.json && mode === 'format' && rejectsOutputFormat(e)) mode = 'tool';
      else if (req.json && mode === 'tool' && rejectsForcedTool(e)) mode = 'prompt';
      else if (wantsReasoning && reasoning.effort && /output_config/i.test(d)) reasoning.effort = false;
      else throw e;
    }
  }
}

async function listModels(config: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
  const ctx = ctxOf(config, config.model);
  const { body } = await sendJson({ url: joinUrl(base(config), 'models?limit=1000'), headers: anthropicHeaders(config, false), signal, ctx, mapError: mapAnthropicError });
  const data = (body as { data?: { id?: unknown; display_name?: unknown }[] } | undefined)?.data ?? [];
  return data
    .filter((m): m is { id: string; display_name?: unknown } => typeof m?.id === 'string')
    .map((m) => ({ id: m.id, label: typeof m.display_name === 'string' && m.display_name ? m.display_name : m.id, kind: 'text' as const }));
}

/** GET /v1/models/{model}: validates key and model without spending tokens. */
async function testConnection(config: ProviderConfig, signal?: AbortSignal): Promise<TestResult> {
  const model = config.model.trim();
  const ctx = ctxOf(config, model);
  if (!config.apiKey) return { ok: false, code: 'bad-key', message: 'Chưa nhập API key Claude.' };
  try {
    await sendJson({ url: joinUrl(base(config), `models/${encodeURIComponent(model)}`), headers: anthropicHeaders(config, false), signal, ctx, mapError: mapAnthropicError });
    return { ok: true, message: `Kết nối ${labelInSentence(ctx.label)} thành công (model ${model}).` };
  } catch (e) {
    return testFailure(e, ctx);
  }
}

export const anthropicAdapter: AiAdapter = {
  kind: 'anthropic',
  capabilities: () => ({ text: true, json: true, tts: false, listModels: true }),
  generateText,
  listModels,
  testConnection,
};
