import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MIME_CANDIDATES,
  createRecognizer,
  joinResults,
  micErrorInfo,
  pickMimeType,
  recognitionErrorInfo,
  rmsLevel,
  secureContextOk,
  speechRecognitionSupported,
  type SRResultLike,
} from './speech';

function res(transcript: string, isFinal: boolean): SRResultLike {
  return { isFinal, length: 1, 0: { transcript } };
}

describe('joinResults', () => {
  it('joins all results and reports finality', () => {
    const list = { length: 2, 0: res('turn it', true), 1: res(' off please ', false) };
    expect(joinResults(list)).toEqual({ text: 'turn it off please', isFinal: false });
  });
  it('is final when every part is final', () => {
    const list = { length: 2, 0: res('hello', true), 1: res('there', true) };
    expect(joinResults(list)).toEqual({ text: 'hello there', isFinal: true });
  });
  it('handles empty and malformed results', () => {
    expect(joinResults({ length: 0 })).toEqual({ text: '', isFinal: true });
    const broken = { length: 2, 0: { isFinal: true, length: 0 } as SRResultLike, 1: res('  ', true) };
    expect(joinResults(broken).text).toBe('');
  });
  it('rebuilds from the full list so final + interim never double up', () => {
    // event 1: interim only; event 2: same words now final plus a new interim part
    expect(joinResults({ length: 1, 0: res('did you', false) }).text).toBe('did you');
    const second = { length: 2, 0: res('did you', true), 1: res('eat yet', false) };
    expect(joinResults(second)).toEqual({ text: 'did you eat yet', isFinal: false });
  });
  it('collapses cumulative repeats (Android) but keeps real one-word repeats', () => {
    const cumulative = { length: 3, 0: res('turn it', true), 1: res('turn it off', true), 2: res('please', true) };
    expect(joinResults(cumulative).text).toBe('turn it off please');
    const same = { length: 2, 0: res('Turn it off', true), 1: res('turn it off', true) };
    expect(joinResults(same).text).toBe('turn it off');
    const realNo = { length: 2, 0: res('No', true), 1: res('no it is fine', true) };
    expect(joinResults(realNo).text).toBe('No no it is fine');
  });
});

/** Minimal fake of the browser recognizer that throws like Chrome on a double start. */
class FakeSR {
  static last: FakeSR | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  running = false;
  starts = 0;
  aborts = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeSR.last = this;
  }
  start() {
    if (this.running) throw new Error('InvalidStateError');
    this.running = true;
    this.starts++;
  }
  stop() {
    this.end();
  }
  abort() {
    this.aborts++;
    this.end();
  }
  end() {
    if (!this.running) return;
    this.running = false;
    this.onend?.();
  }
}

describe('createRecognizer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSR.last = null;
  });

  it('returns null without a browser recognizer', () => {
    expect(createRecognizer()).toBeNull();
  });

  it('never double-starts and never restarts after end', () => {
    vi.stubGlobal('window', { webkitSpeechRecognition: FakeSR });
    const r = createRecognizer({ continuous: true });
    const sr = FakeSR.last;
    if (!r || !sr) throw new Error('no recognizer');
    expect(sr.lang).toBe('en-US');
    expect(sr.continuous).toBe(true);
    const errors: string[] = [];
    let ends = 0;
    r.onError((c) => errors.push(c));
    r.onEnd(() => {
      ends++;
      r.start(); // a naive "restart on end" must not loop
    });
    r.start();
    r.start();
    expect(sr.starts).toBe(1);
    expect(errors).toEqual([]);
    r.stop();
    expect(ends).toBe(1);
    expect(sr.starts).toBe(1);
  });

  it('delivers joined results and goes silent after dispose', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeSR });
    const r = createRecognizer();
    const sr = FakeSR.last;
    if (!r || !sr) throw new Error('no recognizer');
    const seen: [string, boolean][] = [];
    r.onResult((t, f) => seen.push([t, f]));
    r.start();
    sr.onresult?.({ resultIndex: 0, results: { length: 1, 0: res('hi there', true) } });
    expect(seen).toEqual([['hi there', true]]);
    r.dispose();
    expect(sr.aborts).toBe(1);
    expect(sr.onresult).toBeNull();
    r.dispose(); // idempotent, no second abort
    expect(sr.aborts).toBe(1);
  });

  it('reports a failed start as an error followed by end', () => {
    class Broken extends FakeSR {
      start() {
        throw new Error('blocked');
      }
    }
    vi.stubGlobal('window', { webkitSpeechRecognition: Broken });
    const r = createRecognizer();
    if (!r) throw new Error('no recognizer');
    const log: string[] = [];
    r.onError((c) => log.push(c));
    r.onEnd(() => log.push('end'));
    r.start();
    expect(log).toEqual(['start-failed', 'end']);
    r.stop(); // not running: no throw
    r.dispose();
  });
});

