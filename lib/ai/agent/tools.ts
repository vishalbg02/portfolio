import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { ProjectSlugSchema } from "@/lib/content/profile-schema";
import { NAV_TARGET_IDS, resolveTarget } from "@/lib/grid/targets";
import { runMatch } from "@/lib/match/run";
import { getRetriever } from "@/lib/rag/store";
import { getStatuses } from "@/lib/status/cache";
import { LIMITS } from "../limits";
import type { ToolName, UiPart } from "../protocol";
import {
  contactCard,
  demoPart,
  diagramPart,
  navigatePart,
  projectCard,
  skillEvidence,
  statsPart,
} from "./cards";
import { embedQuery, inScope, SCOPES } from "./retrieval";
import type { SourceRegistry } from "./sources";

/**
 * GRID's tools. Every tool is read-only and returns `{ part, summary }`: `part` is the card the visitor sees
 * (built from content, see cards.ts), `summary` is the short text the MODEL sees (toModelOutput), so a card's
 * payload never has to pass through the model. Inputs are Zod-validated, so the model cannot pass anything the
 * schema doesn't allow (a slug is one of four, a navigation target one of a fixed list).
 */
export type ToolResult = { part: UiPart | null; summary: string; error?: boolean };

export type ToolContext = { sources: SourceRegistry };

const result = (r: ToolResult): ToolResult => r;
const modelText = (o: ToolResult) => ({ type: "text" as const, value: o.summary });

const slug = ProjectSlugSchema.describe("The project: golden-verdict, talnio, lansymphony or virtual-tour");

export function buildTools(ctx: ToolContext) {
  const tools = {
    search_profile: tool({
      description:
        "Search the facts on Vishal's portfolio (projects, case studies, experience, skills, education, awards, contact). The ONLY source of facts about him. Returns numbered passages to cite like [n].",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(200),
        scope: z.enum(SCOPES).optional().describe("Limit to one area; omit for everything"),
      }),
      execute: async ({ query, scope }): Promise<ToolResult> => {
        const retriever = getRetriever();
        const found = retriever.retrieve(query, 8, await embedQuery(query));
        const pick = found.results.filter((r) => inScope(r.chunk.id, scope ?? "all")).slice(0, 4);
        if (pick.length === 0 || found.coverage < 0.2)
          return result({ part: null, summary: "No passage on this site covers that." });
        const numbered = ctx.sources.add(pick.map((r) => r.chunk));
        return result({
          part: null,
          summary: numbered.map((p) => `[${p.n}] ${p.title}\n${p.text}`).join("\n\n"),
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    navigate: tool({
      description:
        "Scroll to a section or open a page of the site for the visitor (work, experience, stack, activity, contact, resume, recruiter, now, privacy, or a project's case study).",
      inputSchema: z.object({ target: z.enum(NAV_TARGET_IDS) }),
      execute: async ({ target }): Promise<ToolResult> => {
        const part = navigatePart(target);
        return part
          ? result({ part, summary: `Taking the visitor to: ${resolveTarget(target)!.label}.` })
          : result({ part: null, summary: "That page does not exist.", error: true });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    show_project: tool({
      description: "Show a project card in the chat: name, tagline, stack, a real capture and its links.",
      inputSchema: z.object({ slug }),
      execute: async ({ slug }): Promise<ToolResult> => {
        const part = projectCard(slug);
        if (!part) return result({ part: null, summary: "No such project.", error: true });
        const n = ctx.sources.addLink(
          `project-${slug}`,
          `${part.kind === "project" ? part.name : slug} — case study`,
          `/work/${slug}`,
        );
        return result({
          part,
          summary: `Showed the ${slug} project card (cite as [${n}] if you describe it).`,
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    play_demo: tool({
      description:
        "Open a project's walkthrough on the Work stage and play it. Optional beat number (1-based) to start at a specific step.",
      inputSchema: z.object({ slug, beat: z.number().int().min(1).max(4).optional() }),
      execute: async ({ slug, beat }): Promise<ToolResult> => {
        const part = demoPart(slug, beat);
        return part
          ? result({ part, summary: `Opened the ${slug} walkthrough on the Work stage.` })
          : result({ part: null, summary: "No such project.", error: true });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    show_diagram: tool({
      description: "Show a project's architecture diagram in the chat and run its request animation.",
      inputSchema: z.object({ slug }),
      execute: async ({ slug }): Promise<ToolResult> => {
        const part = diagramPart(slug);
        return part
          ? result({ part, summary: `Showed the ${slug} architecture diagram.` })
          : result({ part: null, summary: "No diagram for that project.", error: true });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    show_skill_evidence: tool({
      description:
        "Show where Vishal used a skill (projects, roles, the skills list), with links. Use for 'where did he use X', 'show his X work'.",
      inputSchema: z.object({ skill: z.string().trim().min(1).max(40) }),
      execute: async ({ skill }): Promise<ToolResult> => {
        const part = skillEvidence(skill);
        if (part.kind !== "skill") return result({ part: null, summary: "Nothing found.", error: true });
        return result({
          part,
          summary: part.found
            ? `${part.skill} appears in: ${part.where.map((w) => w.title).join("; ")}.`
            : `"${part.skill}" is not listed on this site.`,
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    match_job: tool({
      description:
        "Match a pasted job description against Vishal's profile: which requirements the portfolio supports, with evidence, and the gaps. Use when the visitor pastes a job posting.",
      inputSchema: z.object({ jdText: z.string().trim().min(40).max(LIMITS.jdInputChars) }),
      execute: async ({ jdText }): Promise<ToolResult> => {
        const matched = await runMatch(jdText);
        return result({
          part: { kind: "match", result: matched },
          summary: `Matched ${matched.results.length} requirements: ${matched.counts.strong} strong, ${matched.counts.partial} partial, ${matched.counts.gap} gap. ${matched.summary}`,
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    get_contact: tool({
      description:
        "Show how to reach Vishal (email, phone, WhatsApp, LinkedIn, GitHub) as buttons: copy, call, open.",
      inputSchema: z.object({
        kind: z.enum(["all", "email", "phone", "whatsapp", "linkedin", "github"]).default("all"),
      }),
      execute: async ({ kind }): Promise<ToolResult> =>
        result({ part: contactCard(kind), summary: `Showed contact details (${kind}).` }),
      toModelOutput: ({ output }) => modelText(output),
    }),

    get_site_stats: tool({
      description:
        "Show this site's real numbers: Lighthouse scores (written by CI), the last deploy, and whether his live products are up.",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolResult> => {
        const part = await statsPart(await getStatuses().catch(() => []));
        return result({ part, summary: "Showed Lighthouse scores, last deploy and live status." });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),
  } satisfies Record<ToolName, unknown>;
  return tools as ToolSet & typeof tools;
}

export type GridTools = ReturnType<typeof buildTools>;
