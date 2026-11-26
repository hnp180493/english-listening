import { describe, expect, it } from 'vitest';
import { TAXI_FARES } from '../../data/city/taxiFares';
import { CITY_PLACE_IDS } from '../../data/cityWorld';
import { pickFare, rideSeconds, TAXI_FIRST_XU, TAXI_LATE_XU, TAXI_PAID_A_DAY, TAXI_XU, taxiOptions, taxiPay } from './taxi';

describe("Rico's taxi: the fares", () => {
  const places = new Set<string>(CITY_PLACE_IDS);
  it('ids are stable and unique; every place is a Westbay place, never Rico, three different ones offered', () => {
    expect(new Set(TAXI_FARES.map((f) => f.id)).size).toBe(TAXI_FARES.length);
    for (const f of TAXI_FARES) {
      expect(f.id).toMatch(/^tx-\d+$/);
      for (const id of [f.to, ...f.near]) {
        expect(places.has(id), `${f.id} ${id}`).toBe(true);
        expect(id).not.toBe('rico');
      }
      expect(new Set([f.to, ...f.near]).size).toBe(3);
    }
  });

  it('everyday lines of 6 to 24 words, a Vietnamese meaning, every level', () => {
    for (const f of TAXI_FARES) {
      const words = f.text.split(/\s+/).length;
      expect(words, f.id).toBeGreaterThanOrEqual(6);
      expect(words, f.id).toBeLessThanOrEqual(24);
      expect(f.vi.trim().length).toBeGreaterThan(5);
    }
    expect(new Set(TAXI_FARES.map((f) => f.level))).toEqual(new Set([1, 2, 3]));
    // more than a day's paid rides, so a day never repeats one
    expect(TAXI_FARES.length).toBeGreaterThan(TAXI_PAID_A_DAY * 2);
  });
});

describe("Rico's taxi: the rules", () => {
  const fare = TAXI_FARES[0];
  it('the right place is offered in every position over the seeds', () => {
    const at = new Set([0, 1, 2].map((s) => taxiOptions(fare, s).indexOf(fare.to)));
    expect(at).toEqual(new Set([0, 1, 2]));
    expect(new Set(taxiOptions(fare, 5))).toEqual(new Set([fare.to, ...fare.near]));
  });

  it('the clock: half a second a tile and a little to set off, within limits', () => {
    expect(rideSeconds(0)).toBe(20);
    expect(rideSeconds(40)).toBe(35);
    expect(rideSeconds(500)).toBe(70);
  });

  it('pays on time, a little late, nothing for the wrong place, within the day', () => {
    const none = new Set<string>();
    expect(taxiPay(fare, true, false, 1, none)).toEqual({ xu: TAXI_XU + TAXI_FIRST_XU, capped: false });
    expect(taxiPay(fare, true, false, 2, none)).toEqual({ xu: TAXI_XU, capped: false });
    expect(taxiPay(fare, true, true, 1, none)).toEqual({ xu: TAXI_LATE_XU, capped: false });
    expect(taxiPay(fare, false, false, 1, none)).toEqual({ xu: 0, capped: false });
    expect(taxiPay(fare, true, false, 1, new Set([fare.id]))).toMatchObject({ xu: 0, capped: true });
    const full = new Set(TAXI_FARES.slice(1, 1 + TAXI_PAID_A_DAY).map((f) => f.id));
    expect(taxiPay(fare, true, false, 1, full)).toMatchObject({ xu: 0, capped: true });
    // other ids of the same daily set (the scenes heard) do not count
    expect(taxiPay(fare, true, false, 1, new Set(['oh-1', 'fm-2']))).toMatchObject({ capped: false });
  });

  it('the next fare: one not paid today, never the same twice in a row', () => {
    const paid = new Set(TAXI_FARES.slice(0, -2).map((f) => f.id));
    const a = pickFare(TAXI_FARES, paid, null, 3)!;
    expect(paid.has(a.id)).toBe(false);
    const b = pickFare(TAXI_FARES, paid, a.id, 3)!;
    expect(b.id).not.toBe(a.id);
    const all = new Set(TAXI_FARES.map((f) => f.id));
    expect(pickFare(TAXI_FARES, all, 'tx-1', 0)!.id).not.toBe('tx-1');
  });
});
