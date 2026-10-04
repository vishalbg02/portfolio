import type { GridMode } from "@/lib/ai/modes";

/** Window events that open GRID's surfaces. Tiny and dependency-free, so any component can use them. */
export const OPEN_GRID_EVENT = "app:open-grid";
export const OPEN_OMNIBAR_EVENT = "app:open-omnibar";
export const WORK_GO_EVENT = "app:work-go";
/** The store announces each card GRID produces live, so the page can act on it (take you there, open the demo). */
export const ACT_EVENT = "app:grid-act";

export type OpenGridDetail = {
  /** A question to send as soon as the chat is open. */
  question?: string;
  /** Scope retrieval to one project ("Ask about this project"). */
  project?: string;
  mode?: GridMode;
};

/** Opens the GRID chat (side sheet on a desktop, full-screen on a phone), optionally asking something. */
export const openGrid = (detail: OpenGridDetail = {}) =>
  window.dispatchEvent(new CustomEvent<OpenGridDetail>(OPEN_GRID_EVENT, { detail }));

/** Back-compat name used by the terminal, the dock and "Ask about this project". */
export const openChat = (question?: string, project?: string) => openGrid({ question, project });

/** Focuses the Omnibar (commands and questions in one input). */
export const openOmnibar = (prefill = "") =>
  window.dispatchEvent(new CustomEvent(OPEN_OMNIBAR_EVENT, { detail: { prefill } }));

/** Moves the Work showcase to a project's scene (and beat). */
export const workGo = (slug: string, beat?: number) =>
  window.dispatchEvent(new CustomEvent(WORK_GO_EVENT, { detail: { slug, beat } }));
