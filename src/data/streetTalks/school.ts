// Daniel's street talks (docs/town.md §14): the learner's teacher met out in the town; he says "thầy" and calls the
// learner "em". Contract: core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-school-1',
    placeId: 'school',
    level: 1,
    lines: [
      { who: 'them', text: 'Ah, hello! Off to work, or just out for a walk?', vi: 'À, chào em! Đi làm hay đi dạo thế?' },
      { who: 'you', text: "Just a walk. I'm trying to get more fresh air.", vi: 'Dạ đi dạo thôi ạ. Em đang cố ra ngoài hít thở nhiều hơn.' },
      { who: 'them', text: 'Very wise. I walk to school every day, rain or shine.', vi: 'Khôn đấy. Ngày nào thầy cũng đi bộ tới trường, mưa hay nắng.' },
      { who: 'you', text: "Every day? Isn't it a long way?", vi: 'Ngày nào cũng thế ạ? Không xa sao thầy?' },
      { who: 'them', text: "Twenty minutes. That's when I do my best thinking.", vi: 'Hai mươi phút. Thầy nghĩ ra nhiều thứ nhất là lúc đó.' },
    ],
  },
  {
    id: 'st-school-2',
    placeId: 'school',
    level: 1,
    lines: [
      { who: 'them', text: 'Ah, perfect timing. Have you seen the new class times?', vi: 'À, đúng lúc quá. Em xem giờ học mới chưa?' },
      { who: 'you', text: 'Not yet. Did something change?', vi: 'Chưa ạ. Có gì thay đổi ạ?' },
      { who: 'them', text: 'The evening class starts at seven now, not six.', vi: 'Lớp buổi tối giờ bắt đầu lúc bảy giờ, không phải sáu giờ.' },
      { who: 'you', text: 'Seven is better for me, actually. I finish work late.', vi: 'Thật ra bảy giờ em lại tiện hơn. Em tan làm muộn.' },
      { who: 'them', text: 'Good. Tell the others if you see them, would you?', vi: 'Tốt. Gặp các bạn trong lớp thì báo giúp thầy nhé?' },
    ],
  },
  {
    id: 'st-school-3',
    placeId: 'school',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: "I'd like your opinion on something, if you don't mind.", vi: 'Thầy muốn hỏi ý kiến em một chuyện, nếu em không phiền.' },
      { who: 'you', text: 'Of course. What is it?', vi: 'Dạ được ạ. Chuyện gì thế thầy?' },
      { who: 'them', text: "I'm thinking of having one class outside, by the lake.", vi: 'Thầy định cho một buổi học ngoài trời, bên hồ.' },
      { who: 'you', text: "That's a great idea. Everyone would love it.", vi: 'Ý hay quá ạ. Ai cũng sẽ thích.' },
      { who: 'them', text: "You don't think people would just watch the ducks?", vi: 'Em không sợ cả lớp chỉ ngồi ngắm vịt à?' },
      { who: 'you', text: 'Maybe. Then we could talk about the ducks in English.', vi: 'Có thể ạ. Thế thì mình tập nói về vịt bằng tiếng Anh.' },
      { who: 'them', text: "Ha! That's a lesson plan already. The lake it is.", vi: 'Ha! Thành giáo án luôn rồi. Vậy chốt học bên hồ.' },
    ],
  },
  {
    id: 'st-school-4',
    placeId: 'school',
    level: 2,
    fact: 'school:writing-a-novel',
    lines: [
      { who: 'them', text: 'Can you keep a secret? I finished another chapter last night.', vi: 'Em giữ bí mật được không? Tối qua thầy viết xong thêm một chương.' },
      { who: 'you', text: "That's great! How's the mystery going?", vi: 'Hay quá ạ! Truyện trinh thám tới đâu rồi thầy?' },
      { who: 'them', text: 'The detective finally found the missing key. It took me three weeks.', vi: 'Thám tử cuối cùng cũng tìm ra chiếc chìa khóa bị mất. Thầy mất ba tuần đấy.' },
      { who: 'you', text: "Three weeks for one key? I can't wait to read it.", vi: 'Ba tuần cho một chiếc chìa khóa ạ? Em nóng lòng muốn đọc quá.' },
      { who: 'them', text: "Patience. Twelve years in, I'm in no hurry.", vi: 'Kiên nhẫn nào. Viết mười hai năm rồi, thầy chẳng vội đâu.' },
    ],
  },
];
