// What each listen button sends to the voice (browser speechSynthesis or the AI voice, src/core/tts.ts).
//
// The app SHOWS how a sentence is really spoken ("whaddaya wanna do"), so the main "Nghe" must SOUND like that.
// A TTS engine fed the standard spelling reads like a newsreader (measured: SAPI realised 0/2 reductions on
// "Tell him I'll call him back.", 2/2 on "Tellim I'll callim back."). So there are two playback modes:
//
//  - 'connected' (main "Nghe", dictation audio, checkup): the speakable spelling of how it sounds —
//    the authored `say` override, else the decoder's DecodeResult.speakText, else the written text —
//    at the normal rate; the AI voice gets CONNECTED_STYLE.
//  - 'careful' (turtle "Đọc rõ từng từ"): the STANDARD written text, slower (CAREFUL_RATE); the AI voice
//    gets CAREFUL_STYLE. A deliberate contrast, so the learner hears what the reductions replace.
//
// Pure module: the plan functions below are what the components call, and what the tests check. The connected
// spelling itself comes from the decoder (speakableFor / DecodeResult.speakText, src/core/decoder).

import { speakableFor } from './decoder';
import { getSettings } from './settings';

export type SpeechMode = 'connected' | 'careful';

/**
 * AI voice delivery style for connected playback. The connected spelling (speakableFor) already forces the
 * reductions; the style keeps them natural. Pace (owner, 2026-11-07): the default is a real native speaker's
 * normal conversational speed — not exaggerated "fast", not slowed for learners. Learners who want it slower
 * lower Settings → Tốc độ đọc (playbackRate with pitch kept) or use "Chậm" / "Rõ từng từ".
 */
export const CONNECTED_STYLE =
  'relaxed, casual American English at the normal speed a native speaker talks to a friend: natural, not slowed ' +
  'down for learners and not rushed; connected speech: words flow into each other, function words reduced ' +
  '(gonna, wanna, whaddaya), the t between vowels flapped, the h in him/her dropped; no pauses between words and ' +
  'no over-enunciation';

/** AI voice delivery style for careful playback: every word in full, the contrast to CONNECTED_STYLE. */
export const CAREFUL_STYLE =
  'clear, careful, slightly slow American English, like a teacher reading to a learner: say every word fully and ' +
  'separately, no reductions';

/** Rate of careful playback ("Đọc rõ từng từ"): slower than normal speech, standard text (capped: see slowRate). */
export const CAREFUL_RATE = 0.75;
/** Rate of dictation's "Chậm" / the quiz turtle: still the connected version, only slower (capped: see slowRate). */
export const CONNECTED_SLOW_RATE = 0.75;
/** A slow playback is at most this fraction of the learner's own rate, so it is never faster than "Nghe". */
export const SLOW_FACTOR = 0.8;
/**
 * Careful AI clips are generated with CAREFUL_STYLE ("slightly slow") already: played at 0.75 on top they were
 * slowed twice. With the AI voice the careful clip plays at about this rate (still ≤ 0.9 × the learner's rate).
 */
export const AI_CAREFUL_RATE = 0.9;

/**
 * The rate a playback really uses. `requested` undefined = the learner's rate (`base`). A SLOW playback (careful
 * mode, or `slow` for a slowed connected playback) is never faster than base × SLOW_FACTOR, so a learner who set
 * 0.6 does not get "Rõ từng từ" faster than "Nghe"; a careful AI clip plays at about AI_CAREFUL_RATE instead of
 * the browser's CAREFUL_RATE (its style already slows it). Used by speak() in tts.ts.
 */
export function slowRate(
  requested: number | undefined,
  base: number,
  o: { mode?: SpeechMode; slow?: boolean; engine?: 'browser' | 'ai' } = {},
): number {
  let r = requested ?? base;
  const slow = o.slow ?? o.mode === 'careful';
  if (!slow) return r;
  const aiCareful = o.engine === 'ai' && o.mode === 'careful';
  if (aiCareful) r = Math.max(r, AI_CAREFUL_RATE);
  r = Math.min(r, base * (aiCareful ? AI_CAREFUL_RATE : SLOW_FACTOR));
  return Math.round(r * 100) / 100;
}
/** Dictation level 1 (dễ) plays the connected version a little slower than the learner's rate. */
export const LEVEL1_RATE_FACTOR = 0.9;

