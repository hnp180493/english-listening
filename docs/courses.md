# Authoring a course lesson

"Bài học" has four courses. Each course is a list of lessons; each lesson is a few sections of blocks, then an
8-item quiz. This file is the contract for writing lesson content. UI rules: `docs/design-system.md`.

| Course id | Title | File | Export |
| --- | --- | --- | --- |
| `connected` | Nghe nối âm | `src/data/lessons.ts` | `CONNECTED_LESSONS` (10 lessons, ids frozen) |
| `spelling` | Chữ viết → âm đọc | `src/data/courses/spelling.ts` | `SPELLING_LESSONS` |
| `irregular` | Từ bất quy tắc | `src/data/courses/irregular.ts` | `IRREGULAR_LESSONS` |
| `loanwords` | Từ mượn, tên riêng, Anh – Mỹ | `src/data/courses/loanwords.ts` | `LOANWORDS_LESSONS` |

Course titles and one-line summaries: `src/data/courses/index.ts` (`COURSES`). Course ids:
`COURSE_IDS` in `src/core/lessons.ts`.

`LESSONS` in `src/data/lessons.ts` holds every lesson of every course, sorted by course and then by order. The
review system (Ôn tập), the Home plan, the stats labels and the pairs links all read `LESSONS`. A lesson you add to a
course file shows up everywhere without any other change. A course with no lessons is hidden from the course list.

## How to write a lesson

```ts
// src/data/courses/irregular.ts
import type { Lesson } from '../lessonTypes';

export const IRREGULAR_LESSONS: Lesson[] = [
  {
    id: 'irr-colonel',          // lowercase slug, unique across ALL courses, never renamed once shipped
    course: 'irregular',        // must match the file
    order: 1,                   // 1, 2, 3… within the course, no gaps ("Bài 1")
    title: 'colonel: đọc là ker-nəl',
    summary: 'Vì sao colonel không có chữ r mà lại đọc có r.',
    goal: 'Nghe ra colonel, và nhớ câu chuyện vì sao nó viết như vậy.',
    phenomenon: null,           // always null outside course "connected"
    minutes: 6,
    sections: [ /* 2 or more */ ],
    quiz: [ /* exactly 8 */ ],
  },
];
```

Import types from `src/data/lessonTypes.ts` (the same types are re-exported by `src/data/lessons.ts`):
`Lesson`, `LessonSection`, `LessonBlock`, `WordItem`, `LessonExample`, `QuizItem`, `ChooseItem`,
`SilentLetterItem`, `ListenChooseItem`, `ListenTypeItem`, `SpotItem`, `WhichRuleItem`.

Rules for the words you write:

- Vietnamese prose, "bạn" voice, like the existing lessons. English examples stay English.
- Accent: General American. Mention British English only where it differs and matters ("Anh – Anh đọc …").
- Respellings follow the convention at the top of `src/core/decoder/tables.ts` (ei, oh, ee, ai, au, ə…). They are
  plain text: never backticks, `<code>` or `<kbd>` (the tests reject monospace markup).
- md-lite in `text`, `tip`, `rule.body`, `story.md` and `why`: paragraphs split by a blank line, `- ` bullets,
  `**bold**`. Nothing else.
- Keep explanations short. A section has one idea.

## Sections and blocks

```ts
interface LessonSection { title: string; blocks: LessonBlock[] }
```

Every block type of course "connected" still works (`text`, `rule`, `examples`, `compare`, `tip`). `examples`
and `compare` run the connected-speech decoder, so use them for phrases and sentences, not for single words. For
spelling and irregular words, use the two blocks below.

### `words`: a word table

```ts
{ type: 'words'; title?: string; items: WordItem[] }

interface WordItem {
  word: string;   // English, as written
  sound: string;  // respelling in the app convention, e.g. 'ker-nəl' (no slashes, no brackets)
  ipa?: string;   // General American IPA with slashes, e.g. '/ˈkɝnəl/'; shown only when Cài đặt → IPA is on
  note?: string;  // Vietnamese, one short line
  why?: string;   // Vietnamese md-lite: short origin story, behind a small "Vì sao?" disclosure
  mark?: string;  // letters to highlight, see below
  say?: string;   // text for TTS instead of `word` (heteronyms: a context sentence)
}
```

