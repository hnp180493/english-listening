// "Chạy taxi cho Rico" (core/town/taxi.ts, taxiStore.ts; data/city/taxiFares.ts): a passenger SAYS where to go, in
// the browser's voice (never a clip, never paid, like everybody of the city); the learner picks the place among three.
// Right: the clock starts and the page follows the ride (a quest with a countdown, the way on the minimap); set down
// at the door, this panel shows what it paid and the line with its connected speech. Wrong: the line and its meaning,
// and the next passenger. The careful "Rõ từng từ" only after the answer (it would give the place away).
// Rendered inside the host's sheet (its title bar and ✕ are the host's). One action a screen.

import { useEffect, useMemo, useRef } from 'react';
import { CarTaxiFront, RotateCcw, Turtle, Volume2 } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL, CAREFUL_RATE } from '../../../core/playback';
import { TAXI_PAID_A_DAY, type TaxiFare } from '../../../core/town/taxi';
import { chooseTaxi, dropTaxi, noteTaxiPlay, takeFare, taxiPaidToday, useTaxiRide } from '../../../core/town/taxiStore';
import { speak, stopSpeaking } from '../../../core/tts';
import { tl, tr } from '../../../i18n';
import { dictationAudio, safeDecode } from '../../dictation/decodeCache';
import { Coin } from '../art';
import { playSfx } from '../sfx';
import { taxiPlaceName } from './taxiPlace';
import '../activities/cafe.css';
import './shift.css';

export interface TaxiPanelProps {
  sound: boolean;
  /** How far a place's door is from the player (tiles, straight line), for the clock. */
  distanceTo: (placeId: string) => number;
  onReward: (r: { label: string; xu?: number }) => void;
  onClose: () => void;
}


/** Say a fare in the browser's voice (connected; the careful version slower). */
function sayFare(fare: TaxiFare, careful = false): Promise<void> {
  const a = dictationAudio({ text: fare.text, level: fare.level, ...(fare.say ? { say: fare.say } : {}) });
  const voice = { voice: fare.gender === 'male' ? 'shift-m' : 'shift-f', gender: fare.gender };
  return careful ? speak(a.careful.trim(), { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true }) : speak(a.connected.trim(), { mode: 'connected', voice, browserOnly: true });
}

export default function TaxiPanel({ sound, distanceTo, onReward, onClose }: TaxiPanelProps) {
  const ride = useTaxiRide();
  // a passenger is waiting as the panel opens (the one under way stays)
  useEffect(() => {
    if (!ride) takeFare();
  }, [ride]);
  // their words once as they get in
  const said = useRef<string | null>(null);
  useEffect(() => {
    if (ride?.state !== 'ask' || said.current === ride.fare.id) return;
    said.current = ride.fare.id;
    noteTaxiPlay();
    void sayFare(ride.fare);
  }, [ride]);
  useEffect(() => () => stopSpeaking(), []);
  // set down: the reward once
  const paid = useRef<string | null>(null);
  useEffect(() => {
    if (ride?.state !== 'done' || !ride.result || paid.current === ride.fare.id) return;
    paid.current = ride.fare.id;
    if (ride.result.xu > 0) {
      playSfx('coin', sound);
      onReward({ label: ride.result.late ? 'Tới nơi, hơi trễ' : 'Tới nơi đúng giờ!', xu: ride.result.xu });
    }
  }, [ride, sound, onReward]);
  const decoded = useMemo(() => (ride ? safeDecode(ride.fare.text) : null), [ride]);

  if (!ride) return <p className="town-build-hint">Đang gọi khách…</p>;
  const { fare } = ride;
  const next = () => {
    stopSpeaking();
    dropTaxi();
    takeFare();
  };
  const again = () => {
    noteTaxiPlay();
    void sayFare(fare);
  };
  const line = (
    <div className="town-cafe-said">
      {decoded && decoded.tokens.length > 0 ? (
        <SpokenSentence result={decoded} compact />
      ) : (
        <p className="town-cafe-said-en" lang="en">
          {fare.text}
        </p>
      )}
      <p className="town-cafe-said-vi">{fare.vi}</p>
      <div className="town-cafe-missed-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayFare(fare)}>
          <Icon icon={Volume2} size={16} />
          Nghe lại
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayFare(fare, true)}>
          <Icon icon={Turtle} size={16} />
          {CAREFUL_LABEL}
        </button>
      </div>
    </div>
  );

  if (ride.state === 'ask') {
    const left = TAXI_PAID_A_DAY - taxiPaidToday().size;
    return (
      <div className="town-cafe">
        <div className="town-cafe-guest">
          <div className="town-cafe-guest-body">
            <span className="shift-wait">{fare.gender === 'male' ? 'Một ông khách lên xe' : 'Một cô khách lên xe'}</span>
          </div>
          <button type="button" className="btn btn-sm btn-soft" onClick={again} title="Nghe lại: mất xu thưởng nghe một lần">
            <Icon icon={RotateCcw} size={16} />
            Nghe lại
          </button>
        </div>
        <div className="shift-slot" role="group" aria-label="Khách muốn đi đâu?">
          <span className="shift-slot-label">Khách muốn đi đâu?</span>
          <ul className="shift-tiles taxi-tiles">
            {ride.options.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="town-cafe-tile shift-tile"
                  onClick={() => {
                    stopSpeaking();
                    const r = chooseTaxi(id, distanceTo(fare.to));
                    playSfx(r?.state === 'riding' ? 'right' : 'wrong', sound);
                  }}
                >
                  {taxiPlaceName(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="town-build-hint">{left > 0 ? tl`Hôm nay Rico còn trả tiền ${left} cuốc.` : 'Hôm nay Rico đã trả đủ tiền cuốc; chạy tiếp vẫn để luyện nghe.'}</p>
      </div>
    );
  }

  if (ride.state === 'riding') {
    return (
      <div className="town-cafe">
        <h3 className="town-cafe-title">Đúng rồi!</h3>
        <p className="town-build-hint">{tl`Chở khách tới ${tr(taxiPlaceName(fare.to))} trong ${ride.seconds} giây. Đường đi hiện trên bản đồ nhỏ.`}</p>
        <p className="town-build-hint">Đi bộ thì không kịp: mượn xe taxi ở bến của Rico, hoặc gọi xe của bạn.</p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            <Icon icon={CarTaxiFront} size={18} />
            Chạy thôi
          </button>
        </div>
      </div>
    );
  }

  const result = ride.result;
  return (
    <div className="town-cafe">
      <h3 className="town-cafe-title">{ride.state === 'wrong' ? tl`Khách muốn tới ${tr(taxiPlaceName(fare.to))} cơ` : result?.late ? 'Tới nơi, hơi trễ' : 'Tới nơi đúng giờ!'}</h3>
      {ride.state === 'done' && result && (
        <p className="town-cafe-score">
          {result.xu > 0 ? (
            <>
              <Coin size={18} /> <span className="tabular">+{result.xu}</span>
            </>
          ) : result.capped ? (
            'Hôm nay Rico đã trả đủ tiền cuốc.'
          ) : null}
        </p>
      )}
      {ride.state === 'wrong' && ride.pick && <p className="town-build-hint">{tl`Bạn chọn ${tr(taxiPlaceName(ride.pick))}. Nghe lại khách nói:`}</p>}
      {line}
      <div className="town-talk-foot">
        <button type="button" className="btn" onClick={onClose}>
          Nghỉ thôi
        </button>
        <button type="button" className="btn btn-primary" onClick={next} autoFocus>
          Khách tiếp
        </button>
      </div>
    </div>
  );
}
