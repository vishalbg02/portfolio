import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoReady, loadIslands, settleAnimations } from "./helpers";

/**
 * V4 · Phase 0: the fix list. Every defect from the brief (§3) has a test here, so it cannot come back.
 */
type Embeddable = { gv: boolean | null; vt: boolean | null; gvState?: "live" | "offline" };
const status = (page: Page, e: Embeddable = { gv: false, vt: true }) =>
  page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        statuses: {
          "golden-verdict": {
            slug: "golden-verdict",
            state: e.gvState ?? "live",
            latencyMs: e.gvState === "offline" ? null : 210,
            embeddable: e.gv,
            checkedAt: new Date().toISOString(),
          },
          "virtual-tour": {
            slug: "virtual-tour",
            state: "live",
            latencyMs: 80,
            embeddable: e.vt,
            checkedAt: new Date().toISOString(),
          },
        },
      },
    }),
  );

const workTop = (page: Page) =>
  page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top + window.scrollY);

test.describe("A1 · Golden Verdict opens on its home page", () => {
  test("the first beat is the real home page capture, and no menu capture exists anywhere", async ({
    page,
  }) => {
    await status(page);
    await gotoReady(page, "/");
    await page.evaluate((y) => window.scrollTo(0, y + 200), await workTop(page));
    const img = page.locator('.scene[data-project="golden-verdict"] .beat[data-active] img');
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.currentSrc)).toContain("gv-home-desktop");
    await expect(img).toHaveAttribute("alt", /One platform for all your legal & tax compliance/);
    expect(await page.locator('img[src*="gv-menu"], source[srcset*="gv-menu"]').count()).toBe(0);
  });
});

