// The respelling convention (see the table at the top of tables.ts): one spelling per vowel sound,
// and no respelled syllable that reads as a different English word.
import { describe, expect, it } from 'vitest';
import { decode } from './index';
import { avoidFalseWords, conventionVowels, flapWord, ngSyllables, RESPELL, respellBase, rightForm, splitFinal } from './lexicon';
import { CONTRACTIONS } from './tables';
import { SENTENCES } from '../../data/sentences';
import { CHUNKS } from '../../data/chunks';

const spoken = (s: string) => decode(s).spokenText;

describe('/aɪ/ is "ai" and never prints as another word', () => {
  it('side: split → sai-, whole → side (never "said")', () => {
    expect(spoken('Which side of the road?')).toBe('which sai-də thə road');
    expect(spoken('The car is outside.')).toBe('thə ca-ri-zaut-side');
    expect(spoken('We stayed inside.')).toBe('we stei-din-side');
    expect(spoken('Put it aside.')).toBe('pu-di-də-side');
    expect(spoken('Stay inside of it.')).toBe('stay-yin-sai-də-vit');
    for (const s of ['The car is outside.', 'We stayed inside.', 'Put it aside.', 'Stay inside of it.']) {
      expect(spoken(s), s).not.toMatch(/said/);
    }
  });
  it('the word "said" itself is /sɛd/: "sed" when respelled, as written otherwise', () => {
    expect(respellBase('said')).toBe('sed');
    expect(spoken('He said it again.')).toBe('he se-di-də-gen');
    expect(spoken('Tell him I said hi.')).toBe('tel-li-mai said hi');
  });
  it('ride, time', () => {
    expect(spoken('Can I ride it?')).toBe('kə-nai rai-dit');
    expect(spoken('Ride a bike.')).toBe('rai-də bike');
    expect(spoken('What time is it?')).toBe('what tai-mi-zit');
    expect(spoken('Time after time.')).toBe('tai-maftər time');
    expect(respellBase('time')).toBe('taim');
  });
  it('I\'d / mind / online use the homophone, not "aid" / "main" / "lain"', () => {
    expect(spoken("I'd like a coffee.")).toBe("I'd lai-kə coffee");
    expect(spoken("Where I'd go.")).toBe('whe-ride go');
    expect(spoken('Never mind the rain.')).toBe('never mine thə rain');
    expect(spoken('Do you mind if I sit here?')).toContain('mine-di-fai');
    expect(spoken('I ordered it online.')).toContain('don-line');
    expect(CONTRACTIONS["i'd"].spoken).toBe("I'd");
  });
  it('avoidFalseWords only rewrites whole syllables', () => {
    expect(avoidFalseWords('zaut-said')).toBe('zaut-side');
    expect(avoidFalseWords('main-di-fai')).toBe('mine-di-fai');
    expect(avoidFalseWords('saidid')).toBe('saidid');
    expect(avoidFalseWords('se-dit')).toBe('se-dit');
  });
});

describe('/eɪ/ is "ei" (never "ay")', () => {
  it('made, take', () => {
    expect(spoken('I made it.')).toBe('I mei-dit');
    expect(spoken('She made a cake.')).toBe('she mei-də cake');
    expect(spoken('Take it easy.')).toBe('tei-ki-dee-zi');
    expect(spoken('Take a seat.')).toBe('tei-kə seat');
    expect(respellBase('made')).toBe('meid');
    expect(respellBase('take')).toBe('teik');
    expect(ngSyllables('taking')).toBe('tei-king');
  });
  it('OK / okay', () => {
    expect(spoken('Is it OK?')).toBe('i-zi-doh-kei');
    expect(spoken("It's okay.")).toBe('it-soh-kei');
    expect(respellBase('ok')).toBe('ohkei');
  });
  it('written ai / ay are respelled too: wait a → wei-də, not wai-də (which reads /aɪ/)', () => {
    expect(spoken('Wait a second.')).toBe('wei-də second');
    expect(spoken('Raise it up.')).toBe('rei-zi-dup');
    expect(respellBase('stayed')).toBe('steid');
    expect(flapWord('waiting')).toBe('weiding');
    expect(flapWord('later')).toBe('leidər');
  });
});

