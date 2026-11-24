// "Nông trại" (docs/town.md §10): Ôn tập drawn as a field. Every card due in Ôn tập is a ripe crop; harvesting is
// reviewing it there (the primary action goes to #/review); back here, the reviews of today are paid as a harvest
// (claimHarvest), with the golden crop when today's review is done. Nothing is harvested by a click alone.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Droplets } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { navigate } from '../../../core/nav';
import { useReview } from '../../../core/review/useReview';
import { nextSessionPlan } from '../../review/sessionPlan';
import { WILT_DAYS } from '../../../core/town/farm';
import { checkTownUnlocks, claimHarvest, useTownFarm } from '../../../core/town/gameStore';
import { clearTownCelebrations, type TownCelebration } from '../../../core/town/store';
import { Coin } from '../art';
import { playSfx } from '../sfx';
import { Basket, GoldenCrop, GrowthRing, Mound, PlotBed } from './farm/farmArt';
import {
  capText,
  cropsShown,
  farmScreen,
  FARM_KIND_LABEL,
  fieldSections,
  goldenText,
  plotLabel,
  plotPercent,
  plotStatus,
  restingText,
  resultLines,
  rewardLabel,
  wiltText,
  type FarmButton,
  type FarmScreen,
  type HarvestShown,
} from './farm/farmView';
import { useFarmInk } from './farm/useFarmInk';
import type { ActivityPanelProps } from './types';
import './farm/farm.css';
import { tr } from '../../../i18n';

interface Claimed extends HarvestShown {
  celebrations: TownCelebration[];
}

function HeroArt({ art, ink }: { art: FarmScreen['art']; ink: ReturnType<typeof useFarmInk> }) {
  if (art === 'golden') return <GoldenCrop size={80} ink={ink} />;
  if (art === 'basket') return <Basket size={72} ink={ink} />;
  return <Mound size={72} ink={ink} sprout={art === 'sprout'} />;
}

export default function FarmPanel({ onClose, onReward, sound }: ActivityPanelProps) {
  const { field, harvest } = useTownFarm();
  const snap = useReview();
  const { summary, now } = snap;
  const ink = useFarmInk();
  const [claimed, setClaimed] = useState<Claimed | null>(null);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

  // goals that need Ôn tập's facts ("Vườn lâu năm") are recorded when the field is looked at
  useEffect(() => {
    checkTownUnlocks();
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  // "Thu hoạch" opens Ôn tập's next session: the same plan its start card shows (size within the budget, minutes)
  const plan = useMemo(() => nextSessionPlan(snap), [snap]);
  const today = { dueToday: summary.dueToday, session: { size: plan.size, minutes: plan.minutes, split: plan.split }, nextAt: summary.nextAt, tracked: summary.tracked };
  const screen = farmScreen(field, harvest, today, now);
  const sections = fieldSections(field);
  const golden = goldenText(harvest, today);
  const wilt = wiltText(field.wilting);
  const resting = restingText(field.resting);

  const claim = () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = claimHarvest();
      if (r.cards === 0 && !r.golden) return;
      const shown: Claimed = { cards: r.cards, golden: r.golden, earned: r.earned, tasksPaid: r.tasksPaid, celebrations: r.celebrations };
      setClaimed(shown);
      // shown here, where the learner is looking: the page's queue must not celebrate them a second time
      if (r.celebrations.length) clearTownCelebrations(r.celebrations.map((c) => c.key));
      onReward({ label: rewardLabel(shown), xu: r.earned });
      playSfx('pop', sound);
      if (r.golden) timers.current.push(window.setTimeout(() => playSfx('level', sound), 900));
    } finally {
      busy.current = false;
    }
  };

  const act = (b: FarmButton) => {
    if (b.to === 'claim') claim();
    else if (b.to === 'review') navigate('review', { from: 'town' });
    else onClose();
  };

  return (
    <div className="town-farm">
      {claimed && (
        <div className={'town-farm-result' + (claimed.golden ? ' is-golden' : '')} role="status">
          {claimed.golden ? <GoldenCrop size={92} ink={ink} /> : <Basket size={72} ink={ink} />}
          <div className="town-farm-result-text">
            <p className="town-farm-earned">
              <Coin size={22} />+{claimed.earned} xu
            </p>
            <ul className="town-farm-lines">
              {resultLines(claimed).map((l) => (
                <li key={l}>{l}</li>
              ))}
              {claimed.celebrations.map((c) => (
                <li key={c.key}>
                  <span className="town-farm-cele">{c.label}</span>
                  {c.detail ? ` · ${tr(c.detail)}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {claimed ? (
        // the result card is the top now: only what comes next stays, so the action keeps its place on a phone
        screen.detail && <p className="town-farm-detail">{screen.detail}</p>
      ) : (
        <div className="town-farm-hero">
          <HeroArt art={screen.art} ink={ink} />
          <div className="town-farm-hero-text">
            <p className="town-farm-headline">{screen.headline}</p>
            {screen.detail && <p className="town-farm-detail">{screen.detail}</p>}
          </div>
        </div>
      )}

      <div className="town-farm-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => act(screen.primary)}>
          {screen.primary.label}
        </button>
        {screen.secondary && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => act(screen.secondary!)}>
            {screen.secondary.label}
          </button>
        )}
        {screen.kind !== 'empty' && (
          <p className="town-farm-meta">
            {capText(harvest)}
            {golden ? ` ${golden}` : ''}
          </p>
        )}
      </div>

      {sections.map((s) => (
        <section key={s.id} className="town-farm-section" aria-label={s.title}>
          <h3 className="town-farm-h">{s.title}</h3>
          <ul className="town-farm-field">
            {s.plots.map((p) => {
              const pct = plotPercent(p);
              return (
                <li key={p.id} className="town-farm-plot" data-state={p.state}>
                  <PlotBed kind={p.kind} state={p.state} growth={p.growth} shown={cropsShown(p.count)} ink={ink} label={plotLabel(p, now)} />
                  {pct !== null && (
                    <span className="town-farm-grow" aria-hidden="true">
                      <GrowthRing pct={pct} />
                      {pct}%
                    </span>
                  )}
                  <p className="town-farm-kind" aria-hidden="true">
                    {FARM_KIND_LABEL[p.kind]}
                  </p>
                  <p className="town-farm-status" aria-hidden="true">
                    {plotStatus(p, now)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {wilt && (
        <p className="town-farm-note">
          <Icon icon={Droplets} size={16} />
          <span>{wilt}</span>
        </p>
      )}
      {resting && <p className="town-farm-meta">{resting}</p>}

      <details className="how">
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Vì sao cây chín theo lịch ôn?
        </summary>
        <ul className="stack-sm town-farm-how">
          <li>Mỗi cây là một mục của Ôn tập: câu bạn từng nghe sai, cụm từ, từ vựng, câu ở thị trấn. Cây chín đúng lúc bạn sắp quên mục đó: ôn đúng lúc thì nhớ lâu, ôn sớm quá chẳng thêm được bao nhiêu.</li>
          <li>Thu hoạch là ôn ở Ôn tập, không có nút nào thay cho việc nghe. Ôn xong, quay lại đây nhận xu.</li>
          <li>Cây héo khi quá hạn hơn {WILT_DAYS} ngày. Không bị phạt gì: ôn xong là tươi lại, lịch ôn tự điều chỉnh theo bạn.</li>
          <li>Xu chỉ là điểm trò chơi: trả cho việc ôn, không đo bạn nhớ được bao nhiêu. Cây vàng nghĩa là xong phần ôn hôm nay, chưa phải đã thuộc hết.</li>
        </ul>
      </details>
    </div>
  );
}
