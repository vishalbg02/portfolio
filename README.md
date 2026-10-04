# ~/vishalbg — Everything Ships

Personal portfolio of **Vishal B G**, full-stack developer (Bengaluru). The site itself is built as a product: GitHub-dark, flat, fast, accessible, and every fact comes from one typed file.

**Live:** https://vishalbg.vercel.app

## Stack

Next.js 16 (App Router, RSC, Turbopack) · React 19 · TypeScript 6 (strict) · Tailwind CSS 4 · Radix UI · cmdk · Zod · Vitest · Playwright + axe · Lighthouse CI · Vercel

## Getting started

```bash
nvm use            # Node 22 (see .nvmrc)
corepack enable    # or: npm i -g pnpm@10.34.5
pnpm install
pnpm dev           # http://localhost:3000
```

No environment variables are required. Every integration degrades gracefully when its variable is missing. Copy `.env.example` to `.env.local` to enable the optional features.

| Variable                                                                                            | Enables                                          | Fallback when missing               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------- |
| `GEMINI_API_KEY`                                                                                    | GRID (AI) + JD matcher (first route)             | Next route, else "offline" answers  |
| `GROQ_API_KEY`                                                                                      | Backup AI route (gpt-oss-120b / 20b)             | Skipped                             |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`                                                            | Messages from GRID to Vishal's phone             | Email only, else a `mailto:` offer  |
| `TELEGRAM_WEBHOOK_SECRET`, `LIVE_CHAT_SIGNING_SECRET`, `CRON_SECRET` (+ Telegram and Upstash above) | Live chat, signed thread links, the daily digest | "Leave a message" instead           |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`                                            | Optional bot check on a first live message       | Honeypot, limits and caps only      |
| `GITHUB_TOKEN`                                                                                      | Live calendar, activity, year switcher           | Committed snapshots in `generated/` |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`                                                                | Contact form delivery (see below)                | `mailto:` + copy-email              |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                | Shared rate limits / daily AI cap                | Per-instance in-memory limiter      |
| `NEXT_PUBLIC_SITE_URL`                                                                              | Canonical URLs, sitemap, OG                      | `https://vishalbg.vercel.app`       |
| `NEXT_PUBLIC_GSC_VERIFICATION`                                                                      | Google Search Console meta tag                   | Omitted                             |
| `SHOW_RECOGNITION`                                                                                  | Award pins on the calendar                       | `true`                              |
| `AI_DAILY_LIMIT`                                                                                    | Global daily cap on AI calls                     | `400`                               |
| `SHOW_DRAFTS`                                                                                       | Show Ship Log drafts in a build                  | Hidden in production                |

## Scripts

