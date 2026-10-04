import { expect, test, type Page } from "@playwright/test";

/**
 * Visual regression. Runs ONLY on Linux CI inside the Playwright Docker image (VISUAL=1), so font
 * rendering is deterministic. Never generate baselines on macOS: run the "Visual baselines" workflow.
 * Animations are disabled (reducedMotion + animations: "disabled"), network data is mocked, and the
 * clock/status fields that change between runs are masked.
 */
const WIDTHS = [360, 768, 1280, 1920];
const PAGES = [
  { name: "home", path: "/" },
  { name: "case-study", path: "/work/talnio" },
  { name: "resume", path: "/resume" },
  { name: "recruiter", path: "/recruiter" },
  { name: "not-found", path: "/no-such-page" },
];

async function prepare(page: Page, path: string) {
  await page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        checkedAt: "2026-01-01T00:00:00.000Z",
        statuses: {
          "golden-verdict": {
            slug: "golden-verdict",
            state: "live",
            latencyMs: 120,
            checkedAt: "2026-01-01T00:00:00.000Z",
          },
          "virtual-tour": {
            slug: "virtual-tour",
            state: "live",
            latencyMs: 120,
            checkedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    }),
  );
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Relative times ("13 minutes ago") are computed when the page is built, so they differ between the
  // baseline run and the compare run and can wrap onto another line. Pin their text; the block is masked anyway.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("#github time, #github [role=status]"))
      el.textContent = "xx ago";
  });
  // A stray pointer over the project list would switch the active project (hover previews it).
  await page.mouse.move(0, 0);
}

for (const { name, path } of PAGES) {
  for (const width of WIDTHS) {
    test(`${name} @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page, path);
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
        // live clock, build date/SHA, canvas hero and status badges change between runs
        mask: [
          page.locator("[data-visual-mask]"),
          page.locator("footer"),
          page.locator("canvas"),
          page.locator("#github"),
          page.getByRole("status"),
        ],
      });
    });
  }
}
