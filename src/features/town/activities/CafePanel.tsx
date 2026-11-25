// "Phụ quầy cà phê" (docs/town.md §16): a shift at Emma's counter. A resident SAYS an order; the learner taps what they
// asked for on the twelve tiles and serves it before the patience bar runs out. Right trays in a row multiply the
// points; three misses end the shift; the result shows every missed order as it was said, to hear again.
// Rules and numbers: core/town/cafe.ts. One action a screen: "Mở quầy" → "Giao" → "Chơi lại".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Package, Bean, CakeSlice, Citrus, Coffee, Cookie, CupSoda, Dessert, Flame, GlassWater, Heart, Leaf, RotateCcw, Sandwich, Snowflake, Soup, Turtle, Volume2, type LucideIcon } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL, CAREFUL_RATE } from '../../../core/playback';
import {
  addToTray,
  basketSize,
  cafeBestToday,
  cafeStreak,
  cafeXuLeft,
  comboMultiplier,
  nextOrder,
  patienceMs,
  serve,
  servedRight,
  SHIFT_CUSTOMERS,
  shiftOver,
  startShift,
  takeFromTray,
  type Shift,
} from '../../../core/town/cafe';
import { finishShift, useTownCafe, type ShiftResult } from '../../../core/town/cafeStore';
import { deliveriesLeftNow } from '../../../core/town/deliveryStore';
import { CAFE_ITEMS, type CafeBasket, type CafeItemId, type CafeOrder } from '../../../core/town/cafeTypes';
import { townDay } from '../../../core/town/progress';
import { CAST_VOICES } from '../../../core/town/voices';
import { speak, stopSpeaking } from '../../../core/tts';
import { townPlace } from '../../../data/town';
import { CAFE_ORDERS } from '../../../data/townCafe';
import type { PlaceId } from '../../../data/townWorld';
import { dictationAudio, safeDecode } from '../../dictation/decodeCache';
import { Coin, Portrait } from '../art';
import { playSfx } from '../sfx';
import type { ActivityPanelProps } from './types';
import './cafe.css';
import { getLang, tl, tr } from '../../../i18n';

const ITEM: Record<CafeItemId, { name: string; icon: LucideIcon }> = {
  latte: { name: 'Latte', icon: Coffee },
  'iced-latte': { name: 'Latte đá', icon: CupSoda },
  'black-coffee': { name: 'Cà phê đen', icon: Bean },
  tea: { name: 'Trà', icon: Soup },
  'iced-tea': { name: 'Trà đá', icon: Snowflake },
  'green-tea': { name: 'Trà xanh', icon: Leaf },
  'orange-juice': { name: 'Nước cam', icon: Citrus },
  water: { name: 'Nước suối', icon: GlassWater },
  muffin: { name: 'Muffin', icon: Dessert },
  cookie: { name: 'Bánh quy', icon: Cookie },
  'lemon-cake': { name: 'Bánh chanh', icon: CakeSlice },
  sandwich: { name: 'Sandwich', icon: Sandwich },
};

/** How long a right tray's verdict stays before the next customer (ms). A miss waits for the learner. */
const NEXT_RIGHT_MS = 900;
/** The part of the patience gone when the customer starts to look worried. */
const HURRY_AT = 0.65;

const trayText = (b: CafeBasket): string =>
  CAFE_ITEMS.filter((id) => b[id])
    .map((id) => (getLang() === 'en' ? `${b[id]} × ${tr(ITEM[id].name).toLowerCase()}` : `${b[id]} ${ITEM[id].name.toLowerCase()}`))
    .join(', ');

/** Say an order in its customer's voice: the shipped clip when there is one, else the browser voice (never paid). */
function sayOrder(order: CafeOrder, careful = false): Promise<void> {
  const a = dictationAudio(order);
  const voice = CAST_VOICES[order.placeId] ?? null;
  return careful ? speak(a.careful, { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true }) : speak(a.connected, { mode: 'connected', voice, browserOnly: true });
}

