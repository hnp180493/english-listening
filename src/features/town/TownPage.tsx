import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Footprints, Hammer, MessageCircle, X } from 'lucide-react';
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
import TownStage, { type Near, type TownStageHandle, type TownTheme } from './engine/TownStage';
import { lotLabel, lotLabelsOf, stageStateOf, suggestedPlace, talkLabel, talkStartTile, xu, type Verdict } from './shellModel';
import { playSfx } from './sfx';
import TownHud from './TownHud';
import { setTownUi, useTownUi } from './townUi';
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
  const [panelH, setPanelH] = useState(0);
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
  }, []);

  const endTalk = useCallback(() => {
    setTalk(null);
    setSpeaking(false);
    setPanelH(0);
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

  // a linked conversation was begun with the first render: the stage only has to lean in
  useEffect(() => {
    if (!linked) return;
    setTownUi({ welcomed: true });
    stage.current?.focusOn(linked);
  }, [linked]);

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

  // the panel covers the bottom of the stage: the camera centres in what is left
  const panelObserver = useRef<ResizeObserver | null>(null);
  const panelRef = useCallback((el: HTMLElement | null) => {
    panelObserver.current?.disconnect();
    panelObserver.current = null;
    if (!el) return;
    const measure = () => setPanelH(Math.round(el.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      panelObserver.current = new ResizeObserver(measure);
      panelObserver.current.observe(el);
    }
  }, []);

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
      setToast(place ? `Đã xây ${place.name}. ${place.resident} vừa dọn tới!` : `Đã thêm ${r.item.name} cho thị trấn.`);
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
  const showWelcome = !ui.welcomed && !hasPlayed && !talk && !build;
  const inset = useMemo(() => ({ right: build && !talk ? 412 : 0, bottom: talk ? panelH + 12 : 0 }), [build, talk, panelH]);
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
        speaking={speaking && talk ? (talk.place.id as PlaceId) : null}
        inset={inset}
        paused={!!talk}
        lotLabels={lotLabels}
        startAt={startAt}
        className={talk ? 'is-talking' : build ? 'is-building' : undefined}
        label="Thị trấn nhìn từ trên cao. Dùng danh sách nút ngay sau đây để tới gặp từng người hoặc xây từng nơi."
      >
        <ul className="town-actions" aria-label="Việc làm được trong thị trấn">
          {overview.places.map((p) => (
            <li key={p.place.id}>
              {p.built ? (
                <button type="button" className="town-action" onClick={() => goTalk(p.place.id)} disabled={!!talk}>
                  {talkLabel(p)}
                </button>
              ) : (
                <button type="button" className="town-action" onClick={() => openBuild(p.place.id)} disabled={!!talk}>
                  {lotLabel(p)}
                </button>
              )}
            </li>
          ))}
        </ul>

        <TownHud overview={overview} sound={ui.sound} onSound={(on) => setTownUi({ sound: on })} onBuild={() => (build ? closeBuild() : openBuild(null))} buildOpen={!!build} xuRef={xuRef} buildRef={buildBtnRef} />

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

        {!talk && !build && prompt && (
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

        {build && !talk && <BuildSheet overview={overview} wanted={build.wanted} onBuy={onBuy} onClose={closeBuild} />}

        {talk && (
          <Conversation
            key={talk.key}
            onBox={panelRef}
            place={talk.place}
            turns={talk.turns}
            met={talk.met}
            hearts={talkView?.hearts ?? 0}
            onSpeaking={onSpeaking}
            onAnswered={onAnswered}
            onFinished={onFinished}
            onLeave={endTalk}
            onAgain={() => startTalk(talk.place.id)}
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
        </div>
      </details>
    </div>
  );
}
