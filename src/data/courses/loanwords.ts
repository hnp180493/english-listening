// Course "loanwords": Từ mượn, tên riêng, Anh – Mỹ (loanwords, names, UK vs US).
// Every lesson: course: 'loanwords', order 1..n (contiguous), unique id, 8 quiz items, phenomenon: null.
// Shapes and rules: docs/courses.md. Validation: npx vitest run src/features/lessons
//
// Respellings: convention at the top of src/core/decoder/tables.ts ("Stress"). Like courses "spelling" and
// "irregular", a respelling of 2+ syllables is split by hyphens with the stressed syllable in CAPITALS (ba-LEI),
// because stress is half of what makes a loanword or a name recognisable. Words those courses already teach with a
// story (psychology, chorus, Thomas) are only mentioned here, not given a second row. IPA is General American.
// Rows that only illustrate an accent feature on a word every learner knows (car, bath…) carry review: false.
//
// Every row was checked against the Windows en-US voices (Zira, David, Mark). Words they say wrongly and that
// no context sentence fixes (Hermès → HER-meez, Siobhan → SAI-ə-bən, niche → nich) are left out, because the
// play button would contradict the respelling. Where the voices read a common variant, the note names it.
import type { Lesson } from '../lessonTypes';

// ---------------------------------------------------------------------------
// 1. French loanwords
// ---------------------------------------------------------------------------

