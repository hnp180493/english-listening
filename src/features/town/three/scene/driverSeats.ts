// Who drives which car in Westbay's traffic (./traffic.ts). Pure, tested: every car drawn has exactly one driver of
// the pool, a car keeps the driver it had while it drives on, and no driver sits in two cars (QA 2026-11-28, BUG-01:
// with a driver picked as the car's id modulo the pool, two cars could share one and the second drove empty).

/**
 * The driver (an index into the pool) of each car in `carIds`, given last frame's `prev`: a car keeps its own, the
 * others take the lowest free index. The pool must have at least `1 + max(result)` drivers (the caller grows it).
 */
export function assignDrivers(carIds: readonly number[], prev: ReadonlyMap<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  const used = new Set<number>();
  for (const id of carIds) {
    const d = prev.get(id);
    if (d !== undefined && !used.has(d) && !out.has(id)) {
      out.set(id, d);
      used.add(d);
    }
  }
  let next = 0;
  for (const id of carIds) {
    if (out.has(id)) continue;
    while (used.has(next)) next++;
    out.set(id, next);
    used.add(next);
  }
  return out;
}
