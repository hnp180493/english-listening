// Shared contracts for the whole app. Every module imports from here.
// Do not change these shapes without updating every consumer.

/** Connected-speech phenomena the app teaches. */
export type Phenomenon =
  | 'linking' // nối âm: turn it off → tur-ni-doff (also /j/ /w/ glides: go on → go-won)
  | 'elision' // nuốt âm: next day → nex day
  | 'assimilation' // đồng hóa: did you → didju, ten boys → tem boys
  | 'weak-form' // âm yếu: to → tə, and → n, can → kən
  | 'flap-t' // T/D giữa nguyên âm (giọng Mỹ): water → wadder, get it → ge-dit
  | 'reduction' // rút gọn: going to → gonna, kind of → kinda
  | 'h-dropping' // mất âm h: tell him → tell-im
  | 'contraction'; // rút gọn có dấu nháy: I am → I'm, he would → he'd

export const PHENOMENA: readonly Phenomenon[] = [
  'linking',
  'elision',
  'assimilation',
  'weak-form',
  'flap-t',
  'reduction',
  'h-dropping',
  'contraction',
] as const;

/** A word token from the input sentence. Punctuation is stripped from `word` but kept in `raw`. */
export interface Token {
  index: number; // position in tokens[]
  raw: string; // as written, may include punctuation: "it,"
  word: string; // lowercase, letters/apostrophes only: "it"
  start: number; // char offset of raw in input
  end: number; // char offset (exclusive)
}

/** One detected connected-speech event spanning tokens[from..to] (inclusive). */
export interface Annotation {
  id: string; // unique within a DecodeResult, e.g. "a3"
  type: Phenomenon;
  from: number; // first token index (inclusive)
  to: number; // last token index (inclusive); from === to for intra-word events (water → wadder)
  original: string; // written words, e.g. "want you"
  spoken: string; // readable respelling, e.g. "wan-chu"
  /** TTS text of just this event (connected, see DecodeResult.speakText): "Tell him" → "Tellim". Set by decode(). */
  speak?: string;
  ipa?: string; // optional IPA, e.g. "/ˈwɑːntʃu/"
  rule: string; // Vietnamese explanation, 1–2 sentences
}

/**
 * Non-overlapping partition of the tokens into spoken chunks, in order.
 * Every token belongs to exactly one segment. A segment groups tokens that
 * are pronounced as one sound-unit (e.g. "want to" → "wanna").
 */
export interface SpokenSegment {
  from: number;
  to: number;
  written: string; // the raw words joined with spaces
  spoken: string; // respelling of how it sounds
  annotationIds: string[]; // annotations touching this segment (may be empty)
  /**
   * TTS text for this chunk as it is said in connected speech: eye dialect an engine reads as intended
   * ("tellim", "gonna", "gedda"), ASCII letters/apostrophes/spaces plus the raw punctuation. Always set by
   * decode(); optional only so hand-built segments still type-check. Fallback: `written`.
   */
  speak?: string;
}

export interface DecodeResult {
  input: string;
  tokens: Token[];
  annotations: Annotation[];
  segments: SpokenSegment[];
  spokenText: string; // the full sentence as it sounds, segments' spoken joined by spaces
  /**
   * The CONNECTED version to send to a TTS engine: the input with each reduction spelled so engines say it
   * ("Whaddaya wanna do?", "Tellim I'll callim back."). Keeps the input's punctuation and spacing; equals the input
   * when nothing changes. Always set by decode(); optional only for hand-built results. Playback: use
   * speakableFor(text, override) from core/decoder, which also applies an authored `say`.
   */
  speakText?: string;
}

export type Level = 1 | 2 | 3; // 1 = dễ (chậm, ngắn), 2 = vừa, 3 = khó (nhanh, nhiều biến âm)

/** A practice sentence used by dictation (and as decoder examples). */
export interface Sentence {
  id: string; // stable, e.g. "s001"
  text: string; // natural written English
  vi: string; // Vietnamese translation
  level: Level;
  topic: string; // short Vietnamese topic label, e.g. "Công việc"
  focus: Phenomenon[]; // main phenomena present (author-labelled)
  say?: string; // optional authored connected TTS text (eye dialect), used instead of decode(text).speakText
}

/** A high-frequency chunk used by the drill module. */
export interface Chunk {
  id: string; // stable, e.g. "c001"
  written: string; // "want to"
  spoken: string; // "wanna"
  ttsText: string; // text fed to TTS to make it sound reduced, often same as spoken
  ipa?: string;
  phenomena: Phenomenon[];
  meaning: string; // Vietnamese meaning / usage note
  example: string; // natural example sentence containing the chunk
  exampleVi: string;
  rank: number; // 1 = most common; drill introduces new cards in rank order
}
