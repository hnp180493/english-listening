import { useEffect, useRef } from 'react';

/**
 * Page-level keyboard shortcuts. The handler returns true when it used the key
 * (the event is then prevented). Keys typed into form fields, keys with
 * modifiers, Enter on buttons/links (they activate natively) and keys inside
 * the app navigation are ignored.
 */
export function useKeyboard(handler: (e: KeyboardEvent) => boolean | void): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t) {
        if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        if (e.key === 'Enter' && /^(BUTTON|A|SUMMARY)$/.test(t.tagName)) return;
        if (t.closest('nav, [data-popover], [role="dialog"]')) return;
      }
      if (ref.current(e) === true) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
