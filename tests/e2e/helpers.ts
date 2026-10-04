import { expect, type Page } from "@playwright/test";

/** Waits for finite CSS animations/transitions (e.g. fade-ins) to finish so axe sees final colors. */
export async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        // paused ones (the sketches wait for hover/scroll) would never finish, so only wait for running ones
        .filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** Navigates and waits until client islands (diagram, status badges) have hydrated. */
export async function gotoHydrated(page: Page, url: string) {
  await gotoReady(page, url);
  await page.waitForLoadState("networkidle");
}

/**
 * Navigates and waits until global keyboard shortcuts are live. Pressing Ctrl+K before React has
 * hydrated is a silent no-op, which made palette tests flaky on slow CI runners.
 */
export async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-shortcuts="ready"]').waitFor({ state: "attached" });
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
