import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { GROUP_LABEL, hrefFor, NAV_ROUTES, type RouteGroup, type RouteId } from '../core/nav';
import { useSettings } from '../core/settings';
import { currentStreak } from '../core/stats';
import { todayProgress } from '../core/goals';
import { useReview } from '../core/review';
import { useLiveStats, useNow } from '../features/home/hooks';
import { Check, Flame, Menu, X } from 'lucide-react';
import { Icon } from './Icon';
import ListeningTimerPill from './ListeningTimerPill';
import { ROUTE_ICON, routeTint } from './routeIcons';
import './AppNav.css';

const GROUPS: RouteGroup[] = ['learn', 'practice', 'track'];

/** Bottom tab bar shortcuts (mobile). Short labels keep five tabs readable at 375px. */
const TABS: { id: RouteId; short: string }[] = [
  { id: 'home', short: 'Hôm nay' },
  { id: 'review', short: 'Ôn tập' },
  { id: 'lessons', short: 'Bài học' },
  { id: 'dictation', short: 'Chính tả' },
  { id: 'stats', short: 'Tiến độ' },
];

/** Count pill text: "99+" above 99. */
function countLabel(n: number): string {
  return n > 99 ? '99+' : String(n);
}

/** Screen-reader text for the Ôn tập count (the pill itself is aria-hidden). */
function dueLabel(n: number): string {
  return `${n} mục đến hạn`;
}

const DESKTOP_QUERY = '(min-width: 900px)';

export function BrandMark({ size = 36 }: { size?: number }) {
  // The mark is rendered up to three times (sidebar, top bar, drawer): gradient ids must be unique.
  const gid = useId();
  return (
    <svg className="nav-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="nav-mark-stop1" />
          <stop offset="1" className="nav-mark-stop2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <g className="nav-mark-fg" fill="none" strokeWidth="5" strokeLinecap="round">
        <path d="M14 30v8M22 24v20M30 30v8" />
        <path d="M34 34c0-6 4-10 8-10s8 4 8 10" />
        <path d="M42 34v6M50 28v12" />
      </g>
    </svg>
  );
}

function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <a
      className={'nav-brand' + (compact ? ' nav-brand--compact' : '')}
      href={hrefFor('home')}
      aria-label="Nghe Nối Âm, về trang Hôm nay"
      onClick={onNavigate}
    >
      <BrandMark size={compact ? 32 : 38} />
      <span className="nav-brand-text">
        <span className="nav-brand-name">Nghe Nối Âm</span>
      </span>
    </a>
  );
}

