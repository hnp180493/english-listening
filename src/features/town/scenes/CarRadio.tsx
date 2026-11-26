// The radio of a vehicle being ridden (docs/town.md §25): a small "Radio" pill above the ride button, shown only while
// the learner rides; it opens the same listen panel as the café's radio (focus CAR_RADIO: Bay FM's bulletin of the
// moment, taking turns with the written segments). The riding state is read from the stage (rideState, owned by the
// vehicles' code: RideButton), never changed here. Opening the panel does not get the learner off the vehicle.

import { useEffect, useState, type RefObject } from 'react';
import { Radio } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import type { TownStageHandle } from '../engine/stage';
import './carRadio.css';

export default function CarRadio({ stage, onOpen }: { stage: RefObject<TownStageHandle | null>; onOpen: () => void }) {
  const [riding, setRiding] = useState(false);
  useEffect(() => {
    const read = () => setRiding(!!stage.current?.rideState().riding);
    read();
    const id = window.setInterval(read, 400);
    return () => window.clearInterval(id);
  }, [stage]);
  if (!riding) return null;
  return (
    <button type="button" className="town-pill town-hud-btn town-carradio" onClick={onOpen} title="Bật radio Bay FM trên xe">
      <Icon icon={Radio} size={17} />
      <span>Radio</span>
    </button>
  );
}
