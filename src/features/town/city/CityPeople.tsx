// "Người quen ở Westbay" (docs/town.md §20): who the learner has met in the city, how each is tied to somebody of the
// town, how much of their story has been heard, and who waits with something new. Somebody not met yet shows only
// what can be seen from the street (their place), never their tie: that is for the talk to tell.

import { ArrowRight } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { sceneNow, sceneOwner, type TownCity } from '../../../core/town/city';
import { CITY_PEOPLE, cityPerson } from '../../../core/town/cityPeople';
import type { CityDistrict } from '../../../core/town/cityTypes';
import { CITY_SCENES } from '../../../data/city';
import { cityPlace } from '../../../data/cityWorld';
import { townPlace } from '../../../data/town';
import type { PlaceId } from '../../../data/townWorld';
import { tl } from '../../../i18n';
import { Portrait } from '../art';

const DISTRICTS: readonly { id: CityDistrict; name: string }[] = [
  { id: 'station', name: 'Ga & bến xe' },
  { id: 'market', name: 'Chợ cũ' },
  { id: 'arts', name: 'Phố nghệ thuật' },
];

const nameOf = (id: string): string => cityPerson(id)?.name ?? townPlace(id)?.resident ?? '';

function Row({ id, city, now, onGo }: { id: string; city: TownCity; now: number; onGo: (id: string) => void }) {
  const person = cityPerson(id);
  const own = CITY_SCENES.filter((s) => s.at === id);
  const heard = own.filter((s) => Object.hasOwn(city.heard, s.id)).length;
  const s = sceneNow(CITY_SCENES, id, city, now);
  const met = heard > 0;
  const name = nameOf(id);
  const status =
    s?.kind === 'new' ? (met ? 'Có chuyện mới' : 'Chưa gặp, đang rảnh') : s?.kind === 'again' ? 'Tới hạn nghe lại' : s?.kind === 'locked' ? tl`Gặp ${nameOf(sceneOwner(s.needs))} trước` : own.length > 0 ? 'Đã nghe hết' : '';
  return (
    <li className={'city-who' + (met ? '' : ' is-new')}>
      <Portrait placeId={id as PlaceId} size={44} name={name} />
      <div className="city-who-text">
        <p className="city-who-name">
          {met || !person ? name : (cityPlace(id)?.name ?? name)}
          {own.length > 0 && met && <span className="city-who-count tabular">{tl`${heard}/${own.length}`}</span>}
        </p>
        <p className="city-who-role">{person ? (met ? `${person.role}. ${person.tie}` : person.role) : 'Người thị trấn, hôm nay lên Westbay'}</p>
        {status && <p className={'city-who-status' + (s?.kind === 'new' || s?.kind === 'again' ? ' is-on' : '')}>{status}</p>}
      </div>
      {s && s.kind !== 'locked' && (
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onGo(id)} aria-label={tl`Tới gặp ${name}`} title={tl`Tới gặp ${name}`}>
          <Icon icon={ArrowRight} size={16} />
        </button>
      )}
    </li>
  );
}

export default function CityPeople({ city, guests, now, onGo }: { city: TownCity; guests: readonly string[]; now: number; onGo: (id: string) => void }) {
  const total = CITY_SCENES.length;
  const heard = CITY_SCENES.filter((s) => Object.hasOwn(city.heard, s.id)).length;
  return (
    <div className="city-people">
      {heard > 0 && <p className="town-build-hint">{tl`Đã nghe ${heard}/${total} đoạn ở Westbay.`}</p>}
      {DISTRICTS.map((d) => (
        <section key={d.id} className="city-people-part">
          <h3 className="city-people-head">{d.name}</h3>
          <ul className="city-who-list">
            {CITY_PEOPLE.filter((p) => p.district === d.id).map((p) => (
              <Row key={p.id} id={p.id} city={city} now={now} onGo={onGo} />
            ))}
          </ul>
        </section>
      ))}
      {guests.length > 0 && (
        <section className="city-people-part">
          <h3 className="city-people-head">Người thị trấn đang ở Westbay</h3>
          <ul className="city-who-list">
            {guests.map((id) => (
              <Row key={id} id={id} city={city} now={now} onGo={onGo} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
