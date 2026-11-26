// Beat 4 (core/town/jobDoc.ts): the outcome and the words, for any job. The grade (a game score, how many consequences
// were hit), each consequence with how the story went on, each fact with how many times it was heard ("nghe 1 lần"
// only when it was), then every line said in this run with its meaning, "Nghe" (connected) and "Rõ từng từ"
// (careful), the lines missed marked (they are in Ôn tập now). The news about what the learner just did comes last.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Radio, RotateCcw, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL } from '../../../core/playback';
import { clockOf, noteAnswer, type JobLine } from '../../../core/town/job';
import type { Said, Step } from '../../../core/town/jobDoc';
import { jobSpeakerName } from '../../../core/town/jobVoice';
import { tl } from '../../../i18n';
import { Coin, SoundBars } from '../art';
import { safeDecode } from '../../dictation/decodeCache';
import { usePanelKeys } from '../panelKeys';
import type { JobRunState, SaidJobLine } from './useCityJob';
import { GRADE_NAME, GRADE_NOTE } from './jobText';

export interface JobDebriefProps {
  run: JobRunState;
  sound: boolean;
  say: (line: JobLine, careful: boolean) => Promise<void>;
  /** Play the news (its lines go into the run's words too). */
  news: (ids: readonly string[]) => Promise<boolean>;
  /** The lines of a list said now (by the run's conditions). */
  newsNow: (list: readonly Said[]) => string[];
  lineOf: (id: string) => SaidJobLine;
  onAgain: () => void;
  onClose: () => void;
}

/** One fact: right or not, how many times it was heard (honestly: "nghe 1 lần" only when it was). */
function Fact({ ok, label, times, children }: { ok: boolean; label: string; times: number | null; children: ReactNode }) {
  return (
    <li className={'job-notes-row' + (ok ? ' is-right' : ' is-wrong')}>
      <Icon icon={ok ? Check : X} size={15} />
      <span className="job-notes-label">
        {label}
        {times !== null && <span className="job-note-count">{times === 0 ? 'chưa nghe được' : times === 1 ? 'nghe 1 lần' : tl`nghe ${times} lần`}</span>}
      </span>
      <span className="job-notes-val">{children}</span>
    </li>
  );
}

function SaidLine({ said, missed, say }: { said: SaidJobLine; missed: boolean; say: JobDebriefProps['say'] }) {
  const decoded = useMemo(() => safeDecode(said.line.text), [said.line.text]);
  const own = said.line.who === 'player';
  return (
    <li className={'town-ls-line' + (missed ? ' job-missed' : '') + (own ? ' job-own' : '')}>
      <span className="town-ls-line-who">
        {jobSpeakerName(said.line.who)}
        {missed && <span className="job-missed-tag">Nghe hụt · đã vào Ôn tập</span>}
      </span>
      {decoded.tokens.length > 0 ? (
        <SpokenSentence result={decoded} compact />
      ) : (
        <p className="town-ls-en" lang="en">
          {said.line.text}
        </p>
      )}
      <p className="town-ls-vi" data-vi>
        {said.line.vi}
      </p>
      <div className="town-ls-line-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void say(said.line, false)}>
          <Icon icon={Volume2} size={15} />
          Nghe
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void say(said.line, true)}>
          <Icon icon={Turtle} size={15} />
          {CAREFUL_LABEL}
        </button>
      </div>
    </li>
  );
}

