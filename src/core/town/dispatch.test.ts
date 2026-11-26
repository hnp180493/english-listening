// Rico's dispatch office (./dispatch.ts): patience, the near car, Bayline's rule, a wrong pickup and a wrong
// destination that rejoin, the pay and the day's allowance, the shift's calls. Straight-line routes on a toy map.
import { describe, expect, it } from 'vitest';
import {
  answer,
  askAgain,
  ASKS_MAX,
  BAYLINE_WARN,
  baylineShare,
  CALLBACK_DELAY,
  callXu,
  DECIDE_LIMIT,
  DISPATCH_FIRST_XU,
  DISPATCH_FIX_XU,
  DISPATCH_SHIFTS_A_DAY,
  DISPATCH_XU,
  etaSeconds,
  goesToBayline,
  heard,
  isNear,
  missedRefs,
  nearestCar,
  onLine,
  PATIENCE,
  pickShiftCalls,
  RING_LIMIT,
  ringingNow,
  send,
  shiftNews,
  shiftOver,
  shiftPay,
  startShift,
  STOLEN_MAX,
  summarize,
  tick,
  type DispatchCall,
  type RouteFn,
  type Shift,
  type ShiftEvent,
} from './dispatch';
import { makeRoutes } from './dispatchRoads';

const straight: RouteFn = (_from, to) => [to];
const doors = { a: { x: 0, y: 0 }, b: { x: 60, y: 0 }, c: { x: 0, y: 60 }, d: { x: 60, y: 60 } };
const map = { doors, start: { rico: { x: 0, y: 0 }, tess: { x: 60, y: 0 }, theo: { x: 60, y: 60 } } };
const call = (id: string, from: string, to: string, level: 1 | 2 | 3 = 1): DispatchCall => ({ id, level, gender: 'female', manner: 'clear', text: 'x', vi: 'x', again: { text: 'x', vi: 'x' }, from, to, fromNear: to, toNear: from });

/** Run the shift for `seconds` in small steps, collecting what happened. */
function run(s: Shift, seconds: number): { shift: Shift; events: ShiftEvent[] } {
  const events: ShiftEvent[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    const r = tick(s, 0.1, doors, straight);
    s = r.shift;
    events.push(...r.events);
  }
  return { shift: s, events };
}

/** The first call, answered and heard. */
function onTheLine(calls: DispatchCall[]): Shift {
  let s = startShift(calls, map);
  s = tick(s, 0.1, doors, straight).shift;
  s = answer(s, 0);
  return heard(s, 0);
}

describe('dispatch: the phone', () => {
  it('calls ring by the shift clock; one on the line at a time; a callback rings first', () => {
    let s = startShift([call('1', 'a', 'b'), call('2', 'c', 'd')], map);
    expect(ringingNow(s)).toEqual([]);
    s = tick(s, 0.1, doors, straight).shift;
    expect(ringingNow(s)).toEqual([0]);
    s = answer(s, 0);
    expect(onLine(s)).toBe(0);
    s = run(s, 30).shift;
    expect(ringingNow(s)).toEqual([1]);
    expect(answer(s, 1)).toBe(s); // still on the line with the first
  });

  it('"Xin nhắc lại": counted every time, the caller cross past their patience, never more than the cap', () => {
    let s = onTheLine([call('1', 'a', 'b')]);
    for (let n = 1; n <= ASKS_MAX; n++) {
      const r = askAgain(s, 0);
      expect(r.ok).toBe(true);
      expect(r.cross).toBe(n === PATIENCE + 1);
      s = r.shift;
      expect(s.calls[0].asks).toBe(n);
    }
    expect(askAgain(s, 0).ok).toBe(false);
    expect(s.calls[0].cross).toBe(true);
  });
});

describe('dispatch: the near car', () => {
  it('a free car near the pickup beats a far one; a busy car counts the rest of its work', () => {
    const s = startShift([call('1', 'a', 'b')], map);
    const { best, eta } = nearestCar(s.cars, doors.b, doors, straight);
    expect(best).toBe('tess');
    expect(eta.tess).toBe(0);
    expect(eta.rico).toBeCloseTo(10);
    expect(isNear(eta, 'tess')).toBe(true);
    expect(isNear(eta, 'theo')).toBe(false);
    // tess busy with a job at the far corner: rico (idle, 10 s away) is now the near one
    const busy = { ...s.cars[1], legs: [{ call: 'x', kind: 'drop' as const, place: 'c' }], route: [doors.c] };
    expect(etaSeconds(busy, doors.b, doors, straight)).toBeGreaterThan(20);
    expect(nearestCar([s.cars[0], busy, s.cars[2]], doors.b, doors, straight).best).toBe('rico');
  });
});

