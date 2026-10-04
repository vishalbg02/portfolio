/**
 * pnpm media [--only golden-verdict,talnio,virtual-tour] [--force] [--no-video]
 *
 * Captures the REAL product visuals the Work section shows, into public/media/<slug>/. Run it by hand
 * (or in CI on demand), never in the Vercel build: it needs a browser, the network and ffmpeg.
 *
 *  - Golden Verdict: public pages of goldenverdict.com only. It is a client's production site, so this
 *    script never logs in and never opens anything private (see robots.txt: /dashboard, /login, … are off limits).
 *  - CHRIST Virtual Tour: the pages of the app itself. The 360° tour is hosted by a third party, so it is not captured.
 *  - Talnio: the screenshots of the app's own Google Play listing, cropped to the app screen
 *    (the site draws the phone bezel in code). Falls back to a TODO note if the listing can't be read.
 *  - LanSymphony has no public UI; the site draws its protocol diagram in code.
 *
 * What to capture, the alt text and the sizes live in content/media.ts. File names follow lib/media/paths.ts.
 * Stills are written as AVIF + WebP at 1× and 2×; clips as muted WebM (VP9) + MP4 (H.264), each ≤ 1.2 MB, with a poster.
 * ffmpeg: set FFMPEG_PATH, or have `ffmpeg` on PATH (clips are skipped, with a warning, if neither exists).
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { media } from "@/content/media";
import type { MediaAsset, MediaClip, MediaStill } from "@/lib/content/media-schema";
import { clipSources, filesFor, stillSources } from "@/lib/media/paths";
import type { ProjectSlug } from "@/lib/content/profile-schema";

const PUBLIC = "public";
const CLIP_MAX_BYTES = 1_200_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const only = new Set((args.find((a) => a.startsWith("--only="))?.slice(7) ?? "").split(",").filter(Boolean));
const wanted = (slug: ProjectSlug) => only.size === 0 || only.has(slug);
const force = flag("force");

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

const byId = (id: string) => {
  const a = media.find((m) => m.id === id);
  if (!a) throw new Error(`content/media.ts has no asset "${id}"`);
  return a;
};
const have = (a: MediaAsset) => filesFor(a).every((f) => existsSync(join(PUBLIC, f)));

/* ── stills ─────────────────────────────────────────────────────────────────────────────────────── */

async function writeStill(a: Pick<MediaStill, "id" | "slug" | "width" | "height">, png: Buffer) {
  const s = stillSources(a);
  mkdirSync(join(PUBLIC, "media", a.slug), { recursive: true });
  let total = 0;
  for (const [scale, avif, webp] of [
    [1, s.avif1x, s.webp1x],
    [2, s.avif2x, s.webp2x],
  ] as const) {
    const base = sharp(png).resize({ width: a.width * scale, kernel: "lanczos3" });
    await base.clone().avif({ quality: 55, effort: 5 }).toFile(join(PUBLIC, avif));
    await base.clone().webp({ quality: 80, effort: 5 }).toFile(join(PUBLIC, webp));
    total += statSync(join(PUBLIC, avif)).size + statSync(join(PUBLIC, webp)).size;
  }
  return total;
}

/* ── clips ──────────────────────────────────────────────────────────────────────────────────────── */

function ffmpeg(): string | null {
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return probe.status === 0 ? "ffmpeg" : null;
}

