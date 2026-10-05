import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoHydrated, ownClient } from "./helpers";

/**
 * V4 Phase 3: the home page as one system. Its length (≤ 11,000 px at 1440 × 900 with every island loaded), chapter
 * openers on all six chapters, the calendar's milestone labels clear of each other at 1280 and 1440, the nav marking
 * the chapter you are reading, and axe on the whole page.
 */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

async function loadAll(page: Page) {
  await mockStatus(page);
  await gotoHydrated(page, "/");
  // scroll through so every lazy island mounts at its real height
  for (let y = 0; y < 14_000; y += 700) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(40);
  }
  await expect(page.locator('[data-testid="contribution-calendar"]')).toBeVisible();
  await expect(page.locator('[data-island="stack"]')).toBeVisible();
  await page.waitForTimeout(400);
}

test.beforeEach(async ({ context }) => ownClient(context));

test.describe("home rhythm @1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the whole page is at most 11,000 px tall", async ({ page }) => {
    await loadAll(page);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(h).toBeLessThanOrEqual(11_000);
  });

  test("every chapter opens the same way: a pixel numeral 01–06 and its label", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const ids = ["work", "experience", "stack", "github", "ask", "contact"];
    for (const [i, id] of ids.entries()) {
      const num = page.locator(`#${id} header .chapter-num`).first();
      await expect(num, id).toHaveCount(1);
      // the numeral is drawn from the pixel font: its lit squares are the digits "0" and i + 1
      const lit = await num
        .locator(".px-on")
        .evaluateAll((els) => els.reduce((n, e) => n + (e.getAttribute("d")?.match(/M/g)?.length ?? 0), 0));
      expect(lit, id).toBeGreaterThan(10);
      await expect(page.locator(`#${id} header`).first(), id).toContainText(
        ["Work", "Experience", "Stack", "Activity", "Ask", "Contact"][i]!,
        { ignoreCase: true },
      );
    }
  });

  test("the nav marks the chapter you are reading", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await page.locator("#experience").evaluate((e) => window.scrollTo(0, (e as HTMLElement).offsetTop + 200));
    await expect(nav.getByRole("link", { name: "Experience" })).toHaveAttribute("aria-current", "location");
    await expect(nav.getByRole("link", { name: "Work" })).not.toHaveAttribute("aria-current", /.+/);
    await page.locator("#contact").evaluate((e) => window.scrollTo(0, (e as HTMLElement).offsetTop + 200));
    await expect(nav.getByRole("link", { name: "Contact" })).toHaveAttribute("aria-current", "location");
  });

  test("axe: the whole home page, every island loaded", async ({ page }) => {
    await loadAll(page);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

for (const width of [1280, 1440]) {
  test(`@${width}px: the calendar's milestone labels never overlap`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loadAll(page);
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll("[data-milestone]")]
        .map((b) => b.parentElement!)
        .map((row) => {
          const r = row.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height, id: row.textContent ?? "" };
        })
        .filter((r) => r.w > 0),
    );
    expect(boxes.length).toBeGreaterThan(1);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap =
          a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
        expect(overlap, `${a.id} × ${b.id}`).toBe(false);
      }
  });
}