export default function JobDebrief({ run, say, news, newsNow, lineOf, onAgain, onClose }: JobDebriefProps) {
  const boxRef = useRef<HTMLElement>(null);
  usePanelKeys(boxRef, onClose);
  const doc = run.doc;
  const grade = run.grade ?? 'broken';
  const hits = run.hits.filter((h) => Object.hasOwn(doc.consequences, h));
  const missed = new Set(run.missed);
  const failed = !!doc.failed && run.hits.includes(doc.failed);
  const newsIds = newsNow(failed && doc.news.none ? doc.news.none : doc.news[grade]);
  const [onAir, setOnAir] = useState<'no' | 'playing' | 'done'>('no');
  const newsRefs = new Set(newsIds.map((id) => lineOf(id).ref));
  const words = run.log.filter((l) => !newsRefs.has(l.ref));
  const playNews = async () => {
    setOnAir('playing');
    await news(newsIds);
    setOnAir('done');
  };

  const notebook = doc.steps.find((s): s is Extract<Step, { kind: 'notebook' }> => s.kind === 'notebook');
  const labelOf = (key: string, value: string | undefined): string => {
    if (value === undefined) return '—';
    if (key === 'time') return clockOf(Number(value));
    return notebook?.entries.find((e) => e.key === key)?.options.find((o) => o.value === value)?.label ?? value;
  };
  const junctions = doc.steps.flatMap((s) => (s.kind === 'ride' ? (s.junctions ?? []) : []));
  const word = doc.facts.find((f) => f.id === 'word');
  const checks = doc.facts.filter((f) => Object.hasOwn(run.checks, f.id));

  return (
    <aside ref={boxRef} className="town-build town-activity-sheet job-sheet city-scene-sheet" role="dialog" aria-label={tl`Phi vụ: ${doc.title}`} tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">{tl`Phi vụ: ${doc.title}`}</h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body town-activity-body">
        <div className={'job-grade is-' + grade}>
          <p className="job-grade-name">
            {GRADE_NAME[grade]}
            {run.xu > 0 && (
              <span className="town-gain">
                <Coin size={16} />+{run.xu}
              </span>
            )}
          </p>
          <p className="job-grade-note">{GRADE_NOTE[grade]}</p>
        </div>
        {hits.length > 0 ? (
          <ul className="job-problems">
            {hits.map((h) => (
              <li key={h}>
                {doc.consequences[h].name}
                <span className="job-rejoin">{doc.consequences[h].rejoin}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="town-build-hint">Không có hệ quả nào.</p>
        )}

        <h3 className="town-ls-sub">Từng ý bạn nghe</h3>
        <ul className="job-notes">
          {(notebook?.entries ?? []).map((e) => {
            const value = run.picks[e.key];
            const right = value === noteAnswer(e, run.minute);
            return (
              <Fact key={e.key} ok={right} label={e.label} times={run.heard[e.key] ?? 0}>
                {right ? (
                  labelOf(e.key, value)
                ) : (
                  <>
                    {tl`Bạn ghi: ${labelOf(e.key, value)}`} · {tl`Lời nói là: ${labelOf(e.key, noteAnswer(e, run.minute))}`}
                  </>
                )}
              </Fact>
            );
          })}
          {junctions
            .filter((j) => (run.heard[j.id] ?? 0) > 0)
            .map((j) => (
              <Fact key={j.id} ok={!run.wrongAt.includes(j.id)} label={tl`Ngã rẽ ${j.name}`} times={run.heard[j.id] ?? 0}>
                {run.wrongAt.includes(j.id) ? 'Chọn sai đường lần đầu' : 'Chọn đúng đường'}
              </Fact>
            ))}
          {word && run.password !== null && (
            <Fact ok={run.password === 'first'} label={word.label} times={run.heard.word ?? 0}>
              {run.password === 'first' ? 'Gõ đúng ngay' : run.password === 'helped' ? 'Gõ đúng sau gợi ý' : 'Không nói được'}
            </Fact>
          )}
          {checks.map((f) => (
            <Fact key={f.id} ok={run.checks[f.id]} label={f.label} times={null}>
              {run.checks[f.id] ? 'Trả lời đúng ý' : 'Trả lời sai ý'}
            </Fact>
          ))}
        </ul>
        <p className="town-build-hint">
          {run.enrolled > 0 && tl`${run.enrolled} câu nghe hụt đã vào Ôn tập.`} {run.repeats + run.asks > 0 && tl`Xin nhắc lại ${run.repeats + run.asks} lần.`}
        </p>
        <p className="town-build-hint">Hạng và xu là điểm trò chơi, không đo trình độ. Người Westbay nói bằng giọng của trình duyệt, ít nối âm hơn người thật.</p>

        <h3 className="town-ls-sub">Họ đã nói gì</h3>
        <ol className="town-ls-lines">
          {words.map((l) => (
            <SaidLine key={l.ref} said={l} missed={missed.has(l.ref)} say={say} />
          ))}
        </ol>

        <h3 className="town-ls-sub">
          <Icon icon={Radio} size={16} /> Bay FM tối nay
        </h3>
        {onAir === 'done' ? (
          <ol className="town-ls-lines">
            {newsIds.map((id) => {
              const l = lineOf(id);
              return <SaidLine key={l.ref} said={l} missed={false} say={say} />;
            })}
          </ol>
        ) : (
          <p className="job-strip-hear">
            <SoundBars on={onAir === 'playing'} />
            {onAir === 'playing' ? 'Bay FM đang đọc tin… chỉ nghe thôi.' : 'Bay FM có một bản tin về chuyện bạn vừa làm.'}
          </p>
        )}
        <div className="town-talk-foot">
          {onAir === 'no' && (
            <button type="button" className="btn btn-ghost" onClick={() => void playNews()}>
              <Icon icon={Radio} size={16} />
              Nghe bản tin
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onAgain}>
            <Icon icon={RotateCcw} size={16} />
            Chơi lại
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    </aside>
  );
}
