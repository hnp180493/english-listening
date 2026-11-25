// Activities of "Thị trấn" besides talking and building: each is a panel over the stage, opened from its spot in the
// world (the pier, the farm field, the egg kiosk, the wardrobe, the notice-board album) or from the HUD menu. The gift
// shop and the Sổ tay ("Thân thiết", docs/town.md §12) have no spot in the world: they open from the HUD menu (and the
// Sổ tay from a resident's hearts), where they are. So do "Hẹn hò & gia đình" and "Nhân vật" (docs/town.md §15).
// Rule for all of them (docs/town.md): every reward comes from LISTENING. Nothing is earned by clicking alone.

import type { SceneSpot } from '../../../data/romance/places';

/**
 * 'listen' is the panel of a thing used in the world (a bench, the radio) or of today's get-together (docs/town.md
 * §19, scenes/ListenPanel): it is not in ACTIVITIES, so not in the HUD's menu. Which one comes in `focus`.
 * 'season' is a chapter of one of Westbay's long stories played in the town (docs/town.md §21, city/SeasonPanel):
 * `focus` is the chapter's id.
 */
export type ActivityId = 'fish' | 'farm' | 'eggs' | 'wardrobe' | 'album' | 'gifts' | 'journal' | 'character' | 'love' | 'cafe' | 'case' | 'delivery' | 'listen' | 'season';

/** The activities with a spot in the world (data/townWorld ActivitySpotId): the player walks there first. */
export const SPOT_ACTIVITIES = ['fish', 'farm', 'eggs', 'wardrobe', 'album'] as const;
export const hasSpot = (id: ActivityId): id is (typeof SPOT_ACTIVITIES)[number] => (SPOT_ACTIVITIES as readonly string[]).includes(id);

export interface ActivityInfo {
  id: ActivityId;
  /** Vietnamese name shown in the HUD menu and on the spot's tag. */
  name: string;
  /** One short Vietnamese line: what you do there (the menu tile's tooltip and description). */
  blurb: string;
  /** The HUD menu's group: a listening game, or your things and the people you know. */
  group: 'game' | 'life';
}

export const ACTIVITIES: readonly ActivityInfo[] = [
  { id: 'cafe', name: 'Phụ quầy cà phê', blurb: 'Nghe khách gọi món, giao đúng trước khi khách hết kiên nhẫn.', group: 'game' },
  { id: 'delivery', name: 'Giao hàng cho Emma', blurb: 'Nghe Emma dặn món này của ai, tìm đúng người trong thị trấn.', group: 'game' },
  { id: 'case', name: 'Vụ án ở thị trấn', blurb: 'Mỗi ngày một kỳ: nghe ba nhân chứng, bắt đúng chi tiết.', group: 'game' },
  { id: 'fish', name: 'Câu cá', blurb: 'Nghe cá "nói", bắt đúng là câu được.', group: 'game' },
  { id: 'farm', name: 'Nông trại', blurb: 'Câu cần ôn là cây chín: ôn là thu hoạch.', group: 'game' },
  { id: 'eggs', name: 'Tiệm trứng', blurb: 'Ấp trứng ra thú cưng, mũ áo, danh hiệu.', group: 'life' },
  { id: 'wardrobe', name: 'Tủ đồ', blurb: 'Mặc đồ, đội mũ, dắt thú cưng.', group: 'life' },
  { id: 'album', name: 'Sưu tầm', blurb: 'Bộ sưu tập cá, thành tích, danh hiệu.', group: 'life' },
  { id: 'gifts', name: 'Tiệm quà', blurb: 'Mua quà tặng người dân, mỗi người một món mỗi ngày.', group: 'life' },
  { id: 'journal', name: 'Sổ tay', blurb: 'Độ thân với từng người, điều bạn biết về họ.', group: 'life' },
  { id: 'love', name: 'Hẹn hò & gia đình', blurb: 'Thân đủ thì tỏ tình, hẹn hò, cưới, có con.', group: 'life' },
  { id: 'character', name: 'Nhân vật', blurb: 'Nam hay nữ, tên, màu da, kiểu tóc.', group: 'life' },
];

/** What a panel may ask the page to do. The page owns the stage, the HUD and the toast. */
export interface ActivityPanelProps {
  onClose: () => void;
  /** Show a short celebration (toast + coins flying to the xu counter when `xu` > 0). */
  onReward: (r: { label: string; xu?: number }) => void;
  /** The stage's sound-effects setting (sfx.ts playSfx(name, sound)). */
  sound: boolean;
  /** The Sổ tay: the resident whose page opens first (a place id), null for the list. */
  focus?: string | null;
  /** Walk to a resident and talk (the Sổ tay's "Tới gặp"). */
  onTalk?: (placeId: string) => void;
  /** Open another activity's panel instead (the gift picker's "Tới Tiệm quà"). */
  onOpen?: (id: ActivityId) => void;
  /**
   * A courtship scene begins (docs/town.md §15): the stage takes the player where it happens (`spot`, data/romance/places;
   * null = here) and puts the one courted beside them; `wedding`: the town gathers round.
   */
  onScene?: (scene: { placeId: string; spot: SceneSpot | null; wedding: boolean }) => void;
  /** The scene is over (or left): the camera back on the player; `celebrate` for a yes, a proposal, a wedding. */
  onSceneEnd?: (end: { placeId: string; celebrate: boolean }) => void;
  /**
   * A "cảnh nghe" (docs/town.md §19) begins at the thing the player used (`focus`): they sit down on it, `who`
   * (place ids) come and talk nearby. Null: it is over, everybody goes back to what they did.
   */
  onListen?: (who: readonly string[] | null) => void;
  /** Who is speaking now in a "cảnh nghe" (a place id; null = nobody): the stage shows it over their head. */
  onSpeaking?: (who: string | null) => void;
  /** Bus no. 9 sets off (docs/town.md §20): the page goes to Westbay, with the friend asked along (a place id), if any. */
  onTravel?: (withId?: string) => void;
  /** Who may be asked along on the bus: friends from CITY_INVITE_HEARTS hearts (place id and name). */
  companions?: readonly { id: string; name: string }[];
}
