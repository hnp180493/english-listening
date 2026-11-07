import type { Annotation, DecodeResult, Phenomenon, SpokenSegment, Token } from '../types';
import { tokenize } from './tokenize';
import { planSpeak, renderSpeak, type SpeakInput } from './speak';
import {
  avoidFalseWords,
  finalSound,
  flapWord,
  isAbbreviation,
  ngSyllables,
  RESPELL,
  respellBase,
  rightForm,
  SILENT_H,
  splitFinal,
  startsWithVowelSound,
  type FinalSound,
} from './lexicon';
import {
  CONTRACTIONS,
  H_FORMS,
  H_OF,
  looksLikeParticiple,
  NON_VERB_AFTER_TO,
  REDUCTIONS,
  SUBJECT_PRONOUNS,
  weakRule,
  YOD_TAIL,
  type ReductionEntry,
  type WeakInfo,
} from './tables';

type BKind = 'link' | 'rlink' | 'glide' | 'flap' | 'yod' | 'place' | 'hdrop' | 'elision';

interface BoundaryEvent {
  kind: BKind;
  type: Phenomenon;
  c: string; // final consonant code of the left word ('' for vowels)
  glide?: 'y' | 'w';
}

interface Cand {
  type: Phenomenon;
  from: number;
  to: number;
  original: string;
  spoken: string;
  ipa?: string;
  rule: string;
}

interface Piece {
  tok: number;
  pre: string; // onset received from the previous word
  body: string; // may contain "|" syllable breaks (shown as "-" only when the piece is joined)
  virgin: boolean; // body is still the untouched written word
  joined: boolean; // glued to the previous piece ("-")
}

const PRIORITY: Record<Phenomenon, number> = {
  reduction: 0,
  assimilation: 1,
  'h-dropping': 2,
  contraction: 3,
  'flap-t': 4,
  linking: 5,
  elision: 6,
  'weak-form': 7,
};

const C_IPA: Record<string, string> = { th: 'θ', sh: 'ʃ', ch: 'tʃ', j: 'dʒ', ng: 'ŋ', ks: 'ks', y: 'j' };
const cIpa = (c: string): string => C_IPA[c] ?? c;

const DOES_SUBJECTS = new Set(['he', 'she', 'it', 'that', 'this', 'the', 'your', 'my', 'his', 'her', 'anyone', 'anybody', 'everyone', 'everybody', 'someone']);
const STRONG_AUX = new Set(['can', 'do', 'does', 'are', 'was', 'were', 'have', 'has', 'had', 'would', 'will']);
const ELLIPSIS_PRONOUNS = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it']);
/** Question words: in "Where are you?" / "How was it?" the auxiliary after them stays weak. */
const WH_WORDS = new Set(['what', 'where', 'how', 'who', 'why', 'when', 'which', 'whose']);
const NOUN_DETERMINERS = new Set(['a', 'the', 'this', 'that', 'every', 'each', 'my', 'your', 'his', 'her', 'our', 'their']);
/** Words before "can" that make it a noun (trash can, a can of soda). */
const CAN_NOUN_PREV = new Set(['trash', 'garbage', 'tin', 'soda', 'beer', 'paint', 'watering', 'oil', 'empty', 'old',
  'aluminum', 'coke', 'an', 'one', 'two', 'three']);

/** "that" is a weak conjunction/relative (/ðət/) when a clause follows: "I think that you…". */
const THAT_CLAUSE_NEXT = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it', 'there', 'the', 'a', 'an', 'my', 'your',
  'his', 'her', 'our', 'their', 'this', 'these', 'those', 'some', 'someone', 'somebody', 'everyone', 'everybody',
  'nobody', 'nothing', 'something', 'people', 'all', 'most', 'many', 'no', 'if']);
/** …but not after a preposition / auxiliary / transitive verb, where "that" is a stressed demonstrative. */
const THAT_STRONG_PREV = new Set(['about', 'of', 'for', 'like', 'with', 'at', 'in', 'on', 'by', 'from', 'after',
  'before', 'to', 'than', 'into', 'onto', 'over', 'under', 'without', 'all', 'just', 'is', 'was', 'are', 'were', 'do',
  'does', 'did', 'be', 'and', 'but', 'or', 'not', 'this', 'that', 'how', 'what', 'why', 'where', 'when', 'who',
  'which', 'whose', "isn't", "wasn't", 'take', 'took', 'want', 'need', 'had', 'have', 'has', 'get', 'got', 'buy',
  'bought', 'see', 'saw', 'try', 'eat', 'ate', 'love', 'hate', 'remember', 'forget', 'forgot', 'mean', 'meant']);

const THAT_COPULA_SUBJECTS = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it', 'there']);
/** Words before "is/was that" that make it a question or a demonstrative ("Who is that…", "So is that you?"). */
const THAT_COPULA_BLOCK = new Set(['what', 'who', 'where', 'when', 'why', 'how', 'which', 'so', 'and', 'but', 'or',
  'then', 'well', 'oh', 'now', 'yes', 'no', 'okay', 'ok', 'it', 'this', 'that', 'there', 'here']);

