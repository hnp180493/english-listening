# Declutter plan: calm, modern, one job per screen

The user's verdict: "sao nhiều chỗ thấy vẫn không hiện đại? nhìn rối như bùi nhùi". The evidence is the Pairs page at 1630px in dark mode:

- a 940px column floating about 200px from the sidebar;
- three zero tiles for a new user;
- 9 coloured filter chips wrapping onto two lines;
- 16 cards, each with 6 kinds of information in 8 phenomenon colours, monospace "code" chips, a truncated paragraph, a bar and two 12px footers.

Every page repeats the same pattern. This plan merges three critics' reviews (density, colour-type, layout) into one set of rules plus per-page checklists.

Screenshots behind this plan are in the session scratchpad under `shots-clutter/` (fresh and `seeded/` profiles, 1600 dark, 1280 light, 375).

> Concurrency: a spaced-review feature is being added by another workflow (`src/core/review/**`, `src/features/review/**`, review hooks in dictation/pairs/lessons/shadowing/media, the nav badge, the Home plan item and the Stats section). Implementers must **not** touch those hook calls. Edit layout and markup around them. Review-owned surfaces are covered in §3.15, and they are done only after that workflow has landed.

## 0. Conflicts resolved

| Topic | Critics said | Picked | Why |
| --- | --- | --- | --- |
| Shell width | 1080 (density) / 1120 + clamp padding (layout) | **1120px**, padding `clamp(24px, 3vw, 48px)` | At 1600 the side gap drops from about 200px to about 60px. At 1280 the result is unchanged. |
| Focus pages | Narrow 760 centred (density) / 760 + 320px sticky aside (layout) | **Narrow 760 centred, no aside** | An aside would bring back the explainers, shortcuts and stats this plan removes. One column means one focus. |
| Type floor | 12px allowed in badges (density, layout) / raise the whole scale (colour-type) | **Raise the scale** to 13 / 14 / 16 / 17 / 18 | The user asked for bigger, readable type. 12px with Vietnamese stacked diacritics is the main "small text" complaint. |
| Respelling colour | `--accent` (colour-type) / `--text` (layout) | **`--text`, weight 600, `--font`** | Accent means "clickable". Respellings are content, not links. |
| Phenomenon label on list cards | `.ph-tag` with dot (colour-type) / neutral badge (density, layout) | **Plain muted text in the meta line, no dot.** `.ph-tag` (dot + label) is only used where the phenomenon *identifies one item* (drill card, decoder details, results, why-wrong) | A dot on each of 16 cards is still 8 colours on screen. |
| Pairs filter | Delete it / `.select` (density) / chip rail (layout) / neutral chips (colour-type) | **One `.select` "Mọi hiện tượng"** on the right of the "Các bộ luyện" heading. `?focus=` preselects it | Single control, no wrapping, no colours. 9 chips for 16 sets is overkill. |
| Keyboard hints | Header popover (density) / one key inside the primary button (colour-type) / aside list (layout) | **No `<kbd>` in content at all.** One shared `ShortcutsHelp` icon button in `PageHeader` actions, hidden on touch. Shortcuts move to `aria-keyshortcuts` / `title` | It is the only option that removes every hint from the reading path. |
| Eyebrows | Delete them or make them `h3` (density) / restyle `.eyebrow` (colour-type) | **Both.** Restyle `.eyebrow` globally to sentence case at 14px, and delete the redundant ones listed per page | |
| Explainers ("X là gì", steps, browser chips) | Show until first use via a localStorage flag (density) / move to aside or `<details>` (layout) | **Closed `<details class="how">` at the end of the page.** Opened by default only when that module has no history (derived from existing stores, no new storage) | Never above the first action, and no new persistence. |
| Header icon tile | Remove on desktop (density) / keep in a "route" variant (layout) | **Remove everywhere.** `PageHeader` no longer renders `RouteTile` | The sidebar's active item already shows the same icon and tint. |
| Home goal ring | Delete (density) / move to aside (layout) | **Delete.** The sidebar `.nav-goal` shows the goal on desktop; the plan header shows "2/30 lượt" plus a thin bar | One source for each number. |
| Dictation filters | "Bộ lọc" popover (both) | **One "Bộ lọc" button + shared `Popover`** (bottom sheet under 600px) | |
| Drill list controls | Search + 2 selects (density) / search + Segmented + Bộ lọc (layout) | **Search + status `Segmented` + phenomenon `.select`** | 4 options gets a Segmented, more than 4 gets a select (§2.9). |
| Drill row SRS info | "Đến hạn" badge only (density) / "Ôn lại: …" line (colour-type, layout) | **"Đến hạn" badge only, shown when due** | Fewer elements. Ease and lapse counts are SRS jargon. |
| Drill "Thẻ mới/ngày" | Move to Settings (density, layout) | **Keep in Drill**, inside a closed "Tùy chọn" `<details>` at the bottom | The value lives in the drill store, so a move would cross ownership groups (§5). |
| Stats bars | Neutral, weakest red (density) / accent mix (colour-type) / one accent (layout) | **All `--accent`, sorted, top 5, no red** | Status colour is reserved for right/wrong answers. |
| Stats layout | Cut sections (density) / 2-column dashboard (layout) | **Cut first, then 2 columns for the remaining pair** (weak spots and heatmap) | |
| Decoder first load | Truly empty (density) | **Empty input.** 3 sample chips are shown while empty | The input becomes the single focus. One click on a sample shows a full result. |
| Pairs card respelling | Remove (density) / `.respell` (colour-type) / muted text (layout) | **Remove from the card**; it lives in the round's tip | Titles already state the contrast ("can / can't"). |

**Dropped ideas:**

| Idea | Reason |
| --- | --- |
| Onboarding as a full-screen modal | Too large. A compact banner instead (§3.12). |
| `PageHeader` "session" / "route" variants | Only a `back` prop is needed (§2.8). |
| Pairs grouped by phenomenon with section labels | Adds headings. |
| Media title auto-fill from YouTube | Needs network/API work that is out of scope. |
| Per-viewer "seen explainer" flags | Storage for cosmetics. |

---

## 1. Principles (each one is testable on a screenshot)

