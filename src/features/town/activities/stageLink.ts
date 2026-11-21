// What an activity's panel may show in the world while it is open (the stage belongs to the page): for now the
// fishing panel's phases, so the player fishes at the end of the pier (three/scene/fishShow.ts).

import { createContext, useContext, useEffect } from 'react';
import type { FishStagePhase } from '../engine/stage';

export type { FishStagePhase } from '../engine/stage';

/** Show the fishing panel's phase in the world (null = the panel closed); a no-op without a world. */
export type FishStage = (phase: FishStagePhase | null, tier: string | null) => void;

export const FishStageContext = createContext<FishStage | null>(null);

/** In the fishing panel: keep the world in step with its phase and the tier of the fish on the line. */
export function useFishStage(phase: FishStagePhase, tier: string | null): void {
  const show = useContext(FishStageContext);
  useEffect(() => {
    show?.(phase, tier);
  }, [show, phase, tier]);
}
