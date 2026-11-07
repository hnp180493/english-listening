import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANTHROPIC_KEY, GEMINI_KEY, OPENAI_KEY, OPENROUTER_KEY, hang, json, mockFetch, sequence, stubStorage } from './aiTestUtils';
import type { JsonSchema, ProviderKind } from './types';

async function load() {
  vi.resetModules();
  const client = await import('./client');
  const config = await import('./config');
  const usage = await import('./usage');
  const errors = await import('./errors');
  const registry = await import('./registry');
  const ttsCache = await import('./ttsCache');
  const sleeps: number[] = [];
  client._setAiRuntimeForTests({
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    cache: ttsCache.createMemoryTtsCache(),
  });
  return { client, config, usage, errors, registry, sleeps };
}

type Loaded = Awaited<ReturnType<typeof load>>;

function setup(l: Loaded, kinds: ProviderKind[] = ['gemini'], extra: Record<string, unknown> = {}) {
  const keys: Record<ProviderKind, string> = { gemini: GEMINI_KEY, openai: OPENAI_KEY, anthropic: ANTHROPIC_KEY, openrouter: OPENROUTER_KEY, 'openai-compatible': '' };
  const providers = kinds.map((k) => l.config.createProviderConfig(k, { id: k, apiKey: keys[k], model: k === 'openai-compatible' ? 'llama' : undefined }));
  l.config.saveAiConfig({ v: 1, providers, defaultTextProvider: kinds[0], defaultTtsProvider: kinds[0], ...extra });
}

const geminiText = (text: string) =>
  json(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } });
const msgs = [{ role: 'user' as const, content: 'Hi' }];
const ALL_KEYS = [GEMINI_KEY, OPENAI_KEY, ANTHROPIC_KEY, OPENROUTER_KEY];

function expectNoKey(e: unknown) {
  const s = JSON.stringify({ ...(e as object), message: (e as Error)?.message, stack: (e as Error)?.stack });
  for (const k of ALL_KEYS) expect(s).not.toContain(k);
}

async function caught(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expectNoKey(e);
    return e as Error & { code: string; status?: number; retryAfterMs?: number };
  }
  throw new Error('expected rejection');
}

describe('provider resolution', () => {
  beforeEach(() => stubStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('throws no-provider (Vietnamese) when nothing is configured', async () => {
    const l = await load();
    const e = await caught(l.client.aiText({ messages: msgs }));
    expect(e).toBeInstanceOf(l.errors.AiError);
    expect(e.code).toBe('no-provider');
    expect(e.message).toContain('Cài đặt → AI');
    expect(l.client.aiStatus()).toMatchObject({ configured: false, text: null, tts: null });
  });

  it('uses the default, skips disabled/keyless providers, honours explicit choice', async () => {
    const l = await load();
    setup(l, ['anthropic', 'gemini']);
    l.config.updateAiConfig((c) => ({ ...c, providers: c.providers.map((p) => (p.id === 'anthropic' ? { ...p, enabled: false } : p)) }));
    const calls = mockFetch(() => geminiText('ok'));
    await l.client.aiText({ messages: msgs });
    expect(calls[0].url).toContain('generativelanguage.googleapis.com');
    const e = await caught(l.client.aiText({ messages: msgs }, { provider: 'anthropic' }));
    expect(e.code).toBe('no-provider');
    expect(e.message).toContain('đang bị tắt');
  });

  it('aiStatus reports capabilities and only masked keys', async () => {
    const l = await load();
    setup(l, ['anthropic', 'gemini']);
    const s = l.client.aiStatus();
    expect(s.configured).toBe(true);
    expect(s.text?.id).toBe('anthropic');
    expect(s.tts?.id).toBe('gemini'); // anthropic has no TTS → falls through to gemini
    expect(s.providers.find((p) => p.id === 'gemini')).toMatchObject({ keyMasked: 'AIza…k3Fq', hasKey: true, capabilities: { text: true, json: true, tts: true, listModels: true } });
    expect(JSON.stringify(s)).not.toContain(GEMINI_KEY);
    expect(JSON.stringify(s)).not.toContain(ANTHROPIC_KEY);
  });
});

describe('retry, timeout, abort', () => {
  beforeEach(() => stubStorage());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('retries 429 honouring Retry-After, then succeeds; counts usage once', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(sequence(json(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'slow' } }, { 'retry-after': '2' }), geminiText('done')));
    const r = await l.client.aiText({ messages: msgs });
    expect(r.text).toBe('done');
    expect(calls).toHaveLength(2);
    expect(l.sleeps).toEqual([2000]);
    expect(l.usage.getAiUsage().byProvider.gemini).toMatchObject({ requests: 1, errors: 0, inputTokens: 3, outputTokens: 2 });
  });

  it('retries 5xx at most twice with exponential backoff + jitter, then throws', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(() => json(503, { error: { code: 503, message: 'overloaded' } }));
    const e = await caught(l.client.aiText({ messages: msgs }));
    expect(e.code).toBe('server');
    expect(calls).toHaveLength(3);
    expect(l.sleeps).toEqual([800 + 200, 1600 + 200]);
    expect(l.usage.getAiUsage().byProvider.gemini).toMatchObject({ requests: 0, errors: 1 });
  });

  it('retries network failures but never bad keys, and gives up on very long Retry-After', async () => {
    const l = await load();
    setup(l);
    let calls = mockFetch(sequence(new TypeError('Failed to fetch'), geminiText('ok')));
    expect((await l.client.aiText({ messages: msgs })).text).toBe('ok');
    expect(calls).toHaveLength(2);

    calls = mockFetch(() => json(400, { error: { message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } }));
    expect((await caught(l.client.aiText({ messages: msgs }))).code).toBe('bad-key');
    expect(calls).toHaveLength(1);

    calls = mockFetch(() => json(429, { error: { message: 'slow' } }, { 'retry-after': '120' }));
    const e = await caught(l.client.aiText({ messages: msgs }));
    expect(e.code).toBe('rate-limit');
    expect(e.message).toContain('120 giây');
    expect(calls).toHaveLength(1);
  });

  it('times out a hanging request with code timeout (no retry)', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(hang);
    const e = await caught(l.client.aiText({ messages: msgs }, { timeoutMs: 20 }));
    expect(e.code).toBe('timeout');
    expect(e.message).toContain('quá lâu');
    expect(calls).toHaveLength(1);
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it('times out even if the transport ignores the signal', async () => {
    const l = await load();
    setup(l);
    mockFetch(() => new Promise<Response>(() => {}));
    expect((await caught(l.client.aiText({ messages: msgs }, { timeoutMs: 20 }))).code).toBe('timeout');
  });

  it('aborts on the caller signal (before and during), without counting an error', async () => {
    const l = await load();
    setup(l);
    mockFetch(hang);
    const pre = new AbortController();
    pre.abort();
    expect((await caught(l.client.aiText({ messages: msgs, signal: pre.signal }))).code).toBe('aborted');
    const ctrl = new AbortController();
    const p = l.client.aiText({ messages: msgs, signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 5);
    expect((await caught(p)).code).toBe('aborted');
    expect(l.usage.getAiUsage().byProvider.gemini?.errors ?? 0).toBe(0);
  });

  it('enforces the daily soft cap', async () => {
    const l = await load();
    setup(l, ['gemini'], { dailyRequestCap: 1 });
    mockFetch(() => geminiText('ok'));
    await l.client.aiText({ messages: msgs });
    const e = await caught(l.client.aiText({ messages: msgs }));
    expect(e.code).toBe('quota');
    expect(e.message).toContain('giới hạn 1');
    expect(l.client.aiStatus().overDailyCap).toBe(true);
  });
});

