// Emma's street talks (docs/town.md §14): the café's owner met out in the town. Contract: core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-cafe-1',
    placeId: 'cafe',
    level: 1,
    lines: [
      { who: 'them', text: "Hi! Sorry, I'm in a rush. We've run out of milk.", vi: 'Chào bạn! Xin lỗi, tôi đang vội. Quán hết sữa rồi.' },
      { who: 'you', text: 'Oh no. Where are you getting more?', vi: 'Ôi không. Thế bạn đi mua ở đâu?' },
      { who: 'them', text: "From the farm. It's fresher there, and it's not far.", vi: 'Ở nông trại. Ở đó tươi hơn, mà cũng không xa.' },
      { who: 'you', text: 'Do you need a hand with the bags?', vi: 'Bạn có cần tôi xách đỡ túi không?' },
      { who: 'them', text: "That's sweet, but I'm fine. Drop by later for a coffee!", vi: 'Bạn tốt quá, nhưng tôi xách được. Lát nữa ghé uống cà phê nhé!' },
    ],
  },
  {
    id: 'st-cafe-2',
    placeId: 'cafe',
    level: 1,
    lines: [
      { who: 'them', text: "Oh, hi! I'm taking a quick break. My feet hurt.", vi: 'Ồ, chào bạn! Tôi đang tranh thủ nghỉ một chút. Đau chân quá.' },
      { who: 'you', text: 'Busy morning at the café?', vi: 'Sáng nay quán đông lắm à?' },
      { who: 'them', text: 'Crazy busy. A whole bus of tourists stopped by at nine.', vi: 'Đông kinh khủng. Chín giờ có nguyên một xe khách du lịch ghé.' },
      { who: 'you', text: 'Wow. Did you have enough cake for everyone?', vi: 'Trời. Có đủ bánh cho mọi người không?' },
      { who: 'them', text: "Not even close. I'm baking twice as much tomorrow.", vi: 'Còn lâu mới đủ. Mai tôi nướng gấp đôi.' },
    ],
  },
  {
    id: 'st-cafe-3',
    placeId: 'cafe',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: 'Can I try an idea out on you? Be honest.', vi: 'Cho tôi thử một ý tưởng với bạn nhé? Nói thật đấy.' },
      { who: 'you', text: "Of course. I'm always honest about food.", vi: 'Tất nhiên. Chuyện ăn uống thì tôi luôn nói thật.' },
      { who: 'them', text: "I'm thinking about a new drink. Peach tea with ginger.", vi: 'Tôi đang tính làm món mới. Trà đào pha gừng.' },
      { who: 'you', text: 'Peach and ginger? That sounds really good, actually.', vi: 'Đào với gừng á? Nghe ngon thật đấy.' },
      { who: 'them', text: 'You think so? Everyone else says it sounds weird.', vi: 'Bạn nghĩ thế à? Ai cũng bảo nghe kỳ kỳ.' },
      { who: 'you', text: "Make me one, and I'll tell you the truth.", vi: 'Pha cho tôi một ly, tôi sẽ nói thật.' },
      { who: 'them', text: "Deal. Stop by tomorrow, and the first cup's free.", vi: 'Chốt. Mai ghé quán nhé, ly đầu tiên miễn phí.' },
    ],
  },
  {
    id: 'st-cafe-4',
    placeId: 'cafe',
    level: 2,
    fact: 'cafe:grandma-cake',
    lines: [
      { who: 'them', text: 'Look at all these lemons! I just got them at the orchard.', vi: 'Nhìn chỗ chanh này đi! Tôi vừa lấy ở vườn cây ăn quả.' },
      { who: 'you', text: "That's a lot. Is it lemon cake day?", vi: 'Nhiều thế. Hôm nay làm bánh chanh à?' },
      { who: 'them', text: "It is. Grandma's recipe, just like she made it every Sunday.", vi: 'Đúng rồi. Theo công thức của bà, y như Chủ nhật nào bà cũng làm.' },
      { who: 'you', text: "Your grandma's cake is the best thing in town.", vi: 'Bánh theo công thức của bà bạn là món ngon nhất thị trấn.' },
      { who: 'them', text: "That makes me so happy. I'll save you the biggest piece.", vi: 'Nghe vậy tôi vui lắm. Tôi sẽ để dành cho bạn miếng to nhất.' },
    ],
  },
];
