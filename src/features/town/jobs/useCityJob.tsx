// The engine of Westbay's jobs ("phi vụ"): it plays any job document (core/town/jobDoc.ts) step by step on the
// city's stage. CityPage hands it the stage and the open jobs, and asks it, each render, for the quest cards, the one
// button, who speaks, and what to draw over the stage; it takes the clicks on people while a job is under way.
//
// A "director" (an async function) walks the steps in order and waits for the learner where a step needs them: a
// place reached (polled from the stage), the notebook written, somebody asked, a way picked, an intent chosen, a
// password typed. The panels resolve those waits. Giving a job up cancels every wait.
//
// Every wrong note has ONE consequence that plays out and rejoins the main line; the grade counts the consequences hit
// (core/town/jobDoc gradeHits). Hearing again is an action with a cost, counted per fact. A run lives in memory only
// (a reload drops it; nothing was paid yet): pay, review cards and the heat are written once, at the end. Everything
// said is in the browser's voice (Westbay's people and the new ones; the learner's own lines: PLAYER_VOICE).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Ear, Flame, MessageCircle, MessageCircleQuestion, Phone, PhoneIncoming, Radio, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { useShortcuts } from '../../../components/useShortcuts';
import { cityPerson } from '../../../core/town/cityPeople';
import { heatAfter, heatLevel } from '../../../core/town/heat';
import {
  appointment,
  arrivedLate,
  chooseTurn,
  CLARITY_VOLUME,
  clockOf,
  FAINT_WITHIN,
  fillLine,
  lineRef,
  minutesPast,
  NOTICED_WITHIN,
  noteAnswer,
  overhearClarity,
  realTimeOf,
  timeSide,
  waysOf,
  type Clarity,
  type JobGrade,
  type JobLine,
  type Junction,
  type NoteEntry,
  type Turn,
} from '../../../core/town/job';
import { evalCond, gradeHits, saidNow, type CondState, type IntentStep, type JobDoc, type Said, type Step } from '../../../core/town/jobDoc';
import { enrolJobMisses, payJob } from '../../../core/town/jobStore';
import { jobSpeakerName, PLAYER_VOICE } from '../../../core/town/jobVoice';
import { judgeTyped } from '../../../core/town/typing';
import { skyNow } from '../../../core/town/skyNow';
import { stopSpeaking } from '../../../core/tts';
import { jobLine } from '../../../data/city/jobs';
import { CITY_PLACES } from '../../../data/cityWorld';
import type { PlaceId } from '../../../data/townWorld';
import { tl, tr } from '../../../i18n';
import { SoundBars } from '../art';
import type { TownStageHandle } from '../engine/stage';
import type { Quest } from '../quests';
import { setHeat, useHeat, getHeat } from './heatStore';
import { lineSeconds, sayJobLine } from './jobAudio';
import { JobDebrief, JobNotebook, JobPassword } from './jobPanels';
import Intents from './JobIntents';
import { GRADE_NAME } from './jobText';
import './jobs.css';

/** A line as it was said in this run: its review ref and its text with the time filled in. */
export interface SaidJobLine {
  ref: string;
  line: JobLine;
}

/** What a run remembers (the director writes it; the panels read it). */
export interface JobRunState {
  doc: JobDoc;
  /** The appointment (a minute of the game's day). */
  minute: number;
  seed: number;
  picks: Record<string, string>;
  /** Times each fact was heard: a notebook entry's key, a junction's id, a fact's id. */
  heard: Record<string, number>;
  flags: string[];
  /** The consequences hit, in order. */
  hits: string[];
  /** Repeats asked of the briefing's speaker. */
  repeats: number;
  /** "Xin nhắc lại" asked of the passenger, all junctions together. */
  asks: number;
  wrongAt: string[];
  /** Answers by intent that are checked: the fact's id → right. */
  checks: Record<string, boolean>;
  passes: number;
  heardWord: boolean;
  password: 'first' | 'helped' | 'none' | null;
  log: SaidJobLine[];
  grade: JobGrade | null;
  xu: number;
  missed: string[];
  enrolled: number;
}

type UiKind = 'idle' | 'ringing' | 'call' | 'notes' | 'go' | 'find' | 'ride' | 'phone' | 'radio' | 'scene' | 'overhear' | 'intent' | 'password' | 'closing' | 'debrief';

/** What is on the screen now. */
interface Ui {
  kind: UiKind;
  /** The place the card guides to (null: none: the learner has spoken directions to follow, or nothing to walk to). */
  target?: string | null;
  label?: string;
  deadline?: number | null;
  entries?: readonly NoteEntry[];
  /** People who can be asked now (the one button beside them). */
  askWho?: readonly string[];
  junction?: Junction | null;
  choosing?: boolean;
  intent?: IntentStep | null;
  password?: Extract<Step, { kind: 'password' }> | null;
  noticed?: boolean;
}

const CANCEL = Symbol('cancel');

