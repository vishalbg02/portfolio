import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { type Page } from "@playwright/test";
import { TOOL_NAMES } from "../../lib/ai/protocol";
import { expect, test } from "./fixtures";
import { gotoHydrated, ownClient } from "./helpers";

/**
 * Meet GRID, the home page's showpiece: a stage with computed counts, a deck whose tiles run real requests, the
 * pipeline strip lit by the stream's real stage events, and the inline chat. Every tile used here is answered by the
 * router, so none of this needs an AI key.
 */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

async function openMeet(page: Page) {
  await mockStatus(page);
  await gotoHydrated(page, "/");
  const section = page.locator("#ask");
  await section.locator("[data-grid-inline]").scrollIntoViewIfNeeded();
  await expect(section.getByRole("log", { name: /Conversation/ })).toBeVisible();
  await expect(section).toHaveAttribute("data-live", "");
  return section;
}

test.beforeEach(async ({ context }) => ownClient(context));

test.describe("Meet GRID @desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the badges are the real counts: passages indexed, tools, languages", async ({ page }) => {
    const section = await openMeet(page);
    const corpus = JSON.parse(
      readFileSync(path.join(process.cwd(), "generated/embeddings.json"), "utf8"),
    ) as {
      chunks: unknown[];
    };
    const badges = section.getByRole("list", { name: "GRID in numbers" }).getByRole("listitem");
    await expect(badges).toHaveText([
      `${corpus.chunks.length} passages`,
      `${TOOL_NAMES.length} tools`,
      "3 languages",
    ]);
  });

  test("a tile runs its request in the inline chat, and the strip lights from the stream's stages", async ({
    page,
  }) => {
    const section = await openMeet(page);
    const strip = section.locator("[data-pipeline]");
    await expect(strip.locator("[data-step]")).toHaveCount(5);
    await expect(strip.locator('[data-state="idle"]')).toHaveCount(5);

    await section.getByRole("link", { name: /^Shows projects/ }).click();
    const log = section.getByRole("log", { name: /Conversation/ });
    await expect(log.getByText("Show me Talnio")).toBeVisible();
    await expect(log.locator('[data-grid-card="project"]')).toBeVisible();
    // no panel opened: the run happened here
    await expect(page.getByRole("dialog", { name: /GRID/ })).toHaveCount(0);

    // the router answered: no retrieval, no ranking, one tool, then the answer
    await expect(strip).toHaveAttribute("data-running", "false");
    await expect(strip).toHaveAttribute("data-router", "true");
    await expect(strip.locator('[data-step="question"]')).toHaveAttribute("data-state", "done");
    await expect(strip.locator('[data-step="retrieve"]')).toHaveAttribute("data-state", "skip");
    await expect(strip.locator('[data-step="rank"]')).toHaveAttribute("data-state", "skip");
    await expect(strip.locator('[data-step="tools"]')).toHaveAttribute("data-state", "done");
    await expect(strip.locator('[data-step="tools"] [data-count]')).toHaveText("· 1");
    await expect(strip.locator('[data-step="answer"]')).toHaveAttribute("data-state", "done");
    await expect(section.locator("[data-pipeline-note]")).toContainText("Router");

    // the strip and the chat are on screen together
    // (the tile's smooth scroll may still be settling under load)
    const inline = section.locator("[data-grid-inline]");
    await expect.poll(async () => (await inline.boundingBox())!.y).toBeGreaterThanOrEqual(52);
    await expect
      .poll(async () => {
        const box = (await inline.boundingBox())!;
        return box.y + box.height;
      })
      .toBeLessThanOrEqual(900);
  });

  test("each router tile gets its card: architecture, skill evidence, job match, résumé, message", async ({
    page,
  }) => {
    const section = await openMeet(page);
    const log = section.getByRole("log", { name: /Conversation/ });
    for (const [tile, card] of [
      [/^Draws architecture/, "diagram"],
      [/^Proves skills/, "skill"],
      [/^Matches a job description/, "match"],
      [/^Tailors a résumé/, "resume"],
      [/^Messages Vishal/, "confirm"],
    ] as const) {
      const fresh = section.getByRole("button", { name: "New chat" });
      if (await fresh.count()) await fresh.click();
      await section.getByRole("link", { name: tile }).click();
      await expect(log.locator(`[data-grid-card="${card}"]`).last(), card).toBeVisible();
      await expect(section.locator("[data-pipeline]")).toHaveAttribute("data-running", "false");
    }
    // the message card starts empty: nothing invented is ever sent to Vishal
    const confirm = log.locator('[data-grid-card="confirm"]').last();
    await expect(confirm.getByLabel("Your name")).toHaveValue("");
    await expect(confirm.getByLabel(/^Your email/)).toHaveValue("");
  });

  test("the big face mirrors GRID and looks toward the pointer", async ({ page }) => {
    const section = await openMeet(page);
    const face = section.locator("[data-grid-stage] .gf").first();
    await expect(face).toHaveAttribute("data-state", "idle");
    const tile = section.getByRole("link", { name: /^Messages Vishal/ });
    await tile.hover();
    await expect
      .poll(() => face.evaluate((f) => (f as SVGElement).style.getPropertyValue("--ex")))
      .toMatch(/^\d/); // a positive x offset: the deck is to the right of the face
    // typing in the chat: GRID listens
    await section.getByRole("textbox", { name: "Ask GRID" }).fill("Hello");
    await expect(face).toHaveAttribute("data-state", "listening");
  });

  test("empty chat: four suggestions and the / shortcut; the old demo reel is gone", async ({ page }) => {
    const section = await openMeet(page);
    await expect(section.getByRole("list", { name: "Suggested questions" }).getByRole("button")).toHaveCount(
      4,
    );
    await expect(section.getByText("Press / anywhere to ask.")).toBeVisible();
    await expect(section.getByRole("figure", { name: "An example conversation with GRID" })).toHaveCount(0);
    await expect(section.getByRole("link", { name: "Read how it was built →" })).toHaveAttribute(
      "href",
      "/log/an-assistant-that-says-i-dont-know",
    );
  });

  test("the chat controls: one mode group and a reply-language list", async ({ page }) => {
    const section = await openMeet(page);
    const modes = section.getByRole("group", { name: "Mode" });
    await expect(modes.getByRole("button")).toHaveText(["Ask anything", "Recruiter", "Engineer", "Tour"]);
    await expect(modes.getByRole("button", { name: "Ask anything" })).toHaveAttribute("aria-pressed", "true");
    const lang = section.getByRole("combobox", { name: "Reply language" });
    await expect(lang).toHaveValue("auto");
    await expect(lang.getByRole("option")).toHaveText(["Auto", "English", "ಕನ್ನಡ", "हिन्दी"]);
  });

  test("axe: clean idle and after a run", async ({ page }) => {
    const section = await openMeet(page);
    const scan = () => new AxeBuilder({ page }).include("#ask").analyze();
    expect((await scan()).violations).toEqual([]);
    await section.getByRole("link", { name: /^Proves skills/ }).click();
    await expect(section.locator("[data-pipeline]")).toHaveAttribute("data-running", "false");
    expect((await scan()).violations).toEqual([]);
  });
});

