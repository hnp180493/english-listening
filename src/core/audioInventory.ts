// Every clip the built-in content can ask the voice for: the list the Gemini audio generator works from
// (scripts/generate-audio.mjs, docs/audio.md).
//
// The point is that the key built here equals the key the playback router builds at play time (tts.ts →
// audioKey(mode, text), src/core/audioKey.ts). So every text below is derived through the SAME functions the
// play buttons call (connectedPlan / carefulPlan / dictationAudio / chunksOf / quizPlayback / connectedLines /
// wordAudio / buildSteps …). Where a component computes its text inline (ExampleCard, CompareCard, DrillCard,
// PracticePanel, FeedbackView, StepGuide, SpokenSentence, HomePage, PhenomenaGuide), the expression is copied here
// with a comment naming the component; src/core/audioInventory.test.ts pins those copies against the helpers.
//
// Every playback is a clip: 'connected' / 'careful' by its mode, and mode-less playbacks (minimal pairs, word rows
// and word cards, story words, the spelling / irregular / loanwords courses) as 'plain', spoken in the AI voice's
// default style, as tts.ts looks them up (speak() without a mode → audioKey('plain', text)). Dictation "Từng cụm"
// chunks (SpeakOptions.browserOnly) play shipped clips too; only their fallback avoids the paid AI voice.
//
// "Thị trấn" story lines are spoken by their own speakers: each clip carries the speaker's Gemini voice and accent
// (core/town/voices.ts), which are part of its key (audioKey(mode, text, voice)) and of its style (clipStyle). Every
// other clip has no voice of its own: the default Kore, with the key it always had.
//
// Rate is never part of a clip: the player applies playbackRate (pitch preserved) to the same file.
// User content (custom dictation sentences, AI-generated sentences, media transcripts, typed decoder input) is not
// built in and is not listed.
//
// Pure (no DOM, no storage); used by tests and by scripts/audio-inventory.mjs through Vite's module runner.

import { DEFAULT_TTS_STYLE } from './ai/defaults';
import { AUDIO_STYLE_VERSION, AUDIO_VOICE, audioKey, clipVoiceId, isDefaultClipVoice, normalizeAccent, styleWithAccent, type AudioClipMode, type ClipVoice } from './audioKey';
import { decode, speakableFor } from './decoder';
import { PHENOMENON_INFO } from './phenomena';
import { annotationPlayback, CAREFUL_STYLE, carefulPlan, compareCarefulPlan, CONNECTED_STYLE, connectedPlan, connectedText, sayOf, segmentPlayback, writtenText } from './playback';
import type { Chunk, DecodeResult, Sentence, SpokenSegment } from './types';
import { BENCHMARK_FORMS } from '../data/benchmark';
import type { BenchmarkForm } from '../data/benchmarkTypes';
import { CHUNKS } from '../data/chunks';
import type { Lesson, LessonExample } from '../data/lessonTypes';
import { LESSONS } from '../data/lessons';
import { PAIR_SETS, type PairSet } from '../data/pairs';
import { SENTENCES } from '../data/sentences';
import { TOWN_STORIES } from '../data/townStories';
import { RESIDENT_ARCS } from '../data/stories';
import type { ResidentArc, StoryEpisode } from './town/story';
import { lineForms } from './town/storyLines';
import { storyLinePlayback } from './town/storyAudio';
import { connectedLines } from '../features/checkup/useCheckupAudio';
import { DEFAULT_TEXT, EXAMPLE_SAY, EXAMPLES, EXAMPLES_SHOWN } from '../features/decoder/examples';
import { authoredSay } from '../features/decoder/pageModel';
import { chunksOf, dictationAudio, safeDecode, targetTokens } from '../features/dictation/decodeCache';
import { sanitizeChunks } from '../features/drill/chunkData';
import { citationText } from '../features/drill/match';
import { contextSentence, isConnectedSpeechItem, itemSentence } from '../features/lessons/logic';
import { quizPlayback } from '../features/lessons/quizPlayback';
import { wordAudio } from '../features/review/wordModel';
import { chunkSource, CUSTOM_EXAMPLES, resolveSource, sentenceSource, type ShadowSource } from '../features/shadowing/sources';
import { buildSteps } from '../features/shadowing/steps';
import { KID_LINES, SUITORS } from '../data/romance';
import { placeLines, TOWN_PLACES } from '../data/town';
import type { TownLine } from './town/types';
import { CAST_VOICES } from './town/voices';
import { PLAYER_FEMALE, romanceAudioText, romanceVoice, type SceneCast } from './town/romanceAudio';
import { STREET_TALKS } from '../data/streetTalks';
import { CAFE_ORDERS } from '../data/townCafe';
import { TOWN_CASES } from '../data/cases';
import { CITY_CHAPTERS, CITY_OUTINGS, CITY_SCENES } from '../data/city';
import { cityCastVoice, cityLineText, outingVoice } from './town/cityAudio';
import type { CityScene } from './town/cityTypes';
import { DELIVERIES } from '../data/townDeliveries';
import type { DeliveryOrder } from './town/deliveryTypes';
import { caseLineId } from './town/cases';
import type { TownCase } from './town/caseTypes';
import type { CafeOrder } from './town/cafeTypes';
import { streetPlan } from './town/streetTalk';
import type { StreetTalk } from './town/streetTalkTypes';
import type { ChatLine, KidLines, RomanceScene, Suitor } from './town/romanceTypes';

