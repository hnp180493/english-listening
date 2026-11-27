import { Suspense, useCallback, useEffect, useRef } from 'react';
import { hrefFor, navigate, ROUTES, useRoute, type RouteId } from './core/nav';
import { getSettings, useSettings } from './core/settings';
import { applyTheme, watchSystemTheme } from './core/theme';
import { stopSpeaking } from './core/tts';
import { tr } from './i18n';
import { applyLang, useLang, withDictionary } from './i18n/load';
import AppNav from './components/AppNav';
import PageBoundary from './components/PageBoundary';
import SyncBanner from './components/SyncBanner';
import { ADMIN } from './core/admin';
import VoiceNotice from './components/VoiceNotice';
import { lazyPage } from './components/lazyPage';
import { focusPageHeading, shouldFocusHeading } from './components/shellFocus';
// Home is the landing page: bundled eagerly. Every other page is its own chunk, loaded on first visit.
import HomePage from './features/home/HomePage';
import './App.layout.css';

const APP_NAME = 'Nghe Nối Âm';

const PAGES = {
  review: lazyPage(() => import('./features/review/ReviewPage')),
  lessons: lazyPage(() => import('./features/lessons/LessonsPage')),
  decoder: lazyPage(() => import('./features/decoder/DecoderPage')),
  dictation: lazyPage(() => import('./features/dictation/DictationPage')),
  pairs: lazyPage(() => import('./features/pairs/PairsPage')),
  drill: lazyPage(() => import('./features/drill/DrillPage')),
  shadowing: lazyPage(() => import('./features/shadowing/ShadowingPage')),
  media: lazyPage(() => import('./features/media/MediaPage')),
  town: lazyPage(withDictionary('town', () => import('./features/town/TownRoute'))),
  stats: lazyPage(() => import('./features/stats/StatsPage')),
  listening: lazyPage(() => import('./features/listening/ListeningPage')),
  checkup: lazyPage(() => import('./features/checkup/CheckupPage')),
  settings: lazyPage(() => import('./features/settings/SettingsPage')),
  'duyet-k7q2m9x4': lazyPage(withDictionary('town', withDictionary('city', () => import('./features/admin/AdminPage')))),
} satisfies Record<Exclude<RouteId, 'home'>, unknown>;

/**
 * PageBoundary has shown an error: give every page whose chunk failed to load a fresh lazy component,
 * so the next render (boundary reset by navigation, or another visit) downloads it again.
 */
function renewFailedPages() {
  for (const p of Object.values(PAGES)) p.renew();
}

const goTo = (t: RouteId) => navigate(t);

// Route → page. Keep this mapping complete: every RouteId renders its page.
/** The admin's page (core/admin.ts), reached by its address only. */
const ADMIN_ROUTE = 'duyet-k7q2m9x4';

function Page({ id }: { id: RouteId }) {
  switch (id) {
    case 'home':
      return <HomePage />;
    case 'review': {
      const C = PAGES.review.current;
      return <C />;
    }
    case 'lessons': {
      const C = PAGES.lessons.current;
      return <C />;
    }
    case 'decoder': {
      const C = PAGES.decoder.current;
      return <C />;
    }
    case 'dictation': {
      const C = PAGES.dictation.current;
      return <C />;
    }
    case 'pairs': {
      const C = PAGES.pairs.current;
      return <C />;
    }
    case 'drill': {
      const C = PAGES.drill.current;
      return <C />;
    }
    case 'shadowing': {
      const C = PAGES.shadowing.current;
      return <C />;
    }
    case 'media': {
      const C = PAGES.media.current;
      return <C />;
    }
    case 'town': {
      const C = PAGES.town.current;
      return <C />;
    }
    case 'stats': {
      const C = PAGES.stats.current;
      return <C onNavigate={goTo} />;
    }
    case 'listening': {
      const C = PAGES.listening.current;
      return <C />;
    }
    case 'checkup': {
      const C = PAGES.checkup.current;
      return <C />;
    }
    case 'settings': {
      const C = PAGES.settings.current;
      return <C />;
    }
    case 'duyet-k7q2m9x4': {
      const C = PAGES['duyet-k7q2m9x4'].current;
      return <C />;
    }
  }
}

/** Shown while a page's chunk downloads (fades in after a short delay so fast loads do not flash). */
function PageLoading() {
  return (
    <div className="shell-loading" role="status" aria-live="polite">
      <span className="shell-loading-dot" aria-hidden="true" />
      Đang tải trang…
    </div>
  );
}

/**
 * Rendered after the page inside the same Suspense boundary, so its effect runs only once the page
 * itself has committed (right away for a loaded chunk, after the download for a lazy one).
 */
function PageReady({ id, onReady }: { id: RouteId; onReady: (id: RouteId) => void }) {
  useEffect(() => {
    onReady(id);
  }, [id, onReady]);
  return null;
}

