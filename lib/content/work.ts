import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { profile } from "@/content/profile";
import { WorkFrontmatterSchema, type WorkFrontmatter } from "./work-schema";

/**
 * Case-study loader. All MDX access goes through here (Zod-validated frontmatter) so the
 * storage can be swapped (CMS, DB) without touching pages.
 */
export type CaseStudy = { frontmatter: WorkFrontmatter; body: string };

const DIR = path.join(process.cwd(), "content", "work");

export function parseCaseStudy(raw: string, expectedSlug: string): CaseStudy {
  const { data, content } = matter(raw);
  const frontmatter = WorkFrontmatterSchema.parse(data);
  if (frontmatter.slug !== expectedSlug) {
    throw new Error(`content/work/${expectedSlug}.mdx declares slug "${frontmatter.slug}"`);
  }
  return { frontmatter, body: content };
}

export async function getCaseStudy(slug: string): Promise<CaseStudy | null> {
  if (!profile.projects.some((p) => p.slug === slug)) return null;
  try {
    return parseCaseStudy(await readFile(path.join(DIR, `${slug}.mdx`), "utf8"), slug);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export const getAllCaseStudySlugs = () => profile.projects.map((p) => p.slug);

/** Previous/next project in the profile order, wrapping around. */
export function getAdjacentProjects(slug: string) {
  const list = profile.projects;
  const i = list.findIndex((p) => p.slug === slug);
  if (i === -1) return null;
  return { prev: list[(i - 1 + list.length) % list.length]!, next: list[(i + 1) % list.length]! };
}