function run(bin: string, argv: string[]) {
  const r = spawnSync(bin, argv, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${bin} failed: ${(r.stderr || "").split("\n").slice(-6).join("\n")}`);
}

/** Re-encodes a raw recording into WebM + MP4, raising the CRF until each file fits the budget. */
async function encodeClip(a: MediaClip, raw: string, trimSec: number, durSec: number) {
  const bin = ffmpeg();
  if (!bin) {
    console.log(yellow(`  ! no ffmpeg (set FFMPEG_PATH): skipped the clip ${a.id}`));
    return;
  }
  const out = join(PUBLIC, "media", a.slug);
  mkdirSync(out, { recursive: true });
  const c = clipSources(a);
  const vf = `fps=24,scale=${a.width}:-2:flags=lanczos`;
  const common = ["-y", "-ss", trimSec.toFixed(2), "-t", durSec.toFixed(2), "-i", raw, "-an", "-vf", vf];

  for (const [file, codec] of [
    [
      c.webm,
      (crf: number) => [
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        String(crf),
        "-row-mt",
        "1",
        "-deadline",
        "good",
        "-cpu-used",
        "2",
      ],
    ],
    [
      c.mp4,
      (crf: number) => [
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        String(crf),
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-profile:v",
        "main",
      ],
    ],
  ] as const) {
    const dest = join(PUBLIC, file);
    let crf = file.endsWith(".webm") ? 34 : 27;
    for (;;) {
      run(bin, [...common, ...codec(crf), dest]);
      const size = statSync(dest).size;
      if (size <= CLIP_MAX_BYTES) {
        console.log(green(`  ✓ ${file} ${kb(size)} (crf ${crf})`));
        break;
      }
      if (crf >= 52) throw new Error(`${file} is still ${kb(size)} at crf ${crf}`);
      crf += 3;
    }
  }
  // poster = a frame from the first seconds, so the clip never shows an empty frame before it plays
  const frame = join(tmpdir(), `${a.id}-poster.png`);
  run(bin, ["-y", "-ss", "0.6", "-i", join(PUBLIC, c.mp4), "-frames:v", "1", frame]);
  await writeStill(
    { id: `${a.id}-poster`, slug: a.slug, width: a.width, height: a.height },
    await sharp(frame).png().toBuffer(),
  );
  console.log(green(`  ✓ ${a.id}-poster`));
}

/* ── pages ──────────────────────────────────────────────────────────────────────────────────────── */

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } as const;
const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
} as const;

const GV = "https://www.goldenverdict.com";
const VT = "https://virtual-tour-opal.vercel.app";

/** Opens a page and gets the cookie banner out of the way (Decline: the least invasive choice). */
async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page
    .getByRole("button", { name: "Decline" })
    .click({ timeout: 4_000 })
    .catch(() => {});
  await page.waitForTimeout(1_500);
}

const shot = (page: Page) => page.screenshot({ type: "png" });

/**
 * Eased scroll inside the page, so a recording is smooth. Passed as a string on purpose: tsx adds a
 * `__name` helper to named functions, which does not exist in the page.
 */
const smoothScroll = (page: Page, to: number, ms: number) =>
  page.evaluate(`new Promise((done) => {
    const from = scrollY, t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ${ms});
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      scrollTo(0, from + (${to} - from) * e);
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  })`);

type Stills = Record<string, (b: Browser) => Promise<Buffer>>;

async function withPage<T>(
  b: Browser,
  opts: Parameters<Browser["newContext"]>[0],
  fn: (p: Page) => Promise<T>,
) {
  const ctx = await b.newContext({ userAgent: UA, ...opts });
  try {
    return await fn(await ctx.newPage());
  } finally {
    await ctx.close();
  }
}

const goldenVerdict: Stills = {
  "gv-home-desktop": (b) =>
    withPage(b, DESKTOP, async (p) => {
      await open(p, `${GV}/`);
      return shot(p);
    }),
  "gv-menu-desktop": (b) =>
    withPage(b, DESKTOP, async (p) => {
      await open(p, `${GV}/`);
      await p.getByText("Business Setup").first().hover();
      await p.waitForTimeout(900);
      return shot(p);
    }),
  "gv-steps-desktop": (b) =>
    withPage(b, DESKTOP, async (p) => {
      await open(p, `${GV}/`);
      await p
        .getByRole("heading", { name: /four simple steps/i })
        .last()
        .scrollIntoViewIfNeeded();
      await p.evaluate(() => scrollBy(0, -70));
      await p.waitForTimeout(1_800);
      return shot(p);
    }),
  "gv-service-desktop": (b) =>
    withPage(b, DESKTOP, async (p) => {
      await open(p, `${GV}/gst-registration`);
      return shot(p);
    }),
  "gv-home-mobile": (b) =>
    withPage(b, MOBILE, async (p) => {
      await open(p, `${GV}/`);
      return shot(p);
    }),
  "gv-service-mobile": (b) =>
    withPage(b, MOBILE, async (p) => {
      await open(p, `${GV}/gst-registration`);
      return shot(p);
    }),
};

const virtualTour: Stills = {
  "vt-landing-desktop": (b) =>
    withPage(b, DESKTOP, async (p) => {
      await open(p, `${VT}/`);
      return shot(p);
    }),
  "vt-about-desktop": (b) =>
    withPage(b, DESKTOP, async (p) => {
      await open(p, `${VT}/about`);
      return shot(p);
    }),
  "vt-team-desktop": (b) =>
    withPage(b, DESKTOP, async (p) => {
      await open(p, `${VT}/meet_the_team`);
      return shot(p);
    }),
  "vt-landing-mobile": (b) =>
    withPage(b, MOBILE, async (p) => {
      await open(p, `${VT}/`);
      return shot(p);
    }),
};

/**
 * Records a 1440×900 session. `setup` (loading the page) runs first and is trimmed off the front, so the
 * clip starts on a finished page; `act` is the choreography that ends up in the clip.
 */
async function record(
  b: Browser,
  setup: (p: Page) => Promise<void>,
  act: (p: Page) => Promise<void>,
): Promise<{ raw: string; trim: number; dur: number }> {
  const dir = mkdtempSync(join(tmpdir(), "media-rec-"));
  const ctx: BrowserContext = await b.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir, size: { width: 1440, height: 900 } },
  });
  const born = Date.now();
  const page = await ctx.newPage();
  await setup(page);
  const start = Date.now();
  await act(page);
  const end = Date.now();
  await ctx.close(); // flushes the video
  const raw = join(
    dir,
    readdirSync(dir).find((f) => f.endsWith(".webm"))!,
  );
  return { raw, trim: Math.max(0, (start - born) / 1000), dur: (end - start) / 1000 };
}

const clips: Record<string, (b: Browser) => Promise<{ raw: string; trim: number; dur: number }>> = {
  "gv-scroll": (b) =>
    record(
      b,
      (p) => open(p, `${GV}/`),
      async (p) => {
        await p.waitForTimeout(900);
        await p.getByText("Business Setup").first().hover();
        await p.waitForTimeout(1_600);
        await p.mouse.move(700, 700);
        await p.waitForTimeout(300);
        await smoothScroll(p, 2200, 2_200);
        await p.waitForTimeout(900);
        await smoothScroll(p, 5700, 2_400);
        await p.waitForTimeout(900);
      },
    ),
  "vt-browse": (b) =>
    record(
      b,
      (p) => open(p, `${VT}/`),
      async (p) => {
        await p.waitForTimeout(700);
        await p.getByRole("link", { name: "Enter VR Tour" }).hover();
        await p.waitForTimeout(900);
        await p.getByRole("link", { name: "Meet The Team" }).click();
        await p.waitForTimeout(2_300);
        await p.goBack();
        await p.waitForTimeout(1_200);
        await p.getByRole("link", { name: "About The Project" }).click();
        await p.waitForTimeout(2_300);
        await p.goBack();
        await p.waitForTimeout(900);
      },
    ),
};

/* ── Talnio: the Play listing ───────────────────────────────────────────────────────────────────── */

const PLAY = "https://play.google.com/store/apps/details?id=com.talnio.talnio&hl=en_IN";
/** The listing's screenshots are marketing frames (phone bezel + caption); this is the app screen inside, in px of the 1080×1920 original. */
const SCREEN = { left: 316, top: 580, width: 524, height: 1138 } as const;
/** The listing order, which content/media.ts mirrors. */
const TALNIO_IDS = [
  "tn-login",
  "tn-dashboard",
  "tn-tasks",
  "tn-attendance",
  "tn-report",
  "tn-manager",
  "tn-leave",
];

async function talnio(todo: string[]) {
  const dir = join(PUBLIC, "media", "talnio");
  mkdirSync(dir, { recursive: true });
  try {
    const html = await (
      await fetch(PLAY, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) })
    ).text();
    const bases: string[] = [];
    for (const m of html.matchAll(/<img[^>]*alt="Screenshot image"[^>]*>/g)) {
      const src = /src="(https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]+)/.exec(m[0])?.[1];
      if (src && !bases.includes(src)) bases.push(src);
    }
    if (bases.length < TALNIO_IDS.length)
      throw new Error(`found ${bases.length} listing screenshots, expected ${TALNIO_IDS.length}`);
    for (const [i, id] of TALNIO_IDS.entries()) {
      const a = byId(id) as MediaStill;
      if (!force && have(a)) {
        console.log(dim(`  · ${id} exists`));
        continue;
      }
      const res = await fetch(`${bases[i]}=s0`, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`screenshot ${i}: HTTP ${res.status}`);
      const img = sharp(Buffer.from(await res.arrayBuffer()));
      const meta = await img.metadata();
      if (meta.width !== 1080 || meta.height !== 1920)
        throw new Error(`screenshot ${i} is ${meta.width}×${meta.height}, expected 1080×1920`);
      const bytes = await writeStill(a, await img.extract(SCREEN).png().toBuffer());
      console.log(green(`  ✓ ${id} ${kb(bytes)}`));
    }
  } catch (err) {
    const why = (err as Error).message;
    console.log(yellow(`  ! could not read the Play listing (${why})`));
    writeFileSync(
      join(dir, "README.md"),
      `# Talnio screenshots\n\nTODO(vishal): drop 4–6 app screenshots here (PNG, 1080×1920 screens). The Play listing could not be read cleanly: ${why}.\nUntil then the site falls back to the code-drawn phone demo.\n`,
    );
    todo.push("talnio");
  }
}

