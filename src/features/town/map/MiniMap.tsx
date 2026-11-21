import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { TOWN_WORLD } from '../../../data/townWorld';
import { paletteFor, type TownTheme } from '../engine/palette';
import type { MapSnapshot, StageState, TownStageHandle } from '../engine/stage';
import { drawMap, mapScene } from './drawMap';
import { MAP_ART, markerColor } from './mapArtData';
import { PLACE_ART } from './mapGeo';
import { arrowRotation, miniView, toBox } from './mapView';
import './map.css';

/** The minimap's size (CSS px; map.css .town-map-mini) and how many tile edges from the player to its rim. */
const MINI_PX = 132;
const MINI_RADIUS = 11;

/** Nothing moved enough since the last picture to draw it again. */
function same(a: MapSnapshot | null, b: MapSnapshot): boolean {
  if (!a) return false;
  const near = (x: number, y: number) => Math.abs(x - y) < 0.004;
  if (!near(a.player.x, b.player.x) || !near(a.player.y, b.player.y) || !near(a.player.heading, b.player.heading) || !near(a.cameraYaw, b.cameraYaw)) return false;
  if (a.residents.length !== b.residents.length) return false;
  for (let i = 0; i < a.residents.length; i++) {
    const p = a.residents[i];
    const q = b.residents[i];
    if (p.id !== q.id || !near(p.x, q.x) || !near(p.y, q.y) || p.inside !== q.inside || p.marker !== q.marker) return false;
  }
  return true;
}

/**
 * A small round map in a corner of the stage: the streets round the player, turned with the camera (up on it is up
 * on the screen), the residents as dots in their house's colour (a ring when something waits). A click opens the
 * full map. Shown on a wide stage only, and hidden during talks and panels (map.css).
 */
export default function MiniMap({ stage, state, hint, theme, onOpen }: { stage: RefObject<TownStageHandle | null>; state: StageState; hint: string | null; theme: TownTheme; onOpen: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const built = state.built;
  const sites = state.sites;
  const decorations = state.decorations;
  const scene = useMemo(
    () => mapScene({ built: new Set(built), sites: sites ? new Set(sites) : null, decorations: new Set(decorations) }, TOWN_WORLD),
    [built, sites, decorations],
  );
  const sceneRef = useRef(scene);
  const pal = paletteFor(theme);
  const palRef = useRef(pal);
  const dirty = useRef(true);
  const hintRef = useRef(hint);
  useEffect(() => {
    sceneRef.current = scene;
    palRef.current = pal;
    hintRef.current = hint;
    dirty.current = true;
  }, [scene, pal, hint]);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const loop = { id: 0, last: null as MapSnapshot | null };
    const tick = () => {
      loop.id = requestAnimationFrame(tick);
      // not on the screen (a phone, a talk, a panel: display none): nothing to draw
      if (c.offsetParent === null) return;
      const s = stage.current?.mapSnapshot();
      if (!s || s.away) return;
      if (!dirty.current && same(loop.last, s)) return;
      loop.last = s;
      dirty.current = false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(MINI_PX * dpr);
      if (c.width !== px) c.width = c.height = px;
      const box = { w: MINI_PX, h: MINI_PX };
      const rim = MINI_PX / 2;
      const v = miniView(s.player, s.cameraYaw, rim, MINI_RADIUS);
      const p = palRef.current;
      drawMap(ctx, sceneRef.current, v, box, dpr, p, { mini: { rim } });
      // the residents: dots in their house's colour, a ring in their marker's for the suggested one and a re-listen
      // that is due (mapCard.ts mapBadges), nobody else
      for (const r of s.residents) {
        if (r.inside) continue;
        const at = toBox(v, box, r.x, r.y);
        if (Math.hypot(at.x - rim, at.y - rim) > rim - 4) continue;
        const ring = r.marker === 'relisten' || r.id === hintRef.current ? markerColor(r.marker) : null;
        if (ring) {
          ctx.beginPath();
          ctx.arc(at.x, at.y, 6.2, 0, Math.PI * 2);
          ctx.fillStyle = ring;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(at.x, at.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.ink(PLACE_ART[r.id]?.roof ?? '#ffffff');
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = MAP_ART.dotRim;
        ctx.stroke();
      }
      // the player in the middle, the arrow the way they face
      const turn = arrowRotation(s.player.heading, s.cameraYaw, 1);
      ctx.save();
      ctx.translate(rim, rim);
      ctx.rotate(turn);
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = MAP_ART.me;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = MAP_ART.meRim;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3.8, 3.4);
      ctx.lineTo(0, 1.6);
      ctx.lineTo(-3.8, 3.4);
      ctx.closePath();
      ctx.fillStyle = MAP_ART.meRim;
      ctx.fill();
      ctx.restore();
    };
    loop.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loop.id);
  }, [stage]);

  return (
    <button type="button" className="town-map-mini" onClick={onOpen} aria-label="Mở bản đồ" title="Bản đồ (M)">
      <canvas ref={canvasRef} className="town-map-mini-canvas" aria-hidden="true" />
    </button>
  );
}