describe('recognitionErrorInfo', () => {
  it('maps known codes to Vietnamese messages and kinds', () => {
    expect(recognitionErrorInfo('not-allowed').kind).toBe('permission');
    expect(recognitionErrorInfo('not-allowed').message).toMatch(/cho phép/);
    expect(recognitionErrorInfo('no-speech').kind).toBe('retry');
    expect(recognitionErrorInfo('network').message).toMatch(/mạng/);
    expect(recognitionErrorInfo('audio-capture').message).toMatch(/micro/);
    expect(recognitionErrorInfo('aborted').kind).toBe('ignore');
    expect(recognitionErrorInfo('service-not-allowed').kind).toBe('unavailable');
    expect(recognitionErrorInfo('language-not-supported').kind).toBe('unavailable');
  });
  it('falls back for unknown codes', () => {
    const info = recognitionErrorInfo('weird-thing');
    expect(info.kind).toBe('retry');
    expect(info.message).toContain('weird-thing');
  });
});

describe('micErrorInfo', () => {
  it('maps DOMException names', () => {
    expect(micErrorInfo({ name: 'NotAllowedError' }).kind).toBe('permission');
    expect(micErrorInfo({ name: 'PermissionDeniedError' }).kind).toBe('permission');
    expect(micErrorInfo({ name: 'NotFoundError' }).kind).toBe('no-device');
    expect(micErrorInfo({ name: 'NotReadableError' }).kind).toBe('busy');
    expect(micErrorInfo({ name: 'SecurityError' }).kind).toBe('insecure');
    expect(micErrorInfo({ name: 'NotSupportedError' }).kind).toBe('unsupported');
  });
  it('handles junk', () => {
    expect(micErrorInfo(null).kind).toBe('unknown');
    expect(micErrorInfo('boom').kind).toBe('unknown');
    expect(micErrorInfo({ name: 42 }).kind).toBe('unknown');
  });
});

describe('pickMimeType', () => {
  it('prefers webm/opus', () => {
    expect(pickMimeType(() => true)).toBe(MIME_CANDIDATES[0]);
  });
  it('picks mp4 on Safari-like browsers', () => {
    expect(pickMimeType((t) => t.startsWith('audio/mp4'))).toBe('audio/mp4;codecs=mp4a.40.2');
  });
  it('returns empty string when nothing is supported or the check throws', () => {
    expect(pickMimeType(() => false)).toBe('');
    expect(
      pickMimeType(() => {
        throw new Error('x');
      }),
    ).toBe('');
  });
});

describe('rmsLevel', () => {
  it('is 0 for silence and empty input', () => {
    expect(rmsLevel(new Uint8Array(64).fill(128))).toBe(0);
    expect(rmsLevel([])).toBe(0);
  });
  it('is clamped to 1 for full-scale signal', () => {
    const loud = Array.from({ length: 64 }, (_, i) => (i % 2 ? 255 : 0));
    expect(rmsLevel(loud)).toBe(1);
  });
  it('grows with amplitude', () => {
    const quiet = Array.from({ length: 64 }, (_, i) => (i % 2 ? 132 : 124));
    const louder = Array.from({ length: 64 }, (_, i) => (i % 2 ? 148 : 108));
    expect(rmsLevel(louder)).toBeGreaterThan(rmsLevel(quiet));
  });
});

describe('environment checks outside a browser', () => {
  it('do not crash', () => {
    expect(speechRecognitionSupported()).toBe(false);
    expect(secureContextOk()).toBe(true);
  });
});
