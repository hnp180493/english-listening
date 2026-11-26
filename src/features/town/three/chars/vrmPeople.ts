// The light half of the VRoid people (./vrmBody.ts is the heavy one, loaded only when needed): whether somebody is
// to be shown as their avatar, and the lazy hand-over. Avatars come one after another (a file is a few MB and takes
// a moment to read: thirteen at once would stall the town), and only for somebody near enough to be seen
// (`dressWhenNear`, asked every frame by the engine). A file that does not load leaves the code-built body as it is.

import { vrmOf } from '../../../../data/townVrm';
import { getTownUi } from '../../townUi';
import type { Character3D } from '../contracts';
import type { Character3DPlus } from './person';

/** Tiles from the middle of the view within which somebody gets their avatar. */
const NEAR = 16;

const asked = new WeakSet<Character3D>();
let queue: Promise<void> = Promise.resolve();

/** Dress `ch` in its avatar when it has one and the learner wants avatars. Never throws; never blocks. */
export function dressInVrm(ch: Character3D): void {
  if (asked.has(ch)) return;
  asked.add(ch);
  if (getTownUi().people !== 'anime') return;
  const who = vrmOf(ch.id, import.meta.env.BASE_URL);
  if (!who || !(ch as Partial<Character3DPlus>).animator) return;
  let gone = false;
  const dispose = ch.dispose.bind(ch);
  ch.dispose = () => {
    gone = true;
    dispose();
  };
  queue = queue
    .then(async () => {
      if (gone) return;
      const { wearVrm } = await import('./vrmBody');
      await wearVrm(ch as Character3DPlus, who.url, who, () => gone);
    })
    .catch((e: unknown) => {
      console.warn('[town] avatar not loaded, the usual body stays:', ch.id, e);
    });
}

/** The same, once `ch` is within sight of the middle of the view (dx, dz in tiles). Cheap to call every frame. */
export function dressWhenNear(ch: Character3D, dx: number, dz: number): void {
  if (asked.has(ch)) return;
  if (dx * dx + dz * dz < NEAR * NEAR) dressInVrm(ch);
}
