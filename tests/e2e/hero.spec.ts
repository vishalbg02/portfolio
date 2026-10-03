import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { settleAnimations } from "./helpers";

test.describe("hero", () => {
  test("is fully readable with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vishal B G");
    await expect(page.getByText("Full-stack developer turning ideas into products")).toBeVisible();
    await expect(page.getByRole("link", { name: "View work" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Résumé" }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: /spelling VBG/ })).toBeVisible();
    await context.close();
  });

  test("shows a visitor-local greeting after hydration", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Good (morning|afternoon|evening)|Up late\?/)).toBeVisible();
  });

  test("mounts the cursor-trail canvas after idle and lights squares on pointer move", async ({ page }) => {
    await page.goto("/");
    const canvas = page.getByTestId("hero-trail");
    await expect(canvas).toBeAttached({ timeout: 5000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const count = await canvas.evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext("2d")!;
      const before = ctx.getImageData(0, 0, c.width, c.height).data.join();
      return before.length;
    });
    expect(count).toBeGreaterThan(0);
    const sample = async () =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        const colors = new Set<string>();
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
        return colors.size;
      });
    const before = await sample();
    await page.mouse.move(box!.x + 300, box!.y + 200);
    await page.mouse.move(box!.x + 330, box!.y + 215, { steps: 3 });
    await page.waitForTimeout(80);
    expect(await sample()).toBeGreaterThan(before);
  });

  test("does not mount the canvas under prefers-reduced-motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForTimeout(2600);
    await expect(page.getByTestId("hero-trail")).toHaveCount(0);
    await context.close();
  });

  test("hero has no serious axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Good (morning|afternoon|evening)|Up late\?/)).toBeVisible();
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .include("section[aria-labelledby='hero-title']")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });

  test("fits at 360, 768, 1280 and 1920 without horizontal scroll", async ({ page }) => {
    for (const width of [360, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
});
