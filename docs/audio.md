# Shipped Gemini audio (pre-generated clips)

The owner chose Gemini's voice (Kore) after comparing Windows, OpenAI and Gemini by ear, and asked for the
built-in content's audio to be generated **once** and shipped with the app, so playback costs nothing, needs no key
and starts at once. This page covers the offline tooling: the inventory, the generator, compression and the
manifest. Playback routing (which playback uses a shipped clip) lives in `src/core/tts.ts`,
`src/core/audioManifest.ts` and `src/core/audioKey.ts`.

## What gets shipped

```
public/audio/<key>.mp3      one clip per (mode, text): MP3, MPEG-2 Layer III, 24 kHz mono, CBR 40 kbps
public/audio/manifest.json  { version, voice, styleVersion, model, voiceName, format, generatedAt,
                              clips: { [key]: { f: "<key>.mp3", d: <duration ms>, src: <first source> } } }
```

- **Key**: `audioKey(mode, text)` in `src/core/audioKey.ts`. It is a hash of the voice id (`gemini-kore`),
  `AUDIO_STYLE_VERSION`, the mode (`connected` / `careful`, or `plain` for a playback without a mode) and the exact
  text, trimmed. The router computes the
  same key from what it is about to speak, so a clip is found with nothing but the text. Rate is **not** part of
  the key, because the player applies `playbackRate` (pitch preserved) to the same file.
- **When keys change**: any edit to a played text (content, decoder rules, `say`) gives a new key, so that clip
  is missing until the generator runs again. Old files are left out of the manifest; `--prune` deletes them.
  Editing `CONNECTED_STYLE` / `CAREFUL_STYLE` does **not** change keys. Bump `AUDIO_STYLE_VERSION` and the pin in
  `src/core/audioInventory.test.ts` together, then regenerate everything.
- Vite serves `public/audio/` as `/audio/` and copies it to `dist/`. `npm run portable` inlines the manifest and
  copies the files next to the HTML (`scripts/build-portable.mjs`, `scripts/portableAudio.mjs`).
- The manifest is rebuilt from the files on disk on every generator run: a valid `<key>.mp3` whose key is in the
  current inventory is listed, anything else is not.

## Voices: "Thị trấn" speakers (since 2026-11-14)

Everything above is spoken by Kore. In the town game every resident and the learner's character speak with their
own Gemini voice, so the learner hears many speakers instead of one.

