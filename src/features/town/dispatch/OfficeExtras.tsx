// Before a shift at Rico's office (docs/town.md §30): the manager's daily word (Tess leaves one spoken line with a
// number; the learner picks what they heard: right keeps the day's takings, wrong loses part) and the office's three
// upgrades, bought with xu. The rules are core/town/office.ts, the IO core/town/officeStore.ts. No primary button
// here: the office's screen keeps "Bắt đầu ca" as its one.

import { useMemo, useState } from 'react';
import { Check, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { balance } from '../../../core/town/economy';
import { numberWords, OFFICE_UPGRADES, WORD_LOSS, type OfficeUpgradeId } from '../../../core/town/office';
import { buyOfficeUpgrade, officeNow, payWord } from '../../../core/town/officeStore';
import { loadTownProgress } from '../../../core/town/store';
import { MANAGER_WORDS } from '../../../data/city/dispatch/managerWords';
import { tl, tr } from '../../../i18n';
import { playSfx } from '../sfx';
import { sayDriver } from './dispatchVoice';

export interface OfficeExtrasProps {
  sound: boolean;
  onReward: (r: { label: string; xu?: number }) => void;
}

/** "240 bảng": a sum as the options show it. */
const pounds = (n: number): string => tl`${n} bảng`;

export default function OfficeExtras({ sound, onReward }: OfficeExtrasProps) {
  const [now] = useState(() => Date.now());
  const [version, setVersion] = useState(0);
  // (read again after a purchase or a word paid)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const office = useMemo(() => officeNow(now), [now, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const xu = useMemo(() => balance(loadTownProgress()), [version]);

  // ── the manager's word (as it was when the office opened: paying it must not take it off the screen) ──
  const [word] = useState(() => office.word);
  const [takings] = useState(() => office.takings);
  const line = word ? MANAGER_WORDS[word.gameDay % MANAGER_WORDS.length] : null;
  const [plays, setPlays] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const options = useMemo(() => {
    if (!word) return [];
    const list = [word.said, word.alike, word.other];
    const k = word.gameDay % 3;
    return [...list.slice(k), ...list.slice(0, k)];
  }, [word]);
  const listen = () => {
    if (!word || !line) return;
    setPlays((n) => n + 1);
    void sayDriver('tess', line.text.replace('{n}', numberWords(word.said)));
  };
  const pick = (n: number) => {
    if (!word || picked !== null) return;
    setPicked(n);
    const right = n === word.said;
    playSfx(right ? 'right' : 'wrong', sound);
    const got = payWord(word.gameDay, right);
    setPaid(got);
    if (got > 0) onReward({ label: 'Tiền thu của hãng', xu: got });
  };

  // ── the upgrades ──
  const [note, setNote] = useState<string | null>(null);
  const buy = (id: OfficeUpgradeId) => {
    const r = buyOfficeUpgrade(id);
    if (r.ok) {
      playSfx('build', sound);
      setNote(tl`Đã mua: ${r.item.name}. Có hiệu lực từ ca tới.`);
    } else setNote(r.reason === 'poor' ? tl`Còn thiếu ${r.missing} xu.` : 'Chưa mua được.');
    setVersion((v) => v + 1);
  };

  return (
    <div className="dsp-extras">
      {word && line && (
        <section className="dsp-word" aria-label="Lời nhắn của Tess">
          <h3 className="dsp-sub">Lời nhắn của Tess</h3>
          {picked === null ? (
            <>
              <p className="town-build-hint">{tl`Tess báo việc bằng lời, một lần mỗi ngày trong game. Nghe ra con số thì giữ trọn tiền thu (${takings} xu); nghe sót thì mất ${Math.round(WORD_LOSS * 100)}%.`}</p>
              <div className="dsp-word-row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={listen} disabled={plays >= 2}>
                  <Icon icon={Volume2} size={16} />
                  {plays === 0 ? 'Nghe lời nhắn' : 'Nghe lại (lần cuối)'}
                </button>
              </div>
              {plays > 0 && (
                <div className="dsp-word-ask" role="group" aria-label={line.q}>
                  <p className="dsp-word-q" data-vi>
                    {line.q}
                  </p>
                  <div className="dsp-word-opts">
                    {options.map((n) => (
                      <button key={n} type="button" className="dsp-word-opt" onClick={() => pick(n)}>
                        {pounds(n)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="dsp-word-done">
              <p className="dsp-word-verdict">
                <Icon icon={picked === word.said ? Check : X} size={16} />
                {picked === word.said ? tl`Đúng ${pounds(word.said)}. Giữ trọn tiền thu: +${paid ?? 0} xu.` : tl`Tess nói ${pounds(word.said)}, không phải ${pounds(picked)}. Còn lại +${paid ?? 0} xu.`}
              </p>
              <p className="dsp-word-en" lang="en">
                {line.text.replace('{n}', numberWords(word.said))}
              </p>
              <p className="town-build-hint" data-vi>
                {tr(line.vi).replace('{n}', String(word.said))}
              </p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={listen}>
                <Icon icon={Volume2} size={16} />
                Nghe lại
              </button>
            </div>
          )}
        </section>
      )}

      <section className="dsp-ups" aria-label="Nâng cấp văn phòng">
        <h3 className="dsp-sub">Nâng cấp văn phòng</h3>
        <ul className="dsp-up-list">
          {OFFICE_UPGRADES.map((u) => {
            const owned = office.owned.includes(u.id);
            return (
              <li key={u.id} className={'dsp-up' + (owned ? ' is-owned' : '')}>
                <div className="dsp-up-text">
                  <span className="dsp-up-name">{u.name}</span>
                  <span className="dsp-up-blurb">{u.blurb}</span>
                  <span className="dsp-up-take">{tl`Tiền thu +${u.takings} xu mỗi ngày game`}</span>
                </div>
                {owned ? (
                  <span className="dsp-up-owned">
                    <Icon icon={Check} size={15} />
                    Đã có
                  </span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm dsp-up-buy" onClick={() => buy(u.id)} disabled={xu < u.cost} title={xu < u.cost ? tl`Còn thiếu ${u.cost - xu} xu` : undefined}>
                    {tl`Mua · ${u.cost} xu`}
                  </button>
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
      </section>
    </div>
  );
}
