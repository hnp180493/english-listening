// The voices of Westbay's police (core/town/scanner.ts): Dispatch, the patrol's unit, the officer at a stop. New
// characters, only heard: the browser's voice (a name of their own, `scene-…`, so no clip is ever looked up or made:
// docs/city.md §5, §17), connected as the decoder writes it, "Nghe chậm" slower and still connected. One at a time.

import { getSettings } from '../../../core/settings';
import type { ScanLine } from '../../../core/town/scanner';
import { speak, stopSpeaking, type SpeakOptions, type SpeakVoice } from '../../../core/tts';
import { dictationAudio } from '../../dictation/decodeCache';

const VOICE: Readonly<Record<ScanLine['who'], SpeakVoice | null>> = {
  dispatch: { voice: 'scene-police-dispatch', gender: 'female' },
  unit: { voice: 'scene-police-unit', gender: 'male' },
  officer: { voice: 'scene-police-officer', gender: 'male' },
  // the learner's own line is shown, not said (docs/city.md §5)
  you: null,
};

let gen = 0;

/** Say lines one after another (a new call stops what was being said). Resolves when done or cut off. */
export async function sayScan(lines: readonly ScanLine[], slow = false): Promise<void> {
  const g = ++gen;
  stopSpeaking();
  for (const l of lines) {
    const voice = VOICE[l.who];
    if (!voice || g !== gen) continue;
    const text = dictationAudio({ text: l.text, level: 2 }).connected.trim();
    const opts: SpeakOptions = { mode: 'connected', voice, browserOnly: true, volume: l.who === 'officer' ? 1 : 0.85, ...(slow ? { slow: true } : { rate: getSettings().rate || 1 }) };
    try {
      await speak(text, opts);
    } catch {
      // a voice that fails says nothing; the words are there to read
    }
  }
}

export function hushScan(): void {
  gen++;
  stopSpeaking();
}