/** Tooltips / accessible names of the two modes (shown wherever both buttons sit side by side). */
export const CONNECTED_TITLE = 'Nói nhanh như ngoài đời';
export const CAREFUL_TITLE = 'Đọc rõ từng từ';
/** The one visible label and accessible name of every careful button (same words everywhere, docs/design-system.md). */
export const CAREFUL_LABEL = 'Rõ từng từ';
export const CAREFUL_ARIA = 'Rõ từng từ: đọc chuẩn, chậm';
/** Title / accessible name of a slowed CONNECTED button (dictation "Chậm", quiz turtle): not the careful version. */
export const CONNECTED_SLOW_TITLE = 'Nghe chậm (vẫn nối âm)';

/**
 * Anything that may carry the decoder's speakable text: a DecodeResult (its `speakText`, read structurally so this
 * works whether or not the field exists on the type). `object`, not `{ speakText?: string }`, because a weak type
 * would reject a DecodeResult that has no `speakText` yet.
 */
export type MaybeSpeakable = object;

function nonEmpty(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * The text connected playback speaks: the authored `say` override (run through the decoder like any text, which
 * leaves eye dialect unchanged: speakableFor), else the given decode result's speakText, else speakableFor(text)
 * (decodes it). Blank overrides are ignored; never throws (falls back to the written text).
 */
export function connectedText(text: string, decoded?: MaybeSpeakable | null, say?: string | null): string {
  try {
    if (nonEmpty(say)) return speakableFor(text, say).trim() || say.trim();
    const generated = (decoded as { speakText?: unknown } | null | undefined)?.speakText;
    if (nonEmpty(generated)) return generated.trim();
    return speakableFor(text).trim() || text;
  } catch {
    return nonEmpty(say) ? say.trim() : text;
  }
}

/** The authored `say` override of a content object, when it has one (lesson example, decoder example …). */
export function sayOf(item: object | null | undefined): string | undefined {
  const s = (item as { say?: unknown } | null | undefined)?.say;
  return nonEmpty(s) ? s : undefined;
}

/** The speakable form of one decoder segment (SpokenSegment.speak once the decoder fills it), else its words. */
export function segmentSpeech(seg: { written: string; speak?: string }): string {
  return nonEmpty(seg.speak) ? seg.speak.trim() : seg.written;
}

/**
 * What an annotation's ▶ speaks: the annotation's own connected form (Annotation.speak, from the decoder: its words
 * only, widened just enough not to cut a joined chunk, e.g. "I'll" alone, "Tell him" → "Tellim"), else the
 * speakable forms of the segments it touches, else its written words. `segments` are the decoder's SpokenSegments.
 */
export function annotationSpeech(
  a: { from: number; to: number; original: string; speak?: string },
  segments: readonly { from: number; to: number; written: string; speak?: string }[],
): string {
  if (nonEmpty(a.speak)) return a.speak.trim();
  const touched = segments.filter((s) => s.to >= a.from && s.from <= a.to);
  const hasSpeak = (s: { speak?: string }) => typeof s.speak === 'string' && !!s.speak.trim();
  if (touched.length === 0 || !touched.some(hasSpeak)) return a.original;
  const spoken = touched.map((s) => (typeof s.speak === 'string' && s.speak.trim() ? s.speak.trim() : s.written));
  return spoken.join(' ');
}

/**
 * Function words whose weak (reduced) form only exists inside a phrase. Said alone, any voice gives the strong
 * citation form ("the" → /ðiː/, "to" → /tuː/), the opposite of the "thə" / "tə" the screen shows.
 */
const WEAK_FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'for', 'from', 'at', 'as', 'and', 'or', 'but', 'than', 'that',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'can', 'could', 'would', 'should', 'will', 'shall', 'must',
  'do', 'does', 'did', 'have', 'has', 'had', 'you', 'your', 'he', 'him', 'his', 'her', 'she', 'we', 'us', 'me',
  'them', 'they', 'there', 'some', 'just', 'into', 'on', 'in', 'up',
]);

