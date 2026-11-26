// The police scanner of Westbay (docs/town.md §28, docs/gta-plan.md §4.1 "Mày nghe bộ đàm cảnh sát"): bulletins MADE
// from the real state of a search (./police.ts), in the words of data/city/streets/scannerLines.ts. Every bulletin is
// true of the facts it was made from (tested): the road, the heading, the place, the vehicle, its colour, the top. It
// says what the police KNOW (the last sighting), which is what the learner has to hear to get away. Pure.

import type { VehicleKind } from '../../data/townWorld';
import {
  COLOUR_VI,
  DESCRIBE,
  DESCRIBE_STILL,
  HEADING_VI,
  LOST,
  LOST_LOOK,
  NUMBER_WORD,
  OFFICER_BYE,
  OFFICER_INTENTS,
  OFFICER_OPEN,
  OFFICER_QUESTIONS,
  OFFICER_RIGHT,
  OFFICER_WRONG,
  GOING_WORD,
  SOMETHING,
  WHO_WORD,
  SPOTTED,
  SPOTTED_NEAR,
  START_WHAT,
  START_WHAT_NEAR,
  THING_WORD,
  TOP,
  UNIT_COPY,
  UPDATE_NEAR,
  UPDATE_ROAD,
  VEHICLE_WORD,
  type ScanTemplate,
} from '../../data/city/streets/scannerLines';
import type { Look, Offence } from './police';
import type { Compass } from './streets';

/** The colour of each vehicle model (vehicles3d.ts BODY, by its index) in a plain English word. */
const VEHICLE_COLOUR: Readonly<Record<VehicleKind, readonly string[]>> = {
  bike: ['red', 'green', 'yellow', 'black'],
  scooter: ['green', 'pink', 'blue', 'white'],
  car: ['pink', 'blue', 'yellow', 'red'],
  horse: ['brown', 'brown', 'brown', 'white'],
  motorbike: ['red'],
  sportscar: ['yellow'],
};
export function vehicleColour(kind: VehicleKind, v: number): string {
  const list = VEHICLE_COLOUR[kind];
  return list[((Math.floor(v) % list.length) + list.length) % list.length];
}

/** The colour of each top of the wardrobe (data/townGame.ts outfits), in a plain English word. */
const OUTFIT_COLOUR: Readonly<Record<string, string>> = {
  'ao-xanh-la': 'green',
  'ao-do': 'red',
  'ao-vang': 'yellow',
  'ao-cam': 'orange',
  'ao-hong': 'pink',
  'ao-tim': 'purple',
  'ao-trang': 'white',
  'ao-den': 'black',
  'ao-bac': 'silver',
  'ao-kim-tuyen': 'gold',
};
export const outfitColour = (id: string | null | undefined): string | null => (id ? (OUTFIT_COLOUR[id] ?? null) : null);

/** The facts a bulletin is made from. */
export interface ScanFacts {
  unit: number;
  look: Look;
  /** The street (its name), the heading, the place near (its spoken name; and its Vietnamese name for the meaning). */
  road: string | null;
  heading: Compass | null;
  near: string | null;
  nearVi: string | null;
  offence: Offence;
  /** What was knocked over (furniture kind), for an offence of kind 'thing'. */
  thing: string | null;
}

export interface ScanLine {
  who: 'dispatch' | 'unit' | 'officer' | 'you';
  text: string;
  vi: string;
}

/** "on a red scooter", "in a blue car", "on foot". */
export function lookPhrase(look: Look): { en: string; vi: string } {
  if (look.on === 'foot') return { en: 'on foot', vi: GOING_WORD.foot.vi };
  const w = VEHICLE_WORD[look.on];
  const colour = look.colour ? `${look.colour} ` : '';
  const article = /^[aeiou]/.test(colour || w.en) ? 'an' : 'a';
  const cv = look.colour ? ` ${COLOUR_VI[look.colour]?.vi ?? look.colour}` : '';
  return { en: `${w.inside ? 'in' : 'on'} ${article} ${colour}${w.en}`, vi: `${GOING_WORD[w.inside ? 'inside' : 'on'].vi} ${w.vi}${cv}` };
}