describe('/oʊ/ is always "oh", open or closed syllable', () => {
  it('go, know: shown as written when not respelled; "oh" when respelled', () => {
    expect(spoken('Go on.')).toBe('go-won');
    expect(spoken('Go away.')).toBe('go-wə-wei');
    expect(spoken('I know it.')).toBe('I know-wit');
    expect(spoken('He knows it all.')).toBe('he noh-zi-dall');
    expect(spoken('It goes on and on.')).toBe('it goh-zo-nə-non');
  });
  it('home', () => {
    expect(spoken('Home is where it is.')).toBe('hoh-mis whe-ri-dis');
    expect(spoken('Is your home at the end?')).toContain('hoh-mət');
    expect(respellBase('home')).toBe('hohm');
  });
  it('hold, most: closed syllables are "oh" too (not hol-don, mos-tə)', () => {
    expect(spoken('Hold on.')).toBe('hohl-don');
    expect(spoken('Hold it up.')).toBe('hohl-di-dup');
    expect(spoken('Most of them.')).toBe('mohs-tə thəm');
    expect(spoken('Most people.')).toBe('mohs people');
    expect(respellBase('told')).toBe('tohld');
    expect(rightForm('old')).toBe('ohld');
  });
  it("don't / won't: dohn, wohnt (dunno, doncha keep their spelling)", () => {
    expect(spoken("I don't think so.")).toBe('I dohn think so');
    expect(spoken("Don't ask.")).toBe('dohn-task');
    expect(spoken("Don't eat it.")).toBe('dohn-tee-dit');
    expect(spoken("I don't know.")).toBe('I dunno');
    expect(decode("Don't you like it?").annotations.some((a) => a.spoken === 'doncha')).toBe(true);
    expect(CONTRACTIONS["won't"].spoken).toBe('wohnt');
  });
  it('written oa / old are respelled "oh"', () => {
    expect(spoken('The road is long.')).toBe('thə roh-dis long');
    expect(spoken('the boat is ready')).toBe('thə boh-dis ready');
    expect(flapWord('photo')).toBe('fohdoh');
  });
});

describe('/aʊ/ au, /iː/ ee, /uː/ oo, /ɔɪ/ oi', () => {
  it('au: down, proud, house', () => {
    expect(spoken('Write it down in your notebook.')).toContain('dau-nin');
    expect(spoken("I'm so proud of you.")).toContain('prau-də');
    expect(spoken('The house is old.')).toBe('thə hau-si-zohld');
    expect(conventionVowels('loud')).toBe('laud');
  });
  it('ee: written ea is respelled (mean it → mee-nit, leave it → lee-vit)', () => {
    expect(spoken("He didn't mean it.")).toContain('mee-nit');
    expect(spoken('Leave it alone.')).toBe('lee-vi-də-lohn');
    expect(spoken('That is a good idea.')).toContain('goo-dai-deeə');
  });
  it('oo / yoo: use → yooz, cute → kyoot', () => {
    expect(respellBase('use')).toBe('yooz');
    expect(respellBase('cute')).toBe('kyoot');
    expect(respellBase('rule')).toBe('rool');
  });
  it('oi: boys → boiz; au/aw (/ɔ/) → o: pause → poz', () => {
    expect(spoken('the boys are here')).toBe('thə boi-zər here');
    expect(spoken('Pause it.')).toBe('po-zit');
  });
});

