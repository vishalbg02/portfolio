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

async function status(page: Page) {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: "2026-01-01T00:00:00.000Z", statuses: {} } }),
  );
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
        // freeze everything at once, then move every animation to the same moment
        await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate((ms) => {
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = ms;
          }
        }, frame.ms);
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
  });
}
