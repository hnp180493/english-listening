// "Ca làm việc" in Westbay (core/town/shift.ts, core/town/shiftTypes.ts; data/city/shifts/): a caller or a customer
// SAYS a request; the learner sets every slot (where from, where to, when; which flower, what colour, how many) and
// presses "Xong" before their patience runs out. The café game's design (activities/CafePanel.tsx): a patience bar, a
// combo a miss resets, three misses end the shift, a personal best, a capped daily reward, and the missed requests
// at the end with their connected-speech line. Every request is said in the BROWSER's voice only (never a clip, never
// a paid request), as the scenes are (core/town/sceneAudio.ts).
// Rendered inside the host's sheet (its title bar and ✕ are the host's). One action a screen: "Vào ca" → "Xong" →
// "Làm ca nữa".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Flame, Heart, RotateCcw, Turtle, Volume2 } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL, CAREFUL_RATE } from '../../../core/playback';
import { townDay } from '../../../core/town/progress';
import {
  allSet,
  answer,
  comboMultiplier,
  currentOrder,
  drawShift,
  missedLast,
  patienceSeconds,
  rightCount,
  runOver,
  seededRng,
  SHIFT_MISSES,
  SHIFT_ORDERS,
  shiftXuLeft,
  startRun,
  wrongSlots,
  type ShiftPicks,
  type ShiftRun,
} from '../../../core/town/shift';
import { finishShift, loadTownShifts, useTownShifts, type ShiftResult } from '../../../core/town/shiftStore';
import type { ShiftDef, ShiftOrder } from '../../../core/town/shiftTypes';
import { speak, stopSpeaking } from '../../../core/tts';
import { cityShift } from '../../../data/city/shifts';
import { tl } from '../../../i18n';
import { dictationAudio, safeDecode } from '../../dictation/decodeCache';
import { Coin } from '../art';
import { playSfx } from '../sfx';
import '../activities/cafe.css';
import './shift.css';

export interface ShiftPanelProps {
  shiftId: string;
  sound: boolean;
  onReward: (r: { label: string; xu?: number }) => void;
  onClose: () => void;
}

/** How long a right answer's verdict stays before the next request (ms). A miss waits for the learner. */
const NEXT_RIGHT_MS = 1100;
/** The part of the patience gone when the bar says "hurry". */
const HURRY_AT = 0.65;

/** Say a request in the browser's voice (connected; the careful version slower). Never a clip, never paid. */
function sayOrder(order: ShiftOrder, careful = false): Promise<void> {
  const a = dictationAudio({ text: order.text, level: order.level, ...(order.say ? { say: order.say } : {}) });
  const voice = { voice: order.gender === 'male' ? 'shift-m' : 'shift-f', gender: order.gender };
  return careful ? speak(a.careful.trim(), { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true }) : speak(a.connected.trim(), { mode: 'connected', voice, browserOnly: true });
}

const optionLabel = (def: ShiftDef, slotId: string, optionId: string | undefined): string => def.slots.find((s) => s.id === slotId)?.options.find((o) => o.id === optionId)?.label ?? '—';

/** Typing in a field is never a shortcut. */
const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

interface Verdict {
  order: ShiftOrder;
  right: boolean;
  late: boolean;
  points: number;
  picks: Record<string, string>;
}

export default function ShiftPanel({ shiftId, sound, onReward, onClose }: ShiftPanelProps) {
  const def = cityShift(shiftId);
  if (!def) return <p className="town-build-hint">Ca này chưa mở.</p>;
  return <ShiftGame key={def.id} def={def} sound={sound} onReward={onReward} onClose={onClose} />;
}

