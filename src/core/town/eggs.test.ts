import { describe, expect, it } from 'vitest';
import { EGG_COST, EGG_PITY, LOOT, RARITY, rarityRank } from '../../data/townGame';
import { balance } from './economy';
import { applyHatch, buyEgg, eggGrantsDue, eggGrantsEarned, eggOdds, eggsInHand, eggsToPity, grantEggs, hatch } from './eggs';
import {
  addEarned,
  addFarmDay,
  daysBefore,
  DAYS_KEEP,
  eggCount,
  MAX_GRANTS,
  emptyTownProgress,
  mergeTownProgress,
  noteFish,
  ownsItem,
  updateDaily,
  updateEpisode,
  type TownProgress,
} from './progress';

const DEV = 'd-aaaa0001';
const OTHER = 'd-bbbb0002';
const NOW = new Date(2026, 10, 20, 12).getTime();

const rich = (xu: number, dev = DEV): TownProgress => addEarned(emptyTownProgress(), dev, xu);

describe('eggs earned by listening', () => {
  it('a gist right on the first listen, a rare fish, a cleared farm, a perfect chat, a 7-day streak', () => {
    let p = emptyTownProgress();
    expect(eggGrantsDue(p)).toEqual([]);
    p = updateEpisode(p, 'cafe-1', (e) => ({ ...e, firstGist: 2 }));
    p = updateEpisode(p, 'cafe-2', (e) => ({ ...e, firstGist: 1 })); // not right on the first listen: no egg
    p = noteFish(p, 'ca-noi', true, 1000, NOW); // thường: no egg
    p = noteFish(p, 'me-can', true, 1000, NOW); // hiếm: an egg
    p = noteFish(p, 'koi-vang', false, 0, NOW); // seen, not caught: no egg
    p = addFarmDay(p, '2026-11-19');
    p = updateDaily(p, '2026-11-18', DEV, (c) => ({ ...c, talks: 1, perfect: 1 }));
    p = { ...p, days: Array.from({ length: 8 }, (_, i) => `2026-11-${String(10 + i).padStart(2, '0')}`) };
    expect(eggGrantsDue(p)).toEqual(['farm:2026-11-19', 'fish:me-can', 'gist:cafe-1', 'perfect:2026-11-18', 'streak:2026-11-16']);
    const g = grantEggs(p);
    expect(g.granted).toHaveLength(5);
    expect(eggsInHand(g.progress)).toBe(5);
    // granted once: nothing more is due, and the same object comes back
    expect(eggGrantsDue(g.progress)).toEqual([]);
    expect(grantEggs(g.progress).progress).toBe(g.progress);
  });

  it('a grant stays when the day it came from leaves the daily counters', () => {
    const p = grantEggs(updateDaily(emptyTownProgress(), '2026-10-01', DEV, (c) => ({ ...c, talks: 1, perfect: 1 }))).progress;
    const later = updateDaily(p, '2026-11-20', DEV, (c) => ({ ...c, lines: 1 }));
    expect(Object.keys(later.daily)).toEqual(['2026-11-20']);
    expect(later.eggs.grants).toEqual(['perfect:2026-10-01']);
    expect(eggsInHand(later)).toBe(1);
  });
});

describe('buying an egg', () => {
  it(`costs ${EGG_COST} xu from the balance; refused when short`, () => {
    expect(buyEgg(rich(EGG_COST - 1), DEV)).toMatchObject({ ok: false, reason: 'poor', missing: 1 });
    const r = buyEgg(rich(EGG_COST + 5), DEV);
    if (!r.ok) throw new Error('refused');
    expect(eggCount(r.progress, 'bought', DEV)).toBe(1);
    expect(eggsInHand(r.progress)).toBe(1);
    expect(balance(r.progress)).toBe(5);
    expect(buyEgg(r.progress, DEV).ok).toBe(false);
    expect(buyEgg(rich(100), 'constructor')).toMatchObject({ ok: false, reason: 'device' });
  });
});

