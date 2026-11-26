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
import { ArrowLeft, ArrowRight, ArrowUp, CassetteTape, Ear, Flame, MessageCircle, MessageCircleQuestion, Phone, PhoneIncoming, Radio, Siren, Voicemail, X } from 'lucide-react';
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
  FAINT_WITHIN,
  fillLine,
  lineRef,
  noteOptions,
  type ClockStyle,
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
import { evalCond, gradeHits, saidNow, type CondState, type CrewRole, type IntentStep, type JobDoc, type Said, type Step, type Track } from '../../../core/town/jobDoc';
import { enrolJobMisses, payJob } from '../../../core/town/jobStore';
import { hasClue, jobDone, jobUnlocked, pastFlag } from '../../../core/town/jobProgress';
import { finishJobRun, grantClue, loadTownJobs, useTownJobs } from '../../../core/town/jobsStore';
import { clockOf, timeWords } from '../../../core/town/job';
import { RING_MS } from '../../../core/town/phone';
import { PHONE_LINES } from '../../../data/city/phoneLines';
import { callBack, leaveVoicemail, logCall, missCall, offerHeld, phoneState, ringing as phoneRinging, usePhone } from '../phone/phoneStore';
import CrewPicker from './CrewPicker';
import PhonePanel, { PhoneButton } from '../phone/PhonePanel';
import { makeParkedLayer, setParked } from './jobCars';
import { JOB_SPOTS } from '../../../data/city/jobs/spots';
import { hideoutOwned } from '../../../core/town/hideoutStore';
import { jobPatrol, sayOnScanner, type JobScanLine } from '../streets/jobPolice';
import { enterWarehouse, runBoat } from '../city/warehouse';
import { W15_MOORING } from '../../../data/city/warehouses';
import { JobPick, JobSpot, JobThreads } from './JobTools';
import { contactsOf, useCrewWorld } from './crewWorld';
import { ADMIN } from '../../../core/admin';
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
import { lineSeconds, sayJobLine, sayPhoneLine } from './jobAudio';
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
  /** Who came along (core/town/crew.ts; null: alone), and what they took of the pay. */
  crew: string | null;
  crewTake: number;
}

type UiKind = 'idle' | 'ringing' | 'crew' | 'voicemail' | 'patrol' | 'threads' | 'pick' | 'spot' | 'call' | 'notes' | 'go' | 'find' | 'ride' | 'phone' | 'radio' | 'scene' | 'overhear' | 'intent' | 'password' | 'closing' | 'debrief';

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
  /** Who says the briefing being heard (a notebook's `via`). */
  via?: 'phone' | 'radio' | 'scene' | 'voicemail' | 'tape';
  /** A `threads` step: its tracks and the one listened to. */
  tracks?: readonly Track[];
  track?: string;
  /** A `pick` step: how many clips. */
  clips?: number;
  /** A goto with a deadline: the card counts down to it. */
  timed?: boolean;
}

const CANCEL = Symbol('cancel');

