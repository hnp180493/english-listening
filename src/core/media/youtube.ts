// YouTube URL helpers. Pure: no DOM, no network.

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** True for a syntactically valid 11-character YouTube video id. */
export function isYouTubeId(s: string): boolean {
  return ID_RE.test(s);
}

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Extract the video id from any common YouTube link (or a bare id).
 * Supports youtu.be/<id>, youtube.com/watch?v=<id>&t=…, /shorts/<id>, /embed/<id>,
 * /live/<id>, /v/<id>, m./music. subdomains and youtube-nocookie.com. Returns null otherwise.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;
  const direct = parseUrl(raw);
  if (direct || !/\s/.test(raw)) return direct;
  // a link inside other text ("Xem video này: https://youtu.be/… hay lắm")
  for (const token of raw.split(/\s+/)) {
    const id = parseUrl(token.replace(/^[<("'“]+|[>)"'”.,;!?]+$/g, ''));
    if (id) return id;
  }
  return null;
}

function parseUrl(raw: string): string | null {
  if (!raw) return null;

  let s = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (!/^(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)(?:[/?#]|$)/i.test(s)) return null;
    s = 'https://' + s;
  }
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = parts[0] ?? null;
  } else if (YT_HOSTS.has(host)) {
    if (parts[0] === 'watch' || parts.length === 0) {
      id = url.searchParams.get('v');
    } else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) {
      id = parts[1] ?? null;
    } else if (parts[0] === 'attribution_link') {
      const inner = url.searchParams.get('u');
      if (inner) return parseUrl('https://www.youtube.com' + inner);
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

/** Start offset from a YouTube link's t= / start= parameter ("90", "1m30s", "1h2m3s"), in seconds. */
export function parseYouTubeStart(input: string): number | null {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input.trim()) ? input.trim() : 'https://' + input.trim());
  } catch {
    return null;
  }
  const t = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Thumbnail URL for a video id (medium quality, 320×180). */
export function youTubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}
