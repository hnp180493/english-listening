// Shipped Gemini clips (public/audio): routing before the AI / browser voice, silent fallback, session memory.
// The AI layer, the audio element and the manifest loader are mocked; no network, no key.

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { type AiSpeakResult, type ProviderSummary } from './ai';
import { audioKey } from './audioKey';
import { _resetAudioManifestForTests } from './audioManifest';
import { _setClipPlayerForTests, type ClipPlayer } from './audioPlayer';
import { updateSettings, type VoiceEngine } from './settings';

const ai = vi.hoisted(() => ({
  version: 0,
  tts: null as unknown,
  speak: null as unknown as Mock<(text: string, opts?: Record<string, unknown>) => Promise<unknown>>,
}));

vi.mock('./ai', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./ai')>();
  return {
    ...orig,
    aiVersion: () => ai.version,
    aiStatus: () => ({ configured: !!ai.tts, text: ai.tts, tts: ai.tts, providers: [], overDailyCap: false }),
    aiSpeak: (text: string, opts?: Record<string, unknown>) => ai.speak(text, opts),
  };
});

const { _resetTtsForTests, prefetchSpeech, speak, stopSpeaking, STATIC_LOAD_TIMEOUT_MS } = await import('./tts');

const GEMINI: ProviderSummary = {
  id: 'g1',
  kind: 'gemini',
  label: 'Google Gemini',
  model: 'gemini-3.6-flash',
  ttsModel: 'gemini-3.8-flash-tts',
  ttsVoice: 'Kore',
  enabled: true,
  hasKey: true,
  keyMasked: 'AIza…k3Fq',
  capabilities: { text: true, json: true, tts: true, listModels: true },
  usable: true,
};

const SAY = 'Turnid off.';
const CLEAR = 'Turn it off.';
const WORD = 'thought';
const MANIFEST = { clips: { [audioKey('connected', SAY)]: 'c1.mp3', [audioKey('careful', CLEAR)]: 'c2.mp3', [audioKey('plain', WORD)]: 'p1.mp3' } };

class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = '';
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

type UrlPlay = { url: string; rate: number; onPlaying?: () => void; resolve: () => void; reject: (e: unknown) => void };
let synth: { speaking: boolean; cancel: Mock<() => void>; speak: Mock<(u: FakeUtterance) => void>; getVoices: () => unknown[] };
let player: ClipPlayer & { playUrl: Mock<ClipPlayer['playUrl']>; play: Mock<ClipPlayer['play']>; stop: Mock<() => void>; prime: Mock<() => void> };
let urlPlays: UrlPlay[];

