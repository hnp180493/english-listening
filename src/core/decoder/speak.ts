// Speakable text: the sentence spelled so a TTS engine SAYS it the way the decoder shows it.
//
// The respellings (spoken / spokenText) are for the learner's eyes: ə, hyphens, "tel-li-mal". An engine cannot
// read them, and given the standard sentence it reads like a newsreader (measured with SAPI: "Tell him I'll call
// him back." 0/2 reductions, "Tellim I'll callim back." 2/2). speakText is conservative eye dialect built from the
// same analysis: "What do you want to do?" → "Whaddaya wanna do?", "I'm going to get a cup of coffee." →
// "I'm gonna gedda cuppa coffee.". Rules (forms in tables.ts):
//  - only ASCII letters, apostrophes and spaces are added; the input's own punctuation and spacing are kept, so a
//    sentence without connected-speech changes comes back unchanged;
//  - words are joined only where the reduction needs it (tellim, gedda, cuppa, toldja), and at most two words per
//    joined chunk (reductions count as one): no "turnitoff" walls an engine would mispronounce;
//  - when unsure the written word is kept. Linking is left to the engine. In-word flaps are NOT done by SAPI
//    (measured: "water" w ao t ax r, "better" b eh t ax r), so a flapped word is sent with its t written d when that
//    is exactly the decoder's respelling (water → wadder, better → bedder, city → ciddy; see inWordFlap).
//  - every form an engine gets was checked with SAPI phonemes (System.Speech PhonemeReached); misreads found are in
//    sapiMisread.ts. The same forms are what the lessons' reviewed `say` values use (Turnid off, Givim, Waida,
//    whaddai, tem, Lass cheer), so a dictation sentence and a lesson example with the same phrase sound the same.
//    src/data/connected.test.ts checks that every annotated built-in sentence comes out different from its text.
import type { Token } from '../types';
import {
  CONTRACTIONS,
  ELISION_SPEAK,
  FLAP_LEFT,
  FLAP_RIGHT,
  H_FORMS,
  H_GLUE_STEM,
  HAVE_SPEAK,
  OF_FUSE,
  PLACE_SPEAK,
  WEAK_SPEAK,
  type ReductionEntry,
  type WeakInfo,
} from './tables';

/** The decoder's analysis state that the speakable text is built from (see analyse() in index.ts). */
export interface SpeakInput {
  text: string;
  tokens: Token[];
  cores: string[];
  spans: { start: number; end: number }[];
  brk: boolean[];
  words: string[];
  red: number[];
  reds: { from: number; to: number; entry: ReductionEntry }[];
  contr: boolean[];
  weak: (WeakInfo | null)[];
  bev: ({ kind: string } | null)[];
  elided: boolean[];
  /** The decoder's respelling of a word flapped inside itself (water → wadder), else null. */
  flapped?: (string | null)[];
}

/** forms[i]: what token i is spoken as (null = the written word, '' = merged into the previous token). */
export interface SpeakPlan {
  forms: (string | null)[];
  /** glue[b]: no space between token b and b + 1. */
  glue: boolean[];
}

/**
 * May an h-less pronoun ("im", "er", "em") be glued onto this word without the engine misreading the word's
 * vowel? Only short one-syllable words whose vowel stays short when a vowel follows: a single vowel letter closed
 * by two or more consonants (tell → tellim, ask → askim, told, find, with → withim), a flap-T word (let → leddim)
 * or "ee" (seen → seenim). Measured with SAPI: "fromim" is read /oʊ/, "aboutim" /ʊ/, so a single closing consonant
 * (from, for, at) or a longer word keeps the written pronoun. A silent e (give) or -ed (asked) never matches.
 */
export function canGlueH(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length > 5) return false;
  if (FLAP_LEFT.test(w)) return true;
  // w / y after a vowel are part of it (down, play): never a closing consonant
  const m = /^[b-df-hj-np-tv-z]*(a|e|i|o|u|ee)([b-df-hj-np-tvxz]+)$/.exec(w);
  return !!m && (m[2].length >= 2 || m[1] === 'ee');
}