describe('aiJson', () => {
  beforeEach(() => stubStorage());
  afterEach(() => vi.unstubAllGlobals());
  const schema: JsonSchema = { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] };

  it('returns validated JSON', async () => {
    const l = await load();
    setup(l);
    mockFetch(() => geminiText('{"n": 3}'));
    expect(await l.client.aiJson<{ n: number }>({ messages: msgs, json: { schema, name: 'r' } })).toEqual({ n: 3 });
  });

  it('repairs once with the problems sent back, then succeeds', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(sequence(geminiText('{"n": "three"}'), geminiText('{"n": 3}')));
    const v = await l.client.aiJson<{ n: number }>({ messages: msgs, json: { schema, name: 'r' } });
    expect(v).toEqual({ n: 3 });
    const contents = (calls[1].body as { contents: { role: string; parts: { text: string }[] }[] }).contents;
    expect(contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(contents[2].parts[0].text).toContain('$.n: expected integer');
  });

  it('applies the custom validator and fails with bad-response after one repair', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(() => geminiText('{"n": -1}'));
    const e = await caught(l.client.aiJson({ messages: msgs, json: { schema, name: 'r' } }, { validate: (v) => ((v as { n: number }).n < 0 ? 'n must be >= 0' : null) }));
    expect(e.code).toBe('bad-response');
    expect(calls).toHaveLength(2);
  });
});

