import { afterEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_KEY, stubStorage } from './aiTestUtils';

async function fresh() {
  vi.resetModules();
  return import('./config');
}

describe('sanitizeAiConfig', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drops junk, unknown kinds, dedupes ids, cleans keys and URLs, fixes defaults', async () => {
    stubStorage();
    const { sanitizeAiConfig } = await fresh();
    const c = sanitizeAiConfig({
      providers: [
        { id: 'a', kind: 'gemini', apiKey: `  ${GEMINI_KEY}\n`, model: '' },
        { id: 'a', kind: 'openai', apiKey: 'sk-x', baseUrl: 'javascript:alert(1)' },
        { id: 'b', kind: 'evil', apiKey: 'x' },
        { id: 'c', kind: 'openai-compatible', baseUrl: 'http://user:pw@localhost:1234/v1' },
        { id: 'd', kind: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1/', enabled: false },
        'nope',
        null,
      ],
      defaultTextProvider: 'zzz',
      defaultTtsProvider: 'a',
      dailyRequestCap: -5,
    });
    expect(c.providers.map((p) => p.kind)).toEqual(['gemini', 'openai', 'openai-compatible', 'openrouter']);
    const [g, o, local, or] = c.providers;
    expect(g.apiKey).toBe(GEMINI_KEY);
    expect(g.model).toBe('gemini-3.6-flash');
    expect(g.ttsModel).toBe('gemini-3.8-flash-tts');
    expect(g.ttsVoice).toBe('Kore');
    expect(g.label).toBe('Google Gemini');
    expect(o.id).not.toBe('a'); // duplicate id regenerated
    expect(o.baseUrl).toBeUndefined();
    expect(local.baseUrl).toBe('http://localhost:11434/v1'); // credentials in URL rejected → default
    expect(or.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(or.enabled).toBe(false);
    expect(c.defaultTextProvider).toBeUndefined();
    expect(c.defaultTtsProvider).toBe('a');
    expect(c.dailyRequestCap).toBeUndefined();
    expect(sanitizeAiConfig('garbage')).toEqual({ v: 1, providers: [] });
  });

  it('masks keys for display', async () => {
    stubStorage();
    const { maskKey } = await fresh();
    expect(maskKey(GEMINI_KEY)).toBe('AIza…k3Fq');
    expect(maskKey('short')).toBe('••••');
    expect(maskKey('')).toBe('');
    expect(maskKey(undefined)).toBe('');
  });
});

