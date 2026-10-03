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
