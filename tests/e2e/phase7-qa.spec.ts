import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoReady, ownClient, settleAnimations } from "./helpers";

/** V3 · Phase 7: accessibility and layout of the new states, across devices, and no CSP violation or console error in any of them. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

test.beforeEach(async ({ context }) => ownClient(context));

const axe = async (page: Page, include?: string) => {
  await settleAnimations(page); // fades and the pixel dissolve pass through low-contrast colours on the way in
  const b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
  if (include) b.include(include);
  return (await b.analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
};

/** Collects console errors, page errors and CSP violations for the whole test. */
async function watch(page: Page) {
  const problems: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) =>
      console.error(
        `CSP violation: ${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber} ${e.sample}`,
      ),
    );
  });
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

const WIDTHS = [
  [360, 780],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const;

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("new states: accessibility", () => {
  test("the tour card (open, mid-tour) has no serious axe violations", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.keyboard.press("t");
    await expect(page.getByTestId("tour")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("tour")).toContainText("Stop 2 of 6");
    await page.keyboard.press("Space");
    expect(await axe(page, "[data-testid=tour]")).toEqual([]);
    expect(await axe(page)).toEqual([]);
  });

  test("a personal link's banner and its open panel have no serious axe violations", async ({ page }) => {
    await mockStatus(page);
    await page.route("**/api/link?*", (r) =>
      r.fulfill({ json: { ok: true, id: "ab12cd34", company: "Infosys", role: "Backend Developer" } }),
    );
    await page.goto("/?c=ab12cd34.AbCdEfGhIjKlMnOp");
    const banner = page.getByTestId("company-banner");
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: /What's relevant/ }).click();
    await expect(page.locator("#company-panel")).toBeVisible();
    expect(await axe(page, "[data-testid=company-banner]")).toEqual([]);
    expect(await axe(page)).toEqual([]);
  });

  test("the explorer list, the footer wall and the sound switch have no serious axe violations", async ({
    page,
  }) => {
    await page.route("**/api/here", (r) =>
      r.fulfill({ json: { configured: true, count: 5, cells: [2, 40, 90, 150, 200] } }),
    );
    await mockStatus(page);
    await page.clock.install();
    await gotoReady(page, "/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.clock.runFor(3000);
    await expect(page.getByTestId("here-wall")).toContainText("5 people here now");
    expect(await axe(page, "footer")).toEqual([]);
    await page.getByTestId("ach-count").click();
    await expect(page.getByRole("dialog", { name: /Explorer/ })).toBeVisible();
    expect(await axe(page, "[role=dialog]")).toEqual([]);
  });

  test("the 3D city, its controls and a landmark story have no serious axe violations on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockStatus(page);
    await gotoReady(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    await gh.getByRole("button", { name: "3D city" }).click();
    await expect(page.getByTestId("city-canvas")).toBeVisible();
    await page.getByTestId("city").locator("[data-landmark]").first().click();
    await expect(page.getByTestId("city-story")).toBeVisible();
    expect(await axe(page, "#github")).toEqual([]);
  });
});

for (const [width, height] of WIDTHS) {
  test.describe(`@${width}px`, () => {
    // Phones have a coarse pointer, where the controls grow to 44 px; wider screens keep the 32 px desktop size.
    test.use({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768 });

    test("the tour card stays on screen, clear of the dock, and nothing scrolls sideways", async ({
      page,
    }) => {
      await mockStatus(page);
      await gotoReady(page, "/");
      await page.keyboard.press("t");
      const card = page.getByTestId("tour");
      await expect(card).toBeVisible();
      await page.keyboard.press("ArrowRight");
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      if (width < 768) {
        const dock = (await page.getByRole("navigation", { name: "Quick links" }).boundingBox())!;
        expect(box.y + box.height, "the card sits above the dock").toBeLessThanOrEqual(dock.y + 1);
      }
      for (const b of await card.getByRole("button").all()) {
        const r = (await b.boundingBox())!;
        expect(r.height, "tap target").toBeGreaterThanOrEqual(width < 768 ? 44 : 32);
      }
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });

    test("a personal link's banner fits, its panel scrolls with the page, and nothing overflows", async ({
      page,
    }) => {
      await mockStatus(page);
      await page.route("**/api/link?*", (r) =>
        r.fulfill({
          json: { ok: true, id: "ab12cd34", company: "Tata Consultancy Services", role: "Java Developer" },
        }),
      );
      await page.goto("/?c=ab12cd34.AbCdEfGhIjKlMnOp");
      const banner = page.getByTestId("company-banner");
      await expect(banner).toBeVisible();
      const b1 = (await banner.boundingBox())!;
      expect(b1.x).toBeGreaterThanOrEqual(0);
      expect(b1.x + b1.width).toBeLessThanOrEqual(width + 0.5);
      await banner.getByRole("button", { name: /What's relevant/ }).click();
      await expect(page.locator("#company-panel")).toBeVisible();
      const b2 = (await banner.boundingBox())!;
      expect(b2.y + b2.height, "the open panel fits the screen").toBeLessThanOrEqual(height);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await banner.getByRole("button", { name: "Dismiss" }).click();
      await expect(banner).toHaveCount(0);
    });

    test("the footer (visitor wall, discovered count, sound) fits and keeps its size", async ({ page }) => {
      await mockStatus(page);
      await gotoReady(page, "/");
      await page.locator("footer").scrollIntoViewIfNeeded();
      const wall = page.getByTestId("here-wall");
      const w = (await wall.boundingBox())!;
      expect(w.x + w.width).toBeLessThanOrEqual(width + 0.5);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      for (const name of [/discovered/, /^Sound/]) {
        const r = (await page.getByRole("button", { name }).boundingBox())!;
        expect(r.height).toBeGreaterThanOrEqual(width < 768 ? 44 : 32);
      }
    });
  });
}

test.describe("no console errors and no CSP violations in any new flow", () => {
  test("tour, achievements, sound, the wall, a personal link, the 3D city and keyboard navigation", async ({
    page,
  }) => {
    const problems = await watch(page);
    await page.route("**/api/here", (r) =>
      r.fulfill({ json: { configured: true, count: 2, cells: [3, 4] } }),
    );
    await page.route("**/api/link?*", (r) =>
      r.fulfill({ json: { ok: true, id: "ab12cd34", company: "Infosys", role: "SDE" } }),
    );
    await page.route("**/api/link/event", (r) => r.fulfill({ json: { ok: true } }));
    await mockStatus(page);
    await page.goto("/?c=ab12cd34.AbCdEfGhIjKlMnOp");
    await expect(page.getByTestId("company-banner")).toBeVisible();
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.keyboard.press("g");
    await page.keyboard.press("a");
    await page.locator("#github").getByRole("button", { name: "3D city" }).click();
    await expect(page.getByTestId("city-canvas")).toBeVisible();
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /^Sound/ }).click();
    await page.getByTestId("ach-count").click();
    await expect(page.getByRole("dialog", { name: /Explorer/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("t");
    await expect(page.getByTestId("tour")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(3500); // the first heartbeat
    expect(problems).toEqual([]);
  });

  test("the security headers still hold on the pages that load the new code", async ({ request }) => {
    for (const path of ["/", "/privacy", "/work/talnio"]) {
      const res = await request.get(path);
      const csp = res.headers()["content-security-policy"] ?? "";
      expect(csp, path).toContain("default-src 'self'");
      expect(csp, path).toContain("object-src 'none'");
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).not.toMatch(/\*(?!\.)/); // no wildcard source
      const connect = /connect-src ([^;]*)/.exec(csp)?.[1] ?? "";
      expect(connect, path).toMatch(/^'self'/); // the new /api/here and /api/link calls are same-origin
      expect(connect, path).not.toMatch(/\bhttp:|\bws:|\*/);
      expect(csp, path).not.toContain("unsafe-eval");
    }
  });
});

test.describe("what loads before the first paint", () => {
  test.use({ viewport: { width: 412, height: 823 }, hasTouch: true, isMobile: true });

  test("a phone does not fetch the Work posters or the desktop stage image up front, and gets a poster when its card is near", async ({
    page,
  }) => {
    // Lighthouse counts every byte requested before the first paint. Two clip posters and the desktop stage's first
    // image were 72 KB of that, for cards a screen or more below the hero.
    const media: string[] = [];
    page.on("request", (r) => /\/media\//.test(r.url()) && media.push(new URL(r.url()).pathname));
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.waitForTimeout(1500);
    expect(media.filter((u) => /poster|gv-menu/.test(u))).toEqual([]);
    const gv = page.locator(".scene[data-project='golden-verdict'] video");
    await expect(gv).toHaveAttribute("data-poster", /gv-scroll-poster/);
    await page.locator(".work-scenes").scrollIntoViewIfNeeded();
    await expect(gv).toHaveAttribute("poster", /gv-scroll-poster/);
    await expect(gv).not.toHaveAttribute("data-poster", /./);
  });
});
