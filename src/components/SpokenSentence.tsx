import { useEffect, useState, type CSSProperties } from 'react';
import type { Annotation, DecodeResult, SpokenSegment } from '../core/types';
import { PHENOMENON_INFO } from '../core/phenomena';
import { useSettings } from '../core/settings';
import { speak, stopSpeakingIfOwner, useSpeechPending } from '../core/tts';
import { LoaderCircle, Play } from 'lucide-react';
import { Icon } from './Icon';
import './SpokenSentence.css';

export interface SpokenSentenceProps {
  result: DecodeResult;
  compact?: boolean; // smaller, no legend; used inside dictation feedback
  activeAnnotationId?: string | null;
  onAnnotationClick?: (annotationId: string) => void;
  /** Optional: show a small ▶ on each block that speaks the block's written words. */
  playable?: boolean;
}

type ColorStyle = CSSProperties & { '--ss-color'?: string };

/** Segments to render; falls back to one plain block per token if the decoder gave no segments. */
function getSegments(result: DecodeResult): SpokenSegment[] {
  if (result.segments.length > 0) return result.segments;
  return result.tokens.map((t) => ({
    from: t.index,
    to: t.index,
    written: t.raw,
    spoken: t.raw,
    annotationIds: [],
  }));
}

/** Two aligned rows per segment: written words on top, spoken respelling below, colored by phenomenon. */
export default function SpokenSentence({
  result,
  compact = false,
  activeAnnotationId = null,
  onAnnotationClick,
  playable = false,
}: SpokenSentenceProps) {
  const { showIpa } = useSettings();
  // Ownership token for the per-block ▶ buttons: on unmount stop only speech this sentence started.
  const [owner] = useState<object>(() => ({}));
  // AI voice: which block's ▶ is waiting for its clip (spinner on that block only).
  const pending = useSpeechPending(owner);
  const [lastPlayed, setLastPlayed] = useState(-1);
  useEffect(
    () => () => {
      stopSpeakingIfOwner(owner);
    },
    [owner],
  );
  if (result.tokens.length === 0) return null;

  const byId = new Map<string, Annotation>();
  for (const a of result.annotations) byId.set(a.id, a);
  const segments = getSegments(result);

  return (
    <div className={'ss' + (compact ? ' ss--compact' : '')} role="group" aria-label="Câu khi nói tự nhiên">
      {segments.map((seg, i) => {
        const anns = seg.annotationIds.map((id) => byId.get(id)).filter((a): a is Annotation => !!a);
        const isActive = !!activeAnnotationId && anns.some((a) => a.id === activeAnnotationId);
        const primary = (isActive ? anns.find((a) => a.id === activeAnnotationId) : undefined) ?? anns[0];
        const color = primary ? PHENOMENON_INFO[primary.type]?.color : undefined;
        const style: ColorStyle | undefined = color ? { '--ss-color': color } : undefined;

        const changed = anns.length > 0;
        const labels = anns.map((a) => PHENOMENON_INFO[a.type]?.label ?? a.type);
        // compare without punctuation: "TV." and "TV" sound the same
        const plain = (s: string) => s.replace(/[^\p{L}\p{N}'\s-]/gu, '').trim().toLowerCase();
        const sameSound = plain(seg.spoken) === plain(seg.written);
        const ariaLabel = [
          seg.written,
          sameSound ? null : `đọc là ${seg.spoken}`,
          labels.length ? labels.join(', ') : null,
        ]
          .filter(Boolean)
          .join(', ');

        // IPA: only for annotations that start inside this segment (avoid repeating across blocks).
        const ipaAnn = showIpa
          ? ((primary && primary.ipa && primary.from >= seg.from && primary.from <= seg.to ? primary : undefined) ??
            anns.find((a) => a.ipa && a.from >= seg.from && a.from <= seg.to))
          : undefined;

        const inner = (
          <>
            <span className="ss-written">{seg.written}</span>
            <span className="ss-spoken">{seg.spoken}</span>
            {ipaAnn && <span className="ss-ipa">{ipaAnn.ipa}</span>}
            {anns.length > 1 && (
              <span className="ss-dots" aria-hidden="true">
                {anns.map((a) => (
                  <span
                    key={a.id}
                    className={'ss-dot' + (a.id === activeAnnotationId ? ' is-on' : '')}
                    style={{ background: PHENOMENON_INFO[a.type]?.color }}
                    title={PHENOMENON_INFO[a.type]?.label}
                  />
                ))}
              </span>
            )}
          </>
        );

        const blockCls =
          'ss-block' + (changed ? ' is-changed' : ' is-plain') + (isActive ? ' is-active' : '');
        const clickable = changed && !!onAnnotationClick;

        const onClick = () => {
          if (!onAnnotationClick || anns.length === 0) return;
          // Several annotations: step through them on repeated clicks. On the last one (or a single
          // one) report the active id again, so toggle-style consumers can deselect.
          const cur = anns.findIndex((a) => a.id === activeAnnotationId);
          const next = cur === -1 ? anns[0] : anns[Math.min(cur + 1, anns.length - 1)];
          onAnnotationClick(next.id);
        };

        return (
          <span key={`${seg.from}-${seg.to}-${i}`} className="ss-seg" style={style}>
            {clickable ? (
              <button
                type="button"
                className={blockCls}
                onClick={onClick}
                aria-label={ariaLabel}
                aria-pressed={isActive}
                title={labels.join(' · ')}
              >
                {inner}
              </button>
            ) : (
              <span className={blockCls} title={labels.join(' · ') || undefined}>
                <span className="ss-sr">{ariaLabel}</span>
                <span className="ss-inner" aria-hidden="true">
                  {inner}
                </span>
              </span>
            )}
            {playable && (
              <button
                type="button"
                className="ss-play"
                onClick={() => {
                  setLastPlayed(i);
                  void speak(seg.written, { rate: 0.9, owner });
                }}
                aria-label={`Nghe "${seg.written}"`}
                aria-busy={(pending && lastPlayed === i) || undefined}
                title={`Nghe "${seg.written}"`}
              >
                {pending && lastPlayed === i ? (
                  <Icon icon={LoaderCircle} size={13} className="icon-spin" />
                ) : (
                  <Icon icon={Play} size={10} fill="currentColor" strokeWidth={1.5} />
                )}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
