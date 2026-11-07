// Regression tests for the review findings on the AI layer (verification round 2026-11-06).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANTHROPIC_KEY, GEMINI_KEY, OPENAI_KEY, OPENROUTER_KEY, json, mockFetch, sequence, stubStorage } from './aiTestUtils';
import type { JsonSchema, ProviderConfig, ProviderKind } from './types';

async function load() {
  vi.resetModules();
  const client = await import('./client');
  const config = await import('./config');
  const usage = await import('./usage');
  const errors = await import('./errors');
  const ttsCache = await import('./ttsCache');
  const sleeps: number[] = [];
  client._setAiRuntimeForTests({
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    cache: ttsCache.createMemoryTtsCache(),
  });
  return { client, config, usage, errors, ttsCache, sleeps };
}
type Loaded = Awaited<ReturnType<typeof load>>;

const KEYS: Record<ProviderKind, string> = { gemini: GEMINI_KEY, openai: OPENAI_KEY, anthropic: ANTHROPIC_KEY, openrouter: OPENROUTER_KEY, 'openai-compatible': '' };

function setup(l: Loaded, kind: ProviderKind = 'gemini', patch: Partial<ProviderConfig> = {}) {
  const p = l.config.createProviderConfig(kind, { id: kind, apiKey: KEYS[kind], model: kind === 'openai-compatible' ? 'llama' : undefined, ...patch });
  l.config.saveAiConfig({ v: 1, providers: [p], defaultTextProvider: p.id, defaultTtsProvider: p.id });
  return p;
}

const msgs = [{ role: 'user' as const, content: 'Hi' }];

async function caught(p: Promise<unknown>, ...secrets: string[]) {
  try {
    await p;
  } catch (e) {
    const all = JSON.stringify({ ...(e as object), message: (e as Error)?.message, stack: (e as Error)?.stack });
    for (const s of secrets) expect(all).not.toContain(s);
    return e as Error & { code: string; status?: number; retryAfterMs?: number; retryable: boolean; detail?: string };
  }
  throw new Error('expected rejection');
}

const geminiText = (text: string, finishReason = 'STOP') =>
  json(200, { candidates: [{ content: { parts: [{ text }] }, finishReason }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } });

/** Google's real RESOURCE_EXHAUSTED wording (same text for per-minute and per-day quotas). */
const GOOGLE_QUOTA_MSG =
  'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.';
function gemini429(quotaId: string, retryDelay = '7s') {
  return json(429, {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: GOOGLE_QUOTA_MSG,
      details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId }] },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
      ],
    },
  });
}

beforeEach(() => stubStorage());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Gemini 429: per-minute vs per-day decided by quotaId (round 2 F1)', () => {
  it('a per-minute quota with Google\'s "billing" wording is a retryable rate limit', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(sequence(gemini429('GenerateRequestsPerMinutePerProjectPerModel-FreeTier'), geminiText('ok')));
    expect((await l.client.aiText({ messages: msgs })).text).toBe('ok');
    expect(calls).toHaveLength(2);
    expect(l.sleeps).toEqual([7000]);
  });

  it('a per-day quota is quota (not retried); text only decides when no quotaId exists', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(() => gemini429('GenerateRequestsPerDayPerProjectPerModel-FreeTier'));
    const e = await caught(l.client.aiText({ messages: msgs }), GEMINI_KEY);
    expect(e.code).toBe('quota');
    expect(calls).toHaveLength(1);
    const { geminiQuotaIsDaily } = await import('./providers/gemini');
    expect(geminiQuotaIsDaily([], GOOGLE_QUOTA_MSG.toLowerCase())).toBe(false);
    expect(geminiQuotaIsDaily([], 'quota exceeded for requests per day')).toBe(true);
  });
});

