# AGENTS.md: context for coding agents

Read this first. It is the handoff for any agent (Claude Code, Codex, Cursor…) continuing work on this repo.

## 1. What this is

**Nghe Nối Âm** is a browser-only app (no backend) that helps a Vietnamese adult **hear connected English speech**: linking, elision, weak forms, flap T, reductions (gonna/wanna), h-dropping, contractions. It also teaches spelling→sound rules, irregular words and loanwords, and tracks real listening hours and progress.

- **All UI text is Vietnamese**: natural, concise, no English UI words except the English being taught.
- It runs two ways:
  - **dev**: `npm run dev` → http://localhost:5173;
  - **portable**: `npm run portable` builds ONE self-contained HTML file. The user keeps it in OneDrive and opens it from disk (`file://`, origin `null`).
- Learner data lives in `localStorage`. It can be synced between machines through a user-chosen folder (OneDrive, Google Drive, Dropbox…) via the File System Access API.

## 2. The user (owner)

- Vietnamese, weak at hearing native connected speech. Writes casually in Vietnamese ("tao/mày"); **reply in Vietnamese, same casual tone**, short and direct.
- Wants honest answers. No overclaiming: the app is a decoding tool, and real progress needs many hours of real listening. The report and AI coach must never promise "native-like" listening.
- **Hates clutter** ("nhìn rối như bùi nhùi") and dated-looking UI. Wants modern, calm, one job per screen. Real decluttering, not reskins.
- Wants spaced repetition everywhere learning happens ("học xong không ôn lại cũng như không").
- **Do not commit or push without asking.** Commit trailer if asked: `Co-Authored-By: <model> <noreply@anthropic.com>`.
- Never write API keys into code, tests, docs, fixtures, screenshots or the portable build. The user's Gemini key goes only into Settings → Trợ lý AI on each machine.

## 3. Stack and commands

