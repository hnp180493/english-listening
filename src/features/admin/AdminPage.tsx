// "Duyệt nội dung" (#/duyet-k7q2m9x4, hidden from the menu and hard to guess: the owner tests it on the public deploy; owner, 2026-11-26: "cho tao một tài khoản quyền admin đi để tao đi
// review toàn bộ"). The app has no accounts and no server, so there is nothing to log into: this page is the admin's
// view instead. Every listening scene of the town and of Westbay and every request of the work shifts, by kind, with
// its lines (who, the English, the meaning), each line playable in the voice the game uses, the questions with the
// right answer marked. It READS ONLY: nothing is paid, nothing is written, nobody's progress changes, nothing waits
// for a day or for another scene to be heard first.

import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, LogOut, Map as MapIcon, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import { ADMIN, clearAdminSandbox, setAdmin } from '../../core/admin';
import { hrefFor } from '../../core/nav';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import { cityLinePlayback } from '../../core/town/cityAudio';
import { cityPerson } from '../../core/town/cityPeople';
import { sceneLinePlayback } from '../../core/town/sceneAudio';
import type { ListenScene, SceneLine, SceneQuestion } from '../../core/town/sceneTypes';
import { speak, stopSpeaking } from '../../core/tts';
import { CITY_CHATS, CITY_EPISODES, CITY_EVENT_SCENES, CITY_OUTINGS, CITY_OVERHEARD, CITY_SEASONS, CITY_VISITS_SCENES } from '../../data/city';
import { CITY_SHIFTS } from '../../data/city/shifts';
import { SUITORS } from '../../data/romance';
import { EVENT_SCENES, OVERHEARD_SCENES, RADIO_SCENES } from '../../data/scenes';
import { RIDE_SCENES } from '../../data/scenes/rides';
import { townPlace } from '../../data/town';
import { tl } from '../../i18n';
import { speakerName } from '../town/scenes/speakers';
import './admin.css';

/** The new faces, to look at before they go into the game (three.js: loaded when opened). */
const LookPreview = lazy(() => import('./LookPreview'));
/** Artist-made people on trial: the dev server only (its models are not in a build, so neither is the page). */
const ModelPreview = import.meta.env.DEV ? lazy(() => import('./ModelPreview')) : null;

interface Item {
  id: string;
  title: string;
  /** Where / who, one line. */
  scene: string;
  level: number;
  lines: readonly SceneLine[];
  questions: readonly SceneQuestion[];
  /** Said as the city says it (old residents in Gemini) or as a "cảnh nghe" (the browser's voice for everybody). */
  voice: 'city' | 'scene';
  /** A line over the title (a long story's name, a person's). */
  kicker?: string;
}

const fromListen = (s: ListenScene): Item => ({ id: s.id, title: s.title, scene: s.scene, level: s.level, lines: s.lines, questions: s.detail ? [s.gist, s.detail] : [s.gist], voice: 'scene' });

