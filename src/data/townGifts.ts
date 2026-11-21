// Gifts the learner can buy (with xu) and give to residents, once a day each. What a resident loves or likes is said
// somewhere in their dialogue (data/stories/*), so choosing the right gift is a listening test, not a guess.
// Ids are stable (stored in progress and in the residents' `taste`).

export interface TownGift {
  id: string;
  /** Vietnamese name. */
  name: string;
  /** English name, as residents say it in dialogue. */
  en: string;
  cost: number;
}

const gift = (id: string, name: string, en: string, cost: number): TownGift => ({ id, name, en, cost });

export const TOWN_GIFTS: readonly TownGift[] = [
  gift('iced-latte', 'Latte đá', 'an iced latte', 6),
  gift('lemon-cake', 'Bánh chanh', 'lemon cake', 8),
  gift('fresh-bread', 'Bánh mì mới nướng', 'fresh bread', 5),
  gift('chocolate', 'Sô-cô-la', 'chocolate', 6),
  gift('bubble-tea', 'Trà sữa trân châu', 'bubble tea', 7),
  gift('green-tea', 'Trà xanh', 'green tea', 6),
  gift('honey', 'Hũ mật ong', 'honey', 9),
  gift('fruit-basket', 'Giỏ trái cây', 'a fruit basket', 12),
  gift('roses', 'Hoa hồng', 'roses', 10),
  gift('sunflowers', 'Hoa hướng dương', 'sunflowers', 9),
  gift('house-plant', 'Chậu cây xanh', 'a house plant', 11),
  gift('novel', 'Tiểu thuyết', 'a novel', 12),
  gift('comic-book', 'Truyện tranh', 'a comic book', 8),
  gift('notebook', 'Sổ tay đẹp', 'a nice notebook', 7),
  gift('board-game', 'Trò chơi cờ bàn', 'a board game', 15),
  gift('movie-ticket', 'Vé xem phim', 'a movie ticket', 10),
  gift('scarf', 'Khăn quàng', 'a scarf', 13),
  gift('headphones', 'Tai nghe', 'headphones', 18),
  gift('dog-treats', 'Bánh thưởng cho chó', 'dog treats', 6),
  gift('spicy-noodles', 'Mì cay', 'spicy noodles', 5),
];

export function townGift(id: string): TownGift | undefined {
  return TOWN_GIFTS.find((g) => g.id === id);
}
