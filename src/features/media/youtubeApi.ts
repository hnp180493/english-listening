// Minimal typed loader for the YouTube IFrame Player API (loaded once, on demand).

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

export interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

export interface YTPlayerOptions {
  videoId: string;
  host?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTPlayerEvent) => void;
    onStateChange?: (e: YTPlayerEvent) => void;
    onError?: (e: YTPlayerEvent) => void;
  };
}

export interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
  PlayerState?: Record<string, number>;
  /** Defined by the iframe_api bootstrap: runs fn now if the API is loaded, else once it is. */
  ready?: (fn: () => void) => void;
}

type YTWindow = Window & {
  YT?: Partial<YTNamespace>;
  onYouTubeIframeAPIReady?: () => void;
};

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;
export const YT_HOST = 'https://www.youtube-nocookie.com';
const SCRIPT_SRC = 'https://www.youtube.com/iframe_api';
const LOAD_TIMEOUT_MS = 15000;

let pending: Promise<YTNamespace> | null = null;

/** Resolves with window.YT once the API is ready. Safe to call many times. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT && typeof w.YT.Player === 'function') return Promise.resolve(w.YT as YTNamespace);
  if (pending) return pending;

  pending = new Promise<YTNamespace>((resolve, reject) => {
    let settled = false;
    let added: HTMLScriptElement | null = null;
    const finish = (ok: boolean, err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (ok && w.YT && typeof w.YT.Player === 'function') resolve(w.YT as YTNamespace);
      else {
        // drop a failed tag so a later retry really downloads the script again
        if (added && !w.YT) added.remove();
        reject(err ?? new Error('not ready'));
      }
    };
    const timer = window.setTimeout(() => finish(false, new Error('timeout')), LOAD_TIMEOUT_MS);
    const check = () => {
      if (w.YT && typeof w.YT.Player === 'function') finish(true);
    };

    // Chain with any existing callback (another script may also wait for the API). The API
    // calls window.onYouTubeIframeAPIReady only once, so this also covers a load in progress.
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
        // ignore errors from other listeners
      }
      check();
    };
    // The bootstrap is already on the page (loaded by someone else, possibly long ago):
    // YT.ready() fires immediately when the API has loaded, or queues until it does.
    if (w.YT && typeof w.YT.ready === 'function') {
      try {
        w.YT.ready(check);
      } catch {
        // fall back to the global callback / timeout
      }
    }

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onerror = () => finish(false, new Error('network'));
      document.head.appendChild(s);
      added = s;
    }
  }).catch((err: unknown) => {
    pending = null; // allow a retry later
    throw err;
  });
  return pending;
}

/** Vietnamese message for a YouTube player error code. */
export function youTubeErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return 'Mã video không hợp lệ. Kiểm tra lại đường link.';
    case 5:
      return 'Trình duyệt không phát được video này (lỗi HTML5). Thử tải lại trang.';
    case 100:
      return 'Không tìm thấy video — có thể video đã bị xoá hoặc để riêng tư.';
    case 153:
      return 'YouTube từ chối phát vì không nhận ra trang nhúng (lỗi 153). Thử tải lại trang, hoặc mở bằng trình duyệt khác.';
    case 101:
    case 150:
      return 'Chủ video không cho phép phát nhúng ở trang khác. Hãy chọn video khác, hoặc tải bản ghi âm về máy và dùng mục “Tệp trên máy”.';
    default:
      return `YouTube báo lỗi (mã ${code}). Thử tải lại trang.`;
  }
}
