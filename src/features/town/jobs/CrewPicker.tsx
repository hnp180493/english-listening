// Before a job that allows it (core/town/jobDoc.ts `crew`, docs/gta-plan.md §4.3): who comes along. Each person says
// what they do and how the job's listening changes with them, and their cut is shown BEFORE choosing; somebody not
// close enough yet says what is missing (hearts, or talks heard with them up here). Going alone keeps the whole pay.
// One primary action: start.

import { useRef, useState } from 'react';
import { Check, Lock, Users, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { crewOpen, splitPay, type CrewWorld } from '../../../core/town/crew';
import { jobPay } from '../../../core/town/job';
import { jobPaidToday } from '../../../core/town/jobStore';
import type { CrewRole, JobDoc } from '../../../core/town/jobDoc';
import { tl } from '../../../i18n';
import { Coin } from '../art';
import { usePanelKeys } from '../panelKeys';

export interface CrewPickerProps {
  doc: JobDoc;
  world: CrewWorld;
  nameOf: (id: string) => string;
  onPick: (role: CrewRole | null) => void;
  /** Give the job up. */
  onClose: () => void;
}

export default function CrewPicker({ doc, world, nameOf, onPick, onClose }: CrewPickerProps) {
  const boxRef = useRef<HTMLElement>(null);
  usePanelKeys(boxRef, onClose);
  const [pick, setPick] = useState<string | null>(null);
  // a job that pays nothing today (paid already, or the day's paid jobs used up: core/town/jobStore) splits nothing
  const [unpaid] = useState(() => jobPaidToday(doc.id));
  const pay = unpaid ? 0 : jobPay('clean', false, doc.level);
  const roles = doc.crew?.roles ?? [];
  const chosen = roles.find((r) => r.who === pick) ?? null;
  return (
    <aside ref={boxRef} className="town-build town-activity-sheet job-sheet job-crew" role="dialog" aria-label={tl`Ai đi cùng: ${doc.title}`} tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">
          <Icon icon={Users} size={18} /> {tl`Ai đi cùng: ${doc.title}`}
        </h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Bỏ phi vụ" title="Bỏ phi vụ (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body town-activity-body">
        <p className="town-build-hint">Mỗi người làm phi vụ này nghe theo một kiểu khác, và lấy một phần tiền công. Đi một mình thì giữ hết.</p>
        <div className="job-crew-list" role="radiogroup" aria-label="Người đi cùng">
          <button type="button" role="radio" aria-checked={pick === null} className="town-reply job-crew-opt" onClick={() => setPick(null)}>
            <span className="job-crew-name">
              {pick === null && <Icon icon={Check} size={15} />}
              Đi một mình
            </span>
            <span className="job-crew-listen">Nghe theo cách của phi vụ, không ai giúp.</span>
            <span className="job-crew-cut">
              Giữ hết tiền công · <Coin size={14} /> {pay}
            </span>
          </button>
          {roles.map((r) => {
            const o = crewOpen(r, world);
            const share = splitPay(pay, r.cut);
            return (
              <button key={r.who} type="button" role="radio" aria-checked={pick === r.who} className="town-reply job-crew-opt" disabled={!o.open} onClick={() => setPick(r.who)}>
                <span className="job-crew-name">
                  {pick === r.who && <Icon icon={Check} size={15} />}
                  {!o.open && <Icon icon={Lock} size={15} />}
                  {nameOf(r.who)} <span className="job-crew-role">· {r.role}</span>
                </span>
                <span className="job-crew-listen">{r.listen}</span>
                <span className="job-crew-cut">
                  {o.open ? (
                    <>
                      {tl`Lấy ${Math.round(r.cut * 100)}%`} · {tl`bạn còn`} <Coin size={14} /> {share.keep}
                    </>
                  ) : o.hearts ? (
                    tl`Cần ${o.hearts} tim với ${nameOf(r.who)}`
                  ) : (
                    tl`Cần nghe thêm ${o.talks ?? 1} chuyện với ${nameOf(r.who)} trên này`
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="town-build-hint">{unpaid ? 'Hôm nay phi vụ này không trả tiền nữa: không ai lấy phần nào.' : 'Tiền công tính theo hạng Sạch; hạng thấp hơn thì chia theo cùng tỉ lệ.'}</p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={() => onPick(chosen)}>
            {chosen ? tl`Đi cùng ${nameOf(chosen.who)}` : 'Đi một mình'}
          </button>
        </div>
      </div>
    </aside>
  );
}
