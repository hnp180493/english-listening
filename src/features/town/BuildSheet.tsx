import { useEffect, useId, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import type { DecorationView, PlaceView, TownOverview } from '../../core/town/overview';
import { Coin } from './art';
import { paintThumb } from './engine/thumb';
import { decorationRows, lotRows, primaryBuy, xu } from './shellModel';

/** The thing itself, small: drawn by the town's own drawing code. */
function Thumb({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintThumb(ref.current, id, 56, 52);
  }, [id]);
  return <canvas ref={ref} className="town-thumb" aria-hidden="true" />;
}

export interface BuildSheetProps {
  overview: TownOverview;
  /** The empty lot the learner clicked in the world: listed first. */
  wanted: string | null;
  onBuy: (id: string) => void;
  onClose: () => void;
}

/**
 * What xu can buy: the ten empty lots ("Công trình") and the decorations ("Trang trí"). A side sheet on a wide
 * stage, a bottom sheet on a phone. One row's button is the primary action: the first thing the learner can pay.
 */
export default function BuildSheet({ overview, wanted, onBuy, onClose }: BuildSheetProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, []);

  const lots = lotRows(overview.places);
  if (wanted) {
    const i = lots.findIndex((p) => p.place.id === wanted);
    if (i > 0) lots.unshift(...lots.splice(i, 1));
  }
  const decorations = decorationRows(overview.decorations);
  const main = primaryBuy(
    lots,
    decorations.filter((d) => !d.bought),
    wanted,
  );

  const buyButton = (id: string, verb: string, name: string, cost: number) => (
    <button type="button" className={'btn btn-sm town-buy ' + (id === main ? 'btn-primary' : 'btn-soft')} onClick={() => onBuy(id)} aria-label={`${verb} ${name}, ${xu(cost)}`}>
      {verb}
      <span className="town-buy-cost">
        <Coin size={15} />
        {cost}
      </span>
    </button>
  );
  const price = (cost: number) => (
    <span className="town-price" aria-hidden="true">
      <Coin size={15} />
      {cost}
    </span>
  );

  const lotRow = (p: PlaceView) => (
    <li key={p.place.id} className={'town-row' + (p.place.id === wanted ? ' is-wanted' : '')}>
      <Thumb id={p.place.id} />
      <span className="town-row-body">
        <span className="town-row-title">{p.place.name}</span>
        <span className="town-row-meta">
          {p.affordable ? `${p.place.resident} · ${p.place.topic}` : `${p.place.resident} · còn thiếu ${xu(p.missing)}`}
          {!p.affordable && <span className="sr-only">, giá {xu(p.cost)}</span>}
        </span>
      </span>
      {p.affordable ? buyButton(p.place.id, 'Xây', p.place.name, p.cost) : price(p.cost)}
    </li>
  );

  const decorationRow = (d: DecorationView) => (
    <li key={d.decoration.id} className={'town-row' + (d.bought ? ' is-owned' : '')}>
      <Thumb id={d.decoration.id} />
      <span className="town-row-body">
        <span className="town-row-title">{d.decoration.name}</span>
        {d.bought ? (
          <span className="town-row-meta">Đã có trong thị trấn</span>
        ) : !d.affordable ? (
          <span className="town-row-meta">
            Còn thiếu {xu(d.missing)}
            <span className="sr-only">, giá {xu(d.cost)}</span>
          </span>
        ) : null}
      </span>
      {d.bought ? (
        <span className="town-owned" aria-hidden="true">
          <Icon icon={Check} size={16} strokeWidth={2.6} />
        </span>
      ) : d.affordable ? (
        buyButton(d.decoration.id, 'Mua', d.decoration.name, d.cost)
      ) : (
        price(d.cost)
      )}
    </li>
  );

  return (
    <aside
      ref={boxRef}
      className="town-build"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <header className="town-build-head">
        <h2 id={titleId} className="town-build-title">
          Xây thị trấn
        </h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body">
        {!overview.canBuySomething && <p className="town-build-hint">Chưa đủ xu để xây gì. Xu chỉ có khi bạn hiểu điều người dân nói.</p>}
        {lots.length > 0 && (
          <section className="town-build-group">
            <h3 className="town-build-h">Công trình</h3>
            <ul className="town-rows">{lots.map(lotRow)}</ul>
          </section>
        )}
        <section className="town-build-group">
          <h3 className="town-build-h">Trang trí</h3>
          <ul className="town-rows">{decorations.map(decorationRow)}</ul>
        </section>
      </div>
    </aside>
  );
}
