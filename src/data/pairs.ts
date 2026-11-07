// Minimal-pair / contrast listening sets for "Phân biệt âm".
// Every item lists 2–3 natural sentences that differ only in the target sound.
// Items are chosen so that a natural voice (and TTS) produces an audible
// difference — truly homophonous pairs (e.g. "an ice" / "a nice") are excluded.

import type { Phenomenon } from '../core/types';

export interface PairItem {
  id: string; // stable, globally unique, e.g. "can-1"
  options: string[]; // 2–3 full natural sentences differing only in the target
  cue: string; // Vietnamese: how to hear the difference in this item
}

export interface PairContrast {
  written: string; // e.g. "can"
  spoken: string; // readable respelling, e.g. "kən"
}

export interface PairSet {
  id: string; // stable, e.g. "can-cant"
  title: string; // Vietnamese title (English words kept)
  description: string; // Vietnamese: which acoustic cue tells them apart
  phenomenon: Phenomenon;
  contrast: PairContrast[]; // how each side of the contrast sounds
  items: PairItem[];
}

export const PAIR_SETS: PairSet[] = [
  {
    id: 'can-cant',
    title: 'can hay can’t',
    phenomenon: 'weak-form',
    description:
      'Giọng Mỹ: "can" trong câu khẳng định không được nhấn, đọc lướt thành /kən/ — rất ngắn. "Can’t" được nhấn, nguyên âm /æ/ mở và dài hơn, còn chữ t thường bị nuốt. Đừng chờ nghe chữ t: hãy nghe độ dài và độ nhấn.',
    contrast: [
      { written: 'can', spoken: 'kən /kən/' },
      { written: "can't", spoken: 'kæn(t) /kænt/' },
    ],
    items: [
      {
        id: 'can-1',
        options: ['I can come to the party.', "I can't come to the party."],
        cue: '"ai-kən KUM" — can lướt qua, nhấn vào come. "ai KÆN(T) KUM" — cả can’t và come đều được nhấn.',
      },
      {
        id: 'can-2',
        options: ['She can drive.', "She can't drive."],
        cue: 'Với can, câu nghe như 2 nhịp "shee-kən DRAIV". Với can’t có 3 nhịp mạnh, chữ "can’t" kéo dài, miệng bè ra.',
      },
      {
        id: 'can-3',
        options: ['We can see the stage from here.', "We can't see the stage from here."],
        cue: '"wee-kən SEE" nghe như một cụm liền. "wee KÆN SEE" có một khoảng ngắt nhỏ chỗ t bị chặn.',
      },
      {
        id: 'can-4',
        options: ['You can park on this street.', "You can't park on this street."],
        cue: 'can → "kən" gần như chỉ còn âm k + ə. Can’t → "KÆN(T)", nguyên âm /æ/ rõ, được nhấn và kéo dài hơn.',
      },
      {
        id: 'can-5',
        options: ['He can speak French.', "He can't speak French."],
        cue: 'Đếm âm tiết được nhấn: "hee-kən SPEAK FRENCH" (2) và "hee KÆN SPEAK FRENCH" (3).',
      },
      {
        id: 'can-6',
        options: ['They can find the station.', "They can't find the station."],
        cue: '"they-kən FIND" — can dính vào they. "they KÆNT FIND" — can’t đứng riêng, nghe rõ hơn.',
      },
      {
        id: 'can-7',
        options: ['I can hear you.', "I can't hear you."],
        cue: '"ai-kən HEAR-yoo" so với "ai KÆN HEAR-yoo". Nguyên âm /æ/ của can’t giống "e" kéo dài, miệng mở rộng.',
      },
      {
        id: 'can-8',
        options: ['You can tell the difference.', "You can't tell the difference."],
        cue: 'Hai chữ t (can’t tell) nhập làm một, nên chỉ nghe được bằng nguyên âm: "kən" ngắn hay "kæn" dài.',
      },
    ],
  },
  {
    id: 'like-would-like',
    title: 'like hay ’d like',
    phenomenon: 'contraction',
    description:
      '"I’d like" (= I would like, muốn) và "I like" (thích) thường không phân biệt được bằng tai: âm /d/ gần như mất trước /l/, nên phải dựa vào ngữ cảnh. Vì vậy bài luyện với he/she: "likes" có đuôi /s/ nghe rõ, còn "’d like" thì không có /s/ mà có /d/ ngắn sau he/she.',
    contrast: [
      { written: 'she likes', spoken: 'shee-laiks' },
      { written: "she'd like", spoken: 'sheed-laik' },
    ],
    items: [
      {
        id: 'like-1',
        options: ['He likes to travel.', "He'd like to travel."],
        cue: '"hee LAIKS-tə" có tiếng xì /s/ trước to; "heed LAIK-tə" không có /s/.',
      },
      {
        id: 'like-2',
        options: ['She likes the blue one.', "She'd like the blue one."],
        cue: 'Nghe đuôi /s/ trước the: "shee LAIKS-thə" so với "sheed LAIK-thə".',
      },
      {
        id: 'like-3',
        options: ['She likes to dance.', "She'd like to dance."],
        cue: 'Nghe đuôi /s/: "shee LAIKS-tə" có tiếng xì. "sheed LAIK-tə" không có /s/ mà có /d/ sau she.',
      },
      {
        id: 'like-4',
        options: ['He likes his coffee black.', "He'd like his coffee black."],
        cue: '"likes his" → "LAIK-siz" (s nối sang his đã mất h). "He’d like his" → "heed LAI-kiz", không có tiếng xì /s/ sau like.',
      },
      {
        id: 'like-5',
        options: ['I think he likes it.', "I think he'd like it."],
        cue: '"hee LAIK-sit" (s nối vào it) so với "heed LAI-kit" (k nối thẳng vào it, không có /s/).',
      },
      {
        id: 'like-6',
        options: ['Do you like the soup?', 'Would you like the soup?', 'Did you like the soup?'],
        cue: 'Nghe phần đầu câu: do you → "dyə", would you → "wudja", did you → "didja". Would có âm w mở đầu, did có hai âm d.',
      },
      {
        id: 'like-7',
        options: ['She likes to sit outside.', "She'd like to sit outside."],
        cue: '"LAIKS-tə" có /s/; "’d like to" chỉ còn "LAIK-tə".',
      },
    ],
  },
  {
    id: 'walk-walked',
    title: 'walk hay walked',
    phenomenon: 'elision',
    description:
      'Đuôi -ed (/t/, /d/) rất dễ mất. Trước phụ âm nó gần như biến mất; trước nguyên âm nó nối sang từ sau ("walked along" → "wal-kt-ə-long"). Hãy nghe âm t/d dính vào từ kế tiếp, hoặc âm tiết /ɪd/ thêm vào sau t, d.',
    contrast: [
      { written: 'walk along', spoken: 'wo-kə-long' },
      { written: 'walked along', spoken: 'wok-tə-long' },
    ],
    items: [
      {
        id: 'walk-1',
        options: ['I walked along the river.', 'I walk along the river.'],
        cue: '"wok-tə-long" — /t/ của -ed nối sang along. Không có -ed thì là "wo-kə-long".',
      },
      {
        id: 'walk-2',
        options: ['We played a game.', 'We play a game.'],
        cue: '"plei-də game" — /d/ dính vào a, nghe như "đơ". Thời hiện tại: "play-yə game", nối bằng âm y nhẹ.',
      },
      {
        id: 'walk-3',
        options: ['They opened it.', 'They open it.'],
        cue: '"oh-pən-dit" có âm d trước it. "oh-pə-nit" thì n nối thẳng vào it.',
      },
      {
        id: 'walk-4',
        options: ['I asked about it.', 'I ask about it.'],
        cue: '"as-ktə-bau-dit" có cụm "kt" nghe rõ trước about. "as-kə-bau-dit" thì không có /t/.',
      },
      {
        id: 'walk-5',
        options: ['We cleaned up the kitchen.', 'We clean up the kitchen.'],
        cue: '"cleen-dup" so với "clee-nup": âm d của -ed chen vào giữa clean và up.',
      },
      {
        id: 'walk-6',
        options: ['I called him every day.', 'I call him every day.'],
        cue: 'him mất h nên nối vào động từ: "cal-dim" (có d) so với "cal-lim" (không có d).',
      },
      {
        id: 'walk-7',
        options: ['They needed it.', 'They need it.'],
        cue: 'Sau âm d, -ed thành thêm một âm tiết /ɪd/: "nee-di-dit" (3 nhịp) so với "nee-dit" (2 nhịp).',
      },
      {
        id: 'walk-8',
        options: ['We watched a movie.', 'We watch a movie.'],
        cue: '"wat-chtə-MOO-vi" — đuôi -ed (/t/) nối sang a. Không có -ed thì là "wat-chə-MOO-vi". (Trước phụ âm như "the", /t/ này thường mất hẳn — nên bài chỉ dùng câu có nguyên âm theo sau.)',
      },
    ],
  },
  {
    id: 'want-wanted',
    title: 'want to hay wanted to',
    phenomenon: 'reduction',
    description:
      '"want to" bị rút gọn thành "wanna" (2 âm tiết). "wanted to" có thêm một âm tiết: giọng Mỹ bỏ t sau n nên nghe như "wa-nid-tə" (3 âm tiết). Hãy đếm số nhịp giữa chủ ngữ và động từ chính.',
    contrast: [
      { written: 'want to', spoken: 'wanna' },
      { written: 'wanted to', spoken: 'wa-nid-tə' },
    ],
    items: [
      {
        id: 'want-1',
        options: ['I want to call her.', 'I wanted to call her.'],
        cue: '"ai-wanna CALL-ər" so với "ai-wa-nid-tə CALL-ər": wanted dài hơn một nhịp.',
      },
      {
        id: 'want-2',
        options: ['We want to stay longer.', 'We wanted to stay longer.'],
        cue: 'wanna nghe gọn như một từ; wanted to có âm "-nid" ở giữa.',
      },
      {
        id: 'want-3',
        options: ['They want to see you.', 'They wanted to see you.'],
        cue: '"they-wanna SEE-yə" so với "they-wa-nid-tə SEE-yə".',
      },
      {
        id: 'want-4',
        options: ['I want to ask you something.', 'I wanted to ask you something.'],
        cue: 'Trước nguyên âm, "to" gần như chỉ còn ə: "wanna-ask" so với "wa-nid-tə-ask".',
      },
      {
        id: 'want-5',
        options: ['I want to go home.', 'I wanted to go home.'],
        cue: '"ai-wanna-GO" (want to gọn thành 2 âm tiết) so với "ai-wa-nid-tə-GO" (thêm âm "nid").',
      },
      {
        id: 'want-6',
        options: ['She wants to leave.', 'She wanted to leave.'],
        cue: 'wants to → "wants-tə" (wantsta, có âm s rồi mới tới t), wanted to → "wa-nid-tə" (có âm "nid").',
      },
      {
        id: 'want-7',
        options: ['They want to buy a house.', 'They wanted to buy a house.'],
        cue: '"they-wanna-BUY" so với "they-wa-nid-tə-BUY" — nghe chuỗi âm nhỏ trước "buy".',
      },
      {
        id: 'want-8',
        options: ['We want to try again.', 'We wanted to try again.'],
        cue: 'Đếm nhịp: "wee-WAN-nə-TRY" (4) so với "wee-WA-nid-tə-TRY" (5).',
      },
    ],
  },
  {
    id: 'were-we-were',
    title: 'we’re hay we were',
    phenomenon: 'contraction',
    description:
      '"We’re / you’re / they’re" chỉ là một âm tiết ("wir", "yər", "thər"). "We were" có thêm âm tiết "wər" — nghe như tiếng "ơ" có môi tròn ở giữa. Hiện tại hay quá khứ đổi nghĩa cả câu.',
    contrast: [
      { written: "we're", spoken: 'wir' },
      { written: 'we were', spoken: 'wee-wər' },
    ],
    items: [
      {
        id: 'were-1',
        options: ["We're ready.", 'We were ready.'],
        cue: '"wir RE-di" (2 nhịp đầu) so với "wee-wər RE-di" — nghe âm w thứ hai.',
      },
      {
        id: 'were-2',
        options: ["We're at home.", 'We were at home.'],
        cue: '"wi-rət-HOME" so với "wee-wə-rət-HOME": were nối r vào at.',
      },
      {
        id: 'were-3',
        options: ["They're late again.", 'They were late again.'],
        cue: '"thər-LATE" so với "they-wər-LATE": they were có thêm âm "wər".',
      },
      {
        id: 'were-4',
        options: ["You're right.", 'You were right.'],
        cue: '"yər-RIGHT" chỉ một nhịp trước right; "yoo-wər-RIGHT" có hai.',
      },
      {
        id: 'were-5',
        options: ["We're getting close.", 'We were getting close.'],
        cue: '"wir-ge-ding" so với "wee-wər-ge-ding" (t trong getting bật thành d nhẹ ở cả hai).',
      },
      {
        id: 'were-6',
        options: ["They're in the car.", 'They were in the car.'],
        cue: '"thə-rin-thə" so với "they-wə-rin-thə": nghe âm w trước "rin".',
      },
      {
        id: 'were-7',
        options: ["You're on the list.", 'You were on the list.'],
        cue: '"yə-ron" so với "yoo-wə-ron" — you were dài hơn hẳn.',
      },
    ],
  },
  {
    id: 'its-it-was',
    title: 'it’s hay it was',
    phenomenon: 'contraction',
    description:
      '"It’s / that’s / what’s" chỉ còn âm /s/ dính vào từ trước. "It was" có thêm âm tiết yếu "wəz" (môi tròn, kết thúc bằng /z/). Nghe xem có âm w sau it hay không.',
    contrast: [
      { written: "it's", spoken: 'its' },
      { written: 'it was', spoken: 'i-wəz / it-wəz' },
    ],
    items: [
      {
        id: 'its-1',
        options: ["It's cold outside.", 'It was cold outside.'],
        cue: '"its-COLD" so với "it-wəz-COLD": was chen một âm tiết vào trước cold.',
      },
      {
        id: 'its-2',
        options: ["It's a good idea.", 'It was a good idea.'],
        cue: '"it-sə-GOOD" so với "it-wə-zə-GOOD": was nối z vào a.',
      },
      {
        id: 'its-3',
        options: ["It's easy.", 'It was easy.'],
        cue: '"it-SEE-zi" (s nối vào easy) so với "it-wə-ZEE-zi".',
      },
      {
        id: 'its-4',
        options: ["It's my fault.", 'It was my fault.'],
        cue: '"its-my" so với "it-wəz-my": nghe âm w tròn môi.',
      },
      {
        id: 'its-5',
        options: ["That's the problem.", 'That was the problem.'],
        cue: '"thats-thə" so với "that-wəz-thə": that was dài hơn một nhịp.',
      },
      {
        id: 'its-6',
        options: ["It's fun.", 'It was fun.'],
        cue: 'Câu ngắn nên dễ nghe: "its-FUN" (2 nhịp) so với "it-wəz-FUN" (3 nhịp).',
      },
      {
        id: 'its-7',
        options: ["What's the name?", 'What was the name?'],
        cue: '"whats-thə" so với "what-wəz-thə" (what was nói nhanh nghe như "wha-wəz").',
      },
      {
        id: 'its-8',
        options: ["It's open.", 'It was open.'],
        cue: '"it-SOH-pən" so với "it-wə-ZOH-pən": was nối z vào open.',
      },
    ],
  },
  {
    id: 'ill-i',
    title: 'I’ll hay I (và I’d)',
    phenomenon: 'contraction',
    description:
      '"I’ll / we’ll / they’ll" kết thúc bằng âm L "tối" /ɫ/ — cuống lưỡi nâng lên, nghe trầm như "ư" ngắn: "al", "wil". Trước nguyên âm, L nối hẳn sang từ sau nên rất dễ nghe. Không có ’ll thì là hiện tại đơn. "I’d" thay L bằng một âm d nối vào nguyên âm sau.',
    contrast: [
      { written: "I'll", spoken: 'al /aɪɫ ~ aɫ/' },
      { written: 'I', spoken: 'ai' },
      { written: "I'd", spoken: "I'd /aɪd/" },
    ],
    items: [
      {
        id: 'ill-1',
        options: ["I'll take the bus.", 'I take the bus.'],
        cue: 'I’ll → "al-TAKE": có âm L trầm (như "ư") trước take. I → "ai-TAKE": trượt thẳng, không có gì chen vào.',
      },
      {
        id: 'ill-2',
        options: ["We'll walk to school.", 'We walk to school.'],
        cue: '"wil-WALK" có âm L trầm trước walk (nghe gần như "wiư-walk"); "wee-WALK" thì không.',
      },
      {
        id: 'ill-3',
        options: ["They'll eat at home.", 'They eat at home.'],
        cue: 'L nối sang nguyên âm: "they-leet" (they’ll eat) so với "they-yeet" (they eat, nối bằng y).',
      },
      {
        id: 'ill-4',
        options: ["I'll open the window.", 'I open the window.', "I'd open the window."],
        cue: '"a-loh-pən" (L nối vào open) — "ai-yoh-pən" (nối bằng y) — "ai-doh-pən" (d nối vào open).',
      },
      {
        id: 'ill-5',
        options: ["You'll understand.", 'You understand.'],
        cue: '"yoo-lun-dər-STAND" (L của you’ll nối vào understand) so với "yoo-wun-dər-STAND" (nối bằng w nhẹ).',
      },
      {
        id: 'ill-6',
        options: ["We'll ask him.", 'We ask him.'],
        cue: '"wi-las-kim" (L nối vào ask) so với "wee-yas-kim".',
      },
      {
        id: 'ill-7',
        options: ["They'll know.", 'They know.'],
        cue: 'Câu rất ngắn: "theil-NOH" có âm L trầm trước know; "they-NOH" thì không.',
      },
      {
        id: 'ill-8',
        options: ["I'll always help you.", 'I always help you.'],
        cue: '"a-lol-weiz" (L nối sang always) so với "ai-yol-weiz".',
      },
    ],
  },
  {
    id: 'hes-he-was',
    title: 'he’s hay he was',
    phenomenon: 'contraction',
    description:
      '"He’s / she’s" chỉ thêm âm /z/ ("heez", "sheez"). "He was" thêm âm tiết "wəz". Nghe xem sau he/she là tiếng "z" ngắn hay một âm tiết có w tròn môi.',
    contrast: [
      { written: "he's", spoken: 'heez' },
      { written: 'he was', spoken: 'hee-wəz' },
    ],
    items: [
      {
        id: 'hes-1',
        options: ["He's busy.", 'He was busy.'],
        cue: '"heez-BI-zi" so với "hee-wəz-BI-zi".',
      },
      {
        id: 'hes-2',
        options: ["She's at work.", 'She was at work.'],
        cue: '"shee-zət-WORK" so với "shee-wə-zət-WORK": nghe âm w.',
      },
      {
        id: 'hes-3',
        options: ["He's angry with me.", 'He was angry with me.'],
        cue: '"hee-ZAN-gri" (z nối vào angry) so với "hee-wə-ZAN-gri".',
      },
      {
        id: 'hes-4',
        options: ["She's a nurse.", 'She was a nurse.'],
        cue: '"shee-zə-NURSE" so với "shee-wə-zə-NURSE".',
      },
      {
        id: 'hes-5',
        options: ["He's in the kitchen.", 'He was in the kitchen.'],
        cue: '"hee-zin-thə" so với "hee-wə-zin-thə".',
      },
      {
        id: 'hes-6',
        options: ["She's tired.", 'She was tired.'],
        cue: '"sheez-TIRED" (2 nhịp) so với "shee-wəz-TIRED" (3 nhịp).',
      },
      {
        id: 'hes-7',
        options: ["He's finished.", 'He was finished.', 'He finished.'],
        cue: 'He’s → "heez-FI" có /z/; he was → "hee-wəz-FI" có w; he finished → "hee-FI" sạch, không có gì chen vào.',
      },
    ],
  },
  {
    id: 'him-them',
    title: 'him, her hay them',
    phenomenon: 'h-dropping',
    description:
      'Khi không nhấn, him mất h thành "im", her thành "ər", và them sau phụ âm cũng mất th thành "əm": "tel-lim", "tel-lər", "tel-ləm". Nghe nguyên âm: i ngắn (him), ơ cong lưỡi có r (her), ơ + m (them). Sau nguyên âm, them còn giữ th: "saw-thəm".',
    contrast: [
      { written: 'tell him', spoken: 'tel-lim' },
      { written: 'tell her', spoken: 'tel-lər' },
      { written: 'tell them', spoken: 'tel-ləm' },
    ],
    items: [
      {
        id: 'him-1',
        options: ["Tell him I'm late.", "Tell her I'm late.", "Tell them I'm late."],
        cue: '"tel-lim" (i ngắn) — "tel-lər" (cong lưỡi, r cuối) — "tel-ləm" (ơ + m)',
      },
      {
        id: 'him-2',
        options: ['Ask him about it.', 'Ask her about it.', 'Ask them about it.'],
        cue: '"as-ki-mə-bau" — "as-kə-rə-bau" — "as-kə-mə-bau"',
      },
      {
        id: 'him-3',
        options: ['I saw him yesterday.', 'I saw them yesterday.'],
        cue: '"saw-wim" so với "saw-thəm": them thường giữ âm th sau nguyên âm.',
      },
      {
        id: 'him-4',
        options: ['Give him the keys.', 'Give them the keys.'],
        cue: '"gi-vim-thə" so với "gi-vəm-thə" (i hay ơ)',
      },
      {
        id: 'him-5',
        options: ['Call him later.', 'Call her later.'],
        cue: '"cal-lim" (kết thúc bằng m) so với "cal-lər" (kết thúc bằng r, không có m).',
      },
      {
        id: 'him-6',
        options: ['Let him know.', 'Let them know.'],
        cue: '"le-dim-NOH" so với "le-dəm-NOH" (i hay ơ)',
      },
      {
        id: 'him-7',
        options: ["I'll help him.", "I'll help them."],
        cue: '"hel-pim" so với "hel-pəm"',
      },
      {
        id: 'him-8',
        options: ['We met him at the station.', 'We met her at the station.', 'We met them at the station.'],
        cue: '"me-di-mət" — "me-də-rət" — "me-də-mət"',
      },
    ],
  },
  {
    id: 'should-shouldve',
    title: 'should hay should’ve',
    phenomenon: 'reduction',
    description:
      '"should have / could have / would have" bị rút thành "shoulda / coulda / woulda" — chỉ thêm một âm ə rất nhẹ (đôi khi có v). "Should" trơn thì không có âm đó. Nghe xem sau should có một âm "ơ" nhỏ chen vào không.',
    contrast: [
      { written: 'should', spoken: 'shud' },
      { written: "should've", spoken: 'shu-də / shu-dəv' },
    ],
    items: [
      {
        id: 'should-1',
        options: ['You should come.', "You should've come."],
        cue: '"yə-shud-COME" so với "yə-shu-də-COME": nghe âm ə nhỏ trước come.',
      },
      {
        id: 'should-2',
        options: ['We should put it here.', "We should've put it here."],
        cue: '"shud-PUT" so với "shu-də-PUT" (hoặc "shu-dəv-put").',
      },
      {
        id: 'should-3',
        options: ['I should read it.', "I should've read it."],
        cue: 'Thêm manh mối: read hiện tại là "reed", quá khứ là "red". "shud-REE-dit" so với "shu-də-RE-dit".',
      },
      {
        id: 'should-4',
        options: ['They should cut the price.', "They should've cut the price."],
        cue: '"shud-CUT" so với "shu-dəv-CUT": should’ve dài hơn một nhịp yếu.',
      },
      {
        id: 'should-5',
        options: ['You could come with us.', "You could've come with us."],
        cue: '"kud-COME" so với "ku-də-COME" (coulda).',
      },
      {
        id: 'should-6',
        options: ['She should let him go.', "She should've let him go."],
        cue: '"shud-LET" so với "shu-də-LET": nghe âm ơ nhẹ chen giữa.',
      },
      {
        id: 'should-7',
        options: ['We should set a reminder.', "We should've set a reminder."],
        cue: '"shud-SET" so với "shu-dəv-SET" — âm v có khi còn, có khi mất.',
      },
      {
        id: 'should-8',
        options: ['I would quit.', "I would've quit."],
        cue: '"ai-wud-QUIT" so với "ai-wu-də-QUIT" (woulda).',
      },
    ],
  },
  {
    id: 'ive-i',
    title: 'I’ve hay I',
    phenomenon: 'contraction',
    description:
      '"I’ve / we’ve / they’ve" chỉ thêm âm /v/ rất nhẹ. Trước nguyên âm, /v/ nối sang từ sau nên nghe được ("I’ve asked" → "ai-vasked"). Trước phụ âm (như "I’ve got" / "I got") /v/ gần như mất hẳn, nên bộ này chọn các câu có nguyên âm theo sau.',
    contrast: [
      { written: "I've asked", spoken: 'ai-vaskt' },
      { written: 'I asked', spoken: 'ai-yaskt' },
    ],
    items: [
      {
        id: 'ive-1',
        options: ["I've asked her twice.", 'I asked her twice.'],
        cue: '"ai-VASK-tər" (v nối vào asked) so với "ai-YASK-tər" (nối bằng y).',
      },
      {
        id: 'ive-2',
        options: ["We've ordered pizza.", 'We ordered pizza.'],
        cue: '"wee-VOR-dərd" so với "wee-YOR-dərd": nghe âm v rung môi.',
      },
      {
        id: 'ive-3',
        options: ["They've opened a new shop.", 'They opened a new shop.'],
        cue: '"thei-VOH-pənd" so với "they-YOH-pənd".',
      },
      {
        id: 'ive-4',
        options: ["I've always liked it.", 'I always liked it.'],
        cue: '"ai-VOL-weiz" so với "ai-YOL-weiz".',
      },
      {
        id: 'ive-5',
        options: ["You've answered the question.", 'You answered the question.'],
        cue: '"yoo-VAN-sərd" so với "yoo-WAN-sərd": v (răng chạm môi) khác w (tròn môi).',
      },
      {
        id: 'ive-6',
        options: ["We've invited everyone.", 'We invited everyone.'],
        cue: '"wee-vin-VAI-did" so với "wee-yin-VAI-did".',
      },
      {
        id: 'ive-7',
        options: ["They've added more seats.", 'They added more seats.'],
        cue: '"thei-VA-did" so với "they-YA-did".',
      },
    ],
  },
  {
    id: 'teen-ty',
    title: 'thirteen hay thirty',
    phenomenon: 'flap-t',
    description:
      'Đứng cuối câu, số -teen nhấn ở cuối: thir-TEEN; số -ty nhấn ở đầu: THIR-dy. Nhưng trước danh từ (thirteen dollars) trọng âm của -teen hay dời lên đầu, nên đừng chỉ dựa vào trọng âm. Dấu hiệu chắc chắn hơn là phần đuôi: -teen có /t/ bật hơi rõ, "ee" dài và kết thúc bằng n; -ty có /t/ bật thành d nhẹ (THIR-dy, FOR-dy, EI-dy) hoặc mất hẳn sau n (SEV-ən-ny, NAI-ny), "y" ngắn và không có n.',
    contrast: [
      { written: 'thirteen', spoken: 'thir-TEEN' },
      { written: 'thirty', spoken: 'THIR-dy' },
    ],
    items: [
      {
        id: 'teen-1',
        options: ['It costs thirteen dollars.', 'It costs thirty dollars.'],
        cue: 'Trước "dollars", trọng âm có thể giống nhau, nên nghe đuôi: "thir-TEEN" (t bật hơi, ee dài, có n) so với "THIR-dy" (d nhẹ, y ngắn, không có n).',
      },
      {
        id: 'teen-2',
        options: ["She's fourteen.", "She's forty."],
        cue: '"four-TEEN" nhấn cuối; "FOR-dy" nhấn đầu, t bật thành d.',
      },
      {
        id: 'teen-3',
        options: ['The train leaves in fifteen minutes.', 'The train leaves in fifty minutes.'],
        cue: 'fifty không bật t (đứng sau f) nên hãy nghe đuôi: "fif-TEEN" (ee dài, kết thúc bằng n) so với "FIF-ty" (y ngắn, không có n).',
      },
      {
        id: 'teen-4',
        options: ['There were sixteen people.', 'There were sixty people.'],
        cue: '"six-TEEN" (ee dài, có n trước people) so với "SIX-ty" (y ngắn, nhấn đầu, không có n).',
      },
      {
        id: 'teen-5',
        options: ["He's seventeen.", "He's seventy."],
        cue: '"sev-ən-TEEN" có t rõ; "SEV-ən-ny" gần như mất t sau n (giọng Mỹ).',
      },
      {
        id: 'teen-6',
        options: ['Turn to page eighteen.', 'Turn to page eighty.'],
        cue: '"ei-TEEN" so với "EI-di": eighty bật t thành d nhẹ.',
      },
      {
        id: 'teen-7',
        options: ['I paid nineteen dollars.', 'I paid ninety dollars.'],
        cue: '"nain-TEEN" (t rõ, có n) so với "NAI-ny" (ninety thường mất t, nghe như "nai-ni").',
      },
      {
        id: 'teen-8',
        options: ['It was thirteen degrees.', 'It was thirty degrees.'],
        cue: 'Trước một từ có nhấn (degrees), -teen vẫn giữ /t/ rõ: "thir-teen" — còn "THIR-dy" thì mềm hẳn.',
      },
    ],
  },
  {
    id: 'theres-there-was',
    title: 'there’s hay there was',
    phenomenon: 'contraction',
    description:
      '"There’s" chỉ là một âm tiết "therz", nối /z/ vào từ sau. "There was" có thêm "wəz". Câu nói nhanh nên chỉ một âm w nhỏ quyết định hiện tại hay quá khứ.',
    contrast: [
      { written: "there's", spoken: 'therz' },
      { written: 'there was', spoken: 'ther-wəz' },
    ],
    items: [
      {
        id: 'theres-1',
        options: ["There's a problem.", 'There was a problem.'],
        cue: '"ther-zə-PROB" so với "ther-wə-zə-PROB".',
      },
      {
        id: 'theres-2',
        options: ["There's someone at the door.", 'There was someone at the door.'],
        cue: '"therz-SOME" so với "ther-wəz-SOME": nghe âm "wə" tròn môi chen vào giữa there và someone.',
      },
      {
        id: 'theres-3',
        options: ["There's no time.", 'There was no time.'],
        cue: '"therz-NO" so với "ther-wəz-NO".',
      },
      {
        id: 'theres-4',
        options: ["There's a lot of traffic.", 'There was a lot of traffic.'],
        cue: '"ther-zə-LOTTA" so với "ther-wə-zə-LOTTA" (a lot of → "ə lotta").',
      },
      {
        id: 'theres-5',
        options: ["There's nothing left.", 'There was nothing left.'],
        cue: '"therz-NOTH-ing" (2 nhịp đầu) so với "ther-wəz-NOTH-ing" (3 nhịp).',
      },
      {
        id: 'theres-6',
        options: ["There's a bus at six.", 'There was a bus at six.'],
        cue: '"ther-zə-BUS" so với "ther-wə-zə-BUS".',
      },
      {
        id: 'theres-7',
        options: ["There's an easy way.", 'There was an easy way.'],
        cue: '"ther-zə-nee-zi" so với "ther-wə-zə-nee-zi": nghe âm w.',
      },
    ],
  },
  {
    id: 'he-it',
    title: 'did he hay did it',
    phenomenon: 'h-dropping',
    description:
      'Trong câu hỏi, he mất h và dính vào động từ: "did he" → "di-dee", "is he" → "i-zee". "It" có nguyên âm ngắn /ɪ/ và /t/ bị chặn: "di-di(t)", "i-zi(t)". Nghe nguyên âm: "ee" dài (he) hay "i" ngắn cụt (it). Giọng đọc chậm có thể vẫn giữ âm h của he — khi đó càng dễ nhận ra.',
    contrast: [
      { written: 'did he', spoken: 'di-dee' },
      { written: 'did it', spoken: 'di-di(t)' },
    ],
    items: [
      {
        id: 'heit-1',
        options: ['Did he help?', 'Did it help?'],
        cue: '"di-dee-HELP" (ee dài) so với "di-di(t)-HELP" (i ngắn, có chỗ chặn).',
      },
      {
        id: 'heit-2',
        options: ['Is he ready?', 'Is it ready?'],
        cue: '"i-zee-RE-di" so với "i-zi(t)-RE-di".',
      },
      {
        id: 'heit-3',
        options: ['Was he good?', 'Was it good?'],
        cue: '"wə-zee-GOOD" so với "wə-zi(t)-GOOD".',
      },
      {
        id: 'heit-4',
        options: ['Does he work here?', 'Does it work here?'],
        cue: '"də-zee-WORK" so với "də-zi(t)-WORK".',
      },
      {
        id: 'heit-5',
        options: ['Has he started?', 'Has it started?'],
        cue: '"hə-zee-STAR-did" so với "hə-zit-STAR-did": t của it gặp s nên còn nghe được.',
      },
      {
        id: 'heit-6',
        options: ['Can he wait?', 'Can it wait?'],
        cue: '"kə-nee-WAIT" so với "kə-ni(t)-WAIT".',
      },
      {
        id: 'heit-7',
        options: ['Did he stop?', 'Did it stop?'],
        cue: '"di-dee-STOP" so với "di-dit-STOP".',
      },
      {
        id: 'heit-8',
        options: ['Will he fit?', 'Will it fit?'],
        cue: '"wə-lee-FIT" so với "wə-li(t)-FIT".',
      },
    ],
  },
  {
    id: 'do-did-you',
    title: 'do you, did you, would you',
    phenomenon: 'assimilation',
    description:
      'Khi nói nhanh, d + you biến thành "dj" (như "gi" tiếng Việt): did you → "didja", would you → "wudja", could you → "cudja". "Do you" chỉ còn "dyə". Nghe phụ âm đầu (w, k, d) và số âm tiết.',
    contrast: [
      { written: 'do you', spoken: 'dyə' },
      { written: 'did you', spoken: 'didja' },
      { written: 'would you', spoken: 'wudja' },
    ],
    items: [
      {
        id: 'dyou-1',
        options: ['Do you know her?', 'Did you know her?', 'Would you know her?'],
        cue: '"dyə-NOH-ər" (do you rất ngắn, một nhịp) — "didja-NOH-ər" (hai nhịp, có "dj") — "wudja-NOH-ər" (mở đầu bằng w tròn môi).',
      },
      {
        id: 'dyou-2',
        options: ['Do you need help?', 'Did you need help?'],
        cue: '"dyə-NEED" so với "didja-NEED": did you dài hơn và có âm "dj".',
      },
      {
        id: 'dyou-3',
        options: ['What do you want?', 'What did you want?'],
        cue: '"whaddaya-WANT" so với "whaddidja-WANT".',
      },
      {
        id: 'dyou-4',
        options: ['Where do you work?', 'Where did you work?'],
        cue: '"wher-də-yə" so với "wheredja": nghe âm "dj".',
      },
      {
        id: 'dyou-5',
        options: ['Do you eat meat?', 'Did you eat meat?'],
        cue: '"dyə-WEET" (you nối w vào eat) so với "didja-WEET".',
      },
      {
        id: 'dyou-6',
        options: ['Could you open it?', 'Would you open it?'],
        cue: 'Cả hai đều có "dj": "cudja" (mở đầu bằng k, bật hơi) so với "wudja" (mở đầu bằng w, tròn môi).',
      },
      {
        id: 'dyou-7',
        options: ['Do you see it?', 'Did you see it?'],
        cue: '"dyə-SEE-yit" so với "didja-SEE-yit".',
      },
    ],
  },
  {
    id: 'an-the',
    title: 'an hay the',
    phenomenon: 'linking',
    description:
      'Trước nguyên âm, "an" nối âm n sang từ sau: "an apple" → "ə-na-pəl". "The" đọc thành "thi" và nối bằng âm y nhẹ: "the apple" → "thee-ya-pəl". Nghe xem nguyên âm được nối bằng n hay bằng y.',
    contrast: [
      { written: 'an apple', spoken: 'ə-na-pəl' },
      { written: 'the apple', spoken: 'thee-ya-pəl' },
    ],
    items: [
      {
        id: 'anthe-1',
        options: ['Grab an apple.', 'Grab the apple.'],
        cue: '"gra-bə-NA-pəl" (b và n đều nối) so với "grab-thee-YA-pəl".',
      },
      {
        id: 'anthe-2',
        options: ['We need an umbrella.', 'We need the umbrella.'],
        cue: '"nee-də-nəm-BREL-lə" so với "need-thee-yəm-BREL-lə".',
      },
      {
        id: 'anthe-3',
        options: ['She found an empty seat.', 'She found the empty seat.'],
        cue: '"faun-də-NEMP-ti" so với "faund-thee-YEMP-ti".',
      },
      {
        id: 'anthe-4',
        options: ['Open an account.', 'Open the account.'],
        cue: '"oh-pə-nə-nə-KAUNT" (nhiều âm n nối liền) so với "oh-pən-thee-yə-KAUNT".',
      },
      {
        id: 'anthe-5',
        options: ["He's an actor.", "He's the actor."],
        cue: '"hee-zə-NAK-tər" so với "heez-thee-YAK-tər".',
      },
      {
        id: 'anthe-6',
        options: ['I had an idea.', 'I had the idea.'],
        cue: '"ha-də-nai-DEE-ə" so với "had-thee-yai-DEE-ə".',
      },
      {
        id: 'anthe-7',
        options: ['Pick an answer.', 'Pick the answer.'],
        cue: '"pi-kə-NAN-sər" so với "pick-thee-YAN-sər".',
      },
    ],
  },
];

/** Total number of items across all sets. */
export const PAIR_ITEM_COUNT = PAIR_SETS.reduce((n, s) => n + s.items.length, 0);
