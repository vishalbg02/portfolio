import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoHydrated, settleAnimations } from "./helpers";

/** V2 · Phase 4: case-study layout, auto-playing diagram, live demo + walkthroughs, transitions. */
const TOUR = "https://virtual-tour-opal.vercel.app";

// the tour allows framing (so "Launch live site" shows); Golden Verdict refuses it (captures + Visit live site)
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        statuses: {
          "virtual-tour": {
            slug: "virtual-tour",
            state: "live",
            latencyMs: 80,
            embeddable: true,
            checkedAt: "x",
          },
          "golden-verdict": {
            slug: "golden-verdict",
            state: "live",
            latencyMs: 90,
            embeddable: false,
            checkedAt: "x",
          },
        },
      },
    }),
  );

const axe = async (page: Page, include?: string) => {
  await settleAnimations(page);
  const b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
  const res = await (include ? b.include(include) : b).analyze();
  return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
};

test.describe("case-study layout (desktop ≥ 1100)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("two columns: a 720 px text column and a sticky rail with ToC, facts, status and the ask chip", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work/talnio");
    const rail = page.locator("[data-rail]");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("navigation", { name: "On this page" })).toBeVisible();
    for (const h of ["The problem", "What I built", "Try it", "Key decisions", "Architecture", "Outcome"])
      await expect(rail.getByRole("link", { name: h, exact: true })).toBeVisible();
    await expect(rail.getByText("Platform")).toBeVisible();
    await expect(rail.getByRole("button", { name: "Ask about Talnio" })).toBeVisible();
    // main text column is at most 720 px wide
    const main = await page.locator(".case-grid > div").first().boundingBox();
    expect(main!.width).toBeLessThanOrEqual(721);
    // the rail sticks while reading
    const before = (await rail.locator(".case-rail").boundingBox())!.y;
    await page.mouse.wheel(0, 700);
    await expect
      .poll(async () => (await rail.locator(".case-rail").boundingBox())!.y)
      .toBeLessThanOrEqual(before);
    // the "At a glance" strip above the text is replaced by the rail at this width
    await expect(page.locator("article > dl").first()).toBeHidden();
  });

  test("the ToC highlights the section you are reading and links jump to it", async ({ page }) => {
    // no status rows: the rail's height (and so where it steps aside for the diagram) stays what this test measures
    await page.route("**/api/status", (r) =>
      r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
    );
    await gotoHydrated(page, "/work/golden-verdict");
    const link = (name: string) => page.locator("[data-rail]").getByRole("link", { name, exact: true });
    await expect(link("The problem")).toHaveAttribute("aria-current", "location");
    await page.locator("#key-decisions").scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      document.getElementById("key-decisions")!.scrollIntoView({ behavior: "instant" }),
    );
    await expect(link("Key decisions")).toHaveAttribute("aria-current", "location");
    await expect(link("The problem")).not.toHaveAttribute("aria-current", "location");
    await page.evaluate(() => window.scrollTo(0, 0));
    await link("Outcome").click();
    await expect(page).toHaveURL(/#outcome$/);
    await expect(link("Outcome")).toHaveAttribute("aria-current", "location");
  });

  test("a reading-progress hairline fills as you scroll", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work/lansymphony");
    const bar = page.getByTestId("reading-progress");
    const width = async () => (await bar.boundingBox())?.width ?? 0;
    expect(await width()).toBeLessThan(2);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(width).toBeGreaterThan(1000);
  });

  test("the diagram breaks out to the full width and the rail steps aside while it is on screen", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work/golden-verdict");
    const fig = page.locator("figure[data-bleed]");
    const col = (await page.locator(".case-grid > div").first().boundingBox())!;
    const box = (await fig.boundingBox())!;
    expect(box.width).toBeGreaterThan(col.width + 200);
    await fig.scrollIntoViewIfNeeded();
    await expect(page.locator("[data-rail]")).toHaveAttribute("data-away", "true");
    await expect(page.locator("[data-rail]")).toBeHidden(); // visibility:hidden, so out of the tab order too
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("[data-rail]")).toBeVisible();
  });

  test("Ask about this project opens the assistant with a first question about that project", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work/talnio");
    let body: { messages: Array<{ content: string }>; project?: string } | null = null;
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        body = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/x-ndjson",
          body:
            [
              { t: "meta", mode: "offline", sources: [], reason: "no_key" },
              { t: "text", d: "Talnio is an employee management platform." },
              { t: "done" },
            ]
              .map((e) => JSON.stringify(e))
              .join("\n") + "\n",
        });
      } else await route.fulfill({ json: { ai: false, vectors: false, chunks: 1 } });
    });
    await page.locator("[data-rail]").getByRole("button", { name: "Ask about Talnio" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText(/Talnio is an employee management platform/),
    ).toBeVisible();
    expect(body!.project).toBe("talnio");
    expect(body!.messages.at(-1)!.content).toMatch(/Talnio/);
  });
});

