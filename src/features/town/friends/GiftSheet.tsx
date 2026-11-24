// "Tặng quà" standing next to a resident: the gift picker in a sheet over the stage (the frame of the build panel and
// the activities), the town going on around it.

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import type { TownGiftGive } from '../../../core/town/store';
import { townPlace } from '../../../data/town';
import type { PlaceId } from '../../../data/townWorld';
import { Portrait, type PortraitMood } from '../art';
import { usePanelKeys } from '../panelKeys';
import GiftGive from './GiftGive';
import type { GiftReactionView } from './friendModel';

export interface GiftSheetProps {
  placeId: PlaceId;
  onClose: () => void;
  onGiven?: (r: Extract<TownGiftGive, { ok: true }>, view: GiftReactionView) => void;
  onShop?: () => void;
}

export default function GiftSheet({ placeId, onClose, onGiven, onShop }: GiftSheetProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, []);
  usePanelKeys(boxRef, onClose);
  const resident = townPlace(placeId)?.resident ?? '';
  // their face shows how they took it
  const [mood, setMood] = useState<PortraitMood>('neutral');
  return (
    <aside ref={boxRef} className="town-build town-gift-sheet" role="dialog" aria-labelledby={titleId} tabIndex={-1}>
      <header className="town-build-head">
        <span className="town-gift-head">
          <Portrait placeId={placeId} size={48} mood={mood} />
          <h2 id={titleId} className="town-build-title">
            Tặng quà cho {resident}
          </h2>
        </span>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body">
        <GiftGive
          placeId={placeId}
          onGiven={(r, view) => {
            setMood(view.mood);
            onGiven?.(r, view);
          }}
          onShop={onShop}
        />
      </div>
    </aside>
  );
}
