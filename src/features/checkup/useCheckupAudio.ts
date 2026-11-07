// TTS for the checkup: always at natural speed (CHECKUP_RATE, ignoring the learner's rate setting) with the
// learner's chosen voice; a passage is its lines in order with a short pause. The checkup measures understanding of
// natural speech, so every line plays its CONNECTED version (src/core/playback.ts: authored `say`, else the
// decoder's speakText) with the connected AI style; results record audioMode 'connected' (core/benchmark.ts). The play LIMIT is not enforced
// here: the page counts a play in the test state (checkupModel.recordPlay) before calling play().

import { useCallback, useEffect, useRef, useState } from 'react';
import { CHECKUP_RATE } from '../../core/benchmark';
import { connectedText } from '../../core/playback';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending, useVoiceLabel } from '../../core/tts';
import { safeDecode } from '../dictation/decodeCache';
import { LINE_PAUSE_MS } from './checkupModel';

/**
 * The connected versions of checkup lines (what is spoken and prefetched). `say`: authored speakable text, used
 * before the decoder's speakText: a string for a one-line item (BenchmarkSentence.say), or one entry per line
 * (BenchmarkQuestion.say).
 */
export function connectedLines(lines: readonly string[], say?: string | readonly (string | undefined)[]): string[] {
  return lines.map((l, i) => {
    const override = typeof say === 'string' ? (lines.length === 1 ? say : undefined) : say?.[i];
    return connectedText(l, safeDecode(l), override);
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface CheckupAudio {
  canSpeak: boolean;
  /** Key of what is playing (an item id), or null. */
  playing: string | null;
  /** AI voice: the clip for `playing` is being generated. */
  pending: boolean;
  /** Plays `lines` (written text) as their connected versions; `say` = authored override(s), see connectedLines. */
  play: (key: string, lines: readonly string[], say?: string | readonly (string | undefined)[]) => Promise<void>;
  stop: () => void;
}

/** `onVoice`: told the name of each voice that actually speaks (see SpeakOptions.onVoice). */
export function useCheckupAudio(onVoice?: (label: string | null) => void): CheckupAudio {
  const [owner] = useState<object>(() => ({}));
  const voiceRef = useRef(onVoice);
  useEffect(() => {
    voiceRef.current = onVoice;
  }, [onVoice]);
  const run = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const pending = useSpeechPending(owner);

  const stop = useCallback(() => {
    run.current++;
    stopSpeakingIfOwner(owner);
    setPlaying(null);
  }, [owner]);

  const play = useCallback(
    async (key: string, lines: readonly string[], say?: string | readonly (string | undefined)[]) => {
      if (!ttsSupported()) return;
      const my = ++run.current;
      setPlaying(key);
      const spoken = connectedLines(lines, say);
      try {
        for (let i = 0; i < spoken.length; i++) {
          if (run.current !== my) return;
          await speak(spoken[i], { rate: CHECKUP_RATE, owner, mode: 'connected', onVoice: (label) => voiceRef.current?.(label) });
          if (run.current !== my) return;
          if (i < spoken.length - 1) await sleep(LINE_PAUSE_MS);
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
 * Name of the voice speak() will use next: "Gemini · Kore" with the AI voice, else the learner's browser voice
 * (or the best English one); null when none. Shown on the intro; the result records the voices that actually
 * spoke (checkupModel.noteVoice) and falls back to this only when nothing was played.
 */
export function useVoiceName(): string | null {
  return useVoiceLabel();
}
