// The light half of the VRoid people (./vrmBody.ts is the heavy one, loaded only when needed): who is shown as an
// avatar right now, and the lazy hand-over. Everybody has an avatar (data/townVrm.ts `vrmFor`), but a city full of
// them is too much to draw, so at most MAX wear theirs at once: the nearest to the middle of the view
// (`dressWhenNear`, asked every frame by the engine for everybody), the far ones go back to the body built in code.
//
// Nobody is seen in the code-built body first and then changed (owner, 2026-11-26: "mới vào sao vẫn còn model cũ vầy
// đợi 1 lúc nó mới thành model kia, mày làm UX tệ quá"): somebody whose avatar is on its way is not drawn until it
// is there, and the engine keeps the town's loading card up until the first ones are in (`avatarsSettled`). A few
// files are read at a time. A file that does not load brings the code-built body back.

import { vrmFor } from '../../../../data/townVrm';
import { getTownUi } from '../../townUi';
import type { Character3D } from '../contracts';
import type { Character3DPlus } from './person';
import type { Worn } from './vrmBody';

/** Tiles from the middle of the view within which somebody gets their avatar (past what the usual view shows). */
const NEAR = 18;
/** How many avatars are worn at once (about 25,000 triangles and 23 draw calls each, twice with their shadows). */
const MAX = 22;
/** How many files are read at once. */
const AT_ONCE = 3;

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
const waiting: (() => Promise<void>)[] = [];
let running = 0;

function pump(): void {
  while (running < AT_ONCE && waiting.length > 0) {
    const job = waiting.shift();
    if (!job) break;
    running++;
    void job().finally(() => {
      running--;
      pump();
    });
  }
}

const bodyOf = (ch: Character3D) => ch.root.getObjectByName('pivot');

function start(ch: Character3D, d2: number, keep: boolean, grow = 1): void {
  const plus = ch as Partial<Character3DPlus>;
  if (!plus.animator || !plus.look) return;
  const who = vrmFor(ch.id, plus.look, import.meta.env.BASE_URL);
  const e: Entry = { worn: null, d2, keep, gone: false };
  people.set(ch, e);
  // not drawn until the avatar is there
  const body = bodyOf(ch);
  if (body) body.visible = false;
  const dispose = ch.dispose.bind(ch);
  ch.dispose = () => {
    e.gone = true;
    people.delete(ch);
    dispose();
  };
  const job = async (): Promise<void> => {
    if (e.gone) return;
    try {
      const { wearVrm } = await import('./vrmBody');
      e.worn = await wearVrm(ch as Character3DPlus, who.url, grow === 1 ? who : { ...who, tall: (who.tall ?? 1) * grow }, () => e.gone);
      // (taken off again while its file was coming)
      if (e.gone) e.worn?.undress();
    } catch (err) {
      people.delete(ch);
      failed.add(ch);
      if (body && !e.gone) body.visible = true;
      console.warn('[town] avatar not loaded, the usual body stays:', ch.id, err);
    }
  };
  // the learner first
  if (keep) waiting.unshift(job);
  else waiting.push(job);
  pump();
}

/**
 * Dress `ch` in its avatar now and keep it on (the learner, the people of a room). Never throws; never blocks. `grow`:
 * that much taller than out in the world (a room's furniture is built for the code body: scene/roomStage.ts).
 */
export function dressInVrm(ch: Character3D, grow = 1): void {
  if (people.has(ch) || failed.has(ch) || getTownUi().people !== 'anime') return;
  start(ch, 0, true, grow);
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
      if (e.worn) e.worn.undress();
      else {
        const body = bodyOf(far);
        if (body) body.visible = true;
      }
      people.delete(far);
    }
  }
  start(ch, d2, false);
}

/** Whether every avatar asked for so far is on (nobody is still waiting for a file): the town may show itself. */
export function avatarsSettled(): boolean {
  for (const e of people.values()) if (!e.worn && !e.gone) return false;
  return true;
}
