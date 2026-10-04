import { expect, test, type Page } from "@playwright/test";
import { gotoReady, settleAnimations, loadIslands, ownClient } from "./helpers";

const NAME = "Ask GRID or run a command";

async function openOmnibar(page: Page) {
  await page.keyboard.press("Control+k");
  // The panel is lazy-loaded: wait for the input before typing, like a human would.
  await expect(page.getByRole("combobox")).toBeFocused();
}
const dialog = (page: Page) => page.getByRole("dialog", { name: NAME });

test.beforeEach(async ({ context }) => ownClient(context));

test.describe("Omnibar: commands and questions in one input", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("opens with Ctrl+K, filters commands, and closes with Escape (focus returns)", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "View work" }).focus();
    await page.keyboard.press("Control+k");
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("linkedin");
    // the command is first and selected; asking GRID about "linkedin" is still offered below it
    const options = dialog(page).getByRole("option");
    await expect(options.first()).toHaveText(/Open LinkedIn/);
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(options).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole("link", { name: "View work" })).toBeFocused();
  });

  test("Ctrl+K toggles it closed again", async ({ page }) => {
    await gotoReady(page, "/");
    await page.keyboard.press("Control+k");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(dialog(page)).toBeHidden();
  });

  test("'/' opens it, and keys typed before the panel has loaded are not lost", async ({ page }) => {
    await gotoReady(page, "/");
    await page.keyboard.press("/");
    await page.keyboard.type("exper"); // typed straight away, whether or not the lazy panel is there yet
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveValue("exper");
    await expect(dialog(page).getByRole("option").first()).toHaveText(/Experience/);
  });

  test("the empty Omnibar offers things to ask and the full command list", async ({ page }) => {
    await gotoReady(page, "/");
    await openOmnibar(page);
    await expect(dialog(page).getByRole("option", { name: /Brief me in 30 seconds/ })).toBeVisible();
    await expect(
      dialog(page)
        .getByRole("option", { name: /Résumé/ })
        .first(),
    ).toBeVisible();
  });

  test("a command name runs the command; anything else asks GRID", async ({ page }) => {
    await gotoReady(page, "/");
    await openOmnibar(page);
    await page.keyboard.type("experience");
    await expect(page.getByRole("option", { name: /Experience/ }).first()).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#experience$/);

    await openOmnibar(page);
    await page.keyboard.type("Where did he study?");
    await expect(dialog(page).getByRole("option").first()).toContainText("Where did he study?");
    await expect(dialog(page).getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "GRID, Vishal's AI" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("log").getByText("Where did he study?")).toBeVisible();
  });

  test("'>' shows commands only, '?' always asks", async ({ page }) => {
    await gotoReady(page, "/");
    await openOmnibar(page);
    await page.keyboard.type(">contact");
    await expect(dialog(page).getByRole("option", { name: /Ask GRID|“/ })).toHaveCount(0);
    await expect(dialog(page).getByRole("option").first()).toHaveText(/Contact/);
    await page.keyboard.press("Control+a");
    await page.keyboard.type("?contact");
    await expect(dialog(page).getByRole("option")).toHaveCount(1);
    await expect(dialog(page).getByRole("option").first()).toContainText("contact");
    await page.keyboard.press("Control+a");
    await page.keyboard.type(">zzzz");
    await expect(dialog(page).getByText(/No command matches/)).toBeVisible();
  });

  test("keyboard only: copies the email and shows a toast", async ({ page }) => {
    await gotoReady(page, "/");
    await openOmnibar(page);
    await page.keyboard.type("copy email");
    await expect(page.getByRole("option", { name: /Copy email/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Email copied")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("vishalbg02@gmail.com");
  });

  test("keyboard only: copies the phone number", async ({ page }) => {
    await gotoReady(page, "/");
    await openOmnibar(page);
    await page.keyboard.type("copy phone");
    await expect(page.getByRole("option", { name: /Copy phone/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Phone copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("+91 96639 72259");
  });

  test("pasting a long text (a job description) hands it straight to GRID", async ({ page }) => {
    await gotoReady(page, "/");
    await openOmnibar(page);
    const jd =
      "Backend Engineer. Responsibilities: build REST APIs. Requirements: Java, Spring Boot, Docker. 3+ years of experience. We are looking for someone who ships, owns what they build, and writes things down. " +
      "Nice to have: Docker, PostgreSQL, and a habit of reviewing code. About the role: you will own the services behind our mobile apps.";
    await page.evaluate((text) => {
      const input = document.querySelector<HTMLInputElement>("[cmdk-input]")!;
      const data = new DataTransfer();
      data.setData("text", text);
      input.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, jd);
    const sheet = page.getByRole("dialog", { name: "GRID, Vishal's AI" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("log").getByText(/Backend Engineer/)).toBeVisible();
    await expect(sheet.locator('[data-grid-card="match"]')).toBeVisible({ timeout: 10_000 });
  });

  test("the nav pill opens it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/");
    await page.getByRole("button", { name: /^Search/ }).click();
    await expect(dialog(page)).toBeVisible();
  });

  test("the bar sits at the bottom of the page on desktop and steps aside for the chat panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoReady(page, "/");
    const pill = page.getByRole("button", { name: NAME });
    await expect(pill).toBeVisible();
    const box = (await pill.boundingBox())!;
    expect(Math.round(box.width)).toBe(520);
    expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(2);
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "GRID, Vishal's AI" })).toBeVisible();
    await expect(pill).toBeHidden();
  });

  test("typing '/' or '?' inside a form field does not open the Omnibar or help", async ({ page }) => {
    // A real field (the contact form), not an injected node: hydration can discard injected DOM.
    await page.route("**/api/status", (route) => route.fulfill({ json: { checkedAt: "", statuses: {} } }));
    await gotoReady(page, "/");
    await loadIslands(page);
    await page.waitForLoadState("networkidle");
    const message = page.getByLabel("Message");
    await message.scrollIntoViewIfNeeded();
    await message.focus();
    await page.keyboard.type("a/b?c");
    await expect(message).toHaveValue("a/b?c");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("'?' opens the shortcut help overlay", async ({ page }) => {
    await gotoReady(page, "/");
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help).toBeVisible();
    await expect(help.getByText(NAME).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });

  test("the Omnibar has no serious axe violations", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await gotoReady(page, "/");
    await openOmnibar(page);
    await expect(dialog(page)).toBeVisible();
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
