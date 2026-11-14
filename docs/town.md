# Thị trấn: a small town you build by understanding spoken English

Route `#/town`, nav label "Thị trấn". The first version (a 9×9 grid of icons and a quiz form) was rejected by the
owner: "game lỏ vậy… chán chưa từng thấy, chả có hứng học". This is the rebuild: a cozy little town at dusk that the
learner builds himself, with coins, empty lots, decorations, residents, daily tasks and a level.

**The one rule that keeps it a learning tool: every reward comes from understanding spoken English.** A resident SAYS
a built-in sentence in connected speech (audio only). The learner picks what it means, 1 of 3 Vietnamese meanings.
Nothing pays for time spent, for opening the page or for a wrong answer, and nothing is bought with anything but the
xu earned that way.

Two halves, with a hard line between them:

| | Owns | Files |
| --- | --- | --- |
| **Engine** (pure, tested, no drawing) | rules, numbers, stored progress, sync merge, what a line pays, what can be bought, which lines are said, the three meanings, the episodes and their schedule (§9) | `src/core/town/{types,progress,economy,daily,visit,overview,store,story,storyLines,episodes}.ts`, `src/data/{town,townStories}.ts` |
| **Shell** (the game on screen, §7) | the world layout (tiles, where each place and decoration stands), walking, drawing (Canvas 2D / DOM with rendered sprites, §7 "The art"; no runtime dependency), the conversation panel, the build panel, celebrations, sound effects, all UI text | `src/data/townWorld.ts`, `src/core/town/map.ts`, `src/features/town/` |

The shell never decides a number and never writes the town's progress: it calls the store (§6) and draws what the
overview (§5) says. The only thing it stores itself is this browser's own `town-ui` (sound on/off, welcome seen:
device-local, never synced). The engine never knows where anything stands or how it looks. Read
`docs/design-system.md` (the "Thị trấn: game art" section too) before touching the shell.

## 1. Places and residents

One place per sentence topic (13 topics, 300 built-in dictation sentences). A resident is a person you meet there,
not a job (Kim is at Phòng khám, Kim is not called a doctor: the sentences were not written for a role). Ids are
stable: they are stored in the purchases and used by the world layout.

| Place (id) | Topic of its lines | Resident | Xu to build |
| --- | --- | --- | --- |
| Quảng trường (`square`) | Giao tiếp | Leo | stands from the start |
| Quán cà phê (`cafe`) | Ăn uống | Emma | stands from the start |
| Nhà bạn (`friend`) | Bạn bè | Mia | stands from the start |
| Nhà (`home`) | Gia đình | Grace | 20 |
| Cửa hàng (`shop`) | Mua sắm | Ben | 30 |
| Văn phòng (`office`) | Công việc | Sarah | 40 |
| Trường học (`school`) | Học tập | Daniel | 50 |
| Bến xe (`station`) | Du lịch | Sam | 60 |
| Phòng khám (`clinic`) | Sức khỏe | Kim | 70 |
| Rạp phim (`cinema`) | Phim ảnh & giải trí | Zoe | 80 |
| Tiệm điện thoại (`phone`) | Công nghệ | Max | 90 |
| Công viên (`park`) | Cảm xúc | Lily | 100 |
| Bảng tin (`board`) | Kế hoạch | Tom | 110 |

The ten paid places are **empty lots** until the learner builds them, in any order he likes. A conversation needs its
place to be built (`canTalk`, `conversationLines`). The three free places hold 70 lines.

Decorations (`TOWN_DECORATIONS`), each with fixed spots in the world so the town visibly gets prettier:

| id | Name | Xu | | id | Name | Xu |
| --- | --- | --- | --- | --- | --- | --- |
| `lamps1` | Đèn đường | 10 | | `lilies` | Hoa súng trên hồ | 20 |
| `flowers` | Bồn hoa | 8 | | `stall` | Quầy hàng rong | 30 |
| `benches` | Ghế đá | 12 | | `fountain` | Đài phun nước lớn | 40 |
| `blossom` | Cây hoa anh đào | 15 | | `balloons` | Bóng bay | 12 |
| `lamps2` | Thêm đèn đường | 15 | | `flags` | Cờ hội | 18 |
| `lights` | Dây đèn | 25 | | `cat` | Chú mèo | 35 |

Everything together costs 890 xu (650 for the lots, 240 for the decorations). 300 lines understood on the first
listen pay 900 on their own, so the whole town is reachable from its own content; bonuses and daily tasks make it
come sooner.

## 2. A conversation

Five lines of the place (`VISIT_SIZE`), chosen by `pickVisitLines`: lines never understood first (easiest first, then
by id), then lines understood only with replays (oldest first), then lines understood on the first listen (oldest
first). So a place is walked through before anything repeats.

### Audio

A line sends exactly what Chép chính tả sends for that sentence: `dictationAudio(line)` +
`playbackFor('normal' | 'slow' | 'careful', audio, settings.rate)` + `speak()` (`features/town/useLinePlayer.ts`).
Never another text or rate, so the shipped Gemini clip plays and nothing is paid for. "Rõ từng từ" (the written
text) exists only after the choice. The English sentence is shown only after the choice.

### The three meanings (`choicesFor`)

The right meaning and two wrong ones from other lines of the same place (= the same topic). The wrong ones are meant
to be **hard**:

1. lines of the same level first, then the nearest level;
2. among those, ranked by how easily they are confused with the right meaning (`confusability`, 0..1): shared
   Vietnamese words weigh most (0.55), then the same kind of sentence, a question for a question (0.25), then a
   similar length (0.2);
3. two are drawn with the seed from the `DISTRACTOR_WINDOW` (4) most confusable ones, so a repeat does not always
   show the same pair;
