// Playback of a whole exchange of "Chuyện ở thị trấn" in one go: every line in its speaker's voice, connected, at
// the learner's rate (level 1 a little slower, as in Chép chính tả), with a short natural pause between turns. Also
// one line on its own (the transcript's ▶, "Rõ từng từ"). Never a new paid request without a click (`auto`).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../core/settings';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending } from '../../core/tts';
import { playbackFor } from '../dictation/usePlayer';
import { passGap, type StoryItem } from './episodeModel';

/** How a pass ended: `finished` = it reached its last line (else stopped); `heard` = something really sounded. */
export interface PassEnd {
  finished: boolean;
  heard: boolean;
}

export interface StoryPass {
  canSpeak: boolean;
  /** The whole exchange is playing. */
  playing: boolean;
  /** The line sounding now (in the pass, or alone), -1 for none. */
  index: number;
  /** A line playing on its own, and how ('normal' or 'careful'). */
  single: { index: number; mode: 'normal' | 'careful' } | null;
  /** AI voice: a clip is being made. */
  pending: boolean;
  /** Something is sounding right now (not waiting for a clip, not in a pause between turns). */
  sounding: boolean;
  /** `auto`: not a click (never a new paid request). */
  playAll: (o?: { auto?: boolean }) => Promise<PassEnd>;
  playOne: (index: number, mode: 'normal' | 'careful') => Promise<void>;
  stop: () => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useStoryPass(items: readonly StoryItem[]): StoryPass {
  const settings = useSettings();
  const canSpeak = ttsSupported();
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(-1);
  const [single, setSingle] = useState<StoryPass['single']>(null);
  const [sounding, setSounding] = useState(false);
  const [owner] = useState<object>(() => ({}));
  const pending = useSpeechPending(owner);
  const runRef = useRef(0);
  const rateRef = useRef(settings.rate);
  useEffect(() => {
    rateRef.current = settings.rate;
  }, [settings.rate]);

  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(-1);
    setSingle(null);
    setSounding(false);
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    stopSpeakingIfOwner(owner);
    reset();
  }, [owner, reset]);

  const playAll = useCallback(
    async (o: { auto?: boolean } = {}): Promise<PassEnd> => {
      if (!canSpeak || items.length === 0) return { finished: true, heard: false };
      const my = ++runRef.current;
      stopSpeakingIfOwner(owner);
      setSingle(null);
      setPlaying(true);
      const sound = { heard: false };
      for (let i = 0; i < items.length; i++) {
        const gap = passGap(items[i - 1], items[i]);
        if (gap > 0) {
          setSounding(false);
          await sleep(gap);
        }
        if (runRef.current !== my) return { finished: false, heard: sound.heard };
        setIndex(i);
        const item = items[i];
        const p = playbackFor('normal', item.audio, rateRef.current);
        try {
          await speak(p.text, {
            rate: p.rate,
            owner,
            mode: p.mode,
            auto: o.auto,
            voice: item.voice,
            onStart: () => {
              if (runRef.current !== my) return;
              sound.heard = true;
              setSounding(true);
            },
          });
        } catch {
          // a speech error ends this line quietly; the pass goes on
        }
        if (runRef.current !== my) return { finished: false, heard: sound.heard };
        setSounding(false);
      }
      if (runRef.current !== my) return { finished: false, heard: sound.heard };
      reset();
      return { finished: true, heard: sound.heard };
    },
    [canSpeak, items, owner, reset],
  );

  const playOne = useCallback(
    async (i: number, mode: 'normal' | 'careful') => {
      const item = items[i];
      if (!canSpeak || !item) return;
      const my = ++runRef.current;
      stopSpeakingIfOwner(owner);
      setPlaying(false);
      setIndex(i);
      setSingle({ index: i, mode });
      const p = playbackFor(mode, item.audio, rateRef.current);
      try {
        await speak(p.text, {
          rate: p.rate,
          owner,
          mode: p.mode,
          voice: item.voice,
          onStart: () => {
            if (runRef.current === my) setSounding(true);
          },
        });
      } catch {
        // speech errors end playback quietly
      }
      if (runRef.current === my) reset();
    },
    [canSpeak, items, owner, reset],
  );

  // the panel leaves: its audio stops (what the next panel or page starts is not touched)
  useEffect(
    () => () => {
      runRef.current++;
      stopSpeakingIfOwner(owner);
    },
    [owner],
  );

  return { canSpeak, playing, index, single, pending: pending && (playing || single !== null), sounding, playAll, playOne, stop };
}
