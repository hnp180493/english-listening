// Beat 4 (core/town/job.ts): the outcome and the words. The grade (a game score), what went wrong, the notebook
// against what Rico really said, how often the briefing was heard, then every line said in this run with its meaning,
// "Nghe" (connected) and "Rõ từng từ" (careful), the lines missed marked (they are in Ôn tập now). Bay FM's news about
// what the learner just did comes last, worded by how it ended.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Radio, RotateCcw, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL } from '../../../core/playback';
import { jobProblems, type JobLine, type JobScript, type NoteKey } from '../../../core/town/job';
import { jobSpeakerName } from '../../../core/town/jobVoice';
import { tl } from '../../../i18n';
import { Coin, SoundBars } from '../art';
import { safeDecode } from '../../dictation/decodeCache';
import { usePanelKeys } from '../panelKeys';
import type { JobState, SaidJobLine } from './useCityJob';
import { GRADE_NAME, GRADE_NOTE, PROBLEM_NAME } from './jobText';

export interface JobDebriefProps {
  job: JobScript;
  state: JobState;
  wrongNotes: readonly NoteKey[];
  answerOf: (key: NoteKey) => string;
  pickOf: (key: NoteKey) => string;
  sound: boolean;
  say: (line: JobLine, careful: boolean) => Promise<void>;
  /** Play Bay FM's news (its lines go into the run's words too). */
  news: (ids: readonly string[]) => Promise<boolean>;
  lineOf: (id: string) => SaidJobLine;
  onAgain: () => void;
  onClose: () => void;
}

/** One fact: right or not, how many times it was heard (honestly: "nghe 1 lần" only when it was). */
function Fact({ ok, label, times, children }: { ok: boolean; label: string; times: number; children: ReactNode }) {
  return (
    <li className={'job-notes-row' + (ok ? ' is-right' : ' is-wrong')}>
      <Icon icon={ok ? Check : X} size={15} />
      <span className="job-notes-label">
        {label}
        <span className="job-note-count">{times === 0 ? 'chưa nghe được' : times === 1 ? 'nghe 1 lần' : tl`nghe ${times} lần`}</span>
      </span>
      <span className="job-notes-val">{children}</span>
    </li>
  );
}

function Said({ said, missed, say }: { said: SaidJobLine; missed: boolean; say: JobDebriefProps['say'] }) {
  const decoded = useMemo(() => safeDecode(said.line.text), [said.line.text]);
  return (
    <li className={'town-ls-line' + (missed ? ' job-missed' : '')}>
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

export default function JobDebrief({ job, state, wrongNotes, answerOf, pickOf, say, news, lineOf, onAgain, onClose }: JobDebriefProps) {
  const boxRef = useRef<HTMLElement>(null);
  usePanelKeys(boxRef, onClose);
  const grade = state.grade ?? 'broken';
  const problems = state.run ? jobProblems(state.run) : [];
  const missed = new Set(state.missed);
  const tape = state.password !== 'none';
  const newsIds = !tape ? job.news.none : grade === 'clean' ? job.news.clean : job.news.messy;
  const [onAir, setOnAir] = useState<'no' | 'playing' | 'done'>('no');
  // the news is not part of the job's words (it is about them): shown once heard
  const newsLines = newsIds.map(lineOf);
  const words = state.log.filter((l) => !newsIds.some((id) => lineOf(id).ref === l.ref));
  const playNews = async () => {
    setOnAir('playing');
    await news(newsIds);
    setOnAir('done');
  };

  return (
    <aside ref={boxRef} className="town-build town-activity-sheet job-sheet city-scene-sheet" role="dialog" aria-label={tl`Phi vụ: ${job.title}`} tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">{tl`Phi vụ: ${job.title}`}</h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body town-activity-body">
        <div className={'job-grade is-' + grade}>
          <p className="job-grade-name">
            {GRADE_NAME[grade]}
            {state.xu > 0 && (
              <span className="town-gain">
                <Coin size={16} />+{state.xu}
              </span>
            )}
          </p>
          <p className="job-grade-note">{GRADE_NOTE[grade]}</p>
        </div>
        {problems.length > 0 ? (
          <ul className="job-problems">
            {problems.map((p) => (
              <li key={p}>{PROBLEM_NAME[p]}</li>
            ))}
          </ul>
        ) : (
          <p className="town-build-hint">Không có sai sót nào.</p>
        )}

        <h3 className="town-ls-sub">Từng ý bạn nghe</h3>
        <ul className="job-notes">
          {job.notebook.map((e) => {
            const wrong = wrongNotes.includes(e.key);
            return (
              <Fact key={e.key} ok={!wrong} label={e.label} times={state.heard[e.key] ?? 0}>
                {wrong ? (
                  <>
                    {tl`Bạn ghi: ${pickOf(e.key) || '—'}`} · {tl`Rico nói: ${answerOf(e.key)}`}
                  </>
                ) : (
                  pickOf(e.key)
                )}
              </Fact>
            );
          })}
          {job.junctions
            .filter((j) => (state.heard[j.id] ?? 0) > 0)
            .map((j) => (
              <Fact key={j.id} ok={!state.wrongAt.includes(j.id)} label={tl`Ngã rẽ ${j.name}`} times={state.heard[j.id] ?? 0}>
                {state.wrongAt.includes(j.id) ? 'Chọn sai đường lần đầu' : 'Chọn đúng đường'}
              </Fact>
            ))}
          <Fact ok={state.password === 'first'} label="Mật khẩu (nghe lén)" times={state.heard.password ?? 0}>
            {state.password === 'first' ? 'Gõ đúng ngay' : state.password === 'helped' ? 'Gõ đúng sau gợi ý' : 'Không nói được'}
          </Fact>
        </ul>
        <p className="town-build-hint">
          {state.enrolled > 0 && tl`${state.enrolled} câu nghe hụt đã vào Ôn tập.`} {state.asks > 0 && tl`Xin ông khách nhắc lại ${state.asks} lần.`}
        </p>
        <p className="town-build-hint">Hạng và xu là điểm trò chơi, không đo trình độ. Người Westbay nói bằng giọng của trình duyệt, ít nối âm hơn người thật.</p>

        <h3 className="town-ls-sub">Họ đã nói gì</h3>
        <ol className="town-ls-lines">
          {words.map((l) => (
            <Said key={l.ref} said={l} missed={missed.has(l.ref)} say={say} />
          ))}
        </ol>

        <h3 className="town-ls-sub">
          <Icon icon={Radio} size={16} /> Bay FM tối nay
        </h3>
        {onAir === 'done' ? (
          <ol className="town-ls-lines">
            {newsLines.map((l) => (
              <Said key={l.ref} said={l} missed={false} say={say} />
            ))}
          </ol>
        ) : (
          <p className="job-strip-hear">
            <SoundBars on={onAir === 'playing'} />
            {onAir === 'playing' ? 'Marcus đang đọc tin… chỉ nghe thôi.' : 'Marcus có một bản tin về chuyện bạn vừa làm.'}
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
