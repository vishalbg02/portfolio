import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { graphs } from "@/components/diagram/graphs";
import { profile as defaultProfile } from "@/content/profile";
import type { Profile } from "@/lib/content/profile-schema";
import { workStatus } from "@/lib/content/work-status";
import { slugify } from "@/lib/utils/slugify";
import type { Chunk } from "./types";

/**
 * Builds the retrieval corpus from the SAME sources as the site (profile.ts + case-study MDX +
 * architecture graphs), so the assistant can never know something the site doesn't say.
 * Chunks are ~100–450 tokens (≈ chars / 4) with a citation URL and title.
 */
export const MAX_CHUNK_CHARS = 1800; // ≈ 450 tokens

const join = (parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(" ");

export function profileChunks(p: Profile = defaultProfile): Chunk[] {
  const chunks: Chunk[] = [];
  const { contact } = p;

  chunks.push({
    id: "about",
    title: `About ${p.name}`,
    url: "/",
    text: join([
      `${p.name} is a ${p.shortRole} based in ${p.location} (timezone ${p.timezone}).`,
      `${p.headline}.`,
      `Current status: ${p.status}.`,
      p.summary,
      `Target roles: ${p.targetRole.title}. Core skills for those roles: ${p.targetRole.coreSkills.join(", ")}.`,
      `Motto: "${p.motto}"`,
    ]),
  });

  // Right now: the question recruiters ask most. Derived, so it can never disagree with the timeline.
  const ws = workStatus(p);
  const studying = p.education.filter((e) => /pursuing|expected/i.test(`${e.note} ${e.period}`));
  chunks.push({
    id: "status",
    title: "Where Vishal is right now (current status)",
    url: "/now",
    text: join([
      "Current status, what he is doing now, where he works at the moment, and whether he is employed or available:",
      ws.sentence,
      `Availability: ${p.status}.`,
      studying.length
        ? `Studies: currently pursuing ${studying.map((e) => `${e.degree} at ${e.school} (${e.period})`).join("; ")}.`
        : null,
      `Based in ${p.location}.`,
    ]),
  });

  const wp = p.workPreferences;
  chunks.push({
    id: "preferences",
    title: "What roles he wants: availability, relocation, remote and start date",
    url: "/recruiter",
    text: join([
      `What ${p.name} is looking for (roles, job preferences, relocation, remote or hybrid work, notice period, start date):`,
      `Roles: ${wp.roles.join("; ")}.`,
      `Location: ${wp.locations}.`,
      `Work modes he is open to: ${wp.modes.join(", ")} (so remote, hybrid and relocation are all fine).`,
      `Start date and notice period: ${wp.startDate}.`,
      `Availability: ${p.status}.`,
    ]),
  });
  chunks.push({
    id: "strengths",
    title: "Strongest skills, what he is best at, and life outside work",
    url: "/#stack",
    text: join([
      `${p.name}'s strongest areas, in his own words: ${p.strongestAt}.`,
      `Core skills: ${p.targetRole.coreSkills.join(", ")}.`,
      p.outsideWork,
      `Languages spoken: ${p.languages.join(", ")}.`,
    ]),
  });
  chunks.push({
    id: "employers",
    title: "Work history: companies and roles",
    url: "/#experience",
    text: join([
      `Work history of ${p.name}, newest first (companies, employers, internships, roles and dates):`,
      ...p.experience.map(
        (e) => `${e.role} at ${e.company}, ${e.period}${e.current ? " (current)" : " (past role)"}.`,
      ),
      `Total professional experience so far consists of these internships; ${p.name} is also a student.`,
    ]),
  });

  p.experience.forEach((e, i) =>
    chunks.push({
      id: `experience-${i}`,
      title: `${e.role} at ${e.company.split(",")[0]} (${e.period})`,
      url: "/#experience",
      text: join([
        `${e.role} at ${e.company}, ${e.period}${e.current ? " (current role)" : " (past role, ended)"}.`,
        ...e.points,
      ]),
    }),
  );

  p.projects.forEach((pr) =>
    chunks.push({
      id: `project-${pr.slug}`,
      title: `${pr.name} — ${pr.tagline}`,
      url: `/work/${pr.slug}`,
      text: join([
        `${pr.name}: ${pr.tagline}. ${pr.type}.`,
        pr.summary,
        ...pr.highlights,
        `Stack: ${pr.stack.join(", ")}.`,
        pr.live ? `Live at ${pr.live}.` : pr.badge ? `${pr.badge}.` : null,
        pr.store ? `Available on Google Play: ${pr.store}.` : null,
        pr.repo ? `Source code: ${pr.repo}.` : null,
      ]),
    }),
  );

  const groups: Array<[string, string[]]> = [
    ["Backend", p.skills.backend],
    ["Frontend", p.skills.frontend],
    ["Mobile", p.skills.mobile],
    ["Data and cloud", p.skills.dataCloud],
    ["AI", p.skills.ai],
    ["Networking and security", p.skills.networking],
    ["Tools", p.skills.tools],
  ];
  groups.forEach(([label, items]) =>
    chunks.push({
      id: `skills-${slugify(label)}`,
      title: `${label} skills`,
      url: "/#stack",
      text: `${label} skills of ${p.name}: ${items.join(", ")}.`,
    }),
  );

  chunks.push({
    id: "education",
    title: "Education",
    url: "/#experience",
    text: `${p.education.map((e) => `${e.degree}, ${e.school}, ${e.period} — ${e.note}.`).join(" ")} ${p.skillsNote}`,
  });
  chunks.push({
    id: "certifications",
    title: "Certifications",
    url: "/resume",
    text: `Certifications: ${p.certifications.join("; ")}.`,
  });
  chunks.push({
    id: "recognition",
    title: "Hackathon wins and recognition",
    url: "/#github",
    text: join([
      ...p.recognition.map(
        (r) => `${r.place} — ${r.event}, ${r.org}${r.detail ? ` (${r.detail})` : ""}, ${r.date}.`,
      ),
      ...p.leadership,
    ]),
  });
  chunks.push({
    id: "contact",
    title: "How to contact Vishal",
    url: "/#contact",
    text: join([
      `Contact ${p.name}: email ${contact.email}, phone ${contact.phone}, WhatsApp ${contact.whatsapp}, LinkedIn ${contact.linkedin}, GitHub ${contact.github}.`,
      "There is also a contact form on the site; he usually replies within a few hours (Bengaluru, IST).",
    ]),
  });
  chunks.push({
    id: "personal",
    title: "Languages and personal facts",
    url: "/resume",
    text: join([
      `Languages spoken: ${p.languages.join(", ")}.`,
      `Based in ${p.location}, time zone ${p.timezone} (IST).`,
      `Motto: "${p.motto}"`,
    ]),
  });
  chunks.push({
    id: "site",
    title: "How this portfolio website is built",
    url: "/",
    text: [
      `This portfolio website was designed and built by ${p.name}.`,
      "It uses Next.js (App Router, static pages), React, TypeScript and Tailwind CSS, and is deployed on Vercel.",
      "GRID is the site's AI: it answers only from the site's own content using retrieval (keyword search plus embeddings) with a Gemini model, falling back to a Groq model if Gemini is unavailable, and without any model it falls back to showing relevant passages. It can also show projects, architecture diagrams and walkthroughs, match a pasted job description, and take a visitor to a section.",
      "Other features: a job-description matcher on the résumé page, a one-page Recruiter Mode, an Omnibar for commands and questions (Ctrl or Cmd + K, or /), live project status badges, a live GitHub contribution calendar, and a downloadable ATS-friendly résumé PDF.",
    ].join(" "),
  });

  return chunks;
}

/** MDX → plain text: `<Decision …/>` becomes a sentence, other JSX (diagram, snippets) is dropped. */
export function mdxToText(body: string): string {
  return body
    .replace(/<Decision\s+([\s\S]*?)\/>/g, (_m, attrs: string) => {
      const get = (k: string) => attrs.match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? "";
      return `Decision: ${get("title")}. Why: ${get("why")} Trade-off: ${get("tradeoff")}\n\n`;
    })
    .replace(/<Snippet[^>]*\/>/g, "")
    .replace(/<Architecture\s*\/>/g, "")
    .replace(/<\/?Decisions>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split text at paragraph boundaries into pieces ≤ max chars (a single huge paragraph is hard-cut). */
export function splitText(text: string, max = MAX_CHUNK_CHARS): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length + 2 > max) {
      out.push(cur);
      cur = "";
    }
    if (para.length > max) {
      for (let i = 0; i < para.length; i += max) out.push(para.slice(i, i + max));
    } else {
      cur = cur ? `${cur}\n\n${para}` : para;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function caseStudyChunks(slug: string, name: string, raw: string): Chunk[] {
  const { content } = matter(raw);
  const chunks: Chunk[] = [];
  const sections = content.split(/^## /m).slice(1);
  for (const section of sections) {
    const [heading, ...rest] = section.split("\n");
    // "Code in the wild" is only an intro to illustrative snippets — not a fact about Vishal.
    if (/^code in the wild/i.test(heading!.trim())) continue;
    const text = mdxToText(rest.join("\n"));
    if (!text) continue;
    const anchor = slugify(heading!.trim());
    splitText(text).forEach((piece, i, all) =>
      chunks.push({
        id: `case-${slug}-${anchor}${all.length > 1 ? `-${i + 1}` : ""}`,
        title: `${name} — ${heading!.trim()}`,
        url: `/work/${slug}#${anchor}`,
        text: `${name} case study, ${heading!.trim()}: ${piece}`,
      }),
    );
  }
  const g = graphs[slug as keyof typeof graphs];
  if (g) {
    chunks.push({
      id: `case-${slug}-architecture-nodes`,
      title: `${name} — Architecture components`,
      url: `/work/${slug}#architecture`,
      text: `${name} architecture, component by component: ${g.nodes.map((n) => `${n.label} — ${n.description}`).join(" ")}`,
    });
  }
  return chunks;
}

export async function buildCorpus(root = process.cwd(), p: Profile = defaultProfile): Promise<Chunk[]> {
  const chunks = profileChunks(p);
  for (const project of p.projects) {
    const raw = await readFile(path.join(root, "content", "work", `${project.slug}.mdx`), "utf8");
    chunks.push(...caseStudyChunks(project.slug, project.name, raw));
  }
  const ids = chunks.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate chunk ids in the RAG corpus");
  return chunks;
}
