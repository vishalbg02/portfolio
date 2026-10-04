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
 */
export type Source = { n: number; title: string; url: string };

export type ChatMode = "ai" | "offline" | "refusal" | "router";
export type OfflineReason = "no_key" | "budget" | "error" | "off_topic";

/** The tools GRID can call. Every one is read-only in Phase 2; the side-effect tools come with a confirmation gate. */
export const TOOL_NAMES = [
  "search_profile",
  "navigate",
  "show_project",
  "play_demo",
  "show_diagram",
  "show_skill_evidence",
  "match_job",
  "get_contact",
  "get_site_stats",
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
        type: "project" | "experience" | "skills";
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
  | { kind: "match"; result: unknown };

export const PART_KINDS = [
  "project",
  "contact",
  "skill",
  "stats",
  "diagram",
  "demo",
  "navigate",
  "match",
] as const;

/** The client trusts parts only from its own origin, but still refuses anything of an unknown shape. */
export const isUiPart = (v: unknown): v is UiPart =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { kind?: unknown }).kind === "string" &&
  (PART_KINDS as readonly string[]).includes((v as { kind: string }).kind);

export type ChatEvent =
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
