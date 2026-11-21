// Pictures of what eggs hatch, in 3D (DOM use: the egg shop's reveal, the wardrobe's tiles and its preview): a pet
// standing, a hat on the player's head, the player in an outfit's colour, a title as a ribbon. The models are the
// town's own (three/loot3d.ts), drawn with the shared offscreen renderer onto the canvas here; where this browser
// cannot draw in 3D the canvas stays empty (the item's name is always written beside it).

import { useEffect, useRef } from 'react';
import { Award } from 'lucide-react';
import { Icon } from '../../../../components/Icon';
import { prefersReducedMotion } from '../../../../core/motion';
import type { LootItem } from '../../../../data/townGame';
import { LootView, type LootSpec } from '../../three/loot3d';

/** Still pictures, by spec and size: a wardrobe tab shows a dozen of them. */
const stills = new Map<string, HTMLCanvasElement>();
const STILLS_MAX = 60;
/** An animated picture is drawn this many times a second at most. */
const ALIVE_FPS = 24;

function stillOf(spec: LootSpec, w: number, h: number): HTMLCanvasElement | null {
  const key = JSON.stringify(spec) + `|${w}x${h}`;
  const hit = stills.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const view = new LootView(spec);
  const ok = view.draw(c);
  view.dispose();
  if (!ok) return null;
  if (stills.size >= STILLS_MAX) stills.delete(stills.keys().next().value as string);
  stills.set(key, c);
  return c;
}

/**
 * A canvas of `w` × `h` CSS px showing `spec`, sharp on a 2× screen: one still frame, or alive while mounted when
 * `animate` (never under reduced motion). `silhouette` paints the picture in the canvas's CSS `color` (not owned yet).
 */
function useLootCanvas(spec: LootSpec | null, w: number, h: number, animate: boolean, silhouette: boolean) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = spec ? JSON.stringify(spec) : '';
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !key) return;
    const s = JSON.parse(key) as LootSpec;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const shade = () => {
      if (!silhouette) return;
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = getComputedStyle(c).color;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
    };
    if (!animate || prefersReducedMotion()) {
      ctx.clearRect(0, 0, c.width, c.height);
      const pic = stillOf(s, c.width, c.height);
      if (pic) ctx.drawImage(pic, 0, 0);
      shade();
      return;
    }
    const view = new LootView(s);
    const run = { raf: 0, last: 0 };
    // idle life (breathing, blinking) reads fine at a lower rate: the stage behind keeps the full one, and this second
    // picture is drawn at most ALIVE_FPS times a second (none while the canvas is off screen or the tab hidden)
    const loop = (now: number) => {
      run.raf = requestAnimationFrame(loop);
      if (run.last && now - run.last < 1000 / ALIVE_FPS - 2) return;
      if (document.hidden || !c.isConnected || c.getClientRects().length === 0) return;
      const dt = run.last ? Math.min(0.1, (now - run.last) / 1000) : 0;
      run.last = now;
      if (view.draw(c, dt)) shade();
    };
    run.raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(run.raf);
      view.dispose();
    };
  }, [key, w, h, animate, silhouette]);
  return ref;
}

function specOf(item: LootItem): LootSpec | null {
  if (item.kind === 'pet') return { kind: 'pet', pet: item.id };
  if (item.kind === 'hat') return { kind: 'bust', hat: item.id };
  if (item.kind === 'outfit') return { kind: 'figure', outfit: item.id };
  return null;
}

export interface LootPictureProps {
  item: LootItem;
  /** CSS px (square). */
  size: number;
  /** Not owned yet: drawn as a silhouette. */
  silhouette?: boolean;
  animate?: boolean;
}

/** One item as a picture (a title: a ribbon icon, the words are written beside it). */
export function LootPicture({ item, size, silhouette = false, animate = false }: LootPictureProps) {
  const ref = useLootCanvas(specOf(item), size, size, animate, silhouette);
  if (item.kind === 'title') {
    return (
      <span className={`town-egg-pic is-title${silhouette ? ' is-locked' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
        <Icon icon={Award} size={Math.round(size * 0.5)} />
      </span>
    );
  }
  return <canvas ref={ref} className={`town-egg-pic${silhouette ? ' is-locked' : ''}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

export interface Look {
  hat?: string | null;
  outfit?: string | null;
  pet?: string | null;
}

export interface PlayerPreviewProps {
  look: Look;
  width: number;
  height: number;
}

/** The player as the wardrobe dresses him, the pet beside him, alive (breathing, blinking, the pet looking round). */
export function PlayerPreview({ look, width, height }: PlayerPreviewProps) {
  const ref = useLootCanvas({ kind: 'figure', hat: look.hat ?? null, outfit: look.outfit ?? null, pet: look.pet ?? null }, width, height, true, false);
  return <canvas ref={ref} className="town-wd-preview-canvas" style={{ width, height }} aria-hidden="true" />;
}
