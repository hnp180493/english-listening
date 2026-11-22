// friend · Mia: courtship, wedding and married life (contract: core/town/romanceTypes.ts Suitor).
// Builds on her arc (data/stories/friend.ts): the first movie night (a comedy, the pizza an hour late, the learner
// picking the film), the haircut, bubble tea, her thirty scarves, killing every plant, Emma's lemon cake, her sister's
// wedding speech and the video call, coming to town knowing nobody. After her yes she says "em" and he says "anh".
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'friend',
  courtedBy: 'male',
  confess: {
    id: 'friend-confess',
    title: 'Bó hoa trước cửa',
    scene: 'Tối muộn, bạn gõ cửa nhà Mia, tay cầm một bó hoa.',
    lines: [
      { who: 'them', en: 'Hey! Did we plan a movie night? I totally forgot.', vi: 'Ơ! Mình có hẹn xem phim à? Mình quên béng mất.' },
      { who: 'you', en: 'No movie tonight. These are for you.', vi: 'Tối nay không xem phim. Hoa này tặng bạn.' },
      { who: 'them', en: 'Flowers? You know I kill everything I touch, right?', vi: 'Hoa á? Bạn biết cây nào qua tay mình cũng chết mà?' },
      { who: 'you', en: "I know. I'll water them. I like you, Mia. A lot.", vi: 'Biết chứ. Mình sẽ tưới. Mình thích bạn, Mia. Thích lắm.' },
      { who: 'you', en: 'Not as a friend. More than that.', vi: 'Không phải kiểu bạn bè. Hơn thế cơ.' },
      { who: 'narr', vi: 'Mia kéo chiếc khăn quàng lên che nửa khuôn mặt.' },
      { who: 'them', en: "Oh my gosh. I've been telling my sister about you for months.", vi: 'Trời ơi. Em kể với chị em về anh mấy tháng nay rồi.' },
      { who: 'them', en: 'So yes. Obviously yes, {name}!', vi: 'Nên là có. Tất nhiên là có rồi, {name}!' },
      { who: 'them', en: "But you're watering these. Every day.", vi: 'Nhưng anh phải tưới hoa đấy. Ngày nào cũng tưới.' },
    ],
  },
  dates: [
    {
      id: 'friend-date-1',
      title: 'Hẹn hò lần đầu: phim hài ở rạp',
      scene: 'Buổi hẹn thật sự đầu tiên, hai người ngồi giữa rạp phim, Zoe vừa chọn giúp một phim hài.',
      lines: [
        { who: 'them', en: 'Zoe says this is the funniest movie of the year.', vi: 'Zoe bảo đây là phim hài hay nhất năm.' },
        { who: 'you', en: 'Better than our first movie night?', vi: 'Hay hơn tối xem phim đầu tiên của mình không?' },
        { who: 'them', en: 'Nothing beats that. The pizza came an hour late!', vi: 'Không gì bằng tối đó. Pizza tới muộn cả tiếng!' },
        { who: 'narr', vi: 'Hai tiếng sau, đèn bật sáng. Mia đang khóc.' },
        { who: 'you', en: 'Mia, are you crying? It was a comedy!', vi: 'Mia, em khóc à? Phim hài mà!' },
        { who: 'them', en: 'The dog found his family! That was so sweet!', vi: 'Con chó tìm được gia đình rồi! Cảm động thế còn gì!' },
        { who: 'them', en: 'Okay, fine. I cry at every movie. Now you know.', vi: 'Thôi được. Phim nào em cũng khóc. Giờ anh biết rồi đấy.' },
        { who: 'you', en: "Good to know. I'll bring tissues next time.", vi: 'Biết thế là tốt. Lần sau anh mang khăn giấy.' },
      ],
    },
    {
      id: 'friend-date-2',
      title: 'Hẹn hò lần hai: đỉnh đồi lộng gió',
      scene: 'Chiều lộng gió, hai người leo lên đỉnh đồi ngắm toàn thị trấn, Mia mang theo hai cái khăn.',
      lines: [
        { who: 'them', en: 'Look, you can see the whole town from here!', vi: 'Nhìn kìa, từ đây thấy cả thị trấn!' },
        { who: 'you', en: "There's your house. And Emma's café.", vi: 'Nhà em kia. Cả quán Emma nữa.' },
        { who: 'them', en: "It's so windy, though. Good thing I brought scarves.", vi: 'Mà gió quá. May mà em mang khăn theo.' },
        { who: 'you', en: 'Of course you did. How many?', vi: 'Tất nhiên rồi. Mấy cái?' },
        { who: 'them', en: 'Just two. One for me, and the pink one for you.', vi: 'Hai thôi. Một cái cho em, còn cái màu hồng cho anh.' },
        { who: 'narr', vi: 'Mặt trời lặn dần sau mặt hồ, hai người ngồi sát lại gần nhau.' },
        { who: 'them', en: 'When I moved here, I came up here alone a lot.', vi: 'Hồi mới chuyển tới, em hay lên đây một mình.' },
        { who: 'them', en: "It's much better with you.", vi: 'Có anh thì vui hơn nhiều.' },
      ],
      choice: {
        after: 4,
        q: 'Mia đưa bạn cái khăn màu hồng. Bạn nói sao?',
        options: [
          {
            id: 'friend-date-2-a',
            en: 'Pink? I love it. Put it on me.',
            vi: 'Hồng à? Thích lắm. Quàng cho anh đi.',
            points: 20,
            reply: [{ who: 'them', en: 'Wow. You look really cute in pink.', vi: 'Chà. Anh quàng màu hồng dễ thương ghê.' }],
          },
          {
            id: 'friend-date-2-b',
            en: 'Can I wear your red one instead?',
            vi: 'Cho anh quàng cái khăn đỏ của em được không?',
            points: 15,
            reply: [{ who: 'them', en: "My red one? Okay. Only because it's you.", vi: 'Khăn đỏ của em á? Được. Vì là anh thôi đấy.' }],
          },
          {
            id: 'friend-date-2-c',
            en: "I'm fine. I don't really get cold.",
            vi: 'Thôi, anh không lạnh đâu.',
            points: 0,
            reply: [{ who: 'them', en: 'Your ears are red, {name}. Just wear it.', vi: 'Tai anh đỏ hết rồi kìa, {name}. Quàng vào đi.' }],
          },
        ],
      },
    },
    {
      id: 'friend-date-3',
      title: 'Hẹn hò lần ba: bài phát biểu ở trạm xe buýt',
      scene: 'Sáng sớm ở trạm xe buýt, Mia cầm tờ giấy viết bài phát biểu, xe của Sam vẫn chưa tới.',
      lines: [
        { who: 'them', en: "Sam's bus is late. Of course it is.", vi: 'Xe của Sam lại muộn. Lúc nào chả thế.' },
        { who: 'you', en: 'Perfect. Read me your speech while we wait.', vi: 'Càng tốt. Đọc bài phát biểu cho anh nghe trong lúc chờ đi.' },
        { who: 'them', en: "Okay. 'My sister taught me how to ride a bike.'", vi: 'Rồi. "Chị tôi đã dạy tôi đi xe đạp."' },
        { who: 'them', en: "'And she taught me that love is worth the wait.'", vi: '"Và chị dạy tôi rằng tình yêu đáng để chờ đợi."' },
        { who: 'you', en: "That's beautiful, Mia. Really.", vi: 'Hay lắm, Mia. Thật đấy.' },
        { who: 'them', en: 'So, um. Will you come to the wedding with me?', vi: 'Thế, ờ. Anh đi đám cưới chị em cùng em nhé?' },
        { who: 'you', en: "I'd love to. Do I have to wear a scarf?", vi: 'Anh rất muốn. Có phải quàng khăn không?' },
        { who: 'them', en: "Obviously. I'll pick one for you.", vi: 'Đương nhiên. Em sẽ chọn cho anh một cái.' },
        { who: 'narr', vi: 'Xe buýt của Sam cuối cùng cũng tới, muộn đúng mười phút.' },
      ],
    },
  ],
  proposal: {
    id: 'friend-proposal',
    title: 'Chiếc khăn thứ ba mươi mốt',
    scene: 'Tối thứ Sáu, lại là đêm xem phim ở nhà Mia, lần này bạn mang theo một hộp quà nhỏ.',
    lines: [
      { who: 'them', en: 'Okay, your turn to pick the movie. No pressure.', vi: 'Rồi, đến lượt anh chọn phim. Không áp lực đâu.' },
      { who: 'you', en: "First, open this. Then we'll pick.", vi: 'Mở cái này trước đã. Rồi mình chọn phim.' },
      { who: 'them', en: "A scarf! Number thirty-one. Wait, there's something inside.", vi: 'Khăn quàng! Cái thứ ba mươi mốt. Khoan, bên trong có gì này.' },
      { who: 'narr', vi: 'Trong nếp khăn là một chiếc nhẫn.' },
      { who: 'you', en: "Mia, you're my favorite person. Will you marry me?", vi: 'Mia, em là người anh thương nhất. Em lấy anh nhé?' },
      { who: 'them', en: "Are you serious? Yes! Yes! I'm already crying!", vi: 'Anh nói thật à? Có! Có chứ! Em khóc rồi đây này!' },
      { who: 'you', en: 'You cry at everything.', vi: 'Cái gì em cũng khóc mà.' },
      { who: 'them', en: 'This one counts more. Now call my sister. Right now!', vi: 'Lần này đáng khóc hơn. Giờ gọi cho chị em đi. Ngay bây giờ!' },
    ],
  },
  vows: {
    id: 'friend-vows',
    title: 'Lời thề ở quảng trường',
    scene: 'Quảng trường giăng đèn dây, Mia mặc váy cưới, quàng thêm một chiếc khăn mỏng.',
    lines: [
      { who: 'them', en: '{name}, I wrote fifty speeches. This one is the shortest.', vi: '{name}, em viết năm mươi bài phát biểu rồi. Bài này ngắn nhất.' },
      { who: 'them', en: 'You make me laugh, and you water my plants. I love you.', vi: 'Anh làm em cười, và anh tưới cây cho em. Em yêu anh.' },
      { who: 'you', en: 'Mia, I promise to pick good movies and always bring tissues.', vi: 'Mia, anh hứa sẽ chọn phim hay, và luôn mang theo khăn giấy.' },
      { who: 'you', en: 'And to love you more every day.', vi: 'Và yêu em nhiều hơn mỗi ngày.' },
      { who: 'narr', vi: 'Chị gái Mia gọi hình từ nước ngoài, khóc còn nhiều hơn cả cô dâu.' },
    ],
  },
  daily: [
    {
      id: 'friend-daily-1',
      title: 'Cái cây còn sống',
      scene: 'Mia đứng bên bậu cửa sổ, chỉ vào một chậu cây nhỏ.',
      lines: [
        { who: 'them', en: "Look! The plant's still alive. Day ten!", vi: 'Nhìn này! Cái cây vẫn sống. Ngày thứ mười rồi!' },
        { who: 'you', en: 'Because I water it.', vi: 'Vì anh tưới nó đấy.' },
        { who: 'them', en: "Teamwork. I'm counting it as mine.", vi: 'Làm việc nhóm mà. Em tính công cho em.' },
      ],
    },
    {
      id: 'friend-daily-2',
      title: 'Tối nay xem gì',
      scene: 'Mia ôm chăn ra sofa, điều khiển ti vi trong tay.',
      lines: [
        { who: 'them', en: 'Movie tonight? Your turn to pick.', vi: 'Tối nay xem phim nhé? Đến lượt anh chọn.' },
        { who: 'you', en: 'A comedy. So you only cry a little.', vi: 'Phim hài. Để em chỉ khóc một chút thôi.' },
        { who: 'them', en: 'No promises.', vi: 'Không hứa trước đâu.' },
      ],
    },
    {
      id: 'friend-daily-3',
      title: 'Pizza lại muộn',
      scene: 'Đã gần chín giờ tối, bụng hai người cùng réo.',
      lines: [
        { who: 'them', en: 'I ordered pizza an hour ago.', vi: 'Em gọi pizza từ một tiếng trước rồi.' },
        { who: 'you', en: 'Some things never change.', vi: 'Có những thứ chẳng bao giờ đổi.' },
        { who: 'them', en: 'Want some cereal while we wait?', vi: 'Ăn tạm ngũ cốc trong lúc chờ nhé?' },
      ],
    },
    {
      id: 'friend-daily-4',
      title: 'Cái khăn xanh',
      scene: 'Mia lục tung tủ quần áo, khăn quàng rơi đầy sàn.',
      lines: [
        { who: 'them', en: '{name}, have you seen my blue scarf?', vi: '{name}, anh có thấy cái khăn xanh của em đâu không?' },
        { who: 'you', en: 'Which one? You have forty now.', vi: 'Cái nào? Giờ em có bốn mươi cái rồi.' },
        { who: 'them', en: 'The blue one with the tiny stars.', vi: 'Cái màu xanh có mấy ngôi sao bé xíu ấy.' },
        { who: 'you', en: "It's on your neck.", vi: 'Nó đang ở trên cổ em đấy.' },
      ],
    },
    {
      id: 'friend-daily-5',
      title: 'Một ngày tệ',
      scene: 'Mia về nhà, thả túi xuống sàn, ngồi phịch xuống ghế.',
      lines: [
        { who: 'them', en: 'Bad day at work. Like, really bad.', vi: 'Hôm nay ở chỗ làm tệ lắm. Tệ thật sự ấy.' },
        { who: 'you', en: 'Big bubble tea?', vi: 'Một ly trà sữa trân châu thật to nhé?' },
        { who: 'them', en: 'The biggest. You know me.', vi: 'To nhất luôn. Anh hiểu em mà.' },
      ],
    },
    {
      id: 'friend-daily-6',
      title: 'Chị gọi',
      scene: 'Điện thoại của Mia đổ chuông, màn hình hiện ảnh chị gái.',
      lines: [
        { who: 'them', en: "My sister's calling. She wants to see you.", vi: 'Chị em gọi này. Chị muốn gặp anh.' },
        { who: 'you', en: 'Me? Again? Okay, hold on. My hair!', vi: 'Anh á? Lại nữa à? Khoan đã. Tóc anh!' },
        { who: 'them', en: "She says hi. And she says you're on mute.", vi: 'Chị chào anh đấy. Mà chị bảo anh đang tắt tiếng kìa.' },
      ],
    },
    {
      id: 'friend-daily-7',
      title: 'Ở nhà thôi',
      scene: 'Tối thứ Bảy, ngoài trời lất phất mưa.',
      lines: [
        { who: 'them', en: 'Can we stay in tonight? Just us?', vi: 'Tối nay mình ở nhà nhé? Chỉ hai đứa mình thôi?' },
        { who: 'you', en: 'Blanket, sofa, and that movie you love?', vi: 'Chăn, sofa, và bộ phim em thích?' },
        { who: 'them', en: 'You know me too well.', vi: 'Anh hiểu em quá rồi đấy.' },
      ],
    },
    {
      id: 'friend-daily-8',
      title: 'Nhà vui nhất phố',
      scene: 'Bà Grace vẫy tay chào qua hàng rào, rồi quay vào nhà.',
      lines: [
        { who: 'them', en: 'Grace says our house is the happiest on the street.', vi: 'Bà Grace bảo nhà mình là nhà vui nhất phố.' },
        { who: 'you', en: "That's because you sing in the shower.", vi: 'Tại em hát trong lúc tắm đấy.' },
        { who: 'them', en: 'Badly. Very badly.', vi: 'Hát dở. Dở lắm luôn.' },
        { who: 'you', en: "That's my favorite part.", vi: 'Đó lại là đoạn anh thích nhất.' },
      ],
    },
  ],
};