interface Verdict {
  order: CafeOrder;
  right: boolean;
  late: boolean;
  points: number;
}

export default function CafePanel({ onReward, sound, onScene, onSceneEnd, onOpen }: ActivityPanelProps) {
  const cafe = useTownCafe();
  const [shift, setShift] = useState<Shift | null>(null);
  const [order, setOrder] = useState<CafeOrder | null>(null);
  const [tray, setTray] = useState<CafeBasket>({});
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [result, setResult] = useState<ShiftResult | null>(null);
  const [bestBefore, setBestBefore] = useState(0);
  /** The patience of the customer at the counter (ms): the bar's length in time. */
  const [wait, setWait] = useState(0);
  /** The customer's patience is running low (the last third): their face shows it. */
  const [hurry, setHurry] = useState(false);
  const [today] = useState(() => townDay(Date.now()));
  // The game as the handlers and timers see it (the state above is its picture): written only in handlers.
  const game = useRef<{ shift: Shift | null; order: CafeOrder | null; judged: boolean; tray: CafeBasket; from: number; ms: number; plays: number; staged: boolean; timers: number[] }>({
    shift: null,
    order: null,
    judged: false,
    tray: {},
    from: 0,
    ms: 0,
    plays: 0,
    staged: false,
    timers: [],
  });
  const cafeRef = useRef(cafe);
  useEffect(() => {
    cafeRef.current = cafe;
  }, [cafe]);
  const clearTimers = useCallback(() => {
    game.current.timers.forEach((t) => window.clearTimeout(t));
    game.current.timers = [];
  }, []);
  // leaving the counter: nothing rings on, the town gets its camera back
  useEffect(() => {
    const g = game.current;
    return () => {
      g.timers.forEach((t) => window.clearTimeout(t));
      stopSpeaking();
      if (g.staged) onSceneEnd?.({ placeId: 'cafe', celebrate: false });
    };
  }, [onSceneEnd]);

  const best = cafe.best?.score ?? 0;
  const streak = cafeStreak(cafe, today);
  const xuLeft = cafeXuLeft(cafe, today);
  const bestToday = cafeBestToday(cafe, today);

  // the newest judge, for the patience's own timer
  const judgeRef = useRef<(served: CafeBasket | null) => void>(() => undefined);

  /** The next customer walks up and says their order; the patience starts with their first word. */
  const call = useCallback((s: Shift) => {
    const g = game.current;
    const next = nextOrder(s, CAFE_ORDERS, (id) => cafeRef.current.orders[id]?.ok ?? 0);
    if (!next) return false;
    const ms = patienceMs(next, s.skill);
    g.order = next;
    g.judged = false;
    g.tray = {};
    g.from = Date.now();
    g.ms = ms;
    g.plays = 1;
    setOrder(next);
    setTray({});
    setVerdict(null);
    setWait(ms);
    setHurry(false);
    void sayOrder(next);
    g.timers.push(window.setTimeout(() => setHurry(true), ms * HURRY_AT));
    g.timers.push(window.setTimeout(() => judgeRef.current(null), ms));
    return true;
  }, []);

  const end = useCallback(
    (s: Shift) => {
      game.current.order = null;
      setOrder(null);
      const r = finishShift(s);
      setResult(r);
      playSfx(r.record ? 'level' : 'task', sound);
      if (r.xu > 0) onReward({ label: r.record ? 'Kỷ lục mới ở quầy cà phê!' : 'Xong một ca ở quầy', xu: r.xu });
    },
    [onReward, sound],
  );

  /** The tray is served (null: the patience ran out): the verdict shows, then the next customer or the result. */
  const judge = useCallback(
    (served: CafeBasket | null) => {
      const g = game.current;
      const s = g.shift;
      const o = g.order;
      if (!s || !o || g.judged) return;
      g.judged = true;
      clearTimers();
      stopSpeaking();
      const left = Math.max(0, 1 - (Date.now() - g.from) / g.ms);
      const after = serve(s, o, served, g.plays, left);
      const line = after.lines[after.lines.length - 1];
      const right = line.outcome === 'right';
      g.shift = after;
      setShift(after);
      setVerdict({ order: o, right, late: line.outcome === 'late', points: line.points });
      playSfx(right ? (line.firstListen ? 'first' : 'right') : 'wrong', sound);
      // a right tray goes on by itself (the pace of the game); a miss waits for "Khách tiếp theo": the learner reads
      // what was said and hears it again first (owner, 2026-11-24: "bị qua nhanh quá chưa đọc đc gì")
      if (right) {
        g.timers.push(
          window.setTimeout(() => {
            if (shiftOver(after) || !call(after)) end(after);
          }, NEXT_RIGHT_MS),
        );
      }
    },
    [call, clearTimers, end, sound],
  );

  /** After a miss: on to the next customer (or the result) when the learner says so. */
  const next = useCallback(() => {
    const g = game.current;
    const sh = g.shift;
    if (!sh || !g.judged || g.timers.length > 0) return;
    stopSpeaking();
    if (shiftOver(sh) || !call(sh)) end(sh);
  }, [call, end]);
  useEffect(() => {
    judgeRef.current = judge;
  }, [judge]);

  const open = useCallback(() => {
    const g = game.current;
    clearTimers();
    const s = startShift(cafeRef.current.skill?.v ?? 0, Date.now());
    g.shift = s;
    g.order = null;
    g.judged = false;
    setBestBefore(cafeRef.current.best?.score ?? 0);
    setShift(s);
    setResult(null);
    if (!g.staged) {
      g.staged = true;
      onScene?.({ placeId: 'cafe', spot: { kind: 'place', id: 'cafe' }, wedding: false });
    }
    call(s);
  }, [call, clearTimers, onScene]);

  const again = useCallback(() => {
    const g = game.current;
    if (!g.order || g.judged) return;
    g.plays += 1;
    void sayOrder(g.order);
  }, []);

  /** One more / one fewer of a thing on the tray. */
  const put = useCallback((id: CafeItemId, more: boolean) => {
    const g = game.current;
    if (g.judged) return;
    g.tray = more ? addToTray(g.tray, id) : takeFromTray(g.tray, id);
    setTray(g.tray);
  }, []);
  const give = useCallback(() => {
    if (basketSize(game.current.tray) > 0) judgeRef.current(game.current.tray);
  }, []);

  // Enter serves, R says the order again
  const playing = !!shift && !!order && !result;
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (game.current.judged) next();
        else give();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        again();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, again, give, next]);

  const missed = useMemo(() => (result && shift ? shift.lines.filter((l) => l.outcome !== 'right').map((l) => CAFE_ORDERS.find((o) => o.id === l.orderId)).filter((o): o is CafeOrder => !!o) : []), [result, shift]);

  // ── the result of a shift ──
  if (shift && result) {
    const right = servedRight(shift);
    const toBest = bestBefore - shift.score;
    return (
      <div className="town-cafe">
        <h3 className="town-cafe-title">{result.record ? 'Kỷ lục mới!' : right >= 8 ? 'Một ca thật trơn tru' : 'Hết ca'}</h3>
        <p className="town-cafe-score">
          <span className="tabular">{shift.score}</span> điểm
        </p>
        <ul className="town-cafe-facts">
          <li>{tl`Giao đúng ${right}/${shift.lines.length} khách · chuỗi dài nhất ${shift.bestCombo}`}</li>
          {!result.record && bestBefore > 0 && toBest > 0 && <li>{tl`Còn ${toBest} điểm nữa là phá kỷ lục ${bestBefore}`}</li>}
          {result.xu > 0 && (
            <li>
              <Coin size={15} /> +{result.xu} xu{result.capped ? ' (đã đủ xu của quầy hôm nay)' : ''}
            </li>
          )}
          {result.xu === 0 && shift.score >= 30 && <li>Quầy đã trả đủ xu hôm nay; điểm và kỷ lục vẫn tính.</li>}
          {result.bond > 0 && <li>Emma quý bạn hơn: thân thiết +{result.bond}</li>}
          {result.friends.length > 0 && <li>Khách quý bạn hơn: {result.friends.map((id) => townPlace(id)?.resident).join(', ')}</li>}
        </ul>
        {missed.length > 0 && (
          <div className="town-cafe-missed">
            <h4 className="town-cafe-sub">{tl`Nghe lại ${missed.length} khách bạn giao chưa đúng`}</h4>
            <ul className="town-cafe-missed-list">
              {missed.map((o) => (
                <MissedOrder key={o.id} order={o} />
              ))}
            </ul>
          </div>
        )}
        <div className="town-talk-foot">
          {deliveriesLeftNow() > 0 && (
            <button type="button" className="btn" onClick={() => onOpen?.('delivery')}>
              <Icon icon={Package} size={16} />
              Emma nhờ giao {deliveriesLeftNow()} đơn
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={open} autoFocus>
            <Icon icon={RotateCcw} size={16} />
            Chơi lại
          </button>
        </div>
      </div>
    );
  }

  // ── at the counter ──
  if (shift && order) {
    const who = townPlace(order.placeId)?.resident ?? '';
    const n = shift.lines.length + (verdict ? 0 : 1);
    const mult = comboMultiplier(shift.combo);
    return (
      <div className="town-cafe">
        <div className="town-cafe-bar">
          <span className="town-cafe-hearts" role="img" aria-label={tl`Còn ${shift.hearts} lần sai`}>
            {[0, 1, 2].map((i) => (
              <Icon key={i} icon={Heart} size={16} className={i < shift.hearts ? 'is-on' : ''} fill={i < shift.hearts ? 'currentColor' : 'none'} />
            ))}
          </span>
          <span className="town-cafe-count">
            Khách {Math.min(n, SHIFT_CUSTOMERS)}/{SHIFT_CUSTOMERS}
          </span>
          {shift.combo >= 2 && (
            <span className="town-cafe-combo">
              <Icon icon={Flame} size={14} />×{mult}
            </span>
          )}
          <span className="town-cafe-points tabular">{shift.score}</span>
        </div>

        <div className="town-cafe-guest">
          <Portrait placeId={order.placeId as PlaceId} size={56} mood={verdict ? (verdict.right ? 'happy' : verdict.late ? 'sad' : 'pout') : hurry ? 'worried' : 'neutral'} />
          <div className="town-cafe-guest-body">
            <span className="town-cafe-guest-name">{who}</span>
            {verdict ? (
              <span className={'town-cafe-verdict' + (verdict.right ? ' is-ok' : ' is-bad')}>{verdict.right ? tl`Đúng rồi! +${verdict.points}` : verdict.late ? 'Khách chờ lâu quá, đi mất rồi' : 'Chưa đúng món'}</span>
            ) : (
              // the patience: a bar that empties from the customer's first word (a new one for each customer)
              <span key={order.id} className="town-cafe-patience" role="img" aria-label="Khách đang chờ">
                <span className="town-cafe-patience-fill" style={{ animationDuration: `${wait}ms` }} />
              </span>
            )}
          </div>
          {!verdict && (
            <button type="button" className="btn btn-sm btn-soft" onClick={again} aria-keyshortcuts="R" title="Nghe lại (R)">
              <Icon icon={Volume2} size={15} />
              Nghe lại
            </button>
          )}
        </div>

        {verdict && !verdict.right ? (
          <div className="town-cafe-said">
            <p className="town-cafe-said-en" lang="en">
              {verdict.order.text}
            </p>
            <p className="town-cafe-said-vi">{verdict.order.vi}</p>
            <p className="town-cafe-said-vi">Món đúng: {trayText(verdict.order.items)}</p>
            <div className="town-cafe-missed-btns">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayOrder(verdict.order)}>
                <Icon icon={Volume2} size={15} />
                Nghe lại
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayOrder(verdict.order, true)}>
                <Icon icon={Turtle} size={15} />
                {CAREFUL_LABEL}
              </button>
            </div>
            <div className="town-talk-foot">
              <button type="button" className="btn btn-primary" onClick={next} autoFocus aria-keyshortcuts="Enter">
                {shiftOver(shift) ? 'Xem kết quả' : 'Khách tiếp theo'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="town-cafe-grid" aria-label="Quầy">
              {CAFE_ITEMS.map((id) => {
                const have = tray[id] ?? 0;
                return (
                  <li key={id}>
                    <button type="button" className={'town-cafe-tile' + (have ? ' is-on' : '')} onClick={() => put(id, true)} disabled={!!verdict} aria-label={`${tr(ITEM[id].name)}${have ? tl`, đang có ${have}` : ''}`}>
                      <Icon icon={ITEM[id].icon} size={20} />
                      <span className="town-cafe-tile-name">{ITEM[id].name}</span>
                      {have > 0 && <span className="town-cafe-tile-n tabular">{have}</span>}
                    </button>
                    {have > 0 && !verdict && (
                      <button type="button" className="town-cafe-less" onClick={() => put(id, false)} aria-label={tl`Bớt một ${ITEM[id].name}`}>
                        −
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="town-talk-foot">
              <button type="button" className="btn btn-primary" onClick={give} disabled={!!verdict || basketSize(tray) === 0} aria-keyshortcuts="Enter">
                Giao
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── before a shift ──
  return (
    <div className="town-cafe">
      <p className="town-build-hint">Khách tới quầy và gọi món bằng tiếng Anh, nói nhanh như ngoài đời. Bấm đúng món rồi giao trước khi khách hết kiên nhẫn. Sai 3 lần là hết ca.</p>
      {(best > 0 || streak >= 2) && (
        <ul className="town-cafe-facts">
          {best > 0 && (
            <li>
              Kỷ lục của bạn: <span className="tabular">{best}</span> điểm{bestToday > 0 ? tl` · hôm nay ${bestToday}` : ''}
            </li>
          )}
          {streak >= 2 && <li>{streak} ngày liền đứng quầy</li>}
        </ul>
      )}
      <p className="town-build-hint">{xuLeft > 0 ? tl`Hôm nay quầy còn trả tới ${xuLeft} xu.` : 'Quầy đã trả đủ xu hôm nay; chơi tiếp vẫn tính điểm và kỷ lục.'}</p>
      <div className="town-talk-foot">
        <button type="button" className="btn btn-primary" onClick={open} autoFocus>
          <Icon icon={Coffee} size={16} />
          Mở quầy
        </button>
      </div>
    </div>
  );
}

/** A missed order after the shift: what was said, how it sounds joined up, what it meant; to hear again. */
function MissedOrder({ order }: { order: CafeOrder }) {
  const decoded = useMemo(() => safeDecode(order.text), [order.text]);
  return (
    <li className="town-cafe-missed-row">
      <span className="town-cafe-guest-name">{townPlace(order.placeId)?.resident}</span>
      {decoded.tokens.length > 0 ? (
        <SpokenSentence result={decoded} compact />
      ) : (
        <p className="town-cafe-said-en" lang="en">
          {order.text}
        </p>
      )}
      <p className="town-cafe-said-vi">{order.vi}</p>
      <div className="town-cafe-missed-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayOrder(order)}>
          <Icon icon={Volume2} size={15} />
          Nghe
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayOrder(order, true)}>
          <Icon icon={Turtle} size={15} />
          {CAREFUL_LABEL}
        </button>
      </div>
    </li>
  );
}
