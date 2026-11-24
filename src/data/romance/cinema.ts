// cinema · Zoe: courtship, wedding and married life (contract: core/town/romanceTypes.ts Suitor).
// Zoe is seeing Max in her own story (data/stories/cinema.ts, phone.ts). Owner, 2026-11-24: Zoe can leave her
// boyfriend for the learner's character ("stardew valley cũng có thể tán tỉnh nhiều người mà"), with some drama ("tán
// zoe sẽ drama một tí nha"): Max walks in on the confession, the town talks, Max comes to the pier on the second date,
// and on the third he brings popcorn: no hard feelings. Builds on her arc: the short films she
// makes on her phone, the shy girl in the comic book, her roses allergy, Tom's posters, Max fixing her screen. After
// her yes she says "em" and he says "anh".
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'cinema',
  courtedBy: 'male',
  confess: {
    id: 'cinema-confess',
    title: 'Bó hoa ở sảnh rạp',
    scene: 'Rạp đã tắt đèn sảnh, Zoe đang quét bỏng ngô, bạn đứng ở cửa với một bó hoa cúc. Tối nay Max hẹn qua đón cô.',
    lines: [
      { who: 'them', en: "We're closed, {name}. And Max is picking me up soon.", vi: 'Rạp đóng cửa rồi, {name}. Mà Max sắp qua đón tôi đấy.' },
      { who: 'you', en: "I know. I just need one minute. These are for you. Daisies, no roses.", vi: 'Tôi biết. Tôi chỉ cần một phút. Hoa này tặng bạn. Hoa cúc, không phải hoa hồng.' },
      { who: 'you', en: "I like you, Zoe. I tried to stop. I can't.", vi: 'Tôi thích bạn, Zoe. Tôi đã cố thôi. Nhưng không được.' },
      { who: 'them', en: "Don't. Please don't say that. Not now.", vi: 'Đừng. Làm ơn đừng nói thế. Không phải lúc này.' },
      { who: 'them', en: "Because I feel the same. And I've hated myself for it all week.", vi: 'Vì tôi cũng thế. Và cả tuần nay tôi ghét bản thân vì điều đó.' },
      { who: 'narr', vi: 'Cửa sảnh bật mở. Max đứng đó, tay cầm hai cốc trà sữa, mắt nhìn bó hoa. Anh đặt hai cốc xuống quầy rồi quay đi, không nói một lời.' },
      { who: 'them', en: 'Max! Max, wait!', vi: 'Max! Max, đợi đã!' },
      { who: 'them', en: "My answer is yes, {name}. But I'm so sorry it happened like this.", vi: 'Câu trả lời của em là có, {name}. Nhưng em xin lỗi vì mọi chuyện lại thành ra thế này.' },
      { who: 'them', en: 'I owe him the truth. From me, not from a bunch of flowers.', vi: 'Em nợ anh ấy sự thật. Từ chính miệng em, chứ không phải từ một bó hoa.' },
    ],
    choice: {
      after: 6,
      q: 'Max bỏ đi, Zoe đứng chết lặng. Bạn nói gì?',
      options: [
        {
          id: 'cinema-confess-a',
          en: "Go after him. He deserves that. I'll be here.",
          vi: 'Chạy theo anh ấy đi. Anh ấy xứng đáng được thế. Tôi sẽ ở đây.',
          points: 20,
          reply: [{ who: 'them', en: "Thank you. You're a good person, you know that?", vi: 'Cảm ơn bạn. Bạn biết bạn là người tốt không?' }],
        },
        {
          id: 'cinema-confess-b',
          en: "I'm sorry, Zoe. I never wanted him to find out like this.",
          vi: 'Tôi xin lỗi, Zoe. Tôi chưa bao giờ muốn anh ấy biết theo cách này.',
          points: 10,
          reply: [{ who: 'them', en: "Me neither. But it's done now.", vi: 'Tôi cũng vậy. Nhưng chuyện đã rồi.' }],
        },
        {
          id: 'cinema-confess-c',
          en: 'Let him go. Stay here with me.',
          vi: 'Kệ anh ấy đi. Ở lại đây với tôi.',
          points: -10,
          reply: [{ who: 'them', en: "No! He's not a door you just close. He was good to me.", vi: 'Không! Anh ấy đâu phải cánh cửa muốn đóng là đóng. Anh ấy từng tốt với tôi.' }],
        },
      ],
    },
  },
  dates: [
    {
      id: 'cinema-date-1',
      title: 'Hẹn hò lần đầu: cả thị trấn đã biết',
      scene: 'Sáng hôm sau ở công viên. Tờ giấy ai đó dán lên bảng tin đã bị xé, nhưng cả thị trấn vẫn đang xì xào.',
      lines: [
        { who: 'them', en: "I didn't sleep. I talked to Max until three in the morning.", vi: 'Em không ngủ được. Em nói chuyện với Max đến ba giờ sáng.' },
        { who: 'you', en: 'How is he?', vi: 'Anh ấy sao rồi?' },
        { who: 'them', en: "He said, 'You could have just told me.' And he's right.", vi: 'Anh ấy nói: "Em cứ nói thẳng với anh là được mà." Và anh ấy nói đúng.' },
        { who: 'them', en: "Now everyone knows. Emma gave me a look this morning. Ben stopped talking when I walked in.", vi: 'Giờ ai cũng biết rồi. Sáng nay Emma nhìn em một cái. Ben đang nói thì im bặt khi em bước vào.' },
        { who: 'narr', vi: 'Zoe cúi mặt, hai tay siết chặt cốc cà phê đã nguội.' },
        { who: 'them', en: "I feel like the villain in my own film.", vi: 'Em thấy mình như kẻ xấu trong chính bộ phim của mình.' },
        { who: 'you', en: "You told the truth, even when it hurt. Villains don't do that.", vi: 'Em đã nói thật, kể cả khi nó làm đau. Kẻ xấu không làm thế đâu.' },
        { who: 'them', en: 'Stay with me today? I just need to sit here. With you.', vi: 'Hôm nay ở bên em nhé? Em chỉ cần ngồi đây thôi. Với anh.' },
        { who: 'you', en: "All day. As long as you need.", vi: 'Cả ngày. Bao lâu cũng được.' },
      ],
    },
    {
      id: 'cinema-date-2',
      title: 'Hẹn hò lần hai: Max ở cầu câu',
      scene: 'Chiều tà ở cầu câu, Zoe đang dựng máy quay thì Max đi tới, tay cầm cái chân máy cô để quên ở tiệm.',
      lines: [
        { who: 'narr', vi: 'Max đặt cái chân máy xuống ván cầu. Anh nhìn bạn một lúc lâu.' },
        { who: 'them', en: 'Max. Thank you for bringing it. You didn\'t have to.', vi: 'Max. Cảm ơn anh đã mang qua. Anh không cần phải làm thế.' },
        { who: 'them', en: "He says he's not angry anymore. He's just tired.", vi: 'Anh ấy bảo không còn giận nữa. Chỉ thấy mệt thôi.' },
        { who: 'narr', vi: 'Gió thổi mạnh. Không ai nói gì. Chiếc phao trên mặt hồ khẽ chìm xuống.' },
        { who: 'them', en: "He says the screen I cracked last week is fixed. It's in the bag.", vi: 'Anh ấy bảo cái màn hình em làm vỡ tuần trước sửa xong rồi. Để trong túi.' },
        { who: 'narr', vi: 'Max gật đầu với Zoe, rồi quay lưng đi về phía thị trấn.' },
        { who: 'them', en: "I hurt a really good guy. I'll have to live with that.", vi: 'Em đã làm tổn thương một người rất tốt. Em sẽ phải sống với điều đó.' },
        { who: 'them', en: 'But I chose you. And I would choose you again.', vi: 'Nhưng em đã chọn anh. Và em sẽ lại chọn anh lần nữa.' },
      ],
      choice: {
        after: 3,
        q: 'Max đứng đó nhìn bạn. Bạn nói gì với anh ấy?',
        options: [
          {
            id: 'cinema-date-2-a',
            en: "Max, I'm sorry. It wasn't fair to you, and I know it.",
            vi: 'Max, tôi xin lỗi. Như thế là không công bằng với anh, tôi biết.',
            points: 20,
            reply: [{ who: 'them', en: 'He nodded. That means a lot from Max.', vi: 'Anh ấy gật đầu kìa. Với Max thế là nhiều lắm rồi.' }],
          },
          {
            id: 'cinema-date-2-b',
            en: '(You say nothing and take Zoe\'s hand.)',
            vi: '(Bạn im lặng, nắm lấy tay Zoe.)',
            points: 10,
            reply: [{ who: 'them', en: "Okay. Okay. I'm alright.", vi: 'Được rồi. Được rồi. Em ổn mà.' }],
          },
          {
            id: 'cinema-date-2-c',
            en: 'This is between me and Zoe now, mate.',
            vi: 'Giờ đây là chuyện của tôi với Zoe rồi, anh bạn.',
            points: -10,
            reply: [{ who: 'them', en: "Don't. Don't talk to him like that. Please.", vi: 'Đừng. Đừng nói với anh ấy kiểu đó. Em xin anh.' }],
          },
        ],
      },
    },
    {
      id: 'cinema-date-3',
      title: 'Hẹn hò lần ba: bỏng ngô của Max',
      scene: 'Nửa đêm, rạp vắng tanh, Zoe chiếu bộ phim cũ cô thích nhất lên màn hình lớn cho riêng hai người.',
      lines: [
        { who: 'them', en: 'This is the film I watched a hundred times as a kid.', vi: 'Đây là phim em xem cả trăm lần hồi nhỏ.' },
        { who: 'you', en: 'The shy girl in the comic book. That was you, right?', vi: 'Cô bé nhút nhát trong cuốn truyện tranh. Là em, đúng không?' },
        { who: 'them', en: 'Yeah. Films were my only friends back then.', vi: 'Ừ. Hồi đó phim là những người bạn duy nhất của em.' },
        { who: 'narr', vi: 'Có tiếng gõ cửa sảnh. Max thò đầu vào, giơ một túi bỏng ngô to.' },
        { who: 'them', en: "Max? He says the popcorn's on him. No hard feelings.", vi: 'Max à? Anh ấy bảo bỏng ngô anh ấy mời. Không giận gì nữa.' },
        { who: 'them', en: "And he says if you ever make me cry, he'll fix your phone so it only plays country music.", vi: 'Còn bảo nếu anh mà làm em khóc, anh ấy sẽ sửa điện thoại anh để nó chỉ phát nhạc đồng quê.' },
        { who: 'you', en: "Tell him I'll look after you. That's a promise.", vi: 'Nói với anh ấy là anh sẽ chăm sóc em. Anh hứa.' },
        { who: 'narr', vi: 'Max cười, vẫy tay rồi khép cửa. Zoe lau vội khóe mắt.' },
        { who: 'them', en: "Okay. Now I'm crying anyway. Shh. My favorite scene.", vi: 'Rồi. Đằng nào em cũng khóc rồi. Suỵt. Cảnh em thích nhất đấy.' },
      ],
    },
  ],
  proposal: {
    id: 'cinema-proposal',
    title: 'Phim ngắn của anh',
    scene: 'Bạn nhờ Zoe xem thử một phim ngắn bạn tự quay bằng điện thoại, chiếu trên màn hình lớn của rạp.',
    lines: [
      { who: 'them', en: 'You made a film? You? Okay, I need to see this.', vi: 'Anh làm phim á? Anh á? Rồi, em phải xem cái này.' },
      { who: 'narr', vi: 'Trên màn hình là cầu câu, quầy vé, chiếc ghế đá trong công viên: những chỗ hai người từng hẹn.' },
      { who: 'them', en: 'The shots are shaky. And the light is all wrong. I love it.', vi: 'Khung hình rung. Ánh sáng sai hết. Em thích lắm.' },
      { who: 'narr', vi: 'Cảnh cuối: một dòng chữ trắng trên nền đen, rồi đèn bật sáng.' },
      { who: 'you', en: 'Zoe, every film I want to watch has you in it. Will you marry me?', vi: 'Zoe, bộ phim nào anh muốn xem cũng có em trong đó. Em lấy anh nhé?' },
      { who: 'them', en: "Oh my gosh. That's the best ending I've ever seen.", vi: 'Trời ơi. Đó là cái kết hay nhất em từng xem.' },
      { who: 'them', en: 'Yes! Yes, {name}! A thousand times yes!', vi: 'Có! Em đồng ý, {name}! Đồng ý cả nghìn lần!' },
      { who: 'them', en: "But I'm re-editing this. The music is way too loud.", vi: 'Nhưng em sẽ dựng lại phim này. Nhạc to quá trời.' },
    ],
  },
  vows: {
    id: 'cinema-vows',
    title: 'Lời thề ở quảng trường',
    scene: 'Quảng trường giăng đèn, Leo đứng làm chủ hôn, Max cầm máy quay ở hàng ghế sau.',
    lines: [
      { who: 'them', en: "{name}, I used to watch love stories alone. Now I'm in one.", vi: '{name}, ngày xưa em toàn xem chuyện tình một mình. Giờ em ở trong một chuyện tình.' },
      { who: 'them', en: 'I promise to love you, even when you talk during the movie.', vi: 'Em hứa sẽ yêu anh, kể cả khi anh nói chuyện lúc đang chiếu phim.' },
      { who: 'you', en: 'Zoe, I promise to hold the lights for every film you make.', vi: 'Zoe, anh hứa sẽ cầm đèn cho mọi bộ phim em làm.' },
      { who: 'narr', vi: 'Leo tuyên bố hai người là vợ chồng. Max giơ ngón cái, máy quay vẫn chạy.' },
      { who: 'them', en: "That's a wrap! Everybody, popcorn's on the house!", vi: 'Xong cảnh! Cả nhà ơi, bỏng ngô rạp mời!' },
    ],
  },
  daily: [
    {
      id: 'cinema-daily-1',
      title: 'Dựng phim lúc nửa đêm',
      scene: 'Hai giờ sáng, màn hình máy tính vẫn sáng, Zoe ngồi ôm gối dựng phim.',
      lines: [
        { who: 'you', en: "It's two in the morning. Come to bed.", vi: 'Hai giờ sáng rồi. Đi ngủ thôi em.' },
        { who: 'them', en: 'Five more minutes. This cut is almost perfect.', vi: 'Năm phút nữa thôi. Đoạn cắt này sắp hoàn hảo rồi.' },
        { who: 'you', en: 'You said that an hour ago.', vi: 'Em nói câu đó từ một tiếng trước rồi.' },
      ],
    },
    {
      id: 'cinema-daily-2',
      title: 'Bữa sáng lên phim',
      scene: 'Bạn vừa bưng đĩa trứng ra bàn thì thấy Zoe giơ điện thoại lên quay.',
      lines: [
        { who: 'them', en: "Don't move! The light on those eggs is beautiful.", vi: 'Đứng yên! Ánh sáng trên đĩa trứng đẹp quá.' },
        { who: 'you', en: 'Can I eat my breakfast now, director?', vi: 'Giờ anh ăn sáng được chưa, đạo diễn?' },
        { who: 'them', en: 'One more angle. Okay, now you can eat.', vi: 'Thêm một góc nữa. Rồi, giờ ăn được rồi.' },
      ],
    },
    {
      id: 'cinema-daily-3',
      title: 'Phim đen trắng ba tiếng',
      scene: 'Tối thứ Sáu, Zoe đã chọn phim: một phim đen trắng dài ba tiếng.',
      lines: [
        { who: 'them', en: "Tonight's movie is a classic. Only three hours long.", vi: 'Phim tối nay là kinh điển. Chỉ dài có ba tiếng thôi.' },
        { who: 'you', en: 'Only three hours? Can I pick the snacks at least?', vi: 'Chỉ ba tiếng thôi á? Ít ra anh được chọn đồ ăn vặt chứ?' },
        { who: 'them', en: 'Deal. But no crunchy chips during the sad part.', vi: 'Chốt. Nhưng không ăn khoai tây giòn lúc đến đoạn buồn đâu nhé.' },
      ],
    },
    {
      id: 'cinema-daily-4',
      title: 'Bài phát biểu nhận giải',
      scene: 'Zoe đứng trước gương, cầm chai dầu gội như cầm một chiếc cúp.',
      lines: [
        { who: 'them', en: "I'd like to thank my husband, who held the lights.", vi: 'Em xin cảm ơn chồng em, người đã cầm đèn.' },
        { who: 'you', en: 'Are you practicing an award speech again?', vi: 'Em lại tập bài phát biểu nhận giải đấy à?' },
        { who: 'them', en: "A girl has to be ready. Now clap, please.", vi: 'Con gái phải luôn sẵn sàng chứ. Giờ vỗ tay đi anh.' },
        { who: 'you', en: 'Bravo! Best film of the year!', vi: 'Hoan hô! Phim hay nhất năm!' },
      ],
    },
    {
      id: 'cinema-daily-5',
      title: 'Áp phích của Tom',
      scene: 'Zoe chạy về nhà, tay cầm một tấm áp phích còn thơm mùi mực in.',
      lines: [
        { who: 'them', en: 'Look! Tom made a poster for my new film!', vi: 'Nhìn này! Tom làm áp phích cho phim mới của em!' },
        { who: 'you', en: "Wait, that's my face. Why is my face on it?", vi: 'Khoan, mặt anh đây mà. Sao mặt anh lại ở trên đó?' },
        { who: 'them', en: "Because you're the star. Get used to it.", vi: 'Vì anh là ngôi sao. Tập quen dần đi.' },
      ],
    },
    {
      id: 'cinema-daily-6',
      title: 'Máy chiếu hỏng',
      scene: 'Máy chiếu của rạp tắt ngúm giữa suất chiếu, Zoe gọi điện về nhà.',
      lines: [
        { who: 'them', en: "The projector died. Forty people are waiting.", vi: 'Máy chiếu chết rồi. Bốn mươi người đang chờ.' },
        { who: 'you', en: 'Should I call Max? He fixes everything.', vi: 'Hay anh gọi Max nhé? Anh ấy sửa được mọi thứ.' },
        { who: 'them', en: 'Yes, call him. Tell him free tickets for a month.', vi: 'Ừ, gọi đi. Bảo anh ấy được vé miễn phí một tháng.' },
      ],
    },
    {
      id: 'cinema-daily-7',
      title: 'Ngày mưa',
      scene: 'Mưa cả ngày, hai người quấn chăn trên sofa, bát bỏng ngô ở giữa.',
      lines: [
        { who: 'them', en: 'Rainy days are made for movie marathons.', vi: 'Ngày mưa sinh ra là để cày phim liền tù tì.' },
        { who: 'you', en: 'How many films are on the list?', vi: 'Trong danh sách có bao nhiêu phim?' },
        { who: 'them', en: 'Six. Maybe seven. Did you bring more popcorn?', vi: 'Sáu. Có khi bảy. Anh mang thêm bỏng ngô chưa?' },
      ],
    },
    {
      id: 'cinema-daily-8',
      title: 'Phim về gia đình mình',
      scene: 'Buổi tối, Zoe mở lại những đoạn phim quay hai người từ ngày đầu.',
      lines: [
        { who: 'them', en: "I'm making a film about us. All of it.", vi: 'Em đang làm một phim về hai đứa mình. Từ đầu đến giờ.' },
        { who: 'you', en: 'Even the part where I fell off the pier?', vi: 'Cả đoạn anh ngã khỏi cầu câu à?' },
        { who: 'them', en: "Especially that part. It's the best scene.", vi: 'Nhất là đoạn đó. Cảnh hay nhất đấy.' },
        { who: 'them', en: 'And the ending? I am still writing it. With you.', vi: 'Còn cái kết à? Em vẫn đang viết. Cùng anh.' },
      ],
    },
  ],
};
