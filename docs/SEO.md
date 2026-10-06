# SEO & Google indexing

**Baseline (3 Oct 2026):** a Google search for `site:vishalbg.vercel.app` returns nothing, and searching "Vishal B G full stack developer Bengaluru" doesn't surface the site. That's expected for a brand-new `*.vercel.app` site with no inbound links. The technical side is done; ranking now depends on the steps below that need _your_ accounts.

## Already done in code (and tested)

| Area                  | What                                                                                                                                                                                      | Test                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Crawlability          | Every page is static HTML (no client-only content), `robots.txt` allows everything except `/api/`, `sitemap.xml` lists home, `/work`, the 4 case studies, `/resume` **and `/resume.pdf`** | `tests/e2e/seo.spec.ts`      |
| Titles & descriptions | Home: `Vishal B G — Full Stack Developer`; unique title + description + canonical per page; name leads every snippet                                                                      | `seo.spec.ts`, `seo.test.ts` |
| Structured data       | JSON-LD: `Person` (name, job title, `alumniOf` CHRIST, `sameAs` LinkedIn + GitHub), `WebSite`, `ProfilePage`; `CreativeWork` + `BreadcrumbList` per project. No email/phone in markup     | `seo.test.ts`                |
| Social previews       | 1200×630 flat dark card per page (home, work, résumé, each project)                                                                                                                       | `seo.spec.ts`                |
| Page experience       | Lighthouse (mobile): Performance 96–98, Accessibility 100, Best Practices 100, **SEO 100**; CLS ≈ 0; one `<h1>` per page; `lang="en-IN"`                                                  | CI + Lighthouse job          |
| Bots                  | `googleBot` directives allow large image previews and full snippets; 404s are `noindex`                                                                                                   | `seo.spec.ts`                |

## Do these (in this order) — about 20 minutes

1. **Google Search Console** → _Add property_ → **URL prefix** → `https://vishalbg.vercel.app`.
   - Choose **HTML tag** verification, copy the `content="…"` token.
   - Vercel → Project → Settings → Environment Variables → `NEXT_PUBLIC_GSC_VERIFICATION=<token>` (Production) → redeploy → click **Verify**.
2. In Search Console: **Sitemaps** → submit `sitemap.xml`. Then **URL inspection** → paste `https://vishalbg.vercel.app/` → **Request indexing**. Repeat for `/work`, `/resume` and each `/work/<project>`.
3. **Bing Webmaster Tools** → _Import from Google Search Console_ (one click). Bing also feeds DuckDuckGo, Yahoo and several AI search tools.
4. **Backlinks** — the single biggest ranking factor for a new site. Add your site URL to:
   - GitHub: profile → _Website_ field, and the README of `vishalbg02/vishalbg02`
   - LinkedIn: _Contact info → Website_, plus the _Featured_ section
   - Your CHRIST profile pages, hackathon/Devpost pages, and each project's own site (e.g. a "Built by Vishal B G" footer link on goldenverdict.com and the Virtual Tour — Golden Verdict is a client site, so ask first)
5. **Use one name everywhere:** "Vishal B G" in LinkedIn headline, GitHub name, résumé PDF and the site, plus the handle `vishalbg` / `vishalbg02`. Search engines match entities; consistency is what lets them connect the profiles.
6. **Validate** the structured data once: <https://search.google.com/test/rich-results> → test `https://vishalbg.vercel.app/` (expect _Profile page_ + _Breadcrumbs_).

## Recommended next steps

- **Get a custom domain** (e.g. `vishalbg.dev` or `vishalbg.in`). A `*.vercel.app` subdomain shares reputation with every Vercel site and is harder to brand and rank. Buying a domain needs your approval; once you own it, set `NEXT_PUBLIC_SITE_URL`, add it in Vercel, and I'll add a permanent redirect from the old URL.
- **Publish the first Ship Log posts** (Phase 6). Specific, technical titles ("Offline P2P video calls in Python", "Role-based workflows on Firestore") are what a new site actually ranks for, long before it ranks for a common name.
- **Keep the résumé page fresh** — `Last updated` and the sitemap date change when you bump `updatedAt` in `content/resume.ts`.

## Expectations

Google usually indexes a submitted page within days, sometimes within hours. Ranking #1 for the exact name "Vishal B G" depends on how many other people share those initials; consistent profiles plus backlinks typically take **weeks**, not days. Track progress in Search Console → _Pages_ and _Performance_, or with `site:vishalbg.vercel.app`.