4. never a meaning that reads the same or nearly the same as the right one or as the other wrong one: same words
   apart from case / punctuation / a closing particle (nhé, ạ, nhỉ…), or one extra word that is not a negation ("Bạn
   khỏe không?" / "Bạn có khỏe không?"). A negation is NOT a duplicate: "Mình đi được" against "Mình không đi được" is
   exactly what the ear must tell apart.

Example at Quán cà phê: "Bạn ăn gì chưa?" is offered next to "Bạn muốn ăn gì?"; "Cho tôi một ly cà phê." next to
"Cho tôi một tách trà.".

Deterministic for (line, pool, seed). The seed is the line's tries so far (`choiceSeed`), and the right meaning is at
a different position for seed n and n + 1: a line asked again never shows the answer where it was.
`startTownConversation` draws the meanings once, so they do not move while the learner answers.

### How a line counts

- `first`: the right meaning after exactly ONE play at the normal speed. `replayed`: right, after more plays or a
  slower one. `wrong`: another meaning.
- Plays are counted with the dictation helpers (`core/dictation/listens.ts`, `notePlay`): a "Nghe" while Settings →
  Tốc độ đọc is below `NORMAL_RATE_MIN` (0.95) counts as a slowed play. Plays after the choice count for nothing.
- Nothing played yet: the meanings cannot be chosen (`canAnswer`), and `lineOutcome` returns null. A guess is not
  listening and is recorded nowhere.
- A line met again can be `first` too (its words were shown after the earlier answer). When it was already at its
  best it pays 1 xu, not 3 (§3). The shell never praises the first listen for a line answered before: it looks at the
  line's `tries` when the conversation starts (`verdictOf(outcome, met)`, §7), not only at `prevBest`, because a
  line missed once has shown its words too.

## 3. Xu: what understanding pays

Per answered line (`lineReward(prevBest, outcome)`):

| What happened | Xu |
| --- | --- |
| right after ONE normal-speed play, on a line not yet "understood on the first listen" | 3 |
| right, with replays or a slower play, on a line never understood before | 2 |
| right, but the line was already at that level (nothing new) | 1 |
| wrong | 0 |

A line therefore pays at most 2 + 3 for getting better; after that every right answer is 1. Replaying one known line
for xu is not worth it; hearing a new line is.

- **Conversation bonus:** 5 right out of 5 adds 5 xu (`conversationBonus`). First listen or not, no wrong line, all
  five answered. Leaving early: no bonus, the answered lines keep their xu.
- **Daily tasks** (`core/town/daily.ts`), paid once each per local day and browser, by themselves at the moment they
  are reached (no "claim" step):

  | id | Label shown | Goal | Xu |
  | --- | --- | --- | --- |
  | `talk` | Trò chuyện với 2 người dân | a conversation finished with 2 different residents | 5 |
  | `lines` | Hiểu 8 câu | 8 right answers (replayed ones count) | 8 |
  | `first` | Hiểu 4 câu ngay lần nghe đầu | 4 `first` outcomes | 10 |

- **Streak** (`townStreak`): consecutive local days with at least one line answered in town (any outcome, any
  machine), ending today, or yesterday when nothing was answered yet today. Same rule as `currentStreak`. It pays
  nothing: it is only shown.

A first evening, for scale: one perfect conversation is 5 × 3 + 5 = 20 xu, and with it "Hiểu 4 câu ngay lần nghe đầu"
(10) is reached: the first lot (Nhà, 20) or two decorations are affordable after one or two conversations.

### Buying

`balance = xu earned on all machines − the cost of everything bought`, never shown below 0. `canBuy(progress, id)`
refuses with a reason: `unknown` (no such place or decoration), `owned` (already built or bought; the three free
places always are), `poor` (with `missing` = xu still to earn). `buy` is immutable and only adds the id to the
purchases; nothing is ever un-bought or refunded.

### Level, hearts, lit windows (derived, never stored)

- **xp** = 3 per line understood on the first listen + 2 per line understood only with replays (lines of the town
  only). It never goes down.
- **Titles** (`TOWN_LEVELS`): 0 Khách lạ · 15 Người quen · 40 Hàng xóm · 80 Cư dân · 150 Người của thị trấn ·
  300 Thị trưởng. `TownLevel` = `{ index, title, xp, nextAt | null, nextTitle | null, progress 0..1 }`.
- **lit** (0..1) of a place = the share of its lines understood: its windows light up with it.
- **hearts** (0..5) = friendship with its resident, from the same share: a heart at 10 / 30 / 50 / 70 % and the fifth
  only when every line is understood. With 21 to 26 lines per place the first heart comes with the third line.
- **marker** of a built place: `new` = it still has lines not understood, `repeat` = all understood, some only with
  replays (worth hearing again for the first listen), `heart` = every line understood on the first listen. An empty
  lot has none.

## 4. Stored data and its merge

Synced key `town-progress` (`KEYS.town`), parsed defensively (`parseTownProgress`: junk reads as an empty town,
never as a crash; `__proto__`-like keys are refused):

```ts
{
  version: 3,
  lines:  { [lineId]: { best: 0 | 1 | 2, tries: number, at: number } },
  earned: { [deviceId]: number },                 // xu, one bucket per browser
  bought: string[],                               // place ids + decoration ids, sorted
  daily:  { [day]: { [deviceId]: { talks, lines, first, met: string[], paid: string[] } } },
  days:   string[],                               // local days with a line answered (the streak)
  episodes: { [episodeId]: { stage, at, okAt, firstGist: 0 | 1 | 2, bestLines } },   // §9
}
```

`lines` holds the lines of the episodes too (`cafe-1-03`), recorded like any line.

- `lines.best`: 0 = answered, not understood yet; 1 = understood with replays or a slower play; 2 = understood on
  the first listen. It only grows. `tries`: answers given (also the seed of the meanings). `at`: when the line was
  last understood (for a line not understood yet: its last try); a miss on an understood line leaves it alone, so
  that line stays among the oldest and is asked again sooner.
- `earned`: a browser only ever adds to its OWN bucket (`deviceId()` of `core/history.ts`, a device-local key), so
  the total is the sum of the buckets. Same idea as the daily archive in `core/history.ts`.
- `bought`: nothing is removed, ever.
- `daily[day][device]`: `talks` conversations finished, `lines` right answers, `first` of those on the first listen,
  `met` the places a conversation was finished at, `paid` the task ids already paid. A write keeps the 14 days up to
  today (`DAILY_KEEP_DAYS`) and drops anything later than tomorrow; a read or a merge keeps at most the newest 60
  (`DAILY_MAX_DAYS`).
- `days`: newest 400 kept (`DAYS_KEEP`).

**Merger `mergeTown`** (`core/syncMerge.ts` → `mergeTownProgress`): every field only grows, so there is no "which
machine wrote last" anywhere.

| Field | Merge |
| --- | --- |
| `lines` | union; per line max of `best`, `tries`, `at` |
| `earned` | max per device (a stale copy of a bucket never lowers or doubles it); total = sum |
| `bought` | union |
| `daily` | per day and device: max of the counters, union of `met` and `paid` (a task is never paid twice) |
| `days` | union |
| `episodes` | union; per episode max of `stage`, `at`, `okAt`, `firstGist`, `bestLines` (the next re-listen is derived from them, §9) |

Idempotent, commutative, associative, caps included ("the newest N keys of a union" does not depend on the order of
merging): `syncMerge.props.test.ts` checks the laws on random towns, junk, version 1 and version 2 values and junk
episodes.

Consequences worth knowing:

- **Version 1** (`{ version: 1, lines }`, the first evening of the feature) loads and merges as it is: the lines and
  the level stay, xu start at 0. No xu are granted for lines understood before; those lines now pay 1 xu per right
  answer.
- **Version 2** (before the episodes) loads and merges as it is, with no episode begun; the next write saves version 3.
  A machine still on a version 2 build reads a version 3 value without its episodes and writes it back without them;
  the folder sync merge brings them back from the other copy (a union), so nothing is lost once both machines run the
  new build.
- **Two machines spending the same xu before a sync:** both purchases stay (union), the raw balance goes below 0, the
  balance shows 0, and the learner earns the difference back before the next purchase (`canBuy` → `poor` with the
  full `missing`). Nothing is taken away.
- **Daily tasks are per browser.** Playing on the laptop and on the phone on one day gives each its own three tasks.
- "Xóa dữ liệu", restore and the reset marker treat the key like any other synced key: the town of before the reset
  (lines, xu, purchases) does not come back from another machine. "Xóa lịch sử luyện tập" leaves the town alone.

## 5. What the shell reads: `townOverview(progress, now, device)`

One selector with everything the game screen shows (`useTownOverview()` in the store gives it live):

```ts
{
  balance, earned,                 // xu to spend now (≥ 0), xu earned so far
  level,                           // TownLevel
  streak, playedToday,
  tasks: [{ id, label, goal, reward, done, reached, paid }],   // the three, today, this browser
  totals: { total, understood, first },
  places: [{ place, built, cost, affordable, missing, stats, hearts, lit, marker, episode }],   // in listed order
  // episode: { id, order, title, mode: 'new' | 'relisten' } | null: what a talk there is now (§9)
  decorations: [{ decoration, bought, cost, affordable, missing }],
  built, decorated, canBuySomething,
}
```

`affordable` is only true for something not owned yet. `missing` = xu still to earn (0 when owned or affordable).

## 6. What the shell calls: `core/town/store.ts`

- `useTownProgress()` / `useTownOverview()`: live, stable while nothing changed (another tab, folder sync and a
  restore are picked up: every read compares the raw stored string).
- `startTownConversation(placeId)` → `{ ok: true, place, turns: [{ line, choices }] }` or `{ ok: false, reason:
  'unknown' | 'empty-lot' }`. Five lines with their meanings already drawn. Starting again drops a conversation left
  in the middle (its answered lines are already saved).
- `recordTownAnswer(line, outcome)` → everything needed to celebrate:
  `{ outcome, prevBest, reward, bonus, tasksPaid: [{ id, label, reward }], earned, balance, levelBefore, levelAfter,
  leveledUp, placeId, heartsBefore, heartsAfter, review, conversation, progress, saved }`. In one write it: records
  the line, pays its xu, updates the day's counters, pays any daily task just reached, and, on the last line of the
  conversation, counts the conversation (bonus, `talk` task) and sets `conversation`. It also records one practice
  attempt (`module: 'town'`, no phenomenon counters: a wrong meaning does not say which sound was missed, and no
  first-listen `once` counter in the daily archive) and, for a WRONG line whose sentence has no review card yet,
  enrols its dictation card in Ôn tập (`dict:<id>`; a card that exists is never touched). `review` is that
  enrolment for `reviewNoteVi`. Never throws.
- `finishTownConversation()` → the result of the conversation once all its lines are answered (`{ placeId, outcomes,
  summary, bonus, tasksPaid, earned, balance, heartsBefore, heartsAfter }`), null before. It only reads: the last
  `recordTownAnswer` already paid, so a summary screen can call it as often as it renders.
- `buyTownItem(id)` → `{ ok: true, item, balance, progress, saved }` or `{ ok: false, reason, item, missing, balance }`.
  A refused purchase writes nothing.
- `startTownEpisode`, `recordEpisodeGist`, `recordEpisodeLine`, `finishTownEpisode`: an episode (§9).

Guards the shell gets for free: a line answered twice within one started conversation (a double click, a React
effect run twice) is recorded once and returns the first result; answers made without `startTownConversation` still
form a conversation after five different lines of one built place; a refused save (blocked or full storage) keeps
everything for the session (`saved: false`) and is written with the next save that works.

## 7. The game on screen (`src/features/town/`)

One route, `#/town`. Optional params: `talk=<placeId>` opens straight into a conversation with that resident when
the place is built (the player starts beside them; the param is dropped from the address when the conversation
closes), `build=<placeId | 1>` opens the build panel (on that lot).

| File | What it is |
| --- | --- |
| `TownPage.tsx` | the page: wires the store to the stage, owns "a conversation is open / the build panel is open", plays the celebrations |
| `engine/` | the world on ONE canvas (`TownStage` + `TownEngine`): isometric town, walking (click, tap, arrows / W A S D), camera, day and night, particles; `sprites.ts` draws the rendered art (night tint included), `draw/` only what is still code (sky, ducks, fireflies, tags, emotes, particles). No game rule in it |
| `art/` | the rendered pictures (§7 "The art"): WebP atlases, generated manifests (`characters.data.ts`, `world.data.ts`), their loaders (`characters.ts`, `world.ts`, `load.ts`), the cast (`cast.ts`), `LICENSE-kenney.txt` |
| `useTownArt.ts` | loads the pictures once per session: `loading` / `ready` / `error` + `retry` |
| `TownHud.tsx` | what floats over the town: the title with its xp bar (top-left); streak (from 2 days), xu, "Việc hôm nay" (shared `Popover`), "Xây", sound on/off, "Toàn màn hình" (top-right; on a phone the four buttons go down the right edge) |
| `Conversation.tsx` | the quick chat panel ("Trò chuyện nhanh", docked right on a stage ≥ 900 px wide, over the bottom below that): five lines, then the result card; its `Turn` (one line heard and answered) is shared with the episodes |
| `Episode.tsx`, `episodeModel.ts` (tested), `useStoryPass.ts` | an episode of "Chuyện ở thị trấn" (§9) in the same panel: the three steps or a re-listen, the transcript; what each line sends, the pauses, the words; the whole exchange in one go |
| `talkKeys.ts` | what both panels share: the delay before a resident speaks, which key presses are not theirs |
| `BuildSheet.tsx` | "Công trình" (empty lots) and "Trang trí": a side sheet on a wide stage, a bottom sheet under 720px |
| `shellModel.ts` (tested) | the shell's own small decisions: what the stage is told, whom to suggest, the verdict words, the result sums, the labels |
| `sfx.ts` | sound effects as short Web Audio tones (no files) |
| `townUi.ts` | `KEYS.townUi` (`town-ui`, device-local): `{ sound, welcomed }` |
| `art.tsx`, `engine/thumb.ts` | game pictures as DOM: coin, hearts, a person's rendered portrait (neutral / happy), the thumbnails of the build panel (the same sprites as the world) |
| `useLinePlayer.ts` | playback of one line: exactly what Chép chính tả sends (§2 Audio) |

**The town.** The stage is as tall as the window allows. Clicking a resident (or their house) walks there and starts
the conversation; clicking a lot on offer (a construction site, see "Lots on offer" below; any other lot is ground)
walks to its gate and opens the build panel on it; E / Enter / Space acts on
whoever the player stands beside, and with nobody near walks to the suggested resident. One primary button sits at
the bottom of the stage and always offers the next thing: "Bắt chuyện với Emma" beside a resident, "Xây Cửa hàng ·
30 xu" at the gate of a lot on offer, otherwise "Tới gặp Leo" (`suggestedPlace`: a due re-listen first, then an
episode to hear, then lines not understood yet, the least known place first; an episode names itself: "Tới gặp Emma ·
Tập 1", "Nghe lại chuyện với Emma", §9). The first visit shows one welcome bubble from Leo (closed for good by its ✕, by a conversation or by
opening the build panel).

