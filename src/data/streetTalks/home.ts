// Grace's street talks (docs/town.md §14): the old neighbour met out in the town; she says "bà" and calls the learner
// "cháu". Contract: core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-home-1',
    placeId: 'home',
    level: 1,
    lines: [
      { who: 'them', text: "Hello, dear. Isn't it a lovely morning for a walk?", vi: 'Chào cháu. Sáng nay đi dạo dễ chịu quá nhỉ?' },
      { who: 'you', text: 'It really is. Where are you heading?', vi: 'Đúng thật ạ. Bà đang đi đâu thế ạ?' },
      { who: 'them', text: 'Just to the park. I like to feed the birds.', vi: 'Ra công viên thôi. Bà thích cho chim ăn.' },
      { who: 'you', text: 'That sounds nice. Do they know you by now?', vi: 'Nghe thích ghê. Chắc giờ chúng quen bà rồi nhỉ?' },
      { who: 'them', text: 'Oh, they do. They follow me home like little children.', vi: 'Quen chứ. Chúng theo bà về tận nhà như lũ trẻ con ấy.' },
    ],
  },
  {
    id: 'st-home-2',
    placeId: 'home',
    level: 1,
    lines: [
      { who: 'them', text: "Dear, you'll catch a cold without a jacket on.", vi: 'Cháu ơi, không mặc áo khoác là cảm lạnh đấy.' },
      { who: 'you', text: "I'm fine. It's not that cold today.", vi: 'Cháu không sao ạ. Hôm nay đâu có lạnh lắm.' },
      { who: 'them', text: "Not yet, but it's going to rain this afternoon.", vi: 'Giờ thì chưa, nhưng chiều nay trời mưa đấy.' },
      { who: 'you', text: "How do you know? The sky's totally blue.", vi: 'Sao bà biết ạ? Trời xanh ngắt mà.' },
      { who: 'them', text: "My knees always know. They've never been wrong.", vi: 'Đầu gối bà biết hết. Chưa sai lần nào.' },
    ],
  },
  {
    id: 'st-home-3',
    placeId: 'home',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: 'Dear, could you help me with this new phone?', vi: 'Cháu ơi, giúp bà cái điện thoại mới này được không?' },
      { who: 'you', text: "Of course. What's the problem?", vi: 'Dạ được ạ. Có chuyện gì thế bà?' },
      { who: 'them', text: "The letters are so small. I can't read a thing.", vi: 'Chữ bé quá. Bà chẳng đọc được gì.' },
      { who: 'you', text: "Here, I'll make them bigger for you. Look.", vi: 'Đây, cháu chỉnh chữ to lên cho bà. Bà xem này.' },
      { who: 'them', text: "Oh, that's much better! Max sold it to me yesterday.", vi: 'Ôi, rõ hơn nhiều rồi! Hôm qua Max bán cho bà đấy.' },
      { who: 'you', text: 'Now you can text me whenever you like.', vi: 'Giờ bà nhắn cho cháu lúc nào cũng được.' },
      { who: 'them', text: "I'll practice tonight. Don't laugh at my spelling, dear.", vi: 'Tối nay bà tập. Đừng cười bà viết sai chính tả nhé.' },
    ],
  },
  {
    id: 'st-home-4',
    placeId: 'home',
    level: 2,
    fact: 'home:was-nurse',
    lines: [
      { who: 'them', text: 'Let me see that hand, dear. Did you cut it?', vi: 'Cho bà xem tay nào, cháu. Bị đứt tay à?' },
      { who: 'you', text: "It's nothing. I scratched it on a branch.", vi: 'Không sao đâu ạ. Cháu bị cành cây cào thôi.' },
      { who: 'them', text: 'Forty years a nurse, dear. Nothing is ever nothing.', vi: 'Bà làm y tá bốn mươi năm rồi, cháu à. Chẳng có gì là "không sao" cả.' },
      { who: 'you', text: 'Okay, okay. What should I do?', vi: 'Dạ, dạ. Thế cháu phải làm sao ạ?' },
      { who: 'them', text: 'Wash it well and put a plaster on it today.', vi: 'Rửa thật sạch rồi dán băng cá nhân ngay hôm nay.' },
      { who: 'you', text: 'I will. Thank you, Nurse Grace.', vi: 'Cháu nhớ rồi. Cảm ơn bà y tá ạ.' },
      { who: 'them', text: 'Good. And if it gets red, go and see Kim.', vi: 'Ngoan. Mà nếu nó tấy đỏ thì đi khám chỗ Kim nhé.' },
    ],
  },
];
