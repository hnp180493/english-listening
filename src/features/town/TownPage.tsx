import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CircleHelp, Ear, FastForward, Footprints, Gift, Hammer, Heart, MessageCircle, Sparkles, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { prefersReducedMotion } from '../../core/motion';
import { hrefFor, navigate, parseHash } from '../../core/nav';
import { CITY_INVITE_HEARTS } from '../../core/town/city';
import { knowsFact, lineProgress, typedTotals } from '../../core/town/progress';
import {
  buyTownItem,
  loadTownProgress,
  startTownConversation,
  startTownEpisode,
  useTownOverview,
  useTownProgress,
  type TownAnswerResult,
  type TownEpisodeGistResult,
  type TownEpisodeResult,
  type TownEpisodeStart,
  type TownGiftGive,
  type TownTurn,
} from '../../core/town/store';
import type { TownPlace } from '../../core/town/types';
import type { PlaceView as TownPlaceView } from '../../core/town/overview';
import type { FriendView } from '../../core/town/friendship';
import { BUS_THING, PLACE_IDS, TOWN_WORLD, WORLD_ACTIVITIES, type ActivitySpotId, type PlaceId } from '../../data/townWorld';
import { thingPrompt } from './scenes/things';
import { WEATHER_NAME } from '../../core/town/world';
import { scenesHeard, townToday } from '../../core/town/worldStore';
import { episodeSetting, episodeVisitor, quickChatSetting } from '../../data/townStories';
import { useTownFarm, useTownGame } from '../../core/town/gameStore';
import { fieldLook, FARM_LOOK_SLOTS, type CropStage } from '../../core/town/farm';
import type { TownCelebration } from '../../core/town/store';
import ActivityHost from './ActivityHost';
import Celebrations from './activities/album/Celebrations';
import { ACTIVITIES, hasSpot, type ActivityId } from './activities/types';
import { Portrait } from './art';
import { prewarmPortraits, warmPortrait } from './portraitWarm';
import BuildSheet from './BuildSheet';
import Conversation from './Conversation';
import Episode from './Episode';
import type { FishStagePhase, MapSnapshot, Near, TownStageHandle, TravelMode, TravelTarget } from './engine/stage';
import { narrowStage, useFullStage, useStageInsets, useTownTheme } from './stageShell';
import MiniMap from './map/MiniMap';
import { metInStreet, playerStand, type TalkSetting } from './engine/staging';
import { homeSetting, streetTalkView } from './streetModel';
import { getCarrying, handDelivery, useCarrying } from '../../core/town/deliveryStore';
import { townRomanceSteps, useTownLife } from '../../core/town/lifeStore';
import { castLook, playerLookKey, profileLook, setPlayerLook, subscribePlayerLook } from './three/chars/looks';
import { kidAge, kidsOf, partnerOf } from '../../core/town/life';
import type { SceneSpot } from '../../data/romance/places';
import type { StageKid } from './engine/sim';
import { disposeHats } from './three/chars/hats';
import { disposeSharedMaterials } from './three/chars/materials';
import { disposePortraits } from './three/chars/portrait';
import { disposeProps } from './three/chars/props';
import { disposeOffscreen } from './three/offscreen';
import { disposeThumbs } from './three/thumbs';
import TownStage3D from './three/TownStage3D';
import { wantsFlat, webglAvailable } from './three/webgl';
import { lotLabel, lotLabelsOf, stageStateOf, suggestedPlace, talkLabel, talkPrompt, typedMeasureText, xu, type Verdict } from './shellModel';
import { playSfx, warmSfx } from './sfx';
import TownHud from './TownHud';
import GiftSheet from './friends/GiftSheet';
import GreetBubble from './friends/GreetBubble';
import { lockText, pointsText, type GiftReactionView } from './friends/friendModel';
import { useCanGift } from './friends/useCanGift';
import { useGreeting } from './friends/useGreeting';
import { getTownUi, setTownUi, useTownUi } from './townUi';
import QuestTracker from './QuestTracker';
import RideButton from './RideButton';
import { followed, townQuests } from './quests';
import './town.css';
import { tl, tr } from '../../i18n';

/** The card of an order in hand (docs/town.md §18): its own chunk, loaded when an order is first taken. */
const DeliveryChip = lazy(() => import('./DeliveryChip'));
/** The full map ("Bản đồ", M): its own chunk, loaded when it is first opened. */
const TownMap = lazy(() => import('./map/TownMap'));

const isPlaceId = (id: string | undefined): id is PlaceId => !!id && (PLACE_IDS as readonly string[]).includes(id);


const NO_FRIEND: FriendView = { placeId: '', points: 0, hearts: 0, toNext: 100, part: 0, title: '' };


type Talk =
  | {
      kind: 'quick';
      /** A new number for every conversation: the panel starts afresh. */
      key: number;
      place: TownPlace;
      turns: TownTurn[];
      met: boolean[];
      /** Met out in the town and talked to right there (docs/town.md §14 "Gặp trên đường"). */
      street?: boolean;
    }
  /** "Chuyện ở thị trấn": an episode (or its re-listen) waits at the place. */
  | { kind: 'episode'; key: number; place: TownPlace; start: Extract<TownEpisodeStart, { ok: true }> };

const TOAST_MS = 4200;
/**
 * A conversation's panel comes up this long after the camera starts gliding to the two (ms): its first render is the
 * heaviest moment of the page, and then it never lands in the same frame as the camera's first step.
 */
const PANEL_DELAY_MS = 150;

/** Town pages on screen now (a quick visit away and back can mount the next before the last one's clean-up ran). */
let townPages = 0;

/**
 * Leaving the town: what was drawn off the stage (portraits, thumbnails, loot) lets its renderer go, and the shared
 * character materials, hats and props are freed. After the stage's own clean-up (engine.destroy), and only when no
 * other town page has come up meanwhile.
 */
function releaseTownGraphics(): void {
  window.setTimeout(() => {
    if (townPages > 0) return;
    disposePortraits();
    disposeThumbs();
    disposeOffscreen();
    disposeSharedMaterials();
    disposeHats();
    disposeProps();
  }, 0);
}

/**
 * Begin a conversation at a place (core/town/store): the episode that waits there (a due re-listen, else the next
 * episode to hear), else the quick chat: five lines with their meanings, and for each line whether the learner had
 * answered it before. `quick`: the quick chat whatever waits; `street`: a quick chat where the two met in the street
 * (docs/town.md §14: an episode is told where it belongs, so it waits). Null for an empty lot or an unknown place.
 */
function beginTalk(placeId: string, key: number, quick = false, street = false): Talk | null {
  if (!quick && !street) {
    const e = startTownEpisode(placeId);
    if (e.ok) return { kind: 'episode', key, place: e.place, start: e };
  }
  const progress = loadTownProgress();
  const r = startTownConversation(placeId, street);
  if (!r.ok) return null;
  return { kind: 'quick', key, place: r.place, turns: r.turns, met: r.turns.map((t) => (lineProgress(progress, t.line.id)?.tries ?? 0) > 0), street };
}

/**
 * Where a talk happens now (docs/town.md §9 "Where it happens"): an episode's setting (its lodger setting while the
 * place is not built), or the quick chat's; 'here' for a chat where the two met in the street.
 */
function talkSetting(t: Talk, places: readonly TownPlaceView[]): TalkSetting {
  if (t.kind === 'quick' && t.street) return { kind: 'here' };
  const built = (id: string) => places.some((p) => p.place.id === id && p.built);
  return t.kind === 'episode' ? episodeSetting(t.start.episode, built) : quickChatSetting(t.place.id, built);
}

