import { Suspense, useEffect, useId, useRef } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PANELS } from './activities/registry';
import { FishStageContext, type FishStage } from './activities/stageLink';
import { usePanelKeys } from './panelKeys';
import { listenTitle } from './scenes/things';
import { ACTIVITIES, type ActivityId, type ActivityPanelProps } from './activities/types';

export interface ActivityHostProps extends ActivityPanelProps {
  id: ActivityId;
  /** The world's side of fishing (TownStageHandle.fishing): the panel's phases shown on the pier. */
  onFish?: FishStage;
}

/**
 * An activity's panel over the stage (the pier, the farm field, the egg kiosk, the wardrobe, the album), like the
 * build panel: a side sheet on a wide stage, a bottom sheet on a phone, the town still living around it. The host
 * gives the frame (title, ✕, Esc, focus); the panel (activities/registry.ts PANELS, loaded on first use) the rest.
 */
export default function ActivityHost({ id, onClose, onReward, sound, onFish, focus, onTalk, onOpen, onScene, onSceneEnd }: ActivityHostProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, [id]);
  usePanelKeys(boxRef, onClose);
  // the fishing panel closed (or another opened): the player walks back off the pier
  useEffect(() => {
    if (id !== 'fish' || !onFish) return;
    return () => onFish(null, null);
  }, [id, onFish]);
  const info = ACTIVITIES.find((a) => a.id === id);
  const Panel = PANELS[id];
  return (
    <aside
      ref={boxRef}
      className="town-build town-activity-sheet"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <header className="town-build-head">
        <h2 id={titleId} className="town-build-title">
          {info?.name ?? (id === 'listen' ? listenTitle(focus) : id)}
        </h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body town-activity-body">
        <Suspense
          fallback={
            <p className="town-build-hint town-activity-wait">
              <Icon icon={LoaderCircle} size={16} className="icon-spin" />
              Đang mở…
            </p>
          }
        >
          <FishStageContext.Provider value={id === 'fish' ? (onFish ?? null) : null}>
            <Panel onClose={onClose} onReward={onReward} sound={sound} focus={focus} onTalk={onTalk} onOpen={onOpen} onScene={onScene} onSceneEnd={onSceneEnd} />
          </FishStageContext.Provider>
        </Suspense>
      </div>
    </aside>
  );
}
