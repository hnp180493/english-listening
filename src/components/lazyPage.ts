import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * A lazily loaded page (React.lazy) that can recover from a failed chunk download.
 *
 * React.lazy caches a rejected import forever, so a chunk that failed once (offline, or a deploy
 * replaced the hashed file) would fail on every later visit. `renew()` swaps in a fresh lazy
 * component after a failure, so the next render fetches the chunk again.
 *
 * The swap must NOT happen inside the import's own rejection handler: React re-renders the Suspense
 * boundary as soon as the lazy promise settles, and on a first mount that retry renders the page
 * from scratch. A fresh lazy there would suspend again instead of throwing, so an offline visit to a
 * page never opened would loop "Đang tải trang…" forever (one import attempt per retry) and never
 * reach PageBoundary's error card. Call renew() once the error has been shown (PageBoundary's onError).
 *
 * (`any` mirrors React.lazy's own constraint: pages take different props.)
 */
export interface LazyPage<C extends ComponentType<any>> {
  /** The component to render now. Stable until renew() replaces a failed one. */
  current: LazyExoticComponent<C>;
  /** True once the current component's import has rejected. */
  readonly failed: boolean;
  /** Replace the current component if its import failed. Returns true when it did. */
  renew(): boolean;
}

export function lazyPage<C extends ComponentType<any>>(
  load: () => Promise<{ default: C }>,
  makeLazy: (factory: () => Promise<{ default: C }>) => LazyExoticComponent<C> = lazy,
): LazyPage<C> {
  let failed = false;
  const make = () =>
    makeLazy(() =>
      load().catch((err: unknown) => {
        failed = true;
        throw err;
      }),
    );
  const holder: LazyPage<C> = {
    current: make(),
    get failed() {
      return failed;
    },
    renew() {
      if (!failed) return false;
      failed = false;
      holder.current = make();
      return true;
    },
  };
  return holder;
}
