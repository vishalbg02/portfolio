import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoReady, settleAnimations } from "./helpers";

/**
 * V3 · Phase 1: the Work showcase. Desktop: a pinned stage that native scroll scrubs (scene by scene, beat by
 * beat, pixel dissolve between scenes). Phone: a snap deck of story cards. Reduced motion or no JS: plain rows.
 * The media are real captures (public/media), the frames are drawn in code.
 */
const SLUGS = ["golden-verdict", "talnio", "lansymphony", "virtual-tour"] as const;
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        // the tour allows framing (its "Launch live site" shows); nothing else is probed here
        statuses: {
          "virtual-tour": {
            slug: "virtual-tour",
            state: "live",
            latencyMs: 80,
            embeddable: true,
            checkedAt: new Date().toISOString(),
          },
        },
      },
    }),
  );

/**
 * Scrolls the page to the middle of a scene of the pinned stage (V4: scroll picks the project, one screen each), then
 * picks a beat with its caption button (beats advance by themselves, or by click, ←/→).
 */
async function toBeat(page: Page, scene: number, beat: number) {
  const y = await page.evaluate((s) => {
    const pin = document.querySelector(".work-pin")!;
    const stick = document.querySelector(".work-stick")!;
    const top = pin.getBoundingClientRect().top + window.scrollY - 56;
    const range = pin.clientHeight - stick.clientHeight;
    return top + ((s + 0.5) / 4) * range;
  }, scene);
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await expect(page.locator(".scene[data-active]")).toHaveAttribute("data-project", SLUGS[scene]!, {
    timeout: 8000,
  });
  if (beat > 0) {
    await page.locator(`.scene[data-active] [data-beat-go="${beat}"]`).click();
    await expect(page.locator(`.scene[data-active] .beat-list li[data-beat="${beat}"]`)).toHaveAttribute(
      "data-active",
      "",
    );
  }
}
const activeScene = (page: Page) => page.locator(".scene[data-active]");
const dissolveGone = (page: Page) =>
  expect(page.locator(".work-stage > div[aria-hidden='true']")).toHaveCount(0);

