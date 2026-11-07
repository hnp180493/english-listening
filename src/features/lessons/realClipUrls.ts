// Pure helpers of the "Nghe người thật nói" block (RealClips.tsx).
import type { RealClip } from '../../data/lessonTypes';
import { YT_HOST } from '../media/youtubeApi';

/** The clip's text split around the first case-insensitive match of `focus`. */
export function splitFocus(text: string, focus: string): { before: string; match: string; after: string } {
  const i = focus ? text.toLowerCase().indexOf(focus.toLowerCase()) : -1;
  if (i < 0) return { before: text, match: '', after: '' };
  return { before: text.slice(0, i), match: text.slice(i, i + focus.length), after: text.slice(i + focus.length) };
}

export function embedUrl(c: Pick<RealClip, 'videoId' | 'start' | 'end'>): string {
  const q = new URLSearchParams({ start: String(c.start), end: String(c.end), autoplay: '1', rel: '0', playsinline: '1' });
  return `${YT_HOST}/embed/${encodeURIComponent(c.videoId)}?${q}`;
}

export function watchUrl(c: Pick<RealClip, 'videoId' | 'start'>): string {
  const q = new URLSearchParams({ v: c.videoId, t: `${c.start}s` });
  return `https://www.youtube.com/watch?${q}`;
}
