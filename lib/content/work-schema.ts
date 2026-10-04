import "./zod-csp";
import { z } from "zod";
import { ProjectSlugSchema } from "./profile-schema";

/** Frontmatter of content/work/<slug>.mdx. Long-form prose lives in the MDX body. */
export const WorkFrontmatterSchema = z.object({
  slug: ProjectSlugSchema,
  /** SEO description for the case-study page. */
  description: z.string().trim().min(40).max(200),
  /** "At a glance" strip. */
  glance: z.object({
    role: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    status: z.string().trim().min(1),
  }),
  /** Notes for the owner, never rendered. */
  todo: z.array(z.string()).default([]),
});

export type WorkFrontmatter = z.infer<typeof WorkFrontmatterSchema>;
