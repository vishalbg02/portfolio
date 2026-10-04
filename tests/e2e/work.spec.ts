import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, gotoReady, settleAnimations } from "./helpers";

const SLUGS = ["golden-verdict", "talnio", "lansymphony", "virtual-tour"] as const;
const NAMES: Record<(typeof SLUGS)[number], string> = {
  "golden-verdict": "Golden Verdict",
  talnio: "Talnio",
  lansymphony: "LanSymphony",
  "virtual-tour": "CHRIST University Virtual Tour",
};

const at = new Date().toISOString();
const statusBody = (over: Record<string, unknown> = {}) => ({
  checkedAt: at,
  statuses: {
    "golden-verdict": { slug: "golden-verdict", state: "live", latencyMs: 142, checkedAt: at },
    talnio: { slug: "talnio", state: null, latencyMs: null, checkedAt: at },
    lansymphony: { slug: "lansymphony", state: null, latencyMs: null, checkedAt: at },
    "virtual-tour": { slug: "virtual-tour", state: "degraded", latencyMs: 2100, checkedAt: at },
    ...over,
  },
});
const mockStatus = (page: Page, body = statusBody(), delayMs = 0) =>
  page.route("**/api/status", async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ json: body });
  });

/** Desktop stage: select a project on the index and wait for its panel (the grid wipe swaps it in). */
const showProject = async (page: Page, slug: string) => {
  await page.locator(`#tab-${slug}`).click();
  await expect(page.locator(`#panel-${slug}`)).toBeVisible();
};

const axe = async (page: Page) =>
  (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");

test.describe("work cards & status", () => {
  test("home shows the four projects on a stage with code-drawn visuals and the right actions", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const work = page.locator("#work");
    for (const slug of SLUGS) {
      await showProject(page, slug);
      const panel = page.locator(`#panel-${slug}`);
      await expect(panel.getByRole("img")).toBeVisible();
      await expect(panel.getByRole("link", { name: /Case study/ })).toHaveAttribute("href", `/work/${slug}`);
    }
    // Live ↗ only where a live URL exists; Code ↗ only where a repo exists; Google Play only for Talnio
    const has = async (slug: string, name: RegExp) => {
      await showProject(page, slug);
      return page.locator(`#panel-${slug}`).getByRole("link", { name }).count();
    };
    expect([await has("golden-verdict", /^Live/), await has("golden-verdict", /^Code/)]).toEqual([1, 0]);
    expect([await has("talnio", /^Live/), await has("talnio", /^Google Play/)]).toEqual([0, 1]);
    expect([await has("lansymphony", /^Live/), await has("lansymphony", /^Code/)]).toEqual([0, 0]);
    expect([await has("virtual-tour", /^Live/), await has("virtual-tour", /^Code/)]).toEqual([1, 1]);
    await expect(work.getByRole("link", { name: /^Code/ })).toHaveAttribute(
      "href",
      "https://github.com/vishalbg02/virtual_tour",
    );
  });

  test("a project shows at most 6 stack chips plus a +N overflow", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await showProject(page, "talnio");
    const talnio = page.locator("#panel-talnio");
    await expect(talnio.getByRole("list", { name: "Stack" }).getByRole("listitem")).toHaveCount(7); // 6 + "+2"
    await expect(talnio.getByText("+2")).toBeVisible();
  });

  test("status badges: skeleton first, then Live · ms / Degraded / static badges", async ({ page }) => {
    await mockStatus(page, statusBody(), 700);
    await gotoReady(page, "/"); // not networkidle: we want to see the skeleton before the status arrives
    const gv = page.locator("#panel-golden-verdict");
    await expect(gv.getByRole("status").getByText("Checking status")).toBeVisible();
    await expect(gv.getByText("Live · 142 ms")).toBeVisible();
    await showProject(page, "virtual-tour");
    await expect(page.locator("#panel-virtual-tour").getByText("Degraded")).toBeVisible();
    await showProject(page, "talnio");
    await expect(
      page.locator("#panel-talnio").getByText("Live on Google Play", { exact: true }),
    ).toBeVisible();
    await showProject(page, "lansymphony");
    await expect(page.locator("#panel-lansymphony").getByText("2nd place · OpenBuild")).toBeVisible();
  });

  test("offline and fetch-error states render", async ({ page }) => {
    await mockStatus(
      page,
      statusBody({
        "golden-verdict": { slug: "golden-verdict", state: "offline", latencyMs: null, checkedAt: at },
      }),
    );
    await page.goto("/");
    await expect(
      page.locator("#work article", { hasText: "Golden Verdict" }).getByText("Offline"),
    ).toBeVisible();

    const page2 = await page.context().newPage();
    await page2.route("**/api/status", (r) => r.fulfill({ status: 500, body: "boom" }));
    await page2.goto("/");
    await expect(
      page2.locator("#work article", { hasText: "Golden Verdict" }).getByText("Status unavailable"),
    ).toBeVisible();
  });

  test("status never blocks render: the page is usable while /api/status hangs", async ({ page }) => {
    await mockStatus(page, statusBody(), 5000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vishal B G");
    await expect(page.locator("#work article")).toHaveCount(4);
  });

  test("/api/status is shaped, cache-controlled and only probes known projects", async ({ request }) => {
    const res = await request.get("/api/status");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("s-maxage=300");
    const body = await res.json();
    expect(Object.keys(body.statuses).sort()).toEqual([...SLUGS].sort());
    expect(body.statuses.talnio.state).toBeNull();
    expect(body.statuses.lansymphony.state).toBeNull();
    for (const slug of ["golden-verdict", "virtual-tour"]) {
      expect(["live", "degraded", "offline"]).toContain(body.statuses[slug].state);
    }
    // the endpoint accepts no URL parameter (no SSRF surface)
    const probe = await request.get("/api/status?url=http://169.254.169.254/");
    expect(Object.keys((await probe.json()).statuses)).toHaveLength(4);
  });

  test("project visuals idle, run on hover, and are not frozen for touch (see v2-phase0.spec)", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const card = page.locator("#work article", { hasText: "Golden Verdict" });
    const state = () =>
      card.locator(".sk-gv-progress").evaluate((el) => getComputedStyle(el).animationPlayState);
    await card.scrollIntoViewIfNeeded();
    // plays for a few seconds when it scrolls into view, then idles
    await expect.poll(state, { timeout: 12000 }).toBe("paused");
    await card.hover();
    expect(await state()).toBe("running");
  });

  test("/work lists all projects with summaries and has no serious axe violations", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/work");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(4);
    await expect(
      page.getByText("Production SaaS serving Customers, Legal Partners, Managers and Administrators"),
    ).toBeVisible();
    await settleAnimations(page);
    expect(await axe(page)).toEqual([]);
  });

  test("hero ship console links to case studies and shows live status", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const hero = page.locator("section[aria-labelledby='hero-title']");
    const row = hero.locator("details", { hasText: "Golden Verdict" });
    await expect(row.locator("summary").getByText("Live · 142 ms")).toBeVisible();
    await row.locator("summary").click();
    await expect(row.getByRole("link", { name: /Case study/ })).toHaveAttribute(
      "href",
      "/work/golden-verdict",
    );
  });

  test("palette lists case studies and live sites", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("golden");
    await expect(page.getByRole("option", { name: /Golden Verdict — case study/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Golden Verdict — open live site/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Talnio/ })).toHaveCount(0);
  });
});

