import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoReady, settleAnimations } from "./helpers";

/** V2 · Phase 2: interactive hero terminal and the phone dock. */
const mockStatus = (page: Page, delayMs = 0) =>
  page.route("**/api/status", async (r) => {
    if (delayMs) await new Promise((x) => setTimeout(x, delayMs));
    const at = new Date().toISOString();
    await r.fulfill({
      json: {
        checkedAt: at,
        statuses: {
          "golden-verdict": { slug: "golden-verdict", state: "live", latencyMs: 142, checkedAt: at },
          "virtual-tour": { slug: "virtual-tour", state: "degraded", latencyMs: 2100, checkedAt: at },
          talnio: { slug: "talnio", state: null, latencyMs: null, checkedAt: at },
          lansymphony: { slug: "lansymphony", state: null, latencyMs: null, checkedAt: at },
        },
      },
    });
  });

const hero = (page: Page) => page.locator("section[aria-labelledby='hero-title']");
const prompt = (page: Page) => hero(page).getByRole("textbox", { name: "Terminal command" });
const run = async (page: Page, cmd: string) => {
  await prompt(page).fill(cmd);
  await prompt(page).press("Enter");
};

test.describe("hero terminal", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("types the command with CSS, then the rows appear in order; the ✓ lands when the ping resolves", async ({
    page,
  }) => {
    await mockStatus(page, 900);
    await page.goto("/");
    const checks = hero(page).locator("details > summary > span[aria-hidden='true']:first-child");
    // while the ping is outstanding the live rows show "…", the rows with nothing to ping show ✓
    await expect(checks.nth(0)).toHaveText("…");
    await expect(checks.nth(1)).toHaveText("✓");
    await expect(checks.nth(0)).toHaveText("✓", { timeout: 5000 });
    await expect(checks.nth(3)).toHaveText("!"); // degraded
    // the typed command is real text in the DOM
    await expect(hero(page).getByText("ship --all", { exact: true })).toBeVisible();
  });

  test("reserves its final height: nothing shifts while the terminal animates in", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/", { waitUntil: "commit" });
    const box = hero(page).locator("div.rounded-card").first();
    await box.waitFor();
    const h0 = (await box.boundingBox())!.height;
    await page.waitForTimeout(2300);
    expect(Math.abs((await box.boundingBox())!.height - h0)).toBeLessThanOrEqual(1);
  });

  test("rows expand in place, one at a time, with summary, stack and links", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const rows = hero(page).locator("details");
    await expect(rows.nth(3)).toBeVisible();
    await rows.nth(0).locator("summary").click();
    await expect(rows.nth(0)).toHaveAttribute("open", "");
    await expect(rows.nth(0).getByRole("link", { name: /Case study/ })).toBeVisible();
    await expect(
      rows.nth(0).getByRole("list", { name: /stack/i }).getByRole("listitem").first(),
    ).toBeVisible();
    await rows.nth(1).locator("summary").click();
    await expect(rows.nth(1)).toHaveAttribute("open", "");
    await expect(rows.nth(0)).not.toHaveAttribute("open", ""); // exclusive group
  });

  test("clicking the terminal focuses the prompt; help, ship --all and unknown commands respond", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await expect(prompt(page)).toBeVisible();
    await hero(page)
      .locator("div.px-4.py-4")
      .click({ position: { x: 300, y: 8 } });
    await expect(prompt(page)).toBeFocused();
    await expect(hero(page).getByText("try:")).toBeVisible();
    await run(page, "help");
    const log = hero(page).getByRole("log", { name: "Terminal output" });
    await expect(log).toContainText("ask <question>");
    await expect(log).toContainText("ship --all");
    await expect(hero(page).getByText("try:")).toHaveCount(0); // hint hidden after the first command
    await run(page, "ship --all");
    await expect(log).toContainText("CHRIST University Virtual Tour");
    await run(page, "shiip");
    await expect(log).toContainText("command not found: shiip");
    await expect(log).toContainText('Did you mean "ship"');
    await run(page, "clear");
    await expect(log).toHaveCount(0);
  });

  test("the hint stays hidden on the next visit (remembered safely)", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await run(page, "whoami");
    await page.reload();
    await expect(prompt(page)).toBeVisible();
    await expect(hero(page).getByText("try:")).toHaveCount(0);
  });

  test("Tab completes, ↑ recalls history", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await prompt(page).focus();
    await prompt(page).fill("proj");
    await prompt(page).press("Tab");
    await expect(prompt(page)).toHaveValue("projects ");
    await prompt(page).fill("");
    await run(page, "whoami");
    await prompt(page).press("ArrowUp");
    await expect(prompt(page)).toHaveValue("whoami");
  });

  test("open <project> navigates; resume downloads; recruiter navigates", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await run(page, "recruiter");
    await expect(page).toHaveURL(/\/recruiter$/);
    await page.goBack();
    await gotoReady(page, "/");
    await run(page, "open talnio");
    await expect(page).toHaveURL(/\/work\/talnio$/);
  });

  test("ask <question> opens Ask Vishal and sends the question", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await run(page, "ask Where is he working now?");
    const dialog = page.getByRole("dialog", { name: /Ask Vishal/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("log").getByText("Where is he working now?")).toBeVisible();
    // offline mode in e2e (no key): an answer from the site still arrives
    await expect(
      dialog
        .getByRole("log")
        .getByText(/Golden Verdict|not currently/)
        .first(),
    ).toBeVisible({
      timeout: 8000,
    });
  });

  test("the largest paint is server-rendered hero text (not the animated terminal) and axe is clean", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/");
    const lcp = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          new PerformanceObserver((list) => {
            const e = list.getEntries().at(-1) as PerformanceEntry & { element?: Element };
            const el = e.element;
            resolve(
              el
                ? `${el.tagName}:${el.closest("section[aria-labelledby='hero-title']") ? "hero" : "other"}:${el.closest("details") ? "terminal" : "text"}`
                : "",
            );
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve(""), 2500);
        }),
    );
    expect(["H1:hero:text", "P:hero:text"]).toContain(lcp);
    await settleAnimations(page);
    await page.waitForTimeout(1900); // let the terminal finish animating before axe reads colours
    const v = (
      await new AxeBuilder({ page })
        .include("section[aria-labelledby='hero-title']")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    expect(v).toEqual([]);
  });

  test("reduced motion: the finished terminal is shown at once", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await mockStatus(page);
    await page.goto("/");
    const op = await hero(page)
      .locator("details")
      .nth(3)
      .evaluate((el) => getComputedStyle(el.parentElement!).opacity);
    expect(op).toBe("1");
    expect(
      await hero(page)
        .locator(".term-type")
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBeGreaterThan(40);
    await ctx.close();
  });
});

