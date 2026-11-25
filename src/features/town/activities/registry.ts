// One lazy panel per activity: the page renders PANELS[id] inside the stage. Each file is owned by its activity.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ActivityId, ActivityPanelProps } from './types';

export const PANELS: Record<ActivityId, LazyExoticComponent<ComponentType<ActivityPanelProps>>> = {
  fish: lazy(() => import('./FishPanel')),
  farm: lazy(() => import('./FarmPanel')),
  eggs: lazy(() => import('./EggPanel')),
  wardrobe: lazy(() => import('./WardrobePanel')),
  album: lazy(() => import('./AlbumPanel')),
  gifts: lazy(() => import('./GiftShopPanel')),
  journal: lazy(() => import('./JournalPanel')),
  cafe: lazy(() => import('./CafePanel')),
  case: lazy(() => import('./CasePanel')),
  delivery: lazy(() => import('./DeliveryPanel')),
  love: lazy(() => import('../romance/LovePanel')),
  character: lazy(() => import('../romance/CharacterPanel')),
  listen: lazy(() => import('../scenes/ListenPanel')),
  season: lazy(() => import('../city/SeasonPanel')),
};