/** Where a clip is played from (first use wins when several share one clip). */
export type ClipSource = 'dictation' | 'decoder' | 'lesson' | 'checkup' | 'chunk' | 'shadowing' | 'home' | 'guide' | 'pairs' | 'words' | 'settings' | 'town';

/**
 * What part of an item a clip is: the main connected playback, its careful twin, one decoder segment / annotation
 * ▶, a dictation "Từng cụm" chunk (SpeakOptions.browserOnly), a shadowing step, or a mode-less playback ('plain':
 * a word, a minimal pair option, an as-written sentence).
 */
export type ClipPart = 'main' | 'careful' | 'plain' | 'segment' | 'annotation' | 'chunk' | 'step';

export interface ClipEntry {
  /** audioKey(mode, text): file public/audio/<key>.mp3 and manifest key. */
  key: string;
  /** Exactly what speak() gets (trimmed). */
  text: string;
  mode: AudioClipMode;
  /**
   * The Gemini delivery style of the mode (CONNECTED_STYLE / CAREFUL_STYLE; undefined = default), as tts.ts styleFor()
   * sends it, with the speaker's accent appended (clipStyle).
   */
  style: string | undefined;
  /** Gemini prebuilt voice of a clip with its own speaker ("Thị trấn"); absent = the default voice (Kore). */
  voice?: string;
  /** Accent note of that speaker (part of the key and of the style); absent = none. */
  accent?: string;
  source: ClipSource;
  ref: string;
  part: ClipPart;
  /** Every place that plays this clip (source:ref), first one = `source` / `ref`. */
  refs: string[];
  sources: ClipSource[];
  /**
   * True when every use is a browser-only playback (dictation "Từng cụm"). The router plays the shipped clip there
   * too; without one it uses the browser voice, never the paid AI voice. Informational only.
   */
  browserOnly: boolean;
}

export interface AudioInventory {
  voice: string;
  styleVersion: number;
  clips: ClipEntry[];
}

/** The content the inventory walks (defaults: the built-in data). Tests pass small fixtures. */
export interface InventoryContent {
  sentences: readonly Sentence[];
  chunks: readonly Chunk[];
  lessons: readonly Lesson[];
  forms: readonly BenchmarkForm[];
  pairs: readonly PairSet[];
  /** Decoder sample chips the page shows (EXAMPLES_SHOWN): the other examples are reachable only by typing them. */
  decoderExamples: readonly string[];
  exampleSay: Readonly<Record<string, string>>;
  /** Phenomenon cheat-sheet examples (decoder page "Các hiện tượng"): connected `say` each. */
  guideSays: readonly string[];
  /** "Thử giọng" sample in Cài đặt: with the Gemini clips it plays connectedText(sample, null, exampleSay[sample]). */
  settingsSample: string;
  /** Shadowing's "Gợi ý" chips (custom tab): practised as custom sources. */
  shadowSuggestions: readonly string[];
  /** "Chuyện ở thị trấn" episodes: every line (each option of a choice, each variant), connected + careful, in its speaker's voice. */
  stories: readonly StoryEpisode[];
  /** The residents' arcs ("Thân thiết"): gift reactions and greetings, in the resident's voice (their episodes are in `stories`). */
  arcs?: readonly ResidentArc[];
  /** Quick chats, on the street too: each place's lines (data/town placeLines) in its resident's voice, both modes. */
  quickChats?: readonly { placeId: string; lines: readonly TownLine[] }[];
  /** Street talks (data/streetTalks): the resident's lines in their voice, both modes; the learner's in both player voices. */
  streetTalks?: readonly StreetTalk[];
  /** "Giao hàng cho Emma" (data/townDeliveries): Emma's words for each order, connected + careful, her voice. */
  deliveries?: readonly DeliveryOrder[];
  /** "Vụ án ở thị trấn" (data/cases): every testimony line in its witness's voice, connected + careful. */
  cases?: readonly TownCase[];
  /**
   * Westbay (data/city, docs/town.md §20): the lines a TOWN resident says in a city scene, connected only, in their own
   * voice. The city's own people speak in the browser's voice and have no clips.
   */
  cityScenes?: readonly CityScene[];
  /**
   * Westbay's outings (data/city/outings): the partner's lines in the voice of every resident who can be courted
   * (`partners`, place ids), the child's in both children's voices; connected only.
   */
  cityOutings?: { scenes: readonly CityScene[]; partners: readonly string[] };
  /** "Phụ quầy cà phê" (data/townCafe): every order in its customer's voice, connected + careful. */
  cafeOrders?: readonly CafeOrder[];
  /** "Hẹn hò, cưới, con": the courtship scenes and the children's (data/romance), each speaker in their own voice. */
  romance?: { suitors: readonly Suitor[]; kids: KidLines };
}

