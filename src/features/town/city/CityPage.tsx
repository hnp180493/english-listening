// Westbay, the city (docs/town.md §20, docs/city.md): the second map of the town's 3D stage, reached by bus no. 9.
// One job, as in the town: walk up to somebody, listen, understand. The city's people have STORIES in episodes
// (a scene of 12–18 lines between two or three people, three questions, then the words), each tied to somebody the
// learner already knows from the town; the people known have short talks; a town resident may be up here for the
// day; the benches, Gianna's radio and the bus are things to use, as in the town.
//
// The page is small on purpose: the stage, one button for what is beside the player, a sheet for what is heard, and
// "Người quen" (who has been met, who waits). No build panel, no shop, no map: the city adds no menu.

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Briefcase, BusFront, CalendarDays, CircleHelp, Ear, Footprints, Heart, Maximize2, MessageCircle, Minimize2, Users, Volume2, VolumeX, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import PageHeader from '../../../components/PageHeader';
import ShortcutsHelp from '../../../components/ShortcutsHelp';
import { ADMIN } from '../../../core/admin';
import { navigate, parseHash } from '../../../core/nav';
import { chaptersToday, CITY_INVITE_HEARTS, cityEventsOn, nextToMeet, outingToday, sceneNow, sceneOwner, scenesWith, visitorsNow, type SceneNow } from '../../../core/town/city';
import { CITY_PEOPLE, cityPerson } from '../../../core/town/cityPeople';
import { arriveInCity, loadTownCity, useTownCity } from '../../../core/town/cityStore';
import type { CityEvent, CityScene } from '../../../core/town/cityTypes';
import { balance } from '../../../core/town/economy';
import { friendHearts } from '../../../core/town/friendship';
import { kidsOf, partnerOf } from '../../../core/town/life';
import { useTownLife } from '../../../core/town/lifeStore';
import { useTownProgress } from '../../../core/town/store';
import { CAST_VOICES } from '../../../core/town/voices';
import { scenesHeard, townToday } from '../../../core/town/worldStore';
import { CITY_EVENTS, CITY_OUTINGS, CITY_OVERHEARD, CITY_SCENES, CITY_SEASONS } from '../../../data/city';
import { CITY_SHIFTS } from '../../../data/city/shifts';
import { CITY_DECOR_ON, CITY_PLACE_IDS, cityWorldWith } from '../../../data/cityWorld';
import type { PlaceView } from '../../../core/town/overview';
import type { MapSnapshot, TravelMode, TravelTarget } from '../engine/stage';
import { prefersReducedMotion } from '../../../core/motion';
import { TOWN_PLACES, townPlace } from '../../../data/town';
import { thingKind, type ActivitySpotId, type PlaceId } from '../../../data/townWorld';
import { getLang, tl } from '../../../i18n';
import { Coin } from '../art';
import type { Marker, Near, StageState, TownStageHandle } from '../engine/stage';
import { usePanelKeys } from '../panelKeys';
import { usePlayerOnStage } from '../playerStage';
import MiniMap from '../map/MiniMap';
import ListenPanel from '../scenes/ListenPanel';
import { listenTitle, thingPrompt } from '../scenes/things';
import { playSfx } from '../sfx';
import { narrowStage, useFullStage, useStageInsets, useTownTheme } from '../stageShell';
import TownStage3D from '../three/TownStage3D';
import { wantsFlat, webglAvailable } from '../three/webgl';
import { setTownUi, useTownUi } from '../townUi';
import { eventToday } from './cityEvents';
import QuestTracker from '../QuestTracker';
import { cityQuests, followed, type Quest } from '../quests';
import './cityLooks';
import './cityPlaces3d';
import '../town.css';
import './city.css';

const CityScenePanel = lazy(() => import('./CityScenePanel'));
const CityPeople = lazy(() => import('./CityPeople'));
const CityToday = lazy(() => import('./CityToday'));
const CityEventPanel = lazy(() => import('./CityEventPanel'));
const ShiftPanel = lazy(() => import('./ShiftPanel'));
/** The full map (M, or the minimap): the town's, on Westbay's world. */
const TownMap = lazy(() => import('../map/TownMap'));

const TOWN_IDS: ReadonlySet<string> = new Set(TOWN_PLACES.map((p) => p.id));
const TOAST_MS = 4200;

/** Somebody's name: of the city, or a town resident up here. */
const nameOf = (id: string): string => cityPerson(id)?.name ?? townPlace(id)?.resident ?? '';