- React 19 + TypeScript 7 + Vite 8, Vitest 5 (node env, `src/**/*.test.ts`), oxlint. Font Be Vietnam Pro (bundled), icons `lucide-react`. No other runtime deps.
- `npm ci`, then:
  - `npm run dev`: dev server;
  - `npx tsc -b`: type-check;
  - `npx oxlint`: lint;
  - `npx vitest run`: tests (~1900 tests, should be all green);
  - `npm run build`: build. Known warning: the main chunk is about 665 kB. It is mostly react-dom plus the content data (courses, lessons, sentences, chunks) that the review catalog needs on every page for the nav badge; the AI layer is a small part;
  - `npm run portable -- --out "<folder>"`: single-file build (default output `portable/Nghe-Noi-Am.html`).
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
    syncMerge.ts    per-key mergers for folder sync (every synced key needs one + tests)
    folderSync*.ts, backup.ts   folder sync + JSON backup/restore, clearAll ("Xóa dữ liệu")
    tts.ts, audioPlayer.ts      all playback: shipped Gemini clip → AI voice (only voiceEngine 'ai') → browser voice
    audioKey.ts, audioManifest.ts, audioInventory.ts   shipped clips: key per (mode, text), manifest loader, list of every built-in playback (docs/audio.md)
    playback.ts     playback modes: connected (say ?? speakText ?? text) vs careful (written text, slower), AI styles, YouGlish
    ai/             provider-agnostic AI layer (see §7)
    aiTasks.ts      AI prompts/schemas/validators: explain mistakes, generate sentences, coach
  data/         content: sentences.ts, chunks.ts, pairs.ts, lessons.ts (connected-speech course),
                courses/{spelling,irregular,loanwords}.ts, lessonTypes.ts, benchmark.ts (+ benchmarkTypes.ts)
  features/     one folder per page: home, review, lessons, decoder, dictation, pairs, drill, shadowing,
                media, stats (Tiến độ + Báo cáo), listening, checkup, settings, ai (shared AI UI)
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
| `#/dictation` | Chép chính tả | listen and type; rule-based "Vì sao bạn nghe sai?" + "Hỏi AI"; "Câu của tôi" with "Tạo bằng AI" |
| `#/pairs`, `#/drill`, `#/shadowing`, `#/media` | Phân biệt âm, Cụm từ, Nói nhại, Video thật | minimal pairs, chunk flashcards, shadowing, YouTube/local media with transcripts (auto-logs listening time) |
| `#/stats` | Tiến độ | overview; `?view=report` = Báo cáo tiến bộ (4 tuần / 3 tháng / Tất cả, charts, checkup trend, "Nhận xét", AI coach) |
| `#/listening` | Nhật ký nghe | log real listening (quick add / stopwatch), milestones (10…1000 h), listenGoal |
| `#/checkup` | (hidden) | Kiểm tra định kỳ: 10 dictation sentences + 4 passages, 6 parallel forms A–F, every 14 days; score = 0.6 × dictation% + 0.4 × comprehension%; audio = connected version, results record `audioMode: 'connected'` (older results = 'standard', compared with a caveat) |
| `#/settings` | Cài đặt | voice/theme/goals, Trợ lý AI, data & folder sync, backup, clear |

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
  - every new synced storage key needs a merger in `syncMerge.ts` with tests (idempotent, commutative);
  - device-only state goes in `DEVICE_LOCAL_KEYS`;
  - AI config/usage uses its own prefix `nghe-noi-am-device:`, so it is never synced or backed up.
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
- **Voice engine:** `Settings.voiceEngine` = `'clips' | 'ai' | 'browser'`. `'clips'` ("Giọng Gemini có sẵn", the default and the migration target of the old stored default) plays shipped clips and, for any text without one, the browser voice: it never makes a paid request, even with a key set for AI tasks. `'ai'` (explicit choice only, "+ Gemini qua key (tốn phí)") plays shipped clips too and routes texts without a clip through `aiSpeak` with the style of the playback mode (`speak(text, { mode })`: `CONNECTED_STYLE` / `CAREFUL_STYLE` / default; the TTS cache key includes text + style), falling back to the browser voice on errors. `'browser'` is always the browser voice. A circuit breaker plus `VoiceNotice` handle repeated AI failures: settings errors until the settings change, a provider quota until the next local day (1–6 h), network/5xx/429 for a cooldown, and 'bad-response' / 'safety' / 'bad-request' per text (3 in a row pause the whole AI voice 10 min). `browserOnly` playback (dictation "Từng cụm") still plays shipped clips; it only keeps the paid AI voice out.
- **A shipped text is never paid for:** when its clip file does not load (skipped for 2 min; 2 failures in a row skip all clips for 2 min), or the manifest is unknown (a slow load: the first playback waits `MANIFEST_WAIT_MS` 4 s; a failed load: retried after 30 s), playback uses the browser voice, not the AI voice, and `CLIPS_NOTICE` says so once. The manifest is preloaded at app start (`main.tsx`). The service worker answers the manifest from its cache when the network stalls for 3 s, keeps clips LRU (400), and names the clip cache after the manifest's `generatedAt`.
- **AI calls only after a click:** `prefetchSpeech` arms clips that are made only when the learner next plays something (`after: text` = only when that text is played: dictation arms the NEXT sentence after the current one); `speak(…, { auto: true })` (dictation auto-play) never makes a new paid request, it reuses a clip made this session or uses the browser voice.

- **Free tier is the norm:** a free Gemini key allows a few TTS requests per minute and ~30 a day. `prefetchSpeech(texts, { mode, ahead, after })` arms only the first text by default (`PREFETCH_AHEAD_DEFAULT = 0`), never careful clips, and nothing is made before a click; a 429 pauses the AI voice quietly (breaker) and the browser voice plays.

## 8. Testing approach