export function defaultInventoryContent(): InventoryContent {
  return {
    sentences: SENTENCES,
    chunks: CHUNKS,
    lessons: LESSONS,
    forms: BENCHMARK_FORMS,
    pairs: PAIR_SETS,
    decoderExamples: EXAMPLES.slice(0, EXAMPLES_SHOWN),
    exampleSay: EXAMPLE_SAY,
    guideSays: Object.values(PHENOMENON_INFO).map((p) => p.example.say),
    // src/features/settings/SettingsPage.tsx SAMPLE = DEFAULT_TEXT
    settingsSample: DEFAULT_TEXT,
    shadowSuggestions: CUSTOM_EXAMPLES,
    stories: TOWN_STORIES,
    arcs: RESIDENT_ARCS,
    quickChats: TOWN_PLACES.map((p) => ({ placeId: p.id, lines: placeLines(p.id) })),
    romance: { suitors: SUITORS, kids: KID_LINES },
    streetTalks: STREET_TALKS,
    cafeOrders: CAFE_ORDERS,
    cases: TOWN_CASES,
    // (and the chapters of the long stories; outings and get-togethers are in the browser's voice)
    cityScenes: [...CITY_SCENES, ...CITY_CHAPTERS],
    cityOutings: { scenes: CITY_OUTINGS, partners: SUITORS.map((s) => s.placeId) },
    deliveries: DELIVERIES,
  };
}

/** The AI style tts.ts styleFor() sends for a mode: what the generator must send too (undefined = default style). */
export function styleForMode(mode: AudioClipMode): string | undefined {
  if (mode === 'connected') return CONNECTED_STYLE;
  if (mode === 'careful') return CAREFUL_STYLE;
  return undefined;
}

/** The style a clip of this mode is made with for a speaker with this accent (tts.ts sends the same to the AI voice). */
export function clipStyle(mode: AudioClipMode, accent?: string | null): string | undefined {
  return styleWithAccent(styleForMode(mode), accent, DEFAULT_TTS_STYLE);
}

/** A text worth a clip: has a letter or digit (a punctuation-only segment would be silence). */
function speakable(text: string | null | undefined): text is string {
  return typeof text === 'string' && /[\p{L}\p{N}]/u.test(text);
}

/** SpokenSentence getSegments(): the decoder segments, else one block per token. */
export function displaySegments(result: DecodeResult): SpokenSegment[] {
  if (result.segments.length > 0) return result.segments;
  return result.tokens.map((t) => ({ from: t.index, to: t.index, written: t.raw, spoken: t.raw, annotationIds: [] }));
}

