import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, settleAnimations, loadIslands } from "./helpers";

const at = new Date().toISOString();
const mockStatus = (page: Page) =>
  page.route("**/api/status", (route) =>
    route.fulfill({
      json: {
        checkedAt: at,
        statuses: {
          "golden-verdict": { slug: "golden-verdict", state: "live", latencyMs: 142, checkedAt: at },
          talnio: { slug: "talnio", state: null, latencyMs: null, checkedAt: at },
          lansymphony: { slug: "lansymphony", state: null, latencyMs: null, checkedAt: at },
          "virtual-tour": { slug: "virtual-tour", state: "live", latencyMs: 300, checkedAt: at },
        },
      },
    }),
  );
const axe = async (page: Page) =>
  (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");

test.describe("résumé", () => {
  test("/resume.pdf is a real PDF with the right filename", async ({ request }) => {
    const res = await request.get("/resume.pdf");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["content-disposition"]).toContain('filename="Vishal_BG_Resume.pdf"');
    const body = await res.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(4000);
  });

  test("/resume lists every section in order, with a download link and a last-updated date", async ({
    page,
  }) => {
    await page.goto("/resume");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vishal B G");
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings.map((h) => h.replace(/^#\s*/, ""))).toEqual([
      "Professional Summary",
      "Work Experience",
      "Projects",
      "Technical Skills",
      "Education",
      "Certifications",
      "Achievements & Awards",
      "Leadership & Activities",
      "Does this résumé fit your role?",
    ]);
    const download = page.getByRole("link", { name: "Download PDF" });
    await expect(download).toHaveAttribute("href", "/resume.pdf");
    await expect(download).toHaveAttribute("download", "Vishal_BG_Resume.pdf");
    await expect(page.getByText(/Last updated/)).toBeVisible();
    await expect(page.getByText("vishalbg02@gmail.com").first()).toBeVisible();
    await expect(page.getByText("boAt’s IoT devices")).toBeVisible(); // curly apostrophe
    expect(await axe(page)).toEqual([]);
  });

  test("nav and hero résumé buttons open the PDF in a new tab and are tracked", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    for (const link of [
      page.getByRole("banner").getByRole("link", { name: "Résumé" }),
      page.locator("section[aria-labelledby='hero-title']").getByRole("link", { name: "Résumé" }),
    ]) {
      await expect(link).toHaveAttribute("href", "/resume.pdf");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("data-track", "resume_download");
    }
  });

  test("palette offers the résumé page and a download", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("résumé");
    await expect(page.getByRole("option", { name: /^Résumé/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Download résumé/ })).toBeVisible();
  });
});

test.describe("experience", () => {
  test("shows each role with its first commit, and expandable details", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const exp = page.locator("#experience");
    await expect(exp.getByRole("heading", { name: "Full-Stack & App Developer Intern" })).toBeVisible();
    await expect(exp.getByText("Jun 2025 – Mar 2026")).toBeVisible();
    await expect(exp.locator(".animate-pulse-dot")).toHaveCount(0); // no open branch: nothing is current
    const hidden = exp.getByText("Implemented geolocation- and NFC-based attendance");
    await expect(hidden).toBeHidden();
    const details = exp.locator("details", { hasText: "Implemented geolocation- and NFC-based attendance" });
    await details.getByText("Show details").click();
    await expect(hidden).toBeVisible();
    await expect(details.getByText("Hide details")).toBeVisible();
  });

  test("details toggle works from the keyboard", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const summary = page.locator("#experience summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#experience details").first()).toHaveAttribute("open", "");
  });

  test("education appears as tags on main", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const exp = page.locator("#experience");
    await expect(exp.getByText("tag: MCA (in progress)")).toBeVisible();
    await expect(exp.getByText("Master of Computer Applications (MCA)")).toBeVisible();
    await expect(exp.getByText("tag: BCA", { exact: true })).toBeVisible();
    await expect(exp.getByText("CGPA 8.45 / 10")).toBeVisible();
  });
});

