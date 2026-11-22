# AGENTS.md: context for coding agents

Read this first. It is the handoff for any agent (Claude Code, Codex, Cursor…) continuing work on this repo.

## 1. What this is

**Nghe Nối Âm** is a browser-only app (no backend) that helps a Vietnamese adult **hear connected English speech**: linking, elision, weak forms, flap T, reductions (gonna/wanna), h-dropping, contractions. It also teaches spelling→sound rules, irregular words and loanwords, and tracks real listening hours and progress.

- **All UI text is Vietnamese**: natural, concise, no English UI words except the English being taught.
- It runs two ways:
  - **dev**: `npm run dev` → http://localhost:5173;
  - **portable**: `npm run portable` builds ONE self-contained HTML file. The user keeps it in OneDrive and opens it from disk (`file://`, origin `null`).
- Learner data lives in `localStorage`. It can be synced between machines through a user-chosen folder (OneDrive, Google Drive, Dropbox…) via the File System Access API, and (optional, 2026-11-22) through a Google sign-in on the Supabase project shared with daily-english (`docs/supabase-sync.md`).

## 2. The user (owner)

- Vietnamese, weak at hearing native connected speech. Writes casually in Vietnamese ("tao/mày"); **reply in Vietnamese, same casual tone**, short and direct.
- Wants honest answers. No overclaiming: the app is a decoding tool, and real progress needs many hours of real listening. The report and AI coach must never promise "native-like" listening.
- **Hates clutter** ("nhìn rối như bùi nhùi") and dated-looking UI. Wants modern, calm, one job per screen. Real decluttering, not reskins.
- Wants spaced repetition everywhere learning happens ("học xong không ôn lại cũng như không").
- **Do not commit or push without asking.** Commit trailer if asked: `Co-Authored-By: <model> <noreply@anthropic.com>`.
- Never write API keys into code, tests, docs, fixtures, screenshots or the portable build. The user's Gemini key goes only into Settings → Trợ lý AI on each machine.

## 3. Stack and commands

- React 19 + TypeScript 7 + Vite 8, Vitest 5 (node env, `src/**/*.test.ts`), oxlint. Font Be Vietnam Pro (bundled), icons `lucide-react`, `three` (the 3D town only, in its own chunk). No other runtime deps.
- `npm ci`, then:
  - `npm run dev`: dev server;
  - `npx tsc -b`: type-check;
  - `npx oxlint`: lint;
  - `npx vitest run`: tests (~2600 tests, should be all green);
  - `npm run build`: build. The web build splits React (`react-*.js`, ~219 kB) and the built-in content the entry needs (`content-*.js`, ~293 kB: courses, lessons, sentences, chunks, real clips; `stories-*.js`, ~266 kB: the town's episodes, the residents' arcs, the gifts) from the app code (`index-*.js`, ~254 kB) via `codeSplitting.groups` in `vite.config.ts`, so a deploy that only changes app code leaves the other hashed files unchanged. three.js is a third group (`three-*.js`, ~580 kB, 146 kB gzipped), loaded only by the town page; the web build's size limit sits just above it and `chunkSizeGuard` keeps the usual 500 kB warning for every other chunk. No size warning. The portable build is still one bundle;
  - `npm run portable -- --out "<folder>"`: single-file build (default output `portable/Nghe-Noi-Am.html`, about 3.0 MB with three.js inlined). One folder goes next to it and must travel with it: `audio/` (shipped clips). The town needs no folder any more; an `art/` folder an earlier build left there is cleared (only the pictures that build copied, by its ledger).
- Before handing work back: tsc, oxlint and vitest all green, and build OK.

## 4. Repo map

