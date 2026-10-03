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

| Variable                                             | Enables                               | Fallback when missing              |
| ---------------------------------------------------- | ------------------------------------- | ---------------------------------- |
| `GEMINI_API_KEY`                                     | Ask Vishal (AI) + JD matcher          | Friendly "offline" state           |
| `GITHUB_TOKEN`                                       | Live contribution calendar + activity | Committed snapshot in `generated/` |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`                 | Contact form delivery                 | `mailto:` + copy-email             |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared rate limits / daily AI cap     | Per-instance in-memory limiter     |
| `NEXT_PUBLIC_SITE_URL`                               | Canonical URLs, sitemap, OG           | `https://vishalbg.vercel.app`      |
| `NEXT_PUBLIC_GSC_VERIFICATION`                       | Google Search Console meta tag        | Omitted                            |
| `SHOW_RECOGNITION`                                   | Recognition strip                     | `true`                             |

## Scripts

| Command                 | What it does                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm lint`             | ESLint, then the **no-gradient guard**, then Prettier check                                   |
| `pnpm typecheck`        | `next typegen`, then `tsc --noEmit`                                                           |
| `pnpm test`             | Vitest unit tests                                                                             |
| `pnpm build`            | Production build (all pages static)                                                           |
| `pnpm check:bundle`     | Fails if the home route's initial JS is over **170 KB gzipped** (run after build)             |
| `pnpm e2e`              | Playwright e2e + axe against the production build                                             |
| `pnpm embeddings`       | Re-embeds changed content chunks (needs `GEMINI_API_KEY`); commit `generated/embeddings.json` |
| `pnpm check:embeddings` | Warns if the committed embeddings are stale. Never fails, never calls the API                 |
| `pnpm analyze`          | Turbopack bundle analyzer (`next experimental-analyze`)                                       |
| `pnpm verify`           | Everything above, in CI order                                                                 |

## Content

All facts live in [`content/profile.ts`](content/profile.ts), validated by a Zod schema ([`lib/content/profile-schema.ts`](lib/content/profile-schema.ts)). Pages, the AI assistant, JSON-LD and the résumé PDF all read from it. Unknown values are `null` with a `TODO(vishal)` comment, and the UI hides them. Never hard-code facts in components.

### Updating the résumé

The PDF at `/resume.pdf` and the page at `/resume` are generated from `content/profile.ts` (shared facts) and `content/resume.ts` (résumé-only wording). Edit, run `pnpm resume --open`, then push. Full guide: [docs/UPDATING-RESUME.md](docs/UPDATING-RESUME.md). SEO and Google indexing checklist: [docs/SEO.md](docs/SEO.md).

## AI features

- **Ask Vishal** (`/api/chat`): retrieval-augmented Q&A over the profile, case studies and architecture notes. Retrieval is BM25 plus committed Gemini embeddings, fused with reciprocal-rank fusion (`lib/rag`). Answers stream as NDJSON and cite sources as `[n]`.
- **Job-description matcher** (`/api/match`, on `/resume#match`): the model only extracts requirements. Grading is deterministic and literal against the profile (strong / partial / gap), and years of experience are computed from dates. The result can be copied as Markdown.
- **Without a key it still works.** No `GEMINI_API_KEY`, an exhausted daily budget, or a model error before the first token all fall back to an offline answer built from the top passages. Questions outside the corpus get a canned refusal with no model call.
- **Guards** ([`lib/ai/limits.ts`](lib/ai/limits.ts)): chat input ≤ 1,000 characters, job description ≤ 6,000, ≤ 6 history turns, ≤ ~400 / ~1,200 output tokens, 20 s timeout, 20 chat requests per 10 minutes per client, and a global daily cap (`AI_DAILY_LIMIT`, default 400, fails closed). User text is treated as data, never as instructions, and logs hold anonymous counts only.
- **Model IDs** live only in [`lib/ai/models.ts`](lib/ai/models.ts).
- **Embeddings** are generated locally and committed. After editing `profile.ts` or a case study, run `pnpm embeddings` and commit `generated/embeddings.json`. CI only warns when they are stale, and the Vercel build never calls the API.
- Evaluation questions: [tests/ai-evals.md](tests/ai-evals.md). Unit tests blank all API keys, so they are hermetic.

## Recruiter Mode, Ship Log and /now

- **Recruiter Mode** is a static route, [`/recruiter`](app/recruiter/page.tsx): the essentials on one page (status, experience, shipped projects, skills, awards, contact, résumé download) plus the job-description matcher. The nav toggle links between `/` and `/recruiter`, and the old `/?mode=recruiter` form redirects there (`next.config.ts`). No cookie, no flash.
- **Ship Log** (`/log`): MDX posts in [`content/log/`](content/log) with Zod-validated frontmatter (`title`, `slug`, `date`, `description`, `tags`, `draft`). Each post gets a table of contents, reading time, Open Graph image, JSON-LD and an RSS entry (`/log/rss.xml`). **Drafts are hidden in production builds** and visible in dev, on Vercel previews, and when `SHOW_DRAFTS=true` (CI sets it so the post template is covered by e2e). The nav, palette and sitemap mention the log only once at least one post is published. The three seeded posts are drafts written from this repo's own facts: rewrite them in your voice, then set `draft: false`.
- **/now** reads [`content/now.ts`](content/now.ts). Facts come from `profile.ts`; personal extras (`reading`, `learning`, `elsewhere`) are `null` until you fill them in, and null rows are hidden.

To add a post, create `content/log/<slug>.mdx` (the filename must equal the `slug`), then push.

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

## CI / deploy

- `.github/workflows/ci.yml` runs on every push and PR: install → lint → typecheck → unit → build → bundle budget → e2e + axe.
- `.github/workflows/lighthouse.yml` runs Lighthouse CI (mobile, ≥ 95 in all four categories) against each **Vercel preview** URL. Deployment Protection stays on. Requests use the `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret (Vercel → Project → Settings → Deployment Protection → Protection Bypass for Automation).
- Vercel Git integration: pushes to `main` deploy to production, and each PR gets a preview URL. Node 22.x (`engines.node: "22.x"`).

## Workflow

One branch and PR per phase (`phase-N-name`), Conventional Commits, CI green, then squash-merge to `main`.
