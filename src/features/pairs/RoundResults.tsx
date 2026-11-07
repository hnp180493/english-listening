import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { BookOpen, Check, History, Lightbulb, PencilLine, RotateCcw, Target, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import PlayButton from '../../components/PlayButton';
import { hrefFor } from '../../core/nav';
import type { Phenomenon } from '../../core/types';
import { LESSONS } from '../../data/lessons';
import type { PairSet } from '../../data/pairs';
import CueText from './CueText';
import { lessonIdFor, percent, scoreTier, summarizeRound, type RoundState } from './game';
import type { ItemRef } from './PairsPage';

const FLAT_ACCENT = { '--progress-color': 'var(--accent)' } as CSSProperties;

export interface RoundResultsProps {
  title: string;
  round: RoundState;
  items: ReadonlyMap<string, ItemRef>;
  sets: ReadonlyMap<string, PairSet>;
  bestScore: number | null; // best score of this set (single-set rounds)
  /** "… sẽ quay lại trong Ôn tập." (docs/review-system.md §5); hidden when absent. */
  reviewNote?: string;
  onReplay: () => void;
  onReviewMissed: (itemIds: string[]) => void;
  onExit: () => void;
}

export default function RoundResults({
  title,
  round,
  items,
  sets,
  bestScore,
  reviewNote,
  onReplay,
  onReviewMissed,
  onExit,
}: RoundResultsProps) {
  const sum = useMemo(() => summarizeRound(round), [round]);
  const tier = scoreTier(sum.score, sum.total);
  const pct = percent(sum.score);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, []);

  // Phenomena to study next: those behind missed items, else everything played.
  const related = useMemo(() => {
    const src = sum.missed.length ? sum.missed.map((m) => m.setId) : sum.bySet.map((b) => b.setId);
    const out: Phenomenon[] = [];
    for (const id of src) {
      const p = sets.get(id)?.phenomenon;
      if (p && !out.includes(p)) out.push(p);
    }
    return out;
  }, [sum, sets]);

  const missedIds = sum.missed.map((m) => m.itemId);
  const facts = [
    sum.requeued > 0 ? `Nghe lại đúng ${sum.recovered}/${sum.requeued} câu từng sai` : '',
    bestScore !== null ? `Cao nhất của bộ: ${percent(bestScore)}%` : '',
  ].filter(Boolean);

  return (
    <section className="stack-lg pairs-results" aria-labelledby="pairs-res-heading">
      <div className="card pairs-res-hero">
        <div
          className="pairs-ring"
          style={{ '--pairs-pct': `${pct}%` } as CSSProperties}
          role="img"
          aria-label={`Đúng ${sum.correct} trên ${sum.total} câu, ${pct}%`}
        >
          <span className="pairs-ring-inner">
            <strong>
              {sum.correct}/{sum.total}
            </strong>
            <span>{pct}%</span>
          </span>
        </div>
        <div className="pairs-res-text">
          <p className="eyebrow pairs-res-kicker">{title}</p>
          <h1 id="pairs-res-heading" ref={headingRef} tabIndex={-1} className="pairs-res-title">
            {tier.title}
          </h1>
          <p className="pairs-res-detail">{tier.detail}</p>
          {facts.length > 0 && <p className="meta pairs-res-facts">{facts.join(' · ')}</p>}
          {reviewNote && (
            <p className="pairs-res-review" role="status">
              <Icon icon={History} size={15} className="pairs-res-review-icon" />
              <span>{reviewNote}</span>
            </p>
          )}
          <div className="row pairs-res-actions">
            <button type="button" className="btn btn-primary" onClick={onReplay}>
              <Icon icon={RotateCcw} size={16} />
              Chơi lượt mới
            </button>
            {missedIds.length > 0 && (
              <button type="button" className="btn btn-soft" onClick={() => onReviewMissed(missedIds)}>
                <Icon icon={Target} size={16} />
                Luyện lại {missedIds.length} câu sai
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onExit}>
              Về danh sách
            </button>
          </div>
        </div>
      </div>

      {sum.bySet.length > 1 && (
        <div className="card">
          <h2 className="pairs-h2">Theo từng bộ</h2>
          <ul className="pairs-breakdown">
            {sum.bySet.map((b) => {
              const s = sets.get(b.setId);
              if (!s) return null;
              const r = b.total ? b.correct / b.total : 0;
              return (
                <li key={b.setId} className="pairs-breakdown-row">
                  <span className="pairs-breakdown-name">
                    {s.title}
                    <PhTag p={s.phenomenon} />
                  </span>
                  <span className="progress pairs-breakdown-bar" style={FLAT_ACCENT} aria-hidden="true">
                    <span style={{ width: `${r * 100}%` }} />
                  </span>
                  <span className="pairs-breakdown-num">
                    {b.correct}/{b.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="pairs-h2">{sum.missed.length ? `Câu bạn nghe nhầm (${sum.missed.length})` : 'Không sai câu nào'}</h2>
        {sum.missed.length === 0 ? (
          <p className="muted pairs-res-none">Bạn đã phân biệt đúng tất cả. Thử một bộ khác hoặc trộn tất cả các bộ.</p>
        ) : (
          <ul className="pairs-missed">
            {sum.missed.map((m) => {
              const ref = items.get(m.itemId);
              if (!ref) return null;
              const { item, set } = ref;
              return (
                <li key={m.itemId} className="pairs-missed-item">
                  <p className="meta pairs-missed-head">
                    <span>{set.title}</span>
                    {m.recovered === true && (
                      <span className="pairs-missed-fixed">
                        <Icon icon={Check} size={14} strokeWidth={2.5} />
                        Đã sửa ở lần nghe lại
                      </span>
                    )}
                    {m.recovered === false && <span>· Vẫn nhầm ở lần nghe lại</span>}
                  </p>
                  <ul className="pairs-missed-options">
                    {item.options.map((opt, i) => (
                      <li key={i}>
                        <span className="pairs-compare-mark" aria-hidden="true">
                          {i === m.answer && <Icon icon={Check} size={16} strokeWidth={2.6} className="is-right" />}
                          {i === m.choice && <Icon icon={X} size={16} strokeWidth={2.6} className="is-wrong" />}
                        </span>
                        <span className="pairs-missed-text">
                          <span lang="en">{opt}</span>
                          {i === m.answer && <span className="sr-only">, câu được đọc</span>}
                          {i === m.choice && <span className="pairs-compare-you">bạn chọn</span>}
                        </span>
                        <PlayButton text={opt} size="sm" label="Nghe" variant="ghost" title={`Nghe: ${opt}`} />
                      </li>
                    ))}
                  </ul>
                  <p className="pairs-missed-cue">
                    <Icon icon={Lightbulb} size={15} className="pairs-missed-cue-icon" />
                    <span>
                      <CueText text={item.cue} />
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {related.length > 0 && (
        <div className="card">
          <h2 className="pairs-h2">Học sâu hơn</h2>
          <ul className="pairs-related">
            {related.map((p) => (
              <li key={p} className="pairs-related-row">
                <PhTag p={p} />
                <span className="row">
                  <a className="btn btn-ghost btn-sm" href={hrefFor('lessons', { id: lessonIdFor(p, LESSONS) })}>
                    <Icon icon={BookOpen} size={15} />
                    Bài học
                  </a>
                  <a className="btn btn-ghost btn-sm" href={hrefFor('dictation', { focus: p })}>
                    <Icon icon={PencilLine} size={15} />
                    Chép chính tả
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
