// Course "connected" (Nghe nối âm) of the "Bài học" module, and the lesson catalogue of ALL courses.
// Every lesson here TEACHES one connected-speech phenomenon (sections of blocks), then checks
// understanding with an 8-item quiz. The other courses live in src/data/courses/*.ts.
//
// Types: src/data/lessonTypes.ts (re-exported here). Authoring guide: docs/courses.md.
import { lessonsInCourse, sortLessons } from '../core/lessons';
import { COURSES, type CourseMeta } from './courses';
import { IRREGULAR_LESSONS } from './courses/irregular';
import { LOANWORDS_LESSONS } from './courses/loanwords';
import { SPELLING_LESSONS } from './courses/spelling';
import type { Lesson } from './lessonTypes';

export type {
  ChooseItem,
  CourseId,
  CourseMeta,
  Lesson,
  LessonBlock,
  LessonExample,
  LessonMeta,
  LessonSection,
  ListenChooseItem,
  ListenTypeItem,
  QuizItem,
  SilentLetterItem,
  SpotItem,
  WhichRuleItem,
  WordItem,
} from './lessonTypes';

// ---------------------------------------------------------------------------
// 1. Intro
// ---------------------------------------------------------------------------

const intro: Lesson = {
  id: 'intro',
  order: 1,
  course: 'connected',
  title: 'Vì sao bạn nghe không ra người bản xứ?',
  summary: 'Chữ viết khác lời nói: nhịp nhấn, từ đọc lướt, từ dính nhau.',
  phenomenon: null,
  minutes: 8,
  goal: 'Hiểu vì sao tai bạn "bắt" không kịp và lộ trình học trong ứng dụng.',
  sections: [
    {
      title: 'Chữ viết không giống lời nói',
      blocks: [
        {
          type: 'text',
          md: 'Khi đọc, bạn thấy từng từ được tách rời bằng khoảng trắng. Nhưng khi nói, người Mỹ **không dừng giữa các từ**. Họ nói theo **cụm**, và trong cụm đó các từ dính vào nhau, rút ngắn, thậm chí mất hẳn vài âm.\n\nVí dụ câu **What do you want to do?** nghe gần như **whaddaya wanna do**. Bạn biết hết các từ, nhưng tai không nhận ra vì âm thanh không giống "bản đọc từng từ" mà bạn đã học.',
        },
        {
          type: 'examples',
          title: 'Nghe thử: biết hết từ mà vẫn không nghe ra',
          items: [
            { text: 'What do you want to do?', say: 'Whaddaya wanna do?', note: '6 từ, nhưng nghe như 3 khối âm.' },
            { text: "I'm going to get a cup of coffee.", say: "I'm gonna geda cuppa coffee.", note: 'going to → gonna, cup of → cu-pə.' },
            { text: 'Tell him I\'ll call him back.', say: "Tellim I'll callim back.", note: 'Âm /h/ của him biến mất.' },
            { text: 'Put it on the table.', say: 'Puddid on the table.', note: 'T giữa hai nguyên âm đọc giống /d/.' },
            { text: "I don't know what to say.", say: 'I dunno whatta say.', note: "don't know → dunno." },
            { text: 'Did you eat yet?', say: 'Didja eat yet?', note: 'did you → didja, eat yet → ee-chet.' },
          ],
        },
      ],
    },
    {
      title: 'Thói quen tiếng Việt làm khó tai bạn',
      blocks: [
        {
          type: 'text',
          md: 'Tiếng Việt là ngôn ngữ **đơn âm tiết**: mỗi tiếng đọc tách riêng, có thanh điệu riêng. Hai điểm làm người Việt nghe tiếng Anh khó:\n\n- **Ranh giới từ luôn rõ.** Trong "ăn uống", ta ngắt nhẹ trước "uống". Tiếng Anh thì ngược lại: phụ âm cuối của từ trước **chuyển sang** đầu từ sau (turn it off → tur-ni-doff).\n- **Phụ âm cuối không bật ra.** Chữ "t" trong "hát" chỉ khép lưỡi, không bật hơi. Vì vậy tai ta quen bỏ qua phụ âm cuối, trong khi tiếng Anh dùng chính phụ âm đó để nối sang từ sau.\n\nKết quả: bạn chờ nghe từng từ rõ ràng, nhưng người bản xứ đưa cho bạn một **chuỗi âm liền**. Tai bạn không tìm được chỗ cắt.',
        },
        {
          type: 'rule',
          title: 'Tiếng Anh nhịp theo trọng âm',
          body: '**Từ nội dung** (danh từ, động từ chính, tính từ, trạng từ, từ để hỏi, not) được **nhấn**: to, rõ, dài. **Từ chức năng** (a, the, to, of, and, can, for, him, you…) bị **đọc lướt**, thường chỉ còn /ə/. Người nói "ép" các từ không nhấn vào giữa các từ được nhấn để giữ nhịp đều.',
        },
        {
          type: 'compare',
          clear: 'I want to go to the store.',
          natural: 'I wanna go to the store.',
          note: 'Bản rõ đọc đều từng từ. Bản tự nhiên chỉ nhấn WANT, GO, STORE; "to", "the" lướt thành /tə/, /thə/.',
        },
      ],
    },
    {
      title: '8 hiện tượng bạn sẽ học',
      blocks: [
        {
          type: 'text',
          md: 'Hầu hết những gì "nghe không ra" đều thuộc 8 hiện tượng sau. Mỗi bài học tiếp theo dạy một hiện tượng:\n\n- **Âm yếu**: to → tə, and → ən, can → kən.\n- **Nối âm**: turn it off → tur-ni-doff.\n- **T bật (giọng Mỹ)**: water → wadder, get it → ge-dit.\n- **Nuốt âm**: next day → nex day.\n- **Đồng hóa âm**: meet you → mee-chu.\n- **Mất âm H**: tell him → tel-lim.\n- **Viết tắt**: I will → I\'ll (al).\n- **Rút gọn**: going to → gonna, want to → wanna.',
        },
        {
          type: 'examples',
          title: 'Mỗi màu là một hiện tượng',
          items: [
            { text: 'Nice to meet you.', say: 'Nice to meetcha.', note: 'Âm yếu (to) + đồng hóa (meet you).' },
            { text: "Turn it off.", say: 'Turnid off.', note: 'Nối âm + T bật.' },
            { text: 'See you next week.', say: 'See yuh nex week.', note: 'Nuốt /t/ trong next.' },
          ],
        },
      ],
    },
    {
      title: 'Cách học với ứng dụng này',
      blocks: [
        {
          type: 'rule',
          title: 'Lộ trình mỗi ngày (15–20 phút)',
          body: '1) Học **một bài** và làm quiz. 2) **Chép chính tả** 5–10 câu có hiện tượng vừa học. 3) **Phân biệt âm** (can/can\'t, him/them…). 4) Ôn **Cụm từ** đến hạn. 5) **Nói nhại** 2–3 câu: tự nói được thì sẽ nghe được.',
        },
        {
          type: 'tip',
          md: '**Nghe trước, nhìn chữ sau.** Luôn thử nghe 2–3 lần trước khi xem đáp án. Khi sai, đừng chỉ sửa chữ: hãy bấm vào ô màu để biết **vì sao** mình nghe nhầm.',
        },
        {
          type: 'tip',
          md: 'Bạn có thể đổi **giọng đọc** và **tốc độ** trong Cài đặt. Giọng Mỹ (en-US) cho kết quả gần với bài học nhất.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['What do you want to do?', 'What did you want to do?', 'Where do you want to go?'],
      answer: 0,
      phenomena: ['reduction'],
      explain: '"What do you want to do?" nghe như "whaddaya wanna do". "did you" sẽ nghe thành "didja" — có âm /dʒ/ rõ hơn.',
    },
    {
      type: 'which-rule',
      written: 'tell him',
      spoken: 'tel-lim',
      options: ['h-dropping', 'assimilation', 'contraction', 'flap-t'],
      answer: 'h-dropping',
      explain: '/h/ của "him" không nhấn bị bỏ, phần "im" còn lại dính vào /l/ của "tell": tel-lim.',
    },
    {
      type: 'spot',
      text: 'Nice to meet you.',
      prompt: 'Từ nào bị đọc lướt thành /tə/?',
      unit: 'word',
      answers: ['to'],
      phenomena: ['weak-form'],
      explain: '"to" là từ chức năng, không nhấn nên chỉ còn /tə/. Các từ nội dung NICE, MEET mới được nhấn.',
    },
    {
      type: 'listen-type',
      text: "I'm [going to] call you later.",
      phenomena: ['reduction'],
      explain: '"going to" + động từ nói nhanh thành "gonna". Bạn gõ "gonna" hay "going to" đều đúng.',
    },
    {
      type: 'which-rule',
      written: 'going to (call)',
      spoken: 'gonna',
      options: ['reduction', 'linking', 'weak-form', 'assimilation'],
      answer: 'reduction',
      explain: 'Cả cụm "going to" bị nén thành một dạng ngắn cố định "gonna" — đó là rút gọn.',
    },
    {
      type: 'spot',
      text: 'I need to buy some bread.',
      prompt: 'Chạm vào một từ chức năng bị đọc lướt.',
      unit: 'word',
      answers: ['to', 'some'],
      phenomena: ['weak-form'],
      explain: '"to" → /tə/ và "some" → /səm/ đều không nhấn. Từ được nhấn là NEED, BUY, BREAD.',
    },
    {
      type: 'listen-type',
      text: 'Can you [pick it up]?',
      phenomena: ['linking'],
      explain: 'Ba từ dính thành một khối "pi-ki-dup": /k/ nối sang "it", /t/ của "it" nối sang "up".',
    },
    {
      type: 'listen-choose',
      options: ['Let me know.', 'Let him know.', 'Let them know.'],
      answer: 0,
      phenomena: ['reduction'],
      explain: '"Let me" nghe như "lemme" (âm /m/). "Let him" là "le-dim", "Let them" là "le-dəm".',
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Weak forms
// ---------------------------------------------------------------------------

const weakForm: Lesson = {
  id: 'weak-form',
  order: 2,
  course: 'connected',
  title: 'Âm yếu: từ nhỏ đọc lướt thành /ə/',
  summary: 'to, of, and, can, for gần như không bao giờ đọc như từ điển.',
  phenomenon: 'weak-form',
  minutes: 10,
  goal: 'Nhận ra các từ chức năng khi chúng chỉ còn /ə/.',
  sections: [
    {
      title: 'Âm /ə/ — âm phổ biến nhất tiếng Anh',
      blocks: [
        {
          type: 'text',
          md: 'Âm **/ə/** (schwa) là một âm "ơ" rất ngắn, miệng thả lỏng, không nhấn. Đây là âm xuất hiện nhiều nhất trong tiếng Anh.\n\nCác **từ chức năng** (giới từ, mạo từ, liên từ, trợ động từ, đại từ) khi không nhấn sẽ mất nguyên âm gốc và chỉ còn /ə/: **to** → tə, **for** → fər, **and** → ən, **can** → kən.',
        },
        {
          type: 'text',
          md: 'Người Việt thường học "to" là /tuː/, "and" là /ænd/ và **chờ nghe đúng âm đó**. Nhưng trong câu thật, bạn chỉ nghe một tiếng "tə" hoặc "n" lướt qua trong một phần mười giây. Tai không tìm thấy từ mình chờ nên tưởng là bị thiếu.',
        },
        {
          type: 'examples',
          title: 'Nghe các từ nhỏ "biến mất"',
          items: [
            { text: 'A cup of tea, please.', say: 'A cuppa tea, please.', note: 'a → ə, of → ə.' },
            { text: 'For here or to go?', say: 'Fer here or to go?', note: 'for → fər, or → ər, to → tə.' },
            { text: 'I can swim.', say: 'I kin swim.', note: 'can → kən (khẳng định).' },
            { text: 'This is for you.', say: 'This is fer you.', note: 'for → fər.' },
            { text: 'Look at them.', say: 'Look it them.', note: 'at → ət, them → əm.' },
            { text: "I'm from Vietnam.", say: "I'm frum Vietnam.", note: 'from → frəm.' },
            { text: 'We need to talk.', say: 'We need to talk.', note: 'to → tə.' },
            { text: 'I was there.', say: 'I was there.', note: 'was → wəz.' },
            { text: 'Do you have some time?', say: 'Do yuh have some time?', note: 'do → də, you → yə, some → səm.' },
          ],
        },
      ],
    },
    {
      title: 'Bảng dạng yếu hay gặp',
      blocks: [
        { type: 'rule', title: 'Giới từ', body: '**to** → tə · **for** → fər · **of** → əv / ə · **at** → ət · **from** → frəm' },
        { type: 'rule', title: 'Mạo từ & liên từ', body: '**a** → ə · **the** → thə · **and** → ən / n · **or** → ər · **but** → bət · **than** → thən' },
        { type: 'rule', title: 'Trợ động từ', body: '**can** → kən · **do** → də · **was** → wəz · **were** → wər · **are** → ər · **have** → əv' },
        { type: 'rule', title: 'Đại từ & từ chỉ lượng', body: '**you** → yə · **your** → yər · **them** → thəm / əm · **some** → səm' },
        {
          type: 'tip',
          md: 'Không cần học thuộc cả bảng. Chỉ cần nhớ: **từ nhỏ không nhấn → nguyên âm thành /ə/**. Khi nghe một tiếng "ə" mơ hồ giữa câu, hãy đoán theo ngữ pháp: trước động từ thường là "to", giữa hai danh từ thường là "of" hoặc "and".',
        },
      ],
    },
    {
      title: 'Can hay can\'t?',
      blocks: [
        {
          type: 'text',
          md: 'Đây là cặp gây hiểu nhầm nhiều nhất. Trong giọng Mỹ, /t/ cuối của **can\'t** thường bị nuốt, nên đừng chờ nghe /t/. Hãy nghe **nguyên âm và trọng âm**:\n\n- **can** (khẳng định): không nhấn, đọc yếu **kən**, động từ phía sau được nhấn: I kən SWIM.\n- **can\'t** (phủ định): được nhấn, nguyên âm mở **/æ/** như "ken" kéo dài: I KÆN(T) swim.',
        },
        {
          type: 'compare',
          clear: 'I can swim.',
          natural: 'I can swim.',
          ttsText: 'I kin swim.',
          note: 'Bản "Từng từ" đọc can đầy đủ /kæn/. Bản tự nhiên: "I kən SWIM" — can gần như chỉ còn /kn/.',
        },
        {
          type: 'compare',
          clear: "I can't swim.",
          natural: "I can't swim.",
          note: "can't được nhấn, nguyên âm /æ/ rõ và dài: \"I KÆN(T) swim\".",
        },
      ],
    },
    {
      title: 'Khi nào từ chức năng đọc MẠNH?',
      blocks: [
        {
          type: 'rule',
          title: 'Ba trường hợp giữ dạng mạnh',
          body: '1) **Đứng một mình ở cuối câu** (giới từ, trợ động từ không có động từ theo sau): Where are you **from**? / Yes, I **can**. 2) **Nhấn mạnh, đối lập**: It\'s **for** you, not **from** you. 3) **Đọc riêng một từ** (như trong từ điển).\n\nLưu ý: đại từ tân ngữ ở cuối câu (him, her, them) **vẫn đọc yếu**: Tell him → tel-lim.',
        },
        {
          type: 'examples',
          items: [
            { text: 'Where are you from?', say: 'Where are yuh from?', note: '"from" ở cuối câu nên đọc mạnh /frʌm/, còn "are", "you" đọc yếu.' },
            { text: 'Yes, I can.', say: 'Yes, I can.', note: '"can" cuối câu đọc mạnh /kæn/.' },
          ],
        },
        {
          type: 'tip',
          md: 'Khi luyện nói, hãy cố tình đọc yếu các từ nhỏ. Chính việc **tự nói "tə", "ən", "kən"** sẽ giúp tai bạn nhận ra chúng nhanh hơn.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['I can go.', "I can't go.", 'I could go.'],
      answer: 0,
      explain: '"can" khẳng định đọc yếu /kən/, động từ GO được nhấn. "can\'t" sẽ có nguyên âm /æ/ mở và được nhấn.',
    },
    {
      type: 'listen-choose',
      options: ['Tell them to wait.', 'Tell him to wait.', 'Tell her to wait.'],
      answer: 0,
      phenomena: ['weak-form', 'h-dropping'],
      explain: '"them" đọc yếu là /əm/ nên "tell them" nghe như "tel-ləm"; "tell him" là "tel-lim" (âm /i/), "tell her" là "tel-lər".',
    },
    {
      type: 'listen-type',
      text: "I'd like a cup [of] coffee.",
      explain: '"of" chỉ còn /ə/ dính vào "cup": cu-pə coffee.',
    },
    {
      type: 'listen-type',
      text: 'Salt [and] pepper, please.',
      explain: '"and" không nhấn chỉ còn /ən/, gần như một âm /n/: sal-tən pepper.',
    },
    {
      type: 'spot',
      text: "I'm from Vietnam.",
      prompt: 'Từ nào bị đọc yếu thành /frəm/?',
      unit: 'word',
      answers: ['from'],
      explain: '"from" ở giữa câu, không nhấn nên đọc /frəm/. Từ được nhấn là VIETNAM.',
    },
    {
      type: 'which-rule',
      written: 'for you',
      spoken: 'fər you',
      options: ['weak-form', 'contraction', 'elision', 'linking'],
      answer: 'weak-form',
      explain: '"for" mất nguyên âm /ɔ/ và chỉ còn /fər/ — đó là dạng yếu của từ chức năng.',
    },
    {
      type: 'spot',
      text: 'Where are you from?',
      prompt: 'Từ chức năng nào ở đây được đọc MẠNH?',
      unit: 'word',
      answers: ['from'],
      explain: 'Giới từ đứng cuối câu luôn đọc dạng mạnh /frʌm/. "are" và "you" vẫn đọc yếu: whe-rər yə FROM.',
    },
    {
      type: 'listen-choose',
      options: ['He can help.', "He can't help.", "He'll help."],
      answer: 1,
      explain: '"can\'t" được nhấn, nguyên âm /æ/ mở và dài; /t/ cuối gần như không nghe thấy. Đừng chờ âm /t/!',
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. Linking
// ---------------------------------------------------------------------------

const linking: Lesson = {
  id: 'linking',
  order: 3,
  course: 'connected',
  title: 'Nối âm: phụ âm cuối gặp nguyên âm đầu',
  summary: 'turn it off → tur-ni-doff: ranh giới giữa hai từ biến mất.',
  phenomenon: 'linking',
  minutes: 10,
  goal: 'Tách được các từ trong một chuỗi âm liền.',
  sections: [
    {
      title: 'Phụ âm + nguyên âm = dính liền',
      blocks: [
        {
          type: 'text',
          md: 'Khi một từ **kết thúc bằng phụ âm** và từ sau **bắt đầu bằng nguyên âm**, phụ âm đó **chuyển sang** làm âm đầu của từ sau.\n\n**pick it up** → pi-ki-tup (giọng Mỹ: pi-ki-dup). Tai bạn nghe được ba âm tiết "pi", "ki", "dup" — không âm tiết nào giống "pick", "it" hay "up"!',
        },
        {
          type: 'text',
          md: 'Trong tiếng Việt, từ bắt đầu bằng nguyên âm luôn có một chỗ **ngắt nhẹ ở cổ họng** ("ăn | uống"). Tiếng Anh không có chỗ ngắt đó. Thêm vào đó, người Việt quen **không bật** phụ âm cuối, nên khi /k/ của "pick" bật sang "it", ta không còn nhận ra nó thuộc về "pick".',
        },
        {
          type: 'examples',
          title: 'Cụm động từ — nơi nối âm xuất hiện nhiều nhất',
          items: [
            { text: 'Turn it off.', say: 'Turnid off.', note: 'tur-ni-doff' },
            { text: 'Pick it up.', say: 'Pickid up.', note: 'pi-ki-dup' },
            { text: 'Come on in.', say: 'Come on in.', note: 'cu-mo-nin' },
            { text: 'Check it out.', say: 'Checkid out.', note: 'che-ki-daut' },
            { text: 'Hold on a second.', say: 'Hold on a second.', note: 'hohl-do-nə second' },
            { text: 'Fill it in.', say: 'Fillid in.', note: 'fil-li-din' },
            { text: 'Look at this.', say: 'Look it this.', note: 'loo-kət this' },
          ],
        },
      ],
    },
    {
      title: 'Nguyên âm + nguyên âm: chèn /y/ hoặc /w/',
      blocks: [
        {
          type: 'text',
          md: 'Khi hai nguyên âm gặp nhau, người Mỹ chèn một âm lướt rất nhẹ để nối:\n\n- Sau **ee, i, ei, ai, oi** → chèn **/y/**: I agree → I-yə-gree, the city is → ciddy-yis.\n- Sau **oo, oh, au** → chèn **/w/**: go on → go-won, do it → do-wit.',
        },
        {
          type: 'examples',
          items: [
            { text: 'Go on.', say: 'Go on.', note: 'go-won' },
            { text: 'I agree.', say: 'I agree.', note: 'I-yə-gree' },
            { text: 'Who is it?', say: 'Who is it?', note: 'who-wi-zit' },
            { text: 'Do it now.', say: 'Do it now.', note: 'do-wit now' },
          ],
        },
      ],
    },
    {
      title: 'Âm R nối (giọng Mỹ)',
      blocks: [
        {
          type: 'rule',
          title: 'R cuối luôn được phát âm và nối sang',
          body: 'Giọng Mỹ đọc rõ /r/ cuối từ. Khi từ sau bắt đầu bằng nguyên âm, /r/ chuyển sang đầu từ đó: **far away** → fa-rə-wei, **her own** → he-rohn, **where are** → whe-rər.',
        },
        {
          type: 'examples',
          items: [
            { text: "It's far away.", say: "It's far away.", note: 'fa-rə-wei' },
            { text: 'Where are you?', say: 'Where are you?', note: 'whe-rər you' },
            { text: 'Where is it?', say: 'Where is it?', note: 'whe-ri-zit' },
            { text: 'The car is outside.', say: 'The car is outside.', note: 'ca-ri-zaut-side' },
          ],
        },
        {
          type: 'compare',
          clear: 'Pick it up.',
          natural: 'Pick it up.',
          ttsText: 'Pickid up.',
          note: 'Bản "Từng từ" có ba từ rời. Bản tự nhiên là một khối "pi-ki-dup".',
        },
        {
          type: 'tip',
          md: 'Khi chép chính tả mà nghe được một "từ lạ" như **"kidup"**, hãy thử **cắt lại** ở chỗ khác: k-it-up → pick **it up**. Phụ âm đầu của âm tiết thường là phụ âm cuối của từ trước.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['Give it up.', 'Give up.', 'Give them up.'],
      answer: 0,
      explain: '"Give it up" → gi-vi-dup: "it" bị nối mất ranh giới nhưng vẫn có thêm một âm tiết "i". "Give up" chỉ có "gi-vup".',
    },
    {
      type: 'listen-type',
      text: 'Can you [pick it up]?',
      explain: 'pi-ki-dup: /k/ của "pick" nối sang "it", /t/ của "it" nối sang "up" (và bật thành /d/).',
    },
    {
      type: 'spot',
      text: 'Look at this.',
      prompt: 'Chạm vào chỗ phụ âm nối sang nguyên âm.',
      unit: 'boundary',
      answers: ['look at'],
      explain: '/k/ của "look" nối sang "at": loo-kət. "at this" không nối vì "this" bắt đầu bằng phụ âm.',
    },
    {
      type: 'which-rule',
      written: 'go on',
      spoken: 'go-won',
      options: ['linking', 'flap-t', 'contraction', 'h-dropping'],
      answer: 'linking',
      explain: 'Hai nguyên âm gặp nhau, người nói chèn âm lướt /w/ để nối: go-won. Đây là nối âm.',
    },
    {
      type: 'listen-choose',
      options: ['Put it on.', 'Put on.', 'Put them on.'],
      answer: 0,
      phenomena: ['linking', 'flap-t'],
      explain: '"Put it on" → pu-di-don: ba từ thành ba âm tiết dính liền. "Put on" chỉ có hai âm tiết pu-don.',
    },
    {
      type: 'spot',
      text: 'I agree with you.',
      prompt: 'Chỗ nào được chèn âm /y/ nhẹ để nối hai nguyên âm?',
      unit: 'boundary',
      answers: ['i agree'],
      explain: '"I" kết thúc bằng âm /i/, "agree" bắt đầu bằng nguyên âm → chèn /y/: I-yə-gree.',
    },
    {
      type: 'listen-type',
      text: 'Could you [fill it in]?',
      explain: 'fil-li-din: /l/ nối sang "it", /t/ nối sang "in". Nghe như một từ ba âm tiết.',
    },
    {
      type: 'which-rule',
      written: 'come on in',
      spoken: 'cu-mo-nin',
      options: ['linking', 'assimilation', 'reduction', 'weak-form'],
      answer: 'linking',
      explain: '/m/ của "come" nối sang "on", /n/ của "on" nối sang "in": cu-mo-nin.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. Flap T
// ---------------------------------------------------------------------------

const flapT: Lesson = {
  id: 'flap-t',
  order: 4,
  course: 'connected',
  title: 'T bật: water → wadder',
  summary: 'Giọng Mỹ đọc /t/ giữa hai nguyên âm nhanh, gần như /d/.',
  phenomenon: 'flap-t',
  minutes: 9,
  goal: 'Nhận ra /t/ khi nó nghe như /d/ nhẹ — trong từ và giữa hai từ.',
  sections: [
    {
      title: 'T giữa hai nguyên âm',
      blocks: [
        {
          type: 'text',
          md: 'Trong giọng Mỹ, khi **/t/ (hoặc /d/) nằm giữa hai nguyên âm** và âm tiết sau **không nhấn**, lưỡi chỉ **chạm nhanh** lên lợi một cái. Âm đó nghe giống **/d/ rất nhẹ**, gần như chữ "đ" lướt nhanh.\n\n**water** → wadder · **better** → bedder · **city** → ciddy · **little** → liddle.\n\nSau âm **/r/** cũng vậy: **party** → pardy, **forty** → fordy.',
        },
        {
          type: 'text',
          md: 'Người Việt học "t" là âm "tờ" bật hơi, nên khi nghe "wadder" ta không nghĩ đến "water". Thêm nữa, sách giáo khoa thường dạy giọng Anh (water = /ˈwɔːtə/), khác hẳn giọng Mỹ trên phim và YouTube.',
        },
        {
          type: 'examples',
          title: 'T bật bên trong một từ',
          items: [
            { text: 'I need some water.', say: 'I need some wadder.', note: 'water → wadder' },
            { text: "It's better now.", say: "It's bedder now.", note: 'better → bedder' },
            { text: 'Wait a little bit.', say: 'Waida liddle bit.', note: 'little → liddle' },
            { text: "It doesn't matter.", say: 'It duzzn madder.', note: 'matter → madder' },
            { text: 'The city is pretty.', say: 'The ciddy is priddy.', note: 'city → ciddy, pretty → priddy' },
            { text: 'What a beautiful city!', say: 'Whadda beautiful ciddy!', note: 'beautiful → byoodəfəl' },
          ],
        },
      ],
    },
    {
      title: 'T bật giữa hai từ',
      blocks: [
        {
          type: 'text',
          md: 'Hiện tượng này xảy ra **cả qua ranh giới từ**: từ trước kết thúc bằng /t/, từ sau bắt đầu bằng nguyên âm. Nó thường đi cùng **nối âm**, nên các từ nhỏ như "it", "at", "out" gần như tan vào nhau.',
        },
        {
          type: 'examples',
          items: [
            { text: 'Get it out.', say: 'Geddit out.', note: 'ge-di-daut' },
            { text: 'What about it?', say: 'Whaddabout it?', note: 'wha-də-bau-dit' },
            { text: 'I got it.', say: 'I goddit.', note: 'I ga-dit' },
            { text: 'Let it go.', say: 'Leddit go.', note: 'le-dit go' },
            { text: 'Not at all.', say: 'Noddat all.', note: 'na-də-dall' },
            { text: 'Wait a minute.', say: 'Waida minute.', note: 'wei-də minute' },
            { text: 'Shut up.', say: 'Shuddup.', note: 'shu-dup' },
          ],
        },
        {
          type: 'compare',
          clear: 'Get it out.',
          natural: 'Get it out.',
          note: 'Bản "Từng từ" có /t/ rõ. Bản tự nhiên: "ge-di-daut" — cả hai /t/ đều thành /d/ nhẹ.',
        },
      ],
    },
    {
      title: 'Khi nào T KHÔNG bật?',
      blocks: [
        {
          type: 'rule',
          title: 'T giữ nguyên ở đầu âm tiết được nhấn',
          body: '**today**, **return**, **attack**, **hotel**: âm tiết chứa /t/ được nhấn nên /t/ vẫn bật hơi rõ. T cũng không bật khi đứng sau phụ âm như s: **sister**, **after**.',
        },
        {
          type: 'tip',
          md: 'Khi nghe một âm "d" lạ giữa câu ("I ga-dit", "le-dit go"), hãy thử thay bằng **t**: got it, let it. Phần lớn trường hợp đó là T bật.',
        },
        {
          type: 'tip',
          md: 'Sau /n/, giọng Mỹ còn hay **bỏ hẳn** /t/: **twenty** → twenny, **internet** → innernet, **wanted** → wanned. Gặp "twenny" thì đó chính là twenty.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ["I'll get it.", "I'll get in.", "I'll get him."],
      answer: 0,
      explain: '"get it" → ge-dit: /t/ của "get" bật thành /d/ nhẹ và nối sang "it". Âm cuối /t/ của "it" khác /n/ (get in) và /m/ (get him).',
    },
    {
      type: 'listen-type',
      text: 'I need a glass of [water].',
      explain: 'water → wadder: /t/ nằm giữa hai nguyên âm nên bật nhẹ như /d/.',
    },
    {
      type: 'listen-type',
      text: '[Better] late than never.',
      explain: 'better → bedder. Câu thành ngữ này: "Muộn còn hơn không".',
    },
    {
      type: 'spot',
      text: 'Get out now.',
      prompt: 'Chạm vào chỗ /t/ bật thành âm giống /d/.',
      unit: 'boundary',
      answers: ['get out'],
      explain: '/t/ cuối "get" đứng trước nguyên âm của "out" → ge-daut. "out now" không bật vì sau /t/ là phụ âm /n/.',
    },
    {
      type: 'spot',
      text: 'What a beautiful city!',
      prompt: 'Chạm vào một từ có T bật bên trong.',
      unit: 'word',
      answers: ['beautiful', 'city'],
      explain: 'beautiful → byoodəfəl, city → ciddy: /t/ giữa hai nguyên âm, âm tiết sau không nhấn.',
    },
    {
      type: 'which-rule',
      written: 'a little bit',
      spoken: 'ə liddle bit',
      options: ['flap-t', 'assimilation', 'contraction', 'h-dropping'],
      answer: 'flap-t',
      explain: '/t/ trong "little" nằm giữa hai nguyên âm, âm tiết sau không nhấn nên bật thành /d/ nhẹ: liddle.',
    },
    {
      type: 'which-rule',
      written: 'not at all',
      spoken: 'na-də-dall',
      options: ['flap-t', 'h-dropping', 'reduction', 'contraction'],
      answer: 'flap-t',
      explain: 'Cả hai /t/ (not, at) đứng trước nguyên âm nên bật thành /d/ nhẹ và nối sang: na-də-dall.',
    },
    {
      type: 'listen-choose',
      options: ["It's a little better.", "It's a lot better.", "It's a little bitter."],
      answer: 0,
      explain: '"a little better" → ə liddle bedder. "lot" chỉ có một âm tiết; "bitter" có nguyên âm /ɪ/ ngắn khác "better" /ɛ/.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Elision
// ---------------------------------------------------------------------------

const elision: Lesson = {
  id: 'elision',
  order: 5,
  course: 'connected',
  title: 'Nuốt âm: next day → nex day',
  summary: '/t/ và /d/ kẹp giữa hai phụ âm thường mất hẳn.',
  phenomenon: 'elision',
  minutes: 9,
  goal: 'Hiểu vì sao bạn "không nghe thấy" /t/, /d/ và đuôi -ed.',
  sections: [
    {
      title: '/t/ và /d/ kẹp giữa hai phụ âm',
      blocks: [
        {
          type: 'text',
          md: 'Khi /t/ hoặc /d/ nằm **giữa hai phụ âm** (cuối từ trước là cụm -st, -nd, -ft, -pt… và từ sau bắt đầu bằng phụ âm), người bản xứ thường **bỏ hẳn** nó vì quá khó nói nhanh.\n\n**next day** → nex day · **last night** → las night · **best friend** → bes friend · **hand me** → han me.',
        },
        {
          type: 'text',
          md: 'Thú vị là tiếng Việt **không có cụm phụ âm cuối**, nên người Việt vốn đã quen "nuốt". Vấn đề nằm ở chỗ ngược lại: bạn học rằng "phải nghe thấy /t/", nên khi không nghe thấy, bạn tưởng đó là một từ khác ("nex" → "neck"?).',
        },
        {
          type: 'examples',
          items: [
            { text: 'See you next week.', say: 'See yuh nex week.', note: 'next week → nex week' },
            { text: 'I had a great time last night.', say: 'I had a great time lass night.', note: 'last night → las night' },
            { text: "She's my best friend.", say: "She's my bes friend.", note: 'best friend → bes friend' },
            { text: 'I must go.', say: 'I muss go.', note: 'must go → mus go' },
            { text: 'Most people agree.', say: 'Moce people agree.', note: 'most people → mohs people' },
            { text: 'Hand me the bag.', say: 'Hann me the bag.', note: 'hand me → han me' },
            { text: 'I want a soft drink.', say: 'I wanna sof drink.', note: 'soft drink → sof drink' },
          ],
        },
      ],
    },
    {
      title: "n't trước phụ âm",
      blocks: [
        {
          type: 'text',
          md: 'Trong **don\'t, doesn\'t, wouldn\'t, can\'t**, âm /t/ cuối thường mất khi từ sau bắt đầu bằng phụ âm. Phủ định vẫn nằm trong **âm /n/** và **nguyên âm**: don\'t /doʊn/ có "ô" dài, khác hẳn do /du/.',
        },
        {
          type: 'examples',
          items: [
            { text: "I don't like it.", say: 'I dohn like it.', note: "don't like → dohn like" },
            { text: "Don't worry.", say: 'Dohn worry.', note: 'dohn worry' },
            { text: "It doesn't matter.", say: 'It duzzn madder.', note: 'doesn matter' },
            { text: "I wouldn't do that.", say: 'I wooden do that.', note: 'wouldn do that' },
          ],
        },
        {
          type: 'compare',
          clear: "I don't like it.",
          natural: "I don't like it.",
          ttsText: 'I dohn like it.',
          note: 'Bản tự nhiên: "I dohn lai-kit". Không có /t/, nhưng vẫn là phủ định nhờ "dohn" có /n/.',
        },
      ],
    },
    {
      title: 'Đuôi -ed biến mất',
      blocks: [
        {
          type: 'text',
          md: 'Đuôi **-ed** đọc là /t/ hoặc /d/. Khi từ sau bắt đầu bằng phụ âm, đuôi này gần như không nghe thấy: **We missed the bus** → we miss thə bus.',
        },
        {
          type: 'examples',
          items: [
            { text: 'We missed the bus.', say: 'We miss the bus.', note: 'missed the → mis thə' },
            { text: 'I worked late.', say: 'I work late.', note: 'worked late → work late' },
            { text: 'She looked tired.', say: 'She look tired.', note: 'looked tired → look tired' },
            { text: 'He kept quiet.', say: 'He kep quiet.', note: 'kept quiet → kep quiet' },
          ],
        },
        {
          type: 'tip',
          md: 'Đừng cố nghe đuôi -ed. Hãy dựa vào **ngữ cảnh**: có "yesterday", "last night", "ago" không? Câu chuyện đang kể về quá khứ? Người bản xứ cũng hiểu thì quá khứ theo cách đó.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ["I don't like it.", 'I do like it.', "I didn't like it."],
      answer: 0,
      explain: '"don\'t like" → dohn like: /t/ mất nhưng còn âm /n/ và nguyên âm "ô" dài. "do like" không có /n/; "didn\'t" có hai âm tiết "di-dn".',
    },
    {
      type: 'listen-choose',
      options: ['We missed the bus last night.', 'We miss the bus every night.', 'We missed a bus last night.'],
      answer: 0,
      explain: 'Trước "the", đuôi -ed bị nuốt: mis thə bus — đừng chờ nghe /t/, hãy dựa vào "last night" để biết là quá khứ. Nếu là "missed a", /t/ sẽ nối sang nguyên âm và nghe rõ: mis-tə bus.',
    },
    {
      type: 'listen-type',
      text: 'See you [next] week.',
      explain: 'next week → nex week: /t/ nằm giữa /ks/ và /w/ nên biến mất.',
    },
    {
      type: 'listen-type',
      text: "She's my [best] friend.",
      explain: 'best friend → bes friend: /t/ kẹp giữa /s/ và /f/ bị bỏ.',
    },
    {
      type: 'spot',
      text: 'Hand me the bag.',
      prompt: 'Từ nào bị mất âm cuối?',
      unit: 'word',
      answers: ['hand'],
      explain: '"hand me" → han me: /d/ kẹp giữa /n/ và /m/ nên biến mất.',
    },
    {
      type: 'spot',
      text: 'I must go now.',
      prompt: 'Chạm vào chỗ có âm bị nuốt.',
      unit: 'boundary',
      answers: ['must go'],
      explain: '"must go" → mus go: /t/ nằm giữa /s/ và /g/.',
    },
    {
      type: 'which-rule',
      written: 'next day',
      spoken: 'nex day',
      options: ['elision', 'assimilation', 'contraction', 'weak-form'],
      answer: 'elision',
      explain: 'Âm /t/ bị bỏ hẳn (không biến thành âm khác) — đó là nuốt âm.',
    },
    {
      type: 'which-rule',
      written: "don't worry",
      spoken: 'dohn worry',
      options: ['elision', 'reduction', 'linking', 'h-dropping'],
      answer: 'elision',
      explain: '/t/ cuối "don\'t" mất trước phụ âm /w/. Phủ định vẫn còn trong âm /n/.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. Assimilation
// ---------------------------------------------------------------------------

const assimilation: Lesson = {
  id: 'assimilation',
  order: 6,
  course: 'connected',
  title: 'Đồng hóa âm: meet you → mee-chu',
  summary: 'Hai âm nhập thành âm mới: t + y = ch, d + y = j, n + b = m.',
  phenomenon: 'assimilation',
  minutes: 9,
  goal: 'Nhận ra "ch", "j", "sh" lạ là t/d/s + you.',
  sections: [
    {
      title: 't, d, s, z + you/your/yet/year',
      blocks: [
        {
          type: 'text',
          md: 'Khi /t/, /d/, /s/, /z/ đứng ngay trước âm /y/ (you, your, yet, year), hai âm **hòa thành một âm mới**:\n\n- **t + y → ch**: meet you → mee-chu, not yet → na-chet\n- **d + y → j**: need you → need-ju, told you → told-ju\n- **s + y → sh**: bless you → ble-shu, miss you → mi-shu\n- **z + y → zh**: how\'s your → how-zhur',
        },
        {
          type: 'text',
          md: 'Tiếng Việt có sẵn "ch", "gi", "s" nên bạn **nói** được dễ dàng. Cái khó là **nghe ngược lại**: nghe "chu" bạn nghĩ đến "chew" hoặc một từ lạ, chứ không nghĩ "t + you".',
        },
        {
          type: 'examples',
          items: [
            { text: 'Nice to meet you.', say: 'Nice to meetcha.', note: 'meet you → mee-chu' },
            { text: "I'll let you know.", say: "I'll letcha know.", note: 'let you → le-chu' },
            { text: 'I need you.', say: 'I needja.', note: 'need you → need-ju' },
            { text: 'Bless you!', say: 'Bleshu!', note: 'ble-shu' },
            { text: "What's your name?", say: 'Watcher name?', note: "what's your → what-shur" },
            { text: 'Is this your bag?', say: 'Is this shur bag?', note: 'this your → thi-shur' },
            { text: 'Last year was hard.', say: 'Lass cheer was hard.', note: 'last year → las-cheer' },
            { text: 'Not yet.', say: 'Nah chet.', note: 'na-chet' },
            { text: 'I told you so.', say: 'I toldja so.', note: 'told you → told-ju' },
          ],
        },
      ],
    },
    {
      title: 'n đổi thành m trước p, b, m',
      blocks: [
        {
          type: 'text',
          md: 'Âm /n/ cuối từ "bắt chước" vị trí môi của âm sau. Trước **p, b, m** (âm hai môi), /n/ thành **/m/**: **ten boys** → tem boys, **in Paris** → im Paris, **one more** → wum more.',
        },
        {
          type: 'examples',
          items: [
            { text: 'I live in Boston.', say: 'I livim Boston.', note: 'in Boston → im Boston' },
            { text: 'We met ten people.', say: 'We met tem people.', note: 'ten people → tem people' },
            { text: 'One more, please.', say: 'Wum more, please.', note: 'one more → wum more' },
            { text: 'a green bag', say: 'a greem bag', note: 'green bag → greem bag' },
          ],
        },
      ],
    },
    {
      title: 'Luyện tai',
      blocks: [
        {
          type: 'compare',
          clear: 'Nice to meet you.',
          natural: 'Nice to meet you.',
          note: 'Bản "Từng từ": meet, you tách rời. Bản tự nhiên: "nice tə mee-chu".',
        },
        {
          type: 'compare',
          clear: 'Is this your bag?',
          natural: 'Is this your bag?',
          ttsText: 'Is this shur bag?',
          note: 'Bản tự nhiên: "is thi-shur bag" — /s/ + /y/ hòa thành "sh".',
        },
        {
          type: 'tip',
          md: 'Khi nghe một âm **ch, j, sh** "lạc chỗ" giữa câu, hãy thử tách lại: ch → **t + you**, j → **d + you**, sh → **s + you**. Rất nhiều câu hỏi bắt đầu bằng "Did you", "Would you", "Could you" (didja, wudja, cudja) — những cụm này được học ở bài Rút gọn.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ["I'll let you know.", "I'll let her know.", "I'll let them know."],
      answer: 0,
      explain: '"let you" → le-chu: /t/ + /y/ hòa thành "ch". "let her" là le-dər, "let them" là le-dəm.',
    },
    {
      type: 'listen-choose',
      options: ['Is this your bag?', 'Is this her bag?', 'Is this our bag?'],
      answer: 0,
      explain: '"this your" → thi-shur: /s/ + /y/ hòa thành "sh". "this her" là thi-sər, không có "sh".',
    },
    {
      type: 'listen-type',
      text: 'Nice to [meet you].',
      explain: 'meet you → mee-chu: /t/ + /y/ = ch.',
    },
    {
      type: 'listen-type',
      text: "What's [your] name?",
      explain: '"what\'s your" → what-shur: /s/ của what\'s + /y/ của your hòa thành "sh". Âm "shur" chính là "your".',
    },
    {
      type: 'spot',
      text: 'Did you eat yet?',
      prompt: 'Chạm vào một chỗ hai âm hòa thành "ch" hoặc "j".',
      unit: 'boundary',
      answers: ['did you', 'eat yet'],
      explain: '"did you" → didja (d + y = j) và "eat yet" → ee-chet (t + y = ch). Cả hai đều là đồng hóa.',
    },
    {
      type: 'spot',
      text: 'I live in Boston.',
      prompt: 'Chạm vào chỗ /n/ bị đổi thành /m/.',
      unit: 'boundary',
      answers: ['in boston'],
      explain: '/n/ của "in" đứng trước /b/ (âm hai môi) nên thành /m/: im Boston.',
    },
    {
      type: 'which-rule',
      written: 'meet you',
      spoken: 'mee-chu',
      options: ['assimilation', 'h-dropping', 'flap-t', 'contraction'],
      answer: 'assimilation',
      explain: '/t/ và /y/ không chỉ nối mà còn biến thành một âm mới /tʃ/ ("ch") — đó là đồng hóa.',
    },
    {
      type: 'which-rule',
      written: 'ten boys',
      spoken: 'tem boys',
      options: ['assimilation', 'elision', 'weak-form', 'h-dropping'],
      answer: 'assimilation',
      explain: '/n/ biến thành /m/ cho giống vị trí môi của /b/. Âm không mất mà bị đổi → đồng hóa.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. H-dropping
// ---------------------------------------------------------------------------

const hDropping: Lesson = {
  id: 'h-dropping',
  order: 7,
  course: 'connected',
  title: 'Mất âm H: tell him → tel-lim',
  summary: 'he, him, his, her, have không nhấn thì mất /h/.',
  phenomenon: 'h-dropping',
  minutes: 8,
  goal: 'Nghe ra him, her, his, have khi chúng không còn /h/.',
  sections: [
    {
      title: 'Đại từ mất /h/',
      blocks: [
        {
          type: 'text',
          md: 'Các từ **he, him, his, her** khi không nhấn (thường ở giữa câu) **mất âm /h/**. Phần còn lại bắt đầu bằng nguyên âm nên **nối** vào phụ âm cuối của từ trước:\n\n**tell him** → tel-lim · **ask her** → as-kər · **love her** → lu-vər · **did he** → di-dee.',
        },
        {
          type: 'text',
          md: 'Trong tiếng Việt, chữ "h" luôn được đọc ("hai", "học"). Người Việt vì thế **chờ nghe /h/** để nhận ra him, her. Khi /h/ biến mất, "tell him" nghe như một từ "telim" và rất dễ nhầm với **tell them** (tel-ləm).',
        },
        {
          type: 'examples',
          items: [
            { text: 'Tell him.', say: 'Tellim.', note: 'tel-lim' },
            { text: 'Ask her.', say: "Asker.", note: 'as-kər' },
            { text: 'I love her.', say: 'I luvver.', note: 'lu-vər' },
            { text: 'What did he say?', say: 'What diddy say?', note: 'di-dee' },
            { text: 'Give him a call.', say: 'Givim a call.', note: 'gi-vi-mə call' },
            { text: 'Is he OK?', say: 'Izzy OK?', note: 'i-zee-yoh-kei' },
            { text: 'Take his advice.', say: "Take 'is advice.", note: 'tei-ki-zəd-vais' },
            { text: 'I met her mother.', say: "I medder mother.", note: 'me-dər mother' },
          ],
        },
      ],
    },
    {
      title: 'have, has, had làm trợ động từ',
      blocks: [
        {
          type: 'text',
          md: 'Khi **have/has/had** là trợ động từ (không mang nghĩa "có"), chúng cũng mất /h/ và chỉ còn **əv, əz, əd**: **should have** → shu-dəv (shoulda), **must have** → mus-təv.',
        },
        {
          type: 'examples',
          items: [
            { text: 'I should have called.', say: 'I shoulda called.', note: 'shu-dəv called' },
            { text: 'She must have known.', say: 'She musta known.', note: 'mus-təv known' },
            { text: 'It could have been worse.', say: 'It coulda been worse.', note: 'cu-dəv bin worse' },
            { text: 'You should have told her.', say: "You shoulda tolder.", note: 'shu-dəv tohl-dər' },
          ],
        },
      ],
    },
    {
      title: 'Khi nào /h/ được giữ?',
      blocks: [
        {
          type: 'rule',
          title: 'Giữ /h/ khi',
          body: '1) Từ **đứng đầu câu**: **He**\'s here. **Her** car is red. 2) Từ được **nhấn mạnh**: I meant **HIM**, not her. 3) **Từ nội dung** có h: house, happy, help — luôn giữ /h/.',
        },
        {
          type: 'compare',
          clear: 'Tell him I called.',
          natural: 'Tell him I called.',
          note: 'Bản tự nhiên: "tel-li-mai called" — /h/ biến mất, ba từ dính liền.',
        },
        {
          type: 'tip',
          md: '**him** (/ɪm/, âm "i") và **them** (/əm/, âm "ơ") chỉ khác nhau ở **nguyên âm**. Hãy tập trung vào nguyên âm, không phải phụ âm đầu.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['Tell him I called.', 'Tell them I called.', 'Tell her I called.'],
      answer: 0,
      explain: '"tell him" → tel-lim (nguyên âm "i"). "tell them" → tel-ləm (âm "ơ"), "tell her" → tel-lər.',
    },
    {
      type: 'listen-choose',
      options: ['I should have gone.', 'I should go.', 'I should be gone.'],
      answer: 0,
      explain: '"should have" → shu-dəv: "have" mất /h/ chỉ còn "əv". Sau đó là "gone" (V3) — dấu hiệu của should have.',
    },
    {
      type: 'listen-type',
      text: 'Did you [ask her]?',
      explain: '"ask her" → as-kər: /h/ mất, /k/ nối sang "ər".',
    },
    {
      type: 'listen-type',
      text: "I'll [give him] a call.",
      explain: '"give him" → gi-vim: /v/ nối sang "im" sau khi /h/ biến mất.',
    },
    {
      type: 'spot',
      text: 'What did he say?',
      prompt: 'Từ nào mất âm /h/?',
      unit: 'word',
      answers: ['he'],
      explain: '"did he" → di-dee: "he" không nhấn mất /h/ và dính vào /d/ của "did".',
    },
    {
      type: 'spot',
      text: 'I met her at work.',
      prompt: 'Chạm vào chỗ âm /h/ bị bỏ.',
      unit: 'boundary',
      answers: ['met her'],
      explain: '"met her" → me-dər: /h/ mất, /t/ nối sang và bật thành /d/ nhẹ.',
    },
    {
      type: 'which-rule',
      written: 'love her',
      spoken: 'lu-vər',
      options: ['h-dropping', 'flap-t', 'contraction', 'assimilation'],
      answer: 'h-dropping',
      explain: 'Âm /h/ của "her" biến mất và /v/ nối sang: lu-vər.',
    },
    {
      type: 'which-rule',
      written: 'must have (known)',
      spoken: 'mus-təv',
      options: ['h-dropping', 'assimilation', 'flap-t', 'reduction'],
      answer: 'h-dropping',
      explain: '"have" làm trợ động từ mất /h/, chỉ còn "əv" nối vào /t/ của "must": mus-təv.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. Contractions
// ---------------------------------------------------------------------------

const contraction: Lesson = {
  id: 'contraction',
  order: 8,
  course: 'connected',
  title: 'Viết tắt: I\'ll, she\'d, they\'re',
  summary: 'Trợ động từ co lại còn một phụ âm, rất dễ nghe sót.',
  phenomenon: 'contraction',
  minutes: 9,
  goal: 'Không bỏ sót \'ll, \'d, \'ve, \'re và phân biệt can/can\'t, won\'t/want.',
  sections: [
    {
      title: 'Trợ động từ co lại thành một âm',
      blocks: [
        {
          type: 'text',
          md: 'Trong văn nói, trợ động từ gần như **luôn** được viết tắt. Mỗi dạng tắt chỉ còn **một phụ âm** dính vào chủ ngữ:\n\n- **will** → \'ll (/l/): I\'ll, we\'ll, it\'ll\n- **would / had** → \'d (/d/): I\'d, she\'d\n- **have** → \'ve (/v/): I\'ve, we\'ve\n- **are** → \'re (/r/): you\'re, they\'re\n- **is / has** → \'s (/s/ hoặc /z/): he\'s, it\'s',
        },
        {
          type: 'text',
          md: 'Người Việt hay **bỏ sót** những phụ âm này vì tai quen bỏ qua phụ âm cuối. Hậu quả không nhỏ: bỏ sót \'ll là nhầm tương lai thành hiện tại (I\'ll go → I go), bỏ sót \'d là mất nghĩa giả định.',
        },
        {
          type: 'examples',
          items: [
            { text: "You're right.", say: 'Yer right.', note: "you're → yər (giống your)" },
            { text: "We'll see.", say: 'Will see.', note: "we'll → wil (giống will)" },
            { text: "It'll be fine.", say: 'Iddle be fine.', note: "it'll → i-dəl" },
            { text: "She'd like to come.", say: "She'd like to come.", note: "she'd = she would" },
            { text: "I've got it.", say: "I've goddit.", note: "I've → aiv, /v/ rất nhẹ" },
            { text: "He's been busy.", say: "He's bin busy.", note: "he's = he has" },
            { text: "They're late.", say: 'Ther late.', note: "they're → thər (giống their, there)" },
            { text: "I'd better go.", say: "I'd bedder go.", note: "I'd better = I had better" },
          ],
        },
      ],
    },
    {
      title: 'Bản đầy đủ và bản tự nhiên',
      blocks: [
        {
          type: 'compare',
          clear: 'It will be fine.',
          natural: "It'll be fine.",
          ttsText: 'Iddle be fine.',
          note: '"It will" có hai âm tiết rõ. "It\'ll" chỉ còn "i-dəl" — /t/ bật nhẹ và "will" chỉ còn /əl/.',
        },
        {
          type: 'compare',
          clear: 'I would like to.',
          natural: "I'd like to.",
          note: '"would" chỉ còn một âm /d/ rất nhẹ dính sau "I". Nghe "I\'d like" ("I" + một tiếng /d/ nhẹ) là I would like.',
        },
        {
          type: 'compare',
          clear: 'They are late.',
          natural: "They're late.",
          ttsText: 'Ther late.',
          note: '"They\'re" đọc yếu là "thər" — giống hệt "their" và "there". Phân biệt bằng ngữ pháp.',
        },
      ],
    },
    {
      title: 'Các cặp dễ nhầm',
      blocks: [
        {
          type: 'rule',
          title: "can ↔ can't",
          body: 'can (khẳng định) đọc yếu **kən**, không nhấn. can\'t được **nhấn**, nguyên âm /æ/ mở; /t/ cuối thường mất. Nghe nguyên âm, đừng chờ /t/.',
        },
        {
          type: 'rule',
          title: "won't ↔ want",
          body: "**won't** /woʊnt/ có âm \"ô\" dài: \"wohnt\". **want** /wɑnt/ có âm \"a\" mở, giống \"wan\" trong \"wanna\".",
        },
        {
          type: 'rule',
          title: "'d = would hay had?",
          body: "Nhìn động từ phía sau: **'d + động từ nguyên mẫu** = would (I'd go). **'d + V3/been** = had (I'd gone, I'd been). **'d better** luôn là had better.",
        },
        {
          type: 'examples',
          items: [
            { text: "I can't hear you.", say: "I can't hear you.", note: 'can\'t được nhấn, /æ/ mở' },
            { text: "It won't work.", say: "It won't work.", note: "won't → wohnt" },
            { text: "That's what I said.", say: "That's whaddai said.", note: "that's = that is" },
          ],
        },
        {
          type: 'tip',
          md: 'Khi chép chính tả, nếu câu nghe như "I go tomorrow", hãy tự hỏi: có tiếng /l/ nhẹ sau "I" không? Ngữ pháp (tomorrow → tương lai) gần như luôn đòi **I\'ll**.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ["I can't go.", 'I can go.', 'I could go.'],
      answer: 0,
      explain: "\"can't\" được nhấn với nguyên âm /æ/ mở và dài; /t/ cuối gần như không nghe thấy. \"can\" sẽ đọc yếu \"kən\".",
    },
    {
      type: 'listen-choose',
      options: ["I'll call you.", 'I call you.', 'I called you.'],
      answer: 0,
      explain: '"I\'ll" → al: có âm /l/ nhẹ sau "I". Bỏ sót nó là biến câu tương lai thành hiện tại.',
    },
    {
      type: 'listen-choose',
      options: ["I won't do it.", 'I want to do it.', "I wouldn't do it."],
      answer: 0,
      explain: "\"won't\" → wohnt (âm \"ô\" dài). \"want to\" sẽ là \"wanna\", \"wouldn't\" có hai âm tiết \"wu-dn\".",
    },
    {
      type: 'listen-type',
      text: "[It'll] be fine.",
      explain: '"It\'ll" → i-dəl. Bạn gõ "it\'ll" hay "it will" đều đúng.',
    },
    {
      type: 'listen-type',
      text: "[We're] almost there.",
      explain: '"We\'re" → wir, nối luôn vào "almost": wi-rol-mohs. Gõ "we\'re" hoặc "we are" đều đúng.',
    },
    {
      type: 'spot',
      text: "He's got a new job.",
      prompt: "Từ nào đang \"giấu\" chữ has?",
      unit: 'word',
      answers: ["he's"],
      explain: "He's got = He has got. Khi sau 's là V3 (got, been, done) thì 's = has, không phải is.",
    },
    {
      type: 'which-rule',
      written: "I'll see you",
      spoken: 'al see you',
      options: ['contraction', 'flap-t', 'assimilation', 'elision'],
      answer: 'contraction',
      explain: '"I will" viết tắt thành "I\'ll" và nói nhanh chỉ còn "al".',
    },
    {
      type: 'which-rule',
      written: "it'll (be fine)",
      spoken: 'i-dəl',
      options: ['contraction', 'h-dropping', 'assimilation', 'reduction'],
      answer: 'contraction',
      explain: '"It will" co thành "it\'ll"; "will" chỉ còn /əl/ và /t/ bật nhẹ: i-dəl.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 9. Reductions
// ---------------------------------------------------------------------------

const reduction: Lesson = {
  id: 'reduction',
  order: 9,
  course: 'connected',
  title: 'Rút gọn: gonna, wanna, gotta',
  summary: 'Cụm hay dùng bị nén thành "từ mới": học như từ vựng.',
  phenomenon: 'reduction',
  minutes: 10,
  goal: 'Nhận ra ngay gonna, wanna, gotta, hafta, lemme, dunno, whatcha…',
  sections: [
    {
      title: 'Cụm quen thuộc thành một từ',
      blocks: [
        {
          type: 'text',
          md: 'Những cụm xuất hiện **hàng nghìn lần mỗi ngày** bị người bản xứ nén lại thành một khối ngắn. Chúng không "sai" — đây là cách nói chuẩn trong hội thoại, phim và bài hát:\n\n- **going to** → gonna · **want to** → wanna · **got to** → gotta\n- **have to** → hafta · **kind of** → kinda · **a lot of** → ə lotta\n- **let me** → lemme · **give me** → gimme · **don\'t know** → dunno',
        },
        {
          type: 'examples',
          items: [
            { text: "I'm going to call you.", say: "I'm gonna call you.", note: 'gonna' },
            { text: 'I want to go home.', say: 'I wanna go home.', note: 'wanna' },
            { text: "I've got to go.", say: "I've gotta go.", note: 'gotta' },
            { text: 'I have to work.', say: 'I hafta work.', note: 'hafta' },
            { text: "I'm kind of tired.", say: "I'm kinda tired.", note: 'kinda' },
            { text: 'There were a lot of people.', say: 'There were a lotta people.', note: 'ə lotta' },
            { text: 'Let me see.', say: 'Lemme see.', note: 'lemme' },
            { text: 'Give me a break.', say: 'Gimme a break.', note: 'gimme' },
            { text: 'Get out of here.', say: 'Get outta here.', note: 'outta' },
          ],
        },
      ],
    },
    {
      title: 'Câu hỏi nói nhanh',
      blocks: [
        {
          type: 'text',
          md: 'Câu hỏi đầu câu là nơi rút gọn "nặng" nhất. Từ để hỏi được nhấn, phần còn lại bị nén:\n\n- **What are you** → whatcha · **What do you** → whaddaya\n- **Did you** → didja · **Would you** → wudja · **Could you** → cudja',
        },
        {
          type: 'examples',
          items: [
            { text: 'What are you doing?', say: 'Whatcha doing?', note: 'whatcha doing' },
            { text: 'What do you think?', say: 'Whaddaya think?', note: 'whaddaya think' },
            { text: 'Did you call?', say: 'Didja call?', note: 'didja call' },
            { text: 'Would you mind?', say: 'Would juh mind?', note: 'wudja mind' },
            { text: "I don't know.", say: 'I dunno.', note: 'I dunno' },
          ],
        },
        {
          type: 'compare',
          clear: 'I am going to call you.',
          natural: "I'm gonna call you.",
          note: 'Bốn từ "I am going to" (5 âm tiết) chỉ còn ba âm tiết ngắn: "I\'m gonna".',
        },
        {
          type: 'compare',
          clear: 'What do you want to do?',
          natural: 'Whaddaya wanna do?',
          say: 'What do you wanna do?',
          note: 'Câu hỏi 6 từ chỉ còn 3 khối âm.',
        },
      ],
    },
    {
      title: 'Bẫy cần tránh',
      blocks: [
        {
          type: 'rule',
          title: 'going to + nơi chốn KHÔNG thành gonna',
          body: '**I\'m gonna eat** (dự định) nhưng **I\'m going to school** (đi đến trường) — "to" ở đây là giới từ chỉ hướng, chỉ đọc yếu /tə/.',
        },
        {
          type: 'rule',
          title: 'wants to → wantsta, không phải wanna',
          body: 'Chủ ngữ ngôi thứ ba: **He wants to** → he wantsta. Chỉ **want to** mới thành wanna.',
        },
        {
          type: 'tip',
          md: 'Học các dạng rút gọn **như từ vựng**: khi nghe "gonna", não bạn nên hiểu ngay "sẽ", không cần dịch ngược. Nhưng khi **viết** (email, bài thi), hãy dùng dạng đầy đủ.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['I have to go.', 'I had to go.', 'I got to go.'],
      answer: 0,
      explain: '"have to" → hafta: /v/ thành /f/ trước /t/. "had to" sẽ là "hat-tə" (không có /f/), "got to" là "gotta" (bắt đầu bằng /g/).',
    },
    {
      type: 'listen-choose',
      options: ['I want to go.', 'I want you to go.', "I won't go."],
      answer: 0,
      explain: '"want to" → wanna. "want you to" sẽ là "wan-chu-tə" (có âm "ch"), "won\'t" là "wohnt".',
    },
    {
      type: 'listen-type',
      text: "I'm [going to] be late.",
      explain: '"going to" + động từ (be) → gonna. Gõ "gonna" hoặc "going to" đều đúng.',
    },
    {
      type: 'listen-type',
      text: "We've [got to] go.",
      explain: '"got to" → gotta: hai /t/ gộp lại và bật nhẹ. Gõ "gotta" hoặc "got to" đều đúng.',
    },
    {
      type: 'spot',
      text: "I'm kind of busy.",
      prompt: 'Chạm vào cụm bị nén thành một từ.',
      unit: 'boundary',
      answers: ['kind of'],
      explain: '"kind of" → kinda: "of" chỉ còn /ə/ dính vào "kind". Nghĩa: "hơi hơi, kiểu như".',
    },
    {
      type: 'which-rule',
      written: 'want to',
      spoken: 'wanna',
      options: ['reduction', 'contraction', 'h-dropping', 'linking'],
      answer: 'reduction',
      explain: 'Cả cụm "want to" nén thành dạng cố định "wanna". Không có dấu nháy nên không phải viết tắt (contraction).',
    },
    {
      type: 'which-rule',
      written: 'a lot of',
      spoken: 'ə lotta',
      options: ['reduction', 'h-dropping', 'contraction', 'assimilation'],
      answer: 'reduction',
      explain: '"a lot of" → ə lotta: "of" chỉ còn /ə/ và /t/ bật nhẹ — một cụm rút gọn quen thuộc.',
    },
    {
      type: 'listen-choose',
      options: ['Give me a break.', 'Give him a break.', 'Give them a break.'],
      answer: 0,
      explain: '"Give me" → gimme (âm "mi"). "Give him" → gi-vim, "Give them" → gi-vəm — đều còn âm /v/.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 10. Review
// ---------------------------------------------------------------------------

const review: Lesson = {
  id: 'review',
  order: 10,
  course: 'connected',
  title: 'Tổng hợp: nghe câu dài nhiều hiện tượng',
  summary: 'Nghe câu thật có 3–5 hiện tượng cùng lúc.',
  phenomenon: null,
  minutes: 12,
  goal: 'Nghe hiểu câu dài và biết tự "giải mã" khi bị kẹt.',
  sections: [
    {
      title: 'Câu thật: nhiều hiện tượng cùng lúc',
      blocks: [
        {
          type: 'text',
          md: 'Trong câu thật, các hiện tượng **chồng lên nhau**. Một câu 10 từ có thể chứa rút gọn, mất âm H, T bật và nối âm cùng lúc. Bấm vào từng ô màu để xem mỗi chỗ thuộc hiện tượng nào.',
        },
        {
          type: 'examples',
          items: [
            { text: "I'm going to tell him what I want to do about it.", say: "I'm gonna tellim whaddai wanna do about it.", note: 'gonna · tel-lim · wha-dai · wanna · əbau-dit' },
            { text: 'Did you get a lot of work done last night?', say: 'Didja gedda lotta work done lass night?', note: 'didja · ge-də lotta · las night' },
            { text: 'What are you going to do with it?', say: 'Whatcha gonna do with it?', note: 'whatcha gonna do wi-thit' },
            { text: "I don't know what he wants to eat.", say: 'I dunno what he wants to eat.', note: 'dunno · wha-dee · wantsta' },
            { text: 'You should have told her about it.', say: "You shoulda tolder about it.", note: 'shu-dəv · tohl-dər · əbau-dit' },
            { text: 'Let me know if you need a hand.', say: 'Lemme know if yuh need a hand.', note: 'lemme · know-wif · nee-də' },
            { text: "We've got to get out of here.", say: "We've gotta get outta here.", note: 'gotta · ge-doutta' },
            { text: "I bet you can't do it.", say: "I betcha can't do it.", note: "betcha · can't được nhấn" },
          ],
        },
      ],
    },
    {
      title: 'Chiến lược nghe 3 bước',
      blocks: [
        {
          type: 'rule',
          title: '1. Bắt từ được nhấn',
          body: 'Các từ nội dung (động từ, danh từ, tính từ) được nhấn — to và rõ. Chúng cho bạn **khung nghĩa**: TELL … WANT … DO. Đừng cố nghe hết mọi từ ngay lần đầu.',
        },
        {
          type: 'rule',
          title: '2. Nhận diện "từ khối"',
          body: 'gonna, wanna, gotta, didja, whatcha, dunno… là những khối âm cố định. Học thuộc chúng như từ vựng để não nhận ra ngay.',
        },
        {
          type: 'rule',
          title: '3. Dùng ngữ pháp lấp chỗ trống',
          body: 'Các âm "ə" mơ hồ là từ chức năng. Ngữ pháp cho biết nó là gì: trước động từ → to; sau should/must → have; sau động từ → him/her/them.',
        },
        {
          type: 'compare',
          clear: 'What are you going to do about it?',
          natural: 'Whatcha gonna do about it?',
          say: 'What are you gonna do about it?',
          note: 'Khung nghĩa: WHAT … DO … ABOUT. Phần còn lại là các khối rút gọn.',
        },
      ],
    },
    {
      title: 'Luyện tiếp sau khóa học',
      blocks: [
        {
          type: 'text',
          md: 'Bạn đã học đủ 8 hiện tượng. Để tai thật sự quen, cần **lặp lại mỗi ngày**:\n\n- **Chép chính tả**: nghe và gõ lại, xem mình sai vì hiện tượng nào.\n- **Phân biệt âm**: luyện các cặp can/can\'t, him/them.\n- **Cụm từ**: ôn các khối rút gọn theo lịch lặp lại ngắt quãng.\n- **Nói nhại**: tự nói theo — nói được thì nghe được.\n- **Video thật**: áp dụng với YouTube/podcast có phụ đề.',
        },
        {
          type: 'tip',
          md: 'Trang **Tiến độ** cho bạn biết hiện tượng nào bạn hay nghe sai nhất. Hãy quay lại bài học tương ứng khi cần.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ["I'm going to tell him.", "I'm going to tell them.", "I'm going to sell him."],
      answer: 0,
      phenomena: ['reduction', 'h-dropping'],
      explain: '"I\'m gonna tel-lim": "him" mất /h/ và có nguyên âm "i". "them" sẽ là "ləm".',
    },
    {
      type: 'listen-type',
      text: "I don't [know what he] wants.",
      phenomena: ['reduction', 'h-dropping', 'flap-t'],
      explain: '"I dunno wha-dee wants": "don\'t know" → dunno, "what he" → wha-dee (mất /h/, /t/ bật).',
    },
    {
      type: 'listen-type',
      text: 'You [should have] told her.',
      phenomena: ['h-dropping'],
      explain: '"should have" → shu-dəv: "have" mất /h/ chỉ còn "əv". Gõ "should have" hoặc "should\'ve" đều đúng.',
    },
    {
      type: 'which-rule',
      written: 'did you',
      spoken: 'didja',
      options: ['reduction', 'linking', 'contraction', 'flap-t'],
      answer: 'reduction',
      explain: '"Did you" là cụm hỏi quen thuộc bị nén thành "didja" (bên trong có d + y = j).',
    },
    {
      type: 'which-rule',
      written: 'last night',
      spoken: 'las night',
      options: ['elision', 'assimilation', 'weak-form', 'h-dropping'],
      answer: 'elision',
      explain: '/t/ của "last" kẹp giữa /s/ và /n/ nên bị bỏ: las night.',
    },
    {
      type: 'spot',
      text: 'Get out of here.',
      prompt: 'Chạm vào một chỗ /t/ bật thành âm giống /d/.',
      unit: 'boundary',
      answers: ['get out', 'out of'],
      phenomena: ['flap-t'],
      explain: '"Get out of here" nghe như "ge-doutta here": /t/ của "get" và của "out" đều đứng trước nguyên âm nên bật nhẹ như /d/.',
    },
    {
      type: 'spot',
      text: "I can't believe she can do it.",
      prompt: 'Từ nào được nhấn, nguyên âm /æ/ mở?',
      unit: 'word',
      answers: ["can't"],
      phenomena: ['contraction', 'weak-form'],
      explain: '"can\'t" được nhấn (kæn). "can" thứ hai đọc yếu "kən" vì động từ DO mới là từ được nhấn.',
    },
    {
      type: 'listen-choose',
      options: ["We'll have to leave soon.", 'We have to leave soon.', 'We had to leave soon.'],
      answer: 0,
      phenomena: ['contraction', 'reduction'],
      explain: '"We\'ll hafta": có âm /l/ nhẹ sau "we" (we\'ll → wil). Không có /l/ là "We have to"; "had to" không có âm /f/.',
    },
  ],
};

/** Course "connected" (Nghe nối âm), in order. */
export const CONNECTED_LESSONS: Lesson[] = [intro, weakForm, linking, flapT, elision, assimilation, hDropping, contraction, reduction, review];

/**
 * Every lesson of every course, sorted by course (COURSE_IDS order) then order within the course. All consumers
 * (review catalog/resolve, Home plan, stats labels, pairs links) read this, so a lesson added to a course file
 * appears everywhere without further wiring.
 */
export const LESSONS: Lesson[] = sortLessons([...CONNECTED_LESSONS, ...SPELLING_LESSONS, ...IRREGULAR_LESSONS, ...LOANWORDS_LESSONS]);

/** The lessons of one course, by order (empty for unknown ids). */
export function lessonsOf(course: string | undefined | null): Lesson[] {
  return course ? lessonsInCourse(LESSONS, course) : [];
}

/** Courses that have at least one lesson, in order (the course list hides empty ones). */
export function availableCourses(): CourseMeta[] {
  return [...COURSES].sort((a, b) => a.order - b.order).filter((c) => LESSONS.some((l) => l.course === c.id));
}

/** The course after `course` (in order) that has lessons; null after the last one. */
export function nextCourseAfter(course: string): CourseMeta | null {
  const list = [...COURSES].sort((a, b) => a.order - b.order);
  const i = list.findIndex((c) => c.id === course);
  if (i < 0) return null;
  return list.slice(i + 1).find((c) => LESSONS.some((l) => l.course === c.id)) ?? null;
}

/** Lookup by id; undefined for unknown ids. */
export function getLesson(id: string | undefined | null): Lesson | undefined {
  if (!id) return undefined;
  return LESSONS.find((l) => l.id === id);
}
