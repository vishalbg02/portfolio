import { resumeConfig as defaultConfig } from "@/content/resume";
import { profile as defaultProfile } from "@/content/profile";
import type { Profile } from "@/lib/content/profile-schema";
import { site } from "@/lib/site";
import { smart } from "@/lib/text/typography";
import type { ResumeConfig } from "./config-schema";

/**
 * One résumé model feeds both the HTML /resume page and the generated PDF, so they cannot drift
 * apart. Shared facts come from content/profile.ts; résumé-only wording from content/resume.ts.
 * Sections use the standard headings ATS parsers look for, in the order recruiters read them:
 * Summary, Work Experience, Projects, Technical Skills, Education, Certifications, Achievements,
 * Leadership.
 */
export const RESUME_FILENAME = "Vishal_BG_Resume.pdf";

export type ContactItem = { text: string; href: string | null };

export type ResumeModel = {
  name: string;
  subtitle: string;
  contact: ContactItem[];
  updatedAt: string;
  summary: string;
  experience: Array<{ org: string; period: string; role: string; bullets: string[] }>;
  projects: Array<{ title: string; stack: string; date: string; bullets: string[] }>;
  skills: Array<{ label: string; text: string }>;
  certifications: Array<{ title: string; org: string; year: string }>;
  leadership: Array<{ title: string; date: string; role: string; bullets: string[] }>;
  achievements: Array<{ title: string; detail: string; date: string }>;
  education: Array<{ school: string; period: string; line: string }>;
};

export const RESUME_SECTION_TITLES = {
  summary: "Professional Summary",
  experience: "Work Experience",
  projects: "Projects",
  skills: "Technical Skills",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements & Awards",
  leadership: "Leadership & Activities",
} as const;

const stripProtocol = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** "AWS Academy Cloud Foundations — Amazon Web Services (2025)" → title / org / year. */
export function parseCertification(raw: string): { title: string; org: string; year: string } {
  const m = raw.match(/^(.+?)\s+[—–-]\s+(.+?)\s+\((\d{4})\)$/);
  if (!m) throw new Error(`Certification "${raw}" must look like "Title — Issuer (YYYY)"`);
  return { title: m[1]!, org: m[2]!, year: m[3]! };
}

export function buildResumeModel(p: Profile = defaultProfile, c: ResumeConfig = defaultConfig): ResumeModel {
  const email = c.header.email === "college" ? p.contact.collegeEmail : p.contact.email;
  const model: ResumeModel = {
    name: p.name,
    subtitle: c.header.subtitle,
    contact: [
      { text: email, href: `mailto:${email}` },
      { text: p.contact.phone, href: p.contact.phoneHref },
      { text: stripProtocol(p.contact.linkedin), href: p.contact.linkedin },
      { text: stripProtocol(p.contact.github), href: p.contact.github },
      { text: stripProtocol(site.url), href: site.url },
      { text: c.header.location, href: null },
    ],
    updatedAt: c.updatedAt,
    summary: p.summary,
    experience: p.experience.map((e) => ({
      org: e.company,
      period: e.period,
      role: e.kind === "freelance" ? `${e.role} (Freelance)` : e.role,
      bullets: e.points,
    })),
    projects: c.projects.map(({ title, stack, date, bullets }) => ({ title, stack, date, bullets })),
    skills: c.skills.map((g) => ({ label: g.label, text: g.items.join(", ") })),
    certifications: p.certifications.map(parseCertification),
    leadership: c.leadership,
    achievements: c.achievements,
    education: p.education.map((e) => ({
      school: e.school,
      period: e.period,
      line: `${e.degree} | ${e.note}`,
    })),
  };
  return smartenModel(model);
}

/** Curly quotes everywhere in printed output (boAt's → boAt’s). */
function smartenModel<T>(value: T): T {
  if (typeof value === "string") return smart(value) as T;
  if (Array.isArray(value)) return value.map(smartenModel) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, k === "href" ? v : smartenModel(v)]),
    ) as T;
  }
  return value;
}
