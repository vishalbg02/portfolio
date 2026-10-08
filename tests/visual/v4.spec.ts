import { expect, test, type Page } from "@playwright/test";

/**
 * V4 visual baselines (Linux CI only, like pages.spec.ts): the opening sequence's three key frames and the hero,
 * at 1440 and 390. The intro needs motion, so this file turns reduced motion off and freezes every CSS animation
 * at a chosen moment (they are all timed from the page load), which makes each frame exact and repeatable.
 */
const SIZES = [
  { name: "1440", width: 1440, height: 900, isMobile: false },
  { name: "390", width: 390, height: 844, isMobile: true },
];
const FRAMES = [
  { name: "wake", ms: 120 },
  { name: "assemble", ms: 760 },
  { name: "hand-over", ms: 1180 },
];

// One moment for every run: the hero's availability line and other time-of-day text (IST) change with the clock, and
// a baseline recorded at night must match a check run at noon.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-06-15T06:30:00Z")); // 12:00 IST
});

async function status(page: Page) {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: "2026-01-01T00:00:00.000Z", statuses: {} } }),
  );
}

/**
 * Load every lazy island (activity, stack map, contact form) before an element screenshot, and wait until the page
 * stops changing height. Otherwise an island near the section swaps in mid-capture, the page moves under the section,
 * and the two "stable" screenshots Playwright compares start at different places (1947 vs 2016 px at 390).
 */
async function settle(page: Page) {
  // islands load from an IntersectionObserver that only exists once the page has hydrated
  await page.waitForLoadState("networkidle");
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width, height: 12_000 });
  await expect(page.locator(".skel")).toHaveCount(0, { timeout: 15_000 });
  await page.setViewportSize({ width, height });
  await expect
    .poll(
      async () => {
        const a = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.waitForTimeout(300);
        return a === (await page.evaluate(() => document.documentElement.scrollHeight));
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

for (const size of SIZES) {
  test.describe(`@${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      isMobile: size.isMobile,
      hasTouch: size.isMobile,
      reducedMotion: "no-preference",
    });

    for (const frame of FRAMES) {
      test(`intro: ${frame.name}`, async ({ page }) => {
        await status(page);
        await page.goto("/", { waitUntil: "domcontentloaded" });
        // the hero's trail canvas mounts lazily, sometimes before this frame and sometimes after: the frames are about
        // the overlay, so leave it out (on phones the hero shows through the sparse intro)
        await page.addStyleTag({ content: "canvas { display: none !important; }" });
        // freeze everything at once, then move every animation to the same moment
        await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          (ms) => {
            for (const a of document.getAnimations()) {
              a.pause();
              a.currentTime = ms;
            }
          },
          frame.ms * (size.isMobile ? 0.5 : 1),
        ); // phones run the sequence at 0.5× (styles/intro.css)
        expect(await page.evaluate(() => document.documentElement.dataset.intro)).toBe("play");
        await expect(page).toHaveScreenshot(`intro-${frame.name}-${size.name}.png`, {
          maxDiffPixelRatio: 0.01,
          mask: [page.locator("[data-visual-mask]"), page.locator("canvas")],
        });
      });
    }

    test("hero, after the intro", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" }); // the hero's final state, nothing moving
      await status(page);
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`hero-${size.name}.png`, {
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
        mask: [page.locator("[data-visual-mask]"), page.locator("canvas"), page.getByRole("status")],
      });
    });

    for (const run of [false, true]) {
      test(`meet grid: ${run ? "after a tile run" : "idle"}`, async ({ page }) => {
        test.skip(run && size.isMobile, "on a phone a tile opens the full-screen sheet (covered by e2e)");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await status(page);
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        await settle(page);
        const section = page.locator("#ask");
        await section.locator("[data-grid-inline]").scrollIntoViewIfNeeded();
        await expect(section.getByRole("log", { name: /Conversation/ })).toBeVisible();
        await settle(page);
        if (run) {
          // a router tile: the same answer every time, no model
          await section.getByRole("link", { name: /^Shows projects/ }).click();
          const log = section.getByRole("log", { name: /Conversation/ });
          await expect(log.locator('[data-grid-card="project"]')).toBeVisible();
          await expect(section.locator("[data-pipeline]")).toHaveAttribute("data-running", "false");
        }
        await page.mouse.move(0, 0);
        // A locator screenshot of a section taller than the viewport was clipped at a shifted scroll offset (it began
        // mid-face and ran into Contact). Shoot the page from the top instead and clip to the section's place in the
        // document, which also keeps the sticky nav and the dock out of the picture.
        await page.evaluate(() => window.scrollTo(0, 0));
        await settle(page);
        const clip = await section.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
        });
        await expect(page).toHaveScreenshot(`meet-grid-${run ? "run" : "idle"}-${size.name}.png`, {
          fullPage: true,
          clip,
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
          mask: [page.locator("[data-visual-mask]"), page.locator("canvas"), section.locator("img, video")],
        });
      });
    }
  });
}