- **Cast**: `src/core/town/voices.ts`. `CAST_VOICES` maps a place id (the resident who lives there) and `'player'` to
  a `CastVoice { voice, gender, accent? }`: `voice` is a Gemini prebuilt voice (`GEMINI_VOICES` in
  `src/core/ai/defaults.ts`), `accent` an optional short English note ("light British accent"; omitted = General
  American), `gender` picks a browser voice when no clip exists. `voiceOf(line.who, episode.placeId)` gives the voice
  of a story line ('them' = the place's resident, 'you' = the player, a place id = that resident).
- **Key**: `audioKey(mode, text, voice?)`. The hashed string is `<voice id>|<style version>|<mode>|<text>`. The voice
  id is `gemini-kore` for no voice, or for Kore with no accent, so **every key made before voices existed is
  unchanged** (pinned in `audioKey.test.ts` against real keys from `public/audio/manifest.json`). Any other voice is
  `gemini-<voice lowercased>`, plus `~<accent>` when there is one (`clipVoiceId`). The same words by two speakers
  are two clips. Sarah (office) speaks with Kore and no accent, so her lines share any clip the app already ships
  for those words.
- **Style**: `clipStyle(mode, accent)` (`audioInventory.ts`) = the mode's style; with an accent, "American English"
  becomes "English" and ", spoken with a <accent>" is appended (`styleWithAccent` in `audioKey.ts`). The generator
  and the app's live AI voice send the same string, so an AI clip made in the app and a shipped clip sound alike.
- **What a story line plays**: `storyLinePlayback(line, episode, mode)` in `src/core/town/storyAudio.ts` returns
  `{ text, mode, rate?, voice }`. `connected` = the same text dictation plays for a sentence (`dictationAudio`: `say`,
  else the decoder's `speakText`, else the text); `careful` = the written text at `CAREFUL_RATE`. The town UI calls
  `speak(p.text, { mode: p.mode, rate: p.rate, voice: p.voice })`; the inventory lists exactly these (source `town`,
  part `main` / `careful`, entries carry `voice` / `accent` when not the default), so the two cannot disagree.
- **Routing with a voice** (`SpeakOptions.voice`, `src/core/tts.ts`): the shipped clip for `(mode, text, voice)`;
  else, only with voiceEngine `'ai'` and on a click, `aiSpeak` with the speaker's Gemini voice (a non-Gemini provider
  keeps its own voice; the accent still goes into the style) — the voice and style are part of the AI cache key and
  of the per-text breaker key; else the browser voice, chosen by `pickSpeakerVoice` (an English voice of the
  speaker's gender guessed from its name, natural voices first, the accent's language preferred, speakers of one
  gender spread over the good voices; the learner's own voice when none is known to match). Every rule above holds
  per voice: a shipped text is never paid for, auto playback never makes a new request (a clip made for another
  speaker does not count), `prefetchSpeech(texts, { mode, voice, after })` arms clips for that voice only.
- **Manifest**: entries of a voiced clip also carry `v: "<voice>"` (for people reading the file; the app ignores
  it). The header's `voiceName` stays Kore, the default voice.

**Adding a character**: add a `CAST_VOICES` entry (a voice from `GEMINI_VOICES`, the gender, an accent note if any)
and its lines in `src/data/townStories.ts`; run `npm run audio:inventory` (counts per voice) and
`npm run audio:generate -- --dry-run`, then the owner runs the generator with his key. Changing a voice or accent
changes the keys of every line that character says: the old files drop out of the manifest (`--prune` deletes them)
and new clips are made. The generator stops before any request when an inventory voice is not a Gemini prebuilt
voice.

## Inventory (`src/core/audioInventory.ts`)

`buildAudioInventory()` lists every clip the built-in content can request: `{ key, text, mode, style, source, ref,
part, refs, sources, browserOnly }`, deduplicated by key. It derives every text through **the same functions the
play buttons call** (`connectedPlan` / `carefulPlan` / `compareCarefulPlan`, `dictationAudio` + `chunksOf`,
`annotationSpeech`, `segmentSpeech`, `quizPlayback` + `itemSentence`, `connectedLines`, `sanitizeChunks` +
`citationText`, `speakableFor`, `sentenceSource` / `chunkSource` + `buildSteps`, `authoredSay`). Where a
component builds its text inline (ExampleCard, CompareCard, DrillCard, PracticePanel, FeedbackView, StepGuide,
SpokenSentence, HomePage, PhenomenaGuide), the expression is copied with a comment naming the component.
`src/core/audioInventory.test.ts` checks every button's text against the helpers.

| source | what is covered |
|---|---|
| dictation | "Nghe" / "Chậm" (connected), "Rõ từng từ" (careful), every annotation "Nghe", "Từng cụm" chunks |
| checkup | every sentence and passage line (connected, authored `say` / `say[]` applied) |
| lesson | course `connected` example cards (connected + careful + segment ▶ when shown), compare cards, quiz items before and after answering. Other courses: careful buttons only (their "Nghe" is mode-less) |
| chunk | chunk `ttsText`, the example sentence (connected), the citation form (careful) |
| shadowing | the model (connected), "Rõ từng từ", every "Từng cụm" step, the whole-sentence step, annotation ▶ |
| decoder | the sample chips shown (`EXAMPLES_SHOWN`, the hidden examples are reachable only by typing), built-in sentences and chunk examples as "Câu ngẫu nhiên" or an opened link (both use the sentence's `say`: `authoredSay(…, SENTENCES)`), Shadowing suggestion chips: "Nghe", "Rõ từng từ", segment ▶, annotation ▶ |
| shadowing (suggestions) | the three "Gợi ý" chips of the custom tab (`CUSTOM_EXAMPLES` in `shadowing/sources.ts`), practised as custom sources |
| home | sentence of the day |
| guide | phenomenon cheat-sheet examples |
| pairs, words, lesson (`plain`) | mode-less playbacks: minimal pairs, word rows and Ôn tập word cards, story words, "Nghe" in courses spelling / irregular / loanwords. Default AI style; the router looks them up as `audioKey('plain', text)` |
| settings | "Thử giọng": with the Gemini clips it plays the connected sample, the same clip as decoder example 0 |
| town | every line of `TOWN_STORIES`: connected + careful, in the speaker's voice (`storyLinePlayback`, section Voices) |

- **browserOnly**: dictation "Từng cụm" chunks (`SpeakOptions.browserOnly`) play shipped clips too; browserOnly only
  keeps the paid AI voice out when there is no clip. The 391 chunk texts used nowhere else are marked
  `browserOnly` (informational) and generated by default (`--skip-browser-only` leaves them out).
- **User content** is never listed: custom dictation sentences, AI-generated sentences, media transcripts and typed
  decoder input.
- **Near-duplicates are kept on purpose**: about 460 short clips differ from another only in case or edge
  punctuation ("about it." / "about it?"). Edge punctuation changes the TTS prosody, so the key stays exact.

**Adding a play button** to built-in content means adding its text to `audioInventory.ts` (through the same
helper the button uses) and a check to the test. Otherwise that button falls back to the live voice.

Counts on 2026-11-07 (after the review fixes): **5,526 clips** (3,898 connected, 873 careful, 755 plain) with
90,270 characters and 18,989 words, all generated by default. By first source: dictation 2,081, shadowing 1,157,
lesson 577, chunk 516, words 417, decoder 417, pairs 249, checkup 111, guide 1. By part: chunk 996, main 917,
careful 873, step 804, plain 755, annotation 648, segment 533.

Counts on 2026-11-14 (town stories added, still being written): **5,900 clips**, 104,860 characters. The 5,530
shipped clips are all still current; the 370 `town` clips (14,554 characters: 356 in 13 voices of their own, 14 by
Sarah in Kore) are missing. `--dry-run`: ~23 min of audio, ~6.1 MB MP3, 8 batch jobs of 50.

## Commands

```
npm run audio:inventory                    # counts + .audio-gen/inventory.json
npm run audio:generate -- --dry-run        # what is missing, estimated time and size (no key needed)
GEMINI_API_KEY=… npm run audio:generate    # generate everything missing (batch API)
GEMINI_API_KEY=… npm run audio:generate -- --mode sequential --limit 20   # a first small run to listen to
npm run audio:test                         # generator end-to-end against a local mock server
```

The scripts load the app's TypeScript modules with Vite's module runner (`runnerImport`). That starts no dev
server and opens no port. The model and voice come from `src/core/ai/defaults.ts` (`gemini-3.8-flash-tts`, Kore),
the request body from the app's own `buildGeminiTtsBody`, and the style per mode from `src/core/playback.ts`. The
shipped clips are therefore requested exactly like the app's live AI voice.

| option | default | meaning |
|---|---|---|
| `--mode batch\|sequential` | batch | Batch API (half price, no per-minute limit), or one request at a time |
| `--limit N` | all | only the first N missing clips (main, careful and plain first, then annotations, steps, segments, chunks) |
| `--only a,b` | all | clip sources: dictation, checkup, lesson, chunk, shadowing, decoder, home, guide, pairs, words, settings, town |
| `--part a,b` | all | main, careful, plain, annotation, step, segment, chunk |
| `--rpm N` | 10 | sequential request starts per minute (the paid key allows about 10 TTS requests per minute) |
| `--concurrency N` | 2 | sequential requests in flight |
| `--batch-size N` | 50 | clips per batch job (inline requests; the results of 50 clips are about 6–8 MB of JSON, read with a 10 min timeout) |
| `--poll S` | 30 | seconds between batch status checks |
| `--kbps N` | 40 | MP3 bitrate (MPEG-2 values: 32, 40, 48 …) |
| `--no-trim` | | keep the edge silence (default: trimmed, 120 ms kept on each side) |
| `--no-keep-wav` | | do not keep the raw clips in `.audio-gen/wav/` |
| `--no-fallback` | | after a batch run, do not retry per-request failures one by one |
| `--skip-browser-only` | | leave out the "Từng cụm"-only clips (they play the browser voice then) |
| `--prune` | | delete `.mp3` files that are no longer in the inventory |
| `--model ID` | defaults.ts | another TTS model (voices stay as listed: Kore, or a clip's own speaker; they are part of the key) |
| `--out DIR` / `--work DIR` | `public/audio` / `.audio-gen` | clips + manifest / log and state |
| `--inventory FILE` | built fresh | read the clip list from a JSON file (tests); every key is re-checked |

Exit codes: 0 done, 1 error (no key, key refused, model missing), 2 daily quota reached (run again tomorrow, the
clips made so far are kept), 3 some clips failed, 4 batch jobs still pending or unreadable (run again later; they
are collected, never paid for twice).

### Resuming

- Every run starts from what is on disk. A valid `<key>.mp3` is kept; a broken one, or one that is missing,
  is made again.
- The raw clip (WAV, 24 kHz) of every accepted clip is kept in `.audio-gen/wav/<key>.wav`. That is about
  48 kB/s, ~380 MB for everything, and it is never shipped. A missing or broken `.mp3` whose WAV is there is
  re-encoded without any request (a key is not even needed). Keep this folder until the clips are final.
- Each batch job is written to `.audio-gen/batches.json` (with a unique display name) **before** its create call.
  A later run collects jobs that were not collected yet and never submits those clips again (a job runs up to
  48 h). A create call cut short or answered with a timeout / 5xx is not retried: the job is looked up by its
  display name in `GET batches`; only when the listing shows it was never created are its clips submitted again.
- A finished job whose results cannot be read (unknown response shape, a results file that does not download) is
  **not** marked collected and its clips are **not** regenerated: the run ends with exit 4, the log names the
  response's field names, and the next run reads the job again. Clips of jobs still pending at `--max-wait-hours`
  wait the same way.
- `manifest.json` is written every 10 clips and at the end (temp file with a unique name + rename; writes are
  serialized). Ctrl+C saves it too. Temp files left by a run cut short are removed at the start of the next run.
- `.audio-gen/generate.log` has one line per clip, plus waits and errors. `.audio-gen/failed.json` lists clips that
  failed twice, with the reason. **`.audio-gen/` is not in `.gitignore` yet. Add it.**

### Rate limits and errors

- Sequential mode spaces request starts by 60/rpm seconds. A 429 pauses every request for the time Google gives
  (`Retry-After` header, else `RetryInfo.retryDelay`, else 5 s, 10 s … up to 60 s), up to 12 times per clip.
- A per-day quota error (`QuotaFailure` quotaId `…PerDay…`, the same rule as `geminiQuotaIsDaily` in the app)
  stops the run with exit 2.
- 5xx and network errors back off 2 to 16 s, up to 4 times. 401/403 or `API_KEY_INVALID` stop the run. A 404 on the
  model stops the run. Any other 400 fails just that clip.
- **The key**: it is read from `GEMINI_API_KEY` only and sent only in the `x-goog-api-key` header. It is never
  logged, because every log line goes through `redact()`. `GEMINI_BASE_URL` may point only at
  `https://generativelanguage.googleapis.com` or at this machine (127.0.0.1 / localhost: the mock server). Any other
  host is refused, so the key cannot leak to a mistyped URL.

## Batch API

Checked on 2026-11-07 at aistudio.google.com/docs/batch-mode and /docs/models/gemini-3.8-flash-tts:

- The `gemini-3.8-flash-tts` model page lists the **Batch API as supported** (along with Flex and Priority).
- It costs 50% of the interactive price, and the per-minute request limit does not apply. Google's target is 24 h
  ("many jobs finish much faster"), and a job still pending or running after 48 h expires.
- The endpoint is `POST models/{model}:batchGenerateContent` with `batch.input_config.requests.requests[] =
  { request, metadata: { key } }` (inline, under 20 MB). Status comes from `GET batches/{id}`, and the states end
  in `SUCCEEDED` / `FAILED` / `CANCELLED` / `EXPIRED`.
- The documentation is inconsistent about where the state and results sit (`metadata.state` or `state`;
  `response.inlinedResponses`, `dest.inlinedResponses`, `response.responsesFile` or `dest.fileName`). The
  generator accepts all of these, including a JSONL results file downloaded from `/download/v1beta/{file}:download`.
  Entries are matched by `metadata.key`, else by position.
- If creating a job is clearly refused (a 4xx: for example, the model is refused for batch), nothing was created and
  the generator switches to sequential for the rest. After collecting results, only clips that a readable job
  returned with an error, or that fail validation, are retried one by one (full price), unless `--no-fallback`.
  Jobs that ended FAILED / CANCELLED / EXPIRED are resubmitted as batch by the next run.

The batch path has been tested only against the mock server. Watch the first real job (log lines
`batches/…: <state>`). If the live response shape differs, the job stays in `batches.json` (exit 4), and the next
run collects it again once the parser knows the shape.

## Validation

Each clip goes through these checks before it is written:

1. Not empty, and not too short for its words. This reuses the app's `clipProblem`: at least 0.2 s and 0.08 s per
   word.
2. Not unusually long: at most 4 s + 1.2 s per word. This catches a runaway generation.
3. PCM 16-bit at 8 to 24 kHz. Stereo is downmixed to mono.
4. After encoding, the MP3 must pass a frame-by-frame scan. That means it starts with a frame sync, every header
   chains to the next, and the walk ends at the end of the file. Its duration must also be within 250 ms of the PCM.

A clip that fails is requested once more, then recorded in `failed.json`. Nothing that fails is shipped. The
manifest's `d` is the trimmed PCM duration in ms.

## Compression (no ffmpeg)

Gemini returns raw PCM, 24 kHz 16-bit mono, about 48 kB/s. That is too big to ship (about 380 MB for this
inventory). The generator encodes MP3 in pure JavaScript with **`@breezystack/lamejs`** (devDependency, ESM,
works on Node 24): MPEG-2 Layer III at 24 kHz mono, constant bitrate.

- **40 kbps ≈ 5 kB per second of audio.** That is clean for a single voice: no music, nothing above about 11 kHz
  worth keeping. Not compared by ear yet: listen to the first `--limit 20` clips, and use `--kbps 48` (or 32) if
  needed. Changing the bitrate later does not change keys: delete the `.mp3` files and run again. They are
  re-encoded from the kept WAVs (below) with no request and no key.
- MP3 plays everywhere the app runs (Edge/Chrome on Windows, Safari on iOS, `file://` through `<audio>`). Ogg
  Opus would be about 40% smaller, but there is no maintained pure-JS/WASM Opus encoder we can trust offline, and
  older iOS Safari versions do not play Ogg. MP3 is the safe default.
- Edge silence is trimmed to 120 ms on each side (threshold |sample| < 300). This makes clips start at once and
  saves some size (Gemini's edge silence on real clips has not been measured yet).

### Expected size and time

The inventory is 5,526 clips and ~90k characters, estimated at 0.38 s per word connected / plain, 0.5 s per word
careful, plus edges:

| | estimate |
|---|---|
| audio to generate | ~2.6 h |
| MP3 at 40 kbps | **~45 MB** (48 kbps ~54 MB, 32 kbps ~36 MB) |
| sequential at 10 req/min | ~9.2 h (plus 429 waits) |
| batch | 111 jobs of 50, usually well under 24 h, half price |

CBR makes the size exactly duration × bitrate, so only the duration is an estimate. As soon as at least 10 real
clips exist, `--dry-run` re-estimates from them ("theo các clip đã có"). Start with `--mode sequential --limit 20`
to listen to a few clips and calibrate before the full batch.

## Tests

- `src/core/audioInventory.test.ts` (vitest) checks the following:
  - the shape of the inventory;
  - that every key equals `audioKey(mode, text)`;
  - that every play button's text is covered: dictation, checkup, chunks, lessons and quiz, home, shadowing, decoder
    examples;
  - dedupe;
  - plain (mode-less) clips, the settings sample, the decoder chips shown, Shadowing suggestions, `say` on links;
  - the style-version pin.
- `scripts/generate-audio.test.mjs` (`npm run audio:test`, node:test) runs the generator in-process against a mock
  Gemini on 127.0.0.1 that returns synthetic PCM. It covers:
  - refusing to run without a key or with a foreign base URL;
  - a dry run with no requests;
  - 20 sequential clips through two 429s with `RetryInfo`, with the request body checked (style per mode, voice
    Kore);
  - MP3 frame scan and duration;
  - the manifest;
  - that the key never reaches the log;
  - resume with nothing to do, then with a deleted file and a corrupted file;
  - `--limit` and a too-short clip that is retried once and then recorded as failed (exit 3);
  - a batch job polled to success with one per-request error falling back to a direct request;
  - resuming a submitted batch;
  - a finished job with unreadable results kept for the next run (exit 4, no full-price regeneration);
  - a create call whose answer is lost (503) found again by display name, not resubmitted;
  - a create recorded but never made, dropped and submitted again;
  - temp files from a run cut short removed;
  - a daily quota stopping the run with exit 2;
  - speakers of their own: the request body per clip (voice, accent in the style), an unknown voice refused before
    any request, a key made for another voice refused as a stale inventory, a batch job and a sequential run whose
    requests each carry their clip's voice, `v` in the manifest, the voice kept in `batches.json`.
- `src/core/audioKey.test.ts`: real shipped keys unchanged with no voice / the default voice; a voice or accent
  changes the key; `styleWithAccent`.
- `src/core/tts.voice.test.ts`: `pickSpeakerVoice` (gender from names, natural first, accent language, speakers
  spread, fallback to the learner's voice) and `speak` with a voice (its own shipped clip, never another speaker's,
  the AI request's voice + accent, a non-Gemini provider, a shipped text never paid, auto and prefetch per voice).


  It never calls the real API.
