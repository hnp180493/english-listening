// The learner's phone in Westbay (core/town/phone.ts, docs/gta-plan.md §4.6): a button on the HUD with a badge (missed
// calls still open, voice messages not heard; it shakes while a job rings), and a panel: missed calls with their
// deadline by the GAME clock ("Gọi lại trước 18:00"; after it, gone until the next game day), voice messages (heard
// from here; a job's briefing goes on once heard), the contacts (the crew: who is open, and what is missing), and the
// clues earned (data/city/clues.ts). One primary action at most: calling back the first open missed call.

import { useRef } from 'react';
import { Gauge, Lightbulb, Phone, PhoneCall, PhoneMissed, Play, Star, Users, Voicemail, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { canCallBack, waiting as waitingCount, type PhoneEntry } from '../../../core/town/phone';
import { clockOf } from '../../../core/town/job';
import { clueById } from '../../../data/city/clues';
import { SPEECH_LEVELS, type SpeechLevel, type SpeechState } from '../../../core/town/difficulty';
import { tl } from '../../../i18n';
import type { Contact } from '../jobs/crewWorld';
import type { Fame } from '../../../core/town/fame';
import type { WaitingJob } from '../jobs/jobNeeds';
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
  /** The speech level of the jobs and the dispatch office (core/town/difficulty.ts): automatic, or pinned. */
  speech: SpeechState;
  onPin: (level: SpeechLevel | null) => void;
  /** The learner's fame (core/town/fame.ts), the xu in hand, the big jobs still waiting for fame or a deposit. */
  fame?: Fame;
  xu?: number;
  waiting?: readonly WaitingJob[];
  onDeposit?: (jobId: string) => void;
}

export default function PhonePanel({ log, now, nameOf, contacts, clues, busy, onCallBack, onPlay, onClose, speech, onPin, fame, xu = 0, waiting = [], onDeposit }: PhonePanelProps) {
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
        {fame && (
          <>
            <h3 className="town-ls-sub">
              <Icon icon={Star} size={16} /> Tiếng tăm
            </h3>
            <p className="phone-fame">
              <span className="phone-fame-n tabular">{fame.total}</span>
              <span className="phone-note">{tl`Phi vụ ${fame.jobs} · điều xe ${fame.calls} · tài sản ${fame.assets}`}</span>
            </p>
            <p className="town-build-hint">Điểm trò chơi, không phải thước đo trình độ. Vài phi vụ lớn cần đủ tiếng tăm, hoặc tiền đặt cọc, mới mở.</p>
            {waiting.length > 0 && (
              <ul className="phone-list">
                {waiting.map((w) => (
                  <li key={w.id} className="phone-row">
                    <span className="phone-who">{w.title}</span>
                    <span className="phone-what">
                      {w.missing.fame > 0 && <span>{tl`Cần tiếng tăm ${w.fame}: còn thiếu ${w.missing.fame}.`}</span>}
                      {w.missing.deposit > 0 && <span>{tl`${nameOf(w.from)} cần ${w.missing.deposit} xu đặt cọc. Xong phi vụ thì nhận lại (kết Hỏng thì mất một phần).`}</span>}
                      {w.missing.deposit === 0 && w.deposit > 0 && <span>Đã đặt cọc.</span>}
                    </span>
                    {w.missing.deposit > 0 && onDeposit && (
                      <span className="phone-acts">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDeposit(w.id)} disabled={xu < w.missing.deposit} title={xu < w.missing.deposit ? tl`Còn thiếu ${w.missing.deposit - xu} xu` : undefined}>
                          {tl`Đặt cọc ${w.missing.deposit} xu`}
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <details className="how">
              <summary>Tiếng tăm từ đâu ra?</summary>
              <p>Mỗi phi vụ đã xong cho 3 (Sạch), 2 (Lộn xộn) hoặc 1 (Hỏng), theo lần chơi tốt nhất. Cứ 8 cuộc gọi ở văn phòng điều xe thêm 1. Mỗi tài sản thêm 2, mỗi nâng cấp văn phòng thêm 1. Tiếng tăm không bao giờ giảm, nên phi vụ đã mở không khóa lại.</p>
            </details>
          </>
        )}
        <h3 className="town-ls-sub">
          <Icon icon={Gauge} size={16} /> Độ khó lời nói
        </h3>
        <div className="phone-levels" role="radiogroup" aria-label="Độ khó lời nói">
          <button type="button" role="radio" aria-checked={speech.pin.level === null} className="btn btn-ghost btn-sm" onClick={() => onPin(null)}>
            Tự động
          </button>
          {SPEECH_LEVELS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={speech.pin.level === l} className="btn btn-ghost btn-sm phone-level" onClick={() => onPin(l)} aria-label={tl`Bậc ${l}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="town-build-hint">{speech.pin.level === null ? tl`Tự động: đang ở bậc ${speech.auto.level}, đổi dần theo việc bạn nghe đúng.` : tl`Bạn đã ghim bậc ${speech.pin.level}.`}</p>
        <details className="how">
          <summary>Bậc đổi những gì?</summary>
          <p>Bậc cao hơn thì người ta nói nhanh hơn một chút (so với Tốc độ đọc của bạn), ít lần nhắc lại miễn phí hơn, chờ bạn ít hơn, sổ tay có thêm một giờ giống nhau, phải đứng gần hơn mới nghe lén rõ, câu qua bộ đàm đứt nhiều chỗ hơn, và có lúc hai chuyện diễn ra cùng lúc. Không bao giờ có tiếng ồn đè lên lời. Phi vụ ở bậc cao trả nhiều xu hơn.</p>
          <p>Tự động giữ bạn quanh mức nghe đúng khoảng 85% ngay lần đầu, mỗi lần đổi một bậc. Bậc là điểm trò chơi, không đo trình độ tiếng Anh.</p>
        </details>
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