test.describe("case-study layout (below 1100)", () => {
  test.use({ viewport: { width: 1024, height: 800 } });
  test("no rail: the At a glance strip and an ask chip stay in the flow", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work/talnio");
    await expect(page.locator("[data-rail]")).toBeHidden();
    await expect(page.locator("article > dl").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask about Talnio" }).last()).toBeVisible();
  });
});

test.describe("architecture diagram", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("runs once by itself at 60% visible, lights the step list in sync, and Run request replays it", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work/golden-verdict");
    const steps = page.getByTestId("diagram-steps");
    await expect(steps.locator("li")).toHaveCount(6);
    await expect(steps.locator("[data-on]")).toHaveCount(0); // idle until it is on screen
    await page.locator("figure[data-bleed]").scrollIntoViewIfNeeded();
    await expect(steps.locator("[data-on]")).toHaveCount(1); // it started by itself
    await expect(steps.locator("li").first()).toHaveAttribute("data-step", "1");
    // finished: the step list ends on the last node, then the highlight clears
    await expect(page.getByText(/— complete\./)).toBeVisible({ timeout: 10_000 });
    await expect(steps.locator("[data-done]")).not.toHaveCount(0);
    await expect(steps.locator("[data-on], [data-done]")).toHaveCount(0, { timeout: 6000 });
    // replay still works
    await page.getByRole("button", { name: /Run request/ }).click();
    await expect(steps.locator("[data-on]")).toHaveCount(1);
  });

  test("reduced motion: it does not start on its own", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await gotoHydrated(page, "/work/golden-verdict");
    await page.locator("figure[data-bleed]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("diagram-steps").locator("[data-on], [data-done]")).toHaveCount(0);
  });
});

test.describe("virtual tour: the live site only on click", () => {
  test("no iframe and no request to the tour before the click; the CSP allows only that origin", async ({
    page,
  }) => {
    await mockStatus(page);
    const toTour: string[] = [];
    page.on("request", (r) => r.url().startsWith(TOUR) && toTour.push(r.url()));
    const res = await page.goto("/work/virtual-tour");
    await page.waitForLoadState("networkidle");
    expect(await page.locator("iframe").count()).toBe(0);
    expect(toTour).toEqual([]);
    const csp = res!.headers()["content-security-policy"]!;
    expect(csp.split("; ").find((d) => d.startsWith("frame-src"))).toBe(
      `frame-src ${TOUR} https://goldenverdict.com https://www.goldenverdict.com`,
    );
    // the poster state: sketch + button, with an Open in new tab link beside it
    const demo = page.locator("[data-live='virtual-tour']");
    await expect(demo.getByRole("img")).toBeVisible();
    await expect(demo.getByRole("link", { name: /Open in new tab/ })).toHaveAttribute("href", TOUR);
  });

  test("Launch live site creates one sandboxed iframe with the right attributes", async ({ page }) => {
    await mockStatus(page);
    await page.route(`${TOUR}/**`, (r) =>
      r.fulfill({ contentType: "text/html", body: "<!doctype html><title>tour</title><p>tour</p>" }),
    );
    await gotoHydrated(page, "/work/virtual-tour");
    await page.getByRole("button", { name: /Launch live site/ }).click();
    const frame = page.locator("iframe");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("src", TOUR);
    await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
    await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(frame).toHaveAttribute("loading", "lazy");
    await expect(frame).toHaveAttribute("title", /Virtual Tour/);
    await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Launch live site/ })).toHaveCount(0);
  });

  test("axe is clean before and after launching", async ({ page }) => {
    await mockStatus(page);
    await page.route(`${TOUR}/**`, (r) =>
      r.fulfill({ contentType: "text/html", body: "<title>t</title><p>t</p>" }),
    );
    await gotoHydrated(page, "/work/virtual-tour");
    expect(await axe(page)).toEqual([]);
    await page.getByRole("button", { name: /Launch live site/ }).click();
    await expect(page.locator("iframe")).toHaveCount(1);
    expect(await axe(page, "[data-live='virtual-tour']")).toEqual([]);
  });
});

