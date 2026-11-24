import { describe, expect, it } from 'vitest';
import { CAFE_ORDERS } from '../../data/townCafe';
import { TOWN_PLACES } from '../../data/town';
import {
  addToTray,
  basketSize,
  CAFE_BOND_SERVED,
  CAFE_XU_DAY,
  cafeBestToday,
  cafeStreak,
  cafeXuLeft,
  comboMultiplier,
  emptyTownCafe,
  levelFor,
  mergeTownCafe,
  nextOrder,
  parseTownCafe,
  patienceMs,
  recordShift,
  serve,
  servedRight,
  SHIFT_CUSTOMERS,
  SHIFT_HEARTS,
  shiftOver,
  SKILL_DOWN,
  SKILL_UP,
  skillAfter,
  startShift,
  takeFromTray,
  trayPoints,
  trayRight,
  type Shift,
} from './cafe';
import { CAFE_ITEMS, type CafeOrder } from './cafeTypes';

const order = (id: string, level: 1 | 2 | 3, items: CafeOrder['items'], placeId = 'shop'): CafeOrder => ({ id, placeId, level, text: 'x', vi: 'x', items });
const LATTE = order('cf-shop-1', 1, { latte: 1 });
const TWO = order('cf-shop-5', 2, { tea: 2, muffin: 1 });
const DEV = 'd-laptop01';
const T = new Date(2026, 10, 24, 10).getTime();

describe('the tray', () => {
  it('is right only when it is exactly the order', () => {
    expect(trayRight(TWO, { tea: 2, muffin: 1 })).toBe(true);
    expect(trayRight(TWO, { tea: 1, muffin: 1 })).toBe(false);
    expect(trayRight(TWO, { tea: 2, muffin: 1, cookie: 1 })).toBe(false);
    expect(trayRight(LATTE, { 'iced-latte': 1 })).toBe(false);
    expect(basketSize(TWO.items)).toBe(3);
  });

  it('takes up to three of a kind and gives them back', () => {
    let t = addToTray(addToTray(addToTray(addToTray({}, 'tea'), 'tea'), 'tea'), 'tea');
    expect(t).toEqual({ tea: 3 });
    t = takeFromTray(takeFromTray(takeFromTray(t, 'tea'), 'tea'), 'tea');
    expect(t).toEqual({});
    expect(takeFromTray(t, 'tea')).toBe(t);
  });
});

describe('difficulty that follows the learner (about 85% right)', () => {
  it('a miss costs what 0.85 / 0.15 right trays earn, so the skill rests near 85% right', () => {
    expect(SKILL_DOWN / SKILL_UP).toBeCloseTo(0.85 / 0.15, 6);
    // 85 right and 15 wrong leave the skill where it was
    expect(85 * SKILL_UP - 15 * SKILL_DOWN).toBeCloseTo(0, 6);
    expect(skillAfter(5, true, true)).toBeCloseTo(5 + SKILL_UP, 6);
    expect(skillAfter(5, false, true)).toBeCloseTo(5 - SKILL_DOWN, 6);
    expect(skillAfter(0, false, false)).toBe(0);
    expect(skillAfter(10, true, true)).toBe(10);
    // a replay earns half
    expect(skillAfter(3, true, false) - 3).toBeCloseTo(SKILL_UP / 2, 6);
  });

  it('harder orders and less patience as the skill rises; never under six seconds', () => {
    expect(levelFor(0, 0.99)).toBe(1);
    expect(levelFor(4.9, 0)).toBe(2);
    expect(levelFor(6, 0.99)).toBe(2);
    expect(levelFor(9, 0)).toBe(3);
    expect(patienceMs(LATTE, 0)).toBeGreaterThan(patienceMs(LATTE, 10));
    expect(patienceMs(TWO, 0)).toBeGreaterThan(patienceMs(LATTE, 0));
    expect(patienceMs(LATTE, 10)).toBeGreaterThanOrEqual(6000);
  });
});

describe('a shift', () => {
  it('pays more for speed, a first listen and a run of right trays; a miss resets the run and costs a heart', () => {
    expect(trayPoints(1, 0, false, 0)).toBe(10);
    expect(trayPoints(1, 1, true, 0)).toBe(25);
    expect(trayPoints(2, 0.5, true, 4)).toBe(Math.round(30 * 2));
    expect(comboMultiplier(100)).toBe(3);
    let s = startShift(0, 42);
    s = serve(s, LATTE, { latte: 1 }, 1, 1);
    s = serve(s, TWO, { tea: 2, muffin: 1 }, 2, 0.5);
    expect(s.combo).toBe(2);
    expect(s.lines[1]).toMatchObject({ outcome: 'right', firstListen: false });
    expect(s.score).toBe(25 + Math.round((20 + 5) * 1.25));
    s = serve(s, LATTE, { tea: 1 }, 1, 0.9);
    expect(s).toMatchObject({ combo: 0, bestCombo: 2, hearts: SHIFT_HEARTS - 1 });
    expect(s.lines[2]).toMatchObject({ outcome: 'wrong', points: 0 });
    s = serve(s, LATTE, null, 1, 0);
    expect(s.lines[3].outcome).toBe('late');
  });

  it('ends after three misses or twelve customers', () => {
    let s = startShift(0, 1);
    for (let i = 0; i < SHIFT_HEARTS; i++) s = serve(s, LATTE, null, 1, 0);
    expect(shiftOver(s)).toBe(true);
    expect(serve(s, LATTE, { latte: 1 }, 1, 1)).toBe(s);
    let full = startShift(0, 1);
    for (let i = 0; i < SHIFT_CUSTOMERS; i++) full = serve(full, LATTE, { latte: 1 }, 1, 1);
    expect(shiftOver(full)).toBe(true);
    expect(servedRight(full)).toBe(SHIFT_CUSTOMERS);
  });

  it('never repeats an order in a shift nor the same resident twice running; missed orders come back first', () => {
    let s = startShift(0, 7);
    const seen = new Set<string>();
    let last = '';
    for (let i = 0; i < SHIFT_CUSTOMERS; i++) {
      const o = nextOrder(s, CAFE_ORDERS, () => 0)!;
      expect(seen.has(o.id)).toBe(false);
      expect(o.placeId).not.toBe(last);
      seen.add(o.id);
      last = o.placeId;
      s = serve(s, o, o.items, 1, 1);
    }
    // every level-1 order was got right once except one: it is the next
    const one = CAFE_ORDERS.filter((o) => o.level === 1)[5];
    expect(nextOrder(startShift(0, 99), CAFE_ORDERS, (id) => (id === one.id ? 0 : 1))?.id).toBe(one.id);
  });
});