/** Next words that show "some" is a stressed pronoun / contrast ("some of", "some say", "some day"). */
const SOME_STRONG_NEXT = new Set(['of', 'say', 'said', 'think', 'thought', 'believe', 'would', 'will', 'can', 'could',
  'might', 'may', 'are', 'were', 'do', 'did', 'have', 'had', 'like', 'day', 'days', 'one', 'how', 'where', 'body',
  'thing', 'times', 'more', 'too', 'left', 'else']);

/** n → m (ten boys → tem boys) is taught only in clear cases: unstressed function words and numbers… */
const NM_LEFT = new Set(['in', 'on', 'an', 'ten', 'one', 'than', 'then', 'when', 'can', 'seven', 'nine', 'eleven',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'upon']);
/** …and common adjectives ending in -n right before their noun (a green bag, the main point). */
const NM_ADJ = new Set(['green', 'brown', 'golden', 'wooden', 'open', 'broken', 'hidden', 'modern', 'common', 'certain',
  'sudden', 'own', 'main', 'plain', 'clean', 'thin', 'foreign', 'rotten', 'frozen', 'stolen', 'spoken', 'written',
  'chosen', 'human', 'urban', 'german', 'russian', 'indian', 'american', 'italian', 'canadian', 'asian', 'african',
  'mexican', 'woolen', 'fun']);
const NM_NOT_RIGHT = new Set(['be', 'by', 'but', 'been', 'because', 'before', 'both', 'maybe', 'me', 'my', 'more', 'much',
  'must', 'might', 'may', 'behind', 'beside', 'below', 'between', 'beyond', 'past', 'per', 'plus', 'minus', 'perhaps']);

const IPA_VOWEL = /[aeiouəɑɔæʌɛɪʊɝɚ]/;
const ipaCore = (ipa: string): string => ipa.split('~')[0].replace(/[/ˈˌ]/g, '').trim();

/** Final sound of a whole reduction ("lemme" ends in /i/, "cuz" in /z/), read from its IPA. */
function reductionFinal(e: ReductionEntry): FinalSound {
  const core = ipaCore(e.ipa);
  const last = core.slice(-1);
  if (last === 'i' || last === 'ɪ') return { kind: 'vowel', glide: 'y' };
  if (last === 'u' || last === 'ʊ') return { kind: 'vowel', glide: 'w' };
  if (!last || IPA_VOWEL.test(last)) return { kind: 'vowel', glide: null };
  return { kind: 'cons', c: last, afterVowel: IPA_VOWEL.test(core.slice(-2, -1)) };
}

/** Does a reduction start with a vowel SOUND ("ə lotta", "outta" yes; "yoosta" /j/ no)? */
const reductionStartsVowel = (e: ReductionEntry): boolean => IPA_VOWEL.test(ipaCore(e.ipa).charAt(0));

function emptyResult(input: string): DecodeResult {
  return { input, tokens: [], annotations: [], segments: [], spokenText: '', speakText: input };
}

/**
 * Analyse a written English sentence and describe how it is pronounced in
 * natural, fast (General American) speech. Pure function, synchronous, no I/O.
 * Must never throw: empty/garbage input → result with empty tokens.
 */
export function decode(input: string): DecodeResult {
  const text = typeof input === 'string' ? input : '';
  try {
    return analyse(text);
  } catch {
    try {
      const { tokens } = tokenize(text);
      const segments: SpokenSegment[] = tokens.map((t) => ({
        from: t.index,
        to: t.index,
        written: t.raw,
        spoken: t.word || t.raw,
        annotationIds: [],
        speak: t.raw,
      }));
      return { input: text, tokens, annotations: [], segments, spokenText: segments.map((s) => s.spoken).join(' '), speakText: text };
    } catch {
      return emptyResult(text);
    }
  }
}

/** Titles are read as words: "Mr. Brown" → mistər brown. */
const TITLE_SPOKEN: Record<string, string> = { mr: 'mistər', mrs: 'misiz', ms: 'miz', dr: 'doktər' };

