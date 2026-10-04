import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, loadIslands, settleAnimations } from "./helpers";

/** V3 · Phase 0: no clipped text at any breakpoint (calendar labels, LET'S BUILD), quieter Experience, /privacy. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

const WIDTHS = [360, 390, 640, 768, 1024, 1280, 1440, 1920];

test.describe("activity calendar weekday labels", () => {
  // Below ~1000 px the calendar is wider than its card and scrolls (month snap), by design.
  for (const width of WIDTHS.filter((w) => w >= 1024)) {
    test(`@${width}px: Mon / Wed / Fri are fully inside the calendar and nothing scrolls sideways`, async ({
      page,
    }) => {
      await mockStatus(page);
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page, "/");
      await loadIslands(page);
      const gh = page.locator("#github");
      await gh.scrollIntoViewIfNeeded();
      const svg = gh.getByTestId("contribution-calendar");
      await expect(svg).toBeVisible();
      const m = await svg.evaluate((el) => {
        const scroller = el.parentElement!.parentElement!;
        const sr = scroller.getBoundingClientRect();
        return {
          overflow: scroller.scrollWidth - scroller.clientWidth,
          scrollLeft: scroller.scrollLeft,
          labels: [...el.querySelectorAll("text")]
            .filter((t) => /^(Mon|Wed|Fri)$/.test(t.textContent ?? ""))
            .map((t) => {
              const r = t.getBoundingClientRect();
              return { text: t.textContent, left: r.left - sr.left, right: sr.right - r.right };
            }),
        };
      });
      expect(m.labels.map((l) => l.text)).toEqual(["Mon", "Wed", "Fri"]);
      expect(m.overflow, "calendar overflows its box").toBeLessThanOrEqual(1);
      expect(m.scrollLeft).toBeLessThanOrEqual(1);
      for (const l of m.labels) expect(l.left, `${l.text} clipped on the left`).toBeGreaterThanOrEqual(-0.5);
    });
  }

  test("phone: the calendar scrolls sideways and still starts on the latest weeks", async ({ page }) => {
    await mockStatus(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const svg = gh.getByTestId("contribution-calendar");
    const m = await svg.evaluate((el) => {
      const s = el.parentElement!.parentElement!;
      return { overflow: s.scrollWidth - s.clientWidth, left: s.scrollLeft };
    });
    expect(m.overflow).toBeGreaterThan(100);
    expect(m.left).toBeGreaterThan(0);
  });
});

test.describe("LET'S BUILD banner", () => {
  for (const width of WIDTHS) {
    test(`@${width}px: one banner, squares at least 9px, never wider than its box`, async ({ page }) => {
      await mockStatus(page);
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page, "/");
      const contact = page.locator("#contact");
      await contact.scrollIntoViewIfNeeded();
      const m = await contact.locator(".px-banner svg").evaluateAll((svgs) =>
        svgs
          .filter((s) => (s as SVGSVGElement).getBoundingClientRect().width > 0)
          .map((s) => {
            const r = (s as SVGSVGElement).getBoundingClientRect();
            const vb = (s as SVGSVGElement).viewBox.baseVal;
            const box = s.parentElement!.getBoundingClientRect();
            return {
              cols: Math.round((vb.width + 3) / 13),
              pitch: r.width / ((vb.width + 3) / 13),
              fits: r.left >= box.left - 0.5 && r.right <= box.right + 0.5,
            };
          }),
      );
      expect(m, "exactly one visible banner").toHaveLength(1);
      expect(m[0]!.fits).toBe(true);
      expect(m[0]!.pitch, "square size").toBeGreaterThanOrEqual(9);
      // phones get BUILD (27 columns), everything wider gets LET'S BUILD (58 columns)
      expect(m[0]!.cols).toBe(width >= 640 ? 58 : 27);
    });
  }
});

test.describe("contact links", () => {
  for (const width of WIDTHS) {
    test(`@${width}px: every link label fits inside its button`, async ({ page }) => {
      await mockStatus(page);
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page, "/");
      const links = page.locator("#contact ul a");
      await links.first().scrollIntoViewIfNeeded();
      const m = await links.evaluateAll((as) =>
        as.map((a) => ({ text: a.textContent, overflow: a.scrollWidth - a.clientWidth })),
      );
      expect(m.length).toBeGreaterThanOrEqual(4);
      for (const l of m) expect(l.overflow, `${l.text} overflows its button`).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("experience", () => {
  test("quiet: graph shapes only between roles, no merge/branch text rows", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const exp = page.locator("#experience");
    const events = exp.locator(".git-ev");
    expect(await events.count()).toBeGreaterThan(0);
    for (const t of await events.allTextContents()) expect(t.trim()).toBe("");
  });
});

test.describe("/privacy", () => {
  test("states what the site does today, is linked from the footer, and is in the sitemap", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await page.locator("footer").getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    for (const h of [
      "Analytics",
      "Contact form",
      "GRID (AI assistant)",
      "Messages to Vishal",
      "Live chat",
      "Abuse protection",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
    // no feature that is not live yet may be described (messages from GRID go through Telegram since Phase 3, and the live chat is live since Phase 4)
    const text = (await page.locator("main").innerText()).toLowerCase();
    for (const word of ["company link", "turnstile"]) expect(text).not.toContain(word);
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/privacy</loc>");
  });

  test("has no serious axe violations", async ({ page }) => {
    await page.goto("/privacy");
    await settleAnimations(page);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
