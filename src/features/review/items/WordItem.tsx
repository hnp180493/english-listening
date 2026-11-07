// Ôn tập item: a word taught in a 'words' table (courses irregular, loanwords; spelling rows with review: true).
// Two modes (features/review/wordModel.ts): 'listen' (hear it, pick the written word: auto-graded) and 'read' (read
// it aloud, flip, self-grade with the four buttons as Cụm từ). The mode is picked once per mount.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CircleCheck, CircleX, Eye, RotateCw } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import PlayButton from '../../../components/PlayButton';
import { formatDaysVi, gradeAuto, gradeWordChoice, recordReview } from '../../../core/review';
import { wordIndex, type WordSource } from '../../../core/review/words';
import { useSettings } from '../../../core/settings';
import { GRADES, newCard, type CardState, type Grade } from '../../../core/srs';
import { recordAttempt } from '../../../core/stats';
import { speak, stopSpeaking, ttsSupported } from '../../../core/tts';
import { GRADE_LABEL } from '../../drill/labels';
import { parseMark, parseMd, type MdSpan } from '../../lessons/logic';
import type { Resolved } from '../resolve';
import { markWordIn, wordAudio, wordPlan, type WordPlan } from '../wordModel';
import type { ItemBaseProps } from './types';

export interface WordItemProps extends ItemBaseProps {
  item: Extract<Resolved, { kind: 'word' }>;
  /** Session seed (rotates the listening options between sessions). */
  seed: number;
}

const SLOW_RATE = 0.7;

/** Keys inside a menu, dialog or the nav are not item shortcuts; neither are keys typed into a field. */
function ignoreKey(e: KeyboardEvent): boolean {
  const t = e.target;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return true;
  if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return true;
  if (t instanceof Element && t.closest('[data-popover], nav, [role="dialog"], [role="menu"]')) return true;
  return !!document.querySelector('[aria-modal="true"]');
}

/** Stats: no ModuleId fits a word, 'lesson' keeps the day active (streak); the itemId is no lesson id. */
function record(id: string, correct: boolean) {
  try {
    recordAttempt(
      {
        module: 'lesson',
        itemId: id,
        correct,
        seen: [],
        missed: [],
      },
      { inReview: true },
    );
  } catch {
    // stats are best effort
  }
}

export default function WordItem({ item, state, graded, onGraded, onNext, seed }: WordItemProps) {
  // Picked once per mount: the card state changes when this item is graded, the mode and options must not.
  const [plan] = useState<WordPlan>(() => {
    const p = wordPlan(item.source, state, wordIndex(), seed);
    return p.mode === 'listen' && !ttsSupported()
      ? {
          ...p,
          mode: 'read',
          task: 'word',
          options: [],
          sounds: [],
          answer: -1,
        }
      : p;
  });
  const doneRef = useRef(false);

  const grade = (g: Grade, correct: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (graded) return; // a second pass at this position is practice only
    const res = recordReview(item.id, g, { ctx: 'review', enrol: true });
    record(item.id, correct);
    onGraded({ grade: g, correct, current: res.current });
  };

  return plan.mode === 'listen' ? (
    <ListenView source={item.source} plan={plan} onAnswer={(ok) => grade(gradeWordChoice(ok), ok)} onNext={onNext} />
  ) : (
    <ReadView
      source={item.source}
      state={state}
      context={plan.ambiguity.heteronym && plan.audio.context ? plan.audio.text : null}
      onGrade={(g) => grade(g, g !== 'again')}
      onNext={onNext}
    />
  );
}

// ───────────────────────── listen: hear → pick the written word ─────────────────────────

interface ListenViewProps {
  source: WordSource;
  plan: WordPlan;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
}

