import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, loadIslands } from "./helpers";

/** V3 · Phase 5: the Stack as a map: skills on the left, projects on the right, wires between, an accordion on phones. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

async function openStack(page: Page) {
  await mockStatus(page);
  await gotoHydrated(page, "/");
  await loadIslands(page);
  const stack = page.locator("#stack");
  await stack.scrollIntoViewIfNeeded();
  return stack;
}

test.describe("Stack map, desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("skills sit on the left grouped by area, projects on the right, with a faint wire for every real connection", async ({
    page,
  }) => {
    const stack = await openStack(page);
    await expect(stack.getByRole("heading", { level: 3 })).toHaveText([
      "Backend",
      "Frontend",
      "Mobile",
      "Data & Cloud",
      "AI",
      "Tools",
    ]);
    const skill = (await stack.getByRole("button", { name: "Firebase" }).boundingBox())!;
    const project = (await stack.locator("[data-marker='talnio']").boundingBox())!;
    expect(skill.x + skill.width).toBeLessThan(project.x - 60); // a clear gutter for the wires
    // one project dot per project that used a skill, named for a screen reader
    await expect(
      stack.getByRole("button", { name: /Firebase.*used in Golden Verdict, Talnio/ }),
    ).toBeVisible();
    const wires = await stack.locator("[data-layer=base] path").count();
    expect(wires).toBeGreaterThanOrEqual(15);
    expect(await stack.locator("[data-layer=base] path").first().getAttribute("stroke-width")).toBe("1");
  });

  test("pinning a skill lights its wires (drawn in) and its projects, and can ask GRID where it was used", async ({
    page,
  }) => {
    const stack = await openStack(page);
    const firebase = stack.getByRole("button", { name: /^Firebase/ });
    await firebase.click();
    await expect(firebase).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(2, 2);
    await expect(stack.locator(".stack-line")).toHaveCount(2); // Golden Verdict and Talnio
    await expect(stack.locator("[data-marker='golden-verdict']")).toBeVisible();
    const dash = await stack
      .locator(".stack-wire")
      .first()
      .evaluate((e) => getComputedStyle(e).strokeDasharray);
    expect(dash).not.toBe("none"); // the wire draws in (a dash animation) when motion is allowed
    await stack.getByRole("button", { name: "Ask GRID where" }).click();
    await expect(
      page.getByRole("dialog", { name: /GRID/ }).getByText("Where did he use Firebase?"),
    ).toBeVisible();
  });

  test("under reduced motion the lit wires are plain, finished lines", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const stack = await openStack(page);
    await stack.getByRole("button", { name: /^Firebase/ }).click();
    await page.mouse.move(2, 2);
    await expect(stack.locator(".stack-line")).toHaveCount(2);
    const style = await stack
      .locator(".stack-wire")
      .first()
      .evaluate((e) => {
        const cs = getComputedStyle(e);
        return { dash: cs.strokeDasharray, animation: cs.animationName };
      });
    expect(style).toEqual({ dash: "none", animation: "none" });
  });

  test("is axe-clean with a project pinned", async ({ page }) => {
    const stack = await openStack(page);
    await stack.locator("[data-marker='lansymphony']").click();
    const res = await new AxeBuilder({ page })
      .include("#stack")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

test.describe("Stack map, phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("an accordion by area: one open at a time, skills as 44 px rows with a dot per project, details under the one you tap", async ({
    page,
  }) => {
    const stack = await openStack(page);
    await expect(stack.getByTestId("stack-lines")).toHaveCount(0);
    const areas = stack.getByRole("heading", { level: 3 }).getByRole("button");
    await expect(areas).toHaveCount(6);
    await expect(areas.first()).toHaveAttribute("aria-expanded", "true");
    await expect(areas.nth(1)).toHaveAttribute("aria-expanded", "false");
    await expect(stack.getByRole("button", { name: /^Spring Boot/ })).toBeVisible();
    await areas.nth(1).click();
    await expect(areas.first()).toHaveAttribute("aria-expanded", "false");
    await expect(areas.nth(1)).toHaveAttribute("aria-expanded", "true");
    const react = stack.getByRole("button", { name: /^React/ }).first();
    await expect(react).toBeVisible();
    expect((await react.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await react.click();
    await expect(stack.locator("[aria-live=polite]")).toContainText("used in");
    await expect(stack.getByRole("button", { name: "Ask GRID where" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