Each row shows: the word (with marked letters), `→` and the respelling, the IPA when the setting is on, a play
button (normal speed) and a slow play button, then the note and the "Vì sao?" story.

**`mark` semantics.** `mark` is `word` written again with letter groups in brackets. When you delete every
bracket character, the result must be exactly `word` (same letters, same case).

| Brackets | Meaning | Looks like | Example |
| --- | --- | --- | --- |
| `[..]` | the letters the row is about (the spelling that makes the sound) | soft accent tint | `{ word: 'laugh', mark: 'lau[gh]' }` |
| `(..)` | silent letters | faded and struck through | `{ word: 'knight', mark: '(k)ni(gh)t' }` |

Groups cannot be nested or empty. Both kinds can be used in one word: `{ word: 'listen', mark: 'lis(t)[en]' }`.
Leave `mark` out when nothing needs highlighting.

```ts
{
  type: 'words',
  title: 'Nghe từng từ',
  items: [
    { word: 'colonel', sound: 'ker-nəl', ipa: '/ˈkɝnəl/', note: 'Không có chữ r nhưng đọc có âm r.',
      why: 'Người Anh mượn từ tiếng Pháp **coronel** (đọc có r), rồi sửa chữ viết theo tiếng Ý **colonnello**. Cách đọc cũ vẫn ở lại.' },
    { word: 'knight', sound: 'nait', mark: '(k)ni(gh)t', note: 'Đọc giống hệt night.' },
    { word: 'read', sound: 'red', say: 'I read it yesterday.', note: 'Quá khứ của read: đọc như red.' },
  ],
}
```

**`review`: word cards in Ôn tập.** Every row can become a word card in Ôn tập once the learner passes the lesson
(docs/review-system.md §13). `review?: boolean` on a row decides it; leave it out to use the course default:
**on** for `irregular` and `loanwords`, **off** for `spelling` and `connected`. So in `spelling`, write
`review: true` on the rows worth reviewing one by one (irregular-looking words, words learners mis-hear), and in
`irregular`/`loanwords`, `review: false` only for a row that is not a word to learn (rare). One card per word +
respelling: the same word taught in two lessons is one card, a heteronym (read: reed / red) is two. A heteronym row
needs `say` (a context sentence): Ôn tập plays that sentence and asks which reading was said; without one the card is
only ever read aloud. A homophone (knight / night) needs nothing: no option ever sounds like the answer. Changing
`sound` of a shipped row makes a new card (the old one stays stored but is no longer served, and its review history
does not carry over), so settle respellings before a course ships. A fast variant of the same word in another course
(FA-mə-li / FAM-li: only a schwa dropped) is not a heteronym.

### `story`: "Vì sao lại thế?"

```ts
{ type: 'story'; title: string; md: string; words?: string[] }
```

A quiet card (book icon, gray inset) for the story behind a spelling. `words` are English words the story talks
about; each becomes a small play button at the bottom.

```ts
{
  type: 'story',
  title: 'Âm khàn đã biến mất',
  md: 'Ngày xưa người Anh đọc **night** gần như "nikht", có âm khàn ở giữa. Khoảng thế kỷ 15 âm này rơi rụng.\n\nMáy in ra đời đúng lúc đó, nên chữ viết giữ cách đọc cũ.',
  words: ['night', 'light', 'laugh'],
}
```

Every irregular word should have a story: in a `story` block for the main word of a lesson, or in `why` for a row
of a word table.

## Quiz: exactly 8 items

All items have `explain: string` (Vietnamese, shown after answering). Do not set `phenomena` outside course
"connected": those items must not feed the connected-speech weakness stats. `which-rule` belongs to course
"connected" only.

### `choose`: multiple choice

