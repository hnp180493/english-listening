// "Vụ án ở thị trấn" (docs/town.md §17): one chapter of a cosy mystery a day. Three residents say what they saw (audio,
// their own voices, nothing to read); a question whose answer is a detail in what was said; then the words, a clue for
// the notebook and a cliffhanger. Rules: core/town/cases.ts. One action a screen: listen → answer → "Xong hôm nay".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Play, RotateCcw, Turtle, Volume2 } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL, CAREFUL_RATE } from '../../../core/playback';
import { caseNow, chapterStars, cluesOf, type Stars } from '../../../core/town/cases';
import { finishChapter, useTownCases, type ChapterResult } from '../../../core/town/casesStore';
import type { CaseLine, Testimony } from '../../../core/town/caseTypes';
import { CAST_VOICES } from '../../../core/town/voices';
import { speak, stopSpeaking } from '../../../core/tts';
import { TOWN_CASES } from '../../../data/cases';
import { townPlace } from '../../../data/town';
import type { PlaceId } from '../../../data/townWorld';
import { dictationAudio, safeDecode } from '../../dictation/decodeCache';
import { Coin, Portrait, SoundBars } from '../art';
import { playSfx } from '../sfx';
import type { ActivityPanelProps } from './types';
import './cases.css';

const nameOf = (placeId: string): string => townPlace(placeId)?.resident ?? '';

/** Say one line in the witness's voice: the shipped clip, else the browser voice (never a paid request). */
function sayLine(placeId: string, line: CaseLine, level: 1 | 2 | 3, careful = false): Promise<void> {
  const a = dictationAudio({ text: line.text, level });
  const voice = CAST_VOICES[placeId] ?? null;
  return careful ? speak(a.careful, { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true }) : speak(a.connected, { mode: 'connected', voice, browserOnly: true });
}

