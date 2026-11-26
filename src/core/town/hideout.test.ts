import { describe, expect, it } from 'vitest';
import { canRest, dueOnTape, emptyTownHideout, GAME_HOUR_MS, isRelistenRef, markBought, markRested, mergeTownHideout, ownsHideout, parseTownHideout, restWait, tapeOf } from './hideout';
import { HIDEOUT_COST, HIDEOUT_ID } from '../../data/city/hideout';
import { buy, canBuy, owns, spentTotal } from './economy';
import { addEarned, emptyTownProgress } from './progress';

const T0 = Date.UTC(2026, 10, 27, 9, 0, 0);

describe('the hideout: bought once with xu, through the town store', () => {
  it('costs 800 xu, is refused when short, and stays bought', () => {
    const device = 'dev-aaaa1111';
    let p = addEarned(emptyTownProgress(), device, HIDEOUT_COST - 1);
    const short = canBuy(p, HIDEOUT_ID);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.missing).toBe(1);
    p = addEarned(p, device, 1);
    const r = buy(p, HIDEOUT_ID);
    expect(r.ok).toBe(true);
    expect(r.balance).toBe(0);
    expect(owns(r.progress, HIDEOUT_ID)).toBe(true);
    expect(spentTotal(r.progress)).toBe(HIDEOUT_COST);
    expect(canBuy(r.progress, HIDEOUT_ID).ok).toBe(false);
  });

  it('is owned by either copy alone: the town list or the hideout record', () => {
    expect(ownsHideout([], emptyTownHideout())).toBe(false);
    expect(ownsHideout([HIDEOUT_ID], emptyTownHideout())).toBe(true);
    expect(ownsHideout([], markBought(emptyTownHideout(), T0))).toBe(true);
    // the first time it was bought is kept
    expect(markBought(markBought(emptyTownHideout(), T0), T0 + 5).bought).toBe(T0);
  });
});

describe('the hideout record: parsed safely, merged by laws', () => {
  it('drops what is broken', () => {
    for (const bad of [null, 'x', [], 5, { bought: 'yesterday', rested: -4, upgrades: { __proto__: T0, 'Bad Id': T0, ok: 'x' } }]) {
      const v = parseTownHideout(bad);
      expect(v.bought).toBe(null);
      expect(v.rested).toBe(0);
      expect(Object.keys(v.upgrades)).toEqual([]);
    }
    expect(parseTownHideout({ bought: T0, rested: T0 + 1, upgrades: { desk: T0 } })).toEqual({ version: 1, bought: T0, rested: T0 + 1, upgrades: { desk: T0 } });
  });

  it('keeps the earlier buying, the later rest, each upgrade at its earlier time', () => {
    const a = { version: 1, bought: T0 + 10, rested: T0 + 50, upgrades: { desk: T0 + 3 } };
    const b = { version: 1, bought: T0, rested: T0 + 20, upgrades: { desk: T0 + 1, bed: T0 + 7 } };
    const m = mergeTownHideout(a, b);
    expect(m).toEqual({ version: 1, bought: T0, rested: T0 + 50, upgrades: { bed: T0 + 7, desk: T0 + 1 } });
    expect(mergeTownHideout(b, a)).toEqual(m);
    expect(mergeTownHideout(m, m)).toEqual(m);
    // bought on one machine only: still bought after the merge, whichever side
    expect(mergeTownHideout(emptyTownHideout(), b).bought).toBe(T0);
    expect(mergeTownHideout(b, emptyTownHideout()).bought).toBe(T0);
  });
});

describe('"Nằm nghỉ": once an hour of the game', () => {
  it('needs the hideout, then one rest per game hour', () => {
    const s0 = emptyTownHideout();
    expect(canRest(false, s0, T0)).toBe(false);
    expect(canRest(true, s0, T0)).toBe(true);
    const hourStart = Math.floor(T0 / GAME_HOUR_MS) * GAME_HOUR_MS;
    const s1 = markRested(s0, hourStart + 1000);
    expect(canRest(true, s1, hourStart + 2000)).toBe(false);
    expect(restWait(s1, hourStart + 2000)).toBe(GAME_HOUR_MS - 2000);
    expect(canRest(true, s1, hourStart + GAME_HOUR_MS)).toBe(true);
    expect(restWait(s1, hourStart + GAME_HOUR_MS)).toBe(0);
    // an hour of the game is two real minutes
    expect(GAME_HOUR_MS).toBe(120_000);
  });
});

describe('"Nghe lại băng": the missed lines of jobs and the office, newest first', () => {
  it('lists only job and dispatch cards, the newest first, and counts the due ones', () => {
    const cards = [
      { ref: 'job-m0-12', added: T0 + 1, due: T0 + 100 },
      { ref: 'disp-a3', added: T0 + 5, due: T0 - 1 },
      { ref: 'square-1-3', added: T0 + 9, due: T0 - 1 },
      { ref: 'job-m2-04', added: T0 + 3, due: T0 },
    ];
    const tape = tapeOf(cards);
    expect(tape.map((c) => c.ref)).toEqual(['disp-a3', 'job-m2-04', 'job-m0-12']);
    expect(dueOnTape(tape, T0)).toBe(2);
    expect(isRelistenRef('square-1-3')).toBe(false);
    expect(tapeOf(cards, 1)).toHaveLength(1);
  });
});
