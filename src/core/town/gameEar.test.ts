// "Trong game: nghe 1 lần là đúng" (./gameEar.ts): what counts as a first listen, first meetings only, the two voices
// apart, the level kept, totals by days, and a merge that never counts a browser's facts twice.
import { describe, expect, it } from 'vitest';
import { earOk, earPct, earTotals, emptyGameEar, mergeGameEar, noteEar, parseGameEar, type EarFact } from './gameEar';

const DEV = 'd-aaaa1111';
const f = (voice: 'browser' | 'clip', right: boolean, plays: number): EarFact => ({ voice, right, plays });

describe('game ear: what counts', () => {
  it('right after exactly one hearing, at the normal speed', () => {
    expect(earOk(f('browser', true, 1), true)).toBe(true);
    expect(earOk(f('browser', true, 2), true)).toBe(false);
    expect(earOk(f('browser', false, 1), true)).toBe(false);
    expect(earOk(f('browser', true, 1), false)).toBe(false);
  });

  it('a job met for the first time: its facts heard, by voice; a fact never heard is not measured', () => {
    const r = noteEar(emptyGameEar(), DEV, '2026-11-27', { id: 'job-ferry', at: 5, facts: [f('browser', true, 1), f('browser', true, 3), f('clip', false, 1), f('clip', true, 0)] }, { normalSpeed: true });
    expect(r.counted).toBe(true);
    expect(r.store.met['job-ferry']).toBe(5);
    expect(r.store.devices[DEV]['2026-11-27']).toEqual({ browser: { n: 2, ok: 1 }, clip: { n: 1, ok: 0 } });
  });

  it('a job met again, or finished before the store existed: not counted', () => {
    const a = noteEar(emptyGameEar(), DEV, '2026-11-27', { id: 'job-ferry', at: 5, facts: [f('browser', true, 1)] }, { normalSpeed: true }).store;
    const again = noteEar(a, DEV, '2026-11-28', { id: 'job-ferry', at: 9, facts: [f('browser', true, 1)] }, { normalSpeed: true });
    expect(again.counted).toBe(false);
    expect(again.store).toBe(a);
    const old = noteEar(emptyGameEar(), DEV, '2026-11-27', { id: 'job-half5', at: 5, seenBefore: true, facts: [f('browser', true, 1)] }, { normalSpeed: true });
    expect(old.counted).toBe(false);
    expect(old.store.devices).toEqual({});
  });

  it('a slower speed: measured, never right; a level kept when the game gives one', () => {
    const r = noteEar(emptyGameEar(), DEV, '2026-11-27', { id: 'dc-12', at: 5, facts: [f('browser', true, 1)] }, { normalSpeed: false, level: 2 });
    expect(r.store.devices[DEV]['2026-11-27']).toEqual({ browser: { n: 1, ok: 0 }, lv: { '2': { n: 1, ok: 0 } } });
  });

  it('totals between two days, both browsers together, percentages', () => {
    let s = emptyGameEar();
    s = noteEar(s, DEV, '2026-11-01', { id: 'dc-1', at: 1, facts: [f('browser', true, 1)] }, { normalSpeed: true }).store;
    s = noteEar(s, 'd-bbbb2222', '2026-11-20', { id: 'dc-2', at: 2, facts: [f('browser', false, 1), f('clip', true, 1)] }, { normalSpeed: true }).store;
    expect(earTotals(s)).toEqual({ browser: { n: 2, ok: 1 }, clip: { n: 1, ok: 1 } });
    expect(earTotals(s, '2026-11-10')).toEqual({ browser: { n: 1, ok: 0 }, clip: { n: 1, ok: 1 } });
    expect(earPct({ n: 3, ok: 2 })).toBe(67);
    expect(earPct({ n: 0, ok: 0 })).toBeNull();
  });
});

describe('game ear: stored and merged', () => {
  it('junk is dropped piece by piece', () => {
    const s = parseGameEar({ met: { 'job-ferry': 5, 'Bad Id': 3, __proto__: 1, 'dc-3': 'x' }, devices: { 'd-aaaa1111': { '2026-11-27': { browser: { n: 3, ok: 9 }, clip: 'x', lv: { '2': { n: 1, ok: 1 }, x: { n: 1 } } }, bad: {} }, BAD: {} } });
    expect(s.met).toEqual({ 'job-ferry': 5 });
    expect(s.devices).toEqual({ 'd-aaaa1111': { '2026-11-27': { browser: { n: 3, ok: 3 }, lv: { '2': { n: 1, ok: 1 } } } } });
    expect(parseGameEar('junk')).toEqual(emptyGameEar());
  });

  it('two copies of the same browser merge by the max: a fact is never counted twice', () => {
    const a = noteEar(emptyGameEar(), DEV, '2026-11-27', { id: 'dc-1', at: 10, facts: [f('browser', true, 1)] }, { normalSpeed: true }).store;
    const b = noteEar(a, DEV, '2026-11-27', { id: 'dc-2', at: 20, facts: [f('browser', true, 1)] }, { normalSpeed: true }).store;
    const m = mergeGameEar(a, b);
    expect(earTotals(m).browser).toEqual({ n: 2, ok: 2 });
    expect(mergeGameEar(b, a)).toEqual(m);
    expect(mergeGameEar(m, m)).toEqual(m);
    // the earlier first meeting wins
    const later = { ...a, met: { 'dc-1': 30 } };
    expect(mergeGameEar(a, later).met['dc-1']).toBe(10);
  });
});