```
src/
  App.tsx, main.tsx, index.css (tokens + shared classes), App.layout.css, fonts.css
  components/   shell + shared UI: AppNav, PageHeader, Popover, Segmented, FilterButton, PhTag, PlayButton,
                ListenPair (+ RealVoiceLink), SpokenSentence, Icon, ShortcutsHelp, SyncBanner, VoiceNotice, ListeningTimerPill, lazyPage
  core/         pure logic + stores (tested)
    types.ts        shared contracts (Phenomenon, Sentence, DecodeResult…)
    storage.ts      localStorage wrapper, KEYS, DEVICE_LOCAL_KEYS (never synced/backed up)
    settings.ts     Settings (voice, rate, theme, dailyGoal, reviewMinutes, listenGoal, voiceEngine)
    nav.ts          hash router (#/route?params), ROUTES (nav:false = hidden route)
    decoder/        connected-speech decoder: decode(text) → tokens/annotations/segments/spokenText
    dictation/      normalize/align/diff/classify for typed answers
    review/         spaced repetition (tuned SM-2) for Ôn tập, docs/review-system.md
    stats.ts        practice attempts (capped at 1000) + per-phenomenon counters
    history.ts      daily aggregate archive (per-device buckets, merge by max), so the report survives the cap
    listening.ts    real-listening log, stopwatch (device-local), media auto-log
    benchmark.ts    periodic checkup scoring, results, form rotation
    progressReport.ts  pure report model + rule-based Vietnamese "Nhận xét"
    goals.ts        Home daily plan
    lessons.ts      course/lesson progress
    town/           "Thị trấn" rules: xu, daily tasks, level, synced progress `town-progress`, store, walking map (content `data/town.ts`, layout `data/townWorld.ts`, game `features/town/`, docs/town.md)
    syncMerge.ts    per-key mergers for folder sync and account sync (every synced key needs one + tests)
    folderSync*.ts, backup.ts   folder sync + JSON backup/restore, clearAll ("Xóa dữ liệu")
    syncLock.ts     one queue for every sync channel (a folder cycle and a cloud cycle never interleave)
    cloud/          account sync, Google sign-in on Supabase (docs/supabase-sync.md): config (build env), auth (PKCE, no supabase-js), remote (REST + CAS write), cloudSync (pure cycle, tested), cloudController (browser glue)
    tts.ts, audioPlayer.ts      all playback: shipped Gemini clip → AI voice (only voiceEngine 'ai') → browser voice
    audioKey.ts, audioManifest.ts, audioInventory.ts   shipped clips: key per (mode, text), manifest loader, list of every built-in playback (docs/audio.md)
    playback.ts     playback modes: connected (say ?? speakText ?? text) vs careful (written text, slower), AI styles, YouGlish
    ai/             provider-agnostic AI layer (see §7)
    aiTasks.ts      AI prompts/schemas/validators: explain mistakes, generate sentences, coach
  data/         content: sentences.ts, chunks.ts, pairs.ts, lessons.ts (connected-speech course),
                courses/{spelling,irregular,loanwords}.ts, lessonTypes.ts, benchmark.ts (+ benchmarkTypes.ts)
  features/     one folder per page: home, review, lessons, decoder, dictation, pairs, drill, shadowing,
                media, stats (Tiến độ + Báo cáo), listening, checkup, settings, ai (shared AI UI), town
    town/         "Thị trấn": TownPage + panels; engine/ (sim, life, page↔stage contract, 2D overlay), three/ (the
                  3D stage: scene/, chars/, offscreen pictures), activities/ (the game loops); TownStage3D with flat=true is the no-3D list
docs/           design-system.md, declutter-plan.md, review-system.md, courses.md, progress-report.md, ai-providers.md
scripts/build-portable.mjs   inlines the Vite "portable" build into one HTML (+ copies public/audio to <out>/audio)
scripts/generate-audio.mjs, audio-inventory.mjs   one-off Gemini clip generation (docs/audio.md; key only from GEMINI_API_KEY)
public/         icons, manifest, sw.js (service worker, never caches cross-origin)
```

## 5. Features (routes)