describe('device-local storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores under a prefix that backup/sync ("nghe-noi-am:") never enumerate', async () => {
    const { map } = stubStorage();
    const { saveAiConfig, createProviderConfig, AI_DEVICE_LOCAL_KEYS } = await fresh();
    const { STORAGE_PREFIX } = await import('../storage');
    saveAiConfig({ v: 1, providers: [createProviderConfig('gemini', { apiKey: GEMINI_KEY })] });
    const keys = [...map.keys()];
    expect(keys).toEqual(['nghe-noi-am-device:ai-config']);
    expect(keys.every((k) => !k.startsWith(STORAGE_PREFIX))).toBe(true);
    expect(AI_DEVICE_LOCAL_KEYS).toEqual(['ai-config', 'ai-usage']);
  });

  it('a newly added Gemini provider becomes the voice default over OpenAI; editing OpenAI later keeps it', async () => {
    stubStorage();
    const cfg = await fresh();
    const o = cfg.createProviderConfig('openai', { apiKey: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx' });
    cfg.upsertProvider(o);
    expect(cfg.loadAiConfig().defaultTtsProvider).toBe(o.id);
    const g = cfg.createProviderConfig('gemini', { apiKey: GEMINI_KEY });
    cfg.upsertProvider(g);
    let c = cfg.loadAiConfig();
    expect(c.defaultTtsProvider).toBe(g.id);
    expect(c.defaultTextProvider).toBe(o.id); // text default unchanged
    cfg.upsertProvider({ ...o, model: 'gpt-6-luna' }); // editing an existing provider does not steal it back
    expect(cfg.loadAiConfig().defaultTtsProvider).toBe(g.id);
    // a second Gemini provider does not replace the first
    const g2 = cfg.createProviderConfig('gemini', { apiKey: GEMINI_KEY });
    cfg.upsertProvider(g2);
    c = cfg.loadAiConfig();
    expect(c.defaultTtsProvider).toBe(g.id);
  });

  it('round-trips, sets defaults on first upsert, notifies, reacts to other tabs', async () => {
    const { map, fire } = stubStorage();
    const cfg = await fresh();
    const seen = vi.fn();
    cfg.subscribeAiConfig(seen);
    const g = cfg.createProviderConfig('gemini', { apiKey: GEMINI_KEY });
    const a = cfg.createProviderConfig('anthropic', { apiKey: 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxx' });
    cfg.upsertProvider(g);
    cfg.upsertProvider(a);
    let c = cfg.loadAiConfig();
    expect(c.defaultTextProvider).toBe(g.id);
    expect(c.defaultTtsProvider).toBe(g.id);
    expect(seen).toHaveBeenCalledTimes(2);

    // another tab removes the gemini provider
    const raw = JSON.parse(map.get('nghe-noi-am-device:ai-config')!);
    raw.providers = raw.providers.filter((p: { id: string }) => p.id !== g.id);
    map.set('nghe-noi-am-device:ai-config', JSON.stringify(raw));
    fire('nghe-noi-am-device:ai-config');
    expect(seen).toHaveBeenCalledTimes(3);
    c = cfg.loadAiConfig();
    expect(c.providers.map((p) => p.kind)).toEqual(['anthropic']);
    expect(c.defaultTextProvider).toBeUndefined(); // dangling reference cleaned

    fire('nghe-noi-am:settings'); // unrelated key: no notification
    expect(seen).toHaveBeenCalledTimes(3);

    cfg.clearAiDeviceData();
    expect(map.size).toBe(0);
    expect(cfg.loadAiConfig().providers).toEqual([]);
  });

  it('works without storage (blocked) and reports persisted=false', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('SecurityError');
        },
        removeItem: () => {},
      },
      addEventListener: () => {},
    });
    const cfg = await fresh();
    const r = cfg.saveAiConfig({ v: 1, providers: [cfg.createProviderConfig('gemini', { apiKey: GEMINI_KEY })] });
    expect(r.persisted).toBe(false);
    expect(cfg.loadAiConfig().providers).toHaveLength(1); // kept in memory for this session
  });
});

describe('base URL lock and session-only keys', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drops a stored base URL that would send a cloud key to another host', async () => {
    const { map } = stubStorage();
    map.set(
      'nghe-noi-am-device:ai-config',
      JSON.stringify({ v: 1, providers: [{ id: 'g', kind: 'gemini', apiKey: GEMINI_KEY, model: 'm', baseUrl: 'https://evil.example/v1beta' }] }),
    );
    const { loadAiConfig } = await fresh();
    expect(loadAiConfig().providers[0].baseUrl).toBeUndefined();
    expect(map.get('nghe-noi-am-device:ai-config')).not.toContain('evil.example'); // repaired on disk too
    const { effectiveBaseUrl } = await import('./defaults');
    expect(effectiveBaseUrl('gemini', 'https://evil.example/v1beta')).toBe('https://generativelanguage.googleapis.com/v1beta');
  });

  it("keyStore 'session' keeps keys out of localStorage and reads them back from the tab's session", async () => {
    const { map, session } = stubStorage();
    const { saveAiConfig, loadAiConfig, _resetAiConfigCache, clearAiDeviceData } = await fresh();
    saveAiConfig({ v: 1, keyStore: 'session', providers: [{ id: 'g', kind: 'gemini', label: 'G', apiKey: GEMINI_KEY, model: 'm', enabled: true }] });
    expect(map.get('nghe-noi-am-device:ai-config')).not.toContain(GEMINI_KEY);
    expect(session.get('nghe-noi-am-device:ai-keys')).toContain(GEMINI_KEY);
    _resetAiConfigCache();
    expect(loadAiConfig().providers[0].apiKey).toBe(GEMINI_KEY);
    // a new tab (empty session): the provider is there, the key is not
    session.clear();
    _resetAiConfigCache();
    expect(loadAiConfig().providers[0].apiKey).toBe('');
    // switching back to device storage writes the key and drops the session copy
    saveAiConfig({ ...loadAiConfig(), keyStore: undefined, providers: [{ ...loadAiConfig().providers[0], apiKey: GEMINI_KEY }] });
    expect(map.get('nghe-noi-am-device:ai-config')).toContain(GEMINI_KEY);
    expect(session.has('nghe-noi-am-device:ai-keys')).toBe(false);
    clearAiDeviceData();
    expect(map.has('nghe-noi-am-device:ai-config')).toBe(false);
  });
});
