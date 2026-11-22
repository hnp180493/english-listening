import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Footprints, Gift, Hammer, MessageCircle, Sparkles, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { prefersReducedMotion } from '../../core/motion';
import { hrefFor, parseHash } from '../../core/nav';
import { useSettings } from '../../core/settings';
import { resolveTheme, systemPrefersDark } from '../../core/theme';
import { lineProgress, typedTotals } from '../../core/town/progress';
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
import { PLACE_IDS, TOWN_WORLD, type PlaceId } from '../../data/townWorld';
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
import type { FishStagePhase, MapSnapshot, Near, SafeInsets, TownStageHandle, TownTheme, TravelMode, TravelTarget } from './engine/stage';
import MiniMap from './map/MiniMap';
import TownMap from './map/TownMap';
import { playerStand, type StorySetting } from './engine/staging';
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
import { inertOutside } from './inertOutside';
import { getTownUi, setTownUi, useTownUi } from './townUi';
import './town.css';

/** The town follows the app's theme: night in the dark theme, day in the light one. */
function useTownTheme(): TownTheme {
  const pref = useSettings().theme;
  const [dark, setDark] = useState(systemPrefersDark);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setDark(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return resolveTheme(pref, dark) === 'dark' ? 'night' : 'day';
}

const isPlaceId = (id: string | undefined): id is PlaceId => !!id && (PLACE_IDS as readonly string[]).includes(id);

/** A sheet that covers the whole width (a phone): buying closes it so the new thing can be seen. */
function narrowStage(): boolean {
  try {
    return window.matchMedia('(max-width: 720px)').matches;
  } catch {
    return false;
  }
}

/** Full screen was chosen: kept for this session only (a visit of another page and back keeps it, a reload does not). */
let fullChosen = false;

/**
 * "Toàn màn hình": the stage covers the whole window. The Fullscreen API when the browser has it for an element
 * (it also hides the browser's bars), and in any case a fixed overlay through CSS (`is-full`), which is all an
 * iPhone gets. Esc leaves (the browser's own Esc, or ours for the overlay when no panel is open).
 */
function useFullStage(box: () => HTMLElement | null, panelOpen: boolean): { full: boolean; toggle: () => void } {
  const [full, setFull] = useState(() => fullChosen);
  const viaApi = useRef(false);

  const set = useCallback(
    (on: boolean) => {
      fullChosen = on;
      setFull(on);
      const el = box();
      if (on) {
        if (el && typeof el.requestFullscreen === 'function' && document.fullscreenEnabled && !document.fullscreenElement) {
          viaApi.current = true;
          el.requestFullscreen().catch(() => {
            // refused (no user gesture, a policy): the overlay alone does the job
            viaApi.current = false;
          });
        }
      } else if (document.fullscreenElement) {
        viaApi.current = false;
        document.exitFullscreen().catch(() => undefined);
      }
    },
    [box],
  );
  const toggle = useCallback(() => set(!fullChosen), [set]);

  // the browser left full screen by itself (its own Esc, a gesture): the overlay goes too
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) return;
      if (viaApi.current) {
        viaApi.current = false;
        fullChosen = false;
        setFull(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Esc closes a panel first; with none open it leaves full screen
  const panelRef = useRef(panelOpen);
  useEffect(() => {
    panelRef.current = panelOpen;
  }, [panelOpen]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || panelRef.current) return;
      if (e.target instanceof HTMLElement && e.target.closest('[data-popover], [role="dialog"]')) return;
      e.preventDefault();
      set(false);
    };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('town-full-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('town-full-open');
    };
  }, [full, set]);

  // the page under the overlay is still there: the keyboard and the screen reader stay in the town until it ends
  useEffect(() => {
    if (!full) return;
    const el = box();
    if (!el) return;
    const undo = inertOutside(el, document.body);
    if (!el.contains(document.activeElement)) el.querySelector<HTMLElement>('canvas')?.focus({ preventScroll: true });
    return undo;
  }, [full, box]);

  // leaving the page leaves full screen (the overlay is gone with the stage)
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    },
    [],
  );
  return { full, toggle };
}

const NO_FRIEND: FriendView = { placeId: '', points: 0, hearts: 0, toNext: 100, part: 0, title: '' };

const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const sameInsets = (a: SafeInsets, b: SafeInsets) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

/**
 * What the game's own chrome covers on the stage, measured on the page: the counters along the top, the column of
 * buttons down the right edge of a phone, the main button at the bottom, and an open panel (the conversation at the
 * bottom or docked to the side, the build sheet). The stage keeps its name tags out of `safe` and centres what the
 * camera looks at in what is left of `panel`.
 */
