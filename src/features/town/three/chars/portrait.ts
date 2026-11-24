// Portraits: head and shoulders, 3/4 front, drawn with the shared offscreen renderer (../offscreen.ts) onto a fresh
// 2D canvas (transparent background). Cached per (id, size, mood, hat, outfit): the conversation panel asks often.

import type { CharacterId } from '../contracts';
import { canvasOf, charStudio, compileStudio, paint } from '../offscreen';
import { LEG_GROW } from './anim';
import { createPerson, TILE_SCALE } from './person';
import { playerLookKey } from './looks';

const cache = new Map<string, HTMLCanvasElement>();
let warmed: Promise<void> | null = null;

/** The portraits' shaders compiled in the background, once (portraitWarm.ts waits for it before the first portrait). */
export function warmPortraitShaders(): Promise<void> {
  if (warmed) return warmed;
  const st = charStudio();
  const person = createPerson('player', undefined, { mood: 'happy', detail: 1 });
  person.update(0.016, 0);
  st.scene.add(person.root);
  // only there to compile the shaders: offscreen paint() leaves it out of every picture (on a phone it stood in front
  // of the first portraits drawn)
  person.root.userData.warmOnly = true;
  warmed = compileStudio(st).finally(() => {
    st.scene.remove(person.root);
    person.dispose();
  });
  return warmed;
}
const CACHE_MAX = 64;

/**
 * Render a portrait to a new canvas of `size` × `size` px (device pixels: pass size × devicePixelRatio for crisp UI).
 * The canvas is the cached one: draw it, do not draw on it. Without WebGL it is a clear canvas.
 */
export function renderPortrait(
  id: CharacterId,
  size: number,
  mood: 'neutral' | 'happy' = 'neutral',
  opts: { hat?: string | null; outfit?: string | null } = {},
): HTMLCanvasElement {
  const key = `${id}|${size}|${mood}|${opts.hat ?? ''}|${opts.outfit ?? ''}|${id === 'player' ? playerLookKey() : ''}`;
  const hit = cache.get(key);
  if (hit) {
    // most recently used last
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const out = canvasOf(size, size);
  const st = charStudio();
  const person = createPerson(id, undefined, { mood, detail: 1 });
  if (opts.hat) person.setHat(opts.hat);
  if (opts.outfit) person.setOutfit(opts.outfit);
  // turned a little to the viewer's left (3/4), standing still with the expression set
  person.setHeading(Math.PI / 2 + 0.3, true);
  person.update(0.016, 0);
  st.scene.add(person.root);
  const scale = (person.look.scale ?? 1) * TILE_SCALE;
  const hat = opts.hat ? 0.12 : 0;
  const cam = st.camera;
  cam.aspect = 1;
  cam.position.set(0.04 * scale, (0.78 + LEG_GROW + hat * 0.4) * scale, 1.9 * scale);
  cam.lookAt(0, (0.7 + LEG_GROW + hat * 0.5) * scale, 0);
  cam.fov = 25 + hat * 32;
  cam.near = 0.05;
  cam.far = 20;
  cam.updateProjectionMatrix();
  const drawn = paint(st, out);
  cam.fov = 24;
  person.dispose();
  // a failed draw (no WebGL) is not kept: the caller shows its stand-in, and a later try may work
  if (!drawn) return out;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, out);
  return out;
}

/** Forget the cached portraits (leaving the town). */
export function disposePortraits(): void {
  cache.clear();
  warmed = null;
}
