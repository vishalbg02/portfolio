import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * V4 · Phase 1: the opening sequence (docs/INTRO.md). It plays once per session on the home page, never blocks
 * anything, never lasts past 1.8 s, and never shows without JavaScript or for reduced motion.
 */
test.use({ intro: true });

const intro = (page: Page) => page.locator("#intro");
const state = (page: Page) => page.evaluate(() => document.documentElement.dataset.intro ?? null);
/** The overlay is on screen: rendered (display) and not hidden by its end-of-life animation (visibility). */
const showing = (page: Page) =>
  intro(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  });
const status = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

test.describe("the opening sequence", () => {
  test("plays on a first visit and is gone within 2 s, with JavaScript", async ({ page }) => {
    await status(page);
    await page.goto("/", { waitUntil: "commit" });
    await expect.poll(() => state(page)).toBe("play");
    expect(await showing(page)).toBe(true);
    await expect.poll(() => showing(page), { timeout: 2000 }).toBe(false);
    await expect.poll(() => state(page)).toBe("ended");
  });

  test("never shows without JavaScript, and the page is there at once", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    expect(await showing(page)).toBe(false);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await ctx.close();
  });

  test("plays once per session: a second visit goes straight to the hero", async ({ page }) => {
    await status(page);
    await page.goto("/");
    await expect.poll(() => state(page)).toBe("play");
    await page.reload();
    await expect.poll(() => state(page)).toBe("skip");
    expect(await showing(page)).toBe(false);
  });

  for (const [what, url] of [
    ["a deep link", "/#contact"],
    ["?nointro", "/?nointro"],
    ["an inner page", "/work"],
  ] as const) {
    test(`does not play for ${what}`, async ({ page }) => {
      await status(page);
      await page.goto(url);
      expect(await state(page)).toBe("skip");
      if (url.startsWith("/?") || url.startsWith("/#")) expect(await showing(page)).toBe(false);
    });
  }

  test("does not play under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await status(page);
    await page.goto("/");
    expect(await state(page)).toBe("skip");
    expect(await showing(page)).toBe(false);
  });

  test("any key skips it at once", async ({ page }) => {
    await status(page);
    await page.goto("/", { waitUntil: "commit" });
    await expect.poll(() => state(page)).toBe("play");
    await page.keyboard.press("Shift");
    await expect.poll(() => state(page)).toBe("done");
    await expect.poll(() => showing(page), { timeout: 400 }).toBe(false);
  });

  test("the hero works during it: View work is clickable through the overlay", async ({ page }) => {
    await status(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(await state(page)).toBe("play");
    await page.getByRole("link", { name: "View work" }).click();
    await expect(page).toHaveURL(/#work$/);
  });

  test("the hero's text is the LCP, not the overlay, and nothing shifts", async ({ page }) => {
    await status(page);
    await page.goto("/");
    await page.waitForTimeout(2200);
    const m = await page.evaluate(
      () =>
        new Promise<{ lcpIn: string | null; cls: number }>((done) => {
          let el: Element | null = null;
          let cls = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries())
              el = (e as PerformanceEntry & { element?: Element }).element ?? el;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((l) => {
            for (const e of l.getEntries() as Array<
              PerformanceEntry & { value: number; hadRecentInput: boolean }
            >)
              if (!e.hadRecentInput) cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(
            () =>
              done({
                lcpIn: el
                  ? el.closest("#intro")
                    ? "intro"
                    : el.closest("section")
                      ? "hero"
                      : el.tagName
                  : null,
                cls,
              }),
            300,
          );
        }),
    );
    expect(m.lcpIn).toBe("hero");
    expect(m.cls).toBeLessThan(0.05);
  });

  test("no console errors and no hydration warnings while it plays", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(m.text());
    });
    page.on("pageerror", (e) => problems.push(e.message));
    await status(page);
    await page.goto("/");
    await page.waitForTimeout(2200);
    expect(problems).toEqual([]);
  });

  test("safety: if the overlay never arrived, the cover still lifts by itself (page visible within 2 s)", async ({
    page,
  }) => {
    await status(page);
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const res = await route.fetch();
      const html = (await res.text()).replace(/<div id="intro"[\s\S]*?<\/button><\/div>/, "");
      const headers = { ...res.headers() };
      delete headers["content-length"];
      delete headers["content-encoding"];
      await route.fulfill({ status: res.status(), headers, body: html });
    });
    await page.goto("/", { waitUntil: "commit" });
    // (taking the overlay out of the HTML also upsets hydration, so React may re-render the page: that is fine here;
    // what matters is that nothing can keep the page covered)
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            if (!document.body) return false;
            const cover = getComputedStyle(document.body, "::before");
            const covered = cover.content !== "none" && cover.visibility !== "hidden";
            const h1 = document.querySelector("h1");
            return !covered && Boolean(h1 && h1.getBoundingClientRect().height > 0);
          }),
        { timeout: 2000 },
      )
      .toBe(true);
  });

  test("GRID greets once, by its new home, and the chips work", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await status(page);
    await page.goto("/");
    const hello = page.locator("[data-intro-greeting]");
    await expect(hello).toBeVisible({ timeout: 4000 });
    await expect(hello).toContainText("Hi, I'm GRID, Vishal's AI.");
    await hello.getByRole("button", { name: "Ask GRID" }).click();
    await expect(page.getByRole("dialog", { name: /GRID/ })).toBeVisible();
    await expect(hello).toHaveCount(0);
    // never twice in a session
    await page.goto("/");
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-intro-greeting]")).toHaveCount(0);
  });

  test("a personal company link plays it quietly (no greeting: the banner greets them)", async ({ page }) => {
    await status(page);
    await page.goto("/?c=nope.123");
    await expect.poll(() => state(page)).toBe("play");
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-intro-quiet"))).toBe(true);
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-intro-greeting]")).toHaveCount(0);
  });

  test("Replay intro (palette) plays it again, marked as a replay", async ({ page }) => {
    await status(page);
    await page.goto("/?nointro");
    // the shortcuts load when the page is idle: press ⌘K once they are listening
    await page.waitForFunction(() => document.documentElement.dataset.shortcuts === "ready");
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox").fill("Replay intro");
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => u.pathname === "/" && !u.search);
    await expect.poll(() => state(page)).toBe("play");
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-intro-replay"))).toBe(true);
  });
});
