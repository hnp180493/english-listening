// The shared practice shortcuts (owner, 2026-11-24: "nhiều chỗ học/thực hành sao không có phím tắt gì hết vậy,
// ví dụ Ctrl + space thì cho nghe lại"): one set of keys for the actions every practice page repeats (listen again,
// slowly, chunk by chunk, word by word, hint, skip / next), the same on every page, and usable while the cursor is in
// the answer box. Each needs Ctrl / Alt / Cmd (or a free F key), so typing never triggers one; the keys a browser,
// Windows or a Vietnamese input method (Unikey: Ctrl+Shift, Alt+Z) already use are refused when recording.
//
// The keys are DEVICE-LOCAL (KEYS.shortcuts, never synced, never in a backup): a key that suits one machine's keyboard,
// browser and input method (Windows Ctrl, a Mac's Cmd, a laptop without F keys) is wrong on another, and a phone has
// no keyboard at all. Pure parts here (tested); the page glue is `useShortcuts` (src/components/useShortcuts.ts).
//
// Keys are matched by `KeyboardEvent.code` (the physical key), not `key`: on the Windows Vietnamese layout "]" types
// "ơ", and with Shift held "." becomes ">".

import { useSyncExternalStore } from 'react';
import { KEYS, loadJSON, onAppWrite, saveJSON } from './storage';

export type ShortcutAction = 'replay' | 'slow' | 'chunks' | 'careful' | 'hint' | 'skip';

/** The order of the settings list and of the shared rows in ShortcutsHelp. */
export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = ['replay', 'slow', 'chunks', 'careful', 'hint', 'skip'];

/** Vietnamese labels (translated where shown). Plain strings: the language is not known when this module loads. */
export const SHORTCUT_LABELS: Readonly<Record<ShortcutAction, string>> = {
  replay: 'Nghe lại',
  slow: 'Nghe chậm',
  chunks: 'Nghe từng cụm',
  careful: 'Rõ từng từ',
  hint: 'Gợi ý',
  skip: 'Bỏ qua, sang câu tiếp',
};

/** One line under each label in Cài đặt → Phím tắt. */
export const SHORTCUT_HINTS: Readonly<Record<ShortcutAction, string>> = {
  replay: 'Esc cũng được.',
  slow: 'Vẫn nối âm, chỉ chậm hơn.',
  chunks: 'Chép chính tả: từng cụm âm, có ngắt nghỉ.',
  careful: 'Câu viết đọc chậm. Chép chính tả: chỉ sau khi kiểm tra.',
  hint: 'Chép chính tả: hiện chữ cái đầu.',
  skip: 'Trước khi kiểm tra: bỏ qua. Sau đó: sang câu tiếp.',
};

/** A key combination, stored as text: "Ctrl+Shift+Space" (modifiers in this order, then a KeyboardEvent.code). */
export type Combo = string;

export const DEFAULT_SHORTCUTS: Readonly<Record<ShortcutAction, Combo>> = {
  replay: 'Ctrl+Space',
  slow: 'Ctrl+Shift+Space',
  chunks: 'Ctrl+Period',
  careful: 'Ctrl+Comma',
  hint: 'Ctrl+Slash',
  skip: 'Ctrl+BracketRight',
};

/** Keys that also do an action and cannot be changed: Esc also replays (it did before this set existed). */
export const FIXED_ALIASES: Readonly<Partial<Record<ShortcutAction, Combo>>> = { replay: 'Escape' };

const MODS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;
type Mod = (typeof MODS)[number];

export interface KeyLike {
  code: string;
  key?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS|AltGraph|CapsLock|Fn|FnLock|Hyper|Super|NumLock|ScrollLock)(Left|Right)?$/;

/** True for a press of a modifier alone (Ctrl, Shift…): the recorder waits for the key that goes with it. */
export function isModifierOnly(e: Pick<KeyLike, 'code' | 'key'>): boolean {
  return MODIFIER_CODES.test(e.code) || /^(Control|Shift|Alt|Meta|AltGraph|OS)$/.test(e.key ?? '');
}

/** The combo of a key press ("Ctrl+Shift+Space"), or null for a modifier alone / no physical key. */
export function comboOf(e: KeyLike): Combo | null {
  const code = e.code || codeFromKey(e.key);
  if (!code || isModifierOnly({ code, key: e.key })) return null;
  const mods: Mod[] = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey) mods.push('Meta');
  return [...mods, code].join('+');
}

const KEY_CODE: Readonly<Record<string, string>> = {
  ' ': 'Space', '.': 'Period', ',': 'Comma', '/': 'Slash', '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote',
  '[': 'BracketLeft', ']': 'BracketRight', '`': 'Backquote', '-': 'Minus', '=': 'Equal',
  Escape: 'Escape', Esc: 'Escape', Enter: 'Enter', Tab: 'Tab',
};

