import { Fragment } from 'react';
import { Keyboard } from 'lucide-react';
import { Icon } from './Icon';
import Popover from './Popover';

export interface Shortcut {
  /** Keys pressed together, e.g. ['Shift', 'Enter']. Write a range as one key: '1–4'. */
  keys: string[];
  /** What it does, short Vietnamese. */
  text: string;
}

export interface ShortcutsHelpProps {
  items: readonly Shortcut[];
  /** Optional one-line note under the list (e.g. "Phím số không dùng được khi đang gõ."). */
  note?: string;
}

/**
 * The page's keyboard shortcuts behind one ghost icon button (normally PageHeader `help`). "?" toggles it from
 * anywhere (not while typing). Hidden on touch devices. This is the ONLY place <kbd> is rendered.
 */
export default function ShortcutsHelp({ items, note }: ShortcutsHelpProps) {
  const rows: readonly Shortcut[] = [...items, { keys: ['?'], text: 'Mở / đóng bảng phím tắt' }];
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
      {note && <p className="shortcuts-note">{note}</p>}
    </Popover>
  );
}
