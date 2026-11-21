// Plays what a hooked fish says (fish/plans.ts says what and how), owning its own speech: a new fish or the panel
// closing stops it, and nothing another part of the page started is cut off.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../../../core/settings';
import type { FishItem } from '../../../../core/town/fishing';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending } from '../../../../core/tts';
import { stopSfx } from '../../sfx';
import { fishPlans, type FishPlay } from './plans';

export type { FishPlay };

export interface PlayHooks {
  /** Not a click (the fish speaks by itself after the bite): never a new paid request (SpeakOptions.auto). */
  auto?: boolean;
  /** The sound really started (a press: at once; `auto`: when it sounds). */
  onStart?: () => void;
  /** It ended (only after it started, and not when another play or stop() cut it off). */
  onEnd?: () => void;
}

export interface FishVoice {
  canSpeak: boolean;
  playing: FishPlay | null;
  /** AI voice only: the clip is being made. */
  pending: boolean;
  hasCareful: boolean;
  play: (kind: FishPlay, o?: PlayHooks) => Promise<void>;
  stop: () => void;
}

export function useFishVoice(item: FishItem | null): FishVoice {
  const settings = useSettings();
  const canSpeak = ttsSupported();
  const [owner] = useState<object>(() => ({}));
  const pending = useSpeechPending(owner);
  const [playing, setPlaying] = useState<FishPlay | null>(null);
  const runRef = useRef(0);
  const plans = useMemo(() => (item ? fishPlans(item, settings.rate) : null), [item, settings.rate]);

  const stop = useCallback(() => {
    runRef.current++;
    stopSpeakingIfOwner(owner);
    setPlaying(null);
  }, [owner]);

  const play = useCallback(
    async (kind: FishPlay, o: PlayHooks = {}) => {
      const plan = plans ? (kind === 'main' ? plans.main : plans.careful) : null;
      if (!canSpeak || !plan) return;
      const my = ++runRef.current;
      setPlaying(kind);
      // English is about to sound: no effect may ring over it
      stopSfx();
      const flag = { started: false };
      const start = () => {
        if (flag.started || runRef.current !== my) return;
        flag.started = true;
        o.onStart?.();
      };
      // a press counts at once; a play the fish starts by itself counts when its sound really starts (an iPhone may
      // refuse a page that speaks on its own: then nothing was heard and "Nghe" is still the first listen)
      if (!o.auto) start();
      try {
        await speak(plan.text, {
          rate: plan.rate,
          mode: plan.mode,
          slow: kind === 'careful' || undefined,
          owner,
          auto: o.auto,
          onStart: o.auto ? start : undefined,
        });
      } catch {
        // speech errors end playback quietly
      }
      if (runRef.current !== my) return;
      setPlaying(null);
      if (flag.started) o.onEnd?.();
    },
    [plans, canSpeak, owner],
  );

  // a new fish, or the panel closing: whatever this fish was saying stops
  useEffect(
    () => () => {
      runRef.current++;
      stopSpeakingIfOwner(owner);
      setPlaying(null);
    },
    [owner, item],
  );

  const busy = pending && playing !== null;
  const hasCareful = !!plans?.careful;
  return useMemo(() => ({ canSpeak, playing, pending: busy, hasCareful, play, stop }), [canSpeak, playing, busy, hasCareful, play, stop]);
}
