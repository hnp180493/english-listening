// Ben's street talks (docs/town.md §14): the shopkeeper met out in the town. Contract: core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-shop-1',
    placeId: 'shop',
    level: 1,
    lines: [
      { who: 'them', text: 'Hey! Can you hold this end for me? Thanks.', vi: 'Ê! Giữ giúp tôi đầu này được không? Cảm ơn.' },
      { who: 'you', text: 'Sure. What are you putting up?', vi: 'Được chứ. Bạn dán cái gì thế?' },
      { who: 'them', text: "A poster for the weekend sale. Everything's ten percent off.", vi: 'Áp phích giảm giá cuối tuần. Mọi thứ giảm mười phần trăm.' },
      { who: 'you', text: 'Nice. Even the chocolate?', vi: 'Hay đấy. Cả sô-cô-la luôn à?' },
      { who: 'them', text: 'Especially the chocolate. I ordered way too much of it.', vi: 'Nhất là sô-cô-la. Tôi lỡ nhập nhiều quá trời.' },
    ],
  },
  {
    id: 'st-shop-2',
    placeId: 'shop',
    level: 1,
    lines: [
      { who: 'them', text: "Excuse me, coming through! This cart's got no brakes.", vi: 'Xin lỗi, cho qua với! Cái xe này không có phanh.' },
      { who: 'you', text: 'Whoa! Where are you taking all that?', vi: 'Ối! Bạn chở đống đó đi đâu thế?' },
      { who: 'them', text: "Flour and sugar for Emma. She's baking all day.", vi: 'Bột với đường cho Emma. Cô ấy nướng bánh cả ngày.' },
      { who: 'you', text: 'Do you deliver to everyone in town?', vi: 'Bạn giao hàng cho cả thị trấn à?' },
      { who: 'them', text: 'Only to people who pay. And people who give me cake.', vi: 'Chỉ giao cho ai trả tiền. Với ai cho tôi bánh.' },
    ],
  },
  {
    id: 'st-shop-3',
    placeId: 'shop',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: "Okay, I've got a new joke. Tell me if it's funny.", vi: 'Rồi, tôi có câu đùa mới. Nghe xem có buồn cười không.' },
      { who: 'you', text: "Go on, then. I'm ready to laugh.", vi: 'Kể đi. Tôi sẵn sàng cười đây.' },
      { who: 'them', text: 'Why did the battery go to the clinic? It felt flat.', vi: 'Sao cục pin phải đi khám? Vì nó thấy "hết hơi".' },
      { who: 'you', text: "That's terrible. I love it.", vi: 'Dở tệ. Mà tôi thích.' },
      { who: 'them', text: "Thanks. My dad says I'm the worst joke teller alive.", vi: 'Cảm ơn. Bố tôi bảo tôi kể chuyện cười dở nhất thế giới.' },
      { who: 'you', text: "Your dad's wrong. You're the second worst.", vi: 'Bố bạn sai rồi. Bạn dở nhì thôi.' },
      { who: 'them', text: "Ha! Second place. I'll take it. That's a new record.", vi: 'Ha! Hạng nhì. Nhận luôn. Kỷ lục mới đấy.' },
    ],
  },
  {
    id: 'st-shop-4',
    placeId: 'shop',
    level: 2,
    fact: 'shop:dads-shop',
    lines: [
      { who: 'them', text: "Guess what? My dad's coming by the shop on Saturday.", vi: 'Đoán xem? Thứ Bảy này bố tôi ghé tiệm.' },
      { who: 'you', text: "That's great. Is he still worried about the supermarket?", vi: 'Tốt quá. Bác vẫn lo vụ siêu thị à?' },
      { who: 'them', text: "A bit. But this month's been a little better, actually.", vi: 'Hơi hơi. Nhưng tháng này khá lên một chút rồi.' },
      { who: 'you', text: "Then show him. He'll be proud of you.", vi: 'Vậy cho bác xem đi. Bác sẽ tự hào về bạn.' },
      { who: 'them', text: 'I hope so. Thirty years, and he still checks every shelf.', vi: 'Mong là vậy. Ba mươi năm rồi, ông vẫn kiểm tra từng kệ hàng.' },
    ],
  },
];
