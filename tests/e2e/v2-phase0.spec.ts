import { expect, test, type Page } from "@playwright/test";
import { gotoReady, loadIslands } from "./helpers";

/** V2 · Phase 0: section rhythm, sketches that move on touch, GitHub stats, no floating pill on mobile. */
const SECTIONS = ["work", "experience", "stack", "github", "ask", "contact"];

const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

test.describe("section rhythm", () => {
  for (const [width, pad] of [
    [1280, "48px"],
    [360, "32px"],
  ] as const) {
    test(`every home section has ${pad} vertical padding at ${width}px (96/64px between sections)`, async ({
      page,
    }) => {
      await mockStatus(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      for (const id of SECTIONS) {
        const [top, bottom] = await page.locator(`#${id}`).evaluate((el) => {
          const c = getComputedStyle(el);
          return [c.paddingTop, c.paddingBottom];
        });
        expect([id, top, bottom]).toEqual([id, pad, pad]);
      }
    });
  }
});

test.describe("GitHub stats", () => {
  test("shows contributions, active days and longest streak; no 'current streak' and no 'Snapshot' label", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/");
    await loadIslands(page);
    const github = page.locator("#github");
    await expect(github.getByText("Contributions, last year")).toBeVisible();
    await expect(github.getByText("Active days, last year")).toBeVisible();
    await expect(github.getByText("Longest streak")).toBeVisible();
    await expect(github.getByText(/current streak/i)).toHaveCount(0);
    await expect(github.getByText(/snapshot/i)).toHaveCount(0);
    await expect(github.getByText(/^(Updated .+|Live · refreshed hourly)$/)).toBeVisible();
  });
});

test.describe("mobile: nothing floats over the content", () => {
  test("no floating Ask pill on a phone; Ask is in the menu", async ({ page }) => {
    await mockStatus(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoReady(page, "/");
    await expect(page.getByRole("button", { name: "Ask Vishal", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Ask Vishal/ })
      .click();
    await expect(page.getByRole("dialog", { name: /Ask Vishal/ })).toBeVisible();
  });

  test("the floating Ask pill still exists on desktop", async ({ page }) => {
    await mockStatus(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/");
    await expect(page.getByRole("button", { name: "Ask Vishal", exact: true })).toBeVisible();
  });
});
