import { shipped } from "@/lib/site";

/**
 * GRID's modes. A mode only changes the system prompt and the suggestions; it never unlocks a tool or a fact.
 * Interview and Tour arrive with the features they depend on (curated interview notes, the guided tour).
 */
export type GridMode = "default" | "recruiter" | "engineer" | "interview" | "tour";

export const MODE_LABEL: Record<GridMode, string> = {
  default: "Ask anything",
  recruiter: "Recruiter",
  engineer: "Engineer",
  interview: "Interview",
  tour: "Tour",
};

/** The modes a visitor can pick today. */
export const availableModes = (): GridMode[] => [
  "default",
  "recruiter",
  "engineer",
  ...(shipped.interview ? (["interview"] as const) : []),
  ...(shipped.tour ? (["tour"] as const) : []),
];

export const isMode = (v: unknown): v is GridMode =>
  typeof v === "string" && (Object.keys(MODE_LABEL) as string[]).includes(v);

/** The line added to the system prompt for a mode. */
export const MODE_PROMPT: Record<GridMode, string> = {
  default: "Answer what was asked, directly.",
  recruiter:
    "The visitor is a recruiter or hiring manager. Lead with fit for the role they describe: relevant skills and shipped work, availability and how to reach him, and the gaps stated plainly (never hide a gap). Offer the résumé and the job-description matcher.",
  engineer:
    "The visitor is an engineer. Lead with architecture, technology choices, trade-offs and where the code or the diagram can be seen. Prefer show_diagram and show_project over long prose, and name the exact technologies from the context.",
  interview:
    "The visitor is practising or running an interview. Answer only from the curated interview notes and the profile; if a question has no note, say it hasn't been answered yet.",
  tour: "The visitor is on a guided tour. Keep answers to one or two sentences.",
};

/** Suggestions shown in an empty chat, per mode. Each is answerable from the content or by a tool. */
export const MODE_SUGGESTIONS: Record<GridMode, string[]> = {
  default: [
    "What has he built with Spring Boot?",
    "Show me his best backend work",
    "Is he available, and how do I reach him?",
    "What are the site's Lighthouse scores?",
  ],
  recruiter: [
    "Is he a fit for a full-stack role?",
    "Which roles is he looking for?",
    "Show me how to reach him",
    "Where did he use Java and Spring Boot?",
  ],
  engineer: [
    "Show the Golden Verdict architecture",
    "How does LanSymphony encrypt traffic?",
    "Why Firestore transactions for request tracking?",
    "Show me the Talnio project",
  ],
  interview: ["Tell me about a project he is proud of", "What is his strongest technical skill?"],
  tour: ["Start the tour"],
};

/** The one-tap chip that sends a canned request (answered deterministically, with no model). */
export const BRIEF_PROMPT = "Brief me in 30 seconds";