test.describe("Meet GRID @phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("a tile opens GRID full screen with its request, and the sheet has a handle", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const section = page.locator("#ask");
    await section.scrollIntoViewIfNeeded();
    await section.getByRole("link", { name: /^Shows projects/ }).click();
    const dialog = page.getByRole("dialog", { name: /GRID/ });
    await expect(dialog.locator('[data-grid-card="project"]')).toBeVisible();
    await expect(dialog.locator("[data-grid-handle]")).toBeVisible();
  });
});

for (const [width, height, touch] of [
  [390, 844, false],
  [390, 844, true],
  [768, 1024, true],
  [768, 1024, false],
  [1440, 900, false],
] as const) {
  test.describe(`@${width}px${touch ? " touch" : ""}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    test("the section's height does not change when the chat loads in", async ({ page }) => {
      await mockStatus(page);
      await gotoHydrated(page, "/");
      const section = page.locator("#ask");
      const before = await section.evaluate((e) => e.getBoundingClientRect().height);
      await section.locator("[data-grid-inline]").scrollIntoViewIfNeeded();
      await expect(section.getByRole("log", { name: /Conversation/ })).toBeVisible();
      const after = await section.evaluate((e) => e.getBoundingClientRect().height);
      expect(Math.abs(after - before), `${before} → ${after}`).toBeLessThanOrEqual(8);
    });
  });
}
