import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { LocateFixed, Minus, Plus, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import type { TownOverview } from '../../../core/town/overview';
import { TOWN_WORLD, type PlaceId } from '../../../data/townWorld';
import type { ActivitySpotId } from '../../../data/townWorld';
import { Portrait } from '../art';
import { paletteFor, type TownTheme } from '../engine/palette';
import type { MapSnapshot, StageState, TownStageHandle, TravelMode, TravelTarget } from '../engine/stage';
import { drawMap, mapScene } from './drawMap';
import { badgeLegend, cardFor, mainMode, mapBadges, residentLabel, sameTarget } from './mapCard';
import { PLACE_ART } from './mapGeo';
import { hitMap, hitShapes } from './mapHit';
import { placeLabels, type LabelCandidate, type Rect } from './mapLabels';
import { arrowRotation, clampView, MAP_READABLE, MAP_TILT, MAP_YAW0, openView, panBy, scaleLimits, toBox, zoomAt, type Box, type MapView } from './mapView';
import { MarkerBadge, PlayerArrow } from './mapArt';
import { MAP_ACTIVITY_ICONS } from './mapArtData';
import FriendHearts from '../friends/FriendHearts';
import './map.css';
import { tl, tr } from '../../../i18n';


/** A drag shorter than this (CSS px) is a click. */
const CLICK_SLOP = 5;
/** The map's own controls along the top (the title, the close and zoom buttons): names keep out (CSS px). */
const TOP_BAND = 60;
const TOOLS_W = 60;

export interface TownMapProps {
  stage: RefObject<TownStageHandle | null>;
  /** The stage as it was when the map opened (the camera's turn, where the player stands). */
  start: MapSnapshot | null;
  overview: TownOverview;
  state: StageState;
  /** The resident the main button suggests: their badge shows (and the re-listens due), nobody else's. */
  hint: PlaceId | null;
  theme: TownTheme;
  /** A warp's dip to dark is under way: the map fades away and takes no input. */
  leaving?: boolean;
  onClose: () => void;
  onTravel: (target: TravelTarget, mode: TravelMode) => void;
  /** The Sổ tay at a resident (their hearts on the card). */
  onJournal?: (placeId: string) => void;
}

/** Where the pin of a picked patch of ground stands. */
function pinStyle(v: MapView, box: Box, at: { x: number; y: number }): CSSProperties {
  const p = toBox(v, box, at.x, at.y);
  return { transform: `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)` };
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** The width of a text in the page's font (CSS px), measured once. */
function textWidth(text: string, font: string): number {
  if (measureCtx === undefined) measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!measureCtx) return text.length * 7.5;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * "Bản đồ": the whole town seen from high up, always turned the default way (never with the camera), over the stage. Everything on it is live (the
 * player, the residents where they are now); pick a place, a resident, an activity or a patch of ground and its card
 * offers "Đi tới" (walk) and "Đến ngay" (a short dip to dark and you are there). Drag / wheel / pinch to look round.
 */
export default function TownMap({ stage, start, overview, state, hint, theme, leaving = false, onClose, onTravel, onJournal }: TownMapProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meRef = useRef<HTMLSpanElement>(null);
  const goalRef = useRef<HTMLSpanElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /** The stage's latest read (the live loop); `seen`: the one the words on the page were made from (the last pick). */
  const snap = useRef<MapSnapshot | null>(start);
  const [seen, setSeen] = useState<MapSnapshot | null>(start);
  // the map never turns with the camera: it always lies the default way, like the minimap (the owner, 2026-11-23:
  // turning the 3D view must not turn the map)
  const yaw = MAP_YAW0;
  const [opensAt] = useState(() => start?.player ?? TOWN_WORLD.start);
  const [box, setBox] = useState<Box>({ w: 0, h: 0 });
  /** Where the learner has looked (null: as it opened); always shown within the limits of the box. */
  const [userView, setUserView] = useState<MapView | null>(null);
  const [picked, setPicked] = useState<TravelTarget | null>(null);
  // a phone: smaller faces, so the town shows between them
  const [narrow] = useState(() => {
    try {
      return window.matchMedia('(max-width: 720px)').matches;
    } catch {
      return false;
    }
  });
  const size = TOWN_WORLD.size;
  const limits = useMemo(() => (box.w > 0 ? scaleLimits(box, size, yaw, MAP_TILT) : { min: 1, max: 60 }), [box, size, yaw]);
  const view = useMemo(
    () => (box.w < 1 ? null : userView ? clampView(userView, size, limits) : openView(box, size, yaw, MAP_TILT, opensAt)),
    [box, userView, size, limits, yaw, opensAt],
  );
  const viewRef = useRef(view);
  const boxRef = useRef(box);
  useEffect(() => {
    viewRef.current = view;
    boxRef.current = box;
  });
  /** Look elsewhere: `op` gets the view on the screen now. */
  const setView = useCallback((op: (v: MapView) => MapView) => {
    setUserView((u) => {
      const v = u ?? viewRef.current;
      return v ? op(v) : u;
    });
  }, []);

  const built = state.built;
  const sites = state.sites;
  const decorations = state.decorations;
  const scene = useMemo(
    () => mapScene({ built: new Set(built), sites: sites ? new Set(sites) : null, decorations: new Set(decorations) }, TOWN_WORLD),
    [built, sites, decorations],
  );
  const shapes = useMemo(() => hitShapes(TOWN_WORLD), []);
  const badges = useMemo(() => mapBadges(state.marker, hint), [state.marker, hint]);
  const legend = useMemo(() => badgeLegend(badges, hint), [badges, hint]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  // the box: the stage's size; the first time, the view it opens with
  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w < 1 || h < 1) return;
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // the picture: again when the view, the town or the theme changes
  const selectedPlace = picked?.kind === 'place' ? picked.id : null;
  useLayoutEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !view || box.w < 1) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(box.w * dpr);
    const h = Math.round(box.h * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    drawMap(ctx, scene, view, box, dpr, paletteFor(theme), { selected: selectedPlace });
  }, [view, box, scene, theme, selectedPlace]);

  // the live part: the player, the residents and the walk's goal, every frame from the stage
  useEffect(() => {
    const loop = { id: 0 };
    const tick = () => {
      loop.id = requestAnimationFrame(tick);
      const s = stage.current?.mapSnapshot() ?? null;
      if (s) snap.current = s;
      const v = viewRef.current;
      const b = boxRef.current;
      const now = snap.current;
      if (!v || b.w < 1 || !now) return;
      const me = meRef.current;
      if (me) {
        const p = toBox(v, b, now.player.x, now.player.y);
        me.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        me.style.setProperty('--town-map-turn', `${arrowRotation(now.player.heading, v.yaw, v.tilt).toFixed(3)}rad`);
        me.hidden = false;
      }
      const g = goalRef.current;
      if (g) {
        if (now.goal) {
          const p = toBox(v, b, now.goal.x + 0.5, now.goal.y + 0.5);
          g.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          g.hidden = false;
        } else g.hidden = true;
      }
      const layer = layerRef.current;
      for (const r of now.residents) {
        const el = layer?.querySelector<HTMLButtonElement>(`.town-map-who[data-id="${r.id}"]`);
        if (!el) continue;
        const p = toBox(v, b, r.x, r.y, 0.7);
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        el.toggleAttribute('data-inside', r.inside);
        el.hidden = false;
      }
    };
    loop.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loop.id);
  }, [stage]);

  // ───────────────────────── looking round: drag, wheel, pinch, keys ─────────────────────────

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; moved: boolean; pinch: number; mid: { x: number; y: number } | null } | null>(null);
  const dragged = useRef(false);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = surfaceRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      gesture.current = { x: p.x, y: p.y, moved: false, pinch: 0, mid: null };
      dragged.current = false;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { x: p.x, y: p.y, moved: true, pinch: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      dragged.current = true;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    const p = local(e);
    const was = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size >= 2 && g.mid) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const factor = g.pinch > 0 ? d / g.pinch : 1;
      const from = g.mid;
      setView((v) => panBy(zoomAt(v, boxRef.current, factor, mid.x, mid.y, size, limits), mid.x - from.x, mid.y - from.y, size, limits));
      g.pinch = d;
      g.mid = mid;
      return;
    }
    if (!g.moved && Math.hypot(p.x - g.x, p.y - g.y) < CLICK_SLOP) return;
    if (!g.moved) {
      g.moved = true;
      dragged.current = true;
      surfaceRef.current?.setPointerCapture?.(e.pointerId);
    }
    setView((v) => panBy(v, p.x - was.x, p.y - was.y, size, limits));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const had = pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1 && g) {
      // one finger left after a pinch: it drags on from where it is
      const [rest] = [...pointers.current.values()];
      gesture.current = { x: rest.x, y: rest.y, moved: true, pinch: 0, mid: null };
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    // the click a drag ends with lands in this task (pick ignores it); the next one counts, from the keys too
    if (dragged.current)
      window.setTimeout(() => {
        dragged.current = false;
      }, 0);
    if (!had || !g || g.moved || leaving) return;
    // a click on the picture itself (the buttons over it answer for themselves)
    if (e.target !== canvasRef.current) return;
    const v = viewRef.current;
    if (!v) return;
    const p = local(e);
    setSeen(snap.current);
    setPicked(hitMap(v, boxRef.current, p.x, p.y, shapes, TOWN_WORLD));
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
  };

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(-Math.max(-300, Math.min(300, e.deltaY * k)) * 0.0016);
      setView((v) => zoomAt(v, boxRef.current, factor, e.clientX - r.left, e.clientY - r.top, size, limits));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size, limits, setView]);

  const zoom = useCallback(
    (factor: number) => setView((v) => zoomAt(v, boxRef.current, factor, boxRef.current.w / 2, boxRef.current.h / 2, size, limits)),
    [size, limits, setView],
  );
  const centreOnPlayer = useCallback(() => {
    const p = snap.current?.player;
    if (!p) return;
    setView((v) => clampView({ ...v, cx: p.x, cy: p.y, scale: Math.max(v.scale, MAP_READABLE * 1.8) }, size, limits));
  }, [size, limits, setView]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    let done = true;
    if (k === 'Escape') {
      if (picked) setPicked(null);
      else onClose();
    } else if (e.code === 'KeyM') onClose();
    else if (k === '+' || k === '=') zoom(1.35);
    else if (k === '-' || k === '_') zoom(1 / 1.35);
    else if (k === 'ArrowLeft') setView((v) => panBy(v, 80, 0, size, limits));
    else if (k === 'ArrowRight') setView((v) => panBy(v, -80, 0, size, limits));
    else if (k === 'ArrowUp') setView((v) => panBy(v, 0, 80, size, limits));
    else if (k === 'ArrowDown') setView((v) => panBy(v, 0, -80, size, limits));
    else done = false;
    if (done) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  /** A button over the map was pressed: after a drag that started on it, nothing (the drag was the point). */
  const pick = (t: TravelTarget) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setSeen(snap.current);
    setPicked((old) => (sameTarget(old, t) ? old : t));
  };

  // ───────────────────────── names and buttons on the map ─────────────────────────

  const font = useMemo(() => {
    try {
      return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    } catch {
      return 'system-ui, sans-serif';
    }
  }, []);
  const card = picked ? cardFor(picked, overview.places, seen?.residents ?? [], TOWN_WORLD) : null;
  const activitySpots = useMemo(() => {
    if (!view || box.w < 1) return [];
    return (Object.entries(TOWN_WORLD.activities ?? {}) as [ActivitySpotId, { look: { x: number; y: number } }][]).map(([id, s]) => {
      const p = toBox(view, box, s.look.x, s.look.y, 0.5);
      return { id, x: p.x, y: p.y };
    });
  }, [view, box]);
  const labels = useMemo(() => {
    if (!view || box.w < 1) return [];
    const cands: (LabelCandidate & { kind: 'place' | 'district' | 'inn'; text: string; status?: 'built' | 'site' | 'lot' })[] = [];
    const placeNames = new Set(overview.places.map((p) => p.place.name));
    for (const p of overview.places) {
      const wp = TOWN_WORLD.places.find((q) => q.id === p.place.id);
      if (!wp) continue;
      const site = !p.built && (!state.sites || state.sites.includes(p.place.id));
      const status = p.built ? 'built' : site ? 'site' : 'lot';
      const h = p.built ? (PLACE_ART[wp.id]?.h ?? 0.8) + 0.15 : 0.6;
      const at = toBox(view, box, wp.x + wp.w / 2, wp.y + wp.d / 2, h);
      const text = tr(p.place.name);
      cands.push({
        id: `place:${wp.id}`,
        kind: 'place',
        text,
        status,
        x: at.x,
        y: at.y,
        w: Math.ceil(textWidth(text, `600 13px ${font}`)) + 18,
        h: 24,
        priority: status === 'built' ? 100 : status === 'site' ? 70 : 30,
        sides: ['above', 'right', 'left', 'below'],
      });
    }
    const inn = TOWN_WORLD.props.find((q) => q.kind === 'inn');
    if (inn && inn.tiles.length > 0) {
      const xs = inn.tiles.map((t) => t.x);
      const ys = inn.tiles.map((t) => t.y);
      const at = toBox(view, box, (Math.min(...xs) + Math.max(...xs) + 1) / 2, (Math.min(...ys) + Math.max(...ys) + 1) / 2, 1.35);
      const innName = tr('Nhà trọ');
      cands.push({ id: 'inn', kind: 'inn', text: innName, x: at.x, y: at.y, w: Math.ceil(textWidth(innName, `600 13px ${font}`)) + 18, h: 24, priority: 60, sides: ['above', 'right', 'left'] });
    }
    for (const d of TOWN_WORLD.districts ?? []) {
      if (placeNames.has(d.name)) continue;
      const at = toBox(view, box, d.x + d.w / 2, d.y + d.d / 2);
      const text = tr(d.name).toLocaleUpperCase('vi');
      const w = Math.ceil(textWidth(text, `600 13px ${font}`) + text.length * 1.3) + 4;
      cands.push({ id: `district:${d.id}`, kind: 'district', text, x: at.x, y: at.y, w, h: 18, priority: 85, sides: ['center', 'below', 'above'] });
      // elsewhere in the district when its middle is taken: a third of the way towards each corner of its box
      for (const [fx, fy] of [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.3, 0.7],
        [0.7, 0.7],
      ]) {
        const alt = toBox(view, box, d.x + d.w * fx, d.y + d.d * fy);
        cands.push({ id: `district:${d.id}`, kind: 'district', text, x: alt.x, y: alt.y, w, h: 18, priority: 50, sides: ['center'] });
      }
    }
    const blocked: Rect[] = [
      { left: 0, top: 0, w: box.w, h: TOP_BAND },
      { left: box.w - TOOLS_W, top: 0, w: TOOLS_W, h: TOP_BAND + 140 },
      ...activitySpots.map((a) => ({ left: a.x - 17, top: a.y - 17, w: 34, h: 34 })),
    ];
    const placed = placeLabels(cands, box, blocked, { pad: 4 });
    const byId = new Map(cands.map((c) => [c.id, c]));
    return placed.map((p) => ({ ...p, cand: byId.get(p.id)! }));
  }, [view, box, overview.places, state.sites, font, activitySpots]);


  const places = overview.places;
  const main = picked ? mainMode(picked, seen?.player ?? TOWN_WORLD.start, seen?.residents ?? [], TOWN_WORLD) : 'walk';
  const travel = (mode: TravelMode) => {
    if (!picked || leaving) return;
    onTravel(picked, mode);
  };

  return (
    <div
      ref={rootRef}
      className={'town-map' + (leaving ? ' is-leaving' : '')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div
        ref={surfaceRef}
        className="town-map-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <canvas ref={canvasRef} className="town-map-canvas" aria-hidden="true" />
        <div ref={layerRef} className="town-map-layer">
          {labels.map((l) => {
            const style: CSSProperties = { transform: `translate(${Math.round(l.left)}px, ${Math.round(l.top)}px)`, width: Math.round(l.w) };
            if (l.cand.kind === 'district')
              return (
                <span key={l.id} className="town-map-district" style={style} aria-hidden="true">
                  {l.cand.text}
                </span>
              );
            if (l.cand.kind === 'inn')
              return (
                <span key={l.id} className="town-map-label is-static" style={style} aria-hidden="true">
                  {l.cand.text}
                </span>
              );
            const id = l.id.slice('place:'.length) as PlaceId;
            const on = picked?.kind === 'place' && picked.id === id;
            return (
              <button
                key={l.id}
                type="button"
                className={'town-map-label is-' + l.cand.status + (on ? ' is-on' : '')}
                style={style}
                onClick={() => pick({ kind: 'place', id })}
                aria-label={l.cand.status === 'built' ? l.cand.text : tl`${l.cand.text}, chưa xây`}
              >
                {l.cand.text}
              </button>
            );
          })}
          {activitySpots.map((a) => {
            const on = picked?.kind === 'activity' && picked.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                className={'town-map-act' + (on ? ' is-on' : '')}
                style={{ transform: `translate(${Math.round(a.x)}px, ${Math.round(a.y)}px)` }}
                onClick={() => pick({ kind: 'activity', id: a.id })}
                aria-label={cardFor({ kind: 'activity', id: a.id }, places, [])?.title ?? a.id}
                title={cardFor({ kind: 'activity', id: a.id }, places, [])?.title}
              >
                <Icon icon={MAP_ACTIVITY_ICONS[a.id]} size={15} />
              </button>
            );
          })}
          <span ref={goalRef} className="town-map-goal" hidden aria-hidden="true" />
          {picked?.kind === 'tile' && view && <span className="town-map-pin" style={pinStyle(view, box, picked)} aria-hidden="true" />}
          {places.map((p) => {
            const id = p.place.id as PlaceId;
            const on = picked?.kind === 'resident' && picked.id === id;
            const marker = badges[id];
            const r = seen?.residents.find((x) => x.id === id);
            return (
              <button
                key={id}
                data-id={id}
                type="button"
                hidden
                className={'town-map-who' + (on ? ' is-on' : '') + (narrow ? ' is-small' : '') + (marker ? ' has-badge' : '')}
                onClick={() => pick({ kind: 'resident', id })}
                aria-label={residentLabel(p, r, TOWN_WORLD)}
              >
                <Portrait placeId={id} size={narrow ? 22 : 28} />
                {marker && <MarkerBadge marker={marker} />}
              </button>
            );
          })}
          <span ref={meRef} className="town-map-me" hidden role="img" aria-label="Bạn đang ở đây">
            <PlayerArrow />
          </span>
        </div>
      </div>

      <header className="town-map-head">
        <h2 id={titleId} className="town-map-title">
          Bản đồ
          <span className="town-map-hint">Chọn một nơi để tới</span>
        </h2>
        {legend.length > 0 && (
          <ul className="town-map-legend">
            {legend.map((l) => (
              <li key={l.text}>
                <MarkerBadge marker={l.marker} size={14} />
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </header>
      <div className="town-map-tools">
        <button type="button" className="town-pill town-hud-btn town-hud-icon" onClick={onClose} aria-label="Đóng bản đồ" title="Đóng bản đồ (M hoặc Esc)">
          <Icon icon={X} size={18} />
        </button>
        <div className="town-map-zoom">
          <button type="button" className="town-pill town-hud-btn town-hud-icon" onClick={() => zoom(1.35)} aria-label="Phóng to" title="Phóng to (+)">
            <Icon icon={Plus} size={17} />
          </button>
          <button type="button" className="town-pill town-hud-btn town-hud-icon" onClick={() => zoom(1 / 1.35)} aria-label="Thu nhỏ" title="Thu nhỏ (−)">
            <Icon icon={Minus} size={17} />
          </button>
          <button type="button" className="town-pill town-hud-btn town-hud-icon" onClick={centreOnPlayer} aria-label="Về chỗ bạn đứng" title="Về chỗ bạn đứng">
            <Icon icon={LocateFixed} size={17} />
          </button>
        </div>
      </div>

      {card && picked && (
        <section className="town-map-card" aria-label={card.title} aria-live="polite">
          <div className="town-map-card-top">
            {card.portrait && picked.kind !== 'activity' && picked.kind !== 'tile' ? (
              <Portrait placeId={card.portrait} size={40} />
            ) : card.activity ? (
              <span className="town-map-card-icon" aria-hidden="true">
                <Icon icon={MAP_ACTIVITY_ICONS[card.activity]} size={20} />
              </span>
            ) : null}
            <div className="town-map-card-body">
              <p className="town-map-card-title">{card.title}</p>
              {card.sub && <p className="town-map-card-sub">{card.sub}</p>}
              {card.wait && <p className="town-map-card-wait">{card.wait}</p>}
              {card.friend && card.portrait && (
                <FriendHearts friend={card.friend} name={overview.places.find((p) => p.place.id === card.portrait)?.place.resident ?? card.title} onJournal={onJournal ? () => onJournal(card.portrait!) : undefined} />
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setPicked(null)} aria-label="Bỏ chọn" title="Bỏ chọn (Esc)">
              <Icon icon={X} size={16} />
            </button>
          </div>
          <div className="town-map-card-actions">
            <button type="button" className={'btn btn-sm ' + (main === 'walk' ? 'btn-primary' : 'btn-soft')} onClick={() => travel('walk')}>
              Đi tới
            </button>
            <button type="button" className={'btn btn-sm ' + (main === 'warp' ? 'btn-primary' : 'btn-soft')} onClick={() => travel('warp')}>
              Đến ngay
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
