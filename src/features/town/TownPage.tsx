import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Footprints, Hammer, LoaderCircle, MessageCircle, RotateCcw, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { parseHash } from '../../core/nav';
import { useSettings } from '../../core/settings';
import { resolveTheme, systemPrefersDark } from '../../core/theme';
import { lineProgress } from '../../core/town/progress';
import { buyTownItem, loadTownProgress, startTownConversation, useTownOverview, type TownAnswerResult, type TownTurn } from '../../core/town/store';
import type { TownPlace } from '../../core/town/types';
import { PLACE_IDS, type PlaceId } from '../../data/townWorld';
import { Portrait } from './art';
import BuildSheet from './BuildSheet';
import Conversation from './Conversation';
import TownStage, { type Near, type SafeInsets, type TownStageHandle, type TownTheme } from './engine/TownStage';
import { lotLabel, lotLabelsOf, lotsOnOffer, stageStateOf, suggestedPlace, talkLabel, talkStartTile, xu, type Verdict } from './shellModel';
import { playSfx } from './sfx';
import TownHud from './TownHud';
import { inertOutside } from './inertOutside';
import { setTownUi, useTownUi } from './townUi';
import { useTownArt } from './useTownArt';
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

interface Talk {
  /** A new number for every conversation: the panel starts afresh. */
  key: number;
  place: TownPlace;
  turns: TownTurn[];
  met: boolean[];
}

const TOAST_MS = 4200;

/**
 * Begin a conversation at a place (core/town/store): its five lines with their meanings, and for each line
 * whether the learner had answered it before. Null for an empty lot or an unknown place.
 */
function beginTalk(placeId: string, key: number): Talk | null {
  const progress = loadTownProgress();
  const r = startTownConversation(placeId);
  if (!r.ok) return null;
  return { key, place: r.place, turns: r.turns, met: r.turns.map((t) => (lineProgress(progress, t.line.id)?.tries ?? 0) > 0) };
}

/**
 * "Thị trấn": a small town the learner walks around. Its residents SAY a sentence (never shown before the answer)
 * and the learner picks what it meant; understanding pays xu, and xu build the town. The world is one canvas
 * (engine/); this page is the game around it: the counters over it, the conversation, the build panel.
 */
