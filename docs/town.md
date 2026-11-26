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
| **Engine** (pure, tested, no drawing) | rules, numbers, stored progress, sync merge, what a line pays, what can be bought, which lines are said, the three meanings, the episodes and their schedule (§9), the game loops: fishing, the farm, eggs, the wardrobe, achievements, town projects (§10) | `src/core/town/{types,progress,economy,daily,visit,overview,store,story,storyLines,episodes,fishing,farm,eggs,wardrobe,unlocks,gameStore}.ts`, `src/data/{town,townStories,townGame}.ts` |
| **Shell** (the game on screen, §7) | the world layout (tiles, where each place and decoration stands), walking, drawing (real-time 3D with three.js, everything built in code, §7; 2D canvas layers for tags and the sky; DOM for the panels), the conversation panel, the build panel, celebrations, sound effects, all UI text | `src/data/townWorld.ts`, `src/core/town/map.ts`, `src/features/town/` |

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

The ten paid places are **empty lots** until the learner builds them, in any order he likes. Their residents are in
town from the first day all the same: they lodge at the boarding house ("nhà trọ", §7 "Life") and **can be talked to
like anybody** (`canTalk`: any place with lines; quick chats and episode 1, since 2026-11-20). The three free places
hold 70 lines; all 300 can be heard from the first day. What building adds is in §3 "What building adds".

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

Since 2026-11-22 this is the fallback: a line with a sound-alike gets the meaning of what a careless ear hears
instead, and one line of each conversation is typed rather than picked (§13).

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
- **A line of an episode is never a first listen** (§9, since 2026-11-21): in step 2 ("Từng câu") every line was
  already heard once in the whole exchange. Its `first` outcome (one play of it on its own) is kept as `replayed`
  (`keptOutcome`, `./economy`): the line's record reaches `best` 1 at most, the day's `first` counter does not move,
  and it never counts for "Hiểu 4 câu ngay lần nghe đầu", the first-listen achievements and project, the xp or the
  town's stats (`storyTotals` has `first` 0). It still pays the game's xu (§9 "Rewards"). Only the lines of the quick
  chats (and fishing's own `fishFirst`, §10) can be first listens.

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
- **Daily tasks** (`core/town/daily.ts`), three a day drawn from a pool (§10 "Daily tasks"), paid once each per local
  day and browser, by themselves at the moment they are reached (no "claim" step). The conversation tasks of the pool:

  | id | Label shown | Goal | Xu |
  | --- | --- | --- | --- |
  | `talk` | Trò chuyện với 2 người dân | a conversation finished with 2 different residents | 5 |
  | `lines` | Hiểu 8 câu | 8 right answers (replayed ones count) | 8 |
  | `first` | Hiểu 4 câu ngay lần nghe đầu | 4 `first` outcomes of quick-chat lines (never an episode's line, §2) | 10 |

- **Streak** (`townStreak`): consecutive local days with at least one line answered in town (any outcome, any
  machine), ending today, or yesterday when nothing was answered yet today. Same rule as `currentStreak`. It pays
  nothing: it is only shown.

A first evening, for scale: one perfect conversation is 5 × 3 + 5 = 20 xu, and with it "Hiểu 4 câu ngay lần nghe đầu"
(10) or "Hiểu 8 câu" (8) is reached on a day that draws it: the first lot (Nhà, 20) or two decorations are affordable
after one or two conversations.

### Buying

`balance = xu earned on all machines − the cost of everything bought`, never shown below 0. `canBuy(progress, id)`
refuses with a reason: `unknown` (no such place or decoration), `owned` (already built or bought; the three free
places always are), `poor` (with `missing` = xu still to earn). `buy` is immutable and only adds the id to the
purchases; nothing is ever un-bought or refunded.

### Level, hearts, lit windows (derived, never stored)

- **xp** = 3 per line understood on the first listen + 2 per line understood only with replays; a line of an episode
  is 2 (never a first listen, §2). Playing never lowers it. (Once, on 2026-11-21, it went down for lines of episodes
  that older builds had recorded as first listens: they count 2 now, so a title can come a little later than it did.)
- **Titles** (`TOWN_LEVELS`): 0 Khách lạ · 15 Người quen · 40 Hàng xóm · 80 Cư dân · 150 Người của thị trấn ·
  300 Thị trưởng. `TownLevel` = `{ index, title, xp, nextAt | null, nextTitle | null, progress 0..1 }`.
- **lit** (0..1) of a place = the share of its lines understood: its windows light up with it.
- **hearts** (0..5) = friendship with its resident, from the same share: a heart at 10 / 30 / 50 / 70 % and the fifth
  only when every line is understood. With 21 to 26 lines per place the first heart comes with the third line.
- **marker** of a resident, their place built or not: `new` = it still has lines not understood, `repeat` = all
  understood, some only with replays (worth hearing again for the first listen), `heart` = every line understood on
  the first listen.
- Lines answered with a lodger count for all of these like any other. Hearts grow and show in the conversation panel
  for a lodger too; the lit windows show once the house stands (`stageStateOf` lights only built places), already
  as bright as the lines understood while lodging.

### What building adds (2026-11-20)

Since every resident talks from the first day, a lot is no longer the way to new lines. Building one is the
resident's **home**:
- they move out of the boarding house into it (`moveIn`, §7 "Life"), its windows light up with the share of their
  lines understood (the town at night shows who has a home and how well the learner knows them);
- **episode 2 of a place is told at home** (`HOME_EPISODE_FROM` = 2, `needsHome`, `isEpisodeUnlocked`): it opens
  once episode 1 is finished AND the place is built. A lodger who finished episode 1 has `homeEpisode` in the
  overview (§5): the build panel can say "Grace dọn về ở, mở ngay Tập 2: …" (`homePerk`).

Why this and not a bonus: a purchase never pays xu back (every xu comes from listening: the one rule at the top),
and capping hearts or xu for lodgers would take away what was earned. Episode 2 is real content (10 places × (≈6 lines + 5 gist + 10
finish) ≈ 10 × 33 xu on a perfect first run), so it is a reason to build without changing a single number of §3:
xu per conversation are the same as before, only the pool of new lines is larger from the start (the whole town
still costs 890; its 300 lines alone pay 900 on the first listen). The conversation bonus, the daily tasks
(`talk` counts a lodger as a resident; `episode` enters the draw while any episode 1 or an episode at a built place
is left: `eligibleTasks`) and xp count a lodger's lines like any other.

## 4. Stored data and its merge

Synced key `town-progress` (`KEYS.town`), parsed defensively (`parseTownProgress`: junk reads as an empty town,
never as a crash; `__proto__`-like keys are refused):

```ts
{
  version: 5,
  lines:  { [lineId]: { best: 0 | 1 | 2, tries: number, at: number } },
  earned: { [deviceId]: number },                 // xu, one bucket per browser
  bought: string[],                               // place ids + decoration ids, sorted
  daily:  { [day]: { [deviceId]: { talks, lines, first, met: string[], paid: string[] } } },
  days:   string[],                               // local days with a line answered (the streak)
  episodes: { [episodeId]: { stage, at, okAt, firstGist: 0 | 1 | 2, bestLines } },   // §9
  // version 4, the game loops (§10 "Stored"): fish, farmDays, eggs, owned, look, unlocks; daily rows get optional
  // counters fish, fishFirst, fishXu, harvest, eps, perfect
  // version 5, friendship (§12 "Stored"): friends, facts, choices, gifts; daily rows get optional sets bond, gifted
  // version 6, typed checks (§13): typed: { [deviceId]: { n, ok } }
}
```

`lines` holds the lines of the episodes too (`cafe-1-03`), recorded like any line except that one is never kept as a
first listen (`best` 1 at most since 2026-11-21; a 2 written by an older build is read as 1, §2).

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
| `friends` (v5) | per resident, side (`up` won / `down` lost) and device: max (§12) |
| `facts` (v5) | union, min of the first time |
| `choices` (v5) | per choice line: the earlier choice; the same time: the smaller option id |
| `gifts` (v5) | `bought` / `given` per gift and device: max |
| `typed` (v6) | `n` / `ok` per device: max (each browser only adds to its own bucket, §13) |

Idempotent, commutative, associative, caps included ("the newest N keys of a union" does not depend on the order of
merging): `syncMerge.props.test.ts` checks the laws on random towns, junk, version 1 and version 2 values and junk
episodes.

Consequences worth knowing:

- **Version 1** (`{ version: 1, lines }`, the first evening of the feature) loads and merges as it is: the lines and
  the level stay, xu start at 0. No xu are granted for lines understood before; those lines now pay 1 xu per right
  answer.
- **Version 2** (before the episodes) loads and merges as it is, with no episode begun; the next write saves version 3.
  A machine still on a version 2 build reads a version 3 value without its episodes and writes it back without them;
  the sync merge brings them back from the other copy (a union), so nothing is lost once both machines run the
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
  places: [{ place, built, cost, affordable, missing, stats, hearts, lit, marker, episode, homeEpisode }],   // in listed order
  // marker: 'new' | 'repeat' | 'heart', for every resident (a lodger too)
  // episode: { id, order, title, mode: 'new' | 'relisten' } | null: what a talk with the resident is now (§9), lodgers too
  // homeEpisode: the same shape | null: not built, and the next episode waits for the house (§3 "What building adds")
  decorations: [{ decoration, bought, cost, affordable, missing }],
  built, decorated, canBuySomething,
}
```

`affordable` is only true for something not owned yet. `missing` = xu still to earn (0 when owned or affordable).

## 6. What the shell calls: `core/town/store.ts`

- `useTownProgress()` / `useTownOverview()`: live, stable while nothing changed (another tab, account sync and a
  restore are picked up: every read compares the raw stored string).
- `startTownConversation(placeId)` → `{ ok: true, place, turns: [{ line, choices }] }` or `{ ok: false, reason:
  'unknown' | 'silent' }` ('silent': a place with no lines). A lodger (place not built) talks like anybody. Five lines with their meanings already drawn. Starting again drops a conversation left
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
form a conversation after five different lines of one place; a refused save (blocked or full storage) keeps
everything for the session (`saved: false`) and is written with the next save that works.

## 7. The game on screen (`src/features/town/`)

One route, `#/town`. Optional params: `talk=<placeId>` opens straight into a conversation with that resident when
the place is built (the player starts beside them; the param is dropped from the address when the conversation
closes), `build=<placeId | 1>` opens the build panel (on that lot), `activity=<id>` an activity's panel. Dev builds
only: `r=flat` shows the page as a browser without 3D sees it (below, "Without 3D").

Since 2026-11-21 the world is drawn in real time with three.js (the owner found the sprite town "cheap" and its
animation poor, and asked for a bigger town: 44 × 44 tiles; since 2026-11-22 that town is the middle of a 72 × 72 island
of countryside, "The countryside" below). Everything in it is built in code at run time: no model,
no picture file, nothing rendered offline.

| File | What it is |
| --- | --- |
| `TownPage.tsx` | the page: wires the store to the stage, owns "a conversation is open / the build panel is open", plays the celebrations; tells the stage when there is no 3D (`flat`); draws the conversation portraits and makes the sound effects' audio context ahead in idle time; frees the offscreen renderer and the shared character materials, hats and props when it leaves |
| `engine/` | what is not drawing: `sim.ts` (walking, everyday life, conversations, who stands near whom; tested), `life.ts`, `gait.ts`, `stage.ts` (the page ↔ stage contract: `TownStageProps`, `TownStageHandle`, `Near`, `SafeInsets`…), `draw/overlay.ts` (name tags, bubbles, emotes, the sky: Canvas 2D layers over and under the 3D canvas), `particles.ts`, `palette.ts` (the colours of those layers and `HUD_ART`), `spring.ts` (the camera's easing), `extraDecor.ts` (where the town projects stand). No game rule in it |
| `three/TownStage3D.tsx` | the stage: the sky canvas, the WebGL canvas, the overlay canvas, input (click / tap to walk, arrows / W A S D, E / Enter / Space, pinch zoom, wheel zoom in full screen, with Ctrl / ⌘ or once the canvas has the keyboard, right-button drag to turn), the handle; a lost graphics context gets 3 s to come back (the town is built again), else the page goes on without the world; with `flat` the same box without the canvases (no 3D): one component either way, so an open panel stays mounted when the world goes |
| `three/scene/` | `engine3d.ts` (the loop: sim, people, camera, overlay, adaptive quality), `cameraRig.ts` (the camera as pure numbers, tested), `world3d.ts` (the scene: ground, nature, places, lots, props, decorations, projects, lights), `terrain.ts`, `places3d.ts` + `kit.ts` (the thirteen places, the boarding house, construction sites), `props3d.ts` (the fixed things, the decorations, the projects), `nature.ts`, `layout.ts`, `materials.ts`, `palette3d.ts` (colours and the day / night light rigs), `pick3d.ts` (what is under the pointer), `merge.ts`, `coords.ts` |
| `three/chars/`, `three/characters.ts` | the people and pets (contract `three/contracts.ts`): one skinned toon-shaded body each, faces from one shared atlas, hair styles, the nine hats, the eight pets and the cat, props (cup, can, rod, book), the animation brain (`anim.ts`, tested), portraits |
| `three/offscreen.ts`, `three/thumbs.ts`, `three/loot3d.ts` | the 3D pictures shown outside the stage, all drawn by ONE shared offscreen renderer and copied onto 2D canvases (a browser keeps only a few WebGL contexts): portraits (`chars/portrait.ts`), the build panel's thumbnails, what an egg hatched and the wardrobe's live preview |
| `three/webgl.ts` | can this browser draw the town (WebGL 2 on a real graphics card)? |
| `TownHud.tsx` | what floats over the town: the title with its xp bar (top-left); streak (from 2 days), xu, "Chơi" (the activities, shared `Popover`), "Việc hôm nay" (shared `Popover`), "Xây", sound on/off, "Toàn màn hình" (top-right; on a phone the five buttons go down the right edge) |
| `ActivityHost.tsx`, `activities/` | an activity's panel over the stage (§7 "Activities"): the frame (title, ✕, Esc, focus, the camera's inset) around `PANELS[id]` of `activities/registry.ts`, each panel lazy and owned by its activity |
| `Conversation.tsx` | the quick chat panel ("Trò chuyện nhanh", docked right on a stage ≥ 900 px wide, over the bottom below that): five lines, then the result card; its `Turn` (one line heard and answered) is shared with the episodes |
| `Episode.tsx`, `episodeModel.ts` (tested), `useStoryPass.ts` | an episode of "Chuyện ở thị trấn" (§9) in the same panel: the three steps or a re-listen, the transcript; what each line sends, the pauses, the words; the whole exchange in one go |
| `talkKeys.ts` | what both panels share: the delay before a resident speaks, which key presses are not theirs |
| `BuildSheet.tsx` | "Công trình" (empty lots) and "Trang trí": a side sheet on a wide stage, a bottom sheet under 720px |
| `shellModel.ts` (tested) | the shell's own small decisions: what the stage is told, whom to suggest, the verdict words, the result sums, the labels |
| `sfx.ts` | sound effects as short Web Audio tones (no files) |
| `townUi.ts` | `KEYS.townUi` (`town-ui`, device-local): `{ sound, welcomed }` |
| `art.tsx` | game pictures as DOM: coin, hearts, a person's portrait (the 3D character rendered head and shoulders, neutral / happy, cached per size and mood; without WebGL the first letter of the name) |
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
("!", "…", a heart) comes with it. Tags are painted on the overlay canvas in screen pixels (13 px text whatever the
zoom), most important first and never over one another (`placeTags` in `draw/overlay.ts`, tested); they stay out of
the stage's edges and of what the HUD and the panels cover (`safe`, measured on the page by `useStageInsets`); a
person too near the top gets the tag under the feet, without its marker. Somebody off the stage has no tag. An episode
waiting at a place puts its own marker there instead (`markerOf`): a violet bubble with three dots (an episode to
hear), a green one with a round arrow (a re-listen due).

**The camera** (`scene/cameraRig.ts`, tested; `engine3d.ts aim / goal`; rebuilt 2026-11-21 after the owner played the
3D town and found the camera "pans all over the place" and the player not in the middle). A perspective camera with a
low field of view (28°, so the town reads like a model on a table) looks down at 33° from the town's south-east (yaw
π/4: doors face it; 37° until 2026-11-21, lowered so the houses and trees round the player show, not only the plaza's
paving). Its resting distance keeps a grown-up (`PERSON_HEIGHT` 0.75 tile; since the legs grew on 2026-11-21 a
grown-up stands about 0.79, so 5% taller than these figures) about a ninth of the stage high: 75 CSS px on a laptop's
stage (1224 × 672), 60 px on a 390 px phone (`personPx`: the stage height / 9, the width / 6.5, 48…100 px; an
eighth until 2026-11-21, when a critique found people too small to read; a fifth until 2026-11-22, when the owner
found every first look "sát rạc": the learner zooms in with the wheel or a pinch). The zoom and the turn are the learner's
alone: a pinch zooms within 0.55…1.9 of that, and so does the wheel in full screen, with Ctrl / ⌘ held, or once the
canvas has the keyboard (a click or Tab put it there): else the wheel scrolls the page past the town. A right-button
drag (the middle button too, or two fingers) turns the view all the way round (until 2026-11-22 only 60° either way:
the owner asked for 360°; `yawAfter`); the keys turn with it: up is always away from the camera. Seen from the back
the houses show their plain walls (doors, signs and most windows are on the two faces the default view sees), and a
talk outside stands its two side by side on the screen only from the default view.
- **In free play it follows the player and nothing else.** What it looks at is the player (`followPoint`: a point
  `FOLLOW_LEAD` 0.073 s ahead of them along the way they go), eased by a critically damped spring of `FOLLOW_W` 11
  (`springStep`, no overshoot: the lead, on the pace smoothed at 40/s, stays at 0.8/ω), so the player stays in the
  middle of what the HUD and a panel leave free (`insetShift`; on a phone the column of buttons counts too) with a
  short lag: about 0.1 s behind a walker, a few hundredths of the stage off the middle at a run. There is no framing
  of the suggested resident, no pull toward a lot on offer or the build panel's lot (the `peek` prop is gone), no "keep in
  view" ramp, no carrying of steps: a still
  player under a still camera means nothing on the screen moves (the spring comes to rest exactly, within a fifth of a
  pixel). The town opens with the player in the middle at the resting zoom. Over the island's edge it holds back
  (`clampToIsland`), but never more than `EDGE_HOLD` 1.2 tiles off the player. In full screen on a big screen it backs
  off to the whole built town (`builtFit`, at most 1/0.62 of the resting distance), still on the player.
- **Shots only when the learner asks**: a conversation frames the two (below, "A conversation"), a new building gets a
  short glide there and back (`celebrate`), the overview button shows the whole town. The way there and back is a
  glide (`GLIDE_W` 7, softer over more than 3 tiles, down to `FAR_W` 3.5: a long way is a glide of about a second,
  never a whoosh or a cut), and back on the player the spring firms up to the follow over `FIRM_SECONDS` 0.6. A glide
  step is never more in one drawn frame than 1.5 of the display's usual frames (`cameraDt`: a late frame is a short
  pause, not a jump); following the player the camera keeps the sim's own time, so a late frame moves the two
  together. When a conversation begins or ends the camera holds still for 3 frames and 0.12 s; a new conversation's
  panel comes up 150 ms after the camera starts gliding (`PANEL_DELAY_MS`, rendered as a React transition, in slices
  between frames), the next one in the same panel at once.
- Until 2026-11-21 the camera framed the player with the suggested resident (backing off up to 1.45×), carried the
  player's steps frame by frame with a separate spring for the framing, pulled the player back inside 72% of the view
  (`keepInView`) and showed the build panel's lot: several goals fighting, the "pans all over the place" the owner
  saw. The suggested resident is still put by their own door when the page opens and they are more than 7 tiles away
  (`setHint` in `sim.ts`, within the sim's first second; tested): easy to find, though the camera no longer goes to
  them.

**Quests to follow** (2026-11-26, owner: "có hướng dẫn làm nhiệm vụ như GTA 6 không?", then "minimap cũng cần highlight
đoạn đường đi"): `quests.ts` turns what there is to do into quests (the town: every resident's next episode, a re-listen
that is due first, the suggested one on top; Westbay: today's chapters of the long stories, the suggested scene, the
week's get-togethers, everybody with a scene open, the shifts open; a city scene is never named by its title).
`QuestTracker` shows the one followed under the level (what, where, how far: `metres`, a tile ≈ 2 m) and opens the
list; a quest picked there is followed and walked to, and the main button goes to it. The stage (`StageProps.guide`,
`engine3d.setGuide`) finds the way there twice a second (`findPath`); `MapSnapshot.guide` gives it to the minimap (a
gold line, the end on its rim when it is further) and the full map (an SVG line). Nothing is drawn over the town itself
(the gold dots on the ground and the arrows over the target and at the stage's edge went the same day, owner: "bỏ cái
hướng dẫn đường đi này ở map chính đi, chỉ hiển thị ở minimap"); so the minimap shows on a phone too (96 px, above the
main button). Checked in headless Edge only (city and town, 1280×800 and 412×892).

**More to look at** (2026-11-26, owner: "đồ hoạ cũng cần nâng cấp toàn diện hơn giờ hơi đơn điệu"; the people and the
street furniture are another session's work, so left alone here): Westbay's streets are asphalt (`TownWorld.roads`,
`three/scene/terrain.ts`: a dark top a little different tile by tile, no cobbles, a dashed yellow line down the middle
of every two-lane street, zebra crossings by every junction; the full map and the minimap draw them grey), the town
keeps its cobbled lanes; two small flocks of birds circle high over the view by day (`three/scene/birds.ts`, one
instanced mesh, home before dark, still under reduced motion). Checked in headless Edge only.

**The main story** (2026-11-26, owner: "thêm nhiệm vụ phong phú hấp dẫn hơn", "cốt truyện phải hay như GTA 6"):
"Kèo lớn ở Westbay" (`data/city/seasonsMain.ts`, a season of its own with `free`: the next chapter opens as soon as
the one before is heard). A briefcase left in Rico's taxi holds Mr Crane's phone; Jun opens it (a fake Heritage Fund
taking five hundred pounds a stall, a bought inspector due on Friday); Crane leans on Gianna; in the town Ben learns
Frank has paid; Marcus puts it on air; on Friday Rico brings the real council and Frank tells Ben himself. Six
chapters, five in the city and one in the town (at Ben's), new voices only heard (Crane, Inspector Hale, Ms Ward of
the council: the browser's voice). Chapters 2 and 5 have a `rush` (40 and 45 seconds): the clock starts when the quest
is taken on (the card's list or the main button), the card counts down, and being late only starts it again from
where the player is (a vehicle helps). It is the quest card's first in both places. **Part 2, "Người đứng sau Crane"** (`seasonsMain2.ts`, `bigdeal`, opens
when part 1 is heard to its end): Gus's mended radio picks up Mrs Vane giving orders (Crane was her front man; she
wants the harbour); Mrs Okafor's slow ticket machine holds Crane until he talks (the careful-ear clue: warehouse
fifteen, which Rico hears as fifty); Marcus writes the plan to Tom in a letter; Vane offers Rico his dispatch office
for one quiet drive and he seems to say yes; Mei, eighty-one, gets Vane to say it all on a coin-sized recorder; Rico's
"shortcut" ends at Marcus's stage, live, with Gus shutting the harbour gate. Six chapters (one in the town, at Tom's),
two with a rush (45 and 50 seconds), written by a sub-agent and read through once here. Not heard by anybody yet; no
clips (the city speaks in the browser's voice; Ben and Sam's lines fall back to it until clips are made).

**Riding** (2026-11-26, owner: "có xe ngựa cho chạy nhanh hơn chẳng hạn", "xe/ngựa hoặc nhiều thứ khác"): bikes,
scooters, cars and a horse stand where the world parks them (`TownWorld.vehicles`; the town: a bike by the plaza and
one by the school, a scooter at the station, a horse at the farm; Westbay: cars at the taxi rank and on the harbour,
scooters on Market Street and Arts Street, a bike by the station; `data/vehicles.test.ts` keeps them on open ground,
clear of doors, spots, seats and chats). They are borrowed, not taken (owner: "chạy xe ô tô của người khác có phải là
cướp như gta không?"): a shared bike, a scooter for hire, a car of Rico's taxi firm, the farm's horse ("Mượn …", "Trả
xe"). A tap on one walks there and gets on (`rideAt`, a finger's reach round its middle); within `RIDE_REACH` 2 tiles,
E or the button (`RideButton`) puts the player on its seat (the seated
pose at the seat's height); the keys, a held finger and a click walk drive it at its pace (`RIDES` in
`three/scene/vehicles3d.ts`: bike 3.6, horse 4.4, scooter 4.6, car 5.6 tiles/s against 1.6 walking; `sim.setRideSpeed`).
E or "Trả xe" leaves it where it stands, the player beside it; a talk, a meeting or fishing gets off first. The
models are built in code (a convertible, so whoever drives is seen); nothing blocks a walk round a parked one. Checked
in headless Edge only (on, a drive, off; bike, horse, car); nobody has ridden one by hand.

**Gara: vehicles of your own** (2026-11-26, owner: "phải có mua đứt luôn chứ, tiền càng nhiều thì đồ càng xịn"):
activity `garage` ("Gara", group life, `activities/GaragePanel.tsx`) sells six vehicles for xu (`data/townGarage.ts`):
a racing bike 60 xu (4.4 tiles/s), a vintage Vespa 150 (5.2), a white horse 250 (5.6), a big motorbike 400 (6.6), a
red convertible 600 (6.8), a supercar 1000 (8.2): every dearer one faster, the cheapest faster than the borrowed one
of its kind (`data/townGarage.test.ts`). A purchase goes into `town-progress` `bought` like a decoration
(`economy.ts townItem` kind 'vehicle'; synced as a union, never un-bought). One is picked per browser (`townUi.ride`,
'' = the dearest owned; `features/town/garagePick.ts`); with nothing to borrow in reach the corner button says "Gọi
xe" ("Gọi ngựa") and `engine3d.summonRide` puts that vehicle under the player where they stand (one of your own at a
time: calling another puts the first away), in the town and in Westbay; got off, it stays parked there ("Lên xe").
Two new models (`vehicles3d.ts`: a motorbike, a low open supercar) and a fourth finish per kind for the garage's
own. With the VRoid avatars on, every vehicle is drawn 1.55 × its model and the seat with it (`rideScale`: the
avatars stand 1.85 × the code-built body the models were made for); the classic people keep 1 ×. On a stage under
640 px the button sits above the main button's row. Checked in headless Edge only (buying, calling, riding the
supercar and the motorbike, off and on, 1400 × 900 and 412 × 892); the speeds were not felt (the software renderer
runs at 2 frames a second); the prices are guesses; nobody has bought or driven one by hand.

