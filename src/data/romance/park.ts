// park · Lily: courtship, wedding and married life (contract: core/town/romanceTypes.ts Suitor).
// Builds on her arc (data/stories/park.ts): the day the learner asked if she was okay, the interview where she forgot
// her own phone number and got the job for being honest, the lunch she owed, her sunflowers, Pip and his dog treats
// ("rain or shine"), stress at work, green tea instead of coffee, her grandma's honey, the six o'clock running club,
// coming to town knowing nobody. After her yes she says "em" and he says "anh".
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'park',
  courtedBy: 'male',
  confess: {
    id: 'park-confess',
    title: 'Bên chiếc ghế đá',
    scene: 'Chiều tối ở công viên, Lily dắt Pip đi dạo, bạn chờ sẵn bên chiếc ghế đá quen thuộc.',
    lines: [
      { who: 'them', en: "Hey! Pip, sit. Sit! Sorry, he's so happy to see you.", vi: 'Chào! Pip, ngồi. Ngồi xuống! Xin lỗi, nó mừng gặp bạn quá.' },
      { who: 'you', en: 'Lily, these are for you.', vi: 'Lily, hoa này tặng bạn.' },
      { who: 'them', en: "For me? What's the occasion?", vi: 'Cho mình á? Có dịp gì thế?' },
      { who: 'you', en: 'I like you, Lily. I think about you all the time.', vi: 'Mình thích bạn, Lily. Lúc nào mình cũng nghĩ về bạn.' },
      { who: 'narr', vi: 'Lily im lặng hơi lâu. Pip ngước nhìn hai người, đuôi ngừng vẫy.' },
      { who: 'them', en: "Sorry, I'm so nervous I forgot how to talk.", vi: 'Xin lỗi, em run quá nên quên cả cách nói.' },
      { who: 'them', en: 'I like you too. So much. Yes, {name}!', vi: 'Em cũng thích anh. Nhiều lắm. Đồng ý, {name}!' },
      { who: 'narr', vi: 'Pip sủa một tiếng thật to, như thể nó cũng đồng ý.' },
    ],
  },
  dates: [
    {
      id: 'park-date-1',
      title: 'Hẹn hò lần đầu: bữa trưa còn nợ',
      scene: 'Trưa thứ Bảy, Lily dẫn bạn tới quán Emma để trả bữa trưa đã nợ từ lâu.',
      lines: [
        { who: 'them', en: 'Finally! The lunch I owe you. Order anything you want.', vi: 'Cuối cùng cũng tới! Bữa trưa em nợ anh. Anh gọi gì cũng được.' },
        { who: 'you', en: "Anything? Then I'll have the mushroom pasta.", vi: 'Gì cũng được à? Thế anh gọi mì Ý sốt nấm.' },
        { who: 'them', en: 'Same for me. And a green tea, please.', vi: 'Em cũng thế. Với một trà xanh nhé.' },
        { who: 'narr', vi: 'Ăn xong, Lily lục túi mãi, mặt đỏ dần.' },
        { who: 'them', en: 'Oh no. I left my wallet at home. Of course I did.', vi: 'Ôi không. Em để quên ví ở nhà rồi. Biết ngay mà.' },
        { who: 'you', en: "Don't worry. I'll pay. You can owe me lunch again.", vi: 'Đừng lo. Anh trả. Em lại nợ anh một bữa trưa nhé.' },
        { who: 'them', en: 'So we have to do this again. Was that your plan?', vi: 'Vậy là mình lại phải đi ăn lần nữa. Anh tính trước rồi à?' },
        { who: 'you', en: "No. But it's a good plan.", vi: 'Không. Nhưng là một kế hoạch hay.' },
      ],
    },
    {
      id: 'park-date-2',
      title: 'Hẹn hò lần hai: Pip nhảy xuống hồ',
      scene: 'Sáng Chủ nhật, hai người dắt Pip ra cầu câu bên hồ.',
      lines: [
        { who: 'them', en: 'Pip loves the pier. He thinks every fish is his friend.', vi: 'Pip mê cầu câu lắm. Nó tưởng con cá nào cũng là bạn nó.' },
        { who: 'you', en: 'Careful, Pip. Not too close to the edge.', vi: 'Cẩn thận, Pip. Đừng ra sát mép quá.' },
        { who: 'narr', vi: 'Tõm! Pip đã nhảy xuống hồ, bơi vòng vòng đầy hào hứng.' },
        { who: 'them', en: 'Pip! Oh no, can he swim? Can dogs swim?', vi: 'Pip! Ôi không, nó biết bơi không? Chó có biết bơi không?' },
        { who: 'them', en: "Thank goodness. I can't swim, you know. Not even a little.", vi: 'May quá. Em không biết bơi đâu. Một chút cũng không.' },
        { who: 'you', en: "Really? Then I'll teach you. Pip can help.", vi: 'Thật á? Vậy anh dạy em. Pip phụ.' },
        { who: 'them', en: 'Deal. But not today. Today we dry a dog.', vi: 'Chốt. Nhưng không phải hôm nay. Hôm nay phải lau khô một con chó đã.' },
      ],
      choice: {
        after: 3,
        q: 'Lily hoảng hốt. Bạn làm gì?',
        options: [
          {
            id: 'park-date-2-a',
            en: "Pip, come here! Who wants a treat?",
            vi: 'Pip, lại đây! Ai muốn ăn bánh thưởng nào?',
            points: 15,
            reply: [{ who: 'narr', vi: 'Nghe đến bánh thưởng, Pip bơi thẳng vào bờ.' }],
          },
          {
            id: 'park-date-2-b',
            en: "Hold this. I'm going in.",
            vi: 'Cầm hộ anh. Anh xuống đây.',
            points: 20,
            reply: [{ who: 'narr', vi: 'Bạn nhảy xuống hồ. Pip bơi vào bờ trước, còn bạn thì ướt sũng.' }],
          },
          {
            id: 'park-date-2-c',
            en: "Relax. Look, he's swimming. He's fine.",
            vi: 'Bình tĩnh. Nhìn kìa, nó đang bơi. Nó ổn mà.',
            points: 10,
            reply: [{ who: 'them', en: "Oh. He's smiling. He's actually smiling.", vi: 'Ồ. Nó đang cười. Nó cười thật kìa.' }],
          },
        ],
      },
    },
    {
      id: 'park-date-3',
      title: 'Hẹn hò lần ba: đài phun nước buổi tối',
      scene: 'Tối thứ Sáu, quảng trường lên đèn, Lily chạy tới đài phun nước, vẫn mặc nguyên đồ công sở.',
      lines: [
        { who: 'them', en: "I did it! My first big presentation. I didn't forget a thing!", vi: 'Em làm được rồi! Buổi thuyết trình lớn đầu tiên. Em không quên chữ nào!' },
        { who: 'you', en: 'I knew you could. Not even your phone number?', vi: 'Anh biết em làm được mà. Kể cả số điện thoại à?' },
        { who: 'them', en: 'Ha! I wrote it on my hand. Just in case.', vi: 'Ha! Em viết lên tay rồi. Phòng khi cần.' },
        { who: 'narr', vi: 'Lily xòe bàn tay: một dãy số nhỏ, và bên dưới là tên bạn.' },
        { who: 'you', en: 'Why is my name on there too?', vi: 'Sao có cả tên anh ở đây?' },
        { who: 'them', en: 'So I remember someone believes in me.', vi: 'Để em nhớ rằng có người tin em.' },
        { who: 'you', en: "Always. Come on, let's get ice cream. My treat.", vi: 'Lúc nào cũng tin. Đi nào, mình đi ăn kem. Anh mời.' },
        { who: 'them', en: 'Can we get one for Pip too?', vi: 'Mua cho Pip một cái nữa được không?' },
      ],
    },
  ],
  proposal: {
    id: 'park-proposal',
    title: 'Chiếc hộp trên vòng cổ Pip',
    scene: 'Sáng sớm ở công viên, bạn nhờ Pip giữ một chiếc hộp nhỏ buộc trên vòng cổ.',
    lines: [
      { who: 'them', en: "Pip, what's that on your collar? Did someone lose this?", vi: 'Pip, cái gì trên vòng cổ con thế? Ai đánh rơi à?' },
      { who: 'you', en: 'Nobody lost it. Open it, Lily.', vi: 'Không ai đánh rơi đâu. Mở ra đi, Lily.' },
      { who: 'narr', vi: 'Trong hộp là một chiếc nhẫn. Bạn quỳ xuống bên luống hướng dương.' },
      { who: 'you', en: 'This is where I first asked if you were okay. Will you marry me?', vi: 'Đây là chỗ lần đầu anh hỏi em có ổn không. Em lấy anh nhé?' },
      { who: 'them', en: "I'm so nervous I can't... yes. Yes! Of course, yes!", vi: 'Em run quá, không... đồng ý. Em đồng ý! Tất nhiên rồi!' },
      { who: 'them', en: "And this time, I didn't forget a single word.", vi: 'Mà lần này em không quên chữ nào nhé.' },
      { who: 'narr', vi: 'Pip chạy vòng quanh hai người, sủa vang cả công viên.' },
    ],
  },
  vows: {
    id: 'park-vows',
    title: 'Lời thề ở quảng trường',
    scene: 'Quảng trường buổi sáng, Pip đeo nơ trắng, ngồi ngay ngắn cạnh cô dâu.',
    lines: [
      { who: 'them', en: "{name}, when I came here, I didn't know anyone.", vi: '{name}, hồi mới đến đây, em không quen một ai.' },
      { who: 'them', en: 'Now I have you. I promise to be brave, for us.', vi: 'Giờ em có anh. Em hứa sẽ dũng cảm, vì hai đứa mình.' },
      { who: 'you', en: 'Lily, I promise to sit with you on hard days, and walk Pip on rainy ones.', vi: 'Lily, anh hứa sẽ ngồi bên em những ngày khó khăn, và dắt Pip những hôm trời mưa.' },
      { who: 'narr', vi: 'Pip sủa đúng lúc Leo tuyên bố hai người là vợ chồng.' },
      { who: 'them', en: 'Even Pip says yes. I love you.', vi: 'Đến Pip cũng đồng ý. Em yêu anh.' },
    ],
  },
  daily: [
    {
      id: 'park-daily-1',
      title: 'Mưa hay nắng',
      scene: 'Ngoài trời mưa rả rích, Pip đã ngậm sẵn dây dắt đứng chờ ở cửa.',
      lines: [
        { who: 'them', en: "Your turn to walk Pip. It's raining.", vi: 'Đến lượt anh dắt Pip. Trời đang mưa đấy.' },
        { who: 'you', en: 'Rain or shine, right?', vi: 'Mưa hay nắng cũng đi, đúng không?' },
        { who: 'them', en: "Rain or shine. I'll make tea.", vi: 'Mưa hay nắng cũng đi. Em pha trà chờ anh.' },
      ],
    },
    {
      id: 'park-daily-2',
      title: 'Câu lạc bộ chạy bộ',
      scene: 'Sáu giờ kém mười, Lily đã mặc xong đồ chạy.',
      lines: [
        { who: 'them', en: 'Six o\'clock run. Are you coming?', vi: 'Sáu giờ chạy bộ. Anh đi không?' },
        { who: 'you', en: 'In this weather?', vi: 'Thời tiết thế này á?' },
        { who: 'them', en: 'The club runs in any weather. Come on!', vi: 'Câu lạc bộ chạy mọi thời tiết. Đi nào!' },
      ],
    },
    {
      id: 'park-daily-3',
      title: 'Cuộc họp ngày mai',
      scene: 'Tối muộn, Lily ngồi ôm gối, mắt dán vào tập giấy.',
      lines: [
        { who: 'them', en: 'I have a big meeting tomorrow.', vi: 'Mai em có một cuộc họp lớn.' },
        { who: 'you', en: 'Write my name on your hand.', vi: 'Viết tên anh lên tay đi.' },
        { who: 'them', en: 'Already did.', vi: 'Em viết rồi.' },
      ],
    },
    {
      id: 'park-daily-4',
      title: 'Mật ong của bà',
      scene: 'Lily đặt cốc trà lên bàn, thìa mật ong vẫn còn trong cốc.',
      lines: [
        { who: 'them', en: 'I put honey in your tea.', vi: 'Em cho mật ong vào trà của anh rồi.' },
        { who: 'you', en: 'You put honey in everything.', vi: 'Món gì em cũng cho mật ong.' },
        { who: 'them', en: "Grandma's honey. It makes everything better.", vi: 'Mật ong của bà mà. Cho vào cái gì cũng ngon hơn.' },
      ],
    },
    {
      id: 'park-daily-5',
      title: 'Hướng dương sau nhà',
      scene: 'Chiều tối, hai người đứng ngắm mảnh vườn nhỏ sau nhà.',
      lines: [
        { who: 'you', en: 'The sunflowers are taller than me now.', vi: 'Mấy cây hướng dương giờ cao hơn anh rồi.' },
        { who: 'them', en: 'They just keep growing.', vi: 'Chúng cứ lớn mãi thôi.' },
        { who: 'you', en: 'Like your to-do list at work?', vi: 'Như danh sách việc ở chỗ làm của em à?' },
        { who: 'them', en: 'Ha! No. My list is shorter now.', vi: 'Ha! Không đâu. Giờ danh sách của em ngắn hơn rồi.' },
      ],
    },
    {
      id: 'park-daily-6',
      title: 'Mùi cà phê',
      scene: 'Lily bước vào bếp, khựng lại trước mùi cà phê.',
      lines: [
        { who: 'them', en: 'Is that coffee I smell?', vi: 'Em ngửi thấy mùi cà phê à?' },
        { who: 'you', en: 'Just one cup. For me, not you.', vi: 'Một cốc thôi. Cho anh, không phải cho em.' },
        { who: 'them', en: 'Good. You know what it does to me.', vi: 'Thế thì được. Anh biết cà phê làm em thế nào mà.' },
      ],
    },
    {
      id: 'park-daily-7',
      title: 'Con gà biến mất',
      scene: 'Lily nhìn cái đĩa trống trơn trên bàn, rồi nhìn sang Pip.',
      lines: [
        { who: 'them', en: "Where's the chicken? It was right here.", vi: 'Con gà đâu rồi? Nó vừa ở ngay đây mà.' },
        { who: 'you', en: 'Pip!', vi: 'Pip!' },
        { who: 'them', en: 'He looks very happy, though.', vi: 'Mà trông nó vui ghê cơ.' },
      ],
    },
    {
      id: 'park-daily-8',
      title: 'Chiếc ghế đá cũ',
      scene: 'Chiều muộn, hai người ngồi lại trên chiếc ghế đá trong công viên.',
      lines: [
        { who: 'them', en: 'Remember this bench?', vi: 'Anh còn nhớ chiếc ghế này không?' },
        { who: 'you', en: 'Where you looked so sad.', vi: 'Chỗ em ngồi buồn thiu hôm nào.' },
        { who: 'them', en: 'And look at me now. Look at us.', vi: 'Thế mà giờ nhìn em xem. Nhìn hai đứa mình xem.' },
      ],
    },
  ],
};