test.describe("case studies", () => {
  for (const slug of SLUGS) {
    test(`${slug} renders every section`, async ({ page }) => {
      await mockStatus(page);
      await page.goto(`/work/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(NAMES[slug]);
      for (const h of [
        "The problem",
        "What I built",
        "Try it",
        "Key decisions",
        "Architecture",
        "Code in the wild",
        "Outcome",
      ]) {
        await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
      }
      for (const label of ["Role", "Platform", "Stack", "Status"]) {
        // at ≥ 1100 px the facts live in the rail, below that in the strip: one of the two is visible
        await expect(page.getByText(label, { exact: true }).locator("visible=true").first()).toBeVisible();
      }
      const decisions = page.locator("article article");
      expect(await decisions.count()).toBeGreaterThanOrEqual(2);
      expect(await decisions.count()).toBeLessThanOrEqual(3);
      await expect(decisions.first().getByText("Why")).toBeVisible();
      await expect(decisions.first().getByText("Trade-off")).toBeVisible();
      await expect(page.getByText("illustrative snippet").first()).toBeVisible();
      await expect(page.locator(".code-block pre").first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "More projects" }).getByRole("link")).toHaveCount(2);
    });

    test(`${slug} has no serious axe violations`, async ({ page }) => {
      await mockStatus(page);
      await page.goto(`/work/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await settleAnimations(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("only projects with URLs get Live/Code buttons; no period is invented", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/work/golden-verdict");
    await expect(page.getByRole("link", { name: /Live site/ })).toHaveAttribute(
      "href",
      "https://goldenverdict.com",
    );
    await expect(page.getByRole("link", { name: /^Code\s*↗/ })).toHaveCount(0);
    await page.goto("/work/talnio");
    await expect(page.getByRole("link", { name: /Live site/ })).toHaveCount(0);
    await expect(page.getByText("Live on Google Play").first()).toBeVisible();
    await page.goto("/work/lansymphony");
    await expect(page.getByRole("link", { name: /^Code\s*↗/ })).toHaveCount(0);
  });

  test("previous/next navigation wraps around", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/work/golden-verdict");
    const nav = page.getByRole("navigation", { name: "More projects" });
    await expect(nav.getByRole("link").first()).toHaveAttribute("href", "/work/virtual-tour");
    await nav.getByRole("link").nth(1).click();
    await expect(page).toHaveURL(/\/work\/talnio$/);
  });

  test("unknown case study is a 404", async ({ page }) => {
    const res = await page.goto("/work/not-a-project");
    expect(res?.status()).toBe(404);
  });
});

test.describe("architecture diagram", () => {
  test("is keyboard accessible: focus shows a tooltip, Enter pins it, Escape clears it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockStatus(page);
    await gotoHydrated(page, "/work/golden-verdict");
    const node = page.getByRole("button", { name: /^Auth · RBAC/ });
    await node.focus();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Role-based access control");
    await page.keyboard.press("Enter");
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
  });

  test("hovering a node shows its job", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockStatus(page);
    await gotoHydrated(page, "/work/golden-verdict");
    await page.getByRole("button", { name: /^Brevo/ }).hover();
    await expect(page.getByRole("tooltip")).toContainText("generate invoices");
  });

  test("Run request walks the whole flow and announces each step", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockStatus(page);
    await gotoHydrated(page, "/work/golden-verdict");
    const caption = page.locator("figure[data-bleed] [aria-live='polite']");
    const run = page.locator("figure[data-bleed]").getByRole("button", { name: /Run request|Running/ });
    await run.scrollIntoViewIfNeeded();
    await run.click();
    await expect(run).toBeDisabled();
    await expect(caption).toContainText(/step \d of 6/);
    await expect(caption).toContainText("complete", { timeout: 12_000 });
    await expect(caption).toContainText("Admin dashboard");
    await expect(run).toBeEnabled();
  });

  test("Talnio has separate flows for the Agora and AI side paths", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockStatus(page);
    await gotoHydrated(page, "/work/talnio");
    const flows = page.getByRole("group", { name: "Choose a request flow" });
    await expect(flows.getByRole("button")).toHaveCount(3);
    await flows.getByRole("button", { name: "Meetings" }).click();
    await expect(flows.getByRole("button", { name: "Meetings" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Run request/ }).click();
    const caption = page.locator("figure[data-bleed] [aria-live='polite']");
    await expect(caption).toContainText("Agora SDK", { timeout: 6000 });
    await expect(caption).toContainText("complete", { timeout: 6000 });
  });

  test("reduced motion steps through nodes without a travelling packet", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await mockStatus(page);
    await gotoHydrated(page, "/work/lansymphony");
    await page.getByRole("button", { name: /Run request/ }).click();
    const caption = page.locator("figure[data-bleed] [aria-live='polite']");
    await expect(caption).toContainText(/step 2 of 4/, { timeout: 4000 });
    expect(await page.locator("figure svg circle[fill-opacity='0.25']").count()).toBe(0);
    await expect(caption).toContainText("complete", { timeout: 6000 });
    await ctx.close();
  });

  test("has a text-only description for screen readers", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/work/virtual-tour");
    const text = page.getByRole("heading", { name: /Text version of the .* diagram/, includeHidden: true });
    await expect(text).toHaveCount(1);
    const section = text.locator("xpath=..");
    await expect(section).toContainText("Three.js scene");
    await expect(section.locator("li")).toHaveCount(4);
  });

  test("shows the desktop layout at 1280 and the vertical layout at 360 (never both)", async ({ page }) => {
    await mockStatus(page);
    for (const [width, expectedHeightMin] of [
      [1280, 0],
      [360, 380],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page, "/work/golden-verdict");
      const svgs = page.locator("figure svg[role='group']");
      await expect(svgs).toHaveCount(2);
      const visible = await svgs.evaluateAll(
        (els) => els.filter((e) => (e as SVGElement).getBoundingClientRect().width > 0).length,
      );
      expect(visible).toBe(1);
      const box = await svgs.evaluateAll(
        (els) => els.map((e) => (e as SVGElement).getBoundingClientRect()).find((r) => r.width > 0)!.height,
      );
      expect(box).toBeGreaterThan(expectedHeightMin);
    }
  });

  test("no horizontal overflow on case studies at 360, 768, 1280 and 1920", async ({ page }) => {
    await mockStatus(page);
    for (const slug of SLUGS) {
      for (const width of [360, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoHydrated(page, `/work/${slug}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${slug} overflows at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });
});