export default function CasePanel({ onReward, sound, onClose }: ActivityPanelProps) {
  const stored = useTownCases();
  const [now] = useState(() => Date.now());
  // the chapter being played stays on the screen after it is solved (the stored value has moved on by then)
  const [at, setAt] = useState(() => caseNow(TOWN_CASES, stored, now));
  const [plays, setPlays] = useState<number[]>([0, 0, 0]);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [result, setResult] = useState<(ChapterResult & { stars: Stars }) | null>(null);
  const token = useRef(0);
  useEffect(
    () => () => {
      token.current += 1;
      stopSpeaking();
    },
    [],
  );

  const chapter = at.kind === 'finished' ? null : at.case.chapters[at.chapter];
  const level = at.kind === 'finished' ? 1 : at.case.level;

  /** A witness says their lines one after another; a second press stops them. */
  const listen = useCallback(
    async (i: number, t: Testimony) => {
      const mine = ++token.current;
      stopSpeaking();
      if (speaking === i) {
        setSpeaking(null);
        return;
      }
      setSpeaking(i);
      setPlays((p) => p.map((n, k) => (k === i ? n + 1 : n)));
      for (const line of t.lines) {
        if (token.current !== mine) return;
        await sayLine(t.placeId, line, level);
      }
      if (token.current === mine) setSpeaking(null);
    },
    [level, speaking],
  );

  const pick = useCallback(
    (i: number) => {
      if (at.kind !== 'open' || !chapter || result) return;
      if (i !== chapter.answer) {
        setWrong((w) => (w.includes(i) ? w : [...w, i]));
        playSfx('wrong', sound);
        return;
      }
      token.current += 1;
      stopSpeaking();
      setSpeaking(null);
      const stars = chapterStars(wrong.length, plays);
      const r = finishChapter(at.case, at.chapter, stars);
      setResult({ ...r, stars });
      playSfx(stars === 3 ? 'first' : 'right', sound);
      if (r.xu > 0) onReward({ label: r.closed ? 'Phá xong một vụ án!' : 'Thêm một manh mối', xu: r.xu });
    },
    [at, chapter, result, wrong, plays, sound, onReward],
  );

  const clues = useMemo(() => (at.kind === 'finished' ? [] : cluesOf(at.case, stored)), [at, stored]);
  const notebook = clues.length > 0 && (
    <details className="how town-case-notes">
      <summary>Sổ điều tra · {clues.length} manh mối</summary>
      <ol className="town-case-clues">
        {clues.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
    </details>
  );

  if (at.kind === 'finished' || !chapter) {
    return (
      <div className="town-case">
        <p className="town-build-hint">Bạn đã phá hết các vụ án hiện có. Thị trấn đang yên bình, vụ mới sẽ tới sau.</p>
      </div>
    );
  }

  const head = (
    <>
      <p className="town-case-kicker">
        {at.case.title} · Kỳ {at.chapter + 1}/{at.case.chapters.length}
      </p>
      <h3 className="town-case-title">{chapter.title}</h3>
    </>
  );

  // ── tomorrow ──
  if (at.kind === 'tomorrow' && !result) {
    return (
      <div className="town-case">
        <p className="town-case-kicker">{at.case.title}</p>
        <h3 className="town-case-title">Kỳ {at.chapter + 1} mở vào ngày mai</h3>
        <p className="town-build-hint">Mỗi ngày một kỳ. Hôm nay bạn đã nghe xong lời khai; mai các nhân chứng mới nói tiếp.</p>
        {notebook}
      </div>
    );
  }

  // ── solved: the words, the clue, the cliffhanger ──
  if (result) {
    const last = at.chapter === at.case.chapters.length - 1;
    return (
      <div className="town-case">
        {head}
        <p className="town-case-verdict">
          <Icon icon={Check} size={16} />
          {result.stars === 3 ? 'Nghe một lần là bắt được chi tiết!' : result.stars === 2 ? 'Đúng rồi.' : 'Đúng rồi, sau khi nghe lại.'}
          {result.xu > 0 && (
            <span className="town-gain">
              <Coin size={16} />+{result.xu}
            </span>
          )}
        </p>
        <p className="town-case-clue">Manh mối: {chapter.clue}</p>
        {last ? <p className="town-case-ending">{at.case.ending}</p> : <p className="town-case-cliff">{chapter.cliffhanger}</p>}
        {result.bond > 0 && <p className="town-build-hint">{nameOf(at.case.friend)} quý bạn hơn: thân thiết +{result.bond}</p>}
        <div className="town-case-said">
          <h4 className="town-case-sub">Họ đã nói gì</h4>
          {chapter.testimonies.map((t, i) => (
            <div key={i} className="town-case-witness-said">
              <span className="town-case-name">{nameOf(t.placeId)}</span>
              {t.lines.map((line, k) => (
                <SaidLine key={k} placeId={t.placeId} line={line} level={level} />
              ))}
            </div>
          ))}
        </div>
        {!last && <p className="town-build-hint">Kỳ sau mở vào ngày mai.</p>}
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {last ? 'Đóng vụ án' : 'Xong hôm nay'}
          </button>
        </div>
      </div>
    );
  }

  // ── listening and answering ──
  const heardAll = plays.every((n) => n > 0);
  const hinted = wrong.length > 0 ? nameOf(chapter.testimonies[chapter.hint].placeId) : '';
  return (
    <div className="town-case">
      {head}
      <p className="town-ep-scene">{chapter.scene}</p>
      <ul className="town-case-witnesses" aria-label="Nhân chứng">
        {chapter.testimonies.map((t, i) => (
          <li key={i} className={'town-case-witness' + (speaking === i ? ' is-live' : '')}>
            <Portrait placeId={t.placeId as PlaceId} size={44} />
            <span className="town-case-name">
              {nameOf(t.placeId)}
              {plays[i] > 0 && <span className="town-case-heard"> · đã nghe {plays[i]} lần</span>}
            </span>
            {speaking === i && <SoundBars on />}
            <button type="button" className={'btn btn-sm ' + (plays[i] === 0 ? 'btn-soft' : 'btn-ghost')} onClick={() => void listen(i, t)}>
              <Icon icon={speaking === i ? Volume2 : plays[i] === 0 ? Play : RotateCcw} size={15} />
              {speaking === i ? 'Dừng' : plays[i] === 0 ? 'Nghe' : 'Nghe lại'}
            </button>
          </li>
        ))}
      </ul>
      {heardAll ? (
        <div className="town-case-ask" role="group" aria-label={chapter.question}>
          <p className="town-case-q">{chapter.question}</p>
          {hinted && <p className="town-note">Chưa đúng. Nghe lại lời của {hinted}.</p>}
          <div className="town-reply-list">
            {chapter.options.map((o, i) => (
              <button key={i} type="button" className={'town-reply' + (wrong.includes(i) ? ' is-wrong' : '')} onClick={() => pick(i)} disabled={wrong.includes(i)}>
                <span className="town-reply-key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="town-reply-text">{o}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="town-build-hint">Nghe đủ ba người rồi câu hỏi mới hiện. Nghe một lần mà bắt được chi tiết thì được 3 sao.</p>
      )}
      {notebook}
      {at.chapter === 0 && clues.length === 0 && plays.every((n) => n === 0) && <p className="town-build-hint">Mỗi ngày một kỳ, mỗi vụ năm kỳ. Giải xong kỳ hôm nay thì mai nghe tiếp.</p>}
      {/* a chapter solved elsewhere meanwhile (another tab): move on */}
      {at.kind === 'open' && stored.done[at.case.id]?.[String(at.chapter)] && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAt(caseNow(TOWN_CASES, stored, Date.now()))}>
          Kỳ này đã giải ở máy khác: xem tiếp
        </button>
      )}
    </div>
  );
}

/** One line after the chapter is solved: how it sounds joined up, what it meant, to hear again. */
function SaidLine({ placeId, line, level }: { placeId: string; line: CaseLine; level: 1 | 2 | 3 }) {
  const decoded = useMemo(() => safeDecode(line.text), [line.text]);
  return (
    <div className="town-case-line">
      {decoded.tokens.length > 0 ? (
        <SpokenSentence result={decoded} compact />
      ) : (
        <p className="town-case-en" lang="en">
          {line.text}
        </p>
      )}
      <p className="town-case-vi">{line.vi}</p>
      <div className="town-case-line-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayLine(placeId, line, level)}>
          <Icon icon={Volume2} size={15} />
          Nghe
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sayLine(placeId, line, level, true)}>
          <Icon icon={Turtle} size={15} />
          {CAREFUL_LABEL}
        </button>
      </div>
    </div>
  );
}