export default function TownPage() {
  const theme = useTownTheme();
  const overview = useTownOverview();
  const ui = useTownUi();
  const stage = useRef<TownStageHandle>(null);
  const xuRef = useRef<HTMLSpanElement>(null);
  const buildBtnRef = useRef<HTMLButtonElement>(null);
  const art = useTownArt();

  // #/town?talk=<placeId> opens straight into a conversation; #/town?build=<placeId | 1> opens the build panel
  const [params] = useState(() => parseHash(window.location.hash).params);
  const [linked] = useState<PlaceId | null>(() => (isPlaceId(params.talk) && overview.places.some((p) => p.place.id === params.talk && p.built) ? params.talk : null));
  const startAt = useMemo(() => (linked ? talkStartTile(linked) : undefined), [linked]);

  const talkCount = useRef(0);
  const [talk, setTalk] = useState<Talk | null>(() => (linked ? beginTalk(linked, 0) : null));
  // a link to talk at a place that is still an empty lot lands on the build panel, on that lot
  const [build, setBuild] = useState<{ wanted: string | null } | null>(() => {
    if (params.build) return { wanted: isPlaceId(params.build) ? params.build : null };
    return isPlaceId(params.talk) && !linked ? { wanted: params.talk } : null;
  });
  const [near, setNear] = useState<Near>(null);
  const [speaking, setSpeaking] = useState(false);
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
  const state = useMemo(() => stageStateOf(overview, theme), [overview, theme]);
  const lotLabels = useMemo(() => lotLabelsOf(overview), [overview]);
  const suggested = useMemo(() => suggestedPlace(overview.places), [overview.places]);

  // ───────────────────────── a conversation ─────────────────────────

  const startTalk = useCallback((placeId: string) => {
    talkCount.current += 1;
    const next = beginTalk(placeId, talkCount.current);
    if (!next) {
      // an empty lot has nobody to talk to yet: offer to build it
      if (!overviewRef.current.places.find((p) => p.place.id === placeId)?.built) setBuild({ wanted: placeId });
      return;
    }
    setBuild(null);
    setToast(null);
    setTownUi({ welcomed: true });
    setTalk(next);
    stage.current?.focusOn(placeId as PlaceId);
    stage.current?.act('player', 'wave');
  }, []);

  const endTalk = useCallback(() => {
    setTalk(null);
    setSpeaking(false);
    stage.current?.focusOn(null);
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

  // a linked conversation was begun with the first render; it shows (and the stage leans in) once the pictures are there
  const artReady = art.status === 'ready';
  const leaned = useRef(false);
  useEffect(() => {
    if (!linked || !artReady || leaned.current) return;
    leaned.current = true;
    setTownUi({ welcomed: true });
    stage.current?.focusOn(linked);
    stage.current?.act('player', 'wave');
  }, [linked, artReady]);

  /** Walk up to a resident, then talk. */
  const goTalk = useCallback(
    (placeId: string) => {
      if (!stage.current?.walkTo(placeId as PlaceId, () => startTalk(placeId))) startTalk(placeId);
    },
    [startTalk],
  );

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

  const onSpeaking = useCallback((on: boolean) => setSpeaking(on), []);

  // ───────────────────────── building ─────────────────────────

  const openBuild = useCallback((wanted: string | null) => {
    setTownUi({ welcomed: true });
    setBuild({ wanted });
  }, []);
  const closeBuild = useCallback(() => {
    setBuild(null);
    buildBtnRef.current?.focus({ preventScroll: true });
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

  const nearPlace = near ? overview.places.find((p) => p.place.id === near.placeId) : undefined;
  const prompt: { icon: typeof Hammer; text: string; build: boolean; id: string } | null =
    near?.kind === 'resident' && nearPlace?.built
      ? { icon: MessageCircle, text: `Bắt chuyện với ${nearPlace.place.resident}`, build: false, id: nearPlace.place.id }
      : near?.kind === 'lot' && nearPlace && !nearPlace.built
        ? { icon: Hammer, text: `Xây ${nearPlace.place.name} · ${xu(nearPlace.cost)}`, build: true, id: nearPlace.place.id }
        : suggested
          ? { icon: Footprints, text: `Tới gặp ${suggested.place.resident}`, build: false, id: suggested.place.id }
          : null;
  const promptId = prompt?.id;
  const promptBuilds = prompt?.build ?? false;
  const runPrompt = useCallback(() => {
    if (!promptId) return;
    if (promptBuilds) openBuild(promptId);
    else goTalk(promptId);
  }, [promptId, promptBuilds, openBuild, goTalk]);
  const onIdleAct = useCallback(() => {
    if (suggested) goTalk(suggested.place.id);
  }, [suggested, goTalk]);

  const hasPlayed = overview.totals.understood > 0 || overview.playedToday || overview.earned > 0;
  // Until the pictures are there the town is on hold: no conversation or build panel over an empty sky (a link to
  // one opens once they load), no input, and the loading card (or its "Thử lại") is the only thing to do.
  const shownTalk = artReady ? talk : null;
  const shownBuild = artReady && !talk ? build : null;
  const showWelcome = artReady && !ui.welcomed && !hasPlayed && !talk && !build;
  const stageBox = useCallback(() => stage.current?.box() ?? null, []);
  const fullStage = useFullStage(stageBox, !!shownTalk || !!shownBuild);
  const showPrompt = artReady && !talk && !build && !!prompt;
  const insets = useStageInsets(stageBox, `${shownTalk?.key ?? '-'}|${shownBuild ? 'b' : '-'}|${fullStage.full ? 'f' : '-'}|${showPrompt ? 'p' : '-'}|${showWelcome ? 'w' : '-'}|${art.status}`);
  // the build panel shows its lot in the town: the one asked for, or else the first one on offer
  const peekLot = shownBuild ? ((shownBuild.wanted && overview.places.some((p) => p.place.id === shownBuild.wanted && !p.built) ? shownBuild.wanted : lotsOnOffer(overview.places)[0]) ?? null) as PlaceId | null : null;
  // on a phone every line of text above the town costs a row of the town
  const [narrow] = useState(narrowStage);
  const talkView = talk ? overview.places.find((p) => p.place.id === talk.place.id) : undefined;

  return (
    <div className="stack-lg page-browse town-page">
      <PageHeader
        title="Thị trấn"
        subtitle={narrow ? undefined : 'Nghe người dân nói, hiểu là có xu để xây thêm thị trấn.'}
        help={
          <ShortcutsHelp
            items={[
              { keys: ['← ↑ ↓ →'], text: 'Đi quanh thị trấn (W A S D cũng được)' },
              { keys: ['E'], text: 'Bắt chuyện với người đứng cạnh (Enter cũng được)' },
              { keys: ['1–3'], text: 'Chọn nghĩa của câu vừa nghe' },
              { keys: ['R'], text: 'Nghe lại câu' },
              { keys: ['Enter'], text: 'Câu tiếp' },
              { keys: ['Esc'], text: 'Rời cuộc trò chuyện, đóng bảng xây' },
            ]}
          />
        }
      />

      <TownStage
        ref={stage}
        state={state}
        onTalk={startTalk}
        onLot={openBuild}
        onNear={setNear}
        onIdleAct={onIdleAct}
        speaking={speaking && shownTalk ? (shownTalk.place.id as PlaceId) : null}
        inset={insets.panel}
        safe={insets.safe}
        hint={!talk && suggested ? (suggested.place.id as PlaceId) : null}
        peek={!talk ? peekLot : null}
        full={fullStage.full}
        paused={!!talk || !artReady}
        lotLabels={lotLabels}
        startAt={startAt}
        className={[shownTalk ? 'is-talking' : shownBuild ? 'is-building' : '', fullStage.full ? 'is-full' : ''].filter(Boolean).join(' ') || undefined}
        label="Thị trấn nhìn từ trên cao. Dùng danh sách nút ngay sau đây để tới gặp từng người hoặc xây từng nơi."
      >
        <ul className="town-actions" aria-label="Việc làm được trong thị trấn">
          {overview.places.map((p) => (
            <li key={p.place.id}>
              {p.built ? (
                <button type="button" className="town-action" onClick={() => goTalk(p.place.id)} disabled={!!talk || !artReady}>
                  {talkLabel(p)}
                </button>
              ) : (
                <button type="button" className="town-action" onClick={() => openBuild(p.place.id)} disabled={!!talk || !artReady}>
                  {lotLabel(p)}
                </button>
              )}
            </li>
          ))}
        </ul>

        <TownHud overview={overview} sound={ui.sound} onSound={(on) => setTownUi({ sound: on })} onBuild={() => (build ? closeBuild() : artReady && openBuild(null))} buildOpen={!!shownBuild} xuRef={xuRef} buildRef={buildBtnRef} full={fullStage.full} onFull={fullStage.toggle} />

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

        {art.status !== 'ready' && (
          <div className="town-loading" role={art.status === 'error' ? 'alert' : 'status'}>
            {art.status === 'error' ? (
              <>
                <p className="town-loading-text">
                  {/* the portable copy opened from disk loads its pictures from the "art" folder next to the HTML */}
                  {window.location.protocol === 'file:'
                    ? 'Không tải được hình của thị trấn. Thư mục "art" phải nằm cạnh file HTML, rồi thử lại nhé.'
                    : 'Không tải được hình của thị trấn. Kiểm tra mạng rồi thử lại nhé.'}
                </p>
                <button type="button" className="btn btn-primary" onClick={art.retry}>
                  <Icon icon={RotateCcw} size={16} />
                  Thử lại
                </button>
              </>
            ) : (
              <p className="town-loading-text">
                <Icon icon={LoaderCircle} size={18} className="icon-spin" />
                Đang dựng thị trấn…
              </p>
            )}
          </div>
        )}

        {showPrompt && prompt && (
          <div className="town-prompt">
            <button type="button" className="btn btn-primary btn-lg" onClick={runPrompt} aria-keyshortcuts="E">
              <Icon icon={prompt.icon} size={18} />
              {prompt.text}
            </button>
          </div>
        )}

        <p className="town-toast" role="status">
          {toast && !talk ? <span className="town-toast-box">{toast}</span> : null}
        </p>

        {shownBuild && <BuildSheet overview={overview} wanted={shownBuild.wanted} onBuy={onBuy} onClose={closeBuild} />}

        {shownTalk && (
          <Conversation
            key={shownTalk.key}
            place={shownTalk.place}
            turns={shownTalk.turns}
            met={shownTalk.met}
            hearts={talkView?.hearts ?? 0}
            onSpeaking={onSpeaking}
            onAnswered={onAnswered}
            onFinished={onFinished}
            onLeave={endTalk}
            onAgain={() => startTalk(shownTalk.place.id)}
          />
        )}
      </TownStage>

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
            Nói thật với nhau: giọng trong app rõ hơn người thật nhiều, và chọn 1 trong 3 nghĩa dễ hơn hẳn việc tự nghe ra ngoài đời. Xây xong cả thị trấn nghĩa là bạn đã quen
            tai với {overview.totals.total} câu này, chưa phải nghe được phim hay người bản xứ. Việc đó vẫn cần nhiều giờ nghe tiếng Anh thật.
          </p>
          <p className="town-credit">Hình nhân vật và nhà cửa: Kenney (kenney.nl), giấy phép CC0.</p>
        </div>
      </details>
    </div>
  );
}
