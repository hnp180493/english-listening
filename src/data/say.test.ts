// Authored connected TTS text (`say`, chunk `ttsText`, EXAMPLE_SAY): what the main "Nghe" sends to the engine.
// Contract in docs/courses.md ("say: how the engine must say it").
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../core/decoder';
import { EXAMPLE_SAY, EXAMPLES } from '../features/decoder/examples';
import { BENCHMARK_FORMS } from './benchmark';
import { CHUNKS } from './chunks';
import { CONNECTED_LESSONS, type LessonExample } from './lessons';
import { SENTENCES } from './sentences';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../core/decoder/sapiMisread';

const examples = (): { lesson: string; ex: LessonExample }[] =>
  CONNECTED_LESSONS.flatMap((l) =>
    l.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === 'examples' ? b.items.map((ex) => ({ lesson: l.id, ex })) : []))),
  );

/** Every authored [written text, say] pair. */
function sayPairs(): [string, string][] {
  const out: [string, string][] = [];
  for (const { ex } of examples()) if (ex.say !== undefined) out.push([ex.text, ex.say]);
  for (const [text, say] of Object.entries(EXAMPLE_SAY)) out.push([text, say]);
  for (const s of SENTENCES) if (s.say !== undefined) out.push([s.text, s.say]);
  for (const f of BENCHMARK_FORMS) {
    for (const s of f.sentences) if (s.say !== undefined) out.push([s.text, s.say]);
    for (const q of f.questions) q.say?.forEach((say, i) => out.push([q.lines[i] ?? '', say]));
  }
  return out;
}

describe('authored connected TTS text', () => {
  it('every example of the connected-speech course has a reviewed `say`', () => {
    const missing = examples().filter(({ ex }) => !ex.say?.trim()).map(({ lesson, ex }) => `${lesson}: ${ex.text}`);
    expect(missing).toEqual([]);
  });

  it('"Nghe" differs from the written text, except where that is a deliberate decision', () => {
    // Each entry: why the engine gets the written words. Linking into a vowel and the weak forms below SAPI already
    // says on its own (measured: "to" /tʊ/, "was" /wəz/); strong forms and written contractions are the point.
    const AS_WRITTEN: Record<string, string> = {
      'We need to talk.': 'SAPI says "to" weak (/tʊ/); "ta" is read /tɑ/',
      'I was there.': 'SAPI says "was" weak (/wəz/)',
      'Yes, I can.': 'strong "can" at the end is the point',
      'Come on in.': 'linking into a vowel: engines do it',
      'Hold on a second.': 'linking into a vowel: engines do it',
      'Go on.': 'linking (w glide): engines do it',
      'I agree.': 'linking (y glide): engines do it',
      'Who is it?': 'linking into a vowel: engines do it',
      'Do it now.': 'linking (w glide): engines do it',
      "It's far away.": 'linking r: engines do it',
      'Where are you?': 'linking r: engines do it',
      'Where is it?': 'linking r: engines do it',
      'The car is outside.': 'linking r: engines do it',
      "She'd like to come.": 'the written contraction is what is said',
      "I can't hear you.": "strong can't is the point",
      "It won't work.": 'the written contraction is what is said',
    };
    const same = examples()
      .filter(({ ex }) => speakableFor(ex.text, ex.say) === ex.text)
      .map(({ ex }) => ex.text);
    expect([...new Set(same)].sort()).toEqual(Object.keys(AS_WRITTEN).sort());
    // compare cards: the "native speaker" side must sound different from the careful side
    const cmp = CONNECTED_LESSONS.flatMap((l) => l.sections.flatMap((s) => s.blocks)).flatMap((b) => (b.type === 'compare' ? [b] : []));
    const flat = cmp
      .filter((b) => speakableFor(b.natural, b.ttsText ?? b.say).replace(/[[\]]/g, '') === b.clear)
      .map((b) => b.clear);
    expect(flat).toEqual(["I can't swim."]); // strong "can't": the contrast with "I kin swim" is the point
  });

  it('the showcase examples say exactly what the lesson shows', () => {
    const say = new Map(examples().map(({ ex }) => [ex.text, ex.say]));
    expect(say.get('What do you want to do?')).toBe('Whaddaya wanna do?');
    expect(say.get("I'm going to get a cup of coffee.")).toBe("I'm gonna geda cuppa coffee."); // measured 3/3 with SAPI
    expect(say.get("Tell him I'll call him back.")).toBe("Tellim I'll callim back."); // measured 2/2 with SAPI
    expect(say.get('Put it on the table.')).toBe('Puddid on the table.');
    expect(say.get("I don't know what to say.")).toBe('I dunno whatta say.');
    expect(say.get('Did you eat yet?')).toBe('Didja eat yet?');
  });

  it('uses only ASCII letters, apostrophes, spaces and the punctuation of the written text', () => {
    for (const [text, say] of sayPairs()) {
      expect(say.trim(), text).not.toBe('');
      for (const ch of say) if (!/[A-Za-z' ]/.test(ch)) expect(text.includes(ch), `${text} → ${say} (${ch})`).toBe(true);
      // a question stays a question: same sentence punctuation in the same order
      expect(say.replace(/[^.?!,]/g, ''), `${text} → ${say}`).toBe(text.replace(/[^.?!,]/g, ''));
    }
  });

  it('never uses a spelling SAPI was measured to misread (ta, ya, jus, lone apostrophe forms)', () => {
    const all = [...sayPairs().map(([, say]) => say), ...CHUNKS.map((c) => c.ttsText)];
    for (const say of all) {
      expect(say).not.toMatch(SAPI_MISREAD);
      expect(say).not.toMatch(LONE_APOSTROPHE);
    }
  });

  it('is left unchanged by the decoder, so speakableFor(text, say) plays it as written', () => {
    for (const [text, say] of sayPairs()) expect(speakableFor(text, say), `${text} → ${say}`).toBe(say);
  });

  it('a sentence the decoder finds nothing in is said as written', () => {
    for (const [text, say] of sayPairs()) if (decode(text).annotations.length === 0) expect(say, text).toBe(text);
  });

  it('decoder page examples: one reviewed entry per example', () => {
    expect(Object.keys(EXAMPLE_SAY).sort()).toEqual([...EXAMPLES].sort());
  });

  it('checkup passages: a `say` list matches its lines one to one', () => {
    for (const f of BENCHMARK_FORMS) for (const q of f.questions) if (q.say) expect(q.say.length, q.id).toBe(q.lines.length);
  });

  it('chunk ttsText is speakable eye dialect (no ə, hyphens, IPA) and stable under the decoder', () => {
    for (const c of CHUNKS) {
      expect(c.ttsText, c.written).toMatch(/^[A-Za-z' ]+$/);
      expect(speakableFor(c.written, c.ttsText), `${c.written} → ${c.ttsText}`).toBe(c.ttsText);
    }
  });
});
