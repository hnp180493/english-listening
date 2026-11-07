import { useMemo } from 'react';
import { ArrowRight, Check, Info, TriangleAlert, Volume2, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PhDot } from '../../components/PhTag';
import { checkSentence, type CheckupResult } from '../../core/benchmark';
import { hrefFor } from '../../core/nav';
import type { BenchmarkForm } from '../../data/benchmarkTypes';
import AiExplain from '../ai/AiExplain';
import { safeDecode } from '../dictation/decodeCache';
import DiffView from '../dictation/DiffView';
import { comparisonFor, comparisonSummary, dateVi, durationVi, phenomenonRows, weakestPhenomenon } from './checkupModel';
import { useCheckupAudio, type CheckupAudio } from './useCheckupAudio';

/** "Mất âm H" → "mất âm H" (inside "Luyện …"); "T bật (giọng Mỹ)" keeps its capital letter. */
function practiceLabel(label: string): string {
  return /^\p{Lu}\p{Ll}/u.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}

function Replay({ audio, id, lines }: { audio: CheckupAudio; id: string; lines: readonly string[] }) {
  const on = audio.playing === id;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => (on ? audio.stop() : void audio.play(id, lines))}
      disabled={!audio.canSpeak}
      aria-pressed={on}
    >
      <Icon icon={Volume2} size={15} />
      {on ? 'Dừng' : 'Nghe lại'}
    </button>
  );
}