test.describe("stack", () => {
  test("hovering a skill shows which projects used it and lights their cards", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const stack = page.locator("#stack");
    await stack.getByRole("button", { name: "Firebase" }).hover();
    await expect(stack.locator("[aria-live=polite]").getByText(/used in/)).toBeVisible();
    await expect(stack.getByRole("link", { name: "Golden Verdict" })).toBeVisible();
    await expect(stack.getByRole("link", { name: "Talnio" })).toBeVisible();
    await expect(page.locator("[data-project='golden-verdict']")).toHaveAttribute("data-stack-hit", "true");
    await expect(page.locator("[data-project='talnio']")).toHaveAttribute("data-stack-hit", "true");
    await expect(page.locator("[data-project='lansymphony']")).not.toHaveAttribute("data-stack-hit", "true");
    await page.mouse.move(2, 2);
    await expect(page.locator("[data-project='talnio']")).not.toHaveAttribute("data-stack-hit", "true");
  });

  test("works by keyboard focus and pins on Enter", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const three = page.locator("#stack").getByRole("button", { name: "Three.js" });
    await three.focus();
    await expect(
      page.locator("#stack").getByRole("link", { name: "CHRIST University Virtual Tour" }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(three).toHaveAttribute("aria-pressed", "true");
  });

  test("a skill no project used says so plainly, points to where it was learned, and still opens GRID's evidence", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/");
    await loadIslands(page);
    const stack = page.locator("#stack");
    const java = stack.getByRole("button", { name: "Java", exact: true });
    await expect(java).toBeVisible();
    await expect(stack.locator("[data-layer=base] path").first()).toBeAttached(); // wires exist for the skills that have projects
    await java.click();
    const live = stack.locator("[aria-live=polite]");
    await expect(live).toContainText("no project on this site used it");
    await expect(live).toContainText("CHRIST");
    await expect(stack.locator(".stack-line")).toHaveCount(0); // nothing is drawn that no case study backs up
    await live.getByRole("button", { name: "Ask GRID where" }).click();
    const dialog = page.getByRole("dialog", { name: /GRID/ });
    await expect(dialog.getByText("Where did he use Java?")).toBeVisible();
    await expect(stack.getByRole("heading", { level: 3 })).toHaveCount(6);
  });
});

test.describe("live GitHub", () => {
  test("renders stats, a native calendar with day tooltips, and linked activity", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const gh = page.locator("#github");
    await expect(gh.getByText("Contributions, last year")).toBeVisible();
    await expect(gh.getByText("Active days, last year")).toBeVisible();
    await expect(gh.getByText("Longest streak")).toBeVisible();
    await expect(gh.getByText(/^(Updated .+|Live · refreshed hourly)$/)).toBeVisible();
    const svg = gh.getByTestId("contribution-calendar");
    await expect(svg.locator("path[data-level]")).toHaveCount(5); // one path per level, not 371 elements
    await gh.scrollIntoViewIfNeeded();
    const box = (await svg.boundingBox())!;
    const [, , vbW, vbH] = (await svg.getAttribute("viewBox"))!.split(" ").map(Number);
    const top = vbH! - 7 * 14; // the label row above the grid grows with the milestone pins
    const scale = box.width / vbW!;
    // week 30, Wednesday → centre of that cell (LEFT=30, PITCH=14, CELL=11)
    await page.mouse.move(box.x + (30 + 30 * 14 + 5.5) * scale, box.y + (top + 3 * 14 + 5.5) * scale);
    await expect(gh.getByTestId("day-tooltip")).toContainText(/contribution/);
    await page.mouse.move(box.x + (30 + 30 * 14 + 12.5) * scale, box.y + (top + 3 * 14 + 5.5) * scale); // in the gap
    await expect(gh.getByTestId("day-tooltip")).toHaveCount(0);
    const links = gh.locator("ul").last().getByRole("link");
    expect(await links.count()).toBeGreaterThanOrEqual(3);
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      expect(href).toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);
    }
  });

  test("the calendar is announced with its totals", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    await loadIslands(page);
    await expect(
      page.locator("#github").getByRole("img", {
        name: /\d+ contributions, last year\. \d+ active days, longest streak \d+ days?/,
      }),
    ).toBeVisible();
  });
});

