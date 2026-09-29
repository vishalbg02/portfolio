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

| Command             | What it does                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `pnpm lint`         | ESLint, then the **no-gradient guard**, then Prettier check                       |
| `pnpm typecheck`    | `next typegen`, then `tsc --noEmit`                                               |
| `pnpm test`         | Vitest unit tests                                                                 |
| `pnpm build`        | Production build (all pages static)                                               |
| `pnpm check:bundle` | Fails if the home route's initial JS is over **170 KB gzipped** (run after build) |
| `pnpm e2e`          | Playwright e2e + axe against the production build                                 |
| `pnpm analyze`      | Turbopack bundle analyzer (`next experimental-analyze`)                           |
| `pnpm verify`       | Everything above, in CI order                                                     |

## Content

All facts live in [`content/profile.ts`](content/profile.ts), validated by a Zod schema ([`lib/content/profile-schema.ts`](lib/content/profile-schema.ts)). Pages, the AI assistant, JSON-LD and the résumé PDF all read from it. Unknown values are `null` with a `TODO(vishal)` comment, and the UI hides them. Never hard-code facts in components.

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
- **Hydration safety.** Time-dependent UI (clock, greeting) renders a fixed-width placeholder on the server and fills in on the client via `useSyncExternalStore`.

## CI / deploy

- `.github/workflows/ci.yml` runs on every push and PR: install → lint → typecheck → unit → build → bundle budget → e2e + axe.
- `.github/workflows/lighthouse.yml` runs Lighthouse CI (mobile, ≥ 95 in all four categories) against each **Vercel preview** URL. Deployment Protection stays on. Requests use the `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret (Vercel → Project → Settings → Deployment Protection → Protection Bypass for Automation).
- Vercel Git integration: pushes to `main` deploy to production, and each PR gets a preview URL. Node 22.x (`engines.node: "22.x"`).

## Workflow

One branch and PR per phase (`phase-N-name`), Conventional Commits, CI green, then squash-merge to `main`.
