// A scene of Westbay with somebody (docs/town.md §20; core/town/cityTypes.ts CityScene): an episode of a main
// person's story, a short talk, or a town resident met up here. The steps are SceneFlow's (the whole scene as sound
// only, its questions, then the words); this panel says how each line sounds (core/town/cityAudio.ts: the city's
// people in the browser's voice, a town resident in their own) and writes down what was heard.

import { useCallback, useState } from 'react';
import { CITY_AGAIN_XU, CITY_TIE_BOND, CITY_XU, sceneNow, sceneOpen } from '../../../core/town/city';
import { cityLinePlayback } from '../../../core/town/cityAudio';
import { cityPerson } from '../../../core/town/cityPeople';
import { finishCityScene, loadTownCity } from '../../../core/town/cityStore';
import type { CityScene } from '../../../core/town/cityTypes';
import type { SceneLine } from '../../../core/town/sceneTypes';
import { speak } from '../../../core/tts';
import { CITY_SCENES } from '../../../data/city';
import { tl } from '../../../i18n';
import SceneFlow, { type FlowEnd, type FlowResult } from '../scenes/SceneFlow';
import { speakerHasFace, speakerName } from '../scenes/speakers';
import { Portrait } from '../art';
import type { PlaceId } from '../../../data/townWorld';

export interface CityScenePanelProps {
  scene: CityScene;
  /** Heard before: a re-listen (it says so before the first play). */
  again: boolean;
  sound: boolean;
  onReward: (r: { label: string; xu?: number }) => void;
  onSpeaking: (who: string | null) => void;
  onClose: () => void;
}

const speakerFace = (who: string) => (speakerHasFace(who) ? <Portrait placeId={who as PlaceId} size={44} name={speakerName(who)} /> : null);

/** Whose scenes are open now and not heard yet: the people there is something new to hear from. */
function openOwners(): Set<string> {
  const city = loadTownCity();
  const out = new Set<string>();
  for (const s of CITY_SCENES) if (!Object.hasOwn(city.heard, s.id) && sceneOpen(s, city)) out.add(s.at);
  return out;
}

export default function CityScenePanel({ scene, again, sound, onReward, onSpeaking, onClose }: CityScenePanelProps) {
  const [before] = useState(openOwners);
  const say = useCallback(
    (line: SceneLine, careful: boolean) => {
      const p = cityLinePlayback(line, scene.level, careful);
      return speak(p.text, p.options);
    },
    [scene.level],
  );
  const done = useCallback(
    (r: FlowResult): FlowEnd => {
      const due = sceneNow(CITY_SCENES, scene.at, loadTownCity(), Date.now());
      const e = finishCityScene(scene, r);
      if (e.xu > 0) onReward({ label: scene.kind === 'episode' ? 'Nghe hiểu một chuyện ở Westbay' : 'Nghe hiểu một cuộc trò chuyện', xu: e.xu });
      const notes: string[] = [];
      const gained = Object.entries(e.gained);
      if (gained.length > 0) notes.push(tl`${gained.map(([id]) => speakerName(id)).join(', ')} quý bạn hơn: thân thiết +${CITY_TIE_BOND}`);
      if (!e.first && e.xu === 0) notes.push(due?.kind === 'again' ? 'Lần này chưa bắt được ý nào, nên chưa có xu.' : 'Nghe lại trước hạn thì không có xu; tai vẫn được luyện.');
      // who has something new to say because of this one
      const opened = [...openOwners()].filter((id) => !before.has(id) && id !== scene.at);
      if (opened.length > 0) notes.push(tl`Giờ bạn ghé được: ${opened.map((id) => speakerName(id)).join(', ')}.`);
      const next = sceneNow(CITY_SCENES, scene.at, loadTownCity(), Date.now());
      if (e.first && next?.kind === 'new') notes.push(tl`${speakerName(scene.at)} còn chuyện muốn kể tiếp.`);
      return { xu: e.xu, notes };
    },
    [scene, onReward, before],
  );
  const person = cityPerson(scene.at);
  const pay = again ? CITY_AGAIN_XU : CITY_XU;
  const intro = again ? tl`${scene.scene} (Nghe lại: mỗi câu trả lời đúng ${pay} xu nếu đã tới hạn.)` : scene.scene;
  return (
    <>
      {person && scene.kind === 'episode' && !again && <p className="city-ep-kicker">{tl`Chuyện của ${person.name} · phần ${scene.n}`}</p>}
      <SceneFlow scene={scene} intro={intro} nameOf={speakerName} face={speakerFace} say={say} onDone={done} onSpeaking={onSpeaking} onClose={onClose} sound={sound} />
    </>
  );
}