| Route | Nav label | What |
|---|---|---|
| `#/` home | Hôm nay | daily plan, one primary action, listening row, checkup suggestion (under "Xem thêm") |
| `#/review` | Ôn tập | SRS session: dictation/pairs/chunks/lessons/media/**word cards** (per-word cards for irregular + loanwords, 6 new words/day) |
| `#/lessons` | Bài học | course list → `?course=connected|spelling|irregular|loanwords` → `?id=<lessonId>`. Blocks: text, words (marks `[..]` highlighted letters, `(..)` silent letters, `why` stories), story, quiz types incl. choose / silent-letter |
| `#/decoder` | Giải mã câu | shows how a sentence is actually spoken; "Nghe" plays it that way (connected), "Rõ từng từ" the written text slowly, "Nghe người thật nói" opens YouGlish |
| `#/dictation` | Chép chính tả | listen and type; rule-based "Vì sao bạn nghe sai?" + "Hỏi AI"; "Câu của tôi" with "Tạo bằng AI"; counts the plays before each check: "Nghe 1 lần là đúng" in the result, the round summary and Báo cáo (`core/dictation/listens.ts`, docs/progress-report.md §4) |
| `#/pairs`, `#/drill`, `#/shadowing`, `#/media` | Phân biệt âm, Cụm từ, Nói nhại, Video thật | minimal pairs, chunk flashcards, shadowing, YouTube/local media with transcripts (auto-logs listening time; its dictation measures "nghe 1 lần là đúng" on real speech for lines met for the first time: `features/media/lineListens.ts`, kept apart from the app-voice number) |
| `#/town` | Thị trấn | a town of 44 × 44 tiles in real-time 3D (three.js, everything built in code: `features/town/three/`; day / night with the theme) the learner walks around and builds: a resident SAYS a built-in dictation sentence (audio only, the same clip as Chép chính tả), the learner picks 1 of 3 Vietnamese meanings; 5 lines a conversation; understanding pays xu (3 / 2 / 1, +5 for 5 of 5, three daily tasks), xu build the ten empty lots (only the next three show as construction sites, the rest is nature) and buy decorations; toon-shaded 3D people and pets with blended animation, a day and a night light rig, 3D portraits and thumbnails from one offscreen renderer; without WebGL 2 on a real graphics card the page shows a calm note and the residents as a list (conversations, episodes, building and the games still work: `TownStage3D` with `flat`); "Toàn màn hình" puts the stage over the whole window; level titles, hearts, lit windows; soft Web Audio effects (device-local `town-ui`); a miss enrols the sentence's `dict` card; **"Chuyện ở thị trấn"**: 26 everyday-dialogue episodes (2 per place, `data/townStories.ts`), each resident with their own Gemini voice (`core/town/voices.ts`, `storyAudio.ts`): hear the whole exchange once + gist question, then line by line (meaning, decoded line, `talk:<lineId>` review card on a miss), then the whole exchange again; finished episodes come back for a re-listen after 1/3/7/21 days; the old 5 sentences remain as "Trò chuyện nhanh" (docs/town.md §9); **every talk happens where it fits** (owner, 2026-11-21: "quán cà phê gì ở ngoài đường?"): an episode's / quick chat's setting (`episodeSetting` / `quickChatSetting`, `data/townStories.ts`) is staged by the stage (`engine/staging.ts`, `talkAt` / `endTalk`): 'inside' = the player walks to the room's door, a 0.35 s dip to dark into that place's room (14 rooms, `three/interiors/`, `three/scene/roomStage.ts`: resident at the host anchor, the player with hat/outfit/pet, a neighbour who drops in, 2–3 extras) and back out to the door; 'outside' = both walk to the place's front and the camera frames them with the building behind (docs/town.md §7 "Staging"); all 13 residents live in town from day 1 (unbuilt ones lodge at the "nhà trọ" and can talk; episode 2 of a place needs its house), daily life by the real clock (sit, chat in pairs, café, watering, fishing, passers-by); **"Vòng chơi"** (docs/town.md §10, `core/town/gameStore.ts`, panels in `features/town/activities/`): Câu cá (hear a spoken chunk / pair / sentence, pick it in time, 24 species by phenomenon, album), Nông trại (due review cards are crops; reviewing = harvest; Ôn tập links back with `?activity=farm`), Tiệm trứng (eggs earned by listening milestones or 40 xu; pets, hats, outfit colours, titles; pity every 10), Tủ đồ, Sưu tầm (34 achievements, 5 town projects that add decorations), 3 rotating daily tasks; **"Thân thiết"** (docs/town.md §12, `core/town/friendship.ts`, `features/town/friends/`): friendship points per resident (0–1000, 10 hearts, a game score) from listening (episode finish +60, gist first +30, right re-listen +10, quick chat ≥3/5 +15 once a day, first talk of the day +5, choices, gifts ±), episodes 3+ from each resident's arc (`data/stories/*`, merged into `TOWN_STORIES`; they wait for `requires.hearts` / facts: "Cần 2 tim"), choices by Vietnamese intent in episodes (the first pick counts, later lines use `variants` by known facts), facts (never forgotten), Tiệm quà (activity `gifts`) + "Tặng quà" (one a day per resident, voiced reaction), voiced greetings when you stop by someone (device-local setting, memory callbacks rotate out), Sổ tay (activity `journal`); town progress v5; `?talk=<placeId>` opens a conversation, `?build=<placeId>` the build panel, `?activity=<id>` an activity (docs/town.md) |
| `#/stats` | Tiến độ | overview; `?view=report` = Báo cáo tiến bộ (4 tuần / 3 tháng / Tất cả, charts, checkup trend, "Nhận xét", AI coach) |
| `#/listening` | Nhật ký nghe | log real listening (quick add / stopwatch), milestones (10…1000 h), listenGoal |
| `#/checkup` | (hidden) | Kiểm tra định kỳ: 10 dictation sentences + 4 passages, 6 parallel forms A–F, every 14 days; score = 0.6 × dictation% + 0.4 × comprehension%; audio = connected version, results record `audioMode: 'connected'` (older results = 'standard', compared with a caveat) |
| `#/settings` | Cài đặt | voice/theme/goals, Trợ lý AI, Tài khoản (Google sign-in, only in builds with `VITE_SUPABASE_*`), data & folder sync, backup, clear |

## 6. Rules you must follow

- **Design** (`docs/design-system.md` — read it fully before any UI work; reasoning in `docs/declutter-plan.md`):
  - exactly one `.btn-primary` per screen;
  - 13px minimum text;
  - no hex colours in feature CSS (use tokens);
  - prefix feature classes (`dict-`, `rep-`, `lst-`…);
  - explainers go in a closed `<details className="how">`;
  - no zeros/metrics before there is data;
  - check 375px width with no horizontal scroll, in light + dark.
- **Playback** (`src/core/playback.ts`, docs/design-system.md → Playback pattern): anything shown decoded must SOUND decoded. The main "Nghe" sends the CONNECTED text (content `say` ?? `DecodeResult.speakText` ?? text) with `mode: 'connected'`; the careful button (label `CAREFUL_LABEL` "Rõ từng từ" everywhere) sends the standard written text at `CAREFUL_RATE` with `mode: 'careful'`. Use `ListenPair` for decoded sentences. Where careful playback would give the answer away (dictation, lesson listen quizzes, drill choose cards) the slow button stays connected (`slow: true`, titled "Nghe chậm (vẫn nối âm)") and the careful version appears only after checking. Slow rates are relative (`slowRate`: never above 0.8 × the learner's rate). Never send the plain written text as the "natural" playback of an annotated sentence. Courses spelling / irregular / loanwords play sentences as written (`ListenPair asWritten`). Speakable spellings must be SAPI-safe: the measured misreads are listed in `src/core/decoder/sapiMisread.ts` and tested (no ta / ya / 'n / 'er / 'em / jus …).
- **Respelling convention:** hyphen + CAPS for stress (`KER-nəl`, `in-KREES`), matching the decoder tables in `src/core/decoder/tables.ts`. No monospace respellings.
- **Data:**
  - every new synced storage key needs a merger in `syncMerge.ts` with tests (idempotent, commutative; `syncMerge.props.test.ts` checks the laws);
  - a value replaced as a whole carries its own change time (`settings.changedAt`, custom sentence `updatedAt`, media `prefs.changedAt`): the merge never decides by "which machine wrote anything last";
  - deleting a synced record leaves a tombstone (`recordTombstone`, `core/syncMarkers.ts`; listening log has its own); "Xóa dữ liệu" (`clearAllData`), restore (`restoreBackup`) and "Xóa lịch sử" (`recordKeyReset`) leave a reset marker so other machines drop their older data instead of merging it back;
  - device-only state goes in `DEVICE_LOCAL_KEYS` (e.g. `voice-ai`: the paid AI voice is chosen per browser, never synced or imported);
  - AI config/usage uses its own prefix `nghe-noi-am-device:`, so it is never synced or backed up. The account session, the account-sync base and the pending sign-in use it too (`nghe-noi-am-device:cloud-*`).
  - Account sync (`src/core/cloud/`, docs/supabase-sync.md) carries exactly what folder sync carries and merges through the same `mergeData`; a new synced key therefore works in both channels once it has its merger. Its short key must match `^[a-z0-9][a-z0-9-]{0,63}$` (the table's CHECK).
  - Supabase URL + publishable key come only from the build env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`: `.env.local`, repository secrets `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` in the deploy workflow), never from the repo. Never a secret / service_role key (refused by `parseCloudConfig`).
  - `loadJSON(key, fallback)` returns the fallback when the stored JSON shape differs from a non-null fallback (a stored `null` for an object key once white-screened every load). Boot steps in `main.tsx` run one by one inside try/catch, and `RootBoundary` wraps the whole app with a rescue card (reload / save a copy / clear).
- **AI keys:** `baseUrlAllowed` (`src/core/ai/defaults.ts`) is the only gate for base URLs. Cloud kinds accept their official https origin or loopback only; `openai-compatible` accepts https, or http on loopback/LAN. It runs in sanitize (stored configs are repaired) and in `effectiveBaseUrl` at request time. `AiConfig.keyStore: 'session'` keeps keys in sessionStorage only. Reason: every `file://` page shares one origin in Chromium, and so does every project on `hnp180493.github.io`.
- **Play buttons:** never let a ▶ speak a lone weak-form function word as written while a reduced form is shown (`contradictsShown` / `segmentPlayback` / `annotationPlayback` in `src/core/playback.ts`); such buttons are hidden.
- **Content:** course authoring contract is in `docs/courses.md`. Content tests validate shape, the decoder agreeing with `focus` labels, and that checkup items don't overlap practice content.
- **Honesty** (`docs/progress-report.md` §6): hedge small samples, never claim native-level, label self-ratings as "tự đánh giá".
- **AI is an add-on:** with no provider configured, everything must behave exactly as without AI. AI calls only on user click; nothing loops or auto-bills.

## 7. AI layer (`src/core/ai/`, docs/ai-providers.md)

- **Providers:** `gemini` (first-class), `openai`, `anthropic`, `openrouter`, `openai-compatible` (custom base URL, e.g. Ollama/LM Studio). To add a provider, write one adapter in `providers/`, add one line in `registry.ts`, and add its defaults in `defaults.ts`.
- **Gemini only in the UI (owner's decision, 2026-11-07):** after trying OpenAI and Claude, the owner said to use Gemini only. Settings → Trợ lý AI offers just "Thêm Gemini" (`SHOW_OTHER_PROVIDERS = false` in `src/features/settings/AiSection.tsx`). The other adapters stay in code for later. Gemini is also the preferred voice: a newly added Gemini provider becomes the TTS default. Do not re-add other providers to the UI unless asked.
- **Public API** (`src/core/ai/index.ts`): `aiText`, `aiJson` (schema-validated, one repair round), `aiSpeak` (TTS, IndexedDB LRU cache 50 MB, in-memory fallback), `testProvider`, `listProviderModels`, `aiStatus`, plus hooks.
- **Errors:** every failure is an `AiError` with a Vietnamese message, and keys are redacted.
- **Default models (checked 2026-11-06):** Gemini text `gemini-3.6-flash`, Gemini TTS `gemini-3.8-flash-tts` voice Kore. Defaults age; they live only in `defaults.ts`. OpenAI TTS models retire on 2027-01-06.
- **Verified live with a real Gemini key:** connection, model list, text, JSON, TTS (WAV 24 kHz), and the explain/generate/coach prompts.
- **Shipped Gemini clips (owner's request, 2026-11-07):** every built-in playback is generated once with Gemini Kore (`npm run audio:generate`, docs/audio.md) into `public/audio/` and played from there by default: no key, no cost. Key = `audioKey(mode, text)` (`connected` / `careful`, `plain` for a playback without a mode).
  - **Generated 2026-11-07:** all 5,526 clips (41.9 MB MP3, 40 kbps) via the Gemini Batch API, 0 failures, `AUDIO_STYLE_VERSION` 3. Pace: a native speaker's normal conversational speed. The owner rejected both "fast" and "unhurried"; learners slow it down with Settings → Tốc độ đọc. Changing `CONNECTED_STYLE`/`CAREFUL_STYLE` or any built-in text means re-running `node scripts/generate-audio.mjs` (only missing clips are made) and bumping `AUDIO_STYLE_VERSION` if a style changes.
  - The portable build copies them to `<out>/audio/`. The owner's folder is `OneDrive - utop.vn/Pictures/NgheNoiAm`. Keep `audio/` next to the HTML.
- **Voice engine:** `Settings.voiceEngine` = `'clips' | 'ai' | 'browser'`. `'clips'` ("Giọng Gemini có sẵn", the default and the migration target of the old stored default) plays shipped clips and, for any text without one, the browser voice: it never makes a paid request, even with a key set for AI tasks. `'ai'` (explicit choice only, per browser: stored in the device-local `voice-ai` key, never in the synced settings; an imported or synced 'ai' becomes 'clips'; "+ Gemini qua key (tốn phí)") plays shipped clips too and routes texts without a clip through `aiSpeak` with the style of the playback mode (`speak(text, { mode })`: `CONNECTED_STYLE` / `CAREFUL_STYLE` / default; the TTS cache key includes text + style), falling back to the browser voice on errors. `'browser'` is always the browser voice. A circuit breaker plus `VoiceNotice` handle repeated AI failures: settings errors until the settings change, a provider quota until the next local day (1–6 h), network/5xx/429 for a cooldown, and 'bad-response' / 'safety' / 'bad-request' per text (3 in a row pause the whole AI voice 10 min). `browserOnly` playback (dictation "Từng cụm") still plays shipped clips; it only keeps the paid AI voice out.
- **A shipped text is never paid for:** when its clip file does not load (skipped for 2 min; 2 failures in a row skip all clips for 2 min), or the manifest is unknown (a slow load: the first playback waits `MANIFEST_WAIT_MS` 4 s; a failed load: retried after 30 s), playback uses the browser voice, not the AI voice, and `CLIPS_NOTICE` says so once. The manifest is preloaded at app start (`main.tsx`). The service worker answers the manifest from its cache when the network stalls for 3 s, keeps clips LRU (400), and names the clip cache after the manifest's `generatedAt`.
- **AI calls only after a click:** `prefetchSpeech` arms clips that are made only when the learner next plays something (`after: text` = only when that text is played: dictation arms the NEXT sentence after the current one); `speak(…, { auto: true })` (dictation auto-play) never makes a new paid request, it reuses a clip made this session or uses the browser voice.

- **Free tier is the norm:** a free Gemini key allows a few TTS requests per minute and ~30 a day. `prefetchSpeech(texts, { mode, ahead, after })` arms only the first text by default (`PREFETCH_AHEAD_DEFAULT = 0`), never careful clips, and nothing is made before a click; a 429 pauses the AI voice quietly (breaker) and the browser voice plays.

## 8. Testing approach

- Unit tests sit next to the code. They cover DST, sync merges and simulations (60-day SRS load).
- **E2E/screenshots:** earlier sessions used headless Edge over CDP with a throwaway profile, plus a local mock Gemini server for AI flows (fake key, base URL override allowed only for localhost/127.0.0.1). Those scripts lived in a temp folder and are **not** in the repo. Recreate them if needed, and take views at 1600×900 dark and 375×812 dark plus one light.

## 9. State and known open issues (as of 2026-11-07)

- **Git / deploy:** repo `hnp180493/english-listening`, branch `main`. A push to `main` deploys GitHub Pages (`.github/workflows/deploy.yml`: npm test, then build with `--base=/<repo>/`) to https://hnp180493.github.io/english-listening/. The shipped clips (`public/audio`, ~57 MB) are committed, so every regeneration grows the repo. Ask the user before committing or pushing.
- **Checkup:**
  - `voiceName` records every voice that actually spoke, in order (`checkupModel.noteVoice`, from `SpeakOptions.onVoice`; e.g. `Gemini · Kore (có sẵn) + Microsoft Ava` after a fallback), so a mixed test never compares as same-voice;
  - the result screen shows percentages from small per-phenomenon samples.
  - a draft started before the connected-audio change and finished after it is recorded as 'connected' (mixed audio; drafts expire after 24 h).
- **Playback not yet switched to connected text:** the AI generator preview and the dictation "Câu của tôi" list still send the written text (they show no annotations next to the button). Home, Shadowing and Drill play the connected version.
- **Speakable text is verified only against Windows SAPI (Microsoft David)** by captured phonemes (2026-11-07). Neural voices (Edge Natural, Gemini TTS) were not re-measured after the SAPI-safe changes (yuh, an, glued teller/tellem, would juh, wadder). The familiar -ja/-cha forms (didja, meetcha, toldja) are kept although SAPI ends them with /ɑ/ instead of /ə/.
- **Dictation sentences:** the 300 sentences rely on the generated text (no authored `say`); where the decoder has no safe spelling (cross-word flap after "it" like "turn it off", assimilation like "in Boston"), "Nghe" still sends the written words.
- **Home:** the baseline-checkup suggestion is folded under "Xem thêm" for new learners (deliberate, could be revisited).
- **Stats:** "Hôm nay" can read 1 higher than the nav badge right after a session (it counts cards due later today).
- **Thị trấn** (rebuilt 2026-11-14 after the owner rejected the first version; moved to real-time 3D on 2026-11-21 after the owner found the sprite town "cheap"; docs/town.md §7–8):
  - **3D (2026-11-21) was looked at only as screenshots and numbers from headless Edge on the owner's laptop GPU** (ANGLE / D3D11, RTX 3060 Laptop; 1600×900 and 390×844, day and night, a fresh and a seeded rich town: walking, a quick chat, an episode, every activity panel, the build panel, the wardrobe preview, an egg reveal, the overview, the page without 3D): 60 fps, 64–130 draw calls, 0.43–0.57 M triangles, the engine's own work 3.3–5.7 ms a frame, no console errors. Nobody has watched it move, played it on a phone or a weak laptop, or judged the people's animation, the camera's moves, the build animation or the sound effects. The adaptive quality steps (pixel ratio, shadow size, no shadows) were never triggered by a real slow device. Touch pinch-zoom and the right-button turn were never tried by a person; the Fullscreen API was tried only in headless Edge (an iPhone gets the CSS overlay);
  - the 2D sprite town is gone (its Kenney renders, `scripts/town-art`, the art cache `nghe-noi-am-art`, which the service worker now deletes, and the portable `art/` folder); the sim (`engine/sim.ts`, `life.ts`) and the overlay (`engine/draw/overlay.ts`) are shared with the 3D stage. Gameplay changes made with the 3D camera, not approved by the owner yet: the suggested resident is put by their own door when the page opens (if more than 7 tiles away), the default view is closer (a grown-up about a fifth of the stage high) and the camera follows only the player (special shots only for a conversation, a new building and the overview; stiffer on a phone);
  - without WebGL 2 on a real graphics card (or when the 3D context fails) the page has no world: a note and the residents as a list (`TownStage3D` `flat` mode, so open panels survive a lost context); checked only with Edge's GPU turned off and with `?r=flat`;
  - still open from the sprite town and not re-checked in 3D: the bus stands beside the path at the bus stop, name tags can sit over a neighbour when people stand close, and a resident can stand behind the "Tới gặp …" button;
  - staging (2026-11-21, docs/town.md §7 "Staging"): every talk walks to where it happens; inside = a 0.35 s dip to dark into the place's room (14 rooms in code, `three/interiors/`, people and camera by `three/scene/roomStage.ts`), outside = the place's front (the two side by side on the screen, the building behind). Checked only as screenshots, engine-captured filmstrips of the dips and numbers in headless Edge (cafe-1, cafe-2 with Ben, school-2 with Mia, board-2 with Leo, friend-1 at Mia's window, a lodger's episode and a lodger's quick chat at the inn, Ben's on the plaza, the clinic's quick chat to its result card, station-1 at the bus stop, `?talk=` links; 1600×900 and 390×844, day and night): 60 fps in the rooms (26–35 draw calls, 0.13–0.16 M triangles, the engine's work about 2 ms a frame), no long task during a dip in the production build. Nobody has watched a dip or a room move on a real screen. Not approved by the owner yet: the neighbour who drops in stands in the room from the first line (no entrance), a walk to a far setting can take 10 s or more (the player runs; a click elsewhere, the keys or Esc give it up), the two outside stand side by side on the screen only from the default view, and on a phone a cheer (new title, egg) waits until the talk ends.
  - episodes (2026-11-14): the 370 clips of the 185 story lines (14 voices, connected + careful) were generated by the owner on 2026-11-14 (manifest 5900 clips, 0 failures; a story line plays its speaker's shipped clip, checked in the built page). Nobody has listened to them yet (voices, accents, pauses between turns); a step-2 line was already heard in the whole exchange, so it is never praised or counted as a first listen: not for the daily "first" task, achievements, the clock-tower project or xp (`keptOutcome` in core/town/economy.ts records it as 'replayed'; it still pays the game's 3 xu the first time it is understood);
  - friendship (2026-11-21, docs/town.md §12): built and checked only in headless Edge with seeded data; the 2,068 new clips (arcs, options, variants, reactions, greetings: 91,717 characters) are not generated yet (`npm run audio:generate`, the owner runs it), so they play the browser voice; the point values and the 2-heart gate of every episode 3 are untuned guesses, and nobody has played it over days;
  - game loops (2026-11-20): built and checked only in headless Edge with seeded data; nobody has played them for days, so the economy (caps: fishing 30 xu/day, farm 20 cards/day, egg 40 xu) and the fishing time limits (7–12 s) are untuned guesses; the worn title shows only in the wardrobe;
  - walking (2026-11-21): only what is drawn blocks, at its real size (`core/town/colliders.ts` builds the solid shapes per town state; the NPC path grid is derived from them; the player's circle collides with the shapes; unbought decoration spots, the unbought fountain and lots not on offer are open ground; building or buying on top of someone pushes them out). Checked by 488 scripted key walks with 0 stops against nothing; not by hand. Known: a click into 2 tiny tree pockets finds no route; fenced sites can't be entered by their gate gap;
  - map (2026-11-21, docs/town.md §11): "Bản đồ" (HUD button or M) opens a whole-town map with district and place names, live residents and markers, the player's arrow; a picked place / resident / activity / ground tile offers "Đi tới" (walk) or "Đến ngay" (a dip, then the player at the door); a 132 px minimap rotates with the camera on wide stages. Hidden in the no-3D list mode. Checked only in headless Edge;
  - picking 1 of 3 meanings has a 33% chance floor and the wrong meanings are confusable on paper, not by sound: xu / level / hearts are a game score, never a measurement;
  - the page uses a game-art exception to the design system (docs/design-system.md → "Thị trấn: game art"): the xu counter shows 0 for a new learner, and the canvas has its own colours (`three/scene/palette3d.ts`, `engine/palette.ts`);
  - on a phone a conversation grows the stage to the screen between the bars and scrolls it up, and an episode's first listen keeps the panel to its question (390×844: the room about 340 px high while listening); shorter than about 640 px the strip is still small (230 px at 375×667) and the panel scrolls;
  - leftovers fixed 2026-11-21 (docs/town.md §7, §11), checked only in headless Edge: the path finder takes a diagonal between two trees where a body fits (no more pockets the keys reach and a click does not: tested both ways), a construction site's gate is shut (a barrier; the site was always solid), the hill in the woods is raised in 3D (1.6 high, level top; people, trees, props, the camera and picking follow it), a neighbour who drops in walks in at their first line of each pass (never in the room before), the map and minimap badge only the suggested resident and the re-listens due (legend line in the map's header), and a talk set more than 12 tiles away goes there through the dark instead of a long walk. Nobody has watched the walk-ins or the hill move;
  - motion (the sim's rules since 2026-11-14, docs/town.md §7 Motion): ground speeds, nobody walks through anybody (paths round people, a 0.5-tile hard gap, residents step aside on a narrow way; after 1.5 s with no way the player's click walk squeezes past), the camera eases in and out (in real time at 30 Hz too). Gameplay changes the owner has not approved: residents and the cat stop and wait for somebody in their way, step aside for the player, and the player may stand two tiles from the one they talk to;
- **Account sync (2026-11-22, docs/supabase-sync.md §5–7):** built and tested (unit, PGlite for the SQL, dev server against a local mock), migration `daily-english/supabase-migrations/18-create-nghe-noi-am-sync.sql` run on the main project on 2026-11-22 (checked: RLS, 4 policies, trigger, execute only for `authenticated`). Still to do by the owner: the redirect URLs in Supabase Auth and the two repository secrets. Nobody has signed in with a real Google account, and the portable paste-code flow was seen only from the web side. Sharing data with daily-english itself (listening minutes, streak, words) is only a proposal (§6), waiting for the owner.
- **Not tested on real devices:**
  - AI audio unlock on iOS/Safari;
  - IndexedDB on `file://`;
  - YouTube auto-logging.
- **AI quality:**
  - generated Vietnamese translations are occasionally clunky;
  - the coach filter catches native-speaker claims but not every unsupported trend phrase.
- **Spelling course:** a few trivial word rows (ship→ship) could be trimmed.
- **Red-team 2026-11-07, still open** (fixed in the same pass: white screen on bad data, key exposure, contradicting ▶):
  - lesson example "Nghe" vs annotation (reviewed 2026-11-07, clips not regenerated yet): of the 15 examples whose `say` equals the text, all show only what Gemini's CONNECTED_STYLE does to the written words (linking, weak to / was / are, unreleased t, written contractions), so they stay written (reasons in `AS_WRITTEN`, `src/data/say.test.ts`). Of the 22 whose `say` differs from the decoder's generated text, 19 are eye dialect for the same sounds as the card (Waida liddle, diddy, Izzy, Watcher = what-shur, Nah chet = na-chet, whatta = what tə …) and stay. Changed: "Look at them." (card loo-kə-dəm, `say` "Look it them.", and "'em" is SAPI-banned) → example "Tell them the truth." / "Tellem the truth."; "I want a soft drink." `say` "I wanna sof drink." (wanna ≠ wan-tə) → "I want a sof drink."; "They're late." `say` + compare `ttsText` "Ther late." (may be read with a voiceless th) → as written. Dictation: 40 sentences (not 49: 9 differ only by a dropped t / doubled letter, e.g. ress tonight) play the written text; every one shows only linking, weak forms the engine says, contractions, or a reduction listed in `AS_WRITTEN` of `connected.test.ts`, so none got a `say`. The 8 new clips (90 characters) need `npm run audio:generate` (the user runs it; never handle the key); until then those items play the browser voice. None checked by ear;
  - the checkup page still calls `prefetchSpeech` without `after` (harmless: nothing is made before a click and all its lines ship clips);
  - the rescue card's "Xóa dữ liệu và mở lại" (RootBoundary) uses plain `clearAll` without a reset marker, so folder-sync data can come back after it (deliberate: it is a last resort for a broken browser copy);
  - a reset (Xóa dữ liệu / restore / Xóa lịch sử) also drops another machine's practice it had not synced yet (the price of making the reset stick).
- **Fixed in the data pass (2026-11-07):** settings / custom-sentence / media-prefs edits no longer reverted by sync; deletes, "Xóa dữ liệu", restore and "Xóa lịch sử" stick (tombstones + reset marker; a first connection with "Gộp" still combines both copies); daily caps keep each local day's counters; review card merge is order-independent for copies of up to two lineages; a backup/sync file can no longer turn on the AI voice. Tombstones expire after 180 days (a machine offline longer can bring a deleted item back).
- **Fixed in the audio pass (2026-11-07):** a slow or failed manifest and failing clip files never send shipped texts to the paid voice; 'bad-response' / 'safety' / 'bad-request' are per text; paid generation happens only after a click; the quota pause resets; first-load spinner; iOS first-click priming; SW manifest timeout, LRU clip cache named after `generatedAt`.
- **Fixed (checkup, 2026-11-07):** "Bỏ bài" after any play records the form (device-local `checkup-abandoned`): the next start gives another form, and a later result on that form is flagged `seenBefore` (shown like a repeat).
