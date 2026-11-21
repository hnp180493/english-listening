import { describe, expect, it } from 'vitest';
import { castOfSpecies, catchOutcome } from '../../../../core/town/fishing';
import {
  abandonAnswer,
  answerOf,
  BITE_SPEAK_MS,
  canPick,
  canReplay,
  castReducer,
  catchXuNow,
  clockVi,
  IDLE,
  keyAction,
  optionsShown,
  playsLeft,
  secondsVi,
  timeFraction,
  timeLeftMs,
  WAIT_MAX_MS,
  WAIT_MIN_MS,
  waitMsFor,
  xuAfterReplay,
  type CastEvent,
  type CastState,
} from './castMachine';

const run = (events: CastEvent[], from: CastState = IDLE): CastState => events.reduce(castReducer, from);
const LIMIT = 7000;

/** Cast at 0, bite at 2000, first play 2100–3100. */
function heard(): CastState {
  return run([
    { type: 'cast', now: 0, waitMs: 2000 },
    { type: 'bite', now: 2000 },
    { type: 'playStart', now: 2100 },
    { type: 'playEnd', now: 3100 },
  ]);
}

describe('a cast, step by step', () => {
  it('goes idle → waiting → bite → listening → answered', () => {
    let s = castReducer(IDLE, { type: 'cast', now: 100, waitMs: 1500 });
    expect(s.phase).toBe('waiting');
    expect(s.biteAt).toBe(1600);
    // the fish does not bite early
    expect(castReducer(s, { type: 'bite', now: 1599 })).toBe(s);
    s = castReducer(s, { type: 'bite', now: 1600 });
    expect(s.phase).toBe('bite');
    s = castReducer(s, { type: 'playStart', now: 1600 + BITE_SPEAK_MS });
    expect(s).toMatchObject({ phase: 'listening', plays: 1, playing: true, firstEndAt: null });
    expect(canPick(s)).toBe(false);
    expect(optionsShown(s)).toBe(false);
    s = castReducer(s, { type: 'playEnd', now: 3000 });
    expect(s).toMatchObject({ playing: false, firstEndAt: 3000 });
    expect(canPick(s)).toBe(true);
    expect(optionsShown(s)).toBe(true);
    s = castReducer(s, { type: 'pick', now: 4000, index: 2, options: 4 });
    expect(s).toMatchObject({ phase: 'answered', picked: 2, answeredAt: 4000, timedOut: false });
  });

  it('ignores events that do not fit the phase (same object back)', () => {
    expect(castReducer(IDLE, { type: 'bite', now: 5 })).toBe(IDLE);
    expect(castReducer(IDLE, { type: 'playStart', now: 5 })).toBe(IDLE);
    expect(castReducer(IDLE, { type: 'pick', now: 5, index: 0, options: 4 })).toBe(IDLE);
    expect(castReducer(IDLE, { type: 'reset' })).toBe(IDLE);
    const w = castReducer(IDLE, { type: 'cast', now: 0, waitMs: 1000 });
    // casting again while the float is in does nothing
    expect(castReducer(w, { type: 'cast', now: 10, waitMs: 1000 })).toBe(w);
    // no pick before the first play ended, none out of range
    const playing = run([{ type: 'bite', now: 1000 }, { type: 'playStart', now: 1000 }], w);
    expect(castReducer(playing, { type: 'pick', now: 1200, index: 0, options: 4 })).toBe(playing);
    const h = heard();
    expect(castReducer(h, { type: 'pick', now: 3200, index: 4, options: 4 })).toBe(h);
    expect(castReducer(h, { type: 'pick', now: 3200, index: -1, options: 4 })).toBe(h);
  });

  it('counts replays; the clock starts at the end of the FIRST play and runs through replays', () => {
    let s = heard();
    s = run([{ type: 'playStart', now: 4000 }, { type: 'playEnd', now: 5000 }], s);
    expect(s.plays).toBe(2);
    expect(s.firstEndAt).toBe(3100);
    expect(timeLeftMs(s, LIMIT, 5000)).toBe(LIMIT - 1900);
  });

  it('a play that never sounded (the browser refused) counts nothing and starts no clock', () => {
    const s = run([{ type: 'cast', now: 0, waitMs: 1000 }, { type: 'bite', now: 1000 }, { type: 'playEnd', now: 1800 }]);
    expect(s).toMatchObject({ phase: 'bite', plays: 0, firstEndAt: null });
    expect(timeLeftMs(s, LIMIT, 99_999)).toBe(LIMIT);
  });

  it('the line snaps when the time runs out, not a millisecond earlier', () => {
    const s = heard();
    expect(castReducer(s, { type: 'tick', now: 3100 + LIMIT, limitMs: LIMIT })).toBe(s);
    const t = castReducer(s, { type: 'tick', now: 3101 + LIMIT, limitMs: LIMIT });
    expect(t).toMatchObject({ phase: 'answered', picked: null, timedOut: true });
    // a tick before the first play ended never snaps it
    const early = run([{ type: 'cast', now: 0, waitMs: 0 }, { type: 'bite', now: 0 }, { type: 'playStart', now: 0 }]);
    expect(castReducer(early, { type: 'tick', now: 60_000, limitMs: LIMIT })).toBe(early);
  });

  it('plays after the answer count nowhere', () => {
    const a = castReducer(heard(), { type: 'pick', now: 4000, index: 0, options: 4 });
    const b = run([{ type: 'playStart', now: 4100 }, { type: 'playEnd', now: 5100 }], a);
    expect(b.plays).toBe(1);
    expect(b.phase).toBe('answered');
  });

  it('casts again from answered, and reset goes back to idle', () => {
    const a = castReducer(heard(), { type: 'pick', now: 4000, index: 0, options: 4 });
    const again = castReducer(a, { type: 'cast', now: 5000, waitMs: 1200 });
    expect(again).toMatchObject({ phase: 'waiting', plays: 0, firstEndAt: null, picked: null, biteAt: 6200 });
    expect(castReducer(again, { type: 'reset' })).toBe(IDLE);
  });
});