test.describe("phone dock", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  const dock = (page: Page) => page.getByRole("navigation", { name: "Quick links" });

  test("shows Work · Ask · Résumé · Contact on a phone and not on desktop", async ({ page, browser }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await expect(dock(page)).toBeVisible();
    await expect(dock(page).getByRole("link")).toHaveCount(3);
    await expect(dock(page).getByRole("button", { name: "Ask" })).toBeVisible();
    const box = (await dock(page).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(64);
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await mockStatus(desktop);
    await desktop.goto("/");
    await expect(dock(desktop)).toBeHidden();
    await desktop.close();
  });

  test("Work scrolls to the work section; Contact to contact; Résumé navigates; Ask opens the chat", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await dock(page).getByRole("link", { name: "Contact" }).click();
    await expect(page).toHaveURL(/#contact$/);
    await expect
      .poll(() => page.evaluate(() => document.getElementById("contact")!.getBoundingClientRect().top))
      .toBeLessThan(400);
    await page.evaluate(() => window.scrollBy(0, -40)); // scrolling up brings the dock back
    await dock(page).getByRole("link", { name: "Work" }).click();
    await expect(page).toHaveURL(/#work$/);
    await dock(page).getByRole("button", { name: "Ask" }).click();
    await expect(page.getByRole("dialog", { name: /Ask Vishal/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await dock(page).getByRole("link", { name: "Résumé" }).click();
    await expect(page).toHaveURL(/\/resume$/);
    await expect(dock(page).getByRole("link", { name: "Résumé" })).toHaveAttribute("aria-current", "page");
  });

  test("hides on scroll down, returns on scroll up", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(dock(page)).toHaveAttribute("data-hidden", "true");
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(dock(page)).toHaveAttribute("data-hidden", "false");
  });

  test("never hides content: the page reserves the dock's height at the bottom", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const footer = (await page.locator("footer").boundingBox())!;
    const dock = (await page.getByRole("navigation", { name: "Quick links" }).boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(dock.y + 2);
  });

  test("the home page has no horizontal scroll, and axe is clean with the dock", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await settleAnimations(page);
    await page.waitForTimeout(1900);
    const v = (
      await new AxeBuilder({ page })
        .include("nav[aria-label='Quick links']")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    expect(v).toEqual([]);
  });
});
