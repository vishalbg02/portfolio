# Product media (stills and clips)

The Work section shows **real captures** of the products, not sketches. They live in `public/media/<slug>/` and are
described in one place: [`content/media.ts`](../content/media.ts) (what each file is, where it came from, and its alt text).

| Project        | Source                                                                                                                                             | Notes                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Golden Verdict | Public pages of `goldenverdict.com`: home, the "four steps" section, the GST Registration page, and a scroll of the home page (never an open menu) | **A client's production site.** The script never logs in and never visits `/dashboard`, `/login`, `/api` and the other paths its `robots.txt` disallows. A unit test fails if a source URL points at one.                                |
| Virtual Tour   | The app's own pages: landing, About, Meet the Team                                                                                                 | "Enter VR Tour" opens a **third-party** 360° viewer (seekbeak.com), so that is not captured.                                                                                                                                             |
| Talnio         | The screenshots on the app's own Google Play listing, cropped to the app screen                                                                    | The listing images are marketing frames; the site draws the phone bezel in code. If the listing can't be read the script writes `public/media/talnio/README.md` (a `TODO(vishal)`) and the site falls back to the code-drawn phone demo. |
| LanSymphony    | none                                                                                                                                               | No public UI. Its scene is the protocol diagram drawn in code.                                                                                                                                                                           |

## Capturing

```bash
pnpm media                       # everything that is missing
pnpm media --only=talnio         # one project (comma-separated slugs)
pnpm media --force               # re-capture even if the files exist
pnpm media --no-video            # stills only
```

It needs a browser (Playwright Chromium, already installed for e2e), the network and **ffmpeg** for the clips
(`FFMPEG_PATH=/path/to/ffmpeg` or `ffmpeg` on `PATH`; without it the clips are skipped with a warning). It is **never** run in the Vercel build.

### From GitHub instead (`.github/workflows/media.yml`)

Some networks cannot reach a product's site (a campus web filter blocks `goldenverdict.com`, for example). The
**Capture product media** workflow runs the same script on a GitHub runner, with ffmpeg, and uploads the files as an
artifact (`media-<run id>`, kept 7 days). It never commits: download the artifact, look at every frame, copy the files
into `public/media/`, then commit.

- By hand: Actions → Capture product media → Run workflow (`only` = comma-separated slugs, `video` on or off).
- It also runs on any branch push that changes `scripts/capture-media.mts` (a manual run only works once the workflow
  is on `main`).

```bash
gh run download <run id> -D /tmp/media     # then copy the files you checked into public/media/<slug>/
```

## Golden Verdict: live site or captures

The Work scene and the case study show the **live** Golden Verdict site in a frame only when the site allows framing
(`/api/status` reads its headers; see `LiveSite` and [EMBEDDING-GOLDEN-VERDICT.md](EMBEDDING-GOLDEN-VERDICT.md)).
Today it does not, so they show these captures, home page first, with a "Visit live site ↗" button.

## What it writes

- **Stills:** `<id>-1x.avif`, `<id>-1x.webp`, `<id>-2x.avif`, `<id>-2x.webp`. Desktop captures are 960 × 600 at 1×, phone captures 390 × 844 (Talnio 262 × 569). Render them with `<picture>` and a `srcSet` (see `stillSources()` in `lib/media/paths.ts`); they are pre-encoded at the right sizes, so `next/image` would only add a re-encode.
- **Clips:** `<id>.webm` (VP9) and `<id>.mp4` (H.264), muted, 24 fps, ≤ **1.2 MB** each (the script raises the compression until each fits), plus `<id>-poster-{1x,2x}.{avif,webp}`. Use `<video muted playsInline preload="none" poster=…>`, and always render the poster.
- File names follow one convention in `lib/media/paths.ts`, so the script, the manifest and the components can't disagree.

## Adding or changing a capture

1. Add the entry to `content/media.ts` with real **alt text** (what is visible; no claims, no numbers that are not on screen).
2. Add its capture function to `scripts/capture-media.mts` (`goldenVerdict`, `virtualTour`, `clips` …).
3. `pnpm media --only=<slug>`, look at the result, commit `public/media`.
4. `pnpm test` checks every file exists, clips fit the budget, and alt text is present.

The Open Graph card of each case study (`app/work/[slug]/opengraph-image.tsx`) uses the project's hero still too: `lib/seo/og-media.ts` reads the committed 1× file at build time and embeds it as a JPEG data URL. A project whose hero is a code-drawn illustration (LanSymphony) keeps the text-only card.

The frames around the captures (browser chrome, phone bezel) are drawn in code, flat, never baked into the images.

> The captured pages carry their own styling (Golden Verdict's site has gradients). The "no gradients" rule is about **this site's** CSS, SVG and canvas, and `pnpm check:gradients` scans code, not photographs of other products.
