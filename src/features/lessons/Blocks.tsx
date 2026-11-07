import { Fragment, useId, useMemo, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, BookOpen, Lightbulb, Sparkles, Volume2 } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { decode } from '../../core/decoder';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { useSettings } from '../../core/settings';
import PlayButton from '../../components/PlayButton';
import SpokenSentence from '../../components/SpokenSentence';
import SpeakIconButton from './SpeakIconButton';
import type { LessonBlock, LessonExample, LessonSection, WordItem } from '../../data/lessonTypes';
import { citationText, contextSentence, keyOf, parseMark, parseMd, spokenHint, type MarkPart, type MdSpan } from './logic';

export const SLOW_RATE = 0.6;
/** Intro text longer than this is clamped to 3 lines on phones, with a "Xem thêm" toggle. */
const CLAMP_CHARS = 160;
/** A words block longer than this shows its first WORDS_SHOWN rows and a "Xem thêm N từ" button. */
const WORDS_COLLAPSE_OVER = 10;
const WORDS_SHOWN = 8;

type ColorStyle = CSSProperties & { '--lessons-color'?: string };

function Spans({ spans }: { spans: MdSpan[] }) {
  return (
    <>{spans.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <Fragment key={i}>{s.text}</Fragment>))}</>
  );
}