test.describe("pinned stage (desktop 1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("starts on Golden Verdict with its real capture in a browser frame, and every scene has its copy", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await toBeat(page, 0, 0);
    const scene = activeScene(page);
    await expect(scene).toHaveAttribute("data-project", "golden-verdict");
    await expect(scene.getByRole("heading", { level: 3, name: "Golden Verdict" })).toBeVisible();
    await expect(scene.getByText("Role-based access for four user roles")).toBeVisible();
    await expect(scene.getByRole("link", { name: /Case study/ })).toHaveAttribute(
      "href",
      "/work/golden-verdict",
    );
    // the real capture (not a sketch): an <img> from /media, loaded
    const img = scene.locator(".beat[data-active] img");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.currentSrc)).toContain(
      "/media/golden-verdict/gv-home-desktop",
    );
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    await expect(img).toHaveAttribute("alt", /One platform for all your legal & tax compliance/);
    // all four scenes are in the DOM, in order, each labelled by its heading
    expect(await page.locator(".scene h3").allTextContents()).toEqual([
      "Golden Verdict",
      "Talnio",
      "LanSymphony",
      "CHRIST University Virtual Tour",
    ]);
  });

  test("scroll picks the project (one screen each, a dissolve between), the beats are chosen inside it", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await toBeat(page, 0, 0);
    await expect(activeScene(page).locator(".beat-list li[data-active]")).toHaveText(/The home page/);
    await toBeat(page, 0, 2);
    await expect(activeScene(page).locator(".beat-list li[data-active]")).toContainText("How it works");
    await expect(activeScene(page).locator(".beat-list li[data-active] button")).toHaveAttribute(
      "aria-current",
      "step",
    );
    // an illustration beat is labelled as one
    await expect(
      activeScene(page).getByText(/an illustration: the real dashboards are private/),
    ).toBeVisible();
    await toBeat(page, 1, 0);
    await expect(activeScene(page)).toHaveAttribute("data-project", "talnio", { timeout: 6000 });
    await dissolveGone(page);
    await expect(activeScene(page).locator(".beat[data-active] img")).toHaveAttribute(
      "alt",
      /attendance screen/,
    );
    // the squares overlay was a real element while it ran, and is removed afterwards
    await toBeat(page, 2, 1);
    await expect(activeScene(page)).toHaveAttribute("data-project", "lansymphony", { timeout: 6000 });
    await dissolveGone(page);
    await expect(activeScene(page).locator(".beat[data-active] svg[role='img']")).toBeVisible();
    await toBeat(page, 3, 0);
    await expect(activeScene(page)).toHaveAttribute("data-project", "virtual-tour", { timeout: 6000 });
  });

  test("the index: four squares, current one marked, clicking one goes there", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await toBeat(page, 0, 0);
    const index = page.getByRole("navigation", { name: "Projects" });
    await expect(index.getByRole("button", { name: /^0\d / })).toHaveCount(4);
    await expect(index.getByRole("button", { name: "Pause the screens" })).toBeVisible();
    await expect(index.getByRole("button", { name: "01 Golden Verdict" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await index.getByRole("button", { name: "03 LanSymphony" }).click();
    await expect(activeScene(page)).toHaveAttribute("data-project", "lansymphony", { timeout: 8000 });
    await expect(index.getByRole("button", { name: "03 LanSymphony" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("keys with the stage focused: ↓/↑ scenes, ←/→ beats, 1–4 a scene", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await toBeat(page, 0, 0);
    await page.getByRole("group", { name: /Selected work/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(activeScene(page).locator(".beat-list li[data-active]")).toContainText("Read a service");
    await page.keyboard.press("ArrowDown");
    await expect(activeScene(page)).toHaveAttribute("data-project", "talnio", { timeout: 8000 });
    await page.keyboard.press("4");
    await expect(activeScene(page)).toHaveAttribute("data-project", "virtual-tour", { timeout: 8000 });
    await page.keyboard.press("ArrowUp");
    await expect(activeScene(page)).toHaveAttribute("data-project", "lansymphony", { timeout: 8000 });
  });

  test("beat captions are buttons: choosing one moves the stage to it", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await toBeat(page, 0, 0);
    await activeScene(page)
      .getByRole("button", { name: /Track REQ/ })
      .click();
    await expect(activeScene(page).locator(".beat-list li[data-active]")).toContainText("Track REQ", {
      timeout: 6000,
    });
    await expect(activeScene(page).locator(".beat[data-active] svg[role='img']")).toHaveAccessibleName(
      /request ID/,
    );
  });

  test("full screen: opens at the beat's capture, arrows and Esc work, focus returns, alt text is shown", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await toBeat(page, 0, 1);
    const open = activeScene(page).getByRole("button", { name: /Open Golden Verdict screens full screen/ });
    await open.click();
    const dialog = page.getByRole("dialog", { name: /Golden Verdict/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("2 / 5")).toBeVisible(); // second capture of five
    // opened at the second beat's capture ("Read a service" = the GST page)
    await expect(dialog.getByRole("img")).toHaveAttribute("alt", /GST Registration page/);
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("img")).not.toHaveAttribute("alt", /GST Registration page/);
    await dialog.getByRole("button", { name: "Next screen" }).click();
    await dialog.getByRole("button", { name: "Previous screen" }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  test("Virtual Tour: nothing from its origin until Launch live site, then one sandboxed iframe in place", async ({
    page,
  }) => {
    await mockStatus(page);
    const requested: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("virtual-tour-opal.vercel.app")) requested.push(r.url());
    });
    await page.route("https://virtual-tour-opal.vercel.app/**", (r) =>
      r.fulfill({ contentType: "text/html", body: "<title>tour</title><h1>tour</h1>" }),
    );
    await gotoReady(page, "/");
    await toBeat(page, 3, 0);
    await expect(activeScene(page)).toHaveAttribute("data-project", "virtual-tour", { timeout: 8000 });
    expect(requested).toEqual([]);
    await activeScene(page)
      .getByRole("button", { name: /Launch live site/ })
      .click();
    const frame = activeScene(page).locator("iframe");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
    await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(frame).toHaveAttribute("src", "https://virtual-tour-opal.vercel.app");
    await expect.poll(() => requested.length).toBeGreaterThan(0);
  });

  for (const [w, h] of [
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ] as const) {
    test(`@${w}×${h}: the stage fits the viewport: copy and frame are inside it, nothing scrolls sideways`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await mockStatus(page);
      await gotoReady(page, "/");
      for (const [i, slug] of SLUGS.entries()) {
        await toBeat(page, i, 0);
        await expect(activeScene(page)).toHaveAttribute("data-project", slug, { timeout: 8000 });
        await dissolveGone(page);
        const m = await page.evaluate(() => {
          const stick = document.querySelector(".work-stick")!.getBoundingClientRect();
          const scene = document.querySelector(".scene[data-active]")!;
          const bad = [
            ...scene.querySelectorAll<HTMLElement>(".scene-copy > *, .frame-wrap, .beat-list, .beat-note"),
          ]
            .map((el) => ({ cls: el.className.toString().slice(0, 30), r: el.getBoundingClientRect() }))
            .filter(
              ({ r }) =>
                r.width > 0 &&
                (r.bottom > stick.bottom + 1 || r.top < stick.top - 1 || r.right > window.innerWidth),
            );
          return {
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            bad: bad.map((b) => b.cls),
          };
        });
        expect(m.overflowX, slug).toBeLessThanOrEqual(0);
        expect(m.bad, `${slug}: clipped by the stage`).toEqual([]);
      }
    });
  }

  test("every scene has no serious axe violations", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    for (const [i, slug] of SLUGS.entries()) {
      await toBeat(page, i, 0);
      await expect(activeScene(page)).toHaveAttribute("data-project", slug, { timeout: 8000 });
      await dissolveGone(page);
      await settleAnimations(page);
      await expect(page.locator("[data-decoding]")).toHaveCount(0);
      const v = (
        await new AxeBuilder({ page })
          .include("#work")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.filter((x) => x.impact === "serious" || x.impact === "critical");
      expect(v, slug).toEqual([]);
    }
  });
});

test.describe("reduced motion on a desktop: plain rows, nothing pinned", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("every scene is visible at once, in order, with no sticky stage and no dissolve", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await expect(page.locator(".scene")).toHaveCount(4);
    for (const slug of SLUGS)
      await expect(
        page.locator(`.scene[data-project='${slug}']`).getByRole("heading", { level: 3 }),
      ).toBeVisible();
    expect(await page.locator(".work-stick").evaluate((el) => getComputedStyle(el).position)).not.toBe(
      "sticky",
    );
    // each row shows its captures and a way to switch between them
    const talnio = page.locator(".scene[data-project='talnio']");
    await talnio.scrollIntoViewIfNeeded();
    await talnio.getByRole("button", { name: /Tasks/ }).click();
    await expect(talnio.locator(".beat[data-active] img")).toHaveAttribute("alt", /My Tasks screen/);
    expect(await page.locator(".work-stage > div[aria-hidden='true']").count()).toBe(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });

  test("axe is clean", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await settleAnimations(page);
    const v = (
      await new AxeBuilder({ page })
        .include("#work")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    expect(v).toEqual([]);
  });
});

test.describe("story deck (phone 390)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("cards snap sideways with the next one peeking; a clip on top; two proof points; actions", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const deck = page.locator(".work-scenes");
    await deck.scrollIntoViewIfNeeded();
    expect(await deck.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain("x mandatory");
    expect(await deck.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const cards = page.locator(".scene");
    const w0 = (await cards.nth(0).boundingBox())!;
    expect(w0.width / 390).toBeGreaterThan(0.84);
    expect(w0.width / 390).toBeLessThan(0.95);
    expect((await cards.nth(1).boundingBox())!.x).toBeLessThan(390); // the next card peeks
    const first = cards.first();
    await expect(first.getByRole("heading", { level: 3 })).toHaveText("Golden Verdict");
    await expect(first.locator(".scene-hero video")).toBeVisible();
    await expect(first.locator(".scene-proof li:visible")).toHaveCount(2);
    await expect(first.getByRole("link", { name: /Case study/ })).toBeVisible();
    // the beats are the desktop's: hidden here
    await expect(first.locator(".scene-beats")).toBeHidden();
    await expect(first.getByRole("button", { name: /Launch live demo/ })).toBeHidden();
  });

  test("the centred card's clip plays, the others pause; a Pause button stops it", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.locator(".work-scenes").scrollIntoViewIfNeeded();
    const gv = page.locator(".scene[data-project='golden-verdict'] video");
    await expect.poll(() => gv.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 8000 }).toBe(true);
    const toggle = page
      .locator(".scene[data-project='golden-verdict']")
      .getByRole("button", { name: "Pause video" });
    await toggle.click();
    await expect.poll(() => gv.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await expect(
      page.locator(".scene[data-project='golden-verdict']").getByRole("button", { name: "Play video" }),
    ).toBeVisible();
  });

  test("dots follow the deck and move it", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const dots = page.getByRole("navigation", { name: "Projects" }).getByRole("button");
    await dots.nth(2).scrollIntoViewIfNeeded();
    await expect(dots).toHaveCount(4);
    await expect(dots.first()).toHaveAttribute("aria-current", "true");
    await dots.nth(2).click();
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true", { timeout: 5000 });
    await expect
      .poll(async () => {
        const box = (await page.locator(".scene[data-project='lansymphony']").boundingBox())!;
        return Math.abs(box.x + box.width / 2 - 195);
      })
      .toBeLessThan(40);
  });

  test("tapping the media opens the full-screen viewer with the project's screens", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const talnio = page.locator(".scene[data-project='talnio']");
    await talnio.scrollIntoViewIfNeeded();
    await talnio.locator(".scene-hero").click({ position: { x: 20, y: 20 } });
    const dialog = page.getByRole("dialog", { name: /Talnio/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("/ 7")).toBeVisible(); // all seven Play Store screens
    await dialog.getByRole("button", { name: "Close full screen" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("LanSymphony has no capture to open: its card shows the diagram, and no full-screen button", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const ls = page.locator(".scene[data-project='lansymphony']");
    await expect(ls.locator(".scene-hero svg[role='img']")).toBeAttached();
    await expect(ls.locator("[data-viewer-open]")).toHaveCount(0);
  });

  test("nothing is clipped at 360, 390 and 430: no card content wider than its card, no page-level scroll", async ({
    page,
  }) => {
    await mockStatus(page);
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await gotoReady(page, "/");
      const m = await page.evaluate(() => {
        const bad: string[] = [];
        for (const card of document.querySelectorAll<HTMLElement>(".scene")) {
          const box = card.getBoundingClientRect();
          for (const el of card.querySelectorAll<HTMLElement>(".scene-copy *, .scene-hero *")) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1))
              bad.push(`${card.dataset.project}: ${el.tagName}.${el.className.toString().slice(0, 20)}`);
          }
        }
        return { bad, overflowX: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(m.bad, `@${width}`).toEqual([]);
      expect(m.overflowX, `@${width}`).toBeLessThanOrEqual(0);
    }
  });

  test("the deck does not trap vertical scrolling", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    const deck = page.locator(".work-scenes");
    await deck.scrollIntoViewIfNeeded();
    expect(await deck.evaluate((el) => getComputedStyle(el).overflowY)).not.toBe("scroll");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 200);
  });

  test("axe is clean on the deck", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.locator(".work-scenes").scrollIntoViewIfNeeded();
    await settleAnimations(page);
    const v = (
      await new AxeBuilder({ page })
        .include("#work")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    expect(v).toEqual([]);
  });
});