| Command                 | What it does                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`             | ESLint, then the **no-gradient guard**, then Prettier check                                                               |
| `pnpm typecheck`        | `next typegen`, then `tsc --noEmit`                                                                                       |
| `pnpm test`             | Vitest unit tests                                                                                                         |
| `pnpm build`            | Production build (all pages static)                                                                                       |
| `pnpm check:bundle`     | Fails if the home route's initial JS is over **170 KB gzipped** (run after build)                                         |
| `pnpm e2e`              | Playwright e2e + axe against the production build                                                                         |
| `pnpm resume`           | Validates and builds the résumé PDF (`--open` to view); see docs/UPDATING-RESUME.md                                       |
| `pnpm embeddings`       | Re-embeds changed content chunks (needs `GEMINI_API_KEY`); commit `generated/embeddings.json`                             |
| `pnpm check:embeddings` | Warns if the committed embeddings are stale. Never fails, never calls the API                                             |
| `pnpm snapshot:github`  | Refreshes `generated/github-snapshot.json` and `github-years.json` (`GITHUB_TOKEN=$(gh auth token) pnpm snapshot:github`) |
| `pnpm analyze`          | Turbopack bundle analyzer (`next experimental-analyze`)                                                                   |
| `pnpm verify`           | Everything above, in CI order                                                                                             |

## Content

All facts live in [`content/profile.ts`](content/profile.ts), validated by a Zod schema ([`lib/content/profile-schema.ts`](lib/content/profile-schema.ts)). Pages, the AI assistant, JSON-LD and the résumé PDF all read from it. Unknown values are `null` with a `TODO(vishal)` comment, and the UI hides them. Never hard-code facts in components.

### Updating the résumé

The PDF at `/resume.pdf` and the page at `/resume` are generated from `content/profile.ts` (shared facts) and `content/resume.ts` (résumé-only wording). Edit, run `pnpm resume --open`, then push. Full guide: [docs/UPDATING-RESUME.md](docs/UPDATING-RESUME.md). SEO and Google indexing checklist: [docs/SEO.md](docs/SEO.md).

## AI features

- **GRID** (`/api/chat`): retrieval-augmented Q&A over the profile, case studies and architecture notes, with tools: it can show a project, a diagram, a walkthrough, skill evidence or a job match, and take you somewhere. Retrieval is BM25 plus committed Gemini embeddings, fused with reciprocal-rank fusion (`lib/rag`). Answers stream as NDJSON and cite sources as `[n]`.
- **Actions** (Phase 3): GRID can draft a message for you to edit, prepare a message to Vishal that **you** review and send (it can never send one itself), show a booking link (set `contact.calLink` in `content/profile.ts` to a `https://cal.com/…` link), re-order his résumé for a role into a one-page PDF (it only moves what he already wrote), and answer interview questions in his own words from `content/interview.ts`. You can also choose the reply language (English, Kannada, Hindi) and use dictation and spoken replies where the browser supports them. Details and the safety gate: [docs/GRID-AGENT.md](docs/GRID-AGENT.md).
- **Live chat** (Phase 4): visitors can message Vishal; it lands in his Telegram and he answers by replying there (`/online`, `/away`, `/hours`, `/stats`, `/block`, a daily digest). Replies reach the visitor in seconds on the page, or by email if they left. It runs only when its env vars are set (see [docs/LIVE-CHAT-SETUP.md](docs/LIVE-CHAT-SETUP.md)); until then the button says "Leave a message".
- **Job-description matcher** (`/api/match`, on `/resume#match`): the model only extracts requirements. Grading is deterministic and literal against the profile (strong / partial / gap), and years of experience are computed from dates. The result can be copied as Markdown.
- **Routes, in order:** Gemini, then Groq `openai/gpt-oss-120b`, then Groq `openai/gpt-oss-20b` (each Groq model has its own rate-limit bucket). A route that fails before showing anything (quota, outage, 8 s of silence) hands over to the next, and is skipped for a minute afterwards so later questions do not wait on it. Either key alone is enough.
- **Without a key it still works.** No key, an exhausted daily budget, or every route failing before the first token all fall back to an offline answer built from the top passages. Questions outside the corpus get a canned refusal with no model call.
- **Guards** ([`lib/ai/limits.ts`](lib/ai/limits.ts)): chat input ≤ 1,000 characters, job description ≤ 6,000, ≤ 6 history turns, ≤ ~400 / ~1,200 output tokens, 20 s timeout, 20 chat requests per 10 minutes per client, and a global daily cap (`AI_DAILY_LIMIT`, default 400, fails closed). User text is treated as data, never as instructions, and logs hold anonymous counts only.
- **Model IDs** live only in [`lib/ai/models.ts`](lib/ai/models.ts).
- **Embeddings** are generated locally and committed. After editing `profile.ts` or a case study, run `pnpm embeddings` and commit `generated/embeddings.json`. CI only warns when they are stale, and the Vercel build never calls the API.
- Evaluation questions: [tests/ai-evals.md](tests/ai-evals.md). Unit tests blank all API keys, so they are hermetic.

## What V3 added to the page (Phase 5)

