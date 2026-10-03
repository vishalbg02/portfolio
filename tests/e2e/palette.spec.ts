import { expect, test, type Page } from "@playwright/test";
import { settleAnimations } from "./helpers";

async function openPalette(page: Page) {
  await page.keyboard.press("Control+k");
  // The palette is lazy-loaded: wait for the input before typing, like a human would.
  await expect(page.getByRole("combobox")).toBeFocused();
}

test.describe("command palette", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("opens with Ctrl+K, filters, and closes with Escape (focus returns)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "View work" }).focus();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("linkedin");
    await expect(dialog.getByRole("option")).toHaveCount(1);
    await expect(dialog.getByRole("option", { name: /Open LinkedIn/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "View work" })).toBeFocused();
  });

  test("Ctrl+K toggles the palette closed again", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();
  });

  test("'/' opens the palette", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  });

  test("keyboard only: copies the email and shows a toast", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await page.keyboard.type("copy email");
    await expect(page.getByRole("option", { name: /Copy email/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Email copied")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("vishalbg02@gmail.com");
  });

  test("keyboard only: copies the phone number", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await page.keyboard.type("copy phone");
    await expect(page.getByRole("option", { name: /Copy phone/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Phone copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("+91 96639 72259");
  });

  test("arrow keys navigate and Enter scrolls to a section", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await page.keyboard.type("experience");
    await expect(page.getByRole("option", { name: /Experience/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#experience$/);
  });

  test("the nav pill opens the palette", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: /Search/ }).click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  });

  test("typing '/' or '?' inside a form field does not open the palette or help", async ({ page }) => {
    // A real field (the contact form), not an injected node: hydration can discard injected DOM.
    await page.route("**/api/status", (route) => route.fulfill({ json: { checkedAt: "", statuses: {} } }));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const message = page.getByLabel("Message");
    await message.scrollIntoViewIfNeeded();
    await message.focus();
    await page.keyboard.type("a/b?c");
    await expect(message).toHaveValue("a/b?c");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("'?' opens the shortcut help overlay", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help).toBeVisible();
    await expect(help.getByText("Open command palette")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });

  test("palette has no serious axe violations", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.goto("/");
    await openPalette(page);
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
