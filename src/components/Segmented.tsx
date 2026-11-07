import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Small count shown after the label (hidden when 0 or empty, unless the group sets showZeroCounts). */
  count?: number | string;
  title?: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Accessible name of the group (required: the control has no visible label of its own). */
  ariaLabel: string;
  /** Stretch to the container width with equal segments. */
  block?: boolean;
  /** Show counts of 0 too (for filters where "0" is information, e.g. "Thuộc 0"). */
  showZeroCounts?: boolean;
  className?: string;
}

/**
 * Shared segmented control (radio group with roving focus: ←/→/↑/↓/Home/End). Styles: .seg / .seg-btn
 * in src/index.css.
 */
export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  block = false,
  showZeroCounts = false,
  className,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const move = (from: number, step: number): number => {
    for (let i = 1; i <= options.length; i++) {
      const k = (from + step * i + options.length * i) % options.length;
      if (!options[k].disabled) return k;
    }
    return from;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = move(idx, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = move(idx, -1);
    else if (e.key === 'Home') next = move(-1 + options.length, 1);
    else if (e.key === 'End') next = move(0, -1);
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    if (options[next].value !== value) onChange(options[next].value);
  };

  const cls = ['seg', block ? 'seg-block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o, k) => {
        const active = k === current;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[k] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            disabled={o.disabled}
            className="seg-btn"
            onClick={() => !active && onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, k)}
          >
            {o.label}
            {o.count !== undefined && o.count !== '' && (showZeroCounts || o.count !== 0) && (
              <span className="seg-count">{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
