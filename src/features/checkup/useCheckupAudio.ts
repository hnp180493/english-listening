// TTS for the checkup: always at natural speed (CHECKUP_RATE, ignoring the learner's rate setting) with the
// learner's chosen voice; a passage is its lines in order with a short pause. The play LIMIT is not enforced
// here: the page counts a play in the test state (checkupModel.recordPlay) before calling play().

import { useCallback, useEffect, useRef, useState } from 'react';
import { CHECKUP_RATE } from '../../core/benchmark';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending, useVoiceLabel } from '../../core/tts';
import { LINE_PAUSE_MS } from './checkupModel';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface CheckupAudio {
  canSpeak: boolean;
  /** Key of what is playing (an item id), or null. */
  playing: string | null;
  /** AI voice: the clip for `playing` is being generated. */
  pending: boolean;
  play: (key: string, lines: readonly string[]) => Promise<void>;
  stop: () => void;
}

export function useCheckupAudio(): CheckupAudio {
  const [owner] = useState<object>(() => ({}));
  const run = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const pending = useSpeechPending(owner);

  const stop = useCallback(() => {
    run.current++;
    stopSpeakingIfOwner(owner);
    setPlaying(null);
  }, [owner]);

  const play = useCallback(
    async (key: string, lines: readonly string[]) => {
      if (!ttsSupported()) return;
      const my = ++run.current;
      setPlaying(key);
      try {
        for (let i = 0; i < lines.length; i++) {
          if (run.current !== my) return;
          await speak(lines[i], { rate: CHECKUP_RATE, owner });
          if (run.current !== my) return;
          if (i < lines.length - 1) await sleep(LINE_PAUSE_MS);
        }
      } catch {
        // a speech error just ends playback
      }
      if (run.current === my) setPlaying(null);
    },
    [owner],
  );

  useEffect(
    () => () => {
      run.current++;
      stopSpeakingIfOwner(owner);
    },
    [owner],
  );

  return { canSpeak: ttsSupported(), playing, pending: pending && playing !== null, play, stop };
}

/**
 * Name of the voice speak() will use, recorded with the result: "Gemini · Kore" with the AI voice, else the
 * learner's browser voice (or the best English one); null when none.
 */
export function useVoiceName(): string | null {
  return useVoiceLabel();
}