function ListenView({ source, plan, onAnswer, onNext }: ListenViewProps) {
  const [picked, setPicked] = useState<number | null>(null); // -1 = "xem đáp án"
  const firstRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const { text, context } = plan.audio;
  const answered = picked !== null;

  useEffect(() => {
    void speak(text);
    return () => stopSpeaking();
  }, [text]);

  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
    else if (window.matchMedia?.('(pointer: fine)').matches) firstRef.current?.focus({ preventScroll: true });
  }, [answered]);

  const pick = useCallback(
    (i: number) => {
      if (picked !== null) return;
      setPicked(i);
      onAnswer(i === plan.answer);
    },
    [picked, onAnswer, plan.answer],
  );

  // 1–4 chọn · R nghe lại
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e)) return;
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        void speak(text);
        return;
      }
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (!answered && i >= 0 && i < plan.options.length) {
        e.preventDefault();
        pick(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, pick, plan.options.length, text]);

  const ok = picked === plan.answer;
  const wrong = picked !== null && picked >= 0 && picked !== plan.answer;
  const chosen = wrong ? plan.options[picked] : null;
  const chosenSound = wrong ? plan.sounds[picked] : undefined;
  const reading = plan.task === 'reading';

  return (
    <article className="card rev-word" aria-label={reading ? 'Nghe câu và chọn cách đọc' : 'Nghe và chọn từ'}>
      {!answered ? (
        <div className="rev-word-front">
          <h2 className="rev-word-prompt">
            {reading ? (
              <>
                Từ <strong lang="en">{source.item.word}</strong> trong câu bạn nghe đọc thế nào?
              </>
            ) : context ? (
              'Nghe câu. Từ nào dưới đây có trong câu?'
            ) : (
              'Nghe và chọn từ bạn nghe được'
            )}
          </h2>
          <div className="rev-word-listen">
            <PlayButton text={text} label={context ? 'Nghe câu' : 'Nghe'} variant="primary" />
            <PlayButton text={text} rate={SLOW_RATE} label="Nghe chậm" size="sm" variant="ghost" />
          </div>
          <div className="drill-options rev-word-options" role="group" aria-label={reading ? 'Chọn cách đọc bạn nghe được' : 'Chọn từ bạn nghe được'}>
            {plan.options.map((o, i) => (
              <button
                key={o}
                ref={i === 0 ? firstRef : undefined}
                type="button"
                className="drill-option"
                lang="en"
                onClick={() => pick(i)}
                aria-keyshortcuts={String(i + 1)}
              >
                <span className={reading ? 'drill-option-text respell' : 'drill-option-text'}>{o}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm rev-word-skip" onClick={() => pick(-1)}>
            <Icon icon={Eye} size={15} />
            Không biết, xem đáp án
          </button>
        </div>
      ) : (
        <div className="rev-word-back">
          <div className={'callout ' + (ok ? 'callout-ok' : 'callout-bad')} role="status">
            <Icon icon={ok ? CircleCheck : CircleX} size={18} />
            <span>
              {ok ? (
                <strong>Đúng rồi!</strong>
              ) : chosen ? (
                reading ? (
                  <>
                    <strong>Chưa đúng.</strong> Bạn chọn{' '}
                    <span className="respell" lang="en">
                      {chosen}
                    </span>
                    , còn trong câu này <span lang="en">{source.item.word}</span> đọc là{' '}
                    <span className="respell" lang="en">
                      {source.item.sound}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    <strong>Chưa đúng.</strong> Bạn chọn <q lang="en">{chosen}</q>
                    {chosenSound && (
                      <>
                        , từ đó đọc là{' '}
                        <span className="respell" lang="en">
                          {chosenSound}
                        </span>
                      </>
                    )}
                    .
                  </>
                )
              ) : (
                <strong>{reading ? 'Cách đọc trong câu bạn vừa nghe:' : 'Từ bạn vừa nghe:'}</strong>
              )}
            </span>
          </div>
          <WordReveal source={source} storyOpen={false} />
          <div className="rev-verdict-actions">
            <button ref={nextRef} type="button" className="btn btn-primary btn-lg" onClick={onNext}>
              Tiếp
              <Icon icon={ArrowRight} size={17} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ───────────────────────── read: read aloud → flip → self-grade ─────────────────────────

interface ReadViewProps {
  source: WordSource;
  state: CardState | undefined;
  /** Heteronyms: the context sentence shown (not played) on the front, so the asked reading is clear. */
  context: string | null;
  onGrade: (g: Grade) => void;
  onNext: () => void;
}

/** "10 phút" / "1 ngày" / "4 ngày": when the card comes back after each grade. */
function previews(state: CardState | undefined, id: string, now: number): Record<Grade, string> {
  const base = state ?? newCard(id, now);
  const out = {} as Record<Grade, string>;
  for (const g of GRADES) {
    const next = gradeAuto(base, g, now);
    out[g] = next.interval >= 1 ? formatDaysVi(next.interval) : `${Math.max(1, Math.round((next.due - now) / 60_000))} phút`;
  }
  return out;
}

function ReadView({ source, state, context, onGrade, onNext }: ReadViewProps) {
  const [flipped, setFlipped] = useState(false);
  const [mine, setMine] = useState<Grade | null>(null);
  const [flippedAt, setFlippedAt] = useState(0);
  const flipRef = useRef<HTMLButtonElement>(null);
  const goodRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const audio = wordAudio(source.item).text;

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (mine) nextRef.current?.focus({ preventScroll: true });
    else if (flipped) goodRef.current?.focus({ preventScroll: true });
    else if (window.matchMedia?.('(pointer: fine)').matches) flipRef.current?.focus({ preventScroll: true });
  }, [flipped, mine]);

  const flip = useCallback(() => {
    if (flipped) return;
    setFlippedAt(Date.now());
    setFlipped(true);
    void speak(audio);
  }, [flipped, audio]);

  const choose = useCallback(
    (g: Grade) => {
      if (mine) return;
      setMine(g);
      onGrade(g);
    },
    [mine, onGrade],
  );

  // 1–4 tự chấm · R nghe lại (after flipping)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e) || !flipped) return;
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        void speak(audio);
        return;
      }
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (!mine && i >= 0) {
        e.preventDefault();
        choose(GRADES[i]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, mine, choose, audio]);

  const when = useMemo(() => (flipped ? previews(state, source.id, flippedAt) : null), [flipped, state, source.id, flippedAt]);

  return (
    <article className="card rev-word" aria-label="Đọc từ rồi lật thẻ">
      {!flipped ? (
        <div className="rev-word-front">
          <h2 className="rev-word-prompt">{context ? 'Đọc thử từ này như trong câu, rồi lật thẻ' : 'Đọc thử thành tiếng rồi lật thẻ'}</h2>
          <p className="rev-word-big" lang="en">
            {source.item.word}
          </p>
          {context && (
            <p className="rev-word-context">
              <span className="sr-only">Trong câu: </span>
              <span lang="en">
                {markWordIn(context, source.item.word).map((p, i) =>
                  p.hit ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>,
                )}
              </span>
            </p>
          )}
          <div className="rev-word-flip">
            <button ref={flipRef} type="button" className="btn btn-primary btn-lg" onClick={flip}>
              <Icon icon={RotateCw} size={17} />
              Lật thẻ
            </button>
          </div>
        </div>
      ) : (
        <div className="rev-word-back">
          <WordReveal source={source} storyOpen />
          {!mine ? (
            <div className="drill-grade-wrap">
              <p className="drill-grade-hint">Bạn đọc đúng như vậy chưa?</p>
              <div className="drill-grades" role="group" aria-label="Tự chấm">
                {GRADES.map((g, i) => (
                  <button
                    key={g}
                    ref={g === 'good' ? goodRef : undefined}
                    type="button"
                    className={`drill-grade is-${g}`}
                    onClick={() => choose(g)}
                    aria-label={`${GRADE_LABEL[g]}${when ? `, gặp lại sau ${when[g]}` : ''}`}
                    aria-keyshortcuts={String(i + 1)}
                  >
                    <span className="drill-grade-label">{GRADE_LABEL[g]}</span>
                    {when && <span className="drill-grade-when">{when[g]}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rev-word-done">
              <span className="meta">Bạn tự chấm: {GRADE_LABEL[mine]}</span>
              <button ref={nextRef} type="button" className="btn btn-primary btn-lg" onClick={onNext}>
                Tiếp
                <Icon icon={ArrowRight} size={17} />
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ───────────────────────── the back of the card ─────────────────────────

function Spans({ spans }: { spans: MdSpan[] }) {
  return <>{spans.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <Fragment key={i}>{s.text}</Fragment>))}</>;
}

function Story({ md }: { md: string }) {
  const blocks = useMemo(() => parseMd(md), [md]);
  return (
    <div className="rev-word-story-body">
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>
            <Spans spans={b.spans} />
          </p>
        ) : (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Spans spans={it} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** Word with its marked letters ([..] accent, (..) silent), respelling, IPA (setting), audio, note, context, story. */
function WordReveal({ source, storyOpen }: { source: WordSource; storyOpen: boolean }) {
  const { showIpa } = useSettings();
  const { item } = source;
  const parts = parseMark(item.word, item.mark) ?? [{ text: item.word, kind: 'plain' as const }];
  const audio = wordAudio(item);
  return (
    <div className="rev-word-reveal">
      <div className="rev-word-head">
        <span className="rev-word-big" lang="en">
          <span className="sr-only">{item.word}</span>
          <span aria-hidden="true">
            {parts.map((p, i) =>
              p.kind === 'mark' ? (
                <mark key={i} className="rev-word-mark">
                  {p.text}
                </mark>
              ) : p.kind === 'silent' ? (
                <s key={i} className="rev-word-silent">
                  {p.text}
                </s>
              ) : (
                <Fragment key={i}>{p.text}</Fragment>
              ),
            )}
          </span>
        </span>
        <span className="rev-word-sound">
          <span className="sr-only">đọc là </span>
          <span className="respell" lang="en">
            {item.sound}
          </span>
          {showIpa && item.ipa && <span className="ipa rev-word-ipa">{item.ipa}</span>}
        </span>
      </div>
      <div className="rev-word-play">
        <PlayButton text={audio.text} label={audio.context ? 'Nghe câu' : 'Nghe'} size="sm" variant="soft" />
        <PlayButton text={audio.text} rate={SLOW_RATE} label="Nghe chậm" size="sm" variant="ghost" />
      </div>
      {audio.context && (
        <p className="rev-word-context" lang="en">
          {audio.text}
        </p>
      )}
      {item.note && <p className="rev-word-note">{item.note}</p>}
      {item.why &&
        (storyOpen ? (
          <section className="panel rev-word-story" aria-label={`Chuyện của từ ${item.word}`}>
            <Story md={item.why} />
          </section>
        ) : (
          <details className="rev-word-why">
            <summary>Vì sao?</summary>
            <Story md={item.why} />
          </details>
        ))}
    </div>
  );
}