```ts
{ type: 'choose'; prompt: string; show?: string; play?: string; options: string[]; answer: number; explain: string }
```

- `prompt`: the question in Vietnamese.
- `show`: an English word or sentence shown big under the prompt (a reading item).
- `play`: English text spoken by TTS. With `play` the item is a listening item: it plays when it appears, has a
  "Nghe" button, and Ôn tập prefers it. Without `play` it is a reading item.
- `options`: 2 to 4, all different. They can be English words, respellings or Vietnamese.
- `answer`: index into `options` (0-based). Options are shuffled on screen.

```ts
{ type: 'choose', prompt: 'Chữ "gh" trong từ này đọc thế nào?', show: 'laugh',
  options: ['/f/', 'Không đọc', '/g/'], answer: 0, explain: 'gh ở cuối laugh đọc /f/: laf.' }

{ type: 'choose', prompt: 'Bạn nghe được từ nào?', play: 'He bought a new car.',
  options: ['bought', 'brought', 'boat'], answer: 0, explain: 'bought = bot: "ough" đọc như o.' }
```

### `silent-letter`: tap the silent letters

```ts
{ type: 'silent-letter'; word: string; silent: number[]; prompt?: string; say?: string; explain: string }
```

- `word`: one English word. The learner hears it (it plays when it appears) and taps letters to mark them silent,
  then presses "Kiểm tra".
- `silent`: 0-based indices into `word` of **every** silent letter. The answer is correct only when the learner
  marks exactly this set. Indices must point at letters (not apostrophes or hyphens), and not every letter.
- `prompt`: default "Chạm vào các chữ câm (viết nhưng không đọc)."

```ts
{ type: 'silent-letter', word: 'knight', silent: [0, 3, 4], explain: 'k và gh đều câm: nait.' }
{ type: 'silent-letter', word: 'island', silent: [1], explain: 's câm: ai-lənd.' }
```

Count the indices carefully: `k n i g h t` → k = 0, g = 3, h = 4.

### The listening types of course "connected"

`listen-choose` (`options`, `answer`, optional `say`), `listen-type` (`text` with one `[gap]`) and `spot` work in
every course. With `phenomenon: null` and no `phenomena`, they record no phenomenon in the stats.

## Text-to-speech rules

- **Options of a listening item must sound different.** In `listen-choose`, and in `choose` with `play`, never
  put two homophones in the options (knight / night, write / right, hour / our, colonel / kernel). TTS cannot
  make them different, so the item has no right answer. The tests check a list of common homophones
  (`HOMOPHONE_GROUPS` in `src/features/lessons/validate.ts`); add to it when you meet a new pair.
- **Heteronyms need context.** A word spelled the same but said two ways (read, lead, live, wind, tear, bow,
  close, use, record, present, minute, wound…) is never played alone. A word-table row gives `say` with a
  sentence (`say: 'I read it yesterday.'`), and a listening item plays a sentence, never the bare word. List:
  `HETERONYMS` in `validate.ts`.
- TTS reads normal English spelling. Never give it a respelling with ə, hyphens or stress capitals
  (`play: 'ker-nəl'` is wrong; play the word). The one exception is connected speech: `say` may be **eye dialect**
  (below), which engines do read as intended.
- The decoder (`examples`, `compare`, the feedback of connected-speech quiz items) knows phrases, not word
  history. It may respell a heteronym with the wrong vowel ("I read it yesterday" → ree-dit), so keep heteronyms
  out of `examples` blocks; use a `words` row with `say` instead. Quiz feedback decodes only in course
  `connected` (or items that list `phenomena`); elsewhere a listening item's answer is shown as the plain
  word or sentence with play buttons (`isConnectedSpeechItem(item, course)` in `src/features/lessons/logic.ts`).

## Connected playback: `say` (how the engine must SAY it)

Given a standard sentence, a TTS engine reads like a newsreader: clear, separated words, no reductions. So an
annotated sentence played as written does not sound like its annotations (measured with the Windows voice:
"Tell him I'll call him back." 0/2 reductions, "Tellim I'll callim back." 2/2). Every sentence with annotations
therefore has two playbacks:

