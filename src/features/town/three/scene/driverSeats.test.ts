// Every car of Westbay's traffic has exactly one driver, a car keeps its own, no driver is in two cars (./driverSeats.ts;
// QA 2026-11-28, BUG-01: empty cars driving about).
import { describe, expect, it } from 'vitest';
import { westbayNet } from '../../../../core/town/streets';
import { seedTraffic, stepTraffic } from '../../../../core/town/traffic';
import { assignDrivers } from './driverSeats';

function rnd(seed: number) {
  let r = seed % 2147483647 || 7;
  return () => (r = (r * 48271) % 2147483647) / 2147483647;
}

/** Every car of `ids` has a driver, and no two cars the same one. */
function oneEach(ids: readonly number[], seats: ReadonlyMap<number, number>): void {
  const drivers = ids.map((id) => seats.get(id));
  expect(drivers.every((d) => d !== undefined && d >= 0)).toBe(true);
  expect(new Set(drivers).size).toBe(ids.length);
}

describe('who drives which car', () => {
  it('cars whose ids share a remainder by the pool (the old pick) each get their own driver', () => {
    const ids = [3, 19, 35, 51];
    const seats = assignDrivers(ids, new Map());
    oneEach(ids, seats);
  });

  it('a car keeps its driver while it drives on, whoever comes and goes', () => {
    let seats = assignDrivers([0, 1, 2, 3], new Map());
    const two = seats.get(2);
    seats = assignDrivers([2, 5, 6], seats);
    expect(seats.get(2)).toBe(two);
    oneEach([2, 5, 6], seats);
    seats = assignDrivers([7, 2, 8, 9, 10], seats);
    expect(seats.get(2)).toBe(two);
    oneEach([7, 2, 8, 9, 10], seats);
  });

  it("in Westbay's real traffic, at every moment, every car drawn has exactly one driver", () => {
    const net = westbayNet();
    for (let seed = 1; seed <= 12; seed++) {
      const r = rnd(seed * 31 + 5);
      let cars = seedTraffic(net, seed % 4 === 0 ? 16 : 10, seed);
      let seats = new Map<number, number>();
      for (let i = 0; i < 400; i++) {
        cars = stepTraffic(cars, 0.25, { net, nowMs: seed * 1000 + i * 250, bodies: [], rnd: r });
        // (a few cars leave the drawing now and then, as past a cap, and come back)
        const drawn = cars.filter((c) => (i + c.id) % 37 !== 0);
        const before = seats;
        seats = assignDrivers(
          drawn.map((c) => c.id),
          before,
        );
        oneEach(
          drawn.map((c) => c.id),
          seats,
        );
        for (const c of drawn) if (before.has(c.id)) expect(seats.get(c.id)).toBe(before.get(c.id));
      }
    }
  });
});