describe('no respelling reads as another English word, and nothing is converted twice', () => {
  it('flap T: water → wadder (not "wader" /eɪ/), writing / writer → riding / rider when shown whole', () => {
    expect(spoken('I need some water.')).toBe('I need səm wadder');
    expect(spoken('Pour the water in.')).toContain('waddə-rin'); // split: ə + r like doctə-rif
    expect(spoken('I like writing.')).toBe('I like riding');
    expect(decode('The writer is here.').annotations.find((a) => a.type === 'flap-t')?.spoken).toBe('rider');
    for (const s of ['I need some water.', 'I like writing.', 'The writer is here.', 'Writers are busy.']) {
      expect(spoken(s), s).not.toMatch(/wader|raiding|raidər(?!-)/);
    }
  });
  it('a respelled -ing word keeps its vowels when its last consonant moves (ai stays /aɪ/, au stays /aʊ/)', () => {
    expect(spoken('I like writing it.')).toBe('I like rai-ding-it');
    expect(spoken('He kept shouting at me.')).toBe('he kep shau-ding-ət me');
    expect(spoken('It was exciting and fun.')).toContain('ksai-ding-ən');
    expect(spoken('I was counting on you.')).toContain('caun-ting-on');
    expect(spoken('I was taking a nap.')).toContain('tei-king-ə');
    expect(spoken('This evening I will go.')).toBe('thi-seev-ning-ai wəl go');
  });
  it("I'm after a sound is never \"aim\" / \"maim\" (/eɪm/): him I'm → i-mime", () => {
    expect(spoken("Tell him I'm late.")).toBe('tel-li-mime late');
    expect(spoken("Do something I'm sure.")).toContain("something-I'm");
  });
  it("what's is written like that's (whats), so \"what\" reads the same as in wha-dai, wha-chu", () => {
    expect(spoken("What's up?")).toBe('what-sup');
    expect(spoken("What's your name?")).toBe('what-shur name');
    expect(spoken('What is it?')).toBe('wha-di-zit');
    expect(CONTRACTIONS["what's"].spoken).toBe('whats');
  });
  it('reductions that are not established spellings follow the table: yoosta, spohsta', () => {
    expect(spoken('I used to live here.')).toBe('I yoosta live here');
    expect(spoken('You were supposed to call.')).toBe('yə wər spohsta call');
  });
});

describe('the convention holds on the whole dataset', () => {
  const texts = [...SENTENCES.map((s) => s.text), ...CHUNKS.map((c) => c.example)];
  const REDUCTION_OU = /^(outta|oughta|woughta|doutta|routta|soutta|zoutta|loutta)$/;
  it('a respelled syllable never uses ay / oa / oy, and "ou" only in the outta / oughta reductions', () => {
    for (const t of texts) {
      for (const seg of decode(t).segments) {
        // the first syllable of each word may be a word shown as written (say-yeni-thing); the rest are respelled
        const syl = seg.spoken.split(' ').flatMap((w) => w.split('-').slice(1));
        for (const s of syl) {
          expect(s, `${t} → ${seg.spoken}`).not.toMatch(/ay|oa|oy/);
          if (/ou/.test(s)) expect(s, `${t} → ${seg.spoken}`).toMatch(REDUCTION_OU);
        }
      }
    }
  });
  it('no glued segment contains a false-friend syllable (said, main, aid, raid, lain, wail…)', () => {
    for (const t of texts) {
      for (const seg of decode(t).segments) {
        if (!seg.spoken.includes('-')) continue;
        for (const s of seg.spoken.split('-')) {
          expect(['said', 'main', 'aid', 'raid', 'lain', 'wail', 'mail', 'pain', 'laid'], `${t} → ${seg.spoken}`).not.toContain(s);
        }
      }
    }
  });
});