/* ── main ───────────────────────────────────────────────────────────────────────────────────────── */

async function main() {
  const todo: string[] = [];
  const held: { browser: Browser | null } = { browser: null };
  const getBrowser = async () => (held.browser ??= await chromium.launch());

  const doStills = async (slug: ProjectSlug, table: Stills) => {
    if (!wanted(slug)) return;
    console.log(`\n${slug}`);
    for (const [id, fn] of Object.entries(table)) {
      const a = byId(id) as MediaStill;
      if (!force && have(a)) {
        console.log(dim(`  · ${id} exists`));
        continue;
      }
      try {
        const png = await fn(await getBrowser());
        const bytes = await writeStill(a, png);
        console.log(green(`  ✓ ${id} ${kb(bytes)}`));
      } catch (err) {
        console.log(red(`  ✕ ${id}: ${(err as Error).message.split("\n")[0]}`));
        todo.push(id);
      }
    }
  };
  const doClips = async (slug: ProjectSlug) => {
    if (!wanted(slug) || flag("no-video")) return;
    for (const a of media.filter((m): m is MediaClip => m.kind === "clip" && m.slug === slug)) {
      if (!force && have(a)) {
        console.log(dim(`  · ${a.id} exists`));
        continue;
      }
      try {
        const rec = await clips[a.id]!(await getBrowser());
        await encodeClip(a, rec.raw, rec.trim, rec.dur);
      } catch (err) {
        console.log(red(`  ✕ ${a.id}: ${(err as Error).message.split("\n")[0]}`));
        todo.push(a.id);
      }
    }
  };

  await doStills("golden-verdict", goldenVerdict);
  await doClips("golden-verdict");
  await doStills("virtual-tour", virtualTour);
  await doClips("virtual-tour");
  if (wanted("talnio")) {
    console.log("\ntalnio");
    await talnio(todo);
  }
  await held.browser?.close();

  const missing = media.filter((a) => wanted(a.slug) && !have(a));
  console.log("");
  if (missing.length === 0 && todo.length === 0)
    console.log(green("✓ every asset in content/media.ts is on disk"));
  else {
    console.log(yellow(`${missing.length} asset(s) still missing: ${missing.map((a) => a.id).join(", ")}`));
    process.exitCode = 1;
  }
  if (existsSync(join(tmpdir())))
    for (const d of readdirSync(tmpdir()))
      if (d.startsWith("media-rec-")) rmSync(join(tmpdir(), d), { recursive: true, force: true });
}

main().catch((err) => {
  console.error(red(String(err)));
  process.exit(1);
});
