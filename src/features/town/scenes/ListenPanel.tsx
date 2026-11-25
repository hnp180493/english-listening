// "Cảnh nghe" (docs/town.md §19, core/town/sceneTypes.ts): something heard in the world. The learner sat down on a
// bench (two people talk nearby), stands by a radio (Bay FM), came to today's get-together, or got on bus no. 9
// (docs/town.md §20: the ride to Westbay and back). The steps are SceneFlow's (sound only, questions, the words);
// this panel picks the scene and writes down what it gave. The panel's frame (title, ✕, Esc) is its host's.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { sceneLinePlayback } from '../../../core/town/sceneAudio';
import type { ListenScene, SceneLine } from '../../../core/town/sceneTypes';
import { loadTownProgress } from '../../../core/town/store';
import { eventScene, overheardAt, radioNow, rideNow, SCENE_PAID_A_DAY, TOWN_EVENTS } from '../../../core/town/world';
import { finishScene, scenesHeard, townToday } from '../../../core/town/worldStore';
import { speak } from '../../../core/tts';
import { EVENT_SCENES, OVERHEARD_SCENES, RADIO_SCENES } from '../../../data/scenes';
import { RIDE_SCENES } from '../../../data/scenes/rides';
import { benchNumber, thingKind, type PlaceId } from '../../../data/townWorld';
import type { ActivityPanelProps } from '../activities/types';
import { Portrait } from '../art';
import { tl } from '../../../i18n';
import SceneFlow, { type FlowEnd, type FlowResult } from './SceneFlow';
import { speakerHasFace, speakerName } from './speakers';

export interface ListenPanelProps extends ActivityPanelProps {
  /** Where the panel is open: the town (the default) or Westbay. The bus goes to the other one. */
  where?: 'town' | 'city';
  /** What is overheard from a bench here (the city's own scenes; default: the town's). */
  overheard?: readonly ListenScene[];
  /** The bus sets off (the ride was heard, or skipped): the page goes to the other place (with the friend asked along). */
  onTravel?: (withId?: string) => void;
}

/** The scene this panel plays, and whose get-together it is (a place id), if any. */
function pickScene(at: string | null | undefined, now: number, where: 'town' | 'city', overheard: readonly ListenScene[]): { scene: ListenScene | null; host: string | null } {
  const today = townToday(now);
  const progress = loadTownProgress();
  const recent = new Set(scenesHeard(progress));
  if (at?.startsWith('event:')) {
    const ev = TOWN_EVENTS.find((e) => e.id === at.slice(6));
    return { scene: ev ? eventScene(EVENT_SCENES, ev.id, today.day) : null, host: ev?.host ?? null };
  }
  const kind = at ? thingKind(at) : null;
  if (kind === 'radio') {
    const turn = scenesHeard(progress, today.day).filter((id) => id.startsWith('fm-')).length;
    return { scene: radioNow(RADIO_SCENES, today.day, today.weekday, today.weather, turn, recent), host: null };
  }
  if (kind === 'bus') return { scene: rideNow(RIDE_SCENES, where === 'city' ? 'town' : 'city', today.day, recent), host: null };
  if (kind === 'bench' && at) return { scene: overheardAt(overheard, Math.max(0, benchNumber(at)), today.day, recent), host: null };
  return { scene: null, host: null };
}

/** A speaker's picture: a town resident's or a city person's portrait; nothing for a voice that is only heard. */
const speakerFace = (who: string) => (speakerHasFace(who) ? <Portrait placeId={who as PlaceId} size={44} name={speakerName(who)} /> : null);

function say(line: SceneLine, level: number, careful: boolean): Promise<void> {
  const p = sceneLinePlayback(line, level, careful);
  return speak(p.text, p.options);
}

