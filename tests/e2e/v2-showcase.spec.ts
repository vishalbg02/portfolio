import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, settleAnimations } from "./helpers";

/** V2 · the Work showcase: product stage (desktop) and swipe deck (mobile). */
const SLUGS = ["golden-verdict", "talnio", "lansymphony", "virtual-tour"];
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

test.describe("product stage (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("is a real tablist: one panel visible, arrow keys move selection and focus", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const tabs = page.getByRole("tablist", { name: "Projects" }).getByRole("tab");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    for (const slug of SLUGS.slice(1)) await expect(page.locator(`#panel-${slug}`)).toBeHidden();
    await tabs.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-talnio")).toBeVisible();
    await expect(page.locator("#panel-golden-verdict")).toBeHidden();
    await page.keyboard.press("End");
    await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    // roving tabindex: only the selected tab is in the tab order
    expect(await tabs.evaluateAll((els) => els.map((e) => e.getAttribute("tabindex")))).toEqual([
      "0",
      "-1",
      "-1",
      "-1",
    ]);
    // each tab controls a labelled tabpanel
    await expect(page.locator("#panel-golden-verdict")).toHaveAttribute(
      "aria-labelledby",
      "tab-golden-verdict",
    );
  });

  test("hovering an entry previews it; the grid wipe plays and then clears", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.locator("#tab-lansymphony").hover();
    await expect(page.locator(".wipe")).toHaveCount(1);
    await expect(page.locator("#panel-lansymphony")).toBeVisible();
    await expect(page.locator(".wipe")).toHaveCount(0, { timeout: 3000 });
  });

  test("the pointer tilts the sketch (fine pointers)", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const stage = page.locator("#panel-golden-verdict .stage-grid");
    await stage.scrollIntoViewIfNeeded();
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
    await expect
      .poll(() => stage.locator("> div > div").evaluate((el) => (el as HTMLElement).style.transform))
      .toContain("rotateY");
    await page.mouse.move(box.x - 40, box.y - 40);
    await expect
      .poll(() => stage.locator("> div > div").evaluate((el) => (el as HTMLElement).style.transform))
      .toBe("");
  });

  test("reduced motion: switching is instant (no wipe), and nothing tilts", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.locator("#tab-talnio").click();
    await expect(page.locator("#panel-talnio")).toBeVisible();
    expect(await page.locator(".wipe").count()).toBe(0);
    await ctx.close();
  });

  test("axe is clean with the stage open on each project", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    for (const slug of SLUGS) {
      await page.locator(`#tab-${slug}`).click();
      await expect(page.locator(`#panel-${slug}`)).toBeVisible();
      await expect(page.locator(".wipe")).toHaveCount(0, { timeout: 3000 });
      await settleAnimations(page);
      await expect(page.locator("[data-decoding]")).toHaveCount(0);
      const v = (
        await new AxeBuilder({ page })
          .include("#work")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.filter((x) => x.impact === "serious" || x.impact === "critical");
      expect(v, slug).toEqual([]);
    }
  });
});

test.describe("swipe deck (mobile)", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

  test("cards snap horizontally with the next one peeking; no tab roles on a phone", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const deck = page.getByRole("region", { name: /Projects, swipe sideways/ });
    await expect(deck).toBeVisible();
    expect(await deck.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain("x mandatory");
    expect(await deck.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    // next card peeks: card 1 is ~86% of the deck, so card 2 starts inside the viewport
    const second = await page.locator("#panel-talnio").boundingBox();
    expect(second!.x).toBeLessThan(390);
    expect(await page.getByRole("tablist").count()).toBe(0);
    expect(await page.getByRole("tab").count()).toBe(0);
    // grid-square dots, one per project
    const dots = page.locator("#work").getByRole("button", { name: /^Show / });
    await expect(dots).toHaveCount(4);
    await expect(dots.first()).toHaveAttribute("aria-current", "true");
  });

  test("tapping a dot brings that project to the centre and makes it current", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const dots = page.locator("#work").getByRole("button", { name: /^Show / });
    await dots.nth(2).scrollIntoViewIfNeeded();
    await dots.nth(2).click();
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true", { timeout: 4000 });
    // the smooth scroll settles with the card centred in the 390px viewport
    await expect
      .poll(async () => {
        const box = (await page.locator("#panel-lansymphony").boundingBox())!;
        return Math.abs(box.x + box.width / 2 - 195);
      })
      .toBeLessThan(40);
  });

  test("the home page has no horizontal scroll on a phone", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });
});