describe('what a shift leaves behind', () => {
  const played = (score: number, right = 9): Shift => {
    let s = startShift(3, 5);
    for (let i = 0; i < right; i++) s = serve(s, order(`cf-shop-${i + 1}`, 1, { latte: 1 }), { latte: 1 }, 1, 1);
    return { ...s, score };
  };

  it('pays xu up to the day cap, Emma once a day, and keeps the best', () => {
    const a = recordShift(emptyTownCafe(), played(300), '2026-11-24', DEV, T);
    expect(a).toMatchObject({ xu: 10, record: true, bond: true });
    expect(cafeXuLeft(a.cafe, '2026-11-24')).toBe(CAFE_XU_DAY - 10);
    const b = recordShift(a.cafe, played(900), '2026-11-24', DEV, T + 1000);
    expect(b).toMatchObject({ xu: CAFE_XU_DAY - 10, record: true, bond: false });
    expect(recordShift(b.cafe, played(600), '2026-11-24', 'd-phone001', T + 2000)).toMatchObject({ xu: 0, record: false });
    expect(cafeBestToday(b.cafe, '2026-11-24')).toBe(900);
    expect(b.cafe.days['2026-11-24'][DEV].runs).toBe(2);
    expect(b.cafe.orders['cf-shop-1']).toEqual({ n: 2, ok: 2 });
    // too few served: no friendship
    expect(recordShift(emptyTownCafe(), played(100, CAFE_BOND_SERVED - 1), '2026-11-24', DEV, T).bond).toBe(false);
    // the next shift starts a little under where this one ended
    expect(a.cafe.skill!.v).toBeLessThan(played(300).skill);
  });

  it('counts days in a row with a shift', () => {
    let c = emptyTownCafe();
    for (const d of ['2026-11-21', '2026-11-22', '2026-11-23']) c = recordShift(c, played(60), d, DEV, T).cafe;
    expect(cafeStreak(c, '2026-11-23')).toBe(3);
    expect(cafeStreak(c, '2026-11-24')).toBe(3);
    expect(cafeStreak(c, '2026-11-25')).toBe(0);
    expect(cafeStreak(emptyTownCafe(), '2026-11-24')).toBe(0);
  });

  it('parses junk to nothing and merges two browsers', () => {
    expect(parseTownCafe('junk')).toEqual(emptyTownCafe());
    expect(parseTownCafe({ best: { score: -1 }, orders: { 'Bad Id': { n: 2 } }, days: { nope: {} } })).toEqual(emptyTownCafe());
    const a = recordShift(emptyTownCafe(), played(300), '2026-11-24', DEV, T).cafe;
    const b = recordShift(emptyTownCafe(), played(450), '2026-11-24', 'd-phone001', T + 5).cafe;
    const m = mergeTownCafe(a, b);
    expect(m.best?.score).toBe(450);
    expect(Object.keys(m.days['2026-11-24']).sort()).toEqual([DEV, 'd-phone001'].sort());
    expect(mergeTownCafe(b, a)).toEqual(m);
    expect(parseTownCafe(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
});

describe('the orders (data/townCafe)', () => {
  it('ten for each of the twelve customers, levels 4 / 4 / 2, only what the counter sells', () => {
    const customers = TOWN_PLACES.map((p) => p.id).filter((id) => id !== 'cafe');
    const texts = new Set<string>();
    for (const id of customers) {
      const mine = CAFE_ORDERS.filter((o) => o.placeId === id);
      expect(mine.map((o) => o.id), id).toEqual(Array.from({ length: 10 }, (_, i) => `cf-${id}-${i + 1}`));
      expect(mine.map((o) => o.level), id).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
    }
    expect(CAFE_ORDERS).toHaveLength(customers.length * 10);
    for (const o of CAFE_ORDERS) {
      expect(texts.has(o.text), o.text).toBe(false);
      texts.add(o.text);
      const words = o.text.trim().split(/\s+/).length;
      expect(words, o.text).toBeGreaterThanOrEqual(3);
      expect(words, o.text).toBeLessThanOrEqual(18);
      expect(o.vi.trim(), o.id).not.toBe('');
      const size = basketSize(o.items);
      expect(size, o.id).toBeGreaterThanOrEqual(1);
      expect(size, o.id).toBeLessThanOrEqual(4);
      for (const [item, n] of Object.entries(o.items)) {
        expect((CAFE_ITEMS as readonly string[]).includes(item), `${o.id}: ${item}`).toBe(true);
        expect(n, o.id).toBeGreaterThanOrEqual(1);
        expect(n, o.id).toBeLessThanOrEqual(3);
      }
      if (o.level === 1) expect(size, o.id).toBe(1);
    }
  });
});
