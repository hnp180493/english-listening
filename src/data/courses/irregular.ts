// Course "irregular": Từ bất quy tắc (colonel, read, bought… each with a "Vì sao lại thế?" story).
// Every lesson: course: 'irregular', order 1..n (contiguous), unique id, 8 quiz items, phenomenon: null.
// Shapes and rules: docs/courses.md. Validation: npx vitest run src/features/lessons
//
// Stories ('story' blocks and `why` fields) are mainstream etymology (Etymonline / Oxford / Merriam-Webster level).
// Where scholars are not sure, the text says "người ta cho rằng" / "có lẽ". Respellings: tables.ts convention;
// words of two or more syllables are split by hyphens with the stressed syllable in capitals (KER-nəl, REK-ərd /
// ri-KORD), like courses "spelling" and "loanwords". Heteronyms never reach TTS alone (rows carry `say`, items
// play sentences).
import type { Lesson } from '../lessonTypes';

// ---------------------------------------------------------------------------
// 1. Why English spelling is "messy"
// ---------------------------------------------------------------------------

const why: Lesson = {
  id: 'ir-why',
  course: 'irregular',
  order: 1,
  title: 'Vì sao chính tả tiếng Anh "loạn"?',
  summary: 'Chữ viết đứng yên từ thời in sách, còn cách đọc thì đi tiếp.',
  phenomenon: null,
  minutes: 6,
  goal: 'Hiểu 4 lý do khiến chữ viết và âm đọc lệch nhau, để nhớ từ bất quy tắc bằng câu chuyện thay vì học vẹt.',
  sections: [
    {
      title: 'Chữ viết đứng yên, cách đọc đi tiếp',
      blocks: [
        {
          type: 'story',
          title: 'Máy in đến đúng lúc âm đang đổi',
          md: 'Năm 1476, William Caxton đưa máy in vào nước Anh. Sách in ra hàng loạt, và trong khoảng thế kỷ 16–17 chính tả dần **đứng yên**.\n\nNhưng đúng lúc đó, các nguyên âm dài của tiếng Anh đang **dịch chuyển** (Great Vowel Shift, khoảng 1400–1700). Ngày xưa người Anh đọc chữ i giống hệt người Việt: **time** đọc gần như "teem". Âm đổi, chữ thì không.',
          words: ['time', 'name', 'meet'],
        },
        {
          type: 'words',
          title: 'Chữ giữ cách đọc của 600 năm trước',
          items: [
            {
              word: 'time',
              sound: 'taim',
              ipa: '/taɪm/',
              mark: 't[i]me',
              note: 'Chữ i đọc ai, không phải i.',
              review: false,
            },
            {
              word: 'name',
              sound: 'neim',
              ipa: '/neɪm/',
              mark: 'n[a]me',
              note: 'Chữ a đọc ei.',
              review: false,
              why: 'Ngày xưa **name** đọc gần như "nah mə", chữ a đọc đúng là a. Nguyên âm dài dịch lên thành ei, chữ e cuối cũng thôi đọc.',
            },
            {
              word: 'house',
              sound: 'haus',
              ipa: '/haʊs/',
              mark: 'h[ou]se',
              say: 'They live in a big house.',
              note: 'Chữ ou đọc ao. Động từ (to house: cho ở) đọc hauz.',
              review: false,
              why: 'Ngày xưa **house** đọc gần như "hoos" (u dài). Âm u dài trượt thành ao, nhưng chữ ou ở lại.',
            },
            {
              word: 'meet',
              sound: 'meet',
              ipa: '/mit/',
              mark: 'm[ee]t',
              note: 'Chữ ee đọc i dài. Giống hệt meat (thịt).',
              review: false,
              why: 'Ngày xưa **meet** đọc gần như "mết" kéo dài. Âm này dịch lên thành i dài, nên ee giờ đọc như i.',
            },
          ],
        },
      ],
    },
    {
      title: '4 lý do chữ và âm lệch nhau',
      blocks: [
        {
          type: 'rule',
          title: 'Mỗi từ "lạ" thường rơi vào một trong 4 nhóm',
          body: '- **Âm cũ rụng mất, chữ vẫn còn**: k trong **knight**, gh trong **night** ngày xưa được đọc thật.\n- **Nguyên âm dịch chuyển**: time, name, house (ở trên).\n- **Học giả thêm chữ cho "giống Latin"**: **debt** thêm b theo Latin debitum, dù chưa ai đọc b.\n- **Từ mượn giữ chính tả gốc**: yacht (Hà Lan), queue (Pháp).',
        },
        {
          type: 'words',
          title: 'Mỗi nhóm một ví dụ',
          items: [
            {
              word: 'knight',
              sound: 'nait',
              ipa: '/naɪt/',
              mark: '(k)ni(gh)t',
              note: 'Đọc giống hệt night.',
              why: 'Ngày xưa **knight** đọc gần như "k nikht": có k, và gh là một âm xát gần giống chữ **kh** tiếng Việt (sau i thì nhẹ và mỏng hơn). Cả hai âm rụng dần, chữ thì ở lại.',
            },
            {
              word: 'debt',
              sound: 'det',
              ipa: '/dɛt/',
              mark: 'de(b)t',
              note: 'Chữ b câm.',
              why: 'Tiếng Anh mượn từ tiếng Pháp **dette**, không có b. Thế kỷ 15–16, các học giả thêm b cho giống chữ Latin **debitum**. Trong **debit** (debit card) bạn vẫn nghe b.',
            },
            {
              word: 'yacht',
              sound: 'yat',
              ipa: '/jɑt/',
              mark: 'ya(ch)t',
              note: 'Đọc như yat.',
              why: 'Mượn từ tiếng Hà Lan **jacht** ("thuyền đi săn", thuyền nhanh). Chữ ch là âm khàn của tiếng Hà Lan; người Anh không đọc âm này.',
            },
          ],
        },
      ],
    },
    {
      title: 'Học khóa này thế nào',
      blocks: [
        {
          type: 'text',
          md: 'Mỗi bài có **câu chuyện** vì sao từ viết như vậy. Từ nào có chuyện thú vị sẽ có nút **Vì sao?** bên dưới. Một câu chuyện dễ nhớ hơn mười lần đọc chính tả.\n\nCác bài tiếp theo: chữ câm, họ **ough**, từ đọc lạ hẳn, từ bị nuốt âm tiết, cùng chữ khác âm, khác chữ cùng âm, và quá khứ bất quy tắc.',
        },
        {
          type: 'tip',
          md: '**Nghe trước, rồi mới nhìn chữ.** Với từ bất quy tắc, mắt bạn sẽ "đọc theo chữ" và tai sẽ chờ sai âm. Bấm nghe 2–3 lần, nói theo, rồi so với cách đọc bên cạnh.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'time',
      options: ['time', 'team', 'Tom'],
      answer: 0,
      explain: 'time đọc taim: chữ i đọc ai. team là teem, Tom là tam.',
    },
    {
      type: 'choose',
      prompt: 'Thời Chaucer (thế kỷ 14), từ time đọc gần giống gì nhất?',
      options: ['teem (i dài)', 'taim (như bây giờ)', 'tohm'],
      answer: 0,
      explain: 'Trước Great Vowel Shift, chữ i đọc i dài như tiếng Việt: time gần như teem. Sau đó âm này trượt thành ai.',
    },
    {
      type: 'choose',
      prompt: 'Vì sao debt có chữ b mà không đọc?',
      options: [
        'Học giả thêm b cho giống chữ Latin debitum',
        'Ngày xưa người Anh đọc rõ âm b',
        'Lỗi của thợ in',
      ],
      answer: 0,
      explain: 'Tiếng Anh mượn dette từ tiếng Pháp, không có b. Học giả thêm b theo Latin debitum; chưa ai đọc b trong debt cả.',
    },
    {
      type: 'choose',
      prompt: 'Chữ k trong knight ngày xưa thế nào?',
      options: ['Được đọc thành tiếng thật', 'Luôn luôn câm', 'Do học giả thêm vào'],
      answer: 0,
      explain: 'Ngày xưa k trong knight, know, knee được đọc thật (tiếng Đức vẫn đọc k trong Knie, đầu gối). Âm k rụng dần, chữ ở lại.',
    },
    {
      type: 'listen-choose',
      options: ['debt', 'date', 'dent'],
      answer: 0,
      explain: 'debt đọc det: chữ b câm. date là deit, dent có âm n.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'Their house is very big.',
      options: ['house', 'horse', 'hose'],
      answer: 0,
      explain: 'house đọc haus: ou đọc ao. horse là hors, hose là hohz.',
    },
    {
      type: 'listen-type',
      text: 'What is your [name]?',
      explain: 'name đọc neim: chữ a đọc ei, e cuối câm. Ngày xưa chữ a trong name đọc đúng là a.',
    },
    {
      type: 'choose',
      prompt: 'Lý do lớn nhất khiến chữ viết tiếng Anh không khớp với âm đọc là gì?',
      options: [
        'Chữ được cố định khi in sách, còn cách đọc vẫn tiếp tục thay đổi',
        'Người Anh cố tình viết cho khó',
        'Mỗi vùng nước Anh viết một kiểu riêng đến tận bây giờ',
      ],
      answer: 0,
      explain: 'Máy in (từ 1476) làm chính tả đứng yên dần, trong khi Great Vowel Shift và việc rụng âm vẫn tiếp diễn.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Silent letters
// ---------------------------------------------------------------------------

const silent: Lesson = {
  id: 'ir-silent',
  course: 'irregular',
  order: 2,
  title: 'Chữ câm: know, climb, listen',
  summary: 'Chữ có trên giấy nhưng không có trong lời nói, và vì sao chúng còn đó.',
  phenomenon: null,
  minutes: 11,
  goal: 'Nhận ra các chữ câm hay gặp (kn, wr, gn, mb, l, t, h, w…) để nghe ra từ dù âm không giống chữ.',
  sections: [
    {
      title: 'kn, wr: âm từng có thật',
      blocks: [
        {
          type: 'story',
          title: 'k và w từng được đọc',
          md: 'Ngày xưa người Anh đọc **know** là "k noh", **write** là "w rait": cả hai phụ âm đều kêu. Cụm **wr** ở đầu từ rút còn r khoảng thế kỷ 15–17; cụm **kn** rút còn n muộn hơn, khoảng cuối thế kỷ 17 đến thế kỷ 18.\n\nTiếng Đức vẫn giữ: **Knie** (đầu gối) đọc rõ k. Gặp kn hay wr ở đầu từ, bạn chỉ nghe n và r.',
          words: ['know', 'knee', 'write'],
        },
        {
          type: 'words',
          items: [
            { word: 'know', sound: 'noh', ipa: '/noʊ/', mark: '(k)now', note: 'Giống hệt no.' },
            {
              word: 'knife',
              sound: 'naif',
              ipa: '/naɪf/',
              mark: '(k)nife',
              why: 'Tiếng Anh cổ **cnīf**: k đọc rõ. Tiếng Pháp mượn từ này thành **canif** (dao nhíp) và vẫn giữ âm k.',
            },
            { word: 'knee', sound: 'nee', ipa: '/ni/', mark: '(k)nee' },
            { word: 'knock', sound: 'nak', ipa: '/nɑk/', mark: '(k)nock' },
            { word: 'write', sound: 'rait', ipa: '/raɪt/', mark: '(w)rite', note: 'Giống hệt right.' },
            { word: 'wrong', sound: 'rong', ipa: '/rɔŋ/', mark: '(w)rong' },
          ],
        },
      ],
    },
    {
      title: 'g câm trước n: sign, foreign',
      blocks: [
        {
          type: 'rule',
          title: 'gn cuối từ: g không đọc',
          body: 'Khi **gn** đứng cuối từ, g không đọc: sign, design, foreign, reign. Thêm đuôi thì g có khi "sống lại": **signature**, **signal**, **designate**.\n\nKhác với kn, chữ g ở đây chưa từng là âm g trong tiếng Anh: sign, reign đến từ tiếng Pháp (gn của Pháp là một âm giống "nh"), còn foreign thì g được thêm vào sau.',
        },
        {
          type: 'words',
          items: [
            {
              word: 'sign',
              sound: 'sain',
              ipa: '/saɪn/',
              mark: 'si(g)n',
              note: 'g câm, nhưng signature, signal thì đọc g.',
              why: 'Từ tiếng Pháp **signe**, gốc Latin **signum**. Trong sign, g không đọc; trong **signature** và **signal**, g "sống lại". Nhớ cặp này là nhớ chữ g.',
            },
            { word: 'design', sound: 'di-ZAIN', ipa: '/dɪˈzaɪn/', mark: 'desi(g)n', note: 'g câm, nhưng designate thì đọc g.' },
            {
              word: 'foreign',
              sound: 'FOR-ən',
              ipa: '/ˈfɔrən/',
              mark: 'forei(g)n',
              why: 'Tiếng Anh trung đại viết **forein**, không có g. Người ta cho rằng g được thêm vào theo mẫu **reign**, **sovereign**.',
            },
          ],
        },
      ],
    },
    {
      title: 'b câm: mb và bt',
      blocks: [
        {
          type: 'rule',
          title: 'm + b ở cuối từ: b câm',
          body: 'Sau m ở cuối từ, b không đọc: climb, comb, thumb, lamb. Trong **debt**, **doubt**, **subtle** (và debtor, doubtful), b trước t cũng câm. Nhưng đừng áp dụng cho mọi bt: obtain, subtitle vẫn đọc b.\n\nMẹo: tìm từ "họ hàng" có b được đọc: **debit** (debt), **dubious** (doubt).',
        },
        {
          type: 'words',
          items: [
            {
              word: 'climb',
              sound: 'klaim',
              ipa: '/klaɪm/',
              mark: 'clim(b)',
              note: 'Không có âm b ở cuối.',
              why: 'Tiếng Anh cổ **climban**, **lamb**, **camb** (comb) đọc rõ b. Khoảng thế kỷ 13–14, mb ở cuối từ rút còn m: môi đã khép cho m, bật thêm b thấy thừa. Trong những từ mà mb nằm giữa từ, b vẫn còn: number, timber.',
            },
            { word: 'comb', sound: 'kohm', ipa: '/koʊm/', mark: 'com(b)' },
            {
              word: 'thumb',
              sound: 'thum',
              ipa: '/θʌm/',
              mark: 'thum(b)',
              why: 'Tiếng Anh cổ viết **þūma**, không hề có b. Chữ b được thêm vào sau này, có lẽ để giống các từ như lamb, climb, vốn từng đọc b thật.',
            },
            { word: 'lamb', sound: 'lam', ipa: '/læm/', mark: 'lam(b)' },
            {
              word: 'debt',
              sound: 'det',
              ipa: '/dɛt/',
              mark: 'de(b)t',
              why: 'Mượn từ tiếng Pháp **dette**. Học giả thêm b theo Latin **debitum**.',
            },
            {
              word: 'doubt',
              sound: 'daut',
              ipa: '/daʊt/',
              mark: 'dou(b)t',
              why: 'Tiếng Anh trung đại viết **doute** (từ tiếng Pháp). Học giả thêm b theo Latin **dubitare**. Trong **dubious** bạn vẫn nghe b.',
            },
          ],
        },
      ],
    },
    {
      title: 'l câm: walk, half, could',
      blocks: [
        {
          type: 'story',
          title: 'could "mượn" chữ l của should',
          md: '**should** và **would** ngày xưa có âm l thật (tiếng Anh cổ sceolde, wolde). Còn **could** thì không: thời trung đại nó viết **coude**.\n\nKhoảng thế kỷ 15–16, người ta thêm l vào could cho "đồng bộ" với should, would. Chữ l này chưa bao giờ được đọc, còn l của should, would cũng rụng dần, nên giờ ba từ vần với nhau: cud, shud, wud.',
          words: ['could', 'should', 'would'],
        },
        {
          type: 'words',
          items: [
            { word: 'walk', sound: 'wok', ipa: '/wɔk/', mark: 'wa(l)k', note: 'Không có l. Khác work (werk).' },
            { word: 'talk', sound: 'tok', ipa: '/tɔk/', mark: 'ta(l)k' },
            { word: 'half', sound: 'haf', ipa: '/hæf/', mark: 'ha(l)f' },
            {
              word: 'calm',
              sound: 'kahm',
              ipa: '/kɑm/',
              mark: 'ca(l)m',
              note: 'Một số người Mỹ vẫn đọc nhẹ âm l.',
              why: 'Ngày xưa l trong walk, talk, half, calm đều được đọc. Khoảng thế kỷ 15–17, l sau a, o và trước k, f, m rụng dần.',
            },
            { word: 'could', sound: 'cud', ipa: '/kʊd/', mark: 'cou(l)d' },
            { word: 'should', sound: 'shud', ipa: '/ʃʊd/', mark: 'shou(l)d' },
            { word: 'would', sound: 'wud', ipa: '/wʊd/', mark: 'wou(l)d', note: 'Giống hệt wood.' },
            {
              word: 'salmon',
              sound: 'SA-mən',
              ipa: '/ˈsæmən/',
              mark: 'sa(l)mon',
              why: 'Tiếng Anh trung đại viết **samoun** (từ tiếng Pháp saumon). Học giả thêm l theo Latin **salmo**; chưa ai đọc l.',
            },
          ],
        },
      ],
    },
    {
      title: 't và h câm: listen, hour',
      blocks: [
        {
          type: 'words',
          items: [
            {
              word: 'listen',
              sound: 'LIS-ən',
              ipa: '/ˈlɪsən/',
              mark: 'lis(t)en',
              why: 'Tiếng Anh cổ **hlysnan**, không có t. Chữ t chen vào sau này, có lẽ theo từ cổ **list** (nghe), và không được đọc. Trước en, le, cụm st thường câm t: castle, fasten, whistle (và cả Christmas).',
            },
            { word: 'castle', sound: 'KAS-əl', ipa: '/ˈkæsəl/', mark: 'cas(t)le' },
            {
              word: 'often',
              sound: 'OF-ən',
              ipa: '/ˈɔfən/',
              mark: 'of(t)en',
              note: 'Nhiều người cũng đọc OF-tən: cả hai đều đúng.',
              why: 'Âm t trong often rụng từ khoảng thế kỷ 17. Về sau, vì nhìn thấy chữ t, nhiều người bắt đầu đọc lại nó. Nên giờ bạn sẽ nghe cả hai.',
            },
            {
              word: 'hour',
              sound: 'AU-ər',
              ipa: '/ˈaʊər/',
              mark: '(h)our',
              note: 'Nói an hour, vì từ bắt đầu bằng nguyên âm. Với nhiều người, giống hệt our.',
              why: 'Từ Latin **hora**, qua tiếng Pháp. Tiếng Pháp đã không đọc h từ lâu, nên tiếng Anh mượn âm không có h, nhưng giữ chữ h.',
            },
            { word: 'honest', sound: 'A-nəst', ipa: '/ˈɑnəst/', mark: '(h)onest', note: 'an honest man. Cùng chuyện với hour: h câm theo tiếng Pháp.' },
            { word: 'honor', sound: 'A-nər', ipa: '/ˈɑnər/', mark: '(h)onor', note: 'Anh – Anh viết honour. h câm như hour.' },
            {
              word: 'ghost',
              sound: 'gohst',
              ipa: '/ɡoʊst/',
              mark: 'g(h)ost',
              why: 'Tiếng Anh cổ viết **gāst**, không có h. Người ta cho rằng chữ h xuất hiện từ thời Caxton, do ảnh hưởng của tiếng Flemish **gheest**.',
            },
            {
              word: 'Thomas',
              sound: 'TA-məs',
              ipa: '/ˈtɑməs/',
              mark: 'T(h)omas',
              note: 'th ở đây đọc t.',
              why: 'Cách viết th lấy từ tên Hy Lạp; người Anh (và người Pháp) vẫn đọc t.',
            },
          ],
        },
      ],
    },
    {
      title: 'p, n, s, w câm',
      blocks: [
        {
          type: 'words',
          items: [
            {
              word: 'psychology',
              sound: 'sai-KA-lə-ji',
              ipa: '/saɪˈkɑlədʒi/',
              mark: '(p)sychology',
              why: 'Từ gốc Hy Lạp **psychē** (tâm hồn). Người Hy Lạp đọc cả p và s; tiếng Anh bỏ p ở đầu từ.',
            },
            {
              word: 'autumn',
              sound: 'O-təm',
              ipa: '/ˈɔtəm/',
              mark: 'autum(n)',
              note: 'Người Mỹ thường nói fall.',
              why: 'Từ Latin **autumnus**. Chữ n "sống lại" trong **autumnal**: o-TUM-nəl.',
            },
            {
              word: 'column',
              sound: 'KA-ləm',
              ipa: '/ˈkɑləm/',
              mark: 'colum(n)',
              why: 'Từ Latin **columna**. Chữ n "sống lại" trong **columnist** (người viết chuyên mục).',
            },
            {
              word: 'island',
              sound: 'AI-lənd',
              ipa: '/ˈaɪlənd/',
              mark: 'i(s)land',
              why: 'Tiếng Anh cổ là **īgland**, không có s. Thế kỷ 16, người ta thêm s vì tưởng nó họ hàng với **isle** (gốc Latin insula). Thật ra hai từ không cùng gốc.',
            },
            {
              word: 'aisle',
              sound: "I'll",
              ipa: '/aɪl/',
              mark: 'ai(s)le',
              note: "Lối đi giữa các hàng ghế. Đọc giống hệt I'll và isle (đảo nhỏ).",
              why: 'Từ tiếng Pháp cổ **ele** (cánh, gian bên). Chữ s cũng được thêm vào vì nhầm với **isle**.',
            },
            {
              word: 'two',
              sound: 'too',
              ipa: '/tu/',
              mark: 't(w)o',
              note: 'Giống hệt too, to (khi đọc rõ).',
              why: 'Tiếng Anh cổ **twā**: w được đọc. Âm w vẫn còn trong họ hàng của nó: **twin**, **twelve**, **twenty**, **twice**.',
            },
            {
              word: 'sword',
              sound: 'sord',
              ipa: '/sɔrd/',
              mark: 's(w)ord',
              why: 'Tiếng Anh cổ **sweord**: w đọc rõ. Âm w đứng giữa s và o (nguyên âm tròn môi) bị nuốt dần, giống chuyện của **two**.',
            },
            {
              word: 'answer',
              sound: 'AN-sər',
              ipa: '/ˈænsər/',
              mark: 'ans(w)er',
              why: 'Tiếng Anh cổ **andswaru**: w đọc rõ. Sau s, ở âm tiết không nhấn, âm w rụng dần (giống sword), chữ thì ở lại.',
            },
          ],
        },
        {
          type: 'tip',
          md: '**Mẹo nhớ chữ câm:** tìm từ họ hàng có chữ đó được đọc. sign → signature, autumn → autumnal, column → columnist, two → twin, debt → debit.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'silent-letter',
      word: 'climb',
      silent: [4],
      explain: 'climb đọc klaim: b sau m ở cuối từ là chữ câm.',
    },
    {
      type: 'silent-letter',
      word: 'doubt',
      silent: [3],
      explain: 'doubt đọc daut: b do học giả thêm vào theo Latin dubitare, chưa bao giờ được đọc.',
    },
    {
      type: 'silent-letter',
      word: 'island',
      silent: [1],
      explain: 'island đọc AI-lənd: chữ s được thêm vào thế kỷ 16 vì nhầm với isle.',
    },
    {
      type: 'silent-letter',
      word: 'column',
      silent: [5],
      explain: 'column đọc KA-ləm: n cuối câm. Nó "sống lại" trong columnist.',
    },
    {
      type: 'listen-choose',
      options: ['walk', 'work', 'woke'],
      answer: 0,
      explain: 'walk đọc wok: chữ l câm, nguyên âm o mở. work là werk, woke là wohk.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'honest',
      options: ['honest', 'hottest', 'harmless'],
      answer: 0,
      explain: 'honest đọc A-nəst: chữ h câm, nên nói an honest man. hottest có h và t (HA-dəst), harmless có h và m.',
    },
    {
      type: 'listen-type',
      text: 'Did you [answer] the email?',
      explain: 'answer đọc AN-sər: chữ w câm (tiếng Anh cổ andswaru có âm w).',
    },
    {
      type: 'choose',
      prompt: 'Trong từ nào chữ g của sign được đọc thành tiếng?',
      show: 'sign',
      options: ['signature', 'signing', 'signs'],
      answer: 0,
      explain: 'signature đọc SIG-nə-chər: g "sống lại". Trong signing, signs, g vẫn câm như trong sign.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. ough / augh
// ---------------------------------------------------------------------------

const ough: Lesson = {
  id: 'ir-though', // not 'ir-ough': respell.test reads every hyphenated piece as a respelling
  course: 'irregular',
  order: 3,
  title: 'Họ ough: though, through, tough',
  summary: 'Một cụm chữ, sáu cách đọc kiểu Mỹ, và âm "kh" đã biến mất.',
  phenomenon: null,
  minutes: 8,
  goal: 'Nghe ra các cách đọc của ough và augh, và biết vì sao chúng khác nhau.',
  sections: [
    {
      title: 'Âm kh đã biến mất',
      blocks: [
        {
          type: 'story',
          title: 'gh từng là âm kh',
          md: 'Ngày xưa chữ gh là một âm khàn trong cổ họng, rất giống chữ **kh** trong tiếng Việt "không" (sau i, e thì nhẹ và mỏng hơn, như trong night). Tiếng Đức vẫn còn âm này: **Nacht** (night), **acht** (eight), **lachen** (laugh).\n\nKhoảng thế kỷ 15–17, âm kh của tiếng Anh biến mất theo hai cách: hoặc **câm hẳn** (though, bought, night), hoặc **đổi thành f** (tough, cough, laugh). Nguyên âm phía trước cũng đổi mỗi từ một kiểu, nên ough mới có nhiều cách đọc như vậy.',
          words: ['night', 'eight', 'laugh'],
        },
      ],
    },
    {
      title: 'ough đọc oh, oo, au',
      blocks: [
        {
          type: 'text',
          md: 'Kiểu Mỹ, ough có **6 cách đọc**: oh, oo, au (phần này), rồi uf, of, ot (phần sau).',
        },
        {
          type: 'words',
          items: [
            { word: 'though', sound: 'thoh', ipa: '/ðoʊ/', mark: 'th[ough]', note: 'ough = oh.' },
            { word: 'dough', sound: 'doh', ipa: '/doʊ/', mark: 'd[ough]', note: 'Bột nhào. Vần với though. Giống hệt doe (hươu cái).' },
            {
              word: 'thorough',
              sound: 'THER-oh',
              ipa: '/ˈθɝoʊ/',
              mark: 'thor[ough]',
              note: 'Kỹ lưỡng. Cũng là oh. Anh – Anh đọc THU-rə.',
              why: 'thorough và **through** vốn là một từ (tiếng Anh cổ **þurh**). Một dạng giữ hai âm tiết và mang nghĩa "trọn vẹn, kỹ lưỡng", dạng kia rút gọn thành through.',
            },
            { word: 'through', sound: 'throo', ipa: '/θru/', mark: 'thr[ough]', note: 'ough = u dài. Giống hệt threw.' },
            {
              word: 'bough',
              sound: 'bau',
              ipa: '/baʊ/',
              mark: 'b[ough]',
              note: 'Cành cây lớn. ough = ao, vần với cow. Giống hệt bow (cúi chào).',
            },
            { word: 'drought', sound: 'draut', ipa: '/draʊt/', mark: 'dr[ough]t', note: 'Hạn hán. Vần với out, không vần với bought.' },
          ],
        },
      ],
    },
    {
      title: 'ough đọc uf, of, ot',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'tough', sound: 'tuf', ipa: '/tʌf/', mark: 't[ough]', note: 'ough = uf.' },
            { word: 'rough', sound: 'ruf', ipa: '/rʌf/', mark: 'r[ough]' },
            { word: 'enough', sound: 'i-NUF', ipa: '/ɪˈnʌf/', mark: 'en[ough]', note: 'Nhấn âm sau: i-NUF.' },
            { word: 'cough', sound: 'kof', ipa: '/kɔf/', mark: 'c[ough]', note: 'ough = of.' },
            { word: 'bought', sound: 'bot', ipa: '/bɔt/', mark: 'b[ough]t', note: 'ought = ot.' },
            { word: 'thought', sound: 'thot', ipa: '/θɔt/', mark: 'th[ough]t' },
          ],
        },
      ],
    },
    {
      title: 'augh: daughter, laugh',
      blocks: [
        {
          type: 'rule',
          title: 'augh thường đọc o',
          body: 'augh thường đọc **o** (gh câm): daughter, caught, taught. Ngoại lệ hay gặp nhất là **laugh**: gh đổi thành f, đọc laf.',
        },
        {
          type: 'words',
          items: [
            { word: 'daughter', sound: 'DO-dər', ipa: '/ˈdɔɾər/', mark: 'd[augh]ter', note: 't giữa hai nguyên âm bật thành d.' },
            { word: 'caught', sound: 'kot', ipa: '/kɔt/', mark: 'c[augh]t' },
            { word: 'taught', sound: 'tot', ipa: '/tɔt/', mark: 't[augh]t' },
            { word: 'laugh', sound: 'laf', ipa: '/læf/', mark: 'lau[gh]', note: 'gh = f.' },
            { word: 'laughter', sound: 'LAF-tər', ipa: '/ˈlæftər/', mark: 'lau[gh]ter' },
          ],
        },
      ],
    },
    {
      title: 'Mẹo nhớ và nghe trong câu',
      blocks: [
        {
          type: 'tip',
          md: '- **ought** ở cuối gần như luôn là **ot**: bought, brought, thought, fought, ought. Ngoại lệ: **drought** (draut).\n- **ough** cuối từ mà bạn nghe có âm f thì thường là **uf**: tough, rough, enough. Ngoại lệ: **cough** (kof), **trough** (trof, máng ăn).\n- Còn lại (though, through, bough, thorough): học thuộc từng từ.',
        },
        {
          type: 'examples',
          title: 'Nghe trong câu',
          items: [
            { text: 'I thought you bought enough bread.', note: 'thot, bot, inuf.' },
            { text: 'It was tough, but we got through it.', note: 'tuf, throo.' },
            { text: 'My daughter laughed at the joke.', note: 'DO-dər, laft.' },
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'tough',
      options: ['tough', 'though', 'through'],
      answer: 0,
      explain: 'tough đọc tuf (gh thành f). though là thoh, through là throo.',
    },
    {
      type: 'listen-choose',
      options: ['though', 'through', 'thought'],
      answer: 2,
      explain: 'thought đọc thot, có âm t ở cuối. though là thoh, through là throo.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'cough',
      options: ['cough', 'cow', 'cuff'],
      answer: 0,
      explain: 'cough đọc kof: o mở và f. cow là kau, cuff là kuf.',
    },
    {
      type: 'listen-type',
      text: 'There is [enough] food for everyone.',
      explain: 'enough đọc i-NUF: ough ở đây là uf, nhấn âm sau.',
    },
    {
      type: 'choose',
      prompt: 'Từ này vần với từ nào?',
      show: 'bough',
      options: ['cow', 'go', 'cuff', 'off'],
      answer: 0,
      explain: 'bough đọc bau, vần với cow. Đừng đọc theo though (thoh) hay tough (tuf).',
    },
    {
      type: 'choose',
      prompt: 'Từ này vần với từ nào?',
      show: 'drought',
      options: ['out', 'bought', 'boat'],
      answer: 0,
      explain: 'drought đọc draut, vần với out. Đây là ngoại lệ của ought (thường là ot như bought).',
    },
    {
      type: 'choose',
      prompt: 'Chữ gh trong từ này đọc thế nào?',
      show: 'laugh',
      options: ['/f/', 'Không đọc', '/g/'],
      answer: 0,
      explain: 'gh ở cuối laugh đọc /f/: laf. Âm kh ngày xưa đổi thành f.',
    },
    {
      type: 'choose',
      prompt: 'Ngày xưa gh trong bought, daughter đọc gần giống âm nào của tiếng Việt?',
      options: ['kh (như trong "không")', 'g (như trong "gà")', 'ph (như trong "phở")'],
      answer: 0,
      explain: 'gh từng là âm khàn trong cổ họng, giống kh tiếng Việt (sau i, như trong night, thì nhẹ và mỏng hơn). Tiếng Đức vẫn giữ: Nacht, acht.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. Words that are simply odd
// ---------------------------------------------------------------------------

const oddWords: Lesson = {
  id: 'ir-odd-words',
  course: 'irregular',
  order: 4,
  title: 'Từ đọc lạ hẳn: colonel → KER-nəl',
  summary: 'colonel, women, said, one: nhìn chữ đoán âm là sai, nhưng câu chuyện giúp bạn nhớ.',
  phenomenon: null,
  minutes: 12,
  goal: 'Nghe ra những từ thông dụng đọc khác hẳn chữ viết, và nhớ chúng qua câu chuyện.',
  sections: [
    {
      title: 'Chuyện của colonel',
      blocks: [
        {
          type: 'story',
          title: 'Chữ l, nhưng đọc r',
          md: 'Từ gốc là tiếng Ý **colonnello**: người chỉ huy một "cột" (colonna, column) lính. Người Pháp đổi l thành r và đọc **coronel**; người Anh mượn từ tiếng Pháp nên cũng đọc có r.\n\nTừ cuối thế kỷ 16, sách quân sự dịch từ tiếng Ý bắt đầu viết **colonel**, và đến giữa thế kỷ 17 thì cách viết này thắng hẳn. Chữ đổi, nhưng miệng người ta vẫn nói kiểu cũ: **KER-nəl**, giống hệt kernel (hạt nhân).',
          words: ['colonel', 'column'],
        },
        {
          type: 'words',
          items: [
            {
              word: 'colonel',
              sound: 'KER-nəl',
              ipa: '/ˈkɝnəl/',
              mark: '[col](o)nel',
              note: 'Đại tá. Chữ l đọc thành r, chữ o thứ hai câm. Giống hệt kernel (hạt nhân).',
            },
          ],
        },
      ],
    },
    {
      title: 'o đọc u: love, come, son',
      blocks: [
        {
          type: 'story',
          title: 'Chữ u bị đổi thành o',
          md: 'Ngày xưa sách được chép tay. Các chữ **u, m, n, v, w** đều viết bằng những nét sổ giống nhau, nên **sum** (some), **luve** (love), **sune** (son) trông như một hàng nét dính liền, rất khó đọc.\n\nNgười ta cho rằng vì vậy người chép sách đổi u thành **o** khi đứng cạnh m, n, v, w. Chữ đổi, âm thì vẫn là u (như cup).',
          words: ['love', 'come', 'son'],
        },
        {
          type: 'words',
          items: [
            { word: 'love', sound: 'luv', ipa: '/lʌv/', mark: 'l[o]ve' },
            { word: 'come', sound: 'kum', ipa: '/kʌm/', mark: 'c[o]me' },
            { word: 'some', sound: 'sum', ipa: '/sʌm/', mark: 's[o]me', note: 'Giống hệt sum (tổng).' },
            { word: 'son', sound: 'sun', ipa: '/sʌn/', mark: 's[o]n', note: 'Giống hệt sun (mặt trời).' },
            { word: 'won', sound: 'wun', ipa: '/wʌn/', mark: 'w[o]n', note: 'Quá khứ của win. Giống hệt one.' },
            { word: 'wonder', sound: 'WUN-dər', ipa: '/ˈwʌndər/', mark: 'w[o]nder', note: 'Khác wander (WAN-dər, đi lang thang).' },
            { word: 'honey', sound: 'HU-ni', ipa: '/ˈhʌni/', mark: 'h[o]ney' },
            { word: 'above', sound: 'ə-BUV', ipa: '/əˈbʌv/', mark: 'ab[o]ve' },
          ],
        },
      ],
    },
    {
      title: 'Từ hằng ngày (1): said, friend, busy',
      blocks: [
        {
          type: 'words',
          items: [
            {
              word: 'said',
              sound: 'sed',
              ipa: '/sɛd/',
              mark: 's[ai]d',
              note: 'Không phải seid.',
              why: 'Người ta cho rằng said ngày xưa có nguyên âm dài hơn. Vì được dùng quá thường xuyên, nó bị rút ngắn thành e; chữ viết vẫn giữ ai.',
            },
            {
              word: 'says',
              sound: 'sez',
              ipa: '/sɛz/',
              mark: 's[ay]s',
              note: 'Không phải seiz.',
              why: 'Cùng chuyện với said: người ta cho rằng vì dùng quá thường xuyên nên nguyên âm bị rút ngắn, còn chữ ay thì ở lại.',
            },
            {
              word: 'friend',
              sound: 'frend',
              ipa: '/frɛnd/',
              mark: 'fr[ie]nd',
              why: 'Tiếng Anh cổ **frēond** có nguyên âm dài. Nguyên âm bị rút ngắn, còn chữ ie thì ở lại.',
            },
            {
              word: 'busy',
              sound: 'BI-zi',
              ipa: '/ˈbɪzi/',
              mark: 'b[u]sy',
              note: 'u đọc i.',
              why: 'Tiếng Anh cổ **bisig**. Miền Tây nước Anh đọc và viết u (một âm giống ü tiếng Đức); London đọc i. Chữ viết theo miền Tây, cách đọc theo London.',
            },
            { word: 'business', sound: 'BIZ-nəs', ipa: '/ˈbɪznəs/', mark: 'b[u]s(i)ness', note: 'Chỉ 2 âm tiết: BIZ-nəs.' },
            {
              word: 'bury',
              sound: 'BE-ri',
              ipa: '/ˈbɛri/',
              mark: 'b[u]ry',
              note: 'Giống hệt berry.',
              why: 'Giống busy: chữ u lấy từ cách viết miền Tây nước Anh, còn cách đọc e lấy từ vùng Kent.',
            },
          ],
        },
        {
          type: 'examples',
          title: 'Nghe trong câu',
          items: [{ text: 'My friend is in business.', note: 'frend, BIZ-nəs.' }],
        },
      ],
    },
    {
      title: 'Từ hằng ngày (2): women, one, does',
      blocks: [
        {
          type: 'words',
          items: [
            {
              word: 'women',
              sound: 'WI-min',
              ipa: '/ˈwɪmɪn/',
              mark: 'w[o]men',
              note: 'woman = WU-mən, women = WI-min.',
              why: 'woman bắt nguồn từ **wīfmann** (wife + man). Âm f rơi mất, còn wimman. Ở số ít, âm w làm nguyên âm tròn lại thành WU-mən; số nhiều vẫn giữ âm i, nhưng chữ viết giữ chữ o của số ít.',
            },
            {
              word: 'one',
              sound: 'wun',
              ipa: '/wʌn/',
              note: 'Giống hệt won.',
              why: 'Tiếng Anh cổ **ān**, không có âm w. Âm w xuất hiện ở một số vùng khoảng thế kỷ 14–15 rồi lan ra cả nước. Họ hàng của one vẫn không có w: **an**, **alone**, **only**.',
            },
            {
              word: 'once',
              sound: 'wuns',
              ipa: '/wʌns/',
              note: 'Cũng có âm w như one.',
              why: 'Ngày xưa viết **ones**: one + s, nghĩa là "một lần". Sau này đổi thành -ce để cho biết đuôi đọc s, không phải z (giống twice, hence).',
            },
            {
              word: 'does',
              sound: 'duz',
              ipa: '/dʌz/',
              say: 'What does it mean?',
              note: 'Không phải dohz (does là số nhiều của doe, con hươu cái, mới đọc dohz).',
              why: 'Giống blood: o trong does, done ngày xưa là o dài (như trong **do**). Sau Great Vowel Shift nó thành u dài (do đọc doo), rồi trong does, done bị rút ngắn và đổi thành u như cup.',
            },
            { word: 'done', sound: 'dun', ipa: '/dʌn/', note: 'Cùng chuyện với does.' },
            {
              word: 'blood',
              sound: 'blud',
              ipa: '/blʌd/',
              mark: 'bl[oo]d',
              why: 'Ngày xưa oo trong blood đọc như trong **food**. Âm này bị rút ngắn sớm, rồi đổi thành u như trong cup.',
            },
            { word: 'flood', sound: 'flud', ipa: '/flʌd/', mark: 'fl[oo]d', note: 'Vần với blood.' },
          ],
        },
        {
          type: 'examples',
          title: 'Nghe trong câu',
          items: [{ text: 'She said the women were busy.', note: 'sed, WI-min, BI-zi.' }],
        },
      ],
    },
    {
      title: 'Từ ít gặp: âm rụng, âm đổi chỗ',
      blocks: [
        {
          type: 'words',
          items: [
            {
              word: 'iron',
              sound: 'AI-ərn',
              ipa: '/ˈaɪərn/',
              note: 'Âm r nghe như đứng sau: AI-ərn.',
              why: 'Tiếng Anh cổ **īren**: âm r đứng trước nguyên âm cuối, nên sau Great Vowel Shift từ này đọc AI-rən (vài vùng ở Scotland, Ireland vẫn đọc gần như vậy). Ở phần lớn giọng Anh, Mỹ, âm r "nhảy" ra sau ə thành AI-ərn, còn chữ viết giữ thứ tự cũ.',
            },
            {
              word: 'Wednesday',
              sound: 'WENZ-dei',
              ipa: '/ˈwɛnzdeɪ/',
              mark: 'We(d)n(e)sday',
              note: 'Chỉ 2 âm tiết.',
              why: 'Tiếng Anh cổ **Wōdnesdæg**: ngày của thần Woden (Odin). Lời nói rút gọn thành wenz, chữ viết giữ đủ tên thần.',
            },
            {
              word: 'February',
              sound: 'FEB-yoo-e-ri',
              ipa: '/ˈfɛbjuˌɛri/',
              note: 'Người Mỹ thường bỏ âm r đầu.',
              why: 'Từ Latin **Februarius**. Hai âm r đứng gần nhau khó đọc, nên âm r đầu thường rơi mất. Cách đọc FEB-yoo-e-ri giờ đã được từ điển Mỹ ghi là chuẩn, bên cạnh FEB-roo-e-ri.',
            },
            {
              word: 'sew',
              sound: 'soh',
              ipa: '/soʊ/',
              mark: 's[ew]',
              note: 'May vá. Giống hệt so, không phải soo.',
              why: 'Tiếng Anh cổ **siwian**. Thời trung đại từ này có nhiều dạng, đọc gần soo hoặc soh. Người ta cho rằng chữ ew giữ dấu vết kiểu soo, còn cách đọc soh thắng. Giờ sew đọc giống hệt **so** và **sow** (gieo hạt).',
            },
          ],
        },
      ],
    },
    {
      title: 'Từ ít gặp: chữ viết theo Latin, Pháp',
      blocks: [
        {
          type: 'words',
          items: [
            {
              word: 'choir',
              sound: 'KWAI-ər',
              ipa: '/ˈkwaɪər/',
              mark: '[ch]oir',
              note: 'Dàn hợp xướng.',
              why: 'Thời trung đại từ này viết **quere**, khá sát với âm kw. Khoảng thế kỷ 17 người ta viết lại theo Latin chorus thành **choir**, nhưng vẫn đọc kw.',
            },
            {
              word: 'queue',
              sound: 'kyoo',
              ipa: '/kju/',
              mark: 'q[ueue]',
              note: 'Hàng người chờ. Người Mỹ thường nói line. Giống hệt cue và tên chữ Q.',
              why: 'Tiếng Pháp **queue** nghĩa là "cái đuôi": một hàng người nối đuôi nhau. Bốn chữ ueue chỉ là một âm yoo.',
            },
            {
              word: 'lettuce',
              sound: 'LE-dəs',
              ipa: '/ˈlɛɾəs/',
              mark: 'lett[uce]',
              note: 'Rau xà lách. uce đọc əs.',
              why: 'Từ tiếng Pháp cổ **laitues**, gốc Latin **lactuca**, từ **lac** (sữa), vì cọng rau có nhựa trắng như sữa. Âm tiết cuối không nhấn nên uce chỉ còn əs, giống purchase, furnace.',
            },
            {
              word: 'subtle',
              sound: 'SU-dəl',
              ipa: '/ˈsʌɾəl/',
              mark: 'su(b)tle',
              note: 'b câm; t bật nhẹ thành d.',
              why: 'Tiếng Anh trung đại viết **sotil** (từ tiếng Pháp). Học giả thêm b theo Latin **subtilis**.',
            },
            {
              word: 'recipe',
              sound: 'RE-sə-pi',
              ipa: '/ˈrɛsəpi/',
              note: 'e cuối được đọc: 3 âm tiết.',
              why: 'Tiếng Latin **recipe** nghĩa là "hãy lấy", chữ bác sĩ viết ở đầu đơn thuốc. Vì là chữ Latin nên e cuối được đọc.',
            },
            {
              word: 'receipt',
              sound: 'ri-SEET',
              ipa: '/rɪˈsit/',
              mark: 'recei(p)t',
              note: 'Hóa đơn. Khác recipe.',
              why: 'Tiếng Anh trung đại viết **receite**. Học giả thêm p theo Latin **recepta**. Trong **reception** bạn vẫn nghe p.',
            },
          ],
        },
        {
          type: 'tip',
          md: '**recipe** (công thức nấu ăn, RE-sə-pi) và **receipt** (hóa đơn, ri-SEET) rất hay bị nhầm. Nhớ: receipt có p câm, recipe thì đọc hết.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'colonel',
      options: ['colonel', 'column', 'collar'],
      answer: 0,
      explain: 'colonel đọc KER-nəl, có âm r dù chữ viết không có r. column là KA-ləm, collar là KA-lər.',
    },
    {
      type: 'listen-choose',
      options: ['women', 'woman', 'window'],
      answer: 0,
      explain: 'women đọc WI-min (âm i), woman đọc WU-mən (âm u). Chỉ khác nhau ở nguyên âm đầu.',
    },
    {
      type: 'listen-type',
      text: 'She [said] she was tired.',
      explain: 'said đọc sed, không phải seid. Chữ ai ở đây đọc như e.',
    },
    {
      type: 'listen-choose',
      options: ['one', 'own', 'on'],
      answer: 0,
      explain: 'one đọc wun, có âm w ở đầu. own là ohn (âm oh); on không có w và nguyên âm là a mở.',
    },
    {
      type: 'choose',
      prompt: 'Wednesday đọc mấy âm tiết?',
      show: 'Wednesday',
      options: ['2: WENZ-dei', '3: WED-nəz-dei'],
      answer: 0,
      explain: 'Chỉ 2 âm tiết: WENZ-dei. Chữ d đầu và chữ e thứ hai đều câm.',
    },
    {
      type: 'listen-choose',
      options: ['wonder', 'wander', 'window'],
      answer: 0,
      explain: 'wonder đọc WUN-dər: chữ o đọc u (chuyện chữ u bị đổi thành o). wander là WAN-dər, window là WIN-doh.',
    },
    {
      type: 'choose',
      prompt: 'Vì sao colonel đọc có âm r?',
      options: [
        'Người Anh mượn từ cách đọc tiếng Pháp coronel, sau đó chỉ sửa chữ viết theo tiếng Ý',
        'Vì chữ l trong tiếng Anh luôn đọc như r',
        'Vì người Mỹ thêm âm r vào',
      ],
      answer: 0,
      explain: 'Tiếng Pháp đọc coronel; người Anh mượn cách đọc này. Chữ viết được sửa theo tiếng Ý colonnello, còn cách đọc giữ nguyên.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'Can I have the receipt?',
      options: ['receipt', 'recipe', 'receive'],
      answer: 0,
      explain: 'receipt đọc ri-SEET: p câm. recipe đọc RE-sə-pi (3 âm tiết), receive đọc ri-SEEV (âm v cuối).',
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Lost syllables
// ---------------------------------------------------------------------------

const lostSyllables: Lesson = {
  id: 'ir-lost-syllables',
  course: 'irregular',
  order: 5,
  title: 'Âm tiết bị nuốt: every → EV-ri',
  summary: 'Nhiều từ viết 3–4 âm tiết nhưng người Mỹ chỉ nói 2–3.',
  phenomenon: null,
  minutes: 7,
  goal: 'Nghe ra các từ thông dụng bị mất một âm tiết, và biết cách nào là chuẩn, cách nào là nói nhanh.',
  sections: [
    {
      title: 'Vì sao âm tiết biến mất?',
      blocks: [
        {
          type: 'rule',
          title: 'Âm tiết không nhấn → ə → biến mất',
          body: 'Tiếng Anh nhấn mạnh một âm tiết và đọc lướt các âm tiết còn lại thành **ə**. Khi âm ə này đứng trước **r, l, n** (đôi khi trước phụ âm khác), nó thường biến mất hẳn: **ev(e)ry** → EV-ri, **fam(i)ly** → FAM-li, **veg(e)table** → VEJ-tə-bəl.\n\nĐây là chuyện bên trong một từ. Chuyện nuốt âm giữa hai từ (next day) nằm ở khóa Nghe nối âm.',
        },
        {
          type: 'story',
          title: 'Chữ viết nhớ, miệng thì quên',
          md: 'Chữ viết của nhiều từ này giữ theo gốc Pháp, Latin, Tây Ban Nha hoặc theo cách đọc đủ âm tiết ngày xưa. Ví dụ **chocolate** đến từ tiếng Tây Ban Nha chocolate, đọc đủ 4 âm tiết.\n\nTrong tiếng Anh, âm tiết không nhấn bị mài mòn dần, nhưng chữ thì giữ nguyên. Từ điển Mỹ ngày nay ghi luôn cách đọc ngắn: **CHAK-lət**.',
          words: ['chocolate', 'every', 'family'],
        },
      ],
    },
    {
      title: 'Cách đọc ngắn là chuẩn',
      blocks: [
        {
          type: 'words',
          title: 'Từ điển ghi cách đọc ngắn này',
          items: [
            { word: 'every', sound: 'EV-ri', ipa: '/ˈɛvri/', mark: 'ev(e)ry', note: '2 âm tiết.' },
            { word: 'family', sound: 'FAM-li', ipa: '/ˈfæmli/', mark: 'fam(i)ly', note: 'Cũng nghe FA-mə-li.' },
            { word: 'different', sound: 'DIF-rənt', ipa: '/ˈdɪfrənt/', mark: 'diff(e)rent', note: '2 âm tiết là phổ biến.' },
            { word: 'interesting', sound: 'IN-trəs-ting', ipa: '/ˈɪntrəstɪŋ/', mark: 'int(e)resting', note: '3 âm tiết.' },
            { word: 'comfortable', sound: 'KUMF-tər-bəl', ipa: '/ˈkʌmftərbəl/', note: '3 âm tiết.' },
            { word: 'vegetable', sound: 'VEJ-tə-bəl', ipa: '/ˈvɛdʒtəbəl/', mark: 'veg(e)table', note: '3 âm tiết.' },
            { word: 'chocolate', sound: 'CHAK-lət', ipa: '/ˈtʃɑklət/', mark: 'choc(o)late', note: '2 âm tiết.' },
            { word: 'history', sound: 'HIS-tri', ipa: '/ˈhɪstri/', mark: 'hist(o)ry' },
          ],
        },
      ],
    },
    {
      title: 'Thêm từ đọc ngắn',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'camera', sound: 'KAM-rə', ipa: '/ˈkæmrə/', mark: 'cam(e)ra' },
            { word: 'favorite', sound: 'FEIV-rit', ipa: '/ˈfeɪvrɪt/', mark: 'fav(o)rite', note: 'Anh – Anh viết favourite.' },
            { word: 'restaurant', sound: 'RES-trant', ipa: '/ˈrɛstrɑnt/', mark: 'rest(au)rant', note: 'Cũng nghe RES-tə-rant.' },
            { word: 'evening', sound: 'EEV-ning', ipa: '/ˈivnɪŋ/', mark: 'ev(e)ning', note: '2 âm tiết.' },
            { word: 'several', sound: 'SEV-rəl', ipa: '/ˈsɛvrəl/', mark: 'sev(e)ral' },
            { word: 'general', sound: 'JEN-rəl', ipa: '/ˈdʒɛnrəl/', mark: 'gen(e)ral' },
            { word: 'temperature', sound: 'TEM-prə-chər', ipa: '/ˈtɛmprətʃər/', mark: 'temp(e)rature' },
            {
              word: 'separate',
              sound: 'SEP-rət',
              ipa: '/ˈsɛprət/',
              mark: 'sep(a)rate',
              say: 'They sleep in separate rooms.',
              note: 'Tính từ (riêng biệt). Động từ thì đọc SEP-ə-reit.',
            },
          ],
        },
      ],
    },
    {
      title: 'Cách đọc ngắn khi nói nhanh',
      blocks: [
        {
          type: 'words',
          title: 'Nói nhanh, thân mật',
          items: [
            { word: 'probably', sound: 'PRAB-li', ipa: '/ˈprɑbli/', note: 'Đọc kỹ: PRA-bə-bli. Nói nhanh còn 2 âm tiết.' },
            { word: 'actually', sound: 'AKSH-li', ipa: '/ˈækʃli/', note: 'Đọc kỹ: AK-chu-ə-li.' },
            { word: 'definitely', sound: 'DEF-nət-li', ipa: '/ˈdɛfnətli/', note: 'Đọc kỹ: DE-fə-nət-li.' },
            {
              word: 'library',
              sound: 'LAI-be-ri',
              ipa: '/ˈlaɪbɛri/',
              note: 'Nhiều người nói vậy, nhưng bị coi là chưa chuẩn. Bạn nên nói LAI-bre-ri.',
            },
          ],
        },
        {
          type: 'tip',
          md: '**Khi nghe:** đừng chờ đủ âm tiết như chữ viết. Nghe được phần **nhấn** (EV, FAM, KUMF, CHAK) là đủ đoán ra từ.\n\n**Khi nói:** dùng cách đọc ở hai phần trước là tự nhiên và chuẩn. Cách đọc ở phần này thì chỉ cần nghe ra.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['every', 'very', 'ivory'],
      answer: 0,
      explain: 'every đọc EV-ri (2 âm tiết, bắt đầu bằng e). very là VE-ri, ivory là AI-və-ri.',
    },
    {
      type: 'listen-type',
      text: "I [probably] won't come tonight.",
      explain: 'probably đọc kỹ là PRA-bə-bli, nói nhanh chỉ còn PRAB-li.',
    },
    {
      type: 'listen-type',
      text: 'This chair is very [comfortable].',
      explain: 'comfortable đọc KUMF-tər-bəl: 3 âm tiết, không phải com-for-ta-ble.',
    },
    {
      type: 'listen-type',
      text: 'What is your [favorite] color?',
      explain: 'favorite đọc FEIV-rit, chỉ 2 âm tiết. Kiểu Anh viết favourite.',
    },
    {
      type: 'choose',
      prompt: 'chocolate thường được đọc mấy âm tiết: 2 hay 4 như chữ viết?',
      show: 'chocolate',
      options: ['2', '4'],
      answer: 0,
      explain: 'Thường là 2: CHAK-lət. Bạn cũng sẽ nghe 3 (CHA-kə-lət), nhưng không ai đọc đủ 4 âm như chữ viết.',
    },
    {
      type: 'choose',
      prompt: 'Vì sao các từ như every, family bị mất một âm tiết?',
      options: [
        'Âm tiết không nhấn chỉ còn ə, và ə trước r, l, n dễ biến mất',
        'Người Mỹ viết sai chính tả',
        'Vì đó là giọng Anh',
      ],
      answer: 0,
      explain: 'Âm tiết không nhấn bị đọc lướt thành ə. ə đứng trước r, l, n thì rơi luôn: ev(e)ry, fam(i)ly.',
    },
    {
      type: 'choose',
      prompt: 'Nói library thành LAI-be-ri thì có chuẩn không?',
      show: 'library',
      options: [
        'Nhiều người nói, nhưng bị coi là chưa chuẩn; nên nói LAI-bre-ri',
        'Chuẩn, và là cách đọc duy nhất',
        'Đó là giọng Anh',
      ],
      answer: 0,
      explain: 'Bạn sẽ nghe LAI-be-ri, nhưng nhiều người coi đó là chưa chuẩn. Khi nói, dùng LAI-bre-ri.',
    },
    {
      type: 'choose',
      prompt: 'Người Mỹ hay đọc family thế nào?',
      show: 'family',
      options: ['FAM-li', 'FEIM-li', 'fə-MAI-li'],
      answer: 0,
      explain: 'family thường đọc FAM-li (2 âm tiết), cũng nghe FA-mə-li. Chữ a đọc a bẹt, không phải ei.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. Heteronyms: same spelling, different sound
// ---------------------------------------------------------------------------

const heteronyms: Lesson = {
  id: 'ir-heteronyms',
  course: 'irregular',
  order: 6,
  title: 'Cùng chữ khác âm: read, live, desert',
  summary: 'Một cách viết, hai cách đọc: nghĩa và từ loại quyết định.',
  phenomenon: null,
  minutes: 10,
  goal: 'Nghe ra hai cách đọc của các từ cùng chữ, và dùng ngữ cảnh hay trọng âm để biết đó là nghĩa nào.',
  sections: [
    {
      title: 'Vì sao một chữ lại có hai âm?',
      blocks: [
        {
          type: 'story',
          title: 'led giữ chữ cũ, read thì đổi chữ',
          md: 'Ngày xưa quá khứ của **read** và của **lead** đều có nguyên âm ngắn hơn hiện tại, và từng được viết ngắn: **red**, **led**. Với lead, cách viết **led** ở lại. Với read, về sau người ta viết quá khứ giống hệt hiện tại, nên giờ viết **read** mà đọc **red**.\n\nNhiều cặp khác vốn là **hai từ khác nhau** tình cờ có chung cách viết: **lead** (dẫn dắt) và **lead** (chì) không hề họ hàng.',
          words: ['led', 'red'],
        },
        {
          type: 'rule',
          title: 'Nghe cả câu, đừng nghe một từ',
          body: 'Một mình chữ **read** không cho bạn biết cách đọc. Phải nhìn **thì** của câu (yesterday → red) hoặc **nghĩa** (live music → laiv).',
        },
      ],
    },
    {
      title: 'Đổi nguyên âm (1)',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'read', sound: 'reed', ipa: '/rid/', say: 'I read every day.', note: 'Hiện tại. Quá khứ viết y hệt nhưng đọc red.' },
            { word: 'read', sound: 'red', ipa: '/rɛd/', say: 'I read it yesterday.', note: 'Quá khứ: giống hệt red (màu đỏ). Hiện tại đọc reed.' },
            { word: 'live', sound: 'liv', ipa: '/lɪv/', say: 'Where do you live?', note: 'Động từ: sống. Tính từ đọc laiv.' },
            { word: 'live', sound: 'laiv', ipa: '/laɪv/', say: 'We love live music.', note: 'Tính từ: trực tiếp, sống. Động từ đọc liv.' },
            { word: 'lead', sound: 'leed', ipa: '/lid/', say: 'Can you lead the team?', note: 'Động từ: dẫn dắt. Nghĩa "chì" đọc led.' },
            { word: 'lead', sound: 'led', ipa: '/lɛd/', say: 'The old pipes are made of lead.', note: 'Danh từ: chì. Giống hệt led (quá khứ của lead, dẫn dắt).' },
            { word: 'tear', sound: 'teer', ipa: '/tɪr/', say: 'A tear ran down her face.', note: 'Nước mắt. Nghĩa "xé" đọc teər.' },
            { word: 'tear', sound: 'teər', ipa: '/tɛr/', say: "Please don't tear the paper.", note: 'Xé. Vần với air, hair. Nghĩa "nước mắt" đọc teer.' },
          ],
        },
      ],
    },
    {
      title: 'Đổi nguyên âm (2)',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'wind', sound: 'wind', ipa: '/wɪnd/', say: 'The wind is very strong today.', note: 'Gió. Nghĩa "cuộn, quấn" đọc waind.' },
            { word: 'wind', sound: 'waind', ipa: '/waɪnd/', say: "Don't forget to wind the clock.", note: 'Cuộn, quấn, lên dây. Nghĩa "gió" đọc wind.' },
            { word: 'wound', sound: 'woond', ipa: '/wund/', say: 'The wound is healing well.', note: 'Vết thương. Quá khứ của wind (waind) thì đọc waund.' },
            { word: 'wound', sound: 'waund', ipa: '/waʊnd/', say: 'She wound the rope around her hand.', note: 'Quá khứ của wind (waind).' },
            { word: 'bow', sound: 'bau', ipa: '/baʊ/', say: 'The actors will bow to the audience.', note: 'Cúi chào. Giống hệt bough (cành cây). Nghĩa "cái nơ" đọc boh.' },
            { word: 'bow', sound: 'boh', ipa: '/boʊ/', say: 'She tied a bow in her hair.', note: 'Cái nơ, cây cung. Nghĩa "cúi chào" đọc bau.' },
            {
              word: 'row',
              sound: 'roh',
              ipa: '/roʊ/',
              say: 'We sat in the front row.',
              note: 'Hàng ghế. Nghĩa "cãi nhau" đọc rau, chủ yếu dùng ở Anh.',
            },
            {
              word: 'minute',
              sound: 'MIN-it',
              ipa: '/ˈmɪnɪt/',
              say: 'Wait a minute.',
              note: 'Phút: MIN-it. Nghĩa "rất nhỏ" đọc mai-NOOT, ít gặp.',
            },
          ],
        },
      ],
    },
    {
      title: 'Đổi s / z: close, use',
      blocks: [
        {
          type: 'rule',
          title: 'Động từ đọc z, danh từ / tính từ đọc s',
          body: 'Một số từ không đổi nguyên âm mà đổi **phụ âm cuối**: động từ đọc **z**, danh từ hay tính từ đọc **s**. Ví dụ: close, use, excuse, house.',
        },
        {
          type: 'words',
          items: [
            {
              word: 'close',
              sound: 'klohz',
              ipa: '/kloʊz/',
              say: 'Please close the door.',
              note: 'Động từ: đóng (âm z). Tính từ "gần" đọc klohs.',
              why: 'Ngày xưa dạng động từ có thêm một đuôi (tiếng Anh cổ hūs → hūsian, nhà → cho ở; tiếng Pháp us → user), nên s nằm giữa hai nguyên âm và đọc thành z. Danh từ, tính từ không có đuôi, s đứng cuối nên giữ s.',
            },
            { word: 'close', sound: 'klohs', ipa: '/kloʊs/', say: 'The school is very close to my home.', note: 'Tính từ: gần (âm s). Động từ "đóng" đọc klohz.' },
            { word: 'use', sound: 'yooz', ipa: '/juz/', say: 'Can I use your phone?', note: 'Động từ: âm z. Danh từ đọc yoos.' },
            { word: 'use', sound: 'yoos', ipa: '/jus/', say: "What's the use of it?", note: 'Danh từ: âm s. Động từ đọc yooz.' },
          ],
        },
      ],
    },
    {
      title: 'Đổi trọng âm: danh từ trước, động từ sau',
      blocks: [
        {
          type: 'rule',
          title: 'Danh từ nhấn âm đầu, động từ nhấn âm sau',
          body: 'Nhiều cặp từ hai âm tiết gốc Latin, Pháp chỉ khác nhau ở **trọng âm**: danh từ nhấn **trước** (a REK-ərd), động từ nhấn **sau** (to ri-KORD). Âm tiết không nhấn bị lướt thành ə.\n\nChữ in hoa trong cách đọc là âm tiết được nhấn. Cặp record, present có trong bài **Trọng âm và âm /ə/** (khóa Chữ viết → âm đọc); dưới đây là các cặp khác.',
        },
        {
          type: 'words',
          items: [
            { word: 'object', sound: 'AB-jekt', ipa: '/ˈɑbdʒɛkt/', say: 'What is that strange object?', note: 'Danh từ: đồ vật. Động từ đọc əb-JEKT.' },
            { word: 'object', sound: 'əb-JEKT', ipa: '/əbˈdʒɛkt/', say: 'I object to this plan.', note: 'Động từ: phản đối. Danh từ đọc AB-jekt.' },
            { word: 'permit', sound: 'PER-mit', ipa: '/ˈpɝmɪt/', say: 'You need a parking permit.', note: 'Danh từ: giấy phép. Động từ đọc pər-MIT.' },
            { word: 'permit', sound: 'pər-MIT', ipa: '/pərˈmɪt/', say: "They don't permit smoking here.", note: 'Động từ: cho phép. Danh từ đọc PER-mit.' },
            { word: 'increase', sound: 'IN-krees', ipa: '/ˈɪnkris/', say: 'There was an increase in prices.', note: 'Danh từ: sự tăng. Động từ đọc in-KREES.' },
            { word: 'increase', sound: 'in-KREES', ipa: '/ɪnˈkris/', say: 'Prices will increase next month.', note: 'Động từ: tăng. Danh từ đọc IN-krees.' },
            { word: 'desert', sound: 'DEZ-ərt', ipa: '/ˈdɛzərt/', say: 'The Sahara is a huge desert.', note: 'Sa mạc: nhấn đầu. Nghĩa "bỏ rơi" đọc di-ZERT.' },
            {
              word: 'desert',
              sound: 'di-ZERT',
              ipa: '/dɪˈzɝt/',
              say: 'Never desert your friends.',
              note: 'Bỏ rơi: nhấn sau. Đọc giống hệt dessert (món tráng miệng).',
            },
          ],
        },
        {
          type: 'tip',
          md: '**Khi nghe:** sau **a, the, my** là danh từ (nhấn đầu); sau **to, will, can** là động từ (nhấn sau). Trọng âm và vị trí trong câu giúp nhau.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Từ read trong câu bạn nghe đọc thế nào?',
      play: 'Yesterday I read the whole book.',
      options: ['red: quá khứ', 'reed: hiện tại'],
      answer: 0,
      explain: 'Quá khứ (yesterday) nên read đọc red, nhưng chữ viết vẫn là read.',
    },
    {
      type: 'listen-type',
      text: 'They [live] near the station.',
      explain: 'Động từ "sống" đọc liv. Tính từ live (live music) mới đọc laiv.',
    },
    {
      type: 'choose',
      prompt: 'Từ close trong câu bạn nghe đọc thế nào?',
      play: 'Please close the door.',
      options: ['klohz: đóng', 'klohs: gần'],
      answer: 0,
      explain: 'Động từ close (đóng) kết thúc bằng âm z: klohz. Tính từ close (gần) kết thúc bằng âm s: klohs.',
    },
    {
      type: 'choose',
      prompt: 'Trọng âm của permit trong câu bạn nghe rơi vào đâu?',
      play: 'Show me your permit, please.',
      options: ['PER-mit: danh từ, nhấn trước', 'pər-MIT: động từ, nhấn sau'],
      answer: 0,
      explain: 'Sau "your" là danh từ: PER-mit (giấy phép), nhấn âm đầu.',
    },
    {
      type: 'choose',
      prompt: 'object trong câu bạn nghe là gì?',
      play: 'Does anyone object to this idea?',
      options: ['Động từ: phản đối, əb-JEKT', 'Danh từ: đồ vật, AB-jekt'],
      answer: 0,
      explain: 'Sau "anyone" và trước "to this idea" là động từ, nhấn âm sau: əb-JEKT.',
    },
    {
      type: 'choose',
      prompt: 'Từ wind trong câu này đọc thế nào?',
      show: 'The wind blew the leaves away.',
      options: ['wind: gió', 'waind: cuộn, lên dây'],
      answer: 0,
      explain: 'Gió (the wind) đọc wind với âm i ngắn. waind là động từ cuộn, quấn.',
    },
    {
      type: 'choose',
      prompt: 'Từ tear trong câu này đọc thế nào?',
      show: 'She wiped a tear from her cheek.',
      options: ['teer: nước mắt', 'teər: xé'],
      answer: 0,
      explain: 'Lau (wipe) một giọt nước mắt: tear đọc teer. Nghĩa "xé" đọc teər.',
    },
    {
      type: 'choose',
      prompt: 'Từ use trong câu bạn nghe đọc thế nào?',
      play: 'It is no use crying about it.',
      options: ['yoos: danh từ, âm s', 'yooz: động từ, âm z'],
      answer: 0,
      explain: 'no use = vô ích: use là danh từ, đọc yoos với âm s. Động từ use (Can I use…) mới đọc yooz.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. Homophones: different spelling, same sound
// ---------------------------------------------------------------------------

const homophones: Lesson = {
  id: 'ir-homophones',
  course: 'irregular',
  order: 7,
  title: 'Khác chữ cùng âm: know / no, right / write',
  summary: 'Tai nghe giống hệt, chỉ có ngữ cảnh mới phân biệt được.',
  phenomenon: null,
  minutes: 8,
  goal: 'Biết các cặp từ đọc giống hệt nhau, và quen chọn đúng chữ nhờ ngữ cảnh khi nghe.',
  sections: [
    {
      title: 'Ngày xưa chúng khác nhau',
      blocks: [
        {
          type: 'story',
          title: 'Âm rụng, hai từ thành một âm',
          md: 'Phần lớn các cặp này ngày xưa đọc khác nhau. **knight** có k, nên khi k rụng nó trùng với night. **write** có w, còn **right** có âm kh (gh); khi cả hai âm này rụng, hai từ mới đọc giống nhau.\n\n**meat** và **meet** cũng từng khác nguyên âm, đến khoảng thế kỷ 17–18 mới nhập làm một. **which** và **witch** từng khác nhau ở âm "hw"; ngày nay hầu hết người Mỹ đọc giống nhau.',
          words: ['meat', 'meet', 'which'],
        },
        {
          type: 'rule',
          title: 'Tai không phân biệt được, ngữ cảnh thì được',
          body: 'Đừng cố nghe "khác nhau": chúng **giống hệt**. Hãy hỏi: chỗ này trong câu cần **loại từ nào**? Sau I, you thường là động từ (I **know**); trước danh từ thường là tính từ sở hữu (**their** car).',
        },
      ],
    },
    {
      title: 'Các cặp hay gặp (1)',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'know', sound: 'noh', ipa: '/noʊ/', mark: '(k)now', note: 'know (biết) = no (không).' },
            { word: 'new', sound: 'noo', ipa: '/nu/', note: 'new (mới) = knew (đã biết). Anh – Anh: nyoo.' },
            { word: 'right', sound: 'rait', ipa: '/raɪt/', note: 'right (đúng, phải) = write (viết).' },
            { word: 'there', sound: 'theər', ipa: '/ðɛr/', note: "there (ở đó) = their (của họ) = they're (they are). Vần với air." },
            { word: 'here', sound: 'heer', ipa: '/hɪr/', note: 'here (ở đây) = hear (nghe).' },
            { word: 'week', sound: 'week', ipa: '/wik/', note: 'week (tuần) = weak (yếu).' },
            { word: 'buy', sound: 'bai', ipa: '/baɪ/', note: 'buy (mua) = by (bởi) = bye (tạm biệt).' },
            { word: 'two', sound: 'too', ipa: '/tu/', note: 'two (2) = too (cũng, quá) = to (khi đọc rõ).' },
          ],
        },
      ],
    },
    {
      title: 'Các cặp hay gặp (2)',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'whole', sound: 'hohl', ipa: '/hoʊl/', mark: '(w)hole', note: 'whole (toàn bộ) = hole (cái lỗ).' },
            { word: 'piece', sound: 'pees', ipa: '/pis/', note: 'piece (miếng) = peace (hòa bình).' },
            { word: 'weight', sound: 'weit', ipa: '/weɪt/', mark: 'wei(gh)t', note: 'weight (cân nặng) = wait (chờ).' },
            {
              word: 'flour',
              sound: 'FLAU-ər',
              ipa: '/ˈflaʊər/',
              note: 'flour (bột) = flower (hoa).',
              why: 'Đây vốn là **một từ**: flour là "phần tinh hoa" (flower) của hạt lúa mì. Khoảng thế kỷ 18–19 hai cách viết mới tách hẳn.',
            },
            {
              word: 'dessert',
              sound: 'di-ZERT',
              ipa: '/dɪˈzɝt/',
              mark: 'de[ss]ert',
              note: 'dessert (món tráng miệng) = desert (bỏ rơi). desert là sa mạc thì đọc DEZ-ərt.',
              why: 'Từ tiếng Pháp **desservir** = dọn bàn (des + servir, phục vụ): món ăn sau khi đã dọn các món chính đi. Hai chữ s đến từ servir. Mẹo thêm: món tráng miệng ai cũng muốn ăn hai lần.',
            },
            {
              word: 'hour',
              sound: 'AU-ər',
              ipa: '/ˈaʊər/',
              mark: '(h)our',
              note: 'hour (giờ) = our (của chúng tôi), với nhiều người. Nhiều người Mỹ đọc our là ar.',
            },
            { word: "it's", sound: 'its', ipa: '/ɪts/', note: "it's (it is) = its (của nó)." },
            { word: 'which', sound: 'wich', ipa: '/wɪtʃ/', note: 'which (cái nào) = witch (phù thủy), với hầu hết người Mỹ.' },
          ],
        },
        {
          type: 'tip',
          md: "**your** và **you're** cũng thường đọc giống nhau (yor, khi nói nhanh còn yər). Sau you're thường là tính từ hoặc động từ -ing; sau your là danh từ.",
        },
      ],
    },
    {
      title: 'Chiến lược nghe: để ngữ cảnh quyết định',
      blocks: [
        {
          type: 'examples',
          title: 'Nghe và đoán chữ bằng ngữ cảnh',
          items: [
            { text: "I know there's no time.", note: 'know sau I (động từ); no trước danh từ time.' },
            { text: 'Their car is right there.', note: 'Their trước danh từ car; there chỉ nơi chốn.' },
            { text: 'Wait here, I need to check the weight.', note: 'Wait đầu câu là động từ; the weight là danh từ.' },
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-type',
      text: 'I [know] his name.',
      explain: 'Sau "I" cần động từ: know (biết). no đọc giống hệt nhưng là "không".',
    },
    {
      type: 'listen-type',
      text: 'Turn [right] at the bank.',
      explain: 'Turn right = rẽ phải. write (viết) đọc giống hệt nhưng không hợp nghĩa.',
    },
    {
      type: 'listen-type',
      text: 'The [weight] of the box is ten kilos.',
      explain: 'Sau "the" và có "of the box": danh từ weight (cân nặng). wait (chờ) đọc giống hệt.',
    },
    {
      type: 'listen-type',
      text: 'Can I have a [piece] of cake?',
      explain: 'a piece of cake = một miếng bánh. peace (hòa bình) đọc giống hệt.',
    },
    {
      type: 'listen-type',
      text: 'I need some [flour] to make bread.',
      explain: 'Làm bánh mì cần bột: flour. flower (hoa) đọc giống hệt.',
    },
    {
      type: 'choose',
      prompt: 'Điền từ đúng.',
      show: "I can't find ___ keys.",
      options: ['their', 'there', "they're"],
      answer: 0,
      explain: 'Trước danh từ keys cần từ chỉ sở hữu: their (của họ). Ba từ đọc giống hệt nhau.',
    },
    {
      type: 'choose',
      prompt: 'Món tráng miệng viết thế nào?',
      show: 'We had ice cream for ___.',
      options: ['dessert', 'desert'],
      answer: 0,
      explain: 'Món tráng miệng là dessert (hai chữ s), đọc di-ZERT, giống hệt desert (bỏ rơi). desert một chữ s còn là sa mạc (DEZ-ərt).',
    },
    {
      type: 'choose',
      prompt: 'Khi nghe "noh", làm sao biết đó là know hay no?',
      options: [
        "Nhìn ngữ cảnh: sau I, you, don't thường là know",
        'Nghe kỹ âm k ở đầu',
        'know luôn được nhấn mạnh hơn no',
      ],
      answer: 0,
      explain: 'k trong know câm nên hai từ giống hệt nhau. Chỉ có vị trí trong câu mới cho bạn biết.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. Irregular past forms that are easy to mishear
// ---------------------------------------------------------------------------

const pastForms: Lesson = {
  id: 'ir-past-forms',
  course: 'irregular',
  order: 8,
  title: 'Quá khứ dễ nghe nhầm: bought, brought, kept',
  summary: 'Các dạng quá khứ bất quy tắc nghe gần giống nhau, và vì sao chúng như vậy.',
  phenomenon: null,
  minutes: 9,
  goal: 'Phân biệt khi nghe các dạng quá khứ bất quy tắc hay gặp (bought / brought, felt / fell, left / lived, saw / sold), và hiểu vì sao keep thành kept.',
  sections: [
    {
      title: 'Quá khứ cổ: đổi nguyên âm, thêm t',
      blocks: [
        {
          type: 'story',
          title: 'Hai cách làm quá khứ ngày xưa',
          md: 'Những động từ hay dùng nhất là những động từ **cổ nhất**. Từ thời tiếng Anh cổ, nhiều động từ làm quá khứ bằng cách **đổi nguyên âm** (sing → sang, ride → rode), giống tiếng Đức (singen → sang).\n\nNhóm bought, thought, brought thì khác: ngày xưa chúng kết thúc bằng **hte**, với âm kh như bài ough. Chữ **t** ở cuối chính là đuôi quá khứ cổ (họ hàng với **-ed**): những từ này vừa thêm đuôi, vừa đổi nguyên âm. Âm kh mất, chữ gh ở lại.\n\nNgười ta cho rằng **caught** (từ catch, gốc Pháp) bắt chước động từ cổ **lacchen** (nay là latch), lúc đó cũng nghĩa là "bắt" và có quá khứ **laughte**.',
          words: ['bought', 'thought', 'caught'],
        },
      ],
    },
    {
      title: '-ought / -aught: cùng một đuôi "ot"',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'bought', sound: 'bot', ipa: '/bɔt/', mark: 'b[ough]t', note: 'buy → bought.' },
            { word: 'brought', sound: 'brot', ipa: '/brɔt/', mark: 'br[ough]t', note: 'bring → brought. Có âm r.' },
            { word: 'fought', sound: 'fot', ipa: '/fɔt/', mark: 'f[ough]t', note: 'fight → fought.' },
            { word: 'caught', sound: 'kot', ipa: '/kɔt/', mark: 'c[augh]t', note: 'catch → caught.' },
          ],
        },
        {
          type: 'tip',
          md: 'Bốn từ này **vần với nhau**, chỉ khác phụ âm đầu: b, br, f, k. Hãy nghe kỹ **âm đầu**. thought, taught cũng vần như vậy (bài 3).\n\nNhiều người Mỹ đọc âm o này mở hơn, gần a: bought vần với **hot**, còn caught đọc giống hệt **cot**. Đừng ngạc nhiên.',
        },
      ],
    },
    {
      title: 'Nguyên âm dài → ngắn: keep → kept',
      blocks: [
        {
          type: 'rule',
          title: 'Hai phụ âm liền nhau làm nguyên âm ngắn lại',
          body: 'Khi quá khứ thêm t hay d và tạo thành **hai phụ âm liền nhau**, nguyên âm dài bị **rút ngắn**: keep → kept, sleep → slept, feel → felt, leave → left, mean → meant, deal → dealt, hear → heard.',
        },
        {
          type: 'story',
          title: 'Nói cho dễ, chữ thì giữ',
          md: 'Từ thời tiếng Anh cổ, nguyên âm dài đứng trước hai phụ âm thường bị đọc ngắn lại cho dễ nói: **cēpan** (keep) có quá khứ **cēpte**, rồi thành **kepte**, kept.\n\nCó từ đổi cả chữ (keep → kept), có từ giữ chữ ea (mean → meant). Vì thế nhìn meant dễ tưởng đọc "meent", nhưng thật ra là ment.',
          words: ['keep', 'kept', 'meant'],
        },
        {
          type: 'words',
          items: [
            { word: 'kept', sound: 'kept', ipa: '/kɛpt/', note: 'keep → kept: ee thành e.' },
            { word: 'slept', sound: 'slept', ipa: '/slɛpt/', note: 'sleep → slept.' },
            { word: 'meant', sound: 'ment', ipa: '/mɛnt/', mark: 'm[ea]nt', note: 'mean (meen) → meant (ment).' },
            { word: 'dealt', sound: 'delt', ipa: '/dɛlt/', mark: 'd[ea]lt', note: 'deal (deel) → dealt (delt).' },
            { word: 'heard', sound: 'herd', ipa: '/hɝd/', mark: 'h[ear]d', note: 'hear (heer) → heard (herd): nguyên âm ngắn lại rồi đổi theo r. Giống hệt herd (đàn gia súc).' },
          ],
        },
      ],
    },
    {
      title: 'Các cặp dễ nhầm',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'left', sound: 'left', ipa: '/lɛft/', note: 'leave → left: âm e và ft (ngắn lại như kept).' },
            { word: 'lived', sound: 'livd', ipa: '/lɪvd/', note: 'live → lived: âm i và vd.', review: false },
            { word: 'felt', sound: 'felt', ipa: '/fɛlt/', note: 'feel → felt: có âm t.' },
            { word: 'fell', sound: 'fel', ipa: '/fɛl/', note: 'fall → fell: không có t.' },
            { word: 'filled', sound: 'fild', ipa: '/fɪld/', note: 'fill → filled: âm i, có d.', review: false },
            { word: 'led', sound: 'led', ipa: '/lɛd/', note: 'lead (leed) → led. Giống hệt lead (chì). Khác read: quá khứ vẫn viết read nhưng đọc red.' },
            { word: 'saw', sound: 'saw', ipa: '/sɔ/', note: 'see → saw: o mở, không có l.' },
            { word: 'sold', sound: 'sohld', ipa: '/soʊld/', note: 'sell → sold: oh + ld.' },
          ],
        },
        {
          type: 'examples',
          title: 'Nghe trong câu',
          items: [
            { text: 'I thought you bought it.', note: 'thot, bot.' },
            { text: 'She caught the bus and left.', note: 'kot, left.' },
            { text: 'He said he felt it.', note: 'sed; felt nối với it: fel-tit.' },
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'He bought a new car.',
      options: ['bought', 'brought', 'boat'],
      answer: 0,
      explain: 'bought đọc bot, không có r. brought (brot) có âm r; boat (boht) là oh.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'She brought her sister.',
      options: ['brought', 'bought', 'broke'],
      answer: 0,
      explain: 'brought đọc brot: có âm r sau b. bring → brought.',
    },
    {
      type: 'listen-choose',
      options: ['I felt it.', 'I fell in.', 'I filled it.'],
      answer: 0,
      explain: 'felt có âm t nối sang it: fel-tit. fell không có t, filled có âm i.',
    },
    {
      type: 'listen-type',
      text: 'She [caught] the last train.',
      explain: 'caught đọc kot: augh đọc o, gh câm. catch → caught.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'He left last week.',
      options: ['left', 'lived', 'lift'],
      answer: 0,
      explain: 'left đọc left: âm e và ft. lived là livd, lift là lift (âm i).',
    },
    {
      type: 'choose',
      prompt: 'Quá khứ của lead (dẫn dắt) viết thế nào?',
      show: 'Yesterday she ___ the team.',
      options: ['led', 'lead', 'leaded'],
      answer: 0,
      explain: 'Quá khứ của lead viết led và đọc led. Khác với read: quá khứ vẫn viết read nhưng đọc red.',
    },
    {
      type: 'choose',
      prompt: 'Vì sao meant đọc ment, không phải meent?',
      options: [
        'Nguyên âm dài bị rút ngắn trước hai phụ âm nt',
        'Người Mỹ nói nhanh nên nuốt âm',
        'Chữ ea lúc nào cũng đọc e',
      ],
      answer: 0,
      explain: 'mean có nguyên âm dài. Thêm t thành hai phụ âm nt, nguyên âm bị rút ngắn: ment. Giống keep → kept, feel → felt.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'I saw it yesterday.',
      options: ['saw', 'sold', 'sat'],
      answer: 0,
      explain: 'saw đọc như o mở, không có l và không có t. sold là sohld, sat là sat.',
    },
  ],
};

export const IRREGULAR_LESSONS: Lesson[] = [why, silent, ough, oddWords, lostSyllables, heteronyms, homophones, pastForms];
