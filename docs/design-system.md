# Nghe Nối Âm: design system

The goal is a calm, modern learning app: **one job per screen**, few elements, few colours, large readable type, nothing shown before it has data, details behind progressive disclosure. Every page uses the tokens and shared classes below. **Read this whole file before you restyle a page**, then follow it. The reasoning behind the rules is in `docs/declutter-plan.md`.

- Tokens and shared classes: `src/index.css` (global, already loaded).
- Font: `src/fonts.css` (Be Vietnam Pro 400/500/600/700, latin + vietnamese, bundled locally). Do not add font imports or CDNs.
- Shell and nav: `src/App.layout.css`, `src/components/AppNav.*`.
- Shared components: `src/components/` (`PageHeader`, `Popover`, `ShortcutsHelp`, `FilterButton`, `PhTag`, `Segmented`, `PlayButton`, `ListenPair`, `SpokenSentence`, `Icon`).

All CSS is global. Prefix every class you add with your feature prefix (`dict-`, `pairs-`, `drill-`, `lessons-`, `dec-`, `shadow-`, `media-`, `stats-`, `set-`…). Never restyle a shared class (`.btn`, `.card`, `.chip`, `.ph-tag`…) from a feature file. If you need a variant, add a prefixed class next to it (`className="card dict-result"`).

## 0. The eight rules (each one is checkable on a screenshot)

1. **One job per screen.** Exactly one `.btn-primary` is visible, and it is the first interactive element after the header. At 375×812 it sits above y=600.
2. **One colour carries meaning.** Phenomenon colours only inside `SpokenSentence`, the annotation paired with a coloured segment, the phenomena guide and `.ph-dot` (§1 Phenomena). A browse screen (list or grid) shows **no** phenomenon colour. `--ok`/`--bad` mean right/wrong answers only; `--warn` means real warnings only.
3. **Readable type.** No visible text below 13px (the bottom tab bar labels at 12px are the only exception). Body is 16px. No uppercase tracked labels. No monospace except the bulk-paste editor.
4. **At most 4 rows of information per card and at most 1 badge per card or row.** Other metadata is plain muted text joined with " · ". No line-clamped prose ending in "…".
5. **No zeros for new users.** A metric that is 0 because the learner has not started is not rendered; show an action instead ("Chưa chơi", "0 đã học", "✓0" never appear).
6. **One control row above the work area** (`.toolbar`), and it never wraps at 1280 or wider. More than 4 options → `.select` or `FilterButton`.
7. **Help is opt-in.** No `<kbd>` or keyboard hints in content (they live in `ShortcutsHelp`). Explainers longer than 2 lines are a closed `details.how` at the end of the page.
8. **Fill the screen sensibly.** Browse pages use the 1240px column (`.page-browse`); single-task pages a centred 760px column (`.page-focus`).

---

## 1. Tokens

All colors are written once as `light-dark(light, dark)` in `src/index.css`. The theme follows `color-scheme` on `<html>`: the OS decides by default, `html[data-theme='light'|'dark']` forces one. **Never write a hex/rgb color in feature CSS.** Never write a `[data-theme='dark']` or `prefers-color-scheme` block in feature CSS: if a token is right in light mode, it is right in dark mode.

To derive a tint, mix a token: `color-mix(in srgb, var(--accent) 12%, transparent)`.

### Surfaces and lines

| Token | Use |
| --- | --- |
| `--bg` | Page background (light: cool gray `#f5f6fa`, dark: deep blue-black `#0b0d17`). |
| `--surface` | Cards, tiles, inputs. |
| `--surface-raised` | Things that sit above a card: active segment, popover, menu. In dark it is clearly lighter than `--surface-2` (`#262b47`) so a selected segment is visible. |
| `--surface-2` | Inset areas inside a card (`.panel`), hover fill, neutral chips/tags. |
| `--track` | Translucent track of `.seg` and `.progress`: reads the same on the page background and inside a card. |
| `--surface-3` | Pressed/stronger inset, ring tracks, count pills (nav count, chips hovered). |
| `--border` | Hairline divider (between two sections of one card). Use sparingly. |
| `--border-strong` | Form field outlines only. |
| `--hairline` | Translucent edge ring of cards/tiles (already applied by `.card`/`.tile`/`.item-card`/`.list-row`). |
| `--overlay` | Modal/drawer/bottom-sheet backdrop. |

### Text

| Token | Use |
| --- | --- |
| `--text` | Body, headings, respellings. |
| `--text-muted` | Secondary text, labels, metadata, captions at `--fs-xs` (≥ 5:1). |
| `--text-subtle` | Tertiary: placeholders, chevrons, separators. **Only at 14px or larger.** |

### Accent (indigo → violet)

| Token | Use |
| --- | --- |
| `--accent` | Links, active states, focus ring, progress bars. Means "clickable / selected". Text-safe on `--surface`, `--bg`, `--accent-soft`. |
| `--accent-hover` | Hover color of accent text/links. |
| `--accent-soft` / `--accent-soft-hover` | Tinted fill for selected rows, soft buttons, callouts. |
| `--accent-gradient` / `--accent-gradient-hover` | Fill of the one primary action (`.btn-primary`). Text on it: `--on-gradient` (white). |
| `--accent-contrast` | Text on a **solid** `var(--accent)` fill. Prefer `.btn-primary`/`--accent-soft` over solid accent fills. |
| `--shadow-accent` | Colored glow under gradient buttons. |

