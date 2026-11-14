import { describe, expect, it } from 'vitest';
import { placeLines, TOWN_DECORATIONS, TOWN_PLACES } from '../../data/town';
import { DAILY_TASKS_XU } from './daily';
import {
  applyAnswer,
  applyConversation,
  balance,
  boughtDecorationIds,
  builtPlaces,
  buy,
  canBuy,
  CONVERSATION_BONUS,
  conversationBonus,
  isBuilt,
  isPerfect,
  levelFor,
  lineReward,
  owns,
  PERFECT_CONVERSATION_XU,
  placeHearts,
  placeLit,
  placeMarker,
  rawBalance,
  spentTotal,
  TOWN_LEVELS,
  townItem,
  townLevel,
  townTotals,
  townXp,
  xpOf,
} from './economy';
import { placeStats, townOverview } from './overview';
import { addEarned, dailyCount, earnedTotal, emptyTownProgress, mergeTownProgress, type LineBest, type TownProgress } from './progress';
import type { LineOutcome } from './types';

const DEV = 'd-aaaa0001';
const NOW = new Date(2026, 10, 13, 12).getTime();
const TODAY = '2026-11-13';
const make = (p: Partial<TownProgress>): TownProgress => ({ ...emptyTownProgress(), ...p });
const rich = (xu: number, bought: string[] = []): TownProgress => make({ earned: { [DEV]: xu }, bought });
/** The first `n` lines of a place at `best`. */
const understood = (placeId: string, n: number, best: LineBest = 1): TownProgress['lines'] =>
  Object.fromEntries(placeLines(placeId).slice(0, n).map((l) => [l.id, { best, tries: 1, at: NOW }]));

describe('lineReward', () => {
  it('3 for a first listen that raises the line, 2 for a replayed first understanding, 1 for no gain, 0 for a miss', () => {
    const table: [LineBest, LineOutcome, number][] = [
      [0, 'first', 3],
      [1, 'first', 3], // understood with replays before, now on the first listen
      [2, 'first', 1], // already at its best
      [0, 'replayed', 2],
      [1, 'replayed', 1], // replayed again: nothing new
      [2, 'replayed', 1],
      [0, 'wrong', 0],
      [1, 'wrong', 0],
      [2, 'wrong', 0],
    ];
    for (const [prev, outcome, xu] of table) expect(lineReward(prev, outcome), `${prev} ${outcome}`).toBe(xu);
    expect(lineReward(0, 'bogus' as LineOutcome)).toBe(0);
  });

  it('a line pays at most 3 + 2 for getting better; after that every right answer is 1', () => {
    let best: LineBest = 0;
    let xu = 0;
    for (const o of ['wrong', 'replayed', 'replayed', 'first', 'first', 'replayed'] as LineOutcome[]) {
      xu += lineReward(best, o);
      best = Math.max(best, o === 'first' ? 2 : o === 'replayed' ? 1 : 0) as LineBest;
    }
    expect(xu).toBe(0 + 2 + 1 + 3 + 1 + 1);
  });
});

describe('conversation bonus', () => {
  it('5 xu for 5 right out of 5, first listen or not; nothing otherwise', () => {
    expect(CONVERSATION_BONUS).toBe(5);
    expect(conversationBonus(['first', 'first', 'first', 'first', 'first'])).toBe(5);
    expect(conversationBonus(['replayed', 'first', 'replayed', 'first', 'replayed'])).toBe(5);
    expect(conversationBonus(['first', 'first', 'wrong', 'first', 'first'])).toBe(0);
    expect(conversationBonus(['first', 'first', 'first', 'first'])).toBe(0); // left early
    expect(conversationBonus([])).toBe(0);
    expect(isPerfect(['first', 'bogus' as LineOutcome, 'first', 'first', 'first'])).toBe(false);
    expect(isPerfect(['first', 'first'], 2)).toBe(true);
    expect(isPerfect([], 0)).toBe(false);
    expect(PERFECT_CONVERSATION_XU).toBe(20);
  });
});

