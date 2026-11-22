// Mia's street talks (docs/town.md §14): the learner's friend met out in the town. Contract: core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-friend-1',
    placeId: 'friend',
    level: 1,
    lines: [
      { who: 'them', text: 'Hey! Have you seen the bus? I think I missed it.', vi: 'Chào! Bạn có thấy xe buýt đâu không? Chắc mình lỡ chuyến rồi.' },
      { who: 'you', text: 'It left about five minutes ago, sorry.', vi: 'Nó chạy cách đây chừng năm phút rồi, tiếc ghê.' },
      { who: 'them', text: "Ugh, typical. The next one isn't till half past.", vi: 'Trời, lại thế. Phải tới rưỡi mới có chuyến sau.' },
      { who: 'you', text: 'Want to grab a coffee while you wait?', vi: 'Đi uống cà phê trong lúc chờ không?' },
      { who: 'them', text: "Good idea. Emma's is close, and I need sugar anyway.", vi: 'Ý hay. Quán Emma gần đây, mà mình cũng đang thèm đồ ngọt.' },
    ],
  },
  {
    id: 'st-friend-2',
    placeId: 'friend',
    level: 1,
    lines: [
      { who: 'them', text: "Shh, don't move. There's a rabbit right behind you.", vi: 'Suỵt, đứng yên. Có con thỏ ngay sau lưng bạn kìa.' },
      { who: 'you', text: 'Really? Did you get a photo?', vi: 'Thật à? Bạn chụp được chưa?' },
      { who: 'them', text: 'Almost. Oh no, it just ran into the fields.', vi: 'Suýt nữa. Ôi không, nó chạy vào cánh đồng mất rồi.' },
      { who: 'you', text: 'Next time. There are lots of them out here.', vi: 'Lần sau vậy. Ngoài này nhiều thỏ lắm.' },
      { who: 'them', text: "True. I'm coming back tomorrow with a better camera.", vi: 'Ừ. Mai mình quay lại, mang theo máy ảnh xịn hơn.' },
    ],
  },
  {
    id: 'st-friend-3',
    placeId: 'friend',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: 'Okay, I need your opinion. Should I get a cat?', vi: 'Rồi, mình cần ý kiến của bạn. Mình có nên nuôi mèo không?' },
      { who: 'you', text: 'A cat? Can you look after one, though?', vi: 'Mèo á? Nhưng bạn có chăm nổi không?' },
      { who: 'them', text: 'I hope so. My place feels so quiet in the evenings.', vi: 'Mong là được. Tối đến nhà mình vắng quá.' },
      { who: 'you', text: 'Then go for it. Just start with an easy one.', vi: 'Vậy cứ nuôi đi. Có điều chọn con nào dễ nuôi trước.' },
      { who: 'them', text: "There's a note about free kittens on the notice board.", vi: 'Trên bảng tin có tờ báo cho mèo con miễn phí đấy.' },
      { who: 'you', text: "Then let's go and look at it together.", vi: 'Vậy mình cùng ra xem đi.' },
      { who: 'them', text: "Yes! You're the best. If it scratches me, it's your fault.", vi: 'Hay! Bạn là nhất. Nó mà cào mình thì tại bạn đấy.' },
    ],
  },
  {
    id: 'st-friend-4',
    placeId: 'friend',
    level: 2,
    fact: 'friend:sister-wedding',
    lines: [
      { who: 'them', text: 'Tell me honestly. Do people cry at wedding speeches?', vi: 'Nói thật đi. Người ta có khóc khi nghe phát biểu đám cưới không?' },
      { who: 'you', text: "Sometimes. Is your sister's wedding still in June?", vi: 'Đôi khi. Đám cưới chị bạn vẫn vào tháng Sáu à?' },
      { who: 'them', text: "Yes. And every time I practice, I'm the one who cries.", vi: 'Ừ. Mà lần nào tập, người khóc lại là mình.' },
      { who: 'you', text: 'That just means it comes from the heart.', vi: 'Thế nghĩa là bạn nói từ trái tim.' },
      { who: 'them', text: "Aw. Okay, I'm bringing tissues. Lots of tissues.", vi: 'Ôi. Thôi, mình sẽ mang khăn giấy. Thật nhiều khăn giấy.' },
    ],
  },
];
