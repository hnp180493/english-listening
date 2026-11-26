// The places Rico's dispatch office sends cars to (core/town/dispatch.ts; docs/town.md §27): every one a place of
// Westbay's map (data/cityWorld.ts CITY_PLACES, by its id), with the name callers and drivers say, the short label of
// the map on the gatehouse wall, and the words that name it in a caller's sentence (the content test checks every call
// names its two places with them).
//
// The point of the office is the pairs below: places a careless ear takes for each other in connected speech, or the
// place next door that a half-heard sentence lands on. Each call's `fromNear` / `toNear` is the other half of a pair.

export interface DispatchPlace {
  /** A place id of data/cityWorld.ts. */
  id: string;
  /** How people say it, in a sentence: "the ferry", "Gianna's". Never starts a sentence (the templates check). */
  en: string;
  /** The label on the wall map (English, as on the signs). */
  label: string;
  /** Lower-case words that name it in a caller's sentence (any one is enough). */
  keys: readonly string[];
}

export const DISPATCH_PLACES: readonly DispatchPlace[] = [
  // Ga & bến xe
  { id: 'okafor', en: 'Central Station', label: 'Station', keys: ['station'] },
  { id: 'pete', en: 'lost property', label: 'Lost property', keys: ['lost property'] },
  { id: 'tess', en: "Tess's coffee cart", label: 'Coffee cart', keys: ['coffee cart'] },
  { id: 'rico', en: 'the taxi rank', label: 'Taxi rank', keys: ['taxi rank'] },
  // Chợ cũ
  { id: 'frank', en: "Frank's comic stall", label: 'Comics', keys: ["frank's", 'comic'] },
  { id: 'poppy', en: 'Twin Ovens', label: 'Twin Ovens', keys: ['twin ovens', 'bakery'] },
  { id: 'gianna', en: "Gianna's", label: "Gianna's", keys: ['gianna'] },
  { id: 'hal', en: "Hal's fish stall", label: 'Fish stall', keys: ["hal's", 'fish stall'] },
  { id: 'amira', en: "Amira's spice stall", label: 'Spices', keys: ['amira', 'spice'] },
  // Phố nghệ thuật
  { id: 'bo', en: "Bo's karaoke", label: "Bo's", keys: ["bo's", 'karaoke'] },
  { id: 'iris', en: 'the Lumen', label: 'Lumen', keys: ['lumen', 'films'] },
  { id: 'claire', en: 'Harbour Press', label: 'Harbour Press', keys: ['harbour press', 'bookshop'] },
  { id: 'kit', en: 'Bay FM', label: 'Bay FM', keys: ['bay fm', 'radio building'] },
  // Khu văn phòng
  { id: 'priya', en: 'Meridian', label: 'Meridian', keys: ['meridian'] },
  { id: 'whitlock', en: 'the paper kiosk', label: 'Kiosk', keys: ['kiosk'] },
  { id: 'vivian', en: 'Loom', label: 'Loom', keys: ['loom'] },
  { id: 'colin', en: 'FreshWay', label: 'FreshWay', keys: ['freshway'] },
  // Đại học & bệnh viện
  { id: 'osei', en: 'the hospital', label: 'Hospital', keys: ['hospital'] },
  { id: 'adeyemi', en: 'the phonetics lab', label: 'Phonetics lab', keys: ['lab'] },
  { id: 'finch', en: 'the library', label: 'Library', keys: ['library'] },
  { id: 'nell', en: 'the pharmacy', label: 'Pharmacy', keys: ['pharmacy'] },
  // Bến cảng
  { id: 'jun', en: "Jun's repair stall", label: "Jun's", keys: ["jun's"] },
  { id: 'marcus', en: 'the Bay FM stage', label: 'Stage', keys: ['stage'] },
  { id: 'fay', en: 'the big wheel', label: 'Big wheel', keys: ['big wheel'] },
  { id: 'odile', en: 'the ferry', label: 'Ferry', keys: ['ferry'] },
  { id: 'gus', en: 'the harbour gate', label: 'Harbour gate', keys: ['harbour gate', "gus's"] },
  { id: 'mei', en: "Mei's dumplings", label: "Mei's", keys: ["mei's", 'dumpling'] },
  { id: 'sol', en: "Sol's lanterns", label: "Sol's", keys: ["sol's", 'lantern'] },
];

export const dispatchPlace = (id: string): DispatchPlace | undefined => DISPATCH_PLACES.find((p) => p.id === id);