describe('balance and buying', () => {
  it('balance = earned on all machines − the cost of everything bought', () => {
    const p = make({ earned: { [DEV]: 40, 'd-bbbb0002': 25 }, bought: ['home', 'lamps1'] });
    expect(earnedTotal(p)).toBe(65);
    expect(spentTotal(p)).toBe(30);
    expect(balance(p)).toBe(35);
    expect(balance(emptyTownProgress())).toBe(0);
  });

  it('an id the town does not know (a later version) costs nothing here', () => {
    const p = rich(50, ['home', 'spaceport']);
    expect(spentTotal(p)).toBe(20);
    expect(owns(p, 'spaceport')).toBe(false);
    expect(townItem('spaceport')).toBeUndefined();
  });

  it('townItem finds places and decorations', () => {
    expect(townItem('shop')).toEqual({ id: 'shop', kind: 'place', name: 'Cửa hàng', cost: 30 });
    expect(townItem('cat')).toEqual({ id: 'cat', kind: 'decoration', name: 'Chú mèo', cost: 35 });
    expect(townItem('square')).toMatchObject({ kind: 'place', cost: 0 });
  });

  it('the three free places are always built; a lot is built once bought', () => {
    const p0 = emptyTownProgress();
    expect(builtPlaces(p0).map((p) => p.id)).toEqual(['square', 'cafe', 'friend']);
    for (const id of ['square', 'cafe', 'friend']) expect(isBuilt(p0, id)).toBe(true);
    expect(isBuilt(p0, 'home')).toBe(false);
    expect(isBuilt(p0, 'lamps1')).toBe(false); // a decoration is not a place
    expect(isBuilt(p0, 'nope')).toBe(false);
    const p1 = rich(200, ['park', 'home', 'cat']);
    expect(builtPlaces(p1).map((p) => p.id)).toEqual(['square', 'cafe', 'friend', 'home', 'park']); // listed order
    expect(boughtDecorationIds(p1)).toEqual(['cat']);
    expect(owns(p1, 'cat')).toBe(true);
    expect(owns(p1, 'lamps1')).toBe(false);
    expect(owns(p1, 'cafe')).toBe(true);
  });

  it('canBuy: enough xu, not owned, known', () => {
    expect(canBuy(rich(20), 'home')).toEqual({ ok: true, item: { id: 'home', kind: 'place', name: 'Nhà', cost: 20 } });
    expect(canBuy(rich(19), 'home')).toMatchObject({ ok: false, reason: 'poor', missing: 1 });
    expect(canBuy(emptyTownProgress(), 'flowers')).toMatchObject({ ok: false, reason: 'poor', missing: 8 });
    expect(canBuy(rich(500, ['home']), 'home')).toMatchObject({ ok: false, reason: 'owned', missing: 0 });
    expect(canBuy(rich(500), 'cafe')).toMatchObject({ ok: false, reason: 'owned' }); // free: stands already
    expect(canBuy(rich(500), 'nope')).toEqual({ ok: false, reason: 'unknown', item: null, missing: 0 });
    expect(canBuy(rich(500), 7 as unknown as string)).toMatchObject({ ok: false, reason: 'unknown' });
    expect(canBuy(rich(500), '__proto__')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('buy is immutable, spends the cost and can be done in any order', () => {
    const p0 = rich(120);
    const r1 = buy(p0, 'park');
    expect(r1).toMatchObject({ ok: true, balance: 20 });
    expect(p0.bought).toEqual([]);
    expect(isBuilt(r1.progress, 'park')).toBe(true);
    const r2 = buy(r1.progress, 'home'); // the cheapest lot after the dearest: any order
    expect(r2).toMatchObject({ ok: true, balance: 0 });
    expect(r2.progress.bought).toEqual(['home', 'park']);
    expect(earnedTotal(r2.progress)).toBe(120); // earned never goes down: the balance is derived
    const r3 = buy(r2.progress, 'flowers');
    expect(r3).toMatchObject({ ok: false, reason: 'poor', missing: 8, balance: 0 });
    expect(r3.progress).toBe(r2.progress);
    expect(buy(r2.progress, 'park')).toMatchObject({ ok: false, reason: 'owned' });
    expect(buy(r2.progress, 'nope').progress).toBe(r2.progress);
  });

  it('two machines spending the same xu before a sync: both purchases stay, the balance shows 0, the debt is earned back', () => {
    const start = rich(30);
    const laptop = buy(start, 'shop').progress;
    const phone = buy(start, 'stall').progress;
    const merged = mergeTownProgress(laptop, phone);
    expect(merged.bought).toEqual(['shop', 'stall']);
    expect(rawBalance(merged)).toBe(-30);
    expect(balance(merged)).toBe(0);
    expect(canBuy(merged, 'flowers')).toMatchObject({ ok: false, reason: 'poor', missing: 38 });
    expect(canBuy(addEarned(merged, DEV, 38), 'flowers').ok).toBe(true);
  });

  it('the whole town can be afforded from its own lines: prices fit what the content can pay', () => {
    const all = [...TOWN_PLACES, ...TOWN_DECORATIONS].reduce((sum, i) => sum + i.cost, 0);
    expect(all).toBe(650 + 240);
    const lines = townTotals(emptyTownProgress()).total;
    expect(lines * 3).toBeGreaterThanOrEqual(all); // first listen on every line alone pays for everything
    // a first evening: one perfect conversation and the tasks it can reach buy the first lot
    expect(PERFECT_CONVERSATION_XU + DAILY_TASKS_XU).toBeGreaterThanOrEqual(TOWN_PLACES.find((p) => p.id === 'home')!.cost);
  });
});

describe('level', () => {
  it('xp = 3 per line understood on the first listen + 2 per line understood with replays', () => {
    expect(xpOf({ understood: 0, first: 0 })).toBe(0);
    expect(xpOf({ understood: 5, first: 5 })).toBe(15);
    expect(xpOf({ understood: 5, first: 2 })).toBe(12);
    expect(xpOf({ understood: 300, first: 300 })).toBe(900);
    const p = make({ lines: { ...understood('cafe', 4, 2), ...understood('square', 3, 1), gone: { best: 2, tries: 1, at: NOW } } });
    expect(townTotals(p)).toEqual({ total: 300, understood: 7, first: 4 });
    expect(townXp(p)).toBe(18);
    expect(townLevel(p)).toMatchObject({ index: 1, title: 'Người quen', xp: 18 });
  });

  it('titles at 0 / 15 / 40 / 80 / 150 / 300', () => {
    expect(TOWN_LEVELS.map((l) => [l.at, l.title])).toEqual([
      [0, 'Khách lạ'],
      [15, 'Người quen'],
      [40, 'Hàng xóm'],
      [80, 'Cư dân'],
      [150, 'Người của thị trấn'],
      [300, 'Thị trưởng'],
    ]);
    expect(levelFor(0)).toEqual({ index: 0, title: 'Khách lạ', xp: 0, nextAt: 15, nextTitle: 'Người quen', progress: 0 });
    expect(levelFor(14)).toMatchObject({ index: 0, nextAt: 15 });
    expect(levelFor(14).progress).toBeCloseTo(14 / 15);
    expect(levelFor(15)).toEqual({ index: 1, title: 'Người quen', xp: 15, nextAt: 40, nextTitle: 'Hàng xóm', progress: 0 });
    expect(levelFor(60)).toMatchObject({ index: 2, title: 'Hàng xóm', nextAt: 80, progress: 0.5 });
    expect(levelFor(149)).toMatchObject({ index: 3, title: 'Cư dân' });
    expect(levelFor(150)).toMatchObject({ index: 4, title: 'Người của thị trấn', nextAt: 300, progress: 0 });
    expect(levelFor(300)).toEqual({ index: 5, title: 'Thị trưởng', xp: 300, nextAt: null, nextTitle: null, progress: 1 });
    expect(levelFor(900)).toMatchObject({ index: 5, progress: 1 });
    for (const junk of [-5, Number.NaN, Number.POSITIVE_INFINITY]) expect(levelFor(junk)).toMatchObject({ index: 0, xp: 0, progress: 0 });
  });

  it('never goes down: a wrong answer later takes no xp away', () => {
    const [l1] = placeLines('cafe');
    const a = applyAnswer(emptyTownProgress(), l1.id, 'first', NOW, DEV).progress;
    const b = applyAnswer(a, l1.id, 'wrong', NOW + 1, DEV).progress;
    expect(townXp(b)).toBe(townXp(a));
  });
});

describe('a place: lit windows, hearts, marker', () => {
  const s = (understoodLines: number, first = 0, total = 20) => ({ total, understood: understoodLines, first });

  it('lit is the share of its lines understood', () => {
    expect(placeLit(s(0))).toBe(0);
    expect(placeLit(s(5))).toBe(0.25);
    expect(placeLit(s(20))).toBe(1);
    expect(placeLit(s(25))).toBe(1);
    expect(placeLit(s(0, 0, 0))).toBe(0);
  });

  it('hearts: 10 / 30 / 50 / 70 % of the lines, the fifth only with every line understood', () => {
    expect([0, 1, 2, 5, 6, 9, 10, 13, 14, 19, 20].map((n) => placeHearts(s(n)))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect(placeHearts(s(0, 0, 0))).toBe(0);
    // every place of the town: a first perfect conversation is worth a heart
    for (const p of TOWN_PLACES) {
      const total = placeLines(p.id).length;
      expect(placeHearts({ total, understood: 5 }), p.id).toBeGreaterThanOrEqual(1);
      expect(placeHearts({ total, understood: total - 1 }), p.id).toBe(4);
      expect(placeHearts({ total, understood: total }), p.id).toBe(5);
    }
  });

  it("marker: 'new' while lines are not understood, 'repeat' while some needed replays, 'heart' at the end", () => {
    expect(placeMarker(s(0))).toBe('new');
    expect(placeMarker(s(19, 19))).toBe('new');
    expect(placeMarker(s(20, 0))).toBe('repeat');
    expect(placeMarker(s(20, 19))).toBe('repeat');
    expect(placeMarker(s(20, 20))).toBe('heart');
    expect(placeMarker(s(0, 0, 0))).toBe('new');
  });
});

describe('applyAnswer', () => {
  const [l1, l2] = placeLines('cafe');

  it('records the line, pays its xu into the device bucket and counts the day, without changing its input', () => {
    const p0 = emptyTownProgress();
    const r = applyAnswer(p0, l1.id, 'first', NOW, DEV);
    expect(p0).toEqual(emptyTownProgress());
    expect(r).toMatchObject({ reward: 3, tasksPaid: [], prevBest: 0 });
    expect(r.progress).toEqual({
      version: 2,
      lines: { [l1.id]: { best: 2, tries: 1, at: NOW } },
      earned: { [DEV]: 3 },
      bought: [],
      daily: { [TODAY]: { [DEV]: { talks: 0, lines: 1, first: 1, met: [], paid: [] } } },
      days: [TODAY],
    });
  });

  it('pays by what the line was before: replayed 2, then first 3, then 1 for every repeat; a miss pays nothing', () => {
    let p = emptyTownProgress();
    const xu: number[] = [];
    for (const o of ['wrong', 'replayed', 'first', 'first', 'replayed', 'wrong'] as LineOutcome[]) {
      const r = applyAnswer(p, l1.id, o, NOW, DEV);
      xu.push(r.reward);
      p = r.progress;
    }
    expect(xu).toEqual([0, 2, 3, 1, 1, 0]);
    expect(balance(p)).toBe(7);
    expect(p.lines[l1.id]).toMatchObject({ best: 2, tries: 6 });
    expect(dailyCount(p, TODAY, DEV)).toMatchObject({ lines: 4, first: 2 });
  });

  it('a wrong first answer earns nothing but is remembered (the line, the day)', () => {
    const r = applyAnswer(emptyTownProgress(), l2.id, 'wrong', NOW, DEV);
    expect(r).toMatchObject({ reward: 0, tasksPaid: [], prevBest: 0 });
    expect(r.progress.lines[l2.id]).toEqual({ best: 0, tries: 1, at: NOW });
    expect(r.progress.earned).toEqual({});
    expect(r.progress.days).toEqual([TODAY]);
  });

  it('the answer that reaches a daily task is paid for both', () => {
    let p = emptyTownProgress();
    const lines = placeLines('cafe');
    for (let i = 0; i < 3; i++) p = applyAnswer(p, lines[i].id, 'first', NOW, DEV).progress;
    const r = applyAnswer(p, lines[3].id, 'first', NOW, DEV);
    expect(r.reward).toBe(3);
    expect(r.tasksPaid).toEqual([{ id: 'first', label: 'Hiểu 4 câu ngay lần nghe đầu', reward: 10 }]);
    expect(balance(r.progress)).toBe(4 * 3 + 10);
  });

  it('an unusable line id changes nothing and pays nothing', () => {
    const p = rich(5);
    for (const bad of ['', '__proto__', 'constructor', 'x'.repeat(201)]) {
      expect(applyAnswer(p, bad, 'first', NOW, DEV)).toEqual({ progress: p, reward: 0, tasksPaid: [], prevBest: 0 });
    }
  });
});

describe('applyConversation', () => {
  const five: LineOutcome[] = ['first', 'replayed', 'first', 'first', 'replayed'];

  it('a perfect conversation adds 5 xu and counts the resident for today', () => {
    const r = applyConversation(emptyTownProgress(), 'cafe', five, NOW, DEV);
    expect(r).toMatchObject({ finished: true, perfect: true, bonus: 5, tasksPaid: [] });
    expect(r.progress.earned).toEqual({ [DEV]: 5 });
    expect(dailyCount(r.progress, TODAY, DEV)).toMatchObject({ talks: 1, met: ['cafe'] });
  });

  it('one wrong line: counted, no bonus', () => {
    const r = applyConversation(emptyTownProgress(), 'cafe', ['first', 'wrong', 'first', 'first', 'first'], NOW, DEV);
    expect(r).toMatchObject({ finished: true, perfect: false, bonus: 0 });
    expect(r.progress.earned).toEqual({});
    expect(dailyCount(r.progress, TODAY, DEV).talks).toBe(1);
  });

  it('the second resident of the day pays the "talk" task with it', () => {
    const one = applyConversation(emptyTownProgress(), 'cafe', five, NOW, DEV).progress;
    const two = applyConversation(one, 'square', ['wrong', 'wrong', 'wrong', 'wrong', 'wrong'], NOW + 1, DEV);
    expect(two.tasksPaid.map((t) => t.id)).toEqual(['talk']);
    expect(balance(two.progress)).toBe(5 + 5);
  });

  it('left early, or an empty lot: nothing happens', () => {
    const p = emptyTownProgress();
    expect(applyConversation(p, 'cafe', ['first', 'first', 'first', 'first'], NOW, DEV)).toEqual({ progress: p, finished: false, perfect: false, bonus: 0, tasksPaid: [] });
    expect(applyConversation(p, 'home', five, NOW, DEV)).toMatchObject({ progress: p, finished: false, bonus: 0 });
    expect(applyConversation(p, 'nope', five, NOW, DEV).finished).toBe(false);
    expect(applyConversation(rich(0, ['home']), 'home', five, NOW, DEV)).toMatchObject({ finished: true, bonus: 5 });
  });
});

describe('townOverview', () => {
  it('a new town: three places built, ten lots, nothing affordable, tasks at zero', () => {
    const o = townOverview(emptyTownProgress(), NOW, DEV);
    expect(o).toMatchObject({ balance: 0, earned: 0, streak: 0, playedToday: false, built: 3, decorated: 0, canBuySomething: false });
    expect(o.level).toMatchObject({ index: 0, title: 'Khách lạ', xp: 0 });
    expect(o.totals).toEqual({ total: 300, understood: 0, first: 0 });
    expect(o.tasks.map((t) => [t.id, t.done, t.paid])).toEqual([
      ['talk', 0, false],
      ['lines', 0, false],
      ['first', 0, false],
    ]);
    expect(o.places.map((v) => v.place.id)).toEqual(TOWN_PLACES.map((p) => p.id));
    expect(o.places.filter((v) => v.built).map((v) => v.place.id)).toEqual(['square', 'cafe', 'friend']);
    expect(o.places[0]).toEqual({
      place: TOWN_PLACES[0],
      built: true,
      cost: 0,
      affordable: false,
      missing: 0,
      stats: { total: placeLines('square').length, understood: 0, first: 0 },
      hearts: 0,
      lit: 0,
      marker: 'new',
    });
    const home = o.places.find((v) => v.place.id === 'home')!;
    expect(home).toMatchObject({ built: false, cost: 20, affordable: false, missing: 20, hearts: 0, lit: 0, marker: null });
    expect(o.decorations.map((d) => d.decoration.id)).toEqual(TOWN_DECORATIONS.map((d) => d.id));
    expect(o.decorations[0]).toEqual({ decoration: TOWN_DECORATIONS[0], bought: false, cost: 10, affordable: false, missing: 10 });
  });

  it('a town in progress: balance, what is affordable, hearts, lit, markers, level, streak, tasks', () => {
    const cafe = placeLines('cafe');
    const p = make({
      lines: {
        ...Object.fromEntries(cafe.map((l) => [l.id, { best: 2 as LineBest, tries: 1, at: NOW }])),
        ...Object.fromEntries(placeLines('friend').map((l) => [l.id, { best: 1 as LineBest, tries: 1, at: NOW }])),
        ...understood('square', 7, 2),
      },
      earned: { [DEV]: 60, 'd-bbbb0002': 25 },
      bought: ['home', 'lamps1', 'flowers'],
      daily: { [TODAY]: { [DEV]: { talks: 1, lines: 9, first: 3, met: ['cafe'], paid: ['lines'] } } },
      days: ['2026-11-11', '2026-11-12', '2026-11-13'],
    });
    const o = townOverview(p, NOW, DEV);
    expect(o.balance).toBe(85 - 38);
    expect(o.earned).toBe(85);
    expect(o.streak).toBe(3);
    expect(o.playedToday).toBe(true);
    expect(o.built).toBe(4);
    expect(o.decorated).toBe(2);
    expect(o.canBuySomething).toBe(true);
    const by = Object.fromEntries(o.places.map((v) => [v.place.id, v]));
    expect(by.cafe).toMatchObject({ built: true, hearts: 5, lit: 1, marker: 'heart' });
    expect(by.friend).toMatchObject({ built: true, hearts: 5, lit: 1, marker: 'repeat' });
    expect(by.square).toMatchObject({ hearts: 2, marker: 'new' });
    expect(by.square.lit).toBeCloseTo(7 / placeLines('square').length);
    expect(by.home).toMatchObject({ built: true, affordable: false, missing: 0, marker: 'new' });
    expect(by.shop).toMatchObject({ built: false, affordable: true, missing: 0, marker: null }); // 30 ≤ 47
    expect(by.office).toMatchObject({ built: false, affordable: true });
    expect(by.school).toMatchObject({ built: false, affordable: false, missing: 3 }); // 50 − 47
    const deco = Object.fromEntries(o.decorations.map((d) => [d.decoration.id, d]));
    expect(deco.lamps1).toMatchObject({ bought: true, affordable: false, missing: 0 });
    expect(deco.cat).toMatchObject({ bought: false, affordable: true });
    expect(o.totals).toEqual({ total: 300, understood: cafe.length + placeLines('friend').length + 7, first: cafe.length + 7 });
    expect(o.level.xp).toBe(3 * (cafe.length + 7) + 2 * placeLines('friend').length);
    expect(o.level.title).toBe('Cư dân');
    expect(o.tasks.map((t) => [t.id, t.done, t.reached, t.paid])).toEqual([
      ['talk', 1, false, false],
      ['lines', 8, true, true],
      ['first', 3, false, false],
    ]);
    // another browser sees the same town but its own tasks
    expect(townOverview(p, NOW, 'd-bbbb0002').tasks.every((t) => t.done === 0 && !t.paid)).toBe(true);
    expect(townOverview(p, NOW, 'd-bbbb0002').balance).toBe(o.balance);
    expect(placeStats(p, { id: 'cafe' })).toEqual(by.cafe.stats);
  });

  it('a debt after a double spend shows as 0 and makes nothing affordable', () => {
    const o = townOverview(make({ earned: { [DEV]: 30 }, bought: ['shop', 'stall'] }), NOW, DEV);
    expect(o.balance).toBe(0);
    expect(o.canBuySomething).toBe(false);
    expect(o.decorations.find((d) => d.decoration.id === 'flowers')).toMatchObject({ affordable: false, missing: 38 });
  });
});
