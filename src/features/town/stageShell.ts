// What the town page and the city page share round their stage: the day / night theme, the phone checks and "Toàn
// màn hình" (moved out of TownPage.tsx when the city came, 2026-11-25).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSettings } from '../../core/settings';
import { resolveTheme, systemPrefersDark } from '../../core/theme';
import type { SafeInsets, TownTheme } from './engine/stage';
import { inertOutside } from './inertOutside';

/** The town follows the app's theme: night in the dark theme, day in the light one. */
export function useTownTheme(): TownTheme {
  const pref = useSettings().theme;
  const [dark, setDark] = useState(systemPrefersDark);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setDark(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return resolveTheme(pref, dark) === 'dark' ? 'night' : 'day';
}

/** A sheet that covers the whole width (a phone): buying closes it so the new thing can be seen. */
export function narrowStage(): boolean {
  try {
    return window.matchMedia('(max-width: 720px)').matches;
  } catch {
    return false;
  }
}

/** A phone (a narrow screen held in the hand): the town is a game there, it takes the whole screen. */
export function phoneScreen(): boolean {
  try {
    return window.matchMedia('(max-width: 720px) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Full screen was chosen: kept for this session only (a visit of another page and back keeps it, a reload does not).
 * Null until the learner chooses: a phone starts in full screen (owner, 2026-11-24, on a OnePlus: "giao diện điện
 * thoại của game thị trấn lỏ vậy, có cách nào bật full màn hình không?"), a computer does not.
 */
let fullChosen: boolean | null = null;

/**
 * "Toàn màn hình": the stage covers the whole window. The Fullscreen API when the browser has it for an element
 * (it also hides the browser's bars), and in any case a fixed overlay through CSS (`is-full`), which is all an
 * iPhone gets. Esc leaves (the browser's own Esc, or ours for the overlay when no panel is open).
 */
export function useFullStage(box: () => HTMLElement | null, panelOpen: boolean): { full: boolean; toggle: () => void } {
  const [full, setFull] = useState(() => fullChosen ?? phoneScreen());
  const viaApi = useRef(false);

  const set = useCallback(
    (on: boolean) => {
      fullChosen = on;
      setFull(on);
      const el = box();
      if (on) {
        if (el && typeof el.requestFullscreen === 'function' && document.fullscreenEnabled && !document.fullscreenElement) {
          viaApi.current = true;
          el.requestFullscreen().catch(() => {
            // refused (no user gesture, a policy): the overlay alone does the job
            viaApi.current = false;
          });
        }
      } else if (document.fullscreenElement) {
        viaApi.current = false;
        document.exitFullscreen().catch(() => undefined);
      }
    },
    [box],
  );
  const toggle = useCallback(() => set(!(fullChosen ?? phoneScreen())), [set]);

  // a phone in the overlay: its first tap on the town also asks the browser for real full screen (its own bars and the
  // phone's status bar go too); a browser only allows that from a tap, so it cannot happen when the page opens
  useEffect(() => {
    if (!full || !phoneScreen()) return;
    const el = box();
    if (!el || typeof el.requestFullscreen !== 'function' || !document.fullscreenEnabled) return;
    const onTap = () => {
      if (document.fullscreenElement) return;
      viaApi.current = true;
      el.requestFullscreen().catch(() => {
        viaApi.current = false;
      });
    };
    el.addEventListener('pointerup', onTap, { once: true });
    return () => el.removeEventListener('pointerup', onTap);
  }, [full, box]);

  // the browser left full screen by itself (its own Esc, a gesture): the overlay goes too
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) return;
      if (viaApi.current) {
        viaApi.current = false;
        fullChosen = false;
        setFull(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Esc closes a panel first; with none open it leaves full screen
  const panelRef = useRef(panelOpen);
  useEffect(() => {
    panelRef.current = panelOpen;
  }, [panelOpen]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || panelRef.current) return;
      if (e.target instanceof HTMLElement && e.target.closest('[data-popover], [role="dialog"]')) return;
      e.preventDefault();
      set(false);
    };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('town-full-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('town-full-open');
    };
  }, [full, set]);

  // the page under the overlay is still there: the keyboard and the screen reader stay in the town until it ends
  useEffect(() => {
    if (!full) return;
    const el = box();
    if (!el) return;
    const undo = inertOutside(el, document.body);
    if (!el.contains(document.activeElement)) el.querySelector<HTMLElement>('canvas')?.focus({ preventScroll: true });
    return undo;
  }, [full, box]);

  // leaving the page leaves full screen (the overlay is gone with the stage)
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    },
    [],
  );
  return { full, toggle };
}

export const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const sameInsets = (a: SafeInsets, b: SafeInsets) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

/**
 * What the game's own chrome covers on the stage, measured on the page: the counters along the top, the column of
 * buttons down the right edge of a phone, the main button at the bottom, and an open panel (the conversation at the
 * bottom or docked to the side, the build sheet). The stage keeps its name tags out of `safe` and centres what the
 * camera looks at in what is left of `panel`.
 */
export function useStageInsets(box: () => HTMLElement | null, key: string): { safe: SafeInsets; panel: { right: number; bottom: number } } {
  const [safe, setSafe] = useState<SafeInsets>(NO_INSETS);
  const [panel, setPanel] = useState({ right: 0, bottom: 0 });
  useLayoutEffect(() => {
    const stage = box();
    if (!stage) return;
    const measure = () => {
      const sr = stage.getBoundingClientRect();
      if (sr.width < 1) return;
      const next = { ...NO_INSETS };
      // the counters along the top count in a conversation too: the two people's heads must stay below them
      const level = stage.querySelector('.town-level')?.getBoundingClientRect();
      if (level && level.height > 0) next.top = Math.round(level.bottom - sr.top + 6);
      const coins = stage.querySelector('.town-hud-counts')?.getBoundingClientRect();
      if (coins && coins.height > 0) next.top = Math.max(next.top, Math.round(coins.bottom - sr.top + 6));
      const btns = stage.querySelector('.town-hud-btns')?.getBoundingClientRect();
      if (btns && btns.height > 0) {
        // a column down the right edge (a phone), or part of the top row
        if (btns.height > btns.width) next.right = Math.round(sr.right - btns.left + 6);
        else next.top = Math.max(next.top, Math.round(btns.bottom - sr.top + 6));
      }
      const prompt = stage.querySelector('.town-prompt .btn')?.getBoundingClientRect();
      if (prompt) next.bottom = Math.round(sr.bottom - prompt.top + 6);
      // Leo's first words: the player and Leo stand above the card, not under it
      const welcome = stage.querySelector('.town-welcome')?.getBoundingClientRect();
      if (welcome) next.bottom = Math.max(next.bottom, Math.round(sr.bottom - welcome.top + 6));
      setSafe((old) => (sameInsets(old, next) ? old : next));
      const open = stage.querySelector<HTMLElement>('.town-talk, .town-build');
      let p = { right: 0, bottom: 0 };
      if (open) {
        const r = open.getBoundingClientRect();
        // docked to a side (starting right of the stage's first third, near its top) or along the bottom
        p = r.left - sr.left > sr.width * 0.3 && r.top - sr.top < sr.height * 0.3 ? { right: Math.round(sr.right - r.left + 12), bottom: 0 } : { right: 0, bottom: Math.round(sr.bottom - r.top + 12) };
      }
      setPanel((old) => (old.right === p.right && old.bottom === p.bottom ? old : p));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(stage);
    const watched = stage.querySelectorAll('.town-hud, .town-talk, .town-build, .town-prompt, .town-welcome');
    watched.forEach((el) => ro?.observe(el));
    return () => ro?.disconnect();
  }, [box, key]);
  return { safe, panel };
}
