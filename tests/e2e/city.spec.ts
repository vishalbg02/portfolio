import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, loadIslands } from "./helpers";

/** V3 · Phase 5: the 3D Commit City, a lazy second view of the Activity calendar. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));

async function openCity(page: Page) {
  await mockStatus(page);
  await gotoHydrated(page, "/");
  await loadIslands(page);
  const section = page.locator("#github");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByTestId("contribution-calendar")).toBeVisible(); // 2D is the default
  await section.getByRole("button", { name: "3D city" }).click();
  const city = section.getByTestId("city");
  await expect(city).toBeVisible();
  await expect(city).not.toHaveAttribute("data-yaw", ""); // it has drawn
  return { section, city, canvas: section.getByTestId("city-canvas") };
}

const num = async (loc: ReturnType<Page["locator"]>, attr: string) => Number(await loc.getAttribute(attr));

/** Where, in CSS pixels, a bright "block" pixel is on the canvas (so a test can point at a day). */
const findBlock = (page: Page) =>
  page.getByTestId("city-canvas").evaluate((cv: HTMLCanvasElement) => {
    const ctx = cv.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, cv.width, cv.height);
    const k = cv.width / cv.getBoundingClientRect().width;
    for (let y = Math.floor(height * 0.4); y < height * 0.8; y += 2)
      for (let x = Math.floor(width * 0.3); x < width * 0.8; x += 2) {
        const i = (y * width + x) * 4;
        if (data[i + 3] === 255 && data[i + 1] > 150 && data[i]! < 100) return { x: x / k, y: y / k };
      }
    return null;
  });

