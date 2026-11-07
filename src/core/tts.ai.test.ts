// Routing between the browser voice and the AI voice, fallback, pending state, prefetch.
// The AI layer (aiSpeak/aiStatus) and the audio element are mocked; no network, no key.

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AiError, type AiSpeakResult, type ProviderSummary } from './ai';
import { _setClipPlayerForTests, type ClipPlayer } from './audioPlayer';
import { updateSettings } from './settings';

const ai = vi.hoisted(() => ({
  version: 0,
  tts: null as unknown,
  overCap: false,
  speak: null as unknown as Mock<(text: string, opts?: Record<string, unknown>) => Promise<unknown>>,
}));

vi.mock('./ai', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./ai')>();
  return {
    ...orig,
    aiVersion: () => ai.version,
    aiStatus: () => ({ configured: !!ai.tts, text: ai.tts, tts: ai.tts, providers: [], overDailyCap: ai.overCap }),
    aiSpeak: (text: string, opts?: Record<string, unknown>) => ai.speak(text, opts),
  };
});

const tts = await import('./tts');
const {
  AI_COOLDOWN_MS,
  AI_PLAY_TIMEOUT_MS,
  AI_PREFETCH_TIMEOUT_MS,
  PREFETCH_CONCURRENCY,
  aiVoicePausedReason,
  VOICE_NOTICE_PREFIX,
  _resetTtsForTests,
  currentVoiceLabel,
  dismissVoiceNotice,
  getVoiceStatus,
  isSpeakingOwner,
  prefetchSpeech,
  speak,
  stopSpeaking,
  stopSpeakingIfOwner,
  ttsSupported,
} = tts;

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

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

let synth: { speaking: boolean; cancel: Mock<() => void>; speak: Mock<(u: FakeUtterance) => void>; getVoices: () => unknown[] };
let player: ClipPlayer & { play: Mock<(audio: Blob, rate: number) => Promise<void>>; stop: Mock<() => void>; prime: Mock<() => void> };
let playing: Deferred<void> | null;
let calls: { text: string; opts: Record<string, unknown>; d: Deferred<AiSpeakResult> }[];

function clip(): AiSpeakResult {
  return { audio: new Blob([new Uint8Array(8)], { type: 'audio/wav' }), mime: 'audio/wav', cached: false, providerId: 'g1' };
}

function setup({ engine = 'ai', provider = GEMINI as ProviderSummary | null, withSynth = true } = {}) {
  _resetTtsForTests();
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
  vi.stubGlobal('window', withSynth ? { speechSynthesis: synth } : {});
  playing = null;
  player = {
    prime: vi.fn<() => void>(),
    play: vi.fn((_audio: Blob, _rate: number) => {
      playing = deferred<void>();
      return playing.promise;
    }),
    stop: vi.fn(() => {
      playing?.resolve();
    }),
  };
  _setClipPlayerForTests(player);
  calls = [];
  ai.speak = vi.fn((text: string, opts: Record<string, unknown> = {}): Promise<unknown> => {
    const d = deferred<AiSpeakResult>();
    calls.push({ text, opts, d });
    return d.promise;
  });
  ai.tts = provider;
  ai.version++;
  updateSettings({ voiceEngine: engine as 'ai' | 'browser', rate: 1 });
}

