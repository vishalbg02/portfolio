import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, gotoReady, ownClient } from "./helpers";

const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

const SHEET = "GRID, Vishal's AI";
const sheet = (page: Page) => page.getByRole("dialog", { name: SHEET });
const heroAsk = (page: Page) => page.getByRole("link", { name: "Ask GRID", exact: true }).first();

async function openSheet(page: Page) {
  await heroAsk(page).click();
  await expect(sheet(page)).toBeVisible();
  return sheet(page);
}
async function ask(page: Page, text: string) {
  const box = sheet(page).getByRole("textbox", { name: "Ask GRID" });
  await box.fill(text);
  await box.press("Enter");
}

test.beforeEach(async ({ context }) => ownClient(context));

test.describe("GRID: the hero and the section headers", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the hero has Ask GRID as a third primary action, with the promise line, and it opens the chat", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await expect(page.getByRole("link", { name: "View work" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Résumé" }).first()).toBeVisible();
    await expect(heroAsk(page)).toBeVisible();
    await expect(page.getByText("Ask anything about my work, or let GRID show you around.")).toBeVisible();
    await openSheet(page);
  });

  test("without JS, Ask GRID still goes somewhere useful: the Ask section", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    const link = page.getByRole("link", { name: "Ask GRID", exact: true }).first();
    await expect(link).toHaveAttribute("href", "/#ask");
    await ctx.close();
  });

  test("a section's 'Ask about this' opens GRID with a question about that section and answers it", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask about this: Experience" }).click();
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("log").getByText("Walk me through his experience.")).toBeVisible();
    await expect(
      dialog
        .getByRole("log")
        .getByText(/Kaha|Cove|intern/i)
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("selecting a sentence on the page offers 'Ask GRID' about it", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    // select the headline sentence by script (a real drag is not reliable across runners)
    await page.evaluate(() => {
      const p = [...document.querySelectorAll("main p")].find((n) => (n.textContent ?? "").length > 30)!;
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const bubble = page.getByRole("button", { name: "Ask GRID", exact: true });
    await expect(bubble).toBeVisible();
    await bubble.click();
    await expect(sheet(page)).toBeVisible();
    await expect(
      sheet(page)
        .getByRole("log")
        .getByText(/Tell me more about this, from his site/),
    ).toBeVisible();
  });
});