Everything here is a lazy chunk, keyboard-operable, flat-coloured (no gradients) and has a reduced-motion variant. Details: [docs/SIGNATURE.md](docs/SIGNATURE.md).

- **3D Commit City** (`components/sections/CommitCity.tsx`, `lib/city/iso.ts`): the Activity calendar's second view. A canvas draws each day as a flat-shaded isometric block (height = contributions), awards as taller towers in the project's colour with staggered labels (numbered pins below 900 px). Drag, buttons, arrow keys; Ctrl + scroll zooms (a plain scroll is never trapped); tap a tower to fly there and read its story. Redraws only when something changes. The projection, painter's order, shading and hit test are unit-tested.
- **Pixel dissolve** (`lib/fx/dissolve.ts`): new pages and dialogs dissolve in from contribution squares (`RouteWipe`, `useRevealRef`); buttons fill left to right in five steps (`styles/fx.css`).
- **Context cursor** (`components/delight/ContextCursor.tsx`): a small grid-snapped square on fine pointers that names what you are over (`data-cursor="open | play | drag | copy | ask"`). Never mounted for touch or reduced motion.
- **Stack map** (`components/sections/StackExplorer.tsx`): skills by area on the left, projects on the right, a faint wire for every real connection that lights and draws in when you pick one; an accordion with project dots on phones. Every skill can ask GRID where it was used; a skill no project used says so and points to where it was learned.
- **Contact**: a static vCard (`/vishal-b-g.vcf`, from `content/profile.ts` only) with a Save contact link, and a build-time QR code for it on desktops (`lib/contact/qr.ts`; a test decodes it back).
- **Experience**: a code-drawn monogram square per employer.

## What V2 added (and where it comes from)

Everything is derived from `content/profile.ts` or the MDX, never typed into a component:

- **Grid Rail, decoded headers, hero terminal, phone dock, project stage and deck** (`components/rail`, `components/hero`, `components/layout/MobileDock.tsx`, `components/work`).
- **Experience as a git history** (`components/sections/Experience.tsx`, `lib/content/history.ts`): roles are branches laid out from their dates, commit ids are a hash of the text, education is tagged on main.
- **Activity calendar with milestones and a year switcher** (`ActivityPanel`, `lib/content/milestones.ts`, `/api/github/calendar?year=`): awards and role starts pinned on their month. Past years use `generated/github-years.json` until `GITHUB_TOKEN` is set.
- **Case studies**: two-column layout with a sticky rail, a diagram that runs once at 60 % visible, `ProductDemo` walkthroughs (Golden Verdict, Talnio, LanSymphony) and the Virtual Tour loaded in a sandboxed iframe only after a click (the one origin in the CSP `frame-src`, kept in `lib/security/embeds.ts`).
- **GRID**: "Ask about this project" scopes retrieval to that project, and cited sources jump to the section and flash it (`#proof=<id>`).
- **Stack connection map**, **LET'S BUILD banner**, footer snake, boot line, count-ups, haptics and the opt-in shake easter egg.
- **Footer Lighthouse strip**: reads `generated/lighthouse.json`, which only `.github/workflows/lighthouse-prod.yml` writes (3-run mobile Lighthouse CI against production after each deploy, committed with `[skip ci]`). Scores are truncated, never rounded up. No file, no strip.

Everything new has a `prefers-reduced-motion` variant: reduced motion shows the final state and never moves.

### Contact form

`/api/contact` sends through Resend. The shared `onboarding@resend.dev` sender only delivers to the Resend account owner's address, so set `CONTACT_TO_EMAIL` to that address (the visitor's email is the reply-to). To send to any inbox, verify a domain in Resend and set `CONTACT_FROM_EMAIL`.

## Recruiter Mode, Ship Log and /now