**Names over heads.** Not everybody, all the time: a name tag shows over the resident the main button suggests
(`hint`), whoever is under the pointer or near the player (`NAME_NEAR`), the player ("Bạn") and the lots on offer;
in a conversation nobody has a tag (the panel says who it is), only the speaking bubble. The marker over a tag
("!", "…", a heart) comes with it. Tags are placed most important first and never cover one another
(`placeTags` in `draw/overlay.ts`, tested); they stay out of the stage's edges and of what the HUD and the panels
cover (`safe`, measured on the page by `useStageInsets`); a person too near the top gets the tag under the feet,
without its marker. Somebody off the stage has no tag. An episode waiting at a place puts its own marker there instead
(`markerOf`): a violet bubble with three dots (an episode to hear), a green one with a round arrow (a re-listen due).

**The camera.** It follows the player and, while the suggested resident is close enough, frames the two of them
together. While it follows the walking player it moves with them frame by frame (`Camera.carry`: no lag behind a
walker at a start, no world sliding on under a player who has stopped); only a change of what it looks at (a
conversation, a new building, the overview) is eased, by a critically damped spring that starts from rest (ease in
and out, about 0.6 s, no overshoot; `springStep`), never faster than 1,200 screen px a second, and never more in one
drawn frame than 1.5 of the display's usual frames (`cameraDt`, at least 1/50 s: a frame the browser is late with
shows as a pause, not a jump; a flat 1/50 s cap once ran every eased move in slow motion on a 30 Hz screen). When
a conversation begins or ends the camera holds still for 3 frames and 0.12 s while the page paints the panel. It keeps to the island: the view's corners may show a little sky, never a wedge of it (`Camera.island`),
and never at the price of losing the player: whatever it aims at (the point between the player and the suggested
resident, the island's pull, the world's edges), the player's feet and head stay at least 15% of the half view
inside the edges (`Camera.keep`, tested at every corner of the island; while the camera eases, 6%). What it looks at goes to the middle of what the HUD and a panel leave
free (on a phone the column of buttons down the right edge counts too). With the build panel open it shows the lot
the panel is about (the one clicked, else the cheapest on offer). In full screen on a big screen it zooms out to
the whole built town (`builtFit`, never below 0.62 of the resting zoom).

