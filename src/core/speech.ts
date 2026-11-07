// Microphone input: speech recognition (Web Speech API) and raw audio recording.
//
// - Speech recognition exists in Chrome / Edge / Safari (prefixed "webkit"); NOT in Firefox.
//   Chrome and Edge send the audio to their cloud speech service, so it needs Internet.
// - Recording uses getUserMedia + MediaRecorder; the Blob stays in memory only.
//
// The DOM lib may not ship SpeechRecognition types, so minimal ones are declared here.

// ------------------------------------------------------------ recognition types

export interface SRAlternativeLike {
  readonly transcript: string;
}

export interface SRResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SRAlternativeLike;
}

export interface SRResultListLike {
  readonly length: number;
  readonly [index: number]: SRResultLike;
}

interface SRResultEvent {
  readonly resultIndex: number;
  readonly results: SRResultListLike;
}

interface SRErrorEvent {
  readonly error: string;
}

interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SRResultEvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SRConstructor = new () => SRInstance;

function getSRConstructor(): SRConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser has a speech recognizer (Chrome, Edge, Safari; not Firefox). */
export function speechRecognitionSupported(): boolean {
  return getSRConstructor() !== null;
}

/** False on plain-http pages other than localhost: browsers block the microphone there. */
export function secureContextOk(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext !== false;
}

// ------------------------------------------------------------- recognition API

export interface RecognizerOptions {
  lang?: string; // default "en-US"
  interim?: boolean; // deliver interim (not yet final) text, default true
  continuous?: boolean; // keep listening across pauses, default false (ends after the utterance)
}

export interface Recognizer {
  start(): void;
  stop(): void; // stop listening, deliver the final result, then end
  abort(): void; // stop immediately, no more results
  /** Full transcript so far (all results joined); isFinal when every part is final. */
  onResult(cb: (text: string, isFinal: boolean) => void): void;
  onError(cb: (code: string) => void): void;
  onEnd(cb: () => void): void;
  /** Abort and drop every callback (use on unmount). */
  dispose(): void;
}

