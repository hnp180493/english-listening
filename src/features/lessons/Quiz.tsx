import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, TriangleAlert, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { decode } from '../../core/decoder';
import { speak, stopSpeaking, ttsSupported } from '../../core/tts';
import PlayButton from '../../components/PlayButton';
import SpokenSentence from '../../components/SpokenSentence';
import type { ChooseItem, Lesson, ListenTypeItem, QuizItem, SilentLetterItem } from '../../data/lessonTypes';
import { MarkedWord, SLOW_RATE, WordListen } from './Blocks';
import SpeakIconButton from './SpeakIconButton';
import {
  checkAnswer,
  correctIndices,
  displayOrder,
  exactSpelling,
  isConnectedSpeechItem,
  itemAudio,
  itemSentence,
  letterDiff,
  letterDiffSummary,
  letterIndices,
  optionLabels,
  optionUnit,
  parseGap,
  silentParts,
  type QuizOutcome,
  type QuizResponse,
} from './logic';
import { useKeyboard } from './useKeyboard';
import { splitWords } from '../../core/dictation/normalize';

export interface QuizProps {
  lesson: Lesson;
  onFinish: (outcomes: QuizOutcome[]) => void;
  onExit: () => void; // back to the lesson content
  /** Rendered inside another page (Ôn tập): hides "Câu x/y" and "Xem lại bài học". */
  embedded?: boolean;
}

/** One-item-per-screen quiz with immediate feedback. */
export default function Quiz({ lesson, onFinish, onExit, embedded = false }: QuizProps) {
  const items = lesson.quiz;
  const total = items.length;
  const [seed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<QuizOutcome[]>([]);
  const nextRef = useRef<HTMLButtonElement>(null);

  const item: QuizItem | undefined = items[index];
  const current: QuizOutcome | undefined = outcomes[index];
  const order = useMemo(() => (item ? displayOrder(item, seed + index * 7919) : []), [item, seed, index]);

  // Auto-play listening items when they appear; stop audio when leaving.
  useEffect(() => {
    const audio = item ? itemAudio(item) : null;
    if (!audio) return;
    const t = window.setTimeout(() => void speak(audio), 300);
    return () => {
      window.clearTimeout(t);
      stopSpeaking();
    };
  }, [item]);

  // Move focus to "Tiếp" after answering so Enter continues.
  useEffect(() => {
    if (current) nextRef.current?.focus();
  }, [current]);

  // Guards against a second answer/advance landing before React re-renders
  // (double click, "1" then "2" in the same frame, Enter held on a button…).
  const answeredRef = useRef(-1);
  const advancedRef = useRef(-1);

  const answer = (resp: QuizResponse) => {
    if (current || !item || answeredRef.current === index) return;
    answeredRef.current = index;
    const o = checkAnswer(item, resp, lesson.course);
    setOutcomes((prev) => {
      const next = [...prev];
      next[index] = o;
      return next;
    });
  };

  const goNext = () => {
    if (!current || advancedRef.current === index) return;
    advancedRef.current = index;
    stopSpeaking();
    if (index + 1 < total) {
      setIndex(index + 1);
      window.scrollTo({ top: 0 });
    } else {
      onFinish(items.map((_, i) => outcomes[i]).filter((o): o is QuizOutcome => !!o));
    }
  };

  const replay = () => {
    const audio = item ? itemAudio(item) : null;
    if (audio) void speak(audio);
  };

  useKeyboard((e) => {
    if (!item) return false;
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      if (current) {
        goNext();
        return true;
      }
      return false;
    }
    if (e.key === 'r' || e.key === 'R') {
      replay();
      return itemAudio(item) !== null;
    }
    if (/^[1-9]$/.test(e.key) && !current && item.type !== 'listen-type' && item.type !== 'silent-letter') {
      const pos = Number(e.key) - 1;
      if (pos < order.length) {
        answer({ kind: 'choice', index: order[pos] });
        return true;
      }
    }
    return false;
  });

  if (!item) {
    return (
      <div className="card lessons-empty">
        <p>Bài này chưa có câu hỏi.</p>
        <button type="button" className="btn" onClick={onExit}>
          <Icon icon={ArrowLeft} size={16} />
          Quay lại bài học
        </button>
      </div>
    );
  }

  const isLast = index + 1 === total;

  return (
    <div className="lessons-quiz">
      {!ttsSupported() && (item.type === 'listen-choose' || item.type === 'listen-type' || (item.type === 'choose' && !!item.play)) && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={TriangleAlert} size={16} />
          <div>
            Trình duyệt này không có giọng đọc nên không phát được câu nghe. Hãy dùng Chrome, Edge hoặc Safari bản mới.
          </div>
        </div>
      )}

      <div className="card lessons-quiz-card">
        {!embedded && (
          <p className="meta lessons-quiz-count">
            Câu {index + 1}/{total}
          </p>
        )}
        <ItemView key={index} item={item} order={order} outcome={current} onAnswer={answer} />

        {current && <Feedback item={item} outcome={current} course={lesson.course} />}

        {current && (
          <div className="lessons-quiz-actions">
            <button
              ref={nextRef}
              type="button"
              className="btn btn-primary btn-lg"
              onClick={goNext}
              aria-keyshortcuts="Enter"
            >
              {isLast ? 'Xem kết quả' : 'Câu tiếp'}
              <Icon icon={ArrowRight} size={17} />
            </button>
          </div>
        )}
      </div>

      {!embedded && (
        <button type="button" className="btn btn-ghost btn-sm lessons-quiz-exit" onClick={onExit}>
          <Icon icon={ArrowLeft} size={15} />
          Xem lại bài học
        </button>
      )}
    </div>
  );
}

