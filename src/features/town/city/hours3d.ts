// Westbay's opening hours on the stage (data/city/hours.ts; docs/town.md §33): every second and a half, whoever's place
// is shut by the game's clock goes inside, out of sight (the sim's own `goInside`, renewed for a few seconds at a time,
// so they come back out by themselves a moment after the place opens), and a CLOSED board stands at the door. Paused
// while a job or a scene is under way (the job's own staging decides where people are then); the admin sandbox has no
// hours. Added to the stage with `addExtra` by the city's page: no engine change.

import { Mesh } from 'three';
import { ADMIN } from '../../../core/admin';
import { skyNow } from '../../../core/town/skyNow';
import { cityPlace } from '../../../data/cityWorld';
import { shutAt } from '../../../data/city/hours';
import type { PlaceId } from '../../../data/townWorld';
import { Merge, shapes } from '../three/scene/merge';
import { C } from '../three/scene/palette3d';
import type { StageExtra, StageExtraCtx } from '../three/scene/stageExtra';

/** How long a shut place's person stays inside before being sent in again (s); how often the clock is read (s). */
const STAY_S = 5;
const EVERY_S = 1.5;

/** The CLOSED boards: a little A-frame on the pavement in front of each shut door (one mesh for all). */
function boards(ids: readonly string[]) {
  const m = new Merge();
  for (const id of ids) {
    const p = cityPlace(id);
    if (!p) continue;
    const x = p.door.x + 0.5 + 0.38;
    const z = p.door.y + 0.18;
    for (const s of [-1, 1]) m.add(shapes.box(0.34, 0.42, 0.025, 0.008, 1), C.woodDark, { x, y: 0.2, z: z + s * 0.06, rx: s * 0.16 });
    m.add(shapes.box(0.3, 0.2, 0.01, 0.006, 1), C.red, { x, y: 0.27, z: z + 0.1, rx: 0.16 }, { ao: false });
    for (let k = 0; k < 3; k++) m.add(shapes.box(0.2, 0.025, 0.008, 0.004, 1), C.white, { x, y: 0.31 - k * 0.045, z: z + 0.11, rx: 0.16 }, { ao: false });
  }
  return m.build();
}

/** The layer (StageExtra): `paused` while a job or a scene decides where people are. */
export function makeHoursLayer(ctx: StageExtraCtx, paused: () => boolean): StageExtra {
  let t = EVERY_S;
  let key = '';
  /** The places this layer sent in (so the one that opens again is brought straight back out). */
  let sentIn = new Set<string>();
  let mesh: Mesh | null = null;
  return {
    update: (dt: number) => {
      if (mesh) mesh.visible = !ctx.inRoom();
      t += dt;
      if (t < EVERY_S) return;
      t = 0;
      const shut = ADMIN ? [] : shutAt(skyNow().hour);
      if (!paused()) {
        for (const id of shut) {
          const p = cityPlace(id);
          if (p && ctx.sim.residents.has(id as PlaceId)) ctx.sim.goInside(id as PlaceId, p.door, STAY_S);
        }
        // a place open again: its person steps out of the door now (the sim would keep them in through a REAL night)
        for (const id of sentIn) {
          if (shut.includes(id)) continue;
          const p = cityPlace(id);
          if (p) ctx.sim.jumpResident(id as PlaceId, { x: p.door.x + 0.5, y: p.door.y + 0.5 });
        }
        sentIn = new Set(shut);
      }
      const k = shut.join(',');
      if (k === key) return;
      key = k;
      if (mesh) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        mesh = null;
      }
      const g = shut.length > 0 ? boards(shut) : null;
      if (g) {
        mesh = new Mesh(g, ctx.mats.std);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        ctx.scene.add(mesh);
      }
    },
    dispose: () => {
      if (mesh) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
    },
  };
}
