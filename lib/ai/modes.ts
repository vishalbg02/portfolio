import { interviewReady } from "@/content/interview";
import { shipped } from "@/lib/site";

/**
 * GRID's modes. A mode only changes the system prompt and the suggestions; it never unlocks a tool or a fact.
 * Interview appears once Vishal has written at least a few interview notes (content/interview.ts); Tour arrives
 * with the guided tour.
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
  ...(interviewReady() ? (["interview"] as const) : []),
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
    "The visitor is interviewing Vishal. Call interview_answer for every interview-style question and give his answer only as the tool returns it, in his own words; add facts from the profile only when the tool result or <context> states them. If there is no note for a question, say he has not told you yet and offer to send him the question (send_message_to_vishal). Never write an answer for him.",
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
  interview: [
    "Tell me about yourself.",
    "Which project are you most proud of, and why?",
    "Why should we hire you?",
  ],
  tour: ["Start the tour"],
};

/** The one-tap chip that sends a canned request (answered deterministically, with no model). */
export const BRIEF_PROMPT = "Brief me in 30 seconds";
