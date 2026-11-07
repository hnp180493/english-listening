// Hash router shared by every page. URL shape: #/<route>?key=value&key2=value2
// Legacy "#dictation" (no slash) is still accepted.

import { useSyncExternalStore } from 'react';

export type RouteId =
  | 'home'
  | 'review'
  | 'lessons'
  | 'decoder'
  | 'dictation'
  | 'pairs'
  | 'drill'
  | 'shadowing'
  | 'media'
  | 'stats'
  | 'listening'
  | 'checkup'
  | 'settings';

export type RouteGroup = 'learn' | 'practice' | 'track';

export interface RouteInfo {
  id: RouteId;
  label: string; // Vietnamese nav label
  hint: string; // one-line Vietnamese description
  icon: string; // legacy text glyph; the UI renders the SVG icon from ROUTE_ICON (src/components/routeIcons.ts)
  group: RouteGroup;
  /** false: a real page (links, shortcuts, document title work) that is not listed in the sidebar / drawer / tabs. */
  nav?: false;
}

export const ROUTES: readonly RouteInfo[] = [
  { id: 'home', label: 'Hôm nay', hint: 'Kế hoạch luyện hôm nay', icon: '☀', group: 'learn' },
  { id: 'review', label: 'Ôn tập', hint: 'Ôn lại đúng lúc những gì đã học', icon: '↻', group: 'learn' },
  { id: 'lessons', label: 'Bài học', hint: 'Nối âm, cách đọc chữ, từ bất quy tắc', icon: '📘', group: 'learn' },
  { id: 'decoder', label: 'Giải mã câu', hint: 'Xem câu được nói ra như thế nào', icon: '🔍', group: 'learn' },
  { id: 'dictation', label: 'Chép chính tả', hint: 'Nghe và gõ lại từng câu', icon: '✍', group: 'practice' },
  { id: 'pairs', label: 'Phân biệt âm', hint: 'Can hay can’t? Nghe và chọn', icon: '⚖', group: 'practice' },
  { id: 'drill', label: 'Cụm từ', hint: 'Ôn các cụm hay bị nói nhanh', icon: '🃏', group: 'practice' },
  { id: 'shadowing', label: 'Nói nhại', hint: 'Nghe, nói theo, so sánh', icon: '🎙', group: 'practice' },
  { id: 'media', label: 'Video thật', hint: 'Luyện với YouTube / podcast có phụ đề', icon: '🎬', group: 'practice' },
  { id: 'stats', label: 'Tiến độ', hint: 'Bạn đang yếu phần nào', icon: '📈', group: 'track' },
  { id: 'listening', label: 'Nhật ký nghe', hint: 'Ghi lại giờ nghe tiếng Anh thật mỗi ngày', icon: '🎧', group: 'track' },
  // Reached from Home / Nhật ký nghe / Báo cáo, never from the menu: a test is not something to open by habit.
  { id: 'checkup', label: 'Kiểm tra định kỳ', hint: 'Bài nghe 10 phút để đo tiến bộ', icon: '✔', group: 'track', nav: false },
  { id: 'settings', label: 'Cài đặt', hint: 'Giọng đọc, giao diện, sao lưu', icon: '⚙', group: 'track' },
];

/** The routes the navigation lists (sidebar, drawer): every route without `nav: false`, in ROUTES order. */
export const NAV_ROUTES: readonly RouteInfo[] = ROUTES.filter((r) => r.nav !== false);

/** True when the route is listed in the navigation. */
export function isNavRoute(id: RouteId): boolean {
  return NAV_ROUTES.some((r) => r.id === id);
}

export const GROUP_LABEL: Record<RouteGroup, string> = {
  learn: 'Học',
  practice: 'Luyện',
  track: 'Theo dõi',
};

export interface Route {
  id: RouteId;
  params: Record<string, string>;
}

/**
 * Query params each page understands (all optional; keep in sync with what each page reads):
 * - home, listening, checkup: none
 * - settings:  section=ai (scrolls to the "Trợ lý AI" card; anything else → top of the page)
 * - stats:     view=report (the "Báo cáo" view; anything else → the default "Tổng quan" view)
 * - review:    none
 * - lessons:   id=<lessonId> (one lesson; ids are unique across courses) | course=<CourseId> (that course's
 *              lesson list). Neither → the course list. Unknown ids fall back one level with a notice.
 * - decoder:   text=<english sentence>
 * - dictation: focus=<Phenomenon> | level=1|2|3 | mode=normal|cloze|review|custom
 *              | topic=<topic label, or __mine__ for the learner's own sentences; normal/cloze only>
 *              | id=<sentence id or custom sentence id>
 *              A bare #/dictation (no filter param) resumes the last session's filters; any filter
 *              param makes the link a complete request (missing ones fall back to the defaults).
 * - pairs:     focus=<Phenomenon> | set=<pairSetId> | mode=mix (a mixed round, optionally with focus)
 * - drill:     focus=<Phenomenon>
 * - shadowing: id=<sentenceId|chunkId> | text=<english sentence> (id wins when both are given)
 * - media:     id=<itemId> | unit=<n> (player at that transcript line; without id → library)
 */
export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  // Split on the first '?' only: a raw '?' inside a value (e.g. a decoded share link) is kept.
  const i = h.indexOf('?');
  const path = i < 0 ? h : h.slice(0, i);
  const query = i < 0 ? '' : h.slice(i + 1);
  const id = (ROUTES.some((r) => r.id === path) ? path : 'home') as RouteId;
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  return { id, params };
}

export function hrefFor(id: RouteId, params?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return `#/${id}${qs ? '?' + qs : ''}`;
}

export function navigate(id: RouteId, params?: Record<string, string | number | undefined>): void {
  const next = hrefFor(id, params);
  if (window.location.hash !== next) window.location.hash = next;
  window.scrollTo({ top: 0 });
}

let cached: Route | null = null;
let cachedHash = '';

function getRoute(): Route {
  const h = typeof window === 'undefined' ? '' : window.location.hash;
  if (!cached || h !== cachedHash) {
    cached = parseHash(h);
    cachedHash = h;
  }
  return cached;
}

function subscribe(fn: () => void): () => void {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}

/** Current route; re-renders on hash change. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, getRoute);
}