### Status

`--ok`, `--bad`, `--warn` (text/icon color) with `--ok-bg`, `--bad-bg`, `--warn-bg` (soft fills). Status text on its own `-bg` is ≥ 4.5:1.

- `--ok` / `--bad` (and `badge-ok` / `badge-bad`, `callout-ok` / `callout-bad`): **answer feedback only** (right/wrong).
- `--warn` (`badge-warn`, `callout-warn`): **real warnings only** (no TTS, missing capability, data problem).
- Never for level (Dễ/Vừa/Khó), SRS state, percentages or "hay sai" counts: those are a plain `.badge` or muted text.

### Phenomena

`--ph-linking`, `--ph-elision`, `--ph-assimilation`, `--ph-weak`, `--ph-flap`, `--ph-reduction`, `--ph-h`, `--ph-contraction`. Get them through `PHENOMENON_INFO[p].color` (already `var(--ph-…)`). Dark values are softened (still ≥ 4.5:1 on `--surface`).

**Allowed only in:**
1. `.ss-*` (SpokenSentence: the changed segment's text and underline);
2. the annotation directly paired with a coloured segment (`.lessons-ann-label`, the decoder detail name and respelling), as **text only**, no tinted fill;
3. `PhenomenaGuide.tsx`;
4. `.ph-dot` (via `<PhTag>` / `<PhDot>`).

**Never** as chip or badge fill or text on cards, titles, number tiles, bars or fills, card top stripes, tinted panels, radial washes, or filter chips. A list or grid names the phenomenon in plain muted text (`Âm yếu · 8 câu`), without a dot.

### Module tints

`--mod-home`, `--mod-review` (lime), `--mod-lessons`, `--mod-decoder`, `--mod-dictation`, `--mod-pairs`, `--mod-drill`, `--mod-shadowing`, `--mod-media`, `--mod-stats`, `--mod-listening` (cyan), `--mod-checkup` (yellow, not in the nav), `--mod-settings`. Allowed **only** in the nav icon tiles and the Home mobile route list. No header tile, no section icon tiles inside pages, no module-tinted empty states. Interactive states use `--accent`.

### Type

| Token | Size | Use |
| --- | --- | --- |
| `--fs-xs` | 13px | The floor: badges, counts, chart axes, captions (in `--text-muted`). |
| `--fs-sm` | 14px | Meta, helper text, chips, segments, `.eyebrow`, nav links. |
| `--fs-base` | 16px | Body, buttons. |
| `--fs-md` | 17px | `h3`, `h2` inside a card, `.btn-lg`. |
| `--fs-lg` | 18px | Card titles, section titles. |
| `--fs-xl` | 22px | Page title on phones. |
| `--fs-2xl` | 28px | Page title (`h1`). |
| `--fs-3xl` | 34px | Big numbers only. |

No visible text below 13px; the only exception is the bottom tab bar labels (12px). No new sizes outside the scale; never a raw `font-size: 11px`/`12px`.

| Weight | Use |
| --- | --- |
| 400 | Body. |
| 500 | Labels, badges, chips, unselected segments, meta. |
| 600 | Headings, buttons, selected segment, respellings, the changed part in `SpokenSentence`. |
| 700 | `h1`, big numbers. |

Only these four weights exist (no 650, 800).

| Family token | Use |
| --- | --- |
| `--font` | Everything, including respellings (`.respell`) and inline `code` (rendered as a 600 run of the body font). Numbers in columns: `font-variant-numeric: tabular-nums` (`.tabular`). |
| `--font-ipa` | IPA only (`.ipa`, `.ss-ipa`): faces with full IPA coverage. |
| `--mono` | **Only** the bulk-paste editor (`.dict-mgr-bulk`). Nowhere else. |

### Shape, elevation, spacing, motion

| Group | Tokens |
| --- | --- |
| Radius | `--radius-xs` 6, `--radius-sm` 10 (buttons, inputs), `--radius-md` 14 (panels, rows, popovers), `--radius-lg` 18 (cards), `--radius-xl` 24 (dialogs, bottom sheets), `--radius-full`. `--radius` = `--radius-lg` (legacy). |
| Shadow | `--shadow-xs` (buttons, rows at rest), `--shadow-sm` (cards), `--shadow-md` (hover), `--shadow-lg` (drawers, dialogs, popovers). `--shadow` = `--shadow-sm` (legacy). |
| Focus | Global `:focus-visible` outline: 2px `--focus-ring-color`, offset 2px. Fields use `box-shadow: var(--focus-ring)` + accent border. |
| Spacing | `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-7` 32 · `--space-8` 48. Use only these for gaps/margins/padding. |
| Text width | `--measure` (68ch) for paragraphs: `max-width: var(--measure)`. |
| Motion | `--dur` 140ms, `--ease`. Transitions ≤ 150ms (a progress fill may take 400–600ms). Reduced motion is handled globally. No hover `translateY` lifts: hover is a `--surface-2` fill (+ `--shadow-md` on cards). |

---

## 2. Icons

**No emoji as icons, anywhere** (nav, headers, buttons, tiles, status). Use [lucide-react](https://lucide.dev/icons) SVG icons.

```tsx
import { Mic, Check } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';

<Icon icon={Mic} />                       // 18px, stroke 2, class "icon", aria-hidden
<Icon icon={Check} size={14} strokeWidth={2.5} />
<Icon icon={Mic} label="Đang ghi âm" />   // meaningful icon on its own: gets role="img" + aria-label
<IconTile icon={Inbox} tint="var(--text-muted)" size="lg" />  // neutral tile (empty states)
```

- Inside a button, put the icon first, 15–16px (`btn-sm`: 14–15px): `<button className="btn"><Icon icon={RotateCcw} size={16} />Nghe lại</button>`.
- Icon-only buttons need `aria-label` and the `.btn-icon` class.
- Play/stop: use `<PlayButton>`; it already renders filled Play/Square icons.
- `RouteTile` / module-tinted `IconTile` are only for the nav and the Home mobile route list (§1 Module tints).
- Route icons (`ROUTE_ICON`): home Sun, review History, lessons BookOpen, decoder ScanText, dictation PencilLine, pairs Ear, drill Layers, shadowing Mic, media Clapperboard, stats TrendingUp, settings Settings.
- Useful set: `Play`, `Pause`, `Square`, `RotateCcw`, `Turtle` (slow), `Volume2`, `Mic`, `Check`, `X`, `ChevronLeft`/`ChevronRight`/`ChevronDown`, `ArrowRight`, `Lightbulb` (tip), `Info`, `CircleHelp` (explainers), `TriangleAlert`, `Sparkles`, `Target`, `Flame` (streak), `Keyboard`, `SlidersHorizontal` (filters), `Link` (share), `Eye`/`EyeOff`, `Shuffle`, `Plus`, `Trash2`, `Upload`, `Download`, `Search`, `Sun`/`Moon`/`Monitor` (theme).
- Text glyphs that are content, not icons (→ in "want to → wanna", ✓ inside a sentence diff) may stay as text.

---

## 3. Page layout

### Shell

The shell column (`.shell-content`) is **1240px** wide, centred, with `clamp(24px, 3vw, 48px)` side padding on desktop and 16px on phones, plus space for the bottom tab bar. At 1600px the gap between the sidebar's visible edge and browse content is about 65px (≤ 80px); at 1280 the column fills the space between the paddings.

### Templates

The page root (the `.stack-lg` that holds `PageHeader`) gets **one** template class:

| Class | Width | Pages |
| --- | --- | --- |
| `.page-browse` | Full shell column (1240px) | Pairs picker, Media library (with items), Stats, Home |
| `.page-focus` | Centred 760px column (header + work share it) | Pairs round and results, Drill (review and list: one column, so the header never moves when switching views), Media library while empty, Dictation, Lessons (course list, course page), Lesson view and quiz, Decoder, Shadowing, Media player, Settings, Review |

A page whose sub-view changes template (Pairs picker → round) switches the class with the view.

```tsx
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';

<div className="stack-lg page-focus dict-page">
  <PageHeader
    title="Chép chính tả"
    subtitle="Nghe câu nói tự nhiên rồi gõ lại."
    help={<ShortcutsHelp items={[{ keys: ['Enter'], text: 'Kiểm tra' }, { keys: ['Esc'], text: 'Nghe lại' }]} />}
  />

  {/* ONE control row, no card around it */}
  <div className="toolbar">
    <Segmented … />
    <FilterButton active={n} onReset={reset}>…</FilterButton>
  </div>

  {/* the main work area: ONE card */}
  <section className="card">…</section>

  {/* secondary sections: section-title + content */}
  <section className="stack">
    <h2 className="section-title">Câu của tôi</h2>
    …
  </section>

  {/* opt-in help: always last */}
  <details className="how">…</details>
</div>
```

### Page header

```tsx
<PageHeader
  title="Phân biệt âm"                                        // the page's only <h1>; the shell focuses it
  subtitle="Nghe một câu, chọn đúng câu bạn nghe được."       // ≤ 70 chars, fixed copy, never live stats
  actions={<button className="btn btn-primary">…</button>}    // ≤ 1 primary + 1 soft button, or 1 badge
  help={<ShortcutsHelp items={…} />}                          // rendered last in the actions
/>
<PageHeader back={{ href: hrefFor('lessons', { course: lesson.course }), label: 'Nghe nối âm' }} title={lesson.title} subtitle="Bài 1 · 8 phút" />
```

- No route icon tile (the `route` prop is accepted and ignored). The sidebar's active item already shows it.
- `back` renders a ghost `btn-sm` link with `ChevronLeft` above the `h1`.
- On a `.page-focus` page the subtitle is hidden below 600px.
- A hand-rolled header reuses the markup: `<header className="page-head"><div className="page-head-text"><h1 …/><p className="page-head-sub">…</p></div><div className="page-head-actions">…</div></header>`.
- Inside a `.stack*` page the header's own bottom margin is dropped automatically (the gap spaces it).

### Rhythm

- `--space-6` (24px) between page sections (`.stack-lg`), `--space-4` inside a card between groups (`.stack`), `--space-2` between tightly related items (`.stack-sm`, `.row`).
- Section heading inside a page: `<h2 className="section-title">`. Inside a card: `<h2>` at `--fs-md`, weight 600, with an optional `.badge` or text link on the right (`.row-between`).
- Small label above a group: `.eyebrow` (sentence case, 14px, muted). Delete it when it only repeats the heading next to it.
- Labels are sentence case ("Nghe so sánh", not "NGHE SO SÁNH"). Never `text-transform: uppercase`.
- Paragraph text: `max-width: var(--measure)`.
- Nesting: card → panel at most. No `.panel` inside a `.card` that only holds stats: write stats inside a card as an inline sentence.

---

## 4. Shared classes and components

### Buttons: `.btn` + variant + size

```tsx
<button className="btn btn-primary">Kiểm tra</button>        // gradient: THE main action of the view (max one visible)
<button className="btn">Bỏ qua</button>                     // default: surface + hairline + shadow-xs
<button className="btn btn-soft">Nghe lại</button>          // accent tint: important secondary action
<button className="btn btn-ghost">Gợi ý</button>            // quiet tertiary action / toolbar
<button className="btn btn-danger">Xóa dữ liệu…</button>    // destructive
<button className="btn btn-ghost btn-icon" aria-label="Nghe chậm"><Icon icon={Turtle} /></button>
<a className="btn btn-sm" href={hrefFor('drill')}>Ôn cụm từ</a>
```

Sizes: `.btn-sm` (32px), default (40px), `.btn-lg` (48px, hero actions / the main "Nghe" button), `.btn-block` (full width). `.btn` works on `<a>` and `<button>`. Disabled: `disabled` attribute (or `aria-disabled="true"` on links). Shortcuts are announced with `aria-keyshortcuts="Enter"` / `title`, never a `<kbd>` pill inside the button.

### Surfaces

```tsx
<section className="card">…</section>                  // card, radius 18, hairline + shadow-sm, 24px padding (20/16 on phones)
<div className="panel">…</div>                         // inset gray area INSIDE a card (examples, sub-groups). Never tinted.
<a className="tile" href="…">…</a>                     // legacy interactive row (hover fill, no lift). New code: .list-row
<div className="callout"><Icon icon={Lightbulb} /><div>Mẹo: …</div></div>   // tip; .callout-warn (real warning) / -ok / -bad (answers)
<hr className="divider" />
```

### Grid card anatomy (`.card-grid` + `.item-card`)

For Pairs sets, Media items, Drill focus tiles. At most 3 rows: title, meta, optional progress foot.

```tsx
<ul className="card-grid" aria-label="Các bộ luyện">
  {sets.map((s) => (
    <li key={s.id}>
      <a className="item-card" href={hrefFor('pairs', { set: s.id })} aria-label={`${s.title}. ${s.description}`}>
        <span className="item-card-title" title={s.title}>{s.title}</span>     {/* --fs-lg 600, one line, ellipsis */}
        <span className="item-card-meta">{info.label} · {s.items.length} câu</span>   {/* muted, " · " joined */}
        {st && st.plays > 0 && (                                               {/* ONLY when there is progress */}
          <span className="item-card-foot">
            <span className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            {st.mastered}/{s.items.length}
          </span>
        )}
      </a>
    </li>
  ))}
</ul>
```

- `.card-grid`: `repeat(auto-fill, minmax(min(100%, 300px), 1fr))` (3 columns at 1240), `grid-auto-rows: 1fr`, gap `--space-4`. Override the column minimum with a prefixed class if needed.
- Hover: `--surface-2` fill + `--shadow-md`, no lift. Selected: `aria-pressed="true"` / `aria-current="true"` / `.is-selected` → `--accent-soft` + accent ring.
- No phenomenon colour, no description paragraph (put it in `aria-label`), no "Chưa chơi", no trophy, no 0%.

### List row anatomy (`.list-rows` + `.list-row`)

For Lessons, Drill list, Shadowing list.

```tsx
<ul className="list-rows">
  <li>
    <a className="list-row" href={href}>
      <span className="list-row-lead">3</span>                 {/* neutral tile: number, icon or Check */}
      <span className="list-row-body">
        <span className="list-row-title">
          <span className="list-row-text">Âm yếu: to, for, of</span>
          {due && <span className="badge">Đến hạn</span>}      {/* max ONE badge, on the title line */}
        </span>
        <span className="list-row-meta">9 phút · 80%</span>   {/* ONE muted line */}
      </span>
      <span className="list-row-end"><Icon icon={ChevronRight} /></span>   {/* one trailing control */}
    </a>
  </li>
</ul>
{shown < total && <button className="btn btn-ghost list-more" onClick={more}>Xem thêm</button>}
```

- `.list-row-lead` is neutral (`--surface-2` / `--text-muted`). For the "next" item set your own prefixed class with `--accent-soft` / `--accent`.
- A row with a trailing button (e.g. a ghost "Nghe" icon button) should be a `<div className="list-row">`, not a link containing a button.
- `.list-row.is-selected` / `[aria-current='true']`: accent-soft + ring.
- Long lists: render 20–30, then a "Xem thêm" ghost button (`.list-more`) that adds the same amount. No inner scroll boxes, no "192 cụm" count lines.

### Meta text

```tsx
<span className="meta">9 phút · 3/10 bài</span>     // --fs-sm, muted, 500, tabular numbers
```

Durations, "x/y" counts and list-item phenomenon names are plain `.meta` text, not badges.

### Chips, badges, phenomenon tag

```tsx
<button className="chip" aria-pressed={on} onClick={…}>Gần đây</button>   // NEUTRAL filter/suggestion chip
<span className="badge">12 thẻ</span>                                     // neutral count / label
<span className="badge badge-accent">3 đến hạn</span>                     // the one emphasised count
<span className="badge badge-ok">Đúng</span>                              // answers only (also -bad); -warn: real warnings

import PhTag, { PhDot } from '../../components/PhTag';
<PhTag p="linking" />                    // neutral pill + 7px coloured dot + VN label; English name in title
<PhTag p={phs[0]} more={phs.length - 1} />  // one tag per item, "+N" for the rest
<h3><PhDot p="h" /> Mất âm H</h3>       // dot before a label in --text (focus banners, weak-spot titles, bar labels)
```

- `.chip` is neutral (`--surface-2` / `--text`). Selected (`aria-pressed="true"` / `.is-on`) = `--accent-soft` + accent ring. **Never** pass `style={{ color: info.color }}` to a chip.
- `PhTag` only where the phenomenon **identifies one item** (drill card, decoder details, round results, why-wrong). In browse lists and grids, write the label as `.meta` text with no dot.
- Budget: at most 1 badge per card/row; at most 1 `PhTag` per item (+N).
- `.ph-dot` can be used directly: `<span className="ph-dot" style={{ '--ph': info.color } as CSSProperties} aria-hidden="true" />`.

### Respelling and IPA

```tsx
<span className="respell">gonna</span>                         // --font 600 --text; never boxed, never mono
<span>going to<span className="respell-sep">→</span><span className="respell">gonna</span></span>
<span className="ipa">/ˈɡʌnə/</span>                           // --font-ipa, muted
<span className="respell" style={{ color: info.color }}>tel-lim</span>   // ONLY in an annotation paired with a coloured segment
```

`.respell` is content, not a link: never `--accent`. Inline `<code>` renders as a 600 run of the body font, but prefer `.respell`.

### Toolbar

The one control row above the work area. It never wraps at ≥ 600px; under 600px it may wrap into 2 rows.

```tsx
<div className="toolbar">
  <h2>Các bộ luyện <span className="meta">· 16/121 câu đã thuộc</span></h2>
  <select className="select pairs-focus" aria-label="Lọc theo hiện tượng" value={focus} onChange={…}>
    <option value="">Mọi hiện tượng</option>
    …
  </select>
</div>

<div className="toolbar">
  <input className="input toolbar-grow" type="search" placeholder="Tìm cụm từ…" aria-label="Tìm cụm từ" />
  <Segmented ariaLabel="Trạng thái" … />
  <select className="select" aria-label="Hiện tượng">…</select>
</div>

<div className="toolbar">
  <Segmented ariaLabel="Chế độ" … />
  <div className="toolbar-end"><FilterButton …>…</FilterButton></div>
</div>
```

- `.toolbar-grow` takes the slack (search) and goes full width on its own row under 600px.
- `.toolbar-start` / `.toolbar-end` group several controls; `.toolbar-end` is pushed right.
- A `.select` inside a toolbar is auto-width.

| Options | Control |
| --- | --- |
| 2–4 | `Segmented` (non-block on desktop; it scrolls horizontally on phones) |
| 5 or more, or a second filter dimension | `.select` or `FilterButton` |

### Popover

Trigger button + non-modal dialog. ≥ 600px: anchored panel (`--surface-raised`, `--shadow-lg`). < 600px: bottom sheet over `--overlay` (body scroll locked). Focus moves into the panel; Esc / the ✕ button close it and return focus to the trigger; an outside click or Tab out closes it.

```tsx
import Popover from '../../components/Popover';

<Popover
  trigger={<><Icon icon={Settings2} size={15} />Tùy chọn</>}   // button content
  triggerClassName="btn btn-ghost btn-sm"                      // default
  triggerLabel="Tùy chọn hiển thị"                             // aria-label (required for icon-only triggers)
  title="Tùy chọn"                                             // visible panel heading, names the dialog
  align="end"                                                  // 'start' | 'end' edge on desktop
  footer={(close) => <button className="btn btn-sm" onClick={close}>Xong</button>}
>
  {(close) => <…fields… onPick={() => { pick(); close(); }} />}   // or plain children
</Popover>
```

Optional: `hotkey="?"` (page-wide toggle, ignored while typing), `onOpenChange`, `className`, `panelClassName`. The wrapper has `data-popover` and the panel is `role="dialog"`: page key handlers should ignore events whose target is inside `[data-popover], [role="dialog"]`.

### ShortcutsHelp

All keyboard hints of a page, behind one ghost `Keyboard` icon button. Pass it as `PageHeader help`. `?` toggles it; it is hidden on touch devices (`(hover: none), (pointer: coarse)`). This is the **only** place `<kbd>` appears; the "?" row is added for you.

```tsx
import ShortcutsHelp from '../../components/ShortcutsHelp';

<PageHeader
  title="Cụm từ"
  help={
    <ShortcutsHelp
      items={[
        { keys: ['Enter'], text: 'Kiểm tra' },
        { keys: ['Shift', 'Enter'], text: 'Không biết, xem đáp án' },
        { keys: ['R'], text: 'Nghe lại' },
        { keys: ['1–4'], text: 'Chọn đáp án' },
      ]}
      note="Phím chữ và số không dùng được khi đang gõ."
    />
  }
/>
```

`keys` are pressed together (joined with "+"); write a range as one key (`'1–4'`). Shortcuts stay working: also expose them on the controls with `aria-keyshortcuts`.

### FilterButton

A "Bộ lọc" ghost `btn-sm` with `SlidersHorizontal` and an accent count of active filters; the fields render inside a `Popover` (bottom sheet on phones).

```tsx
import FilterButton from '../../components/FilterButton';

<FilterButton active={activeCount} onReset={resetFilters}>
  <div>
    <label className="field-label" htmlFor={levelId}>Độ khó</label>
    <select id={levelId} className="select" value={level} onChange={…}>…</select>
  </div>
  <div>
    <label className="field-label" htmlFor={topicId}>Chủ đề</label>
    <select id={topicId} className="select" value={topic} onChange={…}>…</select>
  </div>
</FilterButton>
```

`onReset` adds a "Xóa bộ lọc" button while `active > 0`. Hide the whole button when the current mode has nothing to filter.

### Explainer (`details.how`)

Opt-in help ("Cách chơi", "Nói nhại là gì?", "Cách lấy bản chép lời"). Always the **last** section of the page. `open` only when the module has no history (derive it from existing stores; no new storage).

```tsx
<details className="how" open={noHistory}>
  <summary><Icon icon={CircleHelp} size={18} />Cách chơi</summary>
  <ol className="stack-sm">…3 short steps…</ol>
</details>
```

The summary's leading icon is muted; the chevron is drawn by CSS. Each direct child after the summary gets the padding. No `<kbd>` inside.

### Form fields

```tsx
<label className="field-label" htmlFor={id}>Giọng tiếng Anh</label>
<select id={id} className="select">…</select>             // custom chevron, theme-aware
<input className="input" placeholder="Ví dụ: I'm gonna get it…" />
<textarea className="textarea" rows={3} />
<p className="field-hint">Đang dùng: Microsoft Ava (Natural)</p>
<label className="row"><input type="checkbox" className="switch" checked={on} onChange={…} /> Hiện IPA</label>
```

Range inputs, checkboxes and radios pick up `accent-color` automatically. On/off settings use the shared `.switch` (still a native checkbox). Don't write per-page switch styles.

### Segmented control

```tsx
import Segmented from '../../components/Segmented';

<Segmented
  ariaLabel="Chế độ"
  value={mode}
  onChange={setMode}
  options={[
    { value: 'normal', label: 'Chép cả câu' },
    { value: 'cloze', label: 'Điền từ' },
    { value: 'review', label: 'Ôn đến hạn', count: 3 },
  ]}
  block            // equal-width segments filling the row (optional; avoid on desktop toolbars)
/>
```

Roving focus, arrow keys, ARIA radio group. Counts of 0 are hidden; pass `showZeroCounts` only when a 0 is information. Unselected segments are 500, the selected one 600 on a raised pill. Don't recolor the selected segment per page.

### Empty state, progress

```tsx
<div className="empty-state">
  <IconTile icon={Inbox} tint="var(--text-muted)" size="lg" />
  <h2>Chưa có câu nào</h2>
  <p>Thêm câu của riêng bạn để luyện.</p>
  <div className="row"><button className="btn btn-primary">Thêm câu</button></div>
</div>
<div className={'progress' + (done ? ' is-done' : '')} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
```

- Empty state: one line, one action. It replaces zero metrics for new users.
- Progress bars are accent (`--progress-color: var(--accent)` for a flat fill) or `--ok` when complete (`.is-done`). Never tint a bar by phenomenon. Don't override `.progress > span` directly.

Ghost buttons inside a `.panel` or `.callout` hover to `--surface` automatically.

### Utilities

`.stack` / `.stack-sm` / `.stack-lg` (column gaps 16/8/24), `.row` (wrapping row, gap 8), `.row-between`, `.toolbar`, `.muted`, `.subtle`, `.meta`, `.eyebrow`, `.section-title`, `.prose` (max text width), `.tabular` (tabular numbers), `.nowrap-seg` (one unbreakable meta segment), `.sr-only`, `.page-browse` / `.page-focus`.

### Other shared components

- `PlayButton`: `variant="primary" | "soft" | "ghost"` (or legacy `primary`), `size="sm" | "md"`, `mode` (`'connected' | 'careful'`, picks the AI voice style), `icon` (rest icon, default filled Play), `ariaLabel`. Use `soft` for the usual "Nghe", `primary` only when listening IS the main action of the view. For a sentence the app shows decoded, use `ListenPair` (below) instead of a PlayButton + turtle.
- `ListenPair` + `RealVoiceLink` (`src/components/ListenPair.tsx`): see **Playback pattern**.
- `SpokenSentence`: already styled as inline annotations. With `playable`, each block's ▶ speaks the segment's speakable form (`SpokenSegment.speak`, connected style, 0.9×). Put it inside a `.panel` (with ~18px top padding for the per-word play buttons) or directly in a card; don't wrap it in a bordered box.
- `Icon` / `IconTile`.

---

### Playback pattern (connected vs careful)

The app SHOWS how a sentence is really spoken, so the main play button must SOUND like that. A TTS engine fed the
standard spelling reads like a newsreader (measured: Windows SAPI realised 0/2 reductions on "Tell him I'll call him
back.", 2/2 on "Tellim I'll callim back."). Every sentence shown with annotations therefore has two playbacks
(`src/core/playback.ts`):

| Button | Text sent to the voice | Rate | AI style |
|---|---|---|---|
| **Nghe** (soft, title "Nói nhanh như ngoài đời") | connected: content `say` ?? `DecodeResult.speakText` ?? text (`connectedText`) | learner's rate | `CONNECTED_STYLE` (fast, casual, heavy connected speech) |
| **Rõ từng từ** (ghost, Turtle icon + text, title "Đọc rõ từng từ", aria `CAREFUL_ARIA`) | the standard written text | `CAREFUL_RATE` 0.75, never above 0.8 × the learner's rate; AI voice ≈ 0.9 (its style already slows it) | `CAREFUL_STYLE` (clear, careful, slightly slow) |

```tsx
<ListenPair text={example.text} decoded={result} say={example.say} />   // Nghe + Rõ từng từ
<RealVoiceLink phrase={youglishPhrase(example.text, result)} />          // quiet "Nghe người thật nói" link
```

- The careful button carries a visible label, not only a turtle: the contrast must be understood without a tooltip
  on phones. **One label everywhere** (`CAREFUL_LABEL` "Rõ từng từ", `CAREFUL_ARIA` "Rõ từng từ: đọc chuẩn, chậm"):
  lesson cards, compare cards, dictation, drill, shadowing. A slowed CONNECTED button is titled
  `CONNECTED_SLOW_TITLE` "Nghe chậm (vẫn nối âm)" so nobody takes it for the careful one.
- Slow rates are relative (`slowRate`, applied in `speak()`): careful mode and `{ slow: true }` playbacks are never
  faster than 0.8 × the learner's rate, so a learner at 0.6 does not get "Rõ từng từ" faster than "Nghe".
- **Where the answer would be given away** (dictation, lesson listen quizzes, drill "choose" cards), the slow button
  stays connected (`CONNECTED_SLOW_RATE` 0.75, `slow`) and the careful version appears only after checking
  (dictation: quiet ghost "Rõ từng từ" under "Câu này được nói như thế nào"; quiz: the feedback's `ListenPair`).
- Dictation level 1 plays the connected version at 0.9× the learner's rate (still connected). "Từng cụm" plays each
  segment's speakable form, one-short-word chunks joined to a neighbour ("A cuppa"), always with the BROWSER voice
  (`speak(…, { browserOnly: true })`: one AI request per chunk would spend a free key's minute budget in one press).
  The checkup plays the connected version only (`audioMode: 'connected'`).
- Per-annotation ▶ (decoder "Chi tiết", dictation "Vì sao bạn nghe sai?", shadowing feedback) speak the annotation's
  own words in connected form (`Annotation.speak` via `annotationSpeech`: "I'll" alone, "Tell him" → "Tellim").
- Drill: the chunk plays its `ttsText`, the example sentence `speakableFor(example)` (connected), "Rõ từng từ" the
  written chunk. Shadowing: the model (1.0×, 0.8×, A-B, "Nghe mẫu", phrase steps) is the connected version; a
  ghost "Rõ từng từ" is the only careful playback. Home's "Câu của ngày" plays the connected version.
- Courses spelling / irregular / loanwords show sentences AS WRITTEN: their example and compare cards use
  `ListenPair asWritten` (`writtenText`: `say ?? text`, default AI style, no YouGlish link), so "I thought you"
  never becomes "thoughtcha" in a lesson about "ough".
- An authored `say` that reads differently from the generated per-segment forms hides the segment ▶ buttons of
  that example card, so the two never contradict each other.
- `RealVoiceLink`: YouGlish (`https://youglish.com/pronounce/<phrase>/english/us`, new tab, `rel="noopener
  noreferrer"`), real YouTube clips of native speakers; no embed, no key. Muted underlined text link with a 14px
  `ExternalLink` icon, on its own row under the play buttons (lesson examples, compare cards, decoder). Texts over
  4 words search the first connected stretch (2–4 words, `youglishPhrase`), because YouGlish matches exact phrases.
- Unchanged: single words (word tables, spelling quizzes: normal + slow), minimal pairs, real media audio.
- AI voice (free keys allow a few speech requests a minute, ~30 a day): only the current item is prefetched
  (`PREFETCH_AHEAD_DEFAULT = 0`), careful clips are never prefetched, and the cache key is text + style. On a 429
  the browser voice takes over quietly with the same connected text.

---

### Report charts (`ReportCharts.tsx`, `report.css`)

Charts of the progress report are inline SVG drawn at the **real pixel width** of their box (a `ResizeObserver`
sets `viewBox` = measured width), so the 13px axis labels stay 13px on a 375px phone and nothing scrolls sideways.

- Every chart has `role="img"` and an `aria-label` with the full numbers (the report's `summary`); bars and dots
  carry a `<title>`.
- Colours are tokens only: bars and lines `--accent` (the current, still running week/month fully filled), grid
  lines `--border`, the goal as a dashed `--text-muted` line with its legend under the chart (never a label inside
  the plot), plus a short solid marker over the current bar for the goal pro-rated to today.
- A point with little data behind it (a week with fewer than 10 attempts, one self-rating) is a small grey dashed
  dot (`.rep-dot.is-weak`) with "ít dữ liệu" in its title and one muted line under the chart. Never draw a 0% or
  100% from one attempt as a full point.
- X labels thin out so they never overlap; the last one ("Nay") and, for dated series, the first one are always
  shown and kept inside the drawing (`text-anchor` end/start at the edges).
- More than 26 weeks: one bar per month, never a comb of hair-thin weekly bars.
- Report cards sit in two independent columns from 1040px (`.rep-col`, cards alternate left/right), so a tall card
  never leaves a hole beside a short one. Below 1040px the columns are `display: contents` and each `.rep-cell`
  carries `order`, so phones keep the section order.

### Shell timer pill (`ListeningTimerPill`, `.ltp`)

While this browser's "Bắt đầu nghe" stopwatch exists, a quiet neutral pill (not a button style) shows the state and
the clock: desktop sidebar above the goal card ("Đang nghe 12:34", "Đang tạm dừng 12:34" — a state, never a
command), mobile top bar as icon + clock only. It is hidden on Nhật ký nghe and on Hôm nay, whose own rows already
show the clock: one clock per screen. Below 360px the brand name hides while the pill shows.

### Unbreakable meta segments (`.nowrap-seg`)

A meta line built from " · " segments ("Hôm qua · Phim/series · Hiểu 70–90%") renders each segment in a
`.nowrap-seg` span, so a phone wraps only between segments and never inside a value ("Hiểu 70– / 90%").

### Thị trấn: game art (the one exception)

`#/town` is a game: its picture is drawn on a `<canvas>` and has its own colours, the way a photo or an
illustration does. What that means, and where the exception stops:

- **Art colours live in `src/features/town/engine/palette.ts` and the rendered sprites in `src/features/town/art/`** (Kenney CC0, docs/town.md §7; `ART`, the day / night palettes, the night tint in `engine/sprites.ts`, `HUD_ART`
  for the coin, the hearts and the portraits drawn as DOM). They never appear in `town.css`, and they are never
  used for buttons, cards or text. Light theme = day, dark theme = night; night is derived from the day colours by
  one tint, so nothing is hand-picked twice.
- **Everything around and over the canvas is ordinary chrome**: `town.css` uses tokens only, every class starts
  with `town-`, 13px is still the floor (name tags painted on the canvas are 13px too), one `.btn-primary` per
  screen state (the prompt at the bottom of the town; "Nghe" before a line has sounded; "Câu tiếp"; "Về thị trấn";
  the one affordable row of the build panel).
- **Floating chips** (`.town-pill`, `.town-level`): solid `--surface` + `--hairline` + `--shadow-md`, so they read
  on the day and the night picture alike. No translucent glass, no backdrop blur.
- **Allowed here and nowhere else:** the xu counter shows `0` for a new learner (coins fly to it on the first
  answer, so it has to exist); five empty hearts; the reply cards carry a small 1 / 2 / 3 tile (hidden on touch
  devices); entry animations of 220–240ms for the panels and a few seconds of camera travel and particles on the
  canvas, all off under reduced motion.
- `--ok` / `--bad` still mean right / wrong answers only (reply cards, the verdict, the step dots); phenomenon
  colours appear only inside the `SpokenSentence` shown after an answer.

### Lesson content blocks

Lesson content (word tables, "Vì sao lại thế?" stories, choose and silent-letter quiz items) is data: the shapes,
the `mark` semantics and the TTS rules are in `docs/courses.md`. Their styles live in `lessons.css`: a word table is
rows split by hairlines (no panel per row; play and slow play as ghost icon buttons), a story is one `--surface-2`
inset with a muted `BookOpen` icon, highlighted letters are a soft accent tint and silent letters are faded and
struck through.

## 5. Do / don't

**Do**

- One gradient `.btn-primary` per view: the thing the learner should do next. Everything else is default, soft or ghost.
- Separate surfaces by background layer (`--bg` → `.card` → `.panel`) and shadow.
- Give lists of options/rows a hover fill (`--surface-2`) and a selected state with `--accent-soft` + `--accent`.
- Right/wrong feedback: soft fill (`--ok-bg`/`--bad-bg`) + coloured icon (`Check`/`X`) + text; no thick coloured borders.
- Keep copy short: a title, one subtitle line (≤ 70 characters, fixed), labels.
- Show an action instead of a zero for a new user.
- Put help last, in a closed `details.how`; put keyboard hints in `ShortcutsHelp`.
- Check at 375px: no horizontal scroll, buttons may wrap, tap targets ≥ 40px.
- Check both themes (Settings → Hiển thị) after every change.

**Don't**

- No emoji as icons.
- No phenomenon colour on fills, titles, bars, number tiles, card stripes, tinted panels, radial washes or chips. No dots or colours in browse lists/grids.
- No monospace respellings or IPA; no `font-family: var(--mono)` outside the bulk editor.
- No more than 1 badge per card or row; no status colours for levels, SRS state or percentages.
- No inline `<kbd>` or "Nhấn Enter…" hints in content.
- No uppercase labels (`text-transform: uppercase`), no letter-spaced captions.
- No text below 13px; no `--text-subtle` below 14px.
- No zero metrics for new users ("0 đã học", "Chưa chơi", "✓0").
- No "…"-clamped prose in cards.
- No explainer above the first action.
- No route/module icon tile in page headers or section headings.
- No hover `translateY` lifts.
- No bordered gray boxes inside cards (`border: 1px solid var(--border)` + `background: var(--surface-2)`): use `.panel` (no border).
- No card inside a card; no `.panel` inside a card that only holds stats.
- No `border-left: 4px solid` colour stripes on boxes.
- No hard-coded colours, no `rgb()`/hex in feature CSS, no theme-specific selectors.
- No new font sizes outside the scale, no font weights other than 400/500/600/700.
- No native-looking controls: always `.btn`, `.select`, `.input`, `.textarea`, `Segmented`.
- No paragraph wider than `--measure`; no more than two lines of muted explanation in a row.
- No transitions over 150ms on hover/press; no animation without a reduced-motion fallback.
- Don't restyle shared classes or `.ss-*`/`.nav-*`/`.shell-*`/`.ph-*`/`.popover-*` from a feature file.
