// The farm's pictures follow the town: day in the light theme, night in the dark one (the same tint as the canvas).
import { useEffect, useState } from 'react';
import { useSettings } from '../../../../core/settings';
import { resolveTheme, systemPrefersDark } from '../../../../core/theme';
import { paletteFor, type TownPalette } from '../../engine/palette';

export function useFarmInk(): TownPalette['ink'] {
  const pref = useSettings().theme;
  const [dark, setDark] = useState(systemPrefersDark);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setDark(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return paletteFor(resolveTheme(pref, dark) === 'dark' ? 'night' : 'day').ink;
}