export default function ListenPanel({ onClose, onReward, sound, focus, onScene, onSceneEnd, onListen, onSpeaking, where = 'town', overheard = OVERHEARD_SCENES, onTravel, companions }: ListenPanelProps) {
  // the scene is chosen once, when the panel opens (what was paid meanwhile must not change it under the learner)
  const [{ scene, host }] = useState(() => pickScene(focus, Date.now(), where, overheard));
  const ride = scene?.kind === 'ride';
  // a friend asked along to Westbay (from the town only): they ride with the learner and are up there for the day
  const [withId, setWithId] = useState('');
  const travel = useCallback(() => onTravel?.(withId || undefined), [onTravel, withId]);
  const askAlong =
    where === 'town' && companions && companions.length > 0 ? (
      <label className="town-ls-with">
        Rủ đi cùng
        <select className="select" value={withId} onChange={(e) => setWithId(e.target.value)}>
          <option value="">Đi một mình</option>
          {companions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  // a get-together happens at its host's place: the stage takes the player there (as a shift at the café does)
  const staged = useRef(false);
  useEffect(() => {
    if (!host || !scene || staged.current) return;
    staged.current = true;
    onScene?.({ placeId: host, spot: { kind: 'place', id: host }, wedding: false });
    return () => {
      onSceneEnd?.({ placeId: host, celebrate: false });
    };
    // once, for the scene this panel opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // at a bench or the radio: the player sits down, and the people who are overheard come and talk nearby
  useEffect(() => {
    if (!scene || host || ride) return;
    onListen?.([...new Set(scene.lines.map((l) => l.who))].filter(speakerHasFace));
    return () => onListen?.(null);
    // once, for the scene this panel opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = scene?.level ?? 1;
  const sayLine = useCallback((line: SceneLine, careful: boolean) => say(line, level, careful), [level]);
  const done = useCallback(
    (r: FlowResult): FlowEnd => {
      if (!scene) return { xu: 0, notes: [] };
      const e = finishScene(scene, host, r);
      if (e.xu > 0) onReward({ label: scene.kind === 'event' ? 'Dự buổi gặp mặt' : scene.kind === 'radio' ? 'Nghe radio hiểu ý' : scene.kind === 'ride' ? 'Nghe trên xe buýt' : 'Nghe lỏm hiểu ý', xu: e.xu });
      const notes: string[] = [];
      if (e.capped) notes.push(tl`Hôm nay đã tính đủ ${SCENE_PAID_A_DAY[scene.kind]} lượt có xu ở đây; nghe thêm vẫn tốt cho tai.`);
      if (e.bond > 0 && host) notes.push(tl`${speakerName(host)} quý bạn hơn: thân thiết +${e.bond}`);
      return { xu: e.xu, notes };
    },
    [scene, host, onReward],
  );

  const there = where === 'city' ? 'thị trấn' : 'Westbay';
  if (!scene) {
    return (
      <div className="town-ls">
        <p className="town-build-hint">{focus && thingKind(focus) === 'bus' ? tl`Xe số 9 đang chờ ở bến. Lên xe là tới ${there}.` : 'Lúc này chưa có gì để nghe ở đây. Ghé lại sau nhé.'}</p>
        <div className="town-talk-foot">
          {focus && thingKind(focus) === 'bus' && onTravel ? (
            <button type="button" className="btn btn-primary" onClick={travel} autoFocus>
              {tl`Đi ${there}`}
              <Icon icon={ArrowRight} size={16} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
              Đóng
            </button>
          )}
        </div>
      </div>
    );
  }

  const who = [...new Set(scene.lines.map((l) => l.who))];
  // overheard from whichever bench the learner sat down on: who is talking, not where the scene was written for
  const intro = scene.kind === 'overheard' && who.length === 2 ? tl`${speakerName(who[0])} và ${speakerName(who[1])} đang nói chuyện ngay gần đó.` : scene.scene;
  return (
    <>
      {ride && askAlong}
      <SceneFlow
      scene={{ title: scene.title, lines: scene.lines, questions: scene.detail ? [scene.gist, scene.detail] : [scene.gist] }}
      intro={intro}
      nameOf={speakerName}
      face={speakerFace}
      say={sayLine}
      onDone={done}
      onSpeaking={onSpeaking}
      onClose={ride && onTravel ? travel : onClose}
      sound={sound}
      closeLabel={ride ? tl`Xuống xe ở ${there}` : undefined}
      readyExtra={
        ride && onTravel ? (
          <button type="button" className="btn btn-ghost" onClick={travel}>
            Đi luôn, không nghe
          </button>
        ) : undefined
      }
      />
    </>
  );
}
