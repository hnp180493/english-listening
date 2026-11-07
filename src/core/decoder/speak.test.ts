// Speakable (TTS) text: DecodeResult.speakText / SpokenSegment.speak / speakableFor (see speak.ts).
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from './index';
import { LONE_APOSTROPHE, SAPI_MISREAD } from './sapiMisread';
import { CONTRACTIONS, ELISION_SPEAK, H_FORMS, HAVE_SPEAK, OF_FUSE, REDUCTIONS, WEAK_SPEAK } from './tables';
import { SENTENCES } from '../../data/sentences';
import { CHUNKS } from '../../data/chunks';
import { LESSONS } from '../../data/lessons';
import { BENCHMARK_FORMS } from '../../data/benchmark';
import { EXAMPLES } from '../../features/decoder/examples';

/** A speakable form from the tables: ASCII letters, apostrophes and spaces only (no ə, hyphens, IPA). */
const FORM = /^[A-Za-z' ]+$/;
const speak = (s: string): string => decode(s).speakText ?? '';


/** Every English sentence a lesson shows (examples, compare blocks, quiz sentences). */
function lessonTexts(o: unknown, out: string[]): string[] {
  if (Array.isArray(o)) for (const x of o) lessonTexts(x, out);
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (['text', 'clear', 'natural'].includes(k) && typeof v === 'string') out.push(v.replace(/[[\]]/g, ''));
      else lessonTexts(v, out);
    }
  }
  return out;
}
const VIET = /[ăâđêôơưạảãầấậẩẫằắặẳẵẹẻẽềếệểễịỉĩọỏõồốộổỗờớợởỡụủũừứựửữ]/i;
const CORPUS = [
  ...new Set([
    ...SENTENCES.map((s) => s.text),
    ...CHUNKS.flatMap((c) => [c.written, c.example]),
    ...lessonTexts(LESSONS, []),
    ...BENCHMARK_FORMS.flatMap((f) => [...f.sentences.map((s) => s.text), ...f.questions.flatMap((q) => q.lines)]),
    ...EXAMPLES,
  ]),
].filter((s) => /[a-z]/i.test(s) && !VIET.test(s));

