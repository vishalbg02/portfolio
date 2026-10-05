import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoHydrated } from "./helpers";

/** V3 · Phase 5: pixel-dissolve, square button fill, the context cursor, Contact (QR and vCard), Experience monograms. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

test.describe("pixel dissolve", () => {
  test("a new page dissolves in: squares cover the viewport, never take a click, and clear on their own", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.waitForTimeout(1800); // the effect's code is fetched when the browser is idle
    const seen = page.waitForSelector("[data-pixel-reveal]", { state: "attached", timeout: 5000 });
    await page.locator("header").getByRole("link", { name: "Log", exact: true }).first().click();
    const layer = await seen;
    expect(await layer.getAttribute("aria-hidden")).toBe("true");
    expect(await layer.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
    await expect(page).toHaveURL(/\/log$/);
    await expect(page.locator("[data-pixel-reveal]")).toHaveCount(0, { timeout: 3000 });
  });

  test("under reduced motion navigation is instant: no squares at all", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.waitForTimeout(1800);
    let appeared = false;
    await page.exposeFunction("__sawLayer", () => (appeared = true));
    await page.evaluate(() => {
      new MutationObserver(() => {
        if (document.querySelector("[data-pixel-reveal]"))
          (window as unknown as { __sawLayer: () => void }).__sawLayer();
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.locator("header").getByRole("link", { name: "Log", exact: true }).first().click();
    await expect(page).toHaveURL(/\/log$/);
    await page.waitForTimeout(600);
    expect(appeared).toBe(false);
  });

  test("a dialog dissolves in too (the terminal), and a hash link on the same page does not wipe", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.waitForTimeout(1800);
    let inDialog = false;
    await page.exposeFunction("__layerInDialog", () => (inDialog = true));
    await page.evaluate(() => {
      new MutationObserver((records) => {
        for (const r of records)
          for (const n of r.addedNodes)
            if (
              n instanceof HTMLElement &&
              "pixelReveal" in n.dataset &&
              n.parentElement?.getAttribute("role") === "dialog"
            )
              (window as unknown as { __layerInDialog: () => void }).__layerInDialog();
      }).observe(document.documentElement, { childList: true, subtree: true });
    });
    await page.keyboard.press("~");
    await expect.poll(() => inDialog, { timeout: 8000 }).toBe(true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    let wiped = false;
    await page.exposeFunction("__wiped", () => (wiped = true));
    await page.evaluate(() => {
      new MutationObserver(() => {
        if (document.querySelector("body > [data-pixel-reveal]"))
          (window as unknown as { __wiped: () => void }).__wiped();
      }).observe(document.body, { childList: true });
    });
    await page.evaluate(() => (location.hash = "#contact"));
    await page.waitForTimeout(600);
    expect(wiped).toBe(false);
  });
});

test.describe("buttons", () => {
  test("hovering a button sweeps a flat fill across in five steps; reduced motion keeps plain hover colours", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const view = page.getByRole("link", { name: "View work" }).first();
    const before = await view.evaluate((e) => getComputedStyle(e, "::before").animationName);
    expect(before).toBe("none");
    await view.hover();
    await expect
      .poll(() => view.evaluate((e) => getComputedStyle(e, "::before").animationName))
      .toBe("btn-fill");
    expect(await view.evaluate((e) => getComputedStyle(e, "::before").animationTimingFunction)).toBe(
      "steps(5)",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(2, 2);
    await view.hover();
    expect(await view.evaluate((e) => getComputedStyle(e, "::before").animationName)).toBe("none");
  });
});

test.describe("context cursor", () => {
  test("a small square follows the pointer on the 4 px grid and names what you are over: copy, ask, open, drag", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const cursor = page.getByTestId("context-cursor");
    await page.mouse.move(300, 300);
    await expect(cursor).toBeAttached();
    await expect(cursor).toHaveCSS("opacity", "1");
    await expect
      .poll(() => cursor.evaluate((e) => (e as HTMLElement).style.transform))
      .toMatch(/translate3d\(-?\d+px, -?\d+px, 0px?\)/);
    const [x, y] = await cursor.evaluate((e) => {
      const m = (e as HTMLElement).style.transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/)!;
      return [Number(m[1]), Number(m[2])] as const;
    });
    expect((x + 4) % 4).toBe(0);
    expect((y + 4) % 4).toBe(0);

    await page.locator("#contact").scrollIntoViewIfNeeded();
    const copy = page.getByRole("button", { name: /Email/ }).first();
    const box = (await copy.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(cursor).toHaveAttribute("data-label", "copy");
    await expect(cursor).toHaveText("copy");
    expect(await page.evaluate(() => "cursorActive" in document.documentElement.dataset)).toBe(true);
    await page.mouse.move(2, 2);
    await expect(cursor).toHaveAttribute("data-label", "");
    expect(await page.evaluate(() => "cursorActive" in document.documentElement.dataset)).toBe(false);

    // over a text field it steps aside so the I-beam stays
    const name = page.getByLabel("Name").first();
    await name.scrollIntoViewIfNeeded();
    const nb = (await name.boundingBox())!;
    await page.mouse.move(nb.x + 20, nb.y + nb.height / 2);
    await expect(cursor).toHaveAttribute("data-hidden", "true");
  });

  test("is not mounted for touch or for reduced motion (its code is never fetched)", async ({ browser }) => {
    for (const opts of [
      { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
      { reducedMotion: "reduce" as const },
    ]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await mockStatus(page);
      await gotoHydrated(page, "/");
      await page.mouse.move(300, 300);
      await page.waitForTimeout(400);
      await expect(page.getByTestId("context-cursor")).toHaveCount(0);
      await ctx.close();
    }
  });
});

test.describe("contact card", () => {
  test("serves a static vCard with only what the profile says, inline so a phone offers Add contact", async ({
    request,
  }) => {
    const res = await request.get("/vishal-b-g.vcf");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/vcard");
    expect(res.headers()["content-disposition"]).toContain("inline");
    const body = await res.text();
    expect(body.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(body).toContain("FN:Vishal B G");
    expect(body).toContain("TEL;TYPE=CELL:+919663972259");
    expect(body).toContain("EMAIL;TYPE=INTERNET:vishalbg02@gmail.com");
    expect(body.endsWith("END:VCARD\r\n")).toBe(true);
  });

  test("Contact has a Save contact link and, on a desktop, a QR code for it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const contact = page.locator("#contact");
    const save = contact.getByRole("link", { name: /Save contact/ });
    await expect(save).toHaveAttribute("href", "/vishal-b-g.vcf");
    await expect(save).toHaveAttribute("download", "Vishal_B_G.vcf");
    const qr = contact.getByTestId("contact-qr");
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute("aria-label", /QR code/);
    const box = (await qr.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(100);
    expect(await qr.locator("path").getAttribute("fill")).toBe("#0d1117"); // dark modules on a light tile
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(qr).toBeHidden(); // a phone has the link, not a code to scan
    await expect(save).toBeVisible();
  });
});

test.describe("experience", () => {
  test("each role has a code-drawn monogram square (no logos, no images)", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const marks = page.locator("#experience [data-monogram]");
    await expect(marks).toHaveCount(3);
    expect(await marks.evaluateAll((els) => els.map((e) => e.getAttribute("data-monogram")))).toEqual([
      "GV",
      "SA",
      "KT",
    ]);
    expect(await page.locator("#experience img").count()).toBe(0);
  });
});
