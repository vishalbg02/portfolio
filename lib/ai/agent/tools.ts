import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { ProjectSlugSchema } from "@/lib/content/profile-schema";
import { DRAFT_KINDS } from "../protocol";
import { NAV_TARGET_IDS, resolveTarget } from "@/lib/grid/targets";
import { runMatch } from "@/lib/match/run";
import { getRetriever } from "@/lib/rag/store";
import { getStatuses } from "@/lib/status/cache";
import { profile } from "@/content/profile";
import { LIMITS } from "../limits";
import type { ToolName, UiPart } from "../protocol";
import {
  bookPart,
  confirmPart,
  livePart,
  contactCard,
  demoPart,
  diagramPart,
  navigatePart,
  projectCard,
  skillEvidence,
  statsPart,
  tourPart,
  ROLE_NAMES,
  rolePart,
  briefPart,
} from "./cards";
import { currentPresence } from "@/lib/live/read";
import { draftPart } from "./drafts";
import { interviewCard } from "./interview";
import { extractSlots } from "./slots";
import { cleanRole, requirementsFor, resumeCard } from "./resume";
import { embedQuery, inScope, SCOPES } from "./retrieval";
import type { SourceRegistry } from "./sources";

/**
 * GRID's tools. Every tool is read-only and returns `{ part, summary }`: `part` is the card the visitor sees
 * (built from content, see cards.ts), `summary` is the short text the MODEL sees (toModelOutput), so a card's
 * payload never has to pass through the model. Inputs are Zod-validated, so the model cannot pass anything the
 * schema doesn't allow (a slug is one of four, a navigation target one of a fixed list).
 */
export type ToolResult = { part: UiPart | null; summary: string; error?: boolean };

const withoutEmpty = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;

