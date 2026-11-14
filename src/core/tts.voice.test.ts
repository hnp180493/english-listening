// Speakers with their own voice ("Thị trấn", SpeakOptions.voice): shipped clip per voice, the AI voice with that
// Gemini voice + accent, a browser voice of the speaker's gender. The AI layer, the audio element and the manifest
// loader are mocked; no network, no key.

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { type AiSpeakResult, type ProviderSummary } from './ai';
import { audioKey } from './audioKey';
import { _resetAudioManifestForTests } from './audioManifest';
import { _setClipPlayerForTests, type ClipPlayer } from './audioPlayer';
import { CONNECTED_STYLE } from './playback';
import { updateSettings, type VoiceEngine } from './settings';
import { CAST_VOICES, type CastVoice } from './town/voices';

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

const { _resetTtsForTests, browserVoiceGender, pickSpeakerVoice, prefetchSpeech, shippedVoiceLabel, SHIPPED_VOICE_LABEL, speak, stopSpeaking } = await import('./tts');

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
const OPENAI: ProviderSummary = { ...GEMINI, id: 'o1', kind: 'openai', label: 'OpenAI', ttsModel: 'gpt-4o-mini-tts', ttsVoice: 'marin' };

const PUCK: CastVoice = CAST_VOICES.player; // male, no accent
const GRACE: CastVoice = CAST_VOICES.home; // Gacrux, female, light British accent
const LINE = 'Hi there! What can I get you?';
const SHIPPED_LINE = 'Can I get a latte, please?';