- **Recruiter Mode** is a static route, [`/recruiter`](app/recruiter/page.tsx): the essentials on one page (status, experience, shipped projects, skills, awards, contact, résumé download) plus the job-description matcher. The nav toggle links between `/` and `/recruiter`, and the old `/?mode=recruiter` form redirects there (`next.config.ts`). No cookie, no flash.
- **Ship Log** (`/log`): MDX posts in [`content/log/`](content/log) with Zod-validated frontmatter (`title`, `slug`, `date`, `description`, `tags`, `draft`). Each post gets a table of contents, reading time, Open Graph image, JSON-LD and an RSS entry (`/log/rss.xml`). **Drafts are hidden in production builds** and visible in dev, on Vercel previews, and when `SHOW_DRAFTS=true` (CI sets it so the post template is covered by e2e). The nav, palette and sitemap mention the log only once at least one post is published. The three seeded posts are drafts written from this repo's own facts: rewrite them in your voice, then set `draft: false`.
- **/now** reads [`content/now.ts`](content/now.ts). Facts come from `profile.ts`; personal extras (`reading`, `learning`, `elsewhere`) are `null` until you fill them in, and null rows are hidden.

To add a post, create `content/log/<slug>.mdx` (the filename must equal the `slug`), then push.

## Terminal and games

All lazy: the always-mounted [`DelightHost`](components/delight/DelightHost.tsx) only listens for keys and events, and each overlay is its own chunk, fetched on first use, so the home bundle is unchanged.

- **Terminal**: press `~` (or choose "Open terminal" in the palette). Commands are pure functions in [`lib/terminal/commands.ts`](lib/terminal/commands.ts) that print facts from `profile.ts`: `help`, `whoami`, `status`, `projects`, `open <project|page>`, `skills`, `experience`, `contact`, `resume`, `recruiter`, `ask`, and a few jokes. Tab completes, ↑/↓ browse history, Ctrl+L clears, Esc closes.
- **Snake** lives on the 404 page (arrows or WASD, swipe, on-screen pad on phones; best score kept in `localStorage`).
- **CosmoStrike** is a tiny homage to the space game from Gamecraft, opened by the Konami code or the `cosmostrike` terminal command. Esc quits, hiding the tab pauses.
- Game rules live in [`lib/games`](lib/games) as pure, unit-tested reducers; the canvas components only draw and read input. Finding an easter egg sends the `easter_egg_found` analytics event.

## Design rules (enforced)

- Dark theme only. Tokens are in [`styles/tokens.css`](styles/tokens.css) and mapped in the Tailwind `@theme` ([`app/globals.css`](app/globals.css)). The default Tailwind palette is reset, so only token colors exist as utilities.
- **No gradients.** [`scripts/check-no-gradients.ts`](scripts/check-no-gradients.ts) fails the lint step on CSS/Tailwind/SVG/canvas gradients. It has its own unit tests.
- One accent (`#3fb950`). Blue `#58a6ff` is for inline links only.
- Every animation respects `prefers-reduced-motion`.

## Engineering decisions

- **TypeScript 6, not 7.** TS 7 (the native Go port) is out, but typescript-eslint and Next's type-check don't fully support it yet. Pinned to `~6.0.3`.
- **ESLint 9, not 10.** `eslint-plugin-react` (pulled in by `eslint-config-next`) crashes on ESLint 10 (`context.getFilename` removed). Revisit when the plugin updates.
- **Security: CSP.** A static CSP is set in `next.config.ts` headers, with no nonce and no `proxy.ts`, so every page stays statically generated and CDN-cached. Nonces would force dynamic rendering on every request. The trade-off: App Router streams inline flight-data `<script>` tags, so `script-src` includes `'unsafe-inline'`. Next's experimental SRI only hashes external chunks and can't cover those inline scripts, so it was left off. Everything else is locked down: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, a tight `connect-src`, plus HSTS, nosniff, Referrer-Policy and Permissions-Policy headers.
- **Bundle budget.** The menu sheet (Radix Dialog) and the toaster (Sonner) are code-split and load on first use. Heavy features (canvas, palette, terminal, games, chat, diagrams) follow the same rule.
- **ESM package.** `package.json` has `"type": "module"` so the TypeScript scripts (`pnpm resume`, `snapshot:github`) run as ES modules — `@react-pdf/renderer` pulls in ESM-only sub-packages that CommonJS can't resolve.
- **Contact form bundle.** The browser validates with a zero-dependency module (`lib/contact/rules.ts`); the server validates with Zod (`lib/contact/schema.ts`). Importing Zod client-side added ~90 KB gzipped; a parity test keeps both in agreement.
- **Hydration safety.** Time-dependent UI (clock, greeting) renders a fixed-width placeholder on the server and fills in on the client via `useSyncExternalStore`.

