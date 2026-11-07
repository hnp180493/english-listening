// "Nghe người thật nói": short real-speech clips (YouTube) for each connected-speech lesson, shown as the last
// section before the quiz (appended in lessons.ts). Contract: docs/courses.md ("Real clips").
//
// How these were picked (2026-11-07): an American-English YouGlish result for the phrase whose caption contains
// it; YouGlish gives the video id and the caption's start second. Each video was checked with YouTube oEmbed
// (public, embeddable) and each clip was PLAYED in the lesson with YouTube's captions on, confirming the caption
// with the phrase shows inside start–end. YouGlish's second is not always right (one result was another line:
// replaced). The captions prove the WORDS are there, not how strongly each speaker reduces them; the UI says so.
// A clip that disappears from YouTube still shows its text and the "Mở trên YouTube" link; replace it then.
import type { RealClip } from './lessonTypes';

/** Seconds played before the caption start (YouGlish starts at the caption, the phrase may come right away). */
const LEAD = 1;
/** Clip length after the caption start: long enough for one caption line, short enough to replay. */
const SPAN = 7;

function clip(videoId: string, captionStart: number, text: string, focus: string, note: string, source: string, span = SPAN): RealClip {
  return { videoId, start: Math.max(0, captionStart - LEAD), end: captionStart + span, text, focus, note, source };
}

export const REAL_CLIPS: Readonly<Record<string, readonly RealClip[]>> = {
  'weak-form': [
    clip('7oUCSfeM9PY', 802, 'It does this by converting a lot of our uncertainties', 'a lot of', 'of → ə: "ə LAH-də"', 'TheKapers83'),
    clip('ZdDjexbxVzM', 267, "that we're probably in a universe that looks kind of like that.", 'kind of', 'of → ə: "KAIN-də"', 'TED'),
  ],
  linking: [
    clip('X1qD-ySmtiI', 88, 'And when he bent over to pick it up,', 'pick it up', 'phụ âm nối sang nguyên âm: "PI-ki-dup"', 'Eddie Pinero'),
    clip('-yJ3RySf9U4', 114, "You go to check it out, but something's looming in the darkness.", 'check it out', '"CHE-ki-daut"', 'TED-Ed'),
  ],
  'flap-t': [
    clip('7bB_fVDlvhc', 229, 'So I want to talk a little bit about that today.', 'a little bit', 't giữa hai nguyên âm thành d nhẹ: "ə LID-dəl bit"', 'TEDx Talks'),
    clip('qc6ctN5-xX0', 171, 'but what about for society,', 'what about', '"WHA-də-baut"', 'CUNY TV'),
  ],
  elision: [
    clip('X1qD-ySmtiI', 21, 'Last night the man promised him', 'Last night', 't trước phụ âm bị nuốt: "las NAIT"', 'Eddie Pinero', 10),
    clip('O1jeJbmHNbc', 348, 'or maybe next week to really take the time to do something', 'next week', '"nex WEEK"', 'ChristinaRebuffet'),
  ],
  assimilation: [
    clip('h6Dk3RgNOKI', 238, 'how did you get them altogether', 'did you', 'd + y → j: "DI-jə"', 'KauffmanTopOfMind'),
    clip('K6r2ikSjnUo', 251, "Which of your readers' assumptions would you like to call into question?", 'would you', '"WOO-jə"', 'TED-Ed'),
  ],
  'h-dropping': [
    clip('Irz-BoKx7_w', 421, 'and give him the greatest shot at stepping up', 'give him', 'h của him rơi: "GI-vim"', 'Mat Boggs'),
    clip('e_lhfFKF-G0', 220, 'and then ask her how thick is the atmosphere', 'ask her', 'h của her rơi: "AS-kər"', 'Physics Girl'),
  ],
  contraction: [
    clip('8dKFDr4pFWw', 1401, "And Doris, I've been a big fan of.", "I've been", '"aiv BIN"', 'Google Zeitgeist'),
    clip('SEAIQ62rydI', 412, "And they're going to be paying taxes.", "they're", 'they\'re → "thər"', 'Moyers & Company', 10),
  ],
  reduction: [
    clip('p0v62FYKLNA', 479, "but eventually we're all gonna move in that direction", 'gonna', 'going to → "GUH-nə"', 'Spirits Voice'),
    clip('9axG7EhGNmI', 422, "they're probably not gonna wanna listen to me", 'wanna', 'want to → "WAH-nə"', 'Ableton'),
  ],
};
