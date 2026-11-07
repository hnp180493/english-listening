import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPENAI_KEY, OPENROUTER_KEY, json, mockFetch, sequence } from '../aiTestUtils';
import { createProviderConfig } from '../config';
import { AiError } from '../errors';
import type { JsonSchema } from '../types';
import { openaiAdapter, openaiCompatibleAdapter, openrouterAdapter } from './openaiCompatible';

const openai = createProviderConfig('openai', { id: 'o', apiKey: OPENAI_KEY });
const openrouter = createProviderConfig('openrouter', { id: 'r', apiKey: OPENROUTER_KEY });
const local = createProviderConfig('openai-compatible', { id: 'l', baseUrl: 'http://localhost:1234/v1', model: 'llama-3.2-3b' });
const schema: JsonSchema = { type: 'object', properties: { a: { type: 'string' }, list: { type: 'array', items: { type: 'string' }, maxItems: 2 } }, required: ['a', 'list'] };
const msgs = [{ role: 'user' as const, content: 'Hi' }];

function chat(content: unknown, extra: Record<string, unknown> = {}) {
  return json(200, { model: 'gpt-6-luna-2026', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 4 }, ...extra });
}

async function caught(p: Promise<unknown>, secret = OPENAI_KEY): Promise<AiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AiError);
    const all = JSON.stringify({ ...(e as object), message: (e as Error).message });
    expect(all).not.toContain(secret);
    return e as AiError;
  }
  throw new Error('expected rejection');
}

