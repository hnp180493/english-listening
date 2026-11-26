// The light half of the VRoid people (./vrmBody.ts is the heavy one, loaded only when needed): who is shown as an
// avatar right now, and the lazy hand-over. Everybody has an avatar (data/townVrm.ts `vrmFor`), but a town or a city
// full of them is far too much to draw, so at most MAX wear theirs at once: the nearest to the middle of the view
// (`dressWhenNear`, asked every frame by the engine for everybody), the far ones go back to the body built in code.
// Avatars come one after another (a file is a couple of MB and takes a moment to read). A file that does not load
// leaves the code-built body as it is.

import { vrmFor } from '../../../../data/townVrm';
import { getTownUi } from '../../townUi';
import type { Character3D } from '../contracts';
import type { Character3DPlus } from './person';
import type { Worn } from './vrmBody';

/** Tiles from the middle of the view within which somebody gets their avatar. */
const NEAR = 15;
/** How many avatars are worn at once (about 25,000 triangles and 23 draw calls each, twice with their shadows). */
const MAX = 14;

interface Entry {
  worn: Worn | null;
  /** Squared distance from the middle of the view, as last told. */
  d2: number;
  /** Always dressed (the learner, somebody in a room): never taken off for somebody nearer. */
  keep: boolean;
  gone: boolean;
}

const people = new Map<Character3D, Entry>();
const failed = new WeakSet<Character3D>();
let queue: Promise<void> = Promise.resolve();

function start(ch: Character3D, d2: number, keep: boolean): void {
  const plus = ch as Partial<Character3DPlus>;
  if (!plus.animator || !plus.look) return;
  const who = vrmFor(ch.id, plus.look, import.meta.env.BASE_URL);
  const e: Entry = { worn: null, d2, keep, gone: false };
  people.set(ch, e);
  const dispose = ch.dispose.bind(ch);
  ch.dispose = () => {
    e.gone = true;
    people.delete(ch);
    dispose();
  };
  queue = queue
    .then(async () => {
      if (e.gone) return;
      const { wearVrm } = await import('./vrmBody');
      e.worn = await wearVrm(ch as Character3DPlus, who.url, who, () => e.gone);
      // (taken off again while its file was coming)
      if (e.gone) e.worn?.undress();
    })
    .catch((err: unknown) => {
      people.delete(ch);
      failed.add(ch);
      console.warn('[town] avatar not loaded, the usual body stays:', ch.id, err);
    });
}

/** Dress `ch` in its avatar now and keep it on (the learner, the people of a room). Never throws; never blocks. */
export function dressInVrm(ch: Character3D): void {
  if (people.has(ch) || failed.has(ch) || getTownUi().people !== 'anime') return;
  start(ch, 0, true);
}

/**
 * The same for somebody out in the world, once they are within sight of the middle of the view (dx, dz in tiles):
 * with MAX worn already, the farthest gives theirs up when this one is clearly nearer. Cheap to call every frame.
 */
export function dressWhenNear(ch: Character3D, dx: number, dz: number): void {
  const d2 = dx * dx + dz * dz;
  const mine = people.get(ch);
  if (mine) {
    mine.d2 = d2;
    return;
  }
  if (d2 > NEAR * NEAR || failed.has(ch) || getTownUi().people !== 'anime') return;
  if (people.size >= MAX) {
    let far: Character3D | null = null;
    let farD = d2 * 1.6 + 4;
    for (const [other, e] of people) {
      if (!e.keep && e.d2 > farD) {
        far = other;
        farD = e.d2;
      }
    }
    if (!far) return;
    const e = people.get(far);
    if (e) {
      e.gone = true;
      e.worn?.undress();
      people.delete(far);
      // (its own dispose wrapper stays: harmless, it only clears an entry that is not there)
      e.gone = true;
    }
  }
  start(ch, d2, false);
}
