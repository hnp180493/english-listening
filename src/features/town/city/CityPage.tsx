// Westbay, the city (docs/town.md §20, docs/city.md): the second map of the town's 3D stage, reached by bus no. 9.
// One job, as in the town: walk up to somebody, listen, understand. The city's people have STORIES in episodes
// (a scene of 12–18 lines between two or three people, three questions, then the words), each tied to somebody the
// learner already knows from the town; the people known have short talks; a town resident may be up here for the
// day; the benches, Gianna's radio and the bus are things to use, as in the town.
//
// The page is small on purpose: the stage, one button for what is beside the player, a sheet for what is heard, and
// "Người quen" (who has been met, who waits). No build panel, no shop, no map: the city adds no menu.

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BusFront, CircleHelp, Ear, Footprints, Maximize2, MessageCircle, Minimize2, Users, Volume2, VolumeX, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import PageHeader from '../../../components/PageHeader';
import ShortcutsHelp from '../../../components/ShortcutsHelp';
import { navigate } from '../../../core/nav';
import { nextToMeet, sceneNow, sceneOwner, visitorsNow, type SceneNow } from '../../../core/town/city';
import { CITY_PEOPLE, cityPerson } from '../../../core/town/cityPeople';
import { arriveInCity, loadTownCity, useTownCity } from '../../../core/town/cityStore';
import type { CityScene } from '../../../core/town/cityTypes';
import { balance } from '../../../core/town/economy';
import { partnerOf } from '../../../core/town/life';
import { useTownLife } from '../../../core/town/lifeStore';
import { useTownProgress } from '../../../core/town/store';
import { townToday } from '../../../core/town/worldStore';
import { CITY_OVERHEARD, CITY_SCENES } from '../../../data/city';
import { CITY_DECOR_ON, CITY_PLACE_IDS, cityWorldWith } from '../../../data/cityWorld';
import { TOWN_PLACES, townPlace } from '../../../data/town';
import { thingKind, type ActivitySpotId, type PlaceId } from '../../../data/townWorld';
import { getLang, tl } from '../../../i18n';
import { Coin } from '../art';
import type { Marker, Near, StageState, TownStageHandle } from '../engine/stage';
import { usePanelKeys } from '../panelKeys';
import { usePlayerOnStage } from '../playerStage';
import ListenPanel from '../scenes/ListenPanel';
import { listenTitle, thingPrompt } from '../scenes/things';
import { playSfx } from '../sfx';
import { narrowStage, useFullStage, useStageInsets, useTownTheme } from '../stageShell';
import TownStage3D from '../three/TownStage3D';
import { wantsFlat, webglAvailable } from '../three/webgl';
import { setTownUi, useTownUi } from '../townUi';
import './cityLooks';
import './cityPlaces3d';
import '../town.css';
import './city.css';

const CityScenePanel = lazy(() => import('./CityScenePanel'));
const CityPeople = lazy(() => import('./CityPeople'));

const TOWN_IDS: ReadonlySet<string> = new Set(TOWN_PLACES.map((p) => p.id));
const TOAST_MS = 4200;

/** Somebody's name: of the city, or a town resident up here. */
const nameOf = (id: string): string => cityPerson(id)?.name ?? townPlace(id)?.resident ?? '';