**Lots on offer** (`lotsOnOffer` in `shellModel.ts`, tested): only the next `LOTS_ON_OFFER` (3) lots the learner can
work toward stand in the world as construction sites (fence, cones, wooden frame) with their price over them: the
cheapest ones not built yet, ties in the listed order. Building one brings the next one up. Every other lot is a
corner of nature (a tree or two, a bush, a stone: `lotNature` in `art/world.ts`, the same every time): no fence,
no sign, no price, nothing to click or hover (`pick.ts` skips it, and the "Xây" prompt at its gate does not come
up). Its footprint stays blocked for walking, as before. The build panel still lists every lot, so any lot can be
built in any order; the hidden keyboard list keeps one button per lot too.

**Toàn màn hình.** The last HUD button (Maximize2 / Minimize2, "Toàn màn hình" / "Thu nhỏ") puts the stage over the
whole window: the Fullscreen API on the stage's own box when the browser has it (it hides the browser's bars), and
always a fixed overlay through CSS (`.town-stage.is-full`; the page under it does not scroll), which is all an
iPhone gets. The HUD, the conversation, the build panel and the popover of "Việc hôm nay" are all inside the stage,
so they work there. Esc leaves (the browser's own Esc for the API; ours for the overlay, but only when no panel is
open: Esc closes the conversation or the build panel first); focus stays on the button. While full screen is on,
everything outside the stage (nav, page header, "Thị trấn này để làm gì?", the skip link) is `inert`
(`inertOutside.ts`, tested), so Tab and a screen reader's cursor stay in the town; focus moves to the canvas when it
was outside. The overlay keeps its HUD, prompt, panels and toast clear of a phone's notch, status bar and home
indicator (`env(safe-area-inset-*)`, as `viewport-fit=cover` lets the stage reach under them). The choice is kept for
the session only (a module variable: going to another page and back keeps it, a reload does not; coming back never
re-enters the Fullscreen API without a click, only the overlay).

**Loading.** The pictures (§7 "The art") load once per session and stay in memory across visits of the page. Until
they are there the stage shows its sky with one calm pill, "Đang dựng thị trấn…"; the prompt and the welcome
bubble wait. A failed image shows "Không tải được hình của thị trấn. Kiểm tra mạng rồi thử lại nhé." (opened from
disk: the "art" folder must sit next to the HTML) with "Thử lại" (the loaders forget a failed attempt, so it really
tries again). Never a blank or broken canvas. Until the pictures are there the town is on hold: the stage takes no
keys or clicks, the hidden action list is disabled, the HUD "Xây" does nothing yet, and a conversation or build panel asked for by
a link (`?talk=`, `?build=`) opens only once they load, so "Thử lại" is the screen's one primary button and no
conversation runs over an empty sky.

**People.** Every person is a sprite with a walk loop in eight directions (five rendered, three mirrored), an idle
(breathing) loop facing the viewer (S, SE, SW) and three emotes. Nobody rests with their back to the viewer (with
these blocky heads a back view is a box of hair): standing, a person turns three-quarters towards the viewer on the
side of whatever they look at (`face`), and `SETTLE_AFTER` (0.12 s) after any walk (`settle`; the player too once no
key is held), so in a conversation the two face each other and the viewer. Residents stand by their door most of
the time: every 6–14 s a stroll of a few tiles (2–3 tiles out, never onto a doorstep or onto somebody), a stand of
2–5 s there, then home; standing about they now and then look round (straight at the viewer or across to the other
side, never the back of the head) and turn to the player when the player is near (at most every 0.35 s, so a player
pacing past does not make them flicker). Short animations played once (`act`): the player waves when a
conversation starts, the resident nods after a right answer and shakes their head after a wrong one.

**Motion** (rebuilt 2026-11-14 after the owner said the people moved "giật giật như ma cà rồng", like hopping
vampires; a second pass the same day after an animation review; measured in headless Edge, before and after in the
table below):
- speeds are ground speeds, tiles per second, the same whichever way on the screen (`PLAYER_SPEED` 2.2, residents
  `RESIDENT_SPEED` 0.8 each ±10%, the cat 0.75). Before, they were screen pixels, so walking up the screen was three
  times faster over the ground than across it;
- the walk cycle follows the distance walked (`phase` += distance × 2π / stride; `engine/gait.ts`): the stride is
  what the feet cover on the rig (`gaits` in the manifest, measured by `render.js measureStride`) times
  `GAIT_SLIP` (player 1.4: brisk with a little slide; residents 1.05). A resident's cycle runs about 1.6 times a
  second, the player's about 2.4, so a 16-frame walk shows 25–40 new frames a second;
- the arms hang by the body and swing forward and back against the legs (scripts/town-art `ARM_REST`,
  `walkArms`): Kenney's own pose held them 45° out and swung them out to the side, the stiff "zombie" stance the
  owner saw; standing, people breathe, shift their weight from foot to foot and glance aside (a 2 s idle loop);
- a click walk follows the A* path pulled straight wherever the way is clear with room to spare (`smoothPath`,
  `lineClear`): one line across the plaza instead of a staircase of 45° steps, and the last corner cut when the
  way is clear (`cutLastCorner`: no walking along a row and then a sharp turn for the last tile);
- nobody walks through anybody. Paths go round people (`findPath` with a detour cost of `DETOUR`, four steps, on
  their tiles: it once was 8 screen px, under a quarter of a step, so walks went straight through somebody's tile and
  shoved them aside even on the open plaza; every straight line keeps `PASS` 0.55 tile from them). Every walker looks `LOOK` 0.9 tile ahead along its
  path, round its corners, and 0.4 s ahead in time for somebody walking across (`blocker`); behind somebody going
  the same way it follows at their pace (`following`), otherwise it slows to a stand and waits, legs together and
  breathing (the idle loop) where it faces the viewer. A resident or the cat gives the walk up after 0.4 s behind
  somebody standing, 1.2 s behind somebody walking, and leaves that heading alone for 4 s (`giveWay`, `giveUp`;
  `canSetOff`: a stroll that would set off straight into somebody is not begun). The player's click walk looks for
  a way round every 0.35 s (`playerWay`); on a narrow way with no way round, the one standing in it steps aside to
  the nearest free spot clear of the walk, a few tiles on if need be (`stepAside`; never somebody held for a
  conversation); a held key at somebody standing in the way does the same after 0.5 s (`keysBlocked`). Last, one
  hard rule over all of that: a step that would bring anybody nearer than `MIN_GAP` 0.5 tile to somebody (and
  nearer than they were) is not taken (`TownSim.step`). One way out of it: a click walk that has stood
  `SQUEEZE_AFTER` 1.5 s behind somebody with no way round and nobody making way (a one-tile road with people in it,
  the cat getting up and sitting down again in it) squeezes past that one person (`squeeze`); before, the player
  could be boxed in for good (in a stress run, 20 of about 430 random walks never arrived). Walking up to talk never
  picks a spot right by somebody standing near the edge of their tile (closer than 0.85 tile);
