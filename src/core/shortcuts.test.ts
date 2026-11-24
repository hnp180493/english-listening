import { describe, expect, it } from 'vitest';
import {
  actionOf,
  bindingsOf,
  comboKeys,
  comboOf,
  comboProblem,
  comboText,
  DEFAULT_PREFS,
  DEFAULT_SHORTCUTS,
  isModifierOnly,
  normalizeCombo,
  parsePrefs,
  SHORTCUT_ACTIONS,
  withKey,
  type KeyLike,
} from './shortcuts';
import { DEVICE_LOCAL_KEYS, KEYS } from './storage';
import { dispatchKey, type Registration, type TargetInfo } from '../components/useShortcuts';

function key(code: string, mods: Partial<Pick<KeyLike, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>> = {}, extra: Partial<KeyLike> = {}): KeyLike {
  return { code, key: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods, ...extra };
}

const defaults = bindingsOf(DEFAULT_PREFS);

describe('shortcuts: combos', () => {
  it('reads a key press as modifiers in a fixed order and the physical key', () => {
    expect(comboOf(key('Space', { ctrlKey: true }))).toBe('Ctrl+Space');
    expect(comboOf(key('Space', { shiftKey: true, ctrlKey: true }))).toBe('Ctrl+Shift+Space');
    expect(comboOf(key('Period', { metaKey: true, altKey: true }))).toBe('Alt+Meta+Period');
    expect(comboOf(key('ControlLeft', { ctrlKey: true }, { key: 'Control' }))).toBeNull();
    expect(comboOf(key('', { ctrlKey: true }))).toBeNull();
    // no `code` (a virtual keyboard, a remote tool): guessed from `key`
    expect(comboOf(key('', { ctrlKey: true }, { key: ']' }))).toBe('Ctrl+BracketRight');
    expect(comboOf(key('', { altKey: true }, { key: 'r' }))).toBe('Alt+KeyR');
    expect(comboOf(key('', { ctrlKey: true }, { key: 'ơ' }))).toBeNull();
    expect(isModifierOnly({ code: 'ShiftRight', key: 'Shift' })).toBe(true);
  });

  it('normalizes stored text and refuses junk', () => {
    expect(normalizeCombo('Shift+Ctrl+Space')).toBe('Ctrl+Shift+Space');
    expect(normalizeCombo('Ctrl+Ctrl+KeyK')).toBe('Ctrl+KeyK');
    expect(normalizeCombo('Hyper+Space')).toBeNull();
    expect(normalizeCombo('Ctrl+')).toBeNull();
    expect(normalizeCombo('Ctrl+ShiftLeft')).toBeNull();
    expect(normalizeCombo(42)).toBeNull();
    expect(normalizeCombo('Ctrl+' + 'x'.repeat(60))).toBeNull();
  });

  it('prints keys as they are on the keyboard', () => {
    expect(comboKeys('Ctrl+Period')).toEqual(['Ctrl', '.']);
    expect(comboKeys('Ctrl+Shift+Space')).toEqual(['Ctrl', 'Shift', 'Space']);
    expect(comboKeys('Meta+KeyB', true)).toEqual(['Cmd', 'B']);
    expect(comboKeys('Alt+Digit7', true)).toEqual(['Option', '7']);
    expect(comboKeys('Escape')).toEqual(['Esc']);
    expect(comboText('Ctrl+BracketRight')).toBe('Ctrl + ]');
  });
});

