// "Chỗ ẩn": the learner's hideout in Westbay (docs/town.md §29). One job per state, one primary button:
//  - not bought: what it is for, its price, "Mua" (through the town's xu store);
//  - bought: the learner is in the room (the stage's dip to dark: TownStageHandle.enterOwnRoom), and from there
//    "Nghe lại băng" (the lines missed in jobs and at the dispatch office, the newest first, each heard in its speaker's
//    voice before its words show; nothing is scored: Ôn tập is where they are tested), "Đổi đồ" (the town's Tủ đồ) and
//    "Nằm nghỉ" (the police's search called off and the heat back to zero, once an hour of the game), and "Ngủ tới tối /
//    tới sáng" (this machine's game clock moved on to 18:00 or 06:00 for a while, once a real hour: core/town/gameClock.ts;
//    a dip to dark and the learner wakes; a small line says the clock here is ahead of their other machines till when).

import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, BedDouble, CassetteTape, KeyRound, MoonStar, Shirt, Sunrise } from 'lucide-react';
import { prefersReducedMotion } from '../../../core/motion';
import { currentShift, onShift, sleepFor, sleepUntil, sleepWait, offsetAt } from '../../../core/town/gameClock';
import { clockLabel, gameHour } from '../../../core/town/sky';
import { Icon } from '../../../components/Icon';
import ListenPair from '../../../components/ListenPair';
import { navigate } from '../../../core/nav';
import { balance } from '../../../core/town/economy';
import { canRest, dueOnTape, ownsHideout, restWait } from '../../../core/town/hideout';
import { buyHideout, hideoutTape, restInHideout, useTownHideout } from '../../../core/town/hideoutStore';
import { useTownProgress } from '../../../core/town/store';
import { HIDEOUT_COST, HIDEOUT_ID } from '../../../data/city/hideout';
import { coolDownAt } from '../streets/streetsStore';
import { tl } from '../../../i18n';
import { safeDecode } from '../../dictation/decodeCache';
import { setHeat, useHeat } from '../jobs/heatStore';
import { Coin } from '../art';
import { playSfx } from '../sfx';
import { tapeLines, type TapeLine } from './tape';
import './hideout.css';

/** The town's wardrobe ("Tủ đồ"), the same panel: what is worn shows on the player in Westbay too. */
const WardrobePanel = lazy(() => import('../activities/WardrobePanel'));

export interface HideoutPanelProps {
  sound: boolean;
  onReward: (r: { label: string; xu?: number }) => void;
  onClose: () => void;
  /** Into the room through the dark (`ready` once inside); null without the 3D stage (the list mode). */
  enter: ((ready: () => void) => boolean) | null;
}

type View = 'home' | 'tape' | 'wardrobe';

