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
- TTS reads normal English spelling. Never give it a respelling (`play: 'ker-nəl'` is wrong; play the word).
- The decoder (`examples`, `compare`, the feedback of connected-speech quiz items) knows phrases, not word
  history. It may respell a heteronym with the wrong vowel ("I read it yesterday" → ree-dit), so keep heteronyms
  out of `examples` blocks; use a `words` row with `say` instead. Quiz feedback decodes only in course
  `connected` (or items that list `phenomena`); elsewhere a listening item's answer is shown as the plain
  word or sentence with play buttons (`isConnectedSpeechItem(item, course)` in `src/features/lessons/logic.ts`).

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
(including every word-table `sound`) follow the convention.

Then run the whole gate: `npx tsc -b`, `npx oxlint`, `npx vitest run`, `npm run build`.
