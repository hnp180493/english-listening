// Plays generated speech clips (AI voice) through ONE shared HTMLAudioElement.
//
// One element, reused: browsers (Safari above all) only let a page start audio from a user gesture,
// but an element that already played inside a gesture may play again later without one. AI speech
// is generated asynchronously (1–5 s after the click), so tts.ts calls prime() synchronously in the
// click and play() once the clip is ready.

export interface ClipPlayer {
  /** Call synchronously inside a user gesture: unlocks audio output for later play() calls. Never throws. */
  prime(): void;
  /**
   * Plays the clip at `rate` (pitch preserved). Resolves when it ended or was stopped; rejects when
   * the browser cannot play it (decode error, autoplay blocked: error.name 'NotAllowedError').
   */
  play(audio: Blob, rate: number): Promise<void>;
  /** Stops the clip in flight (its play() resolves). Never throws. */
  stop(): void;
}

/** AI playback rate range: below 0.5 / above 1.5 time-stretching sounds artificial. */
export const MIN_CLIP_RATE = 0.5;
export const MAX_CLIP_RATE = 1.5;

export function clampClipRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(MAX_CLIP_RATE, Math.max(MIN_CLIP_RATE, rate));
}

// 0.05 s of silence (8 kHz, 8-bit mono WAV), used to unlock the element inside a gesture.
const SILENCE = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACA' + 'gICA'.repeat(133);

type PitchAudio = HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };

export function createHtmlClipPlayer(): ClipPlayer {
  let el: PitchAudio | null = null;
  let primed = false;
  let active: { finish: () => void } | null = null;

  const element = (): PitchAudio | null => {
    if (el) return el;
    if (typeof Audio === 'undefined') return null;
    try {
      el = new Audio() as PitchAudio;
      el.preload = 'auto';
    } catch {
      el = null;
    }
    return el;
  };

  const setPitch = (a: PitchAudio) => {
    a.preservesPitch = true;
    a.webkitPreservesPitch = true;
    a.mozPreservesPitch = true;
  };

  return {
    prime() {
      if (primed) return;
      const a = element();
      if (!a) return;
      try {
        a.src = SILENCE;
        const p = a.play();
        primed = true;
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            primed = false; // try again on the next gesture
          });
        }
      } catch {
        // ignore: play() will report the problem
      }
    },

    play(audio, rate) {
      this.stop();
      const a = element();
      if (!a) return Promise.reject(Object.assign(new Error('Trình duyệt không phát được âm thanh.'), { name: 'NotSupportedError' }));
      let url: string;
      try {
        url = URL.createObjectURL(audio);
      } catch {
        return Promise.reject(new Error('Không mở được đoạn âm thanh.'));
      }
      const r = clampClipRate(rate);
      return new Promise<void>((resolve, reject) => {
        let done = false;
        const cleanup = () => {
          a.removeEventListener('ended', onEnded);
          a.removeEventListener('error', onError);
          a.removeEventListener('loadedmetadata', onMeta);
          if (active === me) active = null;
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
        };
        const finish = () => {
          if (done) return;
          done = true;
          cleanup();
          resolve();
        };
        const fail = (e: unknown) => {
          if (done) return;
          done = true;
          cleanup();
          reject(e instanceof Error ? e : new Error('Không phát được đoạn âm thanh.'));
        };
        const onEnded = () => finish();
        const onError = () => fail(new Error('Trình duyệt không giải mã được âm thanh.'));
        // Loading a new source resets playbackRate to defaultPlaybackRate in some browsers: set it again.
        const onMeta = () => {
          a.playbackRate = r;
        };
        const me = { finish };
        active = me;
        a.addEventListener('ended', onEnded);
        a.addEventListener('error', onError);
        a.addEventListener('loadedmetadata', onMeta);
        setPitch(a);
        a.defaultPlaybackRate = r;
        a.playbackRate = r;
        a.src = url;
        try {
          const p = a.play();
          if (p && typeof p.then === 'function') {
            p.then(
              () => {
                primed = true;
              },
              (e: unknown) => {
                // stop() during loading rejects play() with AbortError: that is a normal stop.
                if (e instanceof Error && e.name === 'AbortError') finish();
                else fail(e);
              },
            );
          }
        } catch (e) {
          fail(e);
        }
      });
    },

    stop() {
      const cur = active;
      active = null;
      if (el) {
        try {
          el.pause();
        } catch {
          // ignore
        }
      }
      cur?.finish();
    },
  };
}

let player: ClipPlayer | null = null;

export function getClipPlayer(): ClipPlayer {
  return (player ??= createHtmlClipPlayer());
}

/** Test hook: replace the clip player (null = back to the real one). */
export function _setClipPlayerForTests(p: ClipPlayer | null): void {
  player = p;
}
