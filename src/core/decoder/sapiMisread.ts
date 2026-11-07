// Test helper data: TTS spellings that must never be sent to the voice (see speak.ts).
/**
 * Spellings Microsoft David (SAPI) was measured to misread (phonemes captured 2026-11-07): ta /tɑ/, ya /jæ/,
 * jus /dʒuz/, firs /fɜrz/, Han /hɑn/, coupla /kuplə/, godda /goʊdɑ/, budda "Buddha", wouldja/couldja/shouldja /u/,
 * whaddidja (an extra syllable), aboutim /ʊ/, fromim /oʊ/, aboutcha (a contrastive "you" over-reduced); and
 * (2026-11-07, second pass) id "I-D" (a lone flapped "it"), om "O-M" / im "I'm" (on / in before b, m, p), firss /
 * firsst /fɜrzɪz/, couldn /u/, thaddai /θ/, almose / almosst (vowel), restauran (stress), eed (letters). Checked on
 * generated text (speak.test.ts) and on authored say / ttsText (src/data/say.test.ts); add a spelling here once it
 * is measured wrong.
 */
export const SAPI_MISREAD =
  /\b(ta|ya|jus|firs|han|coupla|godda|budda|wouldja|couldja|shouldja|whaddidja|aboutim|fromim|aboutcha|id|om|im|firss|firsst|couldn|thaddai|almose|almosst|restauran|eed)\b/i;
/** A lone "'n" (the letter N), "'er" (E-R), "'em" (/ɛm/) or "'im" ("I'm"). "'is" reads /ɪz/ and is allowed. */
export const LONE_APOSTROPHE = /(^|[^A-Za-z])'(n|er|em|im)\b/;