describe('/ɛr/ is "eər" (hair, care, there), a plain "e" when the r links to a vowel', () => {
  it('whole-word respellings: eər, never "er" (that is /ɜr/: her, lern, wer)', () => {
    const cases: [string, string][] = [
      ['hair', 'heər'], ['care', 'keər'], ['share', 'sheər'], ['chair', 'cheər'], ['air', 'eər'], ['rare', 'reər'],
      ['there', 'theər'], ['their', 'theər'], ['where', 'wheər'], ['bear', 'beər'], ['wear', 'weər'], ['pear', 'peər'],
      ['square', 'skweər'], ['heir', 'eər'], ['careful', 'keərfəl'], ['prepared', 'prepeərd'], ['upstairs', 'upsteərz'],
      ['everywhere', 'evriwheər'], ['millionaire', 'millioneər'], ['stairs', 'steərz'],
    ];
    for (const [w, r] of cases) expect(respellBase(w), w).toBe(r);
    expect(rightForm('aware')).toBe('ə|weər');
    expect(rightForm('airport')).toBe('eər|port');
    expect(CONTRACTIONS["there's"].spoken).toBe('theərz');
    // /ɜr/ keeps "er"
    expect(respellBase('were')).toBe('wer');
    expect(respellBase('learn')).toBe('lern');
  });
  it('before a vowel the r starts the next syllable and the vowel is a plain e (KE-rək-tər)', () => {
    expect(splitFinal('theər')).toEqual({ stem: 'the', onset: 'r' });
    expect(respellBase('parent')).toBe('perənt');
    expect(respellBase('dairy')).toBe('dery'); // final y is shown as written
    expect(respellBase('character')).toBe('kerəktər');
    expect(spoken('Where are you?')).toBe('whe-rər you');
    expect(spoken('Where is it?')).toBe('whe-ri-zit');
    expect(spoken('I care about you.')).toBe('I ke-rə-bau-chu');
    expect(spoken('This chair is very comfortable.')).toContain('che-ris'); // was "chei-ris" (/eɪ/)
    expect(spoken('Is the air OK?')).toBe('is thee-ye-roh-kei');
    expect(spoken("I'll be there in a minute.")).toContain('the-ri-nə');
  });
  it('before a consonant or at the end it stays "eər"', () => {
    expect(spoken("There's a problem with my order.")).toMatch(/^theər-zə /);
    expect(spoken("I know there's no time.")).toBe('I know theərz no time');
    expect(spoken('We were scared of it.')).toBe('we wər skeər-də-vit');
    expect(spoken("I can't find it anywhere.")).toContain('eni-wheər');
  });
});

describe('/ɑ/ is "a", never "o", in a respelled syllable', () => {
  it('lexicon entries', () => {
    const cases: [string, string][] = [
      ['knock', 'nak'], ['not', 'nat'], ['got', 'gat'], ['problem', 'prabləm'], ['promise', 'pramis'],
      ['opposite', 'apəzit'], ["o'clock", 'əklak'], ['dr', 'daktər'], ['doctor', 'daktər'], ['dollar', 'dalər'],
      ['stopped', 'stapt'], ['column', 'kaləm'], ['honor', 'anər'], ['upon', 'əpan'], ['honest', 'anəst'],
    ];
    for (const [w, r] of cases) expect(respellBase(w), w).toBe(r);
    expect(rightForm("o'clock")).toBe('ə|klak');
    expect(rightForm('upon')).toBe('ə|pan');
  });
  it('in connected speech', () => {
    expect(spoken('Knock it off.')).toBe('na-ki-doff');
    expect(spoken("At seven o'clock in the morning.")).toContain('ə-kla-kin');
    expect(spoken("You should see a doctor if it doesn't get better.")).toContain('daktə-ri-fit');
  });
  it('/ɔ/ stays "o": call, talk, thought, wrong, gone', () => {
    for (const [w, r] of [['call', 'kol'], ['called', 'kold'], ['talk', 'tok'], ['thought', 'thot'], ['wrong', 'rong'], ['gone', 'gon']]) {
      expect(respellBase(w), w).toBe(r);
    }
    expect(spoken("Tell him I'll call him back.")).toContain('ko-lim'); // not "cal-lim" (/æ/)
  });
});

describe('lexicon spellings agree with the rest of the table', () => {
  it('no hand-written respelling is a different English word (climb → klaim, not "claim")', () => {
    expect(respellBase('climb')).toBe('klaim');
    for (const [w, r] of Object.entries(RESPELL)) expect(['claim', 'said', 'raid', 'laid'], `${w} → ${r}`).not.toContain(r);
  });
  it('whole-word respellings carry no hyphens and no capitals (word cards add them: PRAB-ləm)', () => {
    for (const [w, r] of Object.entries(RESPELL)) {
      if (w === 'i' || /^i'/.test(w)) continue;
      expect(r, w).not.toMatch(/[-A-Z]/);
    }
  });
  it('/juː/ is "yoo" except before r: february → febyooeri, excuse → ikskyooz', () => {
    expect(respellBase('february')).toBe('febyooeri');
    expect(respellBase('excuse')).toBe('ikskyooz');
    expect(respellBase('young')).toBe('yung'); // /jʌ/, not /juː/
  });
  it('thorough / borough end in /oʊ/ like their final-sound code', () => {
    expect(respellBase('thorough')).toBe('theroh');
    expect(respellBase('borough')).toBe('beroh');
  });
});
