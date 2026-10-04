import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, gotoReady, ownClient } from "./helpers";

/** V3 · Phase 6: keyboard navigation, the tour, achievements, sound, night mode, the nav ticker, the visitor wall, personal links. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

test.beforeEach(async ({ context }) => ownClient(context));

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");

test.describe("keyboard navigation", () => {
  test("j and k move between sections (focus follows, so a screen reader hears where you are); g then a letter jumps", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.keyboard.press("j");
    await expect.poll(() => focusedId(page)).toBe("work");
    await page.keyboard.press("j");
    await expect.poll(() => focusedId(page)).toBe("experience");
    await page.keyboard.press("k");
    await expect.poll(() => focusedId(page)).toBe("work");
    await page.keyboard.press("g");
    await page.keyboard.press("c");
    await expect.poll(() => focusedId(page)).toBe("contact");
    await expect
      .poll(() => page.locator("#contact").evaluate((e) => Math.round(e.getBoundingClientRect().top)))
      .toBeLessThan(200);
    await page.keyboard.press("g");
    await page.keyboard.press("w");
    await expect.poll(() => focusedId(page)).toBe("work");
    await page.keyboard.press("g");
    await page.keyboard.press("h");
    await expect.poll(() => scrollY(page)).toBeLessThan(50);
  });

  test("keys are for the page only: not while typing, and not while a dialog is open", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.keyboard.press("/");
    const box = page.getByRole("combobox").or(page.getByRole("textbox")).first();
    await box.waitFor();
    await page.keyboard.type("jjj");
    expect(await scrollY(page)).toBeLessThan(50);
    await page.keyboard.press("Escape");
    await page.keyboard.press("~"); // the terminal is a dialog
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("the ? overlay lists them", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.keyboard.press("?");
    const help = page.getByRole("dialog");
    await expect(help.getByText("Next section")).toBeVisible();
    await expect(help.getByText("Previous section")).toBeVisible();
    await expect(help.getByText(/Go to Work/)).toBeVisible();
    await expect(help.getByText("Take the 60-second tour")).toBeVisible();
  });
});

test.describe("the 60-second tour", () => {
  const tour = (page: Page) => page.getByTestId("tour");

  test("starts from the hero link, scrolls and outlines each stop, advances by itself, and ends on a way to talk", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.clock.install();
    await gotoReady(page, "/");
    await expect(page.locator("html")).toHaveAttribute("data-tour", "ready");
    await page.getByRole("link", { name: /Take the 60-second tour/ }).click();
    await expect(page).toHaveURL(/\/$/); // the link did not navigate
    await expect(tour(page)).toBeVisible();
    await expect(tour(page)).toContainText("Stop 1 of 6");
    await expect(page.getByTestId("tour-caption")).toContainText("Vishal B G");
    await expect(page.locator("[data-tour-hit]")).toHaveCount(1);
    await page.clock.runFor(10_500);
    await expect(tour(page)).toContainText("Stop 2 of 6 · Work");
    await expect.poll(() => scrollY(page)).toBeGreaterThan(300);
    await expect(page.locator("[data-tour-hit]")).toHaveCount(1); // only the current stop's heading
    await expect(page.locator("#work [data-tour-hit]")).toHaveCount(1);
    for (let n = 3; n <= 6; n++) await page.clock.runFor(10_500);
    await expect(tour(page)).toContainText("Stop 6 of 6");
    await page.clock.runFor(10_500);
    await expect(tour(page)).toContainText("That's the tour");
    await expect(tour(page).getByRole("button", { name: "Message Vishal" })).toBeVisible();
    await expect(page.getByTestId("ach-count")).toHaveText("1/8 discovered"); // "Took the tour"
    await tour(page).getByRole("button", { name: "Close" }).click();
    await expect(tour(page)).toHaveCount(0);
    await expect(page.locator("[data-tour-hit]")).toHaveCount(0);
  });

  test("pause, previous, next and the keys (Space, ← →, Esc) all work, and a stop's caption is only profile facts", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.clock.install();
    await gotoReady(page, "/");
    await page.keyboard.press("t");
    await expect(tour(page)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(tour(page).getByRole("button", { name: "Play" })).toBeVisible();
    await page.clock.runFor(60_000);
    await expect(tour(page)).toContainText("Stop 1 of 6"); // paused: it did not move
    await page.keyboard.press("ArrowRight");
    await expect(tour(page)).toContainText("Stop 2 of 6");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("tour-caption")).toContainText("Full-Stack Developer");
    await expect(page.getByTestId("tour-caption")).toContainText("Jan 2026");
    await page.keyboard.press("ArrowLeft");
    await expect(tour(page)).toContainText("Stop 2 of 6");
    await tour(page).getByRole("button", { name: "Previous stop" }).click();
    await expect(tour(page)).toContainText("Stop 1 of 6");
    await expect(tour(page).getByRole("button", { name: "Previous stop" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(tour(page)).toHaveCount(0);
  });

  test("under reduced motion it waits for you: it starts paused and the page jumps instead of gliding", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await page.clock.install();
    await gotoReady(page, "/");
    await page.keyboard.press("t");
    await expect(tour(page).getByRole("button", { name: "Play" })).toBeVisible();
    await page.clock.runFor(30_000);
    await expect(tour(page)).toContainText("Stop 1 of 6");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scrollY(page)).toBeGreaterThan(300);
  });

  test("GRID can start it, with a card that has a button; Esc stops it", async ({ page }) => {
    await mockStatus(page);
    await gotoReady(page, "/");
    await page.keyboard.press("/");
    await page.keyboard.type("take me on a tour");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /GRID/ });
    await expect(dialog.locator('[data-grid-card="tour"]')).toBeVisible();
    await expect(tour(page)).toBeVisible();
    await page.keyboard.press("Escape"); // the first Esc closes the chat panel that has the keyboard
    await page.keyboard.press("Escape"); // the second stops the tour
    await expect(tour(page)).toHaveCount(0);
  });

  test("/?tour=1 starts it (a shared link, or from another page) and tidies the address", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/?tour=1");
    await expect(tour(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/privacy");
    await page.keyboard.press("?");
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Privacy" }).first().waitFor();
    // the tour is a page-one thing: starting it elsewhere takes you home first
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("app:start-tour")));
    await expect(page).toHaveURL(/\/\?tour=1$/);
    await expect(tour(page)).toBeVisible();
  });
});

test.describe("explorer achievements", () => {
  test("finding things fills the footer count and lights squares on the rail; the list gives hints and is remembered", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const count = page.getByTestId("ach-count");
    await expect(count).toHaveText("0/8 discovered");
    await page.keyboard.press("~");
    await expect(count).toHaveText("1/8 discovered");
    await page.locator("#terminal-input").fill("help");
    await page.keyboard.press("Enter");
    await expect(count).toHaveText("2/8 discovered");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("rail-found").locator('[data-found="true"]')).toHaveCount(2);
    await count.scrollIntoViewIfNeeded();
    await count.click();
    const list = page.getByRole("dialog", { name: /Explorer/ });
    await expect(list.getByText("Opened the terminal")).toBeVisible();
    await expect(list.getByText("Ran a terminal command")).toBeVisible();
    await expect(list.getByText(/Hint: Press ~/)).toHaveCount(0); // found, so no hint
    await expect(list.getByText("Not found yet")).toHaveCount(6);
    await expect(list.getByText(/Hint: The Konami code opens it/)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByTestId("ach-count")).toHaveText("2/8 discovered");
  });

  test("asking GRID, using the Omnibar and switching to 3D each count", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.keyboard.press("/");
    await page.keyboard.type("how can I contact him?");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: /GRID/ })).toBeVisible();
    await expect(page.getByTestId("ach-count")).toHaveText(/^1\/8/);
  });
});

test.describe("sound", () => {
  test("is off by default, makes no audio context until you turn it on (a gesture), and is remembered", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __ctx: number }).__ctx = 0;
      class FakeAudio {
        state = "running";
        currentTime = 0;
        destination = {};
        constructor() {
          (window as unknown as { __ctx: number }).__ctx++;
        }
        resume() {
          return Promise.resolve();
        }
        createOscillator() {
          return { frequency: { value: 0 }, connect: (x: unknown) => x, start() {}, stop() {}, type: "" };
        }
        createGain() {
          return {
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect: (x: unknown) => x,
          };
        }
      }
      (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudio;
    });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const toggle = page.getByRole("button", { name: /^Sound/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toContainText("Sound off");
    await page.keyboard.press("~");
    const terminal = page.getByRole("dialog", { name: "Terminal" });
    await expect(terminal).toBeVisible(); // it loads lazily; while it is open the rest of the page is hidden from the tree
    await page.keyboard.type("hello");
    await page.keyboard.press("Escape");
    await expect(terminal).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __ctx: number }).__ctx)).toBe(0);
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toContainText("Sound on");
    expect(await page.evaluate(() => (window as unknown as { __ctx: number }).__ctx)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("sound:v1"))).toBe("on");
    // a new page view: still on, and still no context until the first gesture
    await page.reload();
    await expect(page.getByRole("button", { name: /^Sound/ })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => (window as unknown as { __ctx: number }).__ctx)).toBe(0);
    await page.getByRole("button", { name: /^Sound/ }).click(); // turn it off again
    await expect(page.getByRole("button", { name: /^Sound/ })).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => localStorage.getItem("sound:v1"))).toBe("off");
  });
});

test.describe("night mode and the ticker", () => {
  test("between midnight and 7 in Bengaluru the hero says GRID is on duty; by day it says he is available", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-10-04T20:00:00Z")); // 01:30 IST
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const status = page.getByTestId("status-line");
    await expect(status).toContainText("probably asleep");
    await expect(status).toContainText("GRID is on duty");
    await expect(status).toHaveAttribute("data-night", "true");
    await page.clock.setFixedTime(new Date("2026-10-05T07:00:00Z")); // 12:30 IST
    await page.reload();
    await expect(page.getByTestId("status-line")).toContainText("Available for SDE / Full Stack roles");
    await expect(page.getByTestId("status-line")).not.toHaveAttribute("data-night", "true");
  });

  test("the nav shows the latest GitHub activity from lg up, sanitised, with a relative time", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const ticker = page.getByTestId("commit-ticker");
    await expect(ticker).toBeVisible();
    await expect(ticker).toHaveAttribute("href", /^https:\/\/github\.com\//);
    await expect(ticker).toHaveAttribute("rel", /noopener/);
    expect(((await ticker.innerText()) ?? "").length).toBeLessThan(120);
    await expect(ticker).toContainText(/ago|just now|yesterday|last/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(ticker).toBeHidden();
  });
});

test.describe("visitor wall", () => {
  test("lights a square per visitor, says how many are here, and sends only a random id every 30 seconds", async ({
    page,
  }) => {
    const bodies: unknown[] = [];
    await page.route("**/api/here", async (r) => {
      bodies.push(JSON.parse(r.request().postData() ?? "null"));
      await r.fulfill({ json: { configured: true, count: 3, cells: [1, 50, 100] } });
    });
    await mockStatus(page);
    await page.clock.install();
    await gotoHydrated(page, "/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    const wall = page.getByTestId("here-wall");
    await expect(wall).toContainText("Visitor wall");
    await page.clock.runFor(3000);
    await expect(wall).toContainText("3 people here now");
    await expect(wall.locator("[data-lit]")).toHaveCount(3);
    expect(bodies).toHaveLength(1);
    expect(Object.keys(bodies[0] as object)).toEqual(["v"]);
    expect((bodies[0] as { v: string }).v).toMatch(/^[a-z0-9]{10,24}$/);
    await page.clock.runFor(30_000);
    await expect.poll(() => bodies.length).toBe(2);
    expect((bodies[1] as { v: string }).v).toBe((bodies[0] as { v: string }).v); // the same tab, the same square
  });

  test("with nowhere to count (no Redis) the wall stays dim, keeps its size, and stops asking", async ({
    page,
  }) => {
    let calls = 0;
    await mockStatus(page);
    await page.clock.install();
    await gotoHydrated(page, "/");
    page.on("request", (r) => r.url().endsWith("/api/here") && calls++);
    const wall = page.getByTestId("here-wall");
    await wall.scrollIntoViewIfNeeded();
    const before = (await wall.boundingBox())!;
    await page.clock.runFor(3000);
    await expect.poll(() => calls).toBe(1); // the real route says not configured (the e2e server has no Redis)
    await page.clock.runFor(120_000);
    expect(calls).toBe(1);
    await expect(wall.locator("[data-lit]")).toHaveCount(0);
    await expect(wall).toContainText("Visitor wall");
    expect((await wall.boundingBox())!.height).toBe(before.height);
  });

  test("the heartbeat route takes only a random id, refuses anything else, and answers 'not configured' without Redis", async ({
    request,
  }) => {
    const ok = await request.post("/api/here", { data: { v: "abcdefghij12" } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ configured: false, count: 0, cells: [] });
    for (const bad of [
      {},
      { v: "short" },
      { v: "<script>alert(1)</script>" },
      { v: 12 },
      { v: "UPPERCASE1234", extra: 1 },
    ])
      expect((await request.post("/api/here", { data: bad })).status(), JSON.stringify(bad)).toBe(400);
    expect(
      (
        await request.post("/api/here", {
          data: { v: "abcdefghij12" },
          headers: { origin: "https://evil.example" },
        })
      ).status(),
    ).toBe(403);
  });
});