test.describe("phone, reduced motion", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce" });

  test("clips never start by themselves; the Play button starts one", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.locator(".work-scenes").scrollIntoViewIfNeeded();
    const v = page.locator(".scene[data-project='golden-verdict'] video");
    await page.waitForTimeout(800);
    expect(await v.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
    await expect(v).toHaveAttribute("poster", /gv-scroll-poster/);
    await page
      .locator(".scene[data-project='golden-verdict']")
      .getByRole("button", { name: "Play video" })
      .click();
    await expect.poll(() => v.evaluate((el: HTMLVideoElement) => !el.paused)).toBe(true);
  });
});

test.describe("media on the other pages", () => {
  test("/work cards and case-study headers show the real capture, with matching transition names", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/work");
    for (const slug of SLUGS) {
      const card = page.locator(`article[data-project='${slug}']`);
      await expect(card.locator("picture img, svg[role='img']").first()).toBeVisible();
    }
    await page.goto("/work/talnio");
    await expect(page.locator("header picture img").first()).toHaveAttribute(
      "src",
      /\/media\/talnio\/tn-dashboard/,
    );
  });

  test("a case study has a gallery that opens the viewer, and a clip with controls", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/work/golden-verdict");
    const gallery = page.getByRole("region", { name: "Captured from the live product" });
    await expect(gallery.getByRole("button", { name: /View larger/ })).toHaveCount(5);
    await expect(gallery.locator("video[controls]")).toHaveCount(1);
    await expect(gallery.locator("video")).toHaveAttribute("preload", "none");
    await gallery
      .getByRole("button", { name: /View larger/ })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: /Golden Verdict/ })).toBeVisible();
    await page.keyboard.press("Escape");
    // LanSymphony has no public UI, so no gallery
    await page.goto("/work/lansymphony");
    await expect(page.getByRole("region", { name: "Captured from the live product" })).toHaveCount(0);
  });

  test("every media file the pages reference loads (no 404s) across the home stage, /work and the case studies", async ({
    page,
  }) => {
    await mockStatus(page);
    const bad: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/media/") && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
    });
    for (const path of ["/", "/work", ...SLUGS.map((s) => `/work/${s}`)]) {
      await gotoReady(page, path);
      await page.evaluate(async () => {
        // bring lazy images in without scrolling through
        for (const img of document.querySelectorAll("img[loading=lazy]"))
          (img as HTMLImageElement).loading = "eager";
      });
      await page.waitForLoadState("networkidle");
    }
    expect(bad).toEqual([]);
  });
});
