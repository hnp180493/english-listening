import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Square, Volume2 } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PENDING_ARIA } from '../../components/pendingLabel';
import type { SpeechMode } from '../../core/playback';
import { speak, stopSpeakingIfOwner, ttsSupported, useSpeechPending } from '../../core/tts';
import { naturalRate } from '../../core/playback';

/**
 * Ghost icon button that speaks `text` (click again to stop): the one trailing control of a list row. Chunk rows
 * pass their ttsText (eye dialect) with mode 'connected' (the default), so the AI voice gets the casual style too.
 */
export default function ListenIcon({ text, label, mode = 'connected' }: { text: string; label: string; mode?: SpeechMode }) {
  const [playing, setPlaying] = useState(false);
  const [owner] = useState<object>(() => ({}));
  const pending = useSpeechPending(owner); // AI voice being generated
  const gen = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopSpeakingIfOwner(owner);
    };
  }, [owner]);

  if (!ttsSupported()) return null;

  const onClick = async () => {
    const g = ++gen.current;
    if (playing) {
      stopSpeakingIfOwner(owner);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await speak(text, { rate: naturalRate(), owner, mode });
    if (alive.current && g === gen.current) setPlaying(false);
  };

  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon btn-sm"
      onClick={onClick}
      aria-pressed={playing}
      aria-busy={pending || undefined}
      aria-label={pending ? PENDING_ARIA : playing ? 'Dừng' : label}
      title={pending ? PENDING_ARIA : playing ? 'Dừng' : label}
    >
      {pending ? (
        <Icon icon={LoaderCircle} size={14} className="icon-spin" />
      ) : playing ? <Icon icon={Square} size={14} fill="currentColor" strokeWidth={1.5} /> : <Icon icon={Volume2} size={17} />}
    </button>
  );
}
