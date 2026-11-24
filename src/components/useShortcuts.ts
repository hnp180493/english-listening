// Page glue for the shared practice shortcuts (core/shortcuts.ts). A page (or an exercise) registers what each
// action does on it; one window listener turns a key press into an action and gives it to the registration that
// wants it. The combos carry Ctrl / Alt / Cmd, so they work while the cursor is in the answer box; the fixed Esc
// (= "Nghe lại") works in a text field only when the field belongs to the registration (`root`).
//
// Several registrations can be mounted at once (a video's player and its dictation panel): the higher `priority`
// asks first, then the one mounted last. A handler that returns `false` passes the key on (nothing to do now).

import { useEffect, useRef, type RefObject } from 'react';
import { actionOf, bindingsOf, comboKeys, FIXED_ALIASES, getShortcutPrefs, isMacLike, useShortcutPrefs, type Combo, type KeyLike, type ShortcutAction } from '../core/shortcuts';

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => boolean | void>>;

export interface Registration {
  id: number;
  priority: number;
  handlers: () => ShortcutHandlers;
  /** The registration's own area: a text field inside it may receive the plain Esc. */
  root?: () => Element | null;
}

/** Where a key press came from, as far as the dispatcher cares. */
export interface TargetInfo {
  /** Inside a popover, a dialog or an area marked `data-no-shortcuts` (the key recorder): never handled. */
  excluded: boolean;
  /** A text field, select or editable element. */
  field: boolean;
  /** Is the target inside this element? */
  inside: (root: Element | null) => boolean;
}

/** True when the combo has Ctrl, Alt or Cmd (it cannot type a character into a field). */
function strong(e: KeyLike): boolean {
  return e.ctrlKey || e.altKey || e.metaKey;
}

/**
 * The registration that takes a key press, and its handler's verdict. Pure (tested): `regs` in mount order.
 * Returns the action handled, or null when nothing took it.
 */
export function dispatchKey(e: KeyLike & { defaultPrevented?: boolean }, regs: readonly Registration[], target: TargetInfo, prefs = getShortcutPrefs()): ShortcutAction | null {
  if (e.defaultPrevented || target.excluded) return null;
  const action = actionOf(e, prefs);
  if (!action) return null;
  const order = [...regs].sort((a, b) => b.priority - a.priority || b.id - a.id);
  for (const r of order) {
    const fn = r.handlers()[action];
    if (!fn) continue;
    // a plain key (the fixed Esc, a free F key) in a text field belongs to that field unless it is the page's own
    if (!strong(e) && target.field && !target.inside(r.root?.() ?? null)) continue;
    if (fn() !== false) return action;
  }
  return null;
}

function targetInfo(t: EventTarget | null): TargetInfo {
  const el = t instanceof Element ? t : null;
  const field =
    !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLElement && el.isContentEditable));
  const excluded = !!el?.closest('[data-popover], [role="dialog"], [role="alertdialog"], [data-no-shortcuts], .app-settings, .dict-mgr');
  return { excluded, field, inside: (root) => !!el && !!root && root.contains(el) };
}

let nextId = 1;
const regs: Registration[] = [];

function onKeyDown(e: KeyboardEvent) {
  if (dispatchKey(e, regs, targetInfo(e.target))) e.preventDefault();
}

function add(r: Registration): () => void {
  regs.push(r);
  if (regs.length === 1) window.addEventListener('keydown', onKeyDown);
  return () => {
    const i = regs.indexOf(r);
    if (i >= 0) regs.splice(i, 1);
    if (regs.length === 0) window.removeEventListener('keydown', onKeyDown);
  };
}

/**
 * Give the shared practice keys their meaning on this component, while it is mounted. `handlers` may change every
 * render (the latest is used); a handler returns `false` when it has nothing to do now (the key then goes on).
 */
export function useShortcuts(
  handlers: ShortcutHandlers,
  opts: { root?: RefObject<Element | null>; priority?: number; enabled?: boolean } = {},
): void {
  const ref = useRef(handlers);
  const enabled = opts.enabled ?? true;
  const enabledRef = useRef(enabled);
  useEffect(() => {
    ref.current = handlers;
    enabledRef.current = enabled;
  });
  const { root, priority = 0 } = opts;
  useEffect(
    () =>
      add({
        id: nextId++,
        priority,
        handlers: () => (enabledRef.current ? ref.current : {}),
        root: root ? () => root.current : undefined,
      }),
    [root, priority],
  );
}

const ARIA_KEY: Readonly<Record<string, string>> = { Ctrl: 'Control', Cmd: 'Meta', Win: 'Meta', Option: 'Alt', Esc: 'Escape', '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight' };

function ariaOf(c: Combo): string {
  return comboKeys(c)
    .map((k) => ARIA_KEY[k] ?? k)
    .join('+');
}

/** `aria-keyshortcuts` for a control that does `action` (its current key and the fixed alias); undefined when off. */
export function useShortcutAria(action: ShortcutAction): string | undefined {
  const prefs = useShortcutPrefs();
  if (!prefs.on) return undefined;
  const list = [bindingsOf(prefs)[action], FIXED_ALIASES[action]].filter((c): c is Combo => !!c);
  return list.length ? list.map(ariaOf).join(' ') : undefined;
}

/** The keys of an action now, as printed (ShortcutsHelp); null when it has none or the keys are off. */
export function useShortcutKeys(): (action: ShortcutAction) => string[] | null {
  const prefs = useShortcutPrefs();
  const mac = isMacLike();
  const b = bindingsOf(prefs);
  return (action) => (prefs.on && b[action] ? comboKeys(b[action], mac) : null);
}