function baseDisplay(word: string, core: string): string {
  if (!word || /\d/.test(core)) return core;
  if (TITLE_SPOKEN[word]) return TITLE_SPOKEN[word];
  if (isAbbreviation(word)) return core.replace(/['’]/g, '').toUpperCase();
  if (word === 'i') return 'I';
  if (word.startsWith("i'")) return 'I' + word.slice(1);
  return word;
}

function finalOfDisplay(s: string): FinalSound {
  if (/ə$/.test(s)) return { kind: 'vowel', glide: null };
  return finalSound(s.toLowerCase().replace(/ə/g, 'u').replace(/[^a-z']/g, ''));
}

function analyse(text: string): DecodeResult {
  const { tokens, cores, brk, spans } = tokenize(text);
  const n = tokens.length;
  if (n === 0) return emptyResult(text);
  const words = tokens.map((t) => t.word);
  const base = tokens.map((t, i) => baseDisplay(t.word, cores[i]));
  const display = [...base];
  const red = new Array<number>(n).fill(-1);
  const contr = new Array<boolean>(n).fill(false);
  /** flapped[i]: the flap-T respelling of a word flapped inside itself (water → wadder), for speak.ts. */
  const flapped = new Array<string | null>(n).fill(null);
  const weak: (WeakInfo | null)[] = new Array<WeakInfo | null>(n).fill(null);
  const elided = new Array<boolean>(n).fill(false);
  const cands: Cand[] = [];
  const orig = (from: number, to: number): string => cores.slice(from, to + 1).join(' ');

  // ── 1. Multi-word reductions (highest priority) ──────────────────────────
  const reds: { from: number; to: number; entry: ReductionEntry }[] = [];
  for (let i = 0; i < n; ) {
    let hit: ReductionEntry | null = null;
    for (const e of REDUCTIONS) {
      const len = e.words.length;
      if (i + len > n) continue;
      let ok = true;
      for (let k = 0; k < len; k++) {
        if (words[i + k] !== e.words[k] || (k < len - 1 && brk[i + k])) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (e.needsVerbAfter) {
        const j = i + len;
        if (j >= n || brk[j - 1]) continue;
        const nw = words[j];
        if (!nw || NON_VERB_AFTER_TO.has(nw)) continue;
        if (/^\p{Lu}\p{Ll}/u.test(cores[j]) && nw !== 'i') continue; // proper noun: going to Paris
      }
      if (e.notBeforeVowel) {
        // "out of it" keeps /v/ and links (au-də-vit); it is not "outta it"
        const j = i + len;
        if (j < n && !brk[j - 1] && words[j] && startsWithVowelSound(words[j])) continue;
      }
      hit = e;
      break;
    }
    if (hit) {
      const to = i + hit.words.length - 1;
      const id = reds.length;
      reds.push({ from: i, to, entry: hit });
      for (let k = i; k <= to; k++) red[k] = id;
      cands.push({ type: 'reduction', from: i, to, original: orig(i, to), spoken: hit.spoken, ipa: hit.ipa, rule: hit.rule });
      i = to + 1;
    } else i++;
  }

  // ── 2. Token-level events: contractions, flap T inside words, weak forms ──
  const startsVowelAt = (i: number): boolean => {
    if (i >= n || !words[i]) return false;
    if (red[i] >= 0) return reds[red[i]].from === i && reductionStartsVowel(reds[red[i]].entry);
    if (display[i] !== base[i]) return /^[aeiouəæ]/i.test(display[i]);
    return startsWithVowelSound(words[i]);
  };

  // "them" is unstressed even at the end of a phrase: "find them" → fain-dəm, "tell them" → tel-ləm
  const themWeak = (i: number, pv: string): WeakInfo => {
    // use what the previous word sounds like now ("of" → "ə" ends in a vowel, so no /ð/-drop)
    const pf = !pv
      ? null
      : red[i - 1] >= 0
        ? reductionFinal(reds[red[i - 1]].entry)
        : display[i - 1] !== base[i - 1]
          ? finalOfDisplay(display[i - 1])
          : finalSound(pv);
    return pf && pf.kind === 'cons'
      ? { spoken: 'əm', ipa: '/əm/', rule: weakRule('them', 'əm', '/əm/', 'âm /ð/ rơi mất và dính vào từ trước') }
      : { spoken: 'thəm', ipa: '/ðəm/', rule: weakRule('them', 'thəm', '/ðəm/') };
  };

  // "The problem is that we…": after "<noun> is/was" a subject pronoun starts a clause, so "that" is weak.
  // "Is that you?" (question start) and "Who is that he…" stay strong.
  const copulaThatClause = (i: number): boolean => {
    const pv = words[i - 1];
    if (pv !== 'is' && pv !== 'was') return false;
    if (i < 2 || brk[i - 2] || i + 1 >= n) return false;
    const ppv = words[i - 2];
    return !!ppv && !THAT_COPULA_BLOCK.has(ppv) && THAT_COPULA_SUBJECTS.has(words[i + 1]);
  };

  // have/has/had is an auxiliary before a participle ("have been") or, at the start of a question,
  // before subject + participle ("Where have you been?", "Has he left?"). "Have you any idea?",
  // "I'll have the steak" and "We had it fixed" keep the main verb strong.
  const haveIsAux = (i: number): boolean => {
    if (brk[i] || i + 1 >= n) return false;
    const nx = words[i + 1];
    if (looksLikeParticiple(nx)) return true;
    const pv = i > 0 && !brk[i - 1] ? words[i - 1] : '';
    if (pv && !WH_WORDS.has(pv)) return false;
    return (SUBJECT_PRONOUNS.has(nx) || nx === 'it') && !brk[i + 1] && i + 2 < n && looksLikeParticiple(words[i + 2]);
  };

  const weakFor = (i: number): WeakInfo | null => {
    const w = words[i];
    if (w === 'them' && i > 0 && !brk[i - 1]) return themWeak(i, words[i - 1]);
    if (brk[i] || i + 1 >= n) return null; // phrase-final function words are strong
    const nx = words[i + 1];
    if (!nx) return null;
    const nxV = startsWithVowelSound(nx);
    const pv = i > 0 && !brk[i - 1] ? words[i - 1] : '';
    const mk = (spoken: string, ipa: string, extra = ''): WeakInfo => ({ spoken, ipa, rule: weakRule(w, spoken, ipa, extra) });
    // elliptical question/answer: "Can you?", "Are they?", "Yes, I do" → the auxiliary carries the stress;
    // after a question word ("Where are you?", "How was it?") the auxiliary stays weak
    if (STRONG_AUX.has(w) && ELLIPSIS_PRONOUNS.has(nx) && (brk[i + 1] || i + 2 >= n) && !WH_WORDS.has(pv)) return null;
    // "will not" / "would not" written in full are emphatic
    if ((w === 'will' || w === 'would') && nx === 'not') return null;
    switch (w) {
      case 'a':
        return nxV ? null : mk('ə', '/ə/', 'rất ngắn và dễ bị bỏ sót');
      case 'an':
        return mk('ən', '/ən/', 'âm /n/ thường dính sang từ sau');
      case 'the':
        return nxV
          ? { spoken: 'thee', ipa: '/ði/', rule: "'the' đứng trước nguyên âm đọc là /ði/ ('thee') rồi nối âm /j/ sang từ sau, không đọc /ðə/." }
          : mk('thə', '/ðə/', 'rất nhanh và nhẹ');
      case 'to':
        return nxV ? null : mk('tə', '/tə/', 'không phải /tu/');
      case 'for':
        return mk('fər', '/fər/', "nghe như 'fờ'");
      case 'of':
        // before an h-word that drops its /h/ (of his → ə-viz) the /v/ stays and links
        return nxV || H_OF.has(nx) ? mk('əv', '/əv/') : mk('ə', '/ə/', 'âm /v/ rơi mất trước phụ âm');
      case 'and':
        return mk('ən', '/ən/', 'âm /d/ thường mất');
      case 'but':
        return mk('bət', '/bət/');
      case 'or':
        return mk('ər', '/ər/');
      case 'can':
        // a noun (the can, trash can, a can of soda) or emphatic "can not" is strong
        if (NOUN_DETERMINERS.has(pv) || CAN_NOUN_PREV.has(pv) || nx === 'not' || nx === 'of' || nx === 'opener') return null;
        return mk('kən', '/kən/', "còn 'can't' luôn đọc mạnh /kæn(t)/");
      case 'at':
        return mk('ət', '/ət/');
      case 'from':
        return mk('frəm', '/frəm/', 'chỉ đọc mạnh /frʌm/ khi đứng cuối câu');
      case 'as':
        return mk('əz', '/əz/');
      case 'than':
        return mk('thən', '/ðən/');
      case 'that': {
        // conjunction / relative pronoun ("I think that you…", "the man that I met") is weak;
        // the demonstrative ("that game", "like that", "Is that your bag?") stays strong
        if (!pv || !THAT_CLAUSE_NEXT.has(nx)) return null;
        if (THAT_STRONG_PREV.has(pv) && !copulaThatClause(i)) return null;
        if ((nx === 'it' || nx === 'all') && (brk[i + 1] || i + 2 >= n)) return null; // "is that it?"
        return {
          spoken: 'thət',
          ipa: '/ðət/',
          rule: "'that' ở đây là liên từ (nghĩa 'rằng', nối hai mệnh đề) nên đọc yếu /ðət/ ('thət'). Khi 'that' là từ chỉ định ('cái đó': that game, like that) thì mới đọc mạnh /ðæt/.",
        };
      }
      case 'you':
        return nxV ? null : mk('yə', '/jə/');
      case 'your':
        return mk('yər', '/jər/');
      case 'are':
        return mk('ər', '/ər/', "gần như chỉ còn âm 'r'");
      case 'was':
        return mk('wəz', '/wəz/');
      case 'were':
        return mk('wər', '/wər/');
      case 'have':
      case 'has':
      case 'had': {
        if (!haveIsAux(i)) return null; // "I'll have the steak": main verb, strong
        const sp = w === 'have' ? 'həv' : w === 'has' ? 'həz' : 'həd';
        return mk(sp, `/${sp}/`, 'vì đây là trợ động từ');
      }
      case 'do':
        return SUBJECT_PRONOUNS.has(nx) ? mk('də', '/də/', 'vì đây là trợ động từ để hỏi') : null;
      case 'does':
        return DOES_SUBJECTS.has(nx) ? mk('dəz', '/dəz/', 'vì đây là trợ động từ để hỏi') : null;
      case 'some':
        // "some" before a noun (some water, some people) is weak; as a pronoun or contrast it is strong
        if (SOME_STRONG_NEXT.has(nx)) return null;
        return mk('səm', '/səm/', "vì đứng trước danh từ (một ít, vài); khi đứng một mình (Want some?) hay trước 'of' thì đọc mạnh /sʌm/");
      case 'would':
        return mk('wəd', '/wəd/');
      case 'will':
        return mk('wəl', '/wəl/', "nhiều khi chỉ còn âm /l/ như dạng viết tắt 'll");
      case 'been':
        return mk('bin', '/bɪn/');
      case 'just':
        return {
          spoken: 'jəst',
          ipa: '/dʒəst/',
          rule: "'just' (chỉ, vừa mới) khi không nhấn thường đọc lướt thành /dʒəst/ ('jəst'), nguyên âm rất ngắn.",
        };
      case 'us':
        return mk('əs', '/əs/');
      case 'our':
        return mk('ar', '/ɑr/', "nghe giống 'are'");
      default:
        return null;
    }
  };

  for (let i = 0; i < n; i++) {
    const w = words[i];
    if (!w || red[i] >= 0) continue;
    const c = CONTRACTIONS[w];
    if (c) {
      contr[i] = true;
      display[i] = c.spoken;
      cands.push({ type: 'contraction', from: i, to: i, original: cores[i], spoken: c.spoken, ipa: c.ipa, rule: c.rule });
      continue;
    }
    const fw = flapWord(w);
    if (fw) {
      // shown whole, the word must not read as another English word: writing → riding (not "raiding");
      // display keeps the table spelling so a split still reads rai-ding, raidə-ris (render applies the same check)
      display[i] = fw;
      const f = avoidFalseWords(fw);
      flapped[i] = f;
      cands.push({
        type: 'flap-t',
        from: i,
        to: i,
        original: cores[i],
        spoken: f,
        rule: `Trong '${cores[i]}', âm /t/ nằm giữa hai nguyên âm và âm tiết sau không nhấn, nên giọng Mỹ đọc thành /ɾ/ nghe gần như 'd': '${f}'.`,
      });
      continue;
    }
    const wk = weakFor(i);
    if (wk) {
      weak[i] = wk;
      display[i] = wk.spoken;
    }
  }

  // ── 3. Boundary events (one per word boundary, by priority) ──────────────
  const leftFinal = (i: number): FinalSound => {
    if (red[i] >= 0) return reductionFinal(reds[red[i]].entry);
    if (display[i] !== base[i] && words[i] !== 'and') return finalOfDisplay(display[i]);
    return finalSound(words[i]);
  };
  const dropWeak = (i: number) => {
    if (weak[i]) {
      weak[i] = null;
      display[i] = base[i];
    }
  };
  const dropTD = (i: number): string => {
    const w = words[i];
    if (w === 'and') return 'ən';
    // didn't → didn; don't → dohn (its vowel is not what the letters say)
    if (/n't$/.test(w)) return RESPELL[w] ? RESPELL[w].replace(/t$/, '') : w.replace(/n't$/, 'n');
    const r = respellBase(w);
    return /[td]$/.test(r) ? r.slice(0, -1) : r;
  };

  const bev: (BoundaryEvent | null)[] = new Array<BoundaryEvent | null>(Math.max(0, n - 1)).fill(null);
  for (let b = 0; b < n - 1; b++) {
    if (brk[b]) continue;
    const rl = red[b] >= 0; // left word ends a reduction ("cuz I" → cu-zai)
    const rr = red[b + 1] >= 0; // right word starts a reduction ("has a lot of" → ha-zə lotta)
    if (rl && red[b] === red[b + 1]) continue; // inside one reduction
    if ((rl && reds[red[b]].to !== b) || (rr && reds[red[b + 1]].from !== b + 1)) continue;
    const L = words[b];
    const R = words[b + 1];
    if (!L || !R) continue;
    if (/\)$/.test(display[b])) continue; // can't → kæn(t): taught as a contraction
    const lf = leftFinal(b);
    const rv = startsVowelAt(b + 1);
    const cons = lf.kind === 'cons' ? lf.c : '';
    let ev: BoundaryEvent | null = null;

    // assimilation: yod coalescence (want you → wan-chu)
    if (cons && !rr && YOD_TAIL[R] !== undefined && L !== 'and' && ['t', 'd', 's', 'z'].includes(cons)) {
      ev = { kind: 'yod', type: 'assimilation', c: cons };
    }
    // assimilation: n → m before b/p/m (ten boys → tem boys), only in clear, teachable cases
    if (
      !ev &&
      cons === 'n' &&
      !rr &&
      /^[bpm]/.test(R) &&
      /^[bpm]/.test(display[b + 1]) &&
      (NM_LEFT.has(L) ? !(L === 'can' && R === 'be') : NM_ADJ.has(L) && !NM_NOT_RIGHT.has(R))
    ) {
      ev = { kind: 'place', type: 'assimilation', c: cons };
    }
    // h-dropping (tell him → tel-lim)
    if (!ev && cons && !rr && H_FORMS[R] && L !== 'and') {
      let ok = true;
      if (['he', 'his', 'have', 'has', 'had'].includes(R) && brk[b + 1]) ok = false;
      // auxiliary only: before a participle (should have known) or in a question (where have you been)
      if (ok && (R === 'have' || R === 'has' || R === 'had')) ok = haveIsAux(b + 1);
      if (ok) ev = { kind: 'hdrop', type: 'h-dropping', c: cons };
    }
    // flap T across words (get it → ge-dit)
    if (!ev && (cons === 't' || cons === 'd') && lf.kind === 'cons' && lf.afterVowel && rv) {
      ev = { kind: 'flap', type: 'flap-t', c: cons };
    }
    // linking: consonant → vowel, linking R, /j/ /w/ glides
    if (!ev && rv) {
      // weak "and" (ən) links with its /n/: and I → ə-nai
      if (cons) ev = { kind: cons === 'r' ? 'rlink' : 'link', type: 'linking', c: L === 'and' && display[b] === 'ən' ? 'n' : cons };
      else if (lf.kind === 'vowel' && lf.glide) ev = { kind: 'glide', type: 'linking', c: '', glide: lf.glide };
    }
    // elision: t/d between consonants (next day → nex day)
    if (
      !ev &&
      (cons === 't' || cons === 'd') &&
      lf.kind === 'cons' &&
      !lf.afterVowel &&
      !rv &&
      !rl &&
      !contr[b] &&
      (display[b] === base[b] || L === 'and' || L === 'just')
    ) {
      ev = { kind: 'elision', type: 'elision', c: cons };
    }
    if (!ev) continue;
    bev[b] = ev;
    if (ev.kind === 'yod') {
      // the left weak form survives (as you → ə-zhu); "you" itself is rebuilt from YOD_TAIL
      dropWeak(b + 1);
    } else if (ev.kind === 'hdrop') {
      weak[b + 1] = null;
      display[b + 1] = H_FORMS[R].spoken;
    } else if (ev.kind === 'elision') {
      weak[b] = null;
      display[b] = dropTD(b);
      elided[b] = true;
    }
  }

  // ── 3b. Speakable (TTS) text, from the same analysis (speak.ts) ─────────
  const sx: SpeakInput = { text, tokens, cores, spans, brk, words, red, reds, contr, weak, bev, elided, flapped };
  const plan = planSpeak(sx);

  // ── 4. Respelling engine (shared by annotations and segments) ────────────
  const mkPiece = (i: number): Piece =>
    red[i] >= 0
      ? { tok: i, pre: '', body: reds[red[i]].entry.spoken, virgin: false, joined: false } // a whole reduction is one piece
      : { tok: i, pre: '', body: display[i], virgin: display[i] === base[i], joined: false };
  const inside = (b: number): boolean => red[b] >= 0 && red[b] === red[b + 1];
  const splitPiece = (p: Piece) => splitFinal(p.virgin ? respellBase(words[p.tok]) : p.body);
  const stripSilentH = (p: Piece) => {
    if (!p.pre && SILENT_H.test(words[p.tok]) && /^h/i.test(p.body)) {
      p.body = p.body.replace(/^h/i, '');
      p.virgin = false;
    }
  };
  // A word that receives a sound from the previous one is shown respelled so it reads
  // naturally: "good idea" → goo-dai-dea (not "goo-didea"), "had enough" → ha-di-nuff.
  const receive = (p: Piece) => {
    p.joined = true;
    if (red[p.tok] >= 0) return;
    const w = words[p.tok];
    if (p.virgin) {
      const f = rightForm(w);
      // keep "virgin" when the spelling is fine as is, so a later split still uses respellBase (is → iz)
      if (f !== p.body) {
        p.body = f;
        p.virgin = false;
      }
    } else if (elided[p.tok] && w !== 'and') {
      // "around ten" lost its /d/: show the respelled word without it (ə-raun)
      const f = rightForm(w);
      if (f !== w) p.body = /[td]$/.test(f) ? f.slice(0, -1) : f;
    }
    stripSilentH(p);
  };
  const render = (p: Piece): string => {
    let body = p.body;
    if (p.joined && /^I/.test(body)) body = 'ai' + body.slice(1).replace(/'/g, '');
    body = body.replace(/\|/g, p.joined ? '-' : '');
    // a respelled syllable must not read as another English word: in-said → in-side, ye-said → ye-side
    return p.virgin ? p.pre + body : avoidFalseWords(p.pre + body);
  };
  const renderAll = (pieces: Piece[], seps: string[]): string => {
    let out = '';
    pieces.forEach((p, k) => {
      const r = render(p);
      if (!r) return;
      out = out ? out + (seps[k - 1] ?? ' ') + r : r;
    });
    return out;
  };
  const join = (pieces: Piece[], seps: string[], b: number) => {
    const ev = bev[b];
    const left = pieces[pieces.length - 1];
    const right = mkPiece(b + 1);
    if (!ev) {
      seps.push(' ');
      pieces.push(right);
      return;
    }
    switch (ev.kind) {
      case 'link':
      case 'rlink':
      case 'flap':
      case 'hdrop': {
        receive(right);
        const sp = splitPiece(left);
        if (sp) {
          left.body = sp.stem;
          left.virgin = false;
          let on = sp.onset;
          const lf = finalSound(words[b]);
          if (on === 't' && (ev.kind === 'flap' || (ev.kind === 'hdrop' && lf.kind === 'cons' && lf.afterVowel))) on = 'd';
          right.pre = on;
        } else if (ev.c === 'ng' && red[left.tok] < 0) {
          // "ng" stays put, but the -ing syllable shows the flow: looking at → loo-king-at
          // written word → converted once inside ngSyllables; a respelled body (raiding) is kept as is
          const lw = words[left.tok];
          const ng = left.virgin ? ngSyllables(RESPELL[lw] ?? lw, !!RESPELL[lw]) : ngSyllables(left.body, true);
          if (ng) {
            left.body = ng;
            left.virgin = false;
          }
        }
        seps.push('-');
        break;
      }
      case 'glide':
        receive(right);
        right.pre = ev.glide ?? '';
        seps.push('-');
        break;
      case 'yod': {
        right.body = YOD_TAIL[words[b + 1]] ?? right.body;
        right.virgin = false;
        right.joined = true;
        if (ev.c === 'd') right.pre = 'j';
        else {
          const sp = splitPiece(left);
          if (sp) {
            left.body = sp.stem.replace(ev.c === 't' ? /t$/ : /[sz]$/, '');
            left.virgin = false;
          }
          right.pre = ev.c === 't' ? 'ch' : ev.c === 's' ? 'sh' : 'zh';
        }
        seps.push('-');
        break;
      }
      case 'place': {
        const sp = splitPiece(left);
        if (sp && sp.onset === 'n') {
          left.body = sp.stem + 'm';
          left.virgin = false;
        }
        seps.push(' ');
        break;
      }
      case 'elision':
        seps.push(' ');
        break;
    }
    pieces.push(right);
  };
  const speakRange = (from: number, to: number): string => {
    const pieces = [mkPiece(from)];
    const seps: string[] = [];
    for (let b = from; b < to; b++) if (!inside(b)) join(pieces, seps, b);
    return renderAll(pieces, seps);
  };

  // ── 5. Annotations for boundary events and weak forms ────────────────────
  for (let b = 0; b < bev.length; b++) {
    const ev = bev[b];
    if (!ev) continue;
    const L = cores[b];
    const R = cores[b + 1];
    // a boundary touching a reduction spans the whole reduction: "has a lot of" → "ha-zə lotta"
    const from = red[b] >= 0 ? reds[red[b]].from : b;
    const to = red[b + 1] >= 0 ? reds[red[b + 1]].to : b + 1;
    const spoken = speakRange(from, to);
    let rule = '';
    let ipa: string | undefined;
    switch (ev.kind) {
      case 'link':
        rule = `Phụ âm cuối /${cIpa(ev.c)}/ của '${L}' nối sang nguyên âm đầu của '${R}', hai từ đọc liền như một: '${spoken}'.`;
        break;
      case 'rlink':
        rule = `Giọng Mỹ luôn phát âm /r/ cuối; /r/ của '${L}' nối thẳng sang nguyên âm của '${R}': '${spoken}'.`;
        break;
      case 'glide':
        rule =
          ev.glide === 'y'
            ? `'${L}' kết thúc bằng âm /i/ nên khi gặp nguyên âm của '${R}' sẽ chèn âm /j/ (y) để nối: '${spoken}'.`
            : `'${L}' kết thúc bằng âm /u/ nên khi gặp nguyên âm của '${R}' sẽ chèn âm /w/ để nối: '${spoken}'.`;
        break;
      case 'flap':
        rule =
          ev.c === 't'
            ? `/t/ cuối '${L}' kẹp giữa hai nguyên âm khi nối sang '${R}', giọng Mỹ đọc thành âm bật nhẹ /ɾ/ nghe như 'd': '${spoken}'.`
            : `/d/ cuối '${L}' kẹp giữa hai nguyên âm nên được bật rất nhẹ /ɾ/ và nối luôn sang '${R}': '${spoken}'.`;
        ipa = '/ɾ/';
        break;
      case 'yod': {
        const res = ev.c === 't' ? 'tʃ' : ev.c === 'd' ? 'dʒ' : ev.c === 's' ? 'ʃ' : 'ʒ';
        const tail = spoken.split('-').pop() ?? spoken;
        rule = `Âm /${ev.c}/ cuối '${L}' gặp /j/ của '${R}' nên hòa thành /${res}/ — nghe như '${tail}'.`;
        ipa = `/${ev.c}/ + /j/ → /${res}/`;
        break;
      }
      case 'place':
        rule = `/n/ cuối '${L}' đứng trước âm môi /${words[b + 1][0]}/ nên môi khép sớm, /n/ biến thành /m/: '${spoken}'.`;
        ipa = '/n/ → /m/';
        break;
      case 'hdrop': {
        const h = H_FORMS[words[b + 1]];
        rule = `'${R}' không nhấn nên mất âm /h/, phần còn lại '${h.spoken}' dính vào phụ âm cuối của '${L}': '${spoken}'.`;
        ipa = h.ipa;
        break;
      }
      case 'elision':
        rule =
          words[b] === 'and'
            ? `'and' trước phụ âm đọc lướt thành 'ən': âm /d/ bị nuốt hẳn, nghe là '${spoken}'.`
            : `Âm /${ev.c}/ cuối '${L}' bị kẹp giữa hai phụ âm (trước '${R}') nên gần như biến mất: '${spoken}'.` +
              (/[^e]ed$/.test(words[b]) ? ' Đuôi -ed gần như không nghe thấy, hãy dựa vào ngữ cảnh để nhận ra thì quá khứ.' : '');
        break;
    }
    cands.push({ type: ev.type, from, to, original: orig(from, to), spoken, ipa, rule });
  }
  for (let i = 0; i < n; i++) {
    const wk = weak[i];
    if (wk) cands.push({ type: 'weak-form', from: i, to: i, original: cores[i], spoken: wk.spoken, ipa: wk.ipa, rule: wk.rule });
  }

  cands.sort((a, b) => a.from - b.from || a.to - b.to || PRIORITY[a.type] - PRIORITY[b.type]);
  const annotations: Annotation[] = cands.map((c, k) => {
    const a: Annotation = { id: `a${k + 1}`, type: c.type, from: c.from, to: c.to, original: c.original, spoken: c.spoken, rule: c.rule };
    if (c.ipa) a.ipa = c.ipa;
    // its own words in connected form, widened only where a joined spoken chunk would be cut (him I'll → Tellim I'll)
    let f = c.from;
    let t = c.to;
    while (f > 0 && plan.glue[f - 1]) f--;
    while (t < n - 1 && plan.glue[t]) t++;
    a.speak = renderSpeak(sx, plan, f, t, false);
    return a;
  });

  // ── 6. Segments: partition tokens, gluing across annotated boundaries ────
  const glued = (b: number): boolean => {
    if (red[b] >= 0 && red[b] === red[b + 1]) return true;
    const ev = bev[b];
    return !!ev && ev.kind !== 'elision';
  };
  const byToken: string[][] = tokens.map(() => []);
  for (const a of annotations) for (let k = a.from; k <= a.to; k++) byToken[k].push(a.id);
  const segments: SpokenSegment[] = [];
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n - 1 && glued(j)) j++;
    const spoken = speakRange(i, j);
    const ids: string[] = [];
    for (let k = i; k <= j; k++) for (const id of byToken[k]) if (!ids.includes(id)) ids.push(id);
    segments.push({
      from: i,
      to: j,
      written: tokens.slice(i, j + 1).map((t: Token) => t.raw).join(' '),
      spoken: spoken || base[i],
      annotationIds: ids,
      speak: renderSpeak(sx, plan, i, j, false),
    });
    i = j + 1;
  }

  return {
    input: text,
    tokens,
    annotations,
    segments,
    spokenText: segments.map((s) => s.spoken).join(' '),
    speakText: renderSpeak(sx, plan, 0, n - 1, true),
  };
}

const speakCache = new Map<string, string>();

/**
 * The CONNECTED text to send to a TTS engine (the main "Nghe"): decode(override || text).speakText.
 *   speakableFor("Tell him I'll call him back.") → "Tellim I'll callim back."
 * `override` is an authored `say` (lesson example / compare / quiz `say`, Sentence.say, chunk ttsText, EXAMPLE_SAY).
 * It may be standard text ("What do you wanna do?") or already eye dialect ("I'm gonna geda cuppa coffee."): it is
 * run through the decoder too, which leaves eye dialect unchanged (tested), so every `say` field works the same.
 * For the careful "Đọc rõ từng từ" playback send the WRITTEN text itself, not this. Pure, never throws, memoised.
 */
export function speakableFor(text: string, override?: string | null): string {
  const o = typeof override === 'string' ? override.trim() : '';
  const t = o || (typeof text === 'string' ? text : '');
  const hit = speakCache.get(t);
  if (hit !== undefined) return hit;
  const out = decode(t).speakText ?? t;
  if (speakCache.size >= 500) speakCache.clear();
  speakCache.set(t, out);
  return out;
}
