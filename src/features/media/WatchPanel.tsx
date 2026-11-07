// "Nghe & xem": the current sentence's transcript, plus an on-demand breakdown of
// the connected-speech events that make it hard to catch.

import { useState } from 'react';
import { ArrowRight, Circle, CircleCheck, Eye, EyeOff, Lightbulb, ScanText } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import type { DecodeResult } from '../../core/types';
import { hrefFor } from '../../core/nav';
import SpokenSentence from '../../components/SpokenSentence';

interface Props {
  text: string;
  decoded: DecodeResult;
  showSubs: boolean;
  done: boolean;
  onToggleDone: () => void;
}

export default function WatchPanel({ text, decoded, showSubs, done, onToggleDone }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [why, setWhy] = useState(false);
  const [activeAnn, setActiveAnn] = useState<string | null>(null);
  const visible = showSubs || revealed;
  const active = decoded.annotations.find((a) => a.id === activeAnn) ?? null;
  const kinds = [...new Set(decoded.annotations.map((a) => a.type))];

  return (
    <div className="media-watch">
      {visible ? (
        <p className="media-sub-text" lang="en">
          {text}
        </p>
      ) : (
        <div className="media-sub-hidden">
          <Icon icon={EyeOff} size={18} className="media-sub-hidden-icon" />
          <p className="muted">Phụ đề đang ẩn: nghe vài lần và đoán trước khi xem.</p>
          <button type="button" className="btn btn-sm" onClick={() => setRevealed(true)}>
            <Icon icon={Eye} size={14} />
            Hiện câu này
          </button>
        </div>
      )}

      <div className="row media-watch-actions">
        <button
          type="button"
          className="btn btn-soft btn-sm"
          aria-expanded={why}
          aria-controls="media-why-box"
          onClick={() => {
            setWhy((w) => !w);
            setRevealed(true);
          }}
        >
          <Icon icon={Lightbulb} size={14} />
          {why ? 'Ẩn phân tích' : 'Vì sao khó nghe?'}
        </button>
        <a className="btn btn-ghost btn-sm" href={hrefFor('decoder', { text })}>
          <Icon icon={ScanText} size={14} />
          Mở trong Giải mã câu
        </a>
        <button
          type="button"
          className={'btn btn-sm media-done-btn' + (done ? ' is-done' : ' btn-ghost')}
          aria-pressed={done}
          onClick={onToggleDone}
        >
          <Icon icon={done ? CircleCheck : Circle} size={15} />
          {done ? 'Đã nghe hiểu' : 'Đánh dấu đã hiểu'}
        </button>
      </div>

      {why && (
        <div id="media-why-box" className="panel media-why">
          {decoded.annotations.length === 0 ? (
            <p className="muted">
              Câu này không có hiện tượng nối âm nổi bật. Nếu vẫn khó nghe, thường là do tốc độ nói hoặc từ vựng mới: thử giảm
              tốc độ xuống 0.75× hoặc 0.5×.
            </p>
          ) : (
            <>
              <p className="media-why-title">
                Có {decoded.annotations.length} chỗ âm bị biến đổi
                {kinds.length > 0 && ':'} {kinds.length > 0 && <PhTag p={kinds[0]} more={kinds.length - 1} />}
              </p>
              <SpokenSentence
                result={decoded}
                activeAnnotationId={activeAnn}
                onAnnotationClick={(id) => setActiveAnn((cur) => (cur === id ? null : id))}
              />
              {active ? (
                <div className="media-rule">
                  <p className="media-rule-head">
                    <PhTag p={active.type} />
                    <span lang="en">{active.original}</span>
                    <Icon icon={ArrowRight} size={14} className="media-arrow" />
                    <span className="respell media-rule-spoken" lang="en">
                      {active.spoken}
                    </span>
                  </p>
                  <p>{active.rule}</p>
                </div>
              ) : (
                <p className="muted media-why-tip">Bấm vào cụm có màu để xem giải thích.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
