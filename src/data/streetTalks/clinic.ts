// clinic · Kim: street talks (contract: core/town/streetTalkTypes.ts, docs/town.md §14).
import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-clinic-1',
    placeId: 'clinic',
    level: 1,
    lines: [
      { who: 'them', text: 'Hi there! Are you heading to the clinic too?', vi: 'Chào bạn! Bạn cũng đang đến phòng khám à?' },
      { who: 'you', text: 'No, just to the shop. Are you working today?', vi: 'Không, tôi ra tiệm tạp hóa thôi. Hôm nay bạn làm à?' },
      { who: 'them', text: "All day. It's flu season, so we're really busy.", vi: 'Cả ngày. Đang mùa cúm nên bận lắm.' },
      { who: 'you', text: 'Oh no. Is there anything I should do?', vi: 'Thôi chết. Tôi có nên làm gì không?' },
      { who: 'them', text: "Wash your hands and get plenty of sleep. That's it.", vi: 'Rửa tay và ngủ đủ giấc. Vậy thôi.' },
    ],
  },
  {
    id: 'st-clinic-2',
    placeId: 'clinic',
    level: 1,
    lines: [
      { who: 'them', text: 'Look at these apples. I got them from the farm.', vi: 'Nhìn mấy quả táo này đi. Tôi mua ở nông trại đấy.' },
      { who: 'you', text: 'They look great. Was it busy up there?', vi: 'Trông ngon quá. Ở đó có đông không?' },
      { who: 'them', text: "Not really. Want one? They're really sweet this year.", vi: 'Không đông lắm. Ăn một quả không? Năm nay táo ngọt lắm.' },
      { who: 'you', text: "Yes, please. Thanks, that's really kind.", vi: 'Có chứ. Cảm ơn, bạn tốt quá.' },
      { who: 'them', text: "Eat it today. That's an order from the clinic!", vi: 'Ăn trong hôm nay nhé. Lệnh của phòng khám đấy!' },
    ],
  },
  {
    id: 'st-clinic-3',
    placeId: 'clinic',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: 'Can I ask you something? What do you do to relax?', vi: 'Cho tôi hỏi chút. Bạn làm gì để thư giãn?' },
      { who: 'you', text: 'I usually take a slow walk around the lake.', vi: 'Tôi hay đi bộ chậm rãi quanh hồ.' },
      { who: 'them', text: "That sounds nice. I haven't had a day off in weeks.", vi: 'Nghe hay đấy. Mấy tuần rồi tôi chưa được nghỉ ngày nào.' },
      { who: 'you', text: 'Weeks? You tell everyone else to rest, you know.', vi: 'Mấy tuần á? Bạn toàn bảo người khác nghỉ ngơi đấy thôi.' },
      { who: 'them', text: 'Ha, you sound just like me with my patients.', vi: 'Ha, bạn nói y như tôi nói với bệnh nhân.' },
      { who: 'you', text: 'So take your own advice. Walk with me on Sunday.', vi: 'Vậy thì làm theo lời mình đi. Chủ nhật đi bộ với tôi.' },
      { who: 'them', text: 'Okay, okay. Sunday at the lake it is.', vi: 'Thôi được. Chốt Chủ nhật ra hồ.' },
    ],
  },
  {
    id: 'st-clinic-4',
    placeId: 'clinic',
    level: 2,
    fact: 'clinic:loves-sunflowers',
    lines: [
      { who: 'them', text: "Spring's here, so it's sunflower time again.", vi: 'Xuân tới rồi, lại đến mùa trồng hướng dương.' },
      { who: 'you', text: "For your grandma? You said they're her favorite.", vi: 'Trồng vì bà bạn à? Bạn kể đó là hoa bà thích nhất mà.' },
      { who: 'them', text: 'Yes. Every year I plant a row by the clinic.', vi: 'Ừ. Năm nào tôi cũng trồng một hàng cạnh phòng khám.' },
      { who: 'you', text: "I'd love to help if you need an extra pair of hands.", vi: 'Nếu cần thêm người phụ thì tôi giúp nhé.' },
      { who: 'them', text: "Really? I'm planting them on Saturday morning.", vi: 'Thật hả? Sáng thứ Bảy này tôi trồng.' },
      { who: 'you', text: 'Saturday works for me. What should I bring?', vi: 'Thứ Bảy tôi rảnh. Tôi nên mang gì?' },
      { who: 'them', text: "Just a hat. I'll bring the seeds and some green tea.", vi: 'Một cái mũ thôi. Hạt giống với trà xanh để tôi lo.' },
    ],
  },
];
