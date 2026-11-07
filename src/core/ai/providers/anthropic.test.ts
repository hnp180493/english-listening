import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANTHROPIC_KEY, json, mockFetch, sequence } from '../aiTestUtils';
import { createProviderConfig } from '../config';
import { AiError } from '../errors';
import type { JsonSchema } from '../types';
import { ANTHROPIC_VERSION, anthropicAdapter } from './anthropic';

const cfg = createProviderConfig('anthropic', { id: 'a', apiKey: ANTHROPIC_KEY });
const schema: JsonSchema = { type: 'object', properties: { words: { type: 'array', items: { type: 'string' }, minItems: 2 } }, required: ['words'] };
const msgs = [{ role: 'user' as const, content: 'Hi' }];

function message(content: unknown[], stop_reason = 'end_turn') {
  return json(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content, stop_reason, usage: { input_tokens: 20, output_tokens: 7 } });
}

async function caught(p: Promise<unknown>): Promise<AiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AiError);
    expect(JSON.stringify({ ...(e as object), message: (e as Error).message })).not.toContain(ANTHROPIC_KEY);
    return e as AiError;
  }
  throw new Error('expected rejection');
}

describe('anthropic messages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends browser-access + version headers, never temperature, joins text blocks', async () => {
    const calls = mockFetch(() => message([{ type: 'thinking', thinking: '…' }, { type: 'text', text: 'Hel' }, { type: 'text', text: 'lo' }]));
    const r = await anthropicAdapter.generateText(cfg, { system: 'S', messages: msgs, temperature: 0.9 });
    const c = calls[0];
    expect(c.url).toBe('https://api.anthropic.com/v1/messages');
    expect(c.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    expect(ANTHROPIC_VERSION).toBe('2026-10-21');
    expect(c.body).toEqual({ model: 'claude-haiku-5-5', max_tokens: 4096, system: 'S', messages: [{ role: 'user', content: 'Hi' }] });
    expect(r).toEqual({ text: 'Hello', model: 'claude-haiku-5-5', usage: { inputTokens: 20, outputTokens: 7 } });
  });

  it('asks for JSON via output_config.format with a closed schema', async () => {
    const calls = mockFetch(() => message([{ type: 'text', text: '{"words":["a","b"]}' }]));
    const r = await anthropicAdapter.generateText(cfg, { messages: msgs, maxTokens: 300, json: { schema, name: 'words' } });
    expect((calls[0].body as Record<string, unknown>).output_config).toEqual({
      format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['words'], properties: { words: { type: 'array', items: { type: 'string' } } } } },
    });
    expect((calls[0].body as Record<string, unknown>).max_tokens).toBe(300);
    expect(r.json).toEqual({ words: ['a', 'b'] });
  });

  it('falls back to a single forced tool when output_config is rejected', async () => {
    const calls = mockFetch(
      sequence(
        json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'output_config: Extra inputs are not permitted' } }),
        message([{ type: 'tool_use', id: 't1', name: 'words', input: { words: ['x', 'y'] } }], 'tool_use'),
      ),
    );
    const r = await anthropicAdapter.generateText(cfg, { messages: msgs, json: { schema, name: 'words' } });
    expect(calls).toHaveLength(2);
    const b = calls[1].body as Record<string, unknown>;
    expect(b.output_config).toBeUndefined();
    expect(b.tool_choice).toEqual({ type: 'tool', name: 'words' });
    expect((b.tools as { name: string; input_schema: unknown }[])[0]).toMatchObject({ name: 'words', input_schema: { type: 'object', additionalProperties: false } });
    expect(r.json).toEqual({ words: ['x', 'y'] });
  });

  it('maps refusal and max_tokens', async () => {
    mockFetch(() => message([], 'refusal'));
    expect((await caught(anthropicAdapter.generateText(cfg, { messages: msgs }))).code).toBe('safety');
    mockFetch(() => message([], 'max_tokens'));
    expect((await caught(anthropicAdapter.generateText(cfg, { messages: msgs }))).code).toBe('bad-response');
  });

  it.each([
    [401, 'authentication_error', 'invalid x-api-key', {}, 'bad-key'],
    [401, 'authentication_error', 'CORS requests are not allowed for this Organization because of its settings.', {}, 'cors'],
    [402, 'billing_error', 'Your credit balance is too low', {}, 'quota'],
    [403, 'permission_error', 'no access', {}, 'bad-key'],
    [404, 'not_found_error', 'model: claude-x', {}, 'model'],
    [400, 'invalid_request_error', 'You have reached your specified workspace spend limit', {}, 'quota'],
    [400, 'invalid_request_error', 'messages: bad', {}, 'bad-request'],
    [429, 'rate_limit_error', 'slow down', { 'retry-after': '4' }, 'rate-limit'],
    [500, 'api_error', 'oops', {}, 'server'],
    [529, 'overloaded_error', 'Overloaded', {}, 'server'],
  ])('maps HTTP %i %s', async (status, type, message, headers, code) => {
    mockFetch(() => json(status, { type: 'error', error: { type, message }, request_id: 'req_1' }, headers));
    const e = await caught(anthropicAdapter.generateText(cfg, { messages: msgs }));
    expect(e.code).toBe(code);
    if (code === 'rate-limit') {
      expect(e.retryAfterMs).toBe(4000);
      expect(e.retryable).toBe(true);
    }
    if (code === 'cors') expect(e.retryable).toBe(false);
  });

  it('has no TTS; lists models; tests a model by id', async () => {
    expect(anthropicAdapter.tts).toBeUndefined();
    expect(anthropicAdapter.capabilities(cfg).tts).toBe(false);
    mockFetch(() => json(200, { data: [{ id: 'claude-haiku-5-5', display_name: 'Claude Haiku 5.5', type: 'model' }] }));
    expect(await anthropicAdapter.listModels!(cfg)).toEqual([{ id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', kind: 'text' }]);
    const calls = mockFetch(() => json(200, { id: 'claude-haiku-5-5' }));
    expect((await anthropicAdapter.testConnection(cfg)).ok).toBe(true);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/models/claude-haiku-5-5');
    expect(calls[0].method).toBe('GET');
  });
});
