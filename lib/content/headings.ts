import { slugify } from "@/lib/utils/slugify";

export type Heading = { id: string; title: string };

/**
 * The `##` headings of an MDX body, in order, with the same ids the h2 renderer gives them
 * (components/mdx/components.tsx). Fenced code is skipped so a `## comment` in a snippet isn't a heading.
 */
export function extractHeadings(body: string): Heading[] {
  const out: Heading[] = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ id: slugify(m[1]!), title: m[1]!.trim() });
  }
  return out;
}
