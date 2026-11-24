import { Fragment } from 'react';
import { Keyboard } from 'lucide-react';
import { Icon } from './Icon';
import Popover from './Popover';
import { FIXED_ALIASES, SHORTCUT_LABELS, comboKeys, useShortcutPrefs, type ShortcutAction } from '../core/shortcuts';
import { useShortcutKeys } from './useShortcuts';

export interface Shortcut {
  /** Keys pressed together, e.g. ['Shift', 'Enter']. Write a range as one key: '1–4'. */
  keys: string[];
  /** What it does, short Vietnamese. */
  text: string;
}

export interface ShortcutsHelpProps {
  /**
   * The shared practice keys this page answers (core/shortcuts.ts), listed first with the keys set in Cài đặt →
   * Phím tắt on this browser. They work while typing.
   */
  shared?: readonly ShortcutAction[];
  /** The page's own keys (Enter, numbers, letters). */
  items?: readonly Shortcut[];
  /** Optional one-line note under the list (e.g. "Phím số không dùng được khi đang gõ."). */
  note?: string;
}

/**
 * The page's keyboard shortcuts behind one ghost icon button (normally PageHeader `help`). "?" toggles it from
 * anywhere (not while typing). Hidden on touch devices. This is the ONLY place <kbd> is rendered.
 */
export default function ShortcutsHelp({ shared = [], items = [], note }: ShortcutsHelpProps) {
  const prefs = useShortcutPrefs();
  const keysOf = useShortcutKeys();
  const sharedRows: Shortcut[] = [];
  for (const a of shared) {
    const k = keysOf(a);
    if (k) sharedRows.push({ keys: k, text: SHORTCUT_LABELS[a] });
    const alias = FIXED_ALIASES[a];
    if (alias && prefs.on) sharedRows.push({ keys: comboKeys(alias), text: SHORTCUT_LABELS[a] });
  }
  const rows: readonly Shortcut[] = [...sharedRows, ...items, { keys: ['?'], text: 'Mở / đóng bảng phím tắt' }];
  return (
    <Popover
      className="shortcuts-help"
      triggerClassName="btn btn-ghost btn-icon"
      trigger={<Icon icon={Keyboard} size={18} />}
      triggerLabel="Phím tắt"
      triggerTitle="Phím tắt (?)"
      title="Phím tắt"
      hotkey="?"
    >
      <dl className="shortcuts-list">
        {rows.map((s) => (
          <div key={s.keys.join('+') + s.text} className="shortcuts-row">
            <dt>
              {s.keys.map((k, i) => (
                <Fragment key={k + i}>
                  {i > 0 && <span className="shortcuts-plus">+</span>}
                  <kbd>{k}</kbd>
                </Fragment>
              ))}
            </dt>
            <dd>{s.text}</dd>
          </div>
        ))}
      </dl>
      {(note || shared.length > 0) && (
        <p className="shortcuts-note">
          {note}
          {note && shared.length > 0 && ' '}
          {shared.length > 0 && (
            <>
              {prefs.on ? 'Phím có Ctrl hoặc Esc dùng được cả khi đang gõ.' : 'Bộ phím chung đang tắt.'}{' '}
              <a href="#/settings?section=keys">Đổi phím</a>
            </>
          )}
        </p>
      )}
    </Popover>
  );
}