function useStageInsets(box: () => HTMLElement | null, key: string): { safe: SafeInsets; panel: { right: number; bottom: number } } {
  const [safe, setSafe] = useState<SafeInsets>(NO_INSETS);
  const [panel, setPanel] = useState({ right: 0, bottom: 0 });
  useLayoutEffect(() => {
    const stage = box();
    if (!stage) return;
    const measure = () => {
      const sr = stage.getBoundingClientRect();
      if (sr.width < 1) return;
      const next = { ...NO_INSETS };
      // the counters along the top count in a conversation too: the two people's heads must stay below them
      const level = stage.querySelector('.town-level')?.getBoundingClientRect();
      if (level && level.height > 0) next.top = Math.round(level.bottom - sr.top + 6);
      const coins = stage.querySelector('.town-hud-counts')?.getBoundingClientRect();
      if (coins && coins.height > 0) next.top = Math.max(next.top, Math.round(coins.bottom - sr.top + 6));
      const btns = stage.querySelector('.town-hud-btns')?.getBoundingClientRect();
      if (btns && btns.height > 0) {
        // a column down the right edge (a phone), or part of the top row
        if (btns.height > btns.width) next.right = Math.round(sr.right - btns.left + 6);
        else next.top = Math.max(next.top, Math.round(btns.bottom - sr.top + 6));
      }
      const prompt = stage.querySelector('.town-prompt .btn')?.getBoundingClientRect();
      if (prompt) next.bottom = Math.round(sr.bottom - prompt.top + 6);
      // Leo's first words: the player and Leo stand above the card, not under it
      const welcome = stage.querySelector('.town-welcome')?.getBoundingClientRect();
      if (welcome) next.bottom = Math.max(next.bottom, Math.round(sr.bottom - welcome.top + 6));
      setSafe((old) => (sameInsets(old, next) ? old : next));
      const open = stage.querySelector<HTMLElement>('.town-talk, .town-build');
      let p = { right: 0, bottom: 0 };
      if (open) {
        const r = open.getBoundingClientRect();
        // docked to a side (starting right of the stage's first third, near its top) or along the bottom
        p = r.left - sr.left > sr.width * 0.3 && r.top - sr.top < sr.height * 0.3 ? { right: Math.round(sr.right - r.left + 12), bottom: 0 } : { right: 0, bottom: Math.round(sr.bottom - r.top + 12) };
      }
      setPanel((old) => (old.right === p.right && old.bottom === p.bottom ? old : p));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(stage);
    const watched = stage.querySelectorAll('.town-hud, .town-talk, .town-build, .town-prompt, .town-welcome');
    watched.forEach((el) => ro?.observe(el));
    return () => ro?.disconnect();
  }, [box, key]);
  return { safe, panel };
}

type Talk =
  | {
      kind: 'quick';
      /** A new number for every conversation: the panel starts afresh. */
      key: number;
      place: TownPlace;
      turns: TownTurn[];
      met: boolean[];
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
 * answered it before. `quick`: the quick chat whatever waits. Null for an empty lot or an unknown place.
 */
function beginTalk(placeId: string, key: number, quick = false): Talk | null {
  if (!quick) {
    const e = startTownEpisode(placeId);
    if (e.ok) return { kind: 'episode', key, place: e.place, start: e };
  }
  const progress = loadTownProgress();
  const r = startTownConversation(placeId);
  if (!r.ok) return null;
  return { kind: 'quick', key, place: r.place, turns: r.turns, met: r.turns.map((t) => (lineProgress(progress, t.line.id)?.tries ?? 0) > 0) };
}

/**
 * Where a talk happens now (docs/town.md §9 "Where it happens"): an episode's setting (its lodger setting while the
 * place is not built), or the quick chat's.
 */
function talkSetting(t: Talk, places: readonly TownPlaceView[]): StorySetting {
  const built = (id: string) => places.some((p) => p.place.id === id && p.built);
  return t.kind === 'episode' ? episodeSetting(t.start.episode, built) : quickChatSetting(t.place.id, built);
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
                  {p.episode ? ` · ${p.episode.mode === 'relisten' ? 'Nghe lại tập' : 'Tập'} ${p.episode.order}: ${p.episode.title}` : ''}
                  {!p.episode && p.friendEpisode ? ` · Tập ${p.friendEpisode.order}: ${lockText(p.friendEpisode, p.place.resident).toLowerCase()}` : ''}
                  {p.friend.hearts > 0 ? ` · ${p.friend.hearts} tim` : ''}
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
export default function TownPage() {
  const theme = useTownTheme();
  const overview = useTownOverview();
  // the town's one real measure (docs/town.md §13), shown only in "Thị trấn này để làm gì?"
  const typedMeasure = typedMeasureText(typedTotals(useTownProgress()));
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
  const [near, setNear] = useState<Near>(null);
  // an activity's panel is open (the pier, the farm field, the egg kiosk, the wardrobe, the album)
  // ?activity=<id> (e.g. Ôn tập's "Về nông trại") opens that panel once the town is drawn
  const [activity, setActivity] = useState<ActivityId | null>(() => ACTIVITIES.find((a) => a.id === params.activity)?.id ?? null);
  /** The Sổ tay opens at this resident's page (their hearts in a conversation's header, the map card); null: the list. */
  const [journalFor, setJournalFor] = useState<string | null>(null);
  /** "Tặng quà" standing next to a resident: the gift sheet for them. */
  const [gifting, setGifting] = useState<PlaceId | null>(null);
  /** Where focus goes back to when the activity's panel closes: the HUD's "Chơi" when it was opened from there. */
  const activityFrom = useRef<'hud' | 'stage'>('stage');
  // who speaks now in a conversation: the resident's place id, 'player' (an episode's own lines), or null
  const [speaking, setSpeaking] = useState<string | null>(null);
  // an episode's neighbour who drops in is in the room (Episode.tsx: from their first line of each pass)
  const [visitorIn, setVisitorIn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
  // the farm field in the world shows the learner's review cards (the same field the farm's panel reads)
  const farmField = useTownFarm().field;
  const farmKey = fieldLook(farmField, FARM_LOOK_SLOTS).slots.join(',');
  const farm = useMemo(() => farmKey.split(',') as CropStage[], [farmKey]);
  const state = useMemo(() => ({ ...stageStateOf(overview, theme), look, extraDecor, farm }), [overview, theme, look, extraDecor, farm]);
  const lotLabels = useMemo(() => lotLabelsOf(overview), [overview]);
  const suggested = useMemo(() => suggestedPlace(overview.places), [overview.places]);

  // ───────────────────────── a conversation ─────────────────────────

  /**
   * Talk to a resident (a click on them or their house, E beside them, the main button, the hidden list): what the
   * talk is decides where it happens (talkSetting), the stage takes both there (docs/town.md §7 "Staging": a walk to
   * the room's door and a dip into the room, or a walk to the place's front), and the panel opens once they are in
   * place. Until then a click elsewhere or the keys give the talk up (onTalkCancel), Esc too.
   */
  const startTalk = useCallback((placeId: string, quick = false) => {
    talkCount.current += 1;
    const next = beginTalk(placeId, talkCount.current, quick);
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
  const closeActivity = useCallback(() => {
    setActivity(null);
    setJournalFor(null);
    // a panel opened from the address (?activity=farm) must not reopen on a reload
    if (parseHash(window.location.hash).params.activity) {
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
    const then = target.kind === 'activity' ? () => openActivity(target.id) : undefined;
    const warped = mode === 'warp' && s.travelTo(target, 'warp', then);
    if (!warped) s.travelTo(target, 'walk', then);
    if (warped && !prefersReducedMotion()) {
      setMap('leaving');
      mapTimer.current = window.setTimeout(() => setMap(null), 320);
    } else setMap(null);
    s.focus();
  }, [openActivity]);
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
      const said = place ? `Đã xây ${place.name}. ${place.resident} vừa dọn tới!` : `Đã thêm ${r.item.name} cho thị trấn.`;
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

  // ───────────────────────── what the one button at the bottom offers ─────────────────────────

  const nearPlace = near && near.kind !== 'activity' ? overview.places.find((p) => p.place.id === near.placeId) : undefined;
  const nearActivity = near?.kind === 'activity' ? ACTIVITIES.find((a) => a.id === near.id) : undefined;
  const prompt: { icon: typeof Hammer; text: string; build: boolean; id: string; activity?: ActivityId } | null = nearActivity
    ? { icon: Sparkles, text: nearActivity.name, build: false, id: nearActivity.id, activity: nearActivity.id }
    : near?.kind === 'resident' && nearPlace
      ? { icon: MessageCircle, text: talkPrompt(nearPlace, true), build: false, id: nearPlace.place.id }
      : near?.kind === 'lot' && nearPlace && !nearPlace.built
        ? { icon: Hammer, text: `Xây ${nearPlace.place.name} · ${xu(nearPlace.cost)}`, build: true, id: nearPlace.place.id }
        : suggested
          ? { icon: Footprints, text: talkPrompt(suggested, false), build: false, id: suggested.place.id }
          : null;
  const promptId = prompt?.id;
  const promptBuilds = prompt?.build ?? false;
  const promptActivity = prompt?.activity ?? null;
  const runPrompt = useCallback(() => {
    if (!promptId) return;
    if (promptActivity) openActivity(promptActivity);
    else if (promptBuilds) openBuild(promptId);
    else goTalk(promptId);
  }, [promptId, promptBuilds, promptActivity, openActivity, openBuild, goTalk]);
  const onIdleAct = useCallback(() => {
    if (suggested) goTalk(suggested.place.id);
  }, [suggested, goTalk]);

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
  const showPrompt = townReady && !talk && !build && !activity && !map && !gifting && !!prompt;
  // "Tặng quà" beside the main button, standing next to a resident with a gift in hand (one a day each)
  const nearResident = near?.kind === 'resident' ? near.placeId : null;
  const canGiftNear = useCanGift(nearResident);
  // a resident greets the player who stops beside them, in free play only (friends/useGreeting)
  const greetFree = townReady && !flat && !talk && !build && !activity && !map && !gifting && !showWelcome && ui.greet && ui.sound;
  const greet = useGreeting(near, greetFree, useCallback((id: PlaceId) => stage.current?.act(id, 'wave'), []));
  const greetSpeaking = greet.greeting && greet.sounding ? greet.greeting.placeId : null;
  const insets = useStageInsets(stageBox, `${shownTalk?.key ?? '-'}|${shownBuild ? 'b' : shownActivity ? 'a' + shownActivity : '-'}|${fullStage.full ? 'f' : '-'}|${showPrompt ? 'p' : '-'}|${showWelcome ? 'w' : '-'}|${shownGift ?? '-'}|${townReady ? 'r' : '-'}|${flat ? 'flat' : '3d'}`);
  // on a phone every line of text above the town costs a row of the town
  const [narrow] = useState(narrowStage);
  const talkView = talk ? overview.places.find((p) => p.place.id === talk.place.id) : undefined;
  // the panel names where the talk happens ("Grace · Nhà trọ" while she lodges there, "Ben · Quảng trường" at his stall)
  const shownPlace = shownTalk?.place;
  const panelPlace = useMemo(() => {
    if (!talk || !shownPlace) return undefined;
    const setting = talkSetting(talk, overview.places);
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
        onTalk={startTalk}
        onTalkCancel={dropTalk}
        onLot={openBuild}
        onNear={setNear}
        onIdleAct={onIdleAct}
        onActivity={openActivity}
        onReady={onStageReady}
        onFail={onStageFail}
        speaking={shownTalk ? speaking : greetSpeaking}
        visitorIn={visitorIn}
        inset={insets.panel}
        safe={insets.safe}
        hint={!talk && suggested ? (suggested.place.id as PlaceId) : null}
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
            {nearResident && canGiftNear && near?.kind === 'resident' && prompt.id === nearResident && (
              <button type="button" className="btn btn-lg town-prompt-gift" onClick={() => setGifting(nearResident)} aria-label={`Tặng quà cho ${overview.places.find((p) => p.place.id === nearResident)?.place.resident ?? ''}`}>
                <Icon icon={Gift} size={18} />
                <span className="town-prompt-gift-label">Tặng quà</span>
              </button>
            )}
          </div>
        )}

        {/* on a phone a cheer would cover the two who talk (the panel leaves only a strip): it waits for the talk to end */}
        <Celebrations paused={!townReady || (narrow && !!shownTalk)} onShow={onCelebrate} />

        <p className="town-toast" role="status">
          {toast && !talk ? <span className="town-toast-box">{toast}</span> : null}
        </p>

        {shownBuild && <BuildSheet overview={overview} wanted={shownBuild.wanted} onBuy={onBuy} onClose={closeBuild} />}
        {!flat && townReady && !map && !showWelcome && <MiniMap stage={stage} state={state} hint={suggested ? suggested.place.id : null} theme={theme} onOpen={() => openMap('stage')} />}
        {map && <TownMap stage={stage} start={mapStart} overview={overview} state={state} hint={suggested ? (suggested.place.id as PlaceId) : null} theme={theme} leaving={map === 'leaving'} onClose={closeMap} onTravel={travel} onJournal={(id) => {
              closeMap();
              setJournalFor(id);
              openActivity('journal', 'hud');
            }} />}

        {shownActivity && (
          <ActivityHost
            key={shownActivity}
            id={shownActivity}
            onClose={closeActivity}
            onReward={onReward}
            sound={ui.sound}
            onFish={onFish}
            focus={journalFor}
            onTalk={(id) => {
              closeActivity();
              goTalk(id);
            }}
            onOpen={(id) => openActivity(id, 'hud')}
          />
        )}
        {shownGift && <GiftSheet placeId={shownGift} onClose={closeGift} onGiven={(r, v) => onGiven(r, v, shownGift)} onShop={giftToShop} />}
        {greet.greeting && !talk && <GreetBubble stage={stage} greet={greet} />}

        {shownTalk?.kind === 'quick' && (
          <Conversation
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
            onAgain={() => startTalk(shownTalk.place.id)}
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
