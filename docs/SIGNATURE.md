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