- **"Nghe" (connected, normal rate)** plays `speakableFor(text, say)` (`src/core/decoder`): the authored `say`
  when there is one, else the decoder's generated `decode(text).speakText`.
- **"Đọc rõ từng từ" (careful, slower)** plays the written `text` (for `compare`: `clear`), as plain text like every
  other careful button (`carefulPlan` / `compareCarefulPlan` in `src/core/playback.ts`). The compare card used to
  send a comma-separated citation form ("Is, this, your, bag."): that dropped a question's rise and made the same
  words a second careful clip to generate and ship with the AI voice. Slowness comes from the rate and the careful
  style, not from commas.

`say` is the same field name everywhere it already existed, with one meaning, "what the engine says instead":

| Where | Field | Notes |
|---|---|---|
| `examples` item (`LessonExample`) | `say` | **Required in course `connected`** (`src/data/say.test.ts`); reviewed eye dialect |
| `compare` block | `say` | TTS/decoder text of `natural`; may be standard text ("What do you wanna do?"), the decoder reduces it; also decoded for the on-screen hint |
| `compare` block | `ttsText` | exact eye dialect for playback only ("Is this shur bag?"), used before `say`; the hint still comes from `say ?? natural` |
| `listen-choose`, `silent-letter`, `words` row | `say` | unchanged meaning (TTS text of the answer / word; heteronym context) |
| `Sentence` (dictation, `src/data/sentences.ts`) | `say` | optional; absent = generated. Authored only where the generator has no safe rule (Whatser name, Whatsid all, prouda you, haydit, ride away) |
| checkup (`benchmarkTypes.ts`) | `say` / `say[]` | optional; a passage's list matches `lines` one to one (bA-q3, bD-s03, bF-s05, bF-s10) |
| chunk (`src/data/chunks.ts`) | `ttsText` | eye dialect of the chunk alone ("hafta", "tellim") |
| decoder page examples | `EXAMPLE_SAY` | `src/features/decoder/examples.ts`, one entry per example |
| phenomenon cheat-sheet (`PHENOMENON_INFO.example`) | `say` | required; "gonna", "tellim", "cuppa tea" (fragments the decoder leaves alone) |

Outside course `connected`, `say` keeps its old meaning (a heteronym's context sentence, the answer's TTS text) and
is played exactly as written (`writtenText`), never run through the decoder.

`speakableFor` runs `say` through the decoder too, so standard text in `say` is still reduced, and eye dialect is
left as is. How to write it:

- **Only** ASCII letters, apostrophes, spaces and the sentence's own punctuation (keep `?` so a question still
  rises). No ə, no hyphens, no stress capitals, no IPA.
- Use spellings engines know: gonna, wanna, gotta, hafta, kinda, sorta, a lotta, outta, lemme, gimme, dunno,
  whaddaya, whatcha, didja, doncha, gotcha, cuppa, 'is, cuz, coulda / shoulda / musta.
- **Spellings the Windows voice (SAPI) was measured to misread: never use them** (`src/core/decoder/sapiMisread.ts`,
  checked on every `say` / `ttsText` and on the generated text): ta (/tɑ/: keep "to", already weak), ya (/jæ/: use
  "yuh"), a lone 'n (the letter N: use "an"), a lone 'er (E-R) / 'em (/ɛm/) / 'im ("I'm"): glue them (teller,
  tellem, tellim) or keep her / them / him, jus (/dʒuz/: keep "just"), firs (the trees: keep "first"), Han (use
  "Hann"), coupla (use "couple a"), godda (use "gotta"), budda (Buddha: keep "but a"), wouldja / couldja / shouldja
  (/u/: use "would juh" …), whaddidja (use "whaddija"), aboutim / fromim (keep "about him"), a lone id (the letters
  I-D: glue "it" instead, below), om / im (O-M, "I'm": keep "on" / "in" before b, m, p), firss / firsst (/fɜrzɪz/:
  keep "first"), couldn (/u/: use "coodn"), thaddai (/θ/), almose / almosst, restauran, eed. Add a spelling to that
  file once it is measured wrong (phonemes: System.Speech `PhonemeReached`, see "Measuring" below).
