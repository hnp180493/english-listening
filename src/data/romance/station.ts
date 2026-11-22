// station · Sam: courtship, wedding and married life (contract: core/town/romanceTypes.ts).
// Builds on his arc (data/stories/station.ts): the late number nine, the last bus at ten fifteen, the rainy walk home
// under his umbrella, bubble tea, his dog Chip, a morning iced latte, ten scarves, books that make him sick on the
// bus, the phone calls he dreads, and his mom's sixtieth birthday ("I told her all about you").
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'station',
  courtedBy: 'female',
  confess: {
    id: 'station-confess',
    title: 'Tỏ tình: nói thẳng, không gọi điện',
    scene: 'Tối muộn ở trạm xe buýt, chuyến cuối vừa chạy, Sam đang khóa quầy vé.',
    lines: [
      { who: 'them', en: "You missed the last bus again? It's ten fifteen, remember?", vi: 'Em lại lỡ chuyến cuối à? Mười giờ mười lăm, nhớ không?' },
      { who: 'you', en: "I didn't come for the bus. I came for you. These are for you.", vi: 'Em đâu có đến để đón xe. Em đến vì anh. Hoa này tặng anh.' },
      { who: 'them', en: 'Flowers? For me? Chip, are you seeing this?', vi: 'Hoa á? Cho anh? Chip ơi, mày có thấy không?' },
      { who: 'you', en: 'Sam, I like you. A lot. I wanted to say it in person.', vi: 'Sam, em thích anh. Rất nhiều. Em muốn nói tận mặt.' },
      { who: 'them', en: "Good. You know I'd never answer a phone call anyway.", vi: 'May đấy. Em biết anh có bao giờ nghe điện thoại đâu.' },
      { who: 'narr', vi: 'Chip sủa một tiếng rồi vẫy đuôi rối rít.' },
      { who: 'them', en: "I like you too. I've liked you since that rainy night.", vi: 'Anh cũng thích em. Từ cái đêm mưa hôm ấy.' },
      { who: 'them', en: "So yes. Let's do this. Wow, my hands are shaking again.", vi: 'Nên là có. Mình thử nhé. Trời, tay anh lại run rồi.' },
    ],
  },
  dates: [
    {
      id: 'station-date-1',
      title: 'Hẹn hò lần đầu: dắt Chip đi dạo',
      scene: 'Chiều thứ Bảy ở công viên, Sam dắt Chip, tay cầm hai ly trà sữa trân châu.',
      lines: [
        { who: 'them', en: 'One bubble tea for you. One for me. Chip gets nothing.', vi: 'Một ly trà sữa cho em. Một ly cho anh. Chip không có phần.' },
        { who: 'you', en: 'Poor Chip. Look at his face.', vi: 'Tội Chip. Nhìn mặt nó kìa.' },
        { who: 'them', en: "Don't fall for it. He had breakfast twice today.", vi: 'Đừng mắc lừa. Sáng nay nó ăn sáng hai lần rồi.' },
        { who: 'you', en: 'Can I throw his ball?', vi: 'Em ném bóng cho nó được không?' },
        { who: 'them', en: 'Sure. Fair warning, he never brings it back.', vi: 'Được. Nói trước nhé, nó chẳng bao giờ mang bóng về.' },
        { who: 'narr', vi: 'Chip lao theo quả bóng, rồi nằm luôn dưới gốc cây, nhất quyết không chịu về.' },
        { who: 'them', en: "You know, Chip doesn't like everyone. He likes you.", vi: 'Em biết không, Chip không quý ai cũng như ai đâu. Nó quý em.' },
        { who: 'you', en: 'Just Chip?', vi: 'Chỉ Chip thôi à?' },
        { who: 'them', en: 'Okay. Not just Chip.', vi: 'Thôi được. Không chỉ Chip.' },
      ],
      choice: {
        after: 5,
        q: 'Chip không chịu mang bóng về. Bạn làm gì?',
        options: [
          {
            id: 'station-date-1-a',
            en: "I'll go get it. Race you, Chip!",
            vi: 'Để em đi lấy. Thi chạy nào, Chip!',
            points: 15,
            reply: [{ who: 'them', en: "Ha! Nobody's ever raced him before.", vi: 'Ha! Chưa ai từng chạy thi với nó.' }],
          },
          {
            id: 'station-date-1-b',
            en: "Let him keep it. He's earned it.",
            vi: 'Cho nó giữ luôn đi. Nó xứng đáng mà.',
            points: 10,
            reply: [{ who: 'them', en: "You're too soft. He's going to love you forever.", vi: 'Em hiền quá. Nó sẽ mê em cả đời cho xem.' }],
          },
          {
            id: 'station-date-1-c',
            en: 'Okay, Sam. Your turn to get it.',
            vi: 'Rồi, Sam. Tới lượt anh đi lấy.',
            points: 5,
            reply: [{ who: 'them', en: 'Me? Fine. This is my life every day.', vi: 'Anh á? Thôi được. Ngày nào đời anh cũng thế này.' }],
          },
        ],
      },
    },
    {
      id: 'station-date-2',
      title: 'Hẹn hò lần hai: đọc truyện chờ xe',
      scene: 'Chủ nhật Sam được nghỉ, hai người ngồi ghế chờ ở trạm, đợi xe số chín ra hồ.',
      lines: [
        { who: 'them', en: "The number nine's late. Of course it is.", vi: 'Xe số chín trễ. Tất nhiên rồi.' },
        { who: 'you', en: 'Good thing I brought a book. Want me to read to you?', vi: 'May mà em mang sách. Em đọc cho anh nghe nhé?' },
        { who: 'them', en: "You know books and buses don't mix for me.", vi: 'Em biết sách với xe cộ không hợp với anh mà.' },
        { who: 'you', en: "We're not on the bus yet. Just listen.", vi: 'Mình đã lên xe đâu. Anh cứ nghe thôi.' },
        { who: 'narr', vi: 'Bạn đọc to vài trang. Sam nghe chăm chú, quên cả xe buýt.' },
        { who: 'them', en: "Wait, don't stop. What happens to the dog?", vi: 'Khoan, đừng dừng. Rồi con chó ra sao?' },
        { who: 'you', en: 'The bus is here, Sam.', vi: 'Xe tới rồi kìa, Sam.' },
        { who: 'them', en: "Let it go. We'll take the next one.", vi: 'Kệ nó. Mình đi chuyến sau.' },
        { who: 'them', en: "My mom used to read to me like this. I'd forgotten.", vi: 'Ngày xưa mẹ anh cũng đọc cho anh nghe như thế. Anh quên mất rồi.' },
      ],
    },
    {
      id: 'station-date-3',
      title: 'Hẹn hò lần ba: bình minh ở bến câu',
      scene: 'Năm giờ sáng ở bến câu cá, gió lạnh, Sam quấn tận hai cái khăn quàng.',
      lines: [
        { who: 'them', en: 'Here. Take this scarf. I brought two, obviously.', vi: 'Đây. Quàng cái khăn này đi. Tất nhiên là anh mang hai cái.' },
        { who: 'you', en: 'Of course you did. How many do you have now?', vi: 'Biết ngay mà. Giờ anh có bao nhiêu cái rồi?' },
        { who: 'them', en: "Twelve. Okay, thirteen. Don't judge me.", vi: 'Mười hai. Thôi được, mười ba. Đừng phán xét anh.' },
        { who: 'you', en: "And you're drinking an iced latte. At five in the morning.", vi: 'Mà anh đang uống latte đá. Lúc năm giờ sáng.' },
        { who: 'them', en: "Every morning. Cold weather, cold coffee. It's a rule.", vi: 'Sáng nào cũng thế. Trời lạnh, cà phê lạnh. Luật rồi.' },
        { who: 'you', en: "Look, the sun's coming up over the water.", vi: 'Nhìn kìa, mặt trời đang lên trên mặt nước.' },
        { who: 'them', en: 'My mom asked about you again, you know.', vi: 'Mẹ anh lại hỏi về em đấy.' },
        { who: 'them', en: 'She wants to meet you. Will you come with me next time?', vi: 'Mẹ muốn gặp em. Lần sau em về cùng anh nhé?' },
        { who: 'you', en: "I'd love that. I'll even call the hotel for you.", vi: 'Em rất muốn. Em còn gọi đặt khách sạn giùm anh luôn.' },
      ],
    },
  ],
  proposal: {
    id: 'station-proposal',
    title: 'Cầu hôn: Chip đưa thư',
    scene: 'Sáng sớm ở trạm xe buýt, Chip chạy tới, trên vòng cổ buộc một chiếc hộp nhỏ.',
    lines: [
      { who: 'them', en: "Chip? What's that on your collar, buddy?", vi: 'Chip? Cái gì trên vòng cổ mày thế?' },
      { who: 'them', en: 'A little box? {name}, did you do this?', vi: 'Một cái hộp nhỏ? {name}, em làm đấy à?' },
      { who: 'you', en: 'Open it, Sam.', vi: 'Mở ra đi, Sam.' },
      { who: 'narr', vi: 'Trong hộp là một chiếc nhẫn.' },
      { who: 'you', en: "Will you marry me? I promise I'll make all the phone calls.", vi: 'Anh cưới em nhé? Em hứa sẽ gọi hết mọi cuộc điện thoại cho anh.' },
      { who: 'them', en: 'All of them? Even the dentist?', vi: 'Tất cả á? Cả gọi nha sĩ?' },
      { who: 'you', en: 'Even the dentist.', vi: 'Cả nha sĩ.' },
      { who: 'them', en: "Then yes. Yes! I'd say yes without the phone calls, too.", vi: 'Vậy thì có. Có! Không có vụ điện thoại anh cũng đồng ý.' },
      { who: 'them', en: 'Chip, you knew about this? You kept a secret!', vi: 'Chip, mày biết trước à? Mày giữ bí mật giỏi thế!' },
    ],
  },
  vows: {
    id: 'station-vows',
    title: 'Lễ cưới ở quảng trường',
    scene: 'Quảng trường trải thảm, Chip đeo nơ ngồi ngay ngắn ở hàng đầu, cạnh mẹ của Sam.',
    lines: [
      { who: 'them', en: "{name}, I'm bad with words. So I'll keep it short.", vi: '{name}, anh vụng nói lắm. Nên anh nói ngắn thôi.' },
      { who: 'them', en: "I'll keep you warm, and I'll always wait for you.", vi: 'Anh sẽ giữ cho em ấm, và anh sẽ luôn chờ em.' },
      { who: 'you', en: 'And I promise I will never miss the last bus home to you.', vi: 'Còn em hứa không bao giờ lỡ chuyến xe cuối về với anh.' },
      { who: 'them', en: 'Ten fifteen. Not ten thirty.', vi: 'Mười giờ mười lăm. Không phải mười giờ rưỡi.' },
      { who: 'you', en: 'Ten fifteen. I wrote it on my hand.', vi: 'Mười giờ mười lăm. Em ghi lên tay rồi.' },
    ],
  },
  daily: [
    {
      id: 'station-daily-1',
      title: 'Xe số chín đến sớm',
      scene: 'Sáu giờ sáng, Sam đã quàng khăn, đứng ở cửa.',
      lines: [
        { who: 'them', en: "Morning. Your coffee's on the table. Chip's been fed.", vi: 'Chào buổi sáng. Cà phê của em trên bàn. Chip ăn rồi.' },
        { who: 'you', en: "You're dressed already? It's six.", vi: 'Anh mặc đồ xong rồi á? Mới sáu giờ.' },
        { who: 'them', en: "The number nine's early today. First time ever.", vi: 'Hôm nay xe số chín đến sớm. Lần đầu tiên trong lịch sử.' },
      ],
    },
    {
      id: 'station-daily-2',
      title: 'Điện thoại reo',
      scene: 'Điện thoại của Sam rung trên bàn, anh nhìn nó như nhìn con nhện.',
      lines: [
        { who: 'you', en: "Your phone's ringing. It's the bank.", vi: 'Điện thoại anh reo kìa. Ngân hàng gọi.' },
        { who: 'them', en: 'Could you maybe answer it?', vi: 'Em nghe giúp anh được không?' },
        { who: 'you', en: "Sam. You're a grown man.", vi: 'Sam. Anh là người lớn rồi đấy.' },
        { who: 'them', en: 'A grown man who hates phone calls. Please?', vi: 'Một người lớn ghét điện thoại. Đi mà?' },
      ],
    },
    {
      id: 'station-daily-3',
      title: 'Thêm một cái khăn',
      scene: 'Sam về nhà, cổ quấn một chiếc khăn bạn chưa thấy bao giờ.',
      lines: [
        { who: 'you', en: 'Is that a new scarf?', vi: 'Khăn mới à?' },
        { who: 'them', en: "It was on sale. It's blue. I didn't have a blue one.", vi: 'Đang giảm giá. Màu xanh. Anh chưa có cái nào màu xanh.' },
        { who: 'you', en: 'You have three blue ones, Sam.', vi: 'Anh có ba cái màu xanh rồi, Sam.' },
      ],
    },
    {
      id: 'station-daily-4',
      title: 'Tin nhắn của mẹ',
      scene: 'Sam chìa điện thoại ra, trên màn hình là tin nhắn của mẹ anh.',
      lines: [
        { who: 'them', en: 'Mom texted. She says hi to you.', vi: 'Mẹ nhắn tin. Mẹ gửi lời chào em.' },
        { who: 'you', en: 'Say hi back. And send her a photo of Chip.', vi: 'Anh chào lại mẹ giúp em. Gửi mẹ tấm ảnh Chip nữa.' },
        { who: 'them', en: 'She likes your photos better than mine.', vi: 'Mẹ thích ảnh em chụp hơn ảnh anh.' },
      ],
    },
    {
      id: 'station-daily-5',
      title: 'Chiếc tất mất tích',
      scene: 'Bạn chỉ tìm thấy một chiếc tất.',
      lines: [
        { who: 'you', en: "Where's my other sock?", vi: 'Chiếc tất kia của em đâu rồi?' },
        { who: 'them', en: 'Look at Chip. Look at his guilty face.', vi: 'Nhìn Chip kìa. Nhìn cái mặt có tội của nó.' },
        { who: 'you', en: 'Chip! Not again.', vi: 'Chip! Lại nữa à.' },
      ],
    },
    {
      id: 'station-daily-6',
      title: 'Đi chung một chiếc ô',
      scene: 'Trời mưa lâm râm, Sam cầm sẵn chiếc ô to đứng chờ.',
      lines: [
        { who: 'them', en: "It's raining. I'll walk you to work.", vi: 'Trời mưa. Anh đưa em đi làm.' },
        { who: 'you', en: "But you'll be late for the station.", vi: 'Nhưng anh sẽ trễ giờ ra bến xe.' },
        { who: 'them', en: "The bus is always late. I'll be fine. It's the best walk of my day.", vi: 'Xe buýt lúc nào chả trễ. Không sao đâu. Đó là quãng đi bộ vui nhất trong ngày của anh.' },
      ],
    },
    {
      id: 'station-daily-7',
      title: 'Thêm một chương',
      scene: 'Tối, Sam nằm sẵn trên sofa, Chip gác đầu lên chân anh.',
      lines: [
        { who: 'you', en: 'Want me to read another chapter tonight?', vi: 'Tối nay em đọc thêm một chương nhé?' },
        { who: 'them', en: "Yes. The dog was in trouble. I couldn't sleep.", vi: 'Có. Con chó đang gặp nguy. Anh không ngủ được.' },
        { who: 'you', en: "It's a dog book, Sam. The dog's going to be fine.", vi: 'Truyện về chó mà, Sam. Con chó sẽ không sao đâu.' },
      ],
    },
    {
      id: 'station-daily-8',
      title: 'Nửa ly trà sữa',
      scene: 'Sam về nhà, tay cầm một ly trà sữa vơi quá nửa.',
      lines: [
        { who: 'them', en: 'I got you a bubble tea.', vi: 'Anh mua trà sữa cho em này.' },
        { who: 'you', en: "There's only half left, Sam.", vi: 'Còn có một nửa thôi mà, Sam.' },
        { who: 'them', en: 'It was a long walk home.', vi: 'Đường về nhà xa lắm.' },
      ],
    },
  ],
};
