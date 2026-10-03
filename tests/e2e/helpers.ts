import type { Page } from "@playwright/test";

/** Waits for finite CSS animations/transitions (e.g. fade-ins) to finish so axe sees final colors. */
export async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
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
