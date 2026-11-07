import type { CSSProperties } from 'react';
import { Volume2 } from 'lucide-react';
import type { Annotation } from '../../core/types';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { PhDot } from '../../components/PhTag';
import SpeakIconButton from '../lessons/SpeakIconButton';

type ColorStyle = CSSProperties & { '--dec-color'?: string };

export interface AnnotationCardProps {
  annotation: Annotation;
  selected: boolean;
  showIpa: boolean;
  onSelect: (id: string) => void;
  as?: 'li' | 'div';
}

/**
 * One connected-speech event: dot + Vietnamese name (phenomenon colour, text only), original → respelling, IPA,
 * the rule, and a trailing icon play button. Paired with a coloured segment, so the colour is allowed here.
 */
export function AnnotationCard({ annotation: a, selected, showIpa, onSelect, as = 'li' }: AnnotationCardProps) {
  const info = PHENOMENON_INFO[a.type];
  const style: ColorStyle = { '--dec-color': info?.color ?? 'var(--text-muted)' };
  const Tag = as;
  return (
    <Tag className={'dec-ann' + (selected ? ' is-selected' : '')} style={style}>
      <button type="button" className="dec-ann-main" onClick={() => onSelect(a.id)} aria-pressed={selected}>
        <span className="dec-ann-head">
          {info && <PhDot p={a.type} />}
          <span className="dec-ann-tag" title={info?.en}>
            {info?.label ?? a.type}
          </span>
        </span>
        <span className="dec-ann-change">
          <span className="dec-ann-orig" lang="en">
            {a.original}
          </span>
          <span className="respell-sep" aria-hidden="true">
            →
          </span>
          <span className="dec-sr">đọc là</span>
          <span className="respell dec-ann-spoken" lang="en">
            {a.spoken}
          </span>
          {showIpa && a.ipa && <span className="ipa dec-ann-ipa">{a.ipa}</span>}
        </span>
        {a.rule && <span className="dec-ann-rule">{a.rule}</span>}
      </button>
      <div className="dec-ann-play">
        <SpeakIconButton text={a.original} rate={1} icon={Volume2} label={`Nghe "${a.original}"`} />
      </div>
    </Tag>
  );
}

export interface AnnotationListProps {
  annotations: Annotation[];
  selectedId: string | null;
  showIpa: boolean;
  onSelect: (id: string) => void;
}

/** Detail list of every connected-speech event in the sentence (rendered inside "Chi tiết"). */
export default function AnnotationList({ annotations, selectedId, showIpa, onSelect }: AnnotationListProps) {
  return (
    <ol className="dec-anns">
      {annotations.map((a) => (
        <AnnotationCard
          key={a.id}
          annotation={a}
          selected={a.id === selectedId}
          showIpa={showIpa}
          onSelect={onSelect}
        />
      ))}
    </ol>
  );
}
