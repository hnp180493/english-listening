// "Hẹn hò & gia đình" (docs/town.md §15): who this character can court and how close each one is, the next step with
// the partner (and what it waits for), then married life: the day's exchange with the spouse, each child's, a baby.
// A step plays as a text scene (./StoryChat) right here; finishing it records it and pays its friendship points.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { daysOld, kidAge, kidsOf, partnerOf, type Kid } from '../../../core/town/life';
import { finishRomanceStep, townRomanceSteps, useTownLife } from '../../../core/town/lifeStore';
import { romanceStatus, type RomanceStep } from '../../../core/town/romance';
import type { ChatOption } from '../../../core/town/romanceTypes';
import { useTownOverview, useTownProgress } from '../../../core/town/store';
import { suitorsFor } from '../../../data/romance';
import { townPlace } from '../../../data/town';
import type { PlaceId } from '../../../data/townWorld';
import { Hearts, Portrait, type PortraitMood } from '../art';
import { playSfx } from '../sfx';
import type { ActivityPanelProps } from '../activities/types';
import StoryChat from './StoryChat';
import './romance.css';
import { asIs, tl } from '../../../i18n';

const AGE_LABEL = { baby: 'Em bé', toddler: 'Mới biết đi', child: 'Đi học' } as const;

/** Their face as a scene begins: shy at a confession, taken by surprise at a proposal, moved at the wedding. */
function openingMood(kind: RomanceStep['kind']): PortraitMood {
  if (kind === 'confess') return 'love';
  if (kind === 'proposal') return 'surprised';
  if (kind === 'wedding') return 'moved';
  return 'happy';
}

/** Their face after the learner's answer: a warm one wins a blush (a yes to a confession or a proposal: happy tears). */
function pickedMood(kind: RomanceStep['kind'], points: number): PortraitMood {
  if (points <= 0) return 'pout';
  if (points < 10) return 'happy';
  return kind === 'confess' || kind === 'proposal' || kind === 'wedding' ? 'moved' : 'love';
}