describe('openai chat completions', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the documented shape (system message, max_completion_tokens, strict json_schema)', async () => {
    const calls = mockFetch(() => chat('{"a":"x","list":[]}'));
    const r = await openaiAdapter.generateText(openai, { system: 'S', messages: msgs, temperature: 0.2, maxTokens: 100, json: { schema, name: 'my result' } });
    const c = calls[0];
    expect(c.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(c.headers).toEqual({ 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` });
    expect(c.body).toEqual({
      model: 'gpt-6-luna',
      messages: [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'Hi' },
      ],
      temperature: 0.2,
      max_completion_tokens: 100,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'my_result',
          strict: true,
          schema: { type: 'object', additionalProperties: false, required: ['a', 'list'], properties: { a: { type: 'string' }, list: { type: 'array', items: { type: 'string' } } } },
        },
      },
    });
    expect(r).toEqual({ text: '{"a":"x","list":[]}', json: { a: 'x', list: [] }, model: 'gpt-6-luna-2026', usage: { inputTokens: 9, outputTokens: 4 } });
  });

  it('falls back json_schema → json_object → prompt instruction when the server rejects response_format', async () => {
    const reject = () => json(400, { error: { message: "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model.", type: 'invalid_request_error' } });
    const calls = mockFetch(sequence(reject, () => json(400, { error: { message: 'response_format json_object not supported' } }), chat('{"a":"y","list":["q"]}')));
    const r = await openaiCompatibleAdapter.generateText(local, { messages: msgs, json: { schema, name: 'r' } });
    expect(calls).toHaveLength(3);
    expect((calls[0].body as { response_format: { type: string } }).response_format.type).toBe('json_schema');
    expect((calls[1].body as { response_format: { type: string } }).response_format.type).toBe('json_object');
    expect((calls[1].body as { messages: { role: string; content: string }[] }).messages[0]).toMatchObject({ role: 'system' });
    expect((calls[1].body as { messages: { content: string }[] }).messages[0].content).toContain('JSON Schema');
    expect((calls[2].body as Record<string, unknown>).response_format).toBeUndefined();
    expect(r.json).toEqual({ a: 'y', list: ['q'] });
  });

  it('retries without temperature when a model rejects it', async () => {
    const calls = mockFetch(sequence(json(400, { error: { message: "Unsupported value: 'temperature' does not support 0.2 with this model." } }), chat('ok')));
    await openaiAdapter.generateText(openai, { messages: msgs, temperature: 0.2 });
    expect(calls).toHaveLength(2);
    expect((calls[1].body as Record<string, unknown>).temperature).toBeUndefined();
  });

  it('maps refusal / content_filter / length-without-text', async () => {
    mockFetch(() => json(200, { choices: [{ message: { content: null, refusal: "I can't help with that." }, finish_reason: 'stop' }] }));
    expect((await caught(openaiAdapter.generateText(openai, { messages: msgs }))).code).toBe('safety');
    mockFetch(() => json(200, { choices: [{ message: { content: '' }, finish_reason: 'content_filter' }] }));
    expect((await caught(openaiAdapter.generateText(openai, { messages: msgs }))).code).toBe('safety');
    mockFetch(() => json(200, { choices: [{ message: { content: '' }, finish_reason: 'length' }] }));
    expect((await caught(openaiAdapter.generateText(openai, { messages: msgs }))).code).toBe('bad-response');
  });

  it.each([
    [400, { error: { message: 'bad thing', type: 'invalid_request_error' } }, {}, 'bad-request'],
    [401, { error: { message: `Incorrect API key provided: ${OPENAI_KEY}.`, code: 'invalid_api_key' } }, {}, 'bad-key'],
    [403, { error: { message: 'Country not supported' } }, {}, 'bad-key'],
    [404, { error: { message: 'The model `gpt-x` does not exist', code: 'model_not_found' } }, {}, 'model'],
    [429, { error: { message: 'You exceeded your current quota', code: 'insufficient_quota' } }, {}, 'quota'],
    [429, { error: { message: 'Rate limit reached' } }, { 'retry-after': '2' }, 'rate-limit'],
    [500, { error: { message: 'oops' } }, {}, 'server'],
  ])('maps HTTP %i', async (status, body, headers, code) => {
    mockFetch(() => json(status, body, headers));
    const e = await caught(openaiAdapter.generateText(openai, { messages: msgs }));
    expect(e.code).toBe(code);
    expect(e.status).toBe(status);
    if (code === 'rate-limit') expect(e.retryAfterMs).toBe(2000);
  });
});

describe('openrouter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses max_tokens, Bearer key and ASCII attribution headers', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:5173' });
    const calls = mockFetch(() => chat('hey'));
    await openrouterAdapter.generateText(openrouter, { messages: msgs, maxTokens: 50 });
    const c = calls[0];
    expect(c.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(c.headers).toEqual({
      'content-type': 'application/json',
      authorization: `Bearer ${OPENROUTER_KEY}`,
      'x-openrouter-title': 'Nghe Noi Am',
      'http-referer': 'http://localhost:5173',
    });
    expect(c.body).toMatchObject({ model: 'google/gemini-3.6-flash', max_tokens: 50 });
  });

  it('omits HTTP-Referer on file:// and maps 402 and errors delivered with HTTP 200', async () => {
    vi.stubGlobal('location', { origin: 'null' });
    const calls = mockFetch(() => json(402, { error: { code: 402, message: 'Insufficient credits' } }));
    expect((await caught(openrouterAdapter.generateText(openrouter, { messages: msgs }), OPENROUTER_KEY)).code).toBe('quota');
    expect(calls[0].headers['http-referer']).toBeUndefined();

    mockFetch(() => json(200, { error: { code: 429, message: 'Provider rate limited' } }));
    expect((await caught(openrouterAdapter.generateText(openrouter, { messages: msgs }), OPENROUTER_KEY)).code).toBe('rate-limit');
    mockFetch(() => json(200, { choices: [{ error: { code: 502, message: 'upstream died' }, finish_reason: 'error' }] }));
    expect((await caught(openrouterAdapter.generateText(openrouter, { messages: msgs }), OPENROUTER_KEY)).code).toBe('server');
  });

  it('testConnection checks /key (the models list is public)', async () => {
    const calls = mockFetch(() => json(200, { data: { label: 'x' } }));
    expect((await openrouterAdapter.testConnection(openrouter)).ok).toBe(true);
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/key');
    expect(calls[0].headers['content-type']).toBeUndefined();
  });
});

describe('openai-compatible (local servers)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends no Authorization without a key and reports a failed fetch as cors', async () => {
    const calls = mockFetch(() => new TypeError('Failed to fetch'));
    const e = await caught(openaiCompatibleAdapter.generateText(local, { messages: msgs, maxTokens: 10 }));
    expect(e.code).toBe('cors');
    expect(e.message).toContain('CORS');
    expect(calls[0].url).toBe('http://localhost:1234/v1/chat/completions');
    expect(calls[0].headers.authorization).toBeUndefined();
    expect(calls[0].body).toMatchObject({ max_tokens: 10 });
  });

  it('requires a model and reports a missing model from testConnection', async () => {
    expect((await caught(openaiCompatibleAdapter.generateText({ ...local, model: '' }, { messages: msgs }))).code).toBe('model');
    mockFetch(() => json(200, { data: [{ id: 'qwen3' }, { id: 'gemma3' }] }));
    const t = await openaiCompatibleAdapter.testConnection(local);
    expect(t).toMatchObject({ ok: false, code: 'model' });
    expect(t.message).toContain('qwen3');
  });

  it('has no tts', () => {
    expect(openaiCompatibleAdapter.tts).toBeUndefined();
    expect(openaiCompatibleAdapter.capabilities(local).tts).toBe(false);
    expect(openrouterAdapter.tts).toBeUndefined();
  });
});

describe('openai tts + models', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts /audio/speech with instructions and returns an mp3 blob', async () => {
    const calls = mockFetch(() => new Response(new Uint8Array([0xff, 0xfb, 1, 2]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }));
    const r = await openaiAdapter.tts!(openai, { text: 'Whatcha doing?', style: 'casual' });
    expect(calls[0].url).toBe('https://api.openai.com/v1/audio/speech');
    expect(calls[0].body).toEqual({ model: 'gpt-4o-mini-tts', input: 'Whatcha doing?', voice: 'marin', response_format: 'mp3', instructions: 'casual' });
    expect(r.mime).toBe('audio/mpeg');
    expect(r.audio.size).toBe(4);
  });

  it('omits instructions for tts-1, rejects over-long input, maps errors from binary endpoint', async () => {
    const calls = mockFetch(() => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'application/octet-stream' } }));
    const r = await openaiAdapter.tts!({ ...openai, ttsModel: 'tts-1' }, { text: 'x' });
    expect((calls[0].body as Record<string, unknown>).instructions).toBeUndefined();
    expect(r.mime).toBe('audio/mpeg');
    expect((await caught(openaiAdapter.tts!(openai, { text: 'a'.repeat(4097) }))).code).toBe('bad-request');
    mockFetch(() => json(401, { error: { message: 'bad key', code: 'invalid_api_key' } }));
    expect((await caught(openaiAdapter.tts!(openai, { text: 'x' }))).code).toBe('bad-key');
  });

  it('lists chat-ish models and tests a model by id', async () => {
    mockFetch(() => json(200, { data: [{ id: 'gpt-6-luna' }, { id: 'text-embedding-3-small' }, { id: 'gpt-4o-mini-tts' }, { id: 'whisper-1' }] }));
    expect(await openaiAdapter.listModels!(openai)).toEqual([
      { id: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts', kind: 'tts' },
      { id: 'gpt-6-luna', label: 'gpt-6-luna', kind: 'text' },
    ]);
    const calls = mockFetch(() => json(200, { id: 'gpt-6-luna' }));
    expect((await openaiAdapter.testConnection(openai)).ok).toBe(true);
    expect(calls[0].url).toBe('https://api.openai.com/v1/models/gpt-6-luna');
  });
});
