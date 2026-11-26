// Westbay's streets on the stage (./streetsWorld.ts): registered with the 3D stage once it stands, again whenever the
// stage is made anew (a guest of the town came up), gone when the page leaves. `paused`: a panel is over the stage.
import { useEffect, useRef, type RefObject } from 'react';
import type { TownStageHandle } from '../engine/stage';
import { StreetsWorld } from './streetsWorld';
import { resetStreets } from './streetsStore';

export function useStreetsLayer(stage: RefObject<TownStageHandle | null>, ready: boolean, flat: boolean, paused: boolean): void {
  const world = useRef<StreetsWorld | null>(null);
  useEffect(() => {
    if (!ready || flat) return;
    const off = stage.current?.addExtra((ctx) => {
      const w = new StreetsWorld(ctx);
      world.current = w;
      if (import.meta.env.DEV) (window as unknown as { __streets?: StreetsWorld }).__streets = w;
      return w;
    });
    return () => {
      off?.();
      world.current = null;
    };
  }, [stage, ready, flat]);
  useEffect(() => {
    if (world.current) world.current.frozen = paused;
  }, [paused, ready]);
  useEffect(() => () => resetStreets(), []);
}
