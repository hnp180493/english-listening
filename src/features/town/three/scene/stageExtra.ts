// Something another module drives in the 3D world each frame (engine3d.ts addExtra): Westbay's traffic, its lights and
// the patrol car (three/scene/traffic.ts). It gets what it needs to draw and to be in the way, and nothing else.
import type { Scene } from 'three';
import type { VehicleKind } from '../../../../data/townWorld';
import type { TownSim } from '../../engine/sim';
import type { TownScene } from './world3d';

export interface StageExtraCtx {
  scene: Scene;
  /** The ground's height at a point of the map (tiles). */
  lift: (x: number, y: number) => number;
  mats: TownScene['mats'];
  /** The sim: the player, the residents, and `extraBodies` (what stops the player besides people). */
  sim: TownSim;
  /** The vehicle ridden and which of its colours, or null on foot. */
  rideLook: () => { kind: VehicleKind; v: number } | null;
  /** The player is in a room (the world is not drawn). */
  inRoom: () => boolean;
}

export interface StageExtra {
  /** Each frame of the open world: seconds gone by, and how dark it is (0 day … 1 night). */
  update: (dt: number, night: number) => void;
  dispose: () => void;
}