describe('speakable forms in the decoder tables', () => {
  it('every reduction and contraction states a speak form or null (= keep written)', () => {
    for (const r of REDUCTIONS) {
      expect(r.speak === null || typeof r.speak === 'string', r.words.join(' ')).toBe(true);
      if (r.speak !== null) expect(r.speak, r.words.join(' ')).toMatch(FORM);
    }
    for (const [w, c] of Object.entries(CONTRACTIONS)) {
      expect(c.speak === null || typeof c.speak === 'string', w).toBe(true);
      if (c.speak !== null) expect(c.speak, w).toMatch(FORM);
    }
    for (const [w, h] of Object.entries(H_FORMS)) {
      expect(h.speak === null || typeof h.speak === 'string', w).toBe(true);
      if (h.speak !== null) expect(h.speak, w).toMatch(FORM);
    }
  });

  it('weak / elision / have / of forms are plain letters and apostrophes', () => {
    for (const map of [WEAK_SPEAK, ELISION_SPEAK, HAVE_SPEAK, OF_FUSE]) {
      for (const [w, f] of Object.entries(map)) if (f !== null) expect(f, w).toMatch(FORM);
    }
  });

  it('every word the decoder weakens has an explicit WEAK_SPEAK entry', () => {
    const missing = new Set<string>();
    for (const t of CORPUS) {
      for (const a of decode(t).annotations) {
        const w = a.original.toLowerCase();
        if (a.type === 'weak-form' && !(w in WEAK_SPEAK)) missing.add(w);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('the well-known reductions get their usual spelling', () => {
    const byWords = (s: string) => REDUCTIONS.find((r) => r.words.join(' ') === s)?.speak;
    expect(byWords('going to')).toBe('gonna');
    expect(byWords('want to')).toBe('wanna');
    expect(byWords('got to')).toBe('gotta');
    expect(byWords('have to')).toBe('hafta');
    expect(byWords('a lot of')).toBe('a lotta');
    expect(byWords('what do you')).toBe('whaddaya');
    expect(byWords('did you')).toBe('didja');
    expect(byWords("don't know")).toBe('dunno');
    expect(byWords('used to')).toBeNull(); // engines already say "yoosta"
    expect(byWords('wants to')).toBeNull(); // "wants ta" is read /tɑ/: the written "to" is weaker
  });
});

describe('speakText', () => {
  it('reviewed output for sentences from the app content', () => {
    const cases: [string, string][] = [
      ['What do you want to do?', 'Whaddaya wanna do?'],
      ["I'm going to get a cup of coffee.", "I'm gonna gedda cuppa coffee."],
      ["Tell him I'll call him back.", "Tellim I'll callim back."],
      ['Put it on the table.', 'Puddid on the table.'],
      ["I don't know what to say.", 'I dunno what to say.'], // "to" stays: SAPI already says /tʊ/, "ta" is /tɑ/
      ['Did you eat yet?', 'Didja eat yet?'],
      ['Nice to meet you.', 'Nice to meetcha.'],
      ['See you next week.', 'See yuh nex week.'], // "yuh" = /jə/ ("ya" is read /jæ/)
      ['A cup of tea, please.', 'A cuppa tea, please.'],
      ['For here or to go?', 'Fer here or to go?'],
      ['Look at them.', 'Look at them.'], // no lone "'em" (/ɛm/); "atem" could read "ate"
      ['I told you so.', 'I toldja so.'],
      ['Ask her.', 'Asker.'], // glued: "'er" alone is read as the letters E-R
      ['Take his advice.', "Take 'is advice."],
      ['I should have called.', 'I shoulda called.'],
      ['She must have known.', 'She musta known.'],
      ['I had a great time last night.', 'I had a great time lass night.'],
      ['There were a lot of people.', 'There were a lotta people.'],
      ['Get out of here.', 'Get outta here.'],
      ['What are you doing?', 'Whatcha doing?'],
      ['Let me know if you need a hand.', 'Lemme know if yuh need a hand.'],
      ['Could you put it in a bag for me?', 'Could juh puddid in a bag fer me?'], // "Couldja" is read /kud/
      ['Salt and pepper, please.', 'Salt an pepper, please.'], // "an" /ən/; "'n" is the letter N
      ['I stayed home because it was raining.', 'I stayed home cuz it was raining.'],
      ["Where did you put my keys? I can't find them.", "Wheredja put my keys? I can't findem."],
      ["I'm sorry, I'm going to have to cancel our meeting, something came up.", "I'm sorry, I'm gonna hafta cancel our meeding, something came up."],
      ['Shut up! You won the lottery?', 'Shuddup! You won the lottery?'], // phrase start: "you" not weakened
      ['Let him finish his sentence.', "Leddim finish 'is sentence."],
      ['I want you to meet my sister.', 'I wantcha to meet my sister.'],
      ['Would you like a cup of coffee?', 'Would juh like a cuppa coffee?'],
      ['We should have asked him first.', 'We shoulda asked him first.'], // -ed: no "askedim"
      ['Give him a call.', 'Givim a call.'], // the lesson spelling (SAPI: g ih v ih m)
      ['Pick it up.', 'Pickid up.'], // "id" alone is read I-D: glued onto pick (SAPI: p ih k ih d ah p)
      ['I need some water.', 'I need some wadder.'], // in-word flap: SAPI says "water" with /t/
      ['The city is pretty.', 'The ciddy is pretty.'], // priddy would be a new vowel spelling: kept written
      ['I kept forgetting.', 'I kep forgetting.'], // "forgedding" is read /fɔrdʒ/: long words keep their t; kep k eh p
      ['It is later than you think.', 'It is later than yuh think.'], // leidər: not the written word with d
      // SAPI-measured fixes (each misread form named)
      ["Tell them we're on our way.", "Tellem we're on our way."],
      ['I met her mother.', 'I medder mother.'],
      ['I love her.', 'I luvver.'], // the lesson spelling (SAPI: l ah v er); never "'er"
      ['A tear ran down her face.', 'A tear ran down her face.'], // "ow" is a vowel: no "downer"
      ["I'm worried about him.", "I'm worried about him."], // "aboutim" is read /ʊ/
      ['Have you heard from him?', 'Have yuh heard frum him?'], // "fromim" is read /oʊ/; weak "frum" (f r ah m), not glued
      ['What about you? Are you hungry?', 'What about you? Are yuh hungry?'], // contrastive final "you" kept
      ["I've got a bad headache.", "I've gotta bad headache."], // "godda" is read /goʊdɑ/
      ['But a bottle of water would be nice.', 'But a bottle of wadder would be nice.'], // "budda" = Buddha
      ['a couple of questions', 'a couple a questions'], // "coupla" is read /kuplə/
      ['What did you do?', 'Whaddija do?'], // "whaddidja" gains a syllable
      ['You should see a doctor.', 'You should see a doctor.'], // no capital "Ya" at a phrase start
      ['Hand me the bag.', 'Hann me the bag.'], // "Han" is the name /hɑn/
      ["I'll do it first thing tomorrow.", "I'll do it first thing tomorrow."], // firs / firss / firsst all read /fɜrz/
      ["I'm just looking, thanks.", "I'm jusst looking, thanks."], // "jus" is /dʒuz/, "juss" is "just"; jusst jh ah s
      ["I've got a lot of work to do.", "I've gotta lotta work to do."],
      ['Why should you care?', 'Why should juh care?'], // "shouldja" is read /ʃud/
    ];
    for (const [text, want] of cases) expect(speak(text), text).toBe(want);
  });

  it('widened forms (each measured with SAPI phonemes, 2026-11-07; the lesson spelling where one exists)', () => {
    const cases: [string, string][] = [
      ['Turn it off, please.', 'Turnid off, please.'], // "id" alone is read I-D: glued onto turn (t er r n ih d)
      ['We tried to drop it off this afternoon.', 'We tried to droppid off this afternoon.'], // d r aa p ih d
      ['Is it on sale?', 'Izzid on sale?'], // ih z ih d
      ['I like it a lot.', 'I like idda lot.'], // silent-e "like" takes no glue: "it a" → idda (ih d ax)
      ['We stayed at a really nice hotel.', 'We stayed adda really nice hotel.'], // ae d ax
      ["That's not what I ordered at all.", "That's not whaddai ordered at all."], // w ae d ay
      ["I can come, but I can't stay long.", "I kin come, buddai can't stay long."], // k ih n (can: k ae n), b ah d ay
      ["It's not that I don't like it.", "It's not that I dohn like it."], // "thaddai" is read with /θ/
      ["She said she'd meet us out in front.", "She said she'd meed us out in front."], // m iy d
      ["We'll start at ten.", "We'll stard at ten."], // s t aa r d
      ['Wait a minute.', 'Waida minute.'], // w ey d ax
      ['I think we got off at the wrong stop.', 'I think we goddoff at the wrong stop.'], // g aa d ao f
      ['I miss you so much.', 'I mishu so much.'], // m ih sh uh
      ['Last year was hard.', 'Lass cheer was hard.'], // l ae s ch iy r
      ['The store will be closing in fifteen minutes.', 'The store will be closing in fifteem minutes.'],
      ['Is it far from here?', 'Is it far frum here?'], // from: f r aa m, frum: f r ah m
      ['I studied all night, and I still failed.', 'I studied all night, an I still failed.'], // ", an" ax n
      ['We missed the connection.', 'We miss the connection.'], // the -ed is not heard: m ih s dh ax
      ["Don't take it personally, he didn't mean it.", 'Dohn take it personally, he didn mean it.'],
      ["I couldn't stop shaking.", 'I coodn stop shaking.'], // "couldn" is read with /u/
      ["We're supposed to read the first three chapters.", "We're sposta read the first three chapters."],
      ['Give her the book.', 'Givver the book.'],
      ["I can't find my keys anywhere.", "I can't fine my keys anywhere."],
      ['Send me the link.', 'Sen me the link.'],
      ['Our office is the second door on the left.', 'Our office is the secon door on the left.'],
      ['He hurt his back.', "He hurt 'is back."], // no "hurd" before our own "'is": stable output
      ["You're on mute.", "You're on mute."], // "om" is read as the letters O-M
    ];
    for (const [text, want] of cases) expect(speak(text), text).toBe(want);
  });

  it('a sentence without connected-speech changes comes back exactly as written', () => {
    for (const t of ['Good morning.', 'I like spicy food.', 'Hello, world!  Two  spaces stay.', '"Fine," she said.', 'well-known ideas', '']) {
      expect(speak(t), t).toBe(t);
    }
    for (const t of CORPUS) if (decode(t).annotations.length === 0) expect(speak(t), t).toBe(t);
  });

  it('adds only ASCII letters, apostrophes and spaces (no ə, hyphens or IPA); keeps the punctuation', () => {
    for (const t of CORPUS) {
      const s = speak(t);
      for (const ch of s) if (!/[A-Za-z' ]/.test(ch)) expect(t.includes(ch), `${t} → ${s} (${ch})`).toBe(true);
      expect(s.replace(/[^.?!,]/g, ''), `${t} → ${s}`).toBe(t.replace(/[^.?!,]/g, ''));
    }
  });

  it('never uses a form SAPI was measured to misread', () => {
    for (const t of CORPUS) {
      const s = speak(t);
      expect(s, t).not.toMatch(SAPI_MISREAD);
      expect(s, t).not.toMatch(LONE_APOSTROPHE);
    }
  });

  it('joins at most two written words into one spoken word (no "turnitoff" walls)', () => {
    for (const t of CORPUS) {
      const written = new Set(t.toLowerCase().match(/[a-z']+/g) ?? []);
      for (const w of speak(t).toLowerCase().match(/[a-z']+/g) ?? []) {
        if (!written.has(w)) expect(w.length, `${t} → ${w}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('is stable: the speakable text of a speakable text is itself', () => {
    for (const t of CORPUS) {
      const s = speak(t);
      expect(speak(s), `${t} → ${s}`).toBe(s);
    }
  });

  it('segments carry the same words as speakText, in order', () => {
    const norm = (s: string) => (s.toLowerCase().match(/[a-z']+/g) ?? []).join(' ');
    for (const t of CORPUS) {
      const r = decode(t);
      expect(r.segments.every((g) => typeof g.speak === 'string'), t).toBe(true);
      expect(norm(r.segments.map((g) => g.speak).join(' ')), t).toBe(norm(r.speakText ?? ''));
    }
  });

  it('a segment speaks its own chunk: "tell him" → "tellim"', () => {
    const r = decode("Tell him I'll call him back.");
    expect(r.segments.map((g) => g.speak)).toEqual(["Tellim I'll", 'callim', 'back.']);
    expect(decode('What do you want to do?').segments[0].speak).toBe('Whaddaya');
  });

  it('never throws on odd input', () => {
    for (const t of ['', '   ', '!!!', '123 456', "'''", 'TV and DVD', 'ŵéîrd ünïcode', 'a'.repeat(500)]) {
      const r = decode(t);
      expect(typeof r.speakText).toBe('string');
    }
    expect(decode(undefined as unknown as string).speakText).toBe('');
  });
});

describe('speakableFor', () => {
  it('uses the generated speakText, or the authored override (run through the decoder too)', () => {
    expect(speakableFor('What do you want to do?')).toBe('Whaddaya wanna do?');
    expect(speakableFor('Whaddaya wanna do?', 'What do you wanna do?')).toBe('Whaddaya wanna do?');
    expect(speakableFor("I'm going to get a cup of coffee.", "  I'm gonna geda cuppa coffee. ")).toBe("I'm gonna geda cuppa coffee.");
    expect(speakableFor('Did you eat yet?', '')).toBe('Didja eat yet?');
    expect(speakableFor('Did you eat yet?', null)).toBe('Didja eat yet?');
    expect(speakableFor(undefined as unknown as string)).toBe('');
  });
  it('is memoised and pure', () => {
    expect(speakableFor('Tell him.')).toBe('Tellim.');
    expect(speakableFor('Tell him.')).toBe('Tellim.');
  });
});
