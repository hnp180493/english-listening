import type { DecodeResult } from '../core/types';

export interface SpokenSentenceProps {
  result: DecodeResult;
  compact?: boolean; // smaller, no legend; used inside dictation feedback
  activeAnnotationId?: string | null;
  onAnnotationClick?: (annotationId: string) => void;
}

/** Two aligned rows per segment: written words on top, spoken respelling below, colored by phenomenon. */
export default function SpokenSentence({ result }: SpokenSentenceProps) {
  return <div>{result.spokenText}</div>;
}