const french: Lesson = {
  id: 'lw-french',
  course: 'loanwords',
  order: 1,
  title: 'Từ mượn: ballet → ba-LEI',
  summary: 'Từ gốc Pháp giữ chữ viết gốc nên không đọc theo mặt chữ.',
  goal: 'Nhận ra từ mượn khi nghe: chữ cuối câm, -et/-é của từ Pháp mới đọc "ei", ch đọc "sh".',
  phenomenon: null,
  minutes: 7,
  sections: [
    {
      title: 'Từ gốc Pháp: chữ cuối thường câm',
      blocks: [
        {
          type: 'rule',
          title: 'Ba dấu hiệu của từ gốc Pháp',
          body: '- **Phụ âm cuối thường câm**: debris, faux pas, rendezvous.\n- **-et, -é ở cuối từ Pháp mượn gần đây đọc "ei"**: ballet, buffet, café. Từ mượn từ lâu thì đọc t bình thường: ticket, jacket, budget.\n- **Hay nhấn âm tiết cuối**: ba-LEI, bə-FEI, ka-FEI. Không phải từ nào cũng vậy: résumé (RE-zə-mei), rendezvous (RAN-dei-voo), genre (ZHAN-rə) lại nhấn âm đầu.\n\nTrong cột cách đọc, phần viết HOA là âm tiết được nhấn.',
        },
        {
          type: 'words',
          title: 'Nghe từng từ',
          items: [
            { word: 'ballet', sound: 'ba-LEI', ipa: '/bæˈleɪ/', mark: 'ball[e](t)', note: 'Chữ t câm, nhấn âm cuối.' },
            { word: 'buffet', sound: 'bə-FEI', ipa: '/bəˈfeɪ/', mark: 'buff[e](t)', say: 'We had a buffet for lunch.', note: 'Bữa tiệc tự chọn. Chữ t câm. Động từ buffet (BU-fit: quật, xô đẩy) đọc khác.' },
            { word: 'café', sound: 'ka-FEI', ipa: '/kæˈfeɪ/', mark: 'caf[é]', note: 'Người Mỹ hay viết cafe, đọc vẫn vậy.' },
            { word: 'résumé', sound: 'RE-zə-mei', ipa: '/ˈrɛzəˌmeɪ/', mark: 'résum[é]', say: 'Please send me your resume.', note: 'Sơ yếu lý lịch (CV). Người Mỹ hay viết resume, không dấu. Khác động từ resume (ri-ZOOM: tiếp tục).' },
            { word: 'debris', sound: 'də-BREE', ipa: '/dəˈbri/', mark: 'debri(s)', note: 'Mảnh vụn, đống đổ nát. Chữ s câm.' },
            { word: 'faux pas', sound: 'foh-PA', ipa: '/ˌfoʊ ˈpɑ/', mark: 'fau(x) pa(s)', note: 'Lỡ lời, hớ hênh. Cả x và s đều câm.' },
            { word: 'rendezvous', sound: 'RAN-dei-voo', ipa: '/ˈrɑndeɪˌvu/', mark: 'rende(z)vou(s)', note: 'Cuộc hẹn gặp. z và s câm.' },
            { word: 'genre', sound: 'ZHAN-rə', ipa: '/ˈʒɑnrə/', mark: '[g]enre', note: 'Thể loại (nhạc, phim). g đọc như s trong usual; một số người Mỹ (và giọng máy) đọc JAN-rə.' },
            { word: 'entrepreneur', sound: 'an-trə-prə-NER', ipa: '/ˌɑntrəprəˈnɝ/', mark: 'entrepren[eur]', note: 'Doanh nhân khởi nghiệp. -eur đọc "er", nhấn âm cuối.' },
          ],
        },
        {
          type: 'tip',
          md: 'Bẫy cho người Việt: tiếng Việt cũng mượn **ballet**, **café** từ tiếng Pháp và đọc theo thanh điệu của mình. Người Mỹ thường nhấn **âm cuối** và kéo "ei" dài: ba-LEI, ka-FEI. Nghe thấy một từ nhấn ở cuối với "ei" thì nghĩ ngay đến từ gốc Pháp.',
        },
      ],
    },
    {
      title: 'Từ Pháp mới: ch đọc "sh", -age đọc "ahzh"',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'chef', sound: 'shef', ipa: '/ʃɛf/', mark: '[ch]ef', note: 'Đầu bếp.' },
            { word: 'chic', sound: 'sheek', ipa: '/ʃik/', mark: '[ch]ic', note: 'Sành điệu. Đọc dài như sheep.' },
            { word: 'machine', sound: 'mə-SHEEN', ipa: '/məˈʃin/', mark: 'ma[ch]ine', note: 'ch đọc sh, i đọc ee.' },
            { word: 'brochure', sound: 'broh-SHUR', ipa: '/broʊˈʃʊr/', mark: 'bro[ch]ure', note: 'Tờ gấp quảng cáo.' },
            { word: 'garage', sound: 'gə-RAHZH', ipa: '/ɡəˈrɑʒ/', mark: 'gar[age]', note: 'Nhà để xe. -age đọc "ahzh". Anh – Anh: GA-rahzh hoặc GA-rij.' },
            { word: 'massage', sound: 'mə-SAHZH', ipa: '/məˈsɑʒ/', mark: 'mass[age]', note: 'Mát-xa. Nhấn âm cuối.' },
          ],
        },
        {
          type: 'story',
          title: 'chief và chef: một từ, mượn hai lần',
          md: 'Cả hai đều đến từ chữ Pháp cổ **chief/chef**: cái đầu, người đứng đầu.\n\nNgười Anh mượn lần đầu khoảng năm 1300, qua tiếng Pháp của người Norman ở Anh, khi ch còn đọc "ch". Từ đó thành **chief** (cheef): thủ lĩnh.\n\nVề sau, ch trong tiếng Pháp chuyển thành "sh". Thế kỷ 19 người Anh mượn lại chữ này, lần này là **chef** (shef): người đứng đầu nhà bếp.\n\nVì vậy những từ mượn về sau (từ thế kỷ 16 trở đi) đọc ch là "sh": machine, brochure, chic.',
          words: ['chief', 'chef'],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['ballet', 'ballot', 'bullet'],
      answer: 0,
      explain: 'ballet = ba-LEI: t câm, nhấn âm cuối. ballot (BA-lət, lá phiếu) và bullet (BU-lit, viên đạn) đều đọc t và nhấn âm đầu.',
    },
    {
      type: 'listen-type',
      text: 'We had a [buffet] for lunch.',
      explain: 'buffet = bə-FEI: t câm, -et đọc "ei", nhấn âm cuối. Nếu bạn chờ nghe "búp-phê" hay một chữ t ở cuối thì sẽ không nhận ra.',
    },
    {
      type: 'silent-letter',
      word: 'debris',
      silent: [5],
      explain: 'debris = də-BREE: chữ s cuối câm, như nhiều từ gốc Pháp.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'The chef made dinner.',
      options: ['chef', 'chief', 'shelf'],
      answer: 0,
      explain: 'chef = shef: mượn lần hai từ tiếng Pháp nên ch đọc "sh". chief (cheef) mượn từ thời trung đại nên ch đọc như chair. shelf có thêm âm l.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'He is a successful entrepreneur.',
      options: ['entrepreneur', 'engineer', 'interpreter'],
      answer: 0,
      explain: 'entrepreneur = an-trə-prə-NER: đuôi -eur đọc "er" và được nhấn. engineer kết thúc bằng "neer", interpreter nhấn âm thứ hai.',
    },
    {
      type: 'silent-letter',
      word: 'rendezvous',
      silent: [5, 9],
      explain: 'rendezvous = RAN-dei-voo: z và s đều câm.',
    },
    {
      type: 'listen-choose',
      options: ['massage', 'message', 'massive'],
      answer: 0,
      say: 'I need a massage.',
      explain: 'massage = mə-SAHZH: nhấn âm cuối, -age đọc "ahzh" theo tiếng Pháp. message (ME-sij) và massive (MA-siv) đều nhấn âm đầu.',
    },
    {
      type: 'choose',
      prompt: 'Từ này đọc thế nào?',
      show: 'chic',
      options: ['sheek', 'chik', 'kik'],
      answer: 0,
      explain: 'chic là từ Pháp mới: ch đọc sh, i đọc ee dài. Vì vậy chic nghe gần như sheek.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Greek, Italian, Japanese loanwords
// ---------------------------------------------------------------------------

const greek: Lesson = {
  id: 'lw-greek',
  course: 'loanwords',
  order: 2,
  title: 'Hy Lạp, Ý, Nhật: chaos → KEI-as',
  summary: 'Từ gốc Hy Lạp, Ý, Nhật: ch đọc k, p đầu từ câm, và cách người Mỹ đọc karaoke.',
  goal: 'Nhận ra từ gốc Hy Lạp, Ý, Nhật khi nghe: ch đọc "k", p đầu từ câm, nhấn âm khác tiếng Việt.',
  phenomenon: null,
  minutes: 7,
  sections: [
    {
      title: 'Gốc Hy Lạp: ch = k, ph = f, ps = s',
      blocks: [
        {
          type: 'rule',
          title: 'Chữ Hy Lạp viết bằng chữ Latin',
          body: 'Người La Mã chép chữ Hy Lạp χ thành **ch**, φ thành **ph**, ψ thành **ps**. Tiếng Anh giữ cách viết đó:\n\n- **ch** đọc /k/: chaos, chorus, character.\n- **ph** đọc /f/: philosophy, phone. (Ngoại lệ hiếm: Stephen đọc v, xem bài Tên riêng.)\n- **ps**, **pn** ở đầu từ: **p câm**: psychology, pneumonia.',
        },
        {
          type: 'words',
          items: [
            { word: 'chaos', sound: 'KEI-as', ipa: '/ˈkeɪɑs/', mark: '[ch]aos', note: 'Hỗn loạn. Không đọc "chao".' },
            { word: 'character', sound: 'KE-rək-tər', ipa: '/ˈkɛrəktər/', mark: '[ch]aracter', note: 'Nhân vật, tính cách. Nhấn âm đầu.' },
            { word: 'echo', sound: 'E-koh', ipa: '/ˈɛkoʊ/', mark: 'e[ch]o', note: 'Tiếng vọng.' },
            { word: 'pneumonia', sound: 'noo-MOHN-yə', ipa: '/nuˈmoʊnjə/', mark: '(p)neumonia', note: 'Viêm phổi. p câm.' },
            { word: 'philosophy', sound: 'fə-LA-sə-fi', ipa: '/fəˈlɑsəfi/', mark: '[ph]iloso[ph]y', note: 'Triết học. Nhấn âm thứ hai.' },
          ],
        },
      ],
    },
    {
      title: 'Từ Ý và Nhật: người Mỹ đọc khác người Việt',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'pizza', sound: 'PEET-sə', ipa: '/ˈpitsə/', mark: 'pi[zz]a', note: 'zz đọc "ts" theo tiếng Ý.' },
            { word: 'espresso', sound: 'e-SPRE-soh', ipa: '/ɛˈsprɛsoʊ/', note: 'Không có x: không đọc "expresso".',
              why: 'Tiếng Ý **espresso** nghĩa là "ép ra": nước nóng được ép mạnh qua bột cà phê. Người ta hay nhầm với chữ express (nhanh) nên nói thành "expresso".' },
            { word: 'karaoke', sound: 'ke-ri-OH-ki', ipa: '/ˌkɛriˈoʊki/', note: 'Nhấn OH. Khác hẳn "ka-ra-ô-kê" của tiếng Việt.',
              why: 'Tiếng Nhật: **kara** (trống, rỗng) + **ōke** (viết tắt của ōkesutora, orchestra). Nghĩa đen là "dàn nhạc trống": không có ban nhạc thật, chỉ có nhạc thu sẵn để bạn tự hát.' },
            { word: 'tsunami', sound: 'soo-NA-mi', ipa: '/suˈnɑmi/', mark: '(t)sunami', note: 'Người Mỹ thường bỏ t ở đầu (máy đọc đôi khi vẫn đọc t).',
              why: 'Tiếng Nhật: **tsu** (bến cảng) + **nami** (sóng). Sóng thần đánh vào bến cảng.' },
            { word: 'anime', sound: 'A-nə-mei', ipa: '/ˈænəˌmeɪ/', note: 'Phim hoạt hình Nhật. e cuối đọc "ei".' },
            { word: 'emoji', sound: 'i-MOH-ji', ipa: '/ɪˈmoʊdʒi/', note: 'Nhấn MOH.',
              why: 'Tiếng Nhật: **e** (hình) + **moji** (chữ). Không liên quan đến chữ emotion, dù nghe rất giống.' },
          ],
        },
        {
          type: 'tip',
          md: '**karaoke** là bẫy lớn nhất. Người Mỹ không nói "ka-ra-ô-kê" mà nói gần như **carry oh key**, nhấn mạnh ở giữa.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'silent-letter',
      word: 'pneumonia',
      silent: [0],
      explain: 'pneumonia = noo-MOHN-yə: p ở đầu câm, như psychology. Chữ Hy Lạp pn, ps ở đầu từ: tiếng Anh bỏ p.',
    },
    {
      type: 'listen-choose',
      options: ['chaos', 'case', 'cows'],
      answer: 0,
      say: 'It was total chaos.',
      explain: 'chaos = KEI-as: ch gốc Hy Lạp đọc k, hai âm tiết. case (keis) chỉ có một âm tiết; cows (kauz) có âm "au".',
    },
    {
      type: 'listen-type',
      text: 'We sang [karaoke] all night.',
      explain: 'karaoke giọng Mỹ là ke-ri-OH-ki, nhấn OH. Nếu bạn chờ nghe "ka-ra-ô-kê" thì sẽ không nhận ra.',
    },
    {
      type: 'choose',
      prompt: 'Từ này đọc thế nào?',
      show: 'espresso',
      options: ['e-SPRE-soh', 'ek-SPRE-soh', 'es-PREE-soh'],
      answer: 0,
      explain: 'espresso không có x: e-SPRE-soh, nhấn SPRE. "expresso" là lỗi rất hay gặp, kể cả với người bản xứ.',
    },
    {
      type: 'choose',
      prompt: 'zz trong từ này đọc thế nào?',
      show: 'pizza',
      options: ['ts như trong cats', 'z như trong zoo', 's như trong see'],
      answer: 0,
      explain: 'pizza = PEET-sə: zz đọc "ts" theo tiếng Ý, và i đọc ee dài.',
    },
    {
      type: 'listen-choose',
      options: ['character', 'charity', 'chatter'],
      answer: 0,
      say: 'He plays the main character.',
      explain: 'character = KE-rək-tər: ch gốc Hy Lạp đọc k. charity (CHE-rə-di) và chatter (CHA-dər) đọc ch như chair.',
    },
    {
      type: 'choose',
      prompt: 'e cuối của từ này đọc thế nào?',
      show: 'anime',
      options: ['ei như trong day', 'câm như trong time', 'ee như trong see'],
      answer: 0,
      explain: 'anime = A-nə-mei: e cuối đọc "ei". Đây là từ Nhật, không theo quy tắc e câm của tiếng Anh.',
    },
    {
      type: 'choose',
      prompt: 'Âm tiết nào được nhấn?',
      show: 'philosophy',
      options: ['fə-LA-sə-fi', 'FI-lə-sə-fi', 'fi-lə-SA-fi'],
      answer: 0,
      explain: 'philosophy = fə-LA-sə-fi: ph đọc f, nhấn âm thứ hai LA.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. Proper names: places, people, brands
// ---------------------------------------------------------------------------

const names: Lesson = {
  id: 'lw-names',
  course: 'loanwords',
  order: 3,
  title: 'Tên riêng: Leicester → LES-tər',
  summary: 'Địa danh, tên người và thương hiệu hay bị đọc sai, và vì sao.',
  goal: 'Nhận ra các tên riêng quen thuộc khi nghe, kể cả khi chúng không đọc theo mặt chữ.',
  phenomenon: null,
  minutes: 9,
  sections: [
    {
      title: 'Địa danh Anh: viết dài, đọc ngắn',
      blocks: [
        {
          type: 'words',
          title: 'Nghe từng tên (chữ IN HOA = nhấn)',
          items: [
            { word: 'Leicester', sound: 'LES-tər', ipa: '/ˈlɛstər/', mark: 'Lei(ce)ster', note: 'Ba âm tiết trên giấy, chỉ đọc hai.' },
            { word: 'Worcester', sound: 'WUS-tər', ipa: '/ˈwʊstər/', mark: 'Wo(rce)ster', note: 'Thành phố ở bang Massachusetts (Mỹ) cũng đọc như vậy.' },
            { word: 'Gloucester', sound: 'GLAS-tər', ipa: '/ˈɡlɑstər/', mark: 'Glou(ce)ster', note: 'Cùng mẫu: -cester chỉ còn "stər".' },
            { word: 'Edinburgh', sound: 'ED-in-bə-rə', ipa: '/ˈɛdɪnbərə/', mark: 'Edin[burgh]', note: 'Thủ đô Scotland. -burgh đọc bə-rə (người Mỹ hay nói ber-ə), không bao giờ là "burg".',
              why: 'Đuôi **-burgh** là chữ cổ **burh**: thành, pháo đài, cùng gốc với **borough** (quận). Ở Scotland chữ này đọc hai âm tiết, chứ không phải "burg" như Pittsburgh của Mỹ.' },
            { word: 'Thames', sound: 'temz', ipa: '/tɛmz/', mark: 'T(h)am(e)s', note: 'Sông ở London. th đọc t, h và e câm.',
              why: 'Người La Mã gọi sông là **Tamesis**, tiếng Anh cổ viết **Temese**, đều đọc t. Khoảng thế kỷ 16–17 người ta thêm chữ h cho trông "cổ điển" như chữ th của tiếng Hy Lạp (giống Thomas). Chữ h đó chưa bao giờ được đọc.' },
            { word: 'Greenwich', sound: 'GREN-ich', ipa: '/ˈɡrɛnɪtʃ/', mark: 'Green(w)ich', note: 'w câm. Giờ GMT tính theo Greenwich (London).',
              why: 'Tiếng Anh cổ **grēne wīc**: "làng xanh", "bến xanh". Trong địa danh, w ở âm tiết không nhấn thường rơi mất: Warwick cũng đọc WOR-ik.' },
          ],
        },
        {
          type: 'story',
          title: '-cester: dấu vết thành La Mã',
          md: 'Đuôi **-cester** và **-chester** đến từ chữ Latin **castra**: trại lính. Người Anh cổ dùng **ceaster** để gọi mọi thành, đồn cũ của người La Mã, và nhiều thành phố mọc lên trên nền đó: Manchester, Winchester, Leicester.\n\nQua hàng trăm năm, tên được nói nhanh dần và mất bớt âm tiết. Chữ viết thì giữ nguyên, nên Leicester, Worcester, Gloucester viết ba âm tiết mà chỉ đọc hai.\n\nKhông phải tên nào cũng rút gọn: Manchester, Winchester (đuôi -chester) vẫn đọc đủ ba âm tiết, như MAN-ches-tər. Nhóm -cester thì hay bị rút gọn.',
          words: ['Leicester', 'Worcester', 'Gloucester'],
        },
      ],
    },
    {
      title: 'Địa danh Mỹ: tên bản địa, tên người',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'Arkansas', sound: 'AR-kən-saw', ipa: '/ˈɑrkənˌsɔ/', mark: 'Arkansa(s)', note: 's cuối câm. Bang Kansas thì đọc s: KAN-zəs.' },
            { word: 'Illinois', sound: 'i-lə-NOI', ipa: '/ˌɪləˈnɔɪ/', mark: 'Illinoi(s)', note: 's cuối câm.' },
            { word: 'Chicago', sound: 'shi-KA-goh', ipa: '/ʃɪˈkɑɡoʊ/', mark: '[Ch]icago', note: 'ch đọc sh.' },
            { word: 'Michigan', sound: 'MI-shi-gən', ipa: '/ˈmɪʃɪɡən/', mark: 'Mi[ch]igan', note: 'ch đọc sh, nhấn âm đầu.' },
            { word: 'Houston', sound: 'HYOOS-tən', ipa: '/ˈhjustən/', mark: '[Hou]ston', note: 'Thành phố ở Texas. Phố Houston ở New York lại đọc HAUS-tən.',
              why: 'Thành phố ở Texas mang tên tướng **Sam Houston** (HYOOS-tən). Phố Houston ở New York mang tên một người khác, **William Houstoun**, và đọc HAUS-tən: hai người, hai cách đọc.' },
            { word: 'Connecticut', sound: 'kə-NE-di-kət', ipa: '/kəˈnɛɾɪkət/', mark: 'Conne(c)ticut', note: 'Chữ c thứ hai câm.',
              why: 'Từ tiếng của người bản địa (gần như **quinetucket**), nghĩa là "dòng sông dài có thủy triều". Không ai chắc vì sao chữ viết có thêm chữ c thứ hai; nó chưa bao giờ được đọc.' },
            { word: 'Massachusetts', sound: 'ma-sə-CHOO-sits', ipa: '/ˌmæsəˈtʃusɪts/', note: 'Bốn âm tiết, nhấn CHOO.' },
          ],
        },
        {
          type: 'story',
          title: 'Tên bản địa qua tai người Pháp',
          md: 'Nhiều bang và thành phố của Mỹ mang tên từ ngôn ngữ của người bản địa. Với Chicago, Michigan, Illinois, Arkansas, những người châu Âu đầu tiên ghi lại tên là **nhà thám hiểm Pháp**, nên chữ viết theo kiểu Pháp:\n\n- **ch** đọc sh: Chicago, Michigan.\n- **s** cuối câm: Illinois, Arkansas.\n\nNăm 1881, bang Arkansas còn ra hẳn một nghị quyết để chốt cách đọc **AR-kən-saw**, không đọc theo kiểu Kansas.',
          words: ['Chicago', 'Illinois', 'Arkansas'],
        },
      ],
    },
    {
      title: 'Tên người',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'Sean', sound: 'shon', ipa: '/ʃɔn/', mark: '[S]ean', note: 'Một âm tiết, S đọc sh.',
              why: 'Tên Ireland, cùng gốc với John. Trong tiếng Ireland, s đứng trước e, i đọc là "sh".' },
            { word: 'Stephen', sound: 'STEE-vən', ipa: '/ˈstivən/', mark: 'Ste[ph]en', note: 'ph đọc v, không phải f. Đọc giống hệt Steven.',
              why: 'Gốc Hy Lạp **Stephanos**. Từ thời trung đại người Anh đã đọc tên này với âm v, và nhiều người viết luôn là **Steven**. Chữ viết Stephen giữ ph theo tiếng Hy Lạp và Latin, nhưng cách đọc v không đổi.' },
            { word: 'Hermione', sound: 'hər-MAI-ə-ni', ipa: '/hərˈmaɪəni/', note: 'Bốn âm tiết, nhấn MAI.',
              why: 'Tên Hy Lạp cổ: trong thần thoại, Hermione là con gái của nàng Helen thành Troy (tên bắt nguồn từ thần Hermes). Tên Hy Lạp trong tiếng Anh thường đọc cả e cuối: Hermione, Penelope, Nike. Ở tập 4 Harry Potter, Hermione phải đánh vần tên mình cho Viktor Krum: "Her-my-oh-nee".' },
            { word: 'Leigh', sound: 'lee', ipa: '/li/', mark: 'L[ei](gh)', note: 'ei đọc ee, gh câm. Đọc giống hệt Lee.',
              why: 'Tiếng Anh cổ **lēah**: bãi cỏ, khoảng đất trống trong rừng. gh từng là một âm khàn như trong night ngày xưa, rồi rơi rụng; chữ viết vẫn giữ.' },
            { word: 'Ralph', sound: 'ralf', ipa: '/rælf/', note: 'Giọng Mỹ: ralf. Một số người Anh đọc reif, như diễn viên Ralph Fiennes.',
              why: 'Cách đọc cũ của tên này là reif (vì thế có người viết **Rafe**). ralf là cách đọc theo mặt chữ, về sau trở nên phổ biến, nhất là ở Mỹ.' },
          ],
        },
        {
          type: 'tip',
          md: 'Tên người thì **chính người đó** quyết định cách đọc. Khi gặp tên lạ, đừng đoán theo mặt chữ: hãy nghe người khác gọi, hoặc hỏi thẳng "How do you pronounce your name?".',
        },
      ],
    },
    {
      title: 'Thương hiệu: cách đọc của hãng và cách người ta nói',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'Nike', sound: 'NAI-ki', ipa: '/ˈnaɪki/', note: 'Hai âm tiết, không phải "naik".',
              why: 'Tên nữ thần chiến thắng Hy Lạp (Νίκη, hai âm tiết). Người nói tiếng Anh đọc tên Hy Lạp theo kiểu riêng của mình nhưng vẫn đọc e cuối (Penelope, Aphrodite), nên thành NAI-ki.' },
            { word: 'Adidas', sound: 'ə-DEE-dəs', ipa: '/əˈdidəs/', note: 'Mỹ nhấn DEE. Anh – Anh và tiếng Đức nhấn âm đầu: A-di-das.',
              why: 'Ghép từ tên người sáng lập Adolf "Adi" Dassler: Adi + Das.' },
            { word: 'Porsche', sound: 'POR-shə', ipa: '/ˈpɔrʃə/', mark: 'Porsch[e]', note: 'e cuối có đọc. Nhiều người Mỹ (và giọng máy) vẫn nói một âm tiết "porsh".',
              why: 'Họ của nhà sáng lập Ferdinand Porsche, kỹ sư nói tiếng Đức, sinh ở Bohemia (nay thuộc Séc). Tiếng Đức đọc chữ e ở cuối từ.' },
            { word: 'IKEA', sound: 'ai-KEE-ə', ipa: '/aɪˈkiə/', note: 'Cách đọc ở Mỹ. Người Thụy Điển đọc gần như i-KEI-a.',
              why: 'Viết tắt của Ingvar Kamprad (người sáng lập), Elmtaryd (trang trại nơi ông lớn lên) và Agunnaryd (làng quê ông).' },
            { word: 'Hyundai', sound: 'HUN-dei', ipa: '/ˈhʌndeɪ/', note: 'Người Mỹ hay nói HUN-dei. Ở Anh hay nghe hai-UN-dai.',
              why: 'Tiếng Hàn nghĩa là "hiện đại", cùng gốc chữ Hán với từ "hiện đại" của tiếng Việt.' },
          ],
        },
        {
          type: 'tip',
          md: 'Với thương hiệu, cách đọc của hãng và cách người ta nói hằng ngày có thể khác nhau, và khác theo từng nước. Khi nghe, bạn cần nhận ra **cả hai**.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['Leicester', 'Lancaster', 'Manchester'],
      answer: 0,
      say: 'I studied in Leicester.',
      explain: 'Leicester chỉ có hai âm tiết: LES-tər. Lancaster (LAN-kə-stər) và Manchester (MAN-ches-tər) đều có ba.',
    },
    {
      type: 'choose',
      prompt: 'Tên thành phố này đọc thế nào?',
      show: 'Worcester',
      options: ['WUS-tər', 'wor-SES-tər', 'WOR-ches-tər'],
      answer: 0,
      explain: 'Worcester = WUS-tər. Như Leicester, phần "rce" ở giữa không đọc.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được tên bang nào?',
      play: 'We drove through Arkansas.',
      options: ['Arkansas', 'Kansas', 'Alaska'],
      answer: 0,
      explain: 'Arkansas = AR-kən-saw: s cuối câm, nhấn AR. Kansas thì đọc s: KAN-zəs.',
    },
    {
      type: 'listen-type',
      text: 'She moved to [Chicago] last year.',
      explain: 'Chicago = shi-KA-goh: ch đọc sh theo chính tả Pháp, không phải "chi-ca-gô".',
    },
    {
      type: 'silent-letter',
      word: 'Thames',
      silent: [1, 4],
      explain: 'Thames = temz: Th đọc t (h câm), e cũng câm.',
    },
    {
      type: 'choose',
      prompt: 'Tên riêng trong câu có mấy âm tiết?',
      play: 'Hermione is my favorite character.',
      options: ['2', '3', '4'],
      answer: 2,
      explain: 'Hermione = hər-MAI-ə-ni: bốn âm tiết, nhấn MAI. Đuôi -ione đọc ə-ni chứ không phải "on".',
    },
    {
      type: 'choose',
      prompt: 'Ở Mỹ, người ta thường gọi hãng xe này thế nào?',
      show: 'Hyundai',
      options: ['HUN-dei', 'hai-UN-dai', 'HYOON-dai'],
      answer: 0,
      explain: 'Ở Mỹ đa số nói HUN-dei. hai-UN-dai là cách hay nghe ở Anh.',
    },
    {
      type: 'listen-choose',
      options: ['Stephen', 'Stefan', 'Simon'],
      answer: 0,
      say: 'Stephen is my best friend.',
      explain: 'Stephen = STEE-vən: ph đọc v, ee dài. Stefan (STE-fən) có âm f và e ngắn.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. British vs American
// ---------------------------------------------------------------------------

const usUk: Lesson = {
  id: 'lw-us-uk',
  course: 'loanwords',
  order: 4,
  title: 'Anh – Mỹ: schedule, tomato, herb',
  summary: 'Những từ giọng Anh và giọng Mỹ đọc khác nhau, để nghe ra cả phim Mỹ lẫn BBC.',
  goal: 'Biết chỗ giọng Anh đọc khác giọng Mỹ, để nghe BBC không bị lạ tai.',
  phenomenon: null,
  minutes: 9,
  sections: [
    {
      title: 'Hai giọng, một ngôn ngữ',
      blocks: [
        {
          type: 'text',
          md: 'Phim Mỹ và YouTube phần lớn là **giọng Mỹ**; BBC và nhiều sách giáo khoa là **giọng Anh**. Bạn không cần nói giọng Anh, chỉ cần **nhận ra** cả hai khi nghe.',
        },
        {
          type: 'story',
          title: 'Ai đổi, ai giữ?',
          md: 'Nhiều người nghĩ giọng Anh "gốc" hơn. Thực ra ở vài điểm, **giọng Mỹ giữ cách đọc cũ**.\n\nThế kỷ 17, khi người Anh sang Bắc Mỹ, phần lớn họ còn đọc **r sau nguyên âm** (car, more). Về sau, ở miền nam nước Anh âm r này dần mất, và a trong **bath**, **dance** kéo dài ra. Giọng Mỹ chuẩn không theo những thay đổi đó.\n\nNgược lại, T bật (water → WA-dər) là nét mới của giọng Mỹ.',
          words: ['car', 'bath', 'water'],
        },
      ],
    },
    {
      title: 'Cùng một từ, hai cách đọc',
      blocks: [
        {
          type: 'words',
          title: 'Giọng Mỹ (chữ IN HOA = nhấn)',
          items: [
            { word: 'schedule', sound: 'SKE-jool', ipa: '/ˈskɛdʒul/', mark: '[sch]edule', note: 'Anh – Anh: SHED-yool.',
              why: 'Tiếng Anh mượn từ tiếng Pháp cổ **cedule** (đọc s). Thế kỷ 16 chữ viết được sửa theo tiếng Latin **schedula** thành sch-. Người Anh về sau đọc sh theo kiểu Pháp; người Mỹ đọc sk như school, scheme, và từ điển Webster chọn cách này.' },
            { word: 'tomato', sound: 'tə-MEI-doh', ipa: '/təˈmeɪɾoʊ/', note: 'Anh – Anh: tə-MA-toh.' },
            { word: 'either', sound: 'EE-thər', ipa: '/ˈiðər/', note: 'Cả hai giọng đều có EE-thər và AI-thər; ở Anh hay nghe AI-thə hơn. neither cũng vậy.' },
            { word: 'route', sound: 'root', ipa: '/rut/', note: 'Mỹ đọc cả root và raut (nhất là tuyến giao hàng, router). Anh – Anh: root.' },
            { word: 'vitamin', sound: 'VAI-də-min', ipa: '/ˈvaɪɾəmɪn/', note: 'Anh – Anh: VI-tə-min, i ngắn.',
              why: 'Năm 1912 nhà hóa sinh Casimir Funk đặt tên **vitamine** = vital (sống, đọc vai) + amine. Người Mỹ giữ "vai" của vital; người Anh đọc i ngắn.' },
            { word: 'privacy', sound: 'PRAI-və-si', ipa: '/ˈpraɪvəsi/', note: 'Anh – Anh hay đọc PRI-və-si.' },
            { word: 'advertisement', sound: 'ad-vər-TAIZ-mənt', ipa: '/ˌædvərˈtaɪzmənt/', note: 'Anh – Anh (và một số người Mỹ): əd-VER-tis-mənt, nhấn âm thứ hai.' },
            { word: 'leisure', sound: 'LEE-zhər', ipa: '/ˈliʒər/', note: 'Anh – Anh: LE-zhə, e ngắn.' },
            { word: 'process', sound: 'PRA-ses', ipa: '/ˈprɑsɛs/', note: 'Anh – Anh: PROH-ses. Ở Mỹ cũng có người nói PROH-ses.' },
            { word: 'been', sound: 'bin', ipa: '/bɪn/', note: 'Anh – Anh khi nhấn: ee dài như bean. Nói nhanh thì cả hai đều là bin.' },
            { word: 'oregano', sound: 'ə-RE-gə-noh', ipa: '/əˈrɛɡənoʊ/', note: 'Lá kinh giới. Anh – Anh: o-ri-GA-noh, nhấn âm thứ ba.' },
          ],
        },
        {
          type: 'tip',
          md: 'Cột cách đọc là giọng Mỹ; ghi chú "Anh – Anh" cho biết người Anh đọc khác chỗ nào. Nút nghe dùng giọng bạn chọn trong Cài đặt. Muốn nghe giọng Anh: vào Cài đặt → Giọng đọc, chọn một giọng en-GB (nếu máy bạn có) rồi bấm nghe lại các từ này.',
        },
      ],
    },
    {
      title: 'h, a, r, t: bốn dấu hiệu dễ nghe',
      blocks: [
        {
          type: 'rule',
          title: 'Nghe là biết giọng nào',
          body: '- **h**: Mỹ không đọc h trong **herb**.\n- **a**: Mỹ đọc a bẹt (như cat) trong **bath, dance, ask, can\'t**. Giọng Anh chuẩn (miền nam, BBC) đọc a dài, mở miệng (như father); miền bắc nước Anh vẫn đọc a ngắn.\n- **r**: Mỹ đọc r sau nguyên âm (**car, more**). Giọng Anh chuẩn bỏ r khi sau nó không có nguyên âm.\n- **t**: Mỹ bật t giữa hai nguyên âm thành d nhẹ (**water → WA-dər**). Xem bài T bật trong khóa Nghe nối âm.',
        },
        {
          type: 'words',
          items: [
            { word: 'herb', sound: 'erb', ipa: '/ɝb/', mark: '(h)erb', note: 'Anh – Anh đọc h.',
              why: 'Tiếng Anh mượn từ tiếng Pháp cổ **erbe**, vốn không có h. Chữ h được thêm vào chữ viết sau này cho giống tiếng Latin **herba**. Người Anh bắt đầu đọc h theo chữ viết từ thế kỷ 19; người Mỹ giữ cách đọc cũ.' },
            { word: "can't", sound: 'kæn(t)', ipa: '/kænt/', note: 'Anh – Anh: a dài /ɑː/ như father.', review: false },
            { word: 'bath', sound: 'bath', ipa: '/bæθ/', note: 'Anh – Anh: a dài /ɑː/.', review: false },
            { word: 'dance', sound: 'dans', ipa: '/dæns/', note: 'Anh – Anh: a dài /ɑː/.', review: false },
            { word: 'ask', sound: 'ask', ipa: '/æsk/', note: 'Anh – Anh: a dài /ɑː/.', review: false },
            { word: 'car', sound: 'kar', ipa: '/kɑr/', note: 'Anh – Anh bỏ r: /kɑː/.', review: false },
            { word: 'more', sound: 'mor', ipa: '/mɔr/', note: 'Anh – Anh bỏ r: /mɔː/.', review: false },
            { word: 'water', sound: 'WA-dər', ipa: '/ˈwɔɾər/', note: 'Anh – Anh: WO-tə, t rõ, không có r.' },
            { word: 'better', sound: 'BE-dər', ipa: '/ˈbɛɾər/', note: 'Anh – Anh: BE-tə.' },
          ],
        },
        {
          type: 'examples',
          title: 'Giọng Mỹ trong câu',
          items: [
            { text: "It's an herb.", note: 'h câm nên người Mỹ nói an herb, nối thành ə-nerb.' },
            { text: "I can't dance.", note: 'Mỹ: a bẹt ở cả hai từ.' },
            { text: 'I need some more water.', note: 'Mỹ: more có r, t trong water bật thành d.' },
            { text: 'Have you been there?', note: 'been → bin.' },
          ],
        },
      ],
    },
    {
      title: 'Ba cái tên có chuyện',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'aluminum', sound: 'ə-LOO-mə-nəm', ipa: '/əˈlumənəm/', note: 'Cách viết và cách đọc của Mỹ.',
              why: 'Nhà hóa học Anh Humphry Davy thử nhiều tên: alumium (1808), rồi aluminum (1812). Một nhà khoa học khác đề nghị aluminium cho giống sodium, potassium. Người Anh theo aluminium; ở Mỹ cả hai cách viết từng được dùng, đến đầu thế kỷ 20 aluminum thắng (Hội Hóa học Mỹ chốt năm 1925).' },
            { word: 'aluminium', sound: 'al-yə-MI-ni-əm', ipa: '/ˌæljəˈmɪniəm/', note: 'Cách viết và cách đọc của Anh: thêm chữ i, thêm một âm tiết, nhấn MI.' },
            { word: 'lieutenant', sound: 'loo-TE-nənt', ipa: '/luˈtɛnənt/', note: 'Trung úy. Người Anh đọc lef-TE-nənt (riêng Hải quân Anh: lə-TE-nənt).',
              why: 'Từ tiếng Pháp **lieu** (chỗ) + **tenant** (người giữ): người giữ chỗ thay cấp trên. Vì sao người Anh đọc có âm f thì đến nay vẫn chưa rõ.' },
            { word: 'Z', sound: 'zee', ipa: '/zi/', note: 'Tên chữ cái. Anh – Anh (và Canada, Úc): zed.',
              why: '**zed** đi từ tên chữ Hy Lạp **zeta** qua tiếng Pháp. Người Mỹ đổi thành zee cho vần với bee, cee, dee.' },
          ],
        },
        {
          type: 'tip',
          md: 'Khi nghe một từ quen mà "lạ tai", hãy thử nghĩ: **có phải giọng kia không?** Nghe "SHED-yool" thì đó vẫn là schedule, nghe "zed" thì đó vẫn là chữ Z.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['leisure', 'ledger', 'seizure'],
      answer: 0,
      say: 'I play tennis in my leisure time.',
      explain: 'leisure time = thời gian rảnh. Giọng Mỹ đọc LEE-zhər, giọng Anh LE-zhə. ledger (sổ cái) có âm "j", seizure bắt đầu bằng s.',
    },
    {
      type: 'listen-choose',
      options: ['aluminum', 'alumni', 'album'],
      answer: 0,
      say: 'This can is made of aluminum.',
      explain: 'aluminum (Mỹ) = ə-LOO-mə-nəm, bốn âm tiết. Người Anh viết và đọc aluminium: al-yə-MI-ni-əm.',
    },
    {
      type: 'listen-type',
      text: 'Take one [vitamin] every day.',
      explain: 'Giọng Mỹ: VAI-də-min (ai, t bật). Giọng Anh: VI-tə-min (i ngắn). Cùng một từ vitamin.',
    },
    {
      type: 'silent-letter',
      word: 'herb',
      silent: [0],
      prompt: 'Giọng Mỹ: chạm vào chữ không đọc.',
      explain: 'Giọng Mỹ đọc herb là erb: h câm. Giọng Anh thì đọc h. Nếu bạn đang dùng giọng Anh (en-GB) thì sẽ nghe có h.',
    },
    {
      type: 'choose',
      prompt: 'Người Anh thường đọc từ này thế nào?',
      show: 'lieutenant',
      options: ['lef-TE-nənt', 'loo-TE-nənt', 'LOO-tə-nənt'],
      answer: 0,
      explain: 'Người Anh thường đọc lef-TE-nənt, có âm f dù chữ viết không có f. Giọng Mỹ: loo-TE-nənt.',
    },
    {
      type: 'choose',
      prompt: 'Người Anh gọi chữ cái này là gì?',
      show: 'Z',
      options: ['zed', 'zee', 'zet'],
      answer: 0,
      explain: 'Anh – Anh (và Canada, Úc) gọi là zed. Người Mỹ gọi là zee.',
    },
    {
      type: 'listen-type',
      text: 'I put a [tomato] in the salad.',
      explain: 'Giọng Mỹ: tə-MEI-doh (ei, t bật thành d). Giọng Anh: tə-MA-toh. Cùng một từ tomato.',
    },
    {
      type: 'choose',
      prompt: 'Giọng Mỹ đọc từ này thế nào?',
      show: 'schedule',
      options: ['SKE-jool', 'SHED-yool', 'SKEE-dool'],
      answer: 0,
      explain: 'Giọng Mỹ: SKE-jool, sch đọc sk như trong school. SHED-yool là giọng Anh.',
    },
  ],
};

export const LOANWORDS_LESSONS: Lesson[] = [french, greek, names, usUk];
