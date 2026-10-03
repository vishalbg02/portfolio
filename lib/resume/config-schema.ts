import { z } from "zod";
import { ProjectSlugSchema } from "@/lib/content/profile-schema";

const text = z.string().trim().min(1);

/**
 * Schema for content/resume.ts — the résumé-ONLY layer.
 * Facts shared with the website (experience, education, certifications, contact, languages)
 * come from content/profile.ts, so you only ever update them once.
 */
export const ResumeConfigSchema = z.object({
  /** Shown on /resume as "Last updated". Bump it whenever you change the résumé. */
  updatedAt: z.iso.date(),
  header: z.object({
    /** Line under the name, e.g. degree | batch | college. */
    subtitle: text,
    location: text,
    /** Which address prints on the résumé. */
    email: z.enum(["college", "primary"]),
  }),
  projects: z
    .array(
      z.object({
        slug: ProjectSlugSchema,
        title: text,
        stack: text,
        /** Month/year or a label such as "Freelance". */
        date: text,
        bullets: z.array(text).min(1).max(3),
      }),
    )
    .min(1),
  /** Projects intentionally left off the résumé (with the reason), so a new project can't be forgotten. */
  omittedProjects: z.array(z.object({ slug: ProjectSlugSchema, reason: text })),
  skills: z.array(z.object({ label: text, items: z.array(text).min(1) })).min(1),
  leadership: z.array(
    z.object({ title: text, date: text, role: text, bullets: z.array(text).min(1).max(2) }),
  ),
  achievements: z.array(z.object({ title: text, detail: text, date: text })).min(1),
});

export type ResumeConfig = z.infer<typeof ResumeConfigSchema>;
