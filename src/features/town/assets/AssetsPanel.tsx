// The learner's assets in Westbay (core/town/assets.ts, docs/town.md §34): the stall on Market Street (Amira), the
// workshop (Theo), the Bay FM sponsorship (Kit). Each is bought with xu; once owned, its manager gives a spoken report
// once a game day with two things to hear (sound first, then the two questions, the words after): both right keeps the
// day's takings, each one wrong loses part. The rules are core/town/assets.ts, the IO core/town/assetsStore.ts. One
// primary button: "Nghe báo cáo" of the asset this panel was opened for (else the first report waiting).

import { useMemo, useState } from 'react';
import { Check, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { CAREFUL_LABEL } from '../../../core/playback';
import { ASSET_LOSS, ASSETS, asset, reportWrong, type AssetId, type AssetReport } from '../../../core/town/assets';
import { assetsNow, buyAsset, payReport } from '../../../core/town/assetsStore';
import { cityPerson } from '../../../core/town/cityPeople';
import { balance } from '../../../core/town/economy';
import { loadTownProgress } from '../../../core/town/store';
import { stopSpeaking } from '../../../core/tts';
import { tl } from '../../../i18n';
import { sayJobLine } from '../jobs/jobAudio';
import { playSfx } from '../sfx';
import './assets.css';

export interface AssetsPanelProps {
  /** The asset whose manager the learner stands beside (its report gets the primary button). */
  focus?: AssetId | null;
  sound: boolean;
  onReward: (r: { label: string; xu?: number }) => void;
}

const nameOf = (who: string): string => cityPerson(who)?.name ?? who;

function Report({ report, primary, sound, onReward }: { report: AssetReport; primary: boolean; sound: boolean; onReward: AssetsPanelProps['onReward'] }) {
  const a = asset(report.asset)!;
  const [plays, setPlays] = useState(0);
  const [picks, setPicks] = useState<Partial<Record<'a' | 'b', string>>>({});
  const [paid, setPaid] = useState<number | null>(null);
  const say = (careful = false) => {
    stopSpeaking();
    void sayJobLine({ who: report.who, text: report.text }, 2, { careful });
  };
  const listen = () => {
    setPlays((n) => n + 1);
    say();
  };
  const choose = (key: 'a' | 'b', value: string) => {
    if (paid !== null || picks[key] !== undefined) return;
    const next = { ...picks, [key]: value };
    setPicks(next);
    if (next.a === undefined || next.b === undefined) return;
    const wrong = reportWrong(report, next);
    playSfx(wrong === 0 ? 'right' : 'wrong', sound);
    const got = payReport(report.asset, report.gameDay, wrong);
    setPaid(got);
    if (got > 0) onReward({ label: a.name, xu: got });
  };
  if (paid !== null) {
    const wrong = reportWrong(report, picks);
    return (
      <div className="ast-report ast-done">
        <p className="ast-verdict">
          <Icon icon={wrong === 0 ? Check : X} size={16} />
          {wrong === 0 ? tl`Nghe đủ cả hai. Giữ trọn tiền thu: +${paid} xu.` : tl`Nghe sót ${wrong} điều. Còn lại +${paid} xu.`}
        </p>
        <ul className="ast-answers">
          {report.questions.map((q) => {
            const right = q.options.find((o) => o.value === q.answer)!;
            const got = q.options.find((o) => o.value === picks[q.key]);
            return (
              <li key={q.key} className={picks[q.key] === q.answer ? 'is-right' : 'is-wrong'}>
                <span className="ast-q">{q.q}</span> {right.label}
                {picks[q.key] !== q.answer && got && <span className="ast-was">{tl`(bạn chọn ${got.label})`}</span>}
              </li>
            );
          })}
        </ul>
        <p className="ast-en" lang="en">
          {report.text}
        </p>
        <p className="town-build-hint" data-vi>
          {report.vi}
        </p>
        <div className="ast-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => say()}>
            <Icon icon={Volume2} size={15} />
            Nghe lại
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => say(true)}>
            <Icon icon={Turtle} size={15} />
            {CAREFUL_LABEL}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="ast-report">
      <div className="ast-row">
        <button type="button" className={primary && plays === 0 ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={listen} disabled={plays >= 2}>
          <Icon icon={Volume2} size={16} />
          {plays === 0 ? tl`Nghe ${nameOf(report.who)} báo cáo` : 'Nghe lại (lần cuối)'}
        </button>
      </div>
      {plays > 0 &&
        report.questions.map((q) => (
          <div key={q.key} className="ast-ask" role="group" aria-label={q.q}>
            <p className="ast-q">{q.q}</p>
            <div className="ast-opts">
              {q.options.map((o) => (
                <button key={o.value} type="button" className="ast-opt" aria-pressed={picks[q.key] === o.value} disabled={picks[q.key] !== undefined} onClick={() => choose(q.key, o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

export default function AssetsPanel({ focus = null, sound, onReward }: AssetsPanelProps) {
  const [now] = useState(() => Date.now());
  const [version, setVersion] = useState(0);
  // the reports as they were when the panel opened (answering one must not take it off the screen)
  const [reports, setReports] = useState(() => new Map<AssetId, AssetReport>(assetsNow(now).filter((x) => x.report).map((x) => [x.id, x.report!])));
  // (read again after a purchase)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = useMemo(() => assetsNow(now), [now, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const xu = useMemo(() => balance(loadTownProgress()), [version]);
  const lead = focus && reports.has(focus) ? focus : ([...reports.keys()][0] ?? null);
  const [note, setNote] = useState<string | null>(null);
  const buy = (id: AssetId) => {
    const r = buyAsset(id);
    if (r.ok) {
      playSfx('build', sound);
      setNote(tl`Đã mua: ${r.item.name}.`);
      // the first report waits at once
      const fresh = assetsNow(Date.now()).find((x) => x.id === id)?.report;
      if (fresh) setReports((m) => new Map(m).set(id, fresh));
    } else setNote(r.reason === 'poor' ? tl`Còn thiếu ${r.missing} xu.` : 'Chưa mua được.');
    setVersion((v) => v + 1);
  };
  return (
    <div className="ast-panel">
      <p className="town-build-hint">{tl`Mỗi tài sản có một người quản lý gọi báo việc bằng lời, mỗi ngày game một lần. Nghe ra đủ hai điều thì giữ trọn tiền thu; mỗi điều nghe sót mất ${Math.round(ASSET_LOSS * 100)}%.`}</p>
      <ul className="ast-list">
        {ASSETS.map((a) => {
          const s = state.find((x) => x.id === a.id)!;
          const report = reports.get(a.id);
          return (
            <li key={a.id} className={'ast-card' + (a.id === focus ? ' is-focus' : '')}>
              <div className="ast-head">
                <div className="ast-text">
                  <span className="ast-name">{a.name}</span>
                  <span className="ast-meta">{tl`Quản lý: ${nameOf(a.manager)} · tiền thu ${a.takings} xu mỗi ngày game`}</span>
                  <span className="ast-blurb">{a.blurb}</span>
                </div>
                {s.owned ? (
                  <span className="ast-owned">
                    <Icon icon={Check} size={15} />
                    Đã có
                  </span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm ast-buy" onClick={() => buy(a.id)} disabled={xu < a.cost} title={xu < a.cost ? tl`Còn thiếu ${a.cost - xu} xu` : undefined}>
                    {tl`Mua · ${a.cost} xu`}
                  </button>
                )}
              </div>
              {report ? (
                <Report report={report} primary={a.id === lead} sound={sound} onReward={onReward} />
              ) : (
                s.owned && <p className="town-build-hint">{tl`Hôm nay đã nghe báo cáo của ${nameOf(a.manager)}. Ngày game sau có báo cáo mới.`}</p>
              )}
            </li>
          );
        })}
      </ul>
      {note && (
        <p className="town-build-hint" role="status">
          {note}
        </p>
      )}
      <p className="town-build-hint">Xu là điểm trò chơi, không đo trình độ. Người quản lý nói bằng giọng của trình duyệt, ít nối âm hơn người thật.</p>
    </div>
  );
}