function setup({ engine = 'ai' as VoiceEngine, provider = null as ProviderSummary | null, manifest = MANIFEST as unknown, loader = undefined as (() => Promise<unknown>) | undefined } = {}) {
  _resetTtsForTests();
  _resetAudioManifestForTests(loader ?? (async () => manifest));
  synth = {
    speaking: false,
    cancel: vi.fn<() => void>(),
    speak: vi.fn((u: FakeUtterance) => {
      synth.speaking = true;
      void u;
    }),
    getVoices: () => [{ name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', voiceURI: 'aria', localService: false }],
  };
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('window', { speechSynthesis: synth });
  urlPlays = [];
  player = {
    prime: vi.fn<() => void>(),
    play: vi.fn(() => new Promise<void>(() => undefined)),
    playUrl: vi.fn(
      (url: string, rate: number, onPlaying?: () => void) =>
        new Promise<void>((resolve, reject) => {
          urlPlays.push({ url, rate, onPlaying, resolve, reject });
        }),
    ),
    stop: vi.fn(() => {
      urlPlays.at(-1)?.resolve();
    }),
  };
  _setClipPlayerForTests(player);
  ai.speak = vi.fn(() => new Promise<AiSpeakResult>(() => undefined));
  ai.tts = provider;
  ai.version++;
  updateSettings({ voiceEngine: engine, rate: 1 });
}

afterEach(() => {
  stopSpeaking();
  _setClipPlayerForTests(null);
  _resetTtsForTests();
  _resetAudioManifestForTests();
  updateSettings({ voiceEngine: 'browser', rate: 1 });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shipped clips', () => {
  it('a text with a clip plays the file (no speechSynthesis, no AI request), at the requested rate', async () => {
    setup();
    const onStart = vi.fn();
    const done = speak(SAY, { mode: 'connected', rate: 1.2, onStart });
    expect(player.prime).toHaveBeenCalled(); // still inside the click
    await flush();
    expect(urlPlays).toHaveLength(1);
    expect(urlPlays[0]).toMatchObject({ url: 'audio/c1.mp3', rate: 1.2 });
    expect(onStart).not.toHaveBeenCalled();
    urlPlays[0].onPlaying?.();
    expect(onStart).toHaveBeenCalledTimes(1);
    urlPlays[0].resolve();
    await done;
    expect(synth.speak).not.toHaveBeenCalled();
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it('the key is (mode, exact text): careful clip for the written text; other mode or text → no clip', async () => {
    setup();
    void speak(CLEAR, { mode: 'careful' });
    await flush();
    expect(urlPlays.map((p) => p.url)).toEqual(['audio/c2.mp3']);
    // careful clips are generated slow already: same rate rule as the AI voice (≈ 0.9 × the learner's rate)
    expect(urlPlays[0].rate).toBeCloseTo(0.9);
    void speak(CLEAR, { mode: 'connected' }); // no connected clip for the written text
    await flush();
    expect(urlPlays).toHaveLength(1);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    void speak(SAY); // no mode: looks for a 'plain' clip of the text; there is none for SAY
    await flush();
    expect(urlPlays).toHaveLength(1);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it("a playback without a mode (word, minimal pair) plays its 'plain' clip", async () => {
    setup();
    const onStart = vi.fn();
    void speak(WORD, { rate: 1, onStart });
    await flush();
    expect(urlPlays.map((p) => p.url)).toEqual(['audio/p1.mp3']);
    expect(urlPlays[0].rate).toBeCloseTo(1);
    urlPlays[0].onPlaying?.();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(synth.speak).not.toHaveBeenCalled();
    void speak(WORD, { mode: 'connected' }); // another mode: another clip
    await flush();
    expect(urlPlays).toHaveLength(1);
  });

  it("the default 'clips' (Giọng Gemini có sẵn) never pays: no clip → browser voice even with a Gemini key", async () => {
    setup({ engine: 'clips', provider: GEMINI });
    void speak(SAY, { mode: 'connected' });
    await flush();
    expect(urlPlays).toHaveLength(1); // the clip
    void speak('Typed by the learner.', { mode: 'connected' });
    await flush();
    expect(ai.speak).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    void speak('another word'); // mode-less, no clip
    await flush();
    expect(ai.speak).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(2);
    // a clip that fails falls back to the browser voice too, not the AI voice
    void speak(CLEAR, { mode: 'careful' });
    await flush();
    urlPlays[1].reject(new Error('404'));
    await flush();
    expect(ai.speak).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(3);
    prefetchSpeech(['Something else entirely.'], { mode: 'connected' });
    await flush();
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it('once the manifest is known, routing is synchronous', async () => {
    setup();
    void speak(SAY, { mode: 'connected' });
    await flush();
    urlPlays[0].resolve();
    await flush();
    void speak(SAY, { mode: 'connected' });
    expect(urlPlays).toHaveLength(2);
  });

  it('a clip that fails to load falls back silently to the browser voice and is skipped afterwards', async () => {
    setup();
    const done = speak(SAY, { mode: 'connected' });
    await flush();
    urlPlays[0].reject(new Error('404'));
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe(SAY); // same connected text
    (synth.speak.mock.calls[0][0] as FakeUtterance).onend?.();
    await done;
    void speak(SAY, { mode: 'connected' });
    await flush();
    expect(urlPlays).toHaveLength(1); // not tried again this session
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('with a Gemini key the fallback is the AI voice (style of the mode)', async () => {
    setup({ provider: GEMINI });
    void speak(SAY, { mode: 'connected' });
    await flush();
    urlPlays[0].reject(new Error('404'));
    await flush();
    expect(ai.speak).toHaveBeenCalledTimes(1);
    expect(ai.speak.mock.calls[0][0]).toBe(SAY);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('with a Gemini key, a text with a clip still plays the clip (no paid request)', async () => {
    setup({ provider: GEMINI });
    void speak(SAY, { mode: 'connected' });
    await flush();
    expect(urlPlays).toHaveLength(1);
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it('two failures in a row (no audio folder) → no clips for the session', async () => {
    setup();
    void speak(SAY, { mode: 'connected' });
    await flush();
    urlPlays[0].reject(new Error('404'));
    await flush();
    void speak(CLEAR, { mode: 'careful' });
    await flush();
    urlPlays[1].reject(new Error('404'));
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(urlPlays).toHaveLength(2);
  });

  it('a clip that never starts is given up after STATIC_LOAD_TIMEOUT_MS, and stopped so it cannot start late', async () => {
    vi.useFakeTimers();
    setup();
    const onStart = vi.fn();
    void speak(SAY, { mode: 'connected', onStart });
    await flush();
    expect(urlPlays).toHaveLength(1);
    const late = urlPlays[0];
    player.stop.mockClear();
    vi.advanceTimersByTime(STATIC_LOAD_TIMEOUT_MS + 10);
    await flush();
    expect(player.stop).toHaveBeenCalled(); // the pending load is cancelled before the browser voice speaks
    expect(synth.speak).toHaveBeenCalledTimes(1);
    late.onPlaying?.(); // bytes arriving after the deadline
    expect(onStart).not.toHaveBeenCalled();
  });

  it('"Giọng trình duyệt" (voiceEngine browser) never plays clips', async () => {
    setup({ engine: 'browser', provider: GEMINI });
    void speak(SAY, { mode: 'connected' });
    await flush();
    expect(urlPlays).toHaveLength(0);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it('browserOnly playback (dictation "Từng cụm") plays the shipped clip; without one, the browser voice, never the AI voice', async () => {
    setup({ provider: GEMINI });
    void speak(SAY, { mode: 'connected', browserOnly: true });
    await flush();
    expect(urlPlays.map((p) => p.url)).toEqual(['audio/c1.mp3']);
    expect(synth.speak).not.toHaveBeenCalled();
    void speak('a chunk with no clip', { mode: 'connected', browserOnly: true });
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it('manifest loading failure → the old routes, silently', async () => {
    setup({
      loader: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    void speak(SAY, { mode: 'connected' });
    await flush();
    expect(urlPlays).toHaveLength(0);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('stopping while the manifest loads plays nothing', async () => {
    let release!: (v: unknown) => void;
    setup({ loader: () => new Promise((r) => (release = r)) });
    const done = speak(SAY, { mode: 'connected' });
    stopSpeaking();
    await done;
    release(MANIFEST);
    await flush();
    expect(urlPlays).toHaveLength(0);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('stop() stops a playing clip and resolves', async () => {
    setup();
    const done = speak(SAY, { mode: 'connected' });
    await flush();
    urlPlays[0].onPlaying?.();
    stopSpeaking();
    await done;
    expect(player.stop).toHaveBeenCalled();
  });

  it('prefetch never generates (pays for) a text that has a shipped clip', async () => {
    setup({ provider: GEMINI });
    prefetchSpeech([SAY], { mode: 'connected' });
    await flush();
    expect(ai.speak).not.toHaveBeenCalled();
    prefetchSpeech(['Something else entirely.'], { mode: 'connected' });
    await flush();
    expect(ai.speak).toHaveBeenCalledTimes(1);
    expect(ai.speak.mock.calls[0][0]).toBe('Something else entirely.');
  });
});
