// Greetings (docs/town.md §12 "Thân thiết"): when the player stops next to a resident in free play, the resident
// turns, waves and says one short voiced line: the best match for how close they are, a memory callback while it is
// news (core/town/friendship pickGreeting). Never during a conversation or a panel, never over other speech, at most
// once per resident in GREET_EVERY_MS, only with the town's sound and "Lời chào của cư dân" on (both device-local,
// ./townUi). `auto`: a greeting is never a paid request.

import { useCallback, useEffect, useRef, useState } from 'react';
import { friendHearts, pickGreeting, type Greeting } from '../../../core/town/friendship';
import { loadTownProgress } from '../../../core/town/store';
import type { PlaceId } from '../../../data/townWorld';
import type { Near } from '../engine/stage';
import { getTownUi, setTownUi } from '../townUi';
import { useSaidLine } from './useSaidLine';

/** A resident greets at most once in this long (ms). */
export const GREET_EVERY_MS = 10 * 60_000;
/** The bubble stays this long after the line has sounded (ms), unless it was opened. */
export const GREET_LINGER_MS = 4000;
/** A moment after the player stops: the greeting does not land on the same frame as the stop. */
const GREET_DELAY_MS = 350;

export interface GreetingNow {
  placeId: PlaceId;
  line: Greeting;
}

export interface GreetingState {
  greeting: GreetingNow | null;
  sounding: boolean;
  /** Hear it again (the bubble's popover). */
  replay: () => void;
  /** The bubble was opened: it stays until closed. */
  hold: (on: boolean) => void;
  dismiss: () => void;
}

/** Whether `placeId` may greet now (rate limit, settings). Pure. */
export function mayGreet(ui: { greet: boolean; sound: boolean; hi: Record<string, { at: number }> }, placeId: string, now: number): boolean {
  if (!ui.greet || !ui.sound) return false;
  const last = ui.hi[placeId]?.at ?? 0;
  return now - last >= GREET_EVERY_MS || now < last;
}

export function useGreeting(near: Near, enabled: boolean, onGreet?: (placeId: PlaceId) => void): GreetingState {
  const voice = useSaidLine();
  const { play, stop } = voice;
  const [greeting, setGreeting] = useState<GreetingNow | null>(null);
  const [held, setHeld] = useState(false);
  const [ended, setEnded] = useState(0);
  const onGreetRef = useRef(onGreet);
  useEffect(() => {
    onGreetRef.current = onGreet;
  }, [onGreet]);

  const nearId = near?.kind === 'resident' ? near.placeId : null;
  useEffect(() => {
    if (!enabled || !nearId) return;
    const id = window.setTimeout(() => {
      const now = Date.now();
      const ui = getTownUi();
      if (!mayGreet(ui, nearId, now)) return;
      const progress = loadTownProgress();
      const line = pickGreeting(
        nearId,
        friendHearts(progress, nearId),
        { now, learnedAt: (f) => progress.facts[f] ?? 0, plays: (g) => ui.said[g] ?? 0 },
        ui.hi[nearId]?.id ?? null,
        Math.floor(now / 1000),
      );
      if (!line) return;
      setTownUi({ hi: { ...ui.hi, [nearId]: { id: line.id, at: now } }, said: line.if ? { ...ui.said, [line.id]: (ui.said[line.id] ?? 0) + 1 } : ui.said });
      setHeld(false);
      setEnded(0);
      setGreeting({ placeId: nearId, line });
      onGreetRef.current?.(nearId);
      void play(line, nearId, { auto: true }).then(() => setEnded(Date.now()));
    }, GREET_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [enabled, nearId, play]);

  // anything else takes the stage (a talk, a panel): the greeting stops and goes (not shown while disabled)
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  // gone a moment after it has sounded, unless it was opened
  useEffect(() => {
    if (!greeting || held || voice.playing || ended === 0) return;
    const id = window.setTimeout(() => setGreeting(null), GREET_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [greeting, held, voice.playing, ended]);

  const replay = useCallback(() => {
    if (greeting) void play(greeting.line, greeting.placeId);
  }, [greeting, play]);
  const dismiss = useCallback(() => {
    stop();
    setHeld(false);
    setGreeting(null);
  }, [stop]);

  return { greeting: enabled ? greeting : null, sounding: enabled && voice.sounding, replay, hold: setHeld, dismiss };
}