export type ToolContext = {
  sources: SourceRegistry;
  /** The visitor's latest message: who they said they are fills any card field the model left empty. */
  visitorText?: string;
};

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

    brief_me: tool({
      description:
        "Show a 30-second brief of Vishal as one card: who he is, his strongest proof, how he fits his target role, and how to reach him. Use for 'brief me', 'give me a summary', 'who is he in short'.",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolResult> => {
        const n = ctx.sources.addLink("about", `About ${profile.name}`, "/");
        return result({
          part: briefPart(),
          summary: `Showed the brief card (cite as [${n}]). Add one sentence at most; do not repeat the card.`,
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    show_role: tool({
      description:
        "Show one of his roles (an internship or freelance job) as a card: title, company, dates, what he did and the stack. Use with show_project when someone asks to SEE his work in an area (backend, frontend, mobile).",
      inputSchema: z.object({ role: z.enum(ROLE_NAMES).describe("The role, by its short name") }),
      execute: async ({ role }): Promise<ToolResult> => {
        const part = rolePart(role);
        if (!part) return result({ part: null, summary: "No such role.", error: true });
        const n = ctx.sources.addLink(`role-${role}`, `${role} — experience`, "/#experience");
        return result({ part, summary: `Showed the ${role} role card (cite as [${n}] if you describe it).` });
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

    draft_message: tool({
      description:
        "Draft a short message for the VISITOR to edit and send to Vishal or copy: an interview invitation, an introduction, a project inquiry, or a hackathon-team invitation. Use when asked to draft, write or compose one. Fill only what the visitor told you.",
      inputSchema: z.object({
        kind: z.enum(DRAFT_KINDS),
        senderName: z.string().trim().max(80).optional(),
        company: z.string().trim().max(80).optional(),
        role: z.string().trim().max(80).optional(),
        topic: z.string().trim().max(80).optional(),
        when: z.string().trim().max(80).optional(),
      }),
      execute: async ({ kind, ...context }): Promise<ToolResult> =>
        result({
          part: draftPart(kind, context),
          summary: `Showed an editable ${kind.replace("_", " ")} draft with [placeholders] for anything unknown. The visitor can edit, copy, or send it to Vishal. Do not repeat the draft.`,
        }),
      toModelOutput: ({ output }) => modelText(output),
    }),

    // THE GATE: this tool sends nothing. It only prepares a card; the visitor reads it, edits it and presses Send,
    // and that press goes to /api/grid/message, which validates and rate-limits it. The model has no way to send.
    send_message_to_vishal: tool({
      description:
        "Prepare a message from the visitor to Vishal. This does NOT send anything: it shows a card where the visitor reviews, edits and confirms. Use when they want to message him, send him an invite, or pass on a question you could not answer. Put only what the visitor said into the fields: their name, email, company and the role they are hiring for when they said them.",
      inputSchema: z.object({
        name: z.string().trim().max(80).optional(),
        email: z.string().trim().max(200).optional(),
        company: z.string().trim().max(80).optional(),
        role: z.string().trim().max(80).optional(),
        message: z.string().trim().min(1).max(1500),
      }),
      execute: async (input): Promise<ToolResult> =>
        result({
          // the model's fields win; anything it left out comes from the visitor's own words (validated slots)
          part: confirmPart({ ...extractSlots(ctx.visitorText ?? ""), ...withoutEmpty(input) }),
          summary:
            "Prepared a message for the visitor to review. NOTHING has been sent. Tell them to check it and press Send (or edit or cancel).",
        }),
      toModelOutput: ({ output }) => modelText(output),
    }),

    book_call: tool({
      description:
        "Show how to book a call with Vishal: a booking link when he has one, otherwise an offer to leave a message. Use for 'book a call', 'schedule a meeting'.",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolResult> => {
        const part = bookPart();
        return result({
          part,
          summary:
            part.kind === "book" && part.calLink
              ? "Showed a button to book a call."
              : "Booking is not set up yet; showed an offer to leave a message instead.",
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    tailor_resume: tool({
      description:
        "Re-order Vishal's one-page résumé for a role: from a pasted job description or a short focus (such as 'backend Java'). It only re-orders what the résumé already says, never writes new text, and lists the gaps. Returns a card with a PDF download.",
      inputSchema: z.object({
        jdText: z.string().trim().min(40).max(LIMITS.jdInputChars).optional(),
        focus: z.string().trim().min(2).max(200).optional(),
        role: z.string().trim().max(60).optional(),
      }),
      execute: async ({ jdText, focus, role }): Promise<ToolResult> => {
        const requirements = await requirementsFor({ jdText, focus });
        if (requirements.length === 0)
          return result({
            part: null,
            summary:
              "No skills could be recognised. Ask the visitor for the role, the key skills, or the job description.",
            error: true,
          });
        const part = resumeCard(requirements, cleanRole(role));
        return result({
          part,
          summary:
            part.kind === "resume"
              ? `Tailored résumé ready (re-ordered only). Gaps, not hidden: ${part.gaps.join(", ") || "none"}.`
              : "Tailored résumé ready.",
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    start_live_chat: tool({
      description:
        "Hand the conversation to Vishal himself: show whether he is online and a button that opens the live chat, starting from a short summary of what the visitor wanted. Use when the visitor wants to talk to him directly, or when you could not answer and a person should.",
      inputSchema: z.object({
        summary: z
          .string()
          .trim()
          .max(500)
          .optional()
          .describe("One or two sentences of what the visitor asked, in their words; no invented details"),
      }),
      execute: async ({ summary }): Promise<ToolResult> => {
        const presence = await currentPresence();
        return result({
          part: livePart(presence, summary ?? ""),
          summary:
            presence.configured && presence.state === "online"
              ? "Showed that Vishal is online and a button to chat with him. Do not repeat the card."
              : presence.configured
                ? "Showed that Vishal is away; the visitor can leave a message and he will reply by email."
                : "Live chat is not switched on; showed an offer to leave a message instead.",
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),

    start_tour: tool({
      description:
        "Start the 60-second guided tour of the home page: it scrolls through six stops (who he is, work, experience, stack, activity, how to reach him) with a short caption each. Use when the visitor asks for a tour or to be shown around.",
      inputSchema: z.object({ mode: z.enum(["60s"]).default("60s") }),
      execute: async (): Promise<ToolResult> =>
        result({
          part: tourPart(),
          summary:
            "Started the 60-second tour (it plays on the page). Add one short sentence; do not describe the stops.",
        }),
      toModelOutput: ({ output }) => modelText(output),
    }),

    interview_answer: tool({
      description:
        "Look up Vishal's own written answer to an interview question (about yourself, a proud project, weaknesses, why hire, and so on). Returns his answer verbatim or says he has not written one yet.",
      inputSchema: z.object({ question: z.string().trim().min(3).max(200) }),
      execute: async ({ question }): Promise<ToolResult> => {
        const part = interviewCard(question);
        const answer = part.kind === "interview" ? part.answer : null;
        return result({
          part,
          summary: answer
            ? "Showed Vishal's own answer in a quote card. Do not repeat or rephrase it; add at most one short sentence."
            : "He has not written an answer to this yet. Say that plainly and offer to send him the question (send_message_to_vishal).",
        });
      },
      toModelOutput: ({ output }) => modelText(output),
    }),
  } satisfies Record<ToolName, unknown>;
  return tools as ToolSet & typeof tools;
}

export type GridTools = ReturnType<typeof buildTools>;
