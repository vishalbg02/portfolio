import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { breadcrumbNode, homeJsonLd, pageJsonLd, personNode, projectJsonLd } from "@/lib/seo/jsonld";
import { HOME_DESCRIPTION, HOME_TITLE, pageMetadata } from "@/lib/seo/metadata";
import sitemap from "@/app/sitemap";
import { site } from "@/lib/site";

const walk = (v: unknown, fn: (k: string, v: unknown) => void) => {
  if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (fn(k, x), walk(x, fn));
};

describe("JSON-LD", () => {
  it("describes the Person from profile.ts and exposes no email or phone", () => {
    const p = personNode();
    expect(p).toMatchObject({
      "@type": "Person",
      name: "Vishal B G",
      jobTitle: "Full Stack Developer",
      url: site.url,
    });
    expect(p.sameAs).toEqual([profile.contact.linkedin, profile.contact.github]);
    expect(p.alumniOf.name).toContain("CHRIST");
    expect(p.worksFor).toEqual({ "@type": "Organization", name: "Social Agent (Bricstal Pvt. Ltd.)" });
    const text = JSON.stringify(homeJsonLd());
    expect(text).not.toContain(profile.contact.email);
    expect(text).not.toContain(profile.contact.collegeEmail);
    expect(text).not.toContain("96639");
  });

  it("home graph links Person, WebSite and ProfilePage by @id", () => {
    const g = homeJsonLd()["@graph"];
    expect(g.map((n) => n["@type"])).toEqual(["Person", "WebSite", "ProfilePage"]);
    const ids = new Set(g.map((n) => n["@id"]));
    expect(ids.size).toBe(3);
    expect((g[2] as { mainEntity: { "@id": string } }).mainEntity["@id"]).toBe(g[0]!["@id"]);
  });

  it.each(profile.projects)(
    "project JSON-LD for $slug has absolute URLs and a 3-level breadcrumb",
    (project) => {
      const g = projectJsonLd(project, "A description.")["@graph"];
      const work = g[0] as Record<string, unknown>;
      expect(work["@type"]).toBe("CreativeWork");
      expect(work.url).toBe(`${site.url}/work/${project.slug}`);
      expect(work.keywords).toBe(project.stack.join(", "));
      if (project.live) expect(work.sameAs).toEqual([project.live]);
      else expect(work.sameAs).toBeUndefined();
      const crumbs = (g[1] as { itemListElement: Array<{ position: number; item: string }> }).itemListElement;
      expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3]);
      expect(crumbs.every((c) => c.item.startsWith(site.url))).toBe(true);
    },
  );

  it("never emits undefined/null values (invalid JSON-LD)", () => {
    for (const data of [
      homeJsonLd(),
      pageJsonLd("Résumé", "/resume", [{ name: "Home", path: "/" }]),
      ...profile.projects.map((p) => projectJsonLd(p, "d")),
    ]) {
      walk(data, (k, v) => expect(v === undefined || v === null, `${k} is ${String(v)}`).toBe(false));
      expect(() => JSON.parse(JSON.stringify(data))).not.toThrow();
    }
    expect(breadcrumbNode([]).itemListElement).toEqual([]);
  });
});

describe("metadata", () => {
  it("keeps the home title and description at search-friendly lengths, with the name first", () => {
    expect(HOME_TITLE).toBe("Vishal B G — Full Stack Developer");
    expect(HOME_DESCRIPTION.length).toBeGreaterThanOrEqual(110);
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(HOME_DESCRIPTION.startsWith("Vishal B G")).toBe(true);
  });

  it("states only facts that exist in profile.ts", () => {
    for (const word of [
      "Java",
      "Spring Boot",
      "React",
      "Next.js",
      "SQL",
      "Talnio",
      "Golden Verdict",
      "CHRIST",
      "Bengaluru",
    ]) {
      expect(HOME_DESCRIPTION).toContain(word);
    }
    expect(profile.skills.backend).toContain("Spring Boot");
    expect(profile.skills.frontend).toContain("Next.js");
  });

  it("gives every page a canonical path", () => {
    const m = pageMetadata({ title: "Work", description: "x", path: "/work" });
    expect(m.alternates?.canonical).toBe("/work");
  });
});

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);
  it("lists the home page, work pages, résumé page and PDF with absolute URLs", () => {
    expect(urls).toContain(`${site.url}/`);
    expect(urls).toContain(`${site.url}/work`);
    expect(urls).toContain(`${site.url}/resume`);
    expect(urls).toContain(`${site.url}/resume.pdf`);
    for (const p of profile.projects) expect(urls).toContain(`${site.url}/work/${p.slug}`);
    expect(urls.every((u) => u.startsWith("https://"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