test.describe("recognition", () => {
  test("is no longer a separate home section; the awards are pinned on the calendar, with the GATEWAYS line under it", async ({
    page,
  }) => {
    await mockStatus(page);
    await page.goto("/");
    await loadIslands(page);
    await expect(page.getByRole("region", { name: "Recognition" })).toHaveCount(0);
    await expect(page.locator("#recognition")).toHaveCount(0);
    const gh = page.locator("#github");
    await expect(gh.getByText(/GATEWAYS 2026/)).toBeVisible();
    await expect(gh.locator("[data-kind=award]")).toHaveCount(2); // Feb and Jun 2026
    await expect(gh.locator("[data-kind=peak]")).toHaveCount(3); // the three busiest days
    await expect(gh.locator("[data-band]")).toHaveCount(2); // Social Agent and Golden Verdict as role bands
  });
});

test.describe("contact", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copy buttons copy the email and phone and confirm with a toast", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    const c = page.locator("#contact");
    await c.getByRole("button", { name: /^Email/ }).click();
    await expect(page.getByText("Email copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("vishalbg02@gmail.com");
    await c.getByRole("button", { name: /^Phone/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("+91 96639 72259");
  });

  test("quick links point at the right places, including the Cal.com booking page", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const c = page.locator("#contact");
    await expect(c.getByRole("link", { name: /^Call/ })).toHaveAttribute("href", "tel:+919663972259");
    await expect(c.getByRole("link", { name: /^WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/919663972259",
    );
    await expect(c.getByRole("link", { name: /^LinkedIn/ })).toHaveAttribute(
      "href",
      "https://linkedin.com/in/vishalbg",
    );
    await expect(c.getByRole("link", { name: /^GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/vishalbg02",
    );
    const book = c.getByRole("link", { name: /Book a 15-min call/ });
    await expect(book).toHaveAttribute("href", "https://cal.com/vishal-b-g-02/15min");
    await expect(book).toHaveAttribute("target", "_blank");
    await expect(book).toHaveAttribute("rel", /noopener/);
  });

  test("validates on submit, focuses the first problem, and clears errors as you type", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const form = page.getByRole("form", { name: "Contact form" });
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByText("Please enter your name.")).toBeVisible();
    await expect(form.getByText("Please enter a valid email address.")).toBeVisible();
    await expect(form.getByText(/at least 10 characters/)).toBeVisible();
    await expect(form.getByLabel("Name")).toBeFocused();
    await expect(form.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
    await form.getByLabel("Name").fill("Asha Rao");
    await expect(form.getByText("Please enter your name.")).toHaveCount(0);
  });

  test("the honeypot is invisible to people and screen readers", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    await loadIslands(page);
    const honey = page.locator("input[name='website']");
    // Off-screen (bots still fill it), not focusable, not exposed to assistive tech.
    const box = await honey.boundingBox();
    expect(box === null || box.x < -1000).toBe(true);
    await expect(honey).toHaveAttribute("tabindex", "-1");
    expect(await honey.evaluate((el) => el.closest("[aria-hidden='true']") !== null)).toBe(true);
  });

  const fill = async (page: Page) => {
    const form = page.getByRole("form", { name: "Contact form" });
    await form.getByLabel("Name").fill("Asha Rao");
    await form.getByLabel("Email").fill("asha@example.com");
    await form.getByLabel("Message").fill("Hi Vishal, we would like to talk about a full-stack role.");
    return form;
  };

  test("success: shows confirmation and sends exactly the entered data", async ({ page }) => {
    await mockStatus(page);
    let sent: Record<string, string> | null = null;
    await page.route("**/api/contact", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    });
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const form = await fill(page);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Message sent").first()).toBeVisible();
    expect(sent).toMatchObject({ name: "Asha Rao", email: "asha@example.com", website: "" });
  });

  test("falls back to mailto when email delivery isn't configured (503)", async ({ page }) => {
    await mockStatus(page);
    await page.route("**/api/contact", (route) =>
      route.fulfill({ status: 503, json: { error: "not_configured", fallback: "mailto" } }),
    );
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const form = await fill(page);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("The form can't send right now.")).toBeVisible();
    const href = await page.getByRole("link", { name: "Open in my email app" }).getAttribute("href");
    expect(href).toContain("mailto:vishalbg02@gmail.com");
    expect(decodeURIComponent(href!)).toContain("full-stack role");
  });

  test("falls back to mailto when the network fails", async ({ page }) => {
    await mockStatus(page);
    await page.route("**/api/contact", (route) => route.abort());
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const form = await fill(page);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("link", { name: "Open in my email app" })).toBeVisible();
  });

  test("rate limiting is explained, not hidden (429)", async ({ page }) => {
    await mockStatus(page);
    await page.route("**/api/contact", (route) =>
      route.fulfill({ status: 429, json: { error: "rate_limited" } }),
    );
    await gotoHydrated(page, "/");
    await loadIslands(page);
    const form = await fill(page);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/Too many messages/)).toBeVisible();
  });
});

