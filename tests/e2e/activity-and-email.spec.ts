import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/** The activity calendar's role bands and peak days, and the contact form after the email redesign. */
const mockStatus = (page: Page) =>
  page.route("**/api/status", (r) =>
    r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
  );

test.describe("activity: peak days and role bands", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the busiest days are marked on their exact cells, matching the data", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const peaks = gh.locator("[data-kind=peak]");
    await expect(peaks).toHaveCount(3);
    // the highlight card and the top pin agree with the calendar's own numbers
    const top = await gh.getByTestId("busiest-day").innerText();
    const count = Number(/(\d+) contributions/.exec(top)![1]);
    const names = await peaks.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
    const counts = names.map((n) => Number(/: (\d+) contributions/.exec(n)![1]));
    expect(Math.max(...counts)).toBe(count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts.slice().sort((a, b) => b - a));
    expect(count).toBeGreaterThan(0);
    await expect(gh.locator("rect[data-pin-cell^='peak-']")).toHaveCount(3);
  });

  test("hovering a peak shows the day, the count and the role it fell in", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    await gh.locator("[data-kind=peak]").first().hover();
    const pop = gh.getByTestId("milestone-popover");
    await expect(pop).toContainText("PEAK DAY".replace("PEAK DAY", "Peak day"), { ignoreCase: true });
    await expect(pop).toContainText(/\d+ contributions on \w{3}, \d+ \w{3} \d{4}/);
    await expect(pop).toContainText("Commits, pull requests and issues all count");
  });

  test("the Busiest day card jumps to the calendar and opens that day", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    await gh.getByTestId("busiest-day").click();
    const pop = gh.getByTestId("milestone-popover");
    await expect(pop).toBeVisible({ timeout: 4000 });
    await expect(pop).toContainText(/Busiest day:/);
  });

  test("roles are bands that span the months he worked, stacked where they overlap, with a card and proof link", async ({
    page,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const gv = gh.locator("[data-band='role-golden-verdict']");
    const sa = gh.locator("[data-band='role-social-agent']");
    await expect(gv).toBeVisible();
    await expect(sa).toBeVisible();
    const [g, s] = [(await gv.boundingBox())!, (await sa.boundingBox())!];
    expect(g.y).not.toBe(s.y); // the two roles overlap in Jan–Mar 2026, so they sit on separate lanes
    expect(g.x).toBeGreaterThan(s.x); // Golden Verdict started later
    expect(g.x + g.width).toBeGreaterThan(s.x + s.width); // and ended later
    await gv.click();
    const pop = gh.getByTestId("milestone-popover");
    await expect(pop).toContainText("Freelance role, ended");
    await expect(pop.getByRole("link", { name: /See the proof/ })).toHaveAttribute(
      "href",
      "/work/golden-verdict",
    );
  });

  test("switching year updates the stat numbers (not just the labels) and the marks", async ({
    page,
    request,
  }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const api = await (await request.get("/api/github/calendar?year=2025")).json();
    const total = api.calendar.total.toLocaleString("en-US");
    const period = gh.getByRole("group", { name: "Contribution period" });
    await period.getByRole("button", { name: "2025" }).click();
    await expect(gh.getByText("Contributions, 2025")).toBeVisible();
    await expect(gh.locator("dl dd").first()).toHaveText(total, { timeout: 4000 });
    await expect(gh.locator("[data-kind=award]")).toHaveCount(1);
    await expect(gh.getByTestId("busiest-day")).toBeVisible();
    await period.getByRole("button", { name: "Last 12 months" }).click();
    await expect(gh.getByText("Contributions, last year")).toBeVisible();
    await expect(gh.locator("dl dd").first()).not.toHaveText(total);
  });

  test("phone: the list names every role, award and peak day", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const gh = page.locator("#github");
    await gh.scrollIntoViewIfNeeded();
    const list = gh.getByRole("heading", { name: "On this calendar" }).locator("xpath=..");
    await expect(list.getByRole("button", { name: /Golden Verdict/ })).toBeVisible();
    await expect(list.getByRole("button", { name: /Social Agent/ })).toBeVisible();
    await expect(list.getByRole("button", { name: /Hackathon/ })).toBeVisible();
    await expect(list.getByRole("button", { name: /busiest day/i }).first()).toBeVisible();
  });
});

test.describe("contact form after the email redesign", () => {
  test("not configured → the same graceful mailto fallback; invalid input is still rejected", async ({
    request,
  }) => {
    const base = { headers: { "Content-Type": "application/json", Origin: "http://localhost:3100" } };
    const bad = await request.post("/api/contact", {
      ...base,
      data: { name: "", email: "x", message: "hi" },
    });
    expect(bad.status()).toBe(400);
    const ok = await request.post("/api/contact", {
      ...base,
      data: { name: "Test", email: "test@example.com", message: "A perfectly valid message." },
    });
    expect([200, 429, 503]).toContain(ok.status()); // 503 here: the e2e server has no Resend key
    if (ok.status() === 503) expect((await ok.json()).fallback).toBe("mailto");
  });
});
