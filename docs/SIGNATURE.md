# Signature features (Phase 5)

All of these are lazy, keyboard-operable, flat (`pnpm check:gradients` stays green) and have a reduced-motion variant.

## 3D Commit City

`components/sections/CommitCity.tsx` draws the Activity calendar as a city. It loads only when the **3D city** toggle is pressed.

| Part                                                                              | Where                      | Notes                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projection, painter's order, face shading, hit test, camera flight, label stagger | `lib/city/iso.ts`          | Pure functions, covered by `tests/unit/city-iso.test.ts`. Orthographic, yaw and pitch, `fitCamera` centres the grid and its tallest tower.                                                                                                                          |
| Heights                                                                           | `heightFor`                | Hairline tile for 0, then a square-root scale so one huge day does not flatten the rest. An award's tower is always taller than any day.                                                                                                                            |
| Colours                                                                           | the page's CSS tokens      | Read once at mount (`--grid-0..4`, `--id-*`), so the palette has one source. Side faces are flat shades of the top colour.                                                                                                                                          |
| Landmarks                                                                         | the calendar's award pins  | Colour = the project the award's proof page belongs to; no project = the text colour. Peak days wear a small accent flag.                                                                                                                                           |
| Interaction                                                                       | pointer, keyboard, buttons | Drag rotates (a mouse also tilts). Ctrl or Cmd + wheel zooms (a trackpad pinch sends this). A plain wheel scrolls the page; it is never trapped. Touch drags only rotate, so a vertical swipe still scrolls. Arrow keys, `+`, `-`, `0` and the toolbar do the same. |
| Narrow screens                                                                    | below 900 px               | Labels become numbered pins with a list underneath.                                                                                                                                                                                                                 |
| Cost                                                                              |                            | No idle loop: it redraws on a change only. Reduced motion jumps the camera instead of flying it.                                                                                                                                                                    |

The 2D calendar stays the default and the accessible data (monthly totals) is always in the page.

## Pixel dissolve

`reveal()` in `lib/fx/dissolve.ts` covers a thing that has just appeared with flat squares that flip off in a diagonal wave. `RouteWipe` runs it when the path changes (its code is fetched when the browser is idle, so a navigation is never delayed), and `useRevealRef` does it for dialogs (GRID panel, terminal, shortcuts). Squares are `aria-hidden` and take no pointer events. Reduced motion: nothing.

Buttons (`components/ui/Button.tsx`, `styles/fx.css`) sweep a flat fill from left to right in five steps on hover and focus; the reduced-motion variant is the plain hover colour.

## Context cursor

`components/delight/CursorHost.tsx` mounts `ContextCursor` only for a mouse or pen with hover and motion allowed. Mark an element with `data-cursor="open | play | drag | copy | ask"` and the square grows into that label over it (the native cursor is hidden only there). It steps aside over text fields.

## Stack map

Skills (grouped by area) on the left, projects on the right. `lib/stack/usage.ts` decides which project used which skill from each project's `stack`; the map draws a faint wire for each of those and lights the wires of what you pick. Phones get an accordion. A skill no project used is still a button: it says so, quotes `profile.skillsNote` (where it was learned) and offers "Ask GRID where".

## Contact: vCard and QR

`lib/contact/vcard.ts` builds a vCard 3.0 from `content/profile.ts` only (name, role, phone, email, site, LinkedIn, GitHub, city). `app/vishal-b-g.vcf/route.ts` serves it statically, inline, so a phone that scans the QR code offers "Add contact". `lib/contact/qr.ts` makes the QR matrix at build time (`qrcode-generator`); `ContactQR` draws one SVG path, dark modules on a light tile because that is what scanners read reliably. `tests/unit/contact-card.test.ts` decodes the code back with `jsqr`.

## When a placeholder's height changes

The lazy sections hold their place with a skeleton that is as tall as the real thing. After changing the content or layout of Activity, Stack, the Contact form or the GRID chat, re-measure: `pnpm build && pnpm start --port 3300`, then `pnpm islands --write` (and, for the chat, update the `h-[…]` classes of `ChatSkeleton` in `components/grid/LazyGridChat.tsx`). `tests/e2e/islands.spec.ts` and the layout-shift test fail when they drift.

