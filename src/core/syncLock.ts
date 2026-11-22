// One queue for every sync channel (folder sync, Supabase account sync). A cycle reads this browser's data, merges
// and writes it back; two cycles of different channels interleaving would let the later write drop what the earlier
// one applied. Within one tab every cycle runs through here, one at a time.

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