describe('timer and reward math', () => {
  it('the time bar is full until the first play ends, then drains to 0', () => {
    const s = heard();
    expect(timeFraction(s, LIMIT, 3100)).toBe(1);
    expect(timeFraction(s, LIMIT, 3100 + LIMIT / 2)).toBeCloseTo(0.5);
    expect(timeFraction(s, LIMIT, 3100 + LIMIT * 2)).toBe(0);
    expect(timeFraction(s, 0, 3100)).toBe(0);
  });

  it('after the answer the clock stops where it was (0 after a timeout)', () => {
    const a = castReducer(heard(), { type: 'pick', now: 5100, index: 1, options: 4 });
    expect(timeLeftMs(a, LIMIT, 99_999)).toBe(LIMIT - 2000);
    const t = castReducer(heard(), { type: 'tick', now: 3100 + LIMIT + 50, limitMs: LIMIT });
    expect(timeLeftMs(t, LIMIT, 99_999)).toBe(0);
  });

  it('replays are offered only within maxPlays, after the first play, while nothing sounds', () => {
    let s = heard();
    expect(playsLeft(s, 2)).toBe(1);
    expect(canReplay(s, 2)).toBe(true);
    s = castReducer(s, { type: 'playStart', now: 3500 });
    expect(canReplay(s, 2)).toBe(false);
    s = castReducer(s, { type: 'playEnd', now: 4500 });
    expect(playsLeft(s, 2)).toBe(0);
    expect(canReplay(s, 2)).toBe(false);
    expect(canReplay(s, 3)).toBe(true);
  });

  it('a catch after a replay is worth half, rounded up (as core/town/fishing catchOutcome)', () => {
    for (const xu of [1, 2, 3, 5]) {
      expect(catchXuNow(xu, 1)).toBe(xu);
      for (const plays of [2, 3]) {
        expect(catchXuNow(xu, plays)).toBe(catchOutcome({ timeLimitMs: LIMIT, maxPlays: 3, xu }, { correct: true, plays, ms: 100 }).xu);
      }
      expect(xuAfterReplay(xu, 1)).toBe(Math.ceil(xu / 2));
      expect(xuAfterReplay(xu, 2)).toBe(Math.ceil(xu / 2));
    }
  });

  it('answerOf gives finishCast what catchOutcome needs: a right pick in time is caught, a timeout is not', () => {
    const cast = castOfSpecies('ca-noi', 7)!;
    const right = castReducer(heard(), { type: 'pick', now: 4100, index: cast.answer, options: cast.options.length });
    const a = answerOf(right, cast)!;
    expect(a).toEqual({ correct: true, plays: 1, ms: 1000 });
    expect(catchOutcome(cast, a)).toMatchObject({ caught: true, firstListen: true, xu: cast.xu });

    const wrongIndex = (cast.answer + 1) % cast.options.length;
    const wrong = answerOf(castReducer(heard(), { type: 'pick', now: 4100, index: wrongIndex, options: cast.options.length }), cast)!;
    expect(catchOutcome(cast, wrong).caught).toBe(false);

    const timedOut = castReducer(heard(), { type: 'tick', now: 3100 + cast.timeLimitMs + 1, limitMs: cast.timeLimitMs });
    const t = answerOf(timedOut, cast)!;
    expect(t.correct).toBe(false);
    expect(t.ms).toBeGreaterThan(cast.timeLimitMs);
    expect(catchOutcome(cast, t).caught).toBe(false);

    expect(answerOf(heard(), cast)).toBeNull();
  });
});

