// park · Lily (dog Pip): street talks (contract: core/town/streetTalkTypes.ts, docs/town.md §14).
import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-park-1',
    placeId: 'park',
    level: 1,
    lines: [
      { who: 'them', text: "Hi! Lovely morning, isn't it? I'm walking to work.", vi: 'Chào! Sáng nay đẹp trời nhỉ? Mình đang đi bộ đi làm.' },
      { who: 'you', text: 'It is. Do you always walk to work?', vi: 'Đẹp thật. Bạn lúc nào cũng đi bộ đi làm à?' },
      { who: 'them', text: "When it's sunny, yes. I go the long way, past the lake.", vi: 'Hôm nào nắng thì có. Mình đi đường vòng, qua hồ.' },
      { who: 'you', text: "Lucky you. That's a nice way to start the day.", vi: 'Sướng thật. Bắt đầu ngày như thế thì tuyệt.' },
      { who: 'them', text: "It really helps. Anyway, I'd better go. See you!", vi: 'Đỡ hẳn đấy. Thôi, mình phải đi đây. Gặp lại nhé!' },
    ],
  },
  {
    id: 'st-park-2',
    placeId: 'park',
    level: 1,
    lines: [
      { who: 'them', text: "Excuse me, do you know if the shop's still open?", vi: 'Cho hỏi, bạn biết tiệm tạp hóa còn mở không?' },
      { who: 'you', text: "I think it closes at six. You've got ten minutes.", vi: 'Hình như sáu giờ đóng cửa. Bạn còn mười phút.' },
      { who: 'them', text: "Oh good. I've run out of green tea again.", vi: 'May quá. Mình lại hết trà xanh rồi.' },
      { who: 'you', text: "Better hurry, then. I'll walk with you.", vi: 'Vậy nhanh lên. Mình đi cùng bạn một đoạn.' },
      { who: 'them', text: 'Thanks! Walking with someone always makes it go faster.', vi: 'Cảm ơn! Có người đi cùng lúc nào cũng thấy nhanh hơn.' },
    ],
  },
  {
    id: 'st-park-3',
    placeId: 'park',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: "Can I ask your opinion? It's a bit silly.", vi: 'Mình hỏi ý bạn chút được không? Hơi ngớ ngẩn tí.' },
      { who: 'you', text: "Of course. Go ahead, I'm listening.", vi: 'Tất nhiên. Bạn cứ nói, mình nghe đây.' },
      { who: 'them', text: 'I want to invite my neighbors for tea. Is that weird?', vi: 'Mình muốn mời hàng xóm sang uống trà. Thế có kỳ không?' },
      { who: 'you', text: "Not at all. I think they'd love it.", vi: 'Không hề. Mình nghĩ họ sẽ thích lắm.' },
      { who: 'them', text: "I hope so. I still don't really know anyone here.", vi: 'Mong là vậy. Ở đây mình vẫn chưa quen ai mấy.' },
      { who: 'you', text: "Well, you know me. That's a start.", vi: 'Thì bạn quen mình rồi đấy. Thế là có khởi đầu rồi.' },
      { who: 'them', text: "That's true. You can be my first guest, then.", vi: 'Cũng đúng. Vậy bạn làm vị khách đầu tiên nhé.' },
    ],
  },
  {
    id: 'st-park-4',
    placeId: 'park',
    level: 2,
    fact: 'park:running-club',
    lines: [
      { who: 'them', text: 'Phew! I just finished my run with the club.', vi: 'Phù! Mình vừa chạy xong với câu lạc bộ.' },
      { who: 'you', text: "At six in the morning again? I'm impressed.", vi: 'Lại sáu giờ sáng à? Phục bạn thật.' },
      { who: 'them', text: 'Every single day. Two laps around the lake today.', vi: 'Ngày nào cũng thế. Hôm nay chạy hai vòng quanh hồ.' },
      { who: 'you', text: 'How long did it take you?', vi: 'Bạn chạy mất bao lâu?' },
      { who: 'them', text: 'About thirty minutes. My best time so far!', vi: 'Khoảng ba mươi phút. Kỷ lục của mình đấy!' },
      { who: 'you', text: "Nice one! Maybe I'll join you one day.", vi: 'Giỏi quá! Biết đâu hôm nào mình chạy cùng.' },
      { who: 'them', text: 'Please do. We always have tea by the fountain after.', vi: 'Nhớ nhé. Chạy xong bọn mình hay uống trà cạnh đài phun nước.' },
    ],
  },
];