- a walker sees somebody walking across its way where it will be at its FULL pace 0.4 s on (`blocker`): at its pace
  of the moment, slowing for them made it stop seeing them, so it sped up, saw them again, and its speed went up
  and down every frame behind the cat or a strolling resident (178 such frames in a 100,000-frame stress run, 1 now);
- a walk cut short (keys taking over a click walk, a resident called to talk) stops at the next tile centre AHEAD on
  the line (within 45° of it: `stopAhead`); it once took the tile under a point half a tile on, which early in a
  diagonal step is still the tile being left, so the walker turned round, walked back a few hundredths of a tile and
  turned again;
- personal space: a stroll's end and the cat's seat are chosen with `SPACE` 1 tile round them; a resident standing
  nearer than 0.8 tile to somebody for 0.6 s goes home; the cat gets up and goes when somebody stands right by it
  for 1.2 s;
- a walk eases in (`START_TIME` 0.14 s; the first step lifts at once, at least `START_CADENCE` while the body is
  slow, instead of gliding on closed legs) and out (`STOP_TIME` 0.28 s, braking on the distance left); the last
  stride is fitted to the distance left (`land`: the cycle a little faster or slower) so the legs come together
  just as the body stops, and the person keeps that pose (frame 0 or the middle frame, both legs together: the
  frames are timed so that both are, Kenney's walk crossing its legs again at 45% of the clip); a body
  stopped by somebody in the way closes the step at once (a stride barely begun goes back down: `closeTarget`), never
  a stride held mid-air; held keys walk on from tile to tile without slowing (the distance left in a frame carries
  over);
- a person turns 45° per `TURN_STEP` (0.07 s) walking and per `TURN_STEP_STAND` (0.12 s) standing, never a whole
  turn in one frame, a half turn round through the front (the face); a walk the other way first turns on the spot,
  0.09 s per 45° (`TURN_STEP_START`), and sets off once the way is within 45°: no spin while already moving. Walking, the sprite takes a new direction at once when the
  way is clearly in it (12° past the octant's edge), otherwise once it has been the nearest for `HYSTERESIS_TIME`
  (0.14 s): no flicker on a zig-zag, and no walking crabwise along a long straight line;
- after a walk the person turns three-quarters to the viewer `SETTLE_AFTER` (0.12 s) after the step lands, an
  easy turn of 0.12 s per 45°; coming from a way the idle loop is not made for (N, NE, E…), they stand 0.1 s on the
  legs-together frame before the idle starts (`IDLE_AFTER_TURN`): the turn and the change of animation are two
  moments, not one pop;
- the cat gets up before a walk and sits down after it through 8 in-between frames (`down`, 0.5 s, played
  backwards to stand up; `CAT_SIT_TIME`), turns only standing (to the front first, then it sits), never rotates
  while seated, and its tail loop starts from the moment it sat;
- the walk rides at one height through the cycle (`lift`, about 1.2 world px over the idle's ground line), lowered
  by it as the walk slows to a stand (`walkDrop`): the body once rose mid-stride and dropped with the legs together,
  a small hop at every step and a drop at every stop (scripts/town-art/README.md);
- each emote plays ±10% faster or slower (`ACT_TEMPO`), so two head shakes in a row are not the same one (enough
  frames for 15 a second at the slowest);
- an emote waits until its person has turned three-quarters to the viewer (at most 0.8 s): the conversation's wave
  never jumps from a back view;
- night copies of people's frames: at most a few new ones per drawn frame (`beginSpriteFrame`), past that a shared
  scratch canvas, so a walk at night does not allocate a canvas for every new frame.

| (headless Edge, all 13 residents and the cat) | before | first pass | second pass | third pass |
|---|---|---|---|---|
| resident walk: new frames a second (p50) | 4.7 | 23.6 | 24 | 24 |
| player walk: new frames a second | 13–16 | 27–40 | 38 | 38 |
| cat walk / sit: new frames a second | 5.1 / – | 24.8 / 5.1 | 25 / 10 | 25 / 10; sits down and gets up through 8 frames |
| idle / emotes: new frames a second | 4.5 / 8.6 | 15 / 15–17 | 15 / 16–17 | the same; emotes ±10% tempo |
| arms | 45° out (A-pose), swung sideways | the same | hanging, swung forward and back | the same |
| Grace's walk over her idle (lowest pixel of the walk / idle, S, atlas px) | – | – | −3 / 9 (she floated) | 5 / 9, like everybody |
| legs moving after the body stopped | – | 0.2–0.7 s, then a snap to frame 0 | none (the step lands) | none |
| standing turned away after a stroll, then the turn | – | 0.4 s, then 90–135° in 0.13 s | 0.12 s, then 0.12 s per 45° | the same |
| player walking > 25° off its sprite's direction | – | 18% of walking time (runs up to 1.8 s) | 4% (runs up to 0.2 s) | 2.4–4.3% (runs up to 0.2 s) |
| player off the canvas (keys walk, suggested resident far) | – | 77 of 222 frames | never | never |
| two people's feet nearer than 0.55 tile | – | – | the player through Leo (0.00); the cat on feet 11–19 s | once in all runs: the cat passing, 0.50, 0.6 s |
| the two after walking up to talk | – | – | 6 of 11 overlapping | 0 of 15 overlapping (9 side by side) |
| camera at a conversation's start: first frame / largest move a frame | – | – | full speed / 129 px | 0.3–7 px / 43 px |
| night, frames over 20 ms (1600×900 / 390×844) | – | 8–37% / 27–49% | 0–2.5% / 0–1.4% | not re-measured at 60 Hz (see below) |
| longest engine frame, 390×844 by day | – | 70–125 ms (pictures decoded mid-frame) | under 8 ms | the same |

The third pass's final runs came out at a steady 17.7 ms frame interval (p95 18.4 ms: about 56 Hz, even pacing) where
every earlier run had 16.7 ms; the code that changed in between cannot account for it, so it was the machine. A
pass at 16.7 ms on the same code less one change (how a stopped stride closes) had dt p95 16.9–17.7 ms and 0.04–0.45%
of frames over 34 ms in every view, day and night.

Only numbers and filmstrips were checked (headless Edge, 1600×900 and 390×844, day and night): nobody has watched
it move yet. People stand about a ninth of the stage
tall (`baseZoom`: the stage height / 460, bounded by the width on a tall phone, 0.8…1.8). Whatever stands in front
of a person (a tree, a lamp, a house, the bus) is drawn see-through over them (`COVER_ALPHA`), so nobody disappears.
A resident standing still always shows a face (the engine turns a back or side view to three-quarters front). The
player is a hatless young man with fair hair, glasses, blue dungarees and bare hands (Kenney `male-e`, recoloured in
`cast.ts`; the gloves are repainted to skin by `MODEL_FIXES` in `scripts/town-art/render.mjs`), not like anybody in
town, Leo least of all; Sam at the bus stop is Kenney's officer
recoloured into a traveller (an orange cap without its badge). The conversation panel shows the resident's rendered
portrait at 88 px (56 px on a phone), smiling after a right answer.

**A conversation** happens in the world: the camera frames the two (`focusOn`, `frameTalk`): both whole, head to
feet with room for the bubble, in the part of the stage the panel and the counters along the top leave free, about
half its height when there is room, never past 2.75 device px per world px (`SHARP_DEVICE_PX`: the people's
atlases hold 2.5) and never so big that one is cut off; the camera then ignores the island's edge (`Camera.loose`).
The town dims a little around them (less at night) and the pair is drawn again over everything. While it lasts
nobody else strolls; a resident within two tiles of either walks off to three tiles or more (home when that is far
enough) and comes home afterwards (`keepClear` in `sim.ts`); a small thing in front of them or poking up at their
feet (a lamp's head) goes see-through. The player never walks up to stand where somebody else stands
(`walkToResident`, and `talkStartTile` for a linked conversation), and stands where the two figures do not overlap
on the screen: side by side first (a diagonal step across: 64 world px apart and level), then two tiles off a little
up or down the screen, then two tiles along a row; one tile along a row (the figures, about 29 px wide, would
overlap) or straight in front or behind only when nothing else is free (`TALK_SPOTS`, `talkSpotCost`); never a spot
whose way leads past the resident. The panel comes in. On a stage at least 900 px wide (a container query on the stage, so full screen
counts) it docks to the right like the build panel, as tall as what it holds, and the two stand in the town on the left; below
that it covers the bottom but always leaves a strip of about 170 px above it where the camera frames them, so the
nod, the shake and the coins are seen on a phone too. What does not fit scrolls inside the panel with "Câu tiếp"
kept in view at its foot, and after an answer the panel scrolls the right meaning into view above it; on a phone
the review-time line is left out, and after a miss "Chưa phải…", the "Nghe lại" icon and "Rõ từng từ" share one row.
The five progress steps sit on their own line under the name, so the place name never breaks. The hearts row shows only once the first heart is won. Before the answer nothing is written: a bubble with moving bars (in the panel
and over the resident's head) while the line sounds, "Nghe lại" and "Chậm" (still connected), three reply cards under
"<name> vừa nói gì?" (keys 1 2 3). The line plays by itself about 0.7 s after the panel opens (`auto`: never a paid
request, and counted as a listen only when it really sounds); until something has sounded the cards are disabled and
"Nghe" is the primary button. After the pick: the cards lock (right / wrong; on a phone only the right one and the
picked one stay), the resident reacts (heart for a first listen on a new line, sparkle for right, a question mark
for wrong), "+N" rises over their head and coins fly to the xu counter, which counts up; the bubble shows the
sentence the way dictation shows a checked one (`SpokenSentence` compact + "Nghe lại" + a quiet "Rõ từng từ"), the
muted Ôn tập line for an enrolled miss, a line for a daily task just paid or a new title (both with confetti). One
primary button: "Câu tiếp" / "Xem kết quả" (Enter). The result card: how many lines were understood, the xu (with one
short line each for the lines, the perfect-conversation bonus and every task paid, only when more than one paid), first listens on new lines, the
hearts won, a new title; "Về thị trấn" (primary) and "Nói chuyện tiếp". Esc or ✕ leaves at any time: the audio stops,
answered lines are already saved.

**Building.** A row per lot (thumbnail, name, "<resident> · <topic>" or "còn thiếu N xu", price) and per decoration
still to buy; the decorations already bought are folded under one closed "Đã có trong thị trấn · N". With nothing
left to buy the panel says "Thị trấn đã xây đủ hết rồi." (never "Chưa đủ xu…"). The string lights' thumbnail is drawn
as two poles with a sagging string of bulbs (the whole string shrinks to a dotted line).
Exactly one row button is `.btn-primary` (`primaryBuy`: the lot that was clicked when it can be paid, else the
first affordable thing). Buying calls `buyTownItem`, then the stage `celebrate(id)`: the camera travels to the
spot, dust rises, the thing pops out of the ground with sparkles (a place also gets confetti and its resident), the
camera comes back; the xu counter ticks down and, when the thing appears, a toast says what was built. On a narrow
stage the sheet is half the stage high (the lot stays in sight above it, the HUD keeps only "Xây") and closes on a
buy so the new thing can be seen.

**Sound.** `coin`, `right`, `first`, `wrong`, `build`, `pop`, `level`, `task`: sine / triangle tones under a
second (the level-up a little longer), master gain 0.16. Never over English: `playSfx` is refused while any speech
is in flight (`currentUtteranceId()`), and a line that starts cuts what still rings (`stopSfx`). On/off is the
speaker button of the HUD, stored per browser (default on). No music.

**Keyboard and screen readers.** The canvas is `role="img"` with a label; right after it a list of real buttons
gives every action the pointer has ("Tới chỗ Emma ở Quán cà phê và bắt chuyện", "Xây Cửa hàng, 30 xu"): invisible
until one has the focus, then a pill in the stage's corner. Focus moves into the conversation panel when it opens,
onto "Câu tiếp" after an answer, and back to the canvas when it closes; the verdict and the result are said through
one polite live region; the build panel is a `role="dialog"` that returns focus to "Xây". Shortcuts are listed in
`ShortcutsHelp`.

**Theme and motion.** Day in the light theme, night in the dark one (`Settings.theme`, the system scheme when it is
"system"). The art is lit for daylight; night multiplies the world by a dusk blue (`NIGHT_TINT` in
`engine/sprites.ts`) and the people by a lighter one (`PEOPLE_NIGHT_TINT`, so faces read away from the lamps), then
lays 30% of each picture's own colour back with a 'color' blend (`NIGHT_KEEP_COLOUR`: blossom stays pink, grass
green, not one lavender wash). The world's atlases are
tinted whole while the browser is idle as soon as night is on (`prepareNight`), so the first night frames do not
stall; a person's frame is tinted the first time it is drawn (a few new copies per frame, the rest in a shared
scratch canvas until their turn); all of it is dropped back in the day. Every night copy is drawn on the CPU and
kept as an ImageBitmap (`freeze`, `SOFT`): a copy made on the graphics card had its smaller sizes made again in
every frame it was drawn shrunk, so a night frame cost four times a day frame (headless Edge: 8–49% of frames over
20 ms; now as smooth as the day). The pictures themselves are kept decoded as ImageBitmaps (`loadArtImage`): an
`<img>` was decoded again in the middle of a frame (40–125 ms) whenever the browser had dropped its decoded copy.
A bitmap is never dropped by the browser, and decoded they take about 175 MB (people 130 MB, world 44 MB, plus the
night copies), so they are kept only while the town page is open and for 30 s after it closes (`holdTownArt`:
coming straight back draws at once), then closed; the next visit decodes them again from the browser's cache. A
sprite with a light layer is drawn at night from one baked picture (the dusk body with its warm light already on,
`litSprite`); the pools of lamp light are painted once into the night ground (`groundWithPools`); the faint glow
over standing things is drawn only round lamps somebody stands or walks near (`drawLampGlow`); the sky is drawn
into its own picture 15 times a second (`skyLayer`). Enlarged (a conversation), the atlases are drawn with plain
bilinear filtering: the same look at 1.1×, and the bicubic one stalled the first frames of a conversation. The "lit" layers are warmed to amber (`LIT_WARM`) and painted over the body, then added
once more so they glow: a place's windows at `windowGlow(lit)` (a faint glow from the first day, full when every line
is understood), lamps, the stall, the construction lights and the string lights at full. Every lamp lays a warm pool
of light on the ground and a faint glow over whoever stands in it (`lampLights` in `scene.ts`); the string lights a
wide faint one over the plaza. The pools are an amber 'color-dodge', which gives the ground under a lamp its own
colours back, warmed, instead of a pale haze. Shadows are softer at night; fireflies by night (no butterflies by day:
at the game's zoom they read as stray pixels). Under reduced motion: no camera travel, no particles, no pop, the xu count changes at once;
people hold one still frame (no breathing, no walk cycle, no nod / shake / wave; walking, they glide in that
frame); emotes and the "+N" stand still for a moment instead of rising.

**The art.** Kenney's CC0 packs (Mini Characters, City Kit Suburban, City Kit Roads; licences in
`src/features/town/art/LICENSE-kenney.txt`) rendered offline by `scripts/town-art` (`npm run art:town`, about 25 s;
`-- --part world` or `-- --part characters` for one half; `scripts/town-art/README.md`) through the game's own
orthographic 2:1 camera, with one light, outline and colour filter, into WebP atlases and generated manifests. Only
the rendered images are in the repo; the 3D files stay in the git-ignored `art-src/kenney/`. Sizes: people 7.82 MB (14
atlases of 188 frames: walk 16 frames × 5 directions, idle 30 × 2, nod 13, shake 15, wave 20, the emotes
three-quarters only; 2.5 px per world px, WebP quality 0.74) + portraits 128 KB + a shared contact shadow: 7.95 MB
(7.6 MiB, under the 8 MB budget with 0.05 MB to spare: no room for more frames); world 1.13 MB (places, lots, nature, decorations, the cat with a
12-frame walk and a 24-frame sitting tail, the bus, light and shadow layers at 3 px per world px, and the whole ground as one picture
at 2 px). The player's atlas holds a brisk walk, the residents' a stroll (smaller steps, calmer arms); both carry the
body at one height (about a pixel over the idle's line, `lift`) instead of Kenney's 3 px hop (render.js `gaitClip`).
The idle, the nod, the head shake and the wave are made in render.js (`procPose`) on Kenney's rest pose, and the
arms hang in every pose (`ARM_REST`). The game adds a few touches at draw time: the bus is drawn 1.3× (`BUS_SCALE`:
it must look like it holds people) and only once the bus stop is built (it pops in with it; its two tiles stay
blocked either way); a street lamp can be mirrored (`DecorSpot.flip`) so its arm reaches over the path beside it
(tested in `townWorld.test.ts`); the flags show their pole and pennant only (`flagClip`), the rendered bunting pegged
to the ground read like a fallen tent. All 22 WebP files together: 9,074,980 bytes (about 9.1 MB / 8.7 MiB: people
atlases 7.82 MB, portraits 0.13 MB, world 1.13 MB). In the web build they are hashed /assets/ files that the service
worker does NOT precache: it stores them in their own cache (`nghe-noi-am-art`) the first time the town draws them,
keeps that cache across deploys (a picture's hashed name changes only with its content) and drops pictures the
current build no longer has. The portable build does not inline them either: `npm run portable` copies them to
`<out>/art/` next to the HTML (only new or changed files; an earlier build's pictures are removed, nothing else),
and the code loads them as `./art/<file>` (an `<img>` loads a sibling file on file://). Credit, one muted line in "Thị trấn này để làm gì?": "Hình nhân vật và nhà cửa: Kenney
(kenney.nl), giấy phép CC0."

What the stage offers the shell beyond the first engine (`TownStageHandle` / props): `focusOn`, `emote`, `act(target,
'yes' | 'no' | 'wave')`, `burst`, `walkTo`, `pointOf` (the top of the sprite's head), `float(target, text)`,
`celebrate(id)`, `focus()`, `box()`, `rect()`; state `sites` (the lots on offer); props `speaking` (the bubble
with bars over a resident, or over the player with `'player'`: the learner's own lines of an episode), `inset` (pixels a panel covers at the right / bottom: the camera centres in the rest),
`safe` (what the HUD covers along each edge: no tags there, the camera centres in the rest), `hint` (the suggested
resident), `peek` (the lot the build panel is about), `full`, `onIdleAct`.

Not there (know it before you promise it): no walking sound, no music; no pinch or wheel zoom; on a phone shorter
than about 640 px the strip above the conversation is thin (the panel scrolls); the bus does not drive in, it pops
up with the bus stop; the player wears no hard hat when building; the build animation is skipped entirely under
reduced motion; balloons, flags, the fountain and the string bulbs are still pictures (no sway, no twinkle); offline,
the town works only after one online visit to it (its pictures, about 9.1 MB, are cached on first use, not at
install: every other page works offline after the first visit of the app); nothing was checked by ear or on a real
phone (see AGENTS.md §9).

## 8. Honest limits

- **It is the app's voice.** Clear, studio-clean, one speaker. Understanding Emma here is easier than understanding
  a real person in a real café. Nothing in the town may suggest otherwise, and no text may promise native-like
  listening (`docs/progress-report.md` §6).
- **1 of 3 has a 33% chance floor.** A learner who understands nothing still gets about one line in three, and with
  it some xu (2 or 3 per lucky line; a lucky perfect conversation is 1 in 243). The harder wrong meanings (§2) raise
  the bar but do not remove the floor. So "% đúng" of Thị trấn in Tiến độ / Báo cáo is not comparable with Chép
  chính tả, and xu, level and hearts are a game score, not a measurement. The measurements stay "Nghe 1 lần là đúng"
  in Chép chính tả and Video thật, and Kiểm tra định kỳ.
- **It checks the meaning of a whole line, not every word.** A learner can pick the right meaning from two words they
  caught. Chép chính tả is where every word is checked; a line missed here goes there through Ôn tập.
- **The wrong meanings are confusable on paper** (shared words, length, kind of sentence), not by sound: the pool is
  the 21 to 26 lines of one topic, so on some lines the best wrong meaning is still easy to rule out.
- **A line met again is easier:** its meaning was shown after the earlier answer. That is why a repeat pays 1 xu.
  For the same reason a sentence answered here is never counted as "Nghe 1 lần là đúng" in Chép chính tả
  (`metInTown` in `features/dictation/DictationPage.tsx`, docs/progress-report.md §4).
- **It complements, it does not replace.** Thị trấn is the pull to come back and listen every day; decoding is
  learned in Bài học / Giải mã câu / Chép chính tả, and real listening is real video and real hours (Video thật,
  Nhật ký nghe). Time in town is not logged as real listening.
- The episodes have their own limits (§9 "Honest limits of episodes"): app voices, a 1-of-3 gist, a line of step 2
  was heard once already in the whole exchange.
- Daily tasks are per browser (§4); a day written by a machine with a wrong clock can stay in `days` and bend the
  streak; a town reset on one machine also drops another machine's town it had not synced yet (the price of making
  resets stick, as for every synced key).

## 9. "Chuyện ở thị trấn": episodes

A single sentence heard on its own, with replays, is not how speech arrives. An **episode** is a short everyday
exchange at a place (5 to 8 lines) between its resident and the learner's own character ("Bạn"), sometimes with a
neighbour dropping by; each one speaks in their own voice (`core/town/voices.ts`). Contract `core/town/story.ts`,
content `data/townStories.ts` (two episodes per place, stable ids), rules `core/town/episodes.ts`, the panel
`features/town/Episode.tsx`.

### When a conversation is an episode

Talking to a resident (`startTownEpisode` → `nextEpisode`): a **re-listen that is due** comes first (the one due longest
first), else the **next episode** of the place not finished yet (episode 1 is open from the start, episode n + 1 once
episode n is finished), else the old five unrelated lines, now called **"Trò chuyện nhanh"**. The result card of an
episode offers "Trò chuyện nhanh" with the same resident.

### The three steps of a new episode

1. **Nghe cả đoạn.** The title "Tập n · <title>", the scene in one Vietnamese line, then the whole exchange in one go:
   every line connected (`storyLinePlayback(line, episode, 'connected')`, `core/town/storyAudio.ts`: the same text and
   voice the clip generator uses), at the learner's rate (level 1 a little slower, as in dictation), a pause of 450 ms
   when the speaker changes and 220 ms when the same one goes on (`passGap`). No text. The speaker gets the bubble in
   the town: the resident, or the player for the learner's own lines (`TownStage` `speaking: 'player'`); a neighbour
   who drops by is only heard. It starts by itself 0.7 s after the panel opens (`auto`: never a paid request); where
   the browser does not let a page speak by itself (a link opened the talk, the first audio on an iPhone) nothing is
   counted and "Nghe cả đoạn" is the primary button. Then the **gist** question with 3 cards (keys 1–3), answerable
   once one whole listen has sounded (heard through, or stopped by the learner after something sounded). The right
   gist after exactly ONE whole listen, on the episode's very first listen ever, is the honest win: "Hiểu ý chính ngay
   lần đầu!", +5 xu, confetti. A replay ("Nghe lại cả đoạn") before answering takes the win away (the gist then only
   counts as "Đúng ý chính rồi."). The gist's options are shown in a seeded order (`gistChoices`).
2. **Từng câu.** Every line as in a quick chat (`Turn` of `Conversation.tsx`): played by itself, "Nghe lại" and "Chậm"
   (still connected), counted with `notePlay` / `lineOutcome`, 1 of 3 Vietnamese meanings (`storyChoices`: the wrong
   ones from the other lines of the same place's stories, the same episode included, ranked by `choicesFor`), then
   the decoded line (`SpokenSentence`) with "Nghe lại" and "Rõ từng từ" (careful, in the speaker's voice). The ask
   names the speaker ("Emma vừa nói gì?", "Bạn vừa nói gì?" for the learner's own line). A miss enrols its own review
   card `talk:<line id>` (docs/review-system.md §14) when it has none.
3. **Nghe lại liền mạch.** The whole exchange once more without stopping (it starts on the click of the last line's
   button), then the result card and the transcript: the gist on the first listen ✓ / ✗, "Hiểu x/n câu" (✓ all, ✗
   none, a neutral mark in between), the xu with where they came from, when the episode comes back ("Emma sẽ kể lại
   chuyện này ngày mai để bạn nghe lại."), then every line with its speaker, decoded, its meaning and a ▶, "Nghe lại cả
   đoạn", and one muted honest line: "Đây là giọng đọc của app: rõ hơn người thật nói ngoài đời…". Leaving during the
   last listen leaves the episode unfinished (its answered lines are saved); the next talk starts it again from step 1.

### Re-listens (spaced re-listening)

A finished episode comes back for a short **re-listen**: the whole exchange once and the gist, nothing else, then the
transcript. Due after 1, 3, 7 and 21 days (`RELISTEN_DAYS`), counted in local days from the day of the last whole
listen that counted (due from the start of its day). A right gist moves it a stage on; a wrong one brings it back the
next day at the same stage (`RETRY_DAYS`). After the fourth right re-listen nothing more is scheduled. A due re-listen
has its own marker over the resident (a green bubble with a round arrow; an episode to hear has a violet bubble with
three dots) and the main button says "Nghe lại chuyện với Emma"; an episode to hear says "Tới gặp Emma · Tập 1" /
"Bắt chuyện với Emma · Tập 1" (`talkPrompt`). The suggested resident (`suggestedPlace`): a due re-listen first, then an
episode to hear (episode 1 before 2), then lines not understood, then repeats.

### Rewards

| What | Xu |
| --- | --- |
| a line of an episode | as any line (3 / 2 / 1 / 0, §3) |
| the gist right after one whole listen, on the episode's very first listen | +5, once per episode |
| the first finish of an episode | +10 |
| a re-listen with the gist right | +3 |

A finish and a re-listen count as a conversation for "Trò chuyện với 2 người dân"; every line counts for "Hiểu 8 câu"
and "Hiểu 4 câu ngay lần nghe đầu" like a line of a quick chat. Lines of the episodes count for xp (the level) like any
line (`storyTotals`); hearts and lit windows stay on the place's own sentences, so a new episode never takes a heart
away. A perfect first run of a 6-line episode pays 6 × 3 + 5 + 10 = 33 xu without the daily tasks.

### Stored

`episodes[episodeId] = { stage, at, okAt, firstGist, bestLines }` in the town progress (§4): `stage` 0 = begun (the gist
answered), 1 = finished, +1 per re-listen whose gist was right (at most 5); `at` = the last whole listen that counted
(the finish or a re-listen); `okAt` = the last of those whose gist was right (the finish counts); `firstGist` 0 = not
asked, 1 = not right on the very first listen, 2 = right on it; `bestLines` = most lines understood in one run. The
next re-listen is derived (`episodeDueDay`: `at > okAt` → the next day, else `RELISTEN_DAYS[stage − 1]` days after
`at`), never stored, so the merge stays a max per field.

### Store calls (`core/town/store.ts`)

- `startTownEpisode(placeId)` → `{ ok: true, place, episode, mode: 'new' | 'relisten', turns: [{ line, choices, who,
  speaker }], gist: { options, answer }, met, firstListen }` or `{ ok: false, reason: 'unknown' | 'empty-lot' | 'none' }`
  ('none': nothing waits, the quick chat). Writes nothing.
- `recordEpisodeGist(right, passes)` → `{ right, firstWin, reward, tasksPaid, earned, balance, result, progress, saved }`;
  a re-listen ends with it (`result` set). Answered twice: the first answer is returned.
- `recordEpisodeLine(line, outcome)` → a `TownAnswerResult` (as `recordTownAnswer`; `review` = the `talk` card
  enrolled, `conversation` null). A line answered twice in one run is recorded once.
- `finishTownEpisode()` → `{ episodeId, placeId, mode, gistRight, gistFirstWin, lines, linesRight, lineXu, gistXu,
  finishXu, tasksPaid, earned, balance, firstFinish, stage, nextDue, daysToNext, levelTitle }` once every line is
  answered (null before); the second call returns the same result.

### Audio

Each line sends `storyLinePlayback` (the connected text: authored `say`, else the decoder's speakText, else the
written text; "Rõ từng từ": the written text at `CAREFUL_RATE`) with the speaker's voice (`SpeakOptions.voice`), so
the shipped clip for that text AND voice plays (`audioKey(mode, text, voice)`, docs/audio.md). Until the owner runs
`npm run audio:generate` for the episodes, their lines play the browser voice of the speaker's gender: never a paid
request unless Settings chose the AI voice.

### Honest limits of episodes

- **App voices, not people.** Several voices are better than one, but they are still studio-clean TTS. The result card
  says so; nothing promises native-like listening.
- **The gist is 1 of 3.** The first-listen win has a 33% chance floor like every pick here; it is a game moment, not a
  measurement.
- **A line in step 2 was heard once already** in the whole exchange (without text): its "first" outcome means one play
  of that line on its own after that, and the verdict may still say "nghe một lần đã hiểu".
- **Re-listening knows the story.** By the first re-listen the learner has read the transcript; a right gist then says
  the exchange is still followed at speed, not that it was decoded from scratch.
- **Two machines** that each finish an episode before a sync are each paid its first finish (+10), as each would be
  for a new line. The merge keeps the higher of everything, including `firstGist`.
- Not checked by ear: the pauses between turns, the voices and the clips themselves (none are generated yet).
