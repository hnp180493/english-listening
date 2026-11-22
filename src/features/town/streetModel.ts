// Meeting a resident out in the town (docs/town.md §14 "Gặp trên đường"), as plain data for the page: where their talk
// would happen at home, whether the place they stand at is the street, what you see when you meet them there, and what
// they say before you part (come round to hear the rest of their story, or: get closer first).

import type { PlaceView } from '../../core/town/overview';
import type { StorySetting } from '../../core/town/story';
import { episodeSetting, quickChatSetting, storyEpisode } from '../../data/townStories';
import { streetInvite, streetScene } from '../../data/townStreet';
import { lockText } from './friends/friendModel';

type Places = readonly Pick<PlaceView, 'place' | 'built'>[];

const builtIn = (places: Places) => (id: string) => places.some((p) => p.place.id === id && p.built);

/** Where a talk with this resident happens at home now: their waiting episode's setting, else their quick chat's. */
export function homeSetting(view: Pick<PlaceView, 'place' | 'episode'>, places: Places): StorySetting {
  const built = builtIn(places);
  const e = view.episode ? storyEpisode(view.episode.id) : undefined;
  return e ? episodeSetting(e, built) : quickChatSetting(view.place.id, built);
}

/** A setting's place as a word inside a sentence: "nhà trọ", "quán cà phê", "quảng trường". */
export function settingWord(setting: StorySetting, places: Places): string {
  const id = setting.kind === 'inside' ? setting.room : setting.at;
  if (id === 'inn') return 'nhà trọ';
  const name = places.find((p) => p.place.id === id)?.place.name ?? 'nhà';
  return name.charAt(0).toLocaleLowerCase('vi') + name.slice(1);
}

/** What the page shows when two meet in the street: the scene at the start, the parting words at the end. */
export interface StreetTalkView {
  scene: string | null;
  /** Their next episode waits elsewhere: they ask you round (`go`: the button that takes you there). */
  invite: { text: string; go: string } | null;
  /** No episode waits but the next one needs more friendship: how close you must get first. */
  hint: string | null;
}

/** A day number for the scene's seed: the same meeting reads the same all day. */
const dayNumber = (now: number) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};

export function streetTalkView(
  view: Pick<PlaceView, 'place' | 'episode' | 'friendEpisode' | 'friend'>,
  places: Places,
  knows: (fact: string) => boolean,
  now: number,
  turn = 0,
): StreetTalkView {
  const who = view.place.resident;
  const scene = streetScene(view.place.id, view.friend.hearts, knows, dayNumber(now) + hash(view.place.id) + turn);
  if (view.episode) {
    const where = settingWord(homeSetting(view, places), places);
    return { scene, invite: { text: streetInvite(who, where, view.episode.mode === 'relisten'), go: `Đi cùng ${who} tới ${where}` }, hint: null };
  }
  const f = view.friendEpisode;
  const need = f ? lockText(f, who) : '';
  return { scene, invite: null, hint: need ? `${need.replace(/^Cần/, 'Thân hơn nữa (cần')}) thì ${who} sẽ kể thêm chuyện riêng.` : null };
}