function ShiftGame({ def, sound, onReward, onClose }: { def: ShiftDef; sound: boolean; onReward: ShiftPanelProps['onReward']; onClose: () => void }) {
  const stored = useTownShifts();
  const [run, setRun] = useState<ShiftRun | null>(null);
  const [order, setOrder] = useState<ShiftOrder | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [result, setResult] = useState<ShiftResult | null>(null);
  const [bestBefore, setBestBefore] = useState(0);
  const [wait, setWait] = useState(0);
  const [hurry, setHurry] = useState(false);
  const [today] = useState(() => townDay(Date.now()));
  // the game as handlers and timers see it (the state above is its picture): written only in handlers
  const game = useRef<{ run: ShiftRun | null; order: ShiftOrder | null; judged: boolean; picks: Record<string, string>; from: number; ms: number; plays: number; timers: number[] }>({
    run: null,
    order: null,
    judged: false,
    picks: {},
    from: 0,
    ms: 0,
    plays: 0,
    timers: [],
  });
  const clearTimers = useCallback(() => {
    game.current.timers.forEach((t) => window.clearTimeout(t));
    game.current.timers = [];
  }, []);
  useEffect(() => {
    const g = game.current;
    return () => {
      g.timers.forEach((t) => window.clearTimeout(t));
      stopSpeaking();
    };
  }, []);

  const best = stored.best[def.id]?.score ?? 0;
  const xuLeft = shiftXuLeft(stored, def.id, today);
  const judgeRef = useRef<(p: ShiftPicks | null) => void>(() => undefined);

  /** The next request arrives and is said; the patience starts with its first word. */
  const call = useCallback(
    (r: ShiftRun): boolean => {
      const g = game.current;
      const next = currentOrder(r, def);
      if (!next) return false;
      const ms = Math.round(patienceSeconds(next.level, def.slots.length, r.lines.length) * 1000);
      g.order = next;
      g.judged = false;
      g.picks = {};
      g.from = Date.now();
      g.ms = ms;
      g.plays = 1;
      setOrder(next);
      setPicks({});
      setVerdict(null);
      setWait(ms);
      setHurry(false);
      void sayOrder(next);
      g.timers.push(window.setTimeout(() => setHurry(true), ms * HURRY_AT));
      g.timers.push(window.setTimeout(() => judgeRef.current(null), ms));
      return true;
    },
    [def],
  );

  const end = useCallback(
    (r: ShiftRun) => {
      game.current.order = null;
      setOrder(null);
      const res = finishShift(r);
      setResult(res);
      playSfx(res.record ? 'level' : 'task', sound);
      if (res.xu > 0) onReward({ label: res.record ? tl`Kỷ lục mới: ${def.name}` : tl`Xong một ca: ${def.name}`, xu: res.xu });
    },
    [def.name, onReward, sound],
  );

  /** The answer is in (null: the patience ran out): the verdict, then the next request or the result. */
  const judge = useCallback(
    (given: ShiftPicks | null) => {
      const g = game.current;
      const r = g.run;
      const o = g.order;
      if (!r || !o || g.judged) return;
      g.judged = true;
      clearTimers();
      stopSpeaking();
      const left = Math.max(0, 1 - (Date.now() - g.from) / g.ms);
      const after = answer(r, def, o, given, g.plays, left);
      const line = after.lines[after.lines.length - 1];
      const right = line.outcome === 'right';
      g.run = after;
      setRun(after);
      setVerdict({ order: o, right, late: line.outcome === 'late', points: line.points, picks: line.picks });
      playSfx(right ? (line.firstListen ? 'first' : 'right') : 'wrong', sound);
      // a right answer goes on by itself; a miss waits for the learner to read and hear it again (as the café does)
      if (right) {
        g.timers.push(
          window.setTimeout(() => {
            g.timers = [];
            if (runOver(after) || !call(after)) end(after);
          }, NEXT_RIGHT_MS),
        );
      }
    },
    [call, clearTimers, def, end, sound],
  );
  useEffect(() => {
    judgeRef.current = judge;
  }, [judge]);

  /** On to the next request (or the result). */
  const next = useCallback(() => {
    const g = game.current;
    const r = g.run;
    if (!r || !g.judged) return;
    clearTimers();
    stopSpeaking();
    if (runOver(r) || !call(r)) end(r);
  }, [call, clearTimers, end]);

  const open = useCallback(() => {
    const g = game.current;
    clearTimers();
    const state = loadTownShifts();
    const ok = (id: string) => state.orders[id]?.ok ?? 0;
    const r = startRun(def.id, drawShift(def, seededRng(Date.now()), missedLast(state, def.id), ok));
    g.run = r;
    g.order = null;
    g.judged = false;
    setBestBefore(state.best[def.id]?.score ?? 0);
    setRun(r);
    setResult(null);
    if (!call(r)) end(r);
  }, [call, clearTimers, def, end]);

  const again = useCallback(() => {
    const g = game.current;
    if (!g.order || g.judged) return;
    g.plays += 1;
    void sayOrder(g.order);
  }, []);

  const choose = useCallback((slotId: string, optionId: string) => {
    const g = game.current;
    if (g.judged || !g.order) return;
    g.picks = { ...g.picks, [slotId]: optionId };
    setPicks(g.picks);
  }, []);

  const done = useCallback(() => {
    if (allSet(def, game.current.picks)) judgeRef.current(game.current.picks);
  }, [def]);

  // Enter = "Xong" / next; R = hear it again; 1–8 = an option of the row that has the focus
  const playing = !!run && !!order && !result;
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const g = game.current;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (g.judged) {
          if (g.timers.length === 0) next();
        } else done();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        again();
      } else if (/^[1-8]$/.test(e.key) && !g.judged && e.target instanceof HTMLElement) {
        const row = e.target.closest<HTMLElement>('[data-shift-slot]');
        const slot = row ? def.slots.find((s) => s.id === row.dataset.shiftSlot) : undefined;
        const opt = slot?.options[Number(e.key) - 1];
        if (slot && opt) {
          e.preventDefault();
          choose(slot.id, opt.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, again, done, next, choose, def]);

  const missed = useMemo(
    () => (result && run ? run.lines.filter((l) => l.outcome !== 'right').map((l) => def.orders.find((o) => o.id === l.orderId)).filter((o): o is ShiftOrder => !!o) : []),
    [result, run, def],
  );

  // ── the result ──
  if (run && result) {
    const right = rightCount(run);
    const toBest = bestBefore - run.score;
    return (
      <div className="town-cafe">
        <h3 className="town-cafe-title">{result.record ? 'Kỷ lục mới!' : right >= 8 ? 'Một ca thật trơn tru' : 'Hết ca'}</h3>
        <p className="town-cafe-score">
          <span className="tabular">{run.score}</span> điểm
        </p>
        <ul className="town-cafe-facts">
          <li>{tl`Đúng ${right}/${run.lines.length} khách · chuỗi dài nhất ${run.bestCombo}`}</li>
          {!result.record && bestBefore > 0 && toBest > 0 && <li>{tl`Còn ${toBest} điểm nữa là phá kỷ lục ${bestBefore}`}</li>}
          {result.xu > 0 && (
            <li>
              <Coin size={15} /> +{result.xu} xu{result.capped ? ' (đã đủ xu của ca này hôm nay)' : ''}
            </li>
          )}
          {result.xu === 0 && result.capped && <li>Ca này đã trả đủ xu hôm nay; điểm và kỷ lục vẫn tính.</li>}
        </ul>
        {missed.length > 0 && (
          <div className="town-cafe-missed">
            <h4 className="town-cafe-sub">{tl`Nghe lại ${missed.length} yêu cầu bạn làm chưa đúng`}</h4>
            <ul className="town-cafe-missed-list">
              {missed.map((o) => (
                <MissedOrder key={o.id} def={def} order={o} />
              ))}
            </ul>
          </div>
        )}
        <div className="town-talk-foot">
          <button type="button" className="btn" onClick={onClose}>
            Xong
          </button>
          <button type="button" className="btn btn-primary" onClick={open} autoFocus>
            <Icon icon={RotateCcw} size={16} />
            Làm ca nữa
          </button>
        </div>
      </div>
    );
  }

  // ── on shift ──
  if (run && order) {
    const n = Math.min(run.queue.length, run.lines.length + (verdict ? 0 : 1));
    const heartsLeft = SHIFT_MISSES - run.misses;
    const wrong = verdict && !verdict.right ? new Set(wrongSlots(def, verdict.order, verdict.picks)) : new Set<string>();
    return (
      <div className="town-cafe">
        <div className="town-cafe-bar">
          <span className="town-cafe-hearts" role="img" aria-label={tl`Còn ${heartsLeft} lần sai`}>
            {Array.from({ length: SHIFT_MISSES }, (_, i) => (
              <Icon key={i} icon={Heart} size={16} className={i < heartsLeft ? 'is-on' : ''} fill={i < heartsLeft ? 'currentColor' : 'none'} />
            ))}
          </span>
          <span className="town-cafe-count">{tl`Khách ${n}/${run.queue.length}`}</span>
          {run.combo >= 2 && (
            <span className="town-cafe-combo">
              <Icon icon={Flame} size={14} />×{comboMultiplier(run.combo)}
            </span>
          )}
          <span className="town-cafe-points tabular">{run.score}</span>
        </div>

        <div className="town-cafe-guest">
          <div className="town-cafe-guest-body">
            {verdict ? (
              <span className={'town-cafe-verdict' + (verdict.right ? ' is-ok' : ' is-bad')}>{verdict.right ? tl`Đúng rồi! +${verdict.points}` : verdict.late ? 'Khách chờ lâu quá, đi mất rồi' : 'Chưa đúng'}</span>
            ) : (
              <>
                <span className="shift-wait">{hurry ? 'Khách sốt ruột rồi' : 'Khách đang chờ'}</span>
                <span key={order.id} className="town-cafe-patience" role="img" aria-label="Khách đang chờ">
                  <span className="town-cafe-patience-fill" style={{ animationDuration: `${wait}ms` }} />
                </span>
              </>
            )}
          </div>
          {!verdict && (
            <button type="button" className="btn btn-sm btn-soft" onClick={again} aria-keyshortcuts="R" title="Nghe lại (R): mất điểm thưởng nghe một lần">
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
            <ul className="shift-fix">
              {def.slots.map((s) => (
                <li key={s.id} className={wrong.has(s.id) ? 'is-bad' : 'is-ok'}>
                  <span className="shift-fix-label">{s.label}:</span> {optionLabel(def, s.id, verdict.order.answer[s.id])}
                  {wrong.has(s.id) && verdict.picks[s.id] && <span className="shift-fix-was">{tl`(bạn chọn ${optionLabel(def, s.id, verdict.picks[s.id])})`}</span>}
                </li>
              ))}
            </ul>
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
                {runOver(run) ? 'Xem kết quả' : 'Khách tiếp theo'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {def.slots.map((s) => (
              <div key={s.id} className="shift-slot" role="group" aria-label={s.label} data-shift-slot={s.id}>
                <span className="shift-slot-label">{s.label}</span>
                <ul className="shift-tiles">
                  {s.options.map((opt) => {
                    const on = picks[s.id] === opt.id;
                    return (
                      <li key={opt.id}>
                        <button type="button" className={'town-cafe-tile shift-tile' + (on ? ' is-on' : '')} onClick={() => choose(s.id, opt.id)} disabled={!!verdict} aria-pressed={on}>
                          {opt.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="town-talk-foot">
              <button type="button" className="btn btn-primary" onClick={done} disabled={!!verdict || !allSet(def, picks)} aria-keyshortcuts="Enter">
                Xong
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
      <p className="town-build-hint">{def.blurb}</p>
      <p className="town-build-hint">{tl`Mỗi ca ${SHIFT_ORDERS} khách. Nghe một lần mà làm đúng thì được thêm điểm; sai ${SHIFT_MISSES} lần là hết ca.`}</p>
      {best > 0 && (
        <ul className="town-cafe-facts">
          <li>
            Kỷ lục của bạn: <span className="tabular">{best}</span> điểm
          </li>
        </ul>
      )}
      <p className="town-build-hint">{xuLeft > 0 ? tl`Hôm nay ca này còn trả tới ${xuLeft} xu.` : 'Ca này đã trả đủ xu hôm nay; làm tiếp vẫn tính điểm và kỷ lục.'}</p>
      <div className="town-talk-foot">
        <button type="button" className="btn btn-primary" onClick={open} autoFocus>
          <Icon icon={Briefcase} size={16} />
          Vào ca
        </button>
      </div>
    </div>
  );
}

/** A missed request after the shift: how it sounds joined up, what it meant, what was wanted; to hear again. */
function MissedOrder({ def, order }: { def: ShiftDef; order: ShiftOrder }) {
  const decoded = useMemo(() => safeDecode(order.text), [order.text]);
  return (
    <li className="town-cafe-missed-row">
      {decoded.tokens.length > 0 ? (
        <SpokenSentence result={decoded} compact />
      ) : (
        <p className="town-cafe-said-en" lang="en">
          {order.text}
        </p>
      )}
      <p className="town-cafe-said-vi">{order.vi}</p>
      <p className="town-cafe-said-vi">{def.slots.map((s) => `${s.label}: ${optionLabel(def, s.id, order.answer[s.id])}`).join(' · ')}</p>
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
