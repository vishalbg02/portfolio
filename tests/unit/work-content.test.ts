import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { snippets } from "@/content/work/snippets";
import { profile } from "@/content/profile";
import { graphs } from "@/components/diagram/graphs";
import { getAdjacentProjects, getCaseStudy, parseCaseStudy } from "@/lib/content/work";

const raw = (slug: string) => readFile(path.join(process.cwd(), "content", "work", `${slug}.mdx`), "utf8");

describe("case-study content", () => {
  it.each(profile.projects.map((p) => p.slug))("%s loads with valid frontmatter", async (slug) => {
    const study = await getCaseStudy(slug);
    expect(study).not.toBeNull();
    expect(study!.frontmatter.slug).toBe(slug);
  });

  it("returns null for unknown slugs", async () => {
    expect(await getCaseStudy("nope")).toBeNull();
    expect(await getCaseStudy("../profile")).toBeNull();
  });

  it("rejects a slug mismatch and bad frontmatter", () => {
    expect(() => parseCaseStudy("---\nslug: talnio\ndescription: x\n---\nbody", "talnio")).toThrow();
    const ok =
      "---\nslug: talnio\ndescription: A description that is long enough to pass the schema check.\nglance:\n  role: r\n  platform: p\n  status: s\n---\nbody";
    expect(() => parseCaseStudy(ok, "talnio")).not.toThrow();
    expect(() => parseCaseStudy(ok, "golden-verdict")).toThrow(/declares slug/);
  });

  it.each(profile.projects.map((p) => p.slug))(
    "%s follows problem → built → decisions → architecture → code → outcome",
    async (slug) => {
      const { body } = (await getCaseStudy(slug))!;
      const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      expect(headings).toEqual([
        "The problem",
        "What I built",
        "Key decisions",
        "Architecture",
        "Code in the wild",
        "Outcome",
      ]);
      const decisions = body.match(/<Decision\b/g) ?? [];
      expect(decisions.length).toBeGreaterThanOrEqual(2);
      expect(decisions.length).toBeLessThanOrEqual(3);
      expect(body).toContain("<Architecture />");
    },
  );

  it("every <Snippet id> exists and is for a real project", async () => {
    for (const p of profile.projects) {
      const { body } = (await getCaseStudy(p.slug))!;
      const ids = [...body.matchAll(/<Snippet id="([^"]+)"/g)].map((m) => m[1]!);
      expect(ids.length, `${p.slug} needs 1–2 snippets`).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(2);
      for (const id of ids) expect(snippets[id], `unknown snippet ${id}`).toBeDefined();
    }
  });

  it("every graph has a case study and vice versa", () => {
    expect(Object.keys(graphs).sort()).toEqual(profile.projects.map((p) => p.slug).sort());
  });

  it("links previous/next around the list", () => {
    const slugs = profile.projects.map((p) => p.slug);
    expect(getAdjacentProjects(slugs[0]!)!.prev.slug).toBe(slugs.at(-1));
    expect(getAdjacentProjects(slugs.at(-1)!)!.next.slug).toBe(slugs[0]);
    expect(getAdjacentProjects("nope")).toBeNull();
  });
});

describe("no invented facts", () => {
  // Every number in the long-form text must already appear in profile.ts (or be a heading/list index).
  const profileText = JSON.stringify(profile);
  const numbers = (text: string) => [...text.matchAll(/\d[\d.,]*\+?/g)].map((m) => m[0].replace(/[.,]$/, ""));
  const allowedFromProfile = new Set(numbers(profileText));
  // 360 (degrees), 256 (AES), 12/32 (nonce/key bytes) are technology constants, not claims about Vishal.
  const technologyConstants = new Set(["360", "256", "12", "32", "64", "6"]);

  it.each(profile.projects.map((p) => p.slug))(
    "%s MDX only uses numbers that come from profile.ts",
    async (slug) => {
      const { body } = (await getCaseStudy(slug))!;
      for (const n of numbers(body)) {
        expect(
          allowedFromProfile.has(n) || technologyConstants.has(n),
          `"${n}" in ${slug}.mdx is not in profile.ts`,
        ).toBe(true);
      }
    },
  );

  it("graph text only uses numbers from profile.ts", () => {
    for (const g of Object.values(graphs)) {
      for (const n of g.nodes) {
        for (const num of numbers(`${n.label} ${n.sub ?? ""} ${n.description}`)) {
          expect(
            allowedFromProfile.has(num) || technologyConstants.has(num),
            `"${num}" in graph ${g.slug}/${n.id}`,
          ).toBe(true);
        }
      }
    }
  });

  it("frontmatter descriptions contain no unexplained metrics", async () => {
    for (const p of profile.projects) {
      const { frontmatter } = parseCaseStudy(await raw(p.slug), p.slug);
      for (const n of numbers(frontmatter.description)) {
        expect(
          allowedFromProfile.has(n) || technologyConstants.has(n),
          `"${n}" in ${p.slug} description`,
        ).toBe(true);
      }
    }
  });
});
