import { useId, useState, type KeyboardEvent } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import {
  bindingsOf,
  comboOf,
  comboProblem,
  comboText,
  DEFAULT_SHORTCUTS,
  isMacLike,
  problemText,
  SHORTCUT_ACTIONS,
  SHORTCUT_HINTS,
  SHORTCUT_LABELS,
  setShortcutPrefs,
  useShortcutPrefs,
  withKey,
  type ShortcutAction,
} from '../../core/shortcuts';
import SectionHead from './SectionHead';
import { tl } from '../../i18n';

export const KEYS_SECTION_ID = 'set-keys';

/**
 * Cài đặt → Phím tắt: the shared practice keys of this browser (core/shortcuts.ts, device-local). A key button
 * records the next combo pressed on it (Esc cancels); a refused combo says why. Keys are labels on buttons here,
 * never <kbd> (that stays in ShortcutsHelp).
 */
export default function KeysSection() {
  const uid = useId();
  const prefs = useShortcutPrefs();
  const bindings = bindingsOf(prefs);
  const mac = isMacLike();
  const [recordingState, setRecording] = useState<ShortcutAction | null>(null);
  // turning the keys off ends a recording
  const recording = prefs.on ? recordingState : null;
  const [error, setError] = useState<{ action: ShortcutAction; text: string } | null>(null);
  const changed = Object.keys(prefs.keys).length > 0;

  const onRecordKey = (e: KeyboardEvent<HTMLButtonElement>, action: ShortcutAction) => {
    if (recording !== action) return;
    if (e.key === 'Tab') {
      setRecording(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || e.nativeEvent.isComposing) return;
    const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
    if (plain && e.code === 'Escape') {
      setRecording(null);
      setError(null);
      return;
    }
    const c = comboOf(e.nativeEvent);
    if (!c) return; // a modifier alone: wait for the key that goes with it
    const p = comboProblem(c, action, bindings);
    if (p) {
      setError({
        action,
        text: p.kind === 'taken' ? tl`${comboText(c, mac)} đang dùng cho “${SHORTCUT_LABELS[p.by]}”. Đổi hoặc bỏ phím đó trước.` : problemText(p),
      });
      return;
    }
    setShortcutPrefs(withKey(prefs, action, c));
    setRecording(null);
    setError(null);
  };

  return (
    <section className="card set-section set-keys-section" id={KEYS_SECTION_ID} aria-labelledby={`${uid}-h`} data-no-shortcuts="">
      <SectionHead id={`${uid}-h`} title="Phím tắt" sub="Một bộ phím cho mọi trang luyện, dùng được cả khi đang gõ. Chỉ lưu trên máy này." />

      <label className="set-row set-switch-row">
        <span className="set-row-text">
          <span className="set-label">Dùng phím tắt khi luyện</span>
          <span className="set-hint">Tắt thì Enter, phím số và phím chữ của từng trang vẫn dùng được.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="set-switch-input"
          checked={prefs.on}
          onChange={(e) => setShortcutPrefs({ ...prefs, on: e.target.checked })}
        />
        <span className="set-switch" aria-hidden="true" />
      </label>

      {prefs.on && (
        <>
          <ul className="set-keys" aria-label="Phím tắt">
            {SHORTCUT_ACTIONS.map((a) => {
              const c = bindings[a];
              const rec = recording === a;
              const own = a in prefs.keys;
              const err = error?.action === a ? error.text : null;
              return (
                <li key={a} className="set-keys-item">
                  <div className="set-keys-row">
                    <span className="set-row-text">
                      <span className="set-label" id={`${uid}-${a}`}>
                        {SHORTCUT_LABELS[a]}
                      </span>
                      <span className="set-hint">{SHORTCUT_HINTS[a]}</span>
                    </span>
                    <span className="set-keys-ctl">
                      <button
                        type="button"
                        className={'btn btn-sm set-keys-key' + (rec ? ' is-recording' : '') + (c ? '' : ' is-empty')}
                        aria-describedby={`${uid}-${a}`}
                        aria-pressed={rec}
                        onClick={() => {
                          setError(null);
                          setRecording(rec ? null : a);
                        }}
                        onKeyDown={(e) => onRecordKey(e, a)}
                        onBlur={() => {
                          if (recording === a) setRecording(null);
                        }}
                      >
                        {rec ? 'Bấm phím mới…' : c ? comboText(c, mac) : 'Chưa có phím'}
                      </button>
                      {own && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          title={tl`Về phím mặc định (${comboText(DEFAULT_SHORTCUTS[a], mac)})`}
                          aria-label={tl`Về phím mặc định (${comboText(DEFAULT_SHORTCUTS[a], mac)})`}
                          onClick={() => {
                            setError(null);
                            setShortcutPrefs(withKey(prefs, a, undefined));
                          }}
                        >
                          <Icon icon={RotateCcw} size={15} />
                        </button>
                      )}
                      {c && !own && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Bỏ phím này"
                          aria-label="Bỏ phím này"
                          onClick={() => {
                            setError(null);
                            setShortcutPrefs(withKey(prefs, a, null));
                          }}
                        >
                          <Icon icon={X} size={15} />
                        </button>
                      )}
                    </span>
                  </div>
                  {rec && !err && (
                    <p className="set-hint set-keys-note" role="status">
                      Giữ Ctrl (hoặc Alt) rồi bấm một phím. Esc để hủy.
                    </p>
                  )}
                  {err && (
                    <p className="set-keys-error" role="alert">
                      {err}
                    </p>
                  )}
                </li>
              );
            })}
            <li className="set-keys-item">
              <div className="set-keys-row">
                <span className="set-row-text">
                  <span className="set-label">Kiểm tra, rồi sang câu tiếp</span>
                  <span className="set-hint">Phím của ô gõ, không đổi được.</span>
                </span>
                <span className="set-keys-ctl">
                  <span className="set-keys-fixed">Enter</span>
                </span>
              </div>
            </li>
          </ul>
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!changed}
              onClick={() => {
                setError(null);
                setRecording(null);
                setShortcutPrefs({ ...prefs, keys: {} });
              }}
            >
              <Icon icon={RotateCcw} size={14} />
              Khôi phục mặc định
            </button>
          </div>
        </>
      )}
    </section>
  );
}
