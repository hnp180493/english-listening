import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Icon } from './Icon';
import Popover from './Popover';

export interface FilterButtonProps {
  /** Number of filters that differ from their default; shown as an accent count when > 0. */
  active?: number;
  /** Clears every filter; shows a "Xóa bộ lọc" button in the panel footer while `active > 0`. */
  onReset?: () => void;
  /** Panel title and button text. Default "Bộ lọc". */
  label?: string;
  /** The filter fields (label + .select / Segmented …). */
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

/** "Bộ lọc" ghost button that opens the shared Popover (a bottom sheet on phones) holding a page's filters. */
export default function FilterButton({
  active = 0,
  onReset,
  label = 'Bộ lọc',
  children,
  align = 'end',
  className,
}: FilterButtonProps) {
  return (
    <Popover
      className={'filter-button' + (className ? ' ' + className : '')}
      triggerClassName="btn btn-ghost btn-sm"
      triggerLabel={active > 0 ? `${label}, đang bật ${active}` : undefined}
      trigger={
        <>
          <Icon icon={SlidersHorizontal} size={15} />
          {label}
          {active > 0 && (
            <span className="badge badge-accent filter-count" aria-hidden="true">
              {active}
            </span>
          )}
        </>
      }
      title={label}
      align={align}
      footer={
        onReset && active > 0
          ? (close) => (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onReset();
                  close();
                }}
              >
                Xóa bộ lọc
              </button>
            )
          : undefined
      }
    >
      <div className="filter-fields">{children}</div>
    </Popover>
  );
}