interface ItemViewProps {
  item: QuizItem;
  order: number[];
  outcome: QuizOutcome | undefined;
  onAnswer: (r: QuizResponse) => void;
}

function ItemView({ item, order, outcome, onAnswer }: ItemViewProps) {
  switch (item.type) {
    case 'listen-choose': {
      const audio = itemAudio(item) ?? '';
      return (
        <>
          <h2 className="lessons-q-title">
            Nghe và chọn {optionUnit(item.options)} bạn nghe được
          </h2>
          <div className="lessons-q-audio">
            <PlayButton text={audio} label="Nghe" variant="soft" />
            <SpeakIconButton text={audio} rate={SLOW_RATE} size="md" />
          </div>
          <Options item={item} order={order} outcome={outcome} onAnswer={onAnswer} english />
        </>
      );
    }
    case 'listen-type':
      return <TypeItemView item={item} outcome={outcome} onAnswer={onAnswer} />;
    case 'spot':
      return (
        <>
          <h2 className="lessons-q-title">{item.prompt}</h2>
          <p className="lessons-q-sentence" lang="en">
            {item.text}
          </p>
          <p className="lessons-q-sub muted">
            {item.unit === 'boundary' ? 'Chạm vào chỗ nối giữa hai từ:' : 'Chạm vào một từ:'}
          </p>
          <Options item={item} order={order} outcome={outcome} onAnswer={onAnswer} chips />
        </>
      );
    case 'choose':
      return <ChooseView item={item} order={order} outcome={outcome} onAnswer={onAnswer} />;
    case 'silent-letter':
      return <SilentLetterView item={item} outcome={outcome} onAnswer={onAnswer} />;
    case 'which-rule':
      return (
        <>
          <h2 className="lessons-q-title">Hiện tượng nào giải thích sự thay đổi này?</h2>
          <div className="lessons-q-rule" lang="en">
            <span className="lessons-q-written">{item.written}</span>
            <span className="lessons-q-arrow" role="img" aria-label="đọc là">
              <Icon icon={ArrowRight} size={20} />
            </span>
            <span className="lessons-q-spoken">{item.spoken}</span>
          </div>
          <Options item={item} order={order} outcome={outcome} onAnswer={onAnswer} />
        </>
      );
  }
}

