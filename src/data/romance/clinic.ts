// clinic · Kim: courtship, wedding and married life (contract: core/town/romanceTypes.ts Suitor).
// Builds on her arc (data/stories/clinic.ts): the sore throat and "drink lots of water", iced lattes as "sugar in a cup",
// five cups of green tea ("do as I say, not as I do"), the hay fever pills (twice a day, with food), the twisted ankle,
// her six o'clock runs round the park, the fruit basket, the sunflowers she plants for her grandma, who worked in a
// clinic too. After her yes she says "em" and he says "anh".
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'clinic',
  courtedBy: 'male',
  confess: {
    id: 'clinic-confess',
    title: 'Không phải đến khám',
    scene: 'Phòng khám vừa đóng cửa, Kim đang tắt đèn thì bạn gõ cửa, tay cầm một bó hướng dương.',
    lines: [
      { who: 'them', en: "Hi! We're closed, but are you okay? You look nervous.", vi: 'Chào! Hết giờ khám rồi, nhưng bạn ổn chứ? Trông bạn căng thẳng thế.' },
      { who: 'you', en: "I'm not sick. These are for you.", vi: 'Tôi không ốm. Hoa này tặng bạn.' },
      { who: 'them', en: "Sunflowers? They're my favorite.", vi: 'Hướng dương á? Hoa tôi thích nhất đấy.' },
      { who: 'you', en: 'Kim, I like you. And not because you\'re my doctor.', vi: 'Kim, tôi thích bạn. Không phải vì bạn là bác sĩ của tôi đâu.' },
      { who: 'narr', vi: 'Kim cầm lấy cổ tay bạn, như đang bắt mạch.' },
      { who: 'them', en: "Your heart's beating really fast. Mine too, actually.", vi: 'Tim anh đập nhanh quá. Mà tim em cũng thế.' },
      { who: 'them', en: 'I like you too, {name}. A lot.', vi: 'Em cũng thích anh, {name}. Nhiều lắm.' },
      { who: 'you', en: 'Is that your professional opinion?', vi: 'Đó là ý kiến chuyên môn của em à?' },
      { who: 'them', en: "Doctor's orders. Dinner with me on Friday.", vi: 'Lệnh của bác sĩ. Tối thứ Sáu đi ăn với em.' },
    ],
  },
  dates: [
    {
      id: 'clinic-date-1',
      title: 'Hẹn hò lần đầu: chạy bộ lúc sáu giờ',
      scene: 'Sáu giờ sáng, công viên còn sương, Kim đã khởi động xong từ lâu.',
      lines: [
        { who: 'them', en: "Morning! Ready for our first date? It's a run.", vi: 'Chào buổi sáng! Sẵn sàng cho buổi hẹn đầu chưa? Là chạy bộ đấy.' },
        { who: 'you', en: 'Most people go to dinner on a first date.', vi: 'Người ta hẹn đầu toàn đi ăn tối mà.' },
        { who: 'them', en: 'Dinner is later. Stretch first, remember?', vi: 'Ăn tối để sau. Khởi động trước đã, nhớ không?' },
        { who: 'narr', vi: 'Mới hết một vòng hồ, bạn đã thở không ra hơi.' },
        { who: 'you', en: 'Can we walk for a minute?', vi: 'Mình đi bộ một lúc được không?' },
        { who: 'them', en: 'Of course. Honestly, I like walking with you more.', vi: 'Tất nhiên. Thật ra em thích đi bộ với anh hơn.' },
        { who: 'them', en: "When I run alone, I think about work. With you, I don't.", vi: 'Chạy một mình thì em nghĩ chuyện công việc. Có anh thì không.' },
        { who: 'you', en: "So I'm good medicine?", vi: 'Vậy anh là thuốc tốt à?' },
        { who: 'them', en: 'The best. Twice a day, with food.', vi: 'Tốt nhất. Ngày hai lần, dùng cùng bữa ăn.' },
      ],
    },
    {
      id: 'clinic-date-2',
      title: 'Hẹn hò lần hai: ngủ quên ở rạp',
      scene: 'Tối thứ Bảy ở rạp phim, Kim vừa trực xong ca đêm hôm trước.',
      lines: [
        { who: 'them', en: "Sorry, I worked last night. But I'm wide awake. Totally.", vi: 'Xin lỗi, đêm qua em trực. Nhưng giờ em tỉnh như sáo. Hoàn toàn.' },
        { who: 'you', en: 'Are you sure? We can do this another day.', vi: 'Chắc không? Để hôm khác cũng được mà.' },
        { who: 'them', en: 'No way. Zoe saved us the best seats.', vi: 'Không đời nào. Zoe giữ cho mình chỗ đẹp nhất rồi.' },
        { who: 'narr', vi: 'Phim chiếu được mười lăm phút, đầu Kim đã tựa lên vai bạn. Cô ngủ say.' },
        { who: 'them', en: "Did I miss the whole movie? I'm so sorry.", vi: 'Em bỏ lỡ cả bộ phim à? Em xin lỗi nhiều.' },
        { who: 'you', en: 'You missed a lot. You snore, by the way.', vi: 'Em bỏ lỡ nhiều lắm. Mà em ngáy đấy.' },
        { who: 'them', en: 'I do not! Okay, maybe a little. Doctors get tired too.', vi: 'Làm gì có! Thôi được, chắc hơi hơi. Bác sĩ cũng biết mệt chứ.' },
      ],
      choice: {
        after: 3,
        q: 'Kim ngủ gục trên vai bạn. Bạn làm gì?',
        options: [
          {
            id: 'clinic-date-2-a',
            en: "Sleep well, Kim. I've got you.",
            vi: 'Ngủ ngon nhé, Kim. Có anh đây.',
            points: 20,
            reply: [{ who: 'narr', vi: 'Kim ngủ đến hết phim, tay vẫn nắm tay bạn.' }],
          },
          {
            id: 'clinic-date-2-b',
            en: "Want to go home? I'll walk you.",
            vi: 'Em muốn về không? Anh đưa em về.',
            points: 15,
            reply: [{ who: 'them', en: 'Mm. Yes, please. Sorry, {name}.', vi: 'Ừm. Về thôi. Em xin lỗi anh, {name}.' }],
          },
          {
            id: 'clinic-date-2-c',
            en: "Kim? Kim, wake up. The movie's really good.",
            vi: 'Kim? Kim ơi, dậy đi. Phim hay lắm đấy.',
            points: 0,
            reply: [{ who: 'them', en: "Mm? I'm awake. I saw everything.", vi: 'Hửm? Em thức mà. Em xem hết rồi.' }],
          },
        ],
      },
    },
    {
      id: 'clinic-date-3',
      title: 'Hẹn hò lần ba: vườn táo',
      scene: 'Chiều nắng ở vườn cây ăn quả, Kim xách một cái giỏ to.',
      lines: [
        { who: 'them', en: 'An apple a day keeps the doctor away. But not this doctor.', vi: 'Ngày một quả táo thì khỏi gặp bác sĩ. Nhưng bác sĩ này thì không đi đâu.' },
        { who: 'you', en: "Good. I don't want this doctor to go away.", vi: 'Tốt. Anh không muốn bác sĩ này đi đâu cả.' },
        { who: 'them', en: 'Smooth. Here, hold the basket.', vi: 'Khéo miệng ghê. Đây, cầm giỏ đi.' },
        { who: 'you', en: 'Can I ask you something? Why did you become a doctor?', vi: 'Anh hỏi cái này nhé? Sao em lại làm bác sĩ?' },
        { who: 'them', en: 'My grandma. She worked at a clinic and knew everyone\'s name.', vi: 'Vì bà em. Bà làm ở phòng khám, biết tên từng người.' },
        { who: 'them', en: 'I wanted to be like her. Someone people trust.', vi: 'Em muốn được như bà. Một người ai cũng tin cậy.' },
        { who: 'you', en: 'Well, this whole town trusts you. Me too.', vi: 'Thì cả thị trấn này tin em. Cả anh nữa.' },
        { who: 'narr', vi: 'Kim cúi xuống nhặt táo, nhưng bạn vẫn kịp thấy cô đỏ mặt.' },
      ],
    },
  ],
  proposal: {
    id: 'clinic-proposal',
    title: 'Bông hướng dương ở giữa',
    scene: 'Sáng sớm trước cửa phòng khám, luống hướng dương đã nở vàng rực.',
    lines: [
      { who: 'them', en: 'They bloomed! Look how tall they are this year.', vi: 'Nở rồi! Xem năm nay cao chưa kìa.' },
      { who: 'you', en: 'Kim, look closer. The one in the middle.', vi: 'Kim, nhìn kỹ đi. Cây ở giữa ấy.' },
      { who: 'narr', vi: 'Trên cuống bông hướng dương lớn nhất có buộc một chiếc nhẫn bằng sợi ruy băng.' },
      { who: 'them', en: 'Is that a ring? {name}?', vi: 'Đó là nhẫn à? {name}?' },
      { who: 'you', en: 'You keep this town healthy. You make me happy. Will you marry me?', vi: 'Em giữ cho cả thị trấn khỏe mạnh. Em làm anh hạnh phúc. Em lấy anh nhé?' },
      { who: 'them', en: "Yes. Yes! I'm a doctor and I can't breathe.", vi: 'Có. Em đồng ý! Em là bác sĩ mà giờ thở không nổi.' },
      { who: 'you', en: 'Should I call a doctor?', vi: 'Có cần anh gọi bác sĩ không?' },
      { who: 'them', en: 'Very funny. Come here.', vi: 'Buồn cười ghê. Lại đây nào.' },
    ],
  },
  vows: {
    id: 'clinic-vows',
    title: 'Lời thề ở quảng trường',
    scene: 'Quảng trường rực hoa hướng dương, cả những bệnh nhân cũ của Kim cũng đến dự.',
    lines: [
      { who: 'them', en: "{name}, I promise to take care of you. Even when you won't drink water.", vi: '{name}, em hứa sẽ chăm sóc anh. Kể cả khi anh không chịu uống nước.' },
      { who: 'you', en: 'Kim, I promise to run with you at six. Most days.', vi: 'Kim, anh hứa sẽ chạy bộ với em lúc sáu giờ. Gần như mọi ngày.' },
      { who: 'you', en: 'And to love you, in sickness and in health.', vi: 'Và yêu em, lúc ốm đau cũng như khi khỏe mạnh.' },
      { who: 'them', en: "That's my favorite part. I love you.", vi: 'Đó là đoạn em thích nhất. Em yêu anh.' },
      { who: 'narr', vi: 'Emma mang ra một chiếc bánh chanh ba tầng. Kim không từ chối miếng nào.' },
    ],
  },
  daily: [
    {
      id: 'clinic-daily-1',
      title: 'Uống nước đi',
      scene: 'Kim đặt một chai nước to tướng trước mặt bạn.',
      lines: [
        { who: 'them', en: 'Drink your water.', vi: 'Uống nước đi anh.' },
        { who: 'you', en: "I'm drinking. See?", vi: 'Anh đang uống đây. Thấy chưa?' },
        { who: 'them', en: "That's coffee. Nice try.", vi: 'Đấy là cà phê. Khéo lừa ghê.' },
      ],
    },
    {
      id: 'clinic-daily-2',
      title: 'Sáu giờ rồi',
      scene: 'Trời còn tối, Kim đã buộc xong dây giày.',
      lines: [
        { who: 'them', en: "Six o'clock. Shoes on.", vi: 'Sáu giờ rồi. Đi giày vào.' },
        { who: 'you', en: 'Five more minutes?', vi: 'Thêm năm phút nữa thôi?' },
        { who: 'them', en: "Doctor's orders. Up you get!", vi: 'Lệnh của bác sĩ. Dậy nào!' },
      ],
    },
    {
      id: 'clinic-daily-3',
      title: 'Sau ca đêm',
      scene: 'Kim về nhà sau ca trực đêm, mắt díp lại.',
      lines: [
        { who: 'you', en: 'Long night at the clinic?', vi: 'Đêm qua ở phòng khám vất vả lắm à?' },
        { who: 'them', en: "Three colds, a broken arm, and Ben's finger.", vi: 'Ba ca cảm, một ca gãy tay, và ngón tay của Ben.' },
        { who: 'you', en: "Ben's finger? What did he do?", vi: 'Ngón tay của Ben? Anh ấy làm gì thế?' },
        { who: 'them', en: "Don't ask. Is there any tea?", vi: 'Đừng hỏi. Nhà còn trà không anh?' },
      ],
    },
    {
      id: 'clinic-daily-4',
      title: 'Cốc trà thứ sáu',
      scene: 'Kim rót thêm một cốc trà xanh, giả vờ không thấy bạn đang nhìn.',
      lines: [
        { who: 'you', en: "That's your sixth cup of green tea today.", vi: 'Cốc trà xanh thứ sáu trong hôm nay rồi đấy.' },
        { who: 'them', en: 'Fifth. Okay, sixth.', vi: 'Thứ năm. Thôi được, thứ sáu.' },
        { who: 'you', en: 'Do as I say, not as I do?', vi: 'Cứ làm theo lời em, đừng làm theo việc em à?' },
        { who: 'them', en: 'Exactly. You learn fast.', vi: 'Chính xác. Anh học nhanh đấy.' },
      ],
    },
    {
      id: 'clinic-daily-5',
      title: 'Lại mùa phấn hoa',
      scene: 'Bạn hắt hơi liền ba cái, Kim ngẩng lên khỏi cuốn sách.',
      lines: [
        { who: 'you', en: 'Achoo! Is it spring again?', vi: 'Hắt xì! Lại sang xuân rồi à?' },
        { who: 'them', en: 'Hay fever. One pill twice a day, with food.', vi: 'Dị ứng phấn hoa. Ngày hai lần, mỗi lần một viên, uống cùng bữa ăn.' },
        { who: 'you', en: 'Yes, doctor.', vi: 'Vâng, thưa bác sĩ.' },
      ],
    },
    {
      id: 'clinic-daily-6',
      title: 'Hướng dương trước cửa nhà',
      scene: 'Chiều Chủ nhật, Kim quỳ bên luống đất mới trước cửa nhà.',
      lines: [
        { who: 'them', en: 'I planted sunflowers by our door.', vi: 'Em trồng hướng dương ngay cạnh cửa nhà mình rồi.' },
        { who: 'you', en: 'Just like your grandma.', vi: 'Giống hệt bà em.' },
        { who: 'them', en: 'Just like her. Now this place really feels like home.', vi: 'Giống hệt bà. Giờ chỗ này mới thật sự là nhà.' },
      ],
    },
    {
      id: 'clinic-daily-7',
      title: 'Bữa tối của bác sĩ',
      scene: 'Kim bày lên bàn một đĩa táo cắt lát và hai lát bánh mì nướng.',
      lines: [
        { who: 'them', en: 'I made dinner!', vi: 'Em nấu bữa tối rồi này!' },
        { who: 'you', en: 'You did? What is it?', vi: 'Thật à? Món gì thế?' },
        { who: 'them', en: "Apples. And toast. I'm a doctor, not a chef.", vi: 'Táo. Với bánh mì nướng. Em là bác sĩ, đâu phải đầu bếp.' },
      ],
    },
    {
      id: 'clinic-daily-8',
      title: 'Nhảy trong bếp',
      scene: 'Radio trong bếp đang mở một bài hát vui, bạn đang đung đưa theo nhạc.',
      lines: [
        { who: 'them', en: 'Are you dancing in the kitchen?', vi: 'Anh đang nhảy trong bếp đấy à?' },
        { who: 'you', en: 'Maybe.', vi: 'Có lẽ.' },
        { who: 'them', en: 'Careful with that ankle. Actually, wait for me.', vi: 'Cẩn thận cái cổ chân đấy. À mà khoan, chờ em nhảy với.' },
      ],
    },
  ],
};
