/**
 * GRID's streaming protocol (NDJSON, one event per line). Shared by server and client, and the same for
 * the model-backed, the router-backed and the offline answer, so the UI has one code path.
 *
 *   {"t":"meta","mode":"ai","sources":[{"n":1,"title":"…","url":"/work/talnio"}]}
 *   {"t":"tool","id":"c1","name":"show_project","state":"running"}
 *   {"t":"part","id":"c1","part":{"kind":"project",…}}       a card to render (built from content, never by the model)
 *   {"t":"sources","sources":[…]}                              the full list so far (a tool may add more)
 *   {"t":"text","d":"Vishal built …"}                          (repeated)
 *   {"t":"followups","items":["…","…","…"]}
 *   {"t":"done"}
 *
 *   {"t":"stage","s":"retrieve","state":"done","n":8}          where the request is in the pipeline (V4): the router,
 *                                                              retrieval, ranking and the answer; tools have their own
 *                                                              "tool" events. Drives "How GRID works" and GRID's face.
 */
export type Source = { n: number; title: string; url: string };

export type ChatMode = "ai" | "offline" | "refusal" | "router";
export type OfflineReason = "no_key" | "budget" | "error" | "off_topic";

/**
 * The tools GRID can call. None of them DOES anything to the world: the ones that touch it (send_message_to_vishal)
 * only prepare a card the visitor must confirm, and the send itself goes through its own API route.
 */
export const TOOL_NAMES = [
  "search_profile",
  "navigate",
  "show_project",
  "show_role",
  "brief_me",
  "play_demo",
  "show_diagram",
  "show_skill_evidence",
  "match_job",
  "get_contact",
  "get_site_stats",
  "draft_message",
  "send_message_to_vishal",
  "book_call",
  "tailor_resume",
  "interview_answer",
  "start_live_chat",
  "start_tour",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export type ProjectImage = {
  avifSet: string;
  webpSet: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  frame: "browser" | "phone";
};

export type ContactAction =
  | { type: "copy"; label: string; text: string }
  | { type: "call"; label: string; href: string }
  | { type: "open"; label: string; href: string };

/**
 * What a tool renders in the chat. Built on the server from content/*.ts (the model only chooses WHICH card
 * and for what slug or skill), so a card can never say something that isn't in the content files.
 */
export type UiPart =
  | {
      kind: "project";
      slug: string;
      name: string;
      tagline: string;
      summary: string;
      eyebrow: string;
      stack: string[];
      links: Array<{ label: string; href: string; external: boolean }>;
      badge: string | null;
      live: boolean;
      image: ProjectImage | null;
    }
  | {
      kind: "contact";
      items: Array<{ id: string; label: string; value: string; actions: ContactAction[] }>;
    }
  | {
      kind: "skill";
      skill: string;
      found: boolean;
      where: Array<{
        type: "project" | "experience" | "skills" | "education";
        title: string;
        detail: string;
        href: string | null;
      }>;
    }
  | {
      kind: "stats";
      lighthouse: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
        commit: string;
        generatedAt: string;
        url: string;
      } | null;
      deploy: { builtAt: string | null; commit: string | null };
      products: Array<{
        slug: string;
        name: string;
        state: "live" | "degraded" | "offline" | null;
        latencyMs: number | null;
      }>;
    }
  | { kind: "diagram"; slug: string; name: string }
  | { kind: "demo"; slug: string; name: string; beat: number | null; label: string }
  | { kind: "navigate"; target: string; href: string; label: string }
  | { kind: "match"; result: unknown }
  | {
      /** A message to Vishal, ready for the visitor to review. Nothing is sent until they press Send. */
      kind: "confirm";
      action: "send_message";
      name: string;
      email: string;
      /** Optional: the sender's company and the role they are writing about (pre-filled from what they typed). */
      company: string;
      role: string;
      message: string;
      /** Where to write instead if delivery is not possible (built on the server from the profile). */
      mailto: string;
    }
  | { kind: "draft"; draftKind: DraftKind; subject: string; body: string; mailto: string }
  | {
      kind: "resume";
      role: string | null;
      requirements: Array<{ skill: string; importance: "high" | "medium" | "low" }>;
      movedUp: string[];
      emphasised: string[];
      gaps: string[];
    }
  | { kind: "book"; calLink: string | null; mailto: string }
  | { kind: "interview"; question: string; answer: string | null; matched: string | null; mailto: string }
  | {
      /** Hand the conversation to Vishal himself: the live chat, with a summary to start from. */
      kind: "live";
      summary: string;
      state: "online" | "away" | "off";
      time: string;
    }
  | {
      /** The 60-second guided tour of the home page: a button that starts it. */
      kind: "tour";
      stops: number;
    }
  | {
      /** "Brief me in 30 seconds": who he is, his strongest proof, how he fits the target role, how to reach him. */
      kind: "brief";
      who: string;
      status: string;
      proofs: Array<{ title: string; line: string; href: string }>;
      role: string;
      fit: Array<{ skill: string; where: string | null }>;
      podiums: number;
      reach: { email: string; linkedin: string; calLink: string | null };
    }
  | {
      /** A role (an internship or freelance job) from profile.experience, as a card: what he did and with what. */
      kind: "role";
      id: string;
      title: string;
      company: string;
      short: string;
      period: string;
      jobKind: string;
      /** The first line of the role's description. */
      impact: string;
      stack: string[];
      href: string;
    };

export const DRAFT_KINDS = ["interview_invite", "intro", "project_inquiry", "hackathon_team"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const PART_KINDS = [
  "project",
  "contact",
  "skill",
  "stats",
  "diagram",
  "demo",
  "navigate",
  "match",
  "confirm",
  "draft",
  "resume",
  "book",
  "interview",
  "live",
  "tour",
  "role",
  "brief",
] as const;

/** The client trusts parts only from its own origin, but still refuses anything of an unknown shape. */
export const isUiPart = (v: unknown): v is UiPart =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { kind?: unknown }).kind === "string" &&
  (PART_KINDS as readonly string[]).includes((v as { kind: string }).kind);

/** The pipeline's stages, in order (tools in between are reported by their own "tool" events). */
export const STAGES = ["route", "retrieve", "rank", "answer"] as const;
export type StageName = (typeof STAGES)[number];
export type StageState = "start" | "done" | "skip";

export type ChatEvent =
  | { t: "stage"; s: StageName; state: StageState; n?: number }
  | { t: "meta"; mode: ChatMode; sources: Source[]; reason?: OfflineReason }
  | { t: "sources"; sources: Source[] }
  | { t: "tool"; id: string; name: ToolName; state: "running" | "done" | "error" }
  | { t: "part"; id: string; part: UiPart }
  | { t: "text"; d: string }
  | { t: "followups"; items: string[] }
  | { t: "done" }
  | { t: "error"; message: string };

export const encodeEvent = (e: ChatEvent) => JSON.stringify(e) + "\n";

/** Incremental NDJSON parser: feed chunks, get complete events (partial lines are buffered). */
export class EventParser {
  private buf = "";
  push(chunk: string): ChatEvent[] {
    this.buf += chunk;
    const lines = this.buf.split("\n");
    this.buf = lines.pop() ?? "";
    const out: ChatEvent[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as ChatEvent;
        if (e && typeof e === "object" && "t" in e) out.push(e);
      } catch {
        /* ignore a corrupt line rather than break the stream */
      }
    }
    return out;
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
