# Nhật ký nghe, Kiểm tra định kỳ, Báo cáo tiến bộ

Why these exist: the learner asked whether finishing every lesson makes them hear like a native speaker. Honest
answer: the app fixes **decoding** (hearing the words inside connected speech); native-like listening also needs
hundreds to thousands of hours of real listening. So the app now (1) logs real listening hours, (2) measures
listening with a short periodic test, and (3) shows both, plus practice, in one honest report.

All copy is Vietnamese. Read `docs/design-system.md` before UI work. Code: `src/core/listening.ts`,
`src/core/benchmark.ts`, `src/core/history.ts`, `src/core/progressReport.ts`; content `src/data/benchmark.ts`;
pages `src/features/listening`, `src/features/checkup`, `src/features/stats/ReportView.tsx`.

## 1. Storage keys

| Key (`nghe-noi-am:` prefix) | Synced / backed up | What |
|---|---|---|
| `listening-log` | yes | `{ version: 1, entries }`: listening entries and delete tombstones |
| `checkup-results` | yes | `{ version: 1, results }`: finished checkups only |
| `progress-history` | yes | daily-aggregate archive of practice and review (section 4) |
| `listening-timer` | **device-local** | the running "Bắt đầu nghe" stopwatch of this browser |
| `listening-pending` | **device-local** | in-app video seconds below one minute (per day and video) |
| `checkup-draft` | **device-local** | an unfinished checkup, so a reload resumes it (24 h) |
| `device-id` | **device-local** | random id of this browser (its own bucket in the archive) |

Device-local keys (`DEVICE_LOCAL_KEYS` in `core/storage.ts`) are never exported to a backup, never imported, never
written or cleared by folder sync, and writing them does not mark folder sync dirty. "Xóa dữ liệu" still removes them.

Setting `listenGoal` (minutes per day): 0 (tắt) / 15 / 30 / 45 / 60 / 90, default 30, sanitized like `reviewMinutes`.

## 2. Nhật ký nghe (`#/listening`)

Entry: `{ id, startedAt, day (local YYYY-MM-DD), minutes (1–600), source, title?, understood? (1–5, tự đánh giá),
subtitles?, updatedAt }`; source `app` entries also have `mediaId`, `seconds` and `dev` (the browser that owns it).

**Merge** (`syncMerge.mergeListeningLog`): union by id, the newer `updatedAt` wins, a tombstone wins a tie. Deletes
leave `{ id, updatedAt, deleted: true }` so they reach the other machines; tombstones older than 180 days are pruned
(a machine offline for longer could bring a deleted entry back).

**Stopwatch.** Stored with `startedAt`, `accumulatedMs`, `runningSince`, `lastStartAt`, `stoppedAt`: survives a
reload or a closed tab. "Dừng và lưu" freezes it and opens the save form (minutes rounded, editable; a warning above
4 hours). The minutes count for the day the **latest running span** started (`timerDay`): paused at 22:05 and resumed
at 08:00 next day → the next day; 23:30–00:20 without a pause → the first day. The save and edit forms have a day
picker (today, yesterday, or the entry's own day).

**Auto-log of in-app "Video thật"** (`features/media/listenAutoLog.ts`):

- counts wall-clock time while the player plays, **only in free listening**: watch mode without the sentence loop.
  Dictation mode and the auto-loop replay one sentence; that is practice (already counted as attempts), not real
  listening;
- nothing is counted while this browser's stopwatch runs (the same minutes would be logged twice);
- a silence of more than 3 minutes between events while "playing" (laptop asleep, page frozen or in the
  back/forward cache) counts only one 10-second tick, so waking a machine never logs hours. Background-tab
  throttling (one tick a minute) is still counted in full;
- written after a pause of 60 s, every 5 minutes of continuous play, on page hide/unload and when leaving the video.
  Every flush resets the counter (no second is written twice); under one minute a day stays device-local;
- each browser increments **only its own** entry per day and video (`dev`): two machines adding seconds to one
  shared entry between syncs would lose one machine's minutes under last-writer-wins.

Milestones: 10, 25, 50, 100, 200, 300, 500, 750, 1.000 giờ.

## 3. Kiểm tra định kỳ (`#/checkup`, not in the nav)

Six parallel forms A–F (`src/data/benchmark.ts`), each 10 dictation sentences (3 × level 1, 4 × level 2,
3 × level 3) and 4 passages with one question. `src/data/benchmark.test.ts` enforces: no overlap (≥ 80% shared
words) with any other app text; word totals within ±8% and decoder annotations within ±10% of the mean; every form
covers the 8 phenomena; at most 2 sentences per form hinge on an unreleased `'d`; focus tags are what `decode()`
marks; every sentence typed without apostrophes still scores 100%; the right option is never much the longest;
options never assume the speaker's gender (the voice is the learner's choice); app tone-mark style (hủy, hóa).

