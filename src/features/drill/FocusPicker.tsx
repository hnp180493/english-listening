import type { MouseEvent } from 'react';
import { Target } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PhDot } from '../../components/PhTag';
import { hrefFor, navigate } from '../../core/nav';
import { PHENOMENON_INFO } from '../../core/phenomena';
import type { Phenomenon } from '../../core/types';
import type { PhenomenonCount } from './focus';

export interface FocusPickerProps {
  counts: readonly PhenomenonCount[];
  /** Phenomenon of the running focus session, highlighted in the list. */
  current?: Phenomenon | null;
  /** Visible label of the fold; omit to use the default. */
  title?: string;
}

function go(e: MouseEvent<HTMLAnchorElement>, p: Phenomenon) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let the browser open a new tab
  e.preventDefault();
  navigate('drill', { focus: p });
}

function metaFor(r: PhenomenonCount): string {
  const parts = [`${r.total} cụm`];
  if (r.due > 0) parts.push(`${r.due} đến hạn`);
  else if (r.fresh > 0) parts.push(`${r.fresh} mới`);
  return parts.join(' · ');
}

/** Closed fold under the card: phenomena tiles; each one starts a "Luyện theo hiện tượng" session (#/drill?focus=…). */
export default function FocusPicker({ counts, current = null, title = 'Luyện theo hiện tượng' }: FocusPickerProps) {
  if (counts.length === 0) return null;
  return (
    <details className="how drill-picker">
      <summary>
        <Icon icon={Target} size={18} />
        {title}
      </summary>
      <div className="stack-sm">
        <p className="meta drill-picker-sub">Luyện riêng một hiện tượng. Thẻ chưa đến hạn không làm lệch lịch ôn.</p>
        <ul className="card-grid drill-picker-grid">
          {counts.map((r) => {
            const info = PHENOMENON_INFO[r.phenomenon];
            const body = (
              <>
                <span className="item-card-title drill-picker-name" title={info.summary}>
                  <PhDot p={r.phenomenon} />
                  {info.label}
                </span>
                <span className="item-card-meta">{r.phenomenon === current ? 'Đang luyện' : metaFor(r)}</span>
              </>
            );
            return (
              <li key={r.phenomenon}>
                {r.phenomenon === current ? (
                  <span className="item-card drill-picker-item" aria-current="true">
                    {body}
                  </span>
                ) : (
                  <a
                    className="item-card drill-picker-item"
                    href={hrefFor('drill', { focus: r.phenomenon })}
                    onClick={(e) => go(e, r.phenomenon)}
                  >
                    {body}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
