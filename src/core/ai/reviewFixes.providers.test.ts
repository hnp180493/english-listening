// Regression tests for the provider-level review findings (verification round 2026-11-06).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANTHROPIC_KEY, GEMINI_KEY, OPENAI_KEY, OPENROUTER_KEY, json, mockFetch, sequence } from './aiTestUtils';
import { createProviderConfig } from './config';
import { AiError } from './errors';
import { anthropicAdapter, buildAnthropicBody } from './providers/anthropic';
import { buildGeminiTextBody, geminiAdapter } from './providers/gemini';
import { buildChatBody, openAiTtsRetired, openaiAdapter, openrouterAdapter } from './providers/openaiCompatible';
import type { JsonObjectSchema, ReasoningLevel } from './types';

const msgs = [{ role: 'user' as const, content: 'Hi' }];

async function caught(p: Promise<unknown>, secret: string): Promise<AiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AiError);
    expect(JSON.stringify({ ...(e as object), message: (e as Error).message })).not.toContain(secret);
    return e as AiError;
  }
  throw new Error('expected rejection');
}

const geminiOk = () => json(200, { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] });
const chatOk = () => json(200, { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('OpenAI /audio/speech shutdown on 2027-01-06 (round 1 F1)', () => {
  const cfg = createProviderConfig('openai', { id: 'o', apiKey: OPENAI_KEY });

  it('reports tts: false and refuses before sending once the date has passed', async () => {
    expect(openAiTtsRetired('gpt-4o-mini-tts', Date.UTC(2027, 0, 5))).toBe(false);
    expect(openAiTtsRetired('gpt-4o-mini-tts-2025-12-15', Date.UTC(2027, 0, 6))).toBe(true);
    expect(openAiTtsRetired('tts-1-hd', Date.UTC(2027, 5, 1))).toBe(true);
    expect(openAiTtsRetired('some-future-tts', Date.UTC(2027, 5, 1))).toBe(false);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T00:00:00Z'));
    expect(openaiAdapter.capabilities(cfg).tts).toBe(true);
    vi.setSystemTime(new Date('2027-01-06T00:00:01Z'));
    expect(openaiAdapter.capabilities(cfg).tts).toBe(false);
    const calls = mockFetch(() => json(200, {}));
    const e = await caught(openaiAdapter.tts!(cfg, { text: 'hi' }), OPENAI_KEY);
    expect(e.code).toBe('model');
    expect(e.message).toContain('2027-01-06');
    expect(calls).toHaveLength(0);
  });

  it('a 404 for a retired speech model explains the shutdown', async () => {
    mockFetch(() => json(404, { error: { message: 'The model `gpt-4o-mini-tts` does not exist', code: 'model_not_found' } }));
    const e = await caught(openaiAdapter.tts!(cfg, { text: 'hi' }), OPENAI_KEY);
    expect(e.code).toBe('model');
    expect(e.message).toContain('không có model thay thế');
  });
});

describe('reasoning control (round 1 F3)', () => {
  const req = (reasoning?: ReasoningLevel) => ({ messages: msgs, reasoning });

  it('maps reasoning off/low per provider and leaves the default untouched', () => {
    expect(buildGeminiTextBody(req('off')).generationConfig).toEqual({ thinkingConfig: { thinkingLevel: 'MINIMAL' } });
    expect(buildGeminiTextBody(req('low')).generationConfig).toEqual({ thinkingConfig: { thinkingLevel: 'LOW' } });
    expect(buildGeminiTextBody(req('default')).generationConfig).toBeUndefined();
    expect(buildChatBody('openai', 'm', req('off'), 'schema', true).reasoning_effort).toBe('none');
    expect(buildChatBody('openai', 'm', req('low'), 'schema', true).reasoning_effort).toBe('low');
    expect(buildChatBody('openrouter', 'm', req('off'), 'schema', true).reasoning).toEqual({ effort: 'none' });
    expect(buildChatBody('openai-compatible', 'm', req('off'), 'schema', true)).not.toHaveProperty('reasoning');
    expect(buildChatBody('openai', 'm', req(), 'schema', true)).not.toHaveProperty('reasoning_effort');
    const a = buildAnthropicBody('claude-haiku-5-5', req('off'), 'format');
    expect(a.thinking).toEqual({ type: 'disabled' });
    expect(a.output_config).toEqual({ effort: 'low' });
    expect(buildAnthropicBody('m', req('low'), 'format')).not.toHaveProperty('thinking');
    expect(buildAnthropicBody('m', req(), 'format')).not.toHaveProperty('output_config');
  });

  it('drops the control when a model rejects it', async () => {
    let calls = mockFetch(sequence(json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Thinking level is not supported for this model.' } }), geminiOk()));
    await geminiAdapter.generateText(createProviderConfig('gemini', { apiKey: GEMINI_KEY }), { messages: msgs, reasoning: 'off' });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).not.toHaveProperty('generationConfig');

    calls = mockFetch(sequence(json(400, { error: { message: "Unsupported parameter: 'reasoning_effort' is not supported with this model.", type: 'invalid_request_error' } }), chatOk()));
    await openaiAdapter.generateText(createProviderConfig('openai', { apiKey: OPENAI_KEY, model: 'gpt-4o-mini' }), { messages: msgs, reasoning: 'off' });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).not.toHaveProperty('reasoning_effort');

    calls = mockFetch(
      sequence(
        json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'thinking.type: "disabled" is not supported for this model. Use "between_tools".' } }),
        json(200, { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }),
      ),
    );
    await anthropicAdapter.generateText(createProviderConfig('anthropic', { apiKey: ANTHROPIC_KEY, model: 'claude-sonnet-5-5' }), { messages: msgs, reasoning: 'off' });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).not.toHaveProperty('thinking');
    expect((calls[1].body as { output_config: unknown }).output_config).toEqual({ effort: 'low' });
  });
});