export default function HideoutPanel({ sound, onReward, onClose, enter }: HideoutPanelProps) {
  const progress = useTownProgress();
  const record = useTownHideout();
  const owned = ownsHideout(progress.bought, record);
  const heat = useHeat();
  const [view, setView] = useState<View>('home');
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [inside, setInside] = useState(false);

  // in through the dark as soon as it is the learner's (on opening, or right after buying it)
  useEffect(() => {
    if (!owned || inside) return;
    if (!enter || !enter(() => setInside(true))) setInside(true);
    // (once: entering is what the stage does; leaving is the page's close)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned]);

  // the clock for "Nằm nghỉ" (a rest an hour of the game: two real minutes)
  const wait = restWait(record, now);
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [wait]);

  // the game's clock of this machine: moved on by a sleep (re-read every ten seconds and on a sleep)
  const shift = useSyncExternalStore(onShift, currentShift, currentShift);
  const [dip, setDip] = useState<'in' | 'out' | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const tape = useMemo(() => tapeLines(hideoutTape(now)), [now]);
  const due = dueOnTape(tape, now);

  if (!owned) {
    const have = balance(progress);
    const missing = Math.max(0, HIDEOUT_COST - have);
    const buy = () => {
      const r = buyHideout();
      if (!r.ok) {
        setFailed(true);
        playSfx('wrong', sound);
        return;
      }
      setFailed(false);
      playSfx('build', sound);
      onReward({ label: 'Chỗ ẩn là của bạn' });
    };
    return (
      <div className="hid">
        <p className="hid-lead">Căn phòng xây gạch sau chòi gác của Gus, cạnh văn phòng của Rico. Cửa cuốn đang kéo xuống, ngoài cửa treo biển cho thuê.</p>
        <ul className="hid-uses">
          <li>
            <Icon icon={CassetteTape} size={16} />
            <span>Nghe lại những câu bạn nghe sót trong phi vụ và ở văn phòng điều xe.</span>
          </li>
          <li>
            <Icon icon={Shirt} size={16} />
            <span>Thay đồ trước khi ra đường.</span>
          </li>
          <li>
            <Icon icon={BedDouble} size={16} />
            <span>Nằm nghỉ cho người ta quên mặt bạn: độ nóng về 0.</span>
          </li>
        </ul>
        <p className="hid-price">
          <Coin size={16} /> {tl`${HIDEOUT_COST} xu, mua một lần là của bạn trên mọi máy.`}
        </p>
        {missing > 0 && <p className="hid-note">{tl`Bạn có ${have} xu, còn thiếu ${missing} xu.`}</p>}
        {failed && <p className="hid-note">Chưa mua được. Thử lại sau nhé.</p>}
        <button type="button" className="btn btn-primary" onClick={buy} disabled={missing > 0}>
          <Icon icon={KeyRound} size={16} />
          {tl`Mua · ${HIDEOUT_COST} xu`}
        </button>
      </div>
    );
  }

  if (view === 'wardrobe') {
    return (
      <div className="hid">
        <button type="button" className="btn btn-ghost btn-sm hid-back" onClick={() => setView('home')}>
          <Icon icon={ArrowLeft} size={15} />
          Chỗ ẩn
        </button>
        <Suspense fallback={<p className="town-build-hint">Đang mở…</p>}>
          <WardrobePanel sound={sound} onReward={onReward} onClose={() => setView('home')} />
        </Suspense>
      </div>
    );
  }

  if (view === 'tape') {
    return (
      <div className="hid">
        <button type="button" className="btn btn-ghost btn-sm hid-back" onClick={() => setView('home')}>
          <Icon icon={ArrowLeft} size={15} />
          Chỗ ẩn
        </button>
        <p className="hid-lead">Nghe trước, chữ hiện sau. Ở đây chỉ nghe lại, không chấm điểm.</p>
        {due > 0 && (
          <p className="hid-note">
            {tl`${due} câu đến hạn ôn.`}{' '}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('review')}>
              Mở Ôn tập
            </button>
          </p>
        )}
        <ol className="hid-tape">
          {tape.map((line) => (
            <TapeItem key={line.ref} line={line} />
          ))}
        </ol>
      </div>
    );
  }

  const restNow = canRest(owned, record, now);
  const rest = () => {
    if (!restInHideout()) return;
    // the police call off a search and the heat goes (streets/streetsStore coolDownAt); without the streets layer
    // (the list mode) the heat of the visit is set to zero here all the same
    coolDownAt(HIDEOUT_ID);
    setHeat(0);
    setNow(Date.now());
    playSfx('pop', sound);
    onReward({ label: 'Ngủ một giấc. Không ai còn để ý bạn.' });
  };
  // "Ngủ tới tối / tới sáng": the one that fits the hour; a dip to dark, the clock on, and the learner wakes
  const sleepTo = sleepFor(gameHour(now));
  const sleepIn = sleepWait(shift, now);
  const sleep = () => {
    const run = () => {
      if (!sleepUntil(sleepTo)) return;
      coolDownAt(HIDEOUT_ID);
      setHeat(0);
      setNow(Date.now());
      onReward({ label: sleepTo === 'evening' ? 'Ngủ một giấc tới tối.' : 'Ngủ một giấc tới sáng.' });
    };
    if (prefersReducedMotion()) {
      run();
      return;
    }
    setDip('in');
    window.setTimeout(() => {
      run();
      setDip('out');
      window.setTimeout(() => setDip(null), 600);
    }, 600);
  };
  const ahead = offsetAt(now, shift) > 0 && shift ? clockLabel(shift.until - 1) : null;
  const primary: 'rest' | 'tape' | 'wardrobe' = heat > 0 && restNow ? 'rest' : tape.length > 0 ? 'tape' : 'wardrobe';
  const cls = (k: typeof primary) => (k === primary ? 'btn btn-primary' : 'btn');
  return (
    <div className="hid">
      <p className="hid-lead">{inside ? 'Cửa đã khoá. Ở đây không ai để ý bạn.' : 'Căn phòng sau chòi gác của Gus.'}</p>
      <p className="hid-note">{heat > 0 ? tl`Độ nóng: ${heat}. Nằm nghỉ một lát là hạ hết.` : 'Không ai đang để ý bạn.'}</p>
      <div className="hid-actions">
        {tape.length > 0 ? (
          <button type="button" className={cls('tape')} onClick={() => {
              setNow(Date.now());
              setView('tape');
            }}>
            <Icon icon={CassetteTape} size={16} />
            {tl`Nghe lại băng · ${tape.length} câu`}
          </button>
        ) : (
          <p className="hid-note">Chưa có câu nào nghe sót trong phi vụ hay ở văn phòng điều xe.</p>
        )}
        <button type="button" className={cls('wardrobe')} onClick={() => setView('wardrobe')}>
          <Icon icon={Shirt} size={16} />
          Đổi đồ
        </button>
        <button type="button" className={cls('rest')} onClick={rest} disabled={!restNow}>
          <Icon icon={BedDouble} size={16} />
          {restNow ? 'Nằm nghỉ' : tl`Nằm nghỉ · được lại sau ${Math.ceil(wait / 1000)} giây`}
        </button>
        <button type="button" className="btn" onClick={sleep} disabled={sleepIn > 0 || dip !== null}>
          <Icon icon={sleepTo === 'evening' ? MoonStar : Sunrise} size={16} />
          {sleepIn > 0 ? tl`Ngủ được lại sau ${Math.ceil(sleepIn / 60_000)} phút` : sleepTo === 'evening' ? 'Ngủ tới tối' : 'Ngủ tới sáng'}
        </button>
      </div>
      {ahead && <p className="hid-note">{tl`Giờ trong game trên máy này đang đi trước các máy khác, tới khoảng ${ahead} thì khớp lại.`}</p>}
      {dip && <div className={'hid-dip' + (dip === 'in' ? ' is-dark' : '')} aria-hidden="true" />}
      <details className="how">
        <summary>Chỗ ẩn để làm gì?</summary>
        <p>Làm hỏng việc thì người ta để ý bạn (độ nóng). Về đây nằm nghỉ là hạ về 0, mỗi giờ trong game một lần (hai phút thật).</p>
        <p>Băng là những câu bạn nghe sót: nghe lại ở đây cho quen tai. Chúng cũng nằm trong Ôn tập, nơi bạn được kiểm tra thật.</p>
        <p>Ngủ tới tối hoặc tới sáng: giờ trong game trên máy này chạy trước một lúc rồi tự khớp lại với máy khác. Thời tiết, việc trong ngày và xu không đổi. Mỗi giờ thật ngủ được một lần.</p>
      </details>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
        Ra ngoài
      </button>
    </div>
  );
}

/** One line of the tape: heard first (its speaker's voice, connected), its words and meaning shown after. */
function TapeItem({ line }: { line: TapeLine }) {
  const [heard, setHeard] = useState(false);
  const decoded = useMemo(() => safeDecode(line.text), [line.text]);
  return (
    <li className="hid-line">
      <p className="hid-who">
        {line.speaker} · {line.where}
      </p>
      <ListenPair text={line.text} decoded={decoded} say={line.say} voice={line.voice} browserOnly={line.browserOnly} onPlay={() => setHeard(true)} />
      {heard ? (
        <>
          <p className="hid-text" lang="en">
            {line.text}
          </p>
          <p className="hid-vi" data-vi>
            {line.vi}
          </p>
        </>
      ) : (
        <p className="hid-hidden">Nghe xong chữ mới hiện.</p>
      )}
    </li>
  );
}
