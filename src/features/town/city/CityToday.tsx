// "Hôm nay ở Westbay" (docs/town.md §21): what there is to do today, three kinds of thing at most: what is on (the
// weekday's get-together, a festival of the month), today's chapter of each story under way, and who of the town is
// up here. One short list; each row has one button that takes the player there.

import { ArrowRight } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { seasonNow, sceneOwner, type TownCity } from '../../../core/town/city';
import { cityPerson } from '../../../core/town/cityPeople';
import type { CityEvent, CityScene, CitySeason } from '../../../core/town/cityTypes';
import { townPlace } from '../../../data/town';
import { tl } from '../../../i18n';

const nameOf = (id: string): string => cityPerson(id)?.name ?? townPlace(id)?.resident ?? '';

export interface CityTodayProps {
  city: TownCity;
  now: number;
  events: readonly { event: CityEvent; done: boolean }[];
  seasons: readonly CitySeason[];
  guests: readonly string[];
  onEvent: (event: CityEvent) => void;
  /** A chapter played in the city: go to whoever it is with. */
  onChapter: (chapter: CityScene) => void;
  /** A chapter played in the town: back on the bus. */
  onTown: (chapter: CityScene) => void;
}

export default function CityToday({ city, now, events, seasons, guests, onEvent, onChapter, onTown }: CityTodayProps) {
  const stories = seasons.map((s) => seasonNow(s, city, now));
  const started = stories.filter((s) => s.kind !== 'locked' && s.kind !== 'done');
  const waiting = stories.filter((s) => s.kind === 'locked');
  const nothing = events.length === 0 && started.length === 0;
  return (
    <div className="city-today">
      {events.map(({ event, done }) => (
        <section key={event.id} className="city-today-row">
          <div className="city-today-text">
            <p className="city-today-name">
              {event.name}
              {done && <span className="city-today-done"> · đã dự</span>}
            </p>
            <p className="city-today-blurb">{event.blurb}</p>
          </div>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => onEvent(event)}>
            {done ? 'Nghe lại' : 'Tới dự'}
          </button>
        </section>
      ))}
      {started.map((s) => {
        const ch = s.kind === 'open' || s.kind === 'tomorrow' ? s.chapter : null;
        if (!ch) return null;
        const inTown = ch.where === 'town';
        return (
          <section key={s.season.id} className="city-today-row">
            <div className="city-today-text">
              <p className="city-today-name">{tl`${s.season.title} · chương ${ch.n}/${s.season.chapters.length}`}</p>
              <p className="city-today-blurb">{s.kind === 'tomorrow' ? 'Chương kế mở vào ngày mai.' : inTown ? tl`Chương này diễn ra dưới thị trấn, chỗ ${nameOf(ch.at)}.` : tl`Chương này ở chỗ ${nameOf(ch.at)}.`}</p>
            </div>
            {s.kind === 'open' && (
              <button type="button" className="btn btn-soft btn-sm" onClick={() => (inTown ? onTown(ch) : onChapter(ch))}>
                {inTown ? 'Về thị trấn' : 'Tới nghe'}
                <Icon icon={ArrowRight} size={15} />
              </button>
            )}
          </section>
        );
      })}
      {nothing && <p className="town-build-hint">Hôm nay không có buổi gặp mặt nào và chưa có chương truyện mới. Cứ đi dạo, ai có chuyện mới thì trên đầu họ có dấu.</p>}
      {waiting.length > 0 && (
        <p className="town-build-hint">
          {tl`Còn ${waiting.length} chuyện dài chưa mở.`}{' '}
          {waiting
            .slice(0, 2)
            .map((s) => {
              if (s.kind !== 'locked') return '';
              // a story that grows out of another one's last chapter (the main story's part 2): name that story
              const before = seasons.find((x) => x.chapters.some((c) => c.id === s.needs));
              return before ? tl`"${s.season.title}" mở khi bạn nghe hết "${before.title}".` : tl`"${s.season.title}" chờ bạn nghe xong chuyện của ${nameOf(sceneOwner(s.needs))}.`;
            })
            .join(' ')}
        </p>
      )}
      {guests.length > 0 && <p className="town-build-hint">{tl`Người thị trấn đang ở đây: ${guests.map(nameOf).join(', ')}.`}</p>}
    </div>
  );
}
