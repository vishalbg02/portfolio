import { expect, test, type Page } from "@playwright/test";
import { gotoReady, settleAnimations } from "./helpers";

/** V2 · Phase 1: Grid Rail, decode headers, reduced motion. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

const rail = (page: Page) => page.getByRole("navigation", { name: "Page progress" });
const levels = (page: Page) =>
  page
    .locator("nav[aria-label='Page progress'] .rail-sq")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.l));

test.describe("grid rail (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("is a labelled nav with one focusable tick per section and aria-hidden squares", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await expect(rail(page)).toBeVisible();
    const ticks = rail(page).getByRole("link");
    await expect(ticks).toHaveCount(7);
    await expect(ticks.first()).toHaveAttribute("aria-label", "Jump to Work");
    expect(await page.locator("nav[aria-label='Page progress'] .rail-sq").count()).toBe(30);
    // squares are hidden from assistive tech and from the tab order
    expect(await page.locator("nav[aria-label='Page progress'] [aria-hidden='true'] a").count()).toBe(0);
  });

  test("fills as you scroll: empty at the top, full at the bottom", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await expect(rail(page)).toBeVisible();
    expect((await levels(page)).every((l) => l === "0")).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(async () => (await levels(page)).every((l) => l === "4")).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await expect
      .poll(async () => {
        const l = await levels(page);
        return l.includes("4") && l.includes("0");
      })
      .toBe(true);
  });

  test("ticks show their name on focus, and Enter jumps to the section", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const tick = rail(page).getByRole("link", { name: "Jump to Stack" });
    await tick.focus();
    expect(await tick.evaluate((el) => getComputedStyle(el, "::after").opacity)).toBe("1");
    expect(await tick.evaluate((el) => getComputedStyle(el, "::after").content)).toContain("Stack");
    await tick.press("Enter");
    await expect
      .poll(() => page.evaluate(() => document.getElementById("stack")!.getBoundingClientRect().top))
      .toBeLessThan(140);
    await expect(page).toHaveURL(/#stack$/);
    await expect(tick).toHaveAttribute("aria-current", "location");
  });

  test("the current section's tick is marked while you read it", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.locator("#experience").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById("experience")!.scrollIntoView({ behavior: "instant" }));
    await expect(rail(page).getByRole("link", { name: "Jump to Experience" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });
});

test.describe("progress line (mobile)", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("no rail below 1024px; a 2px line along the top grows with scroll", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await expect(rail(page)).toBeHidden();
    const bar = page.locator("div.fixed.top-0 > div.origin-left");
    await expect(bar).toHaveCount(1);
    const scale = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(await scale()).toBe(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(scale).toBeGreaterThan(0.95);
  });
});

test.describe("decode headers", () => {
  test("the real text is always in the DOM, the scramble overlay is aria-hidden, and it settles", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const h = page.getByRole("heading", { level: 2, name: "Where I've shipped" });
    await h.scrollIntoViewIfNeeded();
    // overlay (if still running) is hidden from assistive tech; the real heading text is intact
    await expect(h).toHaveText("Where I've shipped");
    await expect(page.locator("[data-decoding]")).toHaveCount(0, { timeout: 3000 });
    await expect(h).toHaveText("Where I've shipped");
    expect(await h.locator("[aria-hidden='true']").count()).toBe(0);
  });

  test("reduced motion: no rail pulse animation and no scramble, final text immediately", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await mockStatus(page);
    await page.goto("/");
    await page.locator("#work").scrollIntoViewIfNeeded();
    expect(await page.locator("[data-decoding]").count()).toBe(0);
    await expect(page.getByRole("heading", { level: 2, name: "Where I've shipped" })).toBeVisible();
    await ctx.close();
  });

  test("axe is clean on the home page with the rail mounted", async ({ page }) => {
    const AxeBuilder = (await import("@axe-core/playwright")).default;
    await mockStatus(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/");
    await expect(rail(page)).toBeVisible();
    await settleAnimations(page);
    await expect(page.locator("[data-decoding]")).toHaveCount(0);
    const v = (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
    ).violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    expect(v).toEqual([]);
  });
});