1. **One job per screen.** Exactly one `.btn-primary` is visible, and it is the first interactive element after the header. On a phone at 375×812 it sits above y=600.
2. **One colour carries meaning.** Phenomenon colours (`--ph-*`) appear only inside `SpokenSentence` / annotated respellings, in the legend, and as a 7px dot in a `.ph-tag` that identifies a single item. A browse screen (list or grid) shows **no** phenomenon colour. Status colours (`--ok`/`--bad`) mean right or wrong answers only. `--warn` means real warnings only.
3. **Readable type.** No visible text below 13px. The only exception is the bottom tab bar labels at 12px. Body text is 16px. No uppercase tracked labels. No monospace except IPA fallback and the bulk-paste editor.
4. **At most 4 rows of information per card, and at most 1 badge per card or row.** Other metadata is plain muted text joined with " · ". No line-clamped prose ending in "…".
5. **No zeros for new users.** A metric whose value is 0 because the learner has not started is not rendered. An action is shown instead. "Chưa chơi", "0 đã học", "✓0" and "Câu 1/300 · đã làm 0" never appear.
6. **One control row above the work area, and it never wraps** at 1280 or wider. Filters with more than 4 options are a `.select` or behind "Bộ lọc".
7. **Help is opt-in.** No keyboard hints in content. Explainers longer than 2 lines are a closed `<details>` at the end of the page.
8. **Fill the screen sensibly.** Browse pages use the 1120px column. Single-task pages use a centred 760px column. At 1600 the gap between the sidebar and browse content is 80px or less.

---

## 2. System changes (group SYSTEM)

### 2.1 Shell and page templates

`src/App.layout.css`:
```css
@media (min-width: 900px) {
  .shell-main { padding: 40px clamp(24px, 3vw, 48px) 80px; }
}
.shell-content { max-width: 1120px; margin-inline: auto; }
.shell-loading { font-size: var(--fs-base); }   /* was 15px */
```

`src/index.css`, new template classes:
```css
/* Single-task screens: exercise, lesson, decoder, settings. Header + work share the same 760 column. */
.page-focus { width: 100%; max-width: 760px; margin-inline: auto; }
/* Browse screens use the full shell column; this class is a marker for grid rules. */
.page-browse { width: 100%; }
```

| Page | Template |
| --- | --- |
| Pairs picker | `page-browse` |
| Drill list | `page-browse` |
| Media library | `page-browse` |
| Stats | `page-browse` |
| Home | `page-browse` |
| Pairs round and results | `page-focus` |
| Drill review | `page-focus` |
| Dictation | `page-focus` |
| Lessons list | `page-focus` (it is a sequenced syllabus, not a grid) |
| Lesson view and quiz | `page-focus` |
| Decoder | `page-focus` |
| Shadowing | `page-focus` |
| Media player | `page-focus` |
| Settings | `page-focus` |
| Review | `page-focus` |

The class goes on the page's root `stack-lg` element. A page whose sub-view changes template (Pairs picker → round) switches the class with the view.

### 2.2 Type scale

`:root` in `src/index.css`:
```css
--fs-xs: 13px;   /* was 12 — floor: badges, counts, chart axes */
--fs-sm: 14px;   /* was 13 — meta, helper text, chips, segments */
--fs-base: 16px; /* was 15 — body */
--fs-md: 17px;   /* was 16 — h2 inside a card */
--fs-lg: 18px;   /* card titles, section titles (unchanged) */
--fs-xl: 22px; --fs-2xl: 28px; --fs-3xl: 34px; /* unchanged */
```

Replace hard-coded sizes:

| Selector | Now | New |
| --- | --- | --- |
| `index.css` `.seg-count` | 11px | `--fs-xs` |
| `index.css` `kbd, .kbd` | 12px, mono | `--fs-xs`, `--font`, 500 (only used inside `ShortcutsHelp` now) |
| `AppNav.css` `.nav-group-label` | 11px | `--fs-xs` |
| `AppNav.css` line ~85 | 14.5px | `--fs-sm` |
| `AppNav.css` `.nav-tab` | 11px | 12px, the documented sole exception |
| `SpokenSentence.css` `.ss-ipa` | 11.5px | `--fs-xs` |
| `SpokenSentence.css` `.ss--compact .ss-written`, `.ss--compact .ss-ipa` | 11px | `--fs-xs` |
| `App.layout.css` | 15px | `--fs-base` |

Feature files do the same sweep for their own raw sizes, for example `decoder.css:432`, `drill.css:343`, `pairs.css:16`, `stats.css:577/612`. The rule: grep `font-size: [0-9]` and replace every value below 13px.

`--text-subtle` is only allowed at 14px or larger. Captions at `--fs-xs` use `--text-muted`.

### 2.3 Weights

| Weight | Use |
| --- | --- |
| 400 | body |
| 500 | labels, badges, chips, unselected segments, meta |
| 600 | headings, buttons, selected segment, respellings |
| 700 | `h1`, big numbers, `.ss-block.is-changed .ss-spoken` |

Changes:
- `.badge`: 600 → 500.
- `.seg-btn`: 600 → 500. Selected segment → 600.
- `SpokenSentence.css:97`: 650 → 600 (650 is not a bundled face).

### 2.4 Colour rules