type Sheet = { kind: 'scene'; key: number; at: string; scene: CityScene; again: boolean } | { kind: 'thing'; key: number; id: ActivitySpotId } | { kind: 'people'; key: number };

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
  const [visitors, setVisitors] = useState<string[]>(() => visitorsNow(CITY_SCENES, loadTownCity(), today.weekday, TOWN_IDS));
  const guests = useMemo(() => [...new Set([...visitors, ...(partner && TOWN_IDS.has(partner) ? [partner] : [])])].sort(), [visitors, partner]);
  const guestKey = guests.join(',');
  // (the same object for the same guests: the stage is made again only when somebody new has come)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo(() => cityWorldWith(guests.map((id) => ({ id, name: townPlace(id)?.resident ?? '' }))), [guestKey]);
  useEffect(() => {
    setReady(false);
  }, [world]);

  const here = useCallback((at: string) => !!cityPerson(at) || guests.includes(at), [guests]);
  const suggested = useMemo(() => nextToMeet(CITY_SCENES, city, here), [city, here]);

  const state = useMemo<StageState>(() => {
    const marker: Record<string, Marker> = {};
    const lit: Record<string, number> = {};
    for (const id of [...CITY_PLACE_IDS, ...guests]) {
      const s = sceneNow(CITY_SCENES, id, city, now);
      if (s?.kind === 'new') marker[id] = s.scene.kind === 'episode' ? 'story' : 'new';
      else if (s?.kind === 'again') marker[id] = 'relisten';
      const own = CITY_SCENES.filter((x) => x.at === id);
      lit[id] = own.length ? own.filter((x) => Object.hasOwn(city.heard, x.id)).length / own.length : 0;
    }
    return { built: [...CITY_PLACE_IDS, ...guests, 'station'], decorations: CITY_DECOR_ON, lit, marker, theme, ...player };
  }, [city, guests, now, theme, player]);

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
      if (s?.kind === 'scene') {
        stage.current?.endListen();
        stage.current?.endTalk();
      }
      return null;
    });
    setArrived(null);
    setSpeaking(null);
    // a scene heard may have opened a story that needs somebody of the town up here
    setVisitors((old) => {
      const next = visitorsNow(CITY_SCENES, loadTownCity(), today.weekday, TOWN_IDS);
      return next.join(',') === old.join(',') ? old : next;
    });
    stage.current?.focus();
  }, [today.weekday]);

  const startScene = useCallback(
    (id: string) => {
      if (sheet) return;
      const s = sceneNow(CITY_SCENES, id, loadTownCity(), Date.now());
      if (!s) return;
      if (s.kind === 'locked') {
        const owner = sceneOwner(s.needs);
        setToast(tl`${nameOf(id)} chưa biết bạn là ai. Gặp ${nameOf(owner)} trước đã.`);
        if (here(owner)) stage.current?.walkTo(owner as PlaceId);
        return;
      }
      const key = ++keys.current;
      setWelcome(false);
      setSheet({ kind: 'scene', key, at: id, scene: s.scene, again: s.kind !== 'new' });
      const others = [...new Set(s.scene.lines.map((l) => l.who))].filter((w) => w !== id && here(w)) as PlaceId[];
      const inPlace = () => {
        stage.current?.joinTalk(id as PlaceId, others);
        setArrived(key);
      };
      // somebody of the city is talked to in front of their own place; a town resident up here, where they stand
      const staged = stage.current?.talkAt(id as PlaceId, cityPerson(id) ? { kind: 'outside', at: id as PlaceId } : { kind: 'here' }, {}, inPlace);
      if (!staged) setArrived(key);
    },
    [sheet, here],
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

  // ── the one button ──
  const nearId = near?.kind === 'resident' ? near.placeId : null;
  const nearNow = nearId ? sceneNow(CITY_SCENES, nearId, city, now) : null;
  const nearThing = near?.kind === 'activity' ? near.id : null;
  const prompt = nearThing
    ? { icon: thingKind(nearThing) === 'bus' ? BusFront : Ear, text: thingKind(nearThing) === 'bus' ? 'Lên xe số 9 về thị trấn' : (thingPrompt(nearThing) ?? ''), run: () => openThing(nearThing) }
    : nearId && nearNow
      ? { icon: MessageCircle, text: talkPrompt(nearId, nearNow), run: () => startScene(nearId) }
      : suggested
        ? { icon: Footprints, text: tl`Tới gặp ${nameOf(suggested.at)}`, run: () => void stage.current?.walkTo(suggested.at as PlaceId, () => startScene(suggested.at)) }
        : null;
  const promptRun = prompt?.run;
  const onIdleAct = useCallback(() => promptRun?.(), [promptRun]);

  const shownSheet = ready || flat ? sheet : null;
  const sceneUp = shownSheet?.kind === 'scene' && (arrived === shownSheet.key || flat) ? shownSheet : null;
  const stageBox = useCallback(() => stage.current?.box() ?? null, []);
  const full = useFullStage(stageBox, !!shownSheet);
  const insets = useStageInsets(stageBox, `${shownSheet?.key ?? '-'}|${sceneUp ? 's' : '-'}|${full.full ? 'f' : '-'}|${prompt ? 'p' : '-'}|${welcome ? 'w' : '-'}`);
  const [narrow] = useState(narrowStage);
  const showPrompt = (ready || flat) && !sheet && !!prompt;

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
        full={full.full}
        paused={!ready || !!sheet}
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
                  const s = sceneNow(CITY_SCENES, id, city, now);
                  // (somebody whose talk still waits for another is not offered: the list would be a wall of "meet … first")
                  return s && s.kind !== 'locked' ? (
                    <li key={id}>
                      <button type="button" className="btn btn-ghost" onClick={() => startScene(id)}>
                        {talkPrompt(id, s)}
                      </button>
                    </li>
                  ) : null;
                })}
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
          </div>
        )}

        <p className="town-toast" role="status">
          {toast && !sheet ? <span className="town-toast-box">{toast}</span> : null}
        </p>

        {sceneUp && (
          <CitySheet title={`${nameOf(sceneUp.at)} · ${cityPerson(sceneUp.at)?.role ?? 'lên Westbay'}`} onClose={closeSheet} talk>
            <Suspense fallback={<p className="town-build-hint">Đang mở…</p>}>
              <CityScenePanel key={sceneUp.key} scene={sceneUp.scene} again={sceneUp.again} sound={ui.sound} onReward={onReward} onSpeaking={setSpeaking} onClose={closeSheet} />
            </Suspense>
          </CitySheet>
        )}
        {shownSheet?.kind === 'thing' && (
          <CitySheet title={thingKind(shownSheet.id) === 'bus' ? 'Xe buýt số 9' : listenTitle(shownSheet.id)} onClose={closeSheet}>
            <ListenPanel key={shownSheet.key} where="city" overheard={CITY_OVERHEARD} focus={shownSheet.id} sound={ui.sound} onClose={closeSheet} onReward={onReward} onListen={onListen} onSpeaking={setSpeaking} onTravel={toTown} />
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