export default function LovePanel({ focus, onOpen, onReward, sound, onScene, onSceneEnd }: ActivityPanelProps) {
  const life = useTownLife();
  const overview = useTownOverview();
  // re-read the steps when hearts or gifts in hand move
  const progress = useTownProgress();
  const partner = partnerOf(life);
  const suitors = useMemo(() => (life.profile ? suitorsFor(life.profile.gender) : []), [life.profile]);
  const [open, setOpen] = useState<string | null>(() => partner ?? (focus && suitors.some((s) => s.placeId === focus) ? focus : null));
  const [playing, setPlaying] = useState<RomanceStep | null>(null);
  const [baby, setBaby] = useState<{ name: string; gender: Kid['gender'] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // the face of the one in the scene playing (null = as the scene begins)
  const [sceneMood, setSceneMood] = useState<PortraitMood | null>(null);
  // the children's ages as of opening the panel
  const [now] = useState(() => Date.now());
  // a scene staged in the town ends with the panel too (closed, Esc): the camera goes back to the player
  const staged = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (staged.current) onSceneEnd?.({ placeId: staged.current, celebrate: false });
    },
    [onSceneEnd],
  );
  const begin = (s: RomanceStep) => {
    setPlaying(s);
    setSceneMood(null);
    // a baby is named first; the scene (and the stage) after
    if (s.kind === 'baby') return;
    staged.current = s.placeId;
    onScene?.({ placeId: s.placeId, spot: s.spot ?? null, wedding: s.kind === 'wedding' });
  };

  if (!life.profile) {
    return (
      <div className="town-love">
        <p className="town-build-hint">Hẹn hò cần biết bạn là ai trước: tạo nhân vật của bạn (nam hay nữ, tên, ngoại hình).</p>
        <button type="button" className="btn btn-primary" onClick={() => onOpen?.('character')}>
          Tạo nhân vật
        </button>
      </div>
    );
  }
  const you = life.profile.name;
  const kids = kidsOf(life);
  const kidName = (id?: string) => kids.find((k) => k.id === id)?.kid.name ?? '';

  // a step being played
  if (playing && playing.scene && (playing.kind !== 'baby' || baby)) {
    const done = (choice: ChatOption | null) => {
      const r = finishRomanceStep(playing, choice ? { id: choice.id, points: choice.points } : null, playing.kind === 'baby' ? (baby ?? undefined) : undefined);
      setPlaying(null);
      setBaby(null);
      if (staged.current) {
        onSceneEnd?.({ placeId: staged.current, celebrate: r.ok && (playing.kind === 'confess' || playing.kind === 'proposal' || playing.kind === 'wedding' || playing.kind === 'baby') });
        staged.current = null;
      }
      if (!r.ok) {
        setNote('Chưa ghi được bước này, thử lại sau nhé.');
        return;
      }
      playSfx('task', sound);
      const who = townPlace(playing.placeId)?.resident ?? '';
      const label = { confess: tl`${who} đã nhận lời!`, date: 'Một buổi hẹn thật vui', proposal: tl`${who} đã đồng ý!`, wedding: 'Chúc mừng đám cưới!', daily: tl`Thêm một ngày bên ${who}`, kid: 'Một lúc vui với con', baby: tl`Chào mừng bé ${asIs(baby?.name ?? '')}!` }[playing.kind];
      setNote(r.points > 0 ? tl`${label} Thân với ${who} +${r.points}.` : label);
      onReward({ label });
    };
    return (
      <div className="town-love">
        <div className="town-love-head is-scene">
          <span className="town-love-face">
            <Portrait placeId={playing.placeId as PlaceId} size={160} frame="bust" shape="card" fluid mood={sceneMood ?? openingMood(playing.kind)} />
          </span>
          <h3 className="town-love-title">{playing.scene.title}</h3>
        </div>
        <StoryChat
          onPick={(o) => setSceneMood(pickedMood(playing.kind, o.points))}
          scene={playing.scene}
          them={townPlace(playing.placeId)?.resident ?? ''}
          you={you}
          kid={playing.kind === 'baby' ? (baby?.name ?? '') : kidName(playing.kidId)}
          cast={{ placeId: playing.placeId, kid: playing.kind === 'baby' ? baby?.gender : kids.find((k) => k.id === playing.kidId)?.kid.gender }}
          autoplay={sound}
          onDone={done}
        />
      </div>
    );
  }
  // naming a baby first
  if (playing?.kind === 'baby') {
    return (
      <BabyForm
        onCancel={() => setPlaying(null)}
        onDone={(b) => {
          setBaby(b);
          staged.current = playing.placeId;
          onScene?.({ placeId: playing.placeId, spot: null, wedding: false });
        }}
      />
    );
  }

  const view = open ? overview.places.find((p) => p.place.id === open) : undefined;
  if (open && view) {
    void progress;
    const steps = townRomanceSteps(open);
    const status = romanceStatus(life, open);
    return (
      <div className="town-love">
        {!partner && (
          <button type="button" className="btn btn-ghost btn-sm town-journal-back" onClick={() => setOpen(null)}>
            <Icon icon={ArrowLeft} size={16} />
            Danh sách
          </button>
        )}
        <div className="town-love-head">
          <span className="town-love-hero">
            <Portrait placeId={open as PlaceId} size={132} frame="bust" shape="card" fluid />
          </span>
          <div>
            <p className="town-love-name">{view.place.resident}</p>
            <p className="town-love-sub">{status ?? 'Chưa hẹn hò'}</p>
            <Hearts value={view.friend.hearts} name={view.place.resident} />
          </div>
        </div>
        {steps.length === 0 ? (
          <p className="town-build-hint">{partner && partner !== open ? `Bạn đang có đôi rồi.` : 'Chưa có gì để làm lúc này.'}</p>
        ) : (
          <ul className="town-love-steps">
            {steps.map((s) => (
              <li key={s.kind + (s.kidId ?? '')} className="town-love-step">
                <span className="town-love-step-label">{s.label}</span>
                {s.ready ? (
                  <button type="button" className="btn btn-sm btn-soft" onClick={() => begin(s)}>
                    Bắt đầu
                  </button>
                ) : (
                  <span className="town-love-need">{s.need}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {kids.length > 0 && partner === open && (
          <ul className="town-love-kids" aria-label="Các con">
            {kids.map(({ id, kid }) => (
              <li key={id}>
                <span className="town-love-name">{kid.name}</span>
                <span className="town-love-sub">
                  {kid.gender === 'boy' ? 'Con trai' : 'Con gái'} · {AGE_LABEL[kidAge(kid.born, now)]} · {daysOld(kid.born, now) + 1} ngày tuổi
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="town-build-hint" role="status">
          {note ?? ''}
        </p>
      </div>
    );
  }

  // who this character can court
  return (
    <div className="town-love">
      <p className="town-build-hint">Thân đủ 8 tim và có một bó hoa thì tỏ tình được. Hẹn hò 3 buổi, đủ 10 tim và có nhẫn thì cầu hôn.</p>
      <ul className="town-love-cards" aria-label="Người bạn có thể hẹn hò">
        {suitors.map((s) => {
          const p = overview.places.find((v) => v.place.id === s.placeId);
          if (!p) return null;
          const ready = p.friend.hearts >= 8;
          return (
            <li key={s.placeId}>
              <button type="button" className={'town-love-card' + (ready ? ' is-ready' : '')} onClick={() => setOpen(s.placeId)}>
                <Portrait placeId={s.placeId as PlaceId} size={180} frame="bust" shape="card" fluid />
                <span className="town-love-card-text">
                  <span className="town-love-name">{p.place.resident}</span>
                  <span className="town-love-sub">
                    <Icon icon={Heart} size={14} />
                    {ready ? 'Đủ tim để tỏ tình' : tl`${p.friend.hearts}/8 tim`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen?.('character')}>
        Đổi nhân vật
      </button>
    </div>
  );
}

function BabyForm({ onCancel, onDone }: { onCancel: () => void; onDone: (b: { name: string; gender: Kid['gender'] }) => void }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Kid['gender']>('girl');
  const ok = name.trim().length > 0;
  return (
    <form
      className="town-love"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onDone({ name, gender });
      }}
    >
      <h3 className="town-love-title">Có em bé</h3>
      <label className="town-me-field">
        <span>Tên bé</span>
        <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="town-me-row" role="radiogroup" aria-label="Bé trai hay bé gái">
        {(['girl', 'boy'] as const).map((g) => (
          <button key={g} type="button" role="radio" aria-checked={gender === g} className={'btn btn-sm' + (gender === g ? ' btn-soft is-on' : ' btn-ghost')} onClick={() => setGender(g)}>
            {g === 'girl' ? 'Bé gái' : 'Bé trai'}
          </button>
        ))}
      </div>
      <div className="town-talk-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Thôi
        </button>
        <button type="submit" className="btn btn-primary" disabled={!ok}>
          Đón bé về
        </button>
      </div>
    </form>
  );
}