function foldPart(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Join every result's best alternative into one transcript.
 * Rebuilt from the whole list on every event, so final + interim parts never pile up twice.
 * Some Android Chrome builds repeat earlier text cumulatively ("turn it", "turn it off");
 * a part that merely extends (or repeats) the previous multi-word part replaces it.
 */
export function joinResults(results: SRResultListLike): { text: string; isFinal: boolean } {
  const parts: string[] = [];
  let isFinal = true;
  const n = results && typeof results.length === 'number' ? results.length : 0;
  for (let i = 0; i < n; i++) {
    const r = results[i];
    if (!r) continue;
    if (!r.isFinal) isFinal = false;
    const alt = r.length > 0 ? r[0] : undefined;
    const t = alt && typeof alt.transcript === 'string' ? alt.transcript.replace(/\s+/g, ' ').trim() : '';
    if (!t) continue;
    const prev = parts.length > 0 ? parts[parts.length - 1] : '';
    const fp = foldPart(prev);
    const ft = foldPart(t);
    // Only multi-word parts: a real "No, no…" must survive.
    if (fp.includes(' ') && (ft === fp || ft.startsWith(fp + ' '))) parts[parts.length - 1] = t;
    else parts.push(t);
  }
  return { text: parts.join(' ').replace(/\s+/g, ' ').trim(), isFinal };
}

/** Wrap the browser recognizer; null when unsupported. */
export function createRecognizer(opts: RecognizerOptions = {}): Recognizer | null {
  const Ctor = getSRConstructor();
  if (!Ctor) return null;
  let sr: SRInstance;
  try {
    sr = new Ctor();
  } catch {
    return null;
  }
  sr.lang = opts.lang ?? 'en-US';
  sr.interimResults = opts.interim ?? true;
  sr.continuous = opts.continuous ?? false;
  sr.maxAlternatives = 1;

  const resultCbs: ((text: string, isFinal: boolean) => void)[] = [];
  const errorCbs: ((code: string) => void)[] = [];
  const endCbs: (() => void)[] = [];
  let disposed = false;
  let running = false; // between start() and "end": a second start() would throw InvalidStateError
  let used = false; // a recognizer instance is single-use here: never restarted after it ended

  sr.onresult = (e) => {
    if (disposed || !e) return;
    const { text, isFinal } = joinResults(e.results);
    resultCbs.forEach((cb) => cb(text, isFinal));
  };
  sr.onerror = (e) => {
    if (disposed) return;
    const code = typeof e?.error === 'string' ? e.error : 'unknown';
    errorCbs.forEach((cb) => cb(code));
  };
  sr.onend = () => {
    running = false;
    if (disposed) return;
    endCbs.forEach((cb) => cb());
  };

  return {
    start() {
      // Ignore repeated calls instead of letting the browser throw InvalidStateError,
      // and never restart after "end" (no accidental onend → start loops).
      if (disposed || running || used) return;
      used = true;
      try {
        sr.start();
        running = true;
      } catch {
        // blocked start (e.g. another page owns the recognizer)
        errorCbs.forEach((cb) => cb('start-failed'));
        endCbs.forEach((cb) => cb());
      }
    },
    stop() {
      if (!running) return;
      try {
        sr.stop();
      } catch {
        // not started
      }
    },
    abort() {
      if (!running) return;
      try {
        sr.abort();
      } catch {
        // not started
      }
    },
    onResult(cb) {
      resultCbs.push(cb);
    },
    onError(cb) {
      errorCbs.push(cb);
    },
    onEnd(cb) {
      endCbs.push(cb);
    },
    dispose() {
      disposed = true;
      resultCbs.length = 0;
      errorCbs.length = 0;
      endCbs.length = 0;
      sr.onresult = null;
      sr.onerror = null;
      sr.onend = null;
      if (!running) return;
      running = false;
      try {
        sr.abort();
      } catch {
        // ignore
      }
    },
  };
}

// ---------------------------------------------------------------- error texts

/**
 * How the UI should react to an error:
 * - ignore: expected (we aborted ourselves)
 * - retry: try again (no speech heard, flaky network)
 * - permission: microphone blocked by the user/browser
 * - unavailable: recognition cannot work here → fall back to self-rating
 */
export type SpeechErrorKind = 'ignore' | 'retry' | 'permission' | 'unavailable';

export interface SpeechErrorInfo {
  code: string;
  kind: SpeechErrorKind;
  message: string; // Vietnamese, shown to the learner
}

const PERMISSION_HELP =
  'Bấm biểu tượng ổ khóa (hoặc micro) cạnh thanh địa chỉ → chọn “Cho phép” micro, rồi tải lại trang.';

/** Map a SpeechRecognition error code to a Vietnamese message. */
export function recognitionErrorInfo(code: string): SpeechErrorInfo {
  switch (code) {
    case 'aborted':
      return { code, kind: 'ignore', message: 'Đã dừng nhận dạng giọng nói.' };
    case 'not-allowed':
      return { code, kind: 'permission', message: `Cần cho phép dùng micro để nhận dạng giọng nói. ${PERMISSION_HELP}` };
    case 'service-not-allowed':
      return {
        code,
        kind: 'unavailable',
        message:
          'Trình duyệt không cho dùng dịch vụ nhận dạng giọng nói (có thể do chế độ ẩn danh hoặc chính sách). Bạn vẫn có thể ghi âm, nghe lại và tự đánh giá.',
      };
    case 'no-speech':
      return {
        code,
        kind: 'retry',
        message: 'Không nghe thấy bạn nói. Hãy nói to và rõ hơn, để micro gần miệng rồi thử lại.',
      };
    case 'audio-capture':
      return {
        code,
        kind: 'permission',
        message: 'Không lấy được âm thanh từ micro. Kiểm tra micro đã cắm chưa, hoặc có ứng dụng khác đang dùng micro không.',
      };
    case 'network':
      return {
        code,
        kind: 'retry',
        message: 'Lỗi mạng: nhận dạng giọng nói của Chrome/Edge cần kết nối Internet. Kiểm tra mạng rồi thử lại.',
      };
    case 'language-not-supported':
      return {
        code,
        kind: 'unavailable',
        message: 'Trình duyệt này không nhận dạng được tiếng Anh (en-US). Bạn vẫn có thể ghi âm và tự đánh giá.',
      };
    case 'bad-grammar':
      return { code, kind: 'retry', message: 'Trình nhận dạng gặp lỗi cấu hình. Hãy thử lại.' };
    case 'start-failed':
      return { code, kind: 'retry', message: 'Không khởi động được nhận dạng giọng nói. Đợi một chút rồi thử lại.' };
    default:
      return { code, kind: 'retry', message: `Lỗi nhận dạng giọng nói (${code}). Hãy thử lại.` };
  }
}

export type MicErrorKind = 'permission' | 'no-device' | 'busy' | 'insecure' | 'unsupported' | 'unknown';

export interface MicErrorInfo {
  kind: MicErrorKind;
  message: string;
}

/** Map a getUserMedia / MediaRecorder failure to a Vietnamese message. */
export function micErrorInfo(err: unknown): MicErrorInfo {
  const name =
    err && typeof err === 'object' && 'name' in err && typeof (err as { name: unknown }).name === 'string'
      ? (err as { name: string }).name
      : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return { kind: 'permission', message: `Bạn chưa cho phép dùng micro. ${PERMISSION_HELP}` };
    case 'SecurityError':
      return {
        kind: 'insecure',
        message: 'Trình duyệt chặn micro vì trang không chạy qua HTTPS. Hãy mở ứng dụng bằng https:// hoặc localhost.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return { kind: 'no-device', message: 'Không tìm thấy micro. Hãy cắm tai nghe có micro hoặc bật micro trong cài đặt máy.' };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        kind: 'busy',
        message: 'Micro đang bị ứng dụng khác dùng (Zoom, Meet…) hoặc bị hệ điều hành chặn. Đóng ứng dụng đó rồi thử lại.',
      };
    case 'NotSupportedError':
    case 'UnsupportedError':
      return { kind: 'unsupported', message: 'Trình duyệt này không hỗ trợ ghi âm. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.' };
    default:
      return { kind: 'unknown', message: 'Không mở được micro. Hãy thử lại, hoặc tải lại trang.' };
  }
}

