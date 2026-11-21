// Esc and focus for the side / bottom sheets over the stage (the build panel, an activity's panel).
//
// Esc is heard on the window while a sheet is open, not on the sheet: a click on one of its buttons often re-renders
// or removes that button, and the keyboard then falls to the page's body, where a key on the sheet itself would no
// longer reach it. And once focus has fallen out like that it is put back into the sheet.

import { useEffect, useRef, type RefObject } from 'react';

/** Whether an Esc pressed with the keyboard on `target` closes the sheet `box`. */
export function escClosesPanel(target: EventTarget | null, box: HTMLElement | null): boolean {
  if (!box) return false;
  if (!(target instanceof HTMLElement)) return true;
  // typing in a field: Esc belongs to the field (a browser clears it, a combo box closes)
  if (target.isContentEditable) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  // a popover (its own Esc closes it first)
  if (target.closest('[data-popover]')) return false;
  // a dialog of its own inside the sheet (none today) keeps its Esc
  const inner = target.closest('[role="dialog"], dialog');
  if (inner && inner !== box && box.contains(inner)) return false;
  // inside the sheet, or nowhere in particular (the body, the stage)
  if (box.contains(target)) return true;
  // another dialog has the keyboard (the map, the shortcuts list)
  return !target.closest('[role="dialog"], dialog');
}

/**
 * Close the sheet in `box` with Esc wherever the keyboard is (escClosesPanel), and bring the keyboard back into the
 * sheet when a button that had it disappears (focus left to nowhere).
 */
export function usePanelKeys(box: RefObject<HTMLElement | null>, onClose: () => void): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (!escClosesPanel(e.target, box.current)) return;
      e.preventDefault();
      close.current();
    };
    window.addEventListener('keydown', onKey);
    const el = box.current;
    const frame = { id: 0 };
    // after the click's re-render (a removed button fires no blur in every browser): focus on nothing comes back in
    const check = () => {
      cancelAnimationFrame(frame.id);
      frame.id = requestAnimationFrame(() => {
        const now = box.current;
        if (!now || !now.isConnected) return;
        const a = document.activeElement;
        if (a && a !== document.body && a !== document.documentElement) return;
        now.focus({ preventScroll: true });
      });
    };
    const onOut = (e: FocusEvent) => {
      // focus went somewhere real (another control, the stage): fine
      if (!e.relatedTarget) check();
    };
    el?.addEventListener('focusout', onOut);
    el?.addEventListener('click', check);
    return () => {
      window.removeEventListener('keydown', onKey);
      el?.removeEventListener('focusout', onOut);
      el?.removeEventListener('click', check);
      cancelAnimationFrame(frame.id);
    };
  }, [box]);
}