function NavLinks({
  current,
  onNavigate,
  counts,
}: {
  current: RouteId;
  onNavigate?: () => void;
  /** Count pills per route (Ôn tập: items due today). */
  counts: Partial<Record<RouteId, number>>;
}) {
  // Sidebar and drawer both render this list: ids must be unique per instance.
  const uid = useId();
  return (
    <div className="nav-groups">
      {GROUPS.map((g) => {
        const routes = NAV_ROUTES.filter((r) => r.group === g);
        if (routes.length === 0) return null;
        return (
          <div className="nav-group" key={g}>
            <div className="nav-group-label" id={`${uid}-${g}`}>
              {GROUP_LABEL[g]}
            </div>
            <ul className="nav-list" aria-labelledby={`${uid}-${g}`}>
              {routes.map((r) => {
                const active = r.id === current;
                const n = counts[r.id] ?? 0;
                return (
                  <li key={r.id}>
                    <a
                      className={'nav-link' + (active ? ' is-active' : '')}
                      href={hrefFor(r.id)}
                      aria-current={active ? 'page' : undefined}
                      title={r.hint}
                      onClick={onNavigate}
                    >
                      <span className="nav-icon" style={{ '--tile': routeTint(r.id) } as CSSProperties} aria-hidden="true">
                        <Icon icon={ROUTE_ICON[r.id]} size={18} />
                      </span>
                      <span className="nav-label">{r.label}</span>
                      {n > 0 && (
                        <>
                          <span className="nav-count" aria-hidden="true">
                            {countLabel(n)}
                          </span>
                          <span className="sr-only">, {dueLabel(n)}</span>
                        </>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function GoalCard({ onNavigate }: { onNavigate?: () => void }) {
  const stats = useLiveStats();
  const now = useNow();
  const { dailyGoal } = useSettings();
  const p = todayProgress(stats, now, dailyGoal);
  const streak = currentStreak(Array.isArray(stats.activeDays) ? stats.activeDays : [], now);
  // No zero metric before the first attempt today: the goal alone, like Home's plan header.
  const started = p.attempts > 0;
  const label =
    (started ? `Mục tiêu hôm nay: ${p.attempts} trên ${p.goal} lượt.` : `Mục tiêu hôm nay: ${p.goal} lượt.`) +
    (streak > 0 ? ` Chuỗi ${streak} ngày.` : '');
  return (
    <a className="nav-goal" href={hrefFor('home')} onClick={onNavigate} aria-label={label}>
      {started ? (
        <>
          <div className="nav-goal-head">
            <span className="nav-goal-title">Mục tiêu hôm nay</span>
            <span className="nav-goal-count">
              {p.attempts}/{p.goal}
            </span>
          </div>
          <div className={'progress nav-goal-bar' + (p.done ? ' is-done' : '')} aria-hidden="true">
            <span style={{ width: `${p.pct}%` }} />
          </div>
        </>
      ) : (
        <div className="nav-goal-head">
          <span className="nav-goal-title">Mục tiêu {p.goal} lượt</span>
        </div>
      )}
      {/* No "start a streak" nag at 0: the foot appears once there is a streak (or the goal is met). */}
      {(streak > 0 || p.done) && (
        <div className="nav-goal-foot">
          {streak > 0 && (
            <span className="nav-goal-streak is-on">
              <Icon icon={Flame} size={14} />
              {streak} ngày liên tiếp
            </span>
          )}
          {p.done && (
            <span className="nav-goal-done">
              <Icon icon={Check} size={14} strokeWidth={2.5} /> Đã đạt
            </span>
          )}
        </div>
      )}
    </a>
  );
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
}

export interface AppNavProps {
  current: RouteId;
}

export default function AppNav({ current }: AppNavProps) {
  // The drawer is open "for" a route: navigating anywhere else closes it without an effect.
  const [openFor, setOpenFor] = useState<RouteId | null>(null);
  const open = openFor === current;
  // Route changed some other way (back button…): forget the stale open state during render.
  if (openFor !== null && openFor !== current) setOpenFor(null);
  const setOpen = useCallback((v: boolean) => setOpenFor(v ? current : null), [current]);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const drawerId = useId();
  const close = useCallback(() => setOpenFor(null), []);
  // Mounted on every page: also runs the once-per-load review reconcile (useReview's effect).
  const { summary } = useReview();
  const counts: Partial<Record<RouteId, number>> = { review: summary.dueToday };

  // Close when the viewport becomes desktop-sized.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (mq.matches) setOpenFor(null);
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Body scroll lock + Esc + focus management while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpenFor(null);
      }
    };
    document.addEventListener('keydown', onKey);
    // Any URL change (back/forward, even within the same page) closes the drawer.
    const onHash = () => setOpenFor(null);
    window.addEventListener('hashchange', onHash);
    const el = drawer.current;
    const raf = requestAnimationFrame(() => {
      if (!el) return;
      const target = el.querySelector<HTMLElement>('.nav-link.is-active') ?? focusables(el)[0];
      target?.focus();
    });
    const btn = menuBtn.current;
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
      // Return focus to the menu button only if focus was left inside the (now closed) drawer.
      const active = document.activeElement;
      if (!active || active === document.body || el?.contains(active)) btn?.focus({ preventScroll: true });
    };
  }, [open]);

  const onDrawerKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !drawer.current) return;
    const items = focusables(drawer.current);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <aside className="nav-sidebar">
        <Brand />
        <nav className="nav-main" aria-label="Điều hướng chính">
          <NavLinks current={current} counts={counts} />
        </nav>
        <ListeningTimerPill current={current} placement="sidebar" />
        <GoalCard />
      </aside>

      <header className="nav-topbar">
        <Brand compact />
        <ListeningTimerPill current={current} placement="topbar" />
        <button
          ref={menuBtn}
          type="button"
          className="nav-menu-btn"
          aria-expanded={open}
          aria-controls={drawerId}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setOpen(!open)}
        >
          <Icon icon={Menu} size={22} />
        </button>
      </header>

      {open && (
        <div className="nav-backdrop" onClick={close}>
          <div
            ref={drawer}
            id={drawerId}
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onDrawerKeyDown}
          >
            <div className="nav-drawer-head">
              <Brand onNavigate={close} />
              <button type="button" className="nav-close-btn" onClick={close} aria-label="Đóng menu">
                <Icon icon={X} size={20} />
              </button>
            </div>
            <nav aria-label="Điều hướng chính">
              <NavLinks current={current} onNavigate={close} counts={counts} />
            </nav>
            <GoalCard onNavigate={close} />
          </div>
        </div>
      )}

      <nav className="nav-tabbar" aria-label="Lối tắt">
        {TABS.map((t) => {
          const info = NAV_ROUTES.find((r) => r.id === t.id);
          if (!info) return null;
          const active = t.id === current;
          const n = counts[t.id] ?? 0;
          return (
            <a
              key={t.id}
              className={'nav-tab' + (active ? ' is-active' : '')}
              href={hrefFor(t.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={n > 0 ? `${info.label}, ${dueLabel(n)}` : info.label}
            >
              <span className="nav-tab-icon" aria-hidden="true">
                <Icon icon={ROUTE_ICON[t.id]} size={21} strokeWidth={active ? 2.25 : 1.9} />
                {n > 0 && <span className="nav-tab-dot" />}
              </span>
              <span className="nav-tab-label" aria-hidden="true">
                {t.short}
              </span>
            </a>
          );
        })}
      </nav>
    </>
  );
}
