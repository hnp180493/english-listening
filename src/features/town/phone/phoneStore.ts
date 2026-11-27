// The learner's phone (core/town/phone.ts) in memory: the call log (missed calls, voice messages, calls taken), the job
// ringing now, and the offers gone until the next game day. Nothing is stored: a reload starts with an empty phone
// (what lasts, a job done, a clue, is in town-jobs). The job engine (../jobs/useCityJob.tsx) writes it; the phone's
// button and panel (./PhonePanel.tsx) read it.

import { useSyncExternalStore } from 'react';
import { callbackDeadline, canCallBack, goneUntil, type PhoneEntry } from '../../../core/town/phone';
import { gameNow } from '../../../core/town/gameClock';

interface PhoneState {
  log: readonly PhoneEntry[];
  /** The job ringing now and who rings. */
  incoming: { jobId: string; from: string } | null;
  /** Job id → until when (a game time: core/town/gameClock.ts gameNow) its offer is gone. */
  gone: Readonly<Record<string, number>>;
}

let state: PhoneState = { log: [], incoming: null, gone: {} };
let n = 0;
const listeners = new Set<() => void>();
const set = (next: PhoneState) => {
  state = next;
  for (const fn of [...listeners]) fn();
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const get = () => state;

export const usePhone = (): PhoneState => useSyncExternalStore(subscribe, get, get);
export const phoneState = (): PhoneState => state;

const add = (e: Omit<PhoneEntry, 'id'>): PhoneEntry => {
  const entry = { ...e, id: `call-${++n}` };
  set({ ...state, log: [entry, ...state.log].slice(0, 30) });
  return entry;
};

export function ringing(jobId: string | null, from = ''): void {
  const cur = state.incoming;
  if ((cur?.jobId ?? null) === jobId) return;
  set({ ...state, incoming: jobId ? { jobId, from } : null });
}

/** A job rang and was not answered: a missed call with a voice message and a deadline by the game's clock. */
export function missCall(jobId: string, from: string, now: number = Date.now()): PhoneEntry {
  set({ ...state, incoming: null });
  return add({ kind: 'missed', from, at: now, jobId, deadline: callbackDeadline(now), status: 'new' });
}

/** A voice message left for the learner (a job's briefing). */
export function leaveVoicemail(jobId: string, from: string, lines: readonly string[], now: number = Date.now()): PhoneEntry {
  return add({ kind: 'voicemail', from, at: now, jobId, lines, status: 'new' });
}

/** A call taken during a job (the log only). */
export function logCall(from: string, jobId: string | undefined, now: number = Date.now()): void {
  add({ kind: 'call', from, at: now, ...(jobId ? { jobId } : {}), status: 'heard' });
}

export function markHeard(id: string): void {
  set({ ...state, log: state.log.map((e) => (e.id === id && e.status === 'new' ? { ...e, status: 'heard' } : e)) });
}

/**
 * The learner rings a missed call back: in time, the offer stands ('ok'); late, it is gone until the next game day
 * ('late'). Either way the entry is closed.
 */
export function callBack(id: string, now: number = Date.now()): 'ok' | 'late' | null {
  const e = state.log.find((x) => x.id === id);
  if (!e || e.kind !== 'missed' || e.status === 'returned' || e.status === 'expired') return null;
  const ok = canCallBack(e, now);
  set({
    ...state,
    log: state.log.map((x) => (x.id === id ? { ...x, status: ok ? 'returned' : 'expired' } : x)),
    gone: !ok && e.jobId && e.deadline ? { ...state.gone, [e.jobId]: goneUntil(e.deadline.at) } : state.gone,
  });
  return ok ? 'ok' : 'late';
}

/**
 * A job's offer is not on now: a missed call for it still waiting (it is returned from the phone, not rung again), or
 * its deadline passed and the game day has not turned yet.
 */
export function offerHeld(jobId: string, now: number = Date.now()): 'waiting' | 'gone' | null {
  // (deadlines are game times: a sleep in the hideout moves this machine's clock on past them)
  const g = gameNow(now);
  if ((state.gone[jobId] ?? 0) > g) return 'gone';
  for (const e of state.log) {
    if (e.kind !== 'missed' || e.jobId !== jobId || e.status === 'returned') continue;
    if (e.status !== 'expired' && e.deadline && g < e.deadline.at) return 'waiting';
    if (e.deadline && g < goneUntil(e.deadline.at)) return 'gone';
  }
  return null;
}

/** Tests and replays only: an empty phone. */
export function resetPhone(): void {
  set({ log: [], incoming: null, gone: {} });
}
