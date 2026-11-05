import { useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking, ttsSupported } from '../core/tts';

export interface PlayButtonProps {
  text: string; // what to speak
  rate?: number; // overrides the global rate
  label?: string; // visible label; defaults to "Nghe"
  size?: 'sm' | 'md';
  primary?: boolean;
  onPlay?: () => void; // called each time playback starts
  title?: string;
}

/** Speak `text` with TTS. Click again while playing to stop. */
export default function PlayButton({ text, rate, label = 'Nghe', size = 'md', primary, onPlay, title }: PlayButtonProps) {
  const [playing, setPlaying] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  if (!ttsSupported()) {
    return (
      <button className="btn btn-sm" disabled title="Trình duyệt không hỗ trợ đọc giọng nói">
        Không có giọng đọc
      </button>
    );
  }

  const onClick = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    onPlay?.();
    await speak(text, { rate });
    if (alive.current) setPlaying(false);
  };

  const cls = ['btn', size === 'sm' ? 'btn-sm' : '', primary ? 'btn-primary' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} aria-pressed={playing} title={title}>
      <span aria-hidden="true">{playing ? '■' : '▶'}</span>
      {playing ? 'Dừng' : label}
    </button>
  );
}
