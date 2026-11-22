// cafe · Emma: courtship, wedding and married life (contract: core/town/romanceTypes.ts Suitor).
// Builds on her arc (data/stories/cafe.ts): the learner's first iced latte, her being sick of lattes, honey in
// everything, Friday dinner nights, the plate mix-up with Ben, her grandma's lemon cake (three lemons, lots of butter, a
// spoon of honey), the novel and the whole day off she wished for. After her yes she says "em" and he says "anh".
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'cafe',
  courtedBy: 'male',
  confess: {
    id: 'cafe-confess',
    title: 'Bó hoa sau lưng',
    scene: 'Quán đã vãn khách, bạn đứng ở quầy, giấu một bó hoa sau lưng.',
    lines: [
      { who: 'them', en: "Hey, you! We're closing, but for you I'm still open.", vi: 'Chào bạn! Quán sắp đóng rồi, nhưng với bạn thì vẫn mở.' },
      { who: 'you', en: "Emma, I didn't come for coffee tonight.", vi: 'Emma, tối nay tôi không đến uống cà phê.' },
      { who: 'them', en: "No? Then what's behind your back?", vi: 'Không à? Thế sau lưng bạn có gì đấy?' },
      { who: 'you', en: 'These are for you. I really like you, Emma. More than a friend.', vi: 'Hoa này tặng bạn. Tôi thích bạn lắm, Emma. Hơn cả bạn bè.' },
      { who: 'narr', vi: 'Emma đứng im, tay vẫn cầm chiếc khăn lau quầy.' },
      { who: 'them', en: "Wait. Are you serious? I've been hoping you'd say that.", vi: 'Khoan. Anh nói thật à? Em vẫn mong anh nói câu đó.' },
      { who: 'you', en: 'Very serious. So, what do you say?', vi: 'Thật lòng mà. Thế em nghĩ sao?' },
      { who: 'them', en: 'I say yes. Yes, {name}!', vi: 'Em đồng ý. Đồng ý, {name}!' },
      { who: 'them', en: 'Now help me find a vase. An old latte cup will do.', vi: 'Giờ phụ em tìm cái bình cắm hoa đi. Cái ly latte cũ cũng được.' },
    ],
  },
  dates: [
    {
      id: 'cafe-date-1',
      title: 'Hẹn hò lần đầu: ngày nghỉ ở cầu câu',
      scene: 'Ngày nghỉ trọn vẹn đầu tiên của Emma, hai người ngồi ở cầu câu bên hồ.',
      lines: [
        { who: 'them', en: 'So this is a day off. What do people do all day?', vi: 'Thì ra đây là ngày nghỉ. Mọi người làm gì cả ngày nhỉ?' },
        { who: 'you', en: 'They relax. Like this. Just sit and wait for a fish.', vi: 'Họ thư giãn. Như thế này. Cứ ngồi chờ cá cắn câu.' },
        { who: 'them', en: 'I keep thinking about the milk. Did Ben bring it?', vi: 'Em cứ nghĩ đến chuyện sữa. Ben mang tới chưa nhỉ?' },
        { who: 'you', en: 'Emma. No work today. You promised.', vi: 'Emma. Hôm nay không nghĩ chuyện quán. Em hứa rồi mà.' },
        { who: 'them', en: "Okay, okay. Oh! Something's pulling! Help me!", vi: 'Rồi, rồi. Ôi! Có gì kéo này! Giúp em với!' },
        { who: 'narr', vi: 'Một chiếc ủng cũ, đầy bùn, được kéo lên khỏi mặt nước.' },
        { who: 'them', en: "It's a boot. My first fish is a boot.", vi: 'Một chiếc ủng. Con cá đầu tiên của em là chiếc ủng.' },
        { who: 'you', en: "Hey, it's a big one. I'm proud of you.", vi: 'Này, to đấy chứ. Anh tự hào về em.' },
        { who: 'them', en: 'Best day off in two years. Seriously.', vi: 'Ngày nghỉ vui nhất trong hai năm nay. Thật đấy.' },
      ],
    },
    {
      id: 'cafe-date-2',
      title: 'Hẹn hò lần hai: phim kinh dị',
      scene: 'Tối thứ Bảy ở rạp phim, Zoe vừa xé vé vừa nháy mắt với hai người.',
      lines: [
        { who: 'them', en: 'Okay, I have to tell you something. I hate scary movies.', vi: 'Rồi, em phải thú thật. Em ghét phim kinh dị.' },
        { who: 'you', en: 'Now you tell me? Zoe said this one is really scary.', vi: 'Giờ mới nói à? Zoe bảo phim này sợ lắm.' },
        { who: 'them', en: 'I know. I wanted to look brave. For you.', vi: 'Em biết. Em muốn tỏ ra dũng cảm. Vì anh.' },
        { who: 'them', en: "Also, I brought lemon cake. Don't tell Zoe.", vi: 'Còn nữa, em lén mang bánh chanh vào. Đừng mách Zoe nhé.' },
        { who: 'narr', vi: 'Đèn tắt. Mười phút sau, Emma đã lấy hộp bánh che mắt.' },
        { who: 'them', en: 'Next time, I pick the movie. Something with cake in it.', vi: 'Lần sau em chọn phim. Phim nào có bánh ấy.' },
        { who: 'you', en: "Deal. And I'll bring the honey.", vi: 'Chốt. Còn anh mang mật ong.' },
      ],
      choice: {
        after: 4,
        q: 'Emma sợ run cả người. Bạn nói gì?',
        options: [
          {
            id: 'cafe-date-2-a',
            en: "Here, hold my hand. I've got you.",
            vi: 'Đây, nắm tay anh này. Có anh đây.',
            points: 20,
            reply: [{ who: 'them', en: "Okay. That's actually much better.", vi: 'Ừ. Thế này dễ chịu hơn hẳn.' }],
          },
          {
            id: 'cafe-date-2-b',
            en: 'Want to leave and get dinner instead?',
            vi: 'Hay mình ra về, đi ăn tối nhé?',
            points: 15,
            reply: [{ who: 'them', en: "Yes, please. Is that terrible? I don't care.", vi: 'Có, đi thôi. Thế có tệ không nhỉ? Kệ.' }],
          },
          {
            id: 'cafe-date-2-c',
            en: "Don't worry. It's just ketchup.",
            vi: 'Đừng lo. Máu giả thôi, tương cà ấy mà.',
            points: 0,
            reply: [{ who: 'them', en: 'That is not helping, {name}.', vi: 'Chẳng giúp được gì đâu, {name}.' }],
          },
        ],
      },
    },
    {
      id: 'cafe-date-3',
      title: 'Hẹn hò lần ba: chợ phiên và đài phun nước',
      scene: 'Sáng thứ Bảy, chợ phiên họp ở quảng trường, Emma xách giỏ đi chọn chanh.',
      lines: [
        { who: 'them', en: 'These lemons are perfect. Smell this!', vi: 'Chanh này ngon quá. Anh ngửi thử xem!' },
        { who: 'you', en: 'Smells like your café. Like home.', vi: 'Thơm như quán em. Như ở nhà.' },
        { who: 'them', en: 'Aw. Okay, now honey. The good kind, not the cheap kind.', vi: 'Ôi. Rồi, giờ đến mật ong. Loại ngon, không lấy loại rẻ.' },
        { who: 'you', en: 'How many cakes are you making?', vi: 'Em định làm bao nhiêu cái bánh?' },
        { who: 'them', en: 'Just one. For us. No customers, no Ben.', vi: 'Một cái thôi. Cho hai đứa mình. Không khách, không Ben.' },
        { who: 'narr', vi: 'Đi ngang đài phun nước, Emma rút trong túi ra một đồng xu.' },
        { who: 'them', en: 'Make a wish with me. On three.', vi: 'Ước cùng em đi. Đếm đến ba nhé.' },
        { who: 'you', en: 'What did you wish for?', vi: 'Em ước gì thế?' },
        { who: 'them', en: "Not telling. But you're in it.", vi: 'Không nói đâu. Nhưng có anh trong đó.' },
      ],
    },
  ],
  proposal: {
    id: 'cafe-proposal',
    title: 'Chiếc bánh chanh hơi xẹp',
    scene: 'Quán đóng cửa, bạn mượn bếp của Emma một tối, trên bàn là chiếc bánh chanh hơi xẹp.',
    lines: [
      { who: 'them', en: 'You made a lemon cake? For me?', vi: 'Anh làm bánh chanh à? Cho em á?' },
      { who: 'you', en: "I tried. It's a little flat. Okay, very flat.", vi: 'Anh thử thôi. Hơi xẹp. À, xẹp lắm.' },
      { who: 'them', en: "It's perfect. Wait, what's that on top?", vi: 'Hoàn hảo mà. Khoan, cái gì trên mặt bánh thế?' },
      { who: 'narr', vi: 'Giữa lớp kem chanh là một chiếc nhẫn nhỏ.' },
      { who: 'you', en: 'Emma, you make every morning better. Will you marry me?', vi: 'Emma, có em mà sáng nào cũng vui hơn. Em lấy anh nhé?' },
      { who: 'them', en: 'Oh my gosh. {name}... yes! Yes, yes, yes!', vi: 'Trời ơi. {name}... có! Em đồng ý, đồng ý!' },
      { who: 'them', en: "But next time, use more butter. That's Grandma's rule.", vi: 'Nhưng lần sau cho thêm bơ nhé. Luật của bà em đấy.' },
      { who: 'you', en: 'More butter. Got it. Anything else?', vi: 'Thêm bơ. Nhớ rồi. Còn gì nữa không?' },
      { who: 'them', en: 'Just one thing. Never stop coming in for coffee.', vi: 'Một điều thôi. Đừng bao giờ thôi ghé quán uống cà phê.' },
    ],
  },
  vows: {
    id: 'cafe-vows',
    title: 'Lời thề ở quảng trường',
    scene: 'Quảng trường giăng đèn, Leo đứng làm chủ hôn, cả thị trấn ngồi kín ghế.',
    lines: [
      { who: 'them', en: '{name}, the first day you came in, you ordered an iced latte.', vi: '{name}, ngày đầu anh đến quán, anh gọi một ly latte đá.' },
      { who: 'them', en: "I'm sick of lattes, but never of you. I promise to love you, always.", vi: 'Em ngán latte lắm rồi, nhưng chẳng bao giờ ngán anh. Em hứa sẽ yêu anh, mãi mãi.' },
      { who: 'you', en: 'Emma, I promise to try every new recipe and love you every day.', vi: 'Emma, anh hứa sẽ nếm mọi món mới của em, và yêu em mỗi ngày.' },
      { who: 'narr', vi: 'Leo tuyên bố hai người là vợ chồng, Ben huýt sáo to nhất.' },
      { who: 'them', en: 'Now everyone, cake! Lemon, of course.', vi: 'Giờ thì mời cả nhà ăn bánh! Bánh chanh, tất nhiên rồi.' },
    ],
  },
  daily: [
    {
      id: 'cafe-daily-1',
      title: 'Ly nước buổi sáng',
      scene: 'Sáng sớm, Emma đặt một cái cốc bốc khói lên bàn.',
      lines: [
        { who: 'them', en: 'Morning, sleepyhead. I made you something.', vi: 'Chào buổi sáng, anh ngủ nướng. Em pha cho anh cái này.' },
        { who: 'you', en: "Hot water with honey? Where's my coffee?", vi: 'Nước nóng pha mật ong á? Cà phê của anh đâu?' },
        { who: 'them', en: 'Trust me. Kim says it\'s better for you.', vi: 'Tin em đi. Kim bảo uống thế tốt hơn.' },
      ],
    },
    {
      id: 'cafe-daily-2',
      title: 'Tối thứ Sáu ở quán',
      scene: 'Tối thứ Sáu, quán đông khách, bạn đeo tạp dề chạy bàn giúp vợ.',
      lines: [
        { who: 'them', en: "It's busy tonight. Can you take table four?", vi: 'Tối nay đông quá. Anh lo bàn số bốn giúp em nhé?' },
        { who: 'you', en: "Sure. Please tell me it's not Ben's steak again.", vi: 'Được. Làm ơn nói đó không phải đĩa bít tết của Ben nữa đi.' },
        { who: 'them', en: "Ha! It is Ben's steak. Don't give it to anyone else.", vi: 'Ha! Đúng là bít tết của Ben đấy. Đừng mang nhầm cho ai nhé.' },
      ],
    },
    {
      id: 'cafe-daily-3',
      title: 'Cuốn tiểu thuyết',
      scene: 'Buổi tối, Emma ngủ quên trên ghế sofa, cuốn tiểu thuyết úp trên ngực.',
      lines: [
        { who: 'you', en: 'You fell asleep reading again.', vi: 'Em lại ngủ quên lúc đọc sách rồi.' },
        { who: 'them', en: 'I was just resting my eyes. What chapter was I on?', vi: 'Em chỉ nhắm mắt nghỉ chút thôi. Em đọc đến chương mấy rồi nhỉ?' },
        { who: 'you', en: 'Chapter two. Same as last week.', vi: 'Chương hai. Y như tuần trước.' },
      ],
    },
    {
      id: 'cafe-daily-4',
      title: 'Thêm một chậu cây',
      scene: 'Emma bê về một chậu cây xanh to gần bằng người.',
      lines: [
        { who: 'them', en: 'I bought another plant for the café!', vi: 'Em mua thêm một chậu cây cho quán này!' },
        { who: 'you', en: "That's the fifth one this month.", vi: 'Chậu thứ năm trong tháng này rồi đấy.' },
        { who: 'them', en: 'They make me happy. Like you.', vi: 'Có cây em thấy vui. Giống như có anh.' },
        { who: 'you', en: 'Good. But I need less water.', vi: 'Tốt. Nhưng anh thì không cần tưới nhiều thế đâu.' },
      ],
    },
    {
      id: 'cafe-daily-5',
      title: 'Lại hết sữa',
      scene: 'Emma mở tủ lạnh của quán, rồi thở dài.',
      lines: [
        { who: 'them', en: "We're out of milk. Again.", vi: 'Hết sữa rồi. Lại nữa.' },
        { who: 'you', en: "I'll call Ben. Should I tell him to start the van early?", vi: 'Để anh gọi Ben. Có cần dặn anh ấy nổ máy xe sớm không?' },
        { who: 'them', en: 'Yes. Tell him the whole town is counting on him.', vi: 'Có. Bảo anh ấy là cả thị trấn đang trông vào anh ấy đấy.' },
      ],
    },
    {
      id: 'cafe-daily-6',
      title: 'Hôm nay anh nấu',
      scene: 'Emma về nhà sau một ngày dài, đá đôi giày sang một bên.',
      lines: [
        { who: 'them', en: 'My feet hurt. A hundred customers today.', vi: 'Em đau chân quá. Hôm nay cả trăm khách.' },
        { who: 'you', en: "Sit down. I'm making dinner tonight.", vi: 'Ngồi xuống đi. Tối nay anh nấu.' },
        { who: 'them', en: 'You? Cooking? Should I call Kim now?', vi: 'Anh á? Nấu ăn á? Em có nên gọi sẵn cho Kim không?' },
        { who: 'you', en: "Very funny. It's mushroom pasta. Your favorite.", vi: 'Buồn cười ghê. Mì Ý sốt nấm đấy. Món em thích nhất.' },
      ],
    },
    {
      id: 'cafe-daily-7',
      title: 'Thủ phạm ăn vụng',
      scene: 'Emma cầm cái vỏ sô-cô-la rỗng, nheo mắt nhìn bạn.',
      lines: [
        { who: 'them', en: 'Someone ate my chocolate.', vi: 'Có người ăn mất sô-cô-la của em.' },
        { who: 'you', en: "Wasn't me. Probably a mouse.", vi: 'Không phải anh. Chắc là chuột.' },
        { who: 'them', en: 'A mouse with chocolate on his face?', vi: 'Chuột mà dính sô-cô-la trên mặt à?' },
      ],
    },
    {
      id: 'cafe-daily-8',
      title: 'Cuốn sổ của bà',
      scene: 'Quán đã đóng cửa, Emma lật cuốn sổ công thức cũ dưới ánh đèn bếp.',
      lines: [
        { who: 'them', en: "Grandma's book should stay in the family.", vi: 'Cuốn sổ của bà phải được giữ trong gia đình.' },
        { who: 'you', en: 'It will. Our family.', vi: 'Sẽ được giữ mà. Trong gia đình mình.' },
        { who: 'them', en: 'Our family. I like the sound of that.', vi: 'Gia đình mình. Em thích nghe câu đó.' },
        { who: 'them', en: "Now come on. Let's go home.", vi: 'Thôi nào. Mình về nhà thôi.' },
      ],
    },
  ],
};
