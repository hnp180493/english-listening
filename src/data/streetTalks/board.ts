// board · Tom: street talks (contract: core/town/streetTalkTypes.ts, docs/town.md §14).
import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-board-1',
    placeId: 'board',
    level: 1,
    lines: [
      { who: 'them', text: 'Morning! Have you seen the new notice on the board?', vi: 'Chào buổi sáng! Bạn xem thông báo mới trên bảng tin chưa?' },
      { who: 'you', text: "Not yet. What's it about?", vi: 'Chưa. Về chuyện gì vậy?' },
      { who: 'them', text: "There's a farmers' market on the plaza this Saturday.", vi: 'Thứ Bảy này có phiên chợ nông sản ở quảng trường.' },
      { who: 'you', text: 'Oh, nice. What time does it start?', vi: 'Ồ, hay quá. Mấy giờ bắt đầu?' },
      { who: 'them', text: 'Eight in the morning. Come early for the best fruit.', vi: 'Tám giờ sáng. Đến sớm mới có trái cây ngon nhất.' },
    ],
  },
  {
    id: 'st-board-2',
    placeId: 'board',
    level: 1,
    lines: [
      { who: 'them', text: 'Sorry, do you have a pen I could borrow?', vi: 'Xin lỗi, bạn có bút cho tôi mượn không?' },
      { who: 'you', text: 'Sure, here you go. Did you lose yours?', vi: 'Có đây. Bạn làm mất bút à?' },
      { who: 'them', text: 'It ran out halfway through my list. Typical.', vi: 'Hết mực giữa chừng lúc đang ghi danh sách. Đúng là xui.' },
      { who: 'you', text: "What's the list for, anyway?", vi: 'Mà danh sách gì vậy?' },
      { who: 'them', text: 'Things to fix around town. The park bench is first.', vi: 'Những thứ cần sửa quanh thị trấn. Đầu tiên là cái ghế ở công viên.' },
      { who: 'you', text: "Good luck. Keep the pen, I've got another one.", vi: 'Chúc may mắn. Cứ giữ cây bút, tôi còn cái khác.' },
      { who: 'them', text: 'Thanks a lot. I owe you one.', vi: 'Cảm ơn nhiều. Tôi nợ bạn lần này.' },
    ],
  },
  {
    id: 'st-board-3',
    placeId: 'board',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: 'Be honest. Should I buy another house plant?', vi: 'Nói thật đi. Tôi có nên mua thêm chậu cây không?' },
      { who: 'you', text: 'Why not? What happened to the last one?', vi: 'Sao không? Cây lần trước bị sao?' },
      { who: 'them', text: 'It died. So did the one before that.', vi: 'Chết rồi. Cây trước nữa cũng thế.' },
      { who: 'you', text: "Maybe you're giving them too much water.", vi: 'Có khi bạn tưới nhiều nước quá.' },
      { who: 'them', text: 'Probably. I write everything in my notebook except watering.', vi: 'Chắc vậy. Cái gì tôi cũng ghi vào sổ, trừ việc tưới cây.' },
      { who: 'you', text: 'Then add it to the list. Once a week is enough.', vi: 'Thì ghi vào danh sách đi. Một tuần một lần là đủ.' },
      { who: 'them', text: "Good idea. One more try, then I'm giving up.", vi: 'Ý hay. Thử thêm lần nữa, không được thì tôi bỏ.' },
    ],
  },
  {
    id: 'st-board-4',
    placeId: 'board',
    level: 2,
    fact: 'board:nervous-speaker',
    lines: [
      { who: 'them', text: 'Can I practice my speech on you? Just the start.', vi: 'Tôi tập bài nói với bạn được không? Đoạn đầu thôi.' },
      { who: 'you', text: 'Of course. Is this for the festival?', vi: 'Tất nhiên. Cho lễ hội à?' },
      { who: 'them', text: 'Yeah, I have to open it. My hands are shaking already.', vi: 'Ừ, tôi phải phát biểu khai mạc. Tay run hết cả rồi đây này.' },
      { who: 'you', text: "Just talk to them like you're talking to me.", vi: 'Cứ nói với mọi người như đang nói với tôi.' },
      { who: 'them', text: 'Okay. Good morning, everyone, and welcome to the autumn festival!', vi: 'Được. Chào buổi sáng mọi người, chào mừng tới lễ hội mùa thu!' },
      { who: 'you', text: 'See? That sounded calm and friendly.', vi: 'Thấy chưa? Nghe bình tĩnh và thân thiện lắm.' },
      { who: 'them', text: 'Really? Then I might actually survive this. Thanks.', vi: 'Thật hả? Vậy có khi tôi qua được vụ này. Cảm ơn nhé.' },
    ],
  },
];
