// The police scanner of Westbay (docs/town.md §28): a pill under the heat, shown while the police are looking for the
// learner or just after they said something. A bulletin is said as it comes, once (the scanner is the listening: what
// it says is how to get away). Opened, the pill offers "Nghe lại" and "Nghe chậm" (the shared practice keys:
// core/shortcuts.ts) and, folded, the words with their meaning. One more line says what was just done wrong.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RadioTower, Turtle, Volume2 } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { useShortcuts } from '../../../components/useShortcuts';
import { tl } from '../../../i18n';
import { OFFENCE_HEAT, type Offence } from '../../../core/town/police';
import { hushScan, sayScan } from './scannerVoice';
import { streets, useStreets } from './streetsStore';
import './streets.css';

/** A bulletin stays on the pill this long after it was said (ms). */
const SHOW_FOR = 90_000;
const OFFENCE_NAME: Readonly<Record<Offence, string>> = { red: 'Vượt đèn đỏ', car: 'Tông vào xe khác', thing: 'Tông đổ đồ trên phố' };

export default function Scanner({ muted }: { /** A panel is over the stage: a bulletin waits to be heard. */ muted: boolean }) {
  const { search, bulletin, offence, jobPatrol } = useStreets();
  const [openAsked, setOpen] = useState(false);
  // a job's lines open the pill by themselves, until it is closed by hand
  const [closedFor, setClosedFor] = useState(0);
  const open = openAsked || (!!bulletin?.open && closedFor !== bulletin.id);
  const [words, setWords] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  // a new bulletin is said once, as it comes (or when the panel over the stage is gone)
  const said = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    // (a job's lines are said even with a panel over the stage: the job is waiting for them)
    if (!bulletin || (muted && !bulletin.force) || said.current === bulletin.id) return;
    said.current = bulletin.id;
    setWords(false);
    setSpeaking(true);
    const id = bulletin.id;
    void sayScan(bulletin.lines).then(() => {
      setSpeaking(false);
      streets.spoken(id);
    });
  }, [bulletin, muted]);
  useEffect(() => () => hushScan(), []);
  const again = (slow: boolean) => {
    if (!bulletin) return false;
    setSpeaking(true);
    void sayScan(bulletin.lines, slow).then(() => setSpeaking(false));
    return true;
  };
  useShortcuts({ replay: () => again(false), slow: () => again(true) }, { enabled: open && !!bulletin && (!muted || !!bulletin.force) });

  const recent = !!bulletin && now - bulletin.at < SHOW_FOR;
  const fresh = offence && now - offence.at < 5000 ? offence : null;
  if (!search && !recent && !fresh && !jobPatrol) return null;
  return (
    <div className="str-scanner">
      {fresh && (
        <p className="str-offence" role="status">
          {tl`${OFFENCE_NAME[fresh.kind]}: độ nóng +${OFFENCE_HEAT[fresh.kind]}`}
        </p>
      )}
      {(search || recent || jobPatrol) && (
        <button type="button" className={'town-pill town-hud-btn str-pill' + (search || jobPatrol ? ' is-on' : '')} onClick={() => {
            if (open) {
              setOpen(false);
              setClosedFor(bulletin?.id ?? 0);
            } else setOpen(true);
          }} aria-expanded={open} title="Bộ đàm cảnh sát">
          <Icon icon={RadioTower} size={17} />
          <span>Bộ đàm</span>
          {speaking && <span className="str-live" aria-hidden="true" />}
        </button>
      )}
      {open && (search || recent || jobPatrol) && (
        <div className="str-panel" role="group" aria-label="Bộ đàm cảnh sát">
          <p className="str-status">{jobPatrol ? 'Một xe tuần tra đang chạy trên phố. Nghe bộ đàm nói gì.' : search ? 'Có xe tuần tra đang tìm bạn. Nghe họ tả bạn thế nào, đang tìm ở đâu.' : 'Không còn ai tìm bạn.'}</p>
          {bulletin && (
            <>
              <div className="str-btns">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => again(false)} disabled={speaking}>
                  <Icon icon={Volume2} size={15} />
                  Nghe lại
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => again(true)} disabled={speaking}>
                  <Icon icon={Turtle} size={15} />
                  Nghe chậm
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWords((w) => !w)} aria-expanded={words}>
                  <Icon icon={ChevronDown} size={15} />
                  Xem lời
                </button>
              </div>
              {words && (
                <ol className="str-lines">
                  {bulletin.lines.map((l, i) => (
                    <li key={i}>
                      <span className="str-who">{l.who === 'dispatch' ? 'Tổng đài' : l.who === 'unit' ? 'Xe tuần tra' : 'Cảnh sát'}</span>
                      <span lang="en">{l.text}</span>
                      <span className="str-vi" data-vi>
                        {l.vi}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