// ------------------------------------------------------------------ recording

/** Container types to try, best first. Safari only records audio/mp4. */
export const MIME_CANDIDATES: readonly string[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
];

/** First supported mime type, or "" (let the browser choose) when none / unknown. */
export function pickMimeType(isSupported: (type: string) => boolean): string {
  for (const t of MIME_CANDIDATES) {
    try {
      if (isSupported(t)) return t;
    } catch {
      // ignore broken isTypeSupported
    }
  }
  return '';
}

/** True when the browser can open the microphone and record it. */
export function microphoneSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

export interface RecordingHandle {
  stream: MediaStream; // live mic stream (e.g. for a level meter); tracks stop on stop()/cancel()
  mimeType: string;
  /** Stop recording and get the audio. Always stops the mic tracks. */
  stop(): Promise<Blob>;
  /** Drop the recording and stop the mic tracks. */
  cancel(): void;
}

function stopTracks(stream: MediaStream): void {
  for (const t of stream.getTracks()) {
    try {
      t.stop();
    } catch {
      // ignore
    }
  }
}

/** Open the mic and start recording. Rejects with the getUserMedia / MediaRecorder error (see micErrorInfo). */
export async function startRecording(): Promise<RecordingHandle> {
  if (!microphoneSupported()) {
    const e = new Error('MediaRecorder unsupported');
    e.name = 'NotSupportedError';
    throw e;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  const chunks: Blob[] = [];
  let rec: MediaRecorder;
  let mime = '';
  try {
    mime = pickMimeType((t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t));
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      // isTypeSupported() said yes but the constructor disagrees: let the browser pick.
      if (!mime) throw e;
      mime = '';
      rec = new MediaRecorder(stream);
    }
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.start(250);
  } catch (e) {
    stopTracks(stream);
    throw e;
  }

  let finished = false;
  let stopPromise: Promise<Blob> | null = null;
  const blobType = () => rec.mimeType || mime || 'audio/webm';

  return {
    stream,
    mimeType: rec.mimeType || mime,
    stop() {
      if (stopPromise) return stopPromise;
      stopPromise = new Promise<Blob>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          finished = true;
          stopTracks(stream);
          resolve(new Blob(chunks, { type: blobType() }));
        };
        if (finished || rec.state === 'inactive') return finish();
        rec.onstop = finish;
        rec.onerror = finish;
        // Safety net: some browsers never fire "stop" if the track died.
        window.setTimeout(finish, 2000);
        try {
          rec.stop();
        } catch {
          finish();
        }
      });
      return stopPromise;
    },
    cancel() {
      if (finished) return;
      finished = true;
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.onerror = null;
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        // ignore
      }
      chunks.length = 0;
      stopTracks(stream);
    },
  };
}

// ---------------------------------------------------------------- level meter

/** RMS loudness 0..1 of 8-bit time-domain samples (128 = silence), boosted for speech. */
export function rmsLevel(samples: ArrayLike<number>): number {
  const n = samples.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n);
  return Math.max(0, Math.min(1, rms * 3.2));
}

/**
 * Call onLevel(0..1) about 30×/s with the mic loudness. Returns a dispose function that
 * stops the loop and closes the AudioContext (does NOT stop the stream's tracks).
 * Returns a no-op when Web Audio is unavailable.
 */
export function createLevelMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctx = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) return () => {};
  let ctx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  try {
    ctx = new Ctx();
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  } catch {
    // Never leak a half-built AudioContext (browsers cap how many can be open).
    if (ctx) void ctx.close().catch(() => {});
    return () => {};
  }
  const audio = ctx;
  const buf = new Uint8Array(analyser.fftSize);
  let raf = 0;
  let last = 0;
  let smooth = 0;
  let stopped = false;
  const tick = (t: number) => {
    if (stopped) return;
    if (t - last > 33) {
      last = t;
      analyser.getByteTimeDomainData(buf);
      const lv = rmsLevel(buf);
      smooth = lv > smooth ? lv : smooth * 0.82 + lv * 0.18;
      onLevel(smooth);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    try {
      source.disconnect();
    } catch {
      // ignore
    }
    void audio.close().catch(() => {});
    onLevel(0);
  };
}
