import "./zod-csp";
import { z } from "zod";

/**
 * Schema for content/profile.ts — the single source of truth for every fact on the site,
 * the AI assistant's knowledge and the generated résumé.
 *
 * Unknown values are `null` (marked TODO(vishal) in the data file) and the UI hides them.
 */

const url = z.url({ protocol: /^https?$/ });
const nonEmpty = z.string().trim().min(1);

export const ProjectSlugSchema = z.enum(["golden-verdict", "talnio", "lansymphony", "virtual-tour"]);
export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;

export const ProjectSchema = z.object({
  slug: ProjectSlugSchema,
  name: nonEmpty,
  tagline: nonEmpty,
  type: nonEmpty,
  period: nonEmpty.nullable(),
  /** Shown instead of a live-status badge when there is no public URL to probe. */
  badge: nonEmpty.nullable(),
  live: url.nullable(),
  /** App-store listing (e.g. Google Play), shown as its own link. Not probed for status. */
  store: url.nullable(),
  repo: url.nullable(),
  stack: z.array(nonEmpty).min(1),
  summary: nonEmpty,
  highlights: z.array(nonEmpty).min(1),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ExperienceSchema = z.object({
  role: nonEmpty,
  company: nonEmpty,
  /** The short name people know the work by ("Cove IoT"), used on the Stack map and in cards. */
  short: nonEmpty,
  period: nonEmpty,
  current: z.boolean(),
  /** How he worked there; drives the wording ("internship", "freelance") on the site, in the AI and in the terminal. */
  kind: z.enum(["internship", "freelance", "full-time"]),
  points: z.array(nonEmpty).min(1),
  /**
   * What he used in this role, for the Stack map and GRID. Every item must be named in `points` (a unit test checks
   * it), so a role can never be credited with something its own description does not say.
   */
  stack: z.array(nonEmpty),
});
export type Experience = z.infer<typeof ExperienceSchema>;

export const EducationSchema = z.object({
  degree: nonEmpty,
  school: nonEmpty,
  period: nonEmpty,
  note: nonEmpty,
});

export const RecognitionSchema = z.object({
  place: nonEmpty,
  event: nonEmpty,
  org: nonEmpty,
  date: nonEmpty,
  detail: nonEmpty.nullable(),
});
export type Recognition = z.infer<typeof RecognitionSchema>;

export const SkillsSchema = z.object({
  backend: z.array(nonEmpty),
  frontend: z.array(nonEmpty),
  mobile: z.array(nonEmpty),
  dataCloud: z.array(nonEmpty),
  ai: z.array(nonEmpty),
  networking: z.array(nonEmpty),
  tools: z.array(nonEmpty),
});
export type SkillGroup = keyof z.infer<typeof SkillsSchema>;

export const ProfileSchema = z
  .object({
    name: nonEmpty,
    headline: nonEmpty,
    shortRole: nonEmpty,
    location: nonEmpty,
    timezone: nonEmpty,
    status: nonEmpty,
    /** 2–3 sentence summary for the résumé. Must restate facts that exist elsewhere in this file. */
    summary: nonEmpty,
    targetRole: z.object({
      title: nonEmpty,
      coreSkills: z.array(nonEmpty).min(1),
    }),
    contact: z.object({
      phone: nonEmpty,
      phoneHref: z.string().regex(/^tel:\+\d+$/),
      whatsapp: url,
      email: z.email(),
      collegeEmail: z.email(),
      linkedin: url,
      github: url,
      /** His Cal.com booking page (only cal.com is accepted), or null until he sets one. */
      calLink: url
        .nullable()
        .refine(
          (v) => v === null || /^https:\/\/(?:[a-z0-9-]+\.)?cal\.com\//.test(v),
          "calLink must be a https://cal.com/… link",
        ),
    }),
    education: z.array(EducationSchema).min(1),
    experience: z.array(ExperienceSchema).min(1),
    projects: z.array(ProjectSchema).length(4),
    recognition: z.array(RecognitionSchema),
    leadership: z.array(nonEmpty),
    /** Where the skills that no project or role shows were learned (stated by Vishal). */
    skillsNote: nonEmpty,
    skills: SkillsSchema,
    certifications: z.array(nonEmpty),
    languages: z.array(nonEmpty),
    motto: nonEmpty,
    /** What he is looking for. Feeds /recruiter, /now and the AI assistant. */
    workPreferences: z.object({
      locations: nonEmpty,
      modes: z.array(nonEmpty).min(1),
      startDate: nonEmpty,
      roles: z.array(nonEmpty).min(1),
    }),
    strongestAt: nonEmpty,
    outsideWork: nonEmpty,
  })
  .superRefine((p, ctx) => {
    const slugs = p.projects.map((x) => x.slug);
    if (new Set(slugs).size !== slugs.length) {
      ctx.addIssue({ code: "custom", message: "Project slugs must be unique", path: ["projects"] });
    }
  });

export type Profile = z.infer<typeof ProfileSchema>;
