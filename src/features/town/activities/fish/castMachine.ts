// One cast of "Câu cá" as a pure state machine (docs/town.md §10), so the panel only feeds it events and draws it.
//
//   idle ──cast──▶ waiting ──bite──▶ bite ──playStart──▶ listening ──pick / timeout──▶ answered ──cast──▶ waiting …
//
// - waiting: the float bobs for `waitMs` (from the cast's seed: never the same rhythm twice in a row);
// - bite: "Cá cắn câu!"; the fish speaks by itself a moment later (or on "Nghe" when the browser would not let it);
// - listening: plays are counted when the sound starts; the clock (`timeLimitMs`) starts when the FIRST play ends,
//   as core/town/fishing catchOutcome measures it; replays are allowed up to `maxPlays` and the clock keeps running
//   through them (so a replay visibly costs time) and a catch after a replay is worth half (rounded up);
// - answered: a pick (right or wrong) or the line snapping (the time ran out). Plays after this count nowhere.
// - abandon: the panel closed mid-cast. Once the fish has spoken (a play started), the cast ends as the line snapping
//   (an escape: recorded, and the catch streak ends), so closing the panel is never a free way out of a hard fish.
//   Before that nothing was heard, and nothing counts (idle).
//
// Times are plain numbers (ms, from the caller's clock): nothing here reads Date.now().

import type { CatchAnswer, FishCast } from '../../../../core/town/fishing';

export type CastPhase = 'idle' | 'waiting' | 'bite' | 'listening' | 'answered';

export interface CastState {
  phase: CastPhase;
  /** When the float went in (waiting and after). */
  castAt: number;
  /** When the fish bites (waiting). */
  biteAt: number;
  /** Plays started before the answer (the first included). */
  plays: number;
  /** A play is sounding now. */
  playing: boolean;
  /** When the first play ended: the clock starts here. null = not yet. */
  firstEndAt: number | null;
  /** The option picked (answered); null = none (the time ran out). */
  picked: number | null;
  /** When the cast was answered (answered). */
  answeredAt: number;
  /** answered by the line snapping, not by a pick. */
  timedOut: boolean;
}

export type CastEvent =
  | { type: 'cast'; now: number; waitMs: number }
  | { type: 'bite'; now: number }
  | { type: 'playStart'; now: number }
  | { type: 'playEnd'; now: number }
  | { type: 'pick'; now: number; index: number; options: number }
  | { type: 'tick'; now: number; limitMs: number }
  | { type: 'abandon'; now: number }
  | { type: 'reset' };

export const IDLE: CastState = Object.freeze({
  phase: 'idle',
  castAt: 0,
  biteAt: 0,
  plays: 0,
  playing: false,
  firstEndAt: null,
  picked: null,
  answeredAt: 0,
  timedOut: false,
}) as CastState;

/** Shortest and longest wait for a bite, ms: long enough to feel the float, short enough not to bore. */
export const WAIT_MIN_MS = 1300;
export const WAIT_MAX_MS = 3100;
/** "Cá cắn câu!" stays this long before the fish speaks by itself. */
export const BITE_SPEAK_MS = 750;

