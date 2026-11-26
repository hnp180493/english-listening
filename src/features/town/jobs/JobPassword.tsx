// Beat 3's last check (core/town/job.ts): the password, TYPED as it was heard (judged as Chép chính tả judges a blank:
// core/town/typing.ts judgeTyped). Right at once, or after one hinted try when the first was close; otherwise Gus
// keeps the tape. The job goes on to its end either way.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import type { JobRun, JobScript } from '../../../core/town/job';
import type { TypedJudge } from '../../../core/town/typing';
import { cityPerson } from '../../../core/town/cityPeople';
import { tl } from '../../../i18n';
import { usePanelKeys } from '../panelKeys';

export interface JobPasswordProps {
  job: JobScript;
  say: (ids: readonly string[]) => Promise<boolean>;
  judge: (answer: string) => TypedJudge;
  onDone: (password: JobRun['password']) => void;
  /** Back to listening (not ready yet). */
  onClose: () => void;
}

export default function JobPassword({ job, say, judge, onDone, onClose }: JobPasswordProps) {
  const boxRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  usePanelKeys(boxRef, onClose);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const who = cityPerson(job.password.who)?.name ?? job.password.who;
  useEffect(() => {
    void say([job.password.ask]);
    inputRef.current?.focus({ preventScroll: true });
    // (once, when the sheet opens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (over || !answer.trim()) return;
    const v = judge(answer);
    if (v.correct) {
      setOver(true);
      await say([job.password.right]);
      onDone(hint ? 'helped' : 'first');
    } else if (v.verdict === 'close' && !hint) {
      setHint(v.hint);
      setAnswer('');
      await say([job.password.close]);
      inputRef.current?.focus();
    } else {
      setOver(true);
      await say([job.password.wrong]);
      onDone('none');
    }
  };

  return (
    <aside ref={boxRef} className="town-build town-activity-sheet job-sheet" role="dialog" aria-label={tl`Nói mật khẩu với ${who}`} tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">
          <Icon icon={KeyRound} size={18} /> {tl`Nói mật khẩu với ${who}`}
        </h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Nghe thêm đã" title="Nghe thêm đã (Esc)" disabled={over}>
          <Icon icon={X} size={18} />
        </button>
      </header>
      <form className="town-build-body town-activity-body" onSubmit={(e) => void submit(e)}>
        <p className="town-build-hint">Gõ đúng cụm từ bạn nghe được. Chưa chắc thì đóng lại, đi nghe thêm.</p>
        <input
          ref={inputRef}
          className="input job-pass-input"
          lang="en"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Mật khẩu"
          aria-label="Mật khẩu"
          disabled={over}
        />
        {hint && (
          <p className="job-pass-hint">
            {tl`Gần đúng. Gợi ý: ${hint}`}
          </p>
        )}
        <div className="town-talk-foot">
          <button type="submit" className="btn btn-primary" disabled={over || !answer.trim()}>
            Nói
            <Icon icon={ArrowRight} size={16} />
          </button>
        </div>
      </form>
    </aside>
  );
}
