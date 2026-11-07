import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Square, Turtle, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PENDING_ARIA } from '../../components/pendingLabel';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending } from '../../core/tts';

export interface SpeakIconButtonProps {
  text: string;
  /** Speech rate; the default turtle button is the slow companion of a soft <PlayButton> "Nghe". Omit: the
   *  rate from Settings (normal playback, e.g. the Volume2 button of a word row). */
  rate?: number;
  /** Icon at rest (default Turtle = slow playback). */
  icon?: LucideIcon;
  /** Accessible name and tooltip (icon-only button). */
  label?: string;
  size?: 'sm' | 'md';
}

/**
 * Ghost icon-only button that speaks `text` (click again to stop). Used for "Nghe chậm" (Turtle) next to a soft
 * <PlayButton>, and for the trailing play button of compact rows. Renders nothing without TTS (PlayButton says why).
 */
export default function SpeakIconButton({
  text,
  rate,
  icon = Turtle,
  label = 'Nghe chậm',
  size = 'sm',
}: SpeakIconButtonProps) {
  const [playing, setPlaying] = useState(false);
  const alive = useRef(true);
  // Ownership token: unmount / "stop" only cut speech this button started (same contract as PlayButton).
  const [owner] = useState<object>(() => ({}));
  const pending = useSpeechPending(owner); // AI voice being generated
  const playGen = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopSpeakingIfOwner(owner);
    };
  }, [owner]);

  if (!ttsSupported()) return null;

  const onClick = async () => {
    const gen = ++playGen.current;
    if (playing) {
      stopSpeakingIfOwner(owner);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await speak(text, { rate, owner });
    if (alive.current && gen === playGen.current) setPlaying(false);
  };

  const sm = size === 'sm';
  return (
    <button
      type="button"
      className={'btn btn-ghost btn-icon' + (sm ? ' btn-sm' : '') + (playing ? ' is-playing' : '')}
      onClick={() => void onClick()}
      aria-pressed={playing}
      aria-busy={pending || undefined}
      aria-label={pending ? PENDING_ARIA : label}
      title={pending ? PENDING_ARIA : playing ? 'Dừng' : label}
    >
      {pending ? (
        <Icon icon={LoaderCircle} size={sm ? 13 : 15} className="icon-spin" />
      ) : playing ? (
        <Icon icon={Square} size={sm ? 13 : 15} fill="currentColor" strokeWidth={1.5} />
      ) : (
        <Icon icon={icon} size={sm ? 17 : 19} />
      )}
    </button>
  );
}
