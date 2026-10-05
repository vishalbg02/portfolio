import type { Source, ToolName, UiPart } from "@/lib/ai/protocol";

/**
 * One scripted exchange in the Ask section's demo. It is the router's REAL answer to the question (built from
 * content at build time, see lib/ai/agent/demo.ts), so the demo never shows something GRID would not say.
 */
export type DemoScene = {
  q: string;
  text: string;
  sources: Source[];
  parts: UiPart[];
  /** The tool the router used, shown as GRID's "working" line before the card appears. */
  tool: ToolName | null;
};

/** What each tool's working line says. The same words the chat shows while a tool runs. */
export const TOOL_WORKING: Record<ToolName, string> = {
  search_profile: "Searching his profile",
  navigate: "Taking you there",
  show_project: "Pulling up the project",
  show_role: "Pulling up the role",
  play_demo: "Opening the walkthrough",
  show_diagram: "Drawing the architecture",
  show_skill_evidence: "Finding the evidence",
  match_job: "Matching the job description",
  get_contact: "Getting his contact details",
  get_site_stats: "Reading the site's numbers",
  draft_message: "Drafting a message",
  send_message_to_vishal: "Preparing the message",
  book_call: "Opening his calendar",
  tailor_resume: "Re-ordering the résumé",
  interview_answer: "Finding his answer",
  start_live_chat: "Checking if he is online",
  start_tour: "Getting the tour ready",
};

/** The same, once the tool has finished. */
export const TOOL_DONE: Record<ToolName, string> = {
  search_profile: "Searched his profile",
  navigate: "Took you there",
  show_project: "Pulled up the project",
  show_role: "Pulled up the role",
  play_demo: "Opened the walkthrough",
  show_diagram: "Drew the architecture",
  show_skill_evidence: "Found the evidence",
  match_job: "Matched the job description",
  get_contact: "Got his contact details",
  get_site_stats: "Read the site's numbers",
  draft_message: "Drafted a message",
  send_message_to_vishal: "Prepared the message",
  book_call: "Opened his calendar",
  tailor_resume: "Re-ordered the résumé",
  interview_answer: "Found his answer",
  start_live_chat: "Checked if he is online",
  start_tour: "Got the tour ready",
};

/** The timeline of one scene in milliseconds from its start. Pure, so the reel and its tests share it. */
export const TIMING = {
  typeStart: 350,
  perChar: 34,
  sendPause: 320,
  think: 650,
  tool: 750,
  perAnswerChar: 16,
  hold: 4200,
} as const;

export type DemoPhase = "type" | "think" | "tool" | "answer" | "hold";
export type DemoFrame = {
  phase: DemoPhase;
  /** Characters of the question typed so far. */
  typed: number;
  /** Characters of the answer revealed so far. */
  shown: number;
  /** The cards are visible (from the moment the answer starts). */
  cards: boolean;
};

export function sceneDuration(s: DemoScene): number {
  const typed = TIMING.typeStart + TIMING.perChar * s.q.length;
  const sent = typed + TIMING.sendPause + TIMING.think + (s.tool ? TIMING.tool : 0);
  return sent + TIMING.perAnswerChar * s.text.length + TIMING.hold;
}

/** What the stage shows `t` ms into a scene. `t` at or past the end is the settled final frame. */
export function frameAt(s: DemoScene, t: number): DemoFrame {
  const typeEnd = TIMING.typeStart + TIMING.perChar * s.q.length;
  const thinkStart = typeEnd + TIMING.sendPause;
  const toolStart = thinkStart + TIMING.think;
  const answerStart = toolStart + (s.tool ? TIMING.tool : 0);
  const answerEnd = answerStart + TIMING.perAnswerChar * s.text.length;
  if (t < typeEnd) {
    return {
      phase: "type",
      typed: Math.max(0, Math.min(s.q.length, Math.floor((t - TIMING.typeStart) / TIMING.perChar))),
      shown: 0,
      cards: false,
    };
  }
  if (t < thinkStart) return { phase: "type", typed: s.q.length, shown: 0, cards: false };
  if (t < toolStart) return { phase: "think", typed: s.q.length, shown: 0, cards: false };
  if (t < answerStart) return { phase: "tool", typed: s.q.length, shown: 0, cards: false };
  if (t < answerEnd) {
    return {
      phase: "answer",
      typed: s.q.length,
      shown: Math.floor((t - answerStart) / TIMING.perAnswerChar),
      cards: true,
    };
  }
  return { phase: "hold", typed: s.q.length, shown: s.text.length, cards: true };
}

/** Cuts an answer for the typing effect without leaving half a citation ("[" or "[1") on screen. */
export const clipAnswer = (text: string, shown: number): string =>
  shown >= text.length ? text : text.slice(0, Math.max(0, shown)).replace(/\s*\[\d*$/, "");