---

# Phase 6: the page that notices you

## Keyboard navigation

`lib/keys.ts` (pure, tested) and `components/palette/ShortcutsHost.tsx`. `j` and `k` move to the next and previous section (`main > section`) and put keyboard focus on it so a screen reader says where you are; a second press while the page is still gliding goes one further. `g` then a letter jumps (`g w` Work, `g e` Experience, `g a` Activity, `g s` Stack, `g g` GRID, `g c` Contact, `g h` top); `t` starts the tour. None of it runs while you are typing or while a dialog has the keyboard. Listed in the `?` overlay.

## The 60-second tour

`content/tour.ts` is the script: six stops, each caption a function of `content/profile.ts` (a test checks that every name, role, period, count and contact detail in it comes from the profile). `components/tour/Tour.tsx` scrolls to each stop, outlines its heading (`data-tour-hit`), shows the caption while GRID's face "speaks" and marks the section on the Grid Rail. Each stop stays 10 s; Pause, Previous, Next and Exit are buttons and keys (Space, left and right arrows, Esc). Voice is optional and off. Under reduced motion it starts paused and the page jumps. Started by the hero link, `t`, the Omnibar, `/?tour=1`, or GRID (`start_tour`: a card with a button, and "take me on a tour" works with no model). `TourHost` is always mounted but only listens; the tour's code loads when it starts.

## Explorer achievements

`lib/achievements.ts`: eight things to find (terminal, a terminal command, Snake, CosmoStrike, the tour, asking GRID, the 3D city, an Omnibar command). Stored in this browser's localStorage only; the one thing sent is the anonymous `secret_found` event with the id. They light squares under the Grid Rail and count in the footer chip ("3/8 discovered"), which opens the list with a hint for each one not yet found.

## Sound

`lib/sound.ts`: off by default, synthesised with Web Audio (no audio files), quiet (no cue above 0.05 gain), rate-limited per cue. The audio context is only made inside a click or key press, so nothing plays before you have interacted, even when the choice from an earlier visit is "on". Cues: a key tick in the terminal, a click when a Work scene changes, a two-note chime when a message to Vishal is delivered or he replies. Switch in the footer.

## Night mode and the nav ticker

Between midnight and 7 in Bengaluru (UTC+5:30) the hero's availability line says "Vishal's probably asleep, GRID is on duty" (`lib/night.ts`; the page is still static, the line swaps after hydration). The nav shows the latest GitHub activity under the wordmark from lg up: the text comes from the GitHub data the page already has, cleaned and shortened (`lib/github/ticker.ts`); only "2 hours ago" is worked out in the browser.

## Visitor wall

The footer lights one square per visitor on the site right now. A visible tab sends `POST /api/here` with a random id made for that tab every 30 seconds (a sorted set in Redis, kept 75 s; two commands per beat, and the list is re-read at most every 15 s per instance). It stops after 30 minutes. Without Redis the route says "not configured" and the wall stays dim at the same size. Nothing but the random id is sent; see `/privacy`.

## Personal links

`/link Infosys SDE` in the Telegram bot makes `https://vishalbg.vercel.app/?c=<id>.<signature>` (the signature is an HMAC of the random id, so a made-up code is refused before anything is looked up; the label is stored in Redis for 90 days). For a longer company name use `|`: `/link Tata Consultancy | Java Developer`. `/links` lists the last ten with how often each was opened.

Opening one (`components/links/`): the code is taken out of the address bar and kept for the tab; `GET /api/link` returns only the company and role Vishal typed; a banner says "Hi Infosys team" and, under "What's relevant", ranks the projects and skills for that role with plain rules over the profile (`lib/links/role.ts`: no model, nothing invented) and outlines the matching project cards. It also offers "Ask GRID about fit" and "Tailored résumé". Vishal is told on Telegram when the link is first opened (once per 6 hours), when the résumé is downloaded from it and when a chat with GRID starts (once an hour each). No name, email or IP is part of any of it. The page stays static; everything happens after hydration, over the page (a fixed banner) so nothing moves.
