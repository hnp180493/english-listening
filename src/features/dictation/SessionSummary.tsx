import { useEffect, useRef, type MouseEvent } from 'react';
import { ArrowRight, BookOpen, RotateCcw, Target } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import type { SessionSummary } from '../../core/dictation/goal';
import { hrefFor, navigate, type RouteId } from '../../core/nav';
import { PHENOMENON_INFO } from '../../core/phenomena';
import type { Phenomenon } from '../../core/types';

function link(e: MouseEvent<HTMLAnchorElement>, id: RouteId, params: Record<string, string>) {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(id, params);
}

/** End-of-round card shown after the session goal (10 distinct sentences) is reached. */
export default function SessionSummaryCard({
  summary,
  goal,
  reviewCount,
  onContinue,
  onReview,
  onFocus,
}: {
  summary: SessionSummary;
  goal: number;
  reviewCount: number;
  onContinue: () => void;
  onReview: () => void;
  onFocus: (p: Phenomenon) => void;
}) {
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headRef.current?.focus();
  }, []);

  const avgPct = Math.round(summary.avg * 100);
  const praise =
    avgPct >= 90
      ? 'Tai bạn bắt nối âm rất tốt!'
      : avgPct >= 70
        ? 'Tiến bộ rõ rệt, giữ nhịp này nhé.'
        : avgPct >= 50
          ? 'Ổn rồi. Tập trung vào các hiện tượng bên dưới.'
          : 'Các câu này khó. Hãy học lại bài lý thuyết rồi quay lại.';

  return (
    <section className="card dict-sum" aria-labelledby="dict-sum-title">
      <div className="dict-sum-head">
        <h2 id="dict-sum-title" className="dict-sum-title" ref={headRef} tabIndex={-1}>
          Xong {goal} câu!
        </h2>
        <p className="dict-sum-sub">
          Điểm trung bình <b>{avgPct}%</b> · {summary.perfect}/{summary.count} câu đúng hoàn toàn. {praise}
        </p>
      </div>

      <div className="dict-sum-missed">
        <h3 className="dict-h3">Bạn hay nghe sót nhất</h3>
        {summary.topMissed.length === 0 ? (
          <p className="muted">Không có hiện tượng nào bị sót trong phiên này. Tuyệt vời!</p>
        ) : (
          <ul className="dict-sum-list">
            {summary.topMissed.map((m) => {
              const info = PHENOMENON_INFO[m.phenomenon];
              return (
                <li key={m.phenomenon} className="panel dict-sum-row">
                  <div className="dict-sum-row-main">
                    {info ? <PhTag p={m.phenomenon} /> : <span>{m.phenomenon}</span>}
                    <span className="meta">
                      sót ở {m.missed}/{Math.max(m.seen, m.missed)} câu
                    </span>
                    {info?.example && (
                      <span className="dict-sum-ex">
                        {info.example.written}
                        <span className="respell-sep" aria-hidden="true">
                          →
                        </span>
                        <span className="respell">{info.example.spoken}</span>
                      </span>
                    )}
                  </div>
                  <div className="dict-sum-links">
                    <a
                      className="btn btn-ghost btn-sm"
                      href={hrefFor('lessons', { id: m.phenomenon })}
                      onClick={(e) => link(e, 'lessons', { id: m.phenomenon })}
                    >
                      <Icon icon={BookOpen} size={15} />
                      Học bài
                    </a>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onFocus(m.phenomenon)}>
                      <Icon icon={Target} size={15} />
                      Luyện riêng
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="dict-sum-actions">
        {reviewCount > 0 && (
          <button type="button" className="btn btn-ghost" onClick={onReview}>
            <Icon icon={RotateCcw} size={16} />
            Ôn {reviewCount} câu đến hạn
          </button>
        )}
        <button type="button" className="btn btn-primary btn-lg" onClick={onContinue}>
          Luyện tiếp {goal} câu
          <Icon icon={ArrowRight} size={17} />
        </button>
      </div>
    </section>
  );
}