/** Everything there is to review, by kind (the select at the top). */
function groups(): { id: string; name: string; items: Item[] }[] {
  const city = (list: readonly { id: string; title: string; scene: string; level: number; lines: readonly SceneLine[]; questions: readonly SceneQuestion[]; at: string }[]): Item[] =>
    list.map((s) => ({ id: s.id, title: s.title, scene: s.scene, level: s.level, lines: s.lines, questions: s.questions, voice: 'city', kicker: cityPerson(s.at)?.name ?? townPlace(s.at)?.resident }));
  return [
    { id: 'episodes', name: 'Westbay: tập truyện của nhân vật chính', items: city(CITY_EPISODES) },
    {
      id: 'seasons',
      name: 'Westbay: mùa truyện (mỗi ngày một chương)',
      items: CITY_SEASONS.flatMap((season) => season.chapters.map((c) => ({ ...city([c])[0], kicker: tl`${season.title} · chương ${c.n}/${season.chapters.length}${c.where === 'town' ? ' · ở thị trấn' : ''}` }))),
    },
    { id: 'chats', name: 'Westbay: trò chuyện với người quen', items: city(CITY_CHATS) },
    { id: 'visits', name: 'Westbay: người thị trấn lên thành phố', items: city(CITY_VISITS_SCENES) },
    { id: 'outings', name: 'Westbay: hẹn hò và đi chơi gia đình', items: city(CITY_OUTINGS) },
    { id: 'cityEvents', name: 'Westbay: sự kiện trong tuần và lễ hội', items: CITY_EVENT_SCENES.map(fromListen) },
    { id: 'cityOverheard', name: 'Westbay: nghe lỏm ở ghế', items: CITY_OVERHEARD.map(fromListen) },
    { id: 'rides', name: 'Xe buýt số 9', items: RIDE_SCENES.map(fromListen) },
    { id: 'townOverheard', name: 'Thị trấn: nghe lỏm ở ghế', items: OVERHEARD_SCENES.map(fromListen) },
    { id: 'radio', name: 'Thị trấn: radio Bay FM', items: RADIO_SCENES.map(fromListen) },
    { id: 'townEvents', name: 'Thị trấn: buổi gặp mặt trong tuần', items: EVENT_SCENES.map(fromListen) },
  ];
}

const SHIFT_GROUP = 'shifts';

