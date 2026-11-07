import { ArrowRight, Check } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import PlayButton from '../../components/PlayButton';
import type { ClassifyResult, DictationError } from '../../core/dictation/classify';
import type { DiffUnit } from '../../core/dictation/diff';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { useSettings } from '../../core/settings';
import { annotationPlayback, contradictsShown } from '../../core/playback';
import type { Annotation, Phenomenon, SpokenSegment } from '../../core/types';
import AiExplain from '../ai/AiExplain';

/** One phenomenon tag for an item (the first one, "+N" for the rest): the design budget is one tag per item. */
export function PhenomenonChips({ list }: { list: readonly Phenomenon[] }) {
  const known = list.filter((p) => !!PHENOMENON_INFO[p]);
  if (known.length === 0) return null;
  return <PhTag p={known[0]} more={known.length - 1} className="dict-phtag" />;
}

function errorText(e: DictationError) {
  if (e.kind === 'del') return <>bỏ sót “{e.targetWord}”</>;
  return (
    <>
      gõ <s>{e.answerWord || '…'}</s> thay vì “{e.targetWord}”
    </>
  );
}

export function AnnotationCard({
  a,
  errors,
  active,
  onPlayStart,
  segments,
}: {
  a: Annotation;
  errors?: DictationError[];
  active?: boolean;
  onPlayStart?: () => void; // lets the exercise cancel its own (chunk) playback first
  /** The sentence's decoder segments: "Nghe" speaks this stretch's connected form (playback.annotationSpeech). */
  segments?: readonly SpokenSegment[];
}) {
  const { showIpa } = useSettings();
  const info = PHENOMENON_INFO[a.type];
  // null: the ▶ would say a lone weak word in its strong form, the opposite of a.spoken (playback.contradictsShown)
  const fallback = a.original || a.spoken;
  const speech = segments ? annotationPlayback(a, segments) : contradictsShown(fallback, a.original, a.spoken) ? null : fallback;
  return (
    <div className={'panel dict-ann' + (active ? ' is-active' : '')}>
      <div className="dict-ann-head">
        {info && <PhTag p={a.type} />}
        <span className="dict-ann-map">
          <span className="dict-ann-orig">{a.original}</span>
          <Icon icon={ArrowRight} size={14} className="dict-ann-arrow" />
          <span className="respell dict-ann-spoken">{a.spoken}</span>
          {showIpa && a.ipa && <span className="ipa dict-ann-ipa">{a.ipa}</span>}
        </span>
        {speech !== null && (
          <span className="dict-ann-play">
            <PlayButton
              text={speech}
              mode="connected"
              size="sm"
              label="Nghe"
              variant="ghost"
              rate={0.85}
              title="Nghe riêng cụm này"
              onPlay={onPlayStart}
            />
          </span>
        )}
      </div>
      {a.rule && <p className="dict-ann-rule">{a.rule}</p>}
      {errors && errors.length > 0 && (
        <p className="dict-ann-err">
          Bạn đã{' '}
          {errors.map((e, k) => (
            <span key={k}>
              {k > 0 && '; '}
              {errorText(e)}
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

export default function WhyWrong({
  cls,
  annotations,
  activeId,
  onPlayStart,
  ai,
  segments,
}: {
  cls: ClassifyResult;
  annotations: Annotation[];
  /** The sentence's decoder segments, so each card's "Nghe" speaks the connected form. */
  segments?: readonly SpokenSegment[];
  /** The spot selected in the spoken sentence below: its card is outlined. */
  activeId?: string | null;
  onPlayStart?: () => void;
  /** Sentence, typed answer and diff: enables "Hỏi AI vì sao nghe sai" (on demand, only with a provider). */
  ai?: { text: string; typed: string; units: readonly DiffUnit[] };
}) {
  const byId = new Map(annotations.map((a) => [a.id, a]));
  const missed = cls.missedAnnotationIds.map((id) => byId.get(id)).filter((a): a is Annotation => !!a);
  const other = cls.errors.filter((e) => e.category === 'other');

  if (cls.errors.length === 0) {
    return (
      <section className="dict-why dict-why-ok">
        <IconTile icon={Check} tint="var(--ok)" size="sm" />
        <div className="dict-why-ok-text">
          <h3 className="dict-h3">Bạn nghe chuẩn rồi!</h3>
          {cls.seenPhenomena.length > 0 ? (
            <p>
              Câu này có <PhenomenonChips list={cls.seenPhenomena} /> và bạn đều bắt được.
            </p>
          ) : (
            <p className="muted">Không có lỗi nào. Sang câu tiếp nhé.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="dict-why">
      <h3 className="dict-h3">Vì sao bạn nghe sai?</h3>
      {missed.length > 0 ? (
        <div className="dict-ann-list">
          {missed.map((a) => (
            <AnnotationCard
              key={a.id}
              a={a}
              errors={cls.errors.filter((e) => e.annotationIds.includes(a.id))}
              active={a.id === activeId}
              onPlayStart={onPlayStart}
              segments={segments}
            />
          ))}
        </div>
      ) : (
        <p className="muted">Lỗi lần này không nằm ở chỗ nối âm nào, nhiều khả năng do từ vựng hoặc chính tả.</p>
      )}
      {other.length > 0 && (
        <div className="dict-other">
          <h4 className="dict-other-h">Từ vựng, chính tả</h4>
          <ul>
            {other.map((e) => (
              <li key={e.targetIndex}>
                {e.kind === 'del' ? (
                  <>
                    Thiếu từ <b>{e.targetWord}</b>
                  </>
                ) : (
                  <>
                    Bạn gõ <s>{e.answerWord || '…'}</s> → đúng là <b>{e.targetWord}</b>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ai && <AiExplain text={ai.text} typed={ai.typed} units={ai.units} annotations={annotations} />}
    </section>
  );
}
