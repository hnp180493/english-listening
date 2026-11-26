// The runner of a Westbay job ("phi vụ", core/town/job.ts; milestone M0 of docs/gta-plan.md): the four beats played
// on the city's stage. CityPage hands it the stage and asks it, each render, for the quest card, the one button, who
// speaks, and what to draw over the stage; it takes the clicks on people while a job is under way.
//
//   ringing → call (sound only) → notes (the notebook) → toPickup (the learner goes to what THEY wrote) → find (the
//   crowd at the pickup's door; ask one) → drive (the car takes the passenger's way by itself and stops at each
//   junction: the learner picks left / straight / right) → brief (Rico again) → overhear (two people; each line heard
//   clearly, faintly or not at all by the distance when it starts) → password (typed) → closing → debrief.
//
// Every wrong note has ONE consequence that plays out and rejoins the main line: the wrong pickup (nobody there, Rico
// rings, annoyed, and says it again), the wrong time (the passenger has been waiting, and says since when), the wrong
// street to avoid (a Bayline car behind), the wrong description (whoever is asked sends the learner away). Hearing
// again is an action with a cost, counted per fact: the voicemail (time runs), "Xin nhắc lại" to the passenger (his
// patience), the shared practice keys for replay / slow.
//
// A run lives in memory only (a reload drops it; nothing was paid yet): pay and review cards are written once, at the
// end (core/town/jobStore.ts). Everything said is in the browser's voice (Westbay's people).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Ear, MessageCircleQuestion, Phone, PhoneIncoming, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { useShortcuts } from '../../../components/useShortcuts';
import { cityPerson } from '../../../core/town/cityPeople';
import {
  appointment,
  arrivedLate,
  chooseTurn,
  CLARITY_VOLUME,
  clockOf,
  fillLine,
  gradeJob,
  lineRef,
  missedLines,
  NOTICED_WITHIN,
  noteAnswer,
  noteOptions,
  notesWrong,
  overhearClarity,
  PATIENCE,
  realTimeOf,
  waysOf,
  type Clarity,
  type JobGrade,
  type JobLine,
  type JobRun,
  type JobScript,
  type NoteKey,
  type Turn,
} from '../../../core/town/job';
import { enrolJobMisses, jobPaidToday, payJob } from '../../../core/town/jobStore';
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
import { lineSeconds, sayJobLine } from './jobAudio';
import { GRADE_NAME } from './jobText';
import { JobDebrief, JobNotebook, JobPassword } from './jobPanels';
import './jobs.css';

export type JobPhase = 'idle' | 'ringing' | 'call' | 'notes' | 'toPickup' | 'find' | 'drive' | 'brief' | 'overhear' | 'password' | 'closing' | 'debrief';

/** A line as it was said in this run: its review ref and its text with the time filled in. */
export interface SaidJobLine {
  ref: string;
  line: JobLine;
}

export interface JobState {
  phase: JobPhase;
  /** The appointment (a minute of the game's day). */
  minute: number;
  seed: number;
  picks: Partial<Record<NoteKey, string>>;
  /** Times each fact was heard: the notebook's keys, each junction's id, 'password' (passes it was heard in). */
  heard: Record<string, number>;
  /** At the wrong pickup first (Rico rang); the way is shown to the right one from then on. */
  wrongPlace: boolean;
  late: boolean;
  spotted: boolean;
  asked: string[];
  wrongPeople: number;
  /** The junction the car is at or going to, and whether it waits for the learner's choice there. */
  at: number;
  choosing: boolean;
  wrongAt: string[];
  wrongTurns: number;
  asks: number;
  passes: number;
  /** The password's line was heard (clearly or faintly) at least once: going up to Gus is no longer "caught listening". */
  heardWord: boolean;
  noticed: boolean;
  password: JobRun['password'] | null;
  log: SaidJobLine[];
  grade: JobGrade | null;
  run: JobRun | null;
  xu: number;
  paidBefore: boolean;
  enrolled: number;
  missed: string[];
}

