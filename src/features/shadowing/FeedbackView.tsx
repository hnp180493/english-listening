import type { CSSProperties } from 'react';
import { ArrowRight, Info, Lightbulb } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import PlayButton from '../../components/PlayButton';
import { hrefFor } from '../../core/nav';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { useSettings } from '../../core/settings';
import type { Annotation, Phenomenon } from '../../core/types';
import { scoreVerdict, type ShadowFeedback } from './feedback';

type ColorStyle = CSSProperties & { '--shadow-p'?: string };

function AnnotationTip({ a, wordsMissed }: { a: Annotation; wordsMissed: string[] }) {
  const { showIpa } = useSettings();
  return (
    <li className="panel shadow-ann">
      <div className="shadow-ann-head">
        <PhTag p={a.type} />
        <span className="shadow-ann-map">
          <span lang="en">{a.original}</span>
          <Icon icon={ArrowRight} size={14} className="shadow-arrow" />
          <span className="respell" lang="en">
            {a.spoken}
          </span>
          {showIpa && a.ipa && <span className="ipa">{a.ipa}</span>}
        </span>
        <PlayButton text={a.original || a.spoken} rate={0.8} size="sm" label="Nghe chậm" variant="ghost" title="Nghe riêng cụm này ở tốc độ 0.8×" />
      </div>
      {a.rule && <p className="shadow-ann-rule">{a.rule}</p>}
      {wordsMissed.length > 0 && (
        <p className="muted shadow-ann-miss">
          Máy không nhận ra: {wordsMissed.map((w) => `“${w}”`).join(', ')}. Khi nói, hãy nối cụm này thành “{a.spoken}”.
        </p>
      )}
    </li>
  );
}

export default function FeedbackView({ fb }: { fb: ShadowFeedback }) {
  const verdict = scoreVerdict(fb.percent);
  const ringStyle: ColorStyle = { '--shadow-p': String(fb.percent) };
  const missedTypes: Phenomenon[] = [...new Set(fb.missedAnnotations.map((a) => a.type))];

  return (
    <div className="shadow-fb">
      <div className={`shadow-fb-head is-${verdict.tone}`}>
        <div
          className="shadow-ring"
          style={ringStyle}
          role="img"
          aria-label={`Điểm ${fb.percent} phần trăm: đúng ${fb.matched} trên ${fb.total} từ`}
        >
          <span className="shadow-ring-num">
            {fb.percent}
            <small>%</small>
          </span>
        </div>
        <div>
          <p className="shadow-fb-title">{verdict.title}</p>
          <p className="shadow-fb-detail">{verdict.detail}</p>
          <p className="muted shadow-fb-count">
            Máy nhận ra {fb.matched}/{fb.total} từ
            {fb.extra.length > 0 && `, thêm ${fb.extra.length} từ không có trong câu`}.
          </p>
        </div>
      </div>

      <div className="shadow-fb-block">
        <h3 className="shadow-h3">So với câu mẫu</h3>
        <p className="shadow-words" aria-label="Từng từ trong câu mẫu: xanh là đúng, đỏ là máy không nhận ra">
          {fb.words.map((w) => (
            <span
              key={w.index}
              className={`shadow-word is-${w.status}`}
              title={w.status === 'miss' ? (w.heard ? `Máy nghe thành “${w.heard}”` : 'Máy không nghe thấy từ này') : undefined}
            >
              <span className="shadow-word-text">
                {w.status === 'miss' && <span className="shadow-sr">thiếu: </span>}
                {w.raw}
              </span>
              {w.status === 'miss' && (
                <span className="shadow-word-heard">{w.heard ? `nghe: ${w.heard}` : 'không nghe thấy'}</span>
              )}
            </span>
          ))}
        </p>
        <p className="shadow-heard">
          <span className="muted">Máy nghe được: </span>
          <q>{fb.heard}</q>
        </p>
        {fb.extra.length > 0 && (
          <p className="muted shadow-extra">
            Từ thừa: {fb.extra.map((w) => `“${w}”`).join(', ')} — có thể bạn thêm âm, hoặc nói tách hai từ đáng lẽ phải nối.
          </p>
        )}
      </div>

      {fb.missedAnnotations.length > 0 && (
        <div className="shadow-fb-block">
          <h3 className="shadow-h3">Vì sao máy chưa nhận ra?</h3>
          <p className="muted shadow-fb-why">Từ bị lỡ nằm đúng chỗ nối âm, nuốt âm hay rút gọn. Nói mượt được chỗ đó là sẽ nghe ra.</p>
          <ul className="shadow-anns">
            {fb.missedAnnotations.map((a) => (
              <AnnotationTip
                key={a.id}
                a={a}
                wordsMissed={fb.classified.errors.filter((e) => e.annotationIds.includes(a.id)).map((e) => e.targetWord)}
              />
            ))}
          </ul>
          <div className="row shadow-fb-links">
            <span className="muted">Luyện nghe thêm:</span>
            {missedTypes.map((p) => (
              <a key={p} className="btn btn-ghost btn-sm" href={hrefFor('dictation', { focus: p })}>
                {PHENOMENON_INFO[p]?.label ?? p}
              </a>
            ))}
          </div>
        </div>
      )}

      {fb.otherMisses.length > 0 && (
        <p className="callout callout-warn shadow-fb-other">
          <Icon icon={Lightbulb} size={16} />
          <span>
            <b>{fb.otherMisses.map((w) => `“${w}”`).join(', ')}</b> không nằm ở chỗ biến âm: có thể âm cuối hoặc trọng âm chưa
            rõ. Nghe mẫu chậm (0.8×) và nói rõ từng từ, nhất là phụ âm cuối.
          </span>
        </p>
      )}

      <p className="shadow-fb-note">
        <Icon icon={Info} size={14} />
        Điểm đo việc máy hiểu bạn nói gì (“nói cho người khác hiểu”), không chấm phát âm chi tiết.
      </p>
    </div>
  );
}
