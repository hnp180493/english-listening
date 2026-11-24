import { describe, expect, it } from 'vitest';
import { RESIDENT_ARCS } from '../../data/stories';
import { TOWN_PLACES } from '../../data/town';
import { DELIVERIES } from '../../data/townDeliveries';
import { CAFE_ITEMS } from './cafeTypes';
import { deliveriesLeft, DELIVERY_DAY, DELIVERY_PER_SHIFT, deliveryLevel, deliveryXu, pickDelivery } from './delivery';

describe('the café makes the deliveries', () => {
  it('two a shift, four a day, less what was carried', () => {
    expect(deliveriesLeft(0, 0)).toBe(0);
    expect(deliveriesLeft(1, 0)).toBe(DELIVERY_PER_SHIFT);
    expect(deliveriesLeft(1, 1)).toBe(1);
    expect(deliveriesLeft(5, 0)).toBe(DELIVERY_DAY);
    expect(deliveriesLeft(5, 9)).toBe(0);
  });

  it('the better you know them, the less Emma spells out', () => {
    expect(deliveryLevel(0)).toBe(1);
    expect(deliveryLevel(1)).toBe(2);
    expect(deliveryLevel(2)).toBe(2);
    expect(deliveryLevel(3)).toBe(3);
    const stranger = pickDelivery(DELIVERIES, () => false, () => 0, 7)!;
    expect(stranger.level).toBe(1);
    const friend = pickDelivery(DELIVERIES, () => false, () => 5, 7)!;
    expect(friend.level).toBe(3);
    expect(friend.to).toBe(stranger.to);
  });

  it('nobody gets two in a day; nothing is left when everybody had one', () => {
    const first = pickDelivery(DELIVERIES, () => false, () => 0, 3)!;
    const second = pickDelivery(DELIVERIES, (id) => id === first.to, () => 0, 3)!;
    expect(second.to).not.toBe(first.to);
    expect(pickDelivery(DELIVERIES, () => true, () => 0, 3)).toBeNull();
  });

  it('pays more when Emma was heard once and nobody else was tried', () => {
    expect(deliveryXu(1, 0)).toBeGreaterThan(deliveryXu(2, 0));
    expect(deliveryXu(1, 1)).toBe(deliveryXu(3, 1));
  });
});

describe('the orders (data/townDeliveries)', () => {
  it('four for each of the twelve: named, by their job, and twice by what you know of them', () => {
    const people = TOWN_PLACES.filter((p) => p.id !== 'cafe');
    expect(DELIVERIES).toHaveLength(people.length * 4);
    const texts = new Set<string>();
    for (const p of people) {
      const mine = DELIVERIES.filter((o) => o.to === p.id);
      expect(mine.map((o) => o.id), p.id).toEqual([1, 2, 3, 4].map((n) => `dl-${p.id}-${n}`));
      expect(mine.map((o) => o.level), p.id).toEqual([1, 2, 3, 3]);
      // named only when Emma names them
      expect(mine[0].text, mine[0].id).toContain(p.resident);
      for (const o of mine.slice(1)) expect(new RegExp(`\\b${p.resident}\\b`).test(o.text), o.id).toBe(false);
      // they have something to say when it arrives
      expect(RESIDENT_ARCS.find((a) => a.placeId === p.id)?.reactions.likes.text.trim(), p.id).toBeTruthy();
    }
    for (const o of DELIVERIES) {
      expect(texts.has(o.text), o.text).toBe(false);
      texts.add(o.text);
      expect((CAFE_ITEMS as readonly string[]).includes(o.item), o.id).toBe(true);
      const words = o.text.trim().split(/\s+/).length;
      expect(words, o.text).toBeGreaterThanOrEqual(6);
      expect(words, o.text).toBeLessThanOrEqual(24);
      expect(o.vi.trim(), o.id).not.toBe('');
    }
  });
});
