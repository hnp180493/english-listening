// Shared by the two conversation panels (Conversation: the quick chat, Episode: "Chuyện ở thị trấn").

/** The camera needs a moment to reach the resident before they speak. */
export const SPEAK_DELAY_MS = 700;

/** A key pressed in a field, a popover or a dialog is not the panel's. */
export function ignoredKeyTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!t.closest('[data-popover], [role="dialog"]');
}