/** Where the map's travel takes the player for a courtship scene's spot (data/romance/places). */
function spotTarget(spot: SceneSpot | null): TravelTarget | null {
  if (!spot) return null;
  if (spot.kind === 'place') return isPlaceId(spot.id) ? { kind: 'place', id: spot.id } : null;
  if (spot.kind === 'activity') return { kind: 'activity', id: spot.id };
  const d = TOWN_WORLD.districts?.find((x) => x.id === spot.id);
  return d ? { kind: 'tile', x: d.arrive.x + 0.5, y: d.arrive.y + 0.5 } : null;
}

/**
 * The resident of `placeId` stands out in the town now (docs/town.md §14): in sight, and away from where a talk with
 * them would happen at home. False without a world (the page without 3D).
 */
function metOutside(stage: TownStageHandle | null, places: readonly TownPlaceView[], placeId: string): boolean {
  const at = stage?.mapSnapshot()?.residents.find((r) => r.id === placeId);
  const view = places.find((p) => p.place.id === placeId);
  if (!at || at.inside || !view) return false;
  return metInStreet(TOWN_WORLD, homeSetting(view, places), placeId, at);
}

/** The neighbour who is in the room for an episode (Ben at the café…), by place id. */
function talkVisitor(t: Talk): PlaceId | null {
  const v = t.kind === 'episode' ? episodeVisitor(t.start.episode) : null;
  return isPlaceId(v ?? undefined) ? (v as PlaceId) : null;
}

/**
 * The page without the world (this browser cannot draw the 3D town): a calm note and the residents as a list, so
 * conversations, episodes and (from the HUD) the activities and the build panel all still work.
 */
