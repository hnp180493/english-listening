// Who the learner is on a stage: what they wear and who follows them (Tủ đồ), their own character (docs/town.md §15)
// and their children old enough to walk. The city's page reads it here; the town's page has the same lines inline
// (TownPage.tsx, with what only the town shows: the farm, the projects).

import { useMemo, useState } from 'react';
import { useTownGame } from '../../core/town/gameStore';
import { kidAge, kidsOf, partnerOf } from '../../core/town/life';
import { useTownLife } from '../../core/town/lifeStore';
import type { StageKid, StageState } from './engine/sim';
import { castLook, profileLook, setPlayerLook } from './three/chars/looks';

export function usePlayerOnStage(): Pick<StageState, 'look' | 'body' | 'playerName' | 'kids'> {
  const game = useTownGame();
  const hat = game.look.hat?.id;
  const outfit = game.look.outfit?.id;
  const pet = game.look.pet?.id;
  const look = useMemo(() => ({ hat, outfit, pet }), [hat, outfit, pet]);
  const life = useTownLife();
  const profile = life.profile;
  // set while rendering (it only changes a module's look, idempotent): the stage, a child, applies its state before
  // this page's effects
  const body = useMemo(() => {
    const l = profile ? profileLook(profile) : null;
    setPlayerLook(l);
    return l ? JSON.stringify(l) : '';
  }, [profile]);
  const spouse = partnerOf(life);
  const married = !!(spouse && life.court[spouse]?.married);
  const [kidsAt] = useState(() => Date.now());
  const kidsKey = married && profile ? kidsOf(life).filter(({ kid }) => kidAge(kid.born, kidsAt) !== 'baby').map(({ id }, i) => `${id}:${i}`).join(',') : '';
  const kids = useMemo<StageKid[]>(() => {
    if (!kidsKey || !profile || !spouse) return [];
    const other = castLook(spouse).hair.color;
    return kidsOf(life)
      .filter(({ kid }) => kidAge(kid.born, kidsAt) !== 'baby')
      .map(({ id, kid }, i) => ({ id, skin: profile.skin, hair: i % 2 === 0 ? other : profile.hairColor, toddler: kidAge(kid.born, kidsAt) === 'toddler' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidsKey, profile, spouse]);
  return useMemo(() => ({ look, body, playerName: profile?.name, kids }), [look, body, profile?.name, kids]);
}
