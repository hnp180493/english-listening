// Table-driven knowledge: multi-word reductions, contractions, weak forms.
//
// ── Respelling convention ────────────────────────────────────────────────────────────────
// Every respelled piece the decoder prints (lexicon.ts, words.ts, this file) spells a vowel
// sound ONE way, chosen so a Vietnamese learner reads it close to the English sound:
//
//   sound   spelling  examples                               note for Vietnamese readers
//   /iː/    ee        eet, pleez, mee-chu, ree-ding           "i" dài
//   /ɪ/     i         iz, giv, mi-shu                         "i" ngắn
//   /eɪ/    ei        kei, tei-kit, mei-dit, wei-də, steishən "ê" trượt sang "i" (NOT "ay": Vietnamese
//                                                             reads "ay" as /ăj/ ≈ English /aɪ/)
//   /ɛ/     e         sed, hed, frend                         "e"
//   /æ/     a         hav, ha-zə  (kæn(t) only for can't)     "a" bẹt
//   /ɑ/     a         nat, gat, nak, prabləm, pramis, əklak   "a" — NEVER "o" in a respelled syllable
//                     (ah before m/zh: kahm, gərahzh)         (the word "on" itself stays as written)
//   /ɔ/     o         tok, thot, kof, folt, gon, rong         "o" (a final open /ɔ/ uses the homophone
//                                                             saw / law, rule 3: "so" reads /oʊ/ — arkənsaw)
//   /oʊ/    oh        goh, hohm, hohl-don, mohs-tə, dohn,     "ô" — ALWAYS "oh", open or closed syllable
//                     ohkei, fohn
//   /ʊ/     u         cud, wud, wumən                          ("oo" only inside a word shown as written: good)
//   /uː/    oo        moov, skool, troo, hooz                 "u" dài
//   /juː/   yoo       myoozik, yooz, kyoot  (yu only before r: pyur, yurəp)
//   /ʌ/     u         luv, dun, sum, muni                     (shares "u" with /ʊ/; the lexicon decides)
//   /ə/     ə         thə, tə, fər, ə-baut                    schwa
//   /ɜr/    er        lern, wer                               ("ər" when unstressed)
//   /ɛr/    eər       heər, keər, cheər, theər, wheər, beər,  "e" + "ơ" + r — never "er", which the table
//                     weər (wear), peər, teər (rip), ə-weər    uses for /ɜr/ (her, lern, wer = were)
//           e-r       before a vowel the r starts the next syllable and the vowel is a plain "e":
//                     KE-rək-tər, veriəs, eriə, merij, the-ri-nə (there in), ke-rə-baut (care about)
//   /ɪr/    eer       heer, neer, yeer, kleer                  (also here, hear)
//   /ɑr/    ar        kar, hart, park                          /ɔr/ or: for, dor, sord   /ʊr/ ur: pur, shur
//   /aɪ/    ai        lai-kit, tai-miz, sai-də, rai-dit       "ai"
//   /aʊ/    au        ge-daut, ə-nauər, dau-nə, praud         "ao"
//   /ɔɪ/    oi        boiz, in-joi                            "oi"
//
// Why "oh" and not "ou" for /oʊ/: "ou" already means /aʊ/ in outta (a reduction we keep) and in
// written words (out, house), and /uː/ in you, soup — it cannot be unambiguous. "oh" is the
// standard dictionary respelling, never a real word except "oh" itself (same sound), and
// Vietnamese learners read it as "ô". Hand-written data should use the same spellings.
//
// Rules that keep the convention honest:
//  1. A word shown AS WRITTEN (day, know, said, go) is English spelling, not a respelling; the
//     table applies as soon as a word is respelled (split, receiving a sound, elided…).
//  2. Written vowel letters are never mixed into a respelling: wait → wei-də (not "wai-də", which
//     reads /aɪ/), hold → hohl-don, proud → prau-də (see conventionVowels in lexicon.ts).
//  3. No respelled syllable may be a real English word read with another vowel. "side" must not
//     print "said": such syllables use the English homophone with the right sound (inside →
//     in-side, mind → mine, I'd → I'd, him I'm → i-mime). See avoidFalseWords in lexicon.ts.
//  4. Well-known reductions keep their usual spelling: wanna, gonna, gotta, outta, kinda, lemme,
//     gimme, dunno, doncha, whatcha… (they are learned as words). Reductions that are not
//     established spellings follow the table: yoosta (used to), spohsta (supposed to).
//  5. Flap-T words keep the written word with t → d (better → bedder, matter → madder) unless their
//     vowel letters would read as another sound of the table (data → deidə, later → leidər) or the
//     result is a real word with another vowel (water → wadder, not "wader"; writing → riding).
//  6. Consonants: /k/ is "k" (keər, nak, kahm) or "c" only before a / o / u (cud, cof), never "c" before
//     e / i / y (care → keər, not "ceər"); /w/ is "w" (white → wait, while → wail), except the where-family
//     (wheər, evriwheər, eniwheər, sumwheər), which keeps "wh" so that a split syllable reads whe-rər /
//     whe-ri-zit, never "we" /wi/. That exception is for decoder output only: a word card is never split and
//     writes where → weər. Reductions keep their own spelling (wheredja, whaddaya).
//  Hand-written data (chunks, lesson notes, pair cues) shown next to decoder output uses the same
//  spellings as the decoder for the same phrase: didja, hafta, ə lotta, whats, heez (he's ≠ his "hiz").
//
// ── Stress, and where it is (not) shown ─────────────────────────────────────────────────
//  WORD CARDS (course `words` rows, story/rule prose, quiz options about one word): a respelling of 2+
//  syllables is split into syllables by hyphens and the STRESSED syllable is written in CAPITALS:
//  KER-nəl, ri-KORD, REK-ərd, mə-SHEEN, fə-TA-grə-fər, KE-rək-tər. A one-syllable respelling has no
//  capitals and no hyphen (nak, theər). Never caps without hyphens ("REkərd"); capitals inside a WRITTEN
//  word (inforMAtion, a REcord) are allowed only in prose about stress, as a mark on the spelling.
//  DECODER OUTPUT (this folder, and chunk.spoken / lesson notes that copy it): connected speech, all
//  lowercase, no stress capitals. A hyphen there joins sounds across words (linking, flap, h-drop…) or marks
//  the syllable break that linking creates (che-ki-daut, the-ri-nə); it does not mark lexical syllables, and
//  whole respelled words stay unhyphenated (wadder, whaddaya). Pair cues (pairs.ts) may capitalise the
//  stressed WORD of a phrase (theər-zə-PROB): that is sentence stress, not a word card. The
//  whole-word respellings of words.ts / lexicon.ts (RESPELL: "keərfəl", "prabləm") carry no hyphens and no
//  capitals: they are pieces the decoder cuts and glues. A word card turns one into its own style by adding
//  syllable hyphens and the stress capitals, with the same letters: prabləm → PRAB-ləm, daktər → DAK-tər.
//  Only Latin letters are capitalised; "ə" always stays lowercase (Ə is unknown to learners), so a stressed
//  /ɛr/ syllable is written KEəR (careful → KEəR-fəl, airport → EəR-port); before a vowel it is plain
//  e-r as above (parent → PE-rənt, character → KE-rək-tər).