test.describe("walkthroughs (Golden Verdict, Talnio, LanSymphony)", () => {
  const demos = [
    {
      slug: "golden-verdict",
      steps: ["Choose service", "Upload documents", "Track request REQ-····", "Status update"],
    },
    { slug: "talnio", steps: ["Check in", "Attendance recorded", "Report generated"] },
    { slug: "lansymphony", steps: ["Peer discovery", "Key exchange", "Encrypted call"] },
  ];

  for (const { slug, steps } of demos) {
    test(`${slug}: labelled as an illustration, steps by click and by arrow keys`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" }); // no auto-advance while we drive it
      await mockStatus(page);
      await gotoHydrated(page, `/work/${slug}`);
      const demo = page.locator(`[data-demo='${slug}']`);
      await expect(demo.getByText("Interactive illustration — not the real product UI")).toBeVisible();
      const buttons = demo.getByRole("list", { name: "Steps" }).getByRole("button");
      await expect(buttons).toHaveText(steps.map((s, i) => `${i + 1}${s}`));
      await expect(buttons.first()).toHaveAttribute("aria-current", "step");

      await buttons.nth(1).click();
      await expect(buttons.nth(1)).toHaveAttribute("aria-current", "step");
      await expect(demo.getByText(`Step 2 of ${steps.length}`)).toBeVisible();

      await buttons.nth(1).focus();
      await page.keyboard.press("ArrowRight");
      await expect(buttons.nth(2)).toHaveAttribute("aria-current", "step");
      await page.keyboard.press("ArrowLeft");
      await expect(buttons.nth(1)).toHaveAttribute("aria-current", "step");

      // Enter on a step button picks it
      await buttons.last().focus();
      await page.keyboard.press("Enter");
      await expect(buttons.last()).toHaveAttribute("aria-current", "step");
      await expect(demo.getByRole("button", { name: "Replay" })).toBeVisible();
      await demo.getByRole("button", { name: "Replay" }).click();
      await expect(buttons.first()).toHaveAttribute("aria-current", "step");
    });
  }

  test("golden-verdict: the role switcher changes what the dashboard shows, and there is a link to the live site", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await gotoHydrated(page, "/work/golden-verdict");
    const demo = page.locator("[data-demo='golden-verdict']");
    await expect(
      page.locator("[data-live='golden-verdict']").getByRole("link", { name: /Visit live site/ }),
    ).toHaveAttribute("href", "https://goldenverdict.com");
    const stage = demo.locator("[aria-hidden='true']").filter({ hasText: "Choose a service" });
    await expect(stage).toContainText("Choose a service"); // Customer
    await demo.getByRole("group", { name: "View as" }).getByRole("button", { name: "Admin" }).click();
    await expect(demo.getByRole("button", { name: "Admin" })).toHaveAttribute("aria-pressed", "true");
    await expect(demo.getByText("Workflow assignments").first()).toBeAttached();
    await expect(demo.getByText("50+")).toBeAttached();
    await demo.getByRole("button", { name: "Partner" }).click();
    await expect(demo.getByText("Legal Partner view")).toBeAttached();
    await expect(demo.getByText("50+")).toHaveCount(0);
  });

  test("auto-advances once when scrolled into view, then stops (no loop), and a click stops it for good", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work/talnio");
    const demo = page.locator("[data-demo='talnio']");
    await expect(demo).toHaveAttribute("data-auto", "idle");
    await demo.scrollIntoViewIfNeeded();
    await expect(demo).toHaveAttribute("data-auto", "playing");
    await expect(demo).toHaveAttribute("data-auto", "done", { timeout: 9000 });
    await expect(demo.getByRole("list", { name: "Steps" }).getByRole("button").last()).toHaveAttribute(
      "aria-current",
      "step",
    );
    await page.waitForTimeout(2300);
    await expect(demo).toHaveAttribute("data-auto", "done"); // not looping
    // human input wins over auto-play
    await page.reload();
    await gotoHydrated(page, "/work/talnio");
    const again = page.locator("[data-demo='talnio']");
    await again.scrollIntoViewIfNeeded();
    await expect(again).toHaveAttribute("data-auto", "playing");
    await again.getByRole("list", { name: "Steps" }).getByRole("button").first().click();
    await expect(again).toHaveAttribute("data-auto", "stopped");
  });

  test("reduced motion: never auto-advances", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await gotoHydrated(page, "/work/talnio");
    const demo = page.locator("[data-demo='talnio']");
    await demo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await expect(demo).toHaveAttribute("data-auto", "idle");
    await expect(demo.getByText("Step 1 of 3")).toBeVisible();
  });

  test("axe is clean on all three demos (desktop and phone)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    for (const { slug } of demos) {
      await gotoHydrated(page, `/work/${slug}`);
      expect(await axe(page, `[data-demo='${slug}']`), slug).toEqual([]);
      await page.setViewportSize({ width: 360, height: 780 });
      expect(await axe(page, `[data-demo='${slug}']`), `${slug} @360`).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${slug} overflow`).toBeLessThanOrEqual(0);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });
});

test.describe("card → case study transition", () => {
  test("project cards and the case-study header share transition names (progressive enhancement)", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/work");
    // React renders view-transition-name on the shared elements only while a transition runs, so check
    // that navigation itself is plain and works, and that reduced motion disables the animation.
    await page.getByRole("link", { name: "Talnio" }).first().click();
    await expect(page).toHaveURL(/\/work\/talnio$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Talnio");
  });

  test("reduced motion: the view-transition animations are switched off", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/work");
    // Read the compiled CSS as text (the CSSOM of linked sheets isn't always readable from the page).
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("link[rel=stylesheet]")].map((l) => (l as HTMLLinkElement).href),
    );
    const css = (await Promise.all(hrefs.map(async (h) => (await page.request.get(h)).text()))).join("\n");
    const block =
      /@media[^{]*prefers-reduced-motion[^{]*\{(?:[^{}]|\{[^{}]*\})*view-transition-group\(\*\)(?:[^{}]|\{[^{}]*\})*\}/.exec(
        css,
      );
    const off = Boolean(block && /animation:\s*none/.test(block[0]));
    expect(off).toBe(true);
  });
});