describe('dispatch: the world answers', () => {
  it('right pickup and destination: boards, rides, drops; pays the fare and the tip for hearing it once', () => {
    let s = onTheLine([call('1', 'a', 'b')]);
    s = send(s, 0, { from: 'a', to: 'b', car: 'rico' }, doors, straight);
    expect(s.calls[0].state).toBe('sent');
    expect(s.calls[0].near).toBe(true);
    const r = run(s, 20);
    expect(r.events.map((e) => e.kind)).toEqual(['board', 'drop']);
    expect(r.shift.calls[0].state).toBe('done');
    expect(shiftOver(r.shift)).toBe(true);
    expect(callXu(r.shift.calls[0])).toBe(DISPATCH_XU + DISPATCH_FIRST_XU);
    const sum = summarize(r.shift);
    expect(sum).toMatchObject({ right: 1, once: 1, wrong: 0, stolen: 0, xu: DISPATCH_XU + DISPATCH_FIRST_XU });
  });

  it('a wrong pickup: "nobody here", the caller rings back, the second try always finds them (one consequence)', () => {
    let s = onTheLine([call('1', 'a', 'b')]);
    s = send(s, 0, { from: 'c', to: 'b', car: 'rico' }, doors, straight);
    let r = run(s, 12);
    expect(r.events.map((e) => e.kind)).toEqual(['nobody']);
    expect(r.events[0]).toMatchObject({ place: 'c', right: 'a' });
    expect(r.shift.calls[0].state).toBe('callback');
    r = run(r.shift, CALLBACK_DELAY + 0.2);
    expect(r.events.map((e) => e.kind)).toEqual(['ring']);
    s = heard(answer(r.shift, 0), 0);
    // the learner taps the wrong place again: the caller talks the driver in all the same
    s = send(s, 0, { from: 'd', to: 'b', car: 'rico' }, doors, straight);
    r = run(s, 40);
    expect(r.events.map((e) => e.kind)).toEqual(['board', 'drop']);
    expect(r.shift.calls[0].state).toBe('done');
    const res = summarize(r.shift).results[0];
    expect(res.fromWrong).toBe(true);
    expect(res.once).toBe(false);
    expect(res.xu).toBe(DISPATCH_FIX_XU);
    expect(missedRefs(summarize(r.shift))).toEqual(['disp-1']);
  });

  it('a wrong destination is found out at the end of the ride; the car takes them on', () => {
    let s = onTheLine([call('1', 'a', 'b')]);
    s = send(s, 0, { from: 'a', to: 'd', car: 'rico' }, doors, straight);
    const r = run(s, 40);
    expect(r.events.map((e) => e.kind)).toEqual(['board', 'wrongDrop', 'drop']);
    expect(r.events[1]).toMatchObject({ place: 'd', right: 'b' });
    expect(r.shift.calls[0].state).toBe('done');
    expect(summarize(r.shift).results[0]).toMatchObject({ toWrong: true, fromWrong: false, xu: DISPATCH_FIX_XU });
  });

  it('a far car or a cross caller: the fare without the tip', () => {
    let s = onTheLine([call('1', 'b', 'a')]);
    s = send(s, 0, { from: 'b', to: 'a', car: 'theo' }, doors, straight);
    expect(s.calls[0].near).toBe(false);
    const r = run(s, 40);
    expect(callXu(r.shift.calls[0])).toBe(DISPATCH_XU);
  });
});