export interface ReductionEntry {
  words: string[];
  spoken: string;
  ipa: string;
  rule: string;
  /** Only when followed (same phrase) by a verb — blocks "going to school". */
  needsVerbAfter?: boolean;
  /** Not before a vowel sound in the same phrase: "out of it" keeps /v/ (au-də-vit), no "outta". */
  notBeforeVowel?: boolean;
}

export const REDUCTIONS: ReductionEntry[] = [
  { words: ['i', 'am', 'going', 'to'], spoken: "I'm gonna", ipa: '/aɪm ˈɡʌnə/', needsVerbAfter: true,
    rule: "'I am going to' khi nói nhanh gộp thành 'I'm gonna': 'I am' rút thành 'I'm', 'going to' thành 'gonna'." },
  { words: ['what', 'did', 'you'], spoken: 'whaddidja', ipa: '/ˈwʌɾɪdʒə/',
    rule: "'What did you' nói nhanh thành 'whaddidja': /t/ của 'what' bật thành /d/, 'd you' hòa thành /dʒə/." },
  { words: ['what', 'are', 'you'], spoken: 'whatcha', ipa: '/ˈwʌtʃə/',
    rule: "'What are you' nói nhanh thành 'whatcha' (hoặc 'whaddaya'): 'are' gần như biến mất, /t/ + /j/ thành /tʃ/." },
  { words: ['what', 'do', 'you'], spoken: 'whaddaya', ipa: '/ˈwʌɾəjə/',
    rule: "'What do you' nói nhanh thành 'whaddaya': /t/ bật thành /d/, 'do you' rút còn 'də-yə'." },
  { words: ['how', 'did', 'you'], spoken: 'howdja', ipa: '/ˈhaʊdʒə/',
    rule: "'How did you' nói nhanh thành 'howdja': 'did' chỉ còn /d/, 'd + you' hòa thành /dʒə/." },
  { words: ['where', 'did', 'you'], spoken: 'wheredja', ipa: '/ˈwɛrdʒə/',
    rule: "'Where did you' nói nhanh thành 'wheredja': 'did' chỉ còn /d/, 'd + you' hòa thành /dʒə/." },
  { words: ['a', 'lot', 'of'], spoken: 'ə lotta', ipa: '/ə ˈlɑɾə/', notBeforeVowel: true,
    rule: "'A lot of' nói nhanh thành 'ə lotta': /t/ bật nhẹ thành /d/ và 'of' chỉ còn /ə/." },
  { words: ['going', 'to'], spoken: 'gonna', ipa: '/ˈɡʌnə/', needsVerbAfter: true,
    rule: "'Going to' + động từ (dự định tương lai) nói nhanh thành 'gonna'. Nếu sau 'to' là nơi chốn (going to school) thì KHÔNG rút." },
  { words: ['want', 'to'], spoken: 'wanna', ipa: '/ˈwɑnə/',
    rule: "'Want to' nói nhanh thành 'wanna': /t/ của 'want' và 'to' gần như mất, chỉ còn 'wan-nə'." },
  { words: ['wants', 'to'], spoken: 'wantsta', ipa: '/ˈwɑntstə/',
    rule: "'Wants to' nói nhanh thành 'wantsta' (không thành 'wanna'): 'to' chỉ còn /tə/ dính vào 'wants'." },
  { words: ['got', 'to'], spoken: 'gotta', ipa: '/ˈɡɑɾə/', needsVerbAfter: true,
    rule: "'(Have) got to' + động từ (phải làm gì) nói nhanh thành 'gotta', /t/ bật nhẹ như /d/." },
  { words: ['have', 'to'], spoken: 'hafta', ipa: '/ˈhæftə/',
    rule: "'Have to' (phải) đọc thành 'hafta': /v/ bị /t/ phía sau làm vô thanh thành /f/." },
  { words: ['has', 'to'], spoken: 'hasta', ipa: '/ˈhæstə/',
    rule: "'Has to' đọc thành 'hasta': /z/ thành /s/ trước /t/, 'to' chỉ còn /tə/." },
  { words: ['ought', 'to'], spoken: 'oughta', ipa: '/ˈɔɾə/',
    rule: "'Ought to' nói nhanh thành 'oughta', hai âm /t/ gộp lại và bật nhẹ." },
  // /juː/ is "yoo" and /oʊ/ is "oh" here too: "useta" / "sposta" would read u, o
  { words: ['used', 'to'], spoken: 'yoosta', ipa: '/ˈjustə/',
    rule: "'Used to' đọc là 'yoosta' /ˈjustə/: /d/ mất hẳn, /z/ thành /s/." },
  { words: ['supposed', 'to'], spoken: 'spohsta', ipa: '/ˈspoʊstə/',
    rule: "'Supposed to' nói nhanh thành 'spohsta': âm đầu 'su' gần như mất, /d/ cũng mất." },
  { words: ['kind', 'of'], spoken: 'kinda', ipa: '/ˈkaɪndə/', notBeforeVowel: true,
    rule: "'Kind of' nói nhanh thành 'kinda': 'of' chỉ còn /ə/ dính vào 'kind'." },
  { words: ['sort', 'of'], spoken: 'sorta', ipa: '/ˈsɔrɾə/', notBeforeVowel: true,
    rule: "'Sort of' nói nhanh thành 'sorta': 'of' chỉ còn /ə/, /t/ bật nhẹ." },
  { words: ['lots', 'of'], spoken: 'lotsa', ipa: '/ˈlɑtsə/', notBeforeVowel: true,
    rule: "'Lots of' nói nhanh thành 'lotsa': 'of' chỉ còn /ə/." },
  { words: ['out', 'of'], spoken: 'outta', ipa: '/ˈaʊɾə/', notBeforeVowel: true,
    rule: "'Out of' nói nhanh thành 'outta': /t/ bật nhẹ và 'of' chỉ còn /ə/." },
  { words: ['let', 'me'], spoken: 'lemme', ipa: '/ˈlɛmi/',
    rule: "'Let me' nói nhanh thành 'lemme': /t/ biến mất, hai từ dính làm một." },
  { words: ['give', 'me'], spoken: 'gimme', ipa: '/ˈɡɪmi/',
    rule: "'Give me' nói nhanh thành 'gimme': /v/ biến mất trước /m/." },
  { words: ["don't", 'know'], spoken: 'dunno', ipa: '/dəˈnoʊ/',
    rule: "'Don't know' nói nhanh thành 'dunno': /t/ mất và 'don't' rút còn 'də'." },
  { words: ["don't", 'you'], spoken: 'doncha', ipa: '/ˈdoʊntʃə/',
    rule: "'Don't you' nói nhanh thành 'doncha': /t/ + /j/ hòa thành /tʃ/." },
  { words: ['did', 'you'], spoken: 'didja', ipa: '/ˈdɪdʒə/',
    rule: "'Did you' nói nhanh thành 'didja': /d/ + /j/ hòa thành /dʒ/, 'you' chỉ còn /ə/." },
  { words: ['would', 'you'], spoken: 'wudja', ipa: '/ˈwʊdʒə/',
    rule: "'Would you' nói nhanh thành 'wudja': /d/ + /j/ hòa thành /dʒ/." },
  { words: ['could', 'you'], spoken: 'cudja', ipa: '/ˈkʊdʒə/',
    rule: "'Could you' nói nhanh thành 'cudja': /d/ + /j/ hòa thành /dʒ/." },
  { words: ['got', 'you'], spoken: 'gotcha', ipa: '/ˈɡɑtʃə/',
    rule: "'Got you' nói nhanh thành 'gotcha': /t/ + /j/ hòa thành /tʃ/." },
  { words: ['bet', 'you'], spoken: 'betcha', ipa: '/ˈbɛtʃə/',
    rule: "'Bet you' nói nhanh thành 'betcha': /t/ + /j/ hòa thành /tʃ/." },
  { words: ['because'], spoken: 'cuz', ipa: '/kəz/',
    rule: "'Because' trong hội thoại nhanh thường chỉ còn 'cuz' /kəz/, âm đầu 'be' gần như mất." },
  { words: ["'cause"], spoken: 'cuz', ipa: '/kəz/',
    rule: "''Cause' là cách viết của 'because' khi nói nhanh, đọc là 'cuz' /kəz/." },
];

