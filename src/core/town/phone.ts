// The learner's phone in Westbay (docs/gta-plan.md §4.6, §17): one place for calls. A job that rings and is not
// answered becomes a missed call with a deadline by the GAME clock ("call me back before six"): called back in time,
// the job starts; after it, the offer is gone until the next game day (the caller says so when rung). Voice messages
// are heard from it, then noted. Its contacts are the crew. Pure: the store (in memory) is
// features/town/phone/phoneStore.ts.

import { GAME_MINUTE_MS } from './job';
import { GAME_DAY_MS, gameMinutes } from './sky';

/** A ringing job is missed after this long unanswered (real ms). */
export const RING_MS = 30_000;
/** A missed call's deadline is the first full hour of the game at least this many game minutes away. */
export const CALLBACK_AHEAD = 90;

/** The game day a real time falls in (counted from 1970; a game day is GAME_DAY_MS long). */
export const gameDayOf = (nowMs: number): number => Math.floor(nowMs / GAME_DAY_MS);

/** When a missed call must be returned by: the minute of the game's day, and the real time it comes round. */
export function callbackDeadline(nowMs: number): { minute: number; at: number } {
  const g = gameMinutes(nowMs);
  const minute = Math.ceil((g + CALLBACK_AHEAD) / 60) * 60;
  return { minute: minute % 1440, at: nowMs + (minute - g) * GAME_MINUTE_MS };
}

/** A missed call's offer, called back late, is gone until the game day after its deadline begins. */
export const goneUntil = (deadlineAt: number): number => (gameDayOf(deadlineAt) + 1) * GAME_DAY_MS;

export type CallKind = 'missed' | 'voicemail' | 'call';
export type CallStatus = 'new' | 'heard' | 'returned' | 'expired';

export interface PhoneEntry {
  id: string;
  kind: CallKind;
  /** Who called (a Westbay person's id, a town resident's place id, or a new character's). */
  from: string;
  at: number;
  /** The job it is about (a missed call's offer, a voice message's briefing). */
  jobId?: string;
  /** A missed call: return it by then. */
  deadline?: { minute: number; at: number };
  /** The job lines a voice message says (by id). */
  lines?: readonly string[];
  status: CallStatus;
}

/** Whether a missed call can still be returned at `now`. */
export const canCallBack = (e: PhoneEntry, now: number): boolean => e.kind === 'missed' && e.status !== 'returned' && e.status !== 'expired' && !!e.deadline && now < e.deadline.at;

/** What waits for the learner (the badge): missed calls still open and voice messages not heard. */
export function waiting(log: readonly PhoneEntry[], now: number): number {
  return log.filter((e) => (e.kind === 'missed' && canCallBack(e, now) && e.status === 'new') || (e.kind === 'voicemail' && e.status === 'new')).length;
}
