// Sarah's street talks (docs/town.md §14): the learner's busy coworker met out in the town. Contract:
// core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-office-1',
    placeId: 'office',
    level: 1,
    lines: [
      { who: 'them', text: "Sorry, can't stop. My bus leaves in two minutes!", vi: 'Xin lỗi, không dừng được. Hai phút nữa xe buýt chạy rồi!' },
      { who: 'you', text: 'Where are you off to in such a hurry?', vi: 'Bạn vội đi đâu thế?' },
      { who: 'them', text: 'A meeting in the city. And I left my notes at home.', vi: 'Đi họp trên thành phố. Mà tôi để quên ghi chú ở nhà.' },
      { who: 'you', text: 'Oh no. Can you do it without them?', vi: 'Ôi không. Không có chúng bạn họp được không?' },
      { who: 'them', text: "I'll have to. Wish me luck. See you at work tomorrow!", vi: 'Đành vậy. Chúc tôi may mắn đi. Mai gặp ở chỗ làm nhé!' },
    ],
  },
  {
    id: 'st-office-2',
    placeId: 'office',
    level: 1,
    lines: [
      { who: 'them', text: "Hi! I've got ten minutes, so I'm eating outside today.", vi: 'Chào bạn! Tôi có mười phút, nên hôm nay ra ngoài ăn.' },
      { who: 'you', text: "Good idea. It's too nice to stay indoors.", vi: 'Ý hay. Trời đẹp thế này ở trong nhà phí lắm.' },
      { who: 'them', text: 'Did you hear the printer broke again this morning?', vi: 'Bạn nghe tin sáng nay máy in lại hỏng chưa?' },
      { who: 'you', text: "Again? That's the third time this week.", vi: 'Lại hỏng á? Lần thứ ba trong tuần rồi.' },
      { who: 'them', text: 'I know. Someone should just throw it in the lake.', vi: 'Biết mà. Ai đó nên ném nó xuống hồ cho rồi.' },
    ],
  },
  {
    id: 'st-office-3',
    placeId: 'office',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: "Honestly? I haven't had a day off in two years.", vi: 'Nói thật nhé? Hai năm rồi tôi chưa nghỉ ngày nào.' },
      { who: 'you', text: 'Two years? Sarah, you really need a break.', vi: 'Hai năm á? Sarah, bạn cần nghỉ ngơi thật đấy.' },
      { who: 'them', text: 'I know. So where would you go for one quiet day?', vi: 'Biết chứ. Thế nếu được một ngày yên tĩnh, bạn sẽ đi đâu?' },
      { who: 'you', text: "Up the hill in the woods. The view's amazing.", vi: 'Lên ngọn đồi trong rừng. Cảnh đẹp tuyệt.' },
      { who: 'them', text: 'That sounds perfect. No phone, no emails, just trees.', vi: 'Nghe hoàn hảo đấy. Không điện thoại, không email, chỉ có cây.' },
      { who: 'you', text: 'Exactly. Take Friday off and go.', vi: 'Đúng thế. Thứ Sáu xin nghỉ rồi đi đi.' },
      { who: 'them', text: "Maybe I will. Don't tell anyone I said that.", vi: 'Có khi tôi đi thật. Đừng kể với ai là tôi nói thế nhé.' },
    ],
  },
  {
    id: 'st-office-4',
    placeId: 'office',
    level: 2,
    fact: 'office:team-leader',
    lines: [
      { who: 'them', text: 'Hey! Sorry, being team leader means I never stop running.', vi: 'Chào! Xin lỗi, làm trưởng nhóm là chạy suốt cả ngày.' },
      { who: 'you', text: "How's it going upstairs? Do you like it?", vi: 'Trên tầng trên thế nào rồi? Bạn thích không?' },
      { who: 'them', text: 'Mostly. But everyone asks me questions, all day long.', vi: 'Phần lớn thì thích. Nhưng cả ngày ai cũng hỏi tôi.' },
      { who: 'you', text: "That's because they trust you. It's a good sign.", vi: 'Vì họ tin bạn. Thế là dấu hiệu tốt.' },
      { who: 'them', text: "Hm, I never thought of it like that. Thanks.", vi: 'Hừm, tôi chưa từng nghĩ theo hướng đó. Cảm ơn nhé.' },
    ],
  },
];