/** The kind of voice list a Windows Edge has: natural voices of both genders, a British pair, SAPI voices, one unknown. */
const VOICES = [
  { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', voiceURI: 'aria', localService: false },
  { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US', voiceURI: 'guy', localService: false },
  { name: 'Microsoft Andrew Online (Natural) - English (United States)', lang: 'en-US', voiceURI: 'andrew', localService: false },
  { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB', voiceURI: 'sonia', localService: false },
  { name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', lang: 'en-GB', voiceURI: 'ryan', localService: false },
  { name: 'Microsoft Zira - English (United States)', lang: 'en-US', voiceURI: 'zira', localService: true },
  { name: 'Microsoft David - English (United States)', lang: 'en-US', voiceURI: 'david', localService: true },
  { name: 'English United States', lang: 'en-US', voiceURI: 'android', localService: true },
  { name: 'Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', lang: 'vi-VN', voiceURI: 'hoaimy', localService: false },
];

describe('pickSpeakerVoice (pure)', () => {
  it('guesses the gender of common voice names', () => {
    expect(browserVoiceGender(VOICES[0].name)).toBe('female');
    expect(browserVoiceGender(VOICES[1].name)).toBe('male');
    expect(browserVoiceGender('Google UK English Female')).toBe('female');
    expect(browserVoiceGender('Google UK English Male')).toBe('male');
    expect(browserVoiceGender('Google US English')).toBe('female');
    expect(browserVoiceGender('Samantha')).toBe('female');
    expect(browserVoiceGender('English United States')).toBeNull();
  });

  it('no speaker (or no gender): the learner\'s chosen voice, else the best English one', () => {
    expect(pickSpeakerVoice(VOICES, null, 'david')?.voiceURI).toBe('david');
    expect(pickSpeakerVoice(VOICES, { voice: 'Puck' }, 'zira')?.voiceURI).toBe('zira');
    expect(['aria', 'guy', 'andrew']).toContain(pickSpeakerVoice(VOICES, null, null)?.voiceURI);
    expect(pickSpeakerVoice([], PUCK, null)).toBeNull();
    expect(pickSpeakerVoice([VOICES[8]], PUCK, null)).toBeNull(); // no English voice
  });

  it("a speaker gets a natural voice of their gender, never a robotic one when a natural one exists", () => {
    for (const cast of Object.values(CAST_VOICES)) {
      const v = pickSpeakerVoice(VOICES, cast, 'david')!;
      expect(browserVoiceGender(v.name), cast.voice).toBe(cast.gender);
      expect(v.name, cast.voice).toMatch(/Natural/);
    }
  });

  it('an accent prefers its language (British → en-GB)', () => {
    expect(pickSpeakerVoice(VOICES, GRACE, null)?.voiceURI).toBe('sonia');
    expect(pickSpeakerVoice(VOICES, CAST_VOICES.school, null)?.voiceURI).toBe('ryan');
  });

  it('speakers of one gender are spread over the good voices of that gender (deterministic)', () => {
    const males = Object.values(CAST_VOICES).filter((c) => c.gender === 'male' && !c.accent);
    const picked = males.map((c) => pickSpeakerVoice(VOICES, c, null)!.voiceURI);
    expect(new Set(picked).size).toBeGreaterThan(1);
    expect(males.map((c) => pickSpeakerVoice(VOICES, c, null)!.voiceURI)).toEqual(picked);
  });

  it('no installed voice of that gender: the learner\'s own voice (an unknown-gender voice list)', () => {
    const only = [VOICES[7], VOICES[6]]; // unknown + David
    expect(pickSpeakerVoice(only, GRACE, 'android')?.voiceURI).toBe('android');
    expect(pickSpeakerVoice(only, PUCK, 'android')?.voiceURI).toBe('david');
  });

  it('shipped clip label names the speaker', () => {
    expect(shippedVoiceLabel()).toBe(SHIPPED_VOICE_LABEL);
    expect(shippedVoiceLabel({ voice: 'Kore' })).toBe(SHIPPED_VOICE_LABEL);
    expect(shippedVoiceLabel(PUCK)).toBe('Gemini · Puck (có sẵn)');
  });
});

// ───────────────────────────────────────────── speak() with a voice

class FakeUtterance {
  text: string;
  voice: { voiceURI: string; name: string } | null = null;
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
let urlPlays: UrlPlay[];

/** Manifest: the Kore clip of SHIPPED_LINE (as every shipped clip today) and Puck's clip of LINE. */
const MANIFEST = { clips: { [audioKey('connected', SHIPPED_LINE)]: 'kore.mp3', [audioKey('connected', LINE, PUCK)]: 'puck.mp3' } };

function setup({ engine = 'ai' as VoiceEngine, provider = GEMINI as ProviderSummary | null } = {}) {
  _resetTtsForTests();
  _resetAudioManifestForTests(async () => MANIFEST);
  synth = {
    speaking: false,
    cancel: vi.fn<() => void>(),
    speak: vi.fn(() => {
      synth.speaking = true;
    }),
    getVoices: () => VOICES,
  };
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('window', { speechSynthesis: synth });
  urlPlays = [];
  const player: ClipPlayer = {
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
  updateSettings({ voiceEngine: engine, rate: 1, voiceURI: 'david' });
}

afterEach(() => {
  stopSpeaking();
  _setClipPlayerForTests(null);
  _resetTtsForTests();
  _resetAudioManifestForTests();
  updateSettings({ voiceEngine: 'browser', rate: 1, voiceURI: null });
  vi.unstubAllGlobals();
});

const lastUtterance = () => synth.speak.mock.calls.at(-1)?.[0] as FakeUtterance | undefined;

describe('speak with a voice', () => {
  it("plays the speaker's own shipped clip (key per voice), labelled with the speaker's voice", async () => {
    setup();
    const onVoice = vi.fn();
    void speak(LINE, { mode: 'connected', voice: PUCK, onVoice });
    await flush();
    expect(urlPlays.map((p) => p.url)).toEqual(['audio/puck.mp3']);
    urlPlays[0].onPlaying?.();
    expect(onVoice).toHaveBeenCalledWith('Gemini · Puck (có sẵn)');
    expect(ai.speak).not.toHaveBeenCalled();
  });

  it("another speaker's clip is not theirs: Kore's shipped clip is not played for Puck, nor Puck's without a voice", async () => {
    setup({ engine: 'clips' });
    void speak(SHIPPED_LINE, { mode: 'connected', voice: PUCK });
    await flush();
    expect(urlPlays).toHaveLength(0);
    expect(browserVoiceGender(lastUtterance()?.voice?.name ?? '')).toBe('male');
    void speak(LINE, { mode: 'connected' });
    await flush();
    expect(urlPlays).toHaveLength(0);
    expect(ai.speak).not.toHaveBeenCalled(); // 'clips' never pays
    // the default voice (Kore, no accent) given explicitly still finds the shipped clip
    void speak(SHIPPED_LINE, { mode: 'connected', voice: { voice: 'Kore', gender: 'female' } });
    await flush();
    expect(urlPlays.map((p) => p.url)).toEqual(['audio/kore.mp3']);
  });

  it("'clips' with no clip for the speaker: a browser voice of the speaker's gender, not the learner's (male) voice", async () => {
    setup({ engine: 'clips' });
    void speak('Lovely to see you, dear.', { mode: 'connected', voice: GRACE });
    await flush();
    expect(lastUtterance()?.voice?.voiceURI).toBe('sonia');
    void speak('No voice of its own.', { mode: 'connected' });
    await flush();
    expect(lastUtterance()?.voice?.voiceURI).toBe('david'); // unchanged without a voice
  });

  it("'ai' + Gemini: a text without the speaker's clip is generated with the speaker's voice and accent", async () => {
    setup();
    void speak('Lovely to see you, dear.', { mode: 'connected', voice: GRACE });
    await flush();
    expect(ai.speak).toHaveBeenCalledTimes(1);
    const opts = ai.speak.mock.calls[0][1]!;
    expect(opts.voice).toBe('Gacrux');
    expect(opts.style).toBe(`${CONNECTED_STYLE.replace(/American English/g, 'English')}, spoken with a light British accent`);
    // no accent: the plain mode style, the speaker's voice
    void speak('See you around.', { mode: 'connected', voice: PUCK });
    await flush();
    expect(ai.speak.mock.calls[1][1]).toMatchObject({ voice: 'Puck', style: CONNECTED_STYLE });
    // no voice: as before (the provider's own voice)
    void speak('Typed by the learner.', { mode: 'connected' });
    await flush();
    expect(ai.speak.mock.calls[2][1]).toMatchObject({ voice: undefined, style: CONNECTED_STYLE });
  });

  it('a non-Gemini AI provider keeps its own voice (a Gemini name means nothing to it), the accent stays in the style', async () => {
    setup({ provider: OPENAI });
    void speak('Lovely to see you, dear.', { mode: 'connected', voice: GRACE });
    await flush();
    expect(ai.speak.mock.calls[0][1]).toMatchObject({ voice: undefined });
    expect(String(ai.speak.mock.calls[0][1]!.style)).toContain('light British accent');
  });

  it("a text with the speaker's shipped clip is never paid for, even when its file fails", async () => {
    setup();
    void speak(LINE, { mode: 'connected', voice: PUCK });
    await flush();
    urlPlays[0].reject(new Error('404'));
    await flush();
    expect(ai.speak).not.toHaveBeenCalled();
    expect(browserVoiceGender(lastUtterance()?.voice?.name ?? '')).toBe('male');
  });

  it("auto playback never makes a new paid request: a clip made for another speaker does not count", async () => {
    setup();
    ai.speak = vi.fn(async () => ({ audio: new Blob(['x']), mime: 'audio/wav', cached: false, providerId: 'g1' }) as AiSpeakResult);
    void speak('Fresh words.', { mode: 'connected', voice: PUCK });
    await flush();
    expect(ai.speak).toHaveBeenCalledTimes(1);
    void speak('Fresh words.', { mode: 'connected', voice: GRACE, auto: true });
    await flush();
    expect(ai.speak).toHaveBeenCalledTimes(1); // Grace's clip of these words was never made: browser voice
    expect(lastUtterance()?.voice?.voiceURI).toBe('sonia');
    void speak('Fresh words.', { mode: 'connected', voice: PUCK, auto: true });
    await flush();
    expect(ai.speak).toHaveBeenCalledTimes(2); // Puck's was: replayed from the cache, no new request
  });

  it("prefetch: armed with the speaker's voice, skipped when the speaker's clip ships, released by a click", async () => {
    setup();
    prefetchSpeech([LINE], { mode: 'connected', voice: PUCK, after: 'Current line.' });
    void speak('Current line.', { mode: 'connected', voice: GRACE });
    await flush();
    // Grace's line itself was generated (a click), Puck's next line ships: not prefetched
    expect(ai.speak.mock.calls.map((c) => [c[0], c[1]?.voice])).toEqual([['Current line.', 'Gacrux']]);
    prefetchSpeech(['Next line.'], { mode: 'connected', voice: PUCK, after: 'Current line.' });
    void speak('Current line.', { mode: 'connected', voice: GRACE });
    await flush();
    expect(ai.speak.mock.calls.map((c) => [c[0], c[1]?.voice])).toContainEqual(['Next line.', 'Puck']);
  });
});