const doorOf = (id: string): { x: number; y: number } | null => {
  const spot = JOB_SPOTS[id];
  if (spot) return { x: spot.x + 0.5, y: spot.y + 0.5 };
  const p = CITY_PLACES.find((q) => (q.id as string) === id);
  return p ? { x: p.door.x + 0.5, y: p.door.y + 0.5 } : null;
};
/** Where the quest card and the car take the learner: a place, or a job spot's tile (data/city/jobs/spots.ts). */
const targetOf = (id: string) => (JOB_SPOTS[id] ? ({ kind: 'tile', x: JOB_SPOTS[id].x, y: JOB_SPOTS[id].y } as const) : ({ kind: 'place', id: id as PlaceId } as const));
/** A pause in a broken-up line (the hiss), ms. */
const HISS_MS = 700;
/** Before the threads of a `threads` step start, a moment to choose one (ms). */
const THREADS_LEAD_MS = 3000;
/** After the line to spot ends, a press still counts this long (ms). */
const SPOT_GRACE_MS = 1500;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const nameOf = (id: string) => cityPerson(id)?.name ?? jobSpeakerName(id);
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
  minute: appointment(now, doc.clock ?? 'quarter'),
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
  crew: null,
  crewTake: 0,
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
  // the story's chain (core/town/jobProgress): a job opens once the one before it is done; done jobs can be replayed
  const progress = useTownJobs();
  const unlocked = useMemo(() => jobs.filter((d) => isOpen(d) && jobUnlocked(d, progress, ADMIN)), [jobs, isOpen, progress]);
  /** Offered: the next of the chain (not done yet) and the side jobs; the done ones only to replay. */
  const open = useMemo(() => unlocked.filter((d) => d.side || !jobDone(progress, d.id)), [unlocked, progress]);
  const replays = useMemo(() => unlocked.filter((d) => !d.side && jobDone(progress, d.id)), [unlocked, progress]);
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
  // the phone (../phone): its log, whether its panel is open, the voice message a job waits on, a clock for deadlines
  const phone = usePhone();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const vmRef = useRef<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const genderRef = useRef(playerGender);
  useEffect(() => {
    genderRef.current = playerGender;
  }, [playerGender]);

  // ── waits and cancelling ──
  const token = useRef(0);
  const speech = useRef(0);
  /** The notebook being filled in (a job may have several: the voicemail and "Xin nhắc lại" are this one's). */
  const nbRef = useRef<Extract<Step, { kind: 'notebook' }> | null>(null);
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
    return { ref: lineRef(raw, minute), line: fillLine(raw, minute, runRef.current?.doc.clock ?? 'quarter') };
  }, []);
  /**
   * Say lines one after another (a new call stops what was being said). `bubble`: over whose head (null: the
   * speaker's). `slow`: a little slower (asked again). `volume(who, id)`: per line, for a talk overheard. The
   * learner's own lines are shown, and said only with PLAYER_VOICE.
   */
  /** When each line was last said, start and end (a `spot` step reads it). */
  const lineTimes = useRef(new Map<string, { at: number; end: number }>());
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
        lineTimes.current.set(id, { at: Date.now(), end: 0 });
        if (volume === 0 || (own && !PLAYER_VOICE)) await new Promise((r) => window.setTimeout(r, lineSeconds(said.line.text) * 1000));
        else if (said.line.broken) {
          // a line over a bad radio: its pieces, a silence at every "..." (no noise mixed in)
          const pieces = said.line.text.split(/\s*\.\.\.\s*/).filter((x) => /[a-z0-9]/i.test(x));
          for (let k = 0; k < pieces.length; k++) {
            if (speech.current !== mineTok) return false;
            await sayJobLine({ who: said.line.who, text: pieces[k] }, runRef.current?.doc.level ?? 2, { ...(volume !== undefined ? { volume } : {}), ...(o.slow ? { slow: true } : {}) });
            if (k < pieces.length - 1) await new Promise((r) => window.setTimeout(r, HISS_MS));
          }
        } else await sayJobLine(said.line, runRef.current?.doc.level ?? 2, { ...(volume !== undefined ? { volume } : {}), ...(o.slow ? { slow: true } : {}), ...(own ? { gender: genderRef.current } : {}) });
        const lt = lineTimes.current.get(id);
        if (lt) lt.end = Date.now();
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
      past: (ref) => pastFlag(loadTownJobs(), ref),
      crew: r.crew,
      clue: (id) => hasClue(loadTownJobs(), id),
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
        const target = to.kind === 'place' ? targetOf(to.id) : to;
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
        const right = typeof i.check.right === 'number' ? pick === i.check.right : i.check.right.includes(pick);
        patch((r) => ({ ...r, checks: { ...r.checks, [i.check!.fact]: right } }));
        if (!right) hit(i.check.consequence);
      }
    },
    [condState, flag, hit, now, patch, say, show, wait],
  );

  /** Inside warehouse fifteen (an `enter` not yet left), the boats of the run, the clips of a `pick`, a `spot`'s press. */
  const inRoomRef = useRef(false);
  const boatsRef = useRef<(() => void)[]>([]);
  const pickRef = useRef<readonly string[] | null>(null);
  const spotRef = useRef<{ at: string; pressed: 'early' | 'right' | 'late' | null } | null>(null);
  /** A `threads` step: which thread is listened to now. */
  const trackRef = useRef<string>('');
  /**
   * Several threads of talk at once (jobDoc §6): each thread's lines go by on their own clock (a line takes as long as
   * it would be said); only the thread listened to is heard (said aloud, logged); a key line that goes by on another
   * is that thread's consequence. Switching stops what was being said.
   */
  const playThreads = useCallback(
    async (tracks: readonly Track[], tok: number) => {
      type Due = { track: Track; id: string; at: number; dur: number };
      const due: Due[] = [];
      for (const t of tracks) {
        let at = 0;
        for (const id of now(t.lines)) {
          const dur = lineSeconds(jobLine(id)!.line.text) * 1000 + 600;
          due.push({ track: t, id, at, dur });
          at += dur;
        }
      }
      due.sort((a, b) => a.at - b.at);
      trackRef.current = tracks[0].id;
      show({ kind: 'threads', tracks, track: tracks[0].id });
      // a moment to see the threads and pick one before anything is said
      await new Promise((r) => window.setTimeout(r, THREADS_LEAD_MS));
      if (!alive(tok)) return;
      const t0 = Date.now();
      const end = Math.max(...due.map((d) => d.at + d.dur));
      let k = 0;
      while (alive(tok) && Date.now() - t0 < end) {
        const t = Date.now() - t0;
        while (k < due.length && due[k].at <= t) {
          const d = due[k++];
          if (d.track.id === trackRef.current) {
            const said = lineOf(d.id);
            patch((x) => (x.log.some((y) => y.ref === said.ref) ? x : { ...x, log: [...x.log, said] }));
            setSpeaking(said.line.who === 'player' ? 'player' : said.line.who);
            void sayJobLine(said.line, runRef.current?.doc.level ?? 2);
          } else if (d.track.consequence && (d.track.key ?? []).includes(d.id)) hit(d.track.consequence);
        }
        await new Promise((r) => window.setTimeout(r, 120));
      }
      setSpeaking(null);
    },
    [hit, lineOf, now, patch, show],
  );
  const switchTrack = useCallback(
    (id: string) => {
      trackRef.current = id;
      stopSpeaking();
      setSpeaking(null);
      show({ ...uiRef.current, track: id });
    },
    [show],
  );
  const pressSpot = useCallback(() => {
    const sp = spotRef.current;
    if (!sp || sp.pressed) return;
    const t = lineTimes.current.get(sp.at);
    if (!t) sp.pressed = 'early';
    else if (t.end === 0 || Date.now() - t.end <= SPOT_GRACE_MS) sp.pressed = 'right';
    else sp.pressed = 'late';
    show({ ...uiRef.current, label: sp.pressed });
  }, [show]);
  /** The job's car layer on the stage (registered the first time a step parks a car; gone when the run ends). */
  const carsOff = useRef<(() => void) | null>(null);
  const unpark = useCallback(() => {
    setParked([]);
    carsOff.current?.();
    carsOff.current = null;
  }, []);
  const playStep = useCallback(
    async (st: Step, next: Step | undefined, tok: number): Promise<void> => {
      if ('if' in st && st.if && !evalCond(st.if, condState())) return;
      const r0 = runRef.current!;
      switch (st.kind) {
        case 'goto': {
          stage.current?.endListen();
          const due = st.deadline ? (st.deadline.seconds ? Date.now() + st.deadline.seconds * 1000 : realTimeOf(runRef.current!.minute, Date.now())) : undefined;
          // the card shows the time the learner WROTE (a wrong note runs a wrong clock); it is judged by the real one
          const noted = st.deadline && !st.deadline.seconds && runRef.current!.picks.time !== undefined ? realTimeOf(Number(runRef.current!.picks.time), Date.now()) : due;
          show({ kind: 'go', target: st.place, label: st.label, ...(due !== undefined ? { deadline: noted, timed: true } : {}) });
          await until(near(st.place));
          if (!alive(tok)) return;
          if (st.deadline && due !== undefined && Date.now() > due) {
            hit(st.deadline.consequence);
            show({ kind: 'scene' });
            await say(now(st.deadline.lines));
          }
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
          nbRef.current = st;
          if (st.via === 'voicemail') {
            const from = now(st.call).map((id) => jobLine(id)?.line.who).find((w) => w && w !== 'player') ?? r0.doc.from;
            const vm = leaveVoicemail(r0.doc.id, from, now(st.call));
            vmRef.current = vm.id;
            show({ kind: 'voicemail', via: 'voicemail', label: from });
            const heardIt = await wait<true>('voicemail');
            vmRef.current = null;
            if (heardIt === CANCEL || !alive(tok)) return;
          }
          if (st.via === 'tape') {
            // the tape is listened to at the hideout when the learner owns it, else at Jun's stall
            const at = hideoutOwned() ? 'hideout' : 'jun';
            show({ kind: 'go', target: at, label: at === 'hideout' ? tr('Về chỗ ẩn nghe lại cuộn băng') : tr('Tới sạp Jun nghe lại cuộn băng') });
            const there = await until(near(at));
            if (!there || !alive(tok)) return;
          }
          patch((r) => ({ ...r, heard: bump(r.heard, keys) }));
          show({ kind: 'call', entries: st.entries, via: st.via ?? 'phone' });
          await say(now(st.call), st.via === 'scene' ? null : 'player');
          if (st.via === 'voicemail') setPhoneOpen(false);
          if (!alive(tok)) return;
          show({ kind: 'notes', entries: st.entries, via: st.via ?? 'phone' });
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
          if (st.board === false) return;
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
          stage.current?.gather(st.at as PlaceId, st.who as PlaceId[]);
          /** How far the learner is from the nearest of those standing there. */
          const nearest = (s: NonNullable<ReturnType<typeof snapshot>>): number => {
            const ds = st.who.map((w) => s.residents.find((x) => x.id === w)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => dist(s.player, x));
            return ds.length ? Math.min(...ds) : Infinity;
          };
          const lines = now(st.lines).slice(st.from && evalCond(st.from.if, condState()) ? st.from.index : 0);
          const pw = next?.kind === 'password' ? next : null;
          show({ kind: 'overhear', askWho: pw ? [pw.who] : [], noticed: false });
          // they start when the learner is near enough to hear anything (or after a while all the same)
          await until(near(st.at, FAINT_WITHIN + 3), 25000);
          if (!alive(tok)) return;
          const volume = (_who: string, id: string) => {
            const s = snapshot();
            const c = s ? overhearClarity(nearest(s), skyNow().mix.rain) : 'none';
            if (id === st.word && c !== 'none') patch((x) => ({ ...x, heardWord: true, heard: bump(x.heard, ['word']) }));
            return CLARITY_VOLUME[c];
          };
          const halt = { now: false };
          // too near before the word was heard: they notice and stop (only a step with `noticed`)
          const watch = window.setInterval(() => {
            const s = snapshot();
            if (!s) return;
            const d = nearest(s);
            if (!Number.isFinite(d)) return;
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
        case 'patrol': {
          // a police car drives one street now; the scanner says the job's lines (features/town/streets/jobPolice.ts)
          show({ kind: 'patrol', label: st.street });
          const scan: JobScanLine[] = (st.lines ?? []).map((l) => {
            const said = lineOf(l.line);
            patch((x) => (x.log.some((y) => y.ref === said.ref) ? x : { ...x, log: [...x.log, said] }));
            return { who: said.line.who === 'scanner-desk' ? 'dispatch' : 'unit', text: said.line.text, vi: said.line.vi, ...(l.at !== undefined ? { at: l.at } : {}) };
          });
          const { seen } = await jobPatrol({ street: st.street, ...(st.from ? { from: st.from } : {}), ...(st.to ? { to: st.to } : {}), seconds: st.seconds, lines: scan });
          if (!alive(tok)) return;
          if (seen && st.seen) {
            if (st.seen.consequence) hit(st.seen.consequence);
            if (st.seen.flag) flag(st.seen.flag);
            show({ kind: 'phone' });
            await say(now(st.seen.lines), 'player');
          }
          return;
        }
        case 'scanner': {
          show({ kind: 'patrol', label: '' });
          const ids = now(st.lines);
          const said = ids.map((id) => lineOf(id));
          patch((x) => ({ ...x, log: [...x.log, ...said.filter((l) => !x.log.some((y) => y.ref === l.ref))] }));
          await sayOnScanner(said.map((l) => ({ who: l.line.who === 'scanner-desk' ? 'dispatch' : 'unit', text: l.line.text, vi: l.line.vi })));
          return;
        }
        case 'enter': {
          // to that door of warehouse fifteen, then in through the dark with the job's people
          const door = st.door ?? 'front';
          const spot = `w15-${door}`;
          show({ kind: 'go', target: spot, label: st.label ?? tr('Tới cửa kho mười lăm') });
          const there = await until(near(spot, 3));
          if (!there || !alive(tok)) return;
          await new Promise<void>((res) => {
            const ok = enterWarehouse(stage.current, { door, ...(st.host ? { host: st.host } : {}), ...(st.visitor ? { visitor: st.visitor } : {}), ...(st.more ? { more: st.more } : {}) }, () => res());
            if (!ok) res();
            else window.setTimeout(res, 6000);
          });
          inRoomRef.current = true;
          return;
        }
        case 'leave': {
          if (inRoomRef.current) stage.current?.endTalk();
          inRoomRef.current = false;
          await new Promise((r) => window.setTimeout(r, 900));
          return;
        }
        case 'boat': {
          const from = st.from && st.from !== 'jetty' ? doorOf(st.from) : null;
          const to = st.to && st.to !== 'w15-water' ? doorOf(st.to) : W15_MOORING;
          show({ kind: 'scene', label: 'boat' });
          const b = runBoat(stage.current, { ...(from ? { from } : {}), ...(to ? { to } : {}), aboard: !!st.aboard });
          if (!b) return;
          boatsRef.current.push(b.stop);
          await b.arrived;
          return;
        }
        case 'threads': {
          await playThreads(st.tracks, tok);
          return;
        }
        case 'pick': {
          await say(now(st.ask), 'player');
          if (!alive(tok)) return;
          show({ kind: 'pick', clips: st.clips.length });
          pickRef.current = st.clips;
          const choice = await wait<number>('pick');
          pickRef.current = null;
          if (choice === CANCEL || !alive(tok)) return;
          const right = choice === st.right;
          patch((x) => ({ ...x, checks: { ...x.checks, [st.fact]: right } }));
          if (!right) hit(st.consequence);
          return;
        }
        case 'spot': {
          // the lines play; "Đó!" when the line `at` is said (until a moment after it ends)
          spotRef.current = { at: st.at, pressed: null };
          lineTimes.current.delete(st.at);
          show({ kind: 'spot', via: st.via === 'scanner' ? 'radio' : st.via === 'scene' ? 'scene' : st.via === 'phone' ? 'phone' : 'radio' });
          await say(now(st.lines), st.via === 'scene' ? null : 'player');
          if (!alive(tok)) return;
          if (!spotRef.current.pressed) await new Promise((r) => window.setTimeout(r, SPOT_GRACE_MS));
          const outcome = spotRef.current.pressed ?? 'never';
          spotRef.current = null;
          patch((x) => ({ ...x, checks: { ...x.checks, [st.fact]: outcome === 'right' } }));
          if (outcome !== 'right') hit(st[outcome]);
          return;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const role = r.crew ? doc.crew?.roles.find((x) => x.who === r.crew) : undefined;
      const { xu, take } = payJob(doc.id, grade, t, role?.cut ?? 0);
      if (role?.with === 'ride') stage.current?.passenger(role.who as PlaceId, false);
      unpark();
      for (const stop of boatsRef.current.splice(0)) stop();
      if (inRoomRef.current) stage.current?.endTalk();
      inRoomRef.current = false;
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
      // what the story remembers: the grade, and the flags and consequences later jobs read
      finishJobRun(doc.id, grade, [...runRef.current!.flags.filter((f) => !f.startsWith('aboard:') && !f.startsWith('asked:')), ...[...hits].map((h) => `hit:${h}`)], t);
      patch((x) => ({ ...x, xu, missed, enrolled, crewTake: take }));
      show({ kind: 'debrief' });
      onReward({ label: tl`Phi vụ xong: ${tr(GRADE_NAME[grade])}`, ...(xu > 0 ? { xu } : {}) });
    },
    [lineOf, now, onReward, patch, say, show, stage, unpark],
  );

  /** One step with what goes round it: a car parked for its length, a call in the phone's log, the clue it gives. */
  const runStep = useCallback(
    async (st: Step, next: Step | undefined, tok: number): Promise<void> => {
      if ('if' in st && st.if && !evalCond(st.if, condState())) return;
      const park = (st.kind === 'scene' || st.kind === 'overhear') && st.park?.length ? st.park : null;
      if (park) {
        if (!carsOff.current) carsOff.current = stage.current?.addExtra(makeParkedLayer) ?? null;
        setParked(park.map((c) => ({ at: c.at, look: c.look ?? 0 })));
      }
      // a call on the learner's phone goes into its log (a voice message is logged when it is left)
      if (st.kind === 'phone' || (st.kind === 'notebook' && (st.via ?? 'phone') === 'phone')) {
        const first = now(st.kind === 'phone' ? st.lines : st.call).map((id) => jobLine(id)?.line.who).find((w) => w && w !== 'player');
        if (first) logCall(first, runRef.current?.doc.id);
      }
      await playStep(st, next, tok);
      if (park) setParked([]);
      // a clue the step gives (data/city/clues.ts): heard through, it is the learner's
      if (alive(tok) && 'clue' in st && st.clue) grantClue(st.clue);
    },
    [condState, now, playStep, stage],
  );
  const direct = useCallback(
    async (doc: JobDoc) => {
      const tok = token.current;
      const steps = doc.steps;
      for (let i = 0; i < steps.length; i++) {
        if (!alive(tok)) return;
        await runStep(steps[i], steps[i + 1], tok);
      }
      if (alive(tok)) await finish(tok);
    },
    [finish, runStep],
  );

  // ── starting, giving up ──
  // a job whose offer is held by the phone (a missed call waiting to be returned, or gone until the next game day) does not ring
  const ringing = ui.kind === 'idle' ? (open.find((d) => !d.side && !declined.includes(d.id) && !offerHeld(d.id, clock)) ?? null) : null;
  const [ringFor, setRingFor] = useState<JobDoc | null>(null);
  const offered = ui.kind === 'ringing' ? ringFor : free && !phoneOpen ? ringing : null;
  // a job not answered: a missed call with the caller's voice message and a deadline by the game's clock
  const missJob = useCallback((jobId: string) => {
    const doc = jobs.find((d) => d.id === jobId);
    if (!doc) return;
    missCall(jobId, doc.from);
    if (uiRef.current.kind === 'ringing') {
      setRingFor(null);
      show({ kind: 'idle' });
    }
  }, [jobs, show]);
  // the phone knows what rings; unanswered for RING_MS it is a missed call ("call me back before …", core/town/phone.ts)
  const offeredId = offered?.id ?? null;
  useEffect(() => {
    phoneRinging(offeredId, offeredId ? (jobs.find((d) => d.id === offeredId)?.from ?? '') : '');
    if (!offeredId) return;
    const id = window.setTimeout(() => missJob(offeredId), RING_MS);
    return () => window.clearTimeout(id);
  }, [offeredId, jobs, missJob]);
  const start = useCallback(
    (jobId: string) => {
      const doc = jobs.find((d) => d.id === jobId);
      if (!doc || (uiRef.current.kind !== 'idle' && uiRef.current.kind !== 'ringing')) return;
      const held = offerHeld(jobId);
      if (held === 'gone') return;
      if (held === 'waiting') {
        setPhoneOpen(true);
        return;
      }
      setRingFor(doc);
      show({ kind: 'ringing' });
    },
    [jobs, show, setPhoneOpen],
  );
  const accept = useCallback(
    (doc: JobDoc) => {
      cancelAll();
      phoneRinging(null);
      runRef.current = blank(doc, Date.now());
      setRun(runRef.current);
      setNote(null);
      if (doc.crew?.roles.length) {
        show({ kind: 'crew' });
        return;
      }
      void direct(doc);
    },
    [cancelAll, direct, show],
  );
  /** The crew picked (null: alone): they stand or ride where the job says, then the job starts. */
  const pickCrew = useCallback(
    (role: CrewRole | null) => {
      const r = runRef.current;
      if (!r) return;
      patch((x) => ({ ...x, crew: role?.who ?? null, flags: role ? [...x.flags, `crew:${role.who}`] : x.flags }));
      if (role?.with === 'ride') stage.current?.passenger(role.who as PlaceId, true);
      else if (role?.with) stage.current?.gather(role.with.at as PlaceId, [role.who as PlaceId]);
      show({ kind: 'call' });
      void direct(r.doc);
    },
    [direct, patch, show, stage],
  );
  const quit = useCallback(() => {
    const r = runRef.current;
    cancelAll();
    stage.current?.endListen();
    const aboard = r ? aboardOf(r.flags) : '';
    if (aboard) stage.current?.passenger(aboard as PlaceId, false);
    const role = r?.crew ? r.doc.crew?.roles.find((x) => x.who === r.crew) : undefined;
    if (role?.with === 'ride') stage.current?.passenger(role.who as PlaceId, false);
    unpark();
    for (const stop of boatsRef.current.splice(0)) stop();
    if (inRoomRef.current) stage.current?.endTalk();
    inRoomRef.current = false;
    phoneRinging(null);
    if (r) setDeclined((d) => [...d, r.doc.id]);
    else if (ringFor) setDeclined((d) => [...d, ringFor.id]);
    runRef.current = null;
    setRun(null);
    setRingFor(null);
    setNote(null);
    show({ kind: 'idle' });
    stage.current?.focus();
  }, [cancelAll, ringFor, show, stage, unpark]);
  /** A missed call returned from the phone: in time the job starts; late, the caller says it is gone. */
  const returnCall = useCallback(
    async (entryId: string) => {
      const e = phoneState().log.find((x) => x.id === entryId);
      const doc = e?.jobId ? jobs.find((d) => d.id === e.jobId) : undefined;
      if (!e || !doc || (uiRef.current.kind !== 'idle' && uiRef.current.kind !== 'ringing')) return;
      const res = callBack(entryId);
      if (!res) return;
      setPhoneOpen(false);
      await sayPhoneLine(res === 'ok' ? PHONE_LINES.there : PHONE_LINES.tooLate, doc.from, null);
      if (res === 'ok') accept(doc);
    },
    [accept, jobs, setPhoneOpen],
  );
  /** A voice message played from the phone: a job's briefing goes on; another is said again. */
  const playVoicemail = useCallback(
    (entryId: string) => {
      const e = phoneState().log.find((x) => x.id === entryId);
      if (!e) return;
      if (vmRef.current === entryId && resolve('voicemail', true)) return;
      setPhoneOpen(false);
      if (e.kind === 'missed' && e.deadline) void sayPhoneLine(PHONE_LINES.ringBack, e.from, timeWords(e.deadline.minute));
      else if (e.lines?.length) void (async () => { for (const id of e.lines!) { const l = jobLine(id)?.line; if (l) await sayJobLine(l, 2); } })();
    },
    [resolve, setPhoneOpen],
  );

  // ── the panels' actions ──
  const replayCall = useCallback(
    (slow = false) => {
      const st = nbRef.current;
      if (!runRef.current || !st) return;
      patch((x) => ({ ...x, heard: bump(x.heard, st.entries.map((e) => e.key)) }));
      void say(now(st.call), st.via === 'scene' ? null : 'player', { slow });
    },
    [now, patch, say],
  );
  const replayFact = useCallback(
    (key: string) => {
      const r = runRef.current;
      const st = nbRef.current;
      const e = st?.entries.find((x) => x.key === key);
      if (!r || !st || !e) return;
      const repeats = r!.repeats + 1;
      patch((x) => ({ ...x, repeats, heard: bump(x.heard, [key]), flags: x.flags.includes('asked') ? x.flags : [...x.flags, 'asked'] }));
      const lines = st.repeat?.[key] ?? [e.line];
      void say([...lines, ...(st.patience && repeats === st.patience.after ? [st.patience.line] : [])], st.via === 'scene' ? null : 'player', { slow: !st.repeat?.[key] });
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
  const crewWorld = useCrewWorld();
  const quests = useMemo<Quest[]>(() => {
    const tag = tr('Phi vụ');
    if (!active || !run)
      return [
        // the story's next job first (a page may show only the first card), the side jobs after it
        ...[...open.filter((d) => !d.side), ...open.filter((d) => d.side)]
          .filter((d) => offerHeld(d.id, clock) !== 'gone')
          .map((d) => {
            const missed = offerHeld(d.id, clock) === 'waiting' ? phone.log.find((e) => e.kind === 'missed' && e.jobId === d.id && e.deadline) : undefined;
            return { id: `job:${d.id}`, tag, title: d.title, step: missed?.deadline ? tl`Gọi lại ${nameOf(d.from)} trước ${clockOf(missed.deadline.minute)}` : tl`${nameOf(d.from)} có việc cho bạn`, target: null };
          }),
        ...replays.map((d) => ({ id: `job:${d.id}`, tag: tr('Chơi lại'), title: d.title, step: tr('Phi vụ đã làm. Chơi lại để thử cách khác'), target: null })),
      ];
    const doc = run.doc;
    const base = { id: `job:${doc.id}`, tag, title: doc.title };
    const step = (() => {
      switch (ui.kind) {
        case 'call':
          return tr('Đang nghe điện thoại');
        case 'crew':
          return tr('Chọn người đi cùng');
        case 'patrol':
          return tr('Nghe bộ đàm cảnh sát');
        case 'threads':
          return tr('Ba chuyện cùng lúc: chọn nghe chuyện nào');
        case 'pick':
          return tr('Nghe từng đoạn, chọn đúng cuộn');
        case 'spot':
          return tr('Bấm "Đó!" đúng lúc câu đó được nói');
        case 'voicemail':
          return tr('Mở điện thoại nghe tin nhắn thoại');
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
    return [{ ...base, step, target: ui.kind === 'go' && ui.target ? targetOf(ui.target) : null }];
  }, [active, run, open, replays, ui, clock, phone]);

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
              // "later": a missed call on the phone, to be returned before its deadline (core/town/phone.ts)
              const id = offered.id;
              missJob(id);
              quit();
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
              <Icon icon={ui.via === 'radio' ? Radio : ui.via === 'scene' ? MessageCircle : ui.via === 'tape' ? CassetteTape : Phone} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">{ui.via === 'radio' ? 'Bộ đàm' : ui.via === 'scene' ? (speaking && speaking !== 'player' ? nameOf(speaking) : 'Nghe họ nói') : ui.via === 'tape' ? 'Cuộn băng' : 'Điện thoại'}</span>
              {hearing(speaking !== null ? 'Đang nói… chỉ nghe thôi, không có chữ.' : 'Đã dập máy.')}
            </p>
          </div>
        );
      case 'voicemail':
        return (
          <div className="town-welcome job-strip is-ringing" role="status">
            <span className="job-strip-icon" aria-hidden="true">
              <Icon icon={Voicemail} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">{tl`Tin nhắn thoại mới · ${nameOf(ui.label ?? '')}`}</span>
              Mở điện thoại để nghe.
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoneOpen(true)}>
              <Icon icon={Phone} size={16} />
              Mở điện thoại
            </button>
          </div>
        );
      case 'patrol':
        return (
          <div className="town-welcome job-strip" role="status">
            <span className="job-strip-icon" aria-hidden="true">
              <Icon icon={Siren} size={20} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">{ui.label ? tl`Xe tuần tra trên ${ui.label}` : 'Bộ đàm cảnh sát'}</span>
              {ui.label ? 'Nghe bộ đàm. Đừng đứng giữa đường khi xe tới.' : 'Nghe bộ đàm cảnh sát.'}
            </p>
          </div>
        );
      case 'threads':
        return ui.tracks ? <JobThreads tracks={ui.tracks} current={ui.track ?? ''} speaking={speaking !== null} onSwitch={switchTrack} /> : null;
      case 'pick':
        return <JobPick count={ui.clips ?? 0} onPlay={(i) => pickRef.current && void say([pickRef.current[i]], 'player')} onPick={(i) => resolve('pick', i)} />;
      case 'spot':
        return <JobSpot speaking={speaking !== null} pressed={ui.label ?? null} onPress={pressSpot} />;
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

  const node = (
    <>
      {pill}
      {free && <PhoneButton waiting={phone.log} ringing={!!phone.incoming} now={clock} onOpen={() => setPhoneOpen(true)} />}
      {phoneOpen && (
        <PhonePanel
          log={phone.log}
          now={clock}
          nameOf={nameOf}
          contacts={contactsOf(jobs, crewWorld)}
          clues={loadTownJobs().clues ?? {}}
          busy={active && ui.kind !== 'voicemail'}
          onCallBack={(id) => void returnCall(id)}
          onPlay={playVoicemail}
          onClose={() => setPhoneOpen(false)}
        />
      )}
      {ui.kind === 'crew' && run && run.doc.crew && <CrewPicker doc={run.doc} world={crewWorld} nameOf={nameOf} onPick={pickCrew} onClose={quit} />}
      {free && !phoneOpen && strip}
      {free && mineNode}
      {ui.kind === 'notes' && run && ui.entries && (
        <Suspense fallback={null}>
          <JobNotebook
            entries={ui.entries}
            options={(key) => notebookOptions(ui.entries!, key, run.minute, run.seed, run.doc.clock ?? 'quarter')}
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

  // dev only: headless replays of a job read where the run stands and press what the panels press (gta-plan §16)
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __job?: unknown }).__job = { ui, run, ask, choose, askAgain, quests, phone, pickCrew, returnCall, playVoicemail, openPhone: setPhoneOpen, missCall: missJob, switchTrack, pressSpot, pick: (i: number) => resolve('pick', i) };
  }, [ui, run, ask, choose, askAgain, quests, phone, pickCrew, returnCall, playVoicemail, missJob, switchTrack, pressSpot, resolve]);

  return {
    active,
    quests,
    deadline: ui.kind === 'go' ? (ui.deadline ?? null) : null,
    prompt,
    talk,
    start,
    speaking,
    sheet: ui.kind === 'notes' || ui.kind === 'password' || ui.kind === 'debrief' || ui.kind === 'ride' || ui.kind === 'crew' || ui.kind === 'pick' || phoneOpen,
    node,
  };
}

/** The options of an entry as offered (the time's made from the appointment), in an order by the run's seed. */
function notebookOptions(entries: readonly NoteEntry[], key: string, minute: number, seed: number, style: ClockStyle) {
  return noteOptions(entries.find((x) => x.key === key)!, minute, seed + key.length, style);
}

const CLARITY_NAME: Readonly<Record<Clarity, string>> = {
  clear: 'Nghe rõ',
  faint: 'Nghe loáng thoáng',
  none: 'Chưa nghe thấy gì',
};