/** Where the office is (the old gatehouse beside Gus's hut on Pier Road): drawn on the wall map, not a fare's place. */
export const OFFICE_AT = 'gus';

/**
 * Places a caller's pickup or destination is taken for. `sound`: they sound alike in connected speech; `door`: the
 * place next door, where a half-heard sentence lands. WHY each pair, in a comment.
 */
export const DISPATCH_ALIKES: readonly { a: string; b: string; kind: 'sound' | 'door' }[] = [
  // "the pharmacy" said fast is "the FARM-sy": the unstressed middle shrinks, and what is left is a stressed /f/ syllable
  // and a weak "-ee", the shape of "the FER-ry". Both are said after "to" / "at", where the article is a bare /ðə/.
  { a: 'nell', b: 'odile', kind: 'sound' },
  // "the Lumen" is LOO-mn: the second syllable is a weak schwa + n, swallowed into the next word ("the Loom'n on Arts
  // Street"), which leaves "Loom", the design studio's name.
  { a: 'iris', b: 'vivian', kind: 'sound' },
  // "station" and "stage": the same stressed /steɪ/, then a short soft ending (/ʃn/, /dʒ/) that is barely released
  // before the next word ("the station to…", "the stage to…").
  { a: 'okafor', b: 'marcus', kind: 'sound' },
  // "Bay FM" (the radio building on Arts Street) and "the Bay FM stage" (down at the harbour): the same words, and
  // "stage" comes last, low and quick, where a sentence trails off.
  { a: 'kit', b: 'marcus', kind: 'sound' },
  // "Mei's" and "Fay's" rhyme (/meɪz/, /feɪz/): one lip consonant apart, said alone after a pause with nothing round
  // them to help. Fay sells the big wheel's tickets, and people say "Fay's" for the wheel.
  { a: 'mei', b: 'fay', kind: 'sound' },
  // "the big wheel" and "the ferry" sit side by side on Quay Street, and "Fay's" (the wheel) is one vowel from "fer-"
  // when the /z/ links into a vowel: "Fay's on…" / "ferry on…".
  { a: 'fay', b: 'odile', kind: 'sound' },
  // "Hal's" loses its h after a consonant ("at Hal's" = "a-TALS"), and "at Sol's" runs t into s: two short words that
  // both end /-lz/ after "at".
  { a: 'hal', b: 'sol', kind: 'sound' },
  // "the library", said the everyday way, is "LIE-bree": an l, a b, a short ending, the frame of "the lab" with one
  // more syllable that is easy to miss.
  { a: 'finch', b: 'adeyemi', kind: 'sound' },
  // "Jun's" and "Gus's": the same short /ʌ/ between a soft consonant and an s; over a phone line the j / g and the
  // n / s are what goes first.
  { a: 'jun', b: 'gus', kind: 'sound' },
  // "Harbour Press" and "the harbour gate": the stressed "HAR-bour" carries both; the short word after it ("Press",
  // "gate") is unstressed, its end unreleased before the next word.
  { a: 'claire', b: 'gus', kind: 'sound' },
  // "Frank's" said fast is "Franss" (the k swallowed between n and s), and "FreshWay" starts with the same /fr/ and a
  // short front vowel.
  { a: 'frank', b: 'colin', kind: 'sound' },
  // next door: lost property is inside the station; "lost property at the station" heard by its last word is the station
  { a: 'okafor', b: 'pete', kind: 'door' },
  // next door: the paper kiosk stands outside Meridian; "the kiosk by Meridian" heard by its last word is Meridian
  { a: 'priya', b: 'whitlock', kind: 'door' },
  // next door: the pharmacy is across from the hospital, and callers correct themselves between the two
  { a: 'osei', b: 'nell', kind: 'door' },
  // next door: Twin Ovens and Gianna's share Market Street, and Poppy bakes Gianna's bread
  { a: 'poppy', b: 'gianna', kind: 'door' },
  // next door: Tess's cart stands at the taxi rank's end of the plaza
  { a: 'rico', b: 'tess', kind: 'door' },
  // next door: Bo's karaoke and the Lumen, a few doors apart on Arts Street
  { a: 'bo', b: 'iris', kind: 'door' },
  // next door: Hal's fish and Amira's spices, two stalls of the market square
  { a: 'hal', b: 'amira', kind: 'door' },
];

/** The places taken for `id` (either side of a pair). */
export function alikesOf(id: string): string[] {
  return DISPATCH_ALIKES.flatMap((p) => (p.a === id ? [p.b] : p.b === id ? [p.a] : []));
}
