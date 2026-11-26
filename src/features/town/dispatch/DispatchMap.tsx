// The map on the gatehouse wall (docs/town.md §27): Westbay from above, north up, drawn from the city's own tiles
// (data/cityWorld.ts: streets, squares, water, sand, the buildings), with the places a car can be sent to and Rico's
// three cars. The whole city first, its districts named; a tap (or a district's button) zooms into a district, where
// every place carries the name on its sign (English: what the caller says) and is a button. The cars are buttons in
// both views. Drawn as an SVG in tile units with the buttons laid over it in HTML, so text keeps its size (13 px and
// up) at any zoom and every target is big enough for a finger.

import { useState, type CSSProperties } from 'react';
import { ArrowLeft, Building2, Car } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import type { Car as ShiftCar, DriverId } from '../../../core/town/dispatch';
import { tl, tr } from '../../../i18n';
import { CITY_PLACES, CITY_ROWS, CITY_SIZE, CITY_WORLD } from '../../../data/cityWorld';
import { DISPATCH_PLACES, OFFICE_AT } from '../../../data/city/dispatch';
import { westbayNet } from '../../../core/town/streets';
import { placeVi } from '../../../data/city/dispatch/names';
import type { Slot } from './useDispatchShift';
import { DOORS, DRIVER_NAME } from './useDispatchShift';

interface View {
  x: number;
  y: number;
  s: number;
}
const WHOLE: View = { x: 0, y: 0, s: CITY_SIZE };

/** One path per kind of ground: runs of the same tile along each row. */
function groundPaths(): Record<string, string> {
  const out: Record<string, string[]> = { road: [], square: [], water: [], sand: [], tree: [] };
  const kind = (ch: string) => (ch === '=' ? 'road' : ch === 'o' || ch === 'F' ? 'square' : ch === '~' ? 'water' : ch === ':' || ch === 'p' ? 'sand' : ch === 'T' || ch === 't' ? 'tree' : null);
  CITY_ROWS.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const k = kind(row[x]);
      let e = x + 1;
      while (e < row.length && kind(row[e]) === k) e++;
      if (k) out[k].push(`M${x} ${y}h${e - x}v1h${x - e}z`);
      x = e;
    }
  });
  const blocks: string[] = [];
  for (const p of CITY_PLACES) blocks.push(`M${p.x} ${p.y}h${p.w}v${p.d}h${-p.w}z`);
  for (const sc of CITY_WORLD.scenery ?? []) if (sc.kind === 'block') for (const t of sc.tiles) blocks.push(`M${t.x} ${t.y}h1v1h-1z`);
  return { ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join('')])), block: blocks.join('') };
}

const PATHS = groundPaths();

/** The places, with their labels above, below, or higher above, in turn along each street, so neighbours do not sit on each other. */
const PLACES = (() => {
  const list = DISPATCH_PLACES.flatMap((p) => (DOORS[p.id] ? [{ ...p, at: DOORS[p.id] }] : [])).sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
  let row = -99;
  let n = 0;
  return list.map((p) => {
    if (Math.abs(p.at.y - row) >= 2) {
      row = p.at.y;
      n = 0;
    }
    const tier = n++ % 3;
    return { ...p, tier };
  });
})();

const DISTRICTS = (CITY_WORLD.districts ?? []).filter((d) => d.id !== 'w-bay');
/** A district's square view (a little room round it, kept on the map). */
function districtView(id: string): View {
  const d = DISTRICTS.find((x) => x.id === id)!;
  const s = Math.min(CITY_SIZE, Math.max(d.w, d.d) + 6);
  const cx = d.x + d.w / 2;
  const cy = d.y + d.d / 2;
  return { x: Math.max(0, Math.min(CITY_SIZE - s, cx - s / 2)), y: Math.max(0, Math.min(CITY_SIZE - s, cy - s / 2)), s };
}
/** The district a point of the map is in (the nearest one's middle when it is in none, e.g. the bay). */
function districtAt(x: number, y: number): string {
  const inside = DISTRICTS.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.d);
  if (inside) return inside.id;
  return [...DISTRICTS].sort((a, b) => Math.hypot(a.x + a.w / 2 - x, a.y + a.d / 2 - y) - Math.hypot(b.x + b.w / 2 - x, b.y + b.d / 2 - y))[0].id;
}

export interface DispatchMapProps {
  cars: readonly ShiftCar[];
  /** What is tapped now: a place (pickup or destination) or a car; null between calls. */
  slot: Slot | null;
  from: string | null;
  to: string | null;
  car: DriverId | null;
  /** The pickup and destination the cars are driving to (their legs), to mark on the map. */
  onPlace: (id: string) => void;
  onCar: (id: DriverId) => void;
  /** The better map (core/town/office.ts): the streets' names, in a district's view. */
  streetNames?: boolean;
}

/** Each street's name where it runs, the middle of the stretch a view shows of it. */
const NET = westbayNet();