## Where things live

| To change…                   | Edit                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any fact about Vishal        | [`content/profile.ts`](content/profile.ts) (everything else reads from it)                                                                               |
| Résumé wording / which email | [`content/resume.ts`](content/resume.ts), then `pnpm resume`                                                                                             |
| Add a **project**            | `profile.ts` (+ slug in `lib/content/profile-schema.ts`), `content/work/<slug>.mdx`, a diagram in `components/diagram/graphs.ts`, then `pnpm embeddings` |
| Add a **Ship Log post**      | `content/log/<slug>.mdx` (filename = slug, `draft: false` to publish)                                                                                    |
| The /now page                | [`content/now.ts`](content/now.ts)                                                                                                                       |
| Calendar pins                | They are derived: add an award to `recognition` or a role to `experience` in `profile.ts` (month-level dates only)                                       |
| What the AI knows            | It is built from the files above. After editing them run `pnpm embeddings` and commit                                                                    |
| Colors, radii, motion        | [`styles/tokens.css`](styles/tokens.css)                                                                                                                 |

## Installable app, headers and tests

- **PWA**: `app/manifest.ts` plus generated icons (`/pwa-icon/192|512|maskable`, `/apple-icon`) make the site installable. There is deliberately no service worker: every page is already static and CDN-cached, and a worker would add stale-content risk for no real gain.
- **Headers**: CSP, HSTS, nosniff, frame, referrer and permissions policies are set in `next.config.ts` and asserted by `tests/e2e/routes.spec.ts`.
- **Every route** is loaded in CI with the console, network and a 360px viewport watched (hydration mismatches surface as console errors).
- **Visual regression** (`tests/visual`) runs only on Linux in Playwright's Docker image via `.github/workflows/visual.yml`. Run that workflow manually with `update` ticked to create or refresh baselines (it commits them). Pull requests compare against them once they exist. Never generate baselines on macOS.
- **Analytics** are cookieless Vercel Analytics + Speed Insights, mounted only on Vercel. `tests/unit/analytics-audit.test.ts` checks every specified event is emitted and none carries personal data.

## CI / deploy

- `.github/workflows/ci.yml` runs on every push and PR: install → lint → typecheck → unit → build → bundle budget → e2e + axe.
- `.github/workflows/visual.yml`: visual regression (see above). After a change that alters pages: push, run it with `update` ticked, pull the bot commit, then push once more so the PR compares against the new baselines.
- `.github/workflows/lighthouse-prod.yml`: measures production after each deploy and commits `generated/lighthouse.json` (see "What V2 added").
- `.github/workflows/lighthouse.yml` runs Lighthouse CI (mobile, ≥ 95 in all four categories) against each **Vercel preview** URL. Deployment Protection stays on. Requests use the `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret (Vercel → Project → Settings → Deployment Protection → Protection Bypass for Automation).
- Vercel Git integration: pushes to `main` deploy to production, and each PR gets a preview URL. Node 22.x (`engines.node: "22.x"`).

## Workflow

One branch and PR per phase (`phase-N-name`), Conventional Commits, CI green, then squash-merge to `main`.