test.describe("GRID: the panel on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("is a 420 px sheet on the right that does not dim or lock the page", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const dialog = await openSheet(page);
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(420);
    await expect // it slides in: wait for it to settle against the right edge
      .poll(async () => {
        const b = (await dialog.boundingBox())!;
        return Math.round(b.x + b.width);
      })
      .toBe(1440);
    // the page beside it still works: clicking a nav link navigates and leaves the chat open
    await page.getByRole("link", { name: "Recruiter mode" }).first().click();
    await expect(page).toHaveURL(/\/recruiter$/);
    await expect(sheet(page)).toBeVisible();
  });

  test("resizes with the keyboard (and remembers its width)", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const dialog = await openSheet(page);
    const handle = dialog.getByRole("separator", { name: "Resize the chat panel" });
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", "436");
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", "500");
    await page.keyboard.press("Home");
    await expect(handle).toHaveAttribute("aria-valuenow", "340");
    await page.keyboard.press("End");
    await expect(handle).toHaveAttribute("aria-valuenow", "720");
    await page.keyboard.press("Home");
    await page.reload();
    await gotoReady(page, "/");
    await openSheet(page);
    await expect(sheet(page).getByRole("separator")).toHaveAttribute("aria-valuenow", "340");
  });

  test("can be docked: the page makes room instead of being covered", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const dialog = await openSheet(page);
    const toggle = dialog.getByRole("button", { name: "Dock the panel beside the page" });
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-grid-dock", "open");
    await expect(dialog.getByRole("button", { name: "Float the panel over the page" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const pad = await page.evaluate(() => getComputedStyle(document.body).paddingRight);
    expect(pad).toBe("420px");
    await dialog.getByRole("button", { name: "Float the panel over the page" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-grid-dock", "open");
  });

  test("closing it with the button or Escape gives the page back", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const dialog = await openSheet(page);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Ask GRID or run a command" })).toBeVisible();
    await openSheet(page);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
  });
});

test.describe("GRID: the conversation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("is remembered across a reload, can be exported as Markdown, and cleared with New chat", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await openSheet(page);
    await ask(page, "How can I contact him?");
    await expect(sheet(page).locator('[data-grid-card="contact"]')).toBeVisible();

    await page.reload();
    await gotoReady(page, "/");
    await openSheet(page);
    const log = sheet(page).getByRole("log");
    await expect(log.getByText("How can I contact him?")).toBeVisible();
    await expect(log.locator('[data-grid-card="contact"]')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      sheet(page).getByRole("button", { name: "Export" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("grid-conversation.md");
    const path = await download.path();
    const md = (await import("node:fs")).readFileSync(path, "utf8");
    expect(md).toContain("# Conversation with GRID");
    expect(md).toContain("**You:** How can I contact him?");
    expect(md).toContain("[card] Contact:");

    await sheet(page).getByRole("button", { name: "New chat" }).click();
    await expect(sheet(page).getByRole("list", { name: "Suggested questions" })).toBeVisible();
    await page.reload();
    await gotoReady(page, "/");
    await openSheet(page);
    await expect(sheet(page).getByRole("list", { name: "Suggested questions" })).toBeVisible(); // nothing came back
  });

  test("a conversation that cannot be saved (storage blocked) still works", async ({ page }) => {
    await mockStatus(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    await gotoReady(page, "/");
    await openSheet(page);
    await ask(page, "How can I contact him?");
    await expect(sheet(page).locator('[data-grid-card="contact"]')).toBeVisible();
  });

  test("modes change the suggestions; 'Brief me in 30 seconds' answers from the site", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const dialog = await openSheet(page);
    await dialog.getByRole("button", { name: "Recruiter", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Recruiter", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      dialog.getByRole("list", { name: "Suggested questions" }).getByRole("button").first(),
    ).toHaveText("Is he a fit for a full-stack role?");
    await dialog.getByRole("button", { name: "Brief me in 30 seconds" }).click();
    const log = dialog.getByRole("log");
    await expect(log.getByText("Brief me in 30 seconds")).toBeVisible();
    await expect(log.getByText(/Vishal/).first()).toBeVisible();
    await expect(log.getByRole("button", { name: /Jump to/ }).first()).toBeVisible();
    // three follow-ups, on the last answer only
    await expect(dialog.getByRole("list", { name: "Suggested follow-ups" }).getByRole("button")).toHaveCount(
      3,
    );
  });

  test("a project question draws the real project card with actions that ask for more", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await openSheet(page);
    await ask(page, "Show me Talnio");
    const card = sheet(page).locator('[data-grid-card="project"]');
    await expect(card).toContainText("Talnio");
    await expect(card.getByRole("link", { name: /Case study/ })).toHaveAttribute("href", "/work/talnio");
    await expect(card.locator("img")).toHaveAttribute("src", /\/media\//);
    await card.getByRole("button", { name: "Architecture" }).click();
    await expect(sheet(page).locator('[data-grid-card="diagram"]')).toBeVisible({ timeout: 10_000 });
  });

  test("a skill question shows the evidence, each item linking to where it is", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await openSheet(page);
    await ask(page, "Where did he use Spring Boot?");
    const card = sheet(page).locator('[data-grid-card="skill"]');
    await expect(card).toContainText("Spring Boot");
    await expect(card.getByRole("link").first()).toHaveAttribute("href", /^\/(work\/|#)/);
  });
});

test.describe("GRID: it takes you places", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("'take me to contact' scrolls the page to Contact and flashes it, with the chat still open", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await openSheet(page);
    await ask(page, "take me to contact");
    await expect(sheet(page).locator('[data-grid-card="navigate"]')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.getElementById("contact")!.getBoundingClientRect().top))
      .toBeLessThan(500);
    await expect(sheet(page)).toBeVisible();
  });

  test("'play the LanSymphony demo' moves the Work showcase to that project", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await openSheet(page);
    await ask(page, "play the LanSymphony demo");
    await expect(sheet(page).locator('[data-grid-card="demo"]')).toBeVisible();
    await expect(page.locator('.scene[data-project="lansymphony"]')).toHaveAttribute("data-active", "", {
      timeout: 8000,
    });
  });

  test("on another page, a walkthrough opens that project's case study", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/recruiter");
    await page.keyboard.press("Control+k");
    await page.keyboard.type("play the LanSymphony demo");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/work\/lansymphony$/, { timeout: 8000 });
  });
});

test.describe("GRID: the panel on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("is full screen, GRID is the dock's larger middle button, and a 'take me there' closes it to show the page", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const dockBtn = page
      .getByRole("navigation", { name: "Quick links" })
      .getByRole("button", { name: "Ask GRID" });
    const sizes = await dockBtn.boundingBox();
    expect(sizes!.width).toBeGreaterThan(52); // larger than the other dock items' icons
    await dockBtn.click();
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.height)).toBe(844);
    await ask(page, "take me to contact");
    await expect(dialog).toBeHidden({ timeout: 5000 });
    await expect
      .poll(() => page.evaluate(() => document.getElementById("contact")!.getBoundingClientRect().top))
      .toBeLessThan(500);
    // and it is still there when you come back
    await dockBtn.click();
    await expect(sheet(page).getByRole("log").getByText("take me to contact")).toBeVisible();
  });

  test("the dock keeps five items, in order, with GRID in the middle", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const dock = page.getByRole("navigation", { name: "Quick links" });
    const items = dock.locator("a, button");
    await expect(items).toHaveCount(5);
    await expect(items).toHaveText(
      ["Work", "Résumé", "GRID", "Recruiter", "Contact"].map((t) => new RegExp(t)),
    );
  });
});