/** The physical key guessed from `key`, for an event without `code` (some virtual keyboards and remote tools). */
function codeFromKey(key: string | undefined): string {
  if (!key) return '';
  if (KEY_CODE[key]) return KEY_CODE[key];
  if (/^[a-z]$/i.test(key)) return 'Key' + key.toUpperCase();
  if (/^[0-9]$/.test(key)) return 'Digit' + key;
  if (/^(F([1-9]|1[0-9]|2[0-4])|Arrow(Up|Down|Left|Right))$/.test(key)) return key;
  return '';
}

const CODE_RE = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad[0-9A-Za-z]+|Arrow(Up|Down|Left|Right)|[A-Z][A-Za-z]+)$/;

/** A stored combo cleaned up: known modifiers in the canonical order, one key. Null when it is not one. */
export function normalizeCombo(raw: unknown): Combo | null {
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const parts = raw.split('+').filter(Boolean);
  if (parts.length === 0) return null;
  const code = parts[parts.length - 1];
  if (!CODE_RE.test(code) || MODIFIER_CODES.test(code) || (MODS as readonly string[]).includes(code)) return null;
  const mods = new Set(parts.slice(0, -1));
  for (const m of mods) if (!(MODS as readonly string[]).includes(m)) return null;
  return [...MODS.filter((m) => mods.has(m)), code].join('+');
}

function splitCombo(c: Combo): { mods: Set<string>; code: string } {
  const parts = c.split('+');
  return { mods: new Set(parts.slice(0, -1)), code: parts[parts.length - 1] };
}

const CODE_LABEL: Readonly<Record<string, string>> = {
  Space: 'Space',
  Period: '.',
  Comma: ',',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Escape: 'Esc',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  IntlBackslash: '\\',
};

/** True on a Mac (Meta shows as Cmd, Alt as Option). */
export function isMacLike(): boolean {
  try {
    const p = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
    return /mac|iphone|ipad/i.test(p);
  } catch {
    return false;
  }
}

/** The keys of a combo as they are printed on a keyboard: "Ctrl+Period" → ['Ctrl', '.']. */
export function comboKeys(c: Combo, mac = false): string[] {
  const { mods, code } = splitCombo(c);
  const out: string[] = [];
  for (const m of MODS) {
    if (!mods.has(m)) continue;
    out.push(m === 'Meta' ? (mac ? 'Cmd' : 'Win') : m === 'Alt' && mac ? 'Option' : m);
  }
  let k = CODE_LABEL[code];
  if (!k) {
    if (/^Key[A-Z]$/.test(code)) k = code.slice(3);
    else if (/^Digit[0-9]$/.test(code)) k = code.slice(5);
    else if (/^Numpad/.test(code)) k = 'Num ' + code.slice(6);
    else k = code;
  }
  out.push(k);
  return out;
}

/** "Ctrl + Shift + Space": for a button label (never a <kbd>). */
export function comboText(c: Combo, mac = false): string {
  return comboKeys(c, mac).join(' + ');
}

// ───────────────────────── what may be recorded ─────────────────────────

/**
 * Combos the browser, the system or a Vietnamese input method already use (Chrome, Edge, Firefox on Windows; Safari /
 * macOS for Cmd), or that edit the text being typed. Written as combos; checked after normalizing.
 */