describe("dispatch: Bayline's rule", () => {
  it('only past the limit, and never more than STOLEN_MAX a shift', () => {
    expect(goesToBayline(RING_LIMIT, RING_LIMIT, 0)).toBe(false);
    expect(goesToBayline(RING_LIMIT + 0.1, RING_LIMIT, 0)).toBe(true);
    expect(goesToBayline(999, RING_LIMIT, STOLEN_MAX)).toBe(false);
  });

  it('a call left ringing goes to Bayline; the phone warns first; the cap holds; a callback never goes', () => {
    let s = startShift([call('1', 'a', 'b'), call('2', 'a', 'b'), call('3', 'a', 'b')], map);
    s = { ...s, calls: s.calls.map((c) => ({ ...c, ringAt: 0 })) };
    s = tick(s, 0.1, doors, straight).shift;
    s = run(s, RING_LIMIT * BAYLINE_WARN).shift;
    expect(baylineShare(s.calls[0], s.t, s.stolen)!).toBeGreaterThanOrEqual(BAYLINE_WARN);
    const r = run(s, RING_LIMIT);
    expect(r.events.filter((e) => e.kind === 'stolen').length).toBe(STOLEN_MAX);
    expect(r.shift.calls.filter((c) => c.state === 'stolen').length).toBe(STOLEN_MAX);
    expect(r.shift.calls.filter((c) => c.state === 'ringing').length).toBe(1);
    expect(baylineShare(r.shift.calls[2], r.shift.t, r.shift.stolen)).toBeNull();
  });

  it('a call heard but left without a car past the decide limit goes too, not before', () => {
    let s = onTheLine([call('1', 'a', 'b')]);
    s = run(s, DECIDE_LIMIT - 1).shift;
    expect(s.calls[0].state).toBe('line');
    s = run(s, 2).shift;
    expect(s.calls[0].state).toBe('stolen');
    expect(summarize(s)).toMatchObject({ stolen: 1, xu: 0 });
    expect(summarize(s).results[0].once).toBe(false);
  });
});

describe('dispatch: pay and news', () => {
  it("two shifts a day pay; the third plays for nothing", () => {
    expect(shiftPay(20, [])).toEqual({ xu: 20, capped: false, id: 'dp-shift-1' });
    expect(shiftPay(20, ['tx-1', 'dp-shift-1'])).toEqual({ xu: 20, capped: false, id: 'dp-shift-2' });
    expect(DISPATCH_SHIFTS_A_DAY).toBe(2);
    expect(shiftPay(20, ['dp-shift-1', 'dp-shift-2'])).toEqual({ xu: 0, capped: true, id: null });
  });

  it('Bay FM talks about a good night and a bad one, and keeps quiet about an ordinary one', () => {
    expect(shiftNews({ right: 7, wrong: 1, stolen: 0 })).toBe('good');
    expect(shiftNews({ right: 7, wrong: 0, stolen: 2 })).toBe(null);
    expect(shiftNews({ right: 3, wrong: 3, stolen: 1 })).toBe('bad');
    expect(shiftNews({ right: 5, wrong: 2, stolen: 1 })).toBe(null);
  });
});

describe('dispatch: the calls of a shift', () => {
  const all = Array.from({ length: 30 }, (_, i) => call(`c${i}`, ['a', 'b', 'c', 'd'][i % 4], ['b', 'c', 'd', 'a'][i % 4], ((i % 3) + 1) as 1 | 2 | 3));
  it('three plain, three natural, two hard, easier first; fresh ones before the recent; no pickup twice in a row', () => {
    const got = pickShiftCalls(all, new Set(), 7);
    expect(got.length).toBe(8);
    expect(got[0].level).toBe(1);
    expect(got.filter((c) => c.level === 1).length).toBe(3);
    expect(got.filter((c) => c.level === 3).length).toBe(2);
    for (let i = 1; i < got.length; i++) expect(got[i].from).not.toBe(got[i - 1].from);
    const recent = new Set(all.filter((c) => c.level === 1).slice(0, 7).map((c) => c.id));
    for (const c of pickShiftCalls(all, recent, 7).filter((c) => c.level === 1)) expect(recent.has(c.id)).toBe(false);
    expect(pickShiftCalls(all, new Set(), 7).map((c) => c.id)).toEqual(got.map((c) => c.id));
  });
});

describe('dispatch: the streets', () => {
  it('a car keeps to the painted streets and squares, round the corner', () => {
    const rows = ['.......', '.=====.', '.=...=.', '.=...=.', '.=====.'];
    const route = makeRoutes(rows);
    const way = route({ x: 1.5, y: 1.5 }, { x: 5.5, y: 4.5 });
    expect(way[way.length - 1]).toEqual({ x: 5.5, y: 4.5 });
    for (const p of way) expect(['=', 'o']).toContain(rows[Math.floor(p.y)][Math.floor(p.x)]);
    expect(way.length).toBeLessThanOrEqual(3);
  });
});
