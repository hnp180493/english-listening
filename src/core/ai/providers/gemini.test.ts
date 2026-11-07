import { afterEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_KEY, json, mockFetch, sequence } from '../aiTestUtils';
import { createProviderConfig } from '../config';
import { AiError } from '../errors';
import type { JsonSchema, ProviderConfig } from '../types';
import { pcmToWav } from '../wav';
import { buildGeminiTtsBody, geminiAdapter, geminiTtsUsesSpeechMetadata } from './gemini';

const cfg: ProviderConfig = createProviderConfig('gemini', { id: 'g', apiKey: GEMINI_KEY });
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function ok(text: string, extra: Record<string, unknown> = {}) {
  return json(200, {
    candidates: [{ content: { role: 'model', parts: [{ text: 'thinking…', thought: true }, { text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 3 },
    modelVersion: 'gemini-3.6-flash',
    ...extra,
  });
}

async function caught(p: Promise<unknown>): Promise<AiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AiError);
    expect(JSON.stringify({ ...(e as object), message: (e as Error).message })).not.toContain(GEMINI_KEY);
    return e as AiError;
  }
  throw new Error('expected rejection');
}

describe('gemini generateText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the documented request shape with the key only in x-goog-api-key', async () => {
    const calls = mockFetch(() => ok('Hello'));
    const r = await geminiAdapter.generateText(cfg, {
      system: 'Be brief.',
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hey' },
        { role: 'user', content: 'Again' },
      ],
      temperature: 0.4,
      maxTokens: 256,
    });
    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.url).toBe(`${BASE}/models/gemini-3.6-flash:generateContent`);
    expect(c.url).not.toContain(GEMINI_KEY);
    expect(c.method).toBe('POST');
    // Only the two headers Google's CORS preflight allows.
    expect(c.headers).toEqual({ 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY });
    expect(c.init.credentials).toBe('omit');
    expect(c.body).toEqual({
      contents: [
        { role: 'user', parts: [{ text: 'Hi' }] },
        { role: 'model', parts: [{ text: 'Hey' }] },
        { role: 'user', parts: [{ text: 'Again' }] },
      ],
      systemInstruction: { parts: [{ text: 'Be brief.' }] },
      generationConfig: { temperature: 0.4, maxOutputTokens: 256 },
    });
    expect(r).toEqual({ text: 'Hello', model: 'gemini-3.6-flash', usage: { inputTokens: 12, outputTokens: 8 } });
  });

  it('requests JSON via responseMimeType + responseJsonSchema and parses it', async () => {
    const schema: JsonSchema = { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] };
    const calls = mockFetch(() => ok('{"a": 7}'));
    const r = await geminiAdapter.generateText({ ...cfg, model: 'models/gemini-3.5-flash-lite' }, { messages: [{ role: 'user', content: 'x' }], json: { schema, name: 'r' } });
    expect(calls[0].url).toBe(`${BASE}/models/gemini-3.5-flash-lite:generateContent`);
    expect((calls[0].body as { generationConfig: unknown }).generationConfig).toEqual({ responseMimeType: 'application/json', responseJsonSchema: schema });
    expect(r.json).toEqual({ a: 7 });
  });

  it('maps prompt blocks and safety finish reasons to "safety"', async () => {
    mockFetch(() => json(200, { promptFeedback: { blockReason: 'SAFETY' } }));
    expect((await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }))).code).toBe('safety');
    mockFetch(() => json(200, { candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] }));
    expect((await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }))).code).toBe('safety');
  });

  it('reports MAX_TOKENS with no text and empty candidates as bad-response', async () => {
    mockFetch(() => json(200, { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }] }, finishReason: 'MAX_TOKENS' }] }));
    const e = await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }));
    expect(e.code).toBe('bad-response');
    expect(e.message).toContain('maxTokens');
    mockFetch(() => json(200, { candidates: [] }));
    expect((await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }))).code).toBe('bad-response');
  });

  it.each([
    [400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, 'bad-key'],
    [403, { error: { code: 403, message: 'Requests from referer <empty> are blocked.', status: 'PERMISSION_DENIED' } }, 'bad-key'],
    [404, { error: { code: 404, message: 'models/gemini-x is not found for API version v1beta', status: 'NOT_FOUND' } }, 'model'],
    [400, { error: { code: 400, message: 'User location is not supported for the API use.', status: 'FAILED_PRECONDITION' } }, 'bad-request'],
    [400, { error: { code: 400, message: 'Invalid JSON payload received.', status: 'INVALID_ARGUMENT' } }, 'bad-request'],
    [500, { error: { code: 500, message: 'Internal error', status: 'INTERNAL' } }, 'server'],
    [503, { error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } }, 'server'],
  ])('maps HTTP %i to the right code', async (status, body, code) => {
    mockFetch(() => json(status, body));
    const e = await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }));
    expect(e.code).toBe(code);
    expect(e.status).toBe(status);
    expect(e.provider).toBe('gemini');
  });

  it('maps 429 to rate-limit with RetryInfo delay, or quota when a per-day quota is exhausted', async () => {
    mockFetch(() =>
      json(429, {
        error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Resource exhausted', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '7s' }] },
      }),
    );
    let e = await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }));
    expect(e.code).toBe('rate-limit');
    expect(e.retryAfterMs).toBe(7000);
    expect(e.retryable).toBe(true);

    mockFetch(() => json(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }, { 'retry-after': '3' }));
    e = await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }));
    expect(e.retryAfterMs).toBe(3000);

    mockFetch(() =>
      json(429, {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'You exceeded your current quota',
          details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }],
        },
      }),
    );
    e = await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }));
    expect(e.code).toBe('quota');
    expect(e.retryable).toBe(false);
  });

  it('maps a rejected fetch to network', async () => {
    mockFetch(() => new TypeError('Failed to fetch'));
    expect((await caught(geminiAdapter.generateText(cfg, { messages: [{ role: 'user', content: 'x' }] }))).code).toBe('network');
  });
});

