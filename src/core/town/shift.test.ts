import { describe, expect, it } from 'vitest';
import { CITY_SHIFTS, cityShift } from '../../data/city/shifts';
import {
  allSet,
  answer,
  comboMultiplier,
  currentOrder,
  drawShift,
  emptyTownShifts,
  mergeTownShifts,
  missedLast,
  parseTownShifts,
  patienceSeconds,
  recordRun,
  rightCount,
  runOver,
  seededRng,
  served,
  SHIFT_MISSES,
  SHIFT_ORDERS,
  SHIFT_PLAN,
  SHIFT_SCORE_PER_XU,
  SHIFT_XU_DAY,
  shiftPoints,
  shiftXuLeft,
  startRun,
  wrongSlots,
  type ShiftRun,
} from './shift';
import type { ShiftOrder } from './shiftTypes';

const taxi = cityShift('taxi')!;
const flowers = cityShift('flowers')!;
const DAY = '2026-11-25';
const DEV = 'dev-aaaa';
const T0 = 1_780_000_000_000;

const rightPicks = (o: ShiftOrder) => ({ ...o.answer });
const wrongPicks = (o: ShiftOrder) => ({ ...o.answer, when: o.answer.when === 'now' ? 'in10' : 'now' });

/** A run of `def` where `right(i)` says whether the i-th answer is right (heard once, half the patience left). */
function play(right: (i: number) => boolean, seed = 7): ShiftRun {
  const queue = drawShift(taxi, seededRng(seed));
  let r = startRun('taxi', queue);
  for (let i = 0; !runOver(r); i++) {
    const o = currentOrder(r, taxi)!;
    r = answer(r, taxi, o, right(i) ? rightPicks(o) : wrongPicks(o), 1, 0.5);
  }
  return r;
}

describe('judging', () => {
  it('every slot right = served; a wrong or missing slot is named', () => {
    const o = taxi.orders[0];
    expect(served(taxi, o, rightPicks(o))).toBe(true);
    expect(wrongSlots(taxi, o, { ...o.answer, to: 'bos' })).toEqual(['to']);
    expect(wrongSlots(taxi, o, { from: o.answer.from })).toEqual(['to', 'when']);
    expect(allSet(taxi, { from: 'bos', to: 'lumen' })).toBe(false);
    expect(allSet(taxi, { from: 'bos', to: 'lumen', when: 'now' })).toBe(true);
  });
});

describe('points and patience', () => {
  it('10 a level, up to 10 for speed, 5 for hearing it once, times the combo (×3 at most)', () => {
    expect(shiftPoints(1, 0, false, 0)).toBe(10);
    expect(shiftPoints(1, 1, true, 0)).toBe(25);
    expect(shiftPoints(3, 0.5, true, 0)).toBe(40);
    expect(shiftPoints(2, 0, false, 4)).toBe(40);
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(100)).toBe(3);
    expect(shiftPoints(1, Number.NaN, false, 0)).toBe(10);
  });

  it('patience: longer for harder requests and more slots, shorter later in the shift, never under 10 s', () => {
    expect(patienceSeconds(3, 3, 0)).toBeGreaterThan(patienceSeconds(1, 3, 0));
    expect(patienceSeconds(1, 3, 0)).toBeGreaterThan(patienceSeconds(1, 2, 0));
    expect(patienceSeconds(2, 3, 9)).toBeLessThan(patienceSeconds(2, 3, 0));
    expect(patienceSeconds(1, 1, 99)).toBeGreaterThanOrEqual(10);
    expect(patienceSeconds(1, 3, 0)).toBe(17.5);
  });
});

