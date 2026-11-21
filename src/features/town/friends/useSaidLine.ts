// One short voiced line of a resident outside an episode (a gift's reaction, a greeting): connected, in the speaker's
// voice (core/town/storyAudio: the clip the generator makes is the clip that plays), at the learner's rate. `auto`:
// not a click, so never a new paid request (a greeting plays by itself).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../../core/settings';
import type { StoryLine } from '../../../core/town/story';
import { storyLinePlayback } from '../../../core/town/storyAudio';
import { speak, stopSpeakingIfOwner, ttsSupported } from '../../../core/tts';

export interface SaidLine {
  canSpeak: boolean;
  /** Something is sounding now. */
  sounding: boolean;
  /** Asked to play and not over yet (a clip may still be loading). */
  playing: boolean;
  play: (line: Pick<StoryLine, 'text' | 'who' | 'say'>, placeId: string, o?: { auto?: boolean; careful?: boolean }) => Promise<boolean>;
  stop: () => void;
}

export function useSaidLine(): SaidLine {
  const settings = useSettings();
  const canSpeak = ttsSupported();
  const [owner] = useState<object>(() => ({}));
  const [sounding, setSounding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);
  const rate = useRef(settings.rate);
  useEffect(() => {
    rate.current = settings.rate;
  }, [settings.rate]);

  const stop = useCallback(() => {
    run.current++;
    stopSpeakingIfOwner(owner);
    setSounding(false);
    setPlaying(false);
  }, [owner]);

  /** Resolves true when something really sounded. */
  const play = useCallback(
    async (line: Pick<StoryLine, 'text' | 'who' | 'say'>, placeId: string, o: { auto?: boolean; careful?: boolean } = {}) => {
      if (!canSpeak || !line.text.trim()) return false;
      const my = ++run.current;
      stopSpeakingIfOwner(owner);
      setPlaying(true);
      const p = storyLinePlayback(line, { placeId }, o.careful ? 'careful' : 'connected');
      const sound = { heard: false };
      try {
        await speak(p.text, {
          rate: p.rate ?? rate.current,
          owner,
          mode: p.mode,
          auto: o.auto,
          voice: p.voice,
          onStart: () => {
            if (run.current !== my) return;
            sound.heard = true;
            setSounding(true);
          },
        });
      } catch {
        // a speech error ends it quietly
      }
      if (run.current === my) {
        setSounding(false);
        setPlaying(false);
      }
      return sound.heard;
    },
    [canSpeak, owner],
  );

  useEffect(
    () => () => {
      run.current++;
      stopSpeakingIfOwner(owner);
    },
    [owner],
  );

  return { canSpeak, sounding, playing, play, stop };
}
