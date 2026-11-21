// Small game pictures of the town map drawn as DOM (features/town/map): the marker over a resident and the
// player's arrow. GAME ART: their colours are the overlay's (engine/draw/overlay.ts drawTag), passed inline, never
// in CSS (docs/design-system.md "Thị trấn: game art").

import type { Marker } from '../engine/stage';
import { MAP_ART } from './mapArtData';

/** The marker over a resident on the map: "!" (new lines), a talk (an episode to hear), a round arrow (a re-listen). */
export function MarkerBadge({ marker, size = 16 }: { marker: Marker; size?: number }) {
  const fill = marker === 'new' ? MAP_ART.fresh : marker === 'relisten' ? MAP_ART.relisten : MAP_ART.story;
  return (
    <svg className="town-map-badge" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7.2" fill={fill} stroke={MAP_ART.rim} strokeWidth="1.4" />
      {marker === 'new' ? (
        <>
          <rect x="7" y="3.6" width="2" height="5.4" rx="1" fill={MAP_ART.freshInk} />
          <circle cx="8" cy="11.3" r="1.15" fill={MAP_ART.freshInk} />
        </>
      ) : marker === 'relisten' ? (
        <>
          <path d="M11.2 6.4A3.4 3.4 0 1 0 11.4 9.4" fill="none" stroke={MAP_ART.rim} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M11.9 3.9l.1 3-2.9-.4z" fill={MAP_ART.rim} />
        </>
      ) : (
        <>
          <circle cx="5" cy="8" r="1.15" fill={MAP_ART.rim} />
          <circle cx="8" cy="8" r="1.15" fill={MAP_ART.rim} />
          <circle cx="11" cy="8" r="1.15" fill={MAP_ART.rim} />
        </>
      )}
    </svg>
  );
}

/** The player on the map: a round marker with an arrow the way they face (turned by the CSS variable --town-map-turn). */
export function PlayerArrow({ size = 26 }: { size?: number }) {
  return (
    <svg className="town-map-arrow" width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <circle cx="13" cy="13" r="11" fill={MAP_ART.me} stroke={MAP_ART.meRim} strokeWidth="2.4" />
      <path d="M13 5.6l5 10.6-5-2.6-5 2.6z" fill={MAP_ART.meRim} strokeLinejoin="round" />
    </svg>
  );
}
