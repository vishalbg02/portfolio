import type { ToolName } from "@/lib/ai/protocol";

/** What each tool's working line says. The same words the chat shows while a tool runs. */
export const TOOL_WORKING: Record<ToolName, string> = {
  search_profile: "Searching his profile",
  navigate: "Taking you there",
  show_project: "Pulling up the project",
  show_role: "Pulling up the role",
  brief_me: "Putting the brief together",
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
  brief_me: "Put the brief together",
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