afterEach(() => {
  stopSpeaking();
  _setClipPlayerForTests(null);
  _resetTtsForTests();
  updateSettings({ voiceEngine: 'browser', rate: 1 });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('routing', () => {
  it("voiceEngine 'browser' uses speechSynthesis even when an AI voice is configured", () => {
    setup({ engine: 'browser' });
    void speak('hello');
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(ai.speak).not.toHaveBeenCalled();
    expect(currentVoiceLabel()).toBe('Microsoft Aria Online (Natural) - English (United States)');
  });

  it("voiceEngine 'ai' without a usable speech provider uses the browser voice unchanged", () => {
    setup({ provider: null });
    void speak('hello');
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it("voiceEngine 'ai' with a provider: aiSpeak → audio element, no speechSynthesis", async () => {
    setup();
    const owner = {};
    let done = false;
    void speak('turn it off', { owner }).then(() => (done = true));
    expect(ai.speak).toHaveBeenCalledTimes(1);
    expect(calls[0].text).toBe('turn it off');
    expect(calls[0].opts.signal).toBeUndefined(); // a stopped playback still finishes into the cache
    expect(player.prime).toHaveBeenCalledTimes(1); // unlocked inside the click
    expect(synth.speak).not.toHaveBeenCalled();
    expect(getVoiceStatus()).toMatchObject({ pending: true, pendingOwner: owner });
    expect(isSpeakingOwner(owner)).toBe(true);

    calls[0].d.resolve(clip());
    await flush();
    expect(getVoiceStatus().pending).toBe(false);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.play.mock.calls[0][1]).toBe(1);
    expect(done).toBe(false);
    playing?.resolve();
    await flush();
    expect(done).toBe(true);
    expect(isSpeakingOwner(owner)).toBe(false);
  });

  it('maps the rate to playbackRate, clamped to 0.5–1.5', async () => {
    setup();
    for (const [rate, expected] of [
      [0.7, 0.7],
      [0.3, 0.5],
      [2, 1.5],
    ] as const) {
      void speak(`rate ${rate}`, { rate });
      calls[calls.length - 1].d.resolve(clip());
      await flush();
      expect(player.play.mock.calls.at(-1)?.[1]).toBe(expected);
    }
    updateSettings({ rate: 0.8 });
    void speak('settings rate');
    calls[calls.length - 1].d.resolve(clip());
    await flush();
    expect(player.play.mock.calls.at(-1)?.[1]).toBe(0.8);
  });

  it('labels the AI voice "Gemini · Kore" and says it can speak without speechSynthesis', () => {
    setup({ withSynth: false });
    expect(currentVoiceLabel()).toBe('Gemini · Kore');
    expect(ttsSupported()).toBe(true);
    updateSettings({ voiceEngine: 'browser' });
    expect(ttsSupported()).toBe(false);
    expect(currentVoiceLabel()).toBeNull();
  });
});

describe('fallback to the browser voice', () => {
  it('on an AI error: plays the same text with speechSynthesis and shows the notice once', async () => {
    setup();
    const p = speak('hello there', { owner: {} });
    calls[0].d.reject(new AiError('bad-response', 'Google Gemini trả về dữ liệu không đúng định dạng.', { retryable: true }));
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('hello there');
    const s = getVoiceStatus();
    expect(s.pending).toBe(false);
    expect(s.error).toBe('Google Gemini trả về dữ liệu không đúng định dạng.');
    expect(s.notice).toBe(VOICE_NOTICE_PREFIX + 'Google Gemini trả về dữ liệu không đúng định dạng.');
    expect(s.noticeId).toBe(1);
    // the promise resolves with the browser utterance
    (synth.speak.mock.calls[0][0] as FakeUtterance).onend?.();
    await expect(p).resolves.toBeUndefined();

    // the same failure again: no second notice after dismissing
    dismissVoiceNotice();
    void speak('again');
    calls[1].d.reject(new AiError('bad-response', 'Google Gemini trả về dữ liệu không đúng định dạng.', { retryable: true }));
    await flush();
    expect(getVoiceStatus().notice).toBeNull();
    expect(getVoiceStatus().noticeId).toBe(1);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('a failure that needs the settings fixed switches to the browser voice until the AI settings change', async () => {
    setup();
    void speak('one');
    calls[0].d.reject(new AiError('bad-key', 'API key Gemini không hợp lệ.', { retryable: false }));
    await flush();
    expect(currentVoiceLabel()).not.toBe('Gemini · Kore');
    void speak('two');
    expect(ai.speak).toHaveBeenCalledTimes(1); // no more doomed requests
    expect(synth.speak).toHaveBeenCalledTimes(2);

    // the learner pastes a new key
    ai.tts = { ...GEMINI, keyMasked: 'AIza…NEW1' };
    ai.version++;
    void speak('three');
    expect(ai.speak).toHaveBeenCalledTimes(2);
  });

  it('a network failure pauses the AI voice for a cooldown, then tries again', async () => {
    vi.useFakeTimers();
    setup();
    void speak('one');
    calls[0].d.reject(new AiError('network', 'Không kết nối được.', { retryable: true }));
    await flush();
    void speak('two');
    expect(ai.speak).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(AI_COOLDOWN_MS + 1);
    void speak('three');
    expect(ai.speak).toHaveBeenCalledTimes(2);
  });

  it('falls back after AI_PLAY_TIMEOUT_MS even when the request it joined has a longer timeout (robust-1)', async () => {
    vi.useFakeTimers();
    setup();
    let done = false;
    void speak('slow one').then(() => (done = true));
    expect(calls[0].opts).toMatchObject({ timeoutMs: AI_PLAY_TIMEOUT_MS, retries: 0 });
    // the mocked aiSpeak never settles (like a joined 60 s prefetch flight)
    await vi.advanceTimersByTimeAsync(AI_PLAY_TIMEOUT_MS - 1);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(getVoiceStatus().pending).toBe(true);
    await vi.advanceTimersByTimeAsync(2);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('slow one');
    expect(getVoiceStatus().pending).toBe(false);
    expect(getVoiceStatus().error).toContain('quá lâu');
    (synth.speak.mock.calls[0][0] as FakeUtterance).onend?.();
    await flush();
    expect(done).toBe(true);
    // the late clip never plays
    calls[0].d.resolve(clip());
    await flush();
    expect(player.play).not.toHaveBeenCalled();
    // and the next click does not wait again: the AI voice pauses
    void speak('next');
    expect(ai.speak).toHaveBeenCalledTimes(1);
  });

  it('a 429 falls back at once and pauses the AI voice for the server retry delay (robust-3, ux-3)', async () => {
    vi.useFakeTimers();
    setup();
    void speak('one');
    calls[0].d.reject(new AiError('rate-limit', 'Gemini đang giới hạn tốc độ. Đợi khoảng 18 giây rồi thử lại.', { retryAfterMs: 18_000 }));
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(aiVoicePausedReason()).toContain('giới hạn tốc độ');
    void speak('two');
    expect(ai.speak).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(18_001);
    expect(aiVoicePausedReason()).toBeNull();
    void speak('three');
    expect(ai.speak).toHaveBeenCalledTimes(2);
  });

  it('a server error pauses the AI voice like a network error (ux-3)', async () => {
    vi.useFakeTimers();
    setup();
    void speak('one');
    calls[0].d.reject(new AiError('server', 'Máy chủ Google Gemini đang gặp sự cố (500).', { retryable: true }));
    await flush();
    void speak('two');
    expect(ai.speak).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(AI_COOLDOWN_MS + 1);
    void speak('three');
    expect(ai.speak).toHaveBeenCalledTimes(2);
  });

  it('rate-limit notices with different wait times show once (robust-4)', async () => {
    vi.useFakeTimers();
    setup();
    void speak('one');
    calls[0].d.reject(new AiError('rate-limit', 'Đợi khoảng 18 giây rồi thử lại.', { retryAfterMs: 18_000 }));
    await flush();
    expect(getVoiceStatus().noticeId).toBe(1);
    dismissVoiceNotice();
    vi.advanceTimersByTime(18_001);
    void speak('two');
    calls[1].d.reject(new AiError('rate-limit', 'Đợi khoảng 7 giây rồi thử lại.', { retryAfterMs: 7_000 }));
    await flush();
    expect(getVoiceStatus().noticeId).toBe(1);
    expect(getVoiceStatus().notice).toBeNull();
    expect(getVoiceStatus().error).toBe('Đợi khoảng 7 giây rồi thử lại.');
  });

  it('reaching the daily cap the learner set does not switch the AI voice off: cached clips still play (robust-5)', async () => {
    setup();
    ai.overCap = true;
    try {
      void speak('new sentence');
      calls[0].d.reject(new AiError('quota', 'Đã đạt giới hạn 1 yêu cầu AI mỗi ngày mà bạn tự đặt.', { retryable: false }));
      await flush();
      expect(synth.speak).toHaveBeenCalledTimes(1);
      expect(aiVoicePausedReason()).toBeNull();
      void speak('cached sentence'); // aiSpeak serves cache hits even over the cap
      expect(ai.speak).toHaveBeenCalledTimes(2);
      calls[1].d.resolve({ ...clip(), cached: true });
      await flush();
      expect(player.play).toHaveBeenCalledTimes(1);
    } finally {
      ai.overCap = false;
    }
  });

  it('a provider quota (not the self-set cap) still switches to the browser voice', async () => {
    setup();
    void speak('one');
    calls[0].d.reject(new AiError('quota', 'Đã hết hạn mức của Google Gemini.', { retryable: false }));
    await flush();
    void speak('two');
    expect(ai.speak).toHaveBeenCalledTimes(1);
    expect(aiVoicePausedReason()).toBe('Đã hết hạn mức của Google Gemini.');
  });

  it('when the audio element cannot play the clip', async () => {
    setup();
    player.play.mockImplementationOnce(() => Promise.reject(new Error('Trình duyệt không giải mã được âm thanh.')));
    void speak('hello');
    calls[0].d.resolve(clip());
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(getVoiceStatus().notice).toBe(VOICE_NOTICE_PREFIX + 'Trình duyệt không giải mã được âm thanh.');
  });

  it('autoplay blocked (NotAllowedError) falls back without an AI error notice', async () => {
    setup();
    player.play.mockImplementationOnce(() => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })));
    void speak('hello');
    calls[0].d.resolve(clip());
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(getVoiceStatus().notice).toBeNull();
  });

  it('never leaks a non-Vietnamese raw error message', async () => {
    setup();
    void speak('hello');
    calls[0].d.reject(new TypeError('x is undefined'));
    await flush();
    expect(getVoiceStatus().error).toBe('Không phát được giọng AI.');
  });
});

describe('stop / replace while generating', () => {
  it('stopSpeaking() while pending resolves at once and never plays the late clip', async () => {
    setup();
    let done = false;
    void speak('hello').then(() => (done = true));
    stopSpeaking();
    await flush();
    expect(done).toBe(true);
    expect(getVoiceStatus().pending).toBe(false);
    calls[0].d.resolve(clip());
    await flush();
    expect(player.play).not.toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('a late failure of a stopped playback falls back to nothing and shows nothing', async () => {
    setup();
    void speak('hello');
    stopSpeaking();
    calls[0].d.reject(new AiError('server', 'Lỗi máy chủ.', { retryable: true }));
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(getVoiceStatus().notice).toBeNull();
  });

  it('stopSpeaking() while the clip sounds stops the audio element', async () => {
    setup();
    let done = false;
    void speak('hello').then(() => (done = true));
    calls[0].d.resolve(clip());
    await flush();
    stopSpeaking();
    await flush();
    expect(player.stop).toHaveBeenCalled();
    expect(done).toBe(true);
  });

  it('a new speak() replaces the pending one: only the newest clip plays', async () => {
    setup();
    let first = false;
    void speak('one').then(() => (first = true));
    void speak('two');
    await flush();
    expect(first).toBe(true);
    calls[0].d.resolve(clip());
    calls[1].d.resolve(clip());
    await flush();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('stopSpeakingIfOwner cancels only its own pending playback', async () => {
    setup();
    const a = {};
    const b = {};
    void speak('mine', { owner: a });
    expect(stopSpeakingIfOwner(b)).toBe(false);
    expect(getVoiceStatus().pending).toBe(true);
    expect(stopSpeakingIfOwner(a)).toBe(true);
    expect(getVoiceStatus().pending).toBe(false);
  });

  it('a hung clip is ended by the watchdog', async () => {
    vi.useFakeTimers();
    setup();
    let done = false;
    void speak('hi').then(() => (done = true));
    calls[0].d.resolve(clip());
    await flush();
    await vi.advanceTimersByTimeAsync(tts.speakWatchdogMs('hi', 1) * 1.5 + 1);
    expect(done).toBe(true);
    expect(player.stop).toHaveBeenCalled();
  });
});

describe('prefetchSpeech', () => {
  it('is a no-op with the browser voice', () => {
    setup({ engine: 'browser' });
    prefetchSpeech(['a', 'b']);
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it('warms the cache with at most 2 requests at a time, skipping duplicates', async () => {
    setup();
    void speak('played'); // the learner listened once: from now on the next sentences are prefetched too
    stopSpeaking();
    calls.length = 0;
    prefetchSpeech(['one', 'two', 'three', 'one', ' ', 'two']);
    expect(PREFETCH_CONCURRENCY).toBe(2);
    expect(calls.map((c) => c.text)).toEqual(['one', 'two']);
    expect(calls[0].opts).toMatchObject({ timeoutMs: AI_PREFETCH_TIMEOUT_MS });
    prefetchSpeech(['three']); // already queued
    expect(calls).toHaveLength(2);
    calls[0].d.resolve(clip());
    await flush();
    expect(calls.map((c) => c.text)).toEqual(['one', 'two', 'three']);
    calls[1].d.reject(new AiError('server', 'x', { retryable: true }));
    calls[2].d.resolve(clip());
    await flush();
    expect(getVoiceStatus().notice).toBeNull(); // transient prefetch failures are quiet
  });

  it('before the first AI playback only the current sentence is generated (robust-9)', () => {
    setup();
    prefetchSpeech(['current', 'next']);
    expect(calls.map((c) => c.text)).toEqual(['current']);
    void speak('current'); // the first AI playback: the held-back next sentence is generated now
    expect(calls.map((c) => c.text)).toEqual(['current', 'current', 'next']);
    prefetchSpeech(['current', 'next']); // already in flight / queued
    expect(calls).toHaveLength(3);
  });

  it('a rate limit while prefetching pauses the AI voice; nothing more is prefetched (robust-3)', async () => {
    setup();
    void speak('x');
    stopSpeaking();
    calls.length = 0;
    prefetchSpeech(['one']);
    calls[0].d.reject(new AiError('rate-limit', 'Gemini đang giới hạn tốc độ. Đợi khoảng 20 giây rồi thử lại.', { retryAfterMs: 20_000 }));
    await flush();
    prefetchSpeech(['two', 'three']);
    expect(calls).toHaveLength(1);
    void speak('hello');
    expect(calls).toHaveLength(1);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('nothing is prefetched once the daily cap the learner set is reached (robust-5)', () => {
    setup();
    ai.overCap = true;
    try {
      prefetchSpeech(['one']);
      expect(calls).toHaveLength(0);
    } finally {
      ai.overCap = false;
    }
  });

  it('a hard failure while prefetching switches playback to the browser voice with the notice', async () => {
    setup();
    prefetchSpeech(['one']);
    calls[0].d.reject(new AiError('bad-key', 'API key Gemini không hợp lệ.', { retryable: false }));
    await flush();
    expect(getVoiceStatus().notice).toBe(VOICE_NOTICE_PREFIX + 'API key Gemini không hợp lệ.');
    void speak('hello');
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });
});