test.describe("3D Commit City", () => {
  test("is a second view of the calendar: 2D by default, 3D draws a real city, 2D comes back", async ({
    page,
  }) => {
    const { section, canvas } = await openCity(page);
    expect(await findBlock(page), "something is painted").not.toBeNull();
    const box = (await canvas.boundingBox())!;
    expect(box.width).toBeGreaterThan(300);
    await expect(section.getByRole("button", { name: "3D city" })).toHaveAttribute("aria-pressed", "true");
    await section.getByRole("button", { name: "2D calendar" }).click();
    await expect(section.getByTestId("contribution-calendar")).toBeVisible();
    await expect(canvas).toHaveCount(0);
  });

  test("the buttons and the keyboard rotate, tilt and zoom, and Reset puts it back", async ({ page }) => {
    const { city } = await openCity(page);
    await page.emulateMedia({ reducedMotion: "reduce" }); // jumps, so the values are final at once
    const yaw0 = await num(city, "data-yaw");
    await city.getByRole("button", { name: "Rotate right" }).click();
    await expect.poll(() => num(city, "data-yaw")).toBeGreaterThan(yaw0 + 0.3);
    await city.getByRole("button", { name: "Rotate left" }).click();
    await expect.poll(() => num(city, "data-yaw")).toBeCloseTo(yaw0, 2);
    await city.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => num(city, "data-zoom")).toBeGreaterThan(1.2);
    await city.focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => num(city, "data-yaw")).toBeLessThan(yaw0 - 0.1);
    const pitch = await num(city, "data-pitch");
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => num(city, "data-pitch")).toBeGreaterThan(pitch);
    await page.keyboard.press("0");
    await expect.poll(() => num(city, "data-zoom")).toBeCloseTo(1, 2);
    await expect.poll(() => num(city, "data-yaw")).toBeCloseTo(yaw0, 2);
  });

  test("dragging rotates it; Ctrl + wheel zooms; a plain wheel scrolls the page and is never trapped", async ({
    page,
  }) => {
    const { city, canvas } = await openCity(page);
    const box = (await canvas.boundingBox())!;
    const yaw0 = await num(city, "data-yaw");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => num(city, "data-yaw")).toBeLessThan(yaw0 - 0.5);

    const zoom0 = await num(city, "data-zoom");
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await expect.poll(() => num(city, "data-zoom")).toBeGreaterThan(zoom0);

    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
    expect(await num(city, "data-zoom")).toBeGreaterThan(zoom0 - 0.001); // unchanged by the plain wheel
  });

  test("pointing at a day says how many contributions it had", async ({ page }) => {
    const { city, canvas } = await openCity(page);
    const at = (await findBlock(page))!;
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + at.x, box.y + at.y);
    const tip = city.locator("div[aria-hidden='true']").filter({ hasText: /contribution/ });
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText(/\d+ contributions? on |No contributions on /);
    await page.mouse.move(box.x + 2, box.y + 2);
    await expect(tip).toBeHidden();
  });

  test("a tower is a labelled landmark: pressing it flies the camera there and tells its story, with a way out", async ({
    page,
  }) => {
    const { section, city } = await openCity(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const pins = city.locator("[data-landmark]");
    expect(await pins.count()).toBeGreaterThanOrEqual(1);
    const first = pins.first();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    const story = section.getByTestId("city-story");
    await expect(story).toBeVisible();
    await expect(story.getByRole("heading", { level: 3 })).not.toBeEmpty();
    await expect.poll(() => num(city, "data-zoom")).toBeGreaterThanOrEqual(1.69);
    await city.focus();
    await page.keyboard.press("Escape");
    await expect(story).toHaveCount(0);
    await first.click();
    await story.getByRole("button", { name: "Close" }).click();
    await expect(story).toHaveCount(0);
    await city.getByRole("button", { name: "Reset" }).click();
    await expect.poll(() => num(city, "data-zoom")).toBeCloseTo(1, 2);
  });

  test("a changed year redraws (the city is rebuilt for that year's weeks)", async ({ page }) => {
    const { section, city } = await openCity(page);
    const yaw = await city.getAttribute("data-yaw");
    await section.getByRole("button", { name: "2025" }).click();
    await expect(section.getByText("Contributions, 2025")).toBeVisible();
    await expect(city).toBeVisible();
    await expect(city).toHaveAttribute("data-yaw", yaw!); // a fresh camera at home
  });

  test("the chunk is only fetched when 3D is switched on", async ({ page }) => {
    const chunks: string[] = [];
    page.on("request", (r) => {
      if (/\/_next\/static\/chunks\//.test(r.url()) && r.resourceType() === "script") chunks.push(r.url());
    });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await loadIslands(page);
    await page.locator("#github").scrollIntoViewIfNeeded();
    await expect(page.locator("#github").getByTestId("contribution-calendar")).toBeVisible();
    const before = chunks.length;
    await page.locator("#github").getByRole("button", { name: "3D city" }).click();
    await expect(page.getByTestId("city-canvas")).toBeVisible();
    expect(chunks.length).toBeGreaterThan(before);
  });

  test("keeps the accessible summary and passes axe in 3D", async ({ page }) => {
    const { section, city } = await openCity(page);
    await expect(city).toHaveAttribute("aria-label", /contributions, last year.*arrow keys/);
    await expect(section.locator("ul.sr-only li").first()).toBeAttached(); // the monthly totals
    const res = await new AxeBuilder({ page })
      .include("#github")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

test.describe("3D Commit City on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("labels become numbered pins with a list underneath, and nothing overflows", async ({ page }) => {
    const { section, city } = await openCity(page);
    await expect(city.locator("[data-landmark]").first()).toBeVisible();
    await expect(city.locator("[data-landmark]").first()).toHaveText(/^\d+$/);
    const list = section.getByRole("list", { name: "Towers in this city" });
    await expect(list).toBeVisible();
    await list.getByRole("button").first().click();
    await expect(section.getByTestId("city-story")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // controls are 44 px targets
    const zoom = await city.getByRole("button", { name: "Zoom in" }).boundingBox();
    expect(zoom!.height).toBeGreaterThanOrEqual(44);
  });
});
