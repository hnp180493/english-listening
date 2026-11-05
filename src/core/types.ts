// Shared contracts for the whole app. Every module imports from here.
// Do not change these shapes without updating every consumer.

/** Connected-speech phenomena the app teaches. */
export type Phenomenon =
  | 'linking' // nối âm: turn it off → tur-ni-toff (also /j/ /w/ glides: go on → go-won)
  | 'elision' // nuốt âm: next day → nex day
  | 'assimilation' // đồng hóa: did you → didju, ten boys → tem boys
  | 'weak-form' // âm yếu: to → tə, and → n, can → kən
  | 'flap-t' // T/D giữa nguyên âm (giọng Mỹ): water → wader, get it → ge-dit
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
  to: number; // last token index (inclusive); from === to for intra-word events (water → wader)
  original: string; // written words, e.g. "want you"
  spoken: string; // readable respelling, e.g. "wan-chu"
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
}

export interface DecodeResult {
  input: string;
  tokens: Token[];
  annotations: Annotation[];
  segments: SpokenSegment[];
  spokenText: string; // the full sentence as it sounds, segments' spoken joined by spaces
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