describe('keys never leak, whatever their format or length (round 2 F2)', () => {
  it('testProvider / listProviderModels with an unsaved prefix-less key echoed by a local server', async () => {
    const l = await load();
    const secret = 'lmstudio-local-secret-77';
    const p = l.config.createProviderConfig('openai-compatible', { apiKey: secret, baseUrl: 'http://localhost:1234/v1', model: 'm' });
    mockFetch(() => json(403, { error: { message: `Token ${secret} is not authorized for this server` } }));
    const t = await l.client.testProvider(p);
    expect(t.ok).toBe(false);
    expect(JSON.stringify(t)).not.toContain(secret);
    const e = await caught(l.client.listProviderModels(p), secret);
    expect(e.code).toBe('bad-key');
  });

  it('a short saved key echoed in a 400 body', async () => {
    const l = await load();
    setup(l, 'openai-compatible', { apiKey: 'qwe7890' });
    mockFetch(() => json(400, { error: { message: 'bad token qwe7890 for model m' } }));
    const e = await caught(l.client.aiText({ messages: msgs }), 'qwe7890');
    expect(e.code).toBe('bad-request');
    expect(e.message).toContain('[đã ẩn]');
  });

  it('an OpenRouter error delivered with HTTP 200 is scrubbed too', async () => {
    const l = await load();
    setup(l, 'openrouter', { apiKey: 'shortkey12' });
    mockFetch(() => json(200, { error: { code: 400, message: 'key shortkey12 cannot use this model' } }));
    await caught(l.client.aiText({ messages: msgs }), 'shortkey12');
  });
});

describe('keys with non-header characters (round 2 F3)', () => {
  it('a masked key pasted back is bad-key, not a retried network error, and no request is sent', async () => {
    const l = await load();
    setup(l, 'gemini', { apiKey: 'AIza…k3Fq' });
    const calls = mockFetch(() => geminiText('never'));
    const e = await caught(l.client.aiText({ messages: msgs }));
    expect(e.code).toBe('bad-key');
    expect(e.retryable).toBe(false);
    expect(e.message).toContain('…');
    expect(calls).toHaveLength(0);
    expect(l.sleeps).toEqual([]);
    const { keyLooksWrong } = await import('./defaults');
    expect(keyLooksWrong('gemini', 'AIza…k3Fq')).toBe(true);
    expect(keyLooksWrong('openai-compatible', 'tokén')).toBe(true);
    expect(keyLooksWrong('openai-compatible', 'token-123')).toBe(false);
  });

  it('zero-width / BOM characters are stripped from keys on save', async () => {
    const l = await load();
    expect(l.config.cleanKey('﻿tok​n-secret­-1234 \n')).toBe('tokn-secret-1234');
    const p = setup(l, 'openai-compatible', { apiKey: 'tok​n-secret-1234' });
    expect(l.config.loadAiConfig().providers[0].apiKey).toBe('tokn-secret-1234');
    expect(p.apiKey).toBe('tokn-secret-1234');
  });
});

describe('answers cut off by maxTokens (round 2 F4)', () => {
  it('aiText marks partial Gemini text as truncated', async () => {
    const l = await load();
    setup(l);
    mockFetch(() => geminiText('The answer is that the sentence', 'MAX_TOKENS'));
    const r = await l.client.aiText({ messages: msgs, maxTokens: 8 });
    expect(r).toMatchObject({ text: 'The answer is that the sentence', truncated: true });
  });

  it.each<[ProviderKind, () => Response]>([
    ['gemini', () => geminiText('{"n": [1, 2', 'MAX_TOKENS')],
    ['openai', () => json(200, { choices: [{ message: { content: '{"n": [1, 2' }, finish_reason: 'length' }] })],
    ['anthropic', () => json(200, { content: [{ type: 'text', text: '{"n": [1, 2' }], stop_reason: 'max_tokens' })],
  ])('%s: aiJson fails at once with the maxTokens hint (no paid repair round)', async (kind, res) => {
    const l = await load();
    setup(l, kind);
    const calls = mockFetch(res);
    const schema: JsonSchema = { type: 'object', properties: { n: { type: 'array', items: { type: 'integer' } } }, required: ['n'] };
    const e = await caught(l.client.aiJson({ messages: msgs, maxTokens: 10, json: { schema, name: 'r' } }), KEYS[kind] || 'x-no-key');
    expect(e.code).toBe('bad-response');
    expect(e.message).toContain('maxTokens');
    expect(calls).toHaveLength(1);
  });
});