/** Words after "going to / got to" that show it is NOT followed by a verb. */
export const NON_VERB_AFTER_TO = new Set([
  'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'its', 'this', 'that', 'these', 'those', 'some', 'any',
  'every', 'each', 'school', 'work', 'bed', 'church', 'class', 'college', 'university', 'hospital', 'jail', 'prison',
  'town', 'home', 'market', 'store', 'shop', 'office', 'party', 'beach', 'park', 'gym', 'hotel', 'airport', 'station',
  'bank', 'library', 'cinema', 'movies', 'concert', 'lunch', 'dinner', 'breakfast', 'it', 'him', 'them', 'me', 'us',
  'you', 'there', 'here', 'mass', 'court', 'sea', 'war', 'heaven', 'hell', 'one', 'two', 'three', 'many', 'all', 'both',
]);

export interface ContractionEntry {
  spoken: string;
  ipa?: string;
  rule: string;
}

export const CONTRACTIONS: Record<string, ContractionEntry> = {
  "i'll": { spoken: 'al', ipa: '/aɪl/ ~ /ɑl/', rule: "'I'll' (= I will) nói nhanh chỉ còn 'al', rất dễ nghe sót chữ 'will'." },
  "you'll": { spoken: 'yəl', ipa: '/jəl/', rule: "'You'll' (= you will) nói nhanh thành 'yəl', phần 'will' chỉ còn âm /l/." },
  "we'll": { spoken: 'wil', ipa: '/wɪl/', rule: "'We'll' (= we will) nghe như 'wil', dễ nhầm với 'will'." },
  "he'll": { spoken: 'hil', ipa: '/hɪl/', rule: "'He'll' (= he will) nghe như 'hil', dễ nhầm với 'hill'." },
  "she'll": { spoken: 'shil', ipa: '/ʃɪl/', rule: "'She'll' (= she will) nghe như 'shil'." },
  "they'll": { spoken: 'thel', ipa: '/ðɛl/', rule: "'They'll' (= they will) nghe như 'thel', 'will' chỉ còn /l/." },
  "it'll": { spoken: 'i-dəl', ipa: '/ˈɪɾəl/', rule: "'It'll' (= it will) đọc là 'i-dəl': /t/ bật nhẹ như /d/ trước âm /əl/." },
  "that'll": { spoken: 'tha-dəl', ipa: '/ˈðæɾəl/', rule: "'That'll' (= that will) đọc là 'tha-dəl', /t/ bật nhẹ như /d/." },
  "they're": { spoken: 'thər', ipa: '/ðər/', rule: "'They're' (= they are) đọc yếu là 'thər', nghe giống hệt 'their' và 'there'." },
  "you're": { spoken: 'yər', ipa: '/jər/', rule: "'You're' (= you are) đọc yếu là 'yər', nghe giống 'your'." },
  "we're": { spoken: 'wir', ipa: '/wɪr/', rule: "'We're' (= we are) đọc là 'wir', ngắn hơn nhiều so với 'we are'." },
  "i'd": { spoken: "I'd", ipa: '/aɪd/', rule: "'I'd' có thể là 'I would' hoặc 'I had'; nhìn động từ phía sau để đoán (I'd like = would, I'd been = had)." },
  "you'd": { spoken: 'yood', ipa: '/jud/', rule: "'You'd' = 'you would' hoặc 'you had'; âm /d/ cuối rất nhẹ, dễ nghe sót." },
  "he'd": { spoken: 'heed', ipa: '/hid/', rule: "'He'd' = 'he would' hoặc 'he had'; âm /d/ rất nhẹ — dựa vào động từ sau để phân biệt." },
  "she'd": { spoken: 'sheed', ipa: '/ʃid/', rule: "'She'd' = 'she would' hoặc 'she had'; âm /d/ rất nhẹ." },
  "we'd": { spoken: 'weed', ipa: '/wid/', rule: "'We'd' = 'we would' hoặc 'we had'; âm /d/ rất nhẹ." },
  "they'd": { spoken: 'theid', ipa: '/ðeɪd/', rule: "'They'd' = 'they would' hoặc 'they had'; âm /d/ rất nhẹ." },
  "it's": { spoken: 'its', ipa: '/ɪts/', rule: "'It's' = 'it is' hoặc 'it has' (it's been); chỉ còn âm /s/ rất nhỏ sau 'it'." },
  "that's": { spoken: 'thats', ipa: '/ðæts/', rule: "'That's' = 'that is'; 'is' chỉ còn âm /s/ dính vào 'that'." },
  // like "that's" → thats: the written word, so "what" reads the same as in wha-dai, wha-chu
  "what's": { spoken: 'whats', ipa: '/wʌts/', rule: "'What's' = 'what is' hoặc 'what has'; 'is' chỉ còn /s/." },
  "there's": { spoken: 'theərz', ipa: '/ðɛrz/', rule: "'There's' = 'there is' (hoặc 'there has'); 'is' chỉ còn /z/." },
  "he's": { spoken: 'heez', ipa: '/hiz/', rule: "'He's' = 'he is' hoặc 'he has' (he's got); chỉ còn âm /z/." },
  "she's": { spoken: 'sheez', ipa: '/ʃiz/', rule: "'She's' = 'she is' hoặc 'she has'; chỉ còn âm /z/." },
  "who's": { spoken: 'hooz', ipa: '/huz/', rule: "'Who's' = 'who is' hoặc 'who has'; nghe giống hệt 'whose'." },
  "can't": { spoken: 'kæn(t)', ipa: '/kæn(t)/', rule: "'Can't' đọc mạnh với nguyên âm mở /æ/, /t/ cuối thường bị nuốt. Phân biệt với 'can' đọc yếu /kən/: nghe nguyên âm, đừng chờ âm /t/." },
  "won't": { spoken: 'wohnt', ipa: '/woʊnt/', rule: "'Won't' (= will not) đọc /woʊnt/ ('wohnt', nguyên âm 'ô'), khác 'want' /wɑnt/ ('want', nguyên âm 'a')." },
  "i've": { spoken: 'aiv', ipa: '/aɪv/', rule: "'I've' (= I have): âm /v/ rất nhẹ, 'I've got' dễ nghe thành 'I got'." },
  "you've": { spoken: 'yoov', ipa: '/juv/', rule: "'You've' (= you have): âm /v/ rất nhẹ, dễ nghe sót." },
  "we've": { spoken: 'weev', ipa: '/wiv/', rule: "'We've' (= we have): âm /v/ rất nhẹ, dễ nghe sót." },
  "they've": { spoken: 'theiv', ipa: '/ðeɪv/', rule: "'They've' (= they have): âm /v/ rất nhẹ, dễ nghe sót." },
  "could've": { spoken: 'coulda', ipa: '/ˈkʊɾə/', rule: "'Could've' (= could have) nói nhanh thành 'coulda'. Đừng viết thành 'could of'." },
  "should've": { spoken: 'shoulda', ipa: '/ˈʃʊɾə/', rule: "'Should've' (= should have) nói nhanh thành 'shoulda'." },
  "would've": { spoken: 'woulda', ipa: '/ˈwʊɾə/', rule: "'Would've' (= would have) nói nhanh thành 'woulda'." },
  "must've": { spoken: 'musta', ipa: '/ˈmʌstə/', rule: "'Must've' (= must have) nói nhanh thành 'musta'." },
};

