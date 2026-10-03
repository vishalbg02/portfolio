import { z } from "zod";

/** Frontmatter of content/log/<slug>.mdx. */
export const PostFrontmatterSchema = z.object({
  title: z.string().trim().min(5).max(90),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case only"),
  date: z.iso.date(),
  updated: z.iso.date().optional(),
  description: z.string().trim().min(40).max(200),
  tags: z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .min(1)
    .max(5),
  /** Drafts are hidden from production builds (see lib/content/log-meta.ts). */
  draft: z.boolean().default(false),
  /** Notes for the owner, never rendered. */
  todo: z.array(z.string()).default([]),
});

export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>;