const bare = (s: string) => s.toLowerCase().replace(/[^a-z']/g, '');

/**
 * True when a ▶ would contradict what the screen shows: it would speak one weak-form function word on its own
 * (exactly as written) while a reduced form is displayed. Such buttons are hidden: the learner hears the reduction
 * in the sentence's "Nghe" instead of a citation form that teaches the opposite.
 */
export function contradictsShown(speech: string, written: string, shown: string): boolean {
  const words = speech.trim().split(/\s+/).filter(Boolean);
  if (words.length !== 1) return false;
  const w = bare(speech);
  return w === bare(written) && WEAK_FUNCTION_WORDS.has(w) && bare(shown) !== w;
}

/** segmentSpeech, or null when that ▶ would contradict the segment shown (contradictsShown): hide the button. */
export function segmentPlayback(seg: { written: string; spoken: string; speak?: string }): string | null {
  const speech = segmentSpeech(seg);
  return contradictsShown(speech, seg.written, seg.spoken) ? null : speech;
}

/** annotationSpeech, or null when that ▶ would contradict the annotation shown (contradictsShown): hide the button. */
export function annotationPlayback(
  a: { from: number; to: number; original: string; spoken: string; speak?: string },
  segments: readonly { from: number; to: number; written: string; speak?: string }[],
): string | null {
  const speech = annotationSpeech(a, segments);
  return contradictsShown(speech, a.original, a.spoken) ? null : speech;
}

/**
 * Rate of a "natural speed" playback (drill chunks, shadowing model, annotation ▶): the learner's Settings rate,
 * slower or faster (0,5×–1,5×), so one setting governs every normal-speed button. The dedicated slow / careful
 * buttons keep their own rates; the checkup keeps CHECKUP_RATE.
 */
export function naturalRate(): number {
  const r = getSettings().rate;
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 1;
}

/** One playback: what speak() gets. `rate` undefined = the learner's rate from Settings. */
export interface PlaybackPlan {
  text: string;
  mode: SpeechMode;
  rate?: number;
}

/**
 * The text "Nghe" sends for content shown AS WRITTEN (courses spelling / irregular / loanwords): the authored `say`
 * (a heteronym's context sentence …) or the text itself, never respelled. Joining "I thought you" into
 * "thoughtcha" would blur the very word those lessons teach.
 */
export function writtenText(text: string, say?: string | null): string {
  return nonEmpty(say) ? say.trim() : text;
}

/** Main "Nghe": connected version at the normal (or given) rate. */
export function connectedPlan(text: string, decoded?: MaybeSpeakable | null, say?: string | null, rate?: number): PlaybackPlan {
  return { text: connectedText(text, decoded, say), mode: 'connected', rate };
}

/** Turtle "Đọc rõ từng từ": the standard written text, slower. */
export function carefulPlan(text: string, rate: number = CAREFUL_RATE): PlaybackPlan {
  return { text, mode: 'careful', rate };
}

/**
 * The careful button of a lesson compare card (left column "Đọc rõ từng từ"): the plain written `clear` sentence,
 * like every other careful button. It used to send a comma-separated citation form ("Is, this, your, bag."), which
 * dropped a question's rise and made the same words a second, different careful clip (an extra AI clip to generate
 * and ship). Slowness comes from CAREFUL_RATE / CAREFUL_STYLE, not from commas.
 */
export function compareCarefulPlan(clear: string, rate: number = CAREFUL_RATE): PlaybackPlan {
  return carefulPlan(clear.trim(), rate);
}

/** Rate of a dictation sentence's normal playback: level 1 a little slower, still connected. */
export function dictationRate(baseRate: number, level?: number): number {
  return level === 1 ? Math.round(baseRate * LEVEL1_RATE_FACTOR * 100) / 100 : baseRate;
}

/**
 * YouGlish matches exact phrases in real videos: past this many words a phrase rarely has clips ("Tell him I'll
 * call him back" finds few; "call him back" many).
 */
export const YOUGLISH_MAX_WORDS = 4;
/** A phrase shorter than this is widened by a neighbouring word ("him" alone finds anything). */
const YOUGLISH_MIN_WORDS = 2;

/**
 * The phrase to look up on YouGlish: the whole text when it has at most YOUGLISH_MAX_WORDS words, else the stretch
 * of the first multi-word annotation (where the connected speech happens; the first annotation when none spans
 * words), widened to at least 2 and cut to at most YOUGLISH_MAX_WORDS words.
 */
export function youglishPhrase(
  text: string,
  decoded?: { tokens: readonly { raw: string }[]; annotations: readonly { from: number; to: number }[] } | null,
): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= YOUGLISH_MAX_WORDS || !decoded || decoded.tokens.length === 0 || decoded.annotations.length === 0) {
    return words.join(' ');
  }
  const n = decoded.tokens.length;
  const pick = decoded.annotations.find((a) => a.to > a.from) ?? decoded.annotations[0];
  let from = Math.max(0, pick.from);
  let to = Math.min(n - 1, pick.to, from + YOUGLISH_MAX_WORDS - 1);
  while (to - from + 1 < YOUGLISH_MIN_WORDS && (to < n - 1 || from > 0)) {
    if (to < n - 1) to++;
    else from--;
  }
  return decoded.tokens
    .slice(from, to + 1)
    .map((t) => t.raw)
    .join(' ');
}

/** YouGlish search for real native speakers saying `phrase` (YouTube clips, US accent). */
export function youglishUrl(phrase: string): string {
  const clean = phrase
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[.!?;:,"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `https://youglish.com/pronounce/${encodeURIComponent(clean)}/english/us`;
}