const doorOf = (id: string): { x: number; y: number } | null => {
  const p = CITY_PLACES.find((q) => (q.id as string) === id);
  return p ? { x: p.door.x + 0.5, y: p.door.y + 0.5 } : null;
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const nameOf = (id: string) => (id === 'kemp' ? 'Duncan Kemp' : (cityPerson(id)?.name ?? jobSpeakerName(id)));
const bump = (h: Record<string, number>, keys: readonly string[]) => {
  const out = { ...h };
  for (const k of keys) out[k] = (out[k] ?? 0) + 1;
  return out;
};

/** The passenger in the car (the run's flag `aboard:<id>`), or ''. */
const aboardOf = (flags: readonly string[]): string => (flags.find((f) => f.startsWith('aboard:')) ?? '').slice('aboard:'.length);

/** Close enough to a place's door to be "there" (tiles). */
const AT_PLACE = 5;

const TURN_ICON: Readonly<Record<Turn, LucideIcon>> = { left: ArrowLeft, straight: ArrowUp, right: ArrowRight };
const TURN_NAME: Readonly<Record<Turn, string>> = { left: 'Rẽ trái', straight: 'Đi thẳng', right: 'Rẽ phải' };
const TURN_KEY: Readonly<Record<string, Turn>> = { ArrowLeft: 'left', ArrowUp: 'straight', ArrowRight: 'right' };

const blank = (doc: JobDoc, now: number): JobRunState => ({
  doc,
  minute: appointment(now),
  seed: Math.floor(now / 1000),
  picks: {},
  heard: {},
  flags: [],
  hits: [],
  repeats: 0,
  asks: 0,
  wrongAt: [],
  checks: {},
  passes: 0,
  heardWord: false,
  password: null,
  log: [],
  grade: null,
  xu: 0,
  missed: [],
  enrolled: 0,
});

/** Every notebook entry of a job. */
const entriesOf = (doc: JobDoc): NoteEntry[] => doc.steps.flatMap((s) => (s.kind === 'notebook' ? s.entries : []));

export interface CityJobOptions {
  jobs: readonly JobDoc[];
  stage: RefObject<TownStageHandle | null>;
  /** Whether a job is open now (its scenes heard, or the admin sandbox; and the 3D city up). */
  isOpen: (doc: JobDoc) => boolean;
  /** The stage is on the screen and nothing of the page's own is open over it. */
  free: boolean;
  /** Who the player stands beside. */
  nearId: string | null;
  sound: boolean;
  /** The learner's character's sex (their own lines' voice). */
  playerGender: 'male' | 'female';
  onReward: (r: { label: string; xu?: number }) => void;
}

export interface CityJob {
  /** A job is under way (past the ringing phone): the page's own quests, prompts and talks step back. */
  active: boolean;
  /** The quest cards: the job under way, else every open job (each picks and rings it). */
  quests: Quest[];
  deadline: number | null;
  /** The one button, when the job wants it. */
  prompt: { icon: LucideIcon; text: string; run: () => void } | null;
  /** Somebody clicked, or E beside them: true = the job took it. */
  talk: (id: string) => boolean;
  /** Ring the phone for a job (its quest card picked). */
  start: (jobId: string) => void;
  /** Whose line sounds now (a bubble over their head; 'player' for the phone, the radio and the passenger in the car). */
  speaking: string | null;
  /** The stage takes no input: a sheet of the job is open, or the car is taking the passenger's way. */
  sheet: boolean;
  node: ReactNode;
}

export function useCityJob({ jobs, stage, isOpen, free, nearId, sound, playerGender, onReward }: CityJobOptions): CityJob {
  const open = useMemo(() => jobs.filter(isOpen), [jobs, isOpen]);
  const [run, setRun] = useState<JobRunState | null>(null);
  const runRef = useRef<JobRunState | null>(null);
  const patch = useCallback((change: (r: JobRunState) => JobRunState) => {
    if (!runRef.current) return;
    runRef.current = change(runRef.current);
    setRun(runRef.current);
  }, []);
  const [ui, setUi] = useState<Ui>({ kind: 'idle' });
  const uiRef = useRef(ui);
  const show = useCallback((u: Ui) => {
    uiRef.current = u;
    setUi(u);
  }, []);
  const [speaking, setSpeaking] = useState<string | null>(null);
  /** The learner's own line on the screen while it is said. */
  const [mine, setMine] = useState<string | null>(null);
  const [declined, setDeclined] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [heard, setHeard] = useState<Clarity>('none');
  const heat = useHeat();
  const genderRef = useRef(playerGender);
  useEffect(() => {
    genderRef.current = playerGender;
  }, [playerGender]);

  // ── waits and cancelling ──
  const token = useRef(0);
  const speech = useRef(0);
  const waits = useRef(new Map<string, (v: unknown) => void>());
  const wait = useCallback(<T,>(key: string): Promise<T | typeof CANCEL> => new Promise((res) => waits.current.set(key, res as (v: unknown) => void)), []);
  const resolve = useCallback((key: string, v: unknown) => {
    const fn = waits.current.get(key);
    if (!fn) return false;
    waits.current.delete(key);
    fn(v);
    return true;
  }, []);
  const cancelAll = useCallback(() => {
    token.current++;
    speech.current++;
    stopSpeaking();
    setSpeaking(null);
    setMine(null);
    for (const fn of waits.current.values()) fn(CANCEL);
    waits.current.clear();
  }, []);
  useEffect(() => cancelAll, [cancelAll]);

  // ── speech ──
  const lineOf = useCallback((id: string): SaidJobLine => {
    const raw = jobLine(id)!.line;
    const minute = runRef.current?.minute ?? null;
    return { ref: lineRef(raw, minute), line: fillLine(raw, minute) };
  }, []);
  /**
   * Say lines one after another (a new call stops what was being said). `bubble`: over whose head (null: the
   * speaker's). `slow`: a little slower (asked again). `volume(who, id)`: per line, for a talk overheard. The
   * learner's own lines are shown, and said only with PLAYER_VOICE.
   */
  const say = useCallback(
    async (ids: readonly string[], bubble: string | null = null, o: { volume?: (who: string, id: string) => number; slow?: boolean } = {}): Promise<boolean> => {
      const mineTok = ++speech.current;
      stopSpeaking();
      for (const id of ids) {
        if (speech.current !== mineTok) return false;
        const said = lineOf(id);
        patch((r) => (r.log.some((l) => l.ref === said.ref) ? r : { ...r, log: [...r.log, said] }));
        const own = said.line.who === 'player';
        const volume = o.volume ? o.volume(said.line.who, id) : undefined;
        setSpeaking(own ? 'player' : (bubble ?? said.line.who));
        setMine(own ? said.line.text : null);
        if (volume === 0 || (own && !PLAYER_VOICE)) await new Promise((r) => window.setTimeout(r, lineSeconds(said.line.text) * 1000));
        else await sayJobLine(said.line, runRef.current?.doc.level ?? 2, { ...(volume !== undefined ? { volume } : {}), ...(o.slow ? { slow: true } : {}), ...(own ? { gender: genderRef.current } : {}) });
        if (speech.current !== mineTok) return false;
        await new Promise((r) => window.setTimeout(r, 250));
      }
      if (speech.current === mineTok) {
        setSpeaking(null);
        setMine(null);
      }
      return speech.current === mineTok;
    },
    [lineOf, patch],
  );

  // ── what a condition reads ──
  const condState = useCallback((): CondState => {
    const r = runRef.current!;
    const entries = entriesOf(r.doc);
    return {
      note: (key) => {
        const e = entries.find((x) => x.key === key);
        const value = r.picks[key];
        if (!e) return { value, right: false, early: false, late: false };
        const right = value === noteAnswer(e, r.minute);
        const side = key === 'time' && value !== undefined ? timeSide(Number(value), r.minute) : 'right';
        return { value, right, early: side === 'early', late: side === 'late' };
      },
      flags: new Set(r.flags),
      hits: new Set(r.hits),
    };
  }, []);
  const now = useCallback((list: readonly Said[] | undefined) => saidNow(list ?? [], condState()), [condState]);
  const hit = useCallback((c: string) => patch((r) => (r.hits.includes(c) ? r : { ...r, hits: [...r.hits, c] })), [patch]);
  const flag = useCallback((f: string) => patch((r) => (r.flags.includes(f) ? r : { ...r, flags: [...r.flags, f] })), [patch]);

  // ── the stage ──
  const snapshot = useCallback(() => {
    const s = stage.current?.mapSnapshot();
    return s && !s.away ? s : null;
  }, [stage]);
  /** Wait until `pred` holds for where things are (or the run is given up: false). `timeout` ms: true then too. */
  const until = useCallback(
    (pred: (s: NonNullable<ReturnType<typeof snapshot>>) => boolean, timeout = 0): Promise<boolean> => {
      const tok = token.current;
      const t0 = Date.now();
      return new Promise((res) => {
        const id = window.setInterval(() => {
          if (token.current !== tok) {
            window.clearInterval(id);
            res(false);
            return;
          }
          const s = snapshot();
          if ((s && pred(s)) || (timeout > 0 && Date.now() - t0 > timeout)) {
            window.clearInterval(id);
            res(true);
          }
        }, 250);
      });
    },
    [snapshot],
  );
  const near = (place: string, r = AT_PLACE) => (s: { player: { x: number; y: number } }) => {
    const d = doorOf(place);
    return !!d && dist(s.player, d) < r;
  };
  /** The car takes the way to a place or a tile by itself (a walk the stage makes; a dip to dark where there is none). */
  const travel = useCallback(
    (to: { kind: 'place'; id: string } | { kind: 'tile'; x: number; y: number }): Promise<void> =>
      new Promise((res) => {
        const st = stage.current;
        if (!st) return res();
        const target = to.kind === 'place' ? ({ kind: 'place', id: to.id as PlaceId } as const) : to;
        if (!st.travelTo(target, 'walk', () => res()) && !st.travelTo(target, 'warp', () => res())) res();
      }),
    [stage],
  );

  // ── the steps ──
  const alive = (tok: number) => token.current === tok;

  const playIntent = useCallback(
    async (i: IntentStep, tok: number, bubble: string | null) => {
      if (!evalCond(i.if, condState())) return;
      await say(now(i.ask), bubble);
      if (!alive(tok)) return;
      const prev = uiRef.current;
      show({ ...prev, kind: prev.kind === 'ride' ? 'ride' : 'intent', intent: i });
      const pick = await wait<number>('intent');
      if (pick === CANCEL || !alive(tok)) return;
      show({ ...uiRef.current, intent: null });
      const o = i.options[pick];
      await say([o.say]);
      await say(now(o.reply), bubble);
      if (o.flag) flag(o.flag);
      if (i.check) {
        const right = pick === i.check.right;
        patch((r) => ({ ...r, checks: { ...r.checks, [i.check!.fact]: right } }));
        if (!right) hit(i.check.consequence);
      }
    },
    [condState, flag, hit, now, patch, say, show, wait],
  );

  const playStep = useCallback(
    async (st: Step, next: Step | undefined, tok: number): Promise<void> => {
      if ('if' in st && st.if && !evalCond(st.if, condState())) return;
      const r0 = runRef.current!;
      switch (st.kind) {
        case 'goto': {
          stage.current?.endListen();
          show({ kind: 'go', target: st.place, label: st.label });
          await until(near(st.place));
          return;
        }
        case 'scene': {
          if (st.at && st.who?.length) stage.current?.gather(st.at as PlaceId, st.who as PlaceId[]);
          show({ kind: 'scene' });
          await say(now(st.lines));
          return;
        }
        case 'phone':
        case 'radio': {
          show({ kind: st.kind });
          await say(now(st.lines), 'player');
          return;
        }
        case 'notebook': {
          const keys = st.entries.map((e) => e.key);
          patch((r) => ({ ...r, heard: bump(r.heard, keys) }));
          show({ kind: 'call', entries: st.entries });
          await say(now(st.call), 'player');
          if (!alive(tok)) return;
          show({ kind: 'notes', entries: st.entries });
          const go = await wait<true>('notes');
          if (go === CANCEL || !alive(tok)) return;
          speech.current++;
          stopSpeaking();
          setSpeaking(null);
          // a wrong note whose consequence is the note itself is hit now (it plays out later, by the conditions)
          const cs = condState();
          for (const f of r0.doc.facts) {
            const e = st.entries.find((x) => x.line === f.line);
            if (!e || f.byAction) continue;
            const n = cs.note(e.key);
            if (!n.right) hit(n.early && f.early ? f.early : f.consequence);
          }
          stage.current?.focus();
          return;
        }
        case 'pickup': {
          stage.current?.endListen();
          const r = runRef.current!;
          let target = st.places[r.picks[st.entry] ?? ''] ?? st.place;
          const noted = r.picks.time !== undefined ? realTimeOf(Number(r.picks.time), Date.now()) : null;
          for (;;) {
            show({ kind: 'go', target, label: target === st.place && runRef.current!.hits.includes(st.wrongPlace.consequence) ? tr('Đi lại chỗ vừa được chỉ') : '', deadline: noted });
            const ok = await until((s) => near(target)(s) || near(st.place)(s));
            if (!ok || !alive(tok)) return;
            const s = snapshot();
            if (s && near(st.place)(s)) break;
            // the place noted, not the right one: nobody there; somebody rings and says it again
            hit(st.wrongPlace.consequence);
            patch((x) => ({ ...x, heard: bump(x.heard, [st.entry]) }));
            show({ kind: 'phone' });
            await say(now(st.wrongPlace.lines), 'player');
            target = st.place;
          }
          const m = runRef.current!.minute;
          if (st.gone && minutesPast(m, Date.now()) > st.gone.after) {
            hit(st.gone.consequence);
            show({ kind: 'phone' });
            await say(now(st.gone.lines), 'player');
            return;
          }
          if (arrivedLate(m, Date.now())) {
            flag('late');
            const f = r0.doc.facts.find((x) => x.id === 'time');
            if (f) hit(f.consequence);
          }
          show({ kind: 'phone' });
          await say(now(st.arrive), 'player');
          const crowd = [...new Set([...st.crowd, st.passenger])];
          stage.current?.gather(st.place as PlaceId, crowd as PlaceId[]);
          let wrong = 0;
          const asked = new Set<string>();
          for (;;) {
            show({ kind: 'find', askWho: crowd });
            const who = await wait<string>('ask');
            if (who === CANCEL || !alive(tok)) return;
            await say(now(st.ask));
            if (who === st.passenger) break;
            const lines = st.notMe[who];
            if (!lines) continue;
            await say(now(lines));
            if (!asked.has(who)) {
              asked.add(who);
              wrong++;
              hit(st.wrongPerson);
              if (st.callOut && wrong === st.callOut.after) await say([st.callOut.line]);
            }
          }
          await say(now(st.greet));
          stage.current?.endListen();
          stage.current?.passenger(st.passenger as PlaceId, true);
          patch((x) => ({ ...x, flags: [...x.flags, `aboard:${st.passenger}`] }));
          return;
        }
        case 'ride': {
          const r = runRef.current!;
          const value = st.entry ? r.picks[st.entry] : undefined;
          const target = (st.entry && st.places?.[value ?? '']) || st.place;
          if (target !== st.place && st.wrongStop) hit(st.wrongStop);
          show({ kind: 'ride', junction: null, choosing: false });
          if (st.junctions?.length) {
            for (const j of st.junctions) {
              patch((x) => ({ ...x, heard: bump(x.heard, [j.id]) }));
              show({ kind: 'ride', junction: j, choosing: false });
              void say([j.line], 'player');
              await travel({ kind: 'tile', ...j.at });
              for (;;) {
                if (!alive(tok)) return;
                show({ kind: 'ride', junction: j, choosing: true });
                const t = await wait<Turn>('turn');
                if (t === CANCEL || !alive(tok)) return;
                const v = chooseTurn(j, t);
                if (v === 'none') continue;
                if (v === 'right') break;
                patch((x) => ({ ...x, wrongAt: x.wrongAt.includes(j.id) ? x.wrongAt : [...x.wrongAt, j.id] }));
                if (st.lost) hit(st.lost);
                show({ kind: 'ride', junction: j, choosing: false });
                const way = j.ways[t]!;
                await travel({ kind: 'tile', ...way.to });
                if (way.line) await say([way.line], 'player');
                await travel({ kind: 'tile', ...j.at });
              }
            }
            show({ kind: 'ride', junction: null, choosing: false });
            void say(now(st.near), 'player');
            await travel({ kind: 'place', id: target });
          } else {
            const talk = async () => {
              for (const t of st.talk ?? []) {
                if (!alive(tok)) return;
                if (typeof t === 'object' && 'intent' in t) await playIntent(t.intent, tok, 'player');
                else await say(now([t]), 'player');
              }
            };
            await Promise.all([travel({ kind: 'place', id: target }), talk()]);
          }
          if (!alive(tok)) return;
          const passenger = aboardOf(runRef.current!.flags);
          if (passenger) stage.current?.passenger(passenger as PlaceId, false);
          show({ kind: 'scene' });
          await say(now(st.arrive[value ?? 'right'] ?? st.arrive.right ?? []));
          return;
        }
        case 'overhear': {
          const [a, b] = st.who;
          stage.current?.gather(st.at as PlaceId, st.who as unknown as PlaceId[]);
          const lines = now(st.lines).slice(st.from && evalCond(st.from.if, condState()) ? st.from.index : 0);
          const pw = next?.kind === 'password' ? next : null;
          show({ kind: 'overhear', askWho: pw ? [pw.who] : [], noticed: false });
          // they start when the learner is near enough to hear anything (or after a while all the same)
          await until(near(st.at, FAINT_WITHIN + 3), 25000);
          if (!alive(tok)) return;
          const volume = (who: string, id: string) => {
            const s = snapshot();
            const p = s?.residents.find((x) => x.id === who);
            const c = s && p ? overhearClarity(dist(s.player, p), skyNow().mix.rain) : 'none';
            if (id === st.word && c !== 'none') patch((x) => ({ ...x, heardWord: true, heard: bump(x.heard, ['word']) }));
            return CLARITY_VOLUME[c];
          };
          const halt = { now: false };
          // too near before the word was heard: they notice and stop (only a step with `noticed`)
          const watch = window.setInterval(() => {
            const s = snapshot();
            const pa = s?.residents.find((x) => x.id === a);
            const pb = s?.residents.find((x) => x.id === b);
            if (!s || !pa || !pb) return;
            const d = Math.min(dist(s.player, pa), dist(s.player, pb));
            setHeard(overhearClarity(d, skyNow().mix.rain));
            if (st.noticed && !runRef.current!.heardWord && !halt.now && d < NOTICED_WITHIN) {
              halt.now = true;
              hit(st.noticed.consequence);
              show({ ...uiRef.current, noticed: true });
              void say([st.noticed.line]);
            }
          }, 250);
          const loop = (async () => {
            for (let pass = 0; pass < st.passes && !halt.now; pass++) {
              patch((x) => ({ ...x, passes: x.passes + 1 }));
              const done = await say(lines, null, { volume });
              if (!done || halt.now) break;
              if (pass < st.passes - 1) await new Promise((res) => window.setTimeout(res, 2500));
            }
          })();
          // the one to give the password to can be gone up to at any time
          const asked = pw ? wait<string>('ask').then((v) => (v === CANCEL ? null : v)) : new Promise<null>(() => undefined);
          const first = await Promise.race([loop.then(() => 'loop' as const), asked.then(() => 'ask' as const)]);
          window.clearInterval(watch);
          if (first === 'ask') {
            halt.now = true;
            speech.current++;
            stopSpeaking();
            setSpeaking(null);
            flag(`asked:${pw!.who}`);
          } else waits.current.delete('ask');
          return;
        }
        case 'intent': {
          show({ kind: 'intent', intent: null });
          await playIntent(st, tok, null);
          return;
        }
        case 'password': {
          if (!runRef.current!.flags.includes(`asked:${st.who}`)) {
            show({ kind: 'find', askWho: [st.who], label: tl`Tới nói mật khẩu với ${nameOf(st.who)}` });
            const who = await wait<string>('ask');
            if (who === CANCEL || !alive(tok)) return;
          }
          show({ kind: 'password', password: st });
          const res = await wait<'first' | 'helped' | 'none'>('password');
          if (res === CANCEL || !alive(tok)) return;
          patch((x) => ({ ...x, password: res }));
          if (res === 'none') hit(st.consequence);
          return;
        }
      }
    },
    [condState, flag, hit, now, patch, playIntent, say, show, snapshot, stage, travel, until, wait],
  );

  const finish = useCallback(
    async (tok: number) => {
      const r = runRef.current!;
      const doc = r.doc;
      stage.current?.endListen();
      const hits = new Set(r.hits);
      const grade = gradeHits(hits, doc);
      patch((x) => ({ ...x, grade }));
      show({ kind: 'closing' });
      await say(now(doc.ending[grade]), 'player');
      if (!alive(tok)) return;
      const t = Date.now();
      const xu = payJob(doc.id, grade, t);
      // the lines behind what was not caught: a fact whose consequence was hit, a junction taken wrong, the password
      // not typed right at once; only what was said in this run
      const said = new Set(runRef.current!.log.map((l) => l.ref));
      const ids = [
        ...doc.facts.filter((f) => hits.has(f.consequence) || (f.early && hits.has(f.early))).map((f) => f.line),
        ...doc.steps.flatMap((s) => (s.kind === 'ride' ? (s.junctions ?? []).filter((j) => r.wrongAt.includes(j.id)).map((j) => j.line) : [])),
        ...doc.steps.flatMap((s) => (s.kind === 'password' && r.password === 'helped' ? [s.line] : [])),
      ];
      const missed = [...new Set(ids.map((id) => lineOf(id).ref))].filter((ref) => said.has(ref));
      const enrolled = enrolJobMisses(missed, t);
      const fatal = [...hits].some((h) => doc.consequences[h]?.fatal);
      setHeat(heatAfter(getHeat(), grade, hits.size, fatal));
      patch((x) => ({ ...x, xu, missed, enrolled }));
      show({ kind: 'debrief' });
      onReward({ label: tl`Phi vụ xong: ${tr(GRADE_NAME[grade])}`, ...(xu > 0 ? { xu } : {}) });
    },
    [lineOf, now, onReward, patch, say, show, stage],
  );

  const direct = useCallback(
    async (doc: JobDoc) => {
      const tok = token.current;
      const steps = doc.steps;
      for (let i = 0; i < steps.length; i++) {
        if (!alive(tok)) return;
        await playStep(steps[i], steps[i + 1], tok);
      }
      if (alive(tok)) await finish(tok);
    },
    [finish, playStep],
  );

  // ── starting, giving up ──
  const ringing = ui.kind === 'idle' ? (open.find((d) => !declined.includes(d.id)) ?? null) : null;
  const [ringFor, setRingFor] = useState<JobDoc | null>(null);
  const offered = ui.kind === 'ringing' ? ringFor : free ? ringing : null;
  const start = useCallback(
    (jobId: string) => {
      const doc = jobs.find((d) => d.id === jobId);
      if (!doc || (uiRef.current.kind !== 'idle' && uiRef.current.kind !== 'ringing')) return;
      setRingFor(doc);
      show({ kind: 'ringing' });
    },
    [jobs, show],
  );
  const accept = useCallback(
    (doc: JobDoc) => {
      cancelAll();
      runRef.current = blank(doc, Date.now());
      setRun(runRef.current);
      setNote(null);
      void direct(doc);
    },
    [cancelAll, direct],
  );
  const quit = useCallback(() => {
    const r = runRef.current;
    cancelAll();
    stage.current?.endListen();
    const aboard = r ? aboardOf(r.flags) : '';
    if (aboard) stage.current?.passenger(aboard as PlaceId, false);
    if (r) setDeclined((d) => [...d, r.doc.id]);
    else if (ringFor) setDeclined((d) => [...d, ringFor.id]);
    runRef.current = null;
    setRun(null);
    setRingFor(null);
    setNote(null);
    show({ kind: 'idle' });
    stage.current?.focus();
  }, [cancelAll, ringFor, show, stage]);

  // ── the panels' actions ──
  const replayCall = useCallback(
    (slow = false) => {
      const r = runRef.current;
      const st = r?.doc.steps.find((s): s is Extract<Step, { kind: 'notebook' }> => s.kind === 'notebook');
      if (!st) return;
      patch((x) => ({ ...x, heard: bump(x.heard, st.entries.map((e) => e.key)) }));
      void say(now(st.call), 'player', { slow });
    },
    [now, patch, say],
  );
  const replayFact = useCallback(
    (key: string) => {
      const r = runRef.current;
      const st = r?.doc.steps.find((s): s is Extract<Step, { kind: 'notebook' }> => s.kind === 'notebook');
      const e = st?.entries.find((x) => x.key === key);
      if (!st || !e) return;
      const repeats = r!.repeats + 1;
      patch((x) => ({ ...x, repeats, heard: bump(x.heard, [key]), flags: x.flags.includes('asked') ? x.flags : [...x.flags, 'asked'] }));
      const lines = st.repeat?.[key] ?? [e.line];
      void say([...lines, ...(st.patience && repeats === st.patience.after ? [st.patience.line] : [])], 'player', { slow: !st.repeat?.[key] });
    },
    [patch, say],
  );
  const askAgain = useCallback(
    (slow = true) => {
      const r = runRef.current;
      const j = uiRef.current.junction;
      const st = r?.doc.steps.find((s): s is Extract<Step, { kind: 'ride' }> => s.kind === 'ride');
      if (!r || !j || !st) return;
      const asks = r.asks + 1;
      patch((x) => ({ ...x, asks, heard: bump(x.heard, [j.id]) }));
      const over = !!st.again && asks > st.again.patience;
      if (over) hit(st.again!.consequence);
      void say(over ? [st.again!.line, j.line] : [j.line], 'player', { slow });
    },
    [hit, patch, say],
  );
  const choose = useCallback((t: Turn) => resolve('turn', t), [resolve]);
  const ask = useCallback((id: string) => resolve('ask', id), [resolve]);

  const talk = useCallback(
    (id: string): boolean => {
      const k = uiRef.current.kind;
      if (k === 'idle' || k === 'ringing') return false;
      if ((uiRef.current.askWho ?? []).includes(id)) ask(id);
      else setNote('Đang dở phi vụ: làm cho xong đã, hoặc bấm "Bỏ phi vụ".');
      return true;
    },
    [ask],
  );

  // the junction's keys: the arrows pick the way; the shared practice keys (core/shortcuts.ts) ask again
  const choosing = ui.kind === 'ride' && !!ui.choosing;
  useEffect(() => {
    if (!choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = TURN_KEY[e.key];
      if (!t) return;
      e.preventDefault();
      choose(t);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choosing, choose]);
  useShortcuts({ replay: () => askAgain(false), slow: () => askAgain(true) }, { enabled: ui.kind === 'ride' && !!ui.junction });

  // ── the one button ──
  let prompt: CityJob['prompt'] = null;
  if (offered) prompt = { icon: PhoneIncoming, text: tl`Nghe máy: ${nameOf(offered.from)} đang gọi`, run: () => accept(offered) };
  else if (nearId && (ui.askWho ?? []).includes(nearId) && (ui.kind === 'find' || ui.kind === 'overhear')) {
    const pwWho = run?.doc.steps.find((s): s is Extract<Step, { kind: 'password' }> => s.kind === 'password')?.who;
    const pw = nearId === pwWho && (ui.kind === 'overhear' || ui.askWho?.length === 1);
    prompt = { icon: Ear, text: pw ? tl`Nói mật khẩu với ${nameOf(nearId)}` : tl`Hỏi ${nameOf(nearId)}`, run: () => ask(nearId) };
  }

  // ── the quest cards ──
  const active = ui.kind !== 'idle' && ui.kind !== 'ringing';
  const quests = useMemo<Quest[]>(() => {
    const tag = tr('Phi vụ');
    if (!active || !run) return open.map((d) => ({ id: `job:${d.id}`, tag, title: d.title, step: tl`${nameOf(d.from)} có việc cho bạn`, target: null }));
    const doc = run.doc;
    const base = { id: `job:${doc.id}`, tag, title: doc.title };
    const step = (() => {
      switch (ui.kind) {
        case 'call':
          return tr('Đang nghe điện thoại');
        case 'notes':
          return tr('Ghi vào sổ tay');
        case 'go':
          return ui.label || tr('Tới chỗ bạn đã ghi');
        case 'find':
          return tr('Tìm đúng người, rồi bấm Hỏi');
        case 'ride':
          return ui.junction ? tr('Tới ngã rẽ thì chọn đường theo lời khách') : tr('Khách đang ngồi sau xe');
        case 'overhear':
          return tr('Tới chỗ đã được dặn. Lại gần mà nghe');
        case 'password':
          return tr('Nói mật khẩu');
        case 'debrief':
        case 'closing':
          return tr('Xong rồi');
        default:
          return tr('Nghe cho kỹ');
      }
    })();
    return [{ ...base, step, target: ui.kind === 'go' && ui.target ? { kind: 'place', id: ui.target as PlaceId } : null }];
  }, [active, run, open, ui]);

  // ── what is drawn over the stage ──
  const pill = heatLevel(heat) !== 'none' && (
    <span className={'town-pill job-heat is-' + heatLevel(heat)} role="img" aria-label={tl`Độ nóng: ${heat}`} title="Độ nóng: Bayline để ý tới bạn cỡ nào">
      <Icon icon={Flame} size={16} />
      <span className="tabular">{heat}</span>
    </span>
  );
  const mineNode = mine && (
    <p className="job-mine" role="status">
      <span className="job-mine-who">Bạn</span>
      <span lang="en">{mine}</span>
    </p>
  );
  const strip = (() => {
    const giveUp = (
      <button type="button" className="btn btn-ghost btn-sm" onClick={quit}>
        Bỏ phi vụ
      </button>
    );
    if (offered)
      return (
        <div className="town-welcome job-strip is-ringing" role="status">
          <span className="job-strip-icon" aria-hidden="true">
            <Icon icon={Phone} size={20} />
          </span>
          <p className="town-welcome-text">
            <span className="town-welcome-name">{tl`${nameOf(offered.from)} đang gọi · Phi vụ: ${offered.title}`}</span>
            {offered.blurb}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => {
              // "later": this job rings no more in this visit (its quest card still lists it)
              const id = offered.id;
              quit();
              setDeclined((d) => (d.includes(id) ? d : [...d, id]));
            }}
            aria-label="Để sau"
            title="Để sau"
          >
            <Icon icon={X} size={16} />
          </button>
        </div>
      );
    if (!run) return null;
    const hearing = (text: string) => (
      <span className="job-strip-hear">
        <SoundBars on={speaking !== null} />
        {text}
      </span>
    );
    switch (ui.kind) {
      case 'call':
      case 'phone':
      case 'closing':
        return (
          <div className="town-welcome job-strip" role="status">
            <span className="job-strip-icon" aria-hidden="true">
              <Icon icon={Phone} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">Điện thoại</span>
              {hearing(speaking !== null ? 'Đang nói… chỉ nghe thôi, không có chữ.' : 'Đã dập máy.')}
            </p>
          </div>
        );
      case 'radio':
        return (
          <div className="town-welcome job-strip" role="status">
            <span className="job-strip-icon" aria-hidden="true">
              <Icon icon={Radio} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">Radio trên xe · Bay FM</span>
              {hearing('Đang phát… chỉ nghe thôi.')}
            </p>
          </div>
        );
      case 'scene':
        return (
          <div className="town-welcome job-strip" role="status">
            <span className="job-strip-icon" aria-hidden="true">
              <Icon icon={MessageCircle} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">{speaking && speaking !== 'player' ? nameOf(speaking) : 'Nghe họ nói'}</span>
              {hearing('Chỉ nghe thôi, không có chữ.')}
            </p>
            {giveUp}
          </div>
        );
      case 'ride': {
        const j = ui.junction;
        return (
          <div className="town-welcome job-strip job-junction" role="group" aria-label="Khách trên xe">
            <p className="town-welcome-text">
              <span className="town-welcome-name">{j && ui.choosing ? 'Tới ngã rẽ. Đi đường nào?' : ui.intent ? 'Bạn đáp thế nào?' : 'Khách đang ngồi sau xe'}</span>
              {hearing(speaking !== null ? 'Đang nói…' : j && ui.choosing ? 'Chọn theo lời khách vừa chỉ.' : 'Xe đang chạy.')}
            </p>
            {j && ui.choosing && (
              <div className="job-turns">
                {waysOf(j).map((t) => (
                  <button key={t} type="button" className="town-reply job-turn" onClick={() => choose(t)} aria-keyshortcuts={t === 'left' ? 'ArrowLeft' : t === 'right' ? 'ArrowRight' : 'ArrowUp'}>
                    <Icon icon={TURN_ICON[t]} size={18} />
                    <span className="town-reply-text">{TURN_NAME[t]}</span>
                  </button>
                ))}
              </div>
            )}
            {ui.intent && <Intents step={ui.intent} onPick={(i) => resolve('intent', i)} />}
            {j && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => askAgain(true)}>
                <Icon icon={MessageCircleQuestion} size={16} />
                Xin nhắc lại
              </button>
            )}
          </div>
        );
      }
      case 'intent':
        return (
          <div className="town-welcome job-strip job-junction" role="group" aria-label="Bạn đáp thế nào">
            <p className="town-welcome-text">
              <span className="town-welcome-name">{ui.intent ? 'Bạn đáp thế nào?' : speaking && speaking !== 'player' ? nameOf(speaking) : 'Nghe họ nói'}</span>
              {hearing(speaking !== null ? 'Đang nói…' : 'Chọn ý của bạn.')}
            </p>
            {ui.intent && <Intents step={ui.intent} onPick={(i) => resolve('intent', i)} />}
          </div>
        );
      case 'overhear':
        return (
          <div className="town-welcome job-strip" role="status">
            <span className="job-strip-icon" aria-hidden="true">
              <Icon icon={Ear} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">{ui.noticed ? 'Họ thấy bạn rồi' : CLARITY_NAME[heard]}</span>
              {(ui.askWho ?? []).length > 0 && (ui.noticed || run.passes >= 2)
                ? tl`Nghe đủ rồi thì tới nói mật khẩu với ${nameOf(ui.askWho![0])}.`
                : skyNow().mix.rain >= 0.5
                  ? 'Mưa át bớt tiếng. Lại gần hơn mà nghe.'
                  : 'Lại gần thì nghe rõ hơn.'}
            </p>
            {giveUp}
          </div>
        );
      case 'go':
      case 'find':
        return (
          <div className="town-welcome job-strip" role="status">
            <span className="job-strip-icon" aria-hidden="true">
              <Icon icon={ui.kind === 'find' ? Ear : Phone} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">{ui.kind === 'find' ? ui.label || 'Ai trong đám này?' : ui.label || 'Tới chỗ bạn đã ghi'}</span>
              {note ?? (ui.kind === 'find' ? (ui.label ? 'Tới gần rồi bấm nút.' : 'Tới gần một người rồi bấm Hỏi.') : ui.deadline !== undefined && !ui.label ? 'Lái xe hay đi bộ đều được. Thẻ nhiệm vụ dẫn bạn theo đúng điều bạn đã ghi.' : 'Lái xe hay đi bộ đều được. Thẻ nhiệm vụ chỉ đường.')}
            </p>
            {giveUp}
          </div>
        );
      default:
        return null;
    }
  })();

  const notebook = run?.doc.steps.find((s): s is Extract<Step, { kind: 'notebook' }> => s.kind === 'notebook');
  const node = (
    <>
      {pill}
      {free && strip}
      {free && mineNode}
      {ui.kind === 'notes' && run && notebook && (
        <Suspense fallback={null}>
          <JobNotebook
            entries={notebook.entries}
            options={(key) => notebookOptions(notebook.entries, key, run.minute, run.seed)}
            picks={run.picks}
            onPick={(key, value) => patch((x) => ({ ...x, picks: { ...x.picks, [key]: value } }))}
            heard={run.heard}
            playing={speaking !== null}
            onReplay={replayCall}
            onFact={replayFact}
            onGo={() => resolve('notes', true)}
            onClose={quit}
          />
        </Suspense>
      )}
      {ui.kind === 'password' && ui.password && (
        <Suspense fallback={null}>
          <JobPassword
            step={ui.password}
            say={(ids) => say(ids)}
            onDone={(p) => resolve('password', p)}
            onClose={() => {
              /* not ready: listen more (the overheard talk is over; the sheet comes back when Gus is asked again) */
              show({ kind: 'find', askWho: [ui.password!.who], label: tl`Tới nói mật khẩu với ${nameOf(ui.password!.who)}` });
              void (async () => {
                const tok = token.current;
                const who = await wait<string>('ask');
                if (who !== CANCEL && alive(tok)) show({ kind: 'password', password: ui.password });
              })();
            }}
            judge={(answer) => judgeTyped(ui.password!.chunk, answer)}
          />
        </Suspense>
      )}
      {ui.kind === 'debrief' && run && (
        <Suspense fallback={null}>
          <JobDebrief
            run={run}
            sound={sound}
            say={(l, careful) => sayJobLine(l, run.doc.level, { careful, ...(l.who === 'player' ? { gender: playerGender } : {}) })}
            news={(ids) => say(ids, 'player')}
            newsNow={(list) => now(list)}
            lineOf={lineOf}
            onAgain={() => {
              const doc = run.doc;
              quit();
              setDeclined((d) => d.filter((x) => x !== doc.id));
              start(doc.id);
            }}
            onClose={() => {
              // a job just played: no other rings by itself in this visit (the quest cards still list them)
              quit();
              setDeclined(jobs.map((d) => d.id));
            }}
          />
        </Suspense>
      )}
    </>
  );

  return {
    active,
    quests,
    deadline: ui.kind === 'go' ? (ui.deadline ?? null) : null,
    prompt,
    talk,
    start,
    speaking,
    sheet: ui.kind === 'notes' || ui.kind === 'password' || ui.kind === 'debrief' || ui.kind === 'ride',
    node,
  };
}

/** The options of an entry as offered (the time's made from the appointment), in an order by the run's seed. */
function notebookOptions(entries: readonly NoteEntry[], key: string, minute: number, seed: number) {
  const e = entries.find((x) => x.key === key)!;
  const all = key === 'time' ? timeChoices(minute) : [...e.options];
  const k = ((Math.floor(seed + key.length) % all.length) + all.length) % all.length;
  return [...all.slice(k), ...all.slice(0, k)];
}
function timeChoices(minute: number) {
  const m = ((minute % 1440) + 1440) % 1440;
  const list = m % 60 === 45 ? [m, m + 30, m + 60] : [m, m - 30, m + 30];
  return list.map((x) => ({ value: String(((x % 1440) + 1440) % 1440), label: clockOf(x) }));
}

const CLARITY_NAME: Readonly<Record<Clarity, string>> = {
  clear: 'Nghe rõ',
  faint: 'Nghe loáng thoáng',
  none: 'Chưa nghe thấy gì',
};
