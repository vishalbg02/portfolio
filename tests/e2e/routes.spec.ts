import { expect, test, type Page } from "@playwright/test";
import { gotoReady } from "./helpers";

/**
 * Every public route: loads with the right status, no console errors or warnings (this is how React
 * hydration mismatches show up), no failed requests, no CSP violations, no horizontal scroll at 360.
 */
const ROUTES = [
  "/",
  "/work",
  "/work/golden-verdict",
  "/work/talnio",
  "/work/lansymphony",
  "/work/virtual-tour",
  "/resume",
  "/recruiter",
  "/now",
  "/privacy",
  "/log",
  "/log/an-assistant-that-says-i-dont-know",
];

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    // a clip that was paused or scrolled away while loading is aborted by the browser: normal, not a failure
    if (/\/media\/.*\.(webm|mp4)$/.test(r.url()) && r.failure()?.errorText === "net::ERR_ABORTED") return;
    problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/api/status"))
      problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return problems;
}

for (const route of ROUTES) {
  test(`${route}: clean console, no failed requests, no overflow at 360px`, async ({ page }) => {
    await page.route("**/api/status", (r) =>
      r.fulfill({ json: { checkedAt: new Date().toISOString(), statuses: {} } }),
    );
    const problems = watch(page);
    await page.setViewportSize({ width: 360, height: 800 });
    const res = await page.goto(route);
    expect(res?.status()).toBe(200);
    await gotoReady(page, route);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
  });
}

test("404 page: clean console and still shows the not-found content", async ({ page }) => {
  const problems = watch(page);
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("404");
  // the 404 response itself is expected; anything else is not
  expect(problems.filter((p) => !p.includes("HTTP 404") && !p.includes("Failed to load resource"))).toEqual(
    [],
  );
});

test.describe("headers, metadata and PWA", () => {
  test("security headers are set on pages", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("the manifest is valid and its icons exist", async ({ request, page }) => {
    await page.goto("/");
    await expect(page.locator("link[rel='manifest']")).toHaveAttribute("href", /manifest\.webmanifest$/);
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m).toMatchObject({ display: "standalone", start_url: "/", background_color: "#0d1117" });
    expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)).toEqual([
      "192x192:any",
      "512x512:any",
      "512x512:maskable",
    ]);
    for (const icon of m.icons as Array<{ src: string }>) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()["content-type"]).toBe("image/png");
    }
    expect((await request.get("/apple-icon")).status()).toBe(200);
  });

  test("robots and sitemap point at each other and cover the new routes", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Sitemap: https://vishalbg.vercel.app/sitemap.xml");
    expect(robots).toContain("Disallow: /api/");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const p of ["/", "/work", "/resume", "/resume.pdf", "/recruiter", "/now"]) {
      expect(sitemap).toContain(`https://vishalbg.vercel.app${p === "/" ? "/" : p}</loc>`);
    }
  });
});