**Chạy taxi cho Rico** (2026-11-26, the side job of a GTA-like city): in Westbay, once Rico's first episode is heard,
the quests end with "Chạy taxi cho Rico" (`quests.ts taxiQuest`). Rico radios a passenger through wherever the player
stands (`city/TaxiPanel.tsx`): they SAY where to go in the browser's voice (never a clip; `data/city/taxiFares.ts`,
24 fares, levels 1–3: a plain name, a name of their own with words round it, a change of mind / "not the …, the …" / no
name at all), the learner picks the place among three (the wrong two a careless ear would take: pharmacy / ferry,
Lumen / Loom, station / stage, the place next door). Right: a clock of `rideSeconds` (15 s + 0.5 s a tile from where
they stand, 20–70 s: a borrowed car or one's own vehicle makes it, a run only just) and the ride becomes THE quest
(its card counts down, "Còn … giây" before the distance; the way on the minimap; the main button "Chở khách tới …").
Within `TAXI_ARRIVE` 2.2 tiles of the place's door (polled 3 × a second, `CityPage`) the passenger gets out: 5 xu, +1
heard once, 2 late, nothing for the wrong place (the line, its meaning and connected speech shown, then the next
passenger). Eight fares pay a day (`TAXI_PAID_A_DAY`); what paid is the daily set `heard` of `town-progress` (ids
`tx-…`), so no new stored key. The ride lives in the tab only (`core/town/taxiStore.ts`; leaving Westbay gives it
up). The lines were written here and read by nobody else; checked in headless Edge only (a fare taken, the right
place, the countdown, set down at the door, +6), not by hand; the pay and the clock are guesses.

**Emma's orders against the clock** (2026-11-26): an order in hand starts a clock when Emma's panel closes
(`deliverySeconds`: 20 s + 0.7 s a tile from there to the one it is for, 25–80 s, `startDeliveryClock`); while it runs
"Giao đơn của Emma" is the quest followed and its card counts down (who it is for stays the puzzle: no way is drawn).
Handed over in time: `DELIVERY_RUSH_XU` 2 more xu ("· giao kịp giờ" on the card). Late: nothing lost.

**Big faces, Stardew style** (2026-11-26, owner: "stardew valley lúc nào cũng nhìn rõ được avatar", then "đảm bảo là
không che nhân vật, vẫn thấy các nhân vật trò chuyện"): in every "cảnh nghe" (`scenes/SceneFlow.tsx Speakers`: the town's
benches, radio, get-togethers, bus; Westbay's scenes and events) whoever speaks now, else whoever spoke last, is a big
rounded card (148 px, 96 on a phone) with their name on a plate under it, their face following the answer (right:
a smile, wrong: a little sad); the others small (48 px) beside it. The town's talks and episodes show the resident as a
card too (140 px, 84 on a phone, was a 108 / 60 circle), a courtship scene its partner at 132 / 88 px. All of it is
inside the panel; the camera frames the people in what the panel leaves: a scene overheard now frames the player and
those talking (`engine3d goal`, within `ASIDE_FRAME` 4.5 tiles: `sim.asideNow`), as a talk does, where before it only
followed the player and one of them could stand behind the panel. Seen in pictures from headless Edge (a bench at
1400 × 900: the three left of the panel; 412 × 892; a café episode); not by hand, not on a real phone in full screen.

**A talk you begin is a talk WITH you** (2026-11-27, owner: "tao chủ động nói chuyện, sao thành ra lại là nghe lén
rồi?"): a city scene used to be overheard even when the learner had walked up to somebody: they talked to each other
and a third person cut in. Now a line may be the learner's (`who: 'you'`, `sceneTypes YOU`): the first time through,
the talk stops on it, `SceneFlow` shows it with its meaning ("Bạn", the character's name when made), and "Nói câu
này" (or Enter) says it in the browser's voice of the character's sex (`cityAudio` `cast.you`, never a clip) and
lets the other answer; a replay plays straight through. A third person is introduced before they speak. The
questions stay on what the others said. Done as a sample of three for the owner to try: Rico's first episode,
Jun's first (with Gus) and Leo's first visit (with Theo); the other city talks are still overheard. Content tests
count the cast's lines without the learner's (`city.test.ts cast`); a learner's line is 2–12 words, only in a talk,
never the last. Leo's changed lines have no Gemini clip until the owner runs `npm run audio:generate` (the browser's
voice of his sex meanwhile). Checked in headless Edge (Jun: the turn, "Nói câu này", the next turn); not by hand.

**Moving about** (the player's control, `TownSim.steer / move` in `engine/sim.ts`, tested; rebuilt 2026-11-21 after the
owner found the keys "delayed or not going where I want" and the character moving unnaturally). Direct control, like a
cosy game:
- **The keys** (arrows / W A S D) give a way relative to the camera (`keyDirection`: up = away from it on the screen,
  right = screen right; two keys a diagonal, of length 1), recomputed every frame (a turn of the view turns it). The
  player goes that way continuously (no tile to tile, no tile asked for ahead): full pace in `PLAYER_ACCEL` 0.09 s,
  and letting go stops them where they are in `PLAYER_STOP` 0.07 s (no finishing the tile). Shift runs. Any key
  cancels a click walk at once.
- **A finger held** (2026-11-25, owner: on a phone "phải click từng chút từng chút"): one finger held still `HOLD_MS`
  220 ms, or dragged more than `DRAG_PX` 12 px (`TownStage3D`), steers the player towards the ground under it every
  frame, like the keys (`engine3d.holdAt / holdEnd`, `holdDirection` in `cameraRig.ts`: the ray through the finger met
  with the level the player stands on); farther than `HOLD_RUN` 4 tiles they run, within `HOLD_DEAD` 0.35 they stand.
  Lifting the finger stops them; a second finger ends it (a pinch); a quick tap still walks to what was tapped. In
  full screen the canvas is `touch-action: none` (any drag walks); in the page a vertical drag still scrolls it.
- **The body** turns toward where it will really go at `PLAYER_TURN` 16 rad/s (90° in about 0.1 s), and the walk goes
  the way the body faces (no crab walk): within 60° of the way, full pace; a sharper turn is an arc at a lower pace; a
  half turn turns on the spot first (about 0.1 s). The drawn body follows the sim's turn closely (its spring is 38 for
  the player, `Animator.turnWalk / turnStand`, 18 / 11 for everybody else). Stopped, the player keeps facing the way
  they went (`holdYaw`) and turns three-quarters to the viewer only after standing `SETTLE_AFTER` 1.5 s.
- **Walls**: the player is a circle (`PLAYER_RADIUS` 0.22 tile) among the town's colliders (`moveCircle`, below):
  along a wall it slides, round a corner or a post it rounds it, and the body turns along the slide (`wayAlong`).
  Nearly head-on into a wall it stands (it does not shoot off along the wall); with a way past just beside it (a
  house's corner, a gate: up to 0.4 tile to the side) it sidesteps into it, the body half turned. Never into anything
  solid.
- **Only what you can see blocks, and only as much as it is big** (`core/town/colliders.ts`, 2026-11-21, after the
  owner found the keys stopping on the open plaza: "mày xây tường à?"). The colliders depend on the town's state
  (`walkWorld(world, state)`: built places, lots on offer, decorations bought, projects; cached per state, so the
  same state is the same world object): a built house is its walls plus its doorstep and what stands by the door
  (`PORCH` 0.3), the pavilion a circle, the bus stop its shelter and sign pole (the back of its lot is grass), the
  notice board a thin board; a lot on offer its fenced site; a lot left to nature only its trees and stone; a fixed
  prop, a decoration once bought (never before), the scenery and the town projects each its own shape (a lamp post
  or a flag pole a circle of about 0.1, a bench 0.74 × 0.26, a flower bed 0.42 round, the fountain 0.66 round); a tree
  stops a body past its trunk, under its lowest branches (`TREE_R`: 0.27 × its size, a pine 0.33); the water's tiles
  and the map's edge as whole tiles. Nothing else: an empty decoration spot and the plaza's middle before the fountain
  is bought are open ground. The scenery the data always had (the farm's barn, its well and hay bales, the front
  gardens' fences and hedges, stones, bushes, ducks) was never drawn in 3D and blocked anyway; it is drawn now
  (`buildScenery` in `scene/props3d.ts`). Tree positions and a nature lot's corner come from one function for both
  the scene and the colliders (`treesOf`, `lotNature`).
- **The path finder's grid** (residents, passers-by, the cat, click walks: `map.ts`) is made from the same
  colliders: a tile is closed when one comes within `GRID_CLEAR` 0.2 of its centre (a post on it closes it, a tree
  leaning in from the next tile does not). The player's body may stand on a closed tile beside a post; a click walk
  then starts from the open tile next to it (`TownSim.from`). A diagonal step goes where both tiles it passes between
  are open, or where a body (`BODY_RADIUS` 0.22, 0.04 to spare) fits all the way along the straight line between the
  two tiles' middles among the real colliders (`canStep` / `lineFits`, cached per tile): two trees standing corner to
  corner leave a way the keys could always take, and now the residents and a click walk take it too (until
  2026-11-21 they did not, which left pockets the body reached and a click never did: 10,19 in the park's lot left to
  nature, 0,27–0,28 behind the garden project). A walker's straight lines (`lineClear`) allow such a squeeze within
  one tile or one such diagonal step (`squeezeClear`); a click walk whose last tile has somebody standing on it ends
  beside them (it never pushed into them, and stood oscillating half a tile off).
- **Something built or bought where somebody stands** (`TownSim.makeRoom`): the player's body steps out to the
  nearest point it fits (`nearestFit`) and a click walk through it is planned again; a resident, the cat or a
  passer-by on a tile now closed steps to the nearest open tile and starts afresh. Seated people stay.
- **Checked** (`three/scene/colliders.test.ts`): for four states (the first day with every lot a site, with three
  sites, half built, everything built and bought) every solid model the scene builds has colliders whose box matches
  its footprint at body height (0.04 to 0.8 tile) within 0.26 tile, every collider has a model, and the loose things
  (lilies, balloons, the string lights, the pier and the projects over the water, ducks) have none; in those states
  and with every town project built, the path finder reaches from the start exactly the open tiles the body reaches
  (both ways: no pocket a click cannot get to, no tile a click is sent to that the body cannot reach), and what the body
  cannot reach is shut in by trees, a lot's nature or a project, never a street or the plaza; and keys held in 8 directions from every other plaza and path tile only ever stop with something touching
  the body. In headless Edge with the GPU (2026-11-21) the same key walk with real key events found no stop with
  nothing there (numbers in the handoff of that day). A dev-only overlay draws the colliders and the closed tiles
  over the 3D view (`window.__town3d.debugColliders(true)`).
- **People**: nobody slows the player by prediction or a waiting rule. They keep `MIN_GAP` 0.5 tile from everybody
  (never nearer than that, or than they already were); somebody met head on is walked round on the side the player
  already leans to (when there is room for the body there); somebody standing right in a narrow way, pushed into for
  `PUSH_ASIDE` 0.4 s, steps aside (`stepAside`). Residents and passers-by give way as before (Motion below).
- **A click walk** keeps its A* path (`smoothPath`) and moves by the same rules (same start, same turning), steering for
  a point `CARROT` 0.45 tile on along the path, never faster than the body can turn onto a point close by (no circling
  it), and braking on the distance left so it stands exactly at the end (`PLAYER_ARRIVE` 0.14 s). A long one is run
  (`RUN_FAR`). Making no way for `STALL_REPATH` 0.3 s (somebody in a narrow way) it looks for another way or asks them
  to step aside, and after `SQUEEZE_AFTER` 1.5 s squeezes past.
- **"Đến ngay"** (owner, 2026-11-23): while a click walk has more than `HURRY_FROM` 6 tiles to go (kept until
  `HURRY_UNTIL` 1.5), the stage says so (`onFarWalk`) and the page puts "Đến ngay" at the foot of the stage in place of
  the main button. A click on it (`hurry`): a short dip to dark and the walk is over (`TownSim.finishWalk`: the
  player at its end facing the way they were going, what it was for done: an activity's panel, a lot's sheet). A talk
  walked to (staging): outside, the one talked to is put at their spot too; inside, the room comes at that same dark
  (no second dip). Checked in headless Edge only (a ground walk, a talk walked to the café; 1600×900 and 390×844).
- **E / Enter / Space** act on what is within reach of where the player stands now (`nearNow`): an activity's spot or a
  lot's gate within 0.8 tile, else the nearest resident within `TALK_REACH` 1.6 tiles. The main button shows the same
  once the player has stopped (no flicker while walking past people).
- Measured 2026-11-21 in headless Edge on the owner's laptop GPU (ANGLE / D3D11), real key presses and mouse moves over
  CDP, every frame recorded (rounds of 13 scenarios: a tap, a held key, from facing away, a diagonal, quick 90° changes,
  Shift, a house's corner, along its face, through people, a click walk taken over by a key, the mouse over the ground,
  a conversation by E and back), stage 1225 × 672 at 60 fps: a key down to over half the pace in 35–48 ms (105–114 ms
  from facing the other way: the half turn first), a key up to under a tenth of it in 48–63 ms walking (about 90 ms
  running); a 90° change moving the new way (within 30°) in 48–64 ms; the player at most 2.7% of the stage's width or
  height off the middle of what is free walking, 4.6% running; 0 camera moves while the player stood still with no
  input; the hovered square changed tile only where the pointer crossed a tile (0 flips back), never shown with a key
  held; a conversation's camera back on the player 0.5–0.6 s after Esc, at most 13 px of camera travel in one frame.
  On a 390 × 844 phone (stage 343 wide) walking keeps within 5.3%, but a run across the screen lags 9–14% of the
  narrow stage's width (about 32–47 px). Some rounds had single frames of 0.1–0.5 s (other work on the laptop; a quiet
  30 s walk had none), which delay a stop by that frame. Not watched by a person; the body leans briefly up to 55° off
  its way when it sidesteps a corner or squeezes past somebody.

**No wedges in the woods** (2026-11-21, after a playtest got the player stuck for ten seconds between the trunks by the
hill and at the island's south edge). `engine/noWedge.test.ts` walks a body to every point of a quarter-tile lattice it
can reach from the start and holds the keys each way from every point near a tree: none may leave it stuck in four
directions or more (before the fix: one such point, 4.9, 40.9). That day's fix made a tree with another right beside
it block its WHOLE TILE (`forestColliders`); it is gone, see the next paragraph.

**Nothing unseen stops a walk** (2026-11-25; the owner, with two screenshots: "có nhiều chỗ nhìn thoáng mà đi vào lại
bị kẹt, rất nhiều chỗ như vậy"). Measured before: a key held straight at a tree with open ground behind it stood still
1,788 times in 8,086 (22%), at a boulder every time, and 140 spots in the woods let a body in and not out. Four causes,
each fixed (`engine/noStuck.test.ts` holds a key at every small thing from 8 sides, through `wayAlong` and through
`TownSim` itself, in a town of nature lots and in one with everything built; no spot shuts a body in; a body passes
between any two map trees):
- the forest blocks: a tree beside another shut its tile (0.8 × 0.8) with nothing to see, the stop half a tile from
  any trunk. Removed;
- a tree stopped a body 0.27–0.33 from its foot ("under the lowest branches"), which shut the gap between two trees
  on neighbouring tiles; from above the crowns hide where that is. `TREE_R` is the trunk now (0.13; a bush 0.3): a
  body walks under a crown and through a pine's low branches (the see-through dither shows it), never through wood;
- a walk straight into a round thing stood still (a slide off a circle met head on only creeps; the sidestep reached
  0.4, a trunk needs 0.5). `wayRound` (sim.ts): what is in the way is rounded when it is small (`isWall`: not the
  water, the map's edge, a house, a site's fence, the pavilion, the bus shelter: there the walker stands), the way
  tried out step by step up to `ROUND_REACH` 1.6 to the side and 0.8 back, the side the thing does not lean to first.
  The walk keeps its side (`TownSim.roundSide`, `wayAlong`'s `prefer`) until it runs free: without that it changed its
  mind at every other step, and backing out of a hollow it went back in at the first open step. The feet go exactly
  along the tried way, the body looks half way (`halfWay`): a body that first turned onto it overshot and circled;
- gaps a finger narrower than a body (a bush and a stone 0.43 apart, a bench and a palm) looked open and were hollows.
  `lotNature` now leaves a body's room (0.52) between the things of a lot, or stands two right against each other
  (one clump); the palm by the promenade bench at (59, 75) is gone;
- **the banks** (found only after the owner played the fix above and came back angrier, with three screenshots by the
  lake: "tao có thấy cái gì cản đường đâu sao phải đi vòng qua mới được"). The water stopped a body at its TILES,
  and the bank is drawn along a rounded curve that runs up to `WATER_SLACK` 0.6 of a tile over them: of the drawn
  land within a tile of any water, 51% (119 tiles², round every lake and pond and along the whole coast) could be
  seen and not stepped on, some of it a full tile from the waterline. Now a body is stopped by the curve the terrain
  draws (`core/town/shore.ts`, moved from the scene; `map.ts` `shoreDistance`: the curve's signed distance on a 0.1
  lattice over the tiles near it, made tile by tile when first asked, because a walk asks thousands of times a
  frame and the exact curve made one test 13 times slower): `onLand` / `shoreStop` keep its middle `SHORE_STAND`
  0.1 from the waterline, feet at the water's edge. `solidsNear` still gives a water tile's box (`what` = `WATER`)
  for the path finder; `sim.ts` leaves those out. Residents keep to the tiles (they do not walk the bank), and a
  click on the bank walks to the nearest tile's middle, not onto the bank itself.
The first fix was pushed with the banks still shut: its tests only walked at THINGS, and the old "nothing invisible"
test walked only the plaza and the streets and counted a water tile within reach as "something there". Both now
walk the whole island, every third tile, 8 ways, in a first-day town and a full one: a stop must touch a collider,
the map's edge or the DRAWN waterline (`colliders.test.ts`), and every point of the bank must hold a body
(`noStuck.test.ts`). A sweep with the model-to-collider tolerance cut from 0.26 to 0.1 found no collider much
bigger than what is drawn (0.22 at most, a sign pole beside the bus shelter). Still not watched by a person and not
tried with real keys by the agent: the app's browser pane has no WebGL, so the 3D town does not run in it. Things
standing 0.2–0.45 from a house's wall (a planter, flowers by a door) still make a nook where a walker stands: it is
at a wall, and backs out.

**The hovered square** (`pick3d.ts` `stickyTile`, tested; `engine3d.ts setHover / refreshHover`). A white square on the
tile under the mouse, snapped to it (no easing between tiles), only over a walkable tile: over a person, a house or an
activity there is no square (they have their own highlight and name). It is picked again only when the pointer moves,
when the camera has moved the ground under a resting pointer, or every 0.25 s for somebody walking under it; a resting
pointer over a resting camera never changes it. It keeps its tile until the point under the pointer is `HOVER_STICK`
0.12 tile past the tile's edge (no flicker on a line between two tiles). It is hidden while the pointer is off the
canvas (or over the HUD, or turning the view), while a direction key is held and until the mouse moves again, and while
a conversation or a panel is open, and on the player's own tile. It floats `MARK_Y` 0.055 over the ground with a polygon offset (at 0.025 it
z-fought the plaza's slabs, whose tops are at 0.025, and hid under the cobbles: the flicker the owner saw), and so does
the goal ring.

**Lots on offer** (`lotsOnOffer` in `shellModel.ts`, tested): only the next `LOTS_ON_OFFER` (3) lots the learner can
work toward stand in the world as construction sites (fence, cones, wooden frame, planks: `buildSite`) with their
price over them (the gate in the fence is shut: two striped bars and a small white sign across it, since 2026-11-21;
the whole site is solid, as its colliders always said: nobody walks in, the build happens from the gate outside): the cheapest ones not built yet, ties in the listed order. Building one brings the next one up.
Every other lot is a corner of nature (a tree or two and a stone: `lotNature` in `core/town/colliders.ts`, the same
every time): no fence, no price, nothing to click or hover (`pickAt` skips it, and the "Xây" prompt at its gate does not
come up). Only its trees and stone block the way (Moving about). The build panel still lists every lot, so any lot can be built in
any order; the hidden keyboard list keeps one button per lot too.

**The countryside** (2026-11-22; `data/townWorld.ts`). Once the camera moved out (a grown-up a ninth of the stage
high) the owner found the 44 × 44 town "nhỏ nhỏ", the town itself too small, not the map's frame. The island grew to
72 × 72 tiles: the town keeps its 44 × 44 tiles in the middle, every coordinate of it moved by (16, 12) (x + 16,
y + 12: the fountain 21,21 → 37,33, the start 22,23 → 38,35), and a ring of open land goes round it. No new
buildings, nobody new lives there; the ring is for walking and looking:
- **Rừng thông** (the far corner, x 0..32 × y 0..26): a dense pine wood with a forest trail from the woods' path up
  to a bigger hill (9,11: radius 6.5, 1.9 high) with a lookout of two benches, like the old hill's; trees thin out on
  its slopes.
- **Cánh đồng** (y 0..11 to the right, and down the right edge to y 23): the farm lane goes on north off the island;
  a field track runs west from it through the fields to the forest and the big hill, and east to the country road;
  six fields of the town's own (always in leaf, the farm prop without the activity), a second barn with its well,
  hay bales, a fence between a field and the road.
- **Hồ lớn** (x 0..15 below the forest): a big lake; the old lake path goes on down its east shore (the lake road,
  x 15) to the residential lane, and a shore walk leaves the island west along its north side; benches over the
  water, two anglers' spots, ducks.
- **Đồi cỏ** (y 56..71): grassy meadows with two low hills (one with a bench on top) and a lotus pond with ducks; the
  hills' lane runs from the residential lane past the pond to the main road, and a footpath leaves the island south.
- **Đường quê** (x 60..71): the country road from the fields down to the main road (which goes on east off the
  island), the orchard track from the east lane, two rows of fruit trees with a fruit stall under them, and a rest
  stop (bench, lantern, signpost) where the country road meets the main road.

The lanes make one loop round the town (forest trail → field track → country road → main road → hills' lane → lake
road), each tied into the old streets where those left the 44-tile island. Everyday life uses it (WORLD_LIFE): the
ways out (`ends`) are now at the new edge (the main road east, the farm lane north, the shore walk west, the footpath
south), and passers-by walk past ten more spots in the countryside, so they spend part of their walk out there; seats
on the new benches, five more chat spots, people tending the fields, two anglers at the big lake, a customer at the
fruit stall. The map's district labels (`WORLD_DISTRICTS`, 15 now) and the travel menu name the new parts; the map
draws every hill (`drawMap.ts`, it drew only one). The lots, places, rooms, staging, activities, links (`?talk=`,
`?build=`, `?activity=`) and what is stored are unchanged: nothing stored holds a coordinate (`town-progress` keeps
ids; the player's last tile lives only in the page's memory), the town projects' spots (`extraDecor.ts`) moved with the
town, and the plaza pair of `staging.ts` is measured from the plaza's centre.

What it costs: the trees and grass tufts are instanced per 12 × 12 tiles of the map (`nature.ts CELL`; one mesh per
kind for the whole map until then), so the camera and the shadow pass skip the cells they do not see: walking, the
triangles went down (0.26–0.41 M, from 0.43–0.57 M on the 44-tile island, where every tree was drawn every frame),
draw calls 59–101. The ground keeps each vertex's height and grass colour once (`terrain.ts`; the hills' fine cells
asked for each height up to five times, and the four hills took 170 ms of the first long task without it); the
ground of the bigger island still takes about 2.5 times as long to make (84–97 ms against 33–42 ms in Node), but a
reload's longest task in the production build is 125–130 ms. The overview shows the whole island: 544–548 draw calls,
1.56–1.59 M triangles, still 60 fps on the owner's laptop GPU.

Checked only in headless Edge on the owner's laptop GPU (ANGLE / D3D11, RTX 3060 Laptop) with a fresh town: the
player put at seven spots (the plaza, the big hill, the fields, the big lake, the pond, the country road, the old
woods) and the overview, 1600 × 900 and 390 × 844 (2× pixel ratio), day and night: 60 fps everywhere, the engine's
own work 1.4–2.8 ms, no console errors; a few screenshots of the new parts and of the map. Tests check the ground
(three bodies of water, every hill walkable and never steeper than about 32°, no pocket a walk from the start cannot
reach, everything on its own tile), the colliders against the models, and the path finder against the body. Not
checked: by a person, walking the lanes by hand, on a real phone or a weak laptop, a rich town in the countryside,
whether the open meadows and fields read as calm or as empty, and whether passers-by spending part of their walk
in the countryside leaves the town feeling emptier.

**The coast and the mountains** (2026-11-24; `data/townWorld.ts`, `three/scene/backdrop.ts`, `three/scene/range.ts`).
The owner: "được thì mở rộng bản đồ đi, có biển/núi non này nọ cũng được". The island grew again, from 72 × 72 to 84 × 84
tiles, but only on its two near sides (x and y 72..83): nothing moved, so every coordinate, test and stored thing of
before stays as it was. The new band is a coast: grass, then dunes with palms ('p', a palm on sand), a sandy beach (':'
sand, walkable like grass), then the sea ('~' tiles at the map's edge). Its parts:
- **Bãi biển** (y 72..83): the footpath goes on down from the hills' lane to a beach promenade (y 74) that runs from the
  island's west edge (a coast road out into the mountains' foot) east to the cape; beach huts in the dunes, umbrellas
  with loungers on the sand, benches looking out to sea, a lantern and a signpost where the footpath comes down.
- **Bến cảng** (x 72..83): the main road goes on east past the old bus stop to a little quay (x 78..80, y 50..54) with a
  fish stall and two lanterns, and a wooden jetty (seen only) out over the sea with boats bobbing round it; a coast lane
  (x 74) joins it to the promenade, a lane from the east lane's bend (y 30) to the east beach.
- **Mũi hải đăng** (the near corner): a rocky cape on a low knoll with the lighthouse (its lamp lit at night), a bench,
  a few rocks.
- **Round the island, seen only** (`backdrop.ts`): the sea out to the horizon (a floor that gets deeper and darker under
  the town's own water material, in fine cells near the island and four wide planes beyond), and a range of mountains
  behind the two far sides (x < 0 and y < 0): foothills, pine forest, grey rock, snow above about 10, peaks up to about 17,
  down to the coast at both near ends; two passes where the farm lane (north) and the shore walk (west) leave the map,
  and the falls that come over a cliff at row 41 into a ravine and on by a short stream (x 0..2, y 40..41) into the big
  lake. `mountainHeight` (`range.ts`, pure) is shared by the 3D range and the map.

Everyday life uses the coast: the ways in and out (`ends`) are the harbour (by boat), the two passes and the coast road;
passers-by walk past six more spots there; benches, three chat spots, an angler where the jetty starts, a customer at the
fish stall. Three more districts (18): Bãi biển, Bến cảng, Mũi hải đăng (English in `i18n/en/town/data-world.ts`).

How it was made safe: the shore curve is made from the map's water plus the sea out past the near edges
(`shore.ts seaShore`, `TownWorld.coast`), so the coast's curve never pinches against the map's edge; spits, one-tile
strips and the cape's tip were trimmed until a body standing against the water always stands on the drawn land (the
shore test); no grassy rim along the sea (the island's earth rim is drawn only along land); open sea far from any shore
is one cell a tile. The sand, the palms, the new scenery (lighthouse, hut, umbrella, boulder, boat, jetty), the sea and
the mountains (cells of colour by height and little snow-capped peaks on the full map) are on the map too
(`drawMap.ts`); the earth cliff under the map's island is gone on a world with a coast.

What it costs: walking, 59–111 draw calls and 0.31–0.51 M triangles (the same as before; the range is one mesh of about
20,000 triangles, the sea a few hundred); the overview of everything 738–756 calls and 1.9–2.1 M triangles; 60 fps in
every view at 1600 × 900 and 412 × 892 (2× pixel ratio), day and night, on the owner's laptop GPU in headless Edge. The
ground takes longer to make (about 150 ms warm in Node against 84–97 ms before); the backdrop (50–75 ms) is made in an
idle moment after the town's first frame and its shaders compiled in the background before it is shown, so it is not in
the long task that brings the town up. A reload's longest task in the production build measured 305–369 ms, against
264–377 ms for the build of `main` before the coast on the same machine the same hour (the machine was slower that day
than when 125–130 ms was measured; the numbers are noisy). Not checked: by a person, on a real phone (the owner's
OnePlus), the falls and the lighthouse's lamp moving, whether the mountains read well from the town (from the usual
camera they show only near the far edges and in the overview), the palms and models close up by a person's eye.

**Toàn màn hình.** On a phone (`(max-width: 720px) and (pointer: coarse)`) the town opens in full screen: the owner,
2026-11-24, on a OnePlus: "giao diện điện thoại của game thị trấn lỏ vậy, có cách nào bật full màn hình không?" (the
app bar, the page title and the tab bar took a third of the screen). The browser allows its real full screen only from a
tap, so the overlay comes first and the first tap on the town asks for it (`useFullStage`); "Thu nhỏ" leaves both, and
the choice holds for the session. Checked in headless Edge at 412 × 892 (the overlay at once; headless refuses the
Fullscreen API itself, so the real full screen was not seen). An installed app (Chrome ⋮ → "Thêm vào màn hình chính",
`display: standalone`) has no address bar either. The last HUD button (Maximize2 / Minimize2, "Toàn màn hình" /
"Thu nhỏ") puts the stage over the whole window: the Fullscreen API on the stage's own box when the browser has it (it hides the browser's bars), and
always a fixed overlay through CSS (`.town-stage.is-full`; the page under it does not scroll), which is all an
iPhone gets. The HUD, the conversation, the build panel and the popover of "Việc hôm nay" are all inside the stage,
so they work there. Esc never leaves (owner, 2026-11-26: "esc là để tắt các action, còn muốn tắt full màn hình thì
nhấn f11"): it closes a talk or a panel only; F11 or the button leaves. In the browser's real full screen Esc is held
for the page with the Keyboard Lock API (`navigator.keyboard.lock(['Escape'])`, Chrome and Edge; holding Esc still
leaves, as the browser says); Firefox and Safari have no such API and still leave on Esc. Checked in headless Edge
with the overlay only (it refuses the real full screen): Esc closed the people sheet and stayed, F11 left. The real
full screen with the lock was not tried; focus stays on the button. While full screen is on,
everything outside the stage (nav, page header, "Thị trấn này để làm gì?", the skip link) is `inert`
(`inertOutside.ts`, tested), so Tab and a screen reader's cursor stay in the town; focus moves to the canvas when it
was outside. The overlay keeps its HUD, prompt, panels and toast clear of a phone's notch, status bar and home
indicator (`env(safe-area-inset-*)`). The choice is kept for the session only.

**Loading.** The town is made behind the loading card in short slices, one per frame (2026-11-21, after a playtest
measured a 1.9 s long task on the first visit and 0.9 s on a reload): the island and its nature in the frame after the
stage mounts, what is built in the next (`TownStage3D`), then the people a few a frame, then every shader compiled
in the background (`compileAsync`: the driver's parallel compile, nothing waits on a program's link), then each
material drawn once into one pixel a few at a time (`firstDraws`: ANGLE still finishes a program on its first draw,
and the shadow pass has programs of its own), and only then the first frame (`engine3d.ts boot`). The rooms' shaders
(the café's room, `warmRooms`) and the conversation portraits (`portraitWarm.ts`, after `warmPortraitShaders`)
follow in idle time once the town shows. Measured on the production build in headless Edge (owner's laptop GPU): the
longest task after the loading card was 898 ms on a first visit and 350 ms after it (before), 142 ms and 146 ms on a
reload (after). Until its first frame is on the screen the stage shows one calm pill, "Đang dựng thị trấn…", and the town is on hold: no keys
or clicks, the hidden action list disabled, the HUD's "Xây" and "Chơi" waiting, and a conversation, build panel or
activity asked for by a link (`?talk=`, `?build=`, `?activity=`) opens only once the town is drawn
(`TownStageProps.onReady`). There is nothing to download: three.js is one script of the town page (below,
"Performance and size").

**Without 3D** (`TownStage3D` with `flat`, `three/webgl.ts`). The 3D town needs WebGL 2 on a real graphics card: a software
renderer (SwiftShader, llvmpipe, Microsoft Basic Render) draws it at a frame or two a second, and some browsers or
locked-down machines have no WebGL at all. There the page keeps everything that does not need the world instead of a
second, flat renderer: a calm note in the stage ("Máy này chưa vẽ được thị trấn 3D" and why, and that talking,
episodes, building and the games all work) and the residents as a list (portrait, name, where they live, the episode
waiting; the suggested one first). A row opens the conversation or episode at once (nothing walks: `walkTo` says there
is no way, so the page goes straight on); the HUD's "Chơi" opens every activity, "Xây" the build panel; the main
button still offers "Tới gặp Leo · Tập 1". Leo's welcome bubble (about walking up to people) is not shown. Portraits,
thumbnails and loot pictures still draw where WebGL exists at all (they are small, one offscreen renderer); with no
WebGL a portrait shows the first letter of the name and a thumbnail stays empty (the name is written beside it). The
same page shows when the 3D town fails after all (no context, or a lost one that does not come back in 3 s:
`onFail`). Checked with Edge's GPU turned off (`--disable-gpu`) and with `?r=flat`.

**Life** (2026-11-20, after the owner found the town "điều hiu": too few people, stiff, nothing going on). Everyday life
runs by the learner's own clock (`engine/life.ts`, tested in `life.test.ts`; the sim's `life` option, on in the
engine and off in the older sim tests):
- **Everybody lives in town from the first day.** The thirteen residents are all there; whoever's place is not built yet
  lodges at the boarding house ("nhà trọ": `inn` in `WORLD_PROPS`), and their home is a spot in its
  yard. Their tag says "Grace · ở nhà trọ" and shows only under the pointer, beside the player or when the main
  button suggests them. **They talk like anybody** (since 2026-11-20): walked up to (a click, E), the main button
  offers "Bắt chuyện với Grace · Tập 1"; their quick chats and episode 1 happen in the boarding house's common room (`INN_SETTING`) or, for a few episode 1s, on the plaza (`lodgerSetting`, §9), and the two walk there first ("Staging" below); `suggestedPlace`
  may send the learner to them. Building stays in the build panel and the HUD's "Xây" (and the hidden action list has
  both buttons for a lodger). What building adds: §3. Building their place = they move in: as the house pops up they
  step out of its new door with a heart (`moveIn`) and walk to their spot, their home from then on.
- **The day** (`dayPart` of the local time): night (0–6 h), morning (6–9), work (9–12), noon (12–14), afternoon
  (14–17:30), evening (17:30–21:30), late (21:30–24). Each part weighs what residents feel like doing
  (`DAY_WEIGHTS`; somebody sits on a bench in the morning and the working hours too since 2026-11-21), each resident
  has a liking that counts three times (`likingOf`): standing about by their door
  ('home'), going indoors ('inside': hidden behind a lit window, not in anybody's way, not clickable; most of them at
  night and late), sitting on a bench or the café's stool ('sit'), chatting in pairs ('chat'), watering the planters,
  the flowers or the farm ('tend'), fishing at the pond ('fish'), reading the notice board ('read'), the market
  stalls ('shop'), a jog round the plaza (mornings only), a short stroll. An activity lasts 6–90 s
  (`activitySeconds`), then they choose again. The resident the main button suggests never goes indoors (they must
  be found), and one indoors steps out of their door when walked up to.
- **Where** (`WORLD_LIFE` in `townWorld.ts`): seats (two per bench, the café's stool, the benches the learner buys
  once bought), chat spots (two tiles side by side on the screen, facing each other and the viewer), places to stand
  for each activity with the way to face, the jog loop, the streets' ends and points the passers-by walk past, the
  boarding house's door and yard. Each seat or spot is held by one resident at a time; nobody plans a spot within
  1.6 tiles of the player (2.6 when the page opens).
- **How it shows:** the town is already alive when the page opens (everybody placed at their first activity at once:
  `seedLife`); seated people sit (the `sit` action of the animation brain, at the seat's height), a chat shows small
  "…" bubbles over whoever speaks and the `talk` action, anglers hold a rod, gardeners a watering can, readers a book
  (`chars/props.ts`); a resident standing about waves once when the player comes close (at most every 30–60 s each).
  Everything else (collisions, giving way, turning) is the motion below.
- **Passers-by** (`Folk`): up to five townsfolk without a name and two children, each with a seeded look of their own
  (`passerLook`: skin, hair style and colour, clothes; children 0.75 the size). They come in at a street's end, walk
  past a point or two (children round the plaza) and leave by another end; how many by the part of the day
  (`folkCount`: none at night, five at noon; children in the day and early evening). They cannot be clicked and have
  no tag.
- **More things in town** (always there, from `WORLD_PROPS` and `WORLD_SCENERY`): the boarding house, the egg kiosk on
  the plaza, a market row, the pier, the farm field with a barn, the notice board, benches, lanterns, a planter, a
  signpost, fences, hedges, rocks, a hill with a viewpoint, ducks on the lake. The lanterns, the market and the kiosk
  light their corner at night.
- **The hill** (the woods, `groundHeight` in `data/townWorld.ts`, tested; raised in 3D since 2026-11-21, flat
  before): a smooth bump 1.6 high with a level top 1.25 tiles round its middle (the viewpoint's two benches stand
  level) falling to 0 at 5.5 tiles, never steeper than about 32°. Its grass and path tiles lie on the height field in
  finer cells with the field's own normals and a little lighter grass up top (`terrain.ts`, `Merge.quadField`); the
  pebbles of its paths tilt with it; trees, tufts, the benches, the signpost, a lot's stone and the fireflies stand on it
  (`TownScene.lift`); people, the cat and the pet walk on it (their feet at the ground's height), the goal ring and the
  hovered square lie along the slope (`onGround`), the camera follows the player's height, a talk framed there
  includes it, and the point under the pointer is found on the raised ground (`pick3d.ts rayGround`: marched along
  the ray, then halved; tested). Walking, the colliders and the path finder ignore it (a slope blocks nothing).
- **Town projects** (decorations built together over days, their rules with the game data): `StageState.extraDecor`
  lists their ids (the page passes `useTownGame().decorations`); the stage builds each id `engine/extraDecor.ts`
  (`EXTRA_DECOR`, tested) places and skips the others (§10 "The extras in 3D").
- **The player's look** (`StageState.look`: `PlayerLook` of `engine/sim.ts`, `{ hat?, outfit?, pet? }`, loot ids
  from `useTownGame().look`): the hat sits on the head bone (it nods and walks with him), the outfit colours his top,
  and the pet follows `PET_BEHIND` (0.85) tiles back along the player's own trail at its own pace.

**Activities in the world** (2026-11-21). The HUD's menu and the map send the player to an activity's spot through
the dark when it is further than `WARP_FAR` (the far talks' rule; the farm and the egg kiosk were 11 s walks), and
the panel opens on arrival. Fishing is seen in the world (`scene/fishShow.ts`, driven by the panel's phases through
`activities/stageLink.ts` → `TownStageHandle.fishing`): the player walks out to the end of the pier and faces the
water with the rod; a cast puts a float on the water with the line running to it, a bite makes it jerk under with
rings of ripples, a catch pulls a fish in its tier's colours out of the water up to the player (who cheers), an escape
leaves a splash; closing the panel walks them back. The farm field draws the learner's review cards
(`core/town/farm.ts fieldLook`, the same field the panel reads, `StageState.farm`): seedlings, leafy growing plants,
ripe ones with fruit, wilting yellow-brown ones, bare soil; the player stands at an open gate in its fence. No
decoration stands at an activity's spot, before a door or where it would close a way (`townWorld.test.ts`: the lamp
by the egg kiosk moved to the east lane, a flower bed off the school's path).

**Activities.** Five spots (`WORLD_ACTIVITIES`, ids = `ActivityId` of `activities/types.ts`): `fish` the pier (stand
on its shore end, look over the water), `farm` the farm field, `eggs` the egg kiosk, `wardrobe` the boarding house's
door, `album` the notice board. Clicking the thing (`pick3d.ts` Hit 'activity'), the HUD's "Chơi" menu (walk there,
then open) or E at the spot (Near 'activity'; the main button then names it) opens `PANELS[id]` in `ActivityHost`:
the build panel's frame (side sheet ≥ 720 px, bottom sheet below), its name as title, ✕ and Esc to close (Esc heard
on the window while a sheet is open, `panelKeys.ts`: a button that re-renders or goes away under the click no longer
leaves the keyboard on the page's body, where Esc did nothing; the keyboard is put back into the sheet), focus into
it and back to the canvas (or to "Chơi" when opened from there), the camera centred in what it leaves, the stage's
input paused, the town living on. A panel gets `onClose`, `sound` and `onReward({ label, xu })`: a toast, and with xu
"+N" over the player, coins flying to the xu counter and the coin sound (the store pays; this is only the show).

**People** (`three/chars/`). Every person is one skinned, toon-shaded body built in code (body, clothes, hair, extras
such as glasses, an apron, a cap; 2 draw calls, 3–4 with a hat and a held prop), with a face from one shared atlas
that blinks and changes expression (happy after a right answer). The cast (`castLook`): the player and the thirteen
residents, each recognisable at a glance (the player: fair hair, a T-shirt and jeans; a woman's character wears dungarees: never a man, owner 2026-11-25). The animation brain
(`chars/anim.ts`, tested in node) builds every pose from layers that ease in and out, so nothing pops: idle life
(breathing, weight shift, looking about), the walk or run, one activity at a time (sit, talk, drink, water, fish,
read), one-shots on top (wave, nod, head shake, cheer: the nod bows and the shake turns the whole upper body, so they
read at the town's zoom), the head's look-at, an eased turn with a lean into it, hair on springs. The fishing rod is
long and dark enough to read against the water (0.9 design units, a thicker line and bobber), and an angler stands
turned up to half a radian toward side-on to the viewer.

**Drawn portraits** (2026-11-24). The owner found the 3D people "lỏ" next to anime portraits and asked for avatars
worth dating; an attempt to make the 3D people anime in code (anime eyes, locks of hair, line art) came out worse than
the cute original and was put back the same day (the owner: "nhân vật lúc đầu còn dễ thương hơn"). What stayed:
- the residents' avatars can be drawn pictures, ONE per resident since 2026-11-25 (owner: separate files per face
  were getting "rối"): nine faces in a 3 × 3 grid. The owner makes it in a free AI chat (Gemini or ChatGPT) from
  `docs/portraits/<name>.md` (one ready text per resident, the grid's order and "the whole head inside every panel":
  the owner's first grid had Zoe's bun cut off; `docs/portrait-prompts.md` is the shared version), drops it in
  `portraits-src/` (not in git) as `<name>.png` and runs `npm run portraits` (`scripts/portraits.mjs`: headless Edge
  finds the white gutters, with or without a white margin round the outside: white-ish lines first, the corner's
  colour only when the corner is a pale margin, three spans of 25–40% each, else no grid; Zoe's first cut, with a
  pink corner taken for the gutter, was tight round the people), cuts the nine panels a little inside, keeps each
  cell's top, and writes
  `public/portraits/<placeId>.webp`, the nine cells side by side with no gutters, 384 px each, plus
  `src/features/town/portraitFiles.ts`: a hash and the moods drawn; a cell of one flat colour counts as not drawn).
  `<name>-luoi.png` = a grid for sure (equal thirds when no gutters are found); `<name>-cuoi.png` etc. = one face put
  in its cell over the picture as it is. `Portrait` (`art.tsx`, `portraitSheet.ts` picks the cell) loads the one
  picture three times the frame's size and moves it so the mood's cell fills the frame: a new face only moves it,
  nothing loads. A round frame (most of them) would cut a square picture's corners, and the AI draws a ponytail or a
  bun close to the panel's top (the owner saw Emma's cut, then rejected a smaller face with a band of space above
  it): it shows the cell at full size, moved down by the resident's own `lift` (the script measures how far the head
  of their first face needs to be inside the circle, counting only what is 40+ away from the background and not the
  outer 6% each side: a background darkening toward the panel's border once read as hair and gave Tom 15%; now
  0–4.7%) with the gap above in the cell's measured background colour (`bg`). A square card shows the whole cell; a
  small one scales in 1.2 on the face, its top kept. With no picture, or one that does not load, the 3D portrait as
  before. The player's own character always uses the 3D portrait. Drawn by the owner in Gemini on 2026-11-25: all 13
  residents as full grids of nine with the new prompt (13 sheets, 1.48 MB in all; the source PNGs stay in
  `portraits-src/`, not in git). Checked as cut sheets and as round portraits in the dev server; nobody has played
  through every mood in the game yet;
- moods of a drawn portrait (`PortraitMood`, `portraitSheet.ts`, the grid's cells in this order): neutral while
  listening, happy after a right answer, sad after a wrong one, 'love' (shy, blushing: a talk or an episode that won
  friendship, a gift they love, a warm answer on a date, a confession), 'surprised' (a proposal), 'moved' (happy tears:
  a yes, the wedding), 'pout' (a gift they dislike, a clumsy answer, a wrong tray at the café), 'thinking' (a witness
  in a case while they tell it) and 'worried' (a café customer in the last third of their patience; the witness whose
  words a wrong answer missed, until heard again). A café customer who waited too long looks sad. A mood without its
  cell falls back (`MOOD_FALLBACK`: moved → love → happy → neutral, pout → sad → neutral, worried → sad → neutral,
  thinking → neutral…); the 3D portraits only smile or not. A courtship scene shows the one courted at its top, kept
  in view while the lines grow, their face set by the scene and then by the answer picked (`LovePanel` openingMood /
  pickedMood);
- "Hẹn hò & gia đình" lists the five one can court as picture cards (two a row), a resident's page there opens with a
  132 px picture, the creator's preview is up to 240 px, a conversation's picture 108 px on a wide screen (60 on a
  phone);
- a model put in the studio only to compile the portrait shaders is never in a picture (`userData.warmOnly`,
  `offscreen.ts paint`): on a phone it stood in front of the first portraits drawn;
- `three/chars` is its own chunk (`town-people`, about 80 kB, loaded with the town page), so TownPage stays under the
  500 kB warning (491 kB with the other sessions' work in the tree).

**Planted feet** (rebuilt 2026-11-21 after a frame-by-frame critique measured the feet skating at 0.55–0.61 of the
body's speed; since "The cosy gait" below, planted only while the leg reaches: a stroll, not a brisk walk): the person is told where the body stands each frame (`Animator.placeAt`); a foot on the ground stays
where it landed in the world, the other swings on an arc (heel up early, then reaching forward) to where it will land
(under its hip, half the stance ahead of where the body will be then), and a two-bone IK (thigh, knee; the soles kept
level, a soft limit near straight so the knee never snaps, a fold limit so it never flips) bends the legs to reach
them, the hips coming down just as far as the legs need. The cycle runs on the ground actually covered and the cadence
follows from the step (`stepLength`, below). The pelvis turns with the forward leg, the arms swing against it (less at
a quick cadence), the body rises over the standing leg.
Setting off, the foot further back lifts first (a shorter first step); stopping, a foot in the air finishes its swing
under the hip; standing, a foot out of place (a turn on the spot) steps back under its hip, one foot at a time
(`SETTLE_STEP` 0.17 s); hopping onto a seat or off it, the feet go with the body. Feet lift about 6% of the height
(3.4% before). Measured in headless Edge with the critique's scripts (2026-11-21): stance-foot speed ÷ body speed 0
(median and p90) for every walker in 20 s of town life, against 0.57 / 1.87 before; the run's p90 reads 1.0 only
because in its moment in the air neither ankle is on the ground.

**A calm gait** (2026-11-21, replaced the same evening by "The cosy gait" below; after the owner twice called the motion jerky: with planted feet on legs a fifth of the
height, a stroll came out at 6.5 quick steps a second, the player's walk at 9, the run at 10, a scurry). Three levers
together:
- longer legs: `LEG_GROW` 0.06 design units (thigh 0.12, shin 0.105; 0.095 / 0.07 before), the thigh pivot at 26% of
  the height (21.7% before). Everything above the legs is modelled as before and raised by `LEG_GROW` as it is built
  (`GeoBuilder.lift`); the head kept its size, so an adult is about 0.79 tiles tall (0.75), the head about 42% of the
  height (45%). Portraits keep their framing (their camera rises with the head);
- longer steps (`stepLength`: 0.21 design units at a stroll, 0.29 at the player's walk, 0.44 running; walk duty 0.52)
  with the pelvis turning into them (0.3 rad, 0.2 before), the hips dipping at the double support (the IK's drop, at
  most 0.1, rising again at up to 0.9 a second) and swaying a little more: a light bounce, about 2.5% of the height
  strolling and 5% at the player's walk. The leg's soft limit near straight is 99.6% of its reach (at 97.5% the knee
  stayed bent 28° even at mid-stance, a crouched walk; now about 12°);
- calmer paces (Motion below): residents 0.7 tiles/s, children 0.75, the cat 0.65; the player 1.05 walking and 2.1
  running until the same day's control pass ("Moving about"), which made it 1.6 and 2.8 (responsiveness first: their
  cadence went up again).

Measured in headless Edge with the critique's scripts (2026-11-21; cadence from the animator's phase over the steady
part of each walk): residents 4.1–4.6 steps a second (6.1–7.3 before), children 5.0 (8.8), the player's walk 4.9 (9.1,
clicks and keys alike), the run 6.4 (10.3); stance-foot speed ÷ body speed still 0 at the median for every walker, the
run's p90 1.0 only in its moment in the air; feet lift about 7% of the height walking, 6% running. The cost is time:
the plaza to the farthest tile (36 tiles of path) takes 18 s by a click (mostly a run; 14 s before) and 34 s with the
keys (24 s; Shift runs). At the player's paces of the control pass (1.6 / 2.8, "Moving about") it is about 23 s with
the keys and 14 s by a click, and the player's cadence went up to about 6.7 steps a second walking and 7.8 running
(median, measured the same way). Seen only as filmstrips, never watched by a person; the knee of the swinging leg still
folds fast in the first step of a run (up to about 60 rad/s for a frame or two).

**The cosy gait** (2026-11-21, evening; `chars/anim.ts`, tested): the owner found the planted "realistic" walk stiff
("cứng quá, nhất là di chuyển") and pointed at Cozyverse Town. That town is behind a sign-in (its login page is all a
visitor sees, and its client code is not public), so nothing of it was watched or read: the style below follows the
brief (bouncy, waddling, leaning, eased) and was judged on our own filmstrips, before against after. What changed:
- **cadence**: steps are longer than these short legs reach, about 3.6 steps a second strolling (4.4 before), 5.2 at the
  player's walk of 1.6 tiles/s (6.4), 6.0 running at 2.8 (8.0), children 4.4 (4.8); `stepLength` walk 0.0915 + 0.1575 ×
  pace (design units/s), run 0.118 + 0.135 × pace; duty 0.5 walking, 0.34 running; the run blend from 1.9 to 2.5
  tiles/s (a jog runs anyway), so the player's walk is a walk;
- **feet**: a foot lands at most `REACH_FWD` 0.12 ahead of the hip and stays planted while the leg reaches; a longer
  step makes the standing foot glide on at an even share of the body's pace (`slip`, at most 0.6: 0 strolling, about
  0.2 at 1.05 tiles/s, 0.42 at the player's walk and run), never backward (no moonwalk), and a foot left more than
  `REACH_BACK` 0.13 behind is pulled along. The cycle still runs on the ground covered;
- **bounce** (`bounce(u, low)`): once a step, lowest just after the landing (the knees take the weight: a soft landing)
  with a broad top over the standing foot; a run is lowest at mid-stance and high in the air. The head goes up and down
  about 5.5% of the height strolling, 8% at the player's walk, 10% running (IK dip included; about 2–7% before), with a
  squash of 3% (run 5%) at the low and a little stretch at the top;
- **waddle**: the hips shift onto the standing foot and the body tilts over it, the head keeping level: 10–13° of roll
  walking (about 1° before), 4° running;
- **lean**: into the pace (8° at the player's walk, 15° running), into a speed-up (the top dragged back a moment, then
  forward) and over a stop (it pitches on, rocks back a little and settles), on an under-damped spring;
- **arms**: 50–70° of swing walking (about 40° before), 78° running, a beat behind the legs (follow-through);
- **turns**: a spring a touch under critical (`turnZeta` 0.72): it eases in, swings 2–3° past a 90° turn and settles;
  the body rolls into the turn the faster it goes (at most about 11°); the player's `PLAYER_TURN_W` 26 (38 before);
- **springs on top** (`lively`): squash kicks as a walk sets off and stops, the big head nodding after each landing and
  swaying after the waddle, the hair (driven harder by the bounce and the roll);
- **idle**: breathing 3.2 s with a hint of stretch, the weight shifting every 6.5 s, the head wandering and tilting as
  it glances aside, glances that swing a hair past; blinks as before;
- **dust**: a runner kicks up a small puff of dust at each footfall (`Particles.puff`, anchored to the ground point, so
  it stays there when the camera moves), not when running at the camera (the overlay would draw it over the legs) and
  not under reduced motion;
- **pets**: a bouncier trot and waddle (a higher hop, the body rocking, the head nodding a beat after), and the same
  slightly overshooting turn.
Cost: about 1.6 µs an animator a frame in node (1.3 before), nothing allocated a frame (the springs step in place; the
tuple springs of the heading and the look are gone). Checked only as filmstrips in headless Edge (a scripted strip of
the player and screencasts of the player walking, running, turning, setting off and stopping in the town, before and
after), never watched moving by a person, never compared with Cozyverse itself. The glide of a brisk walk (about 40%)
shows in close-up; at the town's zoom the feet are a few pixels.

**The smooth gait** (2026-11-22, replaces the cosy gait's bounce, waddle, nod and squash; `chars/anim.ts`, tested): the
owner watched the cosy gait move and called it a shudder ("nó đi giật giật như động đất", "nhân vật di chuyển cứ rung
rung", "không mô phỏng được di chuyển mượt mà như một game bình thường hay con người bình thường đi"). Measured in node
(the player's head while walking at 1.6 tiles/s, 60 fps): the head went up and down 8.2% of the height and sideways
11.6%, five times a second; the legs, unable to reach a foot at the landing, pulled the hips down 2.5 cm in two frames
and let them up slowly (a sawtooth: the IK's drop), and the head nodded up to ±10° a step from the bob's acceleration.
The sim itself was smooth (the player's speed exactly 1.6 every frame). What changed:
- **cadence**: about 3.3 steps a second strolling, 4.2 at the player's walk, 4.8 running, children 3.8 (`stepLength`
  walk 0.1 + 0.19 × pace, run 0.16 + 0.165 × pace); the standing foot glides more to cover it (about 20% of the pace
  strolling, 58% at the player's walk; `slip` at most 0.7; reach `REACH_FWD` 0.1, `REACH_BACK` 0.11);
- **rise and fall**: one smooth wave a step (`bounce` is a plain cosine now), lowest at the landing and exactly as deep
  as the legs need to reach both feet (`reachDip(REACH_BACK)` + 0.004, `WALK_DIP`), so the IK no longer has to pull the
  body down (its drop, when it still happens, eases in over a few frames). About 3.3–3.5% of the height walking, 4.8%
  running (the run's low moved to just before the landing: a low at mid-stance made a second dip, a judder). The bounce
  fades in and out with walking (`bobW`), so a walk set off again mid-stop never jumps the hips;
- **steady sideways**: the sway onto the standing foot is about 1.5° (10–13° before), the head about 1.4% of the
  height sideways walking (11.6%), 3% running; no squash a step; the head steadies itself against the lean and the roll
  and no longer nods with each landing;
- **arms** about ±25° walking (±35° before), the pelvis turning about half as much;
- **turns**: `turnZeta` 0.95, no swing past (it read as a wobble); the roll into a turn is half as much;
- **start and stop**: squash kicks about a quarter of before; the lean over a stop on a calmer spring;
- a foot whose swing is taken over mid-air (a walk turned into a sit or a stop) carries its pitch on (`fromPitch`):
  the ankle no longer snaps.
New tests: the head's frame-to-frame acceleration stays near a smooth wave's at a stroll, the walk and the run (no
jolt at a landing), the sway and the roll stay small, and the turn does not overshoot. Checked in the dev build in the
app's browser pane at 60 fps (2026-11-22): walking with the keys, the player's ground point moves on the screen with
no jerk from the camera (second difference at most 0.15 px a frame) and the head rises and falls on a clean wave of
about 8 px on a 228 px body (3.5%). Not watched by the owner yet; the pets' trot is unchanged.

The owner then found it smoother but still shivery, and every change of direction "như bị gãy chân" (2026-11-22).
Measured in node (the player's body turns with `PLAYER_TURN_W` 26, a 90° turn in about 0.15 s): the thighs splayed out
23–36° in a turn (4° walking straight), the feet up to three times their usual distance to the side. Two causes, both
fixed in `chars/anim.ts`:
- a planted foot stayed where it was while the body swung round it: now the feet (planted, drawn, a swing's start)
  pivot with the body's turn round its ground point (`pivotFeet`), fully while walking and 60% standing, so a big turn on
  the spot still ends with a settling step;
- a swinging foot aimed its landing along the smoothed (lagging) velocity, out to the side in a turn: it aims along the
  heading now.
Thighs in a turn: about 6° walking (90° and 180°), 9–14° turning on the spot. A frame clock that paid time out in even
steps was tried the same day and taken out: the owner found it shakier ("còn rung hơn lúc nãy"). In a real browser the
frame times are true, and spreading a dropped frame over the next ones moved people wrongly for the frames shown.

**The swinging walk** (2026-11-22, replaces the planted feet; `chars/anim.ts`, tested). The owner asked why we did not
look at Cozyverse Town and do what it does. Its client code, read in the owner's own browser (`chibi.js`, `walk.js`):
- its chibis' legs swing from the hip on a sine of time, about 3.5 steps a second, nothing planted, no IK;
- the body bobs a little;
- every joint is eased toward its goal (k = 1 − e^(−14·dt));
- the walker's velocity and its facing are eased exponentially toward the keys (k = 1 − e^(−12·dt)), never on a spring;
- the camera glides after it the same way.
Ours had planted each foot and bent the legs to reach it. Every artefact the owner saw came from that: feet gliding to
keep up, the hips pulled down at a landing, a splayed leg in a turn. Now, walking:
- each leg's hip-to-ankle line swings on `sin(phase)`; the phase runs at `swingRate`: about 3.4 steps a second at the
  player's walk, 2.6 strolling, 4.6 running;
- the leg coming forward bends its knee (most at mid-swing, none at the ends) and the standing leg keeps a soft 9° bend;
- the thigh leans ahead of that line as far as the bent knee needs, the sole stays level;
- the hips are exactly as much lower as the standing leg leans out (`swingDip`), so its foot stays on the ground.
  Measured: within 1 mm walking, the head about 2% of the height up and down, its frame-to-frame acceleration about
  1.2‰ of the height (8‰ with planted feet);
- a run adds a small hop: the feet leave the ground for up to about 1.2 cm, never going into it;
- the upper body (arms against the legs, a little pelvis turn, the head steady) runs on the same sine;
- it all fades in and out with `move` over the standing pose. Standing, the feet are on the ground (IK) and step round in
  a turn on the spot as before, and the feet are kept under the hips while walking, so a stop stands at once.
The stride no longer matches the ground covered exactly (as in Cozyverse); at the town's zoom the feet are a few pixels.
The cheer's squash also popped at take-off (a switch, now eased).

**Shadows crawled** (2026-11-22). The sun's shadow box followed the view snapped to whole shadow texels along the
ground's x and z. The sun is slanted, so a step along x is a fraction of a texel in the light's own view, and every
shadow edge shifted a little each frame while the camera followed a walker (a test measured up to 0.17 texel a frame).
That is the "rung rung" of the whole picture, not only of the walker. It is snapped in the light's view now
(`shadowCenter`, `three/scene/shadowSnap.test.ts`), and the box's size goes in steps of 2 tiles.
Checked by tests and in node; a still of the walk in the app's browser pane looks right. Not watched moving by anyone
yet: the pane draws about once a second while the app's window is not in front.

Short animations played once (`act`): the player waves when a conversation starts, the resident nods after a right
answer and shakes their head after a wrong one, the player cheers when a place is built. A one-shot waits for the body
to turn the right way first (at most 0.7 s): the wave goes at the partner.

**Motion** (the sim's rules, `engine/sim.ts`, tested; rebuilt 2026-11-14 after the owner said the people moved
"giật giật như ma cà rồng"):
- speeds are ground speeds, tiles per second: the player walks at `PLAYER_SPEED` 1.6 and runs at `PLAYER_RUN` 2.8
  (2026-11-21, "Moving about" above; 1.05 / 2.1 for part of that day, 1.5 / 2.6 before, 2.2 at first) on a click walk
  longer than `RUN_FAR` 7 tiles of path (back to a walk for the last 2.2) or with Shift held; residents
  `RESIDENT_SPEED` 0.7 (0.8) each ±10%, passers-by up to 0.875, the cat 0.65 (0.75), children 0.75 (1.05); the legs
  set the cadence ("A calm gait" above). The player moves by their own rules ("Moving about"); everybody else's walk
  eases in (`START_TIME` 0.14 s) and out (`STOP_TIME` 0.28 s, braking on the distance left);
- a click walk follows the A* path pulled straight wherever the way is clear with room to spare (`smoothPath`,
  `lineClear`): one line across the plaza instead of a staircase of 45° steps;
- the body has its own direction (`yaw`): walking, it steers toward a point `CARROT` 0.45 tile on along the path (a
  corner becomes an arc), at a rate
  proportional to the error but never quicker than a turn of `TURN_RADIUS` 0.28 tile at this pace (on the spot
  7 rad/s), and the walk goes the way the body faces: well off its way it slows, past about 75° it turns on the spot
  first. The 3D body shows this yaw (a spring of ω 18 walking, 11 standing, on top): no walking sideways or backwards.
  Grazing a wall's corner, a walker takes the clear line to the point it aims at; with no way on for 0.25 s it finds
  the rest of the walk again. Measured: the player's heading at most 41–58° off the way of the walk for clicks and
  keys, no frame over 60° (129–140° before); in 20 s of town life 20 frames of all walkers over 60° (one-frame snaps
  onto a path point, ≤ 0.02 tile), against 87 before;
- nobody walks through anybody. Paths go round people (`DETOUR`; every straight line keeps `PASS` 0.55 tile from
  them); every walker looks 0.9 tile ahead along its path and 0.4 s ahead for somebody walking across; behind
  somebody going the same way it follows at their pace, otherwise it slows to a stand and waits. A resident or the cat
  gives the walk up after 0.4–1.2 s and leaves that heading alone for 4 s (`giveWay`); the player's click walk looks
  for a way round every 0.35 s; on a narrow way the one standing in it steps aside (`stepAside`; never somebody held
  for a conversation); one hard rule over all of that: no step brings anybody nearer than `MIN_GAP` 0.5 tile to
  somebody; a click walk that has stood `SQUEEZE_AFTER` 1.5 s behind somebody with no way round squeezes past. A
  resident or passer-by waiting behind somebody standing first looks for a curve round them clear of everybody
  (`giveWay`), and gives up only without one. Stopped by the gap rule, a walker stands `BUMP_WAIT` 0.35 s (no creeping
  into them again frame after frame: the "bump shuffle" at 0.03–0.15 tiles/s); stopped so for `BUMP_GIVE_UP` 0.9 s in
  one walk, it takes a way round or stands (`unbump`). The player never waits for anybody: they slide round people at
  the gap ("Moving about");
- a resident's walk cut short (called to talk) stops at the next tile centre AHEAD on the line (`stopAhead`: no
  about-face); the player's stops where it is;
- personal space: a stroll's end and the cat's seat keep `SPACE` 1 tile round them; a resident standing nearer than
  0.8 tile to somebody for 0.6 s goes home; the cat gets up and goes when somebody stands right by it;
- standing, the octant a person faces turns 45° at a time (`TURN_STEP` 0.07 s walking, 0.12 s standing,
  `HYSTERESIS_TIME` against flicker) and the body's yaw eases round to it; after a walk a person turns three-quarters
  to the viewer only once they have stood still `SETTLE_AFTER` 1.5 s (0.12 s before: a robot's snap). Somebody close
  is followed with the head; the body turns only when they are further round than `HEAD_REACH` 70° (`faceIfFar`), and
  a body turn to look round is rare (every 6–14 s): no turning to and fro as the player walks past;
- the legs are driven from where the body really is (above), never a smoothed speed, so the feet do not skate after
  the body stops; the engine calls it walking only above 0.15 tiles/s and stops only below 0.05 held for 0.2 s (no
  walk ↔ idle flicker);
- a seat: the walk ends on the spot right in front of it (`seatFront`, on the tile it is reached from, never through
  the bench), the person turns round there (about half a second), then sits down backing onto it, the hop timed with
  the hips going up (past half way up before the body is over the seat), on the seat's top (`SEAT_TOP` 0.18 tile in
  props3d.ts, the same as chars/person.ts `SEAT_HEIGHT`, tested: the benches and the café stool, its table a hand
  above; 0.295 until the legs grew on 2026-11-21, a bar stool for these people with the soles a third of the height
  up), the thighs sloping down a little (`kneeRaiseForSeat`, at most about 15°), the shins hanging, the soles about a
  tenth of the height over the ground. The benches built into the places (the bus stop, the café's door) are scenery
  nobody sits on and were not lowered.
  Getting up, they rise and step forward onto that spot and stand a moment (`RISE_TIME` 0.6 s at least) before the
  next walk. Measured on the plaza bench: no frame of the body inside the bench before it is seated (43 before), 9° of
  turning while sitting down (69° before), the hips at 0.336 tiles seated (0.169 before: inside the seat); on the
  lowered bench (2026-11-21) the hips at 0.221 tiles and the lowest ankle at 0.108 (0.273 on the old one);
- the cat sits down and gets up in `CAT_SIT_TIME` (0.5 s) and turns only standing.

**Staging** (2026-11-21, after the owner saw Emma's café episode played on the grass: "quán cà phê gì ở ngoài đường?
mày có biết xây dựng context không vậy"). Every talk happens where it fits: the page works out the talk first (the
episode that waits, or the quick chat), then its setting (§9 "Where it happens": `episodeSetting` / `quickChatSetting`;
a lodger's in the boarding house or on the plaza), and asks the stage to stage it (`talkAt(placeId, setting,
{ visitor }, ready)`; the spots are in `engine/staging.ts`, tested in `staging.test.ts`). However the talk begins (a
click on the resident or their house, E beside them, the main button, the hidden action list, a `?talk=` link) it goes
the same way:
- **'inside' room R**: the player walks to R's door in the town (`doorwayOf`: the place's door tile; the pavilion's for
  'square', the boarding house's for 'inn'). A resident in sight walks there too at a brisk pace (`HURRY_SPEED` 1.25
  tiles/s, `TownSim.gather`) and waits beside the door; one out of sight is inside already (`goInside`). At the door a
  dip to dark (`FADE_OUT` 0.35 s, held `FADE_HOLD` 0.14 s, `FADE_IN` 0.35 s; a deep blue, not black; under reduced
  motion a plain cut) swaps the town for R's room (`three/scene/roomStage.ts` on a room of `three/interiors`, made at
  the dark; the rooms are cached until the page is left): the resident at the room's host anchor in its pose (behind
  the counter, standing, seated), the player at the guest anchor with their hat and outfit (the pet by their side), the
  neighbour who drops in at the visitor anchor when an episode has one there in person (`episodeVisitor`: Ben at the
  café in cafe-2, Mia in class in school-2, Leo at the hall in board-2; never Max, who only phones the office in
  office-2): not in the room before their first line (since 2026-11-21; they were there from the first line before).
  Each pass of the exchange starts without them (the whole listen, line by line, the whole again: `visitorPresent` in
  `episodeModel.ts`, tested; the page tells the stage `visitorIn`): at their first line they walk in at a brisk 1.5
  tiles/s from just outside the room's open side at the right of the picture, along the back of the room round the
  counter and the people (`interiors/rooms.ts entryPath`: the shortest way on a 0.1 grid, pulled straight; tested for
  every room and either side: from outside, past no furniture and nobody, a short way; from the left it would cross the
  front of the room under the lens), talking on the way; the part of the way behind a panel docked at the right or off
  the stage is skipped (`hiddenPart`), so they step out from behind its edge a moment after their line starts and are
  at their spot within about a second, and the shot widens to them as they come (they are left out of it until then); when a pass starts over they are gone at once (a cut, never a
  walk out over the first lines; under reduced motion they come in at once too), and two or three nameless people at the extras anchors (pupils are children) who now and then take a sip,
  turn a page, look at the two or at each other. The shot is the room's wide one (its tall one when what the panels
  leave free is taller than wide), turned the same way, centred in what the panel leaves free (a view offset, as in the
  town), never closer than the room's own shot and as far back as it takes to keep the ones who talk whole (a body's
  half width round their spots) with room for the bubble; in a strip shorter than 360 px over a panel (a phone) it
  may come in to half the shot's distance, so the two are not a thumb high (with a little less room over the heads);
  it eases when a panel opens or the stage changes size. On a phone (≤ 720 px) a conversation makes the stage as
  tall as the screen between the top bar and the tab bar (`.town-stage.is-talking`, at most 760 px) and the page
  scrolls it up under the top bar as the panel opens, and an episode's panel keeps to the question during the first
  whole listen (the three answers come once it has been heard: they cannot be picked before; `.town-ep.is-hearing`):
  at 390 × 844 the room above the panel went from about 170 px to about 340 px during the listen (the two about 200 px
  high instead of 70), at 375 × 667 from about 160 px to 230 px. While a talk opened by a link is already in the café,
  the shader warm-up of the café's room (`warmRooms`) gives the room back to it (it once took the café's room out of
  the scene: black figures on an empty stage).
  Heads look at whoever speaks (the host and the player at each other otherwise, faces kept towards the camera:
  `gazePoint`); the bubble (a neighbour's too), the speaking loop (a seated speaker stays seated), nods, shakes, waves,
  emotes, "+N" and coins work as in the town, projected from the room's camera. The room has its own lights, its night
  (dark windows, lamps lit) and an exposure of 1 + 0.08 × night; the people get the town's night tint. The panel opens
  at the dark (rendered as a React transition), so it comes in as the room fades in. When the talk ends (the result card's "Về thị trấn", Esc, ✕) a dip
  back: the player stands in front of that door facing the street, the camera on them at once, and the resident stays
  inside 3–8 s before everyday life brings them out. The rooms share one light rig: while the loading card shows, the
  café's room is drawn once with a person and a pet into one pixel of the canvas (`warmRooms`; a render target would
  compile other shaders), so the shaders under that rig, the shadow pass's and the room's buffers are ready. Measured
  in headless Edge: the frame at the dark of the first dip took 160–200 ms before, 28 ms after; in the production build
  no long task during a dip (frame gaps of 33–102 ms on a laptop, at most 50 ms at phone size). On a phone a cheer
  (Celebrations) waits for the talk to end: over the strip above the panel it hid the two.
- **'outside' at P**: both walk to P's front (`outsideSpots`: the resident at their own spot by the door, the player
  at the door, side by side along the wall; Mia close to her wall, at her window; a lodger on the plaza south of the
  fountain). A resident out of sight is put further along their way at once, never on the screen (`jumpResident`);
  the player waits for one in sight (put there once out of sight after `WAIT_UNSEEN` 2.5 s, or after `WAIT_MOST` 9 s
  whatever); one who gave a walk up sets off again (`RETRY_SECONDS` 1.2). Then the two face each other, the
  conversation shot below frames them with a little of the building behind (`backdrop`), and afterwards the camera
  follows the player again.
- Until both are in place the town still takes input: a click elsewhere, the keys or Esc give the talk up
  (`onTalkCancel`); a click on another resident stages that talk instead. From one staged talk to another in a
  different setting ("Trò chuyện nhanh" after an episode told elsewhere) it goes through the dark (`cut`). A link starts
  the player at the setting's stand (`playerStand`) and the two are there before the first frame.
- Never on random grass: the old `bringOver` (the resident put beside the player wherever they stood) is left only for
  a world with no spots (the small test worlds).

**A conversation outside** is framed in the town: the camera frames the two: both whole, head to feet with room
for the bubble, in the part of the stage the panel and the counters along the top leave free, at 0.5–1.6 of the
resting distance (as far as it takes to keep both whole: on a phone the strip over the panel is short; it was capped at
0.85 until 2026-11-21, which cut a head under the counters there), seen from lower down (26° instead of 33°, `TALK_PITCH`: faces show under a hat's brim). The two
turn fully to each other first (the greeting: the player's wave waits for the turn and goes at the partner), then after
`TALK_GREET` 2.2 s turn three-quarters to the viewer (at most `TALK_TOWARD_VIEWER` 0.85 rad), and look at each other
with their faces kept a little towards the camera (`TALK_LOOK_CAMERA`: from up here a full turn to the partner reads as
the back of a head). They stand about `TALK_GAP` 1.05 tiles apart (the last point of the walk is moved in from the talk
spot; 1.4 before). The town dims a
little around them (less at night). Whatever stands between the camera and either of them (a wall, a tree) is drawn
dithered round them (`Shared.holes`), and a small thing bought for the town (balloons, a stall, a lamp) standing in
front of the pair goes see-through, like the strings of lights over the plaza. While it lasts nobody else strolls;
a resident within two tiles of either walks off and comes back afterwards (`keepClear`; never the resident the main
button suggests), and passers-by go round the pair (their paths cost more within two tiles of it, a stop of their route
there is skipped, one standing there walks on). The player never walks up to
stand where somebody else stands, and stands where the two do not hide each other on the screen: side by side first,
then two tiles off a little up or down the screen (`TALK_SPOTS`, `talkSpotCost`: a plain walk up to somebody, `walkTo`). The panel comes in. On a stage at least 900 px wide (a
container query on the stage, so full screen counts) it docks to the right like the build panel, as tall as what it
holds, and the two stand in the town on the left; below that it covers the bottom but always leaves a strip of about
170 px above it (more on a phone, whose stage grows for the talk: Staging above) where the camera frames them, so the nod, the shake and the coins are seen on a phone too. What does
not fit scrolls inside the panel with "Câu tiếp" kept in view at its foot, and after an answer the panel scrolls the
right meaning into view above it; on a phone the review-time line is left out, and after a miss "Chưa phải…", the
"Nghe lại" icon and "Rõ từng từ" share one row. The five progress steps sit on their own line under the name. The
hearts row shows only once the first heart is won. Before the answer nothing is written: a bubble with moving bars (in
the panel and over the resident's head) while the line sounds, "Nghe lại" and "Chậm" (still connected), three reply
cards under "<name> vừa nói gì?" (keys 1 2 3). The line plays by itself about 0.7 s after the panel opens (`auto`:
never a paid request, and counted as a listen only when it really sounds); until something has sounded the cards are
disabled and "Nghe" is the primary button. After the pick: the cards lock (right / wrong; on a phone only the right
one and the picked one stay), the resident reacts (heart for a first listen on a new line, sparkle for right, a
question mark for wrong), "+N" rises over their head and coins fly to the xu counter, which counts up; the bubble
shows the sentence the way dictation shows a checked one (`SpokenSentence` compact + "Nghe lại" + a quiet "Rõ từng
từ"), the muted Ôn tập line for an enrolled miss, a line for a daily task just paid or a new title (both with
confetti). One primary button: "Câu tiếp" / "Xem kết quả" (Enter). The result card: how many lines were understood,
the xu, first listens on new lines (quick chats only: an episode's lines never, §2), the hearts won, a new title; "Về thị trấn" (primary) and "Nói chuyện tiếp". Esc or
✕ leaves at any time: the audio stops, answered lines are already saved. The panel shows the resident's 3D portrait at
88 px (56 px on a phone), smiling after a right answer.

**Building.** A row per lot (thumbnail, name, "<resident> · <topic>" or "còn thiếu N xu", price) and per decoration
still to buy; the decorations already bought are folded under one closed "Đã có trong thị trấn · N". With nothing
left to buy the panel says "Thị trấn đã xây đủ hết rồi." (never "Chưa đủ xu…"). Each thumbnail is the thing's own 3D
model alone in the town's noon light (`three/thumbs.ts`: `buildPlace`, `buildDecorations` with a few pieces close
together, the cat; drawn once per size by the shared offscreen renderer and cached): the string lights are two poles
with a string of bulbs between them, the lilies float on a little water. Exactly one row button is `.btn-primary`
(`primaryBuy`: the lot that was clicked when it can be paid, else the first affordable thing). Buying calls
`buyTownItem`, then the stage `celebrate(id)`: the camera travels to the spot, dust rises, the thing grows out of the
ground with sparkles (a place also gets confetti and its resident), the camera comes back. The camera frames the
new thing itself: a place's whole lot, or every piece of a decoration (the six flower beds lie all over town: it
zooms out until all six show), centred in what the HUD and the panel leave free, and the pop waits for a long glide; the xu counter ticks down
and, when the thing appears, a toast says what was built. On a narrow stage the sheet is half the stage high (the lot
stays in sight above it, the HUD keeps only "Xây") and closes on a buy so the new thing can be seen.

**Sound.** `coin`, `right`, `first`, `wrong`, `build`, `pop`, `level`, `task`: sine / triangle tones under a
second (the level-up a little longer), master gain 0.16. Never over English: `playSfx` is refused while any speech
is in flight (`currentUtteranceId()`), and a line that starts cuts what still rings (`stopSfx`). On/off is the
speaker button of the HUD, stored per browser (default on). No music.

**Keyboard and screen readers.** The canvas is `role="img"` with a label; right after it a list of real buttons
gives every action the pointer has ("Tới chỗ Emma ở Quán cà phê và bắt chuyện", "Xây Cửa hàng, 30 xu"): invisible
until one has the focus, then a pill in the stage's corner (without 3D the list is the visible list of residents).
Focus moves into the conversation panel when it opens, onto "Câu tiếp" after an answer, and back to the canvas when it
closes; the verdict and the result are said through one polite live region; the build panel is a `role="dialog"` that
returns focus to "Xây". Shortcuts are listed in `ShortcutsHelp`.

**Day, night and light.** (2026-11-21: the day sky is a clear blue down to a warm, hazy horizon instead of a pale
near-white, and the day rig has less flat light from all round and a warmer sun, so colours no longer wash out.) Day
in the light theme, night in the dark one (`Settings.theme`, the system scheme when it
is "system"); a change of theme turns the town over about 1.6 s. The light rig (`palette3d.ts` `DAY_RIG` /
`NIGHT_RIG`, blended by `lightRig`): a sky-and-ground hemisphere light and a soft sun from the viewer's left whose
shadow map (PCF, 2048², following the camera, snapped to its texels so shadows do not crawl) covers what is in view;
ACES tone mapping; no fog (the island ends in the sky canvas behind it). At night the windows glow by each place's
share of lines understood (`windowGlow(lit)`: a faint glow from the first day), the bulbs, the marquee and the string
lights glow, six real point lights move to the lamps nearest the camera, one wide soft warm light hangs over what the
camera looks at (so the town round the player reads warm, not murky), soft additive halos ring every lamp and
fireflies drift over the grass; the people get a faint cool self-light so faces read away from the lamps. The night
rig (2026-11-21, after a critique found the night "murky": dark saturated green, black trees) is a soft lavender sky
light with a mauve bounce from the ground, so trees stay readable. **Every light, halo and firefly is in the scene day
and night; only their strength changes**: switching a light or an object on or off rebuilds every shader (a freeze of
1.7 s at each theme change until 2026-11-21). The shaders are compiled before the first frame with the lights as they
will be, together with those of things shown only later (the goal ring, the hovered square, a house under the pointer
or faded in front of the player, glass, bulbs, water: `precompile`), so neither the theme change nor the first click,
hover or purchase waits for the graphics driver. The sky behind the island (gradient, clouds by day, stars by night) is
a 2D canvas redrawn 15 times a second; while the theme changes, night's sky is laid over day's by the night amount
(and the darker corners fade in the same way): no snap halfway. A wall or tree in front of the player (or the one they
talk to) is drawn with a soft noise-like dither (interleaved gradient noise; a 2 × 2 checkerboard until 2026-11-21).
Only what rises above the ground the person stands on can hide them (`Shared.holeFloor`, the hole sized from their
feet there): before 2026-11-25 the ground counted as 0, so on the hill (1.6 up) the slope and the stones in front of
the player were dithered in a hole far too big (owner: "nó đứng trên đồi mà?"). A room is lit to keep people's colours
(2026-11-25, owner: "sao mỗi chỗ model mỗi kiểu vậy?"): a near-neutral fill (`ROOM_SKY` / `ROOM_GROUND` in
`interiors/build.ts`), a key no stronger than the town's sun, the town's day exposure (`roomExposure` 0.92 by day),
and soft warm-white lamps at night (`LAMP_NIGHT` 1.8, not 4.5 of amber), so black hair stays black, jeans blue and
brown hair brown indoors as out. **A crowd stays cheap** (2026-11-26, owner: "sao thành phố lag dữ vậy?"; Westbay has
about 49 people against the town's 19): `lineClear` only looks at the people within PASS of its line, `walkPath`
marks the tiles crowded once (not every person for every tile the path finder tries), and anybody further from the
camera's target than what shows plus a margin (`reach`) is neither drawn nor posed (the sim walks them on). Measured
in headless Edge (software GL, 412×892): one walk's path in the city from up to 145 ms to under 40, the engine's own
work per frame from 22.8 ms to 13.9 (the town's that hour: 13.6); 0 of 1,920 checks found anybody on the screen
hidden. Not checked on a real phone. Trees, tufts, flowers and flags sway in a vertex shader, the lake and the
fountain ripple. Under reduced motion: no camera travel, no particles, no pop, no sway or ripples, the xu count changes
at once; people stand still in their pose (no breathing, no walk cycle, no nod / shake / wave; walking, they glide);
emotes and the "+N" stand still for a moment instead of rising.

**The lake** reads as water from every view: the island's floor lies below the pond's sandy bed inside a rounded
grassy rim (`buildTerrain`: one whole slab once covered the water with grass), the surface is a light-to-deep blue by
the distance from the shore with moving lines of light, earthen banks drop from the grass to it, lilies, ducks and the
pier sit on it. Its shore is a smooth curve, not the tiles' stair steps (2026-11-21, `scene/shore.ts`, tested): the
tile edges between water and land are relaxed into a curve that stays within `LAND_SLACK` (0.12 tile) of the water
tiles on the land side and `WATER_SLACK` (0.6) on the water side; the tiles beside the water are drawn along it
(marching squares on its signed distance, four cells a tile) with a sandy beach and a bank down to the bed. Walking
keeps the tiles: the drawn water never reaches under a body standing against a water tile (the test checks it), and
the bank that rounds a corner over the water is only seen, not walked on.

**Performance and size.** Measured in headless Edge on the owner's laptop GPU (ANGLE / Direct3D 11, RTX 3060 Laptop),
2026-11-21: 60 fps everywhere checked (1600 × 900 and 390 × 844 at 2× pixel ratio, day and night, a fresh town and a
rich one with every place, decoration and project, walking, a conversation, every panel): 64–130 draw calls,
430,000–570,000 triangles, the engine's own work 3.3–5.7 ms a frame (sim, people, camera, overlay; not the GPU). Merged
geometry (`merge.ts`: one mesh per place, chunked ground, instanced trees and tufts per 12 × 12 tiles since 2026-11-22), shared materials and one face
atlas keep the calls low. A device that cannot keep up gets lighter by itself, one step each time frames stay over
24 ms for two seconds (`setQuality`): a sharp screen drawn at a lower pixel ratio (never below 1), then a 1024² shadow
map, then no shadows (their shaders compiled in the background first, `compileAsync`), then 0.75 pixel ratio; eight
easy seconds in a row take one step back (never back to shadows: that would rebuild every shader). Frames that are
the page's own work do not count: the first 3 s, 1.5 s after a panel opens or something is bought, any single frame
over 100 ms, and every frame while a panel is over the town. With a panel open (a conversation, an activity) and
nothing gliding, the stage draws about 30 frames a second (`PAUSED_FRAME_MS`). The stage stops drawing while it is off
the screen. Per frame the engine makes no lists: name tags are measured once per text, the activity spots listed
once. The models of the dynamic layer are kept from one layout to the next by what they are (`world3d.ts reuse`):
buying one thing builds only that thing, and the lots on offer have their house made ahead in idle time
(`prebuildLots`), so a purchase builds nothing on the click. The conversation portraits (neutral and smiling, at the
panel's size) are drawn ahead in idle time after the town shows, the suggested resident's first, and the one walked up
to when the walk begins (`prewarmPortraits`, `warmPortrait` in `art.tsx`); the offscreen renderer's drawing buffer
only grows (a smaller picture is drawn in its corner), and an animated loot picture is drawn at most 24 times a
second. Measured 2026-11-21 (headless Edge, 1600 × 900, frames over 36 ms): the theme change 1,735 → under 34 ms
(an occasional single 67–83 ms frame as the whole page restyles), a conversation starting 150 + 83 → one frame of
67–83 ms (the panel's first paint), a purchase 117 → 24–35 ms, the camera's return from a new house 11.5 tiles in one
frame → at most 0.3 tile a frame, a right answer and leaving a conversation under 34 ms. three.js is its own chunk of
the web build (`three-*.js`, 580 kB, 146 kB gzipped; `vite.config.ts` groups it, `chunkSizeGuard` keeps the usual
500 kB warning for every other chunk), loaded only with the town page. The service worker does NOT precache it
(`BUILD.lazy`, stamped by `swBuildManifest`): it is cached on first use and copied into the next deploy's cache when
unchanged, so a learner who never opens the town never downloads it, and the town needs one online visit before it
works offline. The portable HTML has it inlined (about 3.0 MB in all) and needs no folder for the town. Leaving the
page frees the stage's context, the offscreen renderer, the shared character materials, hats and props.

What the stage offers the shell (`engine/stage.ts`, `TownStageHandle` / props): `talkAt`, `endTalk`, `emote`, `act(target, 'yes'
| 'no' | 'wave')`, `burst`, `walkTo`, `pointOf` (the top of a head), `float(target, text)`, `celebrate(id)` (a place:
its resident moves in), `walkToActivity(id, then)`, `focus()`, `box()`, `rect()`; state `sites` (the lots on offer),
`look` (`PlayerLook`), `extraDecor` (project ids); callbacks `onTalk` (a click / E on a resident: the page stages the talk), `onTalkCancel`, `onLot`, `onNear`, `onIdleAct`, `onActivity`,
`onReady` (the first frame is drawn), `onFail` (no 3D after all); props `speaking` (the bubble with bars over a
resident, or over the player with `'player'`), `inset` (pixels a panel covers at the right / bottom), `safe` (what
the HUD covers along each edge), `hint` (the suggested resident), `full`,
`overview`.

Not there (know it before you promise it): no walking sound, no music; the bus does not drive in, it pops up with the
bus stop; the player wears no hard hat when building; the build animation is skipped entirely under reduced motion;
on a phone shorter than about 640 px the strip above the conversation is still not big (230 px at 375 × 667 while
listening, less line by line; the panel scrolls). **Nobody has
watched the 3D town move or played it on a real device**: everything above was checked as screenshots and numbers in
headless Edge (AGENTS.md §9).

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
  was heard once already in the whole exchange (so it is never counted as a first listen, §2).
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
first), else the **next episode** of the place not finished yet (episode 1 of every place is open from the start,
a lodger's too; episode n + 1 once episode n is finished AND the place is built: it is told at the resident's home,
`needsHome`, §3 "What building adds"), else the old five unrelated lines, now called **"Trò chuyện nhanh"**. The result card of an
episode offers "Trò chuyện nhanh" with the same resident.

### Where it happens (`setting`, 2026-11-21)

The owner saw Emma's "Ly cà phê đầu tiên" played on the grass by a planter: "quán cà phê gì ở ngoài đường?". Every
episode now says where it happens (`StoryEpisode.setting`, `core/town/story.ts`): `{ kind: 'inside', room }` (a
place's room in `three/interiors`, or `'inn'`, the boarding house's common room) or `{ kind: 'outside', at }` (in front
of that place). It fits the scene line and the lines; a setting names only the episode's own place, one of the three
that stand from the start, or the inn (the stage can never enter or stand at an unbuilt place).

- **Lodgers.** Episode 1 is heard before the house is built (§3), so an episode 1 whose setting needs its own place
  has a `lodgerSetting` that needs no unbuilt place (the inn, or the plaza), and its scene line is true in both.
  Episode 2 on needs the house anyway. Resolve with `episodeSetting(episode, isBuilt)` (`data/townStories.ts`).
- **Quick chats** have one setting per place (`QUICK_CHAT_SETTINGS`, `quickChatSetting(placeId, isBuilt)`): outside
  at the door for the homes, the plaza, the bus stop, the park and the notice board, inside where the resident works;
  at the inn while the place is not built.
- Changing a setting never touches the audio: line `text` / `say` are unchanged (a test checks every line still has
  its shipped clips in `public/audio/manifest.json`).

| Place | Episode 1 | while lodging | Episode 2 | Quick chat |
| --- | --- | --- | --- | --- |
| square (Leo) | outside, plaza | (stands) | outside, plaza (fountain) | outside |
| cafe (Emma) | inside café | (stands) | inside café | inside |
| friend (Mia) | outside, by her window | (stands) | inside, living room | outside |
| home (Grace) | outside her door | inn | inside, living room | outside |
| shop (Ben) | inside shop | plaza (a stall) | inside shop | inside |
| office (Sarah) | inside office | plaza (on her way) | inside, meeting | inside |
| school (Daniel) | inside classroom | inn | inside classroom | inside |
| station (Sam) | outside, bus stop | inn | inside, waiting area (lost and found) | outside |
| clinic (Kim) | inside clinic | inn | inside clinic | inside |
| cinema (Zoe) | inside, ticket desk | plaza (selling tickets) | inside lobby | inside |
| phone (Max) | inside shop | inn | inside shop | inside |
| park (Lily) | outside, bench | plaza bench | outside | outside |
| board (Tom) | outside, notice board | plaza | inside, community hall | outside |

### The three steps of a new episode

1. **Nghe cả đoạn.** The title "Tập n · <title>", the scene in one Vietnamese line, then the whole exchange in one go:
   every line connected (`storyLinePlayback(line, episode, 'connected')`, `core/town/storyAudio.ts`: the same text and
   voice the clip generator uses), at the learner's rate (level 1 a little slower, as in dictation), a pause of 450 ms
   when the speaker changes and 220 ms when the same one goes on (`passGap`). No text. The speaker gets the bubble in
   the town: the resident, or the player for the learner's own lines (`TownStage` `speaking: 'player'`); a neighbour
   who drops by in person gets it in the room (`episodeVisitor`, §7 "Staging"), one only on the phone (Max) is only heard. It starts by itself 0.7 s after the panel opens (`auto`: never a paid request); where
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
episode to hear (episode 1 before 2), then lines not understood, then repeats. Lodgers are suggested too; among equals
the lower episode number first (everybody's episode 1 before anybody's episode 2), then a resident at home before a
lodger, then the place known least.

### Rewards

| What | Xu |
| --- | --- |
| a line of an episode | 3 right after one play of it on its own, 2 with replays, the first time it is understood; then 1; wrong 0 (`storyLineReward`) |
| the gist right after one whole listen, on the episode's very first listen | +5, once per episode |
| the first finish of an episode | +10 |
| a re-listen with the gist right | +3 |

A finish and a re-listen count as a conversation for "Trò chuyện với 2 người dân"; every line understood counts for
"Hiểu 8 câu". **No line of an episode counts as a first listen** (§2, `keptOutcome`): not for "Hiểu 4 câu ngay lần
nghe đầu", not for the first-listen achievements ("Nghe một lần", "Tai nhanh", "Tai vàng") or the project "Tháp đồng
hồ", not for xp; its 3 xu are a game reward for one play on its own, not a measurement. The line is recorded at
`best` 1 (understood). Lines of the episodes count for xp as lines understood (2 each, `storyTotals`); hearts and lit
windows stay on the place's own sentences, so a new episode never takes a heart away.

Builds before 2026-11-21 counted a step-2 line answered after one play as a first listen (stored `best` 2 and the
day's `first`). Those records stay as they are (a sync merges by max) but are read as understood only; achievements
and projects already recorded in `unlocks` are kept (nothing earned is taken away), past days' counters and tasks are
not rewritten, and no new first-listen credit comes from an episode. A perfect first run of a 6-line episode pays 6 × 3 + 5 + 10 = 33 xu without the daily tasks.

### Stored

`episodes[episodeId] = { stage, at, okAt, firstGist, bestLines }` in the town progress (§4): `stage` 0 = begun (the gist
answered), 1 = finished, +1 per re-listen whose gist was right (at most 5); `at` = the last whole listen that counted
(the finish or a re-listen); `okAt` = the last of those whose gist was right (the finish counts); `firstGist` 0 = not
asked, 1 = not right on the very first listen, 2 = right on it; `bestLines` = most lines understood in one run. The
next re-listen is derived (`episodeDueDay`: `at > okAt` → the next day, else `RELISTEN_DAYS[stage − 1]` days after
`at`), never stored, so the merge stays a max per field.

### Store calls (`core/town/store.ts`)

- `startTownEpisode(placeId)` → `{ ok: true, place, episode, mode: 'new' | 'relisten', turns: [{ line, choices, who,
  speaker }], gist: { options, answer }, met, firstListen }` or `{ ok: false, reason: 'unknown' | 'none' }`
  ('none': nothing waits, or the next episode waits for the house: the quick chat). A lodger is never refused. Writes nothing.
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
  of that line on its own after that. The verdict never says "nghe một lần đã hiểu" (`Episode.tsx` passes `met`), and
  nothing counts it as a first listen (§2).
- **Re-listening knows the story.** By the first re-listen the learner has read the transcript; a right gist then says
  the exchange is still followed at speed, not that it was decoded from scratch.
- **Two machines** that each finish an episode before a sync are each paid its first finish (+10), as each would be
  for a new line. The merge keeps the higher of everything, including `firstGist`.
- Not checked by ear: the pauses between turns, the voices and the clips themselves (none are generated yet).

## 10. Vòng chơi: the game loops

The owner found the town boring next to a social town game with many loops. These loops are added, under the same
rule as everything else here: **every reward comes from listening.** A fish is caught by hearing what it said; the
farm is Ôn tập; eggs come from listening milestones or from xu (which come from listening); achievements and town
projects count listening. No real money anywhere, nothing is bought with anything but xu, and xu stay a game score
(§8). Catalogs in `src/data/townGame.ts`, rules (pure) in `src/core/town/{fishing,farm,eggs,wardrobe,unlocks}.ts`,
IO and hooks for the panels in `src/core/town/gameStore.ts`. The panels themselves are `src/features/town/activities/`
(contract `activities/types.ts`).

### Câu cá (`fishing.ts`)

A cast hooks a fish; the fish SAYS one short built-in item, always with a shipped clip, and the learner picks what was
said before the line snaps:

| Item | Plays | Options |
| --- | --- | --- |
| a chunk of Cụm từ (`data/chunks`), first phenomenon = the species' | `speak(ttsText, { mode: 'connected' })` | 4 written chunks: the right one and the 3 most confusable of 8 (same phenomenon, length; never one that sounds the same) |
| one sentence of a minimal pair (`data/pairs`) | `speak(option)` mode-less, as Phân biệt âm | the item's 2–3 sentences |
| a dictation sentence (`data/sentences`) of the species' levels with its phenomenon in `focus` | `dictationAudio(line).connected`, mode 'connected', as a town conversation | 3 Vietnamese meanings (`visit choicesFor`, the sentence's topic as the pool) |

`FishItem.play` says which (`{ kind: 'clip', text, mode }` or `{ kind: 'line', line }`).

**The tip after a cast comes from the item itself** (`FishItem.tip`, `fishTip(species, entry)`; QA 2026-11-21: "tell
them" was explained with gonna / wanna, the species' examples): `{ phenomenon, label, text }`, the phenomenon always
one the item has. A chunk: the decoder's annotation of its words for the species' phenomenon, else for one of the
chunk's own labels (its rule), else the plain summary of its first label (`core/phenomena`); a minimal pair: its set's
phenomenon and the item's own `cue`; a sentence: the decoder's annotation for the species' phenomenon, else one in its
`focus`, else the first one. A test runs it over every pool item. The species' one-line `fact` stays on its album card.

**24 species** (`FISH_SPECIES`), each tied to one phenomenon, with a Vietnamese name and a one-line fact (its album card):

| Tier | Count | Items | Time (chunk / pair / sentence) | Plays | Xu (first listen / replays) |
| --- | --- | --- | --- | --- | --- |
| thường | 8, one per phenomenon | chunks | 7 / 9 / 12 s | 3 | 1 / 1 |
| hiếm | 8 | level 1–2 sentences, minimal pairs (weak-form, h-dropping, contraction) | × 0.9 | 3 | 2 / 1 |
| quý | 6 | level 3 sentences (h-dropping 2–3) | × 0.8 | 2 | 3 / 2 |
| huyền thoại | 2 (Cá Rồng Nối Âm, Cá Koi Vàng) | level 3 sentences with 3+ phenomena | × 0.75 | 2 | 5 / 3 |

- `rollCast(progress, seed, { streak })`: a tier by weight (62 / 26 / 10 / 2), a species of it (one not caught yet
  weighs twice), one of its items. A streak of catches in this tab (at most 5 counted) moves weight from thường to the
  rarer tiers (+2 / +1.5 / +0.5 per catch). Quý bites only after 3 catches, huyền thoại after 15. Deterministic
  (seeded).
- `catchOutcome(cast, { correct, plays, ms })`: caught when right, within `timeLimitMs` (from the end of the first
  play, the panel's clock) and within `maxPlays`; else `wrong` / `slow` / `replays`. `plays` 0 = `unplayed`: a guess,
  recorded nowhere.
- `applyCatch`: the species' record (`seen`, `caught`, `firstAt`, `bestMs`, `at`), the xu, the day's counters
  (`fish`, `fishFirst`, `fishXu`) and any daily task reached. **A first catch of a species pays +2. Fishing pays at
  most 30 xu a day over every browser (`FISH_DAILY_XU`); casts stay unlimited** (practice). Fishing does not keep the
  town streak (only a town line does) and does not write Ôn tập or the practice stats.
- Closing the panel with a fish on the line (`castMachine` 'abandon', `abandonAnswer`): once the fish has spoken (a
  play started) and nothing was picked, the cast is recorded as the line snapping (an escape: `seen` +1, the catch
  streak back to 0), so closing is never a free way out of a hard fish. Before the fish spoke nothing counts.
- `fishAlbum(progress)`: every species in tier order with caught / seen / record, counts per tier.

### Nông trại (`farm.ts`): the crops are the review cards

Nothing grows by itself and nothing is harvested by a click: a crop is ripe when its card of Ôn tập is due, and it is
harvested by reviewing it in Ôn tập.

- `farmPlots({ entries, store }, now)`: one plot per (kind of card, state): `wilting` (due for more than 3 days),
  `ripe` (due now), `growing` (due later today or tomorrow; `growth` 0..1 from the card's last change to its due time),
  `seedling` (created today, not due yet). Cards due after tomorrow are `resting` (counted, not on the field).
- `farmHarvest(progress, summary, now)` / `applyHarvest`: **1 xu per card reviewed in Ôn tập today
  (`summary.reviewedToday`), at most 20 cards a day over every browser (`FARM_DAILY_CARDS`), and the golden crop
  (+10, once a day) when today's review is done** (`summary.dueToday` 0 with at least one card reviewed). The golden
  day goes into `farmDays`. Stored: `daily[day][device].harvest` (the cap is over the sum of the browsers: a review
  synced from the phone is never paid twice) and `farmDays`.
- **The panel's numbers are Ôn tập's** (QA 2026-11-21: the farm said "Thu hoạch (9 cây), khoảng 6 phút", Ôn tập then
  "Phiên này: 8 mục · khoảng 5 phút"): the headline says today's count (`summary.dueToday`, Ôn tập's title), and the
  button and its minutes name the session "Thu hoạch" opens, from the same function as Ôn tập's start card
  (`features/review/sessionPlan` `nextSessionPlan` / `sessionSize`: the queue within the review budget, its own minutes
  when today is split into sessions). Split: "Thu hoạch (8 cây)", "Phiên này: 8 cây, khoảng 5 phút."
- **The field in the world** (`farmFieldLook(input, now, slots = FARM_LOOK_SLOTS)` → `{ slots: CropStage[], counts,
  ripe }`, or `fieldLook(field, slots)` from a field already computed; `CropStage` = `'empty' | 'seedling' |
  'growing' | 'ripe' | 'wilting'`): one stage per planting spot, from the same `farmPlots` the panel reads, wilting
  and ripe first, then growing, seedlings, bare soil. Fewer cards than spots: one crop per card; more: shared in
  proportion, every stage with a card keeps a spot. So a ripe crop in the world is a card due in Ôn tập, and with
  nothing in the panel's "Đã chín" the world shows no ripe crop.

### Tiệm trứng (`eggs.ts`)

- **Eggs earned by listening** (`eggGrantsDue`, granted with every write): `gist:<episode>` the gist right on the very
  first listen; `fish:<species>` the first catch of a hiếm / quý / huyền thoại species; `farm:<day>` the golden crop;
  `perfect:<day>` a quick chat with all 5 lines right (one a day); `streak:<day>` a town streak reaching 7, 14, 21 …
  days. About two a day at most. Only 400 active days are kept (`DAYS_KEEP`), so once the list is full the oldest run
  may have begun before its first kept day: that run counts on from its last streak egg already given (in steps of 7),
  every other run from its own first day (`streakMilestones(days, 7, anchors)`). A milestone day never moves once
  given, so it is given once (tested over 500 days in a row).
- **Eggs bought**: 40 xu (`EGG_COST`), from the balance like a decoration (`economy spentTotal` counts them).
- **Hatching** (`hatch` / `applyHatch`): a tier by weight 60 / 28 / 9 / 3, an item of it (one not owned yet weighs
  three times more); **at least one quý-or-better every 10 eggs of a browser** (the pity rule, `EGG_PITY`); an item
  owned already gives its tier's xu instead (4 / 8 / 15 / 30: always less than an egg, so buying eggs never makes xu).
  The result of an egg is fixed by (browser, number of its egg): a reload never re-rolls.
- **Loot** (`LOOT`, 35 items): 8 pets (chó con, vịt, mèo mướp, gà con, thỏ, rùa, cáo, gấu trúc), 9 hats (mũ len, mũ
  rơm, nón lá, mũ lưỡi trai, vòng hoa, mũ đầu bếp, mũ cao bồi, mũ phù thủy, vương miện), 10 outfit colours (`color` is
  a canvas colour for the engine), 8 titles. Every kind has every tier. The town's cat stays a decoration.

### Tủ đồ (`wardrobe.ts`)

`equip(progress, slot, id | null, now)` wears something owned in `hat` / `outfit` / `pet` / `title`. The look is a
value replaced as a whole, so it carries its own change time (`look.at`, moved on by at least 1 ms per change); the
merge keeps the look changed last, whole (never the hat of one machine and the pet of the other). Titles that can be
worn (`availableTitles`): every town level reached (`level-<n>`), the achievements and projects recorded, the egg
titles owned. `lookView(progress)` resolves it for the engine; something worn that is not owned on this machine yet
(a look synced before its item) is drawn as nothing.

### Album, thành tích, danh hiệu, dự án (`unlocks.ts`)

- **34 achievements** (`ACHIEVEMENTS`), each with a title: lines understood (10 / 50 / 150 / 300), on the first listen
  (25 / 100 / 250; quick-chat lines only, an episode's line never is, §2), gists right on the first listen (1, "Tai thính" 10), episodes (1 / 10 / all: "Người kể chuyện"),
  10 re-listens, fish (1 / 50 / 200), species (half: "Nhà sưu tầm", all), a huyền thoại fish, every species of one
  phenomenon (eight "Bậc thầy …": nối âm, âm yếu, chữ T, gonna, nuốt âm, hòa âm, mất H, rút gọn), farm days (1 / "Không
  bỏ cây nào" 7 / 30), 25 mature review cards ("Vườn lâu năm", needs Ôn tập facts), best streak (7 / 30), 10 days with
  a perfect chat.
- **5 town projects** (`TOWN_PROJECTS`), long goals with a progress bar, each adding a permanent world decoration
  (`decoration`, drawn by the engine) and a title: Thắp đèn quanh hồ (100 lines, `proj-lake-lights`), Lễ hội mùa thu
  (10 episodes, `proj-festival`), Bến cá mới (60 fish, `proj-pier`), Vườn cộng đồng (10 farm days, `proj-garden`),
  Tháp đồng hồ (150 lines on the first listen, `proj-clock-tower`).
- `townMetrics` → `achievementsUnlocked` / `projectsDone` (pure, what the totals reach now) → `settleTown` (with every
  write: grants the eggs due, records the new achievements and projects in `unlocks` with the time) →
  `achievementsView` / `projectsView` (value, target, 0..1, `unlockedAt`), `projectDecorations`.
- Celebrations: what a write newly unlocks is queued in the store (`useTownCelebrations()`, `townCelebrations()`,
  `clearTownCelebrations(keys?)`; page state of the tab), whichever call made the write (an answer, an episode, a
  cast, a harvest), with a Vietnamese `label` and `detail`.

### Daily tasks (`daily.ts`)

Three a day from a pool, drawn by the local day (`dailyTaskIds`): one is always `lines` or `first`, two others from
the rest. **The first write of the day on a browser fixes them** (`fixDayTasks`, stored as `daily[day][device].tasks`;
the store fixes them from the progress before that write, so a place built by it does not count yet), so nothing
later that day redraws them: not a place built, not a sync. Until that first write the list shown is the draw as it
would be fixed now. Only the fixed tasks pay, and never more than three a day (a row of an older build that paid three
already pays no fourth).

| id | Label | Goal | Xu |
| --- | --- | --- | --- |
| `talk` | Trò chuyện với 2 người dân | 2 residents | 5 |
| `lines` | Hiểu 8 câu | 8 | 8 |
| `first` | Hiểu 4 câu ngay lần nghe đầu | 4 (quick-chat lines only, §2) | 10 |
| `fish` | Câu được 5 con cá | 5 | 6 |
| `fish-first` | Câu 3 con cá ngay lần nghe đầu | 3 | 8 |
| `harvest` | Thu hoạch 5 cây ở nông trại | 5 cards paid as a harvest | 6 |
| `episode` | Nghe trọn 1 tập chuyện | a finish or a re-listen | 8 |

A day pays 17 to 26 xu (`DAILY_TASKS_XU` = 26, before: 23). A task enters the draw only when it can be done
(`eligibleTasks`): `harvest` once the learner has harvested on an earlier day, `episode` while an episode that can be heard
(episode 1 of any place, a later one at a built place) is not heard through (or one heard through today). A task paid
today always stays in the list. Each browser fixes its own three: two browsers whose first writes saw different
eligible tasks (say the farm on one only) can show different lists that day.

### Economy at a glance (a day, every browser together)

| Source | Xu |
| --- | --- |
| conversations and episodes | as before (§3, §9), uncapped |
| daily tasks | 17–26 |
| fishing | ≤ 30 (`FISH_DAILY_XU`) |
| the farm | ≤ 20 cards + 10 golden |
| duplicate items from eggs | 4–30 per duplicate (only from eggs, which cost 40 or were earned) |

Spending: places 20–110, decorations 8–40, an egg 40.

### Stored (`progress.ts`, version 4)

```ts
fish:     { [speciesId]: { seen, caught, firstAt, bestMs, at } },   // max of the counts and of `at`, min of firstAt / bestMs (> 0)
farmDays: string[],                                                  // union, newest 400
eggs:     { grants: string[], bought: { [device]: n }, hatched: { [device]: n }, rare: { [device]: n } },   // union; max per device
owned:    { [itemId]: firstAt },                                     // union, min of the time
look:     { hat, outfit, pet, title, at },                           // the later `at` wins; a tie: the larger canonical string
unlocks:  { [achievementOrProjectId]: firstAt },                     // union, min of the time
daily[day][device]: { …, fish?, fishFirst?, fishXu?, harvest?, eps?, perfect? }   // optional counters, max
daily[day][device].tasks?: string[]                                  // the day's fixed tasks; none takes the other's, two lists: the one whose ids come first
```

Idempotent, commutative, associative (`syncMerge.props.test.ts` generates version 2–4 towns with junk in every new
field). A version 3 value reads with none of it; its first version 4 write grants the eggs and records the
achievements the stored listening already earned (they are celebrated then). A machine still on a version 3 build
writes the value back without the new fields; the account sync brings them back (unions), but until it runs the new
build its balance does not subtract the eggs bought. Known limits: a species caught on two machines before a sync
counts the larger of the two catch counts, not the sum; two browsers hatching the same egg before a sync each keep
their item (eggs in hand never go below 0); `rare` / `hatched` are per browser, so the pity rule is per browser.
**Honest limit of the per-browser counters (by design):** two machines used offline before a sync can each hatch the
same earned egg, each spend the same xu (the balance can then read below 0 and shows 0 until more is earned) and each
take the day's harvest pay up to the cap; the sync keeps both sides' results rather than undoing one. It costs a few
game xu, never listening data.

**Older and newer builds.** A build reads any version. A value written by a NEWER build (`version` above this
build's 4) keeps its unknown top-level fields and its version through parse, merge and every write (`townExtras`;
two copies that both carry one keep one of them whole, the larger JSON text, so the laws hold), so this build relays a
newer build's fields instead of stripping them. Fields a newer build adds INSIDE known ones (a new counter in a daily
row) are still dropped, and the guard only exists from this build on: **a build from before 2026-11-21 (the version 3
web deploy and every old portable copy) strips all version 4 fields when it writes through account sync.** The newer
machine brings them back at its next sync (unions; the look by its time), but a machine set up fresh from the account in
between starts without them. So: replace every portable copy (OneDrive `NgheNoiAm` folder and any other) with a new
build, and reload any open tab of the web app once the deploy is live, before playing on more than one machine.

### What the panels call (`gameStore.ts`)

- `useTownGame()` → `{ balance, eggs: { inHand, cost, canBuy, missing, toPity, odds, grants }, album, fishXuLeft,
  owned, look, titles, achievements, projects, decorations }` (live; `townGameView(progress, now, device)` is the pure
  version).
- `startCast(now?)` → `FishCast` (writes nothing) / `finishCast(cast, { correct, plays, ms }, now?)` → `{ outcome, xu,
  capped, newSpecies, record, tasksPaid, earned, balance, streak, celebrations, saved }` (a cast answered twice is
  recorded once). `fishingStreak()`.
- `useTownFarm()` → `{ field, harvest }` (live from Ôn tập) / `claimHarvest(now?)` → `{ cards, xu, golden, tasksPaid,
  earned, balance, celebrations, saved }`.
- `buyTownEgg(now?)` → `{ ok, balance, inHand, … }` or `{ ok: false, reason: 'poor' | 'device', missing }`;
  `hatchTownEgg(now?)` → `{ ok, hatch: { item, tier, duplicate, xu, pity, n }, balance, inHand, … }` or `{ ok: false,
  reason: 'no-egg' }`.
- `equipTownItem(slot, id | null, now?)` → `{ ok: true, look }` or `{ ok: false, reason: 'not-owned' }`;
  `townLookView()` for the engine.
- `checkTownUnlocks(now?)`: records the goals that need Ôn tập facts ("Vườn lâu năm"); writes nothing when nothing is
  new.

### The extras in 3D

Built in code like the rest of the town (§7), shown in the world and, through the shared offscreen renderer, in the
panels (`three/loot3d.ts`: the egg shop's reveal, the wardrobe's tiles and its live preview).

- **Pets** (8, `three/chars/pets.ts`): a puppy, a duck, a tabby, a chick, a rabbit, a turtle, a fox, a panda
  cub, plus the town's cat. One skinned mesh each, bead eyes that blink, a gait driven by the distance walked (trot,
  waddle, hop, crawl) and idle life (tail, ears, looking about, sitting down after a while).
- **Hats** (9, `three/chars/hats.ts`): fitted over each hair style and carried by the head bone, so they nod, shake
  and walk with the player.
- **Outfit colours**: `setOutfit(color)` paints the player's top in the loot item's colour (`LootItem.color`).
- **Project decorations** (`scene/props3d.ts buildProject`; where they stand: `engine/extraDecor.ts`, tested to be
  in the world; nothing there blocks a tile): Thắp đèn quanh hồ = five lotus lanterns floating on the lake, lit at
  night; Lễ hội mùa thu = a stage on the open meadow south of the plaza (23.3, 30.6); Bến cá mới = the pier goes on
  over the water from its old end (12.15, 15.5); Vườn cộng đồng = raised beds behind the boarding house (2, 29); Tháp
  đồng hồ = a clock tower where the lake path comes in, beside Leo's pavilion (16.4, 17.6).

### The panels (`src/features/town/activities/`)

- **Tiệm trứng** (`EggPanel.tsx`, `eggs/`): the egg (game art, `eggs/eggArt.ts`), how many are in hand, ONE primary
  button ("Ấp trứng (còn n quả)" with an egg, else "Mua trứng · 40 xu", disabled when short, with what is missing),
  "Mua thêm" as a ghost button, the pity line ("Còn n quả nữa là chắc chắn có một món Quý trở lên"), the five ways eggs
  are given for listening with how many came of each, and a closed "Tỉ lệ ra đồ, nói thật" (60 / 28 / 9 / 3 %, what a
  duplicate gives, that buying never makes xu, that it is all cosmetic). Hatching is a show (`eggModel.hatchPhase`):
  the egg wobbles (0–1.1 s), cracks (to 1.75 s), bursts in its tier's light, and the item appears with "Mới!" or "Đã
  có" (its xu fly to the counter through `onReward`), its kind, tier and name, and "Đội ngay / Mặc ngay / Dắt theo /
  Đeo danh hiệu". Under reduced motion it appears after 0.35 s. Sounds through `playSfx` when sound is on.
- **Tủ đồ** (`WardrobePanel.tsx`, `wardrobe/`): the player drawn live in 3D (`three/loot3d.ts`: his hat, the outfit
  colour, the pet beside him, breathing and blinking), the title worn; tabs Mũ / Áo / Thú cưng / Danh hiệu. Owned items are tiles that wear
  at a click (`equipTownItem`), the first tile wears nothing; items not owned are silhouettes ("Chưa có" and the tier).
  Titles: every title available, the egg titles not owned as locked rows, and how many more come from achievements,
  projects and levels. Pictures: `eggs/LootPicture.tsx` (a pet whole, a hat on the player's head, the player in an
  outfit, a title as a ribbon icon; still pictures cached, the reveal alive; also used by the egg shop's reveal).
- **Sưu tầm** (`AlbumPanel.tsx`, `album/`): calls `checkTownUnlocks()` when it opens. Thành tích (folded on
  2026-11-23, the owner found 34 rows "scroll dài quá"): one row per chain (`albumChains`: the achievements of one
  metric, 10 → 50 → 150 → 300 câu, the eight "Bậc thầy" side by side; 13 rows), showing the step to work on (the
  locked one closest to done: name, blurb, a bar with "37 / 100 câu" beside it) and a dot per step (filled = reached);
  chains closest to done first, finished chains last ("Xong cả chuỗi" and the last title). The reached ones, newest
  first with title and date, are folded in a closed "Đã đạt (n)". Dự án: each
  project with its bar, what it adds to the town and where, its title. Cá: species caught per tier and in all, and a
  pointer to Chơi → Câu cá (the fish panel owns the album itself).
- **Celebrations** (`album/Celebrations.tsx`, shown by TownPage): the oldest entry of `useTownCelebrations()` as a
  banner under the HUD counters, confetti over the player and a sound, for 3.6–7 s (longer for more words) or until
  closed, then `clearTownCelebrations([key])` and the next. An achievement names its title, a project what it adds to
  the town and where, an egg why it came and that it opens in Tiệm trứng.

Checked in headless Edge only (1600×900, 390×844, 375×812, light and dark; seeded towns: rich, poor, a celebration
queue): no horizontal scroll in the panels. Nobody has watched a hatching, heard its sounds or judged the pets and hats
in motion.

### Honest limits of the loops

- **Fishing is a game.** 4 written chunks have a 25% floor, a minimal pair 33–50% (most pair items have 2 sentences),
  3 meanings 33%. A catch, a species, a title are game scores, never a measurement; the measurements stay "Nghe 1 lần
  là đúng" in Chép chính tả and Video thật, and Kiểm tra định kỳ. The written chunk options can be matched from a
  single sound; the time limit is what makes it about hearing, and it was never tuned with a person.
- **The farm pays for reviewing, not for remembering.** A card reviewed and missed pays like one remembered; the
  golden crop means today's sessions are done, not that the cards are known.
- **Eggs, pets and hats are cosmetics.** They change nothing in what is said or how it counts.
- Not seen by a person yet: the egg shop, the wardrobe and the album exist (above) but were only looked at as
  screenshots, so none of the numbers above (times, odds, caps, prices) was tried in play.

## 11. Bản đồ: the map of the whole town (2026-11-21)

The owner asked to see the whole town at once ("thêm bản đồ vào đi tao muốn xem toàn diện map"). Code in
`src/features/town/map/`; nothing in it is stored.

### The full map (`TownMap.tsx`)

- **Opening:** the HUD's "Bản đồ" (lucide Map; only its icon on a stage narrower than 740 px), the M key (not while
  typing or with a dialog open), or a click on the minimap. M, Esc and ✕ close it (Esc first drops what was picked).
  It covers the stage (in full screen too), the stage takes no input meanwhile (`paused`), and the main button at the
  bottom, Leo's welcome and the minimap step away so the card's button is the one primary on screen. Opening it gives
  up a talk still being walked to; in a conversation it waits. Focus goes to the map, and back to the HUD button or
  the town when it closes.
- **The picture** (`drawMap.ts`, a canvas, redrawn only when the view, the town or the theme changes; about 1.5 ms):
  the island from the world data, seen from high up at a slant (`MAP_TILT` 0.6) and never turned with the camera:
  it always lies the default way, like the minimap (owner, 2026-11-23) (`mapView.ts`: at the default turn the tile (0, 0) is the
  top corner, as in town). Grass with an earth cliff under its near edges, the lake, the paths and the plaza, the farm's
  fields, trees as soft round crowns (blossom trees once bought), the fountain once bought, and the houses as small
  blocks with walls and roofs in each place's colours (`PLACE_ART`, the 3D recipes' colours). Honest about building:
  a built place stands in colour; the lots on offer are building sites (a plot of sand with a dashed rim, like the
  site in town); every other lot is only a faint dotted outline on the grass. Game art like the rest of the canvas
  (palette3d colours, sunk into dusk by `ink` at night, the sky of `engine/palette.ts` round the island).
- **Over it, as DOM** (tokens, `map.css`, prefix `town-map-`): the parts of town (`WORLD_DISTRICTS`, quiet capitals;
  a district named like a place, Quảng trường and Bến xe, is left to the place), the places' names as small chips
  (built solid, lots dashed and muted; a button each), "Nhà trọ", the five activities as round icons, the residents
  as small portraits where they stand now (faint while indoors), a badge only on the one the main button suggests
  (whatever waits there: "!", an episode, a re-listen) and on every re-listen that is due (`mapBadges` in
  `mapCard.ts`, tested; since 2026-11-21: early on nearly every face had an episode badge, which said nothing), those
  drawn over the names, with one legend line under the title ("Nên gặp tiếp", "Nên gặp tiếp: đến hạn nghe lại",
  "Đến hạn nghe lại": `badgeLegend`); what waits elsewhere is in the card of whoever is picked, the walk's goal, and the player as a round arrow the way they face. Names are placed by priority
  (`mapLabels.ts`: built places, then districts, building sites, the boarding house, other lots; each tries a few
  sides, a district a few spots in its box) and a name that would cover another name, an activity's icon or the map's
  own buttons is left out until zooming in makes room. Names lie over the residents; the player over everything.
- **Live:** every animation frame the map reads `mapSnapshot()` from the stage and moves the player, the residents and
  the goal (direct style writes, no React render per frame).
- **Looking round:** drag (mouse, a finger), the wheel and a pinch zoom round the pointer, the arrow keys pan, + and −
  zoom, and the buttons on the right zoom and come back to the player. The zoom stays between a little less than the
  whole town and houses a thumb wide, the middle of the view over the town (`scaleLimits`, `clampView`). It opens on
  the whole town where that is readable (11 px a tile and up, `MAP_READABLE`: a laptop), else at that zoom centred
  on the player (a phone; the "Bản đồ" button is the way in there).

### Picking and going (`mapCard.ts`, `mapHit.ts`, `mapGeo.ts`)

- A click on a name, a house (roof and walls, `hitMap` over the drawn outline, the nearer one first), an activity's
  icon or prop (the pier, the fields, the kiosk, the boarding house, the board), a resident, or bare ground (a pin)
  opens a small card: the place and who lives there and where they are now ("Emma đang ở Phố chợ", from the district
  under her), what waits ("Tập 1 · …", "Nghe lại tập 2 · …", "Có câu chưa nghe hiểu"), for an empty lot "Đất trống"
  and its price ("Xây · 30 xu · còn thiếu 10 xu"); an activity its blurb; bare ground the district's name and "Đi tới đây".
  Nothing on the lake or off the island.
- Two buttons, exactly one primary: **Đi tới** (the normal click walk: a place's door, beside a resident who waits,
  an activity's spot, a tile; the map closes and the camera follows) and **Đến ngay** (the map dissolves while the
  town dips to dark, the player is put there and the camera is on them at once; residents stay where they are; a
  plain cut under reduced motion). "Đến ngay" is the primary for somewhere more than 12 tiles from the player
  (`WARP_FAR`), "Đi tới" nearer. Neither opens anything on arrival: the main button at the bottom then offers the
  talk, the build or the activity as usual.
- Where "Đến ngay" puts the player (`warpSpot`): a place's door tile looking out to the street; a free tile beside
  the resident (across the screen from them first) looking at them; an activity's spot looking at it; the tile (or
  the walkable one nearest to it) keeping the heading. Never on somebody.

### The minimap (`MiniMap.tsx`)

A round map, 132 px, in the stage's bottom-left corner on a wide stage: the streets round the player (11 tiles to the
rim), straight down, always turned the default way (the farm towards the top right), whatever the camera's turn (until
2026-11-22 it turned with the camera; the owner wanted it fixed once the camera could turn all the way round), the residents as dots in their house's roof colour with a ring in their marker's colour for the suggested one
and a re-listen that is due (as on the map),
and the player as an arrow in the middle. Drawn only when something moved (about 0.2 ms). A click opens the full map.
Hidden on a phone (≤ 720 px: the HUD button is enough), during a conversation, a panel or Leo's welcome, and while the
map is open.

### The stage handle (`engine/stage.ts`)

- `mapSnapshot(): MapSnapshot | null`: the player (`x`, `y`, `heading`), the residents (`id`, `x`, `y`, `marker`,
  `inside`), the walk's `goal`, `cameraYaw`, `away` (a room or a dip on the stage). Null without a world.
- `travelTo(target, 'walk' | 'warp', then?)`: `target` = `{ kind: 'place' | 'resident', id }`,
  `{ kind: 'activity', id }` or `{ kind: 'tile', x, y }`. Walk goes through the sim's own walks (`walkToDoor`,
  `walkToResident`, `walkToActivity`, `walkToTile`); warp works out `warpSpot` and calls the engine's
  `warpPlayer(at, heading, then?)` (a dip, `sim.placePlayer`, the camera snapped; refused while a talk is staged, a
  room or a dip is on). The engine also gives `mapView()` (its yaw, whether the town is off the stage).

### Without the 3D town

The map is not offered on the page without the world (`flat`): there is nowhere to walk or warp to and nobody
standing anywhere, and the list of residents already shows everyone with what waits; a still picture would be a
second, slower way to the same conversations.

### Checked, and not

Checked in headless Edge with the GPU (1600×900 and 390×844, light and dark, a fresh and a seeded town, full screen):
opening by M, the button and the minimap, drag, wheel, pinch, arrow keys (the player stays put), picking a place, a
resident, an activity, a building site and bare ground, "Đi tới" and "Đến ngay", Esc and M closing, the minimap while
walking and after turning the camera; no console errors, no horizontal scroll. Not checked: by a person, on a real
phone or a touch laptop, with a screen reader; whether the names left out at the whole-town zoom are the right ones;
whether 12 tiles is the right distance for "Đến ngay" to become the main button (a guess). The badges only on the
suggested resident and the re-listens, and the legend, were checked the same way on 2026-11-21 (1600×900 day and
night, 390×844 night).

### Far talks (2026-11-21)

A talk whose setting is further than `WARP_FAR` (12 tiles, as the crow flies) from where the player stands goes there
through the dark, like the map's "Đến ngay", never by a walk of ten seconds and more (`talkIsFar` in `engine3d.ts
talkAt`: the staged talk is `cut`, both are put in place at the dark: at the room's door and into the room, or at
their spots outside); nearer, both walk there as before. It holds however the talk begins (the main button "Tới gặp
Emma · Tập 1", a click, E, the hidden list); the button's words do not change. Checked in headless Edge: from the far
south-east corner "Tới gặp Leo · Tập 1" dipped and had the two on the plaza 0.8 s later.

## 12. Thân thiết: residents who remember (2026-11-21)

Owner: "gamification dạng context tăng thiện cảm với npc chứ không chỉ là giao tiếp đơn thuần rồi sau đó quên luôn".
Each resident now has a relationship that grows with what the learner HEARS from them, and remembers what was said:
episodes 3+ (each resident's arc, `src/data/stories/<placeId>.ts`, contract `ResidentArc` in `core/town/story.ts`),
choices in those episodes, facts, gifts, greetings, a Sổ tay. Rules in `core/town/friendship.ts` (pure), store calls in
`core/town/store.ts`, UI in `src/features/town/friends/` and the activities `gifts` / `journal`.

### Points and hearts

Friendship points per resident, 0..1000; a heart per 100 (0..10 hearts). Every point comes from listening to them (or
from a gift chosen from what they said they like). Nothing decays.

| What | Points | Kept as |
| --- | --- | --- |
| an episode heard through, the first time | +60 | derived from `episodes` (stage ≥ 1) |
| … its gist right on the very first listen | +30 | derived (`firstGist` 2) |
| a re-listen with the gist right | +10 | derived (one per stage after the finish) |
| a choice in an episode | the option's `points` (−20…+30) | derived from `choices` (the first pick) |
| a quick chat with at least 3 of 5 lines understood | +15, once per resident a day | `friends[placeId].up[device]`, `daily…bond` |
| the first finished conversation of the day with them (quick chat, episode, re-listen) | +5 | `friends…up` (reads `daily…met`) |
| a gift: loved / liked / neutral / disliked | +80 / +40 / +10 / −20, one per resident a day | `friends…up` / `down`, `daily…gifted` |

`friendPoints = clamp(0, 1000, derived + Σ up − Σ down)`. A write never takes the score below 0 (a loss takes only what
is there) nor above 1000. Hearts are a game score: the Sổ tay and the hearts' popover say so ("điểm trò chơi, không đo
khả năng nghe"). The old 0..5 "hearts" from the share of a place's sentences understood (`economy.placeHearts`,
`PlaceView.hearts`) stay for the stats only; the screen shows friendship hearts (`PlaceView.friend`), and
`TownAnswerResult.heartsBefore / heartsAfter` are friendship hearts now.

Heart titles (`friendTitle`): 0 người lạ, 1–2 người quen, 3–4 bạn, 5–6 bạn tốt, 7–9 bạn thân, 10 tri kỷ. A write that
raises a resident's hearts queues a celebration (`kind: 'friend'`: "Emma giờ coi bạn là bạn thân!" when the title
changes, else "Thân với Emma hơn"; detail "Thân thiết: 4/10 tim"), shown by the same banner as achievements.

### Episodes 3+ and what they wait for

`TOWN_STORIES` = `BASE_STORIES` (episodes 1–2, `data/townStories.ts`) + every arc's episodes. Ids, review cards
(`talk:<lineId>`), the order, re-listens and xu work as for 1–2. An episode is open when the one before it is finished,
the place is built (from episode 2 on: `needsHome`) and its `requires` is met: `hearts` (friendship hearts at least)
and `facts` (all known): `episodes.isEpisodeUnlocked`, `friendship.episodeNeeds`. When only friendship holds the next one
back, `PlaceView.friendEpisode = { order, title, hearts, facts }`, and the map card, the flat list and the Sổ tay say
"Tập 3 · Cần 2 tim" (the conversation is the quick chat meanwhile). Every arc's episode 3 needs 2 hearts and the two
first episodes give at most 190 points, so a quick chat, a re-listen or a gift comes first.

### Choices and variants

- A `you` line with `choices`: in the whole listens (steps 1 and 3) the option chosen before plays, else option 0.
  Line by line, the learner first understands the resident's line before it (as always), then picks what to answer by
  its Vietnamese `intent` (2–3 cards, keys 1–3), then hears that option in the player's voice and sees how it is said
  and what it means (`friends/ChoiceTurn.tsx`). No meaning to pick on that line (it is the learner's own); it is not
  counted in "Hiểu n/m câu".
- Only the first pick of a line ever counts (`choices[lineId] = { o, at }`: its points and its `learn` facts). A replay
  shows "Lần trước bạn đã chọn:" with that option and plays it; the whole listens play it too.
- A line with `variants`: the first variant whose `if` fact is known is said instead (order = priority), in every step,
  re-resolved after a pick in the same run (`storyLines.resolveEpisode`, `store.episodeTurns`, the pick returns the new
  turns).
- Every option and variant is a line of its own: id `<lineId>-a|b|c` / `<lineId>-v1…`, its own clip in its speaker's
  voice, its own review card `talk:<id>` on a miss, its own record in `lines`; the wrong meanings of a line are never
  another form of the same moment (`episodes.storyChoices`).

### Facts

`facts[factId] = firstAt` (`<placeId>:<slug>` about a resident, `you:<slug>` about the learner). Learned by a choice (its
`learn`) at the pick, and by finishing an episode (its `learn`) with the write (`friendship.settleFacts` runs on every
write, so a finish on another machine, or before this build, teaches them too). Never forgotten. A fact with a `gift`
shows that taste in the Sổ tay only once it is known: the shop never says who likes what, so a gift is a listening
test, not a guess.

### Gifts

- **Tiệm quà** (activity `gifts`, no spot in the world: the HUD's "Chơi"): the 20 gifts of `data/townGifts.ts` for 5–18
  xu each, as small tiles two or more to a row (name; English and price on one line; a tap buys one; 2026-11-23, the
  owner found the one-per-row list too long), the rules folded in a closed "Tặng quà thế nào?", what was bought said
  under the balance. A panel and not a tab of the build sheet: building is about the town, gifts are about people, and the other
  shop (Tiệm trứng) is an activity panel too. `gifts.bought[giftId][device]`; the balance subtracts them
  (`economy.spentTotal`).
- **Tặng quà**: standing next to a resident (a second button beside the main one at the bottom, only with a gift in
  hand and none given to them today; on a phone the icon alone), or from a conversation's result card. Pick a gift →
  the resident's voiced reaction (`reactions.loves|likes|neutral|dislikes`, their voice, played on the click) with an
  emote over their head (heart / smile / meh / frown, `engine/draw/overlay`), the points rising, a toast. The
  reaction's words come on "Xem chữ": listening first. One gift per resident per local day on all browsers
  (`daily…gifted`); gifts in hand = bought − given.

### Greetings

Stopping next to a resident in free play (the stage's `near`: within 1.6 tiles, the player still), after 350 ms the
resident waves and says one short voiced line (`friends/useGreeting.ts`, `friendship.pickGreeting`): a memory callback
(`if` a known fact) while it is news, else the highest `tier` (0 / 3 / 7) at most their hearts; never the same line
twice in a row. A memory greeting is news for `MEMORY_GREETING_DAYS` (7) after its fact was learned and at most
`MEMORY_GREETING_PLAYS` (2) times on a browser; then it rotates out ("I fixed the soup!" is news once). At most once
per resident in 10 minutes, never during a conversation or a panel (starting a talk also marks them greeted), only with
the town's sound on and "Lời chào của cư dân" on (device-local `town-ui`: `greet`; `hi` = the last greeting and its
time per resident; `said` = memory greetings said). `auto`: never a paid request. The bubble over their head shows
sound bars, no words; a tap shows the line, its meaning and "Nghe lại".

### Sổ tay

Activity `journal` (the HUD's "Chơi"; at a resident from their hearts pill: a conversation's header, which ends the
talk, or the map card). The list: every resident with hearts and a lock, closest first, and the greetings setting at
its foot. A resident's page: portrait, 10 hearts, title and points to the next heart, the next episode and what it
waits for ("Tới gặp" when it is ready), what you know about them, the gifts they said they love / like / dislike (only
once heard), what they remember about you, the choices you made.

### Stored (`progress.ts`, version 5)

```ts
friends:  { [placeId]: { up: { [device]: n }, down: { [device]: n } } },   // max per resident, side, device
facts:    { [factId]: firstAt },                                          // union, min of the time
choices:  { [lineId]: { o: optionId, at } },                              // the earlier wins; a tie: the smaller id
gifts:    { bought: { [giftId]: { [device]: n } }, given: { [giftId]: { [device]: n } } },   // max per device
daily[day][device].bond?: placeId[], .gifted?: placeId[]                  // union
```

Idempotent, commutative, associative (`syncMerge.props.test.ts` adds junk friendship to its random towns). A version 4
value reads with no friendship; the derived part (finished episodes, and the facts their finishes teach) counts at
once, so an existing learner starts with the hearts their finished episodes earned. A version 4 build relays the new
top-level fields (`townExtras`) but drops `bond` / `gifted` inside daily rows. Limits by design: two machines that each
paid the same day's +15 / +5, or each gave the same resident a gift, before a sync both keep it (game points, as with
xu); the derived part cannot be counted twice.

### Audio

Every new voiced thing goes through `storyLinePlayback` and the inventory (`audioInventory.addStories`): each option of
a choice (the player's voice), each variant (its line's speaker), each gift reaction and greeting (the resident),
connected + careful. `npm run audio:inventory` on 2026-11-21 with the 60 arc episodes: 7,968 clips and 196,531
characters in all; "Thị trấn" 2,438 clips / 106,225 characters, of which 2,068 clips / 91,717 characters are not
generated yet (the arcs, options, variants, reactions, greetings). Until the owner runs `npm run audio:generate` they
play the browser voice of the speaker's gender. `townStories.test.ts` checks shipped clips for episodes 1–2 only.

### Honest limits

- Hearts measure how much the learner listened to someone, plus gifts: a game score, never a hearing score. A gift is a
  listening test only if the learner heard what the resident said; over many days the shop can also be tried blindly.
- Choices change words, points and later lines, never where the story goes in the end; a "wrong" choice costs a few
  points and is remembered.
- Arc lines, options, variants, reactions and greetings have no shipped clips yet (above).

### Checked, and not

Checked only in headless Edge (ANGLE / D3D11) with seeded data, 1600×900 and 390×844, light and dark: Emma's episode 3
(the whole listen, the lines, the choice "Để Emma chọn" → +15, a third heart and its banner, the fact learned, the
next line said as its variant "Ooh, my favorite kind of customer…"), the phone choice and result card, a greeting with
a memory callback (Leo: "Board game night, Tuesday", the bubble and its popover), gifts loved (Leo, sunflowers, +80) and
disliked (Mia, a house plant, −20), the Sổ tay list and Emma's page, Mia's map card "Tập 3 · Cần 2 tim", no
horizontal scroll at 390 px. The voices of the arcs were the browser's (no clips yet). Nobody has played it for days,
heard the reactions and greetings in their Gemini voices, or judged the point values. Found and fixed on the way: a pick
gave the episode new lines, and the automatic first whole listen (an effect on `listenAll`) started again under the
line-by-line step; it now runs once, on mount (`Episode.tsx`).

## 13. Listening, not guessing: sound-alikes and typed checks (2026-11-22)

Picking 1 of 3 Vietnamese meanings can be guessed (33 %), and the wrong meanings of §2 are confusable on paper, not by
sound. Two changes make a right answer need the ear, without new audio (the learner only ever hears the real line;
options are Vietnamese text; nothing is generated or paid for).

### Sound-alike meanings (`core/town/soundAlike.ts`, `data/townSoundAlikes.ts`)

A wrong option is, where possible, the meaning of what a careless ear would hear instead:

- **authored** (`TOWN_SOUND_ALIKES`, by line id): can ↔ can't, want to ↔ won't, a dropped -ed, a light 'd / 'll / have
  / n't, him ↔ her, a linked boundary ("eat yet" ↔ "eat it"), one -teen ↔ -ty. Each entry keeps the English it stands
  for (`heard`, never shown or spoken) so it can be checked: it must differ from the line by 1–3 words
  (`closeVariant`), or the entry stops applying (a rewritten line never gets a stale meaning). Left out where the two
  mean the same in Vietnamese or the sound-alike makes no sense.
- **derived by rule**: him ↔ them (the line's one "anh ấy / ông ấy / thằng bé …" ↔ its one "họ", only when no other
  he / they disagrees) and -teen ↔ -ty (the number said once in English and once in the Vietnamese, in words or digits).
  `NO_DERIVED` lists the lines where the derived one would be absurd ("mẹ tôi tròn mười sáu").

Coverage today: 40 of the 300 quick-chat lines and 24 of the 1,067 story lines (options included) have one; every place
has at least one quick-chat line with one, most have 2–7. Every other line keeps §2's meanings.

How they are offered (`choicesFor`; `LineChoices.alike` marks which option is the line's own sound-alike):

| The line has | Options |
| --- | --- |
| two or more sound-alikes | the right meaning and two of them (three look-alikes) |
| one | the right meaning, its sound-alike, and another line of the place with ITS sound-alike: four options in two look-alike pairs (`decoyPair`); with no such line, the sound-alike and one §2 meaning (three) |
| none | §2, unchanged (three) |

**Why four.** Three options where two look alike leave 50 % to a learner who simply bets on the pair. Two pairs take
that away (25 % for a guess). The pair never comes from another line of the same conversation or episode (its meaning
was just heard and would be easy to rule out). A line with one sound-alike at a place with no other one (today one line
each at Cửa hàng, Trường học and Phòng khám) still shows three options, so a learner who spots the pair has 50 % there.
After a wrong pick of a sound-alike, the panel says where the two differ by ear ("Chỗ khác: âm h bị nuốt …",
`SOUND_ALIKE_LABEL`), on a phone too.

Examples (Quán cà phê, seed 0):

- "I want to go home." → Mình muốn về nhà. / Mình sẽ không về nhà. / Mình tìm thấy chìa khóa của cô ấy rồi. / Mình tìm
  thấy chìa khóa của anh ấy rồi.
- "Tell him I said hi." → Nhắn với anh ấy là mình gửi lời chào nhé. / Nhắn với họ là mình gửi lời chào nhé. (derived),
  and a look-alike pair of another line of the place.
- "She said she'd call us back, but we haven't heard from her yet." → Cô ấy bảo sẽ gọi lại … / Cô ấy bảo đã gọi lại
  rồi … / Về tới nhà mình nhắn cho. / Về tới nhà là mình hay nhắn cho bạn.

### Typed checks (`core/town/typing.ts`, the `Turn` panel in `Conversation.tsx`)

One line of every quick chat and one plain line of every new episode's step 2 ("Từng câu") is TYPED instead of picked:
the sentence is shown with one gap, the words of one connected-speech event of the line (`typingTask`: the decoder's
annotation that changes the sound most, reduction first … linking last, 1–4 words, never the whole sentence; about 99 %
of the lines have one). A line never answered before is chosen first (`typedIndex`), so typing is listening, not
remembering a text seen earlier. Never a choice line of an episode; the same line stays typed when a choice changes what
later lines say.

- Judged like Chép chính tả's "Điền từ" (`judgeTyped`: `checkBlank` + `align`): "wanna" = "want to", "I would" = "I'd",
  a one-letter slip in a long word is right, a dropped -ed is not. A **close miss** (half the words right, a dropped
  ending, or a short gap off by a letter or two) gets one more try with the first letters as a hint ("w___ t_"), like
  "Gợi ý" there. "Chịu, xem đáp án" gives up (a miss).
- It counts as the line's answer (`typedOutcome`): right at the first check after one normal play = `first`, with
  replays or after the hint = `replayed`, a miss = `wrong` (the review card is enrolled exactly as for a wrong pick).
  Nothing played: nothing recorded.
- **Xu:** the line's own xu (§3) plus `TYPED_BONUS` 2 when typed right (with or without the hint); a miss pays 0.
- **Recorded on its own** (`typed`, version 6, per browser: `n` checks answered, `ok` typed right at the first check;
  merged by max per device and field, like `earned`; `syncMerge.props.test.ts` checks the laws). It is the town's one
  number close to a measure, shown modestly in "Thị trấn này để làm gì?" (`typedMeasureText`: "gõ đúng ngay x trên n
  lần", hedged under 20 checks, saying that xu, titles and hearts are game points, not a measure). Nothing shows before
  the first check. The result card of a quick chat says whether its typed line was right.

### Honest limits

- The gap is shown with the rest of the sentence around it, so a typed check measures hearing ONE chunk with context,
  not a whole sentence; `ok` can also count a line answered (and shown) before, when every line of the conversation had
  been (`typedIndex` prefers new lines).
- Sound-alikes cover a small part of the town (above); most lines still have only §2's meanings. The authored Vietnamese
  was written by hand and checked by the tests for shape and fit, not by a native speaker or the owner.
- Typing on a phone is slower than a tap. Nobody has played it for days, so one typed line per conversation and a bonus
  of 2 xu are guesses.

### Checked, and not

Unit tests: `soundAlike.test.ts` (every authored entry applies and is offered, the rules, the two-pair layout and the
fallback), `typing.test.ts` (gaps on every line, the choice of the typed line, the judge, the outcome, the stored field,
the pay), the store (`recordTownAnswer` with a typed check, one typed line per conversation, the typed line of an episode
kept through a choice) and the merge laws. In the dev server at 375×812, dark and light: a four-option line of Quán cà
phê, a wrong sound-alike pick with its note, a typed check with a close miss → hint → right (+4 xu), a typed miss with
the right words shown, the result card, the explainer's measure; no horizontal scroll, no text under 13 px. Not
checked: a typed line inside an episode on screen (only through the store), the wide-stage layout, a real phone
keyboard over the panel, and how any of it feels after a week.

## 14. Gặp trên đường: a resident met out in the town (2026-11-22)

The owner clicked Daniel on a path and the talk jumped into the boarding house ("tao gặp thằng này ngoài đường, bấm
vào thì nó bắt về phòng trọ nói chuyện… mày làm game cũng phải logic tí chứ"). Now **where you meet someone is where you
talk**:

- A click on the resident themself, or E / the main button beside them, passes `inPerson` (engine `onTalk(id, true)`).
  The page reads where they stand (`mapSnapshot`) and compares it with where their talk would happen at home
  (`streetModel.homeSetting`: their waiting episode's setting, else the quick chat's). If they are more than
  `STREET_FAR` (5 tiles) from it (`engine/staging.ts metInStreet`), they are **out in the town**.
- In that case the talk happens **right there** (`TalkSetting` `{ kind: 'here' }`): the player walks up to them
  (`sim.walkToResident`) and the camera frames the two. There is no dip and no room. The panel says
  "Daniel · Gặp trên đường".
- **The talk is one of their street talks** (2026-11-23; the owner on the first version, five unrelated dictation
  sentences: "gặp trên đường sao toàn câu tào lao không liên quan gì nhau vậy?… người ta làm gì có hứng thú học").
  `data/streetTalks/<placeId>.ts` has four per resident (contract `core/town/streetTalkTypes.ts`): two for anybody,
  one from 3 hearts, one that builds on a fact learned in their episodes. Each is a short, coherent exchange of 5–7
  lines: they speak first and last, the two take turns. Their lines are the listening checks of the conversation:
  hear → pick the meaning, one typed, the connected-speech reveal after each answer. The learner's own line is shown
  above the check it answers (`TownTurn.before`, "Phước: … / meaning") and said first in the character's voice, then
  the resident answers. `core/town/streetTalk.ts pickStreetTalk` brings up the least-heard open talk, a fact one or a
  closer one first; "Nói chuyện tiếp" brings the next. The conversation's size is its own number of checks
  (`applyConversation(…, size)`), so 3 of 4 understood pays as usual. Line ids are `st-<placeId>-<n>-<k>`
  (`placeOfLineId` reads the place from them). Clips: the resident's lines connected + careful in their voice, the
  learner's lines in Puck and Callirrhoe (`audioInventory addStreetTalks`); until generated they play the browser voice.
- An episode is told where it belongs, so it waits. The bottom button beside someone out in the town offers "Bắt chuyện
  với Daniel" without "· Tập 1".
- A click on their house, the list, the map or "Tới gặp …" still goes to where the talk happens, as before.

**Context** (`data/townStreet.ts`) is one Vietnamese sentence at the top of the chat. It is narration only, with no
audio. It is true anywhere in the town and depends on the friendship:

- 0–1 hearts: polite ("Thầy Daniel kẹp mấy quyển sách, đi chậm rãi.");
- 2–4: they stop for you;
- 5+: they light up;
- in half of the meetings, once you know one of their facts (data/stories), a scene built on it ("Thầy Daniel cầm hũ
  mật ong vừa mua: trà tối nay có rồi.").

It reads the same all day (seeded by the day and the meeting).

**Parting words** (`streetModel.streetTalkView`):

- If their next episode waits at home, the result card says so ("Daniel dặn lúc nào rảnh thì ghé nhà trọ: có chuyện
  muốn kể với bạn."). Its second button becomes "Đi cùng Daniel tới nhà trọ": the street talk ends and the episode's
  staging begins, so the two walk there together (or dip if it is more than 12 tiles away).
- If the next episode waits for friendship, the card says how close you must get first ("Thân hơn nữa (cần 2 tim) thì
  Emma sẽ kể thêm chuyện riêng.").

**Friendship** (owner: "phải liên quan với nhau để chiếm tình cảm npc"): a street chat with 3 of 5 understood pays +10
more, once per resident a day (`FRIEND_POINTS.street`, town-progress daily set `street`, union merge). This is on top
of the chat's +15 and the day's +5.

Checked:

- unit tests (`townStreet`, `streetModel`, staging `metInStreet`, friendship);
- in headless Edge, a street talk with Daniel 23 tiles away: the walk, the panel "Gặp trên đường" and the scene line.

Not checked: the result card's invite on screen, or "Đi cùng" walking together.

## 15. Hẹn hò, cưới, con; Nhân vật (2026-11-22)

The owner asked: "nên có tán gái, kết hôn và sinh con nữa, có thể chọn nhân vật". Their choices:

- who you court follows from your character: a man courts Emma, Mia, Sarah, Kim, Lily, Zoe; a woman courts Leo, Ben, Sam,
  Tom, Daniel. Zoe is with Max in her own story and leaves him for the learner, with some drama (owner, 2026-11-24:
  "zoe có thể phản bội bạn trai để đến với nhân vật chính, stardew valley cũng có thể tán tỉnh nhiều người mà", "tán
  zoe sẽ drama một tí nha"; `data/romance/cinema.ts`): Max walks in on the confession with two milk teas and leaves
  without a word (telling her to let him go loses points), on the first date the town is whispering and Zoe feels like
  the villain, on the second Max brings the tripod she left at his shop to the pier (snapping at him loses points), on
  the third he brings popcorn, no hard feelings, and he films the wedding. Max has no lines (he is narrated: the scenes
  speak only for the two and a child). Her 115 clips (4,727 characters) were generated by
  the owner on 2026-11-25; nobody has listened to them yet. Max is nobody's; Grace is the town's grandmother;
- you make your own character;
- children grow and talk;
- the way in is hearts plus dates.

Then: "không nhất thiết là cứ phải dùng hội thoại gemini, nhiều cái cứ trò chuyện bình thường là được". So all of
this is **text scenes**: an English line, its Vietnamese meaning, and a ▶ that reads it in the browser voice
(`speak(…, { browserOnly: true })`). There are no shipped clips and never a paid request.

**Stored**: `town-life` (synced; `core/town/life.ts`, merger `mergeLife`, laws in syncMerge.props.test):

- the character: gender, name, skin, hair style and colour; the newer `at` wins;
- per resident, the time of each step (dating, date1–3, engaged, married); the earliest wins, and the partner is the
  earliest `dating`;
- children (name, boy / girl, born; at most 3);
- the first choice per scene;
- per day, who was talked with (the last 40 days).

Friendship points and the bouquet / ring stay in town-progress.

**The way** (`core/town/romance.ts romanceSteps`, IO `lifeStore.ts`): one step a day.

| Step | Needs | Friendship |
|---|---|---|
| Tỏ tình | 8 hearts and a bouquet (Tiệm quà, 30 xu; sold once you have a character) | +50 |
| Hẹn hò lần 1–3 | one a day | +40 each |
| Cầu hôn | the 3 dates, 10 hearts, a ring (150 xu) | +60 |
| Đám cưới | the next day | +60 |
| Each day after | one exchange with the spouse; one play with each child | +10 / +5 |
| Có em bé | 3 days after the wedding; another only once the youngest is 14 days old | +20 |

A scene's choice adds its own points once.

Children are babies for days 0–6, toddlers for 7–20, and at school from day 21. Their scenes are in
`data/romance/kids.ts`.

**Content**: `data/romance/<placeId>.ts`, one `Suitor` each, holds the confession, three dates in places of the town,
the proposal, the vows and 8 daily exchanges. They were written against each resident's arc and facts (Leo's sister's
baby, Ben's dad's counter, Daniel's novel…). `data/romance/kids.ts` holds 6 baby, 10 toddler and 12 child scenes. The
contract is in `core/town/romanceTypes.ts`; tests are in `core/town/romance.test.ts`.

**On screen**:

- The character's name shows over the player's head (`StageState.playerName`, "Bạn" without a character).
- "Nhân vật" (activity `character`) is the creator, with a live portrait. "Lưu" rebuilds the player in the town:
  `three/chars/looks setPlayerLook`, `StageState.body`, `engine3d.setState` drops the old model. The gender cannot
  change while you have a partner.
- "Hẹn hò & gia đình" (activity `love`) shows:
  - the candidates with their hearts;
  - a candidate's page with the next step or why it waits;
  - married life: the steps, the children with their ages;
  - the baby's naming.
- Standing next to a candidate or the spouse, a "Hẹn hò" (or "Gia đình") button sits beside the main button.
- `romance/StoryChat.tsx` plays a scene line by line, with its choice.

**In the town** (2026-11-22, "còn gì chưa làm thì làm tiếp"):

- Every confession, date and proposal happens where its scene says (`data/romance/places.ts` SCENE_SPOTS: a
  place's door, the pier, the farm field, a part of town such as the park, the orchard, the woods' hill or the
  fields). "Bắt đầu" dips there (the map's warp, `travelTo(…, 'warp')`), puts the one courted beside the player
  (`stage.meet`, a talk outside) and the camera frames the two. Closing the scene, or the panel, lets them go.
- A scene at a place still an empty lot waits for it ("Cần xây Rạp phim trước"): courting asks you to build the town.
- The wedding is on the plaza: the whole town walks in round the two (`stage.crowd`). Confetti and hearts come at
  the "yes", the proposal, the wedding and a new baby.
- Children old enough to walk (toddlers smaller) follow the player behind the pet (`StageState.kids`,
  `engine3d.updateKids`): a seeded child look with the player's skin and, alternately, the spouse's or the player's
  hair colour. Babies stay at home (only in the panel). Daily life and the children's scenes happen where you stand,
  with the spouse brought beside you.
- Daniel's second date moved from a library the town does not have to the classroom's bookshelf.

Not built yet: a home of your own (the spouse still lives at their place); the children have no name tags.

Not checked:

- any of it on screen beyond type-check and unit tests;
- the English of the 300-odd lines, by a person;
- the step costs and points, which are guesses;
- the 'you' lines of the voiced episodes keep their one voice whatever the character's gender;
- the dates' places were checked against the 72 × 72 town (orchard, woods' hill, fields, pier, farm); a "Saturday
  market" on the plaza is only words.

### Voices (2026-11-22)

The owner first said text was enough, then: "mỗi người nên một giọng vì đây là game mà, vẫn xài gemini đi". So:

- **Courtship and children's scenes** (`core/town/romanceAudio.ts`): each line is said as it appears (▶ says it again),
  when the town's sound is on, in its speaker's voice:
  - the one courted / the spouse: their own CAST_VOICES voice;
  - the learner's character: Puck for a man, Callirrhoe (`PLAYER_FEMALE`) for a woman, depending on who they court;
  - a boy: Achird; a girl: Autonoe; both with a "small child's high, playful voice" style.

  A name the learner chose cannot be in a shipped clip. A name called out at the start or the end of a line is left
  out of the audio while the text shows it; a line that needs a name in the middle is read by the browser voice. In
  the children's scenes the spouse's lines exist once per spouse, the child's once per boy / girl. Missing clips play
  the browser voice of the right sex, never a paid request (`browserOnly`).
- **Quick chats, on the street too** (`storyAudio.quickChatVoice`): every resident says their quick-chat lines in their
  own voice once those clips ship. Until then it is the app's Kore clip, the same as Chép chính tả, so nothing
  degrades to the browser voice before `npm run audio:generate`.
- **To generate**: 2,036 new clips, about 74,600 characters:
  - 600 quick-chat clips (25,206 characters): 300 lines × connected + careful;
  - 1,436 scene clips (49,425 characters).

  The owner runs it.

## 16. Phụ quầy cà phê: the short game to come back for (2026-11-24)

The owner asked: "thị trấn có bao nhiêu game này thôi hả? không có game gì gây nghiện giữ chân người học à", and when
told nobody could promise that: "sao mày không thử đi tham khảo ở trên mạng". What the reading came to, and how the
game uses it:

| What keeps a short game played | Source | Here |
|---|---|---|
| One action, understood at a glance, no tutorial | Unity / MAG Interactive, Supersonic on hyper-casual design | hear the order → tap the tiles → "Giao" |
| A patience meter, a combo a miss resets, rising pace | Smith et al., "Order-fulfillment games" (FDG 2019); Tapper, Diner Dash | the bar under the customer, ×1.25 … ×3, less patience as the skill rises |
| Learning is fastest near 85% right | Wilson et al., Nature Communications 2019 | the skill goes up 0.5 for a right tray and down 2.8 for a miss (0.85 / 0.15), and picks the order's level and the patience |
| One simple day streak | Duolingo's retention team (Lenny's Newsletter) | "N ngày liền đứng quầy": a day with one shift, nothing else to it |
| A personal best to beat; the end of a run decides if you play again | devlogs on combo / score design; Kwalee on end-of-level pacing | "Còn 40 điểm nữa là phá kỷ lục 310", "Chơi lại" is the one button |
| A daily reward that cannot be farmed | Game Developer on daily rewards | 24 xu a day over all browsers; score and record still count after |

Nobody can know it holds people until somebody plays it for days: these are the known ingredients, not a promise.

**The game** (`core/town/cafe.ts`, `cafeStore.ts`, `features/town/activities/CafePanel.tsx`, activity `cafe`, first in
"Chơi"):

- A shift is up to 12 customers; 3 misses end it. A customer is one of the twelve residents (never Emma: it is her
  counter). They SAY an order (`data/townCafe.ts`, 10 each: 4 plain, 4 with two kinds or a number, 2 that must really
  be heard: a change of mind, a "no …", near sound-alikes such as "a nice iced tea").
- The learner taps what was asked for on twelve tiles (Vietnamese names: hearing "an iced latte" and tapping
  "Latte đá" is understanding, not matching letters), up to 3 of a kind, "−" takes one back, and serves. The tray must
  be exactly the order.
- The patience starts with the customer's first word: 8 s + 2.2 s a thing (+2.5 s for a level 3), times
  1 − 0.04 × skill, never under 6 s. "Nghe lại" (R) costs nothing but time, and the first-listen bonus.
- Points for a right tray: 10 a level + up to 10 for speed + 5 for hearing it once, times the combo.
- After a miss the order shows as it was said, with its meaning, the right tray, "Nghe lại" and "Rõ từng từ", and
  waits for "Khách tiếp theo" (Enter): the owner found 3.2 s "qua nhanh quá chưa đọc đc gì". A right tray goes on by
  itself after 0.9 s. The result lists every
  missed order with its connected-speech reveal, "Nghe" and "Rõ từng từ": the learning moment of the game.
- Orders got right least often come first, so a missed one comes back in a later shift.
- Starting a shift takes the player to the café's door with Emma beside them (`onScene`). The customers show as
  portraits in the panel, not in the 3D town.

**Stored**: `town-cafe` (synced; merger `mergeCafe`, laws in syncMerge.props.test): the best score, the skill the next
shift starts from (one under where the last ended), per order how often served / right, per day and browser the
shifts, xu paid, best and whether Emma's friendship was paid. Xu (score / 30, to the day's cap) and +10 friendship
with Emma (8 right trays in a shift, once a day) go to town-progress.

**Voices**: each customer's own Gemini voice (`audioInventory addCafe`: the 120 orders, connected + careful, 240
clips). The owner's rule, 2026-11-24: "nhân vật mới thì mới xài trình duyệt, nhân vật cũ luôn xài gemini": the old
cast always gets clips, only a NEW character speaks with the browser voice. Until the clips are generated the
browser voice of the customer's sex plays; never a paid request (`browserOnly`).

Not done: customers walking up to the counter in 3D; a card in Ôn tập for a missed order (it only comes back inside
the game); the daily tasks do not know the café.

## 17. Vụ án ở thị trấn: one chapter a day (2026-11-24)

The owner, after the café game: "sao mới có 1 game à… tìm được game gì giúp hứng thú gây nghiện cho người học nữa
chưa". The café is the fast game to replay; this is the slow one to come back to, built on two other things the
reading found:

| What brings people back daily | Source | Here |
|---|---|---|
| One puzzle a day: scarcity leaves people wanting the next | Josh Wardle on Wordle (New York Times); Northeastern game-design faculty | a chapter opens the local day after the one before was solved; nothing else to grind |
| An unfinished story | a 2023 two-experiment study (Communication Research Reports): cliffhangers raise suspense and the wish for the next part | every chapter ends on a cliffhanger; a case takes five days |

Honest limits: the popular "Zeigarnik effect" behind cliffhangers has failed replications, and the study above
measured the wish for a sequel, not learning or retention. These are reasons to try it, not a promise.

**The game** (`core/town/cases.ts`, `casesStore.ts`, `features/town/activities/CasePanel.tsx`, activity `case`,
content `data/cases/`, contract `core/town/caseTypes.ts`):

- A case is a cosy mystery of five chapters (nobody is a criminal: a surprise, a mix-up, a kindness). Three cases:
  the fountain's coins (level 1), Emma's recipe notebook (level 2), the unsigned notes on the notice board (level 3,
  where the detail is easy to mishear: thirteen / thirty, can / can't, a correction mid-sentence).
- A chapter: three residents each say 2–3 lines in their own voices, with nothing to read. Once all three were heard,
  a Vietnamese question appears whose answer is a detail said by exactly one of them; a wrong pick names whom to
  hear again. The fifth chapter asks who did it.
- Solved: 3 stars for the first pick with every witness heard once, 2 with a replay, 1 after a wrong pick; 4 xu + 2 a
  star, once. Then the lines show with their connected-speech reveal, "Nghe" and "Rõ từng từ", the clue goes into
  "Sổ điều tra", and the cliffhanger says why to come back. Closing a case gives its `friend` +20 friendship.
- **Stored**: `town-cases` (synced; merger `mergeCases`, laws in syncMerge.props.test): per case and chapter, when it
  was first solved and its stars (the earlier time, the higher stars).
- **Voices**: every line is in the clip inventory in its witness's Gemini voice, connected + careful
  (`audioInventory addCases`).

Not done: the witnesses are portraits in the panel, not met in the 3D town; a solved chapter cannot be replayed; a
missed detail does not enter Ôn tập; only three cases (fifteen days).

## 18. The games belong together; Giao hàng cho Emma (2026-11-24)

The owner, with the café and the mystery live: "that's it? có 2 game thôi à? các game này nọ cần có context và liên
quan với nhau". Two menu entries with no reason in the story and no way from one to the other were not a game. The
rule since then: **a game is a job at a resident's place, given for a reason, and one job leads to the next.**

- **Phụ quầy cà phê → the customers.** Every resident served right at the counter grows a little closer
  (`CUSTOMER_BOND` +3, once a day each: town-progress daily set `served`), besides Emma's +10. The result names them
  ("Khách quý bạn hơn: Sam, Kim"). So the fast game feeds the hearts that open episodes and courtship.
- **Phụ quầy cà phê → Giao hàng.** A finished shift makes two orders to carry (four a day at most); the result offers
  "Emma nhờ giao N đơn".
- **Giao hàng → the one it was for.** Emma SAYS who the order is for (`data/townDeliveries.ts`, 4 per resident, her
  voice). The better the learner knows that resident, the less she spells out (`delivery.ts deliveryLevel`): a stranger
  is named with their place, from 1 heart they are described by their job, from 3 hearts by something the learner
  knows from their stories (the dog's name, what they love, what happened to them). Knowing the town is what finds
  them. The panel closes, a chip sits over the stage ("Nghe lại", ✕ to give up), and the learner walks up to whoever
  they think she meant: a click on a resident or their house offers the order instead of starting a talk
  (`TownPage startTalk`, `deliveryStore.handDelivery`). The right one thanks the learner in their own voice (their
  shipped gift reaction, no new clip), +8 friendship once a day each (daily set `sent`), 4 xu (+2 when Emma was heard
  once and nobody else was tried). A wrong one says it is not theirs; two wrong and the order has gone cold.
- **Giao hàng → Vụ án.** The card that ends a delivery shows Emma's words with their connected-speech reveal, and
  when today's chapter of the mystery is open, "Vụ án: kỳ N đang mở". A solved chapter offers "Ra phụ quầy Emma".

The order in hand lives in this tab only (`deliveryStore`: a reload drops it; nothing was paid yet).

Clips: Emma's 48 delivery lines, connected only (`audioInventory addDeliveries`).

Not done: Ben's shop and Sam's station have no job yet (a checkout with prices and numbers, a departure board with
times); the delivery has no clock; the recipient does not react in 3D beyond the camera's usual framing; the daily
tasks ("Việc hôm nay") do not know these games.

## 19. Thế giới sống: things to use, a week, a radio (2026-11-25)

The owner, after the walking fixes: the town has "quá ít tiện nghi / event", and "cảnh vật cũng đang chỉ cho có quá,
không tương tác được gì". Measured then: in the whole 3D world only residents, houses and five activity spots could
be clicked; benches, the radio, the well, boats, the lighthouse were scenery; nothing in the code knew a weekday or
the weather, and the Tuesday board games, the Thursday club, the Friday dinner, the Saturday market and the Sunday
roast existed only as words in the residents' lines. This is step 1 of `docs/city-proposal.md` (the city itself is
steps 2–4, not built).

**Cảnh nghe** (`core/town/sceneTypes.ts`, content `data/scenes/`, panel `features/town/scenes/ListenPanel.tsx`,
activity `listen`, not in the HUD's menu). Something HEARD in the world, not a talk the learner is part of. The
whole scene plays as sound only (nothing to read), then one question (overheard) or two (a gist and a detail: radio,
get-togethers), one try each, then the words line by line: decoded, the meaning, "Nghe" (connected) and "Rõ từng từ".
Three kinds:
- **overheard** (24, `oh-…`): the learner sits down on a bench (every bench of the first day, 24 of them) and two
  residents who know each other talk nearby, 4–6 lines. One scene per bench and day (`world.ts overheardAt`), never
  one heard in the days the daily record keeps while others are left. The line before listening is made from who is
  talking ("Sam và Lily đang nói chuyện ngay gần đó."), not from the scene's own `scene` (written for one place);
- **radio** (30, `fm-…`): the little set on the café's terrace table plays Bay FM, the city's station. Marcus, its
  presenter, alone, 3–5 sentences: 9 forecasts (read only in that weather), 9 notices of the weekday, 12 timeless.
  `radioNow`: today's own first, a new segment each time;
- **get-togethers** (15, `ev-<event>-n`, three tellings each, taking turns week by week): 3–4 residents, 8–12 lines.
  `TOWN_EVENTS`: Sunday roast at Grace's, Tuesday board games with Leo, Thursday conversation club with Daniel,
  Friday dinner at Emma's, Saturday market (Tom); Monday and Wednesday are quiet. By the learner's own clock. Today's
  one is at the head of "Việc hôm nay" (`TownHud` `today`), with the weather; "Tới dự" opens it and the stage takes
  the player to the host's place (`onScene`, as a shift at the café does). It waits for the host's place to be built.

**Things to use** (`data/townWorld.ts` `WORLD_THINGS`, `ThingId` = `thing:bench-<n>` | `thing:radio`). They ARE
activity spots (`WORLD_ACTIVITIES`), with a `box` of their own instead of a `prop`: so the click, the walk there, E
beside them, the name over them ("Ghế: ngồi nghe", "Radio Bay FM": `scenes/things.ts`), the hover and "Đến ngay"
are the activity spots' own code. What had to learn about them: `world3d.ts` (the box), `engine3d.ts` (the name: one
line), `TownMap.tsx` (they are not on the map), `TownPage.tsx` (`openSpot`, the button "Ngồi xuống nghe" / "Nghe
radio", `?listen=thing:radio | thing:bench-3 | event:games` opens a panel by a link). A radio was added to the
terrace's model (`props3d.ts`).

**Rules** (`core/town/world.ts`, `worldStore.ts`, tested in `world.test.ts`). As everywhere: only LISTENING pays.
A question right at the first try: 2 xu (overheard, radio), 4 xu (a get-together, plus 2 for staying to the end and
+15 friendship with the host). Paid: 4 overheard, 3 radio segments, 1 get-together a day (`SCENE_PAID_A_DAY`); the
rest can be heard for nothing, and the panel says so. No new stored key: the scenes that paid today are the daily
set `heard` of `town-progress` (one more entry of `DAILY_SETS`, merged as the others are). The weather
(`weatherOf(day)`: about half the days clear, a third cloudy, a sixth rain, the same on every machine) only chooses
the forecast so far: it is not drawn.

**Voices: the browser's, always.** The first version put the residents' 300 lines in the clip inventory (600 clips,
31,211 characters to generate). The owner the same day: "mấy phần này nghe cho vui nên không cần xài giọng gemini, bỏ
ra đi khỏi tốn token tạo giọng". So no scene line is in the inventory, none is ever generated, none makes a paid
request (`sceneAudio.ts`: `browserOnly` always; a test checks the inventory holds nothing of a scene). Each speaker
has a voice name of the scene's own (`scene-<who>`: no Gemini voice's name, so no clip is looked up under it) and
their sex (a resident's from `voices.ts`, Marcus's from `SCENE_VOICES`): the browser gives each a voice of their own
among those of that sex. A browser voice reads word by word and reduces little: these scenes are for following a
talk, for fun; connected speech is trained by Chép chính tả and the residents' own episodes, in Gemini voices.

**Staged in the world** (the owner, on the first version: "nhìn lởm vậy, nhân vật chính thì không ngồi, nhân vật phụ
bị nghe lén thì không thấy đâu"). Opening a bench's or the radio's scene, the player SITS DOWN on that thing's seat
(`sim.sitPlayer`: a seat of `WORLD_LIFE.seats` on the thing's tile, the stool by the radio; drawn seated as a
resident is, `engine3d.ts` reads `sim.playerSeat`); whoever sat on that bench gets up and nobody sits down beside
them meanwhile. The two who are overheard come in from a few tiles off and stand side by side a couple of steps in
front of the bench, turned to each other (`engine3d.listenFrom` → `sim.talkAside`: held there until the panel
closes, then back to their day); both are named, and whoever speaks has the talk bubble over their head and the talk
animation (`ActivityPanelProps.onListen` / `onSpeaking` → `TownStageHandle.listenFrom` / `endListen`, the stage's
`speaking`). A key or a click walk gets the player up. Looked at in pictures (the bench on the plaza, with one of
the two speaking; the stool by the radio); the walk in, the sitting down and the getting up were not watched moving.
A get-together is not staged this way yet: the player goes to the host's place and only the host is there.

**Seeing the town** (`scripts/town-shot.mjs`, `three/webgl.ts wantsSoft`). The machine an agent's commands run on
has no graphics card (WebGL reports "Microsoft Basic Render Driver"), so the 3D town did not draw in its headless
browser or its browser pane, and the walking bugs of that morning were fixed blind. `#/town?r=soft` (dev builds
only) draws the town on the software renderer, a frame or two a second; the script takes a picture of it, with
`--js2` to put the player somewhere (`window.__town3d.sim.placePlayer`) and click things first. Everything of this
section was looked at that way: the bench's and the radio's name and button at 1400 × 900, a bench scene, a radio
segment and a get-together through to the words (the last at 390 × 844).

Not done, not checked:
- nobody has HEARD a scene: the headless browser is mute and plays a scene in a second. The pace between lines, the
  browser voices, Marcus alone for half a minute: for the owner's ear;
- the ~330 English lines and their Vietnamese were written by three agents and read by nobody; their reports list
  invented details (the first city bus at seven twenty, Grace's roast at one, a half-price Wednesday at the cinema,
  flu shots on Mondays, prices in dollars) and lines a native speaker should check (Max's "I've got heaps", Grace's
  "Forty years a nurse…");
- a missed scene is not a review card (the scenes come round again by themselves; the review system knows nothing
  of them);
- nobody but the host is at a get-together's place (the bench and the radio are staged, see above);
- the weather is not drawn; the well, the ducks, the cat, the lighthouse, the boats are still only scenery; nothing
  can be picked up;
- the pay and the daily allowances are guesses.

## 20. Westbay: the city next door (2026-11-25)

The owner: "hiện tại đang ở quy mô thị trấn quá ít tiện nghi/event, dân cư, mở rộng thêm khu bên cạnh dạng như thị xã
thành phố có nhiều event và nhân vật khác, nhân vật cũ vẫn xài giọng gemini, nhân vật mới có thể xài giọng trình duyệt,
nội dung giao tiếp có thể dài hơn và chuyên sâu hơn… nhớ đảm bảo context các nhân vật có thể quen nhau từ trước, đừng
xây dựng mọi thứ một cách hời hợt". The design he approved is `docs/city-proposal.md`; this is its step 2, built. Who
everybody is and who knows whom is `docs/city.md` (the canon: every line agrees with it).

**What it is.** A second map for the same 3D stage, reached by bus no. 9 from Sam's bus station. Eighteen people live
there, each tied to somebody of the town by a detail the town's own lines already said (Sam's cousin who drives a
taxi, Leo's sister, Ben's dad who opened the shop thirty years ago, the Italian place of Emma's birthday, the sister
who never read Daniel's pages…). The learner walks up to somebody and LISTENS: a scene is played as sound only, then
its questions, then the words (the steps of §19's "cảnh nghe", `scenes/SceneFlow.tsx`), but longer and between two or
three people:

| What | How many | Shape |
|---|---|---|
| Episodes of the six main people (Rico, Nora, Frank, Gianna, Iris, Claire) | 18 (3 each) | 12–18 lines, 2–3 speakers, 3 questions (gist, a detail, why / what next) |
| Short talks of the twelve people known | 24 (2 each) | 6–9 lines, 1–2 questions |
| A town resident met in Westbay | 13 (1 each) | 6–10 lines with somebody of the city, 1–2 questions |
| Overheard from a bench in the city | 14 | two people of the city, 4–6 lines, a gist |
| On bus no. 9 | 10 (5 each way) | the bus's loudspeaker and two passengers, a gist and a detail |

**The city is met one person at a time** (`CityScene.needs`, `docs/city.md` §4b): off the bus only Rico has something
to say; he sends the learner to the florist's, she to her neighbours, and so on. The second episode of each main
person brings up the town resident of their story (Sam on the phone to his mum, Leo holding his niece, Ben finding
the supermarket's letter, Emma shown her grandmother's handwriting, Zoe getting Iris's notes, Daniel leaving the
envelope). A scene heard comes back after 2, 7 and 21 days (`CITY_RELISTEN_DAYS`).

**Town residents in the city** (`core/town/city.ts` `CITY_VISITS`, `visitorsNow`): they come up on their own
weekdays (Sarah's Monday meeting, Ben at his dad's on Tuesday, Mia's Thursday karaoke, Zoe and Max at the Lumen on
Friday, Leo at his sister's on Saturday…), whoever a story needs is there on any day (an open, unheard episode in
which they speak: the story never waits for a weekday), and the one the learner is going out with or married to comes
along. They are `TownWorld.guests`: residents of the sim without a place of their own (a `WorldPlace` of no size:
nothing drawn, nothing blocking), standing about near whoever they came to see (`CITY_VISIT_SPOTS`), in their own
look, with their own scene. The learner's children old enough to walk follow them here as in the town.

**Voices** (`core/town/cityAudio.ts`). The people of the city and the voices only heard: the BROWSER's voice, always
(`sceneAudio.ts`: never a clip, never a paid request). A town resident in a city scene: their own Gemini voice for the
connected line, as in their own episodes (the inventory's `cityScenes`: 103 clips, 5,484 characters to generate,
`npm run audio:generate`; until then the browser's voice of their sex). Their careful version is read by the browser
(no clip for it: half the clips). Honest about it on the page ("Westbay để làm gì?"): a browser voice reads word by
word and reduces little, so the city trains following a long talk; connected speech is trained by Chép chính tả and
the town's own episodes.

**The map** (`data/cityWorld.ts`): 48 × 48 tiles, three districts (Ga & bến xe, Chợ cũ, Phố nghệ thuật), three
streets running east–west and three north–south, the terminal plaza, the market square with its fountain, Station
Park, the seafront promenade; the bay along the near edges (`coast`: the town's sea and mountains draw round it), a
skyline of blocks along the far ones (scenery kind `block`: `h` storeys, four looks; `taxi`: a parked car). Every door
is on a +y face and nothing tall stands on the south side of a street (it would hide the street). The town's
"decorations" (street lamps, flower beds, the fountain, strings of lights, flags) are simply there
(`CITY_DECOR_ON`). Benches (12), Gianna's radio (Bay FM, the same segments) and the bus are things to use
(`CITY_THINGS`). Looks: `city/cityLooks.ts`; the 18 places' models: `city/cityPlaces3d.ts`; both register with the
town's (`registerLooks`, `registerRecipes`) when the city's page loads, so they stay out of the town's chunk.

**The roads out** (owner, the same day, on the first picture: "bị bao quanh bởi núi và biển, đường đâu mà xe bus
chạy"). The city first wore the town's range unchanged: mountains all along the far sides, the sea along the near ones,
and a waterfall pouring into Station Park. Now a world says how its range is cut (`TownWorld.range`, `three/scene/range.ts`
`RangeShape`; left out = the town's `TOWN_RANGE`): the city has no falls and three passes that carry ROADS: a level
cutting right through the range, climbing gently from the map's edge (`ROAD_CLIMB`), with the road drawn on it
(`backdrop.ts`). Station Avenue runs on west through it (the no. 9's road to the town), Station Road and Bay Road north.
`range.test.ts`: each pass is where a street reaches the edge, its floor is level across the road's width, the range
stands beside it. Seen in a picture of the whole city.

**The page** (`features/town/city/CityPage.tsx`; route `#/town?at=city`, `TownRoute.tsx`: two pages on the town's
route, the city in its own chunk). The stage with `world={…}` (`TownStage3D` takes its map as a prop), one button for
what is beside the player ("Nghe chuyện của Rico", "Nói chuyện với Tess", "Gặp Nora trước đã", "Ngồi xuống nghe",
"Lên xe số 9 về thị trấn"; with nobody near: "Tới gặp …" the next person with something new), a sheet for what is
heard, and "Người quen" (who has been met, their tie, how much of their story is heard; somebody not met shows only
their place). A scene with somebody of the city is staged in front of their own place (`talkAt` 'outside'), with a
town resident where they stand ('here'); whoever else speaks and is in the world comes and stands with them
(`engine3d.joinTalk`, `sim.talkAside`). No build panel, no shop, no map: the city adds no menu. Without 3D: the same
scenes from a list.

**The bus** (`thing:bus`, `BUS_THING`): at the town's bus station once it is built (stand T(56, 52)), and on the
city's terminal plaza. Its panel is a ride (`data/scenes/rides.ts`, a "cảnh nghe" of kind `ride`, 2 paid a day) with
"Đi luôn, không nghe"; getting off navigates (`?at=city`, back with `?from=city`: the player stands at the bus
station). `?listen=thing:bus` opens it.

**Rules and data** (`core/town/city.ts`, `cityStore.ts`; synced key `town-city`, merger `mergeCity`): per scene when
it was first heard, the most questions right, how often, when last; the first arrival. Pay: 2 xu a question right the
first time (an episode up to 6), 1 on a re-listen that is due, nothing before it is due (and that listen does not move
the next one); +10 friendship in the TOWN with each town resident who speaks in a scene heard for the first time (the
two places feed each other). Xu and friendship go to `town-progress`. Xu are a game score, never a measure.

**Checked.** Unit tests: the rules (`city.test.ts`), the merge laws, the content (`data/city/city.test.ts`: shape,
canon ties, needs without circles, every line decodes and is SAPI-safe, no copied sentence, Vietnamese without
English words, answers spread), the map (`three/scene/colliders.test.ts` "the city": every door and spot is open
ground, nothing shares a tile, a way from the bus to everybody, and keys walking ANYWHERE stop only at something
drawn: the lesson of the town's unseen walls applied from the first day). Looked at in pictures from
`scripts/town-shot.mjs` on the software renderer: the terminal plaza on arrival, the whole city from above, Rico's
first episode staged with its panel, the bus's panel in the town.

**Not done, not checked** (said plainly):
- nobody has HEARD a scene (the headless browser is mute) or watched people walk in; nobody has played it by hand;
- the ~900 English lines and their Vietnamese were written by models and read by nobody; the owner should read at
  least the six second episodes (they carry the old residents' voices);
- the 103 clips of the town residents' lines are not generated;
- of the proposal's step 2, NOT built: the two work shifts (Rico's taxi dispatch, Nora's flower orders), asking a
  friend along, dates and family outings written for the city (the partner comes along and has their one scene, no
  more), drawn portraits for the city's people (they have 3D portraits);
- the city has no weather drawn, no night-only life, no map or minimap; passers-by are the town's;
- a missed scene is not a review card; pay and friendship numbers are guesses;
- the mountains round the bay are the town's range, cut for the city's roads (see "The roads out" above); the town's own
  range has its two passes but no road drawn through them.

## 21. Westbay grows: six districts, work, outings, long stories, a week (2026-11-25)

The owner, after §20 was pushed and he was told what was still missing of the proposal: "không làm cho xong hết đi".
This is the rest of docs/city-proposal.md (its steps 2 to 4). The canon of everybody and every story is
`docs/city.md` (§7 the later districts, §8 the six long stories, §9 the week and the festivals).

**The map** (`data/cityWorld.ts`): laid out at 72 × 72 (every coordinate in the file), then **stretched to 96 × 96**
(2026-11-26, owner: "thành phố quái gì mà bé như lỗ mũi vậy? mật độ dân số quá đông không hợp lí"): `CITY_CUTS_X` /
`_Y` put land in between the blocks (`data/stretchWorld.ts`: a house, its door and spot never split, a street runs on,
a block of flats across a cut grows), 1.78 × the ground for the same people; the new ground gets low blocks of flats
(`fillers`: bare grass only, one tile clear of every street, square, house, door, seat and spot, two or three storeys),
merged by 12 × 12 chunks in 3D (`buildScenery`) and drawn on the full map (`drawMap` 'block'). The first three
districts were laid out first. New: **Khu văn
phòng** (north-east: Meridian's head office, the Loom design studio, FreshWay's office), **Đại học & bệnh viện**
(east: Westbay Hospital on the avenue, the phonetics lab, the library and the pharmacy on Arts Street's east end, a
campus quad), **Bến cảng** (the peninsula in the south-east: the electronics market, the Bay FM stage, the big wheel,
the ferry terminal, the night market on the harbour square). The bay is an inlet in the south-west now. Two more
streets north–south (College Road, East Road, a third pass in the range for College Road) and two on the peninsula
(Quay Street, Pier Road). 37 places, 18 benches. The map tests of §20 cover it (every door and spot open, nothing
shares a tile, a way from the bus to everybody, keys walking anywhere stop only at something drawn).

**People** (`core/town/cityPeople.ts`): 37. Twelve main people with three episodes each (the six of §20 and Priya =
Sarah's old desk-mate, Vivian = Lily's boss, Dr Osei = Kim's mentor, Professor Adeyemi = Daniel's tutor, Jun = Max's
first boss, Marcus = the voice of Bay FM and Tom's pen-friend), twenty-five people known with two short talks each.
Professor Adeyemi is the one person who talks about what the learner is doing here (how English is really said), and
he promises nothing: the ear is trained by hours. Yuki is a learner like the listener.

**Ca làm việc** (work shifts; `core/town/shift.ts`, `shiftStore.ts`, `shiftTypes.ts`, `data/city/shifts/`,
`city/ShiftPanel.tsx`; synced key `town-shifts`, merger `mergeShifts`): the café game's cousin, ONE engine and panel,
a shift is data. The learner hears a request in the browser's voice and sets two or three things right before the
patience runs out; ten requests a shift (levels 1,1,1,2,2,2,2,3,3,3), three misses end it; points (10 × level, speed,
+5 heard once, a combo), a best score, xu = score / 20 capped at 16 a day for each shift; missed requests come back
and are shown decoded at the end. Five shifts, 40 requests each: `taxi` at Rico's (pick-up, drop-off, when),
`flowers` at Nora's (flower, colour, how many), `desk` at Hana's (who the message is for, what, when), `kitchen` at
Gianna's (dish, change, table), `pharmacy` at Nell's (how much, how often, when: a pharmacist's instructions). The
content test checks that every request SAYS its answer and that an easy one never names a wrong option. Offered
beside the person ("Vào ca") once their first scene has been heard.

**Outings** (`data/city/outings.ts`, kinds 'date' / 'family', ids `cx-<host>-<n>`): with the one the learner is going
out with or married to (they come up on the bus with the learner, always), beside a host who has one: dinner at
Gianna's, two tickets from Wren at the Lumen, the seafront with Jonah at dusk; with a child along, the bakery, the
coffee cart, the comics stall, the fish stall. The partner is `who: 'partner'`, the child `'kid'`: their lines suit
anybody (a test forbids he / she / wife / son…), their name and face come at run time. Their voice is their own
Gemini voice, as in the courtship's scenes (§15): each partner line has a clip in the voice of every resident who can
be courted (11), each child's line in both children's voices (441 clips; `core/town/cityAudio.ts outingVoice`, the
inventory's `cityOutings`). Until the owner had asked "vẫn đảm bảo rule người cũ giọng gemini, người mới thì giọng
trình duyệt đúng không?", they were read by the browser: that broke the rule and was fixed the same day. Once a day each: +15 friendship with the partner, 2 xu a question right the first
time (`cityStore.finishOuting`, the day's `heard` list of town-progress). A second button beside the host: "Hẹn hò ở
đây" / "Cả nhà ghé đây".

**Asking a friend along** (`CITY_INVITE_HEARTS` 3): the town's bus panel has "Rủ đi cùng" (a plain select of the
friends with three hearts or more); they are in Westbay for that visit (`?with=<place id>`) and have a SECOND scene
there (`cv-<id>-2`, `city.ts scenesWith`: theirs only when they came up with the learner): their favourite place.

**The long stories** ("mùa truyện"; `CitySeason`, `data/city/seasons.ts`, `city.ts seasonNow` / `chaptersToday`):
six stories of six chapters, ONE CHAPTER A REAL DAY (the next opens the local day after the one before was heard),
played where it happens: in the city at somebody's place (the person's button reads "Chương hôm nay: …", a 'story'
marker over them) or in the TOWN at a resident's place (`where: 'town'`: the town's "Việc hôm nay" has "Tới nghe",
activity `season`, `city/SeasonPanel.tsx`, staged like a get-together; `?listen=season:<chapter id>`). A season
opens when the episodes it grows out of are heard. Chapters are stored and paid like episodes (`town-city`).

**The week and the festivals** (`CityEvent`, `data/city/events.ts`, `city.ts cityEventsOn`): a get-together every
weekday (Monday at Meridian, the professor's open talk, Jun's scam class, karaoke at Bo's, short films at the Lumen,
the night market with Marcus on stage, the ferry round the bay) and a festival every season of the year by the real
month. Heard as the town's get-togethers (kind 'event', `ce-<event>-<n>`, the browser's voice for everybody, one paid
a day). The stage takes the player to the host's place and gathers whoever speaks (`joinTalk`).

**"Hôm nay"** (HUD, `city/CityToday.tsx`): what is on, today's chapter of each story under way, who of the town is up.

**Voices** (checked by `core/town/cityAudio.test.ts` for every line the city plays): a town resident is heard in their
own Gemini voice wherever they speak in the city (episodes, talks, visits, the long stories' chapters, an outing as
the partner) and the learner's child in a child's Gemini voice; somebody of the city, a passenger, a loudspeaker, a
shift's caller: the browser's voice, always. Two exceptions, both the browser's voice on purpose: the city's
get-togethers and festivals ("cảnh nghe", as the town's own: owner, "nghe cho vui … bỏ ra đi khỏi tốn token"), and
the careful version ("Rõ từng từ") of a town resident's line in the city (half the clips). Clips to generate: the
owner runs `npm run audio:generate`.

**Not done, not checked**: see AGENTS.md §9 (kept there, one list).


## 22. The water, and a page to review everything (2026-11-26)

**The water** (owner, with pictures of a cosier game's ponds: "sao biển/nước xấu vậy", then "tham khảo cozyverse luôn
đi"; its qualities taken, nothing of it copied). The terrain paints the water from WATER_SHALLOW at the shoreline to
WATER_DEEP two to three tiles out (`terrain.ts waterAt`); the shader reads the depth back off that colour
(`materials.ts addWater`): clear turquoise at the shore (the sandy bed shows), deeper and more opaque in the middle, a
soft bright rim where water meets land with small waves lapping in, a slow web of light instead of the round dots it
had. Banks are sand under the water (the brown band is gone); pebbles lie along grass shores. On the lakes (water that
does not reach the near edges: not the sea, not the city's bay): lily pads, some in flower, and up to 60 fish swimming
circles under the surface (the fish material's own shader: nothing updated a frame). Seen only in pictures from the
software renderer (the park lake, the big lake, the beach at night); the motion of the waves and the fish was not
watched. Not done: drifting petals; the small ponds' shape (the rounded shore is tied to walking, §7).

**Duyệt nội dung** (`#/duyet-k7q2m9x4`, `features/admin/AdminPage.tsx`; owner: "cho tao một tài khoản quyền admin đi để tao đi
review toàn bộ"). The app has no accounts or server, so there is no admin to log in as: this page, reached by its
address only, lists every listening scene of the town and of Westbay by kind (episodes, the long stories' chapters,
talks, visits, outings with a choice of partner and child, get-togethers, festivals, overheard scenes, rides, the
radio) and every work-shift request: each line with who says it, the English, the meaning, a play button in the voice
the game uses, the questions with the right answer marked, "Nghe cả đoạn". It reads only: no coins, nothing written,
nothing waits for a day. Not in it yet: the town residents' own episodes and arcs, quick chats, street talks, the café's
orders, the cases (they have their own panels in the town).

**Chế độ admin** (the same day, on the page above: "cái quái gì đây, tao muốn chơi game mà"). The page at its hidden
address now turns an admin mode on and off (`core/admin.ts`): the app reloads onto a SANDBOX of its own (every stored
key under `nghe-noi-am-admin:` instead of the learner's; a device-local flag), seeded the first time
(`features/admin/seed.ts`: every place built, every decoration bought, 99,999 coins, every resident at full hearts,
the city met). Account sync is off in it (`cloud/config.ts` returns no config), so nothing of the sandbox reaches the
account and the real progress is neither read nor written. While it is on, the city lifts its waits (`city.ts`:
every scene open, a story's next chapter at once, every town resident up, every shift open). A banner says so on
every page. "Làm lại từ đầu" throws the sandbox away; "Tắt chế độ admin" returns to the real data. The reading view
of every line is folded under it. Tried in the dev server: turned on (25 things bought, 99,109 coins after the
purchases, 10 hearts each, all 55 city entries open with no "meet … first", 5 shifts), the real town-progress byte for
byte unchanged, turned off. Not tried: the deployed site, a signed-in account in admin mode (sync is off by design).

## 23. The residents as VRoid avatars, with a way back (2026-11-26)

The owner: "thấy mặt nhân vật nào nhân vật nấy y chang nhau, mày không làm đẹp được như stardew valley à?" The
people are built in code from one round body (chars/body.ts), so only colour, hair and the face texture differ. What
was tried that day, all looked at by the owner as pictures: more faces and head shapes on the same body
(`FACE_PRESETS`, `CharacterLook.face` / `head`: still one mould); free CC0 packs (Kenney Mini Characters: "vuông vầy
đâu ra con người"; Quaternius' packs of 2019 and 2022: "vẫn xấu dã man"); and **VRoid avatars** (anime, VRM files),
which he chose: "làm tiếp VRoid nhưng có setting cho chọn model trở lại như cũ", meaning EVERYBODY, not a trial
("rõ ràng tao bảo mày sửa hết").

**What is built.** All 13 residents of the town are shown as a VRoid avatar; the learner can pick the bodies built
in code again.

- **The files**: `public/vrm/<placeId>.vrm` and seven `base-*.vrm`, about 2 MB each, 41 MB together, baked by `scripts/vrm-bake.py`
  (Python 3 + Pillow, run by hand) from pixiv's free VRoid sample avatars after `scripts/vrm-recipes.json` (which
  sample, the resident's hair, skin and clothes colours, taken from the code-built cast). The bake recolours the
  textures by material class (skin: a per-channel multiply; hair, brows, clothes: a luminance-preserving recolour),
  shrinks them (256 px, the face 512, WebP: an avatar's textures weigh on the graphics card, and fourteen are on at
  once), drops the morph targets no kept expression uses and the morphed
  normals, and repacks the file: 221 MB of samples became 30 MB. The samples themselves are NOT in git
  (`.assets-try/vroid`, fetched from github.com/madjin/vrm-samples, a mirror): nine declare CC0 in their own meta
  (HairSample_Female / _Male, Sakurada_Fumiriya, Sendagaya_Shibu / _Shino, Darkness_Shibu, Victoria_Rubin, Vita,
  Vivi); AvatarSample_A, B, C are "not CC0" but their VRoid Hub pages, read on 2026-11-26, allow corporate and
  individual commercial use, redistribution and alterations, attribution not required. `fem_vroid` / `masc_vroid`
  of that mirror have no clear licence and are not used.
- **Who is who**, picked from each resident's DRAWN PORTRAIT (public/portraits; owner, the same day, on the first
  bake, which took its colours from the code-built cast: "diện mạo gì mà không map avatar vậy?"): the hair style
  and the clothes of the portrait pick the sample, the recipe gives its hair, skin, eye and clothes colours. Leo
  (orange hoodie) and Tom (red hoodie) = HairSample_Male; Daniel (mustard sweater, maroon tie) and Sam (navy uniform,
  gold tie) = Sakurada_Fumiriya, a shirt, vest and tie; Ben and Max = AvatarSample_C, a jacket; Emma =
  Vivi (a green apron dress); Mia = HairSample_Female (black twin tails; its cat ears are part of the hair and stay);
  Grace = AvatarSample_A (a bob and a cardigan) in grey; Sarah = Sendagaya_Shibu (a bob, a vest over a shirt); Kim =
  Victoria_Rubin (a long side ponytail) in white; Zoe = AvatarSample_B; Lily = Sendagaya_Shino (long hair). Ten
  samples, three of them men: the six men share three faces. Every face is a young anime face: Grace is not an old
  lady, Ben has no beard, Emma no ponytail, Zoe no bun.
- **On the head, in code** (`vrmBody.ts wear`, `VrmExtra`), what the portrait has and no sample does: round glasses
  (Grace, Daniel), a bun (Grace), a uniform's peaked cap with a gold band and badge (Sam), sunglasses pushed up into
  the hair (Tom), a crown of flowers (Lily). Placed by the eye bones and by the face mesh's own front (glasses sit
  on the nose); `tall` per resident.
- **The bake's lessons** (`scripts/vrm-bake.py`): dark cloth recoloured by luminance alone stays black (Sam's navy
  uniform did), so clothes get a floor (`lift`, picked from how dark the image is) and hair one that grows with the
  target's lightness (grey and blond on a sample's black hair); and a sample may tint a pale texture through the
  material's colour (the older samples' black hair), so a recoloured material's `_Color` and `baseColorFactor` go
  to white. `VRM_VERSION` is 3.
- **Everybody else** (owner, the same day: "sửa hết toàn bộ nhân vật luôn đi chứ"): the learner, passers-by,
  children, the people of a room and Westbay's 37 have no file of their own. Seven TINTABLE bases
  (`public/vrm/base-<name>.vrm`: three men, a jacket, a hoodie, a shirt and tie; four women, a bob, long hair, a
  ponytail, a bob with buns) are baked with white hair and clothes and one light skin (`BASE_SKIN`); `vrmFor(id,
  look)` picks the base from the code-built look (who it reads as, the hair style, a tie or a collar; the same
  person always the same base) and `vrmBody.ts paint` multiplies each material by the look's skin, hair, top and
  bottom colours. Glasses, sunglasses and a cap carry over; a bald look hides the hair; a child stands lower (its
  head keeps its size: a larger one throws the hair's spring bones about). The wardrobe's outfit colour repaints
  the top (`setOutfit`); hats do not show.
- **The engine**: `chars/vrmPeople.ts`: `dressWhenNear` is asked each frame for everybody (residents, passers-by,
  children): an avatar is fetched only for somebody within 18 tiles of the middle of the view,
  and at most `MAX` 22 are worn at once (three files read at a time): when a nearer one wants theirs the farthest takes theirs off
  (`Worn.undress`, the code body shows again). `dressInVrm` (kept on whatever the count) for the learner and for the
  people of a room (`roomStage.ts`). `chars/vrmBody.ts` (`wearVrm`) is lazy, with `@pixiv/three-vrm` and three's
  glTF loader in the chunk `vrm`, about 220 kB. A file that fails to load leaves the code body (so does the portable
  build opened from disk, which cannot fetch).
- **Nobody is seen changing bodies** (owner: "mới vào sao vẫn còn model cũ vầy đợi 1 lúc nó mới thành model kia, mày
  làm UX tệ quá"): somebody whose avatar is on its way is not drawn until it is there (`vrmPeople.ts start` hides the
  code body; a failed file brings it back), and the engine keeps the town's loading card up after the first frame
  until `avatarsSettled()` or `AVATAR_WAIT_MS` 9 s.
- **No animation files.** The hidden code body keeps its Animator; its pose is copied onto the VRM's humanoid bones
  each frame, so sit, talk, wave, yes / no, cheer and the head's look carry over, with the face as expressions
  (blink, happy, the mouth while talking). Bridged: the arms (the code body rests arms down, a VRM in a T), sitting
  (posed for the avatar's own long legs), VRM 0.x looking down −z.
- **The walk and the run are the avatar's own** (owner, on the copied gait: "đi chẳng tự nhiên gì cả, mày đánh tay
  để làm gì vậy?", "chạy càng xấu hung": the code body's gait is quick little steps with the arms held out).
  `vrmBody.ts` blends in, by `Animator.move`, a cycle of its own: thighs swing ±0.4 rad (0.7 running), the knee
  folds as the leg comes through, the arms hang by the body and swing against the legs (elbows bent running), a
  small lean and twist of the trunk, the hips dipping as the legs spread; the step is as long as these legs make
  it, so its pace follows the ground covered (no sliding by construction).
- **The stride, second go** (owner, on the first cycle, two straight legs swinging like a pair of compasses: "chạy bộ
  nhìn vẫn gớm vậy"): `legCycle` takes a leg through a stride: it leaves the ground bent, folds further as it
  comes through, opens out to land and gives a little under the weight; the knee is lifted further forward than
  the leg is left behind; the toes point down at toe-off. Running, the body is up when the legs are furthest
  apart (walking it dips there).
- **On a vehicle** ("đạp xe đạp thì nhìn như dị tật chân còn không có animation đạp xe?"): the engine tells the
  character what it rides (`Character3DPlus.ride`), and `ridePose` poses for each: a bike is PEDALLED (`legTo`, a
  two-bone reach to a pedal going round with the ground covered, the axle put under the hips by guess, not read
  from the bike's model), hands to the bars; a scooter and a motorbike knees forward; a horse astride; a car legs
  out in front, hands on the wheel. No see-through hole is cut round the player in their own vehicle
  (`fadeInFront`; "ngồi trong xe mà sao mờ mờ").
- **Hats and held things** (2026-11-26): a hat of the wardrobe goes on the avatar's own head (`putHat`: the
  code body's hat geometry brought down to this head by the eye gap; `Character3DPlus.hatId`), and what the pose
  says is held (cup, watering can, rod, book: the same weights as the code body, `PROP_PLACES`) is put in the
  avatar's right hand, kept upright in the body's frame, the book in front of the chest; the fishing line runs to
  its float (`castLine`). Seen on the admin sheet (`?worn`): the cup at the mouth, the can, the rod, six hats; the
  book was edge-on to that camera and not made out.
- **Size**: an avatar stands `TALLER` 1.85 × the code body (1.4 at first: "người quái có chút xíu vầy"; a slim
  figure at the code body's height reads tiny beside the houses). Benches come to its knees.
- **Cost**: `slim()` drops the outline pass and merges skinned meshes that share a material (a sample's 90–130
  draw calls become about 23). On the software renderer: the plaza with 10 avatars worn of 21 people, 249 draw calls
  and 0.77 M triangles; Westbay's terminal with 7 worn of 50, 254 and 1.31 M (the town alone: about 100 and 0.5 M).
- Night: a VRM's colours are multiplied towards `NIGHT` with the scene's night amount (a light blue-grey: the first
  value turned dark clothes into a silhouette on the owner's screen). The name tag sits over its
  head (`headTop`).
- **The way back**: `townUi.people` `'anime' | 'classic'` (device-local, default anime), Cài đặt → Hiển thị → "Nhân
  vật trong thị trấn". It applies when the town is opened.
- The service worker keeps avatars cache-first in their own cache (`nghe-noi-am-vrm`); `VRM_VERSION` in the address
  goes up when the files are baked again.
- The admin page has the sheets used to look at all this, dev server only (`features/admin/ModelPreview.tsx`:
  `?cast` every resident's avatar, `?acts` the actions, `?bases` the twelve samples), and `LookPreview.tsx` (the 16
  faces; the 13 pieces of street furniture of `scene/furniture.ts`, in the world since 2026-11-26: §26).

- **Older faces and beards** (2026-11-27; owner, on Dr Osei's young anime face beside his portrait of an old doctor
  with a white beard: "không làm model già đi được hả? không khớp avatar"). Who is older or bearded was read off the
  drawn portraits one by one (`data/townVrm.ts`: `VrmFace` { age 'older' | 'old', beard 'stubble' | 'moustache' |
  'goatee' | 'short' | 'full', its colour, stubble }): Grace old; Ben a short dark beard; in Westbay Dr Osei,
  Professor Adeyemi (white goatees), Frank (a short grey beard), Hal (a full grey beard), Mei and Mrs Okafor old;
  Mr Finch, Mr Whitlock and Captain Odile older; Gus a moustache over stubble; Marcus, Jonah, Theo and Rico short
  beards; Iris and Vivian listed with nothing (white hair, young faces). Anybody else by their look (`faceOf`): a
  'beard' extra is a short beard of the hair's colour, grey hair an older face, a child never. A look's 'coat' (Osei,
  Nell) turns a tintable base's top white.
  - `chars/vrmAge.ts ageFace`: lines drawn on a canvas copy of the face's skin texture, blurred a little and
    MULTIPLIED (darker skin, so they survive the tint and show on dark skin): forehead lines and nose-to-mouth lines;
    'old' also crow's feet, bags under the eyes, hollow cheeks, lines down from the mouth; stubble as dots. The copy
    replaces both the map and MToon's shade texture (else the shaded side keeps the young face). A bald head's
    painted hairline becomes bare skin on the same copy (Frank and Adeyemi had a black skullcap). Where things are on
    the texture (`FACE_UV`) was measured on the seven bases and two residents' faces: VRoid faces share one layout
    within about 2 %.
  - `beardMesh`: ONE mesh grown from the face itself: the face's own triangles under the nose, picked by their place
    on the texture (`beardAt`, the lips always left open), pushed out along their normals, thin at the edge, a full
    beard hanging below the chin; on the head bone (it does not follow the mouth's morph targets).
  - 'old' bodies stoop a little (spine forward, head held up, not when seated or riding) and take shorter steps
    with less arm swing (`legCycle` stride). Old brows are as pale as the hair (tintable bases only).
  - A bald avatar's crown is closed by a dome of its skin colour (`scalpMesh`; the face mesh is open where the hair
    was, and the inside of the head showed as a dark skullcap): one more mesh for a bald person.
  - Seen on the admin sheet `?elders` (each person: portrait, the avatar without age, with it, with it face on, the
    body; `.assets-try/previews/elder-sheet.png`, `elder-faces.png`) and in the world at the usual camera, the person
    put beside the player (`elder-world-home|shop|osei.png`, `elder-world-close.png`): there Ben's dark beard reads,
    Dr Osei's white goatee is a small pale patch, Grace's lines do not show at all (a head is some 25 px).

**Not done, not known.** Age is drawn ON a young face: the eyes stay big and round, the face round and smooth in
shape, so an old person reads as a young face with lines and a beard, not an old face (Grace is still no old lady);
receding hair cannot be done (the hair is the sample's: Frank's fringe is gone with the hair hidden, Osei keeps a
young spiky crop), nor a white coat (Osei's and Nell's tops turn white, the shirt base's vest stays pale grey). The
lines do not show at the usual camera distance (a head is some 25 px there); a dark beard does, a white one barely. A resident's brows keep
their bake. An avatar of a RESIDENT keeps its baked clothes whatever outfit colour is set. Portraits and thumbnails are untouched, and so are pets. Past the nearest fourteen, people are still the
round code-built figures (a crowd in Westbay is mixed). A tall slim figure among round trees and low benches
is a clash of styles nobody has judged in motion. Seen only as pictures from `scripts/town-shot.mjs` (the software
renderer): the sheet of all 13, eleven of them on the plaza by day, one at night, the action sheet; a seated avatar
on a real bench and a room were not looked at. Nobody has watched it
move, measured it on a real GPU or opened it on a phone (13 avatars are 30 MB to fetch and about 0.5 M triangles
more: "Kiểu cũ" is the way out, nothing switches by itself). Residents made in VRoid Studio would replace a file
one by one (`public/vrm/<id>.vrm`, bump `VRM_VERSION`).

## 24. The clock and the weather, after GTA (2026-11-26)

The owner: "hiện tại ngày đêm đang như thế nào? có mưa không? tham khảo thời gian rồi thời tiết này nọ của gta rồi mô
phỏng theo đi". Until then day or night in the town was the app's light or dark theme, and the weather a word in
"Việc hôm nay" that the radio read (`core/town/world.ts weatherOf`): nothing was drawn.

- **The clock** (`core/town/sky.ts`, pure, tested): as in GTA V a day of the game is 48 real minutes (an hour is two).
  It is a function of the real time alone: every machine reads the same hour, a reload changes nothing, nothing is
  stored. `nightOf(hour)` eases through dawn (05:00–07:00) and dusk (17:30–20:00); `glowOf` is the gold of both.
- **The weather**: four skies, clear, cloudy, rain, storm, in stretches of six game hours (12 real minutes), the last
  hour of one easing into the next (`skyAt` gives a mix: cloud, rain, storm, wind). The day's own weather leans the
  odds (a "rain" day is wet two stretches in three, a clear one about one in eight), so the radio and the sky mostly
  agree. `lightningAt` / `strikeIn` give the flashes of a storm from the same clock.
- **Drawn** (`scene/engine3d.ts`, asked twice a second through `core/town/skyNow.ts`): the engine's `night` follows
  the hour (lamps, lit windows, fireflies as before); `world3d.setWeather` dims and greys the sun under cloud, cools
  the light from all round, and turns the sun gold at dawn and dusk; a grey day is exposed a little darker; rain is
  `scene/rain.ts` (2,600 streaks falling in the vertex shader in a box round the view: one draw call, no work a
  frame, slanted by the wind); a flash of lightning brightens the whole picture for a moment; leaves and cloth sway
  harder in the wind.
- **Heard** (`sfx.ts setRainSound`, `playThunder`, driven by `SkyChip.tsx`): the rain's hiss as loud as it rains, a
  roll of thunder after a flash. Never over a spoken line (this is a listening app), never when effects are off.
- **The HUD**: one pill, an icon of the sky and the hour in fives (`SkyChip.tsx`, in the town and in Westbay; hidden
  under 560 px). `useTownTheme` (the map's and the overlay's day or night) follows the clock too.
- Dev: `window.__town3d.debugSky(18.5, 'storm')` holds an hour and a sky for a picture; no arguments gives the clock
  back.

### The sun, the air and the ground (2026-11-26, later)

So that the hour reads in the light and the weather on the ground, as in GTA:

- **The sun moves** (`core/town/sunPath.ts sunAt`, pure, tested). It is up from 05:15 to 19:36 of the game, low in the
  east (+x) at dawn, exactly the old `SUN_DIR` at 12:25 (the offscreen studios keep that), low in the west at dusk:
  its way on the ground turns 95° either side of noon, its height eases from 51° to 14° (never lower while it lights,
  so a shadow is at most four times as long as what casts it). At night the same light is the moon on its own lower
  arc (highest at 00:30). Round each hand-over the light fades to nothing over an hour and the direction swings from
  where the sun set to where the moon rises while it is almost dark, so the direction is continuous all day and the
  swap is not seen (tests: unit length, the lowest height, no jump over the whole day and midnight).
- **No shimmer from a moving sun.** The shadow map is re-aimed only once the light has turned 0.3° (`stepSun`): a
  step every few real seconds by day, never every frame; at each step the light's own right / up axes are worked out
  again (`world3d.ts lightBasis`) and the box keeps snapping to whole texels in that basis (`shadowCenter(at, texel,
  basis)`). `shadowSnap.test.ts` checks the snapping for directions all through the day and that two real minutes of
  frames make a few dozen steps, each held for over a hundred frames. A step itself moves shadow edges by less than a
  texel once; whether that is seen in motion only the owner can say.
- **The sky's colour** (`scene/skyLook.ts`, pure, tested): the sky canvas still paints its day and night palettes, now
  tinted by the hour and the weather: pink and gold at the horizon at dawn and dusk, grey under cloud, darker in the
  rain, thicker grey shapes, no stars through cloud. From the usual camera the sky shows only at the island's far
  edges and in a wide view.
- **Mist and haze** (`core/town/sunPath.ts hazeOf`; shader in `scene/weather3d.ts`): no fog object (switching three's
  fog would rebuild every shader): the shared materials (`materials.ts`: the standard, the swaying and the water
  materials) fade into the horizon's colour by their distance BEYOND what the camera looks at, thicker near the
  ground, so the player and what is round them are never in it. None at a clear noon, a light mist at dawn (heavier on
  wet ground), a little at night, more in the rain, most in a storm. The avatars (VRM, their own materials) and the
  backdrop's road and falls do not take it.
- **Wet ground** (`sunPath.ts wetAt`, pure, tested; `skyNow.ts wetNow`): the ground gets wet with the rain and dries
  over four hours of the game after (8 real minutes). Nothing is stored: the wetness at any moment is read off the sky
  of the four hours before it, each moment by its own day's weather. Faces looking up darken and turn glossy; on low
  flat ground, seldom on grass (told by the vertex colour), puddles open where a fixed noise is high: darker, almost a
  mirror, with the sky's colour in them and the lamps' lights at night (Westbay's asphalt under its street lamps).
- **Cloud shadows**: on a broken-cloud day (none under a clear or an all-grey sky) soft patches of shade drift over
  everything with the wind (the direct light dimmed in the same shaders, one shared uniform moved each frame). Under
  a grey sky the shadows go faint (`shadow.intensity`).
- **Reduced motion** (`still`): the cloud shadows stop drifting and the rain stops falling, the light of the hour, the
  sun's direction, the mist and the wetness still show.
- Cost: no new mesh or pass (a few noise lookups in the shaders that were drawn anyway). A low sun does cost: its
  longer shadows come from casters further off, all drawn in the shadow pass. Along the light's up axis the shadow box
  now covers only what is in view on the ground (`rv` in `world3d.update`, its own texel for the snapping), which took
  the first measure of a dawn from a third more draw calls down to this, measured in one page each on the software
  renderer, Westbay's centre at zoom 1: noon 124 calls / 1.17 M triangles, rain 14:00 123 / 1.08 M, dawn 06:12
  151 / 1.63 M, dusk 18:30 147 / 1.44 M (the town's plaza could not be compared: people walking in and out of view
  move it by 60 calls). Dev: `debugSky(hour, sky, wet?)` (wet defaults to 1 in rain and storm, else 0).

**Not done, not known.** No clouds drawn in the 3D sky (only their shadows and the canvas's shapes), no moon drawn,
no reflections of buildings in puddles (only the sky's colour and the lamps' highlights), no splashes, nobody opens an
umbrella or goes indoors, the birds fly in the rain. The app's dark theme no longer makes the town dark (a learner in
the dark theme sees a bright town at the game's noon). Residents still live by the REAL clock (their week, their
opening hours), not the game's. Seen only in pictures from `scripts/town-shot.mjs` on the software renderer
(`.assets-try/previews/sky-*.png`, outside git); nobody has heard the rain or the thunder (the headless browser is
mute), watched a sky ease into another, a shadow step, the clouds drift or a flash. The loudness, the odds, the mist's
strength, the drying time and the puddles' look are guesses.

## 25. Bay FM, true of the game (2026-11-26)

Section 4.5 of docs/gta-plan.md, the part that does not wait for M0: the radio says things that are TRUE in the game
at the moment it is heard, so listening to it tells the player something they can act on.

**What is read.** `core/town/radio.ts` (pure, `bulletinAt`) builds a bulletin from the real time, the day's own
weather at any time (`weatherOf` of that local day), the weekday, the month, the town's get-togethers and any news
queued about the player. Marcus says, in his own manner (pieces in `data/scenes/radioLive.ts`): a greeting by the
game's hour and an ident; the time by the game's clock to five minutes ("It's just gone quarter to eight", "coming up
to", "exactly", sometimes with the weekday); the player's news, if any; the sky now (day and night lines); a forecast
read off `sky.ts skyAt` at future times, every five minutes of the clock for the next 12 hours of the game: up to two
changes, each named by the full hour after it is seen when the sky is already so all the way to that hour ("Expect
rain by six this evening", "After that, expect clear skies by midnight", "six tomorrow morning"), else the clock; or,
with no change, "it should stay that way until at least …"; what is on today (the town's get-together and Westbay's
day, or its festival when the town has none); a sign-off. Its questions are the scene format's (`gist`, `detail`), so
ListenPanel / SceneFlow play it like a written segment: the sky now and next (three look-alike summaries), then either
WHEN the sky changes (the time said, and the same hour six hours either side) or what is on today (today's event
against two of other days). A line under the result says what the forecast holds ("Bay FM báo cho 18:00: Trời mưa").

**Proved by tests** (`core/town/radio.test.ts`): for hundreds of times and each day's weather, plus a day's weather that
jumps mid-stretch, the sky said now is `skyAt` now, every change named is so at the time named and at every game
minute from when it is first seen to it, and nothing changes before that; the time check matches the game clock; the
line read names the same time as the "when" answer; every bulletin is whole (no empty slot, plain English of 3–16
words that decodes and is SAPI-safe, three different answers, the right one in every position); today's events are the
data's (Westbay's copy checked against `data/city/events.ts`, kept apart so the town's chunk does not load the city's
scenes).

**Where.** The café's radio (`thing:radio`) and, while riding any vehicle, a "Radio" pill above the ride button
(`features/town/scenes/CarRadio.tsx`, in the town and in Westbay; focus `CAR_RADIO`; it reads `rideState`, never
changes it, and the player is not sat down or got off). `core/town/radioStore.ts radioScene`: a bulletin and a
written segment (`radioNow`, as before) take turns, the bulletin first, always the bulletin while news waits (the turn
is counted in memory).

**Pay**: exactly a radio segment's (`world.ts scenePay`): 2 xu a question right at the first try, within the day's 3
paid radio scenes shared with the written ones; one id per hour of the game (`fm-live-<n>`, two real minutes), so one
edition never pays twice. Nothing new is stored or synced. Listening time is not logged (it is app-voice listening).

**The call-in show and adverts** (2026-11-27, gta-plan §4.5). The radio now takes turns three ways: a bulletin of the
moment, a call of the call-in show, a written segment (news waiting always gets the bulletin; `radioStore.radioScene`).
A call (`data/scenes/radioCalls.ts`, nine, ids `fm-call-<n>`) is a short exchange: Marcus takes it, a listener says what
they rang about, Marcus answers; then one question. The callers are nobody the learner has met: the browser's voice, in
one of the dispatch office's four manners through their speaker key (`caller-clear-f` … `caller-badline-f` in
`SCENE_VOICES`, which now carries a manner's `rate` and `volume`, applied by `sceneAudio.sceneLinePlayback`; a bad line
repeats its own words). The ladder: three clear and unhurried calls, three hurried, three mumbling or on a bad line;
`radio.ts callNow` offers the lowest rung that still has a call not heard lately. Paid as a radio segment, inside the
radio's three a day. Each generated bulletin reads one advert before its sign-off (`RADIO_ADS`, nine, for real places
of Westbay and the town, true of them); three say something a job could use (`RADIO_CLUE_ADS`: `ad-bo`, Bo's big room
booked from nine on Thursdays; `ad-twin-ovens`, the bakery's back door from five; `ad-wheel`, the big wheel's last
ride at quarter to ten), exported with stable ids for the job engine's `clue:<id>` and NOT wired from the radio.
Checked by `radioCalls.test.ts` (the scene rules, the ladder, the manners, the places, the clue ids, an advert in every
bulletin); nobody has heard a caller.

**News about the player** (`core/town/radioNews.ts`): `queueRadioNews({ id, lines: [{ text, vi, say? }] })` queues up
to 4 of Marcus's lines for the next bulletin (at most 3 items, the same id replaces, forgotten after 6 real hours or a
reload: in memory only); read after the time check, dropped once that bulletin is heard through. Not wired to M0.

**Voice**: Marcus is a Westbay person: the browser's voice, never a clip (nothing goes into the clip inventory).

**Not known.** Nobody has heard a bulletin (the headless browser is mute): how the browser voice reads nine lines in a
row, the pace, whether "twenty-five to two" is caught. Looked at only in pictures from `scripts/town-shot.mjs`: the
café's radio at its first question (rain at 22:40, the gist "Trời mưa, lát nữa …"), the pill while on a bike at
1400×900 and 390×844 and its panel on a phone; the pill in Westbay was not looked at. The English of the pieces was
written by a model and read by nobody else; the Vietnamese meanings are shown in Vietnamese in English mode, like every
meaning (docs/i18n.md §4).

## 26. Street furniture: each district its own (2026-11-26)

Owner, 2026-11-26: "đồ đạc cũng đa dạng khác biệt lên" (the whole town had ONE bench and ONE lamp, copied everywhere).
Thirteen pieces were modelled in code (`three/scene/furniture.ts`) and shown on the admin page; the owner saw them and
said to do it. They are in the world now.

**Benches and lamps by district** (`data/townFurniture.ts DISTRICT_LOOKS`). Every bench and street lamp keeps its
spot (people sit there, the night's lights are placed there, stored data holds only ids); what changes is which model
is drawn there. The district of a spot is `districtAt`: of the district boxes holding it, the one whose middle is
nearest (boxes overlap at their edges: the orchard's bench under the market's box is the orchard's), else the nearest
box. The town: stone benches and two-globe lamps on the plaza, the old lantern on the market street and in the park, in
the fields, on the country road and the harbour, iron-armed park benches by the lakes and in the homes' lane, log
benches out in the woods, hills, orchard and meadow, the classic wood-and-iron bench and arm lamp at the bus station and
on the beach, stone on the quay and the cape. Westbay: lanterns over stone benches in Chợ cũ, two globes over stone in
the office district and over park benches on the campus, park benches on Arts Street and the seafront, lanterns at the
harbour over the classic bench, the classic at the station. A bench of any look seats people at `SEAT_TOP` (the log
bench's top was lowered to it; the park bench's slats sit 0.008 under it); its collider is its own size
(`colliders.ts BENCH_SIZE`). A lamp's light and halo stand where its bulbs are (`layout.ts lampLight`: the classic one
out over its arm, the lantern's glass box, the middle of the two globes, whose bar runs the way the old arm reached);
the bulbs use the bulb material, so they glow at night like the old ones. The small 'lantern' props (by the inn, the
pier…) are unchanged.

**The small things** (`TOWN_FURNITURE`, `CITY_FURNITURE`; `TownWorld.furniture`). Placed by hand where they make
sense. The town (34): bins 10 (the plaza, the market street, the lake, the homes' lane, the bus lay-by, four on
the beach promenade, the harbour), picnic tables 7 (the park, the lake shore, the big lake, the meadow, the grassy hill,
the pond), crates and barrels 8 (behind the market stalls and Ben's shop, by the stall across the street, by both
barns, three on the harbour quay), flower pots 3 (by Grace's, Mia's and Sarah's doors), bike
racks 2 (the bus station, where the footpath comes down to the beach), post boxes 2 (by Tom's notice board,
on the plaza's east side), a newspaper box by the bus stop's bench, a hydrant by the clinic. Westbay (47): bins 9,
crates 8 (by the market square's stalls, at the night market, by Jun's, the ferry and the pier road), hydrants 9 (along
Market Street, Arts Street, Station Road, by the hospital, on Quay Street, in the office district), bike racks 5
(Central Station, Arts Street, the offices, the campus quad, the library), post boxes 4 (the station, Market Street,
the bookshop, across from the hospital), newspaper boxes 4 (Station Road, Bay FM, Mr Whitlock's stand, the Bay FM
stage), picnic tables 5 (Station Park, the seafront, the campus lawn), pots 4 (between the shops on Market Street, by
FreshWay's and the computer room's doors). A thing's front looks to +y or +x (`face`), the sides the viewer sees.

**Rules, tested** (`data/townFurniture.test.ts`): on grass or sand (crates and bins may stand at a market square's
edge), never on a street, a path or the water, never on a tile something else stands on (a house, a prop, scenery, a
decoration spot bought or not, a town project, a tree), never on a door, the tile in front of a door, a resident's
spot, a seat's approach, a chat, a life spot, a walk's point, a district's arrival, the start; a tile clear of every
parked vehicle. Every one is solid as big as its model at body height (`colliders.ts FURNITURE_SIZE`,
`furnitureColliders`, measured from the scaled models; `three/scene/colliders.test.ts` checks each against its model
and the reverse); the walking tests (`engine/noStuck.test.ts`, `noWedge.test.ts`, `colliders.test.ts`) prove a body is
stopped only by something drawn and nobody is shut in. They caught three placements on the way in: crates behind the
stalls that made a pocket by the planter, a bin and crates diagonal to each other on the market street that made a
nook a held key stuck in, crates on a Westbay chat spot. Then `townWorld.test.ts` caught a bike rack by the school and
a bin on the plaza closing the way round a decoration's spot (the flower bed, the flags): both taken out. And
`engine/sim.test.ts` "a click walk never stays stuck behind somebody" failed at 30 Hz seed 1, walk 3: the player and
Leo stood waiting for each other on the open plaza, nothing of the furniture within 0.6 of them. It is chaotic, not a
narrowed way: taking out almost any one of several unrelated pieces (a beach bin, the station's bike rack…) passes it,
because any change moves the seeded residents differently. The pots beside the café's terrace were taken out, which
passes it; the stand-off itself is a weakness of the sim (engine/sim.ts) that another seed may still find.

**Size.** The residents are tall avatars (§23; 1.85 × the code body when these were chosen, 1.45 × since cbaa653, not revisited), so the small things stand bigger than modelled
(`furniture.ts FURNITURE_SCALE`: post box 1.7, newspaper box 1.6, hydrant 1.45, bins 1.4, crates, pots and bike rack
1.35, lantern 1.15, globes 1.1); seats stay at 1. The admin page's preview draws each piece at that size.

**Cost.** The small things are merged by chunks of 12 × 12 tiles (`streetFurniture.ts buildStreetFurniture`, as the
city's blocks): a body, and the pots' leaves in the sway material, per chunk; the camera culls far chunks. A bench or a
lamp of a district's look is one piece, as the classic one was. Measured on the software renderer at the plaza with everything built (admin sandbox, noon): 198 draw calls and 0.62 M triangles with the furniture, 192 and 0.60 M with its chunks hidden. Westbay, the same way: the old town 196 calls with the furniture, 187 without (1.28 M and 1.26 M triangles), the offices 253 / 249, the harbour 264 / 259, the old town at night 251 / 241.

**Not known.** Seen only in pictures from `scripts/town-shot.mjs` (software renderer, day and night); nobody has walked
round them with real keys, watched a resident sit on the new benches, or seen it on a real GPU or a phone. The chunks'
bounding boxes are not used for picking or fading (both go by other boxes).

## 27. Rico's dispatch office: phone two (2026-11-26)

`docs/gta-plan.md` §4.4 ("Hãng xe của Rico ở trạm gác cổng cảng: mày là người điều phối"), built as a loop of its own:
a steady source of play and income that is answered on a map, not in a quiz.

**Where.** The old harbour gatehouse that Gus offers Rico at the end of the main story's part 2 (`cs-bigdeal-6`: "Two
phones would fit. A map, too."). The map has no gatehouse of its own, so Gus's hut on Pier Road stands for it
(`data/city/dispatch/places.ts OFFICE_AT`): beside Gus a second button "Văn phòng" opens it, and a quest card
"Văn phòng điều xe" walks the player there (`features/town/dispatch/dispatchQuest.ts`). It opens once `cs-bigdeal-6`
was heard (`core/town/dispatchStore.ts dispatchOpen`), at once in the admin sandbox; in the no-3D list it is a button.
The office is drawn over the whole window (`DispatchOffice.tsx`, the 3D stage paused behind it).

**A shift** (`core/town/dispatch.ts`, pure, tested; about five minutes):
1. Eight calls ring on phone two, slowly at first, two or three at once near the end (`CALL_TIMES`). The learner picks
   which to answer. A caller (the browser's voice, a man or a woman, by `manner`: clear, hurried, mumbling, a bad line
   whose words repeat themselves) says ONCE where they are and where they want to go, sometimes more (how many, "in ten
   minutes", "at the back", "no, sorry, not the station, the stage"). "Xin nhắc lại" (and the shared replay / slow keys)
   makes them say the two places again, slower; every repeat is counted; past two the caller is cross (no tip); three at
   most.
2. The learner taps the pickup and the destination on the map on the wall (`DispatchMap.tsx`: Westbay drawn from its own
   tiles, north up; a tap or a district's button zooms into a district, where each place carries the name on its sign,
   in English), then one of Rico's three cars (Rico, Tess, Theo: on the map or in the list, each with its time to the
   pickup). A busy car can be given a job (it goes when done); "the near one" = within 8 s of the quickest
   (`nearestCar`, `isNear`).
3. The world answers: the car drives the streets (`core/town/dispatchRoads.ts`, breadth first on the painted street and
   square tiles) and the driver radios. A wrong pickup: "nobody here", the caller rings back annoyed and says the place
   again (`CALLBACK_LINES`); on that second try they stay on the line and talk the driver in, so it always rejoins. A
   wrong destination is found out at the drop ("they wanted …") and the car takes them on. One consequence each.
4. Bayline (docs/city.md §13–14): a call left ringing over 35 s, or heard and left without a car over 70 s, goes to a
   Bayline car, at most two a shift, never a callback; the phone warns from 70 % of the wait (`goesToBayline`,
   `baylineShare`). Rico says so on the radio.
5. The end (`DispatchDebrief.tsx`): heard right the first time (no repeat, both places right: the only "nghe 1 lần là
   đúng"), repeats, places misheard, Bayline's; each call with its outcome, its words (the call, the repeats, the
   callback) with the meaning, "Nghe" and "Rõ từng từ"; the radio folded. The calls whose places were misheard become
   review cards `talk:disp-<id>` (`jobStore.enrolJobMisses`; Ôn tập resolves them in `features/review/resolve.ts`,
   the caller in the same browser voice). Bay FM's next bulletin mentions a good or a bad night (`radioNews`).

**Content** (`data/city/dispatch/`): 44 calls (14 plain, 15 everyday, 15 hard; 22 men, 22 women), 28 places, 18 pairs
of places a careless ear confuses (11 that sound alike in connected speech, 7 next door), WHY each is written beside it in
`places.ts`; every call's `fromNear` / `toNear` is the other half of a pair (tested). The drivers' radio lines, the
callbacks, Rico's lines and Bay FM's are templates filled with the places' spoken names; every one, filled with every
place, is checked short and speakable (`dispatch.test.ts`). Nobody of the town speaks here: no clips, nothing in the
clip inventory.

**Pay (guesses).** 2 xu a call right first time, +1 heard once (not with a far car or a cross caller), 1 for a call that
needed a second go, 0 for Bayline's; two paid shifts a day (`dp-shift-1`, `dp-shift-2` in the daily set `heard` of
town-progress; a shift that earned nothing does not use one up): at most 48 xu a day, as Rico's taxi fares. No new
stored or synced key: a shift lives in memory, a reload drops it unpaid.

**Not known.** Played only by script in headless Edge on the dev server (the voice is muted there); nobody has heard a
caller, judged the speeds and manners, or played a shift by hand, by touch on a phone, or in English. The pace (eight
calls, the ring and decide limits, the car speed), the pay and the difficulty mix are untuned; there is no automatic
difficulty yet (gta-plan §11.3 wants one around 85 % right). The 44 calls and the radio lines were written by a model
and read by nobody. The places are shown by English labels on the wall map (what the caller says), their Vietnamese
names in the slots and the debrief.

## 29. The hideout: a room of your own in Westbay (2026-11-27)

docs/gta-plan.md §4.4 and §6, milestone M3: the "home of your own" that was never built. The learner lives in the town
and comes up on the no. 9 (docs/gta-story.md §1); the last bus home is at 10:15 at night, so a room up here is where a
late job ends. It is where heat cools, where clothes are changed, and where the lines heard wrong are heard again.

**Where.** Behind Gus's hut on Pier Road, between the ferry and College Road (Westbay's stretched map: lot 69–71 ×
86–87, the door's tile 70, 88), beside the old gatehouse where Rico's office is. `data/city/hideout.ts` holds the lot,
the door, the price (`HIDEOUT_COST` 800 xu) and room for upgrades (`HIDEOUT_UPGRADES`, none yet); the thing to click is
`thing:hideout` in `data/cityWorld.ts` RAW_THINGS (before the stretch; `data/city/hideout.test.ts` checks they agree,
that the lot is bare ground nobody uses, and that with its walls up the door and Gus are still reached from the bus).

**Drawn** (`features/town/hideout/hideout3d.ts`, registered by the city's page, nothing in the town's chunk): a one-room
brick lock-up with a flat roof, in two looks the stage builds as Westbay's own "projects" (`engine/extraDecor.ts`
`CITY_EXTRA_DECOR`, `extraDecorSpots`; `three/scene/props3d.ts registerProjects`): **to let** (the window boarded, the
roller shutter down, a red TO LET board over it, weeds, no glass and no light) and **lived in** (a window with curtains
and a flower box, glass that glows at night like every lit window, a lamp over a teal door, the shutter half up, a
brass number, a mat, plants). The city's StageState carries `extraDecor: ['hideout-let' | 'hideout-home']`, so buying it
rebuilds only that piece. Its walls block (`engine/sim.ts PROJECT_HALF`, the size of the drawn walls); the town's own
projects and their tests are untouched.

**Bought** with xu through the town's store (`core/town/economy.ts townItem`: kind 'hideout', like a garage vehicle; the
id `hideout` goes into town-progress `bought`, its cost into what was spent). Its own record is the new synced key
**`town-hideout`** (`core/town/hideout.ts`, IO `hideoutStore.ts`, merger `core/syncMerge mergeHideout`, laws in
`syncMerge.props.test.ts`): when it was first bought (the earlier wins), the last rest (the later), upgrades (each the
earlier time). Owned = the `bought` list OR the record, so either copy alone keeps it bought on every machine. Reset
paths are the generic ones (every synced key). The admin sandbox has 99,999 xu and does not own it, so buying can be
tried there.

**The room** (`three/interiors/recipes/hideout.ts`, 4.4 × 3.6 tiles, walls 1.6): a bed under the little window, a
wardrobe with a suitcase on top, a desk with a tape deck (its counter glows), a teal radio and a lamp, a map of Westbay
pinned on the wall (the bay, the streets, red pins and a string), a rug, a crate for a table, a floor lamp, a plant, a
clock. It is one of the learner's OWN rooms (`interiors/rooms.ts OWN_ROOMS`), not one of the town's fourteen, and is
entered alone: `TownStageHandle.enterOwnRoom('hideout', door, out, ready)` → `engine3d enterOwnRoom` stages it like a
talk inside with no resident (the same dip to dark, `cut`), `RoomStage` builds no host when there is none, the player
and their pet stand in the room; `endTalk` brings them out at the door. Tests: `interiors/hideoutRoom.test.ts`.

**The panel "Chỗ ẩn"** (`features/town/hideout/HideoutPanel.tsx`), opened by clicking the building, E at its door
("Xem căn phòng cho thuê" / "Vào chỗ ẩn"), its quest card or the list mode; one primary action per state:
- **not bought**: what it is for, the price, what is missing, "Mua · 800 xu" (disabled while short). Bought → the dip
  into the room at once.
- **bought** (in the room): the heat line, and three actions, the primary one by state (resting when there is heat to
  cool, else the tape, else the wardrobe):
  - **"Nghe lại băng"**: the review cards `talk:job-…` and `talk:disp-…` that are enrolled and not suspended, the
    newest first (`hideoutTape`, at most 40), each played as Ôn tập plays it (its speaker's browser voice, connected,
    with "Rõ từng từ"; `ListenPair` now takes `voice` / `browserOnly` / `onPlay`), its words and meaning shown only
    after it was played (`hideout/tape.ts`). Nothing is scored: a link opens Ôn tập when some are due.
  - **"Đổi đồ"**: the town's own Tủ đồ panel (`activities/WardrobePanel`, lazy), shown in the sheet; what is worn shows
    on the player in Westbay at once.
  - **"Nằm nghỉ"**: once an hour of the game (two real minutes; the wait counts down on the button): the police's
    `features/town/streets/streetsStore coolDownAt('hideout')` (the search called off, the heat to 0) and the heat store
    set to 0 as well (the list mode has no streets layer). The time is written to `town-hideout`.
- "Ra ngoài" / closing the sheet: out of the room through the dark.

**Quest card** (`hideout/hideoutQuest.ts`): offered with Rico's office (the same gate, `dispatchOpen`: `cs-bigdeal-6`
heard; at once in admin). Not bought: "Căn phòng sau chòi gác cho thuê · 800 xu", walking there; bought: a card only
while there is heat ("Về chỗ ẩn nằm nghỉ"). Its target is the thing, so the minimap and the map's guide point there.

**Not done, not known.** No upgrades (the data has room for them), nothing stored in the room, no sleeping through the
night or missing the last bus on purpose, the partner and children never come here. The room was seen only in pictures
on the software renderer (`.assets-try/previews/hideout-*`); nobody has walked into it by hand, watched the dip, heard a
line of the tape, or tried it on a phone. 800 xu and "an hour of the game" are guesses to tune with real play. The
English strings were written by the same model that wrote the code.

## 28. Westbay's streets: traffic, lights, police and the scanner (2026-11-27)

Milestone M2 of `docs/gta-plan.md` (§4.1 heat and police, §4.8 traffic; "M2 as built" is §14 there). The owner's
"tự auto đi, nhớ làm hết". The point stays the app's: the police radio is the listening, and what is heard is answered
by acting (leave that road, get off, change, wait it out). Westbay only.

**Streets by name** (`core/town/streets.ts`, pure, tested). The twelve two-tile bands of paving of the city's map, with
the names of `docs/city.md` §17: nine for cars (Station Avenue, Market Street, Arts Street, Quay Street, Pier Road; Station
Road, Bay Road, College Road, East Road), three for people (Fountain Lane, the Promenade, the park path). Written in the
map's first layout and moved by its stretch; a test walks every tile of every street on the stretched map. Junctions are
where an east–west band and a north–south band share a 2 × 2 box; nine have lights (two car streets that both run on past
it). The compass reads the map north up (+x east, +y south); Westbay drives on the left (`laneOf`).

**Lights.** `lightAt(net, junction, nowMs)` is a pure function of the real clock, like the sky: a 26-second cycle
(east–west green 10 s, amber 2, all red 1, north–south green 10, amber 2, all red 1), each junction 7 s after the one
before. Nothing stored; the same on every machine. Drawn (`three/scene/traffic.ts`): a post at each corner of the box
(one merged mesh), three bulbs a head (one instanced mesh, lit or dim, written only when a phase changes). The posts stop
a walker (bodies of the sim, `TownSim.extraBodies`).

**Traffic** (`core/town/traffic.ts`, pure, tested; ten cars). Each keeps to its lane, picks a way out at a junction (never
back unless there is nothing else), turns where its new lane crosses, turns round at a dead end, stops before the box on
red (and on amber unless already close), keeps its distance from the car ahead, and stops for anybody in its lane: the
player, the residents, the patrol. The rule that keeps moving things from trapping the player: a car never brings its
middle within `BODY_GAP` (1.1 tiles) of a body ahead, and `blockersFor` never gives the sim a car's circle or the patrol
when the player already stands inside it, so they can always walk off (a ten-minute test round a walker standing in the
road and at three junctions). Drawn as three instanced meshes (one a colour): about five draw calls for the whole layer
with the lights.

**Offences, while riding or driving** (`features/town/streets/streetsWorld.ts`): into a lit junction's box against red
(+3 heat; an amber never counts), touching a car at speed (+2), knocking into a thing of the street at speed (+1: bins,
a postbox, a news box…). The heat is the jobs' (`features/town/jobs/heatStore.ts`, its API unchanged): the same pill.
Without a search it cools by one every 40 s.

**Police** (`core/town/police.ts`, pure, tested). From heat 3 a patrol car (unit seven, twelve, fifteen or twenty) sets
off from a lit junction 16–34 tiles away and drives the streets (`dispatchRoads.ts`) to where the learner was last KNOWN.
It sees them within 8 tiles if they still look as described (`sameLook`: on foot or on what, its colour, the colour of
their top). Seen: the last sighting is now. Within 1.7 tiles for 1.2 s: stopped. Out of sight 25 s: lost, the heat drops
under 3. Getting off or onto something else, or another top, makes them nobody the patrol is looking for.
`coolDownAt(placeId)` (`features/town/streets/streetsStore.ts`) calls a search off and clears the heat: for the hideout.

**The scanner** (`core/town/scanner.ts`, words in `data/city/streets/scannerLines.ts`). Bulletins made from the facts:
"All units, a red light was run on Market Street. Suspect on a pink scooter, heading east. Unit twenty, copy. On my
way."; every 16 s while searching, the last sighting ("Unit seven, last seen on Bay Road, heading north" / "…near the
ferry"); "I have them" on being seen again; "Nobody on a pink scooter round here now" when the look changed. A test
builds bulletins for every look, heading, road or none, and offence, and checks each names exactly the road, heading,
place, vehicle, colour and top it was made from. Voices: Dispatch (a woman), the unit and the officer (men), all the
browser's, never a clip. The pill "Bộ đàm" (`Scanner.tsx`) sits under the heat pill while a search is on or a bulletin is
fresh; a bulletin is said once as it comes; opened, it has "Nghe lại" / "Nghe chậm" (the shared practice keys) and,
folded, the words with their meaning. Generated lines: no review cards, listening time not logged.

**Stopped** (`StopPanel.tsx`): the officer says what was done and asks one of three questions (why I stopped you / whose
is it / where are you off to); the learner answers by intent (keys 1–3). The answer to the question asked: three quarters
of the fine; another: the full fine. 30–120 xu by heat, never more than 40 % of what the learner has (`FINE_SHARE_MAX`, the stop says so when it applies), paid through town-progress
(`fines`, a new per-browser field that only grows and merges by max, so a sync never gives a fine back:
`core/town/progress.ts addFine`, `economy.ts spentTotal`); heat to zero; no game over.

**A job's patrol** (2026-11-27, for Act II): `jobPatrol({ street, from?, to?, seconds, lines? })` and
`sayOnScanner(lines)` (`features/town/streets/jobPolice.ts`; rules `core/town/jobPatrol.ts`, tested) let a job send a
patrol car down one named street (its ends by compass or by a crossing street) while the scanner says the job's own
lines, and learn `{ seen }`: in sight (8 tiles) longer than 0.8 s, never while indoors. It stops and fines nobody; the
heat and the ordinary search wait while it drives. Dev hook `window.__jobPolice`.

**Engine hooks** (a few lines): `engine3d.addExtra` (something driven each frame: `three/scene/stageExtra.ts`), the
stage handle's `addExtra`, `rideLook()` (the vehicle ridden and its colour), `TownSim.extraBodies`.

**Seen / not seen.** Looked at in pictures on the software renderer (`.assets-try/previews/streets-*`: a junction with
cars and lights by day and at dusk, the patrol car coming, the scanner open at 1400 and 375 wide, a stop at 1400 and
375). Measured at the same view with the layer hidden and shown: +9 draw calls (270 → 279 by day, 303 → 312 at dusk;
the layer itself is 5 meshes, the rest their shadows) and about +89 k triangles. Scripted in a headless dev server of
its own (no hot reload), both runs from a red light on Market Street × Bay Road on a borrowed scooter: (1) heat 3, unit
twelve sent, "All units, a red light was run on Market Street. Suspect on a pink scooter, heading east." Off the road
and out of sight: "Unit twelve. I have lost them near Meridian. All units, stand down.", heat 2. (2) staying put: the
patrol pulls up, the stop, the question; the right intent: 45 xu, another: 60 xu; heat 0. On the software renderer the
engine's frames are slow and its step is capped (0.05 s), so 25 s of the game's time took over a minute of real time.
The script moves the player by `placePlayer` steps, not by keys; once it brushed a car and knocked over a news box on
the way, and both offences were counted and said truly ("a newspaper box was knocked over near the paper kiosk"). Nobody has heard a bulletin, driven through a junction with real
keys, watched the traffic move, or tried it on a phone or a real GPU. The numbers (ten cars, the cycle, the heat, the
sight, the fines) are guesses.

## 30. The dispatch office grows: upgrades and the manager's word (2026-11-27)

`docs/gta-plan.md` §4.4 and §6: a sink that does not run out quickly, and the firm's takings coming in through a spoken
line ("quản lý gọi báo việc bằng lời, nghe sót thì lỗ"). Rules `core/town/office.ts` (pure, `office.test.ts`), IO
`core/town/officeStore.ts`, the panel `features/town/dispatch/OfficeExtras.tsx` under "Bắt đầu ca".

**Upgrades** (bought with xu, once each, 500 / 1,200 / 2,500):
- **Bản đồ có tên phố** (500): in a district's view the wall map shows the streets' names (`DispatchMap streetNames`,
  from `core/town/streets.ts westbayNet`). Labels can still sit under a place's or a car's label here and there.
- **Xe thứ tư** (1,200): Jas drives a fourth car (`DriverId` 'jas', starting by the Lumen; her radio lines in
  `data/city/dispatch/lines.ts`, a browser voice; docs/city.md §15).
- **Đường dây thứ hai** (2,500): ten calls a shift, closer together (`TWO_LINE_TIMES`), so more pay and harder listening;
  a call ringing while the other line is busy is held and Bayline does not take it (`Shift.lines`, `tick`).
- **Where they are kept**: as store items of the town, like the hideout: the id in town-progress `bought` (its merger
  already keeps every id ever bought), the cost counted by `economy.spentTotal` (`townItem` kind 'office'). No new
  stored or synced key. (The hideout's own `upgrades` map in `town-hideout` is left for the hideout's upgrades.)

**The manager's word**: once a game day (at most two a real day, `WORDS_PAID_A_DAY`), Tess leaves one spoken line with
a sum of pounds in it, said in words (`numberWords`; 130 … 390, tens of thirty and up so it has a "-teen" look-alike:
"a hundred and forty" / "a hundred and fourteen"; `data/city/dispatch/managerWords.ts`, four lines: takings, tyres,
fuel). Two plays at most, then the learner picks the sum (three options: the sum, its "-teen" look-alike, another
hundred). Right keeps the day's takings (`officeTakings`: 5 xu, +3 / +4 / +5 with each upgrade), wrong loses half
(`WORD_LOSS`, rounded). Paid as `dp-word-<game day>` in the daily set `heard`. The browser's voice (Tess is Westbay's).

Seen in pictures (`.assets-try/previews/econ-office-1400.png`, `econ-office-375.png` after an answer and a purchase,
`econ-office-375-en.png`, `econ-map-streets-1400.png`): no horizontal scroll at 375. Nobody has heard Tess's word, played
a ten-call shift by hand, or watched Jas's car; the prices and takings are guesses.

## 31. Kinh tế: the economy on one page (2026-11-27)

`core/town/economyModel.ts` lists every source and sink of xu with its REAL constant imported from where it lives, and
simulates three learners over 60 days (10, 20 and 40 minutes a day, understanding 70 %, 80 % and 85 %, each with a
stated mix of what they like; their minutes shared out by the mix, a source at its daily cap or out of content gives
its share back). They buy in order: the town's lots, its decorations, then (once the city's story has opened it) the
hideout, the office's upgrades, vehicles; a fine every five days once they drive in Westbay. **Every number in the
model (minutes a thing takes, the share understood, when the city and the office open) is a guess until real play.**
`economyModel.test.ts` pins the properties, not the numbers.

**What was changed** (as few constants as possible; nothing in the town's own loop was touched):

| Constant | Before | After | Why |
|---|---|---|---|
| `job.ts JOB_PAY` (clean / messy / broken) | 30 / 15 / 5 | 64 / 32 / 10 | a job now pays more than the same 12 minutes of quick chats (clean > fresh lines, messy > known lines) |
| `job.ts JOB_LEVEL_FACTOR` (level 1 / 2 / 3) | none | 1 / 1.2 / 1.45 | a harder job pays more (level 2 clean 77, level 3 clean 93) |
| `job.ts JOBS_PAID_A_DAY` | none (each job once a day: up to 14) | 2 | replaying every job daily is not a living |
| `police.ts fineFor` | at most the whole balance | at most 40 % of it (`FINE_SHARE_MAX`) | a fine hurts, it never empties |
| office upgrades, Tess's takings | none | 500 / 1,200 / 2,500; 5 xu (+3 / +4 / +5), twice a day at most | a sink that does not run out quickly; a steady source that needs a number heard |

The calls of the call-in show and the adverts are paid inside the radio's existing three a day; nothing else changed.
No price of anything that can already be bought went up (a price raised would lower what a learner holds: the test
pins every price of 2026-11-27 as a ceiling).

**The model, before and after** (the day each thing is bought):

| Learner | Lots done | Decorations done | Hideout | Office upgrades (after only) |
|---|---|---|---|---|
| 10 min, 70 % | day 16 → 15 | 22 → 21 | 43 → 40 | map day 51; nothing else in 60 days |
| 20 min, 80 % | 9 → 9 | 12 → 12 | 25 → 23 | map 30, fourth car 45, second line after day 60 |
| 40 min, 85 % | 5 → 5 | 7 → 6 | 17 → 17 | map 17, fourth car 24, second line 40 |

The 20-minute learner earns about 79 → 83 xu a day in the first two weeks, 77 → 86 in the next two, 77 → 94 after a
month; the busiest source of their day is the daily tasks, 30 % → 28 %, then 25 % (Tess's takings about 15 % once the
office has its upgrades). The hideout (800) comes 11 days after the town's lots and decorations, about 9 days of their
city-time income. A clean job pays 5.3 xu a minute against 5.1 for quick chats with fresh lines and 2.4 with lines
already known.

**Pinned by the tests**: the lots take 7–11 days at 20 minutes (12–19 at 10, 4–7 at 40); the hideout is 7–16 days
after the town's needs and 7–14 days of the city's income; the office's upgrades are not all bought in 60 days at 20
minutes; no source is above 40 % of the 20-minute learner's day in any stretch; a job beats quick chats by grade and
level; every source pays more to a learner who understands more; a misheard number loses part of the takings, never
all; a fine is at most 40 % of the balance and never empties it; no price went up.

**Not known.** Nobody has played the economy over days. The minutes per activity, the share understood, the mixes and
when the story opens the city and the office are guesses; the farm is modelled as twenty due cards a day, the fine
every five days at heat 4. Change a constant, run the tests, and read the model again before believing a number here.


## 32. The harbour's warehouses, number fifteen's room, a boat that moves (2026-11-27)

For Act II (docs/gta-story-2.md §3; jobs 4a "Ca đêm", 4b "Cửa nước", 10 "Kho 15"; its §7 items 5 and 9).

**The row** (`data/city/warehouses.ts`): brick warehouses along the east shore of the bay, their backs to the water,
their fronts on a quay lane (x 51, kept open of the filler blocks: `cityWorld.ts fillers(…, quayLane())`). Twelve, 4 × 2
tiles each: **11–14** south of Quay Street (from Pier Road up), **15–22** north of it (from Quay Street up to the far end
of the quay). The harbour's sheds go up to twenty-two (`cs-bigdeal-4`); one to ten are older sheds further along, not
drawn. They are scenery of their own kind `'warehouse'` (`v` = the number): solid by `core/town/colliders.ts`
(`WAREHOUSE_INSET`), drawn by `features/town/city/warehouses3d.ts` through `three/scene/props3d.ts registerScenery` (the
maker gets every warehouse at once: one model per run of the row; measured at the quay on the software renderer, in
one page, the twelve cost 9 draw calls and 89 k triangles with the shadow pass: 123 calls / 0.85 M with them, 114 / 0.76 M
with them hidden), imported by
`cityPlaces3d.ts`, so nothing of them is in the town's chunk. Each has its number painted large in white on its roof,
turned to read from the usual camera, and on a black board over its doors; a big sliding door and a side door with a
lamp over it (the "side door / slide door" of job 4a); high windows that glow at night like every lit window. A palm,
an umbrella and four trees that stood on that shore were taken away.

**Fifteen** (Bayline's, rented from the Harbour Board): a **black side door** on the quay lane (`W15_DOORS.front`, tile
51, 77), a **back door** on Quay Street (`back`, 48, 78) and a **water gate** on the bay (`water`, the slipway's top on
the sand, 46, 77) with a stone slipway down to the water and two mooring posts. It is the first warehouse north of Quay
Street, so it is found by its number from the corner.

**"Warehouse fifty"**: there is none. The false call of job 10 sends whoever believes it to the far north end of the quay
(`ROW_FAR_END`, in front of twenty-two), where the row stops and the beach begins; Gus's "There is no fifty. There never
was." is said there. Nothing is drawn for fifty: the row's last number, 22, is the answer the eye can check.

**The room** (`three/interiors/recipes/warehouse.ts`, 6 × 4.6 tiles, walls 2.3): steel shelves of tape boxes without
labels along the back wall, a staircase up the left wall to an office door, crates marked **M** under the stairs ("the
one under the stairs") and **N** stacked in the open, the back door on the back wall, the water gate on the left wall
(the bay side) with chains and a strip of water under it, one hanging bulb. Anchors for a job's people: the host by the
shelves, the learner in the middle, a visitor by the crates, two more at the water gate and the back door (`extras`).
It is one of the rooms that are not a place of the town (`interiors/rooms.ts OWN_ROOMS`); RoomStage now takes `more`
(people by id at the extras' anchors, in place of passers-by) and `TownStageHandle.enterOwnRoom` a `cast` (host,
visitor, more). Tests: `interiors/warehouseRoom.test.ts`.

**For the job engine** (`features/town/city/warehouse.ts`, nothing in the job engine changed):
- `enterWarehouse(stage, { door?: 'front' | 'back' | 'water'; host?; visitor?; more? }, ready): boolean`: into fifteen by
  that door through the dark, with the job's people; `ready` once inside; `stage.endTalk()` brings the learner out at the
  same door. False = no 3D stage or another talk staged.
- `runBoat(stage, { from?, to?, aboard?, speed?, landing? }): { arrived: Promise<void>; stop: () => void } | null`: a small
  launch (one mesh, the shared material) runs over the bay from `from` (default the seafront jetty's end) to `to`
  (default fifteen's water gate), the learner standing in it when `aboard` (the camera follows them) and set down on the
  shore at the end (the slipway's top at fifteen); `arrived` resolves on arrival (at once under reduced motion); the boat
  stays moored until `stop()`. Drawn through the stage's `addExtra` (no engine change). Its way is `boatRoute` (pure):
  A* over OPEN water tiles (water all round), smoothed into straight legs that stay over open water; tests sample the
  whole way and check every point is on a water tile inside the drawn waterline (`shoreDistance` < 0) and keeps clear of
  the boats moored on the bay.

**Not done, not known.** The water gate cannot be seen from the usual camera (it faces the bay, away from it): only
with the camera turned or from the boat. No warehouse but fifteen opens; none has a name or a tenant; the night guard,
the patrol and the "lamp over the side door" are the jobs' to stage. The boat does not rock with the waves beyond a
small bob, has no wake, and nobody steers it. Seen only in pictures on the software renderer
(`.assets-try/previews/wh-*`); nobody has watched the boat move or walked the quay by hand.
