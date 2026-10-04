import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { parseCaseStudy } from "@/lib/content/work";
import { extractHeadings } from "@/lib/content/headings";

describe("extractHeadings", () => {
  it("lists ## headings with the ids the h2 renderer produces", () => {
    expect(
      extractHeadings("# Title\n\n## The problem\ntext\n### Sub\n## Key decisions & trade-offs\n"),
    ).toEqual([
      { id: "the-problem", title: "The problem" },
      { id: "key-decisions-and-trade-offs", title: "Key decisions & trade-offs" },
    ]);
  });
  it("ignores headings inside fenced code", () => {
    expect(extractHeadings("## Real\n```bash\n## not a heading\n```\n## Also real")).toHaveLength(2);
  });
  it("every case study has the sections the rail links to, in order, with unique ids", () => {
    for (const { slug } of profile.projects) {
      const raw = readFileSync(path.join(process.cwd(), "content", "work", `${slug}.mdx`), "utf8");
      const ids = extractHeadings(parseCaseStudy(raw, slug).body).map((h) => h.id);
      expect(new Set(ids).size, slug).toBe(ids.length);
      for (const must of ["the-problem", "try-it", "key-decisions", "architecture", "outcome"])
        expect(ids, slug).toContain(must);
      expect(ids.indexOf("try-it")).toBeLessThan(ids.indexOf("key-decisions"));
    }
  });
});
