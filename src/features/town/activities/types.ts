// Activities of "Thị trấn" besides talking and building: each is a panel over the stage, opened from its spot in the
// world (the pier, the farm field, the egg kiosk, the wardrobe, the notice-board album) or from the HUD menu. The gift
// shop and the Sổ tay ("Thân thiết", docs/town.md §12) have no spot in the world: they open from the HUD menu (and the
// Sổ tay from a resident's hearts), where they are. So do "Hẹn hò & gia đình" and "Nhân vật" (docs/town.md §15).
// Rule for all of them (docs/town.md): every reward comes from LISTENING. Nothing is earned by clicking alone.

export type ActivityId = 'fish' | 'farm' | 'eggs' | 'wardrobe' | 'album' | 'gifts' | 'journal' | 'character' | 'love';

/** The activities with a spot in the world (data/townWorld ActivitySpotId): the player walks there first. */
export const SPOT_ACTIVITIES = ['fish', 'farm', 'eggs', 'wardrobe', 'album'] as const;
export const hasSpot = (id: ActivityId): id is (typeof SPOT_ACTIVITIES)[number] => (SPOT_ACTIVITIES as readonly string[]).includes(id);

export interface ActivityInfo {
  id: ActivityId;
  /** Vietnamese name shown in the HUD menu and on the spot's tag. */
  name: string;
  /** One short Vietnamese line: what you do there. */
  blurb: string;
}

export const ACTIVITIES: readonly ActivityInfo[] = [
  { id: 'fish', name: 'Câu cá', blurb: 'Nghe cá "nói", bắt đúng là câu được.' },
  { id: 'farm', name: 'Nông trại', blurb: 'Câu cần ôn là cây chín: ôn là thu hoạch.' },
  { id: 'eggs', name: 'Tiệm trứng', blurb: 'Ấp trứng ra thú cưng, mũ áo, danh hiệu.' },
  { id: 'wardrobe', name: 'Tủ đồ', blurb: 'Mặc đồ, đội mũ, dắt thú cưng.' },
  { id: 'album', name: 'Sưu tầm', blurb: 'Bộ sưu tập cá, thành tích, danh hiệu.' },
  { id: 'gifts', name: 'Tiệm quà', blurb: 'Mua quà tặng người dân, mỗi người một món mỗi ngày.' },
  { id: 'journal', name: 'Sổ tay', blurb: 'Độ thân với từng người, điều bạn biết về họ.' },
  { id: 'love', name: 'Hẹn hò & gia đình', blurb: 'Thân đủ thì tỏ tình, hẹn hò, cưới, có con.' },
  { id: 'character', name: 'Nhân vật', blurb: 'Nam hay nữ, tên, màu da, kiểu tóc.' },
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
}