test.describe("A7 · Work: one screen per project; beats advance by themselves", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the section is at most 4,200 px tall at 1440 × 900", async ({ page }) => {
    await status(page);
    await gotoReady(page, "/");
    const h = await page.locator("#work").evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeLessThanOrEqual(4200);
  });

  test("beats advance every 3.5 s, hold on hover and on Pause, and ←/→ still work", async ({ page }) => {
    await page.clock.install();
    await status(page);
    await gotoReady(page, "/");
    await page.evaluate((y) => window.scrollTo(0, y + 200), await workTop(page));
    const active = page.locator(
      '.scene[data-project="golden-verdict"] .beat-list li[data-active] .beat-label',
    );
    await expect(active).toHaveText("The home page");
    await page.mouse.move(5, 5);
    await page.clock.runFor(3700);
    await expect(active).toHaveText("Read a service");
    // the pointer on the media holds it
    await page.locator('.scene[data-project="golden-verdict"] .frame-wrap').hover();
    await page.clock.runFor(5000);
    await expect(active).toHaveText("Read a service");
    await page.mouse.move(5, 5);
    // Pause holds it too
    await page.getByRole("button", { name: "Pause the screens" }).click();
    await page.mouse.move(5, 5);
    await page.clock.runFor(5000);
    await expect(active).toHaveText("Read a service");
    await expect(page.getByRole("button", { name: "Play the screens" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // keys still step through
    await page.locator(".work-stage").focus();
    await page.keyboard.press("ArrowRight");
    await expect(active).toHaveText("How it works");
  });
});

test.describe("§4 · the live site: framed only when the site allows it", () => {
  test("Golden Verdict refuses framing today: real captures and Visit live site, never a frame", async ({
    page,
  }) => {
    await status(page, { gv: false, vt: true });
    await gotoReady(page, "/work/golden-verdict");
    const live = page.locator('[data-live="golden-verdict"]');
    await expect(live).toHaveAttribute("data-live-site", "captures");
    await expect(live.getByRole("link", { name: /Visit live site/ })).toHaveAttribute(
      "href",
      "https://goldenverdict.com",
    );
    await expect(live.getByRole("button", { name: /Launch live site/ })).toHaveCount(0);
    expect(await page.locator("iframe").count()).toBe(0);
  });

  test("when the site allows framing, Launch live site opens one sandboxed frame", async ({ page }) => {
    await status(page, { gv: true, vt: true });
    await page.route("https://goldenverdict.com/**", (r) =>
      r.fulfill({ contentType: "text/html", body: "<!doctype html><title>gv</title><p>gv</p>" }),
    );
    await gotoReady(page, "/work/golden-verdict");
    const live = page.locator('[data-live="golden-verdict"]');
    await expect(live).toHaveAttribute("data-live-site", "embeddable");
    await live.getByRole("button", { name: /Launch live site/ }).click();
    const frame = live.locator("iframe");
    await expect(frame).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups",
    );
    await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  test("a site that is down shows captures and says so", async ({ page }) => {
    await status(page, { gv: null, vt: true, gvState: "offline" });
    await gotoReady(page, "/work/golden-verdict");
    const live = page.locator('[data-live="golden-verdict"]');
    await expect(live).toHaveAttribute("data-live-site", "offline");
    await expect(live.getByText(/Offline right now/)).toBeVisible();
  });

  test("the CSP may frame exactly the allow-listed live sites", async ({ page }) => {
    const res = await page.goto("/");
    const csp = res!.headers()["content-security-policy"]!;
    expect(csp.split("; ").find((d) => d.startsWith("frame-src"))).toBe(
      "frame-src https://virtual-tour-opal.vercel.app https://goldenverdict.com https://www.goldenverdict.com",
    );
  });

  test("the Work scene offers Launch live site only for a site that allows it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await status(page, { gv: false, vt: true });
    await gotoReady(page, "/");
    await expect(page.locator('.scene[data-project="virtual-tour"]')).toHaveAttribute(
      "data-embeddable",
      "true",
    );
    await expect(page.locator('.scene[data-project="golden-verdict"]')).not.toHaveAttribute(
      "data-embeddable",
      /.*/,
    );
  });
});

test.describe("A2 · the Stack map connects his Java work", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("Java lights the Cove IoT internship; LanSymphony uses four skills; nothing is left unlabelled", async ({
    page,
  }) => {
    await status(page);
    await gotoReady(page, "/");
    await loadIslands(page);
    const stack = page.locator("#stack");
    await stack.getByRole("button", { name: /^Java\b/ }).click();
    await expect(stack.locator('[data-marker="role-coveiot"]')).toHaveAttribute("aria-pressed", "false");
    await expect(stack.locator("[aria-live]").first()).toContainText("Java used in");
    await expect(stack.locator("[aria-live]").first()).toContainText("Cove IoT");
    await expect(stack.locator('[data-marker="lansymphony"]')).toContainText("4 skills");
    await expect(stack.getByText("Coursework & practice").first()).toBeVisible();
    await settleAnimations(page);
    const axe = await new AxeBuilder({ page }).include("#stack").analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

test.describe("A3 · Interview mode stays hidden until he has written three answers", () => {
  test("no Interview chip, mode or suggestion anywhere", async ({ page }) => {
    await status(page);
    await gotoReady(page, "/");
    await loadIslands(page);
    await expect(page.getByRole("button", { name: /^Interview$/ })).toHaveCount(0);
    await expect(page.locator("#ask").getByText(/Interview mode/i)).toHaveCount(0);
  });
});

test.describe("A4 · the Omnibar never covers something you can click or type in", () => {
  for (const width of [1440, 1024]) {
    test(`six scroll positions at ${width} px, down and back up`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await status(page);
      await gotoReady(page, "/");
      await loadIslands(page);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const covered = () =>
        page.evaluate(() => {
          const bar = document.querySelector(".omnibar")!;
          const shown = [...bar.querySelectorAll("button")].filter(
            (b) => getComputedStyle(b).visibility !== "hidden",
          );
          const hits: string[] = [];
          for (const b of shown) {
            const r = b.getBoundingClientRect();
            const controls = document.querySelectorAll(
              "main a[href], main button, main input, main textarea, main select, main summary, footer a[href], footer button",
            );
            for (const el of controls) {
              const q = el.getBoundingClientRect();
              if (!q.width || !q.height || getComputedStyle(el).visibility === "hidden") continue;
              if (q.right > r.left && q.left < r.right && q.bottom > r.top && q.top < r.bottom)
                hits.push(
                  (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40),
                );
            }
          }
          return hits;
        });
      const ys = [1, 2, 3, 4, 5, 6].map((i) => Math.round(((height - 900) * i) / 7));
      for (const y of ys) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(350);
        expect(await covered(), `down to ${y}`).toEqual([]);
      }
      for (const y of [...ys].reverse()) {
        await page.evaluate((top) => window.scrollTo(0, top), y - 240);
        await page.waitForTimeout(350);
        expect(await covered(), `up to ${y - 240}`).toEqual([]);
      }
    });
  }

  test("a focused field, the footer and Esc all collapse it to the puck", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await status(page);
    await gotoReady(page, "/");
    const bar = page.locator(".omnibar");
    await expect(bar).toHaveAttribute("data-mode", "pill");
    await page.keyboard.press("Escape");
    await expect(bar).toHaveAttribute("data-mode", /puck|tab/);
    await page.mouse.wheel(0, -300);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar).toHaveAttribute("data-mode", /puck|tab/);
    // the puck still opens GRID's palette
    await page.locator(".omni-puck").click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("A5 · GRID pre-fills who is writing", () => {
  test("name, email, company and role land in the card, editable, and nothing is sent", async ({ page }) => {
    await status(page);
    let sent = 0;
    await page.route("**/api/grid/message", (r) => {
      sent++;
      return r.fulfill({ json: { ok: true } });
    });
    await gotoReady(page, "/");
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("app:open-grid", {
          detail: {
            question:
              "I'm Priya from Acme, priya@acme.dev - please tell Vishal we'd like to interview him for a backend role",
          },
        }),
      ),
    );
    const card = page.locator('[data-grid-card="confirm"]').last();
    await expect(card).toContainText("Priya <priya@acme.dev>");
    await expect(card).toContainText("backend role · Acme");
    await card.getByRole("button", { name: "Edit" }).click();
    await expect(card.getByLabel(/Company/)).toHaveValue("Acme");
    await expect(card.getByLabel(/Role you're hiring for/)).toHaveValue("backend");
    expect(sent).toBe(0);
  });
});

test.describe("A8 · LET'S BUILD stays clear of the sticky nav", () => {
  test("after a jump to #contact the banner is fully below the nav", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await status(page);
    await gotoReady(page, "/#contact");
    await page.waitForTimeout(400);
    const navBottom = await page
      .locator("header")
      .first()
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const bannerTop = await page.locator(".px-banner").evaluate((el) => el.getBoundingClientRect().top);
    expect(bannerTop).toBeGreaterThanOrEqual(navBottom);
  });
});

test.describe("A9 · the hero has two actions", () => {
  test("View work and Ask GRID as buttons; résumé, contact and the tour as one quiet row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await status(page);
    await gotoReady(page, "/");
    const hero = page.locator("section").first();
    await expect(hero.getByRole("link", { name: "View work" })).toBeVisible();
    await expect(hero.getByRole("link", { name: "Ask GRID" })).toBeVisible();
    await expect(hero.getByRole("link", { name: /résumé/ })).toHaveAttribute("href", /resume\.pdf$/);
    await expect(hero.getByRole("link", { name: "contact" })).toHaveAttribute("href", "/#contact");
    await expect(hero.getByRole("link", { name: /60-second tour/ })).toBeVisible();
    await expect(hero.getByRole("link", { name: "Résumé", exact: true })).toHaveCount(0);
  });

  test("the nav ticker shows from 1280 px only", async ({ page }) => {
    await status(page);
    await page.setViewportSize({ width: 1279, height: 900 });
    await gotoReady(page, "/");
    const ticker = page.locator("header a[href*='github.com']").first();
    await expect(ticker).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(ticker).toBeVisible();
  });
});
