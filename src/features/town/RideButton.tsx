// "Mượn xe đạp công cộng" beside a vehicle, "Trả xe" while riding (three/scene/vehicles3d.ts; owner, 2026-11-26: "có xe ngựa
// cho chạy nhanh hơn chẳng hạn… xe/ngựa hoặc nhiều thứ khác"). E does the same on a keyboard. With a vehicle of the
// learner's own (the garage, data/townGarage.ts) and nothing to borrow in reach: "Gọi …" brings it ("phải có mua đứt
// luôn chứ"); on it or beside it: "Lên …" / "Xuống xe". Read from the stage a few times a second; shown only when there
// is something to do.

import { useEffect, useState, type RefObject } from 'react';
import { Bike, Car, CarFront, CircleArrowDown, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { useTownProgress } from '../../core/town/store';
import { garageVehicle } from '../../data/townGarage';
import type { VehicleKind } from '../../data/townWorld';
import type { RideState, TownStageHandle } from './engine/stage';
import { pickedVehicle } from './garagePick';
import { useTownUi } from './townUi';
import { RIDES } from './three/scene/vehicles3d';
import { tl, tr } from '../../i18n';

const ICONS: Readonly<Record<VehicleKind, LucideIcon>> = { bike: Bike, scooter: Bike, car: Car, horse: Bike, motorbike: Bike, sportscar: CarFront };

export default function RideButton({ stage }: { stage: RefObject<TownStageHandle | null> }) {
  const [state, setState] = useState<RideState>({ near: null, riding: null, own: null });
  const progress = useTownProgress();
  const ui = useTownUi();
  const mine = pickedVehicle(progress.bought, ui.ride);
  useEffect(() => {
    const read = () => {
      const s = stage.current?.rideState() ?? { near: null, riding: null, own: null };
      setState((o) => (o.near === s.near && o.riding === s.riding && o.own === s.own ? o : s));
    };
    const id = window.setInterval(read, 250);
    return () => window.clearInterval(id);
  }, [stage]);
  const kind = state.riding ?? state.near;
  if (!kind) {
    if (!mine) return null;
    const call = () => {
      if (stage.current?.summonRide(mine.id, mine.kind, mine.v, mine.speed)) setState({ near: null, riding: mine.kind, own: mine.id });
    };
    return (
      <button type="button" className="town-pill town-hud-btn town-ride" onClick={call} title={tl`Gọi ${tr(mine.name)} tới chỗ bạn`}>
        <Icon icon={ICONS[mine.kind]} size={17} />
        <span>{mine.kind === 'horse' ? 'Gọi ngựa' : 'Gọi xe'}</span>
      </button>
    );
  }
  const riding = !!state.riding;
  const own = state.own ? garageVehicle(state.own) : undefined;
  const off = own ? 'Xuống xe' : 'Trả xe';
  // (the learner's own: a short label, its name in the tooltip; the button sits beside the main one on a phone)
  const on = own ? (own.kind === 'horse' ? 'Lên ngựa' : 'Lên xe') : tl`Mượn ${tr(RIDES[kind].name)}`;
  const title = riding ? (own ? 'Xuống xe (E)' : 'Trả xe (E)') : own ? tl`Lên ${tr(own.name)} (E)` : tl`Mượn ${tr(RIDES[kind].name)} (E)`;
  return (
    <button type="button" className={'town-pill town-hud-btn town-ride' + (riding ? ' is-on' : '')} onClick={() => stage.current?.toggleRide()} aria-keyshortcuts="E" title={title}>
      <Icon icon={riding ? CircleArrowDown : ICONS[kind]} size={17} />
      <span>{riding ? off : on}</span>
    </button>
  );
}
