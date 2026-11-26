// A get-together of the city's week, or a festival of its year (docs/town.md §21; core/town/cityTypes.ts CityEvent):
// heard as the town's get-togethers are, a "cảnh nghe" in the browser's voice (sound only, questions, the words).
// The page takes the player to the host's place and gathers whoever speaks.

import { useCallback, useState } from 'react';
import { sceneLinePlayback } from '../../../core/town/sceneAudio';
import type { CityEvent } from '../../../core/town/cityTypes';
import type { SceneLine } from '../../../core/town/sceneTypes';
import { eventScene, SCENE_PAID_A_DAY } from '../../../core/town/world';
import { finishScene, townToday } from '../../../core/town/worldStore';
import { speak } from '../../../core/tts';
import { CITY_EVENT_SCENES } from '../../../data/city';
import type { PlaceId } from '../../../data/townWorld';
import { tl } from '../../../i18n';
import { Portrait } from '../art';
import SceneFlow, { type FaceLook, type FlowEnd, type FlowResult } from '../scenes/SceneFlow';
import { speakerHasFace, speakerName } from '../scenes/speakers';

const face = (who: string, look: FaceLook) =>
  speakerHasFace(who) ? <Portrait placeId={who as PlaceId} size={look.size} mood={look.mood} shape={look.card ? 'card' : 'round'} frame={look.card ? 'bust' : 'face'} name={speakerName(who)} /> : null;

export default function CityEventPanel({ event, sound, onReward, onSpeaking, onClose }: { event: CityEvent; sound: boolean; onReward: (r: { label: string; xu?: number }) => void; onSpeaking: (who: string | null) => void; onClose: () => void }) {
  // chosen once, when the panel opens
  const [scene] = useState(() => eventScene(CITY_EVENT_SCENES, event.id, townToday().day));
  const level = scene?.level ?? 1;
  const say = useCallback(
    (line: SceneLine, careful: boolean) => {
      const p = sceneLinePlayback(line, level, careful);
      return speak(p.text, p.options);
    },
    [level],
  );
  const done = useCallback(
    (r: FlowResult): FlowEnd => {
      if (!scene) return { xu: 0, notes: [] };
      const e = finishScene(scene, null, r);
      if (e.xu > 0) onReward({ label: event.name, xu: e.xu });
      return { xu: e.xu, notes: e.capped ? [tl`Hôm nay đã tính đủ ${SCENE_PAID_A_DAY.event} lượt có xu ở các buổi gặp mặt; nghe thêm vẫn tốt cho tai.`] : [] };
    },
    [scene, event.name, onReward],
  );
  if (!scene) {
    return (
      <div className="town-ls">
        <p className="town-build-hint">Buổi này hôm nay chưa có gì để nghe. Ghé lại sau nhé.</p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            Đóng
          </button>
        </div>
      </div>
    );
  }
  return <SceneFlow scene={{ title: scene.title, lines: scene.lines, questions: scene.detail ? [scene.gist, scene.detail] : [scene.gist] }} intro={scene.scene} nameOf={speakerName} face={face} host={event.host} say={say} onDone={done} onSpeaking={onSpeaking} onClose={onClose} sound={sound} />;
}
