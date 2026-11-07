import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../core/decoder';
import { connectedLines } from './useCheckupAudio';

const gen = (t: string) => decode(t).speakText?.trim() || t;

describe('checkup audio: connected versions', () => {
  it('every line plays its connected version (natural speech is what the checkup measures)', () => {
    const lines = ["Hi, it's me. I'm going to be late.", 'Tell him I will call him back.'];
    expect(connectedLines(lines)).toEqual(lines.map(gen));
  });
  it("authored says win: one string for a one-line item, one per line for a passage", () => {
    expect(connectedLines(['Did you eat yet?'], 'Didja eat yet?')).toEqual([speakableFor('Did you eat yet?', 'Didja eat yet?')]);
    expect(connectedLines(['One.', 'Two.'], 'X')).toEqual([gen('One.'), gen('Two.')]);
    expect(connectedLines(['One.', 'Want to go?'], [undefined, 'Wanna go?'])).toEqual([gen('One.'), speakableFor('Want to go?', 'Wanna go?')]);
  });
});
