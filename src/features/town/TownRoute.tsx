// The town's route (#/town): the town itself, or, with ?at=city, Westbay (docs/town.md §20). Two pages on one route
// so the menu, the title and every link to the town stay as they are; bus no. 9 only changes the address. The city
// is its own chunk: nobody who never takes the bus loads it.

import { lazy, Suspense } from 'react';
import { useRoute } from '../../core/nav';
import TownPage from './TownPage';
import { withDictionary } from '../../i18n/load';
import { opensCity } from './townSpot';

const CityPage = lazy(withDictionary('city', () => import('./city/CityPage')));

export default function TownRoute() {
  const route = useRoute();
  // a bare #/town whose last street spot was in Westbay opens Westbay again (townSpot.ts): no bus ride after a reload
  if (route.params.at !== 'city' && !opensCity(route.params)) return <TownPage />;
  return (
    <Suspense fallback={<p className="muted">Đang lên xe số 9…</p>}>
      <CityPage />
    </Suspense>
  );
}
