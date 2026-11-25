// A chapter of one of Westbay's long stories that is played in the TOWN (docs/town.md §21; core/town/cityTypes.ts
// CitySeason, a chapter with `where: 'town'`): an activity panel of the town's page ('season', opened from "Việc hôm
// nay" or a link, `focus` = the chapter's id). The stage takes the player to the place of the town resident it is
// with, as it does for a get-together; the steps and the sound are the city's (CityScenePanel: a town resident in
// their own voice, somebody of the city who came down in the browser's).

import { useEffect, useRef, useState } from 'react';
import { chaptersToday } from '../../../core/town/city';
import { loadTownCity } from '../../../core/town/cityStore';
import { CITY_SEASONS } from '../../../data/city';
import { townPlace } from '../../../data/town';
import { tl } from '../../../i18n';
import type { ActivityPanelProps } from '../activities/types';
import CityScenePanel from './CityScenePanel';

export default function SeasonPanel({ focus, sound, onReward, onClose, onScene, onSceneEnd, onSpeaking }: ActivityPanelProps) {
  // the chapter is fixed when the panel opens: hearing it must not swap it for tomorrow's under the learner
  const [found] = useState(() => chaptersToday(CITY_SEASONS, loadTownCity(), Date.now()).find((c) => c.chapter.id === focus && c.chapter.where === 'town') ?? null);
  const staged = useRef(false);
  useEffect(() => {
    if (!found || staged.current) return;
    staged.current = true;
    const host = found.chapter.at;
    onScene?.({ placeId: host, spot: { kind: 'place', id: host }, wedding: false });
    return () => onSceneEnd?.({ placeId: host, celebrate: false });
    // once, for the chapter this panel opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!found) {
    return (
      <div className="town-ls">
        <p className="town-build-hint">Chương này hôm nay chưa mở, hoặc bạn đã nghe rồi. Mỗi ngày mỗi chuyện chỉ mở một chương.</p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            Đóng
          </button>
        </div>
      </div>
    );
  }
  const { season, chapter } = found;
  return (
    <CityScenePanel
      scene={chapter}
      again={false}
      sound={sound}
      onReward={onReward}
      onSpeaking={onSpeaking ?? (() => undefined)}
      onClose={onClose}
      kicker={tl`${season.title} · chương ${chapter.n}/${season.chapters.length} · ${townPlace(chapter.at)?.name ?? ''}`}
    />
  );
}
