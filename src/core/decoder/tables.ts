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
  /**
   * What a TTS engine is given to make it SAY the reduction (DecodeResult.speakText, see speak.ts): eye-dialect
   * spelling, ASCII letters / apostrophes / spaces only. `null` = keep the written words (the engine already
   * says them reduced, or no spelling is read reliably).
   */
  speak: string | null;
  ipa: string;
  rule: string;
  /** Only when followed (same phrase) by a verb — blocks "going to school". */
  needsVerbAfter?: boolean;
  /** Not before a vowel sound in the same phrase: "out of it" keeps /v/ (au-də-vit), no "outta". */
  notBeforeVowel?: boolean;
}

export const REDUCTIONS: ReductionEntry[] = [
  { words: ['i', 'am', 'going', 'to'], spoken: "I'm gonna", speak: "I'm gonna", ipa: '/aɪm ˈɡʌnə/', needsVerbAfter: true,
    rule: "'I am going to' khi nói nhanh gộp thành 'I'm gonna': 'I am' rút thành 'I'm', 'going to' thành 'gonna'." },
  { words: ['what', 'did', 'you'], spoken: 'whaddidja', speak: 'whaddija', ipa: '/ˈwʌɾɪdʒə/',
    rule: "'What did you' nói nhanh thành 'whaddidja': /t/ của 'what' bật thành /d/, 'd you' hòa thành /dʒə/." },
  { words: ['what', 'are', 'you'], spoken: 'whatcha', speak: 'whatcha', ipa: '/ˈwʌtʃə/',
    rule: "'What are you' nói nhanh thành 'whatcha' (hoặc 'whaddaya'): 'are' gần như biến mất, /t/ + /j/ thành /tʃ/." },
  { words: ['what', 'do', 'you'], spoken: 'whaddaya', speak: 'whaddaya', ipa: '/ˈwʌɾəjə/',
    rule: "'What do you' nói nhanh thành 'whaddaya': /t/ bật thành /d/, 'do you' rút còn 'də-yə'." },
  { words: ['how', 'did', 'you'], spoken: 'howdja', speak: 'howdja', ipa: '/ˈhaʊdʒə/',
    rule: "'How did you' nói nhanh thành 'howdja': 'did' chỉ còn /d/, 'd + you' hòa thành /dʒə/." },
  { words: ['where', 'did', 'you'], spoken: 'wheredja', speak: 'wheredja', ipa: '/ˈwɛrdʒə/',
    rule: "'Where did you' nói nhanh thành 'wheredja': 'did' chỉ còn /d/, 'd + you' hòa thành /dʒə/." },
  { words: ['a', 'lot', 'of'], spoken: 'ə lotta', speak: 'a lotta', ipa: '/ə ˈlɑɾə/', notBeforeVowel: true,
    rule: "'A lot of' nói nhanh thành 'ə lotta': /t/ bật nhẹ thành /d/ và 'of' chỉ còn /ə/." },
  { words: ['going', 'to'], spoken: 'gonna', speak: 'gonna', ipa: '/ˈɡʌnə/', needsVerbAfter: true,
    rule: "'Going to' + động từ (dự định tương lai) nói nhanh thành 'gonna'. Nếu sau 'to' là nơi chốn (going to school) thì KHÔNG rút." },
  { words: ['want', 'to'], spoken: 'wanna', speak: 'wanna', ipa: '/ˈwɑnə/',
    rule: "'Want to' nói nhanh thành 'wanna': /t/ của 'want' và 'to' gần như mất, chỉ còn 'wan-nə'." },
  { words: ['wants', 'to'], spoken: 'wantsta', speak: null, ipa: '/ˈwɑntstə/',
    rule: "'Wants to' nói nhanh thành 'wantsta' (không thành 'wanna'): 'to' chỉ còn /tə/ dính vào 'wants'." },
  { words: ['got', 'to'], spoken: 'gotta', speak: 'gotta', ipa: '/ˈɡɑɾə/', needsVerbAfter: true,
    rule: "'(Have) got to' + động từ (phải làm gì) nói nhanh thành 'gotta', /t/ bật nhẹ như /d/." },
  { words: ['have', 'to'], spoken: 'hafta', speak: 'hafta', ipa: '/ˈhæftə/',
    rule: "'Have to' (phải) đọc thành 'hafta': /v/ bị /t/ phía sau làm vô thanh thành /f/." },
  { words: ['has', 'to'], spoken: 'hasta', speak: null, ipa: '/ˈhæstə/',
    rule: "'Has to' đọc thành 'hasta': /z/ thành /s/ trước /t/, 'to' chỉ còn /tə/." },
  { words: ['ought', 'to'], spoken: 'oughta', speak: 'oughta', ipa: '/ˈɔɾə/',
    rule: "'Ought to' nói nhanh thành 'oughta', hai âm /t/ gộp lại và bật nhẹ." },
  // /juː/ is "yoo" and /oʊ/ is "oh" here too: "useta" / "sposta" would read u, o
  { words: ['used', 'to'], spoken: 'yoosta', speak: null, ipa: '/ˈjustə/',
    rule: "'Used to' đọc là 'yoosta' /ˈjustə/: /d/ mất hẳn, /z/ thành /s/." },
  // speak "sposta": SAPI reads the written words in full (s ax p ow z d t uh), "sposta" as s p ow s t ax (measured)
  { words: ['supposed', 'to'], spoken: 'spohsta', speak: 'sposta', ipa: '/ˈspoʊstə/',
    rule: "'Supposed to' nói nhanh thành 'spohsta': âm đầu 'su' gần như mất, /d/ cũng mất." },
  { words: ['kind', 'of'], spoken: 'kinda', speak: 'kinda', ipa: '/ˈkaɪndə/', notBeforeVowel: true,
    rule: "'Kind of' nói nhanh thành 'kinda': 'of' chỉ còn /ə/ dính vào 'kind'." },
  { words: ['sort', 'of'], spoken: 'sorta', speak: 'sorta', ipa: '/ˈsɔrɾə/', notBeforeVowel: true,
    rule: "'Sort of' nói nhanh thành 'sorta': 'of' chỉ còn /ə/, /t/ bật nhẹ." },
  { words: ['lots', 'of'], spoken: 'lotsa', speak: 'lotsa', ipa: '/ˈlɑtsə/', notBeforeVowel: true,
    rule: "'Lots of' nói nhanh thành 'lotsa': 'of' chỉ còn /ə/." },
  { words: ['out', 'of'], spoken: 'outta', speak: 'outta', ipa: '/ˈaʊɾə/', notBeforeVowel: true,
    rule: "'Out of' nói nhanh thành 'outta': /t/ bật nhẹ và 'of' chỉ còn /ə/." },
  { words: ['let', 'me'], spoken: 'lemme', speak: 'lemme', ipa: '/ˈlɛmi/',
    rule: "'Let me' nói nhanh thành 'lemme': /t/ biến mất, hai từ dính làm một." },
  { words: ['give', 'me'], spoken: 'gimme', speak: 'gimme', ipa: '/ˈɡɪmi/',
    rule: "'Give me' nói nhanh thành 'gimme': /v/ biến mất trước /m/." },
  { words: ["don't", 'know'], spoken: 'dunno', speak: 'dunno', ipa: '/dəˈnoʊ/',
    rule: "'Don't know' nói nhanh thành 'dunno': /t/ mất và 'don't' rút còn 'də'." },
  { words: ["don't", 'you'], spoken: 'doncha', speak: 'doncha', ipa: '/ˈdoʊntʃə/',
    rule: "'Don't you' nói nhanh thành 'doncha': /t/ + /j/ hòa thành /tʃ/." },
  { words: ['did', 'you'], spoken: 'didja', speak: 'didja', ipa: '/ˈdɪdʒə/',
    rule: "'Did you' nói nhanh thành 'didja': /d/ + /j/ hòa thành /dʒ/, 'you' chỉ còn /ə/." },
  { words: ['would', 'you'], spoken: 'wudja', speak: 'would juh', ipa: '/ˈwʊdʒə/',
    rule: "'Would you' nói nhanh thành 'wudja': /d/ + /j/ hòa thành /dʒ/." },
  { words: ['could', 'you'], spoken: 'cudja', speak: 'could juh', ipa: '/ˈkʊdʒə/',
    rule: "'Could you' nói nhanh thành 'cudja': /d/ + /j/ hòa thành /dʒ/." },
  { words: ['got', 'you'], spoken: 'gotcha', speak: 'gotcha', ipa: '/ˈɡɑtʃə/',
    rule: "'Got you' nói nhanh thành 'gotcha': /t/ + /j/ hòa thành /tʃ/." },
  { words: ['bet', 'you'], spoken: 'betcha', speak: 'betcha', ipa: '/ˈbɛtʃə/',
    rule: "'Bet you' nói nhanh thành 'betcha': /t/ + /j/ hòa thành /tʃ/." },
  { words: ['because'], spoken: 'cuz', speak: 'cuz', ipa: '/kəz/',
    rule: "'Because' trong hội thoại nhanh thường chỉ còn 'cuz' /kəz/, âm đầu 'be' gần như mất." },
  { words: ["'cause"], spoken: 'cuz', speak: 'cuz', ipa: '/kəz/',
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
  /** TTS text (see ReductionEntry.speak). `null` = the written contraction, which engines already say short. */
  speak: string | null;
  ipa?: string;
  rule: string;
}

export const CONTRACTIONS: Record<string, ContractionEntry> = {
  "i'll": { speak: null, spoken: 'al', ipa: '/aɪl/ ~ /ɑl/', rule: "'I'll' (= I will) nói nhanh chỉ còn 'al', rất dễ nghe sót chữ 'will'." },
  "you'll": { speak: null, spoken: 'yəl', ipa: '/jəl/', rule: "'You'll' (= you will) nói nhanh thành 'yəl', phần 'will' chỉ còn âm /l/." },
  "we'll": { speak: null, spoken: 'wil', ipa: '/wɪl/', rule: "'We'll' (= we will) nghe như 'wil', dễ nhầm với 'will'." },
  "he'll": { speak: null, spoken: 'hil', ipa: '/hɪl/', rule: "'He'll' (= he will) nghe như 'hil', dễ nhầm với 'hill'." },
  "she'll": { speak: null, spoken: 'shil', ipa: '/ʃɪl/', rule: "'She'll' (= she will) nghe như 'shil'." },
  "they'll": { speak: null, spoken: 'thel', ipa: '/ðɛl/', rule: "'They'll' (= they will) nghe như 'thel', 'will' chỉ còn /l/." },
  "it'll": { speak: null, spoken: 'i-dəl', ipa: '/ˈɪɾəl/', rule: "'It'll' (= it will) đọc là 'i-dəl': /t/ bật nhẹ như /d/ trước âm /əl/." },
  "that'll": { speak: null, spoken: 'tha-dəl', ipa: '/ˈðæɾəl/', rule: "'That'll' (= that will) đọc là 'tha-dəl', /t/ bật nhẹ như /d/." },
  "they're": { speak: null, spoken: 'thər', ipa: '/ðər/', rule: "'They're' (= they are) đọc yếu là 'thər', nghe giống hệt 'their' và 'there'." },
  "you're": { speak: null, spoken: 'yər', ipa: '/jər/', rule: "'You're' (= you are) đọc yếu là 'yər', nghe giống 'your'." },
  "we're": { speak: null, spoken: 'wir', ipa: '/wɪr/', rule: "'We're' (= we are) đọc là 'wir', ngắn hơn nhiều so với 'we are'." },
  "i'd": { speak: null, spoken: "I'd", ipa: '/aɪd/', rule: "'I'd' có thể là 'I would' hoặc 'I had'; nhìn động từ phía sau để đoán (I'd like = would, I'd been = had)." },
  "you'd": { speak: null, spoken: 'yood', ipa: '/jud/', rule: "'You'd' = 'you would' hoặc 'you had'; âm /d/ cuối rất nhẹ, dễ nghe sót." },
  "he'd": { speak: null, spoken: 'heed', ipa: '/hid/', rule: "'He'd' = 'he would' hoặc 'he had'; âm /d/ rất nhẹ — dựa vào động từ sau để phân biệt." },
  "she'd": { speak: null, spoken: 'sheed', ipa: '/ʃid/', rule: "'She'd' = 'she would' hoặc 'she had'; âm /d/ rất nhẹ." },
  "we'd": { speak: null, spoken: 'weed', ipa: '/wid/', rule: "'We'd' = 'we would' hoặc 'we had'; âm /d/ rất nhẹ." },
  "they'd": { speak: null, spoken: 'theid', ipa: '/ðeɪd/', rule: "'They'd' = 'they would' hoặc 'they had'; âm /d/ rất nhẹ." },
  "it's": { speak: null, spoken: 'its', ipa: '/ɪts/', rule: "'It's' = 'it is' hoặc 'it has' (it's been); chỉ còn âm /s/ rất nhỏ sau 'it'." },
  "that's": { speak: null, spoken: 'thats', ipa: '/ðæts/', rule: "'That's' = 'that is'; 'is' chỉ còn âm /s/ dính vào 'that'." },
  // like "that's" → thats: the written word, so "what" reads the same as in wha-dai, wha-chu
  "what's": { speak: null, spoken: 'whats', ipa: '/wʌts/', rule: "'What's' = 'what is' hoặc 'what has'; 'is' chỉ còn /s/." },
  "there's": { speak: null, spoken: 'theərz', ipa: '/ðɛrz/', rule: "'There's' = 'there is' (hoặc 'there has'); 'is' chỉ còn /z/." },
  "he's": { speak: null, spoken: 'heez', ipa: '/hiz/', rule: "'He's' = 'he is' hoặc 'he has' (he's got); chỉ còn âm /z/." },
  "she's": { speak: null, spoken: 'sheez', ipa: '/ʃiz/', rule: "'She's' = 'she is' hoặc 'she has'; chỉ còn âm /z/." },
  "who's": { speak: null, spoken: 'hooz', ipa: '/huz/', rule: "'Who's' = 'who is' hoặc 'who has'; nghe giống hệt 'whose'." },
  "can't": { speak: null, spoken: 'kæn(t)', ipa: '/kæn(t)/', rule: "'Can't' đọc mạnh với nguyên âm mở /æ/, /t/ cuối thường bị nuốt. Phân biệt với 'can' đọc yếu /kən/: nghe nguyên âm, đừng chờ âm /t/." },
  "won't": { speak: null, spoken: 'wohnt', ipa: '/woʊnt/', rule: "'Won't' (= will not) đọc /woʊnt/ ('wohnt', nguyên âm 'ô'), khác 'want' /wɑnt/ ('want', nguyên âm 'a')." },
  "i've": { speak: null, spoken: 'aiv', ipa: '/aɪv/', rule: "'I've' (= I have): âm /v/ rất nhẹ, 'I've got' dễ nghe thành 'I got'." },
  "you've": { speak: null, spoken: 'yoov', ipa: '/juv/', rule: "'You've' (= you have): âm /v/ rất nhẹ, dễ nghe sót." },
  "we've": { speak: null, spoken: 'weev', ipa: '/wiv/', rule: "'We've' (= we have): âm /v/ rất nhẹ, dễ nghe sót." },
  "they've": { speak: null, spoken: 'theiv', ipa: '/ðeɪv/', rule: "'They've' (= they have): âm /v/ rất nhẹ, dễ nghe sót." },
  "could've": { speak: 'coulda', spoken: 'coulda', ipa: '/ˈkʊɾə/', rule: "'Could've' (= could have) nói nhanh thành 'coulda'. Đừng viết thành 'could of'." },
  "should've": { speak: 'shoulda', spoken: 'shoulda', ipa: '/ˈʃʊɾə/', rule: "'Should've' (= should have) nói nhanh thành 'shoulda'." },
  "would've": { speak: 'woulda', spoken: 'woulda', ipa: '/ˈwʊɾə/', rule: "'Would've' (= would have) nói nhanh thành 'woulda'." },
  "must've": { speak: 'musta', spoken: 'musta', ipa: '/ˈmʌstə/', rule: "'Must've' (= must have) nói nhanh thành 'musta'." },
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

/**
 * h-words that lose /h/ when unstressed, with their h-less respelling.
 * `speak` (TTS text, see speak.ts): 'im' / 'er' are glued to the previous word when it is safe (tell him → tellim,
 * tell her → teller, see canGlueH in speak.ts), otherwise the written word stays. A lone "'er" / "'im" is never
 * sent: SAPI reads "'er" as the letters E-R and "'im" as "I'm" (measured). "'is" stays a separate word (take 'is
 * advice: read as "is", exactly /ɪz/). `null` = keep the written word ("'e" would be read as a letter; have: see
 * HAVE_SPEAK).
 */
export const H_FORMS: Record<string, { spoken: string; ipa: string; speak: string | null; glue?: boolean }> = {
  he: { spoken: 'ee', ipa: '/i/', speak: null },
  him: { spoken: 'im', ipa: '/ɪm/', speak: 'im', glue: true },
  his: { spoken: 'iz', ipa: '/ɪz/', speak: "'is" }, // read as "is": exactly the h-less /ɪz/
  her: { spoken: 'ər', ipa: '/ər/', speak: 'er', glue: true }, // teller, asker (SAPI: t eh l ax r)
  have: { spoken: 'əv', ipa: '/əv/', speak: null },
  has: { spoken: 'əz', ipa: '/əz/', speak: null },
  had: { spoken: 'əd', ipa: '/əd/', speak: null },
};

// ── Speakable forms (TTS text) ───────────────────────────────────────────────────────────
// The respellings above are for the learner's EYES (ə, hyphens). A speech engine cannot read them, and given the
// standard sentence it reads like a newsreader. DecodeResult.speakText (built in speak.ts) is the sentence in
// conservative eye dialect that engines DO read as intended (measured: SAPI says "Whaddaya wanna do?" 2/2 reduced,
// "What do you want to do?" 1/2). Every form: ASCII letters, apostrophes and spaces only. Absent / null = keep the
// written word. Add a form only when an engine reads it as meant; when unsure keep the written word.

/**
 * Weak forms the engine is given (only when the decoder marks the word weak). Every word weakFor() can weaken is
 * listed; null = keep written (the engine already weakens it, or no spelling reads right).
 */
export const WEAK_SPEAK: Record<string, string | null> = {
  // "to" is already weak in SAPI (/tʊ/); "ta" is read /tɑ/ (British "ta"), less reduced than the written word
  to: null,
  you: 'yuh', // SAPI: /jə/ ("ya" is read /jæ/); never at the start of a phrase

  your: 'yer',
  for: 'fer',
  // SAPI reads the written "can" / "from" strong (k ae n, f r aa m) even when unstressed; "kin" (k ih n) and "frum"
  // (f r ah m) are the reviewed lesson spellings (I kin swim, I'm frum Vietnam), measured 2026-11-07
  can: 'kin',
  from: 'frum',
  and: 'an', // between two words only; SAPI reads "an" /ən/ but "'n" as the letter N /ɛn/
  them: 'em', // only the /əm/ form, glued like him (tellem, findem); never a lone "'em" (read /ɛm/)
  a: null, an: null, the: null, of: null, but: null, or: null, at: null, as: null,
  than: null, that: null, are: null, was: null, were: null, have: null, has: null, had: null, do: null,
  does: null, some: null, would: null, will: null, been: null, just: null, us: null, our: null,
};

/** "have" after a modal loses /h/ AND /v/ in speech: should have called → shoulda called. */
export const HAVE_SPEAK: Record<string, string> = {
  could: 'coulda', would: 'woulda', should: 'shoulda', must: 'musta', might: 'mighta',
};

/**
 * Elision (t/d dropped between consonants): words whose t/d-less spelling an engine reads right. Others stay.
 * Every form was checked with SAPI phonemes (2026-11-07): ress r eh s, tess t eh s, fine f ay n, sen s eh n,
 * behine b ih h ay n, aroun ax r aw n, kep k eh p, sof s aa f, ole ow l, tole t ow l, secon s eh k ax n,
 * jusst jh ah s (no t; "jus" is /dʒuz/, "juss" is read "just"), dohn d ow n, didn d ih d n, hasn h ae z n, coodn
 * k uh d n ("couldn" is read with /u/). A past
 * tense loses its -ed sound before a consonant, so it is sent as the bare verb (missed the → miss the: m ih s dh ax).
 * Measured wrong and so NOT listed: firs / firss / firsst / furs (all /fɜrz/), haven (/heɪvən/), almose / almosst
 * (vowel), restauran (stress), Han (the name).
 */
export const ELISION_SPEAK: Record<string, string> = {
  next: 'nex', last: 'lass', must: 'muss', best: 'bes', past: 'pass', fast: 'fass',
  west: 'wes', hand: 'hann', left: 'lef', and: 'an',
  rest: 'ress', test: 'tess', find: 'fine', send: 'sen', behind: 'behine', around: 'aroun', kept: 'kep',
  soft: 'sof', old: 'ole', told: 'tole', second: 'secon', just: 'jusst',
  "don't": 'dohn', "didn't": 'didn', "hasn't": 'hasn', "couldn't": 'coodn',
  missed: 'miss', passed: 'pass', talked: 'talk', walked: 'walk', worked: 'work', looked: 'look', liked: 'like',
  asked: 'ask', picked: 'pick', checked: 'check', watched: 'watch', helped: 'help', stopped: 'stop',
  dropped: 'drop', moved: 'move', binged: 'binge',
};

/** "<word> of" + consonant fused into one word: a cup of coffee → a cuppa coffee. */
export const OF_FUSE: Record<string, string> = { cup: 'cuppa', couple: 'couple a', bunch: 'buncha' }; // "coupla": /kuplə/

/**
 * Silent-e words whose glued h-less pronoun needs a respelled stem: give him → givim, love her → luvver (SAPI:
 * g ih v ih m, l ah v er; the lesson spellings). "givem" is read with /ɛ/, so "them" is not glued onto these.
 */
export const H_GLUE_STEM: Record<string, string> = { give: 'giv', love: 'luv' };

/**
 * /n/ → /m/ before b / p / m (ten minutes → tem minutes): only the words whose m-form SAPI reads right (tem, wum,
 * greem, fifteem…: measured). "om" / "im" are read as the letters O-M / "I'm", "sevem" / "elevem" stress the wrong
 * vowel, "ninem" gains a syllable: those keep the written word.
 */
export const PLACE_SPEAK: Record<string, string> = {
  ten: 'tem', one: 'wum', green: 'greem', thirteen: 'thirteem', fourteen: 'fourteem', fifteen: 'fifteem',
  sixteen: 'sixteem', seventeen: 'seventeem', eighteen: 'eighteem', nineteen: 'nineteem',
};

/**
 * Flap T across words, glued: get a → gedda, put it → puddit, shut up → shuddup. Only short words with ONE vowel
 * letter before the final t (so "dd" keeps the vowel short: get, got, put, let, what, that, not, but, shut…)
 * before one of these small words. A word flapped inside itself (water, better) stays written: American voices
 * already flap it.
 */
export const FLAP_LEFT = /^[b-df-hj-np-tv-z]+[aeiou]t$/; // starts with a consonant: "it a" / "at a" stay written
// "off": got off → goddoff (SAPI: g aa d ao f). "I" is handled on its own in speak.ts (whaddai, buddai).
export const FLAP_RIGHT = new Set(['a', 'an', 'it', 'at', 'on', 'in', 'up', 'if', 'off']);
