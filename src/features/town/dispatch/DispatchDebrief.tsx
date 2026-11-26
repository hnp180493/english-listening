// The end of a shift at Rico's dispatch office (core/town/dispatch.ts summarize): what was heard right the first time,
// what needed a repeat, what went wrong and how the world answered, then every call with its meaning, "Nghe"
// (connected) and "Rõ từng từ" (careful, now that it gives nothing away), the calls heard wrong marked (they are in
// Ôn tập now), and the radio. "Nghe 1 lần là đúng" only when it was: no repeat, both places right.

import { useMemo } from 'react';
import { Check, PhoneCall, Radio, RotateCcw, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL } from '../../../core/playback';
import type { CallResult, DispatchCall } from '../../../core/town/dispatch';
import { tl, tr } from '../../../i18n';
import { dispatchCall } from '../../../data/city/dispatch';
import { placeVi } from '../../../data/city/dispatch/names';
import { safeDecode } from '../../dictation/decodeCache';
import { Coin } from '../art';
import '../scenes/scenes.css';
import { hush, sayCaller, sayDriver } from './dispatchVoice';
import { DRIVER_NAME, type DispatchRun, type LoggedLine } from './useDispatchShift';

export interface DispatchDebriefProps {
  run: DispatchRun;
  onAgain: () => void;
  onClose: () => void;
}

function Words({ line, call, missed }: { line: LoggedLine; call: DispatchCall | null; missed: boolean }) {
  const decoded = useMemo(() => safeDecode(line.text), [line.text]);
  const play = (careful: boolean) => {
    hush();
    if (line.who === 'caller' && call) void sayCaller({ call, text: line.text, careful, again: line.kind === 'again' });
    else if (line.who !== 'caller') void sayDriver(line.who, line.text, careful);
  };
  return (
    <li className={'town-ls-line' + (missed ? ' dsp-missed' : '')}>
      <span className="town-ls-line-who">
        {line.who === 'caller' ? (line.kind === 'again' ? 'Khách nói lại' : line.kind === 'callback' ? 'Khách gọi lại' : 'Khách') : DRIVER_NAME[line.who]}
        {missed && <span className="dsp-missed-tag">Nghe hụt · đã vào Ôn tập</span>}
      </span>
      {decoded.tokens.length > 0 ? (
        <SpokenSentence result={decoded} compact />
      ) : (
        <p className="town-ls-en" lang="en">
          {line.text}
        </p>
      )}
      <p className="town-ls-vi" data-vi>
        {line.vi}
      </p>
      <div className="town-ls-line-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => play(false)}>
          <Icon icon={Volume2} size={15} />
          Nghe
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => play(true)}>
          <Icon icon={Turtle} size={15} />
          {CAREFUL_LABEL}
        </button>
      </div>
    </li>
  );
}

/** One call's outcome in a line. */
function outcome(r: CallResult, picked: { from: string | null; to: string | null }, call: DispatchCall): { ok: boolean; text: string } {
  if (r.stolen) return { ok: false, text: r.answered ? 'Để khách chờ lâu quá: Bayline đón mất.' : 'Chưa kịp nghe máy: Bayline đón mất.' };
  const parts: string[] = [];
  if (r.fromWrong && picked.from) parts.push(tl`Đón nhầm ở ${tr(placeVi(picked.from))} (khách ở ${tr(placeVi(call.from))})`);
  if (r.toWrong && picked.to) parts.push(tl`Chở nhầm tới ${tr(placeVi(picked.to))} (khách muốn đi ${tr(placeVi(call.to))})`);
  if (parts.length > 0) return { ok: false, text: parts.join('. ') + '.' };
  const extra = [r.once ? 'Nghe 1 lần là đúng.' : tl`Đúng, sau ${r.asks} lần nhắc lại.`, r.near === false ? 'Xe gửi đi ở xa, khách chờ lâu.' : ''].filter(Boolean);
  return { ok: true, text: extra.join(' ') };
}