/** Render md-lite text: paragraphs, bullet lists and **bold**. */
export function Md({ md, className }: { md: string; className?: string }) {
  const blocks = useMemo(() => parseMd(md), [md]);
  return (
    <div className={['lessons-md', className].filter(Boolean).join(' ')}>
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>
            <Spans spans={b.spans} />
          </p>
        ) : (
          <ul key={i}>
            {b.items.map((item, j) => (
              <li key={j}>
                <Spans spans={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** Text of a section, clamped to 3 lines on phones (CSS) with a "Xem thêm" toggle when it is long. */
function ClampedMd({ md }: { md: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (md.length <= CLAMP_CHARS) return <Md md={md} className="lessons-text" />;
  return (
    <div className={'lessons-clamp' + (open ? ' is-open' : '')}>
      <div id={id} className="lessons-clamp-body">
        <Md md={md} className="lessons-text" />
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm lessons-clamp-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Thu gọn' : 'Xem thêm'}
      </button>
    </div>
  );
}

/** "Nghe" (natural speed) + a turtle icon button (slow) for one English text. */
export function ListenButtons({ text, say }: { text: string; say?: string }) {
  const spoken = say ?? text;
  return (
    <div className="lessons-listen" role="group" aria-label={`Nghe: ${text}`}>
      <PlayButton text={spoken} label="Nghe" size="sm" variant="soft" title="Nghe tốc độ nói tự nhiên" />
      <SpeakIconButton text={spoken} rate={SLOW_RATE} />
    </div>
  );
}

/** A decoded example: written vs spoken rows, tappable annotations, play buttons. */
export function ExampleCard({ example }: { example: LessonExample }) {
  const result = useMemo(() => decode(example.text), [example.text]);
  const [active, setActive] = useState<string | null>(null);
  const ann = active ? result.annotations.find((a) => a.id === active) : undefined;
  const info = ann ? PHENOMENON_INFO[ann.type] : undefined;
  const style: ColorStyle | undefined = info ? { '--lessons-color': info.color } : undefined;

  return (
    <li className="panel lessons-example">
      <SpokenSentence
        result={result}
        playable
        activeAnnotationId={active}
        onAnnotationClick={(id) => setActive((cur) => (cur === id ? null : id))}
      />
      {example.note && example.note.trim() !== result.spokenText.trim() && (
        <p className="lessons-example-note">{example.note}</p>
      )}
      {ann && info && (
        <p className="lessons-ann" style={style} role="status">
          <span className="lessons-ann-label">{info.label}</span>
          <span>
            <span lang="en">{ann.original}</span> <span aria-hidden="true">→</span>
            <span className="sr-only">đọc là</span> <strong lang="en">{ann.spoken}</strong>. {ann.rule}
          </span>
        </p>
      )}
      <ListenButtons text={example.text} />
    </li>
  );
}

function CompareCard({ block }: { block: Extract<LessonBlock, { type: 'compare' }> }) {
  const said = block.say ?? block.natural;
  const spoken = useMemo(() => decode(said).spokenText, [said]);
  // Same words on both sides (e.g. "I can swim."): the difference is only in sound, so show the respelling.
  const sameText = keyOf(block.clear) === keyOf(block.natural);
  const hint = spokenHint(block.natural, spoken);
  return (
    <div className="lessons-compare">
      <div className="lessons-compare-grid">
        <div className="lessons-compare-col">
          <div className="lessons-compare-label">Đọc rõ từng từ</div>
          <div className="lessons-compare-text" lang="en">
            {block.clear}
          </div>
          <PlayButton text={citationText(block.clear)} label="Nghe từng từ" size="sm" variant="ghost" />
        </div>
        <div className="lessons-compare-arrow" aria-hidden="true">
          <Icon icon={ArrowRight} size={18} className="lessons-compare-arrow-h" />
          <Icon icon={ArrowDown} size={18} className="lessons-compare-arrow-v" />
        </div>
        <div className="lessons-compare-col lessons-compare-col--natural">
          <div className="lessons-compare-label">Người bản xứ nói</div>
          {sameText && hint ? (
            <div className="lessons-compare-text respell" lang="en">
              {hint}
            </div>
          ) : (
            <>
              <div className="lessons-compare-text" lang="en">
                {block.natural}
              </div>
              {hint && (
                <div className="lessons-compare-spoken" lang="en">
                  <span className="sr-only">Đọc là: </span>≈ <span className="respell">{hint}</span>
                </div>
              )}
            </>
          )}
          <ListenButtons text={block.natural} say={block.say} />
        </div>
      </div>
      <p className="lessons-compare-note">{block.note}</p>
    </div>
  );
}

/**
 * An English word with marked letters (words block `mark`, silent-letter feedback): [..] groups are drawn in the
 * accent colour on a soft accent fill with an underline (visible even on one thin letter, in both themes), (..)
 * silent letters are faded and struck through. Screen readers hear the plain word.
 */
export function MarkedWord({ word, parts, className }: { word: string; parts: MarkPart[]; className?: string }) {
  return (
    <span className={['lessons-marked', className].filter(Boolean).join(' ')} lang="en">
      <span className="sr-only">{word}</span>
      <span aria-hidden="true">
        {parts.map((p, i) =>
          p.kind === 'mark' ? (
            <mark key={i} className="lessons-mark">
              {p.text}
            </mark>
          ) : p.kind === 'silent' ? (
            <s key={i} className="lessons-silent">
              {p.text}
            </s>
          ) : (
            <Fragment key={i}>{p.text}</Fragment>
          ),
        )}
      </span>
    </span>
  );
}

/** Two icon buttons: normal speed (Volume2) and slow (Turtle). `inSentence`: `text` is a sentence using `name`. */
export function WordListen({ text, name, inSentence = false }: { text: string; name: string; inSentence?: boolean }) {
  const what = inSentence ? `câu có “${name}”` : `“${name}”`;
  return (
    <div className="lessons-word-play" role="group" aria-label={`Nghe: ${name}`}>
      <SpeakIconButton text={text} icon={Volume2} label={`Nghe ${what}`} />
      <SpeakIconButton text={text} rate={SLOW_RATE} label={`Nghe chậm ${what}`} />
    </div>
  );
}

function WordRow({ item, showIpa }: { item: WordItem; showIpa: boolean }) {
  const parts = parseMark(item.word, item.mark) ?? [{ text: item.word, kind: 'plain' as const }];
  const id = useId();
  // Heteronyms & co. play a sentence, not the word: show it, so the learner knows what they are about to hear.
  const sentence = contextSentence(item.word, item.say);
  return (
    <li className="lessons-word">
      <div className="lessons-word-main">
        <MarkedWord word={item.word} parts={parts} className="lessons-word-text" />
        <span className="lessons-word-sound">
          <span className="sr-only">đọc là </span>
          <span className="respell" lang="en">
            {item.sound}
          </span>
          {showIpa && item.ipa && <span className="ipa lessons-word-ipa">{item.ipa}</span>}
        </span>
        {sentence && (
          <span className="lessons-word-say">
            <span className="sr-only">Nghe trong câu: </span>
            <span lang="en">{sentence}</span>
          </span>
        )}
      </div>
      <WordListen text={sentence ?? item.word} name={item.word} inSentence={!!sentence} />
      {(item.note || item.why) && (
        <div className="lessons-word-more">
          {item.note && <p className="lessons-word-note">{item.note}</p>}
          {item.why && (
            <details className="lessons-why">
              <summary aria-describedby={id}>Vì sao?</summary>
              <span id={id} className="sr-only">
                Chuyện của từ {item.word}
              </span>
              <Md md={item.why} className="lessons-why-body" />
            </details>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Word table: one calm row per word (word · respelling · [IPA] · play + slow), note and story below. A long table
 * (more than WORDS_COLLAPSE_OVER rows) shows its first WORDS_SHOWN rows and a "Xem thêm N từ" button, so a
 * section on a phone is not a wall of words.
 */
function WordsBlock({ block }: { block: Extract<LessonBlock, { type: 'words' }> }) {
  const { showIpa } = useSettings();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const collapsible = block.items.length > WORDS_COLLAPSE_OVER;
  const shown = collapsible && !open ? block.items.slice(0, WORDS_SHOWN) : block.items;
  const hidden = block.items.length - WORDS_SHOWN;
  return (
    <section className="lessons-words" aria-label={block.title ?? 'Bảng từ'}>
      {block.title && <h3 className="lessons-block-title">{block.title}</h3>}
      <ul id={listId} className="lessons-word-list">
        {shown.map((it, i) => (
          <WordRow key={`${it.word}-${i}`} item={it} showIpa={showIpa} />
        ))}
      </ul>
      {collapsible && (
        <button
          type="button"
          className="btn btn-ghost btn-sm lessons-words-more"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Thu gọn' : `Xem thêm ${hidden} từ`}
        </button>
      )}
    </section>
  );
}

/** "Vì sao lại thế?" story card: book icon, title, md-lite text, and the words it talks about (playable). */
function StoryBlock({ block }: { block: Extract<LessonBlock, { type: 'story' }> }) {
  const words = (block.words ?? []).filter((w) => w.trim());
  return (
    <aside className="lessons-story" aria-label={block.title}>
      <h3 className="lessons-story-title">
        <Icon icon={BookOpen} size={17} />
        {block.title}
      </h3>
      <Md md={block.md} />
      {words.length > 0 && (
        <ul className="lessons-story-words" aria-label="Nghe các từ trong chuyện">
          {words.map((w) => (
            <li key={w}>
              <PlayButton text={w} label={w} size="sm" variant="ghost" title={`Nghe “${w}”`} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Block({ block, clamp = false }: { block: LessonBlock; clamp?: boolean }) {
  switch (block.type) {
    case 'text':
      return clamp ? <ClampedMd md={block.md} /> : <Md md={block.md} className="lessons-text" />;
    case 'rule':
      return (
        <div className="lessons-rule">
          <div className="lessons-rule-title">
            <Icon icon={Sparkles} size={16} />
            {block.title}
          </div>
          <Md md={block.body} />
        </div>
      );
    case 'examples':
      return (
        <section className="lessons-examples" aria-label={block.title ?? 'Ví dụ'}>
          {block.title && <h3 className="lessons-block-title">{block.title}</h3>}
          <ul className="lessons-example-list">
            {block.items.map((ex) => (
              <ExampleCard key={ex.text} example={ex} />
            ))}
          </ul>
        </section>
      );
    case 'compare':
      return <CompareCard block={block} />;
    case 'tip':
      return (
        <aside className="callout lessons-tip">
          <Icon icon={Lightbulb} size={17} />
          <Md md={block.md} />
        </aside>
      );
    case 'words':
      return <WordsBlock block={block} />;
    case 'story':
      return <StoryBlock block={block} />;
  }
}

/** One section of a lesson: title + its blocks. */
export function SectionBody({ section }: { section: LessonSection }) {
  return (
    <div className="lessons-section-body">
      {section.blocks.map((b, i) => (
        // Only the opening text is clamped on phones, so the first example stays near the fold.
        <Block key={i} block={b} clamp={i === 0 && section.blocks.length > 1} />
      ))}
    </div>
  );
}