export interface WeakInfo {
  spoken: string;
  ipa: string;
  rule: string;
}

export function weakRule(word: string, spoken: string, ipa: string, extra = ''): string {
  return `'${word}' là từ chức năng không nhấn nên đọc yếu thành ${ipa} ('${spoken}')${extra ? ', ' + extra : ''}.`;
}

/** h-words after which weak "of" keeps its /v/ because the /h/ drops: all of his → ə-viz. */
export const H_OF = new Set(['his', 'him', 'her', 'he']);

export const SUBJECT_PRONOUNS = new Set(['you', 'we', 'they', 'i', 'he', 'she']);
export const MODALS = new Set(['could', 'would', 'should', 'must', 'might', 'may', 'will', 'can', "can't", "couldn't",
  "wouldn't", "shouldn't", "won't", "mustn't", "i'll", "you'll", "we'll", "they'll", "he'll", "she'll"]);
export const PARTICIPLE_LIKE = new Set(['been', 'done', 'gone', 'seen', 'made', 'got', 'gotten', 'had', 'told', 'said',
  'heard', 'known', 'taken', 'given', 'eaten', 'written', 'left', 'lost', 'found', 'bought', 'brought', 'thought', 'kept',
  'met', 'sent', 'spent', 'won', 'put', 'read', 'run', 'come', 'become', 'begun', 'broken', 'chosen', 'driven', 'fallen',
  'forgotten', 'spoken', 'stolen', 'worn', 'woken', 'shown', 'grown', 'flown', 'drawn', 'thrown', 'sung', 'swum', 'felt',
  'meant', 'paid', 'sold', 'slept', 'stood', 'understood', 'taught', 'caught', 'fought', 'built', 'lent', 'set', 'cut',
  'hit', 'hurt', 'cost', 'quit', 'shut', 'never', 'already', 'just', 'ever', 'always', 'not', 'also', 'really', 'finally',
  'recently', 'still', 'probably', 'definitely', 'missed', 'forgot']);

export function looksLikeParticiple(w: string | undefined): boolean {
  if (!w) return false;
  if (PARTICIPLE_LIKE.has(w)) return true;
  if (/eed$/.test(w)) return false;
  return w.length > 3 && /(ed|en)$/.test(w);
}

/** Yod-coalescence targets and the tail left after the /j/ merges ("you" → "u" → "chu"). */
export const YOD_TAIL: Record<string, string> = {
  you: 'u', your: 'ur', "you're": 'ur', "you'll": 'ul', "you've": 'uv', "you'd": 'ud', yourself: 'urself',
  yourselves: 'urselves', yet: 'et', year: 'eer', years: 'eers',
};

/** h-words that lose /h/ when unstressed, with their h-less respelling. */
export const H_FORMS: Record<string, { spoken: string; ipa: string }> = {
  he: { spoken: 'ee', ipa: '/i/' },
  him: { spoken: 'im', ipa: '/ɪm/' },
  his: { spoken: 'iz', ipa: '/ɪz/' },
  her: { spoken: 'ər', ipa: '/ər/' },
  have: { spoken: 'əv', ipa: '/əv/' },
  has: { spoken: 'əz', ipa: '/əz/' },
  had: { spoken: 'əd', ipa: '/əd/' },
};