/** The old reading view: every scene's lines, folded under the admin's controls. */
function ContentReview() {
  const all = useMemo(() => groups(), []);
  const [groupId, setGroupId] = useState(all[0].id);
  const [shiftId, setShiftId] = useState(CITY_SHIFTS[0]?.id ?? '');
  const [pick, setPick] = useState(0);
  // an outing's partner can be any of the residents who can be courted: whose voice to hear the partner's lines in
  const [partner, setPartner] = useState(SUITORS[0]?.placeId ?? 'cafe');
  const [kid, setKid] = useState<'boy' | 'girl'>('girl');
  const [playing, setPlaying] = useState<number | null>(null);
  const token = useRef(0);
  useEffect(
    () => () => {
      token.current += 1;
      stopSpeaking();
    },
    [],
  );

  const group = all.find((g) => g.id === groupId);
  const items = group?.items ?? [];
  const item = items[Math.min(pick, items.length - 1)];
  const outing = groupId === 'outings';

  const nameOf = (who: string) => (who === 'partner' ? tl`Người yêu (${townPlace(partner)?.resident ?? ''})` : who === 'kid' ? 'Con' : speakerName(who) || who);
  const say = (line: SceneLine, level: number, voice: Item['voice'], careful = false) => {
    const p = voice === 'city' ? cityLinePlayback(line, level, careful, outing ? { partner, kid } : {}) : sceneLinePlayback(line, level, careful);
    return speak(p.text, p.options);
  };
  const stop = () => {
    token.current += 1;
    stopSpeaking();
    setPlaying(null);
  };
  const playAll = async (it: Item) => {
    const mine = ++token.current;
    stopSpeaking();
    for (let i = 0; i < it.lines.length; i++) {
      if (token.current !== mine) return;
      setPlaying(i);
      await say(it.lines[i], it.level, it.voice);
    }
    if (token.current === mine) setPlaying(null);
  };
  const choose = (g: string) => {
    stop();
    setGroupId(g);
    setPick(0);
  };

  const shift = CITY_SHIFTS.find((s) => s.id === shiftId);
  const total = all.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="stack-lg adm-page">
      <p className="adm-scene">{tl`Mọi cảnh nghe của thị trấn và Westbay (${total} cảnh) và mọi yêu cầu của ca làm việc, để đọc và nghe. Không tính xu, không lưu gì.`}</p>

      <div className="adm-bar">
        <label className="adm-field">
          <span className="adm-label">Loại cảnh</span>
          <select className="select" value={groupId} onChange={(e) => choose(e.target.value)}>
            {all.map((g) => (
              <option key={g.id} value={g.id}>
                {tl`${g.name} (${g.items.length})`}
              </option>
            ))}
            <option value={SHIFT_GROUP}>{tl`Ca làm việc (${CITY_SHIFTS.length} ca)`}</option>
          </select>
        </label>
        {outing && (
          <>
            <label className="adm-field">
              <span className="adm-label">Người yêu là</span>
              <select className="select" value={partner} onChange={(e) => setPartner(e.target.value)}>
                {SUITORS.map((s) => (
                  <option key={s.placeId} value={s.placeId}>
                    {townPlace(s.placeId)?.resident ?? s.placeId}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span className="adm-label">Con</span>
              <select className="select" value={kid} onChange={(e) => setKid(e.target.value === 'boy' ? 'boy' : 'girl')}>
                <option value="girl">Con gái</option>
                <option value="boy">Con trai</option>
              </select>
            </label>
          </>
        )}
        {groupId === SHIFT_GROUP && (
          <label className="adm-field">
            <span className="adm-label">Ca</span>
            <select className="select" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              {CITY_SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {groupId === SHIFT_GROUP && shift ? (
        <section className="card adm-detail">
          <p className="adm-scene">{shift.blurb}</p>
          <ol className="adm-lines">
            {shift.orders.map((o) => (
              <li key={o.id} className="adm-line">
                <div className="adm-line-head">
                  <span className="adm-who">{tl`${o.id} · mức ${o.level}`}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label="Nghe"
                    onClick={() => void sayOrder(o.text, o.level, o.say, o.gender)}
                  >
                    <Icon icon={Volume2} size={15} />
                  </button>
                </div>
                <p className="adm-en" lang="en">
                  {o.text}
                </p>
                <p className="adm-vi" data-vi>
                  {o.vi}
                </p>
                <p className="adm-answer">
                  {shift.slots.map((sl) => `${sl.label}: ${sl.options.find((op) => op.id === o.answer[sl.id])?.label ?? '?'}`).join(' · ')}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className="adm-split">
          <ul className="adm-list" aria-label="Các cảnh">
            {items.map((it, i) => (
              <li key={it.id}>
                <button
                  type="button"
                  className={'adm-pick' + (i === pick ? ' is-on' : '')}
                  onClick={() => {
                    stop();
                    setPick(i);
                  }}
                >
                  <span className="adm-pick-id">{it.id}</span>
                  <span className="adm-pick-title">{it.title}</span>
                </button>
              </li>
            ))}
          </ul>

          {item && (
            <section className="card adm-detail">
              {item.kicker && <p className="adm-kicker">{item.kicker}</p>}
              <h2 className="adm-title">{item.title}</h2>
              <p className="adm-scene">{tl`${item.scene} · mức ${item.level} · ${item.lines.length} câu`}</p>
              <div className="adm-actions">
                {playing === null ? (
                  <button type="button" className="btn btn-soft" onClick={() => void playAll(item)}>
                    <Icon icon={Play} size={16} />
                    Nghe cả đoạn
                  </button>
                ) : (
                  <button type="button" className="btn btn-soft" onClick={stop}>
                    <Icon icon={Square} size={16} />
                    Dừng
                  </button>
                )}
              </div>
              <ol className="adm-lines">
                {item.lines.map((l, i) => (
                  <li key={i} className={'adm-line' + (playing === i ? ' is-live' : '')}>
                    <div className="adm-line-head">
                      <span className="adm-who">{nameOf(l.who)}</span>
                      <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Nghe" onClick={() => void say(l, item.level, item.voice)}>
                        <Icon icon={Volume2} size={15} />
                      </button>
                    </div>
                    <p className="adm-en" lang="en">
                      {l.text}
                    </p>
                    <p className="adm-vi" data-vi>
                      {l.vi}
                    </p>
                  </li>
                ))}
              </ol>
              <h3 className="adm-sub">Câu hỏi</h3>
              <ol className="adm-qs">
                {item.questions.map((q, qi) => (
                  <li key={qi}>
                    <p className="adm-q" data-vi>
                      {q.q}
                    </p>
                    <ul className="adm-opts">
                      {q.options.map((o, oi) => (
                        <li key={oi} className={oi === q.answer ? 'is-right' : undefined} data-vi>
                          {oi === q.answer && <Icon icon={Check} size={14} />}
                          {o}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** A preview drawn only once opened (three.js loads then). */
function PreviewDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="how" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {open && <Suspense fallback={null}>{children}</Suspense>}
    </details>
  );
}

/** A shift's request, as the shift says it: the browser's voice of the caller's sex. */
function sayOrder(text: string, level: number, say: string | undefined, gender: 'male' | 'female'): Promise<void> {
  const p = sceneLinePlayback({ who: '', text, ...(say ? { say } : {}) }, level);
  return speak(p.text, { ...p.options, voice: { voice: gender === 'male' ? 'shift-m' : 'shift-f', gender } });
}

/** Go somewhere and load the app again (the storage prefix is fixed when the app loads: core/admin.ts). */
function reloadTo(hash: string): void {
  window.location.hash = hash;
  window.location.reload();
}

/**
 * The admin's page (#/duyet-k7q2m9x4, reached by its address only). Turns the admin mode on and off: the game played on
 * a sandbox of its own with everything open (core/admin.ts, ./seed.ts), never synced, the learner's progress untouched.
 * Under it, folded, every scene's lines to read.
 */
export default function AdminPage() {
  return (
    <div className="stack-lg adm-page">
      <PageHeader title="Chế độ admin" subtitle={ADMIN ? 'Đang bật: bạn đang chơi trên dữ liệu thử.' : 'Chơi game với mọi thứ đã mở sẵn để duyệt.'} />
      <section className="card stack-md">
        {ADMIN ? (
          <>
            <p className="adm-scene">Mọi nhà đã xây, mọi đồ đã mua, 99.999 xu, ai cũng đầy tim. Ở Westbay mọi cảnh đều mở, chương truyện mở liền không phải chờ ngày, người thị trấn lên đủ, ca làm việc nào cũng vào được. Dữ liệu thử này riêng, không đồng bộ lên tài khoản; tiến độ thật của bạn vẫn nguyên.</p>
            <div className="adm-actions">
              <a className="btn btn-primary" href={hrefFor('town')}>
                <Icon icon={MapIcon} size={16} />
                Vào thị trấn
              </a>
              <a className="btn btn-ghost" href={hrefFor('town', { at: 'city' })}>
                Lên Westbay
              </a>
              <button type="button" className="btn btn-ghost" onClick={() => { clearAdminSandbox(); reloadTo(hrefFor('town')); }}>
                <Icon icon={RotateCcw} size={16} />
                Làm lại từ đầu
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setAdmin(false); reloadTo(hrefFor('home')); }}>
                <Icon icon={LogOut} size={16} />
                Tắt chế độ admin
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="adm-scene">Bật lên thì app chạy trên một bộ dữ liệu thử riêng: mọi nhà đã xây, 99.999 xu, ai cũng đầy tim, Westbay mở hết, không phải chờ ngày. Không đồng bộ lên tài khoản và không đụng tới tiến độ thật. Tắt đi là về lại dữ liệu thật.</p>
            <div className="adm-actions">
              <button type="button" className="btn btn-primary" onClick={() => { setAdmin(true); reloadTo(hrefFor('town')); }}>
                <Icon icon={Play} size={16} />
                Bật chế độ admin và vào thị trấn
              </button>
            </div>
          </>
        )}
      </section>
      {ModelPreview && (
        <PreviewDetails title="Xem thử: nhân vật mô hình thật">
          <ModelPreview />
        </PreviewDetails>
      )}
      <PreviewDetails title="Xem thử: mặt nhân vật mới">
        <LookPreview />
      </PreviewDetails>
      <details className="how">
        <summary>Đọc toàn bộ lời thoại</summary>
        <ContentReview />
      </details>
    </div>
  );
}