describe('shortcuts: what may be recorded', () => {
  it('accepts every default', () => {
    for (const a of SHORTCUT_ACTIONS) expect(comboProblem(DEFAULT_SHORTCUTS[a], a, defaults), a).toBeNull();
  });

  it('needs Ctrl / Alt / Cmd so typing never fires one (free F keys aside)', () => {
    expect(comboProblem('KeyR', 'replay', defaults)).toEqual({ kind: 'needs-mod' });
    expect(comboProblem('Shift+KeyR', 'replay', defaults)).toEqual({ kind: 'needs-mod' });
    expect(comboProblem('F9', 'replay', defaults)).toBeNull();
    expect(comboProblem('F5', 'replay', defaults)).toEqual({ kind: 'reserved' });
  });

  it('refuses browser, editing, system and input-method keys', () => {
    for (const c of ['Ctrl+KeyT', 'Ctrl+KeyW', 'Ctrl+KeyC', 'Ctrl+KeyH', 'Ctrl+Digit1', 'Ctrl+ArrowLeft', 'Ctrl+Shift+KeyT', 'Alt+KeyZ', 'Alt+ArrowLeft', 'Meta+KeyQ', 'Meta+Space', 'Ctrl+Enter', 'Enter', 'Shift+Enter', 'Escape'])
      expect(comboProblem(c, 'replay', defaults), c).toEqual({ kind: 'reserved' });
    expect(comboProblem('Ctrl+Alt+KeyQ', 'replay', defaults)).toEqual({ kind: 'altgr' });
    expect(comboProblem('Alt+Shift+KeyQ', 'replay', defaults)).toEqual({ kind: 'lang-switch' });
  });

  it('refuses a key another action has, but not the action\'s own', () => {
    expect(comboProblem('Ctrl+Shift+Space', 'replay', defaults)).toEqual({ kind: 'taken', by: 'slow' });
    expect(comboProblem('Ctrl+Space', 'replay', defaults)).toBeNull();
    expect(comboProblem('Alt+KeyR', 'replay', defaults)).toBeNull();
  });
});