export default function App() {
  const route = useRoute();
  const { theme, lang: wantedLang } = useSettings();
  // The language on screen: it follows the setting once its dictionaries are loaded (i18n/load.ts).
  const lang = useLang();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => watchSystemTheme(() => getSettings().theme), []);

  useEffect(() => {
    void applyLang(wantedLang);
  }, [wantedLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const info = ROUTES.find((r) => r.id === route.id);
    document.title = info ? `${tr(info.label)} · ${APP_NAME}` : APP_NAME;
  }, [route.id, lang]);

  // A click on an in-app "#/…" link does not scroll (no element has that id), so the next page
  // would open at the previous page's scroll offset. Remember link clicks and scroll to the top
  // for them; back/forward (no click) keeps the browser's own scroll restoration.
  const linkNav = useRef(false);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#/"]');
      if (a && !a.hasAttribute('target') && a.getAttribute('href') !== window.location.hash) linkNav.current = true;
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const routeKey = hrefFor(route.id, route.params);
  const prevKey = useRef(routeKey);
  useEffect(() => {
    if (prevKey.current === routeKey) return;
    prevKey.current = routeKey;
    if (linkNav.current) {
      linkNav.current = false;
      window.scrollTo({ top: 0 });
    }
  }, [routeKey]);

  // speechSynthesis is one global queue: stop whatever the old page was saying when the user
  // leaves it (several pages never stop on unmount; PlayButton/SpokenSentence stop only their own speech).
  // This is a cleanup, and React runs all passive cleanups before the new page's mount effects,
  // so the next page's autoplay (Drill, Dictation) is not cancelled. Keyed on route.id so a
  // param change inside one page does not cut speech off.
  useEffect(() => () => stopSpeaking(), [route.id]);

  // Focus management on navigation. Route id change: focus the new page's heading unless the page
  // already focused something inside <main>. Param-only change (e.g. media library → player,
  // shadowing next item): refocus only if focus was lost to <body> because its element unmounted.
  const prevRoute = useRef<RouteId>(route.id);
  const prevFocusKey = useRef(routeKey);
  const idChangePending = useRef(false);
  // The route whose page the shell is waiting for: focus was parked on <main> while its chunk loaded.
  // Tagged with the route id so a stale wait (the user moved on before the chunk arrived, or the
  // chunk failed) cannot make another page's mount steal focus.
  const awaitingHeading = useRef<RouteId | null>(null);
  useEffect(() => {
    if (prevFocusKey.current === routeKey) return;
    prevFocusKey.current = routeKey;
    if (prevRoute.current !== route.id) {
      prevRoute.current = route.id;
      idChangePending.current = true; // survives a quick follow-up param change cancelling this frame
    }
    const id = route.id;
    const raf = requestAnimationFrame(() => {
      const idChanged = idChangePending.current;
      idChangePending.current = false;
      const main = mainRef.current;
      awaitingHeading.current = null;
      if (shouldFocusHeading(idChanged, document.activeElement, main, document.body)) {
        focusPageHeading(main);
        // A lazy page may still be loading (only the fallback is in <main>): focus went to <main>
        // itself; move it to the page's <h1> once the page has rendered (see onPageReady).
        if (main && !main.querySelector('h1')) awaitingHeading.current = id;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [routeKey, route.id]);

  // The page inside the Suspense boundary has committed. If the shell had to park focus on <main>
  // while the page's chunk was loading, and the page did not move focus itself meanwhile (its own
  // mount effects run before this one), finish the job by focusing its heading.
  const onPageReady = useCallback((id: RouteId) => {
    if (awaitingHeading.current !== id) return;
    awaitingHeading.current = null;
    const main = mainRef.current;
    const active = document.activeElement;
    if (main && (active === main || active === document.body || !active)) focusPageHeading(main);
  }, []);

  // Keyed by language: a switch redraws every page from scratch, so no label computed earlier stays in the old one.
  return (
    <div className="shell" key={lang}>
      <a
        className="shell-skip"
        href={hrefFor(route.id, route.params)}
        onClick={(e) => {
          e.preventDefault();
          focusPageHeading(mainRef.current);
        }}
      >
        Chuyển đến nội dung chính
      </a>
      <AppNav current={route.id} />
      <main ref={mainRef} className="shell-main" tabIndex={-1} aria-label={tr(ROUTES.find((r) => r.id === route.id)?.label ?? '')}>
        <div className="shell-content">
          <SyncBanner />
          {ADMIN && (
            <p className="shell-admin" role="note">
              Chế độ admin: đang chơi trên dữ liệu thử, không đồng bộ, tiến độ thật không bị đụng tới. <a href={hrefFor(ADMIN_ROUTE)}>Tắt</a>
            </p>
          )}
          <VoiceNotice />
          {/* Suspense sits inside the boundary: a chunk that fails to load shows the boundary's card. */}
          <PageBoundary key={route.id} resetKey={routeKey} onError={renewFailedPages}>
            <Suspense fallback={<PageLoading />}>
              <Page id={route.id} />
              <PageReady id={route.id} onReady={onPageReady} />
            </Suspense>
          </PageBoundary>
        </div>
      </main>
    </div>
  );
}
