import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoHydrated, ownClient } from "./helpers";

/** The Ask section's intro: a loop of GRID's real answers, controls to pause and choose, and a chat that opens where it was. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

async function openAsk(page: Page) {
  await mockStatus(page);
  await gotoHydrated(page, "/");
  const section = page.locator("#ask");
  await section.scrollIntoViewIfNeeded();
  const demo = section.getByRole("figure", { name: "An example conversation with GRID" });
  await expect(demo).toBeVisible();
  return { section, demo };
}

test.beforeEach(async ({ context }) => ownClient(context));

test.describe("the Ask section's demo", () => {
  test("types the question, shows GRID working, then its card and answer, then moves to the next example", async ({
    page,
  }) => {
    await page.clock.install();
    const { demo } = await openAsk(page);
    await page.clock.runFor(1500);
    await expect(demo.getByTestId("demo-question")).toHaveText("Show me Talnio");
    await page.clock.runFor(3500);
    await expect(demo.locator('[data-grid-card="project"]')).toBeVisible();
    await expect(demo.locator(".demo-stage").getByText("Here is Talnio")).toBeVisible();
    await page.clock.runFor(9000);
    await expect(demo).toHaveAttribute("data-demo-scene", "1");
    await expect(demo.getByTestId("demo-question")).not.toHaveText("Show me Talnio");
  });

  test("pause freezes it on the finished example; play carries on; the dots choose an example", async ({
    page,
  }) => {
    await page.clock.install();
    const { demo } = await openAsk(page);
    await demo.getByRole("button", { name: "Pause demo" }).click();
    await expect(demo.getByRole("button", { name: "Play demo" })).toHaveAttribute("aria-pressed", "true");
    await page.clock.runFor(30_000);
    await expect(demo).toHaveAttribute("data-demo-scene", "0");
    await expect(demo.locator('[data-grid-card="project"]')).toBeVisible();

    await demo.getByRole("button", { name: /^Example 3 of 4/ }).click();
    await expect(demo.getByRole("button", { name: /^Example 3 of 4/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(demo.getByTestId("demo-question")).toHaveText("Take me to contact");
    await expect(demo.locator('[data-grid-card="navigate"]')).toBeVisible();
    await demo.getByRole("button", { name: /^Example 4 of 4/ }).click();
    await expect(demo.locator('[data-grid-card="book"]')).toBeVisible();

    await demo.getByRole("button", { name: "Play demo" }).click();
    await page.clock.runFor(30_000);
    await expect(demo).not.toHaveAttribute("data-demo-scene", "3");
  });

  test("under reduced motion nothing plays by itself: the first example is already finished, with no pause button", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    const { demo } = await openAsk(page);
    await expect(demo.getByTestId("demo-question")).toHaveText("Show me Talnio");
    await expect(demo.locator('[data-grid-card="project"]')).toBeVisible();
    await expect(demo.getByRole("button", { name: /Pause demo|Play demo/ })).toHaveCount(0);
    await page.clock.runFor(30_000);
    await expect(demo).toHaveAttribute("data-demo-scene", "0");
    await demo.getByRole("button", { name: /^Example 2 of 4/ }).click();
    await expect(demo.getByTestId("demo-question")).toHaveText("Where did he use Spring Boot?");
    await expect(demo.locator('[data-grid-card="skill"]')).toBeVisible();
  });

  test("is invisible to a screen reader as motion, but the same example is there as text", async ({
    page,
  }) => {
    const { section, demo } = await openAsk(page);
    const stage = demo.locator(".demo-stage");
    await expect(stage).toHaveAttribute("aria-hidden", "true");
    await expect(stage).toHaveAttribute("inert", "");
    const caption = await demo.locator("figcaption").textContent();
    expect(caption).toContain("Asked: “");
    expect(caption).toContain("GRID answers:");
    // nothing inside the animated stage can take focus (it is inert), so no hidden focus stop
    expect(
      await stage.evaluate(
        (el) => el.querySelectorAll("a[href], button").length > 0 && !el.hasAttribute("inert"),
      ),
    ).toBe(false);
    // nothing in the whole section is flagged, mid-demo or settled
    for (const settle of [false, true]) {
      if (settle) await demo.getByRole("button", { name: "Pause demo" }).click();
      const res = await new AxeBuilder({ page })
        .include("#ask")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    }
    await expect(section.getByRole("button", { name: "Ask this myself" })).toBeVisible();
  });

  test("'Ask this myself' sends that very question to the real chat, and the demo gives way to it", async ({
    page,
  }) => {
    const { section, demo } = await openAsk(page);
    await demo.getByRole("button", { name: "Pause demo" }).click();
    await demo.getByRole("button", { name: /^Example 2 of 4/ }).click();
    await demo.getByRole("button", { name: "Ask this myself" }).click();
    const log = section.getByRole("log", { name: /Conversation/ });
    await expect(log.getByText("Where did he use Spring Boot?")).toBeVisible();
    await expect(log.locator('[data-grid-card="skill"]')).toBeVisible();
    await expect(demo).toHaveCount(0);
    // GRID shows what it did, can be copied, and a new chat brings the demo back
    await expect(log.getByText("Found the evidence")).toBeVisible();
    await expect(log.getByRole("button", { name: "Copy answer" })).toBeVisible();
    await section.getByRole("button", { name: "New chat" }).click();
    await expect(section.getByRole("figure", { name: "An example conversation with GRID" })).toBeVisible();
  });
});

test.describe("the rest of the intro", () => {
  test("the capability cards open GRID with their question", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const section = page.locator("#ask");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("link")).toHaveCount(8);
    await section.getByRole("link", { name: /^Shows projects/ }).click();
    const dialog = page.getByRole("dialog", { name: /GRID/ });
    await expect(dialog.locator('[data-grid-card="project"]')).toBeVisible();
  });

  test("the chat controls: one mode group and a reply-language list", async ({ page }) => {
    const { section } = await openAsk(page);
    const modes = section.getByRole("group", { name: "Mode" });
    await expect(modes.getByRole("button")).toHaveText(["Ask anything", "Recruiter", "Engineer", "Tour"]);
    await expect(modes.getByRole("button", { name: "Ask anything" })).toHaveAttribute("aria-pressed", "true");
    const lang = section.getByRole("combobox", { name: "Reply language" });
    await expect(lang).toHaveValue("auto");
    await expect(lang.getByRole("option")).toHaveText(["Auto", "English", "ಕನ್ನಡ", "हिन्दी"]);
    await lang.selectOption("kn");
    await expect(lang).toHaveValue("kn");
  });

  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ] as const) {
    test(`@${width}px: the section's height does not change when the chat loads in`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await mockStatus(page);
      await gotoHydrated(page, "/");
      const section = page.locator("#ask");
      const before = await section.evaluate((e) => e.getBoundingClientRect().height);
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByRole("figure", { name: "An example conversation with GRID" })).toBeVisible();
      const after = await section.evaluate((e) => e.getBoundingClientRect().height);
      expect(Math.abs(after - before), `${before} → ${after}`).toBeLessThanOrEqual(60);
    });
  }
});
