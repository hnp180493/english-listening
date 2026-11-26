// Beat 1's check (core/town/job.ts): the learner's NOTEBOOK. Each entry offers three look-alike ways to write what Rico
// said; nothing says right or wrong here: the job then leads the learner by what they wrote. Hearing again is allowed
// and counted, per fact: the whole voicemail again (the shared practice keys: replay, slow), or one fact again, a
// little slower ("Xin nhắc lại"). The appointment's clock keeps running meanwhile: that is the cost.

import { useRef } from 'react';
import { ArrowRight, MessageCircleQuestion, NotebookPen, RotateCcw, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { useShortcuts } from '../../../components/useShortcuts';
import type { JobScript, NoteKey, NoteOption } from '../../../core/town/job';
import { tl } from '../../../i18n';
import { SoundBars } from '../art';
import { usePanelKeys } from '../panelKeys';

export interface JobNotebookProps {
  job: JobScript;
  options: (key: NoteKey) => NoteOption[];
  picks: Partial<Record<NoteKey, string>>;
  onPick: (key: NoteKey, value: string) => void;
  /** Times each fact was heard so far. */
  heard: Readonly<Record<string, number>>;
  playing: boolean;
  /** The whole voicemail again (slow: a little slower). */
  onReplay: (slow?: boolean) => void;
  /** One fact again, a little slower. */
  onFact: (key: NoteKey) => void;
  onGo: () => void;
  /** Give the job up. */
  onClose: () => void;
}

export default function JobNotebook({ job, options, picks, onPick, heard, playing, onReplay, onFact, onGo, onClose }: JobNotebookProps) {
  const boxRef = useRef<HTMLElement>(null);
  usePanelKeys(boxRef, onClose);
  useShortcuts({ replay: () => onReplay(false), slow: () => onReplay(true) }, { root: boxRef });
  const done = job.notebook.every((e) => picks[e.key] !== undefined);
  return (
    // (a region, not a dialog: the shared practice keys work in it)
    <aside ref={boxRef} className="town-build town-activity-sheet job-sheet" role="region" aria-label="Sổ tay" tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">
          <Icon icon={NotebookPen} size={18} /> Sổ tay
        </h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Bỏ phi vụ" title="Bỏ phi vụ (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body town-activity-body">
        <p className="town-build-hint">Ghi lại điều bạn nghe được. Không ai báo đúng sai: bạn ghi gì, trò chơi dẫn bạn đi theo đúng cái đó. Nghe lại được, nhưng lần nào cũng được đếm, và đồng hồ hẹn vẫn chạy.</p>
        {job.notebook.map((e) => (
          <fieldset key={e.key} className="job-note">
            <legend className="job-note-label">
              {e.label}
              <span className="job-note-count">{(heard[e.key] ?? 0) <= 1 ? 'nghe 1 lần' : tl`nghe ${heard[e.key]} lần`}</span>
            </legend>
            <div className="job-note-opts">
              {options(e.key).map((o) => (
                <button key={o.value} type="button" className="town-reply job-note-opt" aria-pressed={picks[e.key] === o.value} onClick={() => onPick(e.key, o.value)}>
                  <span className="town-reply-text">{o.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm job-note-again" onClick={() => onFact(e.key)}>
              <Icon icon={MessageCircleQuestion} size={15} />
              Xin nhắc lại
            </button>
          </fieldset>
        ))}
        <p className="job-note-plays">
          <SoundBars on={playing} />
          {playing ? 'Rico đang nói…' : 'Chưa chắc chỗ nào thì xin nhắc lại đúng chỗ đó.'}
        </p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-ghost" onClick={() => onReplay(false)}>
            <Icon icon={RotateCcw} size={16} />
            Nghe lại cả tin nhắn
          </button>
          <button type="button" className="btn btn-primary" onClick={onGo} disabled={!done}>
            Lên đường
            <Icon icon={ArrowRight} size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