describe('shortcuts: prefs', () => {
  it('reads anything stored as well-formed prefs', () => {
    expect(parsePrefs(null)).toEqual({ on: true, keys: {} });
    expect(parsePrefs([1])).toEqual({ on: true, keys: {} });
    expect(parsePrefs({ on: false })).toEqual({ on: false, keys: {} });
    expect(parsePrefs({ on: 'no', keys: { replay: 'Alt+KeyR', bogus: 'Ctrl+KeyK', slow: null, hint: 'Ctrl+KeyT', chunks: 7 } })).toEqual({
      on: true,
      keys: { replay: 'Alt+KeyR', slow: null },
    });
    // two changed actions on one key: the first keeps it
    expect(parsePrefs({ keys: { replay: 'Alt+KeyR', slow: 'Alt+KeyR' } }).keys).toEqual({ replay: 'Alt+KeyR' });
    // idempotent
    const p = parsePrefs({ keys: { replay: 'Shift+Ctrl+KeyB', careful: null } });
    expect(parsePrefs(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('a changed key takes a default from the action that had it', () => {
    const p = withKey(DEFAULT_PREFS, 'replay', 'Ctrl+Period');
    const b = bindingsOf(p);
    expect(b.replay).toBe('Ctrl+Period');
    expect(b.chunks).toBeNull();
    expect(withKey(p, 'replay', undefined).keys).toEqual({});
    expect(withKey(DEFAULT_PREFS, 'hint', DEFAULT_SHORTCUTS.hint).keys).toEqual({});
    expect(bindingsOf(withKey(DEFAULT_PREFS, 'hint', null)).hint).toBeNull();
  });

  it('is device-local: never synced or backed up', () => {
    expect(KEYS.shortcuts).toBe('shortcuts');
    expect(DEVICE_LOCAL_KEYS.has(KEYS.shortcuts)).toBe(true);
  });
});

describe('shortcuts: key press → action', () => {
  it('maps the defaults and the fixed Esc', () => {
    expect(actionOf(key('Space', { ctrlKey: true }), DEFAULT_PREFS)).toBe('replay');
    expect(actionOf(key('Space', { ctrlKey: true, shiftKey: true }), DEFAULT_PREFS)).toBe('slow');
    expect(actionOf(key('Period', { ctrlKey: true }, { key: 'ơ' }), DEFAULT_PREFS)).toBe('chunks');
    expect(actionOf(key('Slash', { ctrlKey: true }), DEFAULT_PREFS)).toBe('hint');
    expect(actionOf(key('BracketRight', { ctrlKey: true }), DEFAULT_PREFS)).toBe('skip');
    expect(actionOf(key('Comma', { ctrlKey: true }), DEFAULT_PREFS)).toBe('careful');
    expect(actionOf(key('Escape'), DEFAULT_PREFS)).toBe('replay');
    expect(actionOf(key('Space'), DEFAULT_PREFS)).toBeNull();
    expect(actionOf(key('KeyR'), DEFAULT_PREFS)).toBeNull();
  });

  it('ignores repeats, IME composition and everything when turned off', () => {
    expect(actionOf(key('Space', { ctrlKey: true }, { repeat: true }), DEFAULT_PREFS)).toBeNull();
    expect(actionOf(key('Space', { ctrlKey: true }, { isComposing: true }), DEFAULT_PREFS)).toBeNull();
    expect(actionOf(key('Space', { ctrlKey: true }, { keyCode: 229 }), DEFAULT_PREFS)).toBeNull();
    const off = { ...DEFAULT_PREFS, on: false };
    expect(actionOf(key('Space', { ctrlKey: true }), off)).toBeNull();
    expect(actionOf(key('Escape'), off)).toBeNull();
  });

  it('follows a changed key', () => {
    const p = withKey(DEFAULT_PREFS, 'replay', 'Alt+KeyR');
    expect(actionOf(key('KeyR', { altKey: true }), p)).toBe('replay');
    expect(actionOf(key('Space', { ctrlKey: true }), p)).toBeNull();
    expect(actionOf(key('Escape'), p)).toBe('replay');
  });
});

describe('shortcuts: dispatch', () => {
  const root = {} as Element;
  const outside: TargetInfo = { excluded: false, field: false, inside: () => false };
  const ownField: TargetInfo = { excluded: false, field: true, inside: (r) => r === root };
  const otherField: TargetInfo = { excluded: false, field: true, inside: () => false };
  let id = 0;
  function reg(handlers: Registration['handlers'] extends () => infer H ? H : never, o: Partial<Registration> = {}): Registration {
    return { id: ++id, priority: 0, handlers: () => handlers, ...o };
  }

  it('works while typing in any field with Ctrl, and Esc only in the page\'s own field', () => {
    const calls: string[] = [];
    const r = reg({ replay: () => void calls.push('replay') }, { root: () => root });
    expect(dispatchKey(key('Space', { ctrlKey: true }), [r], otherField, DEFAULT_PREFS)).toBe('replay');
    expect(dispatchKey(key('Escape'), [r], ownField, DEFAULT_PREFS)).toBe('replay');
    expect(dispatchKey(key('Escape'), [r], otherField, DEFAULT_PREFS)).toBeNull();
    expect(dispatchKey(key('Escape'), [r], outside, DEFAULT_PREFS)).toBe('replay');
    expect(calls).toHaveLength(3);
  });

  it('never acts in popovers / dialogs or on a key already handled', () => {
    const r = reg({ replay: () => {} });
    expect(dispatchKey(key('Space', { ctrlKey: true }), [r], { ...outside, excluded: true }, DEFAULT_PREFS)).toBeNull();
    expect(dispatchKey({ ...key('Space', { ctrlKey: true }), defaultPrevented: true }, [r], outside, DEFAULT_PREFS)).toBeNull();
  });

  it('asks the higher priority first, then the newest, and passes a key on when a handler returns false', () => {
    const calls: string[] = [];
    const player = reg({ replay: () => void calls.push('player'), skip: () => void calls.push('player-skip') });
    const panel = reg({ replay: () => void calls.push('panel'), skip: () => false }, { priority: 1 });
    const later = reg({ hint: () => void calls.push('later') });
    const regs = [panel, player, later];
    expect(dispatchKey(key('Space', { ctrlKey: true }), regs, outside, DEFAULT_PREFS)).toBe('replay');
    expect(dispatchKey(key('BracketRight', { ctrlKey: true }), regs, outside, DEFAULT_PREFS)).toBe('skip');
    expect(dispatchKey(key('Comma', { ctrlKey: true }), regs, outside, DEFAULT_PREFS)).toBeNull();
    expect(calls).toEqual(['panel', 'player-skip']);
  });
});