test.describe("/api/contact", () => {
  const ok = {
    name: "Asha Rao",
    email: "asha@example.com",
    message: "Hello, this is a test message for the API.",
  };
  const post = (
    request: import("@playwright/test").APIRequestContext,
    data: unknown,
    ip: string,
    headers: Record<string, string> = {},
  ) => request.post("/api/contact", { data, headers: { "x-forwarded-for": ip, ...headers } });

  test("rejects invalid input with field-level issues", async ({ request }) => {
    const res = await post(request, { ...ok, email: "nope" }, "10.0.0.1");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.issues.map((i: { path: string }) => i.path)).toContain("email");
  });

  test("rejects malformed JSON, oversized bodies and cross-origin posts", async ({ request }) => {
    expect(
      (
        await request.post("/api/contact", {
          data: "{not json",
          headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.2" },
        })
      ).status(),
    ).toBe(400);
    expect((await post(request, { ...ok, message: "x".repeat(12_000) }, "10.0.0.3")).status()).toBe(413);
    expect((await post(request, ok, "10.0.0.4", { origin: "https://evil.example" })).status()).toBe(403);
  });

  test("silently accepts a filled honeypot without sending anything", async ({ request }) => {
    const res = await post(request, { ...ok, website: "http://spam.example" }, "10.0.0.5");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("reports 'not configured' with a mailto fallback when no Resend key is set", async ({ request }) => {
    const res = await post(request, ok, "10.0.0.6");
    // Local/CI runs have no RESEND_API_KEY. (If a key IS configured this returns 200, which is also fine.)
    expect([200, 503]).toContain(res.status());
    if (res.status() === 503)
      expect(await res.json()).toMatchObject({ error: "not_configured", fallback: "mailto" });
  });

  test("rate-limits a single client after 5 messages", async ({ request }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await post(request, ok, "10.9.9.9")).status());
    expect(statuses.slice(0, 5).every((s) => s === 200 || s === 503)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
    const res = await post(request, ok, "10.9.9.9");
    expect(res.headers()["retry-after"]).toBeDefined();
    // a different client is unaffected
    expect([200, 503]).toContain((await post(request, ok, "10.9.9.10")).status());
  });
});

test.describe("full home page", () => {
  test("has no serious axe violations", async ({ page }) => {
    await mockStatus(page);
    await gotoHydrated(page, "/");
    await settleAnimations(page);
    expect(await axe(page)).toEqual([]);
  });

  test("never scrolls horizontally at 360, 768, 1280 and 1920", async ({ page }) => {
    await mockStatus(page);
    for (const width of [320, 360, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await loadIslands(page);
      await expect(page.locator("#github svg").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test("sections appear in the specified order", async ({ page }) => {
    await mockStatus(page);
    await page.goto("/");
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll("main section[id]")].map((s) => s.id),
    );
    expect(ids).toEqual(["work", "experience", "stack", "github", "ask", "contact"]);
  });
});