const fresh = (job: JobScript, now: number, phase: JobPhase): JobState => ({
  phase,
  minute: appointment(now),
  seed: Math.floor(now / 1000),
  picks: {},
  heard: {},
  wrongPlace: false,
  late: false,
  spotted: false,
  asked: [],
  wrongPeople: 0,
  at: 0,
  choosing: false,
  wrongAt: [],
  wrongTurns: 0,
  asks: 0,
  passes: 0,
  heardWord: false,
  noticed: false,
  password: null,
  log: [],
  grade: null,
  run: null,
  xu: 0,
  paidBefore: jobPaidToday(job.id, now),
  enrolled: 0,
  missed: [],
});

const doorOf = (id: string): { x: number; y: number } | null => {
  const p = CITY_PLACES.find((q) => (q.id as string) === id);
  return p ? { x: p.door.x + 0.5, y: p.door.y + 0.5 } : null;
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const nameOf = (id: string) => cityPerson(id)?.name ?? id;
const bump = (h: Record<string, number>, keys: readonly string[]) => {
  const out = { ...h };
  for (const k of keys) out[k] = (out[k] ?? 0) + 1;
  return out;
};

/** Close enough to a place's door to be "there" (tiles). */
const AT_PLACE = 5;

const TURN_ICON: Readonly<Record<Turn, LucideIcon>> = { left: ArrowLeft, straight: ArrowUp, right: ArrowRight };
const TURN_NAME: Readonly<Record<Turn, string>> = { left: 'Rẽ trái', straight: 'Đi thẳng', right: 'Rẽ phải' };
const TURN_KEY: Readonly<Record<string, Turn>> = { ArrowLeft: 'left', ArrowUp: 'straight', ArrowRight: 'right' };

export interface CityJobOptions {
  job: JobScript;
  stage: RefObject<TownStageHandle | null>;
  /** The job may be offered now (the 3D city is up, and Rico has been met or the admin sandbox is on). */
  available: boolean;
  /** The stage is on the screen and nothing of the page's own is open over it. */
  free: boolean;
  /** Who the player stands beside. */
  nearId: string | null;
  sound: boolean;
  onReward: (r: { label: string; xu?: number }) => void;
}

export interface CityJob {
  /** A job is under way (past the ringing phone): the page's own quests, prompts and talks step back. */
  active: boolean;
  /** The job's quest (offered or under way), and its clock (ms since the epoch). */
  quest: Quest | null;
  deadline: number | null;
  /** The one button, when the job wants it. */
  prompt: { icon: LucideIcon; text: string; run: () => void } | null;
  /** Somebody clicked, or E beside them: true = the job took it. */
  talk: (id: string) => boolean;
  /** Ring the phone (the quest card picked). */
  start: () => void;
  /** Whose line sounds now (a bubble over their head; 'player' for the phone and the passenger in the car). */
  speaking: string | null;
  /** The stage takes no input: a sheet of the job is open, or the car is taking the passenger's way. */
  sheet: boolean;
  node: ReactNode;
}

export function useCityJob({ job, stage, available, free, nearId, sound, onReward }: CityJobOptions): CityJob {
  const [s, setS] = useState<JobState>(() => fresh(job, Date.now(), 'idle'));
  const ref = useRef(s);
  const set = useCallback((change: (old: JobState) => JobState) => {
    const next = change(ref.current);
    ref.current = next;
    setS(next);
  }, []);
  const [speaking, setSpeaking] = useState<string | null>(null);
  /** Rico is on the phone (the strip shows the call, whatever the phase). */
  const [phone, setPhone] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [heard, setHeard] = useState<Clarity>('none');
  const token = useRef(0);
  useEffect(
    () => () => {
      token.current++;
      stopSpeaking();
    },
    [],
  );

  const lineOf = useCallback((id: string): SaidJobLine => {
    const raw = jobLine(id)!.line;
    const minute = ref.current.minute;
    return { ref: lineRef(raw, minute), line: fillLine(raw, minute) };
  }, []);

  /**
   * Say lines one after another (a new call stops what was being said). `bubble` = over whose head; null = the line's
   * speaker. `slow`: a little slower (asked again). `volume(who, id)`: per line, for a talk overheard.
   */
  const say = useCallback(
    async (ids: readonly string[], bubble: string | null = null, o: { volume?: (who: string, id: string) => number; slow?: boolean } = {}): Promise<boolean> => {
      const mine = ++token.current;
      stopSpeaking();
      for (const id of ids) {
        if (token.current !== mine) return false;
        const said = lineOf(id);
        set((old) => (old.log.some((l) => l.ref === said.ref) ? old : { ...old, log: [...old.log, said] }));
        const volume = o.volume ? o.volume(said.line.who, id) : undefined;
        setSpeaking(bubble ?? said.line.who);
        if (volume === 0) await new Promise((r) => window.setTimeout(r, lineSeconds(said.line.text) * 1000));
        else await sayJobLine(said.line, job.level, { ...(volume !== undefined ? { volume } : {}), ...(o.slow ? { slow: true } : {}) });
        if (token.current !== mine) return false;
        await new Promise((r) => window.setTimeout(r, 250));
      }
      if (token.current === mine) setSpeaking(null);
      return token.current === mine;
    },
    [job.level, lineOf, set],
  );
  const hush = useCallback(() => {
    token.current++;
    stopSpeaking();
    setSpeaking(null);
  }, []);

  // ── beat 1: the phone rings, the briefing, the notebook ──
  const noteKeys = useMemo(() => job.notebook.map((e) => e.key), [job.notebook]);
  const ringing = available && free && !declined && s.phase === 'idle';
  const start = useCallback(() => {
    if (ref.current.phase !== 'idle' && ref.current.phase !== 'ringing') return;
    setDeclined(false);
    set(() => fresh(job, Date.now(), 'ringing'));
  }, [job, set]);
  const accept = useCallback(async () => {
    set((old) => ({ ...fresh(job, Date.now(), 'call'), paidBefore: old.paidBefore, heard: bump({}, noteKeys) }));
    await say(job.call, 'player');
    if (ref.current.phase === 'call') set((old) => ({ ...old, phase: 'notes' }));
  }, [job, noteKeys, say, set]);
  /** The whole voicemail again (every fact heard once more; the appointment's clock runs meanwhile). */
  const replayCall = useCallback(
    (slow = false) => {
      set((old) => ({ ...old, heard: bump(old.heard, noteKeys) }));
      void say(job.call, 'player', { slow });
    },
    [job.call, noteKeys, say, set],
  );
  /** One fact of the voicemail again, a little slower. */
  const replayFact = useCallback(
    (key: NoteKey) => {
      const e = job.notebook.find((x) => x.key === key);
      if (!e) return;
      set((old) => ({ ...old, heard: bump(old.heard, [key]) }));
      void say([e.line], 'player', { slow: true });
    },
    [job.notebook, say, set],
  );
  const setPick = useCallback((key: NoteKey, value: string) => set((old) => ({ ...old, picks: { ...old.picks, [key]: value } })), [set]);
  const go = useCallback(() => {
    hush();
    set((old) => ({ ...old, phase: 'toPickup' }));
    stage.current?.focus();
  }, [hush, set, stage]);
  const quit = useCallback(() => {
    hush();
    stage.current?.endListen();
    stage.current?.passenger(job.pickup.passenger as PlaceId, false);
    setDeclined(true);
    setNote(null);
    set(() => fresh(job, Date.now(), 'idle'));
    stage.current?.focus();
  }, [hush, job, set, stage]);

  // the noted pickup (where the job leads the learner), and the time noted
  const notedPlace = job.places[s.picks.pickup ?? ''] ?? null;
  const notedMinute = s.picks.time !== undefined ? Number(s.picks.time) : null;

  // ── the end ──
  const finish = useCallback(
    async (password: JobRun['password']) => {
      const st = ref.current;
      stage.current?.endListen();
      const run: JobRun = { wrongPlace: st.wrongPlace, late: st.late, spotted: st.spotted, wrongPeople: st.wrongPeople, wrongTurns: st.wrongTurns, asks: st.asks, noticed: st.noticed, password };
      const grade = gradeJob(run);
      set((old) => ({ ...old, phase: 'closing', password, grade, run }));
      await say(job.ending[grade], 'player');
      const now = Date.now();
      const xu = payJob(job.id, grade, now);
      const said = new Set(ref.current.log.map((l) => l.ref));
      // only what was said in this run can have been missed
      const missed = missedLines({
        entries: job.notebook,
        wrongNotes: notesWrong(job.notebook, st.picks, st.minute),
        wrongPeople: st.wrongPeople,
        junctions: job.junctions,
        wrongAt: st.wrongAt,
        password,
        passwordLine: job.password.line,
      })
        .map((id) => lineOf(id).ref)
        .filter((r) => said.has(r));
      const enrolled = enrolJobMisses(missed, now);
      set((old) => ({ ...old, phase: 'debrief', xu, missed, enrolled }));
      onReward({ label: tl`Phi vụ xong: ${tr(GRADE_NAME[grade])}`, ...(xu > 0 ? { xu } : {}) });
    },
    [job, lineOf, onReward, say, set, stage],
  );

  // ── beat 3: Rico again, then the two at the big wheel ──
  const toOverhear = useCallback(async () => {
    set((old) => ({ ...old, phase: 'brief' }));
    const done = await say(job.brief, 'player');
    if (!done && ref.current.phase !== 'brief') return;
    stage.current?.gather(job.overhear.host as PlaceId, job.overhear.who as unknown as PlaceId[]);
    set((old) => ({ ...old, phase: 'overhear' }));
  }, [job, say, set, stage]);

  // ── beat 2: the passenger's way, junction by junction ──
  /** The car takes the way to `to` (a walk the stage makes; a dip to dark where there is none), then `then`. */
  const travel = useCallback(
    (to: { x: number; y: number }, then: () => void) => {
      const st = stage.current;
      if (!st) return then();
      if (!st.travelTo({ kind: 'tile', x: to.x, y: to.y }, 'walk', then) && !st.travelTo({ kind: 'tile', x: to.x, y: to.y }, 'warp', then)) then();
    },
    [stage],
  );
  const toJunction = useCallback(
    (k: number) => {
      const j = job.junctions[k];
      if (!j) {
        // past the last junction: the drop-off
        set((old) => ({ ...old, at: k, choosing: false }));
        void say([job.dropoff.near], 'player');
        const st = stage.current;
        const arrive = () => {
          stage.current?.passenger(job.pickup.passenger as PlaceId, false);
          void (async () => {
            await say([job.dropoff.arrive]);
            await toOverhear();
          })();
        };
        if (!st || (!st.travelTo({ kind: 'place', id: job.dropoff.place as PlaceId }, 'walk', arrive) && !st.travelTo({ kind: 'place', id: job.dropoff.place as PlaceId }, 'warp', arrive))) arrive();
        return;
      }
      set((old) => ({ ...old, at: k, choosing: false, heard: bump(old.heard, [j.id]) }));
      void say([j.line], 'player');
      travel(j.at, () => {
        if (ref.current.phase === 'drive' && ref.current.at === k) set((old) => ({ ...old, choosing: true }));
      });
    },
    [job, say, set, stage, toOverhear, travel],
  );
  const choose = useCallback(
    (turn: Turn) => {
      const st = ref.current;
      const j = job.junctions[st.at];
      if (st.phase !== 'drive' || !st.choosing || !j) return;
      const verdict = chooseTurn(j, turn);
      if (verdict === 'none') return;
      if (verdict === 'right') {
        toJunction(st.at + 1);
        return;
      }
      // a wrong way: a few tiles down it, the passenger says so, back to the junction to choose again (time lost)
      const way = j.ways[turn]!;
      set((old) => ({ ...old, choosing: false, wrongTurns: old.wrongTurns + 1, wrongAt: old.wrongAt.includes(j.id) ? old.wrongAt : [...old.wrongAt, j.id] }));
      travel(way.to, () => {
        void (async () => {
          if (way.line) await say([way.line], 'player');
          travel(j.at, () => {
            if (ref.current.phase === 'drive' && ref.current.at === st.at) set((old) => ({ ...old, choosing: true }));
          });
        })();
      });
    },
    [job.junctions, say, set, toJunction, travel],
  );
  /** "Xin nhắc lại" to the passenger: he says the way again, a little slower; past his patience he minds. */
  const askAgain = useCallback(
    (slow = true) => {
      const st = ref.current;
      const j = job.junctions[st.at];
      if (st.phase !== 'drive' || !j) return;
      set((old) => ({ ...old, asks: old.asks + 1, heard: bump(old.heard, [j.id]) }));
      void say(st.asks + 1 > PATIENCE ? [job.again, j.line] : [j.line], 'player', { slow });
    },
    [job.again, job.junctions, say, set],
  );

  // ── what happens where the player goes (polled): the pickup, the overheard two ──
  const busy = useRef(false);
  const tick = useCallback(() => {
    const snap = stage.current?.mapSnapshot();
    const st = ref.current;
    if (!snap || snap.away || busy.current) return;
    const pos = { x: snap.player.x, y: snap.player.y };
    if (st.phase === 'toPickup') {
      const real = doorOf(job.pickup.place);
      if (real && dist(pos, real) < AT_PLACE) {
        // the consequences of the time and the street noted are settled here (they play when he is met)
        const wrong = notesWrong(job.notebook, st.picks, st.minute);
        set((old) => ({ ...old, phase: 'find', late: wrong.includes('time') || arrivedLate(old.minute, Date.now()), spotted: wrong.includes('avoid') }));
        if (wrong.includes('avoid')) setNote('Một chiếc xe của Bayline vừa đỗ lại phía sau bạn.');
        stage.current?.gather(job.pickup.place as PlaceId, [job.pickup.host, job.pickup.passenger, ...job.pickup.crowd] as PlaceId[]);
        return;
      }
      // the place noted, when it is not the right one: nobody waiting there; Rico rings, annoyed, and says it again
      const noted = job.places[st.picks.pickup ?? ''];
      const there = noted && noted !== job.pickup.place ? doorOf(noted) : null;
      if (!st.wrongPlace && there && dist(pos, there) < AT_PLACE) {
        set((old) => ({ ...old, wrongPlace: true, heard: bump(old.heard, ['pickup']) }));
        busy.current = true;
        setPhone(true);
        void say(job.wrongPlace, 'player').finally(() => {
          busy.current = false;
          setPhone(false);
        });
      }
      return;
    }
    if (st.phase === 'overhear') {
      const [a, b] = job.overhear.who.map((id) => snap.residents.find((r) => r.id === id));
      if (!a || !b) return;
      const near = Math.min(dist(pos, a), dist(pos, b));
      setHeard(overhearClarity(near, skyNow().mix.rain));
      // too near while they are still at it: they see the learner listening and stop (once the word has been heard,
      // walking up to Gus is what the learner is meant to do)
      if (!st.noticed && !st.heardWord && near < NOTICED_WITHIN) {
        set((old) => ({ ...old, noticed: true }));
        void say([job.overhear.noticed]);
      }
    }
  }, [job, say, set, stage]);

  const polling = s.phase === 'toPickup' || s.phase === 'overhear';
  useEffect(() => {
    if (!polling) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [polling, tick]);

  // the overheard talk, round and round: each line heard by the distance when it starts (nothing once they noticed)
  useEffect(() => {
    if (s.phase !== 'overhear') return;
    let stop = false;
    void (async () => {
      for (let pass = 0; pass < job.overhear.passes && !stop; pass++) {
        if (ref.current.noticed) break;
        set((old) => ({ ...old, passes: old.passes + 1 }));
        const volume = (who: string, id: string) => {
          const snap = stage.current?.mapSnapshot();
          const p = snap?.residents.find((r) => r.id === who);
          const c = snap && p ? overhearClarity(dist(snap.player, p), skyNow().mix.rain) : 'none';
          if (id === job.password.line && c !== 'none') set((old) => ({ ...old, heardWord: true, heard: bump(old.heard, ['password']) }));
          return CLARITY_VOLUME[c];
        };
        const done = await say(job.overhear.lines, null, { volume });
        if (!done || stop || ref.current.noticed) break;
        await new Promise((r) => window.setTimeout(r, 2500));
      }
    })();
    return () => {
      stop = true;
    };
  }, [s.phase, job, say, set, stage]);

  // ── the crowd, the passenger, Gus: clicks on people ──
  const ask = useCallback(
    (id: string) => {
      const st = ref.current;
      if (id === job.pickup.passenger) {
        const greet = [...(st.late ? [job.greet.late] : []), job.greet.ontime, ...(st.spotted ? [job.greet.spotted] : [])];
        set((old) => ({ ...old, phase: 'drive', at: 0, choosing: false }));
        setNote(null);
        void (async () => {
          await say(greet);
          stage.current?.endListen();
          stage.current?.passenger(job.pickup.passenger as PlaceId, true);
          toJunction(0);
        })();
        return;
      }
      const line = job.notMe[id];
      if (!line) return;
      const first = !st.asked.includes(id);
      const wrongPeople = st.wrongPeople + (first ? 1 : 0);
      set((old) => ({ ...old, asked: first ? [...old.asked, id] : old.asked, wrongPeople }));
      void say(first && wrongPeople === 2 ? [line, job.callOut] : [line]);
    },
    [job, say, set, stage, toJunction],
  );
  const openPassword = useCallback(() => {
    hush();
    set((old) => ({ ...old, phase: 'password' }));
  }, [hush, set]);

  const talk = useCallback(
    (id: string): boolean => {
      const st = ref.current;
      if (st.phase === 'idle' || st.phase === 'ringing') return false;
      if (st.phase === 'find' && (id === job.pickup.passenger || Object.hasOwn(job.notMe, id))) ask(id);
      else if (st.phase === 'overhear' && id === job.password.who) openPassword();
      else setNote('Đang dở phi vụ: làm cho xong đã, hoặc bấm "Bỏ phi vụ".');
      return true;
    },
    [ask, job, openPassword],
  );

  // the junction's keys: the arrows pick the way; the shared practice keys (core/shortcuts.ts) ask again
  const choosing = s.phase === 'drive' && s.choosing;
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
  useShortcuts({ replay: () => askAgain(false), slow: () => askAgain(true) }, { enabled: s.phase === 'drive' });

  // ── the one button ──
  let prompt: CityJob['prompt'] = null;
  if (ringing || s.phase === 'ringing') prompt = { icon: PhoneIncoming, text: 'Nghe máy: Rico đang gọi', run: () => void accept() };
  else if (s.phase === 'find' && nearId && (nearId === job.pickup.passenger || Object.hasOwn(job.notMe, nearId))) prompt = { icon: Ear, text: tl`Hỏi ${nameOf(nearId)}`, run: () => ask(nearId) };
  else if (s.phase === 'overhear' && nearId === job.password.who) prompt = { icon: Ear, text: tl`Nói mật khẩu với ${nameOf(nearId)}`, run: openPassword };

  // ── the quest card ──
  const pickLabel = (key: NoteKey): string => {
    const e = job.notebook.find((x) => x.key === key);
    const v = s.picks[key];
    if (!e || v === undefined) return '';
    return key === 'time' ? clockOf(Number(v)) : (e.options.find((o) => o.value === v)?.label ?? '');
  };
  const quest = useMemo<Quest | null>(() => {
    const base = { id: `job:${job.id}`, tag: tr('Phi vụ') };
    switch (s.phase) {
      case 'idle':
        return available ? { ...base, title: job.title, step: tr('Rico muốn gọi cho bạn'), target: null } : null;
      case 'ringing':
      case 'call':
      case 'notes':
        return { ...base, title: job.title, step: s.phase === 'notes' ? tr('Ghi vào sổ tay') : tr('Rico đang gọi'), target: null };
      case 'toPickup': {
        const to = s.wrongPlace ? job.pickup.place : notedPlace;
        return { ...base, title: tr('Đón khách cho Rico'), step: s.wrongPlace ? tr('Rico vừa chỉ lại chỗ đón') : tl`Bạn ghi: ${pickLabel('pickup')} · ${pickLabel('time')}`, target: to ? { kind: 'place', id: to as PlaceId } : null };
      }
      case 'find':
        return { ...base, title: tr('Tìm ông khách'), step: tl`Bạn ghi: ${pickLabel('look')}`, target: null };
      case 'drive':
        return { ...base, title: tr('Chở khách ra bến phà'), step: tr('Tới ngã rẽ thì chọn đường theo lời ông ấy'), target: null };
      case 'brief':
        return { ...base, title: tr('Rico gọi lại'), step: tr('Nghe Rico dặn'), target: null };
      case 'overhear':
      case 'password':
        return { ...base, title: tr('Lấy cuộn băng của Gus'), step: tr('Tới chỗ Rico nói. Đừng để họ thấy bạn'), target: null };
      default:
        return { ...base, title: job.title, step: tr('Xong rồi'), target: null };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.wrongPlace, s.picks, notedPlace, available, job]);
  // the card's clock: to the time the learner NOTED (the job leads by what they wrote); fixed once the phase starts
  const deadline = useMemo(() => (s.phase === 'toPickup' && notedMinute !== null ? realTimeOf(notedMinute, Date.now()) : null), [s.phase, notedMinute]);

  // ── what is drawn over the stage ──
  const junction = s.phase === 'drive' ? job.junctions[s.at] : undefined;
  const strip = (() => {
    if (ringing || s.phase === 'ringing')
      return (
        <div className="town-welcome job-strip is-ringing" role="status">
          <span className="job-strip-icon" aria-hidden="true">
            <Icon icon={Phone} size={20} />
          </span>
          <p className="town-welcome-text">
            <span className="town-welcome-name">{tl`Rico đang gọi · Phi vụ: ${job.title}`}</span>
            {job.blurb}
          </p>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => (s.phase === 'ringing' ? quit() : setDeclined(true))} aria-label="Để sau" title="Để sau">
            <Icon icon={X} size={16} />
          </button>
        </div>
      );
    if (s.phase === 'call' || s.phase === 'brief' || s.phase === 'closing' || phone)
      return (
        <div className="town-welcome job-strip" role="status">
          <span className="job-strip-icon" aria-hidden="true">
            <Icon icon={Phone} size={20} />
          </span>
          <p className="town-welcome-text">
            <span className="town-welcome-name">Rico · điện thoại</span>
            <span className="job-strip-hear">
              <SoundBars on={speaking !== null} />
              {speaking !== null ? 'Đang nói… chỉ nghe thôi, không có chữ.' : 'Đã dập máy.'}
            </span>
          </p>
        </div>
      );
    if (s.phase === 'drive')
      return (
        <div className="town-welcome job-strip job-junction" role="group" aria-label="Ông khách chỉ đường">
          <p className="town-welcome-text">
            <span className="town-welcome-name">{junction && s.choosing ? 'Tới ngã rẽ. Đi đường nào?' : 'Ông khách đang ngồi sau xe'}</span>
            <span className="job-strip-hear">
              <SoundBars on={speaking !== null} />
              {speaking !== null ? 'Ông ấy đang nói…' : junction && s.choosing ? 'Chọn theo lời ông ấy vừa chỉ.' : 'Xe đang chạy.'}
            </span>
          </p>
          {junction && s.choosing && (
            <div className="job-turns">
              {waysOf(junction).map((t) => (
                <button key={t} type="button" className="town-reply job-turn" onClick={() => choose(t)} aria-keyshortcuts={t === 'left' ? 'ArrowLeft' : t === 'right' ? 'ArrowRight' : 'ArrowUp'}>
                  <Icon icon={TURN_ICON[t]} size={18} />
                  <span className="town-reply-text">{TURN_NAME[t]}</span>
                </button>
              ))}
            </div>
          )}
          {junction && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => askAgain(true)}>
              <Icon icon={MessageCircleQuestion} size={16} />
              Xin nhắc lại
            </button>
          )}
        </div>
      );
    if (s.phase === 'overhear')
      return (
        <div className="town-welcome job-strip" role="status">
          <span className="job-strip-icon" aria-hidden="true">
            <Icon icon={Ear} size={20} />
          </span>
          <p className="town-welcome-text">
            <span className="town-welcome-name">{s.noticed ? 'Họ thấy bạn rồi' : CLARITY_NAME[heard]}</span>
            {s.noticed || s.passes >= 2 ? 'Nghe đủ rồi thì tới nói mật khẩu với Gus.' : skyNow().mix.rain >= 0.5 ? 'Mưa át bớt tiếng. Lại gần hơn, nhưng đừng sát quá.' : 'Lại gần thì nghe rõ hơn, nhưng đừng sát quá.'}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={quit}>
            Bỏ phi vụ
          </button>
        </div>
      );
    if (s.phase === 'toPickup' || s.phase === 'find')
      return (
        <div className="town-welcome job-strip" role="status">
          <span className="job-strip-icon" aria-hidden="true">
            <Icon icon={Phone} size={20} />
          </span>
          <p className="town-welcome-text">
            <span className="town-welcome-name">{s.phase === 'find' ? 'Ông khách là ai trong đám này?' : 'Đi đón khách'}</span>
            {note ?? (s.phase === 'find' ? 'Tới gần một người rồi bấm Hỏi.' : 'Lái xe hay đi bộ đều được. Thẻ nhiệm vụ dẫn bạn theo đúng điều bạn đã ghi.')}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={quit}>
            Bỏ phi vụ
          </button>
        </div>
      );
    return null;
  })();

  const node = (
    <>
      {free && strip}
      {s.phase === 'notes' && (
        <Suspense fallback={null}>
          <JobNotebook
            job={job}
            options={(key) => noteOptions(job.notebook.find((e) => e.key === key)!, s.minute, s.seed + key.length)}
            picks={s.picks}
            onPick={setPick}
            heard={s.heard}
            playing={speaking !== null}
            onReplay={replayCall}
            onFact={replayFact}
            onGo={go}
            onClose={quit}
          />
        </Suspense>
      )}
      {s.phase === 'password' && (
        <Suspense fallback={null}>
          <JobPassword
            job={job}
            say={(ids) => say(ids)}
            onDone={(p) => void finish(p)}
            onClose={() => set((old) => ({ ...old, phase: 'overhear' }))}
            judge={(answer) => judgeTyped(job.password.chunk, answer)}
          />
        </Suspense>
      )}
      {s.phase === 'debrief' && (
        <Suspense fallback={null}>
          <JobDebrief
            job={job}
            state={s}
            wrongNotes={notesWrong(job.notebook, s.picks, s.minute)}
            answerOf={(key) => {
              const e = job.notebook.find((x) => x.key === key)!;
              const a = noteAnswer(e, s.minute);
              return key === 'time' ? clockOf(Number(a)) : (e.options.find((o) => o.value === a)?.label ?? '');
            }}
            pickOf={pickLabel}
            sound={sound}
            say={(l, careful) => sayJobLine(l, job.level, { careful })}
            news={(ids) => say(ids, null)}
            lineOf={lineOf}
            onAgain={() => {
              hush();
              set(() => fresh(job, Date.now(), 'ringing'));
              stage.current?.focus();
            }}
            onClose={() => {
              hush();
              setDeclined(true);
              set(() => fresh(job, Date.now(), 'idle'));
              stage.current?.focus();
            }}
          />
        </Suspense>
      )}
    </>
  );

  return {
    active: s.phase !== 'idle' && s.phase !== 'ringing',
    quest,
    deadline,
    prompt,
    talk,
    start,
    speaking,
    sheet: s.phase === 'notes' || s.phase === 'password' || s.phase === 'debrief' || s.phase === 'drive',
    node,
  };
}

const CLARITY_NAME: Readonly<Record<Clarity, string>> = {
  clear: 'Nghe rõ',
  faint: 'Nghe loáng thoáng',
  none: 'Chưa nghe thấy gì',
};
