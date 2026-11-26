// How a line of a Westbay job is said (core/town/job.ts): Westbay's people and the new ones in their browser voice
// (core/town/jobVoice), never a clip, never the paid voice; a town resident in their Gemini voice (the owner's rule); connected by default (anything shown decoded must sound decoded: core/playback.ts), the
// careful version only in the debrief. `volume` is for a talk overheard from a distance; `slow` for a line asked again
// (a little slower, still connected: core/playback.ts slowRate).

import { CAREFUL_RATE } from '../../../core/playback';
import type { JobLine } from '../../../core/town/job';
import { jobVoice } from '../../../core/town/jobVoice';
import { speak } from '../../../core/tts';
import { cityCastVoice, cityLineText } from '../../../core/town/cityAudio';
import { dictationAudio } from '../../dictation/decodeCache';

export function sayJobLine(line: Pick<JobLine, 'who' | 'text' | 'say'>, level: number, o: { careful?: boolean; volume?: number; slow?: boolean; gender?: 'male' | 'female' } = {}): Promise<void> {
  const audio = dictationAudio({ text: line.text, level, ...(line.say ? { say: line.say } : {}) });
  // a town resident (Max, Sam, Grace…): their own Gemini voice for the connected line, the clip the owner generates
  // (core/audioInventory cityJobs; until then the browser's voice of their sex plays); careful: the browser's voice
  const cast = cityCastVoice(line.who);
  if (cast && !o.careful) return speak(cityLineText(line, level), { mode: 'connected', voice: cast, ...(o.slow ? { slow: true } : {}) });
  const voice = jobVoice(line.who, o.gender);
  if (o.careful) return speak(audio.careful.trim(), { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true });
  return speak(audio.connected.trim(), { mode: 'connected', voice, browserOnly: true, ...(o.slow ? { slow: true } : {}), ...(o.volume !== undefined ? { volume: o.volume } : {}) });
}

/** About how long a line takes said (a line too far off to hear still takes its time). */
export function lineSeconds(text: string): number {
  return 0.6 + text.split(/\s+/).length * 0.36;
}
