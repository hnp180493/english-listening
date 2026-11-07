/** Minimal DOM shape used by the shell's focus logic (keeps it testable without a DOM). */
export interface FocusNode {
  isConnected?: boolean;
  contains?(other: FocusNode | null): boolean;
}

/**
 * After a route change, should the shell move focus to the page heading?
 * - Route id changed: yes, unless the new page already put focus on something inside <main>
 *   (an answer input, a first option, its own heading). The old page is unmounted on an id
 *   change, so anything focused inside <main> belongs to the new page.
 * - Only params changed: only when focus was lost (the focused element was removed and focus
 *   fell back to <body>), so a page that moved focus itself keeps it.
 */
export function shouldFocusHeading(
  idChanged: boolean,
  active: FocusNode | null,
  main: FocusNode | null,
  body: FocusNode | null,
): boolean {
  if (!main) return false;
  const lost = !active || active === body || active.isConnected === false;
  if (idChanged) {
    if (lost) return true;
    return !(active !== main && main.contains?.(active));
  }
  return lost;
}

/** Move focus to the page's <h1> (or <main> when it has none) so screen readers announce it, without scrolling. */
export function focusPageHeading(main: HTMLElement | null): void {
  if (!main) return;
  const heading = main.querySelector<HTMLElement>('h1') ?? main;
  if (heading !== main && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}