const RESERVED: ReadonlySet<string> = new Set(
  [
    // editing the answer
    ...'ACVXZY'.split('').map((l) => `Ctrl+Key${l}`),
    ...['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Home', 'End', 'Insert'].flatMap((k) => [`Ctrl+${k}`, `Ctrl+Shift+${k}`, `Shift+${k}`, k]),
    // browsers (tabs, find, history, downloads, address bar, print, save, reload, zoom…)
    ...'BDEFGHIJKLMNOPQRSTUW'.split('').map((l) => `Ctrl+Key${l}`),
    ...'ABCDEGIJKMNOPQRTWY'.split('').map((l) => `Ctrl+Shift+Key${l}`),
    ...'0123456789'.split('').map((d) => `Ctrl+Digit${d}`),
    'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+PageUp', 'Ctrl+PageDown', 'Ctrl+Minus', 'Ctrl+Equal', 'Ctrl+Shift+Equal', 'Ctrl+Shift+Minus',
    'Ctrl+Shift+Delete', 'Ctrl+F4', 'Ctrl+F5', 'Shift+F5', 'Ctrl+Escape', 'Ctrl+Shift+Escape',
    // Alt: browser menus, back / forward, home, window menu; Unikey's Alt+Z
    ...'DEFZVSBTH'.split('').map((l) => `Alt+Key${l}`),
    'Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+Home', 'Alt+Space', 'Alt+F4', 'Alt+Tab', 'Alt+Escape', 'Alt+Enter',
    // the app's own fixed keys: Enter checks / goes on, Shift+Enter "Không biết", Ctrl+Enter checks a cloze at once
    'Enter', 'Shift+Enter', 'Ctrl+Enter', 'Meta+Enter', 'NumpadEnter', 'Shift+NumpadEnter', 'Ctrl+NumpadEnter',
    'Tab', 'Shift+Tab', 'Space', 'Shift+Space', 'Escape',
    // F keys a browser uses (help, find next, reload, address bar, caret browsing, menu, full screen, dev tools)
    ...['F1', 'F3', 'F5', 'F6', 'F7', 'F10', 'F11', 'F12'].flatMap((k) => [k, `Shift+${k}`]),
    // macOS / Safari (Cmd)
    ...'ACVXZYQWTNHMLRFGSPODEIKJBU'.split('').map((l) => `Meta+Key${l}`),
    ...'0123456789'.split('').map((d) => `Meta+Digit${d}`),
    'Meta+Space', 'Meta+Tab', 'Meta+Comma', 'Meta+Backquote', 'Meta+Minus', 'Meta+Equal', 'Meta+ArrowLeft', 'Meta+ArrowRight',
    'Meta+BracketLeft', 'Meta+BracketRight', 'Meta+Shift+KeyT', 'Meta+Shift+KeyN', 'Meta+Shift+KeyZ',
  ].map((c) => normalizeCombo(c) ?? c),
);

/** F keys free in the common browsers, usable without a modifier. */
const FREE_F = new Set(['F2', 'F4', 'F8', 'F9']);

export type ComboProblem =
  | { kind: 'needs-mod' }
  | { kind: 'reserved' }
  | { kind: 'altgr' }
  | { kind: 'lang-switch' }
  | { kind: 'taken'; by: ShortcutAction };

/**
 * Why a recorded combo cannot be used for `action` (null = fine). `bindings`: what every action has now.
 * - a combo must work while typing, so a plain key needs Ctrl / Alt / Cmd (a free F key aside);
 * - Ctrl+Alt is AltGr on many layouts (it types letters); Alt+Shift switches the Windows input language;
 * - a combo the browser / system / input method or the app's fixed keys use is refused;
 * - a combo another action has is refused (the learner clears that one first).
 */
export function comboProblem(c: Combo, action: ShortcutAction, bindings: Readonly<Record<ShortcutAction, Combo | null>>): ComboProblem | null {
  const n = normalizeCombo(c);
  if (!n) return { kind: 'needs-mod' };
  const { mods, code } = splitCombo(n);
  if (RESERVED.has(n)) return { kind: 'reserved' };
  if (mods.has('Ctrl') && mods.has('Alt')) return { kind: 'altgr' };
  if (mods.has('Alt') && mods.has('Shift') && !mods.has('Ctrl') && !mods.has('Meta')) return { kind: 'lang-switch' };
  const strong = mods.has('Ctrl') || mods.has('Alt') || mods.has('Meta');
  if (!strong && !FREE_F.has(code)) return { kind: 'needs-mod' };
  for (const a of SHORTCUT_ACTIONS) {
    if (a !== action && bindings[a] === n) return { kind: 'taken', by: a };
  }
  for (const [a, alias] of Object.entries(FIXED_ALIASES) as [ShortcutAction, Combo][]) {
    if (a !== action && alias === n) return { kind: 'taken', by: a };
  }
  return null;
}

/** The Vietnamese message for a problem (translated where shown). */
export function problemText(p: ComboProblem): string {
  switch (p.kind) {
    case 'needs-mod':
      return 'Cần giữ thêm Ctrl (hoặc Alt) để phím dùng được cả khi đang gõ.';
    case 'reserved':
      return 'Phím này trình duyệt, Windows hoặc bộ gõ đang dùng. Chọn phím khác.';
    case 'altgr':
      return 'Ctrl + Alt gõ ra chữ trên nhiều bàn phím. Chọn phím khác.';
    case 'lang-switch':
      return 'Alt + Shift là phím đổi ngôn ngữ của Windows. Chọn phím khác.';
    case 'taken':
      return ''; // the page names the action that has it (a sentence with a label in it)
  }
}

// ───────────────────────── stored prefs ─────────────────────────

