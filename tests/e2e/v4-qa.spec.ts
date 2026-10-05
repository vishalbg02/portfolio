import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoHydrated, ownClient } from "./helpers";

/**
 * V4 Phase 5: cross-device QA from tablet to wide desktop (phones are covered by mobile-feel.spec.ts). Every route:
 * no sideways scroll at any width, no console errors, and every image has its intrinsic size (no layout shift).
 */
const ROUTES = [
  "/",
  "/work",
  "/work/golden-verdict",
  "/work/lansymphony",
  "/recruiter",
  "/resume",
  "/now",
  "/log",
  "/log/an-assistant-that-says-i-dont-know",
  "/privacy",
];
const WIDTHS = [768, 1024, 1280, 1440, 1920];

const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

test.beforeEach(async ({ context }) => ownClient(context));

for (const width of WIDTHS) {
  test(`@${width}px: every route fits, loads clean, and sizes its images`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`${page.url()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
    await mockStatus(page);
    for (const route of ROUTES) {
      await gotoHydrated(page, route);
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 800) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(25);
      }
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `${route} scrolls sideways`).toBeLessThanOrEqual(0);
      const unsized = await page.evaluate(() =>
        [...document.querySelectorAll("main img")]
          .filter((i) => !i.getAttribute("width") || !i.getAttribute("height"))
          .map((i) => i.getAttribute("src")?.slice(0, 60)),
      );
      expect(unsized, `${route} has images without width/height`).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}