type Sheet =
  | { kind: 'scene'; key: number; at: string; scene: CityScene; again: boolean; outing?: boolean; kicker?: string }
  | { kind: 'thing'; key: number; id: ActivitySpotId }
  | { kind: 'people'; key: number }
  | { kind: 'today'; key: number }
  | { kind: 'shift'; key: number; id: string }
  | { kind: 'event'; key: number; event: CityEvent };

/** What the one button offers beside somebody. */
function talkPrompt(id: string, now: SceneNow): string {
  const name = nameOf(id);
  if (now.kind === 'new') return now.scene.kind === 'episode' ? tl`Nghe chuyện của ${name}` : tl`Nói chuyện với ${name}`;
  if (now.kind === 'again') return tl`Nghe lại với ${name}`;
  if (now.kind === 'locked') return tl`Gặp ${nameOf(sceneOwner(now.needs))} trước đã`;
  return tl`Nghe lại chuyện của ${name}`;
}

export default function CityPage() {
  const theme = useTownTheme();
  const ui = useTownUi();
  const city = useTownCity();
  const progress = useTownProgress();
  const life = useTownLife();
  const player = usePlayerOnStage();
  const stage = useRef<TownStageHandle>(null);
  const [flat, setFlat] = useState(() => wantsFlat() || !webglAvailable());
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState<Near>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  /** The scene whose people are in place (its key): the panel opens then. */
  const [arrived, setArrived] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const keys = useRef(0);
  const [now] = useState(() => Date.now());
  const today = useMemo(() => townToday(now), [now]);
  const [first] = useState(() => !loadTownCity().first);
  const [welcome, setWelcome] = useState(first);
  useEffect(() => arriveInCity(), []);

  // who of the town is up here: today's visitors, whoever a story needs, and the one the learner is with (they come
  // along). Worked out when the page opens and again when a scene heard opens a story that needs somebody new.
  const partner = partnerOf(life);
  // a friend asked along on the bus (?with=<place id>, the town's bus panel): from CITY_INVITE_HEARTS hearts
  const [params] = useState(() => parseHash(window.location.hash).params);
  const asked = params.with && TOWN_IDS.has(params.with) && friendHearts(progress, params.with) >= CITY_INVITE_HEARTS ? params.with : null;
  // who came up WITH the learner: their second scene up here is theirs only then (city.ts scenesWith)
  const cameKey = [partner, asked].filter((x): x is string => !!x && TOWN_IDS.has(x)).sort().join(',');
  const came = useMemo(() => new Set(cameKey ? cameKey.split(',') : []), [cameKey]);
  const scenes = useMemo(() => scenesWith(CITY_SCENES, came), [came]);
  // today's chapters of the long stories (docs/town.md §21): those played in the city, by whose place they are at
  const chapters = useMemo(() => chaptersToday(CITY_SEASONS, city, now), [city, now]);
  const chapterAt = useCallback((id: string) => chapters.find((c) => c.chapter.where !== 'town' && c.chapter.at === id) ?? null, [chapters]);
  const [visitors, setVisitors] = useState<string[]>(() => visitorsNow([...scenes, ...chaptersToday(CITY_SEASONS, loadTownCity(), now).map((c) => c.chapter).filter((c) => c.where !== 'town')], loadTownCity(), today.weekday, TOWN_IDS));
  const guests = useMemo(() => [...new Set([...visitors, ...came])].sort(), [visitors, came]);
  const guestKey = guests.join(',');
  // (the same object for the same guests: the stage is made again only when somebody new has come)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo(() => cityWorldWith(guests.map((id) => ({ id, name: townPlace(id)?.resident ?? '' }))), [guestKey]);
  useEffect(() => {
    setReady(false);
  }, [world]);

  const here = useCallback((at: string) => !!cityPerson(at) || guests.includes(at), [guests]);
  const suggested = useMemo(() => nextToMeet(scenes, city, here), [scenes, city, here]);

  const state = useMemo<StageState>(() => {
    const marker: Record<string, Marker> = {};
    const lit: Record<string, number> = {};
    for (const id of [...CITY_PLACE_IDS, ...guests]) {
      const s = sceneNow(scenes, id, city, now);
      if (chapterAt(id)) marker[id] = 'story';
      else if (s?.kind === 'new') marker[id] = s.scene.kind === 'episode' ? 'story' : 'new';
      else if (s?.kind === 'again') marker[id] = 'relisten';
      const own = scenes.filter((x) => x.at === id);
      lit[id] = own.length ? own.filter((x) => Object.hasOwn(city.heard, x.id)).length / own.length : 0;
    }
    return { built: [...CITY_PLACE_IDS, ...guests, 'station'], decorations: CITY_DECOR_ON, lit, marker, theme, ...player };
  }, [scenes, city, guests, now, theme, player, chapterAt]);

  // ── sound, toast ──
  const sfx = useCallback((name: Parameters<typeof playSfx>[0]) => playSfx(name, ui.sound), [ui.sound]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);
  const xuRef = useRef<HTMLSpanElement>(null);
  const onReward = useCallback(
    (r: { label: string; xu?: number }) => {
      setToast(r.label);
      if (r.xu && r.xu > 0) {
        const box = stage.current?.rect();
        const pill = xuRef.current?.getBoundingClientRect();
        stage.current?.float('player', `+${r.xu}`);
        stage.current?.burst('coins', 'player', box && pill ? { x: pill.left - box.left + 18, y: pill.top - box.top + pill.height / 2 } : undefined);
        window.setTimeout(() => sfx('coin'), 520);
      } else sfx('right');
    },
    [sfx],
  );

  // ── a scene with somebody ──
  const closeSheet = useCallback(() => {
    setSheet((s) => {
      if (s?.kind === 'scene' || s?.kind === 'event') {
        stage.current?.endListen();
        stage.current?.endTalk();
      }
      return null;
    });
    setArrived(null);
    setSpeaking(null);
    // a scene heard may have opened a story that needs somebody of the town up here
    setVisitors((old) => {
      const next = visitorsNow([...scenes, ...chaptersToday(CITY_SEASONS, loadTownCity(), Date.now()).map((c) => c.chapter).filter((c) => c.where !== 'town')], loadTownCity(), today.weekday, TOWN_IDS);
      return next.join(',') === old.join(',') ? old : next;
    });
    stage.current?.focus();
  }, [today.weekday, scenes]);

  const startScene = useCallback(
    (id: string) => {
      if (sheet) return;
      // today's chapter of a long story at this person's place comes before anything else they have
      const ch = chaptersToday(CITY_SEASONS, loadTownCity(), Date.now()).find((c) => c.chapter.where !== 'town' && c.chapter.at === id);
      const s: SceneNow | null = ch ? { kind: 'new', scene: ch.chapter } : sceneNow(scenes, id, loadTownCity(), Date.now());
      if (!s) return;
      if (s.kind === 'locked') {
        const owner = sceneOwner(s.needs);
        setToast(tl`${nameOf(id)} chưa biết bạn là ai. Gặp ${nameOf(owner)} trước đã.`);
        if (here(owner)) stage.current?.walkTo(owner as PlaceId);
        return;
      }
      const key = ++keys.current;
      setWelcome(false);
      setSheet({ kind: 'scene', key, at: id, scene: s.scene, again: s.kind !== 'new', ...(ch ? { kicker: tl`${ch.season.title} · chương ${ch.chapter.n}/${ch.season.chapters.length}` } : {}) });
      const others = [...new Set(s.scene.lines.map((l) => l.who))].filter((w) => w !== id && here(w)) as PlaceId[];
      const inPlace = () => {
        stage.current?.joinTalk(id as PlaceId, others);
        setArrived(key);
      };
      // somebody of the city is talked to in front of their own place; a town resident up here, where they stand
      const staged = stage.current?.talkAt(id as PlaceId, cityPerson(id) ? { kind: 'outside', at: id as PlaceId } : { kind: 'here' }, {}, inPlace);
      if (!staged) setArrived(key);
    },
    [sheet, here, scenes],
  );

  // an outing with the one the learner is with (docs/town.md §20): at the host's place, the partner beside them
  const kid = kidsOf(life)[0]?.kid ?? null;
  const outingsDone = useMemo(() => {
    const out = new Set<string>();
    for (const c of Object.values(progress.daily[today.day] ?? {})) for (const id of c.heard ?? []) if (id.startsWith('cx-')) out.add(id);
    return out;
  }, [progress, today.day]);
  const startOuting = useCallback(
    (host: string, scene: CityScene) => {
      if (sheet || !partner) return;
      const key = ++keys.current;
      setWelcome(false);
      setSheet({ kind: 'scene', key, at: host, scene, again: false, outing: true });
      const inPlace = () => {
        stage.current?.joinTalk(host as PlaceId, [partner as PlaceId]);
        setArrived(key);
      };
      const staged = stage.current?.talkAt(host as PlaceId, { kind: 'outside', at: host as PlaceId }, {}, inPlace);
      if (!staged) setArrived(key);
    },
    [sheet, partner],
  );

  const openThing = useCallback(
    (id: ActivitySpotId) => {
      if (sheet || !thingKind(id)) return;
      setWelcome(false);
      setSheet({ kind: 'thing', key: ++keys.current, id });
    },
    [sheet],
  );
  const toTown = useCallback(() => navigate('town', { from: 'city' }), []);

  // what is on today (docs/town.md §21): the weekday's get-together, a festival of the month
  const heardToday = useMemo(() => scenesHeard(progress, today.day), [progress, today.day]);
  const eventsToday = useMemo(() => cityEventsOn(CITY_EVENTS, today.weekday, new Date(now).getMonth() + 1).map((event) => ({ event, done: eventToday(event, today.day, heardToday).done })), [today.weekday, today.day, now, heardToday]);
  const openEvent = useCallback(
    (event: CityEvent) => {
      const key = ++keys.current;
      setWelcome(false);
      setSheet({ kind: 'event', key, event });
      const host = event.host as PlaceId;
      const who = eventToday(event, today.day, []).who.filter((w) => w !== event.host) as PlaceId[];
      const inPlace = () => {
        stage.current?.joinTalk(host, who);
        setArrived(key);
      };
      if (!stage.current?.talkAt(host, { kind: 'outside', at: host }, {}, inPlace)) setArrived(key);
    },
    [today.day],
  );
  // a shift at somebody's place, once they have been met
  const shiftAt = useCallback((id: string) => (ADMIN || Object.hasOwn(city.heard, `ct-${id}-1`) ? (CITY_SHIFTS.find((s) => s.at === id) ?? null) : null), [city]);

  // ── the full map (owner, 2026-11-26: "sao đéo click minimap được?") ──
  const [map, setMap] = useState<'open' | 'leaving' | null>(null);
  const [mapStart, setMapStart] = useState<MapSnapshot | null>(null);
  const mapTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(mapTimer.current), []);
  /** The people of the map: everybody of the city at their place, and the town's residents who are up. */
  const mapPlaces = useMemo<PlaceView[]>(
    () =>
      [...world.places, ...(world.guests ?? [])].map((wp) => ({
        place: { id: wp.id, topic: '', name: wp.name, resident: wp.resident, cost: 0 },
        built: true,
        cost: 0,
        affordable: false,
        missing: 0,
        stats: { total: 0, understood: 0, first: 0 },
        hearts: 0,
        friend: { placeId: wp.id, points: 0, hearts: 0, toNext: null, part: 0, title: '' },
        lit: 0,
        marker: 'heart' as const,
        episode: null,
        homeEpisode: null,
        friendEpisode: null,
      })),
    [world],
  );
  const openMap = useCallback(() => {
    if (flat || !ready || sheet) return;
    setWelcome(false);
    setMapStart(stage.current?.mapSnapshot() ?? null);
    setMap('open');
  }, [flat, ready, sheet]);
  const closeMap = useCallback(() => {
    window.clearTimeout(mapTimer.current);
    setMap(null);
    stage.current?.focus();
  }, []);
  /** "Đi tới": the map closes and the player walks there; "Đến ngay": a dip to dark and they are there. */
  const travel = useCallback(
    (target: TravelTarget, mode: TravelMode) => {
      const s = stage.current;
      if (!s) return;
      window.clearTimeout(mapTimer.current);
      const then = target.kind === 'activity' ? () => openThing(target.id) : target.kind === 'resident' ? () => startScene(target.id) : undefined;
      const warped = mode === 'warp' && s.travelTo(target, 'warp', then);
      if (!warped) s.travelTo(target, 'walk', then);
      if (warped && !prefersReducedMotion()) {
        setMap('leaving');
        mapTimer.current = window.setTimeout(() => setMap(null), 320);
      } else setMap(null);
      s.focus();
    },
    [openThing, startScene],
  );
  // M opens the map (the map's own keys close it)
  const mapKey = useRef(openMap);
  useEffect(() => {
    mapKey.current = openMap;
  }, [openMap]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.isContentEditable || el.closest('input, textarea, select, [data-popover], [role="dialog"], dialog'))) return;
      if (document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]')) return;
      e.preventDefault();
      mapKey.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── the quests (../quests.ts): the one followed at the top, its way on the ground, the one button goes there ──
  const [questPick, setQuestPick] = useState<string | null>(null);
  const quests = useMemo(
    () =>
      cityQuests({
        suggested,
        chapters,
        open: [...CITY_PLACE_IDS, ...guests].flatMap((id) => {
          const s = sceneNow(scenes, id, city, now);
          return s && (s.kind === 'new' || s.kind === 'again') ? [{ at: id, scene: s.scene, again: s.kind === 'again' }] : [];
        }),
        events: eventsToday,
        shifts: CITY_SHIFTS.filter((s) => shiftAt(s.at)),
        nameOf,
      }),
    [suggested, chapters, guests, scenes, city, now, eventsToday, shiftAt],
  );
  const quest = followed(quests, questPick);
  const goQuest = (q: Quest) => {
    setQuestPick(q.id);
    const [kind, key] = [q.id.slice(0, q.id.indexOf(':')), q.id.slice(q.id.indexOf(':') + 1)];
    if (kind === 'season') {
      const c = chapters.find((x) => `${x.season.id}:${x.chapter.n}` === key);
      if (!c) return;
      if (c.chapter.where === 'town') navigate('town', { from: 'city', listen: `season:${c.chapter.id}` });
      else void stage.current?.walkTo(c.chapter.at as PlaceId, () => startScene(c.chapter.at));
      return;
    }
    if (kind === 'event') {
      const ev = eventsToday.find((x) => x.event.id === key);
      if (ev) openEvent(ev.event);
      return;
    }
    if (kind === 'shift') {
      const sh = CITY_SHIFTS.find((x) => x.id === key);
      if (sh) void stage.current?.walkTo(sh.at as PlaceId, () => setSheet({ kind: 'shift', key: ++keys.current, id: sh.id }));
      return;
    }
    if (q.target?.kind === 'resident') {
      const at = q.target.id;
      void stage.current?.walkTo(at, () => startScene(at));
    }
  };

  // ── the one button ──
  const nearId = near?.kind === 'resident' ? near.placeId : null;
  const nearNow = nearId ? sceneNow(scenes, nearId, city, now) : null;
  const nearThing = near?.kind === 'activity' ? near.id : null;
  const prompt = nearThing
    ? { icon: thingKind(nearThing) === 'bus' ? BusFront : Ear, text: thingKind(nearThing) === 'bus' ? 'Lên xe số 9 về thị trấn' : (thingPrompt(nearThing) ?? ''), run: () => openThing(nearThing) }
    : nearId && nearNow
      ? chapterAt(nearId)
        ? { icon: BookOpen, text: tl`Chương hôm nay: ${chapterAt(nearId)!.season.title}`, run: () => startScene(nearId) }
        : { icon: MessageCircle, text: talkPrompt(nearId, nearNow), run: () => startScene(nearId) }
      : quest?.target?.kind === 'resident'
        ? { icon: Footprints, text: tl`Tới gặp ${nameOf(quest.target.id)}`, run: () => goQuest(quest) }
        : suggested
          ? { icon: Footprints, text: tl`Tới gặp ${nameOf(suggested.at)}`, run: () => void stage.current?.walkTo(suggested.at as PlaceId, () => startScene(suggested.at)) }
          : null;
  // beside a host with the partner along: today's outing there, once a day
  const dayNumber = Number(today.day.replaceAll('-', ''));
  const outingHere = nearId && partner && came.has(partner) && cityPerson(nearId) ? outingToday(CITY_OUTINGS, nearId, !!kid, dayNumber) : null;
  const nearOuting = outingHere && !outingsDone.has(outingHere.id) ? outingHere : null;
  const nearShift = nearId ? shiftAt(nearId) : null;
  const promptRun = prompt?.run;
  const onIdleAct = useCallback(() => promptRun?.(), [promptRun]);

  const shownSheet = ready || flat ? sheet : null;
  const sceneUp = shownSheet?.kind === 'scene' && (arrived === shownSheet.key || flat) ? shownSheet : null;
  const eventUp = shownSheet?.kind === 'event' && (arrived === shownSheet.key || flat) ? shownSheet : null;
  const stageBox = useCallback(() => stage.current?.box() ?? null, []);
  const full = useFullStage(stageBox, !!shownSheet);
  const insets = useStageInsets(stageBox, `${shownSheet?.key ?? '-'}|${sceneUp ? 's' : '-'}|${full.full ? 'f' : '-'}|${prompt ? 'p' : '-'}|${welcome ? 'w' : '-'}`);
  const [narrow] = useState(narrowStage);
  const showPrompt = (ready || flat) && !sheet && !map && !!prompt;

  const onListen = useCallback((who: readonly string[] | null) => {
    const s = stage.current;
    if (!s) return;
    if (who) s.listenFrom(sheetThing.current ?? ('thing:bench-0' as ActivitySpotId), who as readonly PlaceId[]);
    else s.endListen();
  }, []);
  const sheetThing = useRef<ActivitySpotId | null>(null);
  sheetThing.current = sheet?.kind === 'thing' ? sheet.id : null;

  const weekday = new Intl.DateTimeFormat(getLang() === 'en' ? 'en-US' : 'vi-VN', { weekday: 'long' }).format(now);

  return (
    <div className="stack-lg page-browse town-page">
      <PageHeader
        title="Westbay"
        subtitle={narrow ? undefined : 'Thành phố cạnh thị trấn. Mỗi người ở đây có một chuyện, và chuyện nào cũng dính tới người bạn đã quen.'}
        help={
          <ShortcutsHelp
            items={[
              { keys: ['← ↑ ↓ →'], text: 'Đi quanh thành phố (W A S D cũng được)' },
              { keys: ['Shift'], text: 'Giữ khi đi để chạy' },
              { keys: ['E'], text: 'Bắt chuyện, hoặc dùng thứ ở chỗ đang đứng (Enter cũng được)' },
              { keys: ['1–3'], text: 'Chọn câu trả lời' },
              { keys: ['R'], text: 'Nghe lại cả đoạn' },
              { keys: ['Enter'], text: 'Câu tiếp' },
              { keys: ['Esc'], text: 'Đóng bảng đang mở' },
            ]}
          />
        }
      />

      <TownStage3D
        // (made anew when somebody of the town comes up: a fresh canvas for a fresh world; the player stays where they were)
        key={guestKey}
        flat={flat}
        world={world}
        ref={stage}
        state={state}
        onTalk={(id) => startScene(id)}
        onTalkCancel={closeSheet}
        onNear={setNear}
        onIdleAct={onIdleAct}
        onActivity={openThing}
        onReady={() => setReady(true)}
        onFail={() => setFlat(true)}
        speaking={speaking}
        inset={insets.panel}
        safe={insets.safe}
        hint={!sheet && suggested ? (suggested.at as PlaceId) : null}
        guide={!sheet ? (quest?.target ?? null) : null}
        full={full.full}
        paused={!ready || !!sheet || !!map}
        className={[sceneUp ? 'is-talking' : shownSheet ? 'is-building' : '', full.full ? 'is-full' : ''].filter(Boolean).join(' ') || undefined}
        label={flat ? 'Westbay' : 'Thành phố Westbay nhìn từ trên cao. Dùng danh sách nút ngay sau đây để tới gặp từng người.'}
        loading="Đang dựng thành phố…"
      >
        {flat ? (
          !sheet && (
            <div className="town-flat city-flat">
              <p className="town-flat-note">Trình duyệt này không vẽ được thành phố 3D. Bạn vẫn nghe được chuyện của từng người:</p>
              <ul className="city-flat-list">
                {[...CITY_PEOPLE.map((p) => p.id), ...guests].map((id) => {
                  const s = sceneNow(scenes, id, city, now);
                  // (somebody whose talk still waits for another is not offered: the list would be a wall of "meet … first")
                  return s && s.kind !== 'locked' ? (
                    <li key={id}>
                      <button type="button" className="btn btn-ghost" onClick={() => startScene(id)}>
                        {talkPrompt(id, s)}
                      </button>
                    </li>
                  ) : null;
                })}
                {CITY_SHIFTS.filter((s) => shiftAt(s.at)).map((s) => (
                  <li key={s.id}>
                    <button type="button" className="btn btn-ghost" onClick={() => setSheet({ kind: 'shift', key: ++keys.current, id: s.id })}>
                      {tl`Vào ca: ${s.name}`}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-ghost" onClick={toTown}>
                Về thị trấn
              </button>
            </div>
          )
        ) : (
          <ul className="town-actions" aria-label="Việc làm được ở Westbay">
            {[...CITY_PEOPLE.map((p) => p.id), ...guests].map((id) => (
              <li key={id}>
                <button type="button" className="town-action" onClick={() => void stage.current?.walkTo(id as PlaceId, () => startScene(id))} disabled={!!sheet || !ready}>
                  {tl`Tới gặp ${nameOf(id)}`}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="town-action" onClick={toTown} disabled={!!sheet}>
                Về thị trấn
              </button>
            </li>
          </ul>
        )}

        {!flat && ready && !sheet && !welcome && !map && <QuestTracker quests={quests} current={quest} stage={stage} onPick={goQuest} />}
        <div className="town-hud">
          <div className="town-level is-new" role="img" aria-label={tl`Westbay, ${weekday}`}>
            <span className="town-level-title">
              Westbay · <span className="city-day">{weekday}</span>
            </span>
          </div>
          <div className="town-hud-end">
            <div className="town-hud-counts">
              <span ref={xuRef} className="town-pill town-xu" role="img" aria-label={tl`Bạn có ${balance(progress)} xu`}>
                <Coin size={18} />
                <span className="tabular" aria-hidden="true">
                  {balance(progress)}
                </span>
              </span>
            </div>
            <div className="town-hud-btns">
              <button
                type="button"
                className={'town-pill town-hud-btn' + (shownSheet?.kind === 'today' ? ' is-on' : '')}
                onClick={() => (sheet?.kind === 'today' ? closeSheet() : !sheet && setSheet({ kind: 'today', key: ++keys.current }))}
                aria-expanded={shownSheet?.kind === 'today'}
              >
                <Icon icon={CalendarDays} size={17} />
                <span className="town-hud-label">Hôm nay</span>
                {(eventsToday.some((e) => !e.done) || chapters.length > 0) && <span className="town-hud-dot" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className={'town-pill town-hud-btn' + (shownSheet?.kind === 'people' ? ' is-on' : '')}
                onClick={() => (sheet?.kind === 'people' ? closeSheet() : !sheet && setSheet({ kind: 'people', key: ++keys.current }))}
                aria-expanded={shownSheet?.kind === 'people'}
              >
                <Icon icon={Users} size={17} />
                <span className="town-hud-label">Người quen</span>
              </button>
              <button type="button" className="town-pill town-hud-btn town-hud-icon" onClick={() => setTownUi({ sound: !ui.sound })} aria-pressed={ui.sound} aria-label="Âm thanh trò chơi" title={ui.sound ? 'Âm thanh trò chơi: đang bật' : 'Âm thanh trò chơi: đang tắt'}>
                <Icon icon={ui.sound ? Volume2 : VolumeX} size={17} />
              </button>
              <button
                type="button"
                className="town-pill town-hud-btn town-hud-icon"
                onClick={full.toggle}
                aria-label={full.full ? (getLang() === 'en' ? 'Exit full screen' : 'Thu nhỏ') : 'Toàn màn hình'}
                title={full.full ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}
              >
                <Icon icon={full.full ? Minimize2 : Maximize2} size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* the minimap, as in the town (a picture only: the city has no full map) */}
        {!flat && ready && !sheet && !welcome && !map && <MiniMap stage={stage} state={state} hint={suggested ? suggested.at : null} theme={theme} world={world} onOpen={openMap} />}
        {map && (
          <Suspense fallback={null}>
            <TownMap stage={stage} start={mapStart} places={mapPlaces} world={world} friends={false} state={state} hint={suggested ? (suggested.at as PlaceId) : null} theme={theme} leaving={map === 'leaving'} onClose={closeMap} onTravel={travel} />
          </Suspense>
        )}
        {welcome && ready && !sheet && (
          <div className="town-welcome" role="note">
            <span className="city-welcome-icon" aria-hidden="true">
              <Icon icon={BusFront} size={22} />
            </span>
            <p className="town-welcome-text">
              <span className="town-welcome-name">Westbay</span>
              Xe số 9 vừa thả bạn ở bến. Chuyến cuối về thị trấn là 10 giờ 15 tối. Ở bến taxi có người đang vẫy bạn.
            </p>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setWelcome(false)} aria-label="Đóng lời chào">
              <Icon icon={X} size={16} />
            </button>
          </div>
        )}

        {showPrompt && prompt && (
          <div className="town-prompt">
            <button type="button" className="btn btn-primary btn-lg" onClick={prompt.run} aria-keyshortcuts="E">
              <Icon icon={prompt.icon} size={18} />
              {prompt.text}
            </button>
            {nearShift && (
              <button type="button" className="btn btn-lg town-prompt-gift" onClick={() => !sheet && setSheet({ kind: 'shift', key: ++keys.current, id: nearShift.id })} aria-label={tl`Vào ca: ${nearShift.name}`}>
                <Icon icon={Briefcase} size={18} />
                <span className="town-prompt-gift-label">Vào ca</span>
              </button>
            )}
            {nearOuting && nearId && (
              <button type="button" className="btn btn-lg town-prompt-gift" onClick={() => startOuting(nearId, nearOuting)} aria-label={nearOuting.kind === 'family' ? 'Cả nhà ghé đây' : 'Hẹn hò ở đây'}>
                <Icon icon={Heart} size={18} />
                <span className="town-prompt-gift-label">{nearOuting.kind === 'family' ? 'Cả nhà ghé đây' : 'Hẹn hò ở đây'}</span>
              </button>
            )}
          </div>
        )}

        <p className="town-toast" role="status">
          {toast && !sheet ? <span className="town-toast-box">{toast}</span> : null}
        </p>

        {sceneUp && (
          <CitySheet title={`${nameOf(sceneUp.at)} · ${cityPerson(sceneUp.at)?.role ?? 'lên Westbay'}`} onClose={closeSheet} talk>
            <Suspense fallback={<p className="town-build-hint">Đang mở…</p>}>
              <CityScenePanel key={sceneUp.key} scene={sceneUp.scene} again={sceneUp.again} sound={ui.sound} onReward={onReward}
                onSpeaking={setSpeaking}
                onClose={closeSheet}
                kicker={sceneUp.kicker}
                outing={
                  sceneUp.outing && partner
                    ? {
                        partner: { id: partner, name: nameOf(partner), gender: CAST_VOICES[partner]?.gender ?? 'female' },
                        ...(kid && sceneUp.scene.kind === 'family' ? { kid: { name: kid.name, gender: kid.gender === 'boy' ? ('male' as const) : ('female' as const) } } : {}),
                      }
                    : undefined
                }
              />
            </Suspense>
          </CitySheet>
        )}
        {shownSheet?.kind === 'thing' && (
          <CitySheet title={thingKind(shownSheet.id) === 'bus' ? 'Xe buýt số 9' : listenTitle(shownSheet.id)} onClose={closeSheet}>
            <ListenPanel key={shownSheet.key} where="city" overheard={CITY_OVERHEARD} focus={shownSheet.id} sound={ui.sound} onClose={closeSheet} onReward={onReward} onListen={onListen} onSpeaking={setSpeaking} onTravel={toTown} />
          </CitySheet>
        )}
        {eventUp && (
          <CitySheet title={eventUp.event.name} onClose={closeSheet} talk>
            <Suspense fallback={<p className="town-build-hint">Đang mở…</p>}>
              <CityEventPanel key={eventUp.key} event={eventUp.event} sound={ui.sound} onReward={onReward} onSpeaking={setSpeaking} onClose={closeSheet} />
            </Suspense>
          </CitySheet>
        )}
        {shownSheet?.kind === 'shift' && (
          <CitySheet title={CITY_SHIFTS.find((s) => s.id === shownSheet.id)?.name ?? 'Ca làm việc'} onClose={closeSheet}>
            <Suspense fallback={<p className="town-build-hint">Đang mở…</p>}>
              <ShiftPanel key={shownSheet.key} shiftId={shownSheet.id} sound={ui.sound} onReward={onReward} onClose={closeSheet} />
            </Suspense>
          </CitySheet>
        )}
        {shownSheet?.kind === 'today' && (
          <CitySheet title={tl`Hôm nay ở Westbay · ${weekday}`} onClose={closeSheet}>
            <Suspense fallback={<p className="town-build-hint">Đang mở…</p>}>
              <CityToday
                city={city}
                now={now}
                events={eventsToday}
                seasons={CITY_SEASONS}
                guests={guests}
                onEvent={(ev) => {
                  closeSheet();
                  openEvent(ev);
                }}
                onChapter={(ch) => {
                  closeSheet();
                  stage.current?.walkTo(ch.at as PlaceId, () => startScene(ch.at));
                }}
                onTown={(ch) => navigate('town', { from: 'city', listen: `season:${ch.id}` })}
              />
            </Suspense>
          </CitySheet>
        )}
        {shownSheet?.kind === 'people' && (
          <CitySheet title="Người quen ở Westbay" onClose={closeSheet}>
            <Suspense fallback={<p className="town-build-hint">Đang mở…</p>}>
              <CityPeople
                city={city}
                guests={guests}
                now={now}
                onGo={(id) => {
                  closeSheet();
                  stage.current?.walkTo(id as PlaceId, () => startScene(id));
                }}
              />
            </Suspense>
          </CitySheet>
        )}
      </TownStage3D>

      <details className="how">
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Westbay để làm gì?
        </summary>
        <div className="stack-sm town-how">
          <p>
            Để nghe những đoạn dài hơn ở thị trấn: hai ba người nói với nhau mười mấy câu, bạn không thấy chữ, nghe xong mới trả lời rồi mới xem họ đã nói gì. Chuyện của mỗi người mở dần, và
            người này dẫn bạn tới người kia.
          </p>
          <p>
            Nói thật với nhau: người thành phố nói bằng giọng của trình duyệt, đọc rõ từng từ và ít nối âm hơn người thật. Phần này luyện theo kịp một cuộc trò chuyện dài; muốn luyện tai nghe nối
            âm thì Chép chính tả và chuyện của người thị trấn vẫn là chỗ chính. Xu ở đây là điểm trò chơi, không đo trình độ.
          </p>
        </div>
      </details>
    </div>
  );
}

/** A sheet over the stage (a side sheet on a wide stage, a bottom sheet on a phone): the town's build sheet's frame. */
function CitySheet({ title, onClose, talk = false, children }: { title: string; onClose: () => void; talk?: boolean; children: React.ReactNode }) {
  const boxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, []);
  usePanelKeys(boxRef, onClose);
  return (
    <aside ref={boxRef} className={'town-build town-activity-sheet' + (talk ? ' city-scene-sheet' : '')} role="dialog" aria-label={title} tabIndex={-1}>
      <header className="town-build-head">
        <h2 className="town-build-title">{title}</h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <div className="town-build-body town-activity-body">{children}</div>
    </aside>
  );
}