describe('Anthropic JSON fallbacks and workspace keys (round 1 F4, F5)', () => {
  const cfg = createProviderConfig('anthropic', { apiKey: ANTHROPIC_KEY });

  it('output_config rejected → forced tool rejected → prompt instruction', async () => {
    const calls = mockFetch(
      sequence(
        json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'output_config: Extra inputs are not permitted' } }),
        json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'tool_choice: type "tool" is not supported for this model' } }),
        json(200, { content: [{ type: 'text', text: '{"n":1}' }], stop_reason: 'end_turn' }),
      ),
    );
    const schema: JsonObjectSchema = { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] };
    const r = await anthropicAdapter.generateText(cfg, { messages: msgs, json: { schema, name: 'r' } });
    expect(r.json).toEqual({ n: 1 });
    expect(calls).toHaveLength(3);
    const last = calls[2].body as Record<string, unknown>;
    expect(last).not.toHaveProperty('tool_choice');
    expect(last).not.toHaveProperty('output_config');
    expect(String(last.system)).toContain('JSON Schema');
  });

  it('a key not scoped to a workspace gets a Vietnamese hint', async () => {
    mockFetch(() =>
      json(400, {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message:
            'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace.',
        },
      }),
    );
    const e = await caught(anthropicAdapter.generateText(cfg, { messages: msgs }), ANTHROPIC_KEY);
    expect(e.code).toBe('bad-request');
    expect(e.retryable).toBe(false);
    expect(e.message).toContain('workspace cụ thể');
  });
});

describe('OpenRouter 403 (round 1 F6)', () => {
  const cfg = createProviderConfig('openrouter', { apiKey: OPENROUTER_KEY });

  it('a guardrail/permission 403 is not "bad key"; moderation metadata is safety; 401 stays bad-key', async () => {
    mockFetch(() => json(403, { error: { code: 403, message: 'Request blocked by guardrail: provider not allowed', metadata: { error_type: 'permission_denied' } } }));
    let e = await caught(openrouterAdapter.generateText(cfg, { messages: msgs }), OPENROUTER_KEY);
    expect(e.code).toBe('bad-request');
    expect(e.message).toContain('guardrail');
    mockFetch(() => json(403, { error: { code: 403, message: 'Input was rejected', metadata: { reasons: ['harassment'], flagged_input: 'xyz', provider_name: 'OpenAI' } } }));
    e = await caught(openrouterAdapter.generateText(cfg, { messages: msgs }), OPENROUTER_KEY);
    expect(e.code).toBe('safety');
    mockFetch(() => json(401, { error: { code: 401, message: 'No auth credentials found' } }));
    expect((await caught(openrouterAdapter.generateText(cfg, { messages: msgs }), OPENROUTER_KEY)).code).toBe('bad-key');
  });
});
