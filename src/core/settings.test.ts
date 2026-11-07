import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX } from './storage';

const KEY = STORAGE_PREFIX + 'settings';

function stubWindow(opts: { blocked?: boolean } = {}) {
  const map = new Map<string, string>();
  const handlers: ((e: { key: string | null }) => void)[] = [];
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => {
        if (opts.blocked) throw new Error('SecurityError');
        return map.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (opts.blocked) throw new Error('SecurityError');
        map.set(k, v);
      },
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: (type: string, fn: (e: { key: string | null }) => void) => {
      if (type === 'storage') handlers.push(fn);
    },
  });
  return { map, fire: (key: string | null) => handlers.forEach((fn) => fn({ key })) };
}

async function freshSettings() {
  vi.resetModules();
  return import('./settings');
}

describe('settings across tabs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not revert a value another tab saved', async () => {
    const { map } = stubWindow();
    const { updateSettings, getSettings } = await freshSettings();
    map.set(KEY, JSON.stringify({ theme: 'dark' })); // tab A, after this tab loaded
    updateSettings({ rate: 0.8 });
    expect(getSettings()).toMatchObject({ theme: 'dark', rate: 0.8 });
    expect(JSON.parse(map.get(KEY)!)).toMatchObject({ theme: 'dark', rate: 0.8 });
  });

  it('reloads and notifies on a storage event for the settings key only', async () => {
    const { map, fire } = stubWindow();
    const { getSettings, updateSettings } = await freshSettings();
    let notified = 0;
    // useSettings subscribes through the same listener set that updateSettings notifies.
    updateSettings({}); // baseline write
    map.set(KEY, JSON.stringify({ theme: 'dark' }));
    const before = getSettings();
    fire(STORAGE_PREFIX + 'stats');
    expect(getSettings()).toBe(before);
    fire(KEY);
    notified += getSettings() !== before ? 1 : 0;
    expect(getSettings().theme).toBe('dark');
    expect(notified).toBe(1);
  });

  it('reviewMinutes: default 10, only 5/10/15/20 accepted', async () => {
    const { map } = stubWindow();
    map.set(KEY, JSON.stringify({ reviewMinutes: 15 }));
    let s = await freshSettings();
    expect(s.getSettings().reviewMinutes).toBe(15);
    s.updateSettings({ reviewMinutes: 20 });
    expect(JSON.parse(map.get(KEY)!).reviewMinutes).toBe(20);
    s.updateSettings({ reviewMinutes: 7 });
    expect(s.getSettings().reviewMinutes).toBe(10);
    for (const bad of [7, '10', null, -5, 1e9]) {
      map.set(KEY, JSON.stringify({ reviewMinutes: bad }));
      s = await freshSettings();
      expect(s.getSettings().reviewMinutes).toBe(10);
    }
    map.delete(KEY);
    s = await freshSettings();
    expect(s.getSettings().reviewMinutes).toBe(10);
    expect(s.sanitizeReviewMinutes(5)).toBe(5);
    expect(s.sanitizeReviewMinutes(undefined)).toBe(10);
  });

  it('listenGoal: default 30, only 0/15/30/45/60/90 accepted (0 = off)', async () => {
    const { map } = stubWindow();
    map.set(KEY, JSON.stringify({ listenGoal: 0 }));
    let s = await freshSettings();
    expect(s.getSettings().listenGoal).toBe(0);
    s.updateSettings({ listenGoal: 60 });
    expect(JSON.parse(map.get(KEY)!).listenGoal).toBe(60);
    s.updateSettings({ listenGoal: 31 });
    expect(s.getSettings().listenGoal).toBe(30);
    for (const bad of [31, '30', null, -15, 1e9, NaN]) {
      map.set(KEY, JSON.stringify({ listenGoal: bad }));
      s = await freshSettings();
      expect(s.getSettings().listenGoal).toBe(30);
    }
    map.delete(KEY);
    s = await freshSettings();
    expect(s.getSettings().listenGoal).toBe(30);
    expect(s.LISTEN_GOAL_OPTIONS).toEqual([0, 15, 30, 45, 60, 90]);
    expect(s.sanitizeListenGoal(90)).toBe(90);
    expect(s.sanitizeListenGoal(undefined)).toBe(30);
  });

  it("voiceEngine: default 'clips' (Giọng Gemini có sẵn, never paid), a picked 'browser' or 'ai' sticks", async () => {
    const { map } = stubWindow();
    let s = await freshSettings();
    expect(s.getSettings()).toMatchObject({ voiceEngine: 'clips', voiceChosen: false });
    s.updateSettings({ voiceEngine: 'browser' });
    expect(JSON.parse(map.get(KEY)!)).toMatchObject({ voiceEngine: 'browser', voiceChosen: true });
    s = await freshSettings();
    expect(s.getSettings().voiceEngine).toBe('browser');
    // other settings changes keep the choice
    s.updateSettings({ rate: 0.9 });
    expect(s.getSettings()).toMatchObject({ voiceEngine: 'browser', voiceChosen: true, rate: 0.9 });
    s.updateSettings({ voiceEngine: 'ai' });
    expect(s.getSettings()).toMatchObject({ voiceEngine: 'ai', voiceChosen: true });
    s.updateSettings({ voiceEngine: 'clips' });
    expect(s.getSettings()).toMatchObject({ voiceEngine: 'clips', voiceChosen: true });
    for (const bad of ['gemini', 1, null, true]) {
      map.set(KEY, JSON.stringify({ voiceEngine: bad, voiceChosen: true }));
      s = await freshSettings();
      expect(s.getSettings().voiceEngine).toBe('clips');
    }
    expect(s.sanitizeVoiceEngine('browser')).toBe('browser');
    expect(s.sanitizeVoiceEngine('ai')).toBe('ai');
    expect(s.sanitizeVoiceEngine(undefined)).toBe('clips');
  });

  it("migration: a stored 'browser' from before the shipped clips (no voiceChosen) becomes 'clips', never the paid 'ai'", async () => {
    const { map } = stubWindow();
    map.set(KEY, JSON.stringify({ voiceURI: null, rate: 1.1, voiceEngine: 'browser' }));
    let s = await freshSettings();
    expect(s.getSettings()).toMatchObject({ voiceEngine: 'clips', voiceChosen: false, rate: 1.1 });
    // an unrelated change saves the migrated value without marking it as a choice
    s.updateSettings({ theme: 'dark' });
    expect(JSON.parse(map.get(KEY)!)).toMatchObject({ voiceEngine: 'clips', voiceChosen: false });
    // what the first shipped-clips build stored ('ai' forced, flag false) was not a choice either
    map.set(KEY, JSON.stringify({ voiceEngine: 'ai', voiceChosen: false }));
    s = await freshSettings();
    expect(s.getSettings()).toMatchObject({ voiceEngine: 'clips', voiceChosen: false });
  });

  it("migration: a stored 'ai' from before the flag was the learner's choice of the AI voice, and stays", async () => {
    const { map } = stubWindow();
    map.set(KEY, JSON.stringify({ voiceEngine: 'ai', rate: 1 }));
    const s = await freshSettings();
    expect(s.getSettings()).toMatchObject({ voiceEngine: 'ai', voiceChosen: true });
    s.updateSettings({ theme: 'light' });
    expect(JSON.parse(map.get(KEY)!)).toMatchObject({ voiceEngine: 'ai', voiceChosen: true });
  });

  it('backup keeps the voice choice flag', async () => {
    const { sanitizeSettingsJSON } = await import('./backup');
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ voiceEngine: 'browser', voiceChosen: true })) ?? '{}')).toEqual({
      voiceEngine: 'browser',
      voiceChosen: true,
    });
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ voiceChosen: 'yes' })) ?? '{}')).toEqual({});
  });

  it('keeps in-memory changes when storage is blocked', async () => {
    stubWindow({ blocked: true });
    const { updateSettings, getSettings } = await freshSettings();
    updateSettings({ theme: 'dark' });
    updateSettings({ rate: 0.8 });
    expect(getSettings()).toMatchObject({ theme: 'dark', rate: 0.8 });
  });
});
