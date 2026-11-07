// Course "spelling": Chữ viết → âm đọc (spelling patterns: magic e, vowel teams, r, sh/ch/th, -tion…).
// Every lesson: course: 'spelling', order 1..n (contiguous), unique id, 8 quiz items, phenomenon: null.
// Shapes and rules: docs/courses.md. Validation: npx vitest run src/features/lessons
//
// The regular patterns: what a spelling USUALLY sounds like, so a learner can guess a new word and recognise the
// spelling of a word they hear. Lesson order builds up: short/long vowels first, stress last. Truly odd words
// (colonel, said, women…) and their stories belong to course "irregular"; lessons here point to the lesson there by
// name. A common exception shown here gets a short `why` story when no other lesson tells it.
// Respellings: the convention at the top of src/core/decoder/tables.ts; a word of 2+ syllables is respelled with
// hyphens and its stressed syllable in CAPS (mə-SHEEN). /ɛr/ is spelled "eər" here (hair → heər) so it never
// reads as "er" /ɝ/ (her). IPA: General American.
// `examples` blocks run the connected-speech decoder, so they are used only where linking/elision is the point.
import type { Lesson } from '../lessonTypes';

// ---------------------------------------------------------------------------
// 1. Magic E
// ---------------------------------------------------------------------------

const magicE: Lesson = {
  id: 'sp-magic-e',
  course: 'spelling',
  order: 1,
  title: 'E câm cuối từ: hat → hate',
  summary: 'Chữ e cuối không đọc, nhưng làm nguyên âm phía trước đọc như tên chữ cái.',
  goal: 'Nghe và đoán được cặp hat / hate, hop / hope, và biết vì sao hoping có một p còn hopping có hai.',
  phenomenon: null,
  minutes: 8,
  sections: [
    {
      title: 'Nguyên âm ngắn và nguyên âm "tên chữ"',
      blocks: [
        {
          type: 'rule',
          title: 'Nguyên âm + một phụ âm + e câm',
          body: 'Nguyên âm đứng trước **một phụ âm cuối** thường đọc **ngắn**: hat, kit, hop, cut, pet.\n\nThêm **e** câm sau phụ âm đó, nguyên âm đọc **dài, giống tên chữ cái**: a → "ei", i → "ai", o → "oh", u → "yoo", e → "ee".\n\nChữ e cuối **không đọc**, nó chỉ là dấu hiệu. (Sau r, l, j, và giọng Mỹ cả sau t, d, n, s, thì u + e thường chỉ là "oo": rule, June, tube. Anh – Anh: tyoob.)',
        },
        {
          type: 'words',
          title: 'Ngắn → dài',
          items: [
            { word: 'hat', sound: 'hat', ipa: '/hæt/', mark: 'h[a]t' },
            { word: 'hate', sound: 'heit', ipa: '/heɪt/', mark: 'h[a]t(e)' },
            { word: 'kit', sound: 'kit', ipa: '/kɪt/', mark: 'k[i]t' },
            { word: 'kite', sound: 'kait', ipa: '/kaɪt/', mark: 'k[i]t(e)' },
            { word: 'hop', sound: 'hap', ipa: '/hɑp/', mark: 'h[o]p' },
            { word: 'hope', sound: 'hohp', ipa: '/hoʊp/', mark: 'h[o]p(e)' },
            { word: 'cut', sound: 'kut', ipa: '/kʌt/', mark: 'c[u]t' },
            { word: 'cute', sound: 'kyoot', ipa: '/kjut/', mark: 'c[u]t(e)' },
            { word: 'pet', sound: 'pet', ipa: '/pɛt/', mark: 'p[e]t' },
            { word: 'Pete', sound: 'peet', ipa: '/pit/', mark: 'P[e]t(e)', note: 'Tên riêng. e + phụ âm + e ít gặp hơn: these, complete.' },
          ],
        },
        {
          type: 'tip',
          md: 'Người Việt hay bỏ qua chữ e cuối khi đọc, nên hope thành "hóp". Ngược lại, khi nghe một từ một âm tiết có nguyên âm dài "ei", "ai", "oh", hãy đoán: chữ viết **rất có thể** có e câm ở cuối (hoặc một cặp nguyên âm, bài sau).',
        },
      ],
    },
    {
      title: 'Một phụ âm hay hai: hoping và hopping',
      blocks: [
        {
          type: 'rule',
          title: 'Thêm -ing, -ed, -er: đếm phụ âm',
          body: 'Khi thêm đuôi bắt đầu bằng nguyên âm:\n\n- Từ có e câm: bỏ e, giữ **một** phụ âm, nguyên âm vẫn dài: hope → **hoping**.\n- Từ có nguyên âm ngắn: **gấp đôi** phụ âm để nguyên âm vẫn ngắn: hop → **hopping**.\n\nVậy khi gặp từ có đuôi -ing, -ed, -er: **một phụ âm** trước đuôi → thường là từ gốc có e câm, nguyên âm dài (hoping); **hai phụ âm** → nguyên âm ngắn (hopping). Với từ khác, một phụ âm không chắc là dài: lemon, never, city đều ngắn.',
        },
        {
          type: 'words',
          items: [
            { word: 'hoping', sound: 'HOH-ping', ipa: '/ˈhoʊpɪŋ/', mark: 'ho[p]ing', note: 'Một p: o dài "oh" (từ hope).' },
            { word: 'hopping', sound: 'HA-ping', ipa: '/ˈhɑpɪŋ/', mark: 'ho[pp]ing', note: 'Hai p: o ngắn (từ hop).' },
            { word: 'later', sound: 'LEI-dər', ipa: '/ˈleɪɾɚ/', mark: 'la[t]er', note: 'Một t: a dài "ei" (từ late).' },
            { word: 'latter', sound: 'LA-dər', ipa: '/ˈlæɾɚ/', mark: 'la[tt]er', note: 'Hai t: a ngắn. Giọng Mỹ: nghe giống hệt ladder (cái thang).' },
            { word: 'diner', sound: 'DAI-nər', ipa: '/ˈdaɪnɚ/', mark: 'di[n]er', note: 'Một n: i dài "ai" (từ dine).' },
            { word: 'dinner', sound: 'DI-nər', ipa: '/ˈdɪnɚ/', mark: 'di[nn]er', note: 'Hai n: i ngắn.' },
          ],
        },
      ],
    },
    {
      title: 'Ngoại lệ hay gặp',
      blocks: [
        {
          type: 'rule',
          title: 'Có e cuối mà nguyên âm vẫn ngắn',
          body: 'Tiếng Anh gần như **không để chữ v đứng cuối từ**, nên luôn viết thêm e sau v. Vì vậy đuôi **ve** không cho biết chắc nguyên âm dài hay ngắn: five, save đọc dài, nhưng have, give, love đọc ngắn.\n\nVài từ rất thông dụng khác cũng không theo luật: come, some, done, gone. Mỗi từ có một lý do: bấm "Vì sao?" ở từng từ. Các từ lạ hơn (said, women, one): bài **Từ đọc lạ hẳn** của khóa Từ bất quy tắc.',
        },
        {
          type: 'words',
          items: [
            { word: 'have', sound: 'hav', ipa: '/hæv/', mark: 'hav(e)', note: 'Không phải "heiv".', review: true },
            { word: 'give', sound: 'giv', ipa: '/ɡɪv/', mark: 'giv(e)', review: true },
            {
              word: 'love',
              sound: 'luv',
              review: true,
              ipa: '/lʌv/',
              mark: 'lov(e)',
              why: 'Giống come: chữ o thay cho u để dễ đọc khi viết tay. Chữ e thêm vào vì tiếng Anh không để v cuối từ.',
            },
            { word: 'live', sound: 'liv', ipa: '/lɪv/', mark: 'liv(e)', say: 'I live in Hanoi.', note: 'Động từ (sống): liv. Tính từ (a live show) mới là "laiv".', review: true },
            {
              word: 'come',
              sound: 'kum',
              review: true,
              ipa: '/kʌm/',
              mark: 'com(e)',
              note: 'Viết o, đọc u như cup.',
              why: 'Thời chép sách bằng tay, chữ u viết bằng hai nét sổ, gần giống n; m là ba nét sổ. Viết **cum**, **sum**, **luve** thì thành một hàng nét sổ liền nhau, rất khó đọc. Người chép sách đổi u thành **o** khi đứng cạnh m, n, v: come, some, love, son, wonder. Âm vẫn là u như cup.',
            },
            { word: 'some', sound: 'sum', ipa: '/sʌm/', mark: 'som(e)', why: 'Giống come: chữ o thay cho u để dễ đọc khi viết tay. Âm vẫn là u.', review: true },
            { word: 'done', sound: 'dun', ipa: '/dʌn/', mark: 'don(e)', why: 'done là dạng của **do** nên giữ chữ o của do, dù âm đã đổi thành u như cup.', review: true },
            {
              word: 'gone',
              sound: 'gon',
              ipa: '/ɡɔn/',
              mark: 'gon(e)',
              note: 'Không phải "gohn".',
              why: 'gone là dạng của **go** nên giữ chữ o và chữ e, nhưng nguyên âm bị rút ngắn.',
            },
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['hat', 'hate', 'heat'],
      answer: 1,
      explain: 'hate = heit: a đọc "ei" vì có e câm cuối. hat là a ngắn, heat là "heet".',
    },
    {
      type: 'silent-letter',
      word: 'hope',
      silent: [3],
      explain: 'Chỉ e cuối câm. Nó làm o đọc thành "oh": hohp.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: "I'm hoping to see you soon.",
      options: ['hoping', 'hopping'],
      answer: 0,
      explain: 'hoping = HOH-ping: o đọc "oh" vì chỉ có một p (từ hope). hopping (hai p, từ hop) có o ngắn: HA-ping.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'The baby is so cute.',
      options: ['cute', 'cut', 'coat'],
      answer: 0,
      explain: 'cute = kyoot: u + phụ âm + e câm đọc "yoo". cut là kut, coat là koht.',
    },
    {
      type: 'listen-choose',
      options: ['a kite', 'a kit', 'a cat'],
      answer: 0,
      explain: 'kite = kait: i + t + e câm đọc "ai". kit có i ngắn, cat có a ngắn.',
    },
    {
      type: 'choose',
      prompt: 'Chữ a trong từ này đọc thế nào?',
      show: 'later',
      options: ['ei (dài)', 'a (ngắn)'],
      answer: 0,
      explain: 'later = late + er: chỉ một t nên a dài "ei": LEI-dər. latter (hai t) mới là a ngắn.',
    },
    {
      type: 'choose',
      prompt: 'Từ này đọc thế nào?',
      show: 'love',
      options: ['luv', 'lohv', 'lov'],
      answer: 0,
      explain: 'Tiếng Anh luôn thêm e sau v cuối từ, nên e ở đây không làm nguyên âm dài. love = luv, giống have, give.',
    },
    {
      type: 'choose',
      prompt: 'Chữ i trong từ này đọc thế nào?',
      show: 'dinner',
      options: ['i ngắn: DI-nər', 'ai: DAI-nər'],
      answer: 0,
      explain: 'Hai n → i ngắn: DI-nər. diner (một n) mới là DAI-nər: thực khách, hoặc (ở Mỹ) quán ăn bình dân.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Vowel teams
// ---------------------------------------------------------------------------

const vowelTeams: Lesson = {
  id: 'sp-ee-ai-oo',
  course: 'spelling',
  order: 2,
  title: 'Cặp nguyên âm: ee, ea, oo, ow',
  summary: 'Hai nguyên âm đi cùng thường cho một âm dài, nhưng đó chỉ là xu hướng.',
  goal: 'Đoán âm của các cặp nguyên âm thường gặp và nhớ những ngoại lệ lớn.',
  phenomenon: null,
  minutes: 10,
  sections: [
    {
      title: 'ee, ai, ay, oa: đọc tên chữ đầu',
      blocks: [
        {
          type: 'rule',
          title: '"Hai nguyên âm đi cùng": chỉ là xu hướng',
          body: 'Trẻ em Mỹ học câu: khi hai nguyên âm đi cùng, chữ đầu "đọc tên của nó". Câu này đúng với **ee, ai, ay, oa**: green, rain, day, boat.\n\nNhưng nó sai với rất nhiều từ (bread, food, said). Hãy xem nó là **gợi ý đầu tiên**, không phải luật.',
        },
        {
          type: 'words',
          items: [
            { word: 'green', sound: 'green', ipa: '/ɡrin/', mark: 'gr[ee]n' },
            { word: 'rain', sound: 'rein', ipa: '/reɪn/', mark: 'r[ai]n' },
            { word: 'day', sound: 'dei', ipa: '/deɪ/', mark: 'd[ay]', note: 'ai giữa từ, ay cuối từ: cùng âm "ei".' },
            { word: 'boat', sound: 'boht', ipa: '/boʊt/', mark: 'b[oa]t' },
            { word: 'road', sound: 'rohd', ipa: '/roʊd/', mark: 'r[oa]d' },
          ],
        },
        {
          type: 'tip',
          md: 'Đừng đọc **ay** theo tiếng Việt. "ay" Việt (máy, hay) gần âm **ai** của tiếng Anh. Nhưng day là "dei", không phải "dai". Vì vậy ứng dụng viết âm này là **ei**.',
        },
      ],
    },
    {
      title: 'ea: một cách viết, ba âm',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'eat', sound: 'eet', ipa: '/it/', mark: '[ea]t', note: 'Hay gặp nhất: ea = "ee".' },
            { word: 'teacher', sound: 'TEE-chər', ipa: '/ˈtitʃɚ/', mark: 't[ea]cher' },
            { word: 'bread', sound: 'bred', ipa: '/brɛd/', mark: 'br[ea]d', note: 'Khá nhiều từ: ea = e ngắn (head, ready).', review: true },
            { word: 'head', sound: 'hed', ipa: '/hɛd/', mark: 'h[ea]d', review: true },
            { word: 'weather', sound: 'WE-thər', ipa: '/ˈwɛðɚ/', mark: 'w[ea]ther', review: true },
            {
              word: 'great',
              sound: 'greit',
              review: true,
              ipa: '/ɡreɪt/',
              mark: 'gr[ea]t',
              note: 'Hiếm: ea = "ei" (great, break, steak). Giống hệt grate (bào, mài).',
              why: 'Ngày xưa ea đọc gần như "e" tiếng Việt, kéo dài. Về sau âm này nâng dần lên "ê" rồi lên "ee", nên phần lớn từ nay đọc "ee" (eat, meat, speak). Vài từ dừng lại ở bước "ê", nay đọc "ei": great, break, steak. Vì vậy great vần với late, không vần với meat.',
            },
            { word: 'break', sound: 'breik', ipa: '/breɪk/', mark: 'br[ea]k', note: 'Giống hệt brake (phanh).', review: true },
            { word: 'steak', sound: 'steik', ipa: '/steɪk/', mark: 'st[ea]k', note: 'Bít tết. Giống hệt stake (cái cọc).', review: true },
          ],
        },
      ],
    },
    {
      title: 'oo, ow, ou: một cách viết, nhiều âm',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'food', sound: 'food', ipa: '/fud/', mark: 'f[oo]d', note: 'oo dài: food, moon, school.' },
            { word: 'moon', sound: 'moon', ipa: '/mun/', mark: 'm[oo]n' },
            { word: 'good', sound: 'gud', ipa: '/ɡʊd/', mark: 'g[oo]d', note: 'oo ngắn, môi ít tròn: good, book, look.' },
            { word: 'book', sound: 'buk', ipa: '/bʊk/', mark: 'b[oo]k' },
            {
              word: 'blood',
              sound: 'blud',
              review: true,
              ipa: '/blʌd/',
              mark: 'bl[oo]d',
              note: 'Rất hiếm: oo như u trong cup (blood, flood). Câu chuyện: bài "Từ đọc lạ hẳn" của khóa Từ bất quy tắc.',
            },
            { word: 'snow', sound: 'snoh', ipa: '/snoʊ/', mark: 'sn[ow]', note: 'ow = "oh": snow, know, slow.' },
            { word: 'cow', sound: 'kau', ipa: '/kaʊ/', mark: 'c[ow]', note: 'ow = "au": cow, now, down.' },
            { word: 'out', sound: 'aut', ipa: '/aʊt/', mark: '[ou]t', note: 'ou thường = "au": out, house, loud.' },
            { word: 'soup', sound: 'soop', ipa: '/sup/', mark: 's[ou]p', note: 'Một số từ: ou = "oo" (soup, group, you).', review: true },
          ],
        },
        {
          type: 'tip',
          md: 'Với **oo** và **ow**, chữ viết không cho biết âm nào: phải học theo từ. Cùng chữ ow mà hai âm, nên bow và row có hai cách đọc tùy nghĩa.',
        },
      ],
    },
    {
      title: 'oi, oy, au, aw, ew',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'coin', sound: 'koin', ipa: '/kɔɪn/', mark: 'c[oi]n' },
            { word: 'boy', sound: 'boi', ipa: '/bɔɪ/', mark: 'b[oy]', note: 'oi giữa từ, oy cuối từ: cùng âm "oi".' },
            { word: 'cause', sound: 'koz', ipa: '/kɔz/', mark: 'c[au]se', note: 'au, aw = "o". Nhiều người Mỹ đọc gần "a".' },
            { word: 'draw', sound: 'draw', ipa: '/drɔ/', mark: 'dr[aw]', note: 'aw cuối từ: o mở, vần với saw, law.' },
            { word: 'new', sound: 'noo', ipa: '/nu/', mark: 'n[ew]', note: 'Giọng Mỹ: "noo". Anh – Anh: "nyoo".' },
            { word: 'few', sound: 'fyoo', ipa: '/fju/', mark: 'f[ew]', note: 'Đôi khi ew = "yoo": few, nephew.' },
          ],
        },
      ],
    },
    {
      title: 'ie và ei',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'piece', sound: 'pees', ipa: '/pis/', mark: 'p[ie]ce', note: 'ie giữa từ thường = "ee" (field, believe). Giống hệt peace (hòa bình).' },
            { word: 'pie', sound: 'pai', ipa: '/paɪ/', mark: 'p[ie]', note: 'ie cuối từ ngắn = "ai" (tie, lie).' },
            { word: 'vein', sound: 'vein', ipa: '/veɪn/', mark: 'v[ei]n', note: 'ei thường đọc "ei" (eight, weigh). Chỉ sau c mới hay là "ee".' },
            { word: 'receive', sound: 'ri-SEEV', ipa: '/rɪˈsiv/', mark: 'rec[ei]ve', note: 'Sau c, viết ei mà đọc "ee" (receive, ceiling).' },
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Hai từ có oo trong câu này đọc thế nào?',
      play: 'The food was good.',
      options: ['food dài "oo", good ngắn "u"', 'Cả hai dài "oo"', 'Cả hai ngắn "u"'],
      answer: 0,
      explain: 'food = food (oo dài), good = gud (oo ngắn). Cùng chữ oo mà hai âm khác nhau.',
    },
    {
      type: 'listen-choose',
      options: ['Look at the boat.', 'Look at the boot.', 'Look at the bat.'],
      answer: 0,
      explain: 'boat = boht: oa đọc "oh". boot có oo dài, bat có a ngắn.',
    },
    {
      type: 'choose',
      prompt: 'Chữ ea trong từ này đọc thế nào?',
      show: 'great',
      options: ['ei', 'ee', 'e'],
      answer: 0,
      explain: 'great = greit, giống break, steak. Đây là ngoại lệ hiếm; ea thường là "ee" (eat) hoặc "e" (bread).',
    },
    {
      type: 'choose',
      prompt: 'Chữ ow trong từ này đọc thế nào?',
      show: 'cow',
      options: ['au', 'oh'],
      answer: 0,
      explain: 'cow = kau. ow có hai âm: "au" (cow, now, down) và "oh" (snow, know, slow). Phải học theo từ.',
    },
    {
      type: 'listen-type',
      text: "It's going to [snow] tonight.",
      explain: 'snow = snoh: ow ở đây đọc "oh", không phải "au".',
    },
    {
      type: 'choose',
      prompt: 'Chữ oo trong từ này đọc thế nào?',
      show: 'blood',
      options: ['u như cup', 'oo dài như food', 'u ngắn như good'],
      answer: 0,
      explain: 'blood = blud, giống flood. Rất ít từ có oo đọc như u trong cup.',
    },
    {
      type: 'listen-choose',
      options: ['a new coin', 'a new cone', 'a new cane'],
      answer: 0,
      explain: 'coin = koin: oi đọc "oi". cone = kohn, cane = kein.',
    },
    {
      type: 'choose',
      prompt: 'Chữ ie trong từ này đọc thế nào?',
      show: 'piece',
      options: ['ee', 'ai', 'Hai âm i và e'],
      answer: 0,
      explain: 'ie giữa từ thường là "ee": piece = pees, field, believe. ie cuối từ ngắn (pie, tie) mới là "ai".',
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. R-controlled vowels (General American)
// ---------------------------------------------------------------------------

const rVowels: Lesson = {
  id: 'sp-ar-er-or',
  course: 'spelling',
  order: 3,
  title: 'Nguyên âm + R: her, bird, turn',
  summary: 'Giọng Mỹ đọc rõ R; er, ir, ur là cùng một âm.',
  goal: 'Nghe ra ar, or, er, và biết er, ir, ur, wor đọc giống nhau.',
  phenomenon: null,
  minutes: 9,
  sections: [
    {
      title: 'ar và or',
      blocks: [
        {
          type: 'rule',
          title: 'Giọng Mỹ luôn đọc R',
          body: 'Chữ **r** sau nguyên âm được đọc rõ: lưỡi cong về sau, không chạm vào đâu. Nguyên âm trước r đổi màu theo:\n\n- **ar** → "ar": car, park, start\n- **or** → "or": short, morning, horse\n\nGiọng Anh thường bỏ âm r này (car nghe như "ca"). Phim và YouTube Mỹ thì đọc rõ.',
        },
        {
          type: 'words',
          items: [
            { word: 'car', sound: 'kar', ipa: '/kɑr/', mark: 'c[ar]' },
            { word: 'park', sound: 'park', ipa: '/pɑrk/', mark: 'p[ar]k' },
            { word: 'start', sound: 'start', ipa: '/stɑrt/', mark: 'st[ar]t' },
            { word: 'short', sound: 'short', ipa: '/ʃɔrt/', mark: 'sh[or]t' },
            { word: 'morning', sound: 'MOR-ning', ipa: '/ˈmɔrnɪŋ/', mark: 'm[or]ning' },
            { word: 'horse', sound: 'hors', ipa: '/hɔrs/', mark: 'h[or]s(e)' },
          ],
        },
        {
          type: 'tip',
          md: 'Người Việt hay bỏ âm r cuối, đọc car thành "ca". Giọng Mỹ giữ r: lưỡi cong về sau và giữ âm đó đến hết từ. Khi nghe, âm r này cho bạn biết chữ viết có r.',
        },
      ],
    },
    {
      title: 'er, ir, ur: cùng một âm',
      blocks: [
        {
          type: 'rule',
          title: 'er = ir = ur',
          body: 'Khi được nhấn và sau r **không có nguyên âm**, ba cách viết này đọc **giống hệt nhau**: "er" /ɝ/, gần "ơ" kéo dài với lưỡi cong. (very, fire, pure không theo luật này.)\n\nNghe thấy âm "er", bạn chưa biết chữ viết là er, ir hay ur: phải học theo từ.\n\nKhi **không nhấn** (thường ở cuối từ), er, or, ar chỉ còn "ər" rất nhẹ: teacher, doctor, dollar.',
        },
        {
          type: 'words',
          items: [
            { word: 'her', sound: 'her', ipa: '/hɝ/', mark: 'h[er]' },
            { word: 'term', sound: 'term', ipa: '/tɝm/', mark: 't[er]m' },
            { word: 'bird', sound: 'berd', ipa: '/bɝd/', mark: 'b[ir]d' },
            { word: 'first', sound: 'ferst', ipa: '/fɝst/', mark: 'f[ir]st' },
            { word: 'turn', sound: 'tern', ipa: '/tɝn/', mark: 't[ur]n' },
            { word: 'nurse', sound: 'ners', ipa: '/nɝs/', mark: 'n[ur]s(e)' },
            { word: 'Thursday', sound: 'THERZ-dei', ipa: '/ˈθɝzdeɪ/', mark: 'Th[ur]sday' },
            { word: 'teacher', sound: 'TEE-chər', ipa: '/ˈtitʃɚ/', mark: 'teach[er]', note: 'Không nhấn: chỉ còn "ər".' },
            { word: 'doctor', sound: 'DAK-tər', ipa: '/ˈdɑktɚ/', mark: 'doct[or]' },
            { word: 'dollar', sound: 'DA-lər', ipa: '/ˈdɑlɚ/', mark: 'doll[ar]' },
          ],
        },
      ],
    },
    {
      title: 'Sau w: wor đọc là "wer"',
      blocks: [
        {
          type: 'rule',
          title: 'w + or → "wer"; w + ar → "wor"',
          body: 'Sau chữ **w**, **or** thường đọc như er: **word, work, world, worse, worth**. Không phải "wo".\n\nNgược lại, **war** đọc là "wor": war, warm, warn.',
        },
        {
          type: 'words',
          items: [
            { word: 'word', sound: 'werd', ipa: '/wɝd/', mark: 'w[or]d' },
            { word: 'work', sound: 'werk', ipa: '/wɝk/', mark: 'w[or]k' },
            { word: 'world', sound: 'werld', ipa: '/wɝld/', mark: 'w[or]ld' },
            { word: 'worse', sound: 'wers', ipa: '/wɝs/', mark: 'w[or]s(e)' },
            { word: 'war', sound: 'wor', ipa: '/wɔr/', mark: 'w[ar]', note: 'Ngược lại: ar sau w đọc "or". Giống hệt wore (quá khứ của wear).', review: true },
            { word: 'warn', sound: 'worn', ipa: '/wɔrn/', mark: 'w[ar]n', note: 'Cảnh báo. Giống hệt worn (đã mặc).', review: true },
          ],
        },
      ],
    },
    {
      title: 'air, are, ear, eer, ere',
      blocks: [
        {
          type: 'rule',
          title: 'Hai âm chính: "eər" và "eer"',
          body: '- **air, are** → "eər" (e + r): hair, care, share\n- **ear, eer, ere** → "eer": near, beer, here\n\nNgoại lệ lớn: **there, where** (ere) và **bear, wear, pear** (ear) đọc "eər" như hair; **heart** là "hart"; **learn, early, earth** là "er" như her; **were** là "wer".',
        },
        {
          type: 'words',
          items: [
            { word: 'hair', sound: 'heər', ipa: '/hɛr/', mark: 'h[air]' },
            { word: 'care', sound: 'keər', ipa: '/kɛr/', mark: 'c[are]' },
            { word: 'share', sound: 'sheər', ipa: '/ʃɛr/', mark: 'sh[are]' },
            { word: 'near', sound: 'neer', ipa: '/nɪr/', mark: 'n[ear]' },
            { word: 'here', sound: 'heer', ipa: '/hɪr/', mark: 'h[ere]' },
            { word: 'where', sound: 'weər', ipa: '/wɛr/', mark: 'wh[ere]', note: 'Ngoại lệ: ere = "eər" (there, where). Giống hệt wear (mặc).', review: true },
            { word: 'bear', sound: 'beər', ipa: '/bɛr/', mark: 'b[ear]', note: 'Ngoại lệ: ear = "eər" (bear, wear, pear). Giống hệt bare (trần, trống).', review: true },
            {
              word: 'heart',
              sound: 'hart',
              review: true,
              ipa: '/hɑrt/',
              mark: 'h[ear]t',
              note: 'Ngoại lệ: ear = "ar".',
              why: 'Thời trung đại, er trong nhiều từ chuyển thành âm ar: sterre thành star, ferre thành far. heart (ngày xưa viết herte) cũng đổi âm theo, nhưng chữ viết vẫn giữ e. Từ sergeant cũng vậy: đọc SAR-jənt. Giọng Anh còn thêm vài từ: clerk đọc "klark".',
            },
            { word: 'learn', sound: 'lern', ipa: '/lɝn/', mark: 'l[ear]n', note: 'ear + phụ âm hay là "er" (early, earth).', review: true },
            { word: 'were', sound: 'wer', ipa: '/wɝ/', mark: 'w[er](e)', note: 'Ngoại lệ: không phải "weer".', review: true },
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['I saw a bird.', 'I saw a bed.', 'I saw a bud.'],
      answer: 0,
      explain: 'bird = berd: ir đọc "er", lưỡi cong. bed có e ngắn, bud có u ngắn, cả hai không có r.',
    },
    {
      type: 'choose',
      prompt: 'Từ nào trong câu có âm "er"?',
      play: 'I walk to work.',
      options: ['work', 'walk', 'Cả hai'],
      answer: 0,
      explain: 'work = werk: wor đọc "wer". walk = wok: l câm, không có r.',
    },
    {
      type: 'listen-choose',
      options: ['It was the first time.', 'It was the fast time.', 'It was the last time.'],
      answer: 0,
      explain: 'first = ferst: ir đọc "er". fast, last có a ngắn và không có r.',
    },
    {
      type: 'choose',
      prompt: 'Hai từ bear và near có cùng nguyên âm không?',
      play: 'There is a bear near the river.',
      options: ['Không: bear là "beər", near là "neer"', 'Có, cả hai là "eer"'],
      answer: 0,
      explain: 'Cùng chữ ear nhưng bear là "eər" (ngoại lệ, giống wear, pear), còn near là "eer" (hear, clear).',
    },
    {
      type: 'choose',
      prompt: 'Từ này đọc thế nào?',
      show: 'world',
      options: ['werld', 'wold', 'warld'],
      answer: 0,
      explain: 'wor sau w đọc "wer": world, word, work, worse.',
    },
    {
      type: 'choose',
      prompt: 'Chữ ear trong từ này đọc thế nào?',
      show: 'heart',
      options: ['ar', 'eer', 'er'],
      answer: 0,
      explain: 'heart = hart: ngoại lệ. ear thường là "eer" (near, hear), hoặc "er" trước phụ âm (learn, early).',
    },
    {
      type: 'choose',
      prompt: 'Nhóm nào có ba từ CÙNG nguyên âm?',
      options: ['her, bird, turn', 'her, hair, here', 'car, care, core'],
      answer: 0,
      explain: 'er, ir, ur khi nhấn đọc giống hệt nhau: her, berd, tern. Còn hair = heər, here = heer khác nhau.',
    },
    {
      type: 'choose',
      prompt: 'Phần "or" cuối từ này đọc thế nào?',
      show: 'doctor',
      options: ['ər, rất nhẹ', 'or rõ như short'],
      answer: 0,
      explain: 'or, er, ar ở âm tiết không nhấn chỉ còn "ər": DAK-tər, giống teacher, dollar.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. Consonant teams
// ---------------------------------------------------------------------------

const consonantTeams: Lesson = {
  id: 'sp-sh-ch-th',
  course: 'spelling',
  order: 4,
  title: 'Phụ âm ghép: sh, ch, th, gh',
  summary: 'Hai chữ cái mà chỉ một âm: sh, ch, th, ph, gh, wh, ck, ng, qu.',
  goal: 'Nhìn một cặp phụ âm là đoán được âm, và không đọc chúng theo kiểu chữ Việt.',
  phenomenon: null,
  minutes: 9,
  sections: [
    {
      title: 'Hai chữ, một âm',
      blocks: [
        {
          type: 'rule',
          title: 'Phụ âm ghép đọc thành MỘT âm',
          body: 'Đừng đọc từng chữ. Mỗi cặp là **một âm** riêng:\n\n- **sh** = /ʃ/: ship, wish\n- **ch** = /tʃ/: chair, lunch\n- **ph** = /f/: phone, graph\n- **ck** = /k/: back, check (chỉ đứng sau nguyên âm ngắn)\n- **wh** = /w/: when, where. Riêng **who, whom, whose, whole** thì wh = /h/',
        },
        {
          type: 'words',
          title: 'Chữ tô màu là phụ âm ghép',
          items: [
            { word: 'ship', sound: 'ship', ipa: '/ʃɪp/', mark: '[sh]ip' },
            { word: 'wish', sound: 'wish', ipa: '/wɪʃ/', mark: 'wi[sh]' },
            { word: 'chair', sound: 'cheər', ipa: '/tʃɛr/', mark: '[ch]air' },
            { word: 'lunch', sound: 'lunch', ipa: '/lʌntʃ/', mark: 'lun[ch]' },
            { word: 'phone', sound: 'fohn', ipa: '/foʊn/', mark: '[ph]one', note: 'ph = /f/, giống hệt "ph" tiếng Việt.' },
            { word: 'graph', sound: 'graf', ipa: '/ɡræf/', mark: 'gra[ph]' },
            { word: 'back', sound: 'bak', ipa: '/bæk/', mark: 'ba[ck]', note: '/k/ cuối có thật nhưng thường rất nhẹ, có khi không bật hơi: hãy để ý tiếng tắc ở cuối.' },
            { word: 'when', sound: 'wen', ipa: '/wɛn/', mark: '[wh]en', note: 'Giọng Mỹ thường ngày: wh = /w/.' },
            {
              word: 'who',
              sound: 'hoo',
              review: true,
              ipa: '/hu/',
              mark: '(w)[h]o',
              note: 'w câm, chỉ còn /h/ (who, whom, whose, whole).',
              why: 'Tiếng Anh cổ viết who là **hwā** và đọc có cả h lẫn w. Về sau người chép sách đảo hw thành wh. Âm w rụng trước nguyên âm o tròn môi (giống two, sword), chỉ còn h; nhưng chữ w vẫn ở lại.',
            },
          ],
        },
      ],
    },
    {
      title: 'ch có ba cách đọc, th có hai',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'cheese', sound: 'cheez', ipa: '/tʃiz/', mark: '[ch]eese', note: 'Hay gặp nhất: /tʃ/.' },
            {
              word: 'chorus',
              sound: 'KOR-əs',
              review: true,
              ipa: '/ˈkɔrəs/',
              mark: '[ch]orus',
              note: 'Từ gốc Hy Lạp: ch = /k/ (school, stomach). Câu chuyện: bài "Từ mượn" của khóa Từ mượn.',
            },
            { word: 'school', sound: 'skool', ipa: '/skul/', mark: 's[ch]ool', review: true },
            { word: 'chef', sound: 'shef', ipa: '/ʃɛf/', mark: '[ch]ef', note: 'Từ gốc Pháp: ch = /ʃ/ (machine).', review: true },
            { word: 'machine', sound: 'mə-SHEEN', ipa: '/məˈʃin/', mark: 'ma[ch]ine', review: true },
            { word: 'think', sound: 'think', ipa: '/θɪŋk/', mark: '[th]ink', note: 'th vô thanh: thổi hơi qua đầu lưỡi, cổ không rung.' },
            { word: 'this', sound: 'this', ipa: '/ðɪs/', mark: '[th]is', note: 'th hữu thanh: cùng khẩu hình, cổ họng rung (the, that).' },
            { word: 'mother', sound: 'MU-thər', ipa: '/ˈmʌðɚ/', mark: 'mo[th]er' },
          ],
        },
        {
          type: 'tip',
          md: 'Tiếng Việt cũng có "th", "ch", "tr", nhưng **không cùng âm**:\n\n- "th" Việt là /t/ bật hơi. **th** Anh đặt đầu lưỡi giữa hai hàm răng rồi thổi hơi. think không phải "thinh".\n- "ch" Việt là âm tắc, không có tiếng xì. **ch** Anh /tʃ/ giống "t" + "sh": có tiếng xì rõ, môi hơi chu ra. "tr" Việt cũng không phải âm này.\n- "ph" thì giống hệt: **ph** Anh = /f/.',
        },
      ],
    },
    {
      title: 'gh: /f/, câm, hoặc /g/',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'laugh', sound: 'laf', ipa: '/læf/', mark: 'lau[gh]', note: 'gh cuối từ sau au, ou: có khi là /f/ (laugh, enough, cough).', review: true },
            { word: 'night', sound: 'nait', ipa: '/naɪt/', mark: 'ni(gh)t', note: 'igh = "ai", gh câm (light, right, high). Giống hệt knight.' },
            { word: 'light', sound: 'lait', ipa: '/laɪt/', mark: 'li(gh)t' },
            { word: 'eight', sound: 'eit', ipa: '/eɪt/', mark: 'ei(gh)t', note: 'Giống hệt ate (quá khứ của eat).' },
            { word: 'ghost', sound: 'gohst', ipa: '/ɡoʊst/', mark: '[g](h)ost', note: 'gh đầu từ = /g/, h câm.' },
          ],
        },
        {
          type: 'tip',
          md: 'Trong tiếng Anh, **gh đầu từ** là /g/ (ghost); giữa từ hiếm khi là /g/ (spaghetti). Giữa hay cuối từ, gh thường **câm** (night) hoặc là **/f/** (laugh). Không có luật chắc chắn từ nào là /f/: học theo từ.\n\n"gh" tiếng Việt (ghế, ghi) chỉ gần giống: /g/ tiếng Anh là âm tắc, cuống lưỡi chặn hơi rồi bật ra, rõ hơn g Việt.\n\nVì sao gh lại câm hoặc thành /f/? Xem bài **Họ ough** của khóa Từ bất quy tắc.',
        },
      ],
    },
    {
      title: 'ng, nk, qu, tch, dge',
      blocks: [
        {
          type: 'words',
          items: [
            { word: 'sing', sound: 'sing', ipa: '/sɪŋ/', mark: 'si[ng]', note: 'ng cuối từ = /ŋ/, như "ng" cuối tiếng Việt (sang).' },
            {
              word: 'finger',
              sound: 'FING-gər',
              review: true,
              ipa: '/ˈfɪŋɡɚ/',
              mark: 'fi[ng]er',
              note: 'Giữa từ gốc, ng hay là /ŋ/ + /g/ (finger, hungry). Nhưng động từ + đuôi -er, -ing thì chỉ /ŋ/: singer, singing.',
            },
            { word: 'bank', sound: 'bank', ipa: '/bæŋk/', mark: 'ba[nk]', note: 'nk = /ŋk/: "ng" rồi bật /k/.' },
            { word: 'queen', sound: 'kween', ipa: '/kwin/', mark: '[qu]een', note: 'qu thường = /kw/, có tiếng "w" nhẹ. Từ gốc Pháp như unique chỉ là /k/.' },
            { word: 'quick', sound: 'kwik', ipa: '/kwɪk/', mark: '[qu]ick' },
            { word: 'watch', sound: 'wach', ipa: '/wɑtʃ/', mark: 'wa[tch]', note: 'tch = /tʃ/ sau nguyên âm ngắn. t không đọc riêng.' },
            { word: 'kitchen', sound: 'KI-chən', ipa: '/ˈkɪtʃən/', mark: 'ki[tch]en' },
            { word: 'bridge', sound: 'brij', ipa: '/brɪdʒ/', mark: 'bri[dge]', note: 'dge = /dʒ/ sau nguyên âm ngắn (edge, judge).' },
            { word: 'judge', sound: 'juj', ipa: '/dʒʌdʒ/', mark: 'ju[dge]' },
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['thick', 'sick', 'tick'],
      answer: 0,
      explain: 'thick bắt đầu bằng th vô thanh: hơi thổi qua đầu lưỡi giữa hai hàm răng. sick là /s/ (lưỡi sau răng), tick là /t/ bật.',
    },
    {
      type: 'silent-letter',
      word: 'night',
      silent: [2, 3],
      explain: 'igh đọc "ai", gh câm: nait.',
    },
    {
      type: 'listen-choose',
      options: ['I need to wash it.', 'I need to watch it.', 'I need to catch it.'],
      answer: 1,
      explain: 'watch kết thúc bằng tch = /tʃ/, có tiếng bật "t" trước tiếng xì. wash là sh = /ʃ/, chỉ có tiếng xì kéo dài.',
    },
    {
      type: 'listen-type',
      text: 'The [phone] is ringing.',
      explain: 'ph = /f/: phone = fohn. Giống "ph" tiếng Việt.',
    },
    {
      type: 'choose',
      prompt: 'Chữ "ch" trong từ này đọc thế nào?',
      show: 'chorus',
      options: ['/k/', '/tʃ/ như chair', '/ʃ/ như chef'],
      answer: 0,
      explain: 'chorus gốc Hy Lạp nên ch = /k/: KOR-əs. Giống school, stomach.',
    },
    {
      type: 'choose',
      prompt: 'Chữ "ng" trong từ này đọc thế nào?',
      show: 'finger',
      options: ['/ŋ/ rồi /g/: FING-gər', 'Chỉ /ŋ/, như singer'],
      answer: 0,
      explain: 'finger là từ gốc, không phải động từ + đuôi, nên ng = /ŋ/ + /g/: FING-gər. singer (sing + er) chỉ có /ŋ/: SING-ər.',
    },
    {
      type: 'choose',
      prompt: 'Từ này bắt đầu bằng âm gì?',
      show: 'ghost',
      options: ['/g/', '/f/', '/h/'],
      answer: 0,
      explain: 'gh ở đầu từ = /g/, h câm: gohst. Gần giống "gh" tiếng Việt (ghế), nhưng bật mạnh hơn.',
    },
    {
      type: 'choose',
      prompt: 'Chữ "wh" trong từ này đọc thế nào?',
      show: 'who',
      options: ['/h/ (w câm)', '/w/ (h câm)'],
      answer: 0,
      explain: 'who, whom, whose, whole: wh đọc /h/ (who = hoo). Trong when, what, where thì wh = /w/.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Soft and hard C / G, S, X, -tion endings
// ---------------------------------------------------------------------------

const softHard: Lesson = {
  id: 'sp-soft-hard',
  course: 'spelling',
  order: 5,
  title: 'C, G, S, X đổi âm; đuôi -tion, -ture',
  summary: 'c, g đổi âm trước e, i, y; s có lúc là /z/; các đuôi tion, sure đọc gọn.',
  goal: 'Đoán đúng âm của c, g, s, x và các đuôi tion, sion, cial, ture, sure, ous.',
  phenomenon: null,
  minutes: 10,
  sections: [
    {
      title: 'C cứng và C mềm',
      blocks: [
        {
          type: 'rule',
          title: 'c + e, i, y → thường /s/',
          body: 'Trước **e, i, y**, chữ **c** thường đọc **/s/** (c mềm): cell, circle, cycle. (Trong các đuôi cial, cian, cean thì là /ʃ/: special, musician, ocean.)\n\nTrước **a, o, u**, trước phụ âm (trừ h) hoặc cuối từ, **c** đọc **/k/** (c cứng): cat, cold, cup, music.',
        },
        {
          type: 'words',
          items: [
            { word: 'cat', sound: 'kat', ipa: '/kæt/', mark: '[c]at' },
            { word: 'cold', sound: 'kohld', ipa: '/koʊld/', mark: '[c]old' },
            { word: 'cup', sound: 'kup', ipa: '/kʌp/', mark: '[c]up' },
            { word: 'cell', sound: 'sel', ipa: '/sɛl/', mark: '[c]ell', note: 'c trước e: /s/.' },
            { word: 'circle', sound: 'SER-kəl', ipa: '/ˈsɝkəl/', mark: '[c]ir[c]le', note: 'c đầu trước i: /s/. c sau trước l: /k/.' },
            { word: 'cycle', sound: 'SAI-kəl', ipa: '/ˈsaɪkəl/', mark: '[c]ycle' },
            { word: 'ice', sound: 'ais', ipa: '/aɪs/', mark: 'i[c]e' },
            { word: 'accept', sound: 'ək-SEPT', ipa: '/əkˈsɛpt/', mark: 'a[cc]ept', note: 'cc trước e, i: /ks/ (accept, success).' },
          ],
        },
        {
          type: 'tip',
          md: 'Tiếng Việt cũng để ý chữ đứng sau: viết "ca, co, cu" nhưng "ke, ki". Tiếng Việt **đổi chữ**, giữ âm. Tiếng Anh thì **giữ chữ c, đổi âm** thành /s/ trước e, i, y.',
        },
      ],
    },
    {
      title: 'G cứng và G mềm',
      blocks: [
        {
          type: 'rule',
          title: 'g + e, i, y → thường /dʒ/',
          body: 'Trước **e, i, y**, chữ **g** thường đọc **/dʒ/** (như j): giant, gym, page.\n\nTrước **a, o, u** và phụ âm, g đọc **/g/**: game, go, green.\n\nNgoại lệ rất hay gặp: **get, give, girl, begin, together** vẫn là /g/. Với g, ngoại lệ nhiều hơn hẳn so với c.',
        },
        {
          type: 'words',
          items: [
            { word: 'game', sound: 'geim', ipa: '/ɡeɪm/', mark: '[g]ame' },
            { word: 'giant', sound: 'JAI-ənt', ipa: '/ˈdʒaɪənt/', mark: '[g]iant', note: 'g trước i: /dʒ/.' },
            { word: 'gym', sound: 'jim', ipa: '/dʒɪm/', mark: '[g]ym' },
            { word: 'page', sound: 'peij', ipa: '/peɪdʒ/', mark: 'pa[g]e' },
            { word: 'get', sound: 'get', ipa: '/ɡɛt/', mark: '[g]et', note: 'Ngoại lệ: trước e mà vẫn /g/. Xem "Vì sao?" ở give.', review: true },
            {
              word: 'give',
              sound: 'giv',
              review: true,
              ipa: '/ɡɪv/',
              mark: '[g]ive',
              note: 'Ngoại lệ: trước i mà vẫn /g/.',
              why: 'Tiếng Anh cổ đọc give gần như "yiv". Người Viking từ Bắc Âu sống ở Anh nói **gefa**, **geta** với g cứng, và cách đọc của họ thắng. Vì vậy get, give, gift giữ /g/ dù đứng trước e, i.',
            },
            { word: 'girl', sound: 'gerl', ipa: '/ɡɝl/', mark: '[g]irl', review: true },
            { word: 'begin', sound: 'bi-GIN', ipa: '/bɪˈɡɪn/', mark: 'be[g]in', review: true },
            { word: 'guess', sound: 'ges', ipa: '/ɡɛs/', mark: '[g](u)ess', note: 'Chữ u chen vào để giữ g cứng (guess, guide, guitar).' },
          ],
        },
        {
          type: 'tip',
          md: 'Tiếng Việt viết **gh** trước e, ê, i (ghế, ghi). Tiếng Anh làm việc tương tự bằng chữ **u** để giữ g cứng: guess, guide.\n\nCòn "gi" tiếng Việt (gia đình) **không phải** âm của giant. **gi** tiếng Anh là /dʒ/ (giant) hoặc /g/ (give).',
        },
      ],
    },
    {
      title: 'S là /s/ hay /z/? X là /ks/ hay /gz/?',
      blocks: [
        {
          type: 'rule',
          title: 'S và X',
          body: '- Đầu từ, **s** thường là /s/: sun (sure, sugar là /ʃ/). **ss** thường là /s/: class (trừ ssion, ssure = /ʃ/; vài từ là /z/: dessert, scissors).\n- Giữa hai nguyên âm (kể cả s + e câm), s **thường** là /z/: music, nose. Nhưng basic, case vẫn là /s/.\n- Các từ nhỏ **is, has, was, his, as** đều là /z/.\n- **x** thường là /ks/: box, six. Trong **ex** + nguyên âm có nhấn phía sau, x hay là /gz/: exam, exact, example.',
        },
        {
          type: 'words',
          items: [
            { word: 'sun', sound: 'sun', ipa: '/sʌn/', mark: '[s]un' },
            { word: 'class', sound: 'klas', ipa: '/klæs/', mark: 'cla[ss]' },
            { word: 'music', sound: 'MYOO-zik', ipa: '/ˈmjuzɪk/', mark: 'mu[s]ic', note: 's giữa hai nguyên âm: /z/.' },
            { word: 'nose', sound: 'nohz', ipa: '/noʊz/', mark: 'no[s]e' },
            { word: 'use', sound: 'yoos', ipa: '/jus/', mark: 'u[s]e', say: "What's the use of it?", note: 'Danh từ (a use): /s/.', review: true },
            { word: 'use', sound: 'yooz', ipa: '/juz/', mark: 'u[s]e', say: 'Can I use your phone?', note: 'Động từ (to use): /z/.', review: true },
            { word: 'box', sound: 'baks', ipa: '/bɑks/', mark: 'bo[x]', note: 'x = /ks/.' },
            { word: 'exam', sound: 'ig-ZAM', ipa: '/ɪɡˈzæm/', mark: 'e[x]am', note: 'ex + âm tiết nhấn: x = /gz/.' },
          ],
        },
        {
          type: 'tip',
          md: 'Thêm các từ đổi âm theo nghĩa như use (close, excuse): bài **Cùng chữ khác âm** của khóa Từ bất quy tắc.',
        },
      ],
    },
    {
      title: 'Các đuôi đọc gọn: tion, sure, ous',
      blocks: [
        {
          type: 'rule',
          title: 'Đuôi là MỘT âm tiết yếu, không đọc từng chữ',
          body: '- **tion**, **ssion** → "shən": nation, mission. **sion** sau n, l cũng vậy: tension\n- Riêng **stion** → "chən": question, suggestion\n- **sion** sau nguyên âm → "zhən": vision, decision. Sau r, giọng Mỹ thường cũng là "zhən": version (Anh – Anh: "shən")\n- **cial**, **cian** → "shəl", "shən": special, musician\n- **ture** → "chər": picture, future\n- **sure** sau nguyên âm → "zhər": measure. **ssure** → "shər": pressure\n- **ous** → "əs": famous, dangerous',
        },
        {
          type: 'words',
          items: [
            { word: 'nation', sound: 'NEI-shən', ipa: '/ˈneɪʃən/', mark: 'na[tion]' },
            { word: 'mission', sound: 'MI-shən', ipa: '/ˈmɪʃən/', mark: 'mi[ssion]' },
            { word: 'question', sound: 'KWES-chən', ipa: '/ˈkwɛstʃən/', mark: 'que[stion]', note: 's + tion: "chən", không phải "shən".' },
            { word: 'vision', sound: 'VI-zhən', ipa: '/ˈvɪʒən/', mark: 'vi[sion]' },
            { word: 'special', sound: 'SPE-shəl', ipa: '/ˈspɛʃəl/', mark: 'spe[cial]' },
            { word: 'picture', sound: 'PIK-chər', ipa: '/ˈpɪktʃɚ/', mark: 'pic[ture]' },
            { word: 'measure', sound: 'ME-zhər', ipa: '/ˈmɛʒɚ/', mark: 'mea[sure]' },
            { word: 'pressure', sound: 'PRE-shər', ipa: '/ˈprɛʃɚ/', mark: 'pre[ssure]' },
            { word: 'famous', sound: 'FEI-məs', ipa: '/ˈfeɪməs/', mark: 'fam[ous]' },
          ],
        },
        {
          type: 'tip',
          md: 'Người Việt hay đọc từng chữ: nation thành "nây-ti-ôn". Hãy nhớ đuôi **tion** chỉ là một âm tiết rất nhẹ "shən", và trọng âm rơi vào âm tiết **ngay trước** nó: NEI-shən, in-fər-MEI-shən.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Hai chữ c trong từ này đọc thế nào?',
      show: 'circle',
      options: ['/s/ rồi /k/', '/k/ rồi /s/', 'Cả hai là /k/', 'Cả hai là /s/'],
      answer: 0,
      explain: 'c đầu đứng trước i nên là /s/; c thứ hai đứng trước l (phụ âm) nên là /k/: SER-kəl.',
    },
    {
      type: 'choose',
      prompt: 'Chữ g trong từ này đọc thế nào?',
      show: 'giant',
      options: ['/dʒ/ như j', '/g/', '"gi" như tiếng Việt (gia đình)'],
      answer: 0,
      explain: 'g trước i thường là /dʒ/: JAI-ənt. "gi" tiếng Việt (gia đình) là một âm khác.',
    },
    {
      type: 'choose',
      prompt: 'Chữ g trong từ này đọc thế nào?',
      show: 'give',
      options: ['/g/', '/dʒ/ như j'],
      answer: 0,
      explain: 'give là ngoại lệ: g trước i mà vẫn là /g/. Tương tự get, girl, begin.',
    },
    {
      type: 'choose',
      prompt: 'Chữ s trong music đọc thế nào?',
      play: 'I love this music.',
      options: ['/z/', '/s/'],
      answer: 0,
      explain: 's đứng giữa hai nguyên âm nên đọc /z/: MYOO-zik. Giống nose, easy.',
    },
    {
      type: 'listen-choose',
      options: ['We need more pressure.', 'We need more pleasure.', 'We need more pictures.'],
      answer: 0,
      explain: 'pressure: ssure = "shər" (PRE-shər). pleasure: sure sau nguyên âm = "zhər" (PLE-zhər), và bắt đầu bằng pl.',
    },
    {
      type: 'choose',
      prompt: 'Bạn nghe được từ nào?',
      play: 'The whole nation was watching.',
      options: ['nation', 'notion', 'nature'],
      answer: 0,
      explain: 'nation = NEI-shən: tion đọc "shən". nature kết thúc bằng ture = "chər". notion có nguyên âm "oh".',
    },
    {
      type: 'choose',
      prompt: 'Phần "sure" trong từ này đọc thế nào?',
      show: 'measure',
      options: ['zhər', 'shər', 'sur'],
      answer: 0,
      explain: 'Sau nguyên âm, sure = "zhər": ME-zhər, pleasure, treasure. ssure (pressure) mới là "shər".',
    },
    {
      type: 'choose',
      prompt: 'Chữ x trong từ này đọc thế nào?',
      show: 'exam',
      options: ['/gz/', '/ks/', '/z/'],
      answer: 0,
      explain: 'ex + nguyên âm, trọng âm ở phía sau → /gz/: ig-ZAM, exact, example. Trong box, six thì x = /ks/.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. Endings -ed and -s
// ---------------------------------------------------------------------------

const endings: Lesson = {
  id: 'sp-endings',
  course: 'spelling',
  order: 6,
  title: 'Đuôi -ed và -s: ba cách đọc',
  summary: 'worked, played, wanted; cats, dogs, buses: đuôi nhỏ mà đổi nghĩa.',
  goal: 'Biết đuôi -ed đọc /t/, /d/ hay /ɪd/, đuôi -s đọc /s/, /z/ hay /ɪz/, và nghe ra chúng.',
  phenomenon: null,
  minutes: 9,
  sections: [
    {
      title: 'Đuôi -ed: /t/, /d/, /ɪd/',
      blocks: [
        {
          type: 'rule',
          title: 'Nhìn ÂM cuối của động từ gốc',
          body: '- Sau **t, d** → **/ɪd/**, thêm một âm tiết: needed, decided\n- Sau âm **vô thanh** (p, k, s, sh, ch, f) → **/t/**: worked, stopped, washed\n- Sau các âm **hữu thanh** còn lại (nguyên âm, b, g, v, l, m, n, r, z) → **/d/**: played, called, lived\n\nChỉ /ɪd/ mới thêm âm tiết. worked vẫn là **một** âm tiết: werkt.\n\nMột số tính từ đuôi -ed đọc /ɪd/ dù không đứng sau t, d: naked, wicked, crooked.',
        },
        {
          type: 'words',
          items: [
            { word: 'needed', sound: 'NEE-did', ipa: '/ˈnidɪd/', mark: 'need[ed]', note: '/ɪd/: thêm một âm tiết.' },
            { word: 'decided', sound: 'di-SAI-did', ipa: '/dɪˈsaɪdɪd/', mark: 'decid[ed]' },
            { word: 'worked', sound: 'werkt', ipa: '/wɝkt/', mark: 'work[ed]', note: '/t/: vẫn một âm tiết.' },
            { word: 'stopped', sound: 'stapt', ipa: '/stɑpt/', mark: 'stopp[ed]' },
            { word: 'washed', sound: 'washt', ipa: '/wɑʃt/', mark: 'wash[ed]' },
            { word: 'laughed', sound: 'laft', ipa: '/læft/', mark: 'laugh[ed]', note: 'gh = /f/, vô thanh, nên đuôi là /t/.' },
            { word: 'played', sound: 'pleid', ipa: '/pleɪd/', mark: 'play[ed]', note: '/d/: sau nguyên âm.' },
            { word: 'called', sound: 'kold', ipa: '/kɔld/', mark: 'call[ed]' },
            { word: 'lived', sound: 'livd', ipa: '/lɪvd/', mark: 'liv[ed]' },
            { word: 'cleaned', sound: 'kleend', ipa: '/klind/', mark: 'clean[ed]' },
          ],
        },
      ],
    },
    {
      title: 'Đuôi -s, -es, \'s: /s/, /z/, /ɪz/',
      blocks: [
        {
          type: 'rule',
          title: 'Cùng cách nghĩ với -ed',
          body: '- Sau âm **xì** (s, z, sh, ch, j, x) → **/ɪz/**, thêm âm tiết: buses, watches, oranges\n- Sau âm **vô thanh** (p, t, k, f, th) → **/s/**: cats, books, laughs\n- Sau các âm **hữu thanh** còn lại → **/z/**: dogs, calls, plays\n\nLuật này dùng cho số nhiều (cats), động từ ngôi thứ ba (works) và sở hữu (Liz\'s).',
        },
        {
          type: 'words',
          items: [
            { word: 'cats', sound: 'kats', ipa: '/kæts/', mark: 'cat[s]', note: '/s/.' },
            { word: 'books', sound: 'buks', ipa: '/bʊks/', mark: 'book[s]' },
            { word: 'laughs', sound: 'lafs', ipa: '/læfs/', mark: 'laugh[s]' },
            { word: 'dogs', sound: 'dogz', ipa: '/dɔɡz/', mark: 'dog[s]', note: '/z/.' },
            { word: 'plays', sound: 'pleiz', ipa: '/pleɪz/', mark: 'play[s]' },
            { word: 'calls', sound: 'kolz', ipa: '/kɔlz/', mark: 'call[s]' },
            { word: 'buses', sound: 'BU-siz', ipa: '/ˈbʌsɪz/', mark: 'bus[es]', note: '/ɪz/: thêm một âm tiết.' },
            { word: 'watches', sound: 'WA-chiz', ipa: '/ˈwɑtʃɪz/', mark: 'watch[es]' },
            { word: 'oranges', sound: 'OR-in-jiz', ipa: '/ˈɔrɪndʒɪz/', mark: 'orange[s]', note: 'ge = /dʒ/, âm "xì" nên thêm /ɪz/.' },
            { word: "Liz's", sound: 'LI-ziz', ipa: '/ˈlɪzɪz/', mark: "Liz['s]" },
          ],
        },
        {
          type: 'tip',
          md: 'Tiếng Việt không có cụm phụ âm cuối như /ts/, /kt/, /dz/, nên người Việt hay đọc cats thành "cát", worked thành "work". Khi nghe cũng vậy: tai bạn **bỏ qua** đuôi nhỏ này. Nhưng nó mang nghĩa: một hay nhiều, hiện tại hay quá khứ.',
        },
      ],
    },
    {
      title: 'Đuôi nhỏ trong câu thật',
      blocks: [
        {
          type: 'examples',
          items: [
            { text: 'He walked away.', note: 'Đuôi /t/ nối sang away nên nghe rõ hơn.' },
            { text: 'She wanted a new phone.', note: 'wanted: thêm âm tiết /ɪd/.' },
            { text: 'My friends always help me.', note: 'friends: đuôi /z/.' },
            { text: 'He watches a lot of movies.', note: 'watches: /ɪz/, thêm một âm tiết.' },
          ],
        },
        {
          type: 'tip',
          md: 'Trước nguyên âm, đuôi nối sang từ sau (walked away): xem bài **Nối âm**. Trước phụ âm, đuôi -ed thường gần như mất (I worked late): xem bài **Nuốt âm**. Khi đó hãy dựa vào ngữ cảnh như yesterday, last week.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'choose',
      prompt: 'Đuôi -ed của từ này đọc thế nào?',
      show: 'wanted',
      options: ['/ɪd/, thêm âm tiết', '/t/', '/d/'],
      answer: 0,
      explain: 'want kết thúc bằng /t/ nên -ed = /ɪd/ và thêm một âm tiết.',
    },
    {
      type: 'choose',
      prompt: 'Đuôi -ed của từ này đọc thế nào?',
      show: 'stopped',
      options: ['/t/', '/d/', '/ɪd/'],
      answer: 0,
      explain: 'p là âm vô thanh nên -ed = /t/: stapt, vẫn một âm tiết.',
    },
    {
      type: 'choose',
      prompt: 'Đuôi -ed của từ này đọc thế nào?',
      show: 'played',
      options: ['/d/', '/t/', '/ɪd/'],
      answer: 0,
      explain: 'play kết thúc bằng nguyên âm (hữu thanh) nên -ed = /d/: pleid.',
    },
    {
      type: 'listen-choose',
      options: ['She walked away.', 'She walks away.', "She'll walk away."],
      answer: 0,
      explain: "walked away: đuôi /t/ nối sang away nên nghe rõ: wok-tə-wei. walks away có /s/: wok-sə-wei. She'll walk away có âm /l/ sau she và walk không có đuôi.",
    },
    {
      type: 'listen-type',
      text: 'He [watches] TV every night.',
      explain: 'watches = WA-chiz: sau âm "ch", -es đọc /ɪz/ và thêm một âm tiết.',
    },
    {
      type: 'listen-choose',
      options: ['She needed help.', 'She needs help.', "She'll need help."],
      answer: 0,
      explain: 'needed thêm âm tiết /ɪd/: NEE-did. needs có /z/; she\'ll need không có đuôi.',
    },
    {
      type: 'choose',
      prompt: 'Từ này có mấy âm tiết?',
      show: 'buses',
      options: ['2', '1', '3'],
      answer: 0,
      explain: 'Sau âm /s/, -es đọc /ɪz/ và thêm một âm tiết: BU-siz.',
    },
    {
      type: 'choose',
      prompt: "Đuôi 's của brother's nghe thế nào?",
      play: "My brother's idea was good.",
      options: ['/z/', '/s/', '/ɪz/'],
      answer: 0,
      explain: "brother kết thúc bằng âm hữu thanh (r) nên 's đọc /z/, và nối sang idea: bruthər-zai-deeə.",
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. Word stress and schwa
// ---------------------------------------------------------------------------

const stress: Lesson = {
  id: 'sp-stress',
  course: 'spelling',
  order: 7,
  title: 'Trọng âm và âm /ə/',
  summary: 'Âm tiết nhấn nghe rõ; âm tiết không nhấn co lại thành /ə/.',
  goal: 'Nghe ra âm tiết được nhấn, và biết nguyên âm nào bị đọc thành /ə/.',
  phenomenon: null,
  minutes: 9,
  sections: [
    {
      title: 'Một từ, một âm tiết mạnh',
      blocks: [
        {
          type: 'rule',
          title: 'Âm tiết không nhấn co lại thành /ə/',
          body: 'Mỗi từ nhiều âm tiết có **một âm tiết nhấn**: to hơn, dài hơn, cao giọng hơn.\n\nNguyên âm ở âm tiết **không nhấn** thường co lại thành **/ə/**, một âm "ơ" rất ngắn và nhẹ, **dù viết là a, e, i, o hay u**.',
        },
        {
          type: 'words',
          title: 'Chữ tô màu là âm tiết nhấn; ə trong cách đọc là âm co lại',
          items: [
            { word: 'banana', sound: 'bə-NA-nə', ipa: '/bəˈnænə/', mark: 'ba[na]na', note: 'Ba chữ a, chỉ một a đọc rõ.' },
            { word: 'about', sound: 'ə-BAUT', ipa: '/əˈbaʊt/', mark: 'a[bout]' },
            { word: 'problem', sound: 'PRAB-ləm', ipa: '/ˈprɑbləm/', mark: '[prob]lem' },
            { word: 'chemical', sound: 'KE-mi-kəl', ipa: '/ˈkɛmɪkəl/', mark: '[chem]ical' },
            { word: 'today', sound: 'tə-DEI', ipa: '/təˈdeɪ/', mark: 'to[day]' },
            { word: 'support', sound: 'sə-PORT', ipa: '/səˈpɔrt/', mark: 'sup[port]' },
            { word: 'family', sound: 'FA-mə-li', ipa: '/ˈfæməli/', mark: '[fam]ily', note: 'Nói nhanh còn hai âm tiết: FAM-li.' },
            { word: 'lemon', sound: 'LE-mən', ipa: '/ˈlɛmən/', mark: '[lem]on' },
          ],
        },
        {
          type: 'tip',
          md: 'Tiếng Việt đọc mỗi tiếng rõ như nhau. Nếu bạn đọc banana đều đều ba chữ "na", người Mỹ khó nhận ra. Khi nghe cũng vậy: bạn chờ ba âm a rõ, nhưng chỉ có **một**.',
        },
      ],
    },
    {
      title: 'Cùng gốc, trọng âm dời chỗ',
      blocks: [
        {
          type: 'text',
          md: 'Thêm đuôi vào một từ, trọng âm có thể **dời chỗ**, và nguyên âm đổi theo: âm tiết vừa được nhấn thì rõ ra, âm tiết vừa mất nhấn thì co lại thành /ə/.',
        },
        {
          type: 'words',
          title: 'Chữ tô màu là âm tiết nhấn',
          items: [
            { word: 'photograph', sound: 'FOH-də-graf', ipa: '/ˈfoʊɾəˌɡræf/', mark: '[pho]tograph' },
            { word: 'photographer', sound: 'fə-TA-grə-fər', ipa: '/fəˈtɑɡrəfɚ/', mark: 'pho[to]grapher', note: 'pho mất nhấn nên chỉ còn "fə".' },
            { word: 'photographic', sound: 'foh-də-GRA-fik', ipa: '/ˌfoʊɾəˈɡræfɪk/', mark: 'photo[graph]ic' },
            { word: 'economy', sound: 'i-KA-nə-mi', ipa: '/ɪˈkɑnəmi/', mark: 'e[con]omy' },
            { word: 'economic', sound: 'e-kə-NA-mik', ipa: '/ˌɛkəˈnɑmɪk/', mark: 'eco[nom]ic' },
            { word: 'nation', sound: 'NEI-shən', ipa: '/ˈneɪʃən/', mark: '[na]tion' },
            {
              word: 'national',
              sound: 'NA-shə-nəl',
              ipa: '/ˈnæʃənəl/',
              mark: '[na]tional',
              note: 'Vẫn nhấn đầu, nhưng a đổi từ "ei" thành a ngắn. Nói nhanh còn NASH-nəl.',
            },
            { word: 'public', sound: 'PUB-lik', ipa: '/ˈpʌblɪk/', mark: '[pub]lic' },
            { word: 'publicity', sound: 'pə-BLI-sə-di', ipa: '/pəˈblɪsəɾi/', mark: 'pub[lic]ity' },
          ],
        },
      ],
    },
    {
      title: 'Đuôi quyết định trọng âm',
      blocks: [
        {
          type: 'rule',
          title: 'Nhấn ngay trước đuôi',
          body: 'Với các đuôi **tion, sion, cian, ic, ical, ity, graphy, logy**, trọng âm rơi vào âm tiết **ngay trước** đuôi:\n\n- inforMAtion, deCIsion, muSIcian\n- ecoNOmic, poLItical, acTIvity\n- phoTOgraphy, biOlogy\n\nCó vài ngoại lệ (politics, television), nhưng phần lớn từ theo luật này. Nghe thấy đuôi tion là bạn biết âm tiết nhấn ở ngay trước nó.',
        },
        {
          type: 'tip',
          md: 'Gặp một từ dài không nhận ra, hãy bắt **âm tiết nhấn** trước: đó là phần rõ nhất. Các âm /ə/ xung quanh chỉ là "khung". Trong từ điển, dấu ˈ đứng trước âm tiết nhấn: /fəˈtɑɡrəfɚ/.\n\nDanh từ và động từ cùng chữ (a REcord, to reCORD): xem bài **Cùng chữ khác âm** của khóa Từ bất quy tắc.\n\nTrong câu, cả những từ nhỏ cũng co thành /ə/: xem bài **Âm yếu** của khóa Nghe nối âm.',
        },
      ],
    },
  ],
  quiz: [
    {
      type: 'listen-choose',
      options: ['national', 'nation', 'nationality'],
      answer: 0,
      explain: 'national = NA-shə-nəl (nói nhanh còn NASH-nəl): nhấn đầu, a ngắn. nation là NEI-shən, a đọc "ei"; nationality dài năm âm tiết.',
    },
    {
      type: 'choose',
      prompt: 'Âm tiết nào trong từ này được nhấn?',
      show: 'banana',
      options: ['ba-NA-na (giữa)', 'BA-na-na (đầu)', 'ba-na-NA (cuối)'],
      answer: 0,
      explain: 'bə-NA-nə: chỉ "na" ở giữa rõ; hai chữ a còn lại co thành /ə/.',
    },
    {
      type: 'choose',
      prompt: 'Âm tiết nào trong information được nhấn?',
      play: 'We need more information.',
      options: ['Âm tiết thứ ba: ma', 'Âm tiết đầu: in', 'Âm tiết thứ hai: for'],
      answer: 0,
      explain: 'Đuôi tion kéo trọng âm về âm tiết ngay trước nó: in-fər-MEI-shən.',
    },
    {
      type: 'choose',
      prompt: 'Âm tiết nào của photographer được nhấn?',
      play: 'He is a famous photographer.',
      options: ['Âm tiết thứ hai: to', 'Âm tiết đầu: pho', 'Âm tiết thứ ba: gra'],
      answer: 0,
      explain: 'fə-TA-grə-fər: nhấn "to". So sánh photograph: FOH-də-graf, nhấn âm đầu.',
    },
    {
      type: 'choose',
      prompt: 'Chữ e trong từ này đọc thế nào?',
      show: 'problem',
      options: ['ə, rất nhẹ', 'e rõ như bed'],
      answer: 0,
      explain: 'e nằm trong âm tiết không nhấn nên co thành /ə/: PRAB-ləm.',
    },
    {
      type: 'choose',
      prompt: 'Âm tiết nào trong từ này được nhấn?',
      show: 'activity',
      options: ['Âm tiết thứ hai: tiv', 'Âm tiết đầu: ac', 'Âm tiết thứ ba: i'],
      answer: 0,
      explain: 'Đuôi ity kéo trọng âm về ngay trước nó: ak-TI-və-di.',
    },
    {
      type: 'choose',
      prompt: 'Âm tiết nào trong từ này được nhấn?',
      show: 'economic',
      options: ['Âm tiết thứ ba: no', 'Âm tiết thứ hai: co', 'Âm tiết đầu: e'],
      answer: 0,
      explain: 'Đuôi ic kéo trọng âm về âm tiết ngay trước: e-kə-NA-mik. So sánh economy: i-KA-nə-mi.',
    },
    {
      type: 'choose',
      prompt: 'Chữ a đầu tiên của about đọc thế nào?',
      show: 'about',
      options: ['ə, rất nhẹ', 'a rõ như cat', 'Không đọc'],
      answer: 0,
      explain: 'a không nhấn nên thành /ə/: ə-BAUT. Âm này rất nhẹ, dễ nghe sót, nhưng vẫn có.',
    },
  ],
};

export const SPELLING_LESSONS: Lesson[] = [magicE, vowelTeams, rVowels, consonantTeams, softHard, endings, stress];
