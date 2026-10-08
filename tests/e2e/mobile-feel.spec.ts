import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoHydrated, ownClient } from "./helpers";

/**
 * V4 Phase 4: every route on a phone. Tap targets are at least 44 px (counting a `tap-slop` or whole-card link's
 * hit area, which is what a finger actually gets), nothing scrolls sideways, and the sheets have their handles.
 *
 * Not counted, each for a stated reason: links inside running text (WCAG 2.5.8's inline exception), the skip link
 * (off screen until focused), and the activity calendar's dense marks and role bands (24 px targets spaced ≥ 24 px
 * apart, which is AA, and each one's facts are also in the text and lists around the calendar).
 */
const ROUTES = [
  "/",
  "/work",
  "/work/golden-verdict",
  "/work/talnio",
  "/recruiter",
  "/resume",
  "/now",
  "/log",
  "/log/an-assistant-that-says-i-dont-know",
  "/privacy",
  "/this-page-does-not-exist",
];

const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

async function walk(page: Page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
}

/** Every control a finger can hit that is under 44 px in its real hit area. */
const smallTargets = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const sel = "a[href], button, input, select, textarea, summary, [role=button], [role=tab]";
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const q = el.getBoundingClientRect();
      if (!q.width || !q.height || !el.checkVisibility({ visibilityProperty: true })) continue;
      if (el.closest("[aria-hidden=true], [inert]")) continue;
      if (el.matches("[data-mark], [data-band], .skip-link, [href='#main']")) continue;
      const inline =
        el.tagName === "A" &&
        getComputedStyle(el).display === "inline" &&
        el.closest("p, li, dd, td, figcaption");
      if (inline) continue;
      // the hit area: the box, or its ::after when that is a positioned hit extension (tap-slop, whole-card links)
      let w = q.width;
      let h = q.height;
      const after = getComputedStyle(el, "::after");
      if (after.content !== "none" && after.position === "absolute") {
        const iw = parseFloat(after.left) + parseFloat(after.right);
        const ih = parseFloat(after.top) + parseFloat(after.bottom);
        if (!Number.isNaN(iw)) w = Math.max(w, q.width - iw);
        if (!Number.isNaN(ih)) h = Math.max(h, q.height - ih);
        // a whole-card link: its ::after fills a positioned ancestor
        if (after.inset === "0px") {
          const card = el.closest<HTMLElement>(".relative, article");
          if (card) {
            const c = card.getBoundingClientRect();
            w = Math.max(w, c.width);
            h = Math.max(h, c.height);
          }
        }
      }
      if (h < 43.5 || w < 24)
        out.push(
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 32)}" ${Math.round(w)}×${Math.round(h)}`,
        );
    }
    return [...new Set(out)];
  });

test.beforeEach(async ({ context }) => ownClient(context));

for (const width of [360, 390, 430]) {
  test.describe(`@${width}px phone`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

    for (const route of ROUTES) {
      test(`${route}: 44 px tap targets, no sideways scroll`, async ({ page }) => {
        await mockStatus(page);
        await gotoHydrated(page, route);
        await walk(page);
        expect(await smallTargets(page)).toEqual([]);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe("phone sheets", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the menu sheet has a pull handle and closes when it is pulled down", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work");
    await page.getByRole("button", { name: /menu/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const handle = sheet.locator("[data-sheet-handle]");
    await expect(handle).toBeVisible();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 220, { steps: 6 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
  });

  test("the dock: the current place has a row of squares, and the GRID button is raised", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/recruiter");
    const dock = page.getByRole("navigation", { name: "Quick links" });
    const current = dock.getByRole("link", { name: "Recruiter" });
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current.locator("span.absolute > span")).toHaveCount(3);
    const shadow = await dock
      .getByRole("button", { name: "Ask GRID" })
      .evaluate((b) => getComputedStyle(b).boxShadow);
    expect(shadow).not.toBe("none");
  });

  test("axe on the inner pages at 390", async ({ page }) => {
    for (const route of ["/work", "/work/golden-verdict", "/recruiter", "/now", "/log", "/privacy"]) {
      await mockStatus(page);
      await gotoHydrated(page, route);
      const r = await new AxeBuilder({ page }).analyze();
      expect(
        r.violations.map((v) => `${route} ${v.id}: ${v.nodes.length}`),
        route,
      ).toEqual([]);
    }
  });
});
