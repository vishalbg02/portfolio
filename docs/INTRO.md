# The opening sequence

A cold visit to the home page opens with GRID waking up, then hands over to the hero. It should feel like a system
starting, not a loading screen. It is about 1.8 s on desktops and 1.3 s on phones, and nothing waits for it.

| Time (desktop) | Beat      | What you see                                                                                                                                                                                                                                                               |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–300 ms       | Wake      | The dark page with a faint contribution grid; one green square blinks in the middle                                                                                                                                                                                        |
| 300–900 ms     | Assemble  | A ripple of squares (grid levels 4 → 1) travels outward and settles. The middle flips into GRID's 5 × 5 face, which blinks. `GRID online · loading vishal-bg…` types under it                                                                                              |
| 900–1500 ms    | Hand-over | The face shrinks and flies to its home (the Omnibar; the dock's GRID button on a phone). The squares dissolve from the middle out, revealing the hero, which was painted underneath all along. The terminal starts typing `ship --all` and the H1's cursor starts blinking |
| 1.5–7.5 s      | Greeting  | GRID's one-time bubble by the Omnibar or dock: "Hi, I'm GRID, Vishal's AI…" with **Ask GRID** and **Take the tour**. It goes after 6 s or at any interaction                                                                                                               |

## How it is built

| Piece    | File                                                           | Notes                                                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision | `lib/intro/script.ts`                                          | An inline `<head>` script, about 1 KB, run before the first paint. Sets `html[data-intro]` to `play`, `skip`, `done` (skipped) or `ended`. Its exact text is executed by `tests/unit/intro-script.test.ts`.                               |
| Overlay  | `components/intro/IntroOverlay.tsx` + `styles/intro.css`       | Server-rendered markup (96 tiles and the face) and CSS animations, transform and opacity only, so it runs on the compositor while React hydrates. It is in the one global stylesheet, so it never costs a second render-blocking request. |
| Enhancer | `components/intro/IntroEnhancer.tsx` (lazy, via `IntroLoader`) | Only what needs JavaScript: the greeting, analytics (`intro_played`, `intro_skipped`, `intro_greeting_click`) and the chime.                                                                                                              |
| Replay   | `lib/intro/replay.ts`                                          | "Replay intro" in the palette, or `intro` in the terminal.                                                                                                                                                                                |

### When it plays

It plays only when **all** of these are true:

- the home page;
- first time this session;
- no `#hash`, no `?nointro` and no `?tour`;
- motion allowed (`prefers-reduced-motion` not set);
- no Save-Data, and the connection is not 2G.

Recruiter Mode is its own page, so it never plays there. A personal company link (`?c=`) plays it without the greeting, because its banner greets the visitor.

### Skipping and safety

- **Skip:** any click, tap, key, wheel or scroll skips it at once. The hero underneath works from the first frame, because the overlay has `pointer-events: none`.
- **Never stuck:**
  - The overlay only exists under `data-intro="play"` (opt-in). With JavaScript off, a script error, an inner page or reduced motion, there is nothing to remove.
  - CSS hides it at 1.8 s whatever happens, even if no JavaScript bundle ever loads.
  - A `body::before` cover keeps the nav and hero from flashing before the overlay is parsed, and that cover removes itself too (at 900 ms).
  - `tests/e2e/intro.spec.ts` removes the overlay from the HTML and checks that the page is visible within 2 s.
- **Accessibility:**
  - The overlay is `aria-hidden` and never takes focus.
  - The "Skip intro" hint is `tabindex=-1`, because keyboard users skip with any key.
  - The greeting is a polite `role="status"` with real buttons and Esc.
- **Sound:** none during the sequence. The greeting's chime plays only if sound is on **and** the visitor has already interacted on this page (`lib/sound.ts` starts its audio only after a gesture).

## Performance

The hero's text is server-rendered and painted in the first frame under the overlay, so it is still the LCP element and LCP is not delayed by the sequence. Measured locally (production build, Lighthouse mobile, median of 5 runs):

| Same build                 | LCP      | Speed Index | Perf |
| -------------------------- | -------- | ----------- | ---- |
| intro playing              | 3,141 ms | 1,862 ms    | 0.93 |
| intro skipped (`?nointro`) | 3,136 ms | 1,443 ms    | 0.93 |

The sequence costs nothing on LCP. It costs on Speed Index, which measures how soon the final picture is on screen, and that is the point of an entrance. Checkpoint 1 has the before/after against `main`.

## Turning it off

- **For one visit:** add `?nointro` to the URL.
- **For good:** remove `<IntroOverlay />` and `<IntroLoader />` from `app/page.tsx`. The head script then marks every page `skip`, and the CSS has nothing to show.
- **Tests:** e2e tests start with the intro already "seen" (`tests/e2e/fixtures.ts`). The intro's own spec opts in with `test.use({ intro: true })`.
