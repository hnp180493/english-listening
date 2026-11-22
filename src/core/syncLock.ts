// One queue for sync cycles. A cycle reads this browser's data, merges and writes it back; two cycles interleaving
// (a write-triggered flush and a focus check, say) would let the later write drop what the earlier one applied.
// Within one tab every cycle runs through here, one at a time. (It also served the folder sync, retired 2026-11-22.)

let queue: Promise<unknown> = Promise.resolve();

/** Run `fn` after every cycle queued before it has settled (a failed one included). */
export function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p;
}

/** Resolves once everything queued so far has settled (never rejects). */
export function syncIdle(): Promise<void> {
  return queue.then(
    () => undefined,
    () => undefined,
  );
}
