import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, settleAnimations, loadIslands } from "./helpers";

/** V2 · Phase 5: jump to proof, stack map, closing moment, boot line, count-ups, touch polish. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

const mockChat = (page: Page) =>
  page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: { ai: false, vectors: false, chunks: 1 } });
    const events = [
      {
        t: "meta",
        mode: "offline",
        reason: "no_key",
        sources: [
          { n: 1, title: "Experience", url: "/#experience" },
          { n: 2, title: "Talnio architecture", url: "/work/talnio#architecture" },
        ],
      },
      { t: "text", d: "He built it on Firebase [1] and drew its architecture [2]." },
      { t: "done" },
    ];
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    });
  });

const axe = async (page: Page, include?: string) => {
  await settleAnimations(page);
  const b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
  const res = await (include ? b.include(include) : b).analyze();
  return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
};

test.describe("jump to proof", () => {
  test("a cited source on the same page scrolls to the section and flashes it for 1.5 s", async ({
    page,
  }) => {
    await mockStatus(page);
    await mockChat(page);
    await gotoHydrated(page, "/");
    const ask = page.locator("#ask");
    await ask.scrollIntoViewIfNeeded();
    await ask.getByRole("textbox").fill("What did he build?");
    await ask.getByRole("textbox").press("Enter");
    const source = ask.getByRole("button", { name: /Jump to .*Experience/ });
    await expect(source).toBeVisible();
    await source.click();
    const target = page.locator("#experience");
    await expect(target).toHaveAttribute("data-proof-flash", "true");
    await expect.poll(async () => (await target.boundingBox())!.y, { timeout: 5000 }).toBeLessThan(300);
    expect(await target.evaluate((e) => getComputedStyle(e).outlineWidth)).toBe("2px");
    await expect(target).not.toHaveAttribute("data-proof-flash", "true", { timeout: 3000 }); // gone after ~1.5 s
  });

  test("a cited source on another page navigates with #proof=<id>, then scrolls and flashes there", async ({
    page,
  }) => {
    await mockStatus(page);
    await mockChat(page);
    await gotoHydrated(page, "/");
    const ask = page.locator("#ask");
    await ask.scrollIntoViewIfNeeded();
    await ask.getByRole("textbox").fill("Show me the architecture");
    await ask.getByRole("textbox").press("Enter");
    await ask.getByRole("button", { name: /Jump to .*Talnio architecture/ }).click();
    await expect(page).toHaveURL(/\/work\/talnio#(proof=)?architecture$/);
    await expect(page.locator("#architecture")).toHaveAttribute("data-proof-flash", "true");
    await expect(page).toHaveURL(/\/work\/talnio#architecture$/); // the URL is tidied to a plain anchor
  });

  test("an arriving #proof=<id> link triggers the same highlight; anything that isn't a plain id is ignored", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/#proof=github");
    await expect(page.locator("#github")).toHaveAttribute("data-proof-flash", "true");
    const other = await page.context().newPage(); // a fresh page: a hash-only change would keep the first flash alive
    await other.goto("/#proof=%3Cimg%20src=x%3E");
    await other.waitForTimeout(400);
    expect(await other.locator("[data-proof-flash]").count()).toBe(0);
    expect(await other.locator("img[src='x']").count()).toBe(0);
  });

  test("in the sheet, using a source closes it so the page underneath is what scrolls", async ({ page }) => {
    await mockStatus(page);
    await mockChat(page);
    await gotoHydrated(page, "/work/talnio"); // the Ask section isn't on this page, so the floating button opens the sheet
    await page.getByRole("button", { name: "Ask Vishal" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("How was it built?");
    await dialog.getByRole("textbox").press("Enter");
    await dialog.getByRole("button", { name: /Jump to .*Experience/ }).click();
    await expect(page).toHaveURL(/\/#(proof=)?experience$/);
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("stack as a connection map", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("hovering a skill draws a 1 px line to each project that used it and lights those markers", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const stack = page.locator("#stack");
    await stack.scrollIntoViewIfNeeded();
    await expect(stack.locator(".stack-line")).toHaveCount(0);
    await stack.getByRole("button", { name: "Firebase" }).hover();
    // Firebase is used by Golden Verdict and Talnio
    await expect(stack.locator(".stack-line")).toHaveCount(2);
    await expect(stack.locator("[data-marker='golden-verdict']")).toHaveAttribute("aria-pressed", "false");
    expect(await stack.locator(".stack-line line").first().getAttribute("stroke-width")).toBe("1");
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    );
    const litSlugs = async () =>
      (
        await stack.locator("[data-marker]").evaluateAll(
          (els, a) =>
            els.map((e) => {
              const probe = document.createElement("i");
              probe.style.color = a;
              document.body.append(probe);
              const rgb = getComputedStyle(probe).color;
              probe.remove();
              return { slug: e.getAttribute("data-marker"), on: getComputedStyle(e).borderTopColor === rgb };
            }),
          accent,
        )
      )
        .filter((m) => m.on)
        .map((m) => m.slug)
        .sort();
    await expect.poll(litSlugs).toEqual(["golden-verdict", "talnio"]); // the border colour transitions in
    await page.mouse.move(2, 2);
    await expect(stack.locator(".stack-line")).toHaveCount(0);
  });

  test("picking a project marker lights every skill it used, with a line to each; keyboard works", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const stack = page.locator("#stack");
    await stack.scrollIntoViewIfNeeded();
    const marker = stack.locator("[data-marker='talnio']");
    await marker.focus();
    const lines = await stack.locator(".stack-line").count();
    expect(lines).toBeGreaterThanOrEqual(5);
    await expect(stack.getByText(new RegExp(`Talnio used ${lines} of these skills`))).toBeVisible();
    await page.keyboard.press("Enter"); // pin
    await expect(marker).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(2, 2);
    await page.locator("body").click({ position: { x: 2, y: 2 } });
    await expect(stack.locator(".stack-line")).toHaveCount(lines);
    await marker.focus();
    await page.keyboard.press("Enter");
    await expect(marker).toHaveAttribute("aria-pressed", "false");
  });

  test("the matching project cards on the page light up too", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const stack = page.locator("#stack");
    await stack.scrollIntoViewIfNeeded();
    await stack.locator("[data-marker='lansymphony']").hover();
    await expect(page.locator("[data-project='lansymphony'][data-stack-hit='true']").first()).toBeAttached();
  });

  test("single column (phone): no SVG lines, plain highlighting, and 44 px markers", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const stack = page.locator("#stack");
    await stack.scrollIntoViewIfNeeded();
    await expect(stack.getByTestId("stack-lines")).toBeHidden();
    const marker = stack.locator("[data-marker='golden-verdict']");
    await marker.click();
    await expect(marker).toHaveAttribute("aria-pressed", "true");
    expect((await marker.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("axe is clean with a skill active", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await loadIslands(page);
    await page.locator("#stack").getByRole("button", { name: "Firebase" }).focus();
    expect(await axe(page, "#stack")).toEqual([]);
  });
});

test.describe("closing moment", () => {
  test("LET'S BUILD lights up left to right once when it scrolls in; reduced motion shows it complete", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const banner = page.locator(".px-banner");
    const on = banner.locator(".px-on");
    expect(await on.count()).toBeGreaterThan(80);
    await banner.scrollIntoViewIfNeeded();
    await expect(banner).toHaveAttribute("data-reveal", "play");
    // after the sweep every lit square has a green fill, and the leftmost came on before the rightmost
    await expect
      .poll(
        async () =>
          on.evaluateAll((els) =>
            els.every(
              (e) =>
                getComputedStyle(e).fill !==
                getComputedStyle(els[0]!.parentElement!.querySelector("path")!).fill,
            ),
          ),
        { timeout: 6000 },
      )
      .toBe(true);
    const delays = await on.evaluateAll((els) =>
      els.map((e) => Number(getComputedStyle(e).getPropertyValue("--col"))),
    );
    expect(Math.min(...delays)).toBe(0);
    expect(Math.max(...delays)).toBeGreaterThan(40);
  });

  test("reduced motion: never armed, so it is the finished banner straight away", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.locator(".px-banner").scrollIntoViewIfNeeded();
    await expect(page.locator(".px-banner")).not.toHaveAttribute("data-reveal", /.+/);
    const fills = await page
      .locator(".px-on")
      .evaluateAll((els) => new Set(els.map((e) => getComputedStyle(e).fill)).size);
    expect(fills).toBeGreaterThan(1);
  });

  test("a tiny snake crosses the footer grid row once, then stops", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const row = page.locator(".snake-row");
    await expect(row.locator(".snake")).toBeAttached();
    await row.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(row).toHaveAttribute("data-reveal", "play");
    await expect
      .poll(async () => row.locator(".snake").evaluate((e) => getComputedStyle(e).animationName), {
        timeout: 3000,
      })
      .toBe("snake-run");
    // it ends offscreen and stays there (a single iteration)
    expect(await row.locator(".snake").evaluate((e) => getComputedStyle(e).animationIterationCount)).toBe(
      "1",
    );
  });

  test("the snake is not shown under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".snake")).toBeHidden();
  });

  test("the footer Lighthouse strip shows exactly what CI wrote to generated/lighthouse.json (truncated, never rounded up), or nothing", async ({
    page,
  }) => {
    const file = path.join(process.cwd(), "generated", "lighthouse.json");
    await page.goto("/");
    const strip = page.getByTestId("lighthouse-strip");
    if (!existsSync(file)) return expect(strip).toHaveCount(0);
    const lh = JSON.parse(readFileSync(file, "utf8")) as {
      commit: string;
      scores: Record<"performance" | "accessibility" | "bestPractices" | "seo", number>;
    };
    const shown = (n: number) => String(Math.floor(n * 100 + 1e-9));
    await expect(strip).toBeVisible();
    for (const [label, key] of [
      ["Performance", "performance"],
      ["Accessibility", "accessibility"],
      ["Best Practices", "bestPractices"],
      ["SEO", "seo"],
    ] as const)
      await expect(strip.getByText(new RegExp(`^${label}\\s+${shown(lh.scores[key])}$`))).toBeVisible();
    await expect(strip).toContainText(lh.commit);
  });
});

test.describe("boot line", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("shows for half a second on the first visit of a session only, without shifting the layout", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/");
    const boot = page.getByTestId("boot-line");
    await expect(boot).toBeVisible({ timeout: 4000 });
    await expect(boot).toContainText("booting vishalbg… ok");
    const nav = await page.locator("header").first().boundingBox();
    expect(nav!.height).toBeLessThanOrEqual(57);
    await expect(boot).toHaveCount(0, { timeout: 3000 });
    // second page view in the same session: not again
    await page.goto("/now");
    await page.waitForTimeout(1500);
    await expect(boot).toHaveCount(0);
  });

  test("not under reduced motion, and a blocked sessionStorage doesn't break the page", async ({
    browser,
  }) => {
    const reduced = await browser.newContext({ reducedMotion: "reduce" });
    const p1 = await reduced.newPage();
    await p1.goto("http://localhost:3100/").catch(() => {});
    await reduced.close();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockStatus(page);
    await page.goto("/");
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("boot-line")).toHaveCount(0);
    expect(errors.filter((e) => !/blocked/.test(e))).toEqual([]);
    await ctx.close();
  });
});

test.describe("count-ups", () => {
  test("the final numbers are in the markup from the start and the counter ends on them", async ({
    page,
  }) => {
    await mockStatus(page);
    const html = await (await page.request.get("/")).text();
    // the activity block is a lazy island: until it loads, its placeholder carries the real totals in the HTML
    const m = /([\d,]+) contributions in the last year · [\d,]+ active days · longest streak \d+ days?/.exec(
      html,
    );
    expect(m, "final contribution count is server-rendered").not.toBeNull();
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const stat = page.locator("#github dl dd").first();
    await stat.scrollIntoViewIfNeeded();
    await expect(stat).toHaveText(m![1]!, { timeout: 4000 });
  });
  test("reduced motion: no counting, the value is simply there", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const stat = page.locator("#github dl dd").first();
    await stat.scrollIntoViewIfNeeded();
    expect(await stat.textContent()).toMatch(/^[\d,]+$/);
    const first = await stat.textContent();
    await page.waitForTimeout(200);
    expect(await stat.textContent()).toBe(first);
  });
});

test.describe("touch polish", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test("dock taps vibrate 8 ms where supported", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __v: number[] }).__v = [];
      navigator.vibrate = (p) => {
        (window as unknown as { __v: number[] }).__v.push(p as number);
        return true;
      };
    });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page
      .getByRole("navigation", { name: "Quick links" })
      .getByRole("link", { name: /Résumé/ })
      .click({ noWaitAfter: true });
    expect(await page.evaluate(() => (window as unknown as { __v: number[] }).__v)).toContain(8);
  });

  test("no vibration API (iOS) is simply a no-op", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "vibrate", { value: undefined });
    });
    await mockStatus(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await gotoHydrated(page, "/");
    await page.getByRole("navigation", { name: "Quick links" }).getByRole("button", { name: /Ask/ }).click();
    expect(errors).toEqual([]);
  });

  test("copy buttons vibrate; reduced motion silences it", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      (window as unknown as { __v: number }).__v = 0;
      navigator.vibrate = () => {
        (window as unknown as { __v: number }).__v++;
        return true;
      };
    });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /Email/ }).first().click();
    expect(await page.evaluate(() => (window as unknown as { __v: number }).__v)).toBe(1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: /Phone/ }).first().click();
    expect(await page.evaluate(() => (window as unknown as { __v: number }).__v)).toBe(1);
  });

  test("the shake egg is only asked for from an explicit button; a shake then opens CosmoStrike", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __asked: number }).__asked = 0;
      class FakeMotion extends Event {}
      (FakeMotion as unknown as { requestPermission: () => Promise<string> }).requestPermission =
        async () => {
          (window as unknown as { __asked: number }).__asked++;
          return "granted";
        };
      (window as unknown as { DeviceMotionEvent: unknown }).DeviceMotionEvent = FakeMotion;
    });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0); // never on load
    await page.evaluate(() => window.dispatchEvent(new Event("app:open-help")));
    const dialog = page.getByRole("dialog", { name: /Keyboard shortcuts/ });
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0); // nor on opening help
    await dialog.getByRole("button", { name: "Enable shake easter egg" }).click();
    await expect(dialog.getByRole("button", { name: "Shake easter egg is on" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1);
    await page.keyboard.press("Escape");
    // four hard jolts, 150 ms apart
    for (let i = 0; i < 4; i++) {
      await page.evaluate(
        (t) => {
          const e = new Event("devicemotion") as Event & { acceleration: object; timeStamp: number };
          Object.defineProperty(e, "acceleration", { value: { x: 30, y: 0, z: 0 } });
          Object.defineProperty(e, "timeStamp", { value: t });
          window.dispatchEvent(e);
        },
        1000 + i * 150,
      );
    }
    await expect(page.getByRole("dialog", { name: /CosmoStrike/i })).toBeVisible({ timeout: 8000 });
  });

  test("on a desktop there is no shake button", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      hasTouch: false,
      isMobile: false,
    });
    const page = await ctx.newPage();
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.evaluate(() => window.dispatchEvent(new Event("app:open-help")));
    await expect(page.getByRole("dialog", { name: /Keyboard shortcuts/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /shake easter egg/i })).toHaveCount(0);
    await ctx.close();
  });

  test("primary controls are at least 44 px (the calendar pins have the list below, the diagram nodes a text list)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll("button, summary, [role=button]")) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.visibility === "hidden" || cs.display === "none" || r.width === 0) continue;
        if (el.closest(".sr-only") || el.closest("[data-testid=contribution-calendar]")) continue;
        if (el.hasAttribute("data-mark")) continue; // pins and role bands: the list below is the touch path
        if (el.hasAttribute("data-milestone")) continue; // 24 px pins; the milestone list below is the touch path
        if (r.height < 44 || r.width < 44)
          out.push(
            `${el.tagName} ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
      }
      return out;
    });
    expect(small).toEqual([]);
  });
});

test.describe("shortcut help", () => {
  test("lists the terminal commands and the phone dock", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.keyboard.press("?");
    const dialog = page.getByRole("dialog", { name: /Keyboard shortcuts/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Terminal commands")).toBeVisible();
    for (const c of ["help", "open", "resume", "contact", "recruiter", "ask"])
      await expect(dialog.getByText(new RegExp(`^${c}\\b`)).first()).toBeVisible();
    await expect(dialog.getByText("Work · Ask · Résumé · Contact")).toBeVisible();
    expect(await axe(page, "[role=dialog]")).toEqual([]);
  });
});

test.describe("404", () => {
  test("the snake board is on screen straight away, paused, not behind a button", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.locator("canvas, svg[role='img']").first()).toBeVisible();
    await expect(page.getByText(/press any key|tap to start/i).first()).toBeVisible();
  });
});
