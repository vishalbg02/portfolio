import { expect, type Page } from "@playwright/test";

/**
 * Brings a page to the one state a picture can be compared against: every lazy part loaded and nothing still moving.
 *
 * Lazy islands (activity, stack map, contact form, the Meet GRID chat) load as they near the viewport, and a
 * screenshot never scrolls. Scrolling to them would leave the hero's will-change layers re-rastered with different
 * anti-aliasing every time, so the viewport is made tall enough for all of them to be "near", the real content is
 * awaited, and the viewport is put back. A picture taken before the chat or a web font arrived differed from one taken
 * after by a line of text (14 px at 768), which made the same build pass one run and fail the next.
 */
export async function loadEverything(page: Page) {
  // islands load from an IntersectionObserver that only exists once the page has hydrated
  await page.waitForLoadState("networkidle");
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width, height: 12_000 });
  await expect(page.locator(".skel")).toHaveCount(0, { timeout: 15_000 });
  // the chat's placeholder is not a .skel (it is as tall as the chat): wait for the chat and its live layer
  if ((await page.locator("#ask [data-grid-inline]").count()) > 0) {
    await expect(page.locator("#ask [role=log]")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#ask")).toHaveAttribute("data-live", "", { timeout: 15_000 });
  }
  await page.setViewportSize({ width, height });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await steady(page);
}

/** Waits until the page has kept one height for 300 ms. */
export async function steady(page: Page) {
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