Content rules: everyday American speech, standard spelling ("going to"), no digits, no names to guess, no rare
words (a vocabulary gap is not a listening gap), no sentence whose typed form depends on a sound the audio does not
carry (were/we're, iced/ice, we'd/we'll before a consonant). "Why" texts still say "khi nói nhanh thường thành
'gonna'" rather than claiming the voice did it: a machine voice only approximates real connected speech.

Rules of the test: natural speed (rate 1, the voice from Settings), at most 2 plays per item, no slow play, no
hints. **Audio = the connected version** (`src/core/playback.ts`): each line is spoken as the item's authored `say`,
else the decoder's `speakText` (eye-dialect such as "Whaddaya wanna do?"), with the connected AI style; the test
measures understanding of natural speech, not of a newsreader reading the written text. Results record
`audioMode: 'connected'`; results saved before this change have no field and count as `'standard'`
(`benchmark.audioModeOf`). Only the current item is prefetched for the AI voice (free keys are rate-limited). Passage options are shuffled per attempt (`optionOrder`, seeded by the test start and question id; the stored
`chosen` is the original index), so the position of an answer cannot be learnt.

**Score** = round(0.6 × dictation word accuracy % + 0.4 × comprehension %). Dictation uses the dictation
normaliser and aligner (`core/dictation`); in the checkup, contractions typed without apostrophes ("ill", "were")
are accepted where the sentence has that contraction. Per-phenomenon misses come from the decoder + `classify` on
the dictation part only. Nothing is recorded as practice (`recordAttempt` is never called).

**Measured noise.** One comprehension answer is worth 10 points. A Monte Carlo run with `buildCheckupResult` on
the real forms (a learner of constant ability, word p = 0.6, question q = 0.6, two different forms) gives a score
difference with a standard deviation of about **15 points**; the dictation part alone about 7. That is why every
comparison below is hedged.

**Cadence and rotation.** Next form = never used first (A → F), else the least recently used. Recommended every 14
days; Hôm nay offers it (optional row, never the primary) when no baseline exists after onboarding or 14+ days after
the last. A test within 7 days of the previous one asks for confirmation and is left out of trends.

## 4. Long-term archive (`progress-history`, `core/history.ts`)

Stats keep only the last 1000 attempts, so the report needs its own record: per local day, per module
`{ n, ok }`; Ôn tập grades `{ again, hard, good, easy }`; grades on graduated cards (retention); word cards
graduated for the first time. Lessons passed come from `lessons-progress.completedAt`.

**No double counting across folder sync.** Each browser increments only its own bucket
`devices[deviceId][day]`; a device's counters only grow, so the merge takes the max per device, day and field, and
totals are the sum over devices (idempotent, commutative, associative). The one-off backfill from the attempts still
stored goes to `base`, only when no base exists after the boot sync, from attempts before `until`; live counting
starts at the same moment.

Limits: two offline backfills can under-count (never over-count); review grades and graduations have no history
before the archive existed; a word graduated on two machines before they synced counts twice; restoring an old
backup lowers this browser's bucket until the folder copy brings it back.

**What is archived.** First practice only: attempts made inside Ôn tập (`recordAttempt(…, { inReview: true })`:
sentence, pair, lesson, chunk and word cards) count for stats and phenomena but not in the archive. Re-testing a
sentence the learner already got right would make "practice accuracy" rise from memory; Ôn tập is measured by its
retention instead.

**"Nghe 1 lần là đúng" (`DayAgg.once { n, ok }`, `core/dictation/listens.ts`).** Real speech is said once, so the
archive also keeps how new dictation sentences went on the first listen. Measured (`n`) only for a whole-sentence
check of a sentence never dictated before, played at least once; not for "Điền từ", a retry of the sentence on
screen, or an answer typed without playing. `ok` = fully right, no hint, after exactly one play at the normal speed
(no replay, no "Chậm", no "Từng cụm"; auto-play of the next sentence counts as the one play). Not backfilled. The
report states it from 20 sentences (`MIN_FIRST_LISTEN_SAMPLE`; fewer: hedged fact, no insight), compares it with the
previous window only when both have the sample and differ by 10 points, and always adds that the app's voice is
clearer than real speakers. The dictation result line and the round summary show the same thing for the sentences
of the round (those include sentences seen before: the summary counts what happened, the archive measures).

## 5. Báo cáo tiến bộ (`#/stats?view=report`)

Periods: 4 tuần (3 full weeks + this week), 3 tháng (13 weeks), Tất cả. Labels name the start day ("Từ 12/10"), so
the window is never overstated. "Tất cả" longer than 26 weeks is charted by month. Durations use one format
everywhere (`formatDurationVi`): under 10 hours "3 giờ 20 phút", from 10 hours "46,1 giờ" / "2.413 giờ".

Sections, each shown only with data (otherwise one muted line with a link): overview tiles; listening by week/month
with the goal line, a marker for the goal pro-rated to today on the current bar, and the source split; checkup
scores (chart, table with form, notes); self-rating (always "tự đánh giá"); practice in the app (weekly accuracy,
per module, retention, lessons, words); "Nhận xét".

## 6. Honesty rules ("Quy tắc trung thực")

The constants live in `core/progressReport.ts`; weakening one needs a reason written here.

- Never a claim about native-like listening ("bản ngữ"); tested on every combination of data.
- Sentences talk about the period the learner picked, with numbers that are on the page.
- **Listening comparison** needs a previous-window base of `MIN_LISTEN_BASE` (2 h for 4 weeks, 5 h for 3 months);
  a change of +100% or more is said as "gấp khoảng N lần", never "+1900%". Goal days of the last 7 skip the days
  before the first entry and count today only once its goal is met.
- **Checkup score**: a change of `SCORE_NOISE` (10) points or less is "chưa thay đổi rõ"; until
  `MIN_TREND_CHECKUPS` (4) tests every change says "mới có N lần đo"; from 4 tests the trend compares the mean of
  the first 2 with the mean of the last 2; a series that goes up and down is "dao động từ … đến …"; quick retakes
  (< 7 days) are left out; a repeated form, a TTS voice change, an **audio-mode change** and a last test older
  than 28 days are mentioned. Audio mode: comparing older standard-text results with connected-speech ones is a
  different condition (the connected audio is harder). `compare()` sets `audioModeChanged` only when the test
  compared just before (the previous one, or the first when there is no other) used the other mode: the report's
  `voiceNote` (the test-condition caveat) and the insight add `AUDIO_MODE_NOTE` and the result screen shows the
  caveat. Once the previous test was connected too, the caveat goes away; if only the FIRST test was standard,
  `firstAudioModeDiffers` adds the quiet one-liner `FIRST_AUDIO_MODE_NOTE` ("lần đầu dùng giọng đọc chuẩn …") to the
  vs-first sentence instead. Older results are never rescored or dropped.
  The dictation % is given next to the score, since it is the steadier part.
- **Phenomena**: pooled first half vs second half of the tests, at least `MIN_PHENOMENON_SENTENCES` (5) sentences
  on each side and a change of at least 30 points, said with "có vẻ" and with counts ("sót 4/6 câu → 1/6 câu"),
  never "rõ". The report's rows show counts; rows with fewer than 5 sentences are greyed; "0 → 0" rows are dropped.
- **Practice trend**: per module only (a move from a hard module to an easy one is not progress), at least
  `MIN_PRACTICE_SAMPLE` (20) attempts on each side, worded "trên các bài bạn chọn luyện". Weeks with fewer than 10
  attempts and self-rating weeks with one rating are drawn as grey "ít dữ liệu" points.
- **Retention** is "nhớ được ở N% lượt ôn thẻ đã thuộc" (it counts grades, not cards), stated from 20 grades.
- **Self-rating** is always called "tự đánh giá" and "mức hiểu còn tùy độ khó nội dung bạn chọn"; levels are prose
  ("dưới 30%", "trên 90%"), never symbols inside a sentence. An average on a tie between two levels takes the lower
  one (4,5/5 → "khoảng 70–90%"), so a self-rating is never rounded up into a better band.
