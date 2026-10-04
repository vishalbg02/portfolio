import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoReady, settleAnimations, loadIslands } from "./helpers";

const axe = async (page: Page) => {
  await settleAnimations(page);
  return (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
};

const openTerminal = async (page: Page) => {
  await gotoReady(page, "/now");
  await page.keyboard.press("Shift+`"); // "~"
  const input = page.getByRole("textbox", { name: "Terminal command" });
  await expect(input).toBeFocused();
  return input;
};

test.describe("terminal", () => {
  test("opens with ~, answers from the profile, and closes with Esc", async ({ page }) => {
    const input = await openTerminal(page);
    const log = page.getByRole("log", { name: "Terminal output" });
    await expect(log).toContainText("type help");

    await input.fill("whoami");
    await input.press("Enter");
    await expect(log).toContainText("Vishal B G — Full Stack Developer, Bengaluru, India");

    await input.fill("status");
    await input.press("Enter");
    await expect(log).toContainText("Not working anywhere right now");
    await expect(log).toContainText("Golden Verdict");

    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Terminal" })).toHaveCount(0);
  });

  test("Tab completes, ↑ recalls history, unknown commands suggest, open navigates", async ({ page }) => {
    const input = await openTerminal(page);
    const log = page.getByRole("log", { name: "Terminal output" });

    await input.fill("proj");
    await input.press("Tab");
    await expect(input).toHaveValue("projects ");

    await input.fill("projcts");
    await input.press("Enter");
    await expect(log).toContainText('Did you mean "projects"');

    await input.press("ArrowUp");
    await expect(input).toHaveValue("projcts");

    await input.fill("open talnio");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/work\/talnio$/);
    await expect(page.getByRole("dialog", { name: "Terminal" })).toHaveCount(0);
  });

  test("the palette can open it too, and sudo hire vishal goes to the contact form", async ({ page }) => {
    await gotoReady(page, "/");
    await page.keyboard.press("Control+k");
    const box = page.getByRole("combobox");
    await expect(box).toBeFocused();
    await box.fill("terminal");
    await page.getByRole("option", { name: /Open terminal/ }).click();
    const input = page.getByRole("textbox", { name: "Terminal command" });
    await expect(input).toBeFocused();
    await input.fill("sudo hire vishal");
    await input.press("Enter");
    await expect(page).toHaveURL(/#contact$/);
  });

  test("typing ~ inside a form field does not open it", async ({ page }) => {
    await gotoReady(page, "/");
    await loadIslands(page);
    await page.getByLabel("Name").first().fill("~");
    await expect(page.getByRole("dialog", { name: "Terminal" })).toHaveCount(0);
  });
});

test.describe("404 snake", () => {
  test("shows the 404 with the board visible immediately, and any key starts the game", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("404");
    const board = page.getByRole("img", { name: /Snake game board/ });
    await expect(board).toBeVisible();
    await expect(page.getByText("Press any key or tap to start")).toBeVisible();
    await page.keyboard.press("x");
    await page.keyboard.press("ArrowDown");
    // run into a wall: the board reports game over
    await expect(page.getByText("Game over", { exact: true })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("status")).toContainText("Game over. You scored");
    expect(await axe(page)).toEqual([]);
  });

  test("fits at 360px without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/nope");
    await expect(page.getByRole("img", { name: /Snake game board/ })).toBeVisible();
    await expect(page.getByLabel("Direction pad")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("CosmoStrike", () => {
  test("the Konami code opens it, Esc quits", async ({ page }) => {
    await gotoReady(page, "/");
    for (const k of [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ]) {
      await page.keyboard.press(k);
    }
    const dialog = page.getByRole("dialog", { name: "CosmoStrike" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Start" })).toBeVisible();
    await dialog.getByRole("button", { name: "Start" }).click();
    await page.keyboard.down(" ");
    await page.waitForTimeout(300);
    await page.keyboard.up(" ");
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("the terminal command launches it", async ({ page }) => {
    const input = await openTerminal(page);
    await input.fill("cosmostrike");
    await input.press("Enter");
    await expect(page.getByRole("dialog", { name: "CosmoStrike" })).toBeVisible();
  });

  test("hiding the tab pauses the game", async ({ page }) => {
    await gotoReady(page, "/");
    await page.evaluate(() => window.dispatchEvent(new Event("app:open-game")));
    const dialog = page.getByRole("dialog", { name: "CosmoStrike" });
    await dialog.getByRole("button", { name: "Start" }).click();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(dialog.getByText("Paused", { exact: true })).toBeVisible();
  });
});

test("the ? overlay lists the terminal shortcut", async ({ page }) => {
  await gotoReady(page, "/");
  await page.keyboard.press("Shift+/");
  await expect(page.getByRole("dialog").getByText("Open terminal")).toBeVisible();
});
