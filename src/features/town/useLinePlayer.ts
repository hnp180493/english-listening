// Playback of one line said in Thị trấn. A line is a built-in dictation sentence, so it sends EXACTLY what Chép
// chính tả sends for it (playbackFor: same text, rate and mode), and the shipped clip plays:
//  - 'normal': the connected version at the learner's rate (level 1 a little slower, still connected);
//  - 'slow': connected, slower ("Chậm": still linked and reduced, so it does not give the words away);
//  - 'careful': the written text, slowly ("Rõ từng từ"): offered only after the meaning was chosen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../core/settings';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending } from '../../core/tts';
import type { DictationAudio } from '../dictation/decodeCache';
import { playbackFor } from '../dictation/usePlayer';

export type LinePlay = 'normal' | 'slow' | 'careful';

export interface LinePlayer {
  canSpeak: boolean;
  playing: LinePlay | null;
  /** AI voice: the clip for `playing` is being generated. */
  pending: boolean;
  /**
   * `toggle` (default true): a press on the button that is playing stops it. `auto`: not a click (the line starts by
   * itself): never a new paid AI request (SpeakOptions.auto).
   */
  play: (mode: LinePlay, o?: { toggle?: boolean; auto?: boolean }) => Promise<void>;
  stop: () => void;
}

/**
 * `onPlay(mode, rate)`: called once per play that counts as a listen (a press: at the press; the automatic play:
 * when it starts to sound), with Settings → Tốc độ đọc at the moment the play was asked for (the tally needs it: a
 * normal play below normal speed counts as a slowed one).
 */
export function useLinePlayer(audio: DictationAudio, onPlay: (mode: LinePlay, rate: number) => void): LinePlayer {
  const settings = useSettings();
  const { connected, careful, level } = audio;
  const canSpeak = ttsSupported();
  const [playing, setPlaying] = useState<LinePlay | null>(null);
  // Ownership token: "generating" shows only for this line's own speech, and unmount stops only its own speech.
  const [owner] = useState<object>(() => ({}));
  const pending = useSpeechPending(owner);
  const runRef = useRef(0);
  const playingRef = useRef<LinePlay | null>(null);
  const rateRef = useRef(settings.rate);
  useEffect(() => {
    rateRef.current = settings.rate;
  }, [settings.rate]);
  const onPlayRef = useRef(onPlay);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  const stop = useCallback(() => {
    runRef.current++;
    stopSpeakingIfOwner(owner);
    playingRef.current = null;
    setPlaying(null);
  }, [owner]);

  const play = useCallback(
    async (mode: LinePlay, o: { toggle?: boolean; auto?: boolean } = {}) => {
      if (!canSpeak) return;
      if (o.toggle !== false && playingRef.current === mode) {
        stop();
        return;
      }
      const my = ++runRef.current;
      playingRef.current = mode;
      setPlaying(mode);
      const rate = rateRef.current;
      const note = () => onPlayRef.current(mode, rate);
      // A press counts at once, as in Chép chính tả. The automatic play counts when its sound really starts: where
      // the browser does not let a page speak by itself (the first audio on an iPhone), nothing was heard, so
      // nothing is counted and the learner's own press of "Nghe" is still the first listen.
      if (!o.auto) note();
      try {
        const p = playbackFor(mode, { connected, careful, level }, rate);
        await speak(p.text, {
          rate: p.rate,
          owner,
          mode: p.mode,
          slow: p.slow,
          auto: o.auto,
          onStart: o.auto
            ? () => {
                if (runRef.current === my) note();
              }
            : undefined,
        });
      } catch {
        // speech errors end playback quietly
      }
      if (runRef.current !== my) return;
      playingRef.current = null;
      setPlaying(null);
    },
    [canSpeak, connected, careful, level, owner, stop],
  );

  // the line leaves the screen: its audio stops (whatever the next line or page starts is not touched)
  useEffect(
    () => () => {
      runRef.current++;
      stopSpeakingIfOwner(owner);
    },
    [owner],
  );

  return { canSpeak, playing, pending: pending && playing !== null, play, stop };
}
