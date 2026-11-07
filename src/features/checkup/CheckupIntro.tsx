import { useState } from 'react';
import { ChevronRight, CircleHelp, Headphones, PencilLine, VolumeX } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { CHECKUP_CADENCE_DAYS, checkupDue, MAX_PLAYS, RETAKE_WINDOW_DAYS, shortVoiceName, type CheckupResult } from '../../core/benchmark';
import { hrefFor } from '../../core/nav';
import { ttsSupported } from '../../core/tts';
import type { BenchmarkForm } from '../../data/benchmarkTypes';
import { dateVi } from './checkupModel';

const SHOWN = 6;

export default function CheckupIntro({
  form,
  results,
  voiceName,
  onStart,
  onShowResult,
}: {
  form: BenchmarkForm | null;
  results: readonly CheckupResult[];
  voiceName: string | null;
  onStart: () => void;
  onShowResult: (id: string) => void;
}) {
  const canSpeak = ttsSupported();
  const [now] = useState(() => Date.now());
  const due = checkupDue(results, now, true);
  const recent = [...results].sort((a, b) => b.at - a.at).slice(0, SHOWN);
  const tooSoon = due.kind === null && due.daysSince !== null && due.daysSince < CHECKUP_CADENCE_DAYS;
  // A retake within a week is not counted in the report's trend: ask once before starting it.
  const retake = due.daysSince !== null && due.daysSince < RETAKE_WINDOW_DAYS;
  const [confirmRetake, setConfirmRetake] = useState(false);
  const voice = shortVoiceName(voiceName);

  return (
    <>
      <section className="card ck-intro" aria-labelledby="ck-intro-title">
        <div className="ck-intro-head">
          <h2 id="ck-intro-title">{results.length ? 'Kiểm tra lại' : 'Bài kiểm tra đầu vào'}</h2>
          {form && <span className="meta">Đề {form.id} · khoảng 10 phút</span>}
        </div>

        <ul className="ck-parts">
          <li>
            <span className="ck-parts-icon" aria-hidden="true">
              <Icon icon={PencilLine} size={18} />
            </span>
            <span>
              <b>Phần 1 · Chép chính tả.</b> Nghe 10 câu, gõ lại.
            </span>
          </li>
          <li>
            <span className="ck-parts-icon" aria-hidden="true">
              <Icon icon={Headphones} size={18} />
            </span>
            <span>
              <b>Phần 2 · Nghe hiểu.</b> 4 đoạn ngắn, mỗi đoạn một câu hỏi.
            </span>
          </li>
        </ul>

        <ul className="ck-rules">
          <li>Tốc độ tự nhiên, không có nghe chậm, không có gợi ý.</li>
          <li>Mỗi câu, mỗi đoạn nghe tối đa {MAX_PLAYS} lần.</li>
          <li>Không nghe ra thì gõ phần nghe được, hoặc để trống.</li>
        </ul>

        {!canSpeak && (
          <div className="callout callout-warn" role="alert">
            <Icon icon={VolumeX} size={16} />
            <div>Trình duyệt này không có giọng đọc tiếng Anh. Hãy dùng Chrome, Edge hoặc Safari bản mới.</div>
          </div>
        )}
        {tooSoon && due.daysSince !== null && due.nextDueAt !== null && (
          <p className="meta ck-intro-note">
            Lần gần nhất cách đây {due.daysSince === 0 ? 'chưa tới 1 ngày' : `${due.daysSince} ngày`}. Nên làm cách nhau khoảng 2 tuần (từ{' '}
            {dateVi(due.nextDueAt)}) để thấy rõ thay đổi.
          </p>
        )}

        {confirmRetake ? (
          <div className="callout callout-warn ck-retake" role="alert">
            <div className="stack-sm">
              <span>
                Bạn vừa làm bài cách đây chưa tới {RETAKE_WINDOW_DAYS} ngày. Làm lại sớm như vậy sẽ không được tính vào xu hướng trong báo cáo, vì điểm
                lần sau dễ cao hơn nhờ quen bài.
              </span>
              <span className="row">
                <button type="button" className="btn btn-sm" onClick={onStart}>
                  Vẫn làm bài
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRetake(false)}>
                  Để sau
                </button>
              </span>
            </div>
          </div>
        ) : (
          <div className="ck-intro-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => (retake ? setConfirmRetake(true) : onStart())}
              disabled={!canSpeak || !form}
            >
              Bắt đầu
            </button>
            {voice && <span className="meta ck-voice">Giọng: {voice}</span>}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="stack">
          <div className="row-between">
            <h2 className="section-title">Các lần trước</h2>
            <a className="btn btn-ghost btn-sm" href={hrefFor('stats', { view: 'report' })}>
              Xem báo cáo
            </a>
          </div>
          <ul className="list-rows">
            {recent.map((r) => (
              <li key={r.id}>
                <button type="button" className="list-row ck-past" onClick={() => onShowResult(r.id)}>
                  <span className="list-row-lead tabular">{r.score}</span>
                  <span className="list-row-body">
                    <span className="list-row-title">
                      <span className="list-row-text">
                        {dateVi(r.at)} · Đề {r.form}
                      </span>
                    </span>
                    <span className="list-row-meta">
                      Chép chính tả {r.dictation.pct}% · nghe hiểu {r.comprehension.correct}/{r.comprehension.total}
                    </span>
                  </span>
                  <span className="list-row-end">
                    <Icon icon={ChevronRight} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="how" open={results.length === 0}>
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Vì sao nên kiểm tra định kỳ?
        </summary>
        <div className="stack-sm prose ck-how">
          <p>
            Luyện hằng ngày khó thấy mình tiến bộ. Cứ khoảng 2 tuần làm một bài ngắn với câu mới (không có trong phần luyện), bạn có một con số để so
            sánh với chính mình.
          </p>
          <p>
            Điểm = 60% số từ chép đúng + 40% số câu hỏi trả lời đúng. Có 6 đề tương đương (A–F), mỗi lần làm đề lâu chưa gặp nhất để không nhớ đáp án.
          </p>
          <p>
            Nên dùng cùng một giọng đọc cho mọi lần (lần này: {voice ?? 'giọng mặc định'}): đổi giọng thì điểm khó so sánh. Mỗi câu nghe hiểu là 10
            điểm, nên chênh khoảng 10 điểm giữa hai lần có thể chỉ do đề; cần vài lần mới thấy xu hướng. Bài kiểm tra không tính vào lượt luyện hay
            lịch ôn tập.
          </p>
        </div>
      </details>
    </>
  );
}
