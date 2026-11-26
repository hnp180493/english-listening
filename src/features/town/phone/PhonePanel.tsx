// The learner's phone in Westbay (core/town/phone.ts, docs/gta-plan.md §4.6): a button on the HUD with a badge (missed
// calls still open, voice messages not heard; it shakes while a job rings), and a panel: missed calls with their
// deadline by the GAME clock ("Gọi lại trước 18:00"; after it, gone until the next game day), voice messages (heard
// from here; a job's briefing goes on once heard), the contacts (the crew: who is open, and what is missing), and the
// clues earned (data/city/clues.ts). One primary action at most: calling back the first open missed call.

import { useRef } from 'react';
import { Lightbulb, Phone, PhoneCall, PhoneMissed, Play, Users, Voicemail, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { canCallBack, waiting as waitingCount, type PhoneEntry } from '../../../core/town/phone';
import { clockOf } from '../../../core/town/job';
import { clueById } from '../../../data/city/clues';
import { tl } from '../../../i18n';
import type { Contact } from '../jobs/crewWorld';
import { usePanelKeys } from '../panelKeys';
import './phone.css';

export function PhoneButton({ waiting, ringing, now, onOpen }: { waiting: readonly PhoneEntry[]; ringing: boolean; now: number; onOpen: () => void }) {
  const n = waitingCount(waiting, now);
  return (
    <button type="button" className={'town-pill phone-button' + (ringing ? ' is-ringing' : '')} onClick={onOpen} aria-label={n > 0 ? tl`Điện thoại: ${n} việc chờ` : 'Điện thoại'} title="Điện thoại">
      <Icon icon={Phone} size={16} />
      {n > 0 && <span className="phone-badge tabular">{n}</span>}
    </button>
  );
}

export interface PhonePanelProps {
  log: readonly PhoneEntry[];
  now: number;
  nameOf: (id: string) => string;
  contacts: readonly Contact[];
  clues: Readonly<Record<string, number>>;
  /** A job is under way (nothing can be called back now). */
  busy: boolean;
  onCallBack: (id: string) => void;
  onPlay: (id: string) => void;
  onClose: () => void;
}

export default function PhonePanel({ log, now, nameOf, contacts, clues, busy, onCallBack, onPlay, onClose }: PhonePanelProps) {
  const boxRef = useRef<HTMLElement>(null);
  usePanelKeys(boxRef, onClose);
  const calls = log.filter((e) => e.kind !== 'voicemail');
  const messages = log.filter((e) => e.kind === 'voicemail');
  const first = busy ? undefined : calls.find((e) => canCallBack(e, now));
  const held = Object.keys(clues)
    .map((id) => clueById(id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  return (
    <aside ref={boxRef} className="town-build town-activity-sheet job-sheet phone-sheet" role="dialog" aria-label="Điện thoại" tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">
          <Icon icon={Phone} size={18} /> Điện thoại
        </h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body town-activity-body">
        <h3 className="town-ls-sub">
          <Icon icon={PhoneMissed} size={16} /> Cuộc gọi
        </h3>
        {calls.length === 0 ? (
          <p className="town-build-hint">Chưa có cuộc gọi nào.</p>
        ) : (
          <ul className="phone-list">
            {calls.map((e) => {
              const open = canCallBack(e, now);
              const late = e.kind === 'missed' && !open && e.status !== 'returned';
              return (
                <li key={e.id} className={'phone-row' + (late ? ' is-late' : '')}>
                  <span className="phone-who">
                    <Icon icon={e.kind === 'missed' ? PhoneMissed : PhoneCall} size={15} />
                    {nameOf(e.from)}
                  </span>
                  <span className="phone-what">
                    {e.kind === 'missed' && e.deadline
                      ? e.status === 'returned'
                        ? 'Đã gọi lại'
                        : open
                          ? tl`Gọi nhỡ · gọi lại trước ${clockOf(e.deadline.minute)}`
                          : tl`Quá ${clockOf(e.deadline.minute)} rồi · việc đã đi, mai mới có lại`
                      : 'Đã nghe máy'}
                  </span>
                  {e.kind === 'missed' && (
                    <span className="phone-acts">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPlay(e.id)} aria-label={tl`Nghe tin nhắn của ${nameOf(e.from)}`}>
                        <Icon icon={Play} size={15} />
                        Nghe
                      </button>
                      {e.status !== 'returned' && e.status !== 'expired' && e !== first && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onCallBack(e.id)}>
                          <Icon icon={PhoneCall} size={15} />
                          Gọi lại
                        </button>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="town-ls-sub">
          <Icon icon={Voicemail} size={16} /> Tin nhắn thoại
        </h3>
        {messages.length === 0 ? (
          <p className="town-build-hint">Chưa có tin nhắn thoại.</p>
        ) : (
          <ul className="phone-list">
            {messages.map((e) => (
              <li key={e.id} className="phone-row">
                <span className="phone-who">
                  <Icon icon={Voicemail} size={15} />
                  {nameOf(e.from)}
                </span>
                <span className="phone-what">{e.status === 'new' ? 'Chưa nghe' : 'Đã nghe'}</span>
                <span className="phone-acts">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPlay(e.id)}>
                    <Icon icon={Play} size={15} />
                    Nghe
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="town-ls-sub">
          <Icon icon={Users} size={16} /> Danh bạ
        </h3>
        {contacts.length === 0 ? (
          <p className="town-build-hint">Chưa có ai trong băng.</p>
        ) : (
          <ul className="phone-list">
            {contacts.map((c) => (
              <li key={c.who} className={'phone-row' + (c.open ? '' : ' is-late')}>
                <span className="phone-who">{nameOf(c.who)}</span>
                <span className="phone-what">
                  {c.roles.join(' · ')}
                  {!c.open && (c.hearts ? ` · ${tl`cần ${c.hearts} tim`}` : ` · ${tl`cần nghe thêm ${c.talks ?? 1} chuyện`}`)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="town-ls-sub">
          <Icon icon={Lightbulb} size={16} /> Manh mối
        </h3>
        {held.length === 0 ? (
          <p className="town-build-hint">Nghe lỏm trên ghế đá, trên Bay FM hay trong phi vụ, có câu sẽ thành manh mối.</p>
        ) : (
          <ul className="phone-list">
            {held.map((c) => (
              <li key={c.id} className="phone-row phone-clue">
                <span className="phone-who">{nameOf(c.who)}</span>
                <span className="phone-what">
                  <span lang="en">{c.text}</span>
                  <span className="phone-note">{c.note}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {first && (
          <div className="town-talk-foot">
            <button type="button" className="btn btn-primary" onClick={() => onCallBack(first.id)}>
              <Icon icon={PhoneCall} size={16} />
              {tl`Gọi lại ${nameOf(first.from)}`}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