export interface ShortcutPrefs {
  /** False: the shared practice keys (and Esc) do nothing. Enter, the number and letter keys of each page stay. */
  on: boolean;
  /** Changed keys only; null = no key for that action. Missing = the default. */
  keys: Partial<Record<ShortcutAction, Combo | null>>;
}

export const DEFAULT_PREFS: ShortcutPrefs = { on: true, keys: {} };

/** Anything stored → well-formed prefs (unknown actions, broken combos, a reserved or duplicate combo dropped). */
export function parsePrefs(raw: unknown): ShortcutPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { on: true, keys: {} };
  const r = raw as Record<string, unknown>;
  const keys: ShortcutPrefs['keys'] = {};
  const src = r.keys && typeof r.keys === 'object' && !Array.isArray(r.keys) ? (r.keys as Record<string, unknown>) : {};
  for (const a of SHORTCUT_ACTIONS) {
    if (!(a in src)) continue;
    const v = src[a];
    if (v === null) keys[a] = null;
    else {
      const n = normalizeCombo(v);
      if (n) keys[a] = n;
    }
  }
  // a hand-edited value must not put an action on a refused key, or two changed actions on one key
  const none = Object.fromEntries(SHORTCUT_ACTIONS.map((a) => [a, null])) as Record<ShortcutAction, Combo | null>;
  const out: ShortcutPrefs['keys'] = {};
  const seen = new Set<Combo>();
  for (const a of SHORTCUT_ACTIONS) {
    if (!(a in keys)) continue;
    const c = keys[a];
    if (c == null) out[a] = null;
    else if (comboProblem(c, a, none) == null && !seen.has(c)) {
      out[a] = c;
      seen.add(c);
    }
  }
  return { on: r.on !== false, keys: out };
}

/** Every action's key now (the default unless changed; null = none). */
export function bindingsOf(p: ShortcutPrefs): Record<ShortcutAction, Combo | null> {
  const out = {} as Record<ShortcutAction, Combo | null>;
  for (const a of SHORTCUT_ACTIONS) out[a] = a in p.keys ? (p.keys[a] ?? null) : DEFAULT_SHORTCUTS[a];
  // a default that a changed key took is left without one
  for (const a of SHORTCUT_ACTIONS) {
    if (a in p.keys) continue;
    const c = out[a];
    if (c && SHORTCUT_ACTIONS.some((b) => b !== a && b in p.keys && p.keys[b] === c)) out[a] = null;
  }
  return out;
}

/** The action a key press asks for (null = none of them). Ignores held-down repeats and IME composition. */
export function actionOf(e: KeyLike, p: ShortcutPrefs): ShortcutAction | null {
  if (!p.on || e.repeat || e.isComposing || e.keyCode === 229) return null;
  const c = comboOf(e);
  if (!c) return null;
  const b = bindingsOf(p);
  for (const a of SHORTCUT_ACTIONS) if (b[a] === c) return a;
  for (const [a, alias] of Object.entries(FIXED_ALIASES) as [ShortcutAction, Combo][]) if (alias === c) return a;
  return null;
}

/** Prefs with one action's key set (null = none; undefined = back to the default). */
export function withKey(p: ShortcutPrefs, action: ShortcutAction, c: Combo | null | undefined): ShortcutPrefs {
  const keys = { ...p.keys };
  if (c === undefined || c === DEFAULT_SHORTCUTS[action]) delete keys[action];
  else keys[action] = c;
  return { ...p, keys };
}

// ───────────────────────── store ─────────────────────────

let cache: ShortcutPrefs | null = null;
const listeners = new Set<() => void>();

function read(): ShortcutPrefs {
  if (!cache) cache = parsePrefs(loadJSON<unknown>(KEYS.shortcuts, null));
  return cache;
}

export function getShortcutPrefs(): ShortcutPrefs {
  return read();
}

export function setShortcutPrefs(next: ShortcutPrefs): void {
  cache = parsePrefs(next);
  // a blocked storage keeps the choice for this session (the cache)
  saveJSON(KEYS.shortcuts, cache);
  for (const fn of [...listeners]) fn();
}

let hooked = false;
function subscribe(fn: () => void): () => void {
  if (!hooked) {
    hooked = true;
    // "Xóa dữ liệu" removes the key outside setShortcutPrefs; another tab writes it
    onAppWrite((key) => {
      if (key !== '*' && key !== KEYS.shortcuts) return;
      cache = null;
      for (const l of [...listeners]) l();
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key && !e.key.endsWith(KEYS.shortcuts)) return;
        cache = null;
        for (const l of [...listeners]) l();
      });
    } catch {
      // no window (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useShortcutPrefs(): ShortcutPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
}

/** Forget the cached prefs (tests). */
export function resetShortcutCache(): void {
  cache = null;
}