interface OptionsProps {
  item: QuizItem;
  order: number[];
  outcome: QuizOutcome | undefined;
  onAnswer: (r: QuizResponse) => void;
  english?: boolean;
  chips?: boolean;
}

function Options({ item, order, outcome, onAnswer, english = false, chips = false }: OptionsProps) {
  const labels = optionLabels(item);
  const right = new Set(correctIndices(item));
  const answered = !!outcome;

  return (
    <div className={chips ? 'lessons-chips' : 'lessons-options'} role="group" aria-label="Các lựa chọn">
      {order.map((authored, pos) => {
        const isRight = right.has(authored);
        const isChosen = outcome?.chosen === authored;
        const cls = [
          chips ? 'lessons-chip-opt' : 'lessons-opt',
          answered && isRight ? 'is-correct' : '',
          answered && isChosen && !isRight ? 'is-wrong' : '',
          answered && !isRight && !isChosen ? 'is-dim' : '',
        ]
          .filter(Boolean)
          .join(' ');
        let label = labels[authored];
        if (chips && item.type === 'spot' && item.unit === 'boundary') label = label.replace(' ', '‿');
        const state = answered ? (isRight ? ', đáp án đúng' : isChosen ? ', bạn chọn — sai' : '') : '';
        return (
          <button
            key={authored}
            type="button"
            className={cls}
            disabled={answered}
            onClick={() => onAnswer({ kind: 'choice', index: authored })}
            aria-label={`${pos + 1}. ${labels[authored]}${state}`}
            aria-keyshortcuts={pos < 9 ? String(pos + 1) : undefined}
          >
            <span className="lessons-opt-label" lang={english || chips ? 'en' : undefined}>
              {label}
            </span>
            {answered && isRight && <Icon icon={Check} size={18} strokeWidth={2.5} className="lessons-opt-mark" />}
            {answered && isChosen && !isRight && (
              <Icon icon={X} size={18} strokeWidth={2.5} className="lessons-opt-mark" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Plain multiple choice: Vietnamese prompt, optional English word shown big, optional audio. */
function ChooseView({
  item,
  order,
  outcome,
  onAnswer,
}: {
  item: ChooseItem;
  order: number[];
  outcome: QuizOutcome | undefined;
  onAnswer: (r: QuizResponse) => void;
}) {
  const audio = item.play?.trim();
  return (
    <>
      <h2 className="lessons-q-title">{item.prompt}</h2>
      {item.show?.trim() && (
        <p className="lessons-q-sentence lessons-q-show" lang="en">
          {item.show}
        </p>
      )}
      {audio && (
        <div className="lessons-q-audio">
          <PlayButton text={audio} label="Nghe" variant="soft" />
          <SpeakIconButton text={audio} rate={SLOW_RATE} size="md" />
        </div>
      )}
      <Options item={item} order={order} outcome={outcome} onAnswer={onAnswer} />
    </>
  );
}

/** Tap the silent letters of a word (toggle buttons with aria-pressed), then "Kiểm tra". */
function SilentLetterView({
  item,
  outcome,
  onAnswer,
}: {
  item: SilentLetterItem;
  outcome: QuizOutcome | undefined;
  onAnswer: (r: QuizResponse) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [nudge, setNudge] = useState(false);
  const tappable = useMemo(() => new Set(letterIndices(item.word)), [item.word]);
  const silent = useMemo(() => new Set(item.silent), [item.silent]);
  const chosen = new Set(outcome ? (outcome.picked ?? []) : picked);
  const audio = itemAudio(item) ?? item.word;

  const toggle = (i: number) => {
    if (outcome) return;
    setNudge(false);
    setPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  };
  const check = () => {
    if (outcome) return;
    if (picked.length === 0) {
      setNudge(true);
      return;
    }
    onAnswer({ kind: 'set', indices: picked });
  };

  return (
    <>
      <h2 className="lessons-q-title">{item.prompt ?? 'Chạm vào các chữ câm (viết nhưng không đọc).'}</h2>
      <div className="lessons-q-audio">
        <PlayButton text={audio} label="Nghe" variant="soft" />
        <SpeakIconButton text={audio} rate={SLOW_RATE} size="md" />
      </div>
      <div className="lessons-letters" role="group" aria-label={`Các chữ cái của từ ${item.word}`} lang="en">
        {[...item.word].map((ch, i) => {
          if (!tappable.has(i)) {
            return (
              <span key={i} className="lessons-letter-gap" aria-hidden="true">
                {ch}
              </span>
            );
          }
          const on = chosen.has(i);
          const state = outcome
            ? silent.has(i)
              ? on
                ? ' is-correct'
                : ' is-missed'
              : on
                ? ' is-wrong'
                : ' is-dim'
            : '';
          const sr = outcome ? (silent.has(i) ? ', chữ câm' : on ? ', không phải chữ câm' : '') : '';
          return (
            <button
              key={i}
              type="button"
              className={'lessons-letter' + state}
              aria-pressed={on}
              aria-label={`${ch}, chữ thứ ${i + 1}${sr}`}
              disabled={!!outcome}
              onClick={() => toggle(i)}
            >
              {ch}
            </button>
          );
        })}
      </div>
      {!outcome && (
        <div className="lessons-letters-actions">
          <button type="button" className="btn btn-primary" onClick={check}>
            Kiểm tra
          </button>
          {picked.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setPicked([])}>
              Bỏ chọn
            </button>
          )}
        </div>
      )}
      {nudge && !outcome && (
        <p className="lessons-hint" role="status">
          Chạm vào ít nhất một chữ bạn nghĩ là không đọc.
        </p>
      )}
    </>
  );
}

function TypeItemView({
  item,
  outcome,
  onAnswer,
}: {
  item: ListenTypeItem;
  outcome: QuizOutcome | undefined;
  onAnswer: (r: QuizResponse) => void;
}) {
  const [value, setValue] = useState('');
  const [nudge, setNudge] = useState(false);
  const gap = parseGap(item.text);
  const audio = itemAudio(item) ?? '';
  const slots = gap ? splitWords(gap.gap).length : 1;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (outcome) return;
    if (!value.trim()) {
      setNudge(true);
      return;
    }
    onAnswer({ kind: 'text', value });
  };

  return (
    <>
      <h2 className="lessons-q-title">Nghe và điền từ còn thiếu</h2>
      <div className="lessons-q-audio">
        <PlayButton text={audio} label="Nghe" variant="soft" />
        <SpeakIconButton text={audio} rate={SLOW_RATE} size="md" />
      </div>
      <p className="lessons-q-sentence lessons-q-gapped" lang="en">
        {gap?.before}{' '}
        <span className={'lessons-gap' + (outcome ? (outcome.correct ? ' is-correct' : ' is-wrong') : '')}>
          {outcome ? gap?.gap : Array.from({ length: slots }, () => '____').join(' ')}
        </span>{' '}
        {gap?.after}
      </p>
      <form className="lessons-type-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="lessons-type-input">
          Từ còn thiếu ({slots} từ)
        </label>
        <input
          id="lessons-type-input"
          className="input"
          lang="en"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setNudge(false);
          }}
          disabled={!!outcome}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={slots > 1 ? `${slots} từ…` : '1 từ…'}
        />
        {!outcome && (
          <>
            <button type="submit" className="btn btn-primary" aria-keyshortcuts="Enter">
              Kiểm tra
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onAnswer({ kind: 'text', value: '' })}>
              Không nghe ra
            </button>
          </>
        )}
      </form>
      {nudge && !outcome && (
        <p className="lessons-hint" role="status">
          Gõ những gì bạn nghe được, sai cũng không sao.
        </p>
      )}
    </>
  );
}

function Feedback({ item, outcome, course }: { item: QuizItem; outcome: QuizOutcome; course: string }) {
  const sentence = itemSentence(item);
  // Only connected-speech items are decoded: the decoder knows phrases, not spelling (a lone word decodes to itself,
  // and a heteronym in a sentence may be respelled with the wrong vowel).
  const connected = isConnectedSpeechItem(item, course);
  const result = useMemo(() => (connected ? decode(sentence) : null), [connected, sentence]);
  return (
    <div
      className={'lessons-feedback ' + (outcome.correct ? 'is-correct' : 'is-wrong')}
      role="status"
      aria-live="polite"
    >
      <p className="lessons-feedback-head">
        <span className="lessons-feedback-icon" aria-hidden="true">
          <Icon icon={outcome.correct ? Check : X} size={15} strokeWidth={2.75} />
        </span>
        {outcome.correct ? (
          <span>{outcome.typo ? 'Đúng (chỉ sai chính tả nhẹ).' : 'Chính xác!'}</span>
        ) : item.type === 'silent-letter' ? (
          <span>
            Chưa đúng. Chữ câm: <strong lang="en">{outcome.expected}</strong>
          </span>
        ) : (
          <span>
            Chưa đúng. Đáp án: <strong lang={item.type === 'choose' ? undefined : 'en'}>{outcome.expected}</strong>
          </span>
        )}
      </p>
      {item.type === 'listen-type' && outcome.typed.trim() && !outcome.correct && (
        <TypedMistake expected={outcome.expected} typed={outcome.typed} letters={exactSpelling(course)} />
      )}
      <p className="lessons-feedback-explain">{item.explain}</p>
      {!connected && sentence.trim() && (
        <div className="lessons-feedback-word">
          {item.type === 'silent-letter' ? (
            <MarkedWord word={item.word} parts={silentParts(item.word, item.silent)} className="lessons-feedback-term" />
          ) : (
            <span className="lessons-feedback-term" lang="en">
              {sentence}
            </span>
          )}
          <WordListen text={sentence} name={item.type === 'silent-letter' ? item.word : sentence} />
        </div>
      )}
      {result && result.tokens.length > 0 && (
        <div className="lessons-feedback-decoded">
          <SpokenSentence result={result} compact />
          <div className="lessons-listen">
            <PlayButton text={sentence} label="Nghe lại" size="sm" variant="soft" />
            <SpeakIconButton text={sentence} rate={SLOW_RATE} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "Bạn gõ: …" under a wrong typed answer. In spelling-focused courses (`letters`) a "Chỗ sai" line follows: the typed
 * letters against the answer, wrong/extra ones struck in red, missing ones inserted and underlined, plus a plain
 * "thiếu b · thừa p" (what screen readers get) so the colours never carry the meaning alone.
 */
function TypedMistake({ expected, typed, letters }: { expected: string; typed: string; letters: boolean }) {
  const parts = useMemo(() => (letters ? letterDiff(expected, typed) : []), [letters, expected, typed]);
  const summary = letterDiffSummary(parts);
  if (!letters || parts.length === 0 || !summary) {
    return (
      <p className="lessons-feedback-typed">
        Bạn gõ: <span lang="en">{typed}</span>
      </p>
    );
  }
  return (
    <p className="lessons-feedback-typed lessons-typed-diff">
      <span>
        Bạn gõ: <span lang="en">{typed.trim()}</span>
      </span>
      <span>
        Chỗ sai:{' '}
        <span className="lessons-diff-word" lang="en" aria-hidden="true">
          {parts.map((p, i) =>
            p.kind === 'same' ? (
              <span key={i}>{p.text}</span>
            ) : p.kind === 'extra' ? (
              <del key={i} className="lessons-diff-extra">
                {p.text}
              </del>
            ) : (
              <ins key={i} className="lessons-diff-missing">
                {p.text}
              </ins>
            ),
          )}
        </span>{' '}
        <span className="lessons-diff-summary">({summary})</span>
      </span>
    </p>
  );
}