export default function CheckupResultView({
  result,
  results,
  form,
  justFinished,
  saveFailed,
  onBack,
}: {
  result: CheckupResult;
  results: readonly CheckupResult[];
  form: BenchmarkForm | null;
  justFinished: boolean;
  saveFailed: boolean;
  onBack: () => void;
}) {
  const audio = useCheckupAudio();
  const info = useMemo(() => comparisonFor(results, result.id), [results, result.id]);
  const cmp = info?.cmp ?? null;
  const rows = useMemo(() => phenomenonRows(result, cmp), [result, cmp]);
  const missedRows = rows.filter((r) => r.missed > 0);
  const cleanRows = rows.filter((r) => r.missed === 0);
  const weakest = weakestPhenomenon(result);
  const weakRow = rows.find((r) => r.p === weakest) ?? null;
  const baseline = !cmp || cmp.isBaseline;
  const prev = info?.prev ?? null;
  const first = info?.first ?? null;
  const showPrev = !!prev && !!first && prev.id !== first.id;

  const sentences = useMemo(() => {
    if (!form) return [];
    return form.sentences.map((s) => {
      const item = result.dictation.items.find((i) => i.id === s.id);
      const check = checkSentence(s, item?.typed ?? '', item?.plays ?? 0);
      return { s, item, check };
    });
  }, [form, result]);

  const reportHref = hrefFor('stats', { view: 'report' });

  return (
    <>
      <section className="card ck-score" aria-labelledby="ck-score-title">
        <p className="meta">
          {justFinished ? 'Vừa xong' : dateVi(result.at)} · Đề {result.form} · làm trong {durationVi(result.durationSec)}
        </p>
        <h2 id="ck-score-title" className="ck-score-line">
          <span className="ck-score-num tabular">{result.score}</span>
          <span className="ck-score-unit">/100 điểm</span>
        </h2>
        <p className="ck-score-cmp">{info ? comparisonSummary(info) : ''}</p>

        <dl className="ck-parts-res">
          <div>
            <dt>Chép chính tả</dt>
            <dd className="tabular">{result.dictation.pct}%</dd>
            <dd className="meta">
              {result.dictation.correct}/{result.dictation.words} từ đúng
              {result.dictation.extra > 0 ? ` · thừa ${result.dictation.extra}` : ''}
            </dd>
          </div>
          <div>
            <dt>Nghe hiểu</dt>
            <dd className="tabular">
              {result.comprehension.correct}/{result.comprehension.total}
            </dd>
            <dd className="meta">câu trả lời đúng</dd>
          </div>
        </dl>

        {!baseline && cmp?.voiceChanged && (
          <div className="callout">
            <Icon icon={Info} size={16} />
            <div>Giọng đọc lần này khác với lần trước, nên so sánh điểm chỉ mang tính tham khảo.</div>
          </div>
        )}
        {saveFailed && (
          <div className="callout callout-warn" role="alert">
            <Icon icon={TriangleAlert} size={16} />
            <div>Không lưu được kết quả vào bộ nhớ của trình duyệt. Kết quả chỉ còn đến khi bạn đóng trang.</div>
          </div>
        )}

        <div className="ck-score-actions">
          {weakest && weakRow ? (
            <a className="btn btn-primary btn-lg" href={hrefFor('dictation', { focus: weakest })}>
              Luyện {practiceLabel(weakRow.label)}
              <Icon icon={ArrowRight} size={17} />
            </a>
          ) : (
            <a className="btn btn-primary btn-lg" href={reportHref}>
              Xem báo cáo tiến bộ
              <Icon icon={ArrowRight} size={17} />
            </a>
          )}
          {weakest && (
            <a className="btn btn-soft btn-lg" href={reportHref}>
              Xem báo cáo
            </a>
          )}
        </div>
      </section>

      {!baseline && first && cmp && (
        <section className="stack">
          <h2 className="section-title">So với các lần trước</h2>
          <div className="card ck-cmp-card">
            <table className="ck-cmp">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Mục</span>
                  </th>
                  <th scope="col">
                    Lần đầu<span className="ck-cmp-date">{dateVi(first.at).slice(0, 5)}</span>
                  </th>
                  {showPrev && prev && (
                    <th scope="col">
                      Lần trước<span className="ck-cmp-date">{dateVi(prev.at).slice(0, 5)}</span>
                    </th>
                  )}
                  <th scope="col">
                    Lần này<span className="ck-cmp-date">{dateVi(result.at).slice(0, 5)}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Điểm</th>
                  <td>{first.score}</td>
                  {showPrev && prev && <td>{prev.score}</td>}
                  <td className="ck-cmp-now">{result.score}</td>
                </tr>
                <tr>
                  <th scope="row">Chép chính tả</th>
                  <td>{first.dictation.pct}%</td>
                  {showPrev && prev && <td>{prev.dictation.pct}%</td>}
                  <td className="ck-cmp-now">{result.dictation.pct}%</td>
                </tr>
                <tr>
                  <th scope="row">Nghe hiểu</th>
                  <td>
                    {first.comprehension.correct}/{first.comprehension.total}
                  </td>
                  {showPrev && prev && (
                    <td>
                      {prev.comprehension.correct}/{prev.comprehension.total}
                    </td>
                  )}
                  <td className="ck-cmp-now">
                    {result.comprehension.correct}/{result.comprehension.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Chỗ hay nghe sai</h2>
          <div className="card ck-ph-card">
            <p className="meta">Số câu có hiện tượng đó mà bạn nghe sai ít nhất một từ ở chỗ ấy.</p>
            {missedRows.length > 0 && (
              <ul className="ck-ph">
                {missedRows.map((r) => (
                  <li key={r.p} className="ck-ph-row">
                    <span className="ck-ph-name">
                      <PhDot p={r.p} />
                      {r.label}
                    </span>
                    <span className="ck-ph-val tabular">
                      sai {r.missed}/{r.seen} câu
                    </span>
                    <span className="progress ck-ph-bar" aria-hidden="true">
                      <span style={{ width: `${r.missPct}%` }} />
                    </span>
                    {r.firstMissPct !== null && r.firstMissPct !== r.missPct && (
                      <span className="ck-ph-first meta">
                        Lần đầu sai {r.firstMissPct}%, lần này {r.missPct}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {cleanRows.length > 0 && (
              <p className="ck-ph-clean">
                <Icon icon={Check} size={15} strokeWidth={2.5} />
                <span>
                  Nghe đúng hết: {cleanRows.map((r) => r.label).join(', ')}.
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      {form && (
        <section className="stack">
          <h2 className="section-title">Xem lại từng câu</h2>
          <div className="ck-review">
            {sentences.map(({ s, item, check }, k) => {
              const ok = check.item.totalWords > 0 && check.item.correctWords === check.item.totalWords && check.item.extraWords === 0;
              return (
                <details key={s.id} className="ck-rev">
                  <summary>
                    <span className={'ck-rev-mark' + (ok ? ' is-ok' : ' is-bad')} aria-label={ok ? 'Đúng hết' : 'Có lỗi'}>
                      <Icon icon={ok ? Check : X} size={15} strokeWidth={2.5} />
                    </span>
                    <span className="ck-rev-text">
                      <span className="ck-rev-n">Câu {k + 1}.</span> <span lang="en">{s.text}</span>
                    </span>
                    <span className="meta ck-rev-score tabular">
                      {check.item.correctWords}/{check.item.totalWords}
                    </span>
                  </summary>
                  <div className="ck-rev-body">
                    {item?.typed.trim() ? (
                      <p className="meta">
                        Bạn gõ: <span lang="en">“{item.typed}”</span>
                      </p>
                    ) : (
                      <p className="meta">Bạn để trống câu này.</p>
                    )}
                    <DiffView units={check.units} vi={s.vi} />
                    {!ok && !!item?.typed.trim() && (
                      <AiExplain text={s.text} typed={item.typed} units={check.units} annotations={safeDecode(s.text).annotations} />
                    )}
                    <div className="row">
                      <Replay audio={audio} id={s.id} lines={[s.text]} />
                      <span className="meta">Lúc làm bài nghe {item?.plays ?? 0} lần</span>
                    </div>
                  </div>
                </details>
              );
            })}

            {form.questions.map((q, k) => {
              const a = result.comprehension.items.find((i) => i.id === q.id);
              const chosen = a?.chosen ?? null;
              const ok = chosen === q.answer;
              return (
                <details key={q.id} className="ck-rev">
                  <summary>
                    <span className={'ck-rev-mark' + (ok ? ' is-ok' : ' is-bad')} aria-label={ok ? 'Đúng' : 'Sai'}>
                      <Icon icon={ok ? Check : X} size={15} strokeWidth={2.5} />
                    </span>
                    <span className="ck-rev-text">
                      <span className="ck-rev-n">Đoạn {k + 1}.</span> {q.question}
                    </span>
                  </summary>
                  <div className="ck-rev-body">
                    <div className="panel ck-transcript" lang="en">
                      {q.lines.map((l, i) => (
                        <p key={i}>{l}</p>
                      ))}
                    </div>
                    <ul className="ck-answers">
                      {!ok && (
                        <li className="ck-ans-bad">
                          <Icon icon={X} size={15} strokeWidth={2.5} />
                          <span>Bạn chọn: {chosen === null ? 'chưa chọn' : (q.options[chosen] ?? 'chưa chọn')}</span>
                        </li>
                      )}
                      <li className="ck-ans-ok">
                        <Icon icon={Check} size={15} strokeWidth={2.5} />
                        <span>Đáp án: {q.options[q.answer]}</span>
                      </li>
                    </ul>
                    <p className="ck-why">{q.why}</p>
                    <div className="row">
                      <Replay audio={audio} id={q.id} lines={q.lines} />
                      <span className="meta">Lúc làm bài nghe {a?.plays ?? 0} lần</span>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      <div className="ck-foot">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Về trang kiểm tra
        </button>
      </div>
    </>
  );
}
