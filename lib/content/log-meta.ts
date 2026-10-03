import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Dependency-light helpers shared by the log loader and next.config.ts (which uses them to decide,
 * at build time, whether the nav/palette/sitemap should mention the Ship Log at all).
 */
export const LOG_DIR = path.join(process.cwd(), "content", "log");

type Env = Record<string, string | undefined>;

/**
 * Drafts show up in local dev, on Vercel previews, and when SHOW_DRAFTS=true (CI sets it so the
 * post template gets e2e coverage). A production build hides them.
 */
export function draftsVisible(env: Env = process.env): boolean {
  return env.SHOW_DRAFTS === "true" || env.NODE_ENV === "development" || env.VERCEL_ENV === "preview";
}

/** Number of posts a visitor would see. Reads frontmatter only. */
export function countVisiblePosts(dir: string = LOG_DIR, showDrafts: boolean = draftsVisible()): number {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".mdx"));
  } catch {
    return 0;
  }
  return files.filter((f) => {
    const { data } = matter(readFileSync(path.join(dir, f), "utf8"));
    return showDrafts || data.draft !== true;
  }).length;
}
