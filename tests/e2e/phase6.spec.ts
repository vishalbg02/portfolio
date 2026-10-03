import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoReady, settleAnimations } from "./helpers";

/**
 * Phase 6: /recruiter, Ship Log, /now. The CI build sets SHOW_DRAFTS=true so the three seeded
 * draft posts are visible here; a production build hides them (unit-tested in tests/unit/log.test.ts).
 */
const axe = async (page: Page) => {
  await settleAnimations(page);
  return (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
};

const POST = "an-assistant-that-says-i-dont-know";

test.describe("recruiter mode", () => {
  test("is a static route with the essentials, a matcher, and no serious axe violations", async ({
    page,
  }) => {
    await page.goto("/recruiter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vishal B G");
    await expect(page.getByText("Available for SDE / Full Stack roles")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download résumé" })).toHaveAttribute("href", "/resume.pdf");
    await expect(page.getByRole("main").getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:vishalbg02@gmail.com",
    );
    for (const h of ["Experience", "Shipped projects", "Skills", "Recognition"]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Paste your job description" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Case study" })).toHaveCount(4);
    expect(await axe(page)).toEqual([]);
  });

  test("?mode=recruiter redirects to /recruiter", async ({ page }) => {
    await page.goto("/?mode=recruiter");
    await expect(page).toHaveURL(/\/recruiter(\?.*)?$/);
  });

  test("the nav toggle flips between the two views", async ({ page }) => {
    await gotoReady(page, "/");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Recruiter mode" })
      .click();
    await expect(page).toHaveURL(/\/recruiter$/);
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Full site" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the palette offers Recruiter Mode", async ({ page }) => {
    await gotoReady(page, "/");
    await page.keyboard.press("Control+k");
    const box = page.getByRole("combobox");
    await expect(box).toBeFocused();
    await box.fill("recruiter");
    await page.getByRole("option", { name: /Recruiter Mode/ }).click();
    await expect(page).toHaveURL(/\/recruiter$/);
  });

  test("has no horizontal overflow at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/recruiter");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("now", () => {
  test("shows only facts that exist, says he is available, and has no serious axe violations", async ({
    page,
  }) => {
    await page.goto("/now");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What I'm doing now");
    await expect(page.getByText("Available for SDE / Full Stack roles")).toBeVisible();
    await expect(page.getByText("Studying", { exact: true })).toBeVisible();
    // The Social Agent internship ended (Mar 2026); the only "Working" line is the ongoing freelance project.
    await expect(page.getByText("Working", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Freelance full-stack developer on Golden Verdict \(Jan 2026 – Present\)/),
    ).toBeVisible();
    // Unset TODO(vishal) fields stay hidden.
    await expect(page.getByText("Reading", { exact: true })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
  });
});

test.describe("ship log", () => {
  test("lists posts with date, reading time and tags, and offers RSS", async ({ page }) => {
    await page.goto("/log");
    await expect(page.getByRole("heading", { level: 1, name: "Ship Log" })).toBeVisible();
    const items = page.getByRole("main").locator("ul.divide-y > li");
    await expect(items).toHaveCount(3);
    await expect(items.first()).toContainText("min read");
    await expect(page.locator("link[rel='alternate'][type='application/rss+xml']")).toHaveAttribute(
      "href",
      /\/log\/rss\.xml$/,
    );
    expect(await axe(page)).toEqual([]);
  });

  test("a post has a table of contents that links to its headings, tags, and neighbours", async ({
    page,
  }) => {
    await page.goto(`/log/${POST}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("I don’t know");
    const toc = page.getByRole("navigation", { name: "Table of contents" });
    await expect(toc.getByRole("link")).toHaveCount(await page.locator("article h2, article h3").count());
    await toc.getByRole("link", { name: "Retrieval: keywords and meaning together" }).click();
    await expect(page).toHaveURL(/#retrieval-keywords-and-meaning-together$/);
    await expect(page.locator("#retrieval-keywords-and-meaning-together")).toBeVisible();
    await expect(page.getByText("Draft — hidden in production")).toBeVisible();
    await expect(page.getByRole("list", { name: "Tags" }).getByText("rag")).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("a draft post is marked noindex", async ({ page }) => {
    await page.goto(`/log/${POST}`);
    expect(await page.locator("meta[name='robots']").getAttribute("content")).toContain("noindex");
  });

  test("unknown posts 404", async ({ page }) => {
    expect((await page.goto("/log/not-a-post"))?.status()).toBe(404);
  });

  test("RSS is valid XML listing the posts", async ({ request }) => {
    const res = await request.get("/log/rss.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml.match(/<item>/g)).toHaveLength(3);
    expect(xml).toContain(`/log/${POST}</link>`);
  });

  test("each post has an Open Graph image", async ({ request }) => {
    const res = await request.get(`/log/${POST}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  });
});
