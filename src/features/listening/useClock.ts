import { useEffect, useState } from 'react';

/**
 * Current time that re-renders every `ms` while `on` (the stopwatch display). Also refreshes when the tab
 * becomes visible again, so a clock left in a background tab is right the moment it is looked at.
 */
export function useClock(on: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, ms);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [on, ms]);
  return now;
}
