// Small shell pill while this browser's "Bắt đầu nghe" stopwatch exists: "Đang nghe 12:34" → #/listening.
// Mounted by AppNav in the desktop sidebar (above the goal card) and in the mobile top bar. Not a button
// style: a quiet link, so it never competes with a page's primary action. Hidden on the listening page itself
// and on Hôm nay, whose listening row already shows the same clock (never two clocks ticking on one screen).

import { Headphones, Pause } from 'lucide-react';
import { formatClock, timerElapsedMs, timerStatus, useListeningTimer } from '../core/listening';
import { hrefFor, type RouteId } from '../core/nav';
import { pillLabel } from '../features/listening/listeningModel';
import { useClock } from '../features/listening/useClock';
import { Icon } from './Icon';
import './ListeningTimerPill.css';

export default function ListeningTimerPill({ current, placement }: { current: RouteId; placement: 'sidebar' | 'topbar' }) {
  const timer = useListeningTimer();
  const status = timer ? timerStatus(timer) : null;
  const now = useClock(status === 'running');
  if (!timer || !status || current === 'listening' || current === 'home') return null;
  const clock = formatClock(timerElapsedMs(timer, now));
  const label = pillLabel(status, clock);
  // The phone top bar is narrow: the clock alone, with the state as the icon (the full text is the aria-label).
  const text = placement === 'topbar' ? clock : label;
  return (
    <a
      className={`ltp ltp--${placement}` + (status === 'running' ? ' is-running' : '')}
      href={hrefFor('listening')}
      aria-label={`${label}. Mở Nhật ký nghe`}
      title="Mở Nhật ký nghe"
    >
      {status === 'running' && placement === 'sidebar' ? (
        <span className="ltp-dot" aria-hidden="true" />
      ) : (
        <Icon icon={status === 'paused' ? Pause : Headphones} size={15} />
      )}
      <span className="ltp-text tabular" aria-hidden="true">
        {text}
      </span>
    </a>
  );
}
