import { useEffect, useState } from 'react';
import { loadStats, subscribeStats, type StatsState } from '../../core/stats';

/** Stats that re-render on every recorded attempt (this tab) and on storage changes (other tabs). */
export function useLiveStats(): StatsState {
  const [stats, setStats] = useState<StatsState>(() => loadStats());
  useEffect(() => {
    const unsubscribe = subscribeStats((s) => setStats(s));
    const onStorage = (e: StorageEvent) => {
      if (e.key == null || e.key.endsWith('stats')) setStats(loadStats());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return stats;
}

/** Current time, refreshed every `intervalMs` and whenever the tab becomes visible (day rollover). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}
