// "Văn phòng điều xe" (docs/town.md §27; docs/gta-plan.md §4.4): Rico's office in the old harbour gatehouse, phone two
// and the map on the wall, over the whole stage. Before a shift: what the job is. During: the calls ringing (answer
// one; the ring runs out to Bayline), the call on the line (tap its pickup and its destination on the map, then a car;
// "Xin nhắc lại" is there and counted), the three cars, what just happened. After: DispatchDebrief.
// One primary button a screen: "Bắt đầu ca", then "Nghe máy" between calls and "Gửi xe" on a call.

import { useEffect, useRef } from 'react';
import { Car, CircleHelp, Ear, PhoneCall, PhoneIncoming, RotateCcw, Send, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { useShortcuts } from '../../../components/useShortcuts';
import { ASKS_MAX, BAYLINE_WARN, baylineShare, DISPATCH_SHIFTS_A_DAY, nearestCar, onLine, ringingNow, type Car as ShiftCar, type DriverId } from '../../../core/town/dispatch';
import { shiftsPaidToday } from '../../../core/town/dispatchStore';
import { tl, tr } from '../../../i18n';
import { placeVi } from '../../../data/city/dispatch/names';
import { SoundBars } from '../art';
import { usePanelKeys } from '../panelKeys';
import DispatchDebrief from './DispatchDebrief';
import DispatchMap from './DispatchMap';
import { cityRoutes, DOORS, DRIVER_NAME, useDispatchShift, type Slot } from './useDispatchShift';
import './dispatch.css';


export interface DispatchOfficeProps {
  sound: boolean;
  onReward: (r: { label: string; xu?: number }) => void;
  onClose: () => void;
}

/** What a car is doing, in a few words. */
function carStatus(c: ShiftCar): string {
  const leg = c.legs[0];
  if (!leg) return 'Rảnh';
  return leg.kind === 'pickup' ? tl`Tới đón ở ${tr(placeVi(leg.place))}` : tl`Chở khách tới ${tr(placeVi(leg.place))}`;
}

const SLOT_NAME: Readonly<Record<Slot, string>> = { from: 'Đón ở', to: 'Tới', car: 'Xe' };

export default function DispatchOffice({ sound, onReward, onClose }: DispatchOfficeProps) {
  const d = useDispatchShift(sound);
  const { run } = d;
  const boxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, [run.phase]);
  // Esc closes only between shifts (during one, the shared practice keys use it to replay)
  usePanelKeys(boxRef, run.phase === 'shift' ? () => undefined : onClose);
  const shift = run.shift;
  const line = shift ? onLine(shift) : null;
  const on = line !== null && shift ? shift.calls[line] : null;
  useShortcuts({ replay: () => d.again(), slow: () => d.again() }, { enabled: run.phase === 'shift' && !!on });
  // the shift paid: the counter on the page
  const paid = useRef(false);
  useEffect(() => {
    if (run.phase !== 'debrief' || !run.end || paid.current) return;
    paid.current = true;
    if (run.end.xu > 0) onReward({ label: 'Hết ca ở máy số hai', xu: run.end.xu });
  }, [run.phase, run.end, onReward]);
  useEffect(() => {
    if (run.phase === 'shift') paid.current = false;
  }, [run.phase]);

  const close = () => (run.phase === 'shift' ? d.finish() : onClose());

  let body: React.ReactNode;
  if (run.phase === 'intro') {
    const left = DISPATCH_SHIFTS_A_DAY - shiftsPaidToday();
    body = (
      <div className="dsp-intro">
        <p className="dsp-intro-lead">
          Trạm gác cũ ở cổng cảng giờ là văn phòng của Rico: hai cái điện thoại và một tấm bản đồ trên tường. Máy số hai là của bạn.
        </p>
        <ol className="dsp-intro-steps">
          <li>Khách gọi tới, nói một lần: đón ở đâu, đi đâu, đôi khi thêm mấy người, mấy giờ, hay tự sửa lời.</li>
          <li>Chạm điểm đón rồi điểm đến trên bản đồ, chọn một trong ba xe đang rảnh và ở gần.</li>
          <li>Xe chạy thật trên bản đồ. Đón nhầm chỗ thì khách gọi lại, bực; chở nhầm nơi thì tới cuối cuốc mới biết.</li>
        </ol>
        <p className="town-build-hint">{left > 0 ? tl`Hôm nay còn ${left} ca được trả xu.` : 'Hôm nay đã đủ hai ca có xu; trực tiếp vẫn để luyện nghe.'}</p>
        <details className="how">
          <summary>
            <Icon icon={CircleHelp} size={18} />
            Văn phòng này để làm gì?
          </summary>
          <div className="stack-sm">
            <p>
              Để nghe tên chỗ trong một câu nói liền: "the pharmacy" với "the ferry", "the Lumen" với "Loom", "the station" với "the stage". Mỗi cặp nghe na ná nhau khi nói nhanh, hoặc là chỗ
              ngay cạnh nhau.
            </p>
            <p>
              Nói thật với nhau: khách và tài xế nói bằng giọng của trình duyệt, ít nối âm hơn người thật. "Xin nhắc lại" luôn có, chỉ tốn thời gian và được đếm. Bayline đôi khi đón mất một khách bị
              để chờ quá lâu, tối đa hai lần một ca. Xu là điểm trò chơi, không đo trình độ.
            </p>
          </div>
        </details>
        <div className="dsp-foot">
          <button type="button" className="btn btn-primary btn-lg" onClick={d.start} autoFocus>
            <Icon icon={PhoneCall} size={18} />
            Bắt đầu ca
          </button>
        </div>
      </div>
    );
  } else if (run.phase === 'debrief') {
    body = (
      <DispatchDebrief run={run} onAgain={d.start} onClose={onClose} />
    );
  } else if (shift) {
    const ringing = ringingNow(shift);
    const pickup = run.pick.from;
    const eta = pickup && DOORS[pickup] ? nearestCar(shift.cars, DOORS[pickup], DOORS, cityRoutes()).eta : null;
    const left = shift.calls.filter((c) => c.state !== 'done' && c.state !== 'stolen').length;
    const share = on ? baylineShare(on, shift.t, shift.stolen) : null;
    const slotValue = (k: Slot): string | null => (k === 'car' ? (run.pick.car ? DRIVER_NAME[run.pick.car] : null) : run.pick[k] ? tr(placeVi(run.pick[k]!)) : null);
    const ready = !!(on && run.pick.from && run.pick.to && run.pick.car);
    body = (
      <div className="dsp-desk">
        <DispatchMap cars={shift.cars} slot={on ? run.slot : null} from={run.pick.from} to={run.pick.to} car={run.pick.car} onPlace={(id) => d.choose(run.slot === 'car' ? 'from' : run.slot, id)} onCar={(id: DriverId) => d.choose('car', id)} />
        <div className="dsp-side">
          <p className="dsp-clock">
            <span className="tabular">{tl`Ca trực · còn ${left} cuộc`}</span>
            {shift.stolen > 0 && <span className="dsp-lost">{tl`Bayline lấy mất ${shift.stolen}`}</span>}
          </p>

          {on ? (
            <section className="dsp-call" aria-label="Cuộc gọi đang nghe">
              <p className="dsp-call-head">
                <Icon icon={on.callbacks > 0 ? PhoneIncoming : PhoneCall} size={16} />
                {on.callbacks > 0 ? 'Khách gọi lại, bực mình' : 'Máy số hai'}
                {run.talking ? <SoundBars on /> : <span className="dsp-call-state">{on.asks > 0 ? tl`đã nhắc lại ${on.asks} lần` : 'đã nói xong'}</span>}
              </p>
              {share !== null && share >= BAYLINE_WARN && <p className="dsp-warn">Có xe Bayline lượn gần đây. Gửi xe nhanh lên.</p>}
              <div className="dsp-slots" role="group" aria-label="Điều xe">
                {(['from', 'to', 'car'] as const).map((k) => {
                  const locked = k === 'to' && on.callbacks > 0;
                  return (
                    <button key={k} type="button" className={'dsp-slot' + (run.slot === k ? ' is-on' : '') + (slotValue(k) ? ' is-set' : '')} aria-pressed={run.slot === k} disabled={locked} onClick={() => d.setSlot(k)}>
                      <span className="dsp-slot-name">{SLOT_NAME[k]}</span>
                      <span className="dsp-slot-val">{slotValue(k) ?? (k === 'car' ? 'chạm một xe' : 'chạm trên bản đồ')}</span>
                    </button>
                  );
                })}
              </div>
              <div className="dsp-call-btns">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => d.again()} disabled={run.talking || on.asks >= ASKS_MAX} title="Khách nói lại, chậm hơn. Được đếm.">
                  <Icon icon={RotateCcw} size={16} />
                  Xin nhắc lại
                </button>
                <button type="button" className="btn btn-primary" onClick={d.dispatch} disabled={!ready}>
                  <Icon icon={Send} size={16} />
                  Gửi xe
                </button>
              </div>
            </section>
          ) : (
            <section className="dsp-phone" aria-label="Máy số hai">
              {ringing.length === 0 ? (
                <p className="town-build-hint">{left > 0 ? 'Chưa có ai gọi. Xe vẫn đang chạy.' : 'Hết cuộc gọi.'}</p>
              ) : (
                <ul className="dsp-rings">
                  {ringing.map((i, n) => {
                    const c = shift.calls[i];
                    const s = baylineShare(c, shift.t, shift.stolen);
                    return (
                      <li key={c.call.id} className={'dsp-ring' + (s !== null && s >= BAYLINE_WARN ? ' is-late' : '')}>
                        <span className="dsp-ring-name">
                          <Icon icon={PhoneIncoming} size={16} />
                          {c.callbacks > 0 ? 'Khách gọi lại' : 'Máy số hai đổ chuông'}
                        </span>
                        {s !== null && <span className="dsp-ring-bar" style={{ ['--k' as string]: String(s) }} aria-hidden="true" />}
                        <button type="button" className={'btn btn-sm ' + (n === 0 ? 'btn-primary' : 'btn-ghost')} onClick={() => d.pickUp(i)} autoFocus={n === 0}>
                          <Icon icon={Ear} size={16} />
                          Nghe máy
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <ul className="dsp-cars" aria-label="Xe của Rico">
            {shift.cars.map((c) => (
              <li key={c.id}>
                <button type="button" className={'dsp-car-row is-' + c.id + (run.pick.car === c.id ? ' is-picked' : '')} disabled={!on} onClick={() => d.choose('car', c.id)} aria-pressed={run.pick.car === c.id}>
                  <span className="dsp-car-icon" aria-hidden="true">
                    <Icon icon={Car} size={15} />
                  </span>
                  <span className="dsp-car-who">{DRIVER_NAME[c.id]}</span>
                  <span className="dsp-car-what">{carStatus(c)}</span>
                  {eta && <span className="dsp-car-eta tabular">{tl`~${Math.round(eta[c.id])} giây`}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="dsp-feed" role="status">
            {run.feed ?? ''}
          </p>
          <div className="dsp-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={d.finish}>
              Kết thúc ca
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section ref={boxRef} className="dsp" aria-label="Văn phòng điều xe" tabIndex={-1}>
      <header className="dsp-head">
        <h2 className="dsp-title">Văn phòng điều xe · Trạm gác cũ</h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={close} aria-label={run.phase === 'shift' ? 'Kết thúc ca' : 'Đóng'} title={run.phase === 'shift' ? 'Kết thúc ca' : 'Đóng (Esc)'}>
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="dsp-body">{body}</div>
    </section>
  );
}
