// Whether "Tặng quà" is worth offering for a resident now: a gift in hand and none given to them today (one a day).
import { useState } from 'react';
import { giftedToday, giftsInHand } from '../../../core/town/friendship';
import { useTownProgress } from '../../../core/town/store';

export function useCanGift(placeId: string | null | undefined): boolean {
  const progress = useTownProgress();
  const [now] = useState(() => Date.now());
  if (!placeId) return false;
  return giftsInHand(progress).length > 0 && !giftedToday(progress, placeId, now);
}
