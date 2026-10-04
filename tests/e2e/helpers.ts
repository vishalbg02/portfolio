import { expect, type BrowserContext, type Page } from "@playwright/test";

/** Waits for finite CSS animations/transitions (e.g. fade-ins) to finish so axe sees final colors. */
export async function settleAnimations(page: Page) {
  await page.evaluate(() => {
    const done = Promise.all(
      document
        .getAnimations()
        // paused ones (the sketches wait for hover/scroll) would never finish, so only wait for running ones
        .filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    );
    // Content that is not rendered yet (an off-screen card under content-visibility) never finishes its animations:
    // don't wait for it for more than a moment.
    return Promise.race([done, new Promise((resolve) => setTimeout(resolve, 2000))]);
  });
}

/** Navigates and waits until client islands (diagram, status badges) have hydrated. */
export async function gotoHydrated(page: Page, url: string) {
  await gotoReady(page, url);
  await page.waitForLoadState("networkidle");
}

/**
 * Navigates and waits until the global listeners are live (`?` help, the Omnibar's ⌘K and `/`, GRID's host).
 * Pressing Ctrl+K before React has hydrated is a silent no-op, which made these tests flaky on slow CI runners.
 */
export async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page
    .locator('html[data-shortcuts="ready"][data-omnibar="ready"][data-grid="ready"]')
    .waitFor({ state: "attached" });
}

/**
 * The heavy sections below the fold (activity, stack map, contact form) load just before they scroll into
 * view. Tests that look inside them call this first: it scrolls each one near the viewport and waits for the
 * real content to replace its placeholder, then returns to the top.
 */
export async function loadIslands(page: Page) {
  for (const island of await page.locator("[data-island]").all()) {
    await island.scrollIntoViewIfNeeded();
    await expect(island.locator(".skel")).toHaveCount(0);
  }
  await page.evaluate("window.scrollTo(0, 0)");
}

/**
 * Gives a test its own client address. The server rate-limits questions per client (20 per 10 minutes), and every
 * e2e request comes from localhost, so without this a long run of GRID tests would use up one shared allowance.
 * Call it from a `beforeEach`.
 */
export async function ownClient(context: BrowserContext) {
  const n = Math.floor(Math.random() * 0xffffff);
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`,
  });
}
