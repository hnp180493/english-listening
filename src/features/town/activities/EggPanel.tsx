// "Tiệm trứng" (docs/town.md §10): the eggs in hand, opening one (a little show: the egg wobbles, cracks, bursts in
// the light of its tier, the item appears), buying one for 40 xu, and, honestly, how eggs are earned by listening,
// the odds of each tier and the pity count. The store (core/town/gameStore) decides everything; this is the show.
// One primary button at a time: "Ấp trứng" with an egg in hand, else "Mua trứng".

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CircleHelp, Coins, Egg as EggIcon, Sparkles } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { buyTownEgg, equipTownItem, hatchTownEgg, useTownGame } from '../../../core/town/gameStore';
import type { Hatch } from '../../../core/town/eggs';
import type { LookSlot } from '../../../core/town/progress';
import { playSfx } from '../sfx';
import type { ActivityPanelProps } from './types';
import { EGG_ART, LOOT_TIER_ART } from './eggs/eggArt';
import { eggAction, GRANT_WAYS, grantCounts, hatchLabel, hatchPhase, HATCH_SHOW, HATCH_SHOW_STILL, oddsRows, pityText, revealText, WEAR_VERB, type HatchPhase } from './eggs/eggModel';
import { LootPicture } from './eggs/LootPicture';
import { TierGem } from './eggs/TierGem';
import './eggs/eggs.css';
import { tl, tr } from '../../../i18n';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The egg in the shop: speckled, wobbling while it hatches, cracked, then gone in a burst of its tier's light. */
function EggPicture({ phase, glow }: { phase: HatchPhase; glow: string | null }) {
  const cracked = phase === 'crack' || phase === 'burst';
  return (
    <svg className={`town-egg-svg is-${phase}`} viewBox="0 0 120 140" aria-hidden="true" focusable="false">
      {glow && (
        <g className="town-egg-rays" style={{ color: glow }}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M60 74 L56 6 L64 6 Z" fill="currentColor" transform={`rotate(${i * 30} 60 74)`} />
          ))}
          <circle cx="60" cy="74" r="34" fill="currentColor" />
        </g>
      )}
      <ellipse cx="60" cy="130" rx="30" ry="6" style={{ fill: EGG_ART.outline }} opacity="0.16" />
      <g className="town-egg-body">
        <path d="M60 22 C 84 22, 96 62, 96 88 C 96 112, 80 128, 60 128 C 40 128, 24 112, 24 88 C 24 62, 36 22, 60 22 Z" style={{ fill: EGG_ART.shell, stroke: EGG_ART.outline }} strokeWidth="2.5" />
        <path d="M42 112 C 52 122, 74 122, 86 106 C 84 120, 70 127, 60 127 C 50 127, 44 122, 42 112 Z" style={{ fill: EGG_ART.shade }} />
        {[
          [44, 64, 6, 0],
          [72, 52, 5, 1],
          [78, 90, 7, 2],
          [50, 98, 5, 3],
          [62, 76, 4, 1],
          [38, 86, 4, 2],
        ].map(([x, y, r, c]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} style={{ fill: EGG_ART.speckles[c] }} />
        ))}
        {cracked && (
          <path className="town-egg-crack" d="M30 70 L42 78 L50 66 L60 80 L70 66 L80 78 L90 68" fill="none" style={{ stroke: EGG_ART.crack }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}

export default function EggPanel({ onReward, sound }: ActivityPanelProps) {
  const game = useTownGame();
  const eggs = game.eggs;
  const [hatch, setHatch] = useState<Hatch | null>(null);
  const [phase, setPhase] = useState<HatchPhase>('rest');
  const [worn, setWorn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );
  const later = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms));

  const busy = phase !== 'rest' && phase !== 'reveal';
  const action = eggAction(eggs);

  const open = () => {
    if (busy) return;
    const r = hatchTownEgg();
    if (!r.ok) {
      setNote(r.reason === 'no-egg' ? 'Bạn chưa có quả trứng nào.' : 'Chưa mở được trứng trên trình duyệt này, thử tải lại trang nhé.');
      return;
    }
    setNote(r.saved ? null : 'Không lưu được vào máy này: món mới chỉ còn trong lần mở này.');
    setHatch(r.hatch);
    setWorn(false);
    const still = reducedMotion();
    setPhase(hatchPhase(0, still));
    playSfx('pop', sound);
    const text = revealText(r.hatch);
    const reveal = () => {
      setPhase('reveal');
      playSfx(text.big ? 'level' : 'first', sound);
      if (r.hatch.duplicate && r.hatch.xu > 0) onReward({ label: tl`${r.hatch.item.name}: đã có, đổi thành ${r.hatch.xu} xu`, xu: r.hatch.xu });
      later(60, () => primaryRef.current?.focus({ preventScroll: true }));
    };
    if (still) {
      later(HATCH_SHOW_STILL, reveal);
      return;
    }
    later(HATCH_SHOW.crack, () => {
      setPhase('crack');
      playSfx('pop', sound);
    });
    later(HATCH_SHOW.burst, () => setPhase('burst'));
    later(HATCH_SHOW.reveal, reveal);
  };

  const buy = () => {
    if (busy) return;
    const r = buyTownEgg();
    if (!r.ok) {
      setNote(r.reason === 'poor' ? tl`Còn thiếu ${r.missing} xu. Xu chỉ đến từ việc nghe hiểu ở thị trấn.` : 'Chưa mua được trên trình duyệt này, thử tải lại trang nhé.');
      return;
    }
    playSfx('coin', sound);
    setHatch(null);
    setPhase('rest');
    setNote(r.saved ? tl`Đã mua một quả trứng (−${eggs.cost} xu).` : 'Không lưu được vào máy này: quả trứng chỉ còn trong lần mở này.');
  };

  const wear = () => {
    if (!hatch || hatch.duplicate) return;
    const slot: LookSlot = hatch.item.kind;
    const r = equipTownItem(slot, hatch.item.id);
    if (r.ok) {
      setWorn(true);
      playSfx('right', sound);
    }
  };

  const reveal = phase === 'reveal' && hatch ? revealText(hatch) : null;
  const tierArt = hatch ? LOOT_TIER_ART[hatch.tier] : null;
  const glow = phase === 'burst' && tierArt ? tierArt.glow : null;
  const grants = grantCounts(eggs.grants);
  const odds = oddsRows(eggs.odds);

  const primary =
    action === 'hatch' ? (
      <button ref={primaryRef} type="button" className="btn btn-primary town-egg-main" onClick={open} disabled={busy}>
        <Icon icon={Sparkles} size={18} />
        {reveal ? (eggs.inHand > 1 ? tl`Ấp quả tiếp (còn ${eggs.inHand})` : 'Ấp quả tiếp') : hatchLabel(eggs.inHand)}
      </button>
    ) : (
      <button ref={primaryRef} type="button" className="btn btn-primary town-egg-main" onClick={buy} disabled={busy || action === 'none'}>
        <Icon icon={Coins} size={18} />
        Mua trứng · {eggs.cost} xu
      </button>
    );

  return (
    <div className="town-egg">
      <div className={`town-egg-stage${reveal ? ' is-reveal' : ''}`} style={tierArt && reveal ? ({ '--town-egg-tier': tierArt.glow } as CSSProperties) : undefined}>
        {reveal && hatch ? (
          <div className="town-egg-reveal">
            <span className={`town-egg-badge${hatch.duplicate ? ' is-dup' : ''}`}>{reveal.badge}</span>
            <LootPicture item={hatch.item} size={112} animate />
            <p className="town-egg-kind">
              <TierGem tier={hatch.tier} />
              {reveal.kindLine}
            </p>
            <p className="town-egg-name">{reveal.name}</p>
            <p className="town-egg-note">{reveal.note}</p>
            {!hatch.duplicate &&
              (worn ? (
                <p className="town-egg-worn">Đã dùng. Đổi lại trong Tủ đồ.</p>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={wear}>
                  {WEAR_VERB[hatch.item.kind]}
                </button>
              ))}
          </div>
        ) : (
          <EggPicture phase={eggs.inHand > 0 || busy ? phase : 'rest'} glow={glow} />
        )}
      </div>

      <p className="town-egg-count" aria-live="polite">
        {busy ? (
          'Trứng đang nở…'
        ) : eggs.inHand > 0 ? (
          <>
            Bạn có <strong>{eggs.inHand}</strong> {tr('quả trứng chưa mở.', eggs.inHand)}
          </>
        ) : (
          'Bạn chưa có quả trứng nào.'
        )}
      </p>

      {primary}
      {action === 'hatch' && eggs.canBuy && !busy && (
        <button type="button" className="btn btn-ghost btn-sm town-egg-buy" onClick={buy}>
          <Icon icon={Coins} size={16} />
          Mua thêm · {eggs.cost} xu
        </button>
      )}
      {action === 'none' && (
        <p className="town-egg-short">
          Còn thiếu {eggs.missing} xu (bạn có {game.balance}). Nghe hiểu ở thị trấn để có xu, hoặc nhận trứng tặng bên dưới.
        </p>
      )}
      {note && <p className="town-egg-short">{note}</p>}

      <p className="town-egg-pity">
        <Icon icon={EggIcon} size={16} />
        {pityText(eggs.toPity)}
      </p>

      <section className="town-egg-ways" aria-labelledby="town-egg-ways-h">
        <h3 id="town-egg-ways-h" className="town-egg-h">
          Trứng tặng khi bạn nghe tốt
        </h3>
        <ul className="town-egg-list">
          {GRANT_WAYS.map((w) => {
            const got = grants.find((g) => g.kind === w.kind)?.count ?? 0;
            return (
              <li key={w.kind}>
                <span>{w.label}</span>
                {got > 0 && <span className="town-egg-got">đã nhận {got}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <details className="how town-egg-how">
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Tỉ lệ ra đồ, nói thật
        </summary>
        <div className="stack-sm">
          <table className="town-egg-odds">
            <thead>
              <tr>
                <th scope="col">Loại</th>
                <th scope="col">Tỉ lệ</th>
                <th scope="col">Nếu trùng</th>
              </tr>
            </thead>
            <tbody>
              {odds.map((o) => (
                <tr key={o.tier}>
                  <th scope="row">
                    <TierGem tier={o.tier} />
                    {o.name}
                  </th>
                  <td>{o.share}</td>
                  <td>+{o.dupXu} xu</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Mỗi quả ra một món: thú cưng, mũ, màu áo hoặc danh hiệu. Món bạn chưa có dễ ra hơn món đã có gấp ba lần. Cứ 10 quả mở trên máy này thì chắc chắn có ít nhất
            một món Quý trở lên. Món trùng đổi ra xu, luôn ít hơn giá một quả trứng, nên mua trứng không bao giờ lời xu.
          </p>
          <p>Tất cả chỉ là đồ trang trí cho vui: không làm câu nào dễ nghe hơn, cũng không đo được tai bạn nghe giỏi đến đâu.</p>
        </div>
      </details>
    </div>
  );
}