function FlatTown({ places, suggested, onTalk }: { places: readonly TownPlaceView[]; suggested: string | null; onTalk: (placeId: string) => void }) {
  const list = [...places].sort((a, b) => (a.place.id === suggested ? -1 : b.place.id === suggested ? 1 : 0));
  return (
    <div className="town-flat">
      <div className="town-flat-note" role="note">
        <p className="town-flat-title">Máy này chưa vẽ được thị trấn 3D</p>
        <p className="town-flat-text">
          Trình duyệt chưa bật tăng tốc đồ họa (WebGL 2) nên không hiện được thị trấn. Trò chuyện, nghe chuyện, xây nhà và các trò chơi vẫn dùng như thường: chọn một người dưới đây, hoặc dùng các nút ở góc trên.
        </p>
      </div>
      <ul className="town-flat-list" aria-label="Người dân">
        {list.map((p) => (
          <li key={p.place.id}>
            <button type="button" className="town-flat-row" onClick={() => onTalk(p.place.id)} aria-label={talkLabel(p)}>
              <Portrait placeId={p.place.id as PlaceId} size={36} />
              <span className="town-flat-body">
                <span className="town-flat-name">{p.place.resident}</span>
                <span className="town-flat-meta">
                  {p.built ? p.place.name : 'Ở nhà trọ'}
                  {p.episode ? ` · ${tr(p.episode.mode === 'relisten' ? 'Nghe lại tập' : 'Tập')} ${p.episode.order}: ${tr(p.episode.title)}` : ''}
                  {!p.episode && p.friendEpisode ? tl` · Tập ${p.friendEpisode.order}: ${lockText(p.friendEpisode, p.place.resident).toLowerCase()}` : ''}
                  {p.friend.hearts > 0 ? tl` · ${p.friend.hearts} tim` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Thị trấn": a small town the learner walks around. Its residents SAY a sentence (never shown before the answer)
 * and the learner picks what it meant; understanding pays xu, and xu build the town. The world is a real-time 3D
 * scene (three/TownStage3D, without its canvases where this browser cannot draw it); this page is the game around it: the
 * counters over it, the conversation, the build panel, the activities.
 */
/** What ?listen= may name: a thing to use, or a get-together. */
const LISTEN_LINK = /^(thing:(bench-[0-9]{1,2}|radio|bus)|event:[a-z]{2,12}|season:cs-[a-z]{2,12}-[1-9])$/;

export default function TownPage() {
  const theme = useTownTheme();
  const overview = useTownOverview();
  // the town's one real measure (docs/town.md §13), shown only in "Thị trấn này để làm gì?"
  const progressNow = useTownProgress();
  const typedMeasure = typedMeasureText(typedTotals(progressNow));
  const ui = useTownUi();
  const stage = useRef<TownStageHandle>(null);
  const xuRef = useRef<HTMLSpanElement>(null);
  const buildBtnRef = useRef<HTMLButtonElement>(null);
  // the 3D town, or (no WebGL 2 on a real graphics card, or it failed) the page without the world
  const [flat, setFlat] = useState(() => wantsFlat() || !webglAvailable());
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    townPages += 1;
    return () => {
      townPages -= 1;
      releaseTownGraphics();
    };
  }, []);
  const onStageReady = useCallback(() => setDrawn(true), []);
  const onStageFail = useCallback(() => setFlat(true), []);

  // #/town?talk=<placeId> opens straight into a conversation; #/town?build=<placeId | 1> opens the build panel
  const [params] = useState(() => parseHash(window.location.hash).params);
  const [linked] = useState<PlaceId | null>(() => (isPlaceId(params.talk) && overview.places.some((p) => p.place.id === params.talk && p.built) ? params.talk : null));
  const talkCount = useRef(0);
  const [talk, setTalk] = useState<Talk | null>(() => (linked ? beginTalk(linked, 0) : null));
  // a linked talk starts where it happens: the player stands at the room's door or at their spot outside
  const [startAt] = useState(() => {
    // back from Westbay: off the no. 9 at the bus station
    if (params.from === 'city') return { ...WORLD_ACTIVITIES[BUS_THING].stand };
    if (!linked || !talk) return undefined;
    const at = playerStand(TOWN_WORLD, talkSetting(talk, overview.places), linked);
    return at ? { x: Math.floor(at.x), y: Math.floor(at.y) } : undefined;
  });
  // the talk whose two people are in place (its key): from then on the town takes no input
  const [arrived, setArrived] = useState<number | null>(null);
  // the conversation whose panel is on the page (its key): a new one PANEL_DELAY_MS after it begins, the next one at
  // once when a panel is already up ("Nghe lại", "Trò chuyện nhanh"); a linked one as soon as the town is drawn
  const [openTalk, setOpenTalk] = useState<number | null>(() => (linked ? 0 : null));
  const openTimer = useRef(0);
  /** A conversation's panel is on the page now / the page has no world: read by startTalk. */
  const panelUp = useRef(false);
  const flatNow = useRef(false);
  useEffect(() => () => window.clearTimeout(openTimer.current), []);
  // a link to talk at a place that is still an empty lot lands on the build panel, on that lot
  const [build, setBuild] = useState<{ wanted: string | null } | null>(() => {
    if (params.build) return { wanted: isPlaceId(params.build) ? params.build : null };
    return isPlaceId(params.talk) && !linked ? { wanted: params.talk } : null;
  });
  /** An order for Emma in hand (docs/town.md §18). */
  const carried = useCarrying();
  const [near, setNear] = useState<Near>(null);
  /** The resident beside the player stands out in the town (docs/town.md §14), read when they came near. */
  const [nearStreet, setNearStreet] = useState(false);
  const onNear = useCallback((n: Near) => {
    setNear(n);
    setNearStreet(n?.kind === 'resident' ? metOutside(stage.current, overviewRef.current.places, n.placeId) : false);
  }, []);
  // an activity's panel is open (the pier, the farm field, the egg kiosk, the wardrobe, the album)
  // (the bus is there to take only once the bus station is built)
  const [listenLink] = useState<string | null>(() => (LISTEN_LINK.test(params.listen ?? '') && (params.listen !== BUS_THING || overview.places.some((p) => p.place.id === 'station' && p.built)) ? (params.listen ?? null) : null));
  // ?activity=<id> (e.g. Ôn tập's "Về nông trại") opens that panel once the town is drawn
  // ?listen=thing:radio | thing:bench-3 | event:games opens that scene's panel (a link to a thing or to a get-together)
  const [activity, setActivity] = useState<ActivityId | null>(() => ACTIVITIES.find((a) => a.id === params.activity)?.id ?? (listenLink ? (listenLink.startsWith('season:') ? 'season' : 'listen') : null));
  /** The Sổ tay opens at this resident's page (their hearts in a conversation's header, the map card); null: the list. */
  const [journalFor, setJournalFor] = useState<string | null>(null);
  /** What the "listen" panel is about: a thing used in the world ('thing:bench-3', 'thing:radio') or 'event:<id>'. */
  const [listenAt, setListenAt] = useState<string | null>(listenLink);
  /** "Tặng quà" standing next to a resident: the gift sheet for them. */
  const [gifting, setGifting] = useState<PlaceId | null>(null);
  /** Where focus goes back to when the activity's panel closes: the HUD's "Chơi" when it was opened from there. */
  const activityFrom = useRef<'hud' | 'stage'>('stage');
  // who speaks now in a conversation: the resident's place id, 'player' (an episode's own lines), or null
  const [speaking, setSpeaking] = useState<string | null>(null);
  // an episode's neighbour who drops in is in the room (Episode.tsx: from their first line of each pass)
  const [visitorIn, setVisitorIn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** A long click walk is under way: "Đến ngay" at the foot of the stage ends it at once (stage.hurry). */
  const [farWalk, setFarWalk] = useState(false);
  const soundRef = useRef(ui.sound);
  useEffect(() => {
    soundRef.current = ui.sound;
  }, [ui.sound]);
  const sfx = useCallback((name: Parameters<typeof playSfx>[0]) => playSfx(name, soundRef.current), []);

  const overviewRef = useRef(overview);
  useEffect(() => {
    overviewRef.current = overview;
  }, [overview]);
  // what the player wears (Tủ đồ) and what the town projects added (engine/extraDecor.ts)
  const game = useTownGame();
  const hat = game.look.hat?.id;
  const outfit = game.look.outfit?.id;
  const pet = game.look.pet?.id;
  const extraDecor = game.decorations;
  const look = useMemo(() => ({ hat, outfit, pet }), [hat, outfit, pet]);
  // the learner's own character (docs/town.md §15): the player's model, room and portrait use it. Set while rendering
  // (it only changes a module's look, idempotent): the stage, a child, applies its state before this page's effects.
  const life = useTownLife();
  const profile = life.profile;
  useMemo(() => setPlayerLook(profile ? profileLook(profile) : null), [profile]);
  // the look the player wears now: the saved one, or the one being made in "Nhân vật" (it follows the choice live)
  const body = useSyncExternalStore(subscribePlayerLook, playerLookKey);
  // the farm field in the world shows the learner's review cards (the same field the farm's panel reads)
  const farmField = useTownFarm().field;
  const farmKey = fieldLook(farmField, FARM_LOOK_SLOTS).slots.join(',');
  const farm = useMemo(() => farmKey.split(',') as CropStage[], [farmKey]);
  // the children old enough to walk follow the player (docs/town.md §15): the player's skin, a parent's hair
  const spouse = partnerOf(life);
  const married = !!(spouse && life.court[spouse]?.married);
  const [kidsAt] = useState(() => Date.now());
  const kidsKey = married && profile ? kidsOf(life).filter(({ kid }) => kidAge(kid.born, kidsAt) !== 'baby').map(({ id }, i) => `${id}:${i}`).join(',') : '';
  const kids = useMemo<StageKid[]>(() => {
    if (!kidsKey || !profile || !spouse) return [];
    const other = castLook(spouse).hair.color;
    return kidsOf(life)
      .filter(({ kid }) => kidAge(kid.born, kidsAt) !== 'baby')
      .map(({ id, kid }, i) => ({ id, skin: profile.skin, hair: i % 2 === 0 ? other : profile.hairColor, toddler: kidAge(kid.born, kidsAt) === 'toddler' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidsKey, profile, spouse]);
  const state = useMemo(() => ({ ...stageStateOf(overview, theme), look, extraDecor, farm, body, playerName: profile?.name, kids }), [overview, theme, look, extraDecor, farm, body, profile?.name, kids]);
  const lotLabels = useMemo(() => lotLabelsOf(overview), [overview]);
  const suggested = useMemo(() => suggestedPlace(overview.places), [overview.places]);
  // the quests (quests.ts): the one followed shows at the top with its way on the ground; the main button goes there
  const [questPick, setQuestPick] = useState<string | null>(null);
  const quests = useMemo(() => townQuests(overview.places, suggested?.place.id ?? null), [overview.places, suggested]);
  const quest = followed(quests, questPick);
  const questTarget = quest?.target ?? null;
  const lead = (questTarget?.kind === 'resident' ? overview.places.find((p) => p.place.id === questTarget.id) : undefined) ?? suggested;

  // ───────────────────────── a conversation ─────────────────────────

  /**
   * Talk to a resident (a click on them or their house, E beside them, the main button, the hidden list): what the
   * talk is decides where it happens (talkSetting), the stage takes both there (docs/town.md §7 "Staging": a walk to
   * the room's door and a dip into the room, or a walk to the place's front), and the panel opens once they are in
   * place. Until then a click elsewhere or the keys give the talk up (onTalkCancel), Esc too.
   *
   * `how`: 'person' when the resident themself was clicked (or E beside them): met out in the town, away from where
   * their talk would happen, they are talked to right there (docs/town.md §14 "Gặp trên đường"); 'street' keeps a
   * talk in the street ("Nói chuyện tiếp" after one); 'place' (their house, a list, the map, the main button) goes to
   * where it happens.
   */
  const startTalk = useCallback((placeId: string, quick = false, how: 'place' | 'person' | 'street' = 'place') => {
    // carrying an order for Emma (docs/town.md §18): whoever is walked up to is offered it, instead of a talk
    if (getCarrying()?.state === 'carrying') {
      const give = () => void handDelivery(placeId);
      // out in the town: walk up to them first; indoors (or no world): they come to the door for it
      const inside = stage.current?.mapSnapshot()?.residents.find((r) => r.id === placeId)?.inside ?? true;
      if (inside || !stage.current?.walkTo(placeId as PlaceId, give)) give();
      return;
    }
    talkCount.current += 1;
    const street = how === 'street' || (how === 'person' && metOutside(stage.current, overviewRef.current.places, placeId));
    const next = beginTalk(placeId, talkCount.current, quick, street);
    if (!next) {
      // an unknown place, or one with nothing to say: just walk up to them
      stage.current?.walkTo(placeId as PlaceId);
      return;
    }
    setActivity(null);
    setBuild(null);
    setToast(null);
    // just talked with them: no greeting from them for a while after (friends/useGreeting)
    const ui0 = getTownUi();
    setTownUi({ welcomed: true, hi: { ...ui0.hi, [placeId]: { id: ui0.hi[placeId]?.id ?? 'talk', at: Date.now() } } });
    setGifting(null);
    setTalk(next);
    window.clearTimeout(openTimer.current);
    // the portrait is drawn while they walk, not in the frame they arrive
    warmPortrait(placeId as PlaceId);
    const setting = talkSetting(next, overviewRef.current.places);
    const key = next.key;
    const open = () => {
      setArrived(key);
      window.clearTimeout(openTimer.current);
      stage.current?.act('player', 'wave');
      // rendered in slices between frames (a transition): in a room from the dark of the dip (it comes in as the room
      // fades in), outside a moment after the camera starts towards the two (never in the camera's first step)
      if (panelUp.current || flatNow.current) setOpenTalk(key);
      else if (setting.kind === 'inside') startTransition(() => setOpenTalk(key));
      else openTimer.current = window.setTimeout(() => startTransition(() => setOpenTalk(key)), PANEL_DELAY_MS);
    };
    if (!stage.current?.talkAt(placeId as PlaceId, setting, { visitor: talkVisitor(next) }, open)) open();
  }, []);

  /** The talk being walked to was given up (a click elsewhere, the keys, Esc): nothing opens. */
  const dropTalk = useCallback(() => {
    window.clearTimeout(openTimer.current);
    setTalk(null);
    setArrived(null);
    setSpeaking(null);
  }, []);

  const endTalk = useCallback(() => {
    setTalk(null);
    setArrived(null);
    setSpeaking(null);
    stage.current?.endTalk();
    stage.current?.focus();
    // a link that opened the conversation is used up: a reload shows the town
    if (parseHash(window.location.hash).params.talk) {
      try {
        window.history.replaceState(null, '', '#/town');
      } catch {
        // the address stays as it was
      }
    }
  }, []);

  // a linked conversation was begun with the first render; it shows (and the stage leans in) once the town is drawn
  const townReady = flat || drawn;

  // once the town is drawn, the residents' conversation portraits are drawn ahead in idle time (the suggested first)
  const portraitIds = useMemo(() => {
    const ids = overview.places.map((p) => p.place.id as PlaceId);
    const first = suggestedPlace(overview.places)?.place.id;
    return first ? [first as PlaceId, ...ids.filter((id) => id !== first)] : ids;
  }, [overview.places]);
  const portraitKey = portraitIds.join(',');
  useEffect(() => {
    if (!drawn || flat) return;
    return prewarmPortraits(portraitKey.split(',').filter(Boolean) as PlaceId[]);
  }, [drawn, flat, portraitKey]);
  // the sound effects' audio context too (with sound on): making it would otherwise stall the first right answer
  const soundOn = ui.sound;
  useEffect(() => {
    if (!townReady || !soundOn) return;
    const w = window as Window & { requestIdleCallback?: (run: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warmSfx, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warmSfx, 1000);
    return () => window.clearTimeout(id);
  }, [townReady, soundOn]);
  // a linked conversation was begun with the first render: the stage puts the two where it happens at once (before
  // its first frame); the panel shows once the town is drawn
  const linkedTalk = useRef(talk);
  useEffect(() => {
    const t = linkedTalk.current;
    if (!linked || !t) return;
    linkedTalk.current = null;
    setTownUi({ welcomed: true });
    const ready = () => setArrived(t.key);
    if (!stage.current?.talkAt(linked, talkSetting(t, overviewRef.current.places), { visitor: talkVisitor(t), instant: true }, ready)) ready();
  }, [linked]);

  // Esc while walking to a talk gives it up (the panel's own Esc ends a talk once it is open)
  const walkingTo = talk && arrived !== talk.key ? talk.key : null;
  useEffect(() => {
    if (walkingTo === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      stage.current?.endTalk();
      dropTalk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [walkingTo, dropTalk]);

  /** Talk to a resident: the stage takes both where the talk happens. */
  const goTalk = startTalk;

  /**
   * A courtship scene (docs/town.md §15): a dip to where it happens (a place's door, the pier, a part of town), the one
   * courted beside the player, the camera on the two; a wedding brings the whole town round.
   */
  const onScene = useCallback(({ placeId, spot, wedding }: { placeId: string; spot: SceneSpot | null; wedding: boolean }) => {
    const st = stage.current;
    if (!st) return;
    const id = placeId as PlaceId;
    const here = () => {
      st.meet(id, () => {});
      if (wedding) st.crowd([id]);
    };
    const target = spotTarget(spot);
    if (!target || !st.travelTo(target, 'warp', here)) here();
  }, []);
  const onSceneEnd = useCallback(
    ({ placeId, celebrate }: { placeId: string; celebrate: boolean }) => {
      const st = stage.current;
      if (!st) return;
      if (celebrate) {
        st.burst('confetti', placeId as PlaceId);
        st.burst('confetti', 'player');
        st.emote(placeId as PlaceId, 'heart');
        st.emote('player', 'heart');
        sfx('task');
      }
      st.endTalk();
    },
    [sfx],
  );
  /** The stage: a resident clicked (in person: maybe met in the street) or their house. */
  const onStageTalk = useCallback((id: string, inPerson: boolean) => startTalk(id, false, inPerson ? 'person' : 'place'), [startTalk]);

  /** Where the xu counter is, in the stage's own pixels: coins fly there. */
  const xuPoint = useCallback(() => {
    const box = stage.current?.rect();
    const pill = xuRef.current?.getBoundingClientRect();
    if (!box || !pill) return undefined;
    return { x: pill.left - box.left + 18, y: pill.top - box.top + pill.height / 2 };
  }, []);

  const timers = useRef<number[]>([]);
  const later = useCallback((ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  }, []);
  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const talkPlace = talk?.place.id;
  const onAnswered = useCallback(
    (r: TownAnswerResult, v: Verdict) => {
      const s = stage.current;
      const id = talkPlace as PlaceId | undefined;
      if (!s || !id) return;
      s.emote(id, v.emote);
      s.act(id, v.tone === 'ok' ? 'yes' : 'no');
      sfx(v.sfx);
      if (r.reward > 0) {
        s.float(id, `+${r.reward}`);
        s.burst('coins', id, xuPoint());
        later(520, () => sfx('coin'));
      }
      if (r.leveledUp || r.tasksPaid.length > 0) {
        later(350, () => stage.current?.burst('confetti', id));
        later(900, () => sfx(r.leveledUp ? 'level' : 'task'));
      }
    },
    [talkPlace, sfx, xuPoint, later],
  );

  const onFinished = useCallback(
    (results: readonly TownAnswerResult[]) => {
      const id = talkPlace as PlaceId | undefined;
      if (!id || results.length === 0 || results.some((r) => r.outcome === 'wrong')) return;
      // every line understood: the bonus deserves a little party
      stage.current?.burst('confetti', id);
      stage.current?.emote(id, 'heart');
    },
    [talkPlace],
  );

  const onSpeaking = useCallback((on: boolean) => setSpeaking(on ? (talkPlace ?? null) : null), [talkPlace]);
  const onStorySpeaking = useCallback((who: string | null) => setSpeaking(who), []);

  const onGist = useCallback(
    (r: TownEpisodeGistResult, v: Verdict) => {
      const s = stage.current;
      const id = talkPlace as PlaceId | undefined;
      if (!s || !id) return;
      s.emote(id, v.emote);
      s.act(id, v.tone === 'ok' ? 'yes' : 'no');
      sfx(v.sfx);
      if (r.reward > 0) {
        s.float(id, `+${r.reward}`);
        s.burst('coins', id, xuPoint());
        later(520, () => sfx('coin'));
      }
      // the honest win: the main point understood on the very first listen
      if (r.firstWin) later(350, () => stage.current?.burst('confetti', id));
      if (r.tasksPaid.length > 0) later(900, () => sfx('task'));
    },
    [talkPlace, sfx, xuPoint, later],
  );

  const onEpisodeFinished = useCallback(
    (r: TownEpisodeResult) => {
      const s = stage.current;
      const id = talkPlace as PlaceId | undefined;
      if (!s || !id) return;
      if (r.finishXu > 0) {
        s.float(id, `+${r.finishXu}`);
        s.burst('coins', id, xuPoint());
        later(520, () => sfx('coin'));
      }
      if (r.firstFinish || r.levelTitle) {
        s.burst('confetti', id);
        s.emote(id, 'heart');
        later(400, () => sfx(r.levelTitle ? 'level' : 'task'));
      }
    },
    [talkPlace, sfx, xuPoint, later],
  );

  // ───────────────────────── activities ─────────────────────────

  const openActivity = useCallback((id: ActivityId, from: 'hud' | 'stage' = 'stage') => {
    activityFrom.current = from;
    setTownUi({ welcomed: true });
    setBuild(null);
    setGifting(null);
    setToast(null);
    setActivity(id);
  }, []);
  /** A spot of the world reached (clicked and walked to, or E beside it): an activity's own, or a thing to use. */
  const openSpot = useCallback(
    (id: ActivitySpotId) => {
      if (id.startsWith('thing:')) {
        setListenAt(id);
        openActivity('listen');
      } else openActivity(id as ActivityId);
    },
    [openActivity],
  );
  // who may be asked along on the no. 9: friends from CITY_INVITE_HEARTS hearts (the partner comes along anyway)
  const partnerNow = partnerOf(life);
  const busCompanions = useMemo(
    () => overview.places.filter((p) => p.friend.hearts >= CITY_INVITE_HEARTS && p.place.id !== partnerNow).map((p) => ({ id: p.place.id, name: p.place.resident })),
    [overview.places, partnerNow],
  );
  /** Bus no. 9 sets off for Westbay (docs/town.md §20): the route's other page (TownRoute). */
  const toCity = useCallback((withId?: string) => navigate('town', { at: 'city', with: withId }), []);
  /** A "cảnh nghe" at a thing: the player sits down on it, the two who are overheard come and talk nearby. */
  const [listenSpeaking, setListenSpeaking] = useState<string | null>(null);
  const listenThing = useRef<string | null>(null);
  useEffect(() => {
    listenThing.current = listenAt;
  }, [listenAt]);
  const onListen = useCallback((who: readonly string[] | null) => {
    const s = stage.current;
    if (!who) {
      setListenSpeaking(null);
      s?.endListen();
      return;
    }
    const at = listenThing.current;
    if (s && at?.startsWith('thing:')) s.listenFrom(at as ActivitySpotId, who.filter((id): id is PlaceId => (PLACE_IDS as readonly string[]).includes(id)));
  }, []);
  /** Today's get-together (the day's list): its scene opens. */
  const openEvent = useCallback(
    (eventId: string) => {
      setListenAt('event:' + eventId);
      openActivity('listen', 'hud');
    },
    [openActivity],
  );
  // today's chapter of a long story of Westbay that is played here in the town (docs/town.md §21): the stories are the
  // city's data, loaded only for somebody who has been there
  const [townStory, setTownStory] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    let gone = false;
    void Promise.all([import('../../core/town/cityStore'), import('../../core/town/city'), import('../../data/city/seasons')]).then(([store, rules, data]) => {
      const city = store.loadTownCity();
      if (gone || !city.first) return;
      const ch = rules.chaptersToday(data.CITY_SEASONS, city, Date.now()).find((c) => c.chapter.where === 'town');
      setTownStory(ch ? { id: ch.chapter.id, text: tl`${ch.season.title}: chương hôm nay ở chỗ ${overviewRef.current.places.find((p) => p.place.id === ch.chapter.at)?.place.resident ?? ''}.` } : null);
    });
    return () => {
      gone = true;
    };
    // when the page opens, and again when a panel closes (the chapter may just have been heard)
  }, [activity]);
  const openStory = useCallback(
    (id: string) => {
      setListenAt('season:' + id);
      openActivity('season', 'hud');
    },
    [openActivity],
  );
  const closeActivity = useCallback(() => {
    setActivity(null);
    setJournalFor(null);
    // a panel opened from the address (?activity=farm) must not reopen on a reload
    if (parseHash(window.location.hash).params.activity || parseHash(window.location.hash).params.listen) {
      try {
        window.history.replaceState(window.history.state, '', hrefFor('town'));
      } catch {
        // history unavailable: harmless, the panel only reopens on a reload
      }
    }
    if (activityFrom.current === 'hud') stage.current?.box()?.querySelector<HTMLButtonElement>('.town-play button')?.focus({ preventScroll: true });
    else stage.current?.focus();
  }, []);
  /** From the HUD's menu: walk there, then open it (at once when there is no way there). */
  const goActivity = useCallback(
    (id: ActivityId) => {
      setJournalFor(null);
      // the gift shop and the Sổ tay have no spot in the world: they open where the player is
      if (!hasSpot(id) || !stage.current?.walkToActivity(id, () => openActivity(id, 'hud'))) openActivity(id, 'hud');
    },
    [openActivity],
  );
  /** Open the Sổ tay at a resident: from a conversation, the talk ends first (its answered lines are saved). */
  const journalFromTalk = useCallback(
    (placeId: string) => {
      endTalk();
      setJournalFor(placeId);
      openActivity('journal', 'hud');
    },
    [endTalk, openActivity],
  );
  const onReward = useCallback(
    (r: { label: string; xu?: number }) => {
      setToast(r.label);
      if (r.xu && r.xu > 0) {
        stage.current?.float('player', `+${r.xu}`);
        stage.current?.burst('coins', 'player', xuPoint());
        later(520, () => sfx('coin'));
      } else sfx('right');
    },
    [xuPoint, later, sfx],
  );

  /** A gift was given (the sheet, a result card): the resident shows how they take it, the points rise over them. */
  const onGiven = useCallback(
    (r: Extract<TownGiftGive, { ok: true }>, view: GiftReactionView, placeId: string) => {
      const s = stage.current;
      const id = placeId as PlaceId;
      if (!s) return;
      s.emote(id, view.emote);
      if (r.taste !== 'dislikes') s.act(id, 'yes');
      if (r.points !== 0) s.float(id, r.points > 0 ? `+${r.points}` : `${r.points}`);
      if (r.taste === 'loves') later(200, () => stage.current?.burst('sparkle', id));
      sfx(r.taste === 'dislikes' ? 'wrong' : r.taste === 'loves' ? 'first' : 'right');
      setToast(view.title + (r.points !== 0 ? ` ${pointsText(r.points)}.` : ''));
    },
    [later, sfx],
  );
  const closeGift = useCallback(() => {
    setGifting(null);
    stage.current?.focus();
  }, []);
  const giftToShop = useCallback(() => {
    setGifting(null);
    openActivity('gifts', 'hud');
  }, [openActivity]);

  /** The fishing panel's phase, shown in the world (the player at the end of the pier). */
  const onFish = useCallback((phase: FishStagePhase | null, tier: string | null) => stage.current?.fishing(phase, tier), []);

  /** A new achievement, a town project done, an egg given (activities/album/Celebrations.tsx shows the words). */
  const onCelebrate = useCallback(
    (c: TownCelebration) => {
      stage.current?.burst('confetti', 'player');
      later(250, () => sfx(c.kind === 'egg' ? 'task' : 'level'));
    },
    [later, sfx],
  );

  // ───────────────────────── building ─────────────────────────

  const openBuild = useCallback((wanted: string | null) => {
    setTownUi({ welcomed: true });
    setActivity(null);
    setBuild({ wanted });
  }, []);
  const closeBuild = useCallback(() => {
    setBuild(null);
    buildBtnRef.current?.focus({ preventScroll: true });
  }, []);

  // ───────────────────────── the map ─────────────────────────

  /** "Bản đồ" is open ('leaving': it dissolves while a warp dips the town to dark). */
  const [map, setMap] = useState<'open' | 'leaving' | null>(null);
  /** The stage as it was when the map opened (the camera's turn, where the player stands). */
  const [mapStart, setMapStart] = useState<MapSnapshot | null>(null);
  const mapBtnRef = useRef<HTMLButtonElement>(null);
  /** Where focus goes back to when the map closes: the HUD's button when it was opened from there. */
  const mapFrom = useRef<'hud' | 'stage'>('stage');
  const mapTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(mapTimer.current), []);
  const openMap = useCallback(
    (from: 'hud' | 'stage') => {
      if (flat || !townReady) return;
      // in a conversation the map waits; a talk still being walked to is given up
      if (talk && arrived === talk.key) return;
      if (talk) {
        stage.current?.endTalk();
        dropTalk();
      }
      mapFrom.current = from;
      setTownUi({ welcomed: true });
      setBuild(null);
      setActivity(null);
      setToast(null);
      setMapStart(stage.current?.mapSnapshot() ?? null);
      setMap('open');
    },
    [flat, townReady, talk, arrived, dropTalk],
  );
  const closeMap = useCallback(() => {
    window.clearTimeout(mapTimer.current);
    setMap(null);
    if (mapFrom.current === 'hud') mapBtnRef.current?.focus({ preventScroll: true });
    else stage.current?.focus();
  }, []);
  /** "Đi tới": the map closes and the player walks there; "Đến ngay": the map dissolves as the town dips to dark. */
  const travel = useCallback((target: TravelTarget, mode: TravelMode) => {
    const s = stage.current;
    if (!s) return;
    window.clearTimeout(mapTimer.current);
    // sent to an activity's spot: its panel opens on arrival (as from the HUD's menu)
    const then = target.kind === 'activity' ? () => openSpot(target.id) : undefined;
    const warped = mode === 'warp' && s.travelTo(target, 'warp', then);
    if (!warped) s.travelTo(target, 'walk', then);
    if (warped && !prefersReducedMotion()) {
      setMap('leaving');
      mapTimer.current = window.setTimeout(() => setMap(null), 320);
    } else setMap(null);
    s.focus();
  }, [openSpot]);
  // M opens the map (and closes it: the map's own keys)
  const mapKey = useRef(openMap);
  useEffect(() => {
    mapKey.current = openMap;
  }, [openMap]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && (t.isContentEditable || t.closest('input, textarea, select, [data-popover], [role="dialog"], dialog'))) return;
      if (document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]')) return;
      e.preventDefault();
      mapKey.current('stage');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onBuy = useCallback(
    (id: string) => {
      const r = buyTownItem(id);
      if (!r.ok) return;
      // the stage hears of it before the new state arrives, so the thing can pop out of the ground
      const wait = stage.current?.celebrate(id) ?? 0;
      sfx('build');
      later(wait * 1000, () => sfx('pop'));
      const place = overview.places.find((p) => p.place.id === id)?.place;
      // said when it is there to see, not while the dust is still rising
      const said = place ? tl`Đã xây ${place.name}. ${place.resident} vừa dọn tới!` : tl`Đã thêm ${r.item.name} cho thị trấn.`;
      later(wait * 1000, () => setToast(said));
      if (narrowStage()) setBuild(null);
      else setBuild((b) => (b ? { wanted: null } : b));
    },
    [overview.places, sfx, later],
  );

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ───────────────────────── today in the town (docs/town.md §19) ─────────────────────────

  const [todayIs] = useState(() => townToday());
  const day = useMemo(() => {
    const ev = todayIs.event;
    const host = ev ? overview.places.find((q) => q.place.id === ev.host) : undefined;
    return {
      weather: WEATHER_NAME[todayIs.weather],
      event: ev ? { id: ev.id, name: ev.name, blurb: ev.blurb } : null,
      needs: ev && host && !host.built ? host.place.name : null,
      done: !!ev && scenesHeard(progressNow, todayIs.day).some((id) => id.startsWith(`ev-${ev.id}-`)),
    };
  }, [todayIs, overview.places, progressNow]);

  // ───────────────────────── what the one button at the bottom offers ─────────────────────────

  const nearPlace = near && near.kind !== 'activity' ? overview.places.find((p) => p.place.id === near.placeId) : undefined;
  // beside somebody out in the town: the button offers a chat right there, not their episode (it waits at home)
  const nearShown = nearPlace && nearStreet ? { ...nearPlace, episode: null } : nearPlace;
  const nearActivity = near?.kind === 'activity' ? ACTIVITIES.find((a) => a.id === near.id) : undefined;
  // a bench, the radio (data/townWorld WORLD_THINGS): "Ngồi xuống nghe", "Nghe radio"
  const nearThing = near?.kind === 'activity' ? thingPrompt(near.id) : null;
  const prompt: { icon: typeof Hammer; text: string; build: boolean; id: string; activity?: ActivityId; person?: boolean; spot?: ActivitySpotId } | null = nearActivity
    ? { icon: Sparkles, text: nearActivity.name, build: false, id: nearActivity.id, activity: nearActivity.id }
    : nearThing && near?.kind === 'activity'
      ? { icon: Ear, text: nearThing, build: false, id: near.id, spot: near.id }
      : near?.kind === 'resident' && nearPlace
        ? { icon: MessageCircle, text: talkPrompt(nearShown ?? nearPlace, true), build: false, id: nearPlace.place.id, person: true }
        : near?.kind === 'lot' && nearPlace && !nearPlace.built
          ? { icon: Hammer, text: tl`Xây ${nearPlace.place.name} · ${xu(nearPlace.cost)}`, build: true, id: nearPlace.place.id }
          : lead
            ? { icon: Footprints, text: talkPrompt(lead, false), build: false, id: lead.place.id }
            : null;
  const promptId = prompt?.id;
  const promptBuilds = prompt?.build ?? false;
  const promptActivity = prompt?.activity ?? null;
  const promptPerson = prompt?.person ?? false;
  const promptSpot = prompt?.spot ?? null;
  const runPrompt = useCallback(() => {
    if (!promptId) return;
    if (promptSpot) openSpot(promptSpot);
    else if (promptActivity) openActivity(promptActivity);
    else if (promptBuilds) openBuild(promptId);
    else goTalk(promptId, false, promptPerson ? 'person' : 'place');
  }, [promptId, promptBuilds, promptActivity, promptPerson, promptSpot, openActivity, openSpot, openBuild, goTalk]);
  const onIdleAct = useCallback(() => {
    if (lead) goTalk(lead.place.id);
  }, [lead, goTalk]);

  const hasPlayed = overview.totals.understood > 0 || overview.playedToday || overview.earned > 0;
  // Until the town's first frame is drawn it is on hold: no conversation or build panel over an empty sky (a link to
  // one opens once it is there), no input; the stage shows its own "Đang dựng thị trấn…".
  const shownTalk = townReady && talk && openTalk === talk.key ? talk : null;
  useEffect(() => {
    panelUp.current = !!shownTalk;
    flatNow.current = flat;
  });
  const shownBuild = townReady && !talk ? build : null;
  const shownActivity = townReady && !talk && !build ? activity : null;
  const shownGift = townReady && !talk && !build && !activity && !map ? gifting : null;
  // Leo's first words are about walking up to people: not on the page without the world
  const showWelcome = townReady && !flat && !ui.welcomed && !hasPlayed && !talk && !build && !activity && !map;
  const stageBox = useCallback(() => stage.current?.box() ?? null, []);
  const fullStage = useFullStage(stageBox, !!shownTalk || !!shownBuild || !!shownActivity || !!map);
  // a phone: a conversation makes the stage as tall as the screen between its bars (town.css .is-talking) and brings
  // it up under the top bar, so the room or the two in town get a real strip above the panel, not a sliver
  const talkShownKey = shownTalk?.key ?? null;
  useEffect(() => {
    if (talkShownKey === null || fullStage.full) return;
    let narrow = false;
    try {
      narrow = window.matchMedia('(max-width: 720px)').matches;
    } catch {
      return;
    }
    if (!narrow) return;
    // (at once: the panel takes the focus as it opens, which would stop a smooth scroll half way)
    const id = requestAnimationFrame(() => stage.current?.box()?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(id);
  }, [talkShownKey, fullStage.full]);
  // on a long click walk "Đến ngay" takes the main button's place (the walk is what the learner chose to do now)
  const showHurry = farWalk && townReady && !flat && !shownTalk && !build && !activity && !map && !gifting;
  // (the card that ends a delivery has its own main button: the town's waits behind it)
  const deliveryEnded = !!carried && carried.state !== 'carrying';
  const showPrompt = townReady && !talk && !build && !activity && !map && !gifting && !!prompt && !showHurry && !deliveryEnded;
  // "Tặng quà" beside the main button, standing next to a resident with a gift in hand (one a day each)
  const nearResident = near?.kind === 'resident' ? near.placeId : null;
  const canGiftNear = useCanGift(nearResident);
  // beside somebody this character can court (or the spouse): "Hẹn hò" opens their page (docs/town.md §15)
  const canLoveNear = !!nearResident && !!profile && townRomanceSteps(nearResident).length > 0;
  // a resident greets the player who stops beside them, in free play only (friends/useGreeting)
  const greetFree = townReady && !flat && !talk && !build && !activity && !map && !gifting && !showWelcome && ui.greet && ui.sound;
  const greet = useGreeting(near, greetFree, useCallback((id: PlaceId) => stage.current?.act(id, 'wave'), []));
  const greetSpeaking = greet.greeting && greet.sounding ? greet.greeting.placeId : null;
  const insets = useStageInsets(stageBox, `${shownTalk?.key ?? '-'}|${shownBuild ? 'b' : shownActivity ? 'a' + shownActivity : '-'}|${fullStage.full ? 'f' : '-'}|${showPrompt ? 'p' : showHurry ? 'h' : '-'}|${showWelcome ? 'w' : '-'}|${shownGift ?? '-'}|${townReady ? 'r' : '-'}|${flat ? 'flat' : '3d'}`);
  // on a phone every line of text above the town costs a row of the town
  const [narrow] = useState(narrowStage);
  const talkView = talk ? overview.places.find((p) => p.place.id === talk.place.id) : undefined;
  // met in the street: what you see of them there, and what they say before you part (docs/town.md §14)
  const streetKey = shownTalk?.kind === 'quick' && shownTalk.street ? shownTalk.key : null;
  const streetView = useMemo(() => {
    if (streetKey === null || !talkView) return null;
    return streetTalkView(talkView, overview.places, (fact) => knowsFact(progressNow, fact), Date.now(), streetKey);
    // the scene is drawn once per meeting: not again when the hearts move during it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streetKey]);
  // the panel names where the talk happens ("Grace · Nhà trọ" while she lodges there, "Ben · Quảng trường" at his stall)
  const shownPlace = shownTalk?.place;
  const panelPlace = useMemo(() => {
    if (!talk || !shownPlace) return undefined;
    const setting = talkSetting(talk, overview.places);
    if (setting.kind === 'here') return { ...shownPlace, name: 'Gặp trên đường' };
    const at = setting.kind === 'inside' ? setting.room : setting.at;
    if (at === shownPlace.id) return shownPlace;
    const name = at === 'inn' ? 'Nhà trọ' : (overview.places.find((p) => p.place.id === at)?.place.name ?? shownPlace.name);
    return { ...shownPlace, name };
  }, [talk, shownPlace, overview.places]);

  return (
    <div className="stack-lg page-browse town-page">
      <PageHeader
        title="Thị trấn"
        subtitle={narrow ? undefined : 'Nghe người dân nói, hiểu là có xu để xây thêm thị trấn.'}
        help={
          <ShortcutsHelp
            items={[
              { keys: ['← ↑ ↓ →'], text: 'Đi quanh thị trấn (W A S D cũng được)' },
              { keys: ['Shift'], text: 'Giữ khi đi để chạy' },
              { keys: ['E'], text: 'Bắt chuyện, hoặc mở trò chơi ở chỗ đang đứng (Enter cũng được)' },
              { keys: ['1–3'], text: 'Chọn nghĩa của câu, hoặc ý chính của cả đoạn' },
              { keys: ['R'], text: 'Nghe lại câu (hoặc cả đoạn)' },
              { keys: ['Enter'], text: 'Câu tiếp' },
              { keys: ['M'], text: 'Mở / đóng bản đồ cả thị trấn' },
              { keys: ['Ctrl', 'Lăn chuột'], text: 'Phóng to, thu nhỏ (đã bấm vào thị trấn thì chỉ cần lăn chuột)' },
              { keys: ['Chuột phải', 'Kéo'], text: 'Xoay góc nhìn (giữ nút giữa rồi kéo cũng được)' },
              { keys: ['Esc'], text: 'Rời cuộc trò chuyện, đóng bảng xây, bảng trò chơi, bản đồ' },
            ]}
          />
        }
      />

      <TownStage3D
        flat={flat}
        ref={stage}
        state={state}
        onTalk={onStageTalk}
        onTalkCancel={dropTalk}
        onFarWalk={setFarWalk}
        onLot={openBuild}
        onNear={onNear}
        onIdleAct={onIdleAct}
        onActivity={openSpot}
        onReady={onStageReady}
        onFail={onStageFail}
        speaking={shownTalk ? speaking : shownActivity === 'listen' ? listenSpeaking : greetSpeaking}
        visitorIn={visitorIn}
        inset={insets.panel}
        safe={insets.safe}
        hint={!talk && lead ? (lead.place.id as PlaceId) : null}
        guide={!talk && !build && !activity ? questTarget : null}
        full={fullStage.full}
        paused={(!!talk && arrived === talk.key) || !townReady || !!shownActivity || !!map}
        lotLabels={lotLabels}
        startAt={startAt}
        className={[shownTalk ? 'is-talking' : shownBuild || shownActivity ? 'is-building' : '', fullStage.full ? 'is-full' : ''].filter(Boolean).join(' ') || undefined}
        label={flat ? 'Thị trấn' : 'Thị trấn nhìn từ trên cao. Dùng danh sách nút ngay sau đây để tới gặp từng người hoặc xây từng nơi.'}
      >
        {flat ? (
          !talk && !build && !activity && <FlatTown places={overview.places} suggested={suggested?.place.id ?? null} onTalk={goTalk} />
        ) : (
          <ul className="town-actions" aria-label="Việc làm được trong thị trấn">
            {overview.places.map((p) => (
              <li key={p.place.id}>
                <button type="button" className="town-action" onClick={() => goTalk(p.place.id)} disabled={!!talk || !townReady}>
                  {talkLabel(p)}
                </button>
                {!p.built && (
                  <button type="button" className="town-action" onClick={() => openBuild(p.place.id)} disabled={!!talk || !townReady}>
                    {lotLabel(p)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!flat && townReady && !talk && !build && !activity && !map && !showWelcome && (
          <QuestTracker
            quests={quests}
            current={quest}
            stage={stage}
            onPick={(q) => {
              setQuestPick(q.id);
              if (q.target?.kind === 'resident') goTalk(q.target.id);
            }}
          />
        )}
        {!flat && townReady && !talk && !build && !activity && !map && !showWelcome && <RideButton stage={stage} />}
        <TownHud
          overview={overview}
          sound={ui.sound}
          onSound={(on) => setTownUi({ sound: on })}
          onBuild={() => (build ? closeBuild() : townReady && openBuild(null))}
          buildOpen={!!shownBuild}
          onPlay={(id) => {
            if (townReady && !talk) goActivity(id);
          }}
          playOpen={shownActivity}
          xuRef={xuRef}
          buildRef={buildBtnRef}
          onMap={flat ? undefined : () => (map ? closeMap() : openMap('hud'))}
          mapOpen={!!map}
          mapRef={mapBtnRef}
          full={fullStage.full}
          onFull={fullStage.toggle}
          today={day}
          onEvent={(id) => {
            if (townReady && !talk) openEvent(id);
          }}
          story={townStory && townReady && !talk ? { text: townStory.text, onGo: () => openStory(townStory.id) } : undefined}
          onBus={
            overview.places.some((p) => p.place.id === 'station' && p.built)
              ? () => {
                  if (!townReady || talk) return;
                  if (!stage.current?.walkToActivity(BUS_THING, () => openSpot(BUS_THING))) openSpot(BUS_THING);
                }
              : undefined
          }
        />

        {showWelcome && (
          <div className="town-welcome" role="note">
            <Portrait placeId="square" size={44} />
            <p className="town-welcome-text">
              <span className="town-welcome-name">Leo</span>
              Chào bạn! Cứ lại gần ai đó, nghe họ nói một câu rồi chọn nghĩa. Hiểu là có xu, có xu thì xây thêm nhà cho thị trấn.
            </p>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setTownUi({ welcomed: true })} aria-label="Đóng lời chào">
              <Icon icon={X} size={16} />
            </button>
          </div>
        )}

        {showPrompt && prompt && (
          <div className="town-prompt">
            <button type="button" className="btn btn-primary btn-lg" onClick={runPrompt} aria-keyshortcuts="E">
              <Icon icon={prompt.icon} size={18} />
              {prompt.text}
            </button>
            {nearResident && canLoveNear && near?.kind === 'resident' && prompt.id === nearResident && (
              <button
                type="button"
                className="btn btn-lg town-prompt-gift"
                onClick={() => {
                  setJournalFor(nearResident);
                  openActivity('love', 'hud');
                }}
                aria-label={tl`Hẹn hò với ${overview.places.find((p) => p.place.id === nearResident)?.place.resident ?? ''}`}
              >
                <Icon icon={Heart} size={18} />
                <span className="town-prompt-gift-label">{life.court[nearResident]?.married ? 'Gia đình' : 'Hẹn hò'}</span>
              </button>
            )}
            {nearResident && canGiftNear && near?.kind === 'resident' && prompt.id === nearResident && (
              <button type="button" className="btn btn-lg town-prompt-gift" onClick={() => setGifting(nearResident)} aria-label={tl`Tặng quà cho ${overview.places.find((p) => p.place.id === nearResident)?.place.resident ?? ''}`}>
                <Icon icon={Gift} size={18} />
                <span className="town-prompt-gift-label">Tặng quà</span>
              </button>
            )}
          </div>
        )}

        {showHurry && (
          <div className="town-prompt">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => {
                stage.current?.hurry();
                stage.current?.focus();
              }}
            >
              <Icon icon={FastForward} size={18} />
              Đến ngay
            </button>
          </div>
        )}

        {/* on a phone a cheer would cover the two who talk (the panel leaves only a strip): it waits for the talk to end */}
        <Celebrations paused={!townReady || (narrow && !!shownTalk)} onShow={onCelebrate} />
        {carried && !talk && !shownActivity && (
          <Suspense fallback={null}>
            <DeliveryChip onOpen={(id) => openActivity(id, 'hud')} />
          </Suspense>
        )}

        <p className="town-toast" role="status">
          {toast && !talk ? <span className="town-toast-box">{toast}</span> : null}
        </p>

        {shownBuild && <BuildSheet overview={overview} wanted={shownBuild.wanted} onBuy={onBuy} onClose={closeBuild} />}
        {!flat && townReady && !map && !showWelcome && <MiniMap stage={stage} state={state} hint={suggested ? suggested.place.id : null} theme={theme} onOpen={() => openMap('stage')} />}
        {map && <Suspense fallback={null}><TownMap stage={stage} start={mapStart} places={overview.places} state={state} hint={suggested ? (suggested.place.id as PlaceId) : null} theme={theme} leaving={map === 'leaving'} onClose={closeMap} onTravel={travel} onJournal={(id) => {
              closeMap();
              setJournalFor(id);
              openActivity('journal', 'hud');
            }} /></Suspense>}

        {shownActivity && (
          <ActivityHost
            key={shownActivity}
            id={shownActivity}
            onClose={closeActivity}
            onReward={onReward}
            sound={ui.sound}
            onFish={onFish}
            focus={shownActivity === 'listen' ? listenAt : shownActivity === 'season' ? (listenAt?.replace(/^season:/, '') ?? null) : journalFor}
            onTalk={(id) => {
              closeActivity();
              goTalk(id);
            }}
            onOpen={(id) => openActivity(id, 'hud')}
            onScene={onScene}
            onSceneEnd={onSceneEnd}
            onListen={onListen}
            onSpeaking={setListenSpeaking}
            onTravel={toCity}
            companions={busCompanions}
          />
        )}
        {shownGift && <GiftSheet placeId={shownGift} onClose={closeGift} onGiven={(r, v) => onGiven(r, v, shownGift)} onShop={giftToShop} />}
        {greet.greeting && !talk && <GreetBubble stage={stage} greet={greet} />}

        {shownTalk?.kind === 'quick' && (
          <Conversation
            street={streetView}
            onInvite={() => {
              const id = shownTalk.place.id;
              endTalk();
              startTalk(id);
            }}
            key={shownTalk.key}
            place={panelPlace ?? shownTalk.place}
            turns={shownTalk.turns}
            met={shownTalk.met}
            friend={talkView?.friend ?? NO_FRIEND}
            onJournal={() => journalFromTalk(shownTalk.place.id)}
            onGiven={(r, v) => onGiven(r, v, shownTalk.place.id)}
            onShop={() => {
              endTalk();
              openActivity('gifts', 'hud');
            }}
            onSpeaking={onSpeaking}
            onAnswered={onAnswered}
            onFinished={onFinished}
            onLeave={endTalk}
            onAgain={() => startTalk(shownTalk.place.id, false, shownTalk.street ? 'street' : 'place')}
          />
        )}
        {shownTalk?.kind === 'episode' && (
          <Episode
            key={shownTalk.key}
            place={panelPlace ?? shownTalk.place}
            start={shownTalk.start}
            friend={talkView?.friend ?? NO_FRIEND}
            onJournal={() => journalFromTalk(shownTalk.place.id)}
            onGiven={(r, v) => onGiven(r, v, shownTalk.place.id)}
            onShop={() => {
              endTalk();
              openActivity('gifts', 'hud');
            }}
            onSpeaking={onStorySpeaking}
            onVisitor={setVisitorIn}
            onAnswered={onAnswered}
            onGist={onGist}
            onFinished={onEpisodeFinished}
            onLeave={endTalk}
            onQuick={() => startTalk(shownTalk.place.id, true)}
          />
        )}
      </TownStage3D>

      <details className="how">
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Thị trấn này để làm gì?
        </summary>
        <div className="stack-sm town-how">
          <p>
            Để bạn có thêm một lý do nghe tiếng Anh nói nhanh mỗi ngày. Người dân nói một câu, bạn không thấy chữ, chỉ nghe rồi chọn nghĩa. Xu chỉ đến từ việc hiểu câu đó:
            nghe một lần mà hiểu thì được nhiều nhất, không mua được bằng cách nào khác.
          </p>
          <p>
            Người dân còn kể chuyện theo từng tập: bạn nghe cả đoạn một lần để nắm ý chính, rồi nghe từng câu, rồi nghe lại liền mạch. Sau 1, 3, 7 và 21 ngày họ kể lại để bạn
            nghe lại, vì nghe lại đúng lúc thì mới nhớ lâu.
          </p>
          <p>
            Nói thật với nhau: giọng trong app rõ hơn người thật nhiều, và chọn 1 trong 3 nghĩa dễ hơn hẳn việc tự nghe ra ngoài đời. Xây xong cả thị trấn nghĩa là bạn đã quen
            tai với {overview.totals.total} câu này, chưa phải nghe được phim hay người bản xứ. Việc đó vẫn cần nhiều giờ nghe tiếng Anh thật.
          </p>
          <p>
            Vì vậy mỗi lần trò chuyện có một câu không cho chọn nghĩa mà bắt gõ lại cụm vừa nghe. Câu nào có thể thì một nghĩa sai là nghĩa của một câu nghe gần giống
            (can với can’t, him với them…), để đoán mò không còn dễ trúng.
          </p>
          {typedMeasure && <p>{typedMeasure}</p>}
        </div>
      </details>
    </div>
  );
}
