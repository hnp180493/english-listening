import type { CSSProperties } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import type { RouteId } from '../core/nav';
import { ROUTE_ICON, routeTint } from './routeIcons';

/**
 * Icons: the app uses lucide-react SVG icons only (no emoji as icons). Import any icon straight from
 * 'lucide-react' and render it, or go through <Icon> for the shared defaults (size 18, stroke 2,
 * class "icon", aria-hidden unless you pass a label). Route icons and tints: ./routeIcons.ts.
 * See docs/design-system.md.
 */

export interface IconProps extends Omit<LucideProps, 'ref'> {
  icon: LucideIcon;
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  label?: string;
}

/** A lucide icon with the app's defaults. */
export function Icon({ icon: Glyph, label, size = 18, strokeWidth = 2, className, ...rest }: IconProps) {
  const cls = 'icon' + (className ? ' ' + className : '');
  if (label) return <Glyph size={size} strokeWidth={strokeWidth} className={cls} role="img" aria-label={label} {...rest} />;
  return <Glyph size={size} strokeWidth={strokeWidth} className={cls} aria-hidden="true" focusable="false" {...rest} />;
}

export interface IconTileProps {
  icon: LucideIcon;
  /** Tint: a route (uses --mod-<route>) or any CSS color/var. Defaults to the accent. */
  route?: RouteId;
  tint?: string;
  size?: 'sm' | 'md' | 'lg';
  solid?: boolean;
  className?: string;
}

const TILE_ICON_SIZE = { sm: 16, md: 20, lg: 24 } as const;

/** Rounded tinted square holding an icon (decorative). */
export function IconTile({ icon, route, tint, size = 'md', solid = false, className }: IconTileProps) {
  const color = tint ?? (route ? routeTint(route) : undefined);
  const style = color ? ({ '--tile': color } as CSSProperties) : undefined;
  const cls = ['icon-tile', size !== 'md' ? `icon-tile-${size}` : '', solid ? 'icon-tile-solid' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} style={style} aria-hidden="true">
      <Icon icon={icon} size={TILE_ICON_SIZE[size]} strokeWidth={size === 'sm' ? 2.1 : 2} />
    </span>
  );
}

/** The route's icon inside its tinted tile. */
export function RouteTile({ id, size = 'md', solid = false }: { id: RouteId; size?: 'sm' | 'md' | 'lg'; solid?: boolean }) {
  return <IconTile icon={ROUTE_ICON[id]} route={id} size={size} solid={solid} />;
}