describe('waits, labels and keys', () => {
  it('the wait for a bite is within bounds, deterministic, and varies with the seed', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const w = waitMsFor(seed);
      expect(w).toBeGreaterThanOrEqual(WAIT_MIN_MS);
      expect(w).toBeLessThanOrEqual(WAIT_MAX_MS);
      expect(waitMsFor(seed)).toBe(w);
      seen.add(Math.round(w / 100));
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(waitMsFor(Number.NaN)).toBe(waitMsFor(0));
  });

  it('times read in Vietnamese', () => {
    expect(secondsVi(2450)).toBe('2,5 giây');
    expect(secondsVi(3000)).toBe('3 giây');
    expect(secondsVi(12_400)).toBe('12 giây');
    expect(secondsVi(Number.NaN)).toBe('0 giây');
    expect(clockVi(4510)).toBe('4,6');
    expect(clockVi(0)).toBe('0,0');
    expect(clockVi(-5)).toBe('0,0');
  });

  it('Space casts (not on a button), 1–4 pick only when picking is allowed, R plays', () => {
    const o = { options: 4, onControl: false };
    expect(keyAction(' ', IDLE, o)).toEqual({ type: 'cast' });
    expect(keyAction(' ', IDLE, { ...o, onControl: true })).toBeNull();
    const waiting = castReducer(IDLE, { type: 'cast', now: 0, waitMs: 1000 });
    expect(keyAction(' ', waiting, o)).toBeNull();
    expect(keyAction('1', waiting, o)).toBeNull();
    expect(keyAction('r', waiting, o)).toBeNull();
    const h = heard();
    expect(keyAction('3', h, o)).toEqual({ type: 'pick', index: 2 });
    expect(keyAction('4', h, { ...o, options: 3 })).toBeNull();
    expect(keyAction('R', h, o)).toEqual({ type: 'replay' });
    const done = castReducer(h, { type: 'pick', now: 4000, index: 0, options: 4 });
    expect(keyAction(' ', done, o)).toEqual({ type: 'cast' });
    expect(keyAction('2', done, o)).toBeNull();
    expect(keyAction('x', done, o)).toBeNull();
  });
});

describe('closing the panel mid-cast (abandon)', () => {
  const cast = { answer: 1, timeLimitMs: LIMIT, maxPlays: 3, xu: 2 };

  it('once the fish has spoken, the cast ends as the line snapping: an escape, recorded', () => {
    // the options were up and the clock running
    const s = heard();
    const a = abandonAnswer(s, cast, 4000);
    expect(a).toEqual({ correct: false, plays: 1, ms: LIMIT + 1 });
    expect(catchOutcome(cast, a!)).toMatchObject({ caught: false, reason: 'wrong' });
    expect(castReducer(s, { type: 'abandon', now: 4000 })).toMatchObject({ phase: 'answered', picked: null, timedOut: true, playing: false });
    // still sounding the first time (no clock yet): it spoke, so it got away all the same
    const sounding = run([{ type: 'cast', now: 0, waitMs: 0 }, { type: 'bite', now: 0 }, { type: 'playStart', now: 10 }]);
    expect(abandonAnswer(sounding, cast, 500)).toEqual({ correct: false, plays: 1, ms: LIMIT + 1 });
    // after replays too
    const twice = run([{ type: 'playStart', now: 3500 }, { type: 'playEnd', now: 4200 }], heard());
    expect(abandonAnswer(twice, cast, 5000)).toMatchObject({ correct: false, plays: 2 });
  });

  it('before the fish spoke, or after the answer, nothing is recorded', () => {
    expect(abandonAnswer(IDLE, cast, 10)).toBeNull();
    const waiting = castReducer(IDLE, { type: 'cast', now: 0, waitMs: 1000 });
    expect(abandonAnswer(waiting, cast, 500)).toBeNull();
    expect(castReducer(waiting, { type: 'abandon', now: 500 })).toBe(IDLE);
    const bite = castReducer(waiting, { type: 'bite', now: 1000 });
    expect(abandonAnswer(bite, cast, 1200)).toBeNull();
    // answered already (finishCast has recorded it): nothing again
    const answered = castReducer(heard(), { type: 'pick', now: 4000, index: 1, options: 4 });
    expect(abandonAnswer(answered, cast, 5000)).toBeNull();
    expect(castReducer(answered, { type: 'abandon', now: 5000 })).toBe(answered);
  });
});
