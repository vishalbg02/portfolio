import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { slugify } from "@/lib/utils/slugify";
import { PostFrontmatterSchema, type PostFrontmatter } from "./log-schema";
import { LOG_DIR, draftsVisible } from "./log-meta";

/**
 * Ship Log loader. All post access goes through here (Zod-validated frontmatter), so the storage
 * can change without touching pages.
 */
export type TocItem = { id: string; text: string; level: 2 | 3 };
export type Post = { frontmatter: PostFrontmatter; body: string; minutes: number; toc: TocItem[] };

const WORDS_PER_MINUTE = 200;

export function readingMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** h2/h3 headings (outside code fences) → table of contents with the same ids the MDX renders. */
export function extractToc(body: string): TocItem[] {
  const toc: TocItem[] = [];
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith("```")) fenced = !fenced;
    if (fenced) continue;
    const m = line.match(/^(##|###)\s+(.+?)\s*$/);
    if (m) toc.push({ id: slugify(m[2]!), text: m[2]!, level: m[1] === "##" ? 2 : 3 });
  }
  return toc;
}

export function parsePost(raw: string, expectedSlug: string): Post {
  const { data, content } = matter(raw);
  const frontmatter = PostFrontmatterSchema.parse(data);
  if (frontmatter.slug !== expectedSlug) {
    throw new Error(`content/log/${expectedSlug}.mdx declares slug "${frontmatter.slug}"`);
  }
  return { frontmatter, body: content, minutes: readingMinutes(content), toc: extractToc(content) };
}

/** Newest first. Drafts are included only where draftsVisible() says so (or when forced). */
export async function getAllPosts(includeDrafts: boolean = draftsVisible()): Promise<Post[]> {
  let files: string[];
  try {
    files = (await readdir(LOG_DIR)).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
  const posts = await Promise.all(
    files.map(async (f) => parsePost(await readFile(path.join(LOG_DIR, f), "utf8"), f.replace(/\.mdx$/, ""))),
  );
  return posts
    .filter((p) => includeDrafts || !p.frontmatter.draft)
    .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date));
}

export async function getPost(slug: string): Promise<Post | null> {
  return (await getAllPosts()).find((p) => p.frontmatter.slug === slug) ?? null;
}

export function adjacentPosts(posts: Post[], slug: string) {
  const i = posts.findIndex((p) => p.frontmatter.slug === slug);
  if (i === -1) return { newer: null, older: null };
  return { newer: posts[i - 1] ?? null, older: posts[i + 1] ?? null };
}