**Phenomenon allow-list.** `--ph-*` is allowed only in:
1. `.ss-*` (the changed segment's text and underline);
2. the annotation directly paired with a coloured segment (`.lessons-ann-label`, decoder detail tag and respelling), as **text only** with no tinted fill;
3. `PhenomenaGuide.tsx`;
4. `.ph-dot`.

**Phenomenon deny-list.** `--ph-*` is never used for chip or badge fill or text on cards, titles, number tiles, bars or fills, card top stripes, tinted panels, radial washes, or filter chips.

**Status colours.**
- `badge-ok` / `badge-bad`: answer feedback only.
- `badge-warn`: real warnings only.
- Never use them for level (Dễ/Vừa/Khó), SRS state, percentages or "hay sai" counts. Those become a plain `.badge` or text.

**Module tints.** Allowed only in the nav icon tiles and the Home mobile route list. Section icon tiles inside pages are removed (Settings).

**Darker phenomenon tokens in dark mode** (still at least 4.5:1 on `--surface`):

| Token | Now (dark) | New (dark) |
| --- | --- | --- |
| `--ph-h` | `#ff85c2` | `#f39ac6` |
| `--ph-elision` | `#ff8080` | `#f79090` |
| `--ph-contraction` | `#dcd46e` | `#d2cc84` |
| `--ph-flap` | `#ffa05c` | `#f5a874` |

`SpokenSentence.css` `.ss-block.is-changed::after` bar mix: 45% → 35%.

### 2.5 Respellings, IPA, mono

```css
--font-ipa: 'Segoe UI', 'Noto Sans', 'Helvetica Neue', Arial, sans-serif; /* full IPA coverage, one face per word */

.respell { font-family: var(--font); font-weight: 600; color: var(--text); letter-spacing: 0.01em; overflow-wrap: anywhere; }
.respell-sep { margin: 0 0.4em; color: var(--text-subtle); font-weight: 400; }
.ipa { font-family: var(--font-ipa); color: var(--text-muted); }
```

- Never put a box behind a respelling.
- `.respell` may take `style={{ color: info.color }}` only inside rule (2) of §2.4.
- `--mono` is allowed only on `.dict-mgr-bulk`. Every other `font-family: var(--mono)` in feature CSS is removed by its page group, using `.respell` / `.ipa` / `--font` + `tabular-nums`.
- `SpokenSentence.css:76` `.ss-ipa` → `var(--font-ipa)`.

### 2.6 Chips, badges, phenomenon tag

```css
/* Neutral by default; colour no longer comes from currentColor of the caller. */
.chip { background: var(--surface-2); color: var(--text); }
button.chip:hover { background: var(--surface-3); }
.chip[aria-pressed='true'], .chip.is-on {
  background: var(--accent-soft); color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent);
}

.ph-tag { display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px;
  border-radius: var(--radius-full); background: var(--surface-2); color: var(--text-muted);
  font-size: var(--fs-sm); font-weight: 500; line-height: 1.3; white-space: nowrap; }
.ph-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--ph, var(--text-subtle)); }
```

New `src/components/PhTag.tsx`. It renders `<span class="ph-tag" style={{'--ph': info.color}} title={info.en}><span class="ph-dot" aria-hidden/>{info.label}</span>`. English names (`info.en`) are only ever in `title`.

**Budget:**
- At most 1 badge per card or row.
- At most 1 `PhTag` per item, plus "+N" if there are more.
- Durations and "x/y" counts are muted text.

### 2.7 Labels

```css
.eyebrow { font-size: var(--fs-sm); font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--text-muted); }
```

`.nav-group-label` changes the same way. Feature groups remove `text-transform: uppercase` from:
- `home.css:340`
- `lessons.css:463` and `lessons.css:593`
- `pairs.css:526`
- `shadowing.css:706`
- `stats.css:210` and `stats.css:448`

### 2.8 Page header

`src/components/PageHeader.tsx`:
- Stop rendering `RouteTile`. Keep the `route` prop as a no-op so callers don't break.
- Add `back?: { href: string; label: string }`, rendered as a ghost `btn-sm` link with `ChevronLeft` above the `h1`. This is for Lesson view and the Media player.
- Add `help?: ReactNode`, rendered last in actions. It is normally `<ShortcutsHelp items={…} />`.
- Subtitle: one line, 70 characters or fewer, fixed copy (never live stats). On pages that are `.page-focus` it is hidden below 600px.
- `.page-head` in `index.css`: drop the tile gap rules. `actions` holds at most one primary plus one soft button, or one badge.

### 2.9 Toolbars, popover, shortcuts

**Controls by number of options:**

| Options | Control |
| --- | --- |
| 2–4 | `Segmented`; non-block on desktop, horizontally scrolling on phones |
| 5 or more, or a second filter dimension | `.select` or the "Bộ lọc" popover |

Add `.toolbar { display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); flex-wrap:nowrap }`. Below 600px the toolbar may wrap into at most 2 rows.

**New `src/components/Popover.tsx`.** Build it from the `drill/KeyboardHelp.tsx` logic: trigger button, focus into the panel, Esc and outside-click close, focus return. On screens 600px or wider it is a popover with `--surface-raised` and `--shadow-lg`. Under 600px it is a bottom sheet (`position: fixed; inset: auto 0 0 0`, `--radius-xl` top corners, `--overlay` backdrop).

**New `src/components/ShortcutsHelp.tsx`.** Props: `items: {keys: string[]; text: string}[]`. It is a ghost icon button (`Keyboard`, aria-label "Phím tắt") plus a `Popover`, with a global `?` toggle. Hide it with `@media (hover: none), (pointer: coarse) { .shortcuts-help { display: none } }`. `drill/KeyboardHelp.tsx` is replaced by it (drill group deletes the old file).

**New `src/components/FilterButton.tsx`.** A "Bộ lọc" `btn btn-sm btn-ghost` with `SlidersHorizontal` and a `.badge-accent` active-count. Children render inside the `Popover`.

### 2.10 Card and row anatomy

**Grid card** (Pairs set, Media item, Drill focus tile):
1. Title: `--fs-lg`, weight 600, one line, ellipsis. The full title goes in `title`.
2. Meta: `--fs-sm`, muted, " · " joined.
3. Optional footer: thin `.progress` plus one right-aligned label. Rendered **only when there is progress**.

Grid rules: `grid-auto-rows: 1fr` and gap `--space-4`. No hover `translateY`; hover is a `--surface-2` fill plus `--shadow-md`.

**List row** (Lessons, Drill list, Shadowing list):
- leading neutral tile or icon;
- title, plus one muted line;
- at most 1 badge, vertically centred on the title line;
- one trailing control (chevron or icon button).

**Nesting:** card → panel at most. No `.panel` inside a `.card` that only holds stats. Stats inside a card are an inline sentence.

### 2.11 Explainers and empty states

```css
details.how { border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-sm); }
details.how > summary { padding: var(--space-4) var(--space-5); font-weight: 600; cursor: pointer; list-style: none;
  display: flex; align-items: center; gap: var(--space-2); }
details.how > :not(summary) { padding: 0 var(--space-5) var(--space-5); }
```

The summary uses a muted `CircleHelp` icon plus a short label such as "Cách chơi", "Nói nhại là gì?" or "Cách lấy bản chép lời". It is always the **last** section of a page. Pass `open` when the module has no history.

### 2.12 Nav (`AppNav.tsx`, `AppNav.css`)

- Remove `.nav-brand-tag` (the tagline).
- `.nav-count`: `background: var(--surface-3); color: var(--text)`. The active item uses `--accent-soft` / `--accent`. Lime stays only on the review icon tile.
- Hide `.nav-goal-foot` when the streak is 0. `.nav-goal` text → `--fs-sm`.
- The review nav badge number must come from the same selector as the review session count. If it does not, flag it to the review workflow (§3.15).

### 2.13 `docs/design-system.md` edits

| Section | Change |
| --- | --- |
| §1 Type | Replace the type row with §2.2 and §2.3, and add `--font-ipa`. Mono is restricted to the bulk editor. Floor is 13px; `--text-subtle` only at 14px or larger. |
| §1 Phenomena | Replace the "chip with style color is accessible" sentence with the §2.4 allow/deny lists and `PhTag`. |
| §1 Module tints | Nav and Home mobile list only. No header tile. |
| §3 Layout | 1120 shell; `.page-browse` / `.page-focus` table; remove "do not narrow a page". Header has no tile. Subtitle 70 characters or fewer, fixed copy. |
| §4 Chips | `.chip` is a neutral filter; `PhTag` is for phenomena; `.badge` is neutral; status badges are for answers or warnings only. Add `.respell`, `.ipa`, `.toolbar`, `details.how`, `Popover`, `ShortcutsHelp`, `FilterButton`, and the card/row anatomy (§2.10). |
| §5 Don't | Add: no phenomenon colour on fills, titles, bars, tiles or stripes; no monospace respellings; no more than 1 badge per row; no inline `<kbd>`; no uppercase labels; no zero metrics for new users; no "…"-clamped prose in cards; no explainer above the first action. |

---

## 3. Per-page checklists

Each item reads "element → new behaviour". "Fresh" means a profile with no history.

### 3.1 Pairs picker `#/pairs` (the user's screenshot) — `SetPicker.tsx`, `pairs.css`, `src/data/pairs.ts`

- [ ] Root → add `page-browse`.
- [ ] `PageHeader` subtitle → "Nghe một câu, chọn đúng câu bạn nghe được." (no inline `<em>` examples).
- [ ] `PageHeader` actions → the primary "Trộn tất cả · 10 câu" (`Shuffle`). When `weakIds.length > 0`, add the soft "Luyện câu hay sai (N)". Add `help` with `ShortcutsHelp` (1–2, R, S, Enter).
- [ ] `section.pairs-hero` → **delete** (card, `dl.pairs-hero-stats`, `.pairs-hero-note`).
- [ ] `.pairs-sets-head` → `.toolbar`:
  - left: `h2` "Các bộ luyện", plus muted text "· 16/121 câu đã thuộc" rendered only when `totals.mastered > 0`;
  - right: `<select className="select pairs-focus">` with "Mọi hiện tượng" plus the available phenomena (VN label, no counts). `onChange` navigates to `hrefFor('pairs', {focus})`.
- [ ] `nav.pairs-filter` and the chips, `.pairs-dot` and `.pairs-filter-count` → **delete** (CSS too).
- [ ] `.pairs-grid` → keep `repeat(auto-fill, minmax(min(100%, 300px), 1fr))` (3 columns at 1120), add `grid-auto-rows: 1fr` and gap `--space-4`.
- [ ] `.pairs-set` → remove `style={phStyle(...)}` and the hover `translateY(-2px)`. The card anatomy (§2.10) becomes:
  - `.pairs-set-title` at `--fs-lg`, one line with ellipsis;
  - `.pairs-set-meta` with `{info.label} · {s.items.length} câu`, muted `--fs-sm`;
  - `.pairs-set-foot` only when `st?.plays > 0`: `.progress` with `--progress-color: var(--accent)` (or `--ok` when mastered = total), plus a right-aligned "4/8".
- [ ] Remove `.pairs-set-chip`, `.pairs-set-contrast`, `.pairs-set-desc`, `.pairs-set-weak`, `.pairs-set-best` (trophy %), and "Chưa chơi". Keep the description in `aria-label`.
- [ ] `src/data/pairs.ts` titles:
  - "walk hay walked (đuôi -ed)" → "walk hay walked"
  - "do you, did you hay would you" → "do you, did you, would you"
  - "an hay the trước nguyên âm" → "an hay the"
  - Move the dropped context into `description`.
- [ ] `details.pairs-howto` → `details.how` "Cách chơi", last on the page, `open` when no set has been played. Remove its `<kbd>` lines.
- [ ] The `!tts` and `missingSet` callouts stay (they are real warnings).

### 3.2 Pairs round and results — `RoundView.tsx`, `RoundResults.tsx`

- [ ] Root → `page-focus`.
- [ ] `.pairs-round-top` → title, "3/11", thin bar, Thoát. Remove `.pairs-score` ("✓0") and `.pairs-question-tags` (set name and coloured badge).
- [ ] Listen block → big play circle plus one ghost "Nghe chậm" (`Turtle`). Remove the "Nghe câu R" pill and every `.pairs-kbd` (9 sites). Shortcuts go to `aria-keyshortcuts`.
- [ ] Choice buttons → remove the number key squares. Keep the 1/2 keys working.
- [ ] Wrong answer → one `.callout callout-bad`:
  - line 1: "Chưa đúng · Câu được đọc: **They open it.**"
  - line 2: the item-specific tip sentence, normal text, respellings as `.respell`.
  - Remove `.pairs-cue` as a separate panel, its "MẸO NGHE" label, and the set-level contrast chips.
  - Remove "Câu này sẽ quay lại sau vài câu nữa."
- [ ] `.pairs-compare` → two rows on `--surface-2`. Each whole row is a button that plays its sentence:
  - leading 16px `Check` (`--ok`) or `X` (`--bad`), then the sentence, then a trailing muted `Volume2`;
  - the user's row adds muted "bạn chọn" (`--fs-sm`);
  - remove the full red/green fills, the "NGHE SO SÁNH" eyebrow, the per-row "Chậm" button, the number squares, `badge-ok/bad` (lines ~347–348) and "Phím 1–2…".
- [ ] "Câu tiếp" → primary, no Enter pill. Under 600px: `position: sticky; bottom: calc(72px + env(safe-area-inset-bottom))`.
- [ ] Mobile order → callout, compare rows, Câu tiếp. The tip line is collapsed behind a "Mẹo" `<details>` under 600px.
- [ ] `RoundView.tsx:212` `badge-warn` → `.badge`.
- [ ] `RoundResults` → breakdown chips (`:133`, `:206`) become `PhTag`; recovered badges become a `Check` icon plus muted text. One primary "Chơi lượt mới" and one ghost "Về danh sách".

### 3.3 Drill review `#/drill` — `DrillPage.tsx`, `DrillCard.tsx`, `FocusPicker.tsx`, `FocusPanels.tsx`

- [ ] Root → `page-focus`.
- [ ] Header:
  - title "Cụm từ" (it must equal the nav label);
  - fixed subtitle "Nghe cụm từ, gõ lại, nhớ lâu.";
  - actions: `.badge` "12 thẻ" (due + new) and `help` = `ShortcutsHelp` (the old `KeyboardHelp` list).
  - Remove the "Hôm nay: 5 cần ôn · 7 thẻ mới · 0 đã học" subtitle.
- [ ] Toolbar → only the view `Segmented` "Ôn tập | Danh sách".
- [ ] `.drill-limit` (Thẻ mới/ngày) → move into `details.how` "Tùy chọn" at the bottom of the review view.
- [ ] Card:
  - a thin `.progress` at the top of the card (done / session size, `--accent`);
  - remove `.drill-card-tags`, all `<kbd>` (3), the `badge-warn` "extra" (→ `.badge`) and the `badge-bad` "Đã quên N lần";
  - phenomenon chips (`:310`) → one `PhTag` (+N);
  - `.drill-ipa` → `.ipa`.
- [ ] Under the card → remove `.drill-queue-note` and `.drill-review-note`.
- [ ] `FocusPicker` → wrap in a closed `<details class="how">` "Luyện theo hiện tượng" below the card. Tiles neutral:
  - title in `--text` with a `.ph-dot`;
  - meta "80 cụm · 3 đến hạn" muted;
  - selected state `--accent-soft` plus accent ring;
  - remove the coloured title (`drill.css:669`) and the 10% tint.
- [ ] Focus banner → no radial wash (`drill.css` ~11, ~545). `--progress-color: var(--accent)`.
- [ ] `.drill-stat.is-due/.is-overdue/.is-lapsed dd` → `--text`.

### 3.4 Drill list ("Danh sách") — `ChunkList.tsx`

- [ ] Root → `page-browse`.
- [ ] Controls: 4 rows → one `.toolbar`:
  - `input.input` search (flex 1);
  - `Segmented` status "Tất cả · Mới · Đang học · Thuộc" (`showZeroCounts` off);
  - `.select` "Mọi hiện tượng".
  - Remove `.drill-sort`, the 8 `.drill-filter` chips and `.drill-list-count`.
  - Under 600px: search on row 1, Segmented (scrolling) on row 2.
- [ ] Rows:
  - line 1: `going to → gonna` with `gonna` as `.respell`, plus a trailing ghost icon "Nghe" button;
  - line 2: meaning, one line;
  - a `.badge` "Đến hạn" only when due.
  - Remove `.drill-row-meta` dot tags, `.drill-row-stats` (Lịch ôn / Độ dễ / Đã quên), `STATUS_BADGE` colours (Đang học/Thuộc → no badge) and the `<strong style={{color}}>` at `:176`.
- [ ] Pagination → render 30, then a "Xem thêm" button that adds 30.

### 3.5 Shadowing `#/shadowing` — `ShadowingPage.tsx`, `SourcePicker.tsx`, `PracticePanel.tsx`, `FeedbackView.tsx`, `StepGuide.tsx`

- [ ] Root → `page-focus`.
- [ ] `.shadow-intro` → split. The suggestion becomes its own `.card`:
  - `h2` "Câu nên luyện tiếp" (not an eyebrow);
  - the sentence;
  - the primary "Bắt đầu luyện câu này".
  - No nested `.panel`, and no "Đã luyện 4 câu · TB cao nhất 82%".
- [ ] "Nói nhại là gì?" and the 3 steps → `details.how` last on the page, `open` when there is no shadowing history.
- [ ] `.shadow-support` ("Trình duyệt: ✓✓✓") → rendered only as one `callout-warn` when a capability is missing.
- [ ] Picker:
  - `.shadow-tabs` → `Segmented` (not block on desktop);
  - search and the level `.select` on one `.toolbar` row;
  - remove `.shadow-count` and the `.shadow-list` `max-height` scroll box;
  - render 20 rows, then "Xem thêm".
- [ ] Rows → title, plus the score as muted "82%" right after the title on line 1. Remove the level and topic badges (`LEVEL_BADGE` → none).
- [ ] Practice:
  - remove `<kbd>` (3, plus 1 in `SourcePicker`);
  - `.shadow-ph-chip` → `PhTag`;
  - the `--shadow-ph` panel tint (`shadowing.css` ~448) → plain `.panel`;
  - `.shadow-ann-spoken` → `.respell`;
  - `.shadow-ann-ipa` → `.ipa`.
- [ ] Do not touch the review hook calls.

### 3.6 Dictation `#/dictation` — `DictationPage.tsx`, `Exercise.tsx`, `ClozeExercise.tsx`, `CustomManager.tsx`, `WhyWrong.tsx`, `SessionSummary.tsx`, `constants.ts`

- [ ] Root → `page-focus`.
- [ ] Header:
  - fixed subtitle "Nghe câu nói tự nhiên rồi gõ lại." (no `MODE_INFO[mode].hint`);
  - remove `actions={goalWidget}`;
  - `help` = `ShortcutsHelp` (Enter, Esc, Shift+Enter).
- [ ] Three control bars → one `.toolbar`:
  - left: the mode `Segmented` (Chép cả câu · Điền từ · Ôn đến hạn (N) · Câu của tôi), scrolling on phones instead of 2×2;
  - right: `FilterButton` holding level, topic and phenomenon.
  - Remove `.dict-modes` full-width tabs, `.dict-levels`, `.dict-topic` and `.dict-filters` from the page body.
- [ ] Progress → remove `.dict-progress` ("Câu 1/300 · đã làm 18" and its bar). The card's top row shows a thin bar with muted "3/10" (session goal) and nothing else.
- [ ] Exercise card:
  - remove `.dict-ex-meta` (level and topic badges; `levelBadge()` → neutral or unused), "Chưa nghe", and the Enter/Esc hint row (`Exercise.tsx`, `ClozeExercise.tsx`);
  - "Gợi ý" and "Bỏ qua" stay as ghost buttons.
- [ ] Focus banner "Đang luyện: Nối âm" → `--surface-2` background, `--text` name with a `.ph-dot`, and an ✕ to clear.
- [ ] `WhyWrong` → chip (`:14`) becomes `PhTag`; the `--dict-ph` panel tint (`dictation.css` ~576, ~888) becomes a plain `.panel`; colour stays only on the rule label text. `SessionSummary.tsx:84` gets the same treatment.
- [ ] `.dict-hint code` and the `dictation.css` mono rules (~334, ~604, ~992) → `.respell` / `--font`.
- [ ] Empty "Ôn đến hạn" or "Câu của tôi" → hide `FilterButton`.
  - Custom mode with 0 sentences shows an `empty-state` with one primary "Thêm câu". The form opens only after the click.
  - "Dán nhiều câu" stays a ghost button.
  - Delete "Độ khó được ước lượng tự động."
- [ ] Phone → the answer input starts at y ≤ 350 at 375×812.

### 3.7 Media `#/media` — `LibraryView.tsx`, `AddForm.tsx`, `PlayerView.tsx`, `WatchPanel.tsx`, `DictationPanel.tsx`, `TranscriptList.tsx`

- [ ] Library root → `page-browse`. Player root → `page-focus` with `PageHeader back={{href: hrefFor('media'), label: 'Thư viện'}}`. Replace `.media-player-pagehead`.
- [ ] `.media-hero`, `.media-steps`, `.media-privacy` → delete the card.
  - With an empty library, the library section's `empty-state` shows one line plus 3 compact numbered steps.
  - The privacy line is removed (Settings → Giới thiệu already covers it).
- [ ] Form order → link, transcript `textarea`, a "Tùy chọn" `<details>` containing "Tên gợi nhớ", then save.
  - `.media-paste` and the placeholder use `--font` with a 2-line example.
  - Remove `.media-hint` mono.
- [ ] `.media-howto` (YouTube help) → `details.how`, closed by default.
  - It opens programmatically when the pasted transcript has no timestamps.
  - 3 short steps; key names as plain text "Ctrl + C" (no `<kbd>`, `AddForm.tsx` 2 sites).
- [ ] Library items → grid card anatomy (§2.10), 3 columns at 880 or wider, `grid-auto-rows: 1fr`.
- [ ] Player:
  - `.media-list-time` → `--font` plus `tabular-nums`;
  - remove `<kbd>` (`PlayerView` 1, `DictationPanel` 1);
  - `media-why-chip` → `PhTag`;
  - the `--media-ph` panel tint (`media.css` ~696–706) → plain `.panel`;
  - `media code` → `--font` 600.
- [ ] Do not touch the review hook calls.

### 3.8 Lessons list `#/lessons` — `CourseOverview.tsx`, `LessonBits.tsx`, `lessons.css`

- [ ] Root → `page-focus`.
- [ ] `.lessons-hero` and `.lessons-hero-stat` → **delete**.
- [ ] List heading row → `h2` "Tất cả bài học" plus muted "3/10 bài" (hidden when 0), and a thin `.progress` under it only when at least 1 lesson is done.
- [ ] Next lesson row → accent outline (existing) plus an inline `btn btn-primary btn-sm` "Học tiếp" in place of the chevron ("Bắt đầu" for a fresh profile).
- [ ] `LessonNum` → neutral tile:
  - default `--surface-2` / `--text-muted`;
  - next `--accent-soft` / `--accent`;
  - done `Check` in `--text-muted`;
  - remove the phenomenon `--tile`; weight 600.
- [ ] Row meta → plain muted "9 phút · 80%" / "9 phút · Chưa đạt quiz".
  - Remove `LessonChip` (`.lessons-chip`), "Gợi ý tiếp theo", and `badge-ok` / `badge-warn` (`CourseOverview.tsx:134`, `CourseOverview.tsx:140`).
  - The description line is shown only if it does not repeat the title, clamped to 1 line **without** an ellipsis-prone paragraph (shorten in data if needed).
- [ ] `.lessons-howto` and `.lessons-howto-keys` → delete.

### 3.9 Lesson view and quiz — `LessonView.tsx`, `Blocks.tsx`, `Quiz.tsx`, `QuizResult.tsx`

- [ ] Root → `page-focus`.
- [ ] Header → `PageHeader back={{label:'Tất cả bài học'}}`, `h1` title, subtitle "Bài 1 · 8 phút".
  - Remove the check `RouteTile`, "9 ví dụ", the "Nhập môn" and "Đã học 100%" badges, and the descriptive subtitle.
  - `help` = `ShortcutsHelp`.
- [ ] Progress → one segmented bar with muted "Phần 1/4" on the right; the quiz is the last segment.
  - Remove `.lessons-dot-quiz` (the pill) and `.lessons-stepper-hint`.
- [ ] Examples (`.lessons-example`) → per example one soft `PlayButton` "Nghe" plus a ghost icon `Turtle` button.
  - Remove "Từng từ" (`SpokenSentence` already has per-word play).
  - Delete the `.lessons-tip` `callout-warn` that explains the buttons.
- [ ] `.lessons-ann` → `--surface` background, no tint. `.lessons-ann-label` keeps `--lessons-color` as text. `.lessons-example-note` → `--fs-sm` muted.
- [ ] "NGHE THỬ…" / "BẮT ĐẦU VỚI" eyebrows → sentence case (they inherit from §2.7). Delete the ones that only repeat the heading.
- [ ] `.lessons-skip` "Làm lại quiz ngay" → a ghost button inside `.lessons-stepper`, shown only when the lesson is done.
- [ ] Phone → `.lessons-text` intro clamped to 3 lines plus a "Xem thêm" toggle. The first example sits above the fold.
- [ ] Quiz:
  - remove `<kbd>` (4);
  - `--lessons-color` only on the explanation label text;
  - `.lessons-kbd` mono → removed.
- [ ] `QuizResult` → one primary.
- [ ] Do not touch `reviewHook`.

### 3.10 Decoder `#/decoder` — `DecoderPage.tsx`, `AnnotationList.tsx`, `PhenomenaGuide.tsx`, `decoder.css`

- [ ] Root → `page-focus`.
- [ ] First load → empty input (no `DEFAULT_TEXT` decode) unless `routeText` is set.
- [ ] Input card → textarea, the primary "Giải mã" and a ghost "Câu ngẫu nhiên".
  - While the input is empty, show "Thử câu mẫu" as an `h3` (`--fs-sm` 600 muted) plus 3 chips (2 under 600px), each max 32ch with ellipsis.
  - Remove "+8 câu nữa".
  - `.dec-history` "Gần đây" only when it has 2 or more entries **and** the input is empty.
  - Remove the `.dec-kbd` line. Its content goes to `ShortcutsHelp` (Enter, Shift+Enter).
- [ ] Result card:
  - header row: `SpokenSentence` plus a ghost icon "Chia sẻ liên kết" (`Link`) on the right;
  - play row: soft "Nghe" plus a ghost icon `Turtle`;
  - remove the "Từng từ" button, `.dec-sounds` ("NGHE NHƯ" and its text), `.dec-tip` ("Bấm vào một khối màu…"), `.dec-counts` and the `.chip.dec-count` chips (`:543`), and the `.dec-toggle` "Hiện IPA" (Settings has it).
- [ ] `AnnotationList` → `<details>` closed by default, summary "Chi tiết · 2 biến âm". Rows:
  - `.ph-dot`, then the VN name as coloured text (600, allowed by rule 2), then the `.respell` (phenomenon colour allowed), then `.ipa`, then a trailing ghost icon play button;
  - remove `.dec-ann-num` (the numbered circles) and `.dec-ann-en`;
  - row background `--surface-2`; only the selected row gets the 12% tint plus ring.
- [ ] "Luyện tiếp với câu này" → no eyebrow, 2 ghost links ("Chép chính tả câu này", "Nói nhại câu này") at the bottom of the result card.
- [ ] `PhenomenaGuide` → `details.how` "Học nhanh 8 hiện tượng", last.

### 3.11 Settings `#/settings` — `SettingsPage.tsx`, `SectionHead.tsx`, `SyncSection.tsx`, `settings.css`

- [ ] Root → `page-focus`. Remove the subtitle "Mọi thay đổi được lưu ngay."
- [ ] `SectionHead` → plain `h2` plus one muted line. Remove the 5 coloured icon tiles (`tint` prop ignored).
- [ ] Mục tiêu:
  - keep the presets as `Segmented` plus a "Tùy chỉnh…" ghost button that reveals `.set-range`;
  - delete `.set-today` ("Hôm nay 0/30").
- [ ] Giọng đọc:
  - "Đang dùng: …" → `.field-hint` under the select;
  - the tip callout only when the current voice name lacks "Natural".
- [ ] `.set-ex` → `.respell` / `.ipa`, not mono 12px. The sync filename → `--font` 600.
- [ ] Dữ liệu → make sure "Xóa lịch sử luyện tập" exists here (moved from Stats; same action as `stats-reset`).
- [ ] Giới thiệu → privacy bullets (`.set-privacy`) inside a closed `<details>`.

### 3.12 Home `#/` — `HomePage.tsx`, `GoalRing.tsx`, `Onboarding.tsx`, `home.css` (after the review workflow lands)

- [ ] Root → `page-browse`.
- [ ] Hero → `PageHeader` (greeting as `h1`, no tile).
  - Remove `.home-streak` at 900px and wider. Under 900px it shows only when the streak is 1 or more.
  - No "Còn 28 lượt…" subtitle.
- [ ] `.home-today` → plan card, full width:
  - header "Hôm nay" plus muted "2/30 lượt" and a thin bar;
  - remove `.home-goal` / `GoalRing`, the module chips and "Đổi mục tiêu".
- [ ] Plan items:
  - max 3 plus "Xem thêm";
  - done items collapse into one muted line "1 việc đã xong";
  - remove `.home-plan-bar` and the "gonna, wanna, kinda…" detail text;
  - the first item has the primary "Bắt đầu", the rest a chevron.
  - The review plan item (other workflow) follows the same row anatomy, with no assumptions about its markup beyond that.
- [ ] `.home-sod` (Câu của ngày) → the sentence, a soft "Nghe" and a link "Luyện câu này ›" to the decoder.
  - Remove the level and topic badges, the 2 phenomenon chips (`:252`), and the Nói nhại / Chép chính tả / Giải mã buttons.
- [ ] `.home-weak`:
  - fresh profile → not rendered;
  - otherwise: title "Điểm yếu nhất: Mất âm H" with a `.ph-dot`, the muted line "Nghe sót 4/4 câu gần đây", one `.respell` example and one soft "Luyện ngay" (Pairs focus);
  - remove the `::before` pink stripe (`home.css` ~476–482), the "H-dropping" subtitle, the red 100% and the other 3 links.
- [ ] `.home-tiles-wrap`:
  - 900px and wider → not rendered;
  - under 900px → a compact list of only Phân biệt âm, Cụm từ, Nói nhại, Video thật, Giải mã (the routes not in the tab bar), with icon tile and label, no `.home-tile-badge`.
- [ ] `.home-foot` → delete.
- [ ] Onboarding → one compact card: one sentence, a primary "Bắt đầu", a ghost "Bỏ qua". While shown, the plan's first item uses soft, not primary. Remove the `--home-ph` coloured list (`Onboarding.tsx:83`).

### 3.13 Stats `#/stats` — `StatsPage.tsx`, `stats.css` (after the review workflow lands)

- [ ] Root → `page-browse`. Fixed subtitle "Bạn đã luyện bao nhiêu và còn yếu ở đâu."
- [ ] Fresh profile → only the `empty-state` (icon, one line, primary "Luyện câu đầu tiên"). No KPIs, no duo cards, no 0/10/0 tiles.
- [ ] KPIs → 3 tiles: Chuỗi, Hôm nay, Chính xác 7 ngày. Remove "Tổng lượt".
- [ ] Ôn tập (`.stats-review`, a review-workflow surface) → one row "17 mục đến hạn · ~5 phút" plus a soft "Ôn ngay ›".
  - Sub-tiles, the per-module table and the footnote go away.
  - The 7-day forecast moves into "Lịch sử chi tiết" (below).
- [ ] 2-column grid at 1040px and wider: "Bạn yếu ở đâu" | "12 tuần gần đây" (heatmap).
- [ ] "Bạn yếu ở đâu":
  - bars `--accent` (`StatsPage.tsx:774` drops `pi.color`), sorted, top 5, with a "Xem cả 8" toggle;
  - label with `.ph-dot`;
  - remove the red "yếu nhất" badge.
  - `.stats-reco` gets title `--text`, the number `--text` 700, a `.respell`, and **one** soft action.
- [ ] `.stats-duo` (Bài học / Cụm từ) → delete.
- [ ] `<details class="how">` "Lịch sử chi tiết", last, contains:
  - the trend chart (axis `--fs-xs`);
  - the per-module table with neutral % (`.stats-tally-*` → `--text` / `--accent`), headers in sentence case;
  - the 7-day review forecast;
  - the last 10 attempts with sentence text, a 14px `Check`/`X` on a transparent background, no `.stats-recent-id`, and no chips (`:313`).
- [ ] `.stats-reset` → delete (now in Settings → Dữ liệu).

### 3.14 Shell and nav

Covered in §2.1 and §2.12.

### 3.15 Review `#/review` and review surfaces (coordinate; do after the review workflow lands)

- [ ] Root → `page-focus`, so the start card no longer floats above about 600px of void.
- [ ] `.rev-kinds` → one muted line "3 câu · 3 nhóm âm · 5 cụm từ", without icon tiles or count chips.
- [ ] `ReviewPage.tsx` ~470 `badge-warn` → `.badge`. `.rev-how` → `details.how`, last.
- [ ] **One number:** the nav badge, the Review header, the session line, the Home plan item and the Stats row all read from one selector. Today they show "17" / "11 mục · 5 phút" / "khoảng 11 phút". If a daily cap applies, show "11 mục hôm nay". This must be raised with the review workflow, not patched in page code.

---

## 4. Acceptance checks (screenshot at 1600×900 dark, 1280×800 light, 375×812; fresh and seeded)

**Global, every page:**
- The left edge of browse content is 80px or less from the sidebar at 1600.
- Only one gradient button is visible.
- No `<kbd>` is visible.
- No uppercase label is visible.
- No text is under 13px (`document.querySelectorAll('*')` computed `font-size` scan, excluding `.nav-tab-label`).
- No monospace outside the bulk editor.
- There is no horizontal scroll at 375.

| Page | Must show | Must not show |
| --- | --- | --- |
| Pairs picker, fresh | Header with "Trộn tất cả · 10 câu"; "Các bộ luyện" with a select on the right; 3-column grid of 16 even-height cards, each title + "Âm yếu · 8 câu"; "Cách chơi" open at the bottom | Any stat tile or 0; any coloured chip, dot or badge in the grid; mono text; "…"; "Chưa chơi"; a trophy; a filter row; a second line of filters |
| Pairs picker, seeded | "· 16/121 câu đã thuộc" next to the heading; bars only on played sets, in accent; "Luyện câu hay sai (8)" soft in the header | Red "hay sai" text; "0%" next to a progress bar |
| Pairs round, wrong | One red callout with the correct sentence and the tip; two neutral compare rows with ✓/✗ icons; "Câu tiếp" visible without scrolling at 375 | "✓0"; set badge; "Nghe câu R"; key squares; full red or green row fills; "NGHE SO SÁNH" / "MẸO NGHE"; contrast chips |
| Drill review | "12 thẻ" badge; card with a top progress bar; at most 1 `PhTag` | "Hôm nay: … · 0 đã học"; tags "Ôn tập · Nghe → gõ"; notes under the card; a visible 5/10/20 limit; coloured focus tiles |
| Drill list | One control row (search, Segmented, select); 30 rows of 2 lines; "Xem thêm" | Sort select; 8 rainbow chips; "192 cụm"; "Độ dễ"; "Đã quên"; yellow or green status badges; clipped "Thuộc" at 375 |
| Shadowing | Suggestion card with one primary; picker toolbar on one row; the explainer last | `.panel` inside the suggestion card; "Trình duyệt: ✓✓✓" (when everything is supported); level badges; an inner scroll box; a count line |
| Dictation | One toolbar row (modes + Bộ lọc); card with "3/10"; input at y ≤ 350 on a phone | "Câu 1/300 · đã làm"; a header goal widget; level, topic and phenomenon controls in the body; "Dễ"/"Công việc" badges; Enter/Esc hints |
| Dictation, custom empty | Empty state with "Thêm câu" | The form open and the button at the same time; filters; "Độ khó được ước lượng…" |
| Media, empty | Form first; one-line empty library with 3 steps; YouTube help closed | Hero explainer card above the form; privacy line; mono placeholder; kbd boxes |
| Lessons list | Rows with neutral number tiles; the next row with "Học tiếp"; "3/10 bài" as text | Hero card; coloured number tiles; phenomenon chips; "Gợi ý tiếp theo"; green or amber status badges; keyboard line |
| Lesson view | Back link, title, "Bài 1 · 8 phút"; one progress bar; per example "Nghe" + turtle; the first example above the fold at 375 | Route tile; level or "Đã học" badges; Quiz pill; "Từng từ" × N; a yellow tip box; key hint |
| Decoder, fresh | Empty textarea, "Giải mã", "Câu ngẫu nhiên", 3 sample chips | An auto decode; "+8 câu nữa"; "Gần đây" with fewer than 2 items; kbd line |
| Decoder, result | Annotated sentence; Nghe + turtle; collapsed "Chi tiết · N biến âm"; 2 follow-up links | "NGHE NHƯ"; "Bấm vào một khối màu…"; numbered coloured circles; English phenomenon names; IPA toggle; 3 outline buttons |
| Home, fresh | Greeting; plan card with 3 items, the first primary; Câu của ngày with Nghe + link | Goal ring; streak pill (desktop); weak-spot card; 9-tile grid (desktop); "Mới dùng lần đầu?" footer; crossed-out rows |
| Home, seeded | Weak card with one action and neutral numbers; "1 việc đã xong" | Pink stripe; red 100%; 4 link buttons; phenomenon chips in Câu của ngày |
| Stats, fresh | Empty state only | Any KPI, 0/10/0 tiles or duo cards |
| Stats, seeded | 3 KPIs; one review row; weak bars in one colour + heatmap side by side; "Lịch sử chi tiết" closed | Rainbow bars; "yếu nhất" red badge; raw ids (s044, walk-3); "Xóa lịch sử"; traffic-light percentages; more than 1 action in reco; page height over 2000px at 1600 |
| Settings | Plain section headings; presets + "Tùy chỉnh…"; "Xóa lịch sử luyện tập" under Dữ liệu | Coloured section tiles; slider and presets both visible; "Hôm nay 0/30"; mono example |
| Review | Centred 760 card; one-line kinds summary; the same count as the nav badge | Icon tiles with chips; warn badge; a lone card above a large void |
| Nav | Neutral count pills; no tagline | Lime count pill; "Bắt đầu chuỗi ngày" at streak 0 |

---

## 5. File ownership: 5 disjoint groups

Order: **SYSTEM first** (it only adds classes and changes tokens or shared looks; no feature TSX). The four page groups then run in parallel. Groups B, C and D must leave the review-hook calls intact. Group E starts only after the review workflow has landed.

| Group | Owns (exclusive) | Scope in this plan |
| --- | --- | --- |
| **A. SYSTEM** | `src/index.css`, `src/App.layout.css`, `src/components/**` (`AppNav.*`, `PageHeader.tsx`, `SpokenSentence.css`, `Segmented.tsx`, new `Popover.tsx`, `ShortcutsHelp.tsx`, `FilterButton.tsx`, `PhTag.tsx`), `docs/design-system.md` | §2 entirely, §3.14 |
| **B. Lessons + Decoder** | `src/features/lessons/**` (not `reviewHook.ts`), `src/features/decoder/**`, `src/data/lessons*` if present | §3.8, §3.9, §3.10 |
| **C. Dictation + Media** | `src/features/dictation/**`, `src/features/media/**` (not `reviewPlan.ts` / review hooks) | §3.6, §3.7 |
| **D. Pairs + Drill + Shadowing** | `src/features/pairs/**` (not `reviewHook.ts`), `src/features/drill/**` (incl. deleting `KeyboardHelp.tsx`), `src/features/shadowing/**` (not `reviewHook.ts`), `src/data/pairs.ts`, `src/data/chunks.ts` | §3.1–§3.5 |
| **E. Home + Stats + Settings** | `src/features/home/**`, `src/features/stats/**`, `src/features/settings/**`; review surfaces (`src/features/review/**`) only by hand-off from the review workflow | §3.11–§3.13, §3.15 |

**Cross-group contracts:**
- A ships `PhTag`, `Popover`, `ShortcutsHelp`, `FilterButton`, `.respell`, `.ipa`, `.ph-tag`, `.ph-dot`, `.page-focus`, `.page-browse`, `.toolbar` and `details.how` before B–E start.
- B–E only consume them.
- The Stats reset moves to Settings, both inside E.
- The drill limit stays in D.
- The count unification (§3.15) is a request to the review workflow, not a page edit.
