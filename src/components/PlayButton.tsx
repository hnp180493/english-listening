import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Play, Square, VolumeX, type LucideIcon } from 'lucide-react';
import type { SpeechMode } from '../core/playback';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending } from '../core/tts';
import { Icon } from './Icon';
import { PENDING_ARIA, PENDING_LABEL } from './pendingLabel';

export interface PlayButtonProps {
  text: string; // what to speak
  rate?: number; // overrides the global rate
  label?: string; // visible label; defaults to "Nghe"
  size?: 'sm' | 'md';
  primary?: boolean; // shorthand for variant="primary"
  /** Visual style (see .btn variants in src/index.css). Default: plain .btn. */
  variant?: 'default' | 'primary' | 'soft' | 'ghost';
  onPlay?: () => void; // called each time playback starts
  title?: string;
  /** Accessible name when the visible label alone is not enough (must contain the visible label). */
  ariaLabel?: string;
  /** Playback mode (src/core/playback.ts): picks the AI voice style. `text` must already be the matching text. */
  mode?: SpeechMode;
  /** A slowed playback: never faster than 0.8 × the learner's rate (SpeakOptions.slow; careful mode always is). */
  slow?: boolean;
  /** Icon at rest (default Play, filled). */
  icon?: LucideIcon;
}

/** Speak `text` with TTS. Click again while playing to stop (or, while the AI voice is generating, to cancel). */
export default function PlayButton({
  text,
  rate,
  label = 'Nghe',
  size = 'md',
  primary,
  variant,
  onPlay,
  title,
  ariaLabel,
  mode,
  icon,
  slow,
}: PlayButtonProps) {
  const [playing, setPlaying] = useState(false);
  const alive = useRef(true);
  // Ownership token for speak(): unmount and "Dừng" stop speech only while it is still this
  // button's own (another button, a page's autoplay or the next page may have taken over).
  const [owner] = useState<object>(() => ({}));
  // Bumped on every play/stop; a finished speak() only resets `playing` if no newer play/stop
  // happened meanwhile (fixes play → stop → play quickly ending with the button showing "Nghe"
  // while the second play is still speaking).
  const playGen = useRef(0);
  // AI voice: the clip is being generated (1–5 s). The button shows a spinner; a click still stops.
  const pending = useSpeechPending(owner);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // The button (and its "Dừng" control) is going away: don't leave its own speech running.
      stopSpeakingIfOwner(owner);
    };
  }, [owner]);

  if (!ttsSupported()) {
    return (
      <button className="btn btn-sm" disabled title="Trình duyệt không hỗ trợ đọc giọng nói">
        <Icon icon={VolumeX} size={15} />
        Không có giọng đọc
      </button>
    );
  }

  const onClick = async () => {
    const gen = ++playGen.current;
    if (playing) {
      stopSpeakingIfOwner(owner);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    onPlay?.();
    await speak(text, { rate, owner, mode, slow });
    if (alive.current && gen === playGen.current) setPlaying(false);
  };

  const look = variant ?? (primary ? 'primary' : 'default');
  const cls = ['btn', 'play-btn', size === 'sm' ? 'btn-sm' : '', look !== 'default' ? `btn-${look}` : '', playing ? 'is-playing' : '']
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 13 : 15;
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-pressed={playing}
      aria-busy={pending || undefined}
      aria-label={pending ? PENDING_ARIA : playing ? undefined : ariaLabel}
      title={pending ? PENDING_ARIA : title}
    >
      {pending ? (
        <Icon icon={LoaderCircle} size={iconSize} className="icon-spin" />
      ) : playing ? (
        <Icon icon={Square} size={iconSize} fill="currentColor" strokeWidth={1.5} />
      ) : icon ? (
        <Icon icon={icon} size={iconSize + 1} />
      ) : (
        <Icon icon={Play} size={iconSize} fill="currentColor" strokeWidth={1.5} />
      )}
      {pending ? PENDING_LABEL : playing ? 'Dừng' : label}
    </button>
  );
}
