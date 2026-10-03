import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { settleAnimations } from "./helpers";

test.describe("foundation", () => {
  test("home renders the name as the H1 and core CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Vishal B G — Full Stack Developer");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vishal B G");
    await expect(page.getByRole("link", { name: "View work" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  test("home has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Good (morning|afternoon|evening)|Up late\?/)).toBeVisible();
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("home loads without console errors or failed requests", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 400) problems.push(`${res.status()} ${res.url()}`);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("unknown routes render the 404 page", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("didn't ship");
  });

  test("mobile menu opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: /Work/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
