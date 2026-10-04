import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, settleAnimations } from "./helpers";

/** V2 · Phase 3: Experience as a git history; milestones and the year switcher on the activity calendar. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

const axe = async (page: Page, include: string) => {
  await settleAnimations(page);
  const res = await new AxeBuilder({ page })
    .include(include)
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
};

test.describe("experience as a git history", () => {
  test("is an ordered list of roles with dates; the graph is decorative", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const exp = page.locator("#experience");
    await expect(exp.getByText("$ git log --graph --oneline career")).toBeVisible();
    const list = exp.getByRole("list", { name: "Career history, newest first" });
    await expect(list).toBeVisible();
    // role headings, newest first, each with its period
    const roles = await list.getByRole("heading", { level: 3 }).allTextContents();
    expect(roles).toEqual([
      "Full-Stack Developer",
      "Full-Stack & App Developer Intern",
      "Backend Developer Intern",
    ]);
    for (const period of ["Jan 2026 – May 2026", "Jun 2025 – Mar 2026", "May 2024 – Jul 2024"]) {
      await expect(list.getByText(period, { exact: false }).first()).toBeVisible();
    }
    // every graph gutter is hidden from assistive tech
    const gutters = await exp
      .locator(".git-gutter")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-hidden")));
    expect(gutters.length).toBeGreaterThan(5);
    expect(gutters.every((g) => g === "true")).toBe(true);
  });

  test("branches carry their name; merges and forks show their month; commit ids are stable", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/");
    const exp = page.locator("#experience");
    await expect(exp.getByText(/merge feat\/golden-verdict · May 2026/)).toBeVisible();
    await expect(exp.getByText(/merge feat\/social-agent · Mar 2026/)).toBeVisible();
    await expect(exp.getByText(/branch feat\/social-agent · Jun 2025/)).toBeVisible();
    const ids = await exp
      .locator("code")
      .filter({ hasText: /^[0-9a-f]{7}$/ })
      .allTextContents();
    expect(ids.length).toBe(7); // every bullet is a commit (2 + 3 + 2), the extra ones sit in the collapsed details
    expect(new Set(ids).size).toBe(7);
    await page.reload();
    const again = await page
      .locator("#experience code")
      .filter({ hasText: /^[0-9a-f]{7}$/ })
      .allTextContents();
    expect(again).toEqual(ids);
  });

  test("the graph draws itself once when scrolled into view; reduced motion shows it finished", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.locator("#experience").scrollIntoViewIfNeeded();
    await expect(page.locator("#experience [data-graph]")).toHaveAttribute("data-graph", "play");
    const first = page.locator("#experience .g-line").first();
    await expect
      .poll(async () => first.evaluate((e) => getComputedStyle(e).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test("reduced motion: never armed, lines are fully drawn", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await expect(page.locator("#experience [data-graph]")).toHaveCount(0);
    const tf = await page
      .locator("#experience .g-line")
      .first()
      .evaluate((e) => getComputedStyle(e).transform);
    expect(tf).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test("no serious axe violations (desktop and phone)", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    expect(await axe(page, "#experience")).toEqual([]);
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await axe(page, "#experience")).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("calendar milestones", () => {
  test("pins sit on their month and open a popover on hover, focus and click", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const pins = gh.locator("[data-milestone]");
    await expect(pins).toHaveCount(3);
    await expect(gh.locator("rect[data-pin-cell]")).toHaveCount(3);

    const hackathon = gh.getByRole("button", { name: /24-Hour Hackathon 2026 — 2nd Place, Feb 2026/ });
    await hackathon.hover();
    const pop = gh.getByTestId("milestone-popover");
    await expect(pop).toContainText("24-Hour Hackathon 2026 — 2nd Place");
    await expect(pop).toContainText("SurakshaAI");
    await page.mouse.move(2, 2);
    await expect(pop).toHaveCount(0);

    // keyboard: focus opens it, Escape closes it
    await hackathon.focus();
    await expect(pop).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pop).toHaveCount(0);

    // click pins it open; the proof link works
    const role = gh.getByRole("button", { name: /Started at Golden Verdict, Jan 2026/ });
    await role.click();
    await expect(pop).toContainText("freelance role.");
    await expect(pop.getByRole("link", { name: /See the proof/ })).toHaveAttribute(
      "href",
      "/work/golden-verdict",
    );
    await page.mouse.click(2, 2);
    await expect(pop).toHaveCount(0);
  });

  test("labels in the row above the calendar never overlap", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const boxes = await gh.locator("[data-milestone]").evaluateAll((els) =>
      els.map((b) => {
        const label = b.nextElementSibling as HTMLElement;
        const r = label.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top, b: r.bottom, text: label.textContent };
      }),
    );
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const c = boxes[j]!;
        const overlap = a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
        expect(overlap, `${a.text} vs ${c.text}`).toBe(false);
      }
  });

  test("year switcher loads another year with its own stats and pins", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const group = gh.getByRole("group", { name: "Contribution period" });
    await expect(group.getByRole("button")).toHaveText(["Last 12 months", "2026", "2025", "2024"]);
    await expect(group.getByRole("button", { name: "Last 12 months" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await group.getByRole("button", { name: "2025" }).click();
    await expect(gh.getByText("Contributions, 2025")).toBeVisible();
    await expect(group.getByRole("button", { name: "2025" })).toHaveAttribute("aria-pressed", "true");
    // Jun 2025 (Social Agent) and Aug 2025 (OpenBuild) fall inside 2025
    await expect(gh.locator("[data-milestone]")).toHaveCount(2);
    await expect(
      gh.getByRole("button", { name: /Windsurf × The AI Collective OpenBuild — 2nd Place/ }),
    ).toBeVisible();

    await group.getByRole("button", { name: "2024" }).click();
    await expect(gh.getByText("Contributions, 2024")).toBeVisible();
    await expect(gh.getByRole("button", { name: /Gamecraft — 1st Place/ })).toBeVisible();

    await group.getByRole("button", { name: "Last 12 months" }).click();
    await expect(gh.getByText("Contributions, last year")).toBeVisible();
    await expect(gh.locator("[data-milestone]")).toHaveCount(3);
  });

  test("the calendar API validates the year and serves a cached calendar", async ({ request }) => {
    const bad = await request.get("/api/github/calendar?year=abc");
    expect(bad.status()).toBe(400);
    const future = await request.get("/api/github/calendar?year=2999");
    expect(future.status()).toBe(400);
    const ok = await request.get("/api/github/calendar?year=2025");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toContain("s-maxage=3600");
    const body = await ok.json();
    expect(body.year).toBe(2025);
    expect(body.calendar.weeks.length).toBeGreaterThanOrEqual(52);
  });

  test("phone: milestones are a tappable list that opens the story", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const item = gh.getByRole("button", { name: /Innovation Sprint 2026 — 2nd Place/ }).last();
    await expect(item).toBeVisible();
    await item.click();
    await expect(item).toHaveAttribute("aria-expanded", "true");
    await expect(gh.getByText(/NEOSTATS/)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("no serious axe violations in the activity block (desktop and phone)", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.locator("#github").scrollIntoViewIfNeeded();
    expect(await axe(page, "#github")).toEqual([]);
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await axe(page, "#github")).toEqual([]);
  });
});
