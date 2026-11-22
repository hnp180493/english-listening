// Leo's street talks (docs/town.md §14): the plaza's caretaker met out in the town. Contract: core/town/streetTalkTypes.ts.

import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-square-1',
    placeId: 'square',
    level: 1,
    lines: [
      { who: 'them', text: "Morning! You're up early today. Where are you off to?", vi: 'Chào buổi sáng! Hôm nay bạn dậy sớm thế. Đi đâu đấy?' },
      { who: 'you', text: 'Just going for a walk by the lake.', vi: 'Chỉ đi dạo quanh hồ thôi.' },
      { who: 'them', text: 'Good idea. The ducks are out on the water this morning.', vi: 'Hay đấy. Sáng nay vịt ra bơi đầy hồ.' },
      { who: 'you', text: "Really? I'll take them some bread.", vi: 'Thật à? Vậy tôi mang ít bánh mì cho chúng.' },
      { who: 'them', text: "Just don't let the big one chase you. Have fun!", vi: 'Có điều đừng để con vịt to đuổi nhé. Đi chơi vui!' },
    ],
  },
  {
    id: 'st-square-2',
    placeId: 'square',
    level: 1,
    lines: [
      { who: 'them', text: "Careful, the ground's wet. I'm cleaning the fountain.", vi: 'Cẩn thận, đất ướt đấy. Tôi đang cọ đài phun nước.' },
      { who: 'you', text: 'It looks great. Do you do this every week?', vi: 'Trông sạch bóng luôn. Tuần nào bạn cũng làm à?' },
      { who: 'them', text: 'Every Monday. People throw coins in, so I collect them too.', vi: 'Thứ Hai nào cũng làm. Người ta ném xu xuống, nên tôi nhặt luôn.' },
      { who: 'you', text: 'What do you do with all the coins?', vi: 'Thế bạn làm gì với chỗ xu đó?' },
      { who: 'them', text: 'They pay for the flowers around the plaza. Nice, right?', vi: 'Dùng để mua hoa trồng quanh quảng trường. Hay nhỉ?' },
    ],
  },
  {
    id: 'st-square-3',
    placeId: 'square',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: "Hey, you've got a good eye. Can I ask you something?", vi: 'Này, bạn có mắt thẩm mỹ. Hỏi bạn chút được không?' },
      { who: 'you', text: "Sure, go ahead. What's on your mind?", vi: 'Được chứ, hỏi đi. Có chuyện gì thế?' },
      { who: 'them', text: "I'm thinking of painting the benches. Yellow or green?", vi: 'Tôi đang tính sơn lại mấy cái ghế dài. Màu vàng hay xanh lá?' },
      { who: 'you', text: "Yellow, definitely. It'd make the whole plaza look happier.", vi: 'Vàng đi, chắc chắn. Cả quảng trường sẽ tươi hẳn lên.' },
      { who: 'them', text: "That's what I thought too. Want to help me on Saturday?", vi: 'Tôi cũng nghĩ thế. Thứ Bảy này phụ tôi một tay không?' },
      { who: 'you', text: "Count me in. I'll wear some old clothes.", vi: 'Tính cả tôi. Tôi sẽ mặc đồ cũ.' },
      { who: 'them', text: "Great! Nine o'clock by the fountain. Don't be late.", vi: 'Tuyệt! Chín giờ ở đài phun nước nhé. Đừng đến muộn.' },
    ],
  },
  {
    id: 'st-square-4',
    placeId: 'square',
    level: 2,
    fact: 'square:sister-baby',
    lines: [
      { who: 'them', text: 'Look, my sister just sent me new photos of the baby.', vi: 'Nhìn này, chị tôi vừa gửi ảnh mới của em bé.' },
      { who: 'you', text: "Oh, she's so tiny! How old is she now?", vi: 'Ôi, bé xíu à! Giờ bé được bao lâu rồi?' },
      { who: 'them', text: "Three weeks tomorrow. And she's already got my nose, poor thing.", vi: 'Mai là tròn ba tuần. Mà bé đã giống cái mũi của tôi rồi, tội nghiệp.' },
      { who: 'you', text: 'Ha! Are you going to visit them soon?', vi: 'Ha! Bạn có sắp lên thăm không?' },
      { who: 'them', text: "I'm driving up this weekend. I can't wait to hold her.", vi: 'Cuối tuần này tôi lái xe lên. Nóng lòng được bế bé quá.' },
      { who: 'you', text: 'Give her a little hug from me.', vi: 'Ôm bé giúp tôi một cái nhé.' },
      { who: 'them', text: "Will do. I'll show you more photos when I'm back.", vi: 'Nhất định rồi. Về tôi lại khoe thêm ảnh cho xem.' },
    ],
  },
];