describe('aiSpeak', () => {
  beforeEach(() => stubStorage());
  afterEach(() => vi.unstubAllGlobals());

  const audio = () =>
    json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: btoa('\x01\x00'.repeat(12000)) } }] } }] }); // 0.5 s

  it('generates once, then serves from cache; counts characters and cache hits', async () => {
    const l = await load();
    setup(l);
    const calls = mockFetch(() => audio());
    const a = await l.client.aiSpeak('  Gonna be late. ');
    expect(a).toMatchObject({ mime: 'audio/wav', cached: false, providerId: 'gemini' });
    expect((calls[0].body as { contents: { parts: { text: string }[] }[] }).contents[0].parts[0].text).toBe('Gonna be late.');
    const b = await l.client.aiSpeak('Gonna be late.');
    expect(b.cached).toBe(true);
    expect(calls).toHaveLength(1);
    await l.client.aiSpeak('Gonna be late.', { voice: 'Puck' }); // different voice → new clip
    expect(calls).toHaveLength(2);
    expect(l.usage.getAiUsage().byProvider.gemini).toMatchObject({ requests: 2, ttsChars: 28, cacheHits: 1 });
  });

  it('an empty or far too short clip is a bad-response and is never cached (robust-6)', async () => {
    const l = await load();
    setup(l);
    const tiny = () => json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: 'AAAA' } }] } }] });
    // 0.1 s for a 5-word sentence is too short as well
    const short = () => json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: btoa(' '.repeat(2400)) } }] } }] });
    const calls = mockFetch((_c, i) => (i === 0 ? tiny() : i === 1 ? short() : audio()));
    const e = await caught(l.client.aiSpeak('I have a test tomorrow.'));
    expect(e.code).toBe('bad-response');
    expect(e.message).toContain('rỗng');
    expect((await caught(l.client.aiSpeak('I have a test tomorrow.'))).message).toContain('quá ngắn');
    // nothing was cached: a good answer is fetched next time
    expect((await l.client.aiSpeak('I have a test tomorrow.')).cached).toBe(false);
    expect(calls).toHaveLength(3);
    const { wavDurationSec, pcmToWav } = await import('./wav');
    expect(wavDurationSec(pcmToWav(new Uint8Array(48000)))).toBe(1);
    expect(wavDurationSec(new Uint8Array(10))).toBeNull();
  });

  it('explains when no configured provider can speak', async () => {
    const l = await load();
    setup(l, ['anthropic']);
    const e = await caught(l.client.aiSpeak('hi'));
    expect(e.code).toBe('no-provider');
    expect(e.message).toContain('giọng nói');
    expect((await caught(l.client.aiSpeak('   '))).code).toBe('bad-request');
  });
});

describe('testProvider / listProviderModels / subscribe', () => {
  beforeEach(() => stubStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('testProvider never throws and accepts unsaved configs', async () => {
    const l = await load();
    mockFetch(() => new TypeError('Failed to fetch'));
    const r = await l.client.testProvider(l.config.createProviderConfig('openai', { apiKey: OPENAI_KEY }));
    expect(r).toMatchObject({ ok: false, code: 'network' });
    expect(await l.client.testProvider('missing')).toMatchObject({ ok: false, code: 'no-provider' });
  });

  it('notifies subscribers on config and usage changes', async () => {
    const l = await load();
    const fn = vi.fn();
    const v0 = l.client.aiVersion();
    const off = l.client.subscribeAi(fn);
    setup(l);
    mockFetch(() => geminiText('ok'));
    await l.client.aiText({ messages: msgs });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(l.client.aiVersion()).toBe(v0 + 2);
    off();
  });
});

describe('registry', () => {
  it('has an adapter + defaults for every kind, with consistent kinds and capabilities', async () => {
    stubStorage();
    const l = await load();
    const { PROVIDER_DEFAULTS } = await import('./defaults');
    for (const kind of l.config.PROVIDER_KINDS) {
      const a = l.registry.getAdapter(kind);
      expect(a.kind).toBe(kind);
      expect(PROVIDER_DEFAULTS[kind].kind).toBe(kind);
      const caps = l.registry.capabilitiesOf(l.config.createProviderConfig(kind, { apiKey: 'k' }));
      expect(caps.text).toBe(true);
      expect(caps.tts).toBe(typeof a.tts === 'function');
      expect(typeof a.testConnection).toBe('function');
    }
    expect(Object.keys(l.registry.ADAPTERS).sort()).toEqual([...l.config.PROVIDER_KINDS].sort());
    vi.unstubAllGlobals();
  });
});

describe('no error ever contains a key', () => {
  beforeEach(() => stubStorage());
  afterEach(() => vi.unstubAllGlobals());

  it.each<[ProviderKind, number]>([
    ['gemini', 400],
    ['gemini', 401],
    ['gemini', 403],
    ['gemini', 500],
    ['openai', 401],
    ['openai', 429],
    ['anthropic', 401],
    ['anthropic', 400],
    ['openrouter', 402],
    ['openrouter', 403],
  ])('%s %i echoing the key', async (kind, status) => {
    const l = await load();
    setup(l, [kind]);
    const key = { gemini: GEMINI_KEY, openai: OPENAI_KEY, anthropic: ANTHROPIC_KEY, openrouter: OPENROUTER_KEY, 'openai-compatible': '' }[kind];
    mockFetch(() => json(status, { error: { message: `Key ${key} rejected; header x-api-key: ${key}; Bearer ${key}`, type: 'x' } }));
    const e = await caught(l.client.aiText({ messages: msgs }, { retries: 0 }));
    expect(e.message.length).toBeGreaterThan(5);
    const t = await l.client.testProvider(kind);
    expect(JSON.stringify(t)).not.toContain(key);
  });
});