/** The wait before a bite for a cast seed, WAIT_MIN_MS..WAIT_MAX_MS (deterministic). */
export function waitMsFor(seed: number): number {
  const s = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  // a cheap integer hash: neighbouring seeds land far apart
  let h = Math.imul(s ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return WAIT_MIN_MS + (h % (WAIT_MAX_MS - WAIT_MIN_MS + 1));
}

/** The next state. An event that does not fit the phase changes nothing (the same object comes back). */
export function castReducer(s: CastState, e: CastEvent): CastState {
  switch (e.type) {
    case 'reset':
      return s.phase === 'idle' ? s : IDLE;
    case 'cast':
      if (s.phase !== 'idle' && s.phase !== 'answered') return s;
      return { ...IDLE, phase: 'waiting', castAt: e.now, biteAt: e.now + Math.max(0, e.waitMs) };
    case 'bite':
      if (s.phase !== 'waiting' || e.now < s.biteAt) return s;
      return { ...s, phase: 'bite' };
    case 'playStart':
      // a play while answering counts; a replay after the answer counts nowhere (the panel plays it all the same)
      if (s.phase !== 'bite' && s.phase !== 'listening') return s;
      return { ...s, phase: 'listening', plays: s.plays + 1, playing: true };
    case 'playEnd':
      if (s.phase === 'answered') return s.playing ? { ...s, playing: false } : s;
      if (s.phase !== 'listening' || !s.playing) return s;
      return { ...s, playing: false, firstEndAt: s.firstEndAt ?? e.now };
    case 'pick':
      if (!canPick(s) || e.index < 0 || e.index >= e.options) return s;
      return { ...s, phase: 'answered', picked: e.index, answeredAt: e.now, playing: false };
    case 'abandon':
      if (s.phase === 'idle' || s.phase === 'answered') return s;
      if (s.plays < 1) return IDLE;
      return { ...s, phase: 'answered', picked: null, answeredAt: e.now, timedOut: true, playing: false };
    case 'tick':
      if (s.phase !== 'listening' || s.firstEndAt === null || e.now - s.firstEndAt <= e.limitMs) return s;
      return { ...s, phase: 'answered', picked: null, answeredAt: e.now, timedOut: true, playing: false };
  }
}

/** The options can be picked: the fish has spoken once (the first play ended) and the cast is not answered. */
export function canPick(s: CastState): boolean {
  return s.phase === 'listening' && s.firstEndAt !== null;
}

/** The options can be shown: the same moment (English options must never be read before the fish has spoken). */
export const optionsShown = (s: CastState): boolean => s.firstEndAt !== null;

/** Ms left on the clock (the full limit before the first play ended, 0 once it ran out or after the answer). */
export function timeLeftMs(s: CastState, limitMs: number, now: number): number {
  if (s.phase === 'answered') return s.timedOut || s.firstEndAt === null ? 0 : Math.max(0, limitMs - (s.answeredAt - s.firstEndAt));
  if (s.firstEndAt === null) return limitMs;
  return Math.max(0, limitMs - (now - s.firstEndAt));
}

/** 0..1 of the time bar. */
export function timeFraction(s: CastState, limitMs: number, now: number): number {
  if (!(limitMs > 0)) return 0;
  return Math.max(0, Math.min(1, timeLeftMs(s, limitMs, now) / limitMs));
}

/** Plays still allowed (a replay beyond them would let the fish go: the panel never offers it). */
export function playsLeft(s: CastState, maxPlays: number): number {
  return Math.max(0, maxPlays - s.plays);
}

/** "Nghe lại" before the answer: after the first play, while nothing sounds, within maxPlays and the time. */
export function canReplay(s: CastState, maxPlays: number): boolean {
  return canPick(s) && !s.playing && s.plays < maxPlays;
}

/** What a catch is worth now (before the daily cap and the new-species bonus): the tier's xu, half after a replay. */
export function catchXuNow(xu: number, plays: number): number {
  return plays <= 1 ? xu : Math.ceil(xu / 2);
}

/** What the next replay would leave a catch worth (the same when a replay was already made). */
export function xuAfterReplay(xu: number, plays: number): number {
  return catchXuNow(xu, Math.max(2, plays + 1));
}

/** The answer for finishCast. A timeout is a wrong answer past the limit (it got away either way). */
export function answerOf(s: CastState, cast: Pick<FishCast, 'answer' | 'timeLimitMs'>): CatchAnswer | null {
  if (s.phase !== 'answered') return null;
  const ms = s.firstEndAt === null ? cast.timeLimitMs + 1 : s.answeredAt - s.firstEndAt;
  return { correct: s.picked !== null && s.picked === cast.answer, plays: s.plays, ms: s.timedOut ? Math.max(ms, cast.timeLimitMs + 1) : ms };
}

/**
 * The answer to record when the panel closes on `s` (the abandon event): an escape once the fish has spoken and the
 * cast is not answered, else null (nothing heard yet, or already answered and recorded).
 */
export function abandonAnswer(s: CastState, cast: Pick<FishCast, 'answer' | 'timeLimitMs'>, now: number): CatchAnswer | null {
  if (s.phase === 'answered') return null;
  const next = castReducer(s, { type: 'abandon', now });
  return next.phase === 'answered' ? answerOf(next, cast) : null;
}

/** Seconds for a time, Vietnamese decimal comma: 2450 → "2,5 giây"; under 10 s with one decimal. */
export function secondsVi(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0 giây';
  const s = ms / 1000;
  const txt = s < 10 ? (Math.round(s * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(s));
  return `${txt} giây`;
}

/** The short clock beside the time bar: "4,5" (seconds, one decimal, rounded up so it never shows 0 early). */
export function clockVi(ms: number): string {
  const tenths = Math.ceil(Math.max(0, ms) / 100);
  return (tenths / 10).toFixed(1).replace('.', ',');
}

export type KeyAction = { type: 'cast' } | { type: 'pick'; index: number } | { type: 'replay' } | null;

/**
 * What a key does in the fishing tab (Space casts or casts again, 1–4 picks, R replays). `onControl`: the key went to
 * a button / link / summary, where Space is that control's own.
 */
export function keyAction(key: string, s: CastState, opts: { options: number; onControl: boolean }): KeyAction {
  if (key === ' ' || key === 'Spacebar') {
    if (opts.onControl) return null;
    return s.phase === 'idle' || s.phase === 'answered' ? { type: 'cast' } : null;
  }
  if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    return canPick(s) && index < opts.options ? { type: 'pick', index } : null;
  }
  if (key === 'r' || key === 'R') return s.phase === 'bite' || s.phase === 'listening' || s.phase === 'answered' ? { type: 'replay' } : null;
  return null;
}