/** ExampleCard (lessons/Blocks.tsx) wordsOf: words lowercased, doubled letters single. */
const wordsOf = (s: string) => (s.toLowerCase().match(/[a-z']+/g) ?? []).join(' ').replace(/([a-z])\1/g, '$1');

/** ExampleCard: are the segment ▶ buttons shown (they would contradict an authored `say` that reads differently)? */
export function exampleSegmentsPlayable(example: LessonExample, result: DecodeResult, connected: boolean): boolean {
  return (
    connected &&
    (!example.say?.trim() ||
      wordsOf(connectedText(example.text, result, example.say)) === wordsOf(result.segments.map((g) => g.speak ?? g.written).join(' ')))
  );
}

/** Collects clips, deduped by key. */
class Collector {
  private byKey = new Map<string, ClipEntry>();

  /** A playback; `modeIn` undefined = mode-less (speak() without a mode): a 'plain' clip. */
  add(
    source: ClipSource,
    ref: string,
    part: ClipPart,
    modeIn: AudioClipMode | undefined,
    raw: string | null | undefined,
    browserOnly = false,
    voice?: ClipVoice | null,
  ): void {
    if (!speakable(raw)) return;
    const text = raw.trim();
    const mode: AudioClipMode = modeIn ?? 'plain';
    const key = audioKey(mode, text, voice);
    const at = `${source}:${ref}`;
    const hit = this.byKey.get(key);
    if (hit) {
      const same = hit.text === text && hit.mode === mode && clipVoiceId(hit.voice ? { voice: hit.voice, accent: hit.accent } : null) === clipVoiceId(voice);
      if (!same) throw new Error(`audio key collision: ${key} (${hit.text} / ${text})`);
      if (!hit.refs.includes(at)) hit.refs.push(at);
      if (!hit.sources.includes(source)) hit.sources.push(source);
      hit.browserOnly &&= browserOnly;
      return;
    }
    const own = isDefaultClipVoice(voice) ? null : voice;
    const accent = normalizeAccent(own?.accent);
    const entry: ClipEntry = { key, text, mode, style: clipStyle(mode, accent), source, ref, part, refs: [at], sources: [source], browserOnly };
    if (own) entry.voice = own.voice.trim();
    if (accent) entry.accent = accent;
    this.byKey.set(key, entry);
  }

  /** A mode-less playback (speak(text) with no mode). */
  addPlain(source: ClipSource, ref: string, raw: string | null | undefined): void {
    this.add(source, ref, 'plain', 'plain', raw);
  }

  result(): AudioInventory {
    return { voice: AUDIO_VOICE, styleVersion: AUDIO_STYLE_VERSION, clips: [...this.byKey.values()] };
  }
}

/** Segment ▶ (SpokenSentence playable) and annotation ▶ (decoder AnnotationCard / dictation WhyWrong + card). */
function addDecodedParts(c: Collector, source: ClipSource, ref: string, result: DecodeResult, o: { segments: boolean; annotations: boolean }): void {
  // buttons that would contradict the screen are hidden (playback.segmentPlayback / annotationPlayback): no clip
  if (o.segments) displaySegments(result).forEach((seg, i) => c.add(source, `${ref}#seg${i}`, 'segment', 'connected', segmentPlayback(seg)));
  if (o.annotations) {
    for (const a of result.annotations) c.add(source, `${ref}#ann:${a.id}`, 'annotation', 'connected', annotationPlayback(a, result.segments));
  }
}

function addDictation(c: Collector, sentences: readonly Sentence[]): void {
  for (const s of sentences) {
    // Exercise / ClozeExercise → usePlayer playbackFor(): 'normal' + 'slow' = connected, 'careful' = written text
    const audio = dictationAudio(s);
    c.add('dictation', s.id, 'main', 'connected', audio.connected);
    c.add('dictation', s.id, 'careful', 'careful', audio.careful);
    const decoded = safeDecode(s.text);
    // "Từng cụm": speak(chunk, { mode: 'connected', browserOnly: true }) (shipped clip, else the browser voice)
    chunksOf(decoded, targetTokens(decoded, s.text)).forEach((chunk, i) => c.add('dictation', `${s.id}#chunk${i}`, 'chunk', 'connected', chunk, true));
    // WhyWrong / AnnotationCard "Nghe": annotationSpeech(a, decoded.segments); the SpokenSentence is not playable here
    addDecodedParts(c, 'dictation', s.id, decoded, { segments: false, annotations: true });
  }
}

/** DecoderPage: ListenPair(query, result, say) + playable SpokenSentence + AnnotationList speechFor. */
function addDecoderText(c: Collector, ref: string, text: string, say: string | undefined): void {
  const result = safeDecode(text);
  c.add('decoder', ref, 'main', 'connected', connectedPlan(text, result, say).text);
  c.add('decoder', ref, 'careful', 'careful', carefulPlan(text).text);
  addDecodedParts(c, 'decoder', ref, result, { segments: true, annotations: true });
}

function addDecoder(c: Collector, content: InventoryContent): void {
  // the sample chips shown (picked = null): say from EXAMPLE_SAY
  content.decoderExamples.forEach((ex, i) => addDecoderText(c, `example${i}`, ex, authoredSay(ex, content.exampleSay, null)));
  for (const s of content.sentences) {
    // "Câu ngẫu nhiên" (picked = the sentence): its own say
    addDecoderText(c, s.id, s.text, authoredSay(s.text, content.exampleSay, s));
    // a link (#/decoder?text=…, from Home / Shadowing) opens with picked = null: the say of the built-in sentence
    // with the same words (authoredSay's builtIn list, as DecoderPage passes SENTENCES)
    addDecoderText(c, `${s.id}#link`, s.text, authoredSay(s.text, content.exampleSay, null, content.sentences));
  }
  // Shadowing's "Giải mã câu này" link on a chunk example
  for (const ch of content.chunks) {
    if (ch.example?.trim()) addDecoderText(c, `${ch.id}#link`, ch.example, authoredSay(ch.example, content.exampleSay, null, content.sentences));
  }
  // ... and on a Shadowing suggestion chip (practised as a custom source)
  content.shadowSuggestions.forEach((t, i) => addDecoderText(c, `suggest${i}#link`, t, authoredSay(t, content.exampleSay, null, content.sentences)));
  // PhenomenaGuide: SpeakIconButton(info.example.say, mode connected)
  content.guideSays.forEach((say, i) => c.add('guide', `phenomenon${i}`, 'main', 'connected', say));
}

function addLessons(c: Collector, lessons: readonly Lesson[]): void {
  for (const lesson of lessons) {
    const connected = lesson.course === 'connected';
    lesson.sections.forEach((section, si) =>
      section.blocks.forEach((block, bi) => {
        const ref = `${lesson.id}/s${si}b${bi}`;
        switch (block.type) {
          case 'examples':
            block.items.forEach((ex, ei) => {
              // ExampleCard → ListenButtons → ListenPair (asWritten = !connected) + SpokenSentence playable
              const r = `${ref}e${ei}`;
              const result = decode(ex.text);
              if (connected) c.add('lesson', r, 'main', 'connected', connectedPlan(ex.text, result, ex.say).text);
              else c.addPlain('lesson', r, writtenText(ex.text, ex.say));
              c.add('lesson', r, 'careful', 'careful', carefulPlan(ex.text).text);
              addDecodedParts(c, 'lesson', r, result, { segments: exampleSegmentsPlayable(ex, result, connected), annotations: false });
            });
            break;
          case 'compare': {
            // CompareCard: careful = compareCarefulPlan(clear); natural = connectedPlan(natural, decode, ttsText ?? say)
            c.add('lesson', `${ref}clear`, 'careful', 'careful', compareCarefulPlan(block.clear).text);
            if (connected) c.add('lesson', `${ref}natural`, 'main', 'connected', connectedPlan(block.natural, decode(block.natural), block.ttsText ?? block.say).text);
            else c.addPlain('lesson', `${ref}natural`, writtenText(block.natural, block.say));
            break;
          }
          case 'words':
            // WordRow → WordListen(contextSentence ?? word): mode-less
            block.items.forEach((it, wi) => {
              c.addPlain('words', `${ref}w${wi}`, contextSentence(it.word, it.say) ?? it.word);
              // Ôn tập word card (review/items/WordItem): wordAudio(item).text, mode-less
              c.addPlain('words', `${ref}w${wi}#card`, wordAudio(it).text);
            });
            break;
          case 'story':
            (block.words ?? []).forEach((w, wi) => c.addPlain('words', `${ref}story${wi}`, w));
            break;
          default:
            break;
        }
      }),
    );
    lesson.quiz.forEach((item, qi) => {
      const ref = `${lesson.id}/q${qi}`;
      // before answering: QuizListen + auto-play (quizPlayback)
      const play = quizPlayback(item, lesson.course);
      if (play) {
        if (play.mode) c.add('lesson', ref, 'main', play.mode, play.text);
        else c.addPlain('lesson', ref, play.text);
      }
      // Feedback: connected items → ListenPair(sentence, decode, sayOverride); others → WordListen(sentence)
      const sentence = itemSentence(item);
      if (isConnectedSpeechItem(item, lesson.course)) {
        const result = decode(sentence);
        if (result.tokens.length > 0) {
          const sayOverride = item.type === 'listen-choose' ? item.say : undefined;
          c.add('lesson', `${ref}#feedback`, 'main', 'connected', connectedPlan(sentence, result, sayOverride).text);
          c.add('lesson', `${ref}#feedback`, 'careful', 'careful', carefulPlan(sentence).text);
        }
      } else if (sentence.trim()) {
        c.addPlain('lesson', `${ref}#feedback`, sentence);
      }
    });
  }
}

function addCheckup(c: Collector, forms: readonly BenchmarkForm[]): void {
  for (const form of forms) {
    // CheckupTest / CheckupResultView → useCheckupAudio().play → connectedLines(lines, say), one clip per line
    for (const s of form.sentences) connectedLines([s.text], sayOf(s)).forEach((t) => c.add('checkup', s.id, 'main', 'connected', t));
    for (const q of form.questions) connectedLines(q.lines, q.say).forEach((t, i) => c.add('checkup', `${q.id}#line${i}`, 'main', 'connected', t));
  }
}

function addChunks(c: Collector, chunks: readonly Chunk[]): void {
  // DrillPage uses sanitizeChunks(CHUNKS); DrillCard / ChunkList ListenIcon / FocusPanels
  for (const ch of sanitizeChunks(chunks)) {
    c.add('chunk', ch.id, 'main', 'connected', ch.ttsText);
    if (ch.example) c.add('chunk', `${ch.id}#example`, 'main', 'connected', speakableFor(ch.example));
    c.add('chunk', ch.id, 'careful', 'careful', citationText(ch.written));
  }
}

function addStories(c: Collector, stories: readonly StoryEpisode[], arcs: readonly ResidentArc[]): void {
  // Thị trấn conversation: storyLinePlayback(line, episode, mode) → speak(text, { mode, voice }), both modes; a
  // choice line is said as each of its options (the player's voice), a line with variants also as each variant
  const say = (line: Parameters<typeof storyLinePlayback>[0] & { id: string }, placeId: string) => {
    if (!line.text.trim()) return;
    for (const mode of ['connected', 'careful'] as const) {
      const p = storyLinePlayback(line, { placeId }, mode);
      c.add('town', line.id, mode === 'careful' ? 'careful' : 'main', p.mode, p.text, false, p.voice);
    }
  };
  for (const ep of stories) for (const line of ep.lines) for (const form of lineForms(line)) say(form, ep.placeId);
  // "Thân thiết": a resident's reaction to a gift and their greetings (features/town: GiftGive, useGreeting)
  for (const arc of arcs) {
    for (const line of Object.values(arc.reactions)) say(line, arc.placeId);
    for (const line of arc.greetings) say(line, arc.placeId);
  }
}

/**
 * "Hẹn hò, cưới, con" (docs/town.md §15, features/town/romance/StoryChat): every spoken line of the courtship scenes
 * in its speaker's voice (core/town/romanceAudio romanceVoice; a called-out name left out, romanceAudioText), and the
 * children's scenes once per spouse (their voice, and so the learner's character's) and per child's sex.
 */
function addQuickChats(c: Collector, quick: NonNullable<InventoryContent['quickChats']>): void {
  // Conversation: quickChatVoice(placeId, line) → speak(dictationAudio(line) …, { voice })
  for (const { placeId, lines } of quick) {
    const voice = CAST_VOICES[placeId];
    if (!voice) continue;
    for (const line of lines) {
      const a = dictationAudio(line);
      c.add('town', `${line.id}@${placeId}`, 'main', 'connected', a.connected, false, voice);
      c.add('town', `${line.id}@${placeId}`, 'careful', 'careful', a.careful, false, voice);
    }
  }
}

function addStreetTalks(c: Collector, talks: readonly StreetTalk[]): void {
  // Conversation (a street talk): the resident's line as a quick chat line (dictationAudio, both modes, their voice);
  // the learner's line before it (turn.before) said as written in the character's voice, a man's or a woman's
  for (const talk of talks) {
    const voice = CAST_VOICES[talk.placeId];
    for (const p of streetPlan(talk)) {
      if (voice) {
        const a = dictationAudio(p.line);
        c.add('town', p.line.id, 'main', 'connected', a.connected, false, voice);
        c.add('town', p.line.id, 'careful', 'careful', a.careful, false, voice);
      }
      if (p.before) for (const v of [CAST_VOICES.player, PLAYER_FEMALE]) c.add('town', `${p.line.id}#you`, 'main', 'connected', p.before.text, false, v);
    }
  }
}

function addDeliveries(c: Collector, orders: readonly DeliveryOrder[]): void {
  // DeliveryPanel sayDelivery(order): dictationAudio({ text, level }).connected in Emma's voice; the result card shows
  // the decoded line, and "Rõ từng từ" is not offered there, so connected only
  const voice = CAST_VOICES.cafe;
  if (!voice) return;
  for (const o of orders) c.add('town', o.id, 'main', 'connected', dictationAudio({ text: o.text, level: o.level }).connected, false, voice);
}

function addCityScenes(c: Collector, scenes: readonly CityScene[]): void {
  // CityScenePanel → cityLinePlayback(line, level): a town resident's line in their own voice, connected (the careful
  // version is read by the browser's voice: no clip)
  for (const s of scenes) {
    s.lines.forEach((line, i) => {
      const voice = cityCastVoice(line.who);
      if (voice) c.add('town', `${s.id}-${i + 1}`, 'main', 'connected', cityLineText(line, s.level), false, voice);
    });
  }
}

function addCityOutings(c: Collector, { scenes, partners }: NonNullable<InventoryContent['cityOutings']>): void {
  // CityScenePanel → cityLinePlayback(line, level, false, { partner, kid }): the partner in their voice, the child in a
  // child's; the host and anybody else of the city are the browser's
  for (const s of scenes) {
    s.lines.forEach((line, i) => {
      const casts = line.who === 'partner' ? partners.map((partner) => ({ partner })) : line.who === 'kid' ? (['boy', 'girl'] as const).map((kid) => ({ kid })) : [];
      for (const cast of casts) {
        const voice = outingVoice(line.who as 'partner' | 'kid', cast);
        if (voice) c.add('town', `${s.id}-${i + 1}`, 'main', 'connected', cityLineText(line, s.level), false, voice);
      }
    });
  }
}

function addCases(c: Collector, cases: readonly TownCase[]): void {
  // CasePanel sayLine(placeId, line, level, careful): dictationAudio({ text, level }) in the witness's voice
  for (const cs of cases) {
    cs.chapters.forEach((ch, ci) =>
      ch.testimonies.forEach((t, ti) => {
        const voice = CAST_VOICES[t.placeId];
        if (!voice) return;
        t.lines.forEach((line, li) => {
          const a = dictationAudio({ text: line.text, level: cs.level });
          const ref = caseLineId(cs.id, ci, ti, li);
          c.add('town', ref, 'main', 'connected', a.connected, false, voice);
          c.add('town', ref, 'careful', 'careful', a.careful, false, voice);
        });
      }),
    );
  }
}

function addCafe(c: Collector, orders: readonly CafeOrder[]): void {
  // CafePanel sayOrder(order, careful): dictationAudio(order) connected / careful in the customer's voice (the old cast
  // always speaks in its Gemini voice: owner, 2026-11-24)
  for (const o of orders) {
    const voice = CAST_VOICES[o.placeId];
    if (!voice) continue;
    const a = dictationAudio(o);
    c.add('town', o.id, 'main', 'connected', a.connected, false, voice);
    c.add('town', o.id, 'careful', 'careful', a.careful, false, voice);
  }
}

function addRomance(c: Collector, { suitors, kids }: NonNullable<InventoryContent['romance']>): void {
  const sayScene = (scene: RomanceScene, cast: SceneCast) => {
    const lines: { line: ChatLine; ref: string }[] = scene.lines.map((line, i) => ({ line, ref: `${scene.id}#${i}` }));
    for (const o of scene.choice?.options ?? []) {
      lines.push({ line: { who: 'you', en: o.en, vi: o.vi }, ref: o.id });
      o.reply.forEach((line, i) => lines.push({ line, ref: `${o.id}#${i}` }));
    }
    for (const { line, ref } of lines) {
      const voice = romanceVoice(line.who, cast);
      const text = line.en ? romanceAudioText(line.en) : null;
      if (voice && text) c.add('town', ref, 'main', 'connected', text, false, voice);
    }
  };
  for (const s of suitors) {
    for (const scene of [s.confess, ...s.dates, s.proposal, s.vows, ...s.daily]) sayScene(scene, { placeId: s.placeId });
    for (const kid of ['boy', 'girl'] as const) for (const scene of [...kids.baby, ...kids.toddler, ...kids.child]) sayScene(scene, { placeId: s.placeId, kid });
  }
}

function addShadowing(c: Collector, sentences: readonly Sentence[], chunks: readonly Chunk[], suggestions: readonly string[]): void {
  // SourcePicker: a suggestion chip fills the custom box; starting turns it into resolveSource({ text })
  const suggested = suggestions.map((text) => resolveSource({ text }, sentences, chunks)).filter((s): s is ShadowSource => !!s);
  const sources: ShadowSource[] = [...sentences.map(sentenceSource), ...chunks.map(chunkSource), ...suggested];
  for (const src of sources) {
    if (!src.text?.trim()) continue;
    const ref = src.itemId;
    const result = decode(src.text);
    // PracticePanel: model = connectedText(text, result, sayOf(source)); "Rõ từng từ" = source.text (careful)
    c.add('shadowing', ref, 'main', 'connected', connectedText(src.text, result, sayOf(src)));
    c.add('shadowing', ref, 'careful', 'careful', src.text);
    // StepGuide: each step's speak, then the whole sentence connectedText(result.input, result)
    buildSteps(result).forEach((st, i) => c.add('shadowing', `${ref}#step${i}`, 'step', 'connected', st.speak));
    c.add('shadowing', `${ref}#steps`, 'main', 'connected', connectedText(result.input, result));
    // FeedbackView: a.speak || a.original || a.spoken per missed annotation
    for (const a of result.annotations) c.add('shadowing', `${ref}#ann:${a.id}`, 'annotation', 'connected', a.speak?.trim() || a.original || a.spoken);
  }
}

/** Every clip the built-in content can request, deduped (see the header). */
export function buildAudioInventory(content: InventoryContent = defaultInventoryContent()): AudioInventory {
  const c = new Collector();
  addDictation(c, content.sentences);
  addCheckup(c, content.forms);
  addLessons(c, content.lessons);
  addChunks(c, content.chunks);
  // HomePage SentenceOfDay: connectedText(text, null, say) (any sentence can be picked)
  for (const s of content.sentences) c.add('home', s.id, 'main', 'connected', connectedText(s.text, null, s.say));
  addShadowing(c, content.sentences, content.chunks, content.shadowSuggestions);
  addDecoder(c, content);
  // minimal pairs (RoundView / RoundResults): speak(option, { rate }), mode-less
  for (const set of content.pairs) for (const item of set.items) item.options.forEach((o, i) => c.addPlain('pairs', `${item.id}#${i}`, o));
  // SettingsPage "Thử giọng" with the Gemini clips: the connected sample (the same clip as decoder example 0)
  c.add('settings', 'sample', 'main', 'connected', connectedText(content.settingsSample, null, content.exampleSay[content.settingsSample]));
  addStories(c, content.stories, content.arcs ?? []);
  if (content.quickChats) addQuickChats(c, content.quickChats);
  if (content.romance) addRomance(c, content.romance);
  if (content.streetTalks) addStreetTalks(c, content.streetTalks);
  if (content.cafeOrders) addCafe(c, content.cafeOrders);
  if (content.cases) addCases(c, content.cases);
  if (content.cityScenes) addCityScenes(c, content.cityScenes);
  if (content.cityOutings) addCityOutings(c, content.cityOutings);
  // (the "cảnh nghe" of data/scenes are not here: they are heard for fun, in the browser's voice only: docs/town.md §19)
  if (content.deliveries) addDeliveries(c, content.deliveries);
  return c.result();
}

export interface InventoryCounts {
  clips: number;
  chars: number;
  words: number;
  byMode: Record<AudioClipMode, { clips: number; chars: number }>;
  /** Clips by their first source (each clip counted once). */
  bySource: Partial<Record<ClipSource, { clips: number; chars: number }>>;
  byPart: Partial<Record<ClipPart, { clips: number; chars: number }>>;
  browserOnly: { clips: number; chars: number };
  /** Clips by speaker voice (clipVoiceId: 'gemini-kore' = the default voice). */
  byVoice: Record<string, { clips: number; chars: number }>;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function inventoryCounts(inv: AudioInventory): InventoryCounts {
  const bump = <K extends string>(rec: Partial<Record<K, { clips: number; chars: number }>>, k: K, n: number) => {
    const r = (rec[k] ??= { clips: 0, chars: 0 });
    r.clips++;
    r.chars += n;
  };
  const out: InventoryCounts = {
    clips: inv.clips.length,
    chars: 0,
    words: 0,
    byMode: { connected: { clips: 0, chars: 0 }, careful: { clips: 0, chars: 0 }, plain: { clips: 0, chars: 0 } },
    bySource: {},
    byPart: {},
    browserOnly: { clips: 0, chars: 0 },
    byVoice: {},
  };
  for (const e of inv.clips) {
    out.chars += e.text.length;
    out.words += wordCount(e.text);
    bump(out.byMode, e.mode, e.text.length);
    bump(out.bySource, e.source, e.text.length);
    bump(out.byPart, e.part, e.text.length);
    bump(out.byVoice, clipVoiceId(e.voice ? { voice: e.voice, accent: e.accent } : null), e.text.length);
    if (e.browserOnly) {
      out.browserOnly.clips++;
      out.browserOnly.chars += e.text.length;
    }
  }
  return out;
}
