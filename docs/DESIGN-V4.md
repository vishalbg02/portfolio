# V4 design language: an engineer's control room

Precise, flat, layered, alive. This page is the contract every section and page follows. The tokens live in
[`styles/tokens.css`](../styles/tokens.css) and the Tailwind theme in [`app/globals.css`](../app/globals.css).
Nothing here may look like a template section.

## Rules that never change

- Dark only.
- Flat colour only: **no gradients** in CSS, SVG or canvas (`pnpm check:gradients`).
- One accent: green `#3fb950`, used for actions and "live" only.
- Blue `#58a6ff` is for inline links only.
- Project colours appear only as 8 px dots and squares:
  - Golden Verdict `#e3b341`
  - Talnio `#3fb950`
  - LanSymphony `#58a6ff`
  - Virtual Tour `#bc8cff`

## Surfaces and depth

| Layer            | Token                        | Use                                                                                                                                     |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Page             | `--bg` `#0d1117`             | everything starts here                                                                                                                  |
| Panel            | `--surface` `#161b22`        | cards, the terminal, the chat, sheets                                                                                                   |
| Raised panel     | `--surface-2` `#1c2128`      | hover, the active item, inputs on a panel                                                                                               |
| Hairline         | `--border` / `--border-2`    | 1 px only; `--border-2` for the edge you should notice                                                                                  |
| **Pixel shadow** | `--px-shadow` (`.px-shadow`) | `4px 4px 0 0 #010409`: a hard block, never blurred, on raised things only (primary buttons, the Omnibar, the terminal, cards that lift) |

**Corner brackets** (`.brackets`, `.brackets-on` for green) frame media, the terminal and key panels: 8 px L-marks
just outside the corners. They are the system's "this is a viewport" mark. Use them on at most one thing per screen.

## The square is the atom

Contribution squares (`--grid-0` … `--grid-4`) build everything that would otherwise be an icon or an ornament:

- the GRID face;
- the pixel numerals of the chapter openers;
- the LET'S BUILD banner and the footer wordmark;
- skeletons, progress ticks, the active-nav marker and the intro.

Squares sit on a grid, step instead of fade (`steps()`), and are never rotated more than 90°.

## Type, one scale

| Role        | Desktop                | Phone | Notes                              |
| ----------- | ---------------------- | ----- | ---------------------------------- |
| Hero H1     | 88 (`text-7xl`)        | 48    | Geist 600, tracking −0.035em       |
| Section H2  | 56 (`text-6xl`)        | 32    | Geist 600, tracking −0.03em        |
| H3          | 24                     | 20    | Geist 500                          |
| Body / lead | 16 / 18–20             | 16    | `--muted` for secondary text       |
| Mono label  | 12, uppercase, +0.08em | 12    | Geist Mono; labels, paths, figures |

- Every number uses tabular figures (`font-tabular`).
- The reading measure is 720 px.
- No new fonts.

## Motion

| Token         | Value                       | For                               |
| ------------- | --------------------------- | --------------------------------- |
| `--dur-1`     | 120 ms                      | hover, press, small state changes |
| `--dur-2`     | 220 ms                      | panels, the Omnibar pill ⇄ puck   |
| `--dur-3`     | 320 ms                      | dissolves, sheet entry            |
| `--dur-4`     | 600 ms                      | entrances (once)                  |
| `--ease-out`  | `cubic-bezier(.22,1,.36,1)` | anything that moves               |
| `--ease-step` | `steps(4, end)`             | anything made of squares          |
| `--stagger`   | 40 ms                       | between items of one entrance     |

- Only `transform` and `opacity` animate.
- Entrances play once.
- Under `prefers-reduced-motion` the final state shows at once and nothing moves.
- Nothing moves by itself for more than 5 s without a way to pause it (WCAG 2.2.2).

## Chapters and rhythm

Every home section opens the same way:

- a **pixel numeral** (`01`–`06`, outlined squares that fill as it enters);
- the mono label;
- the H2.

After the opener, layouts alternate (split / full / grid / split …), so no two neighbours share a pattern.

- 96 px between chapters on desktop, 64 px on phones.
- Home stays under 11,000 px at 1440 × 900 (`tests/e2e/rhythm.spec.ts`; 10,984 px at the end of Phase 3).

In code: `SectionHeader` with `chapter={n}` draws the opener (the numeral is `PixelText` inside a `Reveal`, styled in
`styles/system.css`). `PixelText` (`components/ui/PixelText.tsx`, font in `lib/pixel/text.ts`) is the one way to draw
words in squares: the numerals, LET'S BUILD and the footer's VISHAL B G. `Reveal` stays the one entrance primitive
(one-shot, final state in the markup, nothing armed under reduced motion), rather than a new `useEntrance`.

The nav is 52 px. The link of the chapter you are reading (or the page you are on) carries `aria-current` and a row
of three squares under it (`NavShell`).

The Work showcase scrolls one screen for the first project and 55 % of a screen for each next one; the scene's own
numeral is a small `1/4`, so it never competes with the chapter numeral.

## States

Every block that loads data has four designed states: loading (a square skeleton), empty, error and offline. It is never
a blank box or a spinner.

- Loading: `Skeleton` (grid squares, the island's measured height, real facts in the HTML underneath).
- Empty, error, offline: `DataState` (`components/ui/DataState.tsx`), a 3 × 3 square glyph whose lit squares say which
  state it is (not colour alone), a short line and an optional action. The one-line `inline` form sits in status rows
  (the activity calendar's year loads); the block form takes the data's place (latest activity with nothing public).
- Live status (Work, case studies): live with its latency, offline with the captures still there, unknown while checking.
- GRID: online, offline mode (answers from the site's text and says so), and per-message errors.

## Focus, selection, cursor

- Focus is one 2 px green ring with a 2 px offset.
- Selection is `--grid-2` with `--text`.
- The context cursor names what you are over.
- Touch targets are at least 44 px on coarse pointers.
