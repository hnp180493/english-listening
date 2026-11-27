// Stopped by Westbay's police (docs/town.md §28): no chase that ends in a crash, no game over. The officer says what
// was done and asks one question; the learner answers by what they mean (three Vietnamese intents, keys 1–3, as a
// job's answers: ../jobs/JobIntents.tsx). Answering the question that was asked gets a smaller fine; another answer,
// the full one (30–120 xu by the heat, never more than the learner has: core/town/police.ts fineFor). The fine is
// paid through town-progress (core/town/progress.ts addFine), the heat goes back to zero. One primary button.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ShieldAlert, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { useShortcuts } from '../../../components/useShortcuts';
import { tl } from '../../../i18n';
import { balance } from '../../../core/town/economy';
import { fineFor } from '../../../core/town/police';
import { addFine } from '../../../core/town/progress';
import { officerScene, type ScanLine } from '../../../core/town/scanner';
import { commitTown, loadTownProgress, townDevice } from '../../../core/town/store';
import { Coin } from '../art';
import { setHeat } from '../jobs/heatStore';
import { usePanelKeys } from '../panelKeys';
import { hushScan, sayScan } from './scannerVoice';
import { streets, type Stop } from './streetsStore';
import './streets.css';

export default function StopPanel({ stop }: { stop: Stop }) {
  const scene = useMemo(() => officerScene(stop.facts, stop.id), [stop]);
  const [picked, setPicked] = useState<number | null>(null);
  const [fine, setFine] = useState<number | null>(null);
  /** The fine before the cap on the learner's xu (fineFor: never more than 40 % of what they have). */
  const [due, setDue] = useState(0);
  const boxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
    void sayScan([scene.open, scene.question]);
    return () => hushScan();
  }, [scene]);
  const replay = (slow: boolean) => {
    void sayScan(picked === null ? [scene.open, scene.question] : [picked === scene.answer ? scene.right : scene.wrong, scene.bye], slow);
    return true;
  };
  useShortcuts({ replay: () => replay(false), slow: () => replay(true) }, { root: boxRef });
  const done = () => {
    hushScan();
    streets.endStop();
  };
  usePanelKeys(boxRef, () => (picked !== null ? done() : undefined));

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const right = i === scene.answer;
    let paid = 0;
    try {
      const progress = loadTownProgress();
      paid = fineFor(stop.heat, right, balance(progress));
      setDue(fineFor(stop.heat, right, Number.MAX_SAFE_INTEGER));
      if (paid > 0) commitTown(addFine(progress, townDevice(), paid));
    } catch {
      paid = 0;
    }
    setFine(paid);
    setHeat(0);
    void sayScan([right ? scene.right : scene.wrong, scene.bye]);
  };
  useEffect(() => {
    if (picked !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= scene.intents.length) {
        e.preventDefault();
        pick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const line = (l: ScanLine, key: string) => (
    <li key={key} className="str-stop-line">
      <span className="str-who">{l.who === 'you' ? 'Bạn' : 'Cảnh sát'}</span>
      <span lang="en">{l.text}</span>
      <span className="str-vi">
        {l.vi}
      </span>
    </li>
  );
  const right = picked !== null && picked === scene.answer;
  return (
    <aside ref={boxRef} className="town-build town-activity-sheet str-stop" role="dialog" aria-label="Cảnh sát dừng xe" tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">
          <Icon icon={ShieldAlert} size={18} /> Cảnh sát dừng bạn lại
        </h2>
      </header>
      <div className="town-build-body town-activity-body">
        <p className="town-build-hint">Xe tuần tra đã bắt kịp. Nghe cảnh sát hỏi gì rồi trả lời đúng câu được hỏi.</p>
        <button type="button" className="btn btn-ghost btn-sm str-stop-again" onClick={() => replay(false)}>
          <Icon icon={Volume2} size={15} />
          Nghe lại
        </button>
        {picked === null ? (
          <div className="job-intents str-intents">
            {scene.intents.map((o, i) => (
              <button key={o.say.text} type="button" className="town-reply job-intent" onClick={() => pick(i)}>
                <span className="town-reply-key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="town-reply-text">{o.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className={'str-verdict' + (right ? ' is-right' : ' is-wrong')}>
              <Icon icon={right ? Check : X} size={16} />
              {right ? 'Bạn trả lời đúng câu được hỏi: phạt nhẹ hơn.' : 'Câu trả lời không khớp câu hỏi: phạt đủ mức.'}
            </p>
            <p className="str-fine">
              {fine && fine > 0 ? (
                <>
                  <Coin size={18} /> <span className="tabular">{tl`Tiền phạt: ${fine} xu`}</span>
                </>
              ) : (
                'Bạn không còn xu nào để nộp phạt.'
              )}
            </p>
            {fine !== null && fine < due && <p className="town-build-hint">{tl`Mức phạt là ${due} xu, nhưng không bao giờ quá 40% số xu bạn đang có.`}</p>}
            <ol className="str-lines">
              {line(scene.open, 'open')}
              {line(scene.question, 'q')}
              {line(scene.intents[picked].say, 'you')}
              {line(right ? scene.right : scene.wrong, 'reply')}
            </ol>
            <p className="town-build-hint">Độ nóng về 0. Xu và tiền phạt là điểm trò chơi, không đo trình độ.</p>
            <div className="town-talk-foot">
              <button type="button" className="btn btn-primary" onClick={done} autoFocus>
                Đi tiếp
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
