// cinema · Zoe: street talks (contract: core/town/streetTalkTypes.ts, docs/town.md §14).
import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-cinema-1',
    placeId: 'cinema',
    level: 1,
    lines: [
      { who: 'them', text: 'Hey! Have you seen the new film at the cinema yet?', vi: 'Này! Bạn xem phim mới ở rạp chưa?' },
      { who: 'you', text: 'Not yet. Is it any good?', vi: 'Chưa. Phim có hay không?' },
      { who: 'them', text: "It's really funny. I laughed the whole way through.", vi: 'Buồn cười lắm. Tôi cười từ đầu đến cuối.' },
      { who: 'you', text: "Then I'll go this weekend. When does it start?", vi: 'Vậy cuối tuần tôi đi. Mấy giờ chiếu?' },
      { who: 'them', text: 'Seven every evening. Get there early for good seats.', vi: 'Bảy giờ tối hằng ngày. Đến sớm để có chỗ đẹp nhé.' },
    ],
  },
  {
    id: 'st-cinema-2',
    placeId: 'cinema',
    level: 1,
    lines: [
      { who: 'them', text: 'Could you hold these for a second? My hands are full.', vi: 'Bạn cầm giúp mấy cái này một chút được không? Tay tôi đầy rồi.' },
      { who: 'you', text: "Sure. Wow, that's a lot of posters.", vi: 'Được chứ. Trời, nhiều áp phích ghê.' },
      { who: 'them', text: "They're for movie night. I'm putting them on the notice board.", vi: 'Cho đêm chiếu phim đấy. Tôi đang đem dán lên bảng tin.' },
      { who: 'you', text: 'Movie night sounds fun. Where is it?', vi: 'Đêm chiếu phim nghe vui đấy. Ở đâu vậy?' },
      { who: 'them', text: 'Outside on the plaza, this Friday. Bring a blanket!', vi: 'Ngoài trời ở quảng trường, thứ Sáu này. Mang theo chăn nhé!' },
    ],
  },
  {
    id: 'st-cinema-3',
    placeId: 'cinema',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: 'Help me choose. Comedy or horror for movie night?', vi: 'Giúp tôi chọn với. Đêm chiếu phim nên chiếu hài hay kinh dị?' },
      { who: 'you', text: 'Comedy, I think. Horror keeps me up all night.', vi: 'Hài đi. Xem kinh dị là tôi thức trắng.' },
      { who: 'them', text: 'Ha, me too, honestly. I watch them with the lights on.', vi: 'Ha, thật ra tôi cũng thế. Tôi xem mà phải bật đèn.' },
      { who: 'you', text: 'Really? I thought you loved every kind of film.', vi: 'Thật á? Tưởng phim gì bạn cũng mê chứ.' },
      { who: 'them', text: 'Almost every kind. Scary ones just stay in my head.', vi: 'Gần như mọi thể loại. Riêng phim ma cứ lởn vởn trong đầu.' },
      { who: 'you', text: 'Then comedy it is. Everyone will leave happy.', vi: 'Vậy chốt phim hài. Ai về cũng vui.' },
      { who: 'them', text: "Perfect. I'll save you a seat at the front.", vi: 'Tuyệt. Tôi giữ cho bạn một chỗ ở hàng đầu nhé.' },
    ],
  },
  {
    id: 'st-cinema-4',
    placeId: 'cinema',
    level: 2,
    fact: 'cinema:makes-films',
    lines: [
      { who: 'them', text: "Shh, just a second. I'm filming the fountain.", vi: 'Suỵt, đợi chút. Tôi đang quay đài phun nước.' },
      { who: 'you', text: 'Sorry! Is this for your short film?', vi: 'Xin lỗi! Cho phim ngắn của bạn à?' },
      { who: 'them', text: 'Yeah. I need one shot of the water at sunset.', vi: 'Ừ. Tôi cần một cảnh mặt nước lúc hoàng hôn.' },
      { who: 'you', text: "It looks beautiful from here. How's the film going?", vi: 'Từ đây nhìn đẹp lắm. Phim tới đâu rồi?' },
      { who: 'them', text: 'Slowly. I keep changing the ending every single week.', vi: 'Chậm lắm. Tuần nào tôi cũng đổi đoạn kết.' },
      { who: 'you', text: 'Maybe the first ending was the right one.', vi: 'Biết đâu đoạn kết đầu tiên mới là đúng.' },
      { who: 'them', text: 'Maybe. You can watch both and tell me, okay?', vi: 'Có thể. Bạn xem cả hai rồi nói tôi nghe nhé?' },
    ],
  },
];
