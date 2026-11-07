// Player surfaces: a YouTube iframe or a local <video>/<audio>, both exposed
// through the same small MediaHandle so PlayerView does not care which one it drives.

import { useEffect, useRef, useState } from 'react';
import { Headphones, RotateCw } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import { YT_HOST, YT_STATE, loadYouTubeApi, youTubeErrorMessage, type YTPlayer } from './youtubeApi';

export interface MediaHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  time(): number;
  setRate(rate: number): void;
  playing(): boolean;
}

interface SurfaceCallbacks {
  onReady: (h: MediaHandle | null) => void;
  onError: (message: string) => void;
  onPlayingChange: (playing: boolean) => void;
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

// ------------------------------------------------------------------ YouTube

export function YouTubeSurface({ videoId, onReady, onError, onPlayingChange }: SurfaceCallbacks & { videoId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cb = useLatest({ onReady, onError, onPlayingChange });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const life = { cancelled: false };
    const initial = cb.current;
    let player: YTPlayer | null = null;
    setLoading(true);
    setFailed(false);

    loadYouTubeApi()
      .then((YT) => {
        if (life.cancelled) return;
        // YT replaces this element with an <iframe>; keep it outside React's tree
        const el = document.createElement('div');
        host.appendChild(el);
        let state: number = YT_STATE.UNSTARTED;
        const p = new YT.Player(el, {
          videoId,
          host: YT_HOST,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (life.cancelled) return;
              setLoading(false);
              const safe = <T,>(fn: () => T, fallback: T): T => {
                try {
                  return fn();
                } catch {
                  return fallback;
                }
              };
              cb.current.onReady({
                play: () => safe(() => p.playVideo(), undefined),
                pause: () => safe(() => p.pauseVideo(), undefined),
                seek: (s) => safe(() => p.seekTo(s, true), undefined),
                time: () => safe(() => p.getCurrentTime() || 0, 0),
                setRate: (r) => safe(() => p.setPlaybackRate(r), undefined),
                playing: () => state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING,
              });
            },
            onStateChange: (e) => {
              state = e.data;
              if (!life.cancelled) cb.current.onPlayingChange(state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING);
            },
            onError: (e) => {
              if (!life.cancelled) {
                setLoading(false);
                cb.current.onError(youTubeErrorMessage(e.data));
              }
            },
          },
        });
        player = p;
      })
      .catch(() => {
        if (life.cancelled) return;
        setLoading(false);
        setFailed(true);
        cb.current.onError(
          'Không tải được trình phát YouTube. Kiểm tra kết nối mạng, hoặc tắt trình chặn quảng cáo/chặn theo dõi cho trang này rồi tải lại.',
        );
      });

    return () => {
      life.cancelled = true;
      initial.onReady(null);
      try {
        player?.destroy();
      } catch {
        // ignore
      }
      host.replaceChildren();
    };
  }, [videoId, cb, attempt]);

  return (
    <div className="media-frame">
      <div ref={hostRef} className="media-frame-host" />
      {loading && (
        <div className="media-frame-loading" role="status">
          <span className="media-spinner" aria-hidden="true" /> Đang tải trình phát YouTube…
        </div>
      )}
      {failed && !loading && (
        <div className="media-frame-loading">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              cb.current.onError('');
              setAttempt((a) => a + 1);
            }}
          >
            <Icon icon={RotateCw} size={14} />
            Thử tải lại trình phát
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ local file

export function FileSurface({
  file,
  fileType,
  onReady,
  onError,
  onPlayingChange,
}: SurfaceCallbacks & { file: File; fileType: 'audio' | 'video' }) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const cb = useLatest({ onReady, onError, onPlayingChange });

  // object URL lives exactly as long as this file is shown
  useEffect(() => {
    const el = mediaRef.current;
    const initial = cb.current;
    if (!el) return;
    const u = URL.createObjectURL(file);
    el.src = u;
    el.load();
    return () => {
      initial.onReady(null);
      el.pause();
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(u);
    };
  }, [file, cb]);

  const setRef = (el: HTMLMediaElement | null) => {
    mediaRef.current = el;
  };

  const handleLoaded = () => {
    const el = mediaRef.current;
    if (!el) return;
    cb.current.onReady({
      play: () => {
        el.play().catch(() => {
          // autoplay blocked or aborted by a pause(); nothing to do
        });
      },
      pause: () => el.pause(),
      seek: (s) => {
        el.currentTime = Math.max(0, s);
      },
      time: () => el.currentTime || 0,
      setRate: (r) => {
        el.playbackRate = r;
        el.preservesPitch = true;
      },
      playing: () => !el.paused && !el.ended,
    });
  };

  const common = {
    ref: setRef,
    controls: true,
    preload: 'auto' as const,
    onLoadedMetadata: handleLoaded,
    onPlay: () => cb.current.onPlayingChange(true),
    onPause: () => cb.current.onPlayingChange(false),
    onEnded: () => cb.current.onPlayingChange(false),
    onError: () => {
      // removing src on cleanup also fires "error": ignore when no file is attached
      if (!mediaRef.current?.getAttribute('src')) return;
      cb.current.onError(
        'Trình duyệt không phát được tệp này. Hãy thử định dạng phổ biến hơn (MP3, M4A, MP4, WebM) hoặc trình duyệt khác.',
      );
    },
  };

  return fileType === 'audio' ? (
    <div className="media-audio">
      <IconTile icon={Headphones} tint="var(--text-muted)" />
      <span className="media-audio-name" title={file.name}>
        {file.name}
      </span>
      <audio {...common} className="media-audio-el" aria-label={`Âm thanh: ${file.name}`} />
    </div>
  ) : (
    <div className="media-frame media-frame-video">
      <video {...common} playsInline className="media-video-el" aria-label={`Video: ${file.name}`} />
    </div>
  );
}