export default function DispatchDebrief({ run, onAgain, onClose }: DispatchDebriefProps) {
  const sum = run.summary!;
  const end = run.end!;
  const calls = run.shift?.calls ?? [];
  const answered = sum.results.filter((r) => r.answered);
  const radio = run.log.filter((l) => l.kind === 'radio');
  return (
    <div className="dsp-debrief">
      <div className="dsp-score">
        <p className="dsp-score-big">
          <span className="tabular">{sum.once}/{answered.length}</span> nghe 1 lần là đúng
          {end.xu > 0 && (
            <span className="town-gain">
              <Coin size={16} />+{end.xu}
            </span>
          )}
        </p>
        <ul className="dsp-score-list">
          <li>{tl`Cần nhắc lại: ${sum.repeated}`}</li>
          <li>{tl`Nghe nhầm chỗ: ${sum.wrong}`}</li>
          <li>{tl`Bayline lấy mất: ${sum.stolen}`}</li>
        </ul>
        <p className="town-build-hint">
          {end.capped ? 'Hôm nay đã đủ hai ca có xu. ' : ''}
          {end.enrolled > 0 ? tl`${end.enrolled} cuộc gọi nghe nhầm đã vào Ôn tập.` : ''}
        </p>
        <p className="town-build-hint">
          Xu là điểm trò chơi, không đo trình độ. Khách và tài xế nói bằng giọng của trình duyệt, ít nối âm hơn người thật. Câu nào khó, bấm "Nghe" thêm vài lần trước khi qua ca sau.
        </p>
        <p className="town-build-hint">Số đo thật của game là "nghe 1 lần là đúng" trên điều nghe lần đầu: <a href="#/stats?view=report">xem ở Báo cáo tiến bộ</a>.</p>
      </div>

      {answered.length === 0 && sum.stolen === 0 ? (
        <p className="town-build-hint">Ca này chưa nghe cuộc gọi nào.</p>
      ) : (
        <>
          <h3 className="town-ls-sub">
            <Icon icon={PhoneCall} size={16} /> Từng cuộc gọi
          </h3>
          <ol className="dsp-calls">
            {calls.map((c, i) => {
              const r = sum.results[i];
              const o = outcome(r, { from: c.firstFrom, to: c.firstTo }, c.call);
              const said = run.log.filter((l) => l.call === c.call.id);
              const call = dispatchCall(c.call.id) ?? c.call;
              return (
                <li key={c.call.id} className={'dsp-call-res' + (o.ok ? ' is-right' : ' is-wrong')}>
                  <p className="dsp-call-res-head">
                    <Icon icon={o.ok ? Check : X} size={15} />
                    <span>
                      {tr(placeVi(c.call.from))} → {tr(placeVi(c.call.to))}
                      {r.xu > 0 && <span className="dsp-call-xu tabular">{tl`+${r.xu} xu`}</span>}
                    </span>
                  </p>
                  <p className="dsp-call-res-note">{o.text}</p>
                  {said.length > 0 && (
                    <ol className="town-ls-lines">
                      {said.map((l) => (
                        <Words key={l.key} line={l} call={call} missed={l.kind === 'call' && (r.fromWrong || r.toWrong)} />
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {radio.length > 0 && (
        <details className="dsp-radio">
          <summary>
            <Icon icon={Radio} size={16} /> {tl`Bộ đàm (${radio.length} câu)`}
          </summary>
          <ol className="town-ls-lines">
            {radio.map((l) => (
              <Words key={l.key} line={l} call={null} missed={false} />
            ))}
          </ol>
        </details>
      )}

      <div className="dsp-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Về Westbay
        </button>
        <button type="button" className="btn btn-primary" onClick={onAgain} autoFocus>
          <Icon icon={RotateCcw} size={16} />
          Thêm một ca
        </button>
      </div>
    </div>
  );
}
