// The radio of a vehicle being ridden (docs/town.md §25): a small "Radio" pill above the ride button, shown only while
// the learner rides; it opens the same listen panel as the café's radio (focus CAR_RADIO: Bay FM's bulletin of the
// moment, taking turns with the written segments). The riding state is read from the stage (rideState, owned by the
// vehicles' code: RideButton), never changed here. Opening the panel does not get the learner off the vehicle.

import { useEffect, useState, type RefObject } from 'react';
import { Radio } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import type { TownStageHandle } from '../engine/stage';
import { ADMIN } from '../../../core/admin';
import { loadTownJobs } from '../../../core/town/jobsStore';
import { pirateState } from '../../../core/town/pirate';
import './carRadio.css';

/**
 * `onPirate` (Westbay only): a second channel, the pirate station on 91.5 (core/town/pirate.ts), shown while Act III is
 * on and, silent, after it (a line says why); never before `job-forged` is done.
 */
export default function CarRadio({ stage, onOpen, onPirate }: { stage: RefObject<TownStageHandle | null>; onOpen: () => void; onPirate?: () => void }) {
  const [riding, setRiding] = useState(false);
  const [pirate, setPirate] = useState(false);
  useEffect(() => {
    const read = () => {
      const on = !!stage.current?.rideState().riding;
      setRiding(on);
      if (on && onPirate) {
        try {
          setPirate(pirateState(loadTownJobs(), ADMIN) !== 'off');
        } catch {
          setPirate(false);
        }
      }
    };
    read();
    const id = window.setInterval(read, 400);
    return () => window.clearInterval(id);
  }, [stage, onPirate]);
  if (!riding) return null;
  return (
    <div className="town-carradio">
      {pirate && onPirate && (
        <button type="button" className="town-pill town-hud-btn town-carradio-btn town-carradio-pirate" onClick={onPirate} title="Dò sang đài lậu 91.5">
          <span>91.5</span>
        </button>
      )}
      <button type="button" className="town-pill town-hud-btn town-carradio-btn" onClick={onOpen} title="Bật radio Bay FM trên xe">
        <Icon icon={Radio} size={17} />
        <span>Radio</span>
      </button>
    </div>
  );
}