describe('drawing a shift', () => {
  it('ten requests, easier first, none twice, by the plan of levels', () => {
    for (const def of CITY_SHIFTS) {
      for (let seed = 1; seed < 30; seed++) {
        const q = drawShift(def, seededRng(seed));
        expect(q.length).toBe(SHIFT_ORDERS);
        expect(new Set(q.map((o) => o.id)).size).toBe(q.length);
        expect(q.map((o) => o.level)).toEqual([...SHIFT_PLAN]);
      }
    }
  });

  it('the seed changes the draw; the same seed gives the same draw', () => {
    const a = drawShift(flowers, seededRng(1)).map((o) => o.id);
    expect(drawShift(flowers, seededRng(1)).map((o) => o.id)).toEqual(a);
    expect(drawShift(flowers, seededRng(2)).map((o) => o.id)).not.toEqual(a);
  });

  it('the ones missed last time come back; then the ones got right least often', () => {
    const missed = ['sh-taxi-5', 'sh-taxi-20', 'sh-taxi-33'];
    for (let seed = 1; seed < 10; seed++) {
      const q = drawShift(taxi, seededRng(seed), missed).map((o) => o.id);
      for (const id of missed) expect(q).toContain(id);
    }
    // every level-1 request but two got right often: those two are drawn
    const ok = (id: string) => (id === 'sh-taxi-2' || id === 'sh-taxi-9' ? 0 : 5);
    const q = drawShift(taxi, seededRng(3), [], ok).map((o) => o.id);
    expect(q).toContain('sh-taxi-2');
    expect(q).toContain('sh-taxi-9');
  });

  it('a level that runs short is filled from its neighbour; a tiny shift draws what it has', () => {
    const small = { orders: taxi.orders.filter((o) => o.level === 1).slice(0, 4) };
    const q = drawShift(small, seededRng(1));
    expect(q.length).toBe(4);
    const noThree = { orders: taxi.orders.filter((o) => o.level !== 3) };
    const q2 = drawShift(noThree, seededRng(1));
    expect(q2.length).toBe(SHIFT_ORDERS);
    expect(q2.every((o) => o.level !== 3)).toBe(true);
  });
});

describe('a run', () => {
  it('all right: ten served, the combo grows, the score adds up', () => {
    const r = play(() => true);
    expect(r.lines.length).toBe(SHIFT_ORDERS);
    expect(rightCount(r)).toBe(SHIFT_ORDERS);
    expect(r.bestCombo).toBe(SHIFT_ORDERS);
    expect(r.score).toBe(r.lines.reduce((n, l) => n + l.points, 0));
    expect(r.lines[1].points).toBeGreaterThan(r.lines[0].points);
    expect(currentOrder(r, taxi)).toBeNull();
  });

  it('three misses end the run; a miss resets the combo and pays nothing', () => {
    const r = play((i) => i === 0 || i === 1 ? true : false);
    expect(r.misses).toBe(SHIFT_MISSES);
    expect(r.lines.length).toBe(5);
    expect(r.combo).toBe(0);
    expect(r.lines.filter((l) => l.outcome === 'wrong').every((l) => l.points === 0)).toBe(true);
    // nothing more is taken once over
    expect(answer(r, taxi, taxi.orders[0], rightPicks(taxi.orders[0]), 1, 1)).toBe(r);
  });

  it('a replay loses the "heard once" bonus; too late is a miss', () => {
    const q = drawShift(taxi, seededRng(1));
    const o = q[0];
    const once = answer(startRun('taxi', q), taxi, o, rightPicks(o), 1, 0);
    const twice = answer(startRun('taxi', q), taxi, o, rightPicks(o), 2, 0);
    expect(once.lines[0].firstListen).toBe(true);
    expect(twice.lines[0].firstListen).toBe(false);
    expect(once.score - twice.score).toBe(5);
    const late = answer(startRun('taxi', q), taxi, o, null, 1, 0);
    expect(late.lines[0].outcome).toBe('late');
    expect(late.misses).toBe(1);
  });
});