describe('gemini tts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses speechMetadata.style for 3.8+ models and a prompt prefix for older ones', () => {
    expect(geminiTtsUsesSpeechMetadata('gemini-3.8-flash-tts')).toBe(true);
    expect(geminiTtsUsesSpeechMetadata('gemini-4-flash-tts')).toBe(true);
    expect(geminiTtsUsesSpeechMetadata('gemini-3.1-flash-tts-preview')).toBe(false);
    expect(geminiTtsUsesSpeechMetadata('gemini-2.5-flash-preview-tts')).toBe(false);
    expect(buildGeminiTtsBody('gemini-2.5-flash-preview-tts', 'Puck', { text: 'Hi there', style: 'slow and clear' })).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'Say the following in slow and clear: Hi there' }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } } },
    });
  });

  it('posts to the TTS model and converts base64 PCM to a WAV blob at the reported rate', async () => {
    const pcm = new Uint8Array([1, 0, 2, 0, 3, 0]);
    const calls = mockFetch(() =>
      json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: btoa(String.fromCharCode(...pcm)) } }] }, finishReason: 'STOP' }] }),
    );
    const r = await geminiAdapter.tts!(cfg, { text: 'Gotta go.', style: 'natural conversational American English, normal speed' });
    expect(calls[0].url).toBe(`${BASE}/models/gemini-3.8-flash-tts:generateContent`);
    expect(calls[0].headers).toEqual({ 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY });
    expect(calls[0].body).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'Gotta go.', speechMetadata: { style: 'natural conversational American English, normal speed' } }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
    });
    expect(r.mime).toBe('audio/wav');
    const bytes = new Uint8Array(await r.audio.arrayBuffer());
    expect([...bytes]).toEqual([...pcmToWav(pcm, { sampleRate: 24000, channels: 1, bitsPerSample: 16 })]);
  });

  it('retries with the style in the prompt when a model rejects speechMetadata', async () => {
    const pcm = btoa('\x01\x00');
    const calls = mockFetch(
      sequence(
        json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload received. Unknown name "speechMetadata" at \'contents[0].parts[0]\': Cannot find field.' } }),
        json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: pcm } }] } }] }),
      ),
    );
    const r = await geminiAdapter.tts!(cfg, { text: 'Hi', style: 'warm' });
    expect(calls).toHaveLength(2);
    expect((calls[1].body as { contents: { parts: unknown[] }[] }).contents[0].parts[0]).toEqual({ text: 'Say the following in warm: Hi' });
    expect(r.mime).toBe('audio/wav');
  });

  it('passes WAV through and fails cleanly without audio', async () => {
    const wav = pcmToWav(new Uint8Array([9, 9]));
    mockFetch(() => json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: btoa(String.fromCharCode(...wav)) } }] } }] }));
    const r = await geminiAdapter.tts!(cfg, { text: 'x', voice: 'Puck' });
    expect([...new Uint8Array(await r.audio.arrayBuffer())]).toEqual([...wav]);

    mockFetch(() => json(200, { candidates: [{ content: { parts: [{ text: 'no audio' }] }, finishReason: 'OTHER' }] }));
    expect((await caught(geminiAdapter.tts!(cfg, { text: 'x' }))).code).toBe('bad-response');
  });
});

describe('gemini listModels / testConnection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists generateContent-capable models across pages', async () => {
    const calls = mockFetch(
      sequence(
        json(200, {
          models: [
            { name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
            { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
          ],
          nextPageToken: 'p2',
        }),
        json(200, { models: [{ name: 'models/gemini-3.8-flash-tts', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] }] }),
      ),
    );
    const list = await geminiAdapter.listModels!(cfg);
    expect(list).toEqual([
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', kind: 'text' },
      { id: 'gemini-3.8-flash-tts', label: 'TTS', kind: 'tts' },
    ]);
    expect(calls[0].url).toBe(`${BASE}/models?pageSize=1000`);
    expect(calls[1].url).toBe(`${BASE}/models?pageSize=1000&pageToken=p2`);
    expect(calls[0].method).toBe('GET');
    expect(calls.every((c) => !c.url.includes(GEMINI_KEY))).toBe(true);
  });

  it('testConnection GETs the model, never throws, and never leaks the key', async () => {
    const calls = mockFetch(() => json(200, { name: 'models/gemini-3.6-flash' }));
    expect(await geminiAdapter.testConnection(cfg)).toEqual({ ok: true, message: 'Kết nối Google Gemini thành công (model gemini-3.6-flash).' });
    expect(calls[0].url).toBe(`${BASE}/models/gemini-3.6-flash`);

    mockFetch(() => json(400, { error: { message: `API key not valid: ${GEMINI_KEY}`, details: [{ reason: 'API_KEY_INVALID' }] } }));
    const bad = await geminiAdapter.testConnection(cfg);
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('bad-key');
    expect(bad.message).not.toContain(GEMINI_KEY);

    expect((await geminiAdapter.testConnection({ ...cfg, apiKey: '' })).ok).toBe(false);
  });
});
