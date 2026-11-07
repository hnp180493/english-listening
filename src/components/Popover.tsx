import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Icon } from './Icon';

export interface PopoverProps {
  /** Visible content of the trigger button (icon and/or text). */
  trigger: ReactNode;
  /** Accessible name of the trigger; required when it shows only an icon. */
  triggerLabel?: string;
  /** Tooltip of the trigger. */
  triggerTitle?: string;
  /** Classes of the trigger button. Default: 'btn btn-ghost btn-sm'. */
  triggerClassName?: string;
  /** Visible heading of the panel; also names the dialog. */
  title: string;
  /** Panel content. A function receives `close` (returns focus to the trigger). */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Optional row of buttons at the bottom of the panel. */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  /** Which edge of the trigger the panel lines up with on ≥ 600px. Default 'end' (right edge). */
  align?: 'start' | 'end';
  /** A key that toggles the popover from anywhere on the page (not while typing), e.g. '?'. */
  hotkey?: string;
  /** Extra class on the wrapper. */
  className?: string;
  /** Extra class on the panel. */
  panelClassName?: string;
  onOpenChange?: (open: boolean) => void;
}

const PHONE_QUERY = '(max-width: 599px)';

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/**
 * Shared popover: a trigger button plus a non-modal dialog panel. Focus moves into the panel on open; Esc and
 * the close button return focus to the trigger; an outside click or tabbing out closes it. Under 600px the panel
 * is a bottom sheet over a backdrop (body scroll locked). The wrapper carries `data-popover`, and the panel is
 * role="dialog", so page-level key handlers can ignore events from inside it.
 */
export default function Popover({
  trigger,
  triggerLabel,
  triggerTitle,
  triggerClassName = 'btn btn-ghost btn-sm',
  title,
  children,
  footer,
  align = 'end',
  hotkey,
  className,
  panelClassName,
  onOpenChange,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const triggerId = useId();
  const titleId = useId();

  // Report open/close to the caller (skips the initial closed state).
  const onOpenChangeRef = useRef(onOpenChange);
  const reported = useRef(false);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  useEffect(() => {
    if (!reported.current && !open) return;
    reported.current = true;
    onOpenChangeRef.current?.(open);
  }, [open]);

  // Looks the trigger up by id (not by ref) so `close` can be handed to render-prop children.
  const close = useCallback(() => {
    setOpen(false);
    document.getElementById(triggerId)?.focus({ preventScroll: true });
  }, [triggerId]);

  // Optional page-wide hotkey (e.g. "?").
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== hotkey || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTypingTarget(e.target)) return;
      // Hidden trigger (e.g. ShortcutsHelp on touch devices): nothing to anchor to.
      if (!buttonRef.current || buttonRef.current.offsetParent === null) return;
      e.preventDefault();
      if (panelRef.current?.contains(document.activeElement)) close();
      else setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey, close]);

  // While open: focus the panel, close on outside pointer down, lock body scroll for the phone bottom sheet.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    const sheet = typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
    const prevOverflow = document.body.style.overflow;
    if (sheet) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('pointerdown', onDown);
      if (sheet) document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const body = typeof children === 'function' ? children(close) : children;
  const foot = typeof footer === 'function' ? footer(close) : footer;

  return (
    <div
      className={'popover' + (className ? ' ' + className : '')}
      ref={wrapRef}
      data-popover=""
      onBlur={(e) => {
        // Tabbing out of the popover closes it (a click elsewhere is handled by pointerdown).
        const to = e.relatedTarget;
        if (open && to instanceof Node && !e.currentTarget.contains(to)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        className={triggerClassName + ' popover-trigger'}
        aria-label={triggerLabel}
        title={triggerTitle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <>
          <div className="popover-backdrop" aria-hidden="true" onClick={close} />
          <div
            id={panelId}
            ref={panelRef}
            className={'popover-panel' + (align === 'start' ? ' is-start' : '') + (panelClassName ? ' ' + panelClassName : '')}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
          >
            <div className="popover-head">
              <h2 id={titleId} className="popover-title">
                {title}
              </h2>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Đóng" onClick={close}>
                <Icon icon={X} size={16} />
              </button>
            </div>
            {body}
            {foot && <div className="popover-foot">{foot}</div>}
          </div>
        </>
      )}
    </div>
  );
}
