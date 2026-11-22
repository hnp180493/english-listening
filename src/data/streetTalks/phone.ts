// phone · Max (light Australian accent): street talks (contract: core/town/streetTalkTypes.ts, docs/town.md §14).
// Slang stays light, as in his arc (mate, heaps, reckon, arvo, righto).
import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-phone-1',
    placeId: 'phone',
    level: 1,
    lines: [
      { who: 'them', text: "Hey, mate! I'm off to the cafe for an iced latte.", vi: 'Chào! Tôi đang ra quán cà phê làm ly latte đá.' },
      { who: 'you', text: "Again? That's your second one today, isn't it?", vi: 'Lại nữa à? Ly thứ hai trong ngày rồi đúng không?' },
      { who: 'them', text: "Third, actually. It's going to be a long arvo.", vi: 'Ly thứ ba cơ. Chiều nay còn dài lắm.' },
      { who: 'you', text: 'Fair enough. Is the phone shop busy today?', vi: 'Cũng phải. Hôm nay tiệm điện thoại đông không?' },
      { who: 'them', text: "Heaps of cracked screens. Everyone's dropping their phones this week.", vi: 'Cả đống màn hình vỡ. Tuần này ai cũng làm rơi điện thoại.' },
    ],
  },
  {
    id: 'st-phone-2',
    placeId: 'phone',
    level: 1,
    lines: [
      { who: 'them', text: 'Excuse me, mate. Is your phone getting any signal here?', vi: 'Ê bạn. Điện thoại bạn ở đây có sóng không?' },
      { who: 'you', text: "Just one bar. It's always weak near the lake.", vi: 'Có một vạch thôi. Gần hồ sóng lúc nào cũng yếu.' },
      { who: 'them', text: 'Ah, right. I need to call a customer back.', vi: 'À, ra thế. Tôi cần gọi lại cho một khách hàng.' },
      { who: 'you', text: 'Try the plaza. The signal is much better there.', vi: 'Thử ra quảng trường xem. Ở đó sóng mạnh hơn nhiều.' },
      { who: 'them', text: "Good tip, cheers. I'll walk that way now.", vi: 'Mẹo hay, cảm ơn nhé. Giờ tôi đi lối đó.' },
    ],
  },
  {
    id: 'st-phone-3',
    placeId: 'phone',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: "I reckon I'll host a board game night. Interested?", vi: 'Tôi tính tổ chức một tối chơi cờ bàn. Bạn có hứng không?' },
      { who: 'you', text: "Sounds fun. But I don't know many games.", vi: 'Nghe vui đấy. Nhưng tôi không biết nhiều trò lắm.' },
      { who: 'them', text: "No worries, I'll teach you. It's heaps easier than it looks.", vi: 'Không sao, tôi chỉ cho. Dễ hơn nhìn nhiều.' },
      { who: 'you', text: 'Okay. What should I bring?', vi: 'Được. Tôi nên mang gì?' },
      { who: 'them', text: 'Just snacks. Honestly, I just miss having people around.', vi: 'Đồ ăn vặt thôi. Nói thật, tôi chỉ thèm cảnh đông vui.' },
      { who: 'you', text: 'Then count me in. Friday night?', vi: 'Vậy tính tôi một suất. Tối thứ Sáu nhé?' },
      { who: 'them', text: "Friday's perfect. You're a legend, mate.", vi: 'Thứ Sáu thì tuyệt. Bạn đỉnh thật.' },
    ],
  },
  {
    id: 'st-phone-4',
    placeId: 'phone',
    level: 2,
    fact: 'phone:misses-home',
    lines: [
      { who: 'them', text: 'Feels like summer today. Reminds me of home, you know?', vi: 'Hôm nay như mùa hè. Làm tôi nhớ nhà, bạn hiểu không?' },
      { who: 'you', text: 'You miss the beach in Australia, right?', vi: 'Bạn nhớ biển ở Úc phải không?' },
      { who: 'them', text: "Heaps. Back home I'd be swimming before work.", vi: 'Nhớ lắm. Ở nhà là tôi đi bơi trước giờ làm rồi.' },
      { who: 'you', text: "We don't have a beach, but we've got the lake.", vi: 'Ở đây không có biển, nhưng có hồ.' },
      { who: 'them', text: 'True. I reckon a swim in the lake beats nothing.', vi: 'Đúng. Tôi nghĩ bơi ở hồ vẫn hơn không.' },
      { who: 'you', text: "Let's go on Sunday. I'll bring the snacks.", vi: 'Chủ nhật đi đi. Tôi mang đồ ăn vặt.' },
      { who: 'them', text: "Righto, Sunday arvo at the lake. Can't wait, mate.", vi: 'Được, chiều Chủ nhật ở hồ nhé. Mong lắm rồi.' },
    ],
  },
];
