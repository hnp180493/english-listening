import { ExternalLink, Turtle } from 'lucide-react';
import { CAREFUL_ARIA, CAREFUL_LABEL, CAREFUL_RATE, CAREFUL_TITLE, CONNECTED_TITLE, carefulPlan, connectedPlan, writtenText, youglishUrl, type MaybeSpeakable } from '../core/playback';
import { Icon } from './Icon';
import PlayButton from './PlayButton';
import './ListenPair.css';

export interface ListenPairProps {
  /** The standard written text (what the careful button reads). */
  text: string;
  /** Decoder result of `text`: its speakable spelling (speakText) is what the main "Nghe" speaks. */
  decoded?: MaybeSpeakable | null;
  /** Authored speakable override (content `say`), used before the decoder's speakText. */
  say?: string;
  size?: 'sm' | 'md';
  /** Style of the main "Nghe" (default soft). */
  variant?: 'primary' | 'soft' | 'ghost';
  /** Rate of the main "Nghe" (default: the learner's rate). */
  rate?: number;
  /**
   * Content shown AS WRITTEN (courses spelling / irregular / loanwords): "Nghe" speaks `say ?? text` unchanged, in
   * the AI voice's default style, never the decoder's eye dialect (it would blur the word the lesson teaches).
   */
  asWritten?: boolean;
  className?: string;
}

/**
 * The playback pattern for any sentence the app shows decoded (docs/design-system.md → Playback):
 *  - "Nghe": the CONNECTED version (say ?? speakText ?? text) at the normal rate, like real speech;
 *  - "Rõ từng từ" (turtle): the STANDARD written text, slower: the deliberate contrast.
 */
export default function ListenPair({ text, decoded, say, size = 'sm', variant = 'soft', rate, asWritten, className }: ListenPairProps) {
  const fast = asWritten ? { text: writtenText(text, say), mode: undefined, rate } : connectedPlan(text, decoded, say, rate);
  const slow = carefulPlan(text, CAREFUL_RATE);
  return (
    <div className={['listen-pair', className].filter(Boolean).join(' ')} role="group" aria-label={`Nghe: ${text}`}>
      <PlayButton
        text={fast.text}
        rate={fast.rate}
        mode={fast.mode}
        label="Nghe"
        size={size}
        variant={variant}
        title={asWritten ? 'Nghe câu' : CONNECTED_TITLE}
        ariaLabel={asWritten ? undefined : `Nghe, ${CONNECTED_TITLE.toLowerCase()}`}
      />
      <PlayButton
        text={slow.text}
        rate={slow.rate}
        mode={slow.mode}
        icon={Turtle}
        label={CAREFUL_LABEL}
        size={size}
        variant="ghost"
        title={CAREFUL_TITLE}
        ariaLabel={CAREFUL_ARIA}
      />
    </div>
  );
}

/**
 * Quiet link to real native speakers saying `phrase`: YouGlish (YouTube clips) in a new tab. No embedding, no key.
 * Machine voices only approximate real connected speech; this is the honest way to hear the real thing.
 */
export function RealVoiceLink({ phrase, className }: { phrase: string; className?: string }) {
  if (!phrase.trim()) return null;
  return (
    <a
      className={['real-voice-link', className].filter(Boolean).join(' ')}
      href={youglishUrl(phrase)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Video thật trên YouGlish: “${phrase}” (mở tab mới)`}
    >
      <Icon icon={ExternalLink} size={14} />
      Nghe người thật nói
      <span className="sr-only"> “{phrase}” trên YouGlish (mở tab mới)</span>
    </a>
  );
}
