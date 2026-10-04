import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoReady, settleAnimations } from "./helpers";

/**
 * V2 · Phase 6: the cross-device pass. Every route at 360 / 768 / 1280 / 1920: no horizontal scroll, a clean
 * console (hydration mismatches show up there) even after scrolling through every lazy section, no
 * layout shift while doing it, and axe on the home page and a case study at every width.
 */
const WIDTHS = [360, 768, 1280, 1920];
const ROUTES = [
  "/",
  "/work",
  "/work/golden-verdict",
  "/work/virtual-tour",
  "/resume",
  "/recruiter",
  "/now",
  "/log",
];

const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    // a clip that was paused or scrolled away while loading is aborted by the browser: normal, not a failure
    if (/\/media\/.*\.(webm|mp4)$/.test(r.url()) && r.failure()?.errorText === "net::ERR_ABORTED") return;
    problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  return problems;
}

/** Scrolls top to bottom in viewport-sized steps so every IntersectionObserver-driven island fires. */
async function scrollThrough(page: Page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.8));
  for (let y = 0; y < h; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

for (const width of WIDTHS) {
  test.describe(`@${width}px`, () => {
    test.use({ viewport: { width, height: width < 700 ? 780 : 900 } });

    for (const route of ROUTES) {
      test(`${route}: no overflow, clean console after scrolling through everything`, async ({ page }) => {
        await mockStatus(page);
        const problems = watch(page);
        await gotoReady(page, route);
        await page.waitForLoadState("networkidle");
        await scrollThrough(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
        expect(problems).toEqual([]);
      });
    }

    test("home: no layout shift while scrolling through the whole page", async ({ page }) => {
      await mockStatus(page);
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>)
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await gotoReady(page, "/");
      await page.waitForLoadState("networkidle");
      await scrollThrough(page);
      await page.waitForTimeout(500);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, `CLS ${cls.toFixed(3)}`).toBeLessThan(0.05);
    });

    for (const route of ["/", "/work/talnio"]) {
      test(`${route}: no serious axe violations`, async ({ page }) => {
        await mockStatus(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await gotoReady(page, route);
        await page.waitForLoadState("networkidle");
        await scrollThrough(page);
        await settleAnimations(page);
        const res = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
      });
    }
  });
}

test.describe("reduced motion: the home page is in its final state, nothing moves", () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  test("no armed reveals, no running infinite animations other than the status dots, no boot line", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.waitForLoadState("networkidle");
    await scrollThrough(page);
    await page.waitForTimeout(1200);
    expect(await page.locator("[data-reveal], [data-graph]").count()).toBe(0);
    await expect(page.getByTestId("boot-line")).toHaveCount(0);
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .map((a) =>
          `${(a.effect as KeyframeEffect | null)?.target?.className ?? ""}`.toString().slice(0, 40),
        ),
    );
    // the global reduced-motion rule collapses durations; nothing may still be visibly looping
    const looping = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === "running" &&
              a.effect?.getComputedTiming().iterations === Infinity &&
              (a.effect.getComputedTiming().duration as number) > 50,
          ).length,
    );
    expect(looping, JSON.stringify(moving)).toBe(0);
  });
});
