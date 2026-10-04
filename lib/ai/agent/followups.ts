import { MODE_SUGGESTIONS, type GridMode } from "../modes";
import type { Source, UiPart } from "../protocol";
import { graphs } from "@/components/diagram/graphs";
import { projectBySlug } from "@/content/profile";

/**
 * Three suggested next questions, chosen from what was just shown or cited (no extra model call, so no
 * extra latency, cost or quota). Every suggestion is something GRID can answer or show from the content.
 */
const SLUG_IN_URL = /\/work\/([a-z-]+)/;

export function suggestFollowUps(opts: {
  mode?: GridMode;
  question: string;
  sources?: Source[];
  parts?: UiPart[];
}): string[] {
  const { mode = "default", question, sources = [], parts = [] } = opts;
  const out: string[] = [];
  const push = (s: string) => {
    if (!out.includes(s) && s.toLowerCase() !== question.trim().toLowerCase()) out.push(s);
  };

  const slugs: string[] = [];
  for (const p of parts) if ("slug" in p && typeof p.slug === "string") slugs.push(p.slug);
  for (const s of sources) {
    const m = SLUG_IN_URL.exec(s.url);
    if (m) slugs.push(m[1]!);
  }
  const slug = slugs.find((s) => projectBySlug(s));
  const kinds = new Set(parts.map((p) => p.kind));

  if (slug) {
    const name = projectBySlug(slug)!.name;
    if (!kinds.has("project")) push(`Show me ${name}`);
    if (!kinds.has("diagram") && slug in graphs) push(`Show the ${name} architecture`);
    push(`What were the key decisions in ${name}?`);
    if (!kinds.has("demo")) push(`Play the ${name} walkthrough`);
  }
  if (kinds.has("contact")) {
    push("Which roles is he looking for?");
    push("Is he available to start soon?");
  }
  if (kinds.has("stats")) push("How is this site built?");
  if (kinds.has("skill")) push("Show me his projects");
  if (kinds.has("match")) push("Which roles is he looking for?");
  if (mode === "recruiter") {
    push("Is he a fit for a full-stack role?");
    push("How can I contact him?");
  }
  for (const s of MODE_SUGGESTIONS[mode]) push(s);
  return out.slice(0, 3);
}
