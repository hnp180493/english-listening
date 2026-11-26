// A scene of Westbay with somebody (docs/town.md §20; core/town/cityTypes.ts CityScene): an episode of a main
// person's story, a short talk, or a town resident met up here. The steps are SceneFlow's (the whole scene as sound
// only, its questions, then the words); this panel says how each line sounds (core/town/cityAudio.ts: the city's
// people in the browser's voice, a town resident in their own) and writes down what was heard.

import { useCallback, useState } from 'react';
import { CITY_AGAIN_XU, CITY_OUTING_BOND, CITY_TIE_BOND, CITY_XU, sceneNow, sceneOpen } from '../../../core/town/city';
import { cityLinePlayback, type OutingCast } from '../../../core/town/cityAudio';
import { cityPerson } from '../../../core/town/cityPeople';
import { finishCityScene, finishOuting, loadTownCity } from '../../../core/town/cityStore';
import type { CityScene } from '../../../core/town/cityTypes';
import { YOU, type SceneLine } from '../../../core/town/sceneTypes';
import { useTownLife } from '../../../core/town/lifeStore';
import { speak } from '../../../core/tts';
import { CITY_SCENES } from '../../../data/city';
import { tl } from '../../../i18n';
import SceneFlow, { type FaceLook, type FlowEnd, type FlowResult } from '../scenes/SceneFlow';
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
  /** A line over the scene before it is heard (a chapter of a long story: its title and number). */
  kicker?: string;
  /** An outing: who the partner is (a town place id, their name and sex) and the child along (name, sex). */
  outing?: { partner: { id: string; name: string; gender: 'male' | 'female' }; kid?: { name: string; gender: 'male' | 'female' } };
}

const speakerFace = (who: string, look: FaceLook) =>
  speakerHasFace(who) ? <Portrait placeId={who as PlaceId} size={look.size} mood={look.mood} shape={look.card ? 'card' : 'round'} frame={look.card ? 'bust' : 'face'} name={speakerName(who)} /> : null;

/** Whose scenes are open now and not heard yet: the people there is something new to hear from. */
function openOwners(): Set<string> {
  const city = loadTownCity();
  const out = new Set<string>();
  for (const s of CITY_SCENES) if (!Object.hasOwn(city.heard, s.id) && sceneOpen(s, city)) out.add(s.at);
  return out;
}

export default function CityScenePanel({ scene, again, sound, onReward, onSpeaking, onClose, outing, kicker }: CityScenePanelProps) {
  const [before] = useState(openOwners);
  const partnerId = outing?.partner.id;
  const kidSex = outing?.kid ? (outing.kid.gender === 'male' ? 'boy' : 'girl') : undefined;
  // the learner's own lines (sceneTypes YOU): their character's name and sex
  const me = useTownLife().profile;
  const you = me?.gender;
  const myName = me?.name;
  const say = useCallback(
    (line: SceneLine, careful: boolean) => {
      const cast: OutingCast = { ...(partnerId ? { partner: partnerId } : {}), ...(kidSex ? { kid: kidSex } : {}), ...(you ? { you } : {}) };
      const p = cityLinePlayback(line, scene.level, careful, cast);
      return speak(p.text, p.options);
    },
    [scene.level, partnerId, kidSex, you],
  );
  const partnerName = outing?.partner.name;
  const kidName = outing?.kid?.name;
  const nameOf = useCallback((who: string) => (who === 'partner' ? (partnerName ?? '') : who === 'kid' ? (kidName ?? 'Bé') : who === YOU ? (myName ?? 'Bạn') : speakerName(who)), [partnerName, kidName, myName]);
  const faceOf = useCallback(
    (who: string, look: FaceLook) =>
      who === 'partner' && partnerId ? <Portrait placeId={partnerId as PlaceId} size={look.size} mood={look.mood} shape={look.card ? 'card' : 'round'} frame={look.card ? 'bust' : 'face'} /> : speakerFace(who, look),
    [partnerId],
  );
  // who speaks is shown in the world by their own id (the partner stands there as themself)
  const speakingAs = useCallback((who: string | null) => onSpeaking(who === 'partner' ? (partnerId ?? null) : who === 'kid' ? null : who === YOU ? 'player' : who), [onSpeaking, partnerId]);
  const done = useCallback(
    (r: FlowResult): FlowEnd => {
      if (partnerId) {
        const e = finishOuting(scene, r, partnerId);
        if (e.xu > 0) onReward({ label: 'Một buổi đi chơi ở Westbay', xu: e.xu });
        const notes: string[] = [];
        if (e.gained[partnerId]) notes.push(tl`${partnerName ?? ''} vui lắm: thân thiết +${CITY_OUTING_BOND}`);
        else notes.push('Hôm nay hai bạn đã tới đây rồi; mai lại có buổi khác.');
        return { xu: e.xu, notes };
      }
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
    [scene, onReward, before, partnerId, partnerName],
  );
  const person = cityPerson(scene.at);
  const pay = again ? CITY_AGAIN_XU : CITY_XU;
  const intro = again ? tl`${scene.scene} (Nghe lại: mỗi câu trả lời đúng ${pay} xu nếu đã tới hạn.)` : scene.scene;
  return (
    <>
      {kicker ? <p className="city-ep-kicker">{kicker}</p> : person && scene.kind === 'episode' && !again && <p className="city-ep-kicker">{tl`Chuyện của ${person.name} · phần ${scene.n}`}</p>}
      <SceneFlow scene={scene} intro={outing ? scene.scene : intro} nameOf={nameOf} face={faceOf} host={scene.at} say={say} onDone={done} onSpeaking={speakingAs} onClose={onClose} sound={sound} />
    </>
  );
}