- Join words only where the reduction needs it, at most two words per joined chunk: tellim, teller, callim, toldja,
  meetcha, geda / gedda, puddid on, Turnid off, shoulda. Never walls like "turnitoff". Linking into a vowel is left
  to the engine. A flapped "it" is glued onto the word before when that word takes a glued ending (Turnid off,
  Checkid out, Pickid up, Izzid on, droppid off with the consonant doubled), else onto a following "a" (like idda
  lot; at a → adda), never sent alone. A flapped t before "I" merges with it (whaddai, buddai; not "thaddai"); before
  "off" it is glued (goddoff). A long vowel keeps the word apart with t written d (meed us, stard at), glued only
  before "a" (Waida, meeda). Silent-e stems: Givim, givver, luvver (not "givem", read /ɛ/). SAPI does NOT flap inside a word ("water" is read with /t/), so short flapped words are sent with
  d: wadder, bedder, liddle, madder, ciddy (generated when it is exactly the decoder's respelling).
- Weak forms that read right (all generated): yuh (you, not at a phrase start), yer (your), fer (for), an (and
  between words, also after a comma: ", an I" is read ax n, ", and" ae n), kin (can: SAPI says the written word
  k ae n), frum (from: written f r aa m). Elision only where the t/d-less word reads right: nex, lass, muss, bes, lef,
  Hann, ress, tess, fine (find), sen (send), behine, aroun, secon, ole, tole, kep, sof, jusst (just: "jus" is
  /dʒuz/, "juss" is read "just"), dohn (don't), didn, hasn, coodn, Moce (most, lessons only); a past tense before a
  consonant is sent as the bare verb (missed the → miss the). /n/ → /m/: tem, wum, greem, fifteem…; yod: mishu,
  Bleshu, Lass cheer; supposed to → sposta.
- When unsure, keep the written word. A sentence the decoder finds nothing in keeps `say` equal to `text`.
- The shipped clips are Gemini (Kore) reading the connected text with `CONNECTED_STYLE` (casual, function words
  reduced, words flowing together). The written words are therefore enough for linking into a vowel, weak to / was
  / are / a / the, an unreleased t and written contractions. Respell only what the style would not do on its own
  (gonna, tellem, puddid on, meetcha). Prefer real words or standard informal spellings (yer, bin, wooden, Izzy,
  diddy) over invented ones: Gemini reads invented spellings less predictably ("Ther late." may come out with a
  voiceless th, so "They're late." stays written). The `say` must also sound like the card: "I wanna sof drink."
  under a card showing wan-tə was wrong ("I want a sof drink."). Gemini reads "'em" well, but the browser fallback
  voice does not (`LONE_APOSTROPHE`), so an example whose card shows a lone əm needs a glued form (Tellem) or another
  example.
- In course `connected`, `say` must sound different from `text` unless the example is listed in `AS_WRITTEN`
  (`src/data/say.test.ts`) with its reason (linking into a vowel, a weak form SAPI already says, a strong form or
  written contraction that is the point).
- **Every annotated built-in sentence must sound connected** (`src/data/connected.test.ts`): for each dictation
  sentence, checkup sentence and passage line and connected-course example with an annotation that changes the
  sound (reduction, h-dropping, flap-t across words, weak-form, elision, assimilation), `speakableFor(text, say)`
  differs from `text`. Exempt by rule, each with its reason in the test: weak forms the engine already says weak
  (a, an, the, to, was, were, been, them) or that no measured spelling says (of, at, as, than, that, or …; the list
  must equal the `null` entries of `WEAK_SPEAK`), a flap inside one word, a flap after a written d (good as, could
  I), and /n/ → /m/ without a measured m-form (on Monday, in Bangkok). Exempt by name: `AS_WRITTEN` (first thing,
  eat out, almost, wake him, believe he …), each with what was probed; the test fails once an entry is no longer
  needed. To fix a sentence: widen the generator when the rule is safe for every sentence, else author `say`.
- Measuring: System.Speech in PowerShell (`SpeechSynthesizer`, voice "Microsoft David Desktop",
  `SetOutputToNull()`, `add_PhonemeReached`) gives `e.Phoneme` as SAPI US phone ids, one character each:
  7 silence, 10 aa, 11 ae, 12 ah, 13 ao, 14 aw, 15 ax, 16 ay, 17 b, 18 ch, 19 d, 20 dh, 21 eh, 22 er, 23 ey, 24 f,
  25 g, 26 h, 27 ih, 28 iy, 29 jh, 30 k, 31 l, 32 m, 33 n, 34 ng, 35 ow, 36 oy, 37 p, 38 r, 39 s, 40 sh, 41 t,
  42 th, 43 uh, 44 uw, 45 v, 46 w, 47 y, 48 z, 49 zh ("muss go" → m ah s g ow).
- Check: `DECODER_DUMP=1 npx vitest run src/core/decoder/dump.test.ts --reporter=verbose` prints `~>` (what the
  engine gets) under every built-in sentence. The generated forms live in `src/core/decoder/tables.ts`
  (`speak` on reductions/contractions, `WEAK_SPEAK`, `H_FORMS`, `H_GLUE_STEM`, `HAVE_SPEAK`, `ELISION_SPEAK`,
  `PLACE_SPEAK`, `OF_FUSE`, `FLAP_LEFT`/`FLAP_RIGHT`) and are assembled in `speak.ts`.

## Checks

```bash
npx vitest run src/features/lessons src/data/respell.test.ts
```

`src/features/lessons/courses.test.ts` runs `lessonProblems()` (`validate.ts`) on every lesson of every course and
prints what to fix, for example `irr-colonel quiz 3: silent indices [0,9] must be unique letter positions of
"knight"`. It checks: unique ids across courses, a known course, orders 1..n within each course, 2+ sections,
8 quiz items, every item valid for its type (answer in range, options unique, silent indices inside the word,
listen-type has a `[gap]`), word rows with a word and a respelling, a valid `mark`, IPA written `/…/`, heteronym
rows with `say`, story text not empty, and no monospace markup. `src/data/respell.test.ts` checks that respellings
(including every word-table `sound`) follow the convention. `src/data/say.test.ts` checks every `say` / `ttsText` (allowed
characters, same punctuation, left unchanged by the decoder, every `connected` example has one).
`src/data/connected.test.ts` checks that every annotated built-in sentence sounds connected on "Nghe" (above).

Then run the whole gate: `npx tsc -b`, `npx oxlint`, `npx vitest run`, `npm run build`.

## Real clips ("Nghe người thật nói")

Each connected-speech phenomenon lesson ends with a section of short real-speech clips (`src/data/realClips.ts`, appended by `withRealClips` in `src/data/lessons.ts`; block type `real`, `RealClip` in `src/data/lessonTypes.ts`).

- A clip is a YouTube `videoId`, whole-second `start` < `end` (at most 15 s), the spoken `text`, the `focus` phrase (a substring of `text`, highlighted), a short Vietnamese `note` with the respelling, and the channel as `source`.
- Nothing loads until the learner clicks; the player is a plain `youtube-nocookie` iframe (no YouTube script in the app page). On `file://` (portable) only the "Mở trên YouTube" link shows, because YouTube refuses embedded playback there.
- To add or replace one: find the phrase on YouGlish (US), take the video id and caption second, check the video with YouTube oEmbed (public + embeddable), then PLAY it in the lesson with captions on and confirm the phrase's caption shows inside start–end (YouGlish's second is sometimes another line). `validate.ts` checks the shape; `realClips.test.ts` checks every phenomenon lesson has its section.
