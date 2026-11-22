// square · Leo: courtship, wedding and married life (contract: core/town/romanceTypes.ts).
// Builds on his arc (data/stories/square.ts): the newcomer lost on the way to the clinic, the Sunday tour from the
// fountain, Tuesday board games, sunflowers on his mom's balcony, bubble tea for lunch, no spice, his sister's baby
// girl and the comic book, and the night he decided to stay.
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'square',
  courtedBy: 'female',
  confess: {
    id: 'square-confess',
    title: 'Tỏ tình: bó hướng dương',
    scene: 'Chiều tối ở quảng trường, bạn ôm một bó hoa hướng dương đi về phía đài phun nước.',
    lines: [
      { who: 'narr', vi: 'Leo đang ngồi bên đài phun nước, đúng chỗ đêm hôm ấy anh ngồi một mình.' },
      { who: 'you', en: 'Leo, these are for you.', vi: 'Leo, cái này tặng anh.' },
      { who: 'them', en: 'Sunflowers? You remembered!', vi: 'Hoa hướng dương á? Em vẫn nhớ!' },
      { who: 'you', en: "I remember everything you tell me. That's kind of the problem.", vi: 'Anh kể gì em cũng nhớ. Rắc rối là ở chỗ đó.' },
      { who: 'them', en: 'Uh oh. What problem?', vi: 'Ôi chà. Rắc rối gì cơ?' },
      { who: 'you', en: 'I like you, Leo. Like, really like you.', vi: 'Em thích anh, Leo. Kiểu, thích thật sự ấy.' },
      { who: 'them', en: "Wait. Seriously? My heart's going crazy right now.", vi: 'Khoan. Thật à? Tim anh đang đập loạn lên đây này.' },
      { who: 'them', en: "You know you're half the reason I stayed, right?", vi: 'Em biết em là một nửa lý do anh ở lại, đúng không?' },
      { who: 'them', en: 'So yes. Of course yes. Dinner tomorrow? Nothing spicy.', vi: 'Nên là có. Tất nhiên là có. Mai đi ăn tối nhé? Không món nào cay.' },
    ],
  },
  dates: [
    {
      id: 'square-date-1',
      title: 'Hẹn hò lần đầu: tối thứ Ba chơi cờ',
      scene: 'Tối thứ Ba ở quán Emma, Leo bày sẵn một hộp cờ bàn lên chiếc bàn trong góc.',
      lines: [
        { who: 'them', en: "Okay, it's Tuesday. You know what that means.", vi: 'Rồi, hôm nay thứ Ba. Em biết thế nghĩa là gì mà.' },
        { who: 'you', en: "Board games. I told you I'm terrible, remember?", vi: 'Chơi cờ. Em nói rồi, em chơi dở tệ, nhớ không?' },
        { who: 'them', en: "That's why I picked an easy one. Roll the dice.", vi: 'Thế nên anh chọn trò dễ thôi. Gieo xúc xắc đi.' },
        { who: 'you', en: 'Six! Wait, does that mean I win?', vi: 'Sáu! Khoan, vậy là em thắng à?' },
        { who: 'them', en: 'Not yet. Hang on. Okay, yes. You win. How?', vi: 'Chưa đâu. Đợi đã. Ờ, đúng. Em thắng. Sao lại thế được?' },
        { who: 'them', en: "Emma, two bubble teas, please! The loser's paying.", vi: 'Emma ơi, hai ly trà sữa nhé! Người thua trả tiền.' },
        { who: 'you', en: 'You really love bubble tea, huh?', vi: 'Anh mê trà sữa thật đấy nhỉ?' },
        { who: 'them', en: 'I love Tuesdays more now. Because of you.', vi: 'Giờ anh còn mê thứ Ba hơn. Vì có em.' },
      ],
      choice: {
        after: 4,
        q: 'Thắng ván đầu, bạn nói gì?',
        options: [
          {
            id: 'square-date-1-a',
            en: "Beginner's luck. Best of three?",
            vi: 'Ăn may thôi. Chơi ba ván thắng hai nhé?',
            points: 15,
            reply: [{ who: 'them', en: "Oh, you're on. I'm not losing twice.", vi: 'Chơi luôn. Anh không thua hai lần đâu.' }],
          },
          {
            id: 'square-date-1-b',
            en: 'Did you let me win, Leo?',
            vi: 'Anh nhường em đấy à, Leo?',
            points: 15,
            reply: [{ who: 'them', en: 'Me? Never. Okay, maybe a little.', vi: 'Anh á? Không bao giờ. Ờ, chắc là một chút.' }],
          },
          {
            id: 'square-date-1-c',
            en: 'I told you I was terrible. I lied.',
            vi: 'Em bảo em chơi dở. Em nói dối đấy.',
            points: 10,
            reply: [{ who: 'them', en: "Wow. I'm dating a professional.", vi: 'Trời. Hóa ra anh đang hẹn hò với dân chuyên.' }],
          },
        ],
      },
    },
    {
      id: 'square-date-2',
      title: 'Hẹn hò lần hai: em làm hướng dẫn viên',
      scene: 'Mười giờ sáng Chủ nhật, lần này bạn đứng chờ Leo cạnh đài phun nước.',
      lines: [
        { who: 'you', en: "Morning! Ready for the grand tour? I'm the guide today.", vi: 'Chào buổi sáng! Sẵn sàng đi tham quan chưa? Hôm nay em làm hướng dẫn viên.' },
        { who: 'them', en: 'Ha! Okay, guide. Where do we start?', vi: 'Ha! Được, cô hướng dẫn viên. Mình bắt đầu từ đâu?' },
        { who: 'you', en: "Right here. This fountain's older than anything in town.", vi: 'Ngay đây. Đài phun nước này lâu đời hơn mọi thứ trong thị trấn.' },
        { who: 'them', en: "Hey, that's my line! You were listening.", vi: 'Ê, câu đó của anh mà! Hóa ra em nghe kỹ thế.' },
        { who: 'you', en: 'And over there is the clinic. Very easy to find.', vi: 'Còn đằng kia là phòng khám. Rất dễ tìm.' },
        { who: 'them', en: 'Very easy. Says the girl who got lost on day one.', vi: 'Rất dễ tìm. Nói bởi cô gái lạc đường ngay tuần đầu.' },
        { who: 'narr', vi: 'Đi hết một vòng thị trấn, hai người trải khăn ngồi ăn trưa trong công viên.' },
        { who: 'them', en: 'You know, my mom would love you.', vi: 'Em biết không, mẹ anh mà gặp em chắc quý lắm.' },
        { who: 'you', en: "Then let's visit her someday. With sunflowers.", vi: 'Vậy hôm nào mình về thăm mẹ nhé. Mang theo hoa hướng dương.' },
      ],
    },
    {
      id: 'square-date-3',
      title: 'Hẹn hò lần ba: phim siêu anh hùng',
      scene: 'Suất chiếu tối ở rạp của Zoe, Leo ôm một túi bỏng ngô to tướng.',
      lines: [
        { who: 'them', en: 'Two tickets for the superhero movie. I read the comic ten times.', vi: 'Hai vé phim siêu anh hùng. Truyện tranh gốc anh đọc mười lần rồi.' },
        { who: 'you', en: 'Ten times? Then no spoilers, okay?', vi: 'Mười lần á? Vậy cấm kể trước nhé?' },
        { who: 'them', en: "My lips are sealed. Popcorn? It's not the spicy kind, I checked.", vi: 'Anh im như thóc. Ăn bỏng ngô không? Không phải loại cay đâu, anh xem kỹ rồi.' },
        { who: 'narr', vi: 'Gần cuối phim, bạn nghe tiếng sụt sịt ngay bên cạnh.' },
        { who: 'you', en: 'Leo, are you crying?', vi: 'Leo, anh khóc đấy à?' },
        { who: 'them', en: 'No. Maybe. The dog saved everyone, okay?', vi: 'Không. Có lẽ. Con chó cứu cả thế giới mà, được chưa?' },
        { who: 'you', en: "You big softie. That's my favorite thing about you.", vi: 'Đồ yếu lòng. Đó là điểm em thích nhất ở anh đấy.' },
        { who: 'them', en: "Just don't tell Zoe. She'll never let me forget it.", vi: 'Đừng kể với Zoe nhé. Cô ấy sẽ trêu anh cả đời.' },
      ],
    },
  ],
  proposal: {
    id: 'square-proposal',
    title: 'Cầu hôn bên đài phun nước',
    scene: 'Đêm khuya, quảng trường vắng, chỉ còn tiếng nước chảy và một chiếc hộp nhỏ trong túi bạn.',
    lines: [
      { who: 'them', en: 'Hey. You asked me to meet you here. Everything okay?', vi: 'Này. Em hẹn anh ra đây. Có chuyện gì không?' },
      { who: 'you', en: 'Everything is great. Remember the night you almost left?', vi: 'Mọi thứ đều ổn. Anh nhớ cái đêm anh suýt bỏ đi không?' },
      { who: 'them', en: "Of course. I sat right here and couldn't sleep.", vi: 'Nhớ chứ. Anh ngồi ngay đây, không ngủ được.' },
      { who: 'you', en: "I couldn't sleep either. I was scared you'd go.", vi: 'Em cũng không ngủ được. Em sợ anh đi mất.' },
      { who: 'narr', vi: 'Bạn quỳ xuống bên đài phun nước và mở chiếc hộp nhỏ.' },
      { who: 'you', en: 'Leo, will you marry me?', vi: 'Leo, anh cưới em nhé?' },
      { who: 'them', en: "Wait. Wait! I was going to ask you. That's my line!", vi: 'Khoan. Khoan đã! Anh định hỏi em cơ mà. Câu đó của anh!' },
      { who: 'them', en: "Yes! Yes, of course. I'm calling my sister right now.", vi: 'Có! Có chứ, tất nhiên rồi. Anh gọi cho chị anh ngay đây.' },
      { who: 'you', en: "Leo, it's midnight. Call her tomorrow.", vi: 'Leo, nửa đêm rồi. Mai hẵng gọi.' },
    ],
  },
  vows: {
    id: 'square-vows',
    title: 'Lễ cưới ở quảng trường',
    scene: 'Quảng trường treo đầy đèn lồng và hoa hướng dương, cả thị trấn đều có mặt.',
    lines: [
      { who: 'narr', vi: 'Chị gái Leo bế bé con ngồi hàng đầu, Emma lo bánh, Tom cầm micro.' },
      { who: 'them', en: '{name}, the day you got lost, I found my favorite person.', vi: '{name}, cái ngày em lạc đường, anh tìm thấy người anh thương nhất.' },
      { who: 'you', en: "Leo, you showed me every street. Now let's walk them together.", vi: 'Leo, anh chỉ cho em từng con phố. Giờ mình cùng nhau đi hết nhé.' },
      { who: 'them', en: "I promise to always stay. And I'll never buy spicy noodles.", vi: 'Anh hứa sẽ luôn ở lại. Và không bao giờ mua mì cay.' },
      { who: 'you', en: 'And I promise to lose at board games. Sometimes.', vi: 'Còn em hứa sẽ thua cờ. Thỉnh thoảng thôi.' },
    ],
  },
  daily: [
    {
      id: 'square-daily-1',
      title: 'Bữa sáng kiểu Leo',
      scene: 'Sáng sớm, trên bàn bếp chỉ có hai ly trà sữa.',
      lines: [
        { who: 'them', en: 'Morning! I made breakfast.', vi: 'Chào buổi sáng! Anh làm bữa sáng rồi đây.' },
        { who: 'you', en: "Leo, bubble tea isn't breakfast.", vi: 'Leo, trà sữa đâu phải bữa sáng.' },
        { who: 'them', en: "It's got milk in it. That's basically cereal.", vi: 'Có sữa mà. Coi như ngũ cốc rồi còn gì.' },
        { who: 'you', en: "Sit down. I'm making eggs.", vi: 'Ngồi xuống đi. Em đi rán trứng.' },
      ],
    },
    {
      id: 'square-daily-2',
      title: 'Ảnh của cháu',
      scene: 'Leo chìa điện thoại cho bạn xem, mặt tươi rói.',
      lines: [
        { who: 'them', en: 'My sister just sent a photo. Look at her!', vi: 'Chị anh vừa gửi ảnh. Nhìn bé con này!' },
        { who: 'you', en: "She's so big now! Is that your comic book?", vi: 'Bé lớn quá rồi! Có phải cuốn truyện tranh của anh không?' },
        { who: 'them', en: 'She chewed the cover. She has great taste.', vi: 'Bé gặm cả bìa luôn. Gu của bé chuẩn thật.' },
      ],
    },
    {
      id: 'square-daily-3',
      title: 'Phục thù thứ Ba',
      scene: 'Leo đặt hộp cờ lên bàn từ lúc trời còn sáng.',
      lines: [
        { who: 'them', en: "It's Tuesday. Rematch tonight?", vi: 'Hôm nay thứ Ba. Tối nay phục thù nhé?' },
        { who: 'you', en: 'Only if you stop reading the rules out loud.', vi: 'Được, nếu anh thôi đọc to luật chơi.' },
        { who: 'them', en: 'No promises. Loser does the dishes.', vi: 'Không hứa đâu. Ai thua thì rửa bát.' },
      ],
    },
    {
      id: 'square-daily-4',
      title: 'Ban công hướng dương',
      scene: 'Leo đứng ngoài ban công, tay còn dính đất.',
      lines: [
        { who: 'them', en: 'I planted sunflowers on our balcony. Just like Mom.', vi: 'Anh trồng hướng dương ngoài ban công nhà mình. Y như mẹ ngày xưa.' },
        { who: 'you', en: "They'll be beautiful. How long till they bloom?", vi: 'Sẽ đẹp lắm đây. Bao lâu nữa thì nở hả anh?' },
        { who: 'them', en: "A couple of months. I'll be patient. Probably.", vi: 'Vài tháng nữa. Anh sẽ kiên nhẫn. Chắc vậy.' },
      ],
    },
    {
      id: 'square-daily-5',
      title: 'Ướt như chuột lột',
      scene: 'Ngoài trời mưa to, cửa mở, Leo bước vào ướt sũng.',
      lines: [
        { who: 'them', en: "I'm home! Sorry, I'm soaking wet.", vi: 'Anh về rồi! Xin lỗi, anh ướt hết rồi.' },
        { who: 'you', en: 'Did you forget your umbrella again?', vi: 'Anh lại quên ô à?' },
        { who: 'them', en: 'I gave it to Grace. She needed it more.', vi: 'Anh đưa cho bà Grace rồi. Bà cần hơn anh.' },
        { who: 'you', en: "That's why I married you. The towel's on the chair.", vi: 'Thế nên em mới lấy anh. Khăn tắm trên ghế đấy.' },
      ],
    },
    {
      id: 'square-daily-6',
      title: 'Chìa khóa đâu rồi',
      scene: 'Bạn lục tung túi xách lần thứ ba.',
      lines: [
        { who: 'you', en: 'Have you seen my keys?', vi: 'Anh có thấy chìa khóa của em đâu không?' },
        { who: 'them', en: 'Kitchen table, next to the fruit.', vi: 'Trên bàn bếp, cạnh đĩa trái cây.' },
        { who: 'you', en: 'How do you always know where everything is?', vi: 'Sao lúc nào anh cũng biết đồ đạc ở đâu thế?' },
        { who: 'them', en: 'I know this town by heart. And this house too.', vi: 'Anh thuộc lòng thị trấn này. Cả ngôi nhà này nữa.' },
      ],
    },
    {
      id: 'square-daily-7',
      title: 'Một ngày dài ở quảng trường',
      scene: 'Leo ngồi phịch xuống ghế, giày còn ướt nước.',
      lines: [
        { who: 'them', en: 'Long day. Three kids fell in the fountain.', vi: 'Ngày dài ghê. Ba đứa nhỏ rơi xuống đài phun nước.' },
        { who: 'you', en: 'Again? Are they okay?', vi: 'Lại thế à? Bọn trẻ có sao không?' },
        { who: 'them', en: "They're fine. I'm the one who needs a nap.", vi: 'Tụi nhỏ không sao. Người cần ngủ một giấc là anh đây.' },
      ],
    },
    {
      id: 'square-daily-8',
      title: 'Một vòng trước khi ngủ',
      scene: 'Tối muộn, Leo đã cầm sẵn áo khoác của bạn.',
      lines: [
        { who: 'them', en: 'Walk to the fountain before bed?', vi: 'Đi bộ ra đài phun nước trước khi ngủ nhé?' },
        { who: 'you', en: 'Sure. Just one lap.', vi: 'Được. Một vòng thôi đấy.' },
        { who: 'them', en: 'One lap. And maybe a bubble tea on the way.', vi: 'Một vòng. Với lại tiện đường mua ly trà sữa.' },
        { who: 'you', en: 'Leo.', vi: 'Leo à.' },
      ],
    },
  ],
};