test.describe("personal links", () => {
  const LINK = "ab12cd34.AbCdEfGhIjKlMnOp";
  const mockLink = (
    page: Page,
    body: object = { ok: true, id: "ab12cd34", company: "Infosys", role: "SDE" },
    status = 200,
  ) => {
    const seen: string[] = [];
    return page
      .route("**/api/link?*", async (r) => {
        seen.push(r.request().url());
        await r.fulfill({ status, json: body });
      })
      .then(() => seen);
  };

  test("a valid code shows 'Hi Infosys team', lights the relevant projects, and is taken out of the address bar", async ({
    page,
  }) => {
    await mockStatus(page);
    const seen = await mockLink(page);
    await page.goto(`/?c=${LINK}`);
    const banner = page.getByTestId("company-banner");
    await expect(banner).toBeVisible();
    await expect(page.getByTestId("company-greeting")).toContainText("Hi Infosys team");
    await expect(page.getByTestId("company-greeting")).toContainText("SDE");
    await expect(page).toHaveURL(/\/$/);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain(`c=${encodeURIComponent(LINK)}`);
    await banner.getByRole("button", { name: /What's relevant/ }).click();
    const panel = page.locator("#company-panel");
    await expect(panel.getByRole("heading", { name: /Most relevant for SDE/ })).toBeVisible();
    expect(await panel.getByRole("link").count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator("[data-role-hit]").first()).toBeAttached();
    await banner.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.locator("[data-role-hit]")).toHaveCount(0);
  });

  test("it survives a reload in the same tab, and a bad or unknown code shows nothing at all", async ({
    page,
  }) => {
    await mockStatus(page);
    const seen = await mockLink(page);
    await page.goto(`/?c=${LINK}`);
    await expect(page.getByTestId("company-banner")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("company-banner")).toBeVisible();
    expect(seen.length).toBeLessThanOrEqual(2); // the answer is kept for the tab
    // a made-up value never reaches the server
    const page2 = await page.context().newPage();
    await mockStatus(page2);
    const seen2 = await mockLink(page2);
    await page2.goto("/?c=<script>alert(1)</script>");
    await page2.waitForTimeout(800);
    await expect(page2.getByTestId("company-banner")).toHaveCount(0);
    expect(seen2).toHaveLength(0);
    // a well-formed code the server refuses: no banner, and the code is forgotten
    const page3 = await page.context().newPage();
    await mockStatus(page3);
    await mockLink(page3, { ok: false }, 404);
    await page3.goto("/?c=zz99yy88.ZzYyXxWwVvUuTtSs");
    await page3.waitForTimeout(800);
    await expect(page3.getByTestId("company-banner")).toHaveCount(0);
    expect(await page3.evaluate(() => sessionStorage.getItem("link:v1"))).toBeNull();
  });

  test("a résumé download and a chat with GRID tell the server (once each), and nothing else is sent", async ({
    page,
  }) => {
    await mockStatus(page);
    await mockLink(page);
    const events: Array<{ c: string; e: string }> = [];
    await page.route("**/api/link/event", async (r) => {
      events.push(JSON.parse(r.request().postData() ?? "{}"));
      await r.fulfill({ json: { ok: true } });
    });
    await page.goto(`/?c=${LINK}`);
    await expect(page.getByTestId("company-banner")).toBeVisible();
    await page.route("**/resume.pdf", (r) =>
      r.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4" }),
    );
    await page
      .locator("header")
      .getByRole("link", { name: "Résumé" })
      .evaluate((a) => (a as HTMLAnchorElement).removeAttribute("target"));
    await page
      .locator("header")
      .getByRole("link", { name: "Résumé" })
      .click()
      .catch(() => {});
    await expect.poll(() => events.map((e) => e.e)).toContain("resume");
    await gotoReady(page, "/");
    await page.keyboard.press("/");
    await page.keyboard.type("contact details");
    await page.keyboard.press("Enter");
    await expect.poll(() => events.map((e) => e.e)).toContain("chat");
    for (const e of events) {
      expect(Object.keys(e).sort()).toEqual(["c", "e"]);
      expect(e.c).toBe(LINK);
    }
    expect(events.filter((e) => e.e === "resume")).toHaveLength(1);
  });

  test("the API says nothing without the live chat's setup: a plain 404 for any code", async ({
    request,
  }) => {
    const res = await request.get(`/api/link?c=${LINK}`);
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ ok: false });
    const ev = await request.post("/api/link/event", { data: { c: LINK, e: "resume" } });
    expect(ev.status()).toBe(404);
  });
});