- Unit tests sit next to the code. They cover DST, sync merges and simulations (60-day SRS load).
- **E2E/screenshots:** earlier sessions used headless Edge over CDP with a throwaway profile, plus a local mock Gemini server for AI flows (fake key, base URL override allowed only for localhost/127.0.0.1). Those scripts lived in a temp folder and are **not** in the repo. Recreate them if needed, and take views at 1600×900 dark and 375×812 dark plus one light.

## 9. State and known open issues (as of 2026-11-07)

- **Git / deploy:** repo `hnp180493/english-listening`, branch `main`. A push to `main` deploys GitHub Pages (`.github/workflows/deploy.yml`: npm test, then build with `--base=/<repo>/`) to https://hnp180493.github.io/english-listening/. The shipped clips (`public/audio`, ~57 MB) are committed, so every regeneration grows the repo. Ask the user before committing or pushing.
- **Bundle:** main chunk about 665 kB (warning only, cause in §3).
- **Checkup:**
  - `voiceName` records every voice that actually spoke, in order (`checkupModel.noteVoice`, from `SpeakOptions.onVoice`; e.g. `Gemini · Kore (có sẵn) + Microsoft Ava` after a fallback), so a mixed test never compares as same-voice;
  - the result screen shows percentages from small per-phenomenon samples.
  - a draft started before the connected-audio change and finished after it is recorded as 'connected' (mixed audio; drafts expire after 24 h).
- **Playback not yet switched to connected text:** the AI generator preview and the dictation "Câu của tôi" list still send the written text (they show no annotations next to the button). Home, Shadowing and Drill play the connected version.
- **Speakable text is verified only against Windows SAPI (Microsoft David)** by captured phonemes (2026-11-07). Neural voices (Edge Natural, Gemini TTS) were not re-measured after the SAPI-safe changes (yuh, an, glued teller/tellem, would juh, wadder). The familiar -ja/-cha forms (didja, meetcha, toldja) are kept although SAPI ends them with /ɑ/ instead of /ə/.
- **Dictation sentences:** the 300 sentences rely on the generated text (no authored `say`); where the decoder has no safe spelling (cross-word flap after "it" like "turn it off", assimilation like "in Boston"), "Nghe" still sends the written words.
- **Home:** the baseline-checkup suggestion is folded under "Xem thêm" for new learners (deliberate, could be revisited).
- **Stats:** "Hôm nay" can read 1 higher than the nav badge right after a session (it counts cards due later today).
- **Not tested on real devices:**
  - AI audio unlock on iOS/Safari;
  - IndexedDB on `file://`;
  - YouTube auto-logging.
- **AI quality:**
  - generated Vietnamese translations are occasionally clunky;
  - the coach filter catches native-speaker claims but not every unsupported trend phrase.
- **Spelling course:** a few trivial word rows (ship→ship) could be trimmed.
- **Red-team 2026-11-07, still open** (fixed in the same pass: white screen on bad data, key exposure, contradicting ▶):
  - lesson example "Nghe" vs annotation: 15 connected-course examples have `say` equal to the written text and 22 have a `say` that differs from the decoder respelling; 49 of 300 dictation sentences play the plain text. Not checked by ear. A real fix means new `say` text plus `GEMINI_API_KEY=… npm run audio:generate` (the user runs it; never handle the key). Do not change `say` without regenerating, or those items fall back to the browser voice;
  - folder sync: settings and custom-sentence edits can be reverted by a "newer" machine (whole-store `localChangedAt`); deletes and "Xóa dữ liệu" are resurrected (no tombstones for custom sentences / media);
  - AI cost: a backup/sync file can turn on `voiceEngine:'ai'` (the manifest-timeout / clip-failure / bad-response / prefetch cost paths were fixed 2026-11-07; the checkup page still calls `prefetchSpeech` without `after`, harmless since all its lines ship clips);
  - checkup: "Bỏ bài" then restart gives the same form with fresh plays;
  - daily caps can be bypassed by the review/drill daily merge around midnight or across timezones.
