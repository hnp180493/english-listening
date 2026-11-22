// school · Daniel: courtship, wedding and married life (contract: core/town/romanceTypes.ts).
// Builds on his arc (data/stories/school.ts): the evening class the learner was late for (the famous number nine),
// "little and often", honey in his tea, the library and "the look", no biscuits over the pages, the conversation club
// with Ben's bread, his scorn for chewy bubble tea, the 82% test, and the mystery novel he has written for twelve years.
// The learner was his student: he says yes only once the term is over, and drops "thầy" for "anh".
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'school',
  courtedBy: 'female',
  confess: {
    id: 'school-confess',
    title: 'Tỏ tình sau buổi học cuối',
    scene: 'Buổi học cuối khóa đã tan, lớp vắng tanh, Daniel đang lau bảng.',
    lines: [
      { who: 'them', en: "Still here? The term's over, you know. No more homework.", vi: 'Em vẫn còn ở đây à? Hết khóa rồi đấy. Không còn bài tập về nhà nữa.' },
      { who: 'you', en: "I know. That's why I waited. These are for you.", vi: 'Em biết. Thế nên em mới đợi. Hoa này tặng thầy.' },
      { who: 'them', en: "Flowers? Goodness. Nobody's given me flowers. Ever.", vi: 'Hoa ư? Trời đất. Chưa ai tặng hoa cho thầy cả. Chưa bao giờ.' },
      { who: 'you', en: 'Daniel, I like you. Not as my teacher.', vi: 'Daniel, em thích anh. Không phải như thích thầy giáo.' },
      { who: 'narr', vi: 'Daniel đặt cây lau bảng xuống, mặt đỏ dần lên.' },
      { who: 'them', en: 'Well. In my novel, this is where the detective goes quiet.', vi: 'Chà. Trong tiểu thuyết của anh, đây là lúc viên thám tử lặng người.' },
      { who: 'them', en: 'I think I liked you from the day you were late for class.', vi: 'Hình như anh để ý em từ cái hôm em đến lớp muộn.' },
      { who: 'them', en: "So yes. And please, it's just Daniel now.", vi: 'Nên câu trả lời là có. Và từ giờ đừng gọi thầy nữa nhé, gọi anh thôi.' },
    ],
  },
  dates: [
    {
      id: 'school-date-1',
      title: 'Hẹn hò lần đầu: trà mật ong',
      scene: 'Chiều Chủ nhật ở quán Emma, Daniel đã ngồi sẵn với ấm trà và một hũ mật ong riêng.',
      lines: [
        { who: 'them', en: 'I brought my own honey. Emma pretends not to notice.', vi: 'Anh mang mật ong riêng. Emma giả vờ như không thấy.' },
        { who: 'you', en: 'You carry honey in your bag? Every day?', vi: 'Anh mang mật ong trong túi á? Ngày nào cũng thế?' },
        { who: 'them', en: 'Only on special days. Today counts as a special day.', vi: 'Chỉ những ngày đặc biệt thôi. Hôm nay là ngày đặc biệt.' },
        { who: 'them', en: 'Now, what will you have? Choose carefully.', vi: 'Nào, em uống gì? Chọn cẩn thận đấy.' },
        { who: 'you', en: "So, how's the novel going?", vi: 'Thế cuốn tiểu thuyết sao rồi anh?' },
        { who: 'them', en: "Chapter nine. The detective just met someone. It's complicated.", vi: 'Chương chín. Viên thám tử vừa gặp một người. Phức tạp lắm.' },
        { who: 'you', en: 'Complicated how?', vi: 'Phức tạp thế nào?' },
        { who: 'them', en: "She keeps reading his notes. And he doesn't mind at all.", vi: 'Cô ấy cứ đọc sổ ghi chép của anh ta. Mà anh ta chẳng phiền chút nào.' },
      ],
      choice: {
        after: 3,
        q: 'Bạn gọi món gì?',
        options: [
          {
            id: 'school-date-1-a',
            en: 'Tea with honey, please. Just like yours.',
            vi: 'Trà mật ong ạ. Giống của anh.',
            points: 15,
            reply: [{ who: 'them', en: 'Oh, lovely. A woman of taste.', vi: 'Ồ, tuyệt. Một quý cô sành điệu.' }],
          },
          {
            id: 'school-date-1-b',
            en: 'A bubble tea. Extra chewy.',
            vi: 'Một ly trà sữa trân châu. Thêm nhiều trân châu.',
            points: 10,
            reply: [{ who: 'them', en: "Extra chewy. You're doing this to hurt me.", vi: 'Thêm trân châu. Em cố tình làm anh đau lòng đây mà.' }],
          },
          {
            id: 'school-date-1-c',
            en: "Whatever you'd recommend, Daniel.",
            vi: 'Anh giới thiệu gì em uống nấy, Daniel.',
            points: 15,
            reply: [{ who: 'them', en: "Careful. I'd recommend tea for the rest of your life.", vi: 'Cẩn thận đấy. Anh sẽ giới thiệu trà cho em suốt đời.' }],
          },
        ],
      },
    },
    {
      id: 'school-date-2',
      title: 'Hẹn hò lần hai: cái lườm trong thư viện',
      scene: 'Tối thứ Năm, câu lạc bộ hội thoại đã tan, chỉ còn hai người trong góc thư viện.',
      lines: [
        { who: 'you', en: "I finally brought your book back. It's a bit late.", vi: 'Cuối cùng em cũng trả sách cho anh. Hơi muộn một chút.' },
        { who: 'them', en: 'Three weeks late. You know what that means.', vi: 'Muộn ba tuần. Em biết thế nghĩa là gì rồi đấy.' },
        { who: 'you', en: 'Not the look! Anything but the look.', vi: 'Đừng lườm! Gì cũng được, trừ cái lườm.' },
        { who: 'them', en: "There. The look. Terrifying, wasn't it?", vi: 'Đây. Cái lườm đây. Đáng sợ chưa?' },
        { who: 'you', en: "Honestly? It's kind of cute.", vi: 'Nói thật nhé? Trông hơi bị dễ thương.' },
        { who: 'them', en: "Cute? I've been perfecting it for twenty years.", vi: 'Dễ thương á? Anh luyện cái lườm này hai mươi năm rồi đấy.' },
        { who: 'them', en: 'Here. My favorite book when I was ten. Take your time.', vi: 'Đây. Cuốn sách anh thích nhất hồi mười tuổi. Em cứ đọc từ từ.' },
        { who: 'you', en: 'No late fees?', vi: 'Không phạt trả muộn chứ?' },
        { who: 'them', en: 'For you, no late fees. Just no biscuits over the pages.', vi: 'Với em thì không phạt. Chỉ đừng vừa ăn bánh quy vừa lật sách.' },
      ],
    },
    {
      id: 'school-date-3',
      title: 'Hẹn hò lần ba: thủ phạm là ai',
      scene: 'Rạp của Zoe chiếu phim trinh thám, Daniel ngồi nhổm sát mép ghế từ lúc đèn tắt.',
      lines: [
        { who: 'them', en: "It's the gardener. I'm telling you, it's the gardener.", vi: 'Là ông làm vườn. Anh nói rồi, chính là ông làm vườn.' },
        { who: 'you', en: 'Daniel, the film started five minutes ago.', vi: 'Daniel, phim mới chiếu được năm phút.' },
        { who: 'them', en: 'Look at his shoes. Nobody gardens in shoes like that.', vi: 'Nhìn giày ông ta kìa. Chẳng ai làm vườn mà đi giày như thế.' },
        { who: 'narr', vi: 'Đến cuối phim, thủ phạm đúng là ông làm vườn thật.' },
        { who: 'you', en: "I can't believe it. It really was the gardener!", vi: 'Không thể tin được. Đúng là ông làm vườn thật!' },
        { who: 'them', en: 'Twelve years of writing mysteries. Finally, it pays off.', vi: 'Mười hai năm viết truyện trinh thám. Cuối cùng cũng có ích.' },
        { who: 'you', en: "Next time, you're not allowed to talk.", vi: 'Lần sau anh cấm được nói.' },
        { who: 'them', en: 'Fair. Next time, you choose the film. One with no gardeners.', vi: 'Công bằng. Lần sau em chọn phim. Phim nào không có ông làm vườn.' },
      ],
    },
  ],
  proposal: {
    id: 'school-proposal',
    title: 'Cầu hôn trên bảng đen',
    scene: 'Lớp học buổi tối vắng người, bạn viết một câu lên bảng rồi gọi Daniel vào.',
    lines: [
      { who: 'them', en: 'You wanted to show me something? In the classroom?', vi: 'Em muốn cho anh xem gì à? Ở trong lớp?' },
      { who: 'you', en: 'Read the board, please. Out loud.', vi: 'Anh đọc câu trên bảng đi. Đọc to lên.' },
      { who: 'them', en: "'Daniel, will you marry me.' You forgot the question mark.", vi: "'Daniel, anh cưới em nhé.' Em quên dấu hỏi rồi." },
      { who: 'you', en: "Daniel! Really? That's what you see?", vi: 'Daniel! Thật hả? Anh chỉ thấy có thế thôi à?' },
      { who: 'them', en: "Sorry. Teacher's habit. Let me fix it.", vi: 'Xin lỗi. Bệnh nghề nghiệp. Để anh sửa.' },
      { who: 'narr', vi: 'Daniel thêm dấu hỏi, quay lại thì thấy bạn đang mở hộp nhẫn.' },
      { who: 'them', en: 'Yes. Yes, of course. Full marks. A hundred percent.', vi: 'Có. Có, tất nhiên rồi. Điểm tuyệt đối. Một trăm phần trăm.' },
      { who: 'you', en: 'Better than eighty-two?', vi: 'Hơn tám mươi hai chứ?' },
      { who: 'them', en: 'Much better. This is my favorite answer ever.', vi: 'Hơn nhiều. Đây là câu trả lời anh thích nhất từ trước tới giờ.' },
    ],
  },
  vows: {
    id: 'school-vows',
    title: 'Lễ cưới ở quảng trường',
    scene: 'Quảng trường đầy hoa, cả lớp tối thứ Ba và câu lạc bộ hội thoại ngồi kín mấy hàng ghế.',
    lines: [
      { who: 'them', en: '{name}, for twelve years I wrote a story with no ending.', vi: '{name}, suốt mười hai năm anh viết một câu chuyện chưa có kết.' },
      { who: 'them', en: 'Now I know how it ends. With you.', vi: 'Giờ anh biết nó kết thúc thế nào rồi. Với em.' },
      { who: 'you', en: 'And I promise to read every page. Little and often.', vi: 'Còn em hứa sẽ đọc từng trang. Ít một, nhưng đều đặn.' },
      { who: 'them', en: 'And I promise to share my honey. Most of it.', vi: 'Và anh hứa sẽ chia mật ong cho em. Phần lớn.' },
      { who: 'you', en: "I'll take it. And I'll never be late again.", vi: 'Em nhận lời. Và em sẽ không bao giờ đến muộn nữa.' },
    ],
  },
  daily: [
    {
      id: 'school-daily-1',
      title: 'Trà sáng',
      scene: 'Ấm nước vừa sôi, Daniel rót hai tách trà.',
      lines: [
        { who: 'them', en: "Tea's ready. Honey's in. Just the way you like it.", vi: 'Trà xong rồi. Đã cho mật ong. Đúng kiểu em thích.' },
        { who: 'you', en: 'You mean the way you like it.', vi: 'Ý anh là đúng kiểu anh thích chứ.' },
        { who: 'them', en: "After all this time, it's the same thing.", vi: 'Sau ngần ấy thời gian, hai cái đó là một rồi.' },
      ],
    },
    {
      id: 'school-daily-2',
      title: 'Âm một trang',
      scene: 'Daniel ngồi bên bàn viết, xung quanh toàn giấy vo tròn.',
      lines: [
        { who: 'you', en: 'How many pages did you write today?', vi: 'Hôm nay anh viết được mấy trang?' },
        { who: 'them', en: 'Two. Then I crossed out three.', vi: 'Hai trang. Rồi gạch mất ba.' },
        { who: 'you', en: 'So you wrote minus one page?', vi: 'Vậy là anh viết được âm một trang?' },
        { who: 'them', en: "In novels, that's still progress.", vi: 'Với tiểu thuyết, thế vẫn là tiến bộ.' },
      ],
    },
    {
      id: 'school-daily-3',
      title: 'Trà phải để uống',
      scene: 'Bạn cầm ví chuẩn bị ra ngoài.',
      lines: [
        { who: 'you', en: "I'm getting a bubble tea. Want one?", vi: 'Em đi mua trà sữa. Anh uống không?' },
        { who: 'them', en: "I'd rather drink pond water.", vi: 'Anh thà uống nước ao còn hơn.' },
        { who: 'you', en: "So that's a no?", vi: 'Vậy là không à?' },
        { who: 'them', en: 'Get me a tea. A proper one.', vi: 'Mua cho anh một tách trà. Trà tử tế ấy.' },
      ],
    },
    {
      id: 'school-daily-4',
      title: 'Câu lạc bộ tối thứ Năm',
      scene: 'Daniel đứng trước gương, chỉnh lại cổ áo.',
      lines: [
        { who: 'them', en: 'Club tonight. Will you help me with the new people?', vi: 'Tối nay sinh hoạt câu lạc bộ. Em giúp anh với mấy bạn mới nhé?' },
        { who: 'you', en: "Sure. I'll bring the bread from Ben's.", vi: 'Được. Em mang bánh mì của tiệm Ben.' },
        { who: 'them', en: "Then they'll definitely come back.", vi: 'Thế thì chắc chắn họ sẽ quay lại.' },
      ],
    },
    {
      id: 'school-daily-5',
      title: 'Tuyến số chín',
      scene: 'Daniel nhìn đồng hồ, rồi lại nhìn ra cửa sổ.',
      lines: [
        { who: 'you', en: 'Is your bus late again?', vi: 'Xe buýt của anh lại trễ à?' },
        { who: 'them', en: 'The famous number nine. Some things never change.', vi: 'Tuyến số chín nổi tiếng. Có những thứ chẳng bao giờ đổi.' },
        { who: 'you', en: 'Good. More time for breakfast with me.', vi: 'Càng tốt. Thêm thời gian ăn sáng với em.' },
      ],
    },
    {
      id: 'school-daily-6',
      title: 'Mười phút mỗi ngày',
      scene: 'Bạn vừa ngồi xuống sofa thì Daniel nhướn mày.',
      lines: [
        { who: 'them', en: 'Have you done your ten minutes today?', vi: 'Hôm nay em học đủ mười phút chưa?' },
        { who: 'you', en: "Daniel, I'm your wife, not your student.", vi: 'Daniel, em là vợ anh, không phải học trò.' },
        { who: 'them', en: 'My wife can still do ten minutes.', vi: 'Vợ anh vẫn học mười phút được mà.' },
        { who: 'you', en: 'Fine. But only if you make the tea.', vi: 'Thôi được. Nhưng anh phải pha trà.' },
      ],
    },
    {
      id: 'school-daily-7',
      title: 'Chiều mưa',
      scene: 'Ngoài trời mưa rả rích, Daniel ôm hai cuốn sách ra phòng khách.',
      lines: [
        { who: 'them', en: "It's raining. Shall we stay in and read?", vi: 'Trời mưa rồi. Mình ở nhà đọc sách nhé?' },
        { who: 'you', en: 'Your novel or mine?', vi: 'Tiểu thuyết của anh hay sách của em?' },
        { who: 'them', en: "Yours. I'm still stuck on chapter twelve.", vi: 'Của em. Anh vẫn đang kẹt ở chương mười hai.' },
      ],
    },
    {
      id: 'school-daily-8',
      title: 'Chấm bài lúc nửa đêm',
      scene: 'Gần nửa đêm, đèn bàn vẫn sáng, Daniel ngồi giữa chồng bài kiểm tra.',
      lines: [
        { who: 'you', en: "You're marking homework at midnight again.", vi: 'Anh lại chấm bài lúc nửa đêm.' },
        { who: 'them', en: 'Only three more. Then bed, I promise.', vi: 'Còn ba bài thôi. Xong là đi ngủ, anh hứa.' },
        { who: 'you', en: 'You said that an hour ago.', vi: 'Một tiếng trước anh cũng nói thế.' },
        { who: 'them', en: 'Did I? Well. Two more, then.', vi: 'Thế à? Ừm. Vậy còn hai bài.' },
      ],
    },
  ],
};
