import { expect, test, type Page } from "@playwright/test";

const SITE = "https://vishalbg.vercel.app";
const SLUGS = ["golden-verdict", "talnio", "lansymphony", "virtual-tour"];

const jsonLd = async (page: Page) =>
  (await page.locator("script[type='application/ld+json']").allTextContents()).map(
    (t) => JSON.parse(t) as { "@graph": Array<Record<string, unknown>> },
  );

test.describe("search & social metadata", () => {
  test("home: title, description, canonical, robots and Open Graph", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Vishal B G — Full Stack Developer");
    const desc = await page.locator("meta[name='description']").getAttribute("content");
    expect(desc).toMatch(/^Vishal B G is a full-stack developer in Bengaluru/);
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute(
      "href",
      /^https:\/\/vishalbg\.vercel\.app\/?$/,
    );
    expect(await page.locator("meta[name='robots']").getAttribute("content")).toContain("index");
    expect(await page.locator("meta[name='googlebot']").getAttribute("content")).toContain(
      "max-image-preview:large",
    );
    await expect(page.locator("meta[property='og:title']")).toHaveAttribute(
      "content",
      "Vishal B G — Full Stack Developer",
    );
    expect(await page.locator("meta[property='og:image']").getAttribute("content")).toContain(
      `${SITE}/opengraph-image`,
    );
    await expect(page.locator("meta[name='twitter:card']")).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
  });

  test("home exposes Person + WebSite + ProfilePage structured data", async ({ page }) => {
    await page.goto("/");
    const blocks = await jsonLd(page);
    expect(blocks).toHaveLength(1);
    const graph = blocks[0]!["@graph"];
    const person = graph.find((n) => n["@type"] === "Person")!;
    expect(person.name).toBe("Vishal B G");
    expect(person.sameAs).toEqual(["https://linkedin.com/in/vishalbg", "https://github.com/vishalbg02"]);
    expect(graph.map((n) => n["@type"])).toEqual(["Person", "WebSite", "ProfilePage"]);
    expect(JSON.stringify(graph)).not.toContain("@gmail.com");
  });

  test("every page has exactly one H1, a unique title and its own canonical URL", async ({ page }) => {
    const paths = ["/", "/work", "/resume", ...SLUGS.map((s) => `/work/${s}`)];
    const titles = new Set<string>();
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      titles.add(await page.title());
      const canonical = await page.locator("link[rel='canonical']").getAttribute("href");
      expect(
        canonical === `${SITE}${path}` || (path === "/" && canonical === SITE),
        `canonical for ${path}: ${canonical}`,
      ).toBe(true);
    }
    expect(titles.size).toBe(paths.length);
  });

  test("case studies carry CreativeWork + breadcrumb structured data and their own preview image", async ({
    page,
  }) => {
    for (const slug of SLUGS) {
      await page.goto(`/work/${slug}`);
      const [data] = await jsonLd(page);
      const types = data!["@graph"].map((n) => n["@type"]);
      expect(types).toEqual(["CreativeWork", "BreadcrumbList"]);
      const crumbs = (data!["@graph"][1] as { itemListElement: unknown[] }).itemListElement;
      expect(crumbs).toHaveLength(3);
      expect(await page.locator("meta[property='og:image']").getAttribute("content")).toContain(
        `/work/${slug}/opengraph-image`,
      );
    }
  });

  test("preview images are real 1200×630 PNGs", async ({ request }) => {
    for (const path of [
      "/opengraph-image",
      "/work/opengraph-image",
      "/resume/opengraph-image",
      ...SLUGS.map((s) => `/work/${s}/opengraph-image`),
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()["content-type"], path).toContain("image/png");
      const body = await res.body();
      expect(body.subarray(1, 4).toString(), path).toBe("PNG");
      expect(body.readUInt32BE(16), `${path} width`).toBe(1200);
      expect(body.readUInt32BE(20), `${path} height`).toBe(630);
      expect(body.length).toBeGreaterThan(3000);
    }
  });

  test("sitemap.xml lists every public page and robots.txt points to it", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/", "/work", "/resume", "/resume.pdf", ...SLUGS.map((s) => `/work/${s}`)]) {
      expect(xml, path).toContain(`<loc>${SITE}${path === "/" ? "/" : path}</loc>`);
    }
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots).toMatch(/Disallow: \/api\//);
    expect(robots).toMatch(/Allow: \//);
  });

  test("404 pages are not indexable", async ({ page }) => {
    await page.goto("/definitely-missing");
    expect(await page.locator("meta[name='robots']").first().getAttribute("content")).toContain("noindex");
  });
});