describe('hatching', () => {
  it('needs an egg; gives an item (owned from now) or, owned already, its xu', () => {
    expect(applyHatch(rich(100), DEV, NOW)).toMatchObject({ ok: false, reason: 'no-egg' });
    const bought = buyEgg(rich(EGG_COST), DEV);
    if (!bought.ok) throw new Error('refused');
    const r = applyHatch(bought.progress, DEV, NOW);
    if (!r.ok) throw new Error('no hatch');
    expect(r.hatch.n).toBe(1);
    expect(r.hatch.duplicate).toBe(false);
    expect(ownsItem(r.progress, r.hatch.item.id)).toBe(true);
    expect(r.progress.owned[r.hatch.item.id]).toBe(NOW);
    expect(eggsInHand(r.progress)).toBe(0);
    expect(eggCount(r.progress, 'hatched', DEV)).toBe(1);
  });

  it('the result of an egg is fixed by (browser, number of its egg): no re-roll by reloading', () => {
    const p = { ...rich(0), eggs: { grants: ['gist:cafe-1', 'gist:cafe-2'], bought: {}, hatched: {}, rare: {} } };
    expect(hatch(p, DEV)).toEqual(hatch(JSON.parse(JSON.stringify(p)), DEV));
    const one = applyHatch(p, DEV, NOW);
    const again = applyHatch(p, DEV, NOW + 999);
    if (!one.ok || !again.ok) throw new Error('no hatch');
    expect(again.hatch.item.id).toBe(one.hatch.item.id);
    // another browser's eggs are its own draw
    expect(hatch(p, OTHER).n).toBe(1);
  });

  it(`pity: at least one quý-or-better every ${EGG_PITY} eggs of a browser`, () => {
    let p: TownProgress = { ...emptyTownProgress(), eggs: { grants: Array.from({ length: 200 }, (_, i) => `farm:2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`), bought: {}, hatched: {}, rare: {} } };
    expect(eggsInHand(p)).toBe(200);
    let since = 0;
    let rares = 0;
    let dupXu = 0;
    for (let i = 0; i < 200; i++) {
      expect(eggsToPity(p, DEV)).toBe(EGG_PITY - since);
      const r = applyHatch(p, DEV, NOW + i);
      if (!r.ok) throw new Error('no hatch');
      p = r.progress;
      if (rarityRank(r.hatch.tier) >= rarityRank('quy')) {
        since = 0;
        rares += 1;
      } else since += 1;
      expect(since).toBeLessThan(EGG_PITY);
      if (r.hatch.duplicate) {
        expect(r.hatch.xu).toBe(RARITY[r.hatch.tier].dupXu);
        dupXu += r.hatch.xu;
      } else expect(r.hatch.xu).toBe(0);
    }
    expect(rares).toBeGreaterThanOrEqual(200 / EGG_PITY);
    // after 200 eggs almost everything is owned and the rest came back as xu
    expect(LOOT.filter((i) => ownsItem(p, i.id)).length).toBeGreaterThan(LOOT.length - 5);
    expect(balance(p)).toBe(dupXu);
  });

  it('the odds the shop shows add up to 1', () => {
    const o = eggOdds();
    expect(Object.values(o).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
    expect(o.thuong).toBeGreaterThan(o.hiem);
    expect(o['huyen-thoai']).toBeGreaterThan(0);
  });

  it('two browsers opening the same eggs before a sync: both keep what they got, eggs in hand never below 0', () => {
    const p = { ...emptyTownProgress(), eggs: { grants: ['gist:cafe-1'], bought: {}, hatched: {}, rare: {} } };
    const a = applyHatch(p, DEV, NOW);
    const b = applyHatch(p, OTHER, NOW);
    if (!a.ok || !b.ok) throw new Error('no hatch');
    const m = mergeTownProgress(a.progress, b.progress);
    expect(eggsInHand(m)).toBe(0);
    expect(ownsItem(m, a.hatch.item.id)).toBe(true);
    expect(ownsItem(m, b.hatch.item.id)).toBe(true);
  });
});

describe('streak eggs once the oldest days are pruned (DAYS_KEEP)', () => {
  const START = '2025-01-01';
  const dayN = (n: number): string => daysBefore(START, -n);
  /** One active day written and settled, as the store does after every answer. */
  const play = (p: TownProgress, day: string): TownProgress => grantEggs(updateDaily(p, day, DEV, (c) => ({ ...c, lines: c.lines + 1 }))).progress;
  const streakGrants = (p: TownProgress): string[] => p.eggs.grants.filter((id) => id.startsWith('streak:'));

  it('500 active days in a row: one egg every 7 days, each given once, never a new one a day', () => {
    let p = emptyTownProgress();
    for (let i = 0; i < 500; i++) {
      p = play(p, dayN(i));
      // settled: nothing more is due, whatever was pruned
      expect(eggGrantsDue(p)).toEqual([]);
    }
    expect(p.days).toHaveLength(DAYS_KEEP);
    const got = streakGrants(p);
    expect(got).toHaveLength(Math.floor(500 / 7));
    expect(got).toEqual(Array.from({ length: Math.floor(500 / 7) }, (_, k) => `streak:${dayN(7 * (k + 1) - 1)}`).sort());
    // a reload (a fresh parse of the same value) or a sync with an older copy brings nothing new
    expect(eggGrantsEarned(p).filter((id) => id.startsWith('streak:'))).toEqual(got);
    expect(p.eggs.grants.length).toBeLessThan(MAX_GRANTS);
  });

  it('a long break, then more days: each run counts from its own first day; the pruned run gives nothing again', () => {
    let p = emptyTownProgress();
    for (let i = 0; i < 300; i++) p = play(p, dayN(i));
    // ten days off, then 250 more: the first run is pruned from the front while the second grows
    for (let i = 310; i < 560; i++) {
      p = play(p, dayN(i));
      expect(eggGrantsDue(p)).toEqual([]);
    }
    expect(streakGrants(p)).toHaveLength(Math.floor(300 / 7) + Math.floor(250 / 7));
  });

  it('a pruned run with no egg given yet counts nothing; a newer run counts from its first day', () => {
    // 400 days kept, the oldest run cut by the cap and never granted (a copy that never settled)
    const days = Array.from({ length: DAYS_KEEP - 10 }, (_, i) => dayN(i)).concat(Array.from({ length: 10 }, (_, i) => dayN(DAYS_KEEP + i)));
    const p = { ...emptyTownProgress(), days };
    expect(eggGrantsDue(p)).toEqual([`streak:${dayN(DAYS_KEEP + 6)}`]);
  });
});