export default function DispatchMap({ cars, slot, from, to, car, onPlace, onCar, streetNames = false }: DispatchMapProps) {
  const [zoom, setZoom] = useState<string | null>(null);
  const view = zoom ? districtView(zoom) : WHOLE;
  const pos = (p: { x: number; y: number }): CSSProperties => ({ left: `${((p.x - view.x) / view.s) * 100}%`, top: `${((p.y - view.y) / view.s) * 100}%` });
  /** A label near the map's left or right edge is anchored inside it (else it is cut off). */
  const edge = (p: { x: number }): string => {
    const k = (p.x - view.x) / view.s;
    return k < 0.15 ? ' is-left' : k > 0.85 ? ' is-right' : '';
  };
  const inView = (p: { x: number; y: number }) => p.x >= view.x && p.x <= view.x + view.s && p.y >= view.y && p.y <= view.y + view.s;
  const office = DOORS[OFFICE_AT];
  const picking = slot === 'from' || slot === 'to';

  return (
    <div className="dsp-map-wrap">
      <div className="dsp-map-bar" role="group" aria-label="Khu trên bản đồ">
        {zoom ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom(null)}>
            <Icon icon={ArrowLeft} size={16} />
            Cả thành phố
          </button>
        ) : null}
        {DISTRICTS.map((d) => (
          <button key={d.id} type="button" className={'dsp-chip' + (zoom === d.id ? ' is-on' : '')} aria-pressed={zoom === d.id} onClick={() => setZoom(zoom === d.id ? null : d.id)}>
            {d.name}
          </button>
        ))}
      </div>
      <div
        className={'dsp-map' + (zoom ? ' is-zoomed' : '') + (picking ? ' is-picking' : '')}
        onClick={(e) => {
          if (zoom) return;
          const box = e.currentTarget.getBoundingClientRect();
          setZoom(districtAt(((e.clientX - box.left) / box.width) * CITY_SIZE, ((e.clientY - box.top) / box.height) * CITY_SIZE));
        }}
      >
        <svg className="dsp-ground" viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <rect className="dsp-grass" x={0} y={0} width={CITY_SIZE} height={CITY_SIZE} />
          <path className="dsp-water" d={PATHS.water} />
          <path className="dsp-sand" d={PATHS.sand} />
          <path className="dsp-tree" d={PATHS.tree} />
          <path className="dsp-square" d={PATHS.square} />
          <path className="dsp-road" d={PATHS.road} />
          <path className="dsp-block" d={PATHS.block} />
          {cars.map((c) => (c.route.length > 0 ? <polyline key={c.id} className={'dsp-route is-' + c.id} points={[c.at, ...c.route].map((p) => `${p.x},${p.y}`).join(' ')} /> : null))}
        </svg>

        {!zoom &&
          DISTRICTS.map((d) => (
            <span key={d.id} className={'dsp-district' + edge({ x: d.x + d.w / 2 })} style={pos({ x: d.x + d.w / 2, y: d.y + d.d / 2 })}>
              {d.name}
            </span>
          ))}

        {PLACES.map((p) => {
          const mark = p.id === from ? 'from' : p.id === to ? 'to' : null;
          if (!zoom)
            return <span key={p.id} className={'dsp-dot' + (mark ? ' is-' + mark : '')} style={pos(p.at)} aria-hidden="true" />;
          if (!inView(p.at)) return null;
          return (
            <button
              key={p.id}
              type="button"
              className={'dsp-place' + (p.tier === 1 ? ' is-below' : p.tier === 2 ? ' is-high' : '') + edge(p.at) + (mark ? ' is-' + mark : '')}
              style={pos(p.at)}
              lang="en"
              title={tr(placeVi(p.id))}
              aria-label={`${p.label} (${tr(placeVi(p.id))})`}
              disabled={!picking}
              onClick={(e) => {
                e.stopPropagation();
                onPlace(p.id);
              }}
            >
              <span className="dsp-place-dot" aria-hidden="true" />
              <span className="dsp-place-label">{p.label}</span>
            </button>
          );
        })}

        {zoom &&
          streetNames &&
          NET.streets.map((st) => {
            // the part of the street inside the view, and a point along it (between its two lanes)
            const lo = Math.max(st.from, st.axis === 'x' ? view.x : view.y);
            const hi = Math.min(st.to + 1, st.axis === 'x' ? view.x + view.s : view.y + view.s);
            const across = st.at + 1;
            const acrossIn = st.axis === 'x' ? across >= view.y && across <= view.y + view.s : across >= view.x && across <= view.x + view.s;
            if (hi - lo < 4 || !acrossIn) return null;
            // (off the middle, where the crossings and the busiest labels are: a quarter along east–west, 0.7 north–south)
            const mid = lo + (hi - lo) * (st.axis === 'x' ? 0.25 : 0.7);
            const at = st.axis === 'x' ? { x: mid, y: across } : { x: across, y: mid };
            return (
              <span key={st.id} className={'dsp-street' + (st.axis === 'y' ? ' is-ns' : '')} style={pos(at)} lang="en" aria-hidden="true">
                {st.name}
              </span>
            );
          })}

        {office && inView(office) && (
          <span className="dsp-office" style={pos(office)} title="Trạm gác cũ: văn phòng của Rico">
            <Icon icon={Building2} size={14} />
          </span>
        )}

        {cars.map((c) =>
          inView(c.at) ? (
            <button
              key={c.id}
              type="button"
              className={'dsp-car is-' + c.id + ((c.at.y - view.y) / view.s > 0.88 ? ' is-low' : '') + edge(c.at) + (car === c.id ? ' is-picked' : '')}
              style={pos(c.at)}
              aria-label={tl`Xe của ${DRIVER_NAME[c.id]}`}
              disabled={slot === null}
              onClick={(e) => {
                e.stopPropagation();
                onCar(c.id);
              }}
            >
              <Icon icon={Car} size={14} />
              <span className="dsp-car-name">{DRIVER_NAME[c.id]}</span>
            </button>
          ) : null,
        )}
      </div>
    </div>
  );
}