describe('non-object JSON roots (round 2 F5)', () => {
  it('aiJson wraps an array root as {value} for the provider and unwraps the answer', async () => {
    const l = await load();
    setup(l, 'openai');
    const calls = mockFetch(() => json(200, { choices: [{ message: { content: '{"value":["a","b"]}' }, finish_reason: 'stop' }] }));
    const v = await l.client.aiJson<string[]>({ messages: msgs, json: { name: 'list', schema: { type: 'array', items: { type: 'string' } } } });
    expect(v).toEqual(['a', 'b']);
    const rf = (calls[0].body as { response_format: { json_schema: { schema: { type: string; required: string[] } } } }).response_format;
    expect(rf.json_schema.schema).toMatchObject({ type: 'object', required: ['value'], properties: { value: { type: 'array' } } });
    expect(calls).toHaveLength(1);
  });

  it('tolerates a bare value (prompt-mode servers) and still validates against the original schema', async () => {
    const l = await load();
    setup(l, 'gemini');
    mockFetch(() => geminiText('["x"]'));
    expect(await l.client.aiJson({ messages: msgs, json: { name: 'list', schema: { type: 'array', items: { type: 'string' } } } })).toEqual(['x']);
  });
});

describe('aiSpeak cache robustness and de-duplication (round 2 F6)', () => {
  const audio = () => json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: btoa('\x01\x00'.repeat(12000)) } }] } }] }); // 0.5 s
  const hangingCache = () => ({
    backend: 'indexeddb' as const,
    get: () => new Promise<undefined>(() => {}),
    put: () => new Promise<void>(() => {}),
    clear: async () => {},
    stats: async () => ({ entries: 0, bytes: 0, backend: 'indexeddb' as const }),
  });

  it('an abort is honoured while the cache hangs', async () => {
    const l = await load();
    setup(l);
    l.client._setAiRuntimeForTests({ cache: hangingCache(), cacheTimeoutMs: 60_000 });
    mockFetch(() => audio());
    const ac = new AbortController();
    const p = l.client.aiSpeak('hello', { signal: ac.signal });
    setTimeout(() => ac.abort(), 5);
    expect((await caught(p)).code).toBe('aborted');
  });

  it('a hanging cache is treated as a miss and swapped for the memory cache', async () => {
    const l = await load();
    setup(l);
    l.client._setAiRuntimeForTests({ cache: hangingCache(), cacheTimeoutMs: 10 });
    const calls = mockFetch(() => audio());
    expect((await l.client.aiSpeak('hello')).cached).toBe(false);
    expect(l.client.getTtsCache().backend).toBe('memory');
    expect((await l.client.aiSpeak('hello')).cached).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('concurrent identical requests share one paid request', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(() => audio());
    const [a, b] = await Promise.all([l.client.aiSpeak('Want to grab a coffee?'), l.client.aiSpeak('Want to grab a coffee?')]);
    expect(a.audio.size).toBeGreaterThan(0);
    expect(b.audio.size).toBe(a.audio.size);
    expect(calls).toHaveLength(1);
    expect(l.usage.getAiUsage().byProvider.gemini).toMatchObject({ requests: 1, ttsChars: 22 });
  });

  it('one caller aborting does not cancel the shared request for the other', async () => {
    const l = await load();
    setup(l);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const calls = mockFetch(async () => {
      await gate;
      return audio();
    });
    const ac = new AbortController();
    const first = l.client.aiSpeak('Gotta go.', { signal: ac.signal });
    const second = l.client.aiSpeak('Gotta go.');
    await new Promise((r) => setTimeout(r, 0));
    ac.abort();
    release();
    expect((await caught(first)).code).toBe('aborted');
    expect((await second).cached).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe('provider ids and usage maps (round 2 F7)', () => {
  it('rejects "__proto__" ids, never pollutes Object.prototype, counts usage', async () => {
    const l = await load();
    const p = l.config.createProviderConfig('gemini', { id: '__proto__', apiKey: GEMINI_KEY });
    expect(p.id).not.toBe('__proto__');
    l.config.saveAiConfig({ v: 1, providers: [{ ...p, id: '__proto__' }] });
    const saved = l.config.loadAiConfig().providers[0];
    expect(saved.id).toBe('p-gemini-1');
    mockFetch(() => geminiText('ok'));
    await l.client.aiText({ messages: msgs });
    expect(l.usage.getAiUsage().total.requests).toBe(1);
    l.usage.recordAiUsage('__proto__', { requests: 1 });
    expect(({} as Record<string, unknown>).requests).toBeUndefined();
    expect(l.usage.getAiUsage().byProvider['__proto__']?.requests).toBe(1);
  });

  it('sanitize is idempotent for duplicate/empty ids, and repairs are persisted', async () => {
    const l = await load();
    const raw = { v: 1, providers: [{ kind: 'gemini', id: '' }, { kind: 'openai', id: 'x' }, { kind: 'anthropic', id: 'x' }] };
    const a = l.config.sanitizeAiConfig(raw).providers.map((p) => p.id);
    const b = l.config.sanitizeAiConfig(raw).providers.map((p) => p.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
    expect(a[1]).toBe('x');
    const storage = (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage;
    storage.setItem('nghe-noi-am-device:ai-config', JSON.stringify(raw));
    l.config._resetAiConfigCache();
    const loaded = l.config.loadAiConfig().providers.map((p) => p.id);
    expect(loaded).toEqual(a);
    expect(JSON.parse(storage.getItem('nghe-noi-am-device:ai-config')!).providers.map((p: { id: string }) => p.id)).toEqual(a);
  });
});

describe('TTS cache when the indexedDB getter throws (round 2 F8)', () => {
  it('falls back to memory instead of rejecting with a raw DOMException', async () => {
    const l = await load();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError' });
      },
    });
    try {
      const c = l.ttsCache.createTtsCache();
      expect(c.backend).toBe('memory');
      l.client._setAiRuntimeForTests({ cache: null });
      await expect(l.client.clearTtsCache()).resolves.toBeUndefined();
      expect((await l.client.getTtsCache().stats()).backend).toBe('memory');
    } finally {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
    }
  });
});

describe('cross-tab usage changes notify subscribers (round 2 F9)', () => {
  it('a storage event for ai-usage bumps subscribeAi', async () => {
    const st = stubStorage();
    const l = await load();
    const fn = vi.fn();
    const off = l.client.subscribeAi(fn);
    st.fire('nghe-noi-am-device:ai-usage');
    expect(fn).toHaveBeenCalledTimes(1);
    st.fire('nghe-noi-am:something-else');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });
});

describe('Retry-After is not readable in browsers for OpenAI/OpenRouter (round 1 F2)', () => {
  it('parses the wait from the OpenAI message when no header is exposed', async () => {
    const l = await load();
    setup(l, 'openai');
    const calls = mockFetch(
      sequence(
        json(429, { error: { message: 'Rate limit reached for gpt-6-luna on tokens per min (TPM). Please try again in 1.5s.', type: 'tokens', code: 'rate_limit_exceeded' } }),
        json(200, { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
      ),
    );
    expect((await l.client.aiText({ messages: msgs })).text).toBe('ok');
    expect(calls).toHaveLength(2);
    expect(l.sleeps).toEqual([1500]);
  });

  it('parseRetryHint understands s / ms / m forms and ignores text without a hint', async () => {
    const { parseRetryHint } = await import('./http');
    expect(parseRetryHint('Please try again in 20s.')).toBe(20000);
    expect(parseRetryHint('Please try again in 120ms.')).toBe(120);
    expect(parseRetryHint('Please try again in 1m30s.')).toBe(90000);
    expect(parseRetryHint('Please try again later.')).toBeUndefined();
    expect(parseRetryHint(undefined)).toBeUndefined();
  });

  it('OpenRouter without a readable header falls back to client backoff', async () => {
    const l = await load();
    setup(l, 'openrouter');
    mockFetch(sequence(json(429, { error: { code: 429, message: 'Rate limit exceeded' } }), json(200, { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] })));
    expect((await l.client.aiText({ messages: msgs })).text).toBe('ok');
    expect(l.sleeps).toEqual([800 + 200]);
  });
});