function fill(t: ScanTemplate, f: ScanFacts, who: ScanLine['who']): ScanLine {
  const look = lookPhrase(f.look);
  const thing = f.thing ? THING_WORD[f.thing] : null;
  const unit = NUMBER_WORD[f.unit] ?? String(f.unit);
  const person = WHO_WORD[f.look.on === 'foot' ? 'foot' : VEHICLE_WORD[f.look.on].inside ? 'inside' : 'on'];
  const whoWord = person.en;
  const whoVi = person.vi;
  const en: Record<string, string> = { unit, look: look.en, who: whoWord, top: f.look.outfit ?? '', road: f.road ?? '', heading: f.heading ?? '', near: f.near ?? '', thing: thing?.en ?? SOMETHING.en };
  const vi: Record<string, string> = {
    unit: String(f.unit),
    look: look.vi,
    who: whoVi,
    top: f.look.outfit ? (COLOUR_VI[f.look.outfit]?.vi ?? f.look.outfit) : '',
    road: f.road ?? '',
    heading: f.heading ? HEADING_VI[f.heading].vi : '',
    near: f.nearVi ?? f.near ?? '',
    thing: thing?.vi ?? SOMETHING.vi,
  };
  const put = (s: string, w: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => w[k] ?? '');
  const text = put(t.text, en);
  return { who, text: text[0].toUpperCase() + text.slice(1), vi: put(t.vi, vi) };
}

const pickOf = <T,>(list: readonly T[], n: number): T => list[((Math.floor(n) % list.length) + list.length) % list.length];

/** The description of the learner: the vehicle (and the heading when moving), then the top. */
function describe(f: ScanFacts): ScanLine[] {
  const out = [fill(f.heading ? DESCRIBE : DESCRIBE_STILL, f, 'dispatch')];
  if (f.look.outfit) out.push(fill(TOP, f, 'dispatch'));
  return out;
}

export type ScanKind = 'start' | 'update' | 'spotted' | 'lost' | 'lostLook';

/** A bulletin of the scanner, made from the facts (`pick` chooses among the wordings). */
export function scanLines(kind: ScanKind, f: ScanFacts, pick = 0): ScanLine[] {
  if (kind === 'start') {
    const what = f.road ? START_WHAT[f.offence] : f.near ? START_WHAT_NEAR[f.offence] : null;
    return [...(what ? [fill(what, f, 'dispatch')] : []), ...describe(f), fill(pickOf(UNIT_COPY, pick), f, 'unit')];
  }
  if (kind === 'update') {
    if (f.road && f.heading) return [fill(pickOf(UPDATE_ROAD, pick), f, 'dispatch'), ...(f.look.outfit ? [fill(TOP, f, 'dispatch')] : [])];
    if (f.near) return [fill(pickOf(UPDATE_NEAR, pick), f, 'dispatch')];
    return describe(f);
  }
  if (kind === 'spotted') return [fill(f.road && f.heading ? SPOTTED : f.near ? SPOTTED_NEAR : DESCRIBE_STILL, f, 'unit')];
  if (kind === 'lostLook') return [fill(LOST_LOOK, f, 'unit'), fill(LOST[1], f, 'dispatch')];
  return [...(f.near ? [fill(LOST[0], f, 'unit')] : []), fill(LOST[1], f, 'dispatch')];
}

/** The stop: the officer's opening, a question (which intent answers it), and what the officer says to each answer. */
export function officerScene(f: ScanFacts, pick: number): { open: ScanLine; question: ScanLine; answer: number; intents: readonly { label: string; say: ScanLine }[]; right: ScanLine; wrong: ScanLine; bye: ScanLine } {
  const q = pickOf(OFFICER_QUESTIONS, pick);
  return {
    open: fill(OFFICER_OPEN[f.offence], f, 'officer'),
    question: fill(q, f, 'officer'),
    answer: q.answer,
    intents: OFFICER_INTENTS.map((t) => ({ label: t.vi, say: { who: 'you', text: t.text, vi: t.vi } })),
    right: fill(OFFICER_RIGHT, f, 'officer'),
    wrong: fill(OFFICER_WRONG, f, 'officer'),
    bye: fill(OFFICER_BYE, f, 'officer'),
  };
}
