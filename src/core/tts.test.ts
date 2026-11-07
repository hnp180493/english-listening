import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentUtteranceId,
  isSpeakingOwner,
  speak,
  speakWatchdogMs,
  stopSpeaking,
  stopSpeakingIfOwner,
} from './tts';

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

/** A speechSynthesis that never fires 'end' or 'error' (Chrome dropped-event / GC case). */
function stubSilentSynth() {
  const synth = {
    speaking: false,
    cancel: vi.fn(),
    speak: vi.fn((_u: FakeUtterance) => {
      synth.speaking = true;
    }),
    getVoices: () => [],
  };
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('window', { speechSynthesis: synth });
  return synth;
}

describe('speak() never hangs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    stopSpeaking();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves via the watchdog when no end/error event fires', async () => {
    const synth = stubSilentSynth();
    let done = false;
    void speak('hello there', { rate: 1 }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(speakWatchdogMs('hello there', 1) - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    expect(synth.cancel).toHaveBeenCalledTimes(2); // before speaking + reset of the hung queue
  });

  it('resolves right away on stopSpeaking()', async () => {
    stubSilentSynth();
    let done = false;
    void speak('hello there').then(() => (done = true));
    stopSpeaking();
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('resolves the previous call when a new one starts', async () => {
    stubSilentSynth();
    let first = false;
    void speak('one').then(() => (first = true));
    void speak('two');
    await Promise.resolve();
    expect(first).toBe(true);
  });

  it('still resolves on a normal end event', async () => {
    const synth = stubSilentSynth();
    synth.speak.mockImplementation((u: FakeUtterance) => {
      u.onend?.();
    });
    await expect(speak('hi')).resolves.toBeUndefined();
  });
});

describe('speech ownership', () => {
  afterEach(() => {
    stopSpeaking();
    vi.unstubAllGlobals();
  });

  it('gives every utterance a new id and clears it when speech stops', () => {
    stubSilentSynth();
    expect(currentUtteranceId()).toBeNull();
    void speak('one');
    const first = currentUtteranceId();
    expect(first).not.toBeNull();
    void speak('two');
    const second = currentUtteranceId();
    expect(second).not.toBeNull();
    expect(second).toBeGreaterThan(first as number);
    stopSpeaking();
    expect(currentUtteranceId()).toBeNull();
  });

  it('stopSpeakingIfOwner stops only the owner’s own speech', async () => {
    const synth = stubSilentSynth();
    const a = {};
    const b = {};
    let doneA = false;
    void speak('mine', { owner: a }).then(() => (doneA = true));
    expect(isSpeakingOwner(a)).toBe(true);
    expect(isSpeakingOwner(b)).toBe(false);

    synth.cancel.mockClear();
    expect(stopSpeakingIfOwner(b)).toBe(false);
    expect(synth.cancel).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(doneA).toBe(false);

    expect(stopSpeakingIfOwner(a)).toBe(true);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(doneA).toBe(true);
    expect(isSpeakingOwner(a)).toBe(false);
  });

  it('a component that lost the speech to someone else does not stop it on unmount', () => {
    const synth = stubSilentSynth();
    const button = {};
    const page = {};
    void speak('from the button', { owner: button });
    void speak('page autoplay', { owner: page });
    synth.cancel.mockClear();
    expect(stopSpeakingIfOwner(button)).toBe(false);
    expect(synth.cancel).not.toHaveBeenCalled();
    expect(isSpeakingOwner(page)).toBe(true);
  });

  it('speech without an owner belongs to nobody', () => {
    stubSilentSynth();
    const a = {};
    void speak('anonymous');
    expect(isSpeakingOwner(a)).toBe(false);
    expect(stopSpeakingIfOwner(a)).toBe(false);
    expect(currentUtteranceId()).not.toBeNull();
  });

  it('ownership ends when the utterance ends normally', async () => {
    const synth = stubSilentSynth();
    let end: (() => void) | null = null;
    synth.speak.mockImplementation((u: FakeUtterance) => {
      end = () => u.onend?.();
    });
    const a = {};
    const p = speak('hi', { owner: a });
    expect(isSpeakingOwner(a)).toBe(true);
    (end as (() => void) | null)?.();
    await p;
    expect(isSpeakingOwner(a)).toBe(false);
    expect(stopSpeakingIfOwner(a)).toBe(false);
  });
});