describe('stored', () => {
  it('a run pays score / 20 xu, at most 16 a day per shift over all browsers; the best and the missed are kept', () => {
    const r = play((i) => i !== 2);
    const earned = Math.floor(r.score / SHIFT_SCORE_PER_XU);
    const a = recordRun(emptyTownShifts(), r, DAY, DEV, T0);
    expect(a.xu).toBe(Math.min(SHIFT_XU_DAY, earned));
    expect(a.record).toBe(true);
    expect(a.state.best.taxi).toEqual({ score: r.score, at: T0 });
    expect(missedLast(a.state, 'taxi')).toEqual([r.lines[2].orderId]);
    expect(a.state.orders[r.lines[2].orderId]).toEqual({ n: 1, ok: 0 });
    const b = recordRun(a.state, r, DAY, 'dev-bbbb', T0 + 1);
    expect(b.xu).toBe(Math.max(0, Math.min(SHIFT_XU_DAY - a.xu, earned)));
    expect(b.record).toBe(false);
    expect(shiftXuLeft(b.state, 'taxi', DAY)).toBe(SHIFT_XU_DAY - a.xu - b.xu);
    // the cap is per shift: the flower stall still pays
    expect(shiftXuLeft(b.state, 'flowers', DAY)).toBe(SHIFT_XU_DAY);
    // and a new day starts again
    expect(shiftXuLeft(b.state, 'taxi', '2026-11-26')).toBe(SHIFT_XU_DAY);
  });

  it('a bad day or device writes nothing', () => {
    const r = play(() => true);
    const s = emptyTownShifts();
    expect(recordRun(s, r, 'today', DEV, T0).state).toBe(s);
    expect(recordRun(s, r, DAY, 'X', T0).xu).toBe(0);
  });

  it('parse drops junk and survives its own output', () => {
    expect(parseTownShifts(null)).toEqual(emptyTownShifts());
    expect(parseTownShifts('x')).toEqual(emptyTownShifts());
    const raw = {
      version: 1,
      best: { taxi: { score: 120, at: T0 }, 'Bad Id': { score: 1, at: 1 }, flowers: { score: 'x' } },
      last: { taxi: { at: T0, missed: ['sh-taxi-3', 'bad', 'sh-taxi-1', 'sh-taxi-3'] } },
      orders: { 'sh-taxi-1': { n: 2, ok: 9 }, nope: { n: 1, ok: 1 } },
      days: { [DAY]: { [DEV]: { taxi: { runs: 2, xu: 10 }, flowers: { runs: 0, xu: 0 } }, 'NOT A DEVICE': { taxi: { runs: 1, xu: 1 } } }, junk: {} },
    };
    const p = parseTownShifts(raw);
    expect(p.best).toEqual({ taxi: { score: 120, at: T0 } });
    expect(p.last.taxi.missed).toEqual(['sh-taxi-1', 'sh-taxi-3']);
    expect(p.orders).toEqual({ 'sh-taxi-1': { n: 2, ok: 2 } });
    expect(p.days).toEqual({ [DAY]: { [DEV]: { taxi: { runs: 2, xu: 10 } } } });
    expect(parseTownShifts(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('merge: the higher best, the newer run\'s missed, max counts, max per day cell', () => {
    const a = parseTownShifts({ best: { taxi: { score: 100, at: T0 } }, last: { taxi: { at: T0, missed: ['sh-taxi-1'] } }, orders: { 'sh-taxi-1': { n: 1, ok: 0 } }, days: { [DAY]: { [DEV]: { taxi: { runs: 1, xu: 5 } } } } });
    const b = parseTownShifts({ best: { taxi: { score: 200, at: T0 + 5 } }, last: { taxi: { at: T0 + 5, missed: ['sh-taxi-9'] } }, orders: { 'sh-taxi-1': { n: 3, ok: 2 } }, days: { [DAY]: { [DEV]: { taxi: { runs: 2, xu: 3 } } } } });
    const m = mergeTownShifts(a, b);
    expect(m.best.taxi.score).toBe(200);
    expect(m.last.taxi.missed).toEqual(['sh-taxi-9']);
    expect(m.orders['sh-taxi-1']).toEqual({ n: 3, ok: 2 });
    expect(m.days[DAY][DEV].taxi).toEqual({ runs: 2, xu: 5 });
    expect(mergeTownShifts(b, a)).toEqual(m);
    expect(mergeTownShifts(m, m)).toEqual(m);
  });
});
