// "Mượn xe đạp công cộng" beside a vehicle, "Trả xe" while riding (three/scene/vehicles3d.ts; owner, 2026-11-26: "có xe ngựa
// cho chạy nhanh hơn chẳng hạn… xe/ngựa hoặc nhiều thứ khác"). E does the same on a keyboard. Read from the stage a
// few times a second; shown only when there is something to do.

import { useEffect, useState, type RefObject } from 'react';
import { Bike, Car, CircleArrowDown, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components/Icon';
import type { VehicleKind } from '../../data/townWorld';
import type { TownStageHandle } from './engine/stage';
import { RIDES } from './three/scene/vehicles3d';
import { tl, tr } from '../../i18n';

const ICONS: Readonly<Record<VehicleKind, LucideIcon>> = { bike: Bike, scooter: Bike, car: Car, horse: Bike };

export default function RideButton({ stage }: { stage: RefObject<TownStageHandle | null> }) {
  const [state, setState] = useState<{ near: VehicleKind | null; riding: VehicleKind | null }>({ near: null, riding: null });
  useEffect(() => {
    const read = () => {
      const s = stage.current?.rideState() ?? { near: null, riding: null };
      setState((o) => (o.near === s.near && o.riding === s.riding ? o : s));
    };
    const id = window.setInterval(read, 250);
    return () => window.clearInterval(id);
  }, [stage]);
  const kind = state.riding ?? state.near;
  if (!kind) return null;
  const riding = !!state.riding;
  return (
    <button type="button" className={'town-pill town-hud-btn town-ride' + (riding ? ' is-on' : '')} onClick={() => stage.current?.toggleRide()} aria-keyshortcuts="E" title={riding ? 'Trả xe (E)' : tl`Mượn ${tr(RIDES[kind].name)} (E)`}>
      <Icon icon={riding ? CircleArrowDown : ICONS[kind]} size={17} />
      <span>{riding ? 'Trả xe' : tl`Mượn ${tr(RIDES[kind].name)}`}</span>
    </button>
  );
}