/** Glue stem of a word taking "im" / "er" / "em": a flap-T word's t is said as d (let him → leddim). */
function glueStem(word: string, core: string): string {
  return FLAP_LEFT.test(word) ? core.slice(0, -1) + 'dd' : core;
}
/** One vowel letter + one closing consonant (drop, grab, run): doubled before a glued "id" (droppid). */
const CVC = /^[b-df-hj-np-tv-z]+[aeiou][bdgmnp]$/;
/** Our own weak forms (fer, ta, ya, yer…) read back as words: never glued, so speakText(speakText) is stable. */
const WEAK_FORMS = new Set(Object.values(WEAK_SPEAK).filter((f): f is string => !!f).map((f) => f.replace(/'/g, '')));

/**
 * The speakable form of a word flapped inside itself: the written word with its t / tt between vowels written d / dd,
 * used only when that is exactly the decoder's respelling (water → wadder, little → liddle, city → ciddy), so no new
 * vowel spelling reaches the engine (later → leidər, pretty → priddy stay written). SAPI reads wadder / bedder /
 * liddle / madder / ciddy with /d/ (measured), the written words with /t/.
 */
export function inWordFlap(word: string, respelled: string | null | undefined): string | null {
  // short words only: in a longer one a respelled "ge" may turn soft ("forgedding" is read /fɔrdʒ/, SAPI)
  if (!respelled || !/^[a-z]+$/.test(respelled) || word.length > 7) return null;
  const cand = word.toLowerCase().replace(/([aeiouy])(tt|t)(?=[aeiouy])/g, (_m, v: string, t: string) => v + (t === 'tt' ? 'dd' : 'd'));
  if (cand === word.toLowerCase() || cand !== respelled) {
    // single t written as a double d by the decoder (city → ciddy, water → wadder): accept that spelling too
    const dbl = word.toLowerCase().replace(/([aeiouy])(tt|t)(?=[aeiouy])/g, (_m, v: string) => v + 'dd');
    return dbl !== word.toLowerCase() && dbl === respelled ? respelled : null;
  }
  return respelled;
}

export function planSpeak(x: SpeakInput): SpeakPlan {
  const { words, cores, brk, red, reds, contr, weak, bev, elided } = x;
  const n = words.length;
  const forms: (string | null)[] = new Array<string | null>(n).fill(null);
  const glue: boolean[] = new Array<boolean>(Math.max(0, n - 1)).fill(false);
  const hasPrev = (i: number): boolean => i > 0 && !brk[i - 1];
  // weak / elided "and" may follow a comma: ", an I still failed" is read ax n (SAPI), ", and" ae n (measured)
  const andOk = (i: number): boolean => hasPrev(i) || (i > 0 && /,["'”’)]*$/.test(x.tokens[i - 1].raw));

  // 1. Multi-word reductions: one spoken unit on the first token.
  for (const r of reds) {
    if (r.entry.speak === null) continue;
    forms[r.from] = r.entry.speak;
    for (let k = r.from + 1; k <= r.to; k++) {
      forms[k] = '';
      glue[k - 1] = true;
    }
  }

  // 2. Token-level: contractions, weak forms, elision.
  for (let i = 0; i < n; i++) {
    const w = words[i];
    if (!w || red[i] >= 0) continue;
    if (contr[i]) {
      forms[i] = CONTRACTIONS[w]?.speak ?? null;
      continue;
    }
    // before an older override's "'n" (= and, a vowel sound) nothing is weakened or elided: "you 'n I"
    const beforeN = i + 1 < n && !brk[i] && words[i + 1] === 'n';
    const fl = inWordFlap(cores[i], x.flapped?.[i]);
    if (fl) {
      forms[i] = fl; // water → wadder
      continue;
    }
    const wk = weak[i];
    if (wk) {
      const f = WEAK_SPEAK[w];
      if (!f || beforeN) continue;
      // weak "and" only between two words; weak "you"/"your" not at the start of a phrase (stressed: "You won?")
      if (w === 'and' ? !andOk(i) : (w === 'you' || w === 'your') && !hasPrev(i)) continue;
      if (w === 'them') continue; // glued onto the previous word in step 3 (tellem), or kept written
      forms[i] = f;
    } else if (elided[i] && !beforeN) {
      const f = ELISION_SPEAK[w];
      if (f && !(w === 'and' && !andOk(i))) forms[i] = f;
    }
  }

  // 3. Boundaries that need two words joined (or the right word changed) for the engine to say them.
  for (let b = 0; b < n - 1; b++) {
    if (brk[b] || glue[b]) continue;
    const L = words[b];
    const R = words[b + 1];
    if (!L || !R) continue;
    const leftGluedIn = b > 0 && glue[b - 1];
    const leftFree = forms[b] === null && red[b] < 0 && !L.includes("'") && !leftGluedIn && !WEAK_FORMS.has(L);
    const rightFree = forms[b + 1] === null && red[b + 1] < 0;
    // a cup of coffee → a cuppa coffee
    if (OF_FUSE[L] && R === 'of' && weak[b + 1]?.spoken === 'ə' && leftFree) {
      forms[b] = OF_FUSE[L];
      forms[b + 1] = '';
      glue[b] = true;
      continue;
    }
    // tell them → tellem, find them → findem (the /əm/ form only; a lone "'em" is read /ɛm/)
    if (R === 'them' && weak[b + 1]?.spoken === 'əm' && leftFree && rightFree && canGlueH(L)) {
      forms[b] = glueStem(L, cores[b]) + 'em';
      forms[b + 1] = '';
      glue[b] = true;
      continue;
    }
    const ev = bev[b];
    if (!ev) continue;
    switch (ev.kind) {
      case 'yod':
        // meet you → meetcha, told you → toldja (not "asked you": the -ed would be read /ɪd/; not after a long word:
        // "apartmentcha"; not a contrastive final "What about you?", where the /u/ is kept)
        const contrastive = L === 'about' && (b + 1 === n - 1 || brk[b + 1]);
        if (R === 'you' && !contrastive && leftFree && rightFree && /[td]$/.test(L) && !/[^e]ed$/.test(L) && L.length <= 7) {
          // should you → "should juh": "shouldja" is read /ʃud/ (SAPI), like couldja / wouldja (see REDUCTIONS)
          forms[b] = cores[b] + (/ould$/.test(L) ? ' juh' : L.endsWith('t') ? 'cha' : 'ja');
          forms[b + 1] = '';
          glue[b] = true;
        } else if (R === 'you' && !contrastive && leftFree && rightFree && /ss$/.test(L) && canGlueH(L)) {
          // miss you → mishu, bless you → Bleshu (SAPI: m ih sh uh; the lesson spelling)
          forms[b] = cores[b].slice(0, -2) + 'shu';
          forms[b + 1] = '';
          glue[b] = true;
        } else if (R === 'year' && /st$/.test(L) && ELISION_SPEAK[L] && leftFree && rightFree) {
          // last year → lass cheer (SAPI: l ae s ch iy r; the lesson spelling): two words, nothing glued
          forms[b] = ELISION_SPEAK[L];
          forms[b + 1] = 'cheer';
        }
        break;
      case 'place':
        // ten minutes → tem minutes, one more → wum more (only the measured m-forms, see PLACE_SPEAK)
        if (PLACE_SPEAK[L] && leftFree) forms[b] = PLACE_SPEAK[L];
        break;
      case 'hdrop': {
        if (R === 'have') {
          // should have called → shoulda called
          if (HAVE_SPEAK[L] && leftFree && rightFree) {
            forms[b] = HAVE_SPEAK[L];
            forms[b + 1] = '';
            glue[b] = true;
          }
          break;
        }
        const h = H_FORMS[R];
        if (!h?.speak || !rightFree) break;
        if (!h.glue) {
          forms[b + 1] = h.speak; // take 'is advice
          break;
        }
        // tell him → tellim, tell her → teller, let him → leddim; otherwise (give him, asked him, about him, from
        // him) the written pronoun stays
        if (leftFree && canGlueH(L)) {
          forms[b] = glueStem(L, cores[b]) + h.speak;
          forms[b + 1] = '';
          glue[b] = true;
        } else if (leftFree && H_GLUE_STEM[L]) {
          // give him → givim, love her → luvver (the stem's consonant doubled before "er": "giver" reads /aɪ/)
          const stem = H_GLUE_STEM[L];
          forms[b] = stem + (h.speak === 'er' ? stem.slice(-1) : '') + h.speak;
          forms[b + 1] = '';
          glue[b] = true;
        }
        break;
      }
      case 'flap': {
        // "got a lot of" → godda lotta: the reduction "a lotta" may take the glue like a plain "a"
        const rightOk = rightFree || (R === 'a' && red[b + 1] >= 0 && reds[red[b + 1]].from === b + 1 && forms[b + 1] === 'a lotta');
        if (L === 'it' && !leftGluedIn && forms[b] === null && red[b] < 0 && rightOk) {
          // "it" + vowel: the t is said as d, but "id" alone is read as the letters I-D (SAPI: ay d iy). So "it" is
          // glued onto the word before when that word takes a glued ending safely (turn it off → Turnid off, check it
          // out → Checkid out, pick it up → Pickid up; is it on → Izzid on), else onto a following "a" (like it a lot
          // → like idda lot). SAPI: t er r n ih d aa f, ih z ih d aa n, ih d ax (measured, the lesson spellings).
          const p = b - 1;
          const P = p >= 0 ? words[p] : '';
          const prevFree =
            p >= 0 && !brk[p] && !(p > 0 && glue[p - 1]) && forms[p] === null && red[p] < 0 && !!P && !P.includes("'") && !WEAK_FORMS.has(P);
          if (prevFree && (canGlueH(P) || P === 'is' || CVC.test(P))) {
            // drop it off → droppid off: a single closing consonant is doubled so the vowel stays short (SAPI:
            // d r aa p ih d; also grabbid, stoppid, runnid)
            if (P === 'is') forms[p] = 'izz';
            else if (!canGlueH(P)) forms[p] = cores[p] + cores[p].slice(-1);
            forms[b] = 'id';
            glue[p] = true;
            break;
          }
        }
        if ((L === 'it' || L === 'at') && R === 'a' && !leftGluedIn && forms[b] === null && red[b] < 0 && forms[b + 1] === null && red[b + 1] < 0) {
          // like it a lot → like idda lot, stayed at a → stayed adda (SAPI: ih d ax, ae d ax)
          forms[b] = L === 'it' ? 'idd' : 'add';
          glue[b] = true;
          break;
        }
        if (R === 'i' && rightFree && leftFree && FLAP_LEFT.test(L) && !/^th/.test(L)) {
          // what I → whaddai, but I → buddai (SAPI: w ae d ay, b ah d ay; the lesson spelling "whaddai"). Not
          // "thaddai": SAPI reads it with /θ/
          forms[b] = cores[b].slice(0, -1) + 'ddai';
          forms[b + 1] = '';
          glue[b] = true;
          break;
        }
        if (leftFree && rightFree && !/^['‘’]/.test(x.tokens[b + 1].raw) && /^[b-df-hj-np-tv-z]+(ee|ai|[aeiou]r)t$/.test(L)) {
          // meet us → meed us, wait in → waid in, start at → stard at: the t written d, the word kept apart ("dd"
          // would shorten the vowel); before "a" a long vowel glues it: wait a → Waida, meet a → meeda (the lesson
          // spelling). SAPI: m iy d, w ey d, s t aa r d, w ey d ax. Not before our own "'is" (hurt 'is: stable output)
          forms[b] = cores[b].slice(0, -1) + 'd';
          if (R === 'a' && !/r$/.test(L.slice(0, -1)) && forms[b + 1] === null && red[b + 1] < 0) glue[b] = true;
          break;
        }
        if (!FLAP_RIGHT.has(R) || !rightOk || !L.endsWith('t')) break;
        // "budda" is read as Buddha (SAPI): but + a stays written
        if (L === 'but' && R === 'a') break;
        if (leftFree && FLAP_LEFT.test(L)) {
          // get a → gedda, put it → puddit, shut up → shuddup; got a → gotta ("godda" is read /goʊdɑ/)
          forms[b] = L === 'got' && R === 'a' ? cores[b] + 't' : cores[b].slice(0, -1) + 'dd';
          glue[b] = true;
        } else if (leftGluedIn && L === 'it' && forms[b] === null) {
          // put it on → puddid on: the chunk is not glued further, but its final t is said as d
          forms[b] = cores[b].slice(0, -1) + 'd';
        }
        break;
      }
    }
  }
  return { forms, glue };
}

/** Capitalise a replaced form when the written word was capitalised (sentence start): what do you → Whaddaya. */
function matchCase(form: string, core: string): string {
  if (!form || !/^\p{Lu}/u.test(core) || (core.length > 1 && core === core.toUpperCase())) return form;
  return form.replace(/^[a-z]/, (c) => c.toUpperCase());
}

/**
 * Rebuild text from the plan. `full`: the whole input (its punctuation and spacing kept, the base of speakText);
 * otherwise tokens[from..to] with their raw punctuation (a segment's `speak`).
 */
export function renderSpeak(x: SpeakInput, plan: SpeakPlan, from: number, to: number, full: boolean): string {
  const { text, spans, cores, tokens } = x;
  let out = full ? text.slice(0, spans[from].start) : text.slice(tokens[from].start, spans[from].start);
  for (let i = from; i <= to; i++) {
    const f = plan.forms[i];
    out += f === null ? cores[i] : matchCase(f, cores[i]);
    if (i < to) out += plan.glue[i] ? '' : text.slice(spans[i].end, spans[i + 1].start);
  }
  out += full ? text.slice(spans[to].end) : text.slice(spans[to].end, tokens[to].end);
  return out;
}
