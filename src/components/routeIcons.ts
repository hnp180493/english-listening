import {
  BookOpen,
  Clapperboard,
  ClipboardCheck,
  Ear,
  Headphones,
  History,
  Layers,
  Mic,
  PencilLine,
  ScanText,
  Settings,
  Sun,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { RouteId } from '../core/nav';

/** One lucide icon per page/module. Used by the nav, the Home tiles and <PageHeader>/<RouteTile>. */
export const ROUTE_ICON: Record<RouteId, LucideIcon> = {
  home: Sun,
  review: History,
  lessons: BookOpen,
  decoder: ScanText,
  dictation: PencilLine,
  pairs: Ear,
  drill: Layers,
  shadowing: Mic,
  media: Clapperboard,
  stats: TrendingUp,
  listening: Headphones,
  checkup: ClipboardCheck,
  settings: Settings,
};

/** CSS color of a module's tint (token --mod-<route> in src/index.css). */
export function routeTint(id: RouteId): string {
  return `var(--mod-${id})`;
}
