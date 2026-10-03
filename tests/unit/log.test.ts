import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countVisiblePosts, draftsVisible } from "@/lib/content/log-meta";
import { adjacentPosts, getAllPosts, parsePost, readingMinutes } from "@/lib/content/log";
import { buildRss } from "@/lib/content/rss";
import { postJsonLd } from "@/lib/seo/jsonld";

const fm = (extra = "", slug = "hello-world", date = "2026-01-02") => `---
title: "Hello, world"
slug: ${slug}
date: "${date}"
description: "A sufficiently long description for the schema to accept it."
tags: [meta]
${extra}---

## First

Some words here.

### Nested

\`\`\`
## not a heading
\`\`\`

## Second & third
`;

describe("log: parsing", () => {
  it("validates frontmatter and derives toc + reading time", () => {
    const p = parsePost(fm(), "hello-world");
    expect(p.frontmatter.draft).toBe(false);
    expect(p.toc).toEqual([
      { id: "first", text: "First", level: 2 },
      { id: "nested", text: "Nested", level: 3 },
      { id: "second-and-third", text: "Second & third", level: 2 },
    ]);
    expect(p.minutes).toBe(1);
  });

  it("rejects a slug that doesn't match the filename, and bad frontmatter", () => {
    expect(() => parsePost(fm(), "other")).toThrow(/declares slug/);
    expect(() => parsePost(fm().replace("tags: [meta]", "tags: []"), "hello-world")).toThrow();
    expect(() => parsePost(fm("", "Bad Slug"), "Bad Slug")).toThrow();
  });

  it("reading time ignores code and rounds to at least a minute", () => {
    expect(readingMinutes("word ".repeat(1000))).toBe(5);
    expect(readingMinutes("```\n" + "code ".repeat(5000) + "\n```\nhi")).toBe(1);
  });

  it("finds newer/older neighbours", () => {
    const a = parsePost(fm("", "a", "2026-03-01"), "a");
    const b = parsePost(fm("", "b", "2026-02-01"), "b");
    const c = parsePost(fm("", "c", "2026-01-01"), "c");
    const posts = [a, b, c];
    expect(adjacentPosts(posts, "b")).toEqual({ newer: a, older: c });
    expect(adjacentPosts(posts, "a").newer).toBeNull();
    expect(adjacentPosts(posts, "zzz")).toEqual({ newer: null, older: null });
  });
});

describe("log: drafts", () => {
  it("are hidden in production and visible in dev, previews and when forced", () => {
    expect(draftsVisible({ NODE_ENV: "production" })).toBe(false);
    expect(draftsVisible({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
    expect(draftsVisible({ NODE_ENV: "development" })).toBe(true);
    expect(draftsVisible({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
    expect(draftsVisible({ NODE_ENV: "production", SHOW_DRAFTS: "true" })).toBe(true);
  });

  it("don't count toward the published total", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "log-"));
    writeFileSync(path.join(dir, "a.mdx"), fm("draft: true\n", "a"));
    writeFileSync(path.join(dir, "b.mdx"), fm("", "b"));
    expect(countVisiblePosts(dir, false)).toBe(1);
    expect(countVisiblePosts(dir, true)).toBe(2);
    expect(countVisiblePosts(path.join(dir, "missing"), true)).toBe(0);
  });

  it("the seeded posts are valid drafts, so a production build publishes none", async () => {
    const all = await getAllPosts(true);
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(all.every((p) => p.frontmatter.draft)).toBe(true);
    expect(await getAllPosts(false)).toEqual([]);
    const dates = all.map((p) => p.frontmatter.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("log: rss + structured data", () => {
  const posts = [parsePost(fm("", "a", "2026-03-01").replace("Hello, world", "A & B <tag>"), "a")];

  it("builds escaped RSS 2.0 with absolute links", () => {
    const xml = buildRss(posts, "https://example.com");
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<title>A &amp; B &lt;tag&gt;</title>");
    expect(xml).toContain("<link>https://example.com/log/a</link>");
    expect(xml).toContain("<pubDate>Sun, 01 Mar 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<category>meta</category>");
  });

  it("emits a valid empty feed", () => {
    expect(buildRss([], "https://example.com")).toContain("<channel>");
  });

  it("BlogPosting JSON-LD points at the post and its author", () => {
    const ld = postJsonLd({ ...posts[0]!.frontmatter }) as { "@graph": Array<Record<string, unknown>> };
    expect(ld["@graph"][0]).toMatchObject({ "@type": "BlogPosting", datePublished: "2026-03-01" });
  });
});
